# Plano de observabilidade

Como adicionar monitoramento, logs, error tracking, analytics, traces e
métricas ao TMS, do mais simples ao mais complicado, sempre com plano gratuito.
Cada fase entrega valor sozinha, com PRs menores quando necessário. Pode parar
em qualquer uma. A Fase 5 foi revisada em 05/11/2026 para começar pelos dados
existentes e adiar a integração externa até haver uma necessidade concreta.

Diagnóstico de 03/11/2026. Os limites gratuitos foram lidos nessa data nas
páginas oficiais (§8) e mudam com o tempo: confira antes de contar com eles.
As estimativas de esforço são aproximadas.

## 1. Resumo

| Fase | O que entrega | Ferramenta | Esforço |
|---|---|---|---|
| 1 | Aviso quando o site cai | UptimeRobot | 30 min, sem código |
| 2 | Logs que explicam um erro 500 | Pino (já instalado) | meio dia |
| 3 | Error tracking da API e do web | Sentry | 1–2 dias |
| 4 | Logs centralizados e pesquisáveis | Sentry Logs | meio dia |
| 5a | Funis e retenção sobre dados existentes, sob demanda | SQL + script local | 0,5–1 dia, a validar pelas consultas |
| 5b | Analytics contínuo, quando necessário | PostHog pela API | 3–5 dias, a reestimar após prova do transporte |
| 6 | Traces do app até o banco | Sentry Tracing | 1 dia |
| 7 | Métricas, painéis e alertas | Sentry Metrics | 1–2 dias |
| 8 | Crashes e analytics no app nativo | Sentry + coletor da 5b, se ativo | 1–2 dias, quando for distribuir o app |
| 9 | Opcional: stack própria com OpenTelemetry | Grafana Cloud | só com um dos gatilhos da fase |

O caminho inicial usa UptimeRobot e Sentry; o PostHog entra somente na Fase 5b.
Na consulta original, a página do PostHog dizia que o plano grátis não pede
cartão; conferir condições, cotas e retenção antes de ativar a integração.

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
   NPC oculto, conteúdo de rolagem oculta, e-mail, nome, senha, tokens, cookies e código de
   convite. O plano v5 trata vazamento de dado oculto como risco principal, e isso
   vale também para a telemetria.
2. **Sem session replay**, mesmo com cota grátis. A tela do narrador mostra o que
   o jogador não pode ver, e o replay copiaria isso para um terceiro.
3. **Um único ponto de entrada por integração.** No app, `lib/telemetry` e
   `lib/analytics`, com resolução por plataforma como em `sheet/sync/storage`.
   Na Fase 5b, o app fala só com o coletor da API, e a fachada do servidor
   concentra o transporte PostHog; nenhuma rota importa o provedor diretamente.
4. **Sem DSN ou chave, envio externo desligado.** Desenvolvimento, Jest, Bun test
   e E2E não enviam a provedores reais. Variáveis opcionais em
   `packages/config/src/env.ts` e `.env.example`. O relatório local da Fase 5a
   usa uma credencial própria de banco, com leitura restrita.
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

**Conta:** escolher a região na criação (sugestão: UE, a mesma do PostHog). Dois
projetos (sugestão): um para a API (`SENTRY_DSN`) e um para o web (`EXPO_PUBLIC_SENTRY_DSN`).

**Versões:** a regra de idade mínima de 14 dias do pnpm fixa `@sentry/bun` e
`@sentry/react` em 11.8.0 e `@sentry/cli` em 3.8.0. Subir só depois de 14 dias da
publicação.

**Validação feita antes (etapa 0)**

- **`@sentry/elysia` não foi usado.** A documentação o marca como alpha, e o plano
  já previa o `@sentry/bun` com `captureException` no `default` do `onError` como
  saída. Como o SDK só captura o que a API manda, não há instrumentação do Elysia a
  validar.
- **Saída do processo:** o `start.sh` depende de o processo sair para o Render
  reiniciar. Com `onUncaughtExceptionIntegration` e
  `onUnhandledRejectionIntegration({ mode: 'strict' })`, uma exceção não tratada e
  uma rejeição não tratada saem com código 1, igual ao Bun sem o Sentry. O modo
  padrão (`warn`) da rejeição manteria o processo vivo, por isso `strict`.
- **Memória:** o bundle com o SDK inicializado usa cerca de 4 a 5 MB a mais de RSS
  (36 para 41 MB) num processo vazio, medido localmente com o Bun 1.4.3. A medida
  no container do Render ainda falta.
- **`ca-certificates`:** o `sentry-cli` usa os certificados do sistema, e o Node não
  prova que existem. O Dockerfile confere `/etc/ssl/certs/ca-certificates.crt` e só
  instala o pacote se faltar. Não foi possível construir a imagem onde isto foi
  escrito (sem daemon do Docker): a primeira build no Render confirma.
- O SDK 11 trocou `sendDefaultPii` por `dataCollection`; os dois lados o desligam
  por inteiro.

**API**

1. `apps/api/src/telemetry.ts` com `@sentry/bun`: `initTelemetry()`,
   `captureServerError()` e `scrubEvent()` (pura). `Sentry.init` só em
   `apps/api/src/server.ts`: `createApp` é usado nos testes e não envia nada, e
   `captureServerError` não faz nada sem init. Release vem de `TMS_RELEASE`.
2. **Saída filtrada, por lista de campos permitidos.** Sem integração além das duas
   de erro não tratado (nada de requisição, variáveis locais, linhas de código nem
   console), `serverName` fixo, `dataCollection` desligado e breadcrumbs zerados. O
   `beforeSend` descarta o evento do SDK e o remonta: tipo, mensagem e cadeia de
   `cause` vêm de `safeError(hint.originalException)` (erro do Postgres só com o
   SQLSTATE, `SyntaxError` sem mensagem, e-mail, JWT e `Bearer` redigidos); os
   frames levam só arquivo, função, linha, coluna e `in_app`; as tags, só as três
   abaixo.
3. **Captura só no `default` do `onError`** (`http/on-error.ts`), com as tags
   `client.version` (de `parseClientVersion`), `route` (o template) e `request_id`.
   O `ApiError` nunca passa por ali (hoje nenhum usa 5xx), e 4xx, validação, corpo
   inválido e 404 também não.
4. `SENTRY_DSN` e `SENTRY_SMOKE` (um erro de teste ao subir) em `env.ts`, com
   string vazia tratada como ausente, e em `.env.example` e `render.yaml`.
5. **Teste canário** (`apps/api/src/__tests__/telemetry.test.ts`): transporte falso
   que guarda o **envelope serializado**, não só o objeto do evento. Cobre e-mail,
   JWT e `Bearer` na mensagem, `Key (email)=(...)` com SQLSTATE, `JSON.parse`
   repetindo a entrada, `cause` encadeado, cookie, header, query e corpo; e que 4xx
   e 404 não geram evento.

**Web** (o nativo fica para a Fase 8)

1. `lib/telemetry.ts` sem efeito (nativo, Jest e `tsc` resolvem este, então o bundle
   nativo não muda) e `lib/telemetry.web.ts` com `@sentry/react`, o único arquivo que
   importa o SDK. O `telemetry.native.ts` só entra na Fase 8. Um teste confere que
   `telemetry.ts` não importa `@sentry`.
2. **Filtro em `lib/telemetryFilter.ts`**, sem importar o SDK: o mesmo evento
   remontado por lista de campos; `redact` copiado de `safe-error.ts` (10 linhas,
   sem pacote novo); URL sem query nem hash e UUID trocado por `:id` (o que também
   protege o código de convite); breadcrumbs só de navegação e HTTP (sem console nem
   clique); no máximo 20 eventos por aba, para um erro em loop não gastar a cota.
3. **Classificador em `lib/errors.ts`** (`classifyError`): ignora 4xx, falha de
   fetch, `AbortError` e 5xx sem `requestId` válido (o 502 do proxy); 5xx com id é
   `http`; o resto é `bug`.
4. **O erro do Eden nunca vai cru**, porque carrega o corpo da resposta: vira
   `Error('HTTP 500')`, com fingerprint por status e primeira parte da `queryKey` e o
   `requestId` como tag.
5. **Pontos de captura:** `QueryCache` e `MutationCache` em `createQueryClient`; o
   `ErrorBoundary` do `_layout.tsx` raiz, com fallback que funciona fora do
   `ThemeProvider`; o boundary de `characters/[id].tsx`, que engoliria o erro antes
   da raiz; e `sheet/sync/sync.ts`, para `rejected` com 400, 413, 422 e 403 sem
   código de política, e para a falha do `enqueue`. O 409, o 404 e o 403 de política
   são fluxo normal. Sai só o status e a quantidade de eventos, sem caminho nem
   corpo. (A falha definitiva da fila está em `sync.ts`, e não em `sender.ts`: é lá
   que o lote recusado volta ao usuário.)
6. **CSP:** `scripts/web-headers.mjs` lê a origem de `EXPO_PUBLIC_SENTRY_DSN` e a
   acrescenta ao `connect-src` depois da origem da API. DSN inválido gera aviso, sem
   derrubar o build. O `headers.spec.ts` continua passando, porque só confere o
   trecho inicial da diretiva.
7. **Testes:** canário com transporte falso (`telemetryWeb.test.ts`), com os mesmos
   valores marcados. O Jest transforma o `@sentry/*` (`transformIgnorePatterns` do
   `apps/frontend/jest.config.js`), que sai em ESM.

**Source maps** (`scripts/sentry-sourcemaps.mjs`, chamado em `deploy/render/Dockerfile`)

1. Depois do `web-headers.mjs` e antes do `find -delete`: os maps existem só nesse
   trecho e continuam fora da imagem final.
2. Sem token, registra no log e sai com 0. Com token, remove os `debugId` que o
   Metro já gravou, roda `sourcemaps inject` e `upload` **sem `--release`** (o
   casamento é pelo debug id, então um nome de release diferente não quebra o
   upload). Falha no inject ou no upload é registrada e o build segue.
3. **O token é secret file** (`--mount=type=secret,id=sentry_auth_token,required=false`),
   nunca `ARG`: um `ARG` fica no histórico da imagem. O Render copia os secret files
   para a raiz do contexto, então o `.dockerignore` barra `sentry_auth_token`, senão
   o `COPY . .` o levaria para uma camada. `EXPO_PUBLIC_SENTRY_DSN`,
   `EXPO_PUBLIC_SENTRY_SMOKE`, `SENTRY_ORG` e `SENTRY_PROJECT` entram como `ARG`
   (variáveis do serviço, em `render.yaml`).
4. **Risco a conferir:** o `start.sh` troca `tms-origin.invalid` pela URL pública
   com `sed` depois do build, o que muda o tamanho da linha e pode deslocar as
   colunas do mapa nos módulos com a URL. Se o stack sair errado ali, o web pode
   usar `window.location.origin`, já que API e app têm a mesma origem nesse deploy.

**Alertas:** e-mail para issue nova e para regressão.

**Pronto quando:** um erro forçado na API (`SENTRY_SMOKE=true`) e outro no web
(`EXPO_PUBLIC_SENTRY_SMOKE=true` no build) chegam com stack legível e a versão
certa, e o teste canário passa.

### Fase 4. Logs centralizados

**Ferramenta:** `pinoIntegration` do Sentry, no mesmo projeto e SDK da Fase 3
(`@sentry/bun` 11.8.0). O logger não muda: o stdout do Render continua igual, e os
logs passam a ser pesquisáveis por 30 dias, com `requestId`, `route` e
`clientVersion` como filtros. Só a API entra nesta fase. O web não manda log, porque
o erro do web já vai pela Fase 3 e `console.log` de navegador não é trilha de negócio.

**Validação feita antes (etapa 0)**

Em 04/11/2026, com Bun 1.4.3 (o do deploy), `@sentry/bun` 11.8.0 e Pino 10.4.0, num
`bun build --target bun` como o do Dockerfile e com transporte falso. Falta só o que
depende de conta real (ver "Verificação no deploy").

- **Funciona no bundle.** A integração não faz monkey-patch: ela assina o canal de
  diagnóstico `pino_asJson`, que o próprio Pino publica. Chegaram linhas dos loggers
  `api` e `db`, sem o `--external` e o `node_modules` que o §2 descarta. O stdout saiu
  idêntico com e sem a integração, e `debug` não saiu.
- **`enableLogs` não existe mais no SDK 11.** Não está nos tipos nem no código, e o
  envio de logs depende só da integração. Passar a opção quebraria o `tsc`.
- **O que a integração copia:** todos os campos do log, menos `level`, `time`, `pid` e
  `hostname`. Isso inclui `path` e **`msg`**, os dois com o caminho cru, que pode trazer
  UUID e código de convite. O corpo do log também traz esse caminho. O SDK acrescenta
  `sentry.*`, `server.address` e `pino.logger.level`.
- **Tipos não simples viram texto.** `null` chega como a string `"null"`, e um objeto
  vira JSON: o `error` do `onError` iria inteiro, com a mensagem, o stack e o `cause`.
- **Envio em lote:** a cada 5 s, 100 linhas ou 800 KB. Um `SIGTERM` pode perder até 5 s
  de logs, que continuam no stdout.
- **Custo:** cerca de 33 µs por linha, contra 5 µs sem a integração, e 7 MB a mais de
  RSS depois de 20 mil linhas (de 53 para 60 MB, após o GC). Não pesa no caminho da
  requisição. A medida no container do Render ainda falta.
- **Filtro que lança não derruba nada:** o SDK descarta a linha e segue.
- **Sem ligação automática entre log e issue.** Sem traces, todas as linhas do processo
  saíram com o mesmo `trace_id`, e o `scrubEvent` não manda `contexts` no evento. Até a
  Fase 6, o que liga os dois é o `requestId`.

**Implementação**

1. **`scrubLog()` em `apps/api/src/telemetry.ts`**, pura, ao lado do `scrubEvent`. Como
   na Fase 3, o log do SDK é descartado e remontado com `level`, `message` e os
   atributos abaixo. O tipo vem de `Sentry.BunOptions['beforeSendLog']`, porque o
   `@sentry/bun` não reexporta `Log`.

   | Atributo | Regra |
   |---|---|
   | `name`, `requestId`, `route`, `clientVersion`, `event` | texto de até 100 caracteres, com `text()` |
   | `method` | só `^[A-Z]{1,10}$` |
   | `status`, `responseTime`, `duration`, `chronicles`, `characters` | só número finito |
   | `query` | texto de até 500 caracteres (SQL com placeholders) |
   | `error` | só o tipo curto (`^[\w$.]{1,64}$`); de objeto, `code` ou `name`. **Nunca mensagem nem stack** |
   | `sentry.origin`, `sentry.release`, `sentry.environment`, `sentry.sdk.name`, `sentry.sdk.version`, `server.address` | copiados: é o que o Sentry usa para filtrar por release |

   - **Não saem:** `path`, `msg`, `pino.logger.level` e qualquer campo fora da tabela.
     Saem também `service` e `release`, repetidos em `server.address` e `sentry.release`,
     e `userId` do `account.deleted`, que fica só no stdout: não serve para investigar
     erro e não precisa ir a um terceiro.
   - **`null` e `undefined` são omitidos**, para não virarem `"null"`.
   - **Sem texto de erro no log:** a mensagem filtrada já está no issue, e a redação por
     padrão não pega texto de nota. Assim, o log não abre um segundo caminho para ela.
   - **Mensagem:** qualquer linha com `method` ou `path` é refeita como
     `GET /chronicles/:id - 200`, ou `GET rota desconhecida - 404` sem template. Vale também
     sem status (`status desconhecido`), porque o texto original traz o caminho. Nas demais,
     passa por `redact` e limite de 300 caracteres. Com o campo `err` (`logger.error(erro)`,
     em que o Pino usa a mensagem do erro como corpo), vira `erro sem filtro`. Nenhum código
     da API faz isso hoje; o `migrate.ts` faz, em outro processo.
   - **Depois do filtro**, o SDK só acrescenta `sentry.timestamp.sequence`, um número.
2. **`initTelemetry`:** `Sentry.pinoIntegration({ log: { levels: ['info', 'warn', 'error',
   'fatal'] }, error: { levels: [] } })` na lista explícita, ao lado das duas de erro não
   tratado, e `beforeSendLog: scrubLog`. O `error.levels` já é vazio por padrão, mas fica
   escrito: um `error` do Pino não pode virar issue, porque o `onError` já captura o 500 com
   o filtro certo. Nenhuma variável nova: `SENTRY_DSN` já liga tudo.
3. **Smoke:** `sendSmokeError` gera um `requestId`, grava `logger.error({ requestId },
   'sentry smoke')` e captura o erro com o mesmo id, antes do `flush`. Em produção não há
   rota que force um 500, então é isto que prova a ligação entre log e issue no deploy.

**Testes**

`apps/api/src/__tests__/telemetry-logs.test.ts`. Os valores marcados e o transporte saíram
de `telemetry.test.ts` para `src/test/telemetry-canary.ts`, com um transporte por arquivo:

- **`scrubLog`:** campo fora da lista descartado, `null` omitido, `error` em objeto vira
  só o tipo, `query` limitada, mensagem refeita sem o caminho e `err` sem o texto do erro.
- **Canário na app real**, sobre o **envelope serializado** das linhas de log: e-mail, JWT,
  `Bearer` e texto de nota no caminho (também codificados, como o Elysia os entrega), na
  query, em header, em cookie e no corpo, numa rota que responde 200, num 404 e num 500 que
  lança esses valores. Nenhum aparece.
- **Campos por origem**, com a lista exata de chaves: log de acesso, 404 (com `error:
  NOT_FOUND`), `erro interno`, `account.deleted` (sem `userId`) e `query lenta`. Um campo
  novo num log não aparece até entrar na tabela: falha para o lado seguro.
- **Ligação:** num 500, o `requestId` do log é igual à tag `request_id` do evento e ao id
  da resposta. O smoke faz o mesmo, e um `error` do Pino não gera evento.
- **O que não sai:** `/health` não gera log, `debug` não sai mesmo com o Pino nesse nível
  e, sem init, nada é enviado.
- **Barreiras no código**, lendo os arquivos: só o `server.ts` chama `initTelemetry`,
  `packages/db/src` não importa `@sentry` (o `migrate.ts` loga o erro cru) e `apps/api/src`
  não usa `sql.lit` nem `sql.raw`, que levariam valores para o campo `query`.

Três armadilhas confirmadas ao validar, que este arquivo trata:

1. **O nível `silent` deixa o canário sempre verde.** Com `NODE_ENV=test`, o Pino não gera
   a linha, o canal não dispara e o envelope fica vazio. O arquivo põe `level = 'info'` nos
   loggers `api` e `db` no `beforeAll`, volta a `silent` no `afterAll` e **cada teste confere
   primeiro que a linha esperada chegou**. O preço é ver algumas linhas de log na saída do
   teste.
2. **Cada `Sentry.init` soma um assinante ao canal**, que nunca sai: com dois inits, a
   linha chega duas vezes. Só acontece em teste, mas o `bun test` compartilha o processo
   entre arquivos e o `telemetry.test.ts` faz vários inits. Por isso: um init por arquivo,
   e nunca contar linhas.
3. **O lote só sai em 5 s:** `Sentry.flush` antes de ler o transporte.

`apps/api/src/__tests__/telemetry-bundle.test.ts`: o canal é a suposição mais frágil, e a
falha é silenciosa, porque os logs apenas param de chegar. O teste roda `bun build --target
bun` em `src/test/telemetry-bundle-entry.ts`, que usa `createLogger` e `initTelemetry` com
transporte falso, executa o bundle fora do repo com `NODE_ENV=production` e confere o
envelope, o release do `--define` e que o stdout é igual com e sem DSN. É o que pega uma
atualização do SDK, do Pino ou do Bun que quebre o canal.

**Conferência dos testes e do bundle real**

- **Os testes falham quando deveriam:** sem `beforeSendLog`, sem a integração, com `path` na
  lista e com `error.levels: ['error']`, cada caso derruba testes. O último passou batido na
  primeira versão, porque o `scrubEvent` tira o texto que o teste procurava, e agora o teste
  compara a quantidade de eventos.
- **`server.ts` real**, no bundle do Dockerfile, com `SENTRY_SMOKE=true` e o transporte HTTP
  do SDK apontando para um coletor local: o issue e o log do smoke chegaram com o mesmo
  `requestId`, o release do build e `server.address: tms-api`. Uma requisição com e-mail no
  caminho e valor marcado na query saiu como `GET rota desconhecida - 404`, sem nenhum dos
  dois, e continuou inteira no stdout. Falta o que depende de conta real, abaixo.

**Verificação local**

```bash
cd apps/api && bun test src/__tests__/telemetry
cd ../.. && npx pnpm typecheck && npx pnpm lint && npx pnpm test:api
```

**Verificação no deploy**

1. Publicar com `SENTRY_SMOKE=true`. Em **Logs**, buscar `sentry smoke` e conferir o
   `requestId`, o `sentry.release` e o `server.address`.
2. Abrir o issue `sentry smoke` e conferir que a tag `request_id` é o mesmo id.
3. Fazer uma requisição com um caminho marcado e conferir que ele não aparece nos Logs.
4. Voltar `SENTRY_SMOKE` para `false` e anotar o RSS do serviço no painel do Render.

**Volume**

1. Cota de 5 GB de logs por mês. A linha filtrada do log de acesso, como vai no envelope,
   tem cerca de **900 bytes**: 5 GB cabem em uns 5,5 milhões de linhas, ou cerca de 2
   requisições por segundo o mês inteiro. Sobra folga para o tráfego atual, mas a forma
   como o Sentry conta os bytes pode ser outra: confirmar em **Stats**.
2. Se passar de 50% da cota na primeira semana: `scrubLog` devolve `null` para o log de
   acesso com `status < 400`. Fica `warn`, `error` e as linhas de ciclo de vida. Não
   implementar isso antes de precisar.
3. Sem orçamento pay-as-you-go, como no §6: acima da cota, o Sentry recusa.

**Como pesquisar**

- Um relato de bug traz "código do erro: abc123" (Fase 2). Em **Logs**, a busca
  `requestId:abc123` mostra o acesso e o erro; `request_id:abc123` em **Issues** leva ao
  mesmo pedido. Os nomes diferem, e os valores são iguais.
- Salvar três consultas: 5xx por `route` (`status:>=500`), rate limit (`status:429`) e
  queries lentas (`message:"query lenta"`). O campo `msg` não sai. Conferir a sintaxe na
  tela ao salvar, porque ela não pôde ser testada sem conta.

**Plano B**

- **Uma atualização quebra o canal** (o teste de bundle acusa): um destino do Pino próprio
  em `packages/logger`, que repassa cada linha a `Sentry.logger.<nível>` com o mesmo
  `scrubLog`. É mais código, mas independe do canal.
- **Cota estoura ou o Sentry não serve:** Render Log Stream para o Better Stack, sem
  código: 3 GB com 3 dias de retenção, "free for personal projects". Perde o filtro por
  lista, que teria de ir para o stdout, e a retenção cai de 30 para 3 dias.

**Riscos**

- **Vazamento por campo novo:** coberto pela lista fechada.
- **Vazamento pela mensagem:** o corpo do log é o único texto livre que sai. O log de
  acesso é refeito, e o caso do `err` é tratado; uma mensagem escrita com valor de usuário
  (`` logger.info(`nota ${texto}`) ``) só teria o `redact`. Na revisão, mensagem de log é
  texto fixo.
- **Duplicar o erro:** coberto por `error.levels: []`.
- **Logs de `fatal` na queda do processo** podem não sair antes de o Render reiniciar.
  Aceitável: o erro não tratado já sai pela Fase 3, com `Sentry.flush`.

**Pronto quando:** o smoke mostra o log e o issue com o mesmo `requestId`, um caminho
marcado não aparece nos Logs, os testes passam e o volume da primeira semana está abaixo
de 50% da cota. O código e os testes estão feitos; a verificação no deploy e o volume
dependem da conta do Sentry.

### Fase 5. Analytics de produto

**Plano de implementação e contrato dos eventos:**
[relatório local, coletor na API, testes e ativação](plano-observabilidade-fase-5.md).

**5a — Agora:** criar `pnpm metrics:funnel`, sob demanda, com consultas fixas
e role de leitura restrita sobre cadastro, vínculos, auditoria e rolagens.
Saída agregada, sem `payload`, conteúdo de ficha ou dados identificáveis.
Separar narrador e jogador, mostrar uso por família e retenção semanal observada.
Não instalar SDK nem criar coleta nova. Exclusões, vínculos removidos e o início
da auditoria limitam o histórico; tentativa de envio não é operação confirmada.

**5b — Quando houver necessidade concreta:** PostHog na UE, com eventos de
negócio enviados pela API após commit, filtro por lista permitida e verificação
de consentimento no despacho. Somente abertura de criação e, se necessária,
navegação chegam pelo coletor autenticado do cliente. Sem SDK no app, domínio
PostHog na CSP, replay ou duplicação do Sentry.

Antes de ativar a 5b: aviso público, escolha em Conta/cadastro (proposta: opt-in),
identidade opaca e remoção de pessoa **e eventos** ligada ao `DELETE /me`, com
tarefa persistida. Aceite de convite só conta entrada nova (`joined: true`);
submissão, aviso de criação livre e ativação são eventos distintos. Refresh
falho fica no diagnóstico técnico da API e na Fase 7, fora do funil inicial.

Eventos de produto têm envio de melhor esforço, sem outbox; exclusão externa
tem retomada e coordenação com envios em voo. Conferir cotas/retenção do plano
gratuito antes da contratação. O PostHog mede apenas o período após ativação
e quem autorizou; o relatório local também não recupera dados já apagados.

**Pronto na 5a:** relatório reproduzível, conciliado com fixtures e executável
com permissões restritas. **Pronto na 5b:** funis por papel conferidos, revogação
efetiva no servidor, exclusão externa verificada e canário de privacidade passando.

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
build de debug. Se a loja vier antes, esta fase sobe na ordem, logo depois da
Fase 5a; a captura de crashes não depende de ativar o analytics da 5b.

1. `@sentry/react-native` com `npx expo install`, plugin no `app.json` e
   `getSentryExpoConfig` no `metro.config.js`, mantendo o `withNativeWind` e o
   resolver `SOURCE`.
2. Preencher `telemetry.native.ts` com a mesma interface, e ligar o `report` de
   `sheet/sync/storage.native.ts`.
3. Rodar `pnpm check:native` e `expo install --check`. Os jobs `native-android` e
   `native-ios` do CI confirmam o build.
4. Conferir que o header da Fase 2 sai com a versão do build instalado no aparelho,
   e não com a da última release.
5. Upload de símbolos nativos no build de distribuição. Se a Fase 5b estiver
   ativa, habilitar a fachada nativa para o mesmo coletor autenticado. Eventos
   de negócio já saem da API; não instalar SDK que duplique a captura.

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
| Analytics | SQL sob demanda (5a); PostHog pela API quando necessário (5b) | Plausible, Umami | Os dados existentes bastam para começar; painel de produto pode justificar PostHog depois |

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
| PostHog (5b) | Conferir cota na ativação; referência original: 1 milhão de eventos | Só eventos nomeados pela API, sem autocapture e sem replay |
| Neon | 100 CU-h | Nada frequente no banco; `/ready` com banco, se criado, só sob demanda (uma vez por hora já custa cerca de 16 CU-h por mês) |
| Render | 750 h por workspace | Um serviço free só |

## 7. Decisões para tomar

| # | Decisão | Quando | Sugestão |
|---|---|---|---|
| 1 | Quantas pessoas precisam ver os erros? | Antes da Fase 3 | Sentry se for 1. Se forem mais, PostHog para erros e deixar traces para a Fase 9 |
| 2 | Base legal da coleta externa: consentimento (opt-in) ou legítimo interesse com opt-out | Antes de ativar a Fase 5b | Proposta: opt-in. A 5a começa com acesso interno restrito e saída agregada; isso não dispensa os cuidados de privacidade |
| 3 | Manter o serviço sempre acordado pelo ping? | Fase 1 | Sim, enquanto houver um único serviço free |
| 4 | Quando o app nativo será distribuído? | Define a posição da Fase 8 | Depois da Fase 7, salvo se a loja vier antes |

## 8. Fontes

Consultadas em 03/11/2026.

- [Sentry: preços](https://sentry.io/pricing/) e [cotas](https://docs.sentry.io/pricing/quotas/)
- [Sentry para Elysia](https://docs.sentry.io/platforms/javascript/guides/elysia/), [Expo](https://docs.sentry.io/platforms/react-native/manual-setup/expo/) e [integração com Pino](https://docs.sentry.io/platforms/javascript/guides/bun/configuration/integrations/pino/)
- [PostHog: preços](https://posthog.com/pricing.md); [API de captura](https://posthog.com/docs/api/capture) e [exclusão de pessoas/eventos](https://posthog.com/docs/api/persons) conferidas na revisão da Fase 5 em 05/11/2026
- [Grafana Cloud: preços](https://grafana.com/pricing/) e [descarte acima dos limites](https://community.grafana.com/t/what-happens-when-my-usage-exceed-the-free-plan-limitations/102795)
- [UptimeRobot: preços](https://uptimerobot.com/pricing/)
- [Better Stack: preços](https://betterstack.com/pricing)
- [Neon: preços](https://neon.com/pricing)
- [Render: plano free](https://render.com/docs/free) e [Log Streams](https://render.com/docs/log-streams)
- [Elysia: OpenTelemetry](https://elysiajs.com/patterns/opentelemetry)
