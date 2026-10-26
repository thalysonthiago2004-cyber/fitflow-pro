import { z } from "zod";

const email = z
  .string({ error: "Informe seu e-mail." })
  .trim()
  .min(1, "Informe seu e-mail.")
  .max(254, "E-mail muito longo.")
  .pipe(z.email("Informe um e-mail válido."))
  .transform((value) => value.toLowerCase());

const newPassword = z
  .string({ error: "Crie uma senha." })
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.")
  .regex(/[A-Za-z]/, "A senha precisa ter pelo menos uma letra.")
  .regex(/\d/, "A senha precisa ter pelo menos um número.");

const fullName = z
  .string({ error: "Informe seu nome." })
  .trim()
  .min(2, "Informe seu nome completo.")
  .max(120, "Nome muito longo.");

export const loginSchema = z.object({
  email,
  password: z.string({ error: "Informe sua senha." }).min(1, "Informe sua senha."),
});

export const fullNameSchema = fullName;
export const newPasswordSchema = newPassword;
export const signupSchema = z.object({ fullName, email, password: newPassword });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string({ error: "Confirme a nova senha." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({ fullName });

export const workspaceSchema = z.object({
  name: z
    .string({ error: "Informe o nome do espaço." })
    .trim()
    .min(2, "O nome precisa ter pelo menos 2 caracteres.")
    .max(80, "O nome pode ter no máximo 80 caracteres."),
});

export type FieldErrors = Partial<Record<string, string[]>>;

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };
