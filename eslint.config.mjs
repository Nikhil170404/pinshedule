import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The Pinterest sign-in start is an API route that redirects off-site. It must be a plain <a>:
      // a client-side <Link> would fetch it with RSC headers and the cross-site redirect is blocked by CORS.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The worker is a separate package with its own typecheck/tests.
    "worker/**",
  ]),
]);

export default eslintConfig;
