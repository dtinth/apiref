import type {
  DeclarationKind,
  MemberFlags,
  PageViewModel,
  Section,
  SectionBlock,
  SignatureViewModel,
  SiteViewModel,
} from "../viewmodel.ts";
import { DeclarationTitle } from "./DeclarationTitle.tsx";
import { DocView } from "./DocView.tsx";
import { SignatureLine, TypeView } from "./TypeView.tsx";

/**
 * Compute the base href for a page based on its URL depth.
 * This allows all relative links to work correctly regardless of page location.
 *
 * @example
 * computeBaseHref("index.html") // => "./"
 * computeBaseHref("index/Button.html") // => "../"
 * computeBaseHref("integrations/playwright/index.html") // => "../../"
 */
function computeBaseHref(pageUrl: string): string {
  const depth = pageUrl.split("/").length - 1;
  if (depth === 0) return "./";
  return Array(depth).fill("..").join("/") + "/";
}

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

export function Page({ site, page, options }: PageProps) {
  const baseHref = computeBaseHref(page.url);
  const meta = {
    package: site.package.name,
    version: site.package.version,
    title: page.title,
    kind: page.kind,
    breadcrumbs: page.breadcrumbs,
    navTree: site.navTree,
    outline: buildOutline(page.sections),
  };

  return (
    <html lang="en">
      <head>
        <base href={baseHref} />
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
        <ar-shell>
          <main class="ar-content">
            <PageContent page={page} />
          </main>
        </ar-shell>
      </body>
    </html>
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
  // Extract declaration-title from first section
  const titleBlock = card.sections[0]?.body[0];
  const titleFromCard = titleBlock?.kind === "declaration-title" ? titleBlock : null;

  const header = titleFromCard ? (
    card.url ? (
      <a href={card.url} class="ar-card-header">
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
