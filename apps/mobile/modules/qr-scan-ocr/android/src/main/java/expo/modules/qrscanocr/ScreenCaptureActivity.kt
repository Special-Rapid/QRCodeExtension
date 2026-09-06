package expo.modules.qrscanocr

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import androidx.core.content.ContextCompat

class ScreenCaptureActivity : Activity() {
  companion object {
    const val resultCodeExtra = "screen_capture_result_code"
    const val resultDataExtra = "screen_capture_result_data"
    private const val projectionRequestCode = 9201
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    startActivityForResult(manager.createScreenCaptureIntent(), projectionRequestCode)
  }

  @Deprecated("Deprecated in Java")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != projectionRequestCode) return
    if (resultCode != RESULT_OK || data == null) {
      ScreenCaptureService.openScanner(this, error = "cancelled")
      finish()
      return
    }
    val service = Intent(this, ScreenCaptureService::class.java).apply {
      putExtra(resultCodeExtra, resultCode)
      putExtra(resultDataExtra, data)
    }
    ContextCompat.startForegroundService(this, service)
    // Stay transparent until the first frame is captured so the Quick Settings entry
    // preserves the app that was visible behind the system consent prompt.
  }
}
