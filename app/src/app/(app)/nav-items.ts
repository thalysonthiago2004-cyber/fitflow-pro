import type { WorkspaceRole } from "@/lib/supabase/database.types";

export type NavKey =
  | "dashboard" | "students" | "schedule" | "workouts" | "exercises" | "nutrition" | "foods"
  | "assessments" | "reports" | "training" | "meals" | "hydration" | "progress" | "anamnese" | "assistant" | "settings";

/** Sidebar sections; "more" (assistant, settings) sits apart at the bottom. */
export type NavGroup = "daily" | "content" | "tracking" | "insights" | "more";

export const NAV_GROUP_LABELS: Record<NavGroup, string | null> = {
  daily: "Dia a dia",
  content: "Conteúdo",
  tracking: "Acompanhamento",
  insights: "Análise",
  more: null,
};

export type NavItem = {
  key: NavKey;
  group: NavGroup;
  href: string;
  label: string;
  roles: WorkspaceRole[];
  /** Shown in the mobile tab bar (max five per role), for every role or only some; the sidebar shows everything. */
  mobile: boolean | WorkspaceRole[];
};

const ALL: WorkspaceRole[] = ["owner", "trainer", "student"];
const STAFF: WorkspaceRole[] = ["owner", "trainer"];
const STUDENT: WorkspaceRole[] = ["student"];

// Only implemented areas appear here; later phases add their own entries.
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", group: "daily", href: "/dashboard", label: "Painel", roles: ALL, mobile: true },
  { key: "students", group: "daily", href: "/students", label: "Alunos", roles: STAFF, mobile: true },
  { key: "schedule", group: "daily", href: "/schedule", label: "Agenda", roles: STAFF, mobile: true },
  { key: "workouts", group: "content", href: "/workouts", label: "Treinos", roles: STAFF, mobile: true },
  { key: "exercises", group: "content", href: "/exercises", label: "Exercícios", roles: STAFF, mobile: false },
  { key: "nutrition", group: "content", href: "/nutrition", label: "Nutrição", roles: STAFF, mobile: true },
  { key: "foods", group: "content", href: "/foods", label: "Alimentos", roles: STAFF, mobile: false },
  // On mobile, reached from the students page.
  { key: "assessments", group: "content", href: "/assessments", label: "Avaliação", roles: STAFF, mobile: false },
  // On mobile, reached from the dashboard.
  { key: "reports", group: "insights", href: "/reports", label: "Relatórios", roles: STAFF, mobile: false },
  { key: "training", group: "daily", href: "/training", label: "Treinos", roles: STUDENT, mobile: true },
  { key: "meals", group: "daily", href: "/meals", label: "Dieta", roles: STUDENT, mobile: true },
  { key: "progress", group: "tracking", href: "/progress", label: "Evolução", roles: STUDENT, mobile: true },
  // Reached from the dashboard card on mobile.
  { key: "hydration", group: "tracking", href: "/hydration", label: "Hidratação", roles: STUDENT, mobile: false },
  // Reached from the dashboard prompt on mobile.
  { key: "anamnese", group: "tracking", href: "/anamnese", label: "Anamnese", roles: STUDENT, mobile: false },
  // On mobile, reached from the header button.
  { key: "assistant", group: "more", href: "/assistant", label: "Assistente", roles: ALL, mobile: false },
  // Staff reach settings from the account menu on mobile, so Agenda gets the tab.
  { key: "settings", group: "more", href: "/settings", label: "Configurações", roles: ALL, mobile: STUDENT },
];

export function navItemsFor(role: WorkspaceRole | undefined, variant: "sidebar" | "bottom" = "sidebar"): NavItem[] {
  // Users without a workspace (e.g. a student removed by their trainer) only
  // get the areas every role shares.
  return NAV_ITEMS.filter(
    (item) => (role ? item.roles.includes(role) : item.roles === ALL) && (variant === "sidebar" || item.mobile === true || (Array.isArray(item.mobile) && (!role || item.mobile.includes(role)))),
  );
}
