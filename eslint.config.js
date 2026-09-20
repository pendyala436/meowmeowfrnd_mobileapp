import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "dev-dist",
      "android",
      "ios",
      "flutter",
      "twa",
      "electron",
      "supabase/functions/**",
      "coverage",
      "node_modules",
      "src/lib/polyfills.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-this-alias": "error",
      "no-useless-escape": "error",
      "prefer-const": "error",
      "no-empty": "error",
      "no-constant-binary-expression": "error",
      "no-misleading-character-class": "error",
      "no-case-declarations": "error",
    },
  },
  // shadcn/ui + context modules intentionally co-export helpers with components
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/contexts/**/*.{ts,tsx}",
      "src/components/ProtectedRoute.tsx",
      "src/components/SecurityProvider.tsx",
      "src/components/AppBottomTabs.tsx",
      "src/components/PhoneInputWithCode.tsx",
      "src/components/MatchFiltersPanel.tsx",
      "src/pages/CaptchaScreen.tsx",
      "src/components/form.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  // Tests: allow intentional edge-case expressions
  {
    files: ["src/**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "no-constant-binary-expression": "off",
      "no-useless-escape": "off",
      "react-refresh/only-export-components": "off",
    },
  },
);
