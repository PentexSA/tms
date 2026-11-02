# P05-C · Feedback da conta na criação por pontos: plano de implementação

> Plano · 2026-11-02 · base conferida: `onda/2-correcoes-criacao` em `9f75426` (main depois da onda 1)

Este plano corrige o pacote [P05-C da matriz de achados](../testes/2026-11-01/matriz-achados.md#p05-c): onda 2 (Correções da criação), correção, com pré-requisitos P03-C e P06, os dois já na `main`. Ao fim do pacote:

- cada recusa da conta diz o motivo certo, aparece ao lado do toque e some quando a causa some;
- o "+" mostra antes do toque que não vai passar, e quanto custa quando passa;
- o saldo de bônus e o que foi comprado ficam visíveis antes de concluir;
- a prioridade marcada automaticamente avisa;
- "Criar ficha" leva a pessoa ao campo com erro.

É correção: **nada muda na conta.** Ficam como estão:

- o teto de 3 com pontos básicos (`creation-cap`), os preços de bônus, o saldo, o `hard-cap` (Esfera ≤ Arete, Arete ≤ 3), o baseline travado (Aparência do Nosferatu) e o `LIMIT` de 1000;
- a trava da fase "Pontos básicos", que continua só do app, como hoje (`apps/frontend/sheet/creation/creation.ts:232–237`).

O servidor continua decidindo. O `/events` repete o `checkCreationBatch` sob trava (`apps/api/src/sheets/events.ts:253–266`), e concluir e aprovar repetem o `completionRefusal` (`apps/api/src/sheets/creation.ts:622–625`, `:717–720`). O app só avisa antes.

Todas as linhas citadas são do `9f75426`. A matriz cita o `1db3db9` e foi escrita antes da onda 1. Onde a causa provável dela está errada ou incompleta, a seção 1 e a seção 3 dizem.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md), "Como executar", "Decisões de produto" e §P05-C | Itens, decisões, critério de saída da onda e "PR local" |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §1 (C4), §4.1 (passos 6, 8a, 10 e 12), §4.2 e §9 (R-06, R-07, R-17, R-20, R-28) | Recomendações e mapa da criação |
| [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) §7 | Recomendações do QA (T-07, T-20, T-57) |
| Notas: `notas/po-app.md`, `po-web.md`, `experiente-app.md`, `experiente-web.md`, `iniciante-app.md`, `iniciante-web.md`, `qa-app.md`, `qa-web.md`, `narrador-web.md` | Cenários das personas (seção 7) |
| [plano-v4.md](../plano-v4.md) §3.1 e §3.6 | Avaliação parcial da criação e frases-base de recusa |
| [README dos templates](../../design/templates/README.md) §14 (`creation`, `costs`) | Teto, preço uniforme por grupo, linhas de bônus e "sobra de bônus não vira XP" |
| [arquitetura-motor-de-ficha.md](../arquitetura-motor-de-ficha.md) §6.5 | Assinatura por campo no store (nenhuma linha re-renderiza à toa) |
| [onda-1.md](onda-1.md) §9, [P06](P06-componentes-acessibilidade.md) §3.12 e §10, [P03-C](P03-C-rascunho-salvamento.md) §10 | API que a onda 1 deixou (`Stepper`, `BottomSheet`, rascunho) e lições da integração |

---

## 1. Objetivo e itens

**Objetivo (matriz).** Cada recusa diz o motivo certo, aparece perto do toque e some quando a causa some; saldo e custo de bônus visíveis antes de gastar; a prioridade automática avisa.

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| T-07 | alta | O 4º ponto numa Habilidade, com pontos básicos, é bloqueado com o motivo errado ("os 13 pontos básicos já foram usados", com 3/13) | `apps/frontend/sheet/creation/creation.ts:255–263`: todo `extra` novo vira `basicsSpentText` (`:281–287`). O teto não chega à recusa: o `CreationComponent` não guarda o `creation-cap` (`packages/sheet-core/src/creation.ts:97–105`; o teto é calculado em `:351` e usado em `:361`) |
| T-18 | média | "A conta fechou" com bônus livres; concluir ou enviar não avisa a sobra | Orçamento: `CreationPanel.tsx:226–230`. Barra: `useFreebiesText`, `CreationPanel.tsx:59–68` ("Bônus: 10 de 15"), usado em `ModeBar.tsx:78` e `:190`. Confirmação: `SummarySheet` em `ModeBar.tsx:330–443`, com o texto em `:390–397` (não na l.326 da matriz) |
| T-20 | média | O "+" parece ativo num grupo esgotado ou num traço travado; o aviso sai abaixo da linha, fora da tela, e o anterior não some | O `Stepper` só desabilita por `min`/`max` (`packages/ui/src/Stepper.tsx:115`) e não sabe da conta. A recusa vira `useState` da linha (`apps/frontend/sheet/evolve/NumberEditorRow.tsx:63`, `:96`; `ResourceEditorRow.tsx:19`, `:24–25`), e o `EditorShell` a desenha depois de tudo, embaixo da linha (`EditorShell.tsx:39–44`). O store não guarda a recusa: o `editDraft` só a devolve (`apps/frontend/sheet/store/sheetStore.ts:517–531`) |
| T-21 | média | "Criar ficha" com o nome vazio: o erro fica fora da tela, sem rolar nem focar | `apps/frontend/sheet/CharacterForm.tsx:77–94` valida e só marca. Quem rola é a tela: o `ScrollView` está em `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx:83–86` |
| R-17 | média | O custo do bônus só aparece depois de gastar, e não há extrato do que foi comprado | Contador: `creation.ts:117–129`. Orçamento: `CreationPanel.tsx:199–208`. A conta já traz o preço do grupo e o custo de cada linha (`sheet-core/src/creation.ts:107–146`). Faltam o preço por unidade das linhas (FdV, Humanidade) e os componentes delas, que dizem de onde vem o valor de partida (Coragem × FdV) |
| T-55 | baixa | Recusas ficam na tela depois que a causa some | Mesma causa do T-20: a mensagem mora na linha e só muda no próximo toque *dela* (`NumberEditorRow.tsx:96`). A prioridade escolhida passa por `setCreation` (`sheetStore.ts:870–877`) e nunca chega à linha. A fase passa por `setCreationPhase` (`:879–881`) e também não chega |
| T-57 | baixa | "Bônus: N acima do saldo." soa como saldo já estourado e não diz o custo | `creation.ts:174–177`, alcançado pelo `draftRefusal` em `:249–253`. É o texto do "O que falta", que descreve um **estado**; a recusa de um **toque** precisa de outro texto |
| R-28 | baixa | Escolher a prioridade de um grupo marca os outros sozinho, sem aviso | `apps/frontend/sheet/creation/usePriorityChoice.ts:47–76` (o toast só diz "Prioridades salvas", `:66`). O `reorder` grava a ordem inteira (`creation.ts:209–223`) |

**O que a matriz marcou e o código corrige.**

- **T-20 e T-55.** A matriz põe o `draftRefusal` em "`sheetStore.ts` l.379" e o `Stepper` como causa, ambos estimados. Na verdade:
  - a l.379 do `1db3db9` é a **chamada** (hoje `sheetStore.ts:518`); a função e os textos estão em `sheet/creation/creation.ts:238–287`;
  - o aviso velho não é "recalculado só na próxima ação": ele vive no estado local de cada linha e nunca é recalculado;
  - o `Stepper` é só metade da causa do "+" com cara de ativo. A outra metade é que ninguém calcula, antes do toque, se o próximo ponto passa.
- **T-07.** A causa da matriz está certa e a l.255–263 não mudou na onda 1 (`git log 1db3db9..9f75426 -- apps/frontend/sheet/creation/creation.ts` vazio). Falta dizer que o teto precisa sair do core: hoje só o `eligible` mostra o efeito dele.
- **T-57.** O texto da l.176 também serve ao "O que falta" do Orçamento (`CreationPanel.tsx:216–224`), onde está certo. A correção é no `draftRefusal`, não no `problemText`.
- **T-18.** A confirmação é o `SummarySheet` (`ModeBar.tsx:390–397`), não a l.326.
- **R-17.** Os custos já estão na conta do core. O que falta é expor três números (o teto do componente, o preço por unidade da linha e as partes da linha). O extrato não precisa de nada que só o servidor sabe (seção 3.5).

---

## 2. Decisões aplicadas

**O P05-C não tem decisão própria (D-xx).** É correção: nenhum item cria estado, ação ou fluxo novo. Cinco decisões encostam no pacote, e o desenho as respeita:

- **D-05 (P05-D, onda 4: "Faltam: …" na barra, aba "Orçamento" → "Pontos", folha de bônus só na primeira passagem, alternância de fase vira indicador).** Nada disso entra aqui. A fronteira:
  - a barra ganha só o texto do saldo ("Bônus: restam N de 15"). O resumo "Faltam: …" com itens tocáveis é da D-05;
  - a aba continua "Orçamento". Os textos novos não citam o nome da aba; o atalho é o "Ver orçamento" que já existe na folha de bônus (`CreationPanel.tsx:274–281`), e a D-05 renomeia os dois juntos;
  - a folha "Começaram os pontos de bônus" (`BonusNotice`, `CreationPanel.tsx:241–291`) e o seletor de fase (`:181–198`) não mudam. O R-06 pede "um link para o seletor": o aviso do T-07 leva à aba onde ele está, e esse caminho sobrevive quando a D-05 transformar o seletor em indicador;
  - o extrato do R-17 entra na aba atual, abaixo do saldo; o "O que falta" continua onde está.
- **D-01 (P03-D, onda 3: "Salvar" sempre na barra, "Concluir" ao lado).** O botão único da barra (`ModeBar.tsx:185–209`) não muda. O T-18 só troca textos e acrescenta uma linha à confirmação, que a D-01 mantém.
- **D-02 e D-03 (P04-D, onda 3: estado da ficha e "próximo passo" na barra).** O texto do saldo na barra (T-18) é um pedaço à parte do `detail` do `EvolveBar` (`ModeBar.tsx:313–317`). O P04-D acrescenta o próximo passo sem tirar o saldo.
- **D-06 e D-08 (P07-D, onda 4: Qualidade comprável com bônus; −/+ na linha dos itens de lista).** O cálculo de "o próximo ponto passa?" (`stepAdvice`, seção 3.2) aceita caminho de item (`values.<lista>#<item>`). O P07-C o usa nas folhas, e o P07-D, na linha.
- **D-10 (P09-D, onda 5: Orçamento em leitura para o narrador, inclusive em `pending`).** O extrato do R-17 é o que esse Orçamento vai mostrar. Aqui ele fica onde o Orçamento já aparece (`creating`, `CreationPanel.tsx:169–175`).

**Os pontos para o PO da onda 1** ([onda-1.md](onda-1.md) §6) continuam abertos. Em especial o 5: o T-21 não acrescenta validação, e o Clã continua opcional na Nova ficha.

**O que a matriz recomenda e o código mostra que não se aplica como está escrito** (apontado, não decidido):

1. **"'+' desabilitado com o motivo ao lado" (R-20, T-20).** Um `disabled` de verdade tem dois problemas:
   - o toque não responde, e o "toque que parece morto" é justamente o achado (IA-10, EA-16);
   - a previsão antes do toque usa o preço de tabela. Ela erra nos descontos derivados: com a FdV comprada, subir a Coragem custa menos que o preço da Virtude (IA-12). Um `disabled` bloquearia um ponto que o servidor aceita.

   O desenho deixa o "+" **com cara de indisponível** (a opacidade de desabilitado e `aria-disabled`), com o motivo como dica. O toque continua chegando à conta exata e, recusado, mostra o motivo ao lado. Fica como pergunta técnica 1 (seção 9). Se o time preferir o `disabled` de verdade, a mudança é de uma prop, mas aí a previsão precisa ser exata (pergunta 2).
2. **"O extrato fica na ficha concluída, em leitura" (R-17, NW-29).** Depois de concluída, a conta não vale mais (`creationActive`, `creation.ts:61–70`), e a ficha evolui com XP. Recalcular o extrato sobre a ficha de hoje mostraria números errados. Mostrá-lo exige **gravar a conta no momento da conclusão** (API e banco). É dado novo, não correção. Fica fora do pacote. O lugar natural seria o evento "criação concluída" do Histórico (T-80, P04-C; D-02) ou o Orçamento em leitura da D-10. A decisão é do PO.
3. **"'Use os pontos de bônus' com um link para o seletor" (R-06).** Como dito acima, o link leva à aba Orçamento ("Ver orçamento"), não ao seletor, que a D-05 transforma em indicador.
4. **O nome "pontos de bônus" é fixo no app** (`creation.ts:280–287`, `CreationPanel.tsx:46–47`). O contrato do template não tem rótulo para o saldo (`freebies`, README §14). Um sistema com "pontos livres" leria "bônus". Isso já era assim antes do pacote; dar nome pelo template é mudança de contrato e fica como pergunta técnica 4.

---

## 3. Desenho por item

### 3.0 O mecanismo da recusa (R-20): o que o P07-C consome

O P05-C cria o mecanismo que a R-20 descreve, e o P07-C (T-19) o reaproveita dentro das folhas de Disciplina, Dom, Qualidade e do editor de item, sem reescrevê-lo. São quatro peças.

**1. A recusa estruturada (pura, `apps/frontend/sheet/creation/creation.ts`).** O `draftRefusal` deixa de devolver `string` e passa a devolver o motivo:

```ts
export type RefusalCause =
  | 'priorities'      // grupo sem prioridade escolhida
  | 'budget'          // em Básicos: os pontos básicos do grupo acabaram
  | 'cap'             // em Básicos: o traço chegou ao creation-cap
  | 'freebies'        // o saldo de bônus não cobre o custo
  | 'ceiling'         // hard-cap (Arete ≤ 3, Esfera ≤ Arete)
  | 'locked'          // baseline travado (Aparência do Nosferatu)
  | 'not-purchasable' // sem preço de bônus
  | 'other'           // outro problema bloqueante da conta

export interface CreationNotice {
  readonly cause: RefusalCause
  // Só rótulos do template e números da conta; nunca texto da ficha
  readonly text: string
  // "Ver orçamento" (T-07): leva à aba onde a fase é escolhida
  readonly action?: 'budget'
}

export function draftRefusal(/* mesmos argumentos de hoje */): CreationNotice | null
```

**2. O aviso no store (`apps/frontend/sheet/store/sheetStore.ts`).** Um aviso só por ficha, no estado:

```ts
export interface DraftNotice {
  readonly id: number                // cresce a cada recusa: o leitor de tela anuncia de novo
  readonly paths: readonly string[]  // os caminhos da tentativa ("values.wits")
  readonly text: string
  readonly cause: RefusalCause | 'invalid' | 'limit'
  readonly action?: 'budget'
}
// SheetState
readonly notice: DraftNotice | null
// SheetActions
clearNotice(): void
```

- **Quem cria.** O `editDraft` (`sheetStore.ts:486–537`): toda recusa, seja da conta, do `applyBatch` ou do limite do lote, vira o `notice` e substitui o anterior. É isso que faz "o aviso anterior some quando surge outro" (T-20). A tentativa (os eventos) fica guardada num `ref` interno do store, fora do estado público.
- **Quando some.**
  - num `editDraft` aceito, em qualquer campo: o aviso é a resposta a um toque, e o toque seguinte o substitui;
  - em `setMode`, `startDraft`, `saveDraft`, `discardDraft`, `restoreDraft` e `setCreation(null)`;
  - **quando a causa some.** Uma assinatura interna do store (`api.subscribe`) reavalia a tentativa guardada sempre que mudam `check`, `values`, `creation` ou `creationPhase`. Isso inclui a prioridade salva (`setCreation`), a troca de fase, a ficha que chega do servidor (`received`), a fila confirmada e outra pessoa mudando um campo. A reavaliação é o mesmo `applyBatch` + `draftRefusal` do `editDraft`, sem gravar nada. Se a tentativa agora passaria, o aviso some (o ponto não é aplicado sozinho). Se ainda é recusada por outro motivo, o texto é atualizado. A reavaliação custa um `checkCreation` a mais por mudança, e só enquanto houver aviso.
- **O `creationRefusal` do "Salvar"** (a faixa "A alteração foi desfeita.", `CreationPanel.tsx:152–158`) também passa a sumir no primeiro `editDraft` aceito. Hoje fica até o próximo lote confirmado.
- **`useSetDraft` não muda de assinatura** (`apps/frontend/sheet/evolve/hooks.ts:78–90`): continua devolvendo o texto. As folhas que ainda não migraram (`ChoiceEditorRow`, `TextEditorRow`, `SpecialtyEditor`, que já mostram o erro dentro da folha, e o `ListEditor` até o P07-C) seguem funcionando.

**3. A leitura por campo (`apps/frontend/sheet/evolve/hooks.ts`).**

```ts
// O aviso cujos caminhos tocam este prefixo ("values.wits", "values.disciplines"),
// ou null. Seletor com igualdade por id: a linha só re-renderiza quando o aviso
// dela nasce, muda ou some (arquitetura §6.5)
export function useDraftNotice(path: string): DraftNotice | null
```

**4. O texto na tela (`apps/frontend/sheet/evolve/DraftNoticeText.tsx`, novo).**

- Mostra `text` com `accessibilityRole="alert"` e `key={id}`, para o leitor anunciar de novo uma recusa repetida.
- Leva `nativeID` `notice-<campo>`, que vira o `id` no web (alvo do `aria-describedby` do "+").
- Tem `testID` `notice-<campo>`.
- Com `action: 'budget'`, desenha o botão de texto "Ver orçamento", que chama `useOpenBudget()`. É um contexto novo, de três linhas, em `SheetView.tsx`, fornecido junto do `SheetProvider` (`SheetView.tsx:168–169`) e ligado ao mesmo `setTab(BUDGET_TAB)` da folha de bônus (`:221–223`).

**Como o P07-C consome.** Ele não cria estado de erro na folha. Lê `useDraftNotice('values.<lista>')` e põe o `<DraftNoticeText>` **dentro** do `BottomSheet`, perto do "Aplicar" ou da lista de opções (T-19). Para os −/+ do `ItemSheet` (`ListEditor.tsx:289–315`), usa `useStepAdvice('values.<lista>#<item>')` (seção 3.2) e a prop `increase` do `Stepper` (seção 3.8). Se precisar de um motivo novo (por exemplo, "a 4ª Disciplina"), acrescenta um caso ao `RefusalCause` e ao texto. O `draftRefusal` não é reescrito.

### 3.1 T-07 e T-57 · O motivo certo na recusa

**Causa.** Em "Pontos básicos", o `draftRefusal` procura qualquer grupo cujo `extra` cresceu e devolve "os N pontos básicos já foram usados" (`creation.ts:255–263`). Mas o `extra` cresce por dois motivos, e o código não os separa:

1. o orçamento do grupo acabou (`basic === budget`);
2. o traço passou do `creation-cap`. O `eligible` do componente para no teto (`sheet-core/src/creation.ts:361`, `:369`), então o investido acima dele vira `extra` mesmo com o grupo em 3/13.

Na fase de bônus, a recusa de saldo usa o texto de estado do "O que falta" (`:174–177`).

**Desenho.**

- **Core (aditivo).** O `CreationComponent` ganha `cap?: number` (o `creation-cap` que vale, já calculado em `:351`), `ceiling?: number` (o `hard-cap`, `:352`) e `locked?: true` (o baseline travado, `:378`). Nenhum campo existente muda. A conta é a mesma, e os testes que usam `toMatchObject` (`packages/sheet-core/src/__tests__/creation.test.ts:218–237`, `:391–440`) continuam valendo.
- **App.** O `draftRefusal` passa a olhar o componente do caminho tocado na conta de depois. A ordem é do motivo mais específico para o mais geral:

| Causa | Quando | Texto (rótulos e números do template) |
|---|---|---|
| `cap` | em Básicos, `invested − eligible` do componente cresceu | "Prontidão: com pontos básicos, vai até 3. Acima disso, cada ponto custa 2 de bônus." Sem preço no grupo, só a primeira frase. Com `action: 'budget'` |
| `budget` | em Básicos, o `extra` do grupo cresceu sem passar do teto | O texto de hoje (`basicsSpentText`), com o preço: "Físicos: os 7 pontos básicos já foram usados. Para passar disso, use os pontos de bônus (5 por ponto)." Com `action: 'budget'` |
| `freebies` | `CREATION_FREEBIES_EXCEEDED` entre os problemas que pioraram | "Faltaria 1 de bônus: custa 2, restam 1." O custo é `before.remaining − after.remaining` (o líquido, com descontos derivados), e o restante é o `before.remaining`. Com o saldo já negativo (o narrador baixou o bônus): "Bônus: o saldo já está N acima; este ponto custa M." |
| `priorities` | `CREATION_PRIORITIES_REQUIRED` | "Físicos: escolha a prioridade antes de distribuir os pontos." |
| `locked` | `CREATION_LOCKED` | "Aparência: fica em 0 na criação (Clã: Nosferatu)." A condição vem do `baselines[].when` do template, com o rótulo do campo e o da opção atual |
| `ceiling` | `CREATION_HARD_CAP` | "Forças: na criação, vai até 1." |
| `not-purchasable` | `CREATION_NOT_PURCHASABLE` | O texto de hoje ("…: não se compra na criação.") |
| `other` | o resto | `REFUSAL_TEXT[code]`, como hoje |

- **O `problemText` (`:158–193`) não muda.** Ele continua descrevendo o estado no "O que falta", onde "Bônus: 3 acima do saldo." está certo.
- **O teto e o preço não aparecem em código como número.** "3" e "2" vêm de `component.cap` e `group.price`, e "Prontidão" e "Físicos", dos rótulos.

### 3.2 T-20 · O "+" mostra a trava, e o aviso fica ao lado do toque

**O aviso ao lado do toque.**

- O `EditorShell` (`EditorShell.tsx:7–47`) passa a desenhar o `error` **na coluna do rótulo** (depois do `sub`, `:31–35`), à esquerda do controle, na mesma altura do "+", e não mais depois de `below` (`:39–44`).
- A recusa do toque é a primeira coisa embaixo do rótulo, no mesmo `y` do botão tocado. Com isso, não cai abaixo da dobra (web 390: y=855 de 844; iOS: y≈873 de 874).
- Vale para todas as linhas do `EditorShell` (Number, Resource, Text, Specialty). O erro do servidor (422) e o do "Digitar" também sobem, que é o mesmo princípio.
- O `NumberEditorRow` e o `ResourceEditorRow` deixam de guardar a recusa em `useState` (`NumberEditorRow.tsx:63`, `:96`; `ResourceEditorRow.tsx:19`, `:24–25`). Mostram `erroDoDigitar ?? useDraftNotice(caminho) ?? issue`. O erro de digitação ("Digite um número inteiro de 1 a 5", `NumberEditorRow.tsx:107`) continua local: é do campo aberto, não da conta.

**O "+" que mostra a trava antes do toque (`stepAdvice`).** É uma função pura em `creation.ts`. Lê a conta que o store já tem (`check`) e diz, para um caminho, o que o próximo ponto faria:

```ts
export interface StepAdvice {
  readonly blocked: RefusalCause | null
  // Motivo (bloqueado) ou custo ("+1 = 2 bônus"); null quando não há o que dizer
  readonly text: string | null
  // Bônus que o próximo ponto custa pelo preço de tabela; 0 = pago com básicos
  readonly cost: number | null
}
export function stepAdvice(
  model: SheetModel, check: CreationCheck, phase: CreationPhase, path: string
): StepAdvice | null
```

Regras, para o componente `c` do caminho, no grupo `g`:

| Situação | `blocked` | `cost` |
|---|---|---|
| `g.budget === null` | `priorities` | — |
| `c.locked` e `c.value ≥ c.initial` | `locked` | — |
| `c.ceiling !== undefined` e `c.value ≥ c.ceiling` | `ceiling` | — |
| Básicos, com `c.cap` e `c.value ≥ c.cap` | `cap` | — |
| Básicos e `g.missing === 0` | `budget` | — |
| Bônus, o próximo ponto vai além dos básicos e `g.price === null` | `not-purchasable` | — |
| Bônus, o próximo ponto vai além dos básicos e `g.price > freebies.remaining` | `freebies` | `g.price` |
| Bônus, o próximo ponto vai além dos básicos | — | `g.price` |
| Cabe nos básicos | — | 0 |
| Linha de bônus (`flat`, fora dos orçamentos: FdV, Humanidade) | `freebies` se `price > remaining` | `line.price` |
| Point-buy (`measure: 'cost'`) | `budget` se o degrau passa de `g.missing`; `ceiling` no fim da tabela | o degrau da tabela do template |
| Caminho fora de qualquer conta | `null` (sem previsão; o toque decide) | — |

**É uma previsão, não a decisão.** Usa o preço de tabela e não reavalia a ficha (a conta inteira por linha custaria um `checkCreation` por linha; ver pergunta 2). Os descontos derivados (a FdV que passa a vir da Coragem) podem fazer o ponto custar menos que a previsão. Por isso o "+" bloqueado continua tocável: quem decide é o `draftRefusal`, com a conta exata, e depois o servidor.

- **Na linha.** `useStepAdvice(caminho)` só vale em `mode === 'create'` com `check`. O seletor devolve `{ blocked, text, cost }` com igualdade rasa: uma linha re-renderiza só quando a previsão dela muda (arquitetura §6.5). O `NumberEditorRow` e o `ResourceEditorRow` (o permanente) passam ao `Stepper` a prop `increase` (seção 3.8), com:
  - `blocked`: se há trava;
  - `hint`: o `text`;
  - `hintID`: `notice-<campo>` quando há aviso, ou `advice-<campo>` quando o motivo está escrito na linha.
- **O motivo de um "+" bloqueado** fica no `hint` (leitor de tela) e aparece escrito no toque. Ele não é escrito em todas as linhas do grupo: com Mentais 3/3, as três linhas diriam a mesma coisa, que o contador do grupo já diz ("3/3").
- **No app**, o `hint` vira o `accessibilityHint` do controle ajustável. O incremento pela ação de acessibilidade continua passando pelo `onChange` e recebe o aviso como qualquer toque.

### 3.3 T-55 · O aviso some quando a causa some

É consequência das peças da seção 3.0. Os casos das notas, com o que faz o aviso sumir:

| Nota | Aviso velho | O que muda agora |
|---|---|---|
| POW-24, POA-12, IW-09, IA-11 | "Escolha as prioridades…" depois de escolher | `setCreation` muda o `creation` → reavaliação → a tentativa passaria → some |
| POA-12 (Mago) | "Forças: acima do limite" depois de subir o Arete | `values`/`check` mudam → a Forças +1 passaria → some |
| EW-14 | "Bônus: 3 acima do saldo." com o saldo já gasto | Some no próximo toque aceito. Se a pessoa libera saldo noutro lugar, a reavaliação apaga |
| EA-16, T-07 | "os 13 pontos…" enquanto se preenche o resto | Some no primeiro toque aceito em qualquer campo |
| T-20 | o aviso anterior não some quando surge outro | Um aviso só por ficha: o novo substitui |

### 3.4 T-18 · Bônus que sobram

Três textos, nenhuma trava:

1. **Orçamento** (`CreationPanel.tsx:226–230`). Com a conta fechada (sem problemas) e `freebies.remaining > 0`: "Pontos básicos completos; restam 15 de bônus. Gaste-os nos grupos ou conclua pela barra de cima." Com `remaining === 0` (ou sem bônus no template), continua "A conta fechou: conclua a criação pela barra de cima." O `testID` `creation-ready` fica. O saldo da l.204–206 passa a "Bônus: restam 10 de 15." (hoje "Bônus: 10 de 15 restantes.").
2. **Barra** (`useFreebiesText`, `CreationPanel.tsx:59–68`). "Bônus: restam 15 de 15", no lugar de "Bônus: 15 de 15", que se lê "usei 0" (IW-10, NW-22). Acima do saldo: "Bônus: 3 acima do saldo".
3. **Confirmação de concluir ou enviar.** Uma função pura `freebiesLeftText(check)` em `creation.ts` devolve "Sobram 4 pontos de bônus. Eles não viram XP." (ou "Sobra 1 ponto…"), ou `null`. O "não viram XP" é a regra do contrato (README §14, item 6: "sobra de bônus é permitida e não vira XP") e responde ao POW-10.
   - **Barra do jogador:** a linha entra no `SummarySheet` com `finish` (`ModeBar.tsx:390–397`).
   - **Menu do narrador e "Aprovar ficha":** **o P04-C unifica essas confirmações no T-32** (menu do narrador × barra). O acordo, fechado na consolidação ([onda-2.md](onda-2.md) §4.1), usa a forma do plano do P04-C: as confirmações aceitam linhas extras, `notes?: readonly string[]`. O P05-C põe ali o `freebiesLeftText(check)` nos três caminhos: "Concluir criação" pela barra, "Concluir criação" pelo menu ⋯ e "Aprovar ficha". O menu do narrador fica no `AppBar`, fora do `SheetProvider`. Por isso o número chega a ele pelo `onDraftState({ unsaved, freebiesLeft })`, que substitui o `onUnsaved` (`SheetScreen.tsx:336-344`). O `check` existe sempre que a ficha tem `creation`, em qualquer modo (`sheetStore.ts:395-396`), então o narrador em Leitura também tem o número. Sem `creation`, a linha não aparece. O P04-C entra antes na onda (seção 8.4). A função e o teste dela não dependem disso.

Nada bloqueia: concluir com sobra continua permitido (README §14, item 6).

### 3.5 R-17 · Custo antes de gastar e extrato do bônus

**Custo antes.** Vem do mesmo `stepAdvice`:

- **No cabeçalho do grupo** (`CreationCounter.tsx:41–56`), na fase de bônus e com o grupo cheio (`missing === 0`), o contador acrescenta o preço: "13/13 · +2 bônus · +1 = 2 bônus". O README §14 exige preço **uniforme no grupo**, então um número por grupo basta e não custa altura por linha (o T-27 do P08 reclama de espaço).
  - O `counterText(g)` ganha a fase: `counterText(g, phase)`.
  - O `counterSpoken` acrescenta ", cada ponto a mais custa 2 de bônus".
- **Na linha**, o custo aparece escrito (como `sub` do `EditorShell`, com `nativeID` `advice-<campo>`) só quando difere do que o cabeçalho diz:
  - nas linhas de bônus fora de orçamento (FdV, Humanidade);
  - num traço no teto com o grupo ainda incompleto;
  - no point-buy, onde cada degrau custa diferente.
- **No "+"**, o custo vai sempre na dica (`hint`).

**Extrato.** Uma função pura `freebieLedger(model, check)` em `creation.ts`, desenhada no Orçamento logo abaixo do saldo, com o título "Onde foram os bônus" (`SectionHeader` de grupo) e `testID` `creation-ledger`. Uma linha por fonte de gasto:

| Fonte (da `CreationCheck`) | Linha |
|---|---|
| Grupo com `freebieCost > 0` | "Habilidades › Talentos: 2 × 2 = 4", com "Prontidão acima de 3: 1" quando há componente acima do teto (`invested − eligible`) |
| Linha `flat` com `cost > 0` | "Força de Vontade: 1 × 1 = 1 · parte de 4, da Coragem". O valor de partida é o `initial` do componente, e a fonte, o `from` da fórmula do `default` no template. É o desconto que nem I-A nem o narrador viam (IA-12, NW-22) |
| Linha `item-meta` | "Qualidades (2 itens): 5" (contagem, sem o nome dos itens) |
| Linha `credit` | "Defeitos: devolvem 9, contam 7" |
| Total | "Gastos 14 · crédito 7 · restam 8 de 22" |

**O extrato não precisa do servidor.** Todos os números já estão na `CreationCheck`, que o app calcula com o mesmo core do servidor. Faltam, no core (aditivo):

- `FreebieLine.price?: number` (o `cost` do `flat`, `sheet-core/src/creation.ts:638–644`);
- `FreebieLine.components?: readonly CreationComponent[]` (as partes da linha `flat`, já calculadas em `:625`).

**Fronteira.** O extrato na ficha **concluída** fica fora (seção 2, item 2). O extrato para o narrador em `pending` é a D-10 (P09-D).

### 3.6 R-28 · Prioridade marcada sozinha avisa

O comportamento fica: o relatório (§4.2) registra que E-W e I-W gostaram do preenchimento. Só acrescenta o aviso.

- Uma função pura `priorityNote(budget, values, antes, depois, grupo)` em `creation.ts`. Compara a ordem salva com a nova (`reorder`, `:209–223`) e lista os outros grupos cuja posição mudou ou foi preenchida: "Prioridades salvas. Sociais ficou Secundária (5) e Mentais, Terciária (3): toque no grupo para trocar."
  - Os rótulos vêm do template e do `RANKS` (`:110`), e os números, do orçamento efetivo (`usePriorityChoice.ts:44–46`).
  - Na troca de dois grupos, cita só o outro.
  - Sem outro grupo afetado, continua "Prioridades salvas".
- Vai no toast que já existe (`usePriorityChoice.ts:66`). O `Toast` anuncia ao leitor de tela (`packages/ui/src/Toast.tsx:84`) e fica mais tempo com ele ligado.

### 3.7 T-21 · "Criar ficha" leva ao erro

**Causa.** O `submit` (`CharacterForm.tsx:77–94`) marca os erros e para. O foco fica no botão, e o `ScrollView` da tela (`new-character.tsx:83–86`) não se move. A validação em si é boa: `aria-invalid`, `role=alert` e nenhuma requisição (QAW-14).

**Desenho.**

- **`CharacterForm`.**
  - Guarda o `y` de cada linha (`onLayout` no `View` de `styles.row`, `:100`) e o `ref` do campo de texto de cada editor.
  - Ganha a prop `onInvalid?: (y: number) => void`. Com erro, acha o primeiro campo inválido **na ordem da tela** (`rowsOf`, `:31–43`), chama `onInvalid` com o `y` da linha dele e foca o campo, quando ele é de texto.
  - Com um 422 do servidor (`serverIssues`), faz o mesmo ao recebê-lo.
- **`EditorProps`** (`apps/frontend/sheet/editors/types.ts:7–17`) ganha `inputRef?`. O `TextEditor` passa esse `ref` ao `TextField`.
- **`TextField`** (`@tms/ui`) ganha `ref` na interface de props. Com o React 19, o `ref` é prop, como o P06 fez no `Pressable` (`packages/ui/src/Pressable.tsx:21–22`). O `...rest` já o leva ao `TextInput` (`TextField.tsx:61`).
- **`new-character.tsx`.**
  - Guarda o `ref` do `ScrollView` e o `y` do formulário (`onLayout` de um `View` em volta do `CharacterForm`).
  - Em `onInvalid`, chama `scrollTo({ y: formY + y − 16 })` antes do foco.
  - No web, o `focus()` também traz o campo para a vista. No app, o `TextField` já anuncia o erro pelo `accessibilityHint` (`TextField.tsx:43`) e pelo `role=alert` (`:65`).
- **"Criar ficha" continua habilitado.** Um botão desabilitado não diria por quê.
- **Nenhuma validação nova.** O Clã continua opcional (ponto 5 do PO, onda 1).

### 3.8 API pública que muda (`@tms/ui` e `@tms/sheet-core`)

Nenhuma prop nem campo existente sai ou muda de tipo.

| Pacote | O que muda | Por quê |
|---|---|---|
| `@tms/ui` `Stepper` | Prop nova `increase?: { blocked?: boolean; hint?: string; hintID?: string }`. Com `blocked`, o "+" ganha a opacidade de desabilitado do `Pressable` (`Pressable.tsx:65`, `:75`) e `aria-disabled`, mas **continua chamando `onChange`**. O segurar não repete (o `onLongPress` sai), porque a repetição visual mostraria números que não vão valer. `hint`: no app, o `accessibilityHint` do controle ajustável (`Stepper.tsx:143–162`); no web, `aria-describedby={hintID}` no botão "+" (o react-native-web 0.21.4 repassa o `aria-describedby`). O nome do botão continua "Aumentar X", e os seletores exatos do E2E não mudam | T-20, R-17 |
| `@tms/ui` `TextField` | `ref?` na interface de props (React 19) | T-21 |
| `@tms/sheet-core` `CreationComponent` | `cap?`, `ceiling?`, `locked?` | T-07, T-20 |
| `@tms/sheet-core` `FreebieLine` | `price?`, `components?` (só no `flat`) | R-17 |

O `showLabel`, o `valueText`/`aria-valuetext` (T-34), o `valueNativeID` e o `hitTarget()` (T-70) do P06 ficam como estão. O "+" bloqueado mantém o alvo de 44/48 dp.

**A lição do S-01 na onda 1** (`b75a744`; `apps/frontend/babel.config.js`; `apps/frontend/test/babel-config.test.ts`): o `src` do `@tms/ui` compila com o JSX do React no app, e o defeito do `style` em função só apareceu no emulador. Por isso, o "+" bloqueado é conferido no AVD e no simulador (seção 7), não só no Jest e no web.

---

## 4. Testes

O Jest do frontend usa o `vtm-v20` (`test/fixtures`: `modelOf`, `templateJson`) e o template sintético `design/templates/testes/acct-teste.json`, que tem `creation-cap`, `hard-cap`, baseline travado (`app` com `lineage` `c`) e uma `Vontade` derivada de `con`. É o par de Coragem × FdV. O Bun do core e da API usa o mesmo `acct-teste`.

### 4.1 Um teste de regressão por item (falha no `9f75426`, passa depois)

| Item | O que o teste prova | Arquivo | Tipo |
|---|---|---|---|
| T-07 | Core: o componente acima do teto tem `cap: 3`; o `hard-cap` e o baseline aparecem em `ceiling` e `locked` | `packages/sheet-core/src/__tests__/creation.test.ts` | Bun |
| T-07 | `draftRefusal` com Talentos 3/5 e `alert` 3 → 4 em Básicos: `cause: 'cap'`, texto com "vai até 3" e "2 de bônus", sem "já foram usados"; grupo cheio sem teto: `cause: 'budget'` | `apps/frontend/sheet/creation/__tests__/creation.test.ts` | Jest |
| T-07 | Na tela (V20): 4 "+" em Prontidão com Talentos Primária mostram o motivo do teto ao lado da linha, e o contador continua 3/13 | `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | Jest + RNTL |
| T-57 | Saldo 1 e "+" num grupo cheio com preço 2: "Faltaria 1 de bônus: custa 2, restam 1." | `creation.test.ts` (frontend) e `creationStore.test.ts` (substitui a l.141) | Jest |
| T-57 | Desconto derivado: com a `Vontade` comprada, o custo citado é o líquido (`before.remaining − after.remaining`) | `creation.test.ts` (frontend) | Jest |
| T-20 | `stepAdvice`: `priorities`, `budget`, `cap`, `locked`, `ceiling`, `freebies`, `not-purchasable`, linha `flat`, point-buy (D&D, `modelOf('dnd5e-2014')`) e caminho fora da conta | `creation.test.ts` (frontend) | Jest |
| T-20 | `Stepper` com `increase.blocked`: `aria-disabled` no "+", a opacidade de desabilitado, o `onChange` chamado no toque e o segurar sem repetição. Web: `aria-describedby`. App: `accessibilityHint` no ajustável. Sem `increase`, nada muda | `packages/ui/src/a11y.test.tsx` | Jest + RNTL |
| T-20 | Mentais 3/3: o "+" de Raciocínio tem `aria-disabled`; o toque mostra o aviso **na coluna do rótulo** do `editor-wits` (antes do `below`); um segundo aviso noutro campo apaga o primeiro | `CreationScreen.test.tsx` | Jest + RNTL |
| T-20 | Nosferatu: o "+" de Aparência bloqueado e o texto "fica em 0 na criação (Clã: Nosferatu)" | `CreationScreen.test.tsx` | Jest + RNTL |
| T-55 | Store: o aviso "escolha a prioridade" some com `setCreation` (prioridades novas); o aviso de Básicos some com `setCreationPhase('freebies')`; o aviso de teto (hard-cap) some quando o campo do teto sobe; qualquer `editDraft` aceito apaga; o `creationRefusal` do "Salvar" some no primeiro `editDraft` aceito | `apps/frontend/sheet/creation/__tests__/creationStore.test.ts` | Jest |
| T-55 | Na tela: "+" em Força sem prioridade → aviso; escolher Físicos (mock do `PATCH`) → o aviso some | `CreationScreen.test.tsx` | Jest + RNTL |
| T-18 | `freebiesLeftText` (0, 1 e N); o Orçamento com a conta fechada e 15 livres diz "Pontos básicos completos; restam 15 de bônus"; com 0, "A conta fechou"; a barra diz "Bônus: restam 15 de 15"; a confirmação (`creation-confirm` visível) tem "Sobram 15 pontos de bônus. Eles não viram XP." | `creation.test.ts`, `CreationScreen.test.tsx` | Jest + RNTL |
| T-18 | Narrador: a confirmação de "Concluir criação" pelo menu e a de "Aprovar ficha" trazem a mesma linha | `apps/frontend/sheet/__tests__/storyteller.test.tsx` (sobre o teste do T-32 do P04-C) | Jest + RNTL |
| R-17 | `freebieLedger`: grupo com teto ("Prontidão acima de 3: 1"), linha `flat` com valor de partida derivado ("parte de 4, da Consciência" no `acct-teste`), `item-meta` em contagem, `credit` e total igual ao `freebies` da conta | `creation.test.ts` (frontend) | Jest |
| R-17 | Core: `FreebieLine.price` e `components` no `flat`; ausentes no `item-meta` e no `credit` | `sheet-core/src/__tests__/creation.test.ts` | Bun |
| R-17 | Contador na fase de bônus com o grupo cheio: "7/7 · +1 bônus · +1 = 5 bônus", e o falado com "cada ponto a mais custa 5 de bônus" | `creation.test.ts`, `CreationScreen.test.tsx` | Jest |
| R-28 | `priorityNote`: sem ordem salva, Físicos → Primária cita Sociais e Mentais; com ordem, a troca cita só o outro grupo | `creation.test.ts` | Jest |
| R-28 | Na tela: escolher Físicos mostra o toast com "Sociais ficou Secundária (5)" | `CreationScreen.test.tsx` (substitui a l.179) | Jest + RNTL |
| T-21 | `CharacterForm`: com o nome vazio, `onInvalid` é chamado com o `y` da linha do nome e o campo recebe o foco; com 422 do servidor no Conceito, o mesmo para o Conceito | `apps/frontend/sheet/__tests__/CharacterForm.test.tsx` | Jest + RNTL |
| T-21 | `TextField` com `ref`: `ref.current.focus` existe | `packages/ui/src/a11y.test.tsx` | Jest |
| Servidor | **O servidor continua recusando o que o app só sinaliza.** Lotes enviados direto à API, sem passar pelo app: Arete 3 → 4 (`hard-cap`) → 422 `CREATION_BUDGET_EXCEEDED` com `CREATION_HARD_CAP`; `app` acima de 0 com `lineage` `c` → `CREATION_LOCKED`; saldo excedido pelo narrador → `CREATION_FREEBIES_EXCEEDED`; nenhum aplicado. E o 4º ponto de `alert` com saldo **passa** (a trava de Básicos é só do app, plano-v4 §3.1) | `apps/api/src/__tests__/creation.test.ts`, no `describe('/events: avaliação parcial')` (l.260) | Bun + PGLite |
| Desempenho | Em Criação, um ponto em Força não re-renderiza as linhas das Habilidades (a previsão delas não mudou) | `apps/frontend/sheet/__tests__/renderCount.test.tsx` | Jest |

### 4.2 Testes existentes que mudam junto

| Arquivo | Linha | O quê | Por quê |
|---|---|---|---|
| `apps/frontend/sheet/creation/__tests__/creationStore.test.ts` | 92–103, 116–123, 139–142 | Mensagens: prioridade com o grupo; Básicos com o preço; saldo com "Faltaria". Os casos passam a conferir também o `notice` do store | T-07, T-57, T-55 |
| `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | 179 | "Prioridades salvas" vira o texto do R-28 | R-28 |
| `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | 220–224 | Texto de Básicos com "(5 por ponto)" | T-07 |
| `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | 236–238 | "Bônus: 10 de 15 restantes." → "Bônus: restam 10 de 15." | T-18 |
| `apps/frontend/sheet/creation/__tests__/creation.test.ts` | 85+ | `counterText` com a fase | R-17 |
| `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx` | 233, 380 | Continuam achando o texto ("Digite um número…", "Informe o nome"). Só a posição muda (coluna do rótulo); conferir se algum caso mede a ordem dos filhos do `EditorShell` | T-20 |

Ficam verdes sem mudança:

- os `getByRole('button', { name: 'Aumentar X', exact: true })` de `e2e/tests/journey*.spec.ts`, `draft.spec.ts`, `evolve.spec.ts` e `conflict.spec.ts` (o nome do "+" não muda);
- `create-character.spec.ts:67` (o `role=alert` com "Informe o nome" continua);
- os `toMatchObject` do core (campos novos são aditivos);
- o `components.test.tsx` do `@tms/ui` (o `Stepper` sem `increase` é o de hoje).

### 4.3 Suítes do "PR local" e metas de cobertura

```bash
npx pnpm -C packages/sheet-core build        # o Metro lê o src (S-01); a API e as migrations, o dist
npx pnpm turbo run typecheck lint --filter=@tms/sheet-core --filter=@tms/ui --filter=frontend --filter=@tms/api --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=@tms/sheet-core --filter=@tms/ui --filter=frontend --filter=@tms/api
```

**Metas que o CI aplica** (`.github/workflows/ci.yml:105`, `test:coverage`):

| Pacote | Meta | Atenção neste pacote |
|---|---|---|
| `@tms/sheet-core` | `packages/sheet-core/bunfig.toml`: 95% de linhas e funções, conferido **por arquivo** (a lição da onda 1) | Os campos novos de `creation.ts` (`cap`, `ceiling`, `locked`, `price`, `components`) precisam de caso no Bun, inclusive o `ceiling` com `{ field }` e o `credit` sem `price` |
| `@tms/ui` | `packages/ui/jest.config.js`: 80% de linhas, funções, ramos e comandos | Os ramos `web` e app do `increase` no `Stepper`, com `Platform.OS` trocado (padrão de `components.test.tsx:411–436`) |
| frontend | `apps/frontend/jest.config.js`: 70/70/60/70 no global e 80/80/70/80 em `./sheet/` | `DraftNoticeText.tsx` e `useOpenBudget` (novos) e cada `RefusalCause` do `draftRefusal`/`stepAdvice`. O `new-character.tsx` está no global (`app/**`) |
| `@tms/api` | `apps/api/bunfig.toml`: 85% | Só ganha teste; nenhuma linha de produto |

### 4.4 E2E (roda na integração da onda: portas fixas, um por vez)

Spec novo: **`e2e/tests/creation-feedback.spec.ts`**, com `test.use({ viewport: { width: 390, height: 844 } })`, Chromium e WebKit, numa crônica `vtm-v20` no padrão do template (por pontos, aprovação desligada). As abas da ficha a 390 px:

- zonas: `getByRole('tab', { name: 'Ficha', exact: true })` e `getByRole('tab', { name: 'Orçamento', exact: true })`;
- grupos de Atributos e de Habilidades, que a 390 px viram abas (`groupTabs.tsx:27–31`): `getByRole('tab', { name: 'Físicos' | 'Mentais' | 'Talentos', exact: true })`, como no `conflict.spec.ts:43`.

| Teste | Passos e seletores exatos | Itens |
|---|---|---|
| "Nova ficha: Criar ficha leva ao nome" | `page.goto('/chronicles/<id>/new-character')` → `getByRole('button', { name: 'Criar ficha' }).click()` (o Playwright rola até ele) → `expect(getByLabel('Nome (obrigatório)')).toBeFocused()` e `.toBeInViewport()`; `getByRole('alert')` com "Informe o nome" | T-21 |
| "Pontos básicos: motivo certo, ao lado do toque, e some com a causa" | Cria "Isadora Vex" (Tremere) → URL `?mode=create`. `getByRole('button', { name: 'Aumentar Força', exact: true }).click()` sem prioridade → `getByTestId('notice-strength')` visível → `getByRole('radio', { name: 'Físicos, Primária, 7 pontos', exact: true }).click()` → toast `getByText(/Sociais ficou Secundária \(5\)/)` → `expect(getByTestId('notice-strength')).toHaveCount(0)`. Aba Mentais (Terciária, 3): 3× "Aumentar Raciocínio" → o "+" `toHaveAttribute('aria-disabled', 'true')` → clique → `getByTestId('notice-wits')` `toBeInViewport()` e com "Mentais: os 3 pontos básicos". Aba Talentos: `getByRole('radio', { name: 'Talentos, Primária, 13 pontos', exact: true })`, 3× "Aumentar Prontidão", 4º clique → `getByTestId('notice-alertness')` com "vai até 3" e **sem** "já foram usados"; `getByTestId('counter-talents')` com "3/13" | T-07, T-20, T-55, R-28 |
| "Bônus: saldo, custo, extrato e sobra" | Ficha preparada pela API, como no `conflict.spec.ts:34–40`: prioridades por `PATCH /characters/:id/creation` e quase todos os básicos por `POST /characters/:id/events`. Na UI, o último básico → "Começaram os pontos de bônus" → `getByRole('button', { name: 'Entendi' })`. A barra com `getByText(/Bônus: restam 15 de 15/)`. Aba Orçamento: `getByTestId('creation-ready')` com "restam 15 de bônus". O `getByTestId('creation-action')` com "Concluir criação" → clique → texto "Sobram 15 pontos de bônus. Eles não viram XP." → `getByRole('button', { name: 'Voltar' })`. Depois, gastar 14 pela API, recarregar e clicar no "+" de Briga (custo 2) → `getByTestId('notice-brawl')` com "Faltaria 1 de bônus: custa 2, restam 1." Aba Orçamento: `getByTestId('creation-ledger')` com "Talentos" e "Força de Vontade" | T-18, T-57, R-17 |

Nenhum spec existente muda (seção 4.2).

---

## 5. Segurança

Sem rota nova, sem mudança de AuthZ e sem dado novo no servidor. Pela matriz ("Como executar", passo 4), o pacote passa por `/code-review`. O `/security-review` não é exigido: o pacote não toca em API, sessão nem armazenamento.

| O que pode dar errado | Como o desenho evita |
|---|---|
| O app passar a decidir o que a conta aceita | O "+" com cara de bloqueado, a previsão e o aviso são só UX. O `/events` repete o `checkCreationBatch` com as escolhas do servidor, sob a trava da ficha (`events.ts:253–266`). Concluir e aprovar repetem o `completionRefusal` (`creation.ts:622–625`, `:717–720`). O teste novo da API (seção 4.1, "Servidor") prova que `hard-cap`, baseline travado e saldo são recusados mesmo vindos direto, sem o app |
| A previsão errar e liberar algo | A previsão só muda a aparência. O toque passa pelo `draftRefusal` (a conta exata, com descontos) e, no "Salvar", pelo `checkCreationBatch` local (`sheetStore.ts:430–445`) e pelo do servidor. Errar para o lado "bloqueado" não tranca nada (o "+" continua tocável); errar para o lado "liberado" cai na recusa de sempre |
| Burlar a fase "Pontos básicos" | É trava só do app desde a v4 (plano-v4 §3.1; `creation.ts:232–237`): gastar bônus vale no servidor. Nada muda. O teste da API documenta isso (o 4º ponto de `alert` com saldo passa) |
| Texto da ficha em aviso, toast ou anúncio do leitor de tela | Os textos novos usam só rótulos do template e números da conta, como o `problemText` já faz ("nunca texto da ficha", `creation.ts:157`). O extrato mostra contagem de itens de `item-meta`, não o nome. Nenhum `console.*` novo com valor de campo |
| Rótulo do template hostil na mensagem | Os rótulos passam pelo `validateTemplate` antes da publicação (40 caracteres em grupo e orçamento, `sheet-core/src/validate/accounting.ts:280`, `:303`) e são desenhados como `Text` do React Native (no web, nó de texto, sem HTML) |
| Campo novo na resposta da API | O `PATCH /characters/:id/creation` já devolve a `check` inteira ao dono e ao narrador (`creation.ts:543–547`). Os campos novos (`cap`, `ceiling`, `locked`, `price`, `components` da linha) são números do template e valores que a `check` já carregava nos `components` dos grupos. Nada novo chega a `viewer` nem a quem não lê a ficha |
| Nova ficha enviar o inválido | Continua sem requisição com erro local (`CharacterForm.tsx:93`). O servidor valida de novo (`validateSheet`, `apps/api/src/sheets/routes.ts:184`) |
| Foco ou rolagem expondo outro campo | Só rola e foca dentro da própria tela. Nenhuma navegação, nenhuma URL com valor (o checklist proíbe dado em query parameter) |

**Checklist da organização (Flutter/Node adaptado ao stack):**

- nada sensível passa a ser guardado (o aviso vive em memória, no store);
- nenhum dado em log;
- validação no servidor intacta;
- *fail secure*: na dúvida, a previsão cede à conta exata, e a conta exata, ao servidor.

---

## 6. Como generaliza além do WoD

- **Os motivos de recusa** saem das regras do contrato (`creation-cap`, `hard-cap`, `baselines`, `costs.freebie`, `point-buy`), não de nomes de campo. "Prontidão: com pontos básicos, vai até 3" é o `creation-cap` de qualquer sistema. No D&D 5e (`design/templates/dnd5e-2014.json`, point-buy de 27 com tabela), o "+" de um atributo em 15 aparece bloqueado (`ceiling`, fim da tabela), e o de 13 para 14 diz o degrau da tabela (2). É o "teto por atributo e orçamento total" que o EW-04 compara.
- **O saldo, a sobra e o extrato** aparecem só quando o template tem `freebies` ou `costs.freebie` (`hasFreebies`, `sheet-core/src/creation.ts:696`). O D&D não tem bônus: nada de "bônus" na tela, e o extrato não aparece. O Call of Cthulhu 7e e o Fate Core não têm `creation`: o `stepAdvice` devolve `null`, e nada muda nas fichas deles.
- **O valor de partida derivado** ("parte de 4, da Coragem") lê o `from` de qualquer fórmula de `default` do template (`{ derive, from }` ou `{ from, map }`). No CoC, Esquivar começa em DES/2 pelo mesmo mecanismo.
- **O aviso de prioridade** vale para qualquer `priority-budget`, com os rótulos e os orçamentos do template e os ordinais genéricos do `RANKS`.
- **O aviso no store** é por caminho (`values.<campo>`, `values.<lista>#<item>`). Não conhece tipo nem sistema: serve ao −/+ de um atributo, ao item de uma lista e ao "Aplicar" de uma folha (P07-C).
- **"Criar ficha" leva ao erro** em qualquer formulário de identidade gerado do template.
- **Limite conhecido:** o nome "pontos de bônus" é fixo no app (seção 2, item 4; pergunta 4).

---

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado.** Arquivos e linhas conferidos neste documento, as decisões da seção 2 respeitadas e os pontos que não se aplicam como escritos apontados, sem decisão.
2. **Typecheck, lint e testes** de `@tms/sheet-core`, `@tms/ui`, frontend e `@tms/api`, com as metas de cobertura (seção 4.3). O `@tms/sheet-core` é reconstruído antes do typecheck da API.
3. **Um teste de regressão por item** (seção 4.1), falhando no `9f75426`, mais o teste da API que prova a recusa no servidor.
4. **`/code-review`** no diff do pacote.
5. **O cenário de cada persona, repetido sem o defeito**, com a API local e o seed do roteiro (`npx pnpm seed:roteiro`: contas fictícias `roteiro_*`; crônicas "Vampiro v4 · …", "Mago v4 · …" e "Lobisomem v4 · …", por pontos, com a aprovação desligada). Para o "Enviar para aprovação", o narrador liga a aprovação numa crônica v4.

| Item | Notas | Cenário | Plataforma | Esperado agora |
|---|---|---|---|---|
| T-07 | EW-04, IW-03 | Vampiro v4: Perícias (ou Talentos) Primária 13 → "+" 4× em Furtividade (ou Prontidão) | web 390 | No 3, o "+" fica com cara de indisponível; o toque mostra "Furtividade: com pontos básicos, vai até 3. Acima disso, cada ponto custa 2 de bônus." ao lado da linha, com "Ver orçamento"; o contador continua 3/13 |
| T-07 | EA-05, POA-14 | Talentos 13 → "+" 4× em Prontidão; Lobisomem v4 também; PO: Ofícios em 3 com Perícias 3/9 | Android, iOS | O mesmo, com o TalkBack ou o VoiceOver lendo o motivo como dica do controle |
| T-20 | QAW-23 | Mentais 7/7 → "+" em Raciocínio | web 390 | O "+" com cara de indisponível e o aviso dentro da tela, ao lado do "+" |
| T-20 | IA-10 | Físicos 7/7 → "+" | iOS | O aviso na altura do toque, não no pé da tela |
| T-20 | EW-27, EA-16 | Nosferatu → "+" em Aparência | web 390, Android | O "+" bloqueado; "Aparência: fica em 0 na criação (Clã: Nosferatu)." |
| T-55 | POW-24, IW-09 | "+" sem prioridade → escolher a prioridade | web 1280, web 390 | O aviso some ao escolher |
| T-55 | POA-12, IA-11 | Mago v4: Forças acima do Arete → subir o Arete (4 de bônus) | iOS | "Forças: na criação, vai até 1." some quando o Arete sobe |
| T-55 | EW-14, EA-16 | Provocar um bloqueio e seguir preenchendo | web 390, Android | O aviso some no próximo toque aceito |
| T-57 | QAW-27 | Saldo 1 → "+" em Briga (custo 2) | web 390 | "Faltaria 1 de bônus: custa 2, restam 1." |
| T-18 | EW-07, EA-07, IW-10 | Distribuir todos os básicos → Orçamento | web 390, Android | "Pontos básicos completos; restam 15 de bônus"; a barra diz "Bônus: restam 15 de 15" |
| T-18 | POA-17, IA-08 | Concluir com 2 (ou 9) de bônus sobrando | iOS | A confirmação diz "Sobram 2 pontos de bônus. Eles não viram XP." e deixa concluir |
| T-18 | POW-10, QAA-06 | "Enviar para aprovação" com 4 (ou 10) sobrando | web 1280, iOS | O mesmo aviso na confirmação de enviar |
| R-17 | IW-10, IA-12 | Fase de bônus: "+" em Força, FdV, Humanidade e Coragem, com a FdV comprada antes | web 390, iOS | Custo visto antes (cabeçalho "+1 = 5 bônus"; na linha da FdV, "+1 = 1"); o extrato mostra a FdV com "parte de N, da Coragem" e explica o desconto |
| R-17 | EW-17, NW-22 | Gastar bônus em vários grupos → Orçamento | web 390 e 1280 | "Onde foram os bônus" com cada fonte e o total igual ao saldo |
| R-28 | POA-13, EA-15, IA-19 | Físicos = 7 (ou Terciária) sem ordem salva | iOS, Android | Toast "Prioridades salvas. Sociais ficou Secundária (5) e Mentais, Terciária (3): toque no grupo para trocar." |
| T-21 | QAA-09, POA-11, IA-10 | Nova ficha → rolar até o fim → "Criar ficha" sem nome | iOS, Android | A tela rola até o Nome, o campo recebe o foco (teclado aberto) e "Informe o nome" fica visível |
| T-21 | IW-15, QAW-14 | O mesmo | web 390 | Foco no Nome, dentro da vista |

   O critério de saída da onda pede os cenários do Iniciante e do Experiente, app e web. Neste pacote, são as linhas EW, EA, IW e IA acima.

6. **Conferência no aparelho** (o pacote é visível e muda o `@tms/ui`), com o dev build da integração da onda 1:
   - **AVD Android em 360, 393 e 411 dp** (Pixel 3a, com o tamanho de tela trocado por `adb shell wm size`/`density`):
     - o aviso na coluna do rótulo cabe a 360 dp sem empurrar o "+" para fora; a linha cresce para baixo;
     - o "+" bloqueado tem a opacidade certa e continua com 48 dp;
     - o contador "13/13 · +2 bônus · +1 = 2 bônus" quebra sem cortar ao lado dos chips de prioridade;
     - a rolagem do T-21 funciona com o teclado aberto (o `KeyboardAvoidingView` da Nova ficha não age no Android; o Nome fica no topo e visível).
   - **Simulador iOS** (iPhone SE e um de 402 pt): os mesmos pontos, e o VoiceOver lendo a dica do controle ajustável.
   - **Web em 390 e 1280:** o E2E cobre a 390. A 1280, conferir à mão o extrato e o contador nas três colunas de Atributos.
   - **API local e seed do roteiro**, só com as contas fictícias do seed. Nenhum dado real.
7. **Resumo para a seção do pacote no PR da onda:** o que mudou, como foi testado e os achados da revisão.

---

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

| # | Commit | Itens | Esforço |
|---|---|---|---|
| 1 | `test(api): o servidor recusa o que o app só sinaliza na criação por pontos` | guarda | P |
| 2 | `feat(core): teto, limite e trava por componente e preço da linha de bônus na conta` | T-07, T-20, R-17 | P |
| 3 | `fix(app): recusa da criação com o motivo certo: teto, orçamento do grupo e saldo` | T-07, T-57 | P |
| 4 | `fix(app): aviso da recusa no store, ao lado do toque, que some quando a causa some` | T-55, T-20 | M |
| 5 | `feat(ui): Stepper com "+" indisponível e dica, sem tirar o toque` | T-20 | P |
| 6 | `fix(app): "+" com cara de bloqueado e custo antes do toque na criação` | T-20, R-17 | M |
| 7 | `fix(app): bônus que sobram no Orçamento, na barra e na confirmação` | T-18 | P |
| 8 | `feat(app): extrato dos pontos de bônus no Orçamento` | R-17 | M |
| 9 | `fix(app): aviso das prioridades marcadas automaticamente` | R-28 | P |
| 10 | `fix(app,ui): Criar ficha rola e foca o primeiro campo inválido` | T-21 | P |
| 11 | `test(e2e): feedback da conta na criação por pontos a 390 px` | todos | P |

**Por que esta ordem:**

- **O teste da API vem primeiro** e passa antes e depois. Ele fixa o comportamento do servidor que o resto do pacote não pode mudar.
- **O core (2) vem antes do app.** O Metro e o Jest leem o `src` (S-01), mas a API e o typecheck dela leem o `dist`: reconstruir o `@tms/sheet-core` depois do commit 2.
- **A recusa estruturada (3) vem antes do aviso no store (4)**, que guarda o `CreationNotice`. O aviso vem antes do `Stepper` (5) e da previsão (6), que apontam para ele (`hintID`).
- **O T-18 (7) entra depois que o P04-C está na onda** (seção 8.4): a linha da sobra vai na confirmação unificada do T-32.
- **O extrato (8) é o commit que sai sozinho** se a onda precisar cortar. Sem ele, o custo antes continua (6) e o saldo também (7).
- **O T-21 (10) fica por último no código** porque mexe no `new-character.tsx`, que o P04-C (T-29) também toca, e assim o rebase é menor.

### 8.2 Esforço

**G**, cerca de 8 a 10 dias, em 11 commits (7 P e 4 M). A matriz soma 4 P e 4 M. A diferença vem do que o código mostrou:

- o aviso precisa morar no store e ser reavaliado (hoje é estado local de cada linha), com a assinatura por campo preservada;
- a previsão do "+" é uma função nova com uma regra por motivo, inclusive o point-buy;
- o core precisa expor o teto e o preço das linhas, com 95% de cobertura por arquivo;
- o extrato tem quatro tipos de fonte;
- a conferência nativa do `Stepper` (a lição do S-01).

**Sem o extrato (commit 8), fica M** (6 a 7 dias).

### 8.3 Riscos

- **Re-renderização.** O aviso e a previsão por linha não podem fazer todas as linhas re-renderizarem a cada ponto. Os seletores devolvem primitivos ou têm igualdade rasa, e o `renderCount.test.tsx` ganha o caso da Criação (seção 4.1). Na fase de bônus, mudar o saldo pode mudar a previsão de várias linhas ao mesmo tempo: é o esperado, e o teste mede só a fase de básicos.
- **A previsão diverge da conta exata** nos descontos derivados (Coragem × FdV). O "+" tocável e o extrato tornam a divergência inofensiva e explicada. A pergunta 2 mede se vale calcular exato.
- **Altura das linhas a 360 dp.** O aviso na coluna do rótulo, com o "+" ao lado, pode ocupar 4 a 5 linhas de texto. A linha cresce para baixo, e o começo do texto fica no `y` do toque. Conferir no AVD (seção 7).
- **O `@tms/ui` no nativo.** O estilo do "+" bloqueado só se prova no emulador (lição do S-01, `b75a744`). O Jest e o web não mostram o defeito do JSX.
- **A confirmação do P04-C.** Se o T-32 entrar com outra forma, o commit 7 se ajusta. A função `freebiesLeftText` e o teste dela não dependem disso.
- **Textos asserted em testes** (seção 4.2): mudam junto, no mesmo commit de cada item.
- **O toast do R-28 é longo** a 390 px. O `Toast` quebra linha, mas fica na tela pelo tempo padrão (mais com leitor de tela, `Toast.tsx:85–86`). Ver a pergunta 6.

### 8.4 Conflitos com os pacotes da onda

**Ordem de merge proposta: P04-C → P05-C → P07-C → P08**, a mesma da proposta preliminar. O código confirma:

- o T-18 depende da confirmação unificada do T-32 (P04-C);
- o T-21 encosta no texto de topo do T-29 (P04-C), no mesmo `new-character.tsx`;
- o P07-C consome o mecanismo da seção 3.0;
- o P08 reorganiza o layout (barra, abas, cabeçalho) por cima de tudo e confere o aviso e o "+" bloqueado no lugar novo.

| Arquivo | Pacotes | Onde cada um mexe | Risco | Como integrar |
|---|---|---|---|---|
| `apps/frontend/sheet/creation/creation.ts` | P05-C, P07-C | P05-C: `draftRefusal` (`:225–287`) reescrito com `CreationNotice`; `stepAdvice`, `freebieLedger`, `freebiesLeftText`, `priorityNote` e `counterText(g, phase)` novos. P07-C (T-19): consome; se precisar de motivo novo, acrescenta um caso | **Alto** se o P07-C reescrever o `draftRefusal` | P05-C antes. O P07-C acrescenta casos ao `RefusalCause` e ao texto, sem mudar a assinatura |
| `apps/frontend/sheet/store/sheetStore.ts` | P05-C (P07-C só lê) | `notice`, `clearNotice`, a reavaliação (`api.subscribe`), o `editDraft` (`:486–537`) e as ações que limpam (`:784–881`) | Baixo | O P07-C usa `useDraftNotice`; não guarda erro na folha |
| `apps/frontend/sheet/evolve/hooks.ts` | P05-C, P07-C | P05-C: `useDraftNotice` novo; `useSetDraft` igual (`:78–90`) | Baixo | — |
| `apps/frontend/sheet/evolve/ListEditor.tsx` | P07-C | O P05-C **não** toca: o erro local (`:60`, `:66–67`, `:108–117`) é migrado pelo P07-C (T-19) | — | O P07-C troca o `useState` por `useDraftNotice` e põe o `DraftNoticeText` dentro das folhas |
| `packages/sheet-core/src/creation.ts` | P05-C | P05-C: `CreationComponent` (`:97–105`), `FreebieLine` (`:138–146`), `add` (`:354–392`), linhas `flat` (`:624–645`). O P07-C não muda este arquivo: o T-23 é no app (`ListEditor.tsx:70-79`), e no core entram só testes (plano do P07-C, §3.2) | Baixo | O P05-C é o único a mudar o core na onda: reconstruir o `dist` depois do merge dele |
| `apps/frontend/sheet/creation/CreationCounter.tsx` | P05-C, P07-C (T-58) | P05-C: o contador com a fase (`:41–56`). P07-C: um título e um contador por seção (T-58), que pode passar por aqui ou pelo `ListHeader` | Médio | P05-C antes. O P07-C mantém o `counterText(g, phase)` |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | P04-C, P05-C | P04-C (T-06): a faixa "O narrador devolveu a ficha" sai do `CreationAlerts` (`:135–161`) para valer em qualquer modo. P05-C: `useFreebiesText` (`:59–68`), saldo e "A conta fechou" (`:199–230`), extrato novo abaixo do saldo. O formulário de devolução do P03-C (`CreationStatusPanel`, `:306–317`) não é tocado | Baixo | Trechos diferentes. P04-C antes |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | P04-C, P05-C, P08 | P04-C (T-32): a confirmação de concluir, provavelmente extraída do `SummarySheet` (`:330–443`). P05-C: a linha da sobra na confirmação (`:390–397`) e o texto do saldo (`:78`, `:190`). P08 (T-27): abas e contador fixos junto da barra (`EvolveBar`, `:279–328`) | **Médio** | Acordo da seção 3.4: a confirmação do P04-C aceita `notes`. O P08 mantém o `detail` do `EvolveBar` (o texto do saldo na barra) |
| `apps/frontend/sheet/storyteller/StatusMenu.tsx` | P04-C, P05-C, P08 | P04-C (T-32): a confirmação de "Concluir criação" (`:73–80`). P05-C: só preenche `notes`, com o número vindo do `onDraftState`. P08 (T-11): leva o menu para o "Mais opções" | Baixo | Depois do P04-C |
| `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx` | P04-C, P05-C | P04-C (T-29): o texto de topo com o modo e o orçamento (`:87–91`). P05-C (T-21): `ref` do `ScrollView` (`:83–86`), o `View` em volta do `CharacterForm` e o `onInvalid` (`:92–123`). Por cima da onda 1: a trava do T-02, o `created` do T-56 e o "Ficha criada." do L-03 (`:46–54`, `:102–121`) ficam | **Médio** (linhas vizinhas) | P04-C antes. O T-21 é o último commit de código do P05-C |
| `apps/frontend/sheet/CharacterForm.tsx` | P05-C (P04-C, se o T-29 descer para o formulário) | P05-C: `onLayout` das linhas, `ref` dos campos, `onInvalid` (`:48–126`). A onda 1 deixou o `onDirtyChange` (P03-C, `:61–65`) e o `properName` (P06, `:112`), que ficam | Baixo | — |
| `apps/frontend/sheet/evolve/EditorShell.tsx` | P05-C | O `error` sobe para a coluna do rótulo (`:29–44`) | Baixo | O P08 confere a linha nova no layout dele |
| `apps/frontend/sheet/evolve/NumberEditorRow.tsx` | P05-C, P08 (T-26) | P05-C: estado de erro (`:63`, `:96`), `EditorShell` (`:149–153`), `Stepper` com `increase` (`:221–231`). P08 (T-26): o campo numérico atrás do teclado (o `TextInput` do "Digitar", `:184–219`) | Baixo | Trechos diferentes |
| `apps/frontend/sheet/SheetView.tsx` | P05-C, P08 | P05-C: o provedor do `useOpenBudget` (`:168–169`). P08: abas fixas (T-27, `:201–211`), bloco "Em jogo" (T-59, `:191–200`) e a rolagem (`:172–175`) | Baixo | O P08 mantém o provedor em volta do conteúdo |
| `packages/ui/src/Stepper.tsx` | P05-C | `increase` (`:21–41`, `:114–141`, `:143–162`) | Baixo | Construído sobre o P06 (`showLabel`, `aria-valuetext`, `valueNativeID`, `hitTarget()`) |
| `packages/ui/src/TextField.tsx` | P05-C, P08 (T-64) | P05-C: `ref` na interface (`:8–17`). P08 (T-64): o contador em linha própria (`:63–84`) | Baixo | Trechos diferentes |
| `apps/api/src/__tests__/creation.test.ts` | P04-C, P05-C | P04-C (T-80, T-32): casos em "concluir, aprovar e devolver" (`:298+`). P05-C: um caso em "/events: avaliação parcial" (`:260–296`) | Baixo | Blocos `describe` diferentes |
| `e2e/tests/creation-feedback.spec.ts` (novo) | P05-C | — | — | O P08 roda depois com o cabeçalho novo; os seletores são por papel e `testID`, não por posição |

### 8.5 Arquivos tocados

| Arquivo | Itens | Tipo de mudança |
|---|---|---|
| `packages/sheet-core/src/creation.ts` | T-07, T-20, R-17 | alterado (campos aditivos em `CreationComponent` e `FreebieLine`) |
| `packages/sheet-core/src/__tests__/creation.test.ts` | T-07, R-17 | alterado (casos novos) |
| `packages/ui/src/Stepper.tsx` | T-20 | alterado (`increase`) |
| `packages/ui/src/TextField.tsx` | T-21 | alterado (`ref`) |
| `packages/ui/src/a11y.test.tsx` | T-20, T-21 | alterado (casos novos) |
| `apps/frontend/sheet/creation/creation.ts` | T-07, T-57, T-20, T-18, R-17, R-28 | alterado (`CreationNotice`, `stepAdvice`, `freebieLedger`, `freebiesLeftText`, `priorityNote`, `counterText`) |
| `apps/frontend/sheet/creation/useStepAdvice.ts` | T-20, R-17 | novo |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | T-18, R-17 | alterado (textos do saldo, extrato) |
| `apps/frontend/sheet/creation/CreationCounter.tsx` | R-17 | alterado (custo na fase de bônus) |
| `apps/frontend/sheet/creation/usePriorityChoice.ts` | R-28 | alterado (toast com `priorityNote`) |
| `apps/frontend/sheet/store/sheetStore.ts` | T-55, T-20 | alterado (`notice`, reavaliação, limpeza) |
| `apps/frontend/sheet/evolve/hooks.ts` | T-55 | alterado (`useDraftNotice`) |
| `apps/frontend/sheet/evolve/DraftNoticeText.tsx` | T-20, T-55 | novo |
| `apps/frontend/sheet/evolve/EditorShell.tsx` | T-20 | alterado (erro na coluna do rótulo) |
| `apps/frontend/sheet/evolve/NumberEditorRow.tsx` | T-20, T-55, R-17 | alterado |
| `apps/frontend/sheet/evolve/ResourceEditorRow.tsx` | T-20, T-55, R-17 | alterado |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | T-18 | alterado (a linha da sobra em `notes`, depois do P04-C) |
| `apps/frontend/sheet/storyteller/StatusMenu.tsx` | T-18 | alterado (preenche `notes`, depois do P04-C) |
| `apps/frontend/sheet/SheetScreen.tsx` | T-18 | alterado (`freebiesLeft` no `onDraftState` do P04-C) |
| `apps/frontend/sheet/SheetView.tsx` | T-07 | alterado (provedor do `useOpenBudget`) |
| `apps/frontend/sheet/CharacterForm.tsx` | T-21 | alterado |
| `apps/frontend/sheet/editors/types.ts`, `TextEditor.tsx` | T-21 | alterado (`inputRef`) |
| `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx` | T-21 | alterado (rolagem) |
| `apps/frontend/sheet/creation/__tests__/creation.test.ts`, `creationStore.test.ts`, `CreationScreen.test.tsx` | todos | alterado |
| `apps/frontend/sheet/__tests__/CharacterForm.test.tsx`, `storyteller.test.tsx`, `renderCount.test.tsx` | T-21, T-18, desempenho | alterado |
| `apps/api/src/__tests__/creation.test.ts` | guarda | alterado (caso novo) |
| `e2e/tests/creation-feedback.spec.ts` | todos | novo |

---

## 9. Perguntas abertas (técnicas)

1. **O "+" bloqueado tocável** (seção 2, item 1) passa na revisão de acessibilidade? O `aria-disabled` num botão que ainda responde é um padrão aceito: o leitor diz "indisponível" e lê o motivo como descrição, e o toque explica em vez de não fazer nada. Se o time preferir o `disabled` de verdade, a troca é uma prop no `Stepper`, mas aí a previsão precisa ser exata (pergunta 2).
2. **Previsão exata ou de tabela?** A exata custa um `checkCreation` por linha visível a cada mudança. O `checkCreation` já resolve a ficha várias vezes (`sheet-core/src/creation.ts:316–319`, `:679–694`). Proposta: medir no AVD Pixel 3a (o aparelho mais lento da conferência) o tempo de um `checkCreation` da V20. Se 30 deles couberem em ~16 ms, a previsão pode ser exata nas linhas da aba aberta. Até lá, fica a de tabela.
3. **Extrato na ficha concluída** (seção 2, item 2): exige gravar a conta na conclusão (API, banco, AuthZ de leitura). Se o PO quiser, o lugar técnico mais barato é o payload do evento "criação concluída" do Histórico (T-80, P04-C), com o mesmo filtro de leitura do Histórico. Não entra neste pacote.
4. **Rótulo do saldo no template** (`creation.freebiesLabel`, por exemplo): é mudança de contrato (`validateTemplate`, README §14, os três templates WoD). Deixar para quando houver um sistema com outro nome para o saldo?
5. **Quando o aviso some.** O desenho apaga o aviso no próximo toque aceito em qualquer campo (é resposta a um toque), além de quando a causa some. A alternativa é mantê-lo enquanto a causa valer, o que o EA-16 e o EW-14 leem como ruído. Confirmar.
6. **R-28 em toast ou numa linha sob os chips?** O toast some sozinho; uma linha fixa ocuparia altura a 390 px (T-27). O desenho usa o toast, com o anúncio do leitor de tela.
7. **`stepAdvice` no core?** Está no app porque é UX. Se a Mesa do narrador (D-10, P09-D: "Habilidades: faltam 4 · Bônus: restam 2 de 15") precisar do mesmo cálculo no servidor ou noutra tela, a função sobe para o `@tms/sheet-core`, com a meta de 95% por arquivo.
8. **Forma da confirmação do P04-C (T-32):** resolvida na consolidação ([onda-2.md](onda-2.md) §4.1): `notes?: readonly string[]`, a forma do P04-C, e o número do menu do narrador pelo `onDraftState`.

---

## 10. Desvios na implementação

Implementado na `pacote/p05-c-feedback-conta`, sobre `fc2649c`, em paralelo com o P04-C. O que saiu diferente do desenho acima, e por quê:

1. **O commit 7 (T-18) virou dois.** O `fix(app): bônus que sobram no Orçamento e na barra` entrou agora: os textos do Orçamento e da barra e o `freebiesLeftText(check)`, com teste. A linha da sobra nas três confirmações (`notes` do `completionCopy`) e o `freebiesLeft` no `onDraftState` dependem do P04-C, e entram num commit próprio depois da onda receber o P04-C. Até lá, o E2E não confere a confirmação, e o teste do narrador em `storyteller.test.tsx` fica para esse commit.
2. **`ref` do `TextField`: `Ref<TextInputInstance>`, não `Ref<TextInput>`.** No React Native 0.88, `TextInput` é o componente, e o tipo da instância é o `TextInputInstance` exportado por `react-native`. O mesmo vale para o `EditorProps.inputRef`. O P08 (T-26) precisa usar o mesmo tipo, para o rebase sair sem conflito de fato.
3. **O "Ver orçamento" chega pelo `SheetProvider`.** O `OpenBudgetContext` mora em `creation/CreationContext.tsx`, e o `SheetProvider` ganhou a prop `openBudget`. Assim, o `SheetView` muda uma linha, em vez de embrulhar a árvore inteira num provedor novo, o que reindentaria o arquivo que o P08 reorganiza.
4. **O `aria-disabled` do "+" no web vai pelo `accessibilityDisabled`.** O `Pressable` do react-native-web 0.21 escreve `aria-disabled` a partir do `disabled` depois das outras props, e apagaria o nosso. O `accessibilityDisabled` chega ao DOM como `aria-disabled="true"` (createDOMProps) sem tirar o toque nem o foco. No app, os botões continuam fora do leitor de tela, e a trava vai na dica do controle ajustável.
5. **`StepAdvice` ganhou `inline`** (o texto aparece escrito na linha, porque o cabeçalho não o diz), e o `stepAdvice` aceita a ficha resolvida (opcional) para dizer a escolha que trava o valor ("Clã: Nosferatu"). Os textos da previsão não repetem o nome do campo, que já está no rótulo da linha: "Com pontos básicos, vai até 3. Acima disso, +1 = 2 bônus.", "Fica em 0 na criação (Clã: Nosferatu).", "Na criação, vai até 3.", "+1 = 5 bônus; restam 4.". O point-buy diz "+1 = 2 pontos" e, sem orçamento, "+1 = 2 pontos; faltam 1 de 27.".
6. **Concordância.** "Faltaria 1 de bônus: custa 2, **resta** 1." (o plano escrevia "restam 1"); "Faltariam N" no plural. O E2E confere a forma nova.
7. **A partida derivada no extrato é neutra em gênero:** "parte de 3, que vem de Coragem" (o plano escrevia "da Coragem"). O rótulo vem do template, e o app não sabe o gênero dele.
8. **O aviso no store cobre também a recusa do core e o rascunho grande demais** (`cause: 'invalid'` e `'limit'`), não só a conta. Na reavaliação, o `from` da tentativa é trocado pelo valor de agora; se o valor já é o pedido, o aviso some.
9. **O `EditorShell` só é usado pelas linhas de número e de recurso.** O texto, a escolha e a especialização mostram o erro dentro da folha, como antes. O `error` passou a aceitar um nó (o `DraftNoticeText`), e a linha ganhou o espaço `note` (o custo escrito) e o `testID` `<editor>-label` na coluna do rótulo.
10. **`testID` novos para os testes:** `form-row-<campos>` nas linhas do `CharacterForm` e `new-character-form` em volta dele; `advice-<campo>`, `notice-<campo>`, `notice-<campo>-budget`, `creation-ledger` e `creation-ledger-total`.
11. **O E2E de bônus foi dividido em dois testes**, com fichas preparadas pela API: os básicos completos ("restam 15 de 15") e o custo do toque com o extrato, que confere "Atributos › Físicos" e "Força de Vontade" (o plano citava "Talentos").
12. **A dica do custo no web** só vira `aria-describedby` quando o texto está escrito na tela (aviso ou custo na linha). O custo que só o cabeçalho diz fica no contador do grupo, que o leitor de tela já lê.
13. **`conditionHolds` passou a ser exportado pelo `@tms/sheet-core`** (aditivo), para o app dizer a escolha que trava um valor com o mesmo critério da conta.

### Revisão (`/code-review`, nível high)

Dez achados. Corrigidos em `fc2a51d`, `6df70ea`, `92a77d4` e `bd58730`:

- a previsão do point-buy abaixo da base, o texto do teto num grupo sem preço e a escolha que trava (agora `conditionHolds` sobre a ficha resolvida);
- o índice por conta na previsão (antes, cada linha varria a conta a cada mudança do store);
- a reavaliação do aviso, que agora compara causa e ação e não roda para `invalid` e `limit`;
- o bloco repetido das linhas (`useRowFeedback`) e o "resta/restam" num lugar só;
- o contexto do narrador fechado no E2E.

Ficaram, por desenho:

- **`freebiesLeftText` sem uso na tela.** É o item 1 acima: a ligação nas confirmações entra depois do P04-C.
- **O `creationRefusal` do "Salvar" some no primeiro toque aceito.** É o desenho da seção 3.0 (T-55: o aviso responde a um toque). A pergunta 5 da seção 9 continua aberta para o PO.
- **O aviso de uma recusa de lista, escolha ou texto fica guardado no store sem linha que o mostre.** Essas folhas mostram o próprio erro, como antes (seção 3.0, `useSetDraft` igual). O `ListEditor` passa a ler o aviso no P07-C. Para não custar nada enquanto isso, a recusa do core (`invalid`) não é reavaliada.
- **O caso da escolha "resolvida por padrão" não existe hoje:** o `choice` não tem `default` no contrato, e a ficha resolvida só tem o que foi gravado. O critério ficou igual ao da conta de qualquer jeito.
