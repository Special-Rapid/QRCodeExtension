import { generate } from "./generate-brand-assets.mjs";
import { prepareNativeAssets } from "./prepare-native-assets.mjs";

const argumentsList = process.argv.slice(2);
if (argumentsList.some((argument) => !["--native", "--offline"].includes(argument))) throw new Error("Usage: prepare-build-assets.mjs [--native] [--offline]");
if (argumentsList.includes("--native")) {
  const result = await prepareNativeAssets({ offline: argumentsList.includes("--offline") || process.env.QR_ASSETS_OFFLINE === "1" });
  console.log(`Verified ${result.objects} CDN/cache objects for ${result.destinations} native resources.`);
}
await generate();
await generate({ check: true });
