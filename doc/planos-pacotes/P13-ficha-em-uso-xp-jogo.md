# P13 · Ficha em uso: XP, evolução e Jogo: plano de implementação

> Plano · 2026-11-05 · base conferida: `onda/5-narrador-entrada-uso` em `05c5d7d`

Pacote [P13 da matriz](../testes/2026-11-01/matriz-achados.md#p13): onda 5 (Narrador, entrada, uso e documentação), correção, pré-requisito P04-D (mergeado na onda 3, `93718c0` e `d14118b`). Não aplica decisão de produto. Ao fim do pacote:

- "Solicitar evolução" mostra os traços agrupados pelas seções e grupos do template, com busca. A opção tocada fica marcada, e o resumo com "Enviar pedido" fica fixo no rodapé da folha;
- o que o servidor recusaria aparece bloqueado com o motivo, perto do toque: "Enviar pedido" sem saldo ("Faltam 4 XP"), o traço com pedido pendente, o traço no máximo e "Gastar 1 Força de Vontade" na ficha travada. O controle bloqueado continua tocável (`aria-disabled`), e o toque explica;
- o toast de gastar e a linha do desfazer no Histórico dizem o valor efetivo ("Sangue 10 → 9" e "Sangue: 9 → 10"), com teste de regressão do "De efetivo" do [plano-v0.md](../plano-v0.md) l.56;
- "Dados" tira o resultado do topo quando a parada muda, e a lista do slot separa os grupos ("Atributos" e "Em jogo" no W20; "Atributos" e "Esferas" no M20);
- Citação, Notas e Deformidade (W20) ficam editáveis no Editar e na Criação, como os outros textos;
- "Peça ao narrador." ganha o atalho "Solicitar evolução", que abre a Experiência com o traço já escolhido;
- "Conceder XP" e "Ajustar XP" aceitam o valor digitado.

O pacote não remove campo, não muda regra do jogo e não afrouxa limite:

- o custo de XP continua o do `@tms/sheet-core` (`costOf`), conferido de novo no envio e na aprovação (`apps/api/src/xp/requests.ts:242-273`). O saldo insuficiente continua `XP_INSUFFICIENT_BALANCE` (409), e o pedido pendente, `XP_REQUEST_PENDING` (409);
- a rolagem com gasto na ficha travada continua recusada (`rollPolicy`, `packages/sheet-core/src/policy.ts:101-111`; `apps/api/src/rolls/routes.ts:323-336`). O app só deixa de oferecer o que vai ser recusado;
- o desfazer continua recusando quando a ficha mudou depois. O que muda no servidor é o texto do Histórico (o "para" efetivo) e a comparação do desfazer quando o caminho está vazio (seção 3.3);
- nenhum template muda. O T-79 é resolvido no app, sem chave nova (seção 3.4);
- o servidor continua a autoridade. As Notas do Narrador continuam privadas e com o fluxo de edição de hoje (seção 3.5).

Todas as linhas citadas são da ponta `05c5d7d`. A matriz cita o `1db3db9`, de antes das ondas 1 a 4. Onde a causa provável dela está errada ou incompleta, a seção 3 diz.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md): legenda (l.1-13), "Ondas e pacotes", "Decisões de produto" (l.63-84), "Como executar" (l.85-106), "Onda 5" (l.511-517) e §P13 (l.560-579) | Itens, "PR local" e critério de saída da onda |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §4.1, passo 16 (U-01), e §8 (plano-v4 §1.8, U-02) | Origem de U-01 e U-02 |
| [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) §7 | T-50, T-53, T-77, T-79 e T-84 |
| Notas: [qa-web](../testes/2026-11-01/notas/qa-web.md) (QAW-32), [po-web](../testes/2026-11-01/notas/po-web.md) (POW-17, POW-18, POW-31, POW-33), [po-app](../testes/2026-11-01/notas/po-app.md) (POA-22, POA-30, POA-36, POA-37, POA-45), [iniciante-web](../testes/2026-11-01/notas/iniciante-web.md) (IW-25), [experiente-app](../testes/2026-11-01/notas/experiente-app.md) (EA-27) | Cenários do critério de pronto (§7) e do roteiro manual (§11) |
| [plano-v0.md](../plano-v0.md) l.56 ("De" efetivo), Etapa 21 (Dados); [plano-v3.md](../plano-v3.md) Etapas 4 a 6 (política e trava); [plano-v4.md](../plano-v4.md) Etapa 8 e §1.8 (XP) | O comportamento que o pacote mantém e a regressão do T-53 |
| [P05-C](P05-C-feedback-conta.md) §3.0 e §3.8; [P04-C](P04-C-ciclo-vida-ficha.md); [P07-C](P07-C-vantagens-folhas.md) §3.1; [P10-C](P10-C-template-derivados-ordem.md) §3.7 e pergunta 8; [P07-D](P07-D-vantagens-regras-catalogo.md) §3.4 | A recusa perto do toque (`markSoftDisabled`, `useRowFeedback`), o `defaultStored` e o "permanente — → 4" |
| [P06](P06-componentes-acessibilidade.md) e [P08](P08-layout-teclado.md) §3 e §3.14 | `Choice`, `BottomSheet` (rodapé, folha central de 560) e o formato do "o que muda" |
| [P09-C](P09-C-narrador-mesa.md) (R-09, Notas privadas) e [P11](P11-bastidores-npc.md) | As Notas do Narrador e a folha que espera as rebuscas |
| [onda-2.md](onda-2.md) §4.2 e §6 (ponto 5); [onda-3.md](onda-3.md) §6 (ponto 3) e §11 (achados 1 e 2); [onda-4.md](onda-4.md) §4.5, §4.7, §6 (último item da tabela) e §11 (achados 4 a 7) | Pontos do PO em aberto, o contrato do `aria-disabled` tocável e os achados sem pacote |

---

## 1. Objetivo e itens

**Objetivo (matriz).** Pedir e conceder XP sem rolar listas longas; controles que o servidor recusaria já aparecem desabilitados com o motivo; toasts, Dados e o Sobre corretos no modo Jogo e no Editar.

| ID | Sev. | Em uma linha | Onde está (conferido na ponta) |
|---|---|---|---|
| T-50 | média | "Solicitar evolução": de 60 a 70 chips planos, sem grupo nem busca; as caras não aparecem bloqueadas; o resumo e "Enviar pedido" ficam no fim, a ~3.000 px | `apps/frontend/sheet/xp/ExperienceSheet.tsx:292-413` (`RequestPicker`; os chips em `:336-353`) e `:415-463` (`PickedRequest`, desenhado depois da lista, em `:379-410`); `sheet/xp/candidates.ts:28-62` (lista plana) |
| T-53 | média | Toast "Sangue — → 9" numa ficha nova; Histórico do desfazer "Sangue: 9 → —" | Toast: `sheet/views/resource/ResourceSheet.tsx:47-50` e `sheet/views/track/TrackSheet.tsx:149` (`describeBatch` sem `withEffectiveFrom`). Histórico: o inverso grava `to: null` (`packages/sheet-core/src/events.ts:162-166`, `group.ts:165-169`), e o servidor guarda o `to` cru (`apps/api/src/sheets/events.ts:397-412`, `apps/api/src/chronicles/operations.ts:226-236`) |
| T-77 | baixa | "Enviar pedido" ativo com "o servidor vai recusar"; "Gastar 1 Força de Vontade" oferecido na ficha travada | `ExperienceSheet.tsx:437-460` (o botão só fica desabilitado sem rede, `:458`); `sheet/dice/DiceSheet.tsx:163-170` (o `Toggle` do boost não lê a política) |
| T-79 | baixa | O resultado anterior fica na tela depois de trocar a parada; "Força de Vontade" aparece entre os Atributos | `DiceSheet.tsx:53` e `:217-219` (sempre o `rolls[0]`); `SlotPicker`, `:268-333` (lista sem grupos). A FdV vem do template: `design/templates/wta-w20.json:1238` (`"from": ["attributes", "play"]`) |
| T-84 | baixa | Citação e Notas aparecem só leitura no Editar | `sheet/layouts/TextLayout.tsx:25-60`: o `TextBlock` desenha sempre `<Text>` e nunca o editor. O `TextEditorRow` existe (`sheet/views/index.ts:47-48`), mas o layout `text` não o chama |
| U-01 | baixa | "Peça ao narrador." sem caminho para o pedido de evolução | `sheet/policy.ts:86` (a frase); mostrada em `sheet/evolve/NumberEditorRow.tsx:161`, `ResourceEditorRow.tsx:84` e `ListEditor.tsx:177-179`. A Experiência é aberta só pelo `SheetScreen.tsx:243-251` e `:263-265` |
| U-02 | baixa | Conceder XP só de 1 em 1 | `sheet/xp/forms.tsx:93-106` (o `Stepper` sem `onValuePress`); o mesmo no `AdjustForm`, `:182-196`. O "Digitar" do `Stepper` existe (`packages/ui/src/Stepper.tsx:32-37`, `:183`, `:285-299`) |

---

## 2. Decisões aplicadas

### 2.1 Como o código acomoda o pacote

O P13 é de correção: nenhuma das decisões D-10 e D-13 a D-17 é dele. Ele segue os contratos que as ondas anteriores fixaram:

| Contrato | De onde | Como o P13 o usa |
|---|---|---|
| A política no app é a mesma `writePolicy` do core, que só desabilita o que o servidor vai recusar, com o motivo no lugar | `sheet/policy.ts:10-13`, `:64-80` | O boost da FdV lê o `blockedBy(roles, lifecycle, 'play')`. O "Enviar pedido" lê o saldo, o pedido pendente e o `costOf`, as mesmas contas que o servidor faz (`xp/requests.ts:242-288`) |
| Bloqueado pela previsão: `aria-disabled` e opacidade, **tocável**; o toque explica; nunca `disabled` (o `react-native-web` faria do botão um elemento morto) | [onda-2.md](onda-2.md) §4.2; [onda-4.md](onda-4.md) §4.5; `packages/ui/src/Stepper.tsx:48-94` (`markSoftDisabled`) | O mesmo padrão no `Button` e na opção do `Choice` (seção 3.8). O toque no bloqueado mostra o motivo ao lado (`accessibilityRole="alert"`) e não envia |
| "De" efetivo: o toast, a prévia e o Histórico dizem o valor que a pessoa via; o conflito compara o cru | `packages/sheet-core/src/labels.ts:141-172`; [plano-v0.md](../plano-v0.md) l.56 | O toast passa pelo `withEffectiveFrom`. O "para" do desfazer ganha a mesma regra, só para mostrar |
| O texto é do jogador e aparece sempre em `<Text>` | `TextLayout.tsx:12-14`, `TextEditorRow.tsx:25-27` | O T-84 usa o editor que já existe |

### 2.2 O que fica fora

- **O progresso na Mesa, o painel de regras e o "Orçamento"** são do P09-D (D-10). O `GrantForm` muda aqui (U-02), e a Mesa o monta em `components/chronicles/XpSheets.tsx:45`: a folha da Mesa ganha o "Digitar" sem que o P09-D mexa nela.
- **O toast que cobre controles e o toast atrás da folha (T-43)** são do P12. O P13 não muda o `Toast` nem a posição dele.
- **O campo "História / Prelúdio"** é do P15-D (D-16). Se ele for de texto e estiver no Sobre, fica editável no Editar pela regra deste pacote (seção 3.5).
- **Revelar a nota do narrador** é do P16-D (D-17). As Notas do Narrador continuam editadas pela barra do narrador, não pelo `TextLayout` (seção 3.5).
- **O "+" no limite do template (`disabled` e `tabindex=-1`)** é o candidato (d) da seção 2.4 e depende do ponto 5 do [onda-2.md](onda-2.md) §6.
- **O registro do conserto do "De efetivo" no plano-v0** fica para o P01-D, se ele quiser citar a regressão (seção 8.4).

### 2.3 Pontos para o PO (nada decidido aqui)

Novos, deste pacote:

1. **O que acontece com o traço acima do saldo na lista (T-50, T-77).** Proposta: a opção fica tocável, com a cara de bloqueada e "faltam N XP" no texto. O toque a marca, e o rodapé diz o motivo, com "Enviar pedido" bloqueado. Assim quem quer saber "quanto falta" vê o resumo sem enviar. A alternativa é a opção sem toque nenhum, o que repete o "toque que parece morto" (IA-10, EA-16).
2. **O atalho do U-01 numa lista (Disciplinas, Antecedentes).** O "Peça ao narrador." da lista é um só, para todos os itens (`ListEditor.tsx:177-179`). Proposta: o atalho abre a Experiência com a busca já preenchida pelo nome da lista ("Disciplinas"), sem traço marcado. Marcar o item exige um atalho por linha, ao lado do −/+ do P07-D, que a 360 dp não cabe sem quebrar a linha (pergunta 3 da seção 9).
3. **O "Desfazer" do Histórico depois do conserto do T-53.** As linhas antigas continuam "Sangue: 9 → —", porque o servidor grava o texto do Histórico na hora do lote, e o pacote não reescreve o passado. Só os lotes novos dizem "9 → 10".

Os pontos das ondas anteriores que tocam o pacote seguem em aberto, sem decisão:

- **[onda-2.md](onda-2.md) §6, ponto 5 (R-20, o "+" desabilitado).** Os controles novos deste pacote (o "Enviar pedido", o boost da FdV e a opção acima do saldo) seguem o `aria-disabled` tocável dos traços. Se o PO quiser `disabled` de verdade, muda nos traços, na linha da lista, no "−" do inicial e nestes controles, juntos. O candidato (d) da seção 2.4 é a outra ponta do mesmo ponto: o "+" no limite do template, que hoje é `disabled`.
- **[onda-3.md](onda-3.md) §6, ponto 3 (ficar no Editar depois de salvar).** Não muda. Quem edita a Citação no Editar (T-84) e salva volta ao modo de antes, como em qualquer outro campo. O atalho do U-01 abre uma folha sobre o Editar, e o rascunho continua lá ao fechar.

### 2.4 Candidatos sem linha na matriz (não entram no plano sem a resposta do usuário)

Nenhum destes itens está nos commits da seção 8.1. Cada um traz o que o código mostra, a recomendação e o custo. Se o usuário aceitar um, ele entra como commit à parte, com teste de regressão próprio, e a seção 10 registra.

| # | Candidato | O que o código mostra | Recomendação | Custo |
|---|---|---|---|---|
| (a) | **A folha "busy" que espera as rebuscas** ([onda-3.md](onda-3.md) §11, achado 1) | As mutações esperam todas as invalidações antes de liberar a folha: `lib/queries/operations.ts:78-87` (dano em grupo, `OperationSheet`) e `lib/queries/backstage.ts:37`, `:62`, `:85` e `:164` (revelar NPC). **O mesmo padrão está no XP deste pacote:** `lib/queries/xp.ts:184-190` espera `xpKeys.all`, `['characters']` (todas as fichas em cache) e a Mesa antes de devolver `done`, e o "Enviar pedido", o "Conceder XP" e o "Aprovar" ficam `busy` até lá. O atraso só apareceu no AVD sob carga; no iOS e no web, a folha fechou em menos de 0,6 s | Aceitar, só para o XP, dentro do P13: devolver `done` logo depois do POST e disparar as invalidações sem `await` (o `refresh()` do `finally` continua). As folhas do P11 e do P09-C ficam para quem as mantém, ou num PR próprio, porque os arquivos não são deste pacote. A rede ruim de um celular real prenderia o "×" depois de a escrita já ter valido | P (meio dia), com um teste Jest que segura a rebusca e prova que o botão sai do `busy` |
| (b) | **"permanente — → 4" e "0 → 8" no resumo de salvar** ([onda-4.md](onda-4.md) §6, último item da tabela; [P10-C](P10-C-template-derivados-ordem.md) pergunta 8) | O resumo já passa pelo `withEffectiveFrom` (`sheet/evolve/ModeBar.tsx:183`). O "—" aparece quando o `from` **não é nulo**, mas não tem a parte que mudou: um recurso gravado como `{ current }`, sem `permanent`, cai no `n(a.permanent)` de `labels.ts:66-67`. O "0 → 8" é o `fallback` do `rating` com fórmula (`labels.ts:55-61`, o `min` em vez do valor de partida). O `describeEvent` também monta o Histórico no servidor (`apps/api/src/sheets/events.ts:618`), então mudar o rótulo muda a saída da API para os lotes novos | Aceitar junto do T-53, no commit 3, porque é a mesma família ("De efetivo") e a mesma função. O `withEffectiveFrom` passa a completar também a parte que falta de um recurso (o `permanent` e o `max` resolvidos), e o `rating` com fórmula usa o `defaultStored` do P10-C como `from`. A causa exata do "0 → 8" precisa de um teste que a reproduza antes: a leitura não a isolou | P (1 dia), com teste no core e um caso na API |
| (c) | **O "Desfazer" do narrador no lote de criação de uma ficha já aprovada** ([onda-4.md](onda-4.md) §11, achado 6) | **Depois da aprovação, não é bug de regra, é de significado.** O desfazer não passa pela revisão da criação (`creation_revision`) nem pela conta, porque a ficha está `active`, e em `active` nenhuma conta da criação vale para ninguém. O narrador escreve em todos os estados (`writePolicy`, `packages/sheet-core/src/policy.ts:75`; `operations.ts:270-276`), então o desfazer não lhe dá nada que ele já não tivesse: ele poderia mudar o mesmo valor à mão, e o lote fica assinado no Histórico. Mas desfazer um passo da criação depois de concluída é reabrir uma parte dela, e o "Reabrir criação" ficou fora deste ciclo (D-04). **Antes da aprovação há um bug de regra, que a leitura achou:** o desfazer (`operations.ts:534-602`, `applyAll` em `:244-282`) não roda o `checkCreationBatch` em `creating` e `pending`. A rota de eventos o roda para o dono e para o narrador (`sheets/events.ts:342-360`: "Vale para dono e narrador"). Um desfazer que sobe um traço (o inverso de um "−") pode deixar a conta pior, o que o mesmo narrador não conseguiria pelo Editar | Duas partes. **Bug de regra (`creating`/`pending`):** aceitar, com o `checkCreationBatch` no `applyAll` para as fichas nesses estados e a mesma recusa `creationRefusal`. Proposta: num PR próprio ou no P13, com teste na API (PGLite) que falha hoje. Precisa de linha nova na matriz, porque toca AuthZ e conta no servidor e pede `/security-review`. **Depois da aprovação (decisão do PO):** o lote anterior à conclusão perde o "Desfazer" quando a ficha sai da criação (`reversible: false` no `events.ts:630-637` e 422 no `revertTargets`, `operations.ts:365-393`), coerente com a D-04. A alternativa é só o texto ("Desfazer na ficha concluída: muda a ficha aprovada"), sem mudar a regra | Regra: P (1 dia) com o `/security-review`. Significado: P |
| (d) | **O traço no limite com `disabled` e `tabindex=-1`** ([onda-4.md](onda-4.md) §11, achado 4; [onda-2.md](onda-2.md) §6, ponto 5) | `packages/ui/src/Stepper.tsx:189` e `:196`: no máximo e no mínimo do template, o botão recebe `disabled={off}` (`:224`), e o `react-native-web` o transforma em `disabled` e `tabIndex=-1` (comentário em `:72-79`). Ninguém explica por que o "+" não responde. O `markSoftDisabled` só vale para o bloqueio da previsão (`:193`, `:200`) | Depende do ponto 5 do onda-2.md §6, que segue em aberto. Se o PO quiser o padrão tocável também no limite: o `Stepper` ganha a dica "Máximo do template: 5" no `increase` e o "+" vira `aria-disabled` tocável em vez de `disabled`, para todos os usos. É mudança na API do `@tms/ui` com efeito em todos os traços, e o E2E que conta paradas de Tab muda (`a11y-keyboard.spec.ts`) | P (1 dia), mais o roteiro nas três plataformas |

---

## 3. Desenho por item

### 3.0 O que o código faz hoje

1. **A Experiência.** `ExperienceSheet` (`sheet/xp/ExperienceSheet.tsx:75-269`) é uma `BottomSheet` sem rodapé (`:116-121`), com saldo, pedidos não confirmados, o botão "Solicitar evolução" (`:151-169`), o `RequestPicker` aberto embaixo (`:170-180`), os formulários do narrador, os pedidos e o extrato, tudo na mesma rolagem. O `RequestPicker` desenha um `Chip` por candidato (`:336-353`), na ordem das regras de XP do template (`candidates.ts:41-60`). Candidato sem custo (`cost.ok` falso: no máximo, pré-requisito) vira `Chip` sem `onPress`, que é `disabled` de verdade (`packages/ui/src/Chip.tsx:44`). O resumo (`PickedRequest`) aparece depois de todos os chips e da caixa do item novo (`:379-410`).
2. **A matriz diz "tocar numa não a marca".** A leitura mostra que marca: o `Chip` tem `selected` (`ExperienceSheet.tsx:341`), com a borda e o fundo da ação (`Chip.tsx:46-51`), e no web o `aria-pressed`. O que some é o resultado: a ~3.000 px, o resumo fica fora da tela. A causa é de layout e de destaque, não de estado.
3. **O saldo.** O cliente conhece o saldo pelo extrato (`ExperienceSheet.tsx:105-106`) e os pedidos pendentes pelo `useXpRequests` (`:100`). O servidor não reserva saldo para o pedido pendente (`xp/requests.ts:40`): confere no envio (`:265-273`) e na aprovação (`:524-530`).
4. **O toast de gastar.** O toque longo no dock passa pelo `planDefaultAction`, que já monta a prévia com o "de" efetivo (`packages/sheet-core/src/effects.ts:59-74`, `:193-200`), e o `play.spec.ts:82-95` prova "Sangue 10 → 9". O "—" vem do outro caminho: a folha do recurso ("Gastar 1", "Recuperar 1" e o `Stepper` do atual) monta o rótulo com `describeBatch(model, events)` sobre o `from` cru (`ResourceSheet.tsx:47-50`; `eventTo` em `play/editable.ts:44-53`). A Vitalidade em caixas faz o mesmo (`TrackSheet.tsx:149`).
5. **O desfazer.** Há dois caminhos. O "Desfazer" do toast (`useCommit.ts:29-41`) manda o inverso do lote como lote novo (`sheetStore.ts:725-745`, `invert` em `packages/sheet-core/src/events.ts:162-166`): o "de" vira `{ current: 9 }` e o "para" volta a `null`, o caminho vazio. O "Desfazer" do narrador no Histórico (`history/HistorySheet.tsx:163`) passa pelo `invertBatch` (`group.ts:147-171`), que também devolve `to: null` quando o lote original tinha `from_absent`. Nos dois, o servidor grava o "de" efetivo e o "para" cru (`sheets/events.ts:397-412`; `chronicles/operations.ts:226-236`), e o Histórico lê `{ from: {current: 9}, to: null }` (`events.ts:612-618`). O `describeEvent` escreve "9 → —" (`labels.ts:72`, `DASH`).
6. **Dados.** O resultado é sempre o `rolls[0]` (`DiceSheet.tsx:53`, `:217-219`). O `useDice` já sabe quando a intenção muda (`changedIntent`, `useDice.ts:89-91`, chamado em todo `choose`, atalho, dificuldade, especialização, boost e "Rolagem oculta"), mas só para trocar a chave de idempotência. As opções do slot saem do `poolOptions` (`packages/sheet-core/src/rollers/pool-success.ts:213-262`), cada uma com o `group`: o título da seção (`:249`) ou o rótulo da lista (`:235`). O `SlotPicker` mostra o `group` só como subtítulo (`DiceSheet.tsx:314-316`).
7. **O boost na ficha travada.** O `Toggle` (`DiceSheet.tsx:335-356`) não lê a política. O servidor recusa o lote do custo com `SHEET_LOCKED` (`rolls/routes.ts:323-336`); a rolagem sem custo passa, porque a trava não conta sem custo (`policy.ts:95-111`). É o que o banner diz ("Você ainda rola sem gastar recursos.", `PolicyBanner.tsx:30`).
8. **O Sobre.** O layout `text` serve a duas seções em cada template: `about` (Citação e Notas; no W20 também a Deformidade) e `storyteller` (Notas do Narrador, `read` e `write` só do narrador): `vtm-v20.json:927`, `wta-w20.json:1198` e `mta-m20.json:988`. O `TextBlock` nunca desenha o editor. Os outros layouts passam pelo `FieldSlot`, que escolhe o editor pelo `drawsEditor` (`FieldSlot.tsx:18-31`). As Notas do Narrador são editadas pela barra do narrador ("Editar Notas do Narrador", `storyteller/StorytellerBar.tsx:96-111`), que grava direto (`useCommit`), fora do rascunho.
9. **"Peça ao narrador."** É a nota curta do `NEEDS_XP_APPROVAL` (`policy.ts:83-89`), devolvida pelo `useBlockedNote`/`useClassNote` (`evolve/hooks.ts:60-71`) quando a dona, numa ficha `active`, está no Editar. O `Stepper` da linha fica `disabled` (`NumberEditorRow.tsx:239-240`; `ResourceEditorRow.tsx:106`; `ListEditor.tsx:190`). A Experiência é um estado do `SheetScreen` (`xp`, `:287-302`), aberta pelo botão "Experiência" (`:243-251`) ou pelo "Mais opções" (`:263-265`). Os editores não têm como abri-la.
10. **O "Digitar" do `Stepper`.** O `@tms/ui` já tem tudo: com `onValuePress`, o número vira o botão "Digitar <rótulo>" no web e a ação `activate` no app (`Stepper.tsx:183`, `:259-264`, `:285-299`). Quem desenha o campo é o consumidor: o `NumberEditorRow` (`:100-133`, `:193-226`, com o `parseTyped` de `evolve/typing.ts:55-64`). O `GrantForm` e o `AdjustForm` não passam `onValuePress`. **Não falta nada no `@tms/ui` para o U-02.**

**A causa provável da matriz, linha a linha:**

- **T-50** cita `ExperienceSheet.tsx` l.158: é o botão "Solicitar evolução" (`:157-162`). A lista e o resumo estão em `:292-463`, e o "não marca" é layout (item 2 acima).
- **T-53** cita "uso do `withEffectiveFrom` no toast e no inverso da reversão". **No inverso, ele não basta:** o `withEffectiveFrom` só completa o "de", e o problema do desfazer é o "para" nulo. O conserto precisa do "para" efetivo (seção 3.3).
- **T-77** cita l.446: confere (`:444-448`). O botão é `:454-460`.
- **T-79** cita `DiceSheet.tsx` (estimado): confere. A FdV entre os Atributos não é bug de código: o template W20 põe a seção "Em jogo" no slot "Atributo" (`wta-w20.json:1238`) por decisão, para os atalhos "Teste de Fúria" e "Teste de Gnose" (a própria nota `po-web.md:222` registra "por decisão"). "Provável em todos" está meio errado: no V20, o slot só lê os Atributos (`vtm-v20.json:955`); no M20, o slot lê também as Esferas e o Arete (`mta-m20.json:1018`), com a mesma confusão.
- **T-84** cita `TextLayout.tsx` (estimado): confere, e vale para os três sistemas, não só para o V20 no Android.
- **U-01** cita `policy.ts` l.86: confere. O lugar da mudança são os três editores que mostram a nota (item 9).
- **U-02** cita `forms.tsx` l.74: o `GrantForm` começa em `:75`; o `Stepper` é `:93-106`. O `AdjustForm` (`:182-196`) tem o mesmo problema, e a matriz não o cita.

### 3.1 T-50 · Lista de evolução agrupada, com busca, opção marcada e resumo fixo

**Agrupamento (genérico, do template).** Uma função pura nova, `groupCandidates(model, candidates)` em `sheet/xp/candidates.ts`, devolve os candidatos em blocos na ordem do template:

- a seção do campo é o primeiro `sectionIds` (`packages/sheet-core/src/compile.ts:42-44`);
- se a seção tem grupos (`CompiledSection.groups`), o bloco é o grupo que contém o campo, com o título do grupo; senão, a seção inteira;
- o item de uma lista (Disciplina existente) e o nome do catálogo ainda não escolhido ("(novo)") ficam no bloco da lista, os existentes primeiro;
- a ordem dos blocos e das opções é a do template (`sections`, `groups`, `fields`), não a das regras de XP.

O que cada sistema mostra (os títulos vêm do template; nada no app cita sistema):

| Sistema | Seções e blocos | Observação |
|---|---|---|
| V20 | "Atributos" (Físicos, Sociais, Mentais); "Habilidades" (Talentos, Perícias, Conhecimentos); "Vantagens" (Disciplinas, Virtudes, Moralidade); "Em jogo" (Força de Vontade) | A "Consciência" do Talento e a da Virtude (POW-17) ficam em blocos diferentes, e o nome do bloco entra no nome acessível |
| W20 | "Atributos"; "Habilidades"; "Em jogo" (Fúria, Gnose, Força de Vontade) | Os Dons não têm regra de XP (`regras-wod.md:78`) e não aparecem, como hoje |
| M20 | "Atributos"; "Habilidades"; "Antecedentes"; "Esferas" (Arete e as nove Esferas); "Em jogo" (Força de Vontade) | — |

**A tela.** O `RequestPicker` sai do `ExperienceSheet.tsx` para `sheet/xp/RequestPicker.tsx` (o arquivo passa de 589 linhas):

- no topo, um `TextField` "Buscar traço", que filtra pelo rótulo da opção e pelo título do bloco com o `matches` sem acento (`sheet/dice/fold.ts:10-11`). Bloco vazio some. Sem resultado: "Nada encontrado para “…”." (o texto do `SlotPicker`, `DiceSheet.tsx:326-328`);
- cada seção com o `SectionHeader` (nível `group`) e cada bloco com um `Choice` (`columns={1}`, título visível = o do bloco), com uma escolha só no total: o bloco que não tem o escolhido recebe `value={null}`. O rótulo da opção é o nome do traço ("Briga"), e o `meta` é o custo ("0 → 1 · 3 XP");
- a opção marcada tem o rádio cheio e `aria-checked` (o `Choice` já faz isso, `Choice.tsx:93-118`), o que resolve o "não marca";
- a caixa "Novo item em … (nome)" e os chips de lista (`ExperienceSheet.tsx:354-378`) continuam, depois dos blocos.

**O resumo fixo.** Com o `RequestPicker` aberto, a `BottomSheet` da Experiência ganha `footer` (a prop existe, `packages/ui/src/BottomSheet.tsx:128`, `:293`). O rodapé tem uma `View` com `flex: 1`, porque o estilo do rodapé é uma linha que alinha à direita (`:326-331`):

- sem escolha: "Escolha um traço para ver o custo." e "Enviar pedido" bloqueado;
- com escolha: "Briga: 0 → 1. Custo 3 XP (disponível 6)." (o texto de hoje, `ExperienceSheet.tsx:440-443`), o motivo do bloqueio, se houver (seção 3.2), e "Enviar pedido";
- o erro do servidor (`run.error`) também vai para o rodapé, perto do botão.

A 1280, a folha é o diálogo central de 560 (P08), com o rodapé dentro. A 390, o rodapé fica acima do teclado quando a busca tem foco (`KeyboardAvoidingView` da folha). O resto da folha (pedidos e extrato) continua na rolagem, abaixo da lista.

**Arquivos:** `sheet/xp/candidates.ts` (`groupCandidates`), `sheet/xp/RequestPicker.tsx` (novo), `sheet/xp/ExperienceSheet.tsx` (`footer`, o estado do escolhido sobe para a folha).

### 3.2 T-77 · Bloqueado com o motivo: "Enviar pedido" e "Gastar 1 Força de Vontade"

**"Enviar pedido".** Uma função pura nova, `requestRefusal(candidate, { available, pendingKeys, online })` em `candidates.ts`, devolve o motivo ou `null`, na ordem em que o servidor confere:

| Caso | O servidor | O motivo no app (rascunho do time) |
|---|---|---|
| `cost.ok` falso | 422 `XP_MAX_REACHED`, `XP_PREREQUISITE`, `XP_COST_UNAVAILABLE` (`xp/requests.ts:242-248`) | "No máximo: este traço não pode ser pedido agora." (o `costLabel` de hoje, `candidates.ts:75-85`, mais o texto de `ExperienceSheet.tsx:432-435`) |
| `available < cost` | 409 `XP_INSUFFICIENT_BALANCE` (`:265-273`) | "Faltam 4 XP (custa 10, disponível 6)." (o "Faltam" é a recomendação do POA-37) |
| Já há pedido pendente do mesmo alvo (`xpTargetKey`, entre os pedidos `pending` do `useXpRequests`) | 409 `XP_REQUEST_PENDING` (`:274-288`) | "Já há um pedido pendente para este traço." |
| Sem rede | — | "Conecte-se para enviar. Nada foi enviado." (o texto de `forms.tsx:46`) |

- **A opção do `Choice`** fica com `blocked` (seção 3.8) e o motivo curto no `meta` ("10 XP · faltam 4"). O toque a marca, e o rodapé mostra o motivo inteiro (seção 2.3, ponto 1).
- **"Enviar pedido"** fica com `blocked`: `aria-disabled` e opacidade, tocável. O toque não envia. Ele mostra o motivo ao lado do botão, como alerta, e anuncia (`AccessibilityInfo.announceForAccessibility`). Ele também pede o extrato de novo (`ledger.refetch()`), porque o saldo do cliente pode estar velho: se o narrador acabou de conceder XP, o botão se libera sem fechar a folha. A previsão erra só para o lado bloqueado, e o servidor continua a última palavra.
- O texto "Saldo insuficiente para esta evolução: o servidor vai recusar." (`ExperienceSheet.tsx:444-448`) sai: o motivo novo o substitui.

**"Gastar 1 Força de Vontade" na ficha travada.** O `DiceSheet` lê `useLifecycle()` e `blockedBy(roles, lifecycle, 'play')` (o `DiceSheet` está dentro do `LifecycleContext`, `SheetScreen.tsx:613-641`). Com `SHEET_LOCKED` (ou outro código que recusaria o custo), cada boost de `roll.boosts`:

- fica com `aria-disabled` e opacidade, tocável (`markSoftDisabled` no web, como no `Stepper`);
- tem o motivo embaixo: "O narrador travou a ficha: a rolagem sai sem gastar." (rascunho do time, no tom do `PolicyBanner.tsx:30`);
- o toque não liga o boost e repete o motivo como alerta.

Se o boost já estava ligado quando a trava chegou (a ficha aberta em outra página), ele continua ligado e mostra o motivo, e "Rolar no app" continua recusado pelo servidor com a frase de hoje ("O narrador travou a ficha. A rolagem não foi feita.", `useDice.ts:184-193`). É o caso do passo 4 do `journey-storyteller.spec.ts:231-248`, que continua valendo (seção 4.2). O narrador nunca é bloqueado (`writePolicy`, `policy.ts:75`).

A mesma regra vale para qualquer boost de qualquer template (`roll.boosts`), sem citar a FdV.

**Arquivos:** `sheet/xp/candidates.ts`, `sheet/xp/RequestPicker.tsx`, `sheet/xp/ExperienceSheet.tsx`, `sheet/dice/DiceSheet.tsx` (`Toggle` com `blocked` e motivo).

### 3.3 T-53 · O valor efetivo no toast e no desfazer

**O toast (app).** Uma função nova em `sheet/play/editable.ts`, ao lado do `planLabel`:

```ts
/** O texto do aviso com o "de" efetivo ("Sangue 10 → 9"), como a prévia. */
export const changeLabel = (model, values, events) =>
  describeBatch(model, withEffectiveFrom(model, values, events))
```

Ela substitui o `describeBatch(model, events)` do `ResourceSheet.tsx:49` e do `TrackSheet.tsx:149`. O lote enviado continua com o `from` cru, que é o que o conflito compara (`labels.ts:143-149`). O "Desfeito: …" do desfazer (`sheetStore.ts:731-737`) usa o rótulo do lote, então passa a dizer "Desfeito: Sangue 10 → 9" sem outra mudança.

**O desfazer no Histórico (core e API).** O texto do Histórico é montado no servidor com o que ficou gravado, então o conserto é no servidor:

1. **Core:** `withEffectiveTo(model, after, events)` em `labels.ts`, ao lado do `withEffectiveFrom` e com a mesma regra (`NO_EFFECTIVE`: texto fica de fora; só o escopo `values`). Para o evento com `to` nulo, ele completa o "para" com o `stored` do campo na ficha **depois** do lote. "Sangue: 9 → —" vira "Sangue: 9 → 10". Só para mostrar.
2. **API:** as três gravações de `character_events` passam a guardar o "para" efetivo, com o "de" efetivo de hoje:
   - `sheets/events.ts:397-412` (lote do app, inclusive o desfazer do toast), com o `result.sheet`;
   - `chronicles/operations.ts:226-236` (operação e desfazer do narrador), com o `args.sheet`;
   - `rolls/routes.ts:181-192` (custo da rolagem; hoje o "para" nunca é nulo, mas a regra fica igual nos três lugares).

   O `from_absent` continua o mesmo (`(body.events[seq]?.from ?? null) === null`): é o que faz o desfazer devolver o caminho vazio.
3. **Core, o desfazer do desfazer:** o `invertBatch` compara o caminho cru de agora com o "para" gravado (`group.ts:159-162`). Com o "para" efetivo, um lote que esvaziou o caminho (o desfazer de um gasto a partir do padrão) acusaria conflito ao ser desfeito pelo narrador, porque o cru é `null` e o gravado é `{ current: 10 }`. A comparação ganha um caso: **caminho cru vazio e o "para" gravado igual ao efetivo de agora** contam como "sem mudança". O valor que a pessoa vê é o mesmo que o lote deixou, então não houve mudança. O inverso continua `from: raw` e `to: fromAbsent ? null : from` (`:165-169`). Fora desse caso, nada muda: cru diferente continua conflito.

A alternativa ao item 3 é uma coluna `to_absent` em `character_events` (migration nova, com o `to_value` cru como hoje e o efetivo numa coluna à parte). Ela evita mexer no `invertBatch`, mas cria schema e pega a numeração da migration do P15-D (`0024`). **Recomendação técnica: o item 3, sem migration** (pergunta 1 da seção 9).

**O que não muda:** a resposta do `GET /characters/:id/history` mantém o formato. O conteúdo das linhas novas muda ("9 → 10"), e o das antigas, não (seção 2.3, ponto 3). O filtro `canRead` (`events.ts:597-603`), o lote de rolagem oculta (`:487-500`) e o texto como "atualizado" não mudam.

**Arquivos:** `apps/frontend/sheet/play/editable.ts`, `sheet/views/resource/ResourceSheet.tsx`, `sheet/views/track/TrackSheet.tsx`; `packages/sheet-core/src/labels.ts`, `group.ts`, `index.ts`; `apps/api/src/sheets/events.ts`, `apps/api/src/chronicles/operations.ts`, `apps/api/src/rolls/routes.ts`.

### 3.4 T-79 · Dados: o resultado sai quando a parada muda, e os grupos do slot

**O resultado.** O `useDice` passa a devolver `fresh: boolean`: verdadeiro depois do `record` (`useDice.ts:125-128`), falso em todo `changedIntent()` (`:89-91`). O `DiceSheet` mostra o `RollResult` no topo só com `fresh`. A rolagem anterior não some: vai para "Nesta sessão" (`DiceSheet.tsx:221-233`), que passa a listar `rolls.slice(fresh ? 1 : 0)`. A região `aria-live` (`:217`) fica vazia quando a parada muda, então nada é anunciado nessa hora; a próxima rolagem é anunciada como hoje.

**Os grupos.** O `SlotPicker` (`DiceSheet.tsx:268-333`) agrupa as opções visíveis pelo `PoolOption.group`, na ordem em que o `poolOptions` as devolve, com um `SectionHeader` (nível `group`) por grupo **quando o slot tem mais de um**. A busca continua a mesma (`:282`), e o nome acessível da opção não muda (`:318`), porque os seletores do E2E dependem dele (`journey-storyteller.spec.ts:55-60`).

| Sistema | Slot "Atributo" | Slot "Habilidade" |
|---|---|---|
| V20 (`vtm-v20.json:955`) | Um grupo ("Atributos"): sem cabeçalho, como hoje | "Habilidades", "Disciplinas", "Antecedentes", "Vantagens" (as Virtudes e a Humanidade) |
| W20 (`wta-w20.json:1236-1245`) | "Atributos" e "Em jogo" (Fúria, Gnose, Força de Vontade): a FdV sai da vizinhança da Força | "Habilidades" e "Antecedentes" |
| M20 (`mta-m20.json:1016-1022`) | "Atributos" e "Esferas" (Arete e Esferas) | "Habilidades" e "Antecedentes" |

**Nenhum template muda.** A outra saída da matriz ("separar a FdV no template") seria tirar o "play" do slot "Atributo" ou criar um terceiro slot. As duas mudam a parada que o W20 monta (os atalhos "Teste de Fúria" e "Teste de Gnose" fixam o slot `attribute`, `wta-w20.json:1391` e `:1415`) e pedem versão nova do template, com a janela do "Atualize o app" ([onda-4.md](onda-4.md) §4.7). O P13 não pede nada ao P15-D, que faz o commit de versão dos templates da onda.

**Arquivos:** `sheet/dice/useDice.ts` (`fresh`), `sheet/dice/DiceSheet.tsx` (resultado e grupos).

### 3.5 T-84 · Citação, Notas e os textos do Sobre editáveis no Editar

O `TextBlock` (`TextLayout.tsx:25-60`) passa a desenhar o editor quando o campo o pede, pela mesma regra dos outros layouts:

```ts
const editing = drawsEditor(model, roles, id, mode) && !barEdits(model, id)
if (editing) return <FieldSlot id={id} variant="row" />
```

- `drawsEditor` (`FieldSlot.tsx:18-31`): modo de rascunho (Editar ou Criação), o papel escreve o campo, o tipo tem editor. Para `text` e `longText`, o editor é o `TextEditorRow` (`views/index.ts:47-48`): a linha com o começo do texto, "Editar" e a folha com o limite do template (Citação 160, Notas 4000, Deformidade 200).
- `barEdits(model, id)`: o campo que só o narrador escreve, que a barra do narrador já edita (`storytellerOnlyText`, `StorytellerBar.tsx:34-41`). **As Notas do Narrador continuam como hoje:** só leitura no `TextLayout`, com a legenda "privadas" (R-09, `TextLayout.tsx:32-37`), e editadas pela barra, fora do rascunho. Isso evita dois editores do mesmo campo, um no rascunho e outro gravando direto, e deixa o P16-D com o fluxo de hoje.
- Em Jogo e em Leitura, nada muda: o texto em `<Text>`, a Citação na voz da skin, entre aspas (`:52-54`).
- Ficha travada: o seletor de modo nem aparece (`SheetView.tsx:212`), então não há Editar. Ficha `active` sem trava: texto é `edit`, que a dona grava (`packages/sheet-core/src/policy.ts:84-89`), como a identidade.

O que cada sistema ganha: V20 e M20, Citação e Notas; W20, Citação, Deformidade e Notas. É genérico: qualquer campo de texto numa seção `text` que o papel escreve.

**Com o P15-D:** se o "História / Prelúdio" entrar numa seção `text`, ele fica editável no Editar para quem o escreve, sem código novo. Se a D-16 disser que só o narrador escreve, ele cai no `barEdits` e ganha o botão da barra, como as Notas. A regra é uma só, e os dois pacotes a conferem no rebase (seção 8.4).

**Arquivos:** `sheet/layouts/TextLayout.tsx` e, para exportar a regra da barra sem dependência circular, `sheet/storyteller/privacy.ts` (onde já mora o `hiddenFromOwner`).

### 3.6 U-01 · "Peça ao narrador." vira atalho para "Solicitar evolução"

1. **Um contexto novo**, `sheet/xp/XpShortcut.tsx`: `XpShortcutContext` com `open(target: XpTarget | { query: string })`. O `SheetScreen` o fornece em volta do `body` só quando a ficha está pronta, o template tem extrato (`xpLedgerFields`), o papel é o dono e o `requestBlock(lifecycle)` é nulo. Fora disso (prévias, Mesa, `viewer`, narrador), o contexto é nulo, e os editores mostram só a frase, como hoje.
2. **O estado `xp` do `SheetScreen`** (`:287-302`) passa a guardar o alvo: `{ open: boolean; target?: XpTarget; query?: string }`. A `ExperienceSheet` ganha `initial`: abre já com o `RequestPicker`, com o candidato de mesmo `xpTargetKey` marcado e o rodapé com o resumo (seção 3.1), ou com a busca preenchida.
3. **Um componente pequeno**, `BlockedNote` em `sheet/evolve/`: a frase de hoje e, quando o código é `NEEDS_XP_APPROVAL` e o contexto existe, um botão `ghost` "Solicitar evolução" com o nome acessível "Solicitar evolução de Força" (começa pelo texto visível, WCAG 2.5.3). O `EditorShell.sub` passa de `string` a `ReactNode` (`EditorShell.tsx:31`, `:68-72`); é código do app, não do `@tms/ui`.
4. **Onde entra:**
   - `NumberEditorRow.tsx:161`: alvo `{ field: id }` (Atributos, Habilidades, Virtudes, Humanidade, Esferas, Arete);
   - `ResourceEditorRow.tsx:84`: alvo `{ field: id }` quando a linha bloqueada é o permanente (FdV);
   - `ListEditor.tsx:177-179`: a nota da lista abre a busca com o rótulo da lista (seção 2.3, ponto 2).

   O atalho só aparece se o alvo é candidato (`xpCandidates` tem o `xpTargetKey`). Um traço sem regra de XP fica só com a frase.
5. **O rascunho** do Editar não muda: a Experiência é uma folha por cima, e o pedido usa a ficha confirmada pelo servidor (`ExperienceSheet.tsx:88-89`). Na ficha `active`, a dona não tem evolução no rascunho, porque o "+" está bloqueado.

**Arquivos:** `sheet/xp/XpShortcut.tsx` (novo), `sheet/SheetScreen.tsx`, `sheet/xp/ExperienceSheet.tsx`, `sheet/evolve/BlockedNote.tsx` (novo), `EditorShell.tsx`, `NumberEditorRow.tsx`, `ResourceEditorRow.tsx`, `ListEditor.tsx`.

### 3.7 U-02 · "Digitar" em Conceder e Ajustar XP

O `GrantForm` e o `AdjustForm` passam `onValuePress` ao `Stepper` e desenham o campo numérico no lugar dele enquanto se digita, com o comportamento do `NumberEditorRow` (T-25): Enter aplica; sair do campo aplica; Esc cancela; valor fora da faixa mostra "Digite um número inteiro de 1 a 1000" e, com Enter, o campo fica aberto. A conta é o `parseTyped` (`evolve/typing.ts:55-64`), com as faixas de hoje:

| Formulário | Faixa no app | Limite do servidor | Teclado |
|---|---|---|---|
| Conceder | 1 a 1000 (`forms.tsx:97-98`) | `MAX_XP = 1000` (`xp/ledger.ts:43`, `:344`) | `number-pad` |
| Ajustar | −1000 a 1000 (`forms.tsx:186-187`) | −9999 a 9999 (`xp/ledger.ts:491`) | `numbers-and-punctuation` no iOS (o `number-pad` do iOS não tem o sinal de menos); `number-pad` no Android, que tem |

Um componente local, `TypedAmount` em `forms.tsx`, guarda o campo. O `typingStore` (`typing.ts:24-40`) é do editor da ficha e não serve à Mesa, onde o `GrantForm` também aparece (`XpSheets.tsx:45`), então o estado é local. Extrair o campo do `NumberEditorRow` para os dois usos é a pergunta 4 da seção 9. Atalhos +5 e +10 não entram: o "Digitar" já cobre os 10 XP do POA-22 em três toques.

**Arquivos:** `sheet/xp/forms.tsx`.

### 3.8 O que muda na API pública

**`@tms/ui`** (aditivo; nenhuma prop sai):

| Componente | Mudança | Compatibilidade |
|---|---|---|
| `Button` | `blocked?: boolean`: `aria-disabled` e opacidade 0,5, **tocável**, sem `disabled`. No web, o atributo vai direto no elemento pelo `markSoftDisabled` (`Stepper.tsx:80-94`), porque o `react-native-web` transformaria `aria-disabled` em `disabled` e `tabIndex=-1`. `hintID?: string` aponta o motivo com `aria-describedby`. No app, `accessibilityState.disabled` e a dica | Os usos atuais não passam `blocked` e continuam iguais. É a mesma prop que o ponto 2 do [onda-4.md](onda-4.md) §6 ("Concluir criação" visível e bloqueado) usaria, se o PO o pedir |
| `ChoiceOption` | `blocked?: boolean`: a opção com a cara de bloqueada e `aria-disabled` no rádio, **tocável** (o `onChange` continua). O roving focus não pula a opção | Os usos atuais (`ChoiceEditorRow`, `StateViews`, `CharacterForm` e outros) não passam `blocked` |

A seção de cada um em `design/design-system/components.md` ganha a prop. Os testes de `packages/ui/src/a11y.test.tsx` provam o DOM (`aria-disabled="true"` sem `disabled`, com o foco e o toque) e o app (estado acessível). Mudança no `@tms/ui` pede o build nativo e a conferência no aparelho na integração (lição S-01).

**`@tms/sheet-core`:**

- novo: `withEffectiveTo(model, after, events)`, exportado no `index.ts`;
- alterado: `invertBatch` aceita como "sem mudança" o caminho vazio cujo efetivo é o "para" gravado (seção 3.3). O tipo não muda.

**API HTTP:** nenhuma rota nova, nenhum campo novo. O `GET /characters/:id/history` mantém o formato. O texto das linhas gravadas depois do deploy muda ("9 → 10" no lugar de "9 → —").

**Contrato do template (`schema.json`):** nenhuma mudança. **Templates:** nenhum JSON muda, e o P13 não entra no aumento de versão da onda.

---

## 4. Testes

### 4.1 Um teste de regressão por bug (falha antes, passa depois)

| Item | Teste | Onde | O que prova |
|---|---|---|---|
| T-50 | `groupCandidates`: V20 com "Consciência" em Talentos e em Virtudes; W20 com "Em jogo"; M20 com "Esferas"; a ordem do template; o "(novo)" no bloco da lista | `apps/frontend/sheet/xp/__tests__/xp.test.ts` | O agrupamento, nos três sistemas |
| T-50 | "Solicitar evolução: a busca 'brig' acha Briga; tocar marca o rádio (`aria-checked`); o resumo e 'Enviar pedido' estão no rodapé da folha, fora da rolagem" | `apps/frontend/sheet/xp/__tests__/ExperienceSheet.test.tsx` (novo; conferir com `jest --listTests`) | Opção marcada e resumo fixo. **Falha hoje:** não há grupos, busca nem rodapé |
| T-77 | `requestRefusal`: sem custo, sem saldo ("Faltam 4 XP"), pedido pendente, sem rede, tudo certo | `xp.test.ts` | A regra pura, na ordem do servidor |
| T-77 | "Acima do saldo: a opção e o 'Enviar pedido' com `blocked`; tocar mostra o motivo, pede o extrato de novo e **não chama a API**; com o saldo novo, o botão se libera" | `ExperienceSheet.test.tsx` | Bloqueado com o motivo, tocável. **Falha hoje:** o botão envia |
| T-77 | "Ficha travada (dona): 'Gastar 1 Força de Vontade' com `aria-disabled` e o motivo; tocar não liga; 'Rolar no app' manda `boosts: []`. Narrador na mesma ficha: o boost liga" | `apps/frontend/sheet/dice/__tests__/DiceSheet.test.tsx` | O boost lê a política |
| T-77 | O servidor continua recusando: `XP_INSUFFICIENT_BALANCE`, `XP_REQUEST_PENDING` e a rolagem com boost na ficha travada (`SHEET_LOCKED`); sem boost, a travada rola (201) | `apps/api/src/__tests__/xp.test.ts` (já tem o saldo); `apps/api/src/rolls/__tests__/rolls.test.ts` (conferir se a trava com boost já tem caso; se não, entra) | Nada afrouxou no servidor |
| T-53 | "Folha do Sangue numa ficha nova: 'Gastar 1' mostra 'Sangue 10 → 9'; 'Desfazer' mostra 'Desfeito: Sangue 10 → 9'" | `apps/frontend/sheet/views/__tests__/` (o teste da `ResourceSheet`; criar `ResourceSheet.test.tsx` se não houver) | O toast. **Falha hoje:** "Sangue — → 9" |
| T-53 | `withEffectiveTo`: `to: null` de um recurso no padrão vira o efetivo; texto fica nulo; `to` não nulo fica | `packages/sheet-core/src/__tests__/rules.test.ts` (ao lado do `withEffectiveFrom`, `:366`) | A função pura |
| T-53 | `invertBatch`: caminho vazio com o efetivo igual ao "para" gravado é "sem mudança"; com o efetivo diferente (a Geração mudou o máximo) é conflito; cru não vazio e diferente continua conflito | `packages/sheet-core/src/__tests__/group.test.ts` (`:184`) | O desfazer do desfazer, sem afrouxar o conflito |
| T-53 | "Sangue no padrão: gastar e desfazer pelo app; o Histórico do desfazer diz 'Sangue 9 → 10'" e "o narrador desfaz o gasto no Histórico: '9 → 10'"; "o narrador desfaz o desfazer do app: 201, sem 409" | `apps/api/src/__tests__/events.test.ts` (ao lado de `:511-531`) e `operations.test.ts` (`describe('reverter')`, `:374`), PGLite | O "De efetivo" do plano-v0 l.56 no inverso. **Falha hoje:** "9 → —" |
| T-79 | "Rolar, depois trocar o Atributo: o resultado sai do topo e aparece em 'Nesta sessão'; rolar de novo põe o novo no topo" | `DiceSheet.test.tsx` | O resultado limpo |
| T-79 | "W20: o slot 'Atributo' tem os cabeçalhos 'Atributos' e 'Em jogo', com a Força de Vontade no segundo; V20: sem cabeçalho; M20: 'Esferas'" | `DiceSheet.test.tsx` | Os grupos, nos três sistemas |
| T-84 | "Editar (dona, ficha ativa, V20): Sobre → 'Citação' é um botão que abre o editor, e 'Aplicar' grava no rascunho; W20: a Deformidade também; o narrador no 'Editar como narrador': as Notas do Narrador continuam só leitura, com a legenda 'privadas', e o botão da barra continua" | `apps/frontend/sheet/layouts/__tests__/layouts.test.tsx` | O editor no Editar, sem mexer nas Notas do Narrador. **Falha hoje:** o toque não faz nada |
| U-01 | "Ficha ativa, dona, Editar: 'Peça ao narrador.' com 'Solicitar evolução de Força'; tocar abre a Experiência com Força marcada e o resumo no rodapé"; "Disciplinas: o atalho abre a busca 'Disciplinas'"; "sem extrato no template, ou sem o contexto: só a frase" | `apps/frontend/sheet/__tests__/policy.test.tsx` (ao lado de `:104`) e `ExperienceSheet.test.tsx` | O atalho |
| U-02 | "Conceder XP: 'Digitar XP a conceder' → 10 → Enter = 10; 1001 mostra a mensagem e fica aberto; Esc volta ao valor de antes"; "Ajustar XP: −5" | `apps/frontend/sheet/xp/__tests__/forms.test.tsx` (novo) | O campo digitável |
| `@tms/ui` | "Button `blocked`: no web, `aria-disabled="true"` sem `disabled`, com foco e `onPress`; `hintID` no `aria-describedby`; no app, o estado acessível"; o mesmo para o `ChoiceOption.blocked` | `packages/ui/src/a11y.test.tsx` (ao lado de `:463` e `:685`) | A prop aditiva |

### 4.2 Testes existentes que mudam junto

- `apps/frontend/sheet/__tests__/policy.test.tsx:104` e `:142` ("Peça ao narrador.") e `sheet/evolve/__tests__/ListEditor.test.tsx:169-187`: sem o contexto do atalho, nada muda. O caso com o contexto é novo (4.1).
- `DiceSheet.test.tsx:236-256` ("a sessão lista as rolagens anteriores"): continua passando. Mudam os casos que leem o resultado depois de trocar a parada, se houver.
- `apps/frontend/sheet/__tests__/SheetView.test.tsx:130-158`: em Jogo, nada muda. Conferir o modo do `renderSheet`.
- `apps/api/src/__tests__/events.test.ts:326-331` (texto e especialização com `to_value` nulo): continua, porque o texto fica fora do `withEffectiveTo`.
- `apps/api/src/__tests__/operations.test.ts:374-500` (reverter): o que comparar o `to_value` do desfazer passa a ver o efetivo.
- `apps/api/src/__tests__/creation.test.ts:991-1012` (o congelamento da conclusão grava `from = to`): não muda, porque o "para" já não é nulo.

### 4.3 E2E (Chromium e WebKit)

Nenhum spec abre hoje a lista de evolução, o "Conceder XP" pela tela ou o "Digitar" do XP (`grep` em `e2e/tests` por `xp-request`, `Solicitar evolução`, `Conceder XP` e `Peça ao narrador`: só `narrator.spec.ts:302-316`, pela API, e `journey-backstage.spec.ts:302`, que só confere o botão "Experiência"). Os specs que mudam:

| Spec | O que muda | Quem ajusta |
|---|---|---|
| `e2e/tests/xp.spec.ts` (novo) | A 390 e a 1280: a dona com saldo (pela API, `completeCreation` e `POST /chronicles/:id/xp`) abre "Experiência" → "Solicitar evolução"; `getByRole('radiogroup', { name: 'Talentos' })` e `getByRole('radio', { name: /^Briga, 0 → 1/ })`; o rodapé `getByTestId('bottom-sheet-root').locator('[aria-modal="true"]')` com "Enviar pedido" **no viewport** (`toBeInViewport`) depois de tocar uma opção do fim da lista; acima do saldo, `getByRole('button', { name: 'Enviar pedido', exact: true })` com `aria-disabled="true"` e **sem** `disabled` (o clique com `force: true`, lição da onda 4) mostra "Faltam"; nenhum `POST /xp-requests` sai. U-01: Editar → "Solicitar evolução de Força" abre a folha com o rádio marcado. U-02: o narrador → "Conceder XP" → `getByRole('button', { name: 'Digitar XP a conceder' })` → 10 → Enter | P13 |
| `e2e/tests/dice.spec.ts` | T-79: rolar, trocar o Atributo, o resultado sai do topo; num W20, os cabeçalhos "Atributos" e "Em jogo" na lista. T-77: a ficha travada (pela API) com o checkbox "Gastar 1 Força de Vontade: +1 sucesso automático" com `aria-disabled` | P13 |
| `e2e/tests/play.spec.ts` | T-53: a 390, tocar o chip do Sangue → "Gastar 1" na folha → `getByText('Sangue 10 → 9')`; "Desfazer" → Histórico com "Sangue: 9 → 10" (`exact` onde o texto se repete) | P13 |
| `e2e/tests/sheet.spec.ts` | T-84: a dona no Editar → aba "Sobre" a 390 (`getByRole('tab', { name: 'Sobre' })`) → `getByRole('button', { name: /^Citação: / })` → editar → "Aplicar" → "Salvar" | P13 |
| `e2e/tests/journey-storyteller.spec.ts:231-248` | **Risco:** o passo 4 marca o boost numa página aberta antes da trava e espera o 403. Se a página aprender a trava sem recarregar (a rebusca no foco do P09-C, `lib/queries/focus.ts`), o checkbox fica com `aria-disabled` e o clique sem `force` espera para sempre. O passo continua provando o 403 se o boost já estava ligado (seção 3.2); se o tempo do foco mudar o passo, ele marca o boost antes de travar e confere o motivo depois | P13, no rebase sobre a onda |

As abas da ficha a 390 ficam na faixa fixa (`e2e/support/creation.ts:126-142`, `tab`). A medida do rodapé é no painel da folha, não na camada (lição da onda 3). O Jest não pega, no web, o `aria-disabled` sem `disabled` no `<button>` e o rodapé no viewport: os dois ficam no E2E.

Ordem na integração: os specs do P13 depois dos do P09-D e do P12, que mudam a abertura da crônica e o convite (os specs deste pacote criam a crônica e a ficha pela API e não passam pelo painel nem pelo convite da tela).

### 4.4 Suítes do "PR local" e cobertura

- `npx pnpm typecheck`, `npx pnpm lint` e `node scripts/check-system-names.mjs` (o app não cita sistema).
- `npx pnpm -C packages/sheet-core build` antes dos testes da API e do seed (o `check-dev-env.mjs` recusa o `dist` velho).
- `bun test --coverage` no `packages/sheet-core` (95% de linhas e funções, `bunfig.toml`): `withEffectiveTo` e o ramo novo do `invertBatch` com casos próprios.
- `bun test` no `apps/api` (85%): só testes novos.
- `npx pnpm -C apps/frontend test:coverage -- --forceExit` (o Jest pelo `pnpm test` não encerra sozinho, lição da onda 4). A meta de `./sheet/` é de 80% de linhas e funções e 70% de ramos (`apps/frontend/jest.config.js:40-43`). O `RequestPicker.tsx`, o `XpShortcut.tsx`, o `BlockedNote.tsx` e o `TypedAmount` nascem com teste. O `ExperienceSheet.tsx` não tinha teste de tela: o arquivo novo de teste o cobre.
- `npx pnpm -C packages/ui test` com os casos novos do `a11y.test.tsx`.
- O `random.test.ts` (distribuição dos d10) é instável e não é desta onda: uma falha isolada dele não segura o pacote.
- E2E e build nativo só na integração da onda.

---

## 5. Segurança

O pacote não cria rota, não muda AuthZ, sessão, banco nem dependência (nada novo para o `npm audit`). Muda o que o servidor grava no Histórico (o "para" efetivo) e a comparação do desfazer no `@tms/sheet-core`, que roda no servidor. A matriz não pede `/security-review` para o P13 (§5 do brief: P12, P14-D, P15-D e P16-D). **Recomendação:** `/code-review` (high) no diff inteiro e `/security-review` só no commit 3, porque o `invertBatch` decide se um desfazer do narrador vale.

| Ameaça | Como o desenho evita |
|---|---|
| O app "deixa" o que o servidor não deixa (pedido sem saldo, FdV na ficha travada) | O app só bloqueia. Quem decide continua o servidor: `XP_INSUFFICIENT_BALANCE`, `XP_REQUEST_PENDING`, `SHEET_LOCKED` (4.1, os testes da API). A previsão do app erra só para o lado bloqueado, e o toque pede o extrato de novo |
| O desfazer passa a valer onde não devia (conflito afrouxado) | O caso novo do `invertBatch` só vale com o caminho **vazio** e o efetivo **igual** ao "para" gravado, isto é, quando o valor que a pessoa vê não mudou. Qualquer escrita depois (cru não vazio e diferente) e a mudança do efetivo (a Geração mudou o máximo) continuam conflito. A AuthZ do desfazer não muda: só o narrador da crônica (`operations.ts:549-550`) |
| O Histórico mostra ao jogador um campo que ele não lê | O "para" efetivo é calculado para o mesmo campo do evento. O filtro `canRead` da leitura (`events.ts:597-603`) e o filtro da rolagem oculta (`:487-500`) não mudam. Texto e especialização continuam sem conteúdo ("atualizado"): o `withEffectiveTo` não os toca, e o `contentFree` continua gravando nulo |
| Texto do jogador interpretado (Citação, Notas, Deformidade) | O editor é o `TextEditorRow`, em `<Text>` e `TextField`, com o limite do template, conferido no servidor (`validateSheet`). Nada de `dangerouslySetInnerHTML` ou link |
| As Notas do Narrador saem do lugar | O `TextLayout` não desenha editor para o campo que só o narrador escreve (`barEdits`). O servidor continua sem mandá-las ao dono (`stripRestricted`), e a seção nem aparece para ele (`SectionView.tsx:39`) |
| O atalho do U-01 abre o pedido para quem não pode | O contexto só existe para o dono, membro, com a ficha `active` e sem trava (`requestBlock`). O servidor confere tudo de novo (`xp/requests.ts:220-241`) |
| Valor digitado fora da faixa (U-02) | `parseTyped` (inteiro, dentro da faixa) no app; `t.Integer` com `minimum` e `maximum` no servidor (`xp/ledger.ts:344`, `:491`) |
| Dado da ficha em log ou no Sentry | Nenhum log novo. Os motivos e os rótulos não entram na allowlist do `apps/frontend/lib/telemetryFilter.ts` nem do `apps/api/src/http/on-error.ts`, e o `scrubLog` (`apps/api/src/telemetry.ts`) não ganha campo. O motivo da recusa de XP não leva o nome do traço para fora da tela |

---

## 6. Como generaliza além do WoD

- **A lista de evolução agrupada (genérica):** os blocos são as seções e os grupos do template, e os custos, as regras de `costs.xp`. No D&D, os blocos seriam as seções que o template definir; num sistema sem `costs.xp`, a folha continua dizendo que não há evolução por pedido (`ExperienceSheet.tsx:163-168`).
- **O bloqueado com o motivo (genérico):** o `Button.blocked` e o `ChoiceOption.blocked` servem a qualquer tela. O boost lê `roll.boosts` do template e a política do core, sem citar a FdV.
- **O "para" efetivo (genérico):** qualquer campo com padrão ou derivado (o Sangue pela Geração, a Humanidade pelas Virtudes, um máximo de PV calculado no D&D).
- **Os grupos do slot dos Dados (genérico):** o `group` do `poolOptions` vem do título da seção do template. O M20 e o W20 ganham cabeçalho, e o V20 não, sem uma linha de código por sistema.
- **O editor no layout `text` (genérico):** qualquer texto numa seção `text` que o papel escreve.
- **O atalho para o pedido (genérico):** o alvo é o `XpTarget` do core, para qualquer campo com regra de XP.
- **O "Digitar" (genérico).**

Nada no app cita sistema: o `check-system-names.mjs` roda no "PR local".

---

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado**, com os arquivos conferidos (seção 1), os pontos da seção 2.3 levados ao PO, os candidatos da seção 2.4 respondidos pelo usuário (entram ou não) e as perguntas 1 e 2 da seção 9 respondidas na consolidação.
2. **Typecheck, lint e testes** de `@tms/sheet-core`, `@tms/api`, `@tms/ui` e `frontend`, com cobertura (seção 4.4), depois do build do `dist`.
3. **Um teste de regressão por bug** (seção 4.1).
4. **`/code-review`** (high) no diff do pacote; `/security-review` no commit 3 (seção 5).
5. **Os cenários das personas, repetidos sem o defeito** (API local, `npx pnpm seed:roteiro --fichas-criacao`; só contas fictícias):

| Item | Persona e cenário (notas) | O que se espera ver |
|---|---|---|
| T-50 | QA web, QAW-32 (390): Jogador → Experiência → Solicitar evolução → Briga | Os traços em blocos com o título do template; a busca acha "Briga"; o rádio marcado; o resumo e "Enviar pedido" no rodapé, sem rolar |
| T-50 | PO web, POW-17 (1280): a mesma lista, procurando a "Consciência" | Dois blocos, "Talentos" e "Virtudes", cada um com a sua; o diálogo de 560 com o rodapé dentro |
| T-50 | PO app, POA-36 (iOS): achar e enviar em três toques | Busca, toque e "Enviar pedido" sem rolar |
| T-53 | PO app, POA-30 (iOS): ficha nova → Sangue → "Gastar 1" → "Desfazer" → Histórico | "Sangue 10 → 9" no toast; "Sangue: 9 → 10" na linha do desfazer |
| T-77 | PO web, POW-33 (1280): pedido sem saldo; ficha travada → Dados | "Faltam N XP" e "Enviar pedido" bloqueado, sem envio; "Gastar 1 Força de Vontade" bloqueado com o motivo, e a rolagem sem gasto continua |
| T-77 | PO app, POA-37 (iOS): escolher um traço acima do saldo | O motivo ao lado do botão; o toque não envia |
| T-79 | PO web, POW-31 (390, W20): Dados → rolar → trocar o Atributo | O resultado sai do topo e fica em "Nesta sessão"; a FdV no bloco "Em jogo", longe da Força |
| T-84 | Experiente app, EA-27 (Android, V20): Editar → Sobre → Citação | A folha do texto abre; "Aplicar" e "Salvar" gravam |
| U-01 | Iniciante web, IW-25, e PO app, POA-45 (iOS): ficha concluída → Editar → "+" bloqueado | "Peça ao narrador." com "Solicitar evolução", que abre o pedido com o traço marcado |
| U-02 | PO web, POW-18 (1280), e PO app, POA-22 (iOS): conceder 12 XP pela Mesa e 10 pela ficha | O número digitado, em três toques |

6. **Conferência no aparelho:** a seção 11 (T-53, T-50, T-77, U-01 e U-02 obrigatórios no iOS; T-84 obrigatório no Android).
7. **Resumo do pacote** para a seção do PR da onda: o que mudou, como foi testado, os achados da revisão e os candidatos da seção 2.4 que o usuário aceitou ou recusou.

**O critério de saída da onda** ("a fase 2 do Narrador, acompanhar, ajudar, devolver e concluir, repetida no app e no web") não é deste pacote: a fase 2 termina em "concluir", e o P13 começa depois dela. O que ele acrescenta ao roteiro do narrador (N-A, `narrador-app.md`, e N-W, `narrador-web.md`) é o passo seguinte, na ficha que o narrador acabou de concluir: conceder XP digitando o valor (U-02) e aprovar o pedido que a jogadora mandou pelo atalho (U-01). O roteiro da integração o repete no web e no iOS (seção 11.e).

---

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

Cada commit diz tudo o que entra nele, por sistema e por arquivo (a lição do A2 da onda 4: o brief não pode restringir um commit a menos do que o plano pede).

| # | Commit | O que entra (por arquivo e por sistema) | Itens | Sai sozinho? |
|---|---|---|---|---|
| 1 | `test(api): o servidor continua recusando pedido sem saldo, pedido pendente e boost na ficha travada` | `apps/api/src/__tests__/xp.test.ts` (confere o que existe); `apps/api/src/rolls/__tests__/rolls.test.ts` (trava com boost = 403 `SHEET_LOCKED`; sem boost = 201), nos três sistemas pelo template de cada um (o boost é o mesmo `willpower` nos três) | prova | Sim |
| 2 | `feat(ui): Button.blocked e ChoiceOption.blocked, com aria-disabled tocável` | `packages/ui/src/Button.tsx`, `Choice.tsx`, `a11y.test.tsx`, `components.test.tsx`; `design/design-system/components.md` (Button e Choice) | base de T-50 e T-77 | Sim |
| 3 | `fix(core,api): o "para" efetivo no Histórico e o desfazer do desfazer (T-53)` | `packages/sheet-core/src/labels.ts` (`withEffectiveTo`), `group.ts` (`invertBatch`), `index.ts`, `__tests__/rules.test.ts`, `__tests__/group.test.ts`; `apps/api/src/sheets/events.ts:397-412`, `apps/api/src/chronicles/operations.ts:226-236`, `apps/api/src/rolls/routes.ts:181-192`; `apps/api/src/__tests__/events.test.ts` e `operations.test.ts`. Vale para todos os sistemas: os casos de teste usam o Sangue (V20), a Fúria (W20, valor inicial pelo Augúrio) e a Quintessência (M20, a roda). **Rebuild do `dist`** do core | T-53 | Sim |
| 4 | `fix(app): o aviso de gastar e marcar diz o valor efetivo (T-53)` | `apps/frontend/sheet/play/editable.ts` (`changeLabel`), `sheet/views/resource/ResourceSheet.tsx:49`, `sheet/views/track/TrackSheet.tsx:149` e o teste da folha | T-53 | Sim |
| 5 | `feat(app): a lista de evolução agrupada pelo template, com busca, opção marcada e o resumo no rodapé (T-50)` | `sheet/xp/candidates.ts` (`groupCandidates`), `sheet/xp/RequestPicker.tsx` (novo, sai do `ExperienceSheet.tsx:292-463`), `sheet/xp/ExperienceSheet.tsx` (`footer`), `__tests__/xp.test.ts`, `__tests__/ExperienceSheet.test.tsx`. Por sistema: V20 (Atributos, Habilidades, Vantagens, Em jogo), W20 (Atributos, Habilidades, Em jogo), M20 (Atributos, Habilidades, Antecedentes, Esferas, Em jogo) | T-50 | Depende do 2 |
| 6 | `feat(app): "Enviar pedido" e "Gastar 1 Força de Vontade" bloqueados com o motivo (T-77)` | `sheet/xp/candidates.ts` (`requestRefusal`), `RequestPicker.tsx`, `ExperienceSheet.tsx` (o motivo e o `ledger.refetch()` no toque), `sheet/dice/DiceSheet.tsx` (`Toggle` com `blocked`, `useLifecycle`), `__tests__/DiceSheet.test.tsx`, `ExperienceSheet.test.tsx` | T-77 | Depende do 5 |
| 7 | `fix(app): Dados tira o resultado do topo ao trocar a parada e separa os grupos do slot (T-79)` | `sheet/dice/useDice.ts` (`fresh`), `sheet/dice/DiceSheet.tsx` (`RollResult` e `SlotPicker`), `DiceSheet.test.tsx`. Por sistema: V20 sem cabeçalho no "Atributo"; W20 "Atributos" e "Em jogo"; M20 "Atributos" e "Esferas"; o slot "Habilidade" dos três com os seus grupos | T-79 | Sim |
| 8 | `fix(app): Citação, Notas e os textos do Sobre editáveis no Editar (T-84)` | `sheet/layouts/TextLayout.tsx`, `sheet/storyteller/privacy.ts` (`barEdits`), `layouts/__tests__/layouts.test.tsx`. Por sistema: V20 e M20 (Citação, Notas), W20 (Citação, Deformidade, Notas); as Notas do Narrador dos três ficam como estão | T-84 | Sim |
| 9 | `feat(app): "Peça ao narrador." leva a "Solicitar evolução" com o traço escolhido (U-01)` | `sheet/xp/XpShortcut.tsx` (novo), `sheet/SheetScreen.tsx` (o estado `xp` com o alvo e o provedor), `sheet/xp/ExperienceSheet.tsx` (`initial`), `sheet/evolve/BlockedNote.tsx` (novo), `EditorShell.tsx` (`sub: ReactNode`), `NumberEditorRow.tsx`, `ResourceEditorRow.tsx`, `ListEditor.tsx`, `__tests__/policy.test.tsx`, `ExperienceSheet.test.tsx` | U-01 | Depende do 5 |
| 10 | `feat(app): "Digitar" em Conceder XP e Ajustar XP (U-02)` | `sheet/xp/forms.tsx` (`TypedAmount`; os dois formulários), `__tests__/forms.test.tsx` (novo). Vale na ficha e na Mesa (`XpSheets.tsx` não muda) | U-02 | Sim |
| 11 | `test(e2e): lista de evolução, saldo, atalho e Digitar; Dados; toast e Histórico; Sobre no Editar` | `e2e/tests/xp.spec.ts` (novo), `dice.spec.ts`, `play.spec.ts`, `sheet.spec.ts`; `journey-storyteller.spec.ts:231-248` se o passo 4 mudar (seção 4.3) | E2E | — |
| (cand.) | Os candidatos (a) a (d) da seção 2.4 | Só com a resposta do usuário, um commit cada | — | — |

### 8.2 Esforço

| Item | Matriz | Plano | Por quê |
|---|---|---|---|
| T-50 | M | M | Agrupamento, busca, rodapé e a folha dividida em dois arquivos; o teste de tela da Experiência não existia |
| T-53 | P | P+ | O toast é uma linha em dois arquivos; o Histórico pede o core, três gravações na API e o caso novo do desfazer, com testes nos dois |
| T-77 | P | P | Depende do `blocked` do commit 2 |
| T-79 | P | P | Estado `fresh` e cabeçalhos |
| T-84 | P | P | O editor já existe |
| U-01 | P | P+ | Contexto, estado do `SheetScreen` e três editores |
| U-02 | P | P | Campo local nos dois formulários |
| `@tms/ui` (commit 2) | — | P | Duas props aditivas, com os testes do DOM e do app |

**Total: de 7 a 9 dias de desenvolvimento, em 11 commits** (a matriz estima 9). Os candidatos aceitos somam de meio dia a 1 dia cada.

### 8.3 Riscos

- **O `@tms/ui` muda** (`Button` e `Choice`). Sem os jobs nativos no CI (PR #49), o build local da integração é a única prova de que o app nativo compila (S-01). A opacidade e o estado acessível do bloqueado precisam de conferência no Android e no iOS (seção 11).
- **O desfazer do servidor.** O caso novo do `invertBatch` é pequeno, mas é a regra que decide se um desfazer do narrador vale. Os testes da seção 4.1 provam os dois lados (sem mudança e conflito), e o `/security-review` olha o commit 3.
- **Histórico misto.** As linhas antigas continuam com "—" (seção 2.3, ponto 3). Quem compara o Histórico antes e depois do deploy vê os dois textos.
- **O passo 4 do `journey-storyteller.spec.ts`** pode mudar com a rebusca no foco (seção 4.3).
- **A folha da Experiência a 360 dp** com o rodapé, a busca e o teclado de software: o rodapé com duas linhas de texto e o botão precisa caber sem cobrir a busca. Conferir no AVD a 360 e no SE (seção 11).
- **A rebusca do XP segura o "Enviar pedido" em `busy`** (candidato (a)). Sem a resposta do usuário, o pacote não muda isso, e o roteiro no AVD pode mostrar a espera: tempo no emulador sob carga não é evidência.
- **O rótulo do item novo da lista** ("Disciplinas: Taumaturgia (novo)") aparece dentro do bloco "Disciplinas". O texto do resumo continua com o prefixo, e a opção, sem ele: conferir que o nome acessível não repete o bloco.

### 8.4 Conflitos com os pacotes da onda

| Pacote | Arquivo ou contrato | Risco | Como integrar |
|---|---|---|---|
| P15-D (D-16, campo "História / Prelúdio") | `sheet/layouts/TextLayout.tsx`; os três templates | Médio | O P13 muda o `TextBlock` (editor no Editar e a regra `barEdits`); o P15-D acrescenta o campo no template e, talvez, uma seção `text`. Ordem proposta: **P13 antes do P15-D**, para o campo novo nascer editável pela regra do P13. Se o P15-D entrar antes, o rebase do P13 confere o campo novo nos testes do commit 8. O P13 não muda template e não entra no commit de versão |
| P16-D (D-17, revelar a nota) | `TextLayout.tsx` (o rótulo pelo estado, o bloco revelado do dono e o `RevealControl` no fim), `sheet/storyteller/privacy.ts`, a barra do narrador | Médio | O P13 troca o bloco pelo editor só quando o papel escreve o campo e ele não é da barra (`barEdits`); o P16-D mexe no bloco de leitura. O bloco revelado do dono fica em leitura também no Editar, porque o `canWrite` do dono continua falso. O P16-D depende do P15-D e entra depois do P13, e faz o rebase |
| P12 (T-43, toast; convite) | `@tms/ui`: `Button.tsx` nos dois; `Toast.tsx` e `BottomSheet.tsx` (o P12 mede o `footer` para pôr o aviso acima dele); `components.test.tsx`, `a11y.test.tsx` e `components.md` | **Médio** no `Button.tsx` | O P12 dá ao `Button` a prop `ref` (foco por programa, P12 §3.9); o P13 precisa de um `ref` interno para o `markSoftDisabled` do `blocked`. Quem entrar depois junta os dois (um `ref` combinado, o de fora e o de dentro), e o teste do `a11y.test.tsx` cobre os dois juntos. O rodapé da Experiência (T-50) passa a ter o aviso acima dele pela mudança do P12 na `BottomSheet`, sem código no P13. Os toasts do P13 (o de gastar, os motivos) usam o `useToast` de hoje e herdam a posição que o P12 definir: o `play.spec.ts` do T-53 confere o texto, não a posição. Um build nativo na integração cobre os dois |
| P09-D (D-10, Mesa) | `components/chronicles/XpSheets.tsx` monta o `GrantForm` | Baixo | O P13 só muda o `forms.tsx`. Se o P09-D mexer no `XpSheets.tsx` ou na barra de seleção da Mesa, não toca o formulário |
| P01-D (D-13, planos alinhados) | `doc/plano-v0.md` l.56 ("De efetivo") | Baixo | O P01-D entra por último e pode registrar que o "De efetivo" voltou a valer no desfazer (P13, T-53). O P13 não edita os planos |
| P14-D | — | Nenhum | Arquivos diferentes |

### 8.5 Arquivos tocados

| Arquivo | Trecho | Itens | Cruza com |
|---|---|---|---|
| `packages/ui/src/Button.tsx` | `ButtonProps` (`:9-22`), `blocked` e `hintID` com `markSoftDisabled` (um `ref` interno) | T-77 | P12 (médio: o `ref` do foco por programa) |
| `packages/ui/src/Choice.tsx` | `ChoiceOption` (`:10-18`), a opção (`:89-118`) | T-50, T-77 | — |
| `packages/ui/src/a11y.test.tsx`, `components.test.tsx` | casos do `blocked` | T-50, T-77 | P12 (textual) |
| `design/design-system/components.md` | Button e Choice | T-50, T-77 | P12 (textual) |
| `packages/sheet-core/src/labels.ts` | `withEffectiveTo` perto de `:150-172` | T-53 | — |
| `packages/sheet-core/src/group.ts` | `invertBatch` (`:159-162`) | T-53 | — |
| `packages/sheet-core/src/index.ts` | export | T-53 | — |
| `packages/sheet-core/src/__tests__/rules.test.ts`, `group.test.ts` | casos novos | T-53 | — |
| `apps/api/src/sheets/events.ts` | gravação dos eventos (`:393-413`) | T-53 | — |
| `apps/api/src/chronicles/operations.ts` | `writeBatch` (`:222-238`) | T-53 | — |
| `apps/api/src/rolls/routes.ts` | eventos do custo (`:181-192`) | T-53 | — |
| `apps/api/src/__tests__/events.test.ts`, `operations.test.ts`, `xp.test.ts`; `apps/api/src/rolls/__tests__/rolls.test.ts` | casos novos | T-53, T-77 | — |
| `apps/frontend/sheet/play/editable.ts` | `changeLabel` | T-53 | — |
| `apps/frontend/sheet/views/resource/ResourceSheet.tsx` | `:47-50` | T-53 | — |
| `apps/frontend/sheet/views/track/TrackSheet.tsx` | `:149` | T-53 | — |
| `apps/frontend/sheet/xp/candidates.ts` | `groupCandidates`, `requestRefusal` | T-50, T-77 | — |
| `apps/frontend/sheet/xp/RequestPicker.tsx` (novo) | a lista e o rodapé | T-50, T-77 | — |
| `apps/frontend/sheet/xp/ExperienceSheet.tsx` | `footer`, `initial`, o `RequestPicker` sai (`:292-463`) | T-50, T-77, U-01 | — |
| `apps/frontend/sheet/xp/XpShortcut.tsx` (novo) | o contexto | U-01 | — |
| `apps/frontend/sheet/xp/forms.tsx` | `GrantForm` (`:93-106`), `AdjustForm` (`:182-196`), `TypedAmount` | U-02 | P09-D (baixo, pelo `XpSheets.tsx`) |
| `apps/frontend/sheet/SheetScreen.tsx` | estado `xp` (`:287-302`) e o provedor | U-01 | P12, se ele mexer no voltar da ficha (conferir no rebase) |
| `apps/frontend/sheet/evolve/BlockedNote.tsx` (novo), `EditorShell.tsx` (`:31`, `:68-72`) | a nota com o atalho | U-01 | — |
| `apps/frontend/sheet/evolve/NumberEditorRow.tsx` (`:161`), `ResourceEditorRow.tsx` (`:84`), `ListEditor.tsx` (`:177-179`) | a nota | U-01 | — |
| `apps/frontend/sheet/dice/useDice.ts` | `fresh` | T-79 | — |
| `apps/frontend/sheet/dice/DiceSheet.tsx` | resultado (`:53`, `:217-233`), `SlotPicker` (`:268-333`), `Toggle` (`:163-170`, `:335-356`) | T-77, T-79 | — |
| `apps/frontend/sheet/layouts/TextLayout.tsx` | `TextBlock` (`:25-60`) | T-84 | P15-D, P16-D |
| `apps/frontend/sheet/storyteller/privacy.ts` | `barEdits` | T-84 | P16-D |
| Testes do app: `sheet/xp/__tests__/xp.test.ts`, `ExperienceSheet.test.tsx` (novo), `forms.test.tsx` (novo), `sheet/dice/__tests__/DiceSheet.test.tsx`, `sheet/layouts/__tests__/layouts.test.tsx`, `sheet/__tests__/policy.test.tsx`, o teste da `ResourceSheet` | — | todos | — |
| `e2e/tests/xp.spec.ts` (novo), `dice.spec.ts`, `play.spec.ts`, `sheet.spec.ts`, `journey-storyteller.spec.ts` (se o passo 4 mudar) | seção 4.3 | todos | P09-D e P12 (ordem dos specs) |

---

## 9. Perguntas abertas (técnicas)

1. **O desfazer do desfazer:** o caso novo no `invertBatch` (proposto, sem migration) ou a coluna `to_absent` em `character_events` (migration nova, sem mexer no `invertBatch`, e a numeração acertada com a `0024` do P15-D)?
2. **O Histórico antigo:** deixar as linhas gravadas com "—" (proposto) ou recalcular o "para" na leitura, só para os lotes de desfazer (`reverts_batch_id` aponta o lote original, cujo "de" já é efetivo)? A leitura resolve o desfazer do narrador, mas não o do toast, que é um lote comum.
3. **O atalho por item da lista** (U-01): um botão por linha, ao lado do −/+ do P07-D, ou a nota da lista com a busca (proposto)? A 360 dp com a fonte a 130%, a linha já quebra em duas (P07-D §8.3).
4. **O campo do "Digitar":** local no `forms.tsx` (proposto) ou extraído do `NumberEditorRow` para servir aos dois? Extrair mexe no T-25 (onda 1), com o risco de regressão no Editar.
5. **Os blocos da lista de evolução recolhíveis?** Proposto: não, com a busca e o rodapé fixo. Recolher reduz a rolagem, mas soma um toque por bloco e esconde o custo.
6. **O motivo do boost na ficha travada** vai embaixo do checkbox (proposto) ou só no banner que já existe ("Você ainda rola sem gastar recursos.")? O texto embaixo repete o banner, mas fica perto do toque.
7. **O teste da `ResourceSheet`:** existe um arquivo de tela para ela? Se não, o commit 4 cria `sheet/views/__tests__/ResourceSheet.test.tsx` (conferir com `jest --listTests`).

---

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

Implementação em 05 e 06/11/2026, na `pacote/p13-ficha-em-uso`, num worktree próprio, em paralelo com os outros pacotes da onda. Os pontos para o PO (§2.3) e as perguntas técnicas (§9) seguiram a recomendação deste plano; nada foi decidido aqui. **Os candidatos (a) a (d) da §2.4 não entraram** (pedem a resposta do usuário). Em especial, o desfazer da crônica continua sem o `checkCreationBatch` em `creating`/`pending` (candidato (c)).

**Commits:** `08d4318` (ui), `6d82f18` (core e API, T-53), `a34c938` (app, T-53), `6f39aef` (T-50), `40666cc` (T-77), `732f3ef` (T-79), `bcc60ac` (T-84), `c0e5e67` (U-01), `cb7307c` (U-02), `54c0ca5` (E2E), `1d44199` (fix da revisão), `dcc44dd` (db, o `to_absent`), `2a53ee4` (fix do T-53, o `to_absent`) e os dez `fix` do `/code-review` (high) do orquestrador: `5b354dd`, `a0374bb`, `96acc64`, `73fcec0`, `d9dc35d`, `22da8cb`, `5ee6c6d`, `1603368`, `4ad7f45` e `ff864a6`.

**O que ficou diferente:**

1. **O commit 1 não existe.** Os testes que ele pedia já estavam na ponta: `XP_INSUFFICIENT_BALANCE` e `XP_REQUEST_PENDING` em `apps/api/src/__tests__/xp.test.ts:581-643`; a rolagem com boost na ficha travada (403 `SHEET_LOCKED`), a rolagem sem boost (201) e o narrador com boost (201) em `apps/api/src/__tests__/policy.test.ts:286-299`, nos três sistemas.
2. **T-50, a ordem das seções.** Os blocos seguem a ordem das abas da ficha (`model.zones`) e, dentro de cada uma, a do template. Por isso "Em jogo" vem primeiro, e não por último como na tabela da §3.1.
3. **T-53, onde ficaram os testes.**
   - O toast foi testado no `sheet/play/__tests__/play.test.tsx` (a folha do Sangue já era testada ali). O `ResourceSheet.test.tsx` não foi criado (pergunta 7).
   - O Histórico foi testado no `apps/api/src/__tests__/operations.test.ts`, nos três sistemas: Sangue no V20, Fúria no W20 pelo Augúrio e FdV no M20 (padrão fixo). O M20 não usa a Quintessência, porque a roda é um `clock`, e o gasto padrão do M20 é a FdV.
   - O core ganhou um export a mais, `effectiveOf(model, sheet)`. É o valor efetivo de um caminho, usado pelo `withEffectiveFrom`, pelo `withEffectiveTo` e pelo `invertBatch`.
4. **T-53, o desfazer do desfazer e a migration `0024`.** A primeira versão (`6d82f18`) gravava o "para" efetivo sem marcar que o "para" cru era vazio. Com isso, dois casos que eram conflito deixaram de ser: **(A)** gravar depois, explicitamente, o mesmo valor que se via num caminho que o lote esvaziou; **(B)** esvaziar depois um caminho que o lote gravou com o valor do padrão. O (B) tem os mesmos dados do caso do plano, e nenhum dos dois se distingue sem saber se o "para" cru era vazio. A §3.3 errava ao dizer "fora desse caso, nada muda". O orquestrador escolheu a alternativa da §3.3 e da pergunta 1 da §9 (fail secure, o desenho do `from_absent`):
   - **`0024_character_events_to_absent`** (schema): `to_absent boolean not null default false` em `character_events`. As linhas antigas ficam `false` e comparam o cru, como antes (gravaram o "para" cru). O `types.ts` foi conferido com o `db:codegen` no banco `tms_p13`, e o `doc/database.dbml` ganhou a coluna.
   - **Numeração:** a primeira versão era a `0026`, mas o Migrator roda sem `allowUnorderedMigrations`, e um banco com ela aplicada recusaria a `0024` e a `0025` que chegam depois (achado do `/code-review`). Como o P13 entra na onda antes do P15-D e do P16-D, a dele é a **`0024`**; **no rebase deles, a do P15-D vira `0025` e a do P16-D `0026`** (o orquestrador renumera). O `migrations.test.ts` ganhou o teste "os números seguem sem buraco", e o "descer a 0023" desce a `0024` junto. O `tms_p13` foi recriado (`dropdb` e `createdb`, só ele) e migrado de novo: a `kysely_migration` termina em `0024_character_events_to_absent`.
   - **As três gravações** (`sheets/events.ts`, `chronicles/operations.ts`, `rolls/routes.ts`) gravam o `to_absent` (o "para" cru era vazio) junto do "para" efetivo. O desfazer do narrador o lê. O `GET /characters/:id/history` não o expõe.
   - **O `invertBatch`** recebe `toAbsent`. Com ele, só conta como "sem mudança" o caso do plano: o caminho cru de agora vazio e o efetivo de agora igual ao "para" gravado. Sem ele, compara o cru, como antes do pacote. Os casos (A) e (B) voltaram a ser conflito, com teste no core (`group.test.ts`) e na API (caso A, nos três sistemas). A propriedade "qualquer mudança posterior recusa" voltou a valer para a mudança do cru, sem filtro; o caso do plano tem teste próprio.
5. **T-77, o boost.** A primeira versão bloqueava o boost em toda recusa do Jogo. A revisão corrigiu em `1d44199`: só `SHEET_LOCKED` bloqueia com "a rolagem sai sem gastar". Nas fichas arquivada, fora de jogo ou sem vínculo, o servidor recusa a rolagem inteira, e vale a recusa de hoje. Sem escolha, "Enviar pedido" também fica bloqueado, com "Escolha um traço para ver o custo.".
6. **U-01.**
   - O atalho fica de fora também quando o papel inclui `storyteller`, mesmo que seja dono.
   - Na lista, o atalho abre a busca pelo rótulo dela (ponto 2 da §2.3), sem marcar item.
   - O `XpShortcutContext` fica em volta da ficha só no ramo sem a `SwipeArea`, que é do narrador.
7. **U-02.** O `TypedAmount` fica no `forms.tsx`, com o estado local, e usa o `useTypedValue` comum ao `NumberEditorRow` (pergunta 4; extraído no `22da8cb`). O erro do valor fora da faixa fica embaixo do controle, também depois de sair do campo.
8. **E2E: escritos e não rodados**, como o brief pede. Os specs são `xp.spec.ts` (novo), `dice.spec.ts`, `play.spec.ts` e `sheet.spec.ts`; só o typecheck do `e2e` foi rodado.
   - No `dice.spec.ts`, a conta é a mesma para dona e narradora. Por isso o spec da trava confere só que o narrador liga o boost; o caso da dona barrada, sem `disabled` no web, ficou no `DiceSheet.test.tsx`.
   - Os seletores (nomes acessíveis dos rádios, "Mais opções" a 390, `bottom-sheet-root`) ficam para o orquestrador conferir na primeira rodada.
   - O passo 4 do `journey-storyteller.spec.ts` não mudou.

**Os pontos de encaixe para os pacotes que vêm depois:**

- **P15-D (História / Prelúdio, D-16).** A regra do T-84 é `drawsEditor(model, roles, id, mode) && !barEdits(model, id)`, no `TextBlock` (`sheet/layouts/TextLayout.tsx`). O `barEdits` (`sheet/storyteller/privacy.ts`) diz qual texto só o narrador escreve, pelas `permissions` da seção.
  - **Opção A, os dois escrevem:** um campo `text` ou `longText` numa seção de layout `text` ganha o editor no Editar e na Criação, sem código novo. O `testID` é `editor-<campo>` no Sobre, como o `editor-quote` e o `editor-notes` (por exemplo, `editor-backstory`). O teste de encaixe fica no `layouts.test.tsx`, bloco "text: o Sobre no Editar (T-84)".
  - **Opção B, só o narrador escreve:** o campo cai no `barEdits`, fica só leitura no layout e ganha o botão da barra do narrador (`storytellerOnlyText` usa o mesmo `barEdits`).
- **P16-D (revelar a nota, D-17).** O `TextBlock` tem o ramo do editor no topo (devolve o `FieldSlot`); o bloco de leitura vem embaixo. O rótulo pelo estado, o bloco revelado do dono e o `RevealControl` entram no bloco de leitura. As Notas do Narrador nunca caem no ramo do editor (o `barEdits` é verdadeiro para elas), e o dono não as escreve, então o bloco revelado continua em leitura também no Editar.
- **P12 (`Button.tsx`).** O `blocked` usa um `ref` interno (`markSoftDisabled`). O P12, que entra depois, junta esse `ref` com o `ref` externo do foco por programa (onda-5.md §3).

**Revisões:**

- **Revisão de segurança do commit 3 (`6d82f18`, o caso novo do `invertBatch`).** A revisão à mão não viu achado, mas a do orquestrador viu o afrouxamento dos casos (A) e (B) do item 4, corrigido em `dcc44dd` e `2a53ee4`. Foi feita à mão neste worktree: o agente do pacote não dispara subagentes, e a skill `/security-review` não foi chamada. **Recomendação: rodar o `/security-review` de verdade na integração, sobre o `6d82f18`, o `dcc44dd` e o `2a53ee4`.** O que foi conferido:
  - **AuthZ:** o desfazer continua só do narrador (`operations.ts:549-550`). O inverso devolve o valor de antes do lote, que o narrador já podia gravar à mão, e o lote fica assinado no Histórico.
  - **Vazamento:** o "para" efetivo é o do próprio campo do evento. Texto e especialização ficam fora (`NO_EFFECTIVE`, `contentFree`). O filtro `canRead` da leitura e o da rolagem oculta não mudaram.
  - **Custo:** um `resolve` a mais por lote, num lote que já tem limite de tamanho.
- **Revisão de código do diff `52dbe0f..HEAD`:** a minha, à mão, achou o motivo errado do boost fora da trava (`1d44199`). O `/code-review` (high) do orquestrador achou dez pontos, cada um corrigido num `fix` com teste de regressão:

  | # | Achado | Commit |
  |---|---|---|
  | 1 | A migration `0026` travaria a `0024` e a `0025` (sem `allowUnorderedMigrations`): virou `0024` | `5b354dd` |
  | 2 | O Ajustar XP sem o "-" no Android: `numeric` no Android, `numbers-and-punctuation` no iOS | `a0374bb` |
  | 3 | Na ficha travada, o boost ligado antes ia no pedido: agora não vai, e a caixa aparece desmarcada (o `noCost` do `useDice`) | `96acc64` |
  | 4 | A rolagem que volta depois de a parada mudar ia ao topo: o envio guarda a intenção, e só ela marca `fresh` | `73fcec0` |
  | 5 | O pedido levava o custo da hora do toque: a folha guarda só o alvo (`candidateFor` sobre a ficha de agora) | `d9dc35d` |
  | 6 | O "Digitar" do XP era uma cópia sem a volta do foco: `useTypedValue`, comum ao `NumberEditorRow` (T-25) | `22da8cb` |
  | 7 | O atalho aparecia no traço sem custo (no máximo): só com `cost.ok` | `5ee6c6d` |
  | 8 | No recurso, o atalho saía também com a nota do atual: só com a das linhas `advance` | `4ad7f45` |
  | 9 | O atalho recalculava a lista inteira a cada ficha nova: o `offers` calcula sob demanda | `1603368` |
  | 10 | O toque no bloqueado refazia as consultas em toda recusa: só na de saldo ou de pedido pendente | `ff864a6` |

  **Risco para o E2E (item 3):** o passo 4 do `journey-storyteller.spec.ts` prova o 403 com a página que ainda não sabe da trava. Se ela aprender pela rebusca, o pedido sai sem o boost, e o passo muda.

**Testes do "PR local" (06/11, depois do `ff864a6`):**

| Suíte | Resultado |
|---|---|
| `@tms/sheet-core` (Bun, com cobertura) | 1144 pass; `labels.ts` e `group.ts` acima de 99% |
| `@tms/api` (Bun, PGLite, com cobertura) | 1974 pass, com os 12 casos novos do T-53 |
| `@tms/db` (Bun) | 41 pass, com o da `0024` e o da numeração sem buraco |
| frontend (Jest, com cobertura e `--forceExit`) | 107 suítes, 1647 pass |
| `@tms/ui` (Jest) | 232 pass |
| typecheck dos 11 pacotes e `pnpm lint` | ok (4 avisos do lint, de antes do pacote) |
| `check-system-names.mjs` | ok |

---

## 11. Testes manuais (web, Android com AVD, iOS com idb)

Roteiro para conferir cada item na interface, nas três plataformas, com a API local e o seed do roteiro. Só contas fictícias. Ele detalha o passo 6 da §7. A coluna "Resultado" fica em branco e é preenchida na integração. Nenhum resultado é "ok" sem a evidência; quando uma plataforma não puder ser conferida, o resultado diz "não conferido" e por quê.

**Obrigatórios por plataforma** (coluna "Plataforma" da matriz): no iOS, T-53 (POA-30), T-50 (POA-36), T-77 (POA-37), U-01 (POA-45) e U-02 (POA-22); no Android, T-84 (EA-27); no web, T-79 a 390 (POW-31), T-50 a 390 e a 1280, T-77 e U-02 a 1280. O T-51 e o T-82, citados na preparação da onda como obrigatórios no iOS, são do P12 (matriz l.556 e l.558) e ficam no roteiro dele.

### 11.a Preparação

1. **Banco e API:**
   - `npx pnpm bootstrap` (o `dist` do `@tms/sheet-core` precisa estar novo: o `check-dev-env.mjs` recusa o velho);
   - **no pacote:** um banco local próprio, para não misturar com o de outro worktree. Por exemplo, `docker exec <container do postgres> createdb -U postgres tms_p13` e, nos comandos abaixo, `DATABASE_URL=postgres://postgres:postgres@localhost:5432/tms_p13` (credenciais locais do `docker-compose.yml`, nunca as de outro ambiente). Não ler nem mostrar o `.env`. Nunca `db:down`: o Postgres do Docker é compartilhado;
   - `npx pnpm db:migrate`. O processo pode não encerrar sozinho: conferir pela tabela `kysely_migration` e encerrar;
   - o P13 não muda template: o `templates:publish` não é preciso;
   - API em `npx pnpm dev:api` (3001) e Metro em `cd apps/frontend && npx expo start` (8081).
2. **Seed:** `npx pnpm seed:roteiro --fichas-criacao > <scratchpad>/p13-seed-<plataforma>.log 2>&1`. A saída tem a senha e os e-mails: fica só nesse log, lido com `grep -v -i senha`, nunca mostrado nem copiado. **Um seed por plataforma, com 15 minutos de intervalo** (o limite de aceites de convite do seed). O P13 não gera convite.
   - **O que o seed já cobre:** as contas N (`roteiro_narrador`), J1 (`roteiro_jogador1`), J2 (`roteiro_jogador2`) e N2 (`roteiro_narrador2`), em `@roteiro.test`; as crônicas "{Sistema} v3/v5" (livre) e "{Sistema} v4" (por pontos) de Vampiro, Mago e Lobisomem. Com o `--fichas-criacao` (`scripts/seed-roteiro.ts:24-35`):
     - **"Ficha XP R"** em "Vampiro v3/v5": concluída pelo N, **com 10 de XP** e um pedido de Força pendente (`:408-430`). Serve ao T-50 (o pedido pendente marcado), ao T-77, ao U-01, ao U-02 e à trava;
     - **"Otto Web", "Otto Android" e "Otto iOS"** em "Vampiro v3/v5": em criação, só com nome e clã, com o Sangue no padrão. Servem ao T-53 (uma por plataforma) e ao T-84 em criação.
   - **XP com saldo:** o seed dá 10 XP. Para o traço acima do saldo, o roteiro faz pela tela: N aprova o pedido de Força (custa 4; sobram 6), e J1 escolhe uma Disciplina nova (custa 10; faltam 4). Depois, N concede 10 pelo "Digitar" (U-02), e o "Enviar pedido" se libera.
   - **O que o roteiro cria pela tela:** **"Lobo R"** em "Lobisomem v3/v5" (J1, Nova ficha, só nome e Raça), para o T-79. O seed não muda. Nomes fictícios.
   - A senha é a constante do `scripts/seed-roteiro.ts` e não é escrita aqui, em script versionado nem em captura.
3. **Evidências:** no scratchpad, com o nome `p13-<plataforma>-<largura>-<ID>-<passo>.png`. Sem e-mail visível.

### 11.b Web (Playwright, Chromium; WebKit onde indicado)

- **Script:** `<scratchpad>/p13/web.mjs`, com o `playwright` do `node_modules` do checkout, contra `http://localhost:8081`. O Metro do web pode ficar velho depois de editar: reiniciar com `--clear` antes da rodada.
- **Viewports exatos:** `{ width: 390, height: 844 }` e `{ width: 1280, height: 800 }`.
- **WebKit:** T-50a, T-77a e T-77c também em `webkit.launch()` (o `aria-disabled` tocável e o rodapé da folha no Safari).
- **Seletores por papel e rótulo, como no E2E (§4.3):** `getByRole('radiogroup', { name: 'Talentos' })`, `getByRole('radio', { name: /^Briga, 0 → 1/ })`, `getByRole('button', { name: 'Enviar pedido', exact: true })`, `getByRole('button', { name: 'Solicitar evolução de Força' })`, `getByRole('button', { name: 'Digitar XP a conceder' })`, `getByRole('checkbox', { name: 'Gastar 1 Força de Vontade: +1 sucesso automático' })`, `getByRole('button', { name: /^Citação: / })`; o painel da folha por `getByTestId('bottom-sheet-root').locator('[aria-modal="true"]')`. O Playwright não clica em `aria-disabled` sem `force: true`.
- **Um `page.screenshot` por passo.**

### 11.c Android (AVD)

- **AVD:** `Pixel_3a_API_34_extension_level_7_arm64-v8a` (393 dp), iniciado com `-cores 4 -memory 3072` (só opção de execução), com o `assembleDebug` arm64 da integração.
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Larguras de layout** (a folha da Experiência com o rodapé e a linha do Sobre): `adb shell wm density 480` (360 dp) e `420` (411 dp), e `adb shell wm density reset` no fim.
- **Teclado de software:** `adb shell settings put secure show_ime_with_hard_keyboard 1` (a busca da lista, o texto da Citação e o "Digitar").
- **Navegação:** `adb shell uiautomator dump /sdcard/ui.xml` + `adb pull`, para achar o alvo pelo `text` ou pelo `content-desc` e tocar no centro do `bounds` com `adb shell input tap X Y`; `adb shell input keyevent 4` para o voltar do Android com a folha aberta (fecha a folha, não a tela). O `input text` não digita acento: na busca, só o começo sem acento ("brig", "taum"); na Citação, um texto fictício sem acento.
- **O `Stepper` no `dump`:** os botões ficam fora da árvore de acessibilidade (controle ajustável). O "Digitar" no app é a ação `activate` (toque duplo do leitor de tela) e, para quem vê, o toque no número.
- **Tempo no emulador sob carga não é evidência** (o "busy" da onda 3). O LogBox embaixo engole toque: dispensar antes.

### 11.d iOS (simulador, com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, e iPhone 17, iOS 26.5.
- **Build Debug com "Sign to Run Locally"** (sem assinatura, o app não loga: o keychain responde `-34018`): em `apps/frontend/ios`, `xcodebuild -workspace TMS.xcworkspace -scheme TMS -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath <scratchpad>/ios-dd CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build`. Depois: `xcrun simctl install <UDID> …/TMS.app` e `xcrun simctl launch <UDID> com.tms.app`.
- **O cliente fb-idb:** o venv `~/.venvs/idb-tms` já existe, com o fb-idb 1.7.7, fora do repositório. Rodar `~/.venvs/idb-tms/bin/pip-audit` de novo antes de usar; com vulnerabilidade, parar e registrar. Nunca no `package.json` nem no lockfile.
- **O companion:** só local, no socket de domínio; `--companion-path` vai antes do subcomando. No fim, `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` não mostra nada.
- **Navegação:** `idb ui describe-all --udid <UDID>` (o driver esconde o valor dos campos E-mail e Senha) para achar o alvo pelo `AXLabel` e tocar no centro do `frame` (`idb ui tap X Y`); `idb ui text`, `idb ui swipe`, `idb ui key 40` (Return); `idb screenshot`. Limites: sem o gesto de borda (usar o "‹"); não digita fora do ASCII ("brig", "taum" na busca); digita como teclado físico, e o teclado de software some depois do primeiro texto (o rodapé com o teclado aberto fica para o Android). O P13 não usa deep link.

### 11.e Tabela por item

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-50a | Web 390 (Chromium e WebKit) | J1 | "Ficha XP R" → Experiência → Solicitar evolução | Blocos com o título do template ("Atributos", "Físicos" …, "Talentos" …, "Em jogo"); a busca no topo; a Força com "Já há um pedido pendente" e a cara de bloqueada | `p13-web-390-T-50a-1.png` | |
| T-50b | Web 390 | J1 | Buscar "brig" → tocar "Briga" | O rádio marcado (`aria-checked="true"` no DOM); o rodapé com "Briga: 0 → 1. Custo 3 XP (disponível 10)." e "Enviar pedido" no viewport, sem rolar (`boundingBox` do botão dentro dos 844) | `p13-web-390-T-50b-1..2.png` | |
| T-50c | Web 1280 | J1 | A mesma lista; procurar "Consciência" | Duas, uma em "Talentos" e outra em "Virtudes"; diálogo de 560 (medido no painel) com o rodapé dentro; Esc fecha e o foco volta a "Experiência" | `p13-web-1280-T-50c-1..2.png` | |
| **T-50d** | **iOS SE (obrigatório: POA-36)** e iPhone 17 | J1 | T-50a e T-50b pelo idb | Busca, toque e o rodapé à vista; o `AXLabel` da opção com o nome, o custo e o estado | `p13-iosSE-T-50d-1..3.png`, `p13-ios17-T-50d-4.png` | |
| T-50e | Android 393 e 360 dp | J1 | T-50b com o teclado de software aberto na busca | O rodapé acima do teclado, sem cobrir a busca; o voltar do Android fecha a folha | `p13-and-393-T-50e-1.png`, `p13-and-360-T-50e-2.png` | |
| T-77a | Web 1280 (Chromium e WebKit) | N, depois J1 | N aprova o pedido de Força (sobram 6); J1 → Solicitar evolução → uma Disciplina nova → "Enviar pedido" (`force: true`) | A opção com "10 XP · faltam 4"; o botão com `aria-disabled="true"` e sem `disabled`; o toque mostra "Faltam 4 XP (custa 10, disponível 6)." e nenhum `POST /xp-requests` sai (conferir na rede) | `p13-web-1280-T-77a-1..2.png` | |
| **T-77b** | **iOS SE (obrigatório: POA-37)** | J1 | T-77a pelo idb | O motivo ao lado do botão; o toque não envia (a lista de pedidos não muda) | `p13-iosSE-T-77b-1..2.png` | |
| T-77c | Web 1280 | N, depois J1 | N trava a "Ficha XP R" (Narrador → Travar); J1 → Dados → Destreza → tocar "Gastar 1 Força de Vontade" | O checkbox com `aria-disabled` e "O narrador travou a ficha: a rolagem sai sem gastar."; o toque não liga; "Rolar no app" rola, sem gastar | `p13-web-1280-T-77c-1..2.png` | |
| T-77d | iOS SE e Android 393 | J1 | T-77c | O mesmo; no `describe-all` e no `dump`, o estado de desabilitado e o motivo como texto | `p13-iosSE-T-77d-1.png`, `p13-and-393-T-77d-2.png` | |
| U-02a | Web 1280 | N | Mesa de "Vampiro v3/v5" → selecionar "Ficha XP R" → Conceder XP → "Digitar XP a conceder" → 10 → Enter → motivo → Conceder | O número 10 no stepper; "1001" mostra "Digite um número inteiro de 1 a 1000" | `p13-web-1280-U-02a-1..3.png` | |
| **U-02b** | **iOS SE (obrigatório: POA-22)** | N | Na ficha → Experiência → Conceder XP → tocar no número → 10 → Return | O campo numérico abre; 10 em três toques | `p13-iosSE-U-02b-1..2.png` | |
| U-02c | Web 1280 | N | Ajustar XP → Digitar → −5 | −5 aceito; o "Ajustar XP" ativo com o motivo | `p13-web-1280-U-02c-1.png` | |
| T-77e | Web 1280 | J1 | Depois do U-02a, sem fechar a folha: tocar o "Enviar pedido" bloqueado | O extrato é pedido de novo, o saldo passa a 16 e o botão se libera | `p13-web-1280-T-77e-1.png` | |
| U-01a | Web 390 | J1 | "Ficha XP R" → Editar → aba Ficha → Destreza | "Peça ao narrador." com "Solicitar evolução"; o toque abre a Experiência com Destreza marcada e o rodapé | `p13-web-390-U-01a-1..2.png` | |
| **U-01b** | **iOS SE (obrigatório: POA-45)** | J1 | U-01a pelo idb; depois a Força de Vontade permanente | O mesmo; a FdV abre com "Força de Vontade" marcada | `p13-iosSE-U-01b-1..2.png` | |
| U-01c | Web 390 | J1 | Editar → Vantagens → Disciplinas | A nota da lista com "Solicitar evolução", que abre a busca "Disciplinas" | `p13-web-390-U-01c-1.png` | |
| U-01d | Web 390 | N | Aprovar o pedido que veio pelo atalho (o passo seguinte da fase 2) | O pedido aprovado; o traço sobe na ficha de J1 | `p13-web-390-U-01d-1.png` | |
| T-53a | Web 390 | J1 | "Otto Web" → Jogo → chip do Sangue → "Gastar 1" | Toast "Sangue 10 → 9"; "Desfazer" → "Desfeito: Sangue 10 → 9" | `p13-web-390-T-53a-1..2.png` | |
| **T-53b** | **iOS SE (obrigatório: POA-30)** | J1 | "Otto iOS" → T-53a → "Mais opções" → Histórico | "Sangue 10 → 9" no toast; no Histórico, "Sangue: 10 → 9" e, no desfazer, "Sangue: 9 → 10" | `p13-iosSE-T-53b-1..3.png` | |
| T-53c | Web 1280 | J1, depois N | J1 gasta 1 Sangue em "Otto Web" de novo; N → Histórico → "Desfazer" no lote | A linha do desfazer do narrador diz "Sangue: 9 → 10"; N desfaz também o desfazer do app (T-53a) sem "a ficha mudou depois" | `p13-web-1280-T-53c-1..2.png` | |
| T-53d | Android 393 | J1 | "Otto Android" → T-53a | O mesmo texto no toast | `p13-and-393-T-53d-1.png` | |
| **T-79a** | **Web 390 (obrigatório: POW-31)** | J1 | "Lobo R" → Dados → Força → Rolar no app → trocar o Atributo para Destreza | O resultado sai do topo e aparece em "Nesta sessão"; a lista do Atributo com "Atributos" e "Em jogo", a Força de Vontade no segundo | `p13-web-390-T-79a-1..3.png` | |
| T-79b | Web 390 | J1 | "Otto Web" → Dados → Atributo | Sem cabeçalho (um grupo só), como hoje | `p13-web-390-T-79b-1.png` | |
| T-79c | iOS SE e Android 393 | J1 | T-79a | O mesmo; os cabeçalhos no `describe-all` e no `dump` | `p13-iosSE-T-79c-1.png`, `p13-and-393-T-79c-2.png` | |
| **T-84a** | **Android 393 (obrigatório: EA-27)**, 360 e 411 dp | J1 | "Ficha XP R" → Editar → Sobre → tocar em "Citação" → texto fictício sem acento → Aplicar → Salvar | A folha do texto abre com o teclado de software; o voltar fecha a folha; depois de salvar, a Citação aparece entre aspas em Jogo; a linha cabe a 360 | `p13-and-393-T-84a-1..4.png`, `p13-and-360-T-84a-5.png`, `p13-and-411-T-84a-6.png` | |
| T-84b | Web 390 | J1 | "Otto Web" (em criação, Editar) → Sobre → Notas | O mesmo; Notas abre o campo longo | `p13-web-390-T-84b-1.png` | |
| T-84c | Web 390 | J1 | "Lobo R" → Editar → Sobre | Citação, Deformidade e Notas editáveis | `p13-web-390-T-84c-1.png` | |
| T-84d | Web 1280 | N | "Ficha XP R" → "Editar como narrador" → Sobre | Citação e Notas da J1 editáveis; "Notas do Narrador · privadas: o jogador não vê" continua só leitura, e o botão "Editar Notas do Narrador" da barra continua | `p13-web-1280-T-84d-1.png` | |
| T-84e | iOS SE | J1 | T-84a pelo idb (a Citação em ASCII) | O mesmo | `p13-iosSE-T-84e-1.png` | |

### 11.f Acessibilidade mínima

- **O controle bloqueado diz o motivo:** no web, `aria-disabled="true"` sem `disabled`, com foco pelo Tab, e o `aria-describedby` apontando o motivo ("Enviar pedido", o boost, a opção acima do saldo); no Android, o estado de desabilitado no `dump` e o motivo como texto ao lado; no iOS, o `describe-all` com o estado e o motivo. O toque mostra o motivo como alerta.
- **A opção marcada:** `role="radio"` com `aria-checked` no DOM; o bloco é o nome do `radiogroup` ("Talentos"); no app, o rádio marcado no `describe-all` e no `dump`. A "Consciência" de Talentos e a de Virtudes se distinguem pelo grupo.
- **O atalho** tem o nome "Solicitar evolução de Força" (começa pelo texto visível).
- **O "Digitar"** é o botão "Digitar XP a conceder" no web e a ação "Digitar o valor" do controle ajustável no app.
- **O resultado dos Dados** não é anunciado ao trocar a parada; a rolagem nova é (região `aria-live`).
- **O editor da Citação** tem o nome "Citação: vazio" (web) ou o rótulo e o valor (app), como os outros textos.
- **O que fica para ouvir no aparelho:** o AVD não tem TalkBack, e o `describe-all` não fala. O anúncio do motivo depois do toque bloqueado (`announceForAccessibility`) e o "Faltam 4 XP" no VoiceOver e no TalkBack ficam para o aparelho.

### 11.g Limpeza

- N destrava a "Ficha XP R" (Narrador → Destravar).
- Parar a API e o Metro.
- Desligar o AVD (`adb emu kill`) e os simuladores (`xcrun simctl shutdown all`).
- `adb shell wm density reset` e `adb shell settings put secure show_ime_with_hard_keyboard 0`.
- Encerrar o `idb_companion` (o `lsof` não mostra nada escutando) e sair do venv.
- O P13 não gera convite: nada a revogar.
- O banco `tms_p13` pode ser apagado (`dropdb`). O log do seed e as capturas ficam no scratchpad até a integração; nada vai para o repositório.

### 11.h Quando uma plataforma não puder ser conferida

O resultado diz "não conferido" e o motivo, por exemplo:

- "o build do iOS com assinatura local falhou em …";
- "o `pip-audit` acusou vulnerabilidade no fb-idb; o roteiro do iOS parou";
- "o AVD não respondeu com o teclado de software aberto (ANR); o T-50e ficou para a próxima rodada, e o T-84a continua obrigatório".

O passo fica para a integração ou para o roteiro antes do release. Nunca "ok" sem a evidência.

**Da [onda-4.md](onda-4.md) §11, o que toca este pacote:** o achado 4 (o "+" no limite com `disabled`, candidato (d) da seção 2.4) e o achado 6 (o "Desfazer" no lote de criação aprovado, candidato (c)); o achado 5 (no Android, o "−" e o "+" do controle ajustável aparecem no `dump` sem o nome do item), que vale também para o `Stepper` do "Conceder XP" e fica para ouvir com o TalkBack; e o "não conferido" dos anúncios do VoiceOver e do TalkBack, que este roteiro também não fecha (11.f).
