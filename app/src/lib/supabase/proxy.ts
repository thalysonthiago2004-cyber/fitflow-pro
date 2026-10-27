import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "./database.types";
import { SESSION_COOKIE_OPTIONS, capSessionCookie } from "./cookies";
import { loggingFetch } from "./logging-fetch";

// Default deny: every route needs a session unless listed here, so new pages
// are protected without having to remember to register them.
// /api/cron authenticates with its own bearer secret.
const PUBLIC_PATHS = ["/sobre", "/login", "/signup", "/forgot-password", "/auth", "/invite", "/termos", "/privacidade", "/api/cron"];
const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isPublicPath(pathname: string) {
  return matches(pathname, PUBLIC_PATHS);
}

// Refreshes the auth session cookie and applies optimistic redirects.
// Real authorization happens in the data access layer and in RLS.
export async function updateSession(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      global: { fetch: loggingFetch("proxy") },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, capSessionCookie(options)),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Do not run code between client creation and getClaims(): it refreshes the token.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // The app opens on the login screen (the product page lives at /sobre).
  if (pathname === "/") return redirectTo(isAuthenticated ? "/dashboard" : "/login");

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const next = encodeURIComponent(`${pathname}${search}`);
    return redirectTo(`/login?next=${next}`);
  }

  if (isAuthenticated && matches(pathname, GUEST_ONLY_PATHS)) {
    return redirectTo("/dashboard");
  }

  return response;
}
