# P17 · Ajustes da criação de ficha: plano de implementação

> Plano · 2026-11-07 · base conferida: `main` em `583159a` (v1.4.0) · revisão 5 (catálogo nominal preenchido; revisão editorial PT-BR identificada no anexo)

Origem: [notas do teste manual da criação de ficha](../notas-teste-criacao-ficha.md). Branch sugerida `pacote/p17-criacao-ajustes`, saindo da `main`. O pacote corrige o que o teste manual achou na criação de um Lobisomem: um rótulo que parece erro, a falta de ajuda em dois campos, a navegação entre abas, o texto e o modal dos pontos de bônus, os títulos de grupo quebrados e a forma de adicionar Qualidades e Defeitos.

Tudo abaixo foi conferido lendo o código no checkout do cabeçalho. Onde a causa ainda depende de reproduzir na tela, o texto diz.

**O que mudou na revisão 2:** a prévia do custo livre passa a vir da conta inteira, não do `metaAdvice` (§2.6); o `nextTab` ganha contrato completo, com bônus, alvos fora das abas e o anúncio pelo nome da aba (§2.2); o título do grupo deixa de depender de uma largura mínima fixa, e o teste de layout passa a exigir título inteiro e controles contidos, também no celular e com zoom (§2.5); o §3 diz o que chega às fichas existentes e o que só chega às novas; o fechamento do modal vira decisão a registrar antes do commit dele (§2.4, §5).

**O que mudou na revisão 3:** as quatro perguntas foram respondidas (§5). O rótulo "Nome de feito" fica; o modal segue a opção A; o catálogo de Qualidades e Defeitos entra nos três sistemas (Vampiro, Lobisomem e Mago), com a versão dos três templates; o tipo da Qualidade fica fora.

**O que mudou na revisão 4:** a lista de Qualidades e Defeitos passou a ser parte da especificação do pacote (§2.6). O anexo com as seis tabelas deve estar preenchido e revisado para fechar o planejamento de conteúdo; seu levantamento deixou de ser uma tarefa adiada para a implementação.

**O que mudou na revisão 5:** o [catálogo de Qualidades e Defeitos](P17-qualidades-defeitos.md) foi preenchido, com 299 entradas em seis tabelas e uma [fonte estruturada em JSON](P17-qualidades-defeitos.json). A pesquisa inclui sites brasileiros. Custos discretos, diferenças entre edições, opções exclusivas de Parentes e particularidades de M20 estão registrados no anexo; os rótulos PT-BR são propostas editoriais, sem alegação de tradução oficial.

## 1. Objetivo e itens

| ID | Sev. | Nota | O que o pacote entrega |
|---|---|---|---|
| N-01 | baixa | Lobisomem: "feito" × "efeito" | O rótulo "Nome de feito" fica, e o campo ganha o "?" explicando o que é (§5, decisão 1). |
| N-02 | baixa | Seita e Campo sem "?" | Os dois campos ganham a frase de ajuda no template; o "?" aparece sozinho. |
| N-03 | média | Aba seguinte sem destaque | Quando a aba atual não tem mais nada faltando, a próxima aba com pendências ganha o selo "a seguir". |
| N-04 | baixa | Aviso dos bônus incompleto | O aviso "os N pontos básicos já foram usados" diz que os bônus vêm depois que todos os grupos fecharem. |
| N-05 | média | Modal dos bônus fecha por toque fora | A folha "Começaram os pontos de bônus" não fecha ao tocar no fundo; ×, Esc e voltar do Android continuam (§5, decisão 2). |
| N-06 | alta | "Talentos" na vertical | O título de nenhum grupo é espremido pelo contador da conta, em nenhum estado (prioridade, básicos, bônus): o contador desce para a linha de baixo quando não cabe. |
| N-07 | média | Qualidades/Defeitos sem lista | Nos três sistemas (`vtm-v20`, `wta-w20`, `mta-m20`), "Adicionar Qualidade/Defeito" abre com o catálogo, cada nome de custo fixo com o seu custo (§5, decisão 3). |
| N-08 | média | Custo livre só depois de adicionar | Qualidade/Defeito de custo variável (nome do catálogo sem custo fixo, ou nome digitado) pede o custo na própria folha, com a prévia do efeito na conta, antes de entrar na ficha. |

Severidade: N-06 é alta porque a tela fica ilegível no desktop (a coluna vizinha também quebra) em todo grupo com prioridade, nos três sistemas WoD.

Alcance: N-03 a N-06 e N-08 são código e valem para toda ficha. N-01, N-02 e N-07 são conteúdo de template e só chegam às fichas criadas nas versões novas (§3).

## 2. Desenho por item

### 2.1 N-01 e N-02 · Identidade do Lobisomem (só template)

**Confirmado no código.**

- O rótulo é `"Nome de feito"` (`design/templates/wta-w20.json:45`), tradução de *Deed Name*: o nome que o Garou ganha por um feito. "Nome de efeito" mudaria o sentido. O problema real é que o rótulo, sozinho, parece erro de digitação.
- `sept` e `camp` são `text` sem `help` (`wta-w20.json:204` e `:207`). O `concept` já tem `help` (`:50`), e o editor de texto desenha o "?" a partir dele: `TextEditorRow.tsx:89` → `fieldHelp(def)` (`apps/frontend/sheet/evolve/help.ts:8`). O validador aceita até 400 caracteres no `help` de campo (`packages/sheet-core/src/validate/template.ts:481`).

**Mudança:** só conteúdo no `wta-w20.json`, nenhuma linha de código. Frases do time (README §12: nunca texto do livro), rascunho para revisão:

- `deedName.help`: "O nome que o personagem ganhou por um feito marcante, dado pela seita ou pela matilha (ex.: Canta-Tempestade). Pode ficar vazio no começo."
- `sept.help`: "A comunidade de lobisomens que guarda um caern, um lugar sagrado onde o mundo espiritual fica perto. Tem cargos próprios, do Guardião ao Mestre do Rito, e é a casa do personagem entre os Garou."
- `camp.help`: "Uma facção dentro da tribo, com ideias e deveres próprios: política, mística ou guerreira. Muda como o personagem vê a tribo e o que ela espera dele. Opcional."

O rótulo `Nome de feito` fica (§5, decisão 1), então `apps/frontend/sheet/__tests__/sheet.layout.test.tsx:154` e `e2e/tests/journey-werewolf.spec.ts:69` não mudam.

### 2.2 N-03 · Destaque da próxima aba

**Confirmado no código.**

- As abas da ficha saem das zonas do template mais a aba "Pontos" (`apps/frontend/sheet/SheetView.tsx:245-248`) e são desenhadas pelo `Tabs` do `@tms/ui` via `SheetNav` (`apps/frontend/sheet/SheetNav.tsx:49-56`). O `TabItem` só tem `id` e `label` (`packages/ui/src/Tabs.tsx:15-18`).
- O guia da criação já diz em que aba está cada pendência: `GuideItem.target` (`apps/frontend/sheet/creation/guide.ts:42-52`), com `kind` `blocking | missing | confirm` (`guide.ts:29`). É a mesma conta do `checkCreation`, sem nada de sistema. Mas o alvo nem sempre é uma aba de zona:
  - `target: null`: seção que o papel não lê; o comentário diz que leva à lista, na aba Pontos (`guide.ts:50-51`);
  - `target.tab === 'play'`: o "Em jogo", que abre se estiver recolhido e não está entre as abas (`guide.ts:32-34`);
  - `target.tab === 'creation'` (`POINTS_TAB`): a própria aba Pontos (`MISSING_TARGET`, `LEDGER_TARGET`, `guide.ts:55-71`).

**Contrato.** Função pura em `apps/frontend/sheet/creation/guide.ts`:

```ts
export interface NextTabInput {
  readonly items: readonly GuideItem[]               // guideItems(...)
  readonly tabs: readonly { id: string; label: string }[] // na ordem da tela
  readonly current: string                           // a aba à vista
  readonly freebies: { readonly remaining: number } | null // check.freebies
  readonly active: boolean                           // mode === 'create' e status 'creating'
}
export interface NextTab {
  readonly id: string        // a aba que ganha o selo
  readonly done: string      // o rótulo da aba atual, para o anúncio
}
export function nextTab(input: NextTabInput): NextTab | null
```

**Regras, na ordem:**

1. `active` falso (Leitura, Editar, narrador na ficha alheia, criação enviada ou concluída): `null`.
2. Só contam itens `blocking` e `missing`; `confirm` nunca conta (como no "Faltam" da barra, `guide.ts:24-28`).
3. Onde cada item conta: `target: null` → `POINTS_TAB`; `target.tab` entre as `tabs` → essa aba; qualquer outra (`'play'`, zona sem aba) → "fora das abas".
4. A aba atual tem item contado: `null`. O selo só aparece quando a aba à vista acabou.
5. A primeira aba com item contado, na ordem das `tabs`, começando depois da atual e dando a volta: essa.
6. Nenhuma aba com item contado, mas há item "fora das abas": `null`. A barra "Faltam" já leva até ele, e destacar Pontos ali mandaria o jogador para o lugar errado.
7. Nada pendente, `freebies` não nulo, `freebies.remaining > 0`, `POINTS_TAB` entre as `tabs` e a atual não é ela: `POINTS_TAB`.
8. Nada pendente e sem bônus a gastar (sistema sem bônus, ou saldo zerado): `null`. O "Concluir" já aparece.

**Tela:**

- `TabItem` ganha `attention?: string`. O `Tabs` desenha um ponto e o texto em `caption` abaixo do rótulo, e soma o texto ao nome acessível ("Vantagens, a seguir"). Nunca só a cor: o selo tem texto.
- `SheetView` chama `nextTab` com `guideItems(...)`, as `tabs` que já monta, `shownTab`, `check.freebies` e o modo, e passa `attention: 'a seguir'` na aba devolvida.
- Anúncio: só quando a aba à vista passa de "com pendência" para "sem pendência" com o jogador nela (não na montagem e não ao trocar de aba). O texto usa o rótulo da aba concluída: `"${done}: nada falta. A seguir: ${label}."`, como em "Vantagens: nada falta. A seguir: Pontos.". Mesmo padrão do `BonusNotice` (`CreationPanel.tsx:483`). Na mesma passagem em que o `BonusNotice` abre, este anúncio não sai (a folha já anuncia).

Fora do escopo: trocar de aba sozinho. A nota pede destaque, e mudar a tela debaixo do dedo do jogador é pior.

**Testes** (`apps/frontend/sheet/creation/__tests__/guide.test.ts` para a função, `CreationScreen.test.tsx` para a tela):

- a aba Ficha acaba → selo em Vantagens; o anúncio usa "Ficha";
- a aba Vantagens acaba com a Ficha ainda pendente → selo na Ficha (a volta);
- desfazer uma mudança reabre a pendência na aba atual → o selo some, sem anúncio;
- tudo feito com bônus sobrando → selo em Pontos; com saldo zero → nenhum; sistema sem bônus (`freebies: null`) → nenhum;
- item com `target: null` → conta para Pontos;
- item com alvo `'play'` e nada nas abas → nenhum selo, nem em Pontos;
- só itens `confirm` → tratados como nada pendente;
- modo Leitura e criação enviada → `null`;
- `Tabs` (`packages/ui`): com `attention`, o texto aparece e entra no nome acessível; sem ele, nada muda.

### 2.3 N-04 · Texto do aviso de pontos básicos usados

**Confirmado no código.** O texto sai de `basicsSpentText` (`apps/frontend/sheet/creation/creation.ts:1296-1306`), usado na fase `basics` em três lugares (`creation.ts:694`, `:950`, `:998`). A fase passa sozinha para os bônus quando **todos** os grupos fecham (`basicsDone`, `creation.ts:1278`; `CreationPanel.tsx:474-477`), mas o texto não diz isso.

**Mudança:** com bônus no sistema e na fase `basics`, a segunda frase vira: "Os pontos de bônus vêm depois que todos os grupos da ficha fecharem os pontos básicos (2 por ponto)." A primeira frase ("Conhecimentos: os 5 pontos básicos já foram usados.") fica igual. Quando `basicsClosed(check)` já é verdadeiro (a fase foi trocada à mão para `basics` com tudo fechado), o texto antigo continua certo e fica.

Testes que citam o texto: `apps/frontend/sheet/creation/__tests__/creation.test.ts`, `CreationScreen.test.tsx`, `creationStore.test.ts`, `e2e/tests/creation-feedback.spec.ts` (o fixture de `packages/ui/src/a11y.test.tsx:447` é só um texto de exemplo e pode ficar). Caso novo: com `basicsClosed` verdadeiro e fase `basics`, o texto antigo.

### 2.4 N-05 · O modal dos bônus fecha por toque fora

**Confirmado no código.** O `BottomSheet` fecha pelo fundo em todas as plataformas: `onClick` no web (`packages/ui/src/BottomSheet.tsx:279-285`) e `Pressable` no nativo (`:287-295`), além do × (`:321-326`), do Esc (`:268-275` e a pilha do documento, `:106-124`) e do voltar do Android (`onRequestClose`, `:262`). O `BonusNotice` usa o `BottomSheet` padrão (`apps/frontend/sheet/creation/CreationPanel.tsx:513-537`) e grava a marca "já visto" **ao abrir** (`CreationPanel.tsx:480-481`): fechado sem querer, o aviso nunca mais aparece naquela ficha.

**Decisão (§5, decisão 2): opção A, bloquear só o toque fora.** O relato pede "só pelo botão"; o acidente foi o toque fora. Os gestos deliberados continuam:

| Caminho | Antes | Depois |
|---|---|---|
| Fundo (toque/clique) | fecha | **não fecha** |
| × do cabeçalho | fecha | fecha |
| Voltar do Android | fecha | fecha |
| Esc (web, teclado) | fecha | fecha |
| "Entendi", "Ver Pontos" | fecham | fecham |

Descartada: a opção B (sem ×, sem voltar do Android, só os botões do rodapé). Ela segue o pedido ao pé da letra, mas tira o gesto padrão do Android, e o Esc teria de ficar de qualquer jeito para não prender o foco.

**Mudança no `@tms/ui`:** `BottomSheetProps` ganha `dismissOnScrim?: boolean`, com padrão `true` (nada muda nas outras folhas). Com `false`, o fundo continua cobrindo a tela, mas o toque nele não faz nada: o `onClick` do fundo no web e o `onPress` do `Pressable` no nativo deixam de chamar `onClose`. O `BonusNotice` passa `dismissOnScrim={false}`.

**Testes** (`packages/ui/src/components.test.tsx` e `a11y.test.tsx`):

- sem a prop: o comportamento atual, todos os caminhos chamam `onClose` (regressão);
- `dismissOnScrim={false}`: o toque em `bottom-sheet-scrim` não chama `onClose`; ×, Esc e `onRequestClose` chamam;
- `CreationScreen.test.tsx`: com a folha aberta, o toque no fundo deixa `bonus-notice` aberto; "Entendi" e × fecham.

### 2.5 N-06 · Títulos de grupo escritos na vertical

**Causa no código; o teste manual confirma o gatilho.** O título fica normal quando a ficha abre e quebra conforme a conta cresce. Vale para **todo grupo com escolha de prioridade** (Físicos, Sociais e Mentais; Talentos, Perícias e Conhecimentos; nos três sistemas WoD), não só Talentos.

- No desktop (`breakpoint === 'expanded'`), os grupos da seção ficam lado a lado, cada um com `flexBasis: GROUP_COL_MIN` (320) e `minWidth: 0` (`apps/frontend/sheet/layouts/GroupsLayout.tsx:87-88`, `:356-365`).
- O cabeçalho do grupo é uma linha `[título | contador]`: `SectionHeader` (`packages/ui/src/SectionHeader.tsx`) e `AnchorHeader` (`apps/frontend/sheet/layouts/AnchorHeader.tsx:40-47`). As duas usam `row: { flexDirection: 'row' }` e `text: { flex: 1 }`, ou seja, `flexBasis: 0` com `flexShrink: 1`. O título é o único elemento que encolhe, e pode encolher até a largura de uma letra.
- O contador (`CreationCounter`, `apps/frontend/sheet/creation/CreationCounter.tsx`) passa por três estados, e só o primeiro tem proteção:

  | Estado | O que aparece ao lado do título | Largura |
  |---|---|---|
  | Ficha aberta, sem prioridade | "Prioridade" + "?" | Limitada: `styles.narrow` (`maxWidth: 220`, `CreationCounter.tsx:62-66`, `:134`), com o comentário "a frase não espreme o título". **O título fica normal.** |
  | Prioridade escolhida | `counterText` "3/13" + chips 13 · 9 · 5 (alvo de 44 px cada) | Sem limite: `styles.row` (`:135-142`) já tem `flexShrink: 1` e `flexWrap: 'wrap'`, mas os chips não encolhem. |
  | Pontos de bônus | "13/13 · +1 bônus · +1 = 2 bônus" (`counterText`, `apps/frontend/sheet/creation/creation.ts:177-184`) + os chips | O texto mais longo. É o estado da imagem: o título vira uma letra por linha. |

  Os chips continuam ao lado do título durante toda a criação (`pickable` enquanto o status é `creating`, `CreationCounter.tsx:52-53`). Então, quanto mais a conta avança, mais o contador espreme o título.
- "A coluna da direita cortada" (Perícias também quebrada, como "Pe as") é o mesmo problema na coluna vizinha. Falta conferir na reprodução se, além disso, algum elemento de largura fixa passa da borda da coluna (o `minWidth: 0` deixa o conteúdo vazar).

**Mudança:** a regra vai no cabeçalho, não num limite de largura por estado. A proteção do `narrow` só cobria o primeiro estado, e a próxima frase nova do contador quebraria de novo. Também sem largura mínima fixa no título: um número em px quebra com fonte ampliada e com títulos longos.

1. Nos dois cabeçalhos, `row` ganha `flexWrap: 'wrap'`, e o texto passa de `flex: 1` para `flexGrow: 1, flexShrink: 1, flexBasis: 'auto'`. Com a base no tamanho do próprio título, a linha só cabe título e contador juntos se os dois couberem inteiros. Se não, o contador desce para a linha de baixo, alinhado à direita (`marginLeft: 'auto'` no contêiner do `right`). O título só encolhe quando ele, sozinho, é mais largo que a coluna, e aí quebra entre palavras.
2. No `CreationCounter`, `styles.row` ganha `minWidth: 0` e `maxWidth: '100%'` (o `flexWrap` já existe). Na linha de baixo, o contador quebra por dentro (texto acima dos chips) em vez de passar da coluna.
3. O `styles.narrow` fica redundante e sai. "Prioridade" segue a mesma regra.
4. Reproduzir na criação de Lobisomem, nos três estados, antes de mexer, para registrar o "antes" e confirmar se há outro elemento vazando da coluna.

**Testes:**

- `apps/frontend/sheet/__tests__/sheet.layout.test.tsx`: nos dois cabeçalhos, o estilo do título tem `flexBasis: 'auto'` (nunca `flex: 1`), e o da linha tem `flexWrap: 'wrap'`. Jest não mede layout; isto só impede a volta do estilo antigo.
- E2E novo, `e2e/tests/group-headers.spec.ts`, na criação de Lobisomem, nos três estados do contador (sem prioridade; prioridades escolhidas; básicos fechados e 1 ponto de bônus gasto), em Chromium e WebKit. Para cada grupo de Atributos e de Habilidades:
  - **título inteiro numa linha:** a altura do `boundingBox` do título não passa de 1,5 × o `line-height` computado do elemento, e `scrollWidth <= clientWidth` (nada cortado). Isso reprova "Conhecimentos" em duas linhas;
  - **contador contido:** o `boundingBox` do contador, de cada chip de prioridade e do "?" fica dentro do `boundingBox` da coluna do grupo (borda esquerda e direita);
  - **página sem rolagem lateral:** `document.documentElement.scrollWidth <= window.innerWidth`.
- Larguras: 1024, 1280 e 1440 px (desktop, colunas lado a lado); 390 × 844 (celular, com as abas por grupo e o contador na faixa fixa: a linha `creation-line-*` contida na tela); e 1280 px com zoom de 200% (`page.evaluate` com `document.body.style.zoom` no Chromium ou viewport de 640 px com `deviceScaleFactor: 2`), que é como o web mostra texto ampliado.
- Fonte ampliada no app nativo (Android, tamanho de fonte máximo): o CI não roda o nativo, então fica como item manual no roteiro de validação (§4), com captura de tela no PR.

### 2.6 N-07 e N-08 · Qualidades e Defeitos

**Confirmado no código.**

- Nos três templates, `merits` e `flaws` são listas sem `catalog`: `vtm-v20.json:712` e `:725`, `wta-w20.json:958` e `:971`, `mta-m20.json:720` e `:733`. Por isso a folha "Adicionar Qualidade" só tem o campo "Nome".
- Os três têm o mesmo formato: metas `kind` (texto) e `cost`/`bonus` (número, 1 a 10), e as mesmas regras de bônus: `{ "rule": "item-meta", "meta": "cost" }` na Qualidade e `{ "rule": "credit", "meta": "bonus", "max": 7 }` no Defeito (`wta-w20.json:1421-1422`, e o mesmo nos outros dois). O código de N-08 vale igual para os três, sem caso por sistema.
- O contrato já tem o que N-07 precisa: `catalog` (nomes) e `catalogDefaults` (o meta inicial por nome, até 10 entradas, cada uma com um valor e uma lista de nomes; `design/templates/schema.json:1380-1408`). Os Dons já usam assim com o Posto. A folha mostra o meta de cada opção ("Custo 3") (`apps/frontend/sheet/evolve/ListEditor.tsx:471-476`), e o item nasce com ele (`withCatalogDefaults`, `apps/frontend/sheet/evolve/listItem.ts:32-44`).
- Hoje, um item fora do `catalogDefaults` nasce com o `min` do meta (1), e o custo só se ajusta depois, no "+" da linha (T-08).
- O caminho de adicionar só leva o nome: `onAdd: (name: string) => Write` (`ListEditor.tsx:395`), e o `add` monta o item com `withItemDefaults(def, withCatalogDefaults(def, { id, name, value }))` (`ListEditor.tsx:142-159`). As duas funções só preenchem meta **ausente** (`listItem.ts:20-22`, `:36-41`).
- A prévia de hoje não serve para um valor escolhido. O `metaAdvice` (`creation.ts:1036-1062`) só descreve o próximo "+1" ("+1 = 1 bônus", "+1 = devolve 1, até 7"). Ele não recebe o valor nem calcula o efeito da inclusão inteira: uma Qualidade de custo 5 gasta 5, e um Defeito de 3 com o crédito já em 6 só devolve 1.

**N-07 (conteúdo, nos três sistemas, §5 decisão 3):** `merits` e `flaws` de `vtm-v20`, `wta-w20` e `mta-m20` ganham:

- `catalog`: os nomes das Qualidades e dos Defeitos do livro de cada sistema (V20, W20, M20), de custo fixo e de custo variável, até 200 por lista (`schema.json:1385`);
- `catalogDefaults`: uma entrada por custo (`{ "meta": "cost", "value": 3, "items": [...] }` na Qualidade, `"meta": "bonus"` no Defeito; os custos de 1 a 7 cabem nas 10 entradas). Só os de custo fixo entram aqui;
- `catalogHelp`: opcional, uma frase do time por nome, nunca a descrição do livro.

**Catálogo como parte do plano.** O anexo [P17-qualidades-defeitos.md](P17-qualidades-defeitos.md), no molde do `onda-4-conteudo.md`, integra esta especificação e já está preenchido. A fonte estruturada é [P17-qualidades-defeitos.json](P17-qualidades-defeitos.json). São seis tabelas: Qualidades e Defeitos de V20, de W20 e de M20. Cada linha registra:

- o nome em português (o termo da edição brasileira quando houver; senão, tradução do time marcada para revisão);
- o nome original, para conferir traduções e distinguir itens parecidos;
- o custo fixo, a faixa quando é variável ("1–3") ou os valores permitidos quando são discretos ("1 ou 3", sem transformar em faixa contínua);
- o tipo, só como referência para o jogador (não entra no template, decisão 4);
- a fonte e a página ou seção consultada, distinguindo o livro básico de suplementos e de outras edições;
- a situação da conferência: revisado ou pendente, com a divergência identificada quando houver.

O escopo continua sendo o livro básico de cada edição; suplementos não entram automaticamente por aparecerem numa lista da internet. Nomes ou custos sem referência ficam marcados como pendentes, sem serem apresentados como conteúdo conferido. Não entram descrições do livro.

O revisor confere os nomes e os custos nesse arquivo; os templates são gerados a partir dele. Nomes que se repetem entre os sistemas (Ambidestro, Bom Senso) usam a mesma grafia nos três, preservando eventuais diferenças de custo e de disponibilidade entre as edições. Custo fixo alimenta `catalogDefaults`; custo variável fica sem default e segue N-08. O anexo registra os totais de cada tabela, e a validação compara os nomes e os custos dos templates com essa lista para detectar omissões.

**Situação atual:** as seis tabelas contêm 63 Qualidades e 100 Defeitos de V20; 55 Qualidades e 64 Defeitos do apêndice de Garou de W20; 9 Qualidades e 8 Defeitos comuns de M20. Nomes originais e custos foram confrontados com as transcrições referenciadas; a revisão editorial dos rótulos PT-BR continua identificada como pendente. Não foram importados suplementos, características exclusivas de Parentes nem Falhas Genéticas como Defeitos comuns.

O anexo também explicita dois limites do contrato atual: faixas e valores discretos por nome não são validados pelo seletor genérico de N-08; Fé Verdadeira de M20 custa 7 por nível, e o meta limitado a 10 só representa a compra inicial de um nível pelo default 7. Não anunciar suporte automático a níveis adicionais nem validação por nome que o pacote não implementa. As opções de custo variável devem mostrar na ajuda a faixa ou os valores deste anexo.

O meta `kind` (Físico, Social...) é texto, e o `catalogDefaults` só guarda inteiro (`schema.json:1397`). Este pacote não mexe no contrato: o tipo fica em branco no item do catálogo, como hoje (§5, decisão 4).

**N-08 (código, genérico).**

*Quando o passo do custo aparece.* A lista tem um **meta de preço**: o `meta` de uma regra `item-meta` ou `credit` de `costs.freebie` que aponta a lista (a mesma busca do `metaAdvice`, `creation.ts:1042-1047`). E o nome escolhido não tem valor para esse meta no `catalogDefaults`: nome do catálogo de custo variável, ou nome digitado. Nome com custo no catálogo entra direto, num toque, como hoje. Lista sem meta de preço (Dons, Antecedentes) não muda.

*O passo, dentro da folha "Adicionar":*

- o nome escolhido, com "Trocar" (volta à busca sem adicionar, com o texto da busca preservado);
- um seletor de número com o rótulo do meta ("Custo" ou "Bônus"), entre o `min` e o `max` do meta (`wta-w20.json:965`, `:978`), começando no `min`;
- a prévia (abaixo), refeita a cada mudança do valor;
- o botão "Adicionar".

*O transporte do meta escolhido:*

- `onAdd` passa a ser `(name: string, meta?: Readonly<Record<string, number>>) => Write`, e o `pick` do `AddItemSheet` (`ListEditor.tsx:426`) repassa o meta do passo.
- No `add` (`ListEditor.tsx:142`), o item nasce como `{ id, name, value, meta }` **antes** do `withCatalogDefaults` e do `withItemDefaults`. Como os dois só preenchem meta ausente, o valor escolhido prevalece, e os outros metas (o `kind`) continuam com o padrão.
- O resto do caminho é o mesmo: `write([...items, item])`, a recusa do lote (`checkCreationBatch`) e a validação do servidor, que já confere a faixa do meta.

*A prévia, pela conta inteira.* Função pura nova em `apps/frontend/sheet/creation/creation.ts`, no lugar de estender o `metaAdvice`:

```ts
export function addPreview(
  model: SheetModel,
  sheet: SheetData,            // a ficha à vista no store (a mesma do check)
  input: CreationInput,        // state.creation, o mesmo do store
  list: FieldId,
  item: ListItem               // o item como o add vai criá-lo
): { readonly text: string; readonly short: boolean } | null
```

Ela roda `checkCreation(model, sheet, input)` e `checkCreation(model, sheetComOItem, input)` (`packages/sheet-core/src/creation.ts:311`; o store já roda a mesma conta em `sheetStore.ts:443`) e compara:

- **`item-meta` (Qualidade):** `spent` e `remaining` de `check.freebies`, antes e depois. "Custa 5 de bônus; restam 3." Se `remaining` ficaria negativo: "Faltariam 2 de bônus: custa 5, restam 3." (a frase de `creation.ts:624`), com `short: true`.
- **`credit` (Defeito):** o `cost` da linha da regra em `check.lines` (já limitado pelo `max`), antes e depois. "Devolve 3 de bônus." Se o limite corta: "Devolve só 1 de bônus: o crédito chega a 7." Se já está no limite: "Não devolve bônus: o crédito já está em 7."
- Sem conta de bônus (`freebies: null`, criação livre, Editar): `null`, e o passo mostra só o seletor.

O botão "Adicionar" continua habilitado com `short: true`, como o "+" de hoje: quem recusa é a conta exata do lote, e a recusa aparece na folha (T-19). A prévia avisa antes.

O `addAdvice` (a linha genérica "Custa o Custo do item em bônus", `creation.ts:1013-1025`) continua na busca, antes da escolha do nome.

**Testes:**

- `apps/frontend/sheet/creation/__tests__/creation.test.ts`, `addPreview`:
  - Qualidade de 5 com saldo 8 → "Custa 5 de bônus; restam 3.";
  - Qualidade de 5 com saldo 3 → "Faltariam 2...", `short: true`;
  - Defeito de 3 com crédito 0 → "Devolve 3"; com crédito 6 → "Devolve só 1"; com crédito 7 → "Não devolve";
  - sem bônus → `null`.
- `apps/frontend/sheet/evolve/__tests__` (ListEditor):
  - nome do catálogo com custo fixo entra num toque, com o custo do catálogo;
  - nome de custo variável e nome digitado abrem o passo; o item entra com o valor escolhido no meta de preço e o `kind` vazio;
  - o seletor não sai da faixa `min`–`max`;
  - "Trocar" volta à busca sem adicionar;
  - com saldo insuficiente, "Adicionar" é recusado pela conta e a folha mostra a recusa; o item não entra;
  - lista sem meta de preço (Dons) continua num toque.
- `packages/sheet-core` (validação do template), para os três templates novos: passam no validador; todo nome do `catalogDefaults` está no `catalog`; nenhum nome aparece em duas entradas do `catalogDefaults`; nenhum nome se repete no `catalog`.
- Validação de conteúdo contra `P17-qualidades-defeitos.json`: cada tabela conserva sua contagem; nomes e custos fixos correspondem ao catálogo revisado, e opções de custos variáveis ou discretos não recebem um default que esconda a escolha. Não exigir o mesmo custo para um nome compartilhado entre sistemas.
- E2E, um caso por sistema, conferindo o saldo de bônus depois de cada inclusão:
  - `journey-werewolf.spec.ts`: uma Qualidade do catálogo (custo fixo) e um Defeito de custo livre;
  - `journey.spec.ts` (Vampiro) e `journey-mage.spec.ts`: uma Qualidade do catálogo de custo fixo, para provar que o catálogo de cada template foi publicado.

## 3. Versão do template, migração e alcance

N-01 e N-02 mudam o `wta-w20.json`; N-07 muda os três. Seguem o padrão do commit `35b5e94` (onda 5), com um commit de versão único no fim:

- `templateVersion`, minor nos três: `vtm-v20` de `1.10.0` para `1.11.0`, `wta-w20` de `1.8.0` para `1.9.0`, `mta-m20` de `1.8.0` para `1.9.0`. É só conteúdo, com chaves que o contrato já tem (`help`, `catalog`, `catalogDefaults`, `catalogHelp`), e o app da v1.4.0 compila as versões novas.
- `packages/db/src/migrations/0027_templates_criacao.ts`: só `publishProductTemplates(db)` e `down` vazio, como a `0025_templates_onda5.ts`; registro em `packages/db/src/migrations.ts`.
- `packages/db/src/__tests__/migrations.test.ts`: o describe da 0027, no molde do da 0025: os arquivos têm o catálogo e a versão anterior montada no teste não; uma ficha de cada sistema na versão anterior continua igual depois da migração (`template_version` e `sheet_data`); a versão mais nova publicada é a de hoje nos três; a 0027 recusa a versão já gravada com outro conteúdo; descer não apaga versão publicada.
- `apps/api/src/templates/__tests__/publish.test.ts`: o `beforeProductTemplates` deixa a 0027 de fora.

**Alcance da entrega.** Cada ficha carrega o template pela versão gravada nela (`useTemplate(full?.systemCode, full?.templateVersion)`, `apps/frontend/sheet/data.ts:201`), e só a ficha nova recebe a última versão publicada (`latestTemplate`, `apps/api/src/sheets/routes.ts:149`, `apps/api/src/sheets/creation.ts:380`). Portanto:

| Item | Ficha nova (versão nova do seu sistema) | Ficha existente (versão anterior), inclusive em criação |
|---|---|---|
| N-01, N-02: "?" em Nome de feito, Seita e Campo (Lobisomem) | sim | não |
| N-07: catálogo de Qualidades e Defeitos (os três sistemas) | sim | não; a folha continua só com "Nome" |
| N-08: passo do custo | sim, para nome variável do catálogo e nome digitado | sim, para nome digitado (todo nome é "sem custo no catálogo") |
| N-03 a N-06 | sim | sim |

Isso é coerente com a arquitetura (a ficha não muda de template sozinha) e fica assim neste pacote. Levar uma ficha em criação para a versão nova seria um recurso à parte, fora daqui.

## 4. Ordem dos commits e validação

1. `fix(ui,app): o título do grupo não encolhe; o contador desce de linha` (N-06), com `group-headers.spec.ts`.
2. `feat(ui): BottomSheet com dismissOnScrim; o aviso dos bônus não fecha por toque fora` (N-05, opção A).
3. `fix(app): o aviso dos pontos básicos diz quando os bônus começam` (N-04).
4. `feat(app): a aba seguinte com pendência ganha o selo "a seguir"` (N-03).
5. `feat(app): Qualidade e Defeito de custo livre pedem o custo ao adicionar, com a prévia da conta` (N-08).
6. `docs(p17): catálogo de Qualidades e Defeitos de V20, W20 e M20` (versiona `P17-qualidades-defeitos.md` e `.json`, já preenchidos durante o planejamento; a revisão editorial deve ser concluída antes da publicação dos templates, §2.6).
7. `content(templates): ajuda de Nome de feito, Seita e Campo no wta-w20` (N-01, N-02).
8. `content(templates): catálogo de Qualidades e Defeitos no vtm-v20, wta-w20 e mta-m20` (N-07), depois da revisão do arquivo do commit 6. Pode ser um commit por sistema.
9. `chore(templates): vtm-v20 1.11.0, wta-w20 1.9.0, mta-m20 1.9.0 e a migração 0027` (§3).

1 a 5 são independentes entre si e podem avançar enquanto o catálogo é conferido. O levantamento e a revisão do anexo são trabalho de planejamento; o número 6 indica apenas sua posição no histórico de commits, não o momento de começar a lista. 8 depende de 5 (o custo variável do catálogo) e do catálogo revisado de 6. 9 fecha o pacote.

**Validação antes do PR:**

- `npx pnpm typecheck`, `npx pnpm lint`, `npx pnpm test`;
- E2E em Chromium e WebKit: `group-headers.spec.ts`, `creation-feedback.spec.ts`, `journey.spec.ts`, `journey-werewolf.spec.ts`, `journey-mage.spec.ts`;
- roteiro manual, com capturas no PR:
  1. depois da migração, **criar uma ficha nova de cada sistema** (Vampiro, Lobisomem, Mago) e conferir o catálogo de Qualidades e Defeitos (custo fixo num toque, custo variável pedindo o custo); no Lobisomem, também os "?" de Nome de feito, Seita e Campo;
  2. abrir uma ficha em criação **criada antes** (versão anterior) e conferir que ela continua sem catálogo, com o passo do custo para nome digitado;
  3. Android com o tamanho de fonte no máximo: cabeçalhos de Atributos e Habilidades nos três estados do contador.

## 5. Decisões

Registradas em 2026-11-07, com o usuário.

1. **"Nome de feito": fica.** O rótulo está certo (*Deed Name*); "efeito" mudaria o sentido. O campo ganha o "?" (§2.1). "Nome de façanha" e "Nome de honra" foram descartados por se afastarem do termo de quem já joga.
2. **Modal dos bônus: opção A.** Só o toque fora deixa de fechar; ×, Esc e voltar do Android continuam (§2.4). A opção B (só os botões do rodapé) foi descartada.
3. **Catálogo de Qualidades e Defeitos: nos três sistemas** (`vtm-v20`, `wta-w20`, `mta-m20`), neste pacote, com a versão dos três templates (§2.6, §3).
4. **Tipo da Qualidade vindo do catálogo: fora deste pacote.** Exigiria texto no `catalogDefaults`, uma mudança de contrato (schema, `sheet-core`, validador) que faria o app antigo recusar o template novo. O jogador preenche o tipo como hoje.

As decisões de interação estão registradas e o catálogo nominal já integra o plano (§2.6). Antes de publicar os templates, concluir a revisão editorial dos nomes PT-BR e tratar as divergências e particularidades identificadas no anexo; o levantamento da lista já foi feito. A reprodução de N-06 antes da correção continua como etapa de execução (§2.5, passo 4).
