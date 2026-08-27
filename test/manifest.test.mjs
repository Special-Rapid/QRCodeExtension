import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("declares a camera-free Manifest V3 extension with a Chrome 121+ fast connector", async () => {
  const manifest = JSON.parse(await readFile("src/manifest.json", "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "notifications", "storage"]);
  assert.equal(manifest.minimum_chrome_version, "121");
  assert.deepEqual(manifest.host_permissions, ["https://qr.snkisk.com/*"]);
  assert.equal(manifest.background.service_worker, "handoff-background.js");
  assert.equal(manifest.options_ui.page, "options.html");
  assert.equal(manifest.icons[128], "icon-128.png");
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.deepEqual(manifest.content_scripts, [{ matches: ["https://qr.snkisk.com/*"], js: ["connector-bridge.js"], run_at: "document_start" }]);
  assert.equal(JSON.stringify(manifest).includes("camera"), false);
});
