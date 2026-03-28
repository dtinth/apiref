# apiref

Automatically-generated documentation sites for npm packages, powered by [TypeDoc](https://typedoc.org/).

## Publishing documentation

Package must use [trusted publishing](https://docs.npmjs.com/trusted-publishers/) with [provenance](https://docs.npmjs.com/generating-provenance-statements) enabled.

### Source links

To make documentation pages link back to the source code correctly:

- Include source files in the published package:

  ```jsonc
  {
    "files": [
      "dist",
      "src", // <-- include source files in published package
    ],
  }
  ```

- Generate source maps, so that the published JavaScript file includes a source map that points to the original TypeScript source.

  ```ts
  // Example (Vite+)
  // See: https://viteplus.dev/guide/pack
  import { defineConfig } from "vite-plus";

  export default defineConfig({
    pack: {
      sourcemap: true,
    },
  });
  ```

  Alternatively, you can add a `"typedoc"` conditional export in `package.json` that points to the original TypeScript source file. For example:

  ```jsonc
  {
    "exports": {
      ".": {
        "typedoc": "./src/index.ts", // <-- point to original TypeScript source for TypeDoc
        "default": "./dist/index.mjs",
      },
    },
  }
  ```
