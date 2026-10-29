#!/usr/bin/env bash
# Start do container do Render: troca a origem provisória do bundle pela URL
# pública, roda as migrations e sobe a API e o Caddy. Se um dos dois cai, o
# container sai e o Render reinicia.
set -euo pipefail
cd "$(dirname "$0")"

PLACEHOLDER=https://tms-origin.invalid
ORIGIN=${PUBLIC_URL:-${RENDER_EXTERNAL_URL:?defina PUBLIC_URL}}
export CORS_ORIGINS=${CORS_ORIGINS:-$ORIGIN}

grep -rlF "$PLACEHOLDER" web | xargs -r sed -i "s#$PLACEHOLDER#$ORIGIN#g"

# _headers (formato Netlify/Pages, do scripts/web-headers.mjs) para o Caddy
if [ -f web/_headers ]; then
  sed -n 's/^  \([^:]*\): \(.*\)$/header \1 "\2"/p' web/_headers >headers.caddy
  rm web/_headers
fi

bun packages/db/src/migrate.js up

bun apps/api/src/server.js &
caddy run --config Caddyfile --adapter caddyfile &
wait -n
exit $?
