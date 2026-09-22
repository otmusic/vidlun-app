import AppKit
import WebKit

// Renders an SVG or HTML file to a PNG at exactly the given size, through WebKit.
let args = CommandLine.arguments
let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])
let width = Double(args[3]) ?? 1200
let height = Double(args[4]) ?? 630

let app = NSApplication.shared
let web = WKWebView(frame: NSRect(x: 0, y: 0, width: width, height: height))

final class Delegate: NSObject, WKNavigationDelegate {
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
      let config = WKSnapshotConfiguration()
      config.rect = NSRect(x: 0, y: 0, width: width, height: height)
      webView.takeSnapshot(with: config) { image, error in
        guard let image = image, let tiff = image.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff),
              let png = rep.representation(using: .png, properties: [:]) else {
          FileHandle.standardError.write("snapshot failed: \(String(describing: error))\n".data(using: .utf8)!)
          exit(1)
        }
        try! png.write(to: output)
        print("wrote \(output.path) \(rep.pixelsWide)x\(rep.pixelsHigh)")
        exit(0)
      }
    }
  }
}

let delegate = Delegate()
web.navigationDelegate = delegate
web.loadFileURL(input, allowingReadAccessTo: input.deletingLastPathComponent())
app.run()
