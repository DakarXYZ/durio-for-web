import { IS_DESKTOP } from "@revolt/common/lib/desktop";

import { version } from "../../../package.json";

// dur.io: never in the desktop build (its config refuses a DSN too, WEB-11), and the
// SDK is loaded only when a DSN is set, so builds without one do not carry it
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN && !IS_DESKTOP) {
  void import("@sentry/browser").then((Sentry) =>
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      tunnel: import.meta.env.VITE_SENTRY_TUNNEL,
      release: version,
      // tracing:
      // integrations: [Sentry.browserTracingIntegration()],
      // tracesSampleRate: 0.1,
    }),
  );
}
