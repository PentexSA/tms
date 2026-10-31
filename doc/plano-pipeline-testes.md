# Plano de melhoria da pipeline de testes

Diagnóstico de 30/10/2026, feito sobre os runs do `.github/workflows/ci.yml`
e medições locais, revisado depois de uma segunda leitura. Dois problemas: a
pipeline está **vermelha** e está **lenta**.

## 1. Diagnóstico

### 1.1 Tempos do último run verde (23/10, run 40003098352)

| Job | Tempo | Onde vai o tempo |
|---|---|---|
| lint, typecheck, testes e auditoria | **389 s** | `test:coverage` 342 s, dos quais 280 s são a API |
| E2E web (Chromium e WebKit) | **341 s** | `test:e2e` 242 s; `playwright install` 39–64 s; build e export ~30 s |
| Postgres real | 70 s | ok |
| design | 6 s | ok |

**Base desatualizada:** esse run é anterior ao `6a7b30b`, que passou a
compartilhar um PGLite na matriz de AuthZ (`authz.test.ts`) e acrescentou
testes (1276 → 1565). Medição local atual da API, com cobertura: **138 s**,
1565 aprovados, 52 pulados (Bun 1.2.23 local; o CI usa 1.4.3, então os
tempos não são diretamente comparáveis). **A primeira tarefa da Fase 1 é
medir de novo no CI.**

### 1.2 Causa da lentidão da API

Fora da matriz de AuthZ, `createTestContext()`
(`apps/api/src/test/helpers.ts`) ainda sobe um PGLite novo **a cada teste**.
Medição local:

| Operação | Tempo |
|---|---|
| primeiro banco (migra + snapshot) | ~1684 ms, uma vez por processo |
| banco novo por teste (carrega o snapshot) | **~234 ms** |
| `TRUNCATE` das 19 tabelas num banco que já existe | **~24 ms** |

Cada PGLite segura ~180 MB de WASM, e por isso os pacotes rodam em série
(`--concurrency=1`).

### 1.3 Por que cada job falhava (corrigido na Fase 0)

1. **lint, typecheck, testes:** o Bun aplica o `coverageThreshold` **por
   arquivo**. `0020_product_templates.ts` tinha 84,62 % de linhas (meta de
   90 %), e o turbo parava ali: **API e frontend não rodavam no CI**.
2. **Postgres real:** `policy.pg.test.ts` recebia 422 ao concluir: a criação
   por pontos virou o padrão e a ficha do teste não fechava a conta. Os 4
   passos seguintes ficavam pulados, e `creation.pg.test.ts` nunca esteve no
   CI.
3. **E2E:** `evolve.spec.ts:70` (Chromium e WebKit) e `journey.spec.ts:29`
   (Chromium) falham de forma consistente.
4. **design:** `design/telas/dados.js` e `validate.js` estavam
   desatualizados.

### 1.4 Outros pontos

- Bun local 1.2.23 e Bun do CI 1.4.3.
- O `.husky/pre-push` roda `pnpm test` (a suíte inteira, sem typecheck; o
  typecheck está no pre-commit).
- Sem cache do turbo entre runs, e os `inputs` dos testes **não declaram
  `design/`**, que os testes leem (conferido com `turbo --dry`):
  `@tms/db` (`test`, `test:coverage`), `@tms/api` (`test`,
  `test:coverage`) e `@tms/sheet-core` (`test:coverage`; só o `test` está
  certo em `packages/sheet-core/turbo.jsonc`).

## 2. Plano

### Fase 0: deixar verde

- [x] Cobrir o conflito previsto da migration 0020 com um teste (em vez de
      excluir as migrations da meta de cobertura).
- [x] `policy.pg.test.ts`: criação livre (`freeCreation`), como nos testes
      em PGLite.
- [x] Regenerar `design/telas/dados.js` e `validate.js`.
- [x] `evolve.spec.ts:70`: era **bug do app**. A navegação do Expo Router 58
      não emite mais `beforeRemove`, então o `LeaveGuard` não segurava a saída
      e o rascunho de Evoluir se perdia sem aviso. Agora usa `usePreventRemove`.
- [x] `journey.spec.ts:29`: o `fill` do e-mail caía no campo do login antes da
      troca de tela (o relatório do CI mostra o cadastro sem e-mail). Agora
      espera `/register`, como o `auth.spec`.
- [x] Para uma falha não esconder as outras: `turbo run test:coverage
      --continue` e `if: ${{ !cancelled() }}` nos passos independentes.

### Fase 1: acelerar os testes da API

- [x] Medir de novo (Bun 1.4.3, local; falta no CI): ver §4.
- [x] Um PGLite por arquivo (`useTestDb()` no topo de cada arquivo), com o
      ciclo explícito:
  - `beforeAll`: cria o banco (do snapshot já migrado);
  - a cada `createTestContext()` (chamado no `beforeEach` dos arquivos, e às
    vezes de novo dentro do teste): restaura os dados ao estado de logo
    depois das migrations;
  - `afterAll`: fecha o banco;
  - app, relógio e tokens continuam **novos a cada teste**
    (`createTestContextOn`).
- [x] Restaurar, não só truncar: `TRUNCATE` das tabelas de dados e
      **restauração do conteúdo inicial** de `game_systems` e
      `trait_templates` (há testes que inserem nelas, ex.
      `chronicles.test.ts:69`). Por exemplo: guardar as linhas semeadas
      depois das migrations e reinseri-las, ou apagar o que passou do id
      inicial.
- [x] Os testes de publicação (`templates/__tests__/publish.test.ts`), que
      usam outro conjunto de migrations, mantêm o banco próprio.
- [x] `--concurrency=1` → `--concurrency=2` nos scripts da raiz e no CI
      (o padrão do turbo instalado é 10). Medido: ver §4.

### Fase 2: reorganizar o CI

- [x] **Corrigir os `inputs` do turbo antes de qualquer cache entre runs:**
      `design/templates/**` em `test` e `test:coverage` de `@tms/db`,
      `@tms/api`, `@tms/sheet-core` e também do **frontend**, que lê os
      templates nos testes.
- [x] Quebrar o job `check` em jobs paralelos: lint + typecheck, testes de
      backend (Bun) e testes de frontend (Jest).
- [x] Postgres: trocar os passos por um único
      `PG_TEST_URL=... bun test .pg.test` (filtro por trecho do caminho; o
      glob `src/**/*.pg.test.ts` no Bash sem `globstar` omite
      `src/rolls/__tests__/`). Sem `PG_TEST_URL` os testes são pulados, então
      o passo também confere que nenhum foi pulado. Execução serial: os
      arquivos apagam o mesmo schema. Verificado localmente: 36 testes em 8
      arquivos, ~9 s.
- [x] **E2E (parte essencial da meta, é o caminho crítico):** Chromium e
      WebKit em jobs separados (matriz). Cada job continua pagando
      instalação, build, export e Postgres (~100 s), então dividir os testes
      não divide o job pela metade.
  - Experimento, não decisão: cache de `~/.cache/ms-playwright`. O próprio
    Playwright avisa que restaurar o cache pode custar tanto quanto baixar,
    e as dependências Linux continuam exigindo instalação. Medir antes de
    adotar.
  - Opcional: WebKit só na `main` ou num job noturno.
- [x] Cache do turbo entre runs (cache remoto ou `actions/cache` de
      `.turbo`), **depois** de corrigir os `inputs`.
- [x] Fixar a versão do Bun num arquivo só (`.bun-version`, lido pelo
      `setup-bun` com `bun-version-file`).

### Fase 3: o dia a dia local

- [x] No `pre-push`, só os pacotes alterados e os que dependem deles. A base
      é o SHA que o remoto já tem (o Git o passa ao hook pela entrada
      padrão); numa branch nova, o ponto de saída da `origin/main`; push só
      de remoção não testa. Usa `--filter=...[base]`: o `--affected` do turbo
      2.11 falha com Git anterior ao 2.30 (o desta máquina é o 2.25).
- [ ] Atualizar a seção de testes do `CLAUDE.md` (lista dos `*.pg.test.ts`,
      contagem de testes).

## 3. Critérios de aceite

Toda mudança de desempenho só conta como entregue quando:

- **Mesma versão do Bun** nas duas medições (a do CI, fixada em
  `.bun-version`), e mesmo runner.
- **Mediana de três execuções**, antes e depois.
- **Com e sem cache:** com o cache do turbo frio (`--force`) e quente; para o
  E2E, com e sem o cache dos navegadores.
- **Pico de memória** registrado (ex. `/usr/bin/time -v`, "Maximum resident
  set size"), principalmente ao subir a concorrência do turbo.
- **Cobertura mantida:** nenhuma meta de `bunfig.toml`/`jest.config.js`
  rebaixada, e a cobertura por pacote não cai.
- **Testes executados mantidos:** o número de testes aprovados e pulados por
  pacote é o mesmo de antes (nenhum arquivo fica de fora por glob, filtro ou
  `skipIf`); no job Postgres, nenhum `*.pg.test.ts` pulado.

## 4. Resultados medidos

Máquina local (WSL2), Bun 1.4.3 (o do CI), com cobertura. Antes = `120ac78`
(Fase 0 pronta), depois = `390be3f` (Fase 1), cada um num worktree próprio,
uma medição de cada vez.

**API (`bun test --coverage`), três execuções:**

| | Execuções | Mediana | Testes | Cobertura (funções / linhas) | Pico de memória |
|---|---|---|---|---|---|
| antes | 114,96 / 114,82 / 111,25 s | **114,8 s** | 1565 aprovados, 52 pulados | 98,88 / 99,18 | 1,18–1,19 GB |
| depois | 64,88 / 64,20 / 68,58 s | **64,9 s** (−43 %) | 1565 aprovados, 52 pulados | 98,88 / 99,18 | 1,17–1,21 GB |

A suíte também passou em ordem aleatória (`--randomize`, sementes 1 e 2).

**Todos os pacotes (`turbo run test:coverage --force`, sem cache), uma
execução de cada:**

| `--concurrency` | Tempo | Pico de memória somado (árvore de processos) |
|---|---|---|
| 1 | 139,1 s | 1,55 GB |
| 2 | **77,8 s** | 2,70 GB |

Os 13 tasks passam nos dois casos (sheet-core 962, db 29, config 24, API 1617
com 52 pulados, ui 91, frontend 630).

**Os 52 pulados** sem `PG_TEST_URL` são os 36 testes dos 8 `*.pg.test.ts`
mais 16 entradas "(unnamed)": o `beforeAll` e o `afterAll` de cada
`describe.skipIf`. Com a variável, os 36 rodam e nada é pulado.

**Falta medir no CI:** as três execuções por job, com o cache do turbo frio
e quente, e o E2E por navegador.

## 5. Resultado esperado

Estimativas, a confirmar depois de cada fase:

| | Hoje | Depois |
|---|---|---|
| Job de testes | ~390 s (base antiga) | ~90–120 s |
| E2E por navegador | ~340 s (os dois juntos) | ~100 s de preparação + ~120 s de testes ≈ 220 s |
| Run inteiro | 6–8 min | ~4 min, limitado pelo E2E |
| `pre-push` local | suíte inteira | só o que mudou desde o remoto |

A Fase 1 sozinha não muda o tempo total do run: enquanto o E2E levar ~340 s,
ele é o limite. A meta de ~4 min depende da matriz do E2E na Fase 2.
