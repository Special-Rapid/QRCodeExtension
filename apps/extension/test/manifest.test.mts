import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

// 自己repoの固定manifestを読むテスト用契約。外部JSONの検証には使わない。
interface ExtensionManifest {
  manifest_version: number;
  permissions: string[];
  minimum_chrome_version: string;
  host_permissions: string[];
  background: { service_worker: string };
  options_ui: { page: string };
  icons: Record<string, string>;
  action: { default_popup: string };
  content_scripts: { matches: string[]; js: string[]; run_at: string }[];
}

test("declares a camera-free Manifest V3 extension with a Chrome 121+ fast connector", async () => {
  const manifest: ExtensionManifest = JSON.parse(await readFile("src/manifest.json", "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "notifications", "storage", "alarms"]);
  assert.equal(manifest.minimum_chrome_version, "121");
  assert.deepEqual(manifest.host_permissions, ["https://qr.snkisk.com/*"]);
  assert.equal(manifest.background.service_worker, "handoff-background.js");
  assert.equal(manifest.options_ui.page, "options.html");
  assert.equal(manifest.icons[128], "icon-128.png");
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.deepEqual(manifest.content_scripts, [{ matches: ["https://qr.snkisk.com/*"], js: ["connector-bridge.js"], run_at: "document_start" }]);
  assert.equal(JSON.stringify(manifest).includes("camera"), false);

  const manifestFiles = [
    manifest.background.service_worker,
    manifest.options_ui.page,
    manifest.action.default_popup,
    manifest.icons[128],
    ...manifest.content_scripts.flatMap((contentScript) => contentScript.js)
  ];
  await Promise.all(manifestFiles.map((file) => access(`dist/${file}`)));
  const bridge = await readFile("src/connector-bridge.js", "utf8");
  assert.match(bridge, /announce\(\);\s*\n\s*function announce/);
  assert.match(bridge, /connector-result/);
});
