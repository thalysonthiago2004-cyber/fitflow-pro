import * as Sentry from "@sentry/nextjs";
import { SENTRY_PRIVACY } from "@/lib/sentry-options";

// Browser errors, only when a DSN is configured. See SENTRY_PRIVACY.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, ...SENTRY_PRIVACY, dataCollection: { ...SENTRY_PRIVACY.dataCollection, httpBodies: [] }, environment: process.env.NODE_ENV });
}
