import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vite-plus/test";
import { transform } from "../src/transformer.ts";
import { SiteViewModelTester } from "./helpers/SiteViewModelTester.ts";

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
  test("Entry points exist at 1st level", () => {
    tester.nav.child("@apiref-examples/core").shouldHaveKind("module");
    tester.nav.child("@apiref-examples/core/data").shouldHaveKind("module");
    tester.nav.child("@apiref-examples/core/utils").shouldHaveKind("module");
    tester.nav.child("@apiref-examples/core/web").shouldHaveKind("module");
  });
  test("Classes are present", () => {
    tester.nav.child("@apiref-examples/core").child("ApiError").shouldHaveKind("class");
  });
  test("Multiple-nature symbols are displayed separately", () => {
    tester.nav
      .child("@apiref-examples/core")
      .child("Something")
      .shouldHaveKinds(["type-alias", "variable"]);
    tester.nav
      .child("@apiref-examples/core")
      .child("Something", { kind: "type-alias" })
      .shouldLinkTo("main/Something.html");
    tester.nav
      .child("@apiref-examples/core")
      .child("Something", { kind: "variable" })
      .shouldLinkTo("main/Something.html");
  });
  test("Namespace + function with same name are handled correctly", () => {
    tester.nav
      .child("@apiref-examples/core")
      .child("createEmitter", { kind: "namespace" })
      .shouldLinkTo("main/createEmitter/index.html");

    // Normally functions would have its own HTML page like "main/createEmitter.html",
    // but since it is combined with the namespace, and since namespace pages can have child pages,
    // the function would "lose" its own page and be rendered in the namespace page.
    // So the link should point to the namespace page.
    tester.nav
      .child("@apiref-examples/core")
      .child("createEmitter", { kind: "function" })
      .shouldLinkTo("main/createEmitter/index.html");
  });
  test("Children of namespace + function should be processed", () => {
    tester.nav
      .child("@apiref-examples/core")
      .child("createEmitter", { kind: "namespace" })
      .child("EventMap", { kind: "interface" })
      .shouldLinkTo("main/createEmitter/EventMap.html");
  });
});

describe("pages", () => {
  test("Multi-nature pages should display multiple kinds", () => {
    tester.page("main/Something.html").shouldHaveKind("multiple");
  });
  test("Function doc should come before namespace", () => {
    tester.page("main/createEmitter/index.html").shouldHaveDeclarations([
      { name: "createEmitter", kind: "function" },
      { name: "createEmitter", kind: "namespace" },
    ]);
  });
  test("Outline should only include sections with ids", () => {
    tester.page("main/Cache.html").shouldHaveOutline([
      {
        label: "Example",
        anchor: "~example",
      },
      {
        label: "Constructors",
        anchor: "~constructors",
        items: [{ label: "constructor", anchor: "constructor" }],
      },
      {
        label: "Methods",
        anchor: "~methods",
        items: [
          { label: "cleanup", anchor: "cleanup" },
          { label: "clear", anchor: "clear" },
          { label: "get (1/2)", anchor: "get-1" },
          { label: "get (2/2)", anchor: "get-2" },
          { label: "set", anchor: "set" },
        ],
      },
    ]);
  });
  test("Section in module page", () => {
    const page = tester.page("main/index.html");
    page.section("Namespaces").card("createEmitter").shouldHaveKind("namespace");
    page.section("Enumerations").card("ErrorCategory").shouldHaveKind("enum");
    page.section("Classes").card("ApiError").shouldHaveKind("class");
    page.section("Interfaces").card("CacheEntry").shouldHaveKind("interface");
    page.section("Interfaces").card("MessageFormatter").shouldHaveKind("interface");
    page.section("Type Aliases").card("AppConfig").shouldHaveKind("type-alias");
    page.section("Variables").card("defaultConfig").shouldHaveKind("variable");
    page.section("Functions").card("createEmitter").shouldHaveKind("function");
  });
  test("Section in class page", () => {
    const page = tester.page("main/Builder.html");
    page.section("Methods").card("build").shouldHaveKind("method");
  });
  test("Index signature should be documented", () => {
    tester.page("main/createEmitter/EventMap.html").shouldHaveOutline([
      {
        label: "Index Signatures",
        anchor: "~index-signatures",
      },
    ]);
  });
  test("Call signatures should be documented on interface pages", () => {
    const page = tester.page("main/MessageFormatter.html");
    page.shouldHaveOutline([
      {
        label: "Call Signatures",
        anchor: "~call-signatures",
        items: [
          { label: "MessageFormatter (1/2)", anchor: "MessageFormatter-1" },
          { label: "MessageFormatter (2/2)", anchor: "MessageFormatter-2" },
        ],
      },
      {
        label: "Properties",
        anchor: "~properties",
        items: [{ label: "defaultPrefix", anchor: "defaultPrefix" }],
      },
    ]);
    page.section("Call Signatures").card("MessageFormatter (1/2)").shouldHaveKind("interface");
    page.section("Call Signatures").card("MessageFormatter (2/2)").shouldHaveKind("interface");
    page.section("Properties").card("defaultPrefix").shouldHaveKind("property");
  });
  test("Function page outline should have correct sections", () => {
    tester
      .page("utils/debounce.html")
      .shouldHaveOutlineSectionTitles([
        "Example",
        "Signature",
        "Type Parameters",
        "Parameters",
        "Returns",
      ]);
  });
});

describe("type rendering", () => {
  test("Top-level union type aliases render as a union type section", () => {
    const page = tester.page("main/Result.html");
    page
      .section("Union Type")
      .shouldHaveTypeList(["{ ok: true; value: T }", "{ ok: false; error: E }"]);
  });
  test("Type aliases with 'typeof' renders correctly", () => {
    const page = tester.page("main/AppConfig.html");
    page.section("Type").shouldHaveSignature("typeof defaultConfig");
  });
  test("Type aliases with template literal renders correctly", () => {
    const page = tester.page("main/SqlQuery.html");
    page.section("Type").shouldHaveSignature("`SELECT ${string} FROM ${string}`");
  });
  test("Signature with type assertions renders correctly", () => {
    const page = tester.page("main/isNumber.html");
    page.section("Signature").shouldHaveSignature("(value: unknown): value is number");
  });
  test("Rest parameter function renders correctly", () => {
    const page = tester.page("main/joinStrings.html");
    page.section("Signature").shouldHaveSignature("(...args: string[]): string");
  });
});

describe("apiref.json", () => {
  test("has correct package metadata", () => {
    expect(tester.apirefJson).toMatchObject({
      package: "@apiref-examples/core",
      version: "1.0.0",
      generatorVersion: 1,
    });
  });

  test("tree is not empty", () => {
    expect(tester.apirefJson.tree.length).toBeGreaterThan(0);
  });

  test("top-level modules are in the tree", () => {
    const moduleNames = tester.apirefJson.tree.map((n) => n.name);
    expect(moduleNames).toContain("@apiref-examples/core");
    expect(moduleNames).toContain("@apiref-examples/core/data");
  });

  test("module has correct kind", () => {
    const coreModule = tester.apirefJson.tree.find((n) => n.name === "@apiref-examples/core");
    expect(coreModule).toMatchObject({
      kind: "module",
      name: "@apiref-examples/core",
    });
  });

  test("tree nodes with members have outline", () => {
    // Cache is a class with methods, should have outline
    const coreModule = tester.apirefJson.tree.find((n) => n.name === "@apiref-examples/core");
    expect(coreModule?.children).toBeDefined();
    const cacheNode = coreModule?.children?.find((n) => n.name === "Cache");
    expect(cacheNode?.outline).toBeDefined();
    expect(cacheNode?.outline?.length).toBeGreaterThan(0);
  });

  test("outline items have correct structure", () => {
    const coreModule = tester.apirefJson.tree.find((n) => n.name === "@apiref-examples/core");
    const cacheNode = coreModule?.children?.find((n) => n.name === "Cache");
    const constructorItem = cacheNode?.outline?.find((item) => item.anchor === "constructor");
    expect(constructorItem).toMatchObject({
      name: "constructor",
      kind: "constructor",
      anchor: "constructor",
    });
  });
});
