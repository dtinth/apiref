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
RENDERING    → typedoc.json → HTML files → upload
SERVING      → object storage + shared shell CDN
```

## Renderer (`@apiref/renderer`) — BUILT

`packages/renderer/` — two-stage pipeline: TypeDoc JSON → ViewModel → HTML.

### Transformer (`src/transformer.ts`)

- Two-pass: pass 1 builds `id → URL` map; pass 2 builds pages.
- Single-entry-point detection: `children.every(c => c.kind !== Kind.Module)`.
- Nav tree children sorted alphabetically.
- Builds `outline` data (from page sections) for `#ar-meta`.

### HTML renderer (`src/render.tsx`, `src/components/`)

- Preact SSR (`preact-render-to-string`). No Preact runtime in browser.
- Markdown via `marked`: TypeDoc comment parts reassembled → `marked.parse()`.
- CDN resources in `<head>`: Arimo (Google Fonts), Comic Mono (jsDelivr), VS Code codicons, shell CSS + JS.
- Shiki syntax highlighting: **planned**.

### CLI

`apiref-render [--out <dir>] [--assets-base <url>] <input.json>`
Default assets base: `https://dtinth.github.io/apiref/assets/`

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
- Content preservation in `ar-shell`: saves `childNodes` in `connectedCallback()` before Lit's async render clears them, re-inserts via `ref` callback on content wrapper.
- Typography: `@tailwindcss/typography` via `@plugin` (Tailwind v4 CSS-first). Dark theme via `--tw-prose-*` CSS variables.

### Components

| Element        | Status  | Description                                                             |
| -------------- | ------- | ----------------------------------------------------------------------- |
| `<ar-shell>`   | Built   | Main layout shell (header + left nav + content + outline)               |
| `<ar-header>`  | Built   | Top bar: package name/version + mobile hamburger                        |
| `<ar-nav>`     | Built   | Left sidebar nav tree with VS Code codicon kind icons, active highlight |
| `<ar-outline>` | Planned | Right "Outline" panel (VS Code Outline-style)                           |
| `<ar-search>`  | Planned | Search powered by Pagefind                                              |

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

| Package            | Status      | Description                         |
| ------------------ | ----------- | ----------------------------------- |
| `@apiref/renderer` | Built       | TypeDoc JSON → static HTML          |
| `@apiref/shell`    | Built       | Web components + Tailwind CSS (CDN) |
| `worker`           | Not started | Containerized generation worker     |
| `intake`           | Not started | Intake API + web form               |

Fixtures: `fixtures/visual-storyboard.json`, `fixtures/pw-utilities.json`

## Immediate next steps

1. ✅ **Active nav highlight** — left accent border + stronger bg on current-page nav item.
2. ✅ **Outline panel** (`ar-outline`) — right sidebar; `#ar-meta.outline` built from page sections.
3. **Page hierarchy refactor** — restructure transformer to:
   - Make Module/Namespace/Class/Function distinct pages
   - Keep Methods/Properties/Constructors as subsections (anchors only, no separate pages)
   - Update nav tree to show only up to Class level
   - Handle dual-nature declarations (function + namespace → separate pages)
4. **Content layout** — update renderer to:
   - Add kind icons + type labels to `h1.ar-declaration-title` and `h2.ar-declaration-title`
   - Create boxed subsection cards for Constructor/Properties/Methods
   - Add parameter/return/example sections within boxes
5. **Index page links** — make module/class items clickable links to their pages
6. **Syntax highlighting** — Shiki for fenced code blocks in `ar-description`.
7. **Pagefind search** — post-process + `<ar-search>` component.
8. **Worker + Intake** — generation pipeline.

## Open questions

- **Dual-nature combined pages:** Should we combine multiple natures (e.g., function + namespace, variable + interface) on one page with multiple h1s? Currently plan is separate pages; this is a future enhancement.
- **Re-rendering strategy:** Batch re-render vs. lazy re-render on request?
- **Version selection UI:** Needs `/{pkg}/versions.json`.
- **Failed packages:** How are TypeDoc failures surfaced and retried?
- **Intake rate limiting:** Captcha, IP rate limiting, or manual approval queue?
