package expo.modules.qrscanocr

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class QrScanOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QrScanOcr")

    AsyncFunction("recognizeUrlText") { uriString: String, promise: Promise ->
      try {
        val bitmap = loadUprightBitmap(Uri.parse(uriString))
        val image = InputImage.fromBitmap(bitmap, 0)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        recognizer.process(image)
          .addOnSuccessListener { result ->
            val lines = result.textBlocks.flatMap { block -> block.lines }.mapNotNull { line ->
              line.boundingBox?.let { box ->
                mapOf(
                  "text" to line.text,
                  "x" to box.left,
                  "y" to box.top,
                  "width" to box.width(),
                  "height" to box.height()
                )
              }
            }
            recognizer.close()
            promise.resolve(mapOf(
              "blocks" to lines,
              "width" to image.width,
              "height" to image.height,
            ))
          }
          .addOnFailureListener { error ->
            recognizer.close()
            promise.reject("OCR_RECOGNITION_FAILED", error.message ?: "Text recognition failed.", error)
          }
      } catch (error: Exception) {
        promise.reject("OCR_IMAGE_UNAVAILABLE", error.message ?: "The captured image could not be read.", error)
      }
    }

    AsyncFunction("recognizeSharedImage") { uriString: String, promise: Promise ->
      try {
        val bitmap = loadUprightBitmap(Uri.parse(uriString))
        val image = InputImage.fromBitmap(bitmap, 0)
        val textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val barcodeScanner = BarcodeScanning.getClient()
        val textTask = textRecognizer.process(image)
        val barcodeTask = barcodeScanner.process(image)
        Tasks.whenAllComplete(textTask, barcodeTask)
          .addOnCompleteListener {
            try {
              // Task.result throws for a failed recognizer. Keep the other recognizer's
              // successful result available, and always settle the JS promise.
              val textResult = if (textTask.isSuccessful) textTask.result else null
              val barcodeResult = if (barcodeTask.isSuccessful) barcodeTask.result else null
              if (textResult == null && barcodeResult == null) {
                val error = textTask.exception ?: barcodeTask.exception
                promise.reject("SHARED_IMAGE_RECOGNITION_FAILED", error?.message ?: "The shared image could not be recognized.", error)
                return@addOnCompleteListener
              }
              val blocks = textResult?.textBlocks?.flatMap { block -> block.lines }?.mapNotNull { line ->
                line.boundingBox?.let { box ->
                  mapOf("text" to line.text, "x" to box.left, "y" to box.top, "width" to box.width(), "height" to box.height())
                }
              } ?: emptyList()
              val barcodes = barcodeResult?.mapNotNull { barcode ->
                val value = barcode.rawValue ?: return@mapNotNull null
                barcode.boundingBox?.let { box ->
                  mapOf(
                    "data" to value,
                    "type" to (barcode.format.toString()),
                    "bounds" to mapOf("origin" to mapOf("x" to box.left, "y" to box.top), "size" to mapOf("width" to box.width(), "height" to box.height()))
                  )
                }
              } ?: emptyList()
              promise.resolve(mapOf("blocks" to blocks, "barcodes" to barcodes, "width" to image.width, "height" to image.height))
            } catch (error: Exception) {
              promise.reject("SHARED_IMAGE_RECOGNITION_FAILED", error.message ?: "The shared image could not be recognized.", error)
            } finally {
              textRecognizer.close()
              barcodeScanner.close()
            }
          }
      } catch (error: Exception) {
        promise.reject("SHARED_IMAGE_UNAVAILABLE", error.message ?: "The shared image could not be read.", error)
      }
    }

    AsyncFunction("consumeSharedImage") { token: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("The app context is unavailable")
      ScreenCaptureStore.consume(context, token)?.toString()
        ?: throw IllegalArgumentException("The shared image is unavailable or has expired")
    }

    AsyncFunction("deleteSharedImage") { token: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("The app context is unavailable")
      ScreenCaptureStore.delete(context, token)
    }

  }

  private fun loadUprightBitmap(uri: Uri): Bitmap {
    val path = uri.path ?: throw IllegalArgumentException("The captured image path is unavailable")
    val source = BitmapFactory.decodeFile(path) ?: throw IllegalArgumentException("The captured image could not be read")
    val orientation = ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.setScale(-1f, 1f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.setRotate(180f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.setScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        matrix.setRotate(90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.setRotate(90f)
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        matrix.setRotate(-90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.setRotate(-90f)
    }
    return if (matrix.isIdentity) source else Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
  }
}
