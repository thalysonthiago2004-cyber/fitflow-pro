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

// E2E_FIREBASE=1 runs the journeys through Firebase login, using the local
// Auth emulator (`npx firebase-tools emulators:start --only auth --project
// demo-fitflow`) and the test project's secret key for account linking.
const firebase = process.env.E2E_FIREBASE
  ? (() => {
      if (!process.env.E2E_SUPABASE || !process.env.E2E_SUPABASE_SECRET_KEY) throw new Error("E2E_FIREBASE needs E2E_SUPABASE=1 and E2E_SUPABASE_SECRET_KEY of the test project.");
      return {
        NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-fitflow.firebaseapp.com",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-fitflow",
        NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
        NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: process.env.E2E_FIREBASE_EMULATOR_HOST ?? "127.0.0.1:9099",
        SUPABASE_SECRET_KEY: process.env.E2E_SUPABASE_SECRET_KEY,
        E2E_ALLOW_UNVERIFIED_EMAIL: "1",
      };
    })()
  : {};

// Runs against a production build. Placeholder Supabase values are enough for
// public pages and guest redirects; flows that need a real backend are tagged
// @supabase and skipped unless E2E_SUPABASE=1 points at a configured project.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Full journeys wait on a remote backend (and the Firebase emulator): allow for slow round trips.
  expect: { timeout: process.env.E2E_SUPABASE ? 10_000 : 5_000 },
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
          ...firebase,
        }
      : {
          NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "placeholder",
          NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
        },
  },
});
