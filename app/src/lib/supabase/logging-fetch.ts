import * as Sentry from "@sentry/nextjs";

// Every failed Supabase response (database, storage, auth) is logged here, so
// errors the UI turns into a generic message are still visible. Only the
// method, path (no query string), status and Postgres/Auth error code and
// message are recorded: never request bodies or row values, which can carry
// health data.

type Entry = { scope: string; method: string; path: string; status: number; code?: string; message?: string };

// Expected outcomes the UI already handles: wrong password, unique names, app-level rules.
const EXPECTED = new Set(["invalid_credentials", "23505", "P0001", "PGRST116"]);

export function shouldAlert(entry: Entry): boolean {
  if (entry.code && EXPECTED.has(entry.code)) return false;
  return entry.status >= 500 || entry.code === "42501";
}

async function describe(response: Response): Promise<{ code?: string; message?: string }> {
  try {
    const body = (await response.clone().json()) as { code?: string | number; error_code?: string; message?: string; msg?: string; error?: string };
    const code = body.code ?? body.error_code ?? body.error;
    return { code: code === undefined ? undefined : String(code), message: (body.message ?? body.msg)?.slice(0, 200) };
  } catch {
    return {};
  }
}

export function loggingFetch(scope: string): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    if (response.ok) return response;
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const entry: Entry = { scope, method: init?.method ?? "GET", path: url.pathname, status: response.status, ...(await describe(response)) };
    if (shouldAlert(entry)) {
      console.error("[supabase]", JSON.stringify(entry));
      Sentry.captureMessage(`Supabase ${entry.status} ${entry.method} ${entry.path}`, { level: "error", extra: entry });
    } else {
      console.warn("[supabase]", JSON.stringify(entry));
    }
    return response;
  };
}
