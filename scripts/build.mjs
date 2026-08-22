import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await Promise.all([
  cp("src/manifest.json", "dist/manifest.json"),
  cp("src/popup.html", "dist/popup.html"),
  cp("src/popup.css", "dist/popup.css"),
  cp("src/options.html", "dist/options.html"),
  cp("src/options.css", "dist/options.css"),
  cp("src/icon-128.png", "dist/icon-128.png"),
  build({ entryPoints: ["src/popup.js"], bundle: true, format: "esm", outfile: "dist/popup.js", target: "chrome114" }),
  build({ entryPoints: ["src/options.js"], bundle: true, format: "esm", outfile: "dist/options.js", target: "chrome114" }),
  build({ entryPoints: ["src/handoff-background.js"], bundle: true, format: "esm", outfile: "dist/handoff-background.js", target: "chrome114" })
]);
