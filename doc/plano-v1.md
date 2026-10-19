# Plano de implementação da v1: ficha de Mago

> Plano · 2026-10-19 · base: `feat/ficha-ajustes-layout` em `f514520` (v0 completa, `vtm-v20` 1.1.0)

Este plano leva a v0 até uma **ficha de Mago: A Ascensão (M20) utilizável**, com o mesmo motor e sem uma linha de código que saiba o nome do Mago fora do core e do template.

| Documento | Responde |
|---|---|
| [`arquitetura-motor-de-ficha.md`](arquitetura-motor-de-ficha.md) | **Por que** e **como** o motor funciona |
| [`../design/templates/README.md`](../design/templates/README.md) | **O que** o template pode dizer |
| [`plano-v0.md`](plano-v0.md) | Como a v0 foi construída; as regras de teste do §4 continuam valendo |
| este documento | **Em que ordem** construir o Mago, e **como provar** que cada passo funciona |

Como usar: o mesmo da v0. Cada etapa é um PR, só termina com os testes verdes no CI, e uma etapa que muda o contrato atualiza as duas camadas (`schema.json` e `validate.mjs`) e o README do template no mesmo PR.

**Por que o Mago agora.** O CLAUDE.md promete que um sistema novo não exige migração. Até aqui, só o Vampiro prova isso no produto. O §10.3 da arquitetura diz que o M20 reaproveita a skin `wod` e pede só `clock` e `cap`. Se aparecer algo fora disso, é um defeito do motor, e é mais barato achá-lo agora, com um sistema só em produção.

---

## 1. Onde queremos chegar

A v1 está pronta quando esta jornada roda inteira no app e no web, e um teste E2E a repete no CI:

1. O narrador cria uma crônica e escolhe **Mago (M20)** entre os sistemas publicados.
2. O jogador entra com o convite e cria a ficha: nome, conceito, tradição, essência, casa, natureza e comportamento. O formulário sai do template.
3. A ficha abre em **Editar**: atributos, habilidades, Arete, Esferas, afinidade, antecedentes (Avatar, Nodo), Foco (paradigma, prática e instrumentos) e rotinas. Salvar grava **um** lote.
4. Uma Esfera acima do Arete é aceita e aparece como **inativa**. Baixar o Arete não apaga ponto nenhum.
5. Em **Jogo**, o dock mostra Vitalidade, a roda de Quintessência e Paradoxo e FdV. O jogador ganha Quintessência, ganha Paradoxo com a roda cheia (consome 1 de Quintessência, com aviso e Desfazer) e leva dano. Tudo funciona offline.
6. O narrador vê a mesa com a roda de cada mago e lê no histórico "Paradoxo 2 → 3".
7. O jogador rola **Conjurar efeito**: a parada de Arete, com a dificuldade informada. **Este passo é a linha de corte** (Etapa 6).
8. A jornada do Vampiro da v0 (`journey.spec.ts`) continua verde, sem mudança.

O que fica fora está no §8.

---

## 2. Ponto de partida

O `mta-m20` existe desde o protótipo e já passa nas duas camadas de validação. Boa parte do motor já o atende sem saber dele:

| Área | Hoje | O que falta para a v1 |
|---|---|---|
| Template | `design/templates/mta-m20.json` 1.0.0: válido no Ajv e no `validateTemplate`, compila no core, **nunca publicado** | `identity.columns` e `groupTabs` (vieram no `vtm-v20` 1.1.0), rotinas, revisão dos rótulos |
| Core: `cap` | `resolve` devolve `value`, `cap` e `inactive`; o `short` e o `describe` do `rating` falam do inativo | nada |
| Core: `clock` | tipo, valor, `validateSheet` (soma até `segments`), `resolve` (`fills`, `used`, `free`), `short` e `describe` | a regra `mage-quint-paradox` (está só no `REGISTRY` e na validação do template) e o rótulo do histórico (`labels.ts` cai em "alterado") |
| Core: rolagem | `pool-success` monta a parada do Mago (teste "multi-sistema" em `pool-success.test.ts`) | `roll.presets` é validado, mas nenhum código o consome |
| App | `GenericRow`, `GenericChip` e `FieldDetail` desenham a roda; a linha de `rating` já mostra o inativo | view de `clock`, aviso de teto no editor de `rating` (`NumberEditorRow` só olha `def.max`), `badge` de seção (afinidade), presets no sheet de dados |
| API | nenhuma rota tem nome de sistema; a publicação aceita qualquer template | nada de código; publicar o template |
| Crônicas | `chronicles/new.tsx` escolhe sozinho quando há um sistema e mostra a escolha quando há mais | nada |
| Dados de teste | 1 ficha de Mago em `exemplos/personagens.json` (`tomas`) | uma ficha nova e uma no limite da regra (roda cheia, Esfera inativa) |
| E2E | o `global-setup.ts` publica só o `vtm-v20` | publicar os dois; a jornada do Mago |

Nada no banco muda: o Mago é **dado**. Uma migration nesta v1 é sinal de defeito, e o PR que a trouxer precisa explicar por quê.

---

## 3. Mapa das etapas

| # | Etapa | Trilha | Depende de | Tamanho |
|---|---|---|---|---|
| 1 | Template `mta-m20` pronto para publicar | template | – | P |
| 2 | Core: regra `mage-quint-paradox` e rótulos da roda | core | – | M |
| 3 | Core: presets da rolagem | core | – | P |
| 4 | `Clock` e as views da roda | ui, app | 2 | G |
| 5 | Teto não destrutivo e afinidade no Editar | app | 1 | M |
| 6 | Rolagem de magia | app | 3, 5 | M |
| 7 | Publicação e regressão multi-sistema | API, E2E | 1, 2, 4 | M |
| 8 | Jornada do Mago e fechamento da v1 | todas | todas | M |

**Trilhas paralelas.** As etapas 1, 2 e 3 não dependem umas das outras e podem sair juntas, em worktrees, como as etapas 17 a 22 da v0. O caminho crítico é **2 → 4 → 7 → 8**: a roda é o único componente novo de verdade.

**Marcos.**

| Marco | Etapas | O que dá para mostrar |
|---|---|---|
| A. Contrato e core | 1–3 | Nada visível, tudo testado: template final, regra da roda e presets |
| B. Ficha no app | 4–6 | A ficha de Mago montada, jogada e rolada no app, com o template ainda vindo de fixture |
| C. Publicação | 7–8 | Uma crônica de Mago de verdade, ao lado das de Vampiro, e as duas jornadas no E2E |

---

## 4. Estratégia de testes

As camadas, as ferramentas e as metas de cobertura são as da v0 (§4 do `plano-v0.md`). O que muda:

- **Dois sistemas no produto, um no fixture.** O Vampiro passa a ser o teste anti-acoplamento do Mago, e vice-versa. O D&D continua como fixture nas etapas que tocam o renderizador (4, 5 e 7), para pegar um código que "aprendeu" o WoD inteiro.
- **Nenhum `if (system === ...)`.** Um teste de lint (ou um `grep` no CI) falha se `mta-m20`, `mage` ou `wheel` aparecer em `apps/` ou `packages/ui/` fora de `__tests__/`. O nome da regra (`mage-quint-paradox`) só pode aparecer no `sheet-core`.
- **Fichas no limite.** `exemplos/personagens.json` ganha duas fichas de Mago (Etapa 1): uma recém-criada, com os padrões, e uma com a roda cheia, uma Esfera acima do Arete e a Vitalidade ferida. Elas servem ao core, à API, ao app e ao E2E.
- **A matriz de AuthZ não muda.** A v1 não cria rota. Se uma etapa precisar de rota nova, ela entra na matriz como na v0.
- **Regressão do Vampiro.** O `journey.spec.ts` da v0 roda em todo PR, sem edição. Um PR da v1 que precise mexer nele é um sinal de acoplamento.

---

## 5. Etapas

### Marco A. Contrato e core

#### Etapa 1. Template `mta-m20` pronto para publicar

P · depende de: nada

**Objetivo.** Fechar o template antes de publicar, porque versão publicada é imutável (Etapa 6 da v0). Como a 1.0.0 nunca foi publicada, os ajustes entram nela mesma.

**Entrega** (`design/templates/mta-m20.json`):

- `identity.columns`, como no `vtm-v20` 1.1.0: `[["name"], ["nature", "demeanor", "concept"], ["tradition", "essence", "house"]]`. A criação segue essa ordem.
- `groupTabs: true` em Atributos e Habilidades, como no Vampiro.
- Rotinas: um campo `rotes` do tipo `list`, com `itemLabel: "Rotina"` e `item: { notes: true }`, sem `value` e **sem catálogo**. Os nomes e efeitos das rotinas do livro são protegidos (§12 do contrato). Entra numa seção nova da zona `powers`.
- Revisão dos rótulos com a terminologia do M20 em português: Esferas, Arete, Paradigma, Prática, Instrumentos e as Tradições.
- `exemplos/personagens.json`: as duas fichas novas do §4.
- `node design/scripts/build.mjs` em dia (job `design` do CI).

**Testes.**

- o template passa no Ajv e no `validateTemplate`, e compila;
- as 3 fichas de Mago passam no `validateSheet`;
- `identityFields` do Mago tem os 7 campos de identidade, na ordem das colunas;
- uma ficha com `rotes` sem `notes` declarado no item é rejeitada (a regra de chaves do `list` vale para o Mago também).

**Pronto quando.** O template não precisa mais mudar para a jornada do §1.

#### Etapa 2. Core: regra `mage-quint-paradox` e rótulos da roda

M · depende de: nada

**Objetivo.** A regra da roda como função pura, no mesmo molde do `wod-stacking`: a view só chama e mostra o resultado.

**Entrega** (`packages/sheet-core/src/`):

- `rules/mage-quint-paradox.ts`, com a regra do contrato (§3, `clock`):
  - `gain(field, value, fillId, n)` e `lose(field, value, fillId, n)`;
  - ganhar Paradoxo com a roda cheia consome 1 de Quintessência por casa;
  - ganhar Quintessência com a roda cheia é bloqueado;
  - com a roda toda de Paradoxo, ganhar mais é bloqueado;
  - devolve o valor novo, se mudou e as notas para o toast ("1 Quintessência virou Paradoxo", "a roda está cheia").
- A regra resolvida por nome, com `Object.hasOwn`, num mapa `CLOCK_RULES` com `satisfies Record<ClockRule, ClockRuleImpl>`. Um nome novo na lista fechada sem implementação quebra o build.
- `labels.ts`: o caso `clock` no `describeEvent`, com um trecho por preenchimento que mudou: "Quintessência 6 → 5, Paradoxo 2 → 3". O mesmo texto serve ao toast, ao resumo e ao histórico.
- `effects.ts`: nada muda. A roda não tem ação de template na v1.

**Testes.**

- tabela da regra: ganhar e perder com a roda vazia, parcial e cheia, e cada bloqueio;
- propriedades com `fast-check`, sobre valores válidos gerados a partir do campo:
  - a soma nunca passa de `segments`, e nenhum preenchimento fica negativo;
  - todo resultado passa no `validateSheet`;
  - `applyBatch(invert(b))` devolve a roda original;
- `describeEvent` da roda, inclusive com o valor ainda no padrão (o "de" efetivo do `withEffectiveFrom`);
- a regra não aparece em nenhum template que não seja o do Mago, mas funciona com qualquer `clock` que declare `rule: "mage-quint-paradox"` (fixture mínimo no teste).

**Nota.** Como na v0, o servidor valida a forma e a soma (`validateSheet`), não a regra. Um lote que põe Paradoxo sem consumir Quintessência, com a roda sem espaço, é recusado pela soma; um lote com a roda livre é aceito. Ver §7, decisão 5.

#### Etapa 3. Core: presets da rolagem

P · depende de: nada

**Objetivo.** `roll.presets` deixa de ser só validado e passa a montar a parada.

**Entrega.**

- `rollers/pool-success.ts`:
  - `poolPresets(model, resolved, roles)`: os presets do template, cada um com os slots já resolvidos e o texto de ajuda;
  - um preset cujo slot cita um campo sem leitura para o papel fica indisponível, e não some em silêncio;
  - `planPool` aceita `{ preset }` no pedido, e preenche os slots a partir dele. Os slots que o preset não fixa continuam escolhíveis, e um slot `optional` pode ficar vazio.
- `POST /characters/:id/rolls` aceita o id do preset. O servidor resolve o preset a partir do **seu** modelo, como já faz com os slots. O cliente continua sem mandar resultado nem valor.

**Testes.**

- o preset "Conjurar efeito" do Mago monta a parada de Arete, com o slot de Habilidade vazio;
- uma Esfera inativa entra na parada pelo valor efetivo (o teto), não pelo valor gravado;
- o preset de um template sem presets, ou com um id que não existe → erro de forma;
- API: o resultado de um preset é rolado no servidor, e um `slots` enviado junto com o preset não sobrepõe o que o preset fixa.

### Marco B. Ficha no app

#### Etapa 4. `Clock` e as views da roda

G · depende de: 2 · referência visual: `design/design-system/components.md#clock`

**Objetivo.** A roda ganha componente rico nas mesmas variantes do `resource` e do `track`, sem saber que é do Mago.

**Entrega.**

- `@tms/ui`: o primitivo `Clock`, com a API do design system (`segments` de 2 a 24, `fills` com `from: 'start' | 'end'`, `colorRole`, `size`):
  - SVG com `react-native-svg`, que o app já usa nos pips;
  - casas em arco com intervalo, preenchimento cheio no `accent` e hachura nos `alt-*`;
  - `role="img"` com o rótulo acessível vindo de fora. Os números ficam fora do miolo.
- `apps/frontend/sheet/views/clock/`:
  - `ClockRow`: roda pequena e a legenda ("Quintessência 6 · Paradoxo 2 · 12 livres");
  - `ClockChip`: mini roda no dock e na mesa;
  - `ClockSheet`: roda grande e um `Stepper` por preenchimento ("6 de 20 casas"). Cada passo chama a regra do core; um bloqueio desabilita o botão e mostra o motivo; as notas da regra vão para o toast com Desfazer.
- `baseViews.clock` passa a ter `row`, `chip` e `sheet`. Um `clock` sem `rule` conhecida pelo core abre o `FieldDetail`, como hoje.
- Háptico: seleção no stepper e um padrão mais forte quando o Paradoxo consome Quintessência.

**Testes** (Jest + RNTL):

- o `Clock` anuncia "Quintessência 6, Paradoxo 2, de 20 casas" e fica fora da árvore de acessibilidade, que é dos Steppers;
- Paradoxo +1 com a roda cheia → um lote com Quintessência −1 e Paradoxo +1, e o toast com Desfazer;
- Quintessência +1 com a roda cheia: botão desabilitado e o motivo anunciado;
- em Leitura e em Editar, a roda não ganha stepper (`editableIn: ["play"]`);
- a matriz skin × tipo × variante da v0 inclui as três views novas;
- **contagem de render:** mexer na roda não re-renderiza a Vitalidade nem a FdV;
- o dock do fixture de D&D continua igual (o D&D não tem `clock`).

#### Etapa 5. Teto não destrutivo e afinidade no Editar

M · depende de: 1

**Objetivo.** O jogador entende o `cap` sem ler a regra: vê o teto, pode passar dele e sabe o que acontece.

**Entrega.**

- `NumberEditorRow` de `rating` com `cap`:
  - mostra o teto com o rótulo do template ("máx. pelo Arete 3");
  - o stepper deixa passar do teto até o `max` do campo, e a linha avisa "Forças 4: 1 inativo enquanto o Arete for 3";
  - o leitor de tela ouve o mesmo aviso.
- Baixar o campo que é teto de outros (o Arete) mostra, no resumo do Concluir, quais campos ficam com pontos inativos. A informação vem do `resolve` da ficha rascunho, não de código do Mago.
- `badge` de seção no `GroupsLayout` (contrato §6): a linha cujo id é o valor do `choice` citado ganha o selo ("Afinidade"). Funciona em `groups` e `list`, como o contrato diz.
- Editor de `list` sem `value` (as rotinas): nome e notas, sem stepper.

**Testes.**

- Arete 3 e Forças de 3 para 4 → o lote grava 4, a linha mostra "1 inativo" e a parada usa 3;
- Arete de 3 para 2 → o resumo lista as Esferas que ficam inativas, e nenhum valor de Esfera muda no lote;
- trocar a afinidade move o selo;
- a lista de rotinas adiciona, edita as notas e remove com confirmação;
- o editor de `rating` sem `cap` (todos os do Vampiro) não muda: o snapshot do teste do Editar da v0 continua igual.

#### Etapa 6. Rolagem de magia

M · depende de: 3, 5 · **linha de corte:** a ficha de Mago é utilizável sem esta etapa. Se o prazo apertar, ela vira v1.1 sem mexer no resto.

**Entrega.**

- Sheet "Dados":
  - os presets do template viram atalhos no topo ("Conjurar efeito"); tocar preenche os slots;
  - o `help` do preset aparece embaixo da dificuldade ("3 + Esfera mais alta, coincidente; 4 +, vulgar");
  - a dificuldade continua manual, entre o `min` e o `max` do template;
  - Esferas na lista do slot Atributo, com o valor efetivo e a marca de inativo.
- Depois de rolar, um atalho "Anotar Paradoxo" abre o sheet da roda. O app não decide quanto Paradoxo a magia gerou (§7, decisão 3).

**Testes.**

- o atalho "Conjurar efeito" monta a parada de Arete, e o pedido à API leva só o id do preset e a dificuldade;
- uma Esfera inativa aparece com o valor efetivo e a marca;
- o Vampiro, que não tem presets, não mostra a área de atalhos;
- E2E: rolar "Conjurar efeito" com dificuldade 7.

**Pronto quando, Marco B.** A ficha de Mago do fixture é montada, jogada e rolada no app e no web, offline inclusive.

### Marco C. Publicação

#### Etapa 7. Publicação e regressão multi-sistema

M · depende de: 1, 2, 4

**Objetivo.** O Mago chega ao banco pelo mesmo script da v0, e nada do que já funcionava muda.

**Entrega.**

- Ordem de publicação do §5.3 da arquitetura: o template só é publicado **depois** que a versão do app com a view da roda e a regra do core estiver no ar. Um app antigo abriria a roda no `FieldDetail`, mas sem a regra.
- `pnpm templates:publish design/templates/mta-m20.json` grava a 1.0.0 num banco limpo.
- `e2e/global-setup.ts` publica os dois templates.
- Uma lista dos templates publicáveis (`design/templates/published.json`, ou equivalente) que o seed do E2E e o roteiro de deploy leem. O CI confere que todo template da lista passa no Ajv, compila e tem ao menos uma ficha de exemplo.
- `GET /systems` devolve os dois sistemas, e a criação de crônica mostra a escolha.

**Testes** (API, PGLite):

- criar uma ficha de Mago só com os campos de identidade; uma Esfera na criação → 422;
- lote na roda: grava e aparece no histórico como "Quintessência 6 → 5, Paradoxo 2 → 3";
- lote que passa da soma das casas → 422;
- a mesa de uma crônica de Mago traz a roda nos campos do `dock`; a de Vampiro continua igual;
- as Notas do Narrador do Mago seguem a mesma remoção do Vampiro (a matriz de AuthZ roda com os dois templates);
- uma ficha de Vampiro e uma de Mago na mesma conta, em crônicas diferentes, sem cruzar cache no app (o modelo é memoizado por `system@version`);
- E2E: o narrador cria uma crônica de Mago e outra de Vampiro, e cada uma abre o formulário do seu sistema.

#### Etapa 8. Jornada do Mago e fechamento da v1

M · depende de: todas

**Entrega.**

- `e2e/tests/journey-mage.spec.ts`: a jornada inteira do §1, num único cenário, em Chromium e WebKit.
- `journey.spec.ts` da v0 roda junto, sem mudança.
- Maestro: um fluxo novo, abrir a ficha de Mago, Paradoxo +1 com a roda cheia e Desfazer.
- Documentação:
  - `arquitetura-motor-de-ficha.md` §10: o Mago sai de "depois da v0" e entra como produto; a tabela de tipos da v0 ganha `clock` e `cap`;
  - o README do template: o `clock` e os presets marcados como consumidos pelo app;
  - `CLAUDE.md`: as contagens de testes por pacote.
- O checklist de segurança da v0 revisto para o Mago. A v1 não cria superfície nova, e o checklist registra isso item a item.

**Pronto quando.** As duas jornadas passam no CI, e uma crônica de Mago e uma de Vampiro funcionam lado a lado no app e no web.

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Publicar o template com um erro e ficar preso a ele (versão imutável) | A publicação é a Etapa 7, depois de o app usar o template por fixture nas etapas 4 a 6 |
| O SVG da roda se comportar diferente no web e no nativo | `Clock` na vitrine do design system nos dois temas; E2E no web em todo PR; Maestro no nativo |
| O código "aprender" o Mago ao fazer a roda | `Clock` em `@tms/ui` sem template; a regra só no core; o `grep` do §4 no CI |
| Quebrar o Vampiro | `journey.spec.ts` intocado em todo PR; os testes do Editar e do Jogo da v0 sem edição |
| A regra do Mago virar autoridade só no cliente | Decisão 5 do §7, escrita antes da Etapa 2 |

---

## 7. Decisões em aberto

| # | Decisão | Proposta | Precisa antes da etapa |
|---|---|---|---|
| 1 | Dificuldade automática da magia (3 + Esfera mais alta, coincidente; 4 +, vulgar) | **Fora da v1.** Exige uma chave nova no preset (por exemplo `difficulty: { rule: "mage-magick" }`) e uma escolha de Esferas que o sheet de dados não tem. Na v1, o `help` do preset explica a conta | 6 |
| 2 | Gastar Quintessência para baixar a dificuldade (−1 por ponto, até −3) | **Fora da v1, junto com a 1.** Exige um boost que paga de um preenchimento de `clock` e um `boostEffect` novo (`difficultyMinus1`). Hoje o boost só paga de um `resource` | 6 |
| 3 | O Paradoxo de uma magia vulgar entra sozinho? | Não. O jogador ou o narrador anota na roda, com o atalho "Anotar Paradoxo" depois da rolagem. A conta depende de testemunhas e do narrador | 6 |
| 4 | Rotinas: `list` ou texto livre | `list` com `notes`, sem catálogo (Etapa 1). Dá para buscar e editar uma a uma, e nenhum texto protegido entra no template | 1 |
| 5 | O servidor aplica a regra da roda? | Não, como o `wod-stacking` na v0: o servidor valida forma e soma, e a regra é a conveniência do cliente. Um cliente adulterado só consegue gravar uma roda válida em forma, na ficha que já pode editar | 2 |
| 6 | A Quintessência inicial vem do Avatar? | Não na v1. Seria uma derivação nova com nome de sistema. O jogador marca na roda ao montar a ficha | 1 |
| 7 | Tecnocracia, Nephandi e Desvairados | Fora. A Tradição tem as nove e Órfão. Outra facção é outra lista de opções, e entra numa versão nova do template, sem código | – |

---

## 8. Fora da v1

- Lobisomem (W20) e o tipo `state` (Formas). É o próximo da mesma família (§10.3 da arquitetura).
- A dificuldade automática da magia e a Quintessência como boost (§7, decisões 1 e 2).
- Ressonância, Sinais do Paradoxo, Quietude, Maravilhas, Familiar e Méritos e Defeitos com regra. Na v1, ficam nas notas.
- Catálogo de rotinas.
- Criação com orçamento de pontos (§11 da arquitetura), que vale para os dois sistemas ao mesmo tempo.
- Migração de fichas entre versões do template.
- Tempo real e as ferramentas novas do narrador.
