package expo.modules.qrscanocr

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.util.Locale

class ScreenCaptureService : Service() {
  companion object {
    private const val notificationChannelId = "qr_scan_screen_capture"
    private const val notificationId = 9202

    fun openScanner(context: Context, token: String? = null, error: String? = null) {
      val builder = Uri.Builder().scheme("qrscan").authority("share-image")
      token?.let { builder.appendQueryParameter("token", it) }
      error?.let { builder.appendQueryParameter("captureError", it) }
      context.startActivity(Intent(Intent.ACTION_VIEW, builder.build()).apply {
        setPackage(context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      })
    }
  }

  private val workerThread = HandlerThread("QRScanScreenCapture")
  private lateinit var worker: Handler
  private var projection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var imageReader: ImageReader? = null
  private var completed = false
  private val timeout = Runnable { finishCapture(error = "timeout") }

  override fun onCreate() {
    super.onCreate()
    workerThread.start()
    worker = Handler(workerThread.looper)
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(notificationId, captureNotification())
    val resultCode = intent?.getIntExtra(ScreenCaptureActivity.resultCodeExtra, Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED
    val resultData = intent?.let(::projectionData)
    if (resultCode != Activity.RESULT_OK || resultData == null) {
      finishCapture(error = "unavailable")
      return START_NOT_STICKY
    }
    beginCapture(resultCode, resultData)
    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun beginCapture(resultCode: Int, resultData: Intent) {
    try {
      val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      projection = manager.getMediaProjection(resultCode, resultData)
      projection?.registerCallback(object : MediaProjection.Callback() {
        override fun onStop() {
          if (!completed) finishCapture(error = "stopped")
        }
      }, worker)
      val metrics = resources.displayMetrics
      val width = metrics.widthPixels.coerceAtLeast(1)
      val height = metrics.heightPixels.coerceAtLeast(1)
      imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
      imageReader?.setOnImageAvailableListener({ reader -> captureImage(reader, width, height) }, worker)
      virtualDisplay = projection?.createVirtualDisplay(
        "QR Scan one-time capture",
        width,
        height,
        metrics.densityDpi,
        DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
        imageReader?.surface,
        null,
        worker
      )
      worker.postDelayed(timeout, 4_000)
    } catch (_: Exception) {
      finishCapture(error = "unavailable")
    }
  }

  private fun captureImage(reader: ImageReader, width: Int, height: Int) {
    if (completed) return
    val image = reader.acquireLatestImage() ?: return
    try {
      completed = true
      worker.removeCallbacks(timeout)
      val token = ScreenCaptureStore.write(this, bitmapFrom(image, width, height))
      finishCapture(token = token, error = if (token == null) "store" else null)
    } catch (_: Exception) {
      finishCapture(error = "capture")
    } finally {
      image.close()
    }
  }

  private fun bitmapFrom(image: Image, width: Int, height: Int): Bitmap {
    val plane = image.planes.first()
    val pixelStride = plane.pixelStride
    val rowPadding = plane.rowStride - pixelStride * width
    val paddedWidth = width + rowPadding / pixelStride
    val padded = Bitmap.createBitmap(paddedWidth, height, Bitmap.Config.ARGB_8888)
    padded.copyPixelsFromBuffer(plane.buffer)
    return Bitmap.createBitmap(padded, 0, 0, width, height)
  }

  private fun finishCapture(token: String? = null, error: String? = null) {
    if (!completed && token == null) completed = true
    worker.removeCallbacks(timeout)
    imageReader?.setOnImageAvailableListener(null, null)
    imageReader?.close()
    imageReader = null
    virtualDisplay?.release()
    virtualDisplay = null
    projection?.stop()
    projection = null
    openScanner(this, token, error)
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(NotificationChannel(notificationChannelId, "QR Scan", NotificationManager.IMPORTANCE_LOW))
    }
  }

  private fun captureNotification(): Notification = NotificationCompat.Builder(this, notificationChannelId)
    .setSmallIcon(android.R.drawable.ic_menu_view)
    .setContentTitle(applicationInfo.loadLabel(packageManager))
    .setContentText(if (Locale.getDefault().language == "ja") "画面を1枚だけ読み取っています" else "Reading one screen on this device")
    .setOngoing(true)
    .build()

  @Suppress("DEPRECATION")
  private fun projectionData(intent: Intent): Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    intent.getParcelableExtra(ScreenCaptureActivity.resultDataExtra, Intent::class.java)
  } else {
    intent.getParcelableExtra(ScreenCaptureActivity.resultDataExtra)
  }

  override fun onDestroy() {
    workerThread.quitSafely()
    super.onDestroy()
  }
}
