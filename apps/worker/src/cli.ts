import { parseArgs } from "node:util";
import { generate } from "./generate.js";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      out: { type: "string", default: "typedoc.json" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(`
apiref-generate — Generate TypeDoc JSON from an npm package

Usage:
  apiref-generate <package-spec> [options]

Arguments:
  <package-spec>     Package name and version (e.g., elysia@1.4.28, react)

Options:
  --out <file>       Output file path (default: typedoc.json)
  -h, --help         Show this help message

Examples:
  apiref-generate elysia@1.4.28
  apiref-generate react --out react-docs.json
`);
    process.exit(0);
  }

  const packageSpec = positionals[0];
  const outFile = values.out;

  try {
    await generate({ packageSpec, outFile });
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

void main();
