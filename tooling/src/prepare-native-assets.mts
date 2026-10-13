// 未検証lockの葉はunknown。型投影は既存guard/標準APIアクセスを記述し、schema保証を追加しない。
interface NativeAssetFields { sha256: unknown; bytes: unknown; mime: unknown; url: unknown; destinations: unknown }
interface PreparationOptions { root?: string; lock?: unknown; cacheDir?: string; offline?: boolean; fetchImpl?: typeof fetch }

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rename, rm, stat, lstat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const destinationPattern = /^apps\/mobile\/(?:android\/app\/src\/main\/res\/(?:drawable|mipmap)-(?:mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)\/[a-z_]+\.(?:png|webp)|ios\/QRScan\/Images\.xcassets\/SplashScreenLogo\.imageset\/image(?:@2x|@3x)?\.png|(?:assets|ios\/QRScan)\/expo\.icon\/Assets\/grid\.png)$/u;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export function validateLock(lock: unknown): NativeAssetFields[] {
  if ((lock as { version?: unknown; assets?: unknown } | null | undefined)?.version !== 1 || !Array.isArray((lock as { assets?: unknown }).assets) || !(lock as { assets: unknown[] }).assets.length) throw new Error("Invalid native asset lock.");
  const hashes = new Set<unknown>();
  const destinations = new Set<string>();
  for (const asset of (lock as { assets: NativeAssetFields[] }).assets) {
    if (!/^[a-f0-9]{64}$/u.test(asset.sha256 as string) || hashes.has(asset.sha256)) throw new Error("Invalid/duplicate asset SHA-256.");
    hashes.add(asset.sha256);
    if (!Number.isSafeInteger(asset.bytes) || (asset.bytes as number) < 8 || (asset.bytes as number) > 99 * 1024 * 1024 || asset.mime !== "image/png") throw new Error("Invalid locked PNG size/MIME.");
    if (typeof asset.url !== "string") throw new Error(`Unpublished native asset ${asset.sha256}; wait for a confirmed CDN URL.`);
    const url = new URL(asset.url);
    if (url.protocol !== "https:" || url.hostname !== "images.snkisk.com" || url.port || url.username || url.password || url.search || url.hash || !url.pathname.startsWith("/QRCodeExtension/")) throw new Error("Native inputs must use confirmed HTTPS images.snkisk.com/QRCodeExtension/ URLs.");
    if (!Array.isArray(asset.destinations) || !asset.destinations.length) throw new Error("Asset destinations missing.");
    for (const destination of asset.destinations as unknown[]) {
      if (typeof destination !== "string" || !destinationPattern.test(destination) || destinations.has(destination)) throw new Error(`Invalid/duplicate native destination: ${destination}`);
      destinations.add(destination);
    }
  }
  return (lock as { assets: NativeAssetFields[] }).assets;
}

function verify(bytes: Buffer, asset: NativeAssetFields) {
  if (bytes.length !== asset.bytes || !bytes.subarray(0, 8).equals(pngSignature) || digest(bytes) !== asset.sha256) throw new Error(`Native asset size/signature/SHA-256 mismatch: ${asset.sha256}`);
  return bytes;
}

async function assertNoSymlinks(root: string, destination: string) {
  let current = root;
  for (const segment of destination.split("/")) {
    current = path.join(current, segment);
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`Refusing symlink asset destination: ${destination}`); }
    catch (error) { if ((error as { code?: unknown }).code !== "ENOENT") throw error; }
  }
}

async function canonicalPath(value: string) {
  const missing = [];
  let current = path.resolve(value);
  for (;;) {
    try { return path.join(await realpath(current), ...missing); }
    catch (error) {
      if ((error as { code?: unknown }).code !== "ENOENT") throw error;
      missing.unshift(path.basename(current));
      current = path.dirname(current);
    }
  }
}

async function atomicWrite(destination: string, bytes: Buffer) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = await mkdtemp(path.join(path.dirname(destination), ".qr-asset-"));
  try {
    const file = path.join(temporary, "asset");
    await writeFile(file, bytes, { flag: "wx" });
    await rename(file, destination);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

async function download(asset: NativeAssetFields, fetchImpl: typeof fetch) {
  const response = await fetchImpl(asset.url as string, { redirect: "error", credentials: "omit", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Native asset HTTP ${response.status}: ${asset.sha256}`);
  if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== asset.mime) throw new Error(`Native asset response MIME mismatch: ${asset.sha256}`);
  const length = response.headers.get("content-length");
  if (length !== null && (!response.headers.get("content-encoding") || (response.headers.get("content-encoding") as string).toLowerCase() === "identity") && Number(length) !== asset.bytes) throw new Error(`Native asset response length mismatch: ${asset.sha256}`);
  if (!response.body) throw new Error("Native asset response body missing.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > (asset.bytes as number)) { throw new Error(`Native asset response exceeds locked size: ${asset.sha256}`); }
    chunks.push(Buffer.from(chunk));
  }
  return verify(Buffer.concat(chunks), asset);
}

export async function prepareNativeAssets({ root = repositoryRoot, lock, cacheDir = process.env.QR_ASSET_CACHE_DIR || path.join(os.homedir(), ".cache", "qr-scan", "sha256"), offline = process.env.QR_ASSETS_OFFLINE === "1", fetchImpl = fetch }: PreparationOptions = {}) {
  const assets = validateLock(lock ?? JSON.parse(await readFile(path.join(root, "tooling/native-assets.lock.json"), "utf8")));
  root = await realpath(root);
  cacheDir = await canonicalPath(cacheDir);
  if (cacheDir === root || cacheDir.startsWith(root + path.sep)) throw new Error("Native asset cache must be outside the Git checkout.");
  // Preflight every destination and validate every byte before touching bundle inputs.
  for (const asset of assets) for (const destination of asset.destinations as string[]) await assertNoSymlinks(root, destination);
  const prepared: { asset: NativeAssetFields; bytes: Buffer }[] = [];
  for (const asset of assets) {
    const cacheFile = path.join(cacheDir, asset.sha256 as string);
    let bytes: Buffer;
    try {
      if ((await stat(cacheFile)).size !== asset.bytes) throw new Error(`Corrupt native asset cache: ${asset.sha256}`);
      bytes = verify(await readFile(cacheFile), asset);
    } catch (error) {
      if ((error as { code?: unknown }).code !== "ENOENT") throw error;
      if (offline) throw new Error(`Native asset cache miss in offline mode: ${asset.sha256}`);
      bytes = await download(asset, fetchImpl);
      await atomicWrite(cacheFile, bytes);
    }
    prepared.push({ asset, bytes });
  }
  for (const { asset, bytes } of prepared) {
    for (const destination of asset.destinations as string[]) {
      await assertNoSymlinks(root, destination);
      await atomicWrite(path.join(root, destination), bytes);
    }
  }
  return { objects: assets.length, destinations: assets.reduce((sum, asset) => sum + (asset.destinations as string[]).length, 0), offline };
}
