import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("declares a camera-free Manifest V3 extension with only handoff permissions", async () => {
  const manifest = JSON.parse(await readFile("src/manifest.json", "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "alarms", "notifications", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["https://qr.snkisk.com/*"]);
  assert.equal(manifest.background.service_worker, "handoff-background.js");
  assert.equal(manifest.options_ui.page, "options.html");
  assert.equal(manifest.icons[128], "icon-128.png");
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.equal(JSON.stringify(manifest).includes("camera"), false);
});
