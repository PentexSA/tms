# Deploy de teste no Render (plano free): API e app web num container só, na
# mesma origem, para o cookie de refresh (SameSite=Strict, Path=/auth) valer
# no navegador. O Caddy na porta do Render serve o export web e repassa à API
# o que não é arquivo nem navegação (ver Caddyfile).
#
# Build a partir da raiz do repo: docker build -f deploy/render/Dockerfile .

FROM node:24-bookworm-slim AS build
COPY --from=oven/bun:1.4.3 /usr/local/bin/bun /usr/local/bin/bun
# O caddy da imagem oficial vem com cap_net_bind_service (setcap), e o Render
# nega o exec de binário com capability ("Operation not permitted"). O cp sem
# --preserve não leva o xattr, e a porta do Render (10000) dispensa a capability.
COPY --from=caddy:2.10 /usr/bin/caddy /tmp/caddy
RUN mkdir -p /out-bin && cp /tmp/caddy /out-bin/caddy
ENV HUSKY=0 CI=true
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter "@tms/api..." --filter "frontend..."

# Os dois bundles saem com o layout do repo (apps/api/src, packages/db/src):
# o productTemplate da migration 0020 lê ../../../design/templates a partir
# deles, então os JSON vão para o mesmo lugar relativo
RUN bun build apps/api/src/server.ts packages/db/src/migrate.ts \
      --outdir /out --target bun \
 && mkdir -p /out/design/templates \
 && cp design/templates/*.json /out/design/templates/

# A URL pública só existe no Render: o bundle sai com uma origem provisória,
# trocada pelo start.sh. Um worker só do Metro: o padrão passa de 2,5 GB.
WORKDIR /repo/apps/frontend
RUN EXPO_PUBLIC_API_URL=https://tms-origin.invalid npx expo export -p web \
      --output-dir /out/web --source-maps --max-workers 1 \
 && node ../../scripts/check-bundle.mjs /out/web \
 && node ../../scripts/web-headers.mjs /out/web https://tms-origin.invalid \
 && find /out/web -name '*.map' -delete

FROM oven/bun:1.4.3-slim
COPY --from=build /out-bin/caddy /usr/bin/caddy
WORKDIR /app
COPY --from=build /out ./
COPY deploy/render/Caddyfile deploy/render/start.sh ./
ENV NODE_ENV=production API_PORT=3001
CMD ["bash", "./start.sh"]
