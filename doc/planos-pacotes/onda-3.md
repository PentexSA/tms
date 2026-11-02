# Onda 3 · Estado e próximo passo da ficha; narrador e Bastidores: consolidação dos planos dos pacotes

> Plano · 2026-11-02 · base conferida: `onda/3-estado-narrador` em `617264d` (ponta da onda 2; a `main` tem a mesma árvore desde o merge do PR #41, em `3a43ed8`)

A onda 3 da [matriz de achados](../testes/2026-11-01/matriz-achados.md) (seção "Onda 3 · Estado e próximo passo da ficha; narrador e Bastidores") tem dois pacotes de decisão de produto (P03-D e P04-D) e dois de correção (P09-C e P11). Ao fim da onda:

- a ficha diz em que estado está e qual é o próximo passo;
- salvar e concluir viram ações separadas;
- o narrador pede ajuste e revisa em leitura;
- a Mesa cabe na tela e mostra dados atuais;
- os bugs altos dos Bastidores saem.

Cada pacote tem um plano próprio. Este documento junta o que cruza os quatro:

- arquivos em comum;
- acordos de contrato entre pacotes;
- ordem de merge na onda;
- esforço;
- pontos para o PO e perguntas técnicas;
- o roteiro manual da integração, nas três plataformas.

As regras de execução ("PR local", integração, ondas empilhadas) são as da seção "Como executar" da matriz e não se repetem aqui.

Nenhum plano remove campo, muda regra do jogo ou afrouxa limite. O servidor continua a autoridade:

- a conta da criação é validada a cada lote;
- as transições novas do P04-D são validadas sob trava;
- a AuthZ do narrador não muda na interface (T-33).

Nenhuma decisão de produto foi tomada nesta etapa. O que o código mostrou que não se aplica como está escrito vai na seção 6, para o PO. Os pontos para o PO das ondas 1 e 2 ([onda-1.md](onda-1.md) §6 e [onda-2.md](onda-2.md) §6) continuam abertos. A seção 6 diz como cada plano os trata, sem decidir.

**A onda 2 já está na `main`.** O PR #41 foi mergeado (`3a43ed8`), e a branch remota da onda 2 foi apagada. O `617264d` é ancestral da `main`, e a árvore é a mesma. Por isso, o PR da onda 3 para a `main` leva só os commits desta onda. O rebase previsto em "Ondas empilhadas" sai sem conflito e passa a ser opcional.

## 1. Pacotes e planos

| Pacote | Branch | Plano | Itens | Esforço na matriz | Esforço no plano | Commits | Revisão antes do merge |
|---|---|---|---|---|---|---|---|
| [P03-D](../testes/2026-11-01/matriz-achados.md#p03-d) · Salvar × Concluir na barra | `pacote/p03-d-salvar-concluir` | [P03-D-salvar-concluir.md](P03-D-salvar-concluir.md) | T-04, R-05 | 2 P | **M** (4 a 5 dias) | 6, mais 1 opcional (o seed da onda, seção 4.9) | `/code-review` (sem mudança de API) |
| [P04-D](../testes/2026-11-01/matriz-achados.md#p04-d) · Estado, próximo passo e pedir ajuste | `pacote/p04-d-estado-ficha` | [P04-D-estado-proximo-passo.md](P04-D-estado-proximo-passo.md) | R-12, R-13, R-14 | 3 M | **G** (8 a 10 dias) | 12 | `/code-review` e **`/security-review`** (exigido pela matriz: estado novo na API, com AuthZ do narrador e do dono) |
| [P09-C](../testes/2026-11-01/matriz-achados.md#p09-c) · Narrador: revisão e Mesa | `pacote/p09-c-narrador-mesa` | [P09-C-narrador-mesa.md](P09-C-narrador-mesa.md) | R-09, T-33, T-39, T-40, T-48, T-49, T-75, T-76, T-83 | 7 P, 2 M | **G** (10 a 12 dias) | 13 | `/code-review`; `/security-review` nos commits 1 (`lastChange` na Mesa) e 4 (T-33), por recomendação do plano |
| [P11](../testes/2026-11-01/matriz-achados.md#p11) · Bastidores e NPC | `pacote/p11-bastidores-npc` | [P11-bastidores-npc.md](P11-bastidores-npc.md) | T-15, T-16, T-46, T-52, U-03, T-63, T-81, U-04 | 7 P, 1 M | **M** (6 a 8 dias) | 13 | `/code-review` e **`/security-review`** (muda a projeção de identidade do NPC, a lista de crônicas e a auditoria) |

**Total da onda: 2 G e 2 M**, em 44 commits mais 1 opcional, ou cerca de 28 a 35 dias de desenvolvimento somados.

- O caminho crítico é o P09-C (10 a 12 dias), seguido do P04-D (8 a 10).
- Com os quatro em paralelo, a onda leva de duas a duas semanas e meia.
- Depois vem a integração: E2E, build nativo e o roteiro manual da seção 10, de 1,5 a 2 dias.

**Por que os planos passam da soma da matriz:**

- **P03-D:**
  - a barra em duas linhas no celular, conferida em três larguras de Android, dois iPhones e duas larguras de web;
  - a guarda que grava e sai, com a saída no `onClosed`;
  - 16 trechos de Jest e 8 de E2E que tocam o "Concluir" do Editar.
- **P04-D:**
  - duas rotas novas com AuthZ, idempotência, auditoria e corrida em Postgres real (`*.pg.test`);
  - campos novos na lista, na Mesa e no Histórico (a API mandava só `status` e `returned`);
  - o `StateBadge`, novo no `@tms/ui`, com conferência nativa obrigatória (S-01);
  - o `@tms/sheet-core` muda (aditivo);
  - o `/security-review`.
- **P09-C:**
  - o T-33 liga a barra do narrador à lógica da `ModeBar` por um contexto;
  - o T-49 sobe a seleção da Mesa para a tela da crônica;
  - o T-39 junta a URL, a pilha de navegação e a rolagem no web;
  - o T-40 são quatro causas diferentes, em quatro telas;
  - o T-83 precisa de campo novo na API;
  - o `Toast` do `@tms/ui` muda.
- **P11:**
  - o T-16 tem a causa no cliente Eden, e a correção é global (`parseDate: false`);
  - o U-03 e o U-04 precisam de campo novo na lista de crônicas: a matriz supunha que a API já o mandava;
  - o T-81 precisa da crônica na projeção de identidade;
  - o T-63 tem a lista branca do `detail`, dois registros novos e o mapa exaustivo de frases;
  - o `/security-review`.

**Se a onda precisar cortar**, cada plano aponta o commit que sai sozinho sem quebrar os outros:

- P09-C: o commit 7 (a grade da Mesa) e o 11 (puxar para atualizar na ficha). Sem eles, o pacote fica perto de 9 dias;
- P04-D: o commit 9 (os passos do ciclo no Histórico, além da conclusão) e o 10 (a nota do P04-C). Sem eles, o pacote fica perto de M;
- P11: os commits 10 e 11 juntos (T-63). Sem eles, as ações novas do P04-D aparecem como código na auditoria, como as de hoje;
- P03-D: o commit 4 ("Salvar e sair"). A barra já resolve o "não dá para salvar sem concluir", mas a D-01 fica incompleta sem ele.

**As branches de pacote** são criadas na ponta da `onda/3-estado-narrador` depois do commit destes planos, sem commit próprio. Cada uma já sai da ponta da onda ("Como executar"), e não é preciso avançá-las antes de abrir o worktree.

## 2. Ordem de merge na onda

**P03-D → P04-D → P11 → P09-C.** Os quatro planos confirmaram a mesma ordem lendo o código. Os pacotes são desenvolvidos ao mesmo tempo, cada um no seu worktree. A ordem vale só para a integração: merge `--no-ff` com o ID no título, e typecheck, lint e testes depois de cada merge.

1. **P03-D primeiro.** Ele:
   - define a API do `EvolveBar` (`save`, `next` e `note`), onde o P04-D põe o "Avisar que terminei" e a linha do próximo passo (seção 4.1);
   - troca os seletores do "Concluir" do Editar nos specs E2E, que os specs novos dos outros pacotes encontram prontos (seção 4.10);
   - leva o seed estendido da onda, que serve aos roteiros dos outros (seção 4.9);
   - é o menor pacote e não muda API.
2. **P04-D em segundo.** Ele:
   - cria o estado na API, e o `/security-review` dele fica isolado;
   - cria o `StateBadge` e o `characterState`, que o P11 e o P09-C consomem (seção 4.2);
   - acrescenta as ações de auditoria que o P11 traduz (seção 4.4);
   - é o único que muda o `@tms/sheet-core`: o `dist` é reconstruído depois do merge dele, antes do typecheck da API.
3. **P11 em terceiro.** Ele:
   - usa o selo do P04-D para a visibilidade do NPC;
   - escreve as frases das ações novas do P04-D no mapa exaustivo da auditoria: o typecheck as pede no rebase;
   - desliga o `parseDate` do cliente Eden. Todo código depois dele recebe as datas como texto (seção 4.5);
   - cria a seção "NPCs" da Mesa e o `TransferOffer`, que o P09-C encaixa no layout novo.
4. **P09-C por último**, como o P08 na onda 2. Ele reorganiza a Mesa (cartão, grade e barra de seleção) e a tela da crônica, onde o P04-D e o P11 põem selos, seções e avisos. Ele:
   - faz rebase sobre os três;
   - põe no cartão compacto os dois selos (estado e visibilidade) e a seção de NPCs na grade (seção 4.3);
   - cria o `useSheetBack`, que usa a `chronicle` que o P11 passou a mandar na identidade revelada (seção 4.8);
   - muda o `Toast`, e os avisos dos três pacotes herdam a pausa (seção 4.7).

**Se o P03-D atrasar,** o P04-D entra antes. O "Avisar que terminei" fica ao lado do "Concluir" atual do Editar, e a linha do próximo passo vai na `EvolveBar` de hoje. O P03-D faz o rebase da barra, e os 9 specs E2E continuam com ele (P04-D §8.4).

**Se o P04-D atrasar,** o P11 entra sem o `StateBadge`. A visibilidade do NPC vai como texto no `meta` da lista e no `state` da Mesa, como o P04-C fez com "Devolvida", e as frases cobrem só as ações que existirem (P11 §8.4). O P09-C não muda de lugar.

**Com os quatro dentro:**

1. reconstruir o `@tms/sheet-core` (se não foi reconstruído depois do P04-D);
2. testes completos com `test:coverage`, como o CI;
3. `*.pg.test` da API, com o banco `_test` da integração (o P04-D acrescenta a corrida entre pedir ajuste, concluir e avisar);
4. E2E em Chromium e WebKit, com os quatro specs novos: `save-finish` (P03-D), `creation-state` (P04-D), `npc-backstage` (P11) e `narrator` (P09-C);
5. build nativo de Android e iOS (D-00);
6. o roteiro manual da seção 10, nas três plataformas.

Depois, push da onda e PR para a `main`, com uma seção por pacote.

**Critério de saída da onda (matriz) × quem entrega.** Os IDs são das notas das personas, e o roteiro está na seção 10.6.

| Critério | Persona e notas | Pacotes |
|---|---|---|
| "entregar", concluída | PO-A, iOS, criação livre: não concluiu (POA-10). Também POW-08, EA-13 e EW-06 | P04-D (R-13, R-12), P03-D (R-05) |
| "devolver", concluída | N-W, web 390 e 1280 (NW-24, NW-25; SEQ 2) e N-A, iOS (NA-17, NA-18; SEQ 1): não concluíram | P04-D (R-14), P09-C (R-09, T-33) |
| "sair e voltar", concluída | I-A, iOS (IA-01, IA-03, IA-04, IA-09; SEQ 2): não concluiu. I-W, web 390 (IW-01, IW-02; SEQ 3) | P03-D (T-04), P04-D (R-12), com o T-03 da onda 1 e o T-05 da onda 2 |
| E2E verdes | Todos, na integração. Os specs novos são escritos nos pacotes e rodados pela primeira vez na integração, como nas ondas 1 e 2 | Os quatro |

## 3. Arquivos tocados por mais de um pacote

Conferidos nas tabelas "Arquivos tocados" e "Conflitos" dos quatro planos. As linhas são do `617264d`.

| Arquivo | Pacotes e trechos | Risco | Como integrar |
|---|---|---|---|
| `apps/frontend/sheet/evolve/ModeBar.tsx` | P03-D: `actionBar` (l.206-234), `EvolveBar` com `save`, `next` e `note` (l.312-361), `save()` pelo ajudante (l.156-196). P04-D: `next` no Editar da criação livre, `note`, `useNextStep` e o `finish` do `SummarySheet` (l.235-251). P09-C: modos do narrador (l.48-54, l.84-95), `back` (l.114-116), `switcher` (l.205) e o retorno com `go` (l.259) | **Alto** entre P03-D e P04-D; médio com o P09-C | Seção 4.1. O P03-D define o `EvolveBar`; o P04-D só passa `next` e `note`; o P09-C mexe no seletor e na lista de modos, não nos rótulos. Ninguém reescreve o `SummarySheet` |
| `apps/frontend/components/chronicles/TableRow.tsx` | P04-D: `StateBadge` no lugar do texto `state` (l.107-113). P11: selo de visibilidade nos `badges` (l.107-130) e no nome acessível (l.60-67). P09-C: cartão compacto (l.79-150), T-83 (l.43) | **Alto** para o P09-C | Seção 4.3. O P09-C entra por último e põe os dois selos na linha de selos do cartão novo |
| `apps/frontend/components/chronicles/TableView.tsx` | P11: PCs e NPCs em duas seções (l.155-162, l.299-307). P09-C: foco (l.145-148), grade (l.299-308), barra de seleção (l.125-143, l.216-276) | **Alto** para o P09-C | A grade vale dentro de cada seção, e a barra atravessa as duas. Conferir o arquivo inteiro depois do rebase |
| `apps/frontend/components/chronicles/CharacterList.tsx` | P04-D: `FullRow` (l.37-52), selo em `badges` (l.88-111), banner "terminei" (l.184-227). P11: "NPC" no lugar de "Sua ficha" e selo de visibilidade (l.88-95, l.111) | **Alto**, mesmas linhas | O `characterState` devolve `null` para o NPC, e o P11 põe o selo dele no mesmo array (seção 4.2) |
| `apps/frontend/components/chronicles/tableItems.ts` | P04-D: `TableRowData` com `kind`, `creationMode`, `returned`, `adjust`, `ready` e `activatedAt`; `state` como `CharacterState`; o `stateLabel` (l.40-57) sai. P11: `visibility` em `TableRowData` e `TableItem`. P09-C: `lastChange` e `changeLabel` | Médio | Campos diferentes da mesma interface, na ordem do merge |
| `apps/frontend/components/chronicles/characterState.ts` | P04-D: `characterState(row, options)`, com o `CharacterState` (`id`, `label`, `tone`). P11: `npcVisibilityText(visibility)` | Médio | O P11 segue o formato do P04-D no rebase |
| `apps/frontend/sheet/SheetScreen.tsx` | P03-D: `model` no `LeaveGuard` (l.555). P04-D: `narratorOf` (l.298-310) e o efeito de transição (l.497-524). P11: `chronicle` e "‹" (l.125-134), caso `viewer` (l.161-178), `NpcVisibilityBar` (l.608-700). P09-C: o "‹" pelo `useSheetBack` (l.129-134), `onRefresh` (l.545-554) | Médio, no "‹" | Seção 4.8. O P11 só muda de onde vem a `chronicle`, e o P09-C cria o helper que a usa |
| `apps/frontend/sheet/SheetView.tsx` | P04-D: banner `completed-while-editing` ao lado do `ReturnedBanner` (l.265-268). P09-C: contexto no `ModeBarSlots` (l.147-155), `budgetTab`/`budgetEdit` (l.180, l.268, l.361), `refreshControl` (l.347-358) | Baixo | Linhas vizinhas. Conferir a ordem do array de rolagem do P08 depois do rebase |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | P03-D (provável: `useFinishCreation`). P04-D: `useFinishCreation` como base do `useNextStep` (l.86-148) e `STALE_COMPLETION` (l.125-133). P09-C: "Regras da casa" fora da Leitura (l.242, l.499-560) | Médio entre P03-D e P04-D | Ordem de merge |
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` | P11: `TransferOffer` depois do bloco `info` (l.98-107). P09-C: `?view=` (l.40, l.46, l.134), `ScrollView` (l.90), provider e barra da seleção, foco e `refreshControl` | Médio | O P11 mexe no topo do conteúdo; o P09-C, nas abas, na rolagem e no rodapé |
| `apps/frontend/app/(app)/index.tsx` | P11: aviso da proposta no cabeçalho e `meta` com "Última sessão" (l.65-84). P09-C: foco e `refreshing`/`onRefresh` (l.24, l.62-90) | Baixo | Props do `FlatList` × texto da linha |
| `apps/frontend/lib/queries/backstage.ts` | P11: `useTransferDecision` invalida `chronicleKeys.all` (l.129-147). P09-C: `useAcceptTransfer` com `resetQueries` e o aviso (l.113-127) | Baixo | Hooks diferentes. O `TransferOffer` do P11 herda o aceite do P09-C |
| `apps/frontend/lib/queries/creation.ts` | P04-D: `useAdjustCreation` e `useReadyCreation`. P09-C: `useRefresh` invalida também `chronicleKeys.all` (l.12-30) | Baixo, e a favor | As ações do P04-D passam a atualizar a lista de crônicas depois do P09-C |
| `apps/frontend/lib/api.ts` | P11: `parseDate: false` | Baixo no código, **alto no efeito** | Seção 4.5 |
| `apps/frontend/lib/format.ts` | P11: `civilDate`. P04-D usa o `shortDate` como está | Baixo | Funções diferentes (seção 4.5) |
| `packages/ui/src/index.ts`, `components.test.tsx` | P04-D: `StateBadge` e `ListItem.badges`. P09-C: `Toast` e `useToastOffset` | Baixo | Exports e casos diferentes. Os dois passam pelo aparelho antes do merge (S-01) |
| `apps/api/src/audit.ts` | P04-D: `character.creation.adjust` e `character.creation.ready`. P11: `chronicle.create` e `invite.create` | Baixo | Seção 4.4 |
| `apps/api/src/chronicles/routes.ts` | P04-D: `pendingReview` conta o `ready` (l.321-330). P11: `lastSession` e `transferOffer` na lista (l.271-346); registros `chronicle.create` (l.159-221) e `invite.create` (l.483-521) | Médio no `select` da lista | P04-D antes. O P11 acrescenta as duas subconsultas no mesmo `select` |
| `apps/api/src/chronicles/table.ts`, `__tests__/table.test.ts` | P04-D: `ch.creation` e `ch.activated_at`, com os campos de estado. P09-C: subconsulta do `lastChange` | Médio | P04-D antes. Testes em `it` separados |
| `apps/api/src/sheets/routes.ts` | P04-D: lista (l.343-449) e `creationFlags` no lugar do `isReturned` (l.76-85). P11: `chronicle` na projeção de identidade (l.498-505) | Baixo | Trechos diferentes |
| `apps/api/src/sheets/creation.ts` | P04-D: `CommandKind`, `creationView`, `merged`, concluir, devolver e as duas rotas. P11: `approvalFrom` no registro das regras (l.405-414) | Baixo | Trechos diferentes |
| `design/design-system/components.md` | P03-D: ModeBar (l.554-565). P04-D: Tags (`StateBadge`), ListItem, IdentityBlock e ModeBar. P09-C: ModeBar (l.559), CharacterCard (l.700) e Toast (l.612-622) | Médio na seção ModeBar | Cada pacote escreve a sua parte da ModeBar: os botões (P03-D), a linha do próximo passo (P04-D) e os modos do narrador (P09-C) |
| `scripts/seed-roteiro.ts` | P03-D (commit 7, opcional). O P04-D e o P09-C pediam dados também | Baixo | Seção 4.9: uma extensão só |
| Testes do Jest: `sheet/__tests__/SheetScreen.test.tsx`, `storyteller.test.tsx`, `policy.test.tsx`, `sheet.layout.test.tsx`, `LiveSheet.test.tsx`; `sheet/creation/__tests__/CreationScreen.test.tsx`; `app/__tests__/table.test.tsx` | P03-D (seletores do "Concluir"), P04-D (estado, menu, banner), P09-C (T-33, T-39, T-83), P11 (`viewer`, `sheet.layout.test.tsx:343`) | Médio | Casos separados. Cada pacote escreve já sobre os seletores do anterior |
| `e2e/tests/*` e `e2e/support/*` | P03-D: `save-finish.spec.ts`, `e2e/support/creation.ts` e 7 specs. P04-D: `creation-state.spec.ts`, `layout.spec.ts:143`, `lifecycle.spec.ts:226` e `:297`. P11: `npc-backstage.spec.ts`, `journey-backstage.spec.ts:252-254` e `:367`. P09-C: `narrator.spec.ts`, `journey.spec.ts:210-213`, `table.spec.ts:72-111`, `journey-storyteller.spec.ts:154-215`, `a11y-keyboard.spec.ts:138` | Médio | Seção 4.10 |

**Arquivos de um pacote só** (sem conflito na onda): `StatusMenu.tsx`, `SheetMenu.tsx`, `IdentityBlock.tsx`, `ReturnedBanner.tsx`, `sheet/data.ts` e `sheet/history/HistorySheet.tsx` (P04-D); `StorytellerBar.tsx`, `TextLayout.tsx`, `OperationSheet.tsx`, `lib/queries/focus.ts` e `packages/ui/src/Toast.tsx` (P09-C); `CampaignBackstage.tsx`, `apps/api/src/chronicles/backstage.ts` e `lib/queries/chronicles.ts` (P11); `UnsavedChangesGuard.tsx` e `LeaveGuard.tsx` (P03-D).

## 4. Acordos entre pacotes

### 4.1 A barra de ação (P03-D × P04-D × P09-C)

O contrato é o `EvolveBar` do plano do P03-D (§3.1 e §3.4 dele):

| Peça | Quem preenche | O quê |
|---|---|---|
| `save` | P03-D | "Salvar" quando há ação seguinte ao lado; "Salvar alterações" quando está sozinho. O nome acessível é sempre "Salvar alterações" (WCAG 2.5.3), e o `testID` é `mode-save` |
| `next` na Criação | P03-D | "Concluir criação", "Enviar para aprovação" ou "Concluir e aprovar", quando a conta fecha (`creation-action`) |
| `next` no Editar da criação livre | P04-D | "Avisar que terminei", para a dona, sem `ready` |
| `note` | P04-D (depois o P05-D, com o "Faltam: …" da D-05) | A linha do próximo passo (`nextStepCopy`), com até ~48 caracteres |
| Modos do narrador, `switcher`, `back` e `go` | P09-C | O narrador abre em Leitura e entra na edição pelo "Editar como narrador" |

- **A largura no Editar da criação livre.** O plano do P04-D media "Salvar alterações" + "Avisar que terminei" (~387 dp) e concluía que não cabem lado a lado em nenhum celular. Com a regra do P03-D, o botão de salvar diz "Salvar" ao lado da ação seguinte, e os dois somam ~292 dp. Eles cabem a partir de 360 dp (328 úteis). A D-01 escreve "Salvar alterações" no Editar, então aplicar a regra ali é ponto para o PO (seção 6, ponto 1). O plano B do P04-D (o botão num cartão no topo da rolagem) fica só para o caso de a medida no AVD falhar.
- **A altura da barra no celular:** ~64 dp hoje; ~108 dp em duas linhas (P03-D); ~128 dp com o `note` (P04-D). A área fixa do P08 (T-27) previa ~64. A medida a 360 dp, com 1 alteração e a fonte padrão, decide (pergunta técnica 1).
- **Depois de salvar no Editar, a ficha volta ao modo de antes** (`ModeBar.tsx:114-116`, `:176-178`), que é o Jogo da dona. Na criação livre, a barra sai da tela com o "Avisar que terminei". O "Avisar" do P04-D salva antes de avisar, então quem toca nele direto não perde nada. Já quem toca primeiro em "Salvar alterações" precisa voltar ao Editar para avisar. Ficar no Editar depois de salvar é ponto para o PO (seção 6, ponto 3). O P09-C muda o `back` só para o narrador, que volta à Leitura.
- **NA-23 (o narrador conclui pela barra na criação livre) não está em nenhum plano.** O P04-C o passou ao P03-D e ao P04-D. O P03-D o atribuía ao P04-D, e o P04-D não o desenha: o `nextStepCopy` dá `null` para o narrador na ficha alheia. Pôr a conclusão na barra é ação nova, por isso ficou como ponto para o PO (seção 6, ponto 5). Corrigido no P03-D (§2 e §3.4).

### 4.2 O selo (P04-D × P11 × P09-C)

- **Um componente só:** o `StateBadge`, novo no `@tms/ui` (P04-D §3.4):

  ```ts
  { label: string; tone?: 'neutral' | 'attention' | 'done'; live?: boolean; testID?: string }
  ```

  O `ListItem` ganha `badges?: readonly StateBadgeProps[]`. Os dois são aditivos, e nenhuma prop sai do `@tms/ui`.
- **O selo sempre tem texto, nunca só cor.** No app, ele tem papel `text`; no web, fica como texto no DOM. O rótulo dele entra no nome acessível da linha da lista e do cartão da Mesa.
- **Uma regra só:** `characterState(row, { narrating, deadLabel, completed })` em `components/chronicles/characterState.ts`. Ela substitui o `characterStateText` do P04-C e o `stateLabel` da Mesa.
  - Ela devolve `null` para o NPC.
  - O P11 acrescenta `npcVisibilityText(visibility)` ("Oculto", "Identidade revelada" ou "Ficha revelada"), desenhado só com `narrating`.
  - O NPC tem só o selo de visibilidade. Isso responde à pergunta 10 do P11, corrigida no plano.
- **Onde o selo aparece:**
  - sob o nome, no `IdentityBlock`, e não no `subtitle` da `AppBar` (P04-D §3.5). A 360 dp, com alterações não salvas, sobram ~64 dp, e o selo mais curto ("Devolvida") mede ~80. O `subtitle` do P08 continua sem uso (pergunta técnica 9). Corrigido nas tabelas de conflito do P03-D, do P09-C e do P11, que ainda citavam o `subtitle`;
  - na linha da lista (aba Fichas, que no código é a mesma "lista da crônica");
  - no cartão da Mesa;
  - no gatilho do narrador ("Narrador [Aguardando ajuste] ▾") e no "Mais opções" ("Ações do narrador · Aguardando ajuste").
- **Os textos são os da D-02**, com dois pontos para o PO (seção 6, pontos 6 e 7): o estado depois de "Avisar que terminei", que a D-02 não lista, e "Aguardando aprovação" no lugar de "Aguarda sua revisão".

### 4.3 A Mesa (P04-D × P11 × P09-C)

- **Dados** (`tableItems.ts` e `GET /chronicles/:id/table`):
  - o P04-D acrescenta `kind`, `creationMode`, `returned`, `adjust`, `ready` e `activatedAt`, todos sem o motivo;
  - o P11 declara a `visibility`, que a API já manda;
  - o P09-C acrescenta o `lastChange: { at, by: 'you' | 'owner' | 'other' }`, calculado no servidor, sem id nem nome.
- **Cartão (P09-C, T-48).** Linha de cima (nome, chip e meta), uma linha de selos (estado do P04-D, alertas e visibilidade do P11) e os recursos numa linha. "Concluída em dd/mm" entra na linha de selos, e não numa linha nova (P04-D §8.3).
- **Seções (P11, T-52).** PCs, depois "NPCs", com `SectionHeader`. A grade do P09-C vale dentro de cada seção. A barra de seleção (T-49) e as operações em grupo atravessam as duas. A ordem do `TableNav` é a da tela, PCs e depois NPCs.
- **"alterada por" (T-83).** Vem do último lote (`character_batches`), não do `updated_at`. O P04-D não mexe no `updated_at` ao pedir ajuste nem ao avisar, e o selo e o Histórico mostram esses passos.
- **"Avisou que terminou" no cartão (D-03).** Chega pelo foco e pelo puxar do T-40, sem push.

### 4.4 API, auditoria e Histórico (P04-D × P11 × P09-C)

**O que muda na API HTTP, por pacote:**

| Rota | P04-D | P11 | P09-C |
|---|---|---|---|
| `POST /characters/:id/creation/adjust` e `/ready` | **novas**, com AuthZ, idempotência e auditoria | — | — |
| `GET /characters/:id` | `creation.adjust` (motivo e data) e `creation.ready` (data), só para dono e narrador | projeção de identidade com `chronicle: { id, name }` | — |
| `GET /chronicles/:id/characters` | `creationMode`, `adjust`, `ready` e `activatedAt`, sem motivo | — | — |
| `GET /chronicles/:id/table` | os mesmos campos | — | `lastChange` |
| `GET /chronicles` | `pendingReview` conta o `ready` | `lastSession` e `transferOffer` (só para o destinatário) | — |
| `GET /characters/:id/history` | quatro `event` novos (`creation.submitted`, `.returned`, `.adjust`, `.ready`) | — | — |
| `GET /chronicles/:id/history` (Bastidores) | — | `action` tipado, `character`, `user`, `detail` em lista branca e `byRole` nos lotes | — |

**Auditoria.**

- As ações novas são `character.creation.adjust` e `character.creation.ready` (P04-D) e `chronicle.create` e `invite.create` (P11).
- O `payload` das duas do P04-D é `{}`: o motivo nunca entra. O `invite.create` nunca guarda o código nem o hash.
- O mapa de frases (`components/chronicles/auditPhrase.ts`, P11) é um `Record` sobre o tipo da ação que o Eden infere. Ação nova sem frase quebra o typecheck.
- Frases das ações do P04-D, escritas pelo P11 no rebase:
  - "O narrador pediu um ajuste na ficha {ficha}";
  - "{jogador} avisou que terminou a ficha {ficha}".
- **Correção da consolidação:** a frase do `character.creation.return` passa de "devolvida para ajuste" a "devolvida para correção" (P11 §3.6). "Ajuste" é o pedido novo do P04-D, e a devolução continua sendo "Devolver para correção" na tela.

**Histórico × auditoria.**

- O Histórico da ficha (P04-D, `LIFECYCLE_EVENTS`) mostra os cinco passos do ciclo a dono e narrador.
- A auditoria de Bastidores (P11) mostra as frases só ao narrador.
- Nenhum dos dois mostra o motivo, que só aparece no banner da ficha.

**Migration:** nenhuma na onda. O P04-D guarda os marcadores no jsonb `creation`, como o `returned`. A coluna `chronicle_audit.action` é `text` sem `check`. A `0023` e a `0024` ficam livres.

**`@tms/sheet-core`:** só o P04-D muda (`CharacterCreation` ganha `adjust?` e `ready?`). O `dist` é reconstruído depois do merge dele.

### 4.5 Datas (P11 × P04-D × P09-C)

- **O cliente Eden passa a entregar as datas como texto** (`parseDate: false`, P11 commit 1). Hoje ele converte em `Date` todo texto com forma de data, inclusive texto livre. O cache persistido já entrega texto, e o código atual aceita os dois.
- **O tipo inferido continua dizendo `Date`** nas colunas `timestamptz`. Código novo nunca chama método de `Date` direto num valor da API: usa `new Date(x)`, `shortDate` ou `whenLabel`.
  - Até o P11 entrar, o P04-D recebe `Date`. O `activatedAt` dele já é `string | Date | null`.
  - O P09-C entra depois e recebe texto (`lastChange.at: string`).
- **Duas funções, não uma:**
  - **`civilDate`** (nova, P11) é para colunas `date`, como a data da sessão (T-16, U-04). Ela corta o texto `AAAA-MM-DD` sem passar por `Date` e devolve `null` fora do padrão;
  - **`shortDate` e `whenLabel`** são para instantes (`activated_at`, `lastChange.at`, `updated_at`), no fuso de quem lê.
- **"Concluída em dd/mm" usa o `activated_at` com `shortDate`.** A instrução pedia "a mesma formatação, sem fuso, como o T-47", e isso vale para a saída (`dd/mm`), não para a leitura: num instante, ler só a data pega o dia em UTC. É a lição do T-47 (P02 §3.5). O `creation_completed_at` não serve, porque com a aprovação ligada guarda a data do envio (P04-D §2, item 1).
- **Fora da matriz:** o filtro "Desde/Até" da auditoria monta os limites em UTC (P11, pergunta 7).

### 4.6 Folhas (os quatro)

As folhas novas ou alteradas usam a `BottomSheet` do `@tms/ui` sem mudar a API pública:

- "Sair sem salvar?" com "Salvar e sair" (P03-D);
- o motivo do "Pedir ajuste" (P04-D);
- a confirmação de revelar o NPC (P11);
- a `OperationSheet` e a `GrantXpSheet` abertas pela barra de seleção (P09-C).

Nenhuma pode regredir:

- o Esc na captura, inclusive sem campo em autoFocus (`f3f3b8a`);
- o foco de volta ao gatilho;
- o diálogo central de 560 a partir de 600 px (T-69);
- o `onClosed`, que faz a troca de folha no iOS.

O que cada uma faz no `onClosed`:

- **P03-D:** a saída da tela ("Salvar e sair" e "Descartar e sair") acontece no `onClosed`. É o mesmo mecanismo que o P08 usou para abrir a folha seguinte.
- **P04-D:** a folha do motivo abre no `onClosed` do "Mais opções". O Enter e o "✓" usam o texto do evento (`e0a4078`).
- **P11:** o toast depois de revelar sai no `onClosed`, para não ficar atrás do `Modal` (lição do QAA-24).
- **P09-C:** o gatilho que recebe o foco de volta passa a ser o botão da barra de seleção.

A troca de folha no iOS ficou sem conferência na onda 2. Ela é obrigatória no roteiro da seção 10.

### 4.7 Toast (P09-C × os outros)

- **O P09-C muda o `Toast`** (T-76). As props atuais ficam, e entram estas mudanças:
  - o prazo pausa com ponteiro, foco ou toque no aviso e volta com o que faltava, nunca menos de 2 s;
  - com leitor de tela, o prazo nunca fica abaixo de 10 s;
  - `durationMs` opcional;
  - `useToastOffset(height)`, novo, para o aviso subir acima da barra fixa.
- **Só a operação em grupo passa 10 s.** Os outros avisos ficam com os 5 s do DS e herdam a pausa:
  - o "Salvo: … · Desfazer" da barra do P03-D;
  - "Ajuste pedido…" e "Pronto: o narrador foi avisado." do P04-D;
  - os avisos de revelar do P11, que usam `show({ message })`, sem `action`.
- **O "Desfazer" do Histórico continua sem prazo.**

### 4.8 Navegação, atualização e cache (P09-C × P11 × P04-D)

- **O "‹" da ficha.** O P09-C cria o `useSheetBack(chronicleId)` em `sheet/navigation.ts` (commit 9), com `canGoBack ? back() : replace('/chronicles/<id>')`.
  - O P11 (T-81) só faz a `chronicle` valer também na identidade revelada, pela projeção.
  - Com a volta pela pilha, o T-81 fica coberto dentro do app duas vezes; a projeção cobre o link direto e o rótulo "Voltar para {crônica}".
  - **Correção da consolidação:** o plano do P09-C dizia que o P11 criaria o helper, e o do P11 não o criava. O helper ficou com o P09-C (P09-C §3.3, §8.4 e §8.5; P11 §8.4).
- **Atualização sem polling novo.**
  - O P09-C (T-40) rebusca no foco de tela, no foco da janela (web) e ao puxar: de 2 a 5 GETs por foco, sem duplicar o que está em voo. O aceite da narração usa `resetQueries` no lugar do `clear()`.
  - O único intervalo continua sendo o de 30 s do P04-C. O P04-D estende a condição dele à ficha em `creating` com `ready`, para o dono que espera o narrador.
- **Invalidação.** O `useRefresh` do P04-C passa a invalidar a lista de crônicas (P09-C). Assim, "Pedir ajuste" e "Avisar que terminei" (P04-D) atualizam a contagem `pendingReview` sem código a mais. O `useSetNpcVisibility` passa a invalidar a Mesa (P11).
- **Cache persistido** (`lib/persist.tsx`). Só o `GET /characters/:id` (dono e narrador) e os templates vão para o disco.
  - **Fail secure:** a ficha guardada antes da atualização não tem `adjust` nem `ready`, e nenhum selo ou banner é inventado até a resposta chegar.
  - **O NPC do narrador** restaurado com a visibilidade antiga manda a `visibilityRevision` velha, e o servidor recusa com 409. Nada é revelado sobre dado velho.
  - **A lição do `c7c1423`:** o estado é recalculado a cada resposta, não só na montagem. O P04-D tem teste para a ficha montada do cache com `ready` e a resposta já `active`.

### 4.9 Seed do roteiro (os quatro)

- **Uma extensão só, opcional:** a `--fichas-criacao` do P03-D (commit 7, o primeiro pacote a entrar). O seed padrão não muda, e os dados são só fictícios. Ela cria pela API, com as sessões que o seed já abre e sem convite nem crônica nova (limite de aceites):
  - as fichas de J1 do P03-D: "Isadora" em "Vampiro v4", com todos os pontos básicos menos 1, e "Otto" em "Vampiro v3/v5", só com nome e clã, uma por plataforma;
  - os dados do P04-D: a aprovação ligada em "Mago v4" e a "Ficha Aprovação R" de J1 lá, com a conta fechada;
  - o dado do P09-C (pergunta 12): numa crônica "v3/v5", uma ficha de J1 concluída por N, com 10 de XP e um pedido de XP pendente.
- **O commit 13 opcional do P04-D saiu** (P04-D §8.1, §8.2, §8.5, §9 e §11.a).
- **O P11 não precisa de seed:** o que ele confere nasce pela tela.
- Sem a opção, o roteiro cria tudo pela tela, como cada plano descreve.

### 4.10 E2E

- **P03-D (entra primeiro):**
  - troca "Concluir" por "Salvar alterações" em 8 trechos de 7 specs: `conflict` (2), `draft`, `evolve`, `journey`, `journey-mage`, `journey-werewolf` e `journey-storyteller` (`exact`). O `getByRole('button', { name: 'Concluir' })` sem `exact` também casa "Concluir criação" e ficaria ambíguo com a barra nova;
  - **o `layout.spec.ts:149` e o `lifecycle.spec.ts:300-310` não mudam.** O narrador está em Leitura, sem a barra. Dos 9 specs da instrução, 7 mudam e 2 são só conferidos;
  - move os ajudantes da criação para `e2e/support/creation.ts`, e o P04-D os reaproveita.
- **P04-D:** os textos de estado em `layout.spec.ts:143` e `lifecycle.spec.ts:226` e `:297`, depois do P03-D.
- **P11:**
  - `journey-backstage.spec.ts:252-254` (a lista de chaves da identidade passa a ter `chronicle`) e `:367`;
  - o `npc-backstage.spec.ts` roda com o fuso de São Paulo, porque o T-16 só aparece a oeste de UTC.
- **P09-C:**
  - `journey.spec.ts:210-213` (T-33: o narrador cai em Editar na ficha livre);
  - `table.spec.ts:72-111` (T-83). Se a pergunta 1 do P09-C for para "sempre Editar", o `table.spec.ts:80` (`{ name: 'Salvar' }`) ganha `exact: true`;
  - `journey-storyteller.spec.ts:154-215` (a barra fixa; o aviso não cobre "Nova noite");
  - `a11y-keyboard.spec.ts:138` (a ordem de Tab).
- **Os quatro specs novos** usam `signUp` e `apiAs` (contas fictícias), seletores por papel e rótulo e as abas da ficha a 390 px. Eles conferem no DOM o que o Jest não pega:
  - o `role="toolbar"` e o `aria-live` da barra de seleção;
  - o `aria-selected` da aba depois do `setParams`;
  - o selo como texto no nome acessível;
  - o diálogo de 560.
- Eles rodam só na integração (portas fixas, um por vez). O `journey-backstage` e o `journey-storyteller` são tocados por dois pacotes cada, em trechos diferentes.

## 5. O que a consolidação corrigiu nos planos

- **P03-D:**
  - o NA-23 (o narrador conclui pela barra na criação livre) saiu da conta do P04-D e virou ponto para o PO (§2 e §3.4);
  - o selo do P04-D vai no `IdentityBlock`, e não no `subtitle` (§8.4);
  - a `--fichas-criacao` virou a extensão única da onda, com os dados do P04-D e do P09-C (§8.4, §9, pergunta 6, e §11.a);
  - o venv do idb ficou o da onda, `~/.venvs/idb-tms` (§11.d).
- **P04-D:**
  - a largura da barra considera a regra de rótulo do P03-D, e o plano B só entra se a medida falhar (§3.3 e §9, pergunta 1);
  - o commit 13 (seed) saiu (§8.1, §8.2, §8.5, §9, pergunta 11, e §11.a);
  - o venv do idb ficou o da onda (§11.d).
- **P09-C:**
  - o `useSheetBack` é criado por ele, e não pelo P11 (§3.3, §8.4 e §8.5);
  - o selo do P04-D vai no `IdentityBlock`, e o `stateLabel` sai pelo `characterState` (§8.4);
  - o venv do idb ficou o da onda (§11.d e §11.g).
- **P11:**
  - a frase da devolução passa a "devolvida para correção" (§3.6);
  - o selo do P04-D vai no `IdentityBlock`, e o `useSheetBack` é do P09-C (§8.4);
  - a pergunta 10 ficou respondida pelo P04-D (§9).

## 6. Pontos para o PO (nenhum decidido nos planos)

Recomendações e decisões que o código mostra não caberem como estão escritas, ou que criam comportamento que a decisão não diz:

1. **D-01 × D-03: o rótulo do botão de salvar no Editar da criação livre.** A D-01 escreve "Salvar alterações" no Editar. Com o "Avisar que terminei" ao lado (D-03), os dois botões não cabem numa linha no celular. A regra técnica do P03-D (visível "Salvar", nome acessível "Salvar alterações", como na Criação) os faz caber. **Recomendação técnica:** a regra do P03-D. A alternativa é a barra em duas linhas de botões.
2. **P03-D: Editar com 0 alterações.** "Salvar alterações" fica desabilitado, e o "Concluir sem alterações sai direto" deixa de existir. Quem entrou no Editar sem querer sai pelo seletor de modo, que no celular rola com a ficha (T-27).
3. **P03-D × P04-D: ficar no Editar depois de salvar.** Hoje a ficha volta ao modo de antes (o Jogo da dona). Na criação livre, a barra com o "Avisar que terminei" sai da tela. Na Criação, a ficha já fica.
4. **P03-D: "Salvar e sair" só na ficha.** A mesma guarda está na Nova ficha (onde salvar é criar a ficha) e nas regras da crônica (guarda da R-31, P09-D). Elas ficam como hoje.
5. **NA-23: o narrador concluir pela barra na criação livre.** Nenhum plano o faz. Hoje ele conclui pelo ⋯ ("Mais opções" abaixo de 900 px). É ação nova.
6. **P04-D: o estado depois de "Avisar que terminei".** A D-02 não lista esse estado. O plano propõe "Avisou que terminou" (narrador) e "Você avisou que terminou" (jogador).
7. **P04-D: "Aguardando aprovação" no lugar de "Aguarda aprovação" e "Aguarda sua revisão".** O narrador perde o "sua revisão" na linha, e o chamado fica no banner da aba Fichas.
8. **P04-D: "Aguardando ajuste" não impede concluir** na criação por pontos sem aprovação, como a devolução de hoje. A corrida em que o jogador conclui sem ter visto o pedido é recusada pela revisão.
9. **P04-D: "Pedir ajuste" em `pending`.** A devolução já faz a mesma transição, e o plano não duplica a ação.
10. **P04-D: "Concluída em dd/mm" em toda ficha ativa,** na lista e na Mesa, sem prazo nem ano.
11. **P04-D: "Avisar que terminei" não trava a edição.** O jogador continua editando até o narrador concluir ou pedir ajuste.
12. **P09-C: aviso de pedido de XP na lista de crônicas** (POA-39). É dado novo na API, além da rebusca que a matriz pede.
13. **P09-C: o T-33 entrega a conta em Leitura já na onda 3**, só em `creating`, antes da D-10 (P09-D, que a estende ao `pending`).
14. **Toques do narrador no celular** (liga com [onda-2.md](onda-2.md) §6.8):
    - **P09-C:** na ficha em criação, marcar um recurso passa a pedir um toque a mais ("Editar como narrador" → "Jogo");
    - **P04-D:** abaixo de 900 px, são três toques até a folha do motivo ("Mais opções" → "Ações do narrador · {estado}" → "Pedir ajuste").

**Pontos das ondas 1 e 2 que tocam esta onda (continuam abertos):**

- **[onda-1.md](onda-1.md) §6.1, gravação única × D-01 (P03-D).** A prioridade continua gravada na hora. "Salvar" e "Salvar e sair" gravam só o rascunho (os pontos). O endpoint atômico segue em aberto.
- **[onda-2.md](onda-2.md) §6.10, botões de "ficar" nas folhas (P03-D).** O "Continuar editando" fica como está (`ghost`), e só entra o "Salvar e sair". Alinhar com o "Continuar conectado" é uma linha em cada folha, depois da decisão.
- **[onda-2.md](onda-2.md) §6.4, abertura em Editar na crônica livre (P04-D, P09-C).** Nenhum plano muda o modo de abertura. O "Avisar que terminei" fica na barra do Editar, onde a ficha livre abre hoje. O narrador continua abrindo em Leitura.
- **[onda-2.md](onda-2.md) §6.6, extrato no Histórico (P04-D).** O Histórico ganha os passos do ciclo, sem extrato de pontos.
- **[onda-2.md](onda-2.md) §6.8, dois toques do narrador (P04-D, P09-C).** O "Mais opções" do P08 não muda. O ponto 14 acima diz o que cada pacote acrescenta.
- **[P04-C](P04-C-ciclo-vida-ficha.md) §9, pergunta 6, o menu do narrador com alterações não salvas.** O "Concluir criação" do menu continua desabilitado. A D-01 não pede "Salvar e concluir" no menu.

## 7. Causas da matriz corrigidas pela leitura do código

A matriz foi escrita sobre o `1db3db9`, antes das ondas 1 e 2. As principais correções:

- **T-04:**
  - a escolha do rótulo está hoje em `ModeBar.tsx:206-234`, e o botão, em `:312-361`;
  - o "um botão só" veio do commit `733c915`, não de um plano. O plano-v4 (l.61, l.459) pede a separação.
- **R-05:** sem alterações, o "Concluir" do Editar não salva nada: só sai do modo (`ModeBar.tsx:128-137`).
- **R-12:**
  - "Concluída em" vem do `activated_at`. O `creation_completed_at` guarda a data do envio quando a aprovação está ligada;
  - "lista da crônica" e "aba Fichas" são o mesmo componente (`CharacterList`).
- **R-14:** em `pending`, o "Devolver para correção" já existe e faz a mesma transição.
- **T-15:** a causa suposta se confirma pelo Yoga. O `flex: 1` num pai sem `flex` fica com altura 0 no nativo, e o CSS do web mede pelo conteúdo. O Android deve ter o mesmo defeito: as personas não o testaram ali.
- **T-16:** a causa suposta se confirma no Eden 1.4.9, que converte em `Date` todo texto com forma de data.
  - A edição também falha no web.
  - Qualquer texto livre com essa forma (título de sessão, nome, campo da ficha) vira `Date` do mesmo jeito.
- **T-81:** a projeção de identidade do NPC não traz a crônica. A matriz não indicava a causa.
- **T-63:** "xp-grant" e "xp.grant" não são duplicatas. São o lote da ficha e o registro da operação, gravados na mesma transação.
- **U-04:** a API devolve o `lastSession` só no detalhe da crônica, não na lista.
- **T-52:** a lista da crônica já tem a seção "NPCs". Faltam o selo e o texto do dono; na Mesa, falta a seção.
- **T-40:**
  - **item 1:** o botão "Pedidos de XP (N)" existe no nativo. O foco da Mesa é que não rebusca os pedidos;
  - **item 2:** a lista de crônicas não rebusca no foco nem tem o puxar, e aprovar não invalida `chronicleKeys.all`;
  - **item 3:** já foi corrigido pelo P04-C;
  - **item 4:** o `queryClient.clear()` do aceite deixa a tela com o dado velho.
- **T-39:** o "‹" faz `router.replace` e monta outra crônica. A aba é `useState` na l.46, não na l.42.
- **T-49:** a seleção **não** se perde na operação (código e `journey-storyteller.spec.ts:192`). Ela se perde no "Cancelar seleção", na troca de filtro e na volta da ficha (T-39).
- **T-48:** os chips do dock ficam num `View` sem `flexDirection: 'row'`.
- **T-83:** o `updated_at` muda com qualquer escrita, e a resposta não diz quem foi. O autor está no lote.

## 8. Perguntas técnicas abertas

A lista completa está na seção 9 de cada plano. Estas cruzam pacotes ou mudam o esforço da onda (⚙ = resposta só no simulador, no aparelho ou no E2E):

| # | Pergunta | Plano | Por que importa para a onda |
|---|---|---|---|
| 1 | ⚙ A barra de ação no `compact`: ~108 dp em duas linhas, ~128 com o `note`. Cabe a 360 dp sem engolir a ficha? | P03-D, perg. 3; P04-D, perg. 1 | Decide entre a barra em duas linhas, o texto encurtado e o plano B do P04-D. Muda a área fixa que o T-27 (P08) tinha reduzido |
| 2 | `parseDate: false` no cliente inteiro ou só na data da sessão? | P11, perg. 1 | O global corrige todo texto com forma de data e alinha a rede com o cache. O efeito vale para os quatro pacotes (seção 4.5) |
| 3 | ⚙ No iOS, a saída da tela no `onClosed` ("Salvar e sair") e a folha do motivo aberta pelo `onClosed` do "Mais opções" funcionam? | P03-D, perg. 2; P04-D, perg. 10 | É a troca de folha que ficou sem conferência na onda 2. Se falhar, a `BottomSheet` muda para os três pacotes |
| 4 | "Concluir criação" escondido até a conta fechar ou `aria-disabled` e tocável, explicando o que falta? | P03-D, perg. 1 | Encosta no "Faltam: …" da D-05 (P05-D, onda 4) |
| 5 | "Editar como narrador" na ficha em uso continua indo a Jogo, ou sempre a Editar? | P09-C, perg. 1 | Muda o `table.spec.ts` e o número de toques do narrador na sessão |
| 6 | ⚙ No web, o `setParams` empilha entradas no histórico? A tela de baixo continua montada depois do `push`? | P09-C, perg. 3 e 4 | Define se a seleção e os filtros da Mesa voltam com a ficha no web, ou só a aba e a rolagem |
| 7 | A barra de seleção a 360 dp: rolagem lateral, duas linhas ou "Ações (N)" numa folha? | P09-C, perg. 5 | Cinco botões não cabem numa linha |
| 8 | A revisão sobe também no "Avisar que terminei"? O aviso some quando o jogador salva depois de avisar? | P04-D, perg. 2 e 3 | Um 409 a mais para o narrador que conclui com a revisão velha; mexer no `/events` é o caminho mais quente da API |
| 9 | Rótulo curto do selo no `subtitle` da `AppBar` a partir de 600 px? | P04-D, perg. 5 | O selo no `IdentityBlock` rola com a ficha |
| 10 | `pendingReview` somado ou um `readyCount` separado? | P04-D, perg. 4 | O campo separado serve ao filtro da D-10 (P09-D, onda 5) |
| 11 | O app antigo das lojas mostra os `event` novos do Histórico sem texto: aceitável até a atualização? | P04-D, perg. 8 | A alternativa é texto de interface na API |
| 12 | T-81 com a crônica na projeção ou só com a volta pela pilha? | P11, perg. 3 | Com o `useSheetBack` do P09-C, os dois caminhos cobrem a volta dentro do app; a projeção cobre o link direto |
| 13 | Filtro de data da auditoria em UTC: corrigir no P11 ou registrar para depois? | P11, perg. 7 | É do mesmo tipo do T-16, fora da matriz |
| 14 | Janela do "Desfazer" em grupo: 10 s com pausa ou até a próxima interação? | P09-C, perg. 6 | O DS fala em 5 s para todo aviso |
| 15 | ⚙ O cliente do idb (fb-idb) roda no Python desta máquina? | P03-D, P04-D, P09-C e P11, §11.d | Sem ele, o roteiro do iOS volta a ser "não conferido", como na onda 2 (seção 9) |

## 9. Riscos da onda

- **A `ModeBar` em três pacotes.** O P03-D define o `EvolveBar` antes. O P04-D faz o rebase da barra num commit só (o 8), e o P09-C não toca nos rótulos.
- **A Mesa em três pacotes.** O `TableRow` e o `TableView` têm risco alto para o P09-C, que entra por último e refaz o cartão com os selos do P04-D e do P11. Os commits 7 (grade) e 11 (puxar na ficha) do P09-C saem sozinhos.
- **`parseDate: false` vale para o app inteiro.** O tipo do Eden continua dizendo `Date`. Um `.getTime()` direto compila e quebra em tempo de execução. A regra da seção 4.5 vai no resumo do PR do P11 e na revisão do P09-C.
- **Duas mudanças no `@tms/ui`:** `StateBadge` e `ListItem.badges` (P04-D); `Toast` e `useToastOffset` (P09-C). Só o nativo mostra defeito de estilo do JSX (S-01). Por isso a conferência no aparelho vem antes do merge, não depois.
- **O `@tms/sheet-core` muda no P04-D.** Até a reconstrução do `dist`, a API não vê os marcadores novos.
- **API e AuthZ em três pacotes, com três `/security-review`.**
  - **P04-D:** duas rotas novas. Conferir:
    - quem recebe o motivo (só dono e narrador, no `GET /characters/:id`);
    - o `viewer` e o outro jogador (404);
    - as transições sob trava (409);
    - o `payload` vazio na auditoria.
  - **P11:** a projeção de identidade com a crônica; o `transferOffer` só para o destinatário; o `detail` em lista branca; o nome da ficha alvo preso à crônica do narrador (`tc.chronicle_id = a.chronicle_id`); o convite sem código.
  - **P09-C:** o `lastChange` como enum calculado no servidor, sem id nem nome, numa rota só do narrador.
- **Barra e área fixa no celular.** A barra de ação (P03-D e P04-D) e a barra de seleção da Mesa (P09-C) aumentam a área fixa que o T-27 tinha reduzido. As perguntas 1 e 7 se respondem a 360 dp no AVD.
- **E2E escritos e não rodados nos pacotes.** Os quatro specs novos e os ajustes rodam pela primeira vez na integração. Foi na integração que as ondas 1 e 2 pegaram o "+" morto do web, o cache que montava a ficha velha e o Esc sem autoFocus.
- **O roteiro do iOS depende de uma ferramenta que ainda não rodou nesta máquina.** Versões conferidas nesta consolidação:
  - `python3 --version`: 3.15.2, o padrão em `/opt/homebrew/bin`. O 3.14 também está instalado;
  - `idb_companion --version`: só a data do build, 22/10/2026, sem número de versão.

  O cliente fb-idb é antigo (a última versão que os planos conhecem é a 1.1.7) e pode não rodar no Python 3.15 (asyncio e grpclib). Não há como saber, antes de instalar, se o protocolo dele bate com o do companion. Nada foi instalado nesta etapa. A mitigação está na seção 10.4.
- **Recursos locais.**
  - O E2E usa portas fixas e roda um por vez, só na integração.
  - Os `*.pg.test` (P04-D) usam um banco `_test` por worktree.
  - O build nativo roda uma vez por onda.
  - O seed tem limite de aceites de convite (10 a cada 15 min por conta): no roteiro, um seed por plataforma, com pelo menos 15 min entre um e outro.

## 10. Testes manuais da integração (web, Android com AVD, iOS com idb)

O roteiro com os quatro pacotes juntos, na `onda/3-estado-narrador` depois do último merge, no formato da §11 dos planos. Cada plano tem a tabela completa dos itens dele (§11.e). Esta seção ordena o que roda na integração:

- o critério de saída da onda;
- os itens que dependem de mais de um pacote;
- os itens obrigatórios no iOS;
- as pendências do iOS da onda 2.

Só contas e dados fictícios. A senha é a constante do seed e nunca é escrita aqui, num script versionado ou numa captura.

### 10.1 Preparação

**Serviços.**

- `npx pnpm bootstrap`, se o `scripts/check-dev-env.mjs` pedir.
- `npx pnpm db:up`, `npx pnpm db:migrate` e `npx pnpm templates:publish --published`. A onda não tem migration nova.
- API em `npx pnpm dev:api` (porta 3001) e Metro em `npx pnpm dev:web` / `cd apps/frontend && npx expo start` (porta 8081).
- A máquina no fuso `America/Sao_Paulo`: o T-16 só aparece a oeste de UTC.

**Seed, um por plataforma.** `npx pnpm seed:roteiro`, com `--fichas-criacao` se o commit 7 do P03-D entrar (seção 4.9).

- **O seed apaga a rodada anterior**, inclusive a crônica que passou a N2 na transferência. Cada plataforma começa limpa.
- **Entre dois seeds, pelo menos 15 min:** J1 aceita 7 convites por rodada, e o limite é 10 a cada 15 min por conta.
- **O que o seed já cobre:**
  - **contas:** N (`roteiro_narrador`), J1 (`roteiro_jogador1`), J2 (`roteiro_jogador2`) e N2 (`roteiro_narrador2`), em `@roteiro.test`;
  - **crônicas:** "{Sistema} v3/v5" (criação livre, com J1 e J2 e um convite para N2) e "{Sistema} v4" (por pontos, aprovação desligada), para Vampiro, Mago e Lobisomem, e "Vampiro limite 20" (21 fichas).

**Que crônica serve a que fluxo** (vale para as três plataformas e substitui, na integração, a divisão por plataforma do P11 §11a):

| Crônica do seed | Fluxo | Pacotes |
|---|---|---|
| "Vampiro v4" (por pontos, aprovação desligada) | "sair e voltar" (I-A, I-W): Salvar, Salvar e sair, fechar e reabrir, selo "Em criação · por pontos", concluir, "Concluída em dd/mm" | P03-D, P04-D |
| "Mago v4" (aprovação ligada pela tela ou pela `--fichas-criacao`) | Enviar para aprovação → "Aguardando aprovação" → Devolver → reenviar → aprovar; contagem na lista de crônicas | P03-D, P04-D, P09-C |
| "Vampiro v3/v5" (livre) | "entregar" (PO-A) e "devolver" (N-W, N-A): Avisar que terminei, Pedir ajuste, motivo, reenviar, concluir; Notas privadas; Leitura do narrador | P03-D, P04-D, P09-C, P11 (auditoria) |
| "Mago v3/v5" (livre) | Ficha de J1 concluída por N, XP concedido e pedido de XP (T-40, item 1); "alterada por você" (T-83) | P09-C |
| "Vampiro limite 20" | Mesa com 21 fichas: cartão, grade, barra de seleção, "1 selecionado (máx. 20)", Desfazer, volta à aba (T-39) | P09-C |
| "Lobisomem v3/v5" (livre) | Ficha de J1 com "Avisou que terminou" e o NPC "Figura Velada" oculto na mesma Mesa (selo duplo); NPC revelado (T-15, T-46, T-52, T-81); sessão "2026-11-01" (T-16, U-04); auditoria (T-63); **por último**, a proposta de narração a N2, recusada e depois aceita (U-03, T-40 item 4) | P11, P04-D, P09-C |
| "Lobisomem v4" | Reserva, para repetir um passo sem sujar as outras | — |

**Evidências.**

- Ficam no scratchpad da sessão, com o nome `onda3-<plataforma>-<largura>-<ID>-<passo>.png`. Exemplos: `onda3-ios-se-SAIDA-entregar-03.png` e `onda3-and360-R-13d-1.png`.
- Nenhum e-mail na captura: a tela de conta não entra.
- Os scripts do roteiro também ficam no scratchpad, fora do repositório.

### 10.2 Web

- **Ferramenta:** um script Playwright Chromium no scratchpad (`node_modules/playwright` do checkout), contra o Metro na 8081. A janela do Claude-in-Chrome não muda de tamanho.
- **Viewports exatos:** 390×844 e 1280×800. **WebKit** nos itens de Safari:
  - o `scrollTo` da volta do T-39;
  - a barra de seleção fixa (T-49);
  - o selo e a barra de ação a 390.
- **Duas contas ao mesmo tempo** (N e J1), em dois contextos do navegador.
- **Seletores por papel e rótulo:**
  - `getByRole('button', { name: 'Salvar alterações' })`, que casa o "Salvar" visível;
  - `getByRole('button', { name: 'Avisar que terminei' })`;
  - `getByRole('button', { name: 'Pedir ajuste' })`;
  - `getByRole('toolbar', { name: 'Ações da seleção' })`;
  - `getByRole('tab', { name: 'Mesa' })`;
  - e os das §11.b dos planos.
- **Um screenshot por passo.**
- **No DOM:** o `aria-live` da contagem, o `aria-selected` da aba depois do `?view=`, o selo como texto e o `aria-disabled` onde houver.
- **Se o bundle web do Metro ficar velho** depois de um merge: reiniciar com `--clear`.

### 10.3 Android (AVD)

- **AVD:** `Pixel_3a_API_34_extension_level_7_arm64-v8a` a 393 dp. Os itens de layout também a 360 (`adb shell wm density 480`) e a 411 (`wm density 420`), com `wm density reset` no fim.
- **APK Debug:** `expo prebuild` e `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a`, com o `JAVA_HOME` da JBR do Android Studio (~3 min).
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Navegação:** `adb shell input tap/text/keyevent` e `adb shell uiautomator dump`, com o alvo achado pelo `content-desc` ou pelo `text`.
- **Teclado de software:** `settings put secure show_ime_with_hard_keyboard 1`, de volta a `0` no fim.
- **O LogBox do Debug, no pé da tela, engole toques:** fechar antes de cada passo.
- **O voltar do Android onde houver folha ou rota:**
  - fecha a folha do motivo sem enviar;
  - fecha a confirmação de revelar sem revelar;
  - desliga a seleção da Mesa antes de sair da crônica;
  - abre o "Sair sem salvar?" na ficha com alterações.
- **Boot rápido com `-gpu host`.** O boot a frio sob pressão de memória travou o System UI na onda 2.

### 10.4 iOS com idb

- **Simuladores:** iPhone SE 3ª geração (iOS 18.x, 375 pt) e iPhone 17 (iOS 26.5, Dynamic Island).
  - Os UDIDs saem de `xcrun simctl list devices available`; depois, `xcrun simctl boot` e `open -a Simulator`.
  - "Connect Hardware Keyboard" desligado, para o teclado de software.
- **Build Debug para o simulador**, como o job `native-ios`:

  ```bash
  xcodebuild -workspace TMS.xcworkspace -scheme TMS -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath <scratchpad>/ios-dd CODE_SIGNING_ALLOWED=NO build
  ```

  Ele leva ~37 min a frio e ~10 min incremental. Depois:
  - `xcrun simctl install <UDID> <scratchpad>/ios-dd/Build/Products/Debug-iphonesimulator/TMS.app`;
  - `xcrun simctl launch <UDID> com.tms.app`.

  O simulador alcança a 8081 e a 3001 em `localhost`.
- **O companion:** `/opt/homebrew/bin/idb_companion`, já instalado. Ele fica só local: o cliente o sobe com `--companion-path`. Se for preciso subir à mão, usar o socket de domínio (`--grpc-domain-sock` no scratchpad), nunca uma porta numa interface de rede. Depois, conferir que nada ficou escutando: `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` vazio.
- **O cliente (fb-idb):** um venv só para a onda, fora do repositório, criado uma vez e reaproveitado pelos quatro pacotes:

  ```bash
  python3 --version                                  # anotar
  python3 -m venv "$HOME/.venvs/idb-tms"
  "$HOME/.venvs/idb-tms/bin/python" -m pip index versions fb-idb   # conferir a versão
  "$HOME/.venvs/idb-tms/bin/python" -m pip install 'fb-idb==1.1.7' 'pip-audit==<versão fixada>'
  "$HOME/.venvs/idb-tms/bin/pip-audit"               # antes de usar
  ```

  - Ele nunca entra no `package.json` nem no lockfile.
  - Com vulnerabilidade conhecida sem correção no `pip-audit`, o iOS fica "não conferido", com o motivo.
  - **Se o cliente não rodar no Python 3.15** (erro de asyncio ou grpclib ao subir, ou `idb list-targets` sem o simulador), tentar um venv com o `python3.14`, que também está em `/opt/homebrew/bin`. Se não rodar nos dois, o iOS fica "não conferido". A integração decide com o time entre:
    - dar acesso assistivo ao terminal (`osascript`), que foi negado na onda 2;
    - instalar o Maestro, que também foi negado na onda 1.

    As duas pedem aprovação.
- **Navegação:**
  - `idb ui describe-all --udid <UDID> --json` acha o alvo pelo `AXLabel`, e o toque vai no centro do `frame`: `idb ui tap --udid <UDID> X Y`;
  - `idb ui text` (e-mail, motivo, nome do NPC, data);
  - `idb ui swipe`. O gesto de voltar sai da borda esquerda: `idb ui swipe 2 400 300 400`;
  - `idb ui key` (Return; conferir o código no `--help`);
  - `idb screenshot --udid <UDID> <arquivo>`.
- **Deep link:** `xcrun simctl openurl <UDID> 'tms://characters/<id>'` pede "Abrir com 'TMS'?". Achar "Abrir" no `describe-all` e tocar.
- **Fechar o app para o "sair e voltar":** `xcrun simctl terminate <UDID> com.tms.app` e `launch` de novo.

### 10.5 Ordem de execução e tempo

1. **E2E completo** (Chromium e WebKit), depois do último merge. Com o E2E vermelho, o roteiro manual não começa.
2. **Build do iOS a frio** (~37 min), em segundo plano enquanto o web roda.
3. **Web**, de 2 a 2,5 h: critério de saída (10.6), itens de mais de um pacote (10.7) e os itens web de cada plano que mudaram depois do merge dos seguintes.
4. **Android**, de 3 a 4 h: APK (~3 min), seed novo e a mesma ordem. Os itens de layout a 360 e 411 dp ficam no fim, para mexer na densidade uma vez só.
5. **iOS**, de 3,5 a 4,5 h:
   - venv e `pip-audit`, ~15 min na primeira vez;
   - seed novo;
   - iPhone SE primeiro (tudo), iPhone 17 depois (layout, Dynamic Island e os obrigatórios);
   - pendências da onda 2 (10.8) no fim.

   Cada toque pelo idb pede um `describe-all`, então o iOS é o mais lento.
6. **Dentro de cada plataforma, a ordem dos fluxos:** "sair e voltar" → "entregar" → "devolver" → aprovação → Mesa → XP → NPC e Bastidores, com a transferência sempre por último.

No total, de 1,5 a 2 dias de uma pessoa, fora o build nativo do CI.

### 10.6 Critério de saída: as tarefas que não foram concluídas no teste

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| SAIDA-sair-voltar | iOS SE (obrigatório: I-A, IA-01, IA-03, IA-04, IA-09; `iniciante-app.md`, Tarefa 4); web 390 (I-W, IW-01, IW-02) | J1 | "Vampiro v4" → ficha nova → prioridades e todos os pontos básicos menos 1 → "Salvar" → mais 2 alterações → fechar o app (`simctl terminate`; no web, F5) → abrir → crônica → ficha → fechar o último ponto → "‹" com 1 alteração → "Salvar e sair" → abrir de novo | A lista diz "Em criação · por pontos"; a ficha abre em Criação com o selo sob o nome; "Recuperar" devolve as 2 alterações; com a conta fechada, "Salvar" e "Concluir criação" lado a lado; "Salvar e sair" grava e sai; reaberta, nada se perdeu | `onda3-ios-se-SAIDA-sair-voltar-01..08.png`, `onda3-web390-SAIDA-sair-voltar-01..08.png` | |
| SAIDA-entregar | iOS SE (obrigatório: PO-A, POA-10); web 390 (POW-08) | J1, depois N | "Vampiro v3/v5" → ficha nova em Editar → ler a linha do próximo passo → mudar um traço → "Avisar que terminei" → confirmar. N: lista de crônicas → crônica → Mesa | J1: "Quando terminar, avise: o narrador conclui."; o resumo diz que salva antes; o toast "Pronto: o narrador foi avisado."; o selo "Você avisou que terminou". N: "1 ficha aguarda revisão" na lista de crônicas, o banner "1 jogador avisou que terminou" na aba Fichas e o selo "Avisou que terminou" no cartão da Mesa | `onda3-ios-se-SAIDA-entregar-01..06.png`, `onda3-web390-SAIDA-entregar-01..06.png` | |
| SAIDA-devolver | iOS SE (obrigatório: N-A, NA-17, NA-18); web 390 e 1280 (N-W, NW-24, NW-25) | N, depois J1 | N abre a ficha de J1 (Leitura, com a aba Orçamento) → "Editar Notas do Narrador" (ler o rótulo) → "Mais opções" → "Ações do narrador · Avisou que terminou" → "Pedir ajuste" → "Refaça os Antecedentes" → enviar. J1 volta ao app | N: as Notas dizem "privadas: o jogador não vê"; a folha do motivo abre depois do menu (troca de folha no iOS); o selo passa a "Aguardando ajuste". J1: o banner "O narrador pediu um ajuste" com o motivo, em Editar e em Jogo; a lista diz "Aguardando ajuste" | `onda3-ios-se-SAIDA-devolver-01..07.png`, `onda3-web1280-SAIDA-devolver-01..07.png` | |

Cada linha só fica "ok" com a tarefa concluída de ponta a ponta, sem ajuda, na plataforma em que a persona não a concluiu.

### 10.7 Itens que dependem de mais de um pacote

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| X-selo | Web 390 e 1280; Android 360 e 393; iOS SE | N | "Lobisomem v3/v5", com a ficha de J1 avisada e o NPC "Figura Velada" oculto → aba Fichas → Mesa | Lista: "de roteiro_jogador1" com o selo "Avisou que terminou"; o NPC com "NPC" e o selo "Oculto", sem estado de ficha. Mesa: cartão compacto (recursos numa linha) com o selo de estado; seção "NPCs" com o selo "Oculto"; a 1280, grade de 3 colunas em cada seção; nome acessível da linha com o texto do selo | `onda3-<plat>-X-selo-01..04.png` | |
| X-ajuste-reenvio | Web 390 (J1) e 1280 (N); iOS SE (J1) | N e J1 | Depois do SAIDA-devolver: J1 ajusta, toca "Salvar" (com o nome acessível "Salvar alterações"), toca "Avisar que terminei" de novo → N vê o selo na Mesa → N conclui pelo menu → os dois abrem o Histórico → N abre Bastidores › Auditoria | O banner do ajuste some no aviso; "Avisou que terminou" de novo na Mesa; depois, "Concluída em dd/mm" (a data de hoje, no fuso local); Histórico com "Ajuste pedido", "Avisou que terminou" e "Criação concluída", **sem o motivo**; auditoria com "O narrador pediu um ajuste na ficha …" e "… avisou que terminou a ficha …", sem o motivo e sem código | `onda3-<plat>-X-ajuste-reenvio-01..07.png` | |
| X-barra | Android 360 e 411; iOS SE e 17; web 390 | J1 | Ficha livre em Editar com 1 alteração; ficha por pontos em Criação com a conta fechada | "Salvar" e "Avisar que terminei" (ou "Concluir criação") sem transbordo; a linha do próximo passo inteira; a altura da barra medida no `dump`/`describe-all` (perguntas 1 e 2 da seção 8) | `onda3-<plat>-X-barra-01..02.png` | |
| X-toast | Android 393; iOS SE; web 390 | J1 e N | J1: "Salvar" na Criação → segurar o dedo no aviso por 6 s → "Desfazer". N: dano em grupo na "Vampiro limite 20" → esperar 7 s → "Desfazer" | O aviso não some enquanto há toque (P09-C); o "Desfazer" desfaz nos dois; o aviso do grupo fica acima da barra de seleção | `onda3-<plat>-X-toast-01..04.png` | |
| X-datas | Web 390 (fuso de São Paulo); iOS SE (obrigatório: T-16 na edição) | N | Registrar a sessão de "2026-11-01" → Diário → Editar → Salvar sessão → lista de crônicas; concluir uma ficha → lista | "01/11/2026" no Diário e "Última sessão: 01/11" na lista; a edição salva (sem 400); "Concluída em dd/mm" com o dia local | `onda3-<plat>-X-datas-01..05.png` | |
| X-volta | iOS SE (obrigatório: T-39, T-81); Android 393 (voltar do Android); web 390 | N, depois J1 | N: Mesa → rolar → abrir uma ficha → "‹". J1: crônica → NPC revelado (identidade) → "‹" | N volta à Mesa, no mesmo ponto, com a seleção; J1 volta à crônica de origem, com "Voltar para {crônica}" | `onda3-<plat>-X-volta-01..04.png` | |

### 10.8 Pendências do iOS da onda 2 ([onda-2.md](onda-2.md) §10)

Na onda 2, o iOS só abriu o app e desenhou o login. Estes passos vêm da §7 de cada plano da onda 2 e rodam no iPhone SE (e no 17 onde o item é de layout):

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| O2-folha | iOS SE e 17 | N | "Mais opções" → "Histórico"; "Mais opções" → "Ações do narrador" → "Concluir criação?" (P08, perg. 2; P04-C) | A segunda folha abre depois da primeira sair (`onClosed`), sem tela presa | `onda3-ios-O2-folha-01..04.png` | |
| O2-P04-C | iOS SE | J1 e N | T-05 (IA-04: reabrir em Criação, "Recuperar"); T-06 (banner da devolução em até 30 s); T-32 (mesma confirmação pelo menu e pela barra); T-80 (Histórico só com "Criação concluída") | Como na tabela do P04-C §7 | `onda3-ios-O2-P04C-01..06.png` | |
| O2-P05-C | iOS SE | J1 | T-20 (o aviso na altura do toque); T-55 (some ao subir o Arete); T-18 (sobra de bônus na confirmação); R-17 (custo e extrato); R-28 (toast das prioridades); T-21 (rola e foca o Nome) | Como na tabela do P05-C §7 | `onda3-ios-O2-P05C-01..06.png` | |
| O2-P07-C | iOS SE | J1 | Teclado de software: "Adicionar Qualidade" → "Ambidestro" → Return (T-62); a recusa dentro da folha (T-19); "Custo 1" (T-23) | Entra "Ambidestro" inteiro; a frase dentro da folha | `onda3-ios-O2-P07C-01..03.png` | |
| O2-P08 | iOS SE e 17 | J1 e N | T-37 (abaixo da ilha); T-11 ("Mais opções"); T-27 (abas fixas, "Orçamento" sem voltar ao topo); T-10 (a folha sobe uma vez só com o teclado); T-26 ("Próximo") | Como na tabela do P08 §7 | `onda3-ios-O2-P08-01..05.png` | |

### 10.9 Itens obrigatórios no iOS, por pacote

Eles vêm das §11.e dos planos e rodam na integração mesmo que já tenham rodado no "PR local", porque os merges seguintes mexem nos mesmos arquivos:

| Pacote | Itens obrigatórios no iOS |
|---|---|
| P03-D | T-04 ("Salvar e sair" com o "‹" e com o gesto de voltar; a saída no `onClosed`) |
| P04-D | R-12f (o selo depois de fechar e abrir o app), R-14f (a folha do motivo pelo "Mais opções") |
| P09-C | T-39 (volta à Mesa no mesmo ponto), T-49 (barra de seleção fixa com as últimas fichas marcadas) |
| P11 | T-15 (a ficha revelada ocupa a tela e rola), T-16 na edição ("Salvar sessão" sem 400), T-46 (confirmação antes de revelar e toast depois), T-81 (o "‹" volta à crônica) |

### 10.10 Acessibilidade mínima

O estado novo e o selo aparecem como texto e com papel na árvore:

- **Web (DOM):** o selo é texto dentro do nome acessível da linha e do cartão. A barra de seleção tem `role="toolbar"`, e a contagem, `aria-live="polite"`. A folha do motivo tem rótulo no campo e o contador "N/500". As Notas do Narrador têm o "privadas" no nome do campo.
- **Android (`uiautomator dump`):** o texto do selo no `content-desc` da linha e no nó sob o nome. Os botões da barra têm o nome acessível "Salvar alterações", "Avisar que terminei" e "Concluir criação". A barra de seleção tem "Ações da seleção".
- **iOS (`describe-all`):** `staticText` com o texto do selo sob o nome. Os botões têm o `AXLabel` da barra, e a confirmação de revelar tem os dois botões.

O anúncio pelo VoiceOver e pelo TalkBack (a troca de selo com `live`, o banner do ajuste) fica para ouvir no aparelho, como o T-34 das ondas anteriores.

### 10.11 Limpeza

- Parar a API e o Metro.
- **Android:**
  - `adb shell wm density reset`;
  - `settings put secure show_ime_with_hard_keyboard 0`;
  - `adb reverse --remove-all`;
  - desligar o AVD.
- **iOS:**
  - `xcrun simctl shutdown all`;
  - encerrar o `idb_companion` e conferir que nada escuta (`lsof`);
  - "Connect Hardware Keyboard" de volta ao padrão;
  - desativar o venv. O venv fica em `~/.venvs/idb-tms`, e o build, no scratchpad.
- **Dados:** a aprovação de "Mago v4" e de "Vampiro v4" volta a "Desligada", ou o próximo seed apaga a rodada.
- O `git status` não mostra nada novo do roteiro: scripts e capturas ficam no scratchpad.

### 10.12 Quando uma plataforma não puder ser conferida

O resultado diz "não conferido", com o motivo. Exemplos:

- "fb-idb não sobe no Python 3.15 nem no 3.14: <erro>";
- "o `pip-audit` apontou <CVE> sem correção";
- "o AVD não iniciou".

Nunca "ok" sem a evidência.

**Onde os resultados entram.** Na integração, a coluna "Resultado" desta seção é preenchida, e uma seção nova, "11. Integração", entra neste documento, como a §10 do [onda-2.md](onda-2.md). Ela traz:

- os merges e as revisões;
- as perguntas técnicas e o que foi aplicado;
- os achados da integração;
- o resultado das suítes;
- a conferência manual por plataforma.
