# P03-D · Salvar × Concluir na barra: plano de implementação

> Plano · 2026-11-02 · base conferida: `onda/3-estado-narrador` em `617264d`

Este plano implementa o pacote [P03-D da matriz de achados](../testes/2026-11-01/matriz-achados.md#p03-d), pela decisão D-01:

- na barra de Criação, "Salvar" fica sempre, e "Concluir criação" ou "Enviar para aprovação" aparece ao lado quando a conta fecha;
- o "Sair sem salvar?" da ficha ganha "Salvar e sair";
- no Editar, o "Concluir" passa a "Salvar alterações".

Salvar o progresso deixa de exigir concluir, e cada botão tem um verbo só. É um pacote de decisão de produto, mas não muda regra do jogo, não remove campo e não afrouxa limite:

- a conta da criação continua avaliada no servidor a cada lote (`/events`);
- a conclusão continua no `/creation/complete`, com revisão e versão;
- o servidor continua a autoridade.

Nada muda na API HTTP, no `@tms/ui`, no store da ficha nem no outbox.

Todas as linhas citadas são do `617264d` (a ponta da onda 2, com a mesma árvore da `main` em `3a43ed8`). A matriz cita o `1db3db9`, de antes das ondas 1 e 2: a `ModeBar` foi reorganizada pelo P08 (o hook `useModeBar`) e mexida pelo P04-C e pelo P05-C, e a guarda de saída nasceu no P03-C. Onde a causa da matriz não vale mais, a seção 3 diz.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md), "Como executar", "Decisões de produto" (D-01) e §P03-D | Itens, decisão, "PR local" e critério de saída da onda |
| [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) l.193 (T-04) e §7 (l.338); [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §1 (C2), R-04 e R-05 (l.406-407) e l.471 (DS-04) | Achado, recomendações e a revisão da DS-04 |
| Notas: [qa-web](../testes/2026-11-01/notas/qa-web.md) (QAW-22), [qa-app](../testes/2026-11-01/notas/qa-app.md) (QAA-06), [experiente-web](../testes/2026-11-01/notas/experiente-web.md) (EW-06), [experiente-app](../testes/2026-11-01/notas/experiente-app.md) (EA-06), [iniciante-web](../testes/2026-11-01/notas/iniciante-web.md) (IW-02 e o diário da tarefa 5), [iniciante-app](../testes/2026-11-01/notas/iniciante-app.md) (IA-09 e o diário da tarefa 5), [po-web](../testes/2026-11-01/notas/po-web.md) (POW-07), [narrador-web](../testes/2026-11-01/notas/narrador-web.md) (NW-31) | Cenários do critério de pronto |
| [plano-v4.md](../plano-v4.md) §2 (l.61) e Etapa 5, passo 5 (l.459) | "Separar 'Salvar alterações' de 'Concluir criação'", que o código não seguiu |
| [avaliacao-ui-ux.md](../avaliacao-ui-ux.md) DS-04 (l.967-989) e [components.md](../../design/design-system/components.md) ModeBar (l.554-565) | A barra "Editando · Concluir", que a D-01 revê |
| [onda-1.md](onda-1.md) §6.1 e §9; [onda-2.md](onda-2.md) §4.1, §4.4, §6.10 e §10; [P03-C](P03-C-rascunho-salvamento.md) §2, §3.2, §3.8 e §10; [P04-C](P04-C-ciclo-vida-ficha.md) §2, §3.4 e §9 (pergunta 6); [P08](P08-layout-teclado.md) §3.10, §3.12, §3.13 e §10 | O que as ondas 1 e 2 deixaram pronto (rascunho persistido, guarda genérica, confirmação única, barra fixa, `onClosed`) e os pontos em aberto |

## 1. Objetivo e itens

**Objetivo (matriz).** Salvar o progresso sem concluir, em qualquer fase da criação, e um verbo por ação na barra.

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| T-04 (com a R-04) | alta | Com a conta fechada, "Salvar alterações" vira "Concluir criação" ou "Enviar para aprovação", e não há como guardar o progresso sem concluir. O "Sair sem salvar?" só oferece "Continuar editando" e "Descartar e sair" | `apps/frontend/sheet/evolve/ModeBar.tsx:206-234` (`actionBar`: o rótulo troca em `:215-221` e o toque conclui em `:226-231`); `:312-361` (`EvolveBar`, um `Button` só); `apps/frontend/components/UnsavedChangesGuard.tsx:44-71` (duas ações, e o `extraAction` de `:20-21` sem uso); `apps/frontend/sheet/evolve/LeaveGuard.tsx:9-22` |
| R-05 | média | No Editar, o botão se chama "Concluir", mas só salva e sai do modo. Lê-se como "concluir a criação" | `ModeBar.tsx:207-208` (`EvolveBar` com `onFinish={() => go(returnTo.current)}`), `:316` (`finish = 'Concluir'`), `:128-137` (`go`: com rascunho, abre o resumo; sem, sai direto) |

A parte da R-05 sobre "quem terminou a ficha livre não sabe como avisar o narrador" é da D-03 (P04-D), e não deste pacote (seção 2).

## 2. Decisões aplicadas

**D-01 (T-04, R-05).** "Salvar" sempre na barra, com "Concluir criação" ou "Enviar para aprovação" ao lado; "Salvar e sair" no aviso "Sair sem salvar?"; no modo Editar, o botão "Concluir" passa a "Salvar alterações". A decisão revê o "um botão só" e a DS-04.

**Como o código acomoda a decisão:**

- **A barra já tem os dois caminhos.** O `review(next, finish)` separa salvar de concluir (`ModeBar.tsx:140-154`):
  - com `finish` falso, salva e fica em Criação;
  - com `finish` verdadeiro, salva antes e conclui pelo `useFinishCreation` (`:156-196`; `CreationPanel.tsx:86-148`).

  O "um botão só" é só a escolha de rótulo e de toque em `:215-231`. Separar é dar a cada caminho o seu botão. Nada muda no store, no outbox, na confirmação (`SummarySheet`, `completionCopy`) nem na API.
- **De onde veio o "um botão só".** Do commit `733c915` (30/10/2026), não de um plano. O plano-v4 pede o contrário:
  - §2, l.61: "Separar esse salvamento da conclusão da criação no servidor";
  - Etapa 5, passo 5, l.459: "Separar 'Salvar alterações' de 'Concluir criação'".

  A D-01 traz o código de volta ao plano-v4. A DS-04 (`avaliacao-ui-ux.md:989`, "uma barra 'Editando · Concluir'") é revista: o Editar passa a "Editando · Salvar alterações". O `components.md` (ModeBar, l.559) é atualizado no commit de docs.
- **"Salvar e sair".** O P03-C deixou a guarda de saída genérica, com um espaço para a ação a mais (`UnsavedChangesGuard.tsx:20-21`, `extraAction`). Mas o espaço é um `ReactNode` sem acesso à navegação segurada (`repeat`), e por isso não serve para "salvar e então sair". O P03-D troca o `extraAction`, que não tem uso, por um `onSave` (seção 3.2).
- **As duas palavras da decisão cabem como estão escritas:**
  - na Criação, o botão diz "Salvar" e fica ao lado da ação seguinte;
  - no Editar, onde ele está sozinho, diz "Salvar alterações".

  A 360 dp, "Salvar" (~86 dp) e "Enviar para aprovação" (~200 dp) cabem numa linha. "Salvar alterações" (~170 dp) e "Enviar para aprovação" não cabem (seção 3.0). O nome acessível do botão é "Salvar alterações" nos dois modos. O texto visível "Salvar" está no começo do nome, o que atende ao WCAG 2.5.3 (rótulo no nome). Assim o botão da barra não colide com o "Salvar" do resumo nos seletores (`getByRole('button', { name: 'Salvar', exact: true })` do E2E e do RNTL).

**O que fica fora (de outros pacotes, sem decidir):**

- **D-03 (P04-D):**
  - o texto do próximo passo e o "Avisar que terminei" entram no lugar que a barra abre (seção 3.4);
  - a conclusão do narrador pela barra na criação livre (NA-23, [P04-C](P04-C-ciclo-vida-ficha.md) §2, item 3) não entra no P04-D nem aqui. Hoje ele só conclui pelo ⋯, e pôr a conclusão na barra é ação nova: ponto para o PO ([onda-3.md](onda-3.md) §6).
- **D-02 e D-04 (P04-D).** O selo de estado e o "Pedir ajuste" não passam por aqui.
- **"Reabrir criação" (D-04).** Fica fora do ciclo e é registrado em `proximas-features.md` pelo P01-D (onda 5). A confirmação de concluir continua dizendo que não tem volta (`completion.ts`).
- **D-05 (P05-D, onda 4).** O "Faltam: …" na barra de criação usa a mesma barra (seção 3.4). O P03-D não mostra o que falta.
- **T-33 (P09-C).** Abrir o modo Criação do narrador em leitura muda quem vê a barra, não os rótulos.
- **D-13 (P01-D, onda 5).** O P01-D alinha os planos que ainda falam do "resumo do Concluir": v0 l.737, v1 l.244 e v2 l.235.

**Pontos para o PO das ondas anteriores que tocam o pacote (continuam em aberto; o plano não os decide):**

- **[onda-1.md](onda-1.md) §6.1, gravação única × D-01.** A prioridade continua gravada na hora (`PATCH /characters/:id/creation`). "Salvar" e "Salvar e sair" gravam só o rascunho (os pontos), e o resumo não lista a prioridade, que já está salva. O plano não muda esse modelo. O endpoint atômico (escolhas e eventos sob a mesma trava) segue em aberto.
- **[onda-2.md](onda-2.md) §6.10, botões de "ficar" nas folhas.** O plano mantém "Continuar editando" como está (`ghost`, `UnsavedChangesGuard.tsx:51-55`) e só acrescenta "Salvar e sair". Alinhar com o "Continuar conectado" do aviso de "Sair" (`secondary`, `components/session/LogoutButton.tsx:101`) é uma linha em cada folha, depois da decisão.
- **[P04-C](P04-C-ciclo-vida-ficha.md) §9, pergunta 6, o menu do narrador com alterações não salvas.** O "Concluir criação" do menu continua desabilitado, com o aviso "Salve ou descarte antes de concluir" (`StatusMenu.tsx:321-333`, `completion.ts:73-76`). A D-01 não pede "Salvar e concluir" no menu. Na Criação, o caminho para salvar e concluir de uma vez é o "Concluir criação" da barra, que já salva antes ("As alterações abaixo são salvas antes.", `ModeBar.tsx:429-435`).

**O que o código mostra que não se aplica como está escrito** (apontado, sem decidir; seção 9):

1. **"Concluir" → "Salvar alterações" muda o que o botão faz sem alterações.** Hoje, no Editar sem alterações, "Concluir" sai do modo (`ModeBar.tsx:128-137`; teste `evolve.test.tsx:146-160`). Um "Salvar alterações" que sai do modo sem ter o que salvar engana. O plano desabilita o botão com 0 alterações, como a Criação já faz (`:224`), e quem quer sair usa o seletor de modo. No celular, o seletor rola com a ficha (T-27, P08).
2. **Depois de salvar no Editar, a ficha volta ao modo de antes** (`ModeBar.tsx:114-116`, `:176-178`), que é o Jogo da dona. Na criação livre, isso tira a barra da tela, e é na barra que o P04-D vai pôr o "Avisar que terminei" (D-03). O plano mantém a volta, porque a D-01 só troca o verbo. Ficar no Editar depois de salvar, como já acontece na Criação, é decisão do PO.
3. **"Salvar e sair" só na ficha.** A D-01 fala do "Sair sem salvar?" da criação. A mesma guarda está em outras duas telas, que ficam como hoje:
   - na Nova ficha (`new-character.tsx:166`), que não tem rascunho, porque salvar ali é criar a ficha;
   - nas regras da crônica (`CreationSettings.tsx:99`), cuja guarda é da R-31 (P09-D, onda 5).

## 3. Desenho por item

### 3.0 O que o código faz hoje e as larguras

**Barra.** O `useModeBar` (`ModeBar.tsx:75-260`) devolve três partes: o seletor, a barra de ação e o resumo. No celular, o `SheetView` deixa a barra de ação fixa acima da rolagem (`SheetView.tsx:340`), e o seletor rola com a ficha (T-27). A barra de ação é o `EvolveBar` (`:312-361`), com um texto e um botão:

| Modo | Texto | Botão hoje | Toque |
|---|---|---|---|
| Editar | "Editando · N alterações" | "Concluir" (`:316`) | `go(returnTo)`: com rascunho, "Salvar N alterações?" e a volta ao modo de antes; sem rascunho, sai direto |
| Criação, conta aberta | "Criação · N alterações · Bônus: …" | "Salvar alterações" (`:220`), desabilitado com 0 (`:224`) | `review('create')`: salva e fica em Criação |
| Criação, conta fechada | o mesmo | `finishing.label`: "Concluir criação", "Enviar para aprovação" ou, para o narrador, "Concluir e aprovar" (`creation.ts:223-230`) | `review('create', true)`: confirma, salva e conclui. **Não há como só salvar** (T-04) |

**Guarda de saída.** O `LeaveGuard` (`LeaveGuard.tsx:9-22`) monta o `UnsavedChangesGuard` com a contagem do rascunho. O `usePreventRemove` (`UnsavedChangesGuard.tsx:33-42`) segura:

- o "‹" da `AppBar`;
- o gesto de voltar do iOS;
- o voltar do Android;
- o `router.replace`;
- no web, o `beforeunload` (F5 e fechar a aba).

A folha (`:44-71`) tem "Continuar editando" (`ghost`) e "Descartar e sair" (`danger`). "Descartar e sair" chama o `repeat()` logo depois de fechar a folha (`:59-64`).

**Larguras estimadas dos botões** (`Button` com `fieldLabel` 16/22 e 20 de recuo de cada lado, `packages/ui/src/Button.tsx:66-71`; medidas nas capturas `img/iniciante-web/58-sair-com-pendencias-390.webp` e `img/qa-app/76-barra-concluir-ios.webp`):

| Rótulo | Largura |
|---|---|
| "Salvar" | ~86 dp |
| "Salvar alterações" | ~170 dp |
| "Concluir criação" | ~162 dp (medido no web 390) |
| "Concluir e aprovar" | ~177 dp |
| "Enviar para aprovação" | ~200 dp (medido no iOS) |
| "Salvar e sair" | ~140 dp |
| "Descartar e sair" | ~160 dp |
| "Continuar editando" (`ghost`) | ~170 dp |

**Largura útil da barra** (`tokens.layout.gutter` 16 de cada lado): 328 dp a 360; 343 a 375 (iPhone SE); 361 a 393; 379 a 411. Consequências:

- dois botões e o texto não cabem numa linha no `compact`: com "Salvar" e "Enviar para aprovação", sobram ~40 dp para o texto;
- os dois botões sozinhos cabem numa linha a partir de 360, com "Salvar";
- com fonte de 130% (`stacked`, `packages/ui/src/theme.tsx:161-168`), nem os dois botões cabem: a linha deles quebra.

Hoje a barra tem ~64 dp (8 + 48 + 8). Em duas linhas, terá ~108 dp (seção 8.3).

### 3.1 T-04 · "Salvar" sempre na barra de Criação, com a ação seguinte ao lado

**O que muda no `EvolveBar`** (interno ao `ModeBar.tsx`). A API passa de "um botão" para "salvar e a ação seguinte":

```ts
interface BarAction {
  readonly title: string
  readonly accessibilityLabel?: string
  readonly onPress: () => void
  readonly primary?: boolean
  readonly busy?: boolean
  readonly disabled?: boolean
  readonly testID?: string
}

function EvolveBar(props: {
  readonly label: string // "Editar" ou "Criação"
  readonly count: number
  readonly detail?: string | null // o saldo de bônus (P05-C)
  readonly save: BarAction // sempre
  readonly next?: BarAction | null // a ação seguinte (Concluir/Enviar; P04-D: "Avisar que terminei")
  readonly note?: ReactNode // a linha do próximo passo (P04-D, D-03)
}): ReactElement
```

Saem as props `finish`, `primary`, `busy`, `disabled`, `testID` e `onFinish`, com o padrão `finish = 'Concluir'` (`:316`).

**Na Criação** (`actionBar`, `:209-233`):

- **`save`:**
  - título "Salvar", com `accessibilityLabel` "Salvar alterações" e `testID` `mode-save`;
  - desabilitado com 0 alterações ou enquanto conclui (`finishing.busy`);
  - o toque é `review('create')`: "Salvar N alterações?" → "Salvar" grava um lote e fica em Criação. É o caminho de hoje.
- **`next`:** só com a conta fechada (`finishing.ready`):
  - título `finishing.waitingSync ? 'Sincronizando…' : finishing.label`;
  - `primary`, `busy` de `finishing.busy` e `testID` `creation-action`, que é mantido para o `creation-feedback.spec.ts:248-252`;
  - o toque é `review('create', true)`: a confirmação de hoje ("Concluir criação?" ou "Enviar para aprovação?", com o corpo do `completionCopy`, as `notes` do P05-C e "As alterações abaixo são salvas antes.").

  Antes de a conta fechar, não há ação seguinte: o rótulo "Concluir" não aparece enquanto concluir é recusado. A pergunta 1 traz a alternativa.
- **O narrador na Criação** vê a mesma barra: "Salvar" e "Concluir criação" ou "Concluir e aprovar", pelo `completeLabel`. O P09-C (T-33) decide se o narrador ainda chega à Criação editável.

**Arranjo:**

- **Em duas linhas** quando `breakpoint === 'compact'` com `next` ou `note`, ou quando `stacked` (`useLayout()`):
  - em cima, o texto (`aria-live="polite"`, como hoje) e, se houver, o `note`;
  - embaixo, os botões numa linha, com `flexWrap: 'wrap'`, `justifyContent: 'flex-end'` e `gap` 8.
- **Em uma linha nos outros casos:** o texto (`flex: 1`) e os botões à direita. É o arranjo de hoje.
- **Ordem dos botões** no DOM e na tela: "Salvar" e depois a ação seguinte. A principal fica à direita, como nos rodapés das folhas. O foco segue a ordem visual.
- A região continua com o rótulo "Modo Criação" (`:337`).

**O que não muda:**

- `useFinishCreation`, `completionCopy`, o `SummarySheet` (`:363-482`);
- o texto do Orçamento ("conclua pela barra de cima", `CreationPanel.tsx:238-239`), que continua certo;
- o store e o outbox.

**Cache persistido (`apps/frontend/lib/persist.tsx`).** O pacote não grava nada novo no cache. O rótulo da ação seguinte e o `ready` vêm do `state.character.creation` (o `info` de `SheetScreen.tsx:402-405`) e do `check` local. Quando a resposta do servidor chega, o `info` muda e a barra se redesenha:

- **com a aprovação mudada desde o cache:** o rótulo passa de "Concluir criação" a "Enviar para aprovação". Mesmo antes disso, quem decide é o servidor:
  - ele lê a aprovação vigente sob trava (`apps/api/src/sheets/creation.ts:630-641`);
  - recusa revisão e versão velhas com 409 (`:262-272`);
  - o toast usa o `status` da resposta (`CreationPanel.tsx:116-124`);
- **com a ficha já concluída** (o caso do `c7c1423`): `creationActive` fica falso, a ação seguinte some, e a transição do P04-C tira a ficha do modo de montagem.

### 3.2 T-04 · "Salvar e sair" no "Sair sem salvar?"

**Um ajudante só para salvar o rascunho.** Novo `apps/frontend/sheet/evolve/saveDraft.ts`:

```ts
export type SaveOutcome =
  | { readonly ok: true; readonly label: string; readonly batchId: string | null }
  | { readonly ok: false; readonly message: string }

export function saveDraftNow(model: SheetModel, store: SheetStore): SaveOutcome
```

- Calcula o rótulo como o resumo calcula: `describeBatch(model, withEffectiveFrom(model, s.values, s.draftEvents()))`.
- Chama `saveDraft(label)` (`sheetStore.ts:893-918`).
- Traduz a recusa com as mesmas frases de `ModeBar.tsx:165-174`: conflito; recusa da conta (`REFUSAL_TEXT`); o primeiro problema; ou "Não foi possível salvar.".
- O `save()` da `ModeBar` passa a usar o ajudante, sem mudar o comportamento (commit 1).

**`UnsavedChangesGuard`** (`apps/frontend/components/`, fora do `@tms/ui`):

- sai o `extraAction?: ReactNode` (sem uso, `:20-21`);
- entram `onSave?: () => { ok: true } | { ok: false; message: string }` e `saveLabel` ("Salvar e sair" por padrão).

**O que acontece com o `onSave`:**

1. "Salvar e sair" trava num `ref` (dois toques no mesmo quadro chamam uma vez só, como o T-02) e chama o `onSave()`.
2. **Gravou:** guarda o `repeat` (sem o `onDiscard`), fecha a folha e **sai no `onClosed` da `BottomSheet`**. O `onClosed` vem do `onDismiss` no iOS e no web, depois de o foco voltar; no Android, assim que a folha fica invisível (`BottomSheet.tsx:198-216`). É a lição do P08 (§10): no iOS, mexer na navegação enquanto um Modal ainda sai falha. "Descartar e sair" passa a sair pelo mesmo caminho, depois do `onDiscard` (pergunta 2).
3. **Não gravou** (conta recusada no aparelho, conflito aberto): a frase aparece na folha (`Text` `danger`, papel `alert`), a folha fica aberta, a trava solta e nada sai.

**`LeaveGuard`.** Recebe `model` e passa `onSave={() => saveDraftNow(model, store)}`. O `LiveSheet` passa `state.model` (`SheetScreen.tsx:555`).

**Depois de sair:**

- o toast "Salvo: {rótulo}." aparece **sem "Desfazer"**: o store da ficha sai com a tela. O "Desfazer" fica no Histórico. O `ToastProvider` está na raiz (`app/_layout.tsx:43`), e o toast sobrevive à navegação;
- **o que não se perde:**
  - o lote vai para o outbox persistido, com `clientBatchId`;
  - o registro do rascunho no aparelho só é apagado quando o lote está no outbox (`DraftRecovery.tsx:108-116`);
  - se o servidor recusar com a ficha fechada, o lote volta ao rascunho do aparelho e um toast avisa (`sync.ts:286-295`, `:309`). A próxima abertura oferece "Recuperar".

**Rodapé da folha.** Três ações, sem mudar a `BottomSheet`. O `UnsavedChangesGuard` passa um `View` próprio como `footer`:

- **A partir de 600** (diálogo central de 560, T-69): numa linha, "Descartar e sair" à esquerda, num invólucro `flex: 1` como o T-78 fez no resumo (`ModeBar.tsx:408-416`); à direita, "Continuar editando" e "Salvar e sair". Cabe em ~512 px úteis (160 + 170 + 140 + 24 = 494).
- **No `compact` ou `stacked`:** em coluna, com largura cheia, na mesma ordem do DOM: "Descartar e sair" em cima, "Continuar editando" no meio e "Salvar e sair" embaixo. A principal fica perto do polegar e longe da destrutiva (T-78).
- **Variantes:** "Descartar e sair" `danger` e "Continuar editando" `ghost`, como hoje (onda-2 §6.10 segue em aberto); "Salvar e sair" `primary`.
- **Sem `onSave`** (Nova ficha e regras da crônica): duas ações, como hoje.

**Sem regressão nas folhas** ([onda-2.md](onda-2.md) §4.7 e §10):

- o Esc na captura fecha a folha, que não tem campo em autoFocus (`f3f3b8a`), e equivale a "Continuar editando";
- o foco volta ao gatilho ("Voltar para {crônica}");
- o diálogo central de 560 a partir de 600 continua;
- o `onClosed` faz a saída;
- um "Fechar" só (T-71).

**No web,** F5 e fechar a aba continuam com o `beforeunload` do navegador, que não mostra a folha. O rascunho fica no IndexedDB (P03-C) e volta com "Recuperar".

### 3.3 R-05 · "Salvar alterações" no Editar

**No Editar** (`actionBar`, `:207-208`):

- **`save`:** título "Salvar alterações" e `testID` `mode-save`. Desabilitado com 0 alterações (seção 2, item 1). O toque é `go(returnTo.current)`, como hoje: "Salvar N alterações?" → "Salvar" grava e volta ao modo de antes, com o toast "Salvo: … · Desfazer".
- **`next`:** `null`. O P04-D o preenche na criação livre (seção 3.4).

O texto "Editando · N alterações" não muda (`:347`). A guarda de saída do Editar ganha o mesmo "Salvar e sair" (o `LeaveGuard` vale nos dois modos).

**O narrador** no Editar vê o mesmo botão. A `StorytellerBar` ("Editar como narrador" e "Voltar à leitura") não muda, e o T-33 é do P09-C.

**Depois deste pacote, "Concluir" na ficha só aparece** em "Concluir criação" e em "Concluir e aprovar": na barra de Criação, no menu do narrador e nas confirmações. É o "um verbo por ação" da R-05.

### 3.4 A barra como contrato para o P04-D, o P09-C e o P05-D

| Peça | Quem preenche | Como |
|---|---|---|
| `save` | P03-D | "Salvar" (Criação) ou "Salvar alterações" (Editar), `mode-save` |
| `next` na Criação | P03-D | `finishing.ready` → "Concluir criação", "Enviar para aprovação" ou "Concluir e aprovar", `creation-action` |
| `next` no Editar da criação livre | **P04-D** (D-03) | "Avisar que terminei" para a dona. O P04-D calcula num hook dele, chamado dentro do `useModeBar`. O "Concluir criação" do narrador na barra da criação livre (NA-23) não entra em nenhum plano da onda: é ação nova e ficou como ponto para o PO ([onda-3.md](onda-3.md) §6) |
| `note` | **P04-D** (D-03); depois o P05-D (D-05, "Faltam: …") | Uma linha sob o texto da barra. O arranjo em duas linhas já considera o `note` |
| Os modos do narrador (`OTHER_CREATE`, `:54`) | **P09-C** (T-33) | Muda o que o narrador vê, não os rótulos de `save` e `next` |

O P04-D e o P09-C não reescrevem o `EvolveBar` nem o `SummarySheet`: só passam `next` e `note` ou mudam os modos.

### 3.5 API: o que muda

- **API HTTP:** nada. As rotas são as mesmas (`POST /characters/:id/events`, `POST /characters/:id/creation/complete`), com os mesmos corpos.
- **`@tms/ui`:** nada. A `BottomSheet` é usada como está (`footer`, `onClosed`), e o `Button` também.
- **Componentes do app** (não são API pública):

| Componente | Mudança | Compatibilidade |
|---|---|---|
| `EvolveBar` (interno ao `ModeBar.tsx`) | `save`, `next?` e `note?` no lugar de `finish`, `primary`, `busy`, `disabled`, `testID` e `onFinish` | Só o `useModeBar` usa |
| `UnsavedChangesGuard` | `onSave?` e `saveLabel?` no lugar de `extraAction?` | `extraAction` não tem uso (`grep`). A Nova ficha e as regras da crônica não passam `onSave` |
| `LeaveGuard` | `model` obrigatório | Um uso (`SheetScreen.tsx:555`) e o teste |

## 4. Testes

### 4.1 Um teste de regressão por bug (falha antes, passa depois)

| Item | O que o teste prova | Arquivo | Tipo |
|---|---|---|---|
| T-04 | Antes de a conta fechar: `mode-save` com o texto "Salvar" e o nome "Salvar alterações", e nenhum `creation-action`. Com a conta fechada e 1 alteração: `mode-save` e `creation-action` ("Concluir criação") juntos. `mode-save` → "Salvar 1 alteração?" → "Salvar" chama `eventsPost`, **não** chama `completePost`, e o rádio "Criação" continua marcado. Com `approval: true`, "Enviar para aprovação" ao lado, e "Salvar" não chama `completePost`. O narrador com aprovação vê "Concluir e aprovar". **Falha no `617264d`:** com a conta fechada, o único botão conclui | `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` (`describe` novo "Salvar e Concluir lado a lado (D-01)") | Jest + RNTL |
| T-04 | `Dimensions` 360 e 393 com os dois botões: a barra em duas linhas (o texto acima; os botões numa linha com `flexWrap`). 1280: uma linha. `fontScale` 1.3: a linha dos botões quebra. Só "Salvar": uma linha, como hoje | `apps/frontend/sheet/evolve/__tests__/evolve.layout.test.tsx` (do P08; casos novos) | Jest + RNTL |
| T-04 | Com 2 alterações, "Sair sem salvar?" tem "Salvar e sair". O toque grava (um lote em `pending`, `draft` nulo) e chama o `repeat` só no `onDismiss` (iOS e web) ou quando a folha fica invisível (Android: `Platform.OS` trocado no teste). Dois toques: um lote e um `repeat`. Com a recusa da conta (store com `creation` e rascunho acima do teto), a frase aparece com papel `alert`, o `repeat` não é chamado e o rascunho fica. **Falha no `617264d`:** não existe "Salvar e sair" | `apps/frontend/sheet/evolve/__tests__/LeaveGuard.test.tsx` | Jest + RNTL |
| T-04 | Sem `onSave`, duas ações, como hoje. Com `onSave`, três, na ordem "Descartar e sair" · "Continuar editando" · "Salvar e sair". Em coluna no `compact`, em linha a 1280. "Descartar e sair" também sai no `onClosed`. A falha do `onSave` não chama o `onDiscard` | `apps/frontend/components/__tests__/UnsavedChangesGuard.test.tsx` (novo) | Jest + RNTL |
| T-04 | O rótulo efetivo ("Aparência 1 → 3"); as frases de conflito, da recusa da conta e do primeiro problema; rascunho vazio → `ok` sem lote | `apps/frontend/sheet/evolve/__tests__/saveDraft.test.ts` (novo) | Jest |
| T-04 | Web a 390 e 1280: "Salvar" ao lado de "Concluir criação"; salvar não conclui; "Salvar e sair" grava e sai (seção 4.3) | `e2e/tests/save-finish.spec.ts` (novo) | Playwright |
| R-05 | No Editar, `getByRole('button', { name: 'Salvar alterações' })` e nenhum "Concluir". Com 0 alterações, desabilitado. Com 1, abre "Salvar 1 alteração?" e, depois de salvar, volta ao Jogo. O caso de `:146-160` ("Concluir sem alterações sai direto") vira "sem alterações, desabilitado; o seletor sai". **Falha no `617264d`:** o botão se chama "Concluir" | `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx` | Jest + RNTL |
| R-05 | Crônica livre a 390: "Salvar alterações" desabilitado com 0, habilitado com 1; nenhum `{ name: 'Concluir', exact: true }` | `save-finish.spec.ts` | Playwright |

### 4.2 Testes existentes que mudam junto

**Jest** (o "Concluir" do Editar vira "Salvar alterações"):

| Arquivo | Linhas | O quê |
|---|---|---|
| `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx` | `:77`, `:114`, `:128`, `:149`, `:182`, `:211`, `:252`, `:280` | `{ name: 'Concluir' }` → `{ name: 'Salvar alterações' }`. O caso de `:146-160` muda de sentido (seção 4.1) |
| `apps/frontend/sheet/evolve/__tests__/mage.test.tsx` | `:55`, `:72`, `:105` | O mesmo |
| `apps/frontend/sheet/__tests__/LiveSheet.test.tsx` | `:429`, `:452`, `:560` | O mesmo. O `{ name: 'Salvar' }` seguinte não muda: no RNTL, o nome em texto é exato |
| `apps/frontend/sheet/__tests__/sheet.layout.test.tsx` | `:791` | O mesmo |
| `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | `:428-438` | O `describe` "aba Orçamento e botão único" passa a "aba Orçamento; Salvar sempre": `mode-save` com "Salvar" e nenhum `creation-action` antes de a conta fechar. `:440-473` (concluir depois de salvar) e `:476-512` (confirmação da barra) continuam pelo `creation-action` |
| `apps/frontend/sheet/evolve/__tests__/LeaveGuard.test.tsx` | `:52-110` | Os casos de hoje ficam; o render passa `model` |

**E2E (os 9 specs da consolidação):**

| Spec | Linha | Seletor hoje | Seletor novo |
|---|---|---|---|
| `conflict.spec.ts` | `:76` e `:110` | `getByRole('button', { name: 'Concluir' })` | `getByRole('button', { name: 'Salvar alterações', exact: true })` |
| `draft.spec.ts` | `:61` | o mesmo | o mesmo novo |
| `evolve.spec.ts` | `:50` | o mesmo | o mesmo novo |
| `journey.spec.ts` | `:130` | o mesmo | o mesmo novo |
| `journey-mage.spec.ts` | `:101` | o mesmo | o mesmo novo |
| `journey-werewolf.spec.ts` | `:91` | o mesmo | o mesmo novo |
| `journey-storyteller.spec.ts` | `:45` | `{ name: 'Concluir', exact: true }` | `{ name: 'Salvar alterações', exact: true }` |
| `layout.spec.ts` | `:149` | `st.getByRole('button', { name: 'Concluir criação' })` | **Sem mudança.** O narrador está em Leitura, sem barra de ação, e o "Concluir criação" é só o do menu. Conferir na integração. Se ficar ambíguo, restringir à folha: `st.getByTestId('bottom-sheet-root').getByRole(...)` |
| `lifecycle.spec.ts` | `:300` e `:310` | `{ name: 'Concluir criação', exact: true }` | **Sem mudança**, pelo mesmo motivo |

Os sete primeiros usam `{ name: 'Concluir' }` sem `exact`, que casa por substring. Com a barra de Criação aberta e a conta fechada, eles casariam "Concluir criação". O seletor novo usa `exact` e o nome acessível, que é o mesmo nos dois modos. O "Salvar" do resumo (`{ name: 'Salvar', exact: true }`) não muda em nenhum deles.

**Outros:**

- `creation-feedback.spec.ts` só passa a importar `ALMOST`, `PRIORITIES`, `prepared` e `pointsChronicle` de `e2e/support/creation.ts` (novo; hoje estão em `:26-120`). O `creation-action` de `:248-252` continua sendo a ação seguinte.
- **Para o P09-C:** o `table.spec.ts:80` usa `{ name: 'Salvar' }` sem `exact` na folha das Notas do Narrador. Hoje, depois de "Editar como narrador", a ficha fica em Jogo, sem barra. Se o T-33 fizer "Editar como narrador" abrir o Editar, esse seletor casa também com "Salvar alterações". O ajuste é do P09-C (seção 8.4).
- **Maestro:** o `09-draft-recovery.yaml` toca "Jogo" e "Descartar" no resumo e não muda.

### 4.3 E2E novo: `e2e/tests/save-finish.spec.ts` (Chromium e WebKit)

Contas por `signUp` e crônica por `apiAs` (só dados fictícios); ficha preparada pela API com `prepared(…, ALMOST)`, todos os pontos básicos menos 1 de Vigor. A 390 × 844 (`test.use`) e, num `describe` próprio, a 1280 × 800.

- **T-04, aprovação desligada:**
  1. `page.goto('/characters/<id>?mode=create')`, depois `plus(page, 'Vigor')` e "Entendi".
  2. Na barra: `getByRole('button', { name: 'Salvar alterações', exact: true })` com `toHaveText('Salvar')` e `getByTestId('creation-action')` com `toHaveText('Concluir criação')`.
  3. Um contador de `POST …/creation/complete` (`page.on('request')`) fica em 0 até o fim do caso.
  4. Toque em "Salvar": `getByText('Salvar 1 alteração?')` → `getByRole('button', { name: 'Salvar', exact: true })` → resposta do `POST …/events` com 200 → `getByRole('radio', { name: 'Criação', exact: true })` marcado.
- **T-04, layout:**
  - a 390, os dois botões dentro da viewport (`x + width ≤ 390`) e abaixo do texto da barra (`y ≥ y + height` do texto);
  - a 1280, os dois com o mesmo `y` (± 4 px).
- **T-04, aprovação ligada.** O narrador faz `PATCH /chronicles/:id/creation-settings` com `{ revision: 0, approval: true }` antes de abrir. Depois: `creation-action` com "Enviar para aprovação", e "Salvar" grava sem `POST …/creation/complete`.
- **T-04, "Salvar e sair":**
  1. Mais um "+" (fase de bônus) e `getByRole('button', { name: /^Voltar para / })`.
  2. `getByText('Sair sem salvar?')`.
  3. A 390, `getByRole('button', { name: 'Descartar e sair' })` fica acima de `getByRole('button', { name: 'Salvar e sair' })`. A 1280, os três estão numa linha, com "Descartar e sair" à esquerda.
  4. "Salvar e sair" → `toHaveURL(/\/chronicles\/<id>$/)` → `getByText(/^Salvo: /)`.
  5. Pela API (`GET /characters/<id>`), o valor está gravado e o `status` continua `creating`.
- **T-04, Esc.** Com uma alteração nova, "‹" → `page.keyboard.press('Escape')`: a folha fecha, a URL é a da ficha, e "1 alteração não salva" continua no cabeçalho.
- **R-05:**
  1. Crônica livre (`freeCreation`) e ficha pela API → `?mode=evolve`.
  2. `getByRole('button', { name: 'Salvar alterações', exact: true })` está `toBeDisabled()`, um atributo do DOM. O Jest não renderiza o DOM, e no web o react-native-web leva o `disabled` ao `<button>` (lição do `e8cfaf8`).
  3. Com um "+" em Força, o botão fica habilitado → "Salvar 1 alteração?" → "Salvar" → `getByRole('radio', { name: 'Jogo' })` marcado.
  4. `getByRole('button', { name: 'Concluir', exact: true })` tem contagem 0 do começo ao fim.

As abas da ficha a 390 são tocadas com o `tab()` do `creation-feedback.spec.ts`: a faixa fixa do T-27 cobre a primeira linha da seção. O spec roda só na integração (portas fixas, um por vez).

### 4.4 Suítes do "PR local" e cobertura

```bash
npx pnpm turbo run typecheck lint --filter=frontend --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=frontend
```

- **Metas que o CI aplica** (`.github/workflows/ci.yml:105`): `apps/frontend/jest.config.js:34-37`, com 70/70/60/70 no global e 80/80/70/80 em `./sheet/`. Lição da onda 1: tratar como meta **por arquivo**. Os arquivos novos ou alterados levam casos próprios:
  - `saveDraft.ts`;
  - os ramos do `EvolveBar` (`compact`, `stacked` e uma linha);
  - os três caminhos do `onClosed` no `UnsavedChangesGuard` (`Platform.OS` `ios`, `web` e `android` trocados no teste).
- **Sem mudança:** `@tms/ui`, `@tms/sheet-core`, `@tms/api` e `@tms/db`. Nada a rodar além do typecheck da monorepo.
- **Na integração da onda** (portas fixas, um por vez): o E2E inteiro em Chromium e WebKit, com o `save-finish.spec.ts` e os 7 specs ajustados.

## 5. Segurança

O pacote não muda API, AuthZ, armazenamento nem dependência. É interface sobre o mesmo caminho de gravação. O `/security-review` não é exigido para o P03-D ("Como executar", passo 4). O `/code-review` olha, em especial, a guarda de saída (gravar e sair).

| O que pode dar errado | Como o desenho evita |
|---|---|
| "Salvar" em qualquer fase passa por cima da conta da criação | "Salvar" manda o mesmo lote de hoje pelo mesmo caminho. No aparelho, a avaliação parcial recusa antes de enfileirar (`sheetStore.ts:535-551`). No servidor, o `POST /characters/:id/events` repete o `checkCreationBatch` com a ficha travada, para dono e narrador, em `creating` e `pending` (`apps/api/src/sheets/events.ts:299-318`). Salvar não conclui: a conclusão continua só no `/creation/complete`, que confere a conta, a revisão e a versão (`creation.ts:262-272`, `:625-628`) |
| "Salvar e sair" perde o que foi feito | O registro do rascunho só sai do aparelho quando o lote entra no outbox persistido (`DraftRecovery.tsx:108-116`). A recusa do servidor com a ficha fechada devolve o lote ao rascunho e avisa (`sync.ts:286-295`, `:309`). Sem rede, o lote espera no outbox |
| "Salvar e sair" duplica o lote | Cada "Salvar" é um lote com `clientBatchId` novo, e o servidor não aplica o mesmo lote duas vezes (`events.ts:197-210`). Os dois toques no mesmo quadro passam por uma trava (`ref`) e chamam `saveDraft` uma vez. Depois do primeiro, o rascunho está vazio |
| A saída acontece com a gravação recusada | Fail secure: sem `ok`, a folha fica aberta com a frase, e o `repeat` não é chamado |
| O rascunho cifrado do P03-C deixa de valer | Nenhum armazenamento novo, nenhuma chave nova. O rascunho continua no SQLCipher (app) ou no IndexedDB (web), no escopo do usuário, e é apagado no logout (P03-C §3.2) |
| O toast ou a folha mostram conteúdo da ficha | O rótulo vem do `describeBatch`, que mostra texto livre só como "atualizado" (`packages/sheet-core/src/labels.ts`). Nenhum log novo |
| O rótulo velho do cache leva a uma ação diferente da que o servidor fará | O servidor lê a aprovação vigente sob trava e recusa revisão ou versão velhas com 409. O toast usa o `status` da resposta (seção 3.1) |
| O narrador ganha escrita nova | A barra só mostra o que o papel já escreve. A `writePolicy` e a assinatura do lote no servidor não mudam |

Checklist da organização:

- **Validação no servidor:** a conta, a política e o conflito continuam no servidor. O cliente só desabilita e confirma.
- **Logs sem PII:** nenhum log novo.
- **Fail secure:** recusa → fica; sem conta fechada → sem ação seguinte; sem `creation` → sem rótulo inventado.
- **Erros sem stack trace:** as frases são as de hoje, curtas.

## 6. Como generaliza além do WoD

- **Genérica.** A barra é do esqueleto da ficha. O rótulo da ação seguinte vem do `completeLabel`, que depende do papel e da aprovação, não do sistema. O "pronto" vem do `check` do core.
  - No D&D 5e com point-buy: "Salvar" e "Concluir criação".
  - No Call of Cthulhu sem `creation`: "Salvar alterações" no Editar.
  - Num sistema com etapas (PbtA, com movimentos escolhidos depois): o mesmo "Salvar", em qualquer fase.
- **A guarda de saída** vale para qualquer rascunho de qualquer template. O texto conta alterações, não traços.
- **Nada de template ou de skin:** o pacote não lê nome de campo nem de sistema.

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado.** Arquivos e linhas conferidos no `617264d`. A D-01 está aplicada; a seção 2 diz o que fica para o PO e para os outros pacotes.
2. **Typecheck, lint e testes** do `frontend` e do `@tms/e2e` (seção 4.4), com as metas de cobertura.
3. **Um teste de regressão por bug** (seção 4.1), falhando no `617264d`.
4. **`/code-review`** no diff do pacote. O `/security-review` não é exigido (seção 5).
5. **Os cenários das personas, repetidos sem o defeito.** Usam a API local e o seed do roteiro (`npx pnpm seed:roteiro`; contas `roteiro_*`, só dados fictícios):

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | T-04 | I-W, IW-02 (`iniciante-web.md`), web 390: completar os básicos → mexer em algo → salvar; depois sair pelo "‹" | "Salvar" ao lado de "Concluir criação". "Salvar 1 alteração?" grava e a ficha fica em Criação. "Sair sem salvar?" com "Salvar e sair" |
   | T-04 | I-A, IA-09 (`iniciante-app.md`), iOS: entrar na fase de bônus com alterações pendentes | "Salvar" continua na faixa; salvar não conclui |
   | T-04 | E-W, EW-06 (`experiente-web.md`), web 1280: distribuir os básicos e procurar como salvar sem concluir | "Salvar" visível, sem trocar para Jogo |
   | T-04 | E-A, EA-06 (`experiente-app.md`), Android 393: fechar os grupos básicos | "Salvar" e "Concluir criação" juntos, em duas linhas no celular |
   | T-04 | QA-W, QAW-22 (`qa-web.md`), web 390 | "Concluir criação" separado; "Salvar" continua |
   | T-04 | QA-A, QAA-06 (`qa-app.md`), iOS e Android, com aprovação ligada | "Salvar" e "Enviar para aprovação"; salvar não envia |
   | R-05 | PO-W, POW-07 (`po-web.md`), web 390: ficha livre › Editar › mudar | "Salvar alterações" → "Salvar 1 alteração?"; nenhum "Concluir" no Editar |
   | R-05 | N-W, NW-31 (`narrador-web.md`), 1280: o narrador edita uma ficha (Editar, "+" na FdV atual) | "Editando · 1 alteração" com "Salvar alterações"; o cabeçalho com "1 alteração não salva" (T-17) |
   | R-05 | I-W e I-A, diário da tarefa 5: ficha concluída → Editar | "Salvar alterações", sem "Concluir" |

6. **Conferência no aparelho** pelo roteiro da seção 11: web a 390 e 1280 (Chromium, e WebKit no layout), Android a 360, 393 e 411 dp, e iOS no SE e no iPhone 17. A barra em duas linhas e o rodapé em coluna só se provam no nativo. A lição S-01 da onda 1 vale para o `View` do rodapé.
7. **Resumo para a seção do P03-D no PR da onda:**
   - o que mudou;
   - como foi testado;
   - os achados do `/code-review`;
   - o contrato da barra para o P04-D (seção 3.4);
   - os pontos para o PO (seção 9).

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

| # | Commit | Itens | Esforço |
|---|---|---|---|
| 1 | `refactor(app): salvar o rascunho num ajudante só (barra e guarda de saída)` (`saveDraft.ts`; o `save()` da `ModeBar` passa a usá-lo, sem mudar comportamento) | T-04 | P |
| 2 | `feat(app): "Salvar" sempre na barra de Criação, com "Concluir criação" ou "Enviar para aprovação" ao lado (D-01)` (`EvolveBar` com `save`, `next` e `note`; duas linhas no celular; `mode-save`; testes de `CreationScreen` e de layout) | T-04 | M |
| 3 | `feat(app): "Salvar alterações" no Editar (D-01)` (rótulo, desabilitado com 0; `evolve`, `mage`, `LiveSheet` e `sheet.layout` nos testes) | R-05 | P |
| 4 | `feat(app): "Salvar e sair" no "Sair sem salvar?" da ficha (D-01)` (`UnsavedChangesGuard` com `onSave`, rodapé, saída no `onClosed`; `LeaveGuard` com `model`) | T-04 | M |
| 5 | `test(e2e): Salvar × Concluir e "Salvar e sair" a 390 e 1280; seletores do "Salvar alterações"` (`save-finish.spec.ts`, `e2e/support/creation.ts`, os 7 specs da seção 4.2) | T-04, R-05 | P |
| 6 | `docs: barra de modos com Salvar e Concluir separados (D-01)` (`components.md`: ModeBar, variantes, revisão da DS-04) | — | P |
| 7 (opcional) | `chore(seed): fichas quase prontas para o roteiro manual` (`--fichas-criacao`, seção 11.a) | — | P |

**Por que esta ordem:**

- **O ajudante (1) vem antes** da barra e da guarda, que o usam.
- **A barra de Criação (2) vem antes do Editar (3).** O 2 cria a API nova do `EvolveBar`, e o 3 só a usa.
- **A guarda (4) fica por último no código.** Ela é a única que mexe em `components/`, e o commit sai sozinho se a pergunta 2 (iOS) pedir outro desenho.
- **O E2E (5)** é escrito aqui e roda na integração, como nas ondas 1 e 2.
- **O seed (7)** sai sozinho e só serve ao roteiro manual.

### 8.2 Esforço

**M**, de 4 a 5 dias, em 6 commits mais 1 opcional. A matriz soma 2 P. A diferença vem do que o código mostrou:

- a barra em duas linhas no celular, conferida em três larguras de Android, dois iPhones e duas larguras de web;
- a guarda de saída, que precisa gravar e sair sem perder nem duplicar, com a saída depois do `onClosed` nas três plataformas;
- 16 trechos de Jest e 8 linhas de E2E que tocam o "Concluir" do Editar;
- o roteiro manual da seção 11 (cerca de 1 dia, fora o build do iOS).

Se a onda precisar cortar, o commit 4 ("Salvar e sair") sai sozinho: a barra (2 e 3) já resolve o "não dá para salvar sem concluir". Sem ele, o pacote fica perto de P.

### 8.3 Riscos

- **A barra fica mais alta no celular.** Com a conta fechada, ela passa de ~64 para ~108 dp. Com o `note` do P04-D, chega a ~128 dp. A conta da área fixa do P08 (§3.12) previa ~64 dp. A conferência a 360 dp mede quanto da ficha sobra (pergunta 3).
- **Sair no `onClosed`.** Se o `onDismiss` não vier no iOS numa troca de tela, a saída não acontece. O Jest cobre o mecanismo; só o simulador prova (pergunta 2). Se falhar, a volta é sair direto, como o "Descartar e sair" faz hoje.
- **O Editar sem alterações deixa de ter saída na barra.** No celular, o seletor de modo rola com a ficha (T-27): quem entrou em Editar sem querer rola até o topo para sair. É o comportamento de hoje na Criação (seção 2, item 1).
- **O valor digitado no "Digitar" com o teclado aberto.** No nativo, tocar na barra fixa não tira o foco do campo. O valor só entra no rascunho no `onBlur` (`NumberEditorRow.tsx:215-218`), e o resumo pode sair sem ele. O defeito já existe hoje com o "Salvar alterações" da Criação; é da mesma família do `e0a4078`. Fica na seção 11 e na pergunta 7.
- **Seletores.** Os 8 trechos de E2E e os 16 de Jest mudam no mesmo pacote (commits 3 e 5). Os pacotes seguintes da onda escrevem já com "Salvar alterações".

### 8.4 Conflitos com os pacotes da onda

Ordem de merge proposta: **P03-D → P04-D → P11 → P09-C**, como no contrato da consolidação. O código confirma o P03-D em primeiro:

- ele define a API do `EvolveBar` (`save`, `next` e `note`), onde o P04-D põe o próximo passo;
- ele troca os seletores do "Concluir", que os specs novos dos outros pacotes já encontram prontos.

| Arquivo | P03-D | Outro pacote | Risco e como integrar |
|---|---|---|---|
| `apps/frontend/sheet/evolve/ModeBar.tsx` | `actionBar` (`:206-234`), `EvolveBar` (`:312-361`) e `save()` pelo ajudante (`:156-196`) | **P04-D:** `next` no Editar da criação livre e `note` (D-03). **P09-C:** T-33, nos modos do narrador (`OTHER_CREATE`, `:51-54`) e no que ele vê | **Alto** se em paralelo, no mesmo trecho. O P03-D entra primeiro, e os outros só passam `next`, `note` ou modos. Nenhum reescreve o `EvolveBar` nem o `SummarySheet` |
| `apps/frontend/sheet/SheetScreen.tsx` | `:555` (`model` no `LeaveGuard`) | **P04-D:** `narratorOf` e o efeito de transição (o selo vai no `IdentityBlock`, não no `subtitle` da `AppBar`: P04-D §3.5). **P11:** caso `viewer` (T-15), visibilidade (T-46), "‹" (T-81). **P09-C:** T-33 | Baixo: uma linha, longe dos outros trechos |
| `apps/frontend/components/UnsavedChangesGuard.tsx` | `onSave`, rodapé, saída no `onClosed` | Nenhum na onda (o P09-D usa as regras da crônica na onda 5) | — |
| `apps/frontend/sheet/evolve/LeaveGuard.tsx` | `model` e `onSave` | Nenhum | — |
| `apps/frontend/sheet/storyteller/StatusMenu.tsx`, `creation/CreationPanel.tsx`, `creation/completion.ts` | **Não toca** | P04-D ("Pedir ajuste", estados). P09-C | — |
| Testes do Jest da seção 4.2 | Seletores do "Concluir" | P04-D e P09-C podem acrescentar casos nos mesmos arquivos | Baixo: os outros escrevem já com `mode-save` e "Salvar alterações" |
| `e2e/tests/*` (7 specs) e `e2e/support/creation.ts` (novo) | Seletores e ajudantes da criação | **P09-C:** `table.spec.ts:80` (`{ name: 'Salvar' }` sem `exact`; vira ambíguo se o T-33 abrir o Editar). **P04-D:** `lifecycle.spec.ts` (estados) | O P09-C põe `exact: true` em `:80` no pacote dele. Os ajudantes de `creation.ts` servem ao P04-D (ficha quase pronta) |
| `scripts/seed-roteiro.ts` | `--fichas-criacao` (opcional) | Os outros pacotes podem pedir dados para os roteiros deles | **Combinado na consolidação ([onda-3.md](onda-3.md) §4.9):** a extensão é uma só, neste commit 7, com o que os roteiros do P04-D e do P09-C também pedem |
| `design/design-system/components.md` | ModeBar (`:554-565`) | P04-D e P11: o selo | Trechos diferentes |

**Conferência dos contratos provisórios:**

- **Ordem (1) e barra (2):** valem como estão.
- **Selo (3), linha "Sua ficha" (4), auditoria (5), migration (6) e data (7):** o P03-D não usa.
- **Folhas (8):** valem para o "Sair sem salvar?" (seção 3.2). A saída no `onClosed` estende ao "sair da tela" o que o P08 fez para "abrir a folha seguinte".
- **Toast (9):** o P03-D não muda o `Toast.tsx`. O "Salvo: … · Desfazer" da barra herda a janela nova se o T-76 do P09-C mudar o padrão, e não só a das operações em grupo. **Combinar com o P09-C.**
- **Cache (10):** seção 3.1.
- **E2E (11):** o `layout.spec.ts:149` e o `lifecycle.spec.ts:300-310` não mudam (seção 4.2).

**Para o P04-D:** a barra em duas linhas já reserva o `note`. A altura no celular (seção 8.3) é o limite para a frase do próximo passo: uma linha a 360 dp, com ~328 dp úteis.

### 8.5 Arquivos tocados

| Arquivo | Itens | Tipo de mudança |
|---|---|---|
| `apps/frontend/sheet/evolve/saveDraft.ts` | T-04 | novo (`saveDraftNow`) |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | T-04, R-05 | alterado (`EvolveBar` com `save`, `next` e `note`; Criação e Editar; `save()` pelo ajudante; comentário de `:35-39`) |
| `apps/frontend/components/UnsavedChangesGuard.tsx` | T-04 | alterado (`onSave`, `saveLabel`, rodapé, saída no `onClosed`; sai o `extraAction`) |
| `apps/frontend/sheet/evolve/LeaveGuard.tsx` | T-04 | alterado (`model`, `onSave`) |
| `apps/frontend/sheet/SheetScreen.tsx` | T-04 | alterado (`model` no `LeaveGuard`, `:555`) |
| `apps/frontend/sheet/evolve/__tests__/saveDraft.test.ts` | T-04 | teste novo |
| `apps/frontend/components/__tests__/UnsavedChangesGuard.test.tsx` | T-04 | teste novo |
| `apps/frontend/sheet/evolve/__tests__/LeaveGuard.test.tsx` | T-04 | teste alterado |
| `apps/frontend/sheet/evolve/__tests__/evolve.layout.test.tsx` | T-04 | teste alterado (casos novos) |
| `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | T-04 | teste alterado |
| `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx`, `mage.test.tsx` | R-05 | teste alterado |
| `apps/frontend/sheet/__tests__/LiveSheet.test.tsx`, `sheet.layout.test.tsx` | R-05 | teste alterado |
| `e2e/tests/save-finish.spec.ts` | T-04, R-05 | E2E novo |
| `e2e/support/creation.ts` | T-04 | novo (ajudantes movidos do `creation-feedback.spec.ts`) |
| `e2e/tests/creation-feedback.spec.ts` | — | E2E alterado (só importações) |
| `e2e/tests/conflict.spec.ts`, `draft.spec.ts`, `evolve.spec.ts`, `journey.spec.ts`, `journey-mage.spec.ts`, `journey-werewolf.spec.ts`, `journey-storyteller.spec.ts` | R-05 | E2E alterado (seletor) |
| `design/design-system/components.md` | T-04, R-05 | doc (ModeBar: variantes "Editando · Salvar alterações" e "Criação · Salvar + Concluir/Enviar"; revisão da DS-04 pela D-01) |
| `scripts/seed-roteiro.ts` | — | alterado, opcional (`--fichas-criacao`) |

## 9. Perguntas abertas (técnicas)

⚙ = resposta só no simulador ou no aparelho.

1. **"Concluir criação" antes de a conta fechar.** O plano esconde o botão até o `ready`. A alternativa é deixá-lo visível com `aria-disabled` e tocável, explicando o que falta, no padrão do "+" do P05-C (`markSoftDisabled`, `e8cfaf8`). Essa explicação encosta no "Faltam: …" da D-05 (P05-D, onda 4). Esconder agora e deixar o P05-D decidir?
2. ⚙ **Sair no `onClosed`** ("Salvar e sair" e "Descartar e sair"). No iOS, com o "‹" e com o gesto de voltar, a navegação depois do `onDismiss` sai sem deixar folha presa? Se o `onDismiss` não vier, a volta é sair direto, como hoje.
3. ⚙ **Altura da barra em duas linhas** (~108 dp; ~128 com o `note` do P04-D). Aceitar ou encurtar o texto no `compact` quando há dois botões (só "N alterações"; o saldo de bônus já está no Orçamento e na faixa do P08)? Medir a 360 dp no AVD.
4. ⚙ **Nome acessível "Salvar alterações" no "Salvar" visível.** Atende ao WCAG 2.5.3. Conferir a leitura no VoiceOver e no TalkBack.
5. **Toast depois de "Salvar e sair" sem "Desfazer".** O store sai com a tela. O "Desfazer" fica no Histórico. Basta?
6. **Dados do roteiro manual.** Estender o seed (`--fichas-criacao`, commit 7), preparar pela API num script do roteiro, ou montar pela tela (~60 toques por plataforma)? Combinado na consolidação: a extensão é uma só, no commit 7, para os quatro pacotes ([onda-3.md](onda-3.md) §4.9).
7. ⚙ **"Digitar" aberto com o teclado e toque na barra.** No nativo, o valor digitado entra no resumo? Se não entrar, o `review` tira o foco do campo antes de montar o resumo e lê o valor no evento, como o `e0a4078`.
8. **Ordem do rodapé em coluna:** "Descartar e sair" em cima e "Salvar e sair" embaixo, na mesma ordem do DOM da linha do desktop. A alternativa (a principal em cima) muda a ordem do DOM entre larguras.

**Pontos para o PO** (não decididos aqui):

- **Editar com 0 alterações.** O botão fica desabilitado, e "Concluir sem alterações sai direto" deixa de existir (seção 2, item 1).
- **Ficar no Editar depois de salvar, como na Criação.** Liga-se ao "Avisar que terminei" do P04-D na mesma barra (seção 2, item 2).
- **"Salvar e sair" fora da ficha** (Nova ficha, regras da crônica) (seção 2, item 3).
- **Os pontos que seguem abertos:** [onda-1.md](onda-1.md) §6.1 (gravação única × D-01) e [onda-2.md](onda-2.md) §6.10 (botões de "ficar").

**Causas da matriz que o código mostra diferentes:**

- **T-04:**
  - a matriz cita `ModeBar.tsx` l.176–200 do `1db3db9`. Hoje a escolha está em `:206-234` (`actionBar`) e o botão em `:312-361` (`EvolveBar`);
  - "é por projeto ('Um botão só')" vale só para o código, do commit `733c915`. O plano-v4 (l.61, l.459) pede a separação;
  - a guarda de saída já tem o espaço para a ação a mais (P03-C), mas ele não serve para salvar e sair (seção 2).
- **R-05:**
  - a l.268 citada é hoje a `:316`;
  - sem alterações, o "Concluir" não salva nada: só sai do modo (`:128-137`);
  - o "como avisar o narrador" da descrição é da D-03 (P04-D).

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

## 11. Testes manuais (web, Android com AVD, iOS com idb)

O roteiro confere cada item na interface, nas três plataformas, com a API local e o seed do roteiro (só contas fictícias `@roteiro.test`). Ele detalha o passo 6 da seção 7. Roda na integração da onda, depois do merge do P03-D, num banco local de desenvolvimento (nunca de produção).

### 11.a Preparação

**O que o seed já cobre** (`scripts/seed-roteiro.ts`, `npx pnpm seed:roteiro`):

- **contas** N (`roteiro_narrador`), J1 (`roteiro_jogador1`), J2 (`roteiro_jogador2`) e N2 (`roteiro_narrador2`), com e-mails `@roteiro.test`. A senha é a constante do seed: o script do roteiro a recebe por variável de ambiente na sessão do terminal, e ela não vai para arquivo, captura nem plano;
- **crônicas** "Vampiro v3/v5 · {hora}" (criação livre), "Vampiro v4 · {hora}" (por pontos, aprovação desligada, que é o padrão), as mesmas de Mago e Lobisomem, e "Vampiro limite 20 · {hora}". J1 e J2 entram em todas;
- **fichas:** nenhuma de J1. Só os 21 figurantes da crônica "limite 20".

**O que o roteiro cria** (pela tela ou pelo commit 7):

- três fichas de J1 em "Vampiro v4", uma por plataforma ("Isadora Web", "Isadora Android" e "Isadora iOS", Tremere). Cada uma tem as prioridades e todos os pontos básicos menos 1 de Vigor (o `ALMOST` do E2E). Pela tela são ~60 toques por ficha;
- três fichas de J1 em "Vampiro v3/v5" ("Otto Web", "Otto Android" e "Otto iOS"), só com nome e clã;
- **aprovação ligada** em "Vampiro v4", pela tela (N, web 1280: crônica → "Criação de fichas" → "Aprovação do narrador" → "Ligada" → salvar), só nos passos de "Enviar para aprovação". A aprovação vigente é lida na conclusão e no `GET` da ficha (`routes.ts:557`). Volta a "Desligada" na limpeza.

**Recomendação: o commit 7 (`--fichas-criacao`).** É a extensão única da onda ([onda-3.md](onda-3.md) §4.9). Ele cria pela API as seis fichas acima e o que os roteiros do P04-D e do P09-C pedem, com as sessões que o seed já abre:

- só dados fictícios;
- sem convite nem crônica nova, para não chegar ao limite de aceites (`seed-roteiro.ts:292-300`).

Nenhuma ficha é concluída no roteiro, salvo onde a tabela diz: as fichas servem às três plataformas sem novo seed.

**Serviços:**

- banco de desenvolvimento (`npx pnpm db:up`, `db:migrate` e `templates:publish --published`);
- API local na 3001 (`npx pnpm dev:api`);
- Metro na 8081 (`npx pnpm dev:web` para o web; `npx expo start` em `apps/frontend` para o nativo).

Evidências em `<scratchpad>/manual/p03d/`, com o nome `p03d-<ID>-<plataforma>-<largura>-<nn>-<passo>.png`.

### 11.b Web

- **Ferramenta:** um script Playwright (Chromium, de `node_modules/playwright` do repositório) no scratchpad, contra o Metro na 8081. A janela do Chrome do Claude não muda de tamanho (memória `device-testing-setup`), por isso o Playwright.
- **Viewports exatos:** 390 × 844 e 1280 × 800.
- **WebKit** no layout da barra a 390 (o Safari do iPhone) e no rodapé do "Sair sem salvar?".
- **Seletores** por papel e rótulo, os mesmos da seção 4.3: `getByRole('button', { name: 'Salvar alterações', exact: true })`, `getByTestId('creation-action')`, `getByRole('button', { name: 'Salvar e sair' })` e `getByRole('button', { name: /^Voltar para / })`.
- **Captura:** um screenshot por passo (`page.screenshot`).
- **Árvore:** a de acessibilidade é o DOM. O script grava o `outerHTML` da barra e da folha num `.txt` ao lado da captura (seção 11.f).

### 11.c Android (AVD)

- **AVD:** `Pixel_3a_API_34_extension_level_7_arm64-v8a`, com boot rápido e `-gpu host` (o boot a frio travou a System UI na onda 2). A 393 dp (440 dpi).
- **Layout da barra e do rodapé também a 360 e a 411 dp:** `adb shell wm density 480` (360) e `420` (411), com `adb shell wm density reset` no fim.
- **App:** APK de debug do `expo prebuild` com `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a`, e `JAVA_HOME` no JBR do Android Studio.
- **Portas:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Navegação:**
  - `adb shell input tap X Y`, `input text`, `input keyevent`;
  - `adb shell uiautomator dump /sdcard/ui.xml` e `adb pull`, para achar o alvo pelo `content-desc` e tocar no centro do `bounds`;
  - `adb exec-out screencap -p > arquivo.png`.

  A faixa do LogBox de desenvolvimento engole toques: dispensar antes.
- **Teclado de software:** `adb shell settings put secure show_ime_with_hard_keyboard 1`, com volta a `0` no fim.
- **Voltar do Android:** `adb shell input keyevent KEYCODE_BACK`. Com a folha aberta, fecha a folha ("Continuar editando"). Com o rascunho e sem folha, abre o "Sair sem salvar?".

### 11.d iOS (simulador, com idb)

- **Simuladores:** iPhone SE 3ª geração (iOS 18.x, 375 pt) e iPhone 17 (iOS 26.5).
- **Build:** Debug para o simulador, com `xcodebuild -workspace apps/frontend/ios/<app>.xcworkspace -scheme <app> -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone SE (3rd generation)' CODE_SIGNING_ALLOWED=NO`, depois do `expo prebuild` e do `pod install`. Leva ~37 min a frio e ~10 min incremental. O app é `com.tms.app`. O JS vem do Metro na 8081, e a API na 3001 é a do host.
- **idb:**
  - O `idb_companion` já está em `/opt/homebrew/bin`.
  - O cliente (`fb-idb`) vai num venv **fora do repositório**, o mesmo dos quatro pacotes (`~/.venvs/idb-tms`, [onda-3.md](onda-3.md) §10.a), com a versão fixada em `pip install fb-idb==1.1.7` (conferida antes com `pip index versions fb-idb`) e anotada na evidência.
  - Antes do primeiro uso, `pip-audit` (também com versão fixada) contra esse venv. Com vulnerabilidade conhecida sem correção, o iOS fica "não conferido".
  - O cliente não entra no `package.json` nem no lockfile.
  - O companion fica só local: o cliente o sobe para o simulador local (`--companion-path /opt/homebrew/bin/idb_companion`). Se for iniciado à mão, usar socket de domínio ou porta só em `localhost`. Conferir com `lsof -iTCP -sTCP:LISTEN` que nada escuta fora do loopback.
  - O Python da máquina pode não rodar o cliente: é risco da consolidação, que confere as versões.
- **Navegação:**
  - `idb ui describe-all --udid <UDID>` para achar o alvo pelo rótulo de acessibilidade (`AXLabel`), e `idb ui tap X Y` no centro do `frame`;
  - `idb ui text "…"`, `idb ui swipe X1 Y1 X2 Y2` (o gesto de voltar sai da borda esquerda: `idb ui swipe 2 400 300 400`) e `idb ui key <código>`;
  - `idb screenshot arquivo.png`.
- **Deep link** (`idb open "tms:///characters/<id>?mode=create"`): o iOS pergunta "Abrir com 'TMS'?". Achar "Abrir" no `describe-all` e tocar.
- **Teclado de software:** desligar "Connect Hardware Keyboard" no Simulator antes do boot, com volta ao padrão na limpeza.

### 11.e Roteiro por item

Conta J1 em todos os passos, salvo onde diz N. A coluna "Resultado" é preenchida na integração.

**T-04 · "Salvar" ao lado de "Concluir criação" / "Enviar para aprovação"**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-04 | Web 390 (Chromium e WebKit) | J1 | "Vampiro v4" → "Isadora Web" (abre em Criação) → "+" em Vigor → "Entendi" | Barra em duas linhas: "Criação · 1 alteração · Bônus: 15 de 15" em cima; "Salvar" e "Concluir criação" embaixo, os dois inteiros na tela | `p03d-T04-web390-01-barra-pronta.png` | |
| T-04 | Web 390 | J1 | "Salvar" → "Salvar 1 alteração?" → "Salvar" | Toast "Salvo: …" com "Desfazer"; o rádio "Criação" continua marcado; "Concluir criação" continua ao lado; nenhum `POST …/creation/complete` no log do script | `p03d-T04-web390-02-salvo.png` | |
| T-04 | Web 390 | J1 | "Concluir criação" → confirmação → "Voltar" | "Concluir criação?" com o corpo do P04-C e a sobra de bônus; "Voltar" não conclui | `p03d-T04-web390-03-confirmacao.png` | |
| T-04 | Web 1280 | J1 | A mesma ficha, com "+" em Força (bônus) | Barra numa linha: texto à esquerda, "Salvar" e "Concluir criação" à direita, com o mesmo `y` | `p03d-T04-web1280-01-barra.png` | |
| T-04 | Web 1280 | N, depois J1 | N liga a aprovação em "Vampiro v4" → J1 recarrega "Isadora Web" | "Enviar para aprovação" no lugar de "Concluir criação"; "Salvar" ao lado; salvar não envia | `p03d-T04-web1280-02-aprovacao.png` | |
| T-04 | Android 393 | J1 | "Isadora Android" → "+" em Vigor → "Entendi" → `uiautomator dump` | Barra em duas linhas; "Salvar" (`content-desc` "Salvar alterações") e "Concluir criação" ("Enviar para aprovação" com a aprovação ligada), os dois com 48 dp de altura | `p03d-T04-and393-01-barra.png` | |
| T-04 | Android 360 e 411 (`wm density`) | J1 | A mesma tela | A 360, os dois botões numa linha, sem corte; a 411, o mesmo. Anotar a altura da barra em dp (pergunta 3) | `p03d-T04-and360-01-barra.png`, `p03d-T04-and411-01-barra.png` | |
| T-04 | Android 393, teclado de software | J1 | Tocar no número de Destreza ("Digitar") → digitar 3 → tocar "Salvar" na barra com o teclado aberto | O resumo lista Destreza → 3, ou o campo fica aberto sem o valor. **Anotar qual** (pergunta 7) | `p03d-T04-and393-02-digitar.png` | |
| T-04 | iOS, iPhone SE (375 pt) | J1 | "Isadora iOS" → "+" em Vigor → "Entendi" → `describe-all` | Barra em duas linhas; `AXLabel` "Salvar alterações" com texto "Salvar"; "Concluir criação" inteiro | `p03d-T04-iosSE-01-barra.png` | |
| T-04 | iOS, iPhone 17 | J1 | "Salvar" → "Salvar 1 alteração?" → "Salvar" | Toast "Salvo"; a ficha fica em Criação | `p03d-T04-ios17-01-salvo.png` | |

**T-04 · "Salvar e sair" no "Sair sem salvar?"**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-04 | Web 390 | J1 | "Isadora Web" → "+" em Força → "‹ Voltar para Vampiro v4 · …" | "Sair sem salvar?" com três botões em coluna: "Descartar e sair" em cima, "Continuar editando" e "Salvar e sair" embaixo | `p03d-T04-web390-04-sair.png` | |
| T-04 | Web 390 | J1 | Esc | A folha fecha; a URL é a da ficha; o foco volta ao "Voltar para …"; "1 alteração não salva" no cabeçalho | `p03d-T04-web390-05-esc.png` | |
| T-04 | Web 390 | J1 | "‹" → "Salvar e sair" | A crônica abre; toast "Salvo: …" sem "Desfazer"; reabrir a ficha mostra Força gravada e nenhum "Recuperar" | `p03d-T04-web390-06-salvo-saiu.png` | |
| T-04 | Web 1280 (Chromium e WebKit) | J1 | "+" → "‹" | Diálogo central de 560: "Descartar e sair" à esquerda, "Continuar editando" e "Salvar e sair" à direita, numa linha | `p03d-T04-web1280-03-sair.png` | |
| T-04 | Android 393 | J1 | "Isadora Android" → "+" → voltar do Android (`KEYCODE_BACK`) → "Salvar e sair" | A folha abre pelo voltar; "Salvar e sair" grava e volta à crônica; a ficha reaberta tem o valor | `p03d-T04-and393-03-voltar-salvar.png` | |
| T-04 | Android 393 | J1 | "+" → voltar → com a folha aberta, voltar de novo | O segundo voltar fecha a folha ("Continuar editando"); a ficha continua aberta | `p03d-T04-and393-04-voltar-folha.png` | |
| T-04 | Android 360 | J1 | "+" → "‹" | Os três botões em coluna, inteiros, acima da barra de navegação | `p03d-T04-and360-02-sair.png` | |
| T-04 | Android 393, sem rede | J1 | Modo avião (`adb shell cmd connectivity airplane-mode enable`) → "+" → "‹" → "Salvar e sair" → rede de volta | Sai na hora; o lote sobe com a rede de volta; a ficha reaberta tem o valor | `p03d-T04-and393-05-offline.png` | |
| T-04 | iOS, iPhone SE | J1 | "Isadora iOS" → "+" → "‹" (tocar pelo `AXLabel` "Voltar para …") → "Salvar e sair" | Sai **depois** de a folha fechar, sem folha presa nem tela em branco (pergunta 2) | `p03d-T04-iosSE-02-voltar-salvar.png` | |
| T-04 | iOS, iPhone 17 | J1 | "+" → gesto de voltar (`idb ui swipe 2 400 300 400`) → "Salvar e sair" | O gesto abre a folha; "Salvar e sair" sai como no "‹" | `p03d-T04-ios17-02-gesto.png` | |
| T-04 | iOS, iPhone 17 | J1 | "+" → "‹" → "Descartar e sair" | Sai depois de a folha fechar; reabrir não mostra o valor nem "Recuperar" | `p03d-T04-ios17-03-descartar.png` | |

**R-05 · "Salvar alterações" no Editar**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| R-05 | Web 390 | J1 | "Vampiro v3/v5" → "Otto Web" (abre em Editar) | "Editando · 0 alterações" com "Salvar alterações" desabilitado (`disabled` no `<button>`); nenhum "Concluir" na tela | `p03d-R05-web390-01-editar.png` | |
| R-05 | Web 390 | J1 | "+" em Força → "Salvar alterações" → "Salvar" | "Salvar 1 alteração?"; depois, a ficha em Jogo, com toast "Salvo: … · Desfazer" | `p03d-R05-web390-02-salvo.png` | |
| R-05 | Web 1280 | N | Uma ficha de J1 → "Editar" (seletor) → "+" na FdV atual | "Editando · 1 alteração" com "Salvar alterações"; "1 alteração não salva" no cabeçalho (NW-31) | `p03d-R05-web1280-01-narrador.png` | |
| R-05 | Android 393 | J1 | "Otto Android" → "+" → "Salvar alterações" → "Salvar" | O mesmo do web; `content-desc` "Salvar alterações" | `p03d-R05-and393-01.png` | |
| R-05 | iOS, iPhone SE | J1 | "Otto iOS" → "+" → "Salvar alterações" → "Salvar" | O mesmo; `AXLabel` "Salvar alterações" | `p03d-R05-iosSE-01.png` | |
| R-05 | iOS, iPhone 17 | J1 | "Otto iOS" em Editar com 0 alterações → rolar até o fim → procurar a saída | O botão desabilitado; a saída é o seletor "Jogo" no topo da rolagem (seção 2, item 1). Anotar o caminho | `p03d-R05-ios17-02-sem-alteracoes.png` | |

O que só apareceu no iOS nos outros pacotes da onda (T-15, T-16 na edição, T-39, T-46, T-49 e T-81) não é deste pacote. **Aqui, o obrigatório no iOS** é a saída pelo "‹" e pelo gesto com "Salvar e sair" (os passos do iPhone SE e do iPhone 17 acima) e a barra a 375 pt.

### 11.f Acessibilidade mínima

As ações novas aparecem como texto e com papel na árvore de cada plataforma:

| Onde | Árvore | O que conferir |
|---|---|---|
| Web | DOM (o `.txt` de cada passo) | A barra com `aria-label="Modo Criação"` (ou "Modo Editar"). `<button>` com nome "Salvar alterações" e texto "Salvar". "Concluir criação" como `<button>`. A folha com `aria-modal`, título "Sair sem salvar?" e três `<button>`. A recusa com `role="alert"` |
| Android | `uiautomator dump` | `content-desc` "Salvar alterações", "Concluir criação" e "Salvar e sair", com `clickable="true"`. O botão desabilitado com `enabled="false"` |
| iOS | `idb ui describe-all` | `AXLabel` "Salvar alterações" com `type` Button; "Salvar e sair" e "Descartar e sair" como Button; o título da folha como texto |

### 11.g Limpeza

1. Em "Vampiro v4", N volta a "Aprovação do narrador" para "Desligada".
2. Parar a API e o Metro.
3. **Android:**
   - `adb shell wm density reset`;
   - `adb shell settings put secure show_ime_with_hard_keyboard 0`;
   - modo avião desligado;
   - `adb reverse --remove-all`;
   - `adb emu kill`.
4. **iOS:**
   - `xcrun simctl shutdown all`;
   - o teclado do Simulator de volta ao padrão;
   - parar o `idb_companion`;
   - sair do venv. O venv fica fora do repositório, com a versão anotada.
5. As capturas ficam no scratchpad (só dados fictícios), e nada vai para o repositório.

### 11.h Quando uma plataforma não pode ser conferida

O resultado diz **"não conferido"** e o motivo. Exemplos: o cliente do idb não roda no Python da máquina; o `pip-audit` acusou vulnerabilidade; o build do iOS falhou; o AVD não subiu. Nunca "ok" sem a captura e a árvore do passo.

**Tempo estimado:**

| Plataforma | Tempo |
|---|---|
| Web | ~30 min |
| Android (três densidades) | ~1 h |
| iOS | ~1 h 30, mais o build (~37 min a frio ou ~10 min incremental) |
| Preparação | ~15 min com o commit 7; ~1 h pela tela |
