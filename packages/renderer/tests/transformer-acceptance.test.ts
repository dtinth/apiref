import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, test } from "vite-plus/test";
import { transform } from "../src/transformer.ts";
import { SiteViewModelTester } from "./helpers/SiteViewModelTester.ts";

function createTester(): SiteViewModelTester {
  const path = fileURLToPath(
    new URL(`../fixtures/examples.json`, import.meta.url),
  );
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
    tester.nav
      .child("@apiref-examples/core/namespaces")
      .shouldHaveKind("module");
  });
  test("Classes are present", () => {
    tester.nav
      .child("@apiref-examples/core")
      .child("ApiError")
      .shouldHaveKind("class");
  });
  test("Multiple-nature symbols are displayed separately", () => {
    tester.nav
      .child("@apiref-examples/core")
      .child("Something")
      .shouldHaveKinds(["type-alias", "variable"]);
    tester.nav
      .child("@apiref-examples/core")
      .child("Something", { kind: "type-alias" })
      .shouldLinkTo("index/Something.html");
    tester.nav
      .child("@apiref-examples/core")
      .child("Something", { kind: "variable" })
      .shouldLinkTo("index/Something.html");
  });
  test("Namespace + function with same name are handled correctly", () => {
    tester.nav
      .child("@apiref-examples/core")
      .child("createEmitter", { kind: "namespace" })
      .shouldLinkTo("index/createEmitter/index.html");

    // Normally functions would have its own HTML page like "index/createEmitter.html",
    // but since it is combined with the namespace, and since namespace pages can have child pages,
    // the function would "lose" its own page and be rendered in the namespace page.
    // So the link should point to the namespace page.
    tester.nav
      .child("@apiref-examples/core")
      .child("createEmitter", { kind: "function" })
      .shouldLinkTo("index/createEmitter/index.html");
  });
});

describe("pages", () => {
  test("Multi-nature pages should display multiple kinds", () => {
    tester.page("index/Something.html").shouldHaveKind("multiple");
  });
  test("Function doc should come before namespace", () => {
    tester.page("index/createEmitter/index.html").shouldHaveDeclarations([
      { name: "createEmitter", kind: "function" },
      { name: "createEmitter", kind: "namespace" },
    ]);
  });
  test("Outline should only include sections with ids", () => {
    tester.page("index/Cache.html").shouldHaveOutline([
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
});
