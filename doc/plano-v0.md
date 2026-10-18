# Plano de implementação da v0: ficha de Vampiro

> Plano · 2026-10-18 · base: `main` em `112782f` (PR #24, `@tms/sheet-core`, já mergeado)

Este plano leva o motor de ficha do estado atual até uma **ficha de Vampiro: A Máscara (V20) utilizável**: criada, montada, vista, jogada e editada, no app (iOS e Android) e no web.

| Documento | Responde |
|---|---|
| [`arquitetura-motor-de-ficha.md`](arquitetura-motor-de-ficha.md) | **Por que** e **como** o motor funciona |
| [`../design/templates/README.md`](../design/templates/README.md) | **O que** o template pode dizer |
| este documento | **Em que ordem** construir, e **como provar** que cada passo funciona |

Como usar:

- Cada etapa é um PR. As de tamanho G podem virar dois.
- Uma etapa só termina com os testes dela verdes no CI.
- Quando uma etapa muda uma decisão da arquitetura, o PR atualiza o documento de arquitetura junto.

---

## 1. Onde queremos chegar

A v0 está pronta quando esta jornada roda inteira no app e no web, e um teste E2E a repete no CI:

1. Criar conta e entrar.
2. O narrador cria uma crônica de Vampiro (V20) e gera um código de convite.
3. O jogador entra na crônica com o código.
4. O jogador cria a ficha: nome, conceito, clã, geração, senhor, natureza e comportamento. O formulário sai do template, não de uma tela escrita para o Vampiro.
5. A ficha abre em **Evoluir**: atributos, habilidades, disciplinas, antecedentes, especializações e Força de Vontade. Salvar grava **um** lote.
6. A ficha abre em **Leitura** e **Jogo**: identidade, 3 abas (Ficha · Vantagens · Sobre) e dock (Vitalidade, Sangue, FdV).
7. Em jogo, o jogador gasta Sangue, leva dano letal, cura com Sangue, desperta e desfaz. Tudo funciona offline e sincroniza ao reconectar.
8. O narrador vê a mesa e edita a ficha do jogador, com a alteração assinada no histórico. Ele escreve as Notas do Narrador, que o aparelho do jogador nunca recebe.
9. O jogador rola a parada: Atributo + Habilidade, dificuldade, penalidade, especialização e FdV. **Este passo é a linha de corte** (Etapa 21).

O que fica fora está no §8.

---

## Estado da v0 (18/10/2026)

As 22 etapas estão implementadas, em branches empilhadas (`v0/NN-nome`, cada uma sobre a anterior). A jornada do §1 roda inteira no `e2e/tests/journey.spec.ts`, no Chromium e no WebKit, sob a CSP de produção.

| Etapas | Branch (topo) |
|---|---|
| 15 Eventos e histórico | `v0/15-events-api` |
| 16 Store, fila e Desfazer | `v0/16-sheet-store` |
| 17 Modo Jogo | `v0/17-play-mode` |
| 18 Modo Evoluir | `v0/18-evolve-mode` |
| 19 Mesa e histórico | `v0/19-storyteller-table` |
| 20 Offline persistente | `v0/20-offline` |
| 21 Parada de dados | `v0/21-dice` |
| 22 Fechamento | `v0/22-closing` |

As Etapas 17 a 22 foram feitas em paralelo, em worktrees, e integradas na ordem. A integração e os E2E acharam defeitos que os testes de unidade não pegavam, todos corrigidos com teste:

- **"De" efetivo.** Um recurso no padrão aparecia como "Sangue — → 9" no aviso, na prévia e no histórico. Agora é o `withEffectiveFrom` do core.
- **Rede no Eden.** O Eden devolve status 503 em erro de rede, e cair a rede parecia erro do servidor. Agora é o `isNetworkError`.
- **NetInfo no web.** No Chromium ele não percebe a queda da rede; no web vale o `onlineManager` do TanStack.
- **Cache persistido.** Um refetch que falhava offline apagava a ficha do disco. Agora vai o último dado bom, a ficha restaurada fica marcada como velha, e um erro com dados não troca a tela.
- **Sessão offline.** Abria sem prazo; agora vale o mesmo prazo do cache (fail secure).
- **Cache do turbo.** Os inputs ignoravam `lib/` e `sheet/` do app; agora é `$TURBO_DEFAULT$`.
- **`?mode=evolve`.** Valia de novo a cada recarga; agora só na chegada.

Fora do código, ainda falta:

- o que só um dev build prova (SQLCipher ativo, fluxos do Maestro);
- o identificador definitivo do app (hoje `com.tms.app`);
- a declaração de criptografia da App Store.

O checklist de segurança, item por item, está em [`checklist-seguranca-v0.md`](checklist-seguranca-v0.md).

## 2. Ponto de partida

| Área | Hoje, na `main` | O que falta para a v0 |
|---|---|---|
| Core | `@tms/sheet-core`: listas fechadas, derivações, `validateTemplate` e `validateSheet` (181 testes) | tipos do contrato, `compileTemplate`, `resolve`, `short`/`describe`, eventos, permissões, regras, efeitos e rolagem |
| API | Elysia com `/health` e `/todos`; `cors()` aceita qualquer origem; `/swagger` sempre ligado | autenticação, AuthZ, crônicas, convites, fichas, eventos, histórico e rolagem |
| Banco | 6 migrations: `users`, `game_systems`, `chronicles`, `characters` e `trait_templates` | versão do template, membros e convites, refresh tokens, lotes e eventos |
| App | tela de todos com TanStack Query e Eden | login, crônicas e ficha (renderizador, store, fila, modos) |
| `@tms/ui` | `Button` e `Screen`, com `peerDependencies` em React 18 e RN 0.76 (o app usa 19 e 0.81) | `tokens.ts`, tema e cerca de 20 primitivos |
| Qualidade | hooks do husky (lint-staged e typecheck no commit, testes no push); **sem CI** | CI, Postgres real, E2E e auditoria |

Problemas encontrados na leitura do código, corrigidos no caminho:

| Onde | Problema | Etapa |
|---|---|---|
| `packages/db/src/test/pglite.ts` | Engole o erro de migration ("skipped or failed"): um teste pode passar com o schema incompleto | 1 |
| `pglite.ts` e `migrations.ts` | A lista de migrations é repetida à mão nos dois arquivos | 1 |
| `todos` | Rotas, tela, hook e tabela de boilerplate ainda são a home do app | 1 |
| `design/templates/vtm-v20.json` | `generation` não tem `default`: uma ficha nova nasceria na 4ª geração (o `min`) | 6 |
| `packages/ui/package.json` | `peerDependencies` desatualizadas | 8 |

---

## 3. Mapa das etapas

| # | Etapa | Trilha | Depende de | Tamanho |
|---|---|---|---|---|
| 1 | CI e higiene da base | base | – | P |
| 2 | Tipos do contrato, `compileTemplate` e `resolve` | core | 1 | G |
| 3 | Comportamento por tipo: padrão, `short` e `describe` | core | 2 | M |
| 4 | Eventos e permissões | core | 2 | M |
| 5 | Regras e efeitos do Vampiro | core | 3, 4 | M |
| 6 | Publicação de template com `schema.json` (Ajv) | API | 1, 2 | M |
| 7 | Autenticação na API | API | 1 | G |
| 8 | `@tms/ui`: tokens, tema e primitivos | app | 1 | G |
| 9 | Autenticação no app e harness de E2E | app | 7, 8 | M |
| 10 | Crônicas e convites: API | API | 7 | M |
| 11 | Crônicas e convites: telas | app | 9, 10 | M |
| 12 | Fichas: leitura e criação na API | API | 4, 6, 10 | M |
| 13 | Renderizador em modo Leitura | app | 3, 8, 12 | G |
| 14 | Criação de ficha | app | 12, 13 | M |
| 15 | Eventos e histórico na API | API | 4, 12 | G |
| 16 | Store, fila e Desfazer | app | 4, 15 | M |
| 17 | Modo Jogo | app | 5, 16 | G |
| 18 | Modo Evoluir | app | 16, 17 | G |
| 19 | Mesa do narrador e histórico | app | 15, 17 | M |
| 20 | Offline persistente | app | 16, 17 | G |
| 21 | Parada de dados (`pool-success`) | core, API, app | 5, 17 | G |
| 22 | Fechamento da v0 | todas | todas | M |

P, M e G são tamanhos relativos de PR, não prazos.

**Trilhas paralelas.** Depois da Etapa 1, três frentes andam juntas:

- core: 2 → 3, 4 → 5;
- API: 6, 7 → 10 → 12 → 15;
- app: 8 → 9 → 11.

Elas se encontram na Etapa 13. O caminho crítico é **1 → 7 → 10 → 12 → 13 → 14** (Marco B), seguido de **15 → 16 → 17 → 18** (Marco C).

**Marcos.**

| Marco | Etapas | O que dá para mostrar |
|---|---|---|
| A. Fundação | 1–8 | Nada visível ao usuário, tudo testado: core, publicação, autenticação e primitivos |
| B. Criar e ver | 9–14 | Conta → crônica → convite → ficha criada → ficha aberta em Leitura |
| C. Editar e jogar | 15–18 | **A ficha já serve numa mesa, online**: montar em Evoluir, jogar com o dock, desfazer |
| D. Mesa e offline | 19–20 | O narrador acompanha a mesa; o jogo continua sem rede |
| E. Rolagem e fechamento | 21–22 | Parada de dados e jornada inteira no E2E |

---

## 4. Estratégia de testes

| Camada | Ferramenta | Onde roda | O que cobre | Meta no CI |
|---|---|---|---|---|
| Core | `bun test` + `fast-check` | pre-push e CI | validação, compile, resolve, eventos, regras e rolagem | ≥ 95% de linhas |
| Tipos | `tsc --noEmit` com `@ts-expect-error` | pre-commit e CI | tipos do contrato × allowlist do validador | compila |
| API | `bun test` + PGLite | pre-push e CI | rotas, AuthZ, IDOR, idempotência, limites e logs | ≥ 85% de linhas |
| API em Postgres | `bun test` + serviço `postgres:16` | CI | migrations up/down e concorrência (`FOR UPDATE`) | – |
| App | Jest + React Native Testing Library | pre-push e CI | primitivos, views, layouts, store, fila e acessibilidade | ≥ 80% em `sheet/` e `packages/ui` |
| E2E web | Playwright (Chromium e WebKit) | CI | a jornada do §1; offline com `context.setOffline` | jornada verde |
| Nativo | Maestro | antes de cada release | login, ficha, dock e modo avião | – |
| Segurança | testes dedicados, `pnpm audit` e check de bundle | CI | IDOR, JWT, rate limit, vazamento em log e em resposta | 0 high e 0 critical |

As metas de cobertura ficam no `bunfig.toml` (`coverageThreshold`) e no `jest.config.js` de cada pacote.

**Regras que valem para todas as etapas:**

- **Uma fonte de dados de teste.** Os templates de `design/templates/` e as fichas de `exemplos/personagens.json` servem ao core, à API, ao app e ao E2E. Nada é copiado.
- **D&D em todas as camadas.** O fixture `dnd5e-2014` roda junto nas etapas 2, 3, 13, 14 e 19, para pegar cedo um código que "aprendeu" o Vampiro (§10.1 da arquitetura).
- **Uma matriz de AuthZ compartilhada.** `apps/api/src/test/authz-matrix.ts` cruza atores com ações e diz o resultado esperado de cada par. Rota nova sem linha na matriz falha o teste, o mesmo fail secure da API aplicado aos testes.
  - Atores: dono, narrador da crônica, jogador da crônica, narrador de outra crônica, usuário sem vínculo e anônimo.
  - Ações: ler ficha, ler Notas do Narrador, escrever valor, escrever notas, escrever campo derivado, criar ficha, convidar e ler histórico.
- **Factories** em `apps/api/src/test/factories.ts` (usuário, crônica, membro, ficha). O template de teste entra pelo mesmo código de publicação da Etapa 6.
- **Todo bug vira teste** antes da correção.

---

## 5. Etapas

### Marco A. Fundação

#### Etapa 1. CI e higiene da base

P · depende de: nada

**Objetivo.** Todo PR seguinte nasce com CI e numa base sem armadilhas.

**Entrega.**

- `.github/workflows/ci.yml`, com as actions fixadas por SHA (supply chain):
  - job `check`: `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test` e `pnpm audit --audit-level high`;
  - job `design`: `node design/scripts/build.mjs` seguido de `git diff --exit-code` (arquivos gerados em dia), mais o `check_tokens.py`;
  - job `postgres`: serviço `postgres:16`, migrations `up → down → up` e os testes que precisam de Postgres real (a partir da Etapa 15).
- `packages/db/src/test/pglite.ts` aplica a lista de `migrations.ts`, a fonte única, e **falha** quando uma migration falha.
- Fim do boilerplate de `todos`:
  - remove as rotas, a tela, o hook e os testes;
  - troca `clearPGliteTodos` e `checkConnection` por helpers que não dependem de tabela;
  - cria a migration `0007_drop_todos`.

  A home vira um placeholder até a Etapa 11.
- Metas de cobertura configuradas (§4).
- `apps/frontend/app.json`: `android.allowBackup: false`, `userInterfaceStyle: "automatic"`, splash `#120e10` e nenhuma exceção de ATS no iOS.
- Branch protection na `main`, exigindo o CI.

**Testes.**

- `pglite-setup.test.ts`: o PGLite tem as tabelas e colunas que as migrations declaram;
- uma migration quebrada derruba o teste.

**Pronto quando.** O CI roda em todo PR e bloqueia o merge.

#### Etapa 2. Core: tipos do contrato, `compileTemplate` e `resolve`

G · depende de: 1

**Objetivo.** O app e a API passam a trabalhar com um `SheetModel` tipado, nunca com o JSON cru. É o "próximo PR da Fase 0" combinado no PR #24.

**Entrega** (`packages/sheet-core/src/`):

- `contract/`:
  - `template.ts`: `Template`, `Section`, `Identity`, `Accent`, `Action` e `Roll`, uma união por `model`;
  - `fields.ts`: `FieldDef` como união discriminada por `type` (14 tipos) e `FieldDefOf<T>`;
  - `sheet.ts`: `SheetData` e `ValueOf<T>`, o formato do valor de cada tipo (§3 do contrato);
  - os tipos espelham `schema.json`, e os nomes vêm de `registry.ts` (`FieldTypeName`, `LayoutName`...).
- **Paridade em tempo de compilação.** A allowlist `KEYS` de `validate/template.ts` passa a ser tipada por `FieldDefOf<T>` nos dois sentidos. Uma chave nova no tipo sem entrar na allowlist, ou o contrário, quebra o `typecheck`.
- `parse.ts`: `parseTemplate(json)` e `parseSheet(model, json)`. São o **único** caminho de `unknown` para os tipos: rodam o validador e só então devolvem `{ ok: true, value }`; senão, `{ ok: false, issues }`.
- `palette.ts`: a paleta `accent-N`, gerada de `tokens.json` pelo `build.mjs`, porque o core não lê arquivo.
- `compile.ts`: `compileTemplate(json)` → `SheetModel`, com os 6 passos do §5.2 da arquitetura:
  - recusa com `UnsupportedTemplateError`: `schema` diferente de 1, nome fora das listas ou template inválido;
  - indexa os campos e resolve as referências (`max.field`, `from`, `cap.field`, `roll.slots[].from`, `roll.penalty.field`);
  - zonas na ordem fixa e seções na ordem do template;
  - grafo de derivados em ordem topológica; ciclo é erro;
  - por campo: seção, zona, permissões, `editableIn` efetivo e valor padrão. Sem declaração, `text` e `longText` mudam em Jogo e Evoluir; os demais tipos, só em Evoluir;
  - `identityFields`: os campos de criação (`identity.name`, `chip`, `summary`, `subtitle` e as seções da zona `identity`), usados nas etapas 12 e 14;
  - `Object.freeze` profundo e memo por `system@templateVersion`.
- `resolve.ts`: `resolve(model, sheet)` devolve o valor efetivo de cada campo:
  - o valor base, ou o padrão quando o campo está ausente;
  - os derivados, na ordem topológica (`readOnly`, `max.derive`, `perTurn`);
  - o teto do `resource` (permanente, fixo, outro campo, derivado ou gravado) e o teto não destrutivo (`cap`);
  - na Vitalidade, o nível atual, a penalidade e o incapacitado;
  - os modificadores de `state`, com a origem. É genérico e coberto só pelos fixtures, porque o Vampiro não usa `state`.

**Testes** (`bun test`):

- os 6 templates compilam, e o modelo do `vtm-v20` tem as zonas e seções esperadas, na ordem;
- `UnsupportedTemplateError` para `schema: 2`, `type` desconhecido, `layout` desconhecido e ciclo de derivados;
- o memo devolve a mesma instância, e o modelo é imutável: mutação lança exceção em strict mode;
- `editableIn` efetivo por tipo; `identityFields` do Vampiro e do D&D;
- `resolve` em vários fixtures:
  - nas 4 fichas de Vampiro: teto do Sangue pela Geração, penalidade da Vitalidade e FdV;
  - no D&D: `proficiencyBonus` e iniciativa;
  - no Mago: `cap` das Esferas pelo Arete;
- `__tests__/types.check.ts` com `@ts-expect-error` (`rating` sem `max`; valor de `resource` com chave extra), compilado pelo `typecheck`.

**Pronto quando.** Nenhum consumidor precisa tocar no JSON cru.

#### Etapa 3. Core: comportamento por tipo (`FieldType`)

M · depende de: 2

**Objetivo.** Cada tipo sabe seu valor padrão, seu texto curto e sua frase acessível. É o que alimenta o `GenericRow` e, com ele, a ficha inteira em Leitura (Etapa 13).

**Entrega.** `fields/<tipo>.ts` para os 14 tipos. `fields/index.ts` declara o registro com `satisfies Record<FieldTypeName, FieldType>`, então o build quebra se faltar um tipo:

- `defaultValue(field)`;
- `short(field, resolved)`: "5/7", "2 letal", "+3 Bom";
- `describe(field, resolved)`: a gramática de anúncio do design system (§9.2). Exemplos: "Destreza, 2 de 5" e "Força de Vontade, 5 de 7".

É a porta de `shortValue` e `describe` de `design/telas/prototipo.js`. Os 14 tipos entram de uma vez porque são funções de texto, baratas, e o fixture de D&D precisa delas para abrir em Leitura.

**Testes.** Tabela por tipo com as frases esperadas (as do protótipo e as do design system), incluindo os casos de vazio, mínimo, máximo, teto e incapacitado.

#### Etapa 4. Core: eventos e permissões

M · depende de: 2

**Objetivo.** Uma única implementação de "aplicar um lote" e de "quem lê e escreve o quê". O app a usa para o otimista; a API, como autoridade.

**Entrega.**

- `events.ts`:
  - `Event { path, from, to }` e `EventBatch { clientBatchId, events, label? }`;
  - `applyBatch(model, sheet, batch, roles)` → `{ ok: true, sheet }`, ou `{ ok: false, kind: 'conflict' | 'forbidden' | 'invalid', issues }`. Tudo ou nada. Confere, nesta ordem:
    1. forma do `path`: `values.<id>` ou `specialties.<id>`, sem caminho mais fundo, com `Object.hasOwn`;
    2. campo `readOnly`;
    3. permissão de escrita;
    4. `from` igual ao valor atual (igualdade canônica);
    5. aplicação e `validateSheet` do resultado.
  - `invert(batch)`;
  - `diffToBatch(before, after)`: transforma o rascunho de Evoluir em um lote;
  - `describeBatch(model, batch)`: "Sangue 10 → 9". Texto vira "Notas atualizadas", sem o conteúdo. O mesmo rótulo serve ao toast, ao resumo de Evoluir e ao histórico;
  - `MAX_EVENTS_PER_BATCH = 50`, compartilhado com a API.
- `permissions.ts`: `canRead`, `canWrite` e `stripRestricted(model, sheet, roles)`.
  - `roles` é um conjunto (`owner`, `storyteller`, `player`), porque o narrador pode ser dono de uma ficha da própria crônica.
  - Seção sem `permissions`: todos da crônica leem; dono e narrador escrevem.
  - Papel desconhecido nega.
- `modes.ts`: `isEditableIn(field, mode)`. É UX, não controle de acesso, e o comentário do arquivo diz isso.

**Testes.**

- Propriedades com `fast-check`, sobre lotes válidos gerados a partir dos fixtures:
  - `applyBatch(invert(b))` devolve a ficha original;
  - um lote com um evento inválido não muda nada.
- `from` velho → `conflict`.
- `values.__proto__`, `values.blood.current` e `specialties.name` → `invalid`.
- Campo `readOnly` do D&D → `invalid`.
- Matriz papel × seção (com e sem `permissions`) × leitura e escrita.
- `stripRestricted` remove `values` **e** `specialties` dos campos restritos, sem mudar a ficha original.

#### Etapa 5. Core: regras e efeitos do Vampiro

M · depende de: 3, 4

**Objetivo.** As regras usadas em sessão, como funções puras que devolvem lotes.

**Entrega.**

- `rules/wod-stacking.ts`: `damage(field, value, type, n)` e `heal(field, value, type, n)`, com as regras do contrato (§3):
  - o dano mais grave ocupa as primeiras caixas;
  - com a trilha cheia, o dano novo substitui um menos grave, e o contusivo excedente vira letal;
  - a regra nunca cria dano mais grave que o recebido.

  Devolve o valor novo e as notas para o toast ("contusivo a mais virou letal", "a trilha não mudou").
- `rules/resource.ts`: gastar e recuperar, respeitando 0 e o teto resolvido.
- `effects.ts`: `planAction(model, sheet, action)` → `{ batch, preview }` ou `{ unavailable }`:
  - `resource.spend` (Despertar) e `resource.gain`;
  - `health.heal` (Curar 1 nível por 1 Sangue): um lote só, com a Vitalidade e o Sangue;
  - `rest.*` devolve `unavailable` na v0, e a UI esconde a ação.

**Testes.**

- tabela das regras de empilhamento, com os casos do contrato e da V20;
- a cura segue a ordem `["bashing", "lethal"]` e não toca no agravado;
- Curar sem Sangue ou sem dano → `unavailable`;
- todo lote planejado passa no `applyBatch`.

#### Etapa 6. Publicação de template com `schema.json`

M · depende de: 1, 2

**Objetivo.** O `vtm-v20` chega ao banco só pelo script do dono, validado pelas duas camadas do contrato.

**Entrega.**

- Migration `0008_template_versions`: `trait_templates.version` (not null), `published_at` e índice único em `(system_id, version)`.
- `apps/api/src/templates/publish.ts`, com a CLI em `apps/api/scripts/publish-template.ts` e `pnpm templates:publish <arquivo>` na raiz:
  1. faz `JSON.parse`;
  2. valida com o **Ajv** (`ajv/dist/2020`, `strict: true`, `allErrors: true`) contra `design/templates/schema.json`;
  3. roda `validateTemplate` e `compileTemplate` do core, o que prova que o app vai conseguir abrir o template;
  4. numa transação, faz o upsert de `game_systems` (`code`, `name` e `family` do template) e insere em `trait_templates`;
  5. versão já publicada com o mesmo conteúdo (hash do JSON canônico) é no-op. Com conteúdo diferente, o script para com "suba o templateVersion". **Versão publicada é imutável**, e é isso que permite ao app guardar o template em cache para sempre.
- **O Ajv fica só no servidor e no CI.** Ele entra como `devDependency` de `apps/api`. Como gera código com `new Function`, no bundle do app ele exigiria `unsafe-eval` na CSP. Um teste garante que `sheet-core` e `frontend` não dependem dele, e o check de bundle da Etapa 9 confirma.
- `vtm-v20.json` ganha `generation.default: 13`, seguido de um novo `build.mjs`.
- O log registra sistema, versão e hash. Nunca o conteúdo.

**Testes** (PGLite):

- os 6 templates de `design/` passam no Ajv;
- o Ajv rejeita os casos que só o schema pega: rótulo com quebra de linha, `facts` com `groups`, `pinTop` fora de `play`. É o motivo de existirem duas camadas;
- publicar, republicar igual (no-op) e republicar diferente (erro);
- template inválido não grava nada (rollback);
- `sheet-core/package.json` e `frontend/package.json` não citam `ajv`.

**Pronto quando.** `pnpm templates:publish design/templates/vtm-v20.json` grava a 1.0.0 num banco limpo.

#### Etapa 7. Autenticação na API

G · depende de: 1

**Objetivo.** Toda rota além de `/health` e `/auth/*` exige sessão válida (fail secure).

**Entrega.**

- Migration `0009_auth`:
  - tabela `refresh_tokens`: `id`, `user_id`, `family_id`, `token_hash` (único), `expires_at`, `revoked_at`, `replaced_by` e `created_at`;
  - índice único em `lower(email)`.
- **Senha.** `Bun.password.hash` (argon2id) e `Bun.password.verify`, sem dependência nova. Com um usuário inexistente, o login verifica um hash fixo, para que o tempo de resposta não revele quais contas existem.
- **JWT de acesso**, com o `jose`:
  - algoritmo fixado: `algorithms: ['HS256']`;
  - `exp` de 15 min, mais `iss`, `aud`, `sub` e `jti`;
  - `JWT_SECRET` com pelo menos 32 bytes, validado pelo zod de `@tms/config`. Fora do dev, vem do Azure Key Vault ou do Google Secret Manager.
- **Refresh token** opaco, com 32 bytes aleatórios:
  - guardado só como SHA-256;
  - trocado a cada uso (rotação);
  - o reuso de um token já trocado revoga a família inteira, porque é sinal de roubo.
- **Transporte:**
  - nativo: o refresh vai no corpo da resposta, e o app o guarda no `expo-secure-store`;
  - web: cookie `HttpOnly; Secure; SameSite=Strict; Path=/auth`;
  - nos dois, o token de acesso fica só em memória.
- **Rotas:** `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` e `GET /me`. O corpo é validado com TypeBox (`t`):
  - e-mail com até 254 caracteres;
  - `username` em `^[a-z0-9_]{3,24}$`;
  - senha de 15 a 128 caracteres (§7, decisão 1).
- **Plugin `auth` do Elysia:** resolve o `userId` do token e nega por padrão. As rotas públicas ficam numa allowlist explícita, então rota nova já nasce protegida.
- **Rate limit** por IP e por e-mail em `/auth/*`, com 429 e `Retry-After`. Na v0, um limitador próprio em memória, atrás de uma interface `RateLimiter`. Ela troca por Redis ou Postgres quando houver mais de uma instância da API.
- **§8.4 da arquitetura, adiantado.** O cookie com `credentials` exige origem explícita, então a correção entra agora:
  - `CORS_ORIGINS` como allowlist;
  - `/swagger` desligado em produção;
  - cabeçalhos HSTS, `nosniff`, `Referrer-Policy` e `frame-ancestors 'none'` no `onAfterHandle`;
  - `onError` devolve mensagem genérica, sem stack trace.
- **Logs** com `userId` e `requestId`. Nunca senha, token nem e-mail.

**Testes.**

- cadastro, login, `/me`, refresh com rotação e logout;
- JWT rejeitado:
  - com `alg: none` ou outro algoritmo;
  - com a assinatura adulterada;
  - com `iss` ou `aud` errados;
  - expirado, usando o relógio injetado pelo `currentDate` do `jose`;
- o reuso de um refresh token revoga a família; um refresh revogado recebe 401;
- e-mail inexistente e senha errada recebem a mesma mensagem;
- 429 depois de N tentativas;
- CORS recusa origem fora da lista;
- `/swagger` responde 404 com `NODE_ENV=production`;
- um erro 500 volta sem stack;
- um spy no logger mostra que senha e token nunca aparecem.

#### Etapa 8. `@tms/ui`: tokens, tema e primitivos

G · depende de: 1

**Objetivo.** Ter os componentes que a ficha usa, sem que eles saibam nada de template (§4 da arquitetura).

**Entrega.**

- O `build.mjs` gera `packages/ui/src/tokens.ts` e as skins a partir de `tokens.json` (§11 do design system):
  - cores por tema;
  - paleta `accent-N` com `fill`, `text` e `on`;
  - medidas em número e `lineHeight` absoluto.
- `ThemeProvider` com tema (noite, pergaminho ou sistema), skin e accent.
- No app, fontes locais com `expo-font`, nada do Google Fonts (LGPD).
- `react-native-svg` para os pips e os glifos.
- Os primitivos da v0, com a API de `design/design-system/components.md`:
  - base: `Pressable`, `Text`, `Button`, `IconButton`, `Chip`, `SegmentedControl` e `Tabs`;
  - valores: `RatingDots`, `Stepper`, `LeveledTrack`, `TextField`, `TextArea` e `Choice`;
  - feedback: `BottomSheet`, `Toast` (com ação), `Banner`, `EmptyState` e `Skeleton`;
  - navegação: `SectionHeader`, `ListItem`, `AppBar` e `BackLink`.
- `peerDependencies` em React 19 e RN 0.81.

**Testes** (Jest + RNTL), seguindo o contrato de acessibilidade do §11 do design system:

- `Stepper`:
  - tem `accessibilityRole="adjustable"`, `accessibilityValue` e as ações `increment` e `decrement`;
  - ao segurar, repete só no visual e emite **uma** mudança ao soltar;
- `RatingDots` fica fora da árvore de acessibilidade;
- `Choice` é um `radiogroup`;
- o voltar do Android fecha o `BottomSheet`;
- todo controle tem alvo mínimo de 44 (`hit-size`);
- o `Toast` chama a ação e dura mais com leitor de tela;
- `tokens.ts` está em dia com `tokens.json` (job `design` do CI).

**Pronto quando.** Os primitivos passam nos testes de acessibilidade e conferem com a vitrine (`design/design-system/index.html`) nos temas noite e pergaminho.

### Marco B. Criar e ver

#### Etapa 9. Autenticação no app e harness de E2E

M · depende de: 7, 8

**Entrega.**

- Rotas `app/(auth)/login.tsx` e `app/(auth)/register.tsx`, e o grupo `app/(app)/` com guarda: sem sessão, vai para o login.
- `lib/session/`:
  - `tokenStore.native.ts`: guarda o refresh no `expo-secure-store`;
  - `tokenStore.web.ts`: não guarda nada, porque o refresh mora no cookie;
  - nos dois, o token de acesso fica em memória.
- O cliente Eden envia o token de acesso. Diante de um 401, faz um único refresh em voo (single-flight) e repete a requisição uma vez; se falhar de novo, faz logout.
- O logout:
  1. revoga a sessão no servidor;
  2. apaga o secure store;
  3. limpa o cache com `queryClient.clear()` e, a partir da Etapa 16, o outbox;
  4. volta ao login.
- **Harness de E2E** em `e2e/`, com Playwright:
  - `expo export -p web` servido estático, a API e o Postgres do docker compose;
  - `templates:publish` como seed;
  - primeiro cenário: cadastro → login → logout. Cada etapa de tela seguinte acrescenta o seu.
- **Check de bundle** (`scripts/check-bundle.mjs`, no CI): o export web não pode conter `pg`, `kysely`, `ajv` nem `pglite`.

**Testes** (RNTL):

- login com sucesso navega para o app; o erro mostrado é genérico;
- dois 401 simultâneos geram um único refresh;
- refresh falho leva ao login;
- o logout limpa o cache e o token store;
- nenhum token é gravado em `AsyncStorage` ou `localStorage` (spy).

**Pronto quando.** Login e logout funcionam no iOS, no Android e no web, e o E2E roda no CI.

#### Etapa 10. Crônicas e convites: API

M · depende de: 7

**Entrega.**

- Migration `0010_chronicle_members`:
  - `chronicle_members`: `chronicle_id`, `user_id` e `joined_at`, com PK composta;
  - `chronicle_invites`: `id`, `chronicle_id`, `code_hash` (único), `created_by`, `expires_at`, `max_uses`, `uses` e `revoked_at`.
- `apps/api/src/authz.ts`: `chronicleRoles(userId, chronicleId)` e `characterRoles(userId, characterId)` devolvem o conjunto de papéis, resolvido **no banco**. Conjunto vazio responde 404, e não 403, para não confirmar que o recurso existe.
- Rotas:
  - `GET /systems`: sistemas com template publicado;
  - `POST /chronicles` com `name` e `systemCode` publicado; quem cria é o narrador;
  - `GET /chronicles` (as que eu narro ou de que participo) e `GET /chronicles/:id`;
  - `POST /chronicles/:id/invites`, só para o narrador: gera um código de 128 bits em base32, mostrado uma vez e guardado como hash. O padrão é valer 7 dias e 10 usos;
  - `DELETE /chronicles/:id/invites/:inviteId`;
  - `POST /invites/accept` com `code`, com rate limit por usuário e por IP.

**Testes.**

- a matriz de AuthZ (§4) em cada rota;
- convite expirado, revogado e esgotado;
- aceitar duas vezes não duplica o membro;
- o narrador aceitar o próprio convite é no-op;
- força bruta no código → 429;
- sistema sem template publicado → 422.

#### Etapa 11. Crônicas e convites: telas

M · depende de: 9, 10 · referência visual: `design/telas/cronicas.html`

**Entrega.**

- `app/(app)/index.tsx` (Crônicas): "Suas crônicas", "Seus personagens" e o estado vazio, com "Criar crônica" e "Entrar com convite".
- `chronicles/new.tsx`.
- `chronicles/[id]/index.tsx`: a lista de personagens e o botão "Nova ficha".
- O sheet de convite: copiar com `expo-clipboard` e compartilhar com `Share`.
- `join.tsx`.

**Testes.**

- RNTL das telas com a API mockada: vazio, lista, erro e carregando;
- E2E: o narrador cria a crônica e o convite, e o jogador entra com o código.

#### Etapa 12. Fichas: leitura e criação na API

M · depende de: 4, 6, 10

**Entrega.**

- Migration `0011_character_sync`:
  - `characters.template_version` e `characters.sheet_version`;
  - `character_batches` e `character_events` (§8.3 da arquitetura);
  - índice em `characters(chronicle_id)`.
- `GET /systems/:code/template?version=`:
  - com versão, responde com `ETag: "<system>@<version>"` e `Cache-Control: private, max-age=31536000, immutable`, porque a versão é imutável (Etapa 6);
  - com `If-None-Match`, responde 304.
- `POST /chronicles/:id/characters`:
  - só um membro ou o narrador da crônica pode criar;
  - `system_id` e `template_version` vêm da crônica e do último template publicado, nunca do cliente;
  - aceita só os `identityFields` do modelo. `identity.name` é obrigatório e não pode ficar vazio depois do `trim`. O resto da ficha nasce vazio e vale o padrão de cada tipo;
  - roda `validateSheet` antes de gravar;
  - grava em `characters.name` o valor do campo `identity.name`.
- `GET /characters/:id` → `{ id, chronicleId, systemCode, templateVersion, sheetVersion, roles, sheet }`, com o `sheet` passado por `stripRestricted`.
- `GET /chronicles/:id/characters`: a lista com nome, dono, selo, resumo e os campos do `dock`, tudo filtrado por papel.
- `DELETE /characters/:id`: exclusão lógica (`deleted_at`), feita pelo dono ou pelo narrador.
- A API guarda o modelo compilado em cache por `system@version`.

**Testes.**

- criação de uma ficha de Vampiro;
- criação que envia `storytellerNotes`, um atributo ou nenhum nome → 422;
- usuário que não é membro → 404;
- o `GET` vem sem as Notas do Narrador para o dono e para o jogador, e com elas para o narrador;
- ficha excluída → 404;
- `ETag` e 304;
- a lista nunca traz campo restrito.

#### Etapa 13. Renderizador em modo Leitura

G · depende de: 3, 8, 12 · referência visual: `design/telas/ficha.html#c=helena`

**Objetivo.** Qualquer ficha aparece inteira, ainda sem componentes ricos, graças ao `GenericRow` (§6.2 da arquitetura).

**Entrega** (`apps/frontend/sheet/`):

- `model/`:
  - queries de template (por versão, com `staleTime: Infinity`) e de ficha;
  - `compileTemplate` memoizado;
  - `validateSheet` na ficha recebida, como defesa: se falhar, a tela mostra o estado de erro.
- `SheetScreen`, `CharacterHeader`, `IdentityBlock`, `SectionView` e `ZoneTabs`. São 3 abas, com rótulo de `zoneLabels`; a aba sem seção legível some.
- `layouts/registry.ts`: `facts`, `text` e `fields`. `grid`, `groups`, `list` e `pyramid` caem numa lista com títulos.
- Views:
  - `views/registry.ts`, com `satisfies Record<FieldTypeName, FieldView>`;
  - `views/resolve.ts` (`resolveView`);
  - `GenericRow`: mostra o rótulo e o `short()`, e usa o `describe()` como rótulo acessível;
  - `FieldSlot`.
- Rota `app/(app)/characters/[id].tsx`.
- Estados: carregando (`Skeleton`), sem acesso, erro com "Tentar de novo" e "Atualize o app" (`UnsupportedTemplateError`).

**Testes.**

- as 4 fichas de Vampiro de `exemplos/personagens.json` abrem em Leitura, e todo campo legível aparece com o rótulo acessível do `describe()`;
- na resposta filtrada que o jogador recebe, a seção do narrador não aparece;
- **a ficha de D&D abre com `GenericRow`, sem erro.** É o teste anti-acoplamento do §10.1 da arquitetura;
- layout desconhecido cai em lista; aba vazia some;
- lint: `noDangerouslySetInnerHtml` e nenhum `WebView` em `sheet/`;
- E2E: abrir uma ficha criada pela API.

#### Etapa 14. Criação de ficha

M · depende de: 12, 13

**Objetivo.** "Nova ficha" gera o formulário a partir do template.

**Entrega.**

- `app/(app)/chronicles/[id]/new-character.tsx`:
  - renderiza `model.identityFields` na variante `editor`; nesta etapa entram os editores de `text`, `choice` e `number`;
  - valida com o core antes de enviar: nome obrigatório e limites de cada campo.
- Depois de criar, abre a ficha. A partir da Etapa 18, ela abre direto em Evoluir com o aviso "Distribua os pontos da ficha". Não há orçamento de pontos: a criação por pontos é futura (§11 da arquitetura).

**Testes.**

- o formulário do Vampiro mostra nome, conceito, clã, geração, senhor, natureza e comportamento;
- **o formulário do fixture de D&D mostra os campos de identidade do D&D.** Isso prova que nenhum campo está fixo no código;
- erros de validação;
- o `POST` leva só campos de identidade;
- E2E: criar a ficha e ver o nome e o clã no header.

**Pronto quando, Marco B.** Demo no app e no web: conta → crônica → convite → ficha criada → ficha aberta em Leitura.

### Marco C. Editar e jogar

#### Etapa 15. Eventos e histórico na API

G · depende de: 4, 12

**Entrega.**

- `POST /characters/:id/events` com `{ clientBatchId, events }`, seguindo o pipeline do §8.2 da arquitetura:
  1. sessão, e papéis resolvidos no banco;
  2. rate limit por usuário e por ficha; corpo de até 64 KB; de 1 a 50 eventos;
  3. numa transação:
     - idempotência por `(character_id, client_batch_id)`: um lote já aplicado responde 200 com a versão atual;
     - `SELECT ... FOR UPDATE`;
     - ficha excluída → 404;
  4. `applyBatch` do core, com o modelo da `template_version` **da ficha**;
  5. em `conflict`, responde 409 com os valores atuais dos caminhos em conflito, **passados por `stripRestricted`**;
  6. grava, com `by` e `at` definidos pelo servidor:
     - `sheet_data` e `sheet_version + 1`;
     - `characters.name`, se o campo do nome mudou;
     - o lote e os eventos, com `from` e `to` nulos para `text` e `longText`;
  7. responde `{ sheetVersion, sheet }`, com a ficha filtrada.
- Códigos de resposta:

  | Código | Quando |
  |---|---|
  | 400 | forma inválida |
  | 403 | sem permissão de escrita, mas com leitura |
  | 404 | sem acesso |
  | 409 | conflito |
  | 413 | corpo grande demais |
  | 422 | lote inválido |
  | 429 | rate limit |

- `GET /characters/:id/history`:
  - paginado por cursor;
  - cada lote traz quem (username e papel), quando e o `describeBatch`;
  - os caminhos restritos são removidos conforme o papel de quem lê.

**Testes.**

- IDOR:
  - o jogador A edita a ficha de B;
  - o narrador da crônica X edita uma ficha da crônica Y;
  - o jogador grava `storytellerNotes`;
  - o dono grava um campo derivado, ou `specialties` de um campo sem especialização;
- o mesmo `clientBatchId` enviado duas vezes é aplicado uma vez só;
- um lote com um evento inválido não grava nada;
- o 409 não vaza Notas do Narrador para o jogador;
- 51 eventos → 400 (o limite está no schema da rota, é forma); corpo de 65 KB → 413; 429;
- o histórico não tem conteúdo de texto, e o jogador não vê caminhos restritos;
- um spy no logger mostra que um texto "segredo" nas notas nunca aparece em log;
- no job `postgres` do CI, dois lotes concorrentes com o mesmo `from` resultam em exatamente um 200 e um 409. O PGLite tem uma conexão só e não prova a trava.

#### Etapa 16. Store, fila e Desfazer

M · depende de: 4, 15

**Entrega** (`apps/frontend/sheet/`):

- `store/`: um `SheetStore` Zustand por ficha (§6.5 da arquitetura):
  - `snapshot`, `pending` e `values = applyAll(snapshot, pending)`;
  - `mode`, `draft` e a pilha de Desfazer;
  - seletores por campo (`useResolvedValue(id)`).
- `commit(events, label)`:
  1. roda o `applyBatch` no aparelho; um lote inválido nem sai dele;
  2. gera o `clientBatchId` com `randomUUID` do `expo-crypto`;
  3. enfileira.
- `sync/outbox.ts`, com a interface do §7.3. Nesta etapa a implementação é **em memória**.
- `sync/sender.ts`: FIFO por ficha, um lote em voo e backoff com jitter. Trata as respostas pela tabela do §6.6:
  - erro de rede e 5xx: tenta de novo;
  - 409: descarta, rebusca a ficha e mostra o conflito com "Reaplicar";
  - 400, 403 e 422: reverte o otimista;
  - 401: renova a sessão.
- `Toast` com "Desfazer", que chama `commit(invert(batch))`.

**Testes** (Jest, com timers falsos):

- o otimista aplica na hora;
- a confirmação troca o snapshot pela ficha do servidor;
- cada linha da tabela de respostas;
- a ordem FIFO;
- Desfazer gera o lote inverso;
- **contagem de render:** com 50 `FieldSlot` na tela, gastar Sangue re-renderiza só os componentes que assinam o Sangue.

#### Etapa 17. Modo Jogo

G · depende de: 5, 16

**Entrega.**

- Views ricas:
  - `resource`: linha, chip e sheet. O sheet tem stepper, gastar e recuperar com os verbos do template, a nota de Sangue por turno e as ações com prévia;
  - `track` com `wod-stacking`: mini trilha no chip e um sheet com uma linha por tipo de dano. O stepper de cada linha chama `damage` e `heal` do core, a penalidade fica em destaque e as notas da regra vão para o toast.
- `CombatDock`, com os campos de `template.dock`:
  - o toque abre o sheet;
  - o toque longo aplica a `defaultAction`, com Desfazer, e também fica disponível em `accessibilityActions`;
  - "Todos os recursos".
- Menu ⋯ com as ações do template (Despertar), sempre com prévia (`planAction`).
- Modo padrão: o dono abre em Jogo; os demais, em Leitura.
- Em Jogo, só mudam os campos com `play` em `editableIn`. Um traço permanente abre o detalhe com a nota "Traço permanente: muda só em Evoluir".
- Háptico com `expo-haptics`: seleção no stepper, impacto na ação padrão e um padrão mais forte no dano agravado.

**Testes.**

- toque longo no Sangue → lote de `{ current: 10 }` para `{ current: 9 }`;
- +1 letal pelo sheet;
- Curar → um lote com a Vitalidade e o Sangue;
- Despertar mostra a prévia antes de aplicar;
- Desfazer;
- estado incapacitado;
- em Jogo, a Força não ganha stepper;
- anúncios do leitor de tela ("Sangue, 9 de 13");
- E2E: gastar Sangue e levar dano, recarregar a página e encontrar os valores.

#### Etapa 18. Modo Evoluir

G · depende de: 16, 17

**Entrega.**

- `ModeBar` com "Evoluindo · N alterações", sobre o rascunho no store.
  - "Concluir" mostra o resumo (`describeBatch`) com duas saídas: Salvar, que manda um lote (`diffToBatch`), ou Descartar.
  - Sair da tela com rascunho pede confirmação.
- Layouts ricos:
  - `grid`: Atributos em 3 grupos, na variante `cell`;
  - `groups`: Habilidades com o filtro `invested` ligado por padrão e desligado em Evoluir, busca sem acento, "Mostrando N de M · Mostrar todos" e lista compacta em chips.
- Editores:
  - `Stepper` inline em `rating` e `number`, com teclado numérico ao tocar no valor;
  - `text` e `longText` em sheet, com contador e `KeyboardAvoidingView`;
  - `choice` em `radiogroup`; trocar o Clã muda o accent;
  - o permanente da FdV;
  - especializações dos campos com `specialty: true`;
  - editor de `list` (Disciplinas e Antecedentes): adicionar do catálogo ou por nome, valor, especialização, notas e remover com confirmação. A lista vazia mostra "Nenhuma Disciplina + Adicionar".
- Overrides da skin `wod`: pips grandes na `cell` de `rating`.
- A criação da Etapa 14 passa a abrir neste modo.

**Testes.**

- Força 2 → 3, Taumaturgia 1 adicionada e uma especialização:
  - o resumo lista as 3 alterações;
  - Salvar manda **um** lote com 3 eventos;
  - Descartar volta tudo;
- um 422 do servidor marca o campo indicado no `path` do erro;
- filtro e busca: "ocultismo" acha "Ocultismo";
- matriz skin × tipo × variante registrada: toda view tem um rótulo acessível que começa pelo texto visível, e um `accessibilityValue` quando há valor (§6.4 da arquitetura);
- E2E: criar → evoluir (atributos, habilidades e disciplinas) → salvar → recarregar → os valores continuam lá.

**Pronto quando, Marco C.** A ficha de Vampiro é criada, montada, vista e jogada online, no app e no web. A partir daqui, a v0 já serve numa mesa.

### Marco D. Mesa e offline

#### Etapa 19. Mesa do narrador e histórico

M · depende de: 15, 17 · referência visual: `design/telas/mesa.html`

**Entrega.**

- A aba "Mesa" na crônica, só para o narrador:
  - uma linha por personagem, com os chips do dock (variante `chip`) e a hora da última alteração;
  - tocar numa linha abre a ficha em Leitura.
- "Editar como narrador" troca para Jogo, com o aviso "As alterações ficam assinadas no histórico". As Notas do Narrador são editáveis só por ele.
- Sheet "Histórico de alterações", com os dados da Etapa 15 e a marca "(narrador)" quando for o caso.
- Sem tempo real: a ficha é rebuscada ao focar a tela, ao reconectar e depois de cada lote.

**Testes.**

- a mesa mostra os chips do Vampiro e do fixture de D&D com o mesmo código;
- o narrador altera a Vitalidade do jogador, e o histórico mostra o papel de quem alterou;
- o jogador não vê os eventos das Notas do Narrador;
- E2E: o narrador edita, e o jogador vê a mudança ao voltar para a ficha.

#### Etapa 20. Offline persistente

G · depende de: 16, 17

**Entrega.**

- Storage com a chave prefixada pelo id do usuário:
  - `sync/storage.native.ts`, sobre o `expo-sqlite/kv-store`;
  - `sync/storage.web.ts`, sobre o IndexedDB.
- Cache persistido com `@tanstack/react-query-persist-client` e `@tanstack/query-async-storage-persister`, só para templates e fichas. O `buster` é a versão do app.
- Outbox persistido, com a mesma interface da Etapa 16 e o mesmo limite de lotes por ficha que o servidor.
- `onlineManager` ligado ao `@react-native-community/netinfo`.
- O que vem do disco é tratado como input hostil:
  - o template passa por `compileTemplate`;
  - a ficha passa por `validateSheet`;
  - cada lote tem a forma conferida;
  - o que falhar é descartado e rebuscado.
- Na tela:
  - `SyncIndicator` no header: salvo, salvando, offline · N pendentes, ou erro;
  - banner de offline;
  - o banner de conflito da Etapa 16.
- O logout apaga o cache e o outbox do usuário.

**Testes.**

- "reiniciar o app" (um store novo sobre o mesmo storage) mantém os pendentes e os envia em ordem;
- dado adulterado no storage é descartado;
- o usuário B nunca vê o cache do usuário A; o logout limpa tudo;
- se a conexão cair entre o commit no servidor e o ack, o reenvio recebe 200 idempotente;
- E2E com `context.setOffline(true)`:
  1. gastar Sangue e levar dano offline;
  2. recarregar a página: os valores continuam lá;
  3. voltar a ficar online: os lotes são confirmados, e o servidor fica igual à tela;
- no aparelho, o roteiro manual em modo avião (Etapa 22).

**Pronto quando, Marco D.** O jogo continua sem rede e sincroniza ao voltar, no app e no web.

### Marco E. Rolagem e fechamento

#### Etapa 21. Parada de dados (`pool-success`)

G · depende de: 5, 17 · **linha de corte:** a ficha é utilizável sem esta etapa. Se o prazo apertar, ela vira v0.1 sem mexer no resto.

**Entrega.**

- Core:
  - `random.ts`: RNG injetado, com sorteio de inteiros por amostragem por rejeição, sem viés de módulo;
  - `rollers/pool-success.ts`:
    - a parada sai dos slots, com os valores resolvidos;
    - dificuldade; cada 1 anula um sucesso; falha crítica;
    - especialização com `tenCountsDouble`;
    - penalidade da Vitalidade; incapacitado bloqueia a rolagem;
    - `autoSuccess` da FdV.
- App: o sheet "Dados":
  - slots Atributo e "Habilidade ou Disciplina", com busca;
  - modificadores com a origem, dificuldade e FdV;
  - "Rolar no app" e "Rolei na mão";
  - resultado anunciado e lista das rolagens da sessão.
- API: `POST /characters/:id/rolls`.
  - O cliente manda só os ids dos slots, a dificuldade e o boost.
  - O servidor monta a parada a partir da ficha gravada, rola com `crypto.randomInt`, debita a FdV na mesma transação e grava em `character_rolls` (migration `0012_rolls`).
  - "Rolei na mão" é gravado como manual.
  - A API nunca aceita um resultado vindo do cliente.
- "Rolar no app" sem rede usa o `getRandomValues` do `expo-crypto`, e o resultado fica marcado como local.

**Testes.**

- um RNG falso com sequências fixas para cada regra;
- o teste da amostragem por rejeição usa valores no limite do intervalo;
- a API ignora um resultado enviado pelo cliente e rola de novo;
- a FdV é debitada uma vez só;
- E2E: montar Destreza + Esportes e rolar.

#### Etapa 22. Fechamento da v0

M · depende de: todas

**Entrega.**

- O E2E da jornada inteira do §1 num único cenário, em Chromium e WebKit.
- Smoke nativo com **Maestro** antes de cada release: login, abrir a ficha, gastar Sangue e modo avião.
- O checklist do §9 da arquitetura, item a item, cada um apontando para o teste que o cobre.
- Antes do lançamento público:
  - SQLCipher no storage nativo (exige dev build);
  - CSP na hospedagem do web: `script-src 'self'`, `object-src 'none'` e `frame-ancestors 'none'`;
  - exclusão de conta, por ser um direito do titular (LGPD, art. 18).
- O §8.3 da arquitetura passa a incluir as tabelas que o plano criou: membros, convites, refresh tokens e rolagens.

**Feito (armazenamento nativo e smoke).**

- **SQLCipher** (`sheet/sync/encryptedStorage.ts`, ligado em `storage.native.ts`):
  - banco `tms-offline.db` cifrado, com chave de 32 bytes do `expo-crypto` guardada só no SecureStore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`);
  - `PRAGMA key` antes de qualquer instrução;
  - fail secure, detalhado no §7.2 da arquitetura: sem chave ou com a chave errada, apaga e recomeça; com o SecureStore falhando ou sem SQLCipher no binário, fica em memória;
  - o banco sem cifra da Etapa 20 é apagado na primeira abertura;
  - plugin `["expo-sqlite", { "useSQLCipher": true }]` e identificadores `com.tms.app` no `app.json`. O `expo prebuild` grava `expo.sqlite.useSQLCipher=true` no `gradle.properties`.
- **Testes:**
  - `encryptedStorage.test.ts` com um `expo-sqlite` falso que simula a cifra (`test/__mocks__/expoSqlite.ts`). Cobre a primeira abertura, a reutilização da chave, a chave ausente, errada e adulterada, a falha do SecureStore, o binário sem SQLCipher, a ordem do PRAGMA, o prefixo sem curinga e a chave fora dos logs;
  - `storage.native.test.ts`: as opções do SecureStore e os 32 bytes;
  - `nativeConfig.test.ts`: o `app.json` mantém o SQLCipher e `allowBackup: false` e não abre cleartext nem ATS.
- **Maestro** (`apps/frontend/.maestro/`):
  - quatro fluxos: login, abrir a ficha, gastar Sangue e Desfazer, e modo avião com reinício offline (Android);
  - o `README.md` explica como rodar num dev build com conta de homologação.
- **Roteiro manual no aparelho** (iOS e Android, antes de cada release), no mesmo README:
  1. Ligar o modo avião.
  2. Gastar Sangue e levar dano: o indicador mostra "Offline · 2 pendentes".
  3. Fechar o app à força e reabrir sem rede: a ficha abre do aparelho, com os valores e os pendentes.
  4. Desligar o modo avião: "Salvo", e o mesmo valor no web.
  5. Sair da conta: sem rede, o app pede login.
  6. Copiar o `tms-offline.db` de um Android de desenvolvimento: ele não abre no `sqlite3` comum e não contém o texto da ficha.
- **O que só um dev build prova:** que o binário tem o SQLCipher (`PRAGMA cipher_version`) e que o arquivo no disco está cifrado. O Jest prova a lógica e a ordem das instruções; o Maestro e o roteiro manual provam o aparelho.

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| A UI é a maior parte do esforço (etapas 13, 17 e 18) | Com o `GenericRow`, a ficha inteira aparece desde a Etapa 13, e o componente rico entra tipo a tipo |
| Diferença entre web e nativo | E2E no web em todo PR; Maestro no nativo antes de cada release |
| Um template publicado mudar e quebrar fichas | Versão imutável (Etapa 6), e cada ficha presa à sua `template_version` |
| Offline perder lote | O outbox fica atrás de uma interface testada desde a Etapa 16; a persistência só entra na 20 |
| O código se acoplar ao Vampiro | Fixture de D&D nas etapas 2, 3, 13, 14 e 19 |

---

## 7. Decisões em aberto

| # | Decisão | Proposta | Precisa antes da etapa |
|---|---|---|---|
| 1 | Tamanho mínimo da senha | 15 caracteres, sem regra de composição. O ASVS L2 aceita 8 e recomenda 15; o NIST SP 800-63B-4 pede 15 quando a senha é o único fator | 7 |
| 2 | Formato do convite | Código. O link (deep link) pode vir depois | 10 |
| 3 | A rolagem entra na v0? | Sim, como a última etapa e linha de corte | 21 |
| 4 | Quem lê as notas do jogador | Dono + narrador (menor privilégio, §12 da arquitetura). Mas `notes` divide a seção `about` com `quote`, que é o `identity.voice`, e campo de identidade não pode ter leitura restrita. Por isso, `notes` precisaria ir para uma seção própria | 13 |
| 5 | Política de conflito | 409 com "Reaplicar", como na arquitetura. O contrato (§10) diz "o último a escrever vence"; ele precisa ser alinhado | 16 |
| 6 | Recuperação de senha | Exige um provedor de e-mail. Sem ele, quem esquece a senha perde o acesso. Proposta: decidir o provedor junto com a hospedagem | 22 |
| 7 | Onde a v0 roda | API, banco e web, mais o gerenciador de segredos (Azure Key Vault ou Google Secret Manager). Este plano não cobre o deploy | 22 |
| 8 | O que a exclusão de conta apaga (LGPD art. 18, VI) | **Decidido na Etapa 22.** A linha do usuário sai de verdade (e-mail, nome e hash), sem "soft delete". O que é só dele vai junto: fichas (com histórico e rolagens), vínculos, convites e sessões. O que ele fez em fichas de outras pessoas fica no histórico, anônimo ("Conta excluída"). Dado de outra pessoa nunca é apagado em silêncio: se ele narra uma crônica com outros membros ou fichas, `DELETE /me` responde 409 com a lista, e ele precisa excluir a crônica antes (`DELETE /chronicles/:id`, que pede o nome da crônica digitado quando há fichas de outros jogadores). Passar a narração para outro membro fica para depois da v0. Risco residual: o token de acesso já emitido vale até expirar (15 min), mas não alcança mais nada (os vínculos saíram) | 22 |

---

## 8. Fora da v0

- Criação com orçamento de pontos (`creation`, §11 da arquitetura).
- Migração de fichas entre versões de template: a ficha só guarda a versão em que nasceu.
- Tempo real.
- Outros sistemas: o D&D continua só como fixture. Mago e Lobisomem são os próximos (§10.3 da arquitetura).
- Views ricas dos tipos que o Vampiro não usa, e os layouts `list` e `pyramid` ricos.
- Ações `rest.*`.
- Arquivar ficha, exportar e imprimir.
- Convite por e-mail ou por link.
- Compêndio offline.
