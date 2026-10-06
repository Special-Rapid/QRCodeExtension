import { copyFile } from 'node:fs/promises';
import { build } from '../../../node_modules/esbuild/lib/main.js';
await build({ stdin: { contents: 'export { decodeImageData, decodeImageSource } from "./apps/extension/src/qr-decoder.js"; export { toSafeHttpUrl } from "./apps/extension/src/safe-url.js";', resolveDir: new URL('../../../', import.meta.url).pathname }, bundle: true, format: 'esm', minify: true, outfile: new URL('../public/scan-decoder.js', import.meta.url).pathname, legalComments: 'eof' });

await copyFile(new URL('../../../node_modules/jsqr/LICENSE', import.meta.url), new URL('../public/jsqr-LICENSE.txt', import.meta.url));
