# durio-web: the browser client a dur.io server hosts at /web/app/ (durio-self-hosted).
# The app is built outside (`mise build:server` → packages/client/dist-server), so the
# image is only the static files and Caddy. Build from the repository root:
#   docker build -f docker/durio-web/Dockerfile .
FROM docker.io/library/caddy:2.10.2-alpine

# the stock binary carries cap_net_bind_service as a file capability, which makes it fail
# to start with no-new-privileges and all capabilities dropped; port 8080 needs none
RUN apk add --no-cache --virtual .setcap libcap   && setcap -r /usr/bin/caddy   && apk del .setcap

COPY docker/durio-web/Caddyfile /etc/caddy/Caddyfile
COPY packages/client/dist-server /srv/web/app

# no root needed: port 8080; Caddy's own state (no certificates here) goes to a tmpfs
ENV XDG_DATA_HOME=/tmp XDG_CONFIG_HOME=/tmp
USER 65534:65534
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1:8080/web/app/ || exit 1
