/* eslint-disable no-undef */
// Pretty-print OpenAPI.json (2 spaces, trailing newline) so refreshes diff cleanly
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const file = resolve(dirname(fileURLToPath(import.meta.url)), "OpenAPI.json");
const spec = JSON.parse(await readFile(file, "utf8"));
await writeFile(file, JSON.stringify(spec, null, 2) + "\n");
