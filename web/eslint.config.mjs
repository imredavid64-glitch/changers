import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Next 16's core-web-vitals preset enables the React Compiler-era lint
      // rules from eslint-plugin-react-hooks 7. This codebase predates them:
      // `react-hooks/purity` flags legitimate Date.now() timestamp writes inside
      // event handlers (which React explicitly permits), and
      // `react-hooks/set-state-in-effect` flags legacy prop-to-state sync and
      // reset-in-effect patterns. Keep both visible as warnings while they are
      // migrated so they never fail CI on their own.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
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
