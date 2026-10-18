#!/usr/bin/env node
/* global process, console */
// Checks of the desktop build (plan WEB-09, WEB-11) for CI and `mise build:desktop`:
// the CSP is in place, no inline scripts, no service worker, PWA manifest, push worker or
// source maps, the RNNoise worklet and the crypto wasm are packaged, no Sentry DSN.
//
// Usage: node desktop/check-build.mjs [dist-desktop]
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

import { DESKTOP_CSP } from "./csp.mjs";

const dir = process.argv[2] ?? "dist-desktop";
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

const csp = html.match(
  /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/,
);
if (!csp) problems.push("index.html: no CSP <meta>");
else if (
  csp[1]
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&") !== DESKTOP_CSP
)
  problems.push("index.html: CSP differs from desktop/csp.mjs");

for (const tag of html.match(/<script\b[^>]*>/gi) ?? [])
  if (!/\bsrc\s*=/.test(tag)) problems.push(`index.html: inline script ${tag}`);

if (/rel="manifest"/.test(html)) problems.push("index.html: PWA manifest link");

for (const file of files) {
  if (
    /^(serviceWorker|sw|workbox)/i.test(file) ||
    file.endsWith(".webmanifest")
  )
    problems.push(`service worker / PWA file: ${file}`);
  if (/pushWorker/i.test(file)) problems.push(`push worker: ${file}`);
  if (file.endsWith(".map")) problems.push(`source map: ${file}`);
}

for (const needed of ["rnnoise/RNNoiseWorklet.js", "rnnoise/rnnoise.wasm"])
  if (!files.includes(needed)) problems.push(`missing ${needed}`);

if (!files.some((f) => /stoat_crypto_wasm_bg-.*\.wasm$/.test(f)))
  problems.push("missing the crypto core wasm");

for (const file of files.filter((f) => f.endsWith(".js"))) {
  const source = await readFile(join(dir, file), "utf8");
  if (/https:\/\/[0-9a-f]+@[^"'`\s]*sentry\.io/.test(source))
    problems.push(`Sentry DSN in ${file}`);
  if (
    /navigator\.serviceWorker\.register\(/.test(source) &&
    /registerSW/.test(source)
  )
    problems.push(`service worker registration in ${file}`);
}

if (problems.length) {
  console.error(`desktop build check failed (${dir}):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`desktop build check ok (${files.length} files)`);
