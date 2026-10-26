// Shared helpers for the server-side query modules.

/** Throws a load error that the route's error boundary (and Sentry) reports. */
export function fail(what: string, error: { message: string }): never {
  throw new Error(`Failed to load ${what}: ${error.message}`);
}

/** Postgres numerics arrive as strings; keeps null as null. */
export const num = (value: number | string | null) => (value === null ? null : Number(value));
