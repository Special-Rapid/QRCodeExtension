import SwiftUI
import WidgetKit

@available(iOS 18.0, *)
struct QRScanControl: ControlWidget {
  static let kind = "com.snkisk.qrscan.open-scanner"

  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind) {
      ControlWidgetButton(action: OpenQRScanIntent()) {
        Label("open_scanner", systemImage: "qrcode.viewfinder")
      }
    }
    .displayName("QR Scan")
    .description("open_scanner_description")
  }
}

@main
struct QRScanControlsBundle: WidgetBundle {
  var body: some Widget {
    QRScanControl()
  }
}
