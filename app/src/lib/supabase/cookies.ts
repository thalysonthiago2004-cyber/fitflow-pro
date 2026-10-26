// Session cookies are only read on the server (there is no browser Supabase
// client), so they are httpOnly: page scripts can never read the tokens.
// Secure in production; a 30-day lifetime instead of the library's 400 days.
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60,
};

/**
 * @supabase/ssr always writes session cookies with a 400-day maxAge, whatever
 * cookieOptions says. Cap it when writing; keep maxAge 0, which deletes.
 */
export function capSessionCookie<T extends { maxAge?: number }>(options: T | undefined) {
  return { ...SESSION_COOKIE_OPTIONS, ...options, maxAge: options?.maxAge === 0 ? 0 : SESSION_COOKIE_OPTIONS.maxAge };
}
