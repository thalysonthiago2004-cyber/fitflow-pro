import { z } from "zod";
import { addDays, isCalendarDate, todayISO } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/supabase/database.types";

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Agendada",
  completed: "Realizada",
  cancelled: "Cancelada",
  no_show: "Falta",
};

export const APPOINTMENT_STATUS_TONES = { scheduled: "info", completed: "success", cancelled: "neutral", no_show: "warning" } as const;

export const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120] as const;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

export const appointmentSchema = z
  .object({
    studentId: z.uuid("Escolha o aluno."),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.")
      .refine(isCalendarDate, "Data inválida."),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe o horário."),
    duration: z.coerce.number({ error: "Escolha a duração." }).int().min(15, "Mínimo de 15 minutos.").max(480, "Máximo de 8 horas."),
    location: optionalText(120, "Local muito longo."),
    notes: optionalText(1000, "Observação muito longa."),
  })
  .superRefine((value, ctx) => {
    // Booking far in the past or future is almost always a typo in the year.
    const today = todayISO();
    if (value.date < addDays(today, -60)) ctx.addIssue({ code: "custom", path: ["date"], message: "Use uma data dos últimos 60 dias ou futura." });
    if (value.date > addDays(today, 366)) ctx.addIssue({ code: "custom", path: ["date"], message: "Agende com até um ano de antecedência." });
  });

export type AppointmentInput = z.infer<typeof appointmentSchema>;

export const appointmentStatusSchema = z.enum(["scheduled", "completed", "cancelled", "no_show"]);
