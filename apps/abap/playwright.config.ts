import { defineConfig, devices } from "@playwright/test";

const PORT = 5174;
const STATE = ".wrangler/e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Fresh, isolated local D1 for every run. Never touches remote resources.
    command: [
      `rm -rf ${STATE}`,
      `npx wrangler d1 migrations apply governance --local --persist-to ${STATE}`,
      `npm run db:seed-sql`,
      `npx wrangler d1 execute governance --local --persist-to ${STATE} --file=data/seed/seed.sql`,
      `E2E_STATE_DIR=${STATE} npx react-router dev --port ${PORT} --strictPort`,
    ].join(" && "),
    url: `http://localhost:${PORT}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
