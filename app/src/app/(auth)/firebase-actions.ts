"use server";

import { randomBytes } from "node:crypto";
import { isBetaSignupClosed } from "@/lib/auth/beta";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { authErrorMessage } from "@/lib/auth/errors";
import { fullNameSchema, loginSchema } from "@/lib/auth/schemas";
import { type FirebaseIdentity, verifyFirebaseIdToken } from "@/lib/firebase/verify";
import { LEGAL_VERSION } from "@/lib/legal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Firebase Authentication proves who the person is (password, verified
// e-mail); these actions then open the Supabase session for the linked
// account, so database access keeps going through RLS on auth.uid().
// Every input is re-checked here: the browser only supplies a signed ID token.

export type FirebaseAuthResult =
  | { ok: true; redirectTo: string }
  | { ok: true; verifyEmail: true; email: string }
  | { ok: false; message: string; field?: "fullName" | "betaCode" | "acceptTerms" | "acceptHealth"; unverified?: boolean };

const SESSION_FAILED = "Não foi possível entrar agora. Tente novamente em instantes.";

/** Only for automated test runs against the test project; never in production. */
function verifiedOrTestBypass(identity: FirebaseIdentity): boolean {
  return identity.emailVerified || (process.env.E2E_ALLOW_UNVERIFIED_EMAIL === "1" && process.env.VERCEL_ENV !== "production");
}

type Admin = ReturnType<typeof createAdminClient>;

/** The Supabase user linked to this Firebase account, linking an existing account by verified e-mail. */
async function linkedUser(admin: Admin, identity: FirebaseIdentity): Promise<{ id: string } | { conflict: true } | null> {
  const { data: linked } = await admin.from("profiles").select("id").eq("firebase_uid", identity.uid).maybeSingle();
  if (linked) return { id: linked.id };
  const { data: byEmail } = await admin.rpc("find_auth_user_by_email", { p_email: identity.email });
  const existing = byEmail?.[0];
  if (!existing) return null;
  if (existing.firebase_uid && existing.firebase_uid !== identity.uid) return { conflict: true };
  // Linking an account by e-mail is safe only once Firebase verified the address.
  if (!verifiedOrTestBypass(identity)) return null;
  const { error } = await admin.from("profiles").update({ firebase_uid: identity.uid }).eq("id", existing.user_id);
  return error ? null : { id: existing.user_id };
}

/** Opens the Supabase session (httpOnly cookies) without sending any e-mail. */
async function openSession(admin: Admin, email: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return false;
  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  return !otpError;
}

export async function firebaseSignIn(idToken: string, next: string): Promise<FirebaseAuthResult> {
  const identity = await verifyFirebaseIdToken(idToken);
  if (!identity) return { ok: false, message: SESSION_FAILED };
  if (!verifiedOrTestBypass(identity)) {
    return { ok: false, unverified: true, message: "Confirme seu e-mail para entrar. Abra o link que enviamos para sua caixa de entrada." };
  }
  const admin = createAdminClient();
  const user = await linkedUser(admin, identity);
  if (!user) return { ok: false, message: "Não encontramos uma conta do FitFlow Pro para este e-mail. Crie sua conta ou use o link de convite do seu personal." };
  if ("conflict" in user) return { ok: false, message: SESSION_FAILED };
  if (!(await openSession(admin, identity.email))) return { ok: false, message: SESSION_FAILED };
  return { ok: true, redirectTo: safeRedirectPath(next) };
}

type SignupInput = { fullName: string; betaCode?: string; acceptTerms: boolean; acceptHealth?: boolean; inviteToken?: string };

async function createLinkedAccount(identity: FirebaseIdentity, metadata: Record<string, string>): Promise<FirebaseAuthResult> {
  const admin = createAdminClient();
  const existing = await linkedUser(admin, identity);
  if (existing && "conflict" in existing) return { ok: false, message: "Já existe uma conta com este e-mail. Entre com ela." };

  if (!existing) {
    const { data: byEmail } = await admin.rpc("find_auth_user_by_email", { p_email: identity.email });
    if (!byEmail?.length) {
      // The sign-up trigger applies the beta code, the invitation and the consents.
      const { data, error } = await admin.auth.admin.createUser({
        email: identity.email,
        email_confirm: true,
        password: randomBytes(32).toString("base64url"),
        user_metadata: metadata,
      });
      if (error || !data.user) {
        const triggerFailed = error?.message.includes("beta_code_invalid") || error?.message.includes("Database error");
        if (triggerFailed && metadata.invite_token) return { ok: false, message: "Este convite não é mais válido. Peça um novo link ao seu personal." };
        if (triggerFailed && metadata.beta_code !== undefined) return { ok: false, field: "betaCode", message: "Código de acesso inválido." };
        return { ok: false, message: SESSION_FAILED };
      }
      await admin.from("profiles").update({ firebase_uid: identity.uid }).eq("id", data.user.id);
    }
    // An existing, unlinked account with this e-mail is linked on the first
    // verified sign-in (see linkedUser), never before.
  }

  if (!verifiedOrTestBypass(identity)) return { ok: true, verifyEmail: true, email: identity.email };
  const user = existing ?? (await linkedUser(admin, identity));
  if (!user || "conflict" in user || !(await openSession(admin, identity.email))) return { ok: false, message: SESSION_FAILED };
  return { ok: true, redirectTo: "/dashboard" };
}

function checkConsent(input: SignupInput, student: boolean): FirebaseAuthResult | null {
  if (!fullNameSchema.safeParse(input.fullName).success) return { ok: false, field: "fullName", message: "Informe seu nome completo." };
  if (!input.acceptTerms) return { ok: false, field: "acceptTerms", message: "Para continuar, aceite os termos de uso e a política de privacidade." };
  if (student && !input.acceptHealth) return { ok: false, field: "acceptHealth", message: "Para o acompanhamento, autorize o uso dos seus dados de saúde." };
  return null;
}

export async function firebaseSignUpTrainer(idToken: string, input: SignupInput): Promise<FirebaseAuthResult> {
  const invalid = checkConsent(input, false);
  if (invalid) return invalid;
  const betaClosed = isBetaSignupClosed();
  if (betaClosed && !input.betaCode?.trim()) return { ok: false, field: "betaCode", message: "Informe o código de acesso do beta." };
  const identity = await verifyFirebaseIdToken(idToken);
  if (!identity) return { ok: false, message: SESSION_FAILED };
  return createLinkedAccount(identity, {
    full_name: fullNameSchema.parse(input.fullName),
    consent_version: LEGAL_VERSION,
    ...(betaClosed ? { beta_code: input.betaCode!.trim() } : {}),
  });
}

export async function firebaseSignUpStudent(idToken: string, inviteToken: string, input: SignupInput): Promise<FirebaseAuthResult> {
  const invalid = checkConsent(input, true);
  if (invalid) return invalid;
  if (!/^[0-9a-f]{64}$/.test(inviteToken)) return { ok: false, message: "Este convite não é mais válido. Peça um novo link ao seu personal." };
  const identity = await verifyFirebaseIdToken(idToken);
  if (!identity) return { ok: false, message: SESSION_FAILED };
  const supabase = await createClient();
  const { data: invitations } = await supabase.rpc("get_invitation", { p_token: inviteToken });
  const invitation = invitations?.[0];
  if (!invitation) return { ok: false, message: "Este convite não é mais válido. Peça um novo link ao seu personal." };
  if (invitation.email.toLowerCase() !== identity.email) return { ok: false, message: "Use o mesmo e-mail que recebeu o convite." };
  return createLinkedAccount(identity, { full_name: fullNameSchema.parse(input.fullName), invite_token: inviteToken, consent_version: LEGAL_VERSION });
}

// Accounts created before Firebase ------------------------------------------
// They have a Supabase password and no Firebase account. The first time they
// sign in, the password is checked against Supabase; the browser then creates
// the Firebase account with that same password and the server links it.

export async function firebaseLegacySignIn(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) return { ok: false, message: "E-mail ou senha incorretos." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { ok: false, message: authErrorMessage(error) };
  const { data: profile } = await createAdminClient().from("profiles").select("firebase_uid").eq("id", data.user.id).maybeSingle();
  if (profile?.firebase_uid) {
    // Already migrated: only Firebase passwords count from now on.
    await supabase.auth.signOut();
    return { ok: false, message: "E-mail ou senha incorretos." };
  }
  return { ok: true };
}

export async function firebaseLinkLegacy(idToken: string, next: string): Promise<FirebaseAuthResult> {
  const identity = await verifyFirebaseIdToken(idToken);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email.toLowerCase() : "";
  if (!identity || !userId || email !== identity.email) return { ok: false, message: SESSION_FAILED };
  const { error } = await createAdminClient().from("profiles").update({ firebase_uid: identity.uid }).eq("id", userId).is("firebase_uid", null);
  if (error) return { ok: false, message: SESSION_FAILED };
  return { ok: true, redirectTo: safeRedirectPath(next) };
}

/** Ends the session opened by firebaseLegacySignIn when linking could not finish. */
export async function firebaseCancelLegacy(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
