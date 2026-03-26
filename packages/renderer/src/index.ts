/**
 * @apiref/renderer — TypeDoc JSON → static HTML API documentation generator
 *
 * Transforms TypeDoc v2.0 JSON output into a fully-rendered static documentation site.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { transform, renderSite } from "@apiref/renderer";
 *
 * // Load and parse TypeDoc v2.0 JSON
 * const site = transform(typedocJson);
 * const pages = renderSite(site, {
 *   shellBaseUrl: "https://cdn.example.com/assets"
 * });
 *
 * // Write to disk
 * for (const [url, html] of pages) {
 *   fs.writeFileSync(url, html);
 * }
 * ```
 *
 * ## Pipeline
 *
 * 1. **Parse TypeDoc JSON** — input must be valid TypeDoc v2.0 schema
 * 2. **Transform** ({@link transform}) — build a SiteViewModel with URL maps, nav tree, pages
 * 3. **Render** ({@link renderSite}) — convert SiteViewModel to HTML documents
 * 4. **Write** — save the HTML Map to disk or serve over HTTP
 *
 * ## CLI Usage
 *
 * ```bash
 * apiref-render typedoc.json --out dist --assets-base https://cdn.example.com/assets
 * ```
 *
 * ## View Models
 *
 * The intermediate {@link SiteViewModel} representation separates concerns:
 * - Transformation handles TypeDoc JSON parsing and structure navigation
 * - Rendering focuses on HTML generation without TypeDoc dependencies
 * - Custom transformations can produce SiteViewModel for non-TypeDoc sources
 *
 * @packageDocumentation
 */

export { transform } from "./transformer.ts";
export type { TransformOptions } from "./transformer.ts";
export { renderSite } from "./render.tsx";
export type { RenderOptions } from "./render.tsx";
export type {
  SiteViewModel,
  PageViewModel,
  PageKind,
  NavNode,
  Breadcrumb,
  Section,
  MemberViewModel,
  MemberFlags,
  SignatureViewModel,
  ParameterViewModel,
  TypeParameterViewModel,
  TypeViewModel,
  DocNode,
} from "./viewmodel.ts";
