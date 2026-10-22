# Contrato de template

Este documento formaliza o contrato entre o app TMS e os templates de sistema de RPG: o JSON guardado em `trait_templates.template_data` e o `sheet_data` dos personagens que ele valida.

| Arquivo | Papel |
|---|---|
| `schema.json` | JSON Schema (draft 2020-12) da **forma** do template. Fail secure: propriedade desconhecida é rejeitada. |
| `../scripts/validate.mjs` | `REGISTRY` (listas fechadas), `validateTemplate` (integridade referencial e paleta) e `validateSheet` (valores da ficha). É a especificação executável das regras de segurança. |
| `*.json` | Templates de referência: `vtm-v20`, `mta-m20`, `wta-w20`, `dnd5e-2014`, `coc7e`, `fate-core`. |
| `exemplos/personagens.json` | Personagens fictícios no formato de `sheet_data`. |
| `../telas/prototipo.js` | Renderizador único: mostra como cada propriedade é interpretada. |

As duas camadas de validação se completam e rodam juntas, no cliente (conveniência) e no servidor (autoridade):

- **`schema.json`** checa a forma: tipos, faixas, listas fechadas, texto seguro, propriedades permitidas **por `type`** e por `roll.model`, e combinações proibidas (ex.: `layout: facts` com `groups`, `boost` que o modelo de rolagem ignora).
- **`validateTemplate`** checa o que JSON Schema não expressa: o campo citado existe, o `accent-N` está na paleta validada, a opção de `accent.map` existe no campo de origem, `cap` aponta para `rating` ou `number`, os campos do `dock` são jogáveis, campos de seção com leitura restrita não aparecem em `identity` nem no `dock`, as seções de `roll.slots[].from` existem, os marcadores de `chipFormat` são campos.

O servidor roda **os dois**: algumas regras existem só em um deles (§11). As listas fechadas (`enum`) de `schema.json` são **as mesmas** do `REGISTRY` e os limites numéricos são os mesmos de `validate.mjs`. Uma não muda sem a outra (§9). Onde o schema é mais estrito (propriedades por tipo, texto em uma linha, regras de zona e layout), ele reflete o que o renderizador de fato interpreta.

---

## 1. Princípio

> **O código conhece tipos genéricos; o template conhece o sistema.**

Um sistema novo é **uma linha em `game_systems` + uma linha em `trait_templates`**, sem migration e sem tela nova. O app tem um único renderizador de ficha, uma única casca de parada de dados e um único validador; Vampiro, Mago, Lobisomem, D&D 5e, Call of Cthulhu e Fate usam as mesmas funções.

Só um **tipo**, uma **regra** ou um **modelo de rolagem** inéditos exigem código. Quando isso acontece, o nome novo entra na lista fechada e passa a servir todos os sistemas (§9).

Isso segue o modelo de dados do repositório: a estrutura da ficha vem de `trait_templates.template_data` (jsonb) e os valores ficam em `characters.sheet_data` (jsonb). Nenhuma coluna conhece WoD.

**Multi-sistema:** o teste de aceitação da arquitetura é ter D&D 5e (SRD 5.1) na mesma fase do primeiro template WoD. Se um sistema exigir uma tela própria, a arquitetura falhou.

---

## 2. Estrutura do template

| Propriedade | Obrigatória | Tipo | Descrição |
|---|---|---|---|
| `schema` | sim | `1` | Versão do contrato. Mudança incompatível cria a versão 2 e um schema novo. |
| `system` | sim | kebab-case | Código do sistema com a edição (`vtm-v20`, `dnd5e-2014`). Corresponde a `game_systems.code`. |
| `name` | sim | texto | Nome exibido ("Vampiro: A Máscara — Edição de 20º Aniversário"). |
| `family` | sim | kebab-case | Família (`wod`, `d20`, `brp`, `fate`): `game_systems.family`. |
| `edition` | sim | texto (40) | Edição exibida no filtro por sistema ("V20", "5e 2014"). |
| `templateVersion` | sim | semver | Sobe a cada publicação. |
| `locale` | sim | `pt-BR` | Idioma dos rótulos. |
| `skin` | sim | lista fechada | Fonte display, voz e forma do pip (`wod`, `dnd`, `coc`, `fate`). |
| `license` | sim | texto (1000) | O que o template embute e sob qual licença (§12). |
| `identity` | sim | objeto | Nome, selo, resumo, voz e subtítulo (§5). |
| `accent` | sim | objeto | Cor de identidade por `accent-N` (§5). |
| `ladders` | não | objeto | Escadas nomeadas (Fate: `+3` = "Bom"). |
| `markStates` | não | objeto | Conjuntos de estados para `mark` (D&D: sem proficiência, proficiente, especialista). |
| `fields` | sim | objeto | Catálogo de campos indexado por id. O id é a chave em `sheet_data.values` (§3). |
| `sections` | sim | lista | Seções por zona, em ordem (§4). |
| `zoneLabels` | não | objeto | Rótulo das abas por zona (`build`, `powers`, `lore`), até 14 caracteres (§4). |
| `statusLabels` | não | objeto | Rótulo do estado `dead` da ficha (`{ "dead": "Torpor" }`), até 20 caracteres. Sem ele, "Fora de jogo". |
| `alerts` | não | lista (até 10) | Quando uma linha da Mesa merece atenção (§6). |
| `dock` | sim | lista (1–3) | Recursos do dock e da mesa do narrador (§6). |
| `roll` | sim | objeto | Parada de dados (§7). |
| `actions` | não | lista | Ações nomeadas com prévia (§8). |

Ids (de campo, seção, opção, estado, linha, tipo de dano) seguem `^[a-zA-Z][a-zA-Z0-9-]*$`, com até 64 caracteres. Nomes herdados de `Object.prototype` (`constructor`, `toString`, `valueOf`...) são proibidos.

Todo texto exibido é **texto seguro**: sem `<`, `>`, controles C0 e C1 (U+0000 a U+001F, U+007F a U+009F), separadores U+2028 e U+2029 nem controles bidirecionais (U+202A a U+202E, U+2066 a U+2069). O schema também proíbe tab e quebra de linha (todo texto de template é de uma linha); `isSafeText` de `validate.mjs` aceita os dois. Limites: rótulo 200, `shortLabel` 16, `help` 400, `roll.label` e `target.label` 24, `suffix` 24, `chipFormat` 60, item de catálogo 80, `license` 1000. `validateTemplate` também limita qualquer string do template a 1000 caracteres, o aninhamento a 12 níveis e proíbe as chaves `__proto__`, `constructor` e `prototype` em qualquer profundidade.

Não coloque `$schema` dentro do template: o topo é fechado (`additionalProperties: false`). Para ter autocompletar no editor, associe `schema.json` aos arquivos pela configuração do editor.

**Multi-sistema:** nada no topo é específico de um jogo. `family` agrupa edições (V20 e V5 são sistemas diferentes da família `wod`) e `license` registra o que cada editora permite.

---

## 3. Tipos de campo

Propriedades comuns a todos os tipos: `type`, `label` (obrigatórios), `shortLabel`, `sublabel` (linha secundária, ex.: "Des"), `help` e `editableIn`.

`editableIn` diz em quais modos o campo muda: `play` (modo Jogo) e `edit` (modo Evoluir). Padrão: `text` e `longText` em ambos; os demais só em Evoluir. Recursos de jogo declaram `["play"]`. O modo é UX: o servidor valida cada escrita (§11).

O `editableIn` também classifica cada mudança para a política de escrita (doc/plano-v3.md, Etapa 4). Em `rating`, `number`, `percent`, `mark`, `tags` e `list`, o que muda com `["play"]` é **jogo** (a Inspiração e o Ouro do D&D, as Condições, a quantidade do inventário); sem ele, é **evolução** (Atributo, Posto, nível), que depois da criação só o narrador grava. Na dúvida, evolução. Declare `["play"]` onde o jogo gasta ou marca o valor; o permanente de um `resource` e o `value` de um item de lista são sempre evolução.

| `type` | `display` | Valor em `sheet_data.values` | Componente | WoD | D&D 5e | CoC 7e | Fate |
|---|---|---|---|---|---|---|---|
| `rating` | – | inteiro `min..max` (até 10) | `RatingDots` | Atributos, Habilidades, Esferas, Posto | Inspiração (0–1) | – | – |
| `number` | `plain`, `score+mod`, `signed`, `ladder` | inteiro `min..max` (padrão ±1.000.000); `readOnly` nunca é guardado | `NumberField` | Geração | atributo `15 (+2)`, CA, iniciativa, PO | Idade | perícias `+3 Bom`, Recarga |
| `percent` | `percent`, `percent+half+fifth` | inteiro `0..max` (padrão 99); ausente vale a base | `PercentField` | – | – | características e perícias `60 · 30 · 12` | – |
| `resource` | – | `{ current, permanent?, temp?, max? }` | `Resource` | Sangue, Força de Vontade, Fúria, Gnose, Renome | PV (+temp), dados de vida | PV, PM, Sanidade, Sorte | Pontos de Destino |
| `track` | – | `wod-stacking`: `{ <tipo>: contagem }`; `boxes`: `{ <linha>: [bool, ...] }` | `LeveledTrack` / `Track` | Vitalidade `/ X ✱` | testes contra a morte | – | Estresse (caixas 1/2/3) |
| `slots` | – | `{ "<nível>": { max, used } }` | `Track` por nível | – | espaços de magia | – | – |
| `clock` | – | `{ <preenchimento>: casas }` | `Clock` | roda Quintessência/Paradoxo | – | – | – |
| `state` | – | id da opção | `Choice` + chip | Formas do Garou | (Fúria do Bárbaro) | – | – |
| `mark` | – | id do estado em `markStates` | `MarkToggle` | – | proficiência e especialização | – | – |
| `text` | – | texto até `maxLength` (padrão 200) | `TextField` / `TextAspect` | Natureza, Senhor | traço de personalidade | Ocupação | Conceito e Dificuldade (`aspect`) |
| `longText` | – | texto até `maxLength` (padrão 4000) | `NotesEditor` | Notas, Notas do Narrador | Ideais, Vínculos | Pessoas significativas | Notas |
| `choice` | – | id da opção | `Choice` | Clã, Tradição, Tribo, Augúrio | Raça, Classe | – | – |
| `tags` | – | lista de ids de opção | `Tags` | – | Condições | Condições | – |
| `list` | – | lista (até 200) de itens | `Repeater` | Disciplinas, Antecedentes, Dons | ataques, magias, inventário | armas, equipamento | aspectos, consequências, façanhas |

### `rating`

- `min` (padrão 0) e `max` (obrigatório no schema, até 10). Acima de 5, os pips ficam menores. Sem valor na ficha, vale `default` (se declarado) ou `min`.
- `default` aceita um inteiro ou uma **fórmula de valor inicial** (abaixo): Humanidade = Consciência + Autocontrole.
- `cap: { field, label }`: teto **não destrutivo** vindo de um `rating` ou `number` (Esferas ≤ Arete). Baixar o teto não apaga pontos: o excedente fica "inativo" e volta a valer quando o teto sobe. O servidor aceita valor acima do teto.
- `valueLabels`: nome por valor (`{ "2": "Fostern" }`), exibido junto do número.
- `specialty: true`: aceita especialização em `sheet_data.specialties[id]` (até 80 caracteres). Vale também para `number` e `percent`, que o editor de Evoluir trata igual.
- Modificadores de `state` alteram o valor efetivo; a UI mostra o efetivo e a origem ("3 + 4 Crinos", "Crinos: 0"), sem passar de `max` pips. O Editar edita sempre a base e avisa o efetivo (v2).

### `number`

- `display`: `plain` (padrão), `score+mod` (valor e modificador, exige `derive`), `signed` (`+2`) ou `ladder` (exige `ladder`, id em `ladders`).
- `min` e `max`: o servidor limita o valor por eles; sem eles, por ±1.000.000. Declare sempre que o sistema tiver faixa.
- `default`: valor de uma ficha nova, quando difere do mínimo. Os atributos de D&D usam `default: 10`: sem isso, uma ficha nova mostraria −5 em tudo (valor 1).
- `derive`: com `score+mod`, calcula o modificador a partir do próprio valor (`abilityModifier`).
- `readOnly: true` + `derive` + `from`: valor só calculado (bônus de proficiência a partir de `level`, iniciativa a partir de `dex`). Nunca é guardado: o servidor rejeita qualquer valor enviado para ele. Não aceita `min`, `max` nem `specialty`.
- `from` aceita, no lugar de um campo, um item de lista pelo nome: `{ "list": "backgrounds", "item": "Geração" }` lê os pontos desse item (0 se a ficha não tem o item). O item precisa estar no `catalog` da lista. É assim que a Geração da V20 sai do antecedente (`vtmGeneration`: 13 menos os pontos, até a 8ª).
- `suffix` (" anos", "ª geração"), `badge: { field, label, glyph }` (selo na grade quando o `mark` citado não está no primeiro estado) e `allowInput`.

### `percent`

- `display: percent+half+fifth` mostra regular, difícil (½) e extremo (⅕), os três números usados na rolagem.
- `base`: número fixo de 0 a 100 (Contabilidade 5), outro campo (`{ "field": "edu" }`) ou derivação (`{ "derive": "half", "from": "dex" }`). Sem valor na ficha, vale a base. O filtro `aboveBase` mostra só perícias acima da base.
- `max` (padrão 99, até 100).

### `resource`

Valor: `{ current, permanent?, temp?, max? }`, com `current` de 0 a 9999. Precisa de `permanent` ou `max` (sem teto, o valor só teria o limite técnico). O servidor rejeita `permanent`, `temp` ou `max` em recurso que não os declara, e `max` só é gravado quando é `stored`.

| Propriedade | Efeito | Exemplo |
|---|---|---|
| `permanent: { min, max, default? }` | Valor permanente guardado em `permanent`. Limita o atual e só muda em Evoluir. `default` é o permanente de uma ficha nova: inteiro ou fórmula (abaixo); sem ele, `min`. | Força de Vontade 5/7; FdV = Coragem; Fúria pelo Augúrio |
| `temp: true` | Pontos temporários em `temp`. | PV temporários de D&D |
| `rule: tempFirst` | Dano consome primeiro os temporários. | PV 27 + 5 |
| `tempUncapped: true` | O atual não é limitado pelo permanente. Exige `permanent`. A UI mostra "Permanente 3 · Temporário 4". Sem valor na ficha, o atual começa em 0 (não há "cheio"). | Glória, Honra, Sabedoria (W20) |
| `overMax: true` | O atual pode passar do máximo. Exige `max`. | Pontos de Destino acima da recarga |
| `max: <número>` | Máximo fixo (até 9999). | Sorte 99 |
| `max: { derive, from }` | Máximo derivado. | Sangue por Geração; PV de CoC por CON + TAM |
| `max: { field }` | Máximo lido de outro campo. | dados de vida = nível; Destino = Recarga |
| `max: { stored: true, min, max }` | Máximo guardado na ficha (`max`), editável em Evoluir. | PV máximo de D&D |
| `perTurn: { derive, from }` | Gasto máximo por turno, exibido como nota. | Sangue por turno |
| `atZero: deathSaves` | Em 0, aviso de testes contra a morte. Exige `rule`. | PV de D&D |
| `actions` | Ações com custo no recurso (§8). | Curar 1 nível por 1 Sangue |
| `colorRole`, `defaultAction`, `allowInput` | Papel de cor, toque longo no dock, digitação. | Fúria `accent`, Gnose `alt-warm` |
| `spendLabel`, `gainLabel` | Verbo das ações rápidas −1/+1 (padrão "Gastar 1" e "Recuperar 1"). O verbo é do sistema, não do app. | Sanidade e PV do CoC: "Perder 1" |

Com máximo até 20, o recurso aparece como caixas; acima disso, como barra com stepper.

Sem valor na ficha, o atual começa cheio (no permanente ou no máximo), exceto com `tempUncapped`, que começa em 0.

### Fórmula de valor inicial (`default`)

Valores que o livro calcula a partir de outros traços (Humanidade, Força de Vontade, Fúria, Quintessência) não são gravados na criação: a criação só pede a identidade, e Virtudes e Antecedentes vêm depois, em Editar. Por isso o `default` é um **valor de leitura**: enquanto o campo não tem valor gravado, ele vale a fórmula e acompanha as fontes. Quando o jogador grava o campo, o valor dele vale e a fórmula para de valer.

Aceito em `rating.default`, `resource.permanent.default` e `clock.fills[].default`. `number.default` continua só inteiro.

| Forma | Efeito | Exemplo |
|---|---|---|
| inteiro | Valor fixo | FdV inicial do Mago: `5` |
| `{ derive, from }` | Uma derivação da lista fechada (§9), com as mesmas fontes de `from` (campo ou item de lista) | `{ "derive": "sum", "from": ["conscience", "selfControl"] }` |
| `{ from, map }` | Valor por opção de um `choice`. Opção sem entrada, ou `choice` vazio, vale o mínimo | `{ "from": "auspice", "map": { "ahroun": 5 } }` |

```json
"humanity": { "type": "rating", "label": "Humanidade", "min": 0, "max": 10,
  "default": { "derive": "sum", "from": ["conscience", "selfControl"] } },
"rage": { "type": "resource", "label": "Fúria",
  "permanent": { "min": 1, "max": 10,
    "default": { "from": "auspice", "map": { "ragabash": 1, "theurge": 2, "philodox": 3, "galliard": 4, "ahroun": 5 } } } },
"wheel": { "type": "clock", "fills": [
  { "id": "quintessence", "label": "Quintessência", "colorRole": "accent", "from": "start",
    "default": { "derive": "sum", "from": [{ "list": "backgrounds", "item": "Avatar" }] } } ] }
```

Regras:

- O resultado fica sempre em `min..max` do destino (na roda, nas casas que sobram).
- `validateTemplate` confere que as fontes existem (item de lista no catálogo), que o `from` do mapa é um `choice`, que as chaves do mapa são opções dele e que os valores cabem no destino. Um ciclo pelo `default` é recusado no compile.
- Um recurso é gravado inteiro (`current` e `permanent` juntos): o primeiro gasto em Jogo fixa o permanente calculado.
- A roda é gravada inteira: o primeiro passo parte do padrão calculado.
- Nunca é expressão: só as duas formas fechadas acima.

### `track`

- `rule: wod-stacking` (Vitalidade):
  - `levels`: níveis na ordem em que enchem, cada um com `penalty` (inteiro de −10 a 0, ou `null` para incapacitado).
  - `types`: tipos de dano **em ordem de gravidade, do mais grave para o menos grave** (agravado, letal, contusivo). O dano mais grave ocupa as primeiras caixas. Com a trilha cheia, o dano novo substitui uma caixa menos grave do que ele, e o contusivo excedente conta como letal. A regra nunca cria dano mais grave que o recebido: contusivo numa trilha cheia de letal não vira agravado, e o app avisa que a trilha não mudou. Curar remove do tipo escolhido.
  - Valor: `{ "aggravated": 0, "lethal": 1, "bashing": 1 }`, com soma até o número de níveis. A penalidade do nível atual reduz a parada quando `roll.penalty.field` aponta para esta trilha.
- `rule: boxes` (testes contra a morte, Estresse):
  - `rows: [{ id, label, boxes, boxValues? }]`. `boxValues` dá o valor de cada caixa (Estresse do Fate: 1, 2, 3) e deve ter o tamanho de `boxes`.
  - Valor: `{ "physical": [false, true, false], "mental": [false, false] }`.
  - `rest.long` zera as caixas.

### `clock`

- `segments` (2 a 24) e `fills` (até 2 preenchimentos: `{ id, label, colorRole, from: start | end, default? }`). `default` são as casas de uma roda nunca gravada: inteiro ou fórmula (§3, `resource`). Cada preenchimento tem amostra própria (cheia ou hachurada): forma e cor, nunca só cor.
- `rule` é obrigatória. Hoje só existe `mage-quint-paradox`: Quintessência e Paradoxo dividem as casas; ganhar Paradoxo com a roda cheia consome 1 Quintessência; ganhar Quintessência com a roda cheia é bloqueado. Exige um preenchimento `start` e um `end`.
- Valor: `{ "quintessence": 6, "paradox": 2 }`, com soma até `segments`.
- No app (v1): a regra roda no cliente, no `planClock` do core; o servidor confere só a forma e a soma, como no `wod-stacking`. Um nome de regra sem implementação deixa a roda sem Stepper ("Esta versão do app não conhece a regra desta roda").

### `state`

- `options: [{ id, label, hint?, note?, modifiers? }]` (2 a 20). A primeira opção é o padrão.
- `modifiers: [{ field, op, value }]`: `add` soma (o resultado nunca fica abaixo de 0) e `set` fixa o valor. O valor efetivo aparece na grade e na parada, com a origem.
- `cost: { resource, amount, optional, label }`: custo opcional da troca (gastar 1 Fúria para mudança instantânea).
- Valor: id da opção (`"crinos"`).
- No app (v2): a linha e o sheet da Forma. O sheet lista as opções com os valores efetivos de cada uma (`statePreview` do core) e, com `cost`, a alternância do custo; a troca e o gasto saem num lote só (`planState`). Sem recurso, a alternância fica desabilitada com o motivo. O servidor confere a opção e os limites do recurso, não o custo: a troca sem pagar também é legal.

### `mark`

- `states`: id de um conjunto em `markStates`. Cada estado: `{ id, label, glyph?, multiplier? }`, de 2 a 3 estados. O primeiro é o padrão e deve ter id `none` (o filtro `proficient` e o `badge` de `number` comparam com `none`).
- `bonus: { derive, ability }`: bônus derivado do atributo-chave e do multiplicador (`dnd5eCheckBonus` = modificador + proficiência × multiplicador).
- Valor: id do estado (`"proficient"`).

### `text` e `longText`

- `maxLength` (até 20000) é o limite que o servidor aplica; sem ele, 200 em `text` e 4000 em `longText`. Declare sempre.
- `text` com `aspect: true` é um aspecto do Fate: texto de primeira classe, exibido como bloco no topo da zona de jogo.
- `placeholder`: extensão documentada (texto de exemplo no campo vazio), ainda não consumida pelo protótipo.
- Notas (`longText`) nunca vão para logs (§11).

### `choice` e `tags`

- `choice.options: [{ id, label, meta?, glyphParam? }]`. `glyph: augur-moon` desenha a fase da lua a partir de `glyphParam` (0 a 1), no fato do campo (v2).
- `tags.options: [{ id, label, roll? }]`. `roll: advantage | disadvantage` muda a rolagem `sum-vs-target` quando `roll.conditions.field` aponta para estas tags.
- Valor: `choice` guarda o id; `tags` guarda a lista de ids.

### `slots`

- `levels` (1 a 9), `levelLabel` com o marcador `{n}` (`"{n}º"`), `reset` (`longRest` ou `shortRest`) e `defaultAction: use1`.
- Valor: `{ "1": { "max": 4, "used": 0 }, "2": { "max": 3, "used": 1 } }`, com nível de 1 a `levels`, `max` de 0 a 9 e `used` até `max`.

### `list`

- `itemLabel` (singular) e `item` são obrigatórios. Componentes de cada item:

| `item.` | Valor no item | Exemplo |
|---|---|---|
| (sempre) | `id` (até 40, único na lista), `name` (até 80) | `{ "id": "d1", "name": "Taumaturgia" }` |
| `value: { type: rating, min, max }` | `value` (inteiro, até 10) | Disciplina 3 |
| `meta: [{ id, type: number \| text, label, display?, min?, max? }]` | `meta: { <id>: valor }`: número dentro de `min..max`, texto até 80 | Ataque `+7`, Dano `2d10 fogo`; Posto e Origem de um Dom |
| `notes: true` | `notes` (até 2000) | rituais preparados |
| `specialty: true` | `specialty` (até 80) | Trilha do Sangue |
| `aspect: true` | `text` (até 200) | aspecto do Fate |

- O servidor rejeita no item qualquer chave não declarada: `notes` sem `item.notes`, `value` sem `item.value`, chave de `meta` que não está em `item.meta`.
- `fixed: [{ id, label, meta? }]`: itens fixos, sem adicionar nem remover. Cada um guarda `{ id, text }` (consequências Suave, Moderada e Grave do Fate) e o `id` precisa ser um dos fixos. O rótulo vem do template e não é gravado. Atenção: aqui `meta` é texto ("absorve 2"), diferente de `item.meta`.
- Item fixo também guarda o que `item` declara (`value`, `meta`, `notes`). É assim que a Ressonância do Mago fica como na ficha de papel: três linhas sempre presentes, cada uma com pontos e um descritor livre no `text`.

```json
"resonance": { "type": "list", "label": "Ressonância", "itemLabel": "Descritor",
  "item": { "value": { "type": "rating", "min": 0, "max": 5 } },
  "fixed": [{ "id": "dynamic", "label": "Dinâmica" }, { "id": "entropic", "label": "Entrópica" }, { "id": "static", "label": "Estática" }] }
```

Valor: `[{ "id": "dynamic", "text": "Ardente", "value": 2 }]`.
- `catalog`: sugestões ao adicionar. **Só nomes**: descrições protegidas não entram no template (§12).
- Itens com `value` numérico ou `meta.bonus` numérico viram opções da parada quando a seção está em `roll.slots[].from`.
- Extensões documentadas, fora do `REGISTRY` e ainda não consumidas pelo protótipo: `searchable` e `density` (dicas visuais) e `rollAs` (`ability` ou `attack`).

**Multi-sistema:** os 14 tipos cobrem os seis sistemas de referência sem nenhum tipo exclusivo. Aparição e Changeling cabem em `track` (Corpus, Vitalidade quimérica) e `resource` (Pathos, Glamour); PbtA cabe em `number signed`, `track boxes` e `list` (§13).

---

## 4. Seções, zonas, layouts, filtros e permissões

### Zonas

A ordem das zonas é **fixa no app**; o template escolhe só a zona de cada seção e a ordem dentro dela.

| Zona | Onde aparece | Layouts |
|---|---|---|
| `identity` | cartão de identidade sob o header | só `facts` |
| `play` | dock (celular) e coluna "Em jogo" (≥ 600 px); no DOM, vem antes do corpo | só `fields` |
| `build` | aba **Ficha**: traços permanentes (atributos, perícias) | `grid`, `groups`, `list`, `pyramid`, `facts`, `text` |
| `powers` | aba **Poderes**: poderes, magias, equipamento de combate | idem |
| `lore` | aba **Sobre**: história, notas, inventário | idem |

**Abas.** A ficha tem 3 abas fixas, uma por zona: `build`, `powers` e `lore`. A escolha está no estudo [`../estudos/navegacao-da-ficha.md`](../estudos/navegacao-da-ficha.md).

- O template não configura abas. A zona de cada seção já decide em que aba ela aparece.
- O template pode trocar só o rótulo, com `zoneLabels` (até 14 caracteres, para as 3 abas caberem a 360 dp com fonte grande).
- Aba sem seção legível para quem vê some.

```json
"zoneLabels": { "powers": "Vantagens" }
```

| Sistema | `zoneLabels` | Abas |
|---|---|---|
| Vampiro, Mago, Lobisomem | `{ "powers": "Vantagens" }` | Ficha · Vantagens · Sobre |
| D&D 5e | `{ "lore": "Itens e notas" }` | Ficha · Poderes · Itens e notas |
| CoC 7e | `{ "powers": "Equipamento", "lore": "Histórico" }` | Ficha · Equipamento · Histórico |
| Fate | `{ "powers": "Façanhas" }` | Ficha · Façanhas · Sobre |

**Multi-sistema:** um sistema novo ganha a navegação pronta. Para ter abas boas, basta pôr cada seção na zona certa.

### Layouts

| `layout` | Usa | Para quê | Exemplo |
|---|---|---|---|
| `grid` | `fields` **ou** `groups`; `columns` (1 a 6, padrão 3) | grade de células com valor grande | Atributos WoD em 3 grupos; atributos D&D em 3 colunas; características CoC em 2 |
| `groups` | `fields` **ou** `groups`; `minColWidth` (px) | linhas agrupadas com título | Habilidades WoD; Esferas; Combate D&D |
| `list` | `fields` | linhas simples | perícias D&D e CoC; salvaguardas |
| `pyramid` | `fields` (`number` com `ladder`) | perícias agrupadas por degrau da escada | perícias do Fate |
| `fields` | `fields` | itens de jogo (só na zona `play`) | Vitalidade, Sangue, FdV |
| `facts` | `fields` | lista de termos e valores | Identidade; Foco do Mago |
| `text` | `fields` (`text`, `longText`) | blocos de texto; o campo `identity.voice` vira citação | Sobre; Notas do Narrador |

Regras checadas por `schema.json`: `fields` e `groups` são mutuamente exclusivos; `facts`, `text`, `list`, `pyramid` e `fields` exigem `fields`; `identity` só usa `facts`; `play` só usa `fields`, e `fields` só existe em `play`.

### Filtros e busca

- `filter: { rule, label, default }` em `groups`, `list` e `pyramid`:
  - `invested`: `rating` com base acima de 0 (antes de modificadores) e `number` acima de 0.
  - `proficient`: `mark` fora do estado `none`.
  - `aboveBase`: `percent` acima da base.
- Com `default: true`, a seção abre filtrada e mostra "Mostrando N de M · Mostrar todos". O filtro é desligado em Evoluir: é ali que se compra o primeiro ponto.
- `searchable: true` mostra busca por rótulo, sem diferenciar acentos, em `groups`, `list` e `pyramid`.
- `groupTabs: true` (em `grid` e `groups`, com `groups`): no Editar do celular, os grupos viram abas e só um aparece por vez (Físicos, Sociais, Mentais), porque a linha com Stepper não cabe numa coluna. Em Jogo e Leitura, a grade 3×3 aparece inteira; numa seção com filtro, o filtro ligado mostra chips "Nome N" de todos os grupos, e desligado (todos os traços) volta às abas. Com busca, o resultado vem de todos os grupos. Em telas largas, a grade continua em colunas.

### Badge e pinTop

- `badge: { field, label }` na seção marca a linha cujo id é o valor de um `choice` (Esfera de afinidade do Mago). Só em `groups` e `list`. Não confundir com `badge` de `number` (§3). O campo do `choice` precisa estar numa seção para ser editável (no Mago, no grupo do Arete).
- `pinTop: true` fixa a seção no topo da zona `play` como blocos de texto (aspectos do Fate). Só em `play`.
- `collapsed: true`: extensão documentada (seção começa recolhida), aceita pelo validador e ainda não consumida pelo protótipo.

### Permissões por seção

```json
{ "id": "storyteller", "zone": "lore", "title": "Narrador", "layout": "text",
  "fields": ["storytellerNotes"], "permissions": { "read": ["storyteller"], "write": ["storyteller"] } }
```

- Papéis: `owner` (dono da ficha) e `storyteller` (narrador da crônica). Outro jogador da crônica não tem papel na ficha: não a lê nem a escreve (o servidor responde 404).
- Sem `permissions`: dono e narrador leem e escrevem.
- `read` restrito: o **servidor** remove os campos da seção antes de responder a quem não pode ler (§11). Esconder na UI não basta. Por isso esses campos não podem aparecer em `identity` (header, cartões, mesa) nem no `dock`: `validateTemplate` rejeita.
- `write` restrito: o servidor rejeita a escrita de quem não está na lista.

**Multi-sistema:** a mesma seção "Narrador" serve a "Mestre" (D&D), "Guardião" (CoC) e "MC" (PbtA), só com outro `title`. Uma seção "Sombra" da Aparição, legível só pelo jogador que faz a Sombra, exigiria um papel novo na lista fechada (§9).

---

## 5. Identidade e accent

```json
{
  "identity": { "name": "name", "chip": "class", "chipFormat": "{class} nv {level}",
                "summary": ["race", "subclass", "background"], "voice": "personality" },
  "accent": { "from": "class", "map": { "mago": "accent-8", "bardo": "accent-10" }, "fallback": "accent-neutral" }
}
```

| Propriedade | Efeito |
|---|---|
| `identity.name` | Campo do nome (header, cartões, histórico). |
| `identity.chip` | Selo de identidade ao lado do nome (Clã, Classe, Ocupação). |
| `identity.columns` | Colunas do cabeçalho como na ficha impressa (até 3, com até 6 campos). No Editar, o cabeçalho vira essas colunas; na criação, a ordem dos campos segue elas. Os campos não podem ser de seção restrita. |
| `identity.chipFormat` | Formato do selo com marcadores `{campo}` ("Mago nv 5"). Os marcadores viram texto puro; os campos precisam existir. |
| `identity.summary` | Até 4 campos no resumo sob o nome. |
| `identity.voice` | Campo exibido como citação, na fonte de voz da skin. |
| `identity.subtitle` | Campo acima do resumo (nome de feito do Garou). |
| `identity.emblem` | Símbolo da criatura no lugar das iniciais do personagem, o mesmo para qualquer clã, tribo ou tradição: `ankh` (Vampiro), `nine-star` (Mago: as Nove Esferas e as Nove Tradições), `claws` (Lobisomem). O app desenha o símbolo; sem emblema, as iniciais. |
| `accent.from` | Campo `choice` que define a cor (clã, tradição, tribo, classe, playbook). `null` = sem accent. |
| `accent.map` | Opção → `accent-N`. Cada valor precisa estar na paleta validada (`design-system/tokens.json`, hoje `accent-1` a `accent-16`), checada para contraste e daltonismo no CI. |
| `accent.fallback` | `accent-neutral` (ou um `accent-N`) para opção sem mapa (Caitiff, Órfão). |

Regras:

- O template **nunca** traz cor livre: `#ff0000`, `rgb()` ou nome de cor são rejeitados (`^accent-(neutral|[1-9][0-9]?)$`).
- Sem accent (`from: null`), `map` precisa estar vazio. Fora da ficha, o app usa `accent-neutral`.
- A cor nunca identifica a linhagem sozinha: nome e iniciais sempre acompanham.

**Multi-sistema:** o design system não conhece clãs, tribos nem classes: só a paleta `accent-N`. CoC e Fate não têm linhagem e usam `accent-neutral`; um playbook de PbtA é só mais um `accent.map`.

---

## 6. Dock e zona de jogo

- `dock`: 1 a 3 campos de tipo jogável (`resource`, `track`, `slots`, `clock`, `state`, `number`, `list`, `tags`, `rating`), nunca de seção com leitura restrita (o dock aparece na mesa para todos). No celular, o dock fica no rodapé com um chip por campo e o botão de dados; na mesa do narrador, cada personagem mostra os mesmos itens.
- O chip mantém a forma do recurso (mini trilha, caixas, amostras da roda), não só o número.
- Toque abre o sheet do campo; **toque longo** aplica `defaultAction` (`spend1`, `gain1` e `damage1` em `resource`; `use1` em `slots`) com aviso e Desfazer.
- "Todos os recursos" lista os campos das seções da zona `play`. A partir de 600 px, a coluna "Em jogo" mostra esses campos e o botão de dados.
- Campos da zona `play` costumam declarar `editableIn: ["play"]`; os demais mudam em Evoluir, com resumo "N alterações" antes de salvar.

**Multi-sistema:** Vampiro usa Vitalidade, Sangue e FdV; D&D usa PV, CA e espaços; CoC usa PV, Sanidade e Sorte; Fate usa Estresse, Destino e Consequências. A moldura é a mesma.

**Alertas da Mesa.** `alerts` diz quando a linha de um personagem na Mesa do narrador merece atenção; o painel só pinta o selo, com o `label` como nome acessível. Cada alerta é `{ id, label, rule, field }` mais o parâmetro da regra, de uma lista fechada (`REGISTRY.alertRules`), nunca expressão:

| `rule` | Campo | Parâmetro | Ativo quando |
|---|---|---|---|
| `track-at-level` | `track` | `level` (inteiro ≥ 1) | a trilha está marcada até o nível `level` (Incapacitado é o último nível do WoD) |
| `resource-at-most` | `resource` | `value` (inteiro ≥ 0) | o atual está em `value` ou menos (FdV zerada é `value: 0`) |
| `resource-below-share` | `resource` | `share` (entre 0 e 1) | o atual está abaixo da fração do máximo (PV do D&D abaixo da metade é `share: 0.5`) |

Um alerta sobre campo que o papel não lê não existe para ele. `label` até 40 caracteres.

---

## 7. Rolagem

A casca é única: seleção por slots, modificadores com origem, total, "Rolar no app" e "Rolei na mão". A mecânica vem de `roll.model`, uma função da lista fechada (`ROLLERS`).

| `model` | Dados | Parâmetros | Boosts | Sistemas |
|---|---|---|---|---|
| `pool-success` | N × d`die` (padrão d10); sucesso ≥ dificuldade; cada 1 anula um sucesso | `difficulty` (obrigatório), `die`, `penalty`, `specialty` | `autoSuccess` | WoD |
| `sum-vs-target` | `1d20` + modificador contra o alvo | `target` (obrigatório), `dice: "1d20"`, `advantage`, `conditions` | – | D&D 5e |
| `roll-under-percent` | d100 contra o valor: regular, difícil (½), extremo (⅕), crítico e desastre | `bonusDice` (obrigatório), `dice: "1d100"` | – | CoC 7e |
| `fudge` | `4dF` + perícia contra a oposição, nomeado pela escada | `ladder` e `target` (obrigatórios), `dice: "4dF"` | `plus2` | Fate |
| `pbta-2d6` | 2d6 + stat: 10+ pleno, 7–9 com custo, 6− falha | `dice: "2d6"` | – | PbtA |

`die` vem da lista `REGISTRY.dice` (2, 3, 4, 6, 8, 10, 12, 20, 100) e `dice` da lista `REGISTRY.diceNotation` (`1d20`, `2d6`, `1d100`, `4dF`). `dice` é descritivo: cada roller fixa os próprios dados, então o schema só aceita a notação do modelo.

- `slots: [{ id, label, from, optional? }]` (1 a 3): `from` lista as seções de onde vêm as opções. Valem `rating`, `number` (exceto `plain`), `percent`, `mark` com bônus, `resource` (permanente ou atual) e itens de `list` com valor. Seções sem permissão de leitura ficam de fora.
- `difficulty: { default, min, max }` (1 a 100) e `target: { label, default, min, max }` (−10 a 100): o jogador ajusta antes de rolar.
- `penalty: { field }`: trilha `wod-stacking` cuja penalidade reduz a parada; "Incapacitado" bloqueia a rolagem.
- `specialty: tenCountsDouble`: com especialização, cada 10 vale dois sucessos. Exige d10 (`die` ausente ou 10).
- `boosts: [{ id, label, resource, cost, effect }]` (`cost` de 0 a 10): gasto opcional que é debitado ao rolar. Só os efeitos que o modelo aplica são aceitos (`autoSuccess` em `pool-success`, `plus2` em `fudge`), para nunca debitar um recurso sem efeito.
- `presets: [{ id, label, slots, help? }]`: atalhos ("Teste de Sanidade", "Conjurar efeito"). O campo de cada slot precisa estar numa das seções do `from` do slot (v2: as duas camadas recusam). O atalho fixa os slots que declara; o pedido de rolagem leva só o id dele, e o servidor monta a parada (v1). O `help` aparece embaixo da dificuldade.
- `conditions: { field }`: tags com `roll` dão vantagem ou desvantagem automática em `sum-vs-target`.
- `bonusDice: { min, max }` (−3 a 3): dados de bônus e penalidade do CoC.
- `ladder`: escada usada no resultado do `fudge`.

**Regra de segurança da rolagem:**

- Rolagem que **vale para a mesa** é feita **no servidor** e registrada com resultado, autor e horário. O cliente nunca envia o resultado de uma rolagem "do app".
- Rolagem local (ensaio, jogo sem servidor) usa `crypto.getRandomValues` com amostragem por rejeição (sem viés de módulo). Nunca `Math.random`. Sem `crypto`, a rolagem é bloqueada (fail secure).
- "Rolei na mão" é primeira classe: o resultado entra marcado como "(na mão)".

**Multi-sistema:** cinco mecânicas cobrem os seis sistemas de referência e PbtA. Um sistema com mecânica nova (Year Zero, Cortex) precisa de um `roll.model` novo (§9), não de uma tela nova.

---

## 8. Ações (effects)

Ações aparecem no menu ⋯ da ficha (`actions`, no topo do template) ou no sheet de um recurso (`fields.<id>.actions`, com `cost`). O app sempre mostra a **prévia** (campo: de → para) antes de aplicar; a aplicação é um lote atômico de eventos (§10) com Desfazer.

| `effect` | `params` | Efeito | Exemplo |
|---|---|---|---|
| `health.heal` | `field` (track), `types` | Cura 1 nível, procurando dano do último para o primeiro tipo de `types` (com `["bashing", "lethal"]`, cura letal antes de contusivo; agravado fica de fora), e paga `cost` do recurso. No menu da ficha (`actions` do topo), não tem custo | Curar 1 nível por 1 Sangue; Regenerar (Lobisomem) |
| `resource.spend` | `field`, `amount` | Debita `amount` do recurso (mínimo 0) | Despertar: −1 Sangue |
| `resource.gain` | `field`, `amount` | Credita `amount` respeitando o teto | Recuperar Força de Vontade |
| `rest.long` | – | Recursos com `tempFirst` ao máximo e sem temporários; recursos com `max.field` recuperam metade; `slots` zerados; `track boxes` zeradas | Descanso longo D&D |
| `rest.short` | – | Permite gastar dados de vida para recuperar PV | Descanso curto D&D |

`schema.json` exige os parâmetros certos por efeito: `field` e `amount` para `resource.*`, `field` e `types` para `health.heal`, nenhum para `rest.*`. No protótipo, a prévia está implementada para `resource.spend` e `rest.long`, e `health.heal` funciona como ação de recurso; os demais mostram só o texto de ajuda.

**Multi-sistema:** "descanso" e "nova noite" são o mesmo mecanismo (lote de alterações com prévia). Um efeito de outro sistema, como "fim de sessão" do Fate (Destino volta à Recarga), é um nome novo na lista (§9).

---

## 9. Listas fechadas

Tudo o que o template referencia por nome vem de uma lista registrada no código (`REGISTRY` em `validate.mjs`). `schema.json` repete as mesmas listas em `$defs`.

| `REGISTRY` | `$defs` | Valores |
|---|---|---|
| `fieldTypes` | `fieldType` | `rating`, `number`, `percent`, `resource`, `track`, `slots`, `clock`, `state`, `mark`, `text`, `longText`, `choice`, `tags`, `list` |
| `numberDisplays` | `numberDisplay` | `plain`, `score+mod`, `signed`, `ladder` |
| `percentDisplays` | `percentDisplay` | `percent`, `percent+half+fifth` |
| `derive` | `deriveName` | `abilityModifier`, `proficiencyBonus`, `dnd5eCheckBonus`, `vtmBloodPool`, `vtmBloodPerTurn`, `vtmGeneration`, `cocHitPoints`, `cocMagicPoints`, `cocSanityMax`, `half`, `fifth`, `difference`, `sum` |
| `trackRules` | `trackRule` | `wod-stacking`, `boxes` |
| `resourceRules` | `resourceRule` | `tempFirst` |
| `clockRules` | `clockRule` | `mage-quint-paradox` |
| `alertRules` | `alertRule` | `track-at-level`, `resource-at-most`, `resource-below-share` |
| `atZero` | `atZero` | `deathSaves` |
| `effects` | `effect` | `health.heal`, `resource.spend`, `resource.gain`, `rest.long`, `rest.short` |
| `rollModels` | `rollModel` | `pool-success`, `sum-vs-target`, `roll-under-percent`, `fudge`, `pbta-2d6` |
| `dice` | `die` | `2`, `3`, `4`, `6`, `8`, `10`, `12`, `20`, `100` |
| `diceNotation` | `diceNotation` | `1d20`, `2d6`, `1d100`, `4dF` |
| `boostEffects` | `boostEffect` | `autoSuccess`, `plus2` |
| `specialtyRules` | `specialtyRule` | `tenCountsDouble` |
| `colorRoles` | `colorRole` | `accent`, `alt-cool`, `alt-warm`, `neutral` |
| `zones` | `zone` | `identity`, `play`, `build`, `powers`, `lore` |
| `layouts` | `layout` | `grid`, `groups`, `list`, `pyramid`, `fields`, `facts`, `text` |
| `filterRules` | `filterRule` | `invested`, `proficient`, `aboveBase` |
| `modes` | `mode` | `play`, `edit` |
| `roles` | `role` | `owner`, `storyteller` |
| `defaultActions` | `defaultAction` | `spend1`, `gain1`, `damage1`, `use1` |
| `modifierOps` | `modifierOp` | `add`, `set` |
| `conditionRoll` | `conditionRoll` | `advantage`, `disadvantage` |
| `glyphs` | `glyphName` | `augur-moon` |
| `emblems` | `emblem` | `ankh`, `nine-star`, `claws` |
| `skins` | `skin` | `wod`, `dnd`, `coc`, `fate` |
| `slotResets` | `slotReset` | `longRest`, `shortRest` |

Derivações, com assinatura:

| Nome | Cálculo |
|---|---|
| `abilityModifier(score)` | ⌊(score − 10) / 2⌋ |
| `proficiencyBonus(level)` | 2 + ⌊(level − 1) / 4⌋ |
| `dnd5eCheckBonus(score, prof, multiplier)` | `abilityModifier(score)` + prof × multiplier |
| `vtmBloodPool(generation)` / `vtmBloodPerTurn(generation)` | tabela de Geração da V20 |
| `cocHitPoints(con, siz)` | ⌊(CON + TAM) / 10⌋ |
| `cocMagicPoints(pow)` | ⌊POD / 5⌋ |
| `cocSanityMax(mythos)` | 99 − Mitos de Cthulhu |
| `half(v)` / `fifth(v)` | ⌊v / 2⌋ / ⌊v / 5⌋ |
| `difference(a, b)` | a − b (Experiência disponível = total − gasto) |
| `sum(a, b, …)` | soma de até 4 fontes (Humanidade = Consciência + Autocontrole; com uma fonte, o próprio valor) |

### Como adicionar um nome novo

1. **Código:** implementar como função pura no registro correspondente (`DERIVE`, `RULES`, `ROLLERS` ou efeitos), no core, sem nada específico de tela.
2. **Listas:** acrescentar o nome ao `REGISTRY` de `validate.mjs` **e** ao `enum` do `$defs` correspondente em `schema.json`, com as propriedades que o nome exige (ex.: um modelo de rolagem novo ganha um `roll-<modelo>` em `$defs`).
3. **Teste:** testes unitários da função (limites, valores extremos, entrada inválida) e do validador (template que usa o nome passa; nome desconhecido continua rejeitado). Um teste deve comparar os `enum` de `schema.json` com o `REGISTRY`.
4. **Revisão:** code review com atenção a segurança (a função roda no servidor e no cliente).
5. **Publicação:** liberar a versão do app **antes** de publicar um template que use o nome. Cliente antigo que encontra nome desconhecido recusa o template (fail secure), em vez de interpretar.

**Nunca** aceitar expressão vinda do banco: nada de `eval`, `new Function`, `vm` nem string interpretada como fórmula. Se homebrew um dia exigir fórmulas, a alternativa segura é uma AST JSON com operações em lista branca e limites de profundidade e custo, com revisão própria.

**Multi-sistema:** cada nome novo serve todos os sistemas. `half` e `fifth` nasceram para CoC e valem para qualquer sistema percentual; `boxes` serve testes contra a morte, Estresse e PbtA.

---

## 10. `sheet_data` e eventos

### Formato

```json
{
  "values": {
    "name": "Helena Varga",
    "clan": "tremere",
    "intelligence": 4,
    "willpower": { "current": 5, "permanent": 7 },
    "health": { "bashing": 1, "lethal": 1, "aggravated": 0 },
    "disciplines": [{ "id": "d1", "name": "Taumaturgia", "value": 3, "specialty": "Trilha do Sangue" }]
  },
  "specialties": { "intelligence": "Memória eidética" }
}
```

- `values`: um valor por id de campo, no formato do tipo (§3). Campo ausente usa o padrão do tipo (`min`, base, primeira opção).
- `specialties`: texto (até 80) por id de campo com `specialty: true`; para outros campos, rejeitado.
- **Campo desconhecido é rejeitado** (a busca usa `Object.hasOwn`, então `__proto__` e `constructor` não passam), assim como chave de topo diferente de `values` e `specialties` e chave desconhecida dentro de um valor.
- Campos `readOnly` (derivados) nunca são guardados: o servidor rejeita o valor e recalcula na leitura.
- Valor malformado (ex.: `null` onde se espera objeto) vira erro de validação, nunca exceção.
- Limites de tamanho: `list` até 200 itens, com `id` até 40 e único; `name` até 80; `text` de item até 200; `notes` até 2000; `meta` de texto até 80; `resource.current` até 9999; `text` e `longText` até `maxLength`.

### Eventos

Toda alteração vira um evento:

```json
{ "path": "values.blood", "from": { "current": 10 }, "to": { "current": 9 }, "at": "2026-10-17T21:40:00-03:00", "by": "u-ana" }
```

- `path`: `values.<campo>` ou `specialties.<campo>`. A granularidade é o campo inteiro; não existe caminho mais profundo.
- `from`: valor anterior, usado para detectar conflito. `to`: valor novo.
- `at` e `by`: **definidos pelo servidor** a partir do relógio e da sessão autenticada. O cliente pode mandar a hora local para ordenar a fila offline, mas `by` vindo do cliente é ignorado.
- Uma ação que muda vários campos (curar com Sangue: Vitalidade e Sangue) é um **lote** aplicado de forma atômica: tudo ou nada. O lote tem um id gerado no cliente, para que o reenvio da fila seja idempotente.

Sincronização:

- **Local-first:** o cliente aplica na hora, mostra Desfazer e enfileira. Offline, a fila guarda só eventos (campo, de, para), **nunca credenciais**.
- **Validação no servidor a cada escrita:** AuthZ (§11), existência do campo no template, permissão de escrita da seção e `validateSheet` sobre a ficha resultante. Evento inválido é rejeitado com o caminho do campo, sem stack trace.
- A ficha é validada pelo template do sistema **da crônica**: `characters.system_id` precisa ser igual a `chronicles.system_id` (o `build.mjs` checa o mesmo nos exemplos).
- **Conflito:** se `from` não bate com o valor atual no servidor, o último a escrever vence e o outro lado recebe um aviso ("a narradora alterou a Vitalidade enquanto você estava offline"), com o histórico à mão.
- **Histórico:** quem, quando, de → para, por campo. Notas e textos livres aparecem só como "Notas atualizadas", sem conteúdo.

**Multi-sistema:** o formato do valor vem do tipo, não do sistema. O mesmo endpoint, a mesma fila e o mesmo validador servem Vampiro e D&D.

---

## 11. Segurança (security by design)

### Template

- O template é validado no servidor por `schema.json` (validador JSON Schema 2020-12 mantido, na versão estável mais recente, com `npm audit` no CI) **e** por `validateTemplate`, ao ser inserido ou atualizado.
- Só perfil administrativo insere ou altera templates (`trait_templates`, `game_systems`). Homebrew de usuário está fora do MVP; se entrar, passa pelo mesmo pipeline, com cota e revisão.
- Listas fechadas para tudo o que é referenciado por nome (§9). **Sem `eval`, `new Function` ou equivalente**: um template malicioso com fórmula seria RCE no servidor e XSS no web.
- Rótulos são texto: renderizados com `textContent` (web) ou `<Text>` (React Native), **nunca** com `innerHTML` ou `dangerouslySetInnerHTML`, e nunca interpolados em estilo. O padrão de texto seguro proíbe `<`, `>`, controles e controles bidirecionais (que permitiriam falsificar o texto exibido).
- Cores: só `accent-N` da paleta validada. Valores numéricos que viram variável CSS (`columns`, `minColWidth`) são inteiros com faixa e passam por `Number()`.
- Ids não podem ser nomes de `Object.prototype`; lookups usam `Object.hasOwn` (defesa contra prototype pollution).

### AuthZ por crônica (com fail secure)

| Quem | Pode |
|---|---|
| Dono da ficha (`characters.user_id`) | ler e editar a própria ficha, exceto seções com `write` restrito |
| Narrador da crônica (`chronicles.storyteller_id`) | ler e editar as fichas **daquela crônica**, assinado no histórico |
| Outro jogador da crônica | ler, se a crônica permitir, sem as seções com `read` restrito |
| Qualquer outro caso | **negado** |

- O modo da UI (Leitura, Jogo, Evoluir) **não é** controle de acesso. O middleware de AuthZ roda em todas as rotas de ficha e de eventos.
- Identidade vem da sessão autenticada (JWT com algoritmo fixado, expiração e validação de audience e issuer). O servidor resolve ficha → crônica → vínculo do usuário a partir do token; nunca confia em `ownerId`, `by` ou papel enviados pelo cliente.
- **IDOR:** testes automatizados para jogador A editando a ficha do jogador B, narrador da crônica X editando ficha da crônica Y e jogador lendo seção com `read` restrito.

### Notas do narrador

- Seções com `read` restrito (Notas do Narrador, do Mestre, do Guardião) **nunca saem do servidor** para quem não pode ler: o servidor remove os campos da resposta da ficha, da difusão de eventos em tempo real, do histórico, da exportação e da impressão.
- Esconder na interface não basta: o cliente do jogador não recebe o dado.

### Escrita e observabilidade

- **Rate limiting** no endpoint de eventos, por usuário e por ficha, e limite de tamanho do corpo da requisição.
- **Logs sem conteúdo:** registrar autor, id do campo e valores numéricos; nunca conteúdo de notas, textos livres, tokens ou dados pessoais.
- Erros devolvidos ao cliente com o caminho do campo e uma mensagem genérica, **sem stack trace**. Exceções do validador são capturadas e viram 400.
- Tokens só no armazenamento seguro do aparelho (`expo-secure-store`); a fila offline nunca guarda credenciais.

### Requisitos para o validador do servidor

`validate.mjs` é a referência executável. Ao portá-lo para o servidor (TypeScript, no Elysia), mantenha as proteções dele:

- `Object.hasOwn` e allowlist de chaves;
- rejeição de `readOnly`;
- `try/catch` por campo;
- teto do `resource` pelo máximo derivado, lido de outro campo ou gravado;
- referências cruzadas:
  - penalidade só em trilha `wod-stacking`;
  - `params.types` existentes na trilha;
  - slots dos presets existentes;
  - pirâmide só com `number` + `ladder`;
  - `boxValues` do tamanho de `boxes`;
  - primeiro estado de `markStates` igual a `none`;
  - boost compatível com o modelo de rolagem;
  - roda com um preenchimento do início e um do fim;
  - parâmetros exigidos por efeito.

Rode **também** o `schema.json` (por exemplo, com Ajv 8 `ajv/dist/2020` no CI e TypeBox no servidor). Estas regras existem só no schema:

- ids de opções de `state`, de linhas de `track`, de itens `fixed` e de `markStates` no formato de id;
- regras de zona e layout (`facts` sem `groups`, `pinTop` só em `play`, `identity` só com `facts`);
- texto de rótulo em uma linha (sem tab nem quebra). O `isSafeText` do `validate.mjs` já bloqueia `< >`, controles C0/C1, DEL, bidi e U+2028/2029, mas aceita tab e quebra de linha, porque textos de ajuda podem ter parágrafos.

**Multi-sistema:** as regras de segurança são do contrato, não do sistema. Um template novo herda AuthZ, remoção de seções privadas, validação e limites sem código adicional.

---

## 12. Licenças

O campo `license` é obrigatório e diz o que o template embute.

| Sistema | O que pode entrar no template | Observação |
|---|---|---|
| World of Darkness (V20, M20, W20) | **Só nomes** de traços e regras numéricas (níveis de Vitalidade, tabela de Geração) | Descrições de Disciplinas, Esferas, Dons e Ritos são protegidas: a mesa escreve as próprias notas. Nenhum símbolo oficial de clã, tradição ou tribo. |
| Call of Cthulhu 7e | **Só nomes** de perícias, valores-base e regras numéricas | Textos de regras e descrições são protegidos. |
| D&D 5e (SRD 5.1) | Nomes e regras do SRD 5.1 | Licença **CC BY 4.0**, da Wizards of the Coast LLC. Exige atribuição visível no app (ex.: "Sobre o sistema"), com o texto do campo `license`. Conteúdo fora do SRD não entra. |
| Fate Core | Nomes de perícias, escada e estrutura da ficha | Licença **CC BY 3.0 Unported**, da Evil Hat Productions. Exige atribuição visível, com o texto de atribuição publicado pela Evil Hat. |

- `catalog` de `list` traz só nomes, nunca descrições.
- Antes de publicar um sistema novo, confira a licença do material de origem com quem cuida da parte jurídica.

**Multi-sistema:** o contrato separa estrutura (que o template traz) de conteúdo protegido (que fica com a mesa), o que permite suportar sistemas comerciais sem redistribuir texto.

---

## 13. Passo a passo: adicionar um sistema novo (exemplo PbtA)

### 1. Identificar o sistema

- Código com edição em kebab-case (`pbta-exemplo`), `family: pbta`, `edition`, `templateVersion: 0.1.0`.
- Ler a licença do material de origem e escrever `license` (§12).

### 2. Mapear a ficha para tipos existentes

| Elemento da ficha | Tipo | Observação |
|---|---|---|
| Playbook | `choice` + `accent.map` | cor de identidade por playbook |
| Aparência | `text` | vai para a zona `identity` |
| Stats (−1 a +3) | `number` com `display: signed` | `layout: list` na zona `build` |
| Dano (6 marcas) | `track` com `rule: boxes` | um relógio de PbtA exigiria uma regra nova de `clock` |
| Experiência (5 marcas) | `track` com `rule: boxes` | |
| Movimentos | `list` com `item.notes` | só nomes; o texto é do jogador |
| Notas do MC | `longText` em seção com `permissions` | só o narrador lê e escreve |

Se algo não couber em nenhum tipo, regra ou modelo, é o caso de "adicionar um nome" (§9), não de fazer uma tela.

### 3. Escrever o template

```json
{
  "schema": 1, "system": "pbta-exemplo", "name": "PbtA (exemplo genérico)", "family": "pbta",
  "edition": "Exemplo", "templateVersion": "0.1.0", "locale": "pt-BR", "skin": "fate",
  "license": "Exemplo didático: nomes genéricos, sem texto de nenhum jogo publicado.",
  "identity": { "name": "name", "chip": "playbook", "summary": ["playbook", "look"] },
  "accent": { "from": "playbook", "map": { "lutador": "accent-2", "vidente": "accent-8" }, "fallback": "accent-neutral" },
  "fields": {
    "name": { "type": "text", "label": "Nome", "maxLength": 80 },
    "playbook": { "type": "choice", "label": "Playbook", "options": [{ "id": "lutador", "label": "Lutador" }, { "id": "vidente", "label": "Vidente" }] },
    "look": { "type": "text", "label": "Aparência", "maxLength": 120 },
    "strong": { "type": "number", "display": "signed", "label": "Força", "min": -1, "max": 3 },
    "sharp": { "type": "number", "display": "signed", "label": "Astúcia", "min": -1, "max": 3 },
    "charm": { "type": "number", "display": "signed", "label": "Charme", "min": -1, "max": 3 },
    "harm": { "type": "track", "label": "Dano", "rule": "boxes", "editableIn": ["play"], "rows": [{ "id": "harm", "label": "Dano", "boxes": 6 }] },
    "xp": { "type": "track", "label": "Experiência", "shortLabel": "XP", "rule": "boxes", "editableIn": ["play"], "rows": [{ "id": "xp", "label": "Marcas", "boxes": 5 }] },
    "moves": { "type": "list", "label": "Movimentos", "itemLabel": "Movimento", "item": { "notes": true } },
    "notes": { "type": "longText", "label": "Notas", "maxLength": 4000 },
    "storytellerNotes": { "type": "longText", "label": "Notas do MC", "maxLength": 4000 }
  },
  "sections": [
    { "id": "about-facts", "zone": "identity", "title": "Identidade", "layout": "facts", "fields": ["look"] },
    { "id": "play", "zone": "play", "title": "Em jogo", "layout": "fields", "fields": ["harm", "xp"] },
    { "id": "stats", "zone": "build", "title": "Atributos", "layout": "list", "fields": ["strong", "sharp", "charm"] },
    { "id": "moves", "zone": "powers", "title": "Movimentos", "layout": "groups", "fields": ["moves"] },
    { "id": "about", "zone": "lore", "title": "Sobre", "layout": "text", "fields": ["notes"] },
    { "id": "storyteller", "zone": "lore", "title": "MC", "layout": "text", "fields": ["storytellerNotes"],
      "permissions": { "read": ["storyteller"], "write": ["storyteller"] } }
  ],
  "dock": ["harm", "xp"],
  "roll": { "model": "pbta-2d6", "label": "Dados", "slots": [{ "id": "stat", "label": "Atributo", "from": ["stats"] }] },
  "actions": []
}
```

Este exemplo passa em `schema.json`, em `validateTemplate` e, com uma ficha de teste, em `validateSheet`. Usa a skin `fate` (sans neutra); uma skin própria é mudança no design system (`design-system/skins/pbta.json` + `REGISTRY.skins` + `enum` em `schema.json`), não no template.

### 4. Validar

1. Salvar como `design/templates/pbta-exemplo.json`.
2. Acrescentar em `exemplos/personagens.json` uma crônica com `"system": "pbta-exemplo"` e um personagem com `sheet` no formato `{ values, specialties }`.
3. Rodar na raiz do worktree:

   ```bash
   node design/scripts/build.mjs
   ```

   O script valida todos os templates (`validateTemplate`) e personagens (`validateSheet`) e sai com código 1 se algo for inválido. Ele também regenera `design-system/tokens.css`, `design-system/tokens.js` e `telas/dados.js`.
4. Validar contra `schema.json` com um validador JSON Schema 2020-12 (no CI, o mesmo passo do servidor).
5. Abrir `design/telas/ficha.html#c=<id do personagem>` e conferir a ficha nos modos Jogo, Leitura (`&as=player`, sem a seção do MC) e Evoluir (`&mode=evolve`), em 360 px e com fonte grande.

### 5. Revisar com o checklist multi-sistema

- Nenhum nome de sistema ou termo de jogo entrou no código de tela ou em token do core?
- Toda regra de jogo é um nome de lista fechada, e não uma condição no código?
- A acessibilidade (rótulo, valor, ações) é gerada pelo tipo, sem texto escrito à mão para o sistema?
- O servidor valida a escrita pelo template, sem confiar na restrição do cliente?

### 6. Publicar

Em produção, um sistema novo é **uma linha em `game_systems`** (código, família, nome) **e uma linha em `trait_templates`** (`template_data` = o JSON), inseridas por perfil administrativo pelo endpoint que aplica `schema.json` e `validateTemplate`. Sem migration e sem tela nova.

**Multi-sistema:** o exemplo PbtA reaproveita `number`, `track`, `list`, `choice` e `pbta-2d6`, que já existiam. O único ponto que pediria código, um relógio de PbtA com um preenchimento, entra uma vez como regra de `clock` e passa a servir Blades in the Dark e qualquer outro sistema com relógios.
