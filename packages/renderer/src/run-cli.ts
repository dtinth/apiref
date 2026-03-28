import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { transform } from "./transformer.ts";
import { renderSite } from "./render.tsx";
import { buildApirefJson } from "./apiref-json.ts";

export interface CliOptions {
  /** Path to typedoc.json, or "-" to read from stdin. */
  input: string;
  /** Output directory. */
  out: string;
  /** Base URL for shell CDN assets. */
  assetsBase: string;
  /** Override package version from the TypeDoc JSON. */
  version?: string;
  /** Base URL for all generated links (makes them absolute from root). */
  baseUrl?: string;
}

/**
 * Core CLI logic — separated from arg-parsing so it can be tested directly.
 */
export async function runCli(options: CliOptions): Promise<{ pagesWritten: number }> {
  const { input, out, assetsBase, version, baseUrl } = options;

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
  const pages = renderSite(site, { shellBaseUrl: assetsBase, baseUrl });

  // Write files
  for (const [url, html] of pages) {
    const filePath = join(out, url);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, html, "utf-8");
  }

  // Generate and write apiref.json
  const apiref = buildApirefJson(site);
  writeFileSync(join(out, "apiref.json"), JSON.stringify(apiref, null, 2), "utf-8");

  return { pagesWritten: pages.size };
}
