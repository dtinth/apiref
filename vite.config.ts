import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  test: {
    tags: [
      {
        name: "slow",
        description: "Slow acceptance tests that require package installation",
        timeout: 120_000,
      },
    ],
  },
});
