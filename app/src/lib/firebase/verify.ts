import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";
import { firebaseConfig } from "./config";

// Verifies a Firebase Auth ID token without a service account: Google
// publishes the signing keys, and the token must be issued for this project.
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

/** Sign-in must be recent: an old token (even if not expired) cannot open a session. */
const MAX_AUTH_AGE_SECONDS = 10 * 60;

export type FirebaseIdentity = { uid: string; email: string; emailVerified: boolean };

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity | null> {
  const projectId = firebaseConfig.projectId;
  if (!projectId || typeof idToken !== "string" || idToken.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
    });
    const authTime = typeof payload.auth_time === "number" ? payload.auth_time : 0;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.sub || authTime > now + 60 || now - authTime > MAX_AUTH_AGE_SECONDS) return null;
    if (typeof payload.email !== "string" || !payload.email) return null;
    return { uid: payload.sub, email: payload.email.toLowerCase(), emailVerified: payload.email_verified === true };
  } catch {
    return null;
  }
}
