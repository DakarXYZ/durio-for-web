#!/bin/sh
# Refresh OpenAPI.json from the dur.io backend (WEB-01): build delta from a stoatchat checkout,
# run it and save its /openapi.json. Needs Docker, the durio-rust-dev:local image and the test
# services of tools/rust-dev/test-env.sh (delta connects to MongoDB, Redis and RabbitMQ on start).
#
#   tools/rust-dev/test-env.sh up
#   for-web/packages/stoat-api/dump-openapi.sh stoatchat        # from the workspace root
#   tools/rust-dev/test-env.sh down
#   pnpm --filter @durio/stoat-api generate && pnpm --filter @durio/stoat-api build
#
# Webhooks are enabled so that their routes are in the spec (the SDK uses them).
set -eu
SRC=$(cd "${1:?usage: dump-openapi.sh <stoatchat dir>}" && (pwd -W 2>/dev/null || pwd))
OUT=$(cd "$(dirname "$0")" && (pwd -W 2>/dev/null || pwd))

# The dev image has no curl: delta runs detached with its port published, the host fetches the spec
NAME=durio-openapi-delta
docker rm -f $NAME >/dev/null 2>&1 || true
MSYS_NO_PATHCONV=1 docker run -d --name $NAME --memory 6g --network durio-test -p 127.0.0.1:24702:14702 \
    -v "$SRC:/src" -v durio-cargo-target:/target -v durio-cargo-registry:/usr/local/cargo/registry \
    -w /src -e CARGO_TARGET_DIR=/target \
    -e REVOLT__DATABASE__REDIS=redis://durio-test-redis/ -e REVOLT__RABBIT__HOST=durio-test-rabbit \
    -e REVOLT__DATABASE__MONGODB=mongodb://durio-test-mongo/?replicaSet=rs0 \
    -e REVOLT__FEATURES__WEBHOOKS_ENABLED=true \
    durio-rust-dev:local sh -c 'cargo build -j 3 -p revolt-delta && exec /target/debug/revolt-delta' >/dev/null

i=0
until curl -sf http://127.0.0.1:24702/openapi.json -o "$OUT/OpenAPI.json"; do
    i=$((i + 1))
    if [ $i -ge 1800 ] || ! docker inspect -f '{{.State.Running}}' $NAME 2>/dev/null | grep -q true; then
        docker logs --tail 30 $NAME; docker rm -f $NAME >/dev/null; exit 1
    fi
    sleep 1
done
docker rm -f $NAME >/dev/null

# Stable formatting, so that a refresh only shows real changes in git
node "$(dirname "$0")/format-spec.mjs"
echo "OpenAPI.json updated from $SRC"
