import { expect, test } from "vite-plus/test";
import { ArShell } from "../src/index.ts";

test("ArShell is a custom element", () => {
  expect(typeof ArShell).toBe("function");
});
