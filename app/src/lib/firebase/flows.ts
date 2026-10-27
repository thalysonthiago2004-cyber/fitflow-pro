import {
  type User,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "@firebase/auth";
import { firebaseCancelLegacy, firebaseLegacySignIn, firebaseLinkLegacy, firebaseSignIn, type FirebaseAuthResult } from "@/app/(auth)/firebase-actions";
import { continueUrl, firebaseAuth } from "./client";
import { firebaseErrorCode, firebaseErrorMessage, isCredentialError } from "./errors";

// Browser flows for Firebase Authentication. Firebase checks the password and
// sends the e-mails; the server actions verify the ID token and open the
// Supabase session. Errors come back as pt-BR messages, never raw codes.

export type FlowResult = FirebaseAuthResult;

const fail = (error: unknown): FlowResult => ({ ok: false, message: firebaseErrorMessage(error) });

export async function signInFlow(email: string, password: string, next: string): Promise<FlowResult> {
  const auth = firebaseAuth();
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    return await firebaseSignIn(await user.getIdToken(), next);
  } catch (error) {
    if (!isCredentialError(error)) return fail(error);
    return migrateLegacyAccount(email, password, next, error);
  }
}

/** First sign-in of an account created before Firebase (see firebaseLegacySignIn). */
async function migrateLegacyAccount(email: string, password: string, next: string, original: unknown): Promise<FlowResult> {
  const legacy = await firebaseLegacySignIn(email, password);
  if (!legacy.ok) return { ok: false, message: legacy.message };
  try {
    const { user } = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
    const linked = await firebaseLinkLegacy(await user.getIdToken(), next);
    if (!linked.ok) {
      await deleteUser(user).catch(() => undefined);
      await firebaseCancelLegacy();
      return linked;
    }
    await sendEmailVerification(user, continueUrl()).catch(() => undefined);
    return linked;
  } catch {
    await firebaseCancelLegacy();
    return fail(original);
  }
}

export async function resendVerification(): Promise<{ ok: boolean; message: string }> {
  const user = firebaseAuth().currentUser;
  if (!user) return { ok: false, message: "Entre novamente para reenviar o e-mail." };
  try {
    await sendEmailVerification(user, continueUrl());
    return { ok: true, message: `Enviamos um novo link de confirmação para ${user.email}.` };
  } catch (error) {
    return { ok: false, message: firebaseErrorMessage(error) };
  }
}

/**
 * Creates the Firebase account (or reuses one left from an interrupted
 * sign-up, when the password matches) and hands it to `link` on the server.
 */
export async function signUpFlow(email: string, password: string, link: (idToken: string) => Promise<FlowResult>): Promise<FlowResult> {
  const auth = firebaseAuth();
  let user: User;
  let created = false;
  try {
    ({ user } = await createUserWithEmailAndPassword(auth, email, password));
    created = true;
  } catch (error) {
    if (firebaseErrorCode(error) !== "auth/email-already-in-use") return fail(error);
    try {
      ({ user } = await signInWithEmailAndPassword(auth, email, password));
    } catch {
      return fail(error);
    }
  }

  const result = await link(await user.getIdToken()).catch((): FlowResult => ({ ok: false, message: firebaseErrorMessage(null) }));
  if (!result.ok) {
    // Do not leave a Firebase account without a FitFlow account behind.
    if (created) await deleteUser(user).catch(() => undefined);
    else await signOut(auth);
    return result;
  }
  if ("verifyEmail" in result && !user.emailVerified) await sendEmailVerification(user, continueUrl()).catch(() => undefined);
  return result;
}

/** Always resolves the same way, whether or not the e-mail has an account. */
export async function passwordResetFlow(email: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await sendPasswordResetEmail(firebaseAuth(), email, continueUrl());
  } catch (error) {
    const code = firebaseErrorCode(error);
    if (code === "auth/too-many-requests" || code === "auth/network-request-failed" || code === "auth/invalid-email") {
      return { ok: false, message: firebaseErrorMessage(error) };
    }
  }
  return { ok: true };
}

/** Confirms the current password; the user stays signed in to Firebase in memory for the next step. */
async function reauthenticate(email: string, password: string): Promise<User> {
  const auth = firebaseAuth();
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, password));
  return user;
}

export async function changePasswordFlow(email: string, currentPassword: string, newPassword: string): Promise<{ ok: true } | { ok: false; message: string; field?: "currentPassword" }> {
  let user: User;
  try {
    user = await reauthenticate(email, currentPassword);
  } catch (error) {
    if (isCredentialError(error)) return { ok: false, field: "currentPassword", message: "Senha atual incorreta." };
    return { ok: false, message: firebaseErrorMessage(error) };
  }
  try {
    await updatePassword(user, newPassword);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: firebaseErrorMessage(error) };
  } finally {
    await signOut(firebaseAuth());
  }
}

/**
 * Deletes the account: password check first, then the FitFlow data (server),
 * then the Firebase login. If the last step fails, the leftover Firebase
 * account has no FitFlow account and is reused by a later sign-up.
 */
export async function deleteAccountFlow(email: string, password: string, deleteData: () => Promise<{ ok: true } | { ok: false; message: string }>) {
  let user: User;
  try {
    user = await reauthenticate(email, password);
  } catch (error) {
    return { ok: false as const, message: isCredentialError(error) ? "Senha incorreta." : firebaseErrorMessage(error) };
  }
  const result = await deleteData();
  if (!result.ok) {
    await signOut(firebaseAuth());
    return result;
  }
  await deleteUser(user).catch(() => undefined);
  return result;
}
