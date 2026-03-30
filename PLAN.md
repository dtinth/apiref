# apiref2

> **Agent instruction:** This file is the single source of truth for the project's architecture and design decisions. Whenever you make a code change that affects the architecture, adds a component, changes a technology choice, or resolves an open question, update the relevant section of this file in the same commit/step. Do not let the plan drift from the code.

Automatically generated TypeScript API documentation for npm packages — a [docs.rs](https://docs.rs)-equivalent for the npm ecosystem.

## Background

[apiref.page](https://apiref.page) (v1) has been running ~4 years. Problems: requires API Extractor (most packages don't use it), built on Remix/Vercel SSR (costly, poor long-term foundation). v2 uses TypeDoc (works with any package shipping `.d.ts`) and generates fully static HTML.

## Core design principles

- **Static HTML only.** Deployable to any object storage.
- **Provenance-gated.** Only packages with npm provenance attestation accepted.
- **Types required.** Packages must ship `.d.ts` files.
- **Renderer is independent.** Takes TypeDoc JSON, no dependency on npm/TypeDoc.

## Architecture

```
INTAKE       → check provenance + types → Grist queue
GENERATION   → pnpm install + typedoc --json → upload typedoc.json
RENDERING    → typedoc.json → HTML files (with --base-url) → rclone upload
SERVING      → object storage (S3-compatible, R2, GCS) + shared shell CDN
```

### Deployment and Storage

**Object Storage Paths:**

- Destination: `package/{name}/v/{version}/` (mirrors npm registry structure)
- Format: Absolute root-relative paths in all links (e.g., `/package/@scope/pkg/v/1.0.0/path/to/page.html`)
- Uses `--base-url` flag to generate absolute links, avoiding S3 trailing-slash ambiguity

**Upload Process:**

- Uses `rclone copy` with `--progress --no-traverse` flags
- Environment: `APIREF_STORAGE_BUCKET` sets destination root
- Inter-step communication: `PipelineContext` carries `resolvedPackageName` and `resolvedVersion` from verify-provenance to render-static to upload-storage

**Link Generation:**

- With `--base-url`: All links are absolute from site root (e.g., `/package/@scope/pkg/v/1.0.0/path`)
- Without `--base-url`: Uses relative links based on page depth (legacy behavior)
- Canonical link: Generated when baseUrl provided; points to absolute path
- Same-page anchors: Always relative, never affected by baseUrl

## Renderer (`@apiref/renderer`) — BUILT

`packages/renderer/` — two-stage pipeline: TypeDoc JSON → ViewModel → HTML.

### Transformer (`src/transformer.ts`)

- Two-pass: pass 1 builds `id → URL` map; pass 2 builds pages.
- All packages treated uniformly as multi-module structures (single-entry packages get "main" module).
- Nav tree children sorted alphabetically.
- Builds `outline` data (from page sections) for `#ar-meta`.

### HTML renderer (`src/render.tsx`, `src/components/`)

- Preact SSR (`preact-render-to-string`). No Preact runtime in browser.
- Markdown via `marked`: TypeDoc comment parts reassembled → `marked.parse()`.
- CDN resources in `<head>`: Arimo (Google Fonts), Comic Mono (jsDelivr), VS Code codicons, shell CSS + JS.
- **Shiki syntax highlighting:** Implemented with catppuccin-mocha theme (bg color customized to #252423).

### CLI

`apiref-render [--out <dir>] [--assets-base <url>] [--base-url <url>] [--shell-base-url <url>] [--version <version>] <input.json>`

**Options:**

- `--out` — Output directory (default: `./dist`)
- `--assets-base` — CDN base URL for resources (default: `https://dtinth.github.io/apiref/assets/`)
- `--base-url` — Absolute root-relative base URL for all links (e.g., `/package/@pkg/lib/v/1.0.0/`). When provided, generates absolute links instead of relative links. Enables deployment to S3-compatible storage without trailing-slash issues.
- `--shell-base-url` — Base URL for shell assets; used for favicon and shell CSS/JS (default: `--assets-base`)
- `--version` — Package version (passed to renderer, used in metadata)

### Page hierarchy

**Gets its own page:**

| Kind      | URL                                    | Nav shows |
| --------- | -------------------------------------- | --------- |
| Project   | `index.html`                           | Yes       |
| Module    | `{module}/index.html`                  | Yes       |
| Namespace | `{module}/{ns}/index.html` (nested ok) | Yes       |
| Class     | `{module}/{Name}.html`                 | Yes       |
| Interface | `{module}/{Name}.html`                 | Yes       |
| Function  | `{module}/{name}.html`                 | Yes       |
| TypeAlias | `{module}/{Name}.html`                 | Yes       |
| Variable  | `{module}/{name}.html`                 | Yes       |
| Enum      | `{module}/{Name}.html`                 | Yes       |

**Doesn't get its own page (subsections only):**

| Kind        | Location                            | Display                  |
| ----------- | ----------------------------------- | ------------------------ |
| Constructor | Anchor `#constructor` on class page | h2 heading + boxed items |
| Property    | Anchor `#{name}` on parent page     | h2 heading + boxed items |
| Method      | Anchor `#{name}` on parent page     | h2 heading + boxed items |
| Accessor    | Anchor `#{name}` on parent page     | h2 heading + boxed items |
| EnumMember  | Anchor `#{name}` on enum page       | h2 heading + boxed items |

**Dual-nature items (e.g., function + namespace, variable + interface):**

- Create separate pages for each nature
- Both appear in nav tree
- Can optionally combine on one page with multiple h1s (future enhancement)

### ViewModel types (internal, `src/viewmodel.ts`)

```typescript
type SiteViewModel = {
  package: { name: string; version: string };
  pages: PageViewModel[];
  navTree: NavNode[];
};
type PageViewModel = {
  url: string;
  title: string;
  kind: DeclarationKind;
  breadcrumbs: Breadcrumb[];
  sections: Section[];
};
type Section =
  | { kind: "summary"; doc: DocNode[] }
  | { kind: "constructor"; signatures: SignatureViewModel[] }
  | { kind: "signatures"; signatures: SignatureViewModel[] }
  | { kind: "members"; label: string; members: MemberViewModel[] }
  | { kind: "type-declaration"; type: TypeViewModel };
type MemberViewModel = {
  anchor: string;
  name: string;
  flags: MemberFlags;
  signatures: SignatureViewModel[];
  doc: DocNode[];
};
type NavNode = {
  label: string;
  url: string;
  kind: string;
  flags: { deprecated?: boolean };
  children: NavNode[];
};
```

## Shell (`@apiref/shell`) — BUILT

`packages/shell/` — Lit + Tailwind CSS v4 web components for interactive chrome.

**Key implementation notes:**

- No shadow DOM — `createRenderRoot()` returns `this`.
- `experimentalDecorators: true` + `useDefineForClassFields: false` required (Rolldown emits native TC39 decorator syntax; current Chrome rejects `@decorator class-expression`).
- **Server-side shell layout:** Complete shell structure (header, nav, outline, main) rendered in static HTML from renderer. `ar-shell` on connection populates pre-rendered layout elements (no longer a Lit renderer).
- **Content preservation:** Static `<main>` element stays in place; `ar-shell` queries and populates `.ar-content-wrap` with navigation and outline components.
- **Scroll position memory:** Sidebar scroll position saved to sessionStorage before navigation, restored on page load. Active nav item auto-scrolls into view on first load.
- **Instant hover states:** All transition animations removed for immediate visual feedback.
- **Module nav labels:** Display full import paths (e.g., `@package/core`, `@package/core/data`) instead of just module names. Sorted with index module first, then alphabetically.
- Typography: `@tailwindcss/typography` via `@plugin` (Tailwind v4 CSS-first). Dark theme via `--tw-prose-*` CSS variables.

### Components

| Element        | Status  | Description                                                              |
| -------------- | ------- | ------------------------------------------------------------------------ |
| `<ar-shell>`   | Built   | Main layout shell (header + left nav + content + outline); DOM connector |
| `<ar-header>`  | Built   | Top bar: package name/version + mobile hamburger                         |
| `<ar-nav>`     | Built   | Left sidebar nav tree with VS Code codicon kind icons, active highlight  |
| `<ar-outline>` | Built   | Right sidebar outline panel with section navigation                      |
| `<ar-search>`  | Planned | Search powered by Pagefind                                               |

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ar-header (fixed, full width, h-[58px])                     │
├──────────────┬──────────────────────────┬────────────────────┤
│  ar-nav      │  ar-content-wrap         │  ar-outline        │
│  w-[20rem]   │  max-w-3xl               │  w-[14rem]         │
│  fixed left  │  main content            │  fixed right       │
└──────────────┴──────────────────────────┴────────────────────┘
```

### `#ar-meta` blob

```typescript
interface ArMeta {
  package: string;
  version: string;
  title: string;
  kind: string;
  breadcrumbs: Array<{ label: string; url: string }>;
  navTree: NavNode[];
  outline: OutlineSection[]; // drives ar-outline panel
}
interface OutlineSection {
  label: string;
  items: OutlineItem[];
}
interface OutlineItem {
  label: string;
  anchor: string;
  kind: string;
  flags: { deprecated?: boolean; static?: boolean };
}
```

### Nav kind icons (VS Code codicons, CDN)

| Kind          | Codicon                                   | Color     |
| ------------- | ----------------------------------------- | --------- |
| class         | `codicon-symbol-class`                    | `#ee9d28` |
| interface     | `codicon-symbol-interface`                | `#75beff` |
| function      | `codicon-symbol-function`                 | `#b180d7` |
| type-alias    | `codicon-symbol-type-parameter`           | `#1db2ff` |
| variable      | `codicon-symbol-variable`                 | `#75beff` |
| enum          | `codicon-symbol-enum`                     | `#ee9d28` |
| module/ns/pkg | `codicon-symbol-module/namespace/package` | `#cccccc` |

### Content layout & styling

**Page title (`h1.ar-declaration-title`):**

- Layout: `[icon] Name [type]`
  - Left: VS Code codicon (same as nav)
  - Center: Declaration name
  - Right: Muted gray label (e.g., "class", "function", "interface")
- Example: `[icon] MyClass [class]`

**Subsections (`h2.ar-declaration-title`):**

- Layout: `[icon] Section name [type]` (in each box)
- Used for Constructor, Properties, Methods sections within a class
- Each item gets its own box with h2 heading

**Class page structure:**

```
h1: [icon] MyClass [class]
Summary paragraph...

h2: Constructor
  [box] [icon] constructor() [constructor]
    Signature, params, return, description
  [box] [icon] constructor(options) [constructor]
    ...

h2: Properties
  [box] [icon] name [property]
    Type, description
  [box] [icon] count [property]
    ...

h2: Methods
  [box] [icon] render() [method]
    Signature, params, return, description, example
  [box] [icon] reset() [method]
    ...
```

**Function/Module page structure:**

- No boxes for subsections
- Direct layout: description → parameters → return type → examples
- Subsections (e.g., namespace members) appear after

### CSS architecture

- Shell markup: Tailwind utility classes directly.
- Content classes (`ar-*`): defined in `styles.css` via `@apply`. Renderer emits only `ar-*`, never raw Tailwind utilities.
- Fonts: `--font-sans: "Arimo"`, `--font-mono: "Comic Mono"` in `@theme`.
- Declaration title color: `#bbeeff` (`text-ar-accent-cyan`).
- Kind icons: VS Code codicons in title headings (h1, h2).

## Packages

| Package            | Status      | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `@apiref/renderer` | Built       | TypeDoc JSON → static HTML                          |
| `@apiref/shell`    | Built       | Web components + Tailwind CSS (CDN)                 |
| `apiref-worker`    | Built       | CLI: vanilla TypeDoc + git links + monorepo support |
| `intake`           | Not started | Intake API + web form                               |

Fixtures: `fixtures/visual-storyboard.json`, `fixtures/pw-utilities.json`

### Worker CLI (`apiref-worker`) — BUILT

`apps/worker/` — Standalone generation CLI.

- **Entry point:** `apiref-generate <package-spec> [--out <file>]`
- **Core logic:**
  - Creates temporary directory
  - Installs package using `pnpm add --ignore-scripts`
  - Extracts git metadata from `package.json`: `repository.url`, `version`, `repository.directory` (for monorepos)
  - Attempts vanilla TypeDoc generation via `pnpm dlx typedoc` (auto-discovers via `typedoc` export)
  - Fallback: If vanilla fails, parses `package.json` exports for `typedoc` conditional export and uses explicit entry points
  - Generates TypeDoc with `--sourceLinkTemplate` when git info available (supports monorepo via `repository.directory`)
  - Writes output to specified file (default: `typedoc.json`)
  - Cleans up temp directory on success or error
- **Git source links:** Automatically extracts git remote and tag from package.json; generates GitHub/GitLab links with monorepo path prefix
- **Entry point fallback:** `findEntryPointsFallback()` parses package.json exports to find `.d.ts` files when vanilla TypeDoc fails
- **Error handling:** Throws with descriptive messages on parse failures or missing entry points
- **Dependencies:** `execa` for process execution

## Immediate next steps

1. ✅ **Active nav highlight** — left accent border + stronger bg on current-page nav item.
2. ✅ **Outline panel** (`ar-outline`) — right sidebar; `#ar-meta.outline` built from page sections.
3. ✅ **Server-side shell layout** — Complete layout structure in static HTML; ar-shell as DOM connector.
4. ✅ **Scroll position memory** — Sidebar scroll position saved/restored; active item auto-scrolls into view.
5. ✅ **Module import paths** — Nav displays full import paths, sorted with index first.
6. ✅ **Syntax highlighting** — Shiki for fenced code blocks with custom theme.
7. ✅ **Worker CLI** — `apiref-generate <pkg-spec>` with vanilla TypeDoc, git links, monorepo support, entry point fallback.
8. **Page hierarchy refactor** — restructure transformer to:
   - Make Module/Namespace/Class/Function distinct pages
   - Keep Methods/Properties/Constructors as subsections (anchors only, no separate pages)
   - Update nav tree to show only up to Class level
   - Handle dual-nature declarations (function + namespace → separate pages)
9. **Content layout** — update renderer to:
   - Add kind icons + type labels to `h1.ar-declaration-title` and `h2.ar-declaration-title`
   - Create boxed subsection cards for Constructor/Properties/Methods
   - Add parameter/return/example sections within boxes
10. **Index page links** — make module/class items clickable links to their pages
11. **Pagefind search** — post-process + `<ar-search>` component.
12. **Worker containerization + Intake** — production generation pipeline.

## Recent changes

- **2026-03-30:** Removed single-entry-point conditional logic from transformer; all packages now uniformly treated as multi-module structures (single-entry packages get "main" module)
- **2026-03-28:** Implemented upload-storage step using rclone with destination path `package/{name}/v/{version}/`
- **2026-03-28:** Implemented --base-url flag for absolute root-relative links; resolves S3 trailing-slash problem
- **2026-03-28:** Added canonical link generation when baseUrl provided; added favicon pointing to shell interface.svg
- **2026-03-28:** Created BasePrefixContext for baseUrl configuration; updated link resolution to support both relative and absolute paths
- **2026-03-28:** Fixed GitHub Pages workflow to copy all shell assets using bulk cp -rv instead of individual files
- **2026-03-28:** Fixed shell nav active-item detection at subpaths; strips baseHref prefix before comparing location.pathname
- **2026-03-28:** Consolidated renderer TypeDoc aliases; migrated to official TypeDoc JSONOutput types
- **2026-03-28:** Added rest parameter support to signature rendering
- **2026-03-28:** Added monorepo support via `repository.directory` field in TypeDoc JSON
- **2026-03-28:** Added git source links to generated TypeDoc JSON output; integrated into renderer
- **2026-03-28:** Improved apiref-worker CLI to prioritize vanilla TypeDoc with fallback; enhanced .d.ts export resolution
- **2026-03-28:** Enhanced type rendering: template literals, predicate types, type arguments outside references
- **2026-03-28:** Implemented HTML-to-text conversion for signature shouldHaveSignature() logic
- **2026-03-28:** Fixed module name normalization; improved declaration heading alignment; updated source link styling
- **2026-03-28:** Scaffolded `apiref-worker` CLI app — `apiref-generate <pkg>` for local generation
- **2026-03-27:** Fixed TypeViewModel architectural issue (see below)
- **2026-03-27:** Merged shiki code highlighting branch; customized theme background color to #252423
- **2026-03-27:** Removed all transition animations for instant hover states
- **2026-03-27:** Module nav labels now show full import paths, sorted with index first
- **2026-03-27:** Added sidebar scroll position memory and auto-scroll for active nav item
- **2026-03-27:** Moved shell layout to server-side rendering to eliminate pre-JS layout shift

## TypeViewModel Architecture Fix

### Problem

The `TypeViewModel.reflection` type previously contained `members: SectionBlock[]`, which violated separation of concerns by mixing:

- **Type information** (what is the type?) — responsibility of TypeViewModel
- **Document structure** (how do we render it?) — responsibility of Section/SectionBlock

This caused `transformType()` in `type-transformer.ts` to call `buildReflectionMemberBlocks()` in `transformer.ts`, creating an unnecessary circular dependency.

### Solution

1. Created `MemberViewModel` type to represent reflection members (type info only, no rendering structure)
2. Updated `TypeViewModel.reflection` to use `MemberViewModel[]` instead of `SectionBlock[]`
3. Moved reflection member transformation to new `transformReflectionMember()` function in `type-transformer.ts`
4. Removed circular dependency between modules
5. Updated `TypeView.tsx` to render `MemberViewModel` directly

### Result

- `MemberViewModel` contains: name, kind, signatures?, type?, flags? (all type information)
- Rendering logic moved to the view layer (`TypeView.tsx`)
- Clear separation of concerns: transformers output type/view models, renderers handle presentation
- Circular dependency eliminated

## Open questions

- **Dual-nature combined pages:** Should we combine multiple natures (e.g., function + namespace, variable + interface) on one page with multiple h1s? Currently plan is separate pages; this is a future enhancement.
- **Re-rendering strategy:** Batch re-render vs. lazy re-render on request?
- **Version selection UI:** Needs `/{pkg}/versions.json`.
- **Failed packages:** How are TypeDoc failures surfaced and retried?
- **Intake rate limiting:** Captcha, IP rate limiting, or manual approval queue?
