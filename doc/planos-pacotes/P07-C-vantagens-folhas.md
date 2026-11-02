# P07-C · Vantagens: folhas e contadores: plano de implementação

> Plano · 2026-11-02 · base conferida: `onda/2-correcoes-criacao` em `9f75426` (main depois da onda 1)

Pacote [P07-C da matriz](../testes/2026-11-01/matriz-achados.md#p07-c): onda 2 (Correções da criação), correção, pré-requisito P06 (mergeado na onda 1). É pré-requisito do P07-D (onda 4), que implementa as decisões D-06 a D-09 nas mesmas folhas.

O pacote não remove campo, não muda regra do jogo e não afrouxa limite:

- a conta da criação continua a do `@tms/sheet-core` e continua validada no servidor (`apps/api/src/sheets/events.ts:257`, `checkCreationBatch`). O pacote não mexe na conta, nos templates nem na API: o cliente só mostra a recusa no lugar certo e grava o valor que já mostrava;
- a trava da fase "Pontos básicos" continua só no app, como hoje (`apps/frontend/sheet/creation/creation.ts:232-237`: "Só o app trava aqui: gastar bônus continua valendo no servidor");
- os mínimos e máximos dos itens continuam os do template, conferidos pelo validador do core no servidor (`packages/sheet-core/src/validate/sheet.ts:290-300`).

**Arquivos da matriz que não mudam.** A matriz lista `sheetStore.ts`, `apps/frontend/sheet/creation/creation.ts` e `packages/sheet-core/src/creation.ts` em "Onde mexe". Lendo o código, nenhum dos três precisa mudar: a recusa já volta síncrona do `setDraftValue` para quem escreveu, e o defeito está em onde o `ListEditor` a mostra. No `sheet-core` entram só testes. Isso tira o P07-C do caminho do P05-C nesses arquivos (seção 8.4).

---

## 1. Objetivo e itens

**Objetivo (matriz).** Nas folhas de Disciplina, Dom, Qualidade e Defeito, a recusa aparece dentro da folha, Enter adiciona, o valor do Defeito entra no saldo e cada seção tem um título e um contador.

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| T-19 | média | A recusa da conta (4ª Disciplina, bônus sem saldo, Qualidade, Ofuscação 1 → 3 pelo editor) vai para a ficha, atrás da folha, que continua aberta sem dizer nada | `apps/frontend/sheet/evolve/ListEditor.tsx:60`, `:65-69` (o `write` guarda a recusa num estado do `ListEditor`), `:108-117` (desenhada embaixo da lista, atrás do modal); `:170-173` (o `pick` apaga o nome antes de saber se entrou) |
| T-23 | média | O Defeito novo mostra "Bônus 1" no editor e vale 0 no saldo; "Aplicar" sem mexer não muda nada; a linha não mostra o bônus | `ListEditor.tsx:70-79` (o item nasce sem `meta`); `:305` (o editor mostra `m.min` quando não há valor); `apps/frontend/sheet/views/ListView.tsx:79-82` (a linha junta só os valores, sem rótulo). A conta do core está certa (`packages/sheet-core/src/creation.ts:646-671`) |
| T-58 | baixa | Título repetido com contadores diferentes ("Disciplinas 0/3" e "Disciplinas 0"; "Dons 0/3 · Dons 0/3 · Dons 0"; "7/7" duas vezes no Mago); na criação livre, o número é de itens e parece de pontos | `apps/frontend/sheet/SectionView.tsx:24-31` (seção + contador), `apps/frontend/sheet/layouts/GroupsLayout.tsx:100-109` (grupo + contador), `apps/frontend/sheet/views/ListView.tsx:52-68` (rótulo da lista + `short`), `packages/sheet-core/src/fields/list.ts:5-8` (`short` = quantidade de itens, sem unidade) |
| T-62 | baixa | Enter (web) e "✓" (Android) não adicionam na folha "Adicionar …"; o botão só aparece depois de digitar | `ListEditor.tsx:184-190` (o campo não tem `onSubmitEditing`), `:211-217` (o botão "Adicionar “…”") |

Nenhum dos quatro arquivos principais (`ListEditor.tsx`, `ListView.tsx`, `SectionView.tsx`, `CreationCounter.tsx`) mudou entre `1db3db9` e `9f75426`. O `GroupsLayout.tsx` mudou na onda 1 só no T-35 (abas com `panelProps`) e no T-70 (`hitTarget()` na busca), fora dos trechos deste plano.

---

## 2. Decisões aplicadas

**O P07-C não tem decisão de produto própria** (coluna "Decisões" vazia). As decisões das mesmas telas são do P07-D (onda 4) e não entram aqui:

| Decisão (P07-D) | O que fica para o P07-D | O que o P07-C entrega e que encosta nela |
|---|---|---|
| D-06 (T-08): Qualidade com bônus na criação por pontos | O desenho da compra (pedir o custo antes de adicionar, se for o caso), o texto da recusa da Qualidade e a conferência com o livro | **Ver o ponto 1 abaixo.** O T-23 faz o item nascer com o valor que o editor mostra; para a Qualidade, isso é `Custo 1`, e a recusa "Qualidades: não se compra na criação." deixa de acontecer. O T-19 mostra qualquer recusa dentro da folha e mantém o nome digitado, que a D-06 também pede |
| D-07 (T-24): catálogo de Dons e aviso acima do nível 1 | Catálogo no template, destaque de Raça/Augúrio/Tribo, aviso na linha e no "O que falta" | O Enter (T-62) vale também para o catálogo que vier. O `Posto` do Dom novo passa a nascer gravado com 1 (o mínimo do template, que o editor já mostrava): é o valor que a D-07 vai comparar |
| D-08 (R-25): −/+ na própria linha | A linha com stepper e a folha só para nome, especialização e notas | O T-58 mexe no cabeçalho da lista, não nas linhas. O −/+ na linha vai usar a mesma recusa perto do toque (mecanismo do P05-C) |
| D-09 (R-26): Disciplinas do clã | Selo "do clã" e aviso "fora do clã" em cada opção da folha | O T-19 põe a recusa embaixo da opção tocada. O selo por opção é do P07-D e pode usar o mesmo lugar na linha |

Fora do pacote, nas mesmas telas: "Nenhum Qualidade" (T-66, P10-C, onda 4: `ListEditor.tsx:103-107` não muda aqui); o custo antes de gastar e o extrato (R-17, P05-C); o teclado que cobre a folha no Android e a folha central no desktop (T-10 e T-69, P08).

**Pontos para a consolidação e o PO (nada decidido aqui):**

1. **D-06: "O template `vtm-v20` é corrigido" não se aplica como está escrito.** O `vtm-v20` já cobra a Qualidade pelo meta `cost` (`design/templates/vtm-v20.json:971`) e dá o crédito do Defeito até 7 (`:972`), como a tabela de `doc/regras-wod.md:34-35`. O W20 e o M20 também (`wta-w20.json:1106-1107`, `mta-m20.json:1000-1001`). A recusa do T-08 vem do cliente: a Qualidade nasce sem `meta.cost`, e o core recusa item sem custo de propósito (`packages/sheet-core/src/creation.ts:659-664`, teste "Qualidade sem custo não é comprável" em `__tests__/creation.test.ts:265`). É a mesma causa do T-23. Com a correção genérica do T-23 (seção 3.2), a Qualidade entra com `Custo 1`, paga com bônus, e o jogador ajusta o custo no editor: é a regra da D-06, entregue duas ondas antes. A alternativa que deixa o T-08 inteiro para o P07-D está na pergunta 1 da seção 9.
2. **T-62: guardar o texto ao fechar a folha seria comportamento novo, não correção.** O esperado da matriz é só "Enter adiciona". Fechar a folha (×, Esc, fundo, voltar) é cancelar, e cancelar descarta, como nas outras folhas. O texto se perdia porque o Enter e o "✓" não adicionavam e a pessoa fechava a folha para sair do teclado; com o Enter adicionando, isso deixa de acontecer. O que o plano corrige é a recusa apagar o nome (`ListEditor.tsx:170-173`): recusado, o nome fica.

---

## 3. Desenho por item

### 3.0 De onde vem a recusa hoje (explica o T-19)

1. A folha chama `onAdd`/`onSave`/`onRemove`, que chamam o `write` do `ListEditor` (`ListEditor.tsx:65-69`).
2. O `write` chama o `useSetDraft()` (`apps/frontend/sheet/evolve/hooks.ts:78-90`), que chama o `editDraft` do store (`apps/frontend/sheet/store/sheetStore.ts:486-537`). No modo Criação, o `editDraft` roda o `draftRefusal` (`apps/frontend/sheet/creation/creation.ts:238-265`, chamado em `sheetStore.ts:517-531`) e devolve a frase de recusa, sem gravar nada.
3. O `write` guarda a frase no `error` do **`ListEditor`** (`:60`, `:67`) e devolve `false`. A folha não fecha (`:79`, `:140-141`, `:144`), mas também não recebe a frase.
4. O `ListEditor` desenha o `error` embaixo da lista (`:108-117`), na ficha, atrás do `Modal` da folha. Ao fechar a folha, a frase aparece, já sem causa (a mudança não entrou).

A frase em si (o "motivo certo") é do P05-C: T-07 (teto × orçamento) e T-57 ("custa N, restam M") mudam `problemText`, `basicsSpentText` e `draftRefusal`. O P07-C não mexe nesses textos: mostra, dentro da folha, o que o `setDraftValue` devolver.

### 3.1 T-19 · A recusa aparece dentro da folha que recebeu o toque

**Desenho (funciona sem nada do P05-C):**

- O `write` deixa de guardar a recusa no `ListEditor` e passa a devolvê-la (`string | null`) para quem chamou. O estado `error` da linha 60 e o trecho `:108-117` ficam só com o `issue` (a recusa do servidor, 422, que continua embaixo da lista, como hoje). Nada fica para trás na ficha quando a folha fecha: a mudança recusada não entrou, e a causa sumiu junto com ela (é o que o T-55 pede para as linhas de traço).
- **`AddItemSheet`** (`:152-221`):
  - o `onAdd` passa a devolver a recusa;
  - o `pick` só limpa a busca se o item entrou (hoje limpa antes, em `:171`, e o nome digitado some na recusa: QAA-05);
  - a folha guarda `refused: { at: string; message: string } | null`, em que `at` é a opção tocada (nome do catálogo), o botão de texto livre ou o campo (Enter, seção 3.4);
  - a frase aparece logo abaixo do que foi tocado: embaixo da opção do catálogo, embaixo do botão "Adicionar “…”" ou como `error` do `TextField` (que já desenha com `accessibilityRole="alert"`, `packages/ui/src/TextField.tsx:63-66`);
  - some quando a busca muda e ao fechar a folha (o `onClose` de `:178-181` já zera a busca e passa a zerar a recusa também).
- **`ItemSheet`** (`:223-346`):
  - o `onSave` e o `onRemove` passam a devolver a recusa;
  - a frase aparece no fim do corpo da folha, logo acima do rodapé com "Aplicar" (ou embaixo de "Remover X?", na confirmação);
  - some a cada mudança no rascunho local (`patch`, `:241-242`) e ao cancelar a remoção.
  - A remoção também pode ser recusada: tirar um Defeito cujo crédito já foi gasto estoura o saldo (`CREATION_FREEBIES_EXCEEDED`; teste do core "tirar o Defeito depois de gastar o crédito estoura", `__tests__/creation.test.ts:249`). Hoje essa recusa também fica atrás da folha.
- **Leitor de tela:** a frase é `Text` com `accessibilityRole="alert"` (o padrão do `TextField`) e, no app, `AccessibilityInfo.announceForAccessibility(frase)`, como a recusa do `CombatDock` (`apps/frontend/sheet/play/CombatDock.tsx:97`). Se o P05-C criar um componente de aviso perto do toque, as folhas usam o mesmo componente.
- **Sem mudança no `BottomSheet`.** A frase vai no `children` da folha, perto do toque, e não precisa de slot novo no `@tms/ui`. Isso evita conflito com o P08 (T-10 e T-69 reestruturam a folha) e evita mexer no `src` do `@tms/ui`, que no app compila com o JSX do React (`b75a744`, onda 1 §9).

**O que o P07-C usa do mecanismo do P05-C (R-20, T-20/T-55).** Contrato fechado na consolidação ([onda-2.md](onda-2.md) §4.2), pela API do plano do P05-C (§3.0 e §3.8 dele). O núcleo acima fecha o T-19 sozinho: a recusa é a resposta síncrona do `setDraftValue`, e o `useSetDraft` continua devolvendo o texto depois do P05-C.

- **No rebase sobre o P05-C (o P05-C entra antes na onda):**
  - as folhas deixam de guardar a frase e passam a ler o aviso do store, `useDraftNotice('values.<lista>')`;
  - a frase é desenhada com o `DraftNoticeText` dele, **dentro** da folha, no lugar descrito acima. Ele já tem `role="alert"`, `key` por recusa e `testID` `notice-<campo>`;
  - o store não vê o rascunho local do `ItemSheet` (`patch`). Por isso a folha chama `clearNotice()` a cada `patch`, ao cancelar a remoção e ao fechar. O aviso de uma folha fechada não fica na ficha;
  - o anúncio no app é o do P05-C (pergunta 5).
- **Avisar antes do toque (commit 7, opcional):**
  - no `ItemSheet`, o "+" do Valor usa `useStepAdvice('values.<lista>#<item>')` e a prop `increase` do `Stepper`, como o P05-C faz nos traços. O "Aplicar" continua ativo: a pessoa pode salvar o nome ou as notas;
  - na `AddItemSheet`, a prévia de "um item novo" não está no `stepAdvice` do P05-C, que trata de caminho de item existente. Ela fica fora do commit 7 e vai para o P07-D. Não se faz prévia por opção: cada uma rodaria um `checkCreation`, que é O(campos²) por causa do laço de `:675-694`.
  - **Não se cria `useDraftPreview`.** É um segundo mecanismo, que a consolidação descartou.
- **Se o P05-C atrasar:** o P07-C entra antes dele, sem o commit 7, com a frase vinda do retorno do `write`. Nesse caso, a migração do `ListEditor` para o `useDraftNotice` passa ao P05-C, no rebase dele. É a única situação em que ele toca o arquivo.
- **Acordo com o P05-C:** fora do caso acima, o P05-C não edita o `ListEditor`. O `RefusalCause` só ganha caso novo se a folha precisar de um motivo que não existe, sem mudar a assinatura do `draftRefusal`.

### 3.2 T-23 · O item nasce com o valor que o editor mostra

**Causa.**

- O `add` (`ListEditor.tsx:70-79`) dá `value` inicial ao item (`:73-75`), mas nenhum `meta`.
- O editor mostra, para o meta numérico sem valor, o mínimo do template: `Number(draft.meta?.[m.id] ?? m.min ?? 0)` (`:305`). No Defeito, `bonus` tem `min: 1` (`vtm-v20.json:585`), e aparece "Bônus 1".
- O `ItemSheet` começa do item gravado (`:238`): "Aplicar" sem mexer grava o mesmo item, sem `meta`.
- O stepper tem `min = m.min = 1`. O "−" fica bloqueado em 1, e o único jeito de gravar 1 é subir para 2 e voltar.
- A conta do core lê o meta gravado: sem `bonus`, a regra `credit` soma 0 e não acusa nada (`packages/sheet-core/src/creation.ts:646-671`). Na Qualidade, a regra `item-meta` sem `cost` vira `CREATION_NOT_PURCHASABLE` (`:659-664`), que é o T-08.
- **O servidor calcula certo** para o que recebe: a conta é a mesma do cliente (`checkCreation`). O erro é o cliente mostrar um valor que não gravou.

**Correção (genérica, sem mudar regra).**

- Um helper puro, `withItemDefaults(def, item)` (arquivo novo `apps/frontend/sheet/evolve/listItem.ts`): para cada meta numérico **com `min` no template** e sem valor no item, grava o `min`, que é o que o editor já mostra. Metas sem `min` (o Ataque e a Qtd. do D&D, `dnd5e-2014.json`) continuam sem valor: o editor mostra 0 como marcador, e nenhuma conta lê esses metas.
- O `add` usa o helper. O item novo passa a ser, por exemplo, `{ id, name: 'Inimigo', meta: { bonus: 1 } }`.
- O `ItemSheet` começa de `withItemDefaults(def, item)`. Um Defeito antigo, gravado sem `bonus`, passa a valer o que a folha mostra quando a pessoa toca "Aplicar" (saldo 15 → 16, o esperado da matriz).
- A linha da lista mostra o rótulo dos metas numéricos: `ItemLine` (`ListView.tsx:79-82`) passa a "Social · Bônus 2" em vez de "Social · 2", como o `describeItem` já fala (`:45-48`). Os metas de texto continuam só com o valor.
- Efeito em outros itens com meta numérico com `min`, todos já mostrados no editor com esse valor: o `Custo` da Qualidade (1), o `Posto` do Dom (1), o `Nível` e a `Gnose` do Fetiche, o `Nível` do Rito (0), o `Nível`, o `Arete` e a `Quintessência` da Maravilha. Nenhum desses, fora a Qualidade e o Defeito, entra na conta da criação (W20: `untracked` inclui `rites` e `fetishes`; M20: `wonders`).

**Consequência na Qualidade (T-08, P07-D).** Com o `Custo 1` gravado, a Qualidade passa a entrar na criação por pontos, paga com 1 de bônus, na fase de básicos ou de bônus (os bônus não dependem da fase; só os grupos travam em "Pontos básicos"). Se o saldo não cobrir, a recusa é "Bônus: …" (texto do P05-C), dentro da folha (T-19), com o nome mantido. Seção 2, ponto 1.

### 3.3 T-58 · Um título e um contador por bloco

**De onde vem cada repetição** (conferido nos três templates):

| Sistema | O que aparece | Quem desenha cada um |
|---|---|---|
| V20, aba Vantagens | "Disciplinas 0/3" e "Disciplinas 0" | Grupo "Disciplinas" + `CreationCounter` (`GroupsLayout.tsx:100-108`); `ListHeader` do `ListEditor` com `short` = itens (`ListView.tsx:52-68`, `fields/list.ts:5-8`) |
| W20, seção Dons | "Dons 0/3 · Dons 0/3 · Dons 0" | Seção "Dons" + contador (`SectionView.tsx:24-31`; a seção só tem `gifts`, então o `groupFor` acha o grupo); grupo "Dons" + o mesmo contador; `ListHeader` "Dons 0" |
| M20, seção Antecedentes | "7/7" duas vezes | Seção "Antecedentes" + contador; grupo "Antecedentes" + o mesmo contador |
| Criação livre (qualquer) | "Disciplinas 3" com 4 pontos | Sem conta, só sobra o `short` do `ListHeader`, que é a quantidade de itens, sem unidade |

**Desenho (regra genérica, pelo texto dos títulos do template):**

1. **Seção × grupo.** Quando a seção tem um grupo só, com o mesmo título da seção (comparação com `fold`, `apps/frontend/sheet/evolve/text.ts:5-6`), e o título da seção está à vista, o `GroupsLayout` não desenha o título desse grupo. O cabeçalho da seção já tem o título e o contador do mesmo conjunto de campos. O `LayoutProps` (`apps/frontend/sheet/layouts/types.ts:4-6`) ganha `titled?: boolean`, e o `SectionView` passa `!hideTitle`. Com a seção sem título (zona de uma seção só, `SheetView.tsx:149`), o grupo continua com o dele. Vale em todos os modos: é só um título repetido. Pega W20 (Dons, Ritos, Fetiches, Antecedentes) e M20 (Ressonância, Antecedentes, Rotinas).
2. **Grupo × lista, só no Editar e na Criação.** Quando o bloco (seção ou grupo) tem um campo só, do tipo `list`, com o rótulo igual ao título do bloco, o `ListEditor` não desenha o `ListHeader`. O `GroupsLayout` informa o campo "já intitulado" por um context pequeno (`HeadedList`), e o `ListEditor` o lê. Pega todas as listas das Vantagens dos três sistemas (Disciplinas, Antecedentes, Qualidades, Defeitos, Dons…). "Cicatrizes" × "Cicatrizes de batalha" continua com os dois, porque os títulos diferem. Em Jogo e Leitura, o `ListRow` mantém o cabeçalho: lá ele é o botão que abre o detalhe do campo (`FieldTarget`, `useOpenField` só fora do rascunho, `apps/frontend/sheet/play/sheetContext.ts:27-31`).
3. **Um contador, com unidade.** O `CreationCounter` (`apps/frontend/sheet/creation/CreationCounter.tsx:18`) ganha `items?: FieldId`. Quando a conta não se aplica (`:40`, modo livre ou fora da criação) e o modo é de rascunho, ele mostra a contagem da lista com unidade: "3 itens", com `plural` do core. Lista fixa (Ressonância) mostra o `short` dela ("1/3"). O cabeçalho que intitula a lista (seção ou grupo) passa `items`. Na criação por pontos, aparece só o contador da conta ("0/3"), que já é em pontos nas Disciplinas e Antecedentes e em itens nos Dons (o orçamento do W20 é `item-count`; o `counterSpoken` já fala "itens", `apps/frontend/sheet/creation/creation.ts:124-129`).

Resultado: "Disciplinas · 0/3" (pontos), "Dons · 0/3" uma vez, "Antecedentes · 7/7" uma vez, e na criação livre "Disciplinas · 3 itens".

**Fora do T-58:**

- o título repetido em Jogo ("Disciplinas" no grupo e "Disciplinas 3" no `ListRow`). A matriz marca a tela como Criação/Editar, e em Jogo o cabeçalho da lista é o alvo do detalhe;
- somar os pontos dos itens na criação livre ("Disciplinas 4 pontos"), que o EW-29 sugere: é informação nova. A recomendação da linha é dizer a unidade.

### 3.4 T-62 · Enter e "✓" adicionam

- O `TextField` da `AddItemSheet` (`ListEditor.tsx:184-190`) ganha `returnKeyType="done"`, `submitBehavior="submit"` e, no web, `blurOnSubmit={false}`, o mesmo padrão do `NumberEditorRow` (`:188-202`, T-25 da onda 1). Também ganha `onSubmitEditing={submit}`.
- `submit()` faz o que o botão à vista faria:
  - nome igual a um item do catálogo que ainda não está na ficha: adiciona o item do catálogo;
  - lista sem catálogo (Dom, Qualidade, Defeito, Rotina) ou busca sem nenhuma sugestão: adiciona o texto livre, como o botão "Adicionar “…”";
  - com sugestões do catálogo à vista e sem nome exato: o Enter não adiciona texto livre (evita "Domi" como Disciplina). A pessoa toca a sugestão. Pergunta 3.
- Recusado pela conta, a frase vai para o `error` do campo (seção 3.1), o foco fica no campo e o nome fica. Aceito, a folha fecha, e o foco volta ao "Adicionar …" (o `restoreFocus` do `BottomSheet`, T-71, não muda).
- O botão "Adicionar “…”" continua aparecendo só com texto digitado. Antes disso não há o que adicionar, e um botão desabilitado sem motivo seria pior.

---

## 4. Testes

### 4.1 Um teste de regressão por bug (falha antes, passa depois)

| Item | Teste | Onde | O que prova |
|---|---|---|---|
| T-19 | "4ª Disciplina com 3/3 em Pontos básicos: a recusa aparece dentro da folha, embaixo da opção, e nada fica na ficha ao fechar" | `apps/frontend/sheet/creation/__tests__/advantages.test.tsx` (novo; `SheetScreen` em `initialMode="create"`, 390 px, como o `CreationScreen.test.tsx`) | `within(folha).getByRole('alert')` com o rótulo do grupo; `within(screen.getByTestId('editor-disciplines')).queryByRole('alert')` nulo antes e depois de fechar |
| T-19 | "Editor de Disciplina: + + e Aplicar acima dos básicos: frase acima do Aplicar; o − a apaga; Aplicar com 1 grava" | mesmo arquivo | A folha continua aberta com a frase; o `patch` limpa |
| T-19 | "Tirar o Defeito cujo crédito foi gasto: a recusa aparece sob 'Remover X?'" | mesmo arquivo | A remoção recusada não some atrás da folha |
| T-19 | "Recusa de texto livre mantém o nome" (bônus 0 → Adicionar Qualidade → "Ambidestro" → Adicionar) | mesmo arquivo | `textInput('Nome')` continua com "Ambidestro"; a frase está no campo |
| T-23 | "Defeito novo nasce com Bônus 1 e o saldo passa a 16 de 16" | mesmo arquivo | `draftEvents()[0].to` contém `meta: { bonus: 1 }`; `getByTestId('creation-freebies')` contém "16" |
| T-23 | "Defeito gravado sem bônus: abrir e Aplicar grava o 1 que a folha mostra" | `apps/frontend/sheet/evolve/__tests__/ListEditor.test.tsx` | Cobre os itens antigos |
| T-23 | "A linha mostra 'Bônus 1'" e "metas sem `min` (D&D) não ganham valor" | `ListEditor.test.tsx` | `getByText('Bônus 1')`; o ataque novo do D&D sem `meta` |
| T-23 | Unidade do helper `withItemDefaults` | `apps/frontend/sheet/evolve/__tests__/listItem.test.ts` (novo) | Com e sem `min`, valor já gravado preservado, lista fixa, aspecto (Fate) |
| T-58 | "V20 por pontos: um título 'Disciplinas' e um contador '0/3'" | `apps/frontend/sheet/layouts/__tests__/layouts.test.tsx` | `getAllByRole('header', { name: 'Disciplinas' })` com 1; nenhum texto "Disciplinas" fora do cabeçalho |
| T-58 | "W20: 'Dons' uma vez, com '0/3'"; "M20: '7/7' uma vez"; "criação livre: '3 itens'" | `layouts.test.tsx` | Um caso por sistema (V20, W20, M20) |
| T-58 | "Em Jogo, o cabeçalho da lista continua (abre o detalhe)" | `layouts.test.tsx` | O `ListRow` não muda: guarda contra regressão no detalhe |
| T-62 | "Enter adiciona Dom e Qualidade; Enter com nome exato do catálogo adiciona a Disciplina; com sugestão parcial não adiciona texto livre" | `ListEditor.test.tsx` | `fireEvent(textInput('Nome'), 'submitEditing')` |

**O servidor continua recusando** (passa antes e depois: prova que o cliente só avisa):

- `packages/sheet-core/src/__tests__/creation.test.ts`: "Defeito sem `bonus` dá crédito 0" (o caso que o T-23 evita no cliente; hoje só há o caso com bônus, `:229`).
- `apps/api/src/__tests__/creation.test.ts`, no `describe('/events: avaliação parcial')` (`:260`), com o template `acct-teste`:
  - Qualidade sem `cost` → 422 `CREATION_BUDGET_EXCEEDED` com `CREATION_NOT_PURCHASABLE`;
  - Qualidade com custo acima do saldo → 422 com `CREATION_FREEBIES_EXCEEDED`;
  - tirar o Defeito depois de gastar o crédito → 422.

  Nos três casos, `sheet_data` não muda. É PGLite, sem `*.pg.test`: não há concorrência nova.

### 4.2 Testes existentes que mudam junto

| Arquivo | Por quê |
|---|---|
| `apps/frontend/sheet/evolve/__tests__/ListEditor.test.tsx` | Itens novos com meta numérico ganham o `min` (o caso do D&D, `:141`, não muda: o ataque não tem `min`). Nenhum teste atual busca a recusa embaixo da lista (conferido no grep); os novos a buscam na folha. Usar `textInput()` (onda 1, P06) para o campo da folha |
| `apps/frontend/sheet/layouts/__tests__/layouts.test.tsx` (`:303-319`) | O teste das Vantagens em Jogo continua (o `ListRow` não muda); entram os casos do T-58 |
| `apps/frontend/sheet/evolve/__tests__/mage.test.tsx`, `evolve.test.tsx` | Conferir buscas pelo cabeçalho da lista no Editar (Rotinas, Ressonância, Disciplinas). Nenhuma busca pelo texto do `ListHeader` foi achada no grep, mas a suíte roda inteira |
| `e2e/tests/journey-werewolf.spec.ts:85-89`, `journey-mage.spec.ts:88-97`, `journey.spec.ts:112-121`, `evolve.spec.ts:43-45` | Continuam clicando "Adicionar “…”" e as opções (não mudam). O `sheet.spec.ts:67` ("Disciplinas: 0 itens") é em Jogo e continua |

A frase da recusa é do P05-C (T-07 e T-57 mudam o texto). Os testes do P07-C não fixam a frase inteira: buscam o papel `alert` dentro da folha e o rótulo do grupo ("Disciplinas"), para não quebrar no rebase sobre o P05-C.

### 4.3 E2E novo: `e2e/tests/advantages.spec.ts` (Chromium e WebKit, 390 × 844)

`test.use({ viewport: { width: 390, height: 844 } })`. Conta e crônica pela API (`signUp`, `apiAs`, `e2e/support/users.ts`), `vtm-v20` no padrão do template (por pontos, sem `freeCreation`).

1. Nova ficha: `getByLabel('Nome (obrigatório)')`, rádio `Tremere`, botão `Criar ficha`. A ficha abre em Criação (`getByRole('tab', { name: 'Orçamento' })` visível).
2. Aba da ficha: `getByRole('tab', { name: 'Vantagens' })`.
3. **T-58:**
   - `getByRole('heading', { name: 'Disciplinas', exact: true })` com contagem 1;
   - `getByTestId('counter-disciplines')` com "0/3";
   - `getByRole('heading', { name: 'Defeitos', exact: true })` com contagem 1.
4. Três Disciplinas, cada uma assim: `getByRole('button', { name: 'Adicionar Disciplina' })`, `getByLabel('Buscar Disciplina').fill(nome)`, `getByRole('button', { name: nome, exact: true })`. Os nomes são Auspícios, Dominação e Fortitude.
5. **T-19:**
   - a quarta: "Adicionar Disciplina" → busca "ofusc" → `Ofuscação`;
   - a folha (`page.getByRole('dialog').or(page.locator('[aria-modal]')).first()`, o mesmo seletor do `a11y-keyboard.spec.ts:78-80`) mostra `getByRole('alert')` com "Disciplinas";
   - `page.getByTestId('editor-disciplines').getByRole('alert')` tem contagem 0;
   - `Escape` fecha. O foco volta a "Adicionar Disciplina" (T-71 não regride), e `page.getByRole('alert')` tem contagem 0.
6. **T-62 e T-23:**
   - "Adicionar Defeito" → `getByRole('textbox', { name: 'Nome', exact: true }).fill('Inimigo')` → `press('Enter')`;
   - aparece `getByRole('button', { name: /^Inimigo, Bônus 1/ })`;
   - aba `Orçamento`: `getByTestId('creation-freebies')` contém "16".
7. **T-62 com a Qualidade:** "Adicionar Qualidade" → "Ambidestro" → `Enter`. Aparece `getByRole('button', { name: /^Ambidestro, Custo 1/ })`, se a pergunta 1 ficar com o desenho genérico.

O spec não cria rascunho que outro spec leia nem usa porta nova. Roda na integração da onda, como os outros (matriz, "Recursos compartilhados").

### 4.4 Suítes do "PR local" e cobertura

- `npx pnpm typecheck`, `npx pnpm lint`.
- `npx pnpm -C apps/frontend test:coverage`. A meta do `jest.config.js:35-37` vale **por arquivo** dentro de `./sheet/` (80% de linhas e funções, 70% de ramos; lição da onda 1). O `listItem.ts` novo e os ramos novos do `ListEditor.tsx`, `GroupsLayout.tsx`, `SectionView.tsx` e `CreationCounter.tsx` precisam de casos próprios. Os ramos web (`blurOnSubmit`) e nativo (`announceForAccessibility`) são cobertos com `Platform.OS` trocado no teste, como o P06 fez.
- `bun test --coverage` no `packages/sheet-core` (95%) e no `apps/api` (85%): entram só testes, sem código novo.
- E2E e build nativo só na integração da onda.

---

## 5. Segurança

O pacote muda só a interface. Não mexe em API, AuthZ, sessão, armazenamento, rede nem dependência (nada para o `npm audit`). Por isso o "PR local" pede só `/code-review`, sem `/security-review`.

| Ameaça | Como o desenho evita |
|---|---|
| O cliente passa a "deixar" o que a regra não deixa (Qualidade entra; Enter adiciona) | Nada da regra sai do servidor: o `POST /characters/:id/events` roda o `checkCreationBatch` (`apps/api/src/sheets/events.ts:257`), e os testes da seção 4.1 provam a recusa no servidor para Qualidade sem custo, custo acima do saldo e Defeito tirado depois de gasto. A trava de fase segue só no app, como hoje |
| Valor inicial forjado num meta (um cliente hostil grava `bonus: 10`) | O validador do core recusa fora de `min`/`max` (`validate/sheet.ts:290-300`). O crédito do Defeito tem teto no template (`max: 7`) e no core (`creation.ts:670`). Com a aprovação ligada, o narrador revê a ficha. Não há superfície nova: o mesmo valor já podia ser gravado pelo stepper |
| Texto do jogador desenhado na frase de recusa ou no nome mantido | Sempre `<Text>` (o react-native-web escapa), nunca HTML. A frase de recusa usa só rótulos do template (`problemText`, `creation.ts:157`: "nunca texto da ficha") |
| Recusa que vaza estado de outra ficha | A prévia (commit 7) lê só o store da ficha aberta, com os papéis já carregados, sem chamada nova à API |
| Dados pessoais em log | Nenhum log novo. O `announceForAccessibility` fala o texto da tela, sem dado além do que já está à vista |

---

## 6. Como generaliza além do WoD

- **Recusa dentro da folha (T-19):** vale para qualquer lista do template (magias do D&D, armas do CoC, façanhas do Fate) e para qualquer recusa (conta da criação, limite do lote, validador). A folha só mostra o que o `setDraftValue` devolve.
- **Valor inicial (T-23):** sai do `min` de cada meta numérico do template. Qualquer item que devolve pontos (Defeito; Flaw de outros sistemas) ou custa pelo item (Qualidade; feat com custo) nasce com o valor que o editor mostra. Meta sem `min` (Qtd. do inventário do D&D) não ganha valor inventado.
- **Um título e um contador (T-58):** a regra compara títulos do template, sem conhecer sistema. Um template com seção "Magias" e lista "Magias" ganha o mesmo tratamento, e a unidade ("itens", "pontos" ou o `short` da lista fixa) vem do tipo de campo e da regra do orçamento (`measure`).
- **Enter (T-62):** vale para qualquer folha "Adicionar …", com ou sem catálogo.

---

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado**, com os arquivos conferidos (seção 1) e a pergunta 1 respondida na consolidação.
2. **Typecheck, lint e testes** de `frontend`, `@tms/sheet-core` e `@tms/api`, com cobertura (seção 4.4).
3. **Um teste de regressão por bug** (seção 4.1), mais os testes de recusa no servidor.
4. **`/code-review`** no diff do pacote.
5. **Os cenários das personas, repetidos sem o defeito** (API local com `npx pnpm seed:roteiro`, conta `roteiro_jogador1`, crônicas "Vampiro v4", "Lobisomem v4" e "Mago v4" por pontos e "Vampiro v3/v5" livre; só contas fictícias):
   - **QA web, QAW-24** (web 390): Disciplinas 3/3 → Adicionar Disciplina → Dominação → aviso dentro do diálogo.
   - **QA app, QAA-08, QAA-05 e QAA-07** (iOS e Android):
     - a 4ª Disciplina avisa na folha;
     - Adicionar Qualidade → nome → Adicionar entra com "Custo 1" (ou, sem saldo, avisa na folha com o nome mantido);
     - Adicionar Defeito → abrir → Aplicar leva o saldo de 15 a 16.
   - **QA app, diário 16:17** (Android, crônica livre): Adicionar Qualidade → "✓" adiciona. O teclado cobrindo a folha é o T-10 (P08).
   - **Experiente app, EA-01** (Android): Ofuscação 1 → + + → Aplicar → aviso na folha, perto do Aplicar.
   - **Experiente app, EA-17 e diário 14:56–15:06** (Android, Lobisomem v4): "Dons" uma vez, com um contador; Enter adiciona o Dom.
   - **Experiente web, EW-15** (web 390, bônus 4): Adicionar Disciplina → Fortitude → aviso na folha.
   - **Experiente web, EW-29** (web): no Mago, "7/7" uma vez; na criação livre, "N itens".
   - **PO web, POW-21 e POW-22** (web 390): Enter adiciona o Dom; títulos sem repetição.
   - **IW-21, IA-28 e NA-28:** títulos das Vantagens uma vez (web, iOS e iOS do narrador).
6. **Conferência no aparelho** (visível):
   - AVD Android em 360, 393 e 411 dp. A frase da recusa quebra em linhas dentro da folha, sem cortar. Em 360, o "Adicionar “nome longo”" quebra sem passar da borda. Os cabeçalhos "Disciplinas · 0/3" e "Dons · 0/3" cabem;
   - simulador iOS, com o teclado de software ligado (⌘K): Enter ("return") adiciona, e a frase é anunciada pelo VoiceOver;
   - web 390 e 1280. Em 1280 a folha ainda ocupa a largura toda até o T-69 (P08);
   - Esc e foco de volta ao gatilho no web, um "Fechar" só (T-71), conferidos de novo nas duas folhas.
7. **Resumo do pacote** para a seção do PR da onda: o que mudou, como foi testado e os achados da revisão.

---

## 8. Commits, esforço, riscos e conflitos

### 8.1 Ordem dos commits

| # | Commit | Itens | Sai sozinho? |
|---|---|---|---|
| 1 | `test(core,api): a conta das listas continua recusando no servidor (Qualidade sem custo, saldo, Defeito tirado)` | prova da seção 4.1 | — |
| 2 | `fix(app): item de lista nasce com o valor numérico que o editor mostra; a linha mostra o rótulo (T-23)` | T-23 (e o efeito no T-08) | Sim |
| 3 | `fix(app): recusa dentro da folha de item, perto do toque; o nome digitado fica (T-19)` | T-19 | Sim |
| 4 | `fix(app): Enter e "✓" adicionam na folha "Adicionar …" (T-62)` | T-62 | Depende do 3 (a recusa do Enter vai para o campo) |
| 5 | `fix(app): um título e um contador por bloco; "N itens" fora da conta (T-58)` | T-58 | Sim |
| 6 | `test(e2e): Vantagens a 390 px: recusa na folha, Enter, Defeito no saldo e títulos` | E2E | — |
| 7 | *(opcional, depois do P05-C)* `feat(app): prévia da recusa nas folhas de item, com o "+" bloqueado e o motivo (T-19, R-20)` | T-19 (antes do toque) | Sim: sai se o P05-C não expuser a prévia |

O 2 vem antes do 3 porque o cenário da Qualidade muda: com o `Custo 1` gravado, o teste do T-19 passa a usar saldo zerado para provocar a recusa.

### 8.2 Esforço

| Item | Matriz | Plano | Por quê |
|---|---|---|---|
| T-19 | M | M | Duas folhas, três caminhos (adicionar, aplicar, remover), anúncio no app e um arquivo de teste novo |
| T-23 | P | P | Um helper e duas chamadas, mais o rótulo na linha |
| T-58 | P | P a M | Três arquivos (`SectionView`, `GroupsLayout`, `CreationCounter`), mais o context e casos nos três sistemas |
| T-62 | M (pela R-27) | P | Sem o catálogo de Dons (P07-D), é só o Enter |
| Commit 7 | — | P | Só se o P05-C entregar a prévia |

**Total: M (3 a 4 dias), em 6 commits, mais 1 opcional.** O E2E novo é parte do "M".

### 8.3 Riscos

- **O T-23 antecipa parte da D-06.** A Qualidade passa a entrar na criação por pontos (com `Custo 1`). Se a consolidação preferir manter o T-08 para o P07-D, a alternativa da pergunta 1 restringe o valor inicial.
- **Itens antigos sem meta:** abrir e tocar "Aplicar" sem mexer passa a gerar uma alteração (o meta com o valor mostrado). É o esperado da matriz (saldo 15 → 16), mas aparece no resumo do "Salvar" e no Histórico como mudança do item.
- **A frase depende do P05-C.** Se o P05-C mudar o caminho da recusa (store em vez do retorno do `setDraftValue`), o rebase do P07-C troca a origem da frase nas folhas. O acordo da seção 3.1 evita que os dois editem o `ListEditor`.
- **Android com teclado (T-10, P08):** até o P08 entrar, a frase embaixo do campo da folha "Adicionar Dom" pode ficar atrás do teclado no Android. Na integração, o P08 confere a folha com a frase.
- **Cabeçalho escondido e leitor de tela:** sem o `ListHeader` no Editar, o resumo da lista para o leitor de tela passa a ser o cabeçalho do bloco ("Disciplinas", nível 3) mais o contador ("Disciplinas: 0 de 3 pontos básicos" ou "3 itens"). Conferir no TalkBack e no VoiceOver na integração.

### 8.4 Conflitos com os pacotes da onda

Ordem de merge preliminar: **P04-C → P05-C → P07-C → P08**. O código confirma P05-C antes do P07-C (a frase e a prévia vêm dele) e P07-C antes do P08 (`GroupsLayout` e folhas).

| Pacote | Arquivo ou contrato | Risco | Como integrar |
|---|---|---|---|
| P05-C | Texto da recusa (`problemText`, `basicsSpentText`, `draftRefusal` em `apps/frontend/sheet/creation/creation.ts`) | Baixo | O P07-C não edita o arquivo. Os testes não fixam a frase (seção 4.2) |
| P05-C | Mecanismo da R-20 (recusa recalculada, "+" bloqueado) | Médio | Acordo da seção 3.1 ([onda-2.md](onda-2.md) §4.2): o P05-C não edita o `ListEditor`. O P07-C adota o `useDraftNotice` e o `DraftNoticeText` no rebase. O commit 7 usa o `useStepAdvice` e o `Stepper.increase` |
| P05-C | `CreationCounter.tsx` | Baixo | O P07-C só acrescenta `items?` e um ramo depois do `:40`. Se o P05-C mexer no contador (custo, R-17), os trechos são diferentes |
| P05-C | `packages/sheet-core/src/__tests__/creation.test.ts` | Baixo | Casos em `describe` diferentes |
| P05-C | `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | Nenhum | O P07-C usa um arquivo novo (`advantages.test.tsx`), com o próprio `open()`, para não disputar o arquivo |
| P04-C | `apps/api/src/__tests__/creation.test.ts` | Baixo | O P07-C acrescenta casos no `describe('/events: …')`; o P04-C (T-80, aprovação e Histórico) mexe em `concluir, aprovar e devolver` |
| P04-C | `SheetScreen`, `CreationPanel`, `ModeBar`, `new-character`, API | Nenhum | O P07-C não toca |
| P08 | `GroupsLayout.tsx` (T-28, colunas no desktop; talvez T-27, contador fixo) | Médio | O P08 entra depois e põe cada grupo numa coluna. A regra do título (seção 3.3, itens 1 e 2) e o `items` do contador vão juntos para dentro da coluna |
| P08 | `BottomSheet.tsx` (T-10, T-69) | Baixo | O P07-C não muda o `BottomSheet`. As frases estão no `children` e herdam a folha nova. O P08 inclui "Adicionar Dom/Qualidade" com a frase de recusa na conferência do T-10 no Android |
| P08 | `ListEditor.tsx` (T-26: "Próximo" entre campos) | Baixo | O P07-C usa o Enter só no campo da `AddItemSheet` (adicionar). Se o P08 puser "Próximo" nos campos do `ItemSheet` (Nome → Especialização → Notas), ele fica com esses campos |
| P10-C (onda 4) | `ListEditor.tsx:103-107` ("Nenhum Qualidade", T-66) | Nenhum agora | Trecho não tocado |

### 8.5 Arquivos tocados

Linhas do commit `9f75426`.

| Arquivo | Trecho | Itens | Cruza com |
|---|---|---|---|
| `apps/frontend/sheet/evolve/ListEditor.tsx` | `write` e `error` (`:60`, `:65-69`, `:108-117`); `add` (`:70-80`); `AddItemSheet` (`:152-221`: `pick` `:170-173`, campo `:184-190`, opções `:191-210`, botão `:211-217`); `ItemSheet` (`:223-346`: rascunho `:238`, rodapé `:243-263`, confirmação `:267-268`); `ListHeader` condicional (`:85`) | T-19, T-23, T-58, T-62 | P05-C (mecanismo), P08 (T-10, T-26) |
| `apps/frontend/sheet/evolve/listItem.ts` (novo) | `withItemDefaults` | T-23 | — |
| `apps/frontend/sheet/views/ListView.tsx` | `ItemLine`, metas com rótulo (`:79-82`) | T-23 | — |
| `apps/frontend/sheet/SectionView.tsx` | `titled` para o layout; `items` no contador (`:24-32`) | T-58 | — |
| `apps/frontend/sheet/layouts/types.ts` | `LayoutProps.titled?` (`:4-6`) | T-58 | — |
| `apps/frontend/sheet/layouts/GroupsLayout.tsx` | Título do grupo e contador (`:100-109`); provider `HeadedList` em volta dos campos (`:110-122`) | T-58 | P08 (T-28, T-27) |
| `apps/frontend/sheet/creation/CreationCounter.tsx` | `items?` e o ramo "N itens" (`:18-40`) | T-58 | P05-C (baixo) |
| `apps/frontend/sheet/creation/__tests__/advantages.test.tsx` (novo) | — | T-19, T-23 | — |
| `apps/frontend/sheet/evolve/__tests__/ListEditor.test.tsx`, `__tests__/listItem.test.ts` (novo) | — | T-23, T-62 | — |
| `apps/frontend/sheet/layouts/__tests__/layouts.test.tsx` | Casos novos depois de `:303` | T-58 | P08 (T-28 testa colunas no mesmo arquivo) |
| `packages/sheet-core/src/__tests__/creation.test.ts` | Caso novo perto de `:229` | prova | P05-C (baixo) |
| `apps/api/src/__tests__/creation.test.ts` | Casos no `describe` de `:260` | prova | P04-C (baixo) |
| `e2e/tests/advantages.spec.ts` (novo) | — | todos | — |
| *(commit 7)* `ListEditor.tsx`, com `useStepAdvice` e `Stepper.increase` do P05-C | `ItemSheet` (Valor `:286-298`) | T-19 | P05-C |

---

## 9. Perguntas abertas (técnicas)

1. **Alcance do valor inicial (T-23).** O desenho grava o `min` de todo meta numérico com mínimo. É genérico e faz a Qualidade entrar com `Custo 1`, o que a D-06 já decidiu. A alternativa é gravar só os metas lidos por uma regra `credit` (o `bonus` do Defeito): deixa a recusa da Qualidade para o P07-D, mas acopla o editor às regras de custo do template. A consolidação escolhe; o plano recomenda o genérico. Ligado ao ponto 1 da seção 2: a "correção do template `vtm-v20`" da D-06 não tem o que corrigir.
2. **Item antigo sem meta:** preencher ao abrir a folha (proposto) faz "Aplicar sem mexer" virar uma alteração. A alternativa é preencher só ao mudar outro campo do item, o que deixa a folha mostrando um valor que não vale até lá.
3. **Enter com sugestões parciais do catálogo:**
   - não adicionar texto livre (proposto);
   - adicionar o texto digitado, como o botão "Adicionar “…”" à vista;
   - escolher a sugestão quando for uma só.
4. **Contrato da prévia do P05-C:** resolvido na consolidação ([onda-2.md](onda-2.md) §4.2). O P07-C usa `useDraftNotice`, `DraftNoticeText`, `clearNotice`, `useStepAdvice` e `Stepper.increase`, do P05-C. Não se cria `useDraftPreview`. A prévia do item novo na `AddItemSheet` vai para o P07-D.
5. **Anúncio no app:** `role="alert"` mais `announceForAccessibility`, como o `CombatDock`, ou o anúncio que o P05-C adotar para a recusa perto do toque (um só padrão nas duas folhas e nas linhas).
6. **Regra "seção × grupo" em todos os modos** (proposto: é só um título repetido), ou só no Editar e na Criação, como a regra "grupo × lista"?
7. **`titled` no `LayoutProps` ou context.** A prop é explícita, e os outros layouts a ignoram. Um context evitaria mexer no tipo, mas esconde a dependência. O plano usa a prop.

---

## 10. Desvios na implementação

Implementado nos commits 1 a 6 da seção 8.1, em paralelo com o P05-C. As perguntas da seção 9 seguiram a proposta do plano: 1 (valor inicial genérico, `withItemDefaults`), 2 (preencher ao abrir a folha), 3 (com sugestões do catálogo à vista, o Enter não adiciona texto livre), 6 (regra "seção × grupo" em todos os modos) e 7 (`titled` como prop do `LayoutProps`). A 4 e a 5 dependem do P05-C (abaixo). O que mudou em relação ao desenho:

| Item | Desvio | Por quê |
|---|---|---|
| T-58 | O contador "N itens" no cabeçalho da **seção** só aparece quando a seção tem um grupo só, com o mesmo nome dela (`echoesSection`, em `layouts/headedList.ts`) | No W20, a seção "Cicatrizes de batalha" tem uma lista com o mesmo rótulo, mas o grupo do meio se chama "Cicatrizes": o cabeçalho da lista fica (títulos diferentes) e o número sairia duas vezes |
| T-58 | O provedor `HeadedList` vai num `GroupBlock` que substitui o `View` de cada grupo, sem reindentar o corpo do `GroupsLayout` | O P08 mexe nas colunas do mesmo trecho (T-28): o diff fica em duas linhas ali |
| T-58 | Os casos da criação por pontos (V20 "0/3", W20 "Dons · 0/3", M20 "7/7" uma vez, criação livre "3 itens") ficam no `advantages.test.tsx`; o `layouts.test.tsx` fica com o Editar (V20, W20, M20) e o Jogo | O contador da conta precisa do `CreationContext`, que só o `SheetScreen` monta; o `layouts.test.tsx` renderiza o `SheetView` sem ele |
| T-23 | A linha do item usa o sinal do template nos metas numéricos com `display: 'signed'` ("Ataque +2", D&D), como o resto da ficha (`fmtSigned`) | Com o rótulo na frente, "Ataque 2" leria como contagem |
| T-19 | As folhas ganham `testID` (`add-sheet-<lista>`, `item-sheet-<lista>`) pela prop que o `BottomSheet` já tinha, e a frase, `refusal-<lista>`. O `@tms/ui` não muda | Os testes acham a frase dentro da folha |
| T-19 | No Jest, o `Modal` fica dentro da árvore do `ListEditor`; o teste confere que as frases da ficha são só as da folha e que, ao fechar, não sobra nenhuma. No E2E (web), o `Modal` é um portal, e o seletor da seção 4.3 vale como está | O `within(editor)` do plano também acharia a frase da folha no Jest |
| T-19 | O anúncio no app é o `announceForAccessibility` sem condição de plataforma, como o `CombatDock`, a `ModeBar` e o `CreationPanel` | Mesmo padrão do app até o P05-C (pergunta 5) |
| T-62 | Quando o Enter não adiciona (sugestões do catálogo à vista, ou o nome exato já na ficha), o campo diz por quê: "Toque numa sugestão, ou em “Adicionar “…”” para usar o nome como está." ou "X já está na ficha." | Correção da revisão: sem a frase, o Enter parecia não funcionar |
| T-58 | O "N itens" do bloco só aparece quando a lista vira o editor (`drawsEditor`, o mesmo teste do `FieldSlot`) | Correção da revisão: a lista que o papel não escreve fica no `ListRow`, com o próprio cabeçalho, e o número saía duas vezes |
| prova | O teste do core "Defeito sem `bonus` dá crédito 0" confere a linha do `credit` com 0 unidades e custo 0 (a linha existe, vazia) | É o que o core devolve |

**`/code-review` (nível high), 9 achados:**

- **Corrigidos** (dois commits `fix:` depois do E2E):
  - o "N itens" contava de novo a lista que o papel não escreve;
  - o "Remover" mostrava a recusa do "Aplicar" sob "Remover X?";
  - o leitor de tela dizia "Ataque 2" com a linha mostrando "+2" (agora "Ataque mais 2", como o número `signed`);
  - o Enter não dizia nada quando não adicionava;
  - duas simplificações (a busca do nome exato uma vez só; um sentinela só no `headedList`).
- **Mantidos, pelo plano:**
  - o `ItemSheet` grava o mínimo ao abrir um item antigo, mesmo quando só as notas mudam. É a pergunta 2 da seção 9 (o esperado da matriz é "Aplicar" levar o saldo de 15 a 16) e o risco já está na seção 8.3;
  - a regra "meta vazio vale o mínimo" no core (como o `value`) mudaria a conta do servidor: fica fora do pacote, que não muda o `@tms/sheet-core`;
  - o texto livre igual a um item da ficha continua entrando (o botão já fazia isso antes da onda; não existe regra de nome repetido no template). Fica como nota para o P07-D.
- **`GroupBlock`:** fica como componente, para o diff do `GroupsLayout` não reindentar o trecho das colunas do P08.

**Depois do P05-C** (merge da onda `fa8ecfa` na branch, `6d7932a`):

- **Merge:** um conflito, em `apps/api/src/__tests__/creation.test.ts`: os casos das listas do P07-C e o `describe` "o servidor recusa o que o app só sinaliza" do P05-C ficam juntos em `/events: avaliação parcial`. O `CreationCounter.tsx` mesclou sozinho. No `advantages.test.tsx`, a busca da frase passa a `/bônus/i`, porque o T-57 do P05-C reescreveu o texto ("Faltaria 1 de bônus: custa 1, restam 0.").
- **T-19 pelo aviso do store** (`ab7fc22`):
  - as folhas leem o `useDraftNotice('values.<lista>')` e desenham o `DraftNoticeText` dentro da folha. A folha guarda só onde foi o toque: embaixo da opção ou do botão do texto livre, acima do "Aplicar" ou sob "Remover X?";
  - recusado pelo Enter, o texto do aviso vai como `error` do próprio campo, marcado inválido e ligado à frase;
  - o `clearNotice()` roda no `patch`, ao cancelar a remoção, ao trocar a busca e ao fechar, e só quando o aviso é desta lista: o aviso de uma linha de Atributo continua;
  - a dica do Enter (sugestões à vista, nome já na ficha) fica como `error` local do campo, porque não é recusa da conta;
  - o anúncio é o do P05-C: `role="alert"` com `key` por aviso, sem o `announceForAccessibility` que o pacote usava antes.
- **Commit 7** (`d971b44`): o "+" do Valor no `ItemSheet` usa o `useStepAdvice('values.<lista>#<item>')` e o `Stepper.increase`, com o motivo ou o custo escrito sob o Valor. O contrato do P05-C serve sem mudar o core, com um limite: a previsão é do valor que o store tem. Com o Valor já mudado na folha, ela sai, e o toque decide. Item sem Valor (Dons do W20) não tem previsão.
- **`/code-review` (nível medium) do merge e dos dois commits:** 6 achados.
  - **Corrigidos (4):**
    - a previsão em item sem Valor;
    - o `clearNotice()` apagava o aviso de outra linha;
    - o "+" sem `aria-describedby` para o aviso aberto;
    - a recusa do Enter fora do `error` do campo.
  - **Não corrigidos (2):**
    - a lógica repetida com o `useRowFeedback`: juntar as duas mexeria no arquivo do P05-C, e o caminho do item não casa com o aviso da lista. Fica para o P07-D;
    - **o anúncio no app:** sem o `announceForAccessibility`, o aviso depende do `role="alert"`, que o iOS e o Android não falam sozinhos. Vale para as linhas do P05-C também. Conferir no VoiceOver e no TalkBack na integração. Se não falar, o `DraftNoticeText` ganha o anúncio, num lugar só.

**Não rodado no pacote** (portas fixas e aparelho só na integração): o `advantages.spec.ts` (só typecheck) e a conferência da seção 7 no Android, no iOS e no web.
