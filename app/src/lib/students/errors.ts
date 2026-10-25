type DbErrorLike = { message?: string } | null | undefined;

// Database functions raise stable codes as the error message; map them to copy.
const MESSAGES: Record<string, string> = {
  not_authorized: "Você não tem permissão para esta ação.",
  already_student: "Este e-mail já pertence a um aluno do seu espaço.",
  invitation_not_found: "Convite não encontrado ou já utilizado.",
  invitation_invalid: "Este convite é inválido, expirou ou já foi usado. Peça um novo link ao seu personal.",
  invitation_email_mismatch: "Este convite foi enviado para outro e-mail.",
  already_enrolled: "Sua conta já está vinculada a um personal.",
  trainer_account: "Esta conta é de personal. Para entrar como aluno, use outro e-mail.",
  student_not_found: "Aluno não encontrado.",
};

export const GENERIC_DB_ERROR = "Não foi possível concluir a ação. Tente novamente.";

export function dbErrorMessage(error: DbErrorLike): string {
  const code = error?.message?.trim();
  return (code && MESSAGES[code]) || GENERIC_DB_ERROR;
}
