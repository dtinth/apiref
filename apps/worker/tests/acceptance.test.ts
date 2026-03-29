import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { JSONOutput } from "typedoc";
import { afterAll, beforeAll, describe, test } from "vite-plus/test";
import { generate } from "../src/generate.ts";

class DocFileGenerationTester {
  private testDir?: string;
  private cachedDocs = new Map<string, DocFileTester>();
  setup() {
    this.testDir = mkdtempSync(join(tmpdir(), "apiref-test-"));
  }
  teardown() {
    rmSync(this.testDir!, { recursive: true, force: true });
  }
  getTestDir(): string {
    if (!this.testDir) {
      throw new Error("Test directory not set up");
    }
    return this.testDir;
  }
  async docForPackage(pkgName: string) {
    if (this.cachedDocs.has(pkgName)) {
      return this.cachedDocs.get(pkgName);
    }
    const ecosystemTestsRoot = fileURLToPath(
      new URL("../../../packages/ecosystem-tests/node_modules", import.meta.url),
    );
    const pkgPath = join(ecosystemTestsRoot, pkgName);
    const outFile = join(this.getTestDir(), `${pkgName}-doc.json`);
    const result = await generate({
      installedPackagePath: pkgPath,
      outFile,
    });
    const doc = new DocFileTester(JSON.parse(result));
    this.cachedDocs.set(pkgName, doc);
    return doc;
  }
}

class DocFileTester {
  constructor(public reflection: JSONOutput.ProjectReflection) {}
}

const tester = new DocFileGenerationTester();
beforeAll(() => tester.setup());
afterAll(() => tester.teardown());

describe("TypeDoc generation acceptance tests", { tags: ["slow"] }, () => {
  test("visual-storyboard@0.3.0 — Tier 2a source map resolution", async () => {
    const doc = await tester.docForPackage("visual-storyboard");
    console.log(doc?.reflection);
  });

  test("bsearch@2.0.0-next.1 — Tier 2a source map resolution", async () => {
    const doc = await tester.docForPackage("bsearch");
  });
});
