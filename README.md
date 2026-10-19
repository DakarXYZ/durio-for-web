<div align="center">
<h1>
  Stoat Frontend
  
  [![Stars](https://img.shields.io/github/stars/stoatchat/for-web?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-web/stargazers)
  [![Forks](https://img.shields.io/github/forks/stoatchat/for-web?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-web/network/members)
  [![Pull Requests](https://img.shields.io/github/issues-pr/stoatchat/for-web?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-web/pulls)
  [![Issues](https://img.shields.io/github/issues/stoatchat/for-web?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-web/issues)
  [![Contributors](https://img.shields.io/github/contributors/stoatchat/for-web?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-web/graphs/contributors)
  [![License](https://img.shields.io/github/license/stoatchat/for-web?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-web/blob/main/LICENSE)
</h1>
The official web client powering https://stoat.chat/app, built with <a href="https://www.solidjs.com/">Solid.js</a> 💖. <br/>
Track the project roadmap on <a href="https://op.stoatinternal.com/projects/revolt-for-web/roadmap">OpenProject</a>.
</div>
<br/>

## Development Guide

Before contributing, make yourself familiar with [our contribution guidelines](https://developers.stoat.chat/developing/contrib/), the [code style guidelines](./GUIDELINES.md), and the [technical documentation for this project](https://stoatchat.github.io/for-web/).

Before getting started, you'll want to install:

- [Git](https://git-scm.com/install/)
- [mise-en-place](https://mise.jdx.dev/getting-started.html)

Then proceed to setup:

```bash
# clone the repository
git clone --recursive https://github.com/stoatchat/for-web client
cd client

# update submodules if you pull new changes
# git submodule init && git submodule update

# install all packages
mise install:frozen

# build deps:
mise build:deps

# or build a specific dep (e.g. stoat.js updates):
# pnpm --filter stoat.js run build

# customise the .env
cp packages/client/.env.example packages/client/.env

# run dev server
mise dev

# run all CI checks locally
mise check
```

Finally, navigate to http://local.revolt.chat:5173.

### dur.io fork: submodules and the SDK workflow

This fork (dur.io) uses our own forks of the submodules (see `.gitmodules`):
`packages/stoat.js` → `DakarXYZ/durio-javascript-client-sdk`, `packages/solid-livekit-components` →
`DakarXYZ/durio-solid-livekit-components`. The private brand assets (`packages/client/assets`) are not used:
run `mise assets:fallback`, the client then takes the dur.io placeholders from
`packages/client/scripts/assets_fallback`.

There is exactly one copy of the SDK — the `packages/stoat.js` submodule. A change to the SDK is always two
commits:

```bash
# 1. edit and commit inside the submodule, on the same branch name as for-web (durio/<stage>)
cd packages/stoat.js
git switch durio/stage-6            # or create it: git switch -c durio/stage-6
pnpm --filter stoat.js typecheck && pnpm --filter stoat.js build
git commit -am "feat(e2ee): ..."

# 2. bump the submodule pointer in for-web
cd ../..
git add packages/stoat.js
git commit -m "chore(sdk): bump stoat.js (...)"
```

The SDK commit must be pushed to the fork (`origin` of the submodule) before or together with the for-web commit
that points to it, otherwise a fresh `git submodule update --init` cannot check it out. We keep the SDK on
`durio/<stage>` branches like every other dur.io repo (not a separate `e2ee` branch): for-web pins an exact commit,
so the branch name only has to make the commit reachable in the fork.

API types come from `packages/stoat-api` (`@durio/stoat-api`), generated from our backend's `OpenAPI.json`; the
SDK imports it under the old name `stoat-api` through a pnpm alias. Regenerate with
`pnpm --filter @durio/stoat-api generate && pnpm --filter @durio/stoat-api build`; see
`packages/stoat-api/README.md` for refreshing the spec.

### dur.io fork: end-to-end encryption

E2EE of DMs and groups lives in the SDK (`packages/stoat.js/src/e2ee/`: the `E2eeProvider` interface, request
executor, decryption queue, outbox) and runs the crypto core `@durio/stoat-crypto` (wasm in a Web Worker, one per
account) from `packages/client/components/client/e2ee/`. The core is not on the npm registry: during development
the client depends on the tarball built in the sibling clone of `durio-crypt`:

```bash
# in ../stoat-crypto (the durio-crypt clone next to for-web)
scripts/build-wasm.sh build   # → bindings/web/build/durio-stoat-crypto-<v>.tgz (+ .sha256)
```

`packages/client/package.json` points at `file:../../../stoat-crypto/bindings/web/build/durio-stoat-crypto-<v>.tgz`;
CI and releases switch to the tarball of the GitHub Release (`https://github.com/DakarXYZ/durio-crypt/releases/download/v<v>/durio-stoat-crypto-<v>.tgz`)
and compare the lockfile integrity with the release's `.sha256`. The crypto store key comes from the desktop app
(`window.native.e2eeStoreKey`, stage 7); `vite dev` without it uses an insecure development key, other builds
without the bridge show encryption as unavailable. Tests: `pnpm --filter stoat.js test` (SDK flows with a fake
core) and `mise test:unit` (includes the real wasm core through the SDK).

### dur.io fork: desktop build

There is no browser web client (O3): for-web ships only inside the Windows client (`for-desktop`, stage 7),
which serves a local build from `app://durio/`. Build it with `mise build:desktop` (= `node
packages/client/desktop/fetch-rnnoise.mjs && vite build --mode desktop` + `desktop/check-build.mjs`) →
`packages/client/dist-desktop/`. The desktop mode (`packages/client/desktop/plugin.ts`):

- no PWA, service worker or push worker (Web Push does not exist in Electron); no Sentry — a desktop build with
  `VITE_SENTRY_DSN` set fails, and CI checks the variable is empty; no source maps;
- base `/`, not `./`: the protocol handler answers deep routes (`/i/<host>/channel/…`) with `index.html`, and
  route-relative asset URLs would break there;
- no built-in server (O13): the address screen comes first; the bridge may suggest an address;
- the RNNoise worklet is downloaded at build time with pinned SHA-256 (`desktop/rnnoise.mjs`, not committed) and
  served from `/rnnoise/` — the desktop app loads no remote code;
- Content Security Policy from `desktop/csp.mjs`, as a `<meta>` in `index.html` and — the Electron side — as the
  `Content-Security-Policy` header of `protocol.handle` (add `frame-ancestors 'none'` there; a meta cannot):
  `script-src 'self' 'wasm-unsafe-eval'` (crypto core, RNNoise), `worker-src 'self'`, `connect-src 'self' https:
  wss: blob: data:` (servers are added at runtime and discovered by a typed host, so no list of hosts is
  possible; plain `http:`/`ws:` only with `desktopCsp({ dev: true })` for a local backend), `img-src`/`media-src`
  with `https:` and `blob:` (decrypted attachments), `style-src 'unsafe-inline'` (Solid, KaTeX, Shiki), no inline
  scripts (the build fails on one).

**Bridge contract for the Electron side** (`window.native`, preload with `contextBridge`; every IPC handler checks
`event.senderFrame.url` starts with `app://durio/`). Existing upstream members stay as they are: `versions.{node,
chrome,electron,desktop}()`, `minimise()`, `maximise()`, `close()`, `onceScreenPicker(cb)`,
`screenPickerCallback(idx, audio)`, `isWayland?()`, and `window.desktopConfig.{get,set,getAutostart,setAutostart}`
(`settings/user/Native.tsx`). dur.io adds (typed in `components/common/lib/desktop.ts`, all optional for the
page):

| Member | Contract |
| --- | --- |
| `e2eeStoreKey(accountKey): Promise<{key, created} \| Uint8Array>` | IPC `secrets:get`: 32 random bytes per accountKey (`[A-Za-z0-9_-]{1,128}`), created on first use, kept as `safeStorage.encryptString(base64)` in `userData/keys/<accountKey>.bin`. `created: true` when this call made it — with an existing crypto store that means the old key is lost (the page shows the "keys lost" wizard). The page passes the bytes straight to the crypto worker and keeps no copy |
| `e2eeDeleteStoreKey(accountKey): Promise<void>` | IPC `secrets:delete`: on sign-out (WEB-12); no error when missing |
| `focus(): void` | IPC `focus`: show, restore and focus the window (a click on a notification while the app sits in the tray) |
| `setBadgeCount(count): void` | IPC `setBadgeCount`: overlay of the taskbar button — unread mentions plus one per DM or group with unread messages, `-1` a dot for other unread messages, `0` none; muted channels do not count |
| `servers.default(): string \| undefined` | Optional prefill of the server address screen from the build of the desktop app (`electron-store`), empty by default (O13) |

Without the bridge (a plain browser) encryption is unavailable, except `vite dev`, which uses an insecure
development key in `localStorage`.

### Using the official backend

By default, the client connects to a backend running on the same host (localhost).

If you want the client to connect to the official hosted backend instead, open the .env file at /packages/client/.env and comment out the local URL varaibles like this:

```env
# connect to local Stoat instance
#VITE_API_URL=http://localhost:14702
```

When these variables are not set, the client has no default server (dur.io): it starts at the server address
screen (`/connect`) and discovers the API via `https://<host>/.well-known/stoat`. (See https://github.com/stoatchat/for-web/blob/main/packages/client/components/common/lib/env.ts)

## Deployment Guide

### Build the app

```bash
# install packages
mise install:frozen

# build dependencies
mise build:deps

# build for web
mise build

# ... when building for Stoat production
mise build:prod
```

You can now deploy the directory `packages/client/dist`.

### Routing Information

The app currently needs the following routes:

- `/login`
- `/pwa`
- `/dev`
- `/discover`
- `/settings`
- `/invite`
- `/bot`
- `/friends`
- `/server`
- `/channel`

This corresponds to [Content.tsx#L33](packages/client/src/index.tsx).
