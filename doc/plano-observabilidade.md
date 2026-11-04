# Plano de observabilidade

Como adicionar monitoramento, logs, error tracking, analytics, traces e
métricas ao TMS, do mais simples ao mais complicado, sempre com plano gratuito.
Cada fase entrega valor sozinha e cabe em um PR. Pode parar em qualquer uma.

Diagnóstico de 03/11/2026. Os limites gratuitos foram lidos nessa data nas
páginas oficiais (§8) e mudam com o tempo: confira antes de contar com eles.
As estimativas de esforço são aproximadas.

## 1. Resumo

| Fase | O que entrega | Ferramenta | Esforço |
|---|---|---|---|
| 1 | Aviso quando o site cai | UptimeRobot | 30 min, sem código |
| 2 | Logs que explicam um erro 500 | Pino (já instalado) | meio dia |
| 3 | Error tracking da API e do web | Sentry | 1–2 dias |
| 4 | Logs centralizados e pesquisáveis | Sentry Logs | 1–2 h |
| 5 | Analytics de produto e funis | PostHog | 1–2 dias |
| 6 | Traces do app até o banco | Sentry Tracing | 1 dia |
| 7 | Métricas, painéis e alertas | Sentry Metrics | 1–2 dias |
| 8 | Crashes e analytics no app nativo | Sentry + PostHog | 1–2 dias, quando for distribuir o app |
| 9 | Opcional: stack própria com OpenTelemetry | Grafana Cloud | só com um dos gatilhos da fase |

São três ferramentas no caminho principal: UptimeRobot, Sentry e PostHog. A
página do PostHog diz que o plano grátis não pede cartão; as do Sentry e do
UptimeRobot não dizem, então confira ao criar a conta.

## 2. Ponto de partida

### O que já existe

- **Logs:** Pino em JSON (`packages/logger`), log de acesso com `requestId`
  (`apps/api/src/middlewares/loggerMiddleware.ts`) e log de query sem parâmetros
  (`packages/db/src/logger.ts`). Tudo vai para o stdout, no painel do Render.
- **Health check:** `GET /health` responde `{ ok: true }` sem tocar no banco.
- **Trilha de negócio:** a tabela `chronicle_audit` já registra as ações
  administrativas (`apps/api/src/audit.ts`).
- **Cultura de privacidade:** logs sem corpo, sem headers e sem parâmetros.
  Este plano mantém essa regra.

Não há error tracking, métricas, traces nem analytics, e nenhuma dependência
dessas ferramentas no `pnpm-lock.yaml`.

### Lacunas encontradas

Testei o `loggerMiddleware` e o `onError` reais com uma rota que lança
`TypeError` (Bun 1.2.23 local; o deploy usa o 1.4.3, repetir lá ao corrigir):

```json
{"level":30,"time":"03/11/2026, 12:20:55","pid":false,"name":"api","requestId":"d49f…","method":"GET","path":"/boom/abc","status":500,"responseTime":2,"error":"TypeError","msg":"GET /boom/abc - 500"}
```

1. **Um 500 real não deixa como ser investigado.** Sai em nível `info`, só com
   o nome da classe do erro: sem stack, sem mensagem e sem nível `error`. O
   `onError` (`apps/api/src/http/on-error.ts`) não registra nada.
2. **Respostas de erro não têm `x-request-id`.** O header só é posto no
   `onAfterHandle`, que não roda em erro: o 500 e o 404 do teste saíram sem ele.
   Rota inexistente também sai sem `requestId` no log e com `responseTime: null`.
3. **O horário do log não serve para máquina.** `toLocaleString('pt-BR')` não
   tem fuso nem milissegundos (`packages/logger/src/index.ts`).
4. **O frontend não reporta erro nenhum.** Só `characters/[id].tsx` tem
   `ErrorBoundary`; o `_layout.tsx` raiz não tem, e `createQueryClient`
   (`apps/frontend/lib/queryClient.ts`) não tem tratamento global.
5. **`serialize-error` está nas dependências da API e não é usado.**

### O que o deploy impõe

O deploy atual é de teste: um container no Render free (Caddy + API) e o banco
no Neon free. Quatro restrições moldam as escolhas:

- **O serviço dorme após 15 min sem tráfego e o disco é efêmero.** Prometheus
  por pull e qualquer stack hospedada no mesmo container estão fora. A telemetria
  precisa ser enviada para fora, por push.
- **O Neon free tem 100 CU-h por mês e suspende o compute quando acaba.** Ele
  dorme após 5 min ocioso. Um monitor que toque o banco a cada 5 min nunca o deixa
  dormir: com o mínimo de 0,25 CU, 744 h × 0,25 = **186 CU-h, e o banco cai antes
  do fim do mês**. Monitor frequente só em rota sem banco.
- **`bun build` empacota as dependências, e a imagem final não tem
  `node_modules`.** Instrumentação por monkey-patch, como a do `pg` no
  OpenTelemetry, exige `--external pg` e levar `node_modules` junto. Por isso os
  spans de banco saem do hook `log` do Kysely (Fase 6).
- **A CSP é restrita.** `connect-src` só libera a própria origem e
  `script-src` é `'self'` (`scripts/web-headers.mjs`). Toda ferramenta do web
  precisa entrar ali, e o E2E já falha se houver violação.

## 3. Regras para todas as fases

1. **O que nunca sai do servidor ou do aparelho:** conteúdo de ficha, notas,
   NPC oculto, rolagem oculta, e-mail, nome, senha, tokens, cookies e código de
   convite. O plano v5 trata vazamento de dado oculto como risco principal, e isso
   vale também para a telemetria.
2. **Sem session replay**, mesmo com cota grátis. A tela do narrador mostra o que
   o jogador não pode ver, e o replay copiaria isso para um terceiro.
3. **Um único ponto de entrada.** O código chama `lib/telemetry` e
   `lib/analytics`, nunca o SDK direto, com `.web.ts` e `.native.ts` como em
   `sheet/sync/storage`. Trocar de ferramenta vira mudança em um arquivo.
4. **Sem DSN ou chave, tudo desligado.** Desenvolvimento, Jest, Bun test e E2E
   não enviam nada. Variáveis opcionais em `packages/config/src/env.ts` e
   `.env.example`.
5. **Teste canário de privacidade.** Cada integração ganha um teste que passa um
   valor marcado (e-mail, token, texto de nota) pelo filtro de saída e prova que
   ele não sai.
6. **Rótulos com baixa cardinalidade.** Métrica e evento usam o template da rota
   (`/chronicles/:id`, `ctx.route` no Elysia), nunca a URL com UUID.
7. **Versões exatas**, como o resto do repo, e `release` igual à versão do
   `package.json` da raiz, a que o `pnpm release` sobe.

## 4. Fases

### Fase 1. Monitor de disponibilidade

**Ferramenta:** UptimeRobot. O plano grátis tem 50 monitores a cada 5 min, com
checagem por palavra-chave, e se declara válido para uso pessoal e comercial.

1. Criar monitor do tipo **keyword** em `GET https://<app>/health`, esperando
   `"ok":true`.
2. Criar um segundo monitor na página inicial, para o Caddy e o export web.
3. Alertar por e-mail.

**Por que keyword, e não só o status 200:** o Caddyfile devolve o `index.html`
com 200 para qualquer `GET` com `Accept: text/html`. Um monitor que mande esse
header veria "no ar" com a API caída.

**Efeito colateral:** o ping a cada 5 min mantém o serviço acordado e elimina o
cold start de cerca de 1 min. Isso usa até 744 das 750 h grátis do workspace por
mês, então só cabe **um** serviço free nele: um segundo esgotaria as horas e
suspenderia os dois. O Neon continua dormindo, porque `/health` não toca no banco.

**Pronto quando:** derrubar o serviço gera um e-mail em até 10 min.

### Fase 2. Logs que explicam o erro

Só código, sem conta nova.

1. **Registrar o 500:** no `default` do `onError`, `logger.error` com nome,
   `code` e stack.
2. **Filtrar o que sai**, numa função única (`safeError`) que a Fase 3 reaproveita.
   Erro do Postgres sai só com o SQLSTATE, porque a mensagem repete valores
   (`Key (email)=(...)`). Nos demais, a mensagem passa por redação de e-mail, JWT
   e `Bearer`. Teste canário.
3. **`requestId` em toda resposta:** gerar antes de a requisição poder falhar e
   testar 200, 404 e 500. Adicionar `exposeHeaders: ['x-request-id']` no CORS,
   para o web ler o id quando estiver em outra origem.
4. **Mostrar o id ao usuário** na mensagem de erro 500 ("código do erro: abc123"),
   para que um relato de bug vire uma busca no log.
5. **Nível por status:** 5xx em `error`, 429 em `warn`, o resto em `info`.
6. **Horário ISO 8601** com `pino.stdTimeFunctions.isoTime`.
7. **Campos fixos:** `route` (template), `release` e `service`.
8. **Tirar `/health` do log de acesso:** o health check do Render e o monitor só
   gerariam ruído e gastariam cota.
9. **Query lenta:** `warn` acima de 500 ms no `kyselyLogger`, com o SQL em
   placeholders, como já é.
10. **Remover `serialize-error`**, ou usá-lo no `safeError`.

**Versão do cliente em toda requisição**

Todo pedido do app à API leva o header `x-tms-client-version: 1.2.0`, para saber
qual versão gerou cada log, erro e métrica.

1. **Header novo:** não reaproveitar o `x-tms-client`, porque o valor `native` dele
   decide o transporte do refresh token (`apps/api/src/auth/routes.ts`). A presença
   desse header já separa nativo de web.
2. **Um único ponto de envio:** colocar o header em `fetchWithTimeout`
   (`apps/frontend/lib/http.ts`). O cliente Eden e os `POST` de sessão, que não
   passam pelo `createAuthFetch`, usam essa função, então nenhum pedido fica de fora.
3. **Versão correta:** `APP_VERSION` já existe em `lib/persist.tsx`, mas lê o
   `app.json`, parado em `1.0.0` enquanto a release está em `1.2.0`. O
   `pnpm release` (`scripts/release.sh`) passa a subir as duas versões juntas.
   **Consequência:** essa constante também é o `buster` do cache persistido, então
   cada release descarta o cache de leitura uma vez. O comentário no código indica
   que isso é intencional, e os dados são buscados de novo com rede.
4. **CORS:** acrescentar o header a `allowedHeaders` em `apps/api/src/index.ts`. Sem
   isso, o preflight falha no web em desenvolvimento e todas as chamadas quebram.
   Em produção, o web está na mesma origem. Cobrir no E2E.
5. **Na API, tratar como dado não confiável:** aceitar só semver curto
   (`^\d{1,4}\.\d{1,4}\.\d{1,4}$`) e registrar `clientVersion` no log de acesso, ou
   `unknown` se vier ausente ou inválido. O regex limita a cardinalidade e impede
   injeção de texto no log.
6. **Só para observar:** nesta fase, o header não libera nem bloqueia nada. Monitor
   e chamadas externas não o enviam, e a API deve seguir respondendo normalmente.

**Pronto quando:** um 500 forçado aparece em nível `error`, com stack, e o id da
resposta encontra a linha do log, que também mostra a versão do cliente.

### Fase 3. Error tracking (API e web)

**Ferramenta:** Sentry, plano Developer: 5 mil erros, 5 milhões de spans, 5 GB de
logs e 5 GB de métricas por mês, histórico de 30 dias, **1 usuário**. O mesmo
produto cobre as Fases 4, 6 e 7. Acima da cota, os eventos são recusados.

**Conta:** escolher a região na criação (sugestão: UE, a mesma do PostHog).

**API**

1. **Começar com uma validação de meio dia.** O `@sentry/elysia` atende à versão
   do projeto (Elysia 1.4.30), mas a documentação o marca como **alpha**. Validar
   o build com `bun build` no Docker e o consumo de memória.
2. **Se falhar**, usar `@sentry/bun` e `captureException` no `default` do `onError`.
   O `pinoIntegration` da Fase 4 é documentado nesse SDK; os spans por rota da
   Fase 6 passariam a ser manuais.
3. Chamar `Sentry.init` só em `apps/api/src/server.ts`: `createApp` é usado nos
   testes e não pode enviar nada.
4. **Saída filtrada:** `sendDefaultPii: false`, `beforeSend` com `safeError`, sem
   corpo, headers ou cookies. Capturar só 5xx, nunca `ApiError` de 4xx (é o padrão
   do `shouldHandleError`).
5. Adicionar `SENTRY_DSN` ao `env.ts`, ao `.env.example` e ao `render.yaml`.
6. Marcar cada erro com a tag `client.version`, vinda do valor validado na Fase 2,
   para ver se um erro da API atinge só uma versão do app.

**Web** (o nativo fica para a Fase 8)

1. `lib/telemetry.web.ts` com `@sentry/react`, e `telemetry.native.ts` sem efeito
   por enquanto. Assim o build nativo não muda agora.
2. **Pontos de captura:**
   - `ErrorBoundary` no `_layout.tsx` raiz;
   - `QueryCache` e `MutationCache` em `createQueryClient`, ignorando 4xx e falha
     de rede (o app funciona offline, e isso gastaria a cota rápido);
   - falhas definitivas da fila em `sheet/sync/sender.ts`, onde o usuário pode
     perder edição.
3. **Breadcrumbs:** desligar os de console e de clique, que podem carregar texto
   da tela. Manter navegação com template e HTTP sem query string.
4. **CSP:** acrescentar o host exato do DSN em `connect-src`, em
   `scripts/web-headers.mjs`. O `headers.spec.ts` continua passando, porque só
   confere o trecho inicial da diretiva.

**Source maps** (`deploy/render/Dockerfile`)

1. Entre o `expo export` e o `find -delete`, rodar `sentry-cli sourcemaps inject`
   e `upload`. Eles já são gerados e apagados nesse trecho; os maps continuam fora
   da imagem final.
2. O token entra como secret file no build do Render (`--mount=type=secret`;
   confirmar na documentação). Sem token, o build segue sem upload, para o deploy
   não depender do Sentry.
3. **Risco a conferir:** o `start.sh` troca `tms-origin.invalid` pela URL pública
   com `sed` depois do build, o que muda o tamanho da linha e pode deslocar as
   colunas do mapa nos módulos com a URL. Se o stack sair errado ali, o web pode
   usar `window.location.origin`, já que API e app têm a mesma origem nesse deploy.

**Alertas:** e-mail para issue nova e para regressão.

**Pronto quando:** um erro forçado na API e outro no web chegam com stack legível
e a versão certa, e o teste canário passa.

### Fase 4. Logs centralizados

**Ferramenta:** `pinoIntegration` do Sentry. O logger não muda, os logs passam a
ser pesquisáveis por 30 dias e ficam ligados aos erros.

1. Ativar a integração com níveis `info` para cima. O projeto usa Pino 10.4, dentro
   da faixa suportada (`>=8 <11`).
2. **Validar no bundle do `bun build`**, porque a documentação cobre o SDK do Bun
   mas não fala do Elysia nem de bundling.
3. Acompanhar o volume na primeira semana (cota de 5 GB).

**Plano B:** Render Log Stream para o Better Stack, sem código: 3 GB com 3 dias de
retenção, "free for personal projects".

**Pronto quando:** dá para achar um `requestId` no Sentry.

### Fase 5. Analytics de produto

**Ferramenta:** PostHog, com hospedagem na UE: 1 milhão de eventos por mês, 1 ano
de retenção, sem limite de usuários no painel, sem cartão.

**Antes de instalar**

1. O app **não tem aviso de privacidade**. Criar uma tela que diga o que é coletado
   e por quem, e uma opção de desligar em Conta. A base legal (consentimento ou
   legítimo interesse) é a decisão 2 do §7.
2. Identificar o usuário só por id opaco, sem e-mail ou nome como propriedade.
3. Ligar o `DELETE /me` à exclusão da pessoa no PostHog (LGPD art. 18, VI), como
   a exclusão de conta já decide em `doc/plano-v0.md`.

**Instalação**

1. `posthog-react-native` atrás de `lib/analytics`. A documentação prevê uso no web
   e no Expo. Validar com a CSP. Plano B no web: `posthog-js` com
   `disable_external_dependency_loading`.
2. `captureTouches` desligado, session replay desligado e **error tracking do
   PostHog desligado**, para não duplicar o Sentry.
3. O Expo Router usa React Navigation 7, então `captureScreens: false` e
   `posthog.screen()` manual, com o template da rota (`useSegments`), sem UUID.
4. Acrescentar `https://eu.i.posthog.com` à CSP.

**Eventos iniciais.** Poucos, nomeados e só com propriedades categóricas:

| Evento | Propriedades |
|---|---|
| `signup_completed` | — |
| `chronicle_created` | `system_family` |
| `invite_created`, `invite_accepted` | — |
| `character_creation_started`, `_submitted`, `_completed` | `system_family`, `mode` |
| `roll_made` | `system_family`, `hidden`, sem resultado nem nome |
| `xp_request_created` | — |
| `session_refresh_failed` | `reason` |

O último ajuda a investigar o "reinicio a página e sou deslogado" anotado em
`pontos-de-melhoria.md`.

**Histórico e conferência:** o PostHog só conta a partir da instalação e não vê
quem não autorizou a coleta. Se um dia precisar do passado ou do total real, a
`chronicle_audit` responde com uma consulta avulsa, usando um role só de leitura
e sem a coluna `payload`.

**Primeiros painéis:** o funil cadastro → crônica → convite aceito → ficha
concluída → primeira rolagem, retenção semanal e o uso por sistema.

**Pronto quando:** o funil aparece no painel e o usuário consegue desligar a coleta.

### Fase 6. Traces

**Ferramenta:** Sentry Tracing, com o mesmo SDK. Liga o clique no app, a rota da API
e as queries, e dá de brinde latência por rota e Web Vitals no web.

1. **API:** `tracesSampleRate` em 1.0 enquanto o tráfego for pequeno. Cortar o
   `/health`.
2. **Web:** `browserTracingIntegration` e `tracePropagationTargets` só com a URL
   da API, para os ids não irem a terceiros.
3. **CORS:** acrescentar `sentry-trace` e `baggage` a `allowedHeaders` em
   `apps/api/src/index.ts`. Na produção é a mesma origem, mas sem isso o preflight
   quebra em desenvolvimento. Cobrir no E2E.
4. **Banco:** criar os spans no `kyselyLogger`, em `packages/db/src/client.ts`, que
   já recebe o SQL com placeholders e a duração, sem depender de monkey-patch (§2).
5. **Rotas críticas:** spans manuais em concluir ficha, dano em grupo e Nova noite,
   para ver transação e `FOR UPDATE`.
6. Colocar o `trace_id` nos logs do Pino.

**Pronto quando:** uma ação no web aparece como um único trace até as queries.

### Fase 7. Métricas, painéis e alertas

**Ferramenta:** Sentry Metrics (5 GB, 10 painéis, 20 monitores de métrica). Latência,
taxa de erro e vazão por rota **já vêm dos traces**, então aqui só entra o que eles
não mostram:

| Métrica | Por quê |
|---|---|
| Falhas e tamanho da fila offline (`sheet/sync`) | perda de edição é o pior erro do produto |
| `session.refresh` por resultado | deslogar sem motivo |
| `rate_limit.hit` por rota | limite mal calibrado ou abuso |
| Replays de comando idempotente | rede ruim e retry do cliente |
| `waitingCount` do pool do `pg` | conexão esgotada (o pool usa o padrão, sem `max` configurado) |
| Memória (RSS) da API | a instância free é pequena, e o Sentry soma consumo |
| Cold starts e duração das migrations | custo real de dormir e subir |
| Requisições e 5xx por `client.version` | quem está em versão antiga e quando dá para aposentá-la |

**Alertas iniciais:** poucos, para continuarem sendo lidos. Taxa de 5xx acima de 2%
por 10 min, p95 acima de 2 s nas rotas críticas e qualquer falha definitiva da fila.

**Pronto quando:** um único painel diz se o sistema está saudável, e cada alerta
tem uma ação clara.

### Fase 8. App nativo

**Gatilho:** quando o app for distribuído. Hoje não há `eas.json`, e o CI só faz
build de debug. Se a loja vier antes, esta fase sobe na ordem, logo depois da Fase 5.

1. `@sentry/react-native` com `npx expo install`, plugin no `app.json` e
   `getSentryExpoConfig` no `metro.config.js`, mantendo o `withNativeWind` e o
   resolver `SOURCE`.
2. Preencher `telemetry.native.ts` com a mesma interface, e ligar o `report` de
   `sheet/sync/storage.native.ts`.
3. Rodar `pnpm check:native` e `expo install --check`. Os jobs `native-android` e
   `native-ios` do CI confirmam o build.
4. Conferir que o header da Fase 2 sai com a versão do build instalado no aparelho,
   e não com a da última release.
5. Upload de símbolos nativos no build de distribuição, e ligar o PostHog no nativo.

**Pronto quando:** um crash JS e um nativo forçados chegam legíveis, nas duas
plataformas.

### Fase 9. Stack própria com OpenTelemetry (opcional)

**Ferramenta:** Grafana Cloud Free: 10 mil séries, 50 GB de logs, 50 GB de traces,
retenção de 14 dias, 3 usuários, mais 100 mil execuções de teste sintético e 500
VU-hora de k6 por mês. Acima dos limites, os dados são descartados.

**Só faça com um destes gatilhos:**

- mais de uma pessoa precisa ver traces e métricas (o Sentry free tem 1 usuário);
- as cotas do Sentry não bastam;
- o projeto sai do Render e passa a ter ambiente de produção real.

**O que muda:** `@elysiajs/opentelemetry` com exportação OTLP por push, spans do
Kysely no mesmo hook da Fase 6 e `pg` como `--external` apenas se precisar da
instrumentação automática. Com OpenTelemetry próprio, ligar `skipOpenTelemetrySetup`
ou deixar o Sentry só com erros, para não duplicar spans.

Dá para acrescentar, sem migrar nada: testes sintéticos de login, SLOs e teste de
carga com k6 no banco descartável.

## 5. Por que estas ferramentas

| Necessidade | Escolha | Principal alternativa | Por que não a alternativa |
|---|---|---|---|
| Uptime | UptimeRobot | Better Stack (10 monitores, status page) | Grátis "para projetos pessoais"; o UptimeRobot aceita uso comercial e tem mais monitores |
| Erros | Sentry | PostHog (100 mil exceções, sem limite de usuários) | Sentry tem SDK para Elysia e Expo, source maps e traces. **É a saída se houver mais de um dev** |
| Logs | Sentry Logs | Better Stack via Render Log Stream | Retenção de 3 dias contra 30 |
| Traces | Sentry | Grafana Tempo com OpenTelemetry | Mais trabalho no Bun com bundle; fica para a Fase 9 |
| Métricas | Sentry Metrics | Grafana Cloud | Melhor produto, mas mais uma ferramenta e 14 dias de retenção |
| Analytics | PostHog | Plausible, Umami | Focados em site; o TMS precisa de funil e de nativo |

**Descartados por agora**

- **Prometheus, Grafana, Loki ou Tempo auto-hospedados, SigNoz e GlitchTip:**
  grátis em licença, mas exigem servidor sempre ligado e com disco, que o projeto
  não tem. Prometheus também exigiria expor `/metrics`, e o Caddy repassa à API
  tudo que não é arquivo, então a rota ficaria pública.
- **Session replay em qualquer ferramenta:** §3, regra 2.

## 6. Limites e como não estourar

| Ferramenta | Limite que pesa | Proteção |
|---|---|---|
| Sentry | 5 mil erros por mês, 1 usuário | Ignorar 4xx e falha de rede; rate limit por DSN; Spike Protection; sem orçamento pay-as-you-go |
| Sentry | 5 GB de logs | Sem `debug`, sem `/health`; revisar na primeira semana |
| PostHog | 1 milhão de eventos | Só eventos nomeados, sem autocapture de toque |
| Neon | 100 CU-h | Nada frequente no banco; `/ready` com banco, se criado, só sob demanda (uma vez por hora já custa cerca de 16 CU-h por mês) |
| Render | 750 h por workspace | Um serviço free só |

## 7. Decisões para tomar

| # | Decisão | Quando | Sugestão |
|---|---|---|---|
| 1 | Quantas pessoas precisam ver os erros? | Antes da Fase 3 | Sentry se for 1. Se forem mais, PostHog para erros e deixar traces para a Fase 9 |
| 2 | Base legal do analytics: consentimento (opt-in) ou legítimo interesse com opt-out | Antes da Fase 5 | Opt-in é o caminho mais seguro, com menos dados. Vale uma revisão jurídica se o app abrir ao público |
| 3 | Manter o serviço sempre acordado pelo ping? | Fase 1 | Sim, enquanto houver um único serviço free |
| 4 | Quando o app nativo será distribuído? | Define a posição da Fase 8 | Depois da Fase 7, salvo se a loja vier antes |

## 8. Fontes

Consultadas em 03/11/2026.

- [Sentry: preços](https://sentry.io/pricing/) e [cotas](https://docs.sentry.io/pricing/quotas/)
- [Sentry para Elysia](https://docs.sentry.io/platforms/javascript/guides/elysia/), [Expo](https://docs.sentry.io/platforms/react-native/manual-setup/expo/) e [integração com Pino](https://docs.sentry.io/platforms/javascript/guides/bun/configuration/integrations/pino/)
- [PostHog: preços](https://posthog.com/pricing.md) e [SDK React Native](https://posthog.com/docs/libraries/react-native)
- [Grafana Cloud: preços](https://grafana.com/pricing/) e [descarte acima dos limites](https://community.grafana.com/t/what-happens-when-my-usage-exceed-the-free-plan-limitations/102795)
- [UptimeRobot: preços](https://uptimerobot.com/pricing/)
- [Better Stack: preços](https://betterstack.com/pricing)
- [Neon: preços](https://neon.com/pricing)
- [Render: plano free](https://render.com/docs/free) e [Log Streams](https://render.com/docs/log-streams)
- [Elysia: OpenTelemetry](https://elysiajs.com/patterns/opentelemetry)
