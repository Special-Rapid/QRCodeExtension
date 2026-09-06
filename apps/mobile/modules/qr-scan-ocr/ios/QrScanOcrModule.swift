import ExpoModulesCore
import ImageIO
import UIKit
import Vision

private let sharedImageAppGroup = "group.com.snkisk.qrscan"
private let sharedImageDirectory = "shared-images"
private let sharedImageMaximumAge: TimeInterval = 5 * 60

public class QrScanOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QrScanOcr")

    AsyncFunction("recognizeUrlText") { (uri: String) -> [String: Any] in
      guard let url = URL(string: uri), url.isFileURL,
            let image = UIImage(contentsOfFile: url.path),
            let cgImage = image.cgImage else {
        throw Exception(name: "OCR_IMAGE_UNAVAILABLE", description: "The captured image could not be read on this device.")
      }

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = false
      request.recognitionLanguages = ["en_US"]

      let orientation = visionOrientation(from: image.imageOrientation)
      let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
      try handler.perform([request])

      let isQuarterTurn = orientation == .left || orientation == .leftMirrored || orientation == .right || orientation == .rightMirrored
      let width = CGFloat(isQuarterTurn ? cgImage.height : cgImage.width)
      let height = CGFloat(isQuarterTurn ? cgImage.width : cgImage.height)
      let blocks: [[String: Any]] = (request.results ?? []).compactMap { observation -> [String: Any]? in
        guard let recognized = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        return [
          "text": recognized.string,
          "x": box.origin.x * width,
          "y": (1 - box.origin.y - box.height) * height,
          "width": box.width * width,
          "height": box.height * height
        ]
      }
      return [
        "blocks": blocks,
        "width": width,
        "height": height
      ]
    }

    AsyncFunction("recognizeSharedImage") { (uri: String) -> [String: Any] in
      guard let url = URL(string: uri), url.isFileURL,
            let image = UIImage(contentsOfFile: url.path),
            let cgImage = image.cgImage else {
        throw Exception(name: "SHARED_IMAGE_UNAVAILABLE", description: "The shared image could not be read on this device.")
      }

      let textRequest = VNRecognizeTextRequest()
      textRequest.recognitionLevel = .accurate
      textRequest.usesLanguageCorrection = false
      textRequest.recognitionLanguages = ["en_US"]
      let barcodeRequest = VNDetectBarcodesRequest()
      let orientation = visionOrientation(from: image.imageOrientation)
      let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
      try handler.perform([textRequest, barcodeRequest])

      let isQuarterTurn = orientation == .left || orientation == .leftMirrored || orientation == .right || orientation == .rightMirrored
      let width = CGFloat(isQuarterTurn ? cgImage.height : cgImage.width)
      let height = CGFloat(isQuarterTurn ? cgImage.width : cgImage.height)
      let blocks: [[String: Any]] = (textRequest.results ?? []).compactMap { observation -> [String: Any]? in
        guard let recognized = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        return [
          "text": recognized.string,
          "x": box.origin.x * width,
          "y": (1 - box.origin.y - box.height) * height,
          "width": box.width * width,
          "height": box.height * height
        ]
      }
      let barcodes: [[String: Any]] = (barcodeRequest.results ?? []).compactMap { observation -> [String: Any]? in
        guard let value = observation.payloadStringValue else { return nil }
        let box = observation.boundingBox
        return [
          "data": value,
          "type": observation.symbology.rawValue,
          "bounds": [
            "origin": ["x": box.origin.x * width, "y": (1 - box.origin.y - box.height) * height],
            "size": ["width": box.width * width, "height": box.height * height]
          ]
        ]
      }
      return ["blocks": blocks, "barcodes": barcodes, "width": width, "height": height]
    }

    AsyncFunction("consumeSharedImage") { (token: String) -> String in
      guard let url = sharedImageURL(for: token), FileManager.default.fileExists(atPath: url.path) else {
        throw Exception(name: "SHARED_IMAGE_EXPIRED", description: "The shared image is unavailable or has expired.")
      }
      return url.absoluteString
    }

    AsyncFunction("deleteSharedImage") { (token: String) -> Bool in
      guard let url = sharedImageURL(for: token) else { return false }
      do {
        try FileManager.default.removeItem(at: url)
        return true
      } catch {
        return false
      }
    }

  }
}

private func sharedImageURL(for token: String) -> URL? {
  guard token.range(of: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", options: .regularExpression) != nil,
        let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: sharedImageAppGroup) else {
    return nil
  }
  let directory = container.appendingPathComponent(sharedImageDirectory, isDirectory: true)
  cleanupExpiredSharedImages(in: directory)
  return directory.appendingPathComponent("\(token).image", isDirectory: false)
}

private func cleanupExpiredSharedImages(in directory: URL) {
  guard let entries = try? FileManager.default.contentsOfDirectory(
    at: directory,
    includingPropertiesForKeys: [.contentModificationDateKey],
    options: [.skipsHiddenFiles]
  ) else { return }
  let cutoff = Date().addingTimeInterval(-sharedImageMaximumAge)
  for entry in entries {
    guard let values = try? entry.resourceValues(forKeys: [.contentModificationDateKey]),
          let modified = values.contentModificationDate,
          modified < cutoff else { continue }
    try? FileManager.default.removeItem(at: entry)
  }
}

private func visionOrientation(from orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
  switch orientation {
  case .up: return .up
  case .upMirrored: return .upMirrored
  case .down: return .down
  case .downMirrored: return .downMirrored
  case .left: return .left
  case .leftMirrored: return .leftMirrored
  case .right: return .right
  case .rightMirrored: return .rightMirrored
  @unknown default: return .up
  }
}
