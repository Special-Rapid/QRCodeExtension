import { access, lstat, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const ledgerName = "generated-files.json";
const outputName = /^[a-z][a-z0-9-]*\.(?:mjs|d\.mts)$/u;
const argumentsList = process.argv.slice(2);
if (argumentsList.some((argument) => !["--noEmit", "--check"].includes(argument)) || new Set(argumentsList).size !== argumentsList.length || argumentsList.length > 1) throw new Error("Usage: build-tooling.mts [--noEmit | --check]");

class CompilerFailure extends Error {
  status: number;
  constructor(status: number) { super("toolingの型検査に失敗しました。"); this.status = status; }
}
async function compilerPath(): Promise<string> {
  for (const relative of ["node_modules/typescript/bin/tsc", "apps/extension/node_modules/typescript/bin/tsc"]) {
    const candidate = path.join(root, relative);
    try { await access(candidate); if (!(await lstat(candidate)).isFile()) throw new Error("TypeScript compilerは通常fileでなければなりません。"); return candidate; }
    catch (error) { if ((error as { code?: unknown }).code !== "ENOENT") throw error; }
  }
  throw new Error("rootまたはextensionのlocked dependencyをinstallしてからtoolingを生成してください。");
}
function compile(compiler: string, config: string, extra: string[] = []): void {
  const result = spawnSync(process.execPath, [compiler, "--project", path.join(directory, config), ...extra], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new CompilerFailure(result.status ?? 1);
}
function validateNames(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((name: unknown) => typeof name !== "string" || !outputName.test(name))) throw new Error("生成物台帳の名前が不正です。");
  const names = value as string[];
  const unique = new Set<string>(names);
  if (unique.size !== names.length || names.some((name) => !unique.has(name.endsWith(".mjs") ? name.slice(0, -4) + ".d.mts" : name.slice(0, -6) + ".mjs"))) throw new Error("生成物の重複またはMJS/宣言の組合せが不正です。");
  return [...names].sort();
}
async function outputFiles(folder: string, staging: boolean): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const selected = staging ? entries : entries.filter((entry) => entry.name.endsWith(".mjs") || entry.name.endsWith(".d.mts"));
  if (selected.some((entry) => !entry.isFile() || !outputName.test(entry.name))) throw new Error("tooling生成物は平坦な通常MJS/宣言fileでなければなりません。");
  const names = selected.map((entry) => entry.name).sort();
  return staging ? validateNames(names) : names;
}
function ledgerBytes(names: string[]): Buffer { return Buffer.from(JSON.stringify({ version: 1, files: names }, null, 2) + "\n"); }
async function readLedger(): Promise<string[]> {
  if (!(await lstat(path.join(directory, ledgerName))).isFile()) throw new Error("生成物台帳は通常fileでなければなりません。");
  const value: unknown = JSON.parse(await readFile(path.join(directory, ledgerName), "utf8"));
  if ((value as { version?: unknown } | null | undefined)?.version !== 1) throw new Error("生成物台帳のversionが不正です。");
  return validateNames((value as { files?: unknown }).files);
}
function sameNames(left: string[], right: string[]): boolean { return left.length === right.length && left.every((name, index) => name === right[index]); }
function checkTracked(names: string[]): void {
  const files = [...names, ledgerName].map((name) => "tooling/" + name);
  const tracked = spawnSync("git", ["ls-files", "--cached", "--", ...files], { cwd: root, encoding: "utf8" });
  if (tracked.error) throw tracked.error;
  if (tracked.status !== 0 || !sameNames(tracked.stdout.trim().split(/\r?\n/u).filter(Boolean).sort(), [...files].sort())) throw new Error("全生成物と台帳をGitで追跡してください（untracked/ignored生成物は拒否します）。");
  const diff = spawnSync("git", ["diff", "--exit-code", "HEAD", "--", ...files], { cwd: root, stdio: "inherit" });
  if (diff.error) throw diff.error;
  if (diff.status !== 0) throw new Error("生成物とGit保存内容が一致しません。");
}
async function main(): Promise<void> {
  const compiler = await compilerPath();
  compile(compiler, "tsconfig.build.json", ["--noEmit"]);
  if (argumentsList.includes("--noEmit")) { compile(compiler, "tsconfig.json", ["--noEmit"]); return; }
  const staging = await mkdtemp(path.join(os.tmpdir(), "qr-tooling-emit-"));
  try {
    compile(compiler, "tsconfig.json", ["--outDir", staging]);
    const expected = await outputFiles(staging, true);
    const inputs = await readdir(path.join(directory, "src"), { withFileTypes: true });
    if (inputs.some((entry) => entry.isDirectory())) throw new Error("toolingの実行sourceは平坦なMTSにしてください。");
    const sourceNames = validateNames(inputs.filter((entry) => entry.name.endsWith(".mts") && !entry.name.endsWith(".d.mts")).flatMap((entry) => [entry.name.slice(0, -4) + ".mjs", entry.name.slice(0, -4) + ".d.mts"]));
    if (!sameNames(expected, sourceNames)) throw new Error("編集元から期待する全MJS/宣言が生成されていません。");
    const previous = await readLedger();
    const current = await outputFiles(directory, false);
    const bytes = new Map<string, Buffer>();
    for (const name of expected) bytes.set(name, await readFile(path.join(staging, name)));
    const metadata = ledgerBytes(expected);
    if (argumentsList.includes("--check")) {
      if (!sameNames(expected, current) || !sameNames(expected, previous)) throw new Error("編集元・生成物・台帳の集合が一致しません。");
      for (const name of expected) if (!(await readFile(path.join(directory, name))).equals(bytes.get(name)!)) throw new Error(`生成物が編集元と一致しません: ${name}`);
      if (!(await readFile(path.join(directory, ledgerName))).equals(metadata)) throw new Error("生成物台帳を再生成してください。");
      checkTracked(expected);
      return;
    }
    if (current.some((name) => !previous.includes(name))) throw new Error("台帳外の既存生成物候補は上書き・削除しません。所有を確認してください。");
    const publish = await mkdtemp(path.join(directory, ".qr-tooling-publish-"));
    try {
      for (const [name, data] of bytes) await writeFile(path.join(publish, name), data, { flag: "wx" });
      await writeFile(path.join(publish, ledgerName), metadata, { flag: "wx" });
      const registered = validateNames([...new Set<string>([...previous, ...expected])]);
      await writeFile(path.join(publish, "ownership.json"), ledgerBytes(registered), { flag: "wx" });
      await rename(path.join(publish, "ownership.json"), path.join(directory, ledgerName));
      for (const name of expected) await rename(path.join(publish, name), path.join(directory, name));
      for (const name of previous) if (!expected.includes(name)) await rm(path.join(directory, name), { force: true });
      await rename(path.join(publish, ledgerName), path.join(directory, ledgerName));
    } finally { await rm(publish, { recursive: true, force: true }); }
  } finally { await rm(staging, { recursive: true, force: true }); }
}
try { await main(); }
catch (error) { if (!(error instanceof CompilerFailure)) console.error(error); process.exitCode = error instanceof CompilerFailure ? error.status : 1; }
