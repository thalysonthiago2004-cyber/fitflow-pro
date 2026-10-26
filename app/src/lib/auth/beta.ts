import "server-only";

// The sign-up trigger rejects trainer sign-ups without the right code while
// a code is configured in the database; this flag only decides whether the
// form asks for it.
export function isBetaSignupClosed(): boolean {
  return process.env.BETA_SIGNUP_REQUIRED === "1";
}
