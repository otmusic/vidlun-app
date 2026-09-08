import AppIntents
import SwiftUI
import WidgetKit

/*
 * The drawing's widgets, one per place: the circle for the Lock Screen and
 * the Control Center, the rectangle for the Lock Screen, the small tile for
 * the Home Screen. Every one of them is a way into a take without opening
 * the app first; none of them shows a streak, because a widget that says
 * nought reads as a reproach.
 */
@main
struct VidlunWidgets: WidgetBundle {
  var body: some Widget {
    RecordWidget()
    RecordControl()
  }
}

/// The copy the widgets need, in the phone's language. Two strings; the
/// app's own dictionary is out of reach from an extension.
enum Copy {
  static var isUkrainian: Bool {
    Locale.preferredLanguages.first?.hasPrefix("uk") ?? false
  }

  static var record: String { isUkrainian ? "Записати" : "Record" }
  static var question: String { isUkrainian ? "Що було сьогодні?" : "How was today?" }
}

/// Nothing changes with time here; the widget is a button, not a display.
struct Still: TimelineEntry {
  let date: Date
}

struct StillProvider: TimelineProvider {
  func placeholder(in context: Context) -> Still { Still(date: .now) }

  func getSnapshot(in context: Context, completion: @escaping (Still) -> Void) {
    completion(Still(date: .now))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Still>) -> Void) {
    completion(Timeline(entries: [Still(date: .now)], policy: .never))
  }
}

struct RecordWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "com.vidlun.journal.widget.record", provider: StillProvider()) { _ in
      RecordView()
    }
    .configurationDisplayName("Record in Vidlun")
    .description("Opens Vidlun ready to record an entry.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .systemSmall])
    .contentMarginsDisabled()
  }
}

/// The Control Center button. The intent it runs is the shared one, so
/// pressing it here is the same as asking Siri.
struct RecordControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "com.vidlun.journal.widget.control") {
      ControlWidgetButton(action: RecordIntent()) {
        Label(Copy.record, systemImage: "mic.fill")
      }
    }
    .displayName("Record in Vidlun")
    .description("Opens Vidlun ready to record an entry.")
  }
}

struct RecordView: View {
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    content.widgetURL(URL(string: "vidlun://record"))
  }

  @ViewBuilder private var content: some View {
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        MicGlyph(color: .primary, lineWidth: 2.6).frame(width: 22, height: 27)
      }
      .widgetAccentable()
      .containerBackground(for: .widget) { Color.clear }

    case .accessoryRectangular:
      HStack(spacing: 12) {
        ZStack {
          Circle().fill(.primary.opacity(0.18))
          MicGlyph(color: .primary, lineWidth: 2.6).frame(width: 16, height: 20)
        }
        .frame(width: 38, height: 38)
        .widgetAccentable()
        VStack(alignment: .leading, spacing: 2) {
          Text(Copy.record).font(.system(size: 15, weight: .medium))
          Text("Vidlun").font(.system(size: 12.5)).opacity(0.7)
        }
        Spacer(minLength: 0)
      }
      .containerBackground(for: .widget) { Color.clear }

    default:
      VStack(alignment: .leading, spacing: 0) {
        Text(Copy.question)
          .font(.custom("Unbounded-Medium", size: 11.5))
          .lineSpacing(2)
          .foregroundStyle(Color("ink"))
        Spacer(minLength: 0)
        HStack(alignment: .bottom) {
          WaveMark(ink: Color("ink"), echo: scheme == .dark ? Color("lime") : Color.accentColor)
            .frame(width: 34, height: 19)
          Spacer(minLength: 0)
          ZStack {
            Circle().fill(Color("solid"))
            MicGlyph(color: Color("onSolid"), lineWidth: 2.8).frame(width: 12, height: 15)
          }
          .frame(width: 30, height: 30)
          .widgetAccentable()
        }
      }
      .padding(13)
      .containerBackground(for: .widget) { Color("canvas") }
    }
  }
}

/// The microphone from the drawing's 28x34 box: a capsule, the cup, the stem.
struct MicGlyph: View {
  let color: Color
  let lineWidth: CGFloat

  var body: some View {
    GeometryReader { geo in
      let sx = geo.size.width / 28
      let sy = geo.size.height / 34
      Path { path in
        path.addRoundedRect(in: CGRect(x: 9 * sx, y: 2 * sy, width: 10 * sx, height: 15 * sy), cornerSize: CGSize(width: 5 * sx, height: 5 * sy))
        path.move(to: CGPoint(x: 4.5 * sx, y: 15.5 * sy))
        path.addArc(center: CGPoint(x: 14 * sx, y: 15.5 * sy), radius: 9.5 * sx, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: true)
        path.move(to: CGPoint(x: 14 * sx, y: 25 * sy))
        path.addLine(to: CGPoint(x: 14 * sx, y: 31 * sy))
        path.move(to: CGPoint(x: 9 * sx, y: 31.5 * sy))
        path.addLine(to: CGPoint(x: 19 * sx, y: 31.5 * sy))
      }
      .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round))
    }
  }
}

/// The wave mark with its two echoes, from the identity's 58x32 drawing.
struct WaveMark: View {
  let ink: Color
  let echo: Color

  var body: some View {
    GeometryReader { geo in
      let sx = geo.size.width / 58
      let sy = geo.size.height / 32
      ZStack(alignment: .topLeading) {
        MarkShape().fill(ink)
        Circle().fill(echo).frame(width: 4.8 * sx, height: 4.8 * sy).position(x: 42 * sx, y: 16 * sy)
        Circle().fill(echo.opacity(0.6)).frame(width: 3 * sx, height: 3 * sy).position(x: 48.6 * sx, y: 16 * sy)
      }
    }
  }
}

struct MarkShape: Shape {
  /// The drawing's own path, made only of straight segments.
  private static let path = "M6.61 16.75L6.93 15.29L7.24 13.91L7.55 12.63L7.85 11.47L8.14 10.46L8.41 9.63L8.64 9.01L8.81 8.64L8.82 8.57L8.49 8.81L7.60 9.10L6.53 8.96L5.99 8.63L5.92 8.53L6.07 8.72L6.33 9.15L6.63 9.77L6.96 10.55L7.31 11.44L7.66 12.43L8.02 13.48L8.39 14.57L8.76 15.69L9.13 16.81L9.51 17.91L9.90 18.97L10.29 19.99L10.69 20.95L11.10 21.84L11.54 22.67L12.03 23.43L12.59 24.13L13.30 24.77L14.24 25.28L15.40 25.51L16.56 25.34L17.48 24.87L18.17 24.29L18.70 23.66L19.15 23.00L19.55 22.31L19.92 21.57L20.27 20.81L20.61 20.02L20.95 19.22L21.27 18.42L21.60 17.63L21.91 16.87L22.22 16.14L22.52 15.47L22.82 14.85L23.10 14.32L23.36 13.87L23.59 13.53L23.77 13.28L23.90 13.14L23.94 13.09L23.88 13.08L23.78 13.07L23.71 13.04L23.73 13.02L23.85 13.06L24.04 13.19L24.30 13.40L24.58 13.68L24.90 14.03L25.23 14.44L25.58 14.89L25.93 15.37L26.29 15.87L26.66 16.38L27.04 16.88L27.42 17.38L27.81 17.86L28.22 18.32L28.63 18.75L29.06 19.15L29.51 19.50L29.99 19.81L30.49 20.05L31.02 20.24L31.56 20.34L32.11 20.36L32.64 20.30L33.15 20.16L33.62 19.97L34.07 19.74L34.48 19.46L34.88 19.17L35.26 18.85L35.62 18.51L35.98 18.16L36.32 17.81L36.67 17.45L37.00 17.10L37.34 16.75L35.86 15.25L35.51 15.58L35.15 15.91L34.80 16.22L34.46 16.52L34.12 16.80L33.79 17.05L33.48 17.27L33.18 17.45L32.91 17.59L32.66 17.69L32.44 17.75L32.26 17.77L32.10 17.76L31.96 17.73L31.81 17.67L31.64 17.58L31.45 17.45L31.24 17.28L31.00 17.04L30.74 16.75L30.46 16.41L30.17 16.02L29.87 15.59L29.56 15.12L29.25 14.62L28.92 14.10L28.59 13.57L28.26 13.04L27.91 12.50L27.55 11.98L27.17 11.48L26.77 11.00L26.33 10.55L25.83 10.14L25.26 9.78L24.59 9.52L23.82 9.39L23.03 9.46L22.29 9.70L21.64 10.07L21.07 10.52L20.56 11.04L20.10 11.62L19.67 12.24L19.26 12.91L18.86 13.62L18.47 14.36L18.09 15.13L17.71 15.91L17.34 16.69L16.98 17.46L16.62 18.19L16.27 18.88L15.93 19.51L15.61 20.05L15.32 20.48L15.07 20.78L14.91 20.92L14.91 20.90L15.14 20.77L15.61 20.68L16.08 20.76L16.32 20.87L16.34 20.84L16.21 20.63L16.01 20.24L15.75 19.68L15.48 18.99L15.19 18.17L14.89 17.25L14.58 16.25L14.27 15.19L13.95 14.09L13.63 12.96L13.30 11.82L12.97 10.70L12.63 9.61L12.29 8.57L11.93 7.57L11.54 6.64L11.10 5.77L10.56 4.92L9.80 4.08L8.57 3.34L6.81 3.12L5.22 3.67L4.20 4.53L3.52 5.42L3.00 6.35L2.54 7.36L2.12 8.46L1.72 9.66L1.33 10.95L0.94 12.32L0.56 13.77L0.19 15.25Z"

  private static let points: [CGPoint] = {
    var points: [CGPoint] = []
    let scanner = Scanner(string: path)
    scanner.charactersToBeSkipped = CharacterSet(charactersIn: "MLZ ,")

    while !scanner.isAtEnd {
      guard let x = scanner.scanDouble(), let y = scanner.scanDouble() else { break }
      points.append(CGPoint(x: x, y: y))
    }

    return points
  }()

  func path(in rect: CGRect) -> Path {
    var path = Path()
    let sx = rect.width / 58
    let sy = rect.height / 32

    for (index, point) in Self.points.enumerated() {
      let scaled = CGPoint(x: rect.minX + point.x * sx, y: rect.minY + point.y * sy)

      if index == 0 {
        path.move(to: scaled)
      } else {
        path.addLine(to: scaled)
      }
    }

    path.closeSubpath()

    return path
  }
}
