# TMS Grimório: design system

O TMS é um gerenciador de fichas de RPG de mesa. Este diretório guarda o **design** do design system (tokens, CSS de referência, construtores de componentes e vitrine), corrigido a partir da avaliação de UI/UX em `doc/avaliacao-ui-ux.md`. Ainda não é a implementação: é a fonte da verdade para quem for escrever `packages/ui` em React Native.

Os IDs `C-xx` apontam para os achados consolidados (§4 da avaliação) e os `DS-xx` para o Anexo A. O catálogo de componentes está em [`components.md`](components.md).

Regra que vale para todo o documento: **o código conhece tipos genéricos; o template conhece o sistema.** Cada seção termina com uma linha **Multi-sistema:** que explica como a decisão serve World of Darkness (WoD), D&D 5e, Call of Cthulhu (CoC) e Fate/PbtA.

---

## 1. O que é e como abrir

| Arquivo | O que é | Editar à mão? |
|---|---|---|
| `tokens.json` | Tokens do core: cor, tipo, espaço, raio, tamanho, borda, elevação, motion, camadas, breakpoints e layout. Cada token tem `usage`. | Sim |
| `skins/*.json` | Skins por família de sistema: `wod`, `dnd`, `coc`, `fate`. | Sim |
| `tokens.css`, `tokens.js` | CSS vars e cópia JS dos tokens, geradas pelo build. | **Não** |
| `components.css` | CSS de referência dos componentes (classes `ds-*`). Só consome `var(--token)`, sem cor literal e sem `@import` de fonte. | Sim |
| `ui.js` | Construtores de markup e acessibilidade: `h`, `s`, `icon`, `pips`, `clock`, `moon`, `announce`, `toast`, `sheet`, `confirmDialog`, `stepper`, `initials`. | Sim |
| `index.html` + `vitrine.js` | Vitrine: tokens com contraste calculado na hora e componentes vivos. | Sim |
| `scripts/check_tokens.py` | CI de cor: contraste WCAG e ΔE2000 contra `action` com daltonismo simulado. | Sim |
| `../scripts/build.mjs` | Gera `tokens.css`, `tokens.js` e `../telas/dados.js`; valida templates e personagens de exemplo. | Sim |
| `../scripts/validate.mjs` | Contrato do template: listas fechadas (`REGISTRY`), `validateTemplate` e `validateSheet`. | Sim |
| `../templates/*.json` | Templates de exemplo: `vtm-v20`, `mta-m20`, `wta-w20`, `dnd5e-2014`, `coc7e`, `fate-core`. | Sim |
| `../telas/` | Protótipo navegável (ficha, crônicas, mesa) que usa os mesmos componentes. | Sim |

**Vitrine.** Abra `design/design-system/index.html` direto no navegador (funciona por `file://`, sem servidor). A barra do topo troca tema (Noite/Pergaminho), skin, accent e a opção "Títulos sem fonte decorativa". As escolhas ficam no `localStorage` com o prefixo `tms-ds:`, e a página funciona sem ele.

**Protótipo.** Abra `design/telas/index.html`. Ele lista as fichas de cada sistema e os estados (carregando, offline, conflito, erro, sem permissão, ficha nova, arquivada, Evoluir, narrador), com tema e escala de fonte (`#fs=1.3`) na URL.

**Comandos** (na raiz do repositório):

```bash
# Gera tokens.css, tokens.js e telas/dados.js; valida templates e personagens (sai com 1 se algo for inválido)
node design/scripts/build.mjs

# CI de cor: contraste, on-*, paleta de accent e ΔE contra action (sai com 1 se alguma regra falhar)
python3 -I design/design-system/scripts/check_tokens.py design/design-system/tokens.json design/design-system/skins/*.json
```

Nenhum dos dois tem dependências além do Node e da biblioteca padrão do Python. Hoje o check roda **162 verificações, todas passando**.

**Multi-sistema:** a vitrine troca de skin e de accent sem trocar de componente, e o protótipo abre fichas de seis templates (três de WoD, D&D 5e, CoC 7e e Fate Core) com o mesmo renderizador.

---

## 2. Três camadas: core + skin + dados

| Camada | O que vive aqui | Onde | Quem muda | Exemplo |
|---|---|---|---|---|
| **Core** | Tokens semânticos (`action`, `accent`, `accent-alt-*`, `danger`, `success`, `border-*`, `state-*`, `elevation-*`, `duration-*`), primitivos de valor, layout, feedback, esqueleto de tela, gramática de acessibilidade | `tokens.json`, `components.css`, `ui.js` (no app: `packages/ui`) | Time de DS, raramente | `RatingDots`, `NumberField`, `Resource`, `BottomSheet` |
| **Skin** | Fonte display e de voz, forma do pip, glifos, e (opcional) valores de tokens de cor do core | `skins/<id>.json` | Time de produto, uma vez por família de sistemas | `wod` (o Grimório), `dnd`, `coc`, `fate` |
| **Dados** | Campos e tipos, faixas, derivações e regras por nome (lista fechada), seções e zonas, `dock`, `roll`, rótulos pt-BR, mapa de identidade → `accent-N`, permissões por seção | `trait_templates.template_data` (aqui: `design/templates/*.json`) | Conteúdo, sem deploy | `{ "type": "rating", "max": 5, "editableIn": ["edit"] }` |

O que **não** pode acontecer:

- nome de sistema, mecânica ou termo de jogo em token do core ou em código de tela;
- cor livre vinda do banco (o template só referencia `accent-N` ou `accent-neutral`);
- expressão avaliada a partir do template (`eval`, `new Function`): `derive`, `rule`, `effect` e `roll.model` são nomes de uma lista fechada (`REGISTRY` em `validate.mjs`);
- rótulo do template tratado como HTML (o validador recusa `<` e `>`, e `ui.js` só usa `textContent`).

**Checklist antes de aprovar um token ou componente** (resumo do §3.8):

- [ ] Funciona com `rating`, `number`, `percent` **e** `text`? Se não, é skin ou template.
- [ ] Algum termo de jogo aparece no nome do token ou no código de tela?
- [ ] Ordem, rótulos e presença de seções vêm do template?
- [ ] O layout decide pelo espaço medido e pelo `fontScale`, nunca pelo sistema?
- [ ] O anúncio do leitor de tela é gerado pelo tipo?
- [ ] A proposta foi esboçada também para D&D 5e ou CoC?

**Multi-sistema:** Vampiro e D&D usam o mesmo esqueleto e os mesmos componentes; muda a skin (Grenze × Cinzel, pip redondo × losango) e o template (`rating` × `number score+mod`, dock `[Vitalidade, Sangue, FdV]` × `[PV, CA, Espaços]`). Um sistema novo é uma linha em `trait_templates`, sem migration e sem tela nova. Resolve C-05 e DS-02.

---

## 3. Princípios

| Antes (Grimório só de WoD) | Agora |
|---|---|
| "Pontos são a linguagem; nunca número solto." | O valor aparece **na notação nativa do sistema**, declarada no template (`rating`, `number` com `display`, `percent`, `text`…). O número está sempre disponível: visível ao lado dos pips ou no anúncio do leitor de tela. |
| "A cor vem do personagem: cada sistema e cada raça." | O `accent` é **opcional** e vem dos dados (clã, tribo, classe, playbook). Sem accent, a ficha usa `accent-neutral`. A cor nunca identifica sozinha: o nome e as iniciais acompanham. |
| "Gótico só nos títulos." | A fonte display é **da skin**. Texto de leitura e números são sempre a sans do core. |
| "Use os termos da edição brasileira." | Rótulos vêm do template, por sistema e edição. O DS não contém termos de jogo. |
| "Celular primeiro, mesa de jogo." | Mantém, agora medido: alvos de 44, linha inteira como alvo, recursos de combate na zona do polegar. |
| (não existia) | **Leitura, Jogo e Evoluir:** tocar nunca altera traço permanente por acidente, e toda alteração tem Desfazer. |

**Multi-sistema:** os princípios antigos eram falsos fora de WoD (um 15 (+2) de D&D não cabe em pontos; CoC não tem raça). Os novos valem para os seis templates de exemplo sem exceção. Resolve DS-02 e o §3.3.

---

## 4. Renomeação de tokens

| Antes | Agora | Observação |
|---|---|---|
| `ouro` / `on-ouro` | `action` / `on-action` | Mesmos valores. Ação nunca é identidade. |
| `lineage` | `accent` + `accent-text` + `on-accent` | Resolvidos por `data-accent="accent-N"`. Padrão: `accent-neutral`. |
| `paradoxo` | `accent-alt-cool` | O template escolhe com `colorRole: "alt-cool"`. |
| `gnose` | `accent-alt-warm` | `colorRole: "alt-warm"`. |
| `sis-*`, `cla-*`, `trad-*`, `tribo-*` (42 cores) | saem do DS | O template mapeia a identidade para `accent-1…16`. |
| `dot-empty` | `pip-empty` | No pergaminho: `#8f8287` → `#86797e` (3.58:1 sobre `bg`). |
| `line` | `border-subtle` | Decorativa. |
| `line-strong` | `border-control` | No pergaminho: `#92858b` → `#86797f` (de 3.04 para ≥ 3.58:1). |
| larguras 1 / 1.5 / 2 px fixas no CSS | `border-width-hair` / `border-width-control` / `border-width-focus` | Prefixo `border-width-` para não colidir com a cor `border-control`. |
| estilo `trait` | `field-label` | 16/500. |
| estilo `quote` (18/500) | `voice` (20/600, itálico) | Legibilidade (DS-10). |
| estilo `label` (12, 0.14em) | `label` (13, 0.8px) + `overline` (12, 1.6px, só decorativo) | Piso de 13 para texto com significado. |
| `display-xl` 34 | `display-xl` 32 | |
| família `display` | `skin.display` (`--font-display`) | Vem da skin. Também `skin.voice` (`--font-voice`). |
| (não existiam) | `focus`, `focus-on-action`, `accent-neutral`, `danger`, `success`, `on-*`, `ink-disabled`, `state-hover`, `state-pressed`, `scrim`, `elevation-1/2`, `duration-*`, `easing-*`, `layer-*`, breakpoints, `layout`, `row-min`, `pip-size(-sm)`, `pip-hit-w`, `box-size`, `box-hit`, `stepper-size`, `avatar-*`, `header-height`, `chips-height`, `dock-height` | C-14, DS-04, DS-07. |

**Multi-sistema:** nenhum nome do core cita mecânica. Pathos/Angústia (Aparição), Glamour/Banalidade (Changeling) e PV/PV temporário (D&D) usam `accent` + `accent-alt-*` sem token novo. Resolve C-05, C-13, C-14, DS-02, DS-03, DS-07.

---

## 5. Cor

### 5.1 Papéis

Cada token de cor tem um `role`, e o `check_tokens.py` aplica a regra do papel nos dois temas, contra `bg`, `surface` e `surface-raised`:

| `role` | Regra | Exemplos |
|---|---|---|
| `text` | ≥ 4.5:1 | `ink`, `ink-muted`, `action`, `accent-neutral`, `danger`, `success` |
| `non-text` | ≥ 3:1 | `border-control`, `pip-empty`, `focus`, `focus-on-action`, `accent-alt-*` |
| `on` | ≥ 4.5:1 sobre a cor indicada em `on` | `on-action`, `on-danger`, `on-success`, `on-accent-neutral` |
| `surface`, `state`, `decorative` | isento (nunca carrega significado sozinho) | `bg`, `scrim`, `border-subtle`, `ink-disabled` |

### 5.2 Superfícies e elevação

| Superfície | Noite | Pergaminho | Uso | Elevação obrigatória |
|---|---|---|---|---|
| `bg` | `#120e10` | `#f1edee` | Fundo da tela | – |
| `surface` | `#1b1518` | `#faf8f8` | Cartões, blocos da ficha | `elevation-1` + borda 1px `border-subtle` |
| `surface-raised` | `#251d21` | `#ffffff` | Sheets, menus, dock, chip ativo | `elevation-2` + borda `border-subtle` |

`bg × surface` tem só 1.06:1 (noite) e `surface × surface-raised` 1.06:1 (pergaminho): uma folha branca sobre um cartão some sem sombra. Por isso as superfícies **sempre** se separam por borda + sombra, nunca só por cor. A sombra é uma string (`0 1px 2px rgba(0,0,0,0.24)`), aceita como `boxShadow` no RN 0.81.

### 5.3 Action

`action` (`#d9a441` / `#8a6414`) é a cor de ação: botão primário, chip "Dados" do dock, link e botão ghost. Texto sobre ela usa `on-action`. **Botões nunca usam `accent`**, e `action` nunca é cor de identidade.

### 5.4 Accent

- **Paleta fixa e validada** de 16 cores (`accent-1` a `accent-16`). Cada uma tem três valores por tema:
  - `fill` (pips, caixas, régua de seção, borda do chip): ≥ 3:1;
  - `text` (rótulos como "Afinidade", via `accent-text`): ≥ 4.5:1;
  - `on` (texto sobre o `fill`): ≥ 4.5:1.
- **ΔE2000 ≥ 10 contra `action`** com visão normal, protanopia e deuteranopia (Machado 2009, severidade 1.0). Isso evita o caso Ravnos (botão e pips da mesma cor).
- **`accent-neutral`** (`#ab9c9f` / `#5e5156`) é o padrão em `:root`: fora da ficha, em personagem sem linhagem e em sistemas sem accent (CoC e Fate). Substitui o uso da cor do sistema, que deixava Tremere idêntico a "Vampiro sem clã" (ΔE 1.7).
- **Aplicação:** o template declara `accent: { from, map, fallback }`; o app resolve para `data-accent="accent-N"` e o CSS gerado define `--accent`, `--accent-text` e `--on-accent` naquele escopo. Cada item de lista recebe o próprio `data-accent`, então uma lista com personagens de sistemas diferentes funciona.
- **Nome e iniciais sempre acompanham a cor.** O check informa (sem falhar) os pares de accent com ΔE < 5 em alguma visão: hoje são 16 no noite e 20 no pergaminho, e o pior é `accent-7 × accent-8` (ΔE 0.4–0.5 com daltonismo simulado). O DS-08 mostrou que nenhuma paleta distingue 14 clãs só pela cor, então o `IdentityChip` sempre traz o nome e o `Avatar` sempre traz as iniciais.

| Token | Rótulo | Matiz | `fill` noite | `fill` pergaminho |
|---|---|---|---|---|
| `accent-1` | Carmesim | 22 | `#ed4952` | `#97011f` |
| `accent-2` | Ferrugem | 40 | `#dc5e2d` | `#862b01` |
| `accent-3` | Oliva | 118 | `#7d8d20` | `#434d01` |
| `accent-4` | Musgo | 145 | `#379440` | `#005211` |
| `accent-5` | Jade | 172 | `#16a384` | `#04755d` |
| `accent-6` | Ciano | 205 | `#099eab` | `#06717a` |
| `accent-7` | Azul real | 255 | `#468de5` | `#1762b6` |
| `accent-8` | Índigo | 282 | `#7f7ee4` | `#5953b5` |
| `accent-9` | Violeta | 308 | `#a76ed6` | `#7d43a8` |
| `accent-10` | Magenta | 340 | `#cd5cac` | `#9e3081` |
| `accent-11` | Rosa | 0 | `#ca6789` | `#9c3e60` |
| `accent-12` | Ardósia | 265 | `#828ca2` | `#596378` |
| `accent-13` | Ferro | 15 | `#a88082` | `#7d585a` |
| `accent-14` | Osso | 100 | `#908d78` | `#676450` |
| `accent-15` | Bronze | 50 | `#b27f63` | `#7b4c31` |
| `accent-16` | Céu | 230 | `#5595b4` | `#296b88` |

Os valores de `text` e `on` estão no `tokens.json`.

### 5.5 Accent-alt (par de recursos) com hachura

`accent-alt-cool` (`#d8e6f2` / `#24384c`) e `accent-alt-warm` (`#e6e0c8` / `#3a3826`) são quase neutros e servem ao **segundo recurso de um par**. O template escolhe pelo `colorRole` do campo (`accent`, `alt-cool`, `alt-warm`, `neutral`). O preenchimento é **sempre hachurado**, para nunca depender só da cor:

- caixas: `ds-box.is-filled.is-alt-*` com `repeating-linear-gradient(135deg, …)`;
- `Clock`: `<pattern>` SVG `hatch-alt-cool` / `hatch-alt-warm`;
- dock: amostra cheia para o principal e hachurada para o par, sempre com o número.

### 5.6 Estados

| Token | Noite | Pergaminho | Regra |
|---|---|---|---|
| `danger` / `on-danger` | `#f2726a` / `#1a0a0a` | `#b3261e` / `#ffffff` | Sempre com ícone e texto. No pergaminho fica perto de `accent-1`. |
| `success` / `on-success` | `#6cc287` / `#0b1a10` | `#1f7a3d` / `#ffffff` | Sempre com ícone e texto. |
| `ink-disabled` | `#7a6d72` | `#958a8e` | Isento de contraste; o motivo do bloqueio vai em texto quando não for óbvio. |
| `state-hover` | `rgba(239,230,225,0.06)` | `rgba(28,20,23,0.04)` | Só com `@media (hover: hover)`. |
| `state-pressed` | `rgba(239,230,225,0.12)` | `rgba(28,20,23,0.08)` | Camada `::after` de `.ds-pressable` em todo alvo tocável. |
| `scrim` | `rgba(8,5,6,0.64)` | `rgba(28,20,23,0.40)` | Atrás de sheet e diálogo. |

### 5.7 Foco

- `:focus-visible` desenha anel de `border-width-focus` (2px) em `focus`, com offset de 2px.
- Controles preenchidos com `action` (botão primário, chip "Dados") usam `focus-on-action` (a cor de `ink`), para o anel não se confundir com o próprio botão (C-14).
- O botão "Desfazer" do toast usa anel em `bg`, porque o toast é invertido (fundo `ink`).
- No RN 0.81, `outlineColor`, `outlineWidth` e `outlineOffset` existem e valem para web e teclado físico (DS-05).

**Multi-sistema:** a mesma validação vale para clãs, tribos e tradições de WoD, as 12 classes de D&D, os playbooks de PbtA e qualquer cor que o jogador escolher no futuro. CoC e Fate usam `accent-neutral` sem exceção no código, e o par Fúria/Gnose do Lobisomem é o mesmo par Pathos/Angústia da Aparição. Resolve C-13, C-14, C-16, DS-03, DS-04, DS-07, DS-08, DS-09.

---

## 6. Tipografia

### 6.1 Famílias

| Camada | Família | Pesos no app (`fontFamily` por peso) | Uso |
|---|---|---|---|
| Core | Alegreya Sans | `400`, `400italic`, `500`, `700` | Todo texto de leitura, rótulos e **números** |
| Skin `wod` | Grenze Gotisch (display) · Cormorant Garamond (voz) | display `600`, `700` · voz `600italic` | Nome e títulos de seção · citação e conceito |
| Skin `dnd` | Cinzel · Alegreya | `600`, `700` · `600italic` | Nome e títulos · traços de personalidade |
| Skin `coc` | IM Fell English (display e voz) | um peso só: `600` e `700` apontam para o mesmo arquivo | Nome e títulos · histórico |
| Skin `fate` | Alegreya Sans (display e voz) | `700` · `400italic` | Títulos em sans; aspectos em itálico |

Todas sob SIL Open Font License 1.1.

**Carregamento.** As fontes ficam **hospedadas no app** com `expo-font` (via `@expo-google-fonts/*` ou arquivos `.ttf` no repositório). É **proibido** `@import` do Google Fonts: bloqueia a renderização e envia o IP de cada usuário a um terceiro, o que exige transparência e base legal pela LGPD. O `components.css` não tem `@import`. Na web, `font-display: swap` e preload dos dois pesos críticos (proposta do DS-10). A Grenze 500 foi removida porque nenhum estilo a usava.

### 6.2 Escala

| Estilo | Família | Tamanho (dp) | `lineHeight` (razão) | Peso | Extra | Uso |
|---|---|---|---|---|---|---|
| `display-xl` | skin.display | 32 | 1.15 | 700 | | Nome no bloco de identidade expandido e no web |
| `display-lg` | skin.display | 24 | 1.2 | 600 | | Título de seção |
| `display-sm` | skin.display | 20 | 1.2 | 700 | | Nome no header compacto (1 linha, reticências) |
| `title` | sans | 17 | 1.3 | 700 | | Título de grupo, sheet e cartão |
| `field-label` | sans | 16 | 1.375 | 500 | | Nome do campo na linha |
| `body` | sans | 15 | 1.47 | 400 | | Texto corrido |
| `label` | sans | 13 | 1.3 | 700 | caixa alta, `letterSpacing` 0.8 | Chips de seção, cabeçalho compacto |
| `caption` | sans | 13 | 1.38 | 400 | | Especialização, origem de modificador, legenda |
| `overline` | sans | 12 | 1.33 | 700 | caixa alta, 1.6, `maxFontSizeMultiplier` 1.3 | Só decorativo |
| `voice` | skin.voice | 20 | 1.4 | 600 | itálico | Conceito e citação, uma vez por tela |
| `number-lg` | sans | 28 | 1.15 | 700 | tabular | Valor em destaque (sheet, penalidade, resultado) |
| `number` | sans | 16 | 1.375 | 700 | tabular | Valor ao lado dos pips e no dock |
| `number-sm` | sans | 13 | 1.38 | 500 | tabular | ½ e ⅕, máximo, contadores |

O build gera as classes `.t-<estilo>` e as vars `--type-<estilo>-size/-line/-weight/-spacing`.

### 6.3 Regras

- Tamanhos em **dp**; `lineHeight` como **razão**; `letterSpacing` em **px** (o RN não tem `em`).
- **Piso de 13dp** para texto com significado. O 12 vale só para `overline`, que repete informação presente em outro lugar.
- **Números sempre na sans do core, com `tabular-nums`**, nunca na display da skin (algarismos blackletter são os menos legíveis com pouca luz).
- O sinal de menos visual é `−` (U+2212); o leitor de tela ouve "menos".
- `allowFontScaling` fica ligado. Só o `overline` limita a escala (1.3).
- **Nome do personagem:** no header compacto, `display-sm` em 1 linha com reticências; no bloco expandido, no máximo 2 linhas (`numberOfLines={2}`).
- **"Títulos sem fonte decorativa"** (menu ⋯ > Tema e leitura; `data-plain-titles="true"` na web) troca display e voz pela sans do core em qualquer skin. A skin `fate` é esse mesmo visual por padrão.

**Multi-sistema:** a fonte de títulos muda com a skin (gótica no WoD, romana no D&D, tipografia de época no CoC, sans no Fate), mas o texto de leitura, os números e as regras de escala são do core. Por isso "PV 127/134 +12", "Usar Bibliotecas 45 · ½ 22 · ⅕ 9" e "Atletismo +4 Ótimo" têm a mesma legibilidade em qualquer ficha. Resolve C-09, C-15, DS-06, DS-10.

---

## 7. Medidas e alvos de toque

O visual e o alvo de toque são **separados**: o pip tem 16, mas o alvo é a linha inteira (48) ou o botão (44). Em leitura e em jogo, pips e caixas são só visuais (`aria-hidden`).

| Token | Valor | Uso |
|---|---|---|
| `hit-size` | 44 | Menor alvo permitido (44×44). Abaixo disso, `hitSlop` até 44. |
| `row-min` | 48 | Altura mínima da linha de campo; a linha inteira é um único alvo. |
| `pip-size` / `pip-size-sm` | 16 / 12 | Pip em linha e célula / pip de escala 0–10 (só visual). |
| `pip-hit-w` | 32 | Reservado para pip individualmente tocável. Hoje nenhum componente usa: a edição é pelo `Stepper`. |
| `box-size` / `box-hit` | 24 / 44 | Caixa visual / alvo da caixa tocável (slots, estresse), com gap ≥ 8 (`ds-boxes--hit`). |
| `stepper-size` | 56 | Botões − e + do `Stepper` em sheet (o inline usa 44). |
| `icon-size` | 24 | Ícone dentro de um alvo de 44. |
| `header-height` / `chips-height` / `dock-height` | 48 / 44 / 64 | Header compacto, faixa de chips, dock (sem safe area). |
| `avatar-sm` / `avatar-lg` | 40 / 72 | Avatar em lista e header / bloco de identidade. |

Outros alvos do CSS: célula da grade 64, chip do dock 56, rádio 56, item de lista 72, aba da tab bar 56.

**Espaço** (`space-*`): 2, 4, 8, 12, 16 (gutter e padding de cartão), 20 (padding de sheet), 24 (entre seções), 32, 40, 48. **Raio:** `radius-sm` 4 (caixas), `radius-md` 10 (botões, cartões, chips do dock), `radius-lg` 16 (sheet e diálogo), `radius-pill` 999 (pips, chips, avatar).

**A conta em 360dp** (DS-01, refeita para o pip só visual): 360 − 2×16 de gutter − 2×16 de padding da lista = 296dp de linha. Cinco pips ocupam 5×16 + 4×4 = 96; somando 12 até o número, ~20 do número e 12 entre nome e valor, sobram ≈ 156dp para o nome, e "Conhecimentos" cabe sem abreviar. Escalas de 0 a 10 usam o pip de 12 com um respiro depois do 5º.

**Multi-sistema:** o contrato ergonômico é por tipo e não por sistema: a linha de 48 serve à Destreza (WoD), ao Arcanismo +7 (D&D), ao Esquivar 45% (CoC) e ao Atletismo +4 (Fate). Caixas tocáveis de 44 servem aos espaços de magia (D&D) e ao estresse (Fate) do mesmo jeito. Valores grandes (PV 134, perícia 45%) são editados com ± e teclado numérico, nunca com setas pequenas. Resolve C-02, DS-01, DS-07.

---

## 8. Modos, Desfazer, histórico e restrição não destrutiva

### 8.1 Três modos

| Modo | Quando | O que se toca | Sinal na tela |
|---|---|---|---|
| **Leitura** | Ficha de outra pessoa, ficha arquivada | Nada altera. Toda linha abre o detalhe. | `ModeBar` "Leitura · Ficha de {dono}". O narrador vê "Editar como narrador". |
| **Jogo** (padrão do dono) | Durante a sessão | Campos com `editableIn` contendo `"play"`: recursos, trilhas, slots, estados, condições e textos. Traços permanentes abrem o detalhe, com "Alterar valor" e a nota "Traço permanente: muda só em Evoluir". | Sem barra. |
| **Evoluir** | Entre sessões; menu ⋯ > "Evoluir personagem" ou "Alterar valor" | Tudo o que o papel pode escrever. `rating`, `number` e `percent` ganham `Stepper` inline na linha; `mark` e `choice` abrem o editor em sheet. O filtro "só investidos" desliga. | `ModeBar` "Evoluindo · N alterações não salvas" + "Concluir". |

- Os modos de UI são `read`, `play` e `evolve`. No template, `editableIn` aceita `"play"` e `"edit"`; **`"edit"` significa "editável em Evoluir"**.
- Padrão quando o template não declara: `text` e `longText` → `["play", "edit"]`; os demais tipos → `["edit"]`.
- **Evoluir trabalha num rascunho.** "Concluir" mostra o resumo "N alterações" (campo, de → para) com **Salvar** e **Descartar**. Salvar gera um único evento "Evolução salva: N alterações".
- O **narrador** abre fichas da crônica em Leitura. "Editar como narrador" troca para Jogo com a barra "As alterações ficam assinadas no histórico".
- O `Stepper` muda **1 por toque e nunca salta**. "Tocar no valor atual reduz 1" foi removido (§5 da avaliação).

### 8.2 Desfazer e histórico

- Toda alteração vira um evento `{ id, at, by, byRole, changes: [{ id, from, to }], label }`, aplicado na hora (local-first) e enfileirado para sincronização.
- Em Jogo, cada evento mostra um `Toast` de 5 s com o rótulo e "Desfazer": "Sangue 10 → 9", "PV 27+5 → 25 (7 de dano)", "Espaço de 1º nível usado (2/4)".
- Desfazer cria um evento inverso, "Desfeito: …", que é anunciado e não gera outro toast.
- O sheet "Histórico de alterações" lista quem, quando e o quê, com "(narrador)" quando for o caso. A fila offline nunca guarda credenciais, só eventos.

### 8.3 Restrição não destrutiva

Tetos vêm do template (`cap: { field, label }`) e **nunca apagam valor**:

- Com Arete 3, Forças 4 aparece como "3" com a nota "1 inativo · máx. pelo Arete (3)", a linha fica com rótulo em `ink-muted` (`.is-inactive`) e o leitor de tela ouve "Forças, 3 de 5, 1 inativo, máx. pelo Arete 3".
- Quando o Arete sobe, o ponto volta a valer sozinho. O `validateSheet` aceita valor acima do teto: o teto afeta a leitura, não o dado.
- Modificador de estado (forma, condição) também não toca no valor base: Força 3 em Crinos aparece como 7 com "3 + 4 da forma Crinos = 7", e o base só muda em Evoluir.

**Segurança:** o modo é UX, **não é controle de acesso**. O servidor valida cada escrita (o dono edita a própria ficha; o narrador, fichas da crônica dele; os demais só leem; sem regra, nega) com o mesmo validador do template (§9 da avaliação).

**Multi-sistema:** o modo vem de `editableIn` por campo, não do tipo visual. PV, espaços de magia e condições do D&D ficam em Jogo e atributos em Evoluir; SAN e Sorte do CoC em Jogo e perícias em Evoluir; estresse e Pontos de Destino do Fate em Jogo e perícias em Evoluir. O teto é um `cap` genérico (Esferas ≤ Arete hoje; SAN máx. = 99 − Mitos é uma derivação). Resolve C-01, C-16, C-19, DS-04.

---

## 9. Acessibilidade

### 9.1 Um controle por linha

Cada linha, célula da grade e chip do dock é **um** `button` com `aria-label` gerado pela gramática do tipo e `aria-haspopup="dialog"`. Pips, caixas, mini-trilha e glifos ficam `aria-hidden`. O número de paradas de foco cai de ~169 para ~50 por ficha.

### 9.2 Gramática de anúncio por tipo

O app monta a frase; os nomes vêm do template (`describe()` em `prototipo.js`). Visualmente o sinal é `−`; falado, "mais/menos".

| Tipo | Forma | Exemplos |
|---|---|---|
| `rating` | "{rótulo}, {valor} de {máx}[, {rótulo do valor}][, base {b} mais {n} da forma {estado}][, {n} inativo, {teto}][, especialização {s}]" | "Destreza, 2 de 5" (Vampiro) · "Posto, 2 de 5, Fostern" (Lobisomem) · "Forças, 3 de 5, 1 inativo, máx. pelo Arete 3" (Mago) |
| `number` `score+mod` | "{rótulo}, {valor}, modificador {±}" | "Inteligência, 18, modificador mais 4" (D&D) |
| `number` `signed` | "{rótulo}, {±}" | "Iniciativa, mais 2" (D&D) · stat de PbtA |
| `number` `ladder` | "{rótulo}, {adjetivo}, {±}" | "Atletismo, Ótimo, mais 4" (Fate) |
| `percent` | "{rótulo}, {v} por cento; difícil {½}; extremo {⅕}" | "Esquivar, 45 por cento; difícil 22; extremo 9" (CoC) |
| `mark` | "{rótulo}, {estado}[, {±bônus}]" | "Arcanismo, proficiente, mais 7" (D&D) |
| `resource` | "{rótulo}, {atual} de {máx}[, mais {t} temporários][, permanente {p}]" | "Pontos de Sangue, 9 de 15" · "Pontos de Vida, 27 de 27, mais 5 temporários" · "Sanidade, 52 de 99" |
| `resource` sem teto no temporário | "{rótulo}: permanente {p}, temporário {t}" | "Glória: permanente 3, temporário 4" (Lobisomem) |
| `track` `wod-stacking` | "{rótulo}: {nível}, penalidade {±}; {n} {tipo}, …" | "Vitalidade: Machucado, penalidade menos 1; 1 letal, 1 contusivo" |
| `track` `boxes` | "{rótulo}: {linha} {n} de {N} marcadas; …" | testes contra a morte (D&D) · estresse (Fate) |
| `clock` | "{preenchimento} {n}, …, de {N} casas" | "Quintessência 6, Paradoxo 2, de 20 casas" · relógio de PbtA |
| `state` | "{rótulo}: {opção}" | "Forma: Crinos" |
| `slots` | "{rótulo}: {nível} nível, {livres} de {total} disponíveis; …" | "Espaços de magia: 1º nível, 3 de 4 disponíveis" |
| `tags` | "{rótulo}: {lista} \| nenhuma" | "Condições: Envenenado" |
| `list` | "{rótulo}: {n} itens" ou, fixa, "{n} de {N} preenchidas" | "Consequências: 1 de 3 preenchidas" (Fate) |
| `text` (aspecto) | "Aspecto, {rótulo}: {texto}" | "Aspecto, Conceito: Ex-detetive endividado" (Fate) |

Na grade, o selo vira texto no fim: "Força, 8, modificador menos 1, salvaguarda proficiente". Condições com efeito na rolagem trazem ", desvantagem nas rolagens" em texto oculto.

### 9.3 Controles

- **Stepper:** na web, `role="group"` com dois botões reais ("Diminuir/Aumentar {rótulo}", fora da ordem de Tab) e um `spinbutton` no meio, com `aria-valuemin/max/now` e `aria-valuetext` ("27 de 134", "45 por cento"). Setas ±1, PageUp/PageDown ±5, Home/End; Enter abre a digitação quando o campo aceita teclado numérico. Não usar `role="slider"`: os filhos de um slider são apresentacionais e os botões sumiriam da árvore de acessibilidade. Segurar −/+ repete só no visual e grava **uma** alteração ao soltar (um evento, um Desfazer). No RN: `accessibilityRole="adjustable"`, `accessibilityValue={{ min, max, now, text }}` e ações `increment`/`decrement`.
- **Escolha única** (forma, proficiência, tema): `role="radiogroup"` + `role="radio"` com `aria-checked`, tabindex itinerante e setas. No RN: `accessibilityRole="radiogroup"` / `"radio"` com `accessibilityState={{ checked }}`.
- **Alternâncias** (tag, filtro "Só com pontos"): `aria-pressed`.
- **Títulos:** `h1` no nome, `h2` nas seções (com `tabindex="-1"` para receber foco ao tocar no chip), `h3` nos grupos. No RN: `accessibilityRole="header"`.
- **Marcos:** link "Pular para a ficha", `main`, `nav` dos chips, `region` da `ModeBar`, `section` "Em jogo".

### 9.4 Anúncios

- `announce(texto)` usa uma live region `role="status"` / `aria-live="polite"`. Ela esvazia e reescreve depois de 30 ms, para que o mesmo texto seja anunciado de novo.
- O `Toast` tem a própria região polite.
- O resultado da rolagem é anunciado ("Destreza + Esportes: 3 sucessos"), assim como a entrada em Evoluir e a volta a Jogo sem alterações.
- No RN: `AccessibilityInfo.announceForAccessibility` e `accessibilityLiveRegion="polite"` (Android).

### 9.5 Sheet e diálogo

- `role="dialog"` (ou `alertdialog` na confirmação) com `aria-modal` e `aria-labelledby` no título.
- Foco preso (Tab e Shift+Tab circulam); Esc fecha só o sheet do topo da pilha; ao fechar, o foco volta ao controle que abriu.
- **Foco inicial no título** (`tabindex="-1"`): o leitor anuncia o sheet e nenhum controle fica "armado" por engano. A confirmação começa em **Cancelar**; editores de texto começam no campo.
- Depois de cada alteração o corpo do sheet é refeito e o foco volta ao mesmo controle (`data-key`).
- No RN: `Modal` com `onRequestClose` e `accessibilityViewIsModal`; foco no título com `AccessibilityInfo.setAccessibilityFocus` (proposta).

### 9.6 Movimento, cor e háptico

- **Reduzir movimento:** com `prefers-reduced-motion` ou `data-reduced-motion="true"`, os `duration-*` vão a 0, as animações de sheet, scrim, toast e skeleton são removidas e a rolagem até a seção é instantânea. No RN: `useReducedMotion` do Reanimated.
- **Cor nunca sozinha:** tipo de dano por glifo **e** por nome; par de recursos com hachura; dado "1" tracejado; perigo com ícone e texto; sincronização com forma do ponto e texto.
- **Háptico:** pulso curto em cada alteração e padrão mais forte no dano agravado (`navigator.vibrate` no protótipo; `expo-haptics` no app).

**Multi-sistema:** a acessibilidade é gerada pelo **tipo**, com rótulos do template. Adicionar D&D, CoC ou Fate não exigiu nenhuma frase escrita à mão por sistema: a mesma função anuncia Vitalidade, PV com temporários, porcentagem com metade e quinto e aspectos. Resolve C-03, C-12, C-17, DS-05, DS-11, DS-12.

---

## 10. Layout e refluxo

| Breakpoint | Faixa | Ficha | Recursos de jogo | Sheets |
|---|---|---|---|---|
| `compact` | 0–599 | Uma coluna, gutter 16 | **Dock** fixo embaixo (3 chips + Dados) | Sobem de baixo, até 92% da altura |
| `medium` | 600–899 | Uma coluna de até 640 | Painel **"Em jogo"** no topo, 2 colunas internas, sem dock | Modal centralizado de até 560 |
| `expanded` | ≥ 900 | Grade com coluna "Em jogo" sticky de 340 à esquerda; até 1200 | Coluna sticky | Modal centralizado |

- Dock e coluna "Em jogo" mostram **os mesmos campos**: os ids de `dock` no template e os campos das seções de zona `play`. No DOM, o painel "Em jogo" vem primeiro dentro do `main`.
- Em `expanded`, os grupos de uma seção ficam lado a lado quando cada um tem pelo menos `minColWidth` (padrão 240; o template pode sobrescrever). O breadcrumb aparece e o bloco de identidade abre por padrão.
- Media queries não aceitam variáveis CSS, então o build escreve os breakpoints num comentário no topo do `tokens.css`, e o CSS repete os números.

**Refluxo por fonte e largura** (`.is-stacked`, ligado quando `fontScale ≥ 1.3` **ou** largura < 360dp):

- `FieldRow` empilha o nome sobre o valor;
- a grade primária vira uma coluna e os cabeçalhos de grupo somem;
- pirâmide, fatos de identidade e painel "Em jogo" viram uma coluna;
- o dock passa a 2 colunas;
- grupos nunca ficam lado a lado.

**Grade estreita.** Até 440px de largura, a célula da grade reduz o padding, o rótulo vai a 15 e o pip a 12, para "Manipulação" caber em 360dp sem abreviar. No protótipo é uma media query (o `@container` não era lido pelo teste com jsdom e, por ordem no arquivo, nunca chegava a valer). No RN, a regra sai da largura medida com `onLayout` (proposta).

A decisão é sempre pelo **espaço medido e pelo `fontScale`**, nunca pelo nome do sistema. Matriz de teste: 360/390/430 dp × 100/130/200%.

**Navegação: 3 abas por zona.** A ficha se divide em 3 abas fixas, uma por zona do template: Ficha (`build`), Poderes (`powers`) e Sobre (`lore`). O template pode trocar o rótulo com `zoneLabels`. A escolha veio de um estudo que mediu rolagem única, abas por seção e abas por zona nos 6 sistemas ([`../estudos/navegacao-da-ficha.md`](../estudos/navegacao-da-ficha.md)). As abas por zona ganharam em três pontos:

- **Simplicidade:** sempre 3 abas, nada a configurar por sistema.
- **Barra que cabe:** as 3 abas visíveis de 360 dp com fonte 200% até a web. Nas abas por seção, 5 de 6 sistemas ficavam com abas fora da tela.
- **Consultas mais curtas:** poderes e notas a 1 toque, contra 2 a 4 telas de rolagem na página única.

As 3 abas dividem a largura e nunca rolam de lado; com fonte muito grande, o rótulo quebra em 2 linhas. Dock, Dados e identidade ficam fora das abas.

O header recolhe as abas ao rolar para baixo (depois de 160px) e as mostra ao subir ou quando uma aba recebe foco. A aba ativa, a rolagem de cada aba, os filtros e a última parada ficam guardados por personagem.

**Multi-sistema:** as zonas existem em todo template, então a navegação vem pronta para qualquer sistema. O rótulo é o único ajuste (WoD "Vantagens", CoC "Equipamento", Fate "Façanhas").

**Multi-sistema:** "lado a lado se couber" depende só do número de grupos e do `minColWidth`. Os 9 atributos de WoD e os 6 de D&D cabem na grade; as ~60 perícias de CoC viram lista com busca; os aspectos de Fate ocupam largura total no topo. Os rótulos mais longos são de outros sistemas ("Ciência (Farmácia)", "Esfera Resiliente de Otiluke"), e o refluxo é o mesmo para todos. Resolve C-04, C-09, C-10, C-20, DS-06, DS-07.

---

## 11. Notas de implementação em React Native

- **`tokens.ts` gerado.** Estender o `build.mjs` para gerar `packages/ui/src/tokens.ts` do mesmo `tokens.json` (proposta). As cores vão por tema (`t.color.noite.action`), a paleta de accent com `fill`/`text`/`on`, as medidas como números e o `lineHeight` absoluto (`size × razão`), porque o RN não aceita razão.
- **Accent e skin por contexto.** Um `ThemeProvider` expõe tema, skin e accent resolvido (no web, `data-accent`/`data-skin`). Itens de lista com personagens diferentes recebem provider próprio.
- **`fontFamily` por peso.** O Android não sintetiza peso de fonte customizada. Use `type.families.sans.native["700"]` (`AlegreyaSans_700Bold`) e os mapas `native` das skins, nunca só `fontWeight`. `letterSpacing` em px.
- **Elevação.** `boxShadow` aceita a string do token no RN 0.81. Mantenha a borda `border-subtle` junto.
- **Safe area.** `react-native-safe-area-context` com `useSafeAreaInsets()` para header, dock, toast e sheet. Não use o `SafeAreaView` do `react-native` (só iOS, obsoleto).
- **`react-native-svg`.** Necessário para `Clock`, lua do augúrio, hachura e pips em losango ou quadrado. `borderStyle: 'dashed'` com `borderRadius` é inconsistente entre plataformas.
- **Háptico.** `expo-haptics`: seleção no `Stepper`, impacto na ação padrão do dock e padrão mais forte no dano agravado.
- **Sheets.** `Modal` com `onRequestClose` (o voltar do Android fecha), `animationType="none"` com reduzir movimento, ou rotas do Expo Router com `presentation: 'formSheet'` e detents. O toast pode ser um componente próprio com Reanimated.
- **Camadas.** No RN não há `z-index` global: a ordem é estrutural, via Portal. Os `layer-*` valem para a web.
- **Texto.** Edição em sheet de altura total com `KeyboardAvoidingView`; `keyboardType="number-pad"` para números; o dock some com o teclado aberto.
- **App.** `userInterfaceStyle: "automatic"`, splash `#120e10`, `<StatusBar style="light" />`, `peerDependencies` atualizadas (React 19, RN 0.81) e `expo-keep-awake` no modo sessão (C-08, C-21, DS-16).
- **Segurança.** Texto sempre em `<Text>`, nunca HTML nem WebView. Cor só da paleta. Rolagem que vale para a mesa é feita no servidor; local usa `getRandomValues` (`expo-crypto` no app), nunca `Math.random`. Credenciais só no `expo-secure-store`, nunca na fila offline.

| Conceito | Web (protótipo) | React Native |
|---|---|---|
| Linha / célula / chip | `button` + `aria-label` + `aria-haspopup="dialog"` | `Pressable` + `accessibilityRole="button"` + `accessibilityLabel` |
| Visual decorativo | `aria-hidden="true"` | `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"` |
| Stepper | `role="group"` + botões + `role="spinbutton"` com `aria-value*` | `accessibilityRole="adjustable"` + `accessibilityValue` + `increment`/`decrement` |
| Escolha única | `radiogroup` / `radio` + `aria-checked` | `accessibilityRole="radiogroup"` / `"radio"` + `accessibilityState.checked` |
| Alternância | `aria-pressed` | `accessibilityRole="checkbox"` + `accessibilityState.checked` |
| Toque longo | aviso no `aria-label`; o sheet tem o mesmo botão | `onLongPress` + `accessibilityActions=[{ name: 'longpress', label }]` |
| Título | `h2` / `h3` | `accessibilityRole="header"` |
| Estado | `disabled`, `aria-disabled`, `aria-busy`, `aria-expanded`, `aria-current` | `accessibilityState` (`disabled`, `busy`, `expanded`, `selected`) |
| Anúncio | live region `role="status"` | `AccessibilityInfo.announceForAccessibility` / `accessibilityLiveRegion` |

O RN 0.81 também aceita `role` e `aria-*` (DS-05); escolha uma forma e use-a no pacote inteiro.

**Multi-sistema:** nenhuma dessas decisões depende do sistema. Uma skin nova só acrescenta arquivos de fonte e, se precisar, um SVG de glifo. Resolve C-15, C-21, C-23, DS-10, DS-16.

---

## 12. Como adicionar

### Um token

1. Acrescente o token no grupo certo do `tokens.json`, com `usage` (obrigatório na prática: é a documentação). Cor leva `role` e valor para `noite` e `pergaminho`.
2. O nome não pode citar sistema, mecânica nem termo de jogo.
3. Consuma no `components.css` só por `var(--nome)`.
4. Rode o build. Se for cor, rode o check: `text`, `non-text` e `on` são validados automaticamente.

### Uma cor de accent

1. Acrescente `{ "name": "accent-17", "label", "hue", "value": { "noite": { "fill", "text", "on" }, "pergaminho": { … } } }` em `color.accents.palette`.
2. Rode o check: o `fill` precisa de 3:1, o `text` e o `on` de 4.5:1, e o ΔE2000 contra `action` precisa ser ≥ 10 com visão normal, protanopia e deuteranopia.
3. Rode o build: o escopo `[data-accent="accent-17"]` é gerado e o validador de template passa a aceitar o nome (a paleta vem do `tokens.json`).
4. Mapeie no template (`accent.map`). Nunca coloque hex no template.

### Uma skin

1. Crie `skins/<id>.json` com `id`, `name`, `usage`, `type.display` (`web`, `native` com `600` e `700`, `license`), `type.voice` (`web`, `native` com `600italic`, `license`), `pip` (`circle`, `diamond` ou `square`), `glyphs` e `color` (`{}` se não sobrescrever nada).
2. Use fontes com licença livre, hospedadas no app (`expo-font`); nada de `@import`.
3. Acrescente o `id` em `REGISTRY.skins` (`validate.mjs`).
4. Se a forma do pip for nova, acrescente a regra `[data-skin="<id>"] .ds-pip` no `components.css` (veja Pendências).
5. Rode o build e o check (as skins entram como argumento). A vitrine lista a skin sozinha.

### Um glifo de skin

1. Escreva a função SVG em `ui.js`, como `moon()`: classe `ds-glyph-<id>`, `aria-hidden="true"`, só tokens (`border-control`, `accent-alt-*`) e **contorno sempre visível**. Nada de símbolo oficial de terceiros.
2. Registre o id em `glyphs` da skin e em `REGISTRY.glyphs`.
3. No template, o campo `choice` declara `"glyph": "<id>"` e cada opção um `glyphParam` numérico. O nome continua em texto ao lado.
4. O renderizador põe o glifo no slot `leading` da linha ou ao lado do valor. Hoje o protótipo chama `moon()` direto para `augur-moon` (veja Pendências).

**Multi-sistema:** acrescentar Changeling é uma paleta mapeada e um template; acrescentar Pathfinder seria uma skin com fonte própria e um template; nenhum dos dois toca nos componentes. Resolve C-05, C-13, DS-03, DS-08, DS-13.

---

## Pendências conhecidas

Divergências entre tokens, CSS e protótipo encontradas ao escrever esta documentação, com o estado atual.

| # | Onde | Divergência | Estado |
|---|---|---|---|
| 1 | `build.mjs` × `components.css` | O build gera `--pip-shape` por skin, mas o CSS não lê a variável. A forma do pip está fixa em `[data-skin="dnd"]` e `[data-skin="coc"]`, então uma skin nova com `diamond` não ganha losango sem editar o CSS. | Aberto. No RN, a forma vem da skin em código; no CSS, falta uma regra por valor. |
| 2 | `check_tokens.py` × `build.mjs` | O check valida `color` das skins como sobrescrita de token do core, mas o build ignora `skin.color` ao gerar o CSS. Hoje todas as skins têm `color: {}`. | Aberto, sem efeito hoje. |
| 3 | `components.css` × `hit-size` | Chips de seção com 36 px e a alça "Todos os recursos" com 28 px, abaixo de 44. | **Resolvido.** Alvo estendido a 44 e alça com 44. |
| 4 | `tokens.json` sem consumidor | `pip-hit-w`, `space-0-5`, `easing-exit` e `on-success` sem uso; `display-xl` e `overline` só na vitrine; o sheet fecha sem animação de saída. | Parcial. `display-xl` agora é o nome completo no bloco de identidade. |
| 5 | `components.css` sem uso | `.ds-meter__fill--temp`, `.ds-box.is-marked` e `.ds-btn--block` sem uso; PV temporário fora do medidor. | Parcial. O medidor mostra os temporários (hachurados), com largura por variável numérica. |
| 6 | Reduzir movimento | O spinner de `.ds-btn[aria-busy]` não parava. | **Resolvido.** |
| 7 | Literais fora da escala | `.ds-icon--sm` 18, `.ds-tag` 28, `.ds-cell` 64, `.ds-list-item` 72, `.ds-die` 40, `.ds-avatar` borda 2, `.ds-meter` 8 e `.ds-glyph-moon` 28 são px sem token. | Aberto. |
| 8 | Estilo `label` | O `usage` diz "chips do dock" com caixa alta, mas o dock usa o tamanho sem caixa alta, de propósito. | Aberto (corrigir o `usage`). |
| 9 | Skin `wod` | Declara o glifo `damage-glyphs`, mas os glifos `/ X ✱` vêm do template como texto. | Aberto. |
| 10 | Glifos | `augur-moon` tratado com `if` em `factsList`; falta um mapa id → glifo. | Aberto. |
| 11 | Anúncio de `rating` com modificador | Anunciava "Força, 7 de 5" em Crinos. | **Resolvido.** Anuncia "Força, 7, base 3 mais 4 da forma Crinos". |
| 12 | `modifiers` | A avaliação fala em `add`, `set` e `replace`; o registro tem `add` e `set`. | Aberto. `replace` entra quando houver um caso (Forma Selvagem do druida). |
| 13 | `.ds-pip.is-bonus` | O anel interno usava `--surface` também dentro do sheet. | **Resolvido.** `--pip-ring` acompanha o fundo. |
