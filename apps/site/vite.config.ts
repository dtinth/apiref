import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: "src/elysia-app.ts",
    dts: true,
    sourcemap: true,
    unbundle: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
