# Plano do pacote P02: segurança, sessão e API

> Plano · 2026-11-01 · base conferida: `onda/1-fundacao` em `3892588` (código igual ao `main` `1db3db9`).

Este plano implementa o pacote [P02 da matriz de achados](../testes/2026-11-01/matriz-achados.md#p02), onda 1 (Fundação). O pacote é de **correção**: não tem decisão de produto própria e não muda regra do jogo, campo de ficha nem limite (nenhum rate limit fica mais frouxo). Ele fecha o que o [relatório técnico, §5](../testes/2026-11-01/relatorio-tecnico.md) deixou aberto na sessão e na API: dado sensível no cache HTTP do aparelho, logout que não revoga sem rede, IP do rate limit que pode vir do cliente, hora errada na Mesa e ruído de 404/401 no console.

Branch local: `pacote/p02-seguranca`, num worktree próprio, saindo da ponta de `onda/1-fundacao`. Antes do merge na onda, o pacote passa por `/code-review` **e** `/security-review` (matriz, "Como executar", passo 4).

| Documento | Papel |
|---|---|
| [matriz-achados.md, P02](../testes/2026-11-01/matriz-achados.md#p02) (l.115–132) | Itens, evidências e recomendações (as marcadas "(estimado)" foram conferidas aqui) |
| [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) §5 e §7 | O que passou e o que falhou na segurança; esboço do T-13 |
| Notas `qa-app.md` (QAA-02, QAA-32), `qa-web.md` (QAW-06, QAW-29, QAW-33, QAW-41), `po-web.md` (POW-05), `orquestrador.md` (ORQ-07) | Cenários das personas para o critério de pronto |
| [checklist-seguranca-v0.md](../checklist-seguranca-v0.md) | Controles e testes de sessão, CORS, cabeçalhos e armazenamento (atualizado no fim) |
| [validacao-v5.md](../validacao-v5.md) l.154–156 | Limitação "cache já visto", que o T-13 reduz |
| [P01-C-build-setup.md](P01-C-build-setup.md) §3.4 | Divisão do S-04 (seed e `.env.example`) com o T-86 |

## 1. Objetivo e itens

**Objetivo (da matriz):** nenhum token nem dado oculto fica em disco depois do logout; o logout revoga a sessão mesmo offline; o rate limit não confia em header do cliente; a API responde sem 404/401 de ruído e com a hora certa.

| ID | Sev. | Em uma linha | Achado por |
|---|---|---|---|
| T-13 | alta | Respostas da API sem `Cache-Control`: o cache HTTP do iOS (NSURLCache) e do Android (OkHttp) guarda tokens e dados ocultos em disco, em claro, depois do logout. | QAA-02 (iOS 15:22, Android 16:02) |
| T-14 | alta | Logout offline descarta a pendência sem aviso e não revoga: de volta online, recarregar entra sozinho. O logout online não apaga o cookie `tms_refresh`. | QAW-33 |
| T-47 | média | `characters.updated_at` sem fuso: a ficha nova aparece "alterada às 15:25" às 13:04 e a ordem por "Última alteração" erra. | QAW-29, POW-05 |
| T-74 | baixa | `GET /chronicles/:id/transfer` responde 404 como "nenhuma transferência" e a carga sem sessão faz `POST /auth/refresh` → 401: erro de recurso no console. | QAW-41, QAW-06 |
| T-86 | baixa | Com `TRUST_PROXY=true` sem proxy, o rate limit usa o `X-Forwarded-For` que o cliente manda, e o CORS libera esse header. | QAA-32 (suposto) |

## 2. Decisões aplicadas

O P02 **não tem decisão de produto própria** (coluna "Decisões" vazia na matriz). Das decisões D-00 a D-14, só uma toca o desenho:

- **D-00 (build nativo no CI, P01-C):** a parte nativa do T-13 (módulo local que desliga e limpa o cache HTTP, §3.1) só fica provada quando o app voltar a compilar (T-01) e o build de Android e iOS rodar no CI. O P02 é escrito e testado em Jest e na API sem depender disso, mas a verificação no aparelho e no CI acontece depois do merge do P01-C na onda.

Nenhuma outra decisão se aplica (D-14, do convite no fragmento `#`, é do P12, onda 5). Nenhuma decisão contradiz o código lido.

**Recomendações "(estimado)" da matriz que o código corrige ou precisa:**

- **T-74, "200 com `null`":** no Elysia 1.4.30, devolver `null` gera **200 com corpo vazio e sem `content-type`** (`node_modules/elysia/dist/adapter/bun/handler.mjs:30-31`), e o Eden 1.4.9 entrega `""` ao app, não `null` (`node_modules/@elysiajs/eden/dist/chunk-I5KHAGLL.mjs`, `g("")` devolve a própria string). Funciona, desde que o app normalize (§3.3). A matriz está certa no contrato; a ressalva é de implementação.
- **T-86, "sem proxy confiável, o `clientIp` usa o IP do socket":** já é assim (`apps/api/src/http/security.ts:39`, `server.requestIP`), e com proxy já usa o **último** hop (`:36`). A causa é de configuração (o `.env` local ligou o `TRUST_PROXY` por causa do seed), não de código. O que falta é o resto da recomendação: tirar o header do CORS, validar o hop e separar a simulação de clientes do E2E do proxy de produção (§3.4).
- **T-14, "o servidor não apaga o cookie":** o logout chama `jar.remove()` (`apps/api/src/auth/routes.ts:221`), que no Elysia 1.4.30 (`node_modules/elysia/dist/cookies.mjs:128-135`) emite `tms_refresh=; Max-Age=0; Expires=…1970` **sem** `Path`, `HttpOnly`, `Secure` e `SameSite`. A remoção fica dependendo do *default-path* do navegador (`/auth`, derivado de `/auth/logout`), e o teste atual só confere `Max-Age=0` (`apps/api/src/__tests__/auth.test.ts:416-426`). Pela leitura não dá para afirmar por que o QA viu o cookie ficar; a correção (atributos explícitos, como o `DELETE /me` já faz em `apps/api/src/account/routes.ts:125-132`) vale de todo jeito, e o E2E prova pelo `context.cookies()`.
- **T-47:** a causa da matriz está certa e é mais ampla do que uma coluna (§3.5).

## 3. Desenho por item

### 3.1 T-13 · Cache HTTP em disco no aparelho

**Confirmado no código.**

- O mapa `HEADERS` (`apps/api/src/http/security.ts:5-13`) não tem `cache-control` nem `pragma`; nenhum `no-store` em `apps/api/src`.
- O mapa vale para **toda resposta que o Elysia monta**: o `onRequest` é global e é o primeiro plugin (`apps/api/src/index.ts:42`, antes do logger, do `onError`, do CORS e do swagger). Grava em `set.headers`, que entram:
  - nas respostas normais e nas de erro (o `onError` de `apps/api/src/http/on-error.ts` só troca o status e o corpo; 401, 404 do roteador, 400 de validação e de *parse*, 429 e 500 saem com o mesmo `set`). O teste `auth.test.ts:451-466` já prova 200, 401 e 404 para os outros cabeçalhos;
  - no preflight CORS, que o plugin responde no próprio `onRequest` com `new Response(null, { status: 204 })` (`node_modules/@elysiajs/cors/dist/index.mjs:101-121`); o Elysia mescla o `set.headers` nessa `Response` (é assim que o `access-control-allow-origin` chega lá, provado em `auth.test.ts:434`);
  - no `/swagger` (só fora de produção), que só perde a CSP (`security.ts:20-21`).
- **Exceção, sem dado sensível:** o que o Bun responde antes do Elysia (corpo acima do `maxRequestBodySize` → 413, HTTP malformado → 400) sai sem os cabeçalhos. Não precisa de ligação extra; fica registrado.
- **No iOS**, o `fetch` do RN vai pelo `RCTHTTPRequestHandler`, que cria a `NSURLSession` **sob demanda** com `defaultSessionConfiguration` (`node_modules/react-native/Libraries/Network/RCTHTTPRequestHandler.mm:76-103`): o `URLCache` dela é o `URLCache.shared`, gravado em `Library/Caches/com.tms.app/Cache.db` (o arquivo que o QA leu). O RN expõe `RCTSetCustomNSURLSessionConfigurationProvider` (`:21-26`), mas só por código nativo.
- **No Android**, o `NetworkingModule` usa `OkHttpClientProvider.createClient(context)` (`node_modules/react-native/ReactAndroid/.../NetworkingModule.kt:145-175`), que monta um `Cache(File(cacheDir, "http-cache"), 10 MB)` (`OkHttpClientProvider.kt:61-78`), a não ser que alguém registre uma fábrica com `setOkHttpClientFactory` (`:28-30`), também só por código nativo.
- **`fetch(url, { cache: 'no-store' })` não serve no nativo e piora:** o RN usa o polyfill `whatwg-fetch` 3.6.20 (`node_modules/react-native/Libraries/Network/fetch.js:15`), que implementa `no-store` acrescentando `_=<timestamp>` à URL de GET e HEAD (`node_modules/whatwg-fetch/fetch.js:397-409`). Cada resposta seria gravada sob uma URL nova (o cache cresce), e a camada nativa ignora a opção. Não usar.

**O que muda: na API (resolve para todas as versões do app instaladas, para respostas novas).**

```ts
// apps/api/src/http/security.ts (esboço)
const HEADERS: Readonly<Record<string, string>> = {
  // ...os cabeçalhos atuais...
  // A API só devolve dado de sessão: nada vai para cache de navegador,
  // de proxy ou do sistema (NSURLCache, OkHttp). MASVS-STORAGE; ASVS 8.2.1
  'cache-control': 'no-store',
  pragma: 'no-cache',
}
```

`no-store` basta (cobre também cache compartilhado); `pragma` é o legado HTTP/1.0 que o QA pediu. O NSURLCache e o OkHttp respeitam `no-store` na resposta. O `no-store` em respostas de `fetch` não afeta o bfcache do web (que olha o documento HTML).

**O que muda: no app.**

| Medida | Precisa de código nativo? | O que resolve |
|---|---|---|
| `no-store` na resposta (acima) | Não | Para de gravar respostas **novas** em qualquer versão instalada. Não apaga o que já está em disco. |
| `cache-control: no-store` **na requisição**, só no nativo (`apps/frontend/lib/http.ts`, em `createAuthFetch` e no `#post` da sessão; arquivo com sufixo `.native.ts` para a constante, como o `tokenStore`) | Não | Defesa em profundidade no Android: o OkHttp não grava se a requisição pede `no-store` (`CacheStrategy.isCacheable`). No iOS não há garantia documentada. **No web, não:** o header deixaria de ser *safelisted* e teria de entrar no CORS, sem ganho (o navegador já respeita a resposta). |
| Desligar o cache em disco e **purgar o que já foi gravado** | **Sim** | Apaga tokens e dados ocultos dos aparelhos já instalados (QAA-02) e garante que nada novo vá a disco, mesmo se uma resposta vier sem o header (erro de proxy). |

Para a purga, a proposta é um **módulo local do Expo** em `apps/frontend/modules/http-cache/` (Expo Modules API, que já vem com o `expo`; autolinkado pela pasta `modules/`, sem mudar `package.json` nem `app.json`, e **sem pacote de terceiros**):

- **iOS**, num assinante do `AppDelegate` (`didFinishLaunchingWithOptions`, antes do JS e antes da sessão do RN, que é criada sob demanda): `URLCache.shared.removeAllCachedResponses()` e troca do `URLCache.shared` por um com `diskCapacity: 0` (e memória mínima). Função JS `purgeHttpCache()` chama `removeAllCachedResponses()` de novo.
- **Android**, num ouvinte do ciclo de vida da `Application` (`onCreate`, antes do `NetworkingModule`): `OkHttpClientProvider.setOkHttpClientFactory { OkHttpClientProvider.createClientBuilder().build() }` (o construtor sem `context` não põe cache e mantém o `ReactCookieJarContainer`) e apagar `cacheDir/http-cache`. `purgeHttpCache()` apaga a pasta de novo.
- **JS** (`modules/http-cache/index.ts`): `requireOptionalNativeModule`; no web, no Expo Go e no Jest é no-op.
- **Quando purgar:** a cada abertura do app (cobre a primeira abertura depois da atualização, que é a purga dos aparelhos instalados, e é barata) e em todo `signOut` (ouvinte registrado no `SessionProvider`).
- Os nomes exatos das interfaces de ciclo de vida do `expo-modules-core` 58 (assinante do `AppDelegate` e ouvinte da `Application` no `expo-module.config.json`) são conferidos na implementação; o desenho não depende de qual das duas formas a versão usa.

**Fora do escopo, registrado:** o carregador de imagens do RN tem cache próprio (retratos `portrait_url`, HTTPS de terceiros). Um retrato de NPC oculto visto pelo narrador pode ficar ali; risco baixo e sem token.

### 3.2 T-14 · Logout que revoga mesmo sem rede

**Confirmado no código.**

- `Session.logout()` (`apps/frontend/lib/session/session.ts:144-154`) tenta `POST /auth/logout` e, sem rede, engole o erro e chama `signOut()`. No web o cookie `httpOnly` continua no navegador e válido no servidor; o `restore()` do próximo carregamento chama `/auth/refresh` (`:109-122`, `:166-193`) e entra de novo. No nativo, `signOut()` apaga o refresh do SecureStore (`tokenStore.native.ts:15`): o aparelho não renova mais, mas a família continua válida no servidor até vencer (30 dias sem uso, 90 no total, `apps/api/src/options.ts:102-106`). Se o token já tinha vazado (por exemplo, pelo `Cache.db` do T-13), segue utilizável.
- O botão "Sair" chama `session.logout()` direto, sem olhar a fila (`apps/frontend/app/(app)/index.tsx:105-109`). A fila persistida (outbox) é apagada no `signOut` pelo `SyncProvider` (`apps/frontend/sheet/sync/SyncProvider.tsx:57-63`): é a perda do Sangue gasto offline (QAW-33).
- Os ouvintes do `signOut` são síncronos (`session.ts:163`); a limpeza do storage do usuário é disparada sem esperar (`apps/frontend/lib/persist.tsx:281-289`, `void userStorage.clear()`).
- `revokeSession` revoga a **família** a partir de qualquer token dela, mesmo já trocado (`apps/api/src/auth/sessions.ts:133-145`): uma revogação pendente com um token antigo ainda derruba a sessão inteira. Bom para o desenho abaixo.

**API (`apps/api/src/auth/routes.ts`).**

1. Um helper `clearRefreshCookie(jar)` que grava `value: ''`, `httpOnly: true`, `secure: options.secureCookies`, `sameSite: 'strict'`, `path: '/auth'`, `maxAge: 0` e `expires: new Date(0)`, os mesmos atributos do `respond` (`:81-88`). Usado no logout (`:221`), no refresh recusado (`:193`) e no `DELETE /me` (`account/routes.ts:125-132`, que hoje repete o bloco). Só para cliente web (sem `x-tms-client: native`), e mesmo quando o cookie não veio: apagar o que não existe é inofensivo.
2. **Login e cadastro no web revogam a família do cookie anterior**, se ele vier e a `Origin` estiver na allowlist (variante do `fromCookie`, `:57-64`, que não lança 403 no login). Defesa em profundidade para o caso em que a revogação pendente não pôde ser enviada e a pessoa entra de novo no mesmo navegador: o cookie novo sobrescreve o antigo, e o antigo morreria órfão, mas válido. Abas do mesmo navegador dividem o cookie, então nada quebra.

**App: revogação pendente.** A ordem é sempre: **registrar a pendência → apagar tudo localmente → tentar revogar**. Se o app morrer no meio, a próxima abertura revoga antes de qualquer outra coisa (fail secure).

*Web (refresh no cookie `httpOnly`, que o JS não lê).* Um **marcador de estado da sessão, sem segredo**, no `deviceStorage` (IndexedDB `tms-offline`), na chave `session:state`, fora do prefixo do usuário (`u:<id>:`), como o `session:lastUser` (`apps/frontend/lib/session/lastUser.ts:6`). Fica no IndexedDB, e não no `localStorage`, pela regra do próprio projeto (`storage.web.ts:3-5`, `tokenStore.ts:1-4`) e porque o teste `session.test.ts:185` exige que a sessão não use `localStorage`. O valor é só um destes: `signed-in`, `signed-out`, `logout-pending`.

| Evento | Marcador | Rede |
|---|---|---|
| Login, cadastro ou refresh aceitos | `signed-in` | — |
| Refresh recusado (401/403) | `signed-out` | — |
| "Sair" (online ou não) | `logout-pending`, **antes** de limpar | depois da limpeza local, `POST /auth/logout` com `credentials: 'include'` |
| `POST /auth/logout` 2xx | `signed-out` | o servidor revoga e apaga o cookie |
| Falha de rede ou 5xx no logout | continua `logout-pending` | nova tentativa no próximo `online` e na próxima abertura |
| Abertura com `logout-pending` | — | tenta o logout; **nunca** chama `/auth/refresh`; fica em `signedOut`; refaz a limpeza local (idempotente, inclusive o escopo do último usuário, se sobrou) |
| Abertura com `signed-out` | — | **nenhuma** chamada (T-74) |
| Abertura sem marcador (navegador que nunca entrou, ou sessão anterior a esta versão) | grava `signed-in` ou `signed-out` pelo resultado | um `/auth/refresh`, como hoje |
| Login com `logout-pending` | `signed-in` | o servidor revoga a família do cookie antigo no próprio login (item 2 da API) |

- **Fechar a aba:** o marcador sobrevive (IndexedDB). Qualquer aba aberta depois, de qualquer rota, revoga antes de renovar. Se o navegador nunca mais abrir o app, a sessão vence no servidor no prazo normal (residual explícito; o *Background Sync* do Chromium foi considerado e descartado: só um motor, e o Service Worker hoje não existe).
- **Outras abas:** o `#doRefresh` lê o marcador antes de cada renovação (não só no `restore`): uma aba que estava aberta não renova com `logout-pending`. Um `BroadcastChannel('tms-session')` (só web, protegido por `typeof`) avisa as outras abas para saírem na hora, sem esperar o próximo 401.
- **Sem marcador = um refresh, como hoje.** É o que mantém logado quem já estava antes desta versão e o que o harness do E2E usa (cadastro pela API com cookie no contexto, `e2e/support/users.ts:5-8`). Custa um 401 na primeiríssima visita de um navegador sem sessão; depois dela o marcador é `signed-out` e o ruído some.

*Nativo (refresh no SecureStore).* A pendência guarda **o próprio refresh token**, numa chave separada do Keychain/Keystore, `tms.pendingLogout`, com as mesmas opções do token ativo (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, `tokenStore.native.ts:6-9`), nunca em claro nem no banco SQLCipher. O `TokenStore` ganha `pendingLogout: { read, write, clear }` (no-op no web).

| Evento | `tms.refreshToken` | `tms.pendingLogout` |
|---|---|---|
| "Sair" | apagado (depois de copiar) | recebe o token ativo, **antes** de apagar o outro |
| Logout 2xx | — | apagado |
| Falha de rede ou 5xx | — | fica; nova tentativa no `online` e na abertura |
| Abertura com pendência | se ainda existir (app morto no meio), é apagado **sem** renovar | enviado em `POST /auth/logout { refreshToken }` |
| Login com pendência | token novo | independente: enviado em segundo plano, não bloqueia o login |

O token pendente **só** vai para `/auth/logout`; um teste garante que ele nunca chega a `/auth/refresh`. Alternativa de menor privilégio (revogar pelo hash, com contrato novo) fica nas perguntas abertas.

**App: aviso de pendências (R-16 em parte).** "Sair" passa a usar um `LogoutButton` (`apps/frontend/components/session/LogoutButton.tsx`, novo), no padrão do `LeaveGuard` (`apps/frontend/sheet/evolve/LeaveGuard.tsx`):

- online, tenta `sync.flush()` com prazo curto antes de decidir;
- sobrando alterações no outbox (`useSyncStatus().pending`) ou rascunhos (ver P03-C abaixo), abre a folha "Sair e descartar?" com "N alterações ainda não foram enviadas e serão descartadas neste aparelho." e as ações "Continuar conectado" (secundária) e "Sair e descartar" (`danger`);
- sem pendência, sai direto, como hoje;
- o hook que lê a fila tolera a ausência do `SyncProvider` (devolve 0), para telas e testes que montam só a sessão (`apps/frontend/app/__tests__/chronicles.test.tsx:120-128`).

**Limpeza local e o ponto de extensão com o P03-C.**

- `Session.onSignOut` passa a aceitar ouvinte assíncrono, e `signOut()` espera todos (`Promise.allSettled`) antes de resolver. O `OfflineProvider` devolve a promessa do `userStorage.clear()`; o `SyncProvider` devolve a do `sync.reset()`; o `SessionProvider` registra também `purgeHttpCache()` (T-13).
- **Combinação com o P03-C:** o rascunho persistido da criação é gravado no storage **do usuário** (`useUserStorage()`, prefixo `u:<id>:`), com chave `draft:<characterId>`. Assim o logout o apaga sem código novo (o `clear()` do escopo apaga tudo do prefixo), e o `LogoutButton` conta os rascunhos com `userStorage.keys('draft:')`. A constante do prefixo fica no módulo do rascunho (P03-C); quem mergear por último liga a contagem. O teste de persistência do P02 já grava uma chave `draft:` falsa e confere que ela some no logout.

### 3.3 T-74 · Sem 404 nem 401 de ruído

**Transferência.** `GET /chronicles/:id/transfer` (`apps/api/src/chronicles/backstage.ts:638-678`) busca a última transferência em que o usuário é narrador **ou** destinatário e lança `notFound()` sem linha (`:665`). Não há checagem de acesso à crônica: inexistente, sem acesso e "sem transferência" dão o mesmo 404.

- Primeiro a checagem de acesso, como no `POST` da mesma rota (`:546-548`): `chronicleAccess` `null` ou `former` → 404 (mantém o "ex-membro responde como quem não tem vínculo" da matriz de AuthZ, `apps/api/src/test/authz-matrix.ts:47-53`, e não cria oráculo de existência).
- Membro ou narrador sem transferência visível para ele → **200 com `null`**. O filtro narrador-ou-destinatário continua: outro membro recebe `null`, nunca a transferência de outra pessoa.
- Com transferência, o objeto atual, igual.
- **Contrato e consumidores.** O corpo de `null` sai vazio no Elysia e vira `""` no Eden (§2). O `useTransfer` (`apps/frontend/lib/queries/backstage.ts:80-87`) normaliza: `data && typeof data === 'object' ? data : null`. Isso mantém o formato do objeto, e um app nativo já instalado continua funcionando (lê `"".available`, que é `undefined`, como "sem transferência"; com transferência recebe o mesmo objeto de hoje). Um envelope `{ transfer: … }` seria um JSON mais limpo, mas esconderia a transferência pendente dos apps antigos; fica nas perguntas abertas.

| Consumidor | Arquivo | Mudança |
|---|---|---|
| Rota | `apps/api/src/chronicles/backstage.ts:638-678` | checagem de acesso; `null` sem linha |
| Matriz de AuthZ | `apps/api/src/test/authz-matrix.ts:323-332` | `owner` 404 → 200 (membro que não é destinatário) |
| Testes da API | `apps/api/src/__tests__/backstage.test.ts:436` (continua), casos novos | ver §4 |
| Query | `apps/frontend/lib/queries/backstage.ts:80-87` | normalização; `retry: false` fica (agora só para erro de verdade) |
| Tela | `apps/frontend/components/chronicles/CampaignBackstage.tsx:81, 104-114, 408-430` | tipo `… \| null` no `TransferPanel`; a lógica já usa `?.` |
| Fake da API | `apps/frontend/test/fake-api.ts:38-40` | padrão `ok(null)` em vez de `fail(404)` |
| Testes da tela | `apps/frontend/components/chronicles/__tests__/CampaignBackstage.test.tsx:283, 309, 449, 479, 504` | inalterados (mandam o objeto); caso novo "sem transferência" |
| E2E | `e2e/tests/journey-backstage.spec.ts:437-448` | só usa `POST`; sem mudança |

**Refresh sem sessão.** No web, o `restore()` sempre chama `/auth/refresh` (`session.ts:109-115`; o atalho da `:110` é só do nativo). Com o marcador do §3.2, `signed-out` e `logout-pending` não chamam; sem marcador chama uma vez e grava o resultado. No nativo nada muda: sem token no SecureStore, o `restore()` já não chama a rede (`:110-113`).

### 3.4 T-86 · IP do cliente no rate limit

**Confirmado no código.**

- `clientIp` (`apps/api/src/http/security.ts:29-40`): sem `trustProxy`, o IP do socket por `server.requestIP(request)` (API do Bun, `node_modules/bun-types/serve.d.ts:1125-1137`, exposta pelo Elysia 1.4.30 no contexto como `server`); com `trustProxy`, o **último** item do `X-Forwarded-For` (`:36`). O último é o certo para **exatamente um** proxy confiável que acrescenta o IP de quem conectou nele; o primeiro é o que o cliente escreveu. Bem feito, e já testado (`apps/api/src/__tests__/auth-units.test.ts:78-97`).
- Usos: cadastro, login e refresh (`auth/routes.ts:99, 146, 184`), aceite de convite (`chronicles/routes.ts:528`) e exclusão de conta (`account/routes.ts:51`).
- O CORS libera `x-forwarded-for` quando `trustProxy` está ligado (`apps/api/src/index.ts:51-58`), porque o E2E simula clientes diferentes por esse header a partir do navegador (`e2e/support/users.ts:20`, `e2e/playwright.config.ts:37-38`): o `setExtraHTTPHeaders` do Playwright põe o header também nas chamadas da página, o que exige preflight.
- `TRUST_PROXY` já é validado como `'true' | 'false'` (`packages/config/src/env.ts:28-31`); o `.env.example` (l.12-13) já diz "só atrás de proxy".
- O CORS liberar o header não é o furo em si (um atacante com `curl` não passa por CORS); o furo é o `TRUST_PROXY` ligado sem proxy. Tirar do CORS é defesa em profundidade, e separar a simulação do E2E impede que a configuração de teste vire a de um ambiente exposto.

**O que muda.**

1. **Política explícita.** `clientIp(request, server, policy)` com `policy: { trustProxy: boolean; testClientIp: boolean }`. As chamadas passam `options` (o `AppOptions` satisfaz o formato), então cada uso muda de `options.trustProxy` para `options`.
   - `trustProxy`: último hop do `X-Forwarded-For`, **validado com `isIP`** (`node:net`, disponível no Bun). Hop vazio ou inválido cai no IP do socket. Atrás de proxy, isso junta clientes no IP do proxy, o que deixa o limite **mais estrito**, nunca mais frouxo. O valor recebido não é logado.
   - `testClientIp`: só para o E2E. Lê `x-tms-test-client-ip` (também validado com `isIP`). Os dois são mutuamente exclusivos.
2. **CORS sem `x-forwarded-for`, sempre.** O `allowedHeaders` (`index.ts:51-58`) libera `x-tms-test-client-ip` só com `testClientIp`.
3. **`env.ts`.** `TEST_CLIENT_IP: z.enum(['true','false']).default('false')` e, no `superRefine`, recusar `TEST_CLIENT_IP` com `NODE_ENV=production` e recusar `TEST_CLIENT_IP` junto com `TRUST_PROXY`. Na subida, o `server.ts` loga (sem valor de header) qual política está ativa, com aviso quando `TEST_CLIENT_IP` estiver ligado. O `TRUST_PROXY` continua como está.
4. **`AppOptions`** (`apps/api/src/options.ts:28-40, 107-108`): `testClientIp` ao lado de `trustProxy`.
5. **E2E:** `playwright.config.ts` troca `TRUST_PROXY: 'true'` por `TEST_CLIENT_IP: 'true'`; `users.ts` troca o header. Os limites do E2E continuam os padrões (o comentário de `users.ts:7-8` segue verdadeiro).
6. **`.env.example`:** só o comentário do `TRUST_PROXY` (P01-C cuida do resto do arquivo): "true só atrás de exatamente um proxy reverso que acrescenta o IP do cliente ao fim do X-Forwarded-For; sem proxy, false (o rate limit usa o IP da conexão)". O `TEST_CLIENT_IP` não entra no exemplo.
7. **Seed:** fica com o P01-C (S-04), que já planejou a API em processo, uma instância por conta, com os limites padrão e sem `X-Forwarded-For` ([P01-C §3.4](P01-C-build-setup.md)). O seed deixa de depender do `clientIp`; nenhuma mudança do P02 o quebra.

**Divisão com o P01-C (registrada como conflito no §8):** P02 é dono de `security.ts`, `index.ts` (CORS), `options.ts`, `env.ts`, `e2e/support/users.ts`, `e2e/playwright.config.ts` e do comentário do `TRUST_PROXY` no `.env.example`; P01-C é dono de `scripts/seed-roteiro.ts` e das linhas de `DATABASE_URL` e `JWT_SECRET` do `.env.example`.

### 3.5 T-47 · Datas sem fuso

**Todas as colunas `timestamp without time zone`** (as migrations a partir da 0007 já usam `timestamptz`):

| Coluna | Migration | Quem grava | Lida pela API? |
|---|---|---|---|
| `users.created_at` | `0002_users.ts:12` | default `now()` | não |
| `users.updated_at` | `0002_users.ts:13` | default `now()` | não |
| `users.deleted_at` | `0002_users.ts:14` | ninguém em produção (a conta é apagada de verdade, 0013); só testes | só `is null` |
| `game_systems.created_at` | `0003_game_systems.ts:12` | default `now()` | não |
| `chronicles.created_at` | `0004_chronicles.ts:16` | default `now()` | só ordena (`chronicles/routes.ts:241`) |
| `chronicles.updated_at` | `0004_chronicles.ts:17` | default; a API em `sheets/creation.ts:393`, `chronicles/backstage.ts:501, 724` | não |
| `characters.created_at` | `0005_characters.ts:18` | default `now()` | só ordena (`sheets/routes.ts:359`, `chronicles/table.ts:79`) |
| `characters.updated_at` | `0005_characters.ts:19` | default; a API em `sheets/events.ts:212` (lote), `sheets/creation.ts:302, 524` (a 524 é a prioridade gravada na hora), `sheets/status.ts:64`, `chronicles/operations.ts:192`, `rolls/routes.ts:163`, `chronicles/routes.ts:94`, `sheets/routes.ts:605` | **sim**: `updatedAt` em `sheets/routes.ts:414, 538` e na Mesa (`chronicles/table.ts:95`) |
| `characters.deleted_at` | `0005_characters.ts:20` | a API (`sheets/routes.ts:753-756`) | só `is null` (e o índice parcial `characters_chronicle_idx`, `0011_character_sync.ts:16`) |

**Causa, confirmada no código e no driver.**

- O default `now()` é `timestamptz`; gravado numa coluna sem fuso, vira a hora de parede do **fuso da sessão do Postgres** (o `TimeZone` do servidor; o `postgres` do compose e do CI é UTC).
- A API grava `Date` pelo `pg` 8.23.1, que serializa na hora **local do processo da API** com o deslocamento (`node_modules/pg/lib/utils.js:67-70, 95`). Numa coluna sem fuso, o Postgres **ignora** o deslocamento: fica a hora de parede do processo (12:54 em Brasília).
- Na leitura, o `pg-types` interpreta `timestamp` (OID 1114) como hora local do processo (`node_modules/pg-types/lib/textParsers.js:175`). A linha do default (UTC) volta 3 h no futuro; a do lote volta certa. É exatamente o 15:23 × 12:54 do PO web.
- Não é o fuso do navegador: é o do processo da API contra o da sessão do banco. O app já formata no fuso de quem vê (`apps/frontend/lib/format.ts:16-20`); não precisa mudar.
- **Por que os testes nunca pegaram:** o CI roda com processo e banco em UTC; e no PGLite o `Date` é serializado com `toISOString()` e lido como hora local (`node_modules/@electric-sql/pglite/dist/chunk-3WWIVTCY.js`, tipo `date`), então os dois caminhos gravam UTC e a mistura não acontece. Com o processo em outro fuso, o PGLite erra o instante de todas as linhas por igual. A regressão precisa dos dois testes do §4.

**Migration nova: `packages/db/src/migrations/0021_timestamptz.ts`** (próximo número livre; ver conflito com o P03-C no §8).

- **Classificação dos dados existentes.** As duas origens estão misturadas na mesma coluna e o banco não guarda qual escreveu cada valor. Dá para separar onde importa:
  - colunas **só de default** → interpretar no fuso da sessão do banco (`current_setting('TimeZone')`);
  - colunas **só da API** (`*.deleted_at`) → interpretar no fuso do processo que gravou;
  - **`updated_at` de `characters` e `chronicles`**: o `INSERT` grava `created_at` e `updated_at` com o mesmo `now()` (mesmo instante da transação, até o microssegundo). Linha com `updated_at = created_at` nunca foi tocada pela API → fuso do banco; senão → fuso do processo. Uma coincidência exata entre um valor da API e o default exigiria o mesmo microssegundo em relógios com 3 h de diferença.
  - O **fuso do processo** não está no banco. A migration lê `TMS_LEGACY_APP_TZ`; sem ela, usa o fuso do processo que roda a migration (`Intl.DateTimeFormat().resolvedOptions().timeZone`), que em dev é a mesma máquina da API e no CI é UTC. A migration loga os dois fusos usados (sem dado de usuário). Se o fuso do banco mudou no passado, não há como saber: fica registrado.
- **DDL não aceita parâmetro.** O fuso do processo é conferido numa consulta parametrizada em `pg_timezone_names`; só então entra como literal escapado (`sql.lit`). O fuso do banco entra como `current_setting('TimeZone')`, sem literal.

```ts
// packages/db/src/migrations/0021_timestamptz.ts (esboço)
import { type Kysely, sql } from 'kysely'

const DEFAULT_ONLY = [['users', 'created_at'], ['users', 'updated_at'],
  ['game_systems', 'created_at'], ['chronicles', 'created_at'],
  ['characters', 'created_at']] as const
const APP_ONLY = [['users', 'deleted_at'], ['characters', 'deleted_at']] as const
const MIXED = [['chronicles', 'updated_at'], ['characters', 'updated_at']] as const

const alter = (t: string, c: string, using: ReturnType<typeof sql>) =>
  sql`alter table ${sql.table(t)} alter column ${sql.ref(c)} type timestamptz using ${using}`

export async function up(db: Kysely<unknown>): Promise<void> {
  const appTz = process.env.TMS_LEGACY_APP_TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const { rows } = await sql<{ ok: boolean }>`
    select exists (select 1 from pg_timezone_names where name = ${appTz}) as ok`.execute(db)
  if (!rows[0]?.ok) throw new Error('TMS_LEGACY_APP_TZ não é um fuso do Postgres')
  const app = sql.lit(appTz)
  const dbTz = sql`current_setting('TimeZone')`
  // updated_at antes de created_at: a comparação usa created_at ainda sem fuso
  for (const [t, c] of MIXED)
    await alter(t, c, sql`case when ${sql.ref(c)} = created_at
      then ${sql.ref(c)} at time zone ${dbTz} else ${sql.ref(c)} at time zone ${app} end`).execute(db)
  for (const [t, c] of DEFAULT_ONLY) await alter(t, c, sql`${sql.ref(c)} at time zone ${dbTz}`).execute(db)
  for (const [t, c] of APP_ONLY) await alter(t, c, sql`${sql.ref(c)} at time zone ${app}`).execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Volta à hora de parede do fuso do banco, como o default gravava. Depois
  // do down, a API volta a gravar no fuso do processo: o bug volta junto.
  for (const [t, c] of [...MIXED, ...DEFAULT_ONLY, ...APP_ONLY])
    await sql`alter table ${sql.table(t)} alter column ${sql.ref(c)} type timestamp
      using ${sql.ref(c)} at time zone current_setting('TimeZone')`.execute(db)
}
```

- Defaults `now()` continuam válidos; nulabilidade e índices não mudam (o índice parcial em `deleted_at` é reconstruído pelo Postgres). Cada `ALTER … TYPE` reescreve a tabela com trava exclusiva: tabelas pequenas, mas a migration roda fora de horário de mesa.
- Depois da migration, `Date` gravado pelo `pg` leva o deslocamento e o Postgres o respeita; o `now()` grava o instante; a leitura (OID 1184) vem com fuso. A mistura acaba sem mexer em nenhuma rota.
- `packages/db/src/migrations.ts` registra a `0021` (o teste `migrations.test.ts:16-18` exige).
- **Fluxo do CLAUDE.md (não rodado agora):** criar o arquivo → `npx pnpm db:migrate` → `npx pnpm db:codegen` → `cd packages/db && npx pnpm build`. O `kysely-codegen` mapeia `timestamp` e `timestamptz` para o mesmo `Timestamp` (`packages/db/src/types.ts:25`), então o `types.ts` deve sair **sem diff**; o passo de drift do CI (`.github/workflows/ci.yml:149-152`) confirma.
- **Fora do escopo, registrado:** `sheets/routes.ts:605` e `:753` usam `new Date()` em vez de `options.now()` (o `sheetRoutes` não recebe `options`, `index.ts:77`). Não causa o bug; só impede relógio falso nos testes dessas duas rotas.

## 4. Testes

Um teste de regressão por bug, na camada onde o bug acontece. Os nomes seguem o estilo dos testes atuais.

| Item | Teste | Onde | Ferramenta |
|---|---|---|---|
| T-13 | **"toda resposta sai com no-store, inclusive erro, preflight e swagger"**: estende o `it.each` de `auth.test.ts:451-466` com `cache-control: no-store` e `pragma: no-cache`, e acrescenta `POST /auth/login` 200 (corpo com tokens), `POST /auth/refresh` 401, 400 de validação, 400 de *parse*, 429, 500 (o teste "erro interno", `:476`), `OPTIONS` 204 (preflight), `POST /auth/logout` 204 e `GET /swagger` 200 com swagger ligado. **É o teste do critério de saída da onda.** | `apps/api/src/__tests__/auth.test.ts` | Bun + PGLite (`useTestDb()`) |
| T-13 | "a API de verdade responde com no-store" (`/health` e um login errado no servidor Bun real, não no `app.handle`) | `e2e/tests/headers.spec.ts` | Playwright |
| T-13 | "no nativo, toda requisição pede no-store; no web, não" | `apps/frontend/lib/__tests__/session.test.ts` (e `createAuthFetch`, `:246`) | Jest |
| T-13 | "o módulo de cache HTTP existe para iOS e Android" (lê `modules/http-cache/expo-module.config.json`) e "sair purga o cache HTTP" (purga injetada) | `apps/frontend/sheet/sync/__tests__/nativeConfig.test.ts`, `session.test.ts` | Jest |
| T-13 | Inspeção do container depois do logout (QAA-02) | simulador iOS e emulador Android | manual (§7) |
| T-14 | "logout web apaga o cookie com Path=/auth, HttpOnly, SameSite=Strict e Max-Age=0" (amplia `:416-426`); "com secureCookies, o cookie apagado também é Secure"; "refresh recusado apaga o cookie com os mesmos atributos"; "login no web revoga a sessão do cookie anterior"; "login nativo não mexe em cookie" | `apps/api/src/__tests__/auth.test.ts` | Bun + PGLite |
| T-14 | Nativo: "logout sem rede guarda a revogação no keychain e apaga o refresh ativo"; "a revogação pendente vai quando a rede volta e some no 204"; "erro do servidor mantém a pendência"; "o token pendente nunca vai para /auth/refresh"; "app morto entre gravar a pendência e apagar o token: a abertura não renova" | `apps/frontend/lib/__tests__/session.test.ts` (+ `memoryStore` com pendência em `apps/frontend/test/session.tsx:25-39`) | Jest |
| T-14 | Web: "logout sem rede marca logout-pending e a abertura não chama /auth/refresh"; "ao voltar a rede, revoga e marca signed-out"; "outra aba sai junto (BroadcastChannel)" | `apps/frontend/lib/__tests__/session.test.ts` | Jest |
| T-14 | "o logout espera a limpeza do storage do usuário, inclusive chaves draft:" | `apps/frontend/lib/__tests__/persist.test.tsx` | Jest |
| T-14 | "sem pendência, sai direto"; "com pendência no outbox, avisa e só sai com Sair e descartar"; "Continuar conectado não sai" | `apps/frontend/components/session/__tests__/LogoutButton.test.tsx` (novo) | Jest + RNTL |
| T-14 | **QAW-33 automatizado:** "logout sem rede avisa da pendência, revoga quando a rede volta e o recarregar não entra sozinho"; variante "fechando a aba antes de a rede voltar" (página nova no mesmo contexto); o teste atual "logout apaga o que ficou no aparelho" (`offline.spec.ts:96-152`) passa a esperar só `session:state` = `signed-out` no IndexedDB | `e2e/tests/offline.spec.ts` | Playwright |
| T-14 | "sair apaga o cookie do refresh" (`context.cookies(API_URL + '/auth')` sem `tms_refresh` depois do "Sair") | `e2e/tests/auth.spec.ts:45-48` | Playwright |
| T-74 | "sem transferência: 200 com null para narrador e membro"; "membro que não é o destinatário recebe null, nunca a transferência de outro"; "ex-membro e estranho: 404" | `apps/api/src/__tests__/backstage.test.ts` | Bun + PGLite |
| T-74 | Matriz: `owner` 404 → 200 no `GET /transfer`, nos três sistemas | `apps/api/src/test/authz-matrix.ts:323-332` (roda em `authz.test.ts`) | Bun + PGLite |
| T-74 | "sem transferência não mostra erro nem aceite"; "corpo vazio ou null viram sem transferência" (normalização) | `CampaignBackstage.test.tsx`, teste da query | Jest |
| T-74 | "abrir a crônica não gera 4xx de /transfer" e "abrir / depois de sair não chama /auth/refresh" (`page.on('request')`/`'response'`) | `e2e/tests/chronicles.spec.ts`, `e2e/tests/auth.spec.ts` | Playwright |
| T-86 | `clientIp`: "último hop inválido cai no IP do socket"; "IPv6 no último hop"; "header de teste só com testClientIp"; "com trustProxy, o header de teste é ignorado" | `apps/api/src/__tests__/auth-units.test.ts:78-97` | Bun |
| T-86 | "o preflight nunca libera x-forwarded-for, nem com TRUST_PROXY"; "com TEST_CLIENT_IP, libera só o header de teste"; "sem proxy confiável, X-Forwarded-For forjado não escapa do limite de cadastro" (6 cadastros com XFF diferentes → o 6º é 429) | `apps/api/src/__tests__/auth.test.ts` | Bun + PGLite |
| T-86 | "TRUST_PROXY só aceita true ou false"; "TEST_CLIENT_IP é recusado em produção"; "TEST_CLIENT_IP e TRUST_PROXY juntos são recusados" | `packages/config/src/__tests__/env.test.ts:181-191` | Bun |
| T-47 | "0021: nenhuma coluna timestamp sem fuso no schema" (`information_schema.columns`) | `packages/db/src/__tests__/migrations.test.ts` | Bun + PGLite |
| T-47 | "0021 converte o default no fuso do banco e o que a API gravou no fuso do processo": `migrateTo('0020_product_templates')`, `set time zone 'UTC'`, linhas com texto literal (não `Date`, porque o PGLite serializa em UTC), `TMS_LEGACY_APP_TZ=America/Sao_Paulo`, `migrateToLatest`, instantes conferidos; depois `migrateDown` e tipos de volta | `packages/db/src/__tests__/migrations.test.ts` (padrão de `:577-629`) | Bun + PGLite |
| T-47 | Existente: "todo down desfaz o up" (`migrations.test.ts:563-575`) e `migrate:check` no CI | idem; job `postgres` | Bun; Postgres |
| T-47 | **"ficha recém-criada aparece na Mesa com a hora da criação, em qualquer fuso"** e "última alteração ordena certo entre ficha nova e editada", com `process.env.TZ = 'America/Sao_Paulo'` no `beforeAll` (restaurado no `afterAll`) e a sessão do PGLite em UTC | `apps/api/src/__tests__/timezone.test.ts` (novo) | Bun + PGLite |
| T-47 | Os mesmos dois casos com o driver `pg` (onde a mistura acontece), sessão `-c TimeZone=UTC` e processo em `America/Sao_Paulo` | `apps/api/src/__tests__/timestamps.pg.test.ts` (novo; entra no filtro `bun test .pg.test` do CI) | Postgres real |

O Bun aplica `process.env.TZ` em tempo de execução; se a versão de `.bun-version` (1.4.3) não aplicar, os dois arquivos de fuso rodam com `TZ=America/Sao_Paulo` no comando, documentado no próprio arquivo, sem mexer no `ci.yml` (que é do P01-C nesta onda).

**Suítes que precisam rodar** (no worktree do pacote, sem E2E nem build nativo, que são da integração da onda):

```bash
npx pnpm typecheck && npx pnpm lint
npx pnpm test:packages                       # @tms/config, @tms/db, @tms/api (Bun + PGLite)
npx pnpm test:ui                             # @tms/ui e frontend (Jest)
cd apps/api && PG_TEST_URL=postgres://postgres:postgres@localhost:5432/tms_p02_test bun test .pg.test
cd packages/db && DATABASE_URL=postgres://postgres:postgres@localhost:5432/tms_p02_test npx pnpm migrate:check
npx pnpm db:codegen && git diff --exit-code packages/db/src/types.ts
```

Na integração da onda: E2E em Chromium e WebKit (`npx pnpm build && npx pnpm -C e2e build:web`, depois `npx pnpm -C e2e test:e2e`) e o build nativo do D-00. O banco `_test` dos `*.pg.test` é próprio do worktree (matriz, "Recursos compartilhados").

## 5. Segurança

**Ameaças (o que pode dar errado) e como o desenho evita.**

| Ameaça | Como o desenho evita | Residual |
|---|---|---|
| Quem tem acesso ao armazenamento do aparelho lê tokens e dados ocultos no cache HTTP (MASVS-STORAGE-1/2; ASVS 8.2.1, 8.3.4) | `no-store` em toda resposta; cache em disco desligado e purgado no início e no logout (módulo local) | Respostas que o Bun gera antes do Elysia (413, HTTP malformado), sem dado; cache de imagens do RN (retratos); a "cache já visto" do `validacao-v5.md` continua para o cache de consultas persistido (cifrado no nativo, apagado no logout no web) |
| Sessão viva depois do logout offline; recarregar entra sozinho (ASVS 3.3.1) | Pendência gravada antes de limpar; nenhuma renovação com pendência; envio na reconexão e na abertura; login web revoga o cookie anterior | Navegador que nunca mais abre o app: a sessão vence no prazo do servidor (30/90 dias). Quem apaga o IndexedDB e mantém os cookies volta ao caminho "sem marcador" |
| Token pendente no aparelho usado para renovar | Chave separada, mesmo nível de proteção do token ativo (Keychain, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`); só o caminho do logout lê; teste garante que não vai a `/auth/refresh` | É um refresh token completo até o envio (pergunta aberta 6) |
| Marcador do web adulterado por script da origem | O marcador não tem segredo; trocá-lo só faz chamar ou não o refresh, que o servidor decide | Um XSS já teria acesso a muito mais; a CSP do web (`e2e/tests/headers.spec.ts`) é a defesa |
| CSRF no logout ou no login | `SameSite=Strict`, `path=/auth` e checagem de `Origin` (`auth/routes.ts:57-64`) continuam; a revogação no login usa o mesmo filtro de `Origin` | Logout forçado tem impacto baixo |
| Rate limit contornado com `X-Forwarded-For` forjado (força bruta em login, cadastro, convite, exclusão de conta) | Header só com `TRUST_PROXY`; hop validado; CORS nunca libera; a simulação do E2E tem flag própria, recusada em produção e junto do proxy | Topologia com mais de um proxy (pergunta aberta 4) |
| Chave falsa enche o limitador e expulsa janelas de outros (`rate-limit.ts:35-42`, teto de 10.000) | Sem IP forjável, a chave vem do socket ou do proxy | — |
| Ordem e hora erradas confundem o narrador sobre quem mexeu por último | `timestamptz` em todas as colunas; testes em fuso diferente de UTC nos dois drivers | Dados antigos classificados por heurística (§3.5) |
| A transferência de uma pessoa vaza para outro membro, ou a resposta vira oráculo de existência | Checagem de acesso antes (404 para sem vínculo e ex-membro); filtro narrador-ou-destinatário mantido; teste explícito de `null` para terceiro membro | — |
| Migration com o fuso vindo do ambiente injeta SQL | Fuso conferido em `pg_timezone_names` por consulta parametrizada antes de virar literal escapado | — |

**Checklist da organização: o que já está bem feito (reconhecer) e o que o P02 muda.**

- **JWT:** HS256 fixado na assinatura e na verificação (recusa `none` e outros), `exp` de 15 min, `iss`, `aud`, `typ` e `jti` obrigatórios, `sub` validado como UUID (`apps/api/src/auth/tokens.ts:14-49`); testes de algoritmo, issuer, audience e assinatura em `auth.test.ts`. Sem mudança.
- **AuthZ no servidor, nega por padrão:** guarda global com allowlist pública (`apps/api/src/auth/guard.ts:7-31`) e matriz de AuthZ nos três sistemas. O P02 só acrescenta a checagem de acesso no `GET /transfer`.
- **Refresh token:** opaco, 32 bytes, guardado como SHA-256, rotação a cada uso e revogação da família no reuso (`apps/api/src/auth/sessions.ts`). Cookie `httpOnly`, `SameSite=Strict`, `path=/auth`, `Secure` em produção, com checagem de `Origin`. O P02 completa os atributos na remoção.
- **Rate limit em autenticação:** login por IP e falhas por e-mail, cadastro, refresh, convite e exclusão de conta (`apps/api/src/options.ts:45-73`). Nenhum limite muda. O `POST /auth/logout` não tem limite; só revoga e não serve para força bruta (pergunta aberta 8).
- **CORS restritivo:** allowlist com credenciais; `"*"` recusado na configuração (`packages/config/src/env.ts:40-45`). O P02 tira o `x-forwarded-for`.
- **Cabeçalhos de segurança** (o equivalente ao helmet): CSP, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, CORP e `Permissions-Policy` (`security.ts:5-13`). O P02 acrescenta `Cache-Control` e `Pragma`.
- **Logs sem PII, senha ou token:** o log de acesso não registra header nem corpo (`apps/api/src/middlewares/loggerMiddleware.ts`); o teste "o log nunca tem senha, e-mail nem token" cobre. O P02 não loga o `X-Forwarded-For`, o fuso de ninguém além dos dois fusos da migration, nem o marcador.
- **Erros sem stack trace:** `on-error.ts` devolve mensagens genéricas; teste "erro interno sem stack trace". Sem mudança.
- **Segredos fora do código:** `JWT_SECRET` obrigatório em produção, vindo do Azure Key Vault ou do Google Secret Manager (`env.ts:20-22, 33-39`), e aleatório por processo em dev (`options.ts:75-86`). O `.env` é ignorado pelo git (conferido pelo P01-C). O P02 não adiciona segredo.
- **Dependências:** nenhum pacote novo (o módulo nativo é código do repositório sobre o `expo-modules-core` que já vem com o `expo`). O `pnpm audit --audit-level high` do CI continua valendo; rodar antes do merge.

## 6. Como generaliza além do WoD

Nada aqui depende de sistema, template ou regra de jogo. O cache HTTP, o logout, o rate limit e a transferência de narração valem igual para V20, M20, W20 e para um D&D ou Call of Cthulhu futuro. A migration mexe só em colunas de controle (`created_at`, `updated_at`, `deleted_at`) de `users`, `game_systems`, `chronicles` e `characters`; não toca `sheet_data`, `trait_templates` nem `template_data`, então adicionar um sistema continua sem exigir migration. O aviso de "Sair" conta alterações do outbox e rascunhos por quantidade, sem ler caminho de campo.

## 7. Critério de pronto

Os passos do "PR local" da matriz ([Como executar](../testes/2026-11-01/matriz-achados.md), l.67-73), aplicados ao P02:

1. **Plano aprovado:** este documento, com os arquivos conferidos no código (§3) e sem decisão de produto pendente (§2).
2. **Typecheck, lint e testes** dos pacotes afetados (`@tms/config`, `@tms/db`, `@tms/api`, `frontend`), os `*.pg.test` num banco `_test` próprio, `migrate:check` e o drift do `types.ts` (§4).
3. **Um teste de regressão por bug**, todos na tabela do §4, incluindo o de `cache-control` (critério de saída da onda).
4. **`/code-review` e `/security-review`** no diff do pacote; achados corrigidos ou registrados no resumo.
5. **Cenários das personas repetidos sem o defeito:**
   - **QAA-02 (T-13), iOS e Android:** entrar como narrador → criar NPC oculto, nota privada da sessão e rolagem oculta → Sair → fechar o app → inspecionar o container **só leitura, contando chaves, sem copiar valor**: no iOS, `Library/Caches/com.tms.app/Cache.db` sem resposta da API (nenhuma com a chave `refreshToken`, nenhuma de `/sessions`, `/rolls` ou `/characters`); no Android, `cache/http-cache` ausente ou vazio. Repetir com um app instalado **antes** da atualização, para provar a purga. Depende do build nativo do P01-C (D-00).
   - **QAW-33 (T-14), web 390:** ficha → offline → gastar 1 Sangue → ‹ → Sair: aparece "Sair e descartar?" com 1 alteração → "Sair e descartar" → login → voltar a rede → F5: continua no login; o `POST /auth/logout` chega ao servidor e o refresh com o cookie antigo dá 401. Repetir fechando a aba antes de a rede voltar. Logout online: o `tms_refresh` some do navegador (QAW, nota l.143).
   - **QAW-29 e POW-05 (T-47), web 390 e 1280:** criar uma ficha → Mesa do narrador: "alterada às" com a hora local da criação; editar outra ficha e ordenar por "Última alteração": a editada por último vem primeiro. Com a API em `America/Sao_Paulo` e o Postgres em UTC, como no teste das personas.
   - **QAW-41 e QAW-06 (T-74), web e iOS:** abrir uma crônica como jogador e como narrador: nenhum 404 de `/transfer` no console nem no `api.log`; abrir `/` depois de sair: nenhum `POST /auth/refresh`.
   - **QAA-32 (T-86):** ler `env.ts`, `security.ts`, `index.ts` e o `.env.example`: `TRUST_PROXY=false` por padrão e documentado; `TEST_CLIENT_IP` recusado com `NODE_ENV=production` (teste do config); preflight sem `x-forwarded-for` (teste da API). Nenhum teste de abuso contra ambiente compartilhado: o roteiro proíbe.
6. **Resumo** para a seção do P02 na descrição do PR da onda: o que mudou, como foi testado, achados das revisões e os residuais do §5.

## 8. Ordem dos commits, esforço, riscos e conflitos

**Commits** (no branch `pacote/p02-seguranca`; cada um com seus testes e verde sozinho):

| # | Commit | Itens |
|---|---|---|
| 1 | `fix(api): no-store e no-cache em toda resposta (T-13)` | T-13 |
| 2 | `fix(api): IP do cliente sem confiar no cliente; X-Forwarded-For fora do CORS (T-86)` (com o harness do E2E e o comentário do `.env.example`) | T-86 |
| 3 | `fix(api): logout apaga o cookie com os mesmos atributos; login revoga o cookie anterior (T-14)` | T-14 |
| 4 | `fix(api,app): sem transferência é 200 com null (T-74)` | T-74 |
| 5 | `fix(db): datas com fuso (timestamptz) e conversão dos dados (T-47)` | T-47 |
| 6 | `fix(app): logout com revogação pendente e sem refresh sem sessão (T-14, T-74)` | T-14, T-74 |
| 7 | `fix(app): aviso de alterações pendentes antes de sair (T-14)` | T-14 (R-16 em parte) |
| 8 | `fix(app): sem cache HTTP em disco no iOS e no Android (T-13)` | T-13 |
| 9 | `docs: checklist de segurança com cache, logout offline e IP do cliente` | T-13, T-14, T-86 |

**Esforço: G** (8 a 10 dias de uma pessoa). Por item: T-13 API P, T-13 nativo M (inclui a verificação em simulador e emulador); T-14 M; T-47 M; T-74 P; T-86 P. A matriz soma 3 P e 2 M porque não contava o módulo nativo; sem ele (pergunta aberta 3), o pacote cai para M.

**Riscos.**

- **Módulo nativo antes do app compilar:** o `main` não compila no nativo (T-01, P01-C). O commit 8 só é provado no aparelho e no CI depois do P01-C na onda. Mitigação: commits 1 a 7 e 9 não dependem dele; o 8 pode sair do pacote sem afetar os outros.
- **Heurística de conversão (T-47):** classifica errado se o fuso do processo que gravou não for o informado (ou o do processo da migration). Mitigação: `TMS_LEGACY_APP_TZ` explícito onde houver dado real, log dos dois fusos, teste da conversão. O `down` volta tudo para o fuso do banco e o bug volta com ele.
- **Trava das tabelas na migration:** `ALTER … TYPE` reescreve `users`, `game_systems`, `chronicles` e `characters` com trava exclusiva. Pequenas hoje; rodar fora de horário de uso.
- **Harness do E2E:** trocar o `X-Forwarded-For` pelo header de teste mexe em todos os specs (`signUp`). Mitigação: o commit 2 roda o E2E inteiro na integração; se um limite estourar, o sintoma é 429 claro.
- **Comportamento novo no "Sair":** quem sai com pendência passa a ver uma confirmação. É o que a T-14 pede; sem pendência nada muda.

**Conflitos com os outros pacotes da onda 1.**

| Arquivo ou recurso | P02 | Outro pacote | Proposta |
|---|---|---|---|
| `scripts/seed-roteiro.ts` | não toca | P01-C (S-04: API em processo, sem XFF) | Divisão do §3.4: seed é do P01-C; nenhuma mudança do P02 o quebra |
| `.env.example` | comentário do `TRUST_PROXY` (l.12-13 hoje) | P01-C (`DATABASE_URL`, `JWT_SECRET`, l.1-7) | Linhas diferentes; quem mergear depois resolve à mão, se o diff encostar |
| `packages/config/src/env.ts` | `TEST_CLIENT_IP` e validações | P01-C diz que não muda o `env.ts` (testa o `.env.example` em arquivo novo) | Sem conflito esperado |
| `e2e/support/users.ts`, `e2e/playwright.config.ts` | header de teste no lugar do XFF | P01-C cria `e2e/tests/template-unsupported.spec.ts`, que usa o `signUp` | Indireto: o spec novo herda a troca; integrar P01-C antes ou rodar o E2E inteiro depois dos dois |
| `.github/workflows/ci.yml` | **não toca** (o fuso dos testes fica nos arquivos) | P01-C (build nativo, D-00) | — |
| Build nativo | módulo local `modules/http-cache` | P01-C (T-01, D-00) | Integrar o P02 depois do P01-C; verificação no aparelho na integração |
| `packages/db/src/migrations/0021_*` e `packages/db/src/migrations.ts` | `0021_timestamptz` | P03-C, se o T-02 (idempotência da ficha e da crônica) criar tabela ou coluna | Quem mergear depois renumera para `0022` e acerta o registro; o teste "a lista registra todo arquivo" (`migrations.test.ts:16`) pega |
| `apps/api/src/chronicles/routes.ts` | l.528 (chamada do `clientIp`) | P03-C (T-02, `POST /chronicles`, por volta da l.158) | Trechos diferentes |
| `apps/frontend/lib/persist.tsx`, `apps/frontend/sheet/sync/SyncProvider.tsx` | logout espera a limpeza | P03-C (rascunho persistido; T-17 no indicador de salvamento) | Ponto de extensão do §3.2: rascunho em `useUserStorage()` com `draft:<characterId>`; quem mergear por último liga a contagem no aviso |
| `e2e/tests/offline.spec.ts` | logout offline; expectativa do IndexedDB | P03-C (provável E2E do rascunho) | Blocos de teste separados |
| `packages/ui/src/BottomSheet.tsx` | só usa (no `LogoutButton`) | P06 (T-71, diálogos) | Se o P06 mudar as props, ajustar o `LogoutButton` na integração |

**Ordem sugerida na integração da onda:** P01-C → **P02** → P03-C (o P03-C liga o rascunho no aviso de "Sair" e herda o logout que espera a limpeza). O P06 é independente.

**Arquivos tocados** (todos os que o plano altera ou cria):

| Arquivo | Itens | Tipo de mudança |
|---|---|---|
| `apps/api/src/http/security.ts` | T-13, T-86 | `cache-control` e `pragma` no `HEADERS`; `clientIp` com política e hop validado |
| `apps/api/src/index.ts` | T-86 | CORS sem `x-forwarded-for`; header de teste só com a flag |
| `apps/api/src/options.ts` | T-86 | `testClientIp` no `AppOptions` |
| `apps/api/src/server.ts` | T-86 | log da política de IP na subida |
| `apps/api/src/auth/routes.ts` | T-14, T-86 | helper do cookie (logout e refresh recusado); login e cadastro web revogam o cookie anterior; chamadas do `clientIp` |
| `apps/api/src/account/routes.ts` | T-14, T-86 | usa o helper do cookie; chamada do `clientIp` |
| `apps/api/src/chronicles/routes.ts` | T-86 | chamada do `clientIp` (l.528) |
| `apps/api/src/chronicles/backstage.ts` | T-74 | `GET /transfer`: checagem de acesso e 200 com `null` |
| `apps/api/src/test/authz-matrix.ts` | T-74 | `owner` 404 → 200 no `GET /transfer` |
| `apps/api/src/__tests__/auth.test.ts` | T-13, T-14, T-86 | testes |
| `apps/api/src/__tests__/auth-units.test.ts` | T-86 | testes do `clientIp` |
| `apps/api/src/__tests__/backstage.test.ts` | T-74 | testes |
| `apps/api/src/__tests__/timezone.test.ts` | T-47 | novo (PGLite, fuso ≠ UTC) |
| `apps/api/src/__tests__/timestamps.pg.test.ts` | T-47 | novo (Postgres real, driver `pg`) |
| `packages/config/src/env.ts` | T-86 | `TEST_CLIENT_IP` e validações |
| `packages/config/src/__tests__/env.test.ts` | T-86 | testes |
| `packages/db/src/migrations/0021_timestamptz.ts` | T-47 | novo |
| `packages/db/src/migrations.ts` | T-47 | registro da `0021` |
| `packages/db/src/types.ts` | T-47 | regenerado pelo codegen (esperado sem diff) |
| `packages/db/src/__tests__/migrations.test.ts` | T-47 | testes da conversão e do schema |
| `apps/frontend/lib/session/session.ts` | T-13, T-14, T-74 | revogação pendente, marcador, envio na reconexão, ouvintes assíncronos, `no-store` no nativo |
| `apps/frontend/lib/session/tokenStore.ts` | T-14 | interface `pendingLogout` (no-op no web) |
| `apps/frontend/lib/session/tokenStore.native.ts` | T-14 | `tms.pendingLogout` no SecureStore |
| `apps/frontend/lib/session/sessionMarker.ts` | T-14, T-74 | novo: marcador `session:state` sobre o `deviceStorage` |
| `apps/frontend/lib/session/index.ts` | T-14, T-74 | liga o marcador no web |
| `apps/frontend/lib/session/SessionProvider.tsx` | T-13, T-14 | envio na reconexão; `BroadcastChannel`; purga do cache HTTP no logout |
| `apps/frontend/lib/persist.tsx` | T-14 | o ouvinte do logout devolve a promessa da limpeza |
| `apps/frontend/sheet/sync/SyncProvider.tsx` | T-14 | `reset` aguardado no logout |
| `apps/frontend/lib/http.ts` (e `lib/noStore.native.ts`, `lib/noStore.ts`, novos) | T-13 | `cache-control: no-store` na requisição, só no nativo |
| `apps/frontend/components/session/LogoutButton.tsx` | T-14 | novo: aviso de pendências |
| `apps/frontend/app/(app)/index.tsx` | T-14 | "Sair" usa o `LogoutButton` |
| `apps/frontend/lib/queries/backstage.ts` | T-74 | normalização de `""`/`null` no `useTransfer` |
| `apps/frontend/components/chronicles/CampaignBackstage.tsx` | T-74 | tipo `… \| null` |
| `apps/frontend/modules/http-cache/` (`expo-module.config.json`, `index.ts`, `ios/*.swift`, podspec, `android/build.gradle`, `android/src/**/*.kt`) | T-13 | novo módulo local |
| `apps/frontend/test/session.tsx` | T-14 | `memoryStore` com pendência |
| `apps/frontend/test/fake-api.ts` | T-74 | padrão `ok(null)` |
| `apps/frontend/lib/__tests__/session.test.ts` | T-13, T-14, T-74 | testes |
| `apps/frontend/lib/__tests__/persist.test.tsx` | T-14 | teste |
| `apps/frontend/components/session/__tests__/LogoutButton.test.tsx` | T-14 | novo |
| `apps/frontend/components/chronicles/__tests__/CampaignBackstage.test.tsx` | T-74 | teste |
| `apps/frontend/app/__tests__/chronicles.test.tsx` | T-14 | "Sair" com o botão novo (l.120-128), se precisar de ajuste |
| `apps/frontend/sheet/sync/__tests__/nativeConfig.test.ts` | T-13 | o módulo existe para iOS e Android |
| `e2e/playwright.config.ts` | T-86 | `TEST_CLIENT_IP` no lugar de `TRUST_PROXY` |
| `e2e/support/users.ts` | T-86 | header de teste no lugar do XFF |
| `e2e/tests/headers.spec.ts` | T-13 | `no-store` no servidor real |
| `e2e/tests/auth.spec.ts` | T-14, T-74 | cookie some no logout; nenhum refresh sem sessão |
| `e2e/tests/offline.spec.ts` | T-14 | logout offline (QAW-33) e marcador que sobra |
| `e2e/tests/chronicles.spec.ts` | T-74 | sem 4xx de `/transfer` |
| `.env.example` | T-86 | só o comentário do `TRUST_PROXY` |
| `doc/checklist-seguranca-v0.md` | T-13, T-14, T-86 | controles e testes novos |

## 9. Perguntas abertas (técnicas)

1. **T-74, formato do "sem transferência":** manter o objeto e devolver `null` (200 com corpo vazio no Elysia; o app normaliza; compatível com apps instalados), como proposto, ou um envelope `{ transfer: … | null }` (JSON mais limpo, mas os apps antigos deixam de ver a transferência pendente)?
2. **T-14, web:** o marcador no IndexedDB (`session:state`, fora do escopo do usuário) muda a expectativa de "IndexedDB vazio depois do logout" para "só o marcador `signed-out`". Aceito, ou preferem `localStorage` (síncrono, com evento entre abas, mas contra a regra do `storage.web.ts` e do teste `session.test.ts:185`)?
3. **T-13, escopo:** o módulo nativo (purga e cache em disco desligado) entra nesta onda, dependendo do build do P01-C, ou vai para um pacote seguinte, deixando o `no-store` da API agora? Sem ele, o esforço cai de G para M, e os aparelhos já instalados continuam com o `Cache.db` antigo até a próxima versão.
4. **T-86, topologia de produção:** quantos proxies confiáveis ficam na frente da API? O último hop é o certo para exatamente um (e para o túnel do `scripts/tunel.sh`). Com CDN e balanceador, precisa de um `TRUST_PROXY_HOPS`; sem ele, o efeito é limite mais estrito (todos no IP da CDN), não mais frouxo.
5. **T-47, dados reais:** existe banco com dado que importa (produção ou homologação)? Em que fuso rodava o processo da API que gravou? Isso define o `TMS_LEGACY_APP_TZ` da migration; sem ele, vale o fuso de quem roda a migration.
6. **T-14, nativo:** a pendência guarda o refresh token inteiro no Keychain até o envio. A alternativa de menor privilégio é revogar pelo hash (o aparelho guarda só `sha256(token)`, que não renova nada), mas exige contrato novo em `/auth/logout`. Manter o simples?
7. **T-13, iOS:** além do `diskCapacity: 0`, vale configurar a sessão do RN com `URLSessionConfiguration.ephemeral` pelo `RCTSetCustomNSURLSessionConfigurationProvider`? É mais forte (nada de credencial ou cookie persistente), mas o app nativo hoje não usa cookie e o provedor exige ponte C no `AppDelegate`.
8. **T-14, `POST /auth/logout` sem rate limit:** manter (só revoga, idempotente, não serve para força bruta) ou aplicar o limite do refresh por coerência com o checklist?

## 10. Desvios na implementação

Registrados na implementação (branch `pacote/p02-seguranca`, commits 1 a 9 do §8, na ordem). Respostas às perguntas do §9 aplicadas como padrão da onda: 1 `null` com normalização; 2 marcador no IndexedDB; 3 o módulo nativo entra (commit 8); 4 um hop; 5 `TMS_LEGACY_APP_TZ` como no §3.5; 6 refresh inteiro no keychain; 7 só `diskCapacity: 0`; 8 sem rate limit no logout (revisto, item 2).

1. **T-47, nove colunas, não dez.** A tabela do §3.5 já lista nove (`users` 3, `game_systems` 1, `chronicles` 2, `characters` 3); o "10" do resumo (e do `onda-1.md`) estava errado. O teste confere a lista exata depois do `down`.
2. **Sem rate limit no `POST /auth/logout` (pergunta 8, revista).** O padrão da onda era aplicar o limite do refresh, num contador próprio, e o `728bd4e` fez o 429 apagar o cookie sem revogar. A revisão de código mostrou que isso quebra a garantia do T-14: no web, o reenvio vai sem cookie e a família do refresh nunca é revogada; e quem esgota o contador (outra pessoa atrás do mesmo NAT) segura a sessão viva no servidor. O logout só revoga com posse do token, de alta entropia: não serve para força bruta, e um 429 nele é falha aberta. Ficou como na base: sem limite, revogação sempre feita e cookie sempre apagado. Não afrouxa limite nenhum (a base não tinha limite no logout). Com `Origin` fora da allowlist e cookie, o logout continua 403 e não apaga o cookie (defesa de CSRF).
2a. **`TEST_CLIENT_IP` por allowlist (revisão de código).** Em vez de "recusado com `NODE_ENV=production`", o config só aceita a flag com `NODE_ENV=test`: um deploy que esquece o `NODE_ENV` cai em `development` e recusa. A API do E2E (`e2e/playwright.config.ts`) passa de `development` para `test`. Conferido no config, no `options.ts` e no logger: na API, `test` só deixa o log em silêncio (a saída do webServer já é ignorada pelo Playwright), tira o aviso do `JWT_SECRET` aleatório e não sai em config inválida (o ambiente do E2E é válido); swagger e cookie sem `Secure` são iguais aos de `development`. Nada perigoso: não precisou de variável dedicada.
3. **Fim da pendência (revisão de código).** No cliente, 2xx e qualquer 4xx encerram a revogação pendente (um 403 de `Origin` fora da allowlist não muda com outra tentativa); 5xx e falta de rede a mantêm. Sem laço: depois de um 4xx, nem o "online" nem a abertura chamam a rede de novo. O servidor mantém o 403 de `Origin` sem apagar o cookie (defesa de CSRF).
3a. **Lista de revogações no nativo (revisão de código).** Com uma posição só, o logout de B sem rede sobrescrevia a pendência de A. A chave `tms.pendingLogout` guarda uma lista (JSON, conferida na leitura) de até `MAX_PENDING_LOGOUTS` = 5; passando disso, a mais antiga sai e vence no servidor no prazo normal. O envio manda todas e tira cada uma só no 2xx ou no 4xx. A lista é lida do keychain uma vez e fica em memória, com as mudanças em fila: a renovação não lê mais o keychain a cada refresh.
3b. **Marcador com o id da sessão (revisão de código).** `signed-in:<id>`, um id por login (aleatório, sem segredo); a renovação mantém o do marcador. O 401 de uma renovação só grava `signed-out` se o marcador ainda for o que ela viu ao sair (compare-and-set): uma aba velha não derruba a sessão nova que outra aba abriu. A gravação no IndexedDB não é atômica entre abas; a janela é a de uma leitura.
3c. **Aviso entre abas com o usuário (revisão de código).** A mensagem do `BroadcastChannel` leva o id de quem saiu, e a aba só sai se a sessão dela for desse usuário.
4. **`DELETE /me` no nativo.** Com o helper `clearRefreshCookie`, a remoção do cookie sai só para o web, como no logout. Antes, o `DELETE /me` mandava a remoção também ao nativo, que não usa cookie.
5. **Limpeza do que sobrou de um logout interrompido.** Implementada como dependência da sessão (`purgeUserData`, ligada ao `scopeStorage(deviceStorage, id).clear()`), pelo id do último usuário. Roda só quando não havia sessão aberta para ele: com a sessão aberta, o `OfflineProvider` já apaga.
6. **Login nativo com pendência.** A revogação antiga vai em segundo plano depois do login e também na abertura, quando há outra sessão ativa (token pendente diferente do ativo). Token pendente igual ao ativo é o caso do app morto no meio: a abertura revoga sem renovar.
7. **Hook tolerante da fila.** `useOptionalSync()` novo em `SyncProvider.tsx`. O `LogoutButton` conta só o outbox; a contagem de rascunhos (`draft:`) é ligada pelo P03-C, como no acordo 4.2 do `onda-1.md`.
8. **Onde ficaram os testes.** Os do logout no app estão em `apps/frontend/lib/__tests__/logout.test.ts` (novo), e os do T-13 no app em `apps/frontend/lib/__tests__/httpCache.test.tsx` (novo), em vez de `session.test.ts` e `nativeConfig.test.ts`. O `app/__tests__/_layout.test.tsx` ganhou o `pendingLogout` do `TokenStore` (campo obrigatório).
9. **Fuso no Postgres real.** O `timestamps.pg.test.ts` espera 1,5 s entre a ficha nova e a edição: o relógio da VM do Docker Desktop anda centenas de ms à frente do host, e o default `now()` vem do banco. No CI (Linux) não há essa diferença.
10. **Módulo nativo (T-13).** O iOS usa o `didFinishLaunchingWithOptions` do assinante (não o `subscriberDidRegister`) e um `URLCache` sem capacidade em memória e em disco. O nome nativo é `TmsHttpCache`. O OkHttp vem do `react-android`, sem versão própria. O autolinking resolve o pod, o módulo e o `HttpCachePackage`; o Swift e o Kotlin só compilam no build nativo da integração.
11. **Não rodado neste pacote (integração da onda):** os E2E escritos (`headers.spec.ts`, `auth.spec.ts`, `offline.spec.ts` com o QAW-33, `chronicles.spec.ts`), o build nativo e a inspeção do QAA-02 no simulador e no emulador.
12. **Fuso da `0021` sem `TMS_LEGACY_APP_TZ` (revisão de código): mantido o padrão.** No deploy, a migration roda no mesmo container da API, logo antes de subi-la (`deploy/render/start.sh`), com o mesmo fuso (o `Dockerfile` não define `TZ`: UTC). No dev, roda na mesma máquina da API (`scripts/backend.sh`). O repositório não tem outro deploy (o Render é a mesa de teste). Nos dois casos, o fuso do processo da migration é o da API que gravou os dados. Quem rodar a migration fora da máquina ou do container da API que gravou os dados define `TMS_LEGACY_APP_TZ`. O comentário da migration com esse detalhe fica para o rebase sobre a onda (ver item 14).
13. **Template sem `no-store` (revisão de código): mantido.** A rota da versão publicada já responde `private, max-age=31536000, immutable` (o cabeçalho da rota prevalece sobre o do `onRequest`; `characters.test.ts` confere o `immutable`, e o valor exato fica para o rebase, item 14), e o template não tem dado de usuário. No nativo, a requisição pede `no-store`, mas o app não baixa a versão de novo: a consulta do template tem `staleTime` e `gcTime` infinitos e vai para o cache persistido (cifrado), restaurado sem invalidar. Só depois do logout (cache apagado) a versão é baixada uma vez.
14. **Hook de pre-commit no worktree depois do P01-C.** Com o P01-C na onda, os `node_modules` do checkout principal ganharam `@types/react-test-renderer`, e o worktree deste pacote (aninhado no checkout principal) passou a resolver esses tipos de lá: o typecheck do frontend falha em `sheet/views/__tests__/matrix.test.tsx`, que o P01-C já corrigiu na onda. Nenhuma mudança de código do P02 causa isso. Ficaram para o rebase sobre a onda, sem efeito em comportamento: o comentário da `0021` sobre onde a migration roda e a asserção exata do `cache-control` do template em `characters.test.ts`.

