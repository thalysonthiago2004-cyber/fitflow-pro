import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Runs against a production build. Placeholder Supabase values are enough for
// public pages and guest redirects; flows that need a real backend are tagged
// @supabase and skipped unless E2E_SUPABASE=1 points at a configured project.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  grepInvert: process.env.E2E_SUPABASE ? undefined : /@supabase/,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: process.env.E2E_SUPABASE
      ? {}
      : {
          NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "placeholder",
          NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
        },
  },
});
