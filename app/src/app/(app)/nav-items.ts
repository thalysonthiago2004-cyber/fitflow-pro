import type { WorkspaceRole } from "@/lib/supabase/database.types";

export type NavKey =
  | "dashboard" | "students" | "workouts" | "exercises" | "nutrition" | "foods"
  | "assessments" | "training" | "meals" | "hydration" | "progress" | "anamnese" | "assistant" | "settings";

export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  roles: WorkspaceRole[];
  /** Shown in the mobile tab bar (max five per role); the sidebar shows everything. */
  mobile: boolean;
};

const ALL: WorkspaceRole[] = ["owner", "trainer", "student"];
const STAFF: WorkspaceRole[] = ["owner", "trainer"];
const STUDENT: WorkspaceRole[] = ["student"];

// Only implemented areas appear here; later phases add their own entries.
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", label: "Painel", roles: ALL, mobile: true },
  { key: "students", href: "/students", label: "Alunos", roles: STAFF, mobile: true },
  { key: "workouts", href: "/workouts", label: "Treinos", roles: STAFF, mobile: true },
  { key: "exercises", href: "/exercises", label: "Exercícios", roles: STAFF, mobile: false },
  { key: "nutrition", href: "/nutrition", label: "Nutrição", roles: STAFF, mobile: true },
  { key: "foods", href: "/foods", label: "Alimentos", roles: STAFF, mobile: false },
  // On mobile, reached from the students page.
  { key: "assessments", href: "/assessments", label: "Avaliação", roles: STAFF, mobile: false },
  { key: "training", href: "/training", label: "Treinos", roles: STUDENT, mobile: true },
  { key: "meals", href: "/meals", label: "Dieta", roles: STUDENT, mobile: true },
  { key: "progress", href: "/progress", label: "Evolução", roles: STUDENT, mobile: true },
  // Reached from the dashboard card on mobile.
  { key: "hydration", href: "/hydration", label: "Hidratação", roles: STUDENT, mobile: false },
  // Reached from the dashboard prompt on mobile.
  { key: "anamnese", href: "/anamnese", label: "Anamnese", roles: STUDENT, mobile: false },
  // On mobile, reached from the header button.
  { key: "assistant", href: "/assistant", label: "Assistente", roles: ALL, mobile: false },
  { key: "settings", href: "/settings", label: "Configurações", roles: ALL, mobile: true },
];

export function navItemsFor(role: WorkspaceRole | undefined, variant: "sidebar" | "bottom" = "sidebar"): NavItem[] {
  // Users without a workspace (e.g. a student removed by their trainer) only
  // get the areas every role shares.
  return NAV_ITEMS.filter(
    (item) => (role ? item.roles.includes(role) : item.roles === ALL) && (variant === "sidebar" || item.mobile),
  );
}
