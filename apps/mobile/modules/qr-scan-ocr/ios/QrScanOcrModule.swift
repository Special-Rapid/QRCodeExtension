import ExpoModulesCore
import ImageIO
import UIKit
import Vision

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
