import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Repo-root `/blog` (SEO pack) shadows `public/blog` for `/blog/` in Vite.
 * Force the curated themed files from public/blog when present.
 */
function preferPublicBlog(): Plugin {
  const publicBlog = path.resolve(__dirname, "public/blog");
  return {
    name: "prefer-public-blog",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url || "";
        const pathname = raw.split("?")[0] || "";
        const qs = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";

        const sendPublic = (rel: string) => {
          const file = path.join(publicBlog, rel);
          if (!fs.existsSync(file)) return false;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          fs.createReadStream(file).pipe(res);
          return true;
        };

        if (pathname === "/blog" || pathname === "/blog/") {
          if (sendPublic("index.html")) return;
        }

        if (pathname.startsWith("/blog/") && pathname.endsWith(".html")) {
          const base = path.basename(pathname);
          if (sendPublic(base)) return;
        }

        // Keep querystring intact for non-handled routes
        if (pathname === "/blog" || pathname === "/blog/") {
          req.url = `/blog/index.html${qs}`;
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3030,
  },
  preview: {
    port: 3030,
    allowedHosts: ["www.meow-meow.co.in", ".meow-meow.co.in"],
  },
  build: {
    // Optimize chunk splitting for faster loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React bundle - loaded first
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // UI components bundle
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-switch",
          ],
          // Query and data
          "query-vendor": ["@tanstack/react-query"],
          // Supabase client
          "supabase-vendor": ["@supabase/supabase-js"],
        },
      },
    },
    // Minimize chunk sizes
    chunkSizeWarningLimit: 500,
    // Enable minification with CSS minification
    minify: "esbuild",
    cssMinify: true,
    // Target modern browsers for smaller output
    target: "es2020",
    // Source maps off for production speed
    sourcemap: false,
    // Compress assets
    assetsInlineLimit: 4096,
  },
  // Enable dependency pre-bundling
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "@supabase/supabase-js",
    ],
    // Exclude heavy optional deps from pre-bundling
    exclude: ["face-api.js", "@huggingface/transformers"],
  },
  plugins: [
    preferPublicBlog(),
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: [
        "favicon.ico",
        "icons/*.png",
        "icons/*.webp",
        "meow-meow-logo.png",
        "favicon.png",
        "screenshots/*.png",
        "splash/*.png",
        "robots.txt",
        "llms.txt",
        "sitemap.xml",
        "blog/**/*",
      ],
      manifest: false,
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,webp,jpg,jpeg,gif}"],
      },
      devOptions: {
        enabled: false,
        type: "module",
        navigateFallback: "index.html",
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
