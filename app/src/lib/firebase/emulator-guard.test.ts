import { UnsecuredJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Emulator tokens are unsigned. They may only be accepted for a "demo-"
// project (emulator-only by Google's rules) and never in Vercel production.

async function verifyWith(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import("./verify")).verifyFirebaseIdToken;
}

function unsigned(projectId: string) {
  return new UnsecuredJWT({ email: "ana@example.com", email_verified: true, auth_time: Math.floor(Date.now() / 1000) })
    .setSubject("emulatorUid1")
    .setIssuer(`https://securetoken.google.com/${projectId}`)
    .setAudience(projectId)
    .setExpirationTime("1h")
    .encode();
}

const EMULATOR = { NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key", NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" };

afterEach(() => vi.unstubAllEnvs());

describe("Firebase emulator tokens", () => {
  it("are accepted for a demo- project outside production", async () => {
    const verify = await verifyWith({ ...EMULATOR, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-fitflow" });
    expect(await verify(unsigned("demo-fitflow"))).toMatchObject({ uid: "emulatorUid1", emailVerified: true });
    expect(await verify(unsigned("demo-other"))).toBeNull();
  });

  it("are rejected for a real project, even with the emulator host set", async () => {
    const verify = await verifyWith({ ...EMULATOR, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "fitflow-pro" });
    expect(await verify(unsigned("fitflow-pro"))).toBeNull();
  });

  it("are rejected in Vercel production", async () => {
    const verify = await verifyWith({ ...EMULATOR, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-fitflow", VERCEL_ENV: "production" });
    expect(await verify(unsigned("demo-fitflow"))).toBeNull();
  });
});
