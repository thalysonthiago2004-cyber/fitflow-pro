import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Full journeys create accounts and data, so they run only against a test
// project given explicitly (E2E_SUPABASE_URL / E2E_SUPABASE_KEY) and never
// against production, whatever .env.local says.
const PRODUCTION_REF = "ntpzjmqypavdkirfilyd";
const e2eUrl = process.env.E2E_SUPABASE_URL ?? "";
if (process.env.E2E_SUPABASE) {
  if (!e2eUrl || !process.env.E2E_SUPABASE_KEY) throw new Error("E2E_SUPABASE needs E2E_SUPABASE_URL and E2E_SUPABASE_KEY of a test project.");
  if (e2eUrl.includes(PRODUCTION_REF)) throw new Error("Refusing to run the full journeys against the production Supabase project.");
}

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
    // A running server could point at another backend; always start a fresh one for full journeys.
    reuseExistingServer: !process.env.CI && !process.env.E2E_SUPABASE,
    timeout: 240_000,
    env: process.env.E2E_SUPABASE
      ? {
          NEXT_PUBLIC_SUPABASE_URL: e2eUrl,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_KEY!,
          NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
        }
      : {
          NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "placeholder",
          NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
        },
  },
});
