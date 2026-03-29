import { describe, test, expect, beforeEach } from "vite-plus/test";
import { generate } from "../src/generate.ts";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

const ecosystemTestsRoot = fileURLToPath(
  new URL("../../../packages/ecosystem-tests/node_modules", import.meta.url),
);

describe("TypeDoc generation acceptance tests", { tags: ["slow"] }, () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "apiref-acceptance-"));
  });

  test("visual-storyboard@0.3.0 — Tier 2a source map resolution", async () => {
    const vsPath = join(ecosystemTestsRoot, "visual-storyboard");
    const outFile = join(testDir, "vs-doc.json");
    const result = await generate({
      installedPackagePath: vsPath,
      outFile,
    });

    expect(result).toBeDefined();
    const parsed = JSON.parse(result);
    expect(parsed.children).toBeDefined();
    expect(parsed.children.length).toBeGreaterThan(0);
  });

  test("bsearch@2.0.0-next.1 — Tier 2a source map resolution", async () => {
    const bsearchPath = join(ecosystemTestsRoot, "bsearch");
    const outFile = join(testDir, "bsearch-doc.json");
    const result = await generate({
      installedPackagePath: bsearchPath,
      outFile,
    });

    expect(result).toBeDefined();
    const parsed = JSON.parse(result);
    expect(parsed.children).toBeDefined();
    expect(parsed.children.length).toBeGreaterThan(0);
  });
});
