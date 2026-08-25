import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';

/**
 * What the speech model wants, not what sounds best.
 *
 * whisper.cpp — which whisper.rn wraps — consumes 16 kHz mono. The §10 harness
 * only gets there by shelling out to ffmpeg before every run, and there is no
 * ffmpeg on a phone, so the recorder has to arrive in that shape by itself.
 *
 * Recording straight into it is the better default anyway: the model gains
 * nothing from 44.1 kHz stereo, and a minute of speech drops from megabytes to
 * roughly two.
 */
export const SPEECH_RECORDING_OPTIONS: RecordingOptions = {
  /*
   * Belongs here rather than at `prepareToRecordAsync`, and that is not a
   * style choice: expo-audio runs whatever is passed there through
   * `createRecordingOptions`, so a partial object replaces this whole record
   * and the recorder silently falls back to native defaults — 8 kHz in a CAF
   * container, which whisper rejects outright.
   *
   * Silence auto-stop reads the metering level, so without this the take never
   * ends by itself.
   */
  isMeteringEnabled: true,
  extension: '.wav',
  sampleRate: 16_000,
  numberOfChannels: 1,
  // Linear PCM carries no compression, so the rate follows from the format:
  // 16 kHz x 16 bits x 1 channel.
  bitRate: 256_000,
  ios: {
    // Uncompressed, which is what makes the file a plain WAV the model can read.
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    /*
     * Android's MediaRecorder cannot write WAV at all — its encoders are AAC
     * and AMR. So Android lands on 16 kHz mono AAC and will need a decode step
     * before the model, while iOS hands the file over untouched. The sample
     * rate and channel count above still apply, which is the half that matters
     * most; only the container differs.
     */
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128_000,
  },
};
