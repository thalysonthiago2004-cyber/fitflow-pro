import { type FirebaseApp, getApps, initializeApp } from "@firebase/app";
import { type Auth, getAuth, inMemoryPersistence, initializeAuth } from "@firebase/auth";
import { firebaseConfig } from "./config";

// Browser-only. Firebase keeps nothing in localStorage/IndexedDB (in-memory
// persistence): it is used just to prove the password and send e-mails. The
// app session itself is the Supabase one, in httpOnly cookies.

let auth: Auth | null = null;

export function firebaseAuth(): Auth {
  if (auth) return auth;
  const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
  try {
    auth = initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    auth = getAuth(app);
  }
  auth.languageCode = "pt-BR";
  return auth;
}

/** Where Firebase e-mail links return to (verification, password reset). */
export function continueUrl(path = "/login") {
  return { url: new URL(path, window.location.origin).href };
}
