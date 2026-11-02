# P08 · Layout e teclado: plano de implementação

> Plano · 2026-11-02 · base conferida: `onda/2-correcoes-criacao` em `9f75426` (main depois da onda 1)

Pacote [P08 da matriz](../testes/2026-11-01/matriz-achados.md#p08): onda 2 (Correções da criação), correção, pré-requisito P06 (mergeado na onda 1). É pré-requisito do P04-D (onda 3), que põe o selo de estado no cabeçalho que este pacote refaz.

O pacote não remove campo, não muda regra do jogo e não afrouxa limite:

- tudo o que sai do cabeçalho ("Experiência", "Histórico", as ações do narrador) continua a um toque, no menu "Mais opções", com as mesmas condições de papel de hoje;
- o bloco "Em jogo" continua na Criação, só recolhido por padrão (seção 3.11);
- a grade, as colunas e a identidade mudam só de arranjo: os mesmos campos, na ordem do template;
- o teclado e o "Próximo" não mudam validação: o servidor continua conferindo tudo.

**Versões conferidas em `node_modules`:** react-native 0.88.0, react-native-web 0.21.4, expo 58, react-native-safe-area-context ~5.10.1. O `react-native-keyboard-controller` está no `bundledNativeModules.json` do SDK 58 (1.22.7), mas não é dependência do app (pergunta 1).

As linhas citadas são do `9f75426`. A matriz cita o `1db3db9`, de antes da onda 1: `BottomSheet.tsx`, `SheetScreen.tsx`, `StatusMenu.tsx`, `SyncIndicator.tsx`, `GroupsLayout.tsx` e `GridLayout.tsx` mudaram na onda 1 (T-71, T-35, T-42, T-17, T-70), e as linhas da matriz não valem mais.

---

## 1. Objetivo e itens

**Objetivo (matriz).** Nenhuma ação fora da tela nem atrás do teclado; abas e contadores fixos no celular; cabeçalho que cabe em 390; colunas no desktop; margens e quebras de texto certas.

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| T-10 | alta | No Android, a folha com campo de texto fica atrás do teclado | `packages/ui/src/BottomSheet.tsx:153-156` (`behavior` só no iOS; a matriz cita l.50-52) |
| T-11 | alta | O cabeçalho da ficha passa da largura: "Histórico" fora da tela e rolagem lateral no web | `apps/frontend/sheet/SheetScreen.tsx:170-207` (ações da `AppBar`); `packages/ui/src/AppBar.tsx:44-90`; `sheet/storyteller/StatusMenu.tsx:118-160`; `sheet/sync/SyncIndicator.tsx:65-79` |
| T-26 | média | No Android, o teclado cobre o campo focado na ficha, na busca, na Nova ficha e no login, sem "Próximo" | `KeyboardAvoidingView` só no iOS em 5 telas (`login.tsx:43-46`, `register.tsx:54-57`, `join.tsx:40-43`, `chronicles/new.tsx:63-66`, `new-character.tsx:135-138`) e nenhum na ficha (`sheet/SheetView.tsx:172-219`); sem `returnKeyType`/`onSubmitEditing` entre campos (`login.tsx:62-89`, `register.tsx:66-105`, `sheet/CharacterForm.tsx:95-121`) |
| T-27 | média | Abas, sub-abas e contador do grupo saem da tela; a área fixa toma ~31% da tela | `sheet/SheetView.tsx:171` (`ModeBar` fixa), `:201-211` (abas dentro da rolagem); `sheet/layouts/groupTabs.tsx:12-52` (sub-abas dentro da seção); `SheetScreen.tsx:395-399` (painel do NPC e barra do narrador fixos) |
| T-28 | média | No desktop, as ~30 Habilidades ficam numa coluna só | `sheet/layouts/GroupsLayout.tsx:94-133` (grupos sempre empilhados) |
| T-37 | média | Faixa vazia de 60–80 pt acima do cabeçalho | `packages/ui/src/Screen.tsx:24` e `AppBar.tsx:52`, os dois com `insets.top`. **Também no Android** (edge-to-edge; seção 3.0), não só no iOS. O dock soma o de baixo de novo (`sheet/play/CombatDock.tsx:58`) |
| T-59 | baixa | "Em jogo" aberto antes dos Atributos também na Criação | `sheet/SheetView.tsx:191-200` (a matriz cita l.171) |
| T-64 | baixa | Contador de caracteres cola na dica ou sai da tela | `packages/ui/src/TextField.tsx:63-84` e `:102` (linha da dica sem `gap` nem encolhimento). **A causa não está no `SheetScreen` nem no `validation.ts`** da matriz: é o `TextField`, e vale para todo uso com dica e `maxLength` |
| T-65 | baixa | "Comportamento" quebra no meio da palavra na grade de 3 colunas | `sheet/IdentityBlock.tsx:68-80` e `:110` (`flex: 1, minWidth: 0`: a palavra quebra dentro da coluna). A matriz diz "não indicado" |
| T-67 | baixa | Títulos da crônica e dos Bastidores encostam na borda; "Convidar" encosta na direita | `SectionHeader` sem recuo lateral (`packages/ui/src/SectionHeader.tsx:41-48`) usado sem invólucro em `app/(app)/chronicles/[id]/index.tsx:255`, `components/chronicles/RollFeed.tsx:81` e `CampaignBackstage.tsx:84`, `:303`, `:429`, `:535` |
| T-68 | baixa | Número do traço colado ou fora da célula na grade do Jogo | `sheet/views/RatingViews.tsx:83-90`, `:131-142` (célula de 98 dp úteis a 390 e 86 a 360, para 94 de conteúdo). A barra "Todos os recursos" **não cobre** a grade no código (seção 3.8) |
| T-69 | baixa | No desktop, a folha ocupa a largura inteira | `packages/ui/src/BottomSheet.tsx:225-234` (sempre presa embaixo, sem largura máxima) |

---

## 2. Decisões aplicadas

**O P08 não tem decisão de produto própria** (coluna "Decisões" vazia na matriz). Nenhuma das D-00 a D-14 é implementada aqui. O que o desenho segue ou respeita:

| Origem | O que diz | Como entra no desenho |
|---|---|---|
| `design/design-system/components.md` CharacterHeader (l.487-497) | Header com voltar, nome, sincronização e um ⋯ "Mais opções", com o Histórico dentro | T-11: menu "Mais opções" abaixo de 900 px |
| `components.md` SectionTabs (l.421-451) | "3 abas fixas"; a faixa recolhe ao rolar | T-27: abas fixas na rolagem (`stickyHeaderIndices`) |
| `components.md` BottomSheet (l.613-626) | "A partir de 600 vira modal centralizado de até 560" | T-69 |
| `components.md` Grid / Cell (l.398-408) | "container ≤ 400 (padding menor, rótulo 15, pip 12)" | T-68 |
| `avaliacao-ui-ux.md` C-10 (l.425) | ≥ 900: grupos lado a lado quando cada um tem ≥ 240 px (`minColWidth`) | T-28 |
| `avaliacao-ui-ux.md` C-20 (l.536) e C-21 (l.549) | Histórico no ⋯; safe area pelo `react-native-safe-area-context` | T-11; T-37 (o inset uma vez) |
| `avaliacao-ui-ux.md` C-23 / UX-17 (l.581, l.3083) | Teclado: `KeyboardAvoidingView` (ou `react-native-keyboard-controller`), `number-pad` | T-10 e T-26. O `number-pad` já existe (`NumberEditorRow.tsx:187`) |
| D-02 (P04-D, onda 3) | Estado da ficha "sob o nome da ficha" | O P08 reserva o lugar no cabeçalho (seção 3.10), sem selo |
| D-01 (P03-D, onda 3) | "Salvar" sempre na barra, com "Concluir criação"/"Enviar para aprovação" ao lado | A barra de ação da Criação continua fixa; os testes do P08 não supõem um botão só nela |
| D-03 (P04-D) | Um texto na barra diz o próximo passo | Mesma barra fixa; o P08 não a encurta |
| D-05 (P05-D, onda 4) | A aba "Orçamento" passa a "Pontos" | Nada a fazer: a aba fixa lê o rótulo do dado |
| D-10 (P09-D, onda 5) | As abas da crônica sobem para o topo | O T-67 só alinha os títulos; não mexe nas abas da crônica |

**Correção ou comportamento novo?** Pela legenda da matriz, nenhum item exige decisão:

- **T-11 (menu "Mais opções") e T-27 (abas fixas):** o DS já define. É código alinhado ao desenho do projeto.
- **T-27, "cabeçalho que recolhe ao rolar":** o DS define a faixa que some ao rolar para baixo e volta ao rolar para cima. O plano usa uma forma mais simples, sem animação: no celular, os controles de modo rolam com a ficha (seção 3.12). A versão animada fica como pergunta 4.
- **T-59 ("Em jogo" recolhido na Criação):** o DS não fala do modo Criação, e a recomendação é da R-23. Não remove campo, não cria estado no servidor nem ação nova: o bloco fica a um toque, com `aria-expanded`. É o item mais perto da fronteira. Ele é um commit próprio (11) e sai sozinho se o PO entender diferente.

**Pontos para o PO da onda 1 (`onda-1.md` §6):** continuam abertos; nenhum é tratado aqui. A pergunta técnica 7 do P06 ("o cabeçalho do Android fica mais apertado com 48 dp até o P08") se encerra com o T-11.

---

## 3. Desenho por item

### 3.0 O que as plataformas fazem hoje (explica as causas)

**Android (RN 0.88, Expo 58, `targetSdk` ≥ 35)**

- **Edge-to-edge sempre ligado.** `updateEdgeToEdgeFeatureFlag` liga a flag em todo app com `targetSdk` ≥ 35 (`ReactAndroid/.../views/view/WindowUtil.kt:46-62`). Com ela:
  - o `insets.top` do `react-native-safe-area-context` vem preenchido no Android também, por isso o T-37 aparece nas capturas do Android (`img/qa-app/134-jogo-android.webp`);
  - a janela do `Modal` também é edge-to-edge (`ReactModalHostView.kt:84`, `:397`). O `SOFT_INPUT_ADJUST_RESIZE` que ela pede (`:334`) não redimensiona nada: o teclado desenha por cima.
- **O `KeyboardAvoidingView` sem `behavior` não faz nada.** Com `undefined`, ele é uma `View` comum. No Android, quem age é o `behavior` (`padding`), a partir do `keyboardDidShow`, que o `ReactRootView` emite olhando os insets do IME (`ReactRootView.java:934-975`).
- **`ScrollView` e foco:** o `ReactScrollView` rola até o filho que recebe foco (`ReactScrollView.kt:479-483`), e o `ScrollView` do Android mantém o focado à vista quando encolhe. Com a rolagem encolhida acima do teclado, o campo aparece.
- **Toque em elemento fora da área visível:** o ScrollView continua expondo os filhos cortados na árvore de acessibilidade, com coordenadas atrás da barra fixa. É isso que o POA-15 descreve ("os toques caem na barra"). Não é defeito de código; com as abas fixas, a pessoa deixa de precisar deles.

**iOS**

- O `Modal` tem `onDismiss` só no iOS (`Libraries/Modal/Modal.js:315-324`).
- O inset de cima vem do `SafeAreaInsetsContext`, e `Screen` e `AppBar` somam o mesmo valor.

**react-native-web 0.21.4**

- `KeyboardAvoidingView` é uma `View` (o teclado não se aplica).
- `stickyHeaderIndices` vira `position: sticky; top: 0` no filho (`exports/ScrollView/index.js:532-537`, `:611`).
- O `Modal` chama `onDismiss` depois da animação de saída, em `slide` e em `fade`.
- **Rolagem lateral do T-11:** os `Button` do cabeçalho não encolhem; o título (`flex: 1`) encolhe até zero e o resto passa da largura. A página inteira rola de lado.

### 3.1 T-37: a safe area aplicada uma vez

**Causa confirmada.** Os 9 arquivos com `AppBar` a põem dentro de um `Screen` (`index.tsx`, `join.tsx`, `_layout.tsx`, `account.tsx`, `chronicles/[id]/index.tsx`, `chronicles/new.tsx`, `new-character.tsx`, `characters/[id].tsx` e `SheetScreen.tsx`). O `Screen` com `safe` (padrão, `Screen.tsx:24`) já soma `insets.top`, e a `AppBar` soma de novo (`AppBar.tsx:52`). Login e cadastro usam `Screen` sem `AppBar` e já estão certos.

**O que muda**

- `AppBar` perde o `paddingTop: insets.top` (e o `useInsets`). Quem dá a área segura é o `Screen`, como o C-21 pede.
- **O mesmo defeito embaixo:** o `CombatDock` soma `insets.bottom` (`CombatDock.tsx:58`) dentro do `Screen`, que já soma. O dock passa a usar só `tokens.space[2]`, como a `BonusNotice` (que já não soma). Efeito visual: abaixo do dock, na área do indicador de início, fica o fundo da tela (`bg`), não o `surfaceRaised`. É o mesmo da `BonusNotice` hoje.
- `BottomSheet` e `Toast` continuam somando o inset: estão num `Modal`, fora do `Screen`.

### 3.2 T-64: contador do `TextField` sem colar nem sair da tela

**Causa confirmada.** A linha `meta` (`TextField.tsx:63-84`, estilo `:102`) é `row` com `space-between`, sem `gap`. A dica não tem `flex`, e o contador encolhe. Resultado: "números0/24" e "0/2" cortado. Vale para todo `TextField` com dica e `maxLength`: Retrato HTTPS (`SheetScreen.tsx:531-541`), nome de usuário (`register.tsx:82-94`) e os campos com `help` da Nova ficha (`editors/TextEditor.tsx:24-39`).

**O que muda.** `meta` ganha `gap: tokens.space[2]` e `alignItems: 'flex-start'`. A dica (ou o erro) ganha `flex: 1`, e o contador ganha `flexShrink: 0`. A dica quebra em várias linhas e o contador fica inteiro, alinhado à direita. A recomendação "(estimado)" da matriz falava em contador em linha própria. Este desenho tem o mesmo efeito, mais baixo. Sem dica, nada muda.

### 3.3 T-10: a folha acompanha o teclado no Android

**Causa confirmada** (seção 3.0): `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` (`BottomSheet.tsx:156`) e a janela do `Modal` edge-to-edge.

**O que muda**

- **Um valor só para o `behavior`.** Arquivo novo `packages/ui/src/keyboard.tsx`, exportado:
  - `keyboardBehavior()` devolve `'padding'` no iOS e no Android e `undefined` no web, lendo `Platform.OS` na hora (como o `hitTarget()`);
  - `KeyboardArea` (`{ children, style?, testID? }`) é o `KeyboardAvoidingView` com esse `behavior` e `flex: 1`.

  A `BottomSheet` usa `keyboardBehavior()` na raiz (l.153-156). As telas do T-26 usam o `KeyboardArea`. Se a pergunta 1 levar ao `react-native-keyboard-controller`, a troca acontece só nesse arquivo.
- **Enter aplica nas folhas de uma linha.** O "✓" do Android hoje só fecha o teclado. No `TextEditorRow` (Conceito e os outros `text`, `sheet/evolve/TextEditorRow.tsx:101-111`), o campo de **uma linha** ganha:
  - `returnKeyType="done"` e `submitBehavior="submit"`;
  - no web, `blurOnSubmit={false}`;
  - `onSubmitEditing={apply}`, o padrão do `NumberEditorRow` (`:188-202`, T-25).

  O `longText` (Fraqueza do clã, motivo de Devolver, Conceder XP) continua com Enter = nova linha, e o botão de ação passa a ficar à vista acima do teclado. As folhas "Adicionar Dom/Qualidade" são do P07-C (T-62, no `ListEditor`), com o mesmo padrão. O P08 não toca o `ListEditor`.
- **Sem regressão do P06:** o `onKeyDownCapture` do Esc (l.157-165), o fundo `aria-hidden` (l.167-184), a devolução do foco (l.107-138) e a API ficam iguais. Só o `behavior` muda, e só no nativo.

**Usos que herdam** (26 `<BottomSheet>` em 22 arquivos). Para a conferência no Android:

- os com campo de texto: `TextEditorRow`, `ListEditor` (Adicionar Dom/Qualidade/Disciplina e o editor do item), `SpecialtyEditor`, `XpSheets`, `CreationPanel` (Devolver), `StorytellerBar` (Notas do Narrador), `InviteSheet`, `DeleteChronicleSheet` (nome digitado) e `MemberSheets`;
- os outros só precisam continuar iguais: `ModeBar` (resumo), `StatusMenu`, `HistorySheet`, `ExperienceSheet`, `DiceSheet`, `FieldSheet`, `Suggestions`, `ChoiceEditorRow`, `ConflictSheet`, `DraftRecovery`, `LogoutButton`, `UnsavedChangesGuard` e `OperationSheet`.

### 3.4 T-69: folha central no desktop

**O que muda (DS: "a partir de 600 vira modal centralizado de até 560").** A `BottomSheet` lê `useLayout().breakpoint`. Fora do `compact`:

- a raiz centraliza (`justifyContent` e `alignItems: 'center'`, `padding: tokens.space[6]`);
- a folha ganha `width: '100%'`, `maxWidth: 560`, `maxHeight: '85%'`, `borderRadius: tokens.radius.lg` nos quatro cantos e `paddingBottom: tokens.space[5]`, sem o `insets.bottom`, que só vale para a folha presa embaixo;
- a animação passa a `fade`. Com "reduzir movimento", continua `none`.

No `compact`, nada muda. **Sem regressão do T-71:** o Esc é tratado na captura da raiz, independente da animação, e o `onDismiss` do react-native-web dispara também no `fade`. O `a11y-keyboard.spec.ts` roda a 1280 (viewport padrão do Playwright) e passa a provar o T-71 na folha central. Um caso novo a 390 cobre a folha de baixo (seção 4.3).

### 3.5 T-26: campo focado à vista e "Próximo" entre campos

**O que muda**

- **Telas com formulário:** o `KeyboardAvoidingView` só-iOS de `login.tsx:43-46`, `register.tsx:54-57`, `join.tsx:40-43`, `chronicles/new.tsx:63-66` e `new-character.tsx:135-138` vira `KeyboardArea`. A matriz achava o `KeyboardAvoidingView` só em `join` e `chronicles/new`; ele está nas cinco, todas só no iOS.
- **Ficha:** no `SheetView` (`:170-224`), a rolagem fica dentro de um `KeyboardArea`. A `ModeBar`, o `CombatDock` e a `BonusNotice` ficam fora dele, então só a rolagem encolhe, e as barras de baixo ficam atrás do teclado enquanto ele está aberto. Pega o campo do "Digitar" (`NumberEditorRow.tsx:185-213`), a busca das Habilidades (`GroupsLayout.tsx:196-212`) e os campos de Bastidores.
- **"Próximo":**
  - **Login:** o e-mail ganha `returnKeyType="next"`, `submitBehavior="submit"` (no web, `blurOnSubmit={false}`) e `onSubmitEditing` que foca a senha. A senha continua enviando (`login.tsx:87`).
  - **Cadastro:** e-mail → usuário → senha, a senha com `returnKeyType="go"` e `onSubmitEditing={submit}`.
  - **Nova ficha e Novo NPC** (`CharacterForm.tsx:95-121`): cada campo de texto aponta o seguinte na ordem de `rowsOf` (l.30-42). Os campos de escolha (o Clã) ficam fora da cadeia. O último fica com `returnKeyType="done"` **sem** enviar: criar a ficha continua sendo ação explícita.
- **`ref` no `TextField`** (`@tms/ui`): `TextFieldProps` ganha `ref?: Ref<TextInput>` (prop comum no React 19.3), repassado ao `TextInput`. O `TextEditor` recebe o `ref` por `EditorProps.inputRef?: Ref<TextInput>` (`editors/types.ts:7-17`). **O P05-C (T-21: rolar e focar o primeiro campo com erro) precisa do mesmo `ref`.** Como ele entra antes, o P08 reaproveita o que ele criar e só acrescenta o encadeamento (seção 8.4).
- **Fica de fora:** o "Próximo" entre os campos da folha de item do `ListEditor` (Nome → Especialização → Notas). O arquivo é do P07-C, e a matriz não cita esses campos.

### 3.6 T-67: títulos com a margem da página

**Causa confirmada.** O `SectionHeader` não tem recuo lateral (`SectionHeader.tsx:41-48`); quem o usa põe o invólucro (`CharacterList.tsx:164-169`, `GroupsLayout.tsx:101`). Seis usos não põem:

- `chronicles/[id]/index.tsx:255` ("Participantes" e o "Convidar" à direita);
- `RollFeed.tsx:81`;
- `CampaignBackstage.tsx:84` ("Diário da crônica", também visto na onda 1, `onda-1.md` §9), `:303`, `:429` e `:535`.

**O que muda.** Cada um ganha `<View style={styles.header}>` com `paddingHorizontal: tokens.layout.gutter`, o padrão do `CharacterList`. A API do `SectionHeader` não muda: um recuo dentro dele quebraria os 14 usos que já têm invólucro.

### 3.7 T-65: identidade em 2 colunas quando 3 não cabem

**Causa (a matriz não indica).** No Editar e na Criação, o `IdentityBlock` desenha `identity.columns` do template em colunas de `flex: 1` com `minWidth: 0` (`IdentityBlock.tsx:68-80`, `:110`). Uma palavra mais larga que a coluna quebra no meio. A 393 dp, cada coluna do V20 tem (393 − 32 − 24) / 3 ≈ 112 dp, e "Comportamento" no `fieldLabel` (16/500) mede ~114. A 411 sobra (118), como a onda 1 viu.

**O que muda.** O número de colunas passa a depender da largura. A conta:

- `FACT_MIN = tokens.layout.minColWidth / 2` (120 dp) × `fontScale`;
- largura disponível = `min(largura da janela, contentMaxExpanded) − 2 × gutter`;
- colunas por linha = `max(1, floor((largura + gap) / (FACT_MIN + gap)))`, limitado ao número de colunas do template.

Quando cabem menos que o template pede, as colunas quebram em linhas (`flexWrap`, cada coluna com `width` de 1/n), **na ordem do template e sem misturar colunas**. A 360–411 dp, o V20 fica com [Nome | Natureza, Comportamento, Conceito] e, embaixo, [Clã, Geração, Senhor]. O W20 fica com [Nome, Nome de feito, Conceito, Seita | Raça, Augúrio, Acampamento] e, embaixo, [Tribo, Matilha, Totem]. Com fonte de 200%, fica uma coluna. O nome deixa de ficar espremido num terço da largura. O valor continua com `numberOfLines={2}` (`TextEditorRow.tsx:71`). Sem `identity.columns` (D&D, CoC), nada muda.

O limiar de 120 manda a 411 dp para 2 colunas, mesmo com "Comportamento" cabendo em 3. Medir o texto seria a alternativa (pergunta 5).

### 3.8 T-68: número dentro da célula; a barra não cobre a grade

**Causa confirmada (número).** A célula (`RatingViews.tsx:83-90`) põe os pips (`pipSizeSm` 12: 5 × 16 − 4 = 76 dp), um `gap` de 8 e o número (~10) numa linha, dentro de `padding: tokens.space[2]` (`:131-137`). A 390, a coluna tem (390 − 32 − 16) / 3 = 114 dp, ou 96 úteis; a 360, 86 úteis. Os 94 dp de conteúdo não cabem.

**O que muda (DS: "container ≤ 400: padding menor, pip 12").** Com a largura disponível da grade ≤ 400, o `GridLayout` passa por um contexto pequeno (`DenseCells`, no mesmo padrão do `CompactEditors`, `evolve/compact.ts`). A `RatingCell` usa então:

- `padding: tokens.space[1]`;
- `gap: tokens.space[1]` entre os pips e o número.

Conta a 360: 104 − 8 − 2 = 94 úteis, para 76 + 4 + 10 = 90. Abaixo de 360, o `stacked` (`layoutOf`) já transforma a grade em lista.

**"A barra 'Todos os recursos' cobre a última linha": não se confirma no código.** O `CombatDock` está no fluxo, irmão do `ScrollView` (`SheetView.tsx:220`), sem `position: absolute`. No print (`img/qa-app/134-jogo-android.webp`), a grade só continua abaixo da dobra, e a faixa amarela sobre o dock é o LogBox do build de debug. O que o código tem é o inset de baixo em dobro no dock (seção 3.1). A conferência no AVD (seção 7) rola até o fim e registra se a última linha fica à vista.

### 3.9 T-28: grupos lado a lado no desktop

**Causa confirmada.** O `GroupsLayout` sempre empilha os grupos (`:94-133`). O `GridLayout` faz colunas para os Atributos (`:68-92`), mas as Habilidades usam o `GroupsLayout`.

**O que muda (C-10).** No `expanded` (≥ 900), sem `stacked`, com mais de um grupo e cada coluna com pelo menos `tokens.layout.minColWidth` (240), o contêiner dos grupos vira linha com `flexWrap`. Cada grupo é uma coluna com `flexBasis: minColWidth`, `flexGrow: 1` e `minWidth: 0`, e mantém título e contador (`:100-109`). A busca e o "Mostrando N de M" ficam acima, na largura toda. Abaixo de 900, nada muda: no `medium`, o DS pede uma coluna de até 640.

A 1280, a aba Ficha das Habilidades cai para cerca de 1/3 da altura. O "Adicionar especialização" já é um link em `caption` (`SpecialtyEditor.tsx:31-53`) e não muda.

### 3.10 T-11: cabeçalho que cabe, menu "Mais opções" e o lugar do selo de estado

**Causa confirmada.** As ações da `AppBar` da ficha (`SheetScreen.tsx:174-206`) são o `SyncIndicator`, o `StatusMenuButton` (só para o narrador), "Experiência" (com extrato de XP no template) e "Histórico". No `compact`, o `StatusMenuButton` mostra um ⋯; fora dele, o gatilho largo "Narrador [estado] ▾" (`StatusMenu.tsx:138-149`). Somando as larguras de hoje:

- a 390, com "2 alterações não salvas": voltar 160 + sync ~170 + Experiência ~110 + Histórico ~95 + espaços ~40;
- a 750 (`medium`), com o gatilho largo: ~200 a mais.

Nas duas larguras não cabe. O "···" do narrador a 390 é o ⋯ de propósito do `compact`; o estado sob o nome é do P04-D.

**O que muda**

- **Até 900 px (`compact` e `medium`):** as ações viram **um** `IconButton` ⋯ "Mais opções" (o nome do DS). Ele abre a folha `SheetMenu` (arquivo novo `apps/frontend/sheet/SheetMenu.tsx`), com:
  1. para o narrador, quando há ação (`statusActions(...).length`): "Ações do narrador · {estado}". Abre o `StatusMenu` atual, que passa a ser exportado, sem mudar por dentro;
  2. "Experiência", quando `xpLedgerFields(model).length`, a condição de hoje (l.188);
  3. "Histórico".

  O item tocado fecha o menu e abre a folha dele no mesmo render, o mesmo padrão do `StatusMenu`, que troca a lista pela confirmação (`:235-256`). A pergunta 2 confere isso no iOS. O narrador passa a dar dois toques até as ações (hoje é um), e em troca vê o estado no item (pergunta 6).
- **A partir de 900 (`expanded`):** como hoje, com "Experiência", "Histórico" e o gatilho largo do narrador. O ramo `compact` do `StatusMenuButton` (`:138-146`) some: o botão só aparece no `expanded`.
- **O que encolhe:**
  - `AppBar.title` com `minWidth: 0` e uma linha;
  - `BackLink` com `maxWidth` 96 no `compact` (160 nos outros) e o rótulo truncado; o nome acessível continua "Voltar para {crônica}";
  - `SyncIndicator` com `maxWidth` 112 e até 2 linhas no `compact` ("2 alterações / não salvas"). O texto do T-17 não muda.
- **O lugar do selo de estado do P04-D (D-02, "sob o nome da ficha").** A `AppBar` ganha `subtitle?: ReactNode`, desenhado sob o título, na mesma coluna e numa linha. O título (24) e a legenda (18) cabem nos 48 do `headerHeight`. O P08 não passa nada. O P04-D passa o selo, e a mesma `AppBar` da lista e da Mesa pode recebê-lo. Largura da coluna do título com o desenho acima:

  | Largura | Com "Salvo" | Com "2 alterações não salvas" |
  |---|---|---|
  | 360 (Android, ⋯ 48) | ~120 dp | ~64 dp |
  | 390 (iOS, ⋯ 44) | ~150 dp | ~98 dp |
  | 411 (Android) | ~170 dp | ~115 dp |
  | 1280 | ~600 px | ~550 px |

  "Aguardando aprovação" (~140 dp) não cabe a 360 com alterações não salvas. O P04-D escolhe entre um rótulo curto no `compact` e o selo no `IdentityBlock`, sob o nome grande (`IdentityBlock.tsx:53-55`). A pergunta 8 propõe ganhar ~48 dp tirando o rótulo do voltar no `compact`.
- **Viewer** (ficha revelada, `state.status === 'viewer'`): sem menu, como hoje sem botões. O E2E passa a conferir que "Mais opções" também não aparece.

### 3.11 T-59: "Em jogo" recolhido na Criação

**O que muda.** Em `mode === 'create'`, o bloco do `SheetView.tsx:191-200` vira um cabeçalho que se toca: `Pressable` com papel `button`, rótulo "Em jogo", `aria-expanded` (no app, `accessibilityState.expanded`) e, no web, `aria-controls`. Ele começa recolhido; tocado, abre as mesmas `SectionView`. O estado é local (`useState`), não vai ao servidor nem ao armazenamento. Em Jogo, Leitura e Editar, nada muda. O dock do Jogo também não muda.

### 3.12 T-27: abas, sub-abas e contador fixos no celular; controles de modo rolam com a ficha

Medido nas notas: a área fixa no iPhone tem ~260–290 pt de 844–874. Com o T-37, saem 47–59 pt.

**Parte 1: controles de modo na rolagem (só no `compact`).** Hoje ficam fixos acima da rolagem:

- o painel do NPC (`NpcVisibilityBar`, `SheetScreen.tsx:395`), que no NPC ocupa ~450 pt;
- a barra do narrador (`StorytellerBar`, `:399`);
- o seletor de modo da `ModeBar` (`ModeSwitch`, `ModeBar.tsx:229-277`).

No `compact`, os três passam ao topo do conteúdo da rolagem. A barra de ação ("Criação · N alterações" e o botão, `EvolveBar`, `:279-328`) continua fixa: é onde se salva e conclui (D-01, D-03). Para separar as duas partes da `ModeBar` sem duplicar estado:

- a lógica de `ModeBar` (l.57-179: `go`, `review`, `save`, `discard` e o estado do resumo) vira o hook `useModeBar()`;
- ele devolve `{ switcher, actionBar, summary }`;
- `ModeBar` continua exportado e monta os três juntos, como hoje, fora do `compact`;
- no `compact`, o `SheetView` põe o `switcher` na rolagem e o `actionBar` fixo.

O `SummarySheet` (l.330+) e o texto da confirmação **não mudam aqui**: são do P04-C (T-32) e do P05-C (T-18). O `SheetView` ganha `header?: ReactNode`, por onde o `LiveSheet` passa o painel do NPC e a barra do narrador. Fora do `compact`, o `header` fica fixo acima, como hoje. O `TableNav` (Anterior/Próxima do narrador) continua fixo: é a navegação da revisão.

**Parte 2: faixa de navegação fixa.**

- O `ScrollView` do `SheetView` monta os filhos num array sem nulos (o `stickyHeaderIndices` conta posições) e marca um filho, `SheetNav`, como fixo. Ele leva:
  - as abas da zona ("Partes da ficha"), em todos os tamanhos;
  - no `compact`, as sub-abas e a linha do contador (`CreationCounter line`, com a prioridade 7·5·3) **da seção com grupos que está no topo da tela**.
- A escolha do grupo sai do `useState` do `useGroupTabs` (`groupTabs.tsx:26`) para um contexto por ficha (`GroupTabsContext`, arquivo novo `sheet/layouts/groupTabsState.ts`), com o grupo escolhido por seção e a seção atual.
  - O `useGroupTabs` lê e grava ali quando há provedor. Sem provedor (prévias e testes), fica com o estado local de hoje.
  - Com a faixa ativa, ele devolve `bar: null`, e o corpo continua filtrando pelo grupo escolhido, com `tabPanelProps` (o `aria-controls` das sub-abas aponta para o painel no corpo).
- **Qual seção está no topo:** cada `SectionView` com `groupTabs` informa o próprio `y` (`onLayout`, somado ao `y` do `TabPanel`). O `onScroll` do `SheetView` (`scrollEventThrottle={16}`) escolhe a última seção com `y ≤ rolagem + altura da faixa`. No topo da zona, vale a primeira.
- **No V20:** perto dos Atributos, a faixa mostra Físicos | Sociais | Mentais e o contador; ao chegar nas Habilidades, Talentos | Perícias | Conhecimentos. "Orçamento" fica sempre a um toque.
- **Leitor de tela e teclado:** a faixa vem antes do conteúdo; as sub-abas mantêm `id`, "aba N de M" e as setas do P06. Sem região viva: a troca da seção atual não é anunciada.

**Resultado esperado no iPhone de 844 pt, Criação, jogador:**

- fixos: inset (~47), cabeçalho (48), barra de ação (~64) e, depois de rolar até as abas, a faixa (~44 + ~40 + ~44);
- ficha visível: cerca de 470–560 pt, contra ~550 hoje, só que com abas, sub-abas e contador sempre à vista;
- no NPC, de ~250 pt para a mesma faixa do jogador.

### 3.13 Botões de "ficar" nas folhas (achado visual da onda 1, fora da matriz)

O aviso de "Sair" usa `Button` `secondary` ("Continuar conectado", `LogoutButton.tsx:101-102`), e a guarda de saída usa `ghost` ("Continuar editando", `UnsavedChangesGuard.tsx:52-53`). **Não entra no P08:** não é layout nem teclado, e a D-01 (P03-D, onda 3) refaz o rodapé do "Sair sem salvar?" com "Salvar e sair". Fica como nota para o P03-D alinhar as duas folhas no mesmo padrão.

### 3.14 API pública do `@tms/ui`: o que muda

Nenhuma prop sai. Lição da onda 1: o `src` do `@tms/ui` compila no app com o JSX do React (`apps/frontend/babel.config.js:8-24`, `test/babel-config.test.ts`). Defeito de estilo em função só aparece no nativo, por isso toda mudança abaixo passa pelo aparelho (seção 7).

| Componente | Mudança | Compatibilidade |
|---|---|---|
| `AppBar` | Sem `insets.top`; `subtitle?: ReactNode`; título que encolhe; `BackLink` com `maxWidth` 96 no `compact` | Os 9 usos: a faixa vazia some; `subtitle` é novo |
| `Screen` | Nenhuma (continua a única fonte do inset) | — |
| `BottomSheet` | `behavior` `padding` também no Android; central a partir de 600 (`maxWidth` 560, `fade`) | API igual; os 26 usos herdam |
| `TextField` | `ref?: Ref<TextInput>`; linha da dica com `gap`, dica `flex: 1`, contador sem encolher | Os usos atuais não passam `ref` |
| `keyboard.tsx` (novo) | `keyboardBehavior()` e `KeyboardArea` | Novo, exportado no `index.ts` |

Cada commit atualiza a seção do componente em `design/design-system/components.md` (AppBar / BackLink l.705-715, BottomSheet l.613-626, TextField l.244) e o CharacterHeader (l.487-497) com o limiar de 900.

---

## 4. Testes

### 4.1 Um teste de regressão por bug (falha antes, passa depois)

| Item | O que o teste prova | Arquivo | Tipo |
|---|---|---|---|
| T-37 | Com `SafeAreaInsetsContext` (`top: 47`, `bottom: 34`): `Screen` com `paddingTop` 47, `AppBar` sem `paddingTop`; `CombatDock` sem os 34 | `packages/ui/src/layout.test.tsx` (novo); `sheet/play/__tests__/play.test.tsx` | Jest + RNTL |
| T-64 | Com dica e `maxLength`: contador com `flexShrink: 0`, dica com `flex: 1`, linha com `gap`; sem dica, como antes | `layout.test.tsx` | Jest + RNTL |
| T-10 | `Platform.OS` `android` e `ios`: raiz da folha com `behavior` `padding`; `web`: sem `behavior`. `keyboardBehavior()` nos três | `layout.test.tsx` | Jest + RNTL |
| T-10 | `TextEditorRow` (Conceito): `submitEditing` aplica e fecha; no `longText`, não | `sheet/evolve/__tests__/evolve.layout.test.tsx` (novo) | Jest + RNTL |
| T-69 | `Dimensions` 1280: raiz centralizada, folha com `maxWidth` 560 e `animationType` `fade`; a 390, presa embaixo com `slide`; o Esc no web continua fechando nos dois | `layout.test.tsx` | Jest + RNTL |
| T-69 | A 1280, "Convidar" abre um diálogo de até 560 px, centralizado (`boundingBox`); Esc fecha e o foco volta ao "Convidar" | `e2e/tests/layout.spec.ts` (novo) | Playwright |
| T-26 | `KeyboardArea` nas cinco telas (`behavior` `padding` no Android); `submitEditing` no e-mail foca a senha (login) e passa por e-mail → usuário → senha (cadastro); na Nova ficha do W20, cada campo de texto foca o seguinte e o último não envia | `app/__tests__/app.layout.test.tsx` (novo); `sheet/__tests__/sheet.layout.test.tsx` (novo) | Jest + RNTL |
| T-26 | Web: Enter no e-mail do login leva o foco à senha (`toBeFocused`) | `layout.spec.ts` | Playwright |
| T-67 | Os seis títulos dentro de um invólucro com `paddingHorizontal` 16 | `components/chronicles/__tests__/chronicles.layout.test.tsx` (novo) | Jest + RNTL |
| T-67 | A 390: "Participantes", "Rolagens da mesa" e "Diário da crônica" com `x ≥ 16`; "Convidar" com borda direita ≤ 374 | `layout.spec.ts` | Playwright |
| T-65 | `Dimensions` 393 e 360: `identity-columns` com 2 colunas por linha e os campos na ordem do template; 1280: 3; `fontScale` 2: 1. W20 com a primeira coluna de 4 campos | `sheet/__tests__/sheet.layout.test.tsx` | Jest + RNTL |
| T-65 | A 390, no Editar: o rótulo "Comportamento" numa linha só (altura do `boundingBox` < 1,5 × 22) | `layout.spec.ts` | Playwright |
| T-68 | `Dimensions` 360: célula com `padding` 4 e `gap` 4; 1280: como hoje | `sheet/layouts/__tests__/layouts.test.tsx` | Jest + RNTL |
| T-28 | `Dimensions` 1280, Editar: os três grupos das Habilidades na mesma linha (contêiner `row` com `flexWrap`); 750 e 390: empilhados | `layouts.test.tsx` | Jest + RNTL |
| T-28 | A 1280, no Editar: os títulos "Talentos", "Perícias" e "Conhecimentos" com o mesmo `y` (± 4 px) e `x` crescentes | `layout.spec.ts` | Playwright |
| T-11 | `PHONE` (390) e `TABLET` (750): um "Mais opções" e nenhum "Experiência"/"Histórico" no cabeçalho; o menu tem os dois e, para o narrador, "Ações do narrador · Em criação", que abre as ações. 1280: botões como hoje. Viewer: sem menu. `AppBar` com `subtitle` desenha sob o título | `sheet/__tests__/sheet.layout.test.tsx`; `layout.test.tsx` | Jest + RNTL |
| T-11 | A 390 e a 360, jogador (Criação por pontos, com uma alteração não salva) e narrador na ficha do jogador: `document.documentElement.scrollWidth − clientWidth ≤ 0`; "Mais opções" dentro da viewport; "Histórico" abre pelo menu | `layout.spec.ts` | Playwright |
| T-59 | Criação: "Em jogo" com `aria-expanded` falso e sem "Vitalidade"; um toque mostra; Jogo e Editar: aberto como hoje | `sheet.layout.test.tsx` | Jest + RNTL |
| T-27 | `PHONE`, Criação: `stickyHeaderIndices` aponta a faixa; com `layout` e `scroll` simulados, a faixa mostra "Grupos de Atributos" no topo e "Grupos de Habilidades" depois do `y` delas; trocar a sub-aba na faixa filtra o corpo; `ModeSwitch`, `StorytellerBar` e painel do NPC dentro da rolagem; `TABLET`: fixos como hoje | `sheet.layout.test.tsx` | Jest + RNTL |
| T-27 | A 390, Criação: rolar até "Perícias" e tocar "Orçamento" sem rolar para cima; a faixa com `tablist` "Partes da ficha", "Grupos de Habilidades" e `counter-talents` dentro da viewport | `layout.spec.ts` | Playwright |

### 4.2 Testes existentes que mudam junto

| Arquivo | O quê | Por quê |
|---|---|---|
| `apps/frontend/sheet/__tests__/policy.test.tsx` | l.263-265, l.284-303, l.322-325: a 390 o caminho é "Mais opções" → "Ações do narrador · …" → ação; l.305-316 ("tela larga") passa de `TABLET` (750) para 1280 | T-11 (o limiar de 900). O P04-C mexe no mesmo arquivo (T-32, confirmação do "Concluir criação"); o P08 entra depois e refaz os caminhos sobre o dele |
| `apps/frontend/sheet/__tests__/storyteller.test.tsx` | l.204, l.237, l.263, l.280, l.291: "Histórico" passa pelo menu. Sem `Dimensions`, o mock do RN fica em 750 (`medium`) | T-11 |
| `apps/frontend/sheet/layouts/__tests__/layouts.test.tsx` | l.104-160: as sub-abas no `compact` saem do corpo quando há a faixa (com provedor); os casos sem provedor ficam | T-27 |
| `e2e/tests/journey.spec.ts` | l.236 (`page`, 390): "Mais opções" e depois "Histórico". A l.223 (`st`, 1280) fica | T-11 |
| `e2e/tests/journey-backstage.spec.ts` | l.296-301: também `getByRole('button', { name: 'Mais opções' })` com contagem 0 para o viewer | T-11 |
| `e2e/tests/a11y-keyboard.spec.ts` | Nada muda a 1280 (folha central). Caso novo: o mesmo Esc e foco a 390 | T-69 sem regressão do T-71 |
| `e2e/tests/lifecycle.spec.ts` (novo no P04-C) | A 390, o narrador chega a "Ações do narrador" pelo "Mais opções", e a dona chega a "Histórico" pelo mesmo menu. Achado da consolidação ([onda-2.md](onda-2.md) §4.5): o spec do P04-C toca os dois direto no cabeçalho | T-11 |

Ficam verdes sem mudança:

- `e2e/tests/table.spec.ts` (l.104, l.116: viewport padrão de 1280, botões inline);
- `journey-storyteller.spec.ts` (o gatilho `/^Narrador/` na página de 1280);
- `components.test.tsx` (AppBar l.836-851; BottomSheet l.495-533 e pilha l.613-618);
- `a11y.test.tsx` (T-71, l.539-772);
- `test/babel-config.test.ts`.

### 4.3 E2E novo: `e2e/tests/layout.spec.ts` (Chromium e WebKit)

Contas por `signUp` e crônica por `apiAs` (só dados fictícios). Crônica `vtm-v20` em criação por pontos, que é o padrão. Seletores exatos:

- **Cabeçalho:** `getByRole('button', { name: 'Mais opções' })`, `getByRole('heading', { name: 'Mais opções' })`, `getByRole('button', { name: 'Histórico', exact: true })`, `getByRole('button', { name: 'Experiência', exact: true })`, `getByRole('button', { name: /^Ações do narrador/ })`.
- **Rolagem lateral:** `expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)`, a 390 e a 360, no jogador e no narrador.
- **Abas da ficha a 390:** `getByRole('tablist', { name: 'Partes da ficha' })`, `getByRole('tab', { name: 'Ficha', exact: true })`, `getByRole('tab', { name: 'Orçamento' })`, `getByRole('tablist', { name: 'Grupos de Habilidades' })`, `getByRole('tab', { name: 'Perícias' })`, `getByTestId('counter-talents')`. Visíveis: `boundingBox().y ≥ 0` e abaixo da barra de ação, depois de `scrollIntoViewIfNeeded` em `getByLabel('Buscar em Habilidades')`.
- **"Em jogo":** `getByRole('button', { name: 'Em jogo' })` com `aria-expanded="false"`.
- **Folha a 1280 e a 390:** `getByTestId('bottom-sheet-root')`; a folha pelo `getByRole('dialog').or(page.locator('[aria-modal]')).first()` (o mesmo do `a11y-keyboard.spec.ts:79`), `boundingBox().width ≤ 560` e centro a ± 2 px do centro da viewport.
- **Crônica:** `getByRole('heading', { name: 'Participantes' })`, `getByRole('button', { name: 'Convidar' })`, aba `getByRole('tab', { name: 'Bastidores' })` e `getByRole('heading', { name: 'Diário da crônica' })`.

O WebKit precisa confirmar o `position: sticky` do react-native-web dentro do contêiner de rolagem (pergunta 10).

### 4.4 Suítes do "PR local" e cobertura

```bash
npx pnpm turbo run typecheck lint --filter=@tms/ui --filter=frontend --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=@tms/ui --filter=frontend
```

- **Metas que o CI aplica:**
  - `packages/ui/jest.config.js:8-10`: 80% em tudo;
  - `apps/frontend/jest.config.js:35-38`: 70/70/60/70 no global e 80/80/70/80 em `./sheet/`.

  Lição da onda 1: tratar como meta **por arquivo**. O `keyboard.tsx`, os ramos `android`/`ios`/`web` da `BottomSheet`, o `SheetMenu.tsx`, o `groupTabsState.ts` e os ramos novos do `SheetView`, `GroupsLayout`, `GridLayout` e `IdentityBlock` levam casos próprios, com `Platform.OS` e `Dimensions` trocados no teste, como o P06 fez.
- **Na integração da onda** (portas fixas, um por vez): o E2E inteiro em Chromium e WebKit, com o `layout.spec.ts`, e o build nativo (D-00).
- **Sem mudança:** `@tms/sheet-core`, `@tms/api` e `@tms/db` (nada a rodar).

---

## 5. Segurança

O pacote não muda API, AuthZ, armazenamento nem dependência (salvo a pergunta 1). Ameaças e como o desenho as evita:

| O que pode dar errado | Como o desenho evita |
|---|---|
| Ações do narrador aparecerem para o jogador no menu novo | O item "Ações do narrador" usa a mesma condição de hoje: papel `storyteller` e `statusActions(...)` não vazio (`StatusMenu.tsx:133-134`). O servidor continua a autoridade (`/creation/complete`, `/lock`, `/status`), sem mudança. O `policy.test.tsx` cobre o dono sem o item |
| A ficha revelada (viewer) ganhar Histórico ou Experiência pelo menu | O menu só existe com `state.status === 'ready'`, como os botões de hoje. O `journey-backstage.spec.ts` confere a ausência de "Mais opções", e as rotas `/history` e `/xp-ledger` continuam com 404 para ele (l.302-310) |
| O painel do NPC (visibilidade e retrato) mudar de comportamento ao rolar com a ficha | Só muda de lugar no `compact`. `clientCommandId`, revisão e validação do retrato (HTTPS no servidor) ficam iguais |
| "Próximo" ou Enter enviarem algo sem querer | Login: só a senha envia, como hoje. Nova ficha: o último campo não envia. Folha de texto: Enter só aplica no campo de uma linha, e o valor vai para o rascunho (`set`), que o `applyBatch` e o servidor validam |
| O `ref` novo do `TextField` expor o valor do campo de senha | O `ref` dá só `focus()`. O `secureTextEntry`, o `autoComplete` e o `autoCorrect={false}` do T-38 continuam |
| A folha central perder o foco preso ou o Esc | `aria-modal`, o Esc na captura e a devolução do foco não mudam; o `a11y-keyboard.spec.ts` passa a rodar na folha central |
| Dependência nova para o teclado (só se a pergunta 1 pedir) | Versão fixa do `bundledNativeModules.json` do SDK 58, `pnpm audit` e `check:native` no PR. Biblioteca sem rede nem permissão. Sem ela, o plano não acrescenta dependência |
| Dado pessoal em teste ou captura | E2E e conferência só com contas do `signUp` e do seed do roteiro (fictícias). Capturas sem e-mail nem token |

O `/security-review` não é obrigatório para o P08 (matriz, "Como executar" passo 4). Recomendo rodá-lo só se a pergunta 1 trouxer a dependência nova.

---

## 6. Como generaliza além do WoD

- **Cabeçalho e menu:** são do esqueleto da ficha. O menu lista o que o template e o papel liberam: "Experiência" aparece só com extrato de XP no template (o D&D e o CoC não têm; o menu fica com "Histórico"). As ações de sistema do C-20 ("Descanso longo") entram no mesmo menu depois.
- **Faixa fixa:** as abas saem das zonas que todo template declara (Ficha · Poderes · Itens e notas no D&D; Ficha · Equipamento · Histórico no CoC). As sub-abas saem de `groupTabs`, que qualquer template pode ligar (as perícias do D&D por atributo, por exemplo). O contador é o da conta do template.
- **Identidade em colunas:** vem de `identity.columns`. V20, M20 e W20 têm formatos diferentes (o W20 com 4 campos na primeira coluna), e a quebra preserva cada coluna. Sem `columns`, nada muda.
- **Grade densa:** os 6 atributos do D&D e as 8 características do CoC (`percent`) usam a mesma célula.
- **Colunas no desktop:** dependem só do número de grupos e do `minColWidth`.
- **Teclado, safe area, folha central e margens:** são da plataforma, não do sistema.

---

## 7. Critério de pronto

Os passos do "PR local" da matriz (l.67-73):

1. **Plano aprovado:** este documento, com arquivos e linhas conferidos no `9f75426` (seção 3) e a seção 2.
2. **Typecheck, lint e testes** de `@tms/ui`, `frontend` e `@tms/e2e` (seção 4.4), com as metas de cobertura.
3. **Um teste de regressão por bug** (seção 4.1).
4. **`/code-review` no diff do pacote.** `/security-review` só com a dependência da pergunta 1.
5. **Os cenários das personas, repetidos sem o defeito:**

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | T-10 | QA-A, QAA-04 (`qa-app.md`), Android: ficha → Conceito → digitar; Vantagens → Adicionar Qualidade → digitar; Conceder XP; Devolver | Campo e botão de ação acima do teclado; "✓" aplica no Conceito |
   | T-10 | E-A, EA-02 (`experiente-app.md`), Android: Fraqueza do clã; Adicionar Dom (W20) | Folha acima do teclado; "Aplicar" visível |
   | T-11 | QA-W, QAW-18 (`qa-web.md`), 390: abrir qualquer ficha | Sem rolagem lateral; "Histórico" no "Mais opções" |
   | T-11 | PO-A, POA-07 (`po-app.md`), iPhone de 440 pt, como narrador: ficha de um jogador | "Histórico" e as ações do narrador pelo menu, com alvo inteiro |
   | T-11 | N-W, NW-27 (`narrador-web.md`), 390, como narrador | Estado no item "Ações do narrador · …" do menu (o selo sob o nome é do P04-D) |
   | T-26 | E-A, EA-11 e EA-29, Android: número de um atributo ("Digitar"); buscar "etiq" em Habilidades; Nova ficha do W20 até "Nome da matilha"; login | Campo à vista; "Próximo" encadeia; no login, ENTER no e-mail vai à senha |
   | T-27 | PO-A, POA-15 e POA-24, iOS: rolar até Habilidades e tocar "Orçamento"; abrir um NPC em Editar | "Orçamento" à vista sem voltar ao topo; o painel do NPC sai ao rolar |
   | T-27 | N-A, NA-24 (`narrador-app.md`), iOS: "Editar como narrador" e rolar | Barra do narrador rola com a ficha; abas e contador fixos |
   | T-28 | E-W, EW-11 (`experiente-web.md`), 1280: Editar → Habilidades | 3 colunas; a aba Ficha bem menor que ~4.700 px |
   | T-37 | PO-A, POA-46, e N-A, NA-14, iOS: qualquer tela logada | Cabeçalho logo abaixo da ilha |
   | T-59 | E-W, EW-28, e I-A, IA-30: abrir ficha em criação | "Em jogo" recolhido; Atributos na primeira dobra |
   | T-64 | QA-A, QAA-20; I-W, IW-19: cadastro; NPC (Retrato HTTPS) | Contador separado da dica e inteiro |
   | T-65 | QA-W, QAW-38; I-A, IA-15: Criação em 390 e no iPhone | "Comportamento" inteiro |
   | T-67 | QA-W, QAW-15; N-W, NW-13: crônica e Bastidores em 390 | Títulos a 16 da borda; "Convidar" a 16 da direita |
   | T-68 | QA-A (diário 16:08), Android; I-W, IW-20, 390: ficha em Jogo, rolar até o fim | Número dentro da célula; última linha à vista acima do dock |
   | T-69 | N-W, NW-14, 1280: Convidar; E-W (tarefa 4): "Escolher da lista" da Natureza | Diálogo central de até 560; a lista perto do campo |

6. **Conferência no aparelho**, com a API local e o seed do roteiro (`npx pnpm seed:roteiro`, só contas fictícias). É o pacote mais visual da onda. O app nativo usa o `src` do `@tms/ui` com o JSX do React: confirmar que o menu, o subtítulo e a folha central têm fundo, padding e alvo no nativo.

   | Onde | O que conferir |
   |---|---|
   | AVD Android a 360, 393 e 411 dp (Pixel 3a com densidade ajustada; uma imagem API 34 e uma 36) | T-37 (sem faixa acima do cabeçalho; dock sem faixa dupla embaixo); T-11 com "2 alterações não salvas" e alvos de 48 dp, sem nada cortado a 360 (o caso registrado na onda 1); T-10 nas folhas da seção 3.3 (Conceito, Fraqueza, Adicionar Dom/Qualidade **com a frase de recusa do P07-C**, Conceder XP, Devolver); T-26 (Digitar, busca, Nova ficha do W20, login); T-27 (faixa fixa, troca da seção atual, NPC); T-65 a 360 e 393; T-68 a 360 e 393; T-64 no cadastro; T-67 |
   | Simulador iOS (iPhone de 402 e de 440 pt; SE de 375) | T-37; T-11 (menu, troca de folha no mesmo render, perguntas 2 e 6); T-10 no iOS sem regressão (a folha sobe uma vez só); T-27; VoiceOver em "Mais opções", no título da folha, em "Em jogo" (expandido ou recolhido) e nas sub-abas da faixa ("aba N de M") |
   | Web 390 | Tudo do `layout.spec.ts`, mais Esc e foco na folha de baixo |
   | Web 1280 | T-69 (diálogo central, Esc durante a animação, foco de volta); T-28; cabeçalho inline (gatilho largo do narrador) |

7. **Resumo para a seção do P08 no PR da onda:** o que mudou, como foi testado, os achados da revisão, a API nova do `@tms/ui` (seção 3.14) e as larguras do lugar do selo para o P04-D (seção 3.10).

---

## 8. Commits, esforço, riscos e conflitos

### 8.1 Ordem dos commits

Cada commit traz os próprios testes e a atualização do `components.md`. Primeiro o `@tms/ui`, depois as telas, e por último a faixa fixa, que é o de maior risco e sai sozinho.

| # | Commit | Itens | Esforço |
|---|---|---|---|
| 1 | `fix(ui): a safe area de cima e de baixo aplicada uma vez` (`AppBar`, `CombatDock`) | T-37 | P |
| 2 | `fix(ui): contador do campo sem colar na dica nem sair da tela` | T-64 | P |
| 3 | `fix(ui): a folha acompanha o teclado no Android; KeyboardArea compartilhado` (+ Enter aplica no `TextEditorRow`) | T-10 | P (M se a pergunta 1 pedir a biblioteca) |
| 4 | `fix(ui): folha como diálogo central a partir de 600` | T-69 | P |
| 5 | `fix(frontend): campo focado acima do teclado e "Próximo" entre campos` (`TextField` com `ref`; login, cadastro, Nova ficha; `KeyboardArea` nas telas e na ficha) | T-26 | P |
| 6 | `fix(frontend): títulos da crônica e dos Bastidores com a margem da página` | T-67 | P |
| 7 | `fix(frontend): identidade em duas colunas quando três não cabem` | T-65 | P |
| 8 | `fix(frontend): célula da grade com o número dentro em telas estreitas` | T-68 | P |
| 9 | `fix(frontend): grupos lado a lado no desktop` | T-28 | P |
| 10 | `fix(frontend): cabeçalho da ficha cabe na tela, com "Mais opções" e o lugar do estado` (`AppBar.subtitle`, `SheetMenu`, `StatusMenu` exportado) | T-11 | M |
| 11 | `fix(frontend): "Em jogo" recolhido na Criação` | T-59 | P |
| 12 | `fix(frontend): controles de modo rolam com a ficha no celular` (`useModeBar`, `SheetView.header`) | T-27 (parte 1) | M |
| 13 | `fix(frontend): abas, sub-abas e contador fixos no celular` (`SheetNav`, `GroupTabsContext`, seção atual) | T-27 (parte 2) | M |
| 14 | `test(e2e): layout a 360, 390 e 1280` (`layout.spec.ts` e os seletores das jornadas) | todos | P |

### 8.2 Esforço

**Total: G** (cerca de 10 a 13 dias), em 14 commits. A matriz soma 8 P e 4 M. Pesam:

- o T-27, nas duas partes: separar a `ModeBar` sem mexer na confirmação, a faixa com a seção atual e os testes com `layout` e `scroll` simulados;
- o T-11, com o menu, a troca de folha e o ajuste dos testes de política e do narrador;
- a conferência no aparelho em três larguras de Android, dois iPhones e duas larguras de web.

Sem os commits 12 e 13, o pacote fica em M (6 a 8 dias).

### 8.3 Riscos

- **Teclado dentro do `Modal` no Android (T-10).** Se o `keyboardDidShow` não chegar com a folha aberta (seção 3.0, pergunta 1), o `padding` não age. O commit 3 começa por essa conferência no AVD. As saídas: a biblioteca ou a folha de altura total (C-23).
- **Troca de folha no iOS (T-11).** A abertura de "Histórico" logo depois de fechar o menu tem precedente no `StatusMenu`, mas precisa do simulador (pergunta 2).
- **Faixa fixa (T-27).** Depende de `onLayout` e `onScroll`; com fonte grande ou seção que muda de altura (busca, filtro), a seção atual pode atrasar um quadro. O commit 13 é revertível sozinho: sem ele, ficam os controles de modo na rolagem (commit 12) e as abas como hoje.
- **Seletores dos testes.** O menu muda caminhos em `policy.test.tsx`, `storyteller.test.tsx` e duas jornadas E2E. O commit 10 os atualiza junto.
- **`src` do `@tms/ui` no nativo.** Quatro componentes do `@tms/ui` mudam (seção 3.14). O Jest e o web não pegam estilo perdido no nativo: a conferência no aparelho (passo 6) é obrigatória antes do merge.

### 8.4 Conflitos com os pacotes da onda (P04-C, P05-C, P07-C)

Ordem de merge preliminar: **P04-C → P05-C → P07-C → P08**. O código confirma o P08 por último, como o P06 na onda 1: é o pacote com mais arquivos e o que reorganiza o `SheetView` e a `ModeBar`, onde os outros mexem em lógica e texto. Ele faz rebase sobre os três.

| Arquivo | P08 | Outro pacote | Risco e como integrar |
|---|---|---|---|
| `apps/frontend/sheet/SheetView.tsx` | T-27 e T-59: filhos da rolagem em array, faixa fixa, `header`, `KeyboardArea` (l.166-224) | P04-C T-06 (banner da devolução em qualquer modo, provavelmente aqui ou no `CreationStatusPanel`, l.178); P05-C (avisos da Criação, l.179 e l.221) | **Alto.** O P08 entra por último e põe os elementos novos dos outros no array, na mesma ordem. Conferir o arquivo inteiro depois do rebase |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | T-27: lógica (l.57-179) num hook, JSX (l.180-226) em três peças | P04-C T-32 e P05-C T-18 (confirmação no `SummarySheet`, l.330+, e o texto da barra, l.183-209) | **Alto.** O P08 não toca o `SummarySheet` nem os textos: só move. No rebase, a extração vai sobre o código deles |
| `apps/frontend/sheet/SheetScreen.tsx` | T-11 (ações da `AppBar`, l.170-207); T-27 (painel do NPC e barra do narrador no `header` do `SheetView`, l.393-401) | P04-C: T-05 (modo de abertura, `LiveSheet`, l.304-327) e T-32 (props novas do `StatusMenuButton`: `revision`, `sheetVersion`, `unsaved`, l.180-188; o `onUnsaved` vira `onDraftState`, l.336-344). P05-C: `freebiesLeft` no `onDraftState` | **Médio**. O `SheetMenu` repassa ao `StatusMenu` as mesmas props que o P04-C e o P05-C derem ao `StatusMenuButton` ([onda-2.md](onda-2.md) §4.4) |
| `apps/frontend/sheet/storyteller/StatusMenu.tsx` | T-11: `StatusMenuButton` (l.118-160) sem o ramo `compact`; `StatusMenu` exportado (l.195) | P04-C T-32: confirmação do "Concluir criação" (`statusActions`, l.74-81, e o `asking`, l.235-256) | Baixo: o P08 usa o `StatusMenu` como unidade, e a confirmação nova vem junto |
| `apps/frontend/sheet/__tests__/policy.test.tsx` | Caminhos do menu (seção 4.2) | P04-C T-32 (l.284-298) | Médio. O P08 refaz os caminhos sobre os casos do P04-C |
| `apps/frontend/sheet/CharacterForm.tsx` | T-26: cadeia de foco (l.95-121) | P05-C T-21: rolar e focar o primeiro erro (`ref` nos editores) | **Médio.** Acordo: o P05-C cria o `ref` (`TextField.ref` e `EditorProps.inputRef`); o P08 só encadeia. Se o P05-C fizer de outro jeito, o P08 acrescenta o `ref` no rebase |
| `packages/ui/src/TextField.tsx`, `apps/frontend/sheet/editors/types.ts`, `editors/TextEditor.tsx` | T-26 (`ref`), T-64 (linha da dica) | P05-C T-21 (mesmo `ref`) | Médio: mesmo acordo |
| `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx` | T-26: só o `KeyboardAvoidingView` (l.135-140) | P04-C T-29 (texto do topo, l.86-90); P05-C T-21 (`ref` do `ScrollView`, l.83) | Baixo: linhas diferentes |
| `apps/frontend/sheet/layouts/GroupsLayout.tsx` | T-28 (contêiner dos grupos, l.94-133); T-27 (barra, l.59-68) | P07-C T-58 (título e contador do grupo, l.100-109; provedor `HeadedList`, l.110-122) | Médio. O P08 põe cada grupo, já com a regra do título do P07-C, numa coluna |
| `apps/frontend/sheet/SectionView.tsx` | T-27: `onLayout` no contêiner (l.23) | P07-C T-58: `titled` e `items` no contador (l.24-32) | Baixo |
| `apps/frontend/sheet/layouts/__tests__/layouts.test.tsx` | T-28, T-68, T-27 | P07-C T-58 (casos depois da l.303) | Baixo: casos separados |
| `apps/frontend/sheet/creation/CreationCounter.tsx` | Não muda; a faixa o reusa | P05-C (R-28, aviso da prioridade automática); P07-C T-58 (`items`) | Indireto: o que eles mudarem aparece também na faixa. Conferir a faixa com o aviso da R-28 |
| `packages/ui/src/BottomSheet.tsx` | T-10, T-69 | P07-C não muda (a frase vai no `children`, plano do P07-C §3.1) | Baixo |
| `apps/frontend/sheet/evolve/ListEditor.tsx` | Não muda | P07-C (T-19, T-23, T-62) | Nenhum. Na conferência do T-10, as folhas dele com a frase de recusa |
| `packages/ui/src/Stepper.tsx` | Não muda | P05-C T-20 | Nenhum |

**De propósito, o P08 não toca:** `CreationPanel.tsx`, `ListEditor.tsx`, `Stepper.tsx`, o `SummarySheet` e os textos da `ModeBar`, e `usePriorityChoice.ts`.

**Para as ondas seguintes:**

- **P04-D:** recebe o lugar do selo (`AppBar.subtitle`) e as larguras da seção 3.10;
- **P03-D:** a barra de ação fixa com dois botões, e os botões de "ficar" (seção 3.13);
- **P11:** volta ao painel do NPC (agora no `header` do `SheetView`) e ao `CampaignBackstage` (títulos com invólucro);
- **P09-D:** as abas da crônica (D-10) não mudam aqui.

### 8.5 Arquivos tocados

| Arquivo | Itens | Tipo de mudança |
|---|---|---|
| `packages/ui/src/AppBar.tsx` | T-37, T-11 | alterado (sem inset; `subtitle`; título e voltar que encolhem) |
| `packages/ui/src/BottomSheet.tsx` | T-10, T-69 | alterado (`behavior`; central a partir de 600) |
| `packages/ui/src/TextField.tsx` | T-64, T-26 | alterado (linha da dica; `ref`) |
| `packages/ui/src/keyboard.tsx` | T-10, T-26 | novo (`keyboardBehavior`, `KeyboardArea`) |
| `packages/ui/src/index.ts` | T-10 | alterado (exportação) |
| `packages/ui/src/layout.test.tsx` | T-37, T-64, T-10, T-69, T-11 | teste novo |
| `design/design-system/components.md` | T-37, T-10, T-69, T-64, T-11 | doc (AppBar, BottomSheet, TextField, CharacterHeader) |
| `apps/frontend/sheet/SheetScreen.tsx` | T-11, T-27 | alterado (ações da `AppBar`; `header` do `SheetView`) |
| `apps/frontend/sheet/SheetMenu.tsx` | T-11 | novo (menu "Mais opções") |
| `apps/frontend/sheet/storyteller/StatusMenu.tsx` | T-11 | alterado (sem o ramo `compact`; `StatusMenu` exportado) |
| `apps/frontend/sheet/sync/SyncIndicator.tsx` | T-11 | alterado (até 2 linhas e `maxWidth` no `compact`) |
| `apps/frontend/sheet/SheetView.tsx` | T-26, T-27, T-59 | alterado (`KeyboardArea`, faixa fixa, `header`, "Em jogo" recolhível) |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | T-27 | alterado (`useModeBar` e peças; `ModeBar` igual por fora) |
| `apps/frontend/sheet/layouts/groupTabsState.ts` | T-27 | novo (`GroupTabsContext`) |
| `apps/frontend/sheet/layouts/groupTabs.tsx` | T-27 | alterado (estado no contexto; barra na faixa) |
| `apps/frontend/sheet/layouts/GroupsLayout.tsx` | T-27, T-28 | alterado (barra; colunas no `expanded`) |
| `apps/frontend/sheet/layouts/GridLayout.tsx` | T-27, T-68 | alterado (barra; `DenseCells`) |
| `apps/frontend/sheet/SectionView.tsx` | T-27 | alterado (`onLayout` da seção) |
| `apps/frontend/sheet/views/RatingViews.tsx` | T-68 | alterado (célula densa) |
| `apps/frontend/sheet/IdentityBlock.tsx` | T-65 | alterado (colunas pela largura) |
| `apps/frontend/sheet/play/CombatDock.tsx` | T-37 | alterado (sem `insets.bottom`) |
| `apps/frontend/sheet/CharacterForm.tsx` | T-26 | alterado (cadeia de foco) |
| `apps/frontend/sheet/editors/types.ts`, `editors/TextEditor.tsx` | T-26 | alterado (`inputRef`, se o P05-C não o criar) |
| `apps/frontend/sheet/evolve/TextEditorRow.tsx` | T-10 | alterado (Enter aplica em uma linha) |
| `apps/frontend/app/(auth)/login.tsx`, `register.tsx` | T-26 | alterado (`KeyboardArea`, "Próximo") |
| `apps/frontend/app/(app)/join.tsx`, `chronicles/new.tsx`, `chronicles/[id]/new-character.tsx` | T-26 | alterado (`KeyboardArea`) |
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` | T-67 | alterado (invólucro do "Participantes") |
| `apps/frontend/components/chronicles/CampaignBackstage.tsx`, `RollFeed.tsx` | T-67 | alterado (invólucros) |
| `apps/frontend/sheet/__tests__/sheet.layout.test.tsx` | T-11, T-26, T-27, T-59, T-65 | teste novo |
| `apps/frontend/sheet/evolve/__tests__/evolve.layout.test.tsx` | T-10 | teste novo |
| `apps/frontend/app/__tests__/app.layout.test.tsx` | T-26 | teste novo |
| `apps/frontend/components/chronicles/__tests__/chronicles.layout.test.tsx` | T-67 | teste novo |
| `apps/frontend/sheet/layouts/__tests__/layouts.test.tsx` | T-27, T-28, T-68 | teste alterado |
| `apps/frontend/sheet/play/__tests__/play.test.tsx` | T-37 | teste alterado (dock) |
| `apps/frontend/sheet/__tests__/policy.test.tsx`, `storyteller.test.tsx` | T-11 | teste alterado (seção 4.2) |
| `e2e/tests/layout.spec.ts` | todos | E2E novo |
| `e2e/tests/journey.spec.ts`, `journey-backstage.spec.ts`, `a11y-keyboard.spec.ts`, `lifecycle.spec.ts` (do P04-C) | T-11, T-69 | E2E alterado |

---

## 9. Perguntas abertas (técnicas)

⚙ = resposta só no simulador ou no aparelho.

1. ⚙ **Teclado dentro do `Modal` no Android.** O `keyboardDidShow` vem do `ReactRootView` da Activity (insets do IME). Ele chega com o foco num campo da janela do `Modal` edge-to-edge? Se não chegar, há duas saídas:
   - o `react-native-keyboard-controller` 1.22.7 (versão do SDK 58; módulo nativo, dependência nova, build e `/security-review`), trocado só no `keyboard.tsx`;
   - a folha de altura total para editar texto (C-23).

   Responder no início do commit 3, no AVD API 34 e 36.
2. ⚙ **Troca de folha no mesmo render, no iOS** (menu → "Histórico", menu → "Ações do narrador"). O `StatusMenu` já troca a lista pela confirmação assim. Se o iOS não abrir a segunda, a `BottomSheet` ganha `onClosed` (do `onDismiss` no iOS e no web; no Android, logo depois de fechar). Ele roda depois da devolução do foco, para a folha seguinte ler o ⋯ como gatilho.
3. **Limiar do menu.** O plano usa ⋯ abaixo de 900 e botões a partir de 900. O DS desenha o header com o ⋯ em toda largura. Seguir o DS também no desktop muda o E2E de 1280 (`table.spec.ts`, `journey.spec.ts` l.223).
4. **Cabeçalho recolhível animado** (DS: some ao rolar para baixo e volta ao rolar para cima ou com foco). O plano faz os controles de modo rolarem com a ficha, sem animação. A versão animada (`Animated.diffClamp` e conteúdo fora da árvore quando recolhido) entra aqui ou depois?
5. **Identidade: limiar fixo ou medida?** 120 dp × `fontScale` por coluna manda a 411 dp para 2 colunas, mesmo com o V20 cabendo em 3. Medir o rótulo (`onTextLayout`) acerta a 411 e custa um render a mais.
6. **Narrador no celular: dois toques até as ações.** A alternativa é listar as ações dentro do "Mais opções". Para isso, a lógica do `StatusMenu` (`apply`, `asking`) sairia num hook, no mesmo trecho que o P04-C muda para o T-32. Fica para depois do P04-C?
7. **Dock sem o inset de baixo.** O fundo sob o dock passa a ser o da tela, como sob a `BonusNotice` hoje. Ou o `Screen` ganha `edges` (só em cima) para a ficha em Jogo, e o dock fica com o inset dele?
8. **Voltar só com "‹" no `compact`.** Ganha ~48 dp para o nome e o selo do P04-D (seção 3.10). O nome da crônica continua no nome acessível ("Voltar para …"), mas some da tela, e o DS pede chevron e nome.
9. **"Em jogo" no Editar também?** A matriz pede recolhido só na Criação. No Editar, o bloco tem os mesmos +/−.
10. **WebKit e `position: sticky`.** O react-native-web aplica o `sticky` no filho do contêiner de rolagem. Conferir no E2E WebKit; se falhar, a faixa usa a mesma técnica do nativo (cópia fixa por cima, com a original fora da árvore).

**Decisões e causas da matriz que o código mostra diferentes** (nenhuma D-xx é do P08):

- **T-37:** acontece também no Android (edge-to-edge), não só no iOS. O dock soma o inset de baixo de novo.
- **T-64:** a causa é o `TextField` do `@tms/ui`, não o `SheetScreen` nem o `validation.ts`. A correção vale para todo campo com dica e contador.
- **T-65:** a causa está no `IdentityBlock.tsx:68-80`, `:110` (a matriz diz "não indicado").
- **T-68:** a barra "Todos os recursos" não cobre a grade no código. O que se vê no print é o LogBox do build de debug; o defeito real do dock é o inset em dobro.
- **T-26:** o `KeyboardAvoidingView` está em cinco telas, todas só no iOS, não "só em `join` e `chronicles/new`".
- **T-11:** o "···" do narrador a 390 é o ⋯ do `compact`, de propósito. O estado sob o nome é a D-02 (P04-D); o P08 só reserva o lugar.
- **T-27:** "os elementos sob a barra seguem tocáveis na árvore" é o ScrollView expondo filhos cortados (seção 3.0), não defeito de código.
