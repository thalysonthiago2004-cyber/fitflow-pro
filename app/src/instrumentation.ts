import * as Sentry from "@sentry/nextjs";
import { SENTRY_PRIVACY } from "@/lib/sentry-options";

// Error monitoring is on only when a DSN is configured.
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, ...SENTRY_PRIVACY, dataCollection: { ...SENTRY_PRIVACY.dataCollection, httpBodies: [] }, environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV });
}

export const onRequestError = Sentry.captureRequestError;
