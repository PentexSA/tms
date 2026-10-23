# Validação da v5: Bastidores

Data: 23/10/2026. Base: `main` em `0f090dc` (merge do PR #32). As alterações
da v5 estão na árvore de trabalho, **sem commit, PR ou CI remoto**: todas as
evidências abaixo são locais (WSL2, Ubuntu 20.04, 7,8 GB; Docker Desktop;
Postgres 16.2; Node 22.14; Bun 1.2.23 local, 1.4.3 no CI).

Escopo entregue: entregas 10 e 11 (núcleo) e 12 (P2) do
[painel do narrador](painel-narrador.md#v5-bastidores-privacidade), conforme o
[plano v5](plano-v5.md). Nenhum item do P2 foi adiado.

## O que mudou

| Camada | Alteração |
|---|---|
| Banco | Migration `0019_backstage`: `kind`/`visibility`/revisões/retrato em `characters`; `chronicle_commands` (idempotência por crônica); `character_rolls` por crônica, com `hidden`, ficha opcional e chave `(chronicle_id, client_roll_id)`; `chronicle_sessions`; `session_id` em operações e lotes; descrição/imagem/opções/revisão em `chronicles`; `chronicle_transfers` com um pendente por crônica |
| Contrato | Papel `viewer` (lê, nunca escreve); identidade pública (nome, selo, subtítulo, retrato); catálogo opcional `options` com efeitos fechados (`flag`, `choice`, `bounded-number`) |
| Core | `publicIdentityOf`, leitura padrão separada da escrita, parada livre pelo executor `pool-success`, `ROLL_UNSUPPORTED` nos demais modelos, validação das opções |
| API | NPC idempotente, visibilidade e apresentação com revisão; projeções `identity`/`full`; feed e parada livre do narrador; rolagem oculta filtrada do dono e do histórico; sessões; `PATCH /chronicles/:id`; transferência com aceite; auditoria consolidada paginada |
| App | Criar NPC, controle Oculto/Identidade/Ficha, leitura do `viewer`, feed e parada livre na Mesa, aba Bastidores (diário, apresentação, regras da casa, transferência, auditoria) |

## Correções feitas no fechamento

A validação encontrou quatro defeitos na implementação, todos corrigidos e
cobertos por teste que falha sem a correção:

| Defeito | Correção | Teste |
|---|---|---|
| A data da sessão saía como timestamp (`2026-10-20T03:00:00.000Z`); num servidor a leste de UTC, caía no dia anterior | O banco devolve `AAAA-MM-DD` (`to_char`) em toda leitura e `RETURNING` | `backstage.test.ts`: data civil em criação, reenvio, edição, lista, detalhe e `lastSession` |
| Pedido de transferência vencido ficava `pending` para sempre: nem cancelar nem propor outro passavam | A proposta fecha como `expired`, na mesma transação, o pendente vencido | `backstage.test.ts`: vencido não é aceito e não trava a próxima proposta |
| A auditoria ordenava só por data; lotes de uma operação em grupo têm o mesmo instante e podiam repetir ou sumir entre páginas | Desempate por `id` no SQL e comparação binária no merge | `backstage.test.ts`: 10+ itens no mesmo instante, páginas de 3 sem lacuna nem repetição |
| O narrador via "Aguardando aceitar" e "Cancelar" para um pedido vencido | A tela só mostra o pendente disponível; senão volta a oferecer os membros | `CampaignBackstage.test.tsx` |

Também foram reduzidos o tempo e a memória da suíte da API, que esgotava a
memória local: a matriz de AuthZ divide um PGLite entre os cenários (235 s →
31 s; 1,9 GB → 1,0 GB), e o `destroy()` do PGLite de teste solta o módulo
WASM mesmo quando o arquivo de teste guarda o `db` (suíte completa: 4,4 GB →
1,4 GB de pico).

## Código e contratos

| Verificação local | Resultado |
|---|---|
| Build e TypeScript de todos os pacotes | Passou (16 tarefas) |
| Biome (`biome ci` nas pastas versionadas) | Passou; restam os 2 avisos anteriores em `xp.test.ts` |
| Nomes de sistema fora de core/templates (`check-system-names.mjs`) | Passou |
| Templates, exemplos, gerados de design em dia e contraste | Passou (162/162) |
| Core, com cobertura | 946 testes passaram |
| API em PGLite, com cobertura (98,89% funções, 99,18% linhas) | 1565 passaram, 52 pulados (os `.pg` sem `PG_TEST_URL`) |
| App, com cobertura | 612 testes passaram |
| UI, com cobertura | 91 testes passaram |
| Config | 24 testes passaram |
| Banco, com cobertura | 23 testes passaram, incluindo o diagnóstico de colisão histórica de `client_roll_id` |
| Migrations up/down/up em Postgres real (`migrate:check`) | Passou |
| Tipos Kysely em dia com as migrations (`db:codegen` + diff) | Passou após regenerar `types.ts` (a versão anterior tinha `session_date` escrito à mão) |
| Publicação dos templates em banco descartável | Passou |
| `pnpm audit --audit-level high` | **Falhou** por dependência herdada; ver pendências |

A matriz de AuthZ cobre as 15 rotas novas nos três sistemas, com os atores do
plano, `viewer` e transferência antes/depois. Cada resposta a quem não narra é
conferida contra a nota secreta do narrador. Desde o fechamento, todos os
cenários dividem o banco, então o segredo de um cenário também não pode
aparecer no de outro.

## Concorrência em Postgres real

Cada arquivo em banco descartável `*_test`, conexões independentes, 31
testes, nenhum pulado:

| Arquivo | Resultado |
|---|---|
| `events.pg.test.ts` | 2 passaram |
| `rolls.pg.test.ts` | 2 passaram |
| `policy.pg.test.ts` | 1 passou |
| `members.pg.test.ts` | 3 passaram |
| `operations.pg.test.ts` | 5 passaram |
| `xp.pg.test.ts` | 10 passaram |
| `backstage.pg.test.ts` (v5) | 8 passaram, em 4 rodadas seguidas |

Disputas da v5 cobertas: criação duplicada de NPC; duas visibilidades na mesma
revisão; mesma chave de rolagem em fichas distintas; transferência contra
operação do narrador antigo, com posse do NPC preservada após excluir a conta
de origem; aceite contra cancelamento; aceite contra saída do destinatário;
aceite contra configuração do narrador antigo; duas edições de sessão na mesma
revisão. As quatro últimas rodam 6 vezes cada, em crônicas novas, e conferem o
banco depois do conflito.

Não cobertos em Postgres real: limite de criações do narrador sob
concorrência, ocultação contra leitura simultânea, roll com custo contra
trava/remoção e operação/XP com sessão sob resposta perdida. Esses
comportamentos têm testes em PGLite, que serializam as transações.

## Web (Playwright)

Export com a CSP de produção, API e Postgres reais, depois das correções:

| Navegador | Resultado |
|---|---|
| Chromium | 25 testes passaram, incluindo `journey-backstage.spec.ts` |
| WebKit (servidor Playwright 1.63.0 no container oficial; o WSL não tem as bibliotecas) | 25 testes passaram |

As jornadas de Vampiro, Mago, Lobisomem e do narrador (v0–v3) passaram nos dois.

## Android

Mesmo ambiente da v3: emulador Android 15/API 35 com KVM no container
`tms-native-tools`, Maestro 2.11.0 e APK de **release** x86_64 gerado nesta
rodada (bundle da v5, `useSQLCipher: true`, API de teste em
`http://10.0.2.2:3101`). Seed descartável: 1 conta, 3 crônicas e 4 fichas.

Novo fluxo `08-backstage.yaml`: criar NPC (nasce Oculto), revelar só a
Identidade, parada livre oculta na Mesa com o resultado no feed, sessão
registrada nos Bastidores.

| Rodada | Resultado |
|---|---|
| Suíte completa (8 fluxos) | 7 passaram, incluindo o `08`; o `07` falhou ao tocar a primeira ficha da Mesa |
| `07` corrigido, isolado | Passou |

A falha do `07` era do fluxo: desde a v4, a configuração da criação fica acima
das abas, e as linhas e a barra de ações da Mesa saem da tela. O fluxo passou a
rolar até cada elemento; o app não mudou. A suíte inteira não foi repetida com
o `07` corrigido: logo depois da rodada completa, o WSL inteiro reiniciou por
falta de memória (emulador, Docker Desktop e editor dividindo 7,8 GB).

A verificação da cifra do banco (`sqlite3` não abre, sem texto da ficha) não
foi repetida; a configuração nativa (`app.json`, plugins) não mudou desde a
v3. O fluxo de modo avião, que reinicia o app a partir do banco cifrado,
passou.

## iOS

Não executado: este ambiente é Linux, sem Mac, Xcode, simulador ou aparelho.
Os fluxos compartilhados (todos menos o de modo avião) servem para a rodada
em iOS. O WebKit não substitui o iOS nativo.

## Pendências

- **CI remoto:** nada foi enviado. O workflow inclui o novo job de
  concorrência (`backstage.pg.test.ts`); o resultado fica para o PR.
- **Auditoria de dependências:** `zod` < 4.6.6 (alto, publicado em
  01/10/2026), via `@elysiajs/swagger` → `@scalar/*`. É dependência anterior à
  v5 (o lockfile não mudou) e faz o `pnpm audit` do CI falhar até haver
  atualização ou exceção registrada em `pnpm-workspace.yaml`.
- **Herdadas da v4:** não há `doc/validacao-v4.md` nem
  `e2e/tests/journey-creation.spec.ts`. A criação e o XP foram preservados
  pelas suítes de API, app e Postgres (`xp.pg.test.ts`), mas a jornada de
  criação da v4 continua sem E2E próprio.
- **Rollback da 0019:** o `down` recusa enquanto existirem rolagens livres e,
  ao descer, os NPCs viram fichas comuns do narrador (perdem tipo e
  visibilidade, sem ficarem visíveis a jogadores). O `up` falha com
  diagnóstico, sem escolher resultado, se houver colisão histórica de chave
  de rolagem na mesma crônica.
- **Cache já visto:** reduzir a visibilidade impede novas leituras e o app
  descarta a projeção ao detectar a mudança (foco, reconexão, 404), mas não
  apaga o que um aparelho já exibiu antes da revogação.
- **Teste instável não reproduzido:** `backstage.test.ts` › "oculta
  sentinela…" falhou uma vez durante a edição do arquivo e passou nas 30
  rodadas seguintes.
- **Ambiente local:** o Jest do app com o padrão de workers (15 em 16 núcleos)
  estoura o tempo por falta de memória neste WSL; com `--maxWorkers=4` passa.
  O Bun local (1.2.23) teve um segfault isolado; o CI usa 1.4.3.
