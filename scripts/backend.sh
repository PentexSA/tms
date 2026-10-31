#!/usr/bin/env bash
# Backend inteiro atrás do túnel público, num terminal só:
#   pnpm backend
#
# Sobe o Postgres (Docker, se o DATABASE_URL for local), roda as migrations,
# sobe a API (porta 3001, com hot reload) e abre o túnel do trycloudflare
# (scripts/tunel.sh), que grava a URL em EXPO_PUBLIC_API_URL no .env da raiz e
# no apps/frontend/.env. Depois é só, em outro terminal:
#   cd apps/frontend && npx expo start --clear
# Ctrl+C derruba a API e o túnel; o Postgres continua (pnpm db:down para).
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
PNPM=(pnpm)
command -v pnpm >/dev/null || PNPM=(npx pnpm)

[ -f .env ] || { echo "Falta o .env: cp .env.example .env"; exit 1; }

if grep -qE '^DATABASE_URL=.*@(localhost|127\.0\.0\.1)[:/]' .env; then
  docker info >/dev/null 2>&1 ||
    { echo "O Docker não está rodando. Inicie o Docker e tente de novo."; exit 1; }
  echo "Subindo o Postgres..."
  docker compose up -d --wait
fi

echo "Compilando os pacotes da API e rodando as migrations..."
"${PNPM[@]}" turbo run build --filter='@tms/api^...' --output-logs=errors-only
"${PNPM[@]}" db:migrate

# Uma API por vez: outra na 3001 faria esta cair com a porta ocupada
if curl -s -o /dev/null http://localhost:3001/health; then
  echo "Já há algo respondendo em localhost:3001. Pare essa API e tente de novo."
  exit 1
fi

echo "Subindo a API..."
(cd apps/api && exec bun run dev) &
API=$!
trap 'kill $API 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -s -o /dev/null http://localhost:3001/health && break
  kill -0 $API 2>/dev/null || { echo "A API não subiu (veja o erro acima)."; exit 1; }
  sleep 1
done
curl -s -o /dev/null http://localhost:3001/health ||
  { echo "A API não respondeu em 60 s."; exit 1; }

bash "$ROOT/scripts/tunel.sh"
