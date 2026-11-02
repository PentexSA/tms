# Orquestrador: preparação, ambiente e build nativo

Notas de quem preparou o ambiente e coordenou os agentes. Aqui ficam os achados que só o
orquestrador viu (setup e build nativo), as limitações do teste e o estado dos dados. Os
logs citados estão no diretório de rascunho da sessão (fora do repositório) e foram resumidos
aqui com as linhas relevantes.

## Linha do tempo (01/11/2026, horário local)
| Hora | O quê |
|---|---|
| 11:5x | `npx pnpm db:up` falha duas vezes: primeiro pelo plugin `docker compose` desta máquina (ambiente, ver "Contornos"), depois pelo `postgres:18` (ORQ-01) |
| 12:02 | Postgres 16 no ar (override), migrations até `0020_product_templates`, `templates:publish --published` |
| 12:03 | API (`bun run dev`) e Expo web (`expo start --web --offline`) no ar |
| 12:06 | `seed:roteiro` (contas N, J1, J2, N2; 7 crônicas). Convites A e B (uso único) em `Vampiro v4`; contas de QA e PO criadas via API |
| 12:08 | 5 agentes web disparados |
| 12:19–12:22 | Bloqueio 1 (ORQ-02): `dist` antigo dos pacotes; build e restart da API e do Metro |
| 12:24–12:55 | Bloqueio 2 (ORQ-03): `node_modules` antigo; `pnpm install --frozen-lockfile`, build, restart |
| 12:52–13:25 | Build nativo do `main` falha em Android e iOS (ORQ-04) |
| 13:25–13:32 | Build nativo **de teste** num worktree isolado (ver "Build de teste") |
| 13:4x–15:xx | Agentes de app (Android e iOS), em ondas por falta de RAM e disco |

## Achados do orquestrador

| ID | Tipo | Severidade sugerida | Onde | Descrição | Evidência | Atrapalha a criação? |
|---|---|---|---|---|---|---|
| ORQ-04 | bug funcional (build) | **crítica** | `apps/frontend/package.json`, `pnpm-lock.yaml` (desde `b9df17e`, Expo SDK 58) | **O app nativo do `main` (v1.1.0) não compila no iOS nem no Android.** O `react-native-gesture-handler` 2.28.0 entra como peer automático e opcional do `expo-router` 58.0.26 (`"react-native-gesture-handler": "*"`, `optional: true`), é hoisted e autolinkado, e não compila com o React Native 0.88. O Expo SDK 58 espera `~3.3.0` (`node_modules/expo/bundledNativeModules.json`). O app não importa o módulo. O CI (`.github/workflows/ci.yml`) não tem build nativo, por isso a regressão passou. | Android (`gradlew assembleDebug`): `RNGestureHandlerModule.kt:173:53 Function invocation 'getRootViewTag()' expected.` e `RNViewConfigurationHelper.kt:42:30 Unresolved reference 'getZIndexMappedChildIndex'.` → `BUILD FAILED in 6m 22s`. iOS (`xcodebuild`, Debug, simulador): `RNGestureHandlerModule.mm:151:5: error: unknown type name 'RCTCxxBridge'` → `** BUILD FAILED **`. | Sim: nenhuma criação no app nativo é possível a partir do `main` |
| ORQ-01 | bug de setup | média | `docker-compose.yml` | `image: postgres` sem tag puxa a 18, que recusa o volume em `/var/lib/postgresql/data` ("in 18+, these Docker images are configured to store database data in a format which is compatible with pg_ctlcluster…"). O container sai com código 1, e `npx pnpm db:up` deixa o ambiente sem banco. O CLAUDE.md fala em PostgreSQL 16. | Log do container `tms-postgres` (Exited (1)) | Indiretamente (ambiente de dev) |
| ORQ-02 | bug de setup | alta (para quem testa ou desenvolve) | `packages/*/package.json` (`main: ./dist/index.js`) e o roteiro de setup | O setup do roteiro não tem build dos pacotes. Com `dist` antigo (18/10), o Metro e a API usaram um `@tms/sheet-core` sem `effectiveCreationConfig`: "Nova ficha" mostrava "Atualize o app", e "Criação de fichas" dizia "Este sistema usa criação livre" até em crônica por pontos. Achado em paralelo pelo PO web e pelo QA web (QAW-01). | `packages/sheet-core/dist` de 18/10 com 16 `.js`; o `src` tem 26 `.ts`, com 35 commits depois | Sim, enquanto o `dist` estiver velho |
| ORQ-03 | bug de setup | alta (para quem testa ou desenvolve) | roteiro de setup | O roteiro não tem `pnpm install`. O `node_modules` era de 18/10 (Expo 54, expo-router 6.0.24, RN 0.81.5), contra o lockfile (Expo 58.0.19, expo-router 58.0.26, RN 0.88.0). Abrir uma ficha dava `TypeError: (0, _expoRouter.usePreventRemove) is not a function` (LeaveGuard). Relatado pelo PO web, pelo Iniciante web e pelo Experiente web (QAW-17). | `node_modules/.modules.yaml` de 18/10; versões lidas dos `package.json` instalados | Sim, enquanto o `node_modules` estiver velho |
| ORQ-05 | ambiente (não é do produto) | — | rede local | O Expo CLI consulta `exp.host` ao iniciar, e o DNS desta rede não resolve esse nome (`TypeError: fetch failed`). Contorno: `expo start --web --offline`. | `curl: (28) Resolving timed out` para `exp.host` | Não |
| ORQ-06 | ambiente (não é do produto) | — | rede local | Um proxy com inspeção TLS faz o Node receber `SELF_SIGNED_CERT_IN_CHAIN`, e o `pnpm install` (binário `@pnpm/exe`, que ignora `NODE_OPTIONS`) trava sem erro. Contorno: `NODE_EXTRA_CA_CERTS` com os certificados públicos do keychain do sistema. | `fetch('https://registry.npmjs.org/...')` → `SELF_SIGNED_CERT_IN_CHAIN`; o curl passa | Não |
| ORQ-07 | segurança (dev) | baixa | `.env.example` | `JWT_SECRET=` vazio no exemplo: copiado como está, falha a validação (`min(32)`) e a API não sobe. Os placeholders `{{DB_USER}}` etc. do `DATABASE_URL` também não servem como estão. O seed pressupõe `TRUST_PROXY=true`, sem o que os 13 aceites de convite do mesmo IP passam do limite (10 a cada 15 min). | `packages/config/src/env.ts`, `scripts/seed-roteiro.ts` | Não |

Contornos de ambiente do orquestrador (nenhum altera o repositório):
- O `docker compose` desta máquina apontava para o plugin do Rancher, então rodei pelo Colima, a pedido do usuário, com um `DOCKER_CONFIG` isolado.
- Override do compose para `postgres:16`, decidido pelo usuário.
- `.env` local, fora do git: `DATABASE_URL` do compose, `JWT_SECRET` aleatório e `TRUST_PROXY=true`.
- Expo com `--offline`.
- `NODE_EXTRA_CA_CERTS`.
- `pnpm install --frozen-lockfile` e build dos pacotes (`turbo run build --filter='@tms/api^...' --filter='frontend^...'`).

## Build de teste do app nativo (ler antes de qualquer resultado de app)
Como o `main` não compila no nativo (ORQ-04), os resultados de app vêm de um **build de teste**:
- feito num worktree isolado, fora do repositório, no commit `1db3db9` (v1.1.0), com dependências pelo lockfile;
- a única diferença é um `apps/frontend/react-native.config.js` que tira o `react-native-gesture-handler` do autolinking nativo (o app não importa o módulo; o `expo-router` só o carrega sob demanda, na stack JS, que o app não usa);
- build de debug (Android `assembleDebug`, iOS `Debug-iphonesimulator`), com o JS servido pelo **mesmo Metro do `main`**: o código de tela testado no app é o do `main`.
Nenhum agente viu erro ligado ao `RNGestureHandler`. As conclusões de UX e de layout do app valem para o `main`. A falha de build vale como achado à parte.

## Dispositivos e limitações do teste
| Agente | Dispositivo | Observação |
|---|---|---|
| experiente-app | Android 16, Pixel 6 (emulator-5560) | J1 |
| qa-app | iOS 26.5, iPhone 17e (390×844 pt), depois o mesmo Pixel 6 | O Pixel 4a previsto não coube no disco; o Pixel 6 foi reaproveitado com `pm clear` (app limpo) |
| iniciante-app | iOS 26.5, iPhone 17 (402×874 pt) | conta nova |
| narrador-app | iOS 26.5, iPhone 17 Pro (402×874 pt) | N nas fases 1 e 2 |
| po-app | iOS 26.5, iPhone 17 Pro Max (440×956 pt) | contas po_app e po_app_jogador |

- **iOS sem teclado virtual**: o simulador controlado pelo idb age como se houvesse teclado de hardware. "Teclado cobrindo campo" foi testado só no Android.
- **Digitação no iOS**: o `idb ui text` perde ou troca caracteres em textos longos (corrigido digitando em pedaços). Erros de digitação nas notas do iOS podem vir da ferramenta.
- **Offline no iOS**: não dá para cortar a rede de um simulador só; foi testado só no Android e no web.
- **Android, "Unable to load script"** (relatado pelo experiente-app): é o build de debug perdendo o Metro depois que a ferramenta digitou "rr" sem campo focado (atalho de reload do RN). É artefato do teste, não do produto. A perda de alterações que se seguiu (rascunho só em memória) é do produto: ver EA-04 e IA-01.
- Web: Chromium headless (Playwright), em 390×844 e 1280×800. WebKit não foi testado (os E2E já o cobrem).
- Os screenshots do web saem do servidor de dev (Expo dev server), não do export de produção com CSP.

## Verificações independentes do orquestrador
- **QAA-02 (tokens e dados no cache HTTP em disco):** confirmado.
  - A API não envia `Cache-Control` nem `Pragma` (`curl -D -` em `GET /health` → 200 e em `POST /auth/login` → 401, os dois sem os headers). No código, `apps/api/src` não tem nenhuma ocorrência de `no-store` ou `cache-control`.
  - No simulador iOS do qa-app, depois do logout, o `Library/Caches/com.tms.app/Cache.db` do app tem 1 resposta de `POST /auth/login` em cache, e o corpo dela contém a chave `refreshToken`. Os valores não foram lidos nem copiados; a consulta foi só de contagem, em modo somente leitura.
  - Isso contorna o Keychain (`expo-secure-store`) e fere o MASVS-STORAGE-1/2 e o ASVS 8.2.1/8.3.4 (dados sensíveis sem `no-store`).

## Nuance de produto que reconcilia notas
- **Devolver ficha para correção** só existe com "Aprovação do narrador" **Ligada** na crônica (o PO web passou por devolução e reenvio numa crônica assim). As crônicas do seed (`Vampiro v4`, `Mago v4`, `Lobisomem v4`) e a do Narrador web estão com a aprovação **Desligada**, o padrão. Nelas o próprio jogador conclui a criação por pontos, e o narrador não tem como devolver (NW-24). Na criação livre, quem conclui é o narrador.

## Estado dos dados no fim
- Fichas web: J2 "Tibério Valadares" (Vampiro livre, concluída pelo N), "Sebastião Bueiro" (Vampiro v4, aberta com nota), "Lívia Castellani" (Mago v4, concluída pelo N); Iniciante web `lucas_novato6761` "Tiago Sombra" (Vampiro v4, concluída pelo jogador, destravada, com nota).
- Fichas app: J1 "Vasco Ferraz" (Vampiro livre), "Bento Lacerda" (Vampiro v4), "Rasga-Bruma" (Lobisomem v4), tratadas pelo Narrador app na fase 2; Iniciante app `novato_teo` "Teodoro Vane" (Vampiro v4, concluída pelo jogador).
- Rate limit: cadastros pelo web e pelo app usaram 127.0.0.1 (2 iniciantes e no máximo 1 por QA). As contas de QA e PO foram criadas via API com IP simulado, como o seed faz.
