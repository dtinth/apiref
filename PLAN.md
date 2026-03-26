# apiref2

> **Agent instruction:** This file is the single source of truth for the project's architecture and design decisions. Whenever you make a code change that affects the architecture, adds a component, changes a technology choice, or resolves an open question, update the relevant section of this file in the same commit/step. Do not let the plan drift from the code.
>
> All details in this plan are subject to change as we uncover more information. Treat this as a living document, not a specification.

Automatically generated TypeScript API documentation for npm packages — a [docs.rs](https://docs.rs)-equivalent for the npm ecosystem.

## Background

[apiref.page](https://apiref.page) (v1) has been running for ~4 years. It works, but has two fundamental problems:

- **Adoption barrier**: requires packages to use [API Extractor](https://api-extractor.com/) (part of [Rush Stack](https://rushstack.io/)), which most packages don't.
- **Architecture**: built with [Remix](https://remix.run/) as a server-rendered app on Vercel — Remix has since merged into [React Router v7](https://reactrouter.com/) with [Remix v3 now in the works](https://github.com/remix-run/remix), making it a poor foundation for a long-term project. SSR also means you pay per render with no durable cache.

v2 fixes both: use [TypeDoc](https://typedoc.org/) (works with any package that ships type definitions) and generate fully static HTML deployable to object storage.

## Existing landscape

- **[tsdocs.dev](https://tsdocs.dev)** ([source](https://github.com/pastelsky/tsdocs)) — closest prior art, TypeDoc-based, but currently down (502) and inherits TypeDoc's default HTML output.
- **[jsr.io](https://jsr.io)** — gold standard for doc rendering quality, uses [deno_doc](https://www.npmjs.com/package/deno_doc) under the hood, but JSR packages only.
- **[paka.dev](https://paka.dev)** — gone.

The gap: no well-maintained, well-designed, publicly hosted API doc site for npm packages.

## Core design principles

- **Static HTML only.** Every documentation page is a static HTML file. No server rendering at request time. Deployable to any object storage (S3, R2, etc.).
- **Provenance-gated.** Only npm packages published with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) (Sigstore-based attestation) are accepted. This is verified before any container runs, keeping the system secure and the index high-quality.
- **Types required.** Packages must ship TypeScript type definitions (`.d.ts` files). Checked at intake time against the npm registry.
- **Renderer is independent.** The renderer takes a TypeDoc JSON file as input and produces HTML. It has no dependency on npm or TypeDoc itself — it can be run locally on any TypeDoc JSON output.
- **Open source.** The entire system is open source under MIT.

## Architecture overview

```
INTAKE
  Web form (or future: CI trigger, registry watcher)
    → check npm registry: pkg@version has provenance attestation
    → check npm registry: pkg@version ships type definitions
    → write job to Grist queue

GENERATION  (pkg@version → typedoc.json)
  Worker polls Grist for pending jobs
    → npm install pkg@version in isolated container
    → typedoc --json → typedoc.json
    → upload to object storage: /{pkg}/{version}/typedoc.json
    → update Grist row status

RENDERING  (typedoc.json → static HTML)
  Triggered after generation, or run independently
    → read typedoc.json from object storage (or local file)
    → renderer CLI produces HTML files
    → upload to object storage: /{pkg}/{version}/**
    → update Grist row status

SERVING
  Object storage with static hosting
  Shared shell (web components) loaded from CDN
```

## Components

### Intake API

A small HTTP service. Responsibilities:

1. Accept a package name + version (or `latest`) from the web form.
2. Query the [npm registry API](https://registry.npmjs.org/{pkg}/{version}) to check for `dist.attestations` (provenance) and type definitions.
3. Reject without queuing if either check fails.
4. Deduplicate: skip if `pkg@version` is already in the queue or already generated.
5. Write a new row to the Grist queue.

Provenance attestation is [Sigstore](https://sigstore.dev)-based. Verification can be done before any npm install via the dedicated attestations endpoint: `https://registry.npmjs.org/-/npm/v1/attestations/{pkg}@{version}`, or by checking the `dist.attestations` field in the standard registry response — keeping this layer cheap and stateless.

### Queue (Grist)

[Grist](https://www.getgrist.com/) is used as the job queue and status tracker. Reasons:

- Free public-read view — anyone can see what's been requested and what's been processed, with no custom UI to build.
- REST API for workers to poll and update rows.
- Built-in UI for manual intervention (requeue, cancel, inspect errors).
- [Open source](https://github.com/gristlabs/grist-core) and self-hostable if needed later.

Schema (Grist table `Jobs`):

| Column         | Type     | Notes                                                  |
| -------------- | -------- | ------------------------------------------------------ |
| `package`      | Text     | e.g. `playwright`                                      |
| `version`      | Text     | e.g. `1.44.0`                                          |
| `status`       | Choice   | `pending`, `generating`, `rendering`, `done`, `failed` |
| `requested_at` | DateTime |                                                        |
| `error`        | Text     | populated on failure                                   |
| `generated_at` | DateTime | when typedoc.json was uploaded                         |
| `rendered_at`  | DateTime | when HTML was uploaded                                 |

**Concurrency note:** Grist is not a real message queue. If two workers happen to pick up the same job, the worst outcome is that the same documentation gets generated twice — wasted effort, but not harmful (no money moves, no data is corrupted, the second upload just overwrites the first with identical content). No optimistic locking needed.

### Generation worker

A containerized Node.js process. Runs in an isolated environment.

- Polls Grist for `status = pending` rows.
- Installs the package via [pnpm](https://pnpm.io/) into a temp directory. pnpm is preferred over npm because it is faster and, critically, [pnpm v10+ blocks lifecycle scripts by default](https://pnpm.io/supply-chain-security) — meaning `postinstall` and similar hooks in the package or its dependencies do not execute unless explicitly allowlisted. This significantly reduces the attack surface.
- Runs [TypeDoc](https://typedoc.org/) with `--json` to produce `typedoc.json`. TypeDoc version pinned in the worker image.
- Uploads `typedoc.json` to object storage at `/{pkg}/{version}/typedoc.json`.
- Updates Grist row to `status = rendering`, then triggers the renderer.

The container does **not** run arbitrary package code — TypeDoc operates on type definitions only (`.d.ts` files), and pnpm v10+ blocks lifecycle scripts by default. Together these keep the worker safe to run against untrusted packages.

### Renderer

Two-stage pipeline: TypeDoc JSON → **ViewModel** (JSON) → **HTML files**.

The intermediate ViewModel makes each stage independently testable and lets the HTML renderer stay simple — all complex decisions (page assignment, URL resolution, cross-reference resolution) happen in the transformer stage.

#### Stage 1 — Transformer (`@apiref/transformer`)

Input: TypeDoc JSON (schema version 2.0, `kind` numbers per [`ReflectionKind`](https://typedoc.org/api/enums/Models.ReflectionKind.html)).
Output: `SiteViewModel` JSON.

Key responsibilities:

- Decide which TypeDoc reflections become pages vs. anchors within a page (see mapping below).
- Build a slug for every reflection that gets a URL; deduplicate slugs.
- Resolve all cross-references (`id` → absolute URL within the site) before the HTML stage.
- Build the navigation tree embedded into every page's `#ar-meta` blob.

#### Stage 2 — Renderer (`@apiref/renderer`)

Input: `SiteViewModel` JSON.
Output: a directory of static `.html` files.

Key responsibilities:

- Render each `PageViewModel` to HTML using [Preact](https://preactjs.com/) + [`preact-render-to-string`](https://github.com/preactjs/preact-render-to-string). No Preact runtime is shipped to the browser.
- Emit semantic HTML with `ar-*` class names (see CSS architecture).
- Render type signatures with syntax highlighting ([Shiki](https://shiki.matsu.io/)).
- Embed the `#ar-meta` JSON blob and load the CDN shell resources.

#### Page hierarchy

TypeDoc `kind` → page or anchor:

| Kind        | Number  | Becomes                                      |
| ----------- | ------- | -------------------------------------------- |
| Project     | 1       | `index.html` (package index listing modules) |
| Module      | 2       | `{module}/index.html`                        |
| Class       | 128     | `{module}/{Name}.html`                       |
| Interface   | 256     | `{module}/{Name}.html`                       |
| Function    | 64      | `{module}/{name}.html`                       |
| TypeAlias   | 2097152 | `{module}/{Name}.html`                       |
| Variable    | 32      | `{module}/{name}.html`                       |
| Enum        | 8       | `{module}/{Name}.html`                       |
| Namespace   | 4       | `{module}/{name}/index.html`                 |
| Constructor | 512     | Anchor `#constructor` on class page          |
| Property    | 1024    | Anchor `#{name}` on parent page              |
| Method      | 2048    | Anchor `#{name}` on parent page              |
| Accessor    | 262144  | Anchor `#{name}` on parent page              |
| EnumMember  | 16      | Anchor `#{name}` on enum page                |

Single-entry-point packages skip the module level: `index.html` is both the package index and the module listing.

Example URL tree for `visual-storyboard`:

```
index.html
index/index.html
index/StoryboardWriter.html
index/CreateStoryboardFrameOptions.html
index/StoryboardEvent.html
integrations/playwright/index.html
integrations/playwright/PlaywrightStoryboard.html
integrations/playwright/LocatorLike.html
transports/file/index.html
transports/file/FileTransport.html
```

#### ViewModel types (internal to `@apiref/renderer`)

Not a public API — lives in `packages/renderer/src/viewmodel.ts`. Defined here for reference:

```typescript
type SiteViewModel = {
  package: { name: string; version: string }
  pages: PageViewModel[]
  navTree: NavNode[]
}

type PageViewModel = {
  url: string
  title: string
  kind: PageKind   // 'package-index' | 'module' | 'class' | 'interface' | ...
  breadcrumbs: { label: string; url: string }[]
  sections: Section[]
}

type Section =
  | { kind: 'summary'; doc: DocNode[] }
  | { kind: 'constructor'; signatures: SignatureViewModel[] }
  | { kind: 'members'; label: string; members: MemberViewModel[] }
  | { kind: 'type-declaration'; type: TypeViewModel }

type MemberViewModel = {
  anchor: string       // resolved and deduplicated
  name: string
  flags: MemberFlags   // optional, deprecated, static, readonly, abstract
  signatures: SignatureViewModel[]
  doc: DocNode[]
}

// Cross-references resolved to URLs at transformer stage
type TypeViewModel =
  | { kind: 'reference'; name: string; url: string | null }
  | { kind: 'union'; types: TypeViewModel[] }
  | { kind: 'intersection'; types: TypeViewModel[] }
  | { kind: 'literal'; value: string }
  | { kind: 'array'; elementType: TypeViewModel }
  | { kind: 'intrinsic'; name: string }
  | { kind: 'reflection'; declaration: MemberViewModel[] }
  | ...

type NavNode = {
  label: string; url: string; kind: string
  flags: { deprecated?: boolean; beta?: boolean }
  children: NavNode[]
}
```

The `fixtures/` directory at the repo root contains sample TypeDoc JSON outputs for development and testing.

### Shell (web components)

A separate package of [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_Components) providing the interactive chrome: `<ar-shell>`, `<ar-header>`, `<ar-search>`, `<ar-nav>`.

- Served from a predictable CDN path so generated HTML pages need no changes when the shell is updated.
- No shadow DOM — shell components use regular DOM so Tailwind utility classes apply naturally.
- Layered on top of semantic HTML — pages are fully readable without JS.
- Built and published independently from the renderer; updating the shell does not require re-rendering all packages.

Every generated HTML page loads two CDN resources:

```html
<link rel="stylesheet" href="https://cdn.example.com/shell@{version}/styles.css" />
<script type="module" src="https://cdn.example.com/shell@{version}/shell.js"></script>
```

`styles.css` is a compiled [Tailwind CSS](https://tailwindcss.com/) bundle (with the [`@tailwindcss/typography`](https://tailwindcss.com/docs/typography-plugin) plugin) that defines all `ar-*` content classes via `@apply`. Shell component templates use Tailwind utility classes directly in their markup.

The shell reads a metadata blob embedded in each page to populate navigation, breadcrumbs, and the search index pointer:

```html
<script type="application/json" id="ar-meta">
  {
    "package": "playwright",
    "version": "1.44.0",
    "title": "Page",
    "kind": "class",
    "breadcrumbs": [{ "label": "playwright", "href": "../index.html" }],
    "navTree": [ ... ]
  }
</script>
```

The renderer is responsible for generating and embedding this blob. The shell never parses the HTML content — it only reads `#ar-meta`.

Search is powered by [Pagefind](https://pagefind.app/), which runs as a post-process step over the generated HTML to produce a per-package search index and a small query runtime.

### CSS architecture

[Tailwind CSS](https://tailwindcss.com/) is used throughout, but with a deliberate split:

- **Shell components** use Tailwind utility classes directly in their markup (standard Tailwind usage).
- **Content classes** (`ar-*`) are defined in the shell's CSS using [`@apply`](https://tailwindcss.com/docs/reusing-styles#extracting-classes-with-apply). The renderer emits only semantic class names — it never emits raw Tailwind utility classes.

This means the renderer has no knowledge of Tailwind. It emits HTML like:

```html
<div class="ar-declaration ar-declaration--class">
  <div class="ar-signature">...</div>
  <div class="ar-description">...</div>
  <ul class="ar-member-list">
    ...
  </ul>
</div>
```

And the shell CSS defines what those mean:

```css
.ar-declaration {
  @apply bg-white rounded-lg border border-gray-200 p-6 mb-4;
}
.ar-signature {
  @apply font-mono text-sm bg-gray-50 p-3 rounded;
}
.ar-description {
  @apply prose prose-gray max-w-none;
}
.ar-member-list {
  @apply divide-y divide-gray-100 mt-4;
}
```

[CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties) are used for theming tokens shared between shell and content:

```css
:root {
  --ar-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --ar-color-kind-class: #3b82f6;
  --ar-color-kind-interface: #8b5cf6;
  --ar-color-kind-function: #10b981;
  --ar-color-kind-type: #f59e0b;
}
```

**Content class vocabulary:**

| Class                    | Purpose                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `ar-declaration`         | Top-level declaration block                                 |
| `ar-declaration--{kind}` | Modifier for kind (class, interface, function, type, enum…) |
| `ar-signature`           | Type signature line                                         |
| `ar-description`         | JSDoc prose (gets `prose` typography styles)                |
| `ar-member-list`         | List of methods / properties                                |
| `ar-member`              | Individual member row                                       |
| `ar-type`                | Inline type reference (may be a link)                       |
| `ar-badge`               | Kind pill label                                             |
| `ar-tag`                 | `@param`, `@returns`, `@throws` block                       |
| `ar-source-link`         | "Defined in foo.ts:42" link                                 |

### Object storage

All generated artifacts are stored in a single bucket:

```
/{pkg}/{version}/typedoc.json     — raw TypeDoc output (source of truth)
/{pkg}/{version}/pagefind/...     — Pagefind search index
/{pkg}/{version}/**/*.html        — rendered documentation pages
```

Served as static files. No CDN cache invalidation needed — versions are immutable.

## Toolchain

Built with [Vite+](https://vite.plus/) (`vp`) — a unified toolchain combining Vite, Vitest, Oxlint, Oxfmt, Rolldown, and tsdown. Single config file (`vite.config.ts`), single binary (`vp`).

## Packages

npm scope: `@apiref`

### Published packages

| Package            | Description                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `@apiref/renderer` | TypeDoc JSON → static HTML. Internally: transform to ViewModel then render to HTML. The ViewModel is an internal type, not a public API. |
| `@apiref/shell`    | Web components + compiled Tailwind CSS bundle (CDN-deployed)                                                                             |

### Internal packages (not published)

| Package  | Description                                                            |
| -------- | ---------------------------------------------------------------------- |
| `worker` | Containerized generation worker: `pkg@version` → TypeDoc JSON → upload |
| `intake` | Intake API + web form: validates provenance, writes to Grist queue     |

### Monorepo layout

```
packages/
  renderer/     — @apiref/renderer (transformer + renderer, ViewModel is internal)
  shell/        — @apiref/shell
  worker/       — internal worker (not published)
  intake/       — internal intake service (not published)
fixtures/       — sample TypeDoc JSON files for development and testing
PLAN.md
vite.config.ts
```

## Open questions

- **Re-rendering strategy:** When the renderer is updated, how do we re-render all existing packages? Options: re-render on next request (lazy), batch re-render job, or store `typedoc.json` permanently and re-render on demand.
- **Version selection UI:** How does a user navigate between versions of a package? Needs a version index, likely a small JSON file per package at `/{pkg}/versions.json`.
- **Failed packages:** Some packages may have type definitions that TypeDoc cannot process. How are these surfaced and retried?
- **Intake rate limiting:** Web form needs abuse prevention. Captcha, IP rate limiting, or manual approval queue?
