# Plano de implementação da v3: Mesa administrável

> Plano · 2026-10-21 · base: `feat/fichas-wod-completas` em `0ec7546` (v2 com as fichas completas; PR #30 aberto)

Este plano leva a v2 até uma **mesa que o narrador administra**: a ficha tem estado, o servidor decide quem escreve o quê em cada estado, o narrador conclui a criação, trava, arquiva, remove jogadores, vê quem está mal na Mesa e aplica e desfaz ações em grupo. Tudo sem uma linha de código que saiba o nome de um sistema fora do core e dos templates.

| Documento | Responde |
|---|---|
| [`painel-narrador.md`](painel-narrador.md) | **O que** entra no painel, os contratos (5.1 e 5.4) e as decisões fechadas (§10) |
| [`arquitetura-motor-de-ficha.md`](arquitetura-motor-de-ficha.md) | **Por que** e **como** o motor funciona; §8.2, o pipeline de um lote no servidor |
| [`../design/templates/README.md`](../design/templates/README.md) | **O que** o template pode dizer |
| [`plano-v0.md`](plano-v0.md) | As regras de teste do §4 e a matriz de AuthZ, que continuam valendo |
| [`plano-v1.md`](plano-v1.md), [`plano-v2.md`](plano-v2.md) | O molde que este plano repete |
| este documento | **Em que ordem** construir as entregas 0 a 4 do §8 da proposta, e **como provar** que cada passo funciona |

Como usar: o mesmo da v0 à v2. Cada etapa é um PR, só termina com os testes verdes no CI, e uma etapa que muda o contrato do template atualiza as duas camadas (`schema.json` e `validate.mjs`) e o README no mesmo PR.

**Por que a mesa agora.** A v0 à v2 provaram que o motor desenha três sistemas sem saber deles. O que falta para uma mesa de verdade não é ficha: é **autorização e concorrência**. Hoje "dono e narrador escrevem" em qualquer momento, o dono continua escrevendo depois de sair da crônica, e qualquer membro lê a ficha dos outros. A v3 fecha isso antes de qualquer contador de pontos (v4) ou NPC oculto (v5), porque os dois se apoiam na política que ela cria.

**Diferente da v1 e da v2, a v3 tem migração.** Duas, na verdade (etapas 5 e 11). Sem jogadores reais (§2 da proposta), elas são baratas: as fichas de teste são recriadas pelo seed.

---

## 1. Onde queremos chegar

A v3 está pronta quando esta jornada roda inteira no app e no web, e um teste E2E (`journey-storyteller.spec.ts`) a repete no CI:

1. O narrador cria a crônica e convida dois jogadores. Cada um cria a ficha e distribui os pontos em Evoluir.
2. O narrador conclui a criação de uma ficha. O jogador gasta FdV temporária e não consegue subir um Atributo.
3. O narrador aplica 2 níveis letais nos dois personagens de uma vez e desfaz pelo snackbar.
4. O narrador trava uma ficha. O jogador não consegue gastar FdV nem rolar com custo; uma rolagem sem custo funciona.
5. O narrador remove um jogador. O ex-membro acha a crônica marcada "Você saiu", abre a ficha em Leitura, tenta editar e tenta rolar gastando FdV, e as duas coisas são recusadas com o motivo na tela.
6. O outro jogador, em todo o percurso, não vê a ficha do primeiro.
7. As jornadas do Vampiro, do Mago e do Lobisomem (`journey.spec.ts`, `journey-mage.spec.ts`, `journey-werewolf.spec.ts`) continuam verdes. Elas ficam em `creating` do começo ao fim, onde o dono faz tudo o que fazia antes.

Mais os critérios de aceite do 5.1 e do 5.4 da proposta, que viram testes nas etapas 5, 10 e 11 (§4).

O que fica fora está no §8.

## Estado da v3 (22/10/2026)

Etapas 1 a 14 implementadas no branch `feat/v3-mesa`. A Etapa 13 foi incluída no fechamento:

- **Etapa 4:** `classify.ts` (`classifyChange`, `classifyBatch`, um classificador por tipo num mapa que quebra o build se faltar um) e `policy.ts` (`writePolicy`, os estados da v3) no `@tms/sheet-core`; o Ouro e o inventário do fixture de D&D com `editableIn: ["play"]`. Os códigos de recusa seguem a decisão 18 (§7).
- **Etapa 5:** migração `0014_character_status`; a política dentro da transação em `/events`, `/rolls` (com `rollPolicy`: sem custo, a trava não conta) e `DELETE /characters/:id`; as rotas do narrador em `sheets/status.ts`, cada uma com uma linha no `chronicle_audit` (`audit.ts`); `status` e `lockedAt` na ficha e na Mesa; `policy.test.ts` (a tabela nos três sistemas e os critérios do 5.1) e `policy.pg.test.ts` no job `postgres`. Uma ação que não muda nada (concluir de novo, travar a travada, o mesmo estado) é 409 sem linha no registro; de `creating` para `active`, só concluindo.
- **Etapa 6:** `sheet/policy.ts` no app (a frase de cada código, o contexto com o estado e `blockedBy`, a mesma `writePolicy` do core); o `rejectionMessage` e a rolagem leem o `code`; em `active`, o editor de Evoluir desabilita o que é `advance` ("Peça ao narrador", pelo `editClass` do core), e texto, especialização e o atual de um recurso continuam editáveis; travada, a ficha do dono fica em Jogo sem nada editável (a rolagem sem custo continua) e o dock diz o motivo em vez de abrir o gasto; arquivada ou fora de jogo, em Leitura; o menu ⋯ do narrador (`StatusMenu.tsx`). `statusLabels` entrou no contrato (decisão 7), com o rótulo no fixture de D&D; os três templates do produto o ganham na Etapa 8, junto com `alerts`.
- **Etapa 7:** `former` no `ChronicleRole` (quem tem ficha e não tem vínculo), com o que cada rota faz com ele; `DELETE /chronicles/:id/members/:userId` e `/members/me` pelo protocolo de trava (o vínculo, depois as fichas em ordem de `id`), com as fichas em `archived`, a linha no `chronicle_audit` e, ao remover, os convites revogados por padrão; a criação de ficha trava o vínculo e conta o limite dentro da transação; `GET /characters/:id` devolve `member`; o app mostra "Você saiu", a lista de membros do narrador com as fichas e a data de entrada, "Remover" e "Sair da crônica"; os convites dizem os usos restantes. A matriz ganhou o ator `former`, e `members.pg.test.ts` entrou no job `postgres` (conferido: sem a trava do vínculo na criação, dois dos três cenários falham).
- **Etapa 8:** `alerts` no contrato (schema, as duas camadas, README §6 e §9), com `REGISTRY.alertRules` (`track-at-level`, `resource-at-most`, `resource-below-share`) e o parâmetro de cada regra conferido; `alertsOf(model, sheet, roles)` no core, que pula o campo que o papel não lê. `vtm-v20` 1.4.0 (Incapacitado, FdV zerada, Sem Sangue; `dead` é "Torpor"), `mta-m20` 1.3.0 (Incapacitado, FdV zerada; "Morto") e `wta-w20` 1.3.0 (Incapacitado, FdV zerada, Sem Fúria; "Morto"); o fixture de D&D com PV abaixo da metade.
- **Etapa 9:** `GET /chronicles/:id/table?status=` (sem filtro, `creating` e `active`); a Mesa carrega os templates das linhas de uma vez, calcula cada linha uma vez (`tableItems.ts`) e a desenha com `TableRow` (memo): o estado da ficha, os alertas como selo e no nome acessível, "Em jogo" e "Arquivadas e fora de jogo", ordenar por nome e pela última alteração, "Só com alerta" e "Atualizado há N min". Abrir uma linha guarda a ordem da tela (`lib/tableOrder.ts`), e a ficha do narrador passa à vizinha deslizando (a 24 px da borda) ou pelos botões "Anterior" e "Próxima". O teste de render conta as linhas (conferido: com o `onOpen` mudando com o filtro, ele falha).
- **Etapa 10:** `group.ts` no core: `damageTargets` (a trilha `wod-stacking` e o recurso com `damage1`), `planGroupDamage` (com mais de um alvo na ficha, pede a escolha), `invertBatch` (recebe os eventos do histórico com `fromAbsent`; recusa o lote sem conteúdo e o conflito, sem reversão parcial) e `isReversible`; as propriedades de aplicar e reverter nas fichas de exemplo.

- **Etapa 11:** migração `0015_chronicle_operations`, prévia e aplicação atômica em `chronicles/operations.ts`; idempotência depois das travas em ordem de id, recusa de alvos duplicados, de outra crônica e de versões vencidas; reversão de operação ou lote, incluindo `from_absent` nos eventos comuns e nos custos de rolagem. Não se reverte uma operação inteira se algum lote dela já foi desfeito. O histórico informa `operationId` e `reversible`; matriz e job de Postgres incluem as rotas novas.
- **Etapa 12:** seleção de até 20 personagens na Mesa; dano e cura com tipos e alvos do template, stepper, prévia por ficha e reconfirmação do 409. A chave é mantida após resposta perdida. Desfazer no toast usa a reversão do servidor; no histórico, só o narrador vê a ação nos lotes reversíveis. Operações e reversões ficam desabilitadas sem rede. O mesmo fluxo cobre o PV do fixture de D&D.
- **Etapa 13:** `recoveries` nas validações e no contrato; `resource.restore` e `planRecovery` no core; prévia, confirmação e reversão de `kind: recovery` na API e na Mesa. Templates `vtm-v20` 1.5.0, `mta-m20` 1.4.0 e `wta-w20` 1.4.0, com regras e fontes em [recuperacoes-v3.md](recuperacoes-v3.md). D&D com `rest.long` indisponível e motivo explícito. Testes de composição, contratos, atomicidade, idempotência e concorrência; a jornada inclui Nova noite e Desfazer.
- **Etapa 14:** jornada com três sessões e páginas já abertas para provar as recusas de trava e remoção; fluxo nativo `07-storyteller-table`; DBML e checklist de segurança atualizados. As recusas de rolagem que levam a ficha para Leitura usam o toast global para o motivo continuar visível depois de fechar os Dados, com testes de remoção e arquivamento. O fluxo Maestro 07 inclui dano e Nova noite com Desfazer. A validação Android e o fechamento remoto estão registrados em [validacao-v3.md](validacao-v3.md) e no [PR #31](https://github.com/PentexSA/tms/pull/31); iOS fica pendente por decisão do usuário.

Validação: 772 testes do core, 912 da API em PGLite, 574 do app, 21 do banco e 91 do UI. As metas de cobertura, build, typecheck, Biome, contratos, design e a auditoria passaram; cinco cenários de operações passaram em Postgres real, incluindo a recuperação concorrente. A suíte completa de 24 testes web passou localmente no WebKit, em Ubuntu 22.04 pelo Docker. O CI do PR executa os cinco arquivos de concorrência em Postgres e os 48 testes web em Chromium e WebKit. Evidências e limite de iOS em [validacao-v3.md](validacao-v3.md).

---

## 2. Ponto de partida

Conferido no código em `0ec7546`:

| Área | Hoje | O que falta para a v3 |
|---|---|---|
| PR #30 | Aberto. No CI de `0ec7546`, falham o `test:coverage` do `@tms/sheet-core` e a `journey-mage.spec.ts` no WebKit (timeout de 90 s num `click`); o job do Postgres real foi cancelado. Há uma mudança local, não commitada, em `validate-sheet.test.ts` | CI verde com as três jornadas juntas (§3.1 da proposta) |
| Templates | `vtm-v20` 1.3.0, `mta-m20` 1.2.0, `wta-w20` 1.2.0, só no PR #30. Nenhum usa o papel `player` em `permissions`. A seção `experience` não tem `permissions` | `alerts` (Etapa 8) e `recoveries` (Etapa 13) |
| AuthZ (`apps/api/src/authz.ts`) | `characterAccess` dá `owner` por `characters.user_id`, **mesmo sem vínculo na crônica**, e `player` a qualquer outro membro | membro sem papel na ficha alheia (Etapa 2); dono sem vínculo só lê (Etapa 5) |
| Permissões (`sheet-core/src/permissions.ts`) | Seção sem `permissions`: todos da crônica leem, dono e narrador escrevem. `canWrite(model, fieldId, roles)` já existe e decide por **campo** | seção sem `permissions` lida só por dono e narrador (Etapa 2); a política por **estado e classe de mudança** é outra função (§7, decisão 1) |
| Lista da crônica | `GET /chronicles/:id/characters` devolve identidade e `dock` de todas as fichas a qualquer membro; `characterCount` de `GET /chronicles` conta todas | só as fichas de quem pergunta (Etapa 2) |
| Escrita | `POST /characters/:id/events`: idempotente por `client_batch_id`, `FOR UPDATE` na ficha, `applyBatch` do core. O papel vem de `characterAccess`, lido **antes** da transação | política avaliada dentro da transação, depois da trava (Etapa 5) |
| Rolagens (`rolls/routes.ts`) | Só dono e narrador rolam; o custo é um lote (`recordCost`) na mesma transação. Sem rede, o app rola no aparelho e manda o custo pela fila (`useDice.ts`, `local`) | a política antes de rolar com custo (Etapa 5); o caminho offline já cai na política do `/events` |
| Histórico | `character_events` guarda o `from` **efetivo** (`withEffectiveFrom`: o padrão, quando não havia valor). Texto, texto longo e especializações ficam com `from`/`to` nulos | reverter com exatidão (§7, decisão 3) |
| Core | `invert(events)` já existe (troca `from` e `to`, ordem inversa); `planDamage` (trilha `wod-stacking`) e `takeDamage` (recurso, o PV do D&D) | `classifyChange`, `invertBatch`, dano em grupo, `alerts`, `recoveries` |
| Recusa no app | `rejectionMessage(label, status, draft)` em `sheet/sync/sync.ts`: um 403 vira "Sem permissão para …", sem ler o corpo. A rolagem mostra o `error` do corpo (`messageOf`) | frase por código de recusa (Etapa 6) |
| Mesa | `GET /chronicles/:id/table` só do narrador; `TableView.tsx` desenha o `dock` e a hora da última alteração; `useRefetchOnFocus` puxa ao focar | estado, alertas, ordenar, filtrar, navegar (Etapa 9) |
| Desfazer | Toast com "Desfazer" (`useCommit.ts`), `TOAST_MS = 5000` no `@tms/ui` | o mesmo toast chamando a reversão do servidor (Etapa 12) |
| Membros | `chronicle_members` (PK `chronicle_id, user_id`); entrar só por convite. Não há remover nem sair. A lista de convites já devolve `uses`, `maxUses`, `expiresAt` | remover, sair, `former` (Etapa 7) |
| Banco | Última migração: `0013_account_deletion` | `0014` (Etapa 5) e `0015` (Etapa 11) |
| Testes | A matriz (`test/authz-matrix.ts`) roda só com o `vtm-v20`; Mago e Lobisomem têm `mage.test.ts` e `werewolf.test.ts`. O Postgres real roda `events.pg.test.ts` e `rolls.pg.test.ts` no CI | matriz nos três sistemas (Etapa 3); três testes novos em Postgres real (etapas 5, 7 e 11) |

---

## 3. Mapa das etapas

| # | Etapa | Entrega (§8) | Trilha | Depende de | Tamanho |
|---|---|---|---|---|---|
| 1 | Fechar o PR #30 | 0 | todas | – | P |
| 2 | Jogador vê só as próprias fichas | 0 | API, core, app | 1 | M |
| 3 | Matriz de AuthZ nos três sistemas | 0 | API | 2 | M |
| 4 | Core: `classifyChange` e a tabela da política | 1 | core | 1 | M |
| 5 | Estados, política no servidor e `chronicle_audit` | 1 | banco, API | 3, 4 | G |
| 6 | App: estados, recusa com motivo e as ações do narrador | 1 | app | 5 | M |
| 7 | Remover jogador, sair e o ex-membro | 2 | API, app | 5, 6 | G |
| 8 | Template e core: `alerts` | 3 | template, core | 1 | M |
| 9 | Mesa com alertas | 3 | app | 2, 8 | M |
| 10 | Core: `invertBatch` e o dano em grupo | 4 | core | 4 | M |
| 11 | Operações em grupo e reversão no servidor | 4 | banco, API | 5, 10 | G |
| 12 | App: ações em grupo e Desfazer | 4 | app | 6, 11 | M |
| 13 | Recuperações por período | 4 | template, core, app | 11, 12 | M |
| 14 | Jornada do narrador e fechamento da v3 | todas | todas | todas | M |

**Trilhas paralelas.** A Mesa (8 e 9) só depende da entrega 0 e anda ao lado de tudo, como diz a proposta. As etapas 4, 8 e 10 são core puro e podem sair juntas, em worktrees. O caminho crítico é **2 → 3 → 5 → 7 → 14**: a política e o ex-membro são o que a jornada mais prova.

**A ordem 5 → 7 importa** (§8 da proposta): o arquivamento e o bloqueio de escrita existem antes de alguém ser removido.

**Marcos.**

| Marco | Etapas | O que dá para mostrar |
|---|---|---|
| A. Pré-requisitos | 1–3 | Cada jogador vê só as próprias fichas, nos três sistemas, provado pela matriz |
| B. Política | 4–6 | O narrador conclui a criação e trava; o jogador vê o motivo de cada recusa |
| C. Membros | 7 | Remover e sair, com o ex-membro lendo a ficha arquivada |
| D. Mesa | 8–9 | A Mesa diz quem está mal sem abrir a ficha |
| E. Operações | 10–13 | Dano em grupo, com prévia e Desfazer, atômico e idempotente |
| F. Fechamento | 14 | A jornada do narrador no E2E, ao lado das três jornadas de ficha |

---

## 4. Estratégia de testes

As camadas, as ferramentas e as metas de cobertura são as da v0 (§4 do `plano-v0.md`). O que muda:

- **A matriz de AuthZ ganha atores e sistemas.** Ela passa a rodar com os três templates do produto (Etapa 3) e ganha o ator `former` (Etapa 7). Toda rota nova da v3 entra nela, como manda o "fail secure" do `authz.test.ts`.
- **A política tem uma tabela própria**, fora da matriz de rotas: cada estado × cada classe de mudança × dono, narrador e ex-membro, nos três sistemas (`policy.test.ts` na API, Etapa 5). A matriz de rotas diz quem chega à rota; a tabela diz o que passa dentro dela.
- **O dado alheio não está no corpo.** Para cada rota de ficha, um teste confere que nenhum valor da ficha de outro jogador aparece na resposta ao jogador, nem na contagem (§7 da proposta), não só que a tela não mostra.
- **Postgres de verdade.** O PGLite tem uma conexão só. Três testes novos no job `postgres` do CI, no molde do `events.pg.test.ts`: concluir a criação contra um lote de Evoluir (Etapa 5), criar ficha e lote contra a remoção (Etapa 7), e operações em grupo concorrentes, inclusive o reenvio simultâneo da mesma chave (Etapa 11).
- **Property tests** (`fast-check`) para o `classifyChange` (Etapa 4) e para aplicar e reverter (Etapa 10).
- **Nenhum `if (system === ...)`.** O `scripts/check-system-names.mjs` continua no CI. As regras de alerta, dano em grupo e recuperação passam no fixture de D&D com o mesmo código (princípio 1 da proposta).
- **Regressão.** As três jornadas de ficha rodam em todo PR, sem edição: as fichas delas ficam em `creating`. O que pode mudar é o que §3.2 muda de propósito (a contagem de fichas na lista de crônicas), e o PR que mexer numa jornada diz por quê.

---

## 5. Etapas

### Marco A. Pré-requisitos (entrega 0)

#### Etapa 1. Fechar o PR #30

P · depende de: nada · §3.1 da proposta

**Objetivo.** O painel se apoia no `dock` e nos campos de Experiência dos três templates do PR #30. Nada da v3 começa sobre uma base vermelha.

**Entrega.**

- O `test:coverage` do `@tms/sheet-core` verde (a mudança local em `validate-sheet.test.ts` é a candidata).
- A `journey-mage.spec.ts` verde no WebKit, e as três jornadas juntas no mesmo job, duas vezes seguidas, para descartar instabilidade.
- O job do Postgres real rodando até o fim.
- O merge na `main`. A v3 sai de uma branch nova a partir dela.

**Pronto quando.** O CI da `main` está verde com `vtm-v20` 1.3.0, `mta-m20` 1.2.0 e `wta-w20` 1.2.0.

#### Etapa 2. Jogador vê só as próprias fichas

M · depende de: 1 · §3.2 da proposta

**Objetivo.** O jogador só tem acesso às fichas dele; o narrador vê todas.

**Entrega.**

- `characterAccess` não dá mais `player`: outro membro fica sem papel, e a função devolve `null`. As rotas `GET /characters/:id`, `GET /characters/:id/history` e `GET /characters/:id/rolls` respondem 404 a ele.
- `GET /chronicles/:id/characters` devolve ao jogador só as fichas dele; ao narrador, todas.
- O `characterCount` de `GET /chronicles` conta só o que quem pergunta vê.
- Core: a seção sem `permissions` passa a valer "dono e narrador leem e escrevem". O comentário de `permissions.ts` e o README do template mudam junto.
- O papel `player` sai do `REGISTRY.roles`, do `schema.json` e do README (§7, decisão 2). O `ROLES` de `apps/frontend/lib/persist.tsx` também.
- **Papel na crônica e papel na ficha viram tipos diferentes.** Hoje o `chronicleRoles` devolve um `Set<RoleName>`, o mesmo tipo dos papéis da ficha, e as rotas decidem por `roles.size > 0`. Sem `player` no core, isso não compila, e é bom que não compile:
  - `chronicleAccess(db, userId, chronicleId)` na API devolve um `ChronicleRole`: `'storyteller' | 'member' | null` (o `former` entra na Etapa 7);
  - cada rota que hoje usa `roles.size` passa a dizer quais valores aceita (criar ficha, aceitar convite, ler a crônica, a Mesa, os convites);
  - o `RoleName` do core fica só com os papéis da ficha (`owner`, `storyteller`);
  - o `role: 'player'` das respostas de crônica (`GET /chronicles`, `GET /chronicles/:id`, o aceite do convite) é o rótulo da crônica para o app e continua igual.
- App: a tela da crônica mostra ao jogador só os personagens dele (`CharacterList`).

**Testes.**

- matriz: `player` espera 404 nas três rotas de ficha, e a lista da crônica, 200 só com as fichas dele;
- nenhum valor da ficha do outro jogador no corpo de nenhuma resposta (lista, ficha, histórico, rolagens), nem na contagem;
- os testes "o jogador nunca recebe as Notas do Narrador" (`mage.test.ts`, `werewolf.test.ts`, `events.test.ts`) se dividem. Só o outro jogador passa a receber 404. O **dono** continua recebendo 200 na ficha e no histórico, sem as notas no corpo, e continua recebendo 403 ao gravá-las. Essa metade não sai: ela é a única prova de que a seção do narrador some para quem lê a ficha;
- `canRead` de uma seção sem `permissions` com papel desconhecido: falso (fail secure continua);
- um template com `"player"` em `permissions` é recusado nas duas camadas.

**Pronto quando.** O passo 6 do §1 vale pela API.

#### Etapa 3. Matriz de AuthZ nos três sistemas

M · depende de: 2 · §3.3 da proposta

**Objetivo.** O painel acrescenta dezenas de casos. Parametrizar antes evita escrever cada um três vezes.

**Entrega.**

- `authz.test.ts`: o cenário recebe o sistema e roda a matriz inteira com `vtm-v20`, `mta-m20` e `wta-w20`.
- O corpo de cada linha que cita campo (`/events`, `/rolls`) sai de uma tabela por sistema, sem nome de sistema na matriz: o campo de texto da identidade e os slots de uma rolagem sem custo vêm do template e da ficha de exemplo.
- O segredo das Notas do Narrador entra na matriz, por sistema: o narrador grava uma nota com uma marca única. Nas linhas de leitura (`GET /characters/:id`, `/history`, `/rolls`, a lista da crônica), o 200 do dono **não pode conter a marca** no corpo, e o 404 do outro jogador também não. Nas linhas de escrita, o dono gravando a seção do narrador dá 403.
- Só depois disso sai do `mage.test.ts` e do `werewolf.test.ts` o que a matriz passou a cobrir (o outro jogador e as Notas, para o dono e para o outro). O que é do sistema (roda, forma) fica.

**Testes.** A própria matriz, nos três sistemas. O tempo do job de testes da API não pode dobrar: o cenário é montado uma vez por sistema e ator, e a linha que muda estado (excluir) monta o dela.

**Pronto quando, Marco A.** A matriz roda nos três sistemas, e o jogador recebe 404 em toda ficha alheia.

### Marco B. Política (entrega 1)

#### Etapa 4. Core: `classifyChange` e a tabela da política

M · depende de: 1 · 5.1 da proposta

**Objetivo.** Saber, para cada parte de um valor que mudou, se é jogo, evolução ou edição. O tipo do campo decide; o template não diz nada novo além do `editableIn` que já existe.

**Dois princípios.**

1. **Classificar o efeito, não o evento.** O valor gravado não basta. O `spend` grava o `stored` efetivo, então o primeiro gasto de FdV numa ficha sem FdV gravada vai de `null` a `{ current: 6, permanent: 7 }`: comparar `from` e `to` brutos leria "permanente subiu". E um evento pode mudar outro campo sem tocá-lo: trocar a tribo muda a FdV permanente padrão do Lobisomem (`default` por `map`), e mudar Consciência muda a Humanidade padrão do Vampiro. Por isso a classificação compara a ficha **resolvida** antes e depois do lote, campo a campo, no formato `stored` que o `withEffectiveFrom` já usa. Os campos derivados (`readOnly`) ficam de fora, porque a classe vem das fontes deles.
2. **Na dúvida, `advance`.** Uma parte que a tabela abaixo não cita é `advance`. Um tipo novo no registry sem classificador quebra o build, como o `CLOCK_RULES`.

A detecção de conflito não muda: ela continua no `applyBatch`, com o `from` **bruto**. A classificação é um passo à parte, que só lê.

**Entrega** (`packages/sheet-core/src/`):

- Um `classify(field, before, after)` por tipo, no registry de campos, que devolve uma classe por parte que mudou. Os valores comparados são os efetivos:

  | Tipo | `play` | `edit` | `advance` |
  |---|---|---|---|
  | `resource` | `current`, `temp` | – | `permanent`, `max` guardado |
  | `track` (`wod-stacking` e `boxes`) | contagens e caixas | – | – |
  | `clock` | casas de cada preenchimento | – | – |
  | `state` | a opção | – | – |
  | `slots` | `used` de cada nível | – | `max` de cada nível; nível novo |
  | `rating`, `number`, `percent` | o valor, só com `editableIn: ["play"]` (a Inspiração do D&D) | – | o valor (Atributo, Posto, `xpTotal`, o nível do D&D) |
  | `mark` | o estado, só com `editableIn: ["play"]` | – | o estado (proficiência do D&D) |
  | `tags` | as marcas, só com `editableIn: ["play"]` (Condições) | – | as marcas |
  | `choice` | – | a opção | – |
  | `text`, `longText` | – | o texto | – |
  | especialização (`specialties.*` e `specialty` de um item) | – | o texto | – |
  | `list`, por item | com `editableIn: ["play"]`: tudo, menos o `value` (a quantidade do inventário do D&D) | sem `editableIn: ["play"]`: `name`, `text`, `notes`, a ordem, `meta` de texto | `value`, sempre; sem `editableIn: ["play"]`, também o `meta` numérico (o Posto de um Dom, `meta.rank`) e incluir ou remover um item que tem `value` ou `meta` numérico |
  | `list`, item sem nada numérico (Rotinas, Cicatrizes) | incluir ou remover, com `editableIn: ["play"]` (Consequências do Fate) | incluir ou remover | – |

- `classifyBatch(model, before, events)`: aplica os eventos numa cópia, resolve as duas fichas, classifica cada campo cujo valor efetivo mudou e devolve as partes com classe e caminho (`values.willpower#permanent`), mais a classe mais restrita (`advance` > `edit` > `play`). Uma mudança num campo que o lote não citou (a FdV pela tribo) vem com o caminho do campo afetado; o 403 traz esses caminhos e os do lote, para o app marcar o que foi recusado.
- O fixture de D&D ganha `editableIn: ["play"]` no Ouro e no inventário (§7, decisão 16).
- A tabela da política, pura, sem banco (§7, decisão 1): `writePolicy({ owner, storyteller, member }, status, locked, classes)` devolve `ok` ou o código de recusa (`SHEET_LOCKED`, `SHEET_NOT_EDITABLE`, `NEEDS_XP_APPROVAL`, `NOT_MEMBER`; §7, decisão 18). Os estados da v3 são `creating`, `active`, `archived` e `dead`; `pending` chega na v4.

**Testes.**

- a tabela acima, linha por linha, com um caso de `advance` recusado em `active` para cada tipo que tem `advance`:
  - FdV: só o temporário é `play`; o permanente, `advance`; os dois juntos, `advance`;
  - Dons do Lobisomem: incluir um Dom, mudar o `meta.rank` de 1 para 2 e remover um Dom são `advance`; mudar as notas é `edit`;
  - Disciplina do Vampiro: subir o `value` é `advance`; trocar a especialização do item é `edit`;
  - D&D: `slots` com `used` é `play` e com `max` é `advance`; a proficiência (`mark`) é `advance`; as Condições (`tags` com `play`) são `play`; o PV com `temp` é `play` e com `max` guardado é `advance`;
- **valores efetivos:**
  - ficha sem FdV gravada, primeiro gasto: `null → { current: 6, permanent: 7 }` com permanente padrão 7 é só `play`;
  - Lobisomem sem FdV gravada: trocar a tribo para uma de FdV padrão diferente é `advance` (no campo `willpower`); com a FdV já gravada, é só `edit`;
  - Vampiro sem Humanidade gravada: subir Consciência dá `advance` em dois campos;
- a mesma tabela no fixture de CoC (`percent`, `tags`);
- tabela da política: cada linha da tabela do 5.1, com o código de recusa esperado;
- propriedades:
  - todo lote que muda o valor efetivo de algum campo gerado de uma ficha válida tem ao menos uma classe;
  - um lote sem efeito (o `to` igual ao efetivo) não tem classe;
  - a classe do lote invertido é a mesma do original;
  - `classifyBatch` não muda nada: a ficha de entrada é a mesma depois.

#### Etapa 5. Estados, política no servidor e `chronicle_audit`

G · depende de: 3, 4 · 5.1 da proposta

**Objetivo.** Uma política de escrita só (princípio 3), avaliada no momento em que o lote chega.

**Entrega.**

- Migração `0014_character_status`:
  - `characters`: `status` (texto, `check` com os quatro estados da v3, padrão `creating`), `locked_at`, `creation_completed_at` e `creation_completed_by` (FK com `on delete set null`, como a `0013`);
  - `chronicle_audit`: `id`, `chronicle_id` (cascata), `actor_id` (`set null`), `action`, `target_character_id`, `target_user_id`, `payload` jsonb mínimo, `created_at`. Nada de conteúdo de notas no `payload`;
  - as fichas que já existem ficam em `creating`, que é o comportamento de hoje.
- `npx pnpm db:codegen` e o `@tms/db` reconstruído.
- `/events`: dentro da transação, depois do `FOR UPDATE`, relê `status`, `locked_at` e o vínculo na crônica (leitura simples, sem travar o vínculo; o protocolo está na Etapa 7). Então:
  - o `applyBatch`, como hoje: forma, permissão por campo, conflito pelo `from` bruto e `validateSheet`;
  - com o lote aceito, `classifyBatch(model, current, events)` sobre a ficha travada e `writePolicy`;
  - recusa da política: 403 com `{ code, paths }`, e o lote inteiro cai.
  A ordem importa: um lote em conflito volta 409 com o valor atual, como hoje, e só um lote que aplicaria passa pela política.
- `/rolls`: com custo (`plan.events` não vazio), a mesma política dentro da transação, antes de rolar, com o `classifyBatch` sobre a ficha travada (o primeiro gasto de FdV também passa por aqui). Sem custo, rola em `active` mesmo travada (decisão 10). O ex-membro recebe 403 `NOT_MEMBER` nos dois casos.
- `characterAccess`: o dono sem vínculo continua com `owner`, mas a política o trata como ex-membro.
- Rotas do narrador, cada uma numa transação com a ficha travada e **uma** linha no `chronicle_audit`:
  - `POST /characters/:id/creation/complete`: exige `creating`, grava `active`, `creation_completed_at` e `creation_completed_by`. Já concluída: 409 "criação já concluída", sem linha nova;
  - `POST /characters/:id/status` com `active`, `archived` ou `dead`. Voltar para `creating` não existe (422). Sair de `active` limpa a trava (§7, decisão 6);
  - `POST /characters/:id/lock` e `DELETE /characters/:id/lock`, só em `active` (fora dele, 409).
- `DELETE /characters/:id` passa pela política (§7, decisão 5) e entra no `chronicle_audit`.
- `GET /characters/:id` e `GET /chronicles/:id/table` devolvem `status` e `lockedAt`.

**Testes** (API, PGLite, nos três sistemas):

- os critérios de aceite do 5.1:
  - o dono gasta FdV temporária em `active`; não sobe a FdV permanente; um evento que faz as duas coisas é recusado inteiro;
  - o narrador conclui uma ficha **sem FdV gravada**, e o primeiro gasto do dono (`from: null`, `to` com o permanente padrão materializado) é aceito; o mesmo pela rolagem com custo;
  - em `active`, o dono do Lobisomem sem FdV gravada troca a tribo e recebe `NEEDS_XP_APPROVAL` (a FdV padrão mudaria);
  - o dono sobe um `rating` em `creating` e não em `active`;
  - o dono não rola com custo numa ficha travada, e rola sem custo;
  - o ex-membro lê a ficha arquivada e recebe 403 em `/events` e em `/rolls` (o ex-membro chega de verdade na Etapa 7; aqui, o vínculo apagado direto no banco);
  - um lote de Evoluir criado em `creating` e enviado depois da conclusão é recusado com `NEEDS_XP_APPROVAL` (§7, decisão 18), e a ficha não muda; um lote qualquer do dono numa ficha arquivada, com `SHEET_NOT_EDITABLE`;
  - um gasto de FdV enviado depois da trava é recusado com `SHEET_LOCKED`;
  - concluir duas vezes dá 409, e só há uma linha no `chronicle_audit`;
  - o narrador escreve em todos os estados;
  - cada ação administrativa gera exatamente uma linha em `chronicle_audit`;
- `policy.test.ts`: a tabela inteira (§4);
- o 403 traz o `code` e o `path` recusado, e nunca o valor;
- matriz: as quatro rotas novas, com `storyteller` 200 e os demais 403 ou 404;
- `@tms/db`: a `0014` sobe e desce;
- **Postgres real** (`apps/api/src/__tests__/policy.pg.test.ts`, no job `postgres`): concluir e um lote de Evoluir ao mesmo tempo. Ou o lote entra antes e a conclusão vê o valor novo, ou é recusado; nunca entra depois.

#### Etapa 6. App: estados, recusa com motivo e as ações do narrador

M · depende de: 5

**Objetivo.** O jogador sabe por que a alteração foi desfeita, e o narrador conclui, trava e arquiva pela tela.

**Entrega.**

- `rejectionMessage` recebe o corpo e troca o 403 genérico por uma frase por código:
  - `SHEET_LOCKED`: "O narrador travou a ficha. A alteração foi desfeita.";
  - `SHEET_NOT_EDITABLE`: "A ficha está arquivada ou fora de jogo: só o narrador muda isto agora. A alteração foi desfeita.";
  - `NEEDS_XP_APPROVAL`: "Depois da criação, subir um traço passa pelo narrador. A alteração foi desfeita.";
  - `NOT_MEMBER`: "Você saiu desta crônica: a ficha é só leitura. A alteração foi desfeita.";
  - sem código, ou com `FORBIDDEN`, a frase de hoje.
- A rolagem (`useDice`) usa as mesmas frases. Sem rede, a rolagem com custo continua no aparelho e o custo vai pela fila; a recusa chega pelo mesmo caminho.
- A ficha usa `writePolicy` só para desabilitar o que o servidor vai recusar, com o motivo no lugar: em `active`, os steppers de `rating` em Evoluir ficam desabilitados ("Peça ao narrador"), e texto e especialização continuam editáveis; travada, o Jogo fica em Leitura com um aviso. O servidor continua a autoridade.
- Narrador, no menu ⋯ da ficha: "Concluir criação" (em `creating`), "Travar" e "Destravar" (em `active`), "Arquivar", "Marcar como" o rótulo de `dead` do template, e "Reativar". Arquivar e `dead` pedem confirmação.
- O rótulo de `dead` vem do template (§7, decisão 7).

**Testes** (Jest + RNTL):

- cada código de recusa vira a frase certa, no toast da fila e no sheet de Dados;
- em `active`, o stepper de Força em Evoluir está desabilitado com o motivo, e o campo Conceito não;
- travada: o dock não abre o sheet de gasto, e o motivo é anunciado ao leitor de tela;
- o menu do narrador mostra só as ações válidas no estado; o do dono, nenhuma delas;
- o fixture de D&D mostra o mesmo menu, com o rótulo de `dead` dele.

**Pronto quando, Marco B.** Os passos 2 e 4 do §1 rodam no app.

### Marco C. Membros (entrega 2)

#### Etapa 7. Remover jogador, sair e o ex-membro

G · depende de: 5, 6 · 5.2 da proposta, sem a transferência

**Objetivo.** Tirar alguém da mesa, ou sair dela, sem apagar nada e sem deixar escrita para trás.

**Entrega.**

**Protocolo de trava do vínculo.** Remover protege as fichas que existem, mas uma criação concorrente pode conferir o vínculo, esperar a remoção terminar e inserir uma ficha em `creating` de quem já saiu. Por isso, toda transação que depende do vínculo segue uma ordem só: **primeiro a linha de `chronicle_members`, depois as fichas, em ordem de `id`**.

| Operação | O que trava, nesta ordem | Revalida |
|---|---|---|
| Criar ficha (membro) | o vínculo, `FOR UPDATE` | sem linha → 403 `NOT_MEMBER`; o limite de 20 fichas é contado dentro da transação |
| Remover ou sair | o vínculo, `FOR UPDATE`; depois as fichas da pessoa na crônica, `FOR UPDATE`, em ordem de `id` | sem linha → 404. As fichas são lidas **depois** da trava do vínculo, então incluem a de uma criação que terminou antes |
| `/events`, `/rolls`, operações em grupo | só as fichas; o vínculo é lido sem trava, depois | sem vínculo → `NOT_MEMBER` (Etapa 5) |

Não há ciclo: quem trava o vínculo trava as fichas depois, e quem trava uma ficha nunca espera pelo vínculo. A remoção só apaga o vínculo depois de travar as fichas, então um lote que já tem a ficha vê o vínculo de antes e entra antes da remoção. A trava do vínculo na criação também fecha a corrida de hoje entre duas criações no limite de 20 fichas. A criação pelo narrador não tem vínculo para travar, e o narrador não pode ser removido.

**Entrega.**

- `DELETE /chronicles/:id/members/:userId` (só o narrador, com confirmação no app) e `DELETE /chronicles/:id/members/me` (só o próprio membro). Numa transação, pelo protocolo acima:
  - trava o vínculo e depois as fichas da pessoa na crônica;
  - passa todas para `archived` (limpando a trava);
  - apaga o vínculo;
  - grava uma linha no `chronicle_audit` por ação (remover ou sair), com as fichas no `payload`.
- O narrador não está em `chronicle_members`: `/members/<id do narrador>` dá 404, e `/members/me` do narrador dá 403 ("o narrador só deixa de narrar transferindo", v5).
- `POST /chronicles/:id/characters` passa a usar o protocolo: só `storyteller` e `member` criam.
- **O `former` é um valor próprio do `ChronicleRole`** (Etapa 2), nunca um membro: quem não é membro nem narrador, mas tem ficha não excluída na crônica. Cada rota diz o que faz com ele:

  | Rota | `member` | `former` |
  |---|---|---|
  | `GET /chronicles` | `role: 'player'` | `role: 'former'`; `characterCount`, só as fichas dele |
  | `GET /chronicles/:id` | como hoje, com os membros | 200 com nome, sistema, narrador e `role: 'former'`; sem `members` |
  | `GET /chronicles/:id/characters` | só as fichas dele | só as fichas dele |
  | `POST /chronicles/:id/characters` | 201 | 403 `NOT_MEMBER`. Ele sabe que a crônica existe, e o motivo vai para a tela |
  | `POST /invites/accept` | já participa: devolve a crônica e não gasta uso | **volta a ser membro**: grava o vínculo e gasta um uso. As fichas continuam `archived` até o narrador reativar (§7, decisão 4) |
  | Mesa, convites, membros | como hoje (404 na Mesa, 403 nos convites) | 404, a mesma resposta de quem não tem vínculo |
  | `GET /characters/:id` da ficha dele | 200 | 200, com `member: false` |
  | `GET /characters/:id` de outra ficha | 404 | 404 |

- **O que chega ao app.** `GET /characters/:id` passa a devolver `status`, `lockedAt` e `member` (a pessoa é membro ou narrador da crônica agora), além dos `roles` de hoje. O app calcula com isso o mesmo `writePolicy` do servidor, só para desabilitar o que vai ser recusado. A lista e a tela da crônica leem o `role`: com `former`, não há "Nova ficha", Mesa, convites nem membros, e o aviso "Você saiu" aparece no topo.
- Convites: a lista mostra os usos restantes e a expiração. Remover pergunta se revoga os convites ativos (§7, decisão 4).
- App:
  - lista de membros na crônica do narrador, com as fichas de cada um e a data de entrada, e "Remover" com confirmação;
  - "Sair da crônica" para o jogador, com confirmação;
  - a crônica do ex-membro marcada "Você saiu", com as fichas dele em Leitura.

**Testes.**

- remover: as fichas vão para `archived`, o vínculo sai e há uma linha no `chronicle_audit`; o ex-membro lê a ficha e recebe 403 `NOT_MEMBER` em `/events` e `/rolls`;
- sair: o mesmo efeito, pelo próprio membro;
- o narrador não remove a si mesmo nem sai;
- `former` criando ficha: 403 `NOT_MEMBER`, e nenhuma linha nova em `characters`;
- `former` aceitando um convite válido: vira membro, o convite gasta um uso, e as fichas continuam `archived`;
- matriz: as duas rotas novas, com o ator `former` em todas as linhas (Mesa, convites, membros, criar ficha, ficha dele, ficha alheia);
- o `former` não recebe a lista de membros nem a ficha de ninguém além das dele, no corpo de nenhuma resposta;
- **Postgres real** (`apps/api/src/__tests__/members.pg.test.ts`, no job `postgres`):
  - criar ficha e remover a mesma pessoa ao mesmo tempo: ou a ficha nasce antes e sai `archived`, ou a criação dá 403 `NOT_MEMBER`. Nunca sobra uma ficha `creating` de quem não é membro;
  - um lote do jogador e a remoção ao mesmo tempo: ou o lote entra antes, ou é recusado com `NOT_MEMBER`;
  - duas criações da mesma pessoa com 19 fichas: só uma passa;
  - nenhum dos três termina em deadlock;
- app: a crônica "Você saiu" abre só as fichas do ex-membro, em Leitura, sem "Nova ficha".

**Pronto quando, Marco C.** O passo 5 do §1 roda no app.

### Marco D. Mesa (entrega 3)

#### Etapa 8. Template e core: `alerts`

M · depende de: 1 · 5.3 da proposta

**Objetivo.** O template diz quando uma linha da Mesa merece atenção; o painel só pinta.

**Entrega.**

- Chave `alerts` no template, nas duas camadas e no README: uma lista de `{ id, label, rule, field, ... }`, com `rule` de uma lista fechada nova, `REGISTRY.alertRules` (§7, decisão 8):
  - `track-at-level`: a trilha marcada até o nível `level` (Incapacitado é o último nível);
  - `resource-at-most`: a parte `current` de um recurso em `value` ou menos (FdV zerada é `value: 0`);
  - `resource-below-share`: abaixo de uma fração do máximo (o PV do D&D abaixo da metade).
- `alertsOf(model, sheet)` no core: os alertas ativos, a partir do `resolve`, com o rótulo do template.
- Os três templates ganham Incapacitado e FdV zerada; o Vampiro, Sangue em 0; o Mago e o Lobisomem, o que o dock deles mostra. A versão de cada template sobe (§7, decisão 9).
- O fixture de D&D ganha PV abaixo da metade.

**Testes.**

- `alertsOf` nas fichas de exemplo no limite (as da v1 e da v2: roda cheia, Vitalidade ferida com agravado, Fúria 0);
- um `alerts` com regra fora da lista, campo que não existe ou tipo errado (`track-at-level` num `resource`) é recusado nas duas camadas;
- o mesmo `alertsOf` no fixture de D&D;
- o `alertsOf` não lê campo que o papel não lê (um alerta sobre um campo das Notas do Narrador não existe para o dono).

#### Etapa 9. Mesa com alertas

M · depende de: 2, 8 · 5.3 da proposta

**Objetivo.** No meio da cena, a narradora sabe quem está mal sem abrir quatro fichas.

**Entrega.**

- Na linha da Mesa (`TableView.tsx`): os alertas ativos como selo, com o nome acessível do template; o estado da ficha ("Em criação", "Travada").
- A Mesa mostra `creating` e `active`; `archived` e `dead` somem, com um filtro para vê-los. O filtro é no servidor (`?status=`), para a resposta não levar o que a tela esconde.
- Ordenar por nome e por última alteração; filtrar "só com alerta" e por estado.
- Navegar entre as fichas em Leitura, deslizando (C-19 do `avaliacao-ui-ux.md`), na ordem da Mesa.
- "Atualizado há 2 min" no topo, e o puxar ao focar que já existe (`useRefetchOnFocus`).

**Testes.**

- a linha com Incapacitado mostra o selo e o anuncia; sem alerta, nada;
- arquivar uma ficha a tira da Mesa, e o filtro a traz de volta;
- deslizar vai para a próxima ficha da Mesa, na ordem escolhida;
- a Mesa do fixture de D&D mostra o alerta de PV pelo mesmo código;
- **contagem de render:** mudar o filtro não re-renderiza as linhas que continuam.

**Pronto quando, Marco D.** A Mesa da jornada mostra Incapacitado e FdV zerada sem abrir ficha.

### Marco E. Operações (entrega 4)

#### Etapa 10. Core: `invertBatch` e o dano em grupo

M · depende de: 4 · 5.4 da proposta

**Objetivo.** Planejar uma operação sobre várias fichas e sua reversão como funções puras.

**Entrega** (`packages/sheet-core/src/`):

- `planGroupDamage(model, sheet, { kind, type, amount })`: o lote de uma ficha, com dano ou cura. O campo-alvo vem do tipo, não do sistema (§7, decisão 10): a trilha `wod-stacking` usa o `planDamage` que já existe; o recurso com `defaultAction: "damage1"` usa o `takeDamage`. Sem alvo, a ficha fica indisponível, com o motivo.
- `invertBatch(model, sheet, events)`: os eventos inversos, a partir do `invert` que já existe, mais:
  - um evento de tipo sem conteúdo no histórico (texto, texto longo, especialização) torna o lote não reversível;
  - o valor atual de cada caminho precisa ser o `to` original; senão, recusa com a lista de caminhos em conflito. Nada de reversão parcial;
  - o caminho que estava vazio antes volta a ficar vazio (§7, decisão 3).
- `isReversible(model, events)`, para o app decidir se mostra "Desfazer".

**Testes.**

- tabela: 2 letais na Vitalidade, cura contusiva, dano no PV do D&D com temporário;
- propriedades com `fast-check`, sobre fichas válidas:
  - aplicar e reverter devolve a ficha original, byte a byte, quando não há conflito;
  - o lote invertido passa no `validateSheet`;
  - qualquer mudança posterior num caminho da operação faz a reversão recusar, com aquele caminho;
- um lote com texto não é reversível; um lote só de recursos e trilhas é.

#### Etapa 11. Operações em grupo e reversão no servidor

G · depende de: 5, 10 · 5.4 da proposta

**Objetivo.** O contrato da operação do 5.4: idempotente, atômica, com bloqueio ordenado.

**Entrega.**

- Migração `0015_chronicle_operations`:
  - `chronicle_operations` (`id`, `chronicle_id`, `client_operation_id`, `kind`, `created_by`, `created_at`, `reverts_operation_id`, `reverts_batch_id`), com `client_operation_id` único por crônica e um `check` de que `reverts_operation_id` e `reverts_batch_id` nunca vêm juntos;
  - `operation_id` em `character_batches`;
  - `from_absent` em `character_events` (§7, decisão 3).
- `POST /chronicles/:id/operations/preview`: por ficha, os eventos e a `sheetVersion` lida. Não grava nada.
- `POST /chronicles/:id/operations` com `clientOperationId`, os alvos e a `sheetVersion` esperada de cada um:
  - as fichas são travadas com `FOR UPDATE` em ordem de `id`, sempre;
  - **depois** das travas, a idempotência: se já há operação com a mesma `client_operation_id` na crônica, a resposta é o resultado original (`duplicate: true`) e nada se aplica. Dois reenvios simultâneos da mesma chave travam as mesmas fichas, então o segundo só confere depois de o primeiro gravar. O índice único é a última barreira: uma violação dele vira a mesma resposta `duplicate: true`, nunca um 500;
  - qualquer `sheetVersion` diferente: 409 com a prévia nova, e nada muda;
  - cada lote passa pelo `applyBatch` e pela política da Etapa 5; uma ficha recusada recusa a operação inteira;
  - ficha de outra crônica, excluída ou inexistente na lista: 404, e nada muda (IDOR);
  - um lote por ficha, com `by_role: 'storyteller'` e o `operation_id`.
- Reverter é o mesmo `POST`, com `kind: 'revert'` e o alvo (`revertsOperationId` ou `revertsBatchId`). Mesmo contrato, mais o `invertBatch` em cada ficha. Só o narrador.
- O histórico da ficha passa a dizer, por lote, `operationId` e `reversible` (falso se tem evento sem conteúdo, se é uma reversão ou se já foi revertido).

**Testes** (API, PGLite):

- os critérios de aceite do 5.4:
  - reenviar a mesma operação (resposta perdida) aplica uma vez;
  - uma ficha alterada entre a prévia e a aplicação dá 409, e nenhuma ficha muda;
  - uma ficha de outra crônica no meio da lista dá 404, e nenhuma ficha muda;
  - reverter depois de o jogador gastar o mesmo recurso é recusado com o campo em conflito;
- reverter duas vezes a mesma operação dá 409 na segunda (§7, decisão 11);
- reverter um lote comum de uma ficha (o gasto de FdV de uma rolagem) funciona; um lote com texto, 422;
- a operação sobre uma ficha arquivada passa (o narrador escreve em todos os estados); sobre a ficha de um jogador que acabou de sair, também;
- matriz: as duas rotas, só o narrador;
- `@tms/db`: a `0015` sobe e desce;
- **Postgres real** (`apps/api/src/__tests__/operations.pg.test.ts`), três cenários separados, todos sem deadlock:
  - **mesma prévia, chaves diferentes:** duas operações enviadas com as mesmas `sheetVersion` esperadas. Uma aplica; a outra recebe 409 com a prévia nova, e nenhuma ficha muda por ela;
  - **nova prévia e nova confirmação:** a perdedora do cenário anterior confirma de novo com a prévia do 409 e aplica. As fichas terminam com o efeito das duas, uma depois da outra;
  - **mesma chave, ao mesmo tempo:** dois envios da mesma `clientOperationId`. Um aplica, o outro devolve `duplicate: true` com o mesmo resultado, e há uma linha em `chronicle_operations` e um lote por ficha;
  - e, como controle, duas operações sobre conjuntos de fichas que se cruzam (A, B e B, C), em ordens diferentes na lista enviada: ambas terminam, e a trava por `id` evita o deadlock.

#### Etapa 12. App: ações em grupo e Desfazer

M · depende de: 6, 11

**Objetivo.** "A explosão causa 3 níveis letais em todos" vira um toque, com prévia e Desfazer.

**Entrega.**

- Na Mesa, selecionar personagens e "Aplicar dano" ou "Curar": o tipo vem dos `types` da trilha do template; a quantidade, de um stepper.
- A prévia por personagem, com o texto do `describeEvent` ("Vitalidade: 2 letais → Ferido"), antes de confirmar.
- Confirmar manda a operação com um `clientOperationId` gerado no aparelho; um 409 mostra a prévia nova e pede para confirmar de novo.
- O toast de 5 s com "Desfazer" (o mesmo `Toast`) chama a reversão da operação. O conflito aparece com os campos ("Vitalidade de Caio mudou depois; edite à mão").
- No histórico da ficha, "Desfazer" nos lotes com `reversible`, só para o narrador.
- A operação não entra na fila offline: sem rede, o botão fica desabilitado com o motivo. É uma escrita de várias fichas que só faz sentido com a prévia atual.

**Testes.**

- selecionar dois personagens, 2 letais, confirmar: um pedido, a Mesa atualiza as duas linhas;
- o toast de Desfazer reverte, e a Mesa volta;
- o 409 da prévia vencida mostra a prévia nova;
- o histórico mostra "Desfazer" só nos lotes reversíveis, e só ao narrador;
- o fixture de D&D aplica dano no PV pelo mesmo fluxo.

#### Etapa 13. Recuperações por período

M · depende de: 11, 12 · **linha de corte:** a jornada do §1 e os critérios do 5.4 não dependem desta etapa. Se o prazo apertar, ela vira v3.1 sem mexer no resto.

**Objetivo.** "Nova noite", "Novo dia", "Fim da história" com prévia por personagem.

**Entrega.**

- Chave `recoveries` no template, nas duas camadas e no README: `{ id, label, help, effects }`, com os efeitos da lista fechada `REGISTRY.effects` (§7, decisão 12).
- Os três templates declaram as suas; o conteúdo (o que cada período recupera) é conferido no livro antes de entrar, como as tabelas da v4.
- No core, `planRecovery(model, sheet, recoveryId)` usa o `planAction` que já existe para cada efeito.
- Na Mesa, "Nova noite" (o rótulo do template) aplica a todos os personagens selecionados como uma operação da Etapa 11, `kind: 'recovery'`, com prévia e Desfazer.

**Testes.**

- a prévia de cada recuperação nas fichas de exemplo;
- uma recuperação com efeito fora da lista é recusada nas duas camadas;
- o fixture de D&D com `rest.long` implementado pelo mesmo caminho, ou indisponível com o motivo, se o efeito ainda não tiver implementação (`IMPLEMENTED_EFFECTS`).

**Pronto quando, Marco E.** O passo 3 do §1 roda no app, e os critérios do 5.4 estão verdes, inclusive no Postgres real.

### Marco F. Fechamento

#### Etapa 14. Jornada do narrador e fechamento da v3

M · depende de: todas

**Entrega.**

- `e2e/tests/journey-storyteller.spec.ts`: a jornada do §1, num único cenário, em Chromium e WebKit, com três contextos (narrador, jogadora A, jogador B).
  - Passo 5: a página da jogadora removida estava aberta antes da remoção. Sem recarregar, ela gasta FdV e rola com custo; as duas coisas voltam com 403 `NOT_MEMBER` e a frase na tela. Ao voltar para a lista, a crônica aparece marcada "Você saiu", e a ficha abre em Leitura.
  - Passo 6: em cada passo, a jornada confere pela API (`apiAs`) que o jogador B recebe 404 na ficha da jogadora A, e que a lista da crônica dele só tem a ficha dele.
- As três jornadas de ficha rodam junto, sem mudança.
- Maestro: um fluxo novo, `07-storyteller-table`: abrir a Mesa, aplicar dano em dois personagens e Desfazer.
- Documentação:
  - `painel-narrador.md`: as entregas 0 a 4 marcadas como feitas, com o que mudou em relação a este plano;
  - o README do template: `alerts` e `recoveries`, e a seção sem `permissions`;
  - `CLAUDE.md`: as contagens de testes por pacote, a quarta jornada e os três testes novos do Postgres real (`policy`, `members` e `operations`);
  - `doc/database.dbml`: as colunas e tabelas novas.
- O checklist de segurança da v0 revisto para a v3. A v3 cria superfície nova (oito rotas, o papel `former`, uma tabela com dado de quem fez o quê), e o checklist registra cada uma.

**Pronto quando.** As quatro jornadas passam no CI, e uma crônica dos três sistemas é administrada inteira pelo app e pelo web.

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| A política ver um estado velho (lido antes da trava) e deixar passar um lote | A política roda dentro da transação, depois do `FOR UPDATE`, relendo estado, trava e vínculo (Etapa 5); o teste em Postgres real |
| Deadlock entre operações em grupo, ou entre uma operação e uma remoção | Uma ordem global de travas: o vínculo antes das fichas, e as fichas em ordem de `id` (etapas 7 e 11); quem trava uma ficha nunca espera pelo vínculo; os testes em Postgres real |
| Uma ficha nascer depois da remoção de quem a criou | A criação trava o vínculo (Etapa 7); o teste em Postgres real |
| Classificar pelo valor gravado e recusar um gasto legítimo, ou aceitar uma evolução indireta (a FdV pela tribo) | O `classifyBatch` compara a ficha resolvida antes e depois (Etapa 4); o caso do primeiro gasto e o da tribo nos testes da API |
| Fechar a leitura (§3.2) e quebrar uma tela que lia a ficha alheia | A matriz nos três sistemas (Etapa 3) e o teste de corpo; o app só lista o que a API devolve |
| Reverter e deixar a ficha diferente da original | `from_absent` e o property test byte a byte (Etapa 10) |
| O jogador perder alterações sem entender por quê | O código de recusa e a frase por código (Etapa 6); a fila continua desfazendo o lote recusado |
| O código "aprender" o WoD ao fazer alertas, dano em grupo e recuperações | Listas fechadas no registry, o fixture de D&D em cada uma, o `check-system-names.mjs` |
| A v3 crescer além do prazo | A Etapa 13 é a linha de corte; a Mesa (8 e 9) anda em paralelo e pode sair antes |
| Publicar um template novo com a API antiga em execução | Reiniciar a API depois de publicar, como na v1 e na v2 |

---

## 7. Decisões em aberto

Nenhuma reabre o §10 da proposta. São lacunas achadas ao conferir o código.

| # | Lacuna | Proposta | Precisa antes da etapa |
|---|---|---|---|
| 1 | A proposta chama a política de `canWrite(access, status, locked, classes)`, mas o core já exporta `canWrite(model, fieldId, roles)`, por campo, usado pelo `applyBatch` e pela criação de ficha | Outro nome, `writePolicy`, e no `@tms/sheet-core` (pura, sem banco), como o `applyBatch`: o servidor é a autoridade, e o app a usa só para desabilitar o que vai ser recusado | 4 |
| 2 | Com §3.2, o papel `player` não existe mais em ficha, mas continua no `REGISTRY.roles`, no `schema.json` e no README | Tirar das três fontes na Etapa 2. Nenhum template do produto nem fixture o usa. O `viewer` da v5 entra pela mesma lista, na versão dele | 2 |
| 3 | O histórico guarda o `from` **efetivo** (`withEffectiveFrom`): um campo vazio aparece com o padrão. Reverter grava o padrão explícito, e um padrão derivado (FdV permanente = Coragem) deixa de acompanhar a fonte. O property test do 5.4 falharia | `from_absent` (booleano) em `character_events`, gravado por `/events`, `recordCost` e operações. O `invertBatch` devolve `to: null` quando ele é verdadeiro. Os lotes antigos são de teste | 10 |
| 4 | O removido ainda tem convites válidos da crônica e pode voltar sozinho | A confirmação de remover tem "Revogar os convites ativos", ligada por padrão. Quem volta por convite novo entra como membro, e as fichas continuam arquivadas até o narrador reativar | 7 |
| 5 | `DELETE /characters/:id` (exclusão lógica pelo dono) não está na tabela da política | O dono exclui em `creating` e em `active` sem trava; o ex-membro, nunca (`NOT_MEMBER`); o narrador, sempre. Entra no `chronicle_audit` | 5 |
| 6 | A trava vale só em `active`, mas a proposta não diz o que acontece com ela quando a ficha sai de `active` | Mudar de estado limpa a trava na mesma transação e na mesma linha do `chronicle_audit`. Reativar volta destravada | 5 |
| 7 | O rótulo de `dead` vem do template, mas não há chave para ele | `statusLabels: { dead: "Torpor" }` no template, nas duas camadas, com "Fora de jogo" como padrão quando o template não diz. Sobe a versão junto com `alerts` (decisão 9) | 6 |
| 8 | "Alertas com a mesma lista branca das fórmulas": a lista das fórmulas (`defaults.ts`) só tem inteiro, derivação e mapa por `choice`, sem comparação | Uma lista fechada de regras de alerta (`REGISTRY.alertRules`), com parâmetros validados, como `trackRules` e `clockRules`. Nunca expressão | 8 |
| 9 | `alerts`, `statusLabels` e `recoveries` mudam os três templates, e versão publicada é imutável | Uma versão nova por template na Etapa 8, com `alerts` e `statusLabels`, e outra na 13, se ela entrar. Sem jogadores reais, as fichas de teste são recriadas pelo seed | 8 |
| 10 | "Usa as operações de trilha que o template já define" não cobre o D&D, que não tem trilha: o PV é um `resource` | O alvo do dano em grupo vem do tipo: trilha `wod-stacking` e `resource` com `defaultAction: "damage1"`. Sem chave nova no template. Uma ficha com mais de um alvo pede a escolha na prévia | 10 |
| 11 | A proposta não diz se uma reversão pode ser revertida, nem se a mesma operação pode ser revertida duas vezes | Cada operação ou lote é revertido no máximo uma vez (índice único em `reverts_operation_id` e em `reverts_batch_id`), e a reversão não é reversível. Para refazer, o narrador aplica de novo | 11 |
| 12 | `REGISTRY.effects` já tem `rest.long` e `rest.short` (o D&D os declara em `actions`), mas sem implementação; `recoveries` é chave nova | `recoveries` usa os efeitos da lista fechada, e um efeito novo (encher o temporário de um recurso até o permanente) entra no `REGISTRY.effects` com implementação. O conteúdo de cada sistema é conferido no livro | 13 |
| 13 | O `chronicle_audit` é escrito na v3, mas a leitura consolidada é da v5 (5.11) | Sem rota de leitura na v3. Os testes leem a tabela direto. O narrador vê o efeito de cada ação na própria ficha (estado, trava) | 5 |
| 14 | A proposta diz que a Aparência nasce em 0 "no Vampiro", mas a auditoria mostra o mesmo no Mago e no Lobisomem (`appearance` com `min: 0` e sem `default` nos três) | Corrigir na Etapa 1, com `"default": 1` nos três, enquanto as versões do PR #30 não foram publicadas. Senão, fica para a criação por pontos da v4, como a proposta prevê | 1 |
| 15 | O que o app oferece ao ex-membro: esconder a edição ou deixar tentar? O passo 5 da jornada pede a recusa com o motivo na tela | O app abre a ficha do ex-membro em Leitura, sem controles de edição. A recusa com o motivo aparece quando a página estava aberta antes da remoção (sem tempo real, é o caso comum), e é isso que a jornada prova | 7 |
| 16 | Na dúvida, `advance` (Etapa 4): um número que o jogo gasta sem `editableIn: ["play"]` vira evolução. No fixture de D&D, o Ouro (`number`) e a quantidade do inventário (`meta.qty` de `list`) deixariam de mudar em `active` | O template declara `editableIn: ["play"]` onde o jogo gasta, como já faz com a Inspiração e as Condições. A Etapa 4 marca o Ouro e o inventário no fixture. Os três templates do produto não têm caso assim (conferido: nenhum `rating`, `number` ou `list` deles muda em Jogo) | 4 |
| 17 | A tabela do 5.1 põe a especialização em `edit`, mas ela muda a rolagem (`tenCountsDouble`), como a proficiência do D&D, que a Etapa 4 põe em `advance` | Seguir a proposta na v3: especialização é `edit`. A diferença fica registrada, e a v4 decide com os custos de XP se ela passa a ser `advance` | 4 |
| 18 | Os critérios do 5.1 recusam o lote de Evoluir depois da conclusão com `SHEET_NOT_EDITABLE`, mas a Etapa 5 recusa a troca de tribo em `active` (o mesmo `advance`) com `NEEDS_XP_APPROVAL`, e a proposta não diz o código de `archived` e `dead` | `advance` em `active` é sempre `NEEDS_XP_APPROVAL`, o caminho do pedido de XP da v4; `SHEET_NOT_EDITABLE` é o estado sem escrita do dono (`archived`, `dead` e, na v4, `pending`). Mais `FORBIDDEN`, a rede de segurança para quem não tem papel na ficha (o servidor já devolve 404 antes) | 4 |

---

## 8. Fora da v3

- **v4, Criação e evolução** (entregas 5 a 9): contabilização dos pontos, `creation` e `costs` nos templates, o modo `create` com contadores, o estado `pending` com a aprovação opcional, o orçamento ajustável, "criação livre" e o XP por pedido. Até lá, vale a regra de transição do §8 da proposta: a ficha nasce em `creating`, com Evoluir livre; o narrador conclui; em `active`, só o narrador sobe traço.
- **v5, Bastidores** (entregas 10 a 12): NPCs e o papel `viewer`, rolagens da mesa, oculta e parada livre, transferência da narração, sessões, configurações da crônica e a auditoria consolidada.
- `permissions` na seção `experience` (5.6): vem com o XP, na v4. Na v3, `xpTotal` e `xpSpent` são `number`, logo `advance` (Etapa 4): o dono grava em `creating` e recebe `NEEDS_XP_APPROVAL` em `active`.
- Tempo real (WebSocket). A Mesa continua puxando ao focar e ao reconectar.
- Migração de fichas entre versões do template, recuperar senha, roteiro de deploy e a sessão de teste com um narrador ("Depois do painel", §9 da proposta).
