"use server";

import { redirect } from "next/navigation";
import { authErrorMessage } from "@/lib/auth/errors";
import { formString, validationError } from "@/lib/auth/form-state";
import { isBetaSignupClosed } from "@/lib/auth/beta";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import {
  type FormState,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/auth/schemas";
import { getPublicEnv } from "@/lib/env";
import { dbErrorMessage } from "@/lib/students/errors";
import { LEGAL_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

function confirmUrl(next: string) {
  const url = new URL("/auth/confirm", getPublicEnv().NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("next", next);
  return url.toString();
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = formString(formData, "email");
  const parsed = loginSchema.safeParse({ email, password: formString(formData, "password") });
  if (!parsed.success) return validationError(parsed.error, { email });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: authErrorMessage(error), values: { email } };

  redirect(safeRedirectPath(formString(formData, "next")));
}

const CONSENT_REQUIRED = "Para continuar, aceite os termos de uso e a política de privacidade.";
const HEALTH_CONSENT_REQUIRED = "Para o acompanhamento, autorize o uso dos seus dados de saúde.";

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { fullName: formString(formData, "fullName"), email: formString(formData, "email"), betaCode: formString(formData, "betaCode") };
  const parsed = signupSchema.safeParse({ fullName: values.fullName, email: values.email, password: formString(formData, "password") });
  if (!parsed.success) return validationError(parsed.error, values);
  if (formData.get("acceptTerms") !== "yes") {
    return { status: "error", message: "Revise os campos destacados.", fieldErrors: { acceptTerms: [CONSENT_REQUIRED] }, values };
  }
  const betaClosed = isBetaSignupClosed();
  if (betaClosed && !values.betaCode.trim()) {
    return { status: "error", message: "Revise os campos destacados.", fieldErrors: { betaCode: ["Informe o código de acesso do beta."] }, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // Only the display name is sent; the role is assigned by the database trigger.
    options: {
      data: { full_name: parsed.data.fullName, consent_version: LEGAL_VERSION, ...(betaClosed ? { beta_code: values.betaCode } : {}) },
      emailRedirectTo: confirmUrl("/dashboard"),
    },
  });
  // A wrong beta code makes the sign-up trigger raise beta_code_invalid. Auth
  // reports trigger failures as "Database error saving new user" (status 500)
  // or passes the code through; for trainer sign-ups the trigger has no other
  // expected failure.
  const triggerFailed = error && (error.message.includes("beta_code_invalid") || error.message.includes("Database error saving new user") || error.code === "unexpected_failure");
  if (triggerFailed && betaClosed) {
    return { status: "error", message: "Revise os campos destacados.", fieldErrors: { betaCode: ["Código de acesso inválido."] }, values };
  }
  if (error) return { status: "error", message: authErrorMessage(error), values };

  // E-mail confirmation disabled in the project: the user is already signed in.
  if (data.session) redirect("/dashboard");

  // Same message whether or not the address already has an account (no enumeration).
  return {
    status: "success",
    message: `Enviamos um link de confirmação para ${parsed.data.email}. Abra o e-mail para ativar sua conta.`,
  };
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = formString(formData, "email");
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) return validationError(parsed.error, { email });

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: confirmUrl("/reset-password"),
  });
  // Rate limiting is worth surfacing; any other failure is reported as success
  // so the form never reveals whether an account exists.
  if (error?.status === 429) {
    return { status: "error", message: authErrorMessage(error), values: { email } };
  }

  return {
    status: "success",
    message: "Se houver uma conta com este e-mail, você receberá um link para redefinir a senha.",
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: authErrorMessage(error) };

  return { status: "success", message: "Senha atualizada com sucesso." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const INVITE_TOKEN = /^[0-9a-f]{64}$/;

// Sign-up from an invitation. The e-mail comes from the invitation itself and
// the database trigger re-validates the token, so the form cannot pick either.
export async function signupWithInvite(
  token: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fullName = formString(formData, "fullName");
  const supabase = await createClient();
  const { data: invitations } = INVITE_TOKEN.test(token)
    ? await supabase.rpc("get_invitation", { p_token: token })
    : { data: null };
  const invitation = invitations?.[0];
  if (!invitation) return { status: "error", message: dbErrorMessage({ message: "invitation_invalid" }) };

  const parsed = signupSchema.safeParse({
    fullName,
    email: invitation.email,
    password: formString(formData, "password"),
  });
  if (!parsed.success) return validationError(parsed.error, { fullName });
  const consentErrors = {
    ...(formData.get("acceptTerms") !== "yes" ? { acceptTerms: [CONSENT_REQUIRED] } : {}),
    ...(formData.get("acceptHealth") !== "yes" ? { acceptHealth: [HEALTH_CONSENT_REQUIRED] } : {}),
  };
  if (Object.keys(consentErrors).length) return { status: "error", message: "Revise os campos destacados.", fieldErrors: consentErrors, values: { fullName } };

  const { data, error } = await supabase.auth.signUp({
    email: invitation.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, invite_token: token, consent_version: LEGAL_VERSION },
      emailRedirectTo: confirmUrl("/dashboard"),
    },
  });
  if (error) {
    // A trigger failure (token used or expired meanwhile) surfaces as a generic DB error.
    const message =
      error.code === "unexpected_failure" ? dbErrorMessage({ message: "invitation_invalid" }) : authErrorMessage(error);
    return { status: "error", message, values: { fullName } };
  }

  // Supabase returns a user without identities when the e-mail is already registered.
  if (data.user && data.user.identities?.length === 0) {
    return {
      status: "error",
      message: "Já existe uma conta com este e-mail. Entre com ela para aceitar o convite.",
      values: { fullName },
    };
  }

  if (data.session) redirect("/dashboard");
  return {
    status: "success",
    message: `Enviamos um link de confirmação para ${invitation.email}. Abra o e-mail para ativar sua conta.`,
  };
}

export async function acceptInvite(token: string): Promise<{ ok: false; message: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const { error } = INVITE_TOKEN.test(token)
    ? await supabase.rpc("accept_invitation", { p_token: token })
    : { error: { message: "invitation_invalid" } };
  if (error) return { ok: false, message: dbErrorMessage(error) };

  redirect("/dashboard");
}
