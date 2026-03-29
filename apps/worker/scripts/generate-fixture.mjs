import { fileURLToPath } from "node:url";
import { generate } from "../dist/index.mjs";

const pkgPath = fileURLToPath(new URL("../../../packages/examples", import.meta.url));
const outFile = fileURLToPath(
  new URL("../../../packages/renderer/fixtures/examples.json", import.meta.url),
);
await generate({
  installedPackagePath: pkgPath,
  outFile,
});
