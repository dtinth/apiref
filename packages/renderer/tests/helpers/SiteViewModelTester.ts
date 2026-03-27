import { expect } from "vite-plus/test";
import type { NavNode, SiteViewModel } from "../../src/viewmodel.ts";

class NavItemTester {
  constructor(
    private navRoot: NavNode[],
    private path: string[],
    private kindFilter?: string,
  ) {}

  child(label: string, filter?: { kind: string }): NavItemTester {
    return new NavItemTester(this.navRoot, [...this.path, label], filter?.kind);
  }

  private resolve(): NavNode[] {
    let current: NavNode[] = this.navRoot;

    for (let i = 0; i < this.path.length - 1; i++) {
      const label = this.path[i]!;
      const found = current.find((n) => n.label === label);
      if (!found) return [];
      current = found.children;
    }

    if (this.path.length === 0) return [];

    const lastLabel = this.path[this.path.length - 1]!;
    let nodes = current.filter((n) => n.label === lastLabel);

    if (this.kindFilter) {
      nodes = nodes.filter((n) => n.kind === this.kindFilter);
    }

    return nodes;
  }

  shouldExist(): void {
    const nodes = this.resolve();
    expect(
      nodes.length,
      `Expected nav item at path ${this.path.join(" > ")} to exist`,
    ).toBeGreaterThan(0);
  }

  shouldNotExist(): void {
    const nodes = this.resolve();
    expect(nodes, `Expected nav item at path ${this.path.join(" > ")} to not exist`).toHaveLength(
      0,
    );
  }

  shouldHaveKind(kind: string): void {
    const nodes = this.resolve();
    expect(nodes, `Expected nav item at path ${this.path.join(" > ")} to exist`).toHaveLength(1);
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
    expect(nodes, `Expected nav item at path ${this.path.join(" > ")} to exist`).toHaveLength(1);
    expect(nodes[0]!.url).toBe(url);
  }
}

class NavTester {
  constructor(private navRoot: NavNode[]) {}

  child(label: string, filter?: { kind: string }): NavItemTester {
    return new NavItemTester(this.navRoot, [label], filter?.kind);
  }
}

export class SiteViewModelTester {
  constructor(public site: SiteViewModel) {}

  get nav(): NavTester {
    return new NavTester(this.site.navTree);
  }
}
