# P09-D · Narrador: progresso da criação e painel de regras: plano de implementação

> Plano · 2026-11-05 · base conferida: `onda/5-narrador-entrada-uso` em `05c5d7d`

Este plano implementa o pacote [P09-D da matriz de achados](../testes/2026-11-01/matriz-achados.md#p09-d), da onda 5, que aplica a decisão D-10. Ao fim do pacote:

- o cartão da Mesa mostra o progresso da criação por pontos ("Atributos ✓ · Habilidades: faltam 4 · Bônus: restam 2 de 15", ou "A conta fechou");
- a Mesa ganha o filtro "Em criação" e "Pendentes", com a contagem de cada um;
- a lista de crônicas diz ao narrador quantas fichas estão em criação ("2 fichas em criação");
- a aba "Pontos" da ficha aparece em Leitura para o narrador também em `pending`, e o aviso "Aguardando aprovação" leva a ela;
- o painel "Criação de fichas" vira um resumo depois de salvo, com "Editar", e as abas da crônica ficam logo abaixo do topo.

É um pacote de decisão de produto. Ele não remove campo, não muda regra do jogo e não afrouxa limite:

- o progresso é a conta do `checkCreation` do `@tms/sheet-core`, a mesma que o jogador vê na barra e que o servidor repete a cada lote, ao concluir e ao aprovar (`apps/api/src/sheets/creation.ts:666`, `:762`). Ele só mostra o que a conta já diz;
- o servidor continua a autoridade: a Mesa e a contagem só chegam ao narrador da crônica, e a aprovação revalida a ficha de agora;
- o pacote muda a API HTTP em dois campos aditivos (§3.9), não muda o `@tms/sheet-core`, o `@tms/ui`, os templates nem o `schema.json`, e não tem migration.

Todas as linhas citadas são do `05c5d7d`. A matriz cita o `1db3db9`, de antes das ondas 1 a 4. O que mudou desde então, e onde a causa provável da matriz está errada, está na §3.0.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md), legenda, "Ondas e pacotes", "Decisões de produto" (D-10), "Como executar" e §P09-D (l.521-538) | Itens, decisão, "PR local" e critério de saída da onda 5 |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §1 (C1, C5), §4.1 (passo 13) e §6.2; [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) (QAW-31) | Causas e a tarefa "acompanhar" do narrador |
| Notas: [narrador-web](../testes/2026-11-01/notas/narrador-web.md) (NW-03, NW-04, NW-10, NW-11, NW-20; fase 2, l.153-262), [narrador-app](../testes/2026-11-01/notas/narrador-app.md) (NA-03, NA-11, NA-15, NA-19; fase 2, l.144-281), [po-app](../testes/2026-11-01/notas/po-app.md) (POA-19, POA-20; l.64-65, l.163, l.207-208), [po-web](../testes/2026-11-01/notas/po-web.md) (POW-11, POW-32; l.177, l.198, l.237), [qa-web](../testes/2026-11-01/notas/qa-web.md) (QAW-31, l.165) | Cenários do critério de pronto (§7) e do roteiro manual (§11) |
| [plano-v3.md](../plano-v3.md) Etapa 9 e [plano-v4.md](../plano-v4.md) §1.7 e §3.4 | A Mesa; aprovar ou devolver em `pending`; a configuração da ficha nasce com o padrão da crônica |
| [validacao-v5.md](../validacao-v5.md) l.120-122 | "Desde a v4, a configuração da criação fica acima das abas" (já conhecido) |
| [P09-C](P09-C-narrador-mesa.md) §3.2, §3.5, §3.6, §10 (desvios 6, 10 e 16) | A Leitura do narrador com a conta (T-33), o cartão compacto, a grade, a barra da seleção e o limite de 170 |
| [P04-D](P04-D-estado-proximo-passo.md) §3.3 a §3.5 | Estados da ficha (D-02 a D-04), marcadores do `creation` sem o motivo e o `pendingReview` |
| [P05-D](P05-D-guia-o-que-falta.md) §3.1, §3.3, §3.6, §9 (pergunta 6, ponto 5) e §10 | O `guideItems`, o `fitGuide`, a aba "Pontos", a `GuideList` e o "Orçamento" das regras da crônica |
| [P11](P11-bastidores-npc.md) | O NPC oculto, a seção de NPCs da Mesa e o selo de visibilidade |
| [onda-3.md](onda-3.md) §4.3 e §11 (cartão de 183 → 157 px); [onda-4.md](onda-4.md) §6 (ponto 15), §8, §11 e §12.1 | O que só a integração pegou, o ponto do "Orçamento" em aberto e o guia que entrou |
| `design/design-system/components.md` l.733-746 (ListItem / CharacterCard, cartão e seleção da Mesa) | Onde o progresso e o filtro entram no DS |

## 1. Objetivo e itens

**Objetivo (matriz).** O narrador acompanha a criação pela Mesa (progresso, filtro, pendentes) sem abrir ficha por ficha, e o painel "Criação de fichas" deixa de ocupar o topo da crônica.

| ID | Sev. | Em uma linha | Onde está (conferido no `05c5d7d`) |
|---|---|---|---|
| T-36 | média | O bloco "Criação de fichas" (~1,5 a 2 telas) fica acima das abas Fichas/Mesa/Bastidores em toda visita; o aviso de revisão e o "Convidar" ficam abaixo da dobra | `apps/frontend/app/(app)/chronicles/[id]/index.tsx:234-240` (`CreationSettings` antes das `Tabs`, `:242-261`; a matriz cita l.106 do `1db3db9`). O painel é sempre aberto: `components/chronicles/CreationSettings.tsx:97-266` |
| R-15 | média | A Mesa mostra só o estado, sem progresso nem conta; não há filtro da criação; a lista de crônicas não diz quem está montando ficha; a aba da conta não aparece em `pending` | Cartão: `components/chronicles/TableRow.tsx:71-89` (nome acessível), `:126-162` (selos e meta). Itens: `components/chronicles/tableItems.ts:93-125` (o store da linha nasce sem a entrada da conta). Filtros: `components/chronicles/TableView.tsx:264-282` ("Só com alerta" em `:277-281`; a matriz cita l.201). API: `apps/api/src/chronicles/table.ts:137` (só o modo e os marcadores). Lista: `apps/api/src/chronicles/routes.ts:358-383` (só o `pendingReview`) e `app/(app)/index.tsx:26-55`. Aba em `pending`: `sheet/SheetView.tsx:217-224`, `sheet/creation/CreationPanel.tsx:64-69` e `:197-203` |

**Também entram:**

- **a pergunta 2 do [P09-C](P09-C-narrador-mesa.md) §9** ("a conta aparece em Leitura só em `creating`"), que a D-10 responde: também em `pending` (§3.6);
- **a pergunta 6 do [P05-D](P05-D-guia-o-que-falta.md) §9** ("o `guide.ts` no core para o P09-D"): a resposta deste plano é que ele **não sobe**. O progresso é calculado no app, com a mesma conta e as mesmas frases (§3.1);
- **os dois ganchos que as ondas anteriores deixaram:** o comentário de `TableRow.tsx:29-30` ("O progresso do P09-D ganha uma linha livre") e o de `sheet/creation/summary.ts:11` ("O painel do narrador (D-10, P09-D) reaproveita a linha").

## 2. Decisões aplicadas

| Decisão | O que diz (matriz) | Como o código acomoda |
|---|---|---|
| **D-10** (R-15, T-36), progresso | Cartão da Mesa com o progresso ("Atributos ✓ · Habilidades: faltam 4 · Bônus: restam 2 de 15") | O app calcula a conta de cada cartão em criação por pontos, com o template e o `sheet_data` que a Mesa já manda, mais as escolhas e a camada da criação, que passam a vir na resposta (§3.1). O texto sai de uma função pura nova, ao lado do `guideItems`, com as mesmas peças (§3.2) |
| **D-10**, filtro | Filtro "Em criação / Pendentes" | Dois chips na Mesa, "Em criação (N)" e "Pendentes (N)", pelo estado que o `characterState` já calcula (§3.4). O NPC fica fora |
| **D-10**, contagem | Contagem na lista de crônicas | Um `creatingCount` no `GET /chronicles`, só para o narrador, ao lado do `pendingReview` (§3.5) |
| **D-10**, conta na ficha | O Orçamento em leitura para o narrador dentro da ficha (inclusive em `pending`) | O "Orçamento" da ficha é a aba "Pontos" desde o P05-D. Ela passa a aparecer em Leitura também em `pending`, com "Ver Pontos" no aviso "Aguardando aprovação" (§3.6). A conta já existe no store em `pending` (`SheetScreen.tsx:445`) |
| **D-10**, painel | O painel "Criação de fichas" vira um resumo de uma linha depois de salvo ("Por pontos · 7/5/3 · 15 de bônus · aprovação desligada · Editar"), e as abas sobem para o topo | O `CreationSettings` ganha o estado recolhido: o título, o `summaryLine` que o jogador já lê (T-29) e "Editar" (§3.7). Recolhido, ele ocupa ~140 px a 390 em vez de ~1.240, e as abas sobem junto |

**Fica fora deste pacote:**

- **"Padrão do sistema: 7" e "Restaurar padrão" no orçamento** (NW-04, NA-15; parte da recomendação do T-36). A D-10 não os inclui. É barato (P) e fica para o PO pôr numa linha nova (§9, ponto 7).
- **Abas da crônica fixas na rolagem** (parte da recomendação do T-36 e do NA-03). A D-10 diz "sobem para o topo", não "fixas". Fica como pergunta técnica 6 (§9).
- **O extrato da conta na ficha concluída (R-17)** continua ponto do PO ([onda-2.md](onda-2.md) §6, ponto 6). Depois de concluída, a ficha não tem conta, e a aba "Pontos" não aparece.
- **O progresso na aba Fichas** (a lista da crônica). A lista recebe só a prévia de identidade e dock (`apps/api/src/sheets/routes.ts:379-394`), não a ficha inteira. A D-10 fala só da Mesa.
- **Push ao narrador** ("terminou", "pendente"): `proximas-features.md` §2.2 item 8, como na D-03.
- **A legenda de "Só com alerta"** (NW-11, NA-11). O filtro novo cobre a criação; o "Só com alerta" continua o alerta do template.

**O que o código mostra que não se aplica como está escrito** (apontado, não decidido; vai para o PO na §9):

1. **"Habilidades: faltam 4" não é o texto do guia do P05-D.** O `guideItems` tem um item por grupo ("Talentos 4", "Perícias 2"), não por orçamento. Somar os grupos de um orçamento é aritmética sobre a mesma conta (`CreationGroup.missing`), não uma regra nova, e o plano segue o formato da D-10 (§3.2). A alternativa literal ("o mesmo texto") seria o cartão repetir os itens da barra: "Atributos ✓ · Talentos 4 · Perícias 2 · Bônus: restam 2 de 15". O detalhe por grupo fica a um toque, na aba "Pontos", com as frases da `GuideList`.
2. **"Resumo de uma linha" a 390.** O `summaryLine` do V20 tem ~127 caracteres ("Criação por pontos · Atributos 7/5/3 · Habilidades 13/9/5 · Disciplinas 3 · Antecedentes 5 · Virtudes 7 · 15 de bônus · aprovação desligada") e quebra em 3 linhas de `caption` a 390. Ele é uma linha só a partir de ~900 px. Uma linha a 390 pede tirar os rótulos ("Por pontos · 7/5/3 · 13/9/5 · 3 · 5 · 7 · 15 de bônus"), que o NW-10 propôs, mas aí o narrador e o jogador leriam linhas diferentes. O plano reusa o `summaryLine` (§3.7).
3. **"Filtro 'Em criação / Pendentes'"** pode ser um chip só (tudo o que ainda não está em jogo) ou dois. O plano usa dois, porque as tarefas são outras: acompanhar e ajudar (vez do jogador) × aprovar e concluir (vez do narrador). E "Avisou que terminou" fica em "Pendentes", porque espera o narrador (§3.4).
4. **"Contagem na lista de crônicas" de quê.** O plano conta as fichas em criação que esperam o jogador ("2 fichas em criação") e mantém a de hoje, que espera o narrador ("1 ficha aguarda revisão"). As duas não se sobrepõem (§3.5).
5. **"As abas sobem para o topo"** com o resumo recolhido acima delas (proposta, §3.7) ou com o painel dentro da aba Fichas (alternativa B, §3.7). A D-10 descartou "mover o painel para Bastidores", não a aba Fichas.
6. **"Depois de salvo" numa crônica que nunca salvou as regras** (`creation.revision === 0`). O plano abre o painel na primeira visita e deixa salvar o padrão sem mudança, para recolher (§3.7).
7. **R-15: "não mostra 'Aguardando aprovação'".** Já resolvido no P04-D: o cartão tem o selo de estado (`TableRow.tsx:140-146`, `characterState.ts:83-88`). O P09-D não mexe nisso.

**Pontos para o PO das ondas anteriores que tocam este pacote** (continuam abertos; nenhum é tratado como decidido):

- **[onda-4.md](onda-4.md) §6, ponto 15 ("Orçamento" nas regras da crônica, `CreationSettings.tsx:189`).** O resumo recolhido não usa a palavra. O editor aberto continua com o título "Orçamento". O plano não renomeia, e a §3.8 diz o que muda se o PO decidir.
- **[onda-2.md](onda-2.md) §6, ponto 6 (extrato, R-17):** não muda (acima).
- **[onda-3.md](onda-3.md) §6, ponto 3 (ficar no Editar depois de salvar):** não toca este pacote. O narrador revisa em Leitura.

## 3. Desenho por item

### 3.0 O que o código faz hoje

| Peça | Hoje (`05c5d7d`) | Código |
|---|---|---|
| Tela da crônica | Nesta ordem: o `Banner` do ex-membro, o sistema e "Você narra esta crônica.", a proposta de narrar (jogador), o `CreationSettings` (narrador) e as `Tabs`. Tudo dentro do `ScrollView` | `[id]/index.tsx:210-261` |
| Painel "Criação de fichas" | Sempre aberto: "Como funciona" (aprovação e modo) e "Orçamento" (prioridades, Stepper por orçamento, bônus), "Salvar regras da criação" desabilitado sem mudança, e o `UnsavedChangesGuard` (T-56) | `CreationSettings.tsx:97-266`; título `:104-107`; "Orçamento" `:189`; salvar `:239-264`; guarda `:99-103` |
| A linha do jogador | O jogador lê `summaryLine(chronicleCreationSummary(...))` sob "Suas fichas" (T-29). O narrador não tem essa linha | `CharacterList.tsx:170-186`, `:256-259`; `sheet/creation/summary.ts:53-74` |
| Avisos de revisão | "1 ficha aguarda sua revisão" e "1 jogador avisou que terminou", na aba Fichas, abaixo do painel (POA-19) | `CharacterList.tsx:261-288` |
| Cartão da Mesa | Avatar, nome, a linha de selos (chip de identidade, visibilidade do NPC, estado, alertas), a meta ("alterada por …") e o dock. Medido em 157 px a 390 e a 360 com os selos ([onda-3.md](onda-3.md) §11, `9439cfa`) | `TableRow.tsx:91-185` |
| O store do cartão | `createSheetStore` sem `creation`: o `check` fica nulo, e nada no cartão sabe da conta | `tableItems.ts:98-109`; `sheetStore.ts:436-440` (o `check` só existe com `creation`) |
| Filtros da Mesa | "Em jogo / Arquivadas e fora de jogo" (escopo, do servidor), "Nome", "Última alteração" e "Só com alerta" | `TableView.tsx:249-282`; `tableItems.ts:146-159` (`arrange`) |
| Resposta da Mesa | Só o narrador da crônica (os outros recebem 404). A ficha inteira (sem campo restrito), o estado da criação (modo e marcadores booleanos, sem o motivo) e o `lastChange`. A coluna `ch.creation` já é lida, mas as escolhas e a camada da configuração não saem | `apps/api/src/chronicles/table.ts:64-65`, `:110`, `:137`; `sheets/creation-state.ts:14-29` |
| Lista de crônicas | `characterCount` e `pendingReview` (`pending`, mais `creating` com "terminei" de PC de outra pessoa), só para o narrador | `routes.ts:341-383`, `:396-420`; `app/(app)/index.tsx:26-55` |
| Aba "Pontos" | Na Criação do dono e na Leitura do narrador **só em `creating`** (`useCreating`). O `CreationPanel` some fora de `creating`. Em `pending`, o aviso diz "Confira a conta e a ficha antes de aprovar", e a conta não está em lugar nenhum (POA-20) | `SheetView.tsx:217-231`; `CreationPanel.tsx:64-69`, `:197-203`; aviso `:561-570` |
| A conta em `pending` | Existe: o `creationActive` vale em `creating` e `pending`, e o store da ficha recebe a entrada | `SheetScreen.tsx:441-451`; `sheet/creation/creation.ts:109-118` |
| Avisos "confirme com o narrador" | Só em `creating` | `sheet/creation/guide.ts:312-319` |
| NPC | Nasce em `creating` (o padrão da coluna, `0014_character_status.ts:20`) com a criação livre (`sheets/routes.ts:190-192`) e pode ficar assim em jogo. O `characterState` devolve null para o NPC em criação (`characterState.ts:61-64`) | — |

**Onde a causa provável da matriz está errada ou incompleta:**

- **T-36:** o arquivo e a causa estão certos; a linha é a `:234-240` (era l.106). O "aviso ao sair com regras não salvas", que a recomendação pede, já existe (T-56, `CreationSettings.tsx:99-103`).
- **R-15:** a causa não está só no `TableView`/`TableRow`/`tableItems` (estimado). Ela tem quatro partes, e duas não são do app:
  1. o cartão não tem conta, porque o store nasce sem a entrada (`tableItems.ts:102-108`);
  2. a API não manda as escolhas e a camada da criação (`table.ts:137`), então o app não conseguiria fazer a conta nem querendo;
  3. a lista de crônicas não tem a contagem (`routes.ts:358-383`);
  4. a aba da conta em `pending` é bloqueada no app (`SheetView.tsx:222-224`, `CreationPanel.tsx:197-203`), por decisão do P09-C (pergunta 2: "a conta aparece em Leitura só em `creating`").
- **R-15, "não mostra Aguardando aprovação":** já resolvido no P04-D (§2, item 7).

### 3.1 R-15 · Quem calcula o progresso: o app, com a conta do core

**As duas saídas:**

| | **App** (proposta) | Servidor |
|---|---|---|
| Onde roda o `checkCreation` | No aparelho do narrador, uma vez por cartão em criação por pontos, quando a linha muda | No `GET /chronicles/:id/table`, uma vez por ficha em criação por pontos, **a cada requisição** |
| O que a resposta ganha | `creationInput: { choices, config } \| null` por linha (~100 a 300 bytes; ~2 KB com 10 fichas, contra a ficha inteira que a linha já leva) | Um resumo (`progress`) por linha, que o app ainda precisa transformar em texto |
| O texto | As mesmas funções da barra do jogador e da aba "Pontos" (`freebiesBalance`, o "(prioridade)" e as somas do `check`), no mesmo arquivo do `guideItems` | O servidor teria de mandar o `check` inteiro (com os componentes por campo, alguns KB por ficha) ou um formato novo, que o app formataria com outra função: é a "conta nova" que o P05-D queria evitar |
| `@tms/sheet-core` | Não muda | O resumo sem tela teria de subir para o core (P05-D, pergunta 6), com a meta de 95% por arquivo e o `dist` reconstruído |
| Custo de CPU | No cliente. Cada `checkCreation` faz um `resolve` da ficha e mais um por campo sem valor inicial fixo: ~45 no V20, que tem um só `baseline` (`vtm-v20.json`, `creation.baselines`). É o mesmo custo de um toque na Criação do jogador, que o store refaz a cada toque (`sheetStore.ts:436-440`). Com 10 fichas, ~10 toques, uma vez por carga ou por linha que mudou (o `useItems` reaproveita o item da linha igual, `TableView.tsx:145-163`) | No servidor (Bun, uma thread), para todo narrador. O `GET /table` não tem limite de taxa (só as escritas têm: P09-C §3.4) e é rebuscado a cada foco da Mesa (T-40, `TableView.tsx:203-208`). Com 20 fichas em criação, ~900 `resolve` por requisição: é amplificação de CPU por uma rota de leitura sem limite |
| AuthZ | A mesma da Mesa: só o narrador da crônica recebe a linha | A mesma |
| App antigo | Ignora o campo novo e mostra o cartão de hoje | O mesmo |

**Proposta: o app calcula.** Pelo custo no servidor, pelo texto igual ao do jogador sem mudar o core e porque a Mesa já manda o que a conta precisa, menos a entrada da criação.

**O que muda na API** (`apps/api/src/chronicles/table.ts`):

```ts
// sheets/creation-state.ts, ao lado do creationStateOf (aditivo)
export function creationInputView(
  model: SheetModel,
  row: { readonly kind: string; readonly status: string; readonly creation: unknown }
): { readonly choices: CreationChoices; readonly config: CreationConfigLayer } | null
```

- Só em PC (`kind === 'pc'`), em `creating` ou `pending`, com o modo efetivo `points`. No resto (NPC, criação livre, em jogo, arquivada), `null`.
- Sai do `parseCharacterCreation` (`packages/sheet-core/src/creation.ts:918-946`), que já descarta escolha ou camada fora do formato. A resposta leva **só** `choices` e `config`: nunca `returned`, `adjust` ou `ready` (os motivos), que continuam só no `GET /characters/:id` para o dono e o narrador.
- A camada `config` já traz o padrão da crônica de quando a ficha nasceu (`plano-v4.md` §3.4; `sheets/routes.ts:186-199`). O app não precisa do padrão atual da crônica, que pode ter mudado depois.

**No app** (`tableItems.ts:93-125`):

- o `buildItem` passa ao `createSheetStore` a entrada da conta, `creationInputOf(model, parseCharacterCreation(model, row.creationInput))`, as duas do core. O que vem da rede é input hostil: o parse roda de novo no cliente;
- sem `creationInput` (API antiga, NPC, criação livre), o store nasce como hoje, sem conta, e o cartão fica sem a linha (fail secure);
- o `TableItem` ganha `progress: CreationProgress | null`, calculado uma vez com o `check` do store (§3.2).

**A medida antes de decidir o adiamento** (pergunta técnica 1, ⚙): se 10 cartões em criação passarem de ~100 ms no iPhone SE (o simulador sem carga; o AVD sob carga não é evidência), o cálculo da conta vai para depois do primeiro desenho (`InteractionManager.runAfterInteractions`), com a linha do progresso reservada (um `Skeleton` de uma linha, com a mesma altura) para o cartão não pular.

### 3.2 R-15 · O texto do progresso: `creationProgress`

Arquivo novo e puro, `apps/frontend/sheet/creation/progress.ts`, ao lado do `guide.ts`. Ele lê o mesmo `CreationCheck` do guia e usa as mesmas frases:

```ts
export type ProgressKind = 'done' | 'missing' | 'blocking' | 'freebies' | 'closed'

export interface ProgressPart {
  readonly key: string      // o id do orçamento, ou 'freebies', 'fields', 'closed'
  readonly kind: ProgressKind
  readonly text: string     // o que aparece: "Atributos ✓", "Habilidades: faltam 4"
  readonly spoken: string   // o que o leitor de tela lê: "Atributos completos"
}

export interface CreationProgress {
  readonly closed: boolean            // check.complete
  readonly parts: readonly ProgressPart[]
}

export function creationProgress(
  model: SheetModel,
  check: CreationCheck | null
): CreationProgress | null

// As partes que cabem em `lines` linhas (2 no cartão), sem cortar texto
export function fitProgress(
  progress: CreationProgress,
  width: number,
  fontScale: number,
  lines?: number
): { readonly shown: readonly ProgressPart[]; readonly text: string }

// Tudo, para o nome acessível do cartão
export const progressSpoken = (p: CreationProgress): string
```

**Regras, por orçamento, na ordem do template** (`check.budgets`, que segue `template.creation.budgets`). Rascunho do time, para revisão:

| Situação do orçamento | `kind` | Texto | Lido | De onde vem |
|---|---|---|---|---|
| Algum grupo sem prioridade (`CREATION_PRIORITIES_REQUIRED`) | `missing` (`blocking` com pontos já postos) | "Atributos (prioridade)" | "Atributos: falta escolher a prioridade" | o mesmo `short` do `guideItems` (`guide.ts:166`) |
| Point-buy acima (`CREATION_POINTBUY_EXCEEDED`) | `blocking` | "Atributos: 2 acima" | o mesmo | o `short` do guia (`guide.ts:203`) |
| Pontos básicos sobrando: Σ `group.missing` > 0 | `missing` | "Habilidades: faltam 4" ("falta 1") | "Habilidades: faltam 4" | o `CreationGroup.missing` dos grupos do orçamento, o mesmo número do `CREATION_BASICS_UNSPENT` e do `CREATION_POINTBUY_UNSPENT`, com a concordância do `problemText` (`creation.ts:303-312`) |
| Nada falta e nenhum problema do orçamento | `done` | "Atributos ✓" | "Atributos completos" | — |

**Depois dos orçamentos:**

- **problemas de campo** (`OUT_OF_RANGE`, `HARD_CAP`, `LOCKED`, `NOT_PURCHASABLE`, `BELOW_INITIAL`): uma parte só, "1 traço para corrigir" / "2 traços para corrigir" (`blocking` se algum for), rascunho do time. As frases de cada um estão na aba "Pontos";
- **o bônus:** `freebiesBalance(check)` (`creation.ts:1102-1108`), o mesmo texto da barra do jogador: "Bônus: restam 2 de 15" ou "Bônus: 3 acima do saldo";
- **conta fechada** (`check.complete`): uma parte "A conta fechou", seguida do bônus só se sobrou ("A conta fechou · Bônus: restam 2 de 15"). É a raiz do `CLOSED_COPY` do P05-D (`nextStep.ts:60-62`) e do "A conta fechou" que o N-A procurou no cartão (`narrador-app.md:195`);
- **criação livre, sem `creation` no template ou `check` nulo:** `null`, e o cartão fica sem a linha.

**Exemplos** (dos três templates do produto, `design/templates/*.json`):

| Sistema e estado | Texto completo |
|---|---|
| V20, recém-criada | "Atributos (prioridade) · Habilidades (prioridade) · Disciplinas: faltam 3 · Antecedentes: faltam 5 · Virtudes: faltam 7 · Bônus: restam 15 de 15" |
| V20, a meio caminho | "Atributos ✓ · Habilidades: faltam 4 · Disciplinas ✓ · Antecedentes ✓ · Virtudes ✓ · Bônus: restam 2 de 15" |
| M20, Esferas faltando | "Atributos ✓ · Habilidades ✓ · Antecedentes ✓ · Esferas: faltam 2 · Bônus: restam 15 de 15" |
| W20, Dons faltando (`item-count`) | "Atributos ✓ · Habilidades ✓ · Antecedentes ✓ · Dons: faltam 2 · Bônus: restam 9 de 15" |
| Conta fechada, sem sobra | "A conta fechou" |

**Caber em duas linhas sem cortar** (`fitProgress`). O texto de um cartão nunca é cortado com reticências (a regra do P05-D). A conta de largura é a do `fitGuide` (`guide.ts:236-279`: `caption` de 13 × `fontScale`, 0,6 em por caractere), vezes o número de linhas, com 10% de folga para a quebra entre palavras. A largura é a do cartão menos o recuo (`useLayout().width` e a coluna da grade), sem `onLayout`, por causa do A3 da onda 4 (no RN-web, o `onLayout` só dispara com mudança de tamanho). Quando o texto não cabe, nesta ordem:

1. **as partes `done` viram uma só, no começo:** "✓ 3 de 5" (lido "3 de 5 orçamentos completos"). Ex.: "✓ 3 de 5 · Habilidades: faltam 4 · Disciplinas: faltam 3 · Bônus: restam 15 de 15";
2. **se ainda não cabe, os `missing` e `blocking` que sobram viram "e mais N"** (o `moreText` do guia), mantendo o bônus no fim.

A 390 (358 úteis no cartão de coluna única), duas linhas levam ~82 caracteres; a 360, ~76. O V20 a meio caminho (~105 caracteres) vira "✓ 4 de 5 · Habilidades: faltam 4 · Bônus: restam 2 de 15". O nome acessível tem sempre o texto inteiro (§3.3).

**O que fica igual para o jogador e o narrador:**

- a conta é a mesma (`checkCreation` com a mesma entrada que o `GET /characters/:id` dá ao `SheetScreen`, `SheetScreen.tsx:441-451`);
- o bônus é a mesma frase da barra do jogador (`useFreebiesText`, `CreationPanel.tsx:72-74`);
- o "(prioridade)" e o "acima" são os `short` do guia;
- o detalhe por grupo ("Talentos: faltam 4 pontos básicos.") é a `GuideList` da aba "Pontos", que o narrador abre em Leitura.

O que é só do cartão: a soma por orçamento, o "✓" e o "traço para corrigir" (§2, item 1).

### 3.3 R-15 · O progresso no cartão da Mesa

**Onde fica** (`TableRow.tsx`): uma linha nova, na largura inteira do cartão, **entre a linha de cima e o dock**, com `testID="table-progress-<id>"`. Na largura inteira, e não na coluna de texto (306 dp a 390, por causa do avatar), ela leva ~17% a mais por linha.

```
┌──────────────────────────────────────────────┐
│ (av) Isadora Web                             │
│      Tremere  [Em criação · por pontos]      │
│      roteiro_jogador1 · alterada às 13:15    │
│ ✓ 4 de 5 · Habilidades: faltam 4 ·           │
│ Bônus: restam 2 de 15                        │
│ [Vitalidade ····] [Sangue 10/10] [FdV 5/5]   │
└──────────────────────────────────────────────┘
```

- **Texto, não só cor nem ícone.** `caption`, cor `inkMuted`; o que impede salvar (`blocking`) em `danger`, e o texto já diz "acima" ou "para corrigir". O "✓" sempre ao lado do nome do orçamento.
- **O nome acessível do cartão** (`:71-89`) ganha o `progressSpoken` depois do estado e antes dos alertas: "Isadora Web, Tremere. Em criação · por pontos. Atributos completos, Habilidades: faltam 4, … Bônus: restam 2 de 15. …". Começa pelo que está escrito no cartão, como hoje (WCAG 2.5.3). Na seleção, o nome continua "Selecionar <nome>" (`:95`), como o P09-C fez.
- **NPC:** nunca tem a linha. Ele nasce em criação livre (§3.0), e a API manda `creationInput: null`.
- **Ficha em `pending`:** "A conta fechou", porque ela só chega lá com a conta fechada (o servidor recusa enviar sem isso). Se a ficha voltou a ter problema (o narrador mudou as "Regras da casa" depois), o cartão mostra o que falta, a mesma conta que o "Aprovar" vai recusar.
- **Ficha concluída, em jogo, arquivada:** sem linha (sem conta).

**A altura, medida como na onda 3** (o cartão com o progresso e todos os selos juntos). Pelos tokens (`caption` 13/18, `gap` do cartão `space[2]` = 8):

| Cartão, a 390 | Hoje | Com o P09-D (estimado) |
|---|---|---|
| PC em jogo (sem linha) | 157 ([onda-3.md](onda-3.md) §11) | 157: sem mudança |
| PC em criação: chip, estado, meta, 1 linha de progresso | 157 | ~183 |
| PC em criação: o mesmo, com 2 linhas de progresso | — | ~201 |
| Pior caso a 360: chip, "Aguardando ajuste" e um alerta quebrando em duas linhas de selos, 2 linhas de progresso | — | ~223 |

**Proposta de limite** (o E2E da §4.3 confere e anota): o cartão sem progresso continua abaixo de 170 (o teste de hoje, `e2e/tests/narrator.spec.ts:168-169`); o cartão em criação com progresso fica **abaixo de 210** a 390 e a 360. Na fase de criação, o progresso é o que o narrador vai buscar, e 4 cartões por tela a 390 × 844 ainda é o dobro do que ele via com os 255 px do QAW-31. O pior caso é anotado, não limitado. Se a medida passar de 210, a integração escolhe entre a linha de uma só (`lines: 1` no `fitProgress`) e um limite novo, e registra no §10.

**Na grade** (750 e 1280, 2 e 3 colunas, `TableView.tsx:58-73`): a largura é a da célula (`1 / colunas` do conteúdo, menos o recuo). A 1280, com 3 colunas de ~389, o texto do V20 a meio caminho cabe em duas linhas sem juntar os "✓".

### 3.4 R-15 · Filtro "Em criação" e "Pendentes"

**Quem cai em qual** (`stageOf`, função pura nova em `tableItems.ts`, pelo `characterState` que o cartão já tem):

| Estado do cartão (`TableItem.state.id`) | Etapa | Por quê |
|---|---|---|
| `creating`, `returned` ("Devolvida"), `adjust` ("Aguardando ajuste") | **Em criação** | A vez é do jogador |
| `ready` ("Avisou que terminou"), `pending` ("Aguardando aprovação") | **Pendentes** | A vez é do narrador: concluir, aprovar, devolver ou pedir ajuste |
| NPC (qualquer estado), em jogo, travada, arquivada | nenhuma | O NPC é do narrador e fica fora dos dois filtros e das contagens, oculto ou não |

**Na tela** (`TableView.tsx:264-282`):

- dois chips novos na linha dos filtros, depois de "Só com alerta": **"Em criação (N)"** e **"Pendentes (N)"**. Um exclui o outro; tocar o ativo desliga. Eles combinam com "Só com alerta" e com a ordem;
- os chips aparecem só no escopo "Em jogo" e só quando a contagem é maior que zero, ou quando o filtro está ligado. Trocar para "Arquivadas e fora de jogo" desliga o filtro (como a seleção, `:259-262`);
- a contagem é de todos os PCs do escopo, não só dos que aparecem com "Só com alerta";
- **qual está ativo:** o `Chip` já é `aria-pressed` no web e "selecionado" no app (`packages/ui/src/Chip.tsx:29-36`). Com um filtro ligado, uma linha de estado abaixo dos chips, `caption`, `aria-live="polite"`, `testID="table-filter-status"`: "Mostrando 3 de 8: em criação." / "Mostrando 1 de 8: pendentes.";
- **vazio:** "Nenhuma ficha em criação." / "Nenhuma ficha pendente." (`:314-321`). O vazio da Mesa sem ficha ganha o que o NA-11 pediu: "Nenhuma ficha na crônica ainda. As fichas aparecem aqui com a etapa da criação e o que falta." (rascunho do time);
- **a seção de NPCs** (`:329-341`) some com um filtro de etapa ligado: nenhum NPC entra.

**A seleção da Mesa** (P09-C, T-49) não muda: o `sync` recebe todos os itens da Mesa (`TableView.tsx:214-216`), e uma ficha marcada que o filtro esconde continua marcada, como já acontece com "Só com alerta". A folha da operação lista os alvos antes de confirmar. Se o PO preferir que o filtro tire da seleção o que esconde, é a pergunta técnica 4.

**A ordem** continua "Nome" ou "Última alteração". Ordenar pelo progresso fica fora (não está na D-10).

### 3.5 R-15 · A contagem na lista de crônicas

**API** (`routes.ts:289-421`, o `GET /chronicles`): uma subconsulta nova, `creatingCount`, ao lado do `pendingReview` (`:358-383`), com as mesmas regras de quem recebe:

```sql
-- só o narrador da crônica recebe a conta (c.storyteller_id = me)
count(*) where ch.chronicle_id = c.id
  and ch.deleted_at is null
  and ch.kind = 'pc'                 -- NPC fora, oculto ou não
  and ch.user_id <> me               -- a ficha do próprio narrador, depois de uma transferência, não conta
  and ch.status = 'creating'
  and jsonb_typeof(ch.creation -> 'ready' -> 'at') is distinct from 'string'  -- o "terminei" já está no pendingReview
```

- Escrita no Kysely, como o `pendingReview`, sem SQL concatenado com input: o único valor é o `me`, parametrizado.
- O índice que atende o `characterCount` e o `pendingReview` atende esta (o `chronicle_id` das fichas).
- Para o jogador, o ex-membro e o membro que só vê NPC revelado (`viewer` na ficha do NPC, `apps/api/src/authz.ts:103-109`): `0`, porque a subconsulta tem `c.storyteller_id = me`, como a do `pendingReview` (`:382`).

**App** (`app/(app)/index.tsx:26-55`): a meta da linha ganha "2 fichas em criação" ("1 ficha em criação") antes do "aguarda revisão":

> Você narra · 6 personagens · 2 fichas em criação · 1 ficha aguarda revisão · Última sessão: 01/11

A lista já rebusca no foco e no puxar (T-40), e concluir, aprovar e devolver invalidam a lista (`lib/queries/creation.ts`, P09-C §3.4). Falta acrescentar a mesma invalidação ao **"Pedir ajuste"** e ao **"Avisar que terminei"** (P04-D), que movem a ficha entre as duas contagens: conferir no `useRefresh` e acrescentar onde faltar.

### 3.6 R-15 · A aba "Pontos" em Leitura para o narrador, também em `pending`

**O que muda:**

| Onde | Hoje | Depois |
|---|---|---|
| `CreationPanel.tsx:64-69` | `useCreating()`: conta ativa e `creating` | fica igual; entra `useCreationReview()`: conta ativa, `pending` e `info` |
| `SheetView.tsx:222-224` | `budget = budgetEdit \|\| (editable && mode === 'read' && creating && narrator)` | `… && (creating \|\| reviewing) && narrator`. O `openBudget` (`:290-293`) passa a existir em `pending` para o narrador, porque depende do `budget` |
| `CreationPanel.tsx:197-203` | o painel some fora de `creating` | aparece também em `pending`, só em Leitura e só para o narrador |
| `CreationPanel.tsx:246-252` (conta fechada) | "A conta fechou: conclua a criação pela barra de cima." | em `pending`: "A conta fechou. Confira a ficha e aprove ou devolva pelo aviso no topo." (rascunho do time) |
| `guide.ts:312-319` (avisos "confirme com o narrador") | só em `creating` | também em `pending` para o narrador: é na revisão que ele confirma o Dom acima do Posto 1 ou a Disciplina fora do clã |
| `CreationPanel.tsx:561-570` (aviso "Aguardando aprovação") | "Confira a conta e a ficha antes de aprovar…", sem caminho para a conta (POA-20) | o aviso do narrador ganha "Ver Pontos" (`Button` secundário, `testID="creation-pending-points"`), pelo `useOpenBudget()` (`CreationContext.tsx:33-36`), ao lado de "Aprovar ficha" e "Devolver para correção" |

**O que não muda:**

- **nada edita.** O narrador continua em Leitura. A fase continua só texto (a troca manual é só da Criação desde o A1 da onda 4), as "Regras da casa" continuam só na Criação (`CreationPanel.tsx:254`), e nenhuma `GuideList` grava. Os itens levam ao grupo como em `creating` (P05-D §3.2);
- **o dono em `pending`** continua sem a aba: a D-10 fala do narrador (ponto 4 para o PO, §9);
- **a aprovação** continua revalidando a ficha de agora no servidor (`sheets/creation.ts:755-765`). A aba é para o narrador conferir, não para decidir.

### 3.7 T-36 · O painel "Criação de fichas" recolhido e as abas no topo

**Proposta (A): o painel fica onde está, recolhido.** O `CreationSettings` ganha o estado `open`:

| Situação | O que aparece |
|---|---|
| `creation.revision > 0` (as regras já foram salvas), sem editar | **Recolhido:** o título "Criação de fichas" com "Editar" à direita (`SectionHeader` com `right`), e abaixo o `summaryLine(chronicleCreationSummary(model, creation))`, em `caption`, `testID="creation-settings-summary"` |
| `creation.revision === 0` (crônica nova, nunca salvou) | **Aberto**, como hoje, com "Salvar regras da criação" **habilitado mesmo sem mudança**: salvar o padrão do sistema é a primeira configuração, e o painel recolhe |
| Depois de "Editar" | Aberto, com "Cancelar" (`ghost`) ao lado de "Salvar regras da criação". "Cancelar" descarta (o `reset`, `:76-79`) e recolhe |
| Depois de salvar com sucesso | Recolhe, com o aviso "Regras da criação salvas." de hoje |
| Erro ao salvar (409 de revisão, rede) | Continua aberto, com o erro (`:234-238`) |
| Sem o template do sistema (carregando, falhou, mais novo que o app) | Recolhido, o lugar do resumo diz o mesmo de hoje: "Carregando as regras do sistema…", o `unsupportedShort` ou o erro com "Tentar de novo". Nunca "criação livre" sem as regras (L-01) |

- **O resumo é a linha que o jogador lê** sob "Suas fichas" (T-29, `CharacterList.tsx:170-186`). Narrador e jogador leem o mesmo texto (§2, item 2).
- **"Editar"** é um `Button` secundário com o texto visível "Editar" e o nome "Editar regras da criação" (começa pelo texto visível), `testID="creation-settings-edit"`. Ao abrir, o foco vai para o primeiro controle ("Aprovação do narrador"). Ao recolher (salvar ou "Cancelar"), o foco volta ao "Editar", como a confirmação de "Revogar" do P12 devolve ao gatilho.
- **O `UnsavedChangesGuard`** (`:99-103`) continua: sair da crônica com o painel aberto e mudado pergunta antes. Recolher só por "Cancelar" ou por salvar.
- **O `testID="creation-settings"`** continua no contêiner, aberto ou recolhido. Os de dentro (`creation-settings-budgets`, `-layout`, `-save`, `-<orçamento>`) só existem aberto.
- **A crônica de criação livre** e o sistema sem `creation` no template recolhem igual: o `summaryLine` diz "Criação livre · o narrador conclui", sem a aprovação (ela só vale na criação por pontos, `summary.ts:28-30`), e "Editar" abre o painel com a aprovação, como hoje (`:154-158`).

**As abas.** Com o painel recolhido, a ordem da tela não muda (`[id]/index.tsx:210-261`), e as abas sobem sozinhas. Estimativa a 390: `AppBar` ~56, a linha do sistema e do papel ~76, o resumo recolhido ~140 (título com botão de 44, 3 linhas de `caption` e o recuo): as abas em y ≈ 270, contra ≈ 1.295 do NW-10. O "1 ficha aguarda sua revisão" (aba Fichas) fica em y ≈ 380, acima da dobra a 844. A 1280, o resumo é uma linha, e as abas ficam em y ≈ 210.

**Alternativa (B): o painel dentro da aba Fichas**, sob o título "Fichas", no lugar onde o jogador lê a mesma linha. As abas ficariam logo abaixo da linha do papel em qualquer caso, e a Mesa e os Bastidores não teriam regra nenhuma. O custo:

- o `index.tsx` passa a montar o painel no `SheetsPanel` (`:354-450`), que o P12 também mexe (T-82, `:406-411`);
- o rascunho do painel morre ao trocar de aba (o `TabPanel` desmonta), e o `UnsavedChangesGuard` só segura a saída da tela, não a troca de aba. O rascunho teria de subir para um provider na tela, como a seleção da Mesa (`TableSelectionProvider`, P09-C §3.6): M em vez de P.

A proposta é a A, pelo custo e por não mexer no `index.tsx`; a B fica para o PO (ponto 3, §9).

**A primeira gravação sem mudança.** Com `revision === 0`, o "Salvar" manda o mesmo corpo de hoje (`:250-262`), e a auditoria escreve "Regras da criação: aprovação Desligada; orçamento padrão alterado" (`auditPhrase.ts:57-72`), porque o `defaults` vai sempre no corpo. O "orçamento padrão alterado" sem mudança já acontece hoje quando só a aprovação muda. Mandar o `defaults` só quando ele mudou corrige as duas frases sem mudar a API (o campo já é opcional, `sheets/creation.ts:458-463`): é a pergunta técnica 5.

### 3.8 T-36 · O nome "Orçamento" (onda-4.md §6, ponto 15)

O ponto continua aberto, e este plano **não renomeia**. O que o PO precisa saber para decidir:

- o resumo recolhido não usa a palavra, então o nome só aparece com o painel aberto;
- a palavra está em três lugares das regras da crônica: o título do bloco (`CreationSettings.tsx:189`), o texto da criação livre ("não há orçamento por pontos para configurar", `:156`) e a frase da auditoria ("orçamento padrão alterado", `auditPhrase.ts:67`);
- a D-10 chama de "Orçamento" a conta dentro da ficha, que é a aba "Pontos" desde o P05-D. O "Orçamento em leitura para o narrador" da D-10 é a §3.6;
- se o PO escolher "Pontos" (ou outro nome), a troca é um commit P: as três frases, o `CreationSettings.test.tsx` (`:19`, "Orçamento" lado a lado) e nenhum seletor E2E (nenhum spec usa "Orçamento" das regras da crônica). O título do painel, "Criação de fichas", não muda.

### 3.9 O que muda na API pública

| Contrato | Mudança | Compatibilidade |
|---|---|---|
| `GET /chronicles/:id/table` | Cada linha ganha `creationInput: { choices: CreationChoices; config: CreationConfigLayer } \| null` (§3.1). `null` em NPC, criação livre e fora de `creating`/`pending`. Nunca leva motivo de devolução ou de ajuste | Campo novo; o app antigo o ignora. AuthZ igual: só o narrador da crônica; os outros recebem 404 (`table.ts:64-65`). Sem migration |
| `GET /chronicles` | Cada crônica ganha `creatingCount: number` (§3.5): PCs de outras pessoas em `creating`, sem "terminei". `0` para quem não narra | Campo novo; o app antigo o ignora |
| `@tms/sheet-core` | nenhuma: o `dist` não precisa ser reconstruído | — |
| `@tms/ui` | nenhuma: `Chip`, `StateBadge`, `SectionHeader`, `Button`, `Banner` e `Skeleton` como estão. Não há build nativo novo por causa deste pacote | — |
| Templates e `schema.json` | nenhuma: sem versão nova, sem `templates:publish` | — |
| Internos do app | `TableRowData.creationInput`, `TableItem.progress`, `stageOf`/`stageCounts` e o `stage` no `arrange` (`tableItems.ts`); `progress.ts` (novo); `useCreationReview` (`CreationPanel.tsx`); o estado `open` do `CreationSettings` | — |

O `design/design-system/components.md` (cartão da Mesa, l.739) passa a descrever a linha do progresso, o filtro de etapa e o limite de altura.

## 4. Testes

### 4.1 Um teste de regressão por item (falha no `05c5d7d`, passa depois)

Os casos de conta rodam nos três sistemas (V20, M20, W20), pelos templates do produto, como a lição A2 da onda 4 pede: nenhum commit testa só o Vampiro.

| Item | O que o teste prova | Arquivo | Tipo |
|---|---|---|---|
| R-15 | A Mesa manda `creationInput` só no PC em `creating` ou `pending` por pontos, com `choices` e `config`, e `null` no NPC (oculto e revelado), na criação livre e em jogo. A resposta não tem `reason` em lugar nenhum, nem depois de devolver e de pedir ajuste. Escolha fora do formato gravada direto no banco sai como ausente | `apps/api/src/__tests__/table.test.ts` | Bun, PGLite |
| R-15 | `creatingCount`: conta o PC do jogador em `creating`; não conta o NPC oculto nem o revelado, o PC do próprio narrador, a ficha com "terminei" (que está no `pendingReview`), a ficha excluída nem a de outra crônica; é `0` para a dona, o outro jogador, o ex-membro e o narrador de outra crônica | `apps/api/src/__tests__/creation.test.ts` (junto dos testes do `pendingReview`, `:1615-1707`) | Bun, PGLite |
| R-15 | **AuthZ, nos três sistemas** (§4.4): na matriz, a resposta da Mesa e da lista para cada ator não traz o `creationInput` da dona nem conta o NPC oculto | `apps/api/src/__tests__/authz.test.ts` | Bun, PGLite |
| R-15 | `creationProgress`: os exemplos da §3.2 nos três templates; o "(prioridade)" e o "acima" iguais ao `short` do `guideItems` na mesma ficha; "falta 1" no singular; o bônus igual ao `freebiesBalance`; conta fechada com e sem sobra; criação livre e `check` nulo dão `null` | `apps/frontend/sheet/creation/__tests__/progress.test.ts` (novo) | Jest |
| R-15 | `fitProgress` a 328, 358 e 389 dp e com `fontScale` 1 e 1,3: junta os "✓", depois "e mais N"; nunca corta uma parte; o bônus fica no fim | o mesmo | Jest |
| R-15 | O cartão em criação por pontos tem a linha `table-progress-<id>` com o texto; o nome acessível tem o progresso inteiro; o NPC e a ficha sem `creationInput` não têm a linha; a ficha com escolha inválida não quebra o cartão | `apps/frontend/app/__tests__/table.test.tsx` | Jest + RNTL |
| R-15 | O filtro: "Em criação (2)" e "Pendentes (1)" com a etapa certa para cada estado da tabela da §3.4; o NPC fora; um exclui o outro; "Só com alerta" combina; trocar de escopo desliga; a linha "Mostrando 2 de 5: em criação." aparece; os vazios novos | `apps/frontend/app/__tests__/table.test.tsx` e `components/chronicles/__tests__/tableItems.test.tsx` (novo; o `testMatch` de `components/` só aceita `.test.tsx`, `jest.config.js:24`) | Jest + RNTL |
| R-15 | A lista de crônicas diz "2 fichas em criação · 1 ficha aguarda revisão" ao narrador e nada disso ao jogador | `apps/frontend/app/__tests__/chronicles.test.tsx` | Jest + RNTL |
| R-15 | O narrador em Leitura numa ficha em `pending`: a aba "Pontos" existe, mostra o bônus e "A conta fechou. Confira a ficha…", sem "Regras da casa", sem a troca de fase e sem nenhum lote; "Ver Pontos" do aviso seleciona a aba; o dono em `pending` não tem a aba | `apps/frontend/sheet/__tests__/storyteller.test.tsx` | Jest + RNTL |
| R-15 | Os avisos "Para confirmar com o narrador" aparecem em `pending` para o narrador | `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` ou `advantages.test.tsx` | Jest + RNTL |
| T-36 | Com `revision > 0`, o painel abre recolhido: o título, o `summaryLine` e "Editar"; sem os rádios. "Editar" abre e põe o foco na aprovação; "Cancelar" descarta e recolhe; salvar recolhe e devolve o foco ao "Editar"; o 409 mantém aberto | `apps/frontend/components/chronicles/__tests__/CreationSettings.test.tsx` | Jest + RNTL |
| T-36 | Com `revision === 0`, o painel abre aberto, e "Salvar regras da criação" fica habilitado sem mudança | o mesmo | Jest + RNTL |
| T-36 | Sem o template (carregando, falhou, mais novo), o recolhido nunca diz "criação livre" | o mesmo | Jest + RNTL |

### 4.2 Testes existentes que mudam junto

| Arquivo | O que muda |
|---|---|
| `components/chronicles/__tests__/CreationSettings.test.tsx` | O `renderPanel` monta com `revision: 3` (`:47-51`): todos os casos que mexem nos rádios ou nos Stepper (`:70-232`) passam a tocar "Editar" antes, por um ajudante `openPanel()`. O caso "sem mudança, não segura a saída" (`:149`) continua |
| `components/chronicles/__tests__/chronicles.a11y.test.tsx` | `:52` e `:79-82` esperam o painel aberto ("Aprovação do narrador" e "Modo padrão" na tela): abrem pelo "Editar", e um caso novo confere o nome "Editar regras da criação" e o resumo como texto |
| `components/chronicles/__tests__/chronicles.layout.test.tsx` | Conferir: se medir o painel aberto, abre antes |
| `app/__tests__/table.test.tsx`, `table-alerts.test.tsx`, `table-operations.test.tsx` | As linhas de hoje não têm `creationInput`: o cartão continua igual, e nenhum nome acessível exato muda. Conferir com a suíte |
| `app/__tests__/chronicles.test.tsx` | As linhas da lista ganham `creatingCount: 0` onde o tipo pedir |
| `sheet/__tests__/storyteller.test.tsx` | Os casos da aba "Pontos" em Leitura (`creating`) continuam; entram os de `pending` |

### 4.3 E2E (Chromium e WebKit)

**Os specs que abrem a crônica como narrador**, pelo `grep -rn "name: 'Mesa'\|name: 'Bastidores'\|creation-settings\|Salvar regras da criação" e2e/tests e2e/support`:

| Spec | Linha | Como abre a crônica | Muda? |
|---|---|---|---|
| `template-unsupported.spec.ts` | `:54-84` | crônica pela API, sem salvar as regras (`revision === 0`) | **Não:** o painel abre aberto, e o `creation-settings`, o "Ligada" e o "Salvar" continuam. Conferir que o "Salvar" segue desabilitado sem o template (L-01), apesar da regra nova de `revision === 0` |
| `journey.spec.ts`, `journey-mage.spec.ts`, `journey-werewolf.spec.ts`, `journey-storyteller.spec.ts` | `:56`, `:55`, `:56`, `:98` ("Convidar"); `:213`, `:178`, `:244`, `:154` (Mesa) | crônica pela tela (`revision === 0`, aberto) e o `freeCreation` pela API, sem recarregar | **Não:** a tela continua com o painel aberto até rebuscar, como hoje. O "Convidar" e a aba Mesa são achados pelo papel |
| `narrator.spec.ts` | `:163`, `:198`, `:208`, `:256-258`, `:300`, `:336`, `:353` | o ajudante `table()` grava as regras pela API (`support/users.ts:57-74`) | **Não** nos seletores: o painel recolhe, e as abas ficam mais perto. O limite de 170 (`:168-169`) é de ficha em criação livre, sem a linha nova |
| `creation-state.spec.ts` | `:185` (regras pela API), `:204`, `:262`, `:265` | idem | **Não:** o `ready-review` e a aba Mesa continuam. O cartão ganha a linha de progresso; o `toContainText` do estado continua valendo |
| `table.spec.ts`, `a11y-keyboard.spec.ts`, `journey-backstage.spec.ts`, `npc-backstage.spec.ts`, `chronicles.spec.ts`, `layout.spec.ts` | `:63`; `:173`; `:365-367`; `:139`, `:152`, `:288`, `:360`; `:126`; `:255-265` | crônicas pela API, com ou sem regras salvas | **Não:** nenhum usa os controles do painel. O `layout.spec.ts:255-265` mede "Participantes" e "Convidar" a 390, que só sobem |
| `save-finish.spec.ts`, `lifecycle.spec.ts`, `support/users.ts` | `:120`; `:173`; `:66` | regras pela API | Não |

**Quem ajusta e em que ordem:** o P09-D roda todos esses specs no commit do painel (§8.1, commit 8) e corrige o que quebrar no mesmo commit. A expectativa é nenhum seletor mudar. Os journeys mudam no P12 (convite por link, D-14), por cima, sem tocar o painel. O P14-D, se puser a Descrição acima das abas, mede de novo a posição das abas do spec novo abaixo (§8.4).

**Spec novo: `e2e/tests/table-creation.spec.ts`.** Contas por `signUp`; crônica por pontos pelo `pointsChronicle` (`e2e/support/creation.ts:16`), fichas por `newCharacter` e `prepared` (`:41`, `:94`), o envio para aprovação, o "Pedir ajuste" e o NPC pela API, só dados fictícios:

| Caso | Viewport | O que confere |
|---|---|---|
| Painel recolhido e abas no topo | 390 × 844 e 1280 × 800 | `getByTestId('creation-settings-summary')` com o mesmo texto do `creation-summary` da J1 na mesma crônica (o jogador lê a mesma linha); `getByRole('tablist', { name: 'Visão da crônica' })` com o topo abaixo de 340 a 390 e de 260 a 1280 (proposta; anotar a medida); a 1280, o resumo numa linha (altura ≤ 24) |
| Editar, Cancelar, Salvar | 390 | `getByRole('button', { name: 'Editar regras da criação' })` → os rádios aparecem e o `document.activeElement` está no grupo "Aprovação do narrador"; "Cancelar" recolhe e o foco volta ao "Editar"; mudar o bônus e salvar recolhe, o aviso aparece e o resumo diz o bônus novo |
| Crônica nova | 390 | Pela tela (`revision === 0`): o painel aberto; "Salvar regras da criação" habilitado sem mudança; salvar recolhe |
| Progresso no cartão, V20 | 390 e 360 | Quatro PCs da J1: recém-criada ("(prioridade)"), quase pronta (o `ALMOST`, "Bônus: restam 15 de 15"), em ajuste ("Aguardando ajuste" e o progresso) e enviada ("Aguardando aprovação" e "A conta fechou"). O texto exato de `getByTestId('table-progress-<id>')` em cada um. O nome acessível do cartão (`toHaveAccessibleName`, no DOM) contém o progresso. O NPC oculto sem `table-progress-*` |
| Progresso, M20 e W20 | 390 | Uma ficha recém-criada em cada: "Esferas: faltam …" e "Dons: faltam …" |
| Altura com todos os selos | 390 e 360 | O cartão em criação com chip, estado e progresso **abaixo de 210**; o cartão em jogo continua **abaixo de 170**; o pior caso (estado, alerta e duas linhas de progresso) anotado, sem limite. Nenhum filho do cartão passa da largura (`boundingBox`) |
| Filtro | 390 | `getByRole('button', { name: 'Em criação (3)', exact: true })` com `aria-pressed="false"` → toque → `aria-pressed="true"`, só os três cartões, `getByTestId('table-filter-status')` com "Mostrando 3 de 5: em criação." e `aria-live="polite"`; "Pendentes (1)" troca; a seção "NPCs" some |
| Lista de crônicas | 390 | O N vê "2 fichas em criação" e "1 ficha aguarda revisão" na linha da crônica; a J1 não vê nenhum dos dois |
| `pending` em Leitura | 390 | O N abre a ficha enviada: "Ver Pontos" no aviso seleciona `getByRole('tab', { name: 'Pontos', exact: true })` (`aria-selected="true"`); `getByTestId('creation-freebies')` à vista; "Regras da casa" e `creation-phase-switch` ausentes; nenhum `POST /characters/:id/events`. "Aprovar ficha" depois disso continua o fluxo de hoje |
| Grade com progresso | 1280 × 800 | 3 colunas (`table-cell-*`), cada cartão com a linha de progresso dentro da célula |
| 10 fichas | 390 | Dez PCs em criação por pontos: todos os cartões com a linha; anotar o tempo do `goto` da Mesa até o décimo cartão à vista (indicativo, não limite) |

O que o Jest não pega no web e o E2E confere no DOM: o `aria-pressed` dos chips, o `aria-live` da linha do filtro, o nome acessível do cartão com o progresso, o foco depois de "Editar" e de "Cancelar", a posição real das abas e a altura do cartão. A medida é no cartão (`table-row-<id>`), não na célula da grade.

### 4.4 Suítes do "PR local" e cobertura

```bash
npx pnpm turbo run typecheck lint --filter=frontend --filter=@tms/api --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=frontend --filter=@tms/api
cd apps/api && bun test src/__tests__/table.test.ts src/__tests__/creation.test.ts src/__tests__/authz.test.ts
cd apps/frontend && npx jest --forceExit --listTests | grep -E "progress|tableItems|table|chronicles|CreationSettings|storyteller"
node scripts/check-system-names.mjs
```

- **Matriz de AuthZ** (`apps/api/src/test/authz-matrix.ts`, `__tests__/authz.test.ts`), nos três sistemas (`MATRIX_SYSTEMS`, `test/matrix-systems.ts:13`):
  - as linhas de status não mudam: a Mesa continua 200 só para o narrador e 404 para a dona, o outro jogador, o ex-membro e o narrador de outra crônica (`authz-matrix.ts:142-146`); o `GET /chronicles` não tem `:id` e fica no teste de conteúdo;
  - **o conteúdo entra no teste**, como o `SECRET` e o `HIDDEN_NPC` de hoje (`authz.test.ts:48-54`): a ficha da dona do cenário ganha uma escolha de prioridade e uma camada de bônus conhecidas; a resposta do narrador as traz; nenhuma outra resposta (200 ou 404) as traz; o `creatingCount` é 1 para o narrador e 0 para os outros;
  - **o NPC oculto** do cenário fica em `creating` (o padrão) e nunca entra no `creatingCount` nem tem `creationInput`;
  - **o `viewer`:** um NPC revelado (`visibility: 'identity'`) num cenário à parte, com o outro jogador como membro: o `creatingCount` dele é 0 e a Mesa continua 404.
- **Metas por arquivo:** API 85% de linhas e funções (`apps/api/bunfig.toml:5`): o `creationInputView` e a subconsulta nova têm os ramos cobertos. App: 80/80/70/80 em `./sheet/` (`apps/frontend/jest.config.js:42`), que inclui o `progress.ts` com teste próprio; 70/70/60/70 no resto.
- **O `check-system-names`** garante que `progress.ts` e `tableItems.ts` não citam sistema: os rótulos vêm do template.
- **Sem `@tms/sheet-core`, `@tms/db` e `@tms/ui` no diff:** as suítes deles não mudam, e não há `dist` a reconstruir. Sem `*.pg.test`: as mudanças da API são leituras.
- **O E2E inteiro** (Chromium e WebKit) roda na integração, um por vez (portas fixas).

## 5. Segurança

O pacote muda duas respostas da API (a Mesa e a lista de crônicas) e o que o narrador vê na ficha em `pending`. A matriz não exige o `/security-review` para o P09-D, e o brief o pede "se o progresso sair do servidor". Com a proposta da §3.1, o progresso é calculado no app, mas a resposta da Mesa passa a levar dados da criação: **recomendo o `/security-review` no diff dos commits 1 e 2 (API)**, além do `/code-review` do pacote inteiro.

| O que pode dar errado | Como o desenho evita |
|---|---|
| O progresso ou as escolhas de uma ficha chegam a quem não é o narrador (IDOR na Mesa) | A Mesa continua só do narrador da crônica, decidido no servidor pelo `chronicleAccess` (`table.ts:64-65`): o resto recebe 404, o mesmo de "sem vínculo". O teste de conteúdo da matriz (§4.4) prova nos três sistemas. O dono vê a própria conta pela ficha, como hoje |
| Um jogador vê a ficha, a conta ou a etapa de outro | Nenhuma rota nova de jogador. A lista de crônicas só conta para `c.storyteller_id = me`; o jogador recebe `0`. A aba Fichas do jogador continua só com as fichas dele (`CharacterList.tsx:224`, a API já filtra) |
| O motivo da devolução ou do ajuste vaza na Mesa | O `creationInputView` monta o objeto só com `choices` e `config`, por lista explícita (allowlist), não por remoção. O teste procura `reason` na resposta depois de devolver e de pedir ajuste |
| O NPC oculto aparece na contagem ou no filtro | `kind = 'pc'` na subconsulta e no `stageOf`. O NPC tem `creationInput: null`. O teste usa o NPC oculto do cenário da matriz, que fica em `creating` |
| Escolha ou camada adulterada no banco (ou na resposta) quebra o cartão ou mostra conta errada | O servidor manda só o que passa no `parseCharacterCreation` (`creation.ts:918-946`), e o app faz o mesmo parse de novo. O que não tem a forma vale como ausente. O efeito máximo é um texto de progresso errado; nenhuma permissão depende dele |
| O app mostra "A conta fechou" e o narrador aprova uma ficha que não fecha | A aprovação revalida a ficha de agora no servidor (`sheets/creation.ts:755-765`) e recusa com o código da conta. O progresso é só leitura |
| CPU no servidor por uma rota de leitura sem limite de taxa | É o motivo de a conta ficar no app (§3.1). O servidor só lê uma coluna que já lia (`table.ts:110`) e faz um parse por linha |
| SQLi na contagem | A subconsulta é do Kysely, com o `me` parametrizado e nenhum texto do usuário |
| Dado da criação no cache persistido do aparelho | A Mesa e a lista de crônicas não vão para o disco: só templates e fichas (`lib/persist.tsx:63-75`). O `creationInput` morre com a memória da tela, e o logout faz `clear()` (P09-C) |
| O painel recolhido esconde uma mudança não salva | Só recolhe por "Cancelar" (descarte explícito) ou salvar. Sair da tela com o painel aberto e mudado continua perguntando (T-56) |
| Texto da ficha no cartão ou no leitor de tela | O progresso usa só rótulos do template e números da conta, como o `problemText`. Tudo em `Text`: sem HTML, markdown, link ou `dangerouslySetInnerHTML` |
| PII em log ou Sentry | Nenhum log novo. O `scrubLog` da API (`apps/api/src/telemetry.ts`) só deixa passar campos da lista; o evento do web é remontado pela lista (`lib/telemetry.web.ts`). Nenhum dos campos novos entra nas listas |

**Checklist da organização:**

- **AuthZ no servidor:** a Mesa e a contagem são decididas na API; o app só esconde o que o servidor já não manda.
- **Menor privilégio:** a Mesa ganha só `choices` e `config`, que o narrador já lia pelo `GET /characters/:id`; nada do dono que ele não lesse.
- **Fail secure:** sem `creationInput`, sem linha de progresso; contagem ausente vale `0`; sem template, o resumo recolhido nunca diz "criação livre".
- **Validação de input:** o parse do core no servidor e no cliente; o `query.status` da Mesa continua validado (`table.ts:69-77`).
- **Erros sem stack:** as rotas não mudam o tratamento de erro (`http/on-error.ts`).
- **Dependências:** nenhuma nova.

## 6. Como generaliza além do WoD

- **O progresso é genérico.** Ele lê o `CreationCheck` do core, que é código, ids do template e rótulos dos orçamentos. Um sistema com prioridades por grupo (o modelo WoD) mostra "Atributos (prioridade)"; um D&D 5e com point-buy (`measure: 'cost'`) mostra "Atributos: faltam 3" ou "Atributos: 2 acima"; um orçamento por itens (os Dons do W20, `item-count`) mostra "Dons: faltam 2". Um sistema sem `creation` no template (Call of Cthulhu, Fate, PbtA) não tem conta e não mostra linha.
- **O bônus é do modelo de bônus** (`freebies` do template). Sem ele, a parte do bônus não aparece. O nome "pontos de bônus" continua do app (P05-C, pergunta 4).
- **O filtro e a contagem são genéricos:** usam os estados da ficha (D-02), que valem para qualquer sistema.
- **O resumo das regras** é o `summaryLine`, que já é genérico (rótulos e orçamentos do template).
- **O "✓"** é texto Unicode comum, sem fonte de ícone; o leitor de tela lê a palavra ("completos").
- **Skin:** o cartão usa as cores do tema e o accent da identidade, como hoje. Nada é de uma skin.

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado.** Arquivos e linhas conferidos no `05c5d7d` (§3). A D-10 aplicada, com o que não se aplica como está escrito na §2 e na §9.
2. **Typecheck, lint e testes** do frontend, da API e do `@tms/e2e` (§4.4).
3. **Um teste de regressão por item** (§4.1), falhando no `05c5d7d`, e o `test:coverage` verde.
4. **`/code-review`** no diff do pacote; **`/security-review`** nos commits da API (§5). Os achados vão no resumo.
5. **Os cenários das personas, repetidos sem o defeito.** Com a API local e o seed do roteiro (só contas fictícias; §11):

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | T-36 | N-W, NW-10 (`narrador-web.md:125`), web 390: abrir "Vampiro v4" | As abas sem rolar (y ≈ 270), o resumo "Criação por pontos · …" com "Editar"; o "Convidar" e o aviso de revisão na primeira tela da aba Fichas |
   | T-36 | N-A, NA-03 (`narrador-app.md:108`), iOS: ir à Mesa e depois ao "Convidar" | Sem rolar por cima do orçamento; a aba Mesa a um toque |
   | T-36 | PO-A, POA-19 (`po-app.md:64`, `:207`), iOS: crônica com ficha pendente | "1 ficha aguarda sua revisão" sem rolar |
   | T-36 | PO-W, POW-32 (`po-web.md:198`), web 1280 | O resumo numa linha e as abas logo abaixo |
   | R-15 | N-W, NW-20 (`narrador-web.md:157-180`, `:245`), web 390 e 1280: F2-1, acompanhar | A lista diz "N fichas em criação"; a Mesa diz o progresso de cada cartão; "Em criação (N)" mostra só elas; nada disso pede abrir a ficha nem entrar em Criação |
   | R-15 | N-A, NA-19 (`narrador-app.md:189-207`, `:250`), iOS: Tarefa 1 da fase 2 | "A conta fechou" no cartão do Bento e da Rasga-Bruma (o que ele procurou na Mesa); "Em criação" no lugar do "Só com alerta" vazio |
   | R-15 | PO-W, POW-11 (`po-web.md:177`, `:237`), web: ficha `pending` na Mesa | "Pendentes (1)" e o cartão com "Aguardando aprovação" e "A conta fechou" |
   | R-15 | PO-A, POA-20 (`po-app.md:65`, `:208`), iOS: abrir a ficha pendente como narrador | "Ver Pontos" no aviso; a aba "Pontos" em Leitura, com o bônus e o "O que falta" (ou "A conta fechou") |
   | R-15 | QA-W, QAW-31 (`qa-web.md:165`), web 390 e 1280 | O cartão com o progresso abaixo de 210 a 390; a grade de 3 colunas a 1280 com a linha em cada célula |

   **O critério de saída da onda** ("a fase 2 do Narrador, acompanhar, ajudar, devolver, concluir, repetida no app e no web"), na parte deste pacote. As tarefas são as das notas (`narrador-web.md:153-262`, `narrador-app.md:144-281`):

   | Tarefa da fase 2 | N-W (web 390 e 1280) repete | N-A (iOS; no roteiro, também Android) repete |
   |---|---|---|
   | Acompanhar (F2-1 / Tarefa 1) | Lista → "N fichas em criação" → crônica com as abas à vista → Mesa → progresso por cartão → "Em criação" | O mesmo, sem abrir ficha por ficha nem entrar no modo Criação (o SEQ 3 das duas notas) |
   | Ajudar (F2-2 / Tarefa 2) | O cartão diz o que falta → abre a ficha em Leitura → aba "Pontos" → toca o item → vai ao grupo; os avisos "confirme com o narrador" à vista | O mesmo no iOS; sem refazer a conta de cabeça (o "14 de 15" do Teodoro) |
   | Devolver (F2-3 / Tarefa 3) | "Pedir ajuste" (P04-D) → volta à Mesa → o cartão em "Aguardando ajuste" com o progresso, em "Em criação"; com aprovação ligada, "Devolver para correção" depois de conferir a aba "Pontos" em `pending` | O mesmo; o "Bento" fica acompanhável na Mesa |
   | Concluir (F2-4 / Tarefa 4) | "Pendentes (N)" → abre → "Ver Pontos" → confere → "Aprovar ficha" (ou "Concluir criação" na ficha com "terminei") → o cartão sai de "Pendentes", e a lista atualiza as duas contagens | O mesmo no iOS |

   O "ajudar" e o "devolver" também passam pelo R-09 (as Notas privadas, P09-C) e pelo "Pedir ajuste" (P04-D), que não mudam aqui. Se o P16-D entrar (revelar a nota), o "ajudar" ganha o caminho dele; não é deste pacote.
6. **Conferência no aparelho.** O roteiro completo está na **§11**. A altura do cartão com todos os selos no Android a 360, 393 e 411 dp e a aba "Pontos" em `pending` no iOS são obrigatórias.
7. **Resumo para a seção do pacote no PR da onda:**
   - o que mudou;
   - como foi testado;
   - os achados do `/code-review` e do `/security-review`;
   - a medida do cartão e da posição das abas;
   - os pontos para o PO (§9) que seguem abertos.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

Cada commit diz tudo o que entra nele, por arquivo e por sistema (a lição do A2 da onda 4). O pacote não tem conteúdo de template; "nos três sistemas" quer dizer os testes com os templates `vtm-v20`, `mta-m20` e `wta-w20`.

| # | Commit | O que entra (tudo) | Itens | Esforço |
|---|---|---|---|---|
| 1 | `feat(api): a Mesa manda as escolhas e a camada da criação, sem o motivo` | `apps/api/src/sheets/creation-state.ts` (`creationInputView`); `apps/api/src/chronicles/table.ts` (o campo na linha, `:126-151`); `__tests__/table.test.ts` (V20, M20, W20; NPC oculto e revelado; devolvida e em ajuste sem `reason`); `__tests__/authz.test.ts` (o conteúdo da Mesa por ator, nos três sistemas) | R-15 | P |
| 2 | `feat(api): "fichas em criação" na lista de crônicas, só para o narrador` | `apps/api/src/chronicles/routes.ts` (`creatingCount`, `:341-383` e `:396-420`); `__tests__/creation.test.ts` (as exclusões da §4.1); `__tests__/authz.test.ts` (o `creatingCount` por ator, com o `viewer`, nos três sistemas) | R-15 | P |
| 3 | `feat(app): o progresso da criação a partir da conta da ficha` | `apps/frontend/sheet/creation/progress.ts` (novo: `creationProgress`, `fitProgress`, `progressSpoken`); `sheet/creation/__tests__/progress.test.ts` (novo; os exemplos da §3.2 nos três templates e a igualdade com o `guideItems` e o `freebiesBalance`) | R-15 | M |
| 4 | `feat(app): o progresso no cartão da Mesa` | `components/chronicles/tableItems.ts` (`creationInput` no `TableRowData`, a entrada no `buildItem`, `progress` no `TableItem`); `components/chronicles/TableRow.tsx` (a linha e o nome acessível; o comentário `:25-30`); `app/__tests__/table.test.tsx` | R-15 | P |
| 5 | `feat(app): filtro "Em criação" e "Pendentes" na Mesa` | `tableItems.ts` (`stageOf`, `stageCounts`, `stage` no `arrange`); `TableView.tsx` (os chips, a linha do filtro, os vazios, a seção de NPCs com filtro); `components/chronicles/__tests__/tableItems.test.tsx` (novo); `app/__tests__/table.test.tsx` | R-15 | P |
| 6 | `feat(app): a contagem de fichas em criação na lista de crônicas` | `app/(app)/index.tsx` (`chronicleMeta`); `lib/queries/chronicles.ts` (o tipo, se a lista tiver); `lib/queries/creation.ts` (a invalidação da lista no "Pedir ajuste" e no "Avisar que terminei", onde faltar); `app/__tests__/chronicles.test.tsx` | R-15 | P |
| 7 | `feat(app): a aba Pontos em leitura para o narrador também em pending` | `sheet/creation/CreationPanel.tsx` (`useCreationReview`, o painel em `pending`, a frase da conta fechada, "Ver Pontos" no aviso); `sheet/SheetView.tsx` (`budget`); `sheet/creation/guide.ts` (os avisos em `pending` para o narrador); `sheet/__tests__/storyteller.test.tsx`; `sheet/creation/__tests__/CreationScreen.test.tsx` ou `advantages.test.tsx` | R-15 | P |
| 8 | `feat(app): o painel "Criação de fichas" recolhido num resumo depois de salvo` | `components/chronicles/CreationSettings.tsx` (o estado `open`, o resumo, "Editar", "Cancelar", o foco, `revision === 0`); `components/chronicles/__tests__/CreationSettings.test.tsx`, `chronicles.a11y.test.tsx`, `chronicles.layout.test.tsx`; e os specs da tabela da §4.3, rodados e corrigidos se algum quebrar | T-36 | P |
| 9 | `test(e2e): a Mesa da criação, a lista e o painel recolhido a 360, 390 e 1280` | `e2e/tests/table-creation.spec.ts` (novo; V20, M20 e W20) | R-15, T-36 | M |
| 10 | `docs: o progresso no cartão da Mesa e o painel recolhido` | `design/design-system/components.md` (o cartão da Mesa, l.739; o filtro de etapa; o painel recolhido) | — | P |

**Por que esta ordem:**

- a API (1, 2) vem antes de quem a lê (4, 6), e sai sozinha: o app antigo ignora os campos;
- a função pura (3) vem antes do cartão (4);
- o cartão (4) e o filtro (5) ficam juntos no `tableItems.ts`, que nenhum outro pacote da onda toca;
- a aba em `pending` (7) e o painel (8) são independentes e saem sozinhos, se a onda precisar cortar;
- o E2E (9) é escrito aqui e rodado na integração.

### 8.2 Esforço

**M**, de 4 a 6 dias, em 10 commits (8 P e 2 M). A matriz soma 1 P (T-36) e 1 M (R-15), e bate. O que pesa:

- o texto do progresso nos três sistemas, com o caber em duas linhas sem cortar;
- a medida do cartão com todos os selos, no AVD a 360, 393 e 411 dp, no iOS e no web;
- a matriz de AuthZ com o teste de conteúdo nos três sistemas.

**Se a onda precisar cortar:** o commit 8 (painel) sai sozinho e fecha o T-36; o 7 fecha o POA-20. A alternativa B do painel (§3.7) soma ~2 dias.

### 8.3 Riscos

- **O custo da conta no Pixel 3a e no iPhone SE com 10 fichas** (pergunta 1). Mitigação pronta: adiar o cálculo para depois do primeiro desenho, com a linha reservada.
- **A altura do cartão** passa do limite proposto (210) com fonte grande ou a 360. Mitigação: `lines: 1` no `fitProgress`, ou um limite novo, registrado no §10.
- **O `fitProgress` erra para menos**, como o `fitGuide` a 375 pt ([onda-4.md](onda-4.md) §11, achado 2): mostra "✓ 3 de 5" quando os nomes caberiam. É o mesmo desenho conservador: nunca corta.
- **O "✓" no leitor de tela.** O VoiceOver e o TalkBack podem ler "marca de seleção". O nome acessível usa a palavra ("completos"); o anúncio real fica para ouvir no aparelho (o AVD não tem TalkBack).
- **A Mesa sem template carregado** (o modelo ainda vem): sem `check`, sem linha, e ela aparece quando o template chega. O cartão pode crescer depois do primeiro desenho; a linha reservada da mitigação 1 cobre isso também.
- **A primeira gravação sem mudança** escreve "orçamento padrão alterado" na auditoria (pergunta 5).
- **Textos novos** são rascunho do time e mudam fixtures se o PO os trocar (§9, ponto 1).

### 8.4 Conflitos com os pacotes da onda

A ordem proposta: o P09-D não depende do P12, do P13, do P15-D nem do P16-D. **Ele vai antes do P14-D**, porque define a altura acima das abas que o spec novo mede, e a Descrição do P14-D pode entrar nesse espaço. A ordem final é do orquestrador.

| Arquivo | Pacotes | Onde cada um mexe | Como resolver |
|---|---|---|---|
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` | P09-D (só na alternativa B), P14-D, P12 | P09-D (A): **não toca**. P14-D: a leitura da Descrição com "Ler tudo", provavelmente no bloco do sistema e do papel (`:217-226`), acima das abas. P12: o "‹ Crônicas" (`:137`, `router.replace('/')`) e os três "voltar" (onda-3 §11, achado 6), o `InviteSheet` (`:315-320`) e o "Ninguém entrou ainda" (`:406-411`, T-82) | **Baixo na A; médio na B.** Acordo com o P14-D (plano dele, §3.2 e §8.4): o bloco da Descrição vai logo depois das linhas de sistema e narrador (`:217-226`), acima do resumo recolhido, com até 104 px a 390 e 112 dp a 393. Com ele, as abas ficam em y ≈ 375 a 390. O P14-D entra depois, faz o rebase no topo novo e mede de novo o topo do `tablist` no `table-creation.spec.ts` (o limite de 340 vira ~450 na crônica com Descrição). O P12 mantém o aviso "Regras da criação salvas." como está; o P09-D também, e o resumo recolhido passa a ser um retorno visível a mais |
| `apps/frontend/app/(app)/index.tsx` (lista de crônicas) | P09-D, P12 | P09-D: a meta (`chronicleMeta`, `:26-55`). P12: "Criar crônica" e "Entrar com convite" no topo (T-51; a matriz cita l.30-34, estimado: as ações estão em `:64-75` e no fim da lista) | Baixo: blocos diferentes |
| `apps/api/src/chronicles/routes.ts` | P09-D, P12, P14-D | P09-D: o `GET /chronicles` (`:289-421`). P12: as rotas de convite (D-14, limites do P02). P14-D: o `GET /chronicles/:id` (`:423-509`), onde a Descrição vai no `head` também para o ex-membro (`:457-466`) | Baixo: handlers distintos |
| `apps/api/src/__tests__/authz.test.ts`, `src/test/authz-matrix.ts` | P09-D, P14-D, P15-D, P16-D (e o P12, se mudar convite) | Cada um acrescenta casos de conteúdo ou linhas | **Médio, trivial:** cada pacote acrescenta no fim do seu bloco; quem entra depois faz o rebase. Rodar a matriz inteira depois de cada merge |
| `apps/frontend/sheet/SheetView.tsx`, `sheet/creation/CreationPanel.tsx`, `sheet/creation/guide.ts` | P09-D; talvez P13 | P09-D: a aba em `pending` (§3.6). P13 (T-50, T-77, U-01, T-84) mexe em `sheet/xp/`, no `TextLayout.tsx` e no `Stepper`; a conferir no plano dele se toca o `SheetView` | Baixo, a conferir com o plano do P13 |
| `components/chronicles/TableRow.tsx`, `TableView.tsx`, `tableItems.ts`, `CreationSettings.tsx` | só o P09-D | — | Nenhum |
| `e2e/tests/table-creation.spec.ts` (novo) | P09-D | — | O P09-D não edita o `narrator.spec.ts`, que o P16-D pode tocar (o rótulo das Notas, `:94-120`) |
| `e2e/tests/journey*.spec.ts` | P12 (convite por link) | O P09-D não muda esses specs (§4.3) | Nenhum |
| `design/design-system/components.md` | P09-D, P12 (Toast, convite), P13 (Stepper) | Seções diferentes | Baixo |
| `CLAUDE.md` (contagens de teste) | P01-D | O P09-D acrescenta testes; quem atualiza as contagens é o P01-D, por último | Nenhum |

### 8.5 Arquivos tocados

- **Novos:** `apps/frontend/sheet/creation/progress.ts`, `apps/frontend/sheet/creation/__tests__/progress.test.ts`, `apps/frontend/components/chronicles/__tests__/tableItems.test.tsx`, `e2e/tests/table-creation.spec.ts`.
- **API:** `apps/api/src/sheets/creation-state.ts`, `apps/api/src/chronicles/table.ts`, `apps/api/src/chronicles/routes.ts`.
- **Testes da API:** `apps/api/src/__tests__/table.test.ts`, `creation.test.ts`, `authz.test.ts`.
- **App:** `components/chronicles/tableItems.ts`, `TableRow.tsx`, `TableView.tsx`, `CreationSettings.tsx`; `app/(app)/index.tsx`; `lib/queries/chronicles.ts` e `lib/queries/creation.ts` (se faltar a invalidação); `sheet/SheetView.tsx`; `sheet/creation/CreationPanel.tsx`; `sheet/creation/guide.ts`.
- **Testes do app:** `app/__tests__/table.test.tsx`, `chronicles.test.tsx`; `components/chronicles/__tests__/CreationSettings.test.tsx`, `chronicles.a11y.test.tsx`, `chronicles.layout.test.tsx`; `sheet/__tests__/storyteller.test.tsx`; `sheet/creation/__tests__/CreationScreen.test.tsx` ou `advantages.test.tsx`.
- **Docs:** `design/design-system/components.md`.
- **Não toca:** `packages/sheet-core`, `packages/ui`, `packages/db`, `design/templates`, `schema.json`, `apps/frontend/lib/persist.tsx`, `apps/frontend/app/(app)/chronicles/[id]/index.tsx` (na proposta A), `scripts/seed-roteiro.ts`.

## 9. Perguntas abertas (técnicas)

⚙ = resposta só no simulador, no aparelho ou no E2E.

1. ⚙ **O custo da conta com 10 fichas.** Medir no iPhone SE (simulador sem carga) o tempo da Mesa com 10 cartões em criação por pontos, antes e depois. Um script descartável no scratchpad (fora do repositório) pode medir o `checkCreation` dos três templates no Bun, para ter a ordem de grandeza. Acima de ~100 ms no SE, adiar o cálculo (§3.1). O AVD sob carga não é evidência.
2. ⚙ **O "✓" no VoiceOver e no TalkBack.** O nome acessível usa "completos"; conferir no aparelho que o "✓" visível não é lido duas vezes.
3. **O limite do cartão em criação** (210 a 390 e a 360) ou uma linha só de progresso. Depende da medida da §4.3.
4. **O filtro e a seleção.** O filtro de etapa mantém marcado o que esconde, como o "Só com alerta" de hoje (`TableView.tsx:214-216`). A alternativa é o filtro tirar da seleção o que esconde, e a mesma regra passaria a valer para o "Só com alerta".
5. **A primeira gravação das regras sem mudança** e a frase da auditoria. Proposta: o app manda o `defaults` só quando ele mudou, e a frase deixa de dizer "orçamento padrão alterado" quando só a aprovação mudou. A API não muda.
6. **Abas da crônica fixas na rolagem** (`stickyHeaderIndices`, como a faixa da ficha do P08). A D-10 não pede; com o painel recolhido, as abas ficam a ~270 px. Fixá-las mexe na barra da seleção da Mesa (T-49) e no `RefreshControl`, e pede conferência no RN-web.
7. **O `creatingCount` e a Mesa contam coisas um pouco diferentes:** a lista não conta o PC do próprio narrador (depois de uma transferência), e o chip "Em criação" da Mesa conta. Igualar pede o `stageOf` olhar o dono, o que a Mesa hoje não faz.
8. **A invalidação da lista** no "Pedir ajuste" e no "Avisar que terminei" (§3.5): conferir no `lib/queries/creation.ts` se o P04-D já faz.

**Pontos para o PO** (não decididos aqui; ver §2):

1. **As frases novas** (rascunho do time, para revisão): o "✓" e o "✓ 3 de 5", "Habilidades: faltam 4", "1 traço para corrigir", "A conta fechou" no cartão, "Em criação (N)" e "Pendentes (N)", "Mostrando 3 de 8: em criação.", os vazios da Mesa, "2 fichas em criação" na lista, a frase da conta fechada em `pending` e "Ver Pontos" no aviso.
2. **"Habilidades: faltam 4" por orçamento** (o formato da D-10) ou os itens por grupo do guia ("Talentos 4 · Perícias 2") no cartão (§2, item 1). Recomendação: por orçamento.
3. **O painel recolhido acima das abas (A) ou dentro da aba Fichas (B)** (§3.7). Recomendação: A, que é P e não mexe no `index.tsx`. A B custa ~2 dias e conflita com o P12.
4. **A aba "Pontos" também para o dono em `pending`.** A D-10 fala do narrador. O dono enviou a ficha e não a edita; ler a própria conta não muda nada de AuthZ. Recomendação: sim, num commit P, se o PO quiser.
5. **Dois filtros ou um** ("Em criação / Pendentes"), e "Avisou que terminou" em "Pendentes" (§2, item 3). Recomendação: dois, com "terminei" em "Pendentes".
6. **O resumo de "uma linha" a 390** com os rótulos (o `summaryLine`, 3 linhas a 390) ou sem eles (uma linha, diferente da do jogador) (§2, item 2). Recomendação: com os rótulos.
7. **"Padrão do sistema" e "Restaurar padrão" no orçamento** (NW-04, NA-15), fora da D-10: entram numa linha nova da matriz?
8. **Seguem abertos, das ondas anteriores:** [onda-4.md](onda-4.md) §6, ponto 15 (o nome "Orçamento"; §3.8), e [onda-2.md](onda-2.md) §6, ponto 6 (o extrato, R-17). Os outros pontos do onda-1 §6 ao onda-4 §6 não tocam este pacote e continuam abertos.

**Para o orquestrador: o que da [onda-4.md](onda-4.md) §11 toca este pacote:**

- **Achado 2 ("Faltam" a 375 pt):** o `fitProgress` usa a mesma conta de largura do `fitGuide` e herda a folga. Não muda o `fitGuide`.
- **Achado 6 (o N tem "Desfazer" no lote de criação da J1 já aprovada):** aparece no "concluir" da fase 2 do Narrador. O P09-D não mexe no Histórico; é candidato do P13, e o roteiro da §11 só registra se vir.
- **Achado 7 (a senha no campo E-mail pelo teclado do iOS):** o driver do roteiro esconde o valor dos campos E-mail e Senha (§11.d).
- **Não conferido na onda 4 (anúncios do VoiceOver e do TalkBack):** o nome acessível do cartão e o estado do filtro também ficam para ouvir no aparelho.
- **A3 (o `onLayout` do RN-web só com mudança de tamanho):** o `fitProgress` usa a largura da janela e da coluna, não o `onLayout`.
- Os achados 1, 3, 4 e 5 não tocam este pacote.

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

Implementação em 05 e 06/11/2026, na `pacote/p09-d-mesa-progresso`, em paralelo com o P14-D, o P13, o P12 e o P01-D (cada um no seu worktree). Os pontos para o PO e as perguntas técnicas seguiram a recomendação deste plano; nada foi decidido aqui:

- painel recolhido acima das abas (alternativa A);
- "Habilidades: faltam N" por orçamento;
- dois filtros, com "terminei" em "Pendentes";
- o resumo com os rótulos (o `summaryLine`, 3 linhas a 390).

**Commits:** os 10 da §8.1, na ordem, mais 2 `fix` do `/code-review`:

| Commit | O que entrou |
|---|---|
| `74f3965` | 1: `creationInput` na Mesa |
| `dceece3` | 2: `creatingCount` na lista |
| `f8293bf` | 3: `progress.ts` |
| `31557da` | 4: o progresso no cartão |
| `50a9f32` | 5: o filtro de etapa |
| `a13ab9d` | 6: a contagem na lista |
| `99fa2f0` | 7: a aba Pontos em `pending` |
| `4b930c1` | 8: o painel recolhido |
| `f027202` | 9: o `table-creation.spec.ts` |
| `3569158` | 10: o `components.md` |
| `0e38d1b` | fix do `/code-review`: o bônus e o "A conta fechou" no `fitProgress` |
| `07962a4` | fix do `/code-review`: o resumo depois de salvar |

**O que ficou fora, e por quê:**

1. **A aba "Pontos" para o dono em `pending`** (ponto 4 do PO). Não entrou, porque o plano a dá como "se o PO quiser", não como padrão.
2. **"Padrão do sistema" e "Restaurar padrão"** (ponto 7 do PO). Ficam fora da D-10, à espera de uma linha nova na matriz.
3. **Mandar o `defaults` só quando mudou** (pergunta técnica 5) não entrou. A primeira gravação sem mudança continua escrevendo "orçamento padrão alterado" na auditoria, como já acontecia quando só a aprovação mudava.
4. **O adiamento do cálculo para depois do primeiro desenho** (pergunta 1) não entrou. A medida no iPhone SE é da integração. O spec só anota o tempo até o décimo cartão, sem limite.
5. **O E2E não rodou aqui.** O `table-creation.spec.ts` foi escrito e passa no typecheck. Os specs da §4.3 foram lidos, não rodados, e nenhum seletor mudou. O orquestrador roda tudo na integração, em série.
6. **A invalidação da lista** no "Pedir ajuste" e no "Avisar que terminei" (pergunta 8) já existia: o `useRefresh` de `lib/queries/creation.ts` invalida `chronicleKeys.all` em todos os comandos da criação. O commit 6 não mexeu ali.

**Desvios de desenho:**

7. **`creationProgress(check)` não recebe o `model`.** A assinatura da §3.2 tinha o `model`, mas os rótulos já vêm do `check`.
8. **`captionChars`** sai do `guide.ts` e é usado pelo `fitGuide` e pelo `fitProgress`. Assim, a conta de largura fica num lugar só.
9. **A contagem de "N traços para corrigir"** conta caminhos distintos, não problemas: dois problemas no mesmo campo valem um traço. É um achado do `/code-review`.
10. **"Mostrando N de M"** conta os PCs do escopo. O NPC nunca entra no filtro e também não entra no M.
11. **A Mesa vazia** mantém "Nenhuma ficha na crônica ainda." e ganha uma segunda linha, "As fichas aparecem aqui com a etapa da criação e o que falta.", em vez de uma frase só. Os testes e specs que procuram o texto de hoje continuam valendo.
12. **O foco do "Editar" e do "Cancelar".** O `Button` do `@tms/ui` não expõe `ref`, e o pacote não muda o `@tms/ui`.
    - **No web,** o foco vai ao primeiro elemento focável da vista: o rádio da aprovação ao abrir e o "Editar" ao recolher. O spec confere no DOM.
    - **No app,** o evento de foco vai à vista que embrulha o botão. Essa vista não é acessível, e o VoiceOver e o TalkBack podem não mover o foco (achado do `/code-review`, aceito aqui).
    - **No rebase do P12,** que traz a `ref` do `Button`, o foco nativo passa a usá-la. Fica no roteiro do iOS (§11), e no AVD fica não conferido, porque o AVD não tem TalkBack.
13. **O resumo recolhido depois de salvar** lê um estado local `saved` (achado do `/code-review`). Ele segue a crônica quando a rebusca chega e, antes dela, guarda o que acabou de ser salvo. O `revision` mandado ao servidor continua o da crônica, e o 409 de revisão fica como estava.

**Achados do `/code-review` (high) não corrigidos, com o motivo:**

14. **A Mesa conta o PC do próprio narrador em "Em criação" e a lista não.** É a pergunta técnica 7, e o plano mantém a diferença, que só aparece depois de uma transferência.
15. **O `creationInputView` refaz o parse que o `creationStateOf` já faz na mesma linha.** Juntar os dois mexeria no `creationStateOf`, que também serve a `GET /chronicles/:id/characters` (a lista do jogador), e a resposta do jogador não pode ganhar o campo. O custo é um parse a mais por PC em criação, sem `resolve`.
16. **O `cardTextWidth` repete a conta de recuo e borda dos estilos do cartão e da grade.** O `table.test.tsx` fixa os números de hoje (358, 328 e a grade de 1280), e o spec confere no DOM que a linha cabe na célula.

**Segurança.** O `/security-review` cobriu o diff inteiro e não achou nada de confiança alta ou média:

- a Mesa e a contagem continuam só do narrador;
- a subconsulta é parametrizada;
- o `creationInput` vai por lista explícita, sem motivo nem marcador;
- o NPC fica fora;
- nada é renderizado como HTML.

**Testes, no worktree:**

- **API:** 1972 pass e 0 fail (`test:coverage`). A matriz de AuthZ tem 1129 testes nos três sistemas.
- **Frontend:** 1638 testes no `test:coverage`. Um caso falhou por timeout de 10 s, sob a carga dos cinco worktrees: `new-sheets.a11y.test.tsx`, o "Sair" no iOS, fora deste pacote. Sozinho, o arquivo passa (6 de 6).
- **Cobertura:** nenhuma meta quebrou (`progress.ts`: 98,8% de linhas).
- **Lint e typecheck:** verdes.

**Para o rebase:**

- `authz.test.ts`: dois casos novos no fim do bloco não mutável de cada sistema;
- `chronicles/routes.ts`: só o `GET /chronicles`;
- `app/(app)/index.tsx`: só o `chronicleMeta`;
- `SheetView.tsx`: só o `budget`;
- `CreationPanel.tsx` e `guide.ts`;
- `components.md`.

O `chronicles/[id]/index.tsx` não foi tocado.

## 11. Testes manuais (web, Android com AVD, iOS com idb)

Roteiro para conferir cada item na interface, nas três plataformas, com a API local e o seed do roteiro. Só contas fictícias. Ele detalha o passo 6 da §7. A coluna "Resultado" fica em branco e é preenchida na integração. Nenhum resultado é "ok" sem a evidência; quando uma plataforma não puder ser conferida, o resultado diz "não conferido" e por quê.

### 11.a Preparação

1. **Banco e API:**
   - `npx pnpm db:up`, `npx pnpm db:migrate` (conferir pela tabela `kysely_migration`: o processo pode travar na saída) e `npx pnpm templates:publish --published`;
   - API em `npx pnpm dev:api` (porta 3001) e Metro em `cd apps/frontend && npx expo start` (porta 8081).
2. **Seed:** `npx pnpm seed:roteiro --fichas-criacao > <scratchpad>/p09d/seed-<plataforma>.log 2>&1`.
   - **A saída vai só para o log no scratchpad,** porque o seed imprime os e-mails e a senha. Ler com `grep -v -i senha`. A senha é a constante do `scripts/seed-roteiro.ts` e não é escrita aqui, nas evidências nem nos scripts (os scripts de login a leem em tempo de execução, sem imprimir).
   - **Contas:** N (`roteiro_narrador`), J1 (`roteiro_jogador1`), J2 e N2, em `@roteiro.test`.
   - **O que o seed já cobre:** as crônicas "{Sistema} v4" por pontos nos três sistemas (aprovação desligada, salvas pela API: o painel abre recolhido); "Mago v4" com a aprovação ligada; em "Vampiro v4", "Isadora Web", "Isadora Android" e "Isadora iOS" (prioridades e todos os básicos menos 1 de Vigor) e "Ficha Pontos R" (só o nome); em "Mago v4", "Ficha Aprovação R" (conta fechada, não enviada); em "Vampiro v3/v5", "Ficha Livre R" e os "Otto" (criação livre); e "Vampiro limite 20", com 20 PCs do N e 1 da J1 em criação livre. Cada seed apaga e recria as crônicas do N, então cada plataforma começa com o mesmo conjunto.
   - **Um seed por plataforma,** com pelo menos 15 min entre dois (o limite de aceites da J1, memória `device-testing-setup`).
   - **Convites:** o P09-D não gera convite no roteiro (zero por plataforma). Os aceites são os do próprio seed.
3. **O que o roteiro cria pela tela** (uma vez por plataforma; é parte da fase 2 que está sendo conferida):
   - **J1** envia "Ficha Aprovação R" para aprovação ("Mago v4") → `pending`;
   - **N** pede ajuste na "Isadora <outra plataforma>" ("Vampiro v4") com um motivo fictício curto ("Confira a Força de Vontade.") → "Aguardando ajuste";
   - **J1** põe o ponto que falta no Vigor da "Isadora <terceira plataforma>" e conclui → "Concluída em dd/mm";
   - **J1** cria "Mesa Lobo R" em "Lobisomem v4", só com o nome → o progresso do W20;
   - **J1** toca "Avisar que terminei" na "Ficha Livre R" ("Vampiro v3/v5") → "Avisou que terminou" (Pendentes, criação livre, sem linha de progresso);
   - **N** cria o NPC "Vigia R" em "Vampiro v4" (nasce oculto, em criação livre) → confere que fica fora do filtro e da contagem.
4. **O que o seed não tem e o roteiro não precisa:** "Devolvida" sai de devolver a "Ficha Aprovação R" no passo R-15e e reenviar; dez fichas por pontos para o custo ficam no E2E (§4.3), porque tempo no emulador não é evidência. **O seed não muda.** Uma opção `--fichas-mesa` que criasse os estados pela API pouparia ~10 min por plataforma e esconderia exatamente os fluxos que a fase 2 confere.
5. **Evidências:** no scratchpad da sessão, `p09d-<plataforma>-<ID>-<passo>.png`. Sem e-mail visível na captura; o motivo do ajuste é fictício e curto.

### 11.b Web (Playwright, Chromium; WebKit onde indicado)

- **Script:** `<scratchpad>/p09d/web.mjs`, com o `playwright` do `node_modules`, contra `http://localhost:8081` (Metro). Reiniciar o Metro com `--clear` antes da rodada.
- **Viewports exatas:** `{ width: 390, height: 844 }`, `{ width: 360, height: 740 }` e `{ width: 1280, height: 800 }`.
- **WebKit:** os passos T-36a, R-15a e R-15c rodam também em `webkit.launch()`.
- **Seletores por papel e rótulo:**
  - `getByRole('tablist', { name: 'Visão da crônica' })`, `getByRole('tab', { name: 'Mesa', exact: true })`;
  - `getByTestId('creation-settings-summary')`, `getByRole('button', { name: 'Editar regras da criação' })`, `getByRole('button', { name: 'Cancelar', exact: true })`, `getByRole('button', { name: 'Salvar regras da criação' })`;
  - `getByTestId('table-progress-<id>')`, `getByTestId('table-row-<id>')`, `getByRole('button', { name: /^Em criação \(\d+\)$/ })`, `getByRole('button', { name: /^Pendentes \(\d+\)$/ })`, `getByTestId('table-filter-status')`;
  - `getByRole('button', { name: 'Ver Pontos', exact: true })`, `getByRole('tab', { name: 'Pontos', exact: true })`, `getByTestId('creation-freebies')`.
- **Medidas:** o topo do `tablist` e a altura de cada `table-row-<id>` pelo `boundingBox()`; o `aria-pressed` dos chips e o `aria-label` do cartão no DOM; o `document.activeElement` depois de "Editar" e de "Cancelar".
- **Um `page.screenshot` por passo.**

### 11.c Android (AVD)

- **AVD:** `Pixel_3a_API_34_extension_level_7_arm64-v8a` (1080 × 2220, 440 dpi = 393 dp), com `-cores 4 -memory 3072 -no-snapshot` e `-gpu host` (só opções de execução).
- **APK:** o `assembleDebug` arm64 da integração, com `JAVA_HOME` no JBR do Android Studio. O pacote não muda nada nativo; o APK da onda serve.
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Larguras (obrigatórias para o cartão e o resumo):** `adb shell wm density 480` (360 dp), padrão (393 dp) e `adb shell wm density 420` (411 dp); `adb shell wm density reset` no fim.
- **Navegação:**
  - `adb shell uiautomator dump /sdcard/ui.xml` e `adb pull`, para achar o alvo pelo `text` ou pelo `content-desc` e tocar no centro do `bounds` com `adb shell input tap X Y`;
  - a altura do cartão sai do `bounds` do elemento cujo `content-desc` começa pelo nome da ficha;
  - o estado do chip do filtro sai do `selected="true"` no dump;
  - `adb shell input keyevent 4` para o voltar do Android com o painel aberto (o `UnsavedChangesGuard` com mudança) e com a ficha aberta pela Mesa;
  - o `input text` não digita acento: o motivo do ajuste é ASCII ("Confira a FdV."); o resto é escolher e tocar.
- **Teclado de software** para o motivo do ajuste: `adb shell settings put secure show_ime_with_hard_keyboard 1`, e `0` no fim.
- **LogBox:** dispensar o banner antes de tocar perto da barra de abas.
- **Tempo:** o emulador sob carga dá falso "busy" e tempos que não são evidência (pergunta 1).
- **TalkBack:** não está instalado no AVD; os anúncios ficam "não conferido", para ouvir no aparelho.

### 11.d iOS (simulador, com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, e iPhone 17, iOS 26.5.
- **Build Debug com "Sign to Run Locally",** em `apps/frontend/ios`. Sem assinatura, o app não loga: o keychain responde `-34018`. O app é `com.tms.app`.

  ```bash
  xcodebuild -workspace TMS.xcworkspace -scheme TMS -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath <scratchpad>/ios-dd \
    CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build
  ```

  Depois: `xcrun simctl install <UDID> <scratchpad>/ios-dd/Build/Products/Debug-iphonesimulator/TMS.app` e `xcrun simctl launch <UDID> com.tms.app`.
- **O cliente do idb:** o venv `~/.venvs/idb-tms` já existe, fora do repositório, com `fb-idb` 1.7.7. Antes de usar, `~/.venvs/idb-tms/bin/pip-audit` de novo; com vulnerabilidade, parar e registrar. Nunca entra no `package.json` nem no lockfile. O `--companion-path /opt/homebrew/bin/idb_companion` vai antes do subcomando.
- **O companion** fica só local, no socket de domínio. No fim, `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` não mostra nada.
- **Navegação:**
  - `idb ui describe-all --udid <UDID>`, com o driver escondendo o valor dos campos E-mail e Senha, para achar o alvo pelo `AXLabel` ("Editar regras da criação", "Em criação (3)", "Ver Pontos", o nome do cartão) e tocar no centro do `frame` com `idb ui tap X Y`;
  - a altura do cartão sai do `frame` do elemento do cartão; o estado do chip, do traço "Selected" ou do `AXValue`;
  - `idb ui swipe` para rolar; `idb screenshot --udid <UDID> <arquivo>`;
  - **limites:** o idb não faz o gesto de borda (usar o "‹"); não digita fora do ASCII; o teclado de software some depois do primeiro texto. O motivo do ajuste é ASCII.
- **Deep link** (se precisar abrir uma ficha direto): `xcrun simctl openurl <UDID> 'tms://characters/<id>'` pede "Abrir com 'TMS'?": achar "Abrir" no `describe-all` e tocar.

### 11.e Tabela por item

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-36a | Web 390 e 1280 (Chromium e WebKit) | N | Lista → "Vampiro v4" | O resumo "Criação por pontos · …" com "Editar"; as abas no topo (anotar o y do `tablist`); a 1280, o resumo numa linha | `p09d-web390-T-36a-1.png`, `p09d-web1280-T-36a-2.png` | |
| T-36b | Web 390 | N | "Editar" → mudar o bônus → "Cancelar"; de novo "Editar" → mudar → "Salvar regras da criação" | O foco na aprovação ao abrir; "Cancelar" recolhe sem gravar e devolve o foco ao "Editar"; salvar recolhe, o aviso aparece e o resumo diz o bônus novo | `p09d-web390-T-36b-1..3.png` | |
| T-36c | Web 390 | N | "Criar crônica" (Vampiro, nome fictício "Crônica P09D") | Painel aberto; "Salvar regras da criação" habilitado sem mudança; salvar recolhe | `p09d-web390-T-36c-1.png`, `-2.png` | |
| T-36d | **Android 360, 393 e 411 dp (obrigatório)** | N | "Vampiro v4"; "Editar" → mudar → voltar do Android | O resumo sem transbordar nas três larguras; as abas sem rolar (anotar o `bounds`); o voltar com mudança pergunta "Sair sem salvar?" | `p09d-and360-T-36d-1.png`, `p09d-and393-T-36d-2.png`, `p09d-and411-T-36d-3.png` | |
| T-36e | iOS SE e iPhone 17 | N | "Vampiro v4" → Mesa → Fichas → "Convidar" visível | Sem rolar por cima das regras (NA-03); "1 ficha aguarda sua revisão" à vista depois do passo R-15e (POA-19) | `p09d-iosSE-T-36e-1.png`, `p09d-ios17-T-36e-2.png` | |
| R-15a | Web 390 e 360 (Chromium e WebKit) | N | Depois do 11.a.3: "Vampiro v4" → Mesa | Cada cartão por pontos com a linha de progresso: "Ficha Pontos R" com "(prioridade)"; a "Isadora" em ajuste com "Aguardando ajuste" e o que falta; a concluída sem linha; o NPC "Vigia R" sem linha | `p09d-web390-R-15a-1..2.png`, `p09d-web360-R-15a-3.png` | |
| R-15b | Web 390 | N | "Mago v4" e "Lobisomem v4" → Mesa | "Esferas: faltam …" (ou "A conta fechou" na "Ficha Aprovação R"); "Dons: faltam …" na "Mesa Lobo R" | `p09d-web390-R-15b-1.png`, `-2.png` | |
| R-15c | Web 390 (Chromium e WebKit) | N | Mesa de "Vampiro v4" → "Em criação (N)" → "Pendentes (N)" → desligar | Os chips com `aria-pressed`; só os cartões da etapa; "Mostrando …" anunciado; a seção "NPCs" some; o "Vigia R" nunca aparece com filtro | `p09d-web390-R-15c-1..3.png` | |
| R-15d | Web 390 | N, J1 | Lista de crônicas como N; depois como J1 | N: "N fichas em criação" e "1 ficha aguarda revisão" em "Vampiro v4"/"Mago v4"; J1: nenhum dos dois | `p09d-web390-R-15d-1.png`, `-2.png` | |
| R-15e | Web 390 | N, J1 | "Mago v4" → Mesa → "Pendentes" → "Ficha Aprovação R" → "Ver Pontos" → conferir → "Devolver para correção" (motivo fictício) → J1 reenvia → N "Aprovar ficha" | Aba "Pontos" em Leitura com o bônus e "A conta fechou. Confira…"; sem "Regras da casa" nem troca de fase; o cartão passa a "Devolvida" (Em criação) e depois sai de "Pendentes"; a lista atualiza as contagens | `p09d-web390-R-15e-1..5.png` | |
| R-15f | Web 1280 | N | Mesa de "Vampiro v4" | Grade de 3 colunas, a linha de progresso dentro de cada célula | `p09d-web1280-R-15f-1.png` | |
| R-15g | **Android 360, 393 e 411 dp (obrigatório)** | N | Mesa de "Vampiro v4"; anotar o `bounds` do cartão em ajuste (chip, estado, progresso) e do concluído | Em criação abaixo de 210 dp a 360 e a 393 (anotar a 411); em jogo abaixo de 170; nada transborda | `p09d-and360-R-15g-1.png`, `p09d-and393-R-15g-2.png`, `p09d-and411-R-15g-3.png` | |
| R-15h | Android 393 | N | Filtro "Em criação" → abrir um cartão → voltar do Android | O filtro continua ligado na volta (a aba e o ponto do T-39); o chip com `selected="true"` no dump | `p09d-and393-R-15h-1.png`, `-2.png` | |
| R-15i | **iOS SE e iPhone 17 (obrigatório)** | N | "Mago v4" → Mesa → "Pendentes" → abrir a ficha enviada → "Ver Pontos" | A aba "Pontos" em Leitura (POA-20); nenhum controle de edição; o `AXLabel` do cartão com o progresso | `p09d-iosSE-R-15i-1..3.png`, `p09d-ios17-R-15i-4.png` | |
| R-15j | iOS SE | N | Mesa de "Vampiro v4"; anotar o `frame` dos cartões | Em criação abaixo de 210 pt; em jogo abaixo de 170 | `p09d-iosSE-R-15j-1.png` | |
| SAIDA-W | Web 390 e 1280 | N | A fase 2 inteira (§7, tabela do critério de saída): acompanhar, ajudar (aba "Pontos" → item → grupo), devolver ("Pedir ajuste"), concluir ("Pendentes" → aprovar) | Cada tarefa sem abrir ficha por ficha para saber o estado e sem entrar em Criação para ver a conta | `p09d-web-SAIDA-1..8.png` | |
| SAIDA-A | iOS SE (e Android 393, se o tempo permitir) | N | O mesmo | O mesmo | `p09d-iosSE-SAIDA-1..8.png` | |

### 11.f Acessibilidade mínima

- **O progresso é texto e entra no nome acessível do cartão:**
  - **web (DOM):** o `aria-label` do `table-row-<id>` contém o progresso inteiro, com "completos" no lugar do "✓"; a linha visível é texto;
  - **Android (`uiautomator dump`):** o `content-desc` do cartão contém o progresso;
  - **iOS (`describe-all`):** o `AXLabel` do cartão contém o progresso.
- **O filtro diz qual está ativo:** `aria-pressed="true"` no web, `selected="true"` no Android, o traço "Selected" no iOS, e a linha "Mostrando …" como texto (`aria-live="polite"` no web).
- **"Editar regras da criação"** é botão com o nome que começa pelo texto visível; ao abrir, o foco vai para a aprovação; ao recolher, volta ao "Editar" (o mesmo padrão do "Revogar" do P12).
- **O resumo das regras é texto,** não só cor.
- **"Ver Pontos"** é botão com o nome do que abre.
- **O "✓" não é a única pista:** a captura em escala de cinza mostra o mesmo, e o texto diz "faltam" ou "acima".
- **O que fica para ouvir no aparelho:** o anúncio do VoiceOver e do TalkBack do nome do cartão (o "✓" lido uma vez só) e da linha do filtro. O AVD não tem TalkBack, e o `describe-all` não expõe o que o leitor anuncia.

### 11.g Limpeza

- Parar a API e o Metro.
- Desligar o AVD (`adb emu kill`) e os simuladores (`xcrun simctl shutdown all`).
- `adb shell wm density reset`; `adb shell settings put secure show_ime_with_hard_keyboard 0`.
- Encerrar o `idb_companion` e conferir com `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` que nada ficou escutando.
- Convites: nenhum gerado pelo roteiro deste pacote. Se algum passo gerou, revogar pela folha "Convidar".
- Manter as capturas e os logs do seed só no scratchpad. Nada vai para o repositório.

### 11.h Quando uma plataforma não puder ser conferida

O resultado diz "não conferido" e o motivo, por exemplo:

- "o TalkBack não está instalado neste AVD";
- "o build do iOS falhou em …";
- "o `describe-all` não mostra o estado do chip";
- "o AVD ficou lento demais para o dump (carga N)".

O passo fica para a integração ou para o roteiro antes do release. Nunca "ok" sem a evidência.
