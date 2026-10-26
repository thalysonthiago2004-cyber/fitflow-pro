import { type JWK, type KeyLike, SignJWT, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Google's published keys are replaced by a local key pair; everything else
// (issuer, audience, algorithm, auth_time) is checked exactly as in production.
const keys = await generateKeyPair("RS256");
const otherKeys = await generateKeyPair("RS256");
const jwk: JWK = { ...(await exportJWK(keys.publicKey)), kid: "k1", alg: "RS256" };

vi.mock("jose", async (original) => {
  const jose = await original<typeof import("jose")>();
  return { ...jose, createRemoteJWKSet: () => jose.createLocalJWKSet({ keys: [jwk] }) };
});

const PROJECT = "fitflow-test";
let verify: typeof import("./verify").verifyFirebaseIdToken;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "key");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", PROJECT);
  ({ verifyFirebaseIdToken: verify } = await import("./verify"));
});

const now = () => Math.floor(Date.now() / 1000);

function token(claims: Record<string, unknown> = {}, opts: { key?: KeyLike; iss?: string; aud?: string } = {}) {
  return new SignJWT({ email: "Ana@Example.com", email_verified: true, auth_time: now() - 5, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setSubject("firebaseUid123")
    .setIssuer(opts.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setAudience(opts.aud ?? PROJECT)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(opts.key ?? keys.privateKey);
}

describe("verifyFirebaseIdToken", () => {
  it("accepts a fresh token for this project", async () => {
    expect(await verify(await token())).toEqual({ uid: "firebaseUid123", email: "ana@example.com", emailVerified: true });
    expect((await verify(await token({ email_verified: false })))?.emailVerified).toBe(false);
  });

  it("rejects tokens signed by another key, project or issuer", async () => {
    expect(await verify(await token({}, { key: otherKeys.privateKey }))).toBeNull();
    expect(await verify(await token({}, { aud: "other-project" }))).toBeNull();
    expect(await verify(await token({}, { iss: "https://securetoken.google.com/other-project" }))).toBeNull();
    expect(await verify("not-a-token")).toBeNull();
  });

  it("rejects old sign-ins and tokens without e-mail", async () => {
    expect(await verify(await token({ auth_time: now() - 11 * 60 }))).toBeNull();
    expect(await verify(await token({ auth_time: undefined }))).toBeNull();
    expect(await verify(await token({ email: undefined }))).toBeNull();
  });
});
