package com.snkisk.qrscan

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/** Opens the existing QR Scan camera flow from Android Quick Settings. */
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
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("qrscan://scan?entry=quick-settings")).apply {
      setPackage(packageName)
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
