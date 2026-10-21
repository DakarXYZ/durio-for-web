// `vite build --mode server` (dur.io): the browser client a dur.io server hosts itself at
// `https://<server>/web/app/` (durio-self-hosted, image `durio-web`).
//
// - base `/web/app/`, output in `dist-server/`; the client's default server is the one
//   that serves it (`location.host`, see `components/common/lib/env.ts`), so there is no
//   server address screen;
// - PWA and push worker stay (scope `/web/app/`);
// - the RNNoise worklet packaged like in the desktop build: no remote code from a CDN;
// - no inline scripts: the server's Content-Security-Policy has no 'unsafe-inline';
// - no Sentry, no source maps.
import { resolve } from "node:path";

import { type Plugin, loadEnv } from "vite";

import { emitRnnoise } from "../desktop/plugin";

export const SERVER_MODE = "server";
export const SERVER_BASE = "/web/app/";
export const SERVER_OUT_DIR = "dist-server";

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)[^>]*>/i;

/**
 * The self-hosted build mode
 */
export function durioServer(): Plugin {
  let server = false;

  return {
    name: "durio-server",
    enforce: "pre",

    config(_, env) {
      server = env.mode === SERVER_MODE;
      if (!server) return;

      const vars = loadEnv(env.mode, resolve(__dirname, ".."), "VITE_");
      if (vars.VITE_SENTRY_DSN || process.env.VITE_SENTRY_DSN)
        throw new Error(
          "dur.io server builds have no Sentry: unset VITE_SENTRY_DSN",
        );
      if (
        vars.VITE_HOST ||
        vars.VITE_API_URL ||
        process.env.VITE_HOST ||
        process.env.VITE_API_URL
      )
        throw new Error(
          "dur.io server builds use the server that serves them: unset VITE_HOST and VITE_API_URL",
        );

      return {
        base: SERVER_BASE,
        build: {
          outDir: SERVER_OUT_DIR,
          sourcemap: false,
        },
      };
    },

    transformIndexHtml: {
      order: "post",
      handler(html) {
        if (server && INLINE_SCRIPT.test(html))
          throw new Error("server build: index.html has an inline script");
      },
    },

    generateBundle() {
      if (server) emitRnnoise(this);
    },
  };
}
