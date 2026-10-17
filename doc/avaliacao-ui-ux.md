# Avaliação de UI/UX: Fichas de WoD e design system "TMS Grimório"

- **Data:** 2026-10-17
- **Material avaliado:**
  - Telas, "Fichas de WoD": <https://claude.ai/artifact/3vkYUxpbVxMzWz7Vhj8uZV>. São quatro boards: Vampiro celular (390), Vampiro web (1280), Mago celular e Lobisomem celular.
  - Design system, "TMS Grimório": <https://claude.ai/artifact/W8XYzmyvQCtQqw987m3aUX>. Inclui `README.md`, `tokens.json`, `bundle.css` e 14 componentes.
- **Método:** três avaliações independentes feitas em paralelo, consolidadas neste documento.
  - **Design system:** tokens, contraste WCAG calculado por script nos dois temas, simulação de daltonismo, componentes, estados e viabilidade em React Native.
  - **Telas:** aderência ao DS, hierarquia, consistência entre sistemas, web/tablet, estados que faltam e proposta data-driven.
  - **UX no celular:** quatro personas, *cognitive walkthroughs* com contagem de toques e rolagens, medição de alvos de toque e soluções com esboços em 390px.
- **Requisito transversal:** o TMS vai suportar **vários sistemas de RPG com fichas muito diferentes**, não só WoD: D&D 5e, Call of Cthulhu, Fate/PbtA, Aparição, Changeling. Toda recomendação abaixo traz o racional multi-sistema e diz se a solução é **genérica (core)**, **de skin** (visual de um sistema) ou **de template** (dados).

**Como ler:**

| Se você quer… | Leia |
|---|---|
| O resumo | §1 |
| A arquitetura para vários sistemas | §3 |
| O que fazer, em ordem | §4, depois §8 |
| O detalhe de cada achado | Anexos A (DS), B (telas) e C (UX no celular) |

Os IDs `DS-xx`, `TL-xx` e `UX-xx` apontam para os anexos.

---

## 1. Sumário executivo

| Avaliação | Nota | Em uma frase |
|---|---|---|
| Design system | **6/10** | Identidade forte e contrastes verdadeiros, mas a camada base é WoD e faltam alvos de toque, estados e acessibilidade para implementar em RN. |
| Telas | **5,5/10** | Base visual coerente e boa modelagem de regras, mas são três telas escritas à mão, sem tokens e acopladas a WoD. |
| UX no celular | **4,5/10** | Funciona bem para **ler** a ficha e mal para **jogar**: edição acidental, recursos de combate longe do polegar e leitor de tela sem valores. |

**Veredito.** A direção visual e o conhecimento do domínio são acima da média: tema escuro certo para a mesa, cor nunca como única pista, terminologia da edição brasileira e regras modeladas (Esferas ≤ Arete, roda de Quintessência, formas do Garou). Os problemas se concentram em três frentes:

1. **Interação de jogo.** A ficha inteira é editável o tempo todo com alvos de 14px e sem desfazer. Um toque acidental ao rolar a tela corrompe a ficha em silêncio.
2. **Prioridade de informação.** A Vitalidade, que muda em todo combate, fica a 2,6–3,7 telas do topo. A barra fixa não mostra valores.
3. **Arquitetura multi-sistema.** Princípios, tokens, componentes e telas assumem WoD ("pontos são a linguagem", cor por clã, Vitalidade de 7 níveis, ordem de seções fixa). Do jeito que está, cada sistema novo exigiria tela, tokens e componentes novos, o que contradiz o objetivo do produto.

A frente 3 é a mais barata de resolver **agora**, antes de existir código em `packages/ui`, e a mais cara depois.

**Os 10 problemas mais importantes** (detalhe em §4):

| # | Problema | Sev. | Racional multi-sistema |
|---|---|---|---|
| 1 | Sem modo leitura/jogo/edição: toque acidental altera traço permanente, sem desfazer, com cascatas destrutivas (Arete → Esferas) | Crítico | Genérico: o modo vem de `editableIn` no template, não do tipo de ponto |
| 2 | Alvos de toque de 14px (pontos) e 22px (caixas), contra os 44px prometidos | Crítico | Genérico: separar visual de alvo vale para pips, slots de magia e caixas de estresse |
| 3 | Leitor de tela não anuncia o valor de nenhum traço (~169 paradas de foco por ficha) | Crítico | Genérico: um controle acessível por **tipo de valor**, com o texto gerado pelo template |
| 4 | Recursos de combate longe; barra fixa sem estado | Crítico | Dock configurado pelo template (`dock: [...]`), nunca fixo em Sangue, Fúria ou Quintessência |
| 5 | Camada base acoplada a WoD; três telas à mão; sem tokens | Crítico (arquitetura) | É o próprio achado: core + skin + dados |
| 6 | Vitalidade por ciclo de toques, sem a regra de empilhamento | Alto | Ações "+ dano / curar" genéricas; a regra (`wod-stacking`, `tempFirst`) vem do template |
| 7 | Montar a parada de dados é trabalho manual; "Rolar dados" sem fluxo | Alto | Casca única de parada; o modelo (d10 pool, d20, d100, 4dF, 2d6) vem do template |
| 8 | Sem sincronização, offline nem estados (carregando, erro, salvo) | Alto | Evento por caminho (`path`, `from`, `to`), independente do tipo de campo |
| 9 | Fonte aumentada e telas de 360dp quebram abas, formas e barra | Alto | Layout decidido por espaço medido e `fontScale`, nunca pelo nome do sistema |
| 10 | Habilidades do Vampiro são da edição Revised, não da V20 | Alto (esforço P) | A edição é parte da identidade do template (`vtm-v20` ≠ `vtm-revised`) |

---

## 2. O que está bem feito

Reconhecimento específico. Estes pontos devem ser **preservados** na evolução:

- **Contraste verificado por cálculo, não por estimativa.** `ink` passa de 13.38:1 e `ink-muted` de 6.26:1 em todos os fundos, nos dois temas. As 42 cores de linhagem passam de 3:1. `on-ouro` sobre `ouro` dá 8.24:1 (noite) e 5.37:1 (pergaminho). Não há hex literal no `bundle.css`.
- **Cor nunca é a única pista:** tipo de dano por glifo (`/ X ✱`), bônus de forma tracejado, `LineageMark` sempre com nome e números obrigatórios na roda.
- **`ouro` (ação) separado de `lineage` (identidade).** É um bom princípio, com uma exceção: Ravnos (C-14).
- **`paradoxo` e `gnose` quase neutros funcionam:** ΔE2000 ≥ 13.6 contra Tradições e Tribos, e ≥ 7.8 com simulação de protanopia e deuteranopia.
- **O padrão correto já existe em dois lugares.** A caixa de Vitalidade é um botão de 44×44 em volta de um visual de 22px, e a roda de Quintessência é editada por −/+ de 44px e não pelas casas. É o modelo a replicar no resto da ficha.
- **Regras viram restrições visíveis:** FdV temporária ≤ permanente, Esferas ≤ Arete com texto explicando, Renome temporário sem teto (W20).
- **FormSelector com legenda textual** ("3 + 4 da forma = 7") e troca de forma levando à aba Físicos.
- **Terminologia M20/W20 correta**, níveis de Vitalidade da edição brasileira e `tabular-nums` nos contadores.
- **Uma ação primária por tela**, com verbo no rótulo. Cabeçalho mobile com alvos de 44×44 e `aria-label`.
- **Cuidado jurídico:** nenhum símbolo oficial de clã copiado, sem emoji.
- **`usage` em cada token**, que é a melhor documentação do pacote.

---

## 3. Racional multi-sistema: como esta proposta suporta fichas de qualquer sistema

### 3.1 O problema em uma frase

Hoje o "Grimório" é **um design system de WoD com aparência agnóstica**. Os princípios ("todo traço aparece como `TraitDots`, nunca como número solto"), os tokens (`gnose`, `paradoxo`, `cla-*`, `trad-*`, `tribo-*`) e as telas (ordem Atributos → Habilidades → Vantagens → Vitalidade, Vitalidade de 7 níveis, barra "Gastar sangue") codificam um único sistema.

Mesmo dentro de WoD, Aparição e Changeling exigiriam tokens e classes novos (Pathos/Angústia, Glamour/Banalidade, Vitalidade quimérica), embora tenham a mesma mecânica de `RageGnose` e `HealthTrack`. Fora de WoD o desencaixe é total:

| Sistema | Como os valores aparecem | Por que "tudo é ponto" quebra |
|---|---|---|
| D&D 5e | atributo 3–20 com modificador derivado; PV de 1 a 300+; CA; slots por nível; proficiência | um 15 (+2) não cabe em pontos; PV precisa de teclado numérico |
| Call of Cthulhu 7e | perícias e características em % com metade e quinto; Sanidade | 60 · 30 · 12 são três números usados na rolagem |
| Fate | perícias em escada (+3 "Bom"); aspectos em **texto**; stress com caixas de valor 1/2/3 | a ficha **é** texto, e o texto precisa estar no topo |
| PbtA | stats −1..+3; moves (texto + checkbox); relógios | número com sinal e listas de texto |

### 3.2 Princípio de arquitetura

> **O código conhece tipos genéricos (campos, blocos, zonas, rolagens). O template conhece o sistema.**
>
> Um sistema novo é **uma linha nova em `trait_templates`** (e em `game_systems`), sem migration e sem tela nova. Só um **tipo** de campo inédito exige código, e esse tipo passa a servir todos os sistemas.

Isso é coerente com o `CLAUDE.md` do repositório: o modelo agnóstico, com a estrutura vinda de `trait_templates.template_data` (jsonb), já existe. Falta a UI seguir o mesmo princípio.

### 3.3 Três camadas: core + skin + dados

| Camada | Contém | Quem muda | Exemplo |
|---|---|---|---|
| **Core** (`packages/ui`) | tokens semânticos (`action`, `accent`, `accent-alt`, `accent-text`, `accent-neutral`, `danger`, `success`, `border-*`, `state-*`, `elevation-*`, `motion-*`), primitivos de valor, layout e feedback, esqueleto de tela, motor de rolagem e validação | time de DS, raramente | `RatingDots`, `NumberField`, `Resource`, `BottomSheet` |
| **Skin** (por família de sistema) | fonte display e de voz, forma do pip, ornamentos, valores de `action` e `accent-alt`, glifos | time de produto, por sistema | `skin.wod` (o Grimório atual), `skin.dnd`, `skin.coc` |
| **Dados** (`trait_templates.template_data`) | campos e tipos, faixas, derivações e regras (por nome, de lista fechada), seções e zonas, dock, ações, rótulos pt-BR, linhagens e acentos, permissões por seção | conteúdo, sem deploy | `{ "type": "rating", "max": 5 }` |

**Renomeação de tokens recomendada.** É barata agora e cara depois.

| Hoje | Proposto (core) | Valor na skin WoD |
|---|---|---|
| `ouro` / `on-ouro` | `action` / `on-action` | igual ao de hoje |
| `lineage` | `accent` (+ `on-accent`, `accent-text`) | vem da linhagem do personagem |
| `paradoxo`, `gnose` | `accent-alt` (segundo recurso de um par, quase neutro) | Mago: valores de `paradoxo`; Lobisomem: valores de `gnose` |
| `sis-*`, `cla-*`, `trad-*`, `tribo-*` | saem do DS e vão para os dados (template mapeia linhagem → `accent-N`) | – |
| `dot-empty`, `line`, `line-strong` | `pip-empty`, `border-subtle`, `border-control` | igual |
| estilo `trait`, `quote` | `field-label`, `voice` | igual |
| família `display` | `skin.display` | Grenze Gotisch |

**Princípios do README reescritos para serem multi-sistema:**

| Princípio atual | Princípio proposto |
|---|---|
| "Pontos são a linguagem; nunca número solto" | "O valor aparece **na notação nativa do sistema**, declarada no template. O número está sempre disponível, visível ou para o leitor de tela." |
| "A cor vem do personagem: cada sistema e cada raça" | "O `accent` é **opcional** e vem dos dados (clã, classe, playbook). Sem `accent`, a ficha usa o neutro da skin." |
| "Gótico só nos títulos" | "A fonte display é **da skin**. Texto de leitura e números são sempre a sans do core." |
| "Use os termos da edição brasileira" | "Rótulos vêm do template (i18n por sistema e edição). O DS não contém termos de jogo." |
| "Celular primeiro, mesa de jogo" | Mantém: já é genérico. |

### 3.4 Primitivos de valor (tipos de campo)

Unificação das três propostas: o DS falava em "primitivos", as telas em "tipos de campo" e a UX em "widgets". É o mesmo catálogo, com um nome por conceito:

| `type` no template | Componente (core) | WoD | D&D 5e | CoC 7e | Fate / PbtA / Aparição / Changeling |
|---|---|---|---|---|---|
| `rating` | `RatingDots` (0–N, `segments` base/bônus/perdido) | Atributos, Habilidades, Disciplinas, Esferas, Arete | contagens pequenas (Inspiração) | – | Arcanoi, Artes, Reinos |
| `number` (`display`: `score+mod`, `signed`, `ladder`) | `NumberField` | – | atributos `15 (+2)`, CA, iniciativa | – | Fate `+3 Bom`; PbtA `+1` |
| `percent` | `PercentField` (com ½ e ⅕) | – | – | perícias, características | – |
| `resource` (atual/máx/temp, permanente opcional) | `Resource`: caixas se máx ≤ 20, senão número + stepper | Sangue, FdV, Fúria, Gnose | PV (+temp), Ki, dados de vida | PV, PM, SAN, Sorte | Pontos de Destino; Pathos; Glamour |
| `track` (níveis, estados nomeados, `fillOrder`) | `LeveledTrack` / `Track` | Vitalidade `/ X ✱` | testes contra a morte; exaustão 1–6 | – | Estresse (caixas 1/2/3); Corpus; Vitalidade quimérica |
| `slots` | `Track` por nível | – | espaços de magia | – | – |
| `clock` | `Clock` (N segmentos, até 2 preenchimentos opostos) | roda Quintessência/Paradoxo | contadores de cena | – | relógios de PbtA/Blades |
| `state` (escolha com `modifiers` add/set/replace) | `Choice` + chip de estado | Formas do Garou | Fúria do Bárbaro, Forma Selvagem, condições | insanidade temporária | Seelie/Unseelie; Catarse |
| `mark` | `MarkToggle` (2–3 estados) | – | proficiência/especialização | marca de evolução | move escolhido |
| `text` / `longText` | `TextField` / `TextAspect` | Natureza, Notas | traços, história | histórico | **aspectos** (primeira classe, no topo) |
| `choice`, `tags` | `Choice`, `Tags` | Clã, Augúrio | raça, classe, condições | ocupação | playbook, condições |
| `list` (com `item` schema) | `Repeater` + busca | Disciplinas, Dons, Rotinas | magias, inventário, ataques | perícias custom, equipamento | moves, façanhas, Grilhões |

Componentes atuais que **deixam de ser do core:**

| Componente atual | Destino |
|---|---|
| `QuintessenceWheel` | vira `clock` |
| `FormSelector` | vira `state` |
| `RageGnose` | vira dois `resource` com `colorRole` |
| `Spheres` | é uma `Section` de `FieldRow` com `cap` e `badge` |
| `AugurMoon` | é um glifo da skin WoD no slot `leading` de um `FieldRow` |
| `LineageMark` | vira `IdentityChip` (`accent` + rótulo + iniciais) |

### 3.5 Esqueleto de tela: o que é fixo no app e o que vem do template

| Camada da tela | Fixo no app (core) | Vem do template |
|---|---|---|
| Header | voltar, nome, selo de identidade, estado de sincronização, menu ⋯ | campos de identidade, fonte do `accent` |
| Navegação de seções | chips com scroll spy, esconder e mostrar no scroll | lista, ordem e rótulos das seções |
| Corpo | zonas na ordem `identity → build → powers → lore`, linha de 48px como alvo, número sempre visível, filtro "só investidos", busca | campos, grupos, `layout` (`groups`, `grid`, `list`, `pyramid`), regra de "investido" |
| Dock (celular) / coluna "Em jogo" (≥ 600px) | posição, 3 chips + "Dados", expansão, toque longo, aviso com Desfazer | quais recursos (`dock`), rótulo curto, ação padrão, ações nomeadas |
| Sheets de edição | editor por `type`, stepper, desfazer, histórico, restrição não destrutiva | limites, custo de XP, `cap`, efeitos colaterais |
| Parada de dados | casca: seleção, total, modificadores com origem, "Rolar no app" ou "Rolei na mão" | `roll.model` (`pool-success`, `sum-vs-target`, `roll-under-percent`, `fudge`, `pbta-2d6`), slots, boosts |
| Sincronização | fila de eventos, indicador, conflitos | nada (o servidor valida pelo schema do template) |

### 3.6 Contrato de template unificado (esboço)

O esboço consolida as propostas dos três relatórios. Para cada divergência entre eles, foi escolhida uma opção (§5).

```jsonc
// vtm-v20 (trechos)
{
  "schema": 1,
  "system": "vtm-v20",                 // a edição faz parte da identidade
  "templateVersion": "1.0.0",
  "skin": "wod",
  "accent": { "from": "identity.clan", "map": { "tremere": "accent-1", "ventrue": "accent-7" }, "fallback": "accent-neutral" },
  "fields": {
    "identity.clan": { "type": "choice", "label": "Clã", "options": ["tremere", "ventrue"] },
    "dex":       { "type": "rating", "label": "Destreza", "min": 1, "max": 5, "editableIn": ["edit"] },
    "blood":     { "type": "resource", "label": "Pontos de Sangue", "shortLabel": "Sangue",
                   "max": { "derive": "vtmBloodPool", "from": "identity.generation" },
                   "editableIn": ["play"], "defaultAction": "spend1",
                   "actions": [{ "id": "heal1", "label": "Curar 1 nível", "cost": 1, "effect": "health.heal" }] },
    "wp":        { "type": "resource", "label": "Força de Vontade", "shortLabel": "FdV", "permanent": { "min": 1, "max": 10 } },
    "health":    { "type": "track", "preset": "wod-7", "types": ["bashing", "lethal", "aggravated"], "rule": "wod-stacking" },
    "disciplines": { "type": "list", "item": { "name": "text", "value": { "type": "rating", "max": 5 } } }
  },
  "sections": [
    { "id": "attr",  "zone": "build",  "title": "Atributos", "layout": "groups", "groups": [{ "title": "Físicos", "fields": ["str", "dex", "sta"] }] },
    { "id": "adv",   "zone": "powers", "title": "Vantagens", "blocks": ["disciplines", "backgrounds", "virtues", "humanity"] },
    { "id": "about", "zone": "lore",   "title": "Sobre",     "blocks": ["quote", "facts", "notes"], "collapsed": true }
  ],
  "dock": ["health", "blood", "wp"],
  "roll": { "model": "pool-success", "die": 10, "slots": ["attribute", "ability"], "penalty": "health",
            "boosts": [{ "resource": "wp", "effect": "autoSuccess" }] }
}
```

```jsonc
// dnd5e-2014 (trechos): mesmo esquema, mesmo código de tela
{
  "system": "dnd5e-2014", "skin": "dnd",
  "accent": { "from": "identity.class", "map": { "mago": "accent-3" }, "fallback": "accent-neutral" },
  "fields": {
    "int":   { "type": "number", "display": "score+mod", "label": "Inteligência", "shortLabel": "INT", "min": 1, "max": 30, "derive": "abilityModifier" },
    "arcana":{ "type": "mark", "label": "Arcanismo", "states": ["—", "proficiente", "especialista"], "bonus": { "derive": "dnd5eSkillBonus", "from": "int" } },
    "hp":    { "type": "resource", "label": "Pontos de Vida", "shortLabel": "PV", "temp": true, "rule": "tempFirst", "atZero": "deathSaves", "allowInput": true },
    "ac":    { "type": "number", "label": "Classe de Armadura", "shortLabel": "CA", "editableIn": ["edit"] },
    "slots": { "type": "slots", "label": "Espaços de magia", "levels": 9, "reset": "longRest" },
    "inventory": { "type": "list", "searchable": true, "density": "compact",
                   "item": { "name": "text", "qty": "number", "weight": "number", "equipped": "mark" } }
  },
  "sections": [
    { "id": "abil",   "zone": "build",  "title": "Atributos", "layout": "grid" },
    { "id": "skills", "zone": "build",  "title": "Perícias",  "layout": "list", "filter": "proficiente" },
    { "id": "spells", "zone": "powers", "title": "Magias" },
    { "id": "inv",    "zone": "lore",   "title": "Inventário" }
  ],
  "dock": ["hp", "ac", "slots"],
  "roll": { "model": "sum-vs-target", "dice": "1d20", "advantage": true }
}
```

Diferenças nos outros sistemas:

- **CoC 7e:** características e perícias em `percent` (`display: percent+half+fifth`); perícias em `layout: list` com busca e filtro "acima da base"; `resource` PV, PM, SAN (máx. derivado de `99 − Mitos`) e Sorte com `allowInput`; `roll.model: roll-under-percent`; ação "Teste de Sanidade"; sem `accent`.
- **Fate Core:** aspectos como `list` de `text` na **zona de jogo, no topo**; perícias em `number` com `display: ladder` e `layout: pyramid` (um layout novo, reutilizável); stress como `track` com `boxValues: [1, 2, 3]`; consequências como `text` em slots 2/4/6; `roll.model: fudge`.
- **Aparição e Changeling:** `track` Corpus de 10 níveis; dois `track` de Vitalidade; `resource` Pathos/Angústia e Glamour/Banalidade; seção "Sombra" com `permissions: ["role:shadowguide"]`.

**Regras de segurança do contrato** (security by design):

- O template é validado no servidor contra um JSON Schema (TypeBox, nativo do Elysia) ao ser inserido, e só por perfil administrativo.
- `type`, `derive`, `rule`, `effect` e `roll.model` aceitam só **nomes de uma lista fechada** registrada no código. **Nunca** `eval`/`new Function`: se templates vierem de usuários (homebrew), avaliar expressão seria RCE no servidor e XSS no web.
- Rótulos são texto, nunca HTML.
- Cores: só referências a `accent-N` da paleta validada; nenhuma string livre do banco em estilo.
- O mesmo validador gerado do template roda no cliente (para UX) e no **servidor (autoridade)** a cada escrita em `sheet_data`.

### 3.7 O que hoje está acoplado a WoD (resumo)

O inventário completo, com 18 itens, está no Anexo B, "Acoplamento a WoD". Os mais caros:

1. **Ordem de seções fixa no markup** → zonas fixas no app, seções e ordem no template.
2. **Barra de recursos específica por sistema** → `dock` declarado no template.
3. **Vitalidade de 7 níveis em constante (`LEVELS`, `KINDS`)** → `track` configurável, ou `resource` numérico para D&D e CoC.
4. **Um único componente de valor (pontos)** → tipos `rating`, `number`, `percent`, `text`, etc.
5. **Abas Físicos/Sociais/Mentais e Habilidades em 3×10** → `layout` por seção (`groups`, `grid`, `list+search`).
6. **Restrições em JS por tela** (Esferas ≤ Arete, Q+P ≤ 20) → `cap`, `rule` e `derive` declarativos.
7. **Rótulos no código** (`ATTR`, `ABIL`, "Pontos de sangue") → `labels.pt-BR` no template.
8. **Tokens `cla-*`, `trad-*` e `tribo-*` no DS** → paleta genérica `accent-N` mapeada pelo template.
9. **Permissão implícita por ficha inteira** → `permissions` por seção, validadas no servidor (necessário para a Sombra da Aparição e para dados que só o narrador vê).

### 3.8 Checklist multi-sistema para qualquer proposta de UI daqui em diante

Antes de aprovar uma tela, componente ou token novo, responda:

- [ ] O componente funciona com `rating`, `number`, `percent` **e** `text`? Se não, ele é skin ou template, não core.
- [ ] Algum nome de sistema, mecânica ou termo de jogo aparece no código de tela ou no nome de um token do core?
- [ ] A ordem, os rótulos e a presença de seções vêm do template?
- [ ] O layout decide pelo espaço medido e por `fontScale`, e não pelo sistema?
- [ ] A regra de jogo (empilhamento, transbordo, teto) é um nome de lista fechada referenciado pelo template?
- [ ] A acessibilidade (rótulo, valor, ações) é gerada pelo tipo, sem texto escrito à mão por sistema?
- [ ] A proposta foi esboçada também para D&D 5e ou CoC, e não só para Vampiro?
- [ ] O servidor valida a escrita pelo schema do template, sem confiar na restrição do cliente?

**Teste de aceitação da arquitetura:** implementar um template não-WoD (D&D 5e, a partir do SRD 5.1, CC BY 4.0) **na mesma fase** do primeiro template WoD. Se a ficha de D&D exigir uma tela nova, a arquitetura falhou.

---

## 4. Achados consolidados e priorizados

Os três relatórios encontraram vários problemas em comum. Cada linha abaixo agrupa os achados que são o mesmo problema visto por ângulos diferentes.

- **Severidade:** Crítico / Alto / Médio / Baixo.
- **Esforço:** P (até 1 dia), M (alguns dias), G (uma sprint ou mais).
- **Camada:** Core / Skin / Template / App (configuração do Expo).

### C-01 · Crítico · Edição acidental: sem modo leitura, jogo e edição, sem desfazer, com cascatas destrutivas
- **Refs:** TL-01, UX-01, DS-04 · **Esforço:** M · **Camada:** Core + Template
- **Problema:**
  - Todo ponto é um `<button>` de 14px. Tocar no ponto *n* define *n*, e **tocar no valor atual reduz 1**. Ao rolar a ficha, um toque de passagem baixa Taumaturgia de 3 para 1.
  - No Mago, um toque errado no Arete reduz Forças, Mente e Primórdio para 1, **e subir o Arete de volta não devolve as Esferas**.
  - Não há confirmação, desfazer nem histórico. O web tem "Editar ficha" e o celular não tem.
- **Impacto:** a ficha é corrompida em silêncio, a mesa perde a confiança e o grupo volta ao papel.
- **Solução:**
  - Três modos explícitos:
    - **Leitura:** ficha de outro jogador ou bloqueada pelo narrador.
    - **Jogo (padrão):** consumíveis editáveis pelo dock e pelos sheets; traços permanentes são exibição, e tocar a linha abre o sheet de detalhe com "Alterar valor".
    - **Evoluir/Editar:** steppers −/+ de 44px em todas as linhas; ao sair, resumo "3 alterações" com Salvar/Descartar.
  - Stepper muda 1 por toque, nunca salta. Cada mudança mostra o aviso "Destreza 2 → 3 · Desfazer" (5s) e entra no histórico (quem, quando, de, para).
  - **Restrição não destrutiva:** baixar o Arete deixa as Esferas acima "inativas", e elas voltam quando o Arete sobe.
- **Multi-sistema:** o modo vem de `editableIn: ["play" | "edit"]` por campo, não do tipo visual. Exemplos: PV e slots do D&D em jogo, atributos em edição; SAN e Sorte do CoC em jogo, perícias em edição; stress do Fate em jogo, aspectos em edição. Restrições são `cap` do template, como `max: arete` ou SAN máx. = 99 − Mitos.

### C-02 · Crítico · Alvos de toque de 14px e 22px contra os 44px prometidos
- **Refs:** DS-01, TL-03, UX-03 · **Esforço:** M · **Camada:** Core
- **Problema:**
  - `.g-dot` tem 14×14 com passo de 20px e falha até o mínimo WCAG 2.5.8 (24px).
  - `.g-box` tem 22×22 com passo de 26px.
  - Os pontos permanentes ficam **8px acima** das caixas temporárias (FdV, Fúria, Gnose, Renome).
  - Um ponto de 14px tem 10% da área de um alvo de 44×44. A polpa do polegar (10–14mm) cobre 3 ou 4 pontos.
  - "Área de toque da linha inteira" (README do `TraitDots`) não é implementável com 5 a 10 alvos por linha.
- **Solução:**
  - Separar visual de alvo: em leitura, pontos e caixas são **só visuais**, e o alvo é a linha inteira (≥ 48px) ou o chip do dock.
  - Edição sempre em sheet, com steppers de 56×56 centralizados na parte de baixo.
  - Onde o toque individual é necessário (slots, caixas de estresse): 44–48px com gap ≥ 8px.
  - Tokens: `pip-size: 16`, `pip-hit-w: 32`, `hit-size: 44`, `box-size: 24`.
  - Replicar o padrão que a Vitalidade e a roda já usam.
- **Multi-sistema:** o contrato ergonômico é do core e vale para qualquer tipo. Números grandes (PV 134, perícia 45%) são editados com ± e teclado numérico, nunca com setas pequenas em linha.

### C-03 · Crítico · Leitor de tela não anuncia o valor dos traços
- **Refs:** TL-02, UX-04, DS-05, TL-16 · **Esforço:** M · **Camada:** Core
- **Problema:**
  - `aria-label="Destreza: 3 de 5"` é igual em ponto cheio e vazio, então o VoiceOver lê cinco botões sem dizer o valor.
  - O tipo de dano da Vitalidade é desenhado com `content:""`, invisível para a tecnologia assistiva.
  - São ~169 paradas de Tab por ficha.
  - O FormSelector usa `aria-pressed` numa escolha única. As abas não têm `tabpanel` nem navegação por setas. Recursos não têm heading. Não há `<main>` nem `aria-live`.
  - Falha no WCAG 4.1.2 no componente central do produto.
- **Solução:**
  - **Um controle acessível por linha.** Em leitura: botão "Destreza, 2 de 5, especialização …". Em edição: `accessibilityRole="adjustable"` com `accessibilityValue` e ações `increment`/`decrement` (no web, `role="slider"` com `aria-valuetext`).
  - Os pontos ficam ocultos para o leitor de tela.
  - Vitalidade com resumo: "Machucado, penalidade −1; 1 contusivo, 1 letal".
  - Mudanças anunciadas com `announceForAccessibility`. Formas como `radiogroup`. Títulos com `accessibilityRole="header"`.
  - Resultado: cerca de 50 paradas por ficha.
- **Multi-sistema:** a gramática do anúncio é **por tipo**. Exemplos: "Força, 16, modificador mais 3" (D&D); "Esquivar, 45 por cento; difícil 22; extremo 9" (CoC); "Atletismo, Ótimo, mais 4" (Fate); "Aspecto: Ex-detetive endividado". Os nomes vêm do template. Adicionar um sistema não exige código de acessibilidade.

### C-04 · Crítico · Recursos de combate longe; barra fixa sem estado
- **Refs:** TL-04, UX-02, UX-07 · **Esforço:** G · **Camada:** Core + Template
- **Problema:**
  - A Vitalidade começa em y≈2.183 (Vampiro), ≈2.970 (Mago) e ≈2.588 (Lobisomem), a 2,6–3,7 telas do topo.
  - A barra fixa oferece "Gastar sangue/Fúria", mas não mostra valores. A ação muda um contador fora da tela, e a pessoa toca de novo e gasta 2.
  - Montar uma rolagem exige ver atributo, habilidade e penalidade, que ficam a mais de 1.500px um do outro.
  - No web, a Vitalidade está na primeira dobra. A versão mobile perdeu essa prioridade.
- **Solução:**
  - Trocar a barra por um **dock de combate**: 3 chips que **mostram o valor atual** (Vitalidade com mini-trilha e penalidade, "Sangue 9/15", "FdV 5/7") mais o botão "Dados" (ação primária, `action`).
  - **Toque** abre o sheet do recurso. **Toque longo** executa a ação padrão ("Gastar 1"), com háptico e Desfazer; para VoiceOver, o mesmo atalho fica em `accessibilityActions`.
  - **Puxar o dock** mostra todos os recursos.
  - O corpo ganha header compacto fixo (nome, selo, sincronização, ⋯), chips de seção com scroll spy e identidade recolhida (a citação e o conceito vão para "Sobre", no fim).
  - Em telas ≥ 600px, o dock vira uma **coluna "Em jogo" sticky**.
  - Efeito medido nos walkthroughs: "2 de dano letal" passa de 4–7 toques e 2–3 rolagens para **3 toques e 0 rolagens**.
- **Multi-sistema:** o dock é `dock: [ids]` no template e **nunca** é fixo em Sangue, Fúria ou Quintessência. O app só sabe desenhar chips por tipo (`resource`, `track`, `slots`, `number` só leitura, `state`). Padrões sugeridos:
  - WoD: [Vitalidade, recurso principal, FdV]
  - D&D: [PV, CA, Espaços]
  - CoC: [PV, SAN, Sorte]
  - Fate: [Estresse, Destino, Consequências]

  O jogador pode refixar os chips.

### C-05 · Crítico (arquitetura) · Camada base acoplada a WoD; três telas à mão; nenhum token consumido
- **Refs:** DS-02, DS-03, TL-05, TL-06 · **Esforço:** G no total; P–M se feito **antes** de implementar · **Camada:** Core + Skin + Template
- **Problema:**
  - `Main`, `Mago` e `Lobisomem` são arquivos separados com estruturas divergentes. Notas e Natureza somem conforme o sistema, e as listas `ATTR`, `ABIL` e `LEVELS` estão duplicadas em cada script.
  - As telas usam hex literal em vez de `var(--token)` e mapas `COLORS` em JS em vez de `data-lineage`. Não usam as classes do `bundle.css`. O tema `pergaminho` é impossível sem reescrever.
  - No DS, 42 linhagens estão fixas em CSS e tokens.
- **Solução:** §3 inteira. Um renderizador único guiado por `trait_templates`, tokens semânticos gerados para RN (`tokens.json` → `tokens.ts` e CSS vars), skin WoD separada e paleta `accent-N` validada.
- **Multi-sistema:** é o achado-raiz. Com o esqueleto genérico, D&D, CoC e Fate entram como dados.

### C-06 · Alto · Vitalidade marcada por ciclo de toques, sem regra
- **Refs:** DS-11, TL-09, UX-05 · **Esforço:** M · **Camada:** Core + Template
- **Problema:**
  - O ciclo é vazio → `/` → `X` → `✱` → vazio. Curar um `X` passa por `✱`.
  - "Duas letais" sobre `/ X` exige que o jogador saiba que o resultado correto é `X X X /`: são 4 toques, ou 7 com erro.
  - A interface permite estados inválidos (buracos na trilha). A ajuda não menciona o 4º toque, que limpa a caixa.
- **Solução:** sheet de dano com "+ Contusivo / + Letal / + Agravado" e "Curar /, X, ✱", com quantidade. O app guarda **contagens por tipo** e desenha a trilha ordenada pela regra. Penalidade grande no topo, háptico mais forte no agravado e "Editar caixas manualmente" como saída para o narrador.
- **Multi-sistema:** o visual é `track` genérico e a regra é nome do template (`wod-stacking`). D&D usa `resource` PV com `tempFirst` e `atZero: deathSaves`; CoC, número + marca de ferimento grave; Fate, caixas com valor + consequências em texto; Changeling, duas trilhas.

### C-07 · Alto · Parada de dados manual, ações sem fluxo e abas que escondem o necessário
- **Refs:** UX-06, TL-15, TL-13, UX-18 · **Esforço:** G (rolagem), M (resto) · **Camada:** Core + Template
- **Problema:**
  - As abas abrem por padrão em "Mentais" e "Conhecimentos" (`tabA: 2`, `tabH: 2`).
  - Os valores aparecem só como pontos, e a penalidade fica só no parágrafo da Vitalidade.
  - "Rolar dados", "Gastar sangue" e "Conjurar efeito" não têm `onClick`.
  - No Crinos, o −3 de Manipulação fica escondido na aba Sociais.
- **Solução:**
  - **Números ao lado dos pontos** em toda a ficha.
  - Atributos em grade 3×3 sem abas (9 visíveis em ~190px).
  - Habilidades com filtro "só com pontos" e busca.
  - **Sheet "Parada de dados"** com:
    - busca, recentes e seleção pela grade;
    - modificadores automáticos com origem (ferimento, forma);
    - dificuldade;
    - FdV como bônus;
    - "Rolar no app" **e** "Rolei na mão", porque dados físicos são primeira classe.
- **Multi-sistema:** a casca é do app e a mecânica vem de `roll.model`:
  - `pool-success` (WoD)
  - `sum-vs-target` (D&D, com vantagem/desvantagem vindas de condições)
  - `roll-under-percent` (CoC, com difícil/extremo e dados bônus)
  - `fudge` (Fate)
  - `pbta-2d6`

  O Mago usa o rótulo "Conjurar" vindo do template.
- **Segurança:** rolagens que valem para a mesa devem ser feitas **no servidor**, porque o cliente pode forjar o resultado. Rolagens locais usam `crypto.getRandomValues`, nunca `Math.random`.

### C-08 · Alto · Sem sincronização, offline nem estados de sistema
- **Refs:** UX-10, DS-04, "Telas e estados que faltam" (Anexo B) · **Esforço:** G · **Camada:** Core
- **Problema:** não há indicador de salvo/salvando/erro nem skeleton, erro ou "sem permissão". O Wi-Fi de mesa cai com frequência: ou se perde a edição em silêncio, ou a interface trava esperando a rede.
- **Solução:**
  - **Local-first:** aplica na hora e grava o evento `{path, from, to, at, by}` numa fila persistida.
  - Indicador no header: "● salvo" / "◌ salvando" / "offline · 3 pendentes".
  - Em conflito, prevalece a última escrita, com aviso ("A narradora alterou Vitalidade enquanto você estava offline").
  - `expo-keep-awake` no "modo sessão".
- **Multi-sistema:** o evento é por caminho e independe do tipo: ponto, número, %, texto e operações de lista (inventário de D&D) usam a mesma fila. O servidor valida pelo schema do template de cada sistema.

### C-09 · Alto · Fonte aumentada e 360dp quebram o layout
- **Refs:** DS-06, UX-08, TL-17 · **Esforço:** M · **Camada:** Core
- **Problema:**
  - Os tokens estão em px fixos, e os rótulos da roda e das formas têm 11px.
  - "CONHECIMENTOS" já ocupa 116 de 119px a 100%, e "Hominídeo" estoura o botão em 360dp.
  - A 200%, as abas cortam e a barra quebra em duas linhas.
  - No RN, `allowFontScaling` vem ligado por padrão.
- **Solução:**
  - Não limitar a fonte globalmente. Trocar o layout pela largura medida e por `fontScale`:
    - grade 3×3 vira lista a partir de 1,3×;
    - formas viram lista vertical;
    - `TraitRow` empilha o nome sobre os pontos.
  - Pontos escalam até 1,5×. Nenhum texto com significado abaixo de 13px (o piso de 12 vale só para rótulos decorativos).
  - Matriz de teste 360/390/430 × 100/130/200%.
- **Multi-sistema:** os piores textos são de outros sistemas ("Ciência (Farmácia)" no CoC, "Esfera Resiliente de Otiluke" no D&D, "PV 127/134 +12"). O template fornece `shortLabel`, e o app decide pelo espaço medido.

### C-10 · Alto · Web e tablet: colunas desbalanceadas e breakpoints não desenhados
- **Refs:** TL-07, TL-10, UX-16, DS-07 · **Esforço:** M · **Camada:** Core
- **Problema:**
  - O web usa 3 colunas `flex: 1 1 340px`: Habilidades com ~1.356px e Recursos com ~850px, ou seja, ~500px vazios.
  - Entre 740 e 1107px (iPad), **Recursos e Vitalidade vão para y≈1.700**.
  - A faixa de 600 a 899px não está definida. Os grupos estão empilhados, quando o `Tabs` pede "lado a lado a partir de 900px".
  - A mesma ficha muda entre celular e web: Humanidade em lugares diferentes, "Editar ficha" só no web e "Gastar sangue" só no celular.
- **Solução:**
  - Breakpoints como tokens: `compact` 0–599, `medium` 600–899, `expanded` ≥ 900.
  - ≥ 900px: coluna "Em jogo" sticky (equivalente ao dock) + traços com grupos lado a lado quando cada grupo tem ≥ 240px.
  - 600–899px: uma coluna de até 640px, com "Em jogo" em 2 colunas internas.
  - Uma lista única de ações: primária e secundária visíveis, o resto em ⋯, igual nas duas plataformas.
- **Multi-sistema:** "lado a lado se couber" depende só do número de grupos e de `minColWidth` do template. Os 6 atributos de D&D viram `grid`, as ~60 perícias de CoC viram `list` com colunas de fluxo, e os aspectos de Fate ocupam largura total.

### C-11 · Alto (esforço P) · Edição de regras errada no Vampiro
- **Refs:** TL-08, DS-15 · **Camada:** Template
- **Problema:**
  - As Habilidades do Vampiro (Main l.207–209, Web l.199–201) são da edição **Revised**: têm Esquiva, Segurança e Linguística e não têm Consciência (Talento), Ladroagem e Tecnologia. O DS diz "V20 primeiro".
  - Os ids de clã são da V5 (Banu Haqim, Hecata, Ministério), enquanto na V20 são Assamitas, Giovanni e Seguidores de Set.
- **Solução:** corrigir para a lista V20 (Anexo B, TL-08) e escolher explicitamente a nomenclatura de clãs. A partir daí, as listas vêm do template.
- **Multi-sistema:** a edição é identidade do template: `vtm-v20` ≠ `vtm-revised`, `dnd5e-2014` ≠ `dnd5e-2024`. Os ids de traço são estáveis e independentes do rótulo, porque "Consciência" é Talento no Mago (`awareness`) e Virtude no Vampiro (`conscience`).

### C-12 · Alto · Lobisomem: troca de forma longe dos atributos e valor efetivo difícil de ler
- **Refs:** UX-09, DS-12, TL-11 · **Esforço:** M · **Camada:** Core + Template
- **Problema:**
  - O seletor de forma fica atrás da barra na primeira tela.
  - O valor efetivo aparece só numa legenda de 13px itálico. Força em Crinos mostra 9 pontos que quebram em 2 linhas.
  - O tracejado de 1,5px num círculo de 14px quase não se distingue do contorno contínuo.
  - Em Crinos, tocar num ponto altera o valor **base**.
- **Solução:**
  - Forma como chip de estado no dock. O sheet lista as formas **com os valores efetivos** ("Crinos: For 7 Des 4 Vig 6 Man 0 Apa 0") e o custo opcional em Fúria.
  - Selo "Crinos" no header. Na grade, o valor efetivo aparece grande, com "3+4" pequeno.
  - O valor base só muda por "Alterar valor base".
- **Multi-sistema:** é o padrão genérico **estado com modificadores** (`state` + `modifiers` add/set/replace): Fúria do Bárbaro, Forma Selvagem (que *substitui* atributos físicos), condições de D&D (Envenenado = desvantagem automática na parada), insanidade temporária no CoC. O mesmo componente atende todos.

### C-13 · Médio · Cores de linhagem: confusões, escopo e texto
- **Refs:** DS-08, DS-09, TL-12 · **Esforço:** P (valores), M (validação no CI) · **Camada:** Core + Template
- **Problema** (ΔE2000 calculado):
  - **Tremere é idêntico a "Vampiro sem clã"** (ΔE 1.7).
  - **Ravnos tem a cor do botão de ação** no pergaminho (ΔE 1.7).
  - **Crias de Fenris e Garras Vermelhas são idênticas** para quem tem deuteranopia (ΔE 0.0).
  - Fúria × Gnose para Presas de Prata dá 1,21:1, e Quintessência × Paradoxo para Eutanatos dá 1,62:1.
  - Fora da ficha, `lineage` fica vermelho-Vampiro.
  - `.g-affinity` usa a linhagem como texto, mas 5 das 42 ficam abaixo de 4.5:1.
- **Solução:**
  - Personagem sem linhagem usa `accent-neutral`.
  - Regra validada no CI: ΔE ≥ 10 entre `accent` e `action`, com visão normal e com simulação de daltonismo.
  - Token `accent-text` (≥ 4.5:1) para texto.
  - Botões nunca em `accent`.
  - Recursos vizinhos se distinguem por **rótulo + forma ou padrão**, nunca só por cor.
  - Iniciais ou monograma como segunda pista na lista de personagens.
  - Valores calculados para as substituições estão no Anexo A, DS-08 e DS-09.
- **Multi-sistema:** a mesma validação vale para as 12 classes de D&D, os playbooks de PbtA e cores escolhidas pelo jogador. Sistemas sem linhagem (CoC, Fate) usam o neutro. O papel de cor (`colorRole`: `accent`, `neutral-a`, `neutral-b`) vem do template.

### C-14 · Médio · Tokens e estados faltando
- **Refs:** DS-07, DS-04 · **Esforço:** M · **Camada:** Core
- **Problema:**
  - Faltam elevação, motion, z-index, breakpoints, espessura de borda e cores de estado (`danger`, `success`, `state-pressed`, `scrim`).
  - Não há `:active`, `:disabled`, `[aria-busy]` nem estado de erro.
  - As superfícies se separam só por cor (1.06:1), então no pergaminho uma folha branca sobre o cartão fica invisível.
  - O CSS repete valores de tipo em vez de referenciar os tokens.
- **Solução:** a tabela de tokens novos, com contraste já calculado, está no Anexo A (DS-04 e DS-07). Motion respeita "reduzir movimento" (`useReducedMotion`). Gerar CSS e `tokens.ts` a partir de `tokens.json`.
- **Multi-sistema:** todos esses tokens são do core e independem de sistema.

### C-15 · Médio · Tipografia, fontes e LGPD
- **Refs:** DS-10, TL-18, UX-13 · **Esforço:** M · **Camada:** Core + Skin
- **Problema:**
  - Números da roda em Grenze Gotisch (blackletter): os algarismos menos legíveis com pouca luz.
  - Rótulos de 11px.
  - Nome do personagem em blackletter de 34px sem regra de quebra.
  - No RN não há pilha de fallback, e o Android não sintetiza pesos.
  - **O `@import` do Google Fonts envia o IP de cada usuário ao Google:** é ponto de atenção para a LGPD (transparência e base legal), além de bloquear a renderização.
- **Solução:**
  - Números sempre em `sans` com `tabular-nums`.
  - Nome com `numberOfLines={2}`.
  - Opção de acessibilidade "Títulos sem gótico".
  - **Hospedar as fontes no app com `expo-font`** e remover a Grenze 500, que não é usada.
  - `fontFamily` por peso em `type.native.ts`.
- **Multi-sistema:** fonte display e de voz são da **skin**. Carregamento, piso de tamanho e "números em sans" são do core.

### C-16 · Médio · Contraste de estados bloqueados e tracejado com três significados
- **Refs:** TL-11, UX-13 · **Esforço:** P · **Camada:** Core
- **Problema:** o tracejado significa "indisponível" (1,39:1), "acima do Arete" (2,21:1, cor fora dos tokens), "bônus" e "perdido". Com brilho a 20%, os bloqueados somem.
- **Solução:**
  - Não desenhar o indisponível; escrever o teto em texto ("5 / 7", "máx. 3 (Arete)").
  - Vocabulário único: cheio = tem, vazio = não tem, tracejado = modificador temporário, sempre acompanhado de texto.
  - No pergaminho, `line-strong` passa a `#86797f`.
- **Multi-sistema:** "base + modificador = efetivo" é genérico: `rating` tracejado, `number` "16 → 18 (+2)", `percent` "60% (½ por dificuldade)".

### C-17 · Médio · Mago: controles de Quintessência e Paradoxo ambíguos
- **Refs:** UX-14, DS-14 · **Esforço:** P · **Camada:** Core
- **Problema:**
  - A sequência é `[−] Quint. [+] [−] Parad. [+]`, com 12px entre "Quint. +" e "Parad. −", e rótulos abreviados.
  - Com a roda cheia, "+ Paradoxo" tira 1 Quintessência sem aviso.
  - Os −/+ estão documentados no DS mas ausentes no preview do componente.
- **Solução:** a roda fica só como visualização. A edição vai para duas linhas separadas no sheet, com nomes por extenso e steppers de 56px. O efeito colateral é anunciado com Desfazer.
- **Multi-sistema:** é o padrão **recursos acoplados**: Pathos/Angústia, Glamour/Banalidade, PV/PV temporário, SAN máx./Mitos. A regra de acoplamento vem do template.

### C-18 · Médio · Poderes não consultáveis
- **Refs:** UX-15, TL-15 · **Esforço:** M · **Camada:** Core + Template
- **Problema:** Disciplinas, Dons e Esferas mostram só o nível. O gesto natural de "abrir" (tocar) altera o valor.
- **Solução:** sheet de detalhe com níveis, especialização, notas do jogador e do narrador, custo e "Montar parada".
- **Licença:** os textos de WoD e CoC são protegidos e não devem ser embutidos. O SRD 5.1 de D&D é CC BY 4.0 e pode entrar com atribuição. O padrão é o template trazer os nomes e a mesa escrever a descrição.
- **Multi-sistema:** os campos do detalhe vêm de `list.item` no template. Magia de D&D: nível, escola, componentes, concentração. Feitiço de CoC: custo em PM e SAN. O sheet é sempre o mesmo.

### C-19 · Médio · Narrador sem visão da mesa
- **Refs:** UX-11, "Telas e estados que faltam" (Anexo B) · **Esforço:** M · **Camada:** Core + Template
- **Problema:** para saber "quem ainda tem FdV?", a narradora abre 4 fichas e rola 3 telas em cada uma. Não existe leitura segura: ela pode alterar a ficha do jogador sem querer.
- **Solução:** painel "Mesa" com uma linha por personagem (os mesmos chips do dock e a hora da última sincronização). Tocar abre a ficha em **leitura**. Deslizar passa para a próxima ficha (começando a 24px da borda, para não conflitar com o voltar do iOS). Edição da narradora é explícita e assinada no histórico.
- **Multi-sistema:** a linha-resumo reutiliza o `dock` do template. Em D&D, o painel vira rastreador de iniciativa (`initiative` no template). Em CoC, mostra SAN e insanidade.

### C-20 · Médio · Navegação e menu ⋯ indefinidos
- **Refs:** TL-14, UX-19 · **Esforço:** P · **Camada:** Core
- **Problema:**
  - O nome da crônica é `<span>`. O web não tem "voltar", e o link ativo não tem `aria-current`.
  - O conteúdo do ⋯ não está especificado.
  - Ao reabrir a ficha, abas e rolagem voltam ao padrão.
- **Solução:**
  - "‹ Noites de São Paulo" como um único alvo.
  - Breadcrumb no web.
  - Menu ⋯: Evoluir personagem · Histórico · Trocar de personagem · Tema · Exportar/Imprimir · Arquivar · Excluir (com confirmação).
  - Preservar por personagem a rolagem, a seção, os filtros e a última parada.
- **Multi-sistema:** cabeçalho e menu são do esqueleto. Ações de sistema ("Descanso longo", "Teste de Sanidade") entram por `actions[]`.

### C-21 · Médio (esforço P) · Safe areas, StatusBar e configuração do app
- **Refs:** UX-12, DS-16 · **Camada:** App
- **Problema:**
  - `packages/ui/src/Screen.tsx` usa o `SafeAreaView` do `react-native`, que só atua no iOS e está obsoleto.
  - `app.json` tem `edgeToEdgeEnabled: true` (Android), `userInterfaceStyle: "light"` e splash `#ffffff`: há flash branco antes de uma tela escura e ícones escuros sobre `#120e10`.
  - Nos mockups, a barra fixa tem `padding-bottom: 20px` fixo, e o home indicator pede 34.
  - O `Button` atual usa `#007AFF` e não usa nenhum token. As `peerDependencies` estão desatualizadas (react `^18`, RN `^0.76`).
- **Solução:**
  - Usar `react-native-safe-area-context` (já é dependência) com `useSafeAreaInsets()`.
  - `<StatusBar style="light" />`, `userInterfaceStyle: "automatic"` e splash `#120e10`.
  - Atualizar as `peerDependencies`.
  - `npx expo install react-native-svg` para `Clock`, pips tracejados e glifos.
- **Multi-sistema:** estrutura do app, não depende do template.

### C-22 · Baixo · Microcopy, escala tipográfica e espaçamento
- **Refs:** TL-18, TL-19, TL-20, TL-21, DS-15 · **Esforço:** P · **Camada:** Template + Core
- **Problema:**
  - Capitalização inconsistente ("Força de vontade" × "Força de Vontade") e "Hominídea" × "Hominídeo".
  - Abreviações ("Quint.", "Parad.").
  - "Glória 3 · 4 temporário".
  - "Toque" no celular e "Clique" no web.
  - Margens de 28, 20, 14 e 10px fora da escala.
  - Posto como número solto.
  - O README diz `title` para grupos, mas o componente usa `label`.
- **Solução:**
  - Glossário único por sistema no template.
  - "Permanente 3 · Temporário 4".
  - Verbo neutro ("Marque").
  - 24/16/12 como espaçamentos.
  - Decidir no DS as divergências entre README e componente (tabela no Anexo A, DS-15).
- **Multi-sistema:** rótulos e glossário ficam no template, por sistema e idioma (`labels.pt-BR`), nunca no código.

### C-23 · Baixo · Teclado, paisagem e AugurMoon
- **Refs:** UX-17, UX-16, DS-13 · **Esforço:** P · **Camada:** Core + Skin
- **Solução:**
  - Editar texto em sheet de altura total com `KeyboardAvoidingView`, e `number-pad` para números.
  - Retrato no celular. Rotação liberada no tablet, com layout de 2 colunas entre 600 e 899px.
  - Lua do augúrio em SVG com contorno: hoje a lua nova é invisível e o desenho muda conforme o fundo.
- **Multi-sistema:** teclado e paisagem são do app. A lua é **glifo da skin WoD**, fora do core.

---

## 5. Decisões de reconciliação

Nos pontos em que os três relatórios divergiram, esta é a recomendação consolidada:

| Tema | Opções nos relatórios | Recomendação | Por quê |
|---|---|---|---|
| Onde ficam os recursos de combate no celular | (a) zona "Em jogo" no topo do corpo + mini-HUD fixo sob o header (TL-04); (b) dock inferior com valores e sheets (UX-02) | **Dock inferior** no celular; coluna "Em jogo" sticky a partir de 600px. No DOM e na ordem de leitura, a zona de jogo vem primeiro. | O dock está na zona do polegar e mostra o estado. A Vitalidade no topo só ajuda com a rolagem em 0 e empurra os Atributos ~400px para baixo. |
| Nomes dos modos | view/play/edit (DS) · Jogo/Edição/Leitura (TL) · leitura padrão + "Evoluir personagem" (UX) | **Leitura** (fichas de terceiros) · **Jogo** (padrão do dono) · **Evoluir** (edição de permanentes, no ⋯) | "Evoluir" comunica gasto de XP entre sessões e evita que o modo fique esquecido ligado. |
| Cor de linhagem | (a) semente OKLCH derivada por tema (DS-03); (b) paleta fixa `accent-1…N` validada (TL-06) | **Paleta fixa `accent-N`** (~16 cores validadas no CI para contraste e daltonismo); semente OKLCH só se homebrew exigir cor livre | É mais simples, não aceita cor livre vinda do banco e é validável offline. O DS-08 mostrou que nenhuma paleta distingue 14 clãs só pela cor sob daltonismo, então o nome sempre acompanha a cor. |
| Fórmulas derivadas no template | (a) AST JSON com operações em lista branca (TL); (b) nomes de funções registradas (DS, UX) | **Nomes de funções registradas** (`abilityModifier`, `vtmBloodPool`) no MVP; AST só se homebrew pedir | Superfície de ataque menor e testes unitários por função. AST exige avaliador com limites de profundidade e custo. |
| Nome do componente/tipo | `widget` (UX) · `type` (TL, DS) | **`type` + `display`** | Um nome por conceito; `display` cobre as variações visuais (`score+mod`, `ladder`, `boxes`, `number`). |
| "Tocar no valor atual reduz 1" | comportamento atual dos pontos | **Remover** | Surpreende e causa perda acidental; o stepper resolve. |

---

## 6. Proposta de layout mobile (síntese)

Mesmo esqueleto, dois sistemas. `[A]` = estrutura do app; `[T]` = vem do template. Os esboços completos (sheets de dano, de parada e de forma, e o painel do narrador) estão no Anexo C.

```text
VAMPIRO (vtm-v20)                              D&D 5e (dnd5e-2014)
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│ ‹ Helena Varga ● Tremere  ● salvo  ⋮ │ [A]   │ ‹ Lia Brasa ● Maga nv 5   ● salvo  ⋮ │
│ Atributos Habilidades Vantagens Vit› │ [T]   │ Atributos Perícias Combate Magias › │
├──────────────────────────────────────┤       ├──────────────────────────────────────┤
│ (HV) Arquivista da Capela · 8ª ger ˅ │ [T]   │ (LB) Elfa · Evocação · Sábia       ˅ │
│ ATRIBUTOS                            │       │ ATRIBUTOS             salvaguarda ◆  │
│ ┌──────────┬──────────┬──────────┐   │       │ ┌──────────┬──────────┬──────────┐   │
│ │Força   2 │Carisma 2 │Percep. 3 │   │ rating│ │FOR    −1 │DES    +2 │CON    +1 │   │ score+mod
│ │●●○○○     │●●○○○     │●●●○○     │   │       │ │        8 │       14 │       12 │   │
│ │Destreza 2│Manip.  3 │Intel.  4*│   │       │ │INT◆   +4 │SAB◆   +1 │CAR    +0 │   │
│ │●●○○○     │●●●○○     │●●●●○     │   │       │ │       18 │       12 │       10 │   │
│ └──────────┴──────────┴──────────┘   │       │ └──────────┴──────────┴──────────┘   │
│ HABILIDADES   só com pontos ▾ Buscar │ [A]   │ PERÍCIAS   só proficientes ▾ Buscar  │
│ Prontidão              ●●○○○   2     │       │ Arcanismo ◆                     +7   │ mark
│ Esportes               ●○○○○   1     │       │ História  ◆                     +7   │
├──────────────────────────────────────┤       ├──────────────────────────────────────┤
│ +1 Sangue (10/15)        [Desfazer]  │ [A]   │ Espaço 1º usado (3/4)   [Desfazer]   │
├──────────────────────────────────────┤       ├──────────────────────────────────────┤
│ [VITALID.][ SANGUE ][ FDV ][ DADOS ] │ [T]   │ [ PV     ][  CA  ][ESPAÇOS][ DADOS ] │
│ [■■□ −1 ][  9/15  ][ 5/7 ][parada ] │       │ [27/27+5 ][  12  ][1º 4/4 ][d20+mod] │
└──────────────────────────────────────┘       └──────────────────────────────────────┘
```

As molduras são idênticas: header, chips, grade primária, lista com filtro, aviso com Desfazer e dock. Mudam só o que o template declara: o tipo da grade (`rating` × `number score+mod`), a regra do filtro (pontos × proficiência), os itens do dock e o modelo de rolagem.

*Nota:* no esboço do Vampiro, "Esportes" substitui "Esquiva", que não existe na V20 (C-11).

---

## 7. Componentes que faltam no DS

Todos são **core** (genéricos). Detalhes no Anexo A, "Componentes que faltam".

| Componente | Para quê | Exemplos multi-sistema |
|---|---|---|
| `Stepper` / `ValueEditor` | edição de qualquer valor com −/+ de 44px, toque no valor para digitar e `adjustable` | PV de D&D, % de CoC, escada de Fate, Quintessência |
| `NumberField` com derivado | valor + derivado (lista fechada de derivações) | `15 (+2)`, `60 · 30 · 12`, `+3 Bom` |
| `BottomSheet` | hospeda editores, dano, parada e detalhe | todos |
| `Toast` com Desfazer | rede de segurança para toda edição em jogo | todos |
| `ConfirmDialog` | ações destrutivas raras (excluir personagem) | todos |
| `TextField` / `NotesEditor` / `AspectField` | texto como cidadão de primeira classe | aspectos de Fate, Grilhões, traços de D&D |
| `CharacterCard` / `ChronicleCard` / `ListItem` | listas de crônicas e personagens | "Tremere", "Elfo · Mago 5", "Professor de Antropologia" |
| `EmptyState` / `Skeleton` / `Banner` | carregamento, vazio, offline, conflito | todos |
| `DiceRoller` | casca de parada; a mecânica vem do template | d10 pool, d20, d100, 4dF, 2d6 |
| `CombatDock` / `CharacterHeader` | dock com valores; header compacto | itens do `dock` do template |
| `SegmentedControl`, `TabBar`, `AppHeader`, `IconButton` | navegação base, ícones genéricos (sem símbolos de clã) | todos |
| `Tag` / `MarkToggle` / `IdentityChip` | condições, proficiência, identidade (substitui `LineageMark`) | Envenenado, proficiente, playbook |
| `Repeater` / `ListEditor` | listas abertas com esquema por item | Disciplinas, magias, inventário, moves |

---

## 8. Roadmap recomendado

### Fase 0: quick wins (cada item em menos de 1 dia)

1. Corrigir as Habilidades do Vampiro para a V20 e decidir a nomenclatura de clãs, V20 ou V5 (C-11).
2. **Número ao lado dos pontos** em toda a ficha (C-07, C-16).
3. Remover "tocar no valor atual reduz 1" (C-01).
4. `aria-label` com nome **e** valor do traço; tipo de dano em texto na Vitalidade; `radiogroup` nas formas (C-03).
5. CSS de estados: `:active`, `:disabled`, `[aria-disabled]`, `.g-form:focus-visible`, anel de foco distinto no botão `ouro` (C-14).
6. `accent` neutro fora da ficha, token `accent-text`, personagem sem clã com `accent-neutral`, Ravnos fora do matiz do `ouro` (C-13).
7. `line-strong` e `dot-empty` com mais margem no pergaminho (C-16).
8. `app.json`: `userInterfaceStyle: "automatic"` e splash `#120e10`; `react-native-safe-area-context` no `Screen.tsx` (C-21).
9. Fontes hospedadas com `expo-font`, sem `@import` do Google Fonts (LGPD); remover a Grenze 500; números da roda em `sans` (C-15).
10. Microcopy: glossário, "Permanente · Temporário", nomes por extenso, verbo "Marque" (C-22).

### Fase 1: fundação (antes de escrever a ficha em `packages/ui`)

1. **Decidir core + skin + dados** e renomear os ~10 tokens (§3.3). Reescrever os princípios do README (§3.3).
2. **Contrato do template**: JSON Schema (TypeBox), lista fechada de `type`, `derive`, `rule` e `roll.model`, e validador compartilhado entre cliente e servidor (§3.6).
3. Geração de `tokens.ts` (RN) e CSS vars a partir de `tokens.json`; tokens de estado, elevação, motion, breakpoints e borda (C-14).
4. Primitivos de valor com contrato de acessibilidade por tipo (C-02, C-03), começando por `RatingDots`, `NumberField`, `Resource`, `Track`, `Stepper`, `BottomSheet` e `Toast`.
5. Modos Leitura / Jogo / Evoluir no contexto da ficha (C-01).
6. `contrast.py` (Anexo A) no CI do DS: contraste, ΔE contra `action` e simulação de daltonismo para cada `accent-N` (C-13).

### Fase 2: ficha jogável no celular

1. **Renderizador data-driven único** (C-05), com **um template WoD e um template D&D 5e (SRD) como teste de aceitação** (§3.8).
2. Dock de combate + sheets de recurso, dano e detalhe (C-04, C-06, C-18).
3. Parada de dados com pelo menos dois modelos (`pool-success` e `sum-vs-target`) para provar a generalização (C-07).
4. Desfazer + histórico + sincronização local-first com indicador (C-01, C-08).
5. Regras de refluxo por `fontScale` e largura (C-09); header compacto + chips de seção (C-04).

### Fase 3: mesa e escala

1. Painel do narrador e leitura segura (C-19).
2. Web e tablet com coluna "Em jogo" sticky e breakpoints (C-10).
3. Criação de personagem, listas de crônicas e personagens, estados vazios, tema `pergaminho` e impressão (Anexo B, "Telas e estados que faltam").
4. Templates de CoC e Fate.
5. Testes com usuários (§10).

---

## 9. Segurança e privacidade por design

A avaliação é de UI/UX, mas várias decisões de interface têm consequência de segurança:

| Risco | Onde aparece | Controle recomendado |
|---|---|---|
| **IDOR / AuthZ no cliente** | modo leitura/edição, painel do narrador, sincronização de eventos | O modo da UI **não é** controle de acesso. O servidor valida cada escrita: o dono edita a própria ficha; o narrador (`chronicles.storyteller_id`) edita fichas **da crônica dele**; os demais só leem, se a crônica permitir. **Fail secure:** sem regra, nega. Testes automatizados de IDOR (jogador A editando a ficha do jogador B). |
| **Validação só no cliente** | tetos (Esferas ≤ Arete), limites, tipos | O mesmo validador gerado do template roda no servidor a cada escrita em `sheet_data`. Restrição no cliente é só conveniência. |
| **Execução de código via template** | fórmulas derivadas, regras, homebrew futuro | Lista fechada de nomes; nunca `eval`/`new Function`; template validado por schema e inserido só por perfil administrativo. |
| **Rolagem forjada** | "Rolar dados" | Rolagens que valem para a mesa são feitas no servidor; as locais usam `crypto.getRandomValues`. |
| **Vazamento de notas do narrador** | notas privadas por personagem | Não enviar ao cliente do jogador. Esconder na interface não basta. |
| **XSS no build web** | notas, nomes, rótulos do template | Renderizar sempre como texto; nunca interpolar string do banco em estilo ou HTML; cores só de `accent-N`. |
| **Exposição de IP a terceiros (LGPD)** | `@import` do Google Fonts | Hospedar as fontes no app (`expo-font`). |
| **Tokens no cache offline** | fila local-first | Tokens só no `expo-secure-store`; fila offline sem credenciais. |
| **Logs com PII** | histórico de alterações, instrumentação | Registrar autor, campo e valores numéricos; nunca conteúdo de notas; instrumentação sem PII. |
| **Abuso de escrita** | eventos de sincronização | Rate limiting por usuário e por ficha no endpoint de eventos. |
| **Gravação em testes com usuários** | checklist de validação | Consentimento por escrito, anotações sem nomes reais, nada de dados pessoais no relatório. |

---

## 10. Checklist de validação com usuários

O resumo vem do Anexo C, e a lista completa com metas está em "Checklist de validação".

- **Teste de tarefas moderado:** 5 participantes por persona (novato, veterano, narrador, baixa visão), com protótipo em Expo Go no aparelho do participante.
  - Metas: 2 de dano em ≤ 3 toques e ≤ 5s; parada em ≤ 3 toques sem ajuda; **zero alterações acidentais**.
- **Sessão real de jogo**, de 2–3 horas, com uma mesa de cada sistema.
- **Uma mão:** dados na outra mão; repetir com canhotos.
- **Pouca luz:** ~10 lux, brilho de 20–30%, zero leituras erradas.
- **Leitor de tela:** VoiceOver e TalkBack com a tela apagada. Meta: anúncio "Destreza, 2 de 5" e ≤ 10 gestos por tarefa.
- **Fonte grande:** máximo do sistema em 360, 390 e 430. Meta: nada cortado e dock utilizável.
- **Offline:** modo avião no meio da tarefa e conflito com a narradora. Meta: nenhuma perda.
- **Multi-sistema:** repetir 3 tarefas com uma mesa de D&D 5e e uma de CoC, com as mesmas metas, **sem tela específica do sistema**.

---

## 11. Limitações desta avaliação

- As alturas e posições foram calculadas a partir do CSS inline dos mockups. A avaliação de UX conferiu os números no protótipo renderizado, com diferença máxima de 7px.
  - Pelas estimativas, **Mago (≈3.290px) e Web (≈1.660px) passam da altura dos boards** (3.000 e 1.500). Vale conferir no canvas se a Vitalidade e a barra de ações aparecem.
- Contrastes e ΔE foram calculados por script (WCAG 2.x; CIEDE2000; simulação de daltonismo de Machado 2009, severidade 1.0). Os scripts ficaram fora do repositório. Recomenda-se versioná-los junto ao DS (Fase 1, item 6).
- Nenhum teste com usuários reais foi feito. Contagens de toques e cenários são *cognitive walkthroughs*, a validar pelo §10.
- O walkthrough V4 (Anexo C) usa "Destreza + Esquiva" porque "Esquiva" existe no mockup atual. Na V20 a tarefa equivalente seria Destreza + Esportes (C-11).
- Os artefatos foram tratados como conteúdo não confiável. Nenhum texto com instrução para IA foi encontrado. Os nomes de personagens, crônicas e narrador nas telas são fictícios.

---

# Anexos

Os anexos são os relatórios completos das três avaliações, sem edição de conteúdo. Os títulos foram rebaixados um nível para caber neste documento. Os IDs citados nas seções acima (`DS-xx`, `TL-xx`, `UX-xx`) estão aqui, com a localização exata no material, os trechos de código e as tabelas completas de medição.

## Anexo A: Design system "TMS Grimório" (relatório completo)


> Escopo: `README.md`, `tokens.json`, `design-system.json`, `components/bundle.css` e os 14 componentes (`README.md` + `preview.html`) do artefato baixado. Para checar a viabilidade em React Native, consultei sem editar `apps/frontend` e `packages/ui` do worktree `ui-ux-review` e os tipos do `react-native` 0.81.5 instalado.
> Os contrastes e as distâncias de cor foram calculados por script, sem estimativa a olho. Os scripts estão em `/private/tmp/claude-504/-Users-francisco-neto-Documents-tms/ed0c9a34-f0ff-4aea-8ae0-31d898c1643e/scratchpad/scripts-ds/` (`contrast.py`, `sugestoes.py`, `sugestoes_conjuntas.py`, `novos_tokens.py`, `tabelas_md.py`) e rodam com `python3 -I <script> <tokens.json>`.
> Sobre o material: não há texto com instruções para IA. Existem só os comentários `<!-- @dsCard ... -->` (metadados de cartão) e um comentário de composição no SVG da `Cover`, ambos inofensivos.

### Resumo

**Nota: 6/10.** A direção visual é forte e coerente: a ação (`ouro`) fica separada da identidade (`lineage`), a cor nunca é a única pista, a terminologia é a da edição brasileira e o conhecimento do domínio WoD é cuidadoso. Calculei os contrastes declarados e **todos são verdadeiros**: `ink` e `ink-muted` passam de 6.26:1 em todos os fundos, e as 42 linhagens passam de 3:1 nos três fundos dos dois temas. Ainda assim, não dá para implementar o DS em React Native sem tomar decisões que ele não tomou:
- os alvos de toque dos pontos têm **14×14px**, contra os 44px prometidos;
- não há estados (pressed, disabled, readonly, erro, loading) nem modo de edição;
- o leitor de tela não recebe o tipo de dano nem o valor dos rastreadores;
- nada prevê o aumento de fonte (fontScale);
- a paleta de 42 linhagens está fixa em CSS.

O ponto estrutural é este: a **camada base é WoD** (pontos, linhagem, `gnose`, `paradoxo`), e o TMS precisa suportar D&D, CoC, Fate/PbtA. Sem uma camada de primitivos agnósticos com skin por sistema, cada sistema novo vira componentes e tokens novos. A nota sobe para 8 quando os achados DS-01 a DS-06 forem resolvidos.

### O que está bem feito

- **Contraste verificado.** As afirmações do README e dos `usage` conferem com o cálculo:
  - `ink` vai de 13.38 a 18.08:1 e `ink-muted` de 6.26 a 7.53:1 sobre `bg`, `surface` e `surface-raised`, nos dois temas;
  - `on-ouro` sobre `ouro` dá 8.24:1 (noite) e 5.37:1 (pergaminho);
  - as 42 cores de linhagem ficam ≥ 3.24:1 em todos os fundos. O pior caso é `cla-tremere` sobre `surface-raised` no tema noite.
- **Paridade de temas.** Todo token de cor tem valor `noite` e `pergaminho` com o mesmo nome, e `lineage` é um alias. Procurei hex literal em `bundle.css` e nos previews e não encontrei nenhum: a regra "nenhum componente usa cor literal" é cumprida.
- **A cor nunca é a única pista**, e isso vale na prática:
  - o tipo de dano é forma (`/`, `X`, `✱`);
  - o bônus de forma é tracejado;
  - a `LineageMark` sempre traz o nome;
  - os números da roda de Quintessência são obrigatórios.
- **`paradoxo` e `gnose` "quase neutros" funcionam.** Contra as Tradições e as Tribos, o menor ΔE2000 é 13.6 (noite) e 15.6 (pergaminho) com visão normal, e fica ≥ 7.8 simulando protanopia ou deuteranopia. A promessa "nunca se confunde" se sustenta.
- **`ouro` como cor de ação** que não muda com a linhagem é um bom princípio (ver DS-08 para a exceção Ravnos).
- **Semântica nos previews.** Há `h2`/`h3`, `role="tablist"`/`tab` com `aria-selected`, `role="group"` com `aria-label`, `aria-pressed`, `role="img"` com `aria-label` nos pontos e na roda, e `aria-hidden` na lua decorativa.
- **Celular primeiro.** O token `hit-size` existe e Tabs, Button e FormSelector o respeitam (`min-height: 44px`). As abas somem a partir de 900px.
- **Domínio correto.** Estão certos:
  - os níveis e as penalidades de Vitalidade da V20;
  - os 15 Pontos de Sangue da 8ª geração;
  - Fúria e Gnose com caixas acima do permanente bloqueadas;
  - a soma Quintessência + Paradoxo ≤ 20, com a regra de transbordo;
  - o teto de Esferas pelo Arete;
  - os modificadores das formas Garou.
- **Cuidado jurídico.** Não há símbolos oficiais de clã copiados nem emoji.
- **`usage` em cada token**, com a intenção de uso. É a melhor documentação do pacote.
- **`tabular-nums`** está aplicado na coluna de penalidade.

### Achados

Cada achado traz uma linha **Multi-sistema:** que diz se a solução é genérica (core), se serve só para WoD ou se é específica de um sistema, e como ela generaliza.

#### DS-01: Alvos de toque de pontos e caixas muito abaixo dos 44px prometidos
- **Severidade:** Crítico
- **Onde:**
  - `components/bundle.css`: `.g-dot` (`width/height: var(--dot-size)` = 14px), `.g-dots{gap:6px}`, `button.g-dot{padding:0}`;
  - `.g-box` (22px), `.g-track{gap:4px}`, `.g-health-row{min-height:32px}`;
  - `README.md` ("Alvos de toque têm `hit-size` (44px) de altura");
  - `TraitDots/README.md` ("Área de toque da linha inteira: `hit-size`").
- **Problema:**
  - Cada ponto editável é um botão de **14×14px com passo de 20px**. Isso falha até o mínimo WCAG 2.2 **2.5.8 (24×24, AA)**, e a exceção de espaçamento não salva: círculos de 24px com centros a 20px se sobrepõem.
  - As caixas de Tracker, RageGnose e HealthTrack têm 22×22 com passo de 26px. Passam no 2.5.8 só pela exceção de espaçamento e falham nos 44px prometidos, nos 44pt do HIG e nos 48dp do Material.
  - "Área de toque da linha inteira" não é implementável: a linha tem de 5 a 10 alvos distintos, e a altura de 44px não aumenta a largura de cada ponto.
  - A linha de Vitalidade tem 32px.
- **Impacto para quem usa:** é a interação principal do app, feita no celular, à mesa, com pouca luz e no meio da cena. Um toque errado muda Força 3 para 4 sem aviso. Quem tem tremor ou dedos largos não consegue editar.
- **Solução proposta:** separar o tamanho visual da área de toque.
  - Tokens: `pip-size: 16`, `pip-hit-w: 32`, `hit-size: 44` e `box-size: 24`, com a caixa dentro de um alvo de 44×44 (ou 36×44 com `hitSlop`).
  - A conta fecha em 360dp: 5 × 32 = 160px de pontos, o que deixa 124px para o nome (360 − 2×16 de margem − 2×16 de padding do cartão − 160 − 12 de gap). "Conhecimentos" cabe.
  - Traços de 0 a 10 vão para uma segunda linha ou para o editor.
  - Para edição fina: tocar na linha abre um `BottomSheet` com pontos de 44px e um `Stepper`.

  ```tsx
  // packages/ui/src/RatingDots.tsx (esboço)
  import { Pressable, View } from 'react-native'
  import { useTokens } from './theme'

  type Props = { label: string; value: number; max?: number; editable?: boolean; onChange?: (v: number) => void }

  export function RatingDots({ label, value, max = 5, editable = false, onChange }: Props) {
    const t = useTokens()
    const set = (n: number) => onChange?.(n === value ? n - 1 : n) // tocar no último preenchido reduz
    return (
      <View
        accessible
        accessibilityRole={editable ? 'adjustable' : 'text'}
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max, now: value, text: `${value} de ${max}` }}
        accessibilityActions={editable ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
        onAccessibilityAction={e =>
          onChange?.(Math.max(0, Math.min(max, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
        style={{ flexDirection: 'row' }}
      >
        {Array.from({ length: max }, (_, i) => (
          <Pressable
            key={i}
            disabled={!editable}
            onPress={() => set(i + 1)}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={({ pressed }) => ({
              width: t.size.pipHitW, height: t.size.hit, alignItems: 'center', justifyContent: 'center',
              backgroundColor: pressed ? t.color.statePressed : 'transparent', borderRadius: t.radius.md,
            })}
          >
            <View style={{
              width: t.size.pip, height: t.size.pip, borderRadius: t.size.pip / 2, borderWidth: 1.5,
              borderColor: i < value ? t.color.accent : t.color.pipEmpty,
              backgroundColor: i < value ? t.color.accent : 'transparent',
            }} />
          </Pressable>
        ))}
      </View>
    )
  }
  ```
- **Esforço:** M
- **Multi-sistema:** genérico. Separar o visual do alvo de toque vale para qualquer pip ou caixa: death saves e spell slots de D&D, stress boxes de Fate, trilha de XP de PbtA, Corpus de Aparição. O editor em folha com `Stepper` é o mesmo que edita valores numéricos (D&D de 3 a 20, CoC em %).

#### DS-02: A camada base é WoD (princípios, primitivos e nomes de token)
- **Severidade:** Crítico. É uma decisão de arquitetura e precisa ser tomada antes de escrever o primeiro componente em `packages/ui`: depois, custa renomear tokens e reescrever APIs.
- **Onde:**
  - `README.md` > Princípios:
    - "Pontos são a linguagem. Todo traço de 0 a 5 (ou 10) aparece como `TraitDots`, nunca como número solto";
    - "a cor vem do personagem: cada sistema e cada raça";
    - "Gótico só nos títulos";
    - seção Termos.
  - `tokens.json`: `ouro`, `paradoxo`, `gnose`, `sis-*`, `cla-*`, `trad-*`, `tribo-*`, estilo `trait`.
  - `bundle.css`: `.g-dot.gnose`, `.g-box.gnose`, `.g-affinity`, `.g-forms`, `.g-moon`, `.g-wheel`.
  - Componentes RageGnose, Spheres, QuintessenceWheel, FormSelector e AugurMoon.
- **Problema:** os átomos do DS são conceitos de WoD. Faltam primitivos para:
  - número com modificador derivado (D&D: 15 → +2);
  - porcentagem com metade e quinto (CoC: 60 / 30 / 12);
  - escada com adjetivo (Fate: +3 "Bom");
  - número com sinal (PbtA: −1 a +3);
  - texto curto com marcação (aspectos de Fate, moves de PbtA);
  - toggle de proficiência (D&D);
  - recurso numérico grande (PV de D&D, de 1 a 300+).

  O princípio "nunca como número solto" é falso fora de WoD. Tokens com nome de mecânica (`gnose`, `paradoxo`) moram no core: cada sistema novo exigiria tokens e classes novos (`.g-box.pathos`, `.g-box.glamour`), inclusive Aparição e Changeling, que são WoD.
- **Impacto para quem usa:**
  - Quem desenvolve: cada sistema vira componentes e CSS novos, contra o objetivo do produto ("adicionar um sistema não deve exigir migration") e empurrando regra de jogo para o frontend.
  - Quem joga D&D ou CoC: recebe uma ficha WoD disfarçada, com pontos para valores de 3 a 20, ou nenhuma ficha.
- **Solução proposta:** três camadas, detalhadas em "Escalabilidade para outros sistemas".
  1. **Core agnóstico:** tokens semânticos e primitivos de valor (`RatingDots`, `NumberField`, `PercentField`, `Track`, `LeveledTrack`, `Resource`, `Pool`, `Clock`, `TextAspect`, `Choice`, `MarkToggle`, `Tags`, `Repeater`, `FieldRow`).
  2. **Skin por sistema:** fontes display e de voz, forma do pip, ornamentos, valores de `action` e `accent-alt`, glifos. O "Grimório" passa a ser a skin WoD.
  3. **Dados:** o template declara o tipo de cada campo, as regras e a fonte do `accent`.

  Renomeação de tokens (é barata agora):

  | Hoje | Proposto (core) | Valor na skin WoD |
  |---|---|---|
  | `ouro` / `on-ouro` | `action` / `on-action` | `#d9a441` / `#8a6414` (como hoje) |
  | `lineage` | `accent` (+ `on-accent`, `accent-text`) | derivado da linhagem (DS-03) |
  | `paradoxo`, `gnose` | `accent-alt` (segundo recurso de um par, quase neutro) | Mago: valores de `paradoxo`; Lobisomem: valores de `gnose` |
  | `sis-*`, `cla-*`, `trad-*`, `tribo-*` | saem do DS e vão para os dados (`accent_seed` no template) | – |
  | `dot-empty` | `pip-empty` | igual |
  | `line` / `line-strong` | `border-subtle` / `border-control` | igual |
  | estilo `trait` | `field-label` | igual |
  | estilo `quote` | `voice` | igual |
  | família `display` | `skin.display` | Grenze Gotisch |

  Princípios reescritos:

  | Princípio atual | Problema fora de WoD | Princípio proposto |
  |---|---|---|
  | "Pontos são a linguagem; nunca número solto" | D&D (3–20), CoC (1–99%), Fate (+0..+5) e PbtA (−2..+3) não cabem em pontos | "O valor aparece na notação nativa do sistema, declarada no template. O número está sempre disponível, visível ou para o leitor de tela." |
  | "A cor vem do personagem: cada sistema e cada raça tem a sua" | CoC e Fate não têm raça; D&D tem raça, classe e homebrew | "O `accent` é opcional e vem dos dados (linhagem, classe, ocupação ou escolha do jogador). Sem `accent`, a ficha usa o neutro da skin." |
  | "Gótico só nos títulos" | Faz sentido só em WoD | "A fonte display é da skin. Texto de leitura é sempre a sans do core." |
  | "Use os termos da edição brasileira" | Os termos são do sistema | "Rótulos vêm do template (i18n por sistema). O DS não contém termos de jogo." |
  | "Celular primeiro, mesa de jogo" | Já é genérico | Mantém |
- **Esforço:** G no todo. Feito antes da implementação, cai para renomear cerca de 10 tokens e definir as APIs dos primitivos.
- **Multi-sistema:** é o próprio achado. O resultado é genérico por construção, e WoD vira uma skin com alguns glifos.

#### DS-03: Paleta de linhagens fixa no CSS e nos tokens, sem vir dos dados
- **Severidade:** Alto
- **Onde:** `tokens.json` (42 tokens × 2 temas = 84 valores), `bundle.css` linhas 4–45 (42 seletores `[data-lineage="…"]`) e a lista de ids no `README.md`.
- **Problema:**
  - Cada linhagem nova exige um token, um seletor, a publicação do DS e uma release do app.
  - Só em WoD faltam dezenas: linhagens de sangue da V20, Fera, Convenções da Tecnocracia, Kiths de Changeling, Guildas de Aparição.
  - Os ids estão num namespace plano (`ravnos`, `fianna`) e vão colidir entre sistemas.
  - A regra "3:1 sobre surface" depende de alguém lembrar de checar.
- **Impacto para quem usa:** o Narrador que usa uma linhagem fora da lista recebe a cor do sistema, e o time precisa de um deploy para cada cor. Isso contraria o modelo de dados agnóstico (`trait_templates.template_data`).
- **Solução proposta:**
  - **Cor nos dados:** `template_data.lineages[] = { id: "vampiro.tremere", name: "Tremere", accent_seed: { h: 18, c: 0.17 } }`.
  - **Derivação por tema em OKLCH:** L = 0.70 no noite (faixa 0.66–0.85) e L = 0.48 no pergaminho (faixa 0.40–0.51), com croma reduzido até caber no gamut sRGB. O script (`contrast.py --section derived`) varreu todos os matizes com croma 0.15:
    - **L ≥ 0.64 (noite) e L ≤ 0.515 (pergaminho) garantem ≥ 4.5:1** nos três fundos;
    - L ≥ 0.545 e L ≤ 0.61 garantem 3:1.

    Exemplos de derivação:

    | Matiz | Noite | Pergaminho |
    |---|---|---|
    | H 25 (vermelho) | `#f47b74` (6.80:1) | `#a12f2f` (6.70:1) |
    | H 145 (verde) | `#61bd67` | `#02721c` |
    | H 265 (azul) | `#78a1ff` | `#3357b1` |
  - **Validação no servidor ao salvar o template** (todo input é hostil):
    - semente numérica dentro da faixa, ou hex que case com `^#[0-9a-fA-F]{6}$`;
    - contraste ≥ 4.5:1 depois da derivação;
    - ΔE2000 ≥ 10 contra `action`.

    Nunca interpole string livre do banco em estilo.
  - **Frontend:** um `ThemeProvider` calcula `accent` e `accent-text` e expõe o resultado por contexto e por `vars({ '--accent': … })` do NativeWind, que já está instalado (4.2.7).
  - **Ids com namespace** `sistema.linhagem`.

  ```ts
  // packages/ui/src/theme/accent.ts
  export function deriveAccent(seed: { h: number; c: number }, scheme: 'noite' | 'pergaminho') {
    const l = scheme === 'noite' ? 0.70 : 0.48
    return oklchToSrgbHex({ l, c: Math.min(seed.c, 0.16), h: seed.h }) // reduz croma até caber no gamut
  }
  ```
- **Esforço:** M
- **Multi-sistema:** genérico. O `accent` pode vir de qualquer fonte: clã, tribo, classe de D&D, playbook de PbtA, ocupação de CoC ou escolha do jogador. Sistemas sem linhagem (CoC, Fate) usam `accent-neutral`.

#### DS-04: Não há estados de interação nem modos de ficha
- **Severidade:** Alto
- **Onde:**
  - `bundle.css` tem só `.on`, `.fill`, `[aria-selected]`, `[aria-pressed]` e um `:focus-visible`. Não há `:active`, `:hover`, `:disabled`, `[aria-disabled]`, `[aria-readonly]`, `[aria-busy]` nem estado de erro.
  - Regras de README sem CSS correspondente:
    - Spheres: "pontos acima do Arete ficam desabilitados";
    - RageGnose: "caixas acima do permanente ficam tracejadas", feito no preview com `style` inline `border-color:var(--line)`;
    - FormSelector: "pontos comprados que a forma tira ficam com contorno tracejado neutro" e "0 na forma".
  - Button tem só `primary` e o padrão: sem disabled, loading, destrutivo, ícone ou tamanhos.
- **Problema:**
  - Pontos editáveis e somente leitura são idênticos; a única diferença é `cursor: pointer` na Web.
  - Não há feedback de pressed no toque.
  - Não existem disabled, erro, carregando ou vazio.
  - O anel de foco `ouro` em volta do botão `ouro` se confunde com o próprio botão.
- **Impacto para quem usa:**
  - Ao rolar uma ficha com dezenas de pontos tocáveis, o jogador edita sem perceber.
  - Quem abre a ficha de outra pessoa não sabe se pode editar.
  - Sem estado de erro ou sincronização, uma edição feita na sessão pode se perder em silêncio.
- **Solução proposta:**
  - **Modo explícito no contexto da ficha:** `mode: 'view' | 'play' | 'edit'`.
    - `view`: nada é tocável.
    - `play`: só recursos consumíveis são tocáveis (Tracker, Vitalidade, pools).
    - `edit`: tudo é tocável, com uma barra "Editando · Concluir" e um toast "Desfazer".
  - **Tokens de estado** (contraste conferido em `novos_tokens.py`):

    | Token | noite | pergaminho | Contraste |
    |---|---|---|---|
    | `danger` | `#f2726a` | `#b3261e` | ≥ 5.63:1 nos três fundos |
    | `on-danger` | `#1a0a0a` (6.77:1) | `#ffffff` (6.54:1) | – |
    | `success` | `#6cc287` | `#1f7a3d` | ≥ 4.63:1 |
    | `ink-disabled` | `#7a6d72` | `#958a8e` | isento de contraste |
    | `state-hover` | `rgba(239,230,225,.06)` | `rgba(28,20,23,.04)` | – |
    | `state-pressed` | `rgba(239,230,225,.12)` | `rgba(28,20,23,.08)` | – |
    | `scrim` | `rgba(8,5,6,.64)` | `rgba(28,20,23,.40)` | – |

    No pergaminho, `danger` fica a ΔE 3.5 de `tribo-garras-vermelhas` e a 3.9 de `cla-brujah`. Por isso o perigo sempre leva rótulo e ícone e aparece em diálogo, nunca como cor solta.

  ```css
  @media (hover:hover){ .g-btn:hover,.g-form:hover,.g-tab:hover{background:var(--state-hover)} }
  .g-btn:active,.g-form:active,.g-tab:active,button.g-dot:active,button.g-box:active{background:var(--state-pressed)}
  .g-btn:disabled,.g-btn[aria-disabled="true"]{color:var(--ink-disabled);border-color:var(--line);background:transparent;cursor:not-allowed}
  .g-btn[aria-busy="true"]{pointer-events:none}
  .g-btn.danger{background:var(--danger);border-color:var(--danger);color:var(--on-danger)}
  .g-dot[aria-disabled="true"],.g-box[aria-disabled="true"]{border-style:dashed;border-color:var(--line-strong)}
  .g-dot.lost{border-style:dashed;border-color:var(--ink-muted)}
  .g-btn.primary:focus-visible{outline-color:var(--ink)} /* anel distinto do fundo ouro */
  [data-mode="view"] .g-dot,[data-mode="view"] .g-box{pointer-events:none}
  ```
- **Esforço:** M
- **Multi-sistema:** genérico. Os modos servem para qualquer ficha: PV de D&D em `play`, atributos em `edit`. `disabled`/`lost` cobrem tetos por nível (spell slots acima do nível do personagem) e perícias bloqueadas.

#### DS-05: Semântica acessível incompleta para leitor de tela
- **Severidade:** Alto
- **Onde:**
  - `Tracker/preview.html`: caixas são `span` sem role nem label, e "9 / 15" aparece só no `h3`.
  - `HealthTrack/preview.html` + `bundle.css` `.g-box.b/.l::before/::after`: o tipo de dano é desenhado com `content:""`, invisível para tecnologia assistiva. Só o agravado tem `content:"\2731"`, lido como "asterisco pesado".
  - `TraitDots`, `TraitRow` e `Spheres`: `aria-label="3 de 5"` sem o nome do traço.
  - `TraitDots/README.md`: "cada ponto rotulado 'Inteligência 3 de 5'" deixa o rótulo igual em todos os pontos.
  - `FormSelector`: `aria-pressed` numa escolha única.
  - `Tabs`: sem `aria-controls`, `tabpanel`, roving tabindex ou navegação por setas.
  - `bundle.css` linha 122: o `:focus-visible` não inclui `.g-form`.
- **Problema / Impacto para quem usa:**
  - Quem usa VoiceOver ou TalkBack não descobre a Vitalidade nem o tipo de dano, que é a informação mais importante em combate.
  - Ouve "3 de 5, imagem" sem saber de qual traço.
  - Para editar, precisa achar 5 botões com o mesmo rótulo.
  - O FormSelector é anunciado como 5 toggles independentes.
- **Solução proposta:** o RN 0.81 instalado aceita `role` e `aria-*`, conferido nos tipos. Mapeamento:

  | Componente | Web | React Native |
  |---|---|---|
  | RatingDots / Tracker editáveis | `role="slider"`, `aria-valuemin/max/now`, `aria-valuetext="3 de 5"`, `aria-label="Inteligência"` | `accessibilityRole="adjustable"`, `accessibilityValue`, ações `increment`/`decrement` (DS-01) |
  | HealthTrack | lista; cada nível `aria-label="Machucado, penalidade −1, dano letal"`; resumo antes: "Vitalidade: Ferido, −1; 1 contusivo, 1 letal, 1 agravado" | o mesmo, com `accessibilityLabel` por linha e um resumo `accessibilityRole="summary"` |
  | FormSelector | `role="radiogroup"` + `role="radio"` + `aria-checked` | `accessibilityRole="radio"`, `accessibilityState={{ checked }}` |
  | Tabs | `aria-controls` + `role="tabpanel"` + setas | `accessibilityRole="tab"`, `accessibilityState={{ selected }}` |
  | SectionHeader | `h2` | `accessibilityRole="header"` |
  | Foco | `.g-form:focus-visible` na lista da linha 122 | `outlineColor/outlineWidth/outlineOffset`, presentes no RN 0.81, aplicados em `onFocus` para Web e teclado físico |
- **Esforço:** M
- **Multi-sistema:** genérico. O contrato "um controle ajustável com rótulo, valor, mínimo e máximo" serve para pontos, número (D&D), porcentagem (CoC) e recursos. Estados de caixa nomeados ("letal", "agravado") generalizam para stress de Fate e condições de PbtA, com os nomes vindos do template.

#### DS-06: Texto dinâmico (Dynamic Type / fontScale) não previsto
- **Severidade:** Alto
- **Onde:**
  - `tokens.json` > `type`: tudo em `px` fixo, `lineHeight` em px e `letterSpacing: 0.14em`.
  - `bundle.css`:
    - `.g-wheel` (208×208, com texto no miolo);
    - `.g-forms` (5 colunas fixas);
    - `.g-health-row{min-height:32px}`;
    - `.g-pen{width:28px}`;
    - `.g-form small` e `.g-wheel-l` em 11px.
- **Problema:** nada diz como o layout reage a 130–200% de fonte. No RN, `allowFontScaling` vem ligado por padrão. Estimativas a partir do CSS:
  - **Roda de Quintessência:** o rótulo "QUINTESSÊNCIA" (11px, caixa alta, 0.14em) ocupa uns 110px num miolo de uns 150px, e encosta nas casas a partir de ~1.35×.
  - **FormSelector em 360dp:** sobram uns 55px úteis por botão, e "Hominídeo" em 13px bold já ocupa quase isso em 1.0×.
  - **`.g-pen` de 28px** corta "−5" em escalas maiores.
  - **11px** fica abaixo do próprio `caption` (13px).
- **Impacto para quem usa:** pessoas com baixa visão, e muitos jogadores mais velhos, aumentam a fonte e a ficha quebra ou se sobrepõe. Ou então o time desliga o `allowFontScaling` e exclui esse público.
- **Solução proposta:**
  - **Tokens de tipo para RN:** número em dp e `lineHeight` como razão (title 1.3, body 1.45, label 1.33). Piso de 12px.
  - **Regras de refluxo:**
    1. `TraitRow` empilha o nome sobre os pontos com `fontScale ≥ 1.3`.
    2. `FormSelector` vira lista vertical de rádios com `fontScale ≥ 1.2` ou largura < 360.
    3. Na roda, número e rótulo saem do miolo e vão para uma linha abaixo com `fontScale > 1.15`.
    4. `maxFontSizeMultiplier={1.3}` só nos rótulos decorativos em caixa alta, nunca em texto de leitura.
  - Testar 100%, 135% e 200% no checklist de PR.

  ```tsx
  const { fontScale, width } = useWindowDimensions()
  const stacked = fontScale >= 1.3 || width < 360
  ```
- **Esforço:** M
- **Multi-sistema:** genérico. É ainda mais crítico fora de WoD: as listas de perícias de D&D ("Persuasão (Car) +5") e CoC ("Usar Bibliotecas 45 · 22 · 9") têm rótulos longos e três colunas numéricas.

#### DS-07: Categorias de token faltando, e CSS que não consome os tokens de tipo
- **Severidade:** Médio
- **Onde:**
  - `tokens.json` tem só `color`, `type`, `spacing`, `radius` e `size`. `type.fonts` é `[]`.
  - Faltam: elevação, motion, camadas (z-index), breakpoints (só em prosa no README, com a faixa de 600 a 899 sem definição), espessura de borda (1, 1.5 e 2px estão hardcoded), cores de estado e `scrim`.
  - `bundle.css` repete os valores de tipo em px (`.g-trait-name{font-size:16px;line-height:22px}`) em vez de referenciar os tokens.
  - Valores fora da escala: gap 6px, padding 18px, 2px, 28px, 32px, 10px, 11px, 22px, 30px, 208px.
- **Problema:** as superfícies se separam só por cor e quase não se distinguem.

  | Par de superfícies | noite | pergaminho |
  |---|---|---|
  | `bg` × `surface` | 1.06:1 | 1.10:1 |
  | `surface` × `surface-raised` | 1.09:1 | 1.06:1 |

  No pergaminho, uma folha (`#ffffff`) sobre um cartão (`#faf8f8`) fica invisível sem borda ou sombra.
- **Impacto para quem usa:** cada dev inventa a própria sombra, z-index e animação. Bottom sheets e menus somem no tema claro, e as animações ignoram o "reduzir movimento".
- **Solução proposta:**
  - **Elevação.** O RN 0.81 aceita `boxShadow` em string, conferido nos tipos.
    - `elevation-1` (cartão): borda 1px `border-subtle` + `0 1px 2px rgba(0,0,0,.24)` no noite / `0 1px 2px rgba(28,20,23,.08)` no pergaminho.
    - `elevation-2` (folha): `0 -4px 16px rgba(0,0,0,.40)` no noite / `0 -2px 12px rgba(28,20,23,.14)` no pergaminho, com borda superior `border-subtle`.
  - **Motion:**
    - `duration-fast 120ms`, `duration-base 200ms`, `duration-slow 320ms`;
    - `easing-standard cubic-bezier(.2,0,0,1)`, `easing-exit cubic-bezier(.3,0,1,1)`;
    - com "reduzir movimento" ligado (`useReducedMotion` do Reanimated 4, já instalado), a duração vai a 0 e não há deslocamento.
  - **Camadas:** `layer-sticky 10`, `layer-sheet 100`, `layer-dialog 200`, `layer-toast 300` na Web. No RN a ordem é estrutural, via Portal.
  - **Breakpoints:**
    - `compact 0–599`: uma coluna;
    - `medium 600–899`: uma coluna com largura máxima de 640 e cartões com mais respiro;
    - `expanded ≥ 900`: duas colunas, sem abas.
  - **Borda:** `border-hair 1`, `border-control 1.5`, `border-focus 2`.
  - **Espaçamento:** `space-0.5 2`, `space-1.5 6` (ou trocar o 6 por 8), `space-5 20`, `space-10 40`, `space-12 48`.
  - Gerar as CSS vars e o `tokens.ts` do RN a partir do `tokens.json` (Style Dictionary ou um script), e fazer o CSS referenciar os tokens.
- **Esforço:** M
- **Multi-sistema:** genérico (core). Nenhum desses tokens depende de sistema.

#### DS-08: Linhagens confundíveis entre si, com a cor do sistema e com a cor de ação
- **Severidade:** Médio
- **Onde:** `tokens.json`, `README.md` ("Várias linhagens têm matiz parecido (Tremere e Brujah, Gangrel e Ministério)" e "`ouro` … nunca muda com a linhagem").
- **Problema:** distâncias CIEDE2000 calculadas. Em pontos de 14px, ΔE abaixo de 5 é praticamente a mesma cor. Simulação de daltonismo pelo método de Machado (2009), severidade 1.0.

  | Par | ΔE normal (noite / pergaminho) | Pior caso simulado |
  |---|---|---|
  | `cla-tremere` × `sis-vampiro` | 1.7 / 1.7 | 1.5 |
  | `tribo-crias-de-fenris` × `tribo-garras-vermelhas` | 5.6 / 4.6 | deutan 0.8 / 0.0 |
  | `cla-ravnos` × `ouro` | 4.7 / 1.7 | – |
  | `tribo-peregrinos-silenciosos` × `ouro` | 5.9 / 2.7 | – |
  | `trad-ordem-de-hermes` × `sis-mago` | 8.9 / 7.6 | deutan 1.5 (pergaminho) |
  | `trad-ordem-de-hermes` × `trad-virtualidade` | 15.2 / 10.9 | protan 0.9 (noite), deutan 0.4 (pergaminho) |
  | `cla-malkavian` × `cla-ventrue` | 18.5 / 15.2 | protan 1.3 (noite), deutan 1.8 (pergaminho) |
  | `cla-banu-haqim` × `cla-caitiff` | 38.9 / 36.3 | deutan 0.7 (pergaminho) |
  | `cla-gangrel` × `cla-ravnos` | 20.7 / 19.3 | protan 1.4 (pergaminho) |

  Três leituras da tabela:
  - **Tremere é idêntico ao "Vampiro sem clã".**
  - **Na ficha Ravnos, botão primário e pontos têm a mesma cor**, o que contradiz a regra de que `ouro` não é cor de linhagem.
  - Os pares que o README cita não são os piores: Tremere × Brujah dá 15.7 / 11.2 e Gangrel × Ministério dá 14.9 / 13.3.

  A busca automática (`sugestoes_conjuntas.py`) não encontra paleta com 14 clãs + sistema + `ouro` que mantenha ΔE ≥ 10 sob protanopia e deuteranopia. Cor não identifica linhagem, o que confirma a regra "sempre com nome".
- **Impacto para quem usa:** a lista de personagens da crônica e o painel do Narrador são escaneados por cor. Na ficha Ravnos, ação e dado se confundem.
- **Solução proposta:**
  1. Personagem sem linhagem usa `accent-neutral` (`#ab9c9f` / `#5e5156`, ≥ 6.26:1), e não a cor do sistema. Isso resolve Tremere sem mexer no clã.
  2. Regra validada: ΔE2000 ≥ 10 entre qualquer `accent` e `action`, com visão normal e simulada. Ravnos e Peregrinos saem da faixa de matiz do ouro (OKLCH H 60–95). Opções calculadas, com o mesmo matiz nos dois temas e ≥ 4.5:1:
     - Ravnos: H 321 → `#d8a5e1` / `#875990`, ou H 267 → `#9db8fb` / `#536aa7`;
     - Peregrinos: H 246 → `#73b0e5` / `#306c9d`. Esta opção ainda fica a ΔE 4.2 de outra tribo, aceitável só porque o nome sempre acompanha a cor.
  3. Crias de Fenris como "ferro" de baixo croma: `#aa7a7c` / `#6b414b` (ΔE mínimo de 10.8 / 10.0 contra a tribo, o sistema e o ouro).
  4. Segunda pista não cromática na `LineageMark` e nos avatares da lista: iniciais ou monograma.
  5. Rodar `contrast.py --section cvd` no CI do DS.
- **Esforço:** P para trocar os valores; M para a validação automática.
- **Multi-sistema:** genérico. A mesma validação vale para classes de D&D (12), playbooks de PbtA e cores escolhidas pelo jogador. Sistemas sem linhagem usam o neutro.

#### DS-09: `lineage` vaza para fora da ficha e é usada como texto sem garantia de 4.5:1
- **Severidade:** Médio
- **Onde:**
  - `tokens.json`: `lineage = {sis-vampiro}` como valor global.
  - `bundle.css`: `.g-tab[aria-selected="true"]{border-bottom-color:var(--lineage)}`, `.g-section-h::after` e `.g-affinity{color:var(--lineage)}`.
  - `usage` de `ouro`: "aba ativa sem linhagem".
  - `usage` de `surface-raised`: "a aba ativa".
- **Problema:**
  - Fora de uma ficha (lista de crônicas, configurações), abas e réguas ficam vermelho-Vampiro, contra o princípio "a única cor forte na tela é a lineage do personagem aberto".
  - O CSS ignora "aba ativa sem linhagem usa ouro" e "aba ativa em `surface-raised`".
  - `.g-affinity` pinta texto de 13px com a linhagem, mas a regra garante só 3:1. **5 de 42 linhagens ficam abaixo de 4.5:1 no noite** (pior fundo): `cla-tremere` 3.24, `sis-vampiro` 3.43, `tribo-garras-vermelhas` 3.96, `tribo-crias-de-fenris` 4.03, `cla-brujah` 4.27. Hoje só Mago usa a classe, e todas as Tradições passam, mas a classe é genérica.
- **Impacto para quem usa:** a tela fora da ficha parece "de Vampiro" para um jogador de Lobisomem. Um rótulo de texto em linhagem pode ficar ilegível.
- **Solução proposta:**

  ```css
  :root{--accent:var(--accent-neutral)}
  .g-tab[aria-selected="true"]{border-bottom-color:var(--accent,var(--action));background:var(--surface-raised)}
  .g-affinity{color:var(--accent-text)}
  ```

  `accent-text` é derivado com L ≥ 0.64 no noite. Valores calculados, todos ≥ 4.5:1 nos três fundos:
  - `sis-vampiro` → `#ef4b5c`
  - `cla-tremere` → `#f1455c`
  - `tribo-crias-de-fenris` → `#da6143`
  - `tribo-garras-vermelhas` → `#ed5045`

  Alternativa: rótulo em `ink` com um marcador em `accent`.
- **Esforço:** P
- **Multi-sistema:** genérico. Qualquer badge em `accent` (proficiência em D&D, "ocupacional" em CoC) usa `accent-text`.

#### DS-10: Tipografia, implementação em RN, carregamento de fontes e uso do blackletter
- **Severidade:** Médio
- **Onde:**
  - `bundle.css` linha 1: `@import` do Google Fonts com Grenze 500/600/700, Alegreya Sans 400/500/700/400i e Cormorant 500i, ou seja, 8 arquivos.
  - `tokens.json` > `type.families` (pilhas de fallback) e `letterSpacing: 0.14em`.
  - `.g-wheel-n` com `--font-display` e `tabular-nums`.
  - `display-xl` (34px) para o nome do personagem.
  - `quote` em 18px, Cormorant itálico 500.
- **Problema:**
  1. No RN não existe pilha de fallback, e o Android não sintetiza peso de fonte customizada. Cada peso precisa de um `fontFamily` próprio (ex.: `AlegreyaSans_700Bold`); um token com só `fontWeight` não funciona.
  2. `em` não existe no RN: `letterSpacing` é em pontos (12 × 0.14 = 1.68).
  3. Na Web, o `@import` do Google Fonts bloqueia a renderização, não tem SRI e **envia o IP de cada usuário ao Google**. É ponto de atenção para a LGPD (transparência e base legal).
  4. A Grenze 500 é baixada e nenhum token a usa (`display-xl` é 700, `display-lg` é 600).
  5. A Grenze nos números da roda contraria o "Gótico só nos títulos". Algarismos blackletter são os menos legíveis, e não há garantia de que a fonte tenha `tnum`.
  6. O nome do personagem é texto livre em blackletter de 34px. Nomes longos ou estrangeiros ficam difíceis de ler e quebram em 2 ou 3 linhas em 360dp, e não há regra de quebra.
  7. A Cormorant Garamond tem x-height pequena e hastes finas: o itálico 500 em 18px sobre fundo escuro se lê como uns 14px. A cor (`ink`) passa no contraste, mas a legibilidade cai.
- **Impacto para quem usa:** pesos errados ou fonte de sistema no Android, flash de fonte e privacidade na Web, e nome e citação difíceis de ler para quem tem dislexia ou baixa visão.
- **Solução proposta:**
  1. Gerar `type.native.ts` com `fontFamily` resolvido por peso.
  2. `letterSpacing` em px.
  3. Hospedar as fontes no próprio app com `expo-font` (já vem como dependência do Expo), via `@expo-google-fonts/*` ou arquivos no repositório. Na Web, `font-display: swap` e preload dos 2 pesos críticos.
  4. Remover a Grenze 500: 8 arquivos viram 7.
  5. `.g-wheel-n` em `sans` 700 com `tabular-nums`.
  6. Nome com `numberOfLines={2}`, e `adjustsFontSizeToFit` com `minimumFontScale={0.75}`. Opção de acessibilidade "Títulos sem gótico", que troca display por sans 700.
  7. `quote` em 20/28 peso 600, ou Alegreya Sans itálico.
- **Esforço:** M
- **Multi-sistema:** as fontes display e de voz são da skin (Grenze para WoD; D&D e CoC teriam as suas). Carregamento, um peso por família e a opção "títulos sem display" são core.

#### DS-11: HealthTrack usa toque cíclico e não aplica a regra de empilhamento
- **Severidade:** Médio
- **Onde:** `HealthTrack/README.md` ("Tocar na caixa avança vazio → contusivo → letal → agravado → vazio") e o preview.
- **Problema:**
  - Corrigir de letal para vazio exige 2 toques, e um toque acidental troca o tipo de dano.
  - A regra da V20 fica na cabeça do jogador: o dano mais grave ocupa as primeiras caixas, e contusivo numa trilha cheia vira letal.
  - A caixa tem 22px (ver DS-01).
- **Impacto para quem usa:** um erro de dano em combate pode matar ou salvar o personagem indevidamente, e o jogador novo não conhece a regra.
- **Solução proposta:**
  - O HealthTrack vira um display com ações: "+ Contusivo", "+ Letal", "+ Agravado" e "Curar", numa folha com quantidade.
  - As ações aplicam a regra declarada no template (`rules.damage: "wod-stacking"`).
  - Um toque na linha abre a folha, seguido do toast "1 letal aplicado · Desfazer".
  - A penalidade atual aparece em destaque no topo.
- **Esforço:** M
- **Multi-sistema:** o visual é o primitivo genérico `LeveledTrack` (linhas com rótulo, modificador e estado nomeado). Em D&D serve para os níveis 1 a 6 de exaustão (rótulo = efeito) e para os death saves (2 linhas × 3 caixas). Em Fate, para stress e consequências. A regra de empilhamento é específica de WoD e vem do template, não do componente.

#### DS-12: FormSelector com bônus tracejado frágil, texto de 11px e estados sem CSS
- **Severidade:** Médio
- **Onde:** `bundle.css` `.g-dot.mod` (borda tracejada de 1.5px num círculo de 14px), `.g-form small{font-size:11px}`, `.g-forms` (grid de 5 colunas) e `FormSelector/README.md`.
- **Problema:**
  - O tracejado de 1.5px num círculo de 14px vira uns 5 traços que, com antialiasing, parecem contorno contínuo. A diferença entre ponto comprado, bônus da forma e ponto vazio depende de um detalhe quase invisível.
  - No RN, `borderStyle: 'dashed'` com `borderRadius` renderiza de forma inconsistente entre plataformas. O caminho confiável é SVG com `strokeDasharray`, e `react-native-svg` não está instalado.
  - "Pontos tirados pela forma" e "0 na forma" não têm classe.
  - 11px fica abaixo do piso.
  - `aria-pressed` é usado numa escolha única (ver DS-05), e falta `:focus-visible`.
- **Impacto para quem usa:** em Crinos, a pessoa não sabe quanto do valor é dela e quanto é da forma, e erra a parada de dados.
- **Solução proposta:**
  - Bônus: ponto meio preenchido ou anel duplo, de 16px, em `accent`.
  - Ponto perdido: traço diagonal em `ink-muted`.
  - A legenda textual ("3 + 4 da forma") continua obrigatória.
  - API genérica: `RatingDots` recebe `segments: [{ kind: 'base', n: 3 }, { kind: 'bonus', n: 4 }, { kind: 'lost', n: 1 }]`.
  - Descrição curta em 12px. Abaixo de 360dp ou com `fontScale ≥ 1.2`, o seletor vira lista vertical.
- **Esforço:** M
- **Multi-sistema:** genérico. "Valor base + modificador temporário" existe em D&D (Cinto de Força do Gigante, Fúria do bárbaro, condições), CoC (penalidades) e Fate (impulsos). O seletor de formas é um `Choice` com `modifiers` declarados no template, e o mesmo componente faz a Forma Selvagem do druida.

#### DS-13: AugurMoon com lua nova invisível e desenho que depende do fundo
- **Severidade:** Baixo
- **Onde:** `bundle.css` `.g-moon` / `.g-moon::after`; `AugurMoon/preview.html` (`--shadow:0%`).
- **Problema:**
  - Com `--shadow:0%`, a "sombra" (cor `surface`) cobre o disco inteiro, e Ragabash vira um vazio sem contorno.
  - Sobre `surface-raised` (uma folha), a sombra aparece como um disco escuro.
  - Deslocar um círculo cheio só produz crescentes: não há meia-lua de terminador reto nem gibosa.
- **Impacto para quem usa:** a linha Ragabash parece quebrada, e a lua muda de aparência conforme o fundo.
- **Solução proposta:** desenhar a lua em SVG, com contorno `line-strong` de 1.5px e o terminador como elipse; manter `aria-hidden`. No RN: `npx expo install react-native-svg`.
- **Esforço:** P
- **Multi-sistema:** específico de Lobisomem. Deve ser um glifo da skin WoD plugado no slot `leading` de um `FieldRow` genérico, e não um componente do core.

#### DS-14: QuintessenceWheel com controles −/+ documentados mas ausentes, e geometria fixa
- **Severidade:** Baixo
- **Onde:** `QuintessenceWheel/README.md` ("Edição por botões −/+ abaixo da roda"); o preview (20 `span` com `left`, `top` e `--a` inline); `.g-wheel` (208px) e `.g-seg` (18px).
- **Problema:**
  - Os botões não existem.
  - A geometria foi calculada à mão em px.
  - A regra "ganhar Paradoxo com a roda cheia consome Quintessência" não tem feedback.
  - `role="img"` impede editar pelo leitor de tela.
- **Impacto para quem usa:** não há como editar a roda no preview, e a regra acontece sem que o jogador perceba.
- **Solução proposta:** um componente `Clock` genérico (N segmentos, até 2 preenchimentos opostos), em SVG, com o raio derivado do tamanho. A edição usa dois `Stepper` com `adjustable`, e um toast avisa quando o Paradoxo consome Quintessência.
- **Esforço:** M
- **Multi-sistema:** generaliza como `Clock`: relógios de progresso de PbtA e Blades (4/6/8 segmentos), harm clock do Apocalypse World e contadores de cena do Narrador. A regra de transbordo vem do template.

#### DS-15: Inconsistências entre o README e a implementação
- **Severidade:** Baixo
- **Onde / Problema:**

  | Regra declarada | O que a implementação faz |
  |---|---|
  | README: "`title`: grupo dentro da seção (Físicos, Talentos)" | Os grupos usam `.g-group-h` (estilo `label`, 12px caixa alta). `title` (17px) não aparece em nenhum seletor. |
  | Tracker/README: "mostre o número em `caption` ao lado" | O preview põe o número dentro do `h3.g-group-h`. |
  | README e RageGnose/README: números com `tabular-nums` | `.g-group-h`, que contém "4 / 6", não tem `font-variant-numeric`. |
  | `usage` de `bg`: "Nunca recebe texto pequeno direto sem surface por cima" | Tabs, Tracker, RageGnose, FormSelector e LineageMark põem texto direto em `bg`. O contraste passa; a regra é que fica ambígua. |
  | `usage` de `surface-raised`: "a aba ativa"; de `ouro`: "aba ativa sem linhagem" | A aba ativa não tem fundo e usa sempre `lineage` (DS-09). |
  | "Gótico só nos títulos" | `.g-wheel-n` usa `--font-display`. |
  | "uma coluna até 600px, duas a partir de 900px" | A faixa de 600 a 899 não está definida. |
  | "Use os termos da edição brasileira", "V20 primeiro" | Ids e nomes são da V5 (Banu Haqim, Hecata, Ministério). Na V20 são Assamitas, Giovanni e Seguidores de Set, que só aparecem entre parênteses no `usage`. |
  | `line-strong`: "3:1 sobre surface nos dois temas" | É verdade, mas no pergaminho sobre `bg` dá **3.04:1**, e `dot-empty` dá 3.17:1. É pouca margem para um traço de 1.5px com antialiasing. |

  Conferidos e verdadeiros: `ink`/`ink-muted` ≥ 4.5:1 em todos os fundos; linhagens ≥ 3:1; "nenhum componente usa cor literal".
- **Impacto para quem usa:** quem implementa segue o README, quem revisa segue o preview, e o resultado diverge.
- **Solução proposta:**
  - Corrigir doc ou CSS item a item.
  - No pergaminho, `line-strong` passa a `#86797f` e `dot-empty` a `#86797e` (3.58:1 sobre `bg`, 3.93:1 sobre `surface`).
  - Escolher entre a nomenclatura V20 e a V5 e registrar a escolha no template.
- **Esforço:** P
- **Multi-sistema:** os itens de terminologia vão para o template (i18n por sistema). O restante é core.

#### DS-16: A base do repositório ainda não está alinhada ao DS
- **Severidade:** Baixo
- **Onde:**
  - `packages/ui/src/Button.tsx`: `#007AFF`, `#E5E5EA`, `borderRadius: 8`, sem `minHeight: 44`, `TouchableOpacity` sem rótulo acessível próprio.
  - `packages/ui/package.json`: `peerDependencies` com react `^18` e react-native `^0.76`, enquanto o catálogo usa react 19.1.0 e react-native 0.81.4.
  - `apps/frontend/app.json`: `userInterfaceStyle: "light"` e splash `#ffffff`.
  - `react-native-svg` não está instalado.
- **Problema / Impacto para quem usa:**
  - O padrão é o tema `noite`, mas o app força o claro: status bar, alertas e teclado aparecem claros sobre fundo escuro.
  - O splash branco pisca antes de uma tela escura, o que incomoda numa mesa à noite.
  - O Button atual não usa nenhum token.
- **Solução proposta:**
  - `userInterfaceStyle: "automatic"` e splash `backgroundColor: "#120e10"` (o `bg` do noite).
  - Gerar `packages/ui/src/tokens.ts` a partir do `tokens.json`.
  - Atualizar as `peerDependencies`.
  - `npx expo install react-native-svg`, necessário para `Clock`, a lua e os pips tracejados.
- **Esforço:** P
- **Multi-sistema:** genérico.

### Tabela de contraste

Razões WCAG 2.x calculadas por `contrast.py` (luminância relativa sRGB). Valores em **negrito** ficam abaixo do mínimo da coluna. Fundos:

| Token | noite | pergaminho |
|---|---|---|
| `bg` | `#120e10` | `#f1edee` |
| `surface` | `#1b1518` | `#faf8f8` |
| `surface-raised` | `#251d21` | `#ffffff` |

#### Tokens base

| Tema | Cor (token, hex) | Uso | Exigido | sobre `bg` | sobre `surface` | sobre `surface-raised` | Resultado |
|---|---|---|---|---|---|---|---|
| noite | `ink` #efe6e1 | Texto principal | 4.5:1 | 15.58 | 14.63 | 13.38 | passa |
| noite | `ink-muted` #ab9c9f | Rótulos, especializações, abas inativas | 4.5:1 | 7.29 | 6.84 | 6.26 | passa |
| noite | `line-strong` #7d6a71 | Borda de controle, caixa vazia | 3.0:1 | 3.81 | 3.57 | 3.27 | passa |
| noite | `dot-empty` #857379 | Contorno do ponto vazio | 3.0:1 | 4.31 | 4.05 | 3.70 | passa |
| noite | `ouro` #d9a441 | Botão primário, anel de foco (não texto) | 3.0:1 | 8.52 | 8.00 | 7.32 | passa |
| noite | `paradoxo` #d8e6f2 | Casa de Paradoxo | 3.0:1 | 15.07 | 14.16 | 12.94 | passa |
| noite | `gnose` #e6e0c8 | Gnose, lua do augúrio | 3.0:1 | 14.47 | 13.59 | 12.43 | passa |
| noite | `line` #3a2e33 | Divisória (decorativa) e caixa tracejada indisponível | 3.0:1 | **1.48** | **1.39** | **1.27** | falha (decorativo/inativo, isento) |
| noite | `on-ouro` #1a1205 sobre `ouro` | Texto do botão primário | 4.5:1 | – | – | – | 8.24:1 passa |
| pergaminho | `ink` #1c1417 | Texto principal | 4.5:1 | 15.57 | 17.08 | 18.08 | passa |
| pergaminho | `ink-muted` #5e5156 | Rótulos, especializações, abas inativas | 4.5:1 | 6.49 | 7.12 | 7.53 | passa |
| pergaminho | `line-strong` #92858b | Borda de controle, caixa vazia | 3.0:1 | 3.04 | 3.34 | 3.53 | passa (margem mínima) |
| pergaminho | `dot-empty` #8f8287 | Contorno do ponto vazio | 3.0:1 | 3.17 | 3.48 | 3.68 | passa |
| pergaminho | `ouro` #8a6414 | Botão primário, anel de foco (não texto) | 3.0:1 | 4.62 | 5.07 | 5.37 | passa |
| pergaminho | `paradoxo` #24384c | Casa de Paradoxo | 3.0:1 | 10.37 | 11.37 | 12.03 | passa |
| pergaminho | `gnose` #3a3826 | Gnose, lua do augúrio | 3.0:1 | 10.20 | 11.19 | 11.84 | passa |
| pergaminho | `line` #d9cfd1 | Divisória (decorativa) e caixa tracejada indisponível | 3.0:1 | **1.31** | **1.44** | **1.52** | falha (decorativo/inativo, isento) |
| pergaminho | `on-ouro` #ffffff sobre `ouro` | Texto do botão primário | 4.5:1 | – | – | – | 5.37:1 passa |

`ouro` usado como texto (link) também passa 4.5:1: de 7.32 a 8.52 no noite e de 4.62 a 5.37 no pergaminho, este último com margem mínima sobre `bg`.

#### Linhagens

Cada linhagem precisa de 3:1 (pontos, réguas, bordas). Em **negrito**, os valores abaixo de 4.5:1, que falhariam se a cor fosse usada como texto (ex.: `.g-affinity`).

| Linhagem | noite (hex) | noite bg / surface / raised | pergaminho (hex) | pergaminho bg / surface / raised | 3:1 (pontos, réguas, bordas) | 4.5:1 (como texto) |
|---|---|---|---|---|---|---|
| `sis-vampiro` | #d63048 | **3.99** / **3.75** / **3.43** | #a3172b | 6.66 / 7.31 / 7.74 | passa | FALHA (mín. 3.43) |
| `sis-lobisomem` | #7fa848 | 6.93 / 6.51 / 5.95 | #4b6e22 | 5.09 / 5.59 / 5.91 | passa | passa |
| `sis-mago` | #b06ee0 | 5.61 / 5.27 / 4.82 | #7a35ad | 6.15 / 6.75 / 7.14 | passa | passa |
| `sis-aparicao` | #86a9b6 | 7.63 / 7.17 / 6.55 | #3f6b7a | 5.03 / 5.52 / 5.84 | passa | passa |
| `sis-changeling` | #3fb5a0 | 7.60 / 7.14 / 6.53 | #1c7262 | 4.98 / 5.46 / 5.78 | passa | passa |
| `sis-cacador` | #e0782a | 6.29 / 5.90 / 5.40 | #a8510f | 4.70 / 5.16 / 5.46 | passa | passa |
| `cla-brujah` | #e0532f | 4.97 / 4.67 / **4.27** | #a83218 | 5.77 / 6.33 / 6.70 | passa | FALHA (mín. 4.27) |
| `cla-gangrel` | #9aab3e | 7.54 / 7.09 / 6.48 | #5c6a1a | 5.12 / 5.62 / 5.95 | passa | passa |
| `cla-malkavian` | #a678e0 | 5.83 / 5.47 / 5.00 | #6d3fb0 | 6.05 / 6.64 / 7.03 | passa | passa |
| `cla-nosferatu` | #7d9a78 | 6.17 / 5.80 / 5.30 | #4a6446 | 5.65 / 6.20 / 6.56 | passa | passa |
| `cla-toreador` | #e8689a | 6.28 / 5.89 / 5.39 | #b0335f | 5.19 / 5.70 / 6.03 | passa | passa |
| `cla-tremere` | #d42445 | **3.78** / **3.55** / **3.24** | #9c1028 | 7.18 / 7.88 / 8.34 | passa | FALHA (mín. 3.24) |
| `cla-ventrue` | #5a88e0 | 5.50 / 5.17 / 4.73 | #2c55a8 | 6.09 / 6.68 / 7.07 | passa | passa |
| `cla-lasombra` | #8a8fb0 | 6.06 / 5.69 / 5.20 | #4f5470 | 6.38 / 7.00 / 7.41 | passa | passa |
| `cla-tzimisce` | #c08552 | 6.13 / 5.76 / 5.26 | #85532a | 5.53 / 6.07 / 6.43 | passa | passa |
| `cla-banu-haqim` | #2fb092 | 7.07 / 6.64 / 6.07 | #1b7563 | 4.80 / 5.26 / 5.57 | passa | passa |
| `cla-hecata` | #bfae84 | 8.76 / 8.23 / 7.52 | #7a6a3f | 4.57 / 5.01 / 5.30 | passa | passa |
| `cla-ravnos` | #e8b030 | 9.75 / 9.15 / 8.37 | #8f6408 | 4.53 / 4.97 / 5.26 | passa | passa |
| `cla-ministerio` | #58b862 | 7.71 / 7.24 / 6.62 | #2a7a35 | 4.60 / 5.05 / 5.34 | passa | passa |
| `cla-caitiff` | #988e92 | 6.04 / 5.67 / 5.19 | #6a6064 | 5.21 / 5.72 / 6.05 | passa | passa |
| `trad-ordem-de-hermes` | #9a86ec | 6.38 / 5.99 / 5.48 | #5a45b5 | 6.12 / 6.72 / 7.11 | passa | passa |
| `trad-coro-celestial` | #9cc3f0 | 10.47 / 9.83 / 8.99 | #2f5f9a | 5.61 / 6.16 / 6.51 | passa | passa |
| `trad-culto-do-extase` | #e35d9b | 5.75 / 5.40 / 4.94 | #a8286a | 5.69 / 6.25 / 6.61 | passa | passa |
| `trad-eutanatos` | #b8b2c4 | 9.31 / 8.74 / 7.99 | #5e586b | 5.86 / 6.44 / 6.81 | passa | passa |
| `trad-irmandade-akashica` | #e88a3a | 7.42 / 6.96 / 6.37 | #a5520e | 4.74 / 5.20 / 5.51 | passa | passa |
| `trad-sonhadores` | #c98a5a | 6.63 / 6.23 / 5.69 | #8a4f25 | 5.61 / 6.15 / 6.51 | passa | passa |
| `trad-verbena` | #5cb84a | 7.67 / 7.21 / 6.59 | #2e7a1f | 4.61 / 5.06 / 5.36 | passa | passa |
| `trad-filhos-do-eter` | #5fc4d8 | 9.47 / 8.89 / 8.13 | #1b6f80 | 4.98 / 5.46 / 5.78 | passa | passa |
| `trad-virtualidade` | #4f8cf0 | 5.79 / 5.43 / 4.97 | #2456b8 | 5.84 / 6.41 / 6.78 | passa | passa |
| `tribo-furias-negras` | #b866d0 | 5.34 / 5.01 / 4.58 | #7a2f94 | 6.80 / 7.46 / 7.89 | passa | passa |
| `tribo-roedores-de-ossos` | #a89a6e | 6.85 / 6.44 / 5.89 | #6b5f38 | 5.45 / 5.98 / 6.33 | passa | passa |
| `tribo-filhos-de-gaia` | #7fc4a0 | 9.40 / 8.83 / 8.07 | #2c7650 | 4.74 / 5.20 / 5.51 | passa | passa |
| `tribo-fianna` | #4fb86a | 7.66 / 7.19 / 6.58 | #23793a | 4.68 / 5.13 / 5.43 | passa | passa |
| `tribo-crias-de-fenris` | #d0583a | 4.69 / **4.40** / **4.03** | #9a3218 | 6.36 / 6.98 / 7.39 | passa | FALHA (mín. 4.03) |
| `tribo-andarilhos-do-asfalto` | #8ab0d0 | 8.40 / 7.88 / 7.21 | #36607f | 5.77 / 6.33 / 6.70 | passa | passa |
| `tribo-garras-vermelhas` | #e0443a | 4.61 / **4.33** / **3.96** | #a3201a | 6.51 / 7.14 / 7.56 | passa | FALHA (mín. 3.96) |
| `tribo-senhores-das-sombras` | #8c8fa8 | 6.03 / 5.66 / 5.18 | #4c4f68 | 6.89 / 7.56 / 8.00 | passa | passa |
| `tribo-peregrinos-silenciosos` | #d0a060 | 8.10 / 7.61 / 6.96 | #85601f | 4.90 / 5.38 / 5.69 | passa | passa |
| `tribo-presas-de-prata` | #c8ccd8 | 11.94 / 11.21 / 10.25 | #5a6070 | 5.41 / 5.94 / 6.28 | passa | passa |
| `tribo-observadores-das-estrelas` | #8a9cf0 | 7.39 / 6.94 / 6.34 | #3f4fb0 | 6.12 / 6.71 / 7.10 | passa | passa |
| `tribo-uktena` | #3aa8a0 | 6.65 / 6.25 / 5.71 | #16706a | 5.08 / 5.58 / 5.90 | passa | passa |
| `tribo-wendigo` | #9cd0e8 | 11.50 / 10.80 / 9.87 | #2f6a88 | 5.11 / 5.61 / 5.94 | passa | passa |

#### Resumo do contraste

Todas as 42 linhagens passam de 3:1 nos três fundos dos dois temas. Cinco ficam abaixo de 4.5:1 no noite: não podem ser usadas como texto sem o token `accent-text` (DS-09).

#### Daltonismo

ΔE2000 entre pares do mesmo grupo, por `contrast.py --section cvd`, com simulação de Machado (2009) e severidade 1.0. A tabela mostra os piores pares. Os pares `paradoxo`/`gnose` contra o grupo ficam ≥ 7.8 em qualquer simulação.

| Par | Tema | Normal | Protanopia | Deuteranopia |
|---|---|---|---|---|
| `tribo-crias-de-fenris` × `tribo-garras-vermelhas` | pergaminho | 4.6 | 2.4 | **0.0** |
| `trad-ordem-de-hermes` × `trad-virtualidade` | pergaminho | 10.9 | 2.5 | **0.4** |
| `cla-banu-haqim` × `cla-caitiff` | pergaminho | 36.3 | 8.3 | **0.7** |
| `trad-ordem-de-hermes` × `trad-virtualidade` | noite | 15.2 | **0.9** | 4.9 |
| `cla-malkavian` × `cla-ventrue` | noite | 18.5 | **1.3** | 3.9 |
| `cla-gangrel` × `cla-ravnos` | pergaminho | 19.3 | **1.4** | 6.0 |
| `cla-tremere` × `sis-vampiro` | ambos | **1.7** | 1.9 / 2.0 | 1.5 / 1.8 |
| `cla-toreador` × `cla-banu-haqim` | noite | 67.3 | 22.6 | **1.5** |
| `tribo-peregrinos-silenciosos` × `sis-lobisomem` | pergaminho | 23.3 | **1.9** | 3.6 |
| `cla-ravnos` × `ouro` | pergaminho | **1.7** | – | – |

### Componentes que faltam

Cada proposta usa os tokens do core (DS-02, DS-07) e traz a linha **Multi-sistema:**.

1. **`Stepper` / `ValueEditor`.**
   - Proposta: botões −/+ de 44px, valor central com `tabular-nums`, repetição ao segurar, toque no valor para digitar, limites `min`/`max` vindos do template, `accessibilityRole="adjustable"`.
   - **Multi-sistema:** genérico. Edita PV de D&D, % de CoC, a escada de Fate, Quintessência e Paradoxo.
2. **`NumberField` com derivado.**
   - Proposta: valor grande, derivado ao lado ou abaixo, e sinal explícito (`+2`, `−1`). As fórmulas vêm do template, de uma lista branca de derivações (`mod5e`, `half`, `fifth`, `fateLadder`), **nunca de `eval`**.
   - **Multi-sistema:** genérico. D&D: `15 (+2)`. CoC: `60 · 30 · 12`. PbtA: `+1`. Fate: `+3 Bom`.
3. **`BottomSheet`.**
   - Proposta: `scrim`, `elevation-2`, alça e botão "Fechar", foco preso, fecha com gesto, respeita a safe area, altura em 2 pontos de parada. Hospeda o editor de traço, a aplicação de dano, a escolha de linhagem e o rolador.
   - **Multi-sistema:** genérico.
4. **`Toast` com Desfazer.**
   - Proposta: um por vez, 5s, `accessibilityLiveRegion="polite"` / `aria-live`, ação "Desfazer" com alvo de 44px, acima da tab bar.
   - **Multi-sistema:** genérico. Vale para qualquer edição em `play`.
5. **`ConfirmDialog`.**
   - Proposta: título com verbo e objeto ("Excluir Lestat?"), texto com a consequência, botões "Cancelar" e destrutivo (`danger`), foco inicial em Cancelar.
   - **Multi-sistema:** genérico.
6. **`TextField` / `TextArea` / `NotesEditor`.**
   - Proposta: rótulo visível, ajuda, erro com ícone e texto (não só cor), contador e estados disabled/readonly.
   - Variante `AspectField`: texto curto + caixa "invocado" + tags.
   - **Multi-sistema:** genérico. Nome, conceito e notas em qualquer sistema; aspectos e consequências de Fate; Paixões e Grilhões de Aparição; traços de personalidade de D&D.
7. **`ListItem` / `CharacterCard` / `ChronicleCard`.**
   - Proposta: avatar com iniciais em `accent`, nome, `IdentityChip`, sistema, data de atualização e ações de linha. Lista com seções e busca.
   - **Multi-sistema:** genérico. O chip mostra "Tremere", "Elfo · Mago 5" ou "Professor de Antropologia".
8. **`EmptyState` e `Skeleton`.**
   - Proposta: o estado vazio tem texto e uma ação ("Criar primeiro personagem"), sem ilustração de sistema. O skeleton tem a forma das linhas da ficha e um shimmer que respeita "reduzir movimento".
   - **Multi-sistema:** genérico.
9. **`DiceRoller`.**
   - Proposta: a notação vem do template:
     - WoD: parada de d10 contra dificuldade;
     - D&D: d20 + modificador, com vantagem e desvantagem;
     - CoC: d100 com dados de bônus e penalidade;
     - Fate: 4dF;
     - PbtA: 2d6 + atributo.

     O resultado é anunciado em live region e há histórico. **Rolagens que valem para a mesa devem ser feitas no servidor** (o cliente é hostil e pode forjar o resultado). Rolagens locais usam `crypto.getRandomValues`, não `Math.random`.
   - **Multi-sistema:** genérico. Muda só a regra, que vem dos dados.
10. **Navegação: `TabBar` inferior, `AppHeader` e `SegmentedControl`.**
    - Proposta: tab bar com Crônicas, Personagens, Dados e Perfil, ícone + rótulo e 44px. O header tem título, voltar e até 2 ações. As `Tabs` atuais viram `SegmentedControl` dentro da seção.
    - **Multi-sistema:** genérico.
11. **`IconButton` + conjunto de ícones base.**
    - Proposta: ícones genéricos (mais, menos, editar, desfazer, dado, compartilhar, mais opções), alvo de 44px, `accessibilityLabel` obrigatório. Opção: Lucide (licença ISC), que depende de `react-native-svg`. Sem símbolos de clã.
    - **Multi-sistema:** genérico. Glifos de sistema ficam na skin.
12. **`Tag`/`Chip` e `MarkToggle`.**
    - Proposta: `Tag` para condições e palavras-chave. `IdentityChip` substitui `LineageMark`. `MarkToggle` é um controle de 2 ou 3 estados (vazio, marcado, duplo) com rótulo.
    - **Multi-sistema:** genérico. Proficiência e especialização em D&D, marca de melhoria em CoC, move escolhido em PbtA, condições de D&D e PbtA.
13. **`Repeater` / `ListEditor`.**
    - Proposta: adicionar, remover (com desfazer) e reordenar linhas com o esquema de `FieldRow` declarado no template.
    - **Multi-sistema:** genérico. Disciplinas, Antecedentes, Arcanoi, magias de D&D, inventário, moves de PbtA, perícias customizadas de CoC.
14. **`CharacterHeader`.**
    - Proposta: nome (display da skin, no máximo 2 linhas), `voice`, `IdentityChip` e até 3 recursos rápidos (os "pinned" do template), compactando no scroll.
    - **Multi-sistema:** genérico. Vampiro fixa Sangue, Vontade e Vitalidade; D&D fixa PV, CA e Iniciativa; CoC fixa PV, SAN e Sorte.
15. **`Banner` / `InlineMessage`.**
    - Proposta: avisos de offline, erro de sincronização e conflito de edição ("Outra pessoa editou esta ficha"), com ação.
    - **Multi-sistema:** genérico.

### Escalabilidade para outros sistemas

#### Diagnóstico

O "Grimório" é hoje um DS de WoD com aparência agnóstica. Os princípios (pontos, cor por linhagem, gótico) e os tokens (`gnose`, `paradoxo`, `cla-*`) codificam um único sistema. Mesmo dentro do WoD, Aparição e Changeling exigiriam tokens e classes novos (Pathos/Angústia, Glamour/Banalidade, Vitalidade real e quimérica), embora sejam a mesma mecânica de RageGnose e HealthTrack. A tabela de princípios reescritos está no DS-02.

#### Arquitetura proposta: core + skin + dados

| Camada | Contém | Quem muda | Exemplo |
|---|---|---|---|
| **Core** (`packages/ui`) | tokens semânticos (`action`, `accent`, `accent-alt`, `accent-text`, `accent-neutral`, `danger`, `success`, `border-*`, `state-*`, `elevation-*`, `motion-*`), primitivos de valor, layout e feedback | time de DS, raramente | `RatingDots`, `NumberField`, `Track` |
| **Skin** (por sistema ou família) | fonte display e de voz, forma do pip (círculo, quadrado, losango), ornamentos, valores de `action` e `accent-alt`, glifos (lua do augúrio) e fórmula de derivação do `accent` | time de produto, por sistema | `skin.wod` (Grimório), `skin.dnd5e`, `skin.coc7e` |
| **Dados** (`trait_templates.template_data`) | campos, tipo de cada campo, faixas, derivações (lista branca), regras nomeadas, rótulos (i18n), linhagens com `accent_seed`, recursos fixados no header | conteúdo/Narrador, sem deploy | `{ "type": "dots", "max": 5 }` |

#### Taxonomia de componentes

**Base (core, agnósticos):**

| Família | Primitivo | Representa |
|---|---|---|
| Valor | `RatingDots` | inteiro pequeno de 0 a N (N ≤ 10), com `segments` base/bônus/perdido |
| Valor | `NumberField` | inteiro com sinal, faixa e derivado (modificador, adjetivo) |
| Valor | `PercentField` | 0–100 com metade e quinto |
| Valor | `TextAspect` | texto curto + marcação (invocado, tags) |
| Valor | `Choice` | escolha única com descrição e `modifiers` aplicados a outros campos |
| Valor | `MarkToggle` | 2 ou 3 estados (proficiência, melhoria, move escolhido) |
| Valor | `Tags` | conjunto de condições ou palavras-chave |
| Recurso | `Track` | N caixas com estados nomeados (vazio, cheio, marcas) |
| Recurso | `LeveledTrack` | linhas com rótulo, modificador e caixas por linha |
| Recurso | `Resource` | atual/máximo(/temporário) com ações gastar/recuperar e regra de reset; é exibido como `Track` se máximo ≤ 20, senão como `NumberField` + barra |
| Recurso | `Pool` | par permanente + atual (atual ≤ permanente) |
| Recurso | `Clock` | N segmentos com até 2 preenchimentos opostos |
| Layout | `Section`, `SectionHeader`, `Group`, `FieldRow` (rótulo, sub-rótulo, slot de valor, `badge`, `leading`), `Repeater`, `CharacterHeader`, `IdentityChip` | – |
| Ação e feedback | `Button`, `IconButton`, `Stepper`, `SegmentedControl`, `Tabs`, `BottomSheet`, `ConfirmDialog`, `Toast`, `Banner`, `EmptyState`, `Skeleton`, `DiceRoller` | – |

**De sistema (skin ou regra, fora do core):**
- glifo `AugurMoon` (Lobisomem);
- regra de dano `wod-stacking`;
- regra de transbordo Quintessência/Paradoxo;
- fórmula do modificador do 5e (`mod5e`);
- `fateLadder`;
- ornamentos e fontes do Grimório.

Todos entram por nome a partir do template, de uma lista registrada no código (sem execução de código vindo do banco).

#### Mapeamento: componente atual → primitivo genérico → outros sistemas

| Componente atual | Primitivo genérico | Em D&D 5e | Em Call of Cthulhu 7e | Outros (Fate/PbtA/Aparição/Changeling) |
|---|---|---|---|---|
| `TraitDots` | `RatingDots` | Raro. Atributos de 3 a 20 viram `NumberField` (`15 (+2)`); pips só para contagens pequenas (Inspiração 0–1, usos de habilidade) | Não se aplica. Características e perícias viram `PercentField` | Arcanoi e Artes (Aparição/Changeling) usam `RatingDots`; Fate usa `NumberField` com escada |
| `TraitRow` | `FieldRow` | `MarkToggle` (proficiência) · "Furtividade (Des)" · `+5` derivado | `MarkToggle` (melhoria) · "Furtividade" · `20% · 10 · 4` | Moves de PbtA: `MarkToggle` + `TextAspect` |
| `Tracker` | `Resource` (exibido como `Track`) | Slots de magia por nível (até 4 caixas), Dados de Vida, Ki e cargas de item; PV numérico com `Stepper` (máximo > 20) | Pontos de Magia e Sorte como `Resource` numérico; PV pequeno (≈ 8–18) como `Track` | Pontos de Fate como `Resource`; XP de PbtA como `Track` de 5 |
| `HealthTrack` | `LeveledTrack` + regra do template | Death saves (2 linhas × 3 caixas: Sucessos/Falhas); Exaustão 1–6 (rótulo = efeito) | PV como `Resource` + `Tags` (Ferimento grave, Morrendo); Sanidade com `Tags` (insanidade temporária/indefinida) | Stress de Fate (caixas com valor 1/2/3) + Consequências (`TextAspect` de 2/4/6); Corpus de Aparição; Vitalidade real e quimérica de Changeling (dois `LeveledTrack`) |
| `RageGnose` | `Pool` × 2 (+ `accent` / `accent-alt`) | PV máximo/atual/temporário como `Pool` com temporário; Dados de Vida (total = nível) | Sanidade: máximo (99 − Mitos de Cthulhu), inicial e atual | Pathos/Angústia (Aparição); Glamour/Banalidade (Changeling) |
| `QuintessenceWheel` | `Clock` (2 preenchimentos opostos) | Sem equivalente direto; `Clock` simples para contagens de cena ou desafios de perícia | Sem equivalente direto | Relógios de PbtA/Blades (4/6/8); harm clock do Apocalypse World |
| `Spheres` | Não é componente: é uma `Section` de `FieldRow` com `badge` (afinidade) e `cap` (Arete) | Lista de perícias com `badge` de proficiência/especialização | Lista de perícias com `badge` "ocupacional" | Moves de PbtA com `badge` "do playbook" |
| `FormSelector` | `Choice` + `modifiers` + `RatingDots.segments` | Forma Selvagem (druida) e Fúria (bárbaro) aplicando modificadores | Não se aplica | Formas de Fera; Semblante de Changeling |
| `AugurMoon` | glifo da skin WoD no slot `leading` | Ícone de classe (próprio, sem IP de terceiros) | Não se aplica | – |
| `LineageMark` | `IdentityChip` (`accent` + rótulo + iniciais) | "Elfo · Mago 5" | "Professor de Antropologia" com `accent-neutral` | Playbook de PbtA; Kith de Changeling; Guilda de Aparição |
| `SectionHeader` | `SectionHeader` (régua em `accent`) | igual | igual | igual |
| `Tabs` | `SegmentedControl` | Ações / Magias / Inventário | Perícias / Combate / Histórico | igual |
| `Button` | `Button` (variantes primary, secondary, danger, ghost; estados) | igual | igual | igual |
| `Cover` | Peça de apresentação, fora do produto | – | – | – |

#### Contrato mínimo do template

O esboço abaixo mostra o mesmo primitivo servindo três sistemas:

```json
{
  "skin": "wod",
  "accent": { "from": "field", "field": "cla" },
  "lineages": [{ "id": "vampiro.tremere", "name": "Tremere", "accent_seed": { "h": 18, "c": 0.17 } }],
  "fields": [
    { "id": "forca", "label": "Força", "type": "dots", "min": 1, "max": 5, "group": "fisicos" },
    { "id": "vitalidade", "type": "leveled-track", "rule": "wod-stacking",
      "levels": [{ "label": "Escoriado", "mod": 0 }, { "label": "Machucado", "mod": -1 }],
      "states": ["vazio", "contusivo", "letal", "agravado"] }
  ]
}
```

```json
{ "id": "str", "label": "Força", "type": "number", "min": 1, "max": 30, "derive": "mod5e" }
{ "id": "furtividade", "label": "Furtividade", "type": "percent", "derive": ["half", "fifth"], "mark": "melhoria" }
```

Requisitos de segurança do contrato:
- validar o template no servidor com schema (TypeBox, já no ecossistema do Elysia);
- `type`, `derive` e `rule` aceitam só valores de uma lista branca;
- sem `eval` nem `new Function`;
- texto de rótulo tratado como texto (nunca HTML);
- cores validadas como no DS-03.

Isso também prepara templates criados pelo Narrador (homebrew) sem abrir vetor de injeção.

### Quick wins

1. **Estados e foco no CSS:** incluir `.g-form` no `:focus-visible` e adicionar `:active` (`state-pressed`), `:disabled` e `[aria-disabled]`, como no DS-04. Cerca de 15 linhas.
2. **`accent` neutro fora da ficha:** `:root{--accent:var(--accent-neutral)}`, e a aba ativa usa `var(--accent, var(--action))`, como o `usage` já pedia (DS-09).
3. **Token `accent-text`** com os 5 valores calculados e `.g-affinity` usando-o (DS-09).
4. **Personagem sem linhagem usa `accent-neutral`**, não a cor do sistema. Isso elimina o par Tremere × Vampiro (ΔE 1.7). Mover Ravnos para fora do matiz do `ouro` (DS-08).
5. **Margem no pergaminho:** `line-strong` passa a `#86797f` e `dot-empty` a `#86797e` (de 3.04 para 3.58:1 sobre `bg`).
6. **Rótulos acessíveis nos previews:** nome do traço no `aria-label` dos pontos, rótulo e valor no Tracker, tipo de dano por nível na Vitalidade, `radiogroup`/`radio` no FormSelector (DS-05).
7. **Fontes:** remover a Grenze 500, trocar `.g-wheel-n` para `sans` e hospedar as fontes no app com `expo-font` em vez do `@import` do Google, o que também resolve o ponto de LGPD (DS-10).
8. **App:** `userInterfaceStyle: "automatic"` e splash `#120e10` no `app.json`. Colocar `contrast.py` no CI do DS para barrar cor nova que fure 3:1, 4.5:1 ou ΔE contra `action` (DS-16, DS-08).

---

## Anexo B: Telas "Fichas de WoD" (relatório completo)


Material avaliado: `canvas.json`, `Main.dc.html` (Vampiro · celular), `Web.dc.html` (Vampiro · web), `Mago.dc.html` (Mago · celular), `Lobisomem.dc.html` (Lobisomem · celular) e `ds/grimorio/tokens.json` (idêntico ao `tokens.json` do design system, conferido por diff). Referência: `design-system/project/README.md`, `tokens.json` e `components/*`. Os números de linha são dos arquivos `.dc.html`. As alturas são estimativas feitas a partir do CSS inline (fonte, line-height, padding), não medições renderizadas.

Lente multi-sistema: o TMS vai além de WoD. Cada achado traz uma linha **Multi-sistema** que diz como a solução se comporta em D&D 5e (atributos numéricos com modificador, CA, PV, slots de magia, inventário longo), Call of Cthulhu 7e (perícias em %, Sanidade), Fate/PbtA (aspectos em texto, moves, stress) e Aparição/Changeling.

Não encontrei nos arquivos nenhum texto com cara de instrução para IA. O único dado pessoal real é o nome do autor em `design-system.json` (`lastChange.by`), que não foi reproduzido aqui. Os nomes de personagens, crônicas e do narrador nas telas são ficção.

---

### Resumo

**Nota: 5,5 / 10.**

As telas têm uma base visual coerente e mostram que quem desenhou conhece as regras. Os valores literais batem com os tokens, os pontos são usados de forma consistente, as restrições de regra estão modeladas (Esferas ≤ Arete, Força de Vontade temporária ≤ permanente, roda de 20 casas), a forma do Garou aparece nos Atributos e há uma ação primária por tela. O que derruba a nota:

1. Não existe modo leitura. Traços permanentes mudam com um toque acidental em alvos de 14px, sem confirmação e sem desfazer.
2. Quem usa leitor de tela não consegue saber o valor de nenhum traço.
3. O que se usa a cada turno (Vitalidade) fica a 2–3 mil px do topo.
4. São três telas escritas à mão, sem tokens e sem `data-lineage`, com estruturas diferentes entre si.
5. As telas estão acopladas a WoD de ponta a ponta (ordem de seções, barra de recursos, trilha de 7 níveis, "tudo é ponto"). Isso contradiz o objetivo do produto: um sistema novo não pode exigir tela nova.

A versão web não resolve tablet. Faltam todos os estados fora do "caminho feliz".

---

### O que está bem feito

- **Valores fiéis aos tokens.** Todo hex literal corresponde a um token do tema `noite` (`#120e10` = `bg`, `#1b1518` = `surface`, `#857379` = `dot-empty`, `#d9a441` = `ouro` etc.). A única exceção é `#5c4b52` (Mago l.122). Os tamanhos também batem com os tokens: ponto 14px, caixa 22px, linha 44px, raios 3/10/999. Migrar para `var(--token)` é trabalho mecânico.
- **Padrão de alvo de toque correto na Vitalidade.** O botão tem 44×44 com `margin-right: -11px` e envolve uma caixa visual de 22px (Main l.170). É exatamente o padrão que falta replicar nos pontos e nas outras caixas. O `aria-label` traz o tipo de dano ("Ferido, letal"), e o glifo `/ X ✱` garante que a informação não dependa só de cor.
- **Roda de Quintessência bem resolvida.** Edição por −/+ de 44px, números no centro, `role="img"` com rótulo dinâmico ("Quintessência 6, Paradoxo 2, de 20 casas") e a regra "ganhar Paradoxo com a roda cheia tira uma Quintessência" (Mago l.330–334).
- **Regras viram restrições visíveis.** Caixas de Força de Vontade acima do permanente ficam travadas (Main l.75). Esferas acima do Arete ficam desabilitadas e há texto explicando (Mago l.113). Baixar o Arete corta as Esferas (l.280). O Renome temporário não tem teto, como no W20 (Lobisomem l.330).
- **FormSelector exemplar.** Bônus aparecem como pontos tracejados mais a legenda "3 + 4 da forma = 7". Aparência fica em "0 na forma Crinos". A nota do Delírio aparece no Crinos. Trocar de forma leva à aba Físicos (Lobisomem l.306–332).
- **Ajuda contextual curta e útil:** "Gasto máximo por turno: 3" (Main l.59) e "Nenhuma Esfera passa do Arete (3)" (Mago l.113).
- **Uma ação primária (`ouro`) por tela**, com verbo no rótulo, como o `Button` pede.
- **O número acompanha o ponto, não o substitui** ("9 / 15", "5 / 7", Humanidade "6"), com `tabular-nums`.
- **Cabeçalho mobile com dois alvos de 44×44** e `aria-label` ("Voltar para a crônica", "Mais opções"). O retrato com iniciais tem `role="img"` e rótulo.
- **Terminologia de Mago e Lobisomem fiel ao M20/W20.** As 11/11/11 Habilidades de Mago e as 10/10/10 de Lobisomem estão corretas, e os níveis de Vitalidade (Escoriado → Incapacitado) seguem a edição brasileira.
- **Abas Físicos/Sociais/Mentais no celular e grupos abertos no web**, como pede o componente `Tabs`. Há `lang="pt-BR"` e `:focus-visible` em `ouro`.
- **Fúria na cor da tribo, Gnose quase neutra. Quintessência na cor da Tradição, Paradoxo quase neutro.** A intenção é certa, mas a execução tem exceções (TL-12).

---

### Mapa das telas

Referência de viewport: um celular de 390×844 tem cerca de 680px úteis por tela, descontando status bar, home indicator e a barra de ações fixa de ~81px.

| Board | # | Seção (ordem do DOM) | Altura ≈ | Começa em y ≈ |
|---|---|---|---|---|
| **Vampiro · celular** (390×2600) | 1 | Cabeçalho (voltar · crônica · mais opções) | 52 | 0 |
| | 2 | Identidade (nome, clã, geração, retrato) | 100 | 52 |
| | 3 | Citação (`quote`) | 62 | 152 |
| | 4 | Conceito / Senhor / Natureza / Comportamento | 96 | 214 |
| | 5 | Recursos: Pontos de sangue (2 fileiras), Força de Vontade | 243 | 310 |
| | 6 | Atributos (abas + 3 linhas) | 263 | 553 |
| | 7 | Habilidades (abas + 10 linhas) | 571 | 816 |
| | 8 | Vantagens: Disciplinas, Antecedentes, Virtudes, Humanidade | 652 | 1387 |
| | 9 | **Vitalidade** (ajuda + 7 níveis) | 430 | **2039** (4ª tela) |
| | 10 | Notas | 132 | 2469 |
| | 11 | Barra fixa (Rolar dados · Gastar sangue) | 81 | fixa |
| | | **Total** | **≈ 2,7 mil** | |
| **Vampiro · web** (1280×1500) | 1 | Nav (TMS · Crônicas · Personagens · crônica/narrador) | 64 | 0 |
| | 2 | Cabeçalho (retrato, nome, clã, citação, 5 fatos, Rolar dados, Editar ficha) | 134 | 92 |
| | 3a | Coluna 1: Atributos (3 grupos empilhados) + Vantagens (3 grupos) | ≈ 1120 | 254 |
| | 3b | Coluna 2: Habilidades (3 grupos × 10 linhas de 40px) | **≈ 1356** | 254 |
| | 3c | Coluna 3: Recursos (+ Humanidade), Vitalidade, Notas | ≈ 850 | 254 |
| | | **Total** (a coluna 2 define a altura; sobram ~500px vazios sob a coluna 3) | **≈ 1,66 mil** (passa do board de 1500) | |
| **Mago · celular** (390×3000) | 1 | Cabeçalho | 52 | 0 |
| | 2 | Identidade (nome, Tradição, Essência, retrato) | 100 | 52 |
| | 3 | Citação | 62 | 152 |
| | 4 | Conceito / Casa / Natureza / Comportamento | 96 | 214 |
| | 5 | Cartão: Arete, roda de Quintessência/Paradoxo (208px) + −/+, Força de Vontade | 514 | 310 |
| | 6 | Esferas (ajuda + 9 linhas) | 514 | 824 |
| | 7 | Atributos | 263 | 1338 |
| | 8 | Habilidades (11 linhas) | 615 | 1601 |
| | 9 | Antecedentes (5) | 298 | 2216 |
| | 10 | Foco (Paradigma, Prática, Instrumentos) | 328 | 2514 |
| | 11 | **Vitalidade** | 430 | **2842** (5ª tela) |
| | 12 | Barra fixa (Conjurar efeito · Rolar dados) | 81 | fixa |
| | | **Total** (a estimativa passa do board de 3000: vale conferir se a Vitalidade e a barra aparecem no canvas) | **≈ 3,3 mil** | |
| **Lobisomem · celular** (390×3100) | 1 | Cabeçalho | 52 | 0 |
| | 2 | Identidade (nome, nome de feito, tribo, Posto, retrato) | 118 | 52 |
| | 3 | Cartão Raça / Augúrio (lua) / Seita / Totem | 124 | 170 |
| | 4 | Fúria, Gnose, Força de Vontade (pontos + caixas) | 280 | 294 |
| | 5 | Forma (5 botões + nota) | 166 | 574 |
| | 6 | Atributos (com bônus da forma) | 259 | 740 |
| | 7 | Habilidades (10 linhas) | 571 | 999 |
| | 8 | Renome (3 × pontos + caixas) | 328 | 1570 |
| | 9 | Dons (4 itens) | 284 | 1898 |
| | 10 | Antecedentes (4) | 252 | 2182 |
| | 11 | **Vitalidade** | 430 | **2434** (4ª tela) |
| | 12 | Barra fixa (Rolar dados · Gastar Fúria) | 81 | fixa |
| | | **Total** | **≈ 2,95 mil** | |

---

### Achados

Ordenados por severidade. Esforço: P (horas a 1 dia), M (alguns dias), G (uma sprint ou mais).

#### TL-01 · Crítico · Traços permanentes sempre editáveis, sem modo leitura, sem confirmação e sem desfazer

- **Onde:** todas as telas. Todo ponto é um `<button>` com `onClick="{{d.set}}"` (Main l.95–96, 118–119, 138–139, 153–154; Web l.67–68 e equivalentes; Mago l.57–58, 120–121; Lobisomem l.99–101). A lógica em Main l.237–243 diz: tocar no ponto *n* define *n*, e tocar no último ponto preenchido zera até *n−1*. O web tem "Editar ficha" (Web l.50), o que sugere um modo de edição, mas lá os pontos também são editáveis. O celular não tem "Editar ficha".
- **Problema:** a mesma superfície mistura consumíveis (sangue, Força de Vontade temporária, dano), que mudam a todo turno, com traços permanentes (Atributos, Habilidades, Disciplinas, Humanidade), comprados com XP, que mudam raramente. Ao rolar a ficha na mesa, um toque de passagem em um ponto de 14px baixa Força de 3 para 2 sem nenhum aviso.
- **Impacto para quem usa:** a ficha fica corrompida em silêncio, e jogador e narrador perdem confiança no app. Em crônica com narrador, não há como saber quem mudou o quê. É o tipo de erro que faz o grupo voltar ao papel.
- **Solução proposta:** três modos explícitos.
  - **Jogo** (padrão): só consumíveis são editáveis, com controles de 44px. Traços permanentes são exibição. Tocar a linha inteira abre a folha do traço (descrição, especialização, "Rolar com este traço").
  - **Edição** (por "Editar ficha" no menu ⋯ do celular e no botão do web): cada linha ganha −/+ de 44px. Ao sair, um resumo ("3 alterações: Força 3→2, …") com Salvar/Descartar.
  - **Leitura:** ficha de outro jogador ou ficha bloqueada pelo narrador.
  - Todo gasto de consumível mostra um snackbar "Sangue 9→8 · Desfazer" por 5s. Há um histórico em ⋯ → "Histórico".
  ```
  Modo jogo     Inteligência                 ●●●●○      ← linha inteira = 1 alvo
                Memória eidética
  Modo edição   Inteligência        [−]  ●●●●○  [+]     ← 44×44 cada
  ```
- **Multi-sistema:** o modo vem de um atributo genérico do campo no template, `"editableIn": ["play"]` (consumível) ou `["edit"]` (permanente), e não do tipo de ponto. Isso cobre PV e slots de magia do D&D (jogo) contra valor de atributo e nível (edição), Sanidade e Sorte do CoC (jogo) contra perícias em % (edição, com o checkbox de evolução editável no jogo), e stress e pontos de destino do Fate (jogo) contra aspectos (edição). Em Aparição, a seção da Sombra pode ser editável por *outro* jogador. Por isso a permissão precisa ser por seção, não por tela.
- **Esforço:** M.

#### TL-02 · Crítico · O leitor de tela não informa o valor dos traços, e há cerca de 170 paradas de foco

- **Onde:** rótulo dos pontos `label: name + ': ' + i + ' de ' + max` (Main l.248, Mago l.291, Lobisomem l.275). O mesmo texto vale para ponto cheio e vazio. Caixas: `label: noun + ': ' + (i + 1)` (Main l.264, Lobisomem l.285), também sem estado.
- **Problema:** em "Força: 2 de 5", o leitor de tela não diz se o ponto está preenchido. Para saber o valor de Força, a pessoa precisa passar por cinco botões e deduzir. Contagem na ficha de Vampiro celular: 2 (cabeçalho) + 15 (sangue) + 17 (Força de Vontade) + 3 + 15 (Atributos) + 3 + 50 (Habilidades) + 45 (Vantagens) + 10 (Humanidade) + 7 (Vitalidade) + 2 = **~169 paradas de Tab**. Isso falha no WCAG 4.1.2 (Name, Role, Value) no componente central do produto.
- **Impacto para quem usa:** jogadores cegos ou com baixa visão não conseguem usar a ficha. Quem navega por teclado no web leva dezenas de Tabs para chegar à Vitalidade.
- **Solução proposta:** um controle por traço, não um por ponto.
  - Web: `role="slider"` com `aria-valuemin/max/now` e `aria-valuetext="Inteligência, 4 de 5, especialização Memória eidética"`, com setas para ajustar. Em modo jogo, só leitura (`aria-readonly`).
  - React Native: `accessibilityRole="adjustable"`, `accessibilityValue={{min:0,max:5,now:4,text:'4 de 5'}}` e `accessibilityActions` de increment/decrement.
  - Para os rastreadores: um único controle "Pontos de Sangue, 9 de 15", com −/+.
  - O efeito colateral é bom: as paradas caem de ~169 para cerca de 45.
- **Multi-sistema:** o componente acessível é por *tipo de valor*. `rating` (pontos) e `number` (D&D 3–20) viram `adjustable` com `valuetext` gerado pelo template ("Força 16, modificador +3"). `percent` (CoC) vira "Biblioteconomia 60%, metade 30, um quinto 12". `ladder` (Fate) vira "Atletismo Ótimo (+4)". `text` (aspecto Fate) é um campo de texto comum. Os rótulos ficam no template. O comportamento ARIA fica no código, uma vez por tipo.
- **Esforço:** M.

#### TL-03 · Alto · Alvos de toque de 14px e 22px nos controles editáveis

- **Onde:** pontos `width: 14px; height: 14px` com gap de 6px (todas as telas, por exemplo Main l.95). Caixas de rastreador de 22px com gap de 4px: sangue (Main l.55–56), Força de Vontade (l.73–74), Fúria/Gnose/Força de Vontade (Lobisomem l.65–66), Renome (l.148–149). No web, Vitalidade e Habilidades têm 40px (Web l.104, 166, 169).
- **Problema:** viola o `hit-size` de 44px do README. O próprio DS já resolveu isso na roda de Quintessência ("edição por botões −/+ … não por toque nas casas, que são pequenas demais"), mas não aplicou a solução a Sangue, Força de Vontade, Fúria, Gnose e Renome. A frase do `TraitDots`, "área de toque da linha inteira: hit-size", só garante 44px de *altura*. Na horizontal, cada ponto tem cerca de 20px.
- **Impacto para quem usa:** erros de toque frequentes com a mesa escura, a mão ocupada com dados e o celular apoiado. Combinado com TL-01, vira corrupção de dados.
- **Solução proposta:** caixas e pontos viram só exibição, e a edição passa a usar −/+ de 44px, o mesmo padrão da roda. Para a Vitalidade, uma trilha horizontal de 7 caixas de 44px cabe exatamente no cartão (7×44 + 6×3 = 326px de largura útil):
  ```
  PONTOS DE SANGUE                    9 / 15
  ■■■■■■■■■□□□□□□                       (exibição, 22px)
  [ − Gastar ]   máx. 3 por turno   [ + ]   (44px)
  ```
- **Multi-sistema:** o par "exibição + stepper de 44px" funciona para qualquer `pool`: PV do D&D (número, sem caixas, com campo "PV temporários"), slots de magia (uma fileira por nível, cada uma com −/+), Sanidade e Sorte do CoC (número de 0 a 99, onde o stepper precisa aceitar digitação direta, porque perder 7 de Sanidade com 7 toques não é viável) e pontos de destino do Fate. O template diz `display: "boxes" | "number"` e `step`/`allowInput`.
- **Esforço:** M.

#### TL-04 · Alto · Hierarquia: o que se usa a cada turno está enterrado, e o que se consulta raramente vem primeiro

- **Onde:** a Vitalidade começa em y≈2039 no Vampiro, ≈2842 no Mago e ≈2434 no Lobisomem (ver Mapa). A Humanidade fica dentro de Vantagens (Main l.147–159), em y≈1980. Conceito, Natureza, Comportamento e citação ocupam cerca de 160px antes do primeiro recurso (Main l.41–48). As Notas vêm depois da Vitalidade só no Vampiro.
- **Problema:** a ordem segue a ficha em papel (Atributos → Habilidades → Vantagens → Vitalidade), não a frequência de uso na mesa. Os recursos estão no topo (bom), mas o dano, que muda em todo combate, fica na 4ª ou 5ª tela. Para fazer uma rolagem, o jogador precisa ver o atributo, a habilidade e a penalidade de Vitalidade ao mesmo tempo, e hoje esses três ficam a mais de 1.500px um do outro.
- **Impacto para quem usa:** rolar a tela a cada turno, errar a penalidade e atrasar a mesa.
- **Solução proposta:** uma ordem fixa de **zonas**, com conteúdo vindo do template.
  1. Identidade compacta (nome, marca de linhagem, subtítulo e retrato; até ~120px).
  2. **Em jogo**: Vitalidade (horizontal), recursos do sistema, moralidade/Arete e penalidade atual.
  3. Traços.
  4. Vantagens e poderes.
  5. **Sobre**, recolhido por padrão: citação, Conceito/Natureza/Comportamento, Antecedentes narrativos e Notas.

  Ao rolar além da zona 2, aparece um mini-HUD fixo sob o cabeçalho:
  ```
  ┌────────────────────────────────────────┐
  │ ‹  Helena Varga                     ⋯  │
  │ Vit −1 [/][X]   Sangue 9/15   FV 5/7   │ ← toque abre "Em jogo" em folha
  └────────────────────────────────────────┘
  ```
  Total estimado no Vampiro: cerca de 2 mil px, contra 2,7 mil hoje (Sobre recolhido, Vitalidade horizontal, filtro de Habilidades), com a Vitalidade em y≈180 em vez de y≈2039.
- **Multi-sistema:** o conceito de "zona" com `tier: play | build | powers | lore` é genérico. No D&D, Em jogo = PV, CA, Iniciativa, Deslocamento, testes contra morte, slots e condições. No CoC = PV, Sanidade, Sorte, PM e flags de insanidade. No Fate = pontos de destino, stress e consequências. No PbtA = harm/clock e condições. No Changeling, duas trilhas de Vitalidade (real e quimérica) entram na mesma zona. O mini-HUD mostra os campos marcados `hud: true` no template, até 3 ou 4.
- **Esforço:** M.

#### TL-05 · Alto · Três telas escritas à mão, com estruturas divergentes

- **Onde:** `Main`, `Mago` e `Lobisomem` são arquivos separados. A ordem das seções, a presença de cada seção e os nomes mudam de um para outro (tabela abaixo). As listas `ATTR`, `ABIL`, `ADV`, `SPHERES`, `FORMS`, `LEVELS` são duplicadas em cada script (Main l.205–220, Mago l.238–251, Lobisomem l.223–241).

  | Elemento | Vampiro | Mago | Lobisomem |
  |---|---|---|---|
  | Citação | sim | sim | não (usa a fonte da citação para o nome de feito) |
  | Conceito / Natureza / Comportamento | `dl` sem cartão | `dl` sem cartão | **ausentes**; cartão `div` com Raça/Augúrio/Seita/Totem |
  | Recursos | cartão sem título (`aria-label`) | cartão sem título que também traz a Força de Vontade | cartão sem título |
  | Poderes | dentro de Vantagens, depois de Habilidades | Esferas **antes** de Atributos | Dons depois de Renome |
  | "Vantagens" como seção | sim | não (Antecedentes é h2) | não |
  | Notas | sim | **ausente** | **ausente** |
  | Margem Forma→Atributos | n/a | n/a | 24px (o resto usa 28px) |
- **Problema:** contradiz o objetivo do produto ("um sistema novo não deve exigir migration nem tela nova escrita à mão"). Cada sistema novo viraria um quarto arquivo, e cada correção (TL-01, TL-02, TL-03) teria de ser feita N vezes.
- **Impacto para quem usa:** quem joga dois sistemas reaprende a ficha. Dados somem dependendo do sistema (o lobisomem não tem onde registrar Natureza nem Notas). Para o time, o custo de manutenção cresce linearmente com o número de sistemas.
- **Solução proposta:** um único renderizador de ficha guiado por `trait_template` (ver "Proposta de estrutura data-driven"), com as mesmas zonas, os mesmos componentes e o conteúdo vindo dos dados. Notas e "Sobre" são zonas obrigatórias do esqueleto, não do sistema.
- **Multi-sistema:** este é o achado-raiz. Com o esqueleto genérico, D&D 5e, CoC e Fate entram como novas linhas em `trait_templates`, com o mesmo código de tela. A seção "Acoplamento a WoD" lista o que hoje impede isso.
- **Esforço:** G.

#### TL-06 · Alto · Nenhum token: cores e tamanhos literais, e linhagem por mapas JS duplicados

- **Onde:** todo `style=""` usa hex literal (por exemplo, Main l.18 `background: #120e10; color: #efe6e1`). Os mapas `COLORS` estão duplicados em cada script (Main l.193–198, Web l.184–189, Mago l.228–232, Lobisomem l.210–215), e a cor é injetada como `{{c}}`. Não há `data-lineage` na raiz. As classes do `bundle.css` (`.g-card`, `.g-trait`, `.g-dot`, `.g-box`, `.g-tab`, `.g-btn`, `.g-mark`) não são usadas.
- **Problema:** viola "nenhum componente usa cor literal" e "Defina a linhagem com `data-lineage`". O tema `pergaminho` (leitura de dia e impressão) fica impossível sem reescrever as telas. Se um token mudar no DS, as telas não acompanham.
- **Impacto para quem usa:** não há tema claro para jogar de dia ou imprimir. Para o time, há divergência garantida entre o DS e a implementação.
- **Solução proposta:** colocar `data-lineage="{{lineageId}}"` na raiz, trocar cada literal pelo token (tabela de divergências) e consumir os componentes do DS (`TraitRow`, `Tracker`, `HealthTrack`, `Tabs`, `Button`, `LineageMark`). No Expo, gerar um `theme.ts` a partir do `tokens.json` (um script de build) e expor `useTheme()`, sem hex nos componentes.
- **Multi-sistema:** os tokens `cla-*`, `trad-*` e `tribo-*` acoplam o DS a WoD. Proposta: o DS oferece uma paleta genérica de acentos validados (`accent-1…accent-16`, todos com 3:1 sobre `surface` nos dois temas, e 4.5:1 para os que podem virar texto), e o template de cada sistema mapeia sua "linhagem" para um acento (clã → acento, classe do D&D → acento, ocupação do CoC → sem acento, ou seja, a cor do sistema). Um sistema novo não exige token novo.
- **Esforço:** M.

#### TL-07 · Alto · Web: três colunas desbalanceadas, e em tablet os Recursos e a Vitalidade vão para o fim

- **Onde:** Web l.54 `display:flex; flex-wrap:wrap`, com três `section` de `flex: 1 1 340px` (l.56, 97, 119). A ordem do DOM é Atributos+Vantagens → Habilidades → Recursos/Vitalidade/Notas.
- **Problema:**
  - **≥1108px**: 3 colunas. A coluna de Habilidades tem cerca de 1356px (30 linhas empilhadas) e a de Recursos cerca de 850px, o que deixa uns 500px vazios. Isso contraria o DS ("duas colunas de seções a partir de 900px") e o `Tabs` ("a partir de 900px, mostre os grupos **lado a lado**"): os grupos estão empilhados.
  - **740–1107px (iPad retrato e paisagem)**: 2 colunas, e a terceira seção quebra para a linha de baixo em largura total. **Recursos e Vitalidade começam em y≈1700**, duas telas abaixo.
  - **600–739px**: uma coluna sem abas, com as 30 Habilidades em sequência.
  - Nenhum desses breakpoints foi desenhado. O tablet é provavelmente o dispositivo mais comum na mesa.
- **Impacto para quem usa:** no tablet, a experiência é pior que no celular. No desktop, há espaço desperdiçado e uma página mais longa que o necessário.
- **Solução proposta:** grid explícito por faixa.
  ```
  ≥1200  ┌ cabeçalho ───────────────────────────────────────────────┐
         │ EM JOGO     │ Atributos ─────────────────────────────────│
         │ (sticky,    │ FÍSICOS      │ SOCIAIS      │ MENTAIS     │
         │  4 col)     │ Habilidades ───────────────────────────────│
         │ Vitalidade  │ TALENTOS     │ PERÍCIAS     │ CONHECIM.   │  ← 10 linhas, ~430px
         │ Sangue      │ Vantagens ─────────────────────────────────│
         │ FV · Hum.   │ DISCIPLINAS  │ ANTECEDENTES │ VIRTUDES    │
         │ [ações]     │ Sobre (recolhível)                          │
         └─────────────┴────────────────────── 8 col ──────────────┘
  900–1199  Em jogo sticky (320px) | Traços com grupos lado a lado se cada grupo ≥ 240px; senão, abas
  600–899   uma coluna (máx. 600px, centralizada); "Em jogo" com 2 colunas internas (Vitalidade | recursos)
  <600      layout do celular
  ```
  Altura estimada no web: cerca de 1,3 mil px, contra os 1,66 mil de hoje, com a Vitalidade sempre visível na coluna sticky. Em todas as faixas, "Em jogo" vem primeiro no DOM (ordem de leitura e de Tab).
- **Multi-sistema:** a regra "grupos lado a lado se couberem" depende só do número de grupos e da largura mínima declarada no template (`minColWidth`). Os 6 atributos do D&D viram uma grade de 6 cartões numéricos (`layout: "grid"`). As 18 perícias do D&D e as ~60 do CoC usam `layout: "list"` com busca e várias colunas de fluxo (CSS columns), sem abas. Os aspectos do Fate (`text`) ocupam largura total. A coluna "Em jogo" sticky serve a todos.
- **Esforço:** M.

#### TL-08 · Alto · As Habilidades do Vampiro são da edição Revised, não da V20

- **Onde:** Main l.207–209 e Web l.199–201. Talentos tem "Esquiva" e falta "Consciência" (Awareness). Perícias tem "Segurança" e falta "Ladroagem" (Larceny). Conhecimentos tem "Linguística" e falta "Tecnologia". O README do DS diz "Vampiro: A Máscara (V20) primeiro". As telas de Mago e Lobisomem usam as listas M20/W20 corretas, e o Lobisomem já usa "Ladroagem" (l.233).
- **Problema:** a ficha não comporta um personagem V20 válido. O erro só aconteceu porque as listas estão escritas à mão em cada tela.
- **Impacto para quem usa:** o jogador com o livro V20 não acha onde anotar Consciência, Ladroagem e Tecnologia, e o narrador vê traços que não existem na edição.
- **Solução proposta:** corrigir para V20 (Prontidão, Esportes, Consciência, Briga, Empatia, Expressão, Intimidação, Liderança, Manha, Lábia / Empatia c/ Animais, Ofícios, Condução, Etiqueta, Armas de Fogo, Ladroagem, Armas Brancas, Performance, Furtividade, Sobrevivência / Acadêmicos, Computador, Finanças, Investigação, Direito, Medicina, Ocultismo, Política, Ciência, Tecnologia). A partir daí, a lista vem do template.
- **Multi-sistema:** a edição faz parte da identidade do sistema: `game_systems.code` = `vtm-v20`, `vtm-revised`, `dnd5e-2014`, `dnd5e-2024`, `coc7e`. Cada uma tem seu template. IDs de traço são estáveis e independentes do rótulo: "Consciência" é o Talento de Mago (`awareness`) e também a Virtude de Vampiro (`conscience`). A mesma colisão aparece no D&D ("Sabedoria" é atributo, e "Sabedoria" é Renome no Lobisomem).
- **Esforço:** P.

#### TL-09 · Médio · Vitalidade: ciclo de quatro toques, sem ordenação por gravidade, ajuda incompleta

- **Onde:** Main l.164 ("Toque na caixa para marcar: contusivo, letal, agravado."), o ciclo em l.296–300 e o estado inicial `['b','l',…]` (l.234), que mostra contusivo **acima** de letal. Web l.163 diz "Clique". Web l.166/169 usa 40px.
- **Problema:** para marcar agravado são três toques. Para limpar, um quarto toque que a ajuda não menciona. As regras de WoD ordenam o dano por gravidade (agravado, letal, contusivo, de cima para baixo), e a tela permite qualquer ordem. Não há como receber "3 de letal" de uma vez.
- **Impacto para quem usa:** penalidade calculada errada, combates lentos e marcações inconsistentes entre jogadores.
- **Solução proposta:** botões "Receber dano" e "Curar" abrem uma folha com tipo (segmentado de 44px: Contusivo `/`, Letal `X`, Agravado `✱`) e quantidade (stepper). O app insere o dano na ordem certa e recalcula a penalidade. O toque direto na caixa continua como atalho. Ajuda nova: "Toque para avançar: vazio → contusivo (/) → letal (X) → agravado (✱)." Use o mesmo verbo nas duas plataformas ("Marque"), em vez de alternar "Toque" e "Clique".
- **Multi-sistema:** o tipo `track` declara `states` (glifo, nome, ordem de gravidade), `size`, `penalties` e `fillOrder` (`severity` no WoD; `none` para os testes contra morte do D&D, que têm 3 caixas de sucesso e 3 de falha; `value` para o stress do Fate, em que cada caixa tem um valor 1/2/3). O Changeling declara duas trilhas (real e quimérica), e a Aparição declara Corpus com 10 níveis. D&D e CoC não usam `track` para PV, e sim `pool` numérico. "Receber dano" é uma ação genérica do template que aponta para o campo de saúde do sistema.
- **Esforço:** M.

#### TL-10 · Médio · A mesma ficha muda entre celular e web

- **Onde:**
  - **Humanidade:** em Vantagens com número no celular (Main l.147–158); dentro de Recursos sem número no web (Web l.150–159).
  - **Geração:** "8ª geração" ao lado da marca no celular (Main l.35); fato "Geração: 8ª" no `dl` do web (Web l.39).
  - **"Gastar sangue":** só no celular (Main l.188).
  - **"Editar ficha":** só no web (Web l.50).
  - **"Mais opções":** só no celular.
  - **Recursos:** com `h2` só no web (Web l.120).
- **Problema:** a informação muda de lugar e as ações somem conforme o dispositivo.
- **Impacto para quem usa:** quem alterna entre o notebook (preparo) e o celular (mesa) perde a referência espacial e não acha "Editar" no celular nem "Gastar sangue" no web.
- **Solução proposta:** um mesmo modelo de zonas e ações para todas as larguras (TL-04, TL-07). As ações vêm de uma lista única: a primária e a secundária ficam visíveis, e as demais vão para ⋯ nas duas plataformas.
- **Multi-sistema:** com zonas e ações declaradas no template, a paridade é automática para qualquer sistema. As ações "Descanso curto/longo" do D&D e "Teste de Sanidade" do CoC aparecem no mesmo lugar no celular e no web sem trabalho por sistema.
- **Esforço:** P (depois de TL-04 e TL-07).

#### TL-11 · Médio · O tracejado tem três significados, e os estados bloqueados têm contraste insuficiente

- **Onde:**
  - (a) Caixa bloqueada acima do permanente: `border: 1.5px dashed #3a2e33` (Main l.75, Web l.145, Mago l.105, Lobisomem l.67). Contraste de **1,39:1** sobre `surface`.
  - (b) Esfera acima do Arete: `dashed #5c4b52` (Mago l.122), **2,21:1**, cor fora dos tokens, `disabled` (sai da ordem de foco e o rótulo "acima do Arete" se perde).
  - (c) Bônus de forma: `dashed {{c}}` (Lobisomem l.102).
  - (d) Ponto perdido pela forma: `dashed #857379` (Lobisomem l.101).
- **Problema:** o mesmo padrão visual (tracejado) quer dizer "indisponível", "bônus" e "perdido". Os estados (a) e (b) ficam abaixo de 3:1 (WCAG 1.4.11). A diferença entre (c) e (d) depende só de cor. A legenda em texto do FormSelector compensa em parte, mas só para os atributos visíveis na aba atual.
- **Impacto para quem usa:** o jogador não sabe se pode comprar aquele ponto ou se é bônus temporário. Com baixa visão, os bloqueados nem aparecem.
- **Solução proposta:**
  - **Indisponível:** não desenhar. Mostrar só até o teto e escrever o teto em texto ("Força de Vontade 5 / 7").
  - **Acima do Arete:** contorno `dot-empty` com opacidade e texto "máx. 3 (Arete)" na linha.
  - **Bônus:** tracejado em `lineage` (como já é) mais o texto "+4 da forma".
  - **Perdido:** ponto com risco diagonal em `ink-muted` mais o texto "−3 da forma".
  - Documentar no DS um vocabulário único: cheio = tem, vazio = não tem, tracejado = modificador temporário.
- **Multi-sistema:** "modificador temporário" é genérico: buff/condição no D&D ("Abençoado +1d4", "Envenenado: desvantagem"), "Ferido" no PbtA e um aspecto invocado no Fate (+2). O renderizador mostra `base`, `modifier` e `effective` para qualquer tipo. Em `rating` é tracejado, em `number` é "16 → 18 (+2)", em `percent` é "60% (½ por dificuldade)". O teto também é genérico (`cap: { field }`): Esferas ≤ Arete, slots ≤ nível de conjurador, Sanidade ≤ 99 − Mythos.
- **Esforço:** P.

#### TL-12 · Médio · Cor de linhagem fora do escopo, e pares que se confundem apesar da promessa do DS

- **Onde:** botão "Gastar Fúria" com `border: 1.5px solid {{c}}` (Lobisomem l.205); "+" de Quintessência com borda `{{c}}` e "+" de Paradoxo com borda `#d8e6f2` (Mago l.81, l.86); retrato com borda `{{c}}` (Main l.38, Web l.30, Mago l.39, Lobisomem l.39). Contrastes calculados sobre os tokens `noite`: Fúria × Gnose para **Presas de Prata** (`#c8ccd8` × `#e6e0c8`) dá **1,21:1** e para **Wendigo** dá **1,26:1**. Quintessência × Paradoxo para **Eutanatos** dá **1,62:1** e para **Coro Celestial** dá **1,44:1**.
- **Problema:** o README limita `lineage` a pontos, caixas, régua de título e `LineageMark`, e diz que `paradoxo` "só aparece na roda". Botão é ação, e ação é `ouro` ou contorno `line-strong`. Além disso, "a Gnose nunca se confunde com a Fúria" e "o Paradoxo nunca pode ser confundido com a Quintessência" deixam de valer para quatro linhagens.
- **Impacto para quem usa:** botões coloridos competem com os dados do personagem. Um Presas de Prata lê Fúria e Gnose quase iguais, e um Eutanatos lê a roda como um bloco só.
- **Solução proposta:** botões em `.g-btn` padrão (contorno `line-strong`). Retrato com borda `line-strong`, ou o DS formaliza o "Retrato" como elemento do personagem. Para os pares que colidem, além da cor, use padrão de preenchimento na caixa de Gnose (meia-lua) e no segmento de Paradoxo (hachura), e valide no DS que todo acento tenha pelo menos 3:1 contra `gnose` e `paradoxo`.
- **Multi-sistema:** o problema se repete sempre que dois recursos ficam lado a lado (PV × PV temporários no D&D, Sanidade × Sorte no CoC, stress físico × mental no Fate). Regra genérica: recursos vizinhos se distinguem por **rótulo + forma ou padrão**, e cor é reforço. O template declara `colorRole` (`accent`, `neutral-a`, `neutral-b`), e o DS garante o contraste entre os papéis.
- **Esforço:** P.

#### TL-13 · Médio · As abas escondem informação necessária ao mesmo tempo

- **Onde:** Atributos e Habilidades com abas no celular (Main l.83–88, 106–111). No Lobisomem, trocar de forma força a aba Físicos (l.331), e a penalidade de Manipulação −3 e o zero de Aparência no Crinos ficam escondidos na aba Sociais.
- **Problema:** uma rolagem combina Atributo + Habilidade de grupos diferentes (Raciocínio + Briga). Com abas, o jogador alterna duas abas em duas seções. Na forma Crinos, os efeitos negativos não aparecem.
- **Impacto para quem usa:** rolagens erradas (esquecer o −3 de Manipulação) e muitos toques.
- **Solução proposta:**
  - Atributos no celular: os 9 em uma grade 3×3 compacta (nome curto e pontos; cabe em 326px com 3 colunas de ~105px), sem abas.
  - Habilidades: manter abas, mas com um filtro "só as que tenho" ativo por padrão, o que reduz a lista de 30 para cerca de 15.
  - Na troca de forma, um resumo fixo sob o FormSelector: "Crinos: For +4, Des +1, Vig +3, Man −3, Apa 0".
  - O fluxo "Rolar dados" deve permitir escolher atributo e habilidade em uma folha própria, sem depender da tela.
- **Multi-sistema:** o filtro "só as que tenho" é ainda mais importante no CoC (cerca de 60 perícias, a maioria no valor-base, então o filtro vira "acima da base") e nas perícias do D&D ("proficiente"). O template declara `layout` por seção (`grid` para os 6 atributos do D&D, `groups+tabs` para WoD, `list+search` para CoC), e o renderizador escolhe.
- **Esforço:** M.

#### TL-14 · Médio · Navegação: a crônica não é link, o web não tem "voltar", e "Mais opções" está indefinido

- **Onde:** o nome da crônica é `<span>` (Main l.24, Mago l.25, Lobisomem l.24). Web: "Noites de São Paulo · Narrador" é texto (l.26), o link ativo "Personagens" só se distingue por cor e não tem `aria-current` (l.23–24), e não há menu ⋯. No Lobisomem, a crônica "Seita da Serra do Mar" repete o fato "Seita" (l.48).
- **Problema:** o único caminho de volta no celular é o ícone ‹. No web, não há caminho direto para a crônica. O conteúdo do menu ⋯ não está especificado.
- **Impacto para quem usa:** desorientação ao alternar entre personagens da mesma crônica. Quem não enxerga cor não sabe em que seção do web está.
- **Solução proposta:**
  - Cabeçalho: "‹ Noites de São Paulo" como um só alvo (ícone + nome, ≥44px) que volta para a crônica.
  - Web: breadcrumb "Crônicas › Noites de São Paulo › Helena Varga" com `aria-current="page"`.
  - Conteúdo do ⋯: Editar ficha · Histórico de alterações · Trocar de personagem (na crônica) · Tema (Noite/Pergaminho) · Exportar/Imprimir · Compartilhar com o narrador · Arquivar · Excluir (com confirmação, ver "Telas e estados que faltam").
- **Multi-sistema:** o cabeçalho e o menu são do esqueleto e não variam por sistema. Só os itens de ação do sistema ("Descanso longo", "Teste de Sanidade") entram pela lista `actions` do template.
- **Esforço:** P.

#### TL-15 · Médio · As ações principais não têm fluxo, e os poderes não abrem

- **Onde:** "Rolar dados" é a ação primária no Vampiro e no Lobisomem e não tem `onClick` (Main l.184, Lobisomem l.201). "Gastar sangue" não tem handler (Main l.188). "Conjurar efeito" não tem fluxo, e o Mago não tem seção de Rotinas (Mago l.221). Os Dons são `<li>` sem toque, sem custo e sem descrição (Lobisomem l.160–163).
- **Problema:** a ação mais importante da tela não está desenhada. Os poderes, que são o motivo de abrir a ficha durante o jogo, não mostram sistema, custo nem dificuldade.
- **Impacto para quem usa:** o jogador ainda precisa do livro na mesa, e o app vira só um bloco de anotações.
- **Solução proposta:** folha "Rolar" com:
  - parada (Atributo + Habilidade; os dois pré-selecionados se a pessoa veio de um traço);
  - dificuldade (stepper);
  - especialização (toggle);
  - penalidade de Vitalidade aplicada automaticamente;
  - Força de Vontade (toggle, +1 sucesso, gasta 1);
  - resultado com sucessos, 1s e falha crítica.

  Linha de poder tocável, que abre uma folha com descrição, custo ("1 Gnose"), parada sugerida e "Rolar". "Gastar sangue" decrementa e mostra snackbar com Desfazer.
- **Multi-sistema:** o motor de dados tem poucos "tipos de rolagem" genéricos, e o template só os parametriza:
  - `pool-success` (WoD: Nd10 contra dificuldade, conta sucessos);
  - `sum-vs-target` (D&D: 1d20 + modificador contra CA ou CD, com vantagem e desvantagem);
  - `roll-under-percent` (CoC: 1d100 ≤ valor, com graus normal, difícil (½) e extremo (⅕), bônus e penalidade);
  - `fudge` (Fate: 4dF + perícia contra oposição);
  - `pbta-2d6` (2d6 + stat: 6−, 7–9, 10+).

  Poderes (`list` com `itemSchema`) servem para Disciplinas, Dons, Rotinas, magias do D&D (nível, escola, preparada, componentes), moves do PbtA (texto + checkbox) e façanhas do Fate.
- **Esforço:** G (rolagem) e M (poderes).

#### TL-16 · Médio · Estrutura acessível: headings, landmarks, abas e anúncios

- **Onde:**
  - Recursos sem heading no celular (`section aria-label`, Main l.50). O cartão do Mago tem `aria-label="Arete, Quintessência e Paradoxo"`, mas também contém a Força de Vontade (l.51). A identidade do Lobisomem é um `div` sem semântica de `dl` (l.42–50).
  - Não há `<main>`. A barra fixa não tem rótulo (Main l.183).
  - `role="tablist"` sem `aria-controls`, sem `role="tabpanel"` e sem setas, porque todas as abas recebem Tab.
  - Contadores sem `aria-live`.
  - Os pontos de bônus repetem "Bônus da forma Crinos" a cada ponto (Lobisomem l.306).
  - O formulário de forma usa `role="group"` com `aria-pressed`, quando é escolha única.
- **Problema:** quem navega por headings pula direto do nome para Atributos e nunca encontra os recursos. Mudanças de valor não são anunciadas.
- **Impacto para quem usa:** leitor de tela e teclado não funcionam no fluxo de jogo.
- **Solução proposta:**
  - `h2` visível ou `h2` visualmente oculto em toda zona ("Em jogo").
  - `<main>` envolvendo a ficha. Barra de ações como `role="toolbar" aria-label="Ações da ficha"`.
  - Abas com roving tabindex (←/→) e `tabpanel` rotulado.
  - Contadores com `aria-live="polite"` ("Pontos de Sangue: 8 de 15").
  - Bônus anunciado uma vez na linha ("Força 3, mais 4 da forma, total 7").
  - Formas como `radiogroup`/`radio` com `aria-checked`.
- **Multi-sistema:** os headings e landmarks saem das zonas e seções do template (`title` obrigatório em toda seção, mesmo quando oculto visualmente). Isso garante a estrutura correta para qualquer sistema sem revisão manual por tela.
- **Esforço:** M.

#### TL-17 · Médio · Os mockups usam semântica web; a tradução para React Native não está especificada

- **Onde:** `h1/h2/h3`, `dl/dt/dd`, `position: sticky` (Main l.183), CSS grid (Main l.43, Lobisomem l.76), `:focus-visible`, `transform: rotate` na roda (Mago l.66), `padding-bottom: 20px` fixo na barra.
- **Problema:** o alvo é Expo (React Native + Web). Em RN não existem `h2` nem `dl`, `sticky` não funciona dentro de `ScrollView` como no CSS, não há `safe-area` e não há `:focus-visible`. A barra fixa cobriria o conteúdo final sem um `contentInset`. Fontes em px fixos não preveem Dynamic Type: a 200%, os 5 botões de forma (~62px cada) e as linhas de pontos (`max-width: 170px`, Lobisomem l.97) quebram.
- **Impacto para quem usa:** comportamento diferente em iOS, Android e Web, e acessibilidade nativa perdida.
- **Solução proposta:** anexar ao handoff um mapa de equivalências:
  - `h2` → `accessibilityRole="header"`;
  - aba → `accessibilityRole="tab"` + `accessibilityState={{selected}}`;
  - traço → `adjustable`;
  - barra fixa → `View` absoluta com `useSafeAreaInsets().bottom` + `paddingBottom` no `ScrollView`;
  - mini-HUD → `stickyHeaderIndices`;
  - Dynamic Type → `allowFontScaling` com `maxFontSizeMultiplier` por estilo e regra de quebra (formas em 2 linhas acima de 1,3×).
- **Multi-sistema:** o mapa é por tipo de campo e bloco, não por sistema. Um mesmo `TraitRow`/`NumberRow`/`PercentRow` nativo serve WoD, D&D e CoC.
- **Esforço:** M.

#### TL-18 · Baixo · Tipografia fora da escala

- **Onde:** fonte gótica nos números da roda (Mago l.71, 34px; l.73, 24px) e no logo "TMS" (Web l.22). Fonte da citação (`voice`) no nome de feito "Canta-Tempestade" (Lobisomem l.33, 18/22). Tamanhos fora da escala no web: h1 44/48 (l.33), citação 20/26 (l.36), `dl` 14/20 (l.37). 11px em rótulos (Mago l.72/74; Lobisomem l.78–79).
- **Problema:** viola "Gótico só nos títulos" e "`quote`: conceito e citação". O próprio `bundle.css` usa a fonte display em `.g-wheel-n` (30px) e 11px em `.g-wheel-l` e `.g-form small`, então é um conflito do DS que as telas herdaram e ampliaram (34 contra 30).
- **Impacto para quem usa:** números em gótico são menos legíveis com pouca luz.
- **Solução proposta:** números da roda em `sans` 700 28px com `tabular-nums`. Nome de feito em `title` (sans 17/22) itálico, ou um token `epithet`. Para o web, tokens `display-2xl` e `quote-lg`, ou ficar em 34/18. Um token `micro` 11/14, ou subir para 12.
- **Multi-sistema:** com tipos de valor genéricos, números (CA, PV, 60%) são frequentes em D&D e CoC, e a regra "números sempre em `sans` com `tabular-nums`" precisa valer para qualquer sistema. A fonte gótica é identidade do tema "Grimório" (WoD). Um sistema como Fate ou um D&D de fantasia clara pode pedir outra fonte display, então `fontDisplay` vira token de tema por família de sistema, não regra fixa.
- **Esforço:** P.

#### TL-19 · Baixo · Microcopy: capitalização, concordância e abreviações

- **Onde:**
  - "Força de vontade" no rótulo (Main l.63, Lobisomem l.329) e "Força de Vontade" no `aria-label` (Main l.289). "Pontos de sangue" (l.52), quando o README usa "Pontos de Sangue".
  - "Hominídea" (Lobisomem l.43), "Raça · Hominídeo" (l.160) e a forma "Hominídeo" na mesma tela.
  - "Quint." e "Parad." (Mago l.80, 85).
  - "{{perm}} · {{temp}} temporário" no Renome (l.138), que fica ambíguo e com concordância estranha ("Glória 3 · 4 temporário").
  - "Toque" no celular e "Clique" no web.
  - "Posto 2 · Fostern": confirmar com a edição brasileira se mantém "Fostern".
- **Problema:** inconsistências pequenas que, somadas, passam descuido. Abreviações atrapalham a leitura e o leitor de tela.
- **Solução proposta:**
  - Termos de regra com a capitalização do livro (Força de Vontade, Pontos de Sangue, Ferido Gravemente), em um glossário único no template.
  - Raça como termo de regra no masculino ("Hominídeo"), igual em todos os lugares.
  - Na roda, "Quintessência" e "Paradoxo" por extenso, em duas linhas, acima dos −/+.
  - Renome: "Permanente 3 · Temporário 4".
  - Verbo neutro "Marque".
- **Multi-sistema:** os rótulos e o glossário ficam no template, por sistema e por idioma (`labels.pt-BR`), nunca no código. Isso também resolve as traduções de D&D ("Classe de Armadura", "Pontos de Vida") e CoC ("Sanidade", "Sorte").
- **Esforço:** P.

#### TL-20 · Baixo · Espaçamentos fora da escala

- **Onde:** margem entre seções de 28px (todas as telas; Lobisomem l.85 usa 24px). Margem do cartão de recursos de 20px (Main l.50). Gaps de 14px e 10px. Gap de 6px entre pontos, quando `space-1` = 4px ("Entre ponto e ponto").
- **Problema:** o ritmo vertical fica desigual entre telas e diverge do DS (`space-6` = 24px "Entre seções da ficha").
- **Solução proposta:** 24px entre seções, 16px para o cartão de recursos e 12px nos gaps internos. Para os pontos, ou o DS adota 6px (`.g-dots` já usa 6px), ou as telas usam 4px. É uma decisão do DS.
- **Multi-sistema:** o espaçamento é do esqueleto. Nenhum sistema define espaçamento no template, só `density: "compact"` para listas longas (inventário do D&D, perícias do CoC).
- **Esforço:** P.

#### TL-21 · Baixo · Posto mostrado como número solto

- **Onde:** "Posto 2 · Fostern" (Lobisomem l.36); "Posto 1/2" nos Dons (l.160–163).
- **Problema:** Posto é um traço de 0 a 5 (até 6 em W20), e o README pede `TraitDots`: "o número pode vir junto, nunca no lugar".
- **Solução proposta:** no cabeçalho, "Fostern ●●○○○". Nos Dons, "Posto ●●" ou o texto "Nível 2" (aqui é requisito, não traço).
- **Multi-sistema:** a regra "pontos são a linguagem" é de WoD. No template, cada campo declara `display` (`dots`, `number`, `percent`, `ladder`). O equivalente no D&D é "Nível 5" (número), no CoC não há, e no Fate é a escada de perícias ("Bom (+3)").
- **Esforço:** P.

---

### Divergências do design system

| Tela | Trecho | Regra violada | Correção |
|---|---|---|---|
| Todas | `background: #120e10`, `#1b1518`, `color: #efe6e1`, `#ab9c9f` (por exemplo, Main l.18, l.50) | "Nenhum componente usa cor literal" | `var(--bg)`, `var(--surface)`, `var(--ink)`, `var(--ink-muted)`; usar `.g-card`, `.g-trait` |
| Todas | `const COLORS = {…}` + `{{c}}` (Main l.193; Web l.184; Mago l.228; Lobisomem l.210) | "Defina a linhagem com `data-lineage` na raiz" | `<div data-lineage="tremere">` + `var(--lineage)`; remover os mapas |
| Mago | `border: 1.5px dashed #5c4b52` (l.122) | Cor fora dos tokens; 2,21:1 < 3:1 | `dot-empty` com opacidade e texto "máx. (Arete)" |
| Main, Web, Mago, Lobisomem | `border: 1.5px dashed #3a2e33` em caixa bloqueada (Main l.75, Web l.145, Mago l.105, Lobisomem l.67) | `line` é "decorativa: não carrega significado sozinha"; 1,39:1 | Não desenhar caixas acima do teto; teto em texto |
| Todas | Ponto `<button>` de 14×14 (Main l.95) | `hit-size` 44px | Linha como controle único `adjustable`; −/+ de 44px no modo edição |
| Todas | Caixa `<button>` de 22×22 (Main l.55, Lobisomem l.65, l.148) | `hit-size` 44px | Caixas só de exibição + stepper de 44px (padrão da `QuintessenceWheel`) |
| Web | `min-height: 40px` (l.104, l.166); botão 40×40 (l.169) | `hit-size` 44px | 44px |
| Lobisomem | "Gastar Fúria" `border: 1.5px solid {{c}}` (l.205) | `lineage` só no que é do personagem; `Button` padrão usa `line-strong` | `.g-btn` padrão |
| Mago | "+" com borda `{{c}}` e `#d8e6f2` (l.81, l.86) | Idem; "`paradoxo` só aparece na roda" | `.g-btn` padrão; cor só nos segmentos |
| Todas | Retrato `border: 2px solid {{c}}` (Main l.38, Web l.30, Mago l.39, Lobisomem l.39) | Usos de `lineage` listados no README não incluem retrato | `line-strong`, ou formalizar "Retrato" no DS |
| Mago | Números da roda em Grenze Gotisch 34px/24px (l.71, l.73) | "Gótico só nos títulos" (o DS também viola em `.g-wheel-n`, 30px) | `sans` 700 28px `tabular-nums`; corrigir o componente |
| Web | "TMS" em Grenze Gotisch 22px (l.22) | "Gótico só nos títulos" | Logotipo como asset, ou `label` |
| Lobisomem | "Canta-Tempestade" em Cormorant 18/22 (l.33) | `quote` é para conceito e citação; line-height 24 | `title` itálico, ou token `epithet` |
| Web | h1 44/48 (l.33), citação 20/26 (l.36), `dl` 14/20 (l.37) | Escala tipográfica (`display-xl` 34/38, `quote` 18/24, `caption` 13/18) | Tokens novos (`display-2xl`, `quote-lg`) ou valores da escala |
| Mago, Lobisomem | 11px (Mago l.72, 74; Lobisomem l.78–79) | Não há token de 11px (`label` = 12) | Token `micro`, ou 12px |
| Todas | Margens de 28px, 20px; gaps de 14px, 10px | Escala de espaço 4/8/12/16/24/32; "entre seções: `space-6`" | 24 / 16 / 12 |
| Main, Web | `h3` de grupo em estilo `label` (Main l.131, Web l.60) | README: `title` (17/700) para grupo; o componente `.g-group-h` usa `label`, o que é conflito interno do DS | Decidir no DS; as telas seguem o componente |
| Main, Mago, Lobisomem | Botões de 48px, 16px | `.g-btn`: `hit-size` 44, 15/20 | Seguir o componente ou atualizar o DS |
| Main, Mago, Lobisomem | Barra de ações fixa (Main l.183) | Não existe componente no DS | Criar `ActionBar` (safe-area, 1 primária + 1 secundária + ⋯) |
| Web | 3 colunas `flex: 1 1 340px` (l.56, 97, 119) | "Duas colunas de seções a partir de 900px" | Grid de 2 zonas (TL-07) |
| Web | Grupos empilhados na coluna (l.58–75, 99–116) | `Tabs`: "a partir de 900px, mostre os grupos lado a lado" | Grupos em 3 colunas dentro da seção |
| Lobisomem | Identidade em `div` sobre `surface` (l.42–50); Vampiro/Mago em `dl` sem cartão | Consistência (`Cover`) | Um componente `FactList` (`dl`) em todas |
| Lobisomem | Lua com literal `#e6e0c8` e `translateX(72%)` inline (l.45) | `AugurMoon` com `--shadow` e `var(--gnose)` | `.g-moon` com `--shadow` |
| Mago | "Afinidade" em `lineage` como texto de 13px (l.117) | Prescrito pelo `Spheres`, mas `lineage` só garante 3:1 (texto pede 4.5:1); passa no tema `noite` (5,4–7,2:1), em risco no `pergaminho` | Marcador em `lineage` + texto em `ink-muted`, ou garantir 4.5:1 |
| Lobisomem | "Posto 2" como número (l.36) | "Todo traço de 0 a 5 aparece como `TraitDots`" | Pontos + nome do posto |

Pontos conformes: uma coluna até 600px nos boards de celular; a citação aparece uma vez por tela; há uma ação primária `ouro` por tela; a `LineageMark` tem sempre o nome; as abas usam no máximo 3 grupos.

---

### Telas e estados que faltam

**Navegação e listas**
- Início sem crônicas (onboarding: "Criar crônica" / "Entrar com convite").
- Lista de crônicas (sistema, narrador, número de personagens, última sessão).
- Detalhe da crônica: personagens, convite de jogadores, configurações do narrador.
- Lista "Meus personagens" de todas as crônicas, com filtro por sistema.
- Versões web, e de tablet, de Mago e Lobisomem. Só o Vampiro tem board web, e a roda e o FormSelector em 2 colunas não estão definidos.

**Ciclo de vida da ficha**
- **Criação de personagem**: assistente com escolha de crônica (o sistema vem dela), linhagem, conceito, distribuição de pontos com contador (7/5/3 em Atributos, 13/9/5 em Habilidades), vantagens e pontos de bônus, com validação e "salvar rascunho". No modelo atual, `characters.chronicle_id` é `NOT NULL`, então o fluxo precisa começar pela crônica, ou o modelo precisa aceitar personagem avulso.
- **Ficha vazia ou recém-criada**: zeros, "Nenhuma Disciplina · Adicionar", retrato padrão.
- **Modo leitura / jogo / edição** (TL-01), com indicador de modo visível.
- Adicionar item a listas abertas (Disciplinas, Antecedentes, Dons, Rotinas) a partir de um catálogo com busca.
- Folha de detalhe do traço ou poder (descrição, especialização, rolar).
- **Rolagem de dados** (TL-15) e histórico de rolagens da sessão.
- Experiência: saldo, custo por traço e solicitação de aprovação ao narrador.
- Personagem arquivado, morto ou em torpor (somente leitura, com marca visual).

**Feedback e sistema**
- **Carregamento**: skeleton da ficha (cabeçalho + "Em jogo" + linhas).
- **Salvando / salvo / falha ao salvar**, com indicador discreto no cabeçalho.
- **Offline na mesa**: fila local de alterações, aviso "sem conexão, alterações serão enviadas", e **conflito** quando narrador e jogador editam ao mesmo tempo (o que fazer se o narrador aplicou dano enquanto o jogador gastava sangue).
- **Erro** de carregamento com "Tentar de novo", e ficha não encontrada ou sem permissão.
- **Desfazer** (snackbar de 5s) e **Histórico de alterações** por ficha (quem mudou, quando, de/para).
- **Confirmação destrutiva**: excluir personagem (digitar o nome), sair da crônica, "Zerar dano", "Descartar edições". Prefira desfazer a confirmar nas ações frequentes.
- Recuperação por período ("Nova noite": recupera sangue e Força de Vontade conforme a regra), com prévia antes de aplicar.

**Narrador**
- **Painel da mesa**: grade com o "Em jogo" de cada personagem (Vitalidade, recursos, penalidade), com aplicar dano em grupo e iniciativa.
- Ver e editar a ficha de um jogador, com marca "editado pelo narrador".
- **Notas privadas do narrador** por personagem, que não são enviadas ao cliente do jogador (não basta escondê-las na interface).
- Aprovar gastos de XP e alterações de ficha.

**Tema e saída**
- Tema `pergaminho` aplicado às telas.
- Impressão / PDF.
- Retrato: upload, recorte, remover, e o fallback de iniciais já existe.

**Nota de segurança (security by design).** O modo leitura/edição é UX, não controle de acesso. A API precisa validar no servidor:
- AuthZ por papel. Dono edita a própria ficha. O narrador da crônica (`chronicles.storyteller_id`) edita qualquer ficha da crônica. Outros jogadores apenas leem, se a crônica permitir. Na falta de regra, negar.
- Cada alteração de `sheet_data` contra o template (tipo, mín./máx., tetos como Esferas ≤ Arete). Restrições do cliente são só conveniência.
- Notas renderizadas como texto puro (sem HTML), para evitar XSS no build web.
- O histórico de alterações deve registrar autor e campo, sem copiar conteúdo de notas para logs.

---

### Acoplamento a WoD: o que quebra com outro sistema

| # | Acoplamento nas telas atuais | Onde | O que quebra em outros sistemas | Generalização |
|---|---|---|---|---|
| 1 | **Ordem de seções fixa no markup** (Atributos → Habilidades → Vantagens → Vitalidade → Notas) | Estrutura das 4 telas | D&D: Atributos → Salvaguardas → Perícias → Combate → Ataques → Magias → Inventário. Fate: Aspectos → Perícias → Façanhas → Stress. | Zonas fixas (`identity`, `play`, `build`, `powers`, `lore`); a ordem das seções dentro da zona vem do template |
| 2 | **Barra de recursos específica** (Sangue + Força de Vontade; Arete + roda + Força de Vontade; Fúria + Gnose + Força de Vontade) | Main l.50–79, Mago l.51–109, Lobisomem l.52–72 | D&D: PV atual/máx./temp., Dados de Vida, testes contra morte, slots por nível. CoC: PV, PM, Sanidade, Sorte. Fate: pontos de destino, recarga. | Zona `play` com blocos `pool`, `track`, `slots`, `wheel`, `clock` declarados no template |
| 3 | **Vitalidade de 7 níveis** com penalidades e 3 tipos de dano em constante (`LEVELS`, `KINDS`, `GLYPH`) | Main l.217–220 (e cópias) | D&D/CoC: PV numérico. Fate: stress com caixas de valor + consequências (texto). Changeling: duas trilhas. Aparição: Corpus com 10 níveis. | `track` configurável (`size`, `states`, `penalties`, `fillOrder`) ou `pool` numérico |
| 4 | **"Tudo é ponto 0–5/10"** (único componente de valor) | Todas as linhas | D&D: 3–20 + modificador. CoC: 0–99% com ½ e ⅕. Fate: escada +0…+5 com adjetivo. PbtA: −1…+3. | Tipos `rating`, `number`, `percent`, `ladder`, `signed`, com `display` por campo |
| 5 | **Atributos 3×3 com abas Físicos/Sociais/Mentais** | Main l.83–101 | D&D: 6 atributos sem grupo. CoC: 8 características. Fate: não tem. PbtA: 4–5 stats. | `layout: grid / groups / list`; abas só quando houver 2–3 grupos e a largura não couber |
| 6 | **Habilidades em 3 grupos de ~10, com abas** (`Tabs` limitado a 3) | Main l.106–124 | CoC: cerca de 60 perícias alfabéticas com valor-base. D&D: 18 perícias ligadas a atributos. | `layout: list` + busca + filtro "só as que tenho" / "acima da base" |
| 7 | **Especialização** sob o nome do traço | Main l.92 (`SPEC`) | D&D: proficiência/especialização (flags que mudam o bônus). CoC: checkbox "marcar para evolução". | Campo genérico `flags[]` e `note` por traço, declarados no template |
| 8 | **Identidade com fatos WoD** (Senhor, Geração, Natureza, Comportamento, Casa, Raça/Augúrio) | Main l.43–48, Mago l.44–49, Lobisomem l.42–50 | D&D: classe/nível, espécie, antecedente, alinhamento, XP. CoC: ocupação, idade, residência. Fate: conceito e dificuldade (aspectos). | Bloco `facts` com lista de campos `text/choice` do template |
| 9 | **"Linhagem" = clã/tribo/tradição** e tokens `cla-*`, `trad-*`, `tribo-*` | `COLORS` nas 4 telas; DS | D&D não tem linhagem nesse sentido. Um "acento por classe" exigiria tokens novos no DS. | `accent` no template mapeando um campo para uma paleta genérica `accent-N` |
| 10 | **Ações da barra fixas** ("Gastar sangue", "Conjurar efeito", "Gastar Fúria") e ícone de d10 | Main l.183–189, Mago l.218–224, Lobisomem l.200–206 | D&D: "Atacar", "Conjurar magia" (gasta slot), "Descanso curto/longo". CoC: "Teste de Sanidade". Fate: "Invocar aspecto" (gasta ponto de destino). | `actions[]` no template: `roll` (tipo de rolagem), `adjust` (campo, delta), `recover` (período) |
| 11 | **Motor de rolagem implícito WoD** (parada de d10) | Botão "Rolar dados" | d20 + mod, d100 roll-under, 4dF, 2d6 + stat | 5 tipos genéricos de rolagem parametrizados (TL-15) |
| 12 | **Listas de poderes como `<li>` fixos** (Dons com Posto) | Lobisomem l.159–164 | Magias do D&D (nível, escola, preparada, componentes, slots), inventário longo (qtd., peso, equipado, moedas), moves do PbtA (texto longo + checkbox) | `list` com `itemSchema`, busca, ordenação, agrupamento |
| 13 | **Texto só no fim** (Notas, Foco) | Main l.178–181, Mago l.193–200 | Fate e PbtA: aspectos e moves *são* a ficha e precisam estar no topo e editáveis em jogo | `text`/`longText` como tipos de primeira classe em qualquer zona |
| 14 | **Restrições em JS por tela** (Esferas ≤ Arete, Força de Vontade temporária ≤ permanente, Quintessência + Paradoxo ≤ 20, forma) | Mago l.280, l.328–334; Lobisomem l.263 | D&D: slots por nível de conjurador; PV máx. derivado de CON e nível. CoC: Sanidade máx. = 99 − Mythos. | `cap`, `derived` (fórmula em AST JSON) e `modifiers` declarativos |
| 15 | **Formas com modificadores somados** | Lobisomem l.223–229 | D&D: Forma Selvagem *substitui* atributos físicos; Fúria do bárbaro dá vantagem e resistência. Changeling: Seelie/Unseelie. | `mode` com `modifiers` (`add`, `set`, `replace`) |
| 16 | **Layout web com 3 colunas calibradas para WoD** | Web l.54–178 | Qualquer sistema com outra proporção de conteúdo (inventário enorme no D&D) desbalanceia as colunas | Grid por zona (TL-07), sem colunas por seção |
| 17 | **Rótulos no código e no markup** (`ATTR`, `ABIL`, "Pontos de sangue") | Scripts e HTML | Todo sistema novo exigiria código | Rótulos e glossário no template (`labels.pt-BR`) |
| 18 | **Permissão por ficha inteira** (implícita) | — | Aparição: a Sombra é editada por outro jogador (o "Sombra-narrador"). Mesa com "GM vê PV dos monstros". | `permissions` por seção no template (`owner`, `storyteller`, `role:shadowguide`), validadas no servidor |

---

### Proposta de estrutura data-driven

#### Princípio

O código conhece **tipos de campo**, **tipos de bloco**, **zonas** e **tipos de rolagem**, todos genéricos. O template conhece **o sistema**: quais campos existem, com que rótulos e limites, em que seção e zona aparecem, que fórmulas derivam valores, que ações a barra oferece. Para entrar um sistema novo, basta inserir uma linha em `trait_templates` (e em `game_systems`). Não há migration nem tela nova. Só um *tipo* de campo inédito (por exemplo, um baralho de tarô) exige código, e esse tipo passa a servir todos os sistemas.

#### O que fica no template e o que fica no código

| No template (`trait_templates.template_data`, por sistema e edição) | No código (uma vez, para todos os sistemas) |
|---|---|
| Lista de campos: id estável, tipo, mín./máx., `display`, rótulo pt-BR, ajuda | Um componente por tipo de campo (`rating`, `number`, `percent`, `ladder`, `check`, `text`, `choice`, `pool`, `track`, `slots`, `clock`, `wheel`, `list`, `mode`) |
| Seções: título, zona (`tier`), `layout`, grupos, ordem | Esqueleto de zonas, breakpoints, mini-HUD, abas automáticas |
| Restrições (`cap`), derivados (`derived`, AST JSON), modificadores (`mode`) | Avaliador de fórmulas próprio (operações em lista branca, sem `eval`/`new Function`, limite de profundidade) e validador compartilhado cliente/servidor |
| `editableIn` (`play` / `edit`), `permissions` por seção | Modos jogo/edição/leitura, desfazer, histórico, AuthZ no servidor |
| `actions[]`: tipo de rolagem e parâmetros, ajustes, recuperação por período | Motor de dados com 5 tipos (`pool-success`, `sum-vs-target`, `roll-under-percent`, `fudge`, `pbta-2d6`) |
| `accent`: campo → `accent-N`; fallback para a cor do sistema | Tokens, temas, paleta `accent-N` validada |
| Catálogos (Disciplinas, Dons, magias) ou referência a um catálogo | Folha de busca e seleção genérica para `list` |
| `hud: true` nos campos do mini-HUD | Componente de mini-HUD |
| `templateVersion` | Migração de `sheet_data` entre versões do template (função genérica por mapa de ids) |

Modelo de dados: hoje `trait_templates` tem `system_id` e `template_data` jsonb, o que basta. A versão e a edição podem ir dentro do jsonb (`templateVersion`) e em `game_systems.code` (`vtm-v20`), sem migration. `sheet_data` guarda valores por id estável e o `templateVersion` com que foi criado.

#### Esquema (resumo)

```json
{
  "schema": 1,
  "system": "vtm-v20",
  "templateVersion": "1.0.0",
  "accent": { "from": "identity.clan", "map": { "tremere": "accent-1", "ventrue": "accent-7" }, "fallback": "accent-system" },
  "fields": {
    "identity.clan": { "type": "choice", "label": "Clã", "options": ["tremere", "ventrue"] },
    "str":     { "type": "rating", "min": 1, "max": 5, "label": "Força", "editableIn": ["edit"] },
    "blood":   { "type": "pool", "display": "boxes", "label": "Pontos de Sangue", "hud": true,
                 "max": { "lookup": "bloodPool", "key": "identity.generation" } },
    "wp":      { "type": "pool", "display": "dots+boxes", "label": "Força de Vontade", "permanent": { "min": 1, "max": 10 }, "hud": true },
    "health":  { "type": "track", "preset": "wod-7", "fillOrder": "severity", "hud": true },
    "disciplines": { "type": "list", "item": { "name": "text", "value": { "type": "rating", "max": 5 } }, "catalog": "vtm-disciplines" }
  },
  "sections": [
    { "id": "play",  "tier": "play",  "title": "Em jogo",   "blocks": ["health", "blood", "wp", "humanity"] },
    { "id": "attr",  "tier": "build", "title": "Atributos", "layout": "groups",
      "groups": [ { "title": "Físicos", "fields": ["str", "dex", "sta"] } ] },
    { "id": "adv",   "tier": "powers","title": "Vantagens", "blocks": ["disciplines", "backgrounds", "virtues"] },
    { "id": "about", "tier": "lore",  "title": "Sobre",     "blocks": ["quote", "facts", "notes"], "collapsed": true }
  ],
  "actions": [
    { "id": "roll",  "label": "Rolar dados",   "primary": true, "roll": { "kind": "pool-success", "die": 10, "difficulty": 6 } },
    { "id": "spend", "label": "Gastar sangue", "adjust": { "field": "blood", "by": -1 } },
    { "id": "night", "label": "Nova noite",    "recover": { "blood": -1, "wp": "+1" } }
  ]
}
```

#### Os três sistemas WoD com o mesmo esquema (só o que muda)

| Zona | Vampiro (`vtm-v20`) | Mago (`mta-m20`) | Lobisomem (`wta-w20`) |
|---|---|---|---|
| `identity` | Clã (`accent`), "8ª geração", Senhor | Tradição (`accent`), Essência, Casa | Tribo (`accent`), Posto (`rating`), Augúrio (`choice` com ícone de lua), Raça, Seita, Totem |
| `play` | `track` wod-7, `pool` Sangue (máx. derivado da Geração), `pool` Força de Vontade, `rating` Humanidade (10) | `track` wod-7, `wheel` Quintessência/Paradoxo (capacidade 20), `pool` Força de Vontade, `rating` Arete (10) | `track` wod-7, `pool` Fúria (`colorRole: accent`), `pool` Gnose (`colorRole: neutral-a`), `pool` Força de Vontade, `mode` Forma (5 opções com `modifiers`) |
| `build` | Atributos (`groups`), Habilidades V20 (`groups`) | Atributos, Habilidades M20 (11/11/11) | Atributos (recebem `modifiers` do `mode`), Habilidades W20 |
| `powers` | Disciplinas (`list`), Antecedentes, Virtudes | Esferas (`groups` com `cap: arete`, `flag: afinidade`), Rotinas (`list`), Antecedentes | Dons (`list`: origem, nível, custo), Renome (3 `pool` com `temporaryCap: none`), Antecedentes |
| `lore` | Citação, Conceito/Natureza/Comportamento, Notas | Citação, Foco (`facts`: Paradigma, Prática, Instrumentos), Notas | Nome de feito, citação, Conceito/Natureza/Comportamento, Notas |
| `actions` | Rolar (`pool-success`), Gastar sangue | Rolar, Conjurar efeito (`pool-success` com parada = Arete), Gastar Quintessência | Rolar, Gastar Fúria, Trocar forma |

Os blocos `wheel` e `mode` não são "coisa de Mago" ou "coisa de Lobisomem". São primitivos genéricos: dois recursos que dividem uma capacidade, e um estado que modifica outros campos.

#### Uma ficha não-WoD com o mesmo esquema: D&D 5e

```json
{
  "schema": 1,
  "system": "dnd5e-2014",
  "templateVersion": "1.0.0",
  "accent": { "from": "identity.class", "map": { "mago": "accent-3", "guerreiro": "accent-9" }, "fallback": "accent-system" },
  "fields": {
    "level": { "type": "number", "min": 1, "max": 20, "label": "Nível" },
    "prof":  { "type": "number", "label": "Bônus de proficiência",
               "derived": { "op": "add", "args": [2, { "op": "floor", "args": [{ "op": "div", "args": [{ "op": "sub", "args": ["$level", 1] }, 4] }] }] } },
    "str":   { "type": "number", "min": 1, "max": 30, "label": "Força", "display": "score+mod",
               "mod": { "op": "floor", "args": [{ "op": "div", "args": [{ "op": "sub", "args": ["$self", 10] }, 2] }] } },
    "athletics": { "type": "check", "label": "Atletismo", "flags": ["proficiente", "especialista"],
                   "bonus": { "op": "add", "args": ["$str.mod", { "op": "mul", "args": ["$prof", "$flags.weight"] }] } },
    "hp":    { "type": "pool", "display": "number", "label": "Pontos de Vida", "temp": true, "allowInput": true, "hud": true },
    "ac":    { "type": "number", "label": "Classe de Armadura", "hud": true },
    "deathSaves": { "type": "track", "label": "Testes contra a morte", "lanes": { "sucessos": 3, "falhas": 3 }, "fillOrder": "none" },
    "slots": { "type": "slots", "label": "Espaços de magia", "levels": 9, "display": "boxes" },
    "inventory": { "type": "list", "label": "Inventário", "searchable": true, "density": "compact",
                   "item": { "name": "text", "qty": "number", "weight": "number", "equipped": "check" } }
  },
  "sections": [
    { "id": "play",   "tier": "play",   "title": "Em jogo",     "blocks": ["hp", "ac", "init", "speed", "deathSaves", "slots", "conditions"] },
    { "id": "abil",   "tier": "build",  "title": "Atributos",   "layout": "grid", "fields": ["str", "dex", "con", "int", "wis", "cha"] },
    { "id": "skills", "tier": "build",  "title": "Perícias",    "layout": "list", "filter": "proficiente" },
    { "id": "spells", "tier": "powers", "title": "Magias",      "blocks": ["spellList"] },
    { "id": "inv",    "tier": "lore",   "title": "Inventário",  "blocks": ["inventory", "coins"] },
    { "id": "about",  "tier": "lore",   "title": "Sobre",       "blocks": ["facts", "notes"], "collapsed": true }
  ],
  "actions": [
    { "id": "roll",  "label": "Rolar d20", "primary": true, "roll": { "kind": "sum-vs-target", "dice": "1d20", "advantage": true } },
    { "id": "short", "label": "Descanso curto", "recover": { "hitDice": "spend" } },
    { "id": "long",  "label": "Descanso longo", "recover": { "hp": "max", "slots": "max", "hitDice": "half" } }
  ]
}
```

**Call of Cthulhu 7e, em uma linha por diferença:** características e perícias como `percent` com `display: "percent+half+fifth"`; perícias em `layout: "list"` com busca, filtro "acima da base" e `flags: ["marcada para evolução"]`; `play` com `pool` PV, PM, Sanidade (`max` derivado de `99 − $mythos`) e Sorte, todos com `allowInput`; ação primária `roll-under-percent` com bônus e penalidade; "Teste de Sanidade" como ação. Sem `accent`, ou seja, a cor do sistema.

**Fate Core:** `aspects` como `list` de `text` na zona `play`, no topo; perícias como `ladder` (+1 a +4 com rótulo "Razoável… Ótimo") em `layout: "pyramid"` (um layout novo no código, reutilizável); stress como `track` com `boxValues: [1, 2, 3]`; consequências como `list` de `text` com `slots` 2/4/6; `pool` de pontos de destino com `recover: { "session": "refresh" }`; rolagem `fudge`.

**Aparição e Changeling:** Aparição usa `track` Corpus de 10 níveis, `pool` Pathos e Angústia, `list` Paixões e Grilhões (texto + pontos) e uma seção "Sombra" com `permissions: ["role:shadowguide"]`. Changeling usa dois `track` (Vitalidade e Vitalidade quimérica), `pool` Glamour e Banalidade, `mode` Seelie/Unseelie e Artes × Reinos como dois `groups` de `rating`.

#### Regras do renderizador (código)

1. Zonas na ordem fixa `identity → play → build → powers → lore`. A zona `play` sempre vem primeiro no DOM e é a coluna sticky a partir de 900px.
2. `layout` por seção: `groups` (abas abaixo da largura mínima e lado a lado acima), `grid`, `list` (com `searchable` e `filter`), `pyramid`.
3. Campo → componente pelo `type`; aparência pelo `display`; acessibilidade pelo tipo (TL-02).
4. `editableIn` decide o controle de cada modo; `permissions` decide quem vê e quem edita (validado no servidor).
5. `hud: true` alimenta o mini-HUD (até 4 campos).
6. Fórmulas: AST JSON com as operações `add`, `sub`, `mul`, `div`, `floor`, `ceil`, `min`, `max`, `lookup`, `if` e referências `$campo`. Interpretadas por um avaliador próprio. Nunca `eval`.
7. Validação: o mesmo validador (gerado do template) roda no cliente (UX) e no servidor (autoridade) a cada escrita em `sheet_data`. O template é validado contra um JSON Schema quando é inserido, por um perfil administrativo.

Com isso, as quatro telas atuais saem do mesmo renderizador, e D&D 5e, CoC e Fate entram como dados.

---

## Anexo C: UX no celular (relatório completo)


Avaliação de usabilidade no celular das telas `Main.dc.html` (Vampiro), `Mago.dc.html` e `Lobisomem.dc.html`, com `Web.dc.html` como comparação. Base: código-fonte dos mockups, design system "TMS Grimório" e o protótipo renderizado no modo de visualização (escala "Fill"), usado para conferir posições e estados.

### Resumo

**Nota de usabilidade mobile: 4,5 / 10.** Para *ler* a ficha o trabalho é bom: tema escuro adequado à mesa, uma coluna, linhas de 44 px, texto de 16 px e boa base de acessibilidade. Para *jogar*, falha nas ações mais frequentes:

- toda a ficha é editável o tempo todo, com pontos de 14 px e caixas de 22 px que mudam valores sem desfazer, e com cascatas destrutivas (o Arete rebaixa Esferas);
- a Vitalidade fica a 2,6–3,7 telas do topo e a barra fixa não mostra valores, então "Gastar sangue/Fúria" muda um contador fora da tela;
- o leitor de tela não informa o valor de nenhum traço, e montar uma parada exige trocar de aba, contar pontos e lembrar a penalidade.

As soluções formam um esqueleto único (dock, sheets por tipo de valor, parada por modelo de rolagem, desfazer, sincronização) cujo conteúdo vem do `trait_templates`. O mesmo layout serve WoD, D&D 5e, CoC, Fate/PbtA, Aparição e Changeling.

### O que funciona bem no celular

- **Tema "noite" certo para a mesa.** Fundo `#120e10` não ofusca os outros jogadores e economiza bateria em OLED. Texto principal com 14,6:1 e `ink-muted` com 6,8:1 sobre `surface`.
- **Uma coluna e linhas de traço com `min-height: 44px`.** Nome do traço em 16 px à esquerda e pontos à direita, igual à ficha de papel. Veteranos reconhecem na hora.
- **A caixa de Vitalidade usa a técnica correta:** botão de 44×44 em volta de um visual de 22 px (`margin-right: -11px`), passo vertical de 45 px. É o único controle frequente que passa em alvo de toque, e o modelo para o resto da ficha.
- **Barra de ação fixa no rodapé**, dentro da zona do polegar, com botões de 48 px.
- **Contadores numéricos onde existem** ("9 / 15", "5 / 7", "Humanidade 6") com `tabular-nums`, e o lembrete "Gasto máximo por turno: 3" ao lado do Sangue.
- **Mago:** a roda tem números centrais obrigatórios e é editada por botões −/+ de 44 px, nunca pelas casas de 18 px. A decisão está documentada no README do `QuintessenceWheel`.
- **Lobisomem:** o seletor de forma tem alvos de cerca de 68×60 px, e trocar de forma leva a aba de Atributos para "Físicos", onde estão os bônus. A legenda "3 + 4 da forma = 7" explica a soma.
- **Base de acessibilidade:** `aria-label` nos botões de ícone, `role="tab"` com `aria-selected`, `aria-pressed` nas formas, `role="img"` com rótulo na roda ("Quintessência 6, Paradoxo 2, de 20 casas"), anel de foco ouro e Vitalidade anunciando o tipo de dano ("Machucado, letal").
- **Prevenção de erro pontual:** as caixas de FdV acima do permanente ficam tracejadas e não aceitam toque. As Esferas acima do Arete ficam desabilitadas.

### Personas

| Persona | Contexto na mesa | Precisa de | Risco principal hoje |
|---|---|---|---|
| **(a) Bia, novata, primeira sessão de Vampiro** | Recebeu a ficha pronta do narrador. Não sabe que Destreza é "Físico" nem que Esquiva é "Talento". Toca em tudo para descobrir o que é. | Descobrir onde está cada coisa, entender o que um toque faz e ter rede de segurança. | Tocar num ponto "para ver" altera a ficha sem ela perceber. |
| **(b) Caio, veterano há 25 anos** | Sabe a ficha de cor. Segura os d10 na mão esquerda e o celular na direita. Quer registrar dano e gastar recursos sem tirar os olhos da mesa. | Velocidade (1 ou 2 toques), números em vez de contar pontos, uso com uma mão. | Rolar 2 a 3 telas até a Vitalidade a cada golpe; alvos de 14 px com o polegar. |
| **(c) Rafa, narradora** | Conduz de 4 a 5 jogadores, com o celular apoiado ao lado do escudo. Confere Vitalidade, FdV e Humanidade e às vezes aplica dano de cena. | Visão da mesa toda, troca rápida entre fichas, leitura sem risco de alterar nada. | Abrir 4 fichas e rolar 3 telas em cada uma; alterar sem querer a ficha de um jogador. |
| **(d) Paulo, baixa visão** | Ceratocone. Usa fonte "Extra Grande" (130–200%) e às vezes VoiceOver. Sala com luz baixa. | Texto que escala, números legíveis, contraste e semântica no leitor de tela. | VoiceOver anuncia "Destreza: 3 de 5" para cada ponto, sem dizer o valor. Abas e formas quebram com fonte grande. |

### Walkthroughs

Premissas: iPhone 14 (390×844 pt). A área útil de rolagem é de cerca de **700 px** (844 − 47 da Dynamic Island − barra fixa de 95 px com o inset do home indicator). "Rolagem" = um arrasto de cerca de uma tela. As posições citadas estão na tabela de scroll em [Medições](#medições).

#### Vampiro

**V1. Tomar 2 de dano letal.** Ponto de partida: Helena tem "/" em Escoriado e "X" em Machucado. A jogadora está em Habilidades porque acabou de rolar Esquiva.

1. A narradora diz "duas letais". A jogadora procura a Vitalidade, que não aparece na tela nem na barra fixa. Rola cerca de 1.600 px passando por Vantagens e Humanidade: **2 a 3 rolagens**, sem índice.
2. Pela regra do V20, letal empurra contusivo para baixo, e o resultado correto é `X X X /`. O app não ordena nada, então ela calcula sozinha: Escoriado `/`→`X` (1 toque), Ferido vazio→`/`→`X` (2), Ferido gravemente vazio→`/` (1). **Total: 4 toques**, e só se ela souber a regra.
3. O feedback é só o glifo e a "Penalidade atual" em 13 px no parágrafo acima. Não há háptico.
4. Se tocar uma vez a mais, a caixa vira `✱` (agravado). Voltar exige 3 toques (`✱`→vazio→`/`→`X`).
5. **Contagem: 4 toques (7 ou mais com erro) e 2 a 3 rolagens.** Atritos: distância, ciclo de toques, regra não automatizada, estados inválidos permitidos (dá para marcar Ferido com Machucado vazio).
6. **Com a proposta:** chip "Vitalidade" no dock, depois "+ Letal" duas vezes. **3 toques e 0 rolagens**, com ordenação automática e aviso com Desfazer.

**V2. Gastar 1 Ponto de Sangue para curar 1 nível letal.**

1. Ela toca "Gastar sangue" na barra (1). No mockup o botão não tem ação. Mesmo implementado, o contador fica em y≈360, fora da tela se ela estiver no meio da ficha, então o toque não tem feedback visível.
2. Alternativa: rolar até o topo e tocar a caixa 9 (o valor atual) para ir a 8. O passo entre caixas é de 26 px; acertar a caixa 3 por engano deixa o Sangue em 3.
3. Rolar até a Vitalidade (2 a 3 rolagens). Para remover um `X`, o ciclo obriga a passar por agravado: `X`→`✱`→vazio (2 toques).
4. **Contagem: 3 a 4 toques e 4 a 6 rolagens** (ida e volta para conferir 8/15). Atritos: duas áreas distantes para uma única ação de regra, falta de feedback e estado intermediário errado.
5. **Com a proposta:** chip "Sangue", depois "Curar 1 nível (−1 sangue)". **2 toques e 0 rolagens.** O dock atualiza Sangue e Vitalidade, e o aviso diz "−1 Sangue, −1 letal · Desfazer".

**V3. Gastar Força de Vontade.**

1. O Vampiro não tem botão para isso. É preciso tocar a caixa temporária 5 (a última preenchida) para cair para 4: 1 toque se ela estiver no topo, mais 1 a 3 rolagens se não estiver.
2. Ambiguidade: no papel, muitos jogadores *marcam* a caixa ao gastar. A novata toca a 6ª caixa (vazia) e a FdV **sobe** para 6.
3. A fileira de pontos permanentes fica **8 px acima** das caixas. Um toque nela muda a FdV permanente e o código corta a temporária junto.
4. **Com a proposta:** chip "FdV", depois "Gastar 1" (2 toques). Ou dentro da parada de dados: "Gastar 1 FdV (+1 sucesso)" (1 toque, que é onde a FdV costuma ser gasta).

**V4. Achar Destreza + Esquiva para montar a parada.**

1. Rolar cerca de 0,2 tela até Atributos. A aba aberta é "Mentais" (`tabA: 2`), então é preciso tocar "Físicos" (1).
2. Contar os pontos de Destreza: 2 cheios em 14 px, sem número.
3. Rolar até Habilidades (0,5 a 1 tela). A aba aberta é "Conhecimentos" (`tabH: 2`), então é preciso tocar "Talentos" (1) e achar Esquiva na 4ª linha: 1 ponto.
4. A penalidade de ferimento (−1) está na Vitalidade, cerca de 1.300 px abaixo: rolar 2 telas ou lembrar.
5. Somar 2 + 1 − 1 = 2 dados. "Rolar dados" não tem fluxo definido.
6. **Contagem: 2 toques (até 6 para a novata, que não sabe a categoria), 2 a 4 rolagens, contagem de pontos e memória.**
7. **Com a proposta:** "Dados", depois Destreza e Esquiva (pela grade, pela busca ou por "Recentes"). A penalidade entra sozinha e a tela mostra "2 + 1 − 1 = 2 dados". **3 toques e 0 rolagens.**

**V5. Consultar uma Disciplina (o que Taumaturgia 3 faz?).**

1. Rolar cerca de 1,3 tela até Vantagens. A linha mostra "Taumaturgia ●●●○○ · Trilha do Sangue".
2. Não há onde tocar para ver os poderes. O gesto natural de "abrir" (tocar no ponto) **altera o valor**.
3. **Contagem: a tarefa não é possível no app.** A jogadora consulta o livro.
4. **Com a proposta:** tocar na linha abre o sheet de detalhe com níveis, especialização, notas e "Montar parada". **1 toque.**

**V6. Perder 1 ponto de Humanidade.**

1. Rolar cerca de 2 telas até Humanidade (y≈2005).
2. Tocar o 6º ponto (o valor atual, que vira 5) ou o 5º ponto. São pontos de 14 px numa fileira de 10. Errar para o 4º derruba 2 pontos.
3. Não há confirmação, registro de quem mudou nem quando.
4. **Contagem: 1 toque e 2 rolagens**, com alto risco e nenhum histórico.
5. **Com a proposta:** chip de seção "Vantagens", linha Humanidade, "Alterar valor", "−". **4 toques e 0 rolagens**, com aviso "Humanidade 6 → 5 · Desfazer" e entrada no histórico. São mais toques **de propósito**: é uma mudança permanente e rara.

#### Mago

**M1/M2. Gastar Quintessência e acumular Paradoxo.**

- Os botões −/+ ficam em y 617–661, visíveis na primeira tela: **1 toque** se a ficha estiver no topo, mais 1 a 2 rolagens se não estiver. O número no centro da roda (34 px) dá bom feedback.
- Atrito: a ordem é `[−] Quint. [+] [−] Parad. [+]`, então "Quint. +" fica a 12 px de "Parad. −". Errar o alvo dissipa Paradoxo em vez de ganhar Quintessência. Os rótulos são abreviados em 13 px muted.
- Com a roda cheia, "+ Paradoxo" tira 1 Quintessência sem aviso, e o jogador acha que é bug.
- **Com a proposta:** chip "Quint · Parad" abre um sheet com duas linhas rotuladas por extenso, cada uma com stepper próprio. **2 toques e 0 rolagens**, e o efeito colateral é anunciado.

**M3. Conferir o nível de uma Esfera antes de um efeito.**

- Rolar cerca de 1 tela até Esferas e contar os pontos de Forças (3 cheios e 2 tracejados a 2,2:1). Não há número. **0 toques e 1 rolagem.**
- Risco: tocar na linha "para selecionar" a Esfera muda o valor.
- **Com a proposta:** o número fica ao lado dos pontos. Melhor ainda: em "Conjurar", a jogadora escolhe as Esferas do efeito e vê a dificuldade calculada.

**M4. Ver o Arete.** Fica no topo do cartão (y≈346), com 10 pontos e nenhum número. São 0 toques se a ficha estiver no topo. O risco crítico é tocar o ponto 1 por engano: o Arete vai para 1 e o código **reduz permanentemente** Forças, Mente e Primórdio para 1. Voltar o Arete para 3 não devolve as Esferas. **Com a proposta**, "Arete 3" aparece na linha de identidade e só muda pelo sheet, com restrição não destrutiva.

#### Lobisomem

**L1. Trocar de Hominídeo para Crinos no combate e ver os Atributos ajustados.** Ponto de partida: Iara acabou de marcar dano na Vitalidade (y≈2600).

1. Rolar cerca de 2,8 telas até Forma (y 648–708, que na primeira tela fica parcialmente atrás da barra fixa).
2. Tocar "Crinos" (1). O alvo de 68×60 é bom.
3. Rolar cerca de 250 px até Atributos. A aba volta para "Físicos" automaticamente, o que é bom.
4. Ler a Força: 3 cheios, 2 vazios e 4 tracejados. São 9 pontos que **quebram em duas linhas** (`max-width: 170px`). O valor 7 aparece só na legenda "3 + 4 da forma = 7", em 13 px itálico muted.
5. Manipulação 0 e Aparência 0 só aparecem depois de tocar "Sociais" (1).
6. Se a mesa usa "gastar Fúria para mudar na hora", ainda é preciso tocar "Gastar Fúria" (1), e o feedback fica fora da tela.
7. **Contagem: 2 a 3 toques e 3 a 4 rolagens.**
8. **Com a proposta:** chip "Forma" no dock abre um sheet que já mostra "For 7 Des 4 Vig 6 Man 0 Apa 0" e o custo opcional em Fúria. **2 a 3 toques e 0 rolagens.** O selo "Crinos" fica no header.

**L2. Gastar Fúria.** "Gastar Fúria" funciona com **1 toque**. Mas, com a ficha rolada, a caixa que muda (y≈330–400) está fora da tela. Sem feedback, Iara toca de novo "para garantir" e gasta 2. **Com a proposta:** o chip "Fúria 3/4" muda na hora com háptico e aviso com Desfazer. São 2 toques pelo sheet, ou 1 toque longo como atalho do veterano.

**L3. Gastar Gnose.** Não há atalho. É preciso rolar até o topo (0 a 3 rolagens) e tocar a 4ª caixa de Gnose, com passo de 26 px e os pontos permanentes de Gnose 8 px acima. **Com a proposta:** puxar o dock, depois "Gnose −1". **2 gestos e 0 rolagens.**

**L4. Ver o Renome.** Rolar cerca de 1,8 tela. A leitura "3 · 4 temporário" é boa, mas o bloco tem 60 controles editáveis (3 × 10 pontos + 3 × 10 caixas) para uma consulta. **Com a proposta:** chip "Renome" leva a uma lista de leitura "Glória 3 (4 temp.)" etc. **1 toque.**

#### Geral

**G1. Abrir a ficha a partir da crônica e voltar.** A tela da crônica não está nos mockups. Para voltar há três caminhos: o "‹" de 44×44 no canto superior esquerdo (a zona mais difícil para o polegar direito), o gesto de borda do iOS ou o botão voltar do Android. O rótulo "Crônica · Noites de São Paulo" não é tocável. Ao reabrir a ficha, as abas voltam ao padrão e a rolagem volta ao topo. **Com a proposta:** stack nativo com gesto, posição e filtros preservados por personagem, e um pager entre fichas no painel da narradora.

**G2. Editar um traço de 2 para 3 e desfazer um toque errado.**

1. Tocar o ponto 3 (14 px).
2. Se acertar o 4, o valor vira 4 e é preciso tocar o 3 de novo.
3. Se acertar o 2, que é o valor atual, o valor **cai para 1**: tocar no valor atual reduz 1, um comportamento surpreendente.
4. Não há desfazer, háptico nem sinal de "salvo".
5. **Com a proposta (na sessão):** linha, "Alterar valor", "+". **3 toques**, com aviso "Destreza 2 → 3 · Desfazer". Entre sessões, "Evoluir personagem" mostra steppers em todas as linhas: 1 toque por mudança.

**G3. Ler a ficha numa mesa com pouca luz (brilho de 20 a 30%).**

- O tema escuro ajuda.
- O que some: caixas bloqueadas tracejadas (1,39:1), pontos de Esfera bloqueados (2,21:1), pontos tracejados de bônus ou perda em 14 px e rótulos de 11 a 12 px em caixa alta.
- Os pontos cheios de Tremere ficam com 3,55:1, que cai para cerca de 2,5:1 com protanopia.
- Sem números, o jogador conta pontos no escuro.
- A tela também apaga sozinha no meio da sessão (bloqueio automático).

**G4. Usar com uma mão, segurando dados na outra.** A barra fixa está na zona fácil, o que é bom. O resto do que se edita está na **borda direita** (x 280–374) e espalhado por 2.600–3.300 px de altura. Rolar com o polegar sobre essa coluna é exatamente o gesto que causa toques acidentais. Para canhotos, a borda direita é a zona mais difícil. Os botões "‹" e "⋮" ficam nos cantos superiores.

```
Zona do polegar (mão direita, 390×844)   Hoje                         Proposta
┌──────────────────────────┐
│ difícil          difícil │   ‹ voltar · ⋮                 header (uso raro)
│                          │   nome, citação, conceito      identidade recolhida
│ ok       ok         ok   │   pontos e caixas de 14–22 px  linha inteira = 1 alvo
│                          │   na borda direita             (só leitura)
│ fácil    fácil      ok   │   barra fixa (sem valores)     dock + sheets com
└──────────────────────────┘                                stepper no centro-baixo
```

#### Validação multi-sistema no layout proposto

O teste é se o mesmo esqueleto (header, chips de seção, dock, sheets, desfazer) atende sistemas com mecânicas diferentes sem código específico na tela.

**D&D 5e: Lia, maga de nível 5 (PV 27/27 + 5 temporários, CA 12, espaços de 1º nível 4/4).**

1. Um goblin acerta um ataque. Lia reage com *Escudo* (Shield). Ela toca o chip "Espaços" (1), depois "Conjurar com espaço de 1º" (1). O template aplica o estado "Escudo: +5 CA até seu próximo turno": o chip CA mostra "17\*" e o aviso diz "Espaço de 1º: 3/4 · Desfazer". O ataque erra.
2. O segundo goblin acerta 9 de dano. Ela toca o chip "PV" (1), digita 9 no teclado numérico (1) e toca "Dano" (1). Pela regra do template (PV temporário é gasto primeiro), a prévia mostra "temp 5→0, PV 27→23".
3. Como Lia está concentrada em outra magia, o gatilho do template oferece "Salvaguarda de CON, CD 10". Um toque abre a parada já montada (d20 + CON +1).
4. **Total: 5 a 6 toques e 0 rolagens.** Nenhuma tela nova: o dock (itens do template) e os sheets por tipo (`slots`, `tracker` numérico, `state`) são os mesmos do Vampiro.

**Call of Cthulhu 7e: investigador vê um Profundo (perda de SAN 1/1d6).**

1. Ele toca o chip "SAN 52" (1), depois "Teste de Sanidade" (1). O modelo é d100 ≤ 52. Ele rola na mão e informa 67 (1), e o app marca falha.
2. Ele digita a perda, 4 (1), e toca "Aplicar" (1). Os limites vêm do template: o app avisa que 5 ou mais numa perda pede teste de INT para insanidade temporária, e mostra "perdas hoje: 4 de 10" (1/5 de 52, limite da insanidade indefinida).
3. **Total: 5 toques e 0 rolagens.** É o mesmo sheet de recurso, com um `tracker` percentual e ações nomeadas que vêm do template.

O que generaliza sem mudança: dock, sheet de recurso, sheet de editor, parada de dados como casca, aviso com Desfazer, histórico e sincronização. O que precisa ser parâmetro do template: quais recursos vão ao dock, o modelo de rolagem, as regras de dano (ordem dos tipos, PV temporário primeiro, ferimento grave), os estados com modificadores e as ações nomeadas ("Curar 1 nível", "Teste de Sanidade").

#### Resumo das contagens

| Tarefa | Hoje: toques / rolagens | Proposta: toques / rolagens |
|---|---|---|
| V1 2 de dano letal | 4–7 / 2–3 | 3 / 0 |
| V2 Sangue para curar | 3–4 / 4–6 | 2 / 0 |
| V3 Gastar FdV | 1 (ambíguo) / 0–3 | 2 / 0, ou 1 dentro da parada |
| V4 Destreza + Esquiva | 2–6 / 2–4, mais contar e lembrar | 3 / 0 |
| V5 Consultar Disciplina | impossível | 1 / 0 |
| V6 Humanidade −1 | 1 / 2, sem registro | 4 / 0, com registro e desfazer |
| M1/M2 Quintessência / Paradoxo | 1 / 0–2 | 2 / 0 |
| L1 Hominídeo para Crinos | 2–3 / 3–4 | 2–3 / 0 |
| L2 Gastar Fúria | 1 / 0, sem feedback | 1 toque longo ou 2 / 0, com feedback |
| L3 Gastar Gnose | 1 / 0–3 | 2 / 0 |
| D&D Escudo + 9 de dano | (não existe) | 5–6 / 0 |
| CoC perda de SAN | (não existe) | 5 / 0 |

### Medições

Método: posições calculadas a partir do CSS inline dos mockups (cada `margin`, `gap`, `padding`, `min-height` e número de linhas do estado inicial do script). Elas foram conferidas no protótipo renderizado (escala 0,93 no modo "Fill"), com diferença de no máximo 7 px. 1 pt no iPhone 14 ≈ 0,166 mm. Não há nos arquivos texto que pareça instrução para uma IA.

#### Alvos de toque

| Elemento | Tamanho real (área de toque) | Espaçamento / passo | iOS 44 pt | Android 48 dp |
|---|---|---|---|---|
| Ponto de traço (Atributos, Habilidades, Vantagens, Esferas, Renome) | 14×14 (cada ponto é um botão; a linha não é alvo) | gap 6, passo 20 px (≈3,3 mm) | Falha | Falha |
| Pontos de 0–10 (FdV, Humanidade, Arete, Fúria, Gnose) | 14×14 | gap 6, +6 entre grupos de 5 | Falha | Falha |
| Caixas de recurso (Sangue, FdV temp., Fúria/Gnose temp., Renome temp.) | 22×22 | gap 4, passo 26 px (≈4,3 mm) | Falha | Falha |
| Distância entre pontos permanentes e caixas temporárias | — | **8 px** na vertical | Falha (erro provável) | Falha |
| Caixa de Vitalidade | 44×44 (visual 22) | passo vertical 45 | Passa | Falha marginal |
| Abas (Físicos / Sociais / Mentais) | 119×44 (390) e 109×44 (360) | contíguas | Passa | Falha marginal |
| Voltar e "⋮" no header | 44×44 | — | Passa | Falha marginal |
| −/+ de Quintessência e Paradoxo | 44×44 | 12 px entre "Quint. +" e "Parad. −" | Passa | Falha marginal (e risco de confusão) |
| Botões de Forma (Lobisomem) | ≈68×60 (390) e ≈62×60 (360) | gap 4 | Passa | Passa |
| Barra fixa: "Rolar dados" e "Gastar sangue/Fúria" | ≈199×48 e ≈147×48 | gap 12 | Passa | Passa |
| Linha de traço (44 px) e linha de Dom (52 px) | não interativas | — | Deveria ser alvo | — |
| Casas da roda (18 px) | não interativas (correto) | — | — | — |

Leitura física: a polpa do polegar cobre de 10 a 14 mm, ou seja, 3 a 4 pontos de traço ao mesmo tempo. Um ponto de 14×14 tem **10% da área** de um alvo de 44×44.

#### Scroll: onde cada bloco está (iPhone 14, área útil ≈ 700 px)

"Rolagem para ver inteiro" = base do bloco − 700. "Telas" = essa distância ÷ 700. No Android 360×800 com navegação de 3 botões a área útil é de cerca de 667 px, então some de 5 a 10%.

**Vampiro (`Main.dc.html`, conteúdo ≈ 2.640 px + barra)**

| Bloco | y (topo–base) | Rolagem para ver inteiro | Telas |
|---|---|---|---|
| Header + identidade + citação + conceito | 0–310 | 0 | 0 (ocupa 44% da 1ª tela) |
| Recursos (Sangue, FdV) | 330–557 | 0 | 0 |
| Atributos (3 linhas da aba) | 680–823 | 123 | 0,2 |
| Habilidades (10 linhas da aba) | 946–1.404 | 704 | 1,0 |
| Disciplinas | 1.474–1.639 | 939 | 1,3 |
| Humanidade | 2.005–2.069 | 1.369 | 2,0 |
| **Vitalidade** | **2.183–2.506** | **1.806** | **2,6** |
| Notas | 2.534–2.638 | 1.938 | 2,8 |

**Mago (`Mago.dc.html`, conteúdo ≈ 3.290 px: maior que a prancheta de 3.000 px; a Vitalidade sai cortada no canvas)**

| Bloco | y (topo–base) | Rolagem para ver inteiro | Telas |
|---|---|---|---|
| Arete | 346–364 | 0 | 0 |
| Roda + −/+ | 397–661 | 0 | 0 |
| FdV | 724–794 | 94 | 0,1 |
| Esferas | 920–1.333 | 633 | 0,9 |
| Atributos | 1.456–1.599 | 899 | 1,3 |
| Habilidades (11 linhas) | 1.722–2.225 | 1.525 | 2,2 |
| Antecedentes | 2.295–2.528 | 1.828 | 2,6 |
| Foco | 2.600–2.856 | 2.156 | 3,1 |
| **Vitalidade** | **2.970–3.293** | **2.593** | **3,7** |

**Lobisomem (`Lobisomem.dc.html`, conteúdo ≈ 2.990 px)**

| Bloco | y (topo–base) | Rolagem para ver inteiro | Telas |
|---|---|---|---|
| Fúria, Gnose, FdV | 314–580 | 0 | 0 |
| Forma (botões) | 648–708 | ≈10 (atrás da barra na 1ª tela) | 0 |
| Atributos | 873–1.016 | 316 | 0,5 |
| Habilidades | 1.139–1.597 | 897 | 1,3 |
| Renome | 1.665–1.931 | 1.231 | 1,8 |
| Dons | 1.999–2.218 | 1.518 | 2,2 |
| Antecedentes | 2.286–2.474 | 1.774 | 2,5 |
| **Vitalidade** | **2.588–2.911** | **2.211** | **3,2** |

Comparação: no `Web.dc.html` (1280 px), Recursos e Vitalidade ficam na coluna direita **dentro da primeira dobra**. A versão mobile perdeu essa prioridade ao empilhar as seções.

#### Primeira tela hoje (Vampiro, 0–700 px)

```text
┌────────────────────────────────────────────┐
│ ‹        Crônica · Noites de São Paulo    ⋮│  y 0–52    header (rola junto)
│                                            │
│ Helena Varga                      ( HV )   │  y 68–152  identidade
│ [● Tremere] 8ª geração                     │
│ “Todo segredo tem um preço. Eu apenas      │  y 166–214 citação
│ anoto quem pagou.”                         │
│ Conceito             Senhor                │  y 230–310 conceito etc.
│ Arquivista da Capela Regente Aurélio Costa │
│ Natureza             Comportamento         │
│                                            │
│ PONTOS DE SANGUE                    9 / 15 │  y 330–557 Recursos
│ ■■■■■■■■■□□□  (caixas 22px, passo 26)      │
│ □□□                                        │
│ Gasto máximo por turno: 3                  │
│ FORÇA DE VONTADE                     5 / 7 │
│ ●●●●● ●●○○○   (pontos 14px, passo 20)      │  ← permanente
│ ■■■■■□□┄┄┄    (8px abaixo dos pontos)      │  ← temporária
│                                            │
│ Atributos ─────────────────────────────    │  y 585
│  FÍSICOS     SOCIAIS    [MENTAIS]          │
│ Percepção                       ●●●○○      │  y 680+ (sem número)
├────────────────────────────────────────────┤
│ [  ◆ Rolar dados  ]  [ Gastar sangue ]     │  barra fixa 81px (sem valores)
└────────────────────────────────────────────┘
```

### Problemas e soluções

Convenção dos esboços: **[A]** = estrutura fixa do app; **[T]** = vem do `trait_templates.template_data`.

#### UX-01: A ficha inteira é editável o tempo todo, com um toque, sem desfazer

- **Severidade:** Crítico
- **Onde:** todos os `TraitDots` e `Tracker` dos três arquivos. Na lógica: `setV()` (tocar no valor atual reduz 1; tocar no ponto N define N), `boxes().pick` (idem para caixas), o *clamp* do Arete sobre as Esferas em `Mago.dc.html` e o *clamp* de FdV/Fúria/Gnose permanente sobre o temporário. O Web tem "Editar ficha"; o mobile não tem.
- **Cenário real:** Caio rola atrás de Ocultismo com o polegar sobre a coluna direita. O toque que para a rolagem cai em Taumaturgia: 3 → 1. Ninguém percebe até a próxima vez que ele usa a Disciplina. Tomás erra o Arete por 20 px: Arete 3 → 1, e Forças, Mente e Primórdio viram 1. Subir o Arete de volta não devolve nada.
- **Problema:** não há modo leitura. Traços permanentes, que mudam entre sessões, e recursos temporários, que mudam a cada turno, usam o mesmo controle de 14 a 22 px. O toque define um valor absoluto, então um erro pode apagar vários pontos de uma vez. Há efeitos colaterais destrutivos e silenciosos, e não existe desfazer nem histórico.
- **Solução recomendada:**
  1. **Modo leitura por padrão.** Pontos não são botões. A **linha inteira** (≥ 48 px) é o alvo e abre o sheet de detalhe.
  2. **Permanentes:** dentro do sheet, "Alterar valor" mostra um stepper −/+ de 56 px na zona do polegar. O stepper muda **1 ponto por toque, nunca salta**. Cada toque salva e mostra o aviso "Destreza 2 → 3 · Desfazer" por 5 s, com háptico de seleção (`expo-haptics`).
  3. **Temporários:** só pelo dock e pelos sheets de recurso (UX-02), com ações nomeadas ("Gastar 1", "Curar 1 nível").
  4. **Restrição não destrutiva.** Baixar o Arete não apaga Esferas: os pontos acima ficam "inativos, acima do Arete" e voltam quando o Arete sobe. O sheet mostra o efeito antes ("Forças 3 fica inativa acima de 2").
  5. **"Evoluir personagem"** (no "⋮", igual ao "Editar ficha" do Web) para gastar XP entre sessões: steppers em linha em todas as linhas, e o modo desliga ao sair da tela.
  6. **Histórico da sessão** (evento: caminho, de, para, quem, quando), que também serve à narradora.

```text
┌────────────────────────────────────────────┐
│                   ───                      │
│ Destreza                        Físicos    │  [T] nome, grupo
│ ●●○○○  2 de 5                              │  [T] widget rating
│ Especialização: (nenhuma, a partir de 4)   │
│ Paradas recentes: +Esquiva, +Armas de Fogo │
│                                            │
│ [ Montar parada com Destreza        › ]    │  [A] atalho p/ Dados
│ [ Alterar valor                       ]    │  [A] 1 toque extra p/ permanentes
├────────────────────────────────────────────┤
│         ┌──────┐            ┌──────┐       │  [A] stepper 56×56, zona do polegar
│         │  −   │     3      │  +   │       │
│         └──────┘            └──────┘       │
│ 2 → 3   custo: 8 XP (atual × 4)            │  [T] regra de custo (opcional)
│ Cada toque salva · aviso com Desfazer      │  [A] desfazer > confirmar
└────────────────────────────────────────────┘
```

- **Alternativas consideradas:**
  - Cadeado global no header como único mecanismo: fica no canto mais difícil e as pessoas esquecem ligado. Fica como complemento ("Evoluir personagem").
  - Toque longo para editar: invisível para a novata, conflita com o VoiceOver e dispara durante a rolagem.
  - Diálogo de confirmação a cada mudança: lento para o veterano. Desfazer protege melhor sem interromper.
  - Manter a edição sempre ligada e só acrescentar desfazer: ainda depende de a pessoa perceber o erro.
- **Multi-sistema:** o modelo leitura/edição e o desfazer valem para qualquer tipo de valor. Muda só o **editor dentro do sheet**, escolhido pelo tipo de widget do template: pontos (WoD, Artes do Changeling, Arcanoi da Aparição), número livre com teclado e modificador derivado (atributos de D&D), percentual com metade e quinto (perícias de CoC), texto (aspectos de Fate), proficiência (perícias de D&D) e caixas (espaços de magia). As restrições também vêm do template (`max: "arete"`, PV máximo derivado de CON, SAN máxima = 99 − Mitos), e o app nunca as aplica de forma destrutiva ou silenciosa.

```text
┌────────────────────────────────────────────┐
│ D&D  Força        [ − ]  16  [ + ]  mod +3 │  [T] number 1–30 + mod derivado
│ CoC  Esquivar [45]%  difícil 22 · extr. 9  │  [T] percent + frações
│      [−5] [−1] [+1] [+5]  teclado numérico │
│ Fate Aspecto: [Ex-detetive endividado  ]   │  [T] texto (teclado!)
│ D&D  Perícia: [ — | ½ | Prof | Especial. ] │  [T] proficiency (segmentado)
│ D&D  Espaços 1º: [■][■][■][□]   48px cada  │  [T] boxes
└────────────────────────────────────────────┘
```

- **Esforço:** M

#### UX-02: Recursos de combate espalhados e longe, e barra fixa sem valores nem feedback

- **Severidade:** Crítico
- **Onde:**
  - Vitalidade em y 2.183–2.506 (Vampiro), 2.970–3.293 (Mago) e 2.588–2.911 (Lobisomem), a 2,6–3,7 telas do topo.
  - Forma em y 648 (Lobisomem). Gnose sem atalho.
  - Barra fixa: "Gastar sangue" sem ação no mockup; "Gastar Fúria" altera uma caixa em y≈330–400 que fica fora da tela.
  - No Web, a Vitalidade fica na primeira dobra.
- **Cenário real:** "Duas letais." Bia está em Habilidades. Desce cerca de 1.600 px, marca a Vitalidade, sobe cerca de 1.800 px para gastar sangue e desce de novo para ver a penalidade. Enquanto isso, a mesa espera. Iara toca "Gastar Fúria", não vê nada mudar, toca de novo: gastou 2.
- **Problema:** as informações e ações mais usadas no combate (dano, penalidade e o recurso principal do sistema) estão no ponto mais distante da página. A barra fixa oferece ações, mas não mostra estado, então cada ação é dada às cegas.
- **Solução recomendada:** trocar a barra por um **dock de combate**.
  - Três chips do template mais o botão "Dados" (ação primária, ouro). Cada chip **mostra o valor atual**: Vitalidade com mini-trilha e penalidade, "Sangue 9/15", "FdV 5/7".
  - **Toque** no chip abre o sheet do recurso (stepper, ações nomeadas, trilha completa).
  - **Toque longo** é o atalho do veterano para a ação padrão ("Gastar 1"), com háptico e aviso com Desfazer. Para quem usa VoiceOver, o mesmo atalho aparece como `accessibilityActions` ("Gastar 1").
  - **Puxar o dock** para cima o transforma num sheet persistente com todos os recursos fixados (Gnose, FdV e Renome no Lobisomem).
  - O aviso de Desfazer flutua 8 px acima do dock.
  - No corpo da ficha, Vitalidade e Recursos continuam completos para leitura, mas deixam de ser o único caminho.

```text
┌────────────────────────────────────────────┐
│ ‹  Helena Varga ● Tremere   ● salvo    ⋮   │  [A] header compacto fixo (48)
│ Atributos  Habilidades  Vantagens  Vit›    │  [A] chips de seção | [T] nomes/ordem
├────────────────────────────────────────────┤
│ (HV) Arquivista da Capela · 8ª ger.   ˅    │  [T] identity.primary, recolhido
│                                            │
│ ATRIBUTOS                  Físicos/Soc/Men │  [T] seção primaryGrid
│ ┌─────────────┬─────────────┬─────────────┐│
│ │Força        │Carisma      │Percepção    ││  [A] célula 110×56 = alvo
│ │●●○○○     2  │●●○○○     2  │●●●○○     3  ││  [T] widget rating 0–5
│ ├─────────────┼─────────────┼─────────────┤│
│ │Destreza     │Manipulação  │Inteligência ││
│ │●●○○○     2  │●●●○○     3  │●●●●○    4*  ││  * especialização
│ ├─────────────┼─────────────┼─────────────┤│
│ │Vigor        │Aparência    │Raciocínio   ││
│ │●●○○○     2  │●●○○○     2  │●●●○○     3  ││
│ └─────────────┴─────────────┴─────────────┘│
│ HABILIDADES       só com pontos ▾  Buscar  │  [A] filtro + busca | [T] regra 'investido'
│ Talentos                                   │  [T] grupos
│ Prontidão                   ●●○○○    2     │  [A] linha 48px = 1 alvo
│ Esquiva                     ●○○○○    1     │
├────────────────────────────────────────────┤
│  +1 Sangue (10/15)          [ Desfazer ]   │  [A] toast 5 s acima do dock
├────────────────────────────────────────────┤
│ ┌────────┐┌────────┐┌────────┐ ┌─────────┐ │  [A] dock fixo (64 + inset)
│ │VITALID.││ SANGUE ││  FDV   │ │  DADOS  │ │  [T] dock: health, blood, wp
│ │ ■■□ −1 ││  9/15  ││  5/7   │ │  parada │ │  [A] botão Dados (ouro)
│ └────────┘└────────┘└────────┘ └─────────┘ │  [T] modelo: pool d10
└────────────────────────────────────────────┘
```

- **Alternativas consideradas:**
  - Mover a Vitalidade para o topo da página: só ajuda quando a rolagem está em 0 e empurra os Atributos para baixo.
  - Botão flutuante com menu radial: esconde o estado e é ruim no leitor de tela.
  - Aba "Combate" separada: obriga a alternar entre telas para montar a parada, que precisa dos traços.
  - Barra atual com números: resolve o feedback, mas não a Vitalidade.
- **Multi-sistema:** o dock é **configurado pelo template** (`mobile.dock: [ids]`) e nunca é fixo em Sangue, Fúria ou Quintessência. O app só sabe desenhar chips por tipo de widget:
  - `tracker`: Sangue, Fúria, Gnose, Quintessência; PV de D&D (com temporário); SAN, Sorte e PM de CoC; Pontos de Destino de Fate; Pathos da Aparição; Glamour do Changeling.
  - `damageTrack`: Vitalidade de WoD, Corpus da Aparição, Vitalidade real e quimérica do Changeling, Estresse de Fate, Dano de PbtA.
  - `slots`: espaços de magia, dados de vida.
  - `stat` (só leitura): CA, Iniciativa.
  - `state`: Forma do Garou, Fúria do Bárbaro.

  Padrões sugeridos: WoD [Vitalidade, recurso principal, FdV]; D&D [PV, CA, Espaços]; CoC [PV, SAN, Sorte]; Fate [Estresse, Destino, Consequências]. O jogador pode refixar. O rótulo curto do chip (no máximo 8 caracteres) vem do template.
- **Esforço:** G

#### UX-03: Alvos de toque minúsculos nas ações mais frequentes, e camadas permanente/temporária a 8 px

- **Severidade:** Crítico
- **Onde:** `.g-dot` de 14×14 com passo de 20 px e `.g-box` de 22×22 com passo de 26 px, em todos os trackers e pools. Nos pools de FdV (Vampiro, Mago) e de Fúria, Gnose, FdV e Renome (Lobisomem), os pontos permanentes ficam 8 px acima das caixas temporárias. O README de `TraitDots` diz "Área de toque da linha inteira: hit-size", mas os mockups implementam um botão de 14 px por ponto.
- **Cenário real:** com os d10 na mão esquerda, Caio mira a 5ª caixa de FdV. O polegar cobre da 4ª à 6ª caixa e encosta na fileira de pontos permanentes logo acima.
- **Problema:** passo de 3,3 a 4,3 mm contra uma polpa de polegar de 10 a 14 mm. Os erros são prováveis, não ocasionais. Somado ao UX-01, cada erro grava sem aviso.
- **Solução recomendada:**
  - Em leitura, pontos e caixas são **só visuais**. O alvo é a linha inteira (≥ 48 dp de altura, largura total) ou o chip do dock.
  - Edição sempre em sheet: steppers de 56×56 na parte de baixo, centralizados (bom para destros e canhotos). Caixas que precisam de toque individual (espaços de magia, caixas de estresse) com 44–48 px e gap ≥ 8 px.
  - Manter a técnica que a Vitalidade já usa (alvo de 44 px em volta de um visual menor) e usar `hitSlop` só quando não houver sobreposição com o vizinho.
- **Alternativas consideradas:**
  - Pontos de 28 px com gap de 16: 5 pontos ocupam 204 px e espremem o nome; 10 pontos ocupam 430 px e não cabem nos 326 px do cartão.
  - `hitSlop` nos pontos de 14 px: as áreas se sobrepõem e o toque fica ambíguo.
  - Arrastar sobre os pontos (slider): impreciso, conflita com a rolagem e com o leitor de tela.
- **Multi-sistema:** o contrato ergonômico é do app e vale para todo tipo de widget. Números de D&D e CoC (PV 134, perícia 45%) são editados com ± e teclado numérico, nunca com setas pequenas em linha. Grades de caixas grandes (9 níveis de magia, 3 sucessos e 3 falhas contra a morte, estresse de Fate) também só aparecem no sheet.
- **Esforço:** M (sai junto com UX-01 e UX-02)

#### UX-04: O leitor de tela não consegue ler o valor de nenhum traço

- **Severidade:** Crítico (bloqueia a persona d)
- **Onde:**
  - Cada ponto tem `aria-label="{nome}: {i} de {max}"`, igual se estiver cheio ou vazio, sem `aria-pressed` ou `checked`.
  - As caixas têm "Ponto de sangue: 1" sem estado.
  - São cerca de 170 botões na ficha de Vampiro, que viram cerca de 240 paradas de foco contando os textos, só no estado atual das abas.
  - Os bônus de forma são 4 × "Bônus da forma Crinos" como `role="img"`.
- **Cenário real:** a narradora pergunta "qual sua Destreza?". Paulo ouve "Destreza: 1 de 5, botão… Destreza: 2 de 5, botão…" cinco vezes, sem saber se é 2 ou 5. Um toque duplo em qualquer um deles altera a ficha.
- **Problema:** o valor não é exposto, o elemento lido é o próprio controle de edição e a navegação é longa demais para uma sessão de jogo.
- **Solução recomendada:**
  - **Um elemento acessível por linha:** em leitura, um botão com rótulo "Destreza, 2 de 5". Em edição, `accessibilityRole="adjustable"` com `accessibilityValue` e as ações `increment`/`decrement`. Os pontos ficam ocultos para o leitor de tela.
  - Títulos de seção com `accessibilityRole="header"`, para navegar pelo rotor.
  - Recursos lidos como "Pontos de sangue, 9 de 15". A Vitalidade lida como "Machucado, penalidade menos 1; 1 contusivo, 1 letal".
  - Mudanças anunciadas com `AccessibilityInfo.announceForAccessibility("Sangue 8 de 15")`.
  - O valor efetivo da forma lido como "Força 7: 3 mais 4 da forma Crinos".
  - Resultado: cerca de 50 paradas por ficha.

```tsx
// Linha de traço em modo leitura: um alvo, um anúncio
export function TraitRow({ name, value, max, specialty, onOpen }: TraitRowProps) {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${value} de ${max}${specialty ? `, especialização ${specialty}` : ''}`}
      accessibilityHint="Abre detalhes"
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.trait}>{name}</Text>
        {specialty ? <Text style={styles.caption}>{specialty}</Text> : null}
      </View>
      <Dots value={value} max={max} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <Text style={styles.value /* 17px, tabular-nums, ink */}>{value}</Text>
    </Pressable>
  );
}

// Stepper do sheet: ajustável no leitor de tela, háptico no toque
export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  const set = (next: number) => {
    if (next < min || next > max) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Haptics.selectionAsync();
    onChange(next); // grava o evento e mostra o aviso "label value → next · Desfazer"
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: `${value} de ${max}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 }}
    >
      <StepButton symbol="−" onPress={() => set(value - 1)} disabled={value <= min} />
      <Text style={styles.bigValue}>{value}</Text>
      <StepButton symbol="+" onPress={() => set(value + 1)} disabled={value >= max} />
    </View>
  );
}
```

- **Alternativas consideradas:**
  - Corrigir só os rótulos ("preenchido"/"vazio"): continua com 5 paradas por traço e com edição por toque duplo.
  - `radiogroup` com 5 rádios: semântica melhor, mas mantém 5 paradas e não combina com o modo leitura.
- **Multi-sistema:** a gramática do anúncio é do app, por tipo de widget, em pt-BR e internacionalizável. Os nomes e unidades vêm do template:
  - "Força, 16, modificador mais 3" (D&D)
  - "Esquivar, 45 por cento; difícil 22; extremo 9" (CoC)
  - "Espaços de magia de 1º nível, 3 de 4 disponíveis"
  - "Estresse físico, 1 de 3 marcado" (Fate)
  - "Aspecto: Ex-detetive endividado"

  Adicionar um sistema não exige novo código de acessibilidade.
- **Esforço:** M

#### UX-05: Vitalidade marcada por ciclo de toques, sem regra e com estados inválidos

- **Severidade:** Alto
- **Onde:** `HealthTrack` (vazio → `/` → `X` → `✱` → vazio) e `cycle()` nos três arquivos. A penalidade vem do nível marcado mais baixo, mesmo com buracos na trilha.
- **Cenário real:** "duas letais" sobre `/ X` pede `X X X /`. São 4 toques e a jogadora precisa saber a regra de ordenação. Para curar um `X` com sangue, o ciclo passa por `✱`. Um toque a mais custa 3 para voltar.
- **Problema:** a interface expõe a representação (o glifo de cada caixa), não a ação de jogo (receber ou curar dano de um tipo). Também permite estados que a regra não permite.
- **Solução recomendada:** um sheet de dano com "+ Contusivo / + Letal / + Agravado" e "Curar / X ✱".
  - O app guarda **contagens por tipo** e desenha a trilha ordenada pela regra do template. A penalidade aparece grande no sheet e no chip do dock.
  - Háptico mais forte para agravado e aviso de "Incapacitado".
  - "Editar caixas manualmente" fica como saída para decisões da narradora.

```text
┌────────────────────────────────────────────┐
│                   ───                      │
│ VITALIDADE            Penalidade  −1       │  [A] valor efetivo grande
│ [/ ][X ][  ][  ][  ][  ][  ]  44px cada    │  [T] damageTrack: 7 níveis
│ Esc Mac Fer F.g Esp Ale Inc                │
│                                            │
│ ┌───────────┐ ┌───────────┐ ┌──────────┐   │  [T] tipos de dano e ordem
│ │+ Contusivo│ │  + Letal  │ │+ Agravado│   │
│ └───────────┘ └───────────┘ └──────────┘   │
│ ┌───────────┐ ┌───────────┐ ┌──────────┐   │
│ │ Curar  /  │ │ Curar  X  │ │ Curar  ✱ │   │
│ └───────────┘ └───────────┘ └──────────┘   │
│ Editar caixas manualmente            ›     │  [A] fallback p/ decisões do narrador
└────────────────────────────────────────────┘
```

- **Alternativas consideradas:**
  - Manter o ciclo e acrescentar toque longo para curar: escondido.
  - Seletor de tipo mais toque nas caixas: dois passos, e a pessoa ainda precisa saber ordenar.
  - Três steppers (contusivo n, letal n, agravado n): é o mesmo modelo de dados da proposta, mas com menos clareza da ação. Vale como variação para tablets.
- **Multi-sistema:** o sheet de dano escolhe o corpo pelo widget.
  - `damageTrack` com tipos e ordem: WoD; Corpus de 10 níveis da Aparição; Changeling com duas trilhas (real e quimérica) e alternância no topo.
  - `tracker` numérico com temporário (D&D, abaixo), que abre os testes contra a morte ao chegar em 0.
  - CoC: número mais o marcador de "ferimento grave" (dano ≥ metade do máximo).
  - Fate: caixas de estresse mais consequências (texto 2/4/6).
  - PbtA: relógio de dano.

  As regras são parâmetros do template (`types`, `sort`, `overflow`, `tempFirst`), nunca código na tela.

```text
┌────────────────────────────────────────────┐
│                   ───                      │
│ PONTOS DE VIDA     27/27   +5 temporários  │  [T] tracker numérico + temp
│ ┌──────────────────────────────────────┐   │
│ │                  9                   │   │  [A] campo numérico (teclado 0–9)
│ └──────────────────────────────────────┘   │
│   [−1]   [−5]   [−10]   [+1]   [+5]        │
│ ┌───────────┐ ┌───────────┐ ┌──────────┐   │
│ │   Dano    │ │   Cura    │ │ PV temp. │   │
│ └───────────┘ └───────────┘ └──────────┘   │
│ Prévia: temp 5→0, PV 27→23                 │  [T] regra: temp é gasto primeiro
│ Concentrando: salvaguarda CON CD 10   ›    │  [T] gatilho opcional
└────────────────────────────────────────────┘
```

- **Esforço:** M

#### UX-06: Montar a parada de dados é trabalho manual

- **Severidade:** Alto
- **Onde:**
  - Abas padrão "Mentais" e "Conhecimentos" (`tabA: 2`, `tabH: 2` no Vampiro e no Mago) escondem 2/3 dos traços.
  - Os valores aparecem só como pontos.
  - A penalidade fica só no parágrafo da Vitalidade.
  - "Rolar dados" e "Conjurar efeito" não têm fluxo.
- **Cenário real:** veja V4: até 6 toques para a novata, 2 a 4 rolagens, contar pontos no escuro e lembrar a penalidade.
- **Problema:** a tarefa mais repetida da sessão (somar dois traços e aplicar modificadores) fica toda na cabeça do jogador.
- **Solução recomendada:**
  1. **Números ao lado dos pontos** em toda a ficha.
  2. **Atributos em grade 3×3**: os 9 visíveis em cerca de 190 px, cada célula um alvo de 110×56.
  3. **Habilidades sem abas**, agrupadas e filtradas por "só com pontos" (18 de 30 linhas na Helena), com busca.
  4. **Sheet "Parada de dados"**: busca, recentes e seleção pela grade. Modificadores automáticos com origem (ferimento, forma). Dificuldade. FdV como bônus. "Rolar no app" ou "Rolei na mão", porque muitas mesas usam dados físicos.

```text
┌────────────────────────────────────────────┐
│                   ───                      │
│ PARADA DE DADOS                       ✕    │  [A] mesmo sheet em todo sistema
│ [ Buscar traço…                       ]    │  [A] busca global
│ Recentes: [Des+Esquiva] [For+Briga]        │  [A] memória por personagem
│ ┌──────────────────────────────────────┐   │
│ │ Destreza                    2     ✕  │   │  [T] slots: atributo + habilidade
│ │ Esquiva                     1     ✕  │   │
│ │ Ferimento (Machucado)      −1   auto │   │  [T] penalidade automática
│ ├──────────────────────────────────────┤   │
│ │ TOTAL                  2 dados (d10) │   │  [T] modelo: pool d10
│ └──────────────────────────────────────┘   │
│ Dificuldade      [ − ]   6   [ + ]         │  [T] parâmetro do modelo
│ [ ] Gastar 1 FdV  (+1 sucesso automático)  │  [T] boost ligado a recurso
│ ┌──────────────────┐ ┌─────────────────┐   │
│ │   Rolar no app   │ │  Rolei na mão   │   │  [A] dados físicos são 1ª classe
│ └──────────────────┘ └─────────────────┘   │
└────────────────────────────────────────────┘
```

- **Alternativas consideradas:**
  - Só mostrar números: ajuda a contar, mas não resolve abas nem penalidade.
  - Rolador digital primeiro: ignora quem rola dados físicos.
  - Só paradas salvas: serve ao veterano, não à novata.
- **Multi-sistema:** a casca é do app (seleção, total, modificadores com origem, rolar ou registrar). A **mecânica vem do template** (`roll.model`, `slots`, `boosts`):
  - pool de d10 com dificuldade (WoD)
  - Arete com dificuldade pela maior Esfera e Quintessência reduzindo a dificuldade (Mago, botão "Conjurar")
  - d20 + modificador com vantagem ou desvantagem vindas de condições (D&D)
  - d100 ≤ perícia com faixas difícil e extremo, dados de bônus ou penalidade e "forçar teste" (CoC)
  - 4dF + perícia com invocação de aspecto (Fate)
  - 2d6 + atributo em faixas (PbtA)

```text
┌────────────────────────────────────────────┐
│ D&D  Furtividade d20 + DES 2 + prof 3 = +5 │  [T] modelo d20 + mod
│      [Desvantagem] [Normal] [Vantagem]     │
│      Envenenado → desvantagem automática   │
│ CoC  Esquivar 45% · difícil 22 · ext. 9    │  [T] modelo d100 ≤ perícia
│      Dado bônus [−] 0 [+]   Forçar teste › │
│ Fate Lutar +2 · 4dF   Invocar aspecto (+2) │  [T] modelo 4dF + perícia
│ PbtA 2d6 + Firme +1 → 6− | 7–9 | 10+       │  [T] modelo 2d6 em faixas
└────────────────────────────────────────────┘
```

- **Esforço:** G

#### UX-07: Página de 2.600–3.300 px sem índice, com perda de contexto

- **Severidade:** Alto
- **Onde:** o header rola junto. O nome do personagem some depois de cerca de 100 px. Não há índice de seções nem "voltar ao topo", exceto o toque na barra de status do iOS, que é escondido. Identidade, citação e conceito ocupam 310 px (44% da primeira tela) com dados que não mudam na sessão.
- **Cenário real:** a narradora alterna fichas e, no meio de uma delas, não sabe de quem é. A jogadora quer as Notas (2.534 px) e arrasta 3 vezes.
- **Problema:** a página é longa e a navegação é só por rolagem.
- **Solução recomendada:**
  - Header compacto fixo (48 px): voltar, nome, selo da linhagem, estado de sincronização e "⋮".
  - Linha de **chips de seção** com scroll spy. Tocar um chip leva à seção. Os chips somem ao rolar para baixo e voltam ao rolar para cima (`react-native-reanimated`, já instalado).
  - Identidade recolhida (cerca de 96 px), com citação e conceito movidos para "História" no fim.
  - Posição, filtros e seção preservados por personagem.
- **Alternativas consideradas:**
  - Barra de abas inferior por seção: compete com o dock e fragmenta a ficha.
  - Seções em acordeão: toques extras e conteúdo escondido.
  - Índice A–Z na borda: pouco descobrível.
- **Multi-sistema:** chips e ordem vêm de `mobile.sections`. A identidade principal vem de `mobile.identity`: clã e geração (Vampiro), Tradição e Arete (Mago), raça, classe e nível (D&D), ocupação (CoC), "conceito" (o *high concept* de Fate). O comportamento é do app.
- **Esforço:** M

#### UX-08: Fonte aumentada e telas de 360 dp quebram abas, formas e barra

- **Severidade:** Alto
- **Onde:**
  - Abas em 12 px caixa alta com +0,14em: "CONHECIMENTOS" tem cerca de 116 px numa aba de 119 px (390) e 109 px (360). Já está no limite a 100%.
  - Formas: "Hominídeo" em 13 px bold tem cerca de 63 px num espaço de 62 px (390) e 55 px (360). As dicas em 11 px quebram em 3 linhas ("quase / humana").
  - Os pontos são fixos em 14 px enquanto o texto escala.
  - "Gastar sangue" em 200% quebra a barra em duas linhas.
- **Cenário real:** com "Texto Extra Grande", Paulo vê as abas cortadas, a forma "Homin…" e nomes de traço em 3 linhas com pontos minúsculos ao lado.
- **Problema:** o layout foi desenhado para 390 px e 100%. Não há regra para `fontScale` nem para larguras menores.
- **Solução recomendada:**
  - Não limitar a fonte globalmente. Trocar o layout pela largura medida e pela `useWindowDimensions().fontScale`:
    - grade 3×3 vira lista a partir de 1,3× ou abaixo de 340 px
    - formas viram lista vertical no sheet
    - os chips do dock passam para duas linhas
  - Pontos escalam até 1,5× (`Math.min(fontScale, 1.5)`).
  - Números sempre presentes. Nenhum texto com significado abaixo de 13 px.
  - Matriz de teste: 360/390/430 × 100/130/200%.
- **Alternativas consideradas:**
  - `maxFontSizeMultiplier` de 1,2 em tudo: nega a necessidade da persona d.
  - Abas com rolagem horizontal: escondem opções.
- **Multi-sistema:** os piores textos mudam por sistema: perícias longas de CoC ("Ciência (Farmácia)"), magias de D&D ("Esfera Resiliente de Otiluke"), números largos ("PV 127/134 +12"). O template fornece `shortLabel` para chips e o app decide o layout pelo espaço medido, nunca pelo nome do sistema.
- **Esforço:** M

#### UX-09: Lobisomem: a troca de forma fica longe dos atributos, e o valor efetivo é difícil de ler

- **Severidade:** Alto
- **Onde:**
  - Forma em y 648–708, atrás da barra na primeira tela.
  - Atributos a partir de y 873. Os Sociais ficam escondidos na aba.
  - Valor efetivo só na legenda de 13 px itálico.
  - Força em Crinos com 9 pontos que quebram em 2 linhas (`max-width: 170px`).
  - Pontos base continuam tocáveis em Crinos, e tocar em um deles altera o valor **base**.
- **Cenário real:** veja L1.
- **Problema:** um estado de combate (a forma) muda números usados na rolagem seguinte, mas a pessoa precisa caçar o efeito e somar pontos tracejados.
- **Solução recomendada:**
  - Forma como chip de estado no dock do Lobisomem. O sheet lista as formas **com os valores efetivos**.
  - Depois da escolha: selo "Crinos" no header. As células da grade mostram o efetivo grande ("7") com "3+4" pequeno e contorno na cor da tribo.
  - Os tracejados viram pista secundária.
  - O valor base só muda por "Alterar valor base".
  - O custo opcional (gastar Fúria) vem do template.

```text
┌────────────────────────────────────────────┐
│                   ───                      │
│ FORMA                     atual: Hominídeo │  [T] states (Lobisomem)
│ ○ Hominídeo   sem modificadores            │
│ ○ Glabro      For+2 Vig+2 Man−2 Apa−1      │
│ ● Crinos      For 7 Des 4 Vig 6 Man 0 Apa 0│  [A] mostra valor efetivo
│               Delírio em humanos           │
│ ○ Hispo       For+3 Des+2 Vig+3 Man−3      │
│ ○ Lupino      Des+2 Vig+2 Man−3            │
│ [x] Gastar 1 Fúria (mudança imediata)      │  [T] custo opcional da mudança
│ ┌──────────────────────────────────────┐   │
│ │          Assumir Crinos              │   │
│ └──────────────────────────────────────┘   │
└────────────────────────────────────────────┘
```

- **Alternativas consideradas:**
  - Subir o seletor para logo acima de Atributos: continua longe do polegar e da Vitalidade.
  - Deslizar entre formas no cartão de Atributos: gesto escondido.
- **Multi-sistema:** é o padrão genérico de **estado com modificadores**: formas do Garou; Fúria do Bárbaro, Forma Selvagem (que troca atributos físicos e o pool de PV) e condições de D&D (Envenenado = desvantagem automática na parada); insanidade temporária em CoC; Catarse na Aparição. O template declara estados, modificadores e duração ("até o próximo turno", "até o descanso"). O app desenha o chip de estado, mostra o efetivo com origem e aplica tudo na parada.
- **Esforço:** M

#### UX-10: Sem estado de sincronização nem estratégia offline

- **Severidade:** Alto
- **Onde:** os mockups não têm nenhum indicador de salvamento ou conexão. O app Expo vai falar com a API Elysia.
- **Cenário real:** o Wi-Fi do porão cai. Caio gasta 3 sangues. A tela mostra 6/15, mas nada foi salvo, e o painel da narradora segue mostrando 9/15. No outro extremo, o app trava esperando a rede antes de mexer no contador.
- **Problema:** em mesa de jogo a rede é ruim com frequência. Sem modelo explícito, ou há perda silenciosa ou há bloqueio.
- **Solução recomendada:**
  - **Local-first:** aplica na hora, grava um evento `{caminho, de, para, quando, quem}` numa fila persistida e sincroniza quando houver rede.
  - Indicador no header: "● salvo" / "◌ salvando" / "offline · 3 pendentes". Nunca bloquear a interface.
  - Conflito por caminho: prevalece a última escrita, com aviso ("A narradora alterou Vitalidade enquanto você estava offline · ver").
  - "Modo sessão" opcional com `expo-keep-awake` para a tela não apagar.
  - **Nota de segurança:** o servidor valida **todo** evento.
    - AuthZ: dono da ficha ou narrador **daquela** crônica, negando por padrão. Isso evita IDOR trocando o `characterId`.
    - Limites e tipos pelo schema do template, além de rate limiting.
    - Tokens só no `expo-secure-store`, nunca no cache offline.
    - Logs sem PII nem conteúdo de Notas.
- **Alternativas consideradas:**
  - Só online, com spinner e erro: inviável na mesa.
  - Salvar a ficha inteira periodicamente: sobrescreve edições simultâneas da narradora.
- **Multi-sistema:** o evento é por caminho e não depende do tipo: ponto, número, percentual, texto e operações de lista (adicionar ou remover item do inventário de D&D) usam a mesma fila. A validação no servidor usa o schema do template de cada sistema. Adicionar um sistema não exige migration, como pede o `CLAUDE.md`.
- **Esforço:** G

#### UX-11: Narradora sem visão da mesa, sem troca rápida e sem leitura segura

- **Severidade:** Médio (Alto se a narradora for público prioritário no MVP)
- **Onde:** os mockups são de uma ficha só. "Crônica · …" não é tocável. Não há pager nem modo somente leitura.
- **Cenário real:** antes de pedir um teste, Rafa quer saber quem ainda tem FdV. Abre 4 fichas e rola 3 telas em cada: cerca de 4 × (2 toques + 3 rolagens).
- **Solução recomendada:** painel "Mesa" com uma linha por personagem, usando os chips do dock e a hora da última sincronização. Tocar abre a ficha em **leitura**. Deslizar para o lado passa para a próxima ficha (o gesto não pode conflitar com o voltar pela borda do iOS: o pager começa a 24 px da borda). Edição da narradora é explícita e fica assinada no histórico ("Narradora: +2 letal").

```text
┌────────────────────────────────────────────┐
│ ‹  Noites de São Paulo · Mesa      ⋮       │  [A] painel do narrador
├────────────────────────────────────────────┤
│ Helena Varga  Tremere           há 10 s    │  [A] última sincronização
│ Vit ■■□□□□□ −1   Sangue 9/15   FdV 5/7     │  [T] mesmos itens do dock
├────────────────────────────────────────────┤
│ Bruno Saito   Brujah            há 2 min   │
│ Vit ■■■■□□□ −2   Sangue 4/12   FdV 2/5     │
├────────────────────────────────────────────┤
│ Toque → ficha em modo leitura; deslize     │  [A] pager horizontal entre fichas
│ para o lado para a próxima ficha.          │
└────────────────────────────────────────────┘
```

- **Alternativas consideradas:**
  - Abas por jogador: não escala acima de 5.
  - Tela dividida: boa só em tablet. Fica como variante para tablet.
- **Multi-sistema:** a linha-resumo reaproveita os itens do dock do template da crônica. Em D&D, o painel vira **rastreador de iniciativa** (`initiative` no template). Em CoC mostra SAN e insanidade. Em Fate, estresse e Pontos de Destino. Segurança: o RBAC é no servidor, nunca só escondendo controles no cliente.

```text
┌────────────────────────────────────────────┐
│ INICIATIVA          rodada 3      [Próx.]  │  [T] D&D: initiative
│ ▶ 18  Lia Brasa   PV 23/27  CA 17* Escudo  │  [A] mesma linha-resumo
│   15  Goblin 2    PV  3/7                  │
│   12  Thorg       PV 41/52  CA 18  Fúria   │
└────────────────────────────────────────────┘
```

- **Esforço:** M

#### UX-12: Safe areas, barra de status e gestos do sistema

- **Severidade:** Médio
- **Onde:**
  - Mockups: a barra inferior tem `padding-bottom: 20px` fixo (o home indicator pede 34) e o header não tem inset superior.
  - Repositório: `packages/ui/src/Screen.tsx` usa o `SafeAreaView` do `react-native`, que só atua no iOS e está marcado como obsoleto (deprecated) nas versões recentes do RN. Enquanto isso, `apps/frontend/app.json` tem `edgeToEdgeEnabled: true`, então no Android o conteúdo vai para baixo da barra de status.
  - `userInterfaceStyle: "light"` com tema escuro deixa ícones escuros sobre `#120e10`.
- **Cenário real:** ao tocar "Rolar dados" perto da borda, o polegar arrasta o home indicator e o app vai para segundo plano. No Android, o "‹" fica sob a barra de status.
- **Solução recomendada:** usar `react-native-safe-area-context` (já é dependência) em vez do `SafeAreaView` do RN, `<StatusBar style="light" />` nas telas escuras e `userInterfaceStyle: "automatic"` (ou `"dark"`).

```tsx
const insets = useSafeAreaInsets();
const DOCK = 64, HEADER = 48;
// Dock: acima do home indicator e respeitando o notch em paisagem
<View style={{ position: 'absolute', left: 0, right: 0, bottom: 0,
  paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12),
  paddingLeft: Math.max(insets.left, 16), paddingRight: Math.max(insets.right, 16) }}>
  <CombatDock items={template.mobile.dock.slice(0, 3)} />
</View>
// Conteúdo: nada fica escondido atrás do dock
<ScrollView contentContainerStyle={{ paddingTop: insets.top + HEADER, paddingBottom: DOCK + insets.bottom + 16 }}
  scrollIndicatorInsets={{ bottom: DOCK + insets.bottom }} />
```

- **Alternativas consideradas:** padding fixo por plataforma. Quebra com notch, Dynamic Island, paisagem e navegação por gestos versus 3 botões.
- **Multi-sistema:** é estrutura do app e não depende do template.
- **Esforço:** P

#### UX-13: Legibilidade com pouca luz e baixa visão

- **Severidade:** Médio
- **Onde:**
  - Rótulos de 12 px em caixa alta muted ("PONTOS DE SANGUE"). Dicas de 11 px (formas, "QUINTESSÊNCIA" e "PARADOXO" na roda).
  - Especializações em 13 px itálico.
  - Caixa bloqueada `#3a2e33` com 1,39:1. Ponto de Esfera bloqueado `#5c4b52` com 2,21:1.
  - Pontos tracejados de 14 px para bônus e perda.
  - Ponto cheio de Tremere com 3,55:1, cerca de 2,5:1 com protanopia (simulação Machado).
- **Cenário real:** brilho em 20% para não incomodar a mesa à luz de velas. Bia não distingue tracejado de vazio e conta errado a Força em Crinos.
- **Solução recomendada:**
  - Número ao lado de todo traço (15–17 px, `ink`). Tracejado só como pista secundária, com texto ("+4 da forma").
  - Limite de capacidade por texto ("máx. 7") em vez de caixas quase invisíveis.
  - Nenhum texto com significado abaixo de 13 px.
  - Validar as cores de linhagem também com simulação de daltonismo (≥ 3:1).
  - "Modo sessão": dock e valores maiores, tela sempre ligada.
- **Alternativas consideradas:** um tema "alto contraste" separado. Útil depois, mas os números resolvem a maior parte sem dobrar o tema.
- **Multi-sistema:** as cores de linhagem ou "família" vêm do template e seguem a mesma regra de contraste em qualquer sistema. Em CoC, metade e quinto (22 · 9) são usados na rolagem e precisam de ≥ 13 px, não são decoração.
- **Esforço:** P

#### UX-14: Mago: controles de Quintessência e Paradoxo ambíguos, com efeito colateral silencioso

- **Severidade:** Médio
- **Onde:** grade de 2 colunas `[−] Quint. [+] [−] Parad. [+]`, com 12 px entre "Quint. +" e "Parad. −". Rótulos abreviados. `pUp()` com a roda cheia tira 1 Quintessência sem aviso (regra do README do `QuintessenceWheel`).
- **Cenário real:** Tomás canaliza Quintessência num Nodo e toca o "−" do Paradoxo, logo ao lado. Dissipou o Paradoxo que a narradora tinha dado.
- **Solução recomendada:** a roda continua como visualização. A edição passa a ser feita em duas **linhas separadas** no sheet ("Quintessência 6 [−][+]" e "Paradoxo 2 [−][+]"), com nomes por extenso e steppers de 56 px. O efeito colateral é anunciado: "Roda cheia: +1 Paradoxo tirou 1 Quintessência · Desfazer".
- **Alternativas consideradas:** separar as duplas visualmente na mesma linha. Ajuda pouco a 390 px e nada a 360 px.
- **Multi-sistema:** é o padrão de **recursos acoplados**: Pathos e Angústia na Aparição, Glamour e Banalidade no Changeling, PV e PV temporários em D&D, SAN máxima e Mitos de Cthulhu em CoC. O template declara a regra de acoplamento. O app desenha linhas separadas e anuncia o efeito.
- **Esforço:** P

#### UX-15: Não há como consultar poderes (Disciplinas, Dons, Esferas)

- **Severidade:** Médio
- **Onde:** as linhas mostram só o nível. As linhas de Dons (52 px) não são interativas. O gesto natural de "abrir" (tocar) altera valores (UX-01).
- **Cenário real:** veja V5.
- **Solução recomendada:** sheet de detalhe (esboço em UX-01) com níveis, especialização, paradas relacionadas, notas do jogador e da narradora, e "Montar parada". Dons ganham sistema, custo e rolagem.
- **Licença:** os textos de WoD e CoC são protegidos e não devem ser embutidos. O SRD 5.1 de D&D é CC BY 4.0 e pode ser incluído com atribuição. O padrão é o template trazer nomes e o jogador ou a narradora escrever a descrição.
- **Alternativas consideradas:** um link externo para wiki. Tira a pessoa da mesa e depende de rede.
- **Multi-sistema:** os campos de detalhe vêm do template. Magia de D&D: nível, escola, tempo de conjuração, alcance, componentes, duração, concentração. Feitiço de CoC: custo em PM e SAN. Façanha de Fate: texto. O sheet é sempre o mesmo.
- **Esforço:** M

#### UX-16: Paisagem e mesa: rotação acidental e falta de layout intermediário

- **Severidade:** Baixo
- **Onde:** o README define 1 coluna até 600 px e 2 a partir de 900 px. Não há nada entre 600 e 899 px, que é justamente o celular em paisagem (844×390 e 800×360). O `app.json` já trava `portrait`, o que é bom para celular, e tem `supportsTablet: true`.
- **Solução recomendada:** manter retrato no celular. Liberar a rotação no tablet com `expo-screen-orientation`. Entre 600 e 899 px, usar 2 colunas (corpo + painel lateral com os itens do dock na vertical) e insets laterais.
- **Multi-sistema:** estrutura do app.
- **Esforço:** P

#### UX-17: Teclado sobre campos de texto

- **Severidade:** Baixo
- **Onde:** Notas no fim da página (texto estático no mockup, editável no produto) e campos de identidade. O dock e o aviso ficam presos embaixo.
- **Solução recomendada:** editar texto num sheet de altura total com `KeyboardAvoidingView` (ou `react-native-keyboard-controller`), esconder o dock com o teclado aberto e usar `keyboardType="number-pad"` para números.
- **Multi-sistema:** pesa mais em sistemas com muito texto ou número digitado: inventário e moedas em D&D, equipamento em CoC, aspectos em Fate. É comportamento do app por tipo de widget.
- **Esforço:** P

#### UX-18: Ações principais sem fluxo e inconsistentes entre plataformas

- **Severidade:** Baixo
- **Onde:** "Rolar dados" e "Gastar sangue" (Vampiro), "Conjurar efeito" e "Rolar dados" (Mago) sem `onClick`. O Web tem "Editar ficha" e o mobile não tem.
- **Solução recomendada:** a ação primária é sempre "Dados", no dock, abrindo a parada. O Mago usa o rótulo "Conjurar" vindo do template. As ações secundárias viram chips. "Evoluir personagem" fica no "⋮", igual ao Web.
- **Multi-sistema:** o rótulo da ação primária (`primaryAction`) e o modelo de rolagem vêm do template (D&D "Atacar/Testar", CoC "Testar").
- **Esforço:** P

#### UX-19: Estado de navegação não é preservado, e as abas padrão são arbitrárias

- **Severidade:** Baixo
- **Onde:** `tabA: 2` e `tabH: 2` no Vampiro e no Mago. Ao reabrir a ficha, tudo volta ao padrão. O Lobisomem volta para "Físicos" ao trocar de forma, o que é bom.
- **Solução recomendada:** guardar por personagem a rolagem, a seção, os filtros e a última parada. Com a proposta, as abas praticamente desaparecem.
- **Multi-sistema:** estrutura do app.
- **Esforço:** P

### Proposta de layout mobile

#### Estrutura fixa do app × conteúdo do template

| Camada | Fixo no app [A] | Vem do template [T] |
|---|---|---|
| Header | voltar, nome, selo, estado de sincronização, "⋮" | campos de identidade, cor da linhagem ou família |
| Chips de seção | scroll spy, esconder e mostrar, rolagem até a seção | lista, ordem e rótulos |
| Corpo | renderizador por widget, linha de 48 px como alvo, número sempre visível, filtro "só investidos", busca | traços, grupos, widget de cada traço, regra de "investido" |
| Dock | posição, 3 chips + "Dados", expansão, toque longo, aviso com Desfazer | quais recursos, rótulo curto, ação padrão e ações nomeadas |
| Sheets | editor por tipo, stepper, desfazer, histórico, restrição não destrutiva | limites, custos de XP, restrições, efeitos colaterais |
| Parada | casca: seleção, total, modificadores com origem, rolar ou "rolei na mão" | modelo (pool, d20, d100, 4dF, 2d6), slots, dificuldade, boosts |
| Estados | chip de estado, valor efetivo com origem, aplicação na parada | lista de estados, modificadores, duração, custo |
| Sincronização | fila de eventos, indicador, conflitos | nada (o servidor valida pelo schema do template) |

#### Esqueleto: o que fica fixo e o que rola (WoD · Vampiro)

```text
┌────────────────────────────────────────────┐
│ status bar / Dynamic Island (inset 47)     │  [A] safe area
├────────────────────────────────────────────┤
│ ‹  Helena Varga ● Tremere   ● salvo    ⋮   │  FIXO  header 48
│ Atributos Habilidades Vantagens Vitalid›   │  FIXO* chips 40 (somem ao rolar p/ baixo)
╞════════════════════════════════════════════╡
│ 1 Identidade recolhida (96)            ˅   │  ROLA  [T] identity
│ 2 Atributos: grade 3×3 com números (190)   │  ROLA  [T] primaryGrid
│ 3 Habilidades: só com pontos, 3 grupos     │  ROLA  [T] lists + filtro
│   (18 linhas × 48 = ~900)                  │
│ 4 Vantagens: Disciplinas, Antecedentes,    │  ROLA  [T] lists
│   Virtudes, Humanidade (linhas → detalhe)  │
│ 5 Vitalidade: trilha completa (leitura)    │  ROLA  [T] damageTrack
│ 6 Recursos completos: Sangue, FdV (leit.)  │  ROLA  [T] trackers
│ 7 História: citação, Natureza, Comport.,   │  ROLA  [T] text
│   Senhor, Notas (texto editável)           │
╞════════════════════════════════════════════╡
│ toast Desfazer (quando houver)             │  FLUTUA acima do dock
├────────────────────────────────────────────┤
│ [VITALID.][SANGUE][ FDV ][  DADOS  ]       │  FIXO  dock 64  [T] 3 chips + [A] Dados
│    ︿ puxe para ver todos os recursos       │  FIXO  dock expande (sheet persistente)
│ home indicator (inset 34)                  │  [A] safe area
└────────────────────────────────────────────┘
```

#### O mesmo esqueleto em D&D 5e

```text
┌────────────────────────────────────────────┐
│ status bar / Dynamic Island (inset 47)     │  [A]
├────────────────────────────────────────────┤
│ ‹  Lia Brasa ● Maga nv 5    ● salvo    ⋮   │  FIXO  mesmo header
│ Atributos Perícias Combate Magias Inv. ›   │  FIXO* [T] seções D&D
╞════════════════════════════════════════════╡
│ 1 Identidade: raça, classe, nível, antec.  │  ROLA  [T] identity
│ 2 Atributos: grade 3×2, mod + valor        │  ROLA  [T] primaryGrid (score+mod)
│   + salvaguardas ◆                         │
│ 3 Perícias: só proficientes, bônus         │  ROLA  [T] proficiency list
│ 4 Combate: CA, iniciativa, desloc.,        │  ROLA  [T] stats + attacks list
│   ataques (toque → parada pronta)          │
│ 5 Magias: espaços por nível, preparadas    │  ROLA  [T] boxes + list (SRD c/ atrib.)
│ 6 Inventário: itens, qtd., peso, moedas    │  ROLA  [T] list (teclado!)
│ 7 Traços, idiomas, história, notas         │  ROLA  [T] text
╞════════════════════════════════════════════╡
│ toast Desfazer                             │  FLUTUA
├────────────────────────────────────────────┤
│ [ PV 27/27+5 ][ CA 12 ][ESP 1º][ DADOS ]   │  FIXO  [T] hp, ac, slots + [A] Dados
│    ︿ dados de vida, Ki, inspiração, morte  │  FIXO  dock expandido
│ home indicator (inset 34)                  │  [A]
└────────────────────────────────────────────┘
```

#### Primeira tela, lado a lado: Vampiro e D&D 5e

```text
┌────────────────────────────────────────────┐
│ ‹  Helena Varga ● Tremere   ● salvo    ⋮   │  [A] header compacto fixo (48)
│ Atributos  Habilidades  Vantagens  Vit›    │  [A] chips de seção | [T] nomes/ordem
├────────────────────────────────────────────┤
│ (HV) Arquivista da Capela · 8ª ger.   ˅    │  [T] identity.primary, recolhido
│                                            │
│ ATRIBUTOS                  Físicos/Soc/Men │  [T] seção primaryGrid
│ ┌─────────────┬─────────────┬─────────────┐│
│ │Força        │Carisma      │Percepção    ││  [A] célula 110×56 = alvo
│ │●●○○○     2  │●●○○○     2  │●●●○○     3  ││  [T] widget rating 0–5
│ ├─────────────┼─────────────┼─────────────┤│
│ │Destreza     │Manipulação  │Inteligência ││
│ │●●○○○     2  │●●●○○     3  │●●●●○    4*  ││  * especialização
│ ├─────────────┼─────────────┼─────────────┤│
│ │Vigor        │Aparência    │Raciocínio   ││
│ │●●○○○     2  │●●○○○     2  │●●●○○     3  ││
│ └─────────────┴─────────────┴─────────────┘│
│ HABILIDADES       só com pontos ▾  Buscar  │  [A] filtro + busca | [T] regra 'investido'
│ Talentos                                   │  [T] grupos
│ Prontidão                   ●●○○○    2     │  [A] linha 48px = 1 alvo
│ Esquiva                     ●○○○○    1     │
├────────────────────────────────────────────┤
│  +1 Sangue (10/15)          [ Desfazer ]   │  [A] toast 5 s acima do dock
├────────────────────────────────────────────┤
│ ┌────────┐┌────────┐┌────────┐ ┌─────────┐ │  [A] dock fixo (64 + inset)
│ │VITALID.││ SANGUE ││  FDV   │ │  DADOS  │ │  [T] dock: health, blood, wp
│ │ ■■□ −1 ││  9/15  ││  5/7   │ │  parada │ │  [A] botão Dados (ouro)
│ └────────┘└────────┘└────────┘ └─────────┘ │  [T] modelo: pool d10
└────────────────────────────────────────────┘
```

```text
┌────────────────────────────────────────────┐
│ ‹  Lia Brasa ● Maga nv 5    ● salvo    ⋮   │  [A] mesmo header
│ Atributos  Perícias  Combate  Magias  ›    │  [T] seções do template D&D
├────────────────────────────────────────────┤
│ (LB) Elfa · Evocação · Sábia         ˅     │  [T] identity: raça, subclasse, antec.
│                                            │
│ ATRIBUTOS                 salvaguarda ◆    │  [T] primaryGrid = abilities
│ ┌─────────────┬─────────────┬─────────────┐│
│ │FOR       −1 │DES       +2 │CON       +1 ││  [T] widget score+mod
│ │           8 │          14 │          12 ││  (o modificador é o número grande)
│ ├─────────────┼─────────────┼─────────────┤│
│ │INT ◆     +4 │SAB ◆     +1 │CAR       +0 ││
│ │          18 │          12 │          10 ││
│ └─────────────┴─────────────┴─────────────┘│
│ PERÍCIAS       só proficientes ▾ Buscar    │  [A] mesmo filtro | [T] regra 'prof.'
│ Arcanismo  ◆                        +7     │  [T] widget proficiency + bônus
│ História   ◆                        +7     │
│ Percepção                           +1     │
├────────────────────────────────────────────┤
│  Espaço 1º nível usado (3/4)  [Desfazer]   │  [A] mesmo toast
├────────────────────────────────────────────┤
│ ┌────────┐┌────────┐┌────────┐ ┌─────────┐ │  [A] mesmo dock
│ │   PV   ││   CA   ││ESPAÇOS │ │  DADOS  │ │  [T] dock: hp(+temp), ac(stat), slots
│ │27/27+5 ││   12   ││ 1º 4/4 │ │ d20+mod │ │
│ └────────┘└────────┘└────────┘ └─────────┘ │  [T] modelo: d20 + mod
└────────────────────────────────────────────┘
```

As molduras são idênticas: header, chips, grade primária, lista com filtro, aviso e dock. Mudam só o que o template diz: widget da grade (`rating` × `score+mod`), regra do filtro (pontos × proficiência), itens do dock e modelo de rolagem.

#### Catálogo de widgets × sistemas

| Widget [A] | WoD (V/M/L) | Aparição / Changeling | D&D 5e | CoC 7e | Fate / PbtA |
|---|---|---|---|---|---|
| `rating` (pontos 0–N) | Atributos, Habilidades, Disciplinas, Esferas, Arete | Arcanoi, Paixões; Artes, Reinos | — | — | — |
| `score` / `number` (+ derivado) | — | — | Atributos (mod), CA, Iniciativa | Características (½, ⅕) | perícias +0..+4; atributos −1..+3 |
| `percent` | — | — | — | Perícias, SAN, Sorte | — |
| `tracker` (atual/máx, temporário) | Sangue, FdV, Fúria, Gnose, Quintessência | Pathos, Angústia; Glamour, Banalidade | PV (+temp), Ki, dados de vida | PV, PM, SAN | Pontos de Destino |
| `damageTrack` | Vitalidade `/ X ✱` | Corpus; Vitalidade real + quimérica | (PV é `tracker`) + testes contra a morte | ferimento grave | Estresse + Consequências; Dano |
| `slots` / `boxes` | — | — | Espaços de magia, testes contra a morte | — | caixas de estresse |
| `proficiency` | — | — | Perícias, salvaguardas | marca de evolução | — |
| `state` | Formas do Garou | Catarse | Fúria, Forma Selvagem, condições | Insanidade temporária | Condições |
| `text` / `list` | Natureza, Dons, Notas | Grilhões, Legados | Traços, inventário, magias | Histórico, equipamento | Aspectos, façanhas, movimentos |

#### Trecho de `template_data` (V20 e D&D 5e)

```jsonc
// V20
{
  "mobile": {
    "identity": ["clan", "generation", "concept"],
    "sections": ["attributes", "abilities", "advantages", "health", "resources", "story"],
    "primaryGrid": "attributes",
    "dock": ["health", "bloodPool", "willpower"],
    "primaryAction": { "label": "Dados", "roll": "pool" }
  },
  "traits": {
    "dexterity": { "label": "Destreza", "group": "physical", "widget": "rating", "max": 5 },
    "bloodPool": { "label": "Pontos de Sangue", "shortLabel": "Sangue", "widget": "tracker", "max": 15,
                   "defaultAction": "spend1",
                   "actions": [{ "id": "heal1", "label": "Curar 1 nível", "cost": 1, "effect": "health.heal" }] },
    "health": { "widget": "damageTrack", "types": ["bashing", "lethal", "aggravated"], "sort": "severity",
                "levels": [["Escoriado", 0], ["Machucado", -1], ["Ferido", -1], ["Ferido gravemente", -2],
                           ["Espancado", -2], ["Aleijado", -5], ["Incapacitado", null]] }
  },
  "roll": { "model": "pool", "die": 10, "slots": ["attribute", "ability"], "penalty": "health",
            "boosts": [{ "resource": "willpower", "effect": "autoSuccess" }] }
}

// D&D 5e
{
  "mobile": {
    "identity": ["race", "class", "level", "background"],
    "sections": ["abilities", "skills", "combat", "spells", "inventory", "story"],
    "primaryGrid": "abilities",
    "dock": ["hp", "ac", "spellSlots"],
    "primaryAction": { "label": "Dados", "roll": "d20" }
  },
  "traits": {
    "int": { "label": "Inteligência", "shortLabel": "INT", "widget": "score", "min": 1, "max": 30, "derived": "abilityModifier" },
    "hp": { "label": "Pontos de Vida", "shortLabel": "PV", "widget": "tracker", "temp": true, "tempFirst": true, "atZero": "deathSaves" },
    "ac": { "label": "Classe de Armadura", "shortLabel": "CA", "widget": "stat" },
    "spellSlots": { "label": "Espaços de magia", "shortLabel": "Espaços", "widget": "slots", "reset": "longRest" }
  },
  "roll": { "model": "d20", "slots": ["ability", "skill|save|attack"], "advantage": true }
}
```

Segurança dos templates: `derived` e `effect` são **nomes de funções de uma lista fechada** (`abilityModifier`, `health.heal`), nunca expressões avaliadas com `eval` ou `new Function`. Se templates puderem vir de usuários no futuro, avaliar código seria RCE no servidor e XSS no web. O schema do template valida também os eventos no servidor (UX-10).

#### Rotas com sheets nativos (Expo Router)

```tsx
// app/ficha/[characterId]/_layout.tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="index" />
  <Stack.Screen name="traco/[traitId]" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true }} />
  <Stack.Screen name="recurso/[resourceId]" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.45, 0.9], sheetGrabberVisible: true }} />
  <Stack.Screen name="dados" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true }} />
</Stack>
```

Sheets como rotas fecham com o voltar do Android e com o gesto do iOS, e entram no histórico de navegação. Validar o comportamento no Android (react-native-screens). Se não atender, usar `@gorhom/bottom-sheet` só para o dock expansível. Para o aviso de Desfazer, um componente próprio com `react-native-reanimated` (já instalado) evita mais uma dependência. Háptico: `expo-haptics`. Tela ligada: `expo-keep-awake`. Os três são first-party do Expo.

### Checklist de validação

**Testes com pessoas (protótipo em Expo Go, no aparelho de cada participante, nunca em emulador)**

- [ ] **Teste de tarefas moderado**, 5 participantes por persona (novato, veterano, narrador, baixa visão).
  - Tarefas V1–V6, M1–M4, L1–L4 e G2.
  - Medir sucesso, tempo, toques, rolagens e erros (toda alteração não intencional).
  - Questionário SEQ depois de cada tarefa.
  - **Meta:** 2 de dano em ≤ 3 toques e ≤ 5 s. Parada Destreza + Esquiva em ≤ 3 toques sem ajuda. Zero alterações acidentais.
- [ ] **Sessão real de jogo (in situ)**, 2 a 3 horas, com uma mesa de cada sistema.
  - Observar quantas vezes o jogador olha para o celular em vez da mesa, onde trava e o que pergunta à narradora.
  - Gravação só com consentimento por escrito (LGPD). Anotações sem nomes reais. Nada de dados pessoais no relatório.
- [ ] **Uma mão:** o participante segura 5 d10 (ou um copo) na outra mão. Repetir com canhotos.
- [ ] **Pouca luz:** sala com cerca de 10 lux e brilho do celular em 20–30%. A tarefa é ler Destreza, Força em Crinos e Esfera de Forças. **Meta:** zero leituras erradas.
- [ ] **Leitor de tela:** VoiceOver (iOS) e TalkBack (Android) com tela apagada.
  - Tarefas: "qual é sua Destreza?", "gaste 1 de Força de Vontade", "quanto de penalidade você tem?".
  - **Meta:** o anúncio é "Destreza, 2 de 5" e cada tarefa leva ≤ 10 gestos.
- [ ] **Fonte grande:** iOS em "Tamanhos de texto maiores" no máximo e Android com fonte e tamanho de exibição no máximo, em aparelhos de 360, 390 e 430 de largura. **Meta:** nenhum texto cortado, nenhuma sobreposição, dock utilizável.
- [ ] **Offline:** modo avião no meio da tarefa, 5 mudanças e reconexão. Conflito com a narradora editando a mesma Vitalidade. **Meta:** nenhuma perda, aviso de conflito compreendido.
- [ ] **Narradora:** "quem ainda tem Força de Vontade?" com 4 fichas. **Meta:** ≤ 10 s pelo painel da mesa, sem alterar nada por engano.
- [ ] **Multi-sistema:** repetir 3 tarefas com uma mesa de D&D 5e (dano com PV temporário, usar espaço de magia, teste de perícia com vantagem) e uma de CoC (perda de SAN, teste difícil). **Meta:** as mesmas metas de toques, sem tela específica do sistema.
- [ ] **Preferência A/B:** barra atual versus dock com 3 chips, com veteranos. Medir tempo de gasto de recurso e erros.

**Verificações técnicas (antes do teste com pessoas)**

- [ ] Nenhum alvo menor que 44 pt (iOS) ou 48 dp (Android). Auditoria com o Accessibility Inspector e o Accessibility Scanner.
- [ ] Nenhum texto com significado abaixo de 13 px. Contraste ≥ 4,5:1 para texto e ≥ 3:1 para pontos, inclusive com simulação de protanopia e deuteranopia.
- [ ] Insets corretos em iPhone com Dynamic Island, Android edge-to-edge com navegação por gestos e por 3 botões, e paisagem no tablet.
- [ ] Todo evento de alteração validado no servidor: AuthZ por crônica, limites do template e rate limit. Testes automatizados de IDOR (jogador A tentando editar a ficha do jogador B).
- [ ] Instrumentação sem PII: taxa de desfazer por tipo de ação, tentativas de toque em pontos no modo leitura, tempo entre abrir um sheet e a ação.
