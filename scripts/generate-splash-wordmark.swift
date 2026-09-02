// Renders the splash wordmark ("Vidlun", Unbounded Medium 34pt, -0.03em) as
// transparent PNGs at 1x/2x/3x in both inks. The same pixels are shown by the
// native launch storyboard, the font-loading gate, and the JS splash overlay,
// which is what makes the launch read as one screen instead of three.
//
// Run from the repo root:  swift scripts/generate-splash-wordmark.swift
// Writes assets/splash/*.png; copy into the iOS imageset afterwards (the
// build script does both — see scripts/generate-splash-assets.sh).
import AppKit
import CoreText
import Foundation

let fontPath = "node_modules/@expo-google-fonts/unbounded/500Medium/Unbounded_500Medium.ttf"
let outDir = "assets/splash"
let fontSize: CGFloat = 34
// The design sets letter-spacing -0.03em on the wordmark.
let kern: CGFloat = fontSize * -0.03
// A touch of headroom so antialiased edges never clip.
let pad: CGFloat = 2

guard let provider = CGDataProvider(filename: fontPath),
      let cgFont = CGFont(provider),
      CTFontManagerRegisterGraphicsFont(cgFont, nil)
else {
    fatalError("Could not register \(fontPath)")
}

let font = CTFontCreateWithGraphicsFont(cgFont, fontSize, nil, nil)

func render(text: String, hex: UInt32, scale: CGFloat, to path: String) {
    let color = CGColor(
        red: CGFloat((hex >> 16) & 0xff) / 255,
        green: CGFloat((hex >> 8) & 0xff) / 255,
        blue: CGFloat(hex & 0xff) / 255,
        alpha: 1
    )
    let attributes: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTKernAttributeName as String): kern,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
    ]
    let line = CTLineCreateWithAttributedString(
        NSAttributedString(string: text, attributes: attributes)
    )
    var ascent: CGFloat = 0
    var descent: CGFloat = 0
    // The trailing kern hangs past the last glyph; trim it from the width.
    let width = CGFloat(CTLineGetTypographicBounds(line, &ascent, &descent, nil)) - kern
    let size = CGSize(width: ceil(width) + pad * 2, height: ceil(ascent + descent) + pad * 2)

    let pixelWidth = Int(size.width * scale)
    let pixelHeight = Int(size.height * scale)
    guard let context = CGContext(
        data: nil,
        width: pixelWidth,
        height: pixelHeight,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        fatalError("Could not open a bitmap context")
    }

    context.scaleBy(x: scale, y: scale)
    context.textPosition = CGPoint(x: pad, y: descent + pad)
    CTLineDraw(line, context)

    guard let image = context.makeImage() else { fatalError("Could not rasterise") }

    let url = URL(fileURLWithPath: path)
    guard let sink = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil)
    else {
        fatalError("Could not open \(path)")
    }
    CGImageDestinationAddImage(sink, image, nil)
    CGImageDestinationFinalize(sink)
    print("\(path)  \(pixelWidth)x\(pixelHeight)  (point size \(size.width)x\(size.height))")
}

try FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

// Ink on the cream canvas, and the dark theme's ink on its own canvas.
let inks: [(String, UInt32)] = [("light", 0x16181D), ("dark", 0xF2EEE6)]

for (name, hex) in inks {
    for scale in [1, 2, 3] {
        let suffix = scale == 1 ? "" : "@\(scale)x"
        render(
            text: "Vidlun",
            hex: hex,
            scale: CGFloat(scale),
            to: "\(outDir)/wordmark-\(name)\(suffix).png"
        )
    }
}
