# Onda 2 · Correções da criação: consolidação dos planos dos pacotes

> Plano · 2026-11-02 · base conferida: `onda/2-correcoes-criacao` em `9f75426` (merge da onda 1 na `main`, PR #40)

A onda 2 da [matriz de achados](../testes/2026-11-01/matriz-achados.md) (seção "Onda 2 · Correções da criação") tem quatro pacotes de correção. Ao fim da onda, a ficha em criação abre no modo certo, cada recusa dá o motivo certo perto do toque, a devolução aparece e a ficha cabe no celular. Cada pacote tem um plano próprio. Este documento junta o que cruza os quatro:

- arquivos em comum;
- acordos de contrato entre pacotes;
- ordem de merge na onda;
- esforço;
- pontos para o PO e perguntas técnicas.

As regras de execução ("PR local", integração, ondas empilhadas) são as da seção "Como executar" da matriz e não se repetem aqui.

Nenhum plano remove campo, muda regra do jogo ou afrouxa limite. A conta da criação continua validada no servidor: o cliente só avisa antes. Nenhuma decisão de produto foi tomada nesta etapa. O que o código mostrou que não se aplica como está escrito vai na seção 6, para o PO. Os pontos para o PO da onda 1 ([onda-1.md](onda-1.md) §6) continuam abertos.

## 1. Pacotes e planos

| Pacote | Branch | Plano | Itens | Esforço na matriz | Esforço no plano | Commits | Revisão antes do merge |
|---|---|---|---|---|---|---|---|
| [P04-C](../testes/2026-11-01/matriz-achados.md#p04-c) · Ciclo de vida da ficha | `pacote/p04-c-ciclo-vida` | [P04-C-ciclo-vida-ficha.md](P04-C-ciclo-vida-ficha.md) | T-05, T-06, T-29, T-32, T-80 | 5 P | **M** (4 a 6 dias) | 9 | `/code-review` e **`/security-review`** (muda três respostas da API) |
| [P05-C](../testes/2026-11-01/matriz-achados.md#p05-c) · Feedback da conta | `pacote/p05-c-feedback-conta` | [P05-C-feedback-conta.md](P05-C-feedback-conta.md) | T-07, T-18, T-20, T-21, R-17, T-55, T-57, R-28 | 4 P, 4 M | **G** (8 a 10 dias); **M** sem o extrato do R-17 | 11 | `/code-review` |
| [P07-C](../testes/2026-11-01/matriz-achados.md#p07-c) · Vantagens: folhas e contadores | `pacote/p07-c-vantagens` | [P07-C-vantagens-folhas.md](P07-C-vantagens-folhas.md) | T-19, T-23, T-58, T-62 | 2 P, 2 M | **M** (3 a 4 dias) | 6, mais 1 opcional | `/code-review` |
| [P08](../testes/2026-11-01/matriz-achados.md#p08) · Layout e teclado | `pacote/p08-layout` | [P08-layout-teclado.md](P08-layout-teclado.md) | T-10, T-11, T-26, T-27, T-28, T-37, T-59, T-64, T-65, T-67, T-68, T-69 | 8 P, 4 M | **G** (10 a 13 dias); **M** sem a parte 2 do T-27 | 14 | `/code-review`; `/security-review` só se entrar a dependência do teclado (pergunta 1) |

**Total da onda: 2 G e 2 M**, em 40 commits mais 1 opcional, ou cerca de 25 a 33 dias de desenvolvimento somados. O caminho crítico é o P08 (10 a 13 dias), seguido do P05-C (8 a 10). Com os quatro em paralelo, a onda leva de duas a duas semanas e meia, mais a integração (E2E, build nativo e conferência no aparelho).

**Por que os planos passam da soma da matriz:**

- **P04-C:**
  - a parte de API do T-80 (freeze com o "de" efetivo, filtro do Histórico, conclusão vinda do `chronicle_audit` na paginação);
  - a lista que sabe da devolução (T-06);
  - o polling da ficha em `pending`;
  - os oito specs E2E que mudam porque a ficha em criação deixa de abrir em Jogo (T-05);
  - o `/security-review`.
- **P05-C:**
  - o aviso de recusa passa a morar no store, reavaliado quando a causa muda (hoje é estado local de cada linha);
  - a previsão do "+";
  - campos novos na conta do core, com 95% de cobertura por arquivo;
  - o extrato do bônus;
  - a conferência nativa do `Stepper`.
- **P07-C:** bate com a matriz.
- **P08:**
  - o T-27 em duas partes: controles de modo na rolagem e a faixa fixa de abas e sub-abas;
  - o menu "Mais opções" do T-11, com os testes de política e do narrador;
  - a conferência em três larguras de Android, dois iPhones e duas larguras de web.

**Se a onda precisar cortar**, cada plano aponta o commit que sai sozinho sem quebrar os outros:

- P05-C: commit 8, o extrato (R-17);
- P08: commit 13, a faixa fixa (T-27, parte 2). Sem os commits 12 e 13, o pacote fica M;
- P04-C: commit 7, o T-29;
- P07-C: commit 7, que já é opcional.

**As branches de pacote** foram criadas na ponta da `onda/2-correcoes-criacao` depois do commit destes planos, sem commit próprio. Cada uma já sai da ponta da onda ("Como executar"); não é preciso avançá-las antes de abrir o worktree.

## 2. Ordem de merge na onda

**P04-C → P05-C → P07-C → P08.** Os quatro planos chegaram à mesma ordem lendo o código. Os pacotes são desenvolvidos ao mesmo tempo, cada um no seu worktree. A ordem vale só para a integração: merge `--no-ff` com o ID no título, e typecheck, lint e testes depois de cada merge.

1. **P04-C primeiro.** Ele:
   - é o único que muda a API na onda, e o `/security-review` dele fica isolado;
   - cria a confirmação unificada de concluir e aprovar (`completionCopy`, com `notes`), que o P05-C preenche com a sobra de bônus (seção 4.1);
   - muda o modo de abertura (T-05), que os specs E2E dos outros pacotes encontram já pronto;
   - toca o topo da Nova ficha (T-29) antes do T-21 do P05-C, no mesmo `new-character.tsx`.
2. **P05-C em segundo.** Ele:
   - faz rebase sobre a confirmação do P04-C e o `CreationPanel` já sem o banner da devolução;
   - cria o aviso de recusa (`notice`, `useDraftNotice`, `DraftNoticeText`, `useStepAdvice`, `Stepper.increase`), que o P07-C consome (seção 4.2);
   - é o único que muda o `@tms/sheet-core`: o `dist` é reconstruído depois do merge dele, antes do typecheck da API;
   - cria o `ref` do `TextField` e o `inputRef` dos editores, que o P08 reaproveita (seção 4.3).
3. **P07-C em terceiro.** Ele troca a frase local das folhas pelo `useDraftNotice` do P05-C e entra no `GroupsLayout` antes das colunas do P08.
4. **P08 por último**, como o P06 na onda 1: é o pacote com mais arquivos, e reorganiza o `SheetView`, a `ModeBar` e o cabeçalho, onde os outros mexem em lógica e texto. Ele:
   - faz rebase sobre os três;
   - põe o banner do P04-C e o provedor do P05-C na rolagem nova;
   - leva para o "Mais opções" as props novas do `StatusMenu` (seção 4.4);
   - ajusta os seletores a 390 px dos specs que dependem do cabeçalho, inclusive o `lifecycle.spec.ts` do P04-C (seção 4.5);
   - confere no aparelho as folhas novas dos outros pacotes (seção 4.7).

**Se o P05-C atrasar,** o P07-C entra antes dele, sem o commit 7, com a frase da recusa vinda do retorno do `write`. Nesse caso, a migração do `ListEditor` para o `useDraftNotice` passa ao P05-C, no rebase dele. A ordem do P04-C e do P08 não muda.

**Com os quatro dentro:**

1. reconstruir o `@tms/sheet-core`;
2. testes completos com `test:coverage`, como o CI;
3. `*.pg.test` da API, com o banco `_test` da integração;
4. E2E em Chromium e WebKit, com os quatro specs novos (`lifecycle`, `creation-feedback`, `advantages` e `layout`);
5. build nativo de Android e iOS (D-00);
6. conferência no aparelho, com a API local e o seed do roteiro (só contas fictícias):
   - AVD Android a 360, 393 e 411 dp;
   - simulador iOS (SE, 402 e 440 pt);
   - web a 390 e 1280.

Depois, push da onda e PR para a `main`, com uma seção por pacote.

**Critério de saída da onda (matriz) × quem entrega.** Os IDs são das notas das personas, e cada plano tem o cenário completo na seção 7.

| Critério | Pacote e notas |
|---|---|
| Cenários do Iniciante (web e app) repetidos sem os achados da onda | P04-C: IW-04, IA-04, IW-08, IW-23, IA-13. P05-C: IW-03, IW-09, IW-10, IW-15, IA-08, IA-10, IA-11, IA-12, IA-19. P07-C: IW-21, IA-28. P08: IW-11, IW-19, IW-20, IA-14, IA-15, IA-30 |
| Cenários do Experiente (web e app) repetidos sem os achados da onda | P04-C: EW-01, EW-08, EA-21. P05-C: EW-04, EW-07, EW-14, EW-17, EW-27, EA-05, EA-07, EA-15, EA-16. P07-C: EW-15, EW-29, EA-01, EA-17. P08: EW-11, EW-12, EW-28, EA-02, EA-11, EA-25, EA-29 |
| E2E verdes | Todos, na integração. Os specs novos são escritos nos pacotes e rodados pela primeira vez na integração, como na onda 1 |

## 3. Arquivos tocados por mais de um pacote

Conferidos nas tabelas "Arquivos tocados" dos quatro planos. As linhas são do `9f75426`.

| Arquivo | Pacotes e trechos | Risco | Como integrar |
|---|---|---|---|
| `apps/frontend/sheet/SheetView.tsx` | P04-C: `ReturnedBanner` em qualquer modo (l.178-179). P05-C: provedor do `useOpenBudget` (l.168-169). P08: filhos da rolagem em array, faixa fixa (`SheetNav`), `header`, `KeyboardArea` e "Em jogo" recolhível (l.166-224) | **Alto** para o P08 | O P08 entra por último e põe o banner e o provedor dos outros na rolagem nova, na mesma ordem. Conferir o arquivo inteiro depois do rebase |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | P04-C: corpo da confirmação e `notes` no `SummarySheet` (l.390-397). P05-C: a sobra de bônus em `notes` e o texto do saldo (l.78, l.190). P08: a lógica (l.57-179) vira o hook `useModeBar`, e o JSX, três peças | **Alto** para o P08; médio entre P04-C e P05-C | O P04-C cria `notes`, e o P05-C só o preenche (seção 4.1). O P08 move o código sem tocar no `SummarySheet` nem nos textos |
| `apps/frontend/sheet/SheetScreen.tsx` | P04-C: `openingMode` (l.250-270), store inicial (l.304-328), troca de estado (l.362-378), props do `StatusMenuButton` (l.180-188) e o `onUnsaved` que vira `onDraftState` (l.336-344). P05-C: `freebiesLeft` no `onDraftState`. P08: as ações da `AppBar` vão para o `SheetMenu` (l.170-207), e o painel do NPC e a barra do narrador, para o `header` do `SheetView` (l.393-401) | Médio | Seções 4.1 e 4.4 |
| `apps/frontend/sheet/storyteller/StatusMenu.tsx` | P04-C: confirmação no `complete`, chamada pelo hook com chave e revisão, aviso de alterações não salvas e 409 (l.73-116, l.211-257). P05-C: preenche `notes`. P08: o `StatusMenuButton` perde o ramo `compact` (l.138-146), e o `StatusMenu` passa a ser exportado | Médio | P04-C → P05-C → P08. O P08 usa o `StatusMenu` como unidade, e a confirmação nova vem junto |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | P04-C: o banner sai de `CreationAlerts` (l.134-161), o toast de `useFinishCreation` (l.104-110) e a confirmação do "Aprovar ficha" (l.347-361). P05-C: `useFreebiesText` (l.59-68), saldo e "A conta fechou" (l.199-230), o extrato e a recusa que fica em `CreationAlerts` | Médio | P04-C antes. Nenhum dos dois toca o formulário de devolução do P03-C (l.306-317, l.375-409) |
| `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx` | P04-C: texto de topo (l.87-91). P05-C: `ref` do `ScrollView` (l.83-86), `View` em volta do formulário e `onInvalid`. P08: o `KeyboardAvoidingView` só-iOS vira `KeyboardArea` (l.135-138) | Médio entre P04-C e P05-C | P04-C antes. O T-21 é o último commit de código do P05-C. O `onSuccess` da onda 1 (l.108-117: chave do T-02, `created` do T-56, "Ficha criada." do L-03) não muda |
| `apps/frontend/sheet/CharacterForm.tsx` | P05-C: `onLayout` das linhas, `ref` dos campos e `onInvalid` (l.48-126). P08: cadeia de "Próximo" (l.95-121). Ficam o `onDirtyChange` (P03-C) e o `properName` (P06) | Médio | Seção 4.3 |
| `packages/ui/src/TextField.tsx`, `apps/frontend/sheet/editors/types.ts`, `editors/TextEditor.tsx` | P05-C: `ref` no `TextField` e `inputRef` nos editores (T-21). P08: o mesmo `ref` (T-26) e a linha da dica com o contador (T-64, l.63-84) | Médio | Seção 4.3 |
| `apps/frontend/sheet/layouts/GroupsLayout.tsx` | P07-C: título e contador do grupo (l.100-109) e o provedor `HeadedList` (l.110-122). P08: colunas no desktop (l.94-133) e a barra de sub-abas (l.59-68) | Médio | P07-C antes. O P08 põe cada grupo, já com a regra do título do P07-C, numa coluna |
| `apps/frontend/sheet/creation/CreationCounter.tsx` | P05-C: `counterText(g, phase)` (l.41-56). P07-C: `items?` e "N itens" (l.18-40). P08: reaproveita o contador na faixa fixa | Baixo | Trechos diferentes. Na integração, conferir a faixa do P08 com o custo do P05-C e a contagem do P07-C |
| `apps/frontend/sheet/SectionView.tsx` | P07-C: `titled` e `items` (l.24-32). P08: `onLayout` (l.23) | Baixo | — |
| `apps/frontend/sheet/creation/creation.ts` (app) | P05-C: `draftRefusal` com `CreationNotice`, `stepAdvice`, `freebieLedger`, `freebiesLeftText` e `priorityNote`. O P07-C não muda o arquivo: só mostra o texto | Baixo | Seção 4.2 |
| `apps/frontend/sheet/evolve/ListEditor.tsx` | P07-C (T-19, T-23, T-58, T-62). O P05-C não toca (salvo o atraso da seção 2). O P08 não toca | Baixo | — |
| `packages/sheet-core/src/creation.ts` e `__tests__/creation.test.ts` | P05-C: campos aditivos (`cap`, `ceiling`, `locked`, `price`, `components`). P07-C: só testes | Baixo | Reconstruir o `dist` depois do P05-C |
| `packages/ui/src/BottomSheet.tsx` | Só o P08 muda (T-10, T-69). O P04-C ("Aprovar ficha?", confirmação do menu) e o P07-C (frase dentro da folha) só usam | Baixo | Seção 4.7 |
| `packages/ui/src/Stepper.tsx` | Só o P05-C (`increase`). O P07-C usa no commit 7 | Baixo | Construído sobre o P06 (`showLabel`, `aria-valuetext`, `valueNativeID`, `hitTarget()`) |
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` | P04-C: prop `creation` no `CharacterList` (l.249-253). P08: invólucro do "Participantes" (l.255) | Baixo | Linhas vizinhas |
| `apps/api/src/__tests__/creation.test.ts` | P04-C: concluir, aprovar, devolver e lista. P05-C e P07-C: casos em `/events: avaliação parcial` (l.260) | Baixo | Blocos `describe` diferentes |
| `apps/frontend/sheet/__tests__/policy.test.tsx` | P04-C (T-32). P08 (T-11: os caminhos passam pelo "Mais opções"; "tela larga" vai a 1280) | Médio | O P08 refaz os caminhos sobre os casos do P04-C |
| `apps/frontend/sheet/__tests__/storyteller.test.tsx` | P04-C (T-80), P05-C (T-18 na confirmação do menu), P08 (T-11: "Histórico" pelo menu) | Médio | Casos separados. O P08 ajusta os caminhos dos casos dos outros |
| `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | P04-C (T-06, T-32), P05-C (vários) | Baixo | O P07-C usa um arquivo novo (`advantages.test.tsx`) |
| `apps/frontend/sheet/layouts/__tests__/layouts.test.tsx` | P07-C (T-58), P08 (T-27, T-28, T-68) | Baixo | Casos separados |
| `e2e/tests/*` e `e2e/support/users.ts` | P04-C: `lifecycle.spec.ts` novo, `completeCreation` e oito specs que abriam ficha em criação em Jogo. P05-C: `creation-feedback.spec.ts`. P07-C: `advantages.spec.ts`. P08: `layout.spec.ts`, `journey`, `journey-backstage`, `a11y-keyboard` e o `lifecycle` do P04-C | Médio | Seção 4.5 |

## 4. Acordos entre pacotes

### 4.1 Confirmação de concluir e aprovar (P04-C × P05-C × P08)

- O P04-C cria o `completionCopy({ by, approval, action })`, uma fonte só de texto para a barra, o menu do narrador e o "Aprovar ficha". As confirmações aceitam linhas extras, **`notes?: readonly string[]`**. O plano do P05-C propunha `detail?: string | null`; vale a forma do P04-C, que entra antes.
- O P05-C põe o `freebiesLeftText(check)` ("Sobram N pontos de bônus. Eles não viram XP.") em `notes`, nos três caminhos.
- **O menu do narrador** fica no `AppBar`, fora do `SheetProvider`. O número chega a ele pelo `onDraftState({ unsaved, freebiesLeft })`, que substitui o `onUnsaved` (`SheetScreen.tsx:336-344`). Conferido: o `check` é calculado sempre que a ficha tem `creation`, em qualquer modo (`sheetStore.ts:395-396`), então o narrador em Leitura também tem o número. Sem `creation`, a linha não aparece. Nunca aparece um número inventado.
- Com alterações não salvas, o "Concluir criação" do menu fica desabilitado, com o aviso (P04-C). "Salvar e concluir" é da D-01 (P03-D).
- O P08 não toca o `SummarySheet` nem os textos, só move a `ModeBar` para o hook.

### 4.2 Aviso de recusa perto do toque (P05-C × P07-C)

O contrato é a API do plano do P05-C (§3.0 e §3.8 dele). O plano do P07-C propunha um `useDraftPreview(path, to)`, que **não é criado**: seria um segundo mecanismo.

| Peça (P05-C) | Uso no P07-C |
|---|---|
| `draftRefusal` devolve `CreationNotice` (`RefusalCause` e texto) | Não reescreve. Só acrescenta um caso ao `RefusalCause` se a folha precisar de um motivo que não existe |
| `notice` e `clearNotice()` no store | A folha chama `clearNotice()` a cada mudança local do `ItemSheet` (`patch`), ao cancelar a remoção e ao fechar. O store não vê o rascunho local da folha |
| `useDraftNotice(path)` e `DraftNoticeText` | No rebase sobre o P05-C, as folhas leem `useDraftNotice('values.<lista>')` e desenham o `DraftNoticeText` dentro da folha, perto da opção tocada ou do "Aplicar" |
| `useStepAdvice(path)` (com `#item`) e `Stepper.increase` | Commit 7 (opcional): o "+" do Valor no `ItemSheet`. A prévia de "um item novo" na `AddItemSheet` fica para o P07-D, porque o `stepAdvice` trata de item que já existe |
| `useSetDraft` continua devolvendo o texto | O T-19 do P07-C funciona sem o P05-C, pela frase que volta do `write` |

O P05-C não edita o `ListEditor`, salvo no caso de atraso da seção 2.

### 4.3 `ref` dos campos (P05-C × P08)

O P05-C cria o `ref` no `TextField` (prop comum no React 19) e o `inputRef` em `EditorProps` para o T-21 (rolar e focar o primeiro erro). O P08 reaproveita os dois e só acrescenta a cadeia de "Próximo" (T-26). A linha da dica e do contador (T-64) é outro trecho do `TextField`.

### 4.4 Cabeçalho da ficha (P04-C × P05-C × P08 × P04-D)

- O P04-C e o P05-C dão props novas ao `StatusMenuButton`: `revision`, `sheetVersion`, `unsaved` e `freebiesLeft`.
- Abaixo de 900 px, o P08 leva o ⋯ do narrador, "Experiência" e "Histórico" para o `SheetMenu` ("Mais opções"). O `SheetMenu` repassa ao `StatusMenu` as mesmas props.
- Ficam:
  - o "N alterações não salvas" do T-17 (o `SyncIndicator` passa a até 2 linhas no `compact`);
  - os alvos de 48 dp do T-70.
- **O lugar do selo do P04-D (D-02):** a `AppBar` ganha `subtitle?: ReactNode`, sob o título, e o P08 não passa nada. As larguras medidas estão no plano do P08 (§3.10): a 360 dp, com alterações não salvas, sobram ~64 dp. O P04-D escolhe entre um rótulo curto no `compact` e o selo no `IdentityBlock`.

### 4.5 E2E

- O T-05 (P04-C) muda o modo de abertura da ficha em criação da dona. Os specs que abriam essa ficha esperando Jogo passam a concluir a criação pela API (`completeCreation`, novo em `e2e/support/users.ts`) ou a tocar "Jogo".
- **Achado da consolidação:** o `lifecycle.spec.ts` do P04-C toca, a 390 px, "Ações do narrador" (o nome do ⋯ do `compact`, `StatusMenu.tsx:139-144`) e "Histórico" direto no cabeçalho. O P08 leva os dois para o "Mais opções". O P08 ajusta esses seletores no rebase, junto com os de `journey.spec.ts:236` e `journey-backstage.spec.ts:297`. Os specs do P05-C e do P07-C não usam o cabeçalho.
- Os quatro specs novos usam `signUp` e `apiAs` (contas fictícias), seletores por papel e `testID`, e as abas da ficha a 390 px. Eles rodam só na integração (portas fixas, um por vez).

### 4.6 `@tms/sheet-core` e `@tms/ui`

- **`@tms/sheet-core`:** só o P05-C muda, com campos aditivos na conta. Depois do merge dele, reconstruir o `dist`: o Metro e o Jest leem o `src`, mas a API e as migrations leem o `dist`.
- **`@tms/ui`:**
  - P05-C: `Stepper.increase` e `TextField.ref`;
  - P08: `AppBar` (sem o inset de cima, com `subtitle`), `BottomSheet` (teclado no Android, diálogo central a partir de 600), `TextField` (linha da dica) e `keyboard.tsx` (novo);
  - nenhuma prop sai.
- **Lição S-01 da onda 1:** o `src` do `@tms/ui` compila no app com o JSX do React, e o defeito de estilo só apareceu no emulador. A conferência no aparelho é obrigatória nos dois pacotes, não só Jest e web.
- O P04-C e o P07-C não tocam o `@tms/ui`.

### 4.7 Folhas (P08 × os outros)

O `BottomSheet` muda só no P08, e a API pública fica igual. As folhas novas ou alteradas dos outros pacotes herdam a mudança:

- P04-C: "Aprovar ficha?" e a confirmação do menu com o aviso de alterações não salvas;
- P07-C: a frase da recusa dentro de "Adicionar Disciplina/Dom/Qualidade" e do editor de item.

Na integração, o P08 confere essas folhas:

- no Android, com o teclado aberto (T-10);
- a 1280 px, como diálogo central (T-69);
- no web, sem regredir o T-71 (Esc durante a animação de entrada, foco de volta ao gatilho, um "Fechar" só).

## 5. O que a consolidação corrigiu nos planos

- **P05-C:**
  - a confirmação usa `notes` (forma do P04-C), não `detail`. O número do menu do narrador chega pelo `onDraftState`;
  - o P07-C não muda o `sheet-core` (o P05-C supunha que o T-23 mexia no `credit`). Ajustado nas seções 3.4, 8.4, 8.5 e na pergunta 8.
- **P07-C:** o `useDraftPreview` saiu. O P07-C usa a API do P05-C e chama `clearNotice()` nas mudanças locais da folha, e a prévia do item novo vai para o P07-D. Ajustado nas seções 3.1, 8.4, 8.5 e na pergunta 4.
- **P08:**
  - o `lifecycle.spec.ts` do P04-C entrou na lista de E2E que ele ajusta;
  - o `SheetMenu` repassa as props novas do `StatusMenu`.

  Ajustado nas seções 4.2, 8.4 e 8.5.
- **P04-C:** a nota para o P08 sobre os seletores do `lifecycle.spec.ts` (seção 8.4).

## 6. Pontos para o PO (nenhum decidido nos planos)

Recomendações da matriz que o código mostra não caberem numa correção como estão escritas:

1. **P07-C, D-06: "o template `vtm-v20` é corrigido".** Não há o que corrigir no template:
   - o V20 já cobra a Qualidade pelo meta `cost` (`design/templates/vtm-v20.json:971`), e o W20 e o M20 também;
   - a recusa da Qualidade (T-08) vem do cliente: o item nasce sem `meta`, e o core recusa item sem custo (`packages/sheet-core/src/creation.ts:659-664`). É a mesma causa do T-23.

   A correção genérica do T-23 grava o mínimo de cada meta numérico com `min`, que é o que o editor já mostra. Com ela, a Qualidade passa a entrar com `Custo 1`, paga com bônus, já na onda 2. É a regra que a D-06 decidiu, duas ondas antes do P07-D. A alternativa grava o valor inicial só no bônus do Defeito e deixa o T-08 inteiro para o P07-D, mas prende o editor às regras de custo do template. **Recomendação técnica: a genérica.** O P07-D continua com o desenho da compra e o texto da recusa.
2. **P04-C, T-29: "um nome para a etapa".** A D-13 mantém "Criação" e "Editar", e a D-01 troca o "Concluir" do Editar por "Salvar alterações". O P04-C não renomeia nada: a Nova ficha passa a dizer em que modo a ficha vai abrir.
3. **P04-C, R-02: "volta para a aba onde parou".** Lembrar a aba por ficha cria estado persistido novo. O P04-C abre no modo certo, na primeira aba.
4. **P04-C, T-05: o padrão "a dona abre em Jogo" muda para toda ficha em criação.** É o que a matriz pede. Mas, na crônica livre, a ficha fica em criação até o narrador concluir, então quem joga com ela antes disso passa a abrir em Editar e troca para Jogo com um toque.
5. **P05-C, R-20: "'+' desabilitado".**
   - Um `disabled` de verdade volta a dar o "toque que parece morto" (IA-10, EA-16).
   - A previsão usa o preço de tabela. Ela bloquearia pontos que o servidor aceita nos descontos derivados (Coragem × FdV).

   O plano deixa o "+" com cara de indisponível (`aria-disabled` e opacidade), tocável, e o toque explica o motivo (pergunta técnica 2).
6. **P05-C, R-17: "o extrato fica na ficha concluída, em leitura".** Exige gravar a conta no momento da conclusão (API e banco). É dado novo. O lugar técnico mais barato seria o item "Criação concluída" do Histórico (T-80) ou o Orçamento em leitura da D-10.
7. **P07-C, T-62: guardar o texto ao fechar a folha** seria comportamento novo: fechar é cancelar, como nas outras folhas. O que entra é o Enter adicionar e a recusa não apagar o nome.
8. **P08, T-11: o narrador passa a dar dois toques até as ações no celular** ("Mais opções" → "Ações do narrador · {estado}"). Em troca, vê o estado no item. O design system desenha o ⋯ em toda largura; o plano usa o ⋯ só abaixo de 900 px e mantém os botões no desktop (pergunta técnica 4).
9. **P08, T-59: "Em jogo" recolhido na Criação.** É o item mais perto da fronteira: não remove campo nem cria estado no servidor, e o bloco fica a um toque. Está num commit próprio (11), que sai sozinho.
10. **Botões de "ficar" nas folhas** (achado visual da onda 1, fora da matriz): o aviso de "Sair" usa botão com borda, e a guarda de saída usa texto. Fica como nota para o P03-D (onda 3), que refaz esse rodapé pela D-01.

## 7. Causas da matriz corrigidas pela leitura do código

A matriz foi escrita sobre o `1db3db9`, antes da onda 1. As principais correções:

- **T-05:** passar o `?mode=` na lista não basta. O modo vem do `defaultMode` e da troca de estado no `SheetScreen` (l.254-255, l.304-328, l.365-378), e é lá que fica a correção.
- **T-06:** o banner da devolução só aparece em Criação **e** na criação por pontos. A ficha aberta em `pending` não rebusca. A lista não sabe da devolução porque a API não manda nada além do `status`.
- **T-32:** além de não confirmar, o menu do narrador conclui sem chave, sem `revision` e sem `sheetVersion`, e descarta em silêncio o rascunho aberto do narrador.
- **T-80:** as linhas "0 → 0" e "0 → 6" são o lote `freeze`, gravado com `from_value` nulo (`apps/api/src/sheets/creation.ts:191-241`), não a aprovação. A conclusão só vai para o `chronicle_audit`.
- **T-07:** o teto por traço não chega à recusa: o `CreationComponent` não guarda o `creation-cap`.
- **T-20 e T-55:** a recusa é `useState` de cada linha (`NumberEditorRow.tsx:63`), nunca recalculada, e desenhada embaixo da linha (`EditorShell.tsx:39-44`). A l.379 que a matriz cita é só a chamada.
- **T-18:** a confirmação é o `SummarySheet` (`ModeBar.tsx:390-397`), não a l.326.
- **T-19:** a recusa fica no estado do `ListEditor` e é desenhada atrás do `Modal`. `sheetStore.ts` e `creation.ts` não precisam mudar para o P07-C.
- **T-23:** o item nasce sem `meta`, e o editor mostra o `min`. A conta do core e do servidor está certa; a l.138 citada é a declaração de um tipo.
- **T-58:** são três camadas repetidas (`SectionView`, `GroupsLayout` e o `ListHeader`), e o número do `ListHeader` é a quantidade de itens, sem unidade.
- **T-37:** acontece também no Android (edge-to-edge com `targetSdk` ≥ 35), e o dock soma o inset de baixo de novo.
- **T-64:** a causa é o `TextField` do `@tms/ui`, não o `SheetScreen` nem o `validation.ts`.
- **T-65:** `IdentityBlock.tsx:68-80` e `:110` (a matriz diz "não indicado").
- **T-68:** a barra "Todos os recursos" não cobre a grade no código. No print, o que cobre é o LogBox do build de debug.
- **T-26:** o `KeyboardAvoidingView` está em cinco telas, todas só no iOS, e não "só em `join` e `chronicles/new`".

## 8. Perguntas técnicas abertas

A lista completa está na seção 9 de cada plano. Estas cruzam pacotes ou mudam o esforço da onda (⚙ = resposta só no simulador ou no aparelho):

| # | Pergunta | Plano | Por que importa para a onda |
|---|---|---|---|
| 1 | ⚙ O teclado chega à folha (`Modal` edge-to-edge) no Android? Se não, entra o `react-native-keyboard-controller` 1.22.7 (versão do SDK 58), ou a folha de altura total | P08, perg. 1 | Dependência nativa nova: `/security-review`, `pnpm audit` e `check:native`. Muda o T-10 de P para M |
| 2 | "+" bloqueado tocável (`aria-disabled`) ou `disabled` de verdade? Previsão de tabela ou exata (medir o `checkCreation` no Pixel 3a)? | P05-C, perg. 1–2 | Define o "+" do P05-C e o commit 7 do P07-C, que usa o mesmo `Stepper.increase` |
| 3 | Valor inicial em todo meta numérico com `min` ou só no bônus do Defeito? | P07-C, perg. 1 | Ligada ao ponto 1 da seção 6 |
| 4 | Menu "Mais opções" só abaixo de 900 px ou em toda largura (como o DS)? Listar as ações do narrador direto no menu depois do P04-C? | P08, perg. 3 e 6 | Em toda largura, muda os E2E de 1280 (`table.spec.ts`, `journey.spec.ts:223`, `journey-storyteller.spec.ts`). Listar as ações tira o `StatusMenu` da unidade que o P04-C mexe |
| 5 | Polling de 30 s na ficha em `pending`; foco da janela no web só no `useRefetchOnFocus` ou no `focusManager` global | P04-C, perg. 2–3 | Carga e o que rebusca ao clicar na janela |
| 6 | Migration de dados para os lotes de freeze já gravados | P04-C, perg. 1 | Depende de existir banco com fichas reais (onda 1, pergunta 3). Sem ela, só as conclusões novas ficam limpas |
| 7 | Quando o aviso de recusa some: no próximo toque aceito em qualquer campo, ou só quando a causa some? R-28 em toast ou numa linha fixa? | P05-C, perg. 5–6 | É o comportamento que o P07-C herda nas folhas |
| 8 | ⚙ No iOS, fechar uma folha e abrir outra no mesmo render (menu → "Histórico") funciona? | P08, perg. 2 | Se não, a `BottomSheet` ganha `onClosed`: muda a API do `@tms/ui` |
| 9 | ⚙ O WebKit respeita o `position: sticky` das abas fixas do react-native-web? | P08, perg. 10 | Se não, a faixa usa a técnica do nativo: mais esforço no commit 13 |
| 10 | Faixa que recolhe ao rolar, com animação, agora ou depois? | P08, perg. 4 | O plano faz a versão sem animação |

## 9. Riscos da onda

- **O P08 faz rebase sobre os três.** O `SheetView` e a `ModeBar` têm risco alto. O commit 13 (faixa fixa) sai sozinho, e sem ele ficam os controles de modo na rolagem (commit 12).
- **A ficha em criação deixa de abrir em Jogo (T-05).** Mudam fixtures do Jest, oito specs E2E e o Maestro `02` (o `CHARACTER_ID` passa a ser de uma ficha concluída).
- **Duas mudanças no `@tms/ui` (P05-C e P08).** Só o nativo mostra defeito de estilo do JSX (S-01), então a conferência no aparelho vem antes do merge, não depois.
- **O `@tms/sheet-core` muda no P05-C.** Até a reconstrução do `dist`, a API e o typecheck dela usam a conta antiga.
- **API e AuthZ no P04-C.** São três respostas novas: `returned` na lista, sem o motivo; o Histórico sem as linhas sem mudança e com "Criação concluída"; e o freeze com o "de" efetivo. O `/security-review` confere:
  - quem recebe o motivo da devolução (só o `GET /characters/:id`, para o dono e o narrador);
  - a autoria do item de conclusão (`actor_id` gravado pelo servidor, `byRole` calculado contra o dono);
  - a exposição do `chronicle_audit` ao jogador (só duas ações, da ficha pedida, sem `payload`);
  - o NPC oculto e o `viewer` (404 no Histórico, como hoje).
- **E2E escritos e não rodados nos pacotes.** Os quatro specs novos rodam pela primeira vez na integração, como na onda 1, que só ali pegou os seletores exatos do T-61 e o Esc do T-71.
- **Recursos locais.** O E2E usa portas fixas e roda um por vez, só na integração. Os `*.pg.test` (P04-C) usam um banco `_test` por worktree. O build nativo roda uma vez, na integração.

## 10. Integração (02/11/2026)

Os quatro pacotes foram implementados em paralelo, um agente por plano, cada um no seu worktree, e integrados em série na `onda/2-correcoes-criacao`. O P05-C, o P07-C e o P08 receberam a onda na própria branch antes do merge e resolveram os conflitos lá. O P05-C ligou a sobra de bônus ao `notes` do P04-C, o P07-C trocou a frase local pelo aviso do P05-C, e o P08 reaplicou a confirmação e o aviso na rolagem nova.

| Ordem | Pacote | Merge na onda | Revisão |
|---|---|---|---|
| 1 | P04-C | `5650c9f` | `/security-review`: nenhuma vulnerabilidade. `/code-review` (high): 10 achados, 5 corrigidos |
| 2 | P05-C | `fa8ecfa` | `/code-review` (high): 10 achados, 6 corrigidos. Depois do merge com o P04-C (medium): 7 corrigidos |
| 3 | P07-C | `591a557` | `/code-review` (high): 9 achados, 6 corrigidos. Depois do merge com o P05-C (medium): 6 achados, 4 corrigidos |
| 4 | P08 | `7a161c9` (e `f3f3b8a`) | `/code-review` (high): 10 achados, 7 corrigidos. Depois do merge com os três (medium): 10 achados, 7 corrigidos |

**Perguntas técnicas: o que foi aplicado.** Sem resposta do time, cada pacote seguiu a proposta do próprio plano, com estas escolhas:

- **Pergunta 1 (teclado no Android).** O `react-native-keyboard-controller` não entrou. No AVD, a folha "Adicionar Defeito" sobe acima do teclado só com o `padding` do `KeyboardArea`.
- **Pergunta 2.** O "+" fica tocável, com `aria-disabled`, e a previsão usa o preço de tabela.
- **Pergunta 4.** O "Mais opções" vale só abaixo de 900 px.
- **Pergunta 5.** O polling é de 30 s em `pending`.
- **Pergunta 6.** Não houve migration para os lotes de freeze antigos.
- **Pergunta 8 (folha seguinte no iOS).** A `BottomSheet` ganhou `onClosed`, que é uma prop nova e não muda nenhuma das existentes. A revisão do P08 achou a troca de folha falhando no iOS. A troca foi conferida no Android; no iOS não deu para conferir (ver abaixo).
- **Pergunta 9.** A faixa fixa passou no WebKit (`layout.spec.ts`).
- **Pergunta 10.** A faixa não tem animação.
- **Commits que podiam sair sozinhos.** O T-23 entrou na forma genérica, e o extrato do R-17, o T-59 e as duas partes do T-27 também entraram.

**Achados da integração (commits na onda):**

- **`e8cfaf8` (P05-C, achado pelo E2E).** No web, o "+" bloqueado ficava morto. O react-native-web 0.21 transforma `aria-disabled` e `accessibilityDisabled` em `disabled` com `tabIndex=-1` num `<button>`. Agora o `aria-disabled` vai direto no elemento (`markSoftDisabled`). O Jest não renderiza o DOM e não pegava o defeito.
- **`c7c1423` (P04-C, achado pelo E2E da jornada da v3).** O cache persistido montava a ficha ainda em criação, aberta em Editar. Quando o servidor respondia que a criação estava concluída, ela não saía do Editar. Agora, se a ficha está no Editar da abertura e não tem nada a salvar, ela vai para o modo de abertura novo. Isso foi conferido no AVD.
- **`f3f3b8a` (P08, achado pelo E2E).** Na folha sem campo em autoFocus ("Convidar"), o Esc durante a animação de entrada não fechava nada. Agora o Esc fecha a folha de cima. Os specs novos tiveram os seletores corrigidos.
- **`e0a4078` (P07-C e P08, achado no AVD).** "Ambidestro" com "✓" entrava como "Ambi", porque o "✓" chegava antes do último `onChangeText`. Agora a folha "Adicionar …" e o Enter da senha no cadastro usam o texto do evento. No cadastro, a conta podia nascer com a senha cortada.
- **`909d12e` (P08, achado no web a 1280).** Os cinco grupos de Vantagens ficavam lado a lado, com 240 px cada, e o rótulo do Stepper quebrava no meio da palavra ("Corag em"). A coluna do grupo passou a ter pelo menos 320 px: a 1280, Vantagens fica em 3 + 2, e Atributos e Habilidades continuam em três colunas.
- **`7ef8b0b`.** O teste do T-62 passou a mandar o texto do campo no Enter, como o app.

**Resultado na onda com os quatro pacotes:**

| Verificação | Resultado |
|---|---|
| typecheck | 16/16 |
| lint | verde |
| sheet-core | 980 testes |
| config | 36 testes |
| db | 33 testes |
| api | 1663 testes |
| ui | 186 testes |
| frontend | 1073 testes; `test:coverage` dentro das metas por arquivo |
| `*.pg.test` | 43 testes |
| E2E Chromium e WebKit | 118 testes, com os quatro specs novos (`lifecycle`, `creation-feedback`, `advantages`, `layout`) |
| Build nativo local (debug) | Android: `assembleDebug` (arm64) em ~3 min. iOS: `xcodebuild` Debug para o simulador em ~37 min |

**Conferência manual (API local com o seed do roteiro; contas `@roteiro.test`, só dados fictícios):**

| Onde | Conferido |
|---|---|
| Android, AVD Pixel 3a a 393 dp | T-26 (o Enter no e-mail leva à senha; cadeia Nome → Natureza → Comportamento → Conceito; "✓" no último campo sem enviar; campo acima do teclado) · T-29 (texto da crônica e da Nova ficha) · T-21 (rola, foca e abre o teclado no "Nome") · T-64 · T-67 · T-05 (Criação na v4, Editar na v3/v5) · T-37 · T-59 · T-27 (abas e sub-abas presas; "Ver orçamento" leva ao topo do Orçamento) · T-20/T-55/T-07/R-28 (o "+" apagado é tocável e explica ao lado; o aviso some ao escolher a prioridade) · T-58 · T-10 (a folha acima do teclado) · T-62 e T-23 ("Inimigo, Bônus 1"; "Ambidestro, Custo 1"; saldo 16 → 14) · T-11 ("Mais opções" → Histórico) · a ficha concluída pelo narrador abre em Jogo, com o dock · T-68 |
| Android a 360 e 411 dp | T-11: com "1 alteração não salva", nada sai da tela. T-03 (onda 1): "Recuperar" depois de recriar a Activity |
| Web a 390 (Chromium do Playwright) | O narrador conclui pelo "Mais opções" → "Ações do narrador" → "Concluir criação?" (T-32) · Histórico só com "Criação concluída · (narrador)" (T-80) · o "+" bloqueado com `aria-disabled`, sem `disabled`, no Tab, com o aviso |
| Web a 1280 | T-28 (Atributos e Vantagens em colunas) · T-11 ("Experiência" e "Histórico" no cabeçalho) · T-69 (diálogo central de 560) · T-71 (Esc fecha e o foco volta ao gatilho) |
| iOS, simulador iPhone SE (18.1) e iPhone 17 (26.5) | O app abre e desenha o login com os estilos do `@tms/ui` (S-01). No iPhone 17, o conteúdo fica abaixo da Dynamic Island. **Não houve navegação:** o `osascript` não tem acesso assistivo nesta máquina, só o `idb_companion` está instalado (sem o cliente `idb` nem o Maestro), e o deep link pede "Abrir com 'TMS'?" |

**Observações para as próximas ondas (sem correção nesta):**

- **Identidade em duas colunas (T-65).** A terceira coluna do template quebra para baixo da primeira e deixa um vão sob "Nome", que é o único campo da primeira coluna.
- **Nome da ficha a 360 dp com alterações não salvas.** O título encurta até "Hele…". É o espaço que sobra para o selo do P04-D (§4.4).
- **"Nenhum Qualidade".** O artigo não concorda com o rótulo do item no V20. O defeito é anterior à onda.
- **Login.** O Enter da senha ainda lê o estado, e não o evento. É anterior à onda; ali, o pior caso é uma tentativa de login recusada.
- **Anúncio da recusa no app.** O papel de alerta com `key` (P05-C e P07-C) pode não ser lido sozinho pelo VoiceOver e pelo TalkBack. Fica para ouvir no aparelho, com o T-34 da onda 1.
- **Build de desenvolvimento.** O aviso de "linking em mais de um lugar" aparece quando a Activity é recriada, como na onda 1.

**Fica para depois da integração local:**

- **O roteiro do iOS com toque.** Precisa de acesso assistivo para o terminal ou de uma ferramenta de toque (`idb` ou Maestro). Os passos estão na seção 7 de cada plano.
- **Os jobs nativos do CI** no PR da onda.
- **Os pontos para o PO da seção 6** continuam sem decisão.
