// dur.io (Q63): the emoji images come with the app instead of static.stoat.chat.
// The Twemoji set (`@twemoji/svg`, pinned by the lockfile) is served from
// `<base>emoji/twemoji/<code points>.svg` by the dev server and copied into every build,
// so the desktop app shows emoji from its own `app://` origin ('self' in the CSP) with no
// network at all. Graphics: Twemoji © Twitter, Inc and other contributors, CC-BY 4.0.
import { createReadStream, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";

export const EMOJI_DIR = "emoji/twemoji";

const NOTICE = `Twemoji graphics (https://github.com/jdecked/twemoji, 15.0)
Copyright 2019 Twitter, Inc and other contributors
Licensed under CC-BY 4.0: https://creativecommons.org/licenses/by/4.0/
Optimised SVG files from @twemoji/svg 15.0.0 (MIT, https://github.com/boywithkeyboard/twemoji_svg)
`;

const RE_NAME = /^[0-9a-f]+(-[0-9a-f]+)*\.svg$/;

function twemojiSource() {
  const require = createRequire(import.meta.url);
  return dirname(require.resolve("@twemoji/svg/package.json"));
}

/**
 * Package the Twemoji set
 */
export function packageEmoji(): Plugin {
  let base = "/";

  return {
    name: "durio-emoji",

    configResolved(config) {
      base = config.base;
    },

    configureServer(server) {
      const source = twemojiSource();
      const prefix = `${base}${EMOJI_DIR}/`;

      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        if (!path?.startsWith(prefix)) return next();

        const name = path.slice(prefix.length);
        if (!RE_NAME.test(name)) {
          res.statusCode = 404;
          return res.end();
        }

        res.setHeader("Content-Type", "image/svg+xml");
        createReadStream(join(source, name))
          .on("error", () => {
            res.statusCode = 404;
            res.end();
          })
          .pipe(res);
      });
    },

    generateBundle() {
      const source = twemojiSource();
      const names = readdirSync(source).filter((name) => RE_NAME.test(name));
      if (names.length < 3000)
        this.error(`@twemoji/svg: only ${names.length} emoji in ${source}`);

      for (const name of names)
        this.emitFile({
          type: "asset",
          fileName: `${EMOJI_DIR}/${name}`,
          source: readFileSync(join(source, name)),
        });

      this.emitFile({
        type: "asset",
        fileName: `${EMOJI_DIR}/NOTICE.txt`,
        source: NOTICE,
      });
    },
  };
}
