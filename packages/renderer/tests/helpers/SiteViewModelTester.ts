import { expect } from "vite-plus/test";
import type { NavNode, SiteViewModel } from "../../src/viewmodel.ts";

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

export class SiteViewModelTester {
  constructor(public site: SiteViewModel) {}

  get nav(): NavTester {
    return new NavTester(this.site.navTree);
  }
}
