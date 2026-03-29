import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { JSONOutput } from "typedoc";
import { describe, expect, test } from "vite-plus/test";
import type { TransformContext } from "../src/transform-context.ts";
import { transform } from "../src/transformer.ts";
import { transformType } from "../src/type-transformer.ts";
import type { PageViewModel, SectionBlock } from "../src/viewmodel.ts";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf-8"));
}

function createTransformContext(): TransformContext {
  return {
    idToUrl: new Map(),
    idToBreadcrumbs: new Map(),
    pkgName: "@apiref-examples/core",
    pkgVersion: "1.0.0",
  };
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
    const section = page?.sections.find((s) => s.body.some((b) => b.kind === "doc"));
    if (section?.body[0]?.kind === "doc") {
      expect(section.body[0].doc.length).toBeGreaterThan(0);
    }
  });

  test("stabilize page has signatures section", () => {
    const page = site.pages.find((p) => p.url === "stabilize.html") as PageViewModel;
    const section = page.sections.find((s) => s.body.some((b) => b.kind === "signatures"));
    expect(section).toBeDefined();
  });

  test("LocatorLike.evaluate resolves to anchor URL", () => {
    // The method should resolve to LocatorLike.html#evaluate
    const section = site.pages
      .find((p) => p.url === "stabilize.html")
      ?.sections.find((s) => s.body.some((b) => b.kind === "signatures"));
    const sigBlock = section?.body.find((b) => b.kind === "signatures");
    // stabilize takes Pick<LocatorLike, "evaluate"> — reference to LocatorLike should resolve
    if (sigBlock?.kind === "signatures") {
      const locatorParam = sigBlock.signatures[0]?.parameters[0];
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
    const section = page?.sections.find(
      (s) => s.title === "Constructors" && s.body.some((b) => b.kind === "card"),
    );
    expect(section).toBeDefined();
  });

  test("StoryboardWriter has methods section", () => {
    const page = site.pages.find((p) => p.url === "index/StoryboardWriter.html");
    const section = page?.sections.find(
      (s) => s.title === "Methods" && s.body.some((b) => b.kind === "card"),
    );
    expect(section).toBeDefined();
    if (section) {
      const cards = section.body.filter((b) => b.kind === "card");
      const names = cards
        .filter((c): c is Extract<SectionBlock, { kind: "card" }> => c.kind === "card")
        .map((c) => {
          const titleBlock = c.sections[0]?.body[0];
          return titleBlock?.kind === "declaration-title" ? titleBlock.name : "?";
        });
      expect(names).toContain("createFrame");
      expect(names).toContain("finalize");
      expect(names).toContain("writeInfo");
    }
  });

  test("StoryboardEvent (TypeAlias) has type-declaration section", () => {
    const page = site.pages.find((p) => p.url === "index/StoryboardEvent.html");
    expect(page?.kind).toBe("type-alias");
    const section = page?.sections.find((s) => s.body.some((b) => b.kind === "type-declaration"));
    expect(section).toBeDefined();
    if (section?.body[0]?.kind === "type-declaration") {
      expect(section.body[0].type.kind).toBe("union");
    }
  });

  test("cross-references resolve to correct URLs", () => {
    // StoryboardWriter constructor takes StoryboardWriterOptions — should resolve
    const page = site.pages.find((p) => p.url === "index/StoryboardWriter.html");
    const ctorSection = page?.sections.find((s) => s.title === "Constructor");
    const ctorCards = ctorSection?.body.filter((b) => b.kind === "card");
    if (ctorCards && ctorCards.length > 0) {
      const ctorCard = ctorCards[0];
      if (ctorCard.kind === "card") {
        const sigSection = ctorCard.sections.find((s) =>
          s.body.some((b) => b.kind === "signatures"),
        );
        const sigBlock = sigSection?.body.find((b) => b.kind === "signatures");
        if (sigBlock?.kind === "signatures") {
          const optionsParam = sigBlock.signatures[0]?.parameters[0];
          expect(optionsParam?.name).toBe("options");
          expect(optionsParam?.type.kind).toBe("reference");
          if (optionsParam?.type.kind === "reference") {
            expect(optionsParam.type.url).toBe("index/StoryboardWriterOptions.html");
          }
        }
      }
    }
  });

  test("nav tree has module nodes with children", () => {
    const modNode = site.navTree.find((n) => n.label === "visual-storyboard");
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

describe("examples renderer fixture", () => {
  const site = transform(loadFixture("examples"), { version: "1.0.0" });

  test("AppConfig type alias preserves typeof query types", () => {
    const page = site.pages.find((p) => p.url === "index/AppConfig.html");
    const typeDeclarationBlock = page?.sections
      .flatMap((section) => section.body)
      .find((block) => block.kind === "type-declaration");
    expect(typeDeclarationBlock).toBeDefined();
    if (typeDeclarationBlock?.kind === "type-declaration") {
      expect(typeDeclarationBlock.type).toEqual({
        kind: "query",
        queryType: {
          kind: "reference",
          name: "defaultConfig",
          url: "index/defaultConfig.html",
          typeArguments: [],
        },
      });
    }
  });

  test("reference cards link to documented targets with breadcrumb labels", () => {
    const page = site.pages.find((p) => p.url === "index/index.html");
    const referencesSection = page?.sections.find(
      (section) =>
        section.title === "References" && section.body.some((block) => block.kind === "card"),
    );
    const authCard = referencesSection?.body.find(
      (block) =>
        block.kind === "card" &&
        block.sections[0]?.body[0]?.kind === "declaration-title" &&
        block.sections[0]?.body[0]?.name === "Auth",
    );

    expect(authCard?.kind).toBe("card");
    if (authCard?.kind === "card") {
      expect(authCard.url).toBe("plugins/index.html");
      const referenceBlock = authCard.sections[1]?.body[0];
      expect(referenceBlock?.kind).toBe("reference-breadcrumbs");
      if (referenceBlock?.kind === "reference-breadcrumbs") {
        expect(referenceBlock.breadcrumbs.map((breadcrumb) => breadcrumb.label)).toEqual([
          "@apiref-examples/core",
          "plugins",
        ]);
      }
    }
  });

  test("nested namespace reference cards resolve to the referenced page", () => {
    const page = site.pages.find((p) => p.url === "data/RecA/RecB/index.html");
    const referencesSection = page?.sections.find(
      (section) =>
        section.title === "References" && section.body.some((block) => block.kind === "card"),
    );
    const recACard = referencesSection?.body.find(
      (block) =>
        block.kind === "card" &&
        block.sections[0]?.body[0]?.kind === "declaration-title" &&
        block.sections[0]?.body[0]?.name === "RecA",
    );

    expect(recACard?.kind).toBe("card");
    if (recACard?.kind === "card") {
      expect(recACard.url).toBe("data/RecA/index.html");
      const referenceBlock = recACard.sections[1]?.body[0];
      expect(referenceBlock?.kind).toBe("reference-breadcrumbs");
      if (referenceBlock?.kind === "reference-breadcrumbs") {
        expect(referenceBlock.breadcrumbs.map((breadcrumb) => breadcrumb.label)).toEqual([
          "@apiref-examples/core",
          "data",
          "RecA",
        ]);
      }
    }
  });

  test("mapped type aliases preserve modifiers and nested types", () => {
    const strictReadonlyPage = site.pages.find((p) => p.url === "index/StrictReadonly.html");
    const strictReadonlyBlock = strictReadonlyPage?.sections
      .flatMap((section) => section.body)
      .find((block) => block.kind === "type-declaration");

    expect(strictReadonlyBlock?.kind).toBe("type-declaration");
    if (strictReadonlyBlock?.kind === "type-declaration") {
      expect(strictReadonlyBlock.type).toEqual({
        kind: "mapped",
        parameter: "Key",
        parameterType: {
          kind: "type-operator",
          operator: "keyof",
          target: { kind: "reference", name: "T", url: null, typeArguments: [] },
        },
        templateType: {
          kind: "indexed-access",
          objectType: { kind: "reference", name: "T", url: null, typeArguments: [] },
          indexType: { kind: "reference", name: "Key", url: null, typeArguments: [] },
        },
        readonlyModifier: "+",
        optionalModifier: "-",
      });
    }

    const changeHandlersPage = site.pages.find((p) => p.url === "index/ChangeHandlers.html");
    const changeHandlersBlock = changeHandlersPage?.sections
      .flatMap((section) => section.body)
      .find((block) => block.kind === "type-declaration");

    expect(changeHandlersBlock?.kind).toBe("type-declaration");
    if (changeHandlersBlock?.kind === "type-declaration") {
      expect(changeHandlersBlock.type.kind).toBe("mapped");
      if (changeHandlersBlock.type.kind === "mapped") {
        expect(changeHandlersBlock.type.optionalModifier).toBe("+");
        expect(changeHandlersBlock.type.readonlyModifier).toBeNull();
        expect(changeHandlersBlock.type.templateType.kind).toBe("reflection");
      }
    }
  });
});

describe("transformType", () => {
  test("preserves mapped types", () => {
    expect(
      transformType(
        {
          type: "mapped",
          parameter: "Key",
          parameterType: {
            type: "typeOperator",
            operator: "keyof",
            target: {
              type: "reference",
              name: "Input",
              target: -1 as JSONOutput.ReflectionId,
            } as JSONOutput.ReferenceType,
          },
          templateType: {
            type: "indexedAccess",
            objectType: {
              type: "reference",
              name: "Input",
              target: -1 as JSONOutput.ReflectionId,
            } as JSONOutput.ReferenceType,
            indexType: {
              type: "reference",
              name: "Key",
              target: -1 as JSONOutput.ReflectionId,
              refersToTypeParameter: true,
            } as JSONOutput.ReferenceType,
          },
          readonlyModifier: "+",
          optionalModifier: "-",
        },
        createTransformContext(),
      ),
    ).toEqual({
      kind: "mapped",
      parameter: "Key",
      parameterType: {
        kind: "type-operator",
        operator: "keyof",
        target: { kind: "reference", name: "Input", url: null, typeArguments: [] },
      },
      templateType: {
        kind: "indexed-access",
        objectType: { kind: "reference", name: "Input", url: null, typeArguments: [] },
        indexType: { kind: "reference", name: "Key", url: null, typeArguments: [] },
      },
      readonlyModifier: "+",
      optionalModifier: "-",
    });
  });
});

// ---------------------------------------------------------------------------
// Member card logic
// ---------------------------------------------------------------------------

describe("member cards", () => {
  const site = transform(loadFixture("pw-utilities"), { version: "1.0.0" });
  const indexPage = site.pages.find((p) => p.url === "index.html");
  const functionsSection = indexPage?.sections.find(
    (s) => s.title === "Functions" && s.body.some((b) => b.kind === "card"),
  );
  const visualStoryboard = transform(loadFixture("visual-storyboard"), { version: "1.0.0" });

  test("members with own page render through subsections when preview content exists", () => {
    if (functionsSection) {
      const stabilizeCard = functionsSection.body.find(
        (b) =>
          b.kind === "card" &&
          b.sections[0]?.body[0]?.kind === "declaration-title" &&
          b.sections[0]?.body[0]?.name === "stabilize",
      );
      if (stabilizeCard?.kind === "card") {
        expect(stabilizeCard.url).toBe("stabilize.html");
        // Check card's inner sections (skip first which is declaration-title)
        const contentSections = stabilizeCard.sections.slice(1);
        const sectionKinds = contentSections.flatMap((s) => s.body.map((b) => b.kind));
        expect(sectionKinds).toContain("doc");
      }
    }
  });

  test("linked member summary subsections strip links", () => {
    if (functionsSection) {
      const memberCard = functionsSection.body.find(
        (b) => b.kind === "card" && b.url !== undefined,
      );
      if (memberCard?.kind === "card") {
        // Look for doc block in the card's sections (skip first which is declaration-title)
        const contentSections = memberCard.sections.slice(1);
        const docBlock = contentSections.flatMap((s) => s.body).find((b) => b.kind === "doc");
        if (docBlock?.kind === "doc") {
          const hasLinks = docBlock.doc.some((node) => node.kind === "link");
          expect(hasLinks).toBe(false);
        }
      }
    }
  });

  test("inline method members expose render-oriented subsections", () => {
    const writerPage = visualStoryboard.pages.find(
      (page) => page.url === "index/StoryboardWriter.html",
    );
    const methodSection = writerPage?.sections.find(
      (section) => section.title === "Methods" && section.body.some((b) => b.kind === "card"),
    );
    if (methodSection) {
      const createFrameCard = methodSection.body.find(
        (b) =>
          b.kind === "card" &&
          b.sections[0]?.body[0]?.kind === "declaration-title" &&
          b.sections[0]?.body[0]?.name === "createFrame",
      );
      if (createFrameCard?.kind === "card") {
        // Skip the first section (which contains declaration-title)
        const contentSections = createFrameCard.sections.slice(1);
        const sectionKinds = contentSections.flatMap((s) => s.body.map((b) => b.kind));
        // Now includes @returns blockTag processing: signatures, doc, parameters (@param), doc (@returns)
        expect(sectionKinds).toEqual(["signatures", "doc", "parameters", "doc"]);
      }
    }
  });

  test("inline property members use a type subsection", () => {
    const optionsPage = visualStoryboard.pages.find(
      (p) => p.url === "index/CreateStoryboardFrameOptions.html",
    );
    const propertiesSection = optionsPage?.sections.find(
      (section) => section.title === "Properties" && section.body.some((b) => b.kind === "card"),
    );
    if (propertiesSection) {
      const viewportCard = propertiesSection.body.find(
        (b) =>
          b.kind === "card" &&
          b.sections[0]?.body[0]?.kind === "declaration-title" &&
          b.sections[0]?.body[0]?.name === "viewport",
      );
      if (viewportCard?.kind === "card") {
        // Look for type-declaration block in card's content sections
        const contentSections = viewportCard.sections.slice(1);
        const typeDeclBlock = contentSections
          .flatMap((s) => s.body)
          .find((b) => b.kind === "type-declaration");
        if (typeDeclBlock?.kind === "type-declaration") {
          expect(typeDeclBlock.name).toBe("viewport");
        }
      }
    }
  });
});
