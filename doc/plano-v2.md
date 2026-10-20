# Plano de implementação da v2: ficha de Lobisomem

> Plano · 2026-10-19 · base: `feat/v1-ficha-mago` em `220270d` (v1 completa: `vtm-v20` 1.2.0 e `mta-m20` 1.1.0 publicáveis)

Este plano leva a v1 até uma **ficha de Lobisomem: O Apocalipse (W20) utilizável**, com o mesmo motor e sem uma linha de código que saiba o nome do Lobisomem fora do core e do template.

| Documento | Responde |
|---|---|
| [`arquitetura-motor-de-ficha.md`](arquitetura-motor-de-ficha.md) | **Por que** e **como** o motor funciona |
| [`../design/templates/README.md`](../design/templates/README.md) | **O que** o template pode dizer |
| [`plano-v0.md`](plano-v0.md) | Como a v0 foi construída; as regras de teste do §4 continuam valendo |
| [`plano-v1.md`](plano-v1.md) | Como o Mago entrou; o molde que este plano repete |
| este documento | **Em que ordem** construir o Lobisomem, e **como provar** que cada passo funciona |

Como usar: o mesmo da v0 e da v1. Cada etapa é um PR, só termina com os testes verdes no CI, e uma etapa que muda o contrato atualiza as duas camadas (`schema.json` e `validate.mjs`) e o README do template no mesmo PR.

**Por que o Lobisomem agora.** O §10.3 da arquitetura diz que a família WoD pede só `clock`, `cap` e `state`. A v1 entregou os dois primeiros. Falta o `state` (as Formas), o único tipo que **muda o valor efetivo de outros campos** em jogo. É o teste mais duro do resolvedor até aqui: uma troca de forma mexe na grade, na parada de dados, no dock e na mesa ao mesmo tempo.

---

## 1. Onde queremos chegar

A v2 está pronta quando esta jornada roda inteira no app e no web, e um teste E2E a repete no CI:

1. O narrador cria uma crônica e escolhe **Lobisomem (W20)** entre os três sistemas publicados.
2. O jogador entra com o convite e cria a ficha: nome, nome de feito, conceito, raça, augúrio (com a fase da lua), tribo, seita e totem. O formulário sai do template.
3. A ficha abre em **Editar**: atributos, habilidades, Fúria, Gnose, FdV, Posto, Renome (permanente e temporário), Dons, Ritos, Fetiches e antecedentes. Salvar grava **um** lote.
4. Em **Jogo**, o dock mostra Vitalidade, Fúria e Forma. O jogador troca para **Crinos** com a mudança instantânea: um lote só, "Forma Hominídeo → Crinos, Fúria 4 → 3", com aviso e Desfazer. Sem Fúria, a mudança instantânea fica desabilitada e o motivo aparece.
5. Em Crinos, a grade mostra Força 7 ("3 + 4 Crinos") e Aparência 0, e o Editar continua editando a base (3).
6. O jogador rola **Força + Briga**: a parada usa o valor efetivo e mostra "Crinos +4". O atalho **Teste de Fúria** monta a parada de Fúria.
7. O jogador leva dano letal e usa **Regenerar**: cura 1 nível contusivo ou letal, sem custo; o agravado fica.
8. O narrador vê na mesa a forma de cada lobisomem e lê no histórico "Forma Hominídeo → Crinos".
9. Tudo do passo 4 ao 7 funciona offline.
10. As jornadas do Vampiro (`journey.spec.ts`) e do Mago (`journey-mage.spec.ts`) continuam verdes, sem mudança.

O que fica fora está no §8.

---

## 2. Ponto de partida

O `wta-w20` existe desde o protótipo, passa nas duas camadas de validação e já tem o `identity.emblem` (`claws`). Boa parte do motor já o atende sem saber dele:

| Área | Hoje | O que falta para a v2 |
|---|---|---|
| Template | `design/templates/wta-w20.json` 1.1.0: válido, compila, **nunca publicado** (não está em `PUBLISHED_SYSTEMS`) | `identity.columns`, `groupTabs`, Ritos, Fetiches, a ação Regenerar, revisão dos rótulos |
| Core: `state` | tipo, valor (id da opção), `validateSheet`, `short`, `describe`; o `resolve` aplica `modifiers` (`add` com piso 0, `set`) e guarda a origem; `describeEvent` dá "Forma Hominídeo → Crinos" | `planState`: a troca com o `cost` opcional (Fúria) num lote, o bloqueio sem Fúria e a prévia dos valores efetivos de cada forma |
| Core: `rating` | `describe` fala do modificador ("base 3 mais 4 da forma Crinos") e do valor acima do máximo | o texto do `describe` diz "forma" fixo; passa a usar o rótulo do campo `state` (outro sistema chamaria de outra coisa) |
| Core: rolagem | `poolOptions` e `planPool` usam o efetivo e listam "Crinos +4" (teste em `pool-success.test.ts`); `roll.presets` Fúria e Gnose (v1) | nada |
| Core: Renome | `resource` com `tempUncapped` validado e resolvido | nada |
| App: `state` | só o `ChoiceEditorRow` (Editar), mas o campo é `editableIn: ["play"]`. Em Jogo cai no `GenericRow`, `GenericChip` e `FieldDetail`: **não dá para trocar de forma** | views `row`, `chip` e `sheet`, com a lista de formas, o hint dos efetivos e o custo |
| App: modificadores | o `RatingRow` desenha pips de bônus (`value − base`); nada mostra a origem; acima do máximo (Força 7 de 5) não tem forma visual | valor efetivo com marca e origem na grade, nas linhas e nos chips; o aviso no Editar |
| App: Renome | o `ResourceEditorRow` respeita o `tempUncapped` | a linha de Leitura e Jogo com "Permanente 3 · Temporário 4" |
| App: augúrio | `glyph: "augur-moon"` e `glyphParam` validados no core | o glifo `AugurMoon` no `@tms/ui` (está no design system, não no app) |
| API | nenhuma rota tem nome de sistema | nada de código; publicar o template |
| Dados de teste | 1 ficha em `exemplos/personagens.json` (`iara`) | uma ficha nova e uma no limite |
| E2E | o seed publica `PUBLISHED_SYSTEMS` | entrar na lista; a jornada do Lobisomem |

Nada no banco muda: o Lobisomem é **dado**. Uma migration nesta v2 é sinal de defeito, e o PR que a trouxer precisa explicar por quê.

---

## 3. Mapa das etapas

| # | Etapa | Trilha | Depende de | Tamanho |
|---|---|---|---|---|
| 1 | Template `wta-w20` pronto para publicar | template | – | P |
| 2 | Core: `planState` e a troca com custo | core | – | M |
| 3 | `StateChoice` e as views da forma | ui, app | 2 | G |
| 4 | Modificadores visíveis, Renome e o glifo do augúrio | ui, app | 1 | M |
| 5 | Rolagem e Regenerar em forma | app | 3, 4 | P |
| 6 | Publicação e regressão com três sistemas | API, E2E | 1, 2, 3 | M |
| 7 | Jornada do Lobisomem e fechamento da v2 | todas | todas | M |

**Trilhas paralelas.** As etapas 1 e 2 não dependem uma da outra; a 4 só precisa do template. O caminho crítico é **2 → 3 → 6 → 7**: a troca de forma é o único fluxo novo de verdade.

**Marcos.**

| Marco | Etapas | O que dá para mostrar |
|---|---|---|
| A. Contrato e core | 1–2 | Nada visível, tudo testado: template final e a troca de forma como função pura |
| B. Ficha no app | 3–5 | A ficha de Lobisomem montada, trocando de forma, rolada e curada no app, com o template ainda vindo de fixture |
| C. Publicação | 6–7 | Uma crônica de Lobisomem de verdade, ao lado das de Vampiro e Mago, e as três jornadas no E2E |

---

## 4. Estratégia de testes

As camadas, as ferramentas e as metas de cobertura são as da v0 e da v1. O que muda:

- **Três sistemas no produto, um no fixture.** Vampiro e Mago viram o teste anti-acoplamento do Lobisomem. O D&D continua como fixture nas etapas que tocam o renderizador (3 e 4). Nenhum fixture tem `state` hoje, então a Etapa 2 cria um mínimo em `__tests__/` (uma postura de 2 opções, sem `cost` e sem nome de sistema), que prova que a view da forma não é do Garou.
- **Nenhum `if (system === ...)`.** O `scripts/check-system-names.mjs` já pega `wta-w20` e `wta*`. Ids de opção (`crinos`, `hominideo`) e rótulos do W20 também não podem aparecer em `apps/` e `packages/ui/` fora de `__tests__/`: a Etapa 3 estende o script com os ids de opção de `state` dos templates do produto.
- **Fichas no limite.** `exemplos/personagens.json` ganha duas fichas de Lobisomem (Etapa 1): uma recém-criada, com os padrões, e uma Impura em Crinos, com Fúria 0, a Vitalidade ferida (com agravado) e Renome temporário acima do permanente. Elas servem ao core, à API, ao app e ao E2E.
- **A matriz de AuthZ não muda.** A v2 não cria rota.
- **Regressão.** `journey.spec.ts` e `journey-mage.spec.ts` rodam em todo PR, sem edição. A exceção conhecida é a da v1: com três sistemas, as jornadas marcam o sistema na nova crônica, e isso já está feito.

---

## 5. Etapas

### Marco A. Contrato e core

#### Etapa 1. Template `wta-w20` pronto para publicar

P · depende de: nada

**Objetivo.** Fechar o template antes de publicar, porque versão publicada é imutável. Como a 1.1.0 nunca foi publicada, os ajustes entram nela mesma.

**Entrega** (`design/templates/wta-w20.json`):

- `identity.columns`, como no Mago: `[["name", "deedName", "concept"], ["breed", "auspice", "tribe"], ["sept", "totem"]]`. A criação segue essa ordem.
- `groupTabs: true` em Atributos e Habilidades.
- Ritos: um campo `rites` do tipo `list`, com `itemLabel: "Rito"`, `item: { meta: [{ id: "level", type: "number", label: "Nível", min: 0, max: 5 }], notes: true }`, sem `value` e **sem catálogo** (os textos dos ritos são protegidos, §12 do contrato).
- Fetiches: um campo `fetishes` do tipo `list`, com `itemLabel: "Fetiche"` e `meta` de Nível e Gnose. Fica separado do antecedente Fetiche, que continua no catálogo de antecedentes.
- Ritos e Fetiches entram em seções novas da zona `powers`, depois dos Dons.
- A ação **Regenerar** (`health.heal`, `types: ["bashing", "lethal"]`, sem `cost`), com `help` "Cura 1 nível contusivo ou letal. O agravado fica." O `effects.ts` já aceita `health.heal` sem custo.
- Revisão dos rótulos com a terminologia do W20 em português: Raça (Hominídeo, Impuro, Lupino), Augúrio, Tribos, Posto, Glória, Honra, Sabedoria e as cinco Formas.
- `exemplos/personagens.json`: as duas fichas novas do §4.
- `node design/scripts/build.mjs` em dia (job `design` do CI).

**Testes.**

- o template passa no Ajv e no `validateTemplate`, e compila;
- as 3 fichas de Lobisomem passam no `validateSheet`;
- `identityFields` tem os 8 campos das colunas, na ordem, e o Posto do resumo (um `rating`, que o formulário de criação não mostra);
- um `rites` com `value` no item é rejeitado (o `list` sem valor vale para o Lobisomem também);
- Regenerar na ficha no limite cura 1 nível letal e deixa o agravado.

**Pronto quando.** O template não precisa mais mudar para a jornada do §1.

#### Etapa 2. Core: `planState` e a troca com custo

M · depende de: nada

**Objetivo.** A troca de forma como função pura, no molde do `planClock`: a view só chama e mostra o resultado.

**Entrega** (`packages/sheet-core/src/`):

- `rules/state.ts`:
  - `planState(model, sheet, fieldId, optionId, { payCost })` devolve o lote, as notas do toast e o motivo do bloqueio, se houver;
  - sem `payCost`, o lote tem só o evento do `state`;
  - com `payCost`, o lote tem também o gasto no `resource` do `cost` ("Forma Hominídeo → Crinos, Fúria 4 → 3");
  - recurso abaixo do `amount` → bloqueado ("Fúria insuficiente para a mudança instantânea");
  - trocar para a forma atual não gera lote;
  - o `cost` com `optional: false` sempre cobra; sem `cost`, `payCost` é ignorado.
- `statePreview(model, sheet, fieldId)`: por opção, os valores efetivos que mudam ("For 7 · Des 4 · Vig 6 · Man 0 · Apa 0"), a partir do `resolve` da ficha com a opção aplicada. Sem texto de sistema: os rótulos vêm do `shortLabel` dos campos.
- `fields/rating.ts`: o `describe` usa o rótulo do campo `state` de onde veio o modificador, em vez de "forma" fixo.
- `labels.ts`: nada muda. `choice` e `state` já descrevem a troca.

**Testes.**

- tabela da troca: com e sem custo, com Fúria suficiente e com Fúria 0, para a mesma forma, e um `cost` obrigatório (no fixture mínimo de `state` do §4);
- propriedades com `fast-check`, sobre fichas válidas geradas a partir do template:
  - todo lote passa no `validateSheet`;
  - `applyBatch(invert(b))` devolve a ficha original;
  - nenhum lote debita recurso sem trocar a forma;
  - nenhum valor gravado de `rating` muda numa troca (os modificadores mudam só o efetivo);
- `statePreview` de Crinos na Iara: For 7, Des 4, Vig 6, Man 0, Apa 0;
- o `describe` de um atributo modificado pelo fixture mínimo usa o rótulo dele, não "forma".

**Nota.** Como na v1, o servidor valida a forma do valor (id de opção e recurso dentro dos limites), não a regra. Um lote que troca para Crinos sem gastar Fúria é aceito: a mudança lenta é legal. Ver §7, decisão 2.

### Marco B. Ficha no app

#### Etapa 3. `StateChoice` e as views da forma

G · depende de: 2 · referência visual: `design/design-system/components.md#choice--statechoice`

**Objetivo.** A forma ganha as mesmas variantes do `resource`, do `track` e do `clock`, sem saber que é do Garou.

**Entrega.**

- `@tms/ui`: o `Choice` aceita `hint` por opção (o design system chama de `StateChoice`). A lista vertical cabe em 360dp com fonte grande; com 5 opções, não vira grade.
- `apps/frontend/sheet/views/state/`:
  - `StateRow`: o rótulo, a opção atual e o `hint` ("Crinos · lobisomem");
  - `StateChip`: a opção atual no dock e na mesa;
  - `StateSheet`: a lista de opções com o `statePreview` em cada uma, a `note` da opção escolhida ("Humanos que veem a forma Crinos sofrem o Delírio") e, se houver `cost`, a alternância com o `label` do template ("Mudança instantânea: gastar 1 Fúria"). Confirmar chama o `planState`; um bloqueio desabilita a alternância e mostra o motivo; as notas vão para o toast com Desfazer.
- `baseViews.state` passa a ter `row`, `chip`, `sheet` e o `editor` de hoje.
- Háptico: seleção na lista e um padrão mais forte quando a troca gasta o recurso.
- `scripts/check-system-names.mjs`: proíbe também os ids de opção de `state` dos templates do produto.

**Testes** (Jest + RNTL):

- o sheet anuncia cada forma com os efetivos ("Crinos, lobisomem, Força 7, Destreza 4...");
- Crinos com a mudança instantânea → um lote com a forma e Fúria −1, e o toast com Desfazer;
- Fúria 0: a alternância fica desabilitada e o motivo é anunciado; a troca sem custo continua possível;
- em Leitura e em Editar, a forma não abre o sheet de troca (`editableIn: ["play"]`);
- a matriz skin × tipo × variante inclui as três views novas;
- **contagem de render:** trocar de forma re-renderiza os atributos com modificador e a forma, e não a Vitalidade nem a FdV;
- o fixture mínimo de `state` abre o mesmo sheet, sem alternância de custo.

#### Etapa 4. Modificadores visíveis, Renome e o glifo do augúrio

M · depende de: 1

**Objetivo.** O jogador entende o efeito da forma sem abrir o detalhe, e a ficha de Lobisomem mostra o que o template já declara.

**Entrega.**

- Modificadores na grade 3×3, nas linhas e nos chips do Jogo e da Leitura:
  - o valor efetivo com uma marca de modificado, e a origem embaixo ("3 + 4 Crinos", "Crinos: 0");
  - acima do máximo (Força 7 numa escala de 5): os 5 pips e "+2", sem esticar a linha;
  - abaixo da base: os pips perdidos em vazado, não somem;
  - o nome acessível é o `describe` do core (já fala do modificador).
- Editar: a linha de um atributo modificado edita a **base** e avisa "efetivo 7 em Crinos". O resumo do Concluir não fala de modificador, porque nada gravado muda.
- Renome: a linha de `resource` com `tempUncapped` mostra "Permanente 3 · Temporário 4" em Leitura e Jogo. O `valueLabels` do Posto aparece no fato ("2 · Fostern").
- `@tms/ui`: o `AugurMoon` (skin `wod`), desenhado do `glyphParam` (0 a 1), com `accessible={false}`. O fato do Augúrio e o editor de `choice` com `glyph` o mostram ao lado do rótulo.

**Testes.**

- Iara em Crinos: a célula de Força mostra 7 e "3 + 4 Crinos", e a de Aparência mostra 0;
- Força 7 de 5 não quebra a linha em 360dp com fonte grande (snapshot de layout);
- Editar em Crinos: o stepper de Força começa em 3, e o lote grava 4 ao subir um ponto;
- Glória temporária 4 com permanente 3 aparece como tal, e a Glória sem `tempUncapped` (fixture) continua limitada;
- o `AugurMoon` desenha as cinco fases, e a ficha de Vampiro (sem `glyph`) não mostra glifo;
- os snapshots dos atributos do Vampiro e do Mago (sem `state`) não mudam.

#### Etapa 5. Rolagem e Regenerar em forma

P · depende de: 3, 4 · **linha de corte:** a ficha de Lobisomem é utilizável sem esta etapa. Se o prazo apertar, ela vira v2.1 sem mexer no resto.

**Entrega.**

- Sheet "Dados": a lista do slot Atributo mostra o valor efetivo e a origem (o core já entrega); a parada mostra "Crinos +4" entre os modificadores.
- Os atalhos Teste de Fúria e Teste de Gnose (presets da v1) usam o **permanente**, como diz o `help`.
- Regenerar no sheet da Vitalidade (a ação da Etapa 1), com a prévia e o Desfazer da v0.

**Testes.**

- Força + Briga em Crinos: o pedido à API leva só os slots e a dificuldade, e o servidor rola 9 dados (7 + 2);
- trocar de forma com o sheet Dados aberto atualiza a parada;
- Teste de Fúria monta a parada do permanente, mesmo com a Fúria atual em 0;
- Regenerar sem dano contusivo ou letal fica indisponível, com o motivo;
- E2E: rolar Força + Briga em Crinos com dificuldade 6.

**Pronto quando, Marco B.** A ficha de Lobisomem do fixture é montada, troca de forma, é rolada e curada no app e no web, offline inclusive.

### Marco C. Publicação

#### Etapa 6. Publicação e regressão com três sistemas

M · depende de: 1, 2, 3

**Objetivo.** O Lobisomem chega ao banco pelo mesmo script da v1, e nada do que já funcionava muda.

**Entrega.**

- Ordem de publicação do §5.3 da arquitetura: o template só entra em `PUBLISHED_SYSTEMS` **depois** que a versão do app com as views da forma estiver no ar. Um app antigo abriria a forma no `FieldDetail`, sem como trocar.
- `PUBLISHED_SYSTEMS = ['vtm-v20', 'mta-m20', 'wta-w20']`. O seed do E2E e o `templates:publish --published` leem a mesma lista.
- `GET /systems` devolve os três sistemas, e a criação de crônica mostra a escolha.
- Depois de publicar no ambiente de verdade, reiniciar a API. Um processo com o `sheet-core` antigo recusa um template novo com `UnsupportedTemplateError` (aconteceu na v1, com o `identity.emblem`).

**Testes** (API, PGLite):

- criar uma ficha de Lobisomem só com os campos de identidade; uma Forma ou um Dom na criação → 422;
- lote da troca com custo: grava os dois eventos e aparece no histórico como "Forma Hominídeo → Crinos, Fúria 4 → 3";
- um id de forma que não existe → 422; Fúria abaixo de 0 → 422;
- a mesa de uma crônica de Lobisomem traz Vitalidade, Fúria e Forma; as de Vampiro e Mago continuam iguais;
- as Notas do Narrador do Lobisomem seguem a mesma remoção (a matriz de AuthZ roda com os três templates);
- uma ficha de cada sistema na mesma conta, em crônicas diferentes, sem cruzar cache no app;
- E2E: o narrador cria uma crônica de cada sistema, e cada uma abre o formulário do seu.

#### Etapa 7. Jornada do Lobisomem e fechamento da v2

M · depende de: todas

**Entrega.**

- `e2e/tests/journey-werewolf.spec.ts`: a jornada inteira do §1, num único cenário, em Chromium e WebKit.
- `journey.spec.ts` e `journey-mage.spec.ts` rodam junto, sem mudança.
- Maestro: um fluxo novo, `06-werewolf-form`: abrir a ficha, trocar para Crinos com a mudança instantânea, conferir a Força 7 e Desfazer.
- Documentação:
  - `arquitetura-motor-de-ficha.md` §10.3: o Lobisomem entra como produto, e a família WoD fica completa (`clock`, `cap` e `state`);
  - o README do template: `state` e `tempUncapped` marcados como consumidos pelo app; `glyph` também;
  - `CLAUDE.md`: as contagens de testes por pacote e a terceira jornada do E2E.
- O checklist de segurança da v0 revisto para o Lobisomem. A v2 não cria superfície nova, e o checklist registra isso item a item.

**Pronto quando.** As três jornadas passam no CI, e crônicas dos três sistemas funcionam lado a lado no app e no web.

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Publicar o template com um erro e ficar preso a ele (versão imutável) | A publicação é a Etapa 6, depois de o app usar o template por fixture nas etapas 3 a 5 |
| A troca de forma re-renderizar a ficha inteira (todos os atributos dependem do `state`) | A contagem de render da Etapa 3; o `resolve` memoizado por campo, só os modificados mudam de referência |
| O jogador confundir valor efetivo com valor gravado no Editar | O Editar edita sempre a base e mostra o efetivo como aviso (Etapa 4) |
| O código "aprender" o Garou ao fazer as formas | `StateChoice` no `@tms/ui` sem template; `planState` no core; o `check-system-names.mjs` com os ids de opção; o fixture mínimo de `state` |
| Quebrar o Vampiro ou o Mago | As duas jornadas intocadas em todo PR; os snapshots dos atributos sem `state` sem edição |
| API em execução com o core antigo depois da publicação | Reiniciar a API no roteiro de deploy (Etapa 6) |

---

## 7. Decisões em aberto

| # | Decisão | Proposta | Precisa antes da etapa |
|---|---|---|---|
| 1 | A forma padrão depende da raça (Impuro nasce em Crinos, Lupino em Lupino)? | Não na v2. O padrão é a primeira opção (Hominídeo), e o jogador troca em Jogo. Seria um `default` derivado de um `choice`, uma chave nova no contrato | 1 |
| 2 | O servidor exige a Fúria na mudança instantânea? | Não, como o `wod-stacking` e a roda do Mago: o servidor valida forma e limites, e o custo é a conveniência do cliente. A mudança lenta, sem custo, é legal pelas regras | 2 |
| 3 | Mudar de forma pede teste de Gnose ou de Vigor (W20: dificuldade pela forma de origem)? | Não. A troca lenta não pede teste na mesa da maioria, e o narrador pode pedir uma rolagem livre. Um teste automático exigiria uma ação de template nova | 3 |
| 4 | Penalidades de forma que não são atributo (dificuldade de Manipulação em Crinos, Delírio, sem fala em Lupino) | Ficam na `note` da opção, como texto. Um modificador de dificuldade seria um `op` novo no `state`, para outra versão | 1 |
| 5 | Regenerar em combate gasta ação, e o agravado cura 1 por dia | A ação cura 1 nível contusivo ou letal sem custo; o agravado é curado no sheet da Vitalidade, à mão, como na v0 | 1 |
| 6 | Posto derivado do Renome permanente | Não. O Posto continua um `rating` que o jogador sobe em Editar. A tabela de Renome por augúrio seria uma derivação com nome de sistema | 1 |
| 7 | Gastar Fúria por ações extras e o frenesi | Fora. A Fúria se gasta no sheet do recurso (`spend1`), e o frenesi é o Teste de Fúria com a dificuldade informada | 5 |
| 8 | Fetiches: `list` próprio ou só o antecedente | `list` próprio com Nível e Gnose (Etapa 1). Ativar um fetiche é um teste de Gnose com a dificuldade informada, sem preset novo | 1 |

---

## 8. Fora da v2

- Dificuldade de forma, Delírio e restrições de forma com regra (§7, decisão 4).
- Forma padrão pela raça (§7, decisão 1) e Posto derivado do Renome (decisão 6).
- Catálogo de Dons e de Ritos (textos protegidos).
- Fúria por ações extras, frenesi com regra e a Umbra (Gnose para atravessar, Penumbra).
- Parentes, Fera Interior e Méritos e Defeitos com regra. Na v2, ficam nas notas.
- Criação com orçamento de pontos, que vale para os três sistemas ao mesmo tempo.
- Migração de fichas entre versões do template.
- Tempo real e as ferramentas novas do narrador.
- A próxima família (D&D 5e, §10.3 da arquitetura).
