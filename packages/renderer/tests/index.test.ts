import { expect, test } from "vite-plus/test";
import { name } from "../src/index.ts";

test("package name", () => {
  expect(name).toBe("@apiref/renderer");
});
