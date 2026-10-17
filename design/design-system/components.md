# Catálogo de componentes · TMS Grimório

Catálogo de todos os componentes do core e da skin presentes em `components.css` e `ui.js`, mais os listados no §7 da avaliação (`doc/avaliacao-ui-ux.md`). Princípios, tokens e regras gerais estão no [`README.md`](README.md).

## Como ler

Cada componente traz:

- **Propósito**, em uma frase.
- **Classes** de `components.css` (`ds-*`). Classes `p-*` são do protótipo (`design/telas/prototipo.css`) e aparecem quando a peça ainda não foi promovida ao DS.
- **API RN:** props em TypeScript para `packages/ui`. **Toda API é proposta:** ainda não existe código React Native.
- **Estados** e **A11y** (web e RN): descrevem o que o protótipo já faz. O que ainda é só ideia está marcado como "proposta".
- **Multi-sistema:** exemplos em pelo menos dois sistemas.
- **Resolve:** achados da avaliação (`C-xx` no §4, `DS-xx` no Anexo A).

Tipos comuns usados nas APIs:

```ts
type SheetMode = 'read' | 'play' | 'evolve'             // Leitura, Jogo, Evoluir
type AccentName = 'accent-neutral' | `accent-${number}`   // só nomes da paleta validada
type ColorRole = 'accent' | 'alt-cool' | 'alt-warm' | 'neutral'
type Segment = { kind: 'on' | 'bonus' | 'lost' | 'off'; n: number }
type IconName = 'back' | 'more' | 'plus' | 'minus' | 'close' | 'undo' | 'dice' | 'search'
  | 'chevronDown' | 'chevronUp' | 'chevronRight' | 'edit' | 'history' | 'check' | 'alert'
  | 'cloudOff' | 'swap' | 'print' | 'archive' | 'trash' | 'theme' | 'users' | 'book' | 'user' | 'rest'
```

Regras que valem para todos: alvo tocável ≥ 44 com `.ds-pressable`; texto só por `textContent` (RN: `<Text>`); cor só de token; o accent chega por `data-accent="accent-N"` (RN: contexto do tema).

## Índice

| Grupo | Componentes |
|---|---|
| Fundamentos | [Pressable](#pressable-camada-de-estado) · [Icon](#icon) · [Card](#card) · [Utilitários](#utilitários-de-uijs) |
| Ações | [Button](#button) · [IconButton](#iconbutton) · [SegmentedControl](#segmentedcontrol) · [Chip](#chip) |
| Valores | [RatingDots](#ratingdots) · [NumberField](#numberfield) · [PercentField](#percentfield) · [MarkToggle](#marktoggle) · [Choice / StateChoice](#choice--statechoice) · [Tags / Tag](#tags--tag) · [TextField / TextArea / AspectField](#textfield--textarea--aspectfield) |
| Recursos | [Resource](#resource) · [Track / LeveledTrack](#track--leveledtrack) · [Slots](#slots) · [Clock](#clock) · [Stepper / ValueEditor](#stepper--valueeditor) |
| Ficha | [FieldRow](#fieldrow) · [Grid / Cell / Pyramid](#grid--cell--pyramid) · [SectionHeader](#sectionheader) · [SectionTabs](#sectiontabs) · [FilterBar / Search](#filterbar--search) · [CharacterHeader](#characterheader) · [IdentityBlock](#identityblock) · [IdentityChip](#identitychip) · [Avatar](#avatar) · [SyncIndicator](#syncindicator) · [ModeBar](#modebar) · [CombatDock / DockChip](#combatdock--dockchip) · [Repeater / ListEditor](#repeater--listeditor) |
| Feedback | [Toast](#toast) · [BottomSheet](#bottomsheet) · [ConfirmDialog](#confirmdialog) · [Banner](#banner) · [EmptyState](#emptystate) · [Skeleton](#skeleton) |
| Navegação e listas | [ListItem / CharacterCard / ChronicleCard](#listitem--charactercard--chroniclecard) · [TabBar](#tabbar) · [AppBar / BackLink](#appbar--backlink) · [Breadcrumb](#breadcrumb) |
| Dados | [DiceRoller](#diceroller) |
| Skin | [AugurMoon](#augurmoon-glifo-da-skin-wod) · [Forma do pip e glifos de dano](#forma-do-pip-e-glifos-de-dano-skin) |

---

## Fundamentos

### Pressable (camada de estado)

Dá feedback de hover e pressionado a qualquer alvo tocável sem trocar o fundo do componente.

- **Classes:** `ds-pressable`. O `::after` recebe `state-hover` só com `@media (hover: hover)` e `state-pressed` em `:active`; fica transparente com `disabled` ou `aria-disabled="true"`.
- **API RN:** `Pressable` com `style={({ pressed }) => pressed && { backgroundColor: t.color.statePressed }}`; `hitSlop` até 44 quando o visual for menor.
- **Estados:** normal, hover, pressionado, desabilitado.
- **A11y:** não muda a semântica: o elemento base continua `button` ou `a`.
- **Multi-sistema:** o mesmo feedback na linha de Destreza (WoD), no chip de PV (D&D) e na caixa de estresse (Fate).
- **Resolve:** C-14, DS-04.

### Icon

Ícones genéricos de traço, sem símbolo de sistema.

- **Classes:** `ds-icon` (24, `icon-size`), `ds-icon--sm` (18).
- **`ui.js`:** `icon(name, cls)` desenha SVG 24×24 com traço 2 em `currentColor`, `aria-hidden="true"` e `focusable="false"`. Nome desconhecido vira `more`. São 24 ícones (lista em `IconName`).
- **API RN:** `{ name: IconName; size?: 18 | 24; color?: string }` com `react-native-svg`. Lucide (ISC) é opção da avaliação.
- **A11y:** sempre decorativo; o rótulo fica no botão.
- **Multi-sistema:** nenhum símbolo de clã, classe ou ocupação; glifos de sistema ficam na skin (ver AugurMoon). O ícone `dice` serve a d10, d20, d100 e 4dF.
- **Resolve:** §7 (IconButton e ícones base), DS-16.

### Card

Superfície de bloco da ficha.

- **Classes:** `ds-card` (`surface`, borda `border-width-hair` em `border-subtle`, `elevation-1`, `radius-md`), `ds-card--pad` (12/16).
- **API RN:** `{ padded?: boolean; children: ReactNode }` com `boxShadow` do token e borda.
- **Estados:** estático.
- **A11y:** sem papel; o conteúdo define a semântica.
- **Multi-sistema:** envolve lista de Habilidades (WoD), de perícias (D&D, CoC) e de aspectos (Fate) do mesmo jeito.
- **Resolve:** C-14, DS-07 (superfícies separadas por borda + sombra, não só por cor).

### Utilitários de `ui.js`

- **Classes:** `sr-only` (texto só para leitor de tela), `ds-muted` (`ink-muted`), `ds-num` (`tabular-nums`).
- **`h(tag, props, ...children)` e `s(...)`:** criam DOM só com `textContent` e `setAttribute`. `vars` aceita só números (`--cols`), então string vinda do banco nunca vira estilo.
- **`announce(text)`:** live region `role="status"` + `aria-live="polite"`; esvazia e reescreve depois de 30 ms para repetir o mesmo anúncio.
- **`initials(name)`:** primeira e última inicial em maiúsculas; `?` se vazio.
- **API RN:** `useAnnounce()` → `AccessibilityInfo.announceForAccessibility`; `initials` igual.
- **Multi-sistema:** o anúncio é montado pela gramática do tipo (README §9.2), sem frase por sistema.
- **Resolve:** C-03, C-13, §9 (XSS).

---

## Ações

### Button

Ação com verbo. Uma ação primária por tela.

- **Classes:** `ds-btn` (44 mín., borda `border-control`, texto `ink` 700), `--primary` (`action` / `on-action`; foco em `focus-on-action`), `--danger` (`danger` / `on-danger`), `--ghost` (sem borda, texto `action`), `--lg` (56 de altura), `--block` (100%; sem uso hoje).
- **API RN:**

  ```ts
  type ButtonProps = {
    label: string; onPress: () => void
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'lg'
    icon?: IconName; block?: boolean; disabled?: boolean; busy?: boolean
  }
  ```
- **Estados:** hover, pressionado, foco, desabilitado (`disabled` ou `aria-disabled`: fundo transparente, borda `border-subtle`, texto `ink-disabled`), ocupado (`aria-busy`: spinner e sem clique).
- **A11y:** web `<button type="button">`; `aria-disabled` mantém o foco (usado no "Excluir" até digitar o nome). RN `accessibilityRole="button"` + `accessibilityState={{ disabled, busy }}`.
- **Multi-sistema:** os rótulos vêm do esqueleto ou do template: "Rolar no app", "Descanso longo" (D&D, `actions[]`), "Curar 1 nível de dano" (Vampiro), "Excluir". A cor é sempre `action`, nunca `accent`.
- **Resolve:** C-14, C-21, DS-04, DS-16.

### IconButton

Botão só com ícone e rótulo acessível obrigatório.

- **Classes:** `ds-icon-btn` (44×44, `radius-pill`, transparente) + `ds-pressable`.
- **API RN:** `{ icon: IconName; accessibilityLabel: string; onPress(): void; hasPopup?: boolean }` (o rótulo é obrigatório no tipo).
- **Estados:** hover, pressionado, foco. Desabilitado: proposta (herdar do Button).
- **A11y:** web `aria-label` ("Voltar para Noites de São Paulo", "Mais opções" com `aria-haspopup="dialog"`, "Fechar", "Editar Notas"). RN `accessibilityRole="button"` + `accessibilityLabel`.
- **Multi-sistema:** o mesmo voltar, ⋯ e editar em qualquer ficha; o rótulo usa nomes vindos dos dados (crônica, campo).
- **Resolve:** §7, C-20.

### SegmentedControl

Escolha entre 2 a 4 opções curtas dentro de uma seção ou sheet. Substitui as abas antigas.

- **Classes:** `ds-seg` (trilho `surface` com borda) com `button` de 44; o selecionado (`aria-checked="true"` ou `aria-selected="true"`) fica em `surface-raised`, `ink` e `elevation-1`.
- **API RN:** `{ label: string; kind?: 'radio' | 'tab'; options: { id: string; label: string; disabled?: boolean }[]; value: string; onChange(id: string): void }`.
- **Estados:** selecionado, pressionado, desabilitado (aba "Mesa" para quem não narra).
- **A11y:** `kind: 'radio'` → `role="radiogroup"` + `role="radio"`/`aria-checked`; `kind: 'tab'` → `role="tablist"` + `role="tab"`/`aria-selected`. Setas e `tabpanel`: proposta (o protótipo responde a clique). RN `radiogroup`/`radio` ou `tablist`/`tab` com `accessibilityState`.
- **Multi-sistema:** "Automático · Normal · Vantagem · Desvantagem" na parada de D&D; "Sistema · Noite · Pergaminho" no tema; "Personagens · Mesa" na crônica de qualquer sistema. As antigas abas Físicos/Sociais/Mentais viraram grade (WoD).
- **Resolve:** C-07, C-19, DS-05.

### Chip

Rótulo curto tocável: seção, filtro, atalho.

- **Classes:** `ds-chip` (44, `radius-pill`, borda `border-control`, estilo `label` em caixa alta). Ativo por `aria-pressed`, `aria-current` ou `aria-checked`: `surface-raised`, borda e sublinhado interno em `accent`. No header, `.ds-chips .ds-chip` tem 36 (pendência no README).
- **API RN:** `{ label: string; selected?: boolean; kind?: 'toggle' | 'current' | 'action'; onPress(): void }`.
- **Estados:** normal, ativo, pressionado.
- **A11y:** alternância com `aria-pressed`; seção ativa com `aria-current="true"`. RN `accessibilityState={{ selected }}` ou `{ checked }`.
- **Multi-sistema:** rótulos do template: filtro "Só com pontos" (WoD) e "Só proficientes" (D&D), preset "Conjurar efeito" (Mago) e "Teste de Sanidade" (CoC), perícias na pirâmide (Fate).
- **Resolve:** C-04, C-07.

---

## Valores

### RatingDots

Inteiro pequeno (0–10) como pips, sempre com o número ao lado. Nunca é tocável.

- **Classes:** `ds-pips` (`aria-hidden`), `ds-pip`, `.is-on` (`accent`), `.is-bonus` (anel duplo em `accent`: bônus temporário), `.is-lost` (contorno `ink-muted` com traço diagonal: tirado por modificador), `ds-pips--sm` (12), `ds-pips__gap` (respiro depois do 5º numa escala de 10).
- **`ui.js`:** `pips(segments, { small, max })`. A forma vem da skin: círculo (`wod`, `fate`), losango (`dnd`), quadrado (`coc`).
- **API RN:** `{ segments: Segment[]; max?: number; size?: 'md' | 'sm' }`, sem `onChange`: o alvo é a linha ou a célula.
- **Estados:** cheio, vazio, bônus, perdido. Acima do teto, os pips mostram o efetivo e o texto diz "1 inativo"; não existe pip tracejado de "indisponível".
- **A11y:** sempre oculto (web `aria-hidden`; RN `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`). Quem anuncia é a linha. "Tocar no valor atual reduz 1" foi removido.
- **Multi-sistema:** Atributos, Habilidades, Disciplinas e Esferas (WoD); Inspiração 0–1 (D&D); Arcanoi e Artes em templates futuros de Aparição e Changeling. Atributos de D&D e perícias de CoC **não** usam pips: são `number` e `percent`.
- **Resolve:** C-02, C-12, C-16, DS-01, DS-12.

### NumberField

Inteiro com sinal, faixa e derivado, na notação do sistema.

- **Classes:** sem bloco próprio. Na linha, `ds-row__num` (+ `small` para o secundário); na grade, `ds-cell__big` + `ds-cell__sub`; no detalhe, valor grande (`p-sheet-value`, protótipo).
- **`display`:** `plain` (com `suffix`), `score+mod` (modificador grande, valor pequeno), `signed` (`+2`, `−1`), `ladder` (`+3 Bom`, escada declarada no template). O derivado vem por nome (`abilityModifier`, `proficiencyBonus`), nunca por expressão; `readOnly` + `derive` para valores calculados.
- **API RN:**

  ```ts
  type NumberFieldProps = {
    label: string; shortLabel?: string; value: number
    display?: 'plain' | 'score+mod' | 'signed' | 'ladder'
    derived?: number; ladderLabel?: string; suffix?: string
    badge?: { glyph: string; label: string }
  }
  ```
- **Estados:** leitura; Evoluir (Stepper com teclado numérico); derivado só leitura (sem Stepper).
- **A11y:** "Inteligência, 18, modificador mais 4"; "Iniciativa, mais 2"; "Atletismo, Ótimo, mais 4". O selo vira texto no fim ("…, salvaguarda proficiente").
- **Multi-sistema:** atributos, CA e Iniciativa (D&D); perícias em escada e Recarga (Fate); stats de −1 a +3 (PbtA).
- **Resolve:** C-03, C-07, C-09, DS-02.

### PercentField

Porcentagem com metade e quinto, os três números usados na rolagem.

- **Classes:** `ds-row__num` com `<small> ½ 22 · ⅕ 9</small>`; na grade, `ds-cell__big` + `ds-cell__sub`. O detalhe mostra "Para a rolagem": Regular, Difícil (½), Extremo (⅕) e "Base: N%".
- **`display`:** `percent` ou `percent+half+fifth`. `base` (número, campo ou derivação) alimenta o filtro "Acima da base".
- **API RN:** `{ label: string; shortLabel?: string; value: number; base?: number; showDerived?: boolean }`.
- **Estados:** leitura; Evoluir (Stepper de 0 a 99 com teclado numérico, anunciado "45 por cento").
- **A11y:** "Esquivar, 45 por cento; difícil 22; extremo 9".
- **Multi-sistema:** características e perícias do CoC 7e; serve a qualquer sistema d100 de "rolar abaixo", porque o modelo `roll-under-percent` é genérico.
- **Resolve:** C-03, C-09, DS-02.

### MarkToggle

Marca de 2 ou 3 estados com rótulo e bônus derivado.

- **Classes:** sem bloco próprio. Na linha, `ds-badge` com o glifo do estado (`◆`, `aria-hidden`) + bônus em `ds-row__num`. Os estados vêm de `markStates` no template (com `multiplier` para o bônus).
- **API RN:** `{ label: string; states: { id: string; label: string; glyph?: string }[]; value: string; bonus?: number; onChange?(id: string): void }` (componente dedicado: proposta).
- **Estados:** um por item do conjunto (ex.: nenhum, proficiente, especialista). A edição, em Evoluir, é um `Choice` no sheet, nunca ciclo de toques.
- **A11y:** "Arcanismo, proficiente, mais 7"; o glifo é decorativo.
- **Multi-sistema:** perícias (`proficiency3`) e salvaguardas (`proficiency2`) do D&D 5e, com filtro `proficient`; marca de melhoria do CoC e move escolhido de PbtA cabem no mesmo tipo (exemplos de template).
- **Resolve:** C-03, C-07, DS-02.

### Choice / StateChoice

Escolha única em lista vertical; com `state`, a escolha aplica modificadores a outros campos.

- **Classes:** `ds-radios` (coluna), `ds-radio` (botão de 56, borda `border-control`, círculo no `::before`), `__text`, `__label` (700), `__hint` (caption tabular). Marcado: borda `accent`, fundo `surface`, círculo cheio.
- **Tipos:** `choice` (Clã, Raça, Augúrio, Classe); `state` com `modifiers` `add` ou `set`, e o hint mostra os efetivos ("lobisomem · For 7 · Des 4 · Vig 6 · Man 0 · Apa 0"). `cost` opcional vira a alternância "Mudança instantânea: gastar 1 Fúria" (`p-toggle`, protótipo).
- **API RN:**

  ```ts
  type ChoiceProps<T extends string> = {
    label: string; value: T; onChange: (id: T) => void
    options: { id: T; label: string; hint?: string }[]; disabled?: boolean
  }
  ```
- **Estados:** marcado, pressionado, somente leitura (nota "Somente leitura." e toque sem efeito).
- **A11y:** `role="radiogroup"` com `aria-label`; opções `role="radio"` + `aria-checked`, tabindex itinerante e setas. RN `radiogroup`/`radio` + `checked`. A troca aparece no toast.
- **Multi-sistema:** formas do Garou (WoD, no dock); Forma Selvagem e Fúria do Bárbaro (D&D) e insanidade temporária (CoC) são o mesmo `state`. A lista vertical cabe em 360dp com fonte grande, o que o seletor antigo de 5 colunas não fazia.
- **Resolve:** C-03, C-09, C-12, DS-05, DS-12.

### Tags / Tag

Conjunto de condições ou palavras-chave.

- **Classes:** `ds-tag` (leitura, 28, caption), `button.ds-tag` (alternância de 44); `[aria-pressed="true"]` → `surface-raised`, borda `accent`, 700.
- **API RN:** `{ label: string; options: { id: string; label: string; roll?: 'advantage' | 'disadvantage' }[]; value: string[]; onChange?(ids: string[]): void }`.
- **Estados:** marcada, desmarcada, desabilitada (fora do modo permitido).
- **A11y:** web `aria-pressed`; opção com efeito ganha texto oculto ", desvantagem nas rolagens". RN `accessibilityRole="checkbox"` + `checked`. No painel "Em jogo", as marcadas aparecem como `ds-tag` de leitura.
- **Multi-sistema:** condições do D&D (Envenenado vira desvantagem automática na parada, com a origem); Ferimento grave e insanidade (CoC); condições de PbtA.
- **Resolve:** C-07, C-12.

### TextField / TextArea / AspectField

Texto como cidadão de primeira classe.

- **Classes:** `ds-field` (rótulo envolvendo), `ds-field__label` (caption 700, `ink-muted`), `ds-input` (44) e `ds-textarea` (8rem, redimensiona na vertical), `ds-field__help`, `ds-field__error` (ícone + texto em `danger`), `.has-error` (borda `danger`). O **AspectField** ainda é `p-aspect` no protótipo: tipo do campo + texto na fonte `voice`, fixado no topo pela seção com `pinTop`.
- **Editor em sheet:** contador "20 de 80 caracteres" em `aria-live="polite"`, `maxlength` do template, Cancelar e Salvar, foco inicial no campo.
- **API RN:**

  ```ts
  type TextFieldProps = {
    label: string; value: string; onChangeText(v: string): void
    multiline?: boolean; maxLength?: number; help?: string; error?: string
    aspect?: boolean; editable?: boolean
  }
  ```
- **Estados:** normal, foco, erro (`aria-invalid` + `aria-describedby`), desabilitado, somente leitura.
- **A11y:** rótulo sempre visível; erro com ícone e texto, nunca só cor. RN `TextInput` com `accessibilityLabel`, `maxLength` e `keyboardType`, em sheet de altura total com `KeyboardAvoidingView` (proposta).
- **Multi-sistema:** nome, conceito e notas em todos; aspectos do Fate no topo da zona de jogo ("Aspecto, Conceito: Ex-detetive endividado"); traços de personalidade (D&D); histórico (CoC). Texto entra sempre como texto, nunca HTML.
- **Resolve:** C-23, §7, §9.

---

## Recursos

### Resource

Atual/máximo, com temporário e permanente opcionais e ações de gastar e recuperar.

- **Classes:** máximo até 20 → `ds-boxes` + `ds-box` (`.is-filled` em `accent`; `.is-filled.is-alt-cool`/`.is-alt-warm` hachurado); acima de 20 → `ds-meter` + `ds-meter__fill`. Valor em `ds-row__num` ("9/15", "27/27 +5").
- **Sheet:** valor grande e visual; "Atual" com Stepper (teclado numérico com `allowInput` ou máximo > 20); "Gastar 1" e "Recuperar 1"; ações do template com custo ("Curar 1 nível de dano (1 Sangue)"); gasto máximo por turno; "Permanente" (Stepper só em Evoluir). Variante `tempFirst`: Quantidade + Dano/Cura + "PV temporários", e com 0 PV e `atZero` o banner "faça testes contra a morte". Variante `tempUncapped` (Renome): Permanente e Temporário em texto.
- **API RN:**

  ```ts
  type ResourceProps = {
    label: string; shortLabel?: string; current: number; max?: number
    temp?: number; permanent?: number; colorRole?: ColorRole; perTurn?: number
    editable: boolean; onChange?(next: { current: number; temp?: number }): void
    actions?: { id: string; label: string; cost?: number; onRun(): void }[]
  }
  ```
- **Estados:** editável em Jogo; "Este recurso muda em Evoluir"; ação desabilitada sem saldo; atual limitado pelo permanente.
- **A11y:** caixas e medidor ocultos; "Pontos de Sangue, 9 de 15"; "Força de Vontade, 5 de 7, permanente 7"; Stepper `adjustable`; toda alteração com toast.
- **Multi-sistema:** Sangue, FdV, Fúria e Gnose (WoD; a Gnose com `alt-warm` hachurado); PV com temporários e Dados de vida (D&D); PV, SAN e Sorte com teclado (CoC); Pontos de Destino acima da recarga (Fate, `overMax`). O antigo `Pool` (permanente + atual) é este componente com `permanent`.
- **Resolve:** C-04, C-13, C-17, DS-01, DS-05.

### Track / LeveledTrack

Trilha de caixas com estados nomeados; a regra vem do template, por nome.

- **Classes:** `ds-track` e `ds-track__row` (rótulo, `__pen` penalidade, `__type` tipo por extenso e `ds-box` com o glifo); `ds-minitrack` (8×12 por nível; `is-filled` em `accent`, `is-agg` em `ink` para o tipo mais grave) no dock; `ds-boxes--hit` + `button.ds-box` (44, `aria-pressed`) para caixas tocáveis.
- **`rule: "wod-stacking"`:** o app guarda **contagens por tipo** e desenha em ordem de gravidade.
  - **Sheet:** penalidade grande (só número: 0, −1, −5) e o nível ao lado, a trilha visual e **uma linha por tipo de dano**, com glifo em caixa, nome por extenso e Stepper inline.
  - **+ e −:** + aplica 1 nível e − cura 1 nível daquele tipo. Segurar repete e grava uma alteração só.
  - **Por que assim:** são 3 steppers no lugar de 1 de quantidade e 6 botões, e o controle mostra o dado guardado. Curar fica no − da mesma linha, sem decorar o glifo.
  - **Trilha cheia:** o aviso diz o que a regra fez ("contusivo a mais virou letal"). Se nada muda, o aviso explica e nada é gravado.
  - **Háptico:** mais forte no agravado.
- **`rule: "boxes"`:** linhas de N caixas com `boxValues` opcionais; cada caixa alterna.
- **API RN:**

  ```ts
  type LeveledTrackProps = {
    label: string; levels: { label: string; penalty: number | null }[]
    types: { id: string; label: string; glyph: string }[]   // em ordem de gravidade
    counts: Record<string, number>; onApply?(type: string, n: number, heal: boolean): void
  }
  type BoxTrackProps = {
    label: string; rows: { id: string; label: string; boxes: number; boxValues?: number[] }[]
    marks: Record<string, boolean[]>; onToggle?(row: string, index: number): void
  }
  ```
- **Estados:** vazio, por tipo, incapacitado (penalidade `null` bloqueia a parada), somente leitura.
- **A11y:** trilha oculta com resumo "Vitalidade: Machucado, penalidade menos 1; 1 letal, 1 contusivo"; caixa tocável "Físico, caixa 2 (vale 2)" com `aria-pressed`. O glifo nunca é a única pista: o tipo aparece por extenso.
- **Multi-sistema:** Vitalidade de 7 níveis (WoD) com `wod-stacking`; testes contra a morte (D&D, 2 × 3) e estresse 1/2/3 (Fate) com `boxes`. Corpus da Aparição e as duas trilhas de Changeling cabem no mesmo tipo. O servidor rejeita mais dano do que níveis.
- **Resolve:** C-03, C-06, DS-05, DS-11.

### Slots

Recurso por nível que recarrega em descanso.

- **Classes:** leitura com `ds-track__row` + `ds-boxes` (caixa cheia = disponível); sheet com `ds-boxes--hit` + `button.ds-box` por espaço.
- **Sheet:** uma seção por nível ("1º nível · 3 de 4"), tocar alterna usado/disponível, "Recuperar todos". A ação padrão do dock (`use1`) gasta o primeiro nível com espaço livre. O "Descanso longo" do template zera os usados, com prévia.
- **API RN:** `{ label: string; levels: { n: number; label: string; max: number; used: number }[]; onChange?(n: number, used: number): void; onResetAll?(): void }`.
- **Estados:** disponível, usado, sem espaços (anuncia "Sem espaços disponíveis").
- **A11y:** "Espaços de magia: 1º nível, 3 de 4 disponíveis; …"; botão "1º nível, espaço 2, disponível" com `aria-pressed`.
- **Multi-sistema:** espaços de magia do D&D 5e (`reset: longRest`); o mesmo tipo atende qualquer recurso por nível com recarga (`shortRest` ou `longRest`), como poderes por cena num template homebrew de outro sistema.
- **Resolve:** C-02, C-04.

### Clock

N casas com até dois preenchimentos opostos.

- **`ui.js`:** `clock({ segments, fills, size, label })` → SVG `ds-clock` dentro de `ds-clock-wrap` (`role="img"`, `aria-label`). Casas em arco com 3–4° de intervalo; preenchimento do início (`from: 'start'`) e do fim (`'end'`); `accent` cheio e `alt-*` com hachura SVG; casa vazia com contorno `border-control`.
- **Sheet:** roda grande, legenda em sans ("Quintessência 6 · Paradoxo 2 · 12 livres") e um Stepper por preenchimento ("6 de 20 casas"). Regra `mage-quint-paradox`: com a roda cheia, "Paradoxo +1" consome 1 de Quintessência (toast com Desfazer) ou é bloqueado com aviso.
- **API RN:**

  ```ts
  type ClockProps = {
    segments: number   // 2 a 24
    fills: { id: string; label: string; n: number; from: 'start' | 'end'; colorRole: ColorRole }[]
    size?: number; accessibilityLabel: string
  }
  ```
- **Estados:** vazio, parcial, cheio, bloqueado pela regra.
- **A11y:** imagem com rótulo "Quintessência 6, Paradoxo 2, de 20 casas"; edição só pelos Steppers. Os números ficam fora do miolo e nunca na fonte display.
- **Multi-sistema:** roda de Quintessência e Paradoxo (Mago, no dock); relógios de progresso de PbtA e Blades (4, 6 ou 8 casas, um preenchimento); contadores de cena do narrador.
- **Resolve:** C-13, C-17, DS-14.

### Stepper / ValueEditor

Edita qualquer número com − e +, um passo por toque.

- **Classes:** `ds-stepper`, `__btn` (56, redondo), `__value` (`number-lg`), `__input` (campo numérico com borda `action`), `--inline` (botões de 44 e valor `number`).
- **`ui.js`:** `stepper({ label, value, min, max, step, valueText, onChange, inline, allowInput, disabled, key })`, com `setValue(v)` para atualizar de fora.
- **Comportamento:** 1 passo por toque, nunca salta; limita a `[min, max]` e desabilita − ou + no limite; segurar repete (depois de 400 ms, a cada 90 ms); com `allowInput`, tocar no número abre o teclado numérico (Enter confirma, Esc cancela); `data-key` devolve o foco depois de redesenhar.
- **API RN:**

  ```ts
  type StepperProps = {
    label: string; value: number; min: number; max: number; step?: number
    valueText?: (v: number) => string; onChange: (v: number) => void
    size?: 'lg' | 'inline'; allowInput?: boolean; disabled?: boolean
  }
  ```
- **Estados:** normal, no limite, desabilitado, digitando.
- **A11y:** web `role="group"` com botões reais "Diminuir/Aumentar {rótulo}" (fora do Tab, alcançáveis por toque) e `role="spinbutton"` + `aria-valuemin/max/now/valuetext` no valor; setas, PageUp/PageDown, Home/End, Enter para digitar. Segurar repete só no visual e grava uma alteração ao soltar. RN `accessibilityRole="adjustable"` + `accessibilityValue` + `increment`/`decrement`; háptico de seleção (proposta).
- **Multi-sistema:** PV "27 de 134" com teclado (D&D), perícia em % (CoC), escada de −2 a +8 (Fate), dificuldade (WoD), alvo e dados de bônus na parada, quantidade de dano em qualquer trilha.
- **Resolve:** C-01, C-02, C-03, C-17, DS-01, DS-05, DS-14.

---

## Ficha

### FieldRow

Linha de campo: um único alvo de 48 com rótulo, sub-rótulos e valor.

- **Classes:** `ds-rows` (lista com padding 16), `ds-row` (botão de 48 mín. com divisória), `__leading` (slot de glifo ou ícone), `__text`, `__label` (`field-label`, quebra com hífen), `__sub` (caption `ink-muted`), `__sub--spec` (especialização em itálico), `__value`, `__num` (`number` tabular; `small` para o secundário), `.is-inactive` (rótulo em `ink-muted`), `ds-badge` (caption 700 em `accent-text`, ex.: "Afinidade"). Com `.is-stacked`, o nome vai para cima do valor.
- **Comportamento:** em Jogo e Leitura, botão que abre o sheet (detalhe ou recurso). Em Evoluir, `rating`, `number` e `percent` viram `div.ds-row` com Stepper inline.
- **API RN:**

  ```ts
  type FieldRowProps = {
    label: string; sublabels?: string[]; specialty?: string; badge?: string
    leading?: ReactNode; value: ReactNode; accessibilityLabel: string
    inactive?: boolean; onPress?: () => void; editor?: ReactNode   // editor = Evoluir
  }
  ```
- **Estados:** normal, pressionado, inativo (acima do teto), Evoluir, empilhado.
- **A11y:** um alvo só, com `aria-label` gerado pela gramática do tipo e `aria-haspopup="dialog"`; filhos visuais ocultos. RN `accessibilityRole="button"`.
- **Multi-sistema:** "Prontidão ●●○○○ 2" (WoD), "Arcanismo ◆ Int +7" (D&D), "Esquivar 45% ½ 22 · ⅕ 9" (CoC), "Forças · Afinidade · 1 inativo" (Mago). Esferas não são um componente: são `FieldRow` com `cap` e `badge`.
- **Resolve:** C-01, C-02, C-03, C-07, C-09, C-16, DS-01, DS-05, DS-06.

### Grid / Cell / Pyramid

Grade primária (atributos) sem abas e pirâmide por degrau.

- **Classes:** `ds-grid` (`--cols`, divisórias de 1px, `elevation-1`, container de inline-size), `ds-grid__head` (título do grupo, `aria-hidden`), `ds-cell` (botão de 64 mín.), `__top`, `__label`, `__num`, `__big` (`number-lg`), `__sub`. Pirâmide: `ds-pyramid`, `__tier`, `__rung` ("+4 Ótimo"), `__skills` (chips).
- **Por tipo:** `rating` põe o rótulo sozinho na 1ª linha e pips + número embaixo; `number score+mod` mostra o modificador grande, o valor em `__sub` e o selo ◆; `percent` mostra o valor grande e "½ · ⅕". Com `groups`, cada grupo vira uma coluna, lida linha a linha.
- **API RN:** `GridProps = { columns: number; headers?: string[]; children: ReactNode }`; `CellProps = { label: string; value: ReactNode; sub?: string; badge?: string; accessibilityLabel: string; onPress(): void }`; `PyramidProps = { tiers: { rung: string; items: { id: string; label: string; accessibilityLabel: string }[] }[] }`.
- **Estados:** pressionado; container ≤ 400 (padding menor, rótulo 15, pip 12); `.is-stacked` (uma coluna, sem cabeçalhos).
- **A11y:** cada célula é um botão com a gramática do tipo e o selo em texto; cabeçalhos de grupo ocultos.
- **Multi-sistema:** 9 atributos de WoD em 3×3 sem abas; 6 atributos de D&D com modificador; 8 características do CoC em % (2 colunas); perícias do Fate na pirâmide (`layout: pyramid`).
- **Resolve:** C-07, C-09, C-10, DS-06.

### SectionHeader

Título de seção e de grupo.

- **Classes:** `ds-section` (`scroll-margin-top` = header + chips), `ds-section__header` (`h2`, `display-lg` da skin, régua de 1px em `accent`), `ds-group-title` (`h3`, `title` 17/700 na sans).
- **API RN:** `{ title: string; level?: 2 | 3; nativeID?: string }`.
- **Estados:** estático; recebe foco quando o chip da seção é tocado.
- **A11y:** `h2` com `tabindex="-1"`; RN `accessibilityRole="header"`.
- **Multi-sistema:** títulos e ordem vêm de `sections[]` ("Atributos · Habilidades · Vantagens" no Vampiro; "Atributos · Salvaguardas · Perícias · Combate · Magias" no D&D); a régua fica em `accent-neutral` no CoC e no Fate.
- **Resolve:** C-03, C-05, DS-15.

### SectionTabs

Navegação da ficha: **3 abas fixas, uma por zona do template** (Ficha · Poderes · Sobre). A escolha vem de um estudo com medidas nos 6 sistemas ([`../estudos/navegacao-da-ficha.md`](../estudos/navegacao-da-ficha.md)).

- **Classes:**
  - `ds-chips[role="tablist"][data-fixed="true"]`, com as abas em `ds-chip[role="tab"]`.
  - A aba ativa leva `aria-selected="true"`.
  - As 3 dividem a largura em grade e **nunca rolam de lado**: com fonte muito grande, o rótulo quebra em 2 linhas, com hífen.
  - Caixa normal, 15 px, peso 700.
  - Em `.ds-header.is-collapsed`, a faixa some ao rolar para baixo e volta ao rolar para cima ou com foco.
- **Comportamento:**
  - Os painéis existem todos; os inativos ficam `hidden`. Na impressão aparecem todos.
  - Cada personagem lembra a aba ativa e a rolagem de cada aba.
  - Trocar de aba mostra o header e restaura a rolagem daquela aba.
- **API RN:** `{ tabs: { id: 'build' | 'powers' | 'lore'; title: string }[]; active: string; onSelect(id): void; collapsed?: boolean }` (proposta). Painéis com `display: none` quando inativos e um `ScrollView` com posição guardada por aba.
- **Estados:** selecionada, recolhida.
- **A11y:**
  - Web: `tablist`/`tab`/`tabpanel` com `aria-controls` e `aria-labelledby`, tabindex itinerante, setas, Home e End, e ativação automática, já que trocar de aba não tem custo.
  - RN: `accessibilityRole="tab"` com `accessibilityState={{ selected }}`.
- **Multi-sistema:** as abas saem das zonas que todo template declara. O template só troca o rótulo (`zoneLabels`, até 14 caracteres):

  | Sistema | Abas |
  |---|---|
  | WoD | Ficha · Vantagens · Sobre |
  | D&D | Ficha · Poderes · Itens e notas |
  | CoC | Ficha · Equipamento · Histórico |
  | Fate | Ficha · Façanhas · Sobre |
- **Variantes do estudo:** só no protótipo, para o teste com usuários. `SectionChips` é a rolagem única com chips de atalho e scroll spy; a outra variante tem uma aba por seção.
- **Resolve:** C-04, C-09, C-20, UX-07.

### ValueChip (lista compacta)

Resumo de uma seção com o filtro "só investidos" ligado: cada traço vira um chip **"Nome valor"** em fluxo, com título por grupo.

- **Classes:** `ds-chipflow` (lista em fluxo) e `ds-chip ds-chip--value` com o valor em `b.ds-num`. O `•` (`ds-chip__mark`, em `accent-text`) marca especialização ou selo (Afinidade).
- **Quando aparece:** quando o filtro da seção está ligado, que é o padrão. Com o filtro desligado ("Mostrar todos") ou em Evoluir, a seção volta à lista de `FieldRow` com pips e steppers.
- **Medida (aba Ficha, 390 px):**
  - Habilidades do WoD: de 950–1.133 px para cerca de 400–515 px. A aba inteira passa de 1.733–1.916 px para 1.329–1.381 px.
  - Foi preferida a sub-abas Talentos/Perícias/Conhecimentos, que cortavam o mesmo tanto mas mostravam um grupo por vez e criavam um segundo nível de navegação. Ver o adendo em [`../estudos/navegacao-da-ficha.md`](../estudos/navegacao-da-ficha.md).
- **API RN:** `{ items: { id: string; label: string; value: string; mark?: boolean; accessibilityLabel: string }[]; onPress(id): void }` (proposta), com `flexWrap: 'wrap'`.
- **Estados:** normal, pressionado, foco.
- **A11y:** cada chip é um botão com o mesmo nome acessível da linha completa (`describe()`), com especialização e modificadores; alvo ≥ 44 px.
- **Multi-sistema:**

  | Sistema | Exemplos de chip |
  |---|---|
  | WoD | "Ocultismo 4" |
  | D&D | "Arcanismo +7", só as perícias proficientes |
  | CoC | "Encontrar 45%", acima da base |
  | Fate | já usa o mesmo formato na pirâmide |
- **Resolve:** C-07, UX-07.

### FilterBar / Search

Filtro "só investidos" e busca dentro de uma seção.

- **Classes:** `ds-filterbar`, `ds-chip` com `aria-pressed` para o filtro, `ds-search` (`type="search"`, 44). Quando esconde itens, o protótipo mostra "Mostrando 5 de 30. Mostrar todos" (`p-hidden-note`).
- **Comportamento:** o filtro é um nome de regra (`invested`, `proficient`, `aboveBase`) com rótulo e padrão do template; a busca ignora acento e caixa. Em Evoluir o filtro some, porque é ali que se compra o primeiro ponto.
- **API RN:** `{ filter?: { label: string; on: boolean; onToggle(): void }; search?: { label: string; value: string; onChangeText(v: string): void } }`.
- **Estados:** filtro ligado ou desligado, busca vazia ou preenchida.
- **A11y:** busca com `aria-label="Buscar em {seção}"`; filtro com `aria-pressed`.
- **Multi-sistema:** "Só com pontos" (WoD), "Só proficientes" (D&D), "Acima da base" (CoC), "Só com bônus" (Fate).
- **Resolve:** C-07, C-09, C-20.

### CharacterHeader

Header compacto e fixo da ficha.

- **Classes:** `ds-header` (sticky, fundo `bg`, safe area no topo, `layer-sticky`), `__bar` (48), `__title`, `__name` (`h1`, `display-sm`, 1 linha com reticências), com `ds-id-chip` (até 40%), `ds-sync` e dois `ds-icon-btn` (voltar e ⋯). `ds-breadcrumb` aparece a partir de 900.
- **Menu ⋯** (sheet "Mais opções"): Evoluir personagem · ações do template, com prévia · Histórico de alterações · Rolagens da sessão · Trocar de personagem · Tema e leitura · Exportar ou imprimir · Arquivar (confirmação) · Excluir (confirmação com o nome digitado).
- **API RN:** `{ name: string; identity: { label: string; accent?: AccentName }; backLabel: string; onBack(): void; sync: SyncState; onMenu(): void; collapsed?: boolean }`.
- **Estados:** expandido (com chips), recolhido.
- **A11y:** voltar "Voltar para {crônica}"; ⋯ "Mais opções" com `aria-haspopup="dialog"`; nome como `h1`.
- **Multi-sistema:** o esqueleto é fixo; o template dá o campo do nome, o formato do chip (`"{class} nv {level}"` no D&D, o clã no Vampiro) e o accent. Ações de sistema entram por `actions[]` ("Descanso longo", "Descanso curto" no D&D).
- **Resolve:** C-04, C-15, C-20, C-21.

### IdentityBlock

Bloco de identidade recolhível no topo do corpo.

- **Classes:** `ds-identity` (botão de 64 com avatar grande, `voice` e resumo), `__text`, `__summary`, `__more`; `ds-voice` (citação na fonte `voice` da skin); `ds-facts` (`dl` em 2 colunas; `--wide` e `.is-stacked` em 1).
- **Comportamento:** recolhido por padrão no celular, aberto a partir de 900. Os fatos vêm das seções de zona `identity`; glifo de skin entra ao lado do valor.
- **API RN:** `{ name: string; voice?: string; summary: string; facts: { label: string; value: string; glyph?: ReactNode }[]; open: boolean; onToggle(): void }`.
- **Estados:** aberto, fechado.
- **A11y:** `aria-expanded` + `aria-controls`; texto oculto ". Mostrar identidade" / ". Recolher identidade". RN `accessibilityState={{ expanded }}`.
- **Multi-sistema:** Senhor, Natureza e Comportamento (Vampiro); raça, subclasse e antecedente (D&D); ocupação, idade e residência (CoC). No Fate, o conceito é aspecto e não se repete na voz.
- **Resolve:** C-04, C-15, DS-10.

### IdentityChip

Selo de identidade: accent + nome. Substitui o `LineageMark`.

- **Classes:** `ds-id-chip` (pill, borda 1px em `accent`, ponto de 10px em `accent` no `::before`, caption 500, reticências).
- **API RN:** `{ label: string; accent?: AccentName }`.
- **Estados:** estático.
- **A11y:** só texto; o ponto é decorativo.
- **Multi-sistema:** "Tremere" (Vampiro), "Uktena" (Lobisomem), "Mago nv 5" (D&D, `chipFormat`), "Professor de Antropologia" em `accent-neutral` (CoC), playbook (PbtA).
- **Resolve:** C-13, DS-03, DS-08, DS-09.

### Avatar

Iniciais como segunda pista, não cromática, da identidade.

- **Classes:** `ds-avatar` (40, borda 2px em `accent`, fundo `surface-raised`, iniciais 700), `--lg` (72, fonte display).
- **`ui.js`:** `initials('Helena Varga')` → "HV".
- **API RN:** `{ name: string; accent?: AccentName; size?: 'sm' | 'lg' }`.
- **Estados:** estático.
- **A11y:** `aria-hidden` (o nome está ao lado); RN `importantForAccessibility="no"`.
- **Multi-sistema:** separa "HV" e "CV" na mesa mesmo quando os accents se confundem com daltonismo (`accent-7 × accent-8`, ΔE 0.4); em CoC e Fate, onde todos são `accent-neutral`, é a única diferença visual entre linhas.
- **Resolve:** C-13, DS-08.

### SyncIndicator

Estado de salvamento no header.

- **Classes:** `ds-sync` (botão de 44, caption) com `data-state`: `saved` (ponto cheio em `success`, "salvo"), `saving` (anel `ink-muted`, "salvando"), `offline` (anel tracejado em `ink`, "offline · 3 pendentes"), `error` (ponto e texto em `danger`, "erro ao salvar"); `ds-sync__dot`.
- **Comportamento:** tocar abre o sheet "Sincronização", com o estado por extenso. Em conflito, prevalece a última escrita, com aviso. A fila offline guarda só eventos, nunca credenciais.
- **API RN:** `type SyncState = 'saved' | 'saving' | 'offline' | 'error'`; `{ state: SyncState; pending?: number; onPress(): void }`.
- **Estados:** os quatro acima.
- **A11y:** `aria-label` por extenso ("Sem conexão. 3 alterações serão enviadas quando a conexão voltar."); forma do ponto + texto, nunca só cor. Anunciar a passagem para offline ou erro: proposta.
- **Multi-sistema:** o evento é por caminho (`{ id, from, to }`) e não depende do tipo: pips, PV, %, texto e listas usam a mesma fila.
- **Resolve:** C-08, DS-04.

### ModeBar

Faixa que diz em que modo a ficha está.

- **Classes:** `ds-modebar` (faixa `surface-raised` abaixo do header, caption), `strong` (rótulo em caixa alta), `__actions`.
- **Variantes:** Evoluindo ("N alterações não salvas" + Concluir); Leitura ("Ficha de {dono}" + "Editar como narrador" para o narrador); Narrador ("As alterações ficam assinadas no histórico" + "Voltar à leitura"); Arquivada ("Somente leitura" + Restaurar para o dono). Em Jogo não aparece.
- **API RN:** `{ mode: 'read' | 'evolve' | 'storyteller' | 'archived'; title: string; message: string; actions?: ButtonProps[] }`.
- **Estados:** as quatro variantes.
- **A11y:** `role="region"` com `aria-label` ("Modo Evoluir"); entrar em Evoluir é anunciado.
- **Multi-sistema:** a mesma barra para qualquer template; o que cada modo libera vem de `editableIn` por campo.
- **Resolve:** C-01, C-19, DS-04.

### CombatDock / DockChip

Recursos de combate na zona do polegar, com valor visível.

- **Classes:** `ds-dock` (fixo embaixo, `surface-raised`, `elevation-2`, safe area, `layer-dock`), `__handle` ("Todos os recursos"), `__row` (3 chips + Dados), `ds-dock-chip` (56; rótulo curto + valor tabular), `__label`, `__value`, `--action` (Dados em `action`, foco `focus-on-action`). Com `.is-stacked`, 2 colunas. A partir de 600 o dock some e o painel "Em jogo" (`p-play-panel`, protótipo; proposta de `PlayPanel` no core) mostra os mesmos campos.
- **Valor com forma:** mini-trilha + penalidade, "9/15", amostras cheia e hachurada da roda + números, "1º 3/4", nome da forma.
- **Comportamento:** toque abre o sheet; **toque longo (500 ms)** executa a `defaultAction` (`spend1`, `gain1`, `damage1`, `use1`) com toast e háptico; "Todos os recursos" abre a lista da zona `play`. Puxar o dock para cima: proposta.
- **API RN:**

  ```ts
  type DockItem = {
    id: string; label: string; value: ReactNode; accessibilityLabel: string
    onPress(): void; defaultAction?: { label: string; run(): void }
  }
  type CombatDockProps = { items: DockItem[]; dice: { label: string; sub: string; onPress(): void }; onShowAll(): void }
  ```
- **A11y:** `section aria-label="Em jogo"`; chip com a gramática do tipo + ". Toque longo: gastar 1."; o sheet tem o mesmo "Gastar 1". RN `onLongPress` + `accessibilityActions={[{ name: 'longpress', label: 'Gastar 1' }]}`.
- **Multi-sistema:** `dock` do template, de 1 a 3 campos de tipos jogáveis: Vampiro [Vitalidade, Sangue, FdV]; Mago [Vitalidade, roda, FdV]; Lobisomem [Vitalidade, Fúria, Forma]; D&D [PV, CA, Espaços]; CoC [PV, SAN, Sorte]; Fate [Estresse, Destino, Consequências]. O chip Dados mostra o dado do modelo (d10, d20, d100, 4dF, 2d6).
- **Resolve:** C-02, C-04, C-06, C-10, C-12, C-19.

### Repeater / ListEditor

Lista aberta com esquema por item.

- **Classes:** uma `ds-row` por item (pips + número quando há `value`; meta do item; especialização); vazio "Nenhum(a) {item}" + Adicionar; em Evoluir, "Adicionar {item}" no fim.
- **Sheets:** detalhe do item (valor, meta, especialização, "Notas do jogador", "Montar parada", "Remover" em Evoluir com Desfazer); adicionar (busca no `catalog` do template ou texto livre de até 80); lista fixa (consequências do Fate) editada de uma vez.
- **API RN:**

  ```ts
  type RepeaterProps<T extends { id: string }> = {
    label: string; itemLabel: string; items: T[]; renderRow(item: T): ReactNode
    catalog?: string[]; onAdd?(name: string): void; onRemove?(id: string): void; editable: boolean
  }
  ```
- **Estados:** vazio, com itens, Evoluir, somente leitura. Reordenar: proposta.
- **A11y:** cada linha com rótulo composto ("Taumaturgia, 3 de 5, especialização …"); busca rotulada; remoção com toast.
- **Multi-sistema:** Disciplinas e Antecedentes (WoD), magias, ataques e inventário (D&D), armas e itens (CoC), façanhas e consequências (Fate), moves (PbtA). A descrição dos poderes é escrita pela mesa: o app não embute textos protegidos de livros.
- **Resolve:** C-05, C-18, §7.

---

## Feedback

### Toast

Aviso de 5 s com Desfazer, rede de segurança de toda edição em jogo.

- **Classes:** `ds-toast-region` (fixa acima do dock via `--dock-offset`, `layer-toast`, `role="status"`, `aria-live="polite"`), `ds-toast` (invertido: fundo `ink`, texto `bg`, `elevation-2`), `__text` (tabular), botão ghost "Desfazer" sublinhado.
- **`ui.js`:** `toast(text, { undo, duration = 5000 })` devolve `close`. Um por vez: o novo substitui o anterior.
- **API RN:** hook `useToast()` com `show(text: string, opts?: { undo?(): void; duration?: number }): () => void`.
- **Estados:** entrando (`ds-rise`; sem animação com reduzir movimento), visível, fechado.
- **A11y:** região polite; "Desfazer" é botão de 44 com anel em `bg`. Depois dos 5 s, a alteração continua no Histórico. RN: componente próprio com Reanimated + `announceForAccessibility`, acima do dock e da safe area.
- **Multi-sistema:** "Sangue 10 → 9", "PV 27+5 → 25 (7 de dano)", "Espaço de 1º nível usado (2/4)", "Paradoxo +1 consumiu 1 de Quintessência", "Destino 3 → 2".
- **Resolve:** C-01, C-17, DS-04, §7.

### BottomSheet

Folha que hospeda detalhe, editores, dano, parada e menu.

- **Classes:** `ds-scrim` (toque fecha), `ds-sheet` (embaixo, até 92dvh, `surface-raised`, `radius-lg` no topo, `elevation-2`, safe area), `__grabber` (decorativo), `__head`, `__title` (`h2` focável), `__body` (rolagem com `overscroll-behavior: contain`), `__foot` (botões lado a lado). A partir de 600 vira modal centralizado de até 560, sem grabber.
- **`ui.js`:** `sheet({ title, body, footer, onClose, kind, initialFocus })` → `{ close, panel }`, com pilha. O protótipo acrescenta `liveSheet`, que refaz o corpo a cada alteração e preserva o foco.
- **API RN:** `{ title: string; open: boolean; onClose(): void; footer?: ReactNode; initialFocus?: 'title' | RefObject<View>; children: ReactNode }`.
- **Estados:** abrindo (`ds-slide` ou `ds-fade`), aberto, empilhado. Arrastar para fechar: proposta (nativo no `formSheet` do Expo Router).
- **A11y:** `role="dialog"`, `aria-modal`, `aria-labelledby`; foco preso; Esc fecha o do topo; foco inicial no título; foco volta a quem abriu. RN `Modal` + `onRequestClose` (voltar do Android) + `accessibilityViewIsModal`.
- **Multi-sistema:** o mesmo sheet edita Vitalidade (WoD), PV com temporários (D&D), SAN (CoC) e estresse (Fate), e hospeda a parada de qualquer modelo.
- **Resolve:** C-01, C-02, C-04, C-18, DS-05, DS-07.

### ConfirmDialog

Confirmação só para o raro e destrutivo.

- **Classes:** `ds-dialog` (centralizado, até 420, `radius-lg`, `layer-dialog`), `ds-scrim--dialog`, `ds-dialog__title`, `__actions`.
- **`ui.js`:** `confirmDialog({ title, text, confirmLabel, danger, requireText, onConfirm })`. Com `requireText`, o botão fica `aria-disabled` até o texto digitado bater.
- **API RN:** `{ title: string; message: string; confirmLabel: string; danger?: boolean; requireText?: string; onConfirm(): void; onCancel(): void }`.
- **Estados:** aberto; confirmar bloqueado ou liberado.
- **A11y:** `role="alertdialog"`, foco inicial em **Cancelar**, Esc cancela. RN `Modal` transparente com `onRequestClose` = cancelar.
- **Multi-sistema:** "Arquivar Helena Varga?" e "Excluir Lia Brasa?" (com nome digitado) funcionam igual em qualquer sistema. Edições de jogo usam Desfazer, nunca confirmação.
- **Resolve:** C-20, DS-04, §7.

### Banner

Aviso persistente no corpo da tela.

- **Classes:** `ds-banner` (`surface-raised`, borda `border-control`, ícone + texto + ação), `--danger` (borda e ícone `danger`), `--success` (ícone `success`), `__text`.
- **Usos:** offline ("Sem conexão. 3 alterações serão enviadas…"), conflito ("A narradora alterou a Vitalidade enquanto você estava offline" + Ver), erro de carga + "Tentar de novo", 0 PV com testes contra a morte (D&D).
- **API RN:** `{ tone?: 'info' | 'danger' | 'success'; icon: IconName; text: string; action?: { label: string; onPress(): void } }`.
- **Estados:** informativo, perigo, sucesso.
- **A11y:** `role="status"` para informação e `role="alert"` para erro; ícone + texto, nunca só cor.
- **Multi-sistema:** o texto usa o rótulo do campo vindo do template ("Vitalidade", "PV", "Sanidade").
- **Resolve:** C-08, §7.

### EmptyState

Estado vazio com texto e ação, sem ilustração de sistema.

- **Classes:** `ds-empty` (coluna centrada, padding `space-10`, `ink-muted`), `ds-empty__title`.
- **Usos:** "Você ainda não participa de nenhuma crônica" + Criar crônica / Entrar com convite; "Nenhuma alteração ainda"; "Você não tem acesso a esta ficha"; "Ficha excluída". Em listas da ficha, o vazio é uma linha "Nenhum(a) {item}" + Adicionar.
- **API RN:** `{ icon?: IconName; title: string; text?: string; actions?: ButtonProps[] }`.
- **Estados:** estático.
- **A11y:** título como heading; ações como botões.
- **Multi-sistema:** o nome do item vem do template ("Nenhuma magia" no D&D, "Nenhuma façanha" no Fate, "Nenhuma Disciplina" no Vampiro).
- **Resolve:** C-08, §7.

### Skeleton

Carregamento com a forma da ficha.

- **Classes:** `ds-skel` (gradiente `surface` → `surface-raised` com brilho de 1,4 s; parado com reduzir movimento).
- **Forma:** título no header, bloco de identidade (64), grade (196) e 12 linhas de larguras variadas.
- **API RN:** `{ width: number | string; height: number; radius?: number }` + `<SheetSkeleton />` (proposta).
- **Estados:** animado, estático (reduzir movimento).
- **A11y:** contêiner com `aria-busy="true"` e "Carregando a ficha" em `role="status"`; peças `aria-hidden`.
- **Multi-sistema:** a forma é do esqueleto (header, identidade, grade, linhas), a mesma para Vampiro, D&D, CoC e Fate.
- **Resolve:** C-08, DS-07.

---

## Navegação e listas

### ListItem / CharacterCard / ChronicleCard

Item de lista de crônicas, personagens e mesa.

- **Classes:** `ds-list`, `ds-list-item` (link ou botão de 72), `__text`, `__title`, `__meta`, `__chips` com `ds-mini` (valor compacto: "Sangue **9/15**"), avatar e chevron.
- **CharacterCard:** avatar com iniciais, nome, `IdentityChip`, crônica e hora da atualização; na visão Mesa do narrador, os chips do `dock` e "sincronizada às 21:40". Cada `li` leva o próprio `data-accent` e `data-skin`.
- **ChronicleCard:** iniciais da crônica, nome, sistema, "Você narra" ou "Narrador: {nome}", número de personagens e data da última sessão.
- **API RN:** `{ title: string; avatar: { name: string; accent?: AccentName }; chip?: string; meta?: string; stats?: { label: string; value: string }[]; onPress(): void; accessibilityLabel: string }`.
- **Estados:** normal, pressionado.
- **A11y:** um link por item com rótulo composto ("Helena Varga, Tremere. Vitalidade: …"); avatar e chevron ocultos.
- **Multi-sistema:** uma lista mistura Vampiro, D&D e CoC, cada linha com a própria skin e accent; a linha da Mesa reaproveita o `dock` do template ([Vitalidade, Sangue, FdV] ou [PV, SAN, Sorte]).
- **Resolve:** C-13, C-19, C-20, §7.

### TabBar

Navegação principal do app, fora da ficha.

- **Classes:** `ds-tabbar` (fixa embaixo, 4 colunas, `surface-raised`, safe area); links de 56 com ícone + legenda; ativo com `aria-current="page"` (`ink` e traço de 2px em `accent` no topo).
- **Abas:** Crônicas, Personagens, Dados, Perfil. Não aparece na ficha, onde o dock ocupa o lugar.
- **API RN:** `Tabs` do Expo Router com `{ name: string; title: string; icon: IconName }` (proposta).
- **Estados:** ativa, inativa.
- **A11y:** `nav aria-label="Navegação principal"` + `aria-current`; RN `accessibilityState={{ selected }}`.
- **Multi-sistema:** a mesma barra para quem joga um ou vários sistemas; nada nela depende do template.
- **Resolve:** C-20, §7.

### AppBar / BackLink

Barra de topo das telas de lista e voltar como alvo único.

- **Classes:** `ds-appbar` (sticky, safe area, borda inferior), `ds-appbar__title` (`h1` com reticências), `ds-back` (chevron + nome, 44).
- **Usos:** Crônicas, Mesa e estados de erro da ficha ("‹ Noites de São Paulo").
- **API RN:** `{ title: string; back?: { label: string; onPress(): void }; actions?: ReactNode }`.
- **Estados:** estático.
- **A11y:** voltar com texto visível; título `h1`.
- **Multi-sistema:** o rótulo do voltar é o nome da crônica, seja de Vampiro ("Noites de São Paulo") ou de CoC ("Sombras sobre Ouro Preto").
- **Resolve:** C-20, C-21.

### Breadcrumb

Trilha de navegação no web.

- **Classes:** `ds-breadcrumb` (`ol`, caption `ink-muted`, links de 44, separador `›` oculto, atual com `aria-current="page"` em `ink`). Só a partir de 900.
- **API RN:** `{ items: { label: string; href?: string }[] }` (só no build web).
- **Estados:** estático.
- **A11y:** `aria-label="Você está em"`.
- **Multi-sistema:** "Crônicas › {crônica} › {personagem}" em qualquer sistema.
- **Resolve:** C-20.

---

## Dados

### DiceRoller

Casca única de parada de dados; a mecânica vem de `roll.model`.

- **Classes do DS:** `ds-dice`, `ds-die` (40; `.is-success` em `accent`, `.is-one` tracejado em `danger`, `.is-dropped` riscado e esmaecido), `ds-result` + `ds-result__big`. A casca ainda usa classes do protótipo (`p-pick`, `p-picker`, `p-mods`, `p-total`, `p-toggle`): promover ao core é proposta.
- **Fluxo** (sheet "Parada de dados"): atalhos (presets do template e "Última: …"); um seletor com busca por `roll.slots`; controles do modelo; impulsos (`boosts`) com saldo; "Modificadores (com origem)"; linha da parada; rodapé **"Rolei na mão"** (registra o resultado físico) e **"Rolar no app"**. Personagem incapacitado não rola.
- **Modelos:** `pool-success` (dificuldade; especialização "cada 10 vale dois"), `sum-vs-target` (Automático/Normal/Vantagem/Desvantagem; alvo), `roll-under-percent` (dados de bônus ou penalidade; regular, difícil, extremo), `fudge` (oposição; tensões), `pbta-2d6` (10+, 7–9, 6−).
- **API RN:**

  ```ts
  type DiceRollerProps = {
    model: 'pool-success' | 'sum-vs-target' | 'roll-under-percent' | 'fudge' | 'pbta-2d6'
    slots: { id: string; label: string; optional?: boolean }[]
    optionsFor(slot: string): { key: string; label: string; value: number }[]
    modifiers: { source: string; text: string }[]
    onRoll(): Promise<{ faces: string[]; outcome: string }>; onManual(value: number): void
  }
  ```
- **Estados:** montando, pronto, bloqueado (falta escolha ou incapacitado), resultado, entrada manual.
- **A11y:** resultado em `role="status"` e anunciado ("Destreza + Esportes: 3 sucessos"); dados ocultos (o texto resume); seletor com `aria-expanded`; histórico "Rolagens da sessão".
- **Segurança:** rolagem que vale para a mesa é do servidor; a local usa `crypto.getRandomValues` sem viés de módulo e bloqueia se não houver crypto (fail secure).
- **Multi-sistema:** d10 contra dificuldade com penalidade de ferimento e FdV (WoD; "Conjurar efeito" do Mago é preset); d20 + mod com vantagem automática por condição (D&D); d100 com dados de bônus (CoC, presets "Teste de Sanidade" e "Teste de Sorte"); 4dF + invocar aspecto (Fate); 2d6 + stat (PbtA).
- **Resolve:** C-07, C-12, §9.

---

## Skin

### AugurMoon (glifo da skin WoD)

Fase da lua do augúrio. Não é componente do core.

- **`ui.js`:** `moon(phase, size = 28)` → SVG `ds-glyph-moon`, `aria-hidden`. Contorno `border-control` de 1.5 **sempre visível** (a lua nova não some); parte iluminada em `accent-alt-warm`; terminador em arco elíptico (`rx = |1 − 2·fase|·r`), o que dá crescente, meia-lua e gibosa.
- **Dados:** campo `choice` com `"glyph": "augur-moon"` e `glyphParam` 0, 0.25, 0.5, 0.75 e 1 nas opções; aparece ao lado do valor nos fatos de identidade (`p-inline-glyph`).
- **API RN:** `{ phase: number; size?: number }` com `react-native-svg`.
- **Estados:** cinco fases (contínuo de 0 a 1).
- **A11y:** decorativo; o augúrio e a fase ("lua nova") estão em texto.
- **Multi-sistema:** só a skin WoD registra este glifo (`REGISTRY.glyphs`). Outra skin registra o próprio pelo mesmo mecanismo (ex.: um ícone de classe desenhado pelo time para D&D, sem propriedade intelectual de terceiros); CoC e Fate não precisam de glifo.
- **Resolve:** C-23, DS-13.

### Forma do pip e glifos de dano (skin)

O que a skin muda nos primitivos sem criar componente.

- **Forma do pip** (`pip` na skin): `circle` (`wod`, `fate`); `diamond` (`dnd`: quadrado girado 45° e reduzido a 0,82); `square` (`coc`: raio 2). Hoje a regra está fixa por id de skin no `components.css` (pendência no README).
- **Glifos de dano:** `/`, `X` e `✱` e seus nomes vêm do template (`track.types`), validados como texto de até 3 caracteres. A skin `wod` declara `damage-glyphs`, mas ainda não define traço próprio.
- **API RN:** `skin.pip` lido pelo `RatingDots`; o glifo de dano é `<Text>` dentro da caixa.
- **A11y:** forma e glifo são visuais; o nome do tipo está sempre em texto.
- **Multi-sistema:** o losango e o quadrado dão identidade a D&D e CoC sem componente novo; Changeling e Aparição podem usar outros glifos de dano vindos do template.
- **Resolve:** C-05, DS-02.
