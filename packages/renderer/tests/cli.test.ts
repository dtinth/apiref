import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { runCli } from "../src/run-cli.ts";

function fixture(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url));
}

function tempDir(suffix: string): string {
  return join(tmpdir(), `apiref-cli-test-${suffix}-${Date.now()}`);
}

describe("runCli — pw-utilities", () => {
  const out = tempDir("pw");

  test("writes HTML files to output directory", async () => {
    const { pagesWritten } = await runCli({
      input: fixture("pw-utilities"),
      out,
      assetsBase: "https://cdn.example.com/shell@1",
    });
    expect(pagesWritten).toBe(4); // index, main/index, main/LocatorLike, main/stabilize
    expect(existsSync(join(out, "index.html"))).toBe(true);
    expect(existsSync(join(out, "main/index.html"))).toBe(true);
    expect(existsSync(join(out, "main/LocatorLike.html"))).toBe(true);
    expect(existsSync(join(out, "main/stabilize.html"))).toBe(true);
  });

  test("written files contain valid HTML", () => {
    const html = readFileSync(join(out, "index.html"), "utf-8");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  test("--assets-base URL appears in output", () => {
    const html = readFileSync(join(out, "index.html"), "utf-8");
    expect(html).toContain("https://cdn.example.com/shell@1/styles.css");
    expect(html).toContain("https://cdn.example.com/shell@1/shell.js");
  });

  afterAll(() => {
    rmSync(out, { recursive: true });
  });
});

describe("runCli — visual-storyboard (nested paths)", () => {
  const out = tempDir("vs");

  test("creates subdirectories for module paths", async () => {
    await runCli({
      input: fixture("visual-storyboard"),
      out,
      assetsBase: "https://cdn.example.com/shell@1",
      version: "3.0.0",
    });
    expect(existsSync(join(out, "index.html"))).toBe(true);
    expect(existsSync(join(out, "main", "StoryboardWriter.html"))).toBe(true);
    expect(existsSync(join(out, "integrations", "playwright", "PlaywrightStoryboard.html"))).toBe(
      true,
    );
  });

  test("--version override appears in ar-meta", () => {
    const html = readFileSync(join(out, "main", "StoryboardWriter.html"), "utf-8");
    expect(html).toContain('"version":"3.0.0"');
  });

  test("default assets base is used when not specified", async () => {
    const out2 = tempDir("vs-default");
    await runCli({
      input: fixture("pw-utilities"),
      out: out2,
      assetsBase: "https://dtinth.github.io/apiref/assets/",
    });
    const html = readFileSync(join(out2, "index.html"), "utf-8");
    expect(html).toContain("https://dtinth.github.io/apiref/assets/");
    rmSync(out2, { recursive: true });
  });

  afterAll(() => {
    rmSync(out, { recursive: true });
  });
});
