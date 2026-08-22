import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("declares a minimal camera-free Manifest V3 extension", async () => {
  const manifest = JSON.parse(await readFile("src/manifest.json", "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab"]);
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.equal(JSON.stringify(manifest).includes("camera"), false);
});
