import { expect } from "vite-plus/test";
import { h } from "preact";
import { render as renderToString } from "preact-render-to-string";
import { convert } from "html-to-text";
import { buildOutline } from "../../src/outline-builder.ts";
import { PageContext } from "../../src/components/PageContext.tsx";
import { TypeView } from "../../src/components/TypeView.tsx";
import type {
  NavNode,
  PageViewModel,
  Section,
  SectionBlock,
  SiteViewModel,
} from "../../src/viewmodel.ts";

interface ChildFilter {
  label: string;
  kind?: string;
}

class NavItemTester {
  constructor(
    private navRoot: NavNode[],
    private path: ChildFilter[],
  ) {}

  child(label: string, filter?: { kind: string }): NavItemTester {
    return new NavItemTester(this.navRoot, [...this.path, { label, kind: filter?.kind }]);
  }

  private resolve(): NavNode[] {
    if (this.path.length === 0) return [];

    // Navigate through path, filtering at each level
    let current = this.navRoot;
    for (const filter of this.path.slice(0, -1)) {
      current = current
        .filter((n) => n.label === filter.label && (!filter.kind || n.kind === filter.kind))
        .flatMap((n) => n.children);
    }

    // Filter final level
    const finalFilter = this.path[this.path.length - 1]!;
    let nodes = current.filter(
      (n) => n.label === finalFilter.label && (!finalFilter.kind || n.kind === finalFilter.kind),
    );

    return nodes;
  }

  private pathStr(): string {
    return this.path.map((f) => f.label).join(" > ");
  }

  shouldExist(): void {
    const nodes = this.resolve();
    expect(nodes.length, `Expected nav item at path ${this.pathStr()} to exist`).toBeGreaterThan(0);
  }

  shouldNotExist(): void {
    const nodes = this.resolve();
    expect(nodes, `Expected nav item at path ${this.pathStr()} to not exist`).toHaveLength(0);
  }

  shouldHaveKind(kind: string): void {
    const nodes = this.resolve();
    expect(nodes, `Expected nav item at path ${this.pathStr()} to exist`).toHaveLength(1);
    expect(nodes[0]!.kind).toBe(kind);
  }

  shouldHaveKinds(kinds: string[]): void {
    const nodes = this.resolve();
    const nodeKinds = nodes.map((n) => n.kind).sort();
    const expectedKinds = [...kinds].sort();
    expect(nodeKinds).toEqual(expectedKinds);
  }

  shouldLinkTo(url: string): void {
    const nodes = this.resolve();
    expect(nodes, `Expected nav item at path ${this.pathStr()} to exist`).toHaveLength(1);
    expect(nodes[0]!.url).toBe(url);
  }
}

class NavTester {
  constructor(private navRoot: NavNode[]) {}

  child(label: string, filter?: { kind: string }): NavItemTester {
    return new NavItemTester(this.navRoot, [{ label, kind: filter?.kind }]);
  }
}

class PageTester {
  constructor(
    private url: string,
    private pages: PageViewModel[],
  ) {}

  private resolve(): PageViewModel | null {
    return this.pages.find((p) => p.url === this.url) ?? null;
  }

  private shouldExist(): PageViewModel {
    const page = this.resolve();
    expect(page, `Expected page at URL ${this.url} to exist`).toBeDefined();
    return page!;
  }

  shouldHaveKind(kind: string): void {
    const page = this.shouldExist();
    expect(page.kind).toBe(kind);
  }

  shouldHaveDeclarations(decls: { name: string; kind: string }[]): void {
    const page = this.shouldExist();
    const declsOnPage = page.sections
      .flatMap((s) => s.body)
      .filter((b) => b.kind === "declaration-title")
      .map((b) => ({ name: b.name, kind: b.declarationKind }));
    expect(declsOnPage).toEqual(decls);
  }

  shouldHaveOutline(expected: any): void {
    const page = this.shouldExist();
    const outline = buildOutline(page.sections);
    expect(outline).toMatchObject(expected);
  }

  shouldHaveOutlineSectionTitles(expectedTitles: string[]): void {
    const page = this.shouldExist();
    const outline = buildOutline(page.sections);
    const sectionTitles = outline.map((s) => s.label);
    expect(sectionTitles).toEqual(expectedTitles);
  }

  section(title: string) {
    return new SectionTester({ resolve: () => this.shouldExist() }, title);
  }
}

interface PageResolver {
  resolve(): PageViewModel;
}

interface SectionResolver {
  resolve(): Section[];
}

class SectionTester {
  constructor(
    private pageResolver: PageResolver,
    private title: string,
  ) {}

  private resolver: SectionResolver = {
    resolve: () => {
      return this.pageResolver.resolve().sections.filter((s) => s.title === this.title);
    },
  };

  card(title: string) {
    return new CardTester(this.resolver, title);
  }

  shouldHaveSignature(expected: string) {
    const sections = this.resolver.resolve();
    expect(sections).toHaveLength(1);
    const section = sections[0]!;
    const body = section.body[0];
    expect(body).toMatchObject({ kind: "type-declaration" });
    const type = (body as Extract<SectionBlock, { kind: "type-declaration" }>).type;

    const html = renderToString(
      h(PageContext.Provider, { value: "index.html" }, h(TypeView, { type })),
    );
    const text = convert(html, { preserveNewlines: false, selectors: [{ selector: "a", options: { ignoreHref: true } }] }).trim();
    expect(text).toBe(expected);
  }
}

type Card = Extract<SectionBlock, { kind: "card" }>;
type DeclarationTitle = Extract<SectionBlock, { kind: "declaration-title" }>;

class CardTester {
  constructor(
    private sectionResolver: SectionResolver,
    private title: string,
  ) {}

  private resolveCards(): Card[] {
    return this.sectionResolver
      .resolve()
      .flatMap((s) => s.body)
      .filter((b): b is Card => b.kind === "card")
      .filter(
        (c) =>
          c.sections[0]?.body[0]?.kind === "declaration-title" &&
          c.sections[0].body[0].name === this.title,
      );
  }

  private getDeclarationTitles(): DeclarationTitle[] {
    const cards = this.resolveCards();
    return cards
      .map((c) => c.sections[0]?.body[0])
      .filter((b): b is DeclarationTitle => (b ? b.kind === "declaration-title" : false));
  }

  shouldHaveKind(kind: string): void {
    const decls = this.getDeclarationTitles();
    expect(decls.map((d) => d.declarationKind)).toEqual([kind]);
  }
}

export class SiteViewModelTester {
  constructor(public site: SiteViewModel) {}

  get nav(): NavTester {
    return new NavTester(this.site.navTree);
  }

  page(url: string): PageTester {
    return new PageTester(url, this.site.pages);
  }
}
