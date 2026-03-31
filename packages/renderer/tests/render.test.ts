import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { h } from "preact";
import { render as renderToString } from "preact-render-to-string";
import { describe, expect, test } from "vite-plus/test";
import { PageContext } from "../src/components/PageContext.tsx";
import { TypeView } from "../src/components/TypeView.tsx";
import { renderSite } from "../src/render.tsx";
import { transform } from "../src/transformer.ts";
import type { TypeViewModel } from "../src/viewmodel.ts";

const SHELL = "https://cdn.example.com/shell@1.0.0";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url));
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

function renderType(type: TypeViewModel) {
  return renderToString(h(PageContext.Provider, { value: "index.html" }, h(TypeView, { type })));
}

// ---------------------------------------------------------------------------
// pw-utilities
// ---------------------------------------------------------------------------

describe("render pw-utilities", () => {
  const pages = renderFixture("pw-utilities");

  test("produces a page for every URL", () => {
    expect(pages.has("index.html")).toBe(true);
    expect(pages.has("main/LocatorLike.html")).toBe(true);
    expect(pages.has("main/stabilize.html")).toBe(true);
  });

  test("index.html is a complete HTML document", () => {
    const html = pages.get("index.html")!;
    expect(html).toContain("<!doctype html>");
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
    const html = pages.get("main/stabilize.html")!;
    expect(html).toContain("stabilize");
  });

  test("stabilize.html contains the function description", () => {
    const html = pages.get("main/stabilize.html")!;
    // Part of the summary text from the fixture
    expect(html).toContain("Scrolls the element into view");
  });

  test("stabilize.html contains ar-declaration--function class", () => {
    const html = pages.get("main/stabilize.html")!;
    expect(html).toContain("ar-declaration--function");
  });

  test("stabilize.html does not have a source link button for .d.mts files", () => {
    const html = pages.get("main/stabilize.html")!;
    // Type definition files (.d.ts, .d.mts) should not have source links
    expect(html).not.toContain('class="ar-source-link"');
    expect(html).not.toContain(
      'href="https://github.com/dtinth/pw-utilities/blob/v0.1.2/dist/index.d.mts#L14"',
    );
  });

  test("LocatorLike.html has method section", () => {
    const html = pages.get("main/LocatorLike.html")!;
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
    expect(pages.has("main/StoryboardWriter.html")).toBe(true);
    expect(pages.has("main/StoryboardEvent.html")).toBe(true);
    expect(pages.has("integrations/playwright/PlaywrightStoryboard.html")).toBe(true);
  });

  test("StoryboardWriter.html has constructor section", () => {
    const html = pages.get("main/StoryboardWriter.html")!;
    expect(html).toContain("ar-card");
    expect(html).toContain("Constructor");
  });

  test("StoryboardWriter.html has methods section with member list", () => {
    const html = pages.get("main/StoryboardWriter.html")!;
    expect(html).toContain("createFrame");
    expect(html).toContain("finalize");
    expect(html).toContain("writeInfo");
  });

  test("StoryboardWriter.html shows source links on member cards", () => {
    const html = pages.get("main/StoryboardWriter.html")!;
    expect(html).toContain('id="constructor" class="ar-card"');
    expect(html).toContain(
      'href="https://github.com/dtinth/visual-storyboard/blob/v0.3.6/packages/core/src/writer.ts#L66"',
    );
  });

  test("StoryboardEvent.html has type-declaration section", () => {
    const html = pages.get("main/StoryboardEvent.html")!;
    // Type-declaration renders as a union type in the content
    expect(html).toContain("ar-type");
  });

  test("cross-referenced types render as links", () => {
    // StoryboardWriter constructor takes StoryboardWriterOptions — should be a link
    const html = pages.get("main/StoryboardWriter.html")!;
    expect(html).toContain('href="StoryboardWriterOptions.html"');
  });

  test("ar-meta has correct title on class page", () => {
    const html = pages.get("main/StoryboardWriter.html")!;
    expect(html).toContain('"title":"StoryboardWriter"');
  });

  test("ar-meta has breadcrumbs on class page", () => {
    const html = pages.get("main/StoryboardWriter.html")!;
    expect(html).toContain('"breadcrumbs"');
    expect(html).toContain('"label":"(main)"');
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
    const html = pages.get("main/AppConfig.html")!;
    expect(html).toContain("typeof");
    expect(html).toContain('href="defaultConfig.html"');
  });

  test("mapped type aliases render mapped syntax", () => {
    const strictReadonlyHtml = pages.get("main/StrictReadonly.html")!;
    expect(strictReadonlyHtml).toContain("+readonly ");
    expect(strictReadonlyHtml).toContain("[Key");
    expect(strictReadonlyHtml).toContain(" in ");
    expect(strictReadonlyHtml).toContain("-?");

    const changeHandlersHtml = pages.get("main/ChangeHandlers.html")!;
    expect(changeHandlersHtml).toContain("[Key");
    expect(changeHandlersHtml).toContain("+?");
    expect(changeHandlersHtml).toContain("ar-type-ref ar-type-ref--external");
  });

  test("renders breadcrumbs above the declaration title", () => {
    const html = pages.get("plugins/LoggingPlugin/File/FileLogger.html")!;
    const breadcrumbIndex = html.indexOf('class="ar-breadcrumbs"');
    const titleIndex = html.indexOf('class="ar-declaration-title"');

    expect(breadcrumbIndex).toBeGreaterThan(-1);
    expect(titleIndex).toBeGreaterThan(breadcrumbIndex);
    expect(html).toContain(">@apiref-examples/core<");
    expect(html).toContain(">plugins<");
    expect(html).toContain(">LoggingPlugin<");
    expect(html).toContain(">File<");
    expect(html).toContain("> » <");
  });

  test("reference cards link to the referenced target page with breadcrumb text", () => {
    const html = pages.get("main/index.html")!;
    expect(html).toContain('href="../plugins/index.html"');
    expect(html).toContain("References");
    expect(html).toContain(">plugins<");
  });

  test("nested reference cards link to the referenced namespace page", () => {
    const html = pages.get("data/RecA/RecB/index.html")!;
    expect(html).toContain('href="../index.html"');
    expect(html).toContain(">References <");
    expect(html).toContain(">RecA<");
  });
});

describe("TypeView", () => {
  test("renders mapped types", () => {
    expect(
      renderType({
        kind: "mapped",
        parameter: "Key",
        parameterType: {
          kind: "type-operator",
          operator: "keyof",
          target: { kind: "reference", name: "Input", url: "index/Input.html", typeArguments: [] },
        },
        templateType: {
          kind: "indexed-access",
          objectType: {
            kind: "reference",
            name: "Input",
            url: "index/Input.html",
            typeArguments: [],
          },
          indexType: { kind: "reference", name: "Key", url: null, typeArguments: [] },
        },
        readonlyModifier: "+",
        optionalModifier: "-",
      }),
    ).toContain('{ <span class="ar-type-keyword">+readonly </span>[Key');
  });
});
