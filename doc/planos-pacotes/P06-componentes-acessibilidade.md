# P06 · Componentes do @tms/ui e acessibilidade: plano de implementação

> Plano · 2026-11-01 · base conferida: `onda/1-fundacao` em `3892588` (código igual ao `main` `1db3db9`)

Pacote [P06 da matriz](../testes/2026-11-01/matriz-achados.md#p06): onda 1 (Fundação), correção, sem pré-requisito. É pré-requisito de P05-C, P07-C e P08 (onda 2), de P11 (onda 3) e de P12 (onda 5). As mudanças de API dos componentes descritas aqui são as que esses pacotes vão encontrar.

O pacote não remove campo, não muda regra do jogo e não afrouxa limite:

- o Clã continua opcional na Nova ficha (nenhuma validação nova);
- o `max=1000` do orçamento continua. Ele é o `LIMIT` de `packages/sheet-core/src/creation.ts:176`, que `apps/frontend/components/chronicles/CreationSettings.tsx:242` e `:274` repetem; só a leitura muda;
- o "Digitar" continua preso à faixa do template e ao `applyBatch`;
- a visibilidade do NPC continua com os mesmos três estados, validados no servidor.

**Versões conferidas em `node_modules`:** react-native 0.88.0, react-native-web 0.21.4, expo 58.0.19, expo-router 58.0.26 e @testing-library/react-native 13.3.3. O CLAUDE.md ainda fala em Expo 57 e RN 0.86.

---

## 1. Objetivo e itens

**Objetivo (matriz).** Todo grupo de escolha e todo stepper com título visível; leitor de tela e teclado completos nos componentes compartilhados (`Choice`, `Stepper`, `Tabs`, `ListItem`, `BottomSheet`); alvo de toque certo em cada plataforma.

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| T-09 | alta | Grupo de escolha sem título visível. No iOS o grupo some da árvore e o estado do rádio é lido em inglês | `packages/ui/src/Choice.tsx:39-45`; `apps/frontend/app.json:14-17` |
| T-25 | média | "Digitar" só aplica com Enter, deixa abrir vários campos e trunca "3.5" em silêncio | `apps/frontend/sheet/evolve/NumberEditorRow.tsx:57-71`, `:127-143` (não `Stepper.tsx`) |
| T-34 | média | VoiceOver lê o valor do stepper como porcentagem ("7" vira "1%") | `packages/ui/src/Stepper.tsx:135-152` |
| T-35 | média | No web, abas e rádios não respondem a Espaço nem a setas, e o foco não volta depois do Esc. No iOS, as abas aparecem sem papel | `Pressable.tsx`, `Tabs.tsx:36-66`, `Choice.tsx`, `BottomSheet.tsx`, `ModeBar.tsx:220-261`, `RadioChips.tsx:31-65` |
| T-38 | média | O corretor do iOS troca "PO" por "PÔ" no nome e marca o e-mail | `apps/frontend/sheet/editors/TextEditor.tsx:22-36`; `app/(auth)/login.tsx:63-74`; `register.tsx:66-88` |
| T-41 | média | `ListItem` sem `onPress` engole os botões Revogar, Remover, Editar e Propor | `packages/ui/src/ListItem.tsx:66-69` |
| T-42 | média | Os alternadores de sigilo não anunciam o estado. Na visibilidade do NPC, o "selecionado" parece desabilitado (2,29:1). O nome acessível não bate com o texto visível | `Chip.tsx:24-31`; `sheet/SheetScreen.tsx:439-476`; `sheet/storyteller/StatusMenu.tsx:162-189` |
| T-61 | baixa | Rótulos repetidos ou ambíguos ("Escolher da lista" ×2, "Nome: X, X", "..") | `editors/Suggestions.tsx:68-74`; `evolve/TextEditorRow.tsx:51-56`; `evolve/ChoiceEditorRow.tsx:25-30`; `chronicles/TableRow.tsx:59-68` |
| T-70 | baixa | Alvo de 44 dp no Android, abaixo dos 48 dp | `design/design-system/tokens.json:591-596` (gera `tokens.ts:293`); `Pressable.tsx:44` |
| T-71 | baixa | Dois "Fechar" por diálogo, na árvore e no Tab do web | `packages/ui/src/BottomSheet.tsx:54-60` |
| T-72 | baixa | Skeleton mudo no web e sem app bar durante a restauração da sessão | `packages/ui/src/Skeleton.tsx:19-24`; `apps/frontend/app/(app)/_layout.tsx:10-15` |

---

## 2. Decisões aplicadas

**O P06 não tem decisão de produto própria**: a coluna "Decisões" da matriz está vazia para ele. Nenhuma das D-00 a D-14 é implementada aqui. Algumas decisões e documentos tocam o desenho:

| Origem | O que diz | Como entra no desenho |
|---|---|---|
| `design/design-system/components.md` (SectionTabs, l.412-440) | Web com `tablist`/`tab`/`tabpanel`, `aria-controls`, tabindex itinerante, setas, Home e End e **ativação automática** ("trocar de aba não tem custo") | `Tabs` segue o DS: a seta já seleciona |
| `components.md` (Choice, l.207-232) | `radiogroup`/`radio`, tabindex itinerante e setas; API com `disabled` | `Choice` ganha setas e `disabled`. A ativação é manual (ver T-35), porque vários grupos aplicam a escolha na hora |
| `components.md` (Chip, l.136-145) | API com `kind`, alternância anunciada por `aria-pressed` | `Chip` ganha `kind`, com o valor `'switch'` a mais para os alternadores de sigilo |
| `components.md` (Stepper, l.344-372) | Digitar: "Enter confirma, Esc cancela" | O "Digitar" do T-25 também aplica ao sair do campo e cancela com Esc |
| `components.md` (BottomSheet, l.602-615) | "Foco volta a quem abriu" | T-35 (foco de volta ao gatilho) |
| `components.md` (Skeleton, l.650-658) | `aria-busy` e "Carregando…" em `role="status"`; peças `aria-hidden` | T-72 no web |
| `avaliacao-ui-ux.md` DS-05 (l.1018) e TL-16 (l.1916) | Abas sem setas nem `tabpanel`; FormSelector com `aria-pressed` numa escolha única | T-35 e T-42 |
| `avaliacao-ui-ux.md` DS-04 (l.967) e C-16 (l.505) | Estados de interação distintos; bloqueado ≠ selecionado | T-42: o selecionado deixa de usar a aparência de desabilitado |
| D-05 (P05-D, onda 4) | A aba "Orçamento" passa a "Pontos" | Nada a fazer: o rótulo da aba vem do dado |
| D-10 (P09-D, onda 5) | As abas da crônica sobem para o topo | O `TabPanel` deste pacote acompanha o conteúdo quando elas mudarem de lugar |
| D-11 (P10-D, onda 4) | "?" em cada campo e em cada opção de lista | O título do `Choice` fica numa linha própria, onde o P10-D pode pôr o "?" depois. Nenhuma prop nova agora |

---

## 3. Desenho por item

### 3.0 O que as plataformas fazem hoje (explica as causas)

**react-native-web 0.21.4**

- **Espaço** só ativa um elemento com `role="button"` ou um `<button>` (`node_modules/react-native-web/dist/modules/usePressEvents/PressResponder.js:66-71`). Em `tab`, `radio`, `switch` e `checkbox`, só o Enter funciona.
- **`accessibilityRole="button"`** vira `<button>` (`modules/AccessibilityUtil/propsToAccessibilityComponent.js`, `roleComponents`). Os papéis `tab`, `radio` e `switch` ficam em `div` com `role`.
- **`accessible`, `accessibilityState` e `accessibilityValue` (objeto)** não existem no web. Só os `aria-*` chegam ao DOM (`modules/createDOMProps/index.js`). Por isso, o `aria-label` num `div` sem papel fica de fora: o ARIA 1.2 não deixa nomear um elemento genérico.
- **`TextInput`** não tem `onEndEditing`, só `onBlur` e `onSubmitEditing` (`exports/TextInput/index.js:96`, `:120`).
- **`Pressable`** aceita `tabIndex` e `onKeyDown` (`exports/Pressable/index.js:37-44`, `:118-132`).
- **`ModalFocusTrap`** devolve o foco ao desmontar (`exports/Modal/ModalFocusTrap.js:111-121`).

**react-native 0.88**

- **iOS sem traço:** `tab`, `tablist`, `radio` e `radiogroup` não têm traço no iOS. Só `tabbar` tem (`ReactCommon/react/renderer/components/view/accessibilityPropsConversions.h:24-108`).
- **`selected`:** o `aria-selected` vira o traço Selected (`AccessibilityProps.cpp:32`).
- **Porcentagem:** sem `accessibilityValue.text`, o iOS lê `now/(max−min)` como porcentagem (`React/Fabric/Mounting/ComponentViews/View/RCTViewComponentView.mm:550-559`).
- **Inglês:** o RN monta "radio button", "checked" e "unchecked" com `RCTLocalizedString` (`RCTViewComponentView.mm:1587-1611`). A tradução segue a localização do bundle do app (`React/I18n/RCTLocalizedString.mm`). O RN traz `pt.lproj` em `React/I18n/strings`.
- **`aria-hidden`:** vira `importantForAccessibility="no-hide-descendants"` no Android (`Libraries/Components/View/View.js:71-74`).

### 3.1 T-09: título visível no `Choice` e no `Stepper`; estado do rádio em português

**Causa confirmada.** `Choice.tsx:40-45` só põe o `label` como `accessibilityLabel` do `radiogroup`, sem texto na tela. No iOS o `radiogroup` não tem traço, então o grupo nem aparece. O "radio button, unchecked" em inglês (`notas/qa-app.md:10`) **não vem do `Choice`**: vem do RN, que segue a localização do app. O `app.json` não declara português (`apps/frontend/app.json:14-17` só tem `supportsTablet` e `bundleIdentifier`), e o prebuild do Expo deixa `CFBundleDevelopmentRegion` em `en`.

**O que muda**

- **`Choice` mostra o título.** Ele aparece em `Text variant="fieldLabel"` com `nativeID`, acima do grupo (fora da grade de 2 colunas). A nova prop `showLabel` vale `true` por padrão. Por plataforma:
  - o contêiner `radiogroup` mantém `accessibilityLabel={label}`;
  - no web, ganha `aria-labelledby` com o id do título;
  - no Android, o título fica `aria-hidden`, porque o TalkBack já lê o nome do grupo;
  - no iOS, o título é o elemento lido logo antes das opções. É assim que o grupo aparece para o VoiceOver: o RN 0.88 não tem contêiner semântico no iOS (nem `accessibilityContainerType`).
- **Quem ganha o título sem mudar o arquivo:**
  - `app/(app)/chronicles/new.tsx:84` (Sistema);
  - `CreationSettings.tsx:100` (Aprovação do narrador) e `:117` (Modo padrão);
  - `MemberSheets.tsx:69` (Convites ativos);
  - `sheet/editors/ChoiceEditor.tsx:9` (Clã; Raça, Augúrio e Tribo; Tradição e Essência).
- **Quem já mostra o nome na tela recebe `showLabel={false}`.** O título do `BottomSheet` já é o rótulo do campo (`views/__tests__/matrix.test.tsx:116`):
  - `sheet/evolve/ChoiceEditorRow.tsx:66`;
  - `sheet/views/state/StateViews.tsx:168`.
- **Estado em português no iOS:** em `apps/frontend/app.json`, `ios.infoPlist` com `"CFBundleDevelopmentRegion": "pt-BR"` e `"CFBundleLocalizations": ["pt-BR"]`. Os textos do RN passam a sair do `pt.lproj` ("botão de opção, não marcado").
  - **Efeito colateral:** os textos do sistema dentro do app (o menu de copiar e colar, por exemplo) também ficam em português, mesmo com o aparelho em outro idioma. É coerente com um app só em português.
  - **Validação:** só um build nativo confirma (D-00, no P01-C), mais a conferência manual da seção 7.
- **`Stepper`, título visível com a nova prop `showLabel`** (padrão `false`, porque a maioria dos usos já tem o rótulo ao lado). Quando ligada, o rótulo vai acima do controle, como `Text` `aria-hidden`: o controle já tem o nome, e assim não há leitura dupla. Ela é ligada nos 8 usos sem rótulo na tela:
  - `components/chronicles/RollFeed.tsx:91` (Dados) e `:98` (Dificuldade);
  - `sheet/dice/DiceSheet.tsx:141` (Dificuldade) e `:189` (Sucessos nos dados);
  - `components/chronicles/OperationSheet.tsx:198` (Quantidade);
  - `sheet/creation/CreationPanel.tsx:430` (Pontos de bônus desta ficha);
  - `sheet/xp/forms.tsx:93` (XP a conceder) e `:181` (Ajuste no total).

  Os outros 11 usos já têm o rótulo na tela: CreationSettings, NumberEditor, NumberEditorRow (via EditorShell), ListEditor ("Valor"), ResourceEditorRow, TrackSheet, ResourceSheet e ClockViews.
- **Não muda `CreationSettings.tsx`.** O título mostra o texto atual, "Modo padrão". A R-01 sugere "Modo de criação" (ver seção 9). O arquivo também é mexido por P01-C (L-01, l.110-115) e P03-C (T-56). O plano do P03-C supõe que o P06 mexe nele, o que não acontece.

**"O template pode marcar o que a criação exige (o Clã)" não cabe nesta correção.** O contrato não tem `required` em campo:

- a lista de chaves permitidas está em `design/scripts/validate.mjs:48-50`, fail secure;
- o resto do contrato está no schema `design/templates/schema.json` e nos tipos do `@tms/sheet-core`.

Acrescentar `required` muda o contrato (validador, schema, tipos e API) e o comportamento (avisar ou barrar a ficha criada sem Clã). Isso é decisão de produto e de contrato, a apontar ao PO; o P06 não decide. O título visível resolve a causa do IA-05 (não ver o grupo) sem regra nova.

### 3.2 T-34: o stepper lê o número

**Causa confirmada.** `Stepper.tsx:144` só manda `aria-valuetext` quando há `valueText`, e `CreationSettings.tsx:238-247` e `:270-276` não passam `valueText`. Sem texto, o iOS calcula a porcentagem:

- 7 de 1000 vira "1%";
- 15 e 16 viram "2%";
- 6 numa faixa de 2 a 10 vira "75%" (6/8).

**O que muda.** `aria-valuetext` vai sempre, com `valueText?.(display) ?? String(display)`. Os `aria-valuemin`/`aria-valuemax` continuam os reais: 0 e 1000 no orçamento, o mesmo `LIMIT` do core. `CreationSettings.tsx` não muda. No web, o grupo com os botões e o valor rotulado (l.154-167) segue igual.

### 3.3 T-25: "Digitar" aplica ao sair, um campo por vez e recusa decimal

**Causa provável da matriz errada.** `Stepper.tsx:149-178` só expõe o valor como botão "Digitar {rótulo}" (web) ou como ação `activate` (app) e chama `onValuePress`. O campo de texto fica em `apps/frontend/sheet/evolve/NumberEditorRow.tsx`, o único uso de `onValuePress` (l.153). Nele há três defeitos:

1. **Não aplica ao sair.** Aplica em `onSubmitEditing` e `onEndEditing` (l.136-137), e o react-native-web não tem `onEndEditing`. No web, sair com Tab ou clicando fora não faz nada, e o campo fica aberto.
2. **Vários campos abertos.** O estado `typing` é de cada linha (l.57).
3. **Decimal truncado.** `Number.parseInt` (l.64) transforma "3.5" em 3. O `maxLength` de `String(max).length + 1` (l.135) ainda deixa digitar "3." num campo de 1 a 5.

**O que muda (só em `apps/frontend`; a API do `Stepper` fica igual)**

- **O texto digitado fica num `ref`**, atualizado em `onChangeText`. Uma função `finish()` de execução única, guardada por `ref` (o app dispara submit e fim de edição juntos), roda:
  - no **Enter** (`onSubmitEditing`);
  - no **`onBlur`** (Tab ou clique fora, nas três plataformas);
  - quando **outro campo abre**.
- **Esc cancela** (no web, `onKeyPress` com `key === 'Escape'`): fecha sem aplicar, como o DS manda.
- **Validação:** o texto aparado precisa casar com `/^-?\d+$/` e estar na faixa. Qualquer valor inválido, decimal inclusive, recebe a mesma mensagem: "Digite um número inteiro de {min} a {max}". Hoje a mensagem é "Digite um número de {min} a {max}".
  - Com Enter num valor inválido, o campo **continua aberto**, com a mensagem (como hoje).
  - Ao sair com valor inválido, o campo **fecha sem aplicar** e a mensagem fica na linha (`EditorShell error`). Assim nunca há dois campos abertos.
- **Um campo por vez:** um store mínimo novo, `apps/frontend/sheet/evolve/typing.ts` (`useSyncExternalStore` com `open(id)`, `close(id)` e `useTyping(id)`). Abrir B faz A rodar `finish()` com o texto dele. Um store global basta, porque há um editor de ficha por vez na tela.
- **`maxLength`** passa a usar os dois limites: `Math.max(String(min).length, String(max).length) + 1`, para aceitar o sinal de negativo.
- **Nada é salvo sem "Salvar"**: o valor vai para o rascunho (`set(path, n)`, que passa por `applyBatch`), e o servidor confere de novo.

### 3.4 T-35: teclado completo em abas e rádios, foco de volta ao gatilho, abas no iOS

**Espaço.** No `@tms/ui` `Pressable` (`packages/ui/src/Pressable.tsx:18-41`), só no web: com papel `radio`, `tab`, `switch` ou `checkbox`, um `keydown` de Espaço sem `repeat` e sem `disabled` chama `preventDefault()` (a página não rola) e `onPress`. O papel é lido de `role ?? accessibilityRole`. O botão continua com o tratamento do react-native-web, sem disparo duplo. Uma mudança só cobre, sem tocar nesses arquivos:

- abas e rádios (`Tabs`, `Choice`);
- o seletor de modo (`ModeBar.tsx:242`) e os chips de prioridade (`RadioChips.tsx:44`);
- os interruptores (`GroupsLayout.tsx:176`, `StateViews.tsx:130`);
- as caixas de seleção (`TableRow.tsx:73`, `DiceSheet.tsx:343`, `TrackSheet.tsx:173`).

**Setas.** Um hook novo, `useRovingFocus`, em `packages/ui/src/roving.ts`, exportado e sem efeito no app.

- Recebe a quantidade de itens, o item ativo (o selecionado, ou o primeiro se não houver), a orientação e `activate: 'focus' | 'manual'`.
- Para o item `i`, devolve `{ ref, tabIndex, onKeyDown }`: `tabIndex` 0 só no ativo e −1 nos outros; ←/↑ vai para o anterior e →/↓ para o próximo, dando a volta; Home e End vão às pontas; o foco do DOM se move pelo `ref`. Com React 19 o `ref` é prop, e o `Pressable` do `@tms/ui` o repassa pelo `...rest`. A prop entra no tipo `PressableProps`.

Onde o hook entra:

- **`Tabs`, com `activate: 'focus'`:** a seta já seleciona, como o DS manda.
- **`Choice`, seletor de modo (`ModeBar.tsx:220-261`) e `RadioChips`, com `activate: 'manual'`:** a seta só move o foco; Espaço, Enter ou toque escolhem. É um desvio consciente do padrão de rádio da APG ("a seleção segue o foco"). Dos 10 grupos de rádio do app (7 `Choice`, o seletor de modo, `RadioChips` e a visibilidade do NPC, hoje um `radiogroup` de botões), 5 aplicam a escolha na hora:
  - `ChoiceEditorRow` fecha a folha;
  - `StateViews` aplica uma forma com custo;
  - a visibilidade do NPC revela o NPC aos jogadores;
  - `ModeSwitch` troca de modo;
  - `RadioChips` grava a prioridade.

  Se a seleção seguisse a seta, cada seta aplicaria a escolha (WCAG 3.2.2) e, no NPC, revelaria sem querer (seção 5).

**`tabpanel`.** `Tabs` ganha a prop opcional `id`:

- cada aba recebe `nativeID={`${id}-tab-${item.id}`}`, e a selecionada recebe `aria-controls`;
- um componente novo, `TabPanel` (`{ tabsId, tab, children, style? }`), põe `role="tabpanel"` e `aria-labelledby` (mais o `nativeID`) no web.

Usos:

- `app/(app)/chronicles/[id]/index.tsx:114-145`;
- `components/chronicles/TableView.tsx:174-184`, mais a lista abaixo;
- `sheet/SheetView.tsx:178-193`;
- `sheet/layouts/groupTabs.tsx:31-37`, que passa a devolver `panelProps` para `sheet/layouts/GroupsLayout.tsx` espalhar no contêiner dos grupos.

**iOS.** `Tabs.tsx:46-48` já usa `accessibilityRole="tab"` com `aria-selected`. Mas o papel `tab` não vira traço no iOS, então o VoiceOver trata a aba como elemento genérico. O "selecionado" deveria vir do traço Selected; a árvore usada pelas personas pode não mostrá-lo (conferir com VoiceOver).

Só no iOS, cada aba ganha `accessibilityValue={{ text: `aba ${i + 1} de ${n}` }}`. O texto é em português e não depende de traço. O `accessibilityRole="tab"` continua (Android, web e os testes atuais com `getByRole('tab')`). A alternativa, um contêiner `tabbar`, é a pergunta 1 da seção 9.

**Foco de volta ao gatilho.** A causa está a confirmar: o `ModalFocusTrap` devolve o foco ao desmontar, mas o QAW-28 viu o foco no `body` depois do Esc. A correção vale qualquer que seja a causa. No web, o `BottomSheet`:

- guarda `document.activeElement` num `useLayoutEffect` quando `visible` passa a `true`, antes de o trap tomar o foco (o trap só age depois do `onShow`);
- ao fechar (o `onDismiss` do `Modal` no web) e ao desmontar, devolve o foco, se o elemento ainda estiver no documento (`isConnected`).

O E2E (seção 4) começa vermelho e confirma a causa.

### 3.5 T-71: um "Fechar" só

**Causa confirmada.** O fundo (`BottomSheet.tsx:54-60`) é um `Pressable` com papel `button` e rótulo "Fechar". No app, o leitor de tela já o ignora, porque ele é irmão do `aria-modal` (teste em `components.test.tsx:509-513`). No web, o react-native-web não esconde os irmãos, então aparecem dois "Fechar".

**O que muda**

- O fundo ganha `accessible={false}`, `aria-hidden` e `tabIndex={-1}`. Ele continua fechando com o clique fora.
- Como o fundo sai do alcance do VoiceOver, a folha ganha `onAccessibilityEscape={onClose}` (o gesto "Z" do iOS). O voltar do Android já fecha (`onRequestClose`).

### 3.6 T-41: `ListItem` sem ação não engole o `trailing`

**Causa confirmada.** Sem `onPress`, `ListItem.tsx:66-69` cria um `View accessible` com o rótulo: no iOS e no Android os filhos deixam de ser elementos próprios. No web o react-native-web ignora `accessible`, e o defeito não aparece.

**O que muda.** Sem `onPress` **e** com `trailing`, a linha deixa de ser `accessible`:

- o `leading` e o texto vão para um `View` interno `accessible`, com o mesmo rótulo;
- o `trailing` fica fora dele.

Sem `trailing`, nada muda (um elemento só, como no teste `components.test.tsx:830-834`). A combinação `onPress` mais `trailing` interativo fica documentada como não suportada: seria um botão dentro de outro (no web, `<button>` dentro de `<button>`). Nenhum dos 16 usos atuais faz isso.

Linhas que passam a funcionar sem mudar o arquivo:

- `InviteSheet.tsx:105-116` (Revogar);
- `app/(app)/chronicles/[id]/index.tsx:263-283` (Remover);
- `CampaignBackstage.tsx:144-157` (Editar) e `:445-470` (Propor).

### 3.7 T-42: o estado do controle de sigilo é anunciado e inequívoco

**Causa.** A matriz cita só o `SheetScreen`, mas a origem do `aria-selected` num `button` é o próprio `Chip` (`Chip.tsx:28`). O ARIA não aceita `aria-selected` em `button`, e o web não anuncia nada.

**O que muda**

- **`Chip`** ganha `kind?: 'toggle' | 'switch'`:
  - **`'toggle'` (padrão):** no web, `aria-pressed={selected}`, sem `aria-selected`; no app continua o `aria-selected` (`accessibilityState.selected`, lido como "selecionado").
  - **`'switch'`:** `role="switch"` com `aria-checked` nas três plataformas. O iOS lê "interruptor, ativado/desativado". No web o Espaço funciona pelo `Pressable` do T-35.
  - Usam `'switch'`: `DiceSheet.tsx:99` (Rolagem oculta), `RollFeed.tsx:108` (Especialização) e `RollFeed.tsx:117` (Oculta).
  - Os filtros da Mesa (`TableView.tsx:188-204`, `RollFeed.tsx:152-171`), os atalhos e as sugestões ficam com `'toggle'` (pergunta 9 da seção 9).
- **Visibilidade do NPC** (`SheetScreen.tsx:439-476`). Hoje é um `radiogroup` com `Button`s, e o estado atual é um botão `disabled` (l.453), com opacidade 0,5 (`Pressable.tsx:35`, `:45`). No pergaminho, isso dá branco sobre `#bea981`, 2,29:1 calculado com os tokens (o QA mediu 2,31:1). A troca é por um `Choice`:
  - título "Visibilidade do NPC" e opções Oculto, Identidade e Ficha;
  - o `meta` das opções sai do parágrafo atual: "Publica nome, selo, subtítulo e retrato." e "Abre uma cópia somente leitura, sem notas do narrador.";
  - `disabled={change.isPending}`;
  - o `onChange` ignora a opção atual. A lógica de `clientCommandId` (l.455-474) fica como está.
- **Contraste do selecionado**, pelos tokens:

  | Elemento | Pergaminho | Noite | Mínimo |
  |---|---|---|---|
  | Rótulo (`ink` sobre `bg`) | 15,57:1 | 15,58:1 | 4,5:1 |
  | Ponto e anel (`action` sobre `bg`) | 4,62:1 | 8,52:1 | 3:1 (gráfico, 1.4.11) |

  Nada esmaecido. Pela ativação manual do T-35, a seta não muda a visibilidade.
- **Nome acessível = texto visível.** O gatilho largo (`StatusMenu.tsx:170-189`) diz "Ações do narrador", mas mostra "Narrador · {estado} ▾" (WCAG 2.5.3). Passa a ter `accessibilityLabel={state ? `Narrador, ${state}` : 'Narrador'}` e `accessibilityHint="Abre as ações do narrador"`. O `IconButton` "⋯" do celular (l.138-145) continua "Ações do narrador", porque não tem texto.

### 3.8 T-61: rótulos únicos e completos

- **"Escolher da lista" ×2** (`Suggestions.tsx:68-74`). `Button` ganha a prop `accessibilityLabel`, cujo padrão é o `title`. O `SuggestionPicker` passa "Escolher da lista: {Natureza}".
  - **Diferente da matriz:** ela sugere "Escolher Natureza da lista", que parte o texto visível. Para o WCAG 2.5.3, o texto visível vem primeiro e inteiro.
- **"Nome: X, X".** As linhas de edição põem o valor no rótulo **e** no `accessibilityValue` (`TextEditorRow.tsx:54-55`, `ChoiceEditorRow.tsx:28-29`).
  - Um auxiliar novo, `apps/frontend/sheet/evolve/a11y.ts` (`fieldA11y(label, value)`), separa por plataforma. No app, o rótulo é só o nome do campo e o valor vai no `accessibilityValue`. No web, o rótulo fica "Nome: X", porque o react-native-web descarta o `accessibilityValue`.
  - A regra da matriz de views continua valendo (`sheet/views/__tests__/matrix.test.tsx:15-18`: o rótulo começa pelo texto visível; com valor, há `accessibilityValue`).
  - **Os fatos da Leitura têm a mesma duplicação** (`describe()` mais `accessibilityValue`, como em `views/ChoiceFact.tsx:16-20`) e ficam fora (pergunta 6 da seção 9).
- **"−"/"+" sem nome no Android: não reproduzido no código.** No app, o `Stepper` esconde os botões (`accessible: false` e `aria-hidden`, `Stepper.tsx:116`, que vira `importantForAccessibility="no-hide-descendants"`). A árvore do uiautomator lista nós não importantes. Dar rótulo a esses botões quebraria a matriz de views: o rótulo "Diminuir Força" não começa pelo texto visível "−". **Nada muda no código**; a conferência é com o TalkBack ligado (seção 7).
- **".." no cartão da Mesa.** `TableRow.tsx:59-68` junta as partes com '. ', e o texto de `problem` (l.43-48) já termina em ponto. Cada parte perde a pontuação final antes da junção.

### 3.9 T-38: nome e e-mail sem corretor

- **Repasse das props.** O `TextField` passa o resto das props ao `TextInput` (`TextField.tsx:59`), então `autoCorrect`, `spellCheck` e `autoCapitalize` chegam lá. O react-native-web também as aceita (`TextInput/index.js:83-84`, `:131`).
- **Nome:**
  - `EditorProps` (`sheet/editors/types.ts:7-14`) ganha `properName?: boolean`;
  - `CharacterForm.tsx` passa `properName={id === nameField}` junto do `required` (l.100). O `nameField` é `model.template.identity.name` (l.55);
  - com `properName`, o `TextEditor` (l.22-36) liga `autoCorrect={false}`, `spellCheck={false}`, `autoComplete="off"` e `autoCapitalize="sentences"`, explícito. "words" maiusculizaria "da" e "de" em nomes portugueses e o "app" de "(PO app)";
  - no Editar, o campo do nome na folha do `TextEditorRow` (o `required` da l.36) recebe as mesmas props.
- **O Novo NPC usa o mesmo `CharacterForm`** (`new-character.tsx:69`): fica coberto sem tocar nesse arquivo.
- **E-mail:**
  - no login (`login.tsx:63-74`), entram `autoCorrect={false}` e `spellCheck={false}` (o `autoCapitalize="none"` e o teclado de e-mail já existem);
  - no cadastro (`register.tsx:66-88`), o mesmo no e-mail e no nome de usuário.

### 3.10 T-70: alvo mínimo de 48 dp no Android

**Onde mexer.** `packages/ui/src/tokens.ts` é gerado por `design/scripts/build.mjs:231-240` a partir de `design/design-system/tokens.json`. O CI regenera e exige diff vazio (`.github/workflows/ci.yml:104-106`). Não se edita à mão.

**O que muda**

- **Token novo** `hit-size-android: 48` no grupo `size` de `tokens.json`, depois de `hit-size` (l.592-595). Ele gera `tokens.size.hitSizeAndroid`, além de `tokens.css` e `tokens.js`.
- **Função nova** `hitTarget()` em `packages/ui/src/metrics.ts`: devolve 48 no Android e 44 no resto, lendo `Platform.OS` na hora da chamada (os testes trocam de plataforma).
- **Onde ela entra como alvo mínimo:**
  - no `@tms/ui`: `Pressable.tsx:44` (calculado no render) e `TextField.tsx:94`;
  - no app: `NumberEditorRow.tsx:163`, `GroupsLayout.tsx:235`, `ChipFlow.tsx:55` e `StateViews.tsx:219`. O estilo deles vem depois do alvo do `Pressable` e traria os 44 de volta.
- **O que não muda:**
  - os tamanhos visuais: `Clock.tsx:91` (`hitSize × 3`) e `ClockViews.tsx:49`;
  - o `row-min`, que já é 48.

**Telas que mudam no Android:** tudo que usa `Pressable`.

- AppBar (voltar e ações);
- o cabeçalho da ficha: "⋯", "Experiência" e "Histórico". **O T-11 piora ali até o P08 corrigir o layout**;
- o seletor de modo, as abas, os chips da Mesa e dos Dados;
- os −/+ dos steppers inline, que passam a 48×48 (+8 dp de largura por stepper) e quebram mais linhas nas prioridades das regras;
- o cabeçalho das folhas e os botões.

iOS e web não mudam. Este é o último commit, para poder ser revertido sozinho (seção 8).

### 3.11 T-72: carregamento anunciado e app bar na restauração

**Causa (parte da matriz errada).** `Skeleton.tsx:19-24` já tem `accessible`, "Carregando" e `aria-busy`. Mas no web o `accessible` some, e um `aria-label` num `div` sem papel não é exposto: a árvore fica vazia. O `_layout.tsx:13` só explica a falta da app bar.

**O que muda**

- **Skeleton, no web:** contêiner com `role="status"` e `aria-busy`, com o rótulo num `Text` visualmente oculto (absoluto, 1×1, `opacity: 0`); as linhas ficam `aria-hidden`. É o que o DS pede. No app, nada muda.
- **`app/(app)/_layout.tsx:10-15`:** `<Screen><AppBar title="TMS" /><Skeleton /></Screen>`, sem dado do usuário.

### 3.12 API pública do `@tms/ui`: o que muda

| Componente | Mudança | Padrão | Compatibilidade com os usos atuais |
|---|---|---|---|
| `Choice` | `showLabel?: boolean`: título visível | `true` | Os 7 usos compilam. 5 ganham o título; `ChoiceEditorRow` e `StateViews` passam `false` |
| `Choice` | `disabled?: boolean` | `false` | Novo; só a visibilidade do NPC usa |
| `Choice` | Setas com tabindex itinerante (web), ativação manual | — | Comportamento novo no web. O toque e o leitor de tela não mudam |
| `Stepper` | `aria-valuetext` sempre (número ou `valueText`) | — | Os 19 usos sem mudança; o iOS lê o número |
| `Stepper` | `showLabel?: boolean`: rótulo visível acima | `false` | 8 usos passam `true` |
| `Tabs` | `id?: string`: liga cada aba ao painel | sem `id`, sem `aria-controls` | Os 4 usos passam o `id` |
| `Tabs` | Setas, Home e End (web, ativação automática); "aba N de M" no iOS | — | Comportamento novo; `getByRole('tab')` continua |
| `TabPanel` (novo) | `{ tabsId, tab, children, style? }`: `role="tabpanel"` com `aria-labelledby` | — | Novo |
| `Pressable` | Espaço ativa `radio`, `tab`, `switch` e `checkbox` no web; alvo por `hitTarget()` | — | Afeta todo `Pressable` com esses papéis (para melhor) e a altura mínima no Android |
| `useRovingFocus` (novo) | Hook de foco itinerante para grupos | — | Novo, exportado no `index.ts` |
| `hitTarget()` (novo) e `tokens.size.hitSizeAndroid` | Alvo mínimo por plataforma | 48 Android, 44 iOS e web | `tokens.size.hitSize` continua 44 |
| `Chip` | `kind?: 'toggle' \| 'switch'` | `'toggle'` | Os 18 usos compilam. No web, `aria-pressed` substitui `aria-selected`; 3 usos passam `'switch'` |
| `Button` | `accessibilityLabel?: string` | o `title` | Sem efeito nos usos atuais |
| `BottomSheet` | Fundo fora da árvore e do Tab; foco de volta ao gatilho (web); `onAccessibilityEscape` (iOS) | — | API igual; os 22 usos herdam |
| `ListItem` | Sem `onPress` e com `trailing`: o texto é um elemento e o `trailing` fica fora | — | API igual; os 16 usos herdam |
| `Skeleton` | No web, `role="status"` com o rótulo em texto oculto | — | API igual; os 14 usos herdam |

Cada commit atualiza a seção do componente em `design/design-system/components.md`. O `hit-size-android` entra na tabela de tamanhos de `design/design-system/README.md:259`.

---

## 4. Testes

Os testes novos ficam em **arquivos novos**, para não disputar linhas com P01-C e P03-C. O P03-C põe o teste do `Banner` em `Banner.test.tsx`, novo; o `components.test.tsx` não é tocado pelo P06.

Arquivos novos:

- `packages/ui/src/a11y.test.tsx`;
- `apps/frontend/sheet/evolve/__tests__/evolve.a11y.test.tsx`;
- `apps/frontend/components/chronicles/__tests__/chronicles.a11y.test.tsx`;
- `apps/frontend/sheet/__tests__/sheet.a11y.test.tsx`;
- `apps/frontend/app/__tests__/app.a11y.test.tsx`;
- `apps/frontend/test/nativeA11yConfig.test.ts`;
- `e2e/tests/a11y-keyboard.spec.ts`.

O web, no Jest, segue o padrão de `components.test.tsx:411-436` (`Object.defineProperty(Platform, 'OS', { value: 'web' })`). O teclado vai como `fireEvent(el, 'keyDown', { key, repeat: false, preventDefault })`.

### 4.1 Um teste de regressão por bug (falha antes, passa depois)

| Item | O que o teste prova | Arquivo | Tipo |
|---|---|---|---|
| T-09 | `Choice` mostra o título; com `showLabel={false}`, não; no web, `aria-labelledby` aponta para o título | `packages/ui/src/a11y.test.tsx` | Jest + RNTL |
| T-09 | Nova ficha (V20) mostra "Clã"; Nova ficha (W20) mostra "Raça", "Augúrio" e "Tribo"; a folha do `ChoiceEditorRow` não repete o título | `sheet/__tests__/sheet.a11y.test.tsx`, `sheet/evolve/__tests__/evolve.a11y.test.tsx` | Jest + RNTL |
| T-09 | Regras da crônica mostram "Aprovação do narrador" e "Modo padrão"; Mesa › Rolagens mostra "Dados" e "Dificuldade" | `components/chronicles/__tests__/chronicles.a11y.test.tsx` | Jest + RNTL |
| T-09 | `app.json` com `CFBundleDevelopmentRegion` `pt-BR` e `CFBundleLocalizations` com `pt-BR` | `test/nativeA11yConfig.test.ts` (mesmo padrão de `sheet/sync/__tests__/nativeConfig.test.ts`) | Jest |
| T-34 | `Stepper` sem `valueText` em 7, de 0 a 1000: `toHaveAccessibilityValue({ text: '7', min: 0, max: 1000, now: 7 })`; Primária 7 nas regras da crônica com texto "7" | `a11y.test.tsx`; `chronicles.a11y.test.tsx` | Jest + RNTL |
| T-25 | Sair do campo aplica (o contador vira "1 alteração"); abrir outro aplica e fecha o primeiro (um `TextInput` só); "3.5" recebe "Digite um número inteiro de 1 a 5" e não muda o valor; Esc cancela; o Enter continua igual | `evolve.a11y.test.tsx` | Jest + RNTL |
| T-35 | Web:<br>• `Pressable` com papel `radio`/`tab`/`switch`/`checkbox` chama `onPress` no Espaço; `button` não chama de novo, e `repeat` ou `disabled` não chamam;<br>• `useRovingFocus`: `tabIndex` 0 só no ativo, setas e Home/End movem;<br>• `Tabs` com ativação automática; `Choice` com ativação manual (a seta não chama `onChange`; o Espaço chama);<br>• `TabPanel` com `role` e `aria-labelledby`<br><br>iOS: aba com "aba 1 de 3" | `a11y.test.tsx` | Jest + RNTL |
| T-35 | Web: a seta no seletor de modo não troca o modo; o Espaço troca | `evolve.a11y.test.tsx` | Jest + RNTL |
| T-35 | Espaço e setas nas abas da ficha e nos rádios da Nova ficha; o Esc em "Escolher da lista" e em "Adicionar Antecedente" devolve o foco ao gatilho (`toBeFocused`) | `e2e/tests/a11y-keyboard.spec.ts` | Playwright (Chromium e WebKit) |
| T-38 | Campo do nome com `autoCorrect={false}` e `spellCheck={false}`; Conceito sem mudança | `sheet.a11y.test.tsx` | Jest + RNTL |
| T-38 | E-mail do login e do cadastro, e nome de usuário, com `autoCorrect={false}` e `spellCheck={false}` | `app/__tests__/app.a11y.test.tsx` | Jest + RNTL |
| T-41 | `ListItem` com `trailing` e sem `onPress`: nenhum ancestral do botão tem `accessible: true`, e o texto é um elemento com o rótulo. No `InviteSheet`, "Revogar" alcançável e fora de qualquer ancestral acessível | `a11y.test.tsx`; `chronicles.a11y.test.tsx` | Jest + RNTL |
| T-42 | `Chip`: com `'toggle'`, no web `aria-pressed` e sem `aria-selected`; com `'switch'`, papel `switch` e `checked` | `a11y.test.tsx` | Jest + RNTL |
| T-42 | Dados: "Rolagem oculta" é `switch` marcado, e o `POST` da rolagem leva `hidden: true`; desmarcado, `hidden: false`. Mesa: "Oculta" nasce marcada | `sheet.a11y.test.tsx`; `chronicles.a11y.test.tsx` | Jest + RNTL |
| T-42 | NPC do narrador:<br>• três `radio`, "Oculto" marcado e **não** desabilitado;<br>• no web, a seta não chama a mutação;<br>• "Identidade" chama uma vez com `clientCommandId`;<br>• com a mutação pendente, as opções ficam desabilitadas | `sheet.a11y.test.tsx` | Jest + RNTL |
| T-42 | Gatilho largo do narrador com nome "Narrador, Travada" e dica "Abre as ações do narrador" | `sheet/__tests__/policy.test.tsx:306-316` (atualizado) | Jest + RNTL |
| T-42 | No web, "Oculta" na Mesa é `switch` marcado e desmarca no clique | `a11y-keyboard.spec.ts` | Playwright |
| T-61 | Os dois "Escolher da lista" com nomes distintos ("…: Natureza" e "…: Comportamento") | `sheet.a11y.test.tsx` | Jest + RNTL |
| T-61 | No app, `TextEditorRow` e `ChoiceEditorRow` com rótulo "Nome" e valor "X" (sem "Nome: X, X"); no web, "Nome: X" | `evolve.a11y.test.tsx` | Jest + RNTL |
| T-61 | Cartão da Mesa com `problem` sem ".." | `chronicles.a11y.test.tsx` | Jest + RNTL |
| T-70 | Com `Platform.OS` em `android`, `Pressable` e `TextField` com `minHeight` 48; em `ios` e `web`, 44 | `a11y.test.tsx` | Jest + RNTL |
| T-70 | `tokens.ts`, `tokens.css` e `tokens.js` em dia com o `tokens.json` | `node design/scripts/build.mjs` e `git diff --exit-code` (o mesmo do CI) | CI |
| T-71 | Web: o fundo com `aria-hidden` e `tabIndex` −1, e um "Fechar" só. iOS: `onAccessibilityEscape` fecha | `a11y.test.tsx` | Jest + RNTL |
| T-71 | Web: num diálogo aberto, `getByRole('button', { name: 'Fechar' })` tem 1 elemento | `a11y-keyboard.spec.ts` | Playwright |
| T-72 | Web: `Skeleton` com `role="status"`, ocupado e com "Carregando"; `(app)/_layout` mostra a app bar "TMS" com a sessão em `loading` | `a11y.test.tsx`; `app.a11y.test.tsx` | Jest + RNTL |
| T-72 | Com `/auth/refresh` atrasado (`page.route`), abrir a ficha mostra `getByRole('status')` com "Carregando" e a app bar | `a11y-keyboard.spec.ts` | Playwright |

### 4.2 Testes e fluxos existentes que mudam junto

| Arquivo | O quê | Por quê |
|---|---|---|
| `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx` | l.233: texto "Digite um número inteiro de 1 a 5" | T-25 |
| `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx` | l.282-302: nome no app ("Clã", "Conceito", "Nome"), mais `toHaveAccessibilityValue` | T-61 |
| `apps/frontend/sheet/__tests__/policy.test.tsx` | l.306-316: gatilho largo | T-42 |
| `e2e/tests/journey-backstage.spec.ts` | l.109: `getByRole('radio', { name: 'Oculto' })` em `toBeChecked()` | T-42 |
| `e2e/tests/journey-storyteller.spec.ts` | l.131-132, l.225-226, l.255-256: `getByRole('button', { name: /^Narrador/ })` (a 1280 aparece o gatilho largo) | T-42 |
| `apps/frontend/.maestro/08-backstage.yaml` | l.30-39: "Oculto" e "Identidade.*" com `checked: true`, no lugar de `enabled: false`. l.55-57: "Oculta" com `checked: true` | T-42 |

Ficam verdes sem mudança:

- `views/__tests__/matrix.test.tsx`: rótulo que começa pelo texto visível e `accessibilityValue` com valor;
- `components.test.tsx`: Choice, Tabs, Chip, BottomSheet, Skeleton, ListItem e o alvo de 44 no iOS;
- `table-alerts.test.tsx`: "Só com alerta" continua `button`;
- `table-operations.test.tsx`: o rótulo visível do stepper é `aria-hidden`;
- os `getByRole('tab')` de `layouts.test.tsx`, `evolve.spec.ts` e outros;
- `create-character.spec.ts:37` ("Clã: Tremere", no web).

### 4.3 Suítes a rodar no "PR local"

```bash
npx pnpm turbo run typecheck lint --filter=@tms/ui --filter=frontend --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=@tms/ui --filter=frontend
node design/scripts/build.mjs && git diff --exit-code
python3 -I design/design-system/scripts/check_tokens.py design/design-system/tokens.json design/design-system/skins/*.json
```

- **Metas de cobertura**, que o CI aplica:
  - `packages/ui/jest.config.js`: 80% de linhas, funções, ramos e comandos;
  - `apps/frontend/jest.config.js`: 70/70/60/70 no global e 80/80/70/80 em `./sheet/`.

  Os ramos `Platform.OS === 'web'` e `'android'` precisam de testes com a plataforma trocada, ou o `roving.ts`, o `metrics.ts` e os ramos web do `BottomSheet` derrubam a meta.
- **Na integração da onda** (portas fixas, um por vez):
  - E2E inteiro em Chromium e WebKit, com o `a11y-keyboard.spec.ts` novo. Para não depender do Tab do WebKit, o E2E foca o elemento com `locator.focus()` e testa as teclas a partir dali;
  - build nativo (D-00, do P01-C), que compila o `app.json` novo.
- **Sem mudança**, nada a rodar: `@tms/sheet-core`, `@tms/api` e `@tms/db`.

---

## 5. Segurança

| O que pode dar errado | Como o desenho evita |
|---|---|
| O narrador rola achando que está oculta, e a rolagem sai para a mesa (o leitor anunciava o estado errado ou nenhum) | Um estado só: o `dice.hidden` e o `hidden` da parada livre alimentam o visual, o `aria-checked` e o corpo do `POST`. Papel `switch` com ligado/desligado explícito. O teste confere o anúncio e o `hidden` do pedido juntos |
| Revelar o NPC sem querer pelo teclado (a seta num grupo de rádio que seleciona ao focar) | Ativação manual no `Choice`: a seta só move o foco. Opções desabilitadas com o pedido pendente. A chave de idempotência e a revisão (`visibilityRevision`) continuam. O servidor segue como autoridade (AuthZ intocado). O teste prova que a seta não chama a mutação. Fail secure: o padrão do grupo não aplica nada sem ação explícita |
| Rótulo acessível vazar dado oculto | Nomes e valores saem só do que já está na tela daquele papel: o cartão da Mesa é do narrador e só muda a pontuação; o estado no gatilho é o que ele já vê; "aba N de M" é texto fixo; o `meta` da visibilidade descreve o efeito, não o conteúdo. As telas do jogador não ganham texto novo. O `journey-backstage.spec.ts`, com dados sentinela, continua valendo |
| Teclado do iOS guardar e sugerir o e-mail digitado | `autoCorrect={false}` e `spellCheck={false}` no e-mail e no usuário (cache do teclado, MASTG; MASVS-STORAGE-2). A senha já usa `secureTextEntry` |
| A app bar da restauração mostrar dado de outra sessão | O título é fixo ("TMS"), sem nome de usuário nem crônica. Nada é lido do cache antes de a sessão voltar |
| Espaço no `Pressable` disparar duas vezes (ação repetida ou destrutiva) | Só nos papéis que o react-native-web não trata; ignora `repeat` e `disabled`. Um teste fixa o comportamento, para pegar uma mudança na próxima versão do react-native-web |
| Foco devolvido a um elemento que saiu da tela | Confere `isConnected` antes de focar; sem o gatilho, vale o comportamento do navegador |
| "Digitar" aplicar um valor indevido ao sair do campo | Só aplica inteiro na faixa do template; o core (`applyBatch`) e o servidor validam de novo; vai para o rascunho e depende de "Salvar" |
| Mexer no `app.json` desligar uma proteção nativa | Só entram chaves de localização. O `nativeConfig.test.ts` (ATS, `allowBackup`, SQLCipher, SecureStore) continua passando |

Na matriz, o `/security-review` não é obrigatório para o P06. Recomendo rodá-lo no commit do T-42, que mexe no controle de sigilo.

---

## 6. Como generaliza além do WoD

- **Título do grupo.** Vem do `label` do campo no template, sem código novo:
  - D&D 5e: "Raça" e "Classe" (`design/templates/dnd5e-2014.json:40`, `:55`) ganham título na Nova ficha;
  - Call of Cthulhu 7e: a "Ocupação" é texto livre (`coc7e.json:20`) e já tem rótulo; se um template a declarar como `choice`, o título aparece igual;
  - os títulos das regras ("Aprovação do narrador", "Modo padrão") são da crônica, iguais em todo sistema.
- **Stepper.** Lê o número em qualquer escala: PV do D&D, "60%" do CoC (o `spoken` de `NumberEditorRow.tsx:38-41`), escada do Fate, Dificuldade do WoD.
- **Abas e painéis.** Saem das zonas e dos grupos do template (`zoneLabels`, `groupTabs`): Ficha · Poderes · Itens e notas no D&D, Ficha · Equipamento · Histórico no CoC.
- **Nome sem corretor.** Usa `model.template.identity.name`, que existe em todo template (`name` no dnd5e, no coc7e e no fate-core).
- **Interruptor de sigilo.** "Rolagem oculta" serve a qualquer sistema com rolagem do narrador; a visibilidade do NPC é a mesma em todos.
- **Alvo de 48 dp e teclado.** Dependem da plataforma, não do sistema.

---

## 7. Critério de pronto

Os passos do "PR local" da matriz (l.67-73):

1. **Plano aprovado:** este documento, com arquivos e linhas conferidos no código (seção 3) e as decisões da seção 2.
2. **Typecheck, lint e testes** dos pacotes afetados (seção 4.3), com as metas de cobertura.
3. **Um teste de regressão por bug** (seção 4.1).
4. **`/code-review` no diff do pacote**, mais `/security-review` no commit do T-42 (recomendado).
5. **Os cenários das personas, repetidos sem o defeito:**

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | T-09 | I-A, IA-05 (`iniciante-app.md`): Nova ficha → preencher o nome → "Criar ficha" sem tocar na grade | Título "Clã" acima da grade; a ficha continua podendo ser criada sem Clã (sem regra nova) |
   | T-09 | N-A, NA-01 (`narrador-app.md`): criar a crônica e olhar "Como funciona" | Títulos "Aprovação do narrador" e "Modo padrão" |
   | T-09 | PO-W, POW-04 (`po-web.md`): Nova ficha do Lobisomem; Mesa › Rolagens | "Raça", "Augúrio" e "Tribo"; "Dados" e "Dificuldade" |
   | T-09 | QA-A (`qa-app.md:10`): VoiceOver nos rádios do Sistema, num build nativo de iOS no simulador | Estado lido em português |
   | T-25 | E-W, EW-09 (`experiente-web.md`), 1280: clicar no número de Destreza → digitar 3 → clicar no número de Vigor | Destreza aplicada (o contador sobe) e um campo só aberto |
   | T-25 | QAW-43: em Força, digitar "3.5" | A mensagem de inteiro aparece e o valor não muda |
   | T-34 | QA-A e N-A, QAA-15 e NA-07: árvore ou VoiceOver na seção Orçamento da crônica, e na Dificuldade da Mesa | "7" e "6", sem porcentagem |
   | T-35 | QA-W, QAW-28 (`qa-web.md`), 1280: Tab até "Ficha" → Espaço; abrir "Adicionar Antecedente" → Esc | A aba ativa com Espaço; as setas andam no grupo; o foco volta ao "Adicionar Antecedente" |
   | T-35 | N-A, NA-09: árvore no iOS das abas Fichas/Mesa/Bastidores e Em jogo/Arquivadas | "aba N de M" e "selecionado" |
   | T-38 | PO-A, POA-05 (`po-app.md`): digitar "Livia Moraes (PO app)" no Nome, na Nova ficha e no Novo NPC | O nome fica como foi digitado |
   | T-41 | QA-A e N-A, QAA-16 e NA-08: Convidar → Gerar convite → VoiceOver no convite ativo | "Revogar" alcançável; o mesmo em Participantes (Remover), Diário (Editar) e Transferir (Propor) |
   | T-42 | QA-W, QAW-35: NPC → Dados → Rolagem oculta | Anunciado como interruptor ligado ou desligado |
   | T-42 | QA-A, QAA-17: abrir o NPC | "Oculto" como rádio marcado, sem aparência esmaecida |
   | T-42 | PO-W, POW-27 | Nome do gatilho = texto visível |
   | T-61 | PO-A e E-A, POA-06 e EA-26: leitor de tela na Nova ficha | Os dois "Escolher da lista" distintos |
   | T-61 | QAA-28 | TalkBack **ligado** no "Nome" do Editar e nos −/+ (confirma a hipótese da seção 3.8) |
   | T-61 | QAW-04 | Cartão da Mesa com ficha inválida, sem ".." |
   | T-70 | QA-A, QAA-28: árvore do `ui` no Android do teste | Alvos de 126 px (48 dp a 2,625), contra 115 px antes; registrar o estado do cabeçalho da ficha para o P08 |
   | T-71 | QA-W, QAW-16, IW-24 e NW-16: abrir qualquer diálogo → Tab | Um "Fechar" |
   | T-72 | QA-W, QAW-42, web 390: rede lenta → abrir a ficha | App bar e "Carregando" anunciado |

6. **Resumo para a seção do P06 no PR da onda:** o que mudou, como foi testado e os achados da revisão. Também a lista de APIs novas da seção 3.12 para os pacotes da onda 2.

---

## 8. Commits, esforço, riscos e conflitos

### 8.1 Ordem dos commits

Cada commit traz os próprios testes e a atualização de `components.md`.

| # | Commit | Itens | Esforço |
|---|---|---|---|
| 1 | `feat(ui): Espaço em papéis não-botão no web e foco itinerante` (`Pressable`, `roving.ts`) | T-35 (base) | P |
| 2 | `fix(ui): Choice com título visível, setas e disabled; app iOS em pt-BR` | T-09, T-35 | P |
| 3 | `fix(ui): Stepper lê o número e mostra o rótulo quando pedido` (+ 8 usos) | T-34, T-09 | P |
| 4 | `fix(ui): abas com setas, tabpanel e posição no iOS; setas no seletor de modo e nas prioridades` | T-35 | M |
| 5 | `fix(ui): BottomSheet com um Fechar só e foco de volta ao gatilho` | T-71, T-35 | P |
| 6 | `fix(ui): ListItem sem ação não engole os botões do trailing` | T-41 | P |
| 7 | `fix: estado dos alternadores de sigilo e da visibilidade do NPC anunciado` (+ seletores do E2E e do Maestro) | T-42 | P |
| 8 | `fix: rótulos únicos e completos` | T-61 | P |
| 9 | `fix(frontend): Digitar aplica ao sair, um campo por vez, recusa decimal` | T-25 | P |
| 10 | `fix(frontend): nome e e-mail sem corretor` | T-38 | P |
| 11 | `fix: carregamento anunciado e app bar na restauração da sessão` | T-72 | P |
| 12 | `test(e2e): teclado e foco no web` | T-25, T-35, T-42, T-71, T-72 | P |
| 13 | `feat(ui): alvo mínimo de 48 dp no Android` (token, geração, `hitTarget`) | T-70 | P |

**Esforço total: M** (cerca de 5 a 7 dias), em 13 commits. A matriz soma 10 P e 1 M; o que pesa mais é o T-35, as metas de cobertura dos ramos web e o E2E novo.

### 8.2 Riscos

- **Layout no Android (T-70).**
  - O alvo de 48 dp espreme o cabeçalho da ficha (T-11), que o P08 corrige na onda 2, e alarga os steppers inline. Como a onda 1 vai para a `main` antes do P08, o Android passa um tempo com o cabeçalho pior (pergunta 7 da seção 9).
  - Mitigação: é o último commit e pode ser revertido sozinho. Capturas do Android em 360 e 412 dp na conferência da seção 7 vão para o P08.
- **Português no iOS (T-09).** Depende do build nativo e de conferência manual (VoiceOver ou Accessibility Inspector). O CI do P01-C compila, mas não lê a árvore. Se não funcionar, a alternativa é a pergunta 2 da seção 9.
- **Espaço central no `Pressable`.** Um react-native-web futuro que trate Espaço em `tab`/`radio` causaria disparo duplo. O teste fixa o comportamento; na próxima subida de versão, conferir `PressResponder.js`.
- **Abas da crônica com ativação automática.** Cada seta carrega a visão (Mesa, Bastidores). O React Query guarda o cache, e é o que o DS pede.
- **Seletores de teste.** E2E (`journey-backstage`, `journey-storyteller`) e Maestro (`08-backstage`) mudam junto com o T-42, no mesmo commit.
- **Matriz de views.** Toda mudança de rótulo tem de manter `matrix.test.tsx` verde. Por isso os −/+ nativos ficam sem rótulo, e o T-61 separa o rótulo por plataforma.

### 8.3 Conflitos com os pacotes da onda 1 (P01-C, P02, P03-C)

| Arquivo | P06 | Outro pacote | Risco e como integrar |
|---|---|---|---|
| `apps/frontend/sheet/CharacterForm.tsx` | T-38: uma prop no `Editor` (l.96-106) | P03-C T-56: `onDirtyChange` (l.24, l.102-105) | Médio: linhas vizinhas. Integrar o P03-C antes; o P06 refaz a linha no rebase |
| `apps/frontend/components/chronicles/TableRow.tsx` | T-61: junção do rótulo (l.59-68) | P01-C L-02: texto da l.45 por um helper | Médio: trechos vizinhos (o `problem` da l.43-48 alimenta a junção). Integrar o P01-C antes; a normalização do P06 vale para o texto novo |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | T-35: `ModeSwitch` (l.220-261) | P03-C T-54 e T-78: `review` (l.110-121) e `SummarySheet` (l.315-411) | Baixo: trechos diferentes |
| `apps/frontend/sheet/SheetScreen.tsx` | T-42: `NpcVisibilityBar` (l.409-480) | P01-C L-02 (l.99-106); P03-C T-03 e T-17 (l.163-170, l.259-365) | Baixo: trechos diferentes |
| `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx` | l.233, l.282-302 | P03-C T-54 e T-78: casos novos | Baixo: casos diferentes |
| `apps/frontend/app/(app)/_layout.tsx` | T-72: l.10-15 | P01-C, pergunta 5: boundary no `(app)/_layout` (ainda não decidido) | Baixo; se o P01-C puser o boundary aqui, os trechos são vizinhos |
| `apps/frontend/app.json` | T-09: `ios.infoPlist` | P01-C: só lê `expo.name` (l.3) para o scheme | Baixo |
| `design/design-system/components.md` | Seções Choice, Chip, Stepper, SectionTabs, BottomSheet, ListItem e Skeleton | P03-C, se documentar o `Banner` (T-12) | Baixo: seções diferentes |
| `e2e/tests/journey-storyteller.spec.ts`, `journey-backstage.spec.ts` | Seletores do T-42 | P03-C revisa as asserções de "Salvo" nas jornadas | Baixo: linhas diferentes |

**De propósito, o P06 não toca:**

- `CreationSettings.tsx` e `__tests__/CreationSettings.test.tsx`: P01-C L-01 e P03-C T-56. O P03-C supõe que o P06 mexe nele; não mexe;
- `new-character.tsx`, de P01-C e P03-C;
- `chronicles/new.tsx`, do P03-C T-02;
- `Banner.tsx`, do P03-C T-12;
- `components.test.tsx`;
- `LeaveGuard.tsx` e `usePriorityChoice.ts`.

O P02 não tem arquivo em comum com o P06.

**Ordem sugerida de merge na onda:** P01-C, P03-C, P06 (o P06 faz rebase nos três arquivos de risco médio), P02 em qualquer ponto.

**Para as ondas seguintes.**

- **P05-C:** usa o `Stepper` (`showLabel`, `aria-valuetext`), `RadioChips` com setas e o `CreationPanel`.
- **P07-C:** usa o `BottomSheet` (foco) e o `ListItem`.
- **P08:** herda o T-70 e o `useRovingFocus` para o resto do teclado.
- **P11:** volta ao `NpcVisibilityBar` (agora um `Choice`).
- **P12:** volta ao `InviteSheet` (o `ListItem` já corrigido).

### 8.4 Arquivos tocados

| Arquivo | Itens | Tipo de mudança |
|---|---|---|
| `packages/ui/src/Pressable.tsx` | T-35, T-70 | alterado (Espaço no web, `hitTarget`, `ref`) |
| `packages/ui/src/roving.ts` | T-35 | novo (`useRovingFocus`) |
| `packages/ui/src/metrics.ts` | T-70 | novo (`hitTarget`) |
| `packages/ui/src/index.ts` | T-35, T-70 | alterado (exportações) |
| `packages/ui/src/Choice.tsx` | T-09, T-35, T-42 | alterado (API: `showLabel`, `disabled`; setas) |
| `packages/ui/src/Stepper.tsx` | T-34, T-09 | alterado (API: `showLabel`; `aria-valuetext`) |
| `packages/ui/src/Tabs.tsx` | T-35 | alterado (API: `id`; `TabPanel`; setas; iOS) |
| `packages/ui/src/BottomSheet.tsx` | T-71, T-35 | alterado (fundo, foco, `onAccessibilityEscape`) |
| `packages/ui/src/ListItem.tsx` | T-41 | alterado (comportamento com `trailing`) |
| `packages/ui/src/Chip.tsx` | T-42 | alterado (API: `kind`) |
| `packages/ui/src/Button.tsx` | T-61 | alterado (API: `accessibilityLabel`) |
| `packages/ui/src/Skeleton.tsx` | T-72 | alterado (`role="status"` no web) |
| `packages/ui/src/TextField.tsx` | T-70 | alterado (`minHeight` por `hitTarget`) |
| `packages/ui/src/tokens.ts` | T-70 | gerado (`build.mjs`) |
| `packages/ui/src/a11y.test.tsx` | todos | teste novo |
| `design/design-system/tokens.json` | T-70 | alterado (token `hit-size-android`) |
| `design/design-system/tokens.css` | T-70 | gerado |
| `design/design-system/tokens.js` | T-70 | gerado |
| `design/design-system/README.md` | T-70 | doc (tabela de tamanhos) |
| `design/design-system/components.md` | T-09, T-34, T-35, T-41, T-42, T-71, T-72 | doc (API RN e A11y) |
| `apps/frontend/app.json` | T-09 | config (`ios.infoPlist` pt-BR) |
| `apps/frontend/test/nativeA11yConfig.test.ts` | T-09 | teste novo |
| `apps/frontend/sheet/evolve/ChoiceEditorRow.tsx` | T-09, T-61 | alterado (`showLabel={false}`, `fieldA11y`) |
| `apps/frontend/sheet/views/state/StateViews.tsx` | T-09, T-70 | alterado (`showLabel={false}`, `hitTarget`) |
| `apps/frontend/sheet/SheetScreen.tsx` | T-42 | alterado (`NpcVisibilityBar` com `Choice`) |
| `apps/frontend/sheet/storyteller/StatusMenu.tsx` | T-42 | alterado (nome do gatilho largo) |
| `apps/frontend/sheet/dice/DiceSheet.tsx` | T-42, T-09 | alterado (`kind="switch"`, `showLabel` ×2) |
| `apps/frontend/components/chronicles/RollFeed.tsx` | T-42, T-09 | alterado (`kind="switch"` ×2, `showLabel` ×2) |
| `apps/frontend/components/chronicles/OperationSheet.tsx` | T-09 | alterado (`showLabel`) |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | T-09 | alterado (`showLabel`) |
| `apps/frontend/sheet/xp/forms.tsx` | T-09 | alterado (`showLabel` ×2) |
| `apps/frontend/sheet/evolve/NumberEditorRow.tsx` | T-25, T-70 | alterado (aplicar ao sair, validação, `hitTarget`) |
| `apps/frontend/sheet/evolve/typing.ts` | T-25 | novo (um campo por vez) |
| `apps/frontend/sheet/evolve/a11y.ts` | T-61 | novo (`fieldA11y`) |
| `apps/frontend/sheet/evolve/TextEditorRow.tsx` | T-61, T-38 | alterado (`fieldA11y`; nome sem corretor) |
| `apps/frontend/sheet/editors/Suggestions.tsx` | T-61 | alterado (nome do "Escolher da lista") |
| `apps/frontend/components/chronicles/TableRow.tsx` | T-61 | alterado (junção do rótulo) |
| `apps/frontend/sheet/editors/TextEditor.tsx` | T-38 | alterado (`properName`) |
| `apps/frontend/sheet/editors/types.ts` | T-38 | alterado (`EditorProps.properName`) |
| `apps/frontend/sheet/CharacterForm.tsx` | T-38 | alterado (passa `properName`) |
| `apps/frontend/app/(auth)/login.tsx` | T-38 | alterado (e-mail) |
| `apps/frontend/app/(auth)/register.tsx` | T-38 | alterado (e-mail e usuário) |
| `apps/frontend/app/(app)/_layout.tsx` | T-72 | alterado (app bar na restauração) |
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` | T-35 | alterado (`Tabs id` e `TabPanel`) |
| `apps/frontend/components/chronicles/TableView.tsx` | T-35 | alterado (`Tabs id` e `TabPanel`) |
| `apps/frontend/sheet/SheetView.tsx` | T-35 | alterado (`Tabs id` e `TabPanel`) |
| `apps/frontend/sheet/layouts/groupTabs.tsx` | T-35 | alterado (`id` e `panelProps`) |
| `apps/frontend/sheet/layouts/GroupsLayout.tsx` | T-35, T-70 | alterado (`panelProps`, `hitTarget`) |
| `apps/frontend/sheet/layouts/ChipFlow.tsx` | T-70 | alterado (`hitTarget`) |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | T-35 | alterado (`ModeSwitch` com setas) |
| `apps/frontend/sheet/creation/RadioChips.tsx` | T-35 | alterado (setas) |
| `apps/frontend/.maestro/08-backstage.yaml` | T-42 | fluxo nativo atualizado |
| `apps/frontend/sheet/evolve/__tests__/evolve.a11y.test.tsx` | T-25, T-35, T-61, T-09 | teste novo |
| `apps/frontend/components/chronicles/__tests__/chronicles.a11y.test.tsx` | T-09, T-34, T-41, T-42, T-61 | teste novo |
| `apps/frontend/sheet/__tests__/sheet.a11y.test.tsx` | T-09, T-38, T-42, T-61 | teste novo |
| `apps/frontend/app/__tests__/app.a11y.test.tsx` | T-38, T-72 | teste novo |
| `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx` | T-25, T-61 | teste alterado (l.233, l.282-302) |
| `apps/frontend/sheet/__tests__/policy.test.tsx` | T-42 | teste alterado (l.306-316) |
| `e2e/tests/a11y-keyboard.spec.ts` | T-25, T-35, T-42, T-71, T-72 | E2E novo |
| `e2e/tests/journey-backstage.spec.ts` | T-42 | E2E alterado (l.109) |
| `e2e/tests/journey-storyteller.spec.ts` | T-42 | E2E alterado (l.131-132, l.225-226, l.255-256) |

---

## 9. Perguntas abertas (técnicas)

1. **Abas no iOS.** O plano usa "aba N de M" no `accessibilityValue`, que não depende de traço. A outra opção é o contêiner com `accessibilityRole="tabbar"` (UIAccessibilityTraitTabBar), que pode dar o mesmo anúncio nativo no Fabric do RN 0.88, mas não foi conferida. Qual o VoiceOver lê melhor? Decidir no simulador, no passo 5.
2. **Português no iOS.** Com `CFBundleLocalizations: ["pt-BR"]`, o `RCTI18nStrings.bundle` do React.framework pré-compilado do SDK 58 resolve para o `pt.lproj`? Se não resolver, testar `["pt"]` ou `CFBundleAllowMixedLocalizations`. Fica aceito que os textos do sistema saiam em português mesmo com o aparelho em outro idioma?
3. **Ativação manual nos rádios.** É um desvio da APG ("a seleção segue o foco"). Vale para todos os grupos, como no plano, ou só para os que aplicam na hora, com uma prop?
4. **Gatilho que sumiu.** Depois do "Revogar", a linha do gatilho desaparece. Basta o comportamento do navegador, ou o `BottomSheet` precisa de um `returnFocusTo` explícito?
5. **T-25, sair com valor inválido.** O plano fecha o campo sem aplicar e mantém a mensagem, para garantir um campo aberto por vez. A alternativa é manter o campo aberto.
6. **"Rótulo: valor" mais `accessibilityValue` na Leitura.** O `describe()` em `ChoiceFact.tsx` e nas linhas de recurso e trilha repete o valor no leitor de tela, como o "Nome: X, X". É um padrão da Etapa 18, preso à matriz de views e a cerca de 18 testes. Tratar no P08 ou num pacote próprio?
7. **T-70 entre ondas.** A onda 1 vai para a `main` antes de o P08 corrigir o cabeçalho (T-11). Aceitar o cabeçalho pior no Android nesse intervalo, ou deixar as ações da `AppBar` em 44 até o P08?
8. **"−"/"+" no TalkBack.** Se o TalkBack ligado confirmar que os botões ocultos são lidos, a correção sai da hipótese da seção 3.8 e precisa de nova investigação. Com rótulo nos botões, a matriz de views quebra.
9. **Filtros de escolha única.** "Todas/Ocultas/Visíveis" e "Nome/Última alteração" ficam como `toggle` (`aria-pressed`). O DS-05 e o TL-16 preferem `radiogroup` para escolha única. Mudar já (um `kind: 'radio'` mais um grupo) ou no P09-C?

**Decisão que não se aplica como está escrita.** Nenhuma das D-00 a D-14 é do P06. Dois pontos da matriz para o PO:

- **T-09:** "o template pode marcar o que a criação exige (o Clã)" é mudança de contrato e de comportamento, não correção (seção 3.1).
- **R-01:** a R-01 lista o título "Modo de criação", mas o código usa "Modo padrão" (`CreationSettings.tsx:118`). O P06 mostra o rótulo atual e não mexe nesse arquivo. Trocar o texto é uma linha, que cabe no P01-C (L-01, mesmo trecho) se o PO quiser.
