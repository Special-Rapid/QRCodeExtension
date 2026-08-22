import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await Promise.all([
  cp("src/manifest.json", "dist/manifest.json"),
  cp("src/popup.html", "dist/popup.html"),
  cp("src/popup.css", "dist/popup.css"),
  build({ entryPoints: ["src/popup.js"], bundle: true, format: "esm", outfile: "dist/popup.js", target: "chrome114" })
]);
