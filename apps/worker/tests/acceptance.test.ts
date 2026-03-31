import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { JSONOutput } from "typedoc";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
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
      return this.cachedDocs.get(pkgName)!;
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
  get root() {
    return new DocNodeTester(this.reflection);
  }
}

class DocNodeTester {
  constructor(public node: JSONOutput.ProjectReflection | JSONOutput.DeclarationReflection) {}
  child(name: string): DocNodeTester {
    if (!("children" in this.node) || !this.node.children) {
      throw new Error(`Node ${this.node.name} has no children`);
    }
    const child = this.node.children.find((c) => c.name === name);
    if (!child) {
      const names = this.childrenNames.join(", ");
      throw new Error(
        `Node ${this.node.name} has no child named ${name} (available children: ${names})`,
      );
    }
    return new DocNodeTester(child);
  }
  get childrenNames(): string[] {
    if (!("children" in this.node) || !this.node.children) {
      return [];
    }
    return this.node.children.map((c) => c.name);
  }
  get sourceUrls(): string[] {
    if (!("sources" in this.node) || !this.node.sources) {
      return [];
    }
    return this.node.sources.map((s) => s.url).filter((u): u is string => !!u);
  }
  get sourceFileNames(): string[] {
    if (!("sources" in this.node) || !this.node.sources) {
      return [];
    }
    return this.node.sources.map((s) => s.fileName);
  }
}

const tester = new DocFileGenerationTester();
beforeAll(() => tester.setup());
afterAll(() => tester.teardown());

describe("TypeDoc generation acceptance tests", { tags: ["slow"] }, () => {
  test("visual-storyboard", async () => {
    const doc = await tester.docForPackage("visual-storyboard");
    expect(doc.root.childrenNames).toEqual(
      expect.arrayContaining([
        "visual-storyboard",
        "visual-storyboard/integrations/playwright",
        "visual-storyboard/transports/file",
      ]),
    );
    expect(doc.root.child("visual-storyboard").child("StoryboardWriter").sourceUrls).toEqual([
      "https://github.com/dtinth/visual-storyboard/blob/v0.3.6/packages/core/src/writer.ts#L61",
    ]);
  });
  test("bsearch", async () => {
    const doc = await tester.docForPackage("bsearch");
    expect(doc.root.childrenNames).toEqual(expect.arrayContaining(["bsearch"]));
    expect(doc.root.child("bsearch").child("smallestInt").sourceUrls).toEqual([
      "https://github.com/dtinth/bsearch/blob/v2.0.0-next.1/src/index.ts#L13",
    ]);
  });
  test("nested conditional types export", async () => {
    const pkgPath = join(tester.getTestDir(), "conditional-types-export");
    mkdirSync(pkgPath, { recursive: true });
    writeFileSync(
      join(pkgPath, "package.json"),
      JSON.stringify(
        {
          name: "conditional-types-export",
          version: "1.0.0",
          type: "module",
          repository: {
            type: "git",
            url: "https://github.com/example/conditional-types-export.git",
          },
          exports: {
            ".": {
              types: {
                require: "./index.d.cts",
                default: "./index.d.ts",
              },
              default: {
                require: "./index.cjs",
                default: "./index.js",
              },
            },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(pkgPath, "index.d.ts"), "export declare const answer: 42;\n");
    writeFileSync(join(pkgPath, "index.d.cts"), "export declare const answer: 42;\n");
    writeFileSync(join(pkgPath, "index.js"), "export const answer = 42;\n");
    writeFileSync(join(pkgPath, "index.cjs"), "exports.answer = 42;\n");

    const outFile = join(tester.getTestDir(), "conditional-types-export-doc.json");
    const result = await generate({
      installedPackagePath: pkgPath,
      outFile,
    });
    const doc = new DocFileTester(JSON.parse(result));

    expect(doc.root.childrenNames).toEqual(expect.arrayContaining(["conditional-types-export"]));
    const moduleDoc = doc.root.child("conditional-types-export");
    expect(moduleDoc.sourceFileNames).toEqual(["index.d.ts"]);
    expect(moduleDoc.child("answer").node.name).toBe("answer");
  });
});
