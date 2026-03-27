import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vite-plus/test";
import { transform } from "../src/transformer.ts";
import type { NavNode, SiteViewModel } from "../src/viewmodel.ts";

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

class SiteViewModelTester {
  constructor(public site: SiteViewModel) {}

  get nav(): NavTester {
    return new NavTester(this.site.navTree);
  }
}

function createTester(): SiteViewModelTester {
  const path = fileURLToPath(new URL(`../fixtures/examples.json`, import.meta.url));
  const typedocJson = JSON.parse(readFileSync(path, "utf-8"));
  const site = transform(typedocJson, { version: "1.0.0" });
  return new SiteViewModelTester(site);
}

let tester: SiteViewModelTester;
beforeAll(() => {
  tester = createTester();
});

describe("nav", () => {
  test("Entry points exist at 1st level", () => {
    tester.nav.child("@apiref-examples/core").shouldHaveKind("module");
    tester.nav.child("@apiref-examples/core/data").shouldHaveKind("module");
    tester.nav.child("@apiref-examples/core/namespaces").shouldHaveKind("module");
  });
  test("Classes are present", () => {
    tester.nav.child("@apiref-examples/core").child("ApiError").shouldHaveKind("class");
  });
  test("Multiple-nature symbols are displayed separately", () => {
    tester.nav
      .child("@apiref-examples/core")
      .child("Something")
      .shouldHaveKinds(["type-alias", "variable"]);
  });
  test("Namespace + function with same name are handled correctly", () => {
    tester.nav
      .child("@apiref-examples/core")
      .child("createEmitter", { kind: "namespace" })
      .shouldLinkTo("index/createEmitter/index.html");

    // Normally functions would have its own HTML page like "index/createEmitter.html",
    // but since it is combined with the namespace, and since namespace pages can have child pages,
    // the function would "lose" its own page and be rendered in the namespace page.
    // So the link should point to the namespace page.
    tester.nav
      .child("@apiref-examples/core")
      .child("createEmitter", { kind: "function" })
      .shouldLinkTo("index/createEmitter/index.html");
  });
});
