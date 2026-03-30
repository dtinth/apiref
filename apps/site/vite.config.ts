import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
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
