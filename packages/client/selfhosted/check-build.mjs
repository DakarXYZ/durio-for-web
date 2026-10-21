#!/usr/bin/env node
/* global process, console */
// Checks of the self-hosted build (`vite build --mode server`) for CI and
// `mise build:server`: everything under /web/app/, no inline scripts (the server's CSP has
// no 'unsafe-inline'), PWA scoped to /web/app/, no source maps, the RNNoise worklet, the
// emoji set and the crypto wasm are packaged, no Sentry DSN, no request URLs of
// Stoat/Revolt services the app used to load from.
//
// Usage: node selfhosted/check-build.mjs [dist-server]
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const BASE = "/web/app/";

const dir = process.argv[2] ?? "dist-server";
const problems = [];

async function walk(root) {
  const out = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}

const files = (await walk(dir)).map((f) =>
  relative(dir, f).replaceAll("\\", "/"),
);
const html = await readFile(join(dir, "index.html"), "utf8");

for (const tag of html.match(/<script\b[^>]*>/gi) ?? [])
  if (!/\bsrc\s*=/.test(tag)) problems.push(`index.html: inline script ${tag}`);

for (const [, url] of html.matchAll(/\b(?:src|href)="([^"]*)"/g))
  if (url.startsWith("/") && !url.startsWith(BASE))
    problems.push(`index.html: ${url} outside ${BASE}`);

const manifest = JSON.parse(
  await readFile(join(dir, "manifest.webmanifest"), "utf8"),
);
if (manifest.scope !== BASE || manifest.start_url !== BASE)
  problems.push(`manifest: scope/start_url not ${BASE}`);

for (const file of files)
  if (file.endsWith(".map")) problems.push(`source map: ${file}`);

for (const needed of [
  "serviceWorker.js",
  "rnnoise/RNNoiseWorklet.js",
  "rnnoise/rnnoise.wasm",
  "emoji/twemoji/1f600.svg",
  "emoji/twemoji/NOTICE.txt",
])
  if (!files.includes(needed)) problems.push(`missing ${needed}`);

if (!files.some((f) => /stoat_crypto_wasm_bg-.*\.wasm$/.test(f)))
  problems.push("missing the crypto core wasm");

// as in desktop/check-build.mjs
const FETCHED_HOSTS = [
  "static.stoat.chat",
  "changelog.stoat.chat",
  "geo.revolt.chat",
  "api.gifbox.me",
  "cdn.revoltusercontent.com",
];

for (const file of files.filter((f) => f.endsWith(".js"))) {
  const source = await readFile(join(dir, file), "utf8");
  if (/https:\/\/[0-9a-f]+@[^"'`\s]*sentry\.io/.test(source))
    problems.push(`Sentry DSN in ${file}`);
  for (const host of FETCHED_HOSTS)
    if (source.includes(host)) problems.push(`${host} in ${file}`);
}

if (problems.length) {
  console.error(`server build check failed (${dir}):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`server build check ok (${files.length} files)`);
