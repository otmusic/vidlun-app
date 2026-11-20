import Accelerate
import AVFoundation
import Foundation

/// What the phone hears in a voice, measured from a kept recording: a few
/// numbers about how it sounded, never the sound itself. Each one is nil when
/// the take held too little speech to say anything honest about it.
public struct VoiceMeasures {
  public var speechMs: Double = 0
  /// The voice's usual pitch, the median over every voiced moment.
  public var pitchHz: Double?
  /// How far the pitch travels, from its low tenth to its high tenth, in
  /// semitones: a flat voice moves little, a lively one a lot.
  public var pitchRangeSemitones: Double?
  /// How loud the speech is, the median in decibels below full scale.
  public var loudnessDb: Double?
  /// How much the loudness swings, low tenth to high tenth.
  public var loudnessRangeDb: Double?
  /// The share of the speaking stretch spent in pauses of a quarter second or more.
  public var pauseShare: Double?
  /// Beats a second of speech: how fast the person talks, for comparing a
  /// take with the person's other takes rather than counting syllables.
  public var pace: Double?
  /// The voice's power-weighted mean frequency: higher is brighter, lower darker.
  public var brightnessHz: Double?

  public var dictionary: [String: Any] {
    var out: [String: Any] = ["version": VoiceAnalysis.version, "speechMs": speechMs]
    out["pitchHz"] = pitchHz
    out["pitchRangeSemitones"] = pitchRangeSemitones
    out["loudnessDb"] = loudnessDb
    out["loudnessRangeDb"] = loudnessRangeDb
    out["pauseShare"] = pauseShare
    out["pace"] = pace
    out["brightnessHz"] = brightnessHz
    return out
  }
}

public enum VoiceAnalysis {
  /// Raised whenever a measure changes meaning, so older readings can be told apart.
  public static let version = 1

  /// Frames of 40 ms every 20 ms: long enough to hold two periods of a low voice.
  static let frameSeconds = 0.04
  static let hopSeconds = 0.02
  /// The pitch a speaking voice can have; outside it is noise or a whistle.
  static let lowestPitch = 70.0
  static let highestPitch = 400.0
  /// How alike a frame must be to itself one period on to count as voiced.
  static let voicedLikeness: Float = 0.6
  /// A pause is a quarter of a second or more without speech.
  static let pauseSeconds = 0.26
  /// Less speech than this and every number would be a guess.
  static let enoughSpeechSeconds = 0.5

  public static func analyze(url: URL) throws -> VoiceMeasures {
    guard let decoded = try read(url: url) else {
      return VoiceMeasures()
    }

    return measure(samples: decoded.samples, rate: decoded.rate)
  }

  /// Where someone is speaking in the recording, as [from, to] pairs in
  /// milliseconds: the measures' own test for speech, with a pause of a
  /// quarter second or more between one stretch and the next.
  public static func speechSpans(url: URL) throws -> [[Double]] {
    guard let decoded = try read(url: url) else {
      return []
    }

    return spans(samples: decoded.samples, rate: decoded.rate)
  }

  /// The recording's first channel, decoded, with its sample rate.
  static func read(url: URL) throws -> (samples: [Float], rate: Double)? {
    let file = try AVAudioFile(forReading: url)
    let format = file.processingFormat
    let length = AVAudioFrameCount(file.length)

    guard length > 0,
      let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: length)
    else {
      return nil
    }

    try file.read(into: buffer)

    guard let channel = buffer.floatChannelData?[0] else {
      return nil
    }

    return (Array(UnsafeBufferPointer(start: channel, count: Int(buffer.frameLength))), format.sampleRate)
  }

  public static func spans(samples raw: [Float], rate: Double) -> [[Double]] {
    let frame = Int(rate * frameSeconds)
    let hop = Int(rate * hopSeconds)

    guard frame > 0, hop > 0, raw.count >= frame else {
      return []
    }

    let samples = vDSP.add(-vDSP.mean(raw), raw)
    let frames = (samples.count - frame) / hop + 1
    var decibels = [Double](repeating: -120, count: frames)

    samples.withUnsafeBufferPointer { all in
      guard let base = all.baseAddress else { return }
      for at in 0..<frames {
        let rms = vDSP.rootMeanSquare(UnsafeBufferPointer(start: base + at * hop, count: frame))
        decibels[at] = 20 * log10(max(Double(rms), 1e-6))
      }
    }

    // The same line between speech and room as the measures draw.
    let threshold = max(percentile(decibels, 0.1) + 12, -60)
    let shortest = Int((pauseSeconds / hopSeconds).rounded())
    let frameMs = hopSeconds * 1000
    var found: [[Double]] = []
    var opened: Int?
    var lastSpoken = 0

    for at in 0..<frames {
      if decibels[at] > threshold {
        if opened == nil { opened = at }
        lastSpoken = at
      } else if let start = opened, at - lastSpoken >= shortest {
        found.append([Double(start) * frameMs, Double(lastSpoken + 1) * frameMs])
        opened = nil
      }
    }

    if let start = opened {
      found.append([Double(start) * frameMs, Double(lastSpoken + 1) * frameMs])
    }

    return found
  }

  public static func measure(samples raw: [Float], rate: Double) -> VoiceMeasures {
    let frame = Int(rate * frameSeconds)
    let hop = Int(rate * hopSeconds)
    let minLag = Int(rate / highestPitch)
    let maxLag = Int(rate / lowestPitch)

    guard raw.count >= frame + maxLag + 1 else {
      return VoiceMeasures()
    }

    // The recorder's tiny constant offset would read as low-frequency energy.
    let samples = vDSP.add(-vDSP.mean(raw), raw)
    let frames = (samples.count - frame - maxLag) / hop + 1

    // Running sums of squares, in double so a minute of audio does not drift.
    var energyUpTo = [Double](repeating: 0, count: samples.count + 1)
    for index in 0..<samples.count {
      energyUpTo[index + 1] = energyUpTo[index] + Double(samples[index] * samples[index])
    }
    func energy(_ start: Int, _ count: Int) -> Double {
      energyUpTo[start + count] - energyUpTo[start]
    }

    var decibels = [Double](repeating: -120, count: frames)
    for at in 0..<frames {
      let rms = sqrt(energy(at * hop, frame) / Double(frame))
      decibels[at] = 20 * log10(max(rms, 1e-6))
    }

    // Speech stands well clear of the room: the quietest tenth is the room.
    let floor = percentile(decibels, 0.1)
    let threshold = max(floor + 12, -60)
    let speaking = decibels.map { $0 > threshold }
    let speechFrames = speaking.filter { $0 }.count
    var measures = VoiceMeasures()
    measures.speechMs = Double(speechFrames) * hopSeconds * 1000

    guard Double(speechFrames) * hopSeconds >= enoughSpeechSeconds else {
      return measures
    }

    var pitches: [Double] = []
    var brightness: [Double] = []
    var brightnessWeights: [Double] = []
    var correlation = [Float](repeating: 0, count: maxLag + 1)

    samples.withUnsafeBufferPointer { all in
      guard let base = all.baseAddress else { return }

      for at in 0..<frames where speaking[at] {
        let start = at * hop
        let here = base + start

        // How alike the frame is to itself shifted by each candidate period.
        vDSP_conv(here, 1, here, 1, &correlation, 1, vDSP_Length(maxLag + 1), vDSP_Length(frame))

        let own = energy(start, frame)
        var likeness = [Float](repeating: 0, count: maxLag + 1)
        var best: Float = 0
        for lag in minLag...maxLag {
          let shifted = energy(start + lag, frame)
          let scale = sqrt(own * shifted)
          likeness[lag] = scale > 0 ? correlation[lag] / Float(scale) : 0
          best = max(best, likeness[lag])
        }

        // The first peak nearly as tall as the tallest: a voice's own period,
        // not a multiple of it, which would read an octave low.
        if best >= voicedLikeness {
          var lag = minLag + 1
          while lag < maxLag {
            if likeness[lag] >= 0.88 * best && likeness[lag] >= likeness[lag - 1]
              && likeness[lag] >= likeness[lag + 1]
            {
              break
            }
            lag += 1
          }
          // A period at the very edge of the range is not one the voice has.
          guard lag < maxLag || likeness[maxLag] >= 0.88 * best else { continue }
          let shift = parabolicShift(likeness[lag - 1], likeness[lag], likeness[min(lag + 1, maxLag)])
          pitches.append(rate / (Double(lag) + shift))
        }

        // The mean frequency, from how fast the signal changes against how
        // big it is: exact for a pure tone, power-weighted for a voice.
        var change: Double = 0
        for index in start..<(start + frame - 1) {
          let step = Double(samples[index + 1] - samples[index])
          change += step * step
        }
        if own > 0 {
          let ratio = min(1, sqrt(change / own) / 2)
          brightness.append(rate / Double.pi * asin(ratio))
          brightnessWeights.append(own)
        }
      }
    }

    let speechDecibels = zip(decibels, speaking).filter { $0.1 }.map { $0.0 }
    measures.loudnessDb = percentile(speechDecibels, 0.5)
    measures.loudnessRangeDb = percentile(speechDecibels, 0.9) - percentile(speechDecibels, 0.1)
    measures.pauseShare = pauseShare(speaking)
    measures.pace = pace(
      energy: energy, count: samples.count, rate: rate, threshold: threshold,
      speechSeconds: Double(speechFrames) * hopSeconds)

    if pitches.count >= 10 {
      let low = percentile(pitches, 0.1)
      let high = percentile(pitches, 0.9)
      measures.pitchHz = percentile(pitches, 0.5)
      measures.pitchRangeSemitones = 12 * log2(high / low)
    }

    let weight = brightnessWeights.reduce(0, +)
    if weight > 0 {
      measures.brightnessHz = zip(brightness, brightnessWeights).map { $0 * $1 }.reduce(0, +) / weight
    }

    return measures
  }

  /// Where the true peak sits between three neighbouring samples.
  static func parabolicShift(_ before: Float, _ peak: Float, _ after: Float) -> Double {
    let bend = before - 2 * peak + after
    guard bend != 0 else { return 0 }
    return Double(max(-0.5, min(0.5, 0.5 * (before - after) / bend)))
  }

  /// Pauses inside the speaking stretch, not the quiet before the first word or after the last.
  static func pauseShare(_ speaking: [Bool]) -> Double? {
    guard let first = speaking.firstIndex(of: true), let last = speaking.lastIndex(of: true),
      last > first
    else {
      return nil
    }
    let shortest = Int((pauseSeconds / hopSeconds).rounded())
    var paused = 0
    var run = 0
    for at in first...last {
      if speaking[at] {
        if run >= shortest { paused += run }
        run = 0
      } else {
        run += 1
      }
    }
    return Double(paused) / Double(last - first + 1)
  }

  /// Counts the loudness peaks that stand out from the dips on either side,
  /// per second of speech. Read on a finer grid than the rest, 30 ms every
  /// 10 ms, since syllables come four or five a second and a coarser grid
  /// smooths them into one another; 30 rather than 20 so a deep voice's own
  /// pitch does not ripple the envelope into extra beats. It catches the
  /// clearer beats rather than every syllable — about half of them in speech
  /// synthesised for the check — and holds steady across voices, which is
  /// what comparing a person with themselves needs.
  static func pace(
    energy: (Int, Int) -> Double, count: Int, rate: Double, threshold: Double, speechSeconds: Double
  ) -> Double? {
    let window = Int(rate * 0.03)
    let step = Int(rate * 0.01)
    guard speechSeconds > 0, count > window + 2 * step else { return nil }
    let steps = (count - window) / step + 1
    var envelope = [Double](repeating: -120, count: steps)
    for at in 0..<steps {
      envelope[at] = 10 * log10(max(energy(at * step, window) / Double(window), 1e-12))
    }
    var smooth = envelope
    for at in 1..<(steps - 1) {
      smooth[at] = (envelope[at - 1] + envelope[at] + envelope[at + 1]) / 3
    }
    envelope = smooth
    let reach = 8
    let apart = 8
    var beats = 0
    var lastBeat = -apart
    for at in 1..<(steps - 1) where envelope[at] > threshold {
      guard envelope[at] >= envelope[at - 1], envelope[at] > envelope[at + 1], at - lastBeat >= apart
      else {
        continue
      }
      let left = envelope[max(0, at - reach)..<at].min() ?? envelope[at]
      let right = envelope[(at + 1)...min(steps - 1, at + reach)].min() ?? envelope[at]
      if envelope[at] - max(left, right) >= 1.5 {
        beats += 1
        lastBeat = at
      }
    }
    return Double(beats) / speechSeconds
  }

  static func percentile(_ values: [Double], _ share: Double) -> Double {
    guard !values.isEmpty else { return 0 }
    let sorted = values.sorted()
    let place = share * Double(sorted.count - 1)
    let below = Int(place.rounded(.down))
    let above = min(below + 1, sorted.count - 1)
    let part = place - Double(below)
    return sorted[below] * (1 - part) + sorted[above] * part
  }
}
