// Public Firebase web config (safe to ship to the browser). When it is not
// set (local backend, CI without Firebase), the app falls back to Supabase
// e-mail/password auth so the test environments keep working.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Local Firebase Auth emulator, for automated tests. Honored only with a
// "demo-" project ID (reserved by Google for emulators: no real project can
// have one) and never in the Vercel production environment.
const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? "";
export const firebaseEmulatorHost =
  emulatorHost && firebaseConfig.projectId.startsWith("demo-") && process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" && process.env.VERCEL_ENV !== "production"
    ? emulatorHost
    : "";
