import { fileURLToPath } from "node:url";
import { generate } from "../dist/index.mjs";

const pathTo = (file) => fileURLToPath(new URL("../../../" + file, import.meta.url));

await generate({
  installedPackagePath: pathTo("packages/examples"),
  outFile: pathTo("packages/renderer/fixtures/examples.json"),
});
await generate({
  installedPackagePath: pathTo("packages/ecosystem-tests/node_modules/bsearch"),
  outFile: pathTo("packages/renderer/fixtures/bsearch.json"),
});
await generate({
  installedPackagePath: pathTo("packages/ecosystem-tests/node_modules/pw-utilities"),
  outFile: pathTo("packages/renderer/fixtures/pw-utilities.json"),
});
await generate({
  installedPackagePath: pathTo("packages/ecosystem-tests/node_modules/visual-storyboard"),
  outFile: pathTo("packages/renderer/fixtures/visual-storyboard.json"),
});
