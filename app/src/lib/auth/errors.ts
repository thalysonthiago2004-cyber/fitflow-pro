type AuthErrorLike = { code?: string; status?: number; message?: string } | null | undefined;

const MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
  user_already_exists: "Já existe uma conta com este e-mail.",
  email_exists: "Já existe uma conta com este e-mail.",
  weak_password: "Senha muito fraca. Use uma combinação mais forte.",
  same_password: "A nova senha precisa ser diferente da atual.",
  over_email_send_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  signup_disabled: "Novos cadastros estão temporariamente desativados.",
  otp_expired: "Este link expirou. Solicite um novo.",
  session_not_found: "Sua sessão expirou. Entre novamente.",
};

export const GENERIC_AUTH_ERROR = "Não foi possível concluir a ação. Tente novamente.";

// Maps Supabase Auth errors to pt-BR copy without leaking internal details.
export function authErrorMessage(error: AuthErrorLike): string {
  if (!error) return GENERIC_AUTH_ERROR;
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.status === 429) return MESSAGES.over_request_rate_limit;
  return GENERIC_AUTH_ERROR;
}
