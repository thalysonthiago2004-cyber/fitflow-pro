import { getCurrentUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/roles";
import { todayISO } from "@/lib/format";
import { RATE_LIMITED, allow } from "@/lib/rate-limit";
import { parseRange, parseSort, sortRows, toCsv } from "@/lib/reports/build";
import { loadReport } from "@/lib/reports/queries";
import { createClient } from "@/lib/supabase/server";

// The per-student report as CSV, for the same range and order as the page.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  if (!user.workspace || !isStaffRole(user.workspace.role)) return new Response("Sem permissão.", { status: 403 });
  const supabase = await createClient();
  if (!(await allow(supabase, "report_export"))) return new Response(RATE_LIMITED, { status: 429 });

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const range = parseRange(params, todayISO());
  const { rows } = await loadReport(user.workspace.id, range);

  return new Response(toCsv(sortRows(rows, parseSort(params.ordem))), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="fitflow-relatorio-${range.from}-a-${range.to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
