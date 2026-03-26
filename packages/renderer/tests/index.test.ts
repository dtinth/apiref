import { expect, test } from "vite-plus/test";
import { transform } from "../src/index.ts";

test("transform is exported", () => {
  expect(typeof transform).toBe("function");
});
