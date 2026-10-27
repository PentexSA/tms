#!/usr/bin/env bash
# Túnel público para a API (porta 3001), para o app web e o Android:
#   pnpm tunel
#
# Sobe o cloudflared (baixa para ~/.local/bin se faltar), grava a URL em
# EXPO_PUBLIC_API_URL no .env da raiz e no apps/frontend/.env e fica rodando
# até o Ctrl+C. Não usa o ngrok: no plano gratuito ele responde aos GET do
# navegador com uma página de aviso, sem CORS, e o app web não lê a API.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BIN=$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")
if [ ! -x "$BIN" ]; then
  echo "Baixando o cloudflared para ~/.local/bin..."
  mkdir -p "$HOME/.local/bin"
  curl -fsSL -o "$HOME/.local/bin/cloudflared" \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x "$HOME/.local/bin/cloudflared"
  BIN=$HOME/.local/bin/cloudflared
fi

curl -s -o /dev/null http://localhost:3001/swagger ||
  echo "Aviso: a API não responde em localhost:3001. Suba a API antes de testar."

# Um túnel por vez: o anterior aponta para uma URL que sai dos .env agora
pkill -f 'cloudflared tunnel .*localhost:3001' || true

LOG=$(mktemp)
"$BIN" tunnel --no-autoupdate --url http://localhost:3001 >"$LOG" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; rm -f "$LOG"' EXIT

URL=''
for _ in $(seq 1 60); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  kill -0 $PID 2>/dev/null || { cat "$LOG"; exit 1; }
  sleep 1
done
if [ -z "$URL" ]; then
  echo "O cloudflared não deu uma URL em 60 s:"
  cat "$LOG"
  exit 1
fi

for f in "$ROOT/.env" "$ROOT/apps/frontend/.env"; do
  touch "$f"
  if grep -q '^EXPO_PUBLIC_API_URL=' "$f"; then
    sed -i "s#^EXPO_PUBLIC_API_URL=.*#EXPO_PUBLIC_API_URL=$URL#" "$f"
  else
    echo "EXPO_PUBLIC_API_URL=$URL" >>"$f"
  fi
done

echo
echo "Túnel no ar: $URL"
echo "A URL foi gravada no .env e no apps/frontend/.env."
echo "Deixe este terminal aberto. Agora (re)inicie o Expo com --clear."
echo
wait $PID
