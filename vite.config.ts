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
  resolve: {
    alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
