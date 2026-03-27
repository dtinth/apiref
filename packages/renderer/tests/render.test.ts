import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, describe } from "vite-plus/test";
import { transform } from "../src/transformer.ts";
import { renderSite } from "../src/render.tsx";

const SHELL = "https://cdn.example.com/shell@1.0.0";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(new URL(`../../../fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf-8"));
}

function renderFixture(name: string) {
  const site = transform(loadFixture(name), { version: "1.0.0" });
  return renderSite(site, { shellBaseUrl: SHELL });
}

function renderRendererFixture(name: string) {
  const path = fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url));
  const site = transform(JSON.parse(readFileSync(path, "utf-8")), { version: "1.0.0" });
  return renderSite(site, { shellBaseUrl: SHELL });
}

// ---------------------------------------------------------------------------
// pw-utilities
// ---------------------------------------------------------------------------

describe("render pw-utilities", () => {
  const pages = renderFixture("pw-utilities");

  test("produces a page for every URL", () => {
    expect(pages.has("index.html")).toBe(true);
    expect(pages.has("LocatorLike.html")).toBe(true);
    expect(pages.has("stabilize.html")).toBe(true);
  });

  test("index.html is a complete HTML document", () => {
    const html = pages.get("index.html")!;
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  test("index.html contains shell CSS and JS links", () => {
    const html = pages.get("index.html")!;
    expect(html).toContain(`${SHELL}/styles.css`);
    expect(html).toContain(`${SHELL}/shell.js`);
  });

  test("index.html contains ar-meta JSON blob", () => {
    const html = pages.get("index.html")!;
    expect(html).toContain('id="ar-meta"');
    expect(html).toContain('"package":"pw-utilities"');
  });

  test("index.html includes navTree in ar-meta", () => {
    const html = pages.get("index.html")!;
    expect(html).toContain('"navTree"');
  });

  test("stabilize.html has the page title", () => {
    const html = pages.get("stabilize.html")!;
    expect(html).toContain("stabilize");
  });

  test("stabilize.html contains the function description", () => {
    const html = pages.get("stabilize.html")!;
    // Part of the summary text from the fixture
    expect(html).toContain("Scrolls the element into view");
  });

  test("stabilize.html contains ar-declaration--function class", () => {
    const html = pages.get("stabilize.html")!;
    expect(html).toContain("ar-declaration--function");
  });

  test("LocatorLike.html has method section", () => {
    const html = pages.get("LocatorLike.html")!;
    expect(html).toContain("evaluate");
    expect(html).toContain("ar-card");
  });
});

// ---------------------------------------------------------------------------
// visual-storyboard
// ---------------------------------------------------------------------------

describe("render visual-storyboard", () => {
  const pages = renderFixture("visual-storyboard");

  test("produces module and class pages", () => {
    expect(pages.has("index/StoryboardWriter.html")).toBe(true);
    expect(pages.has("index/StoryboardEvent.html")).toBe(true);
    expect(pages.has("integrations/playwright/PlaywrightStoryboard.html")).toBe(true);
  });

  test("StoryboardWriter.html has constructor section", () => {
    const html = pages.get("index/StoryboardWriter.html")!;
    expect(html).toContain("ar-card");
    expect(html).toContain("Constructor");
  });

  test("StoryboardWriter.html has methods section with member list", () => {
    const html = pages.get("index/StoryboardWriter.html")!;
    expect(html).toContain("createFrame");
    expect(html).toContain("finalize");
    expect(html).toContain("writeInfo");
  });

  test("StoryboardEvent.html has type-declaration section", () => {
    const html = pages.get("index/StoryboardEvent.html")!;
    // Type-declaration renders as a union type in the content
    expect(html).toContain("ar-type");
  });

  test("cross-referenced types render as links", () => {
    // StoryboardWriter constructor takes StoryboardWriterOptions — should be a link
    const html = pages.get("index/StoryboardWriter.html")!;
    expect(html).toContain('href="StoryboardWriterOptions.html"');
  });

  test("ar-meta has correct title on class page", () => {
    const html = pages.get("index/StoryboardWriter.html")!;
    expect(html).toContain('"title":"StoryboardWriter"');
  });

  test("ar-meta has breadcrumbs on class page", () => {
    const html = pages.get("index/StoryboardWriter.html")!;
    expect(html).toContain('"breadcrumbs"');
    expect(html).toContain('"label":"index"');
  });
});

// ---------------------------------------------------------------------------
// examples
// ---------------------------------------------------------------------------

describe("render examples", () => {
  const pages = renderRendererFixture("examples");

  test("example code blocks are highlighted with shiki", () => {
    const renderedPages = [...pages.values()];
    expect(renderedPages.some((page) => page.includes('class="shiki catppuccin-mocha"'))).toBe(
      true,
    );
    expect(renderedPages.some((page) => page.includes("<span style="))).toBe(true);
  });

  test("AppConfig renders typeof type aliases", () => {
    const html = pages.get("index/AppConfig.html")!;
    expect(html).toContain("typeof");
    expect(html).toContain('href="defaultConfig.html"');
  });
});
