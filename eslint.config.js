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
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: [
      "src/**/*.{ts,tsx}",
      "*.{ts,tsx}",
      "vite.config.ts",
      "tailwind.config.ts",
      "capacitor.config.ts",
    ],
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
      // Legacy codebase: keep as warnings so verify/CI can gate on real breakage.
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "no-useless-escape": "warn",
      "prefer-const": "warn",
      "no-empty": "warn",
      "no-constant-binary-expression": "warn",
      "no-misleading-character-class": "warn",
      "no-case-declarations": "warn",
    },
  },
);
