import UniformTypeIdentifiers
import UIKit

final class ShareViewController: UIViewController {
  private let appGroup = "group.com.snkisk.qrscan"
  private let directoryName = "shared-images"
  private let statusLabel = UILabel()
  private let spinner = UIActivityIndicatorView(style: .medium)

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    statusLabel.text = localized("画像を読み取り用に準備しています…", "Preparing the image for scanning…")
    statusLabel.numberOfLines = 0
    statusLabel.textAlignment = .center
    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    spinner.translatesAutoresizingMaskIntoConstraints = false
    spinner.startAnimating()
    view.addSubview(statusLabel)
    view.addSubview(spinner)
    NSLayoutConstraint.activate([
      spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -18),
      statusLabel.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 14),
      statusLabel.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
      statusLabel.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor)
    ])
    receiveImage()
  }

  private func receiveImage() {
    guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
          let provider = item.attachments?.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.image.identifier) }) else {
      finish(with: localized("画像を共有してから、もう一度試してください。", "Share an image and try again."))
      return
    }
    provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { [weak self] url, error in
      guard let self else { return }
      guard let url, error == nil else {
        self.finish(with: self.localized("画像を受け取れませんでした。もう一度試してください。", "The image could not be received. Try again."))
        return
      }
      do {
        let token = try self.copyIntoSharedContainer(from: url)
        let route = URL(string: "qrscan://share-image?token=\(token)")!
        self.extensionContext?.open(route, completionHandler: { _ in
          self.extensionContext?.completeRequest(returningItems: nil)
        })
      } catch {
        self.finish(with: self.localized("画像を準備できませんでした。もう一度試してください。", "The image could not be prepared. Try again."))
      }
    }
  }

  private func copyIntoSharedContainer(from source: URL) throws -> String {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
      throw CocoaError(.fileNoSuchFile)
    }
    let directory = container.appendingPathComponent(directoryName, isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let token = UUID().uuidString.lowercased()
    let destination = directory.appendingPathComponent("\(token).image", isDirectory: false)
    try FileManager.default.copyItem(at: source, to: destination)
    return token
  }

  private func finish(with message: String) {
    DispatchQueue.main.async {
      self.spinner.stopAnimating()
      self.statusLabel.text = message
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
        self.extensionContext?.cancelRequest(withError: NSError(domain: "QRScanShare", code: 1, userInfo: [NSLocalizedDescriptionKey: message]))
      }
    }
  }

  private func localized(_ japanese: String, _ english: String) -> String {
    Locale.current.language.languageCode?.identifier == "ja" ? japanese : english
  }
}
