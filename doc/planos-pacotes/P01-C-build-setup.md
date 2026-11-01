# P01-C · Build, setup e resiliência a versão: plano de implementação

> Plano · 2026-11-01 · base conferida: `onda/1-fundacao` em `3892588` (código igual ao `main` `1db3db9`)

Pacote da onda 1 na [matriz de achados](../testes/2026-11-01/matriz-achados.md#p01-c). Branch local `pacote/p01-c-build`, num worktree próprio saindo da ponta de `onda/1-fundacao`. O pacote faz o app nativo voltar a compilar e o CI passar a provar isso (D-00), deixa o ambiente de desenvolvimento certo pelos comandos documentados e tira das telas as mensagens que escondem falha de versão ou de template.

Tudo o que está abaixo foi conferido lendo o código no checkout do cabeçalho. Onde a matriz marcava "(estimado)" e o código mostrou outra coisa, o texto diz.

## 1. Objetivo e itens

| ID | Sev. | O que o pacote entrega |
|---|---|---|
| T-01 | crítica | O app nativo compila no Android e no iOS: `react-native-gesture-handler` na faixa do SDK 58, e um job de build nativo no CI para a próxima subida de SDK não passar. |
| S-01 | alta | O web usa o código atual dos pacotes sem depender de um `dist` compilado à mão; a API se recusa a subir com `dist` velho e diz o comando. |
| S-02 | alta | `pnpm bootstrap` instala pelo lockfile; a API e o web se recusam a subir com `node_modules` diferente do lockfile. |
| L-01 | média | "Criação de fichas" separa "template não carregou" de "sistema sem pontos", e o salvar fica bloqueado enquanto as regras do sistema são desconhecidas. |
| L-03 | média | A ficha tem error boundary ("Tentar de novo"), e criar uma ficha confirma "Ficha criada." antes de abri-la. |
| S-03 | média | `docker-compose.yml` com `postgres:16`, publicado só no loopback. |
| L-02 | baixa | "Atualize o app" vira, no web, "Recarregue a página" com o botão "Recarregar"; no app, uma saída ("Voltar", e o link da loja quando houver um configurado). |
| S-04 | baixa | `.env.example` que funciona copiado como está, sem segredo fixo; seed que não depende de `TRUST_PROXY`. |

## 2. Decisões aplicadas

**D-00 · Android e iOS compilados no CI em todo PR (iOS em runner macOS).** Entra como dois jobs novos em `.github/workflows/ci.yml` (`native-android` e `native-ios`, §3.1), no mesmo workflow dos outros, para herdar o gatilho `pull_request`, o `permissions: contents: read` (`ci.yml:11-12`) e o `concurrency` com `cancel-in-progress` (`ci.yml:14-16`). As checagens baratas de versão (segundos, Linux) vão para o job `check`, que já existe.

O que o código mostra sobre a decisão, sem decidir nada:

- **Build Debug não embute o JS.** O `assembleDebug` e o `xcodebuild` Debug para simulador pulam o bundle do Metro (o app carrega do servidor de dev). O job só prova o código nativo. Para provar também o bundle JS das plataformas nativas, o plano acrescenta `expo export --platform android --platform ios` no job Linux (um a três minutos, sem custo de macOS). É complemento, não troca a decisão.
- **"Todo PR" inclui PR só de docs e de bot.** O gatilho `pull_request` (`ci.yml:6`) roda em qualquer PR. Pelo "Como executar" da matriz, os PRs remotos são um por onda, então o custo é baixo; mas um PR de docs também paga o job macOS. Filtro de caminho fica como pergunta (§9), com o problema conhecido de check obrigatório que não roda.
- **O `push` na `main` também roda os jobs nativos** (`ci.yml:7-8`). Isso é bom: o cache do Gradle só é gravado a partir da branch padrão, e os PRs leem dele.

## 3. Desenho por item

### 3.1 T-01 · O app nativo não compila

**Confirmado no código.**

- Nenhum arquivo de `apps/`, `packages/`, `e2e/` ou `scripts/` importa `react-native-gesture-handler` (busca em `.ts`, `.tsx`, `.js`, `.json`). O app usa o `Stack` nativo do expo-router (`apps/frontend/app/(app)/_layout.tsx:17`).
- Instalado: `react-native-gesture-handler` 2.28.0 (`pnpm-lock.yaml:4987`). Esperado pelo SDK: `~3.3.0` (`node_modules/expo/bundledNativeModules.json:107`).
- Comparei todo pacote de `bundledNativeModules.json` que está em `node_modules` com a faixa do SDK: as 21 dependências diretas do `apps/frontend/package.json` batem, e dos transitivos só o `react-native-gesture-handler` está fora. É o único desvio.
- No expo-router 58.0.26, o gesture-handler só é usado pela stack JS (`node_modules/expo-router/build/react-navigation/stack/views/GestureHandlerNative.js`) e pelo drawer, que o app não usa.

**A causa da matriz está quase certa, mas o mecanismo é outro.** A matriz diz que o pacote "entra como peer automático e opcional do `expo-router`". O `autoInstallPeers: true` do pnpm (`pnpm-lock.yaml:4`) não instala peer opcional. Quem puxa o gesture-handler é o `react-native-drawer-layout@4.2.12`, dependência direta do expo-router (`pnpm-lock.yaml:9070`), com um peer **obrigatório** `react-native-gesture-handler: '>= 2.0.0'` (`pnpm-lock.yaml:4979-4985`). O pnpm reaproveitou o 2.28.0 que já estava no lockfile desde antes do SDK 58 (`git show b9df17e^:pnpm-lock.yaml`, linha 4790), porque ele satisfaz `>= 2.0.0`. O `expo install --fix` da subida só atualiza dependências diretas, então o pacote ficou em 2.28.0, que compilava com o RN 0.86 e não compila com o 0.88. Consequência para o desenho: **não dá para simplesmente tirar o pacote**, porque o peer do drawer-layout o reinstala. Sobram as duas saídas da matriz.

**Alinhar × tirar do autolinking.**

| | Alinhar (`npx expo install react-native-gesture-handler` em `apps/frontend`) | Tirar do autolinking (`apps/frontend/react-native.config.js` com `platforms: { android: null, ios: null }`) |
|---|---|---|
| O que muda | Dependência direta `~3.3.x` em `apps/frontend/package.json`; o lockfile resolve o peer do drawer-layout e o opcional do expo-router para 3.3.x | Arquivo novo; o 2.28.0 incompatível continua em `node_modules`, só não é compilado |
| Prova hoje | Faixa testada pelo Expo para o SDK 58; ainda não compilada neste app | Usada pelo build de teste do relatório (§2), horas de uso em iOS e Android sem erro |
| Próxima subida de SDK | Vira dependência direta: `expo install --check` e `expo install --fix` passam a acompanhar a versão | Fica fora do controle do SDK; a checagem de transitivos (abaixo) acusaria o 2.28.0 para sempre e precisaria de exceção |
| Se um dia usar stack JS ou drawer | Funciona | Quebra em runtime (módulo nativo ausente), não no build |
| Custo | Mais um módulo nativo compilado (tempo de build, tamanho do binário) | Nenhum |

**Recomendação: alinhar.** A versão volta para baixo do controle do SDK, o peer obrigatório do drawer-layout fica satisfeito com código compatível, e nada fica escondido numa configuração de linking. O custo é um módulo nativo a mais, sem código do app que o use. A exclusão continua como plano B, caso o 3.3.x não compile (o build de teste já provou que ela funciona). O `minimumReleaseAge` de 14 dias não bloqueia: `react-native-*` está em `minimumReleaseAgeExclude` até 2026-11-09 (`pnpm-workspace.yaml:35-43`), e depois disso o lockfile fixa a versão.

**Para a regressão não voltar.**

1. **Job `check` (Linux, segundos), dois passos novos:**
   - `pnpm -C apps/frontend exec expo install --check`: confere as dependências diretas contra o SDK com o CLI já instalado, sem baixar nada de fora do lockfile.
   - `node scripts/check-native-versions.mjs` (novo): para cada pacote de `node_modules/expo/bundledNativeModules.json` presente em `node_modules`, confere a versão instalada contra a faixa do SDK. As faixas do arquivo têm só três formas (`~x.y.z` 100 vezes, `x.y.z` 22, `^x.y.z` 2), então o script compara sem dependência nova. É o passo que pega o caso do T-01: um transitivo nativo fora da faixa, que o `expo install --check` não vê. Saída: `react-native-gesture-handler 2.28.0 instalado; o SDK espera ~3.3.0. Rode: pnpm -C apps/frontend exec expo install react-native-gesture-handler`. Script raiz `check:native` para rodar local.
   - O `expo-doctor` fica de fora: seria baixado pelo `npx` a cada run (fora do lockfile e do `minimumReleaseAge`). Os dois passos acima e o build cobrem o que importa aqui.
2. **Jobs `native-android` e `native-ios`** (esboço abaixo). Nenhum segredo, nenhuma assinatura, nenhum artefato de binário publicado (só o log, em caso de falha).

```yaml
  # D-00 (T-01): o app nativo compila. Debug, sem assinatura e sem segredo.
  # O JS não entra no binário Debug: o bundle das duas plataformas é provado
  # pelo expo export do job Android.
  native-android:
    name: build nativo (Android)
    runs-on: ubuntu-latest
    timeout-minutes: 45
    env:
      EXPO_NO_TELEMETRY: '1'
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - uses: actions/setup-java@<SHA do release> # vX.Y.Z
        with:
          distribution: temurin
          java-version: '<a que o RN 0.88 exige>'
      # Cache do Gradle: grava só na main, PR só lê (padrão da action);
      # valida o checksum do gradle-wrapper.jar que o prebuild gera
      - uses: gradle/actions/setup-gradle@<SHA do release> # vX.Y.Z
      - run: pnpm install --frozen-lockfile
      - name: bundle JS de iOS e Android
        working-directory: apps/frontend
        run: pnpm exec expo export --platform android --platform ios --output-dir "$RUNNER_TEMP/native-export"
      - name: prebuild
        working-directory: apps/frontend
        run: pnpm exec expo prebuild --platform android --no-install
      - name: assembleDebug (só x86_64, o ABI do emulador)
        working-directory: apps/frontend/android
        run: ./gradlew assembleDebug --no-daemon -PreactNativeArchitectures=x86_64

  native-ios:
    name: build nativo (iOS)
    runs-on: <label macOS fixo, com o Xcode que o SDK 58 exige>  # nunca macos-latest
    timeout-minutes: 60
    env:
      EXPO_NO_TELEMETRY: '1'
    steps:
      - (checkout, pnpm/action-setup e setup-node iguais ao job acima)
      - run: sudo xcode-select -s /Applications/Xcode_<versão>.app
      - run: pnpm install --frozen-lockfile
      - name: prebuild
        working-directory: apps/frontend
        run: pnpm exec expo prebuild --platform ios --no-install
      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: |
            apps/frontend/ios/Pods
            ~/Library/Caches/CocoaPods
          key: pods-${{ runner.os }}-${{ hashFiles('apps/frontend/ios/Podfile', 'pnpm-lock.yaml') }}
      - name: pod install
        working-directory: apps/frontend/ios
        run: pod install
      - name: xcodebuild (Debug, simulador, sem assinatura)
        working-directory: apps/frontend/ios
        run: |
          set -o pipefail
          xcodebuild -workspace TMS.xcworkspace -scheme TMS \
            -configuration Debug -sdk iphonesimulator \
            -destination 'generic/platform=iOS Simulator' \
            -derivedDataPath "$RUNNER_TEMP/dd" \
            CODE_SIGNING_ALLOWED=NO build 2>&1 | tee "$RUNNER_TEMP/xcodebuild.log"
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        if: failure()
        with:
          name: xcodebuild-log
          path: ${{ runner.temp }}/xcodebuild.log
          retention-days: 7
```

Detalhes do esboço:

- **Actions por SHA.** As que já estão em `ci.yml` reaproveitam os SHAs de lá (convenção de `ci.yml:1-3`: SHA e versão no comentário, atualizados juntos). As duas novas (`actions/setup-java`, `gradle/actions/setup-gradle`) entram pelo SHA do commit da tag do release, conferido na página de releases da própria action. Nada de `@v4` nem SHA copiado de outro projeto. Nenhuma action de terceiros para o Xcode: `xcode-select` basta.
- **Workspace e scheme `TMS`** vêm do `expo.name` (`apps/frontend/app.json:3`). Conferir os nomes no primeiro prebuild.
- **Cache.** Gradle pelo `setup-gradle`. CocoaPods pelo `actions/cache`, com chave no `Podfile` gerado e no lockfile. O ccache só entra se o tempo medido do iOS passar de ~30 min. Cache criado num PR fica no escopo do PR e não chega à `main`: um PR de fork não envenena o cache da `main`.
- **Tempo esperado (a medir no primeiro run e registrar):** Android ~15–25 min frio e ~8–12 min com cache. iOS ~25–40 min frio e ~15–25 min com cache. O run inteiro, hoje ~4 min e limitado pelo E2E (`doc/plano-pipeline-testes.md` §5), passa a ser limitado pelo iOS. O relatório registra só o build Android quebrado, em 6m22s (máquina local).
- **`workflow_dispatch:`** entra no `on:`, para a integração da onda rodar o build nativo no GitHub antes de abrir o PR (o build local de teste esgotou RAM e disco, relatório §2). Só quem tem escrita no repositório dispara.
- O comentário de cabeçalho de `ci.yml:1-3` passa a dizer que o job mais lento é o iOS.

### 3.2 S-01 e S-02 · O ambiente de dev roda código e dependências velhos

**O que cada consumidor resolve hoje.**

| Consumidor | Como resolve `@tms/*` | Precisa de `dist`? |
|---|---|---|
| Metro (web dev, `expo export`, bundles nativos) | `main: ./dist/index.js` (`packages/sheet-core/package.json:7`, `packages/ui/package.json:5`); `apps/frontend/metro.config.js:17-26` não mapeia nada | Sim |
| Bun (API: `bun run dev`, `bun test`, `bun build`, `templates:publish`) | `main` e `exports` para `dist` (`packages/config/package.json:7-8`, `packages/db/package.json:7`, `packages/logger/package.json:6`, sheet-core) | Sim |
| Node/tsx (`db:migrate`, `migrate:check`) | `@tms/config/env` e `@tms/logger` pelo `dist` (`packages/db/src/migrate.ts:1`, `packages/db/src/logger.ts:1`) | Sim |
| tsc (`typecheck`) | `types` para `dist/*.d.ts`; `turbo.json` faz `typecheck` depender de `^build` | Sim, e o turbo garante |
| Jest (frontend e `@tms/ui`) | `moduleNameMapper` para `src` (`apps/frontend/jest.config.js:43`, `packages/jest-config/jest.config.react-native.js:37-39`) | Não |

A causa da matriz está certa. E há mais: **os testes do app rodam o `src`, e o app roda o `dist`.** Foi por isso que o `dist` de 18/10 passou despercebido. O `scripts/backend.sh:27-28` já compila os pacotes da API antes de subi-la, mas o roteiro não o usa (`doc/testes/prompt-teste-personas.md:58-59` manda `cd apps/api && bun run dev` e `npx expo start --web`), e nenhum caminho do roteiro roda `pnpm install`.

**Opções avaliadas.**

| Opção | O que muda | A favor | Contra |
|---|---|---|---|
| A. Build e install no setup, mais uma checagem na subida | Scripts da raiz, scripts de `apps/api` e `apps/frontend`, um script de checagem | Nenhuma mudança na resolução; mesmo artefato do CI e do deploy | Editar um pacote durante a sessão exige rebuild (ou `pnpm dev` com `tsc --watch`) |
| B. `exports` com condição `source`, mais `unstable_conditionNames` no Metro e `--conditions` no Bun | 5 `package.json`, `metro.config.js`, scripts do Bun | Sem build em dev | Muda a resolução de todo consumidor (tsc, Node, Metro web e nativo, `bun build`); as condições do Metro variam por plataforma; o Node/tsx das migrations continua precisando do `dist`, então o build não some do backend |
| C. Metro resolve `@tms/sheet-core` e `@tms/ui` pelo `src` (como o Jest já faz), e o backend fica com a opção A | `metro.config.js`, mais o que a opção A pede para a API | O app roda o mesmo código que os testes do app testam; nenhum build no caminho do frontend (dev, export do E2E, nativo); editar um pacote recarrega no Metro | Muda a entrada do bundle web de produção e dos nativos (o mesmo código, transpilado pelo Babel em vez de `tsc` e depois Babel) |

**Recomendação: C.** É a menos invasiva que resolve o problema na origem: um arquivo no frontend. Ela não muda nada no backend, que precisa do `dist` de qualquer jeito por causa do Node/tsx. Conferido que o `src` é consumível pelo Babel do Metro: imports sem extensão, `isolatedModules: true` (`packages/tsconfig/base.json`), nenhum `enum` nem `namespace` em `packages/sheet-core/src` e `packages/ui/src`. A combinação "src do `@tms/ui` pelo Babel do frontend, com o `jsxImportSource` do NativeWind" já é a que o Jest roda (`apps/frontend/jest.config.js` herda o `babel.config.js` do app). O `scripts/check-bundle.mjs` já cobre `packages/(db|config|logger)/(src|dist)`, então a barreira contra código de servidor no bundle continua valendo.

**Mudanças.**

1. **`apps/frontend/metro.config.js`**: `resolveRequest` que devolve `packages/sheet-core/src/index.ts` e `packages/ui/src/index.ts` para esses dois nomes e passa o resto adiante (`context.resolveRequest`). Precisa vir **antes** do `withNativeWind` (`metro.config.js:27`), para o NativeWind embrulhar o nosso resolver e não o contrário. Comentário apontando para os mapeamentos do Jest, que precisam andar juntos.
   ```js
   // O app roda o mesmo código que o Jest testa (jest.config.js e
   // @tms/jest-config): os pacotes do monorepo vêm do src, sem build
   const SOURCE = {
     '@tms/sheet-core': path.join(workspaceRoot, 'packages/sheet-core/src/index.ts'),
     '@tms/ui': path.join(workspaceRoot, 'packages/ui/src/index.ts'),
   }
   config.resolver.resolveRequest = (context, name, platform) =>
     SOURCE[name]
       ? { type: 'sourceFile', filePath: SOURCE[name] }
       : context.resolveRequest(context, name, platform)
   ```
2. **`scripts/check-dev-env.mjs`** (novo, Node, sem dependência). É uma checagem, sem efeito colateral:
   - **S-02:** `node_modules/.pnpm/lock.yaml` (o lockfile que o pnpm grava do que instalou, presente também com `nodeLinker: hoisted`) tem de ser igual a `pnpm-lock.yaml`. Nesta máquina, depois do `--frozen-lockfile` das 12:45, os dois são idênticos byte a byte. Se faltar ou divergir: `Dependências diferentes do pnpm-lock.yaml. Rode: pnpm bootstrap`.
   - **S-01 (só para a API):** com `--dist config logger db sheet-core`, o arquivo mais novo de `packages/<p>/src` (sem `__tests__` e `*.test.*`) não pode ser mais novo que o `dist/`. Se for, ou se o `dist` faltar: `O build de @tms/<p> está mais velho que o código. Rode: pnpm bootstrap`. A comparação por mtime pode dar falso positivo (arquivo tocado sem mudar), e o efeito é só pedir um `pnpm bootstrap`, que resolve: o turbo restaura o `dist` do cache.
   - Mensagens só com caminho e comando; nada de conteúdo de arquivo nem de variável de ambiente.
3. **`package.json` (raiz):**
   - `bootstrap`: `pnpm install --frozen-lockfile && turbo run build --filter='@tms/api^...' --output-logs=errors-only`. O nome não pode ser `setup`, que é comando do próprio pnpm.
   - `dev:api`: `turbo run build --filter='@tms/api^...' --output-logs=errors-only && pnpm -C apps/api dev`. Com cache, o build leva cerca de 1 s.
   - `dev:web`: `pnpm -C apps/frontend web`.
   - `dev`: o build da API antes do `turbo run dev --parallel`, para a checagem da API não correr contra o primeiro `tsc --watch` dos pacotes.
4. **`apps/api/package.json:6` e `:15`** (`dev`, `templates:publish`): `node ../../scripts/check-dev-env.mjs --dist config logger db sheet-core && …`. Cobre quem roda `cd apps/api && bun run dev` direto (o roteiro e o CLAUDE.md fazem isso).
5. **`apps/frontend/package.json:6-9`** (`dev`, `web`, `android`, `ios`): `node ../../scripts/check-dev-env.mjs && …` (só o lockfile; com a opção C o Metro não lê `dist`).
6. **`doc/testes/prompt-teste-personas.md:58-63`, "Ambiente":**
   > Setup: `cp .env.example .env` (os comentários do arquivo dizem o que preencher), `npx pnpm bootstrap` (instala pelo lockfile e compila os pacotes da API), `npx pnpm db:up`, `npx pnpm db:migrate`, `npx pnpm templates:publish --published`, API com `npx pnpm dev:api`, web com `npx pnpm dev:web`. Com o banco migrado e os templates publicados, rode `npx pnpm seed:roteiro` (…o resto como está). Depois de atualizar o código, rode `npx pnpm bootstrap` de novo: a API e o web se recusam a subir com dependências ou build desatualizados e dizem o comando. App: `npx pnpm -C apps/frontend ios` / `android`.
7. **`CLAUDE.md`:** "Initial Setup" (`CLAUDE.md:56-64`) com `npx pnpm bootstrap` no lugar de `npx pnpm install`; "Development" (`:66-75`) com `dev:api` e `dev:web`, e a nota de que `cd apps/api && bun run dev` checa o ambiente; "Technical Stack" (`:213`) com Expo SDK 58, expo-router 58.0.26, React 19.3 e RN 0.88 (hoje diz SDK 57, React 19.2 e RN 0.86); "Testing" com os jobs de build nativo; "Troubleshooting" com "Atualize o app", "criação livre" indevida e `usePreventRemove is not a function` levando a `pnpm bootstrap`.

O `turbo.json` não muda neste pacote (ver a pergunta 4 do §9).

### 3.3 S-03 · `postgres` sem tag

**Confirmado.** `docker-compose.yml:3` usa `image: postgres`. É o único lugar sem tag: o CI usa `postgres:16` nos dois serviços (`ci.yml:116` e `:184`), e o `deploy/render/Dockerfile` usa só imagens com tag (`node:24-bookworm-slim`, `oven/bun:1.4.3`, `caddy:2.10`, `oven/bun:1.4.3-slim`). O `e2e/` não sobe container; usa o `E2E_DATABASE_URL`.

**Mudanças em `docker-compose.yml`:**

- `image: postgres:16`, a mesma tag do CI e do CLAUDE.md.
- `ports: - "127.0.0.1:5432:5432"` (hoje `"5432:5432"`, em todas as interfaces). Com as credenciais fixas de dev do compose, o banco local fica aberto para a rede onde a máquina estiver. No loopback, nada muda para quem desenvolve, porque a API, as migrations e o seed conectam em `localhost`.

**Digest: fixar a tag, não o digest, por ora.** O `16` recebe as correções de segurança da 16.x a cada `docker compose pull`. Um digest fixo sem automação que o atualize congela a imagem com as CVEs que vierem depois. Não há Dependabot nem Renovate no repositório (`.github/` só tem `workflows/ci.yml`). A pergunta 6 do §9 propõe o digest junto com a automação. Para quem tiver um volume criado por outra versão maior: `npx pnpm db:down` recria (apaga os dados locais, que são só de dev). Na subida para a 18 no futuro, o ponto de montagem do volume muda (a mensagem do ORQ-01).

### 3.4 S-04 · `.env.example` e seed

**Confirmado.**

- `.env.example:1`: `DATABASE_URL` com placeholders `{{DB_USER}}` e `{{DB_PORT}}`, que não passam no `z.url()` (`packages/config/src/env.ts:15`).
- `.env.example:7`: `JWT_SECRET=` vazio. O Bun carrega `""`, que reprova no `min(32)` (`env.ts:22`), e a API sai (`env.ts:61`). Falha segura, mas desnecessária: **sem** a variável, a API de dev já usa um segredo aleatório por processo e avisa no log (`apps/api/src/options.ts:75-86`), e em produção a ausência é recusada (`env.ts:33-38`). O problema é só a linha vazia no exemplo. A instrução `openssl rand -base64 48` já está no comentário (`.env.example:5-6`).
- Seed: um IP simulado por conta no `X-Forwarded-For` (`scripts/seed-roteiro.ts:42-43`, `:57`), que só vale com `TRUST_PROXY=true` (`apps/api/src/http/security.ts:29-40`). O aceite de convite é limitado por usuário **e** por IP (`apps/api/src/chronicles/routes.ts:525-537`, limite em `options.ts:60-64`: 10 a cada 15 min). São 13 aceites (J1 e J2 nas 6 crônicas, mais o J1 na "limite 20"). A mensagem do próprio seed (`seed-roteiro.ts:73`) diz "por conta", o que esconde o limite por IP.

**Mudanças.**

1. **`.env.example`:**
   - `DATABASE_URL` com a URL do Postgres do `docker-compose.yml` (a mesma do default de `env.ts:15-17`), com o comentário "só o Postgres local de desenvolvimento; fora daqui a URL vem do cofre de segredos (Azure Key Vault ou Google Secret Manager)".
   - `JWT_SECRET` **comentado**, com o texto: em dev, sem ele, a API usa um segredo aleatório por processo e as sessões caem quando ela reinicia; para fixar um local, gerar com `openssl rand -base64 48` e descomentar; nunca copiar um valor de outro lugar; em produção é obrigatório e vem do cofre.
   - As linhas do `TRUST_PROXY` (`.env.example:15-16`) ficam com o P02 (ver abaixo).
   - O `packages/config/src/env.ts` não muda: tratar `""` como ausente afrouxaria o "falha cedo" de um ambiente mal configurado.
2. **`scripts/seed-roteiro.ts`: a API em processo, uma instância por conta.** Por padrão (sem `SEED_API_URL`), o seed cria uma app com `createApp()` (`apps/api/src/index.ts:32`, a mesma que os testes usam) para cada conta, e chama `app.handle(new Request(…))` em vez de `fetch`. Cada instância tem o próprio rate limiter em memória com os **limites padrão**: a conta J1 faz 7 aceites na instância dela, a J2 faz 6 na dela, e nenhum limite muda. Também não depende de `TRUST_PROXY`, de `X-Forwarded-For` nem de opção de proxy: o seed para de se apoiar no `clientIp`, que é do P02. Os tokens de cada conta só são usados na instância dela (sem `JWT_SECRET`, cada instância sorteia o próprio segredo). No fim, `db.destroy()` para o processo sair.
   - Com `SEED_API_URL` (API remota, como o túnel do `scripts/tunel.sh`), o caminho HTTP atual continua, com o comentário corrigido: o IP simulado só vale se o proxy da frente repassar o cabeçalho do cliente.
   - O script raiz passa a `bun --env-file=.env scripts/seed-roteiro.ts` (o mesmo `.env` da API) e roda a checagem de ambiente da API antes. Conferir como o Bun trata `--env-file` sem `.env`: sem a variável, o `DATABASE_URL` cai no default, que é o compose.
   - O seed passa a precisar só do banco migrado e dos templates publicados, não da API no ar. A checagem `fetch(…/swagger)` (`seed-roteiro.ts:163-164`) sai do caminho em processo. A mensagem de 429 (`:73`) passa a dizer "por conta e por IP".
   - O log de acesso da API em processo sai no terminal (método, rota e status, sem corpo nem cabeçalho: `apps/api/src/middlewares/loggerMiddleware.ts:4-6`). Aceitável. A senha e os convites que o seed já imprime são das contas fictícias `@roteiro.test` e continuam como estão, porque o roteiro precisa deles.
3. Para testar, o seed passa a exportar uma função (`runSeed`) com o transporte injetável, e o `main()` só roda com `import.meta.main`.

**Divisão com o P02 (T-86) e conflito registrado.**

| Arquivo ou assunto | Dono | Por quê |
|---|---|---|
| `apps/api/src/http/security.ts` (`clientIp`), `apps/api/src/index.ts:54-58` (CORS com `x-forwarded-for`), `apps/api/src/options.ts` (`trustProxy`), `packages/config/src/env.ts:28-31` (`TRUST_PROXY`) | P02 | Semântica do proxy confiável e do rate limit |
| `.env.example:15-16` (comentário do `TRUST_PROXY`) | P02 | Acompanha a semântica que o P02 definir |
| `.env.example:1-7` (`DATABASE_URL`, `JWT_SECRET`) | P01-C | S-04 |
| `scripts/seed-roteiro.ts` | P01-C | O seed deixa de depender do `TRUST_PROXY` sem depender da mudança do P02 |
| `e2e/support/users.ts` e `e2e/playwright.config.ts:38` (o E2E simula clientes por `X-Forwarded-For` com `TRUST_PROXY: 'true'`) | P02 | Se o P02 mudar a confiança no cabeçalho, o E2E (inclusive o spec novo deste pacote, §4) depende disso |

Conflito: os dois pacotes editam `.env.example`, em linhas diferentes. O seed em processo só depende da assinatura `createApp(db, overrides)`, então o P02 pode renomear ou trocar a opção `trustProxy` sem quebrar o seed.

### 3.5 L-01 · "Este sistema usa criação livre" quando o template não carregou

**Confirmado.** `apps/frontend/components/chronicles/CreationSettings.tsx:109-115`: a condição da l.111 (`model === null || !model.template.creation || !effective`) junta "o app não compilou o template" (`compileSafe` devolve `null` em `UnsupportedTemplateError`, `apps/frontend/sheet/data.ts:103-117`) com "o sistema não tem criação por pontos". A causa da matriz está certa. **Há um segundo caso que ela não cita:** se o `GET` do template falhar (`useLatestTemplate`, `data.ts:84-96`), `latest.data` fica `undefined`, o `model` também, e a tela fica para sempre em "Carregando as regras do sistema…" (l.109-110), sem erro e sem ação. E o "Salvar regras da criação" (l.189-198) continua habilitado nos dois estados assim que a aprovação muda.

**Desenho (falha segura).** Quatro estados, em vez de três:

| Estado | Condição | Texto | Ação | Salvar |
|---|---|---|---|---|
| Carregando | `model === undefined` e sem erro | "Carregando as regras do sistema…" (como hoje) | — | bloqueado |
| Não carregou | `latest.isError && latest.data === undefined` (o mesmo critério de `data.ts:181`) | "Não foi possível carregar as regras deste sistema." | "Tentar de novo" (`latest.refetch()`) | bloqueado |
| Não suportado | `model === null` | O texto de "template não suportado" do L-02, na forma curta (no web, "Recarregue a página…"; no app, "Atualize o app…") | a do L-02 | bloqueado |
| Sem criação por pontos | `model` sem `template.creation` | "Este sistema usa criação livre; não há orçamento por pontos para configurar." (verdadeiro) | — | liberado (a aprovação vale) |

`disabled` do botão: `!changed || mutation.isPending || !rulesKnown`, com `rulesKnown = model != null`. Por que bloquear também a aprovação: o narrador decidiria sem ver as regras, e o `defaults` iria de volta sem ele ter visto. O servidor continua sendo a autoridade: ele valida o `defaults` contra o template publicado, só aceita o narrador e recusa a revisão velha (`apps/api/src/sheets/creation.ts:335-381`). O bloqueio no cliente é para não enganar, não para proteger.

### 3.6 L-02 · "Atualize o app" sem saída

**Confirmado.** `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx:50-56`. O `compileSafe` (`data.ts:103-117`) está certo e **não muda**: recusar o template desconhecido é a falha segura do motor (`packages/sheet-core/src/compile.ts:23-26`). O defeito é só a tela. A mesma mensagem aparece em mais dois lugares, com a mesma causa: a ficha (`apps/frontend/sheet/SheetScreen.tsx:99-106`, o QAW-03 cita "Nova ficha e Ficha") e o cartão da Mesa (`apps/frontend/components/chronicles/TableRow.tsx:45`). O estado de erro da Nova ficha (`new-character.tsx:43-49`) também não tem ação. Não há link de loja configurado: `apps/frontend/app.json` não tem `ios.appStoreUrl` nem `android.playStoreUrl` (os campos existem no schema, `node_modules/@expo/config-types/build/ExpoConfig.d.ts:354` e `:547`), e o app não tem `expo-updates`.

**Desenho.** Um componente em `apps/frontend/sheet/UnsupportedTemplate.tsx` (no app, não no `@tms/ui`, para não cruzar com o P06), usado nos três lugares. Ele monta o `EmptyState`, que já aceita `actions` (`packages/ui/src/EmptyState.tsx:6-11`):

- **Web:** título "Recarregue a página"; texto "As regras deste sistema são mais novas que esta página. Recarregue para buscar a versão atual; se continuar, avise o narrador."; botão "Recarregar" (`window.location.reload()`, só com `Platform.OS === 'web'`). Recarregar busca o bundle novo e o template de novo. Não precisa mudar a CSP (`scripts/web-headers.mjs`).
- **App:** título "Atualize o app"; texto "As regras deste sistema são mais novas que esta versão do app. Atualize pela loja; se já estiver atualizado, avise o narrador."; botão "Voltar" (`router.back()`); e o botão "Abrir a loja" **só** se `Constants.expoConfig?.ios?.appStoreUrl` (ou `android.playStoreUrl`) existir, for `https:` e o host for `apps.apple.com` ou `play.google.com`. Hoje nenhum está configurado, então o botão não aparece. Quando o app for publicado, basta preencher o `app.json`.
- **Mesa (`TableRow.tsx:45`):** a mesma regra no texto curto ("Recarregue a página para ver esta ficha." no web; o texto atual no app), via um helper do mesmo módulo.
- **Nova ficha, erro de carga (`new-character.tsx:43-49`):** o botão "Tentar de novo" refaz as duas consultas.

### 3.7 L-03 · A ficha quebra e o app volta sem dizer que criou

**A causa provável da matriz está errada.** O redirecionamento depois de criar está certo: `router.replace('/characters/${c.id}?mode=…')` (`new-character.tsx:90-95`). O que falta é **error boundary**: nenhum arquivo do app exporta `ErrorBoundary` (busca vazia em `apps/frontend`), então um erro de render na ficha sobe até a raiz. No ambiente do teste, o LogBox do dev mostrou o toast vermelho e a árvore remontou ("volta para Crônicas" e, no Lobisomem, o formulário vazio). Num build de produção, sem boundary, o provável é pior: no web o React desmonta a árvore (tela em branco); no nativo, erro fatal de JS.

**Desenho.**

1. **`apps/frontend/app/(app)/characters/[id].tsx`**: `export function ErrorBoundary({ error, retry }: ErrorBoundaryProps)`. O expo-router 58 embrulha a rota no `Try` quando a rota exporta `ErrorBoundary` (conferido em `node_modules/expo-router/build/useScreens.js:191-215`). A tela mostra: `Screen` com `AppBar` ("Ficha", voltar para `/` ou `router.back()`); `EmptyState` com o título "Não foi possível mostrar esta ficha" e o texto "O que já foi salvo continua na crônica. Tente de novo; se o erro continuar, avise o narrador."; as ações "Tentar de novo" (`retry`) e, no web, "Recarregar". O boundary **não** mostra `error.message` nem stack: o erro de validação pode repetir valores da ficha. O texto não afirma "a ficha foi criada", porque a rota também abre por link direto, com id qualquer.
2. **`new-character.tsx:90-95`**: no `onSuccess`, `toast.show({ message: 'Ficha criada.' })` antes do `router.replace`. Mesmo que a ficha não abra, a pessoa viu a confirmação, o que diminui a chance de criar outra igual. A idempotência de verdade é o T-02 do P03-C. A lista da crônica já é invalidada no sucesso (`apps/frontend/lib/queries/chronicles.ts:171-177`).
3. Com o boundary, a rota fica em `/characters/:id` mostrando o erro: não volta para o formulário. O "formulário vazio" do Lobisomem era a remontagem do dev, e não se repete.

## 4. Testes

**Regressão, um por item:**

| Item | Teste | Tipo | Arquivo |
|---|---|---|---|
| T-01 | Os jobs `native-android` e `native-ios`, mais o `check-native-versions.mjs` no `check`. A prova de que pegam o defeito: o commit 1 (CI) roda vermelho no `check:native` antes do commit 2 (local: o script acusa o 2.28.0 contra `~3.3.0`) | CI | `.github/workflows/ci.yml`, `scripts/check-native-versions.mjs` |
| S-01 | Sem `packages/sheet-core/dist`, o Metro resolve `@tms/sheet-core` para o `src`: teste Jest que carrega o `metro.config.js` e chama o `resolveRequest` com um `context` falso | Jest | `apps/frontend/test/metro-config.test.ts` (novo) |
| S-01, S-02 | `check-dev-env.mjs` com diretório temporário: lockfile igual passa; divergente ou ausente falha com o comando; `src` mais novo que o `dist` falha | Bun | `apps/api/src/__tests__/check-dev-env.test.ts` (novo; o script é `.mjs` puro e o Bun o importa; fica na API porque o `bunfig.toml` dela passa a ignorar `../../scripts/**` na cobertura, como no teste do seed) |
| S-03, S-04 | O `.env.example`, lido como está, passa no schema do config (`NODE_ENV=test`, `console.error` não chamado); não tem `JWT_SECRET` com valor; o `DATABASE_URL` dele aponta para o host, a porta, o usuário e o banco do `docker-compose.yml`; a imagem do compose tem tag | Bun | `packages/config/src/__tests__/env-example.test.ts` (novo) |
| S-04 | `runSeed` com uma instância de `createApp(testDb)` por conta, limites padrão e `trustProxy` padrão (falso): termina, com 7 crônicas e 13 aceites | Bun + PGLite (`useTestDb()`) | `apps/api/src/__tests__/seed-roteiro.test.ts` (novo); `apps/api/bunfig.toml` ganha `../../scripts/**` no `coveragePathIgnorePatterns` |
| L-01 | Template com `schema: 2`: não aparece "criação livre", aparece o texto de não suportado, e "Salvar regras da criação" fica desabilitado mesmo depois de mudar a aprovação. GET do template com 500: "Não foi possível carregar…" e "Tentar de novo" refaz a consulta. Template sem `creation`: "criação livre" e salvar liberado | Jest | `apps/frontend/components/chronicles/__tests__/CreationSettings.test.tsx` |
| L-02 | Nova ficha com `schema: 2`: no app (preset iOS do jest-expo), "Atualize o app" com "Voltar" e sem "Abrir a loja"; com `Platform.OS` em `web`, "Recarregar" chama `window.location.reload`. Helper da loja: aceita só `https` em `apps.apple.com` e `play.google.com`; recusa `http:`, `javascript:` e outro host | Jest | `apps/frontend/app/__tests__/new-character.test.tsx` (o teste da l.127 muda), `apps/frontend/sheet/__tests__/UnsupportedTemplate.test.tsx` (novo), `apps/frontend/sheet/__tests__/SheetScreen.test.tsx` (o teste da l.197 muda) |
| L-01, L-02 (web real, CSP de produção) | `context.route` no `GET …/systems/*/template` sobe o `schema` (o padrão já usado em `e2e/tests/offline.spec.ts:66`): a Nova ficha mostra "Recarregar"; "Criação de fichas" de uma crônica por pontos mostra o erro, e não "criação livre", com o salvar desabilitado | Playwright | `e2e/tests/template-unsupported.spec.ts` (novo) |
| L-03 | `ErrorBoundary` da rota: título, "Tentar de novo" chama `retry`, a mensagem do erro não aparece. Nova ficha: o sucesso mostra "Ficha criada." e depois chama `router.replace` | Jest | `apps/frontend/app/__tests__/character-route.test.tsx` (novo), `apps/frontend/app/__tests__/new-character.test.tsx` |

**Suítes existentes a rodar no pacote:** `npx pnpm typecheck`, `npx pnpm lint` (inclui `biome ci`), `npx pnpm turbo run test --filter=frontend --filter=@tms/ui --filter=@tms/config --filter=@tms/api`. O `@tms/ui` entra porque o Metro passa a ler o `src` dele, mas os testes dele não mudam. Mais `node scripts/check-native-versions.mjs` e `pnpm -C apps/frontend exec expo install --check`.

**Na integração da onda:** E2E completo (Chromium e WebKit, com o spec novo), porque a opção C muda a entrada do export web; build nativo dos dois sistemas (local ou `workflow_dispatch`); e o smoke do Maestro (`apps/frontend/.maestro/`, login, abrir ficha, Sangue, modo avião) no binário alinhado.

## 5. Segurança

| O que pode dar errado | Como o desenho evita |
|---|---|
| Action comprometida ou tag movida no CI | Todas as actions por SHA de commit, com a versão no comentário (convenção de `ci.yml:1-3`); as duas novas são de organizações oficiais (`actions/`, `gradle/`), com o SHA conferido no release; nenhuma action de terceiros para o Xcode |
| PR de fork lendo segredo ou escrevendo no repositório | Gatilho `pull_request`, não `pull_request_target`; `permissions: contents: read` no workflow; `persist-credentials: false` no checkout; **nenhum segredo** nos jobs nativos (Debug, sem assinatura, sem `EXPO_TOKEN`); nenhum binário publicado como artefato |
| Envenenamento de cache | O `setup-gradle` só grava cache na branch padrão; o cache do `actions/cache` criado num PR fica no escopo do PR; chaves pelo lockfile e pelo `Podfile` gerado |
| `gradle-wrapper.jar` adulterado no template do prebuild (baixado do npm) | A validação de wrapper do `setup-gradle` confere o checksum contra as distribuições oficiais |
| Dependência nativa fora da faixa testada | `expo install --check` e `check-native-versions.mjs` no `check`; o `expo-doctor` fica de fora para não baixar código fora do lockfile a cada run |
| Segredo fixo no `.env.example` copiado para algum lugar | O `JWT_SECRET` fica comentado, sem valor, com o comando para gerar; o teste `env-example.test.ts` falha se alguém puser valor. O `DATABASE_URL` do exemplo é a credencial de dev do compose, já versionada em `docker-compose.yml` e no default de `env.ts`, e não é segredo. O `.env` fica fora do git: `.gitignore:6` cobre `.env` em qualquer pasta (conferido com `git check-ignore` para `.env`, `apps/api/.env` e `apps/frontend/.env`), e só os dois `.env.example` são versionados |
| Banco de dev aberto na rede local com senha conhecida | Porta publicada só em `127.0.0.1` |
| Seed que contorna rate limit | Nenhum limite muda: cada conta usa uma instância própria com `defaultLimits`; a instância em processo exige acesso ao banco, que já permite tudo; o servidor de dev continua com `TRUST_PROXY=false` |
| L-01: salvar regras sem conhecê-las | Salvar bloqueado enquanto o template não carregou ou não é suportado; o servidor valida `defaults`, papel e revisão do mesmo jeito (`apps/api/src/sheets/creation.ts:335-381`) |
| L-02: link de loja virar vetor de redirecionamento | A URL vem só do `app.json` do build, nunca do servidor, e é aceita só com `https` e host da allowlist |
| L-03 e as checagens: dado sensível em log ou na tela | O boundary não mostra `error.message` nem stack e não manda o erro para lugar nenhum; os scripts imprimem só caminho, versão de pacote e comando; o log de acesso da API em processo não tem corpo nem cabeçalho |

O `/security-review` não é obrigatório para o P01-C pelo "Como executar", mas é recomendado no diff do `ci.yml` e do `.env.example`.

## 6. Como generaliza além do WoD

Tudo aqui é **genérico**. Build, setup, CI e seed não conhecem sistema. O seed só lista os códigos dos templates que já publica. As telas tratam "template que este app não entende" e "template sem criação por pontos" pelo contrato do motor (`UnsupportedTemplateError`, `template.creation`), e não por sistema. Um D&D ou um Call of Cthulhu sem orçamento por pontos cai no "usa criação livre" verdadeiro, e um template de versão mais nova de qualquer sistema cai no "Recarregar" ou "Atualize". Nenhum texto novo cita clã, raça ou qualquer termo de jogo. Nada de template nem de skin muda.

## 7. Critério de pronto

Os passos do "PR local" da matriz (`matriz-achados.md:67-73`):

1. **Plano aprovado**, com os arquivos deste documento conferidos no worktree antes de começar (as linhas citadas são de `3892588`).
2. **Typecheck, lint e testes** dos pacotes afetados: `frontend`, `@tms/ui`, `@tms/config`, `@tms/api`, mais `check:native` e `expo install --check` verdes.
3. **Um teste de regressão por item**, os da tabela do §4.
4. **`/code-review`** no diff do pacote (e o `/security-review` recomendado no §5).
5. **Os cenários das personas, repetidos sem o defeito:**
   - **T-01 (ORQ-04, 12:52–13:25):** `npx expo run:android` (`gradlew assembleDebug`) e `npx expo run:ios` (Debug, simulador) no `pacote/p01-c-build`, sem `react-native.config.js`: compilam e abrem o login. O build nativo ocupa vários GB, então roda uma vez, na integração da onda (local ou `workflow_dispatch`), e os jobs do CI ficam verdes no PR da onda (critério de saída da onda 1).
   - **S-03 (ORQ-01, 11:5x):** sem a imagem em cache (`docker image rm postgres:16`, se nenhum container a usar), `npx pnpm db:up` sobe o `tms-postgres` saudável na 16, e `docker compose ps` mostra `127.0.0.1:5432`.
   - **S-04 (ORQ-07):** num worktree limpo, `cp .env.example .env` e `npx pnpm dev:api`: a API sobe, com o aviso do segredo aleatório. `npx pnpm seed:roteiro` com `TRUST_PROXY=false` termina com as 7 crônicas e os 13 aceites.
   - **S-01 (ORQ-02, QAW-01; PO web 12:17; Experiente web 12:14):** apagar `packages/sheet-core/dist` e rodar `npx pnpm dev:web`. Na crônica "Vampiro v4" do seed, a Nova ficha abre o formulário (não "Atualize o app"), e "Criação de fichas" mostra "Por pontos / Livre". `cd apps/api && bun run dev` recusa e manda rodar `pnpm bootstrap`; depois dele, sobe.
   - **S-02 (ORQ-03, QAW-17; Experiente web 12:21):** com o `pnpm-lock.yaml` de `b9df17e^` posto no lugar sem instalar, `npx pnpm dev:web` recusa e diz o comando. Com o lockfile restaurado e `npx pnpm bootstrap`, abrir a ficha "Tibério Valadares (J2 web)" não dá `usePreventRemove is not a function`.
   - **L-01 (QAW-02, POW-02; PO web 12:15–12:16, "Vampiro por pontos (PO web)"):** com o template interceptado (o spec do §4, ou o mesmo `route` no Playwright à mão), "Criação de fichas" mostra o erro, não "criação livre", e o salvar fica desabilitado. Sem interceptação, o painel volta ao normal.
   - **L-02 (QAW-03, POW-03, NW-12, EW-02, IW-17):** no web 390 e 1280, a Nova ficha com o template interceptado mostra "Recarregue a página" e "Recarregar", que recarrega. No app (simulador iOS), mostra "Atualize o app" e "Voltar", sem botão de loja.
   - **L-03 (EW-03; PO web 12:21, Lobisomem):** com um `throw` temporário no `SheetScreen` (só local, nunca no commit), "Criar ficha" mostra "Ficha criada.", e a rota da ficha mostra "Não foi possível mostrar esta ficha" com "Tentar de novo". No Lobisomem, não volta para o formulário vazio. Sem o `throw`, "Tentar de novo" abre a ficha.
6. **Resumo para o PR da onda:** o que mudou, como foi testado, os tempos medidos dos jobs nativos e os achados da revisão.

## 8. Ordem dos commits, esforço, riscos e conflitos

**Commits** (cada um com typecheck e testes verdes, menos o 1, que fica vermelho de propósito no `check:native`):

1. `ci: build nativo de Android e iOS e checagem de versões nativas (D-00, T-01)`: `ci.yml` e `scripts/check-native-versions.mjs`, mais `check:native` na raiz.
2. `fix(frontend): react-native-gesture-handler na faixa do SDK 58 (T-01)`: `npx expo install react-native-gesture-handler` em `apps/frontend`, que muda o `package.json` e o `pnpm-lock.yaml`.
3. `chore(setup): Metro lê os pacotes do src, bootstrap e checagem do ambiente (S-01, S-02)`.
4. `chore(setup): Postgres 16 fixo e só no loopback (S-03)`.
5. `chore(setup): .env.example que funciona copiado e seed sem TRUST_PROXY (S-04)`, com os testes do config e do seed.
6. `fix(frontend): "Recarregar" no web e saída no app quando o template é mais novo (L-02)`, com o componente, as três telas e o spec E2E.
7. `fix(frontend): regras da criação não dizem "criação livre" quando o template não carregou (L-01)`. Usa o componente do commit 6.
8. `fix(frontend): error boundary na ficha e "Ficha criada." ao criar (L-03)`.
9. `docs: setup do roteiro e do CLAUDE.md (S-01 a S-04, D-00)`.

**Esforço:** **M** no total. São 8 linhas P na matriz; o que pesa é medir e ajustar os jobs nativos (cache, runner macOS, Xcode) no primeiro run.

**Riscos:**

- **O 3.3.x pode não compilar com este conjunto** (reanimated 4.7.1, worklets 0.13.0, nova arquitetura): só o job prova. Plano B pronto: exclusão por `react-native.config.js`, a do build de teste.
- **A opção C muda a entrada do export web e dos bundles nativos.** É o mesmo código, transpilado pelo Babel, a mesma combinação que o Jest roda. Coberto pelo E2E da integração e pelo `expo export` de iOS e Android no CI.
- **O Xcode e o runner macOS do SDK 58** podem não existir com o label esperado. O tempo do iOS também pode passar da estimativa (ccache como segunda etapa).
- **`expo export --platform ios` no Linux** depende do `hermesc` Linux do RN 0.88. Se não funcionar, o passo vai para o job macOS.
- **O prebuild baixa o template do npm** (rede no CI). A validação do wrapper cobre o jar.
- **Falso positivo da checagem por mtime**: o efeito é só pedir `pnpm bootstrap`.
- **Run do CI bem mais longo** (de ~4 min para ~20–40 min de relógio) em todo PR.

**Conflitos com os outros pacotes da onda.** Ordem sugerida de merge na onda: **P01-C primeiro** ("Vem antes de tudo", matriz), e quem vier depois faz rebase.

| Arquivo | P01-C | Outro pacote | Risco |
|---|---|---|---|
| `apps/frontend/components/chronicles/CreationSettings.tsx` | L-01: l.109-115 e l.193 | **P03-C** T-56 (guarda de saída das regras: import e três linhas em l.89). O **P06** não edita este arquivo (consolidação, [onda-1.md](onda-1.md)): o título visível vem de dentro do `Choice` e o `max=1000` só muda na leitura do `Stepper`, mas a tela renderizada muda | **Alto** com o P03-C: o P01-C entra antes e o P03-C resolve no rebase, mantendo os quatro estados do §3.5 e o `disabled`. Os testes do L-01 devem buscar por papel e rótulo, não por texto que o título do `Choice` passa a repetir |
| `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx` | L-02: l.43-56; L-03: `onSuccess` em l.90-95 | **P03-C** T-02 (`clientCommandId` e trava por `ref` no `onSubmit`, l.78-90) e T-56 (guarda de saída) | **Alto** no `onSuccess`: os dois mexem no mesmo bloco. Resultado esperado: `clientCommandId` (T-02), depois "Ficha criada." (L-03), depois o `replace` |
| `apps/frontend/components/chronicles/TableRow.tsx` | L-02: l.45 | **P06** T-61 (rótulo do cartão, l.44-66) | Médio: trechos vizinhos |
| `apps/frontend/sheet/SheetScreen.tsx` | L-02: l.99-106 | **P06** T-42 (~l.453); P03-C pode mexer no cabeçalho (T-17) | Baixo: trechos distantes |
| `.env.example` | S-04: l.1-7 | **P02** T-86 (comentário do `TRUST_PROXY`, l.15-16) | Baixo: linhas diferentes; divisão no §3.4 |
| `scripts/seed-roteiro.ts` | S-04 | **P02** T-86 cita "o seed deixa de depender disso (S-04)" | Nenhum, se o P02 não mexer no seed: o seed em processo não usa `clientIp` nem `trustProxy` |
| `e2e/tests/template-unsupported.spec.ts` (novo) | L-01, L-02 | **P02** T-86 pode mudar como o E2E simula clientes (`e2e/support/users.ts`) | Indireto: o spec novo usa o `signUp` do E2E como os outros |
| `doc/testes/prompt-teste-personas.md`, `CLAUDE.md` | S-01 a S-04, D-00 | P02 pode documentar o `TRUST_PROXY` | Baixo |

**Arquivos tocados**

| Arquivo | Itens | Tipo de mudança |
|---|---|---|
| `.github/workflows/ci.yml` | T-01 (D-00) | jobs `native-android` e `native-ios`; dois passos no `check`; `workflow_dispatch`; comentário do cabeçalho |
| `scripts/check-native-versions.mjs` | T-01 | novo |
| `apps/frontend/package.json` | T-01, S-02 | dependência `react-native-gesture-handler` `~3.3.x`; scripts `dev`, `web`, `android` e `ios` com a checagem |
| `pnpm-lock.yaml` | T-01 | regenerado pelo `expo install` |
| `package.json` (raiz) | T-01, S-01, S-02, S-04 | scripts `bootstrap`, `dev`, `dev:api`, `dev:web`, `check:native` e `seed:roteiro` |
| `apps/frontend/metro.config.js` | S-01 | `resolveRequest` para `@tms/sheet-core` e `@tms/ui` no `src` |
| `scripts/check-dev-env.mjs` | S-01, S-02 | novo |
| `apps/api/package.json` | S-01, S-02 | `dev` e `templates:publish` com a checagem |
| `docker-compose.yml` | S-03 | `postgres:16`; porta em `127.0.0.1` |
| `.env.example` | S-04 | `DATABASE_URL` do compose; `JWT_SECRET` comentado, com instrução |
| `scripts/seed-roteiro.ts` | S-04 | API em processo, uma instância por conta; `runSeed` exportado; HTTP só com `SEED_API_URL`; mensagem de 429 |
| `apps/api/bunfig.toml` | S-01, S-02, S-04 | `../../scripts/**` no `coveragePathIgnorePatterns` (os testes do seed e da checagem importam scripts da raiz) |
| `apps/frontend/sheet/UnsupportedTemplate.tsx` | L-02, L-01 | novo (componente e helpers de texto e de loja) |
| `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx` | L-02, L-03 | estados das l.43-56; toast no `onSuccess` |
| `apps/frontend/sheet/SheetScreen.tsx` | L-02 | caso `unsupported` (l.99-106) |
| `apps/frontend/components/chronicles/TableRow.tsx` | L-02 | texto da l.45 pelo helper |
| `apps/frontend/components/chronicles/CreationSettings.tsx` | L-01 | estados das l.109-115; `disabled` da l.193 |
| `apps/frontend/app/(app)/characters/[id].tsx` | L-03 | `export function ErrorBoundary` |
| `apps/frontend/test/metro-config.test.ts` | S-01 | novo |
| `apps/api/src/__tests__/check-dev-env.test.ts` | S-01, S-02 | novo |
| `packages/config/src/__tests__/env-example.test.ts` | S-03, S-04 | novo |
| `apps/api/src/__tests__/seed-roteiro.test.ts` | S-04 | novo |
| `apps/frontend/components/chronicles/__tests__/CreationSettings.test.tsx` | L-01 | casos novos |
| `apps/frontend/app/__tests__/new-character.test.tsx` | L-02, L-03 | teste da l.127 atualizado; casos novos |
| `apps/frontend/sheet/__tests__/SheetScreen.test.tsx` | L-02 | teste da l.197 atualizado |
| `apps/frontend/sheet/__tests__/UnsupportedTemplate.test.tsx` | L-02 | novo |
| `apps/frontend/app/__tests__/character-route.test.tsx` | L-03 | novo |
| `e2e/tests/template-unsupported.spec.ts` | L-01, L-02 | novo |
| `doc/testes/prompt-teste-personas.md` | S-01 a S-04 | "Ambiente" (l.58-63) |
| `CLAUDE.md` | T-01, S-01 a S-04 | setup, dev, stack, testes (CI nativo) e troubleshooting |

## 9. Perguntas abertas (técnicas)

1. **Runner e Xcode do iOS.** Qual label de runner macOS tem o Xcode que o SDK 58 e o RN 0.88 exigem (o teste usou iOS 26.5)? O SDK 58 usa o React Native pré-compilado no iOS por padrão? Isso muda o tempo do job em dezenas de minutos.
2. **Custo do "todo PR".** O repositório é privado (o minuto de macOS custa cerca de 10× o de Linux)? A D-00 está decidida; a dúvida é técnica: vale `needs: check` no job iOS (não queima macOS quando o lint falha, mas atrasa o resultado) ou um filtro de caminho? O filtro precisa de um job que sempre rode e saia cedo; com `paths:` no gatilho, um check obrigatório fica "pendente" para sempre.
3. **`expo export --platform ios` no Linux** funciona com o `hermesc` do RN 0.88? Se não, o passo vai para o job macOS.
4. **`pnpm dev:expo`** (`turbo run dev --filter=frontend`) provavelmente é recusado pelo turbo, porque `dev` depende de `^dev` (`turbo.json:4-7`), que é persistente. Conferir com `--dry`. Trocar para `dependsOn: ["^build"]` neste pacote ou num pacote à parte?
5. **Boundary em toda tela do `(app)`.** Pôr o mesmo boundary para todas as telas (`unstable_settings.screenErrorBoundary` ou `ErrorBoundary` em `app/(app)/_layout.tsx`, que o P06 mexe no T-72) agora ou depois da onda?
6. **Digest da imagem do Postgres** (compose e CI) junto com Dependabot (`docker-compose` e `github-actions`), para o digest e os SHAs das actions se atualizarem sozinhos. Entra neste ciclo?
7. **Tipos no editor.** O `tsc` e o editor continuam lendo os `.d.ts` do `dist` (tipo velho no editor até o build). Vale `customConditions` ou `paths` para o `src` num pacote futuro?

## 10. Desvios na implementação

Registrados na implementação (branch `pacote/p01-c-build`). Nenhum muda o objetivo de um item, remove campo ou afrouxa limite.

1. **T-01, versão fixa.** `react-native-gesture-handler` entrou como `3.3.0` exato (o `~3.3.0` do `bundledNativeModules.json`; só existe a 3.3.0 na faixa), porque o `apps/frontend/package.json` fixa versões exatas. O 3.3.0 depende de `@types/react-test-renderer`, que passou a tipar o `screen.root` do Testing Library: o `sheet/views/__tests__/matrix.test.tsx` comparava `n.type === 'Text'` e ganhou um `as unknown` (TS2367). Testes novos que comparem o tipo do nó com string precisam do mesmo.
2. **T-01, `expo install --check` offline.** Online, o CLI compara com o último patch publicado (hoje acusa `react-native` 0.88.1, `expo-router` 58.0.29, `jest` 30 e `typescript` 6) e falharia em todo PR, sem depender do lockfile. No CI roda com `EXPO_OFFLINE=1`, contra o `bundledNativeModules.json` do expo instalado. Os patches novos do SDK 58 ficam para uma subida própria.
3. **D-00, CI.** Runner `macos-26` com `Xcode_26.6` fixo: o `expo-router` 58 usa APIs do SDK do iOS 26 (`@available(iOS 26)`), e o RN 0.88 pede Xcode 16.1 ou mais. `actions/setup-java` v6.1.0 e `gradle/actions/setup-gradle` v6.4.0 por SHA do commit da tag; a v6.4.1 tinha 4 dias e só corrige o `dependency-submission`, que não usamos. O `setup-gradle` vem **depois** do prebuild, para a validação do wrapper ver o `gradle-wrapper.jar` gerado. Sem `needs:` e sem filtro de caminho.
4. **S-01, barreira do bundle.** O §3.2 dizia que o `scripts/check-bundle.mjs` continuava valendo. Não valia: o Metro do SDK 58 grava index maps (`sections`), e o script lia 0 módulos e aprovava qualquer bundle. Agora ele lê os dois formatos e falha se não ler nenhum módulo (teste em `apps/api/src/__tests__/check-bundle.test.ts`).
5. **Pergunta 4, `dev:expo`.** Confirmado com `turbo --dry`: o turbo recusa o `turbo run dev --filter=frontend`. O script chama `pnpm -C apps/frontend dev` direto: com o Metro lendo o `src`, o app não precisa de build. O `turbo.json` não mudou.
6. **Cache do turbo.** Os testes do `@tms/config` leem `.env.example`, `docker-compose.yml` e `ci.yml`, e os da API testam `scripts/`. Os dois `turbo.jsonc` declaram esses arquivos como entrada, para mudar um deles invalidar o cache.
7. **S-04, seed.** Para fechar o pool no fim, o seed resolve o `@tms/db` a partir de `apps/api` (`createRequire`), o mesmo módulo que a API usa. O aviso de template ausente passou a citar `pnpm db:migrate`, porque as migrations já gravam os templates do produto. O teste do seed também prova que uma API só, para todas as contas, continua barrada pelo limite por IP.
8. **Testes a mais e em outro lugar.** O teste do S-03 nasceu no commit 4 (o `env-example.test.ts`, que o commit 5 completa). Entraram dois testes que o §4 não listava: `check-native-versions.test.ts` (o caso do 2.28.0 contra o `~3.3.0`) e `check-bundle.test.ts`. O `character-route.test.tsx` já existia: os casos do L-03 entraram nele.
9. **L-01, estado "não suportado" no app.** Dentro do painel, só o texto curto. "Voltar" não cabe numa seção da tela da crônica. No web, o painel tem "Recarregar".
10. **L-02, "Voltar" da ficha.** O componente aceita `onBack`. Na ficha, "Voltar" usa a mesma saída da `AppBar` (a crônica, ou Crônicas), não `router.back()`.
11. **Cenários das personas.**
    - Repetidos no worktree:
      - S-01: export web sem os `dist` do `sheet-core` e do `ui`, e a API recusando subir com `src` mais novo;
      - S-02: `dev:web` recusando com o lockfile instalado divergente;
      - S-04: `seed:roteiro` em processo num banco próprio, com `TRUST_PROXY=false`, terminando com as 7 crônicas.
    - Ficam para a integração:
      - S-03, porque não se reinicia o container compartilhado;
      - o build nativo;
      - o E2E `template-unsupported.spec.ts`;
      - os cenários de L-01, L-02 e L-03 no navegador e no simulador.
12. **Depois do `/code-review`.**
    - **Checagem do dist.** Comparar por data (§3.2) quebrava o job `postgres` do CI: o `db:codegen` regrava o `types.ts` depois do build. Também recusava em salvar sem mudar ou trocar de branch e voltar, e o bootstrap não resolvia. Agora o build de config, logger, db e sheet-core grava `dist/src-hash.json` (`scripts/src-hash.mjs`), e o check compara o conteúdo.
    - **`check:native`.** Percorre também os `node_modules` aninhados e trava o patch no `^0.0.z`.
    - **Seed.** Em processo, recusa banco que não seja local, a não ser com `SEED_ALLOW_REMOTE_DB=1`. Só roda o check do ambiente nesse modo. Num 429, para dizendo quantas crônicas ficaram prontas.
    - **Achado descartado.** O "`loadFailed` continua verdadeiro durante o refetch" do L-01 não se confirmou: no React Query 5, um refetch sem dado volta o status para `pending` (`fetchState` do query-core). O painel mostra "Carregando…" sem o botão.
