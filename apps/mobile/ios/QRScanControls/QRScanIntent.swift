import AppIntents

@available(iOS 18.0, *)
struct OpenQRScanIntent: AppIntent {
  static var title: LocalizedStringResource = "open_scanner"
  static var description = IntentDescription("open_scanner_description")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(URL(string: "qrscan://scan?entry=control-center")!))
  }
}

@available(iOS 18.0, *)
struct QRScanAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: OpenQRScanIntent(),
      phrases: [
        "\(.applicationName)でスキャンを開く",
        "Open scan in \(.applicationName)"
      ],
      shortTitle: "open_scanner",
      systemImageName: "qrcode.viewfinder"
    )
  }
}
