# @durio/stoat-api

Types and a typed HTTP client (`API`) for the dur.io backend, generated from its OpenAPI spec (WEB-01).
It has the same shape as upstream [`stoat-api`](https://www.npmjs.com/package/stoat-api) and replaces it:
the SDK (`packages/stoat.js`) imports it under the old name through a pnpm alias, so imports don't change:

```json
"stoat-api": "workspace:@durio/stoat-api@*"
```

After publishing to npm (deploy step) the alias becomes `"stoat-api": "npm:@durio/stoat-api@<version>"`,
the version matching the backend image tag (C13).

## Files

| File | What |
| --- | --- |
| `OpenAPI.json` | Generation input: `/openapi.json` of our delta (stoatchat `durio/stage-5`), webhooks enabled |
| `codegen.mjs` | Generator, a port of the `@insertish/oapi` CLI that upstream uses (identical output for the same spec) |
| `src/index.ts` | `API` class, copied from `stoat-api` 0.15.3 — **not** generated |
| `src/{schema,routes,params,types,baseURL}.ts` | Generated, committed so that a fresh clone builds without a generation step |
| `dump-openapi.sh` | Refreshes `OpenAPI.json` from a stoatchat checkout (builds and runs delta in Docker) |

## Regenerate

```bash
# types from the committed spec (one command, reproducible)
pnpm --filter @durio/stoat-api generate && pnpm --filter @durio/stoat-api build

# refresh the spec from the backend first (workspace root; needs Docker)
tools/rust-dev/test-env.sh up
for-web/packages/stoat-api/dump-openapi.sh stoatchat
tools/rust-dev/test-env.sh down
```

`pnpm install` builds `lib/` through the `prepare` script.
