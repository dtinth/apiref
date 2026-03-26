import type {
  PageViewModel,
  SiteViewModel,
  Section,
  SignatureViewModel,
  MemberViewModel,
} from "../viewmodel.ts";
import { DocView } from "./DocView.tsx";
import { TypeView, SignatureLine } from "./TypeView.tsx";
import { MemberList } from "./MemberList.tsx";

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
  kind: string;
  flags: { deprecated?: boolean };
}

interface OutlineSection {
  label: string;
  items: OutlineItem[];
}

function memberOutlineKind(member: MemberViewModel): string {
  if (member.signatures.length > 0) return "method";
  return "property";
}

function buildOutline(sections: Section[]): OutlineSection[] {
  const result: OutlineSection[] = [];
  for (const section of sections) {
    if (section.kind === "constructor") {
      result.push({
        label: "Constructor",
        items: [{ label: "constructor", anchor: "constructor", kind: "constructor", flags: {} }],
      });
    } else if (section.kind === "members") {
      result.push({
        label: section.label,
        items: section.members.map((m) => ({
          label: m.name,
          anchor: m.anchor,
          kind: memberOutlineKind(m),
          flags: { deprecated: m.flags.deprecated },
        })),
      });
    }
  }
  return result;
}

export function Page({ site, page, options }: PageProps) {
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
      <h1 class="ar-declaration-title">{page.title}</h1>
      {page.sections.map((section, i) => (
        <SectionView key={i} section={section} />
      ))}
    </article>
  );
}

function SectionView({ section }: { section: Section }) {
  switch (section.kind) {
    case "summary":
      return <DocView doc={section.doc} />;

    case "constructor":
      return (
        <section class="ar-section ar-section--constructor">
          <h2 class="ar-section-title">Constructor</h2>
          <div class="ar-signature">
            {section.signatures.map((sig, i) => (
              <SignatureBlock key={i} sig={sig} label="new" />
            ))}
          </div>
        </section>
      );

    case "signatures":
      return (
        <section class="ar-section ar-section--signatures">
          {section.signatures.map((sig, i) => (
            <SignatureBlock key={i} sig={sig} />
          ))}
        </section>
      );

    case "type-declaration":
      return (
        <section class="ar-section ar-section--type">
          <div class="ar-signature">
            <TypeView type={section.type} />
          </div>
        </section>
      );

    case "members":
      return (
        <section class="ar-section ar-section--members">
          <h2 class="ar-section-title">{section.label}</h2>
          <MemberList members={section.members} />
        </section>
      );
  }
}

function SignatureBlock({ sig, label }: { sig: SignatureViewModel; label?: string }) {
  return (
    <div class="ar-signature-block">
      <SignatureLine sig={sig} name={label ?? ""} />
      <DocView doc={sig.doc} />
    </div>
  );
}
