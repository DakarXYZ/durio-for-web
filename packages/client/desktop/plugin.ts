// `vite build --mode desktop` (dur.io, plan WEB-09, WEB-11): the static app the Windows
// client packages and serves from `app://durio/` (90-desktop-windows D2).
//
// - output in `dist-desktop/`, base `/`: the SPA's deep routes (`/i/<host>/channel/…`)
//   are answered with index.html by the Electron protocol handler, so asset URLs must
//   not be relative to the route (`./assets/…` would resolve under `/i/<host>/…`);
// - no PWA, no service worker, no push worker (`withoutDesktop` for VitePWA, stubs for
//   `virtual:pwa-register` and the push worker URL);
// - the CSP of `csp.mjs` as a <meta>; a build with an inline script fails;
// - the RNNoise worklet packaged from the local cache (`fetch-rnnoise.mjs`);
// - no Sentry: a desktop build with `VITE_SENTRY_DSN` set fails;
// - no source maps in the package.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type Plugin, type PluginOption, loadEnv } from "vite";

import { DESKTOP_CSP } from "./csp.mjs";
import { RNNOISE_CACHE, RNNOISE_FILES } from "./rnnoise.mjs";

export const DESKTOP_MODE = "desktop";
export const DESKTOP_OUT_DIR = "dist-desktop";

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)[^>]*>/i;

/**
 * Keep plugins out of the desktop build
 * @param plugins Plugin(s)
 */
export function withoutDesktop(plugins: PluginOption): PluginOption {
  const list = (Array.isArray(plugins) ? plugins.flat() : [plugins]) as (
    | Plugin
    | false
    | null
    | undefined
  )[];

  return list.map(
    (plugin) =>
      plugin && {
        ...plugin,
        apply: (config, env) =>
          env.mode !== DESKTOP_MODE &&
          (typeof plugin.apply === "function"
            ? plugin.apply(config, env)
            : !plugin.apply || plugin.apply === env.command),
      },
  );
}

/**
 * The desktop build mode
 */
export function durioDesktop(): Plugin {
  let desktop = false;
  const stub = (file: string) => resolve(__dirname, "stubs", file);

  return {
    name: "durio-desktop",
    enforce: "pre",

    config(_, env) {
      desktop = env.mode === DESKTOP_MODE;
      if (!desktop) return;

      const vars = loadEnv(env.mode, resolve(__dirname, ".."), "VITE_");
      if (vars.VITE_SENTRY_DSN || process.env.VITE_SENTRY_DSN)
        throw new Error(
          "dur.io desktop builds have no Sentry: unset VITE_SENTRY_DSN",
        );

      return {
        base: "/",
        build: {
          outDir: DESKTOP_OUT_DIR,
          sourcemap: false,
        },
        resolve: {
          alias: [
            {
              find: /^virtual:pwa-register$/,
              replacement: stub("pwaRegister.ts"),
            },
            {
              find: /^\/src\/pushWorker\?worker&url$/,
              replacement: stub("pushWorkerUrl.ts"),
            },
          ],
        },
      };
    },

    transformIndexHtml: {
      order: "post",
      handler(html) {
        if (!desktop) return;
        if (INLINE_SCRIPT.test(html))
          throw new Error("desktop build: index.html has an inline script");

        return {
          html: html.replace(/<link rel="manifest"[^>]*>/, ""),
          tags: [
            {
              tag: "meta",
              injectTo: "head-prepend",
              attrs: {
                "http-equiv": "Content-Security-Policy",
                content: DESKTOP_CSP,
              },
            },
          ],
        };
      },
    },

    generateBundle() {
      if (!desktop) return;

      for (const [name, hash] of Object.entries(RNNOISE_FILES)) {
        let source: Buffer;
        try {
          source = readFileSync(join(RNNOISE_CACHE, name));
        } catch {
          this.error(
            "RNNoise worklet missing: run `node desktop/fetch-rnnoise.mjs` (mise build:desktop does)",
          );
        }

        if (createHash("sha256").update(source).digest("hex") !== hash)
          this.error(`RNNoise ${name}: unexpected sha256`);

        this.emitFile({ type: "asset", fileName: `rnnoise/${name}`, source });
      }
    },
  };
}
