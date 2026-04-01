import { describe, expect, test } from "vite-plus/test";
import { extractPackageNameFromSpec } from "../src/generate.ts";

describe("extractPackageNameFromSpec", () => {
  test("keeps unscoped package names without versions", () => {
    expect(extractPackageNameFromSpec("bsearch")).toBe("bsearch");
  });

  test("removes versions from unscoped package specs", () => {
    expect(extractPackageNameFromSpec("bsearch@2.0.0")).toBe("bsearch");
    expect(extractPackageNameFromSpec("bsearch@next")).toBe("bsearch");
  });

  test("keeps scoped package names without versions", () => {
    expect(extractPackageNameFromSpec("@dtinth/comparator")).toBe("@dtinth/comparator");
  });

  test("removes versions from scoped package specs", () => {
    expect(extractPackageNameFromSpec("@dtinth/comparator@1.0.0")).toBe("@dtinth/comparator");
    expect(extractPackageNameFromSpec("@dtinth/comparator@next")).toBe("@dtinth/comparator");
  });
});
