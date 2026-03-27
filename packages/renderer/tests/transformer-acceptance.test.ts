import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vite-plus/test";
import { transform } from "../src/transformer.ts";
import type { SiteViewModel, NavNode } from "../src/viewmodel.ts";

class NavItemTester {
  constructor(
    private navRoot: NavNode[],
    private path: string[],
  ) {}

  child(label: string): NavItemTester {
    return new NavItemTester(this.navRoot, [...this.path, label]);
  }

  private resolve(): NavNode | null {
    let current: NavNode[] = this.navRoot;
    let lastNode: NavNode | null = null;

    for (const label of this.path) {
      const found = current.find((n) => n.label === label);
      if (!found) return null;
      lastNode = found;
      current = found.children;
    }

    return lastNode;
  }

  shouldExist(): void {
    const node = this.resolve();
    expect(node, `Expected nav item at path ${this.path.join(" > ")} to exist`).toBeDefined();
  }

  shouldNotExist(): void {
    const node = this.resolve();
    expect(node, `Expected nav item at path ${this.path.join(" > ")} to not exist`).toBeNull();
  }

  shouldHaveKind(kind: string): void {
    const node = this.resolve();
    expect(node, `Expected nav item at path ${this.path.join(" > ")} to exist`).toBeDefined();
    expect(node?.kind).toBe(kind);
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
});
