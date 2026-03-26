import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, describe } from "vite-plus/test";
import { transform } from "../src/transformer.ts";
import type { PageViewModel } from "../src/viewmodel.ts";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(new URL(`../../../fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf-8"));
}

// ---------------------------------------------------------------------------
// Schema version guard
// ---------------------------------------------------------------------------

test("throws on unsupported schema version", () => {
  expect(() =>
    transform({ schemaVersion: "1.0", id: 0, name: "x", variant: "project", kind: 1, flags: {} }),
  ).toThrow("Unsupported TypeDoc schema version: 1.0");
});

// ---------------------------------------------------------------------------
// pw-utilities — single-entry-point package
// ---------------------------------------------------------------------------

describe("pw-utilities (single-entry-point)", () => {
  const site = transform(loadFixture("pw-utilities"), { version: "1.0.0" });

  test("package metadata", () => {
    expect(site.package).toEqual({ name: "pw-utilities", version: "1.0.0" });
  });

  test("page URLs", () => {
    const urls = site.pages.map((p) => p.url);
    expect(urls).toContain("index.html");
    expect(urls).toContain("LocatorLike.html");
    expect(urls).toContain("stabilize.html");
  });

  test("index page kind is package-index", () => {
    const index = site.pages.find((p) => p.url === "index.html");
    expect(index?.kind).toBe("package-index");
  });

  test("LocatorLike page kind is interface", () => {
    const page = site.pages.find((p) => p.url === "LocatorLike.html");
    expect(page?.kind).toBe("interface");
  });

  test("stabilize page kind is function", () => {
    const page = site.pages.find((p) => p.url === "stabilize.html");
    expect(page?.kind).toBe("function");
  });

  test("stabilize page has summary doc", () => {
    const page = site.pages.find((p) => p.url === "stabilize.html");
    const summary = page?.sections.find((s) => s.kind === "summary");
    expect(summary).toBeDefined();
    if (summary?.kind === "summary") {
      expect(summary.doc.length).toBeGreaterThan(0);
    }
  });

  test("stabilize page has signatures section", () => {
    const page = site.pages.find((p) => p.url === "stabilize.html") as PageViewModel;
    const sig = page.sections.find((s) => s.kind === "signatures");
    expect(sig).toBeDefined();
  });

  test("LocatorLike.evaluate resolves to anchor URL", () => {
    // The method should resolve to LocatorLike.html#evaluate
    const refType = site.pages
      .find((p) => p.url === "stabilize.html")
      ?.sections.find((s) => s.kind === "signatures");
    // stabilize takes Pick<LocatorLike, "evaluate"> — reference to LocatorLike should resolve
    if (refType?.kind === "signatures") {
      const locatorParam = refType.signatures[0]?.parameters[0];
      expect(locatorParam?.name).toBe("locator");
      // Pick<LocatorLike, "evaluate"> — the LocatorLike reference should have a URL
      if (locatorParam?.type.kind === "reference") {
        // LocatorLike is wrapped in Pick so we check typeArguments
        const arg0 = locatorParam.type.typeArguments[0];
        expect(arg0?.kind).toBe("reference");
        if (arg0?.kind === "reference") {
          expect(arg0.url).toBe("LocatorLike.html");
        }
      }
    }
  });

  test("nav tree has top-level entries", () => {
    expect(site.navTree.length).toBeGreaterThan(0);
    const labels = site.navTree.map((n) => n.label);
    expect(labels).toContain("LocatorLike");
    expect(labels).toContain("stabilize");
  });
});

// ---------------------------------------------------------------------------
// visual-storyboard — multi-module package
// ---------------------------------------------------------------------------

describe("visual-storyboard (multi-module)", () => {
  const site = transform(loadFixture("visual-storyboard"), { version: "2.0.0" });

  test("package metadata", () => {
    expect(site.package).toEqual({ name: "visual-storyboard", version: "2.0.0" });
  });

  test("page URLs include module index pages", () => {
    const urls = site.pages.map((p) => p.url);
    expect(urls).toContain("index.html");
    expect(urls).toContain("index/index.html");
    expect(urls).toContain("integrations/playwright/index.html");
    expect(urls).toContain("transports/file/index.html");
  });

  test("page URLs include class pages", () => {
    const urls = site.pages.map((p) => p.url);
    expect(urls).toContain("index/StoryboardWriter.html");
    expect(urls).toContain("integrations/playwright/PlaywrightStoryboard.html");
    expect(urls).toContain("transports/file/FileTransport.html");
  });

  test("page URLs include interface and type-alias pages", () => {
    const urls = site.pages.map((p) => p.url);
    expect(urls).toContain("index/StoryboardEvent.html"); // TypeAlias
    expect(urls).toContain("index/StoryboardOutputTransport.html"); // Interface
  });

  test("module index page kind is module", () => {
    const page = site.pages.find((p) => p.url === "index/index.html");
    expect(page?.kind).toBe("module");
  });

  test("StoryboardWriter page kind is class", () => {
    const page = site.pages.find((p) => p.url === "index/StoryboardWriter.html");
    expect(page?.kind).toBe("class");
  });

  test("StoryboardWriter has constructor section", () => {
    const page = site.pages.find((p) => p.url === "index/StoryboardWriter.html");
    const ctor = page?.sections.find((s) => s.kind === "constructor");
    expect(ctor).toBeDefined();
  });

  test("StoryboardWriter has methods section", () => {
    const page = site.pages.find((p) => p.url === "index/StoryboardWriter.html");
    const methods = page?.sections.find((s) => s.kind === "members" && s.label === "Methods");
    expect(methods).toBeDefined();
    if (methods?.kind === "members") {
      const names = methods.members.map((m) => m.name);
      expect(names).toContain("createFrame");
      expect(names).toContain("finalize");
      expect(names).toContain("writeInfo");
    }
  });

  test("StoryboardEvent (TypeAlias) has type-declaration section", () => {
    const page = site.pages.find((p) => p.url === "index/StoryboardEvent.html");
    expect(page?.kind).toBe("type-alias");
    const typeDecl = page?.sections.find((s) => s.kind === "type-declaration");
    expect(typeDecl).toBeDefined();
    if (typeDecl?.kind === "type-declaration") {
      expect(typeDecl.type.kind).toBe("union");
    }
  });

  test("cross-references resolve to correct URLs", () => {
    // StoryboardWriter constructor takes StoryboardWriterOptions — should resolve
    const page = site.pages.find((p) => p.url === "index/StoryboardWriter.html");
    const ctor = page?.sections.find((s) => s.kind === "constructor");
    if (ctor?.kind === "constructor") {
      const optionsParam = ctor.signatures[0]?.parameters[0];
      expect(optionsParam?.name).toBe("options");
      expect(optionsParam?.type.kind).toBe("reference");
      if (optionsParam?.type.kind === "reference") {
        expect(optionsParam.type.url).toBe("index/StoryboardWriterOptions.html");
      }
    }
  });

  test("nav tree has module nodes with children", () => {
    const modNode = site.navTree.find((n) => n.label === "index");
    expect(modNode).toBeDefined();
    expect(modNode?.children.length).toBeGreaterThan(0);
    const childLabels = modNode?.children.map((c) => c.label) ?? [];
    expect(childLabels).toContain("StoryboardWriter");
  });

  test("breadcrumbs on class page reference module", () => {
    const page = site.pages.find((p) => p.url === "index/StoryboardWriter.html");
    expect(page?.breadcrumbs.some((b) => b.label === "index")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Member card logic
// ---------------------------------------------------------------------------

describe("member cards", () => {
  const site = transform(loadFixture("pw-utilities"), { version: "1.0.0" });
  const indexPage = site.pages.find((p) => p.url === "index.html");
  const functionsSection = indexPage?.sections.find(
    (s) => s.kind === "members" && s.label === "Functions",
  );
  const visualStoryboard = transform(loadFixture("visual-storyboard"), { version: "1.0.0" });

  test("members with own page render through subsections when preview content exists", () => {
    if (functionsSection?.kind === "members") {
      const stabilize = functionsSection.members.find((member) => member.name === "stabilize");
      expect(stabilize?.url).toBe("stabilize.html");
      expect(stabilize?.kind).toBe("function");
      expect(stabilize?.subsections.map((section) => section.kind)).toEqual(["summary"]);
    }
  });

  test("linked member summary subsections strip links", () => {
    if (functionsSection?.kind === "members") {
      const member = functionsSection.members.find((m) => m.url);
      const summary = member?.subsections.find((section) => section.kind === "summary");
      if (summary?.kind === "summary") {
        const hasLinks = summary.doc.some((node) => node.kind === "link");
        expect(hasLinks).toBe(false);
      }
    }
  });

  test("inline method members expose render-oriented subsections", () => {
    const writerPage = visualStoryboard.pages.find(
      (page) => page.url === "index/StoryboardWriter.html",
    );
    const writerMethods = writerPage?.sections.find(
      (section) => section.kind === "members" && section.label === "Methods",
    );
    if (writerMethods?.kind === "members") {
      const createFrame = writerMethods.members.find((member) => member.name === "createFrame");
      expect(createFrame?.kind).toBe("method");
      expect(createFrame?.title).toBe("createFrame()");
      expect(createFrame?.subsections.map((section) => section.kind)).toEqual([
        "signatures",
        "summary",
        "parameters",
      ]);
    }
  });

  test("inline property members use a type subsection", () => {
    const optionsPage = visualStoryboard.pages.find(
      (p) => p.url === "index/CreateStoryboardFrameOptions.html",
    );
    const propertiesSection = optionsPage?.sections.find(
      (section) => section.kind === "members" && section.label === "Properties",
    );
    if (propertiesSection?.kind === "members") {
      const viewport = propertiesSection.members.find((member) => member.name === "viewport");
      expect(viewport?.kind).toBe("property");
      expect(viewport?.subsections[0]).toMatchObject({
        kind: "type-declaration",
        name: "viewport",
      });
    }
  });
});
