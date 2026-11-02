# P09-C · Narrador: revisão e Mesa: plano de implementação

> Plano · 2026-11-02 · base conferida: `onda/3-estado-narrador` em `617264d` (ponta da onda 2; a mesma árvore da `main` `3a43ed8`, PR #41)

Este plano corrige o pacote [P09-C da matriz de achados](../testes/2026-11-01/matriz-achados.md#p09-c). O narrador revisa a ficha do jogador em Leitura, vendo a conta da criação, e só edita pelo "Editar como narrador". As Notas do Narrador dizem que são privadas. A Mesa mostra dados atuais e cabe na tela: cartão compacto, grade nas telas largas, barra da seleção fixa embaixo, "1 selecionado (máx. 20)", um "Desfazer" que dá tempo de tocar e quem fez a última alteração. A crônica volta na aba e no ponto onde o narrador estava. É um pacote de correção:

- não muda regra do jogo, não remove campo e não afrouxa limite. As 20 fichas por operação continuam (`MAX_TARGETS`, `apps/api/src/chronicles/operations.ts:42`);
- a Leitura do narrador é só interface. O servidor continua aceitando e assinando a edição do narrador como hoje, e a AuthZ não muda;
- as Notas do Narrador continuam fora do aparelho do jogador. O R-09 só põe o rótulo.

O pacote muda uma resposta da API (a Mesa ganha `lastChange`, §3.11) e a API pública do `Toast` do `@tms/ui` (§3.10). Não tem migration.

Todas as linhas citadas são do `617264d`. A matriz cita o `1db3db9`, de antes das ondas 1 e 2. Onde a causa provável da matriz está errada, a seção 3 diz.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md), "Como executar", "Decisões de produto" e §P09-C | Itens, "PR local", ondas empilhadas e critério de saída da onda |
| [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) §5 ("Observações": Notas do Narrador) e §7; [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §1 (C1), §4.1 passo 14 e §4.2 | Recomendações e a tarefa "devolver" dos narradores |
| Notas: [narrador-web](../testes/2026-11-01/notas/narrador-web.md) (NW-17, NW-21, NW-25, NW-30), [narrador-app](../testes/2026-11-01/notas/narrador-app.md) (NA-17, NA-25, NA-27), [qa-web](../testes/2026-11-01/notas/qa-web.md) (QAW-31, QAW-40), [qa-app](../testes/2026-11-01/notas/qa-app.md) (QAA-13, QAA-18, QAA-22, QAA-29, QAA-31), [po-app](../testes/2026-11-01/notas/po-app.md) (POA-26, POA-39, POA-42; diário 15:25 e 15:30), [po-web](../testes/2026-11-01/notas/po-web.md) (POW-14) | Cenários do critério de pronto |
| [avaliacao-ui-ux.md](../avaliacao-ui-ux.md) C-19 (l.530) e C-20 (l.536) | Leitura segura do narrador; preservar aba e rolagem |
| [validacao-v5.md](../validacao-v5.md) l.120–122 e l.154–156; [proximas-features.md](../proximas-features.md) §2.1 item 1 e §2.2 item 8 | A barra da Mesa fora da tela no Android; "Cache já visto"; Mesa ao vivo e push (fora) |
| [plano-v3.md](../plano-v3.md) Etapa 9 e [plano-v5.md](../plano-v5.md) (transferência, l.150–155) | Mesa, navegação entre fichas e aceite da narração |
| `design/design-system/components.md` ModeBar (l.554–565), ListItem / CharacterCard (l.694–705) e Toast (l.612–622) | Variantes do narrador, cartão da Mesa e o `--dock-offset` do aviso |
| [onda-1.md](onda-1.md) §6 e §9; [onda-2.md](onda-2.md) §4.4, §4.7, §6 e §10; [P04-C](P04-C-ciclo-vida-ficha.md) §3.2 e §10; [P08](P08-layout-teclado.md) §3.10, §3.12 e §10; [P06](P06-componentes-acessibilidade.md) | O que as ondas 1 e 2 entregaram e as lições da integração |

## 1. Objetivo e itens

**Objetivo (matriz).** O narrador revisa em leitura sem editar sem querer, as Notas do Narrador dizem que são privadas, a Mesa mostra dados atuais e cabe na tela, e a crônica volta para onde ele estava.

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| R-09 | alta | O editor das Notas do Narrador não diz que elas são privadas; os dois narradores escreveram ali recados que o jogador nunca lê | `apps/frontend/sheet/layouts/TextLayout.tsx:20-45`; `apps/frontend/sheet/storyteller/StorytellerBar.tsx:63-73`, `:87-128`. Privacidade no servidor: `stripRestricted` em `apps/api/src/sheets/routes.ts:406`, `:522`, `:565` e `apps/api/src/chronicles/table.ts:96`; seção `storyteller` do template (`design/templates/vtm-v20.json:780-786`) |
| T-33 | média | Os chips "Criação", "Jogo" e "Editar" põem o narrador em edição sem o "Editar como narrador"; ver a conta exige entrar em Criação, que já edita; o "Editar como narrador" só vai a Jogo | `apps/frontend/sheet/evolve/ModeBar.tsx:48-54` (`OTHER_MODES`, `OTHER_CREATE`), `:84-95`, `:205`; `StorytellerBar.tsx:43-50` (`setMode('play')`); `apps/frontend/sheet/SheetView.tsx:180` (aba Orçamento só em `create`) |
| T-39 | média | Ao voltar de uma ficha aberta pela Mesa, a crônica volta ao topo e à aba Fichas | `apps/frontend/sheet/SheetScreen.tsx:129-134` (o "‹" faz `router.replace`); `apps/frontend/app/(app)/chronicles/[id]/index.tsx:46` (aba em `useState`; a matriz cita l.42) |
| T-40 | média | Telas que não refazem a consulta: pedido de XP na Mesa do app, lista de crônicas no Android, ficha aberta e a tela depois de "Aceitar narração" | `apps/frontend/components/chronicles/TableView.tsx:145-148` (o foco não rebusca os pedidos de XP); `apps/frontend/app/(app)/index.tsx:62-90` (sem foco e sem puxar); `apps/frontend/lib/queries/creation.ts:12-30` (aprovar não invalida a lista); `apps/frontend/lib/queries/backstage.ts:123-125` (`queryClient.clear()`) |
| T-48 | média | Cartão da Mesa de ~255 px, com os recursos empilhados numa coluna, mesmo em 1280 | `apps/frontend/components/chronicles/TableRow.tsx:135-142`, `:163` (`chips` sem `flexDirection: 'row'`); `TableView.tsx:299-308` (uma coluna em qualquer largura) |
| T-49 | média | Com a seleção no fim da lista, contagem e botões ficam lá em cima, fora da tela | `TableView.tsx:216-276` (contagem e ações dentro da rolagem da crônica, `[id]/index.tsx:90`) |
| T-75 | baixa | "1 de 20 selecionados" lê-se como total de fichas; com a Mesa vazia, "0 de 20" | `TableView.tsx:226`, `:134-143` (o 21º toque é ignorado em silêncio), `:216-223` |
| T-76 | baixa | O "Desfazer" da operação em grupo some em ~5 s, antes do toque | `packages/ui/src/Toast.tsx:43-44`, `:80-90`; `apps/frontend/components/chronicles/OperationSheet.tsx:137-145` |
| T-83 | baixa | Depois de o narrador salvar uma nota, o cartão diz "<jogador> · alterada às 13:15" | `TableRow.tsx:43`; a resposta da Mesa não traz o autor (`apps/api/src/chronicles/table.ts:56-99`), que está em `character_batches.created_by` e `by_role` (`apps/api/src/sheets/events.ts:338-348`) |

## 2. Decisões aplicadas

**O P09-C não tem decisão própria (D-xx).** É correção. As decisões desta onda e da onda 5 encostam nele assim:

| Decisão | O que diz | Como o P09-C acomoda |
|---|---|---|
| D-01 (P03-D) | "Salvar" sempre na barra de criação; o "Concluir" do Editar passa a "Salvar alterações" | O T-33 não mexe nos rótulos nem na barra de ação (`EvolveBar`, `SummarySheet`). Muda só quais modos o narrador vê e quando (§3.2). Os specs novos já usam "Salvar alterações" (§4.3) |
| D-02 (P04-D) | Estado da ficha sob o nome, na lista, na aba Fichas e na Mesa | O cartão novo (T-48) tem uma linha de selos onde entra o selo do P04-D (nome provisório `StateBadge`) no lugar do texto `state` de hoje (`TableRow.tsx:107-113`). O P09-C não cria estado nem texto de estado |
| D-03 (P04-D) | "Avisar que terminei" mostra um selo ao narrador na Mesa; push depois | Mesma linha de selos. O foco e o puxar do T-40 fazem o aviso aparecer sem esperar o cache vencer. **O push fica fora** (`proximas-features.md` §2.2 item 8) |
| D-04 (P04-D) | "Pedir ajuste" com motivo, só do narrador; "Reabrir criação" fora do ciclo | O rótulo do R-09 aponta o canal certo: na ficha em criação, o editor das notas diz "Para pedir uma correção ao jogador, use 'Pedir ajuste' em Ações do narrador" (§3.1). **"Reabrir criação" fica fora:** é registrado em `proximas-features.md` pelo P01-D (onda 5) |
| D-10 (P09-D, onda 5) | Cartão da Mesa com o progresso, filtro "Em criação / Pendentes", contagem na lista, Orçamento em leitura para o narrador (inclusive em `pending`) | **O progresso na Mesa, o filtro e a contagem são do P09-D.** O cartão do T-48 deixa uma linha livre para o progresso. O T-33 entrega a conta em Leitura em `creating`, que é o "esperado" da matriz. O P09-D a estende ao `pending` |

**O que o código mostra sobre as decisões** (apontado, não decidido):

1. **D-10 × T-33.** "Ver a conta em leitura" (o esperado do T-33) e "o Orçamento em leitura para o narrador dentro da ficha" (D-10) são a mesma tela em `creating`. O P09-C a entrega na onda 3, porque o T-33 pede. Para o P09-D sobra o `pending` (uma condição em `useCreating`, `apps/frontend/sheet/creation/CreationPanel.tsx:58-63`), a Mesa e o painel. Se o PO quiser a conta em Leitura só na onda 5, o T-33 fica só com "editar pelo botão" (pergunta 2).
2. **POA-39 pede um aviso "1 pedido de XP aguarda" na lista de crônicas.** A recomendação do T-40 na matriz é só rebuscar e conferir a Mesa. O aviso na lista seria dado novo na API (uma contagem de pedidos por crônica, como a `pendingReview` de `apps/api/src/chronicles/routes.ts:321-330`). Fica para o PO.

**Pontos para o PO das ondas 1 e 2 que encostam aqui** (continuam abertos; nenhum é tratado como decidido):

- **onda-2 §6.8 (dois toques do narrador até as ações no celular).** O P09-C não muda o "Mais opções" do P08. Mas o T-33 acrescenta um toque num caso: na ficha **em criação**, marcar um recurso em Jogo passa a ser "Editar como narrador" → "Jogo" (hoje o chip "Jogo" fica à vista em Leitura). Na ficha em uso, o "Editar como narrador" continua levando a Jogo em um toque (§3.2).
- **onda-2 §6.4 (abertura em Editar na crônica livre).** O T-33 não muda a abertura do dono (`openingMode`, `SheetScreen.tsx:326-337`): o narrador continua abrindo em Leitura.
- **onda-2 §6.6 (extrato no Histórico).** Não toca este pacote.

## 3. Desenho por item

### 3.0 O que o código faz hoje (explica as causas)

- **Modos do narrador.** Quem escreve sem ser dono recebe o seletor "Leitura · Jogo · Editar" ou "Leitura · Jogo · Criação" (`ModeBar.tsx:51-54`, `:86-95`). "Jogo" grava na hora, e "Editar" e "Criação" abrem o rascunho (`switchTo`, `:118-126`). O "Editar como narrador" troca para `play` direto no store (`StorytellerBar.tsx:44-50`), sem passar pelo `switchTo`. A aba Orçamento só existe em `create` (`SheetView.tsx:180`). O design system já desenha o narrador sem seletor: Leitura com "Editar como narrador", e Narrador com "Voltar à leitura" (`components.md` l.559).
- **Navegação.** A pilha é Crônicas → `chronicles/[id]` (push) → `characters/[id]` (push, `TableView.tsx:163-169`). "Anterior/Próxima" trocam de ficha com `replace` (`TableNav.tsx:28-30`, `:81`). O "‹" da ficha faz `router.replace('/chronicles/<id>')` (`SheetScreen.tsx:129-134`): monta **outra** tela de crônica, com a aba em `useState('sheets')` (`[id]/index.tsx:46`) e a rolagem no topo. O gesto de voltar do iOS e o voltar do Android fazem `pop` e voltam à tela de baixo, que continua montada. O `ErrorBoundary` da ficha já usa `canGoBack ? back() : replace` (`app/(app)/characters/[id].tsx:42-43`).
- **Rebusca.** `staleTime` de 30 s no padrão (`lib/queryClient.ts:17`). No nativo, o `focusManager` segue o `AppState` (`app/_layout.tsx:22-32`), e as queries vencidas rebuscam quando o app volta. A rebusca no foco da tela existe na ficha (`SheetScreen.tsx:112-117`), na lista da crônica (`CharacterList.tsx:169-174`) e na Mesa (`TableView.tsx:145-148`), que não inclui os pedidos de XP (`xpKeys.table`, `lib/queries/xp.ts:109-122`). A lista de crônicas (`app/(app)/index.tsx:24`) não rebusca no foco e não tem "puxar para atualizar". Nenhuma tela tem `RefreshControl`.
- **Cache persistido.** Só templates e `['characters', id]` vão para o disco (`lib/persist.tsx:55-75`). Lista de crônicas, crônica, Mesa, pedidos de XP e transferência não são persistidos: depois de reabrir o app, eles vêm do servidor, com o esqueleto. A ficha vem do disco primeiro e é corrigida pela resposta (o caso do `c7c1423`, [onda-2.md](onda-2.md) §10).
- **Toast.** Um aviso por vez, 5 s, ou 10 s com leitor de tela (`Toast.tsx:43-44`, `:85-87`). Já aceita `durationMs`, que ninguém usa. Fica em `position: absolute` a 16 dp do fundo, mais o inset (`:141-143`). Não pausa com ponteiro, foco nem toque. O DS prevê subir acima do dock (`--dock-offset`, `components.md` l.616), que o app não implementa.

### 3.1 R-09 · As Notas do Narrador dizem que são privadas

**Causa confirmada.** O template marca a seção "Narrador" com `read` e `write` só para `storyteller` (`vtm-v20.json:780-786`; o M20 em `mta-m20.json:819` e o W20 em `wta-w20.json:920` fazem o mesmo). O servidor tira o campo de toda saída para o dono (`stripRestricted`). A tela não diz isso: o bloco de leitura mostra só o rótulo do campo (`TextLayout.tsx:33-35`), e a folha de edição, só o título e o campo (`StorytellerBar.tsx:108-126`).

**O que muda.** A regra vem das permissões do template, não do nome do campo:

- **`hiddenFromOwner(model, fieldId)`** (novo, em `StorytellerBar.tsx`, ao lado de `storytellerOnlyText`): `canRead(model, id, ['storyteller']) && !canRead(model, id, ['owner'])` (`packages/sheet-core/src/permissions.ts:42-52`).
- **Leitura** (`TextBlock`, `TextLayout.tsx:20-45`): com `hiddenFromOwner`, a legenda passa a "Notas do Narrador · privadas: o jogador não vê". O nome acessível do bloco ganha a mesma frase.
- **Edição** (`TextFieldSheet`, `StorytellerBar.tsx:87-128`): a primeira linha do corpo da folha diz "Privadas: o jogador não vê estas notas." Na ficha em criação, uma segunda linha aponta o canal do P04-D: "Para pedir uma correção ao jogador, use 'Pedir ajuste' em Ações do narrador." O título da folha e o nome do campo continuam "Notas do Narrador", porque o E2E os usa (`table.spec.ts:76-78`, `journey.spec.ts:216-218`).
- **O botão "Editar Notas do Narrador"** (`:66-71`) ganha `accessibilityHint` "Privadas: o jogador não vê".

Nada muda no servidor nem no que o dono recebe.

### 3.2 T-33 · O narrador revisa em Leitura, com a conta, e edita só pelo "Editar como narrador"

**Causa confirmada** (seção 3.0). O "Editar como narrador" não abre a edição: só passa a Jogo. Os chips abrem a edição sem o botão. As duas notas pedem o mesmo: "o botão abre a edição; a conta visível também em Leitura" (NA-27), e "edição só pelo botão explícito" (NW-21).

**O que muda.** Vale para o narrador na ficha alheia (`storyteller` sem `owner`). O dono, o narrador na própria ficha e o NPC não mudam, porque o NPC tem `owner` no papel do narrador.

- **Em Leitura, sem seletor de modo.** No `useModeBar`, para o narrador:
  - `switcher` é `null` enquanto `mode === 'read'` (`ModeBar.tsx:205`);
  - a lista de modos passa a ser a do dono: "Jogo · Criação" ou "Jogo · Editar" (`OWNER_CREATE`, `OWNER_MODES`, `:50-53`). Ela só aparece depois do "Editar como narrador";
  - o `back` aceita `read` como modo de volta (`:114-116`). Quem entrou na edição pela Leitura volta à Leitura depois de salvar ou descartar.

  O texto e os rótulos da barra de ação não mudam (D-01 e D-03 são do P03-D e do P04-D).
- **A conta em Leitura** (`SheetView.tsx:180`): a aba Orçamento aparece também em `read` para o narrador na ficha em criação por pontos (`useCreating()`). Duas condições separam o que é de leitura do que é de edição:
  - `budgetTab`: a aba e o `CreationPanel`;
  - `budgetEdit`: o `BonusNotice` (`:361`) e os avisos de recusa (`CreationAlerts`, `:268`), que continuam só em `create`.

  No `CreationPanel`, as "Regras da casa" do narrador (`BudgetControls`, `CreationPanel.tsx:242`, `:499-560`) ficam fora da Leitura, como hoje (só existiam em `create`). A escolha "Pontos básicos / Pontos de bônus" (`:189-201`) continua: é estado de tela e não grava no servidor. O `check` já existe em qualquer modo ([onda-2.md](onda-2.md) §4.1).
- **"Editar como narrador" abre a edição de fato.** O `StorytellerBar` passa a usar o `go` da `useModeBar`, que entra no rascunho com `startDraft` e passa pelo resumo ao sair com alterações. O `go` chega à barra do narrador por um contexto novo (`ModeBarActions`), que o `ModeBarSlots` dá (`SheetView.tsx:147-155`). O destino:
  - **criação por pontos ativa** (`creating` ou `pending`): Criação;
  - **criação livre em `creating`**: Editar;
  - **ficha em uso**: Jogo, como hoje. O narrador marca dano na sessão com um toque, e "Jogo · Editar" ficam à vista para trocar (pergunta 1).
- **"Voltar à leitura"** chama `go('read')`. Com alterações, abre o resumo de salvar ou descartar, que já existe. Hoje o botão faz `setMode('read')` direto (`StorytellerBar.tsx:45`).
- **Sem o `ModeBarActions`** (o narrador sem escrita, pela política), o botão "Editar como narrador" não aparece. Hoje ele aparece e não faz nada útil.
- **Anúncio:** "Editando como narrador. As alterações ficam assinadas no histórico." fica como está (`:46-49`). O "Modo Criação" do `switchTo` vem depois.

**Linhas que mudam na `ModeBar`:** `:48-54` (comentário e listas), `:84-95` (`modes`), `:114-116` (`back`), `:205` (`switcher`) e o retorno (`:259`), que passa a levar `go`. O `EvolveBar`, o `SummarySheet` e os textos não mudam.

**Fica para o P09-D (D-10):** a conta em Leitura no `pending` e o Orçamento na Mesa.

### 3.3 T-39 · A crônica volta na mesma aba e no mesmo ponto

**Causa confirmada** (seção 3.0). O "‹" troca a ficha por uma crônica nova. A aba nasce em "Fichas" e a rolagem, no topo. O C-20 e o UX-19 pedem para preservar os dois. O protótipo já guarda a visão na URL (`design/telas/prototipo.js:6171-6199`, `view` no hash).

**O que muda:**

- **A aba na URL:** `/chronicles/<id>?view=table|backstage`. "Fichas" é o padrão, sem parâmetro.
  - A tela lê `view` com `useLocalSearchParams` (`[id]/index.tsx:40`), no lugar do `useState` (`:46`).
  - O `onSelect` das abas (`:134`) chama `router.setParams({ view })`.
  - Valor desconhecido vira "Fichas". O jogador com `?view=table` também cai em "Fichas" (fail secure): a aba nem existe para ele (`:121-132`), e a API dá 404.
  - O link direto e o F5 no web abrem a aba certa.
- **O "‹" da ficha volta à tela de baixo:** `router.canGoBack() ? router.back() : router.replace('/chronicles/<id>')`, o mesmo padrão do `ErrorBoundary`. A tela de baixo continua montada no nativo, com a aba, a rolagem, os filtros e a seleção da Mesa. `Anterior/Próxima` continuam com `replace`, então a tela de baixo de qualquer ficha da Mesa é sempre a crônica. O `LeaveGuard` (`usePreventRemove`) intercepta o `back` como já intercepta o `replace`. **Não usar `dismissTo`:** ele volta à tela com os parâmetros novos e apagaria o `view` (pergunta 3).
- **A rolagem.** Um mapa em memória, `chronicleId:view → y`, num módulo novo (`components/chronicles/chronicleScroll.ts`), guarda a rolagem a cada `onScroll` (`scrollEventThrottle` 64, `ScrollView` de `[id]/index.tsx:90`). Ao ganhar foco (`useFocusEffect`) e quando o conteúdo cresce até a altura guardada (`onContentSizeChange`), a tela faz `scrollTo({ y, animated: false })` uma vez. No nativo, isso não muda nada (a tela não desmontou). No web, cobre o caso de o Expo Router desmontar a tela de baixo (pergunta 4). São só números, nada vai para o disco, e o mapa é apagado no logout com o resto da sessão.
- **Com o P11 (T-81).** O T-81 é o mesmo "‹" (`SheetScreen.tsx:129-134`), no caso da identidade revelada, que hoje cai em Crônicas porque o `chronicle` é `null`. Acordo da consolidação ([onda-3.md](onda-3.md) §4.8): o P09-C cria o helper `useSheetBack` em `sheet/navigation.ts`, no commit 9. O P11 entra antes e só faz a `chronicle` valer também na identidade revelada (T-81); o helper a usa. Com o `router.back()`, a volta pela pilha também cobre o T-81 dentro do app, e a crônica na projeção cobre o link direto.

### 3.4 T-40 · Lista, crônica, Mesa e ficha com dados atuais, sem polling

**Causas confirmadas pelo código**, item a item da matriz:

1. **Pedido de XP na Mesa do app.** O botão "Pedidos de XP (N)" existe no nativo: é o mesmo `TableView` (`:208-215`), sem arquivo por plataforma. A causa suposta pela matriz ("o botão não existe no nativo") não é a do código. A causa é que a rebusca da Mesa no foco (`:145-148`) refaz a Mesa e as rolagens, mas não os pedidos de XP. Com a crônica aberta antes do pedido e menos de 30 s de cache, ou voltando de uma ficha, o botão não aparece.
2. **Lista de crônicas no Android.** A lista não rebusca ao ganhar foco e não tem `refreshing`/`onRefresh` no `FlatList` (`app/(app)/index.tsx:62-90`). Aprovar, devolver ou concluir invalidam a ficha, a Mesa e a lista da crônica (`lib/queries/creation.ts:12-30`), mas não a lista de crônicas (`chronicleKeys.all`), onde está o "1 ficha aguarda revisão" (`app/(app)/index.tsx:81-83`).
3. **Ficha aberta que não muda quando o narrador devolve.** Já está corrigido no P04-C: polling de 30 s em `pending` (`sheet/data.ts:48-74`) e foco da janela no web (`lib/queries/focus.ts:11-32`). O P09-C só acrescenta o puxar para atualizar (commit 11).
4. **Tela parada depois de "Aceitar narração".** O `useAcceptTransfer` chama `queryClient.clear()` no sucesso (`lib/queries/backstage.ts:123-125`). O `clear` tira as queries do cache sem avisar quem está na tela, e os `useQuery` montados continuam com o dado antigo (papel `player` e o convite) até a tela remontar.

**O que muda:**

- **Mesa:** a rebusca no foco inclui `xpKeys.table(chronicleId)` (`TableView.tsx:145-148`).
- **Crônica** (`[id]/index.tsx`):
  - `useRefetchOnFocus` invalida o prefixo `chronicleKeys.one(id)` com `cancelRefetch: false`. Rebuscam só as queries montadas: a crônica e as da aba aberta (fichas; Mesa e rolagens; sessões, transferência e registro);
  - `refreshControl` no `ScrollView` (`:90`), que espera a mesma invalidação mais a dos pedidos de XP.
- **Lista de crônicas:** `useRefetchOnFocus` e `refreshing`/`onRefresh` no `FlatList`.
- **Concluir, aprovar e devolver** (`useRefresh`, `lib/queries/creation.ts:12-30`) passam a invalidar também `chronicleKeys.all`.
- **Aceitar a narração:** `queryClient.resetQueries()` no lugar do `clear()`. As queries voltam ao estado inicial e as montadas rebuscam com o papel novo. A tela troca "Narrador: …" por "Você narra esta crônica.", e as abas viram "Fichas · Mesa · Bastidores" sem sair. Um aviso diz "Agora você narra esta crônica." (POW-14). O logout continua com `clear()` (`SessionProvider.tsx:30`).
- **Ficha** (commit 11, sai sozinho): `onRefresh` opcional no `SheetView`, com `refreshControl` no `ScrollView` (`SheetView.tsx:347-358`). O `LiveSheet` passa a invalidação da ficha (`SheetScreen.tsx:545-554`). O que volta passa pelo `received` do store (`:525-528`), que já confere a versão e o conflito com o rascunho.
- **"Puxar"** usa um estado local `refreshing` que só fica ligado durante o puxão, e não o `isFetching`. Assim o indicador não pisca a cada rebusca de fundo. O helper é `usePullRefresh(...refetches)`, em `lib/queries/focus.ts`.

**Custo.** Nenhum intervalo novo. A cada foco de tela, e no web a cada foco da janela, são de 2 a 5 GETs: a crônica e as queries da aba aberta, mais os pedidos de XP na Mesa. Com `cancelRefetch: false`, nenhum pedido duplica quem já está em voo. As rotas são as mesmas de abrir a tela, com a mesma AuthZ, e os limites de taxa da API são só de escrita (`sheets/events.ts:181`, `chronicles/routes.ts:625`, `rolls/routes.ts:245`). O polling continua sendo só o do P04-C (dono, `pending`, 30 s).

**O que o cache mostra antes.** As telas deste item não estão no cache persistido (seção 3.0). Ao reabrir o app, elas mostram o esqueleto até a resposta. Com o app aberto, elas mostram o último dado em memória enquanto rebuscam, e a Mesa diz a idade dele ("Atualizado há N min", `TableView.tsx:94-115`). A ficha é a única que vem do disco, e a correção do estado é a do `c7c1423`.

### 3.5 T-48 · Cartão da Mesa compacto e grade nas telas largas

**Causa confirmada.** Os chips do dock ficam num `View` sem `flexDirection: 'row'` (`TableRow.tsx:137-141`, estilo `:163`), dentro da coluna de texto (`:98`). Os três recursos ficam empilhados, a ~250 pt por cartão. A lista é uma coluna em qualquer largura (`TableView.tsx:299-308`).

**O que muda:**

- **O cartão:**
  1. linha de cima: avatar e coluna de texto, com o nome em até 2 linhas, o selo de identidade (`chip`) e a meta (§3.9);
  2. linha de selos (estado, alertas e, depois do P11, a visibilidade do NPC; `:107-126`);
  3. **os recursos numa linha, na largura inteira do cartão**: um `FieldSlot` `chip` por campo do dock, cada um com `flex: 1` e `minWidth: 0`, como o `CombatDock` (`sheet/play/CombatDock.tsx:147-163`). A 390, dá ~119 dp por recurso, como no dock da ficha.

  Altura esperada: ~130 a 150 dp, contra ~250, ou seja, ~5 cartões por tela a 390, contra ~3. O nome acessível da linha não muda (`:52-77`).
- **A grade:** `columns = clamp(floor(larguraÚtil / 340), 1, 3)`, com a largura limitada a 1200 (`Screen`, `packages/ui/src/Screen.tsx:38`). Com `stacked` (fonte ≥ 130% ou largura < 360, `theme.tsx:161-167`), uma coluna. Ficam:
  - 390: 1 coluna;
  - 750: 2;
  - 1280: 3.

  Na grade, cada cartão tem borda e raio, e na coluna única, o separador de hoje. A ordem de leitura e de Tab segue a ordem da lista, linha a linha.
- **A seção de NPCs do P11 (T-52)** usa a mesma grade, com o próprio título.

### 3.6 T-49 · Barra da seleção fixa embaixo

**Causa confirmada.** A contagem e as ações (`TableView.tsx:224-276`) ficam no topo da Mesa, dentro da rolagem da crônica (`[id]/index.tsx:90-183`). A matriz diz que "a seleção se perde a cada operação". **O código mostra outra coisa:** o `selected` continua depois da operação (`TableView.tsx:126`, `:324-331`), e o `journey-storyteller.spec.ts:192` já aplica "Nova noite" logo depois do dano, com as duas fichas ainda marcadas. A seleção se perde:

- no "Cancelar seleção" (`:216-222`), que a PO usou para sair do modo e voltar ao topo;
- na troca "Em jogo / Arquivadas" (`:183-186`);
- e hoje, ao voltar de uma ficha, porque o "‹" monta outra crônica (T-39).

**O que muda:**

- **A seleção sobe para a crônica.** Arquivo novo `components/chronicles/TableSelection.tsx`, com:
  - `TableSelectionProvider`, no `ChronicleScreen`, em volta do `ScrollView` e da barra;
  - `useTableSelection()`: `selecting`, `selected`, `toggle`, `clear`, `stop` e `chosen`. O `chosen` são os `TableItem` marcados, que o `TableView` atualiza a partir dos itens dele;
  - `TableActionBar`: a barra.

  Uma alternativa seria um store global, como o `useTableOrder`. O desenho fica com o contexto: o estado morre com a tela, e nenhum dado de ficha fica em memória depois de sair.
- **A barra** é irmã do `ScrollView`, abaixo dele. Ela não rola e fica acima da safe area, que o `Screen` já aplica uma vez (T-37). Aparece enquanto a seleção estiver ligada:
  - contagem (T-75) e "Limpar seleção" (`ghost`): limpa e continua selecionando;
  - "Aplicar dano", "Curar", "Conceder XP" e as recuperações do template, os mesmos de hoje (`:228-268`), com as mesmas condições (`online`, `grantable`, recuperação comum a todas);
  - abaixo de 600, os botões numa linha com rolagem lateral; a partir de 600, quebram em linhas (pergunta 5);
  - `role="toolbar"` com o nome "Ações da seleção".
- **As folhas** (`OperationSheet`, `GrantXpSheet`) passam a ser abertas pela barra, com a mesma API da `BottomSheet`. Não podem regredir:
  - o Esc na captura, inclusive na folha sem campo em autoFocus (`f3f3b8a`);
  - o foco de volta ao gatilho, que passa a ser o botão da barra;
  - o diálogo central de 560 a partir de 600;
  - o `onClosed` da troca de folha no iOS.
- **O topo da Mesa** fica com "Pedidos de XP (N)" e "Selecionar personagens" / "Cancelar seleção". O botão de selecionar some com a Mesa vazia (NW-17).
- **O aviso não cobre a barra:** a barra registra a altura dela com `useToastOffset` (seção 3.10), e o "Desfazer" aparece logo acima.
- **O voltar do Android** com a seleção ligada desliga a seleção primeiro (`BackHandler`), como a barra de ação contextual do Android. O segundo voltar sai da crônica.
- **Depois da operação**, a seleção fica, como hoje. Agora coberta por teste (§4.1).

### 3.7 T-75 · "1 selecionado (máx. 20)"

- **`selectionLabel(n)`**, função pura em `TableSelection.tsx`:
  - 0: "Nenhum selecionado (máx. 20)";
  - 1: "1 selecionado (máx. 20)";
  - n: "n selecionados (máx. 20)".

  O texto fica na barra, com `aria-live="polite"`. O 20 vem de uma constante do app, `TABLE_SELECTION_MAX`, com comentário apontando o `MAX_TARGETS` da API. O limite não muda.
- **O 21º toque** não marca, como hoje (`TableView.tsx:139`), e agora explica: "Máximo de 20 por operação.", na barra, com `accessibilityRole="alert"`.
- **Mesa vazia:** sem "Selecionar personagens" (NW-17).

### 3.8 T-76 · Um "Desfazer" que dá tempo de tocar

- **No `Toast`** (seção 3.10):
  - o prazo pausa enquanto há ponteiro em cima (web), foco dentro (teclado) ou toque no aviso (nativo, `onTouchStart`/`onTouchEnd`);
  - ao soltar, ele volta com o que faltava, nunca menos de 2 s;
  - com leitor de tela, o prazo nunca fica abaixo dos 10 s de hoje, mesmo com `durationMs` menor.
- **Na operação em grupo:** o aviso "Dano aplicado em N personagens." passa `durationMs: 10_000` (`OperationSheet.tsx:137-145`). A operação mexe em até 20 fichas e pede conferência antes de desfazer. Os outros avisos ficam com os 5 s do DS.
- **O "Desfazer" do Histórico continua** sem prazo. É a rede quando o aviso some (DS, Toast, "A11y").

### 3.9 T-83 · "alterada por você às 13:15"

**Causa confirmada.** A meta é `${owner} · alterada ${whenLabel(updatedAt)}` (`TableRow.tsx:43`). O `updated_at` muda com qualquer escrita (lote, trava, status, operação, retrato: `sheets/events.ts:331`, `sheets/status.ts:64`, `chronicles/operations.ts:192`, `sheets/routes.ts:631`), e a resposta não diz quem foi. O autor está no lote: `character_batches.created_by` e `by_role`, com índice em `(character_id, created_at)` (`packages/db/src/migrations/0011_character_sync.ts:48-52`).

**O que muda:**

- **API** (seção 3.11): cada linha da Mesa ganha `lastChange: { at, by: 'you' | 'owner' | 'other' } | null`, do último lote da ficha. O `by` é calculado no servidor contra quem pede e contra o dono, e a resposta não leva o id nem o nome de quem fez.
- **App:** `changeLabel(row, when)` em `tableItems.ts`:
  - `you`: "<dono> · alterada por você às 13:15". No NPC, que é do narrador: "alterada por você às 13:15";
  - `owner`: "alterada por <dono> às 13:15". O nome aparece uma vez;
  - `other` (outro narrador, depois de uma transferência, ou conta excluída): "<dono> · alterada às 13:15";
  - sem `lastChange` (ficha sem lote, ou a API antiga): o texto de hoje, com o `updatedAt`.

  A hora é a do lote. A ordenação "Última alteração" continua pelo `updatedAt` (`tableItems.ts:93-106`).

### 3.10 API pública do `@tms/ui`: o que muda

Nenhuma prop sai. Lição da onda 1 (S-01): o `src` do `@tms/ui` compila no app com o JSX do React, e só o nativo mostra defeito de estilo. Por isso a conferência no aparelho (§11) vem antes do merge.

| Componente | Mudança | Compatibilidade |
|---|---|---|
| `Toast` (`ToastProvider`, `ToastView`) | `show({ message, action?, durationMs? })` igual. O prazo pausa com ponteiro, foco ou toque no aviso e volta com o que faltava (mínimo de 2 s). Com leitor de tela, `durationMs` nunca fica abaixo de `TOAST_SCREEN_READER_MS` | Todos os usos herdam a pausa. Nenhum passa `durationMs` hoje |
| `useToastOffset(height: number)` (novo) | Enquanto montado, ergue o aviso `height` dp acima do fundo. Com vários, vale o maior. É o `--dock-offset` do DS | Novo, exportado no `index.ts` |
| `TOAST_MS`, `TOAST_SCREEN_READER_MS` | Iguais | — |

**O que o P11 recebe (T-46, aviso depois de revelar):** o mesmo `toast.show({ message })`, sem `action`, porque revelar não se desfaz para quem já viu. Ele herda a pausa e o mínimo do leitor de tela. Se quiser mais que 5 s, passa `durationMs`. O `CombatDock` também poderia usar o `useToastOffset`: fica como nota para o P13, fora deste pacote.

`design/design-system/components.md` (Toast, l.612–622) passa a descrever a pausa e o `useToastOffset`.

### 3.11 API HTTP: o que muda

| Rota | Mudança | Compatibilidade |
|---|---|---|
| `GET /chronicles/:id/table` | Cada item ganha `lastChange: { at: string; by: 'you' \| 'owner' \| 'other' } \| null`. É uma subconsulta do último `character_batches` da ficha (`order by created_at desc limit 1`, que usa o índice `character_batches_history_idx`). `by`: `you` quando `created_by` = quem pede; `owner` quando `created_by` = `ch.user_id`; `other` no resto, inclusive `created_by` nulo | Campo novo; o app antigo o ignora. AuthZ igual: só o narrador da crônica, os outros recebem 404 (`table.ts:42-43`). Sem migration |

O P04-D também mexe nesta rota (estado "Aguardando ajuste" e o aviso de "terminei" na Mesa). A seção 8.4 diz a ordem.

## 4. Testes

### 4.1 Um teste de regressão por bug (falha antes, passa depois)

| Item | O que o teste prova | Arquivo | Tipo |
|---|---|---|---|
| R-09 | `hiddenFromOwner` verdadeiro para `storytellerNotes` no V20, M20 e W20 e falso para `notes`, vindo das permissões. A Leitura do narrador mostra "Notas do Narrador · privadas: o jogador não vê", e a folha de edição tem "Privadas: o jogador não vê estas notas." e, em `creating`, a linha do "Pedir ajuste" | `apps/frontend/sheet/__tests__/storyteller.test.tsx` | Jest + RNTL |
| T-33 | Narrador na ficha em criação por pontos: abre sem `radiogroup` "Modo da ficha", com a aba "Orçamento", que mostra o saldo sem `Stepper` e sem "Regras da casa"; nenhum lote na fila. "Editar como narrador" marca o rádio "Criação" e mostra "Editando como narrador"; "Voltar à leitura" com 1 alteração abre "Salvar 1 alteração?". Na criação livre vai a Editar; na ficha em uso, a Jogo. Dono e narrador dono: como hoje | `storyteller.test.tsx`; `apps/frontend/sheet/__tests__/sheet.layout.test.tsx` (o seletor fora da rolagem no `compact`) | Jest + RNTL |
| T-33 | A 390, o narrador abre a ficha em criação por pontos: `getByRole('radiogroup', { name: 'Modo da ficha' })` com contagem 0; `getByRole('tab', { name: 'Orçamento' })` mostra o saldo; nenhum `POST /events` no contador de `page.on('request')`. "Editar como narrador" marca `getByRole('radio', { name: 'Criação', exact: true })` | `e2e/tests/narrator.spec.ts` (novo) | Playwright |
| T-39 | `useLocalSearchParams` com `view: 'table'` abre a Mesa; tocar "Bastidores" chama `router.setParams({ view: 'backstage' })`; jogador com `view: 'table'` fica em Fichas. Na ficha, o "‹" com `canGoBack` faz `router.back()` e, sem ele, `router.replace('/chronicles/<id>')` | `apps/frontend/app/__tests__/table.test.tsx`; `apps/frontend/sheet/__tests__/SheetScreen.test.tsx` | Jest + RNTL |
| T-39 | A 390, numa Mesa com 8 fichas: rolar até a última, abrir, tocar "Voltar para <crônica>". Esperado: `getByRole('tab', { name: 'Mesa' })` com `aria-selected="true"`, a última ficha `toBeInViewport()` e `?view=table` na URL. O mesmo com `page.goBack()` | `narrator.spec.ts` | Playwright |
| T-40 | (1) O foco da Mesa chama de novo o `GET /chronicles/:id/xp-requests` (callback do `useFocusEffect` capturado no mock). (2) A lista de crônicas rebusca no foco e no `onRefresh` do `FlatList`, com `refreshing` ligado só até a resposta; depois de "Aprovar ficha", a lista não diz mais "1 ficha aguarda revisão". (4) "Aceitar narração" mostra "Você narra esta crônica." e o aviso, sem remontar a tela | `table.test.tsx`; `apps/frontend/app/__tests__/chronicles.test.tsx`; `apps/frontend/components/chronicles/__tests__/CampaignBackstage.test.tsx` | Jest + RNTL |
| T-40 | A 1280, com duas contas: a jogadora pede XP pela API, e o narrador, com a Mesa aberta, recebe `window` `focus` (`page.evaluate(() => window.dispatchEvent(new Event('focus')))`). Esperado: `getByTestId('table-xp-requests')` com "Pedidos de XP (1)". Depois, transferência proposta pela API e aceita pela tela: `getByText('Você narra esta crônica.')` sem `reload` | `narrator.spec.ts` | Playwright |
| T-48 | `Dimensions` 390: o contêiner do dock com `flexDirection: 'row'` e cada chip com `flex: 1`. 750: 2 colunas. 1280: 3. `fontScale` 1.3: 1 | `apps/frontend/components/chronicles/__tests__/chronicles.layout.test.tsx` | Jest + RNTL |
| T-48 | A 390, a altura do cartão (`getByTestId('table-row-<id>').boundingBox().height`) abaixo de 170. A 1280, os três primeiros cartões com o mesmo `y` (± 4) e `x` crescente | `narrator.spec.ts` | Playwright |
| T-49 | A barra (`table-action-bar`) fica fora do `ScrollView` da crônica (não é descendente dele). Depois de "Confirmar operação", continuam 2 marcadas. "Limpar seleção" zera e mantém a seleção ligada. O voltar do Android (`BackHandler`) desliga a seleção | `apps/frontend/app/__tests__/table-operations.test.tsx` | Jest + RNTL |
| T-49 | A 390, com 8 fichas: marcar a última; `getByRole('toolbar', { name: 'Ações da seleção' })` dentro da viewport (`boundingBox().y + height ≤ 844`) e "Aplicar dano" clicável sem rolar de volta | `narrator.spec.ts` | Playwright |
| T-75 | `selectionLabel(0/1/2)`. Com 20 marcadas, o 21º toque mostra "Máximo de 20 por operação." e não marca. Mesa vazia: sem "Selecionar personagens" | `table-operations.test.tsx` | Jest + RNTL |
| T-76 | Com timers falsos: `durationMs` 10000 ainda visível aos 9,9 s; o toque (`onTouchStart`) pausa e o `onTouchEnd` volta com o que faltava, nunca menos de 2 s; o ponteiro em cima pausa no web; com leitor de tela, `durationMs` 3000 dura 10 s; `useToastOffset(64)` sobe o aviso 64. O aviso do dano em grupo passa `durationMs: 10000` | `packages/ui/src/components.test.tsx` (bloco "Toast", l.535–665); `table-operations.test.tsx` | Jest + RNTL |
| T-83 | O narrador salva uma nota: `lastChange.by` é `you`. Lote do dono: `owner`. Ficha sem lote: `null`. Depois de uma transferência, o lote do narrador antigo é `other` para o novo. A resposta não tem `created_by` nem outro nome além do dono; jogador e narrador de outra crônica continuam com 404 | `apps/api/src/__tests__/table.test.ts` | API, PGLite (`useTestDb()`) |
| T-83 | `changeLabel` nos quatro casos; o cartão mostra "dona · alterada por você às 14:05" | `table.test.tsx` (perto de `:131`) | Jest + RNTL |
| T-83 | Depois de salvar a nota, o nome acessível da linha da Mesa casa `/alterada por você às \d\d:\d\d/` | `narrator.spec.ts` | Playwright |

### 4.2 Testes existentes que mudam junto

| Arquivo | O quê | Por quê |
|---|---|---|
| `apps/frontend/sheet/__tests__/storyteller.test.tsx` (l.101–196) | O "Editar como narrador" da ficha `helena` (em uso) continua levando a Jogo; um caso novo com ficha em criação | T-33 |
| `apps/frontend/sheet/__tests__/sheet.layout.test.tsx` (l.375–400) | O `sheet-scroll-header` do narrador em Leitura não tem o seletor | T-33 |
| `apps/frontend/sheet/__tests__/policy.test.tsx` | Conferir os casos do narrador com seletor (ficha travada ou arquivada): o seletor só aparece depois do "Editar como narrador" | T-33 |
| `apps/frontend/sheet/__tests__/SheetScreen.test.tsx` | O "‹" passa de `replace` para `back` quando há tela de baixo | T-39 |
| `apps/frontend/test/setup.ts` (l.11–25) | O mock do `useRouter` ganha `setParams` e `canGoBack` | T-39 |
| `apps/frontend/app/__tests__/table.test.tsx` (l.131, l.156, l.195) | A meta muda só com `lastChange` (sem ele, o texto de hoje); o foco também rebusca os pedidos de XP | T-83, T-40 |
| `apps/frontend/app/__tests__/table-operations.test.tsx` (l.86–140, l.213) | A contagem e as ações estão na barra; o texto "N selecionados (máx. 20)" | T-49, T-75 |
| `packages/ui/src/components.test.tsx` (l.638–655) | Os 5 s continuam para o aviso sem `durationMs`; casos novos de pausa | T-76 |
| `e2e/tests/journey.spec.ts` (l.210–213) | A ficha está em criação livre: depois do "Editar como narrador", o narrador cai em Editar e toca `getByRole('radio', { name: 'Jogo' })` antes do dano | T-33 |
| `e2e/tests/table.spec.ts` (l.72–111) | A ficha está em uso: "Editar como narrador" continua em Jogo. Acrescenta a meta "alterada por você" depois das notas | T-33, T-83 |
| `e2e/tests/journey-storyteller.spec.ts` (l.154–215) | Os botões têm os mesmos nomes, agora na barra fixa. O `exact: true` de "Aplicar dano" e "Desfazer" continua necessário. Conferir que o aviso não cobre "Nova noite" (`useToastOffset`) | T-49, T-76 |
| `e2e/tests/a11y-keyboard.spec.ts` (l.138) | Conferir a ordem de Tab na Mesa com a barra depois da rolagem | T-49 |

Os 9 specs com o "Concluir" do Editar (conflict, draft, evolve, journey, journey-mage, journey-werewolf, journey-storyteller, layout e lifecycle) são ajustados pelo P03-D, que entra antes. O P09-C entra com eles já em "Salvar alterações" e escreve o `narrator.spec.ts` assim.

### 4.3 E2E novo: `e2e/tests/narrator.spec.ts` (Chromium e WebKit)

Contas por `signUp`, crônicas e fichas por `apiAs` e `completeCreation` (`e2e/support/users.ts`), só dados fictícios. Duas larguras: 390 × 844 e 1280 × 720 (o padrão dos `devices`). Seletores por papel e rótulo:

- **Ficha do narrador:** `getByRole('button', { name: 'Editar como narrador' })`, `getByRole('button', { name: 'Voltar à leitura' })`, `getByRole('radiogroup', { name: 'Modo da ficha' })`, `getByRole('radio', { name: 'Criação', exact: true })`, `getByRole('tab', { name: 'Orçamento' })`, `getByText('Notas do Narrador · privadas: o jogador não vê')`, `getByText('Privadas: o jogador não vê estas notas.')`.
- **Abas da ficha a 390:** a faixa "Partes da ficha" do P08 (`getByRole('tablist', { name: 'Partes da ficha' })`), e o Orçamento por `getByRole('tab', { name: 'Orçamento' })` depois de `scrollIntoViewIfNeeded`.
- **Crônica:** `getByRole('tab', { name: 'Mesa' })` com `aria-selected`, `getByRole('button', { name: /^Voltar para / })`, `expect(page).toHaveURL(/\?view=table$/)`.
- **Mesa:** `getByTestId('table-row-<id>')`, `getByRole('checkbox', { name: 'Selecionar <nome>' })`, `getByRole('toolbar', { name: 'Ações da seleção' })`, `getByText('1 selecionado (máx. 20)')`, `getByRole('button', { name: 'Limpar seleção' })`, `getByRole('button', { name: 'Aplicar dano', exact: true })`, `getByTestId('table-xp-requests')`.
- **O que o Jest não pega no web**, conferido no DOM:
  - o `role="toolbar"` e o `aria-live="polite"` da contagem;
  - o `aria-selected` da aba depois do `setParams`;
  - a barra com `position` estática fora da rolagem (o `boundingBox` não muda ao rolar a Mesa);
  - o `RefreshControl`, que no web não desenha nada (o teste confere que a página não ganha elemento novo);
  - no WebKit, se o `scrollTo` da volta acontece depois do layout do Safari (pergunta 4).

### 4.4 Suítes do "PR local" e cobertura

```bash
npx pnpm turbo run typecheck lint --filter=@tms/ui --filter=frontend --filter=@tms/api --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=@tms/ui --filter=frontend --filter=@tms/api
cd apps/api && bun test src/__tests__/table.test.ts src/__tests__/authz.test.ts
```

- **Metas que o CI aplica (`.github/workflows/ci.yml:105`), por arquivo:**
  - `@tms/ui`: 80% em tudo (`packages/ui/jest.config.js:8-10`). O `Toast.tsx` ganha ramos (pausa, plataforma, leitor de tela, offset), e cada um tem um caso, com `Platform.OS` trocado no teste, como o P06 fez;
  - app: 70/70/60/70 global e 80/80/70/80 em `./sheet/` (`apps/frontend/jest.config.js:35-38`). `TableSelection.tsx`, `chronicleScroll.ts` e o `ModeBarActions` nascem com teste próprio;
  - API: 85% de linhas e funções por arquivo (`apps/api/bunfig.toml:5`). O `table.ts` ganha a subconsulta e os três ramos de `by`.
- **`*.pg.test`:** nenhuma trava nova. A subconsulta é de leitura. Não é preciso rodar.
- **`@tms/sheet-core` e `@tms/db` não mudam:** sem rebuild de `dist`.
- **Na integração da onda** (portas fixas, um por vez): o E2E inteiro em Chromium e WebKit, com o `narrator.spec.ts`.

## 5. Segurança

O pacote muda uma resposta da API (a Mesa) e o que o narrador pode fazer sem querer na ficha do jogador (T-33, que a nota NW-21 classifica como segurança por design). **Recomendo o `/security-review`** no diff dos commits 1 (API) e 4 (T-33), além do `/code-review` do pacote inteiro. A matriz não o exige para o P09-C.

| O que pode dar errado | Como o desenho evita |
|---|---|
| A Leitura do narrador vira controle de acesso | É interface (menor privilégio na tela). O servidor continua aceitando o lote do narrador (`writePolicy`, `packages/sheet-core/src/policy.ts:74-75`) e assinando com `by_role` (`sheets/events.ts:338-348`). A AuthZ não muda, e o `authz.test.ts` continua igual |
| A conta em Leitura expõe dado novo ao narrador | O `check` é calculado no aparelho, a partir da `creation` que o narrador já recebe no `GET /characters/:id`. Nenhuma rota nova. As "Regras da casa" (escrita) continuam fora da Leitura |
| As Notas do Narrador chegam ao jogador | O R-09 só põe rótulo. O `stripRestricted` continua em toda saída. Os testes de hoje continuam: o dono não recebe a nota nem no Histórico (`table.spec.ts:129`) e a resposta da ficha não contém o texto (`journey.spec.ts:232`). O rótulo nunca repete o conteúdo da nota |
| `lastChange` vaza quem mexeu na ficha | A rota continua só do narrador da crônica (`chronicleAccess === 'storyteller'`, senão 404, `table.ts:42-43`), e o IDOR continua coberto (`table.test.ts:180`). O `by` é um enum calculado no servidor; a resposta não leva o `created_by`, o nome de outro narrador nem o de outro jogador. A subconsulta é presa ao `ch.id` de uma linha que já passou pelo filtro da crônica |
| O T-40 vira polling ou carga | Nenhum intervalo novo: só foco de tela, foco da janela (web) e o puxar, de 2 a 5 GETs, sem duplicar o que está em voo (`cancelRefetch: false`). Mesmas rotas e mesma AuthZ |
| `resetQueries` depois do aceite mistura dados de papéis | É o mesmo usuário. As queries voltam ao estado inicial e rebuscam com a AuthZ nova do servidor. O logout continua com `clear()`. O narrador antigo perde o acesso pelo 404 da próxima rebusca, e o "Cache já visto" segue como limitação conhecida (`validacao-v5.md` l.154–156) |
| `?view=` na URL abre a Mesa para o jogador | O valor é conferido contra uma lista fixa. O jogador cai em Fichas (fail secure), e a API dá 404 na Mesa de qualquer jeito. A URL leva só o nome da aba, sem dado pessoal |
| A rolagem guardada e a seleção ficam na memória depois de sair | A rolagem é só número, em memória, apagada no logout. A seleção vive no contexto da tela e morre com ela. Nada vai para o disco |
| A barra, o voltar ou o aviso disparam uma operação sem querer | As ações continuam abrindo a folha com prévia e "Confirmar operação". O voltar do Android só desliga a seleção. O limite de 20 continua no servidor (`MAX_TARGETS`, `operations.ts:467`, `:710`) |

Checklist da organização:

- **Validação no servidor:** AuthZ, política de escrita, limite de 20 e conflito continuam no servidor. O cliente só mostra.
- **Logs sem PII:** nenhum log novo.
- **Fail secure:** `by` desconhecido ou ausente dá o texto de hoje, sem autor; `view` desconhecido dá Fichas; sem o `ModeBarActions`, não há "Editar como narrador".
- **Erros sem stack trace:** as rotas não mudam de erro.
- **Dependência:** nenhuma nova.

## 6. Como generaliza além do WoD

- **Leitura do narrador e a conta (T-33):** dependem do papel e da `creation` do core. Um D&D 5e com point-buy mostra a aba Orçamento em Leitura para o mestre, com "Atributos 27" do template. O Call of Cthulhu sem `creation` mostra só a ficha.
- **Notas privadas (R-09):** a regra vem das permissões da seção. "Notas do Mestre" (D&D) ou "Notas do Guardião" (CoC), com `read: ['storyteller']`, ganham o mesmo rótulo sem código novo.
- **Cartão da Mesa (T-48):** os recursos são o `dock` do template, de 1 a 3 campos ([PV, CA, Espaços] no D&D; [PV, SAN, Sorte] no CoC), e o chip de cada tipo vem do registry. A grade depende só da largura.
- **Seleção, barra e aviso (T-49, T-75, T-76):** as ações são as do template (`recoveries`) e as genéricas (dano, cura, XP). O "Desfazer" é a reversão genérica de operação.
- **"Alterada por" (T-83):** vem do lote, em qualquer sistema.
- **Aba e rolagem da crônica (T-39) e rebusca (T-40):** são da navegação e do cache, não de sistema.

Tudo é **genérico**. Nenhum item é de template nem de skin.

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado.** Arquivos e linhas conferidos no `617264d` (seção 3); nenhuma decisão própria (seção 2).
2. **Typecheck, lint e testes** de `@tms/ui`, `frontend`, `@tms/api` e `@tms/e2e` (seção 4.4), com as metas de cobertura por arquivo.
3. **Um teste de regressão por bug** (seção 4.1), falhando no `617264d`.
4. **`/code-review`** no diff do pacote e **`/security-review`** nos commits 1 e 4 (seção 5). Os achados vão no resumo.
5. **Os cenários das personas, repetidos sem o defeito**, com a API local e o seed do roteiro (só contas fictícias):

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | R-09 | N-W, NW-25 (`narrador-web.md`), 390: "Editar como narrador" → "Editar Notas do Narrador" | "Privadas: o jogador não vê estas notas." na folha; na ficha em criação, a linha do "Pedir ajuste" |
   | R-09 | N-A, NA-17 (`narrador-app.md`), iOS: o mesmo, querendo mandar "corrija X" | O aviso de privacidade e o caminho do "Pedir ajuste" antes de salvar |
   | T-33 | N-W, NW-21, 390: ficha do jogador em criação por pontos → procurar a conta | A aba Orçamento em Leitura, sem seletor de modo e sem "Editando como narrador" |
   | T-33 | N-A, NA-27, iOS: "Editar como narrador" | Abre em Criação, com "Editando como narrador". "Voltar à leitura" com alterações pergunta se salva |
   | T-39 | N-A, NA-25, iOS: Mesa → rolar → abrir uma ficha → "‹", e também o gesto de voltar | A Mesa, no mesmo ponto |
   | T-40 | PO-A, POA-39 (`po-app.md`), iOS: a jogadora pede XP; o narrador, com o app aberto, volta à crônica | "Pedidos de XP (1)" na Mesa |
   | T-40 | QA-A, QAA-18 (`qa-app.md`), Android: aprovar uma ficha → voltar à lista; puxar para baixo | A contagem e o "aguarda revisão" atuais |
   | T-40 | PO-A, POA-42 (iOS) e PO-W, POW-14 (`po-web.md`, 1280): "Aceitar narração" | "Você narra esta crônica.", o aviso e as abas do narrador, sem sair |
   | T-48 | QA-W, QAW-31 (`qa-web.md`), 390 e 1280: "Vampiro limite 20" → Mesa | ~5 cartões por tela a 390; 3 colunas a 1280 |
   | T-48 | QA-A, QAA-29, e PO-A (diário 15:25), iOS e Android: Mesa com 21 fichas e Mesa do Mago | Recursos numa linha; Roda do Mago inteira no chip |
   | T-49 | PO-A, POA-26, iOS: marcar os últimos e aplicar dano | Barra embaixo, à vista; a seleção continua depois da operação; "Limpar seleção" |
   | T-75 | QA-W, QAW-40; QA-A, QAA-31; N-W, NW-17 (1280, Mesa vazia) | "1 selecionado (máx. 20)"; o 21º explica o máximo; Mesa vazia sem o botão |
   | T-76 | QA-A, QAA-22, Android, e PO-A (diário 15:30), iOS: aplicar dano e tocar "Desfazer" depois de ~7 s | O dano é desfeito; o aviso aparece acima da barra |
   | T-83 | N-W, NW-30, 390: salvar uma nota → Mesa | "alterada por você às HH:MM" |

   **Na tarefa "devolver"** do critério de saída da onda (N-W e N-A não concluíram), o P09-C completa o P04-D: o narrador revisa em Leitura com a conta, e o rótulo das notas o leva ao "Pedir ajuste".
6. **Conferência no aparelho:** o roteiro da seção 11, na web, no Android (AVD) e no iOS (simulador com idb). Os itens obrigatórios no iOS deste pacote são o T-39 e o T-49.
7. **Resumo para a seção do pacote no PR da onda:** o que mudou, como foi testado, os achados das duas revisões, a API nova do `Toast` (§3.10) e o `lastChange` da Mesa (§3.11).

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

| # | Commit | Itens | Esforço |
|---|---|---|---|
| 1 | `fix(api): a Mesa diz se a última alteração foi sua, do dono ou de outro` (`lastChange`, testes de AuthZ) | T-83 | P |
| 2 | `fix(app): "alterada por você" no cartão da Mesa` | T-83 | P |
| 3 | `fix(app): as Notas do Narrador dizem que são privadas` | R-09 | P |
| 4 | `fix(app): o narrador revisa em Leitura, com a conta, e edita só pelo "Editar como narrador"` (`ModeBarActions`, `budgetTab`) | T-33 | M |
| 5 | `fix(ui): o aviso com ação pausa enquanto se interage e sobe acima de uma barra fixa` (`Toast`, `useToastOffset`, `components.md`) | T-76 | P |
| 6 | `fix(app): cartão da Mesa com os recursos numa linha` | T-48 | P |
| 7 | `fix(app): Mesa em grade nas telas largas` | T-48 | P |
| 8 | `fix(app): seleção da Mesa com barra fixa, "1 selecionado (máx. 20)" e Desfazer mais longo` (`TableSelection.tsx`, `BackHandler`) | T-49, T-75, T-76 | M |
| 9 | `fix(app): a crônica volta na mesma aba e no mesmo ponto` (`?view=`, `useSheetBack`, `chronicleScroll.ts`) | T-39 | M |
| 10 | `fix(app): lista, crônica e Mesa rebuscam no foco e ao puxar; aceitar a narração atualiza a tela` | T-40 | M |
| 11 | `fix(app): puxar para atualizar na ficha` | T-40 | P |
| 12 | `test(e2e): narrador na revisão e na Mesa, e os specs que mudam` (`narrator.spec.ts`, §4.2) | todos | M |
| 13 | `docs: barra do narrador e cartão da Mesa no design system` (`components.md` ModeBar l.559 e CharacterCard l.700) | T-33, T-48 | P |

**Por que esta ordem:**

- A API (1) vem antes do app que a usa e é o foco do `/security-review`.
- Os textos (2, 3) são pequenos e não dependem de nada.
- O T-33 (4) vem antes da Mesa, porque mexe na `ModeBar` e no `SheetView`, os arquivos de maior conflito com o P03-D e o P04-D. Assim o rebase fica menor.
- O `Toast` (5) vem antes da barra (8), que usa o `useToastOffset`.
- O cartão (6, 7) vem antes da barra (8), que vive na mesma tela.
- O T-39 (9) e o T-40 (10) mexem na tela da crônica e vêm por último no código.
- Os commits 7 e 11 saem sozinhos sem quebrar os outros.
- O E2E (12) roda na integração. Os specs são escritos aqui e conferidos lá, como nas ondas 1 e 2.

### 8.2 Esforço

**G**, de 10 a 12 dias, em 13 commits (7 P e 6 M). A matriz soma 7 P e 2 M. A diferença vem do que o código mostrou:

- o T-33 muda quais modos o narrador vê e liga a barra do narrador à lógica da `ModeBar` por um contexto;
- o T-49 sobe a seleção para a crônica, porque a barra fixa precisa ficar fora da rolagem;
- o T-39 junta a URL, a pilha de navegação e a rolagem no web;
- o T-40 são quatro causas diferentes, em quatro telas;
- o T-83 precisa de campo novo na API, com teste de AuthZ e `/security-review`;
- o `Toast` do `@tms/ui` muda, o que pede a conferência no nativo (S-01);
- o roteiro manual é nas três plataformas.

**Se a onda precisar cortar:** os commits 7 (grade) e 11 (puxar na ficha) saem sozinhos. Sem eles, o pacote fica perto de 9 dias. O T-48 continua com o cartão compacto.

### 8.3 Riscos

- **Mudar o que o narrador vê na ficha (T-33).** Os testes e as jornadas que tocam chips como narrador mudam (§4.2). Na ficha em criação, marcar dano passa a ter um toque a mais (seção 2, onda-2 §6.8). A ficha em uso continua igual.
- **Web e a pilha do Expo Router (T-39).** Se o web desmontar a tela de baixo no `push`, o T-39 depende da URL (aba) e do mapa de rolagem (posição). A seleção e os filtros da Mesa voltariam ao padrão no web. O E2E diz (pergunta 4).
- **`setParams` no histórico do web (T-39).** Se ele empilhar entradas, o voltar do navegador passa pelas abas antes de sair da crônica (pergunta 3).
- **Barra fixa a 360 dp (T-49).** Com cinco botões, a linha lateral esconde parte deles fora da tela. O teclado e o leitor de tela chegam a todos, mas o toque precisa da rolagem lateral (pergunta 5).
- **`RefreshControl` com `stickyHeaderIndices` (commit 11).** No Android, o puxar dentro da rolagem com faixa fixa (P08) pode brigar com o gesto. Se brigar, o commit 11 sai.
- **`Toast` no nativo.** O `onTouchStart` num `View` com `pointerEvents="box-none"` no pai precisa do aparelho. O Jest não mostra.
- **E2E escritos e não rodados no pacote.** Rodam na integração, como nas ondas 1 e 2.

### 8.4 Conflitos com os pacotes da onda

Ordem de merge provisória da consolidação: **P03-D → P04-D → P11 → P09-C**. O código confirma o P09-C por último, como o P08 na onda 2. Ele reorganiza a Mesa (cartão, grade, barra) e a tela da crônica, onde o P04-D e o P11 põem selos, seções e avisos. Ele faz rebase sobre os três.

| Arquivo | P09-C | Outro pacote | Risco e como integrar |
|---|---|---|---|
| `apps/frontend/sheet/evolve/ModeBar.tsx` | T-33: `:48-54`, `:84-95`, `:114-116`, `:205` e o retorno `:259` (`go`) | P03-D: barra de ação de Criação e Editar ("Salvar" + ação seguinte, "Salvar alterações", `:206-234`, `EvolveBar` `:312-361`). P04-D: o texto do próximo passo e o "Avisar que terminei", na mesma barra | **Médio.** Trechos diferentes: o P09-C mexe no seletor e na lista de modos, e os outros, na barra de ação. O P09-C não toca rótulo, `EvolveBar` nem `SummarySheet` |
| `apps/frontend/sheet/storyteller/StorytellerBar.tsx` | T-33 (`:43-50`, `:74-78`), R-09 (`:63-73`, `:87-128`) | P04-D: o "Pedir ajuste" fica no `StatusMenu`/`SheetMenu`, não aqui | Baixo. A linha do R-09 cita o rótulo do P04-D, e o P09-C usa o texto final dele no rebase |
| `apps/frontend/sheet/SheetView.tsx` | T-33: `ModeBarSlots` com contexto (`:147-155`), `budgetTab`/`budgetEdit` (`:180`, `:268`, `:361`). T-40: `refreshControl` (`:347-358`) | P04-D: o banner do "Aguardando ajuste" (provavelmente o `NarratorReasonBanner` ao lado do `ReturnedBanner`, `:267`) | Baixo: linhas vizinhas. Conferir a ordem do array de rolagem do P08 depois do rebase |
| `apps/frontend/sheet/SheetScreen.tsx` | T-39: o "‹" (`:129-134`). T-40: `onRefresh` no `LiveSheet` (`:545-554`) | P04-D: `narratorOf` e o efeito de transição (o selo vai no `IdentityBlock`, não no `subtitle` da `AppBar`: P04-D §3.5). P11: o `viewer` (`:161-178`, T-15), o `NpcVisibilityBar` (`:608-723`, T-46) e a `chronicle` na identidade revelada (T-81) | **Médio, no "‹".** Acordo da consolidação ([onda-3.md](onda-3.md) §4.8): o P09-C cria `useSheetBack(chronicleId)` em `sheet/navigation.ts`, com `canGoBack ? back() : replace(...)`. O P11, que entra antes, só faz a `chronicle` valer na identidade revelada, e o helper a usa |
| `apps/frontend/sheet/layouts/TextLayout.tsx` | R-09 | — | Nenhum |
| `apps/frontend/components/chronicles/TableView.tsx` | T-40 (`:145-148`), T-48 (`:299-308`), T-49 e T-75 (`:125-143`, `:216-276`, `:311-332`) | P04-D: "Aguardando aprovação", "Aguardando ajuste" e o aviso de "terminei", provavelmente via `tableItems.ts` e `TableRow.tsx`. P11: seção "NPCs" (T-52), separando as linhas | **Alto.** O P09-C entra por último e põe a seção de NPCs do P11 na mesma grade. A barra de seleção vale para PCs e NPCs, como hoje. Conferir o arquivo inteiro depois do rebase |
| `apps/frontend/components/chronicles/TableRow.tsx` | T-48 (layout, `:79-150`, estilos `:152-175`), T-83 (`:43`) | P04-D: o `StateBadge` no lugar do texto `state` (`:107-113`). P11: o selo de visibilidade do NPC | **Alto.** O cartão novo tem uma linha de selos: o `StateBadge` do P04-D e o selo do P11 entram nela, com texto e nunca só cor. O nome acessível (`:60-77`) junta os dois textos |
| `apps/frontend/components/chronicles/tableItems.ts` | T-83: `TableRowData.lastChange` (`:15-26`) e `changeLabel` | P04-D: o `stateLabel` (`:40-57`) sai, e o `state` passa a `CharacterState` pelo `characterState` (P04-D §3.4), desenhado pelo `StateBadge`. P11: `kind`/`visibility` | Médio. Funções diferentes no mesmo arquivo |
| `apps/api/src/chronicles/table.ts` e `apps/api/src/__tests__/table.test.ts` | T-83: subconsulta e `lastChange` (`:56-99`) | P04-D: os campos de estado novo na resposta da Mesa | Médio. O P04-D entra antes e acrescenta os campos dele. O P09-C acrescenta a subconsulta no mesmo `select`. Testes em `it` separados |
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` | T-39 (`:40`, `:46`, `:90`, `:134`), T-49 (provider e barra depois do `ScrollView`, `:183`), T-40 (foco e `refreshControl`) | P11: U-03, a proposta de transferência no topo da crônica | Médio. O P11 põe o aviso no topo do conteúdo (`:91-107`), e o P09-C mexe nas abas, no `ScrollView` e no rodapé |
| `apps/frontend/app/(app)/index.tsx` | T-40: foco e `refreshing`/`onRefresh` (`:24`, `:62-90`) | P11: U-04 ("Última sessão" na `meta`, `:74-84`) e U-03 (proposta na lista) | Baixo: props do `FlatList` × texto da linha |
| `apps/frontend/lib/queries/backstage.ts` e `CampaignBackstage.tsx` | T-40: `useAcceptTransfer` (`:113-127`) | P11: T-16 (data da sessão), T-63 (auditoria), U-03 (o `AcceptTransfer`, `CampaignBackstage.tsx:489-521`, pode ser reaproveitado no topo) | Baixo. O P09-C muda só o `onSuccess`. Se o P11 levar o `AcceptTransfer` para o topo, o aviso "Agora você narra" vai junto |
| `apps/frontend/lib/queries/creation.ts` | T-40: `useRefresh` invalida `chronicleKeys.all` (`:12-30`) | P04-D: as mutações novas ("Pedir ajuste", "Avisar que terminei") usam o mesmo `useRefresh` | Baixo, e a favor: as ações do P04-D já invalidam a lista |
| `packages/ui/src/Toast.tsx`, `index.ts`, `components.test.tsx` | T-76 e o `useToastOffset` | P11 usa (T-46). Ninguém mais muda | Baixo (seção 3.10) |
| `apps/frontend/components/chronicles/OperationSheet.tsx` | T-76 (`:137-145`); a folha aberta pela barra | — | Nenhum |
| `e2e/tests/*` | `narrator.spec.ts` (novo), `journey.spec.ts:210-213`, `table.spec.ts`, `journey-storyteller.spec.ts`, `a11y-keyboard.spec.ts` | P03-D: o "Concluir" do Editar nos 9 specs. P04-D: `lifecycle.spec.ts` e o próprio spec. P11: `journey-backstage.spec.ts` | Médio. O P03-D ajusta primeiro. O P09-C escreve com "Salvar alterações" e só ajusta o que é dele (§4.2) |

**De propósito, o P09-C não toca:** `CharacterList.tsx` (a linha "Sua ficha" é do P04-D e do P11), `StatusMenu.tsx`, `SheetMenu.tsx`, `characterState.ts`, `sheet/data.ts` (o polling do P04-C) e o `lib/persist.tsx`.

**Migration:** nenhuma. A `0023` e a `0024` ficam para o P04-D e o P11, se precisarem.

**Folhas:** o P09-C não muda a `BottomSheet`. A `OperationSheet` e a `GrantXpSheet` passam a ser abertas pela barra. A conferência da seção 11 inclui o Esc, o foco de volta, o diálogo de 560 e a troca de folha no iOS.

**Para a onda 5:** o P09-D (D-10) recebe o cartão com a linha livre para o progresso, a conta em Leitura em `creating` (falta o `pending`) e a seleção na crônica, para o filtro "Em criação / Pendentes".

### 8.5 Arquivos tocados

| Arquivo | Itens | Tipo de mudança |
|---|---|---|
| `apps/api/src/chronicles/table.ts` | T-83 | alterado (subconsulta do último lote; `lastChange`) |
| `apps/api/src/__tests__/table.test.ts` | T-83 | teste alterado |
| `apps/frontend/sheet/layouts/TextLayout.tsx` | R-09 | alterado (legenda e nome acessível) |
| `apps/frontend/sheet/storyteller/StorytellerBar.tsx` | R-09, T-33 | alterado (`hiddenFromOwner`, folha das notas, botão pelo `go`) |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | T-33 | alterado (modos do narrador, `switcher`, `back`, `go`, `ModeBarActions`) |
| `apps/frontend/sheet/SheetView.tsx` | T-33, T-40 | alterado (contexto no `ModeBarSlots`, `budgetTab`/`budgetEdit`, `onRefresh`) |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | T-33 | alterado (as "Regras da casa" fora da Leitura) |
| `apps/frontend/sheet/SheetScreen.tsx` | T-39, T-40 | alterado (o "‹" pelo `useSheetBack`; `onRefresh`) |
| `apps/frontend/sheet/navigation.ts` | T-39 | novo (`useSheetBack`) |
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` | T-39, T-40, T-49 | alterado (`view` na URL, rolagem, foco, `refreshControl`, provider e barra) |
| `apps/frontend/app/(app)/index.tsx` | T-40 | alterado (foco e puxar) |
| `apps/frontend/components/chronicles/chronicleScroll.ts` | T-39 | novo (rolagem por crônica e aba, em memória) |
| `apps/frontend/components/chronicles/TableSelection.tsx` | T-49, T-75 | novo (`TableSelectionProvider`, `useTableSelection`, `TableActionBar`, `selectionLabel`) |
| `apps/frontend/components/chronicles/TableView.tsx` | T-40, T-48, T-49, T-75 | alterado |
| `apps/frontend/components/chronicles/TableRow.tsx` | T-48, T-83 | alterado |
| `apps/frontend/components/chronicles/tableItems.ts` | T-83 | alterado (`lastChange`, `changeLabel`) |
| `apps/frontend/components/chronicles/OperationSheet.tsx` | T-76 | alterado (`durationMs`) |
| `apps/frontend/lib/queries/focus.ts` | T-40 | alterado (`usePullRefresh`) |
| `apps/frontend/lib/queries/creation.ts` | T-40 | alterado (`useRefresh` invalida a lista de crônicas) |
| `apps/frontend/lib/queries/backstage.ts` | T-40 | alterado (`resetQueries` e aviso no aceite) |
| `packages/ui/src/Toast.tsx`, `packages/ui/src/index.ts` | T-76, T-49 | alterado (pausa, mínimo do leitor de tela, `useToastOffset`) |
| `packages/ui/src/components.test.tsx` | T-76 | teste alterado |
| `apps/frontend/test/setup.ts` | T-39 | teste alterado (mock do router) |
| `apps/frontend/sheet/__tests__/storyteller.test.tsx`, `sheet.layout.test.tsx`, `policy.test.tsx`, `SheetScreen.test.tsx` | R-09, T-33, T-39 | teste alterado |
| `apps/frontend/app/__tests__/table.test.tsx`, `table-operations.test.tsx`, `chronicles.test.tsx` | T-39, T-40, T-49, T-75, T-76, T-83 | teste alterado |
| `apps/frontend/components/chronicles/__tests__/chronicles.layout.test.tsx`, `CampaignBackstage.test.tsx` | T-48, T-40 | teste alterado |
| `e2e/tests/narrator.spec.ts` | todos | E2E novo |
| `e2e/tests/journey.spec.ts`, `table.spec.ts`, `journey-storyteller.spec.ts`, `a11y-keyboard.spec.ts` | T-33, T-49, T-83 | E2E alterado |
| `design/design-system/components.md` | T-33, T-48, T-76 | doc (ModeBar, CharacterCard, Toast) |

## 9. Perguntas abertas (técnicas)

⚙ = resposta só no simulador, no aparelho ou no E2E.

1. **"Editar como narrador" na ficha em uso.** O plano mantém Jogo, como hoje (dano na sessão com um toque), e leva a ficha em criação para Criação ou Editar. A alternativa é sempre Editar, mais fiel ao "abre a edição de fato" e com um toque a mais para marcar dano. Muda o `table.spec.ts`.
2. **A conta em Leitura já em `pending`?** É uma condição em `useCreating`, e a D-10 a pede para a onda 5 (P09-D). O plano entrega só em `creating`, que é o que o T-33 pede.
3. ⚙ **`setParams` no web empilha ou substitui a entrada do histórico?** Se empilhar, a troca de aba usa `router.replace` com `?view=` no lugar do `setParams`. O `dismissTo` foi descartado: ele volta à crônica com os parâmetros novos e apagaria o `view`.
4. ⚙ **No web, a tela de baixo continua montada depois do `push`?** Se sim, a seleção e os filtros da Mesa também voltam. Se não, voltam a aba (URL) e a rolagem (mapa). Conferir no Chromium e no WebKit, que pode aplicar o `scrollTo` antes do layout.
5. **Barra da seleção a 360 dp.** O plano usa uma linha com rolagem lateral abaixo de 600. As alternativas: quebrar em duas linhas (~150 dp fixos) ou "Ações (N)" numa folha (um toque a mais). Conferir no AVD a 360.
6. **Janela do "Desfazer" em grupo.** 10 s com pausa no toque (o plano), ou o aviso ficar até a próxima interação na tela? O DS fala em 5 s para todo aviso, e o plano muda só a operação em grupo.
7. **Puxar para atualizar na ficha (commit 11).** Entra agora ou fica para a v6 (Mesa ao vivo)? A ficha já rebusca no foco e, em `pending`, a cada 30 s.
8. **Texto do T-83 quando o autor é o dono.** "alterada por ana às 13:15" (o nome uma vez, o plano) ou "ana · alterada por ana às 13:15", com o dono sempre na frente?
9. **Invalidar a lista de crônicas em cada concluir, aprovar e devolver** custa um GET a mais por ação. A alternativa é só o foco e o puxar na lista.
10. ⚙ **`RefreshControl` com a faixa fixa do P08** (`stickyHeaderIndices`) no Android e no iOS.
11. **O narrador antigo depois da transferência.** O aparelho dele mantém a Mesa e os NPCs em memória até a próxima rebusca (404). Vale um `resetQueries` também quando uma rota de narrador responde 404? É a limitação "Cache já visto", fora da matriz.
12. **Seed do roteiro.** Não é preciso estendê-lo para este pacote (seção 11.a). Se a integração quiser poupar o preparo, ele poderia criar, numa crônica "v3/v5", uma ficha de J1 concluída pelo N, com 10 de XP e um pedido de XP pendente (só dados fictícios). Fica fora dos commits.

**Pontos para o PO** (não decididos aqui):

- o aviso de pedido de XP na lista de crônicas (POA-39, seção 2);
- o toque a mais para marcar dano na ficha em criação (seção 2, ligado à onda-2 §6.8);
- a conta em Leitura antes da D-10 (seção 2).

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

Implementado sobre `8fb653e`, sem o P03-D, o P04-D e o P11. Foram 17 commits:

- os 13 do §8.1;
- 1 de teste, que corrige uma conferência vazia do T-33 (`216d792`);
- 2 de correção, um da revisão própria (`62758a0`) e um dos achados do `/code-review` (`8ce2ddd`);
- este, dos desvios.

**Decisões em aberto, com o padrão do plano:**

- **Pergunta 1:** o narrador abre em Leitura e entra na edição pelo "Editar como narrador". O destino é Criação na criação por pontos ativa, Editar na criação livre e Jogo na ficha em uso.
- **Pergunta 2:** a conta aparece em Leitura só em `creating`.
- **Pergunta 7:** o puxar na ficha entrou, no commit 11, que sai sozinho se brigar com a faixa fixa no Android.
- **Pergunta 8:** o texto quando quem alterou é o dono é "alterada por dona às 13:15".
- **Pergunta 9:** a lista de crônicas é invalidada a cada concluir, aprovar e devolver.

Tudo continua aberto para o PO (seção 9).

**Onde o código ficou diferente:**

1. **`hiddenFromOwner` e os textos do R-09** ficam em `sheet/storyteller/privacy.ts`, não no `StorytellerBar.tsx`. Assim a Leitura (`TextLayout`) e a barra do narrador usam a mesma regra sem importar uma à outra, o que evita ciclo de import.
2. **O mapa de rolagem** fica em `lib/chronicleScroll.ts`, não em `components/chronicles/`. Quem o apaga no logout é o `SessionProvider`, em `lib/`, e o `lib/` não importa `components/`.
3. **`useSheetBack`** recebe a `chronicle` (`{ id, name } | null`), não só o id, e devolve o `back` inteiro da `AppBar` (rótulo e ação).
   - Com tela de baixo, a ação é `router.back()`, mesmo sem crônica.
   - Sem crônica, o rótulo é "Crônicas" até o P11 mandar a `chronicle` na identidade revelada (T-81).
4. **A aba da crônica** é estado local sincronizado com `?view=`:
   - a URL vale ao montar e quando muda por fora (link, F5, voltar do navegador);
   - o toque troca a aba na hora e chama `setParams`.

   Só ler `useLocalSearchParams` não trocava a aba enquanto o `setParams` não rendesse um render novo, como acontece no Jest. Pergunta 3 (se o `setParams` empilha no histórico do web) segue para o E2E.
5. **Invalidação da lista no `useRefresh`:** usa `chronicleKeys.all` com `exact: true`. Rebusca só a lista de crônicas, não tudo o que começa com `['chronicles']`.
6. **Barra da seleção:**
   - Ela aparece só na aba Mesa. A seleção continua ao trocar de aba e voltar, mas o voltar do Android só desliga a seleção com a barra à vista. Em outra aba, o voltar é o de sempre (achado do `/code-review`).
   - A ficha que sai da Mesa (arquivada, excluída ou fora do recorte) sai da seleção, e a contagem e o limite de 20 contam só o que está na tela. O vazio do carregamento não limpa a seleção.
   - "Limpar seleção" fica desabilitado com 0 marcadas.
   - O aviso do 21º toque sai no próximo toque ou ao limpar.
   - O voltar do Android só é registrado com a tela em foco (`useFocusEffect`, na própria barra), para não capturar o voltar de uma ficha aberta por cima.
   - O `TableView` exige o `TableSelectionProvider`. Os testes montam a Mesa com o provider e a barra, como a tela da crônica.
7. **Papel `toolbar`:** fica num `View` que não é elemento acessível único, para os botões continuarem alcançáveis no VoiceOver e no TalkBack. Por isso o Jest o acha pelo nome (`getByLabelText`). O E2E usa `getByRole('toolbar')`, que vale no DOM.
8. **Pausa do Toast:** usa ponteiro, foco e toque em todas as plataformas, sem ramo por `Platform.OS`.
   - O aviso dentro de um `Modal` não sobe com o `useToastOffset`, porque a barra fica atrás da folha.
   - O render de loop que um `[]` novo por render causava (a Mesa sincronizando a seleção) foi evitado com `NO_ROWS` e com o `sync` comparando a lista.
9. **"Volta à Leitura depois de salvar"** vale para o Editar (o `returnTo` do narrador que entrou pela Leitura).
   - Na Criação, salvar mantém a Criação, como para o dono: o botão da barra é `review('create')`.
   - O narrador volta à Leitura pelo "Voltar à leitura", que pergunta se salva ou descarta.
   - O teste disso usa o rótulo "Concluir" do Editar. Ele passa a "Salvar alterações" no merge do P03-D.
10. **Grade (T-48):** é um contêiner só (`flexWrap`), com cada cartão numa célula de 1/colunas da largura (`table-cell-<id>`) e a key da ficha. Trocar a ordem ou o filtro move os cartões sem remontá-los. O espaço entre os cartões é o recuo das células, não o `gap` (achado do `/code-review`).
11. **Volta à rolagem (T-39):**
   - Ela é pedida no foco e feita quando o conteúdo cabe o ponto guardado mais a altura da tela. Antes disso, o ScrollView pararia no máximo de então.
   - A chave é a da aba mostrada, já com a crônica carregada.
   - Qualquer rolagem antes da volta a cancela (dedo, roda, teclado ou barra), não só o arrasto (achado do `/code-review`).
12. **Aceitar a narração (T-40):** usa `invalidateQueries()`, e não o `resetQueries()` do plano. O reset derrubava a tela da crônica para o esqueleto, e a invalidação mantém o dado de agora até a resposta com o papel novo.
   - É o mesmo usuário, e o dado de jogador é o de menos acesso.
   - O logout continua com `clear()`.
   - O `/security-review` não teve achado.
13. **Toast:** o aviso que sai da tela com o foco, o ponteiro ou o dedo em cima (ao passar para um modal) solta o que o segurava, e o prazo não fica parado (achado do `/code-review`).
14. **`/code-review`, achado não aplicado:** o foco da crônica invalida o prefixo dela, e a Mesa e a lista de fichas mantêm a própria rebusca no foco. É o desenho do §3.4: o `cancelRefetch: false` não duplica pedido. O foco da Mesa também cobre os pedidos de XP, que ficam fora do prefixo.
15. **`a11y-keyboard.spec.ts`:** foi conferido e não muda. A Mesa vazia do teste não tem a barra, e com a Mesa vazia não há "Selecionar personagens" (NW-17).
16. **Medidas do E2E** (o cartão abaixo de 170 a 390 e a barra dentro da viewport): são as do plano e ainda não rodaram. Se o cartão em criação, com o selo, passar de 170, a integração mede e ajusta o limite ou o cartão.

**Ficam para a integração**, depois do P03-D, do P04-D e do P11 (seção 8.4):

- os selos do P04-D e a visibilidade do P11 na linha de selos do cartão (`TableRow`, `badges`);
- a seção de NPCs na grade (`TableGrid` dentro de cada seção);
- o `stateLabel` trocado pelo `characterState`;
- o `kind` do `TableRowData`, que o P04-D também declara e que dá conflito trivial;
- a `chronicle` da identidade revelada no `useSheetBack`;
- o texto final do "Pedir ajuste";
- os rótulos do P03-D nos testes do narrador.

## 11. Testes manuais (web, Android com AVD, iOS com idb)

O roteiro confere cada item na interface, nas três plataformas, com a API local e o seed do roteiro (só contas fictícias `@roteiro.test`). Ele detalha o passo 6 da seção 7. A coluna "Resultado" fica em branco e é preenchida na integração.

### 11.a Preparação

- **Ambiente:**
  - `npx pnpm db:up`, `npx pnpm db:migrate` e `npx pnpm templates:publish --published`;
  - `npx pnpm dev:api` (porta 3001);
  - `cd apps/frontend && npx expo start` (Metro na 8081, para o web e o nativo).
- **O que o seed já cobre** (`npx pnpm seed:roteiro`, `scripts/seed-roteiro.ts:43-46` e `:247-281`):
  - as contas N (`roteiro_narrador`), J1, J2 e N2;
  - por sistema (V20, M20, W20), as crônicas "v3/v5" (criação livre) e "v4" (por pontos), com J1 e J2 dentro;
  - "Vampiro limite 20", com 21 fichas na Mesa: 20 do N e a 21ª do J1.

  A senha é a constante do seed: o operador a lê no arquivo e nunca a copia para o roteiro, os scripts ou as capturas.
- **O que o roteiro cria pela tela** (uns 15 min, só dados fictícios):
  1. "Vampiro v4": N liga a "Aprovação do narrador". J1 cria uma ficha por pontos e distribui parte dos Atributos (T-33). J2 cria outra e a envia para aprovação (T-40, item 2).
  2. "Vampiro v3/v5": J1 cria uma ficha livre. N a conclui pelo "Mais opções" → "Ações do narrador" e concede 10 de XP pela Mesa. J1 pede XP para subir um Atributo (T-40, item 1).
  3. "Lobisomem v3/v5": N propõe a transferência da narração para J1, em Bastidores → "Transferir narração" (T-40, item 4). Esta crônica fica com outro narrador depois do teste, e o seed a apaga na próxima rodada.
  4. Na ficha de J1 do passo 1, N salva uma Nota do Narrador fictícia ("Teste de privacidade") (R-09, T-83).
- **O seed não precisa mudar** para este pacote (pergunta 12).

### 11.b Web (Playwright, Chromium e WebKit)

- O script fica no scratchpad da sessão e usa o `playwright` do `node_modules` do repositório, contra o Metro (`http://localhost:8081`). Ele não entra no repositório.
- Viewport exato: `390 × 844` e `1280 × 800`, um `browser.newContext({ viewport })` por largura e uma conta por contexto.
- **WebKit** nos itens que são de Safari: T-39 (voltar, `scrollTo`, `setParams`), T-49 (barra fixa) e T-76 (aviso acima da barra).
- Seletores por papel e rótulo, os da seção 4.3. Um screenshot por passo (`page.screenshot`), com o nome da coluna "Evidência".
- O Metro web pode ficar com o bundle velho depois de editar o código. Se ficar, reiniciar com `--clear`.

### 11.c Android (AVD)

- **AVD** `Pixel_3a_API_34_extension_level_7_arm64-v8a` (1080 × 2220, 440 dpi = 393 dp), com boot rápido e `-gpu host`.
- **APK Debug:** `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` em `apps/frontend/android`, com o `JAVA_HOME` do JBR do Android Studio (~3 min), e depois `adb install -r`.
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Larguras de layout** (T-48, T-49, T-75): `adb shell wm density 480` (360 dp) e `420` (411 dp). No fim, `adb shell wm density reset`.
- **Teclado de software** (login, nota do narrador): `adb shell settings put secure show_ime_with_hard_keyboard 1`. No fim, `0`.
- **Navegação:**
  - `adb shell uiautomator dump /sdcard/ui.xml` e `adb pull`, para achar o alvo pelo `content-desc` ou pelo texto;
  - `adb shell input tap X Y`, `input text` e `input swipe` (o puxar: de y 600 a y 1500 em 400 ms);
  - `adb exec-out screencap -p > <evidência>.png`.

  O aviso do LogBox no rodapé engole toques: dispensar antes.
- **O voltar do Android** (`adb shell input keyevent KEYCODE_BACK`):
  - com a seleção ligada (T-49);
  - com a `OperationSheet` aberta: fecha a folha;
  - na ficha aberta pela Mesa (T-39).

### 11.d iOS (simulador com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, e iPhone 17, iOS 26.5. Os UDIDs saem de `xcrun simctl list devices`.
- **Build Debug para o simulador:** `xcodebuild -workspace apps/frontend/ios/TMS.xcworkspace -scheme TMS -configuration Debug -sdk iphonesimulator -destination 'id=<UDID>' -derivedDataPath <scratchpad>/ios-build CODE_SIGNING_ALLOWED=NO build`. Leva ~37 min a frio e ~10 min incremental. Depois, `xcrun simctl install <UDID> <...>/TMS.app` e `xcrun simctl launch <UDID> com.tms.app`.
- **idb:**
  - o `idb_companion` já está em `/opt/homebrew/bin`;
  - o cliente (`fb-idb`) vai num venv **fora do repositório**, o mesmo dos quatro pacotes (`~/.venvs/idb-tms`, [onda-3.md](onda-3.md) §10.a), com versão fixada (`pip install 'fb-idb==1.1.7'`, conferida antes com `pip index versions fb-idb`);
  - antes de usar, `pip-audit` no venv. Com vulnerabilidade sem correção, o iOS fica "não conferido";
  - o cliente não entra no `package.json` nem no lockfile;
  - o companion fica só local: o cliente o sobe por `--udid`, num socket de domínio. Sem `--grpc-port` exposto e sem `idb connect` com host:porta;
  - risco: o `fb-idb` pode não rodar no Python da máquina. A consolidação confere as versões (`python3 --version` e `idb_companion --version`).
- **Navegação:**
  - `idb ui describe-all --udid <UDID>` acha o alvo pelo rótulo de acessibilidade (`AXLabel`). Tocar no centro do `frame` com `idb ui tap --udid <UDID> X Y`;
  - `idb ui text`, para digitar; `idb ui key`, para o Enter (HID 40); `idb ui swipe`, para rolar, puxar e o gesto de voltar (da borda esquerda, x 2 → 300);
  - `idb screenshot --udid <UDID> <evidência>.png`.
- **Deep link** (`xcrun simctl openurl <UDID> 'tms://chronicles/<id>?view=table'`): o iOS pergunta "Abrir com 'TMS'?", e o "Abrir" é tocado pelo `describe-all`.

### 11.e Roteiro por item

Evidências com o nome `p09c-<plataforma>-<ID>-<passo>.png` (por exemplo, `p09c-ios-se-T-39-2.png`). A coluna "Resultado" é preenchida na integração.

**R-09 · Notas do Narrador privadas**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| R-09 | Web 390 (Chromium) | N | Ficha de J1 ("Vampiro v4") → "Editar como narrador" → "Editar Notas do Narrador" | "Privadas: o jogador não vê estas notas." e a linha do "Pedir ajuste" | `p09c-web390-R-09-1.png` | |
| R-09 | Web 390 | J1 | Abrir a mesma ficha, em todas as abas e no Histórico | Nenhum "Notas do Narrador" nem o texto da nota | `p09c-web390-R-09-2.png` | |
| R-09 | iOS iPhone 17 | N | O mesmo do primeiro passo; `describe-all` na folha | A frase na árvore, como texto estático | `p09c-ios17-R-09-1.png` | |
| R-09 | Android 393 | N | Ficha de J1 → aba Ficha, seção "Narrador" | Legenda "Notas do Narrador · privadas: o jogador não vê" no `uiautomator dump` | `p09c-and393-R-09-1.png` | |

**T-33 · Leitura do narrador com a conta**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-33 | Web 390 | N | Ficha de J1 em criação por pontos | Sem os rádios de modo; aba "Orçamento" com o saldo e sem −/+; nenhum `POST /events` no registro de rede | `p09c-web390-T-33-1.png` | |
| T-33 | Web 390 | N | "Editar como narrador" → mudar um Atributo → "Voltar à leitura" | Rádio "Criação" marcado, "Editando como narrador"; ao voltar, "Salvar 1 alteração?" | `p09c-web390-T-33-2.png` | |
| T-33 | Web 1280 | N | Ficha de J1 em uso ("Vampiro v3/v5", passo 2 da preparação) → "Editar como narrador" | Jogo, como hoje | `p09c-web1280-T-33-3.png` | |
| T-33 | iOS iPhone SE | N | Os dois primeiros passos | Os mesmos; a barra do narrador rola com a ficha (P08) | `p09c-iosse-T-33-1.png` | |
| T-33 | Android 393 | N | O primeiro passo e o voltar do Android em Editar com alteração | O resumo de salvar ou descartar | `p09c-and393-T-33-1.png` | |

**T-39 · Voltar à Mesa no mesmo ponto** (obrigatório no iOS)

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-39 | iOS iPhone SE | N | "Vampiro limite 20" → Mesa → rolar até "Figurante 15" → abrir → "‹" | Aba Mesa, "Figurante 15" à vista | `p09c-iosse-T-39-1.png`, `-2.png` | |
| T-39 | iOS iPhone 17 | N | O mesmo, com o gesto de voltar da borda | O mesmo | `p09c-ios17-T-39-1.png` | |
| T-39 | iOS iPhone 17 | N | Deep link `tms://chronicles/<id>?view=table` → "Abrir" | A crônica abre na Mesa | `p09c-ios17-T-39-2.png` | |
| T-39 | Android 393 | N | O mesmo do primeiro passo, com o voltar do Android; depois "Próxima ›" duas vezes e "‹" | A Mesa no mesmo ponto | `p09c-and393-T-39-1.png` | |
| T-39 | Web 390 (Chromium e WebKit) | N | O mesmo; depois F5 na crônica; depois o voltar do navegador | `?view=table`; a Mesa no mesmo ponto; o F5 mantém a Mesa; o voltar sai da crônica, sem passar pelas abas | `p09c-web390-T-39-1.png`, `p09c-wk390-T-39-1.png` | |
| T-39 | Web 390 | J1 | Abrir `/chronicles/<id>?view=table` | Aba Fichas, sem Mesa | `p09c-web390-T-39-2.png` | |

**T-40 · Dados atuais**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-40 (1) | iOS iPhone 17 | N, J1 (web) | N deixa a Mesa de "Vampiro v3/v5" aberta; J1 pede XP no web; N abre uma ficha e volta | "Pedidos de XP (1)" | `p09c-ios17-T-40-1.png` | |
| T-40 (1) | Android 393 | N, J1 (web) | O mesmo, com o app em segundo plano e de volta | "Pedidos de XP (1)" | `p09c-and393-T-40-1.png` | |
| T-40 (2) | Android 393 | N | Lista de crônicas ("1 ficha aguarda revisão") → "Vampiro v4" → aprovar a ficha de J2 → voltar | Sem "aguarda revisão"; puxar para baixo mostra o indicador e atualiza | `p09c-and393-T-40-2.png` | |
| T-40 (3) | Web 1280 | J2, N | J2 com a ficha em `pending` aberta; N devolve no outro contexto | Em até 30 s, o banner da devolução (P04-C, conferência) | `p09c-web1280-T-40-3.png` | |
| T-40 (4) | iOS iPhone SE | J1 | "Lobisomem v3/v5" → Diário → "Aceitar narração" | "Agora você narra esta crônica.", "Você narra esta crônica." e as abas Fichas · Mesa · Bastidores, sem sair | `p09c-iosse-T-40-4.png` | |
| T-40 (4) | Web 1280 | J1 | O mesmo, numa segunda rodada do seed | O mesmo | `p09c-web1280-T-40-4.png` | |

**T-48 · Cartão compacto e grade**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-48 | Web 390 | N | "Vampiro limite 20" → Mesa | ~5 cartões por tela; recursos numa linha | `p09c-web390-T-48-1.png` | |
| T-48 | Web 1280 | N | O mesmo | 3 colunas | `p09c-web1280-T-48-1.png` | |
| T-48 | Android 360, 393 e 411 | N | O mesmo, nas três densidades | Recursos numa linha, sem cortar o número nem a trilha | `p09c-and360-T-48-1.png` (e 393, 411) | |
| T-48 | iOS iPhone SE | N | Mesa da crônica "Mago v4" com uma ficha | A Roda inteira no chip | `p09c-iosse-T-48-1.png` | |

**T-49 · Barra da seleção fixa** (obrigatório no iOS)

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-49 | iOS iPhone SE | N | "Selecionar personagens" → rolar até o fim → marcar "Figurante 19" e "Figurante 20" | Barra embaixo, à vista, com "2 selecionados (máx. 20)" e "Aplicar dano" | `p09c-iosse-T-49-1.png` | |
| T-49 | iOS iPhone SE | N | "Aplicar dano" → Letal → "Ver prévia" → "Confirmar operação" | O aviso acima da barra; as duas continuam marcadas | `p09c-iosse-T-49-2.png` | |
| T-49 | iOS iPhone 17 | N | "Limpar seleção"; depois "Cancelar seleção" | Zero marcadas com a seleção ligada; depois a barra some | `p09c-ios17-T-49-1.png` | |
| T-49 | Android 360 | N | Os dois primeiros passos; o voltar do Android com a seleção ligada | A barra cabe (rolagem lateral se preciso); o voltar desliga a seleção | `p09c-and360-T-49-1.png` | |
| T-49 | Web 1280 (Chromium e WebKit) | N | Abrir "Aplicar dano" pela barra; Esc durante a animação | Diálogo central de 560; o Esc fecha; o foco volta ao "Aplicar dano" da barra | `p09c-web1280-T-49-1.png`, `p09c-wk1280-T-49-1.png` | |

**T-75 · Contagem com o máximo**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-75 | Web 390 | N | Mesa → selecionar 1 | "1 selecionado (máx. 20)" | `p09c-web390-T-75-1.png` | |
| T-75 | Android 393 | N | "Vampiro limite 20": marcar as 21 | A 21ª não marca; "Máximo de 20 por operação." | `p09c-and393-T-75-1.png` | |
| T-75 | Web 1280 | N2 | Uma crônica nova sem fichas → Mesa | Sem "Selecionar personagens" | `p09c-web1280-T-75-2.png` | |

**T-76 · Desfazer em grupo**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-76 | Android 393 | N | Dano em grupo → esperar ~7 s → "Desfazer" | "Alteração desfeita."; o dano saiu | `p09c-and393-T-76-1.png` | |
| T-76 | iOS iPhone 17 | N | Dano em grupo → tocar e segurar o aviso 15 s → soltar → "Desfazer" | O aviso não some enquanto há toque; o desfazer funciona | `p09c-ios17-T-76-1.png` | |
| T-76 | Web 1280 (WebKit) | N | Dano em grupo → ponteiro sobre o aviso por 15 s | O aviso fica; ao sair, some depois de pelo menos 2 s | `p09c-wk1280-T-76-1.png` | |

**T-83 · Quem alterou**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-83 | Web 390 | N | Depois do passo 4 da preparação → Mesa de "Vampiro v4" | "<J1> · alterada por você às HH:MM" | `p09c-web390-T-83-1.png` | |
| T-83 | Web 390 | J1, N | J1 muda um valor da ficha; N volta à Mesa | "alterada por <J1> às HH:MM" | `p09c-web390-T-83-2.png` | |

**Folhas que este pacote abre de outro lugar** (sem regressão da onda 2): a `OperationSheet` e a `GrantXpSheet` pela barra. Conferir o Esc no web, o foco de volta, o diálogo de 560 a 1280 e, no iOS, a troca da folha da operação para o aviso e para a folha seguinte (`onClosed`, ainda não conferido no iOS, [onda-2.md](onda-2.md) §10).

### 11.f Acessibilidade mínima

O que é novo aparece como texto e com papel na árvore:

- **web:** no DOM, `role="toolbar"` com `aria-label="Ações da seleção"`, a contagem com `aria-live="polite"`, a aba com `aria-selected`, a legenda de privacidade dentro do bloco das notas e "alterada por você" no nome acessível da linha;
- **Android:** no `uiautomator dump`, os mesmos textos no `content-desc` ou no `text`, e a barra com os botões focáveis;
- **iOS:** no `idb ui describe-all`, os mesmos rótulos (`AXLabel`) e o papel de botão dos itens da barra.

Nenhum estado novo aparece só por cor.

### 11.g Limpeza

- parar o Metro e a API (Ctrl+C) e, se não houver outro uso, `npx pnpm db:down`;
- Android: `adb shell wm density reset`, `adb shell settings put secure show_ime_with_hard_keyboard 0`, `adb reverse --remove-all` e `adb emu kill`;
- iOS: `xcrun simctl shutdown all`, encerrar o `idb_companion` e desativar o venv. O build fica no scratchpad, e o venv, em `~/.venvs/idb-tms`;
- as capturas ficam com a integração, sem e-mail, token nem a senha.

### 11.h Quando não der para conferir

Se uma plataforma não puder ser conferida (o `fb-idb` não roda no Python da máquina, o `pip-audit` acusa vulnerabilidade sem correção, o build não fecha, o AVD não sobe), a coluna "Resultado" diz **"não conferido"** e o motivo. Nunca "ok" sem a evidência. Os itens obrigatórios no iOS (T-39 e T-49) sem conferência ficam como pendência da onda, como na [onda-2.md](onda-2.md) §10.
