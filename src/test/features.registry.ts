/**
 * Product feature registry — every user-facing area must have a test module.
 * features.coverage.test.ts asserts each entry resolves to an existing file.
 */
export interface FeatureEntry {
  id: string;
  name: string;
  testFile: string;
}

export const APP_FEATURES: FeatureEntry[] = [
  // Auth & security
  {
    id: "auth",
    name: "Authentication & captcha gates",
    testFile: "src/components/ProtectedRoute.auth.test.ts",
  },
  {
    id: "captcha",
    name: "Captcha verification screen",
    testFile: "src/pages/CaptchaScreen.test.tsx",
  },
  { id: "routes", name: "App route wiring", testFile: "src/page.routes.test.ts" },

  // Registration
  {
    id: "registration",
    name: "Registration & photo upload validation",
    testFile: "src/lib/validation.test.ts",
  },

  // Dashboard & navigation
  {
    id: "dashboard-nav",
    name: "Dashboard navigation tabs",
    testFile: "src/components/AppBottomTabs.test.tsx",
  },
  {
    id: "private-groups",
    name: "Private groups / group call redirect",
    testFile: "src/pages/PrivateGroupsScreen.test.tsx",
  },
  {
    id: "group-call-ui",
    name: "Group call live/spent display",
    testFile: "src/components/PrivateGroupCallWindow.test.tsx",
  },

  // Calls & realtime
  { id: "calls", name: "Call language rules", testFile: "src/lib/call-languages.test.ts" },
  { id: "ice-servers", name: "WebRTC ICE servers", testFile: "src/lib/iceServers.test.ts" },
  { id: "presence", name: "Online presence", testFile: "src/lib/presence.test.ts" },

  // Billing & wallet
  { id: "billing", name: "Billing & wallet RPC", testFile: "src/services/billing.service.test.ts" },
  {
    id: "ledger-wallet",
    name: "Ledger wallet service",
    testFile: "src/services/ledger-wallet.service.test.ts",
  },

  // Cleanup
  {
    id: "cleanup",
    name: "Session & data cleanup services",
    testFile: "src/services/cleanup.service.test.ts",
  },
  {
    id: "session-cleanup",
    name: "Logout session cleanup",
    testFile: "src/services/session-cleanup.service.test.ts",
  },

  // Matching & chat
  {
    id: "matching",
    name: "Match score calculator",
    testFile: "src/lib/matchScoreCalculator.test.ts",
  },
  { id: "chat-utils", name: "Chat utilities & formatting", testFile: "src/lib/utils.test.ts" },
  {
    id: "chat-attachments",
    name: "Chat attachments",
    testFile: "src/lib/chat-attachments.test.ts",
  },

  // Validation & locale
  { id: "errors", name: "Error classification", testFile: "src/lib/errors.test.ts" },
  {
    id: "india-validation",
    name: "India-only validation",
    testFile: "src/lib/indianValidation.test.ts",
  },
  { id: "constants", name: "App constants & routes", testFile: "src/constants/index.test.ts" },

  // Platform
  { id: "media", name: "Media playback helpers", testFile: "src/lib/media.test.ts" },
  { id: "capabilities", name: "Browser capabilities", testFile: "src/lib/capabilities.test.ts" },
  {
    id: "performance-hooks",
    name: "Debounce / throttle hooks",
    testFile: "src/hooks/useDebounce.test.ts",
  },
  { id: "logger", name: "Logger", testFile: "src/lib/logger.test.ts" },
];
