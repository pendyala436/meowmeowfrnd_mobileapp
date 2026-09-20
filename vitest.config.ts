import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/constants/**/*.ts",
        "src/services/**/*.ts",
        "src/hooks/useDebounce.ts",
        "src/components/AppBottomTabs.tsx",
        "src/pages/CaptchaScreen.tsx",
        "src/pages/PrivateGroupsScreen.tsx",
      ],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/test/**",
        "src/lib/fonts/**",
        "src/lib/api/types.ts",
        "src/lib/polyfills.ts",
        "src/lib/profile-queries.ts",
        "src/lib/api.ts",
        "src/lib/api/**",
        "src/lib/translation-service.ts",
        "src/lib/content-moderation.ts",
        "src/services/index.ts",
        "src/integrations/**",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
