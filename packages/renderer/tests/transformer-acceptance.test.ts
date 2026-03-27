import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vite-plus/test";
import { transform } from "../src/transformer.ts";
import type { NavNode, SiteViewModel } from "../src/viewmodel.ts";

class NavItemTester {
  constructor(
    private navRoot: NavNode[],
    private path: string[],
  ) {}

  child(label: string): NavItemTester {
    return new NavItemTester(this.navRoot, [...this.path, label]);
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
    return current.filter((n) => n.label === lastLabel);
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
}

class NavTester {
  constructor(private navRoot: NavNode[]) {}

  child(label: string): NavItemTester {
    return new NavItemTester(this.navRoot, [label]);
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
  test("should have entry points at 1st level", () => {
    tester.nav.child("@apiref-examples/core").shouldHaveKind("module");
    tester.nav.child("@apiref-examples/core/data").shouldHaveKind("module");
    tester.nav.child("@apiref-examples/core/namespaces").shouldHaveKind("module");
  });
  test("should have classes", () => {
    tester.nav.child("@apiref-examples/core").child("ApiError").shouldHaveKind("class");
  });
  test("should support multiple-nature symbols", () => {
    tester.nav
      .child("@apiref-examples/core")
      .child("Something")
      .shouldHaveKinds(["type-alias", "variable"]);
  });
});
