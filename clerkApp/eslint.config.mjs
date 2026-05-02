import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["app/api/**/*", "server/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server/integrations",
                "@/server/integrations/*",
                "**/server/integrations",
                "**/server/integrations/*",
              ],
              message:
                "Server integrations may only be imported from app/api route handlers or server-only modules.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
