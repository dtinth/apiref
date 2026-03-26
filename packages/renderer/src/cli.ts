import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { transform } from "./transformer.ts";
import { renderSite } from "./render.tsx";

const DEFAULT_ASSETS_BASE = "https://cdn.apiref.page/assets";

export interface CliOptions {
  /** Path to typedoc.json, or "-" to read from stdin. */
  input: string;
  /** Output directory. */
  out: string;
  /** Base URL for shell CDN assets. */
  assetsBase: string;
  /** Override package version from the TypeDoc JSON. */
  version?: string;
}

/**
 * Core CLI logic — separated from arg-parsing so it can be tested directly.
 */
export async function runCli(options: CliOptions): Promise<{ pagesWritten: number }> {
  const { input, out, assetsBase, version } = options;

  // Read input
  let raw: string;
  if (input === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    raw = Buffer.concat(chunks).toString("utf-8");
  } else {
    raw = readFileSync(input, "utf-8");
  }

  const json: unknown = JSON.parse(raw);

  // Transform → ViewModel
  const site = transform(json, { version });

  // Render → HTML pages
  const pages = renderSite(site, { shellBaseUrl: assetsBase });

  // Write files
  for (const [url, html] of pages) {
    const filePath = join(out, url);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, html, "utf-8");
  }

  return { pagesWritten: pages.size };
}

// ---------------------------------------------------------------------------
// Entry point — only runs when this file is the direct Node.js entry
// ---------------------------------------------------------------------------

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      out: { type: "string", short: "o", default: "dist" },
      "assets-base": { type: "string", default: DEFAULT_ASSETS_BASE },
      version: { type: "string" },
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
  });

  process.stderr.write(`Wrote ${pagesWritten} pages to ${values.out}/\n`);
}
