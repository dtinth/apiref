import type {
  DeclarationKind,
  MemberFlags,
  NavNode,
  PageViewModel,
  Section,
  SectionBlock,
  SignatureViewModel,
  SiteViewModel,
} from "../viewmodel.ts";
import { DeclarationTitle } from "./DeclarationTitle.tsx";
import { DocView } from "./DocView.tsx";
import { SignatureLine, TypeView } from "./TypeView.tsx";
import { PageContext, useResolveLink } from "./PageContext.tsx";

export interface PageRenderOptions {
  /** Base URL for the CDN shell assets, e.g. "https://cdn.example.com/shell@1.0.0" */
  shellBaseUrl: string;
}

interface PageProps {
  site: SiteViewModel;
  page: PageViewModel;
  options: PageRenderOptions;
}

interface OutlineItem {
  label: string;
  anchor: string;
  kind: DeclarationKind;
  flags: { deprecated?: boolean };
}

interface OutlineSection {
  label: string;
  items: OutlineItem[];
}

const KIND_ICONS: Partial<Record<DeclarationKind, string>> = {
  class: "codicon-symbol-class",
  interface: "codicon-symbol-interface",
  function: "codicon-symbol-function",
  "type-alias": "codicon-symbol-type-parameter",
  variable: "codicon-symbol-variable",
  enum: "codicon-symbol-enum",
  module: "codicon-symbol-module",
  namespace: "codicon-symbol-namespace",
  "package-index": "codicon-symbol-package",
  constructor: "codicon-symbol-method",
  method: "codicon-symbol-method",
  property: "codicon-symbol-field",
  accessor: "codicon-symbol-property",
};

function buildOutline(sections: Section[]): OutlineSection[] {
  const result: OutlineSection[] = [];
  for (const section of sections) {
    if (section.title) {
      const items: OutlineItem[] = [];
      for (const block of section.body) {
        if (block.kind === "card") {
          const titleBlock = block.sections[0]?.body[0];
          if (titleBlock?.kind === "declaration-title") {
            items.push({
              label: titleBlock.name,
              anchor: block.anchor,
              kind: titleBlock.declarationKind,
              flags: { deprecated: block.flags.deprecated },
            });
          }
        }
      }
      if (items.length > 0) {
        result.push({ label: section.title, items });
      }
    }
  }
  return result;
}

function getKindIcon(kind: string): string {
  return KIND_ICONS[kind as DeclarationKind] ?? "codicon-symbol-misc";
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getKindIconClassName(kind: string) {
  return joinClasses("codicon", getKindIcon(kind), "ar-kind-icon", `ar-kind-icon--${kind}`);
}

function formatKindLabel(kind: string) {
  return kind.replace(/-/g, " ");
}

export function Page({ site, page, options }: PageProps) {
  const depth = page.url.split("/").length - 1;
  const baseHref = depth === 0 ? "./" : Array(depth).fill("..").join("/") + "/";
  const outline = buildOutline(page.sections);

  const meta = {
    package: site.package.name,
    version: site.package.version,
    title: page.title,
    kind: page.kind,
    breadcrumbs: page.breadcrumbs,
    navTree: site.navTree,
    outline,
    baseHref,
  };

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>
          {page.title} — {site.package.name}
        </title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Arimo:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
        />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/comic-mono@0.0.1/index.css" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.36/dist/codicon.css"
        />
        <link rel="stylesheet" href={`${options.shellBaseUrl}/styles.css`} />
        <script
          type="application/json"
          id="ar-meta"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(meta) }}
        />
        <script type="module" src={`${options.shellBaseUrl}/shell.js`} />
      </head>
      <body>
        <div class="ar-shell" data-ar-shell>
          <header class="ar-header" data-ar-header>
            <button
              type="button"
              class="ar-header-menu-btn"
              data-ar-sidebar-toggle
              aria-controls="ar-sidebar"
              aria-label="Toggle navigation"
              aria-expanded="false"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <a href={baseHref + "index.html"} class="ar-header-logo">
              <span class="ar-header-brand">apiref</span>
              {site.package.name ? (
                <>
                  <span class="ar-header-separator">/</span>
                  <span class="ar-header-pkg">{site.package.name}</span>
                  <span class="ar-header-version">{site.package.version}</span>
                </>
              ) : null}
            </a>
          </header>

          <nav
            id="ar-sidebar"
            class="ar-sidebar ar-sidebar--hidden"
            data-ar-sidebar
            aria-label="Package navigation"
          >
            <div class="ar-nav">
              {site.navTree.map((node) => (
                <NavNodeView key={node.url} node={node} depth={0} currentUrl={page.url} baseHref={baseHref} />
              ))}
            </div>
          </nav>

          <aside class="ar-outline-sidebar" data-ar-outline aria-label="Page outline">
            {outline.length > 0 ? (
              <div class="ar-outline">
                <div class="ar-outline-title">Outline</div>
                {outline.map((section) => (
                  <OutlineSectionView key={section.label} section={section} showLabel={outline.length > 1} />
                ))}
              </div>
            ) : null}
          </aside>

          <main class="ar-main ar-main--with-outline">
            <div class="ar-content-wrap">
              <PageContext.Provider value={page.url}>
                <PageContent page={page} />
              </PageContext.Provider>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}

function NavNodeView({
  node,
  depth,
  currentUrl,
  baseHref,
}: {
  node: NavNode;
  depth: number;
  currentUrl: string;
  baseHref: string;
}) {
  const isActive = node.url === currentUrl;
  return (
    <>
      <a
        href={baseHref + node.url}
        class={joinClasses(
          "ar-nav-item",
          `ar-nav-item--depth-${depth}`,
          isActive && "ar-nav-item--active",
          node.flags.deprecated && "ar-nav-item--deprecated",
        )}
      >
        <i class={getKindIconClassName(node.kind)} />
        <span>{node.label}</span>
      </a>
      {node.children.map((child) => (
        <NavNodeView
          key={child.url}
          node={child}
          depth={depth + 1}
          currentUrl={currentUrl}
          baseHref={baseHref}
        />
      ))}
    </>
  );
}

function OutlineSectionView({
  section,
  showLabel,
}: {
  section: OutlineSection;
  showLabel: boolean;
}) {
  if (section.items.length === 0) return null;
  return (
    <div class="ar-outline-section">
      {showLabel ? <div class="ar-outline-section-label">{section.label}</div> : null}
      {section.items.map((item) => (
        <OutlineItemView key={item.anchor} item={item} />
      ))}
    </div>
  );
}

function OutlineItemView({ item }: { item: OutlineItem }) {
  return (
    <a
      href={`#${item.anchor}`}
      class={joinClasses("ar-outline-item", item.flags.deprecated && "ar-outline-item--deprecated")}
      aria-label={`Jump to ${formatKindLabel(item.kind)} ${item.label}`}
    >
      <i class={getKindIconClassName(item.kind)} />
      <span>{item.label}</span>
    </a>
  );
}

function PageContent({ page }: { page: PageViewModel }) {
  return (
    <article class={`ar-declaration ar-declaration--${page.kind}`}>
      {page.sections.map((section, i) => (
        <SectionView key={i} section={section} pageName={page.title} context="page" />
      ))}
    </article>
  );
}

function SectionView({
  section,
  pageName,
  context,
}: {
  section: Section;
  pageName?: string;
  context: "page" | "card";
}) {
  // Special case: bare doc block (page summary)
  if (!section.title && section.body.length === 1 && section.body[0].kind === "doc") {
    return <DocView doc={section.body[0].doc} />;
  }

  const content = (
    <>
      {section.title && <h2 class="ar-section-title">{section.title}</h2>}
      {section.body.map((block, i) => (
        <BlockView key={i} block={block} pageName={pageName} context={context} />
      ))}
    </>
  );

  return context === "page" ? (
    <section class="ar-section">{content}</section>
  ) : (
    <div class="ar-card-section">{content}</div>
  );
}

function BlockView({
  block,
  pageName,
  context,
}: {
  block: SectionBlock;
  pageName?: string;
  context: "page" | "card";
}) {
  switch (block.kind) {
    case "declaration-title":
      if (context === "page") {
        return (
          <h1 class="ar-declaration-title">
            <DeclarationTitle kind={block.declarationKind} title={block.name} />
          </h1>
        );
      } else {
        // In card, this is handled by CardView instead
        return null;
      }

    case "doc":
      return <DocView doc={block.doc} />;

    case "signatures":
      if (context === "page") {
        return (
          <>
            {block.signatures.map((sig, i) => (
              <SignatureBlock key={i} sig={sig} label={pageName} />
            ))}
          </>
        );
      } else {
        // In card, use SignatureLine
        return (
          <div class="ar-signature">
            {block.signatures.map((sig, i) => (
              <SignatureLine key={i} sig={sig} name={pageName || ""} />
            ))}
          </div>
        );
      }

    case "card":
      return <CardView card={block} />;

    case "type-declaration":
      return (
        <div class="ar-signature">
          <TypeView type={block.type} />
        </div>
      );

    case "flags":
      return <FlagsView flags={block.flags} />;

    case "parameters":
      return (
        <dl class="ar-param-list">
          {block.parameters.map((p) => (
            <>
              <dt key={`dt-${p.name}`} class="ar-param-name">
                {p.name}
              </dt>
              <dd key={`dd-${p.name}`} class="ar-param-doc">
                <DocView doc={p.doc} />
              </dd>
            </>
          ))}
        </dl>
      );

    default:
      return null;
  }
}

function FlagsView({ flags }: { flags: MemberFlags }) {
  return (
    <div>
      {flags.deprecated && <span class="ar-badge ar-badge--deprecated">deprecated</span>}
      {flags.static && <span class="ar-badge ar-badge--static">static</span>}
      {flags.abstract && <span class="ar-badge ar-badge--abstract">abstract</span>}
      {flags.readonly && <span class="ar-badge ar-badge--readonly">readonly</span>}
    </div>
  );
}

function CardView({ card }: { card: Extract<SectionBlock, { kind: "card" }> }) {
  const resolve = useResolveLink();
  // Extract declaration-title from first section
  const titleBlock = card.sections[0]?.body[0];
  const titleFromCard = titleBlock?.kind === "declaration-title" ? titleBlock : null;

  const header = titleFromCard ? (
    card.url ? (
      <a href={resolve(card.url)} class="ar-card-header">
        <DeclarationTitle
          kind={titleFromCard.declarationKind}
          title={titleFromCard.name}
          kindLabelClass="ar-card-kind"
        />
      </a>
    ) : (
      <h3 class="ar-card-header">
        <DeclarationTitle
          kind={titleFromCard.declarationKind}
          title={titleFromCard.name}
          kindLabelClass="ar-card-kind"
        />
      </h3>
    )
  ) : null;

  const cardClasses = card.url ? "ar-card ar-card--link" : "ar-card";

  return (
    <div id={card.anchor} class={cardClasses}>
      {header}
      {card.sections.length > 0 && (
        <div class="ar-card-body">
          {card.sections.slice(1).map((section, i) => (
            <SectionView key={i} section={section} context="card" />
          ))}
        </div>
      )}
    </div>
  );
}

function SignatureBlock({ sig, label }: { sig: SignatureViewModel; label?: string }) {
  return (
    <div class="ar-signature-block">
      <div class="ar-signature">
        <SignatureLine sig={sig} name={label || ""} />
      </div>
      <DocView doc={sig.doc} />
    </div>
  );
}
