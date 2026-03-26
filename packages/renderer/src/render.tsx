import { render as renderToString } from "preact-render-to-string";
import type { SiteViewModel } from "./viewmodel.ts";
import { Page, type PageRenderOptions } from "./components/Page.tsx";

export interface RenderOptions extends PageRenderOptions {}

/**
 * Render a SiteViewModel to a map of `url → HTML string`.
 *
 * Each entry is a complete HTML document ready to write to disk.
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
