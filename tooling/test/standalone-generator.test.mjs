import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const originalRoot = path.resolve(import.meta.dirname, "../..");
const pngDirectory = path.dirname(createRequire(path.join(originalRoot, "apps/extension/package.json")).resolve("pngjs/package.json"));

for (const installedPackage of ["extension", "mobile"]) test(`canonical generation works with only ${installedPackage} dependencies installed`, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "qr-standalone-generator-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "tooling"));
  await mkdir(path.join(root, "assets/brand"), { recursive: true });
  await mkdir(path.join(root, `apps/${installedPackage}/node_modules`), { recursive: true });
  await symlink(pngDirectory, path.join(root, `apps/${installedPackage}/node_modules/pngjs`));
  await writeFile(path.join(root, `apps/${installedPackage}/package.json`), JSON.stringify({ name: "standalone-dependency-fixture" }));
  await writeFile(path.join(root, "tooling/generate-brand-assets.mjs"), await readFile(path.join(originalRoot, "tooling/generate-brand-assets.mjs")));
  await writeFile(path.join(root, "assets/brand/qr-scan-icon.svg"), await readFile(path.join(originalRoot, "assets/brand/qr-scan-icon.svg")));
  const script = path.join(root, "tooling/generate-brand-assets.mjs");
  await run(process.execPath, [script], { env: { ...process.env, NODE_PATH: "" } });
  await run(process.execPath, [script, "--check"], { env: { ...process.env, NODE_PATH: "" } });
  const png = await readFile(path.join(root, "apps/extension/src/icon-128.png"));
  assert.equal(createHash("sha256").update(png).digest("hex"), "0464e92908c9edd747791d116ea548ed515d6b446a068d8b784ad9ce96015aad");
});
