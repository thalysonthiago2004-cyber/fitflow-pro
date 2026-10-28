import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/roles";
import { parsePeriod } from "@/lib/dashboard/metrics";
import { StudentHome } from "./student-home";
import { TrainerHome } from "./trainer-home";

export const metadata: Metadata = { title: "Painel" };

async function DashboardContent({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const user = await requireUser();
  if (!isStaffRole(user.workspace?.role)) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <StudentHome user={user} />
      </div>
    );
  }
  const { periodo } = await searchParams;
  return <TrainerHome user={user} period={parsePeriod(periodo)} />;
}

function DashboardSkeleton() {
  return (
    <div role="status" className="mx-auto grid w-full max-w-3xl gap-8" aria-busy="true" aria-label="Carregando painel">
      <div className="h-12 w-56 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      <div className="h-48 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}
