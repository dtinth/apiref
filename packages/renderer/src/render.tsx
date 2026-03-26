import { render as renderToString } from "preact-render-to-string";
import type { SiteViewModel } from "./viewmodel.ts";
import { Page, type PageRenderOptions } from "./components/Page.tsx";

/**
 * Options for rendering a site to HTML.
 *
 * @see {@link PageRenderOptions}
 */
export interface RenderOptions extends PageRenderOptions {}

/**
 * Render a SiteViewModel to a map of `url → HTML string`.
 *
 * This is the second step in the rendering pipeline:
 * 1. Transform TypeDoc JSON to SiteViewModel with {@link transform}
 * 2. Render SiteViewModel to HTML pages (this function)
 * 3. Write the Map entries to disk
 *
 * Each generated HTML document is a complete, standalone page with:
 * - Full HTML5 structure (doctype, head, body)
 * - Embedded shell configuration in a `<script id="ar-meta">` tag
 * - Links to shell assets (CSS, JS) from the provided CDN URL
 * - Ready to serve or write to static file storage
 *
 * @param site - The SiteViewModel to render
 * @param options - Render options (e.g., shellBaseUrl for asset CDN)
 * @returns A Map where each key is a relative URL (e.g., "index.html", "MyClass.html")
 *          and each value is a complete HTML document
 *
 * @example
 * ```typescript
 * const site = transform(typedocJson);
 * const pages = renderSite(site, { shellBaseUrl: "https://cdn.example.com/assets" });
 *
 * for (const [url, html] of pages) {
 *   fs.writeFileSync(url, html);
 * }
 * ```
 */
export function renderSite(site: SiteViewModel, options: RenderOptions): Map<string, string> {
  const output = new Map<string, string>();
  for (const page of site.pages) {
    const html =
      "<!DOCTYPE html>" + renderToString(<Page site={site} page={page} options={options} />);
    output.set(page.url, html);
  }
  return output;
}
