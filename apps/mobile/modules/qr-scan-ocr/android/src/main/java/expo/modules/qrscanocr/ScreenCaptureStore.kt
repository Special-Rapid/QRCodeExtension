package expo.modules.qrscanocr

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import java.io.File
import java.util.UUID

object ScreenCaptureStore {
  private const val directoryName = "screen-captures"
  private const val maxAgeMillis = 5 * 60 * 1000L
  private val tokenPattern = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

  fun write(context: Context, bitmap: Bitmap): String? {
    val directory = File(context.cacheDir, directoryName).apply { mkdirs() }
    cleanupExpired(directory)
    val token = UUID.randomUUID().toString()
    val destination = File(directory, "$token.png")
    return try {
      destination.outputStream().use { output ->
        if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) throw IllegalStateException("Unable to store the screen capture")
      }
      token
    } catch (_: Exception) {
      destination.delete()
      null
    }
  }

  fun consume(context: Context, token: String): Uri? {
    if (!tokenPattern.matches(token)) return null
    val directory = File(context.cacheDir, directoryName)
    cleanupExpired(directory)
    val file = File(directory, "$token.png")
    return file.takeIf { it.isFile }?.let(Uri::fromFile)
  }

  fun delete(context: Context, token: String): Boolean {
    if (!tokenPattern.matches(token)) return false
    val directory = File(context.cacheDir, directoryName)
    cleanupExpired(directory)
    return File(directory, "$token.png").delete()
  }

  private fun cleanupExpired(directory: File) {
    val cutoff = System.currentTimeMillis() - maxAgeMillis
    directory.listFiles()?.filter { it.lastModified() < cutoff }?.forEach { it.delete() }
  }
}
