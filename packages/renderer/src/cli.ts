#!/usr/bin/env node
import { parseArgs } from "node:util";
import { runCli } from "./run-cli.ts";

const DEFAULT_ASSETS_BASE = "https://cdn.apiref.page/assets";

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      out: { type: "string", short: "o", default: "dist" },
      "assets-base": { type: "string", default: DEFAULT_ASSETS_BASE },
      version: { type: "string" },
      "base-url": { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    process.stdout.write(
      `Usage: apiref-render [options] <input>

Arguments:
  input                 Path to typedoc.json (use "-" for stdin)

Options:
  -o, --out <dir>       Output directory (default: "dist")
  --assets-base <url>   Base URL for shell assets
                        (default: ${DEFAULT_ASSETS_BASE})
  --version <ver>       Override package version from typedoc.json
  --base-url <path>     Base URL path for all generated links (e.g. /package/name/v/1.0.0/)
  -h, --help            Show this help
`,
    );
    process.exit(positionals.length === 0 ? 1 : 0);
  }

  const { pagesWritten } = await runCli({
    input: positionals[0]!,
    out: values.out!,
    assetsBase: values["assets-base"]!,
    version: values.version,
    baseUrl: values["base-url"],
  });

  process.stderr.write(
    `Wrote ${pagesWritten} pages, apiref.json, and doc.json.zst to ${values.out}/\n`,
  );
}

void main();
