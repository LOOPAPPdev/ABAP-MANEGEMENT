import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      // E2E runs use an isolated local state directory (see playwright.config.ts).
      persistState: process.env.E2E_STATE_DIR ? { path: process.env.E2E_STATE_DIR } : true,
    }),
    tailwindcss(),
    reactRouter(),
  ],
  // Pre-bundle client dependencies. Without this, Vite discovers them on the first page visit,
  // re-optimizes and invalidates loaded modules, so the first page never hydrates (cold cache, e.g. CI).
  optimizeDeps: {
    include: [
      // React Router's default client entry lives in node_modules, so Vite's scanner misses these.
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom",
      "react-dom/client",
      "react-router",
      "react-router/dom",
      "lucide-react",
      "react-resizable-panels",
      "@radix-ui/react-slot",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-separator",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
      "zod",
    ],
  },
  resolve: {
    alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
