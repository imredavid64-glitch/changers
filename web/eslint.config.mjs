import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Next 16's core-web-vitals preset enables the React Compiler-era lint
      // rules from eslint-plugin-react-hooks 7. All legacy warning sites were
      // migrated: derived state is computed in render, prop/URL-to-state sync
      // uses adjust-during-render or a documented eslint-disable, and the only
      // remaining react-hooks/purity hits are Date.now() timestamps inside event
      // handlers, which React explicitly permits (disabled with justification).
      "react-hooks/purity": "error",
      "react-hooks/set-state-in-effect": "error",
      // Underscore-prefixed parameters document intentionally unused args
      // (e.g. interface params a store implementation doesn't consult).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
