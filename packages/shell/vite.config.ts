import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: process.env.SHELL_OUT_DIR ?? "dist",
    lib: {
      entry: "./src/index.ts",
      name: "ArShell",
      fileName: "shell",
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        assetFileNames: (info) => (info.name?.endsWith(".css") ? "styles.css" : "[name][extname]"),
      },
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
