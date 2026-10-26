// Shared Sentry settings. The SDK's defaults collect cookies, headers,
// request/response bodies and user info; server-action bodies can carry
// health data (weights, measurements, questionnaires), so all of it is off.
// Reports keep only the error, stack trace and route.
export const SENTRY_PRIVACY = {
  tracesSampleRate: 0,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
} as const;
