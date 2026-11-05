# P05-D · Guia "O que falta" e fase de bônus: plano de implementação

> Plano · 2026-11-04 · base conferida: `onda/4-conteudo-guia` em `c96f2d4` (o código citado é o do `3cc07f1`: os PRs #48 e #49, que vieram depois, só mudam o CI, o CLAUDE.md, os `*.pg.test` e uma config temporária do E2E)

Este plano implementa o pacote [P05-D da matriz de achados](../testes/2026-11-01/matriz-achados.md#p05-d), da onda 4, que aplica a decisão D-05. Ao fim do pacote:

- a barra de criação diz o que falta ("Faltam: Virtudes 7 · Disciplinas 3"), e cada item leva ao grupo;
- a linha do próximo passo muda quando a conta fecha;
- a aba "Orçamento" passa a "Pontos", e o "Ver orçamento" passa junto;
- a escolha "Pontos básicos / Pontos de bônus" vira um indicador da fase, com a troca manual como opção secundária;
- a folha "Começaram os pontos de bônus" aparece só na primeira passagem de cada ficha.

É um pacote de decisão de produto, só de interface. Ele não remove campo, não muda regra do jogo e não afrouxa limite:

- a conta continua a do `checkCreation` do `@tms/sheet-core`, a mesma que o servidor repete a cada lote (`apps/api/src/sheets/events.ts`) e ao concluir (`completionRefusal`);
- o pacote não muda o `@tms/sheet-core`, a API nem os templates;
- o "Faltam" e o indicador de fase só mostram o que a conta já diz;
- a marca "a ficha já passou pela fase de bônus" fica no aparelho, por usuário, e não decide nada além de abrir ou não uma folha de aviso.

Todas as linhas citadas são do `3cc07f1`. A matriz cita o `1db3db9`, de antes das ondas 1 a 3. O que mudou desde então, e onde a causa provável da matriz está errada, está na §3.0, na §3.8 e na §7 do [onda-3.md](onda-3.md).

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md), "Decisões de produto" (D-05; D-07 e D-09 pelo ponto de extensão), "Como executar" e §P05-D | Itens, decisão, "PR local" e critério de saída da onda 4 |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §1 (C5), §4.1 (passo 8a), §8 ("O que sobra") e a recomendação R-18 | Causa, mapa da criação e o que sobra na tela sem plano |
| Notas: [iniciante-web](../testes/2026-11-01/notas/iniciante-web.md) (IW-05, l.85-88), [iniciante-app](../testes/2026-11-01/notas/iniciante-app.md) (IA-18, l.35-37, l.113), [po-app](../testes/2026-11-01/notas/po-app.md) (POA-15, l.45, l.88, l.252), [po-web](../testes/2026-11-01/notas/po-web.md) (l.52-53, l.121, l.124, l.271), [experiente-app](../testes/2026-11-01/notas/experiente-app.md) (l.40, l.103), [experiente-web](../testes/2026-11-01/notas/experiente-web.md) (l.65) | Cenários do critério de pronto (§7) e do roteiro manual (§11) |
| [plano-v4.md](../plano-v4.md) §1.4 e §1.5 | "Concluir com grupo incompleto": o TMS previne em vez de recusar (a D-13 alinha o plano à tela, no P01-D) |
| [P05-C](P05-C-feedback-conta.md) §2, §3.0, §3.2 e §10 | A recusa estruturada, o `stepAdvice` com caminho de item, o `markSoftDisabled` e a fronteira com a D-05 |
| [P03-D](P03-D-salvar-concluir.md) §3.0, §3.1, §3.4, pergunta 1 e §10 | O contrato `save`/`next`/`note` da barra e as larguras dos botões |
| [P04-D](P04-D-estado-proximo-passo.md) §3.3, §3.8 e §10 | O `nextStepCopy`, o `note` e os marcadores do `creation` (o modelo, se a marca da folha fosse ao servidor) |
| [P08](P08-layout-teclado.md) §3.11 e §3.12 | A faixa fixa com as abas (T-27), o "Ver orçamento" a um toque e o "Em jogo" recolhido (T-59) |
| [onda-2.md](onda-2.md) §6 e [onda-3.md](onda-3.md) §4.1, §4.6, §6, §8 e §11 | Pontos para o PO em aberto, a altura medida da barra, as folhas e o que só a integração pegou |
| `design/design-system/components.md`: ModeBar e SectionTabs | Onde o "Faltam" e a aba "Pontos" entram no DS |

## 1. Objetivo e itens

**Objetivo (matriz).** O que falta distribuir fica sempre à vista, com um nome de aba que o iniciante entende, e a fase de bônus é anunciada uma vez.

| ID | Sev. | Em uma linha | Onde está (conferido no `3cc07f1`) |
|---|---|---|---|
| R-18 | média | O "O que falta" fica na 4ª aba, chamada "Orçamento" (o iniciante leu "dinheiro"), e os itens não levam ao grupo | A aba: `sheet/SheetView.tsx:221` (rótulo), `:112` (id `creation`), `:212-214` (quando aparece). A lista: `sheet/creation/CreationPanel.tsx:229-252`, texto puro (`Text`), cortada em 12 (`:236`). A barra: `sheet/evolve/ModeBar.tsx:249-254` (`note`), `:285-316` (Criação) e `:419-492` (`EvolveBar`), sem resumo do que falta. A matriz cita `CreationPanel.tsx` l.212-215 (estimado): no `1db3db9`, era o texto da fase; o nome da aba nunca esteve no `CreationPanel` |
| U-07 | baixa | A folha "Começaram os pontos de bônus" reaparece (PO-A, iOS), e a escolha "Pontos básicos / Pontos de bônus" atrapalha um pouco, porque a folha já faz a troca (PO-W, web 1280) | A folha: `CreationPanel.tsx:289-344`, com a marca "já mostrei" num `useRef` (`:301`, `:311`), montada só com `budgetEdit` (`SheetView.tsx:212`, `:404-406`). A escolha: `RadioChips` em `CreationPanel.tsx:200-217`, com as fases em `:54-60`. A matriz cita l.46 e l.262-269 (estimado), do `1db3db9` |

**Também entram** as duas pendências que a onda 3 deixou para este pacote:

- **a pergunta 4 do [onda-3.md](onda-3.md) §8** (e a pergunta 1 do P03-D): "Concluir criação" escondido até a conta fechar, ou com `aria-disabled` e tocável, explicando o que falta. Na integração da onda 3, o botão ficou escondido (onda-3 §11, item 4). Tratada na §3.4;
- **o achado 3 do [onda-3.md](onda-3.md) §11:** a linha do próximo passo não muda quando a conta fecha. Tratado na §3.5.

## 2. Decisões aplicadas

| Decisão | O que diz (matriz) | Como o código acomoda |
|---|---|---|
| **D-05** (R-18, U-07) | Resumo "Faltam: …" na barra de criação, com itens tocáveis que levam ao grupo; a aba "Orçamento" passa a "Pontos"; a folha "Começaram os pontos de bônus" aparece só na primeira passagem de cada ficha; a alternância básicos/bônus vira indicador da fase, com a troca manual como opção secundária | Os itens saem dos `problems` do `checkCreation`, num arquivo novo do app (`sheet/creation/guide.ts`, §3.1). O "Faltam" ocupa a linha dos botões da barra, à esquerda do "Salvar", no lugar onde o "Concluir criação" vai aparecer (§3.3). O toque leva ao grupo pela aba, pela sub-aba e por uma âncora na seção (§3.2). A aba e o atalho mudam de nome juntos (§3.6). A fase vira texto, com um botão secundário (§3.7). A folha passa a depender de uma regra da conta mais uma marca no aparelho (§3.8) |
| **D-07 e D-09** (P07-D, ponto de extensão) | O Dom acima do nível 1 e a Disciplina fora do clã geram "confirme com o narrador" no "O que falta", sem bloquear | O item do guia tem um tipo `confirm`, que o P07-D preenche. Ele aparece separado do "falta", nunca conta no "Faltam", nunca esconde nem libera o "Concluir" e entra na confirmação de concluir (§3.9) |

**Fica fora deste pacote:**

- **O progresso da criação na Mesa e o Orçamento em leitura para o narrador, inclusive em `pending`,** são do P09-D (D-10, onda 5). O `guide.ts` é a peça que ele pode reaproveitar (pergunta 6 da §9).
- **O extrato da conta na ficha concluída (R-17)** segue como ponto do PO ([onda-2.md](onda-2.md) §6, ponto 6; P05-C §2, item 2).
- **Os planos alinhados com a tela,** incluindo a folha de bônus e o "O que falta" (D-13), são do P01-D (onda 5). Este pacote não mexe no `doc/plano-v4.md`.

**O que o código mostra que não se aplica como está escrito** (apontado, não decidido; vai para o PO na §9):

1. **"Só na primeira passagem de cada ficha" e o aparelho.** "Cada ficha" em qualquer aparelho exigiria guardar a marca no servidor. O plano define a primeira passagem pela conta ("nenhum ponto de bônus gasto, com a fase ainda nos básicos") e soma uma marca no aparelho (§3.8). Num aparelho novo, ou depois de sair da conta, a folha pode aparecer mais uma vez, e só se nenhum bônus tiver sido gasto.
2. **"Faltam: Virtudes 7, Disciplinas 3" no começo da ficha.** Antes da prioridade, o que falta é escolher a prioridade, e a conta não tem número para isso. Nesse caso, o item diz o grupo e "(prioridade)" (§3.1). Com a prioridade escolhida, os itens têm o número, como no exemplo da R-18.
3. **"Itens que levam ao grupo" sem grupo.** "Bônus acima do saldo" não é de um grupo. Esse item leva à aba "Pontos", ao bloco "Onde foram os bônus" (§3.1).
4. **"O aviso no 'O que falta'" da D-07.** Na tela, "O que falta" é o título da lista da aba, e a D-05 põe um resumo na barra. O plano põe o "confirme com o narrador" na lista da aba e na confirmação de concluir, não na barra: a barra não tem altura para um terceiro tipo de item a 360 dp (§3.3 e §3.9).
5. **"Orçamento" também está nas regras da crônica.** O bloco "Orçamento" do narrador (`components/chronicles/CreationSettings.tsx:189`) não é a aba da ficha e fica com o nome. Mudar os dois é ponto para o PO.

**Pontos para o PO das ondas anteriores que tocam este pacote** (continuam abertos; nenhum é tratado como decidido):

- **[onda-2.md](onda-2.md) §6, ponto 6 (extrato no Histórico, R-17):** o "Onde foram os bônus" continua só na aba (agora "Pontos"), em `creating`.
- **[onda-3.md](onda-3.md) §6, ponto 3 (ficar no Editar depois de salvar):** não muda. A criação por pontos já fica em Criação depois de salvar (`ModeBar.tsx:194-216`: o `save` do resumo vai ao `summary.next`, que na Criação é a própria Criação), e o "Faltam" vive nela.
- **[onda-3.md](onda-3.md) §8, pergunta 4 ("Concluir" escondido):** a §3.4 traz a proposta, para o PO decidir.

## 3. Desenho por item

### 3.0 O que o código faz hoje

**A barra de ação** (`ModeBar.tsx`). O `useModeBar` (`:108-417`) monta o `EvolveBar` (`:419-492`) com o contrato do P03-D (`save`, `next`, `note`, `detail`):

| Peça | Na Criação hoje | Código |
|---|---|---|
| Texto (`aria-live`) | "Criação · N alterações · Bônus: restam N de 15" | `:438-447`; o saldo vem de `useFreebiesText` (`CreationPanel.tsx:71-73`) |
| `note` | A linha do próximo passo, em `caption`, `testID="next-step"` | `:249-254`; o texto vem do `nextStepCopy` (`sheet/creation/nextStep.ts:25-48`) pelo `useNextStep` (`useNextStep.ts:69-88`) |
| `save` | "Salvar" (nome "Salvar alterações"), `mode-save` | `:293-302` |
| `next` | Só com a conta fechada (`finishing.ready`): "Concluir criação", "Enviar para aprovação" ou "Concluir e aprovar", `creation-action` | `:303-314` |
| Arranjo | Duas linhas no `compact` com `next` ou `note`, ou com `stacked`: em cima o texto e o `note`, embaixo os botões (`mode-bar-actions`, `flexWrap`) | `:437`, `:476-490`, estilos `:647-659` |

O `nextStepCopy` depende do papel, do modo da crônica, da aprovação e do marcador (`adjust`, `returned`, `ready`), não da conta. Por isso, na criação por pontos, a linha continua "Você conclui quando a conta fechar." com o "Concluir criação" já na barra (achado 3 do onda-3 §11).

**A altura medida na onda 3** ([onda-3.md](onda-3.md) §11, item 1) e a conta pelos tokens (`caption` 13/18, `space[2]` = 8, botão de 48 no Android e 44 no iOS e no web, `packages/ui/src/tokens.ts:293-294`, `:403-408`):

| Onde | Medido | Pelos tokens: texto + `note` + botões | Pelos tokens: só o texto + botões |
|---|---|---|---|
| AVD a 360, 393 e 411 dp | 110 dp | 8 + 18 + 18 + 8 + 48 + 8 = 108 (+ bordas) | 90 |
| iPhone SE | ~89 pt | 8 + 18 + 18 + 8 + 44 + 8 = 104 | ~86 |
| Web a 390 | ~88 px | 104 | ~86 |

O Android bate com duas linhas de texto. O iOS e o web batem com uma linha de texto só: a medida da onda 3 não diz se o `note` estava na tela. A §11 mede de novo, com o estado anotado (pergunta 1 da §9).

**A aba de pontos.** O `SheetView` acrescenta a aba `{ id: 'creation', label: 'Orçamento' }` (`:221`) quando há conta: na Criação do dono (`budgetEdit`, `:212`) e na Leitura do narrador em ficha alheia (T-33, `:213-214`). O `CreationPanel` (`CreationPanel.tsx:183-257`) mostra, nesta ordem:

1. a fase, como `RadioChips` "O que os pontos gastam" (`:200-217`);
2. o saldo de bônus (`:218-227`);
3. "Onde foram os bônus" (`Ledger`, `:228`, `:260-287`);
4. "O que falta", em texto puro, com `slice(0, 12)` (`:229-245`), ou a frase da conta fechada (`:246-252`);
5. as "Regras da casa" do narrador, só na Criação (`:254`).

**O "Ver orçamento"** está em dois lugares, os dois pelo `OpenBudgetContext` (`CreationContext.tsx:27-35`, ligado em `SheetView.tsx:271-275` e `:413`): no rodapé da folha de bônus (`CreationPanel.tsx:327-334`) e no aviso da recusa (`evolve/DraftNoticeText.tsx:33-39`).

**Navegação dentro da ficha.** A faixa fixa (`SheetNav.tsx`, `stickyHeaderIndices`) tem as abas da zona e, no celular, as sub-abas da seção que está no topo (T-27). O `showTab` (`SheetView.tsx:262-270`) troca a aba e, se a rolagem já passou do painel, volta ao começo dele. O store das sub-abas (`layouts/groupTabsState.ts:85-149`) guarda o grupo escolhido por seção e o `y` só das seções com sub-abas no celular (`SectionView.tsx:30-38`). **Não existe "ir a um grupo"**: nada rola até uma seção qualquer nem põe o foco nela.

### 3.1 R-18 · Os itens do "O que falta": quem gera e o formato

**Quem gera.** Os problemas continuam vindo do `checkCreation` do core (`packages/sheet-core/src/creation.ts:310`), a mesma conta do servidor. O app transforma cada problema em item, num arquivo novo e puro, `apps/frontend/sheet/creation/guide.ts`, ao lado do `problemText` (`sheet/creation/creation.ts:225-261`). Por que no app, e não no core:

- o texto curto, a ordem e o alvo na tela são interface, como o `problemText` e o `stepAdvice` (P05-C, pergunta 7);
- o servidor não precisa de nada disso: ele recusa pelo código do problema;
- o `@tms/sheet-core` não muda, o `dist` não precisa ser reconstruído e a regra que o servidor aplica não é tocada.

Se o P09-D (D-10) precisar do mesmo resumo na Mesa, a parte sem tela (`missingSummary`) sobe para o core no pacote dele (pergunta 6).

**Formato:**

```ts
// sheet/creation/guide.ts
export type GuideKind =
  | 'blocking' // impede salvar (severity 'blocking' do core)
  | 'missing'  // impede concluir (severity 'incomplete')
  | 'confirm'  // não impede nada: "confirme com o narrador" (P07-D, §3.9)

export interface GuideTarget {
  // A aba: uma zona com aba ('build' | 'powers' | 'lore'), 'play' (o "Em
  // jogo", que abre se estiver recolhido) ou 'creation' (a aba Pontos)
  readonly tab: string
  readonly section: string | null // id da seção (CompiledSection.id)
  readonly group: string | null   // id do grupo da seção, se ela tem grupos
  readonly path: string | null    // `values.<campo>` ou `values.<lista>#<item>`
}

export interface GuideItem {
  readonly key: string     // estável entre renders: `${code}:${budget}:${group}:${path}`
  readonly kind: GuideKind
  readonly short: string   // o texto visível na barra: "Virtudes 7"
  readonly text: string    // a frase inteira: "Virtudes: faltam 7 pontos básicos."
  readonly target: GuideTarget | null // null: leva à aba Pontos
}

export function guideItems(
  model: SheetModel,
  check: CreationCheck | null,
  roles: ReadonlySet<RoleName>
): readonly GuideItem[]
```

**Regras, por código do problema** (rótulos do template e números da conta; nunca texto da ficha, como o `problemText`):

| Código (`CREATION_PROBLEMS`) | `kind` | `short` | `text` | Alvo |
|---|---|---|---|---|
| `PRIORITIES_REQUIRED` | `missing` (ou `blocking` com pontos já postos) | "Atributos (prioridade)": **um item por orçamento**, não por grupo | "Atributos: escolha a prioridade." | A seção do primeiro grupo do orçamento |
| `BASICS_UNSPENT` | `missing` | "Virtudes 7" | o `problemText` de hoje ("Virtudes: faltam 7 pontos básicos.") | A seção e o grupo |
| `POINTBUY_UNSPENT` | `missing` | "Atributos 3" | o `problemText` | A seção e o grupo |
| `POINTBUY_EXCEEDED` | `blocking` | "Atributos: 2 acima" | o `problemText` | A seção e o grupo |
| `FREEBIES_EXCEEDED` | `blocking` | "Bônus: 3 acima" | o `problemText` | `null`: a aba Pontos, no "Onde foram os bônus" |
| `OUT_OF_RANGE`, `HARD_CAP`, `LOCKED`, `NOT_PURCHASABLE`, `BELOW_INITIAL` | o do core | o rótulo do campo ("Forças") | o `problemText` | O campo do primeiro caminho (`paths[0]`), com o `#item` quando houver |

- **Prioridade por orçamento.** No V20, escolher a prioridade de um grupo ordena os três (R-28, `usePriorityChoice.ts`). Seis itens "Físicos (prioridade)", "Sociais (prioridade)"… diriam a mesma coisa. O item junta os grupos do mesmo `budget` e usa o rótulo do orçamento (`CreationBudgetCheck.label`).
- **Ordem:** primeiro os `blocking` (impedem salvar), depois os `missing`, depois os `confirm`. Dentro de cada tipo, a ordem da ficha, pelo `fieldRank` do primeiro alvo do grupo (`packages/sheet-core/src/order.ts`). Assim a barra lê de cima para baixo: Atributos, Habilidades, Vantagens.
- **O alvo** sai do template: o primeiro `targets` do grupo em `model.template.creation.budgets` (o inverso do `groupFor`, `creation.ts:128-143`) → a primeira seção do `model.sections` que tem o campo → a zona dela e o grupo da seção que tem o campo. Seção que o papel não lê (`canReadSection`) dá alvo `null`.
- **O caminho de item** (`values.<lista>#<item>`) é o mesmo que o `useStepAdvice` aceita desde o P05-C (`useStepAdvice.ts:13-18`). O P07-D o usa para levar a uma linha da lista (§3.9).
- **Lista vazia** (conta fechada, criação livre ou sem conta): nenhum item.

**Contagem por sistema, no começo da ficha** (do `creation.budgets` dos três templates): V20, 5 itens (Atributos e Habilidades com prioridade; Disciplinas, Antecedentes e Virtudes); M20, 4 (Antecedentes e Esferas); W20, 4 (Antecedentes e Dons). Com as prioridades escolhidas: até 9, 8 e 8.

### 3.2 R-18 · Ir ao grupo: aba, sub-aba, âncora e foco

**Sem rota nova.** O toque fica na mesma tela: a aba da ficha é estado local (`tab`, `SheetView.tsx:205`), como hoje. Nada vai para a URL nem para o histórico do navegador.

**O caminho** (`goTo(target)`, no `SheetBody`, passado pelo `SheetProvider` junto do `openBudget` de hoje, `SheetView.tsx:413`, `context.tsx:33-39`):

1. **A aba.** `showTab(target.tab)`. Com `tab: 'play'` e o "Em jogo" recolhido (T-59, `SheetView.tsx:252-253`), abre o bloco (`setPlayOpen(true)`). Com `target === null`, abre a aba Pontos.
2. **A sub-aba.** Se a seção tem sub-abas ativas (`section.def.groupTabs`), `groupTabs.store.select(section, group)` (`groupTabsState.ts:119-123`). O corpo passa a mostrar o grupo, e a faixa fixa também.
3. **A rolagem.** O store das sub-abas ganha âncoras para **toda** seção do painel, não só as com sub-abas no celular:

   ```ts
   // GroupTabsStore (groupTabsState.ts), aditivo
   readonly anchorAt: (sectionId: string, y: number, focus: () => void) => void
   readonly jumpTo: (sectionId: string) => void // resolve no próximo anchorAt dela
   readonly onJump: (listener: (y: number) => void) => () => void
   ```

   - O `SectionView` (`:30-38`) passa a chamar `anchorAt` no `onLayout` sempre que está no painel (`StripScope`). O `sectionAt` de hoje continua só para a faixa.
   - Depois de trocar de aba, a seção nova ainda não foi medida. O `jumpTo` guarda o pedido, e ele se resolve no `onLayout` da seção, sem timer. A seção já medida resolve na hora.
   - O `SheetBody` escuta `onJump` e faz `scrollRef.current?.scrollTo({ y: panel + y − navHeight, animated: !reduceMotion })`: o começo da seção fica logo abaixo da faixa fixa, não embaixo dela. É a mesma conta do `panelTop` (`groupTabsState.ts:146`) e do ajudante `tab` do E2E (`e2e/support/creation.ts:114-140`).
4. **O foco.** O título da seção (`SectionHeader` em `SectionView.tsx:41-51`) ganha um alvo de foco:
   - **web:** `nativeID="anchor-<seção>"` e `tabIndex={-1}`; o `focus` chama `element.focus({ preventScroll: true })`. O leitor de tela lê o título, e o Tab seguinte vai para o primeiro controle do grupo;
   - **iOS e Android:** `AccessibilityInfo.setAccessibilityFocus(findNodeHandle(ref))` no título, depois da rolagem. Com o leitor desligado, não há o que focar, e a rolagem basta;
   - o item da barra não é região viva, e o foco não anuncia nada além do título (pergunta 2 da §9).

**Grupos sem sub-abas** (desktop com colunas, `GroupsLayout.tsx:84-85`, ou fonte grande): a rolagem vai até a seção, e o foco, ao título do grupo, que já é um `SectionHeader level="group"` (`GroupsLayout.tsx:138-140`) e ganha o mesmo alvo.

**Narrador em Leitura** (T-33): os itens da aba Pontos levam ao grupo do mesmo jeito. A ficha continua só de leitura.

### 3.3 R-18 · "Faltam: …" na barra: o slot, as alturas e a lista longa

**O contrato da barra ganha uma peça.** O `note` continua sendo a linha do próximo passo do P04-D. O "Faltam" não vai no `note`: ele precisa de alvos de toque de 44, e uma linha de `caption` tem 18. Ele entra num slot novo, `guide`, na linha dos botões, à esquerda do "Salvar":

| Peça | Quem preenche | O quê |
|---|---|---|
| `save` | P03-D | sem mudança |
| `next` na Criação | P03-D | sem mudança: só com a conta fechada (§3.4) |
| `note` | P04-D, com a mudança da §3.5 | a linha do próximo passo, que agora muda quando a conta fecha |
| **`guide`** | **P05-D** | o "Faltam: …", com os itens tocáveis, enquanto a conta está aberta |

```ts
// EvolveBar (ModeBar.tsx:419), aditivo
readonly guide?: ReactNode // na linha das ações, antes do `save`, com flex: 1
```

**O arranjo, a 360 dp** (328 úteis):

```
conta aberta                                    conta fechada
┌───────────────────────────────────────┐      ┌───────────────────────────────────────┐
│ Criação · 1 alteração · Bônus: restam │      │ Criação · 1 alteração · Bônus: restam │
│ Você conclui quando a conta fechar.   │      │ A conta fechou: você conclui.         │
│ Faltam: Virtudes 7 · e mais 2 [Salvar]│      │       [Salvar] [Concluir criação]     │
└───────────────────────────────────────┘      └───────────────────────────────────────┘
```

- **As duas linhas convivem sem somar altura.** O próximo passo fica no bloco de texto, como hoje. O "Faltam" ocupa, na linha dos botões, o lugar do "Concluir criação", que só aparece quando a conta fecha. Quando ela fecha, o "Faltam" sai e o "Concluir" entra no mesmo lugar.
- **Largura do "Faltam":** a linha útil menos o "Salvar" (~86 dp, P03-D §3.0) e o `gap` de 8. São 234 dp a 360, 256 a 390, 267 a 393 e 285 a 411.
- **Altura:** a mesma de hoje. A linha dos botões já existia, e os itens têm a altura do botão.

| Estado, no `compact` | Android | iOS e web | Hoje |
|---|---|---|---|
| Conta aberta: texto, próximo passo, "Faltam" + "Salvar" | 8 + 18 + 18 + 8 + 48 + 8 = **108** | **104** | 108 / 104 |
| Conta fechada: texto, próximo passo, "Salvar" + "Concluir" | **108** | **104** | 108 / 104 |
| Fonte de 130% (`stacked`): as linhas de texto quebram; o "Faltam" vira um botão só ("Faltam 5 itens") na linha dos botões | ~8 + 2 × 23 + 8 + 62 + 8 ≈ **132** | ~**126** | ~132 / ~126 |
| A partir de 600 (`regular`, uma linha): texto e próximo passo à esquerda, "Faltam", "Salvar" e "Concluir" à direita | **64** | **60** | 64 / 60 |

**Por que não três linhas** (a alternativa: o "Faltam" como terceira linha do bloco de texto). Com alvo de 44, a barra iria a ~160 dp no Android. A 360 × 740 dp (Pixel 3a com `wm density 480`), sobram ~620 dp depois da barra de status, da barra de navegação e do cabeçalho. A barra fixa de 110, mais a faixa fixa do T-27 (~128 com abas, sub-abas e contador), deixa ~382 dp de ficha. Com 160, ficariam ~332: é o "engolir a ficha" que o T-27 corrigiu.

**A lista longa.** O texto de um botão nunca é cortado com reticências. Uma função pura decide quantos itens cabem:

```ts
// guide.ts
export function fitGuide(
  items: readonly GuideItem[], // já sem os `confirm` (§3.9)
  width: number,               // a largura do slot, em dp
  fontScale: number
): { readonly shown: readonly GuideItem[]; readonly more: number }
```

- A conta é por caractere, com folga: `caption` de 13 × `fontScale` × 0,6 em por caractere, contra os ~0,52 medidos do P04-D. A 360, o slot leva ~30 caracteres.
- Entram os itens inteiros que cabem, na ordem da §3.1. O "· " entre eles conta. Se sobrar item, entra no fim "e mais N" (botão).
- Se nem o primeiro item e o "e mais N" cabem, a linha vira um botão só: "Faltam N itens".
- A largura vem do `onLayout` do slot. Antes da primeira medida, vale a estimativa pela janela (`useLayout().width − 2 × gutter − 86 − 8`).
- Exemplos a 360, no V20: no começo, "Faltam: Atributos (prioridade) · e mais 4" não cabe, e a linha é "Faltam 5 itens". Com as prioridades: "Faltam: Virtudes 7 · e mais 2". A 411: "Faltam: Disciplinas 3 · Virtudes 7 · e mais 1".
- **"e mais N" e "Faltam N itens" levam à aba Pontos,** à lista inteira, com o foco no título "O que falta".

**O texto** (rascunho do time, para revisão): "Faltam:" com dois ou mais itens, "Falta:" com um. O item `blocking` usa a cor `danger`, como a lista da aba (`CreationPanel.tsx:240`), e o texto dele já diz "acima": a cor nunca é a única pista.

**Acessibilidade:**

- "Faltam:" é texto; cada item é um botão (`accessibilityRole="button"`), com nome que começa pelo texto visível (WCAG 2.5.3): "Virtudes 7: faltam 7 pontos básicos", e a dica "Vai ao grupo na ficha";
- "e mais 2" tem o nome "e mais 2: ver tudo o que falta em Pontos";
- o alvo de cada item tem a altura da linha (44 no iOS e no web, 48 no Android) e no mínimo 44 de largura (`minWidth`); o separador "·" fica fora dos alvos;
- o slot não é região viva: a contagem da barra já é (`ModeBar.tsx:440`). A troca para "conta fechada" é anunciada uma vez (§3.5);
- ordem de foco: o texto, o próximo passo, os itens e o "Salvar", que é a ordem visual.

**Quem vê:**

| Quem e modo | Na barra |
|---|---|
| Dono, criação por pontos, Criação | "Faltam" enquanto a conta está aberta |
| Narrador na ficha própria, Criação | o mesmo |
| Narrador na ficha alheia, Criação (pelo "Editar como narrador", T-33) | o mesmo, sem a linha do próximo passo (`nextStepCopy` dá `null`, `nextStep.ts:32`) |
| Criação livre, Editar | nada: não há conta. A barra do P04-D não muda |
| Leitura e Jogo | não há barra de ação; a lista fica na aba Pontos |

### 3.4 Pendência · "Concluir criação" escondido ou `aria-disabled` (pergunta 4 do onda-3 §8; P03-D, pergunta 1)

**Proposta técnica: continua escondido até a conta fechar, e o "Faltam" ocupa o lugar dele.** É decisão de produto: **ponto 1 para o PO** (§9). Por que a proposta:

- **O "Faltam" já é a explicação.** A alternativa pedia o botão visível justamente para explicar o que falta. Com os itens na mesma linha, quem procura o "Concluir" (POW-52: "o botão não existe até a conta fechar, e só a aba Orçamento explica") acha a lista do que falta no lugar dele.
- **Cabe.** Com o "Concluir" visível e desabilitado, a linha dos botões teria "Salvar" + "Concluir criação" (~256 dp a 360), e o "Faltam" precisaria de uma linha própria: +56 dp no Android (~164).
- **É prevenção, não recusa,** como a tela faz hoje e como a D-13 manda escrever no plano-v4 §1.4 (P01-D).
- **Não muda o `@tms/ui`.** O `Button` não tem estado "indisponível mas tocável" (`packages/ui/src/Button.tsx:9-22`). O `markSoftDisabled` do P05-C é do `Stepper` (`Stepper.tsx:70-84`). A alternativa pediria uma prop nova no `Button`, com conferência no nativo (lição S-01) e o mesmo cuidado com o `react-native-web` (P05-C, desvio 4).

**Se o PO preferir o botão visível:** "Concluir criação" com `aria-disabled` e tocável; o toque não chama a API, leva ao primeiro item (o mesmo `goTo` da §3.2) e mostra um toast "Ainda falta: …". O custo é um commit a mais (P): a prop `softDisabled` no `Button`, com o `markSoftDisabled` no web; o "Faltam" numa linha própria; e os testes que esperam o botão ausente (`CreationScreen.test.tsx:441`, `:527`). O desenho deixa a escolha num lugar só (o `next` da Criação, `ModeBar.tsx:303-314`).

### 3.5 Pendência · A linha do próximo passo muda quando a conta fecha (achado 3 do onda-3 §11)

O `nextStepCopy` (`nextStep.ts:25-48`) ganha `closed`, que é o `check.complete` local, o mesmo que mostra o "Concluir" (`CreationPanel.tsx:96`):

```ts
export interface NextStepInput {
  readonly by: NextStepReader
  readonly mode: 'free' | 'points'
  readonly approval: boolean
  readonly marker: NextStepMarker
  readonly closed?: boolean // criação por pontos: a conta fechou (padrão false)
}
```

| Quem e modo da crônica | Conta aberta (hoje, sem mudança) | Conta fechada (novo, rascunho do time) |
|---|---|---|
| Dono, por pontos, sem aprovação | "Você conclui quando a conta fechar." | "A conta fechou: você conclui." |
| Dono, por pontos, com aprovação | "Quando a conta fechar, envie ao narrador." | "A conta fechou: envie ao narrador." |
| Dono, com `adjust` ou `returned` | "Ajuste o pedido do narrador e conclua." / "… e envie de novo." | o mesmo: o pedido do narrador vem antes |
| Narrador na ficha própria | "Você conclui a criação." | "A conta fechou: você conclui." |
| Criação livre, narrador na ficha alheia | sem mudança | sem mudança |

- **Cada frase nova tem até 48 caracteres** (`NEXT_STEP_MAX`, `nextStep.ts:22`), e o teste do P04-D confere (`__tests__/nextStep.test.ts`).
- **O `closed` vem do rascunho local,** como o botão. O servidor decide de novo ao concluir (`completionRefusal`).
- **O anúncio.** Quando a conta fecha, sai uma vez `AccessibilityInfo.announceForAccessibility('A conta fechou. Você pode concluir pela barra.')`, só se a folha de bônus não abrir na mesma passagem: a folha já anuncia (`CreationPanel.tsx:314-316`). As duas coincidem quando os básicos fecham com bônus sobrando, porque a sobra não impede concluir.

### 3.6 R-18 · Aba "Pontos", "Ver Pontos" e o "O que falta" tocável

**Os nomes** (P05-C §2: "a D-05 renomeia os dois juntos"):

| Onde | Hoje | Depois (rascunho do time) |
|---|---|---|
| Aba (`SheetView.tsx:221`) | "Orçamento" | "Pontos" |
| Rodapé da folha de bônus (`CreationPanel.tsx:328`) | "Ver orçamento" | "Ver Pontos" |
| Aviso da recusa (`DraftNoticeText.tsx:35`) | "Ver orçamento" | "Ver Pontos" |
| Dica da fase de bônus (`CreationPanel.tsx:214`) | "Passar do orçamento de um grupo usa os pontos de bônus…" | "Passar dos pontos básicos de um grupo usa os pontos de bônus, até o saldo acabar." |

- **O que não muda:** o id da aba (`'creation'`), os `testID` (`creation-panel`, `notice-<campo>-budget`), os nomes internos (`openBudget`, `BUDGET_TAB`) e o "Orçamento" das regras da crônica (§2, item 5). O "acima do orçamento" do point-buy (`creation.ts:246`) também fica: é o orçamento do grupo, e o texto é de sistemas como D&D.
- **"Ver Pontos" na folha de bônus passa a trocar de aba no `onClosed`,** não no toque (§3.8): a aba muda depois que a folha devolve o foco, e o foco vai para o painel.

**O "O que falta" da aba vira uma lista de botões** (`CreationPanel.tsx:229-245`):

- cada problema é um item da §3.1, com o `text` inteiro, num `Pressable` de 44 de altura mínima (48 no Android), papel `button`, dica "Vai ao grupo na ficha", e o mesmo `goTo` da barra;
- a cor continua a de hoje (`danger` para o que impede salvar, `inkMuted` para o que falta), e o texto diz a mesma coisa;
- **sai o `slice(0, 12)`**: a lista é curta (até 9 grupos no V20, mais os problemas de campo), e o "e mais N" da barra precisa achar tudo aqui;
- **os itens `confirm` vêm depois, sob o título "Para confirmar com o narrador"** (§3.9);
- o título "O que falta" ganha o mesmo alvo de foco da §3.2 (`anchor-creation-missing`), que o "e mais N" usa.

### 3.7 U-07 · A fase em texto, com a troca manual como opção secundária

O `RadioChips` "O que os pontos gastam" (`CreationPanel.tsx:200-210`) sai. No lugar (rascunho do time, para revisão):

| Fase | Indicador (`Text`, `testID="creation-phase"`) | Dica (`caption`) | Ação secundária (`Button` `ghost`, `testID="creation-phase-switch"`) |
|---|---|---|---|
| Básicos | "Fase: pontos básicos" | "Cada grupo trava quando os pontos básicos acabam. Quando todos fecharem, a fase passa sozinha para os pontos de bônus." | "Usar pontos de bônus agora" |
| Bônus, com os básicos fechados | "Fase: pontos de bônus" | "Passar dos pontos básicos de um grupo usa os pontos de bônus, até o saldo acabar." | nenhuma: voltar aos básicos não muda nada quando eles fecharam |
| Bônus, escolhida à mão com básicos faltando | "Fase: pontos de bônus" | a mesma | "Voltar aos pontos básicos" |

- **A regra não muda.** A fase continua só do app (`sheetStore.ts:209`, `:981-983`), como o P05-C manteve: ela decide se o `draftRefusal` recusa o ponto além dos básicos com o motivo `budget` (`creation.ts:505-544`). O servidor aceita gastar bônus antes de fechar os básicos, como sempre aceitou.
- **A troca automática continua** na passagem (`CreationPanel.tsx:309`).
- **Acessibilidade:** a fase é texto, não só cor nem só estado de um controle. O botão tem o nome do que faz. O leitor de tela não perde nada que o `radiogroup` dava: o estado está escrito.
- **O caminho do T-07 continua.** O "Ver Pontos" do aviso da recusa leva à aba, onde agora está a ação "Usar pontos de bônus agora".

### 3.8 U-07 · A folha de bônus só na primeira passagem de cada ficha

**A causa, corrigida.** A matriz aponta o iOS e "tirar um ponto e repor" (estimado). No mesmo `BonusNotice` montado, isso já não reabre a folha: o `shown.current` (`CreationPanel.tsx:301`, `:311`) a segura. A folha reaparece porque a marca é **por montagem**:

- o `BonusNotice` só monta com `budgetEdit` (`SheetView.tsx:404-406`), e sai ao trocar para Jogo;
- a tela da ficha monta outro store a cada visita.

No PO-A (`po-app.md:88`), a ficha tinha voltado da devolução (outra montagem): baixar Ofícios e repor reabriu a folha, com 13 de 15 bônus já gastos. O mesmo acontece em qualquer plataforma. Para reproduzir: fechar os básicos (folha) → Jogo → Criação → tirar um ponto básico → repor.

**A regra nova.** A folha abre na passagem dos básicos para "todos fechados" (como hoje: `was` de falso para verdadeiro, `:303-307`) **e** quando valem as três condições:

1. **a fase ainda é a dos básicos.** Quem trocou à mão para os bônus já sabe deles. Depois da primeira folha, a fase fica nos bônus enquanto a tela estiver aberta;
2. **nenhum ponto de bônus foi gasto** (`check.freebies.spent === 0`). Quem já gastou bônus já passou pela fase. A regra vale em qualquer aparelho e não guarda nada: é a conta da ficha, igual para todos;
3. **a ficha não está marcada neste aparelho** para este usuário (`bonusSeen`).

A ficha que abre com os básicos já fechados continua mudando de fase sem aviso (`:310-311`).

**Onde fica a marca: no aparelho, não no servidor.** Arquivo novo, `apps/frontend/sheet/creation/bonusSeen.ts`:

- **Chave:** `seen:bonus:<characterId>` no `UserStorage` do usuário (`useUserStorage`, `lib/persist.tsx:221-222`), o mesmo armazenamento dos rascunhos (`draft:`, `sheet/sync/draftStore.ts:17`) e do outbox (`outbox:`, `persistedOutbox.ts:18`). O valor é `"1"`. O `characterId` passa pelo formato de UUID antes de virar chave; o `scopeStorage` já confere o id do usuário (`sheet/sync/kv.ts:47-57`).
- **Leitura:** uma vez, quando o `BonusNotice` monta, numa memória da sessão (um `Set` do módulo, por usuário), para a troca de modo não ler de novo. O que vem do disco é input hostil: só `"1"` conta como marcado; o resto vale como "não marcado". O pior caso é a folha aparecer mais uma vez.
- **Gravação:** quando a folha abre. Sem `UserStorage` (testes, sem sessão), só a memória da sessão.
- **Efeito no cache persistido** (`lib/persist.tsx`): nenhum, e o arquivo não muda.
  - A marca **não** fica no cache de leitura (`query-cache`, `:43`), que só guarda templates e fichas validadas (`:62-75`, `:117-187`). Desde o `fe43bd0`, o `buster` desse cache é a versão do app (`:232-235`), e cada release o descarta inteiro. A marca, em chave própria, sobrevive à release, como os rascunhos e o outbox.
  - No logout, o `userStorage.clear()` apaga todas as chaves do usuário (`:283-292`), inclusive a marca.
  - No nativo, o armazenamento é o SQLCipher (`encryptedStorage.ts`); no web, o IndexedDB.
  - A marca só tem o id da ficha: nada de PII.
- **Limpeza:** a marca fica até o logout (~60 bytes por ficha). A ficha concluída não volta a ter fase de bônus, e a chave é inofensiva.

**Por que não no `creation` do jsonb, como os marcadores do P04-D** (alternativa para o PO, ponto 3 da §9). A marca no servidor valeria em qualquer aparelho e depois do logout. Ela pediria:

- uma rota nova (`POST /characters/:id/creation/bonus-seen`) ou um campo no `PATCH /characters/:id/creation`;
- a AuthZ só do dono, pelo `writePolicy`, com a ficha travada, linhas novas na matriz de AuthZ dos três sistemas e `/security-review`;
- uma decisão sobre a revisão. Pela regra do P04-D, ela sobe a cada mudança do `creation`. Subir a revisão no instante em que a folha abre (logo antes de o jogador concluir) daria 409 ao narrador que conclui ou aprova com a revisão velha. Não subir abriria exceção à regra;
- um caminho sem rede: a passagem acontece offline, e a marca entraria na fila ou se perderia.

Para uma folha de aviso, o custo (M, com revisão de segurança) é maior que o efeito, e a condição 2 já cobre o caso do PO-A em qualquer aparelho.

**A `BottomSheet` da folha não regride.** A folha continua a `BottomSheet` do `@tms/ui`, sem mudança de API:

- o Esc na captura (`f3f3b8a`) e o foco de volta a quem tinha o foco (o "+" que fechou os básicos, `BottomSheet.tsx:153-161`);
- o diálogo central de 560 a partir de 600 px (T-69, `:150-152`, `:320`);
- **"Ver Pontos" troca de aba no `onClosed`** (`:130-136`), depois que a folha saiu e o foco voltou: no iOS, nada abre enquanto o `Modal` sai, e no web o foco vai para a aba Pontos, não para o "+" escondido;
- a folha não tem campo: o texto do evento no Enter (`e0a4078`) não se aplica. "Entendi" continua o botão principal, e o Enter no web o aciona.

### 3.9 Ponto de extensão para o P07-D (D-07, D-09): o aviso que não bloqueia

O P07-D põe o "Dom acima do nível 1: confirme com o narrador" (D-07) e, se couber, o "fora do clã" (D-09) no "O que falta". O P05-D deixa o lugar pronto, sem regra de jogo:

```ts
// guide.ts: o P07-D implementa; até lá, devolve []
export function useCreationNotices(): readonly GuideItem[] // kind: 'confirm'
```

**Como o `confirm` aparece diferente de um "falta":**

| | "Falta" (`missing`, `blocking`) | "Confirme com o narrador" (`confirm`) |
|---|---|---|
| Vem de | `check.problems` (a conta do core e do servidor) | o P07-D (catálogo e nível no template, D-07; clã, D-09) |
| Na barra | sim, no "Faltam" | **não**: não conta no "Faltam" nem no "e mais N" |
| Na aba Pontos | "O que falta" | "Para confirmar com o narrador", depois do "O que falta", em `inkMuted` |
| Texto | o do `problemText` | começa por "Confirme com o narrador:" (o texto diz que não bloqueia; não é só cor) |
| No "Concluir" | esconde o botão (§3.4) | não esconde nem libera nada |
| Na confirmação de concluir | — | uma linha nas `notes` do `CompletionMessage` ("1 item para confirmar com o narrador; veja em Pontos."), como a sobra de bônus do P05-C |
| No servidor | recusado ao salvar ou concluir | aceito, como hoje: o aviso é só da tela |

**Regras para quem preenche:**

- **sem texto da ficha:** o nome do Dom vem do catálogo do template (D-07); um Dom digitado fora do catálogo é "um Dom acima do nível 1", sem o nome digitado;
- o alvo usa o caminho de item (`values.<lista>#<item>`) para levar à linha da lista (o `goTo` da §3.2 chega à seção; o foco na linha é do P07-D, no `ListEditor`);
- **se o P07-D puser o aviso no `@tms/sheet-core`,** ele vai num campo à parte da conta (por exemplo, `CreationCheck.notices`), nunca em `problems`: o `complete` e o `savable` (`creation.ts:165-173`) e a recusa do servidor não podem mudar por causa de um aviso.

### 3.10 O que muda na API pública

| Contrato | Mudança |
|---|---|
| HTTP | nenhuma |
| `@tms/sheet-core` | nenhuma: o `dist` não precisa ser reconstruído por este pacote |
| `@tms/ui` | nenhuma: o `Button`, o `Pressable`, a `BottomSheet` e o `Tabs` são usados como estão |
| Templates e `schema.json` | nenhuma: sem versão nova, sem campo novo, sem `templates:publish` |
| Internos do app | `EvolveBar.guide` (§3.3); `nextStepCopy({ closed })` (§3.5); o `SheetProvider` ganha `goTo` ao lado do `openBudget` (§3.2); o `GroupTabsStore` ganha `anchorAt`, `jumpTo` e `onJump` (§3.2); `guide.ts`, `bonusSeen.ts` e `GuideRow.tsx` são novos |

O `design/design-system/components.md` muda no mesmo pacote: ModeBar (o slot `guide` e o arranjo da §3.3) e a menção à aba (`:569`, "aba Orçamento" → "aba Pontos").

## 4. Testes

### 4.1 Um teste de regressão por item (falha no `3cc07f1`, passa depois)

| Item | O que o teste prova | Arquivo | Tipo |
|---|---|---|---|
| R-18 | `guideItems`, nos cenários abaixo | `apps/frontend/sheet/creation/__tests__/guide.test.ts` (novo) | Jest |
| | • V20, M20 e W20 recém-criados: 5, 4 e 4 itens; a prioridade sai uma vez por orçamento ("Atributos (prioridade)") | | |
| | • com as prioridades: "Virtudes 7", "Disciplinas 3" na ordem da ficha; `blocking` antes de `missing` | | |
| | • o alvo de cada grupo aponta a zona, a seção e o grupo certos; "Bônus: 3 acima" tem alvo `null`; a seção que o papel não lê dá `null` | | |
| | • conta fechada, criação livre e sem conta: lista vazia | | |
| R-18 | `fitGuide`: a 234, 256, 267 e 285 dp e com `fontScale` 1 e 1,3 escolhe os itens inteiros, o "e mais N" e o "Faltam N itens"; nenhum item cortado | o mesmo | Jest |
| R-18 | A barra, nos cenários abaixo | `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | Jest + RNTL |
| | • com a conta aberta, a barra tem "Faltam:" e os itens como botões, antes do `mode-save`; sem o `creation-action` | | |
| | • tocar "Virtudes 7" seleciona a aba "Vantagens" e chama o `scrollTo` com o `y` da seção (mock do `onLayout`) | | |
| | • fechar a conta tira o "Faltam" e mostra o `creation-action` | | |
| | • na criação livre (Editar), nada de "Faltam" | | |
| R-18 | O `jumpTo` resolve no `anchorAt` seguinte, e o pedido velho é trocado pelo novo | `apps/frontend/sheet/layouts/__tests__/groupTabsState.test.ts` | Jest |
| R-18 | A aba se chama "Pontos"; "Ver Pontos" no aviso da recusa e na folha; o "O que falta" tem um botão por problema e leva ao grupo | `CreationScreen.test.tsx` | Jest + RNTL |
| Achado 3 | `nextStepCopy` com `closed`: as quatro frases novas e nenhuma acima de 48 caracteres | `apps/frontend/sheet/creation/__tests__/nextStep.test.ts` | Jest |
| Achado 3 | Com a conta fechando na tela, o `next-step` passa de "Você conclui quando a conta fechar." a "A conta fechou: você conclui." | `CreationScreen.test.tsx` | Jest + RNTL |
| U-07 | A folha não reabre: fechar os básicos (folha) → Jogo → Criação → −1 → +1 (hoje reabre) | `CreationScreen.test.tsx` | Jest + RNTL |
| U-07 | A folha não abre com bônus já gasto: ficha montada com 2 de bônus gastos → −1 básico → +1 | o mesmo | Jest + RNTL |
| U-07 | A marca no aparelho: a folha abre na ficha A; numa tela nova da ficha A (outro store, mesmo storage), não abre; na ficha B, abre | o mesmo, com o `createMemoryStorage` (`kv.ts:26-45`) | Jest + RNTL |
| U-07 | `bonusSeen`: valor diferente de `"1"` vale como não marcado; id fora do formato não vira chave; o `clear()` do usuário apaga a marca | `apps/frontend/sheet/creation/__tests__/bonusSeen.test.ts` (novo) | Jest |
| U-07 | A fase é texto ("Fase: pontos básicos"); não há `radio`; "Usar pontos de bônus agora" troca a fase; "Voltar aos pontos básicos" só aparece com básicos faltando | `CreationScreen.test.tsx` | Jest + RNTL |
| U-07 | "Ver Pontos" na folha troca a aba só no `onClosed` | o mesmo | Jest + RNTL |

O teste do Jest em `components/` só roda com `.test.tsx` (lição do P11 e do P04-D, desvio 12). Os testes novos ficam em `sheet/`, onde o `testMatch` aceita `.test.ts` e `.test.tsx` (`apps/frontend/jest.config.js:17-29`). Conferir com `jest --listTests`.

### 4.2 Testes existentes que mudam junto

| Arquivo | O que muda |
|---|---|
| `sheet/creation/__tests__/CreationScreen.test.tsx` | `tab('Orçamento')` e `findByRole('tab', { name: 'Orçamento' })` (`:124`, `:263`, `:272`, `:394`, `:406`, `:424`, `:443`, `:517`) → "Pontos". O `radio 'Pontos de bônus'` (`:265`, `:723`) → o indicador e o "Usar pontos de bônus agora". O "Ver orçamento" (`:722`) → "Ver Pontos". A ordem das ações (`:610`) com a conta fechada não muda; com a conta aberta, o slot `guide` vem antes do `mode-save`. O `next-step` com a conta fechada (`:634`, `:886`) passa à frase nova onde o teste fecha a conta antes |
| `sheet/creation/__tests__/advantages.test.tsx` | `tab('Orçamento')` (`:145`, `:164`, `:317`) e o `radio 'Pontos de bônus'` (`:318`) |
| `sheet/__tests__/SheetScreen.test.tsx` | `:411`, a aba |
| `sheet/__tests__/storyteller.test.tsx` | `:358`, `:378`, `:428`, a aba (o narrador em Leitura) |
| `sheet/__tests__/sheet.layout.test.tsx` | `:603`, `:626`, `:660`, `:661`, `:673`, a aba na faixa fixa (T-27) |
| `sheet/creation/__tests__/nextStep.test.ts` | os casos de hoje ficam (o `closed` é opcional); entram os novos |

Os comentários que citam "Orçamento" (`SheetView.tsx:76`, `:208`, `:271`; `context.tsx:38`; `SheetNav.tsx:14`; `CreationPanel.tsx:49`, `:62`, `:182`; `CreationContext.tsx:28`) passam a "Pontos" no mesmo commit.

### 4.3 E2E (Chromium e WebKit)

**Os seletores que quebram com "Pontos",** pelo `grep -rn "Orçamento\|orçamento" e2e apps/frontend --include='*.ts' --include='*.tsx'`:

| Spec | Linha | Hoje | Depois |
|---|---|---|---|
| `e2e/tests/advantages.spec.ts` | `:28`, `:93` | `getByRole('tab', { name: 'Orçamento' })` | `getByRole('tab', { name: 'Pontos', exact: true })` |
| `e2e/tests/layout.spec.ts` | `:188` (e o comentário `:190`) | o mesmo (T-27: a aba a um toque a 390) | o mesmo, com `exact` |
| `e2e/tests/creation-state.spec.ts` | `:157` | o mesmo | o mesmo |
| `e2e/tests/narrator.spec.ts` | `:84` (e o comentário `:80`) | o mesmo (o narrador em Leitura) | o mesmo |
| `e2e/tests/lifecycle.spec.ts` | `:130` (e o comentário `:123`) | o mesmo | o mesmo |
| `e2e/tests/creation-feedback.spec.ts` | `:116`, `:170` (e o comentário `:20`) | `tab(page, 'Orçamento')` | `tab(page, 'Pontos')` |
| `e2e/support/creation.ts` | `:117` (comentário) e o `tab` (`:126-140`) | um nome fora do mapa é uma aba da zona | o mesmo, e o `tab` passa a usar `exact: true` na aba da zona: "Pontos" não pode casar outra coisa no modo estrito |

O `exact` é a lição da onda 3 (texto ambíguo no modo estrito do Playwright). Nenhum spec usa o `creation-phase` nem o "Ver orçamento". O "Entendi" da folha de bônus (`save-finish.spec.ts:61`, `creation-feedback.spec.ts:114`) continua: as fichas desses testes passam pela primeira vez, sem bônus gasto (`ALMOST`, "restam 15 de 15").

**Quem ajusta e em que ordem:**

1. **O P05-D troca todos** no commit da aba (§8.1, commit 5), junto com o Jest. Nenhum commit do pacote deixa um spec quebrado.
2. **O P07-D faz o rebase depois**, no `advantages.spec.ts`: as linhas `:28` e `:93` já dirão "Pontos", e os fluxos de −/+ na linha (D-08) mudam por cima.
3. **O P10-C e o P10-D** não usam a aba nos specs de hoje. Se um spec novo deles abrir a aba, ele usa "Pontos" com `exact`.

**Spec novo: `e2e/tests/creation-guide.spec.ts`**, com a ficha preparada pela API (`newCharacter`, `prepared`, `e2e/support/creation.ts`):

| Caso | Viewport | O que confere |
|---|---|---|
| "Faltam" na barra | 390 × 844 e 360 × 740 | Dentro do `getByTestId('mode-bar')`: o texto "Faltam:" e os botões dos itens, com `boundingBox().height ≥ 44`; a altura da `mode-bar` ≤ 112 px (a mesma de antes, ±4); nenhum filho da barra passa da largura da viewport |
| Ir ao grupo | 390 | Tocar o item "Virtudes …": a aba `getByRole('tab', { name: 'Vantagens', exact: true })` com `aria-selected="true"`; o `getByTestId('section-virtues')` começa abaixo do `getByTestId('sheet-nav')` e dentro da viewport; o `document.activeElement` é o `#anchor-virtues` |
| "e mais N" | 360 | Leva à aba Pontos, com o foco no título "O que falta" |
| Conta fechada | 390 | Depois do último ponto (folha: "Entendi"), o "Faltam" some, o `creation-action` aparece e o `next-step` diz "A conta fechou: você conclui." |
| Folha uma vez | 390 | `+1` no último básico → `getByTestId('bonus-notice')`; "Entendi"; `−1`, `+1` → nenhuma folha; `page.reload()` (outro store, mesma marca no IndexedDB) → `−1`, `+1` → nenhuma folha |
| Folha no desktop | 1280 × 800 | O painel `bottom-sheet-root > [aria-modal="true"]` com 560 de largura e centrado, medido depois da entrada (lição da onda 3: o painel, não a camada); o Esc fecha; o foco volta ao "+"; "Ver Pontos" seleciona a aba Pontos depois de a folha sair |
| Fase | 390 | "Fase: pontos básicos" como texto; nenhum `role="radio"` no painel; "Usar pontos de bônus agora" muda o texto para "Fase: pontos de bônus" |

O que o Jest não pega no web e o E2E confere no DOM: o `tabIndex="-1"` e o foco no `#anchor-<seção>`, a altura real dos alvos e a medida da barra.

### 4.4 Suítes do "PR local" e cobertura

```bash
npx pnpm turbo run typecheck lint --filter=frontend --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=frontend
node scripts/check-system-names.mjs
cd apps/frontend && npx jest --listTests | grep -E "guide|bonusSeen|groupTabsState"
```

- **Metas por arquivo** (`apps/frontend/jest.config.js:38-41`): 80/80/70/80 em `./sheet/`. O `guide.ts`, o `bonusSeen.ts` e o `GuideRow.tsx` nascem com teste próprio; o `fitGuide` cobre os quatro ramos (todos, "e mais N", um botão só, lista vazia).
- **O `check-system-names`** garante que o `guide.ts` não cita sistema: os rótulos ("Virtudes", "Dons") vêm do template.
- **Sem `@tms/sheet-core`, API nem `@tms/ui`** no diff: as suítes deles não mudam. O E2E inteiro (Chromium e WebKit) roda na integração (portas fixas, um por vez).

## 5. Segurança

O pacote não muda a API, o `@tms/sheet-core` nem a validação do servidor. **O `/security-review` não é exigido** pela matriz ("Como executar", passo 4) nem pelo briefing da onda (só a mudança no core ou na validação da API). Ele passa a ser exigido se o PO escolher a marca no servidor (§3.8, ponto 3 da §9). O `/code-review` vale como em todo pacote.

| O que pode dar errado | Como o desenho evita |
|---|---|
| Esconder ou mostrar o "Concluir" vira controle de acesso | É interface. Concluir continua passando pelo `completionRefusal` no servidor, sob trava, com a revisão (`apps/api/src/sheets/creation.ts`). O cliente adulterado que mostra o botão recebe a mesma recusa de hoje |
| O "Faltam" afrouxa ou esconde um limite | Ele só lê `check.problems`, a mesma conta que o servidor repete em cada lote (`checkCreationBatch`). Nenhum limite muda. O `confirm` não entra em `problems` (§3.9) |
| A troca manual de fase libera o que o servidor recusaria | A fase é só do app desde o P05-C, e a troca já existia (o `RadioChips`). O servidor confere o saldo de bônus a cada lote, em qualquer fase |
| Texto da ficha (nome digitado) na barra ou no leitor de tela | Os itens usam só rótulos do template e números da conta, como o `problemText` (`creation.ts:224`). O `confirm` do P07-D segue a mesma regra (§3.9). Tudo sai em `Text` do React Native: sem HTML, sem markdown, sem link, sem `dangerouslySetInnerHTML` |
| A marca no aparelho adulterada ou lida por outro usuário | A chave fica no escopo do usuário (`scopeStorage`, `kv.ts:52-83`), cifrada no nativo e no IndexedDB do web, e sai no logout (`persist.tsx:283-292`). Só `"1"` conta como marcado, e o id passa pelo formato de UUID antes de virar chave. O efeito máximo de uma adulteração é a folha de aviso abrir ou não abrir: nenhuma permissão, conta ou dado depende dela |
| PII no armazenamento ou nos logs | A marca guarda só o id da ficha. Nenhum log novo. Os textos novos não vão para o Sentry: o evento do web é remontado pela lista de campos permitidos (`lib/telemetryFilter.ts`) |
| O "ir ao grupo" mostra o que o papel não lê | O alvo de uma seção que o papel não lê é `null` (§3.1), e a `SectionView` já não desenha essa seção (`SectionView.tsx:25`). O servidor nem mandou os valores |

**Checklist da organização:**

- **Validação no servidor:** a conta, o saldo e a conclusão continuam no servidor. O cliente só mostra e leva ao grupo.
- **Fail secure:** sem `check`, sem item e sem "Faltam"; marca ilegível vale como não marcada (só o aviso aparece de novo); sem `UserStorage`, só a memória da sessão.
- **Logs sem PII, senha ou token:** nada novo.
- **Dependências:** nenhuma nova.
- **Licença:** nenhum texto de livro. As frases novas são de interface, genéricas, escritas pelo time (marcadas como rascunho para revisão).

## 6. Como generaliza além do WoD

- **Os itens do "Faltam" são genéricos.** Saem dos `problems` do core, que são códigos e ids do template, e dos rótulos dos orçamentos. Um D&D 5e com point-buy (`measure: 'cost'`) mostra "Faltam: Atributos 3" pelo `POINTBUY_UNSPENT`; um sistema com prioridades por grupo (o modelo WoD) mostra "(prioridade)"; um sistema sem `creation` no template (Call of Cthulhu, Fate, PbtA) não tem conta e não mostra nada.
- **O "ir ao grupo" é genérico.** Usa as zonas, as seções e os grupos do template compilado, e as âncoras valem para qualquer layout (`groups`, `grid`, `list`, `facts`).
- **A fase é do modelo de bônus** (`freebies` no `creation` do template). Um sistema sem bônus não tem fase nem folha: o indicador só aparece com `check.freebies` (`CreationPanel.tsx:200`). O nome "pontos de bônus" continua fixo no app, como o P05-C já registrou (P05-C, pergunta 4: o rótulo do saldo no template fica para quando houver um sistema com outro nome).
- **A aba "Pontos"** é do app, com o mesmo nome em qualquer sistema. Um template com uma zona chamada "Pontos" teria duas abas iguais (pergunta 7 da §9).
- **O `confirm`** é um mecanismo genérico (aviso que não bloqueia, com alvo); o conteúdo (Dom, clã, Tradição) é de template, no P07-D.
- **Skin:** a barra e a aba usam as cores do tema, como hoje. Nada é de uma skin.

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado.** Arquivos e linhas conferidos no `3cc07f1` (§3). A D-05 aplicada, com o que não se aplica como está escrito apontado na §2 e na §9, e o ponto de extensão do P07-D combinado (§3.9).
2. **Typecheck, lint e testes** do frontend e do `@tms/e2e` (§4.4).
3. **Um teste de regressão por item** (§4.1), falhando no `3cc07f1`, e o `test:coverage` verde.
4. **`/code-review`** no diff do pacote. O `/security-review` só se a marca for ao servidor (§5). Os achados vão no resumo.
5. **Os cenários das personas, repetidos sem o defeito.** Com a API local e o seed do roteiro (só contas fictícias; §11):

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | R-18 | I-W, IW-05 (`iniciante-web.md:85-88`, `:221`), web 390: ficha nova por pontos em Criação → procurar o que falta | "Faltam: …" na barra, sem trocar de aba; tocar um item leva ao grupo; a aba se chama "Pontos" |
   | R-18 | I-A, IA-18 (`iniciante-app.md:35-37`, `:160`), iOS SE: o mesmo, sem rolar até o topo | O "Faltam" na barra fixa; o toque leva ao grupo e o VoiceOver lê o título do grupo |
   | R-18 | PO-A, POA-15 (`po-app.md:44-45`, `:203`), iOS: de Habilidades, ir ao que falta nas Vantagens | Um toque no item, sem voltar ao topo e sem passar pela aba |
   | R-18 | E-A (`experiente-app.md:40`, `:103`), Android 393 e 360: distribuir até a conta fechar | O "Faltam" diminui a cada grupo fechado; a barra não cresce; no fim, "A conta fechou: você conclui." e "Concluir criação" |
   | Achado 3 | E-W (`experiente-web.md:65`), web 390: fechar a conta | A linha do próximo passo muda junto com o botão |
   | Pergunta 4 | PO-W (`po-web.md:52`, `:121`), web 1280: procurar "Concluir" com grupo incompleto | No lugar do botão, o "Faltam" com o que impede concluir (ou o botão `aria-disabled`, se o PO escolher a alternativa da §3.4) |
   | U-07 | PO-A (`po-app.md:88`, `:252`), iOS: devolução → ficha de novo → baixar um ponto básico → repor | A folha não reaparece (bônus já gasto) |
   | U-07 | PO-A, iOS: fechar os básicos (folha) → Jogo → Criação → −1 → +1 | A folha não reaparece (marca no aparelho) |
   | U-07 | PO-W (`po-web.md:124`, `:271`), web 1280: aba Pontos | "Fase: pontos básicos" em texto, com "Usar pontos de bônus agora" como botão secundário; a folha abre uma vez, como diálogo central de 560 |

6. **Conferência no aparelho.** O roteiro completo está na **§11**. A barra com as duas linhas no Android a 360, 393 e 411 dp e a folha no iOS são obrigatórias.
7. **Resumo para a seção do pacote no PR da onda:**
   - o que mudou;
   - como foi testado;
   - os achados do `/code-review`;
   - o que muda nos seletores E2E (§4.3), para o P07-D fazer o rebase;
   - os pontos para o PO (§9) que seguem abertos.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

| # | Commit | Itens | Esforço |
|---|---|---|---|
| 1 | `feat(app): os itens do "O que falta", com o alvo na ficha` (`guide.ts`: `guideItems`, `fitGuide`, `useCreationNotices` vazio; `guide.test.ts`) | R-18 | P |
| 2 | `feat(app): ir ao grupo pela aba, pela sub-aba e por uma âncora na seção` (`groupTabsState.ts`, `SectionView.tsx`, `GroupsLayout.tsx`, `SheetView.tsx`, `context.tsx`; testes) | R-18 | M |
| 3 | `feat(app): "Faltam: …" na barra de criação, ao lado do Salvar` (`EvolveBar.guide`, `GuideRow.tsx`; testes de barra no `CreationScreen.test.tsx`) | R-18 | M |
| 4 | `fix(app): a linha do próximo passo muda quando a conta fecha` (`nextStep.ts`, `useNextStep.ts`, o anúncio; testes) | achado 3 | P |
| 5 | `feat(app): aba "Pontos", "Ver Pontos" e o "O que falta" tocável` (`SheetView.tsx`, `CreationPanel.tsx`, `DraftNoticeText.tsx`; o Jest da §4.2 e os 6 specs e o ajudante da §4.3) | R-18 | P |
| 6 | `feat(app): a fase em texto, com a troca manual secundária` (`CreationPanel.tsx`; testes) | U-07 | P |
| 7 | `fix(app): a folha de bônus só na primeira passagem de cada ficha` (`bonusSeen.ts`, a regra no `BonusNotice`, "Ver Pontos" no `onClosed`; testes) | U-07 | P |
| 8 | `test(e2e): o guia da criação e a folha de bônus a 360, 390 e 1280` (`creation-guide.spec.ts`) | R-18, U-07 | M |
| 9 | `docs: o "Faltam" na ModeBar e a aba Pontos` (`design/design-system/components.md`) | — | P |

**Por que esta ordem:**

- os itens (1) vêm antes de quem os desenha (3 e 5);
- a navegação (2) vem antes dos toques que a usam (3 e 5);
- a barra (3) e a linha (4) ficam juntas no `ModeBar.tsx` e no `nextStep.ts`, que o P07-D não toca;
- a troca de nome (5) leva o Jest e o E2E no mesmo commit: nenhum commit deixa um seletor quebrado;
- a fase (6) e a folha (7) são independentes e saem sozinhas, se a onda precisar cortar;
- o E2E (8) é escrito aqui e rodado na integração.

### 8.2 Esforço

**M**, de 4 a 6 dias, em 9 commits (6 P e 3 M). A matriz soma 1 P (U-07) e 1 M (R-18), e bate. O que pesa:

- o "ir ao grupo" é infraestrutura nova (âncoras, pedido pendente, foco nas três plataformas);
- a barra pede medida no AVD a 360, 393 e 411 dp e no iOS;
- a troca de nome toca 6 specs, o ajudante e 5 arquivos de Jest.

**Se a onda precisar cortar,** o commit 6 (fase em texto) sai sozinho. O 7 é pequeno e fecha o U-07; os dois juntos são o U-07 inteiro.

### 8.3 Riscos

- **A conta de caracteres do `fitGuide` erra no aparelho.** A folga de 0,6 em evita o corte, mas pode mostrar um item a menos do que cabe. O `onLayout` dá a largura real; a §11 confere a 360 (pergunta 1).
- **O foco programático no nativo.** O `setAccessibilityFocus` depois da rolagem pode chegar antes de a seção nova ser desenhada (pergunta 2). O pedido pendente resolve no `onLayout`, o que reduz o risco.
- **A altura da barra no iOS e no web.** A medida da onda 3 (~88) parece ter uma linha de texto só (§3.0). Se a barra com o próximo passo já tem ~104 hoje, o P05-D não acrescenta nada; se tem 88, a linha do próximo passo já estava em outro lugar, e a medida da §11 diz qual.
- **A marca da folha não vale entre aparelhos** (§2, item 1; ponto 3 da §9).
- **Os textos novos mudam fixtures** do Jest e seletores E2E (§4.2 e §4.3).
- **O "Concluir" escondido** continua, se o PO aceitar a proposta da §3.4. A alternativa custa um commit e muda o `@tms/ui`.

### 8.4 Conflitos com os pacotes da onda

A ordem proposta: **P05-D antes do P07-D.** O P05-D não toca template nem core, e deixa pronto o ponto de extensão que o P07-D preenche. A ordem dos três pacotes de template (P07-D, P10-C, P10-D) é do orquestrador e não depende do P05-D.

| Arquivo | Pacotes | Onde cada um mexe | Como resolver |
|---|---|---|---|
| `apps/frontend/sheet/creation/CreationPanel.tsx` | P05-D, P07-D, P10-D | P05-D: a fase (`:200-217`), a lista tocável (`:229-252`), a folha (`:289-344`). P07-D: o "Para confirmar com o narrador", pelo `useCreationNotices` (§3.9). P10-D (plano dele, §3.7 e §8.4): o "?" no rótulo do saldo da aba, com a frase da dica da fase (`:213-214`), que o P05-D reescreve (§3.6 e §3.7) | **Médio.** P05-D antes, como os dois planos propõem. O P07-D só implementa o hook e não reescreve o painel; o P10-D põe o "?" nos rótulos que o P05-D deixar |
| `apps/frontend/sheet/creation/guide.ts` (novo) | P05-D, P07-D | P05-D cria; P07-D implementa o `useCreationNotices` | Baixo. Contrato da §3.9 |
| `apps/frontend/sheet/creation/creation.ts` | P05-D (só leitura), P07-D, P10-C | P07-D: o nível do Dom, a Qualidade e o clã no `stepAdvice` e no `draftRefusal`. P10-C: um código de problema novo, se o mínimo da Fúria (T-85) virar problema da conta | Baixo. Se o P10-C criar um `CreationProblemCode`, o `switch` do `problemText` e o do `guide.ts` pedem um caso (o typecheck aponta). Quem entra depois acrescenta |
| `apps/frontend/sheet/SectionView.tsx`, `layouts/GroupsLayout.tsx` | P05-D, talvez P10-D | P05-D: a âncora e o alvo de foco no título. P10-D: o "?" ao lado do título, se o plano dele puser ali | Baixo. O "?" fica no `right` do `SectionHeader` ou ao lado; a âncora é o título |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | P05-D | o slot `guide` e o `closed` | Nenhum outro pacote da onda 4 mexe na barra (a conferir nos planos irmãos) |
| `e2e/tests/advantages.spec.ts` | P05-D, P07-D | P05-D: `:28`, `:93` ("Pontos"). P07-D: os fluxos do −/+ na linha (D-08) | **Médio.** P05-D antes; o P07-D faz o rebase |
| `sheet/creation/__tests__/advantages.test.tsx`, `CreationScreen.test.tsx` | P05-D, P07-D | P05-D: a aba e a fase. P07-D: a lista e as folhas | Médio. P05-D antes |
| `design/templates/*.json`, `schema.json` | P07-D, P10-C, P10-D, P15-D | o P05-D não toca | Sem conflito. O P05-D não sobe versão de template, não muda o `schema.json` e não depende da ordem do `templates:publish`. O P15-D (D-16, "História / Prelúdio") mexe nos mesmos JSON dos pacotes de template, não nos deste |

### 8.5 Arquivos tocados

- **Novos:** `apps/frontend/sheet/creation/guide.ts`, `apps/frontend/sheet/creation/GuideRow.tsx`, `apps/frontend/sheet/creation/bonusSeen.ts`, `apps/frontend/sheet/creation/__tests__/guide.test.ts`, `apps/frontend/sheet/creation/__tests__/bonusSeen.test.ts`, `e2e/tests/creation-guide.spec.ts`.
- **App:** `sheet/creation/CreationPanel.tsx`, `sheet/creation/nextStep.ts`, `sheet/creation/useNextStep.ts`, `sheet/creation/CreationContext.tsx`, `sheet/evolve/ModeBar.tsx`, `sheet/evolve/DraftNoticeText.tsx`, `sheet/SheetView.tsx`, `sheet/context.tsx`, `sheet/SectionView.tsx`, `sheet/layouts/groupTabsState.ts`, `sheet/layouts/GroupsLayout.tsx`, `sheet/SheetNav.tsx` (comentário).
- **Testes:** `sheet/creation/__tests__/CreationScreen.test.tsx`, `advantages.test.tsx`, `nextStep.test.ts`; `sheet/__tests__/SheetScreen.test.tsx`, `storyteller.test.tsx`, `sheet.layout.test.tsx`; `sheet/layouts/__tests__/groupTabsState.test.ts`.
- **E2E:** `e2e/support/creation.ts`; `e2e/tests/advantages.spec.ts`, `layout.spec.ts`, `creation-state.spec.ts`, `narrator.spec.ts`, `lifecycle.spec.ts`, `creation-feedback.spec.ts`.
- **Docs:** `design/design-system/components.md`.
- **Não toca:** `packages/sheet-core`, `packages/ui`, `apps/api`, `packages/db`, `design/templates`, `apps/frontend/lib/persist.tsx`, `doc/plano-v4.md`.

## 9. Perguntas abertas (técnicas)

⚙ = resposta só no simulador, no aparelho ou no E2E.

1. ⚙ **A barra no `compact`.** A medida da onda 3 no iOS (~89) e no web (~88) bate com uma linha de texto, e a do Android (110), com duas (§3.0). Com o "Faltam" na linha dos botões, a altura deve ficar igual à de hoje em cada plataforma. Medir a 360, 393 e 411 dp no AVD, no SE e no web a 390, com a conta aberta e fechada, e anotar quantas linhas de texto havia. Se a folga de 0,6 em do `fitGuide` mostrar um item a menos do que cabe, trocar pela medida do texto no `onLayout`.
2. ⚙ **O foco depois de ir ao grupo.** O `setAccessibilityFocus` no iOS e no Android chega depois da rolagem? Vale somar um `announceForAccessibility(item.text)`, ou o título do grupo basta?
3. **As âncoras em toda seção.** O `onLayout` passa a valer em todas as seções do painel, não só nas com sub-abas no celular. O custo é uma chamada por seção por layout, sem re-render. Confirmar no perfil do Pixel 3a (o mais lento da conferência).
4. **A marca por ficha ou uma lista só.** O plano usa uma chave por ficha (`seen:bonus:<id>`), apagada no logout. Uma lista única com teto (por exemplo, as 200 mais recentes) ocupa menos chaves, mas cada gravação reescreve a lista.
5. **"e mais N" leva à aba ou abre uma folha?** O plano leva à aba Pontos, onde a lista inteira já está e é tocável. Uma folha com a lista seria mais uma `BottomSheet` na tela de criação.
6. **O `guide.ts` no core para o P09-D.** O progresso na Mesa (D-10, "Atributos ✓ · Habilidades: faltam 4 · Bônus: restam 2 de 15") é o mesmo resumo, no servidor ou na Mesa. Se o P09-D precisar, a parte sem tela (`missingSummary`) sobe para o `@tms/sheet-core` lá, com a meta de 95% por arquivo do core e o `/security-review` que a mudança no core pede.
7. **Template com uma zona chamada "Pontos".** A aba do app teria o mesmo nome de uma aba do template. Nenhum template do produto tem isso (`zoneLabels` só renomeia `powers` para "Vantagens"). Tratar quando aparecer ("Pontos da criação") ou já recusar na validação do template?
8. **Ordem dos itens.** O plano põe os que impedem salvar primeiro e depois a ordem da ficha. A alternativa é só a ordem da ficha, com o `blocking` marcado pela cor e pelo texto.

**Pontos para o PO** (não decididos aqui; ver §2):

1. **"Concluir criação" escondido até a conta fechar** (pergunta 4 do onda-3 §8; P03-D, pergunta 1). Recomendação técnica: continua escondido, e o "Faltam" ocupa o lugar dele (§3.4). A alternativa: visível com `aria-disabled` e tocável, com uma prop nova no `Button` e o "Faltam" numa linha própria (+56 dp no Android).
2. **As frases novas** (rascunho do time, para revisão): a linha da conta fechada (§3.5), o "Faltam:"/"Falta:", o "e mais N", o "Faltam N itens", o indicador e os botões da fase (§3.7), "Ver Pontos" (§3.6), "Para confirmar com o narrador" (§3.9) e o anúncio da conta fechada.
3. **A folha de bônus num aparelho novo ou depois do logout.** A marca fica no aparelho; a folha pode aparecer de novo uma vez, só se nenhum bônus tiver sido gasto. A alternativa é a marca no servidor, no `creation` do jsonb, com rota, AuthZ do dono, decisão sobre a revisão e `/security-review` (§3.8).
4. **O "confirme com o narrador" fora da barra.** Ele aparece na aba Pontos e na confirmação de concluir, não no "Faltam" da barra (§2, item 4; §3.9).
5. **"Orçamento" nas regras da crônica** (`CreationSettings.tsx:189`) continua com o nome; só a aba da ficha muda (§2, item 5).
6. **A prioridade no "Faltam"** aparece como "Atributos (prioridade)", um item por orçamento, e não "Físicos 7" (§2, item 2).
7. **Seguem abertos, das ondas anteriores:** [onda-2.md](onda-2.md) §6, ponto 6 (o extrato da conta, R-17) e [onda-3.md](onda-3.md) §6, ponto 3 (ficar no Editar depois de salvar). Os outros pontos do onda-1 §6, do onda-2 §6 e do onda-3 §6 não tocam este pacote e continuam abertos.

**Para o orquestrador: achados da onda 3 sem pacote que ficam perto deste** ([onda-3.md](onda-3.md) §11):

- **Achado 2 (o "Salvar" do Editar leva para Jogo)** é o ponto 3 do onda-3 §6. Ele toca a criação livre, não a por pontos: na Criação, a ficha já fica depois de salvar, e o "Faltam" não depende dele.
- **Achado 7 ("Nenhum Qualidade")** é do P10-C (T-66). A lista do "O que falta" não usa o texto da lista vazia.
- O achado 1 (a folha "busy" que espera as rebuscas) não toca a folha de bônus, que não tem envio.

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

**Pontos para o PO e perguntas técnicas: o que foi aplicado.** Nenhum foi decidido pelo PO. Seguiu-se a recomendação deste plano:

- **"Concluir criação" escondido** até a conta fechar, com o "Faltam" no lugar dele (§3.4; onda-4 §6, ponto 2). O `@tms/ui` não mudou.
- **A marca da folha de bônus no aparelho** (§3.8; onda-4 §6, ponto 4), sem rota nem AuthZ nova.
- **O "confirme com o narrador" fora da barra** (§3.9; onda-4 §6, ponto 5): só na aba Pontos e na confirmação de concluir.
- **"Orçamento" das regras da crônica** (`CreationSettings.tsx`) não mudou; só a aba da ficha.
- **A prioridade no "Faltam"** é "Atributos (prioridade)", um item por orçamento.
- **Pergunta 4:** uma chave por ficha (`seen:bonus:<id>`). **Pergunta 5:** "e mais N" leva à aba, sem folha. **Pergunta 8:** os que impedem salvar primeiro, depois a ordem da ficha.
- **Perguntas 1, 2 e 3** (altura da barra, foco depois da rolagem, custo das âncoras no Pixel 3a) ficam para o roteiro da integração (§11).

**Desvios:**

1. **Âncoras por grupo, não só por seção** (§3.2). No V20, as Virtudes, as Disciplinas e os Antecedentes são grupos da seção "Vantagens" (`advantages`), sem sub-abas, e a seção é longa: rolar até o começo dela deixaria o grupo fora da tela. O grupo com título à vista (`GroupsLayout`) virou âncora, medida dentro da seção por uma cadeia de `onLayout` (seção → layout → corpo → grupo), e o pedido prefere a âncora do grupo à da seção. O id no DOM é `anchor-<seção>-<grupo>` (`#anchor-advantages-virtues`); o `#anchor-virtues` e o `section-virtues` da §4.3 não existem no V20, e o E2E usa os ids reais. Com sub-abas (Atributos, Habilidades no celular), a sub-aba é escolhida e a âncora é a da seção.
2. **O pedido pendente resolve um quadro depois** da primeira âncora medida (`requestAnimationFrame`), para a âncora do grupo chegar no mesmo layout que a da seção. Continua sem timer de espera: se a âncora nunca for medida, nada rola.
3. **O "Em jogo" e a aba Pontos também são âncoras.** O "Em jogo" é medido na rolagem (`SCROLL_ROOT`), e o toque abre o bloco recolhido antes. Na aba Pontos, o painel (`creation-panel`), o "O que falta" (`creation-missing`) e "Onde foram os bônus" (`creation-ledger`).
4. **O bônus acima do saldo leva a "Onde foram os bônus"** por um alvo próprio (`LEDGER_TARGET`), em vez de `target: null`. O `null` ficou para a seção que o papel não lê, e leva à lista inteira da aba Pontos.
5. **O exemplo de 411 dp da §3.3** ("Faltam: Disciplinas 3 · Virtudes 7 · e mais 1", 45 caracteres) não cabe na conta da própria §3.3: a 285 dp, com 0,6 em, o slot leva ~36 caracteres. A 411, a barra mostra um item e o "e mais 2". Os testes do `fitGuide` seguem a conta. Se a medida no aparelho mostrar que cabe mais, a folga muda (pergunta 1).
6. **O anúncio da conta fechada fica no `BonusNotice`**, não no `useNextStep`: é ele que sabe se a folha abriu na mesma passagem. A linha do próximo passo continua no `nextStepCopy({ closed })`.
7. **A memória da sessão da marca é por storage** (um `WeakMap` com o `UserStorage` como chave): um login novo, mesmo do mesmo usuário, é outro storage e começa sem a marca, como o disco depois do `clear()` do logout. Sem storage (testes), uma memória do módulo, que os testes zeram (`resetBonusSeenMemory`).
8. **O foco no app** usa `AccessibilityInfo.sendAccessibilityEvent(view, 'focus')` no contêiner do título, não o `setAccessibilityFocus(findNodeHandle(...))`, porque o `SectionHeader` do `@tms/ui` não expõe a ref do título e o pacote não muda o `@tms/ui`. Se o VoiceOver ou o TalkBack não acharem o título dentro do contêiner, é a pergunta 2.
9. **No E2E da folha uma vez,** a ficha é salva antes de recarregar. O rascunho local pode voltar depois do `reload`, e então a ficha abriria com os básicos fechados e a passagem não aconteceria de novo.
10. **`useFreebiesNotes`** soma a linha do "confirme com o narrador", então ela aparece também na confirmação de "Aprovar ficha" do narrador.

**Depois do `/code-review` (high), na própria branch:**

11. **Zona sem aba** (a identidade, ou o "Em jogo" quando vira o dock): o alvo cai no `MISSING_TARGET`, em vez de um pedido que nunca se resolve. As abas ficam num `Set` memoizado.
12. **O pedido expira em 1,5 s** (`JUMP_TTL_MS`), conferido na hora da medida, sem timer, e é esquecido na troca de aba à mão (`cancelJump`). Isso revê o "sem timer" do desvio 2: a espera continua sem timer, e um pedido velho não rola mais a ficha.
13. **A faixa que cresce depois do salto:** quando a altura da faixa muda até 1 s depois (as sub-abas da seção nova), o destino é recalculado e a rolagem corrigida, até duas vezes, sem mover o foco de novo.
14. **O alvo do foco é o texto do título** (papel `header`), num `AnchorHeader` do app, com o mesmo desenho do `SectionHeader`, porque o `@tms/ui` não expõe a ref do título e este pacote não o muda. Isso substitui o desvio 8 (o contêiner não era elemento de acessibilidade). No "Em jogo", o alvo é o próprio botão que recolhe. A troca por uma prop `titleRef` no `SectionHeader` do `@tms/ui` fica como sugestão: é aditiva, mas pede a conferência no nativo (S-01).
15. **Com aprovação, o anúncio da conta fechada** diz "Você pode enviar ao narrador pela barra.", como o botão e a linha.
16. **"Onde foram os bônus" sem extrato** não deixa âncora velha: o id da âncora é nulo sem extrato.
17. **O `useGuideItems`** assina o `check` por referência e monta a lista num `useMemo`. O filtro dos `confirm` saiu, porque o `guideItems` só produz `blocking` e `missing`, e os `confirm` vêm do `useCreationNotices` (o contrato do P07-D).
18. **`basicsClosed`** é a regra dos grupos, e o `basicsDone` é ela mais o saldo de bônus. A fase em texto usa o `basicsClosed`.
19. **A cadeia de âncoras relativas** (seção → layout → corpo → grupo, `GroupsLayout`) continua. Trocar por `measureLayout` no momento do salto mediria o destino de verdade e tiraria as três âncoras intermediárias, mas o `measureLayout` é assíncrono, precisa da ref do painel e não roda no Jest (o mock não chama o callback): os testes da navegação passariam a depender de mocks de medida. Fica para depois, se o roteiro mostrar um salto fora do lugar. Até lá, um conteúdo novo entre o corpo e o grupo, fora dessa cadeia, desloca o destino.
20. **"Jest did not exit" no `pnpm test`:** os arquivos novos passam com `--detectOpenHandles` sem nenhum handle aberto, e o `jest` direto do frontend (com e sem `--coverage`) termina. O travamento aparece só pelo turbo (`turbo run test --filter=frontend`) e **vem de antes do pacote**: com o código do app e do E2E da base (`78de35c`) no mesmo worktree, os 1388 testes passam e o Jest também não termina. Não é do P05-D.

**Depois do roteiro manual do web (a branch recebeu a onda em `3599998`, merge `0c1b570`):**

21. **A3: a faixa errava a seção depois de abrir ou fechar o "Em jogo"** (a 390, com os Atributos no topo, ela mostrava os Talentos, e daria para escolher a prioridade do grupo errado). O código da faixa é da onda 3, mas o "ir ao grupo" usa as mesmas posições. A causa é que, no react-native-web, o `onLayout` só dispara quando o tamanho da vista muda: o painel e as seções desciam sem avisar. A correção:
    - no web, o `onContentSizeChange` da rolagem chama o `remeasure` do store das sub-abas;
    - o painel, o "Em jogo", as seções e as âncoras leem a posição de novo (`offsetTop`, relativo à vista-mãe, que no RN-web tem `position: relative`, como o `onLayout`);
    - no app, nada muda, porque o `onLayout` já avisa quando a posição muda.

    O Jest não reproduz o RN-web, porque o `onLayout` é disparado à mão. O teste do store prova a troca de seção com a remedida. O passo "A3 a 390" do `layout.spec.ts` abre e fecha o "Em jogo" e confere a faixa nos Atributos e nas Habilidades; ele é rodado na integração.
22. **A1: o narrador em Leitura via e acionava "Usar pontos de bônus agora".** A mudança era só local, mas contrariava o R-18e. A troca manual da fase agora só aparece na Criação (`mode === 'create'`), e em Leitura a fase fica só como texto.

**Depois do roteiro do Android (a branch recebeu a onda em `1458f76`):**

23. **B1: o salto para um grupo de outra aba parava no topo da aba.** No AVD a 393, no V20 e no W20, "Habilidades: escolha a prioridade." ficava nos Atributos, e "Dons 3" caía no Renome. A causa é que o salto saía no primeiro quadro em que a âncora existia, com a aba recém-montada ainda sem a medida final; o `settle` só olhava a altura da faixa. A correção:
    - o salto espera um quadro sem medida nova (até 6 quadros);
    - dentro da janela do pedido (1,5 s, que também passa a ser a da correção), toda medida nova da âncora, do painel ou da faixa que mude o destino corrige a rolagem, sem mover o foco de novo, até 6 vezes;
    - no web, onde o destino já vinha certo, a correção não dispara, porque o destino não muda.

    Isso revê o desvio 13 e o teste antigo "medir de novo não rola de novo". O teste do store reproduz a medida provisória seguida da final. A conferência no AVD fica para o roteiro.
24. **B2: "falta 1 ponto básicos."** O `basicUnits` dá o singular e o plural ("1 ponto básico", "3 pontos básicos") e, nos grupos que contam itens (os Dons), "itens básicos". A mesma junção foi corrigida no contador falado ("1 de 1 ponto básico"), na recusa com orçamento 1 ("o 1 ponto básico já foi usado") e na dica "falta 1 de 3". Nenhum teste nem spec esperava o texto antigo.

## 11. Testes manuais (web, Android com AVD, iOS com idb)

Roteiro para conferir cada item na interface, nas três plataformas, com a API local e o seed do roteiro. Só contas fictícias. Ele detalha o passo 6 da §7. A coluna "Resultado" fica em branco e é preenchida na integração. Nenhum resultado é "ok" sem a evidência; quando uma plataforma não puder ser conferida, o resultado diz "não conferido" e por quê.

### 11.a Preparação

1. **Banco e API:**
   - `npx pnpm db:up`, `npx pnpm db:migrate` e `npx pnpm templates:publish --published`;
   - API em `npx pnpm dev:api` (porta 3001) e o Metro em `cd apps/frontend && npx expo start` (porta 8081).
2. **Seed:** `npx pnpm seed:roteiro --fichas-criacao > <scratchpad>/p05d/seed-<plataforma>.log 2>&1`.
   - **A saída vai só para o log no scratchpad,** porque o seed imprime os e-mails e a senha. Ler com `grep -v -i senha`. A senha é a constante do `scripts/seed-roteiro.ts` e não é escrita aqui, nas evidências nem nos scripts (os scripts de login a leem em tempo de execução, sem imprimir).
   - **Contas:** N (`roteiro_narrador`), J1 (`roteiro_jogador1`), J2 e N2, todas `@roteiro.test`.
   - **Crônicas:** "Vampiro v4", "Mago v4" e "Lobisomem v4" (por pontos), além das de criação livre. O `--fichas-criacao` liga a aprovação em "Mago v4".
   - **Fichas de J1 que o roteiro usa:** "Isadora Web/Android/iOS" em "Vampiro v4", com as prioridades e todos os pontos básicos menos 1 de Vigor (a folha de bônus no próximo "+"); "Ficha Pontos R" em "Vampiro v4", só com o nome (o "Faltam" do começo); "Ficha Aprovação R" em "Mago v4", com a conta fechada (a linha "envie ao narrador").
   - Entre dois seeds, esperar 15 min (o limite de aceites por conta, memória `device-testing-setup`): um seed por plataforma.
3. **O que o roteiro cria pela tela** (uma vez por plataforma, só com o nome): J1 cria "Guia Lobo R" em "Lobisomem v4" e "Guia Mago R" em "Mago v4", para o "Faltam" do W20 e do M20 (Dons e Esferas).
4. **Seed estendido (opcional, a combinar na consolidação).** Se a onda já estender o `--fichas-criacao` para o P07-D ou o P10-C (um Ahroun ou um Lupino, um Mago fora da Ordem de Hermes), as duas fichas do item 3 entram na mesma extensão, só com o nome. Não vale uma opção própria só para elas.
5. **Evidências:** no scratchpad da sessão, com o nome `p05d-<plataforma>-<ID>-<passo>.png`. Sem e-mail visível na captura.

### 11.b Web (Playwright, Chromium; WebKit onde indicado)

- **Script:** `<scratchpad>/p05d/web.mjs`, com o `playwright` do `node_modules`, contra `http://localhost:8081` (Metro). Reiniciar o Metro com `--clear` antes da rodada (o bundle do web fica velho depois de editar).
- **Viewports exatas:** `{ width: 390, height: 844 }`, `{ width: 360, height: 740 }` e `{ width: 1280, height: 800 }`.
- **WebKit:** os passos R-18a e U-07c rodam também em `webkit.launch()`.
- **Seletores por papel e rótulo:**
  - `getByTestId('mode-bar')` e, dentro dele, `getByText('Faltam:')` e `getByRole('button', { name: /^Virtudes \d+/ })`;
  - `getByRole('tab', { name: 'Pontos', exact: true })`;
  - `getByRole('button', { name: 'Ver Pontos', exact: true })`;
  - `getByTestId('next-step')`, `getByTestId('creation-action')`, `getByTestId('creation-phase')`, `getByTestId('creation-phase-switch')`;
  - `getByTestId('bonus-notice')` e o painel `locator('[data-testid="bottom-sheet-root"] > [aria-modal="true"]')`.
- **Medidas:** a altura da `mode-bar` pelo `boundingBox()`; o painel da folha depois da entrada (não a camada); o `document.activeElement.id` depois de ir ao grupo.
- **Um `page.screenshot` por passo.**

### 11.c Android (AVD)

- **AVD:** `Pixel_3a_API_34_extension_level_7_arm64-v8a` (1080 × 2220, 440 dpi = 393 dp), boot rápido com `-gpu host`.
- **APK:** o `assembleDebug` arm64 da integração, com `JAVA_HOME` no JBR do Android Studio.
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Larguras da barra (obrigatórias):** `adb shell wm density 480` (360 dp), padrão (393 dp) e `adb shell wm density 420` (411 dp); `adb shell wm density reset` no fim.
- **Navegação:**
  - `adb shell uiautomator dump /sdcard/ui.xml` e `adb pull`, para achar o alvo pelo `text` ou pelo `content-desc` e tocar no centro do `bounds` com `adb shell input tap X Y`;
  - a altura da barra sai do `bounds` da `View` com `content-desc` "Modo Criação";
  - `adb shell input keyevent 4` para o voltar do Android com a folha de bônus aberta;
  - o `input text` não digita acento: o roteiro não precisa digitar (só "+", "−" e toques).
- **TalkBack (para o foco do "ir ao grupo"):** `adb shell settings put secure enabled_accessibility_services com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService`, e desligar no fim. Se o TalkBack não estiver no AVD, o passo fica "não conferido".
- **LogBox:** dispensar o banner antes de tocar na barra (ele cobre a parte de baixo e engole o toque).
- **Tempo:** o emulador sob carga dá falso "busy". Tempo medido aqui não é evidência.

### 11.d iOS (simulador, com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, e iPhone 17, iOS 26.5.
- **Build Debug com "Sign to Run Locally",** em `apps/frontend/ios`. Sem assinatura, o app não loga: o keychain responde `-34018` ao `expo-secure-store` ([onda-3.md](onda-3.md) §11, item 15). O CI continua sem assinatura.

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
  - `idb ui describe-all --udid <UDID>` para achar o alvo pelo `AXLabel` ("Virtudes 7: faltam 7 pontos básicos", "Aumentar Vigor", "Entendi", "Ver Pontos") e tocar no centro do `frame` com `idb ui tap X Y`;
  - a altura da barra sai do `frame` do elemento "Modo Criação";
  - `idb ui swipe` para rolar; `idb screenshot --udid <UDID> <arquivo>`;
  - **limites:** o idb não faz o gesto de borda (usar o "‹"); não digita fora do ASCII; digita como teclado físico. O roteiro não precisa digitar.
- **VoiceOver:** o foco depois de "ir ao grupo" é conferido pelo `describe-all` (o elemento com foco de acessibilidade) quando disponível; senão, "não conferido" com o motivo.
- **Deep link:** `xcrun simctl openurl <UDID> 'tms://characters/<id>'` pede "Abrir com 'TMS'?". Achar "Abrir" no `describe-all` e tocar.

### 11.e Tabela por item

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| R-18a | Web 390 e 360 (Chromium e WebKit) | J1 | "Ficha Pontos R" em Criação → ler a barra | "Faltam 5 itens" a 360 (ou itens inteiros, se couberem) e o "Salvar" na mesma linha; nada cortado; a altura da barra anotada | `p05d-web390-R-18a-1.png`, `p05d-web360-R-18a-2.png` | |
| R-18b | Web 390 | J1 | Escolher as prioridades de Atributos e Habilidades → ler a barra → tocar o primeiro item das Vantagens | "Faltam: Disciplinas 3 · e mais N" (ou parecido); o toque seleciona "Vantagens", o grupo começa logo abaixo da faixa fixa e o foco fica no título | `p05d-web390-R-18b-1..3.png` | |
| R-18c | Web 360 | J1 | Tocar "e mais N" | A aba "Pontos", com o foco no título "O que falta"; cada linha é botão e leva ao grupo | `p05d-web360-R-18c-1.png`, `-2.png` | |
| R-18d | Web 1280 | J1 | "Guia Mago R" e "Guia Lobo R" em Criação | A barra numa linha só: texto, próximo passo, "Faltam" com Esferas ou Dons, "Salvar"; os itens levam ao grupo | `p05d-web1280-R-18d-1.png`, `-2.png` | |
| R-18e | Web 390 | N | "Ficha Pontos R" de J1 → Leitura → aba "Pontos" | A aba se chama "Pontos"; os itens levam ao grupo; nada fica editável | `p05d-web390-R-18e-1.png` | |
| R-18f | **Android 360, 393 e 411 dp (obrigatório)** | J1 | "Ficha Pontos R" → escolher as prioridades → distribuir até a conta fechar, conferindo a barra a cada grupo | Nas três larguras: o "Faltam" e o "Salvar" na mesma linha, sem transbordar; a barra com a mesma altura antes e depois de a conta fechar (anotar do `uiautomator dump`); os alvos com 48 dp; no fim, "A conta fechou: você conclui." e "Concluir criação" | `p05d-and360-R-18f-1..3.png`, `p05d-and393-R-18f-4.png`, `p05d-and411-R-18f-5.png` | |
| R-18g | Android 393 | J1 | Com o TalkBack ligado, tocar um item do "Faltam" | O grupo à vista e o foco do TalkBack no título do grupo | `p05d-and393-R-18g-1.png` | |
| R-18h | iOS SE e iPhone 17 | J1 | "Ficha Pontos R" (seed da plataforma) → ler a barra → tocar um item | O "Faltam" na barra fixa, à esquerda do "Salvar"; o toque leva ao grupo; no 17, a barra abaixo do conteúdo e acima do indicador de início; a altura da barra anotada do `describe-all` | `p05d-iosSE-R-18h-1..2.png`, `p05d-ios17-R-18h-3.png` | |
| Achado 3 | Web 390 e Android 393 | J1 | "Isadora …" → "+" no Vigor → "Entendi" | A linha passa de "Você conclui quando a conta fechar." a "A conta fechou: você conclui." junto com o "Concluir criação" | `p05d-web390-A3-1.png`, `p05d-and393-A3-2.png` | |
| Achado 3b | Web 390 | J1 | "Ficha Aprovação R" (conta fechada, aprovação ligada) | "A conta fechou: envie ao narrador." e "Enviar para aprovação" | `p05d-web390-A3b-1.png` | |
| U-07a | Web 390 | J1 | "Isadora Web": "+" no Vigor → folha → "Entendi" → "−" → "+" | A folha abre uma vez; no "−" e "+", não abre | `p05d-web390-U-07a-1..3.png` | |
| U-07b | Web 390 | J1 | Depois do U-07a: Jogo → Criação → "−" → "+"; depois recarregar a página → "−" → "+" | Nenhuma folha nos dois casos | `p05d-web390-U-07b-1.png`, `-2.png` | |
| U-07c | Web 1280 (Chromium e WebKit) | J1 | Outra ficha quase pronta (Android ou iOS da Isadora, com outra conta de contexto, ou uma ficha nova preparada) → folha → Esc; de novo, em outra ficha, "Ver Pontos" | Diálogo central de 560, medido no painel; o Esc fecha e o foco volta ao "+"; "Ver Pontos" seleciona a aba "Pontos" depois de a folha sair | `p05d-web1280-U-07c-1..3.png` | |
| U-07d | **iOS SE e iPhone 17 (obrigatório)** | J1 | "Isadora iOS": "+" no Vigor → folha → "Entendi" → "−" → "+" → "‹" → abrir a ficha de novo → "−" → "+" → gastar 1 bônus e repetir | A folha abre só na primeira vez; não reabre na mesma tela, depois de reabrir a ficha nem com bônus gasto | `p05d-iosSE-U-07d-1..4.png`, `p05d-ios17-U-07d-5.png` | |
| U-07e | iOS SE | J1 | Numa ficha nova quase pronta: folha → "Ver Pontos" | A folha sai e a aba "Pontos" abre depois (o `onClosed`): sem tela congelada nem folha presa | `p05d-iosSE-U-07e-1.png`, `-2.png` | |
| U-07f | Android 393 | J1 | Numa ficha quase pronta: folha → voltar do Android | O voltar fecha a folha, não a tela; a folha não reabre | `p05d-and393-U-07f-1.png` | |
| U-07g | Web 390 e 1280 | J1 | Aba "Pontos" antes e depois de fechar os básicos; "Usar pontos de bônus agora" com básicos faltando | "Fase: pontos básicos" como texto; o botão muda para "Fase: pontos de bônus" e oferece "Voltar aos pontos básicos"; depois de fechar, sem botão de voltar | `p05d-web390-U-07g-1..3.png` | |

### 11.f Acessibilidade mínima

- **O "Faltam" é lido como texto, e os itens são botões:**
  - **web (DOM):** "Faltam:" é texto; cada item é `button` com nome que começa pelo texto visível ("Virtudes 7: faltam 7 pontos básicos"); "e mais N" é `button`; depois do toque, o `document.activeElement` é o `#anchor-<seção>`;
  - **Android (`uiautomator dump`):** um `TextView` "Faltam:"; cada item com `clickable="true"` e o `content-desc` do nome; os `bounds` com pelo menos 48 dp de altura;
  - **iOS (`idb ui describe-all`):** "Faltam:" com o traço de texto estático; cada item com papel de botão e o `AXLabel` do nome; `frame` com pelo menos 44 pt.
- **O indicador de fase é texto, não só cor:** "Fase: pontos básicos" aparece como texto nas três árvores, e não há `radio`. O botão da troca tem o nome do que faz.
- **A linha da conta fechada é texto** (`next-step`), e a troca não depende da cor. A captura em escala de cinza mostra o mesmo.
- **A folha de bônus:** o título "Começaram os pontos de bônus" é o nome do diálogo; "Entendi" e "Ver Pontos" são botões.

### 11.g Limpeza

- Parar a API e o Metro.
- Desligar o AVD (`adb emu kill`) e os simuladores (`xcrun simctl shutdown all`).
- `adb shell wm density reset`; desligar o TalkBack, se foi ligado (`adb shell settings delete secure enabled_accessibility_services`).
- Encerrar o `idb_companion` e conferir com `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` que nada ficou escutando.
- Manter as capturas e os logs do seed só no scratchpad. Nada vai para o repositório.

### 11.h Quando uma plataforma não puder ser conferida

O resultado diz "não conferido" e o motivo, por exemplo:

- "o TalkBack não está instalado neste AVD";
- "o build do iOS falhou em …";
- "o idb não mostra o foco do VoiceOver no `describe-all`".

O passo fica para a integração ou para o roteiro antes do release. Nunca "ok" sem a evidência.
