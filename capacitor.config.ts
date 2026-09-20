/**
 * Capacitor Configuration
 *
 * This file configures the native mobile app settings for iOS and Android.
 *
 * SECURITY FEATURES:
 * - Android: FLAG_SECURE enabled to prevent screenshots
 * - iOS: Screenshot detection (cannot prevent on iOS due to OS limitations)
 * - Both: Secure content mode enabled
 */

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Must match Play Store package (TWA upload key / listing)
  appId: "in.co.meowmeow",

  // Display name in app stores
  appName: "Meow Meow Frnd App",

  // Build output directory (bundled into the AAB)
  webDir: "dist",

  // Keep Razorpay / bank checkout pages inside the WebView (do not open Chrome)
  server: {
    allowNavigation: ["razorpay.com", "*.razorpay.com", "razorpay.in", "*.razorpay.in"],
  },

  // iOS-specific configuration
  ios: {
    contentInset: "automatic",
    backgroundColor: "#FF2B85",
    preferredContentMode: "mobile",
    handleApplicationNotifications: true,
  },

  // Android-specific configuration
  android: {
    backgroundColor: "#FF2B85",
    allowMixedContent: true,
    // FLAG_SECURE is enforced natively in MainActivity (see android/ + android-patches/)
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#FF2B85",
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#FF2B85",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
