import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";
import {
  findSymbolInTree,
  parsePackageUrl,
  redirect,
  resolveSymbolUrl,
  selectVersion,
} from "./redirector.ts";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf-8"));
}

describe("redirector", () => {
  describe("parsePackageUrl", () => {
    test("parses unscoped package without version", () => {
      const result = parsePackageUrl("bsearch/firstElement");
      expect(result).toEqual({
        packageName: "bsearch",
        version: undefined,
        symbolPath: ["firstElement"],
      });
    });

    test("parses unscoped package with version", () => {
      const result = parsePackageUrl("bsearch@2.0.0/firstElement");
      expect(result).toEqual({
        packageName: "bsearch",
        version: "2.0.0",
        symbolPath: ["firstElement"],
      });
    });

    test("parses scoped package without version", () => {
      const result = parsePackageUrl("@scope/pkg/symbol");
      expect(result).toEqual({
        packageName: "@scope/pkg",
        version: undefined,
        symbolPath: ["symbol"],
      });
    });

    test("parses scoped package with version", () => {
      const result = parsePackageUrl("@scope/pkg@1.0.0/symbol");
      expect(result).toEqual({
        packageName: "@scope/pkg",
        version: "1.0.0",
        symbolPath: ["symbol"],
      });
    });

    test("parses symbol path with dots and slashes", () => {
      const result = parsePackageUrl("pkg/a/b.c.d");
      expect(result).toEqual({
        packageName: "pkg",
        version: undefined,
        symbolPath: ["a", "b", "c", "d"],
      });
    });

    test("parses version with @next/@latest/@prerelease", () => {
      const result = parsePackageUrl("pkg@next/symbol");
      expect(result).toEqual({
        packageName: "pkg",
        version: "next",
        symbolPath: ["symbol"],
      });
    });

    test("handles empty symbol path", () => {
      const result = parsePackageUrl("pkg");
      expect(result).toEqual({
        packageName: "pkg",
        version: undefined,
        symbolPath: [],
      });
    });
  });

  describe("findSymbolInTree", () => {
    const tree = [
      {
        name: "bsearch",
        kind: "module",
        url: "main/index.html",
        outline: [
          {
            name: "firstElement",
            kind: "function",
            anchor: "firstElement",
            linkTo: "main/firstElement.html",
          },
          {
            name: "Config",
            kind: "interface",
            anchor: "Config",
            // no linkTo - should use url + anchor
          },
        ],
        children: [
          {
            name: "firstElement",
            kind: "function",
            url: "main/firstElement.html",
          },
          {
            name: "Utils",
            kind: "namespace",
            url: "main/Utils/index.html",
            children: [
              {
                name: "helper",
                kind: "function",
                url: "main/Utils/helper.html",
              },
            ],
          },
        ],
      },
    ];

    test("finds symbol in children", () => {
      const result = findSymbolInTree(tree, ["firstElement"]);
      expect(result).toEqual({
        url: "main/firstElement.html",
      });
    });

    test("finds nested symbol in children", () => {
      const result = findSymbolInTree(tree, ["Utils", "helper"]);
      expect(result).toEqual({
        url: "main/Utils/helper.html",
      });
    });

    test("finds symbol in outline with linkTo", () => {
      const result = findSymbolInTree(tree, ["firstElement"]);
      expect(result?.url).toBe("main/firstElement.html");
    });

    test("finds symbol in outline without linkTo, uses url + anchor", () => {
      const result = findSymbolInTree(tree, ["Config"]);
      expect(result).toEqual({
        url: "main/index.html#Config",
      });
    });

    test("finds top-level module by url segment", () => {
      const result = findSymbolInTree(tree, ["main"]);
      expect(result).toEqual({
        url: "main/index.html",
      });
    });

    test("finds child through top-level module path", () => {
      const result = findSymbolInTree(tree, ["main", "firstElement"]);
      expect(result).toEqual({
        url: "main/firstElement.html",
      });
    });

    test("finds a unique descendant-style match", () => {
      const result = findSymbolInTree(tree, ["main", "helper"]);
      expect(result).toEqual({
        url: "main/Utils/helper.html",
      });
    });

    test("returns undefined for non-existent symbol", () => {
      const result = findSymbolInTree(tree, ["NonExistent"]);
      expect(result).toBeUndefined();
    });

    test("returns undefined for partial match", () => {
      const result = findSymbolInTree(tree, ["Utils", "NonExistent"]);
      expect(result).toBeUndefined();
    });

    test("prefers children over outline", () => {
      // firstElement exists in both children and outline
      const result = findSymbolInTree(tree, ["firstElement"]);
      expect(result?.url).toBe("main/firstElement.html");
    });
  });

  describe("resolveSymbolUrl", () => {
    test("constructs full URL to docs", () => {
      const url = resolveSymbolUrl("bsearch", "2.0.0", "main/firstElement.html");
      expect(url).toBe("https://npm.apiref.page/package/bsearch/v/2.0.0/main/firstElement.html");
    });

    test("constructs full URL with anchor", () => {
      const url = resolveSymbolUrl("bsearch", "2.0.0", "main/index.html#Config");
      expect(url).toBe("https://npm.apiref.page/package/bsearch/v/2.0.0/main/index.html#Config");
    });

    test("handles scoped packages", () => {
      const url = resolveSymbolUrl("@scope/pkg", "1.0.0", "main/Symbol.html");
      expect(url).toBe("https://npm.apiref.page/package/@scope/pkg/v/1.0.0/main/Symbol.html");
    });
  });

  describe("selectVersion", () => {
    const availableVersions = ["1.0.0", "1.1.0", "2.0.0", "2.1.0"];

    test("returns exact match when requested", () => {
      const result = selectVersion("2.0.0", availableVersions);
      expect(result).toBe("2.0.0");
    });

    test("returns highest version when no version specified", () => {
      const result = selectVersion(undefined, availableVersions);
      expect(result).toBe("2.1.0");
    });

    test("returns undefined for unavailable exact version", () => {
      const result = selectVersion("3.0.0", availableVersions);
      expect(result).toBeUndefined();
    });

    test("returns undefined for unavailable exact version (semantic)", () => {
      const result = selectVersion("2.0.1", availableVersions);
      expect(result).toBeUndefined();
    });

    test("handles empty available versions", () => {
      const result = selectVersion(undefined, []);
      expect(result).toBeUndefined();
    });

    test("returns exact match even if not latest", () => {
      const result = selectVersion("1.0.0", availableVersions);
      expect(result).toBe("1.0.0");
    });

    test("prefers release version over prerelease", () => {
      const versions = ["2.0.0-next.1", "2.0.0"];
      const result = selectVersion(undefined, versions);
      expect(result).toBe("2.0.0");
    });

    test("prefers stable over higher prerelease version", () => {
      const versions = ["1.2.5", "1.3.0-0"];
      const result = selectVersion(undefined, versions);
      expect(result).toBe("1.2.5");
    });

    test("picks highest stable when multiple stable versions exist", () => {
      const versions = ["1.2.5", "2.0.0-beta.1", "1.5.0", "2.1.0"];
      const result = selectVersion(undefined, versions);
      expect(result).toBe("2.1.0");
    });

    test("prefers higher prerelease when no stable available", () => {
      const versions = ["2.0.0-next.0", "2.0.0-next.1", "2.0.0-beta.1"];
      const result = selectVersion(undefined, versions);
      expect(result).toBe("2.0.0-next.1");
    });

    test("returns exact prerelease version match", () => {
      const versions = ["2.0.0-next.1", "2.0.0", "2.1.0"];
      const result = selectVersion("2.0.0-next.1", versions);
      expect(result).toBe("2.0.0-next.1");
    });
  });

  describe("redirect interactor", () => {
    test("redirects to symbol in fixture", async () => {
      const apirefJson = loadFixture("bsearch-2.0.0.apiref");
      const result = await redirect("bsearch/firstElement", {
        resolveVersion: async () => "2.0.0",
        getVersions: async () => ["2.0.0"],
        getApirefJson: async () => apirefJson as any,
      });
      expect(result).toEqual({
        kind: "redirect",
        url: "https://npm.apiref.page/package/bsearch/v/2.0.0/main/firstElement.html",
      });
    });

    test("returns error when symbol not found", async () => {
      const apirefJson = loadFixture("bsearch-2.0.0.apiref");
      const result = await redirect("bsearch/nonExistentSymbol", {
        resolveVersion: async () => "2.0.0",
        getVersions: async () => ["2.0.0"],
        getApirefJson: async () => apirefJson as any,
      });
      expect(result.kind).toBe("error");
    });

    test("returns ambiguous outcome with candidate breadcrumbs when symbol path is ambiguous", async () => {
      const apirefJson = {
        package: "pkg",
        version: "2.0.0",
        tree: [
          {
            name: "pkg",
            kind: "module",
            url: "main/index.html",
            children: [
              {
                name: "Alpha",
                kind: "namespace",
                url: "main/Alpha/index.html",
                children: [
                  {
                    name: "helper",
                    kind: "function",
                    url: "main/Alpha/helper.html",
                  },
                ],
              },
              {
                name: "Beta",
                kind: "namespace",
                url: "main/Beta/index.html",
                children: [
                  {
                    name: "helper",
                    kind: "function",
                    url: "main/Beta/helper.html",
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = await redirect("pkg/main/helper", {
        resolveVersion: async () => "2.0.0",
        getVersions: async () => ["2.0.0"],
        getApirefJson: async () => apirefJson,
      });

      expect(result).toEqual({
        kind: "ambiguous",
        reason: "Ambiguous symbol path: main.helper",
        candidates: [
          {
            url: "https://npm.apiref.page/package/pkg/v/2.0.0/main/Alpha/helper.html",
            breadcrumbs: [
              {
                label: "pkg",
                url: "https://npm.apiref.page/package/pkg/v/2.0.0/main/index.html",
              },
              {
                label: "Alpha",
                url: "https://npm.apiref.page/package/pkg/v/2.0.0/main/Alpha/index.html",
              },
              {
                label: "helper",
                url: "https://npm.apiref.page/package/pkg/v/2.0.0/main/Alpha/helper.html",
              },
            ],
          },
          {
            url: "https://npm.apiref.page/package/pkg/v/2.0.0/main/Beta/helper.html",
            breadcrumbs: [
              {
                label: "pkg",
                url: "https://npm.apiref.page/package/pkg/v/2.0.0/main/index.html",
              },
              {
                label: "Beta",
                url: "https://npm.apiref.page/package/pkg/v/2.0.0/main/Beta/index.html",
              },
              {
                label: "helper",
                url: "https://npm.apiref.page/package/pkg/v/2.0.0/main/Beta/helper.html",
              },
            ],
          },
        ],
      });
    });

    test("returns error when version not found (exact match requested)", async () => {
      const result = await redirect("bsearch@3.0.0/firstElement", {
        resolveVersion: async () => {
          throw new Error("Version not found");
        },
        getVersions: async () => ["2.0.0"],
        getApirefJson: async () => {
          throw new Error("Should not be called");
        },
      });
      expect(result.kind).toBe("error");
    });

    test("redirects with no version specified (uses latest)", async () => {
      const apirefJson = loadFixture("bsearch-2.0.0.apiref");
      const result = await redirect("bsearch/firstElement", {
        resolveVersion: async () => "2.0.0",
        getVersions: async () => ["1.0.0", "2.0.0"],
        getApirefJson: async () => apirefJson as any,
      });
      expect(result).toEqual({
        kind: "redirect",
        url: "https://npm.apiref.page/package/bsearch/v/2.0.0/main/firstElement.html",
      });
    });

    test("redirects to index when no symbol specified", async () => {
      const apirefJson = loadFixture("bsearch-2.0.0.apiref");
      const result = await redirect("bsearch", {
        resolveVersion: async () => "2.0.0",
        getVersions: async () => ["2.0.0"],
        getApirefJson: async () => apirefJson as any,
      });
      expect(result).toEqual({
        kind: "redirect",
        url: "https://npm.apiref.page/package/bsearch/v/2.0.0/index.html",
      });
    });

    test("returns error when getVersions fails", async () => {
      const result = await redirect("bsearch/symbol", {
        resolveVersion: async () => {
          throw new Error("Should not be called");
        },
        getVersions: async () => {
          throw new Error("Package not found");
        },
        getApirefJson: async () => {
          throw new Error("Should not be called");
        },
      });
      expect(result.kind).toBe("error");
    });

    test("returns error when getApirefJson fails", async () => {
      const result = await redirect("bsearch/symbol", {
        resolveVersion: async () => "2.0.0",
        getVersions: async () => ["2.0.0"],
        getApirefJson: async () => {
          throw new Error("Failed to fetch apiref.json");
        },
      });
      expect(result.kind).toBe("error");
    });

    test("bsearch acceptance tests", async () => {
      const apirefJson = loadFixture("bsearch-2.0.0.apiref");
      const thePath = (path: string) => {
        return {
          shouldRedirectTo: async (url: string) => {
            const result = await redirect(path, {
              resolveVersion: async () => "2.0.0",
              getVersions: async () => ["2.0.0"],
              getApirefJson: async () => apirefJson as any,
            });
            expect(result.kind).toBe("redirect");
            if (result.kind === "redirect") {
              expect(new URL(result.url).pathname).toBe(url);
            }
          },
        };
      };
      await thePath("bsearch").shouldRedirectTo("/package/bsearch/v/2.0.0/index.html");
      await thePath("bsearch/main").shouldRedirectTo("/package/bsearch/v/2.0.0/main/index.html");
      await thePath("bsearch/firstElement").shouldRedirectTo(
        "/package/bsearch/v/2.0.0/main/firstElement.html",
      );
      await thePath("bsearch/main/firstElement").shouldRedirectTo(
        "/package/bsearch/v/2.0.0/main/firstElement.html",
      );
    });
  });
});
