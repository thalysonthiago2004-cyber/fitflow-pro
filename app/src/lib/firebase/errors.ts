// Firebase Auth error codes → pt-BR copy. Messages never reveal whether an
// e-mail has an account (wrong e-mail and wrong password read the same).

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/invalid-email": "Informe um e-mail válido.",
  "auth/email-already-in-use": "Já existe uma conta com este e-mail. Entre com ela ou use \"Esqueci minha senha\".",
  "auth/weak-password": "Senha muito fraca. Use pelo menos 8 caracteres, com letras e números.",
  "auth/password-does-not-meet-requirements": "A senha não atende aos requisitos. Use pelo menos 8 caracteres, com letras e números.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "auth/network-request-failed": "Sem conexão. Verifique a internet e tente novamente.",
  "auth/user-disabled": "Esta conta está desativada.",
  "auth/requires-recent-login": "Por segurança, confirme sua senha atual e tente de novo.",
};

export const FIREBASE_GENERIC = "Não foi possível concluir a ação. Tente novamente.";

export function firebaseErrorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
}

export function firebaseErrorMessage(error: unknown): string {
  return MESSAGES[firebaseErrorCode(error)] ?? FIREBASE_GENERIC;
}

/**
 * Wrong e-mail or password. With e-mail enumeration protection on (the
 * default) Firebase answers auth/invalid-credential; without it, or on the
 * emulator, auth/wrong-password or auth/user-not-found.
 */
export function isCredentialError(error: unknown): boolean {
  return ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(firebaseErrorCode(error));
}
