# Design do TMS

Esta pasta guarda o **design** do TMS, já corrigido a partir da avaliação de UI/UX em [`doc/avaliacao-ui-ux.md`](../doc/avaliacao-ui-ux.md). **Ainda não é a implementação.** Nada aqui é importado por `apps/` ou `packages/`. É a referência que a implementação em Expo (React Native + Web) vai seguir.

O design substitui os dois artefatos originais:

- o design system "TMS Grimório";
- as telas "Fichas de WoD", que eram três telas escritas à mão.

No lugar deles ficam um **design system multi-sistema**, um **contrato de template** e um **protótipo navegável**. O protótipo monta a ficha de **qualquer sistema** a partir do template, com o mesmo código para todos.

## Como abrir

Abra no navegador. Não precisa de servidor, porque os arquivos funcionam direto do disco:

| O quê | Arquivo |
|---|---|
| Ponto de entrada | [`index.html`](index.html) |
| Telas: canvas de boards (6 sistemas, modos, tablet/web, listas, estados), com controles de tema, fonte 100/130/200% e largura 360/390/430 | [`telas/index.html`](telas/index.html) |
| Uma ficha em tela cheia | [`telas/ficha.html#c=helena`](telas/ficha.html) (`c=` helena, tomas, iara, lia, joana, dandara) |
| Vitrine do design system: tokens com contraste calculado e componentes vivos | [`design-system/index.html`](design-system/index.html) |

Parâmetros da ficha, na hash:

| Parâmetro | Valores |
|---|---|
| `as` | `owner`, `player`, `storyteller` |
| `theme` | `noite`, `pergaminho`, `sistema` |
| `fs` | `1`, `1.3`, `2` |
| `mode` | `evolve` |
| `state` | `loading`, `offline`, `conflict`, `error`, `forbidden`, `empty`, `archived` |

As fontes do design (Grenze Gotisch, Alegreya Sans, Cormorant Garamond e as das outras skins) **não são baixadas do Google**, por causa da LGPD. Se não estiverem instaladas na máquina, o protótipo usa o fallback da pilha. No app, elas são hospedadas com `expo-font`.

## Comandos

```bash
node design/scripts/build.mjs
python3 -I design/design-system/scripts/check_tokens.py design/design-system/tokens.json design/design-system/skins/*.json
```

- **`build.mjs`** gera `tokens.css`, `tokens.js` e `telas/dados.js`, e valida templates e personagens contra listas fechadas.
- **`check_tokens.py`** é o CI de cor: contraste WCAG nos dois temas e ΔE2000 ≥ 10 entre cada accent e `action`, com protanopia e deuteranopia simuladas.

Rode `build.mjs` depois de editar `tokens.json`, uma skin, um template ou os exemplos. Os arquivos gerados estão versionados para o protótipo abrir sem build.

## Estrutura

```text
design/
├── index.html                    ponto de entrada
├── design-system/
│   ├── README.md                 princípios, tokens, tipografia, modos, acessibilidade, layout
│   ├── components.md             catálogo de componentes (API proposta para RN, estados, a11y)
│   ├── tokens.json               fonte única dos tokens do core
│   ├── skins/{wod,dnd,coc,fate}.json   visual por família de sistemas
│   ├── tokens.css · tokens.js    gerados
│   ├── components.css · ui.js    CSS e construtores de referência (markup + acessibilidade)
│   ├── index.html · vitrine.js   vitrine
│   └── scripts/check_tokens.py   CI de cor
├── templates/
│   ├── README.md · schema.json   contrato de template (JSON Schema) e regras de segurança
│   ├── vtm-v20 · mta-m20 · wta-w20 · dnd5e-2014 · coc7e · fate-core (.json)
│   └── exemplos/personagens.json fichas fictícias (sheet_data)
├── estudos/
│   └── navegacao-da-ficha.md     rolagem × abas: medidas, tarefas e decisão
├── telas/
│   ├── index.html                canvas de boards
│   ├── ficha.html · cronicas.html · mesa.html
│   ├── prototipo.js · prototipo.css   renderizador único guiado pelo template
│   └── dados.js                  gerado
└── scripts/build.mjs · validate.mjs   build e validador do contrato (o mesmo que o servidor terá)
```

## A arquitetura em uma frase

> **O código conhece tipos genéricos (campos, seções, zonas, rolagens). O template conhece o sistema.**

As três camadas e o que mora em cada uma:

| Camada | Onde está | O que contém |
|---|---|---|
| **Core** | `design-system/` | Tokens semânticos sem nenhum termo de jogo e componentes por tipo de valor |
| **Skin** | `skins/` | Fonte display e de voz, forma do pip, glifos (a lua do augúrio é da skin WoD) |
| **Dados** | `templates/` | Campos, tipos, regras por nome, seções, dock, modelo de rolagem, rótulos e mapa de accent |

Um sistema novo é um template novo: uma linha em `trait_templates` e outra em `game_systems`, **sem migration e sem tela nova**.

O teste de aceitação pedido na §3.8 da avaliação foi cumprido. D&D 5e (SRD), Call of Cthulhu e Fate usam o mesmo renderizador, os mesmos componentes e os mesmos tokens que Vampiro, Mago e Lobisomem.

## Rastreamento: cada achado da avaliação e onde foi resolvido

**Legenda.**

- **Design:** resolvido nesta pasta.
- **Implementação:** está especificado aqui, mas depende do app, da API ou do banco.

| Achado | Onde foi aplicado | Fica para a implementação |
|---|---|---|
| **C-01** Edição acidental, sem modos nem desfazer | Modos **Leitura / Jogo / Evoluir** (`prototipo.js`: `buildModebar`, `canEdit`, `editableIn` no template). Pips não são alvo, então "tocar no valor atual reduz 1" deixou de existir. O stepper muda 1 por toque. Toda alteração em jogo gera aviso com **Desfazer** e entra no **histórico** (quem, quando, de → para). Evoluir é rascunho com resumo "N alterações" e Salvar/Descartar. **Teto não destrutivo:** Esferas acima do Arete ficam inativas e voltam quando o Arete sobe. | Histórico e assinatura persistidos no servidor |
| **C-02** Alvos de 14 e 22 px | Tokens `hit-size 44`, `row-min 48`, `pip-size 16` (só visual), `box-size 24` / `box-hit 44`, `stepper-size 56`. A linha e a célula inteiras são um único alvo. | `hitSlop` nos componentes RN |
| **C-03** Leitor de tela sem valores | Gramática de anúncio por tipo (`describe()`): "Destreza, 2 de 5", "Força, 16, modificador mais 3", "Esquivar, 45 por cento; difícil 22; extremo 9", "Atletismo, Ótimo, mais 4". Pips com `aria-hidden`. Stepper como grupo com botões −/+ reais e um `spinbutton` (segurar repete no visual e grava uma alteração ao soltar), radiogroup com setas, rótulo visível dentro do nome acessível ("FdV, …"), fundo `inert` com sheet aberto, títulos como heading, live region, foco preso no sheet com foco inicial no título. Vitalidade com resumo falado. | `accessibilityRole="adjustable"`, `accessibilityActions` e `announceForAccessibility` no RN |
| **C-04** Recursos de combate longe, barra sem estado | **Dock** com 3 recursos do template (`dock: [...]`) mostrando o valor, mais o botão **Dados**. Toque abre o sheet; toque longo faz a ação padrão com Desfazer; "Todos os recursos" abre a lista completa. Header compacto fixo, **3 abas por zona** (Ficha · Poderes · Sobre, com rótulo do template; ver o estudo em [`estudos/navegacao-da-ficha.md`](estudos/navegacao-da-ficha.md)), identidade recolhida. A partir de 600 px, painel "Em jogo"; a partir de 900, coluna sticky. | Háptico (`expo-haptics`) |
| **C-05** Camada base acoplada a WoD | Core + skin + dados. Um renderizador (`telas/prototipo.js`) para 6 templates. Nenhuma cor literal nas telas. `tokens.json` gera `tokens.css`. Validador de template com listas fechadas. | `packages/ui` com `tokens.ts` gerado do mesmo `tokens.json` |
| **C-06** Vitalidade por ciclo de toques | Sheet com **uma linha por tipo de dano**: glifo em caixa, nome por extenso e stepper (+ aplica 1 nível, − cura 1 nível). "2 de letal" são 2 toques. Guarda contagens por tipo, e a regra `wod-stacking` (por nome) ordena e agrava com a trilha cheia ("contusivo a mais virou letal" no aviso). Penalidade grande no topo e háptico mais forte no agravado. D&D usa `resource` com `tempFirst`; Fate usa `track` com caixas de valor. | – |
| **C-07** Parada de dados manual | Número ao lado dos pips em toda a ficha. Atributos em grade 3×3, sem as abas internas Físicos/Sociais/Mentais, e na mesma aba das habilidades. Habilidades com filtro "só com pontos" e busca; com o filtro ligado, **lista compacta** em chips "Nome N" (~55% menos rolagem, todas visíveis). Sheet único de parada: seleção com busca, modificadores com origem (ferimento, forma, condição), dificuldade ou CD, FdV ou invocação como bônus, **Rolar no app** e **Rolei na mão**, presets ("Conjurar efeito", "Teste de Sanidade") e última parada. Modelos `pool-success`, `sum-vs-target`, `roll-under-percent`, `fudge` e `pbta-2d6`, com `crypto.getRandomValues`. | Rolagens que valem para a mesa feitas **no servidor** |
| **C-08** Sem sincronização nem offline | Indicador no header (salvo / salvando / offline · N pendentes / erro), banner de offline, banner de conflito (prevalece a última alteração, com aviso) e evento `{campo, de, para, quando, quem}`. | Fila persistida, endpoint de eventos com validação e rate limiting, `expo-keep-awake` no modo sessão |
| **C-09** Fonte grande e 360 dp | Texto em `rem` (escala com a fonte). Refluxo por **fontScale ≥ 1,3 ou largura < 360** (`is-stacked`): grade vira lista, linhas empilham, dock em 2 colunas. Grade estreita (≤ 440 px) com pips de 12 e menos padding. Header e dock medidos em tempo real (`--header-measured`, `--dock-measured`), com `scroll-padding` para o foco nunca ficar sob eles. Matriz 360/390/430 × 100/130/200% no canvas de boards. | Mesma regra com `useWindowDimensions().fontScale` |
| **C-10** Web e tablet | Breakpoints em token (`compact`, `medium`, `expanded`). 600–899: uma coluna de até 640 com "Em jogo" em 2 colunas. ≥ 900: coluna sticky e grupos lado a lado se cada um tiver ≥ `minColWidth`. As mesmas ações nas duas plataformas (menu ⋯). Breadcrumb no web. | – |
| **C-11** Edição Revised no Vampiro | Habilidades da V20: Consciência, Ladroagem e Tecnologia entram; Esquiva, Segurança e Linguística saem. Clãs com a nomenclatura **V20** (Assamitas, Giovanni, Seguidores de Set). Código do sistema `vtm-v20`. Ids estáveis independentes do rótulo (`awareness` ≠ `conscience`). | – |
| **C-12** Forma do Lobisomem | Forma como chip no dock. Sheet com valores efetivos por forma e custo opcional em Fúria. A grade mostra o efetivo com "3 + 4 da forma Crinos = 7". O base só muda em Evoluir. Tipo genérico `state` com `modifiers` (add/set), o mesmo da Forma Selvagem e das condições de D&D. | – |
| **C-13** Cores de linhagem | Paleta fixa **accent-1…16** validada no CI (≥ 3:1, texto ≥ 4.5:1, ΔE ≥ 10 contra `action` com daltonismo). `accent-neutral` fora da ficha e sem linhagem (resolve Tremere × Vampiro). Ravnos sai do matiz do botão. Crias de Fenris em "Ferro". Recurso par (Gnose, Paradoxo) com cor quase neutra **e hachura**. Iniciais no avatar. O template mapeia linhagem → `accent-N`. | Validar o mapa de accent no servidor ao salvar o template |
| **C-14** Tokens e estados | `danger`, `success`, `ink-disabled`, `state-hover`/`pressed`, `scrim`, `elevation-1/2`, motion com "reduzir movimento", camadas, breakpoints e `border-width-*`. Estados `:active`, `:disabled`, `aria-busy`, foco distinto no botão primário (`focus-on-action`). | – |
| **C-15** Tipografia e LGPD | Sem `@import` do Google Fonts. Grenze 500 removida. Números sempre na sans tabular. Nome com reticências no header e no máximo 2 linhas. Opção "Títulos sem fonte decorativa". `voice` em 20/600. `fontFamily` por peso no `tokens.json` (nativo). | Hospedar as fontes com `expo-font` |
| **C-16** Tracejado com três sentidos | O indisponível não é desenhado; o teto vai em texto ("1 inativo · máx. pelo Arete (3)"). Vocabulário único: bônus = anel duplo + texto; perdido = traço diagonal + texto. No pergaminho, `border-control` passa a `#86797f` e `pip-empty` a `#86797e`. | `react-native-svg` para os pips |
| **C-17** Quintessência e Paradoxo ambíguos | Roda (`clock`) só como visualização. Sheet com dois steppers de nomes por extenso. A regra `mage-quint-paradox` anuncia "Paradoxo +1 consumiu 1 de Quintessência" com Desfazer. | – |
| **C-18** Poderes não consultáveis | Sheet de item (Disciplina, Dom, magia): nível, especialização, notas do jogador e "Montar parada". Textos protegidos não são embutidos. | – |
| **C-19** Narrador sem visão da mesa | Tela **Mesa**: uma linha por personagem com os chips do dock e a hora da última sincronização; abre em Leitura; "Editar como narrador" explícito e assinado no histórico. Seção "Narrador" com permissão só para o narrador. | Deslizar entre fichas, rastreador de iniciativa (D&D) e remover no servidor as seções sem permissão de leitura |
| **C-20** Navegação e ⋯ | O voltar leva o nome da crônica no rótulo, e o web tem breadcrumb. Menu ⋯: Evoluir, ações do template (Despertar, Descanso longo), Histórico, Rolagens da sessão, Trocar de personagem, Tema e leitura, Exportar/Imprimir, Arquivar e Excluir (digitando o nome). Lembra a aba ativa, a rolagem de cada aba, os filtros, a busca e a última parada por personagem. | – |
| **C-21** Safe areas e configuração do app | O protótipo usa `viewport-fit=cover` e `env(safe-area-inset-*)`, e o splash do tema é o `bg` noite (`#120e10`). | `app.json` (`userInterfaceStyle: automatic`, splash `#120e10`), `react-native-safe-area-context` no `Screen`, `<StatusBar style="light" />`, `peerDependencies`, `npx expo install react-native-svg`. Ficou fora por ser código de app. |
| **C-22** Microcopy e escala | Rótulos e glossário no template, nunca no código. "Permanente 3 · Temporário 4". Sem "Quint."/"Parad.". Espaçamentos na escala (4/8/12/16/24). Grupos em `title` (17), não em caixa alta de 12. | – |
| **C-23** Teclado, paisagem e lua | Editor de texto em sheet, com contador. Teclado numérico (`inputmode="numeric"`) ao tocar no valor do stepper. Lua do augúrio em SVG com contorno e terminador em elipse (glifo da skin WoD). | `KeyboardAvoidingView`; retrato no celular e rotação livre no tablet |

**Segurança e privacidade (§9 da avaliação).**

- **Já está no design:**
  - listas fechadas de `type`, `derive`, `rule`, `effect` e `roll.model` (`scripts/validate.mjs`), sem `eval` nem `new Function`;
  - rótulos validados como texto, e o DOM montado só com `textContent`;
  - cores só por `accent-N`;
  - rolagem com `crypto.getRandomValues`;
  - seções com `permissions`;
  - fila offline sem credenciais;
  - fontes sem terceiros.
- **Fica para a API:**
  - AuthZ por crônica com fail secure (dono edita a própria ficha; narrador edita as fichas da crônica dele; os demais só leem; sem regra, nega);
  - testes de IDOR;
  - validação de `sheet_data` pelo template a cada escrita;
  - template inserido só por perfil administrativo;
  - remoção das notas do narrador antes de responder ao jogador;
  - rate limiting no endpoint de eventos;
  - logs sem conteúdo de notas.

  Os detalhes estão em [`templates/README.md`](templates/README.md).

**Validação com usuários (§10).** O protótipo é o material para os testes moderados, mas eles não foram feitos.

## Requisitos para a implementação (segurança e acessibilidade)

Esta lista veio da revisão de acessibilidade e segurança feita sobre o protótipo. O protótipo é estático e usa dados fictícios. Por isso ele pode tirar o papel de quem vê da hash (`#as=`) e entregar todas as fichas num único `dados.js`. **O app e a API não podem.**

**Crítico**

1. **AuthZ no servidor em toda leitura e escrita.**
   - Papel derivado da sessão: JWT com algoritmo fixo, `exp`, `aud` e `iss`.
   - Dono edita a própria ficha; narrador (`chronicles.storyteller_id`) edita as fichas da crônica dele; os demais leem só se a crônica permitir; sem regra, nega.
   - Escrita por campo conforme `permissions.write` do template. Ficha arquivada rejeita escrita.
   - Testes de IDOR: jogador A altera a ficha de B; jogador grava `storytellerNotes`; narrador da crônica X altera ficha da crônica Y.
2. **O servidor filtra o que cada papel lê.** Seções com `permissions.read` que não incluem o papel de quem vê são removidas em todos os lugares:
   - `GET` da ficha;
   - listas e painel da mesa;
   - histórico (inclusive `de` e `para`);
   - broadcasts de sincronização;
   - exportação e impressão;
   - cache offline.

**Alto**

3. **`scripts/validate.mjs` é a autoridade.** Ele está em modo fail secure:
   - allowlist de chaves e `Object.hasOwn` (rejeita `__proto__` e `constructor`);
   - limites de tamanho;
   - campo derivado rejeitado;
   - `current` ≤ teto;
   - exceção vira erro.

   No servidor ele vira um schema TypeBox gerado do template. Os campos derivados são calculados no servidor, e o `sheet_data` fica preso ao `templateVersion`.
4. **Endpoint de eventos.**
   - O servidor define `id`, `at`, `by` e `byRole`.
   - Idempotência por `(ficha, clientEventId)`.
   - Concorrência otimista: se `from` ou a versão da ficha divergir, responde 409 e mostra a tela de conflito.
   - Rate limit por usuário e por ficha, limite de eventos por lote e auditoria sem o conteúdo de campos de texto.
5. **Rolagens que valem para a mesa.**
   - O servidor monta a parada a partir da ficha gravada e rola com `crypto.randomInt`.
   - Limite de dados e faces de lista fechada.
   - O gasto de bônus (FdV, Ponto de Destino) acontece na mesma transação.
   - "Rolei na mão" é gravado como manual e aparece de forma distinta.
6. **Contrato de acessibilidade no RN.**
   - **Stepper:** `accessibilityRole="adjustable"` com `accessibilityValue` e ações `increment`/`decrement`. Segurar repete só no visual e grava **um** evento ao soltar.
   - **Sheet:** `accessibilityViewIsModal` no iOS e `importantForAccessibility="no-hide-descendants"` no fundo, no Android.
   - **Foco:** volta ao controle de origem com `AccessibilityInfo.setAccessibilityFocus`, usando uma chave estável.
   - **Desfazer:** duração maior com leitor de tela, e também disponível no sheet e no histórico.
   - **Toque longo do dock:** exposto como `accessibilityActions`.
   - **Rótulo acessível:** começa pelo texto visível, como "FdV" ou "PV".

**Médio**

7. **Armazenamento no aparelho.**
   - Tokens só no `expo-secure-store`, com rotação do refresh token.
   - Fila offline e caches separados por usuário, sem credenciais, validados ao reidratar e sem campos do narrador no aparelho do jogador.
   - O logout apaga tudo.
   - Android com `allowBackup: false`.
   - No web, o token fica fora do `localStorage`.
8. **Templates.**
   - Inseridos só por perfil administrativo e validados pelo schema completo.
   - Registro de `derive`, regras e modelos de rolagem compartilhado entre cliente e servidor.
   - Nunca `eval`, `new Function` ou `dangerouslySetInnerHTML`, e nunca estilo montado a partir de string do banco.
9. **Cabeçalhos e API.**
   - CSP no web (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`), HSTS, `nosniff` e `Referrer-Policy`.
   - CORS com allowlist, nunca `*`.
   - `/swagger` desligado em produção e erros sem stack trace.
   - Auditoria de dependências (`pnpm audit`) no CI.
10. **Logs.** Nunca registrar o conteúdo de `text`/`longText`. Os rótulos do histórico já dizem "Notas atualizado", sem o texto.

**Decisão de produto pendente.** No protótipo, as `notes` do jogador (seção "Sobre") aparecem para os outros jogadores da crônica. A recomendação de menor privilégio é que a visibilidade padrão seja **dono + narrador**.

## Decisões de reconciliação (§5 da avaliação)

| Tema | Decisão |
|---|---|
| Recursos de combate no celular | Dock inferior, e coluna "Em jogo" a partir de 600 px |
| Nomes dos modos | Leitura, Jogo, Evoluir |
| Cor de linhagem | Paleta fixa `accent-N` validada, sem cor livre vinda do banco |
| Fórmulas no template | Nomes de funções registradas (`abilityModifier`, `vtmBloodPool`…) |
| Nome do conceito de campo | `type` + `display` |
| "Tocar no valor atual reduz 1" | Removido |
| Navegação da ficha (rolagem única × abas) | **3 abas fixas, uma por zona** (Ficha · Poderes · Sobre), com rótulo opcional no template (`zoneLabels`). Decidido por estudo com medidas nos 6 sistemas: [`estudos/navegacao-da-ficha.md`](estudos/navegacao-da-ficha.md). As variantes "rolagem única" e "abas por seção" ficam no canvas de boards para o teste com usuários. |
