package expo.modules.qrscanocr

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
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
    showReadingState()
    val service = Intent(this, ScreenCaptureService::class.java).apply {
      putExtra(resultCodeExtra, resultCode)
      putExtra(resultDataExtra, data)
    }
    ContextCompat.startForegroundService(this, service)
    // This owned, temporary state appears only after the operating-system consent. The
    // capture service still reads one frame, then returns to the scanner result flow.
  }

  private fun showReadingState() {
    val inset = (28 * resources.displayMetrics.density).toInt()
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(inset, inset, inset, inset)
      setBackgroundColor(getColor(R.color.quick_settings_reading_background))
    }
    root.addView(ProgressBar(this).apply { isIndeterminate = true })
    root.addView(TextView(this).apply {
      text = getString(R.string.quick_settings_reading_title)
      setTextColor(getColor(R.color.quick_settings_reading_title))
      textSize = 20f
      gravity = Gravity.CENTER
      setPadding(0, inset, 0, 8)
    })
    root.addView(TextView(this).apply {
      text = getString(R.string.quick_settings_reading_body)
      setTextColor(getColor(R.color.quick_settings_reading_body))
      textSize = 14f
      gravity = Gravity.CENTER
    })
    setContentView(root)
  }
}
