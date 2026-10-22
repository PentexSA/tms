# Checklist de segurança da v0

Etapa 22 de [`plano-v0.md`](plano-v0.md). Cada ameaça do §9 de [`arquitetura-motor-de-ficha.md`](arquitetura-motor-de-ficha.md) e cada controle que o plano acrescentou aponta para o teste que o prova. Baseline: OWASP ASVS nível 2 e OWASP MASVS.

Os testes rodam no CI:

| Job | O que roda |
|---|---|
| `check` | Bun e Jest, com metas de cobertura |
| `postgres` | migrations, drift do Kysely e concorrência real |
| `e2e` | Playwright, Chromium e WebKit, sob a CSP de produção |
| `audit` | `pnpm audit` |

**Legenda.** `core` é `packages/sheet-core/src/__tests__`, `api` é `apps/api/src`, `app` é `apps/frontend` e `e2e` é `e2e/tests`.

## Ameaças do §9 da arquitetura

### Template malicioso vira código (RCE no servidor, XSS no web)

- **Defesa:** o template é dado, com listas fechadas e sem `eval`. A publicação passa por `schema.json` (Ajv) e pelo contrato, só no servidor.
- **Testes:**
  - `api/templates/__tests__/publish.test.ts`:
    - "o schema roda antes do contrato e nada é gravado";
    - "o contrato pega o que o schema não expressa";
    - "a mesma versão com outro conteúdo é recusada".
  - `core/validate-template.test.ts`:
    - "nunca lança exceção, mesmo com valores de tipos trocados";
    - nomes de `Object.prototype`.
  - `scripts/check-bundle.mjs`, no CI: o Ajv e qualquer módulo de servidor fora do bundle do app.
  - `app/sheet/__tests__/SheetView.test.tsx`: "nenhum eval / new Function em sheet/".
  - `e2e/headers.spec.ts`: `script-src 'self'`, sem `unsafe-eval`.

### Texto do template ou da ficha injeta HTML

- **Defesa:** todo texto vai em `<Text>`, e o texto seguro é validado.
- **Testes:**
  - `app/sheet/__tests__/SheetView.test.tsx`: "nenhum dangerouslySetInnerHTML" e "nenhum WebView" em `sheet/`.
  - biome: `noDangerouslySetInnerHtml` como erro.
  - `core/validate-template.test.ts` e `core/parity.test.ts`: texto seguro.

### Estilo injetado

- **Defesa:** cor só por `accent-N`; número que vira estilo tem faixa.
- **Testes:**
  - `core/validate-template.test.ts` (accent);
  - `ui/src/theme.test.tsx`.

### Prototype pollution

- **Defesa:** `Object.hasOwn`, allowlist de chaves e ids proibidos.
- **Testes:**
  - `api/__tests__/events.test.ts`: "`__proto__`: 422";
  - `api/__tests__/characters.test.ts`: "`__proto__` nos valores";
  - `core/validate-sheet.test.ts` e `core/permissions.test.ts`;
  - `app/sheet/sync/__tests__/persistedOutbox.test.ts`.

### Jogador edita a ficha de outro (IDOR)

- **Defesa:** AuthZ por crônica em toda rota, com papel resolvido no banco; sem vínculo, 404.
- **Testes:**
  - `api/__tests__/authz.test.ts`:
    - a matriz de todas as rotas × papéis;
    - "toda rota protegida tem linha na matriz";
    - "id malformado é recusado antes do banco".
  - `api/rolls/__tests__/rolls.test.ts` (IDOR).
  - `api/__tests__/table.test.ts`.

### Jogador lê as Notas do Narrador

- **Defesa:** o servidor remove as seções restritas em toda saída.
- **Testes:**
  - `api/__tests__/events.test.ts`:
    - "from velho é 409 … sem vazar";
    - "o jogador não vê as alterações das Notas do Narrador".
  - `api/__tests__/table.test.ts`.
  - `app/sheet/__tests__/SheetView.test.tsx`: "o jogador não vê a seção do narrador".
  - `e2e/journey.spec.ts`, passo 8: a resposta da API à jogadora não traz o texto.

### Cliente adulterado manda valor fora da regra

- **Defesa:** o servidor revalida cada lote com o mesmo core.
- **Testes:**
  - `api/__tests__/events.test.ts`: "lote com um evento inválido não grava nada", campo derivado e caminho fundo;
  - `api/rolls/__tests__/rolls.test.ts`: a API ignora o resultado vindo do cliente;
  - `app/sheet/store/__tests__/sheetStore.test.ts`: "lote inválido nem sai do aparelho".

### Reenvio duplicado da fila offline

- **Defesa:** idempotência por `(ficha, lote)`.
- **Testes:**
  - `api/__tests__/events.test.ts`: "o mesmo lote reenviado … uma vez só";
  - `api/__tests__/events.pg.test.ts`: "o mesmo lote em paralelo";
  - `app/sheet/sync/__tests__/offline.test.ts`: a conexão cai entre o commit e o ack;
  - `api/rolls/__tests__/rolls.test.ts`: `clientRollId`.

### Abuso do endpoint de eventos

- **Defesa:** rate limit por usuário e por ficha; limite de corpo e de eventos.
- **Testes:**
  - `api/__tests__/events.test.ts`: "rate limit por usuário e por ficha" e "limites: lote vazio, 51 eventos e corpo acima de 64 KB";
  - `app/sheet/sync/__tests__/outbox.test.ts`: os mesmos limites no aparelho.

### Dado adulterado no aparelho

- **Defesa:** a reidratação passa por `compileTemplate` e pelo validador; o que falha é descartado.
- **Testes:**
  - `app/lib/__tests__/persist.test.tsx`: "template adulterado some", "hash adulterado é recalculado" e "cache adulterado ou de outra versão";
  - `app/sheet/sync/__tests__/persistedOutbox.test.ts`;
  - `app/lib/__tests__/session-offline.test.ts`: último usuário adulterado.

### Vazamento por log

- **Defesa:** log com ids e números, nunca texto, tokens ou PII.
- **Testes:**
  - `api/__tests__/events.test.ts`: "o log nunca tem o texto escrito";
  - `api/__tests__/logger-middleware.test.ts`: o nome da classe, nunca a mensagem;
  - `app/sheet/sync/__tests__/encryptedStorage.test.ts`: a chave nunca em log.

### Dependência vulnerável

- **Defesa:** `pnpm audit --audit-level high` no CI, com `minimumReleaseAge` de 14 dias e versões exatas.
- **Testes:** job `check` do CI. Os ignorados têm a justificativa em `pnpm-workspace.yaml`.

## Controles que o plano acrescentou

### Sessão e tokens (ASVS V3)

- **Defesa:**
  - JWT HS256 fixo, com `exp`, `iss` e `aud`, de 15 minutos;
  - refresh opaco, com rotação e revogação da família no reuso;
  - no web, cookie HttpOnly e SameSite=Strict;
  - no nativo, SecureStore.
- **Testes:**
  - `api/__tests__/auth.test.ts`:
    - "web: refresh só no cookie HttpOnly, SameSite=Strict e em /auth";
    - reuso do refresh revoga a família;
    - algoritmo e audience;
    - "10 falhas no mesmo e-mail bloqueiam".
  - `app/lib/__tests__/session.test.ts`: "login guarda só o refresh token" e "sair com um refresh em voo é definitivo".
  - `e2e/auth.spec.ts`.

### Sessão offline com prazo

- **Defesa:** o último usuário guarda só id e nome e vale pelo mesmo prazo do cache (7 dias); vencido, o app pede login.
- **Testes:** `app/lib/__tests__/session-offline.test.ts`: "vale pelo mesmo prazo do cache".

### CORS, cabeçalhos e erros (ASVS V14)

- **Defesa:**
  - CORS por allowlist;
  - cabeçalhos de segurança no `onRequest`;
  - erro genérico, sem stack.
- **Testes:**
  - `api/__tests__/api.test.ts`;
  - `api/__tests__/auth.test.ts` (origin).

### CSP do web

- **Defesa:**
  - `script-src 'self'`, `object-src 'none'` e `frame-ancestors 'none'`;
  - nosniff, no-referrer, HSTS e COOP;
  - tudo numa fonte só (`scripts/web-headers.mjs` gera `dist/_headers`).
- **Testes:** `e2e/headers.spec.ts`. Todos os specs E2E rodam sob essa CSP.

### Armazenamento no aparelho (MASVS-STORAGE)

- **Defesa:**
  - tudo separado por usuário e apagado no logout;
  - no nativo, SQLCipher com chave aleatória na SecureStore;
  - chave ausente ou errada apaga o banco (fail secure);
  - `allowBackup: false`.
- **Testes:**
  - `app/lib/__tests__/persist.test.tsx`: "o usuário B nunca vê o cache de A" e "o logout apaga";
  - `app/sheet/sync/__tests__/encryptedStorage.test.ts`;
  - `app/sheet/sync/__tests__/nativeConfig.test.ts`: SQLCipher, `allowBackup`, sem cleartext nem ATS aberto;
  - `e2e/offline.spec.ts`: "logout apaga o que ficou no aparelho".

### Concorrência na escrita (ASVS V11)

- **Defesa:** `SELECT … FOR UPDATE` na ficha.
- **Testes:**
  - `api/__tests__/events.pg.test.ts`;
  - `api/rolls/__tests__/rolls.pg.test.ts`.
  
  Ambos rodam em Postgres real, e sem a trava os dois falham.

### RNG das rolagens (ASVS V6)

- **Defesa:** CSPRNG no servidor (`crypto`) e amostragem por rejeição, sem viés.
- **Testes:**
  - `core` (random e pool-success): amostragem por rejeição com valores no limite do intervalo;
  - `api/rolls/__tests__/rolls.test.ts`.

### Exclusão de conta (LGPD art. 18, VI)

- **Defesa:** `DELETE /me` pede a senha de novo e tem rate limit por usuário e por IP. Numa transação:
  - apaga a conta e o que é só dela (fichas, histórico delas, membros, convites e sessões);
  - anonimiza o que ela fez em fichas de outras pessoas ("Conta excluída");
  - recusa (409) se apagaria dado de outra pessoa sem confirmação.
  - O banco recusa se algo escapar (`chronicles.storyteller_id` sem cascata).
  - O app apaga cache, fila e último usuário do aparelho.
- **Testes:**
  - `api/__tests__/account.test.ts`:
    - senha errada 401;
    - 429;
    - o que sai e o que fica anônimo;
    - 409 com crônica de outros;
    - login e refresh depois falham;
    - log sem e-mail.
  - `api/__tests__/authz.test.ts`: `DELETE /chronicles/:id` na matriz.
  - `db/__tests__/migrations.test.ts`: `0013` sobe e desce.
  - `app/app/__tests__/account.test.tsx`.
  - `e2e/account.spec.ts`: senha errada não exclui; com a senha, a conta não entra mais.

## Sistemas novos (v1 Mago, v2 Lobisomem)

Um sistema novo é dado: nenhuma rota, migration ou dependência nova. Revisto item a item para o Lobisomem (plano-v2, Etapa 7):

- **Template malicioso:** o `wta-w20` passa pelas duas camadas e pelo Ajv antes de publicar; `glyph` e `emblem` são listas fechadas (`REGISTRY.glyphs`, `REGISTRY.emblems`), e um nome fora delas não desenha nada no app.
- **Texto injetado:** rótulos, hints e notas das formas são texto do template, renderizados por `<Text>`, com o padrão de texto seguro.
- **IDOR e Notas do Narrador:** `api/__tests__/werewolf.test.ts`: o outro jogador não troca a forma de quem não é dele (403), e as Notas do Narrador nunca chegam ao jogador.
- **Cliente adulterado:** o servidor confere o id da opção e os limites da Fúria (422), não o custo da troca. A troca sem gastar Fúria é legal pelas regras (a mudança lenta), como o `wod-stacking` e a roda do Mago: um cliente adulterado só grava uma forma válida, na ficha que já pode editar.
- **Nome de sistema no código:** `scripts/check-system-names.mjs` (CI) recusa também os ids das opções de `state` (`'crinos'`) no app, no `@tms/ui` e na API.

## Revisão da v3: Mesa administrável

- **Oito rotas novas:** `POST /characters/:id/creation/complete`, `POST /characters/:id/status`, `POST` e `DELETE /characters/:id/lock`, `DELETE /chronicles/:id/members/:userId`, `DELETE /chronicles/:id/members/me`, `POST /chronicles/:id/operations/preview` e `POST /chronicles/:id/operations`. A matriz `apps/api/src/__tests__/authz.test.ts` prova cada papel nos três sistemas. Remover exige narrador; sair exige o próprio membro; ações da ficha e operações exigem narrador.
- **Ficha alheia:** outro membro recebe 404 na ficha, no histórico e nas rolagens. A lista e a contagem incluem só fichas próprias. A matriz confere o corpo, inclusive as Notas do Narrador ocultas ao dono. O teste `journey-storyteller.spec.ts` repete a leitura do outro jogador em cada fase.
- **Ex-membro (`former`):** vê só as próprias fichas, sem lista de membros ou convites. Remoção arquiva as fichas e revoga os convites por padrão. Escrita e rolagem recebem `NOT_MEMBER`, inclusive em uma página aberta antes de remover (`members.test.ts`, `policy.test.ts` e jornada do narrador).
- **Estado e escrita concorrentes:** estado, trava e vínculo são lidos depois do `FOR UPDATE` da ficha. A criação trava o vínculo antes de contar e criar; remoção trava vínculo e depois fichas em ordem de id. `policy.pg.test.ts` e `members.pg.test.ts` exercitam as corridas no Postgres real.
- **Operações:** todas as fichas travadas em ordem de id; chave única por crônica, conferida depois das travas. Versão vencida, alvo duplicado e alvo de outra crônica recusam a operação inteira. Reversão verifica cada valor atual; texto não é reversível; lote ou operação já desfeito não é reaplicado pela reversão. `operations.test.ts` e `operations.pg.test.ts` cobrem atomicidade, idempotência, IDOR e concorrência.
- **Registros:** `chronicle_audit` guarda ação, alvo e payload mínimo; `chronicle_operations` liga os lotes sem duplicar conteúdo. Autores excluídos ficam nulos. Não há rota de leitura consolidada da auditoria nesta versão. Texto e especializações continuam sem conteúdo no histórico.
- **Cliente e templates:** `alerts` usa regras da lista fechada, validadas nas duas camadas; um alerta nunca revela campo sem permissão. A política do app orienta os controles; o servidor revalida cada escrita. Operações de várias fichas não entram na fila offline. `recoveries` fica na v3.1 e ainda não é aceito pelo contrato.

## Fora da v0, conhecido

- Tempo real e notificações. Ver §8 do plano.
- O que só um dev build prova:
  - o SQLCipher ativo no binário;
  - os fluxos do Maestro;
  - o arquivo cifrado em disco.
  
  O roteiro de verificação está em `apps/frontend/.maestro/README.md` e no §7.2 da arquitetura.
- Exportação de criptografia na App Store (`ITSAppUsesNonExemptEncryption`), antes da publicação.
