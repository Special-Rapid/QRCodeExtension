package com.snkisk.qrscan

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/** Starts a user-approved, one-frame Android screen capture from Quick Settings. */
class ScanTileService : TileService() {
  override fun onStartListening() {
    super.onStartListening()
    qsTile?.apply {
      state = Tile.STATE_INACTIVE
      contentDescription = getString(R.string.quick_settings_scan_description)
      updateTile()
    }
  }

  override fun onClick() {
    super.onClick()
    if (isLocked && isSecure) {
      unlockAndRun { openScanner() }
    } else {
      openScanner()
    }
  }

  private fun openScanner() {
    val intent = Intent(this, expo.modules.qrscanocr.ScreenCaptureActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      startActivityAndCollapse(pendingIntent)
    } else {
      startActivityAndCollapse(intent)
    }
  }
}
