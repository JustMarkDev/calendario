import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    plugins: ["typescript", "react", "import"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true },
    // server/ is its own package with its own lockfile and tooling.
    ignorePatterns: ["dist/**", ".expo/**", "server/**"],
  },
  fmt: {
    ignorePatterns: ["dist/**", ".expo/**", "server/**"],
  },
});
