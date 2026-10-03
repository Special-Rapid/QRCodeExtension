import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { prepareNativeAssets, validateLock } from "../prepare-native-assets.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const sha256 = createHash("sha256").update(png).digest("hex");
const destination = "apps/mobile/android/app/src/main/res/drawable-mdpi/splashscreen_logo.png";
const asset = () => ({ sha256, bytes: png.length, mime: "image/png", url: "https://images.snkisk.com/QRCodeExtension/unit-test-only.png", destinations: [destination] });
const lock = (...assets) => ({ version: 1, assets });
async function environment(t) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "qr-assets-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, "checkout");
  const cacheDir = path.join(temporary, "cache");
  await mkdir(root); await mkdir(cacheDir);
  return { root, cacheDir };
}
async function put(root, file, bytes) { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), bytes); }
const forbiddenFetch = () => { throw new Error("Offline preparation must not use the network"); };
const response = (bytes = png, type = "image/png") => new Response(bytes, { headers: { "content-type": type } });

test("verified offline cache restores multiple bundle paths with no network", async (t) => {
  const env = await environment(t); const a = asset();
  a.destinations.push("apps/mobile/ios/QRScan/Images.xcassets/SplashScreenLogo.imageset/image.png");
  await put(env.cacheDir, sha256, png);
  assert.deepEqual(await prepareNativeAssets({ ...env, lock: lock(a), offline: true, fetchImpl: forbiddenFetch }), { objects: 1, destinations: 2, offline: true });
  for (const file of a.destinations) assert.deepEqual(await readFile(path.join(env.root, file)), png);
});

test("validated online input warms external cache then supports an offline clean build", async (t) => {
  const env = await environment(t); let calls = 0;
  await prepareNativeAssets({ ...env, lock: lock(asset()), fetchImpl: async (_url, options) => { calls++; assert.equal(options.redirect, "error"); assert.equal(options.credentials, "omit"); return response(); } });
  assert.equal(calls, 1); await rm(path.join(env.root, "apps"), { recursive: true });
  await prepareNativeAssets({ ...env, lock: lock(asset()), offline: true, fetchImpl: forbiddenFetch });
  assert.deepEqual(await readFile(path.join(env.root, destination)), png);
});

for (const mode of ["miss", "wrong-size", "wrong-hash"]) test(`offline ${mode} cache safely stops without replacing bundle input`, async (t) => {
  const env = await environment(t); await put(env.root, destination, "previous bundle input");
  if (mode !== "miss") { const bad = Buffer.from(png); bad[bad.length - 1] ^= 1; await put(env.cacheDir, sha256, mode === "wrong-size" ? bad.subarray(0, 9) : bad); }
  await assert.rejects(prepareNativeAssets({ ...env, lock: lock(asset()), offline: true, fetchImpl: forbiddenFetch }), /cache|mismatch/u);
  assert.equal(await readFile(path.join(env.root, destination), "utf8"), "previous bundle input");
});

for (const mode of ["HTTP403", "MIME", "hash", "overrun", "length"]) test(`invalid ${mode} download is never cached or bundled`, async (t) => {
  const env = await environment(t); await put(env.root, destination, "previous");
  const fetchImpl = async () => {
    if (mode === "HTTP403") return new Response("blocked", { status: 403 });
    if (mode === "MIME") return response(png, "text/html");
    if (mode === "overrun") return response(Buffer.concat([png, png]));
    if (mode === "length") return new Response(png, { headers: { "content-type": "image/png", "content-length": "1" } });
    const bad = Buffer.from(png); bad[bad.length - 1] ^= 1; return response(bad);
  };
  await assert.rejects(prepareNativeAssets({ ...env, lock: lock(asset()), fetchImpl }));
  await assert.rejects(access(path.join(env.cacheDir, sha256)), { code: "ENOENT" });
  assert.equal(await readFile(path.join(env.root, destination), "utf8"), "previous");
});

test("one failing object leaves all existing bundle destinations untouched", async (t) => {
  const env = await environment(t); const a = asset(); const b = { ...asset(), sha256: "a".repeat(64), destinations: ["apps/mobile/ios/QRScan/Images.xcassets/SplashScreenLogo.imageset/image.png"] };
  await put(env.root, destination, "previous"); await put(env.cacheDir, sha256, png);
  await assert.rejects(prepareNativeAssets({ ...env, lock: lock(a, b), offline: true, fetchImpl: forbiddenFetch }), /cache miss/u);
  assert.equal(await readFile(path.join(env.root, destination), "utf8"), "previous");
});

test("unpublished URLs, outside hosts, traversal and duplicate paths fail lock preflight", () => {
  for (const change of [{ url: null }, { url: "https://evil.example/QRCodeExtension/icon.png" }, { destinations: ["../../secret"] }, { destinations: [destination, destination] }]) assert.throws(() => validateLock(lock({ ...asset(), ...change })));
});

test("symlink destinations and cache inside checkout are rejected before writes", async (t) => {
  const env = await environment(t); await put(env.cacheDir, sha256, png);
  await assert.rejects(prepareNativeAssets({ ...env, cacheDir: path.join(env.root, ".cache"), lock: lock(asset()), offline: true }), /outside/u);
  await mkdir(path.join(env.root, "apps")); await symlink(env.cacheDir, path.join(env.root, "apps/mobile"));
  await assert.rejects(prepareNativeAssets({ ...env, lock: lock(asset()), offline: true }), /symlink/u);
});
