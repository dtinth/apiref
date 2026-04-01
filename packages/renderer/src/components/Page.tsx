import { buildOutline } from "../outline-builder.ts";
import type {
  Breadcrumb,
  MemberFlags,
  PageViewModel,
  Section,
  SectionBlock,
  SignatureViewModel,
  SiteViewModel,
} from "../viewmodel.ts";
import { DeclarationTitle, SourceLink } from "./DeclarationTitle.tsx";
import { DocView } from "./DocView.tsx";
import { PageContext, BasePrefixContext, useResolveLink } from "./PageContext.tsx";
import { IndexSignatureLine, SignatureLine, TypeView } from "./TypeView.tsx";

export interface PageRenderOptions {
  /** Base URL for the CDN shell assets, e.g. "https://cdn.example.com/shell@1.0.0" */
  shellBaseUrl: string;
  /** Base URL path for all generated links, e.g. "/package/name/v/1.0.0/" */
  baseUrl?: string;
}

interface PageProps {
  site: SiteViewModel;
  page: PageViewModel;
  options: PageRenderOptions;
}

export function Page({ site, page, options }: PageProps) {
  const depth = page.url.split("/").length - 1;
  const baseHref = options.baseUrl
    ? options.baseUrl
    : depth === 0
      ? "./"
      : Array(depth).fill("..").join("/") + "/";

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
        {options.baseUrl && <link rel="canonical" href={options.baseUrl + page.url} />}
        <link rel="icon" href={`${options.shellBaseUrl}/interface.svg`} type="image/svg+xml" />
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
          <header class="ar-header">
            <a href={`${baseHref}index.html`} class="ar-header-logo">
              <span class="text-ar-muted">apiref</span>
              <span class="text-ar-muted">/</span>
              <span class="ar-header-pkg">{site.package.name}</span>
              <span class="ar-header-version">{site.package.version}</span>
            </a>
          </header>
          <nav class="ar-sidebar ar-sidebar--hidden" aria-label="Package navigation"></nav>
          <aside class="ar-outline-sidebar" aria-label="Page outline"></aside>
          <div class="ar-main ar-main--with-outline">
            <div class="ar-content-wrap">
              <main class="ar-content">
                <BasePrefixContext.Provider value={options.baseUrl}>
                  <PageContext.Provider value={page.url}>
                    <PageContent page={page} />
                  </PageContext.Provider>
                </BasePrefixContext.Provider>
              </main>
            </div>
          </div>
        </ar-shell>
      </body>
    </html>
  );
}

function PageContent({ page }: { page: PageViewModel }) {
  return (
    <article class={`ar-declaration ar-declaration--${page.kind}`}>
      {page.breadcrumbs.length > 0 && <Breadcrumbs breadcrumbs={page.breadcrumbs} />}
      {page.sections.map((section, i) => (
        <SectionView key={i} section={section} pageName={page.title} context="page" />
      ))}
    </article>
  );
}

function Breadcrumbs({ breadcrumbs }: { breadcrumbs: Breadcrumb[] }) {
  return (
    <nav class="ar-breadcrumbs" aria-label="Breadcrumb">
      {breadcrumbs.map((breadcrumb, index) => (
        <span key={index} class="ar-breadcrumb-item">
          <LinkedBreadcrumb breadcrumb={breadcrumb} className="ar-breadcrumb-link" />
          <span class="ar-breadcrumb-separator" aria-hidden="true">
            {" » "}
          </span>
        </span>
      ))}
    </nav>
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
    <section class="ar-section" id={section.id}>
      {content}
    </section>
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
            <span class="ar-declaration-heading">
              <DeclarationTitle kind={block.declarationKind} title={block.name} />
              {block.sourceUrl ? <SourceLink href={block.sourceUrl} /> : null}
            </span>
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

    case "index-signature":
      return (
        <div class="ar-signature">
          <IndexSignatureLine sig={block.signature} />
        </div>
      );

    case "card":
      return <CardView card={block} />;

    case "type-declaration":
      return (
        <div class="ar-signature">
          <TypeView type={block.type} />
        </div>
      );

    case "type-declaration-list":
      return (
        <ul class="ar-type-declaration-list">
          {block.types.map((type, i) => (
            <li key={i} class="ar-type-declaration-list-item">
              <div class="ar-signature">
                <TypeView type={type} />
              </div>
            </li>
          ))}
        </ul>
      );

    case "reference-breadcrumbs":
      return (
        <p class="ar-card-reference">
          References <InlineBreadcrumbs breadcrumbs={block.breadcrumbs} />
        </p>
      );

    case "inherited-breadcrumbs":
      return (
        <p class="ar-card-reference">
          Inherited from <InlineBreadcrumbs breadcrumbs={block.breadcrumbs} />
        </p>
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

    case "examples":
      return (
        <div class="ar-examples">
          {block.examples.map((ex, i) => (
            <DocView key={i} doc={ex} />
          ))}
        </div>
      );

    default:
      return null;
  }
}

function FlagsView({ flags }: { flags: MemberFlags }) {
  return (
    <div>
      {flags.deprecated && (
        <>
          <span class="ar-badge ar-badge--deprecated">deprecated</span>
          {flags.deprecatedMessage?.length ? <DocView doc={flags.deprecatedMessage} /> : null}
        </>
      )}
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
    <h3 class="ar-card-header">
      <span class="ar-declaration-heading">
        {card.url ? (
          <a href={resolve(card.url)} class="ar-card-title-link">
            <DeclarationTitle kind={titleFromCard.declarationKind} title={titleFromCard.name} />
          </a>
        ) : (
          <DeclarationTitle kind={titleFromCard.declarationKind} title={titleFromCard.name} />
        )}
        {titleFromCard.sourceUrl ? <SourceLink href={titleFromCard.sourceUrl} /> : null}
      </span>
    </h3>
  ) : null;

  const cardClasses = [
    "ar-card",
    card.url ? "ar-card--link" : "",
    card.flags.deprecated ? "ar-card--deprecated" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const hasBody = card.sections.length > 1;

  return (
    <div id={card.anchor} class={cardClasses}>
      {header}
      {hasBody && (
        <div class="ar-card-body">
          {card.sections.slice(1).map((section, i) => (
            <SectionView key={i} section={section} context="card" />
          ))}
        </div>
      )}
    </div>
  );
}

function InlineBreadcrumbs({ breadcrumbs }: { breadcrumbs: Breadcrumb[] }) {
  return (
    <span class="ar-reference-breadcrumbs">
      {breadcrumbs.map((breadcrumb, index) => (
        <span key={index}>
          <LinkedBreadcrumb breadcrumb={breadcrumb} />
          {index + 1 < breadcrumbs.length ? (
            <span aria-hidden="true" class="ar-breadcrumb-separator">
              {" » "}
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

function LinkedBreadcrumb({
  breadcrumb,
  className,
}: {
  breadcrumb: Breadcrumb;
  className?: string;
}) {
  const resolve = useResolveLink();
  if (!breadcrumb.url) return <span class={className}>{breadcrumb.label}</span>;
  return (
    <a href={resolve(breadcrumb.url)} class={className}>
      {breadcrumb.label}
    </a>
  );
}

function SignatureBlock({ sig, label }: { sig: SignatureViewModel; label?: string }) {
  return (
    <div class="ar-signature-block">
      <div class="ar-signature">
        <SignatureLine sig={sig} name={label || ""} />
      </div>
    </div>
  );
}
