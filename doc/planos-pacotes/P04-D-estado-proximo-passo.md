# P04-D · Estado, próximo passo e pedir ajuste: plano de implementação

> Plano · 2026-11-02 · base conferida: `onda/3-estado-narrador` em `617264d`

Este plano implementa o pacote [P04-D da matriz de achados](../testes/2026-11-01/matriz-achados.md#p04-d), da onda 3, que aplica as decisões D-02, D-03 e D-04. Ao fim do pacote:

- a ficha diz em que estado está, sob o nome, na lista da crônica e na Mesa;
- a barra da ficha diz o próximo passo e quem conclui;
- na criação livre, o jogador avisa que terminou;
- o narrador pede ajuste, com motivo, em qualquer ficha em criação, com a aprovação ligada ou não.

É um pacote de decisão de produto. Ele cria dois marcadores no ciclo da criação ("ajuste pedido" e "avisou que terminou") e duas rotas novas na API. Não remove campo, não muda regra do jogo e não afrouxa limite:

- a conta da criação, a política de escrita e a AuthZ continuam no servidor;
- as duas ações novas são comandos da API com a ficha travada, que conferem papel e estado lá dentro;
- o selo e o texto do próximo passo só mostram o que o servidor mandou.

Todas as linhas citadas são do `617264d`. A árvore é igual à da `main` em `3a43ed8` (merge da onda 2, PR #41). A matriz cita o `1db3db9`, de antes das ondas 1 e 2. O que mudou desde então, e onde a causa provável da matriz está errada, está na seção 3.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md), "Decisões de produto" (D-02, D-03, D-04), "Como executar" e §P04-D | Itens, decisões, "PR local" e critério de saída da onda |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §1 (C1), §4.1 (passos 7 e 12 a 16), §4.2 e as recomendações R-12, R-13 e R-14 | Causa, tarefas não concluídas ("entregar" e "devolver") e recomendações |
| [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) §5, "Observações" | Privacidade das Notas do Narrador, que explica o canal novo da R-14 |
| Notas: [po-web](../testes/2026-11-01/notas/po-web.md) (POW-08, POW-11), [po-app](../testes/2026-11-01/notas/po-app.md) (POA-10), [experiente-web](../testes/2026-11-01/notas/experiente-web.md) (EW-06), [experiente-app](../testes/2026-11-01/notas/experiente-app.md) (EA-13), [iniciante-web](../testes/2026-11-01/notas/iniciante-web.md) (IW-08, IW-13), [iniciante-app](../testes/2026-11-01/notas/iniciante-app.md) (IA-04, IA-13), [narrador-web](../testes/2026-11-01/notas/narrador-web.md) (NW-24, NW-27, NW-28), [narrador-app](../testes/2026-11-01/notas/narrador-app.md) (NA-18) | Cenários do critério de pronto (§7) e do roteiro manual (§11) |
| [plano-v4.md](../plano-v4.md) §3.4 e Etapa 4 | Ciclo da criação: concluir, enviar, aprovar e devolver |
| [proximas-features.md](../proximas-features.md) §2.2, item 8 | Push, que a D-03 deixa para depois |
| [onda-1.md](onda-1.md) §6 e §9; [onda-2.md](onda-2.md) §4.4, §6 e §10 | Pontos para o PO em aberto, o lugar do selo e o que só o E2E e o aparelho pegaram |
| [P04-C](P04-C-ciclo-vida-ficha.md) §2, §3.2 e §10; [P08](P08-layout-teclado.md) §3.10, §3.14 e §10; [P02](P02-seguranca-sessao-api.md) §3.5 e §5; [P03-C](P03-C-rascunho-salvamento.md) | O que este pacote estende: a devolução, o cabeçalho, as datas e o rascunho |
| `design/design-system/components.md`: IdentityBlock, ListItem, ModeBar, CharacterHeader e Tags | Onde o selo e o texto do próximo passo entram no DS |

## 1. Objetivo e itens

**Objetivo (matriz).** Em qualquer tela, a ficha diz em que estado está e qual é o próximo passo. O jogador da criação livre avisa que terminou. O narrador pede ajuste com a aprovação ligada ou desligada.

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| R-12 | alta | A ficha não diz em que estado está. A lista diz "Sua ficha" antes e depois de concluir. Nada aparece sob o nome. A Mesa não mostra "Aguardando aprovação". O Histórico só registra a conclusão | `components/chronicles/characterState.ts:14-22`: só `pending` e devolvida. `CharacterList.tsx:88-95`, `:111`. `tableItems.ts:40-57`: `pending` dá `null`. `sheet/IdentityBlock.tsx:76-92`: nada sob o nome. `SheetMenu.tsx:48-50` e `StatusMenu.tsx:194`, com o mesmo `stateLabel`. API: `sheets/routes.ts:426-445`, a lista manda só `status` e `returned`; `chronicles/table.ts:84-101`; `sheets/events.ts:112-115`, só a conclusão |
| R-13 | alta | A barra não diz o próximo passo nem quem conclui. Na criação livre, não há como "entregar" | `sheet/evolve/ModeBar.tsx:206-233`: a barra só tem a contagem e um botão. `:312-358`: `EvolveBar`. `sheet/creation/CreationPanel.tsx:86-148`: `useFinishCreation`, só concluir ou enviar. API `sheets/creation.ts:612-620`: na criação livre, só o narrador conclui, e não existe aviso |
| R-14 | alta | Com a aprovação desligada, o narrador não tem como pedir ajuste numa ficha em criação | `sheet/storyteller/StatusMenu.tsx:92-111`: em `creating`, só Concluir, Arquivar e o rótulo de `dead`. API `sheets/creation.ts:752-815`: devolver só sai de `pending` (`:779-780`). `CreationPanel.tsx:335-490`: o "Devolver para correção" só existe em `pending` |

**Também entra** a nota que o `/code-review` do P04-C deixou para este pacote ([P04-C](P04-C-ciclo-vida-ficha.md) §10): "na criação livre, a dona em Editar continua em Editar quando o narrador conclui". Ela é tratada na §3.7.

## 2. Decisões aplicadas

| Decisão | O que diz (matriz) | Como o código acomoda |
|---|---|---|
| **D-02** (R-12) | Estados "Em criação · livre" ou "Em criação · por pontos", "Aguardando aprovação", "Aguardando ajuste", "Devolvida" e "Concluída em dd/mm". Eles aparecem sob o nome da ficha, na lista da crônica, na aba Fichas e na Mesa. O Histórico registra o evento "criação concluída" | Uma regra pura (`characterState`, §3.4) e um componente de selo (`StateBadge`, novo no `@tms/ui`). O selo fica sob o nome grande, no `IdentityBlock` (§3.5), na lista e no cartão da Mesa. "Criação concluída" já entrou no P04-C (T-80); este pacote soma os outros passos ao Histórico (§3.6) |
| **D-03** (R-13) | Na criação livre, "Avisar que terminei" mostra um selo ao narrador na Mesa; o push fica para depois. Em todo modo, um texto na barra diz o próximo passo e quem conclui | Marcador `ready` no `creation` e a rota `POST /characters/:id/creation/ready` (§3.1). O botão fica na barra de ação do Editar e uma linha de texto vem do `nextStepCopy` (§3.3). "Em todo modo" é lido como **todo modo da crônica** (livre, por pontos sem aprovação e por pontos com aprovação), como na R-13 ("por modo da crônica"), e não como todo modo da ficha: em Jogo e Leitura não há barra de ação, e quem diz o estado é o selo |
| **D-04** (R-14) | Estado novo "Aguardando ajuste": o narrador pede ajuste com motivo em qualquer ficha em criação, com a aprovação ligada ou não. O jogador vê o motivo como na devolução. A ação é só do narrador da crônica, validada no servidor | Marcador `adjust` no `creation` e a rota `POST /characters/:id/creation/adjust` (§3.1). "Pedir ajuste" fica no `StatusMenu`, que abre pelo botão largo e pelo "Mais opções" (§3.2). O motivo aparece no `NarratorReasonBanner` do P04-C, o mesmo da devolução |

**Fica fora deste pacote:**

- **"Reabrir criação" (D-04).** Fica fora deste ciclo e só é registrado em `proximas-features.md` pelo P01-D (onda 5). A confirmação de concluir continua dizendo "Não dá para voltar à criação" (`completion.ts:22-27`).
- **O push do "Avisar que terminei" (D-03).** Fica para o item 8 do §2.2 de `proximas-features.md`. Agora o narrador vê o aviso pelo selo, pelo banner da aba Fichas e pela contagem na lista de crônicas (§3.3).
- **O progresso da criação na Mesa, o filtro "Em criação / Pendentes" e a contagem por estado** são do P09-D (D-10, onda 5). Ele usa os estados deste pacote.

**O que o código mostra que não se aplica como está escrito** (apontado, não decidido; vai para o PO na §9):

1. **"Concluída em dd/mm" não vem do `creation_completed_at`.** Com a aprovação ligada, o `creation_completed_at` guarda a data da submissão (`packages/db/src/migrations/0016_character_creation.ts:9-14`, `apps/api/src/sheets/creation.ts:644-646`). A data em que a ficha entrou em jogo é o `activated_at`, gravado na primeira ativação pela criação (concluir ou aprovar, `creation.ts:675`, `:741`). O selo usa o `activated_at`, que é a mesma data do item "Criação concluída" do Histórico.
2. **A D-02 não lista o estado que a D-03 cria.** Depois de "Avisar que terminei", a ficha precisa de um texto próprio. O plano propõe "Avisou que terminou" para o narrador e "Você avisou que terminou" para o jogador. É texto de produto (ponto 1 da §9).
3. **"Aguardando aprovação" × o texto de hoje.** A lista diz "Aguarda aprovação" ao jogador e "Aguarda sua revisão" ao narrador (`characterState.ts:18-19`); o painel da ficha diz "Aguardando aprovação" (`CreationPanel.tsx:376-384`). O plano usa o texto da D-02 no selo, para os dois papéis. O chamado ao narrador continua no banner da aba Fichas ("1 ficha aguarda sua revisão", `CharacterList.tsx:215-227`). Ponto 2 da §9.
4. **"Pedir ajuste em qualquer ficha em criação" e o `pending`.** A ficha enviada para aprovação está em `pending`, e lá o narrador já tem "Devolver para correção", com motivo (`CreationPanel.tsx:400-450`). É a mesma transição, de volta à criação com motivo. O plano oferece "Pedir ajuste" em `creating`, com a aprovação ligada ou não, e não acrescenta um segundo nome para a devolução em `pending` (ponto 4 da §9).
5. **"Aguardando ajuste" não impede concluir.** A D-04 não diz se impede. A devolução de hoje não impede reenviar. O plano segue a devolução: na criação por pontos sem aprovação, o jogador pode concluir sem ajustar. A corrida em que ele conclui sem ter visto o pedido é recusada pela revisão (§3.1). Ponto 3 da §9.
6. **"Na lista da crônica e na aba Fichas" são o mesmo componente.** No código, a lista da crônica é a aba Fichas (`CharacterList`), para o jogador e para o narrador (`app/(app)/chronicles/[id]/index.tsx:118-131`, `:245-254`). A lista de crônicas (tela inicial) só tem a contagem "N fichas aguardam revisão" (`app/(app)/index.tsx:81-82`), que este pacote estende ao aviso de "terminei" (§3.3).

**Pontos para o PO das ondas anteriores (continuam abertos; nenhum é tratado como decidido):**

- **onda-2 §6.4** (a ficha em criação livre abre em Editar): o plano não muda o modo de abertura. O "Avisar que terminei" aparece na barra do Editar, que é onde a ficha livre abre hoje.
- **onda-2 §6.6** (extrato no Histórico): o Histórico ganha os passos do ciclo (§3.6), sem extrato de pontos.
- **onda-2 §6.8** (dois toques do narrador abaixo de 900): o "Pedir ajuste" segue o mesmo caminho. São três toques até a folha do motivo: "Mais opções", "Ações do narrador · {estado}" e "Pedir ajuste".

## 3. Desenho por item

### 3.0 O que o código faz hoje

**O ciclo da criação** (`apps/api/src/sheets/creation.ts:47-56`):

- **Estados:** `status` vai de `creating` a `pending` e de `pending` a `active` (`characters_status_check`, migration `0016`, `:23-28`). O `creation` (jsonb) guarda as escolhas, a camada de configuração e o motivo da última devolução, `returned: { reason, at }` (`packages/sheet-core/src/creation.ts:850-893`).
- **Comandos:** concluir, aprovar, devolver e salvar escolhas. Cada um:
  - trava a ficha (`lockCharacter`);
  - aceita uma chave (`once`, `:83-128`);
  - confere `revision` e `sheetVersion` quando o app manda (`checkExpected`, `:256-273`);
  - grava a auditoria (`settle`, `:291-332`).
- **A devolução:** sai só de `pending` (`:779-780`), com o motivo limitado a `RETURN_REASON_MAX` (500) e validado por `isSafeText` (`:758-763`). A conclusão apaga o `returned` (`:642`).
- **Concluir, por modo:**
  - na criação livre, só o narrador conclui (`:612-620`);
  - na criação por pontos, o dono conclui ou envia para aprovação.

**Onde o estado aparece hoje:**

| Lugar | O que mostra | Código |
|---|---|---|
| Lista da crônica (aba Fichas) | "Sua ficha" ou "de {jogador}", e só "Aguarda aprovação", "Aguarda sua revisão" ou "Devolvida" | `CharacterList.tsx:88-95`; `characterState.ts:14-22` |
| Mesa | "Em criação" em `creating`; nada em `pending`; "Travada", "Arquivada" e o rótulo de `dead` | `tableItems.ts:40-57`; `TableRow.tsx:107-113` |
| Botão largo do narrador e item do "Mais opções" | O mesmo `stateLabel` da Mesa | `StatusMenu.tsx:194`; `SheetMenu.tsx:48-50` |
| Sob o nome da ficha | Nada | `IdentityBlock.tsx:76-92` |
| Painel da ficha | "Aguardando aprovação" em `pending` e o banner da devolução | `CreationPanel.tsx:376-384`; `ReturnedBanner.tsx:33-49` |
| Histórico | Só "Criação concluída" | `events.ts:112-115`, `:537-547` |
| Cabeçalho | O `subtitle` da `AppBar`, que o P08 reservou e ninguém usa | `packages/ui/src/AppBar.tsx:48`, `:77-81` |

**A barra.** Na Criação, a barra tem um botão só, que salva e, com a conta fechada, conclui (`ModeBar.tsx:208-231`). No Editar, o botão é "Concluir" e só salva (`:206-207`, `:312-326`). Nenhuma das duas diz o próximo passo. O P03-D separa "Salvar" da ação seguinte (D-01). Este pacote entra depois dele (§8.4).

### 3.1 O estado na API: "ajuste pedido" e "avisou que terminou" como marcadores do `creation` (R-14, R-13)

**Por que no `creation`, e não um valor novo em `status`.** "Aguardando ajuste" e "avisou que terminou" são situações de uma ficha que continua em criação. Ela continua editável pelo dono, pela mesma política. É o mesmo caso da devolução, que já mora no `creation` (`returned`). Um valor novo em `status` obrigaria a mudar:

- a migration do `characters_status_check` (`0016`);
- o `CHARACTER_STATUSES` do core;
- o `writePolicy` (`packages/sheet-core/src/policy.ts`), que libera a escrita em `creating`;
- o filtro da Mesa (`chronicles/table.ts:33`);
- o `openingMode` (`SheetScreen.tsx:326-338`) e o `creationActive` (`sheet/creation/creation.ts:68`);
- as transições de `apps/api/src/sheets/status.ts`.

Tudo isso para um estado em que nada muda na escrita. **Sem migration.** A `0023` fica livre para o P11.

**Tipo no core** (`packages/sheet-core/src/creation.ts:850-893`), aditivo:

```ts
export interface CreationReady { readonly at: string }
export interface CharacterCreation {
  readonly choices?: CreationChoices
  readonly config?: CreationConfigLayer
  readonly returned?: CreationReturn
  // D-04: o narrador pediu ajuste (motivo e data), com a ficha em criação
  readonly adjust?: CreationReturn
  // D-03: o dono avisou que terminou (criação livre)
  readonly ready?: CreationReady
}
```

O `parseCharacterCreation` lê os dois campos com a mesma defesa do `returned` (`:890-892`): o que não tiver a forma esperada fica de fora. O `RETURN_REASON_MAX` vale também para o motivo do ajuste. Não há constante nova, porque é o mesmo campo de texto, com o mesmo destino.

**Transições.** Todas conferidas no servidor, com a ficha travada. Qualquer outra combinação é recusada (fail secure).

| De | Ação | Quem | Para | O que limpa |
|---|---|---|---|---|
| `creating` (livre ou por pontos; devolvida, com ajuste ou com aviso) | Pedir ajuste | Narrador da crônica, em PC de outra pessoa | `creating` com `adjust` | `ready` e `returned` (o motivo novo substitui o anterior) |
| `creating`, criação livre, sem `ready` | Avisar que terminei | Dono, membro, sem o papel de narrador | `creating` com `ready` | `adjust` e `returned` |
| `creating` com `ready` | Avisar de novo | — | 409 `CREATION_ALREADY_READY` | — |
| `creating` (qualquer marcador) | Concluir (dono, por pontos) | Dono | `pending` ou `active` | `returned` (hoje), `adjust` e `ready` |
| `creating` (qualquer marcador) | Concluir (narrador) | Narrador | `active` | os três |
| `pending` | Devolver | Narrador | `creating` com `returned` | `adjust` e `ready` (já limpos ao enviar; o código limpa por garantia) |
| `pending`, `active`, `archived`, `dead` | Pedir ajuste ou avisar | — | 409 `CREATION_NOT_CREATING` | — |
| NPC ou ficha do próprio narrador | Pedir ajuste | — | 409 `CREATION_ADJUST_UNAVAILABLE` | — |
| `creating`, criação por pontos | Avisar | — | 409 `CREATION_NOT_FREE` ("na criação por pontos, conclua ou envie para aprovação") | — |

**Rotas novas** (`apps/api/src/sheets/creation.ts`, depois da devolução, `:752-815`). Seguem o padrão da devolução e reaproveitam `access`, `lockCharacter`, `once`, `checkExpected` e `audit`:

- **`POST /characters/:id/creation/adjust`**
  - corpo `{ clientCommandId?, reason, revision? }`;
  - `access()` dá 404 para quem não alcança a ficha e para o `viewer` (`:281-285`);
  - sem o papel `storyteller`, 403 `FORBIDDEN` ("só o narrador pede ajuste"), como a devolução (`:756-757`);
  - o motivo passa por `trim`, de 1 a `RETURN_REASON_MAX`, e por `isSafeText`; senão, 422 com `issues: [{ path: 'reason' }]`, sem ecoar o texto. O `t.String` do corpo tem o mesmo teto da devolução (`:812`);
  - dentro da transação: o estado, o tipo (`kind === 'pc'`) e o dono (`row.userId !== me`);
  - grava o `creation` com `adjust: { reason, at }`, sem `ready` nem `returned`. Sobe a `creation_revision`;
  - `CommandKind` ganha `'creation.adjust'` (`:70-74`); o pedido entra no hash já com o motivo aparado, como na devolução (`:768-770`).
- **`POST /characters/:id/creation/ready`**
  - corpo `{ clientCommandId?, revision?, sheetVersion? }`;
  - exige `owner` e não `storyteller`. O narrador conclui; na ficha dele mesmo, também: 403 `CREATION_STORYTELLER_CONCLUDES`;
  - aplica o `writePolicy` do dono, como o concluir (`:601-609`). O ex-membro e a ficha bloqueada são recusados pela mesma `refusal`;
  - confere o modo efetivo com `creationInputOf(...).config.mode === 'free'`;
  - grava `ready: { at }`, sem `adjust` nem `returned`. Sobe a `creation_revision`. `CommandKind` ganha `'creation.ready'`.

As duas respondem `{ revision }`, e o app rebusca a ficha, a lista e a Mesa (`useRefresh`, `lib/queries/creation.ts:12-31`).

**Mudanças nas rotas existentes:**

- **Concluir** (`:642`): `const { returned: _, adjust: __, ready: ___, ...kept } = creation`.
- **Devolver** (`:787-798`): o `creation` gravado tira `adjust` e `ready` antes de pôr o `returned`.
- **Salvar escolhas e orçamento** (`PATCH /characters/:id/creation`, `:508-512`): o `merged` passa a manter `adjust` e `ready`. Hoje ele só mantém `choices`, `config` e `returned`. Sem isso, o narrador que ajusta o bônus apagaria o pedido de ajuste. Há teste próprio na §4.1.
- **`creationView`** (`:166-182`): passa a mandar `adjust` (motivo e data) e `ready` (data), ao lado do `returned`. Só dono e narrador chegam a esse objeto (`routes.ts:530-559`); o `viewer` recebe um envelope sem `creation` (`:509-527`).

**Revisão e data de alteração.**

- **As duas ações sobem a `creation_revision`.** O app conclui mandando a revisão que viu (`CreationPanel.tsx:114`; `StatusMenu.tsx:283-286`). Se o narrador pede ajuste enquanto o jogador conclui, quem chega depois recebe 409 `CREATION_REVISION_CONFLICT`. Assim, ninguém conclui por cima de um pedido que não viu (§3.3, mensagem). O custo: quem grava prioridade com a revisão velha recebe o mesmo 409 que já existe quando o narrador ajusta o orçamento (pergunta 3).
- **O `updated_at` não muda.** Pedir ajuste e avisar não mexem nos dados da ficha. A Mesa usa o `updated_at` em "<dono> · alterada às" (`TableRow.tsx:43`). Se o ajuste do narrador o atualizasse, a Mesa repetiria o defeito do T-83 ("alterada" com o nome do dono). O selo e o Histórico mostram o passo com a data dele.

**Auditoria** (`apps/api/src/audit.ts:9-39`). A união ganha:

| Ação | Quem grava | `payload` | Frase sugerida para o P11 (T-63) |
|---|---|---|---|
| `character.creation.adjust` | narrador | `{}`: o motivo **nunca** entra, como na devolução (`creation.ts:801`) | "O narrador pediu um ajuste na ficha {ficha}" |
| `character.creation.ready` | dono | `{}` | "{jogador} avisou que terminou a ficha {ficha}" |

Sem migration: `chronicle_audit.action` é `text` sem check (`0014_character_status.ts:42`), e `character_commands.kind` também (`0016`, `:71`).

### 3.2 R-14 · "Pedir ajuste" no menu do narrador; o motivo chega como a devolução

**Menu** (`apps/frontend/sheet/storyteller/StatusMenu.tsx`):

- **`StatusActionId` ganha `'adjust'`** (`:44-50`). Em `statusActions` (`:66-127`), o caso `creating` passa a listar "Concluir criação", **"Pedir ajuste"**, "Arquivar" e o rótulo de `dead`.
  - O item só entra quando o alvo aceita ajuste: PC de outra pessoa. O `StatusMenuTarget` (`:165-171`) ganha `adjustable: boolean`, calculado em `narratorOf` (`SheetScreen.tsx:298-310`) como `kind === 'pc' && !roles.includes('owner')`.
  - É UX: o servidor recusa NPC e ficha própria (§3.1).
- **A confirmação ganha um campo** e reaproveita o padrão que já troca a lista pela pergunta na mesma folha (`:322-373`). A folha "Pedir ajuste" tem:
  - um texto curto: "O jogador vê o motivo na ficha, como numa devolução. A ficha continua em criação.";
  - um `TextField` com rótulo "O que precisa ser ajustado", `maxLength={RETURN_REASON_MAX}` (o contador do T-64 mostra "N/500"), `autoFocus`, `returnKeyType="send"` e `testID="status-adjust-reason"`;
  - os botões "Voltar" e "Pedir ajuste" (`testID="status-adjust-confirm"`). Este fica desabilitado enquanto o texto aparado estiver vazio.
- **Enviar pelo teclado.** O `onSubmitEditing` usa `e.nativeEvent.text`, não o estado. É a lição do `e0a4078`: o "✓" chega antes do último `onChangeText`.
- **A mutação** é a `useAdjustCreation(characterId, chronicleId)`, nova em `lib/queries/creation.ts`, no padrão de `useReturnCreation` (`:104-120`): chave por intenção (`useCommandKey`), `revision` da ficha em cache e `useRefresh`.
  - **Sucesso:** toast "Ajuste pedido. O jogador vê o motivo na ficha." e a folha fecha.
  - **422:** "Escreva o que precisa ser ajustado (até 500 caracteres, sem < nem >)." na própria folha, com `accessibilityRole="alert"`, e o texto fica.
  - **409:** "A ficha mudou desde que você abriu. Confira e peça de novo." (`STALE_COMPLETION` adaptado) e a ficha é rebuscada.
- **A folha não muda a API da `BottomSheet`.** Ela herda o Esc na captura, inclusive sem campo em foco (`f3f3b8a`, pilha de folhas), a devolução do foco ao gatilho e o diálogo central de 560 a partir de 600 px (P08). Vinda do "Mais opções", ela abre no `onClosed` do menu, que faz a troca de folha no iOS (`SheetMenu.tsx:64-72`).
- **Em `pending`:** nada muda. O narrador continua com "Aprovar ficha" e "Devolver para correção" no painel (§2, item 4).

**Jogador e narrador veem o motivo** (`apps/frontend/sheet/creation/ReturnedBanner.tsx`):

- O `ReturnedBanner` passa a escolher entre os dois motivos. Só um existe por vez, porque o pedido de ajuste apaga o `returned` (§3.1).
  - `adjust`: o título é "O narrador pediu um ajuste" para o dono e "Você pediu um ajuste" para o narrador. `testID="creation-adjust"`.
  - `returned`: como hoje (`creation-returned`).
- Ele usa o `NarratorReasonBanner` do P04-C (`:16-30`), em qualquer modo (`SheetView.tsx:267`). O `Banner` `warning` já é região viva educada (`packages/ui/src/Banner.tsx:51-52`): quando a ficha aberta rebusca e o pedido chega, o leitor de tela anuncia.
- `CreationInfo` (`sheet/creation/creation.ts:29-62`) ganha `adjust` e `ready`, lidos com a mesma defesa do `returned` (`:55-58`).

### 3.3 R-13 · O próximo passo na barra e "Avisar que terminei"

**O texto** sai de uma função pura, `nextStepCopy`, num arquivo novo (`apps/frontend/sheet/creation/nextStep.ts`), ao lado do `completionCopy` do P04-C:

```ts
nextStepCopy({ by, mode, approval, marker }): string | null
// by: 'owner' | 'storyteller' (completionBy); mode: 'free' | 'points'
// marker: 'adjust' | 'returned' | 'ready' | null
```

| Quem e modo da crônica | Sem marcador | Com `adjust` ou `returned` | Com `ready` |
|---|---|---|---|
| Dono, criação livre | "Quando terminar, avise: o narrador conclui." | "Ajuste o pedido do narrador e avise de novo." | "Você avisou. O narrador conclui a criação." |
| Dono, por pontos, sem aprovação | "Você conclui quando a conta fechar." | "Ajuste o pedido do narrador e conclua." | — |
| Dono, por pontos, com aprovação | "Quando a conta fechar, envie ao narrador." | "Ajuste o pedido do narrador e envie de novo." | — |
| Narrador na ficha própria | "Você conclui a criação." | — | — |
| Narrador na ficha de outra pessoa | `null`: o estado está no selo e no banner (§3.5) | `null` | `null` |

- **Cada frase tem até ~48 caracteres** (estimado: 13 sp × ~0,52 em, em 328 dp úteis a 360), para caber numa linha a 360 dp.
- **O que acontece depois de concluir** ("subir um traço passa pelo narrador") já está no corpo da confirmação (`completion.ts:22-27`), e não se repete na barra.
- **Nenhum nome de sistema.** O texto depende só do modo, da aprovação e do papel.

**Onde fica.** Na barra de ação do `useModeBar` (`ModeBar.tsx:206-233`), que o P03-D reorganiza:

- a linha vai sob a contagem ("Editando · 1 alteração" / "Criação · …"), em `caption`, `inkMuted`, com `testID="next-step"`;
- ela fica dentro da região da barra (`accessibilityLabel="Modo {rótulo}"`, `:337`);
- a contagem continua com `aria-live` (`:346`), e a linha do próximo passo, não: ela muda pouco, e o banner já anuncia o pedido do narrador.

**"Avisar que terminei"** ocupa o lugar da ação seguinte que o P03-D cria ao lado do "Salvar" (contrato 2 da consolidação):

- **Quando aparece:** dono, `creating`, criação livre, sem o papel de narrador e sem `ready`. Na criação por pontos, o lugar continua com "Concluir criação" ou "Enviar para aprovação".
- **Hook.** O `useFinishCreation` (`CreationPanel.tsx:86-148`) vira a base de um `useNextStep()`, com `{ kind: 'complete' | 'ready', label, ready, start, busy, waitingSync, copy }`.
  - O caminho do `ready` é o mesmo do concluir: com alterações, abre o resumo, salva, espera a fila confirmar e só então chama a API.
  - Concluir nunca confirma escolhas ainda locais (P03-C), e avisar também não.
- **Confirmação.** O `SummarySheet` (`ModeBar.tsx:363-468`) recebe `finish` com:
  - `label` "Avisar que terminei";
  - `body` "O narrador vê na Mesa que você terminou e conclui a criação. Até lá, você ainda pode editar.";
  - o sufixo de hoje, "As alterações abaixo são salvas antes" (`:431-435`);
  - o botão com `testID="creation-ready-confirm"`.
- **Depois do aviso:**
  - o toast diz "Pronto: o narrador foi avisado.";
  - o botão sai da barra, e a linha passa a "Você avisou. O narrador conclui a criação.";
  - o selo muda (§3.4);
  - a ficha rebusca a cada 30 s enquanto espera (§3.8).
- **A edição continua liberada.** O aviso não trava a ficha: o `writePolicy` de `creating` não muda (ponto 6 da §9).

**O narrador recebe o aviso como já recebe o da revisão** (R-13: "como já recebe o de revisão"):

- **Mesa:** o selo "Avisou que terminou" no cartão (§3.5).
- **Aba Fichas:** um segundo banner, no padrão do de revisão (`CharacterList.tsx:184-227`). Título "1 jogador avisou que terminou" ou "N jogadores avisaram que terminaram". Mensagem "{fichas}: abra a ficha para concluir a criação ou pedir ajuste.". `testID="ready-review"`.
- **Lista de crônicas:** o `pendingReview` (`apps/api/src/chronicles/routes.ts:321-330`) passa a contar também `status = 'creating' and creation ? 'ready'`. O texto "N fichas aguardam revisão" (`app/(app)/index.tsx:81-82`) não muda (pergunta 4).

**A corrida com o pedido de ajuste.** Quando o concluir da barra recebe 409 de revisão ou de versão, o `onError` do `useFinishCreation` (`CreationPanel.tsx:125-133`) passa a usar o `STALE_COMPLETION` ("A ficha mudou desde que você abriu. Confira e conclua de novo."), como o menu do narrador já faz (`StatusMenu.tsx:290-298`). A rebusca do `onSettled` traz o banner do pedido.

**Largura da barra no celular.** Medida estimada, a conferir no AVD (pergunta 1):

| Botões no Editar da criação livre | Largura (`fieldLabel` 16 sp + padding 20 × 2) | Úteis a 360 / 390 / 411 |
|---|---|---|
| "Salvar alterações" + "Avisar que terminei" | ~181 + ~198 + 8 = ~387 dp | 328 / 358 / 379 |

**Com a regra de rótulo do P03-D** (§3.1 dele: o botão de salvar mostra "Salvar", com o nome acessível "Salvar alterações", quando há ação seguinte ao lado), os dois botões somam ~86 + ~198 + 8 = ~292 dp e cabem lado a lado a partir de 360 (328 úteis). A D-01 escreve "Salvar alterações" no Editar, por isso a regra no Editar é ponto para o PO ([onda-3.md](onda-3.md) §4.1 e §6). **Sem ela,** os dois botões não cabem lado a lado em nenhum celular. No `compact`, a barra fica em duas linhas:

1. a contagem e o próximo passo;
2. os botões, alinhados à direita, com `flexWrap`.

Cada botão pode descer para uma linha própria. O P03-D desenha a barra; este pacote só exige que ela não transborde a 360 dp e que a ação seguinte aceite um rótulo de até 19 caracteres. **Plano B,** se a área fixa passar do que o T-27 ganhou: no `compact`, o "Avisar que terminei" vai para um cartão no topo da rolagem, logo abaixo do selo, e a barra fica só com a linha do próximo passo e o "Salvar alterações".

### 3.4 R-12 · Uma regra de estado e um selo

**A regra** fica em `apps/frontend/components/chronicles/characterState.ts`, que hoje é a função de texto do P04-C. Ela é estendida e vira a fonte única da lista, da Mesa, do menu do narrador e da ficha:

```ts
export type CharacterStateId =
  | 'creating' | 'returned' | 'adjust' | 'ready' | 'pending'
  | 'completed' | 'locked' | 'archived' | 'dead'
export interface CharacterState {
  readonly id: CharacterStateId
  readonly label: string
  readonly tone: StateBadgeTone // 'neutral' | 'attention' | 'done'
}
export interface CharacterStateRow {
  readonly status?: string
  readonly kind?: 'pc' | 'npc'
  readonly creationMode?: 'free' | 'points'
  readonly returned?: boolean
  readonly adjust?: boolean
  readonly ready?: boolean
  readonly activatedAt?: string | Date | null
  readonly locked?: boolean
}
export function characterState(
  row: CharacterStateRow,
  options: {
    readonly narrating: boolean
    readonly deadLabel?: string
    // false no gatilho do narrador e no "Mais opções": sem "Concluída em"
    readonly completed?: boolean
  }
): CharacterState | null
```

**Precedência**, da primeira regra que vale:

| # | Condição | Texto | Tom |
|---|---|---|---|
| 1 | `kind === 'npc'` | `null`: o NPC tem o selo de visibilidade do P11 (T-52) | — |
| 2 | `creating` com `adjust` | "Aguardando ajuste" | atenção |
| 3 | `creating` com `returned` | "Devolvida" | atenção |
| 4 | `creating` com `ready` | narrador: "Avisou que terminou"; jogador: "Você avisou que terminou" | narrador: atenção; jogador: neutro |
| 5 | `creating` | "Em criação · por pontos" ou "Em criação · livre" (sem `creationMode`: "Em criação") | neutro |
| 6 | `pending` | "Aguardando aprovação" | atenção para o narrador; neutro para o jogador |
| 7 | `active` travada | "Travada" | neutro |
| 8 | `active` com `activatedAt` e `completed !== false` | "Concluída em dd/mm" | concluído |
| 9 | `archived` / `dead` | "Arquivada" / `deadLabel` ("Fora de jogo" sem template) | neutro |
| — | o resto | `null` | — |

- **A data.** "Concluída em dd/mm" usa o `shortDate` (`apps/frontend/lib/format.ts:5-10`). O `activated_at` é um **instante** (`timestamptz`), e o dia certo é o do fuso de quem lê: o `new Date(...)` com `getDate()` local é o correto aqui.
  - O formatador de **data civil** do P11 (T-16, U-04: `AAAA-MM-DD`, sem passar por `Date`) não serve, e o inverso também não. Num instante, ler só a parte da data pega o dia em UTC.
  - "A mesma formatação, sem fuso, como o T-47" vale para o resultado (`dd/mm`), não para a leitura. É a lição do T-47 (P02 §3.5): o app já formata o instante no fuso de quem vê.
- **O que sai:**
  - o `characterStateText` vira `characterState(...)?.label`, e os testes dele mudam (§4.2);
  - o `stateLabel` de `tableItems.ts:40-57` sai, e os três usos passam pelo `characterState` (§3.5).

**O componente** é o `StateBadge`, novo no `@tms/ui` (`packages/ui/src/StateBadge.tsx`). Ele mora no `@tms/ui`, e não no app, porque:

- o P11 o usa para a visibilidade do NPC na lista e na Mesa (T-52), com a mesma forma;
- o DS já tem a tag de leitura (`components.md`, "Tags / Tag": `ds-tag`, caption, 28) e o `IdentityChip`;
- o `Chip` do `@tms/ui` é interativo (papel `button`/`switch`, `Chip.tsx:30-36`) e não serve para estado.

```ts
export type StateBadgeTone = 'neutral' | 'attention' | 'done'
export interface StateBadgeProps {
  readonly label: string
  readonly tone?: StateBadgeTone // padrão 'neutral'
  // Só na ficha aberta: anuncia a troca (aria-live / accessibilityLiveRegion)
  readonly live?: boolean
  readonly testID?: string
}
```

- **Desenho:** pílula de borda fina (`radius.pill`, `borderWidth.hair`), `caption`, `paddingHorizontal` `space[2]`, sem `numberOfLines`. O texto quebra, nunca é cortado.
- **Cores do tema do app, não do accent da ficha.** Uma lista mistura sistemas e skins, e o estado tem de ler igual em todas:
  - neutro: `borderControl` e `inkMuted`;
  - atenção: `action`, como o `Banner` `warning` (`Banner.tsx:38-39`);
  - concluído: `success`.
- **Nunca só cor:** o texto é o estado. O tom só reforça.
- **Acessibilidade:**
  - **app:** `accessibilityRole="text"`, que vira `staticText` no iOS e `TextView` no Android;
  - **web:** o react-native-web não dá papel a `text` (`propsToAriaRole.js`: `text: null`), e o selo fica como texto no DOM;
  - **`live`:** põe `aria-live="polite"` (web) e `accessibilityLiveRegion="polite"` (Android). No iOS, a troca é anunciada pelo `Banner` (região viva) ou por `AccessibilityInfo.announceForAccessibility`, como a troca de modo (`ModeBar.tsx:125`).
- **`ListItem` ganha `badges?: readonly StateBadgeProps[]`.** Eles ficam numa linha com `flexWrap`, sob o `meta`, e o rótulo de cada um entra no nome acessível da linha, depois do `meta` (`ListItem.tsx:38-40`). A linha continua um alvo só. É prop nova e opcional (§3.9).

### 3.5 R-12 · Onde o selo aparece

**Sob o nome da ficha, no `IdentityBlock`, e não no `subtitle` da `AppBar`.** As larguras do P08 (§3.10) contra as do selo (estimadas: `caption` 13 sp × ~0,52 em, mais padding e borda):

| Selo | Largura | Título na `AppBar` (com "N alterações não salvas" / com "Salvo") | Coluna do nome no `IdentityBlock` |
|---|---|---|---|
| "Devolvida" | ~80 dp | 360: ~64 / ~120 · 390: ~98 / ~150 · 411: ~115 / ~170 | 360: 240 · 390: 270 · 411: 291 |
| "Aguardando ajuste" | ~134 dp | idem | idem |
| "Em criação · livre" / "Concluída em 01/11" | ~140 dp | idem | idem |
| "Aguardando aprovação" | ~154 dp | idem | idem |
| "Em criação · por pontos" | ~174 dp | idem | idem |
| "Você avisou que terminou" | ~181 dp | idem | idem |

- **A coluna do `IdentityBlock`** é a largura da tela − 2 × 16 (gutter) − 72 (`avatarLg`) − 16 (gap), em `IdentityBlock.tsx:68-80`. Todos os selos cabem a 360 dp. Com fonte de 130%, o mais longo (~235 dp) ainda cabe; acima disso, quebra em duas linhas.
- **Na `AppBar`, a 360 com alterações não salvas, nenhum selo cabe.** Com "Salvo", só "Devolvida". Um rótulo curto ("Ajuste", "Aguardando") perderia o sentido. O mesmo selo em dois lugares repetiria o texto no desktop.
- **Por isso o `subtitle` continua sem uso.** A prop fica, porque é aditiva e não custa (pergunta 5). Tirar o rótulo do voltar no `compact` (P08, pergunta 8) daria só +48 dp.

No `IdentityBlock` (`:76-92`), o selo entra logo abaixo do nome grande (`:80-82`) e antes do `IdentityChip` (`:83-89`). Ele vem do `SheetStateBadge`, um componente novo em `sheet/creation/SheetState.tsx`:

- lê o `CreationContext` (`info`, `status`) e o `LifecycleContext` (travada);
- chama o `characterState` com `narrating = roles.has('storyteller')`;
- desenha com `live` e `testID="sheet-state"`.

Ele aparece em qualquer modo, porque o `IdentityBlock` está na rolagem em todos (`SheetView.tsx:279`). O `viewer` (NPC revelado) não tem `CreationContext` e fica sem selo, como deve: o envelope dele não traz `creation` (`routes.ts:509-527`).

**Lista da crônica e aba Fichas** (`CharacterList.tsx`):

- `FullRow` (`:37-52`) ganha `creationMode`, `adjust`, `ready` e `activatedAt`.
- A linha (`:88-111`) mantém "Sua ficha" ou "de {jogador}" no `meta`, e o estado vai para `badges`, pelo `characterState`. O nome acessível passa a "Helena Varga, Tremere · Sua ficha, Aguardando ajuste".
- O NPC (`partial`, `:76`, `:88-89`) fica sem selo de estado: é do P11.
- O banner de "terminei" fica ao lado do de revisão (§3.3).

**Mesa** (`tableItems.ts`, `TableRow.tsx`):

- `TableRowData` (`:15-26`) ganha `kind`, `creationMode`, `returned`, `adjust`, `ready` e `activatedAt`. O `kind` e a `visibility` a API já manda (`chronicles/table.ts:87-88`).
- `TableItem.state` (`:36`) passa de `string | null` a `CharacterState | null`, e o `buildItem` (`:84`) usa o `characterState` com `narrating: true` e o `deadLabel(model)`.
- O `TableRow` troca o `Text` do estado (`:109-113`) pelo `StateBadge`. O nome acessível da linha (`:60-67`) usa o `state.label`. O `meta` ("<dono> · alterada …", `:43`) não muda aqui: o "alterada por" é o T-83 do P09-C.

**Gatilho do narrador e "Mais opções":**

- o `narratorOf` (`SheetScreen.tsx:298-310`) passa a `StatusMenuTarget` o `state` já calculado, com `completed: false`;
- o `StatusMenuButton` (`StatusMenu.tsx:194`) e o `SheetMenu` (`:48-50`) usam esse texto: "Narrador [Aguardando ajuste] ▾" e "Ações do narrador · Aguardando ajuste";
- a ficha ativa continua como hoje, sem "Concluída em" no gatilho.

**API: o que a lista e a Mesa recebem.**

- **`GET /chronicles/:id/characters`** (`routes.ts:343-449`) seleciona também `ch.activated_at`. A linha `full` (`:426-445`) ganha `creationMode`, `adjust`, `ready` e `activatedAt`.
  - `creationMode` só vem em `creating` e `pending`, calculado com `creationInputOf(model, parseCharacterCreation(model, r.creation)).config.mode`. O `model` da linha já está compilado (`:384`), e o `modelFor` usa cache.
  - O `isReturned` (`:76-85`) vira `creationFlags(creation)`, com `{ returned, adjust, ready }`, todos booleanos e sem ler as escolhas.
  - **Nenhum motivo vai para a lista.**
  - A projeção de identidade do NPC (`:414-422`) não ganha campo.
- **`GET /chronicles/:id/table`** (`table.ts:59-101`) seleciona `ch.creation` e `ch.activated_at` e manda os mesmos campos. A rota é só do narrador (`:42-43`).

### 3.6 R-12 · O Histórico registra cada passo do ciclo

O P04-C pôs "Criação concluída" no Histórico, a partir do `chronicle_audit` (`events.ts:112-115`, `:502-547`). Este pacote completa os passos (P04-C §2: "Fica para o P04-D"):

| Ação no registro | `event` no item | Texto no app (`HistorySheet.tsx:45-48`) | `byRole` (no servidor) |
|---|---|---|---|
| `character.creation.complete`, `.approve` | `creation.completed` | "Criação concluída" (já existe) | `completionRole` (`:139-151`) |
| `character.creation.submit` | `creation.submitted` | "Enviada para aprovação" | `owner` |
| `character.creation.return` | `creation.returned` | "Devolvida para correção" | `storyteller` |
| `character.creation.adjust` | `creation.adjust` | "Ajuste pedido" | `storyteller` |
| `character.creation.ready` | `creation.ready` | "Avisou que terminou" | `owner` |

- **`COMPLETION_ACTIONS`** (`:112-115`) vira um mapa `LIFECYCLE_EVENTS` (ação → `event`). A consulta (`:502-536`) filtra pelas chaves dele.
- **`HistoryEntry.event`** (`:124`) passa à união dos cinco. O `byRole` sai de uma função pura, no servidor; o corpo nunca o fornece.
- **O que não muda:**
  - sem `payload` nem `target_user_id` na resposta, e o motivo nunca aparece no Histórico (fica no banner);
  - a paginação continua a do P04-C;
  - o acesso continua só para dono e narrador, e o `viewer` recebe 404.
- **O app antigo das lojas** recebe um `event` que não conhece. O `EVENT_LABELS[item.event]` (`HistorySheet.tsx:67-68`) sai `undefined`, e a linha mostra só a data e o autor (pergunta 8).
- **Não é o extrato da onda-2 §6.6.** Os pontos gastos não entram no Histórico.

### 3.7 Nota do P04-C: a criação livre concluída com a dona no Editar

**Hoje.** O `c7c1423` cobriu o caso sem nada a salvar: com a ficha no Editar da abertura, quando o narrador conclui, a ficha vai ao modo de abertura novo, o Jogo (`SheetScreen.tsx:497-524`). Com alterações não salvas, o Editar fica, e em silêncio. O próximo "Salvar alterações" vira evolução de ficha ativa, e o servidor recusa o que passa pelo narrador. A dona não sabe por quê.

**Correção.**

- No mesmo efeito, quando o estado passa de `creating` a `active` com a ficha num modo de rascunho e alterações não salvas, o `LiveSheet` marca `completedWhileEditing` (estado local, um `useRef` com o `status` anterior). Ele mostra um banner `warning` no topo da rolagem (`testID="completed-while-editing"`):
  - título: "O narrador concluiu a criação";
  - mensagem: "As alterações não salvas agora são evolução: subir um traço passa pelo narrador. Salve ou descarte.".
- O banner some quando o rascunho fica vazio ou a ficha sai do modo de rascunho.
- O Editar e o rascunho continuam, como hoje. O servidor decide o lote.
- O selo passa a "Concluída em dd/mm".

### 3.8 Atualização e cache

- **Polling.** O `awaitsStoryteller` (`sheet/data.ts:57-66`) passa a valer também para `creating` com `ready`, para o dono sem o papel de narrador. É o jogador que espera o narrador concluir ou pedir ajuste: a ficha rebusca a cada 30 s (`PENDING_REFETCH_MS`, `:55`) com a tela em primeiro plano. Mesma rota e mesma AuthZ do abrir a ficha.
  - Enquanto o jogador edita sem ter avisado, não há polling. O pedido de ajuste chega no próximo foco da tela, da janela (`lib/queries/focus.ts`) ou do app.
- **Lista e Mesa** já rebuscam no foco (`CharacterList.tsx:169-174`; `TableView.tsx:145`). O `useRefresh` invalida a ficha, a Mesa e a lista (`lib/queries/creation.ts:12-31`), e as duas mutações novas usam o mesmo.
- **Cache persistido** (`apps/frontend/lib/persist.tsx:62-75`). Só o `GET /characters/:id` e os templates vão para o disco; a lista e a Mesa, não.
  - **Fail secure:** a ficha guardada antes da atualização não tem `adjust` nem `ready`. O `creationInfoOf` os lê como `null`, e nada é inventado: a tela mostra o banner e o selo quando a resposta chega.
  - **A lição do `c7c1423`:** o estado é recalculado a cada resposta, não só na montagem. Teste: a ficha montada do cache com `ready`, e a resposta já `active`.
  - O motivo do ajuste fica no cache da ficha, como o da devolução hoje: cifrado no nativo e no IndexedDB do web até o logout (P02 §5, "cache já visto").

### 3.9 O que muda na API pública (HTTP, `@tms/sheet-core` e `@tms/ui`)

**HTTP:**

| Rota | Mudança | Quem recebe |
|---|---|---|
| `POST /characters/:id/creation/adjust` | **Nova** (§3.1) | Narrador da crônica |
| `POST /characters/:id/creation/ready` | **Nova** (§3.1) | Dono, membro, sem o papel de narrador |
| `GET /characters/:id` | `creation.adjust` (motivo e data) e `creation.ready` (data). O `activatedAt` já vem | Dono e narrador; o `viewer` não recebe `creation` |
| `GET /chronicles/:id/characters` | `creationMode`, `adjust`, `ready` e `activatedAt` na linha `full`, sem motivo | Narrador (todas); membro e ex-membro (as próprias) |
| `GET /chronicles/:id/table` | Os mesmos quatro campos | Narrador |
| `GET /characters/:id/history` | Itens com `event` `creation.submitted`, `creation.returned`, `creation.adjust` e `creation.ready` | Dono e narrador |
| `GET /chronicles` | `pendingReview` conta também as fichas com `ready` | Narrador |
| `POST /characters/:id/creation/complete`, `/return`, `PATCH /characters/:id/creation` | Limpam ou mantêm os marcadores (§3.1); o contrato de entrada não muda | — |

**`@tms/sheet-core`:** `CharacterCreation` ganha `adjust?` e `ready?`, e `CreationReady` é novo. A mudança é aditiva. A API e as migrations leem o `dist`, que é reconstruído depois do merge.

**`@tms/ui`** (nenhuma prop sai):

| Componente | Mudança | Compatibilidade |
|---|---|---|
| `StateBadge` (novo) | `label`, `tone`, `live`, `testID` | Exportado no `index.ts` |
| `ListItem` | `badges?: readonly StateBadgeProps[]`, sob o `meta`, no nome acessível | Os usos atuais não passam a prop |
| `AppBar` | Nenhuma. O `subtitle` continua sem uso (§3.5) | — |

A lição S-01 da onda 1 vale: o `src` do `@tms/ui` compila no app com o JSX do React, e defeito de estilo só aparece no nativo. O `StateBadge` e o `ListItem` passam pelo aparelho (§11) antes do merge. O commit atualiza o `design/design-system/components.md`: Tags (o `StateBadge` como tag de leitura), ListItem, IdentityBlock (o selo sob o nome) e ModeBar (a linha do próximo passo).

## 4. Testes

### 4.1 Um teste de regressão por item (falha no `617264d`, passa depois)

| Item | O que o teste prova | Arquivo | Tipo |
|---|---|---|---|
| R-14 | `parseCharacterCreation` lê `adjust` e `ready` e descarta forma errada (motivo não-texto, `at` ausente) | `packages/sheet-core/src/__tests__/creation.test.ts` | Bun |
| R-14 | `POST …/creation/adjust`, nos cenários abaixo | `apps/api/src/__tests__/creation.test.ts`, bloco novo "pedir ajuste" | API, PGLite (`useTestDb()`) |
| | • o narrador pede ajuste numa ficha em criação livre e numa por pontos com a aprovação desligada e ligada; o `GET /characters/:id` do dono e do narrador traz o `adjust.reason`; a `creation_revision` sobe | | |
| | • o motivo some do `returned` anterior e do `ready` | | |
| | • 403 para o dono; 404 para o outro jogador, o ex-membro e o narrador de outra crônica; 404 para o `viewer` do NPC | | |
| | • 409 em `pending` e `active`; 409 no NPC e na ficha do próprio narrador | | |
| | • 422 para motivo vazio, só espaços, com 501 caracteres, com `<` e com caractere de controle, sem ecoar o texto | | |
| | • a mesma chave devolve o resultado gravado; a mesma chave com outro motivo dá 409 `COMMAND_KEY_REUSED` | | |
| | • o registro tem `character.creation.adjust` com `payload` `{}` | | |
| R-14 | O `PATCH …/creation` do narrador (ajustar o bônus) não apaga o `adjust` nem o `ready`. Concluir apaga os dois. Devolver não os traz de volta | o mesmo arquivo | API, PGLite |
| R-14 | Corrida: dois clientes, pedir ajuste e o dono concluir (por pontos, sem aprovação). Nunca termina `active` com `adjust`. Quem chega depois recebe 409 (`CREATION_REVISION_CONFLICT` ou "criação já concluída") | `apps/api/src/__tests__/creation.pg.test.ts` | Postgres real (`FOR UPDATE`) |
| R-14 | Matriz: `POST /characters/:id/creation/adjust` (`storyteller: 200, owner: 403, player: 404, ...denied`) | `apps/api/src/test/authz-matrix.ts` (linhas novas depois de `:213`); `authz.test.ts` | API, PGLite, três sistemas |
| R-14 | O menu do narrador, nos cenários abaixo | `apps/frontend/sheet/__tests__/storyteller.test.tsx` | Jest + RNTL |
| | • "Pedir ajuste" aparece em `creating` (PC de outra pessoa) e não aparece no NPC, na ficha própria, em `pending` e em `active` | | |
| | • a folha tem o campo, e o botão fica desabilitado com o texto vazio | | |
| | • o `submitEditing` com `nativeEvent.text` envia o texto do evento | | |
| | • 422 mostra a frase na folha, e o texto fica; o sucesso dá o toast | | |
| R-14 | O dono vê "O narrador pediu um ajuste" com o motivo em Editar e em Jogo; o narrador vê "Você pediu um ajuste"; só um banner por vez | `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | Jest + RNTL |
| R-13 | `POST …/creation/ready` | `creation.test.ts`, bloco "avisar que terminei" | API, PGLite |
| | • o dono avisa na criação livre; 409 de novo (`CREATION_ALREADY_READY`) | | |
| | • 409 na criação por pontos (`CREATION_NOT_FREE`) e fora de `creating` | | |
| | • 403 para o narrador (inclusive na ficha dele); 404 para o outro jogador e para o ex-membro | | |
| | • limpa `adjust` e `returned`; o registro tem `payload` `{}` | | |
| R-13 | Corrida: o dono avisa e o narrador conclui ao mesmo tempo. Termina `active` sem `ready`, ou o segundo recebe 409 | `creation.pg.test.ts` | Postgres real |
| R-13 | Matriz: `POST /characters/:id/creation/ready` (`owner: 200, storyteller: 403, player: 404, ...denied`) | `authz-matrix.ts`; `authz.test.ts` | API, PGLite |
| R-13 | `GET /chronicles`: o `pendingReview` do narrador conta `pending` e `creating` com `ready`; o do jogador é 0 | `apps/api/src/__tests__/chronicles.test.ts` | API, PGLite |
| R-13 | `nextStepCopy`: cada combinação da tabela da §3.3, e nenhuma frase passa de 48 caracteres | `apps/frontend/sheet/creation/__tests__/nextStep.test.ts` (novo) | Jest |
| R-13 | A barra, nos cenários abaixo | `CreationScreen.test.tsx` | Jest + RNTL |
| | • a dona na criação livre (Editar) vê a linha "Quando terminar, avise: o narrador conclui." e "Avisar que terminei" | | |
| | • com 1 alteração, o toque abre o resumo com "As alterações abaixo são salvas antes"; confirmar salva, espera a fila e só então chama o `ready` (mock da API, ordem das chamadas) | | |
| | • depois, o botão sai e a linha muda | | |
| | • por pontos: a linha de "conclui" ou de "envie" | | |
| R-13 | `awaitsStoryteller`: verdadeiro em `creating` com `ready` para o dono; falso para o narrador e sem `ready` | `apps/frontend/sheet/__tests__/LiveSheet.test.tsx` | Jest |
| R-13 | A aba Fichas do narrador mostra o banner "1 jogador avisou que terminou" com o nome da ficha | `apps/frontend/app/__tests__/new-character.test.tsx`, bloco "Fichas na crônica" | Jest + RNTL |
| R-12 | `characterState`: tabela com todos os casos da §3.4 (os dois papéis, NPC, `deadLabel`, `completed: false` e fuso `America/Sao_Paulo` no "Concluída em") | `apps/frontend/components/chronicles/__tests__/characterState.test.ts` (novo) | Jest |
| R-12 | A lista da crônica e a Mesa, nos cenários abaixo | `creation.test.ts`; `apps/api/src/__tests__/table.test.ts` | API, PGLite |
| | • `creationMode` (`free`/`points`), `adjust`, `ready` e `activatedAt` certos na lista do dono e na do narrador | | |
| | • o JSON da lista e o da Mesa não contêm o texto do motivo | | |
| | • a lista do outro jogador não tem a linha; a projeção do NPC revelado não ganha campo | | |
| R-12 | O Histórico, nos cenários abaixo | `apps/api/src/__tests__/events.test.ts` | API, PGLite |
| | • enviar, devolver, pedir ajuste e avisar viram itens com o `event` e o `byRole` certos, sem `payload` e sem o motivo | | |
| | • a paginação com `limit=2` não repete nem perde item | | |
| | • o `viewer` continua com 404 | | |
| R-12 | A linha da lista com o selo: nome acessível "…, Sua ficha, Em criação · por pontos"; "…, de dona, Aguardando aprovação" para o narrador; "Concluída em 01/11" | `new-character.test.tsx` | Jest + RNTL |
| R-12 | A Mesa: `pending` com "Aguardando aprovação"; `ready` com "Avisou que terminou"; "Em criação · livre" | `apps/frontend/app/__tests__/table.test.tsx` | Jest + RNTL |
| R-12 | O selo sob o nome, nos cenários abaixo | `apps/frontend/sheet/__tests__/sheet.layout.test.tsx` | Jest + RNTL |
| | • `getByTestId('sheet-state')` em Jogo, Editar, Criação e Leitura, com `accessibilityLiveRegion` | | |
| | • o `viewer` sem selo | | |
| | • o narrador: "Ações do narrador · Aguardando ajuste" no "Mais opções" a 390 | | |
| | • `Dimensions` 360: o selo dentro da largura da coluna | | |
| R-12 | O `StateBadge` (texto, tom, `live`) e o `ListItem` com `badges` (nome acessível e ordem) | `packages/ui/src/components.test.tsx`; `a11y.test.tsx` | Jest + RNTL |
| R-12 | O Histórico no app mostra "Ajuste pedido", "Avisou que terminou", "Enviada para aprovação" e "Devolvida para correção", sem "Desfazer" | `storyteller.test.tsx` (mock `historyGet`) | Jest + RNTL |
| Nota do P04-C | Na criação livre, a dona está no Editar com 2 alterações e a resposta passa a `active`: aparece o banner `completed-while-editing`, o Editar e as 2 alterações ficam, e o selo muda. Sem alterações, vai a Jogo como no `c7c1423`. Montada do cache com `ready` e a resposta `active`: nada fica preso | `apps/frontend/sheet/__tests__/SheetScreen.test.tsx` | Jest + RNTL |
| Todos | O E2E da §4.3 | `e2e/tests/creation-state.spec.ts` (novo) | Playwright |

### 4.2 Testes existentes que mudam junto

| Arquivo | O quê | Por quê |
|---|---|---|
| `apps/frontend/app/__tests__/new-character.test.tsx` | `:504`, `:546`, `:551`, `:587`, `:601`: os nomes acessíveis passam de "Sua ficha · Devolvida" a "Sua ficha, Devolvida" (o selo vira `badge`), e "Aguarda aprovação"/"Aguarda sua revisão" passam a "Aguardando aprovação". A tabela do `characterStateText` (`:525-533`) vai para o `characterState.test.ts` | §3.4 e §3.5 |
| `apps/frontend/app/__tests__/table-alerts.test.tsx` | `:167`: "Em criação" passa a "Em criação · livre" ou "· por pontos", conforme o fixture | §3.4 |
| `apps/frontend/sheet/__tests__/policy.test.tsx` | `:467`: "Ações do narrador · Em criação" ganha o modo. `:482`: "Narrador, Travada" fica | §3.5 |
| `apps/frontend/sheet/__tests__/sheet.layout.test.tsx` | `:309`: o mesmo do `policy` | §3.5 |
| `apps/frontend/sheet/__tests__/storyteller.test.tsx` | Os casos do menu ganham o item "Pedir ajuste" na contagem de ações em `creating` | §3.2 |
| `apps/api/src/__tests__/creation.test.ts` | A lista do P04-C (`returned`) passa a conferir também os campos novos | §3.5 |
| `e2e/tests/layout.spec.ts` | `:143`: `'Ações do narrador · Em criação'` (exato) passa a `'Ações do narrador · Em criação · por pontos'` | §3.5. O P04-D ajusta, porque entra depois do P03-D (§8.4) |
| `e2e/tests/lifecycle.spec.ts` | `:226`: `/Sua ficha · Devolvida$/` passa a `/Sua ficha, Devolvida$/`. `:297`: o mesmo do `layout.spec.ts:143` | §3.5 |

Ficam verdes sem mudança: os specs que o P03-D ajusta para "Salvar alterações" (`conflict`, `draft`, `evolve`, `journey`, `journey-mage`, `journey-werewolf`, `journey-storyteller`) não leem o estado da lista. O `journey-backstage.spec.ts` confere o `viewer` sem "Mais opções", e o selo não aparece para o `viewer`.

### 4.3 E2E novo: `e2e/tests/creation-state.spec.ts` (Chromium e WebKit)

- **Preparação:**
  - viewport `390 × 844`;
  - contas criadas por `signUp` (fictícias), em dois contextos: narrador e jogadora;
  - crônica por `apiAs`, com o padrão do `lifecycle.spec.ts:15-40`;
  - uma crônica livre (`freeCreation`) e uma por pontos, com a aprovação desligada e ligada.
- **Escrito com os rótulos do P03-D:** o jogador salva por `getByRole('button', { name: 'Salvar alterações', exact: true })`.

| Cenário | Seletores e asserções |
|---|---|
| R-12, lista e selo | Jogadora na crônica por pontos: `getByRole('button', { name: /Sua ficha, Em criação · por pontos$/ })`. Abre: `getByTestId('sheet-state')` com `toHaveText('Em criação · por pontos')` e `toHaveAttribute('aria-live', 'polite')` (atributo no DOM, que o Jest não vê). `getByRole('tablist', { name: 'Partes da ficha' })` visível abaixo do selo. Toca `getByRole('tab', { name: 'Orçamento' })`: o selo continua na rolagem |
| R-12, concluída | `completeCreation` pela API. Volta à crônica: `/Sua ficha, Concluída em \d{2}\/\d{2}$/`, com a data calculada no navegador (`page.evaluate`) |
| R-12, Mesa | Narrador, aprovação ligada, a jogadora envia pela API: `getByRole('tab', { name: 'Mesa' })` → `getByTestId('table-row-<id>')` com `toContainText('Aguardando aprovação')` |
| R-13 | Jogadora na crônica livre (Editar): `getByTestId('next-step')` com "Quando terminar, avise: o narrador conclui." → `getByRole('button', { name: 'Avisar que terminei', exact: true })` (`toBeEnabled()`, sem `disabled` no DOM, lição do `e8cfaf8`) → `getByTestId('creation-ready-confirm')` → toast "Pronto: o narrador foi avisado." → `sheet-state` com "Você avisou que terminou". Narrador: `getByTestId('ready-review')` na aba Fichas e "Avisou que terminou" no cartão da Mesa |
| R-14 | Narrador a 390: `getByRole('button', { name: 'Mais opções' })` → `getByRole('button', { name: /^Ações do narrador/ })` → `getByTestId('status-adjust')` → `getByLabel('O que precisa ser ajustado')` (`fill('Refaça os Antecedentes')`) → `getByTestId('status-adjust-confirm')`. `page.keyboard.press('Escape')` com a folha aberta fecha e devolve o foco a `Mais opções` (`toBeFocused()`). Jogadora: `page.reload()` → `getByTestId('creation-adjust')` contém o motivo, em Editar e depois de `getByRole('radio', { name: 'Jogo', exact: true })`; a lista diz "Aguardando ajuste" |
| R-14, privacidade | `rawAs` da segunda jogadora: `GET /chronicles/:id/characters` sem a linha; a resposta da dona e a da Mesa sem a string do motivo; `GET /characters/:id` da segunda jogadora com 404 |
| R-12, Histórico | A dona avisa de novo, o narrador conclui pelo menu (com a confirmação do P04-C) e abre "Mais opções" → `getByRole('button', { name: 'Histórico', exact: true })`: `getByText('Ajuste pedido')`, `getByText('Avisou que terminou')`, `getByText('Criação concluída')`; `getByText('Refaça os Antecedentes')` dentro da folha com `toHaveCount(0)` |
| Desktop | Um caso a 1280 × 800: "Pedir ajuste" pelo botão largo `getByTestId('status-menu')`, com a folha central (`boundingBox().width ≤ 560`) |

O spec roda só na integração da onda (portas fixas, um por vez), como na onda 2.

### 4.4 Suítes do "PR local" e cobertura

```bash
npx pnpm -C packages/sheet-core build        # o dist que a API lê
npx pnpm turbo run typecheck lint --filter=@tms/sheet-core --filter=@tms/api --filter=@tms/ui --filter=frontend --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=@tms/sheet-core --filter=@tms/api --filter=@tms/ui --filter=frontend
cd apps/api && PG_TEST_URL=postgres://postgres:postgres@localhost:5432/tms_p04d_test bun test .pg.test
```

**As metas são por arquivo**, como na lição da onda 1:

- API: 85% de linhas e funções por arquivo (`apps/api/bunfig.toml`). O `creation.ts` ganha duas rotas, e cada ramo de recusa tem caso na §4.1.
- `@tms/ui`: 80% em tudo (`packages/ui/jest.config.js:8-10`). O `StateBadge` e os `badges` do `ListItem` nascem com teste.
- App: 80/80/70/80 em `./sheet/` e 70/70/60/70 no global (`apps/frontend/jest.config.js:35-38`). O `nextStep.ts`, o `SheetState.tsx` e o `characterState.ts` nascem com teste próprio.

O banco `_test` dos `*.pg.test` é do worktree (`tms_p04d_test`), porque cada arquivo apaga o schema. O E2E inteiro (Chromium e WebKit) roda na integração.

## 5. Segurança

O pacote cria estado e duas ações na API, com AuthZ do narrador e do dono. **Passa por `/security-review` antes do merge** (matriz, "Como executar", passo 4), além do `/code-review`. Foco:

- `apps/api/src/sheets/creation.ts`: as rotas novas e as que limpam marcadores;
- `routes.ts` e `chronicles/table.ts`: o que a lista e a Mesa mandam;
- `events.ts`: o Histórico;
- `chronicles/routes.ts`: a contagem.

| O que pode dar errado | Como o desenho evita |
|---|---|
| Transição inválida (pedir ajuste em ficha ativa, avisar na criação por pontos, avisar duas vezes) | O estado e o modo são lidos com a ficha travada (`lockCharacter`, `FOR UPDATE`), dentro da transação. O que não está na tabela da §3.1 é recusado com 409 (fail secure). O cliente nunca manda estado |
| Um jogador pede ajuste, ou o narrador avisa no lugar do jogador | O papel vem do `characterAccess` no servidor, contra a crônica da ficha. O ajuste exige `storyteller`; o aviso exige `owner` sem `storyteller` e passa pelo `writePolicy` do dono (o ex-membro cai). Linhas novas na matriz de AuthZ, nos três sistemas |
| IDOR pelo id da ficha (outro jogador, outra crônica, NPC oculto) | O `access()` dá 404 para quem não alcança a ficha e para o `viewer` (`creation.ts:281-285`), antes de ler o corpo. A ficha de outra crônica não dá o papel de narrador. NPC e ficha própria: 409 no ajuste |
| O motivo chega a outro jogador | O motivo só vai no `GET /characters/:id`, que só dono e narrador alcançam. A lista e a Mesa levam só booleanos, a projeção do NPC não ganha campo e o `viewer` não recebe `creation`. Testes conferem a ausência do texto nas respostas da lista, da Mesa, do Histórico e do registro, e o 404 do outro jogador |
| Motivo grande, malformado ou com marcação | `trim`, de 1 a 500 caracteres (`RETURN_REASON_MAX`), e `isSafeText`: sem `<`/`>`, sem controle e sem bidi (`packages/sheet-core/src/validate/safe-text.ts:8-20`). O corpo tem teto no schema (`t.String`, `maxLength` 550). O app desenha com `Text` do RN, sem HTML. O 422 não ecoa o texto |
| Autoria forjada no Histórico | O `actor_id` é gravado pelo servidor com o usuário autenticado. O `byRole` é calculado no servidor pela ação. Nada vem do corpo |
| PII ou motivo no registro e nos logs | `payload` `{}` nas duas ações. Nenhum log novo. O registro de Bastidores não manda `payload` (`backstage.ts:927-937`). Contas e textos de teste fictícios |
| Repetição ou corrida (pedir ajuste × concluir × avisar) | Chave por intenção (`once`) e a `creation_revision`: concluir por cima de um pedido não visto dá 409. Há `*.pg.test` com Postgres real |
| O selo vira controle de acesso | É UX. A política e a conta continuam no servidor; o aviso não trava nem libera escrita |
| O polling vira carga | Só o dono, só em `pending` ou em `creating` com `ready`, de 30 em 30 s, em primeiro plano. Mesma rota e mesma AuthZ |
| Spam de pedido ou de aviso | O aviso repetido dá 409 sem gravar. O pedido é só do narrador da própria crônica e substitui o anterior. Sem rate limit novo: as rotas são autenticadas e não servem para força bruta, como as outras da criação |

**Checklist da organização:**

- **Validação no servidor:** estado, papel, modo, conta e conflito ficam no servidor. O cliente só desabilita e confirma.
- **Fail secure:**
  - sem `creation` na resposta, nenhum selo e nenhum banner inventado;
  - um marcador malformado é descartado pelo `parse`;
  - o 409 e o 403 vêm antes de qualquer escrita.
- **Logs sem PII, senha ou token:** nada novo.
- **Erros sem stack trace:** `ApiError` com `code` e mensagem curta (`on-error.ts`).
- **Dependências:** nenhuma nova.
- **Cache:** o motivo fica no cache persistido da ficha, como o da devolução (cifrado no nativo; IndexedDB no web até o logout).

## 6. Como generaliza além do WoD

- **Estados (R-12).** São do ciclo do core e da API (`creating`, `pending`, `active` e os marcadores), iguais em qualquer template. É genérico:
  - uma ficha de D&D 5e com point-buy mostra "Em criação · por pontos";
  - uma de Call of Cthulhu sem `creation` no template mostra "Em criação · livre";
  - uma de Fate ou PbtA, também.

  O único texto que vem do template é o rótulo de `dead` (`deadLabel`).
- **Selo.** O `StateBadge` usa as cores do tema do app, não o accent nem a skin da ficha. Uma lista que mistura Vampiro, D&D e CoC, cada linha com a própria skin, mostra o estado igual em todas. É de skin neutra, e o mesmo componente serve à visibilidade do NPC (P11).
- **Próximo passo (R-13).** Depende só do modo da crônica (livre ou por pontos), da aprovação e do papel. São configuração da crônica, não do sistema. Genérico.
- **Pedir ajuste (R-14).** Comando do ciclo, sem campo de ficha. Genérico.
- **Histórico.** Os itens são do registro da crônica, sem conteúdo de ficha. Genérico.

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado.** Arquivos e linhas conferidos no `617264d` (seção 3). As decisões D-02, D-03 e D-04 aplicadas, com o que não se aplica como está escrito apontado na §2 e na §9.
2. **Typecheck, lint e testes** de `@tms/sheet-core` (com o `dist` reconstruído), `@tms/api` (com os `*.pg.test`), `@tms/ui` e do frontend (§4.4).
3. **Um teste de regressão por item** (§4.1), falhando no `617264d`, e o `test:coverage` verde.
4. **`/code-review` e `/security-review`** no diff do pacote. Os achados vão no resumo.
5. **Os cenários das personas, repetidos sem o defeito.** Com a API local e o seed do roteiro (só contas fictícias; §11):

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | R-12 | I-A, IA-04 (`iniciante-app.md`), iOS: fechar o app → reabrir → crônica → ficha não concluída | Lista com "Sua ficha" e o selo "Em criação · por pontos"; a ficha abre com o mesmo selo sob o nome |
   | R-12 | I-W, IW-08 e IW-13 (`iniciante-web.md`), web 390: concluir (aprovação desligada) → voltar à crônica → Histórico | "Concluída em dd/mm" na lista e sob o nome; "Criação concluída" no Histórico |
   | R-12 | E-A, EA-13 (`experiente-app.md`), Android: criar a ficha e voltar à crônica | O selo do estado no cartão, não só "Ventrue · Sua ficha" |
   | R-12 | N-W, NW-27 e NW-28 (`narrador-web.md`), web 390 e 1280: abrir a ficha livre e a por pontos em Leitura | "Em criação · livre" ou "Em criação · por pontos" sob o nome; "Ações do narrador · …" com o estado no menu a 390 |
   | R-12 | PO-W, POW-11 (`po-web.md`), web 1280: ficha `pending` → Mesa | "Aguardando aprovação" no cartão |
   | R-13 | PO-W, POW-08, e PO-A, POA-10 (`po-app.md`), criação livre, web 390 e iOS: montar a ficha e procurar como entregar | "Quando terminar, avise: o narrador conclui." e "Avisar que terminei"; depois, "Você avisou que terminou" |
   | R-13 | E-W, EW-06 (`experiente-web.md`), web 390, por pontos: distribuir os básicos | "Você conclui quando a conta fechar." ao lado de "Salvar" e "Concluir criação" (P03-D) |
   | R-13 | I-A, IA-13, iOS, por pontos sem aprovação: concluir | A confirmação diz o que muda; a ficha e a lista dizem "Concluída em dd/mm" |
   | R-13 | Narrador (N-W) depois do aviso: Mesa e aba Fichas | "Avisou que terminou" no cartão; banner "1 jogador avisou que terminou"; "1 ficha aguarda revisão" na lista de crônicas |
   | R-14 | N-W, NW-24, web 390 e 1280: crônica com a aprovação desligada → ficha em criação → Ações do narrador | "Pedir ajuste" com motivo; o jogador vê "O narrador pediu um ajuste" e o motivo; a lista diz "Aguardando ajuste" |
   | R-14 | N-A, NA-18 (`narrador-app.md`), iOS: Vampiro v4 → ficha do jogador → ⋯ → Ações do narrador | "Pedir ajuste" disponível, com o teclado acima do campo; enviado, o selo muda |
   | Nota do P04-C | Jogadora no Editar da ficha livre com alterações; o narrador conclui | Banner "O narrador concluiu a criação", rascunho mantido, selo "Concluída em dd/mm" |

6. **Conferência no aparelho.** O roteiro completo, com preparação, plataformas e tabela por item, está na **§11**. O `StateBadge` e o `ListItem` mudam no `@tms/ui`, e a lição S-01 obriga a conferir no nativo antes do merge.
7. **Resumo para a seção do pacote no PR da onda:**
   - o que mudou;
   - como foi testado;
   - os achados das duas revisões;
   - a API nova (§3.9);
   - os pontos para o PO (§9) que seguem abertos.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

| # | Commit | Itens | Esforço |
|---|---|---|---|
| 1 | `feat(core): ajuste pedido e aviso de "terminei" nos metadados da criação` (`CharacterCreation`, `parseCharacterCreation`, testes) | R-13, R-14 | P |
| 2 | `feat(api): pedir ajuste e avisar que terminei, com AuthZ e registro` (duas rotas, limpeza em concluir, devolver e salvar, `audit.ts`, matriz, `creation.test`, `creation.pg.test`) | R-13, R-14 | M |
| 3 | `feat(api): estado da ficha na lista, na Mesa, no Histórico e na contagem` (`creationFlags`, `creationMode`, `activatedAt`, `LIFECYCLE_EVENTS`, `pendingReview`) | R-12, R-13 | M |
| 4 | `feat(ui): StateBadge e selos no ListItem` (com `components.md`) | R-12 | P |
| 5 | `feat(app): uma regra de estado na lista, na aba Fichas, na Mesa e no menu do narrador` (`characterState`, `CharacterList`, `tableItems`, `TableRow`, `StatusMenu`, `SheetMenu`, banner "terminei") | R-12, R-13 | M |
| 6 | `feat(app): selo de estado sob o nome da ficha` (`SheetState.tsx`, `IdentityBlock`, `CreationInfo`) | R-12 | P |
| 7 | `feat(app): pedir ajuste com motivo no menu do narrador` (`useAdjustCreation`, folha, banner do ajuste) | R-14 | M |
| 8 | `feat(app): próximo passo na barra e "Avisar que terminei"` (`nextStep.ts`, `useNextStep`, `useReadyCreation`, resumo, polling em `ready`, `STALE_COMPLETION` na barra) | R-13 | M |
| 9 | `feat(app): passos do ciclo no Histórico` (`HistorySheet`) | R-12 | P |
| 10 | `fix(app): a ficha concluída pelo narrador avisa quem está no Editar` (nota do P04-C) | — | P |
| 11 | `test(e2e): estado e próximo passo a 390 px` (`creation-state.spec.ts`; `layout.spec.ts:143`, `lifecycle.spec.ts:226`, `:297`) | R-12, R-13, R-14 | M |
| 12 | `docs: estados da criação, pedir ajuste e "terminei"` (`doc/plano-v4.md` §3.4: as duas linhas novas na tabela de operações e os marcadores) | — | P |
| ~~13~~ | Saiu na consolidação: os dados deste roteiro entram na `--fichas-criacao` do P03-D (commit 7, [onda-3.md](onda-3.md) §4.9) | — | — |

**Por que esta ordem:**

- O core (1) vem antes da API, que lê o `dist`.
- A API (2 e 3) vem antes do app e é o foco do `/security-review`.
- O `@tms/ui` (4) vem antes dos usos (5 e 6).
- A regra de estado (5) vem antes do selo da ficha (6) e do menu (7), que a usam.
- A barra (8) fica por último no código porque é o trecho que o P03-D muda (§8.4): o rebase sobre ele fica num commit só.
- A nota do P04-C (10) é independente e sai sozinha.
- O E2E (11) é escrito aqui e rodado na integração.

### 8.2 Esforço

**G**, de 8 a 10 dias, em 12 commits (5 P, 6 M e o de docs). O opcional do seed (13) saiu na consolidação: a extensão é uma só, no commit 7 do P03-D ([onda-3.md](onda-3.md) §4.9). A matriz soma 3 M. A diferença vem do que o código mostrou:

- a R-14 e a R-13 são duas rotas novas com AuthZ, idempotência, auditoria, linhas na matriz de AuthZ dos três sistemas e corrida em Postgres real;
- o estado precisa de campos novos na lista e na Mesa (a API mandava só `status` e `returned`) e no Histórico;
- o selo é componente novo no `@tms/ui`, com conferência nativa obrigatória (S-01);
- a barra depende do P03-D e pede medida no aparelho a 360 dp;
- o pacote passa pelo `/security-review`.

**Se a onda precisar cortar,** o commit 9 (passos no Histórico, além da conclusão que já existe) e o 10 (nota do P04-C) saem sozinhos sem quebrar os outros. Sem eles, o pacote fica perto de M.

### 8.3 Riscos

- **A área fixa da barra no celular.** Dois botões ("Salvar alterações" e "Avisar que terminei") não cabem lado a lado nem a 411 dp (§3.3). Com a linha do próximo passo, a barra cresce. O T-27 (P08) tinha reduzido a área fixa. O plano B tira o botão para o topo da rolagem (pergunta 1).
- **O rebase sobre o P03-D.** A barra e o `useFinishCreation` mudam nos dois. O P04-D entra depois e reaproveita o lugar da ação seguinte.
- **A revisão sobe no ajuste.** O jogador que grava prioridade ou conclui com a revisão velha recebe 409. É o comportamento de hoje quando o narrador ajusta o orçamento; a mensagem e a rebusca já existem.
- **Os textos mudam na lista, no menu e na Mesa.** Mudam fixtures do Jest e três seletores E2E (§4.2).
- **O `@tms/sheet-core` muda.** Até o `dist` ser reconstruído, a API não vê os campos novos.
- **O app antigo das lojas** mostra os passos novos do Histórico sem texto (pergunta 8). Os campos novos da lista e da Mesa são ignorados por ele.
- **"Concluída em dd/mm" em toda ficha ativa da Mesa.** Acrescenta uma linha a cada cartão, que o T-48 (P09-C) quer compactar (ponto 5 da §9).

### 8.4 Conflitos com os pacotes da onda

A ordem provisória da consolidação é **P03-D → P04-D → P11 → P09-C**, e este plano a confirma:

- a barra do P03-D é o lugar do "Avisar que terminei";
- o P04-D cria o `StateBadge`, que o P11 consome, e as duas ações de auditoria que o P11 traduz;
- o P09-C reorganiza o cartão da Mesa por cima dos selos dos dois.

**Se o P03-D atrasar,** o P04-D entra antes, com o "Avisar que terminei" ao lado do "Concluir" atual do Editar e a linha do próximo passo na `EvolveBar`. O P03-D faria o rebase da barra, e os 9 specs E2E ficariam com ele.

| Arquivo | Pacotes | Onde cada um mexe | Como resolver |
|---|---|---|---|
| `apps/frontend/sheet/evolve/ModeBar.tsx` | P03-D, P04-D, P09-C | P03-D: separa "Salvar" da ação seguinte; "Salvar alterações" no Editar (`:206-233`, `:312-358`); o "Salvar e sair". P04-D: a linha `next-step` e o `useNextStep` no lugar da ação seguinte; o `finish` do `SummarySheet` com o "Avisar que terminei" (`:235-251`). P09-C (T-33): o que o narrador vê na Criação (`useModeBar`, `:75-132`) | **Alto** com o P03-D. Ele entra antes e define o lugar; o P04-D faz rebase. O P09-C não muda rótulos |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | P03-D (provável), P04-D | P03-D: o `useFinishCreation` se a ação seguinte mudar de forma. P04-D: o `useFinishCreation` vira base do `useNextStep` (`:86-148`) e passa a usar o `STALE_COMPLETION` (`:125-133`) | Médio. P03-D antes |
| `apps/frontend/components/chronicles/CharacterList.tsx` | P04-D, P11 | P04-D: `FullRow` (`:37-52`), selo em `badges` (`:88-111`), banner "terminei" (`:184-227`). P11 (T-52): o NPC (`partial`, `:76`, `:88-89`) sem "Sua ficha" e com o selo de visibilidade, no mesmo `badges` | Médio. P04-D antes. O `characterState` devolve `null` para NPC, e o P11 acrescenta o selo dele no mesmo array |
| `apps/frontend/components/chronicles/tableItems.ts`, `TableRow.tsx` | P04-D, P11, P09-C | P04-D: `TableRowData` (`:15-26`), `state` como `CharacterState` (`:36`, `:84`), `StateBadge` (`TableRow.tsx:107-113`). P11 (T-52): a seção de NPCs e o selo de visibilidade. P09-C: o cartão compacto (T-48, `TableRow.tsx:98-145`) e o "alterada por" (T-83, `:43`) | **Alto** para o P09-C, que entra por último e põe os dois selos no layout novo |
| `apps/frontend/sheet/storyteller/StatusMenu.tsx`, `apps/frontend/sheet/SheetMenu.tsx` | P04-D, P09-C (provável) | P04-D: a ação `adjust`, a folha com o campo e o `state` no `StatusMenuTarget`. P09-C (T-33): "Editar como narrador" pode passar pelo menu | Médio. As ações novas ficam na lista do `statusActions` |
| `apps/frontend/sheet/SheetScreen.tsx` | P04-D, P11, P09-C | P04-D: `narratorOf` (`:298-310`) e o efeito de transição (`:497-524`, nota do P04-C). P11: o caso `viewer` (`:161-179`, T-15), o seletor de visibilidade (T-46) e o "‹" (T-81). P09-C: T-33 | Médio. Trechos diferentes |
| `apps/frontend/sheet/IdentityBlock.tsx` | P04-D | O selo sob o nome (`:76-92`) | — |
| `apps/frontend/sheet/SheetView.tsx` | P04-D | O banner `completed-while-editing` ao lado do `ReturnedBanner` (`:265-268`) | Baixo |
| `apps/api/src/audit.ts` | P04-D, P11 | P04-D: duas ações novas na união (`:9-39`). P11 (T-63): frases com tipo exaustivo sobre a união | Baixo. P04-D antes; o P11 cobre as duas frases da §3.1 |
| `apps/api/src/sheets/routes.ts` | P04-D, P11 (provável) | P04-D: a lista (`:343-449`) e o `isReturned` (`:76-85`). P11 (T-15): a projeção do `viewer` (`:509-527`), se mudar | Baixo |
| `apps/frontend/lib/format.ts` | P04-D (só usa), P11 | P04-D usa o `shortDate` (instante). P11 cria o formatador de data civil (T-16, U-04) | Nenhum. As duas funções são distintas (§3.4) |
| `packages/ui/src/index.ts`, `ListItem.tsx` | P04-D, P11 (só usa) | P04-D: `StateBadge` e `badges`. P11 consome | Baixo |
| `packages/ui/src/Toast.tsx` | P09-C (T-76) | O P04-D não muda; os toasts novos herdam a janela do P09-C | — |
| `apps/frontend/lib/queries/creation.ts` | P04-D | Duas mutações novas | — |
| `apps/frontend/sheet/data.ts` | P04-D, P09-C (T-40, provável) | P04-D: o `awaitsStoryteller` (`:57-66`). P09-C: a rebusca no foco e no "puxar" | Baixo |
| `e2e/tests/layout.spec.ts`, `lifecycle.spec.ts` | P03-D, P04-D | P03-D: "Concluir" → "Salvar alterações" nos 9 specs (o `lifecycle` e o `layout` usam "Concluir criação" do menu). P04-D: `layout.spec.ts:143` e `lifecycle.spec.ts:226`, `:297` (texto do estado) | Baixo. Linhas diferentes. O P04-D ajusta as dele depois do P03-D |

**Acordos para os outros pacotes da onda:**

- **P03-D:**
  - o lugar da ação seguinte aceita um rótulo de até 19 caracteres ("Avisar que terminei");
  - a barra no `compact` deixa os botões quebrarem de linha sem transbordar a 360 dp;
  - o `SummarySheet` mantém o `finish` com `label`, `body` e `notes`.
- **P11:**
  - usa o `StateBadge` (`label`, `tone`, `testID`) e o `ListItem.badges`;
  - traduz `character.creation.adjust` e `character.creation.ready` (§3.1);
  - fica com a migration `0023`, se precisar: o P04-D não usa.
- **P09-C:**
  - mantém o `StateBadge` do estado e o da visibilidade no cartão compacto;
  - o "alterada por" (T-83) não deve usar o `updated_at`. O P04-D não o atualiza no ajuste nem no aviso (§3.1).

### 8.5 Arquivos tocados

| Arquivo | Itens | Tipo de mudança |
|---|---|---|
| `packages/sheet-core/src/creation.ts` | R-13, R-14 | alterado (`CharacterCreation`, `CreationReady`, `parseCharacterCreation`, `:850-893`) |
| `packages/sheet-core/src/__tests__/creation.test.ts` | R-13, R-14 | teste alterado |
| `apps/api/src/sheets/creation.ts` | R-13, R-14 | alterado (`CommandKind`, `creationView`, `merged`, concluir, devolver, duas rotas) |
| `apps/api/src/audit.ts` | R-13, R-14 | alterado (duas ações) |
| `apps/api/src/sheets/routes.ts` | R-12 | alterado (lista: `creationFlags`, `creationMode`, `activatedAt`) |
| `apps/api/src/chronicles/table.ts` | R-12 | alterado (os mesmos campos na Mesa) |
| `apps/api/src/sheets/events.ts` | R-12 | alterado (`LIFECYCLE_EVENTS`) |
| `apps/api/src/chronicles/routes.ts` | R-13 | alterado (`pendingReview`) |
| `apps/api/src/test/authz-matrix.ts` | R-13, R-14 | alterado (duas linhas) |
| `apps/api/src/__tests__/creation.test.ts`, `creation.pg.test.ts`, `events.test.ts`, `table.test.ts`, `chronicles.test.ts` | todos | testes alterados |
| `packages/ui/src/StateBadge.tsx` | R-12 | novo |
| `packages/ui/src/ListItem.tsx`, `index.ts` | R-12 | alterados (`badges`; export) |
| `packages/ui/src/components.test.tsx`, `a11y.test.tsx` | R-12 | testes alterados |
| `apps/frontend/components/chronicles/characterState.ts` | R-12 | alterado (`characterState`) |
| `apps/frontend/components/chronicles/__tests__/characterState.test.ts` | R-12 | teste novo |
| `apps/frontend/components/chronicles/CharacterList.tsx` | R-12, R-13 | alterado |
| `apps/frontend/components/chronicles/tableItems.ts`, `TableRow.tsx` | R-12 | alterados (`stateLabel` sai) |
| `apps/frontend/sheet/creation/SheetState.tsx` | R-12 | novo (`SheetStateBadge`) |
| `apps/frontend/sheet/IdentityBlock.tsx` | R-12 | alterado |
| `apps/frontend/sheet/creation/creation.ts` | R-12, R-14 | alterado (`CreationInfo`, `creationInfoOf`) |
| `apps/frontend/sheet/creation/ReturnedBanner.tsx` | R-14 | alterado (o banner do ajuste) |
| `apps/frontend/sheet/creation/nextStep.ts` | R-13 | novo |
| `apps/frontend/sheet/creation/__tests__/nextStep.test.ts` | R-13 | teste novo |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | R-13 | alterado (`useNextStep`, `STALE_COMPLETION`) |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | R-13 | alterado (linha do próximo passo, ação seguinte, `SummarySheet`) |
| `apps/frontend/sheet/storyteller/StatusMenu.tsx`, `apps/frontend/sheet/SheetMenu.tsx` | R-12, R-14 | alterados |
| `apps/frontend/sheet/SheetScreen.tsx` | R-12, nota do P04-C | alterado (`narratorOf`, efeito de transição) |
| `apps/frontend/sheet/SheetView.tsx` | nota do P04-C | alterado (banner) |
| `apps/frontend/sheet/data.ts` | R-13 | alterado (`awaitsStoryteller`) |
| `apps/frontend/lib/queries/creation.ts` | R-13, R-14 | alterado (`useAdjustCreation`, `useReadyCreation`) |
| `apps/frontend/sheet/history/HistorySheet.tsx` | R-12 | alterado (`EVENT_LABELS`) |
| `apps/frontend/app/__tests__/new-character.test.tsx`, `table.test.tsx`, `table-alerts.test.tsx` | R-12, R-13 | testes alterados |
| `apps/frontend/sheet/__tests__/SheetScreen.test.tsx`, `LiveSheet.test.tsx`, `storyteller.test.tsx`, `policy.test.tsx`, `sheet.layout.test.tsx` | todos | testes alterados |
| `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | R-13, R-14 | teste alterado |
| `e2e/tests/creation-state.spec.ts` | todos | E2E novo |
| `e2e/tests/layout.spec.ts`, `lifecycle.spec.ts` | R-12 | E2E alterados |
| `design/design-system/components.md` | R-12, R-13 | doc (Tags/StateBadge, ListItem, IdentityBlock, ModeBar) |
| `doc/plano-v4.md` | R-13, R-14 | doc (§3.4) |
| `scripts/seed-roteiro.ts` | — | não muda aqui: a extensão é a do P03-D (commit 7) |

## 9. Perguntas abertas (técnicas)

⚙ = resposta só no simulador ou no aparelho.

1. ⚙ **A barra no `compact`.** Com a contagem, a linha do próximo passo e os dois botões em linhas próprias, quanto a área fixa cresce a 360 e a 393 dp? Se passar do que o T-27 ganhou, vale o plano B da §3.3: o "Avisar que terminei" vai para um cartão no topo da rolagem. Com a regra de rótulo do P03-D, os botões cabem numa linha e o plano B só entra se a medida falhar ([onda-3.md](onda-3.md) §4.1).
2. **O aviso some quando o jogador salva depois de avisar?** O plano mantém o `ready` até o narrador agir (concluir ou pedir ajuste). A Mesa mostra "alterada às" depois do aviso. Limpar no lote mexeria no `/events`, que é o caminho mais quente da API.
3. **A revisão sobe no aviso também?** O plano sobe nos dois, pela regra dos metadados ("sobe a cada mudança"). No aviso, o efeito é o narrador que conclui com a revisão velha receber 409 e concluir de novo depois da rebusca. A alternativa é subir só no ajuste.
4. **Contagem na lista de crônicas.** Somar o `ready` ao `pendingReview` ou criar um campo `readyCount`? A soma não muda o app ("N fichas aguardam revisão"). O campo separado serve ao P09-D (D-10).
5. **Selo fixo no cabeçalho.** O plano põe o selo só no `IdentityBlock`, que rola. Vale um rótulo curto no `subtitle` da `AppBar` a partir de 600 px, onde ele cabe?
6. **Polling em `ready`.** Os 30 s do `pending` servem à espera do aviso?
7. **"Concluída em dd/mm" de outro ano.** Acrescentar o ano quando não for o corrente ("Concluída em 01/11/2025")? A D-02 diz `dd/mm`.
8. **App antigo das lojas.** A linha do Histórico sem texto para os `event` novos é aceitável até a atualização, ou o servidor manda também um `label` em texto? Isso seria texto de interface na API.
9. **Índice no `chronicle_audit` por ficha** (P04-C, pergunta 5). Agora são seis ações no Histórico. A consulta continua filtrando pela crônica (índice existente) e depois pela ficha.
10. ⚙ **iOS: a folha do motivo aberta pelo `onClosed` do "Mais opções",** com `autoFocus` e o teclado. O campo e o "Pedir ajuste" ficam acima do teclado no iPhone SE?
11. **Seed.** Combinado na consolidação: os dados do §11.a entram na `--fichas-criacao` do P03-D (commit 7), a extensão única da onda ([onda-3.md](onda-3.md) §4.9). Ela economiza a criação pela tela e não muda o roteiro padrão das personas.

**Pontos para o PO** (não decididos aqui; ver §2):

1. O texto do estado depois de "Avisar que terminei", que a D-02 não lista. O plano propõe "Avisou que terminou" (narrador) e "Você avisou que terminou" (jogador).
2. "Aguardando aprovação" (D-02) no lugar de "Aguarda aprovação" e "Aguarda sua revisão". O narrador perde "sua revisão" na linha, e o chamado fica no banner.
3. "Aguardando ajuste" não impede concluir na criação por pontos sem aprovação, como a devolução. O jogador pode concluir sem ajustar, e a D-04 deixa o "Reabrir criação" fora deste ciclo.
4. "Pedir ajuste" em `pending`. A devolução já faz a mesma transição, e o plano não duplica a ação.
5. "Concluída em dd/mm" em toda ficha ativa, na lista e na Mesa, sem prazo.
6. "Avisar que terminei" não trava a edição: o jogador continua editando até o narrador concluir.
7. O narrador dá três toques até a folha do motivo abaixo de 900 px (onda-2 §6.8).
8. Seguem abertos, das ondas anteriores: onda-2 §6.4 (abertura em Editar na crônica livre) e §6.6 (extrato no Histórico).

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

Implementado sobre `8fb653e`, sem o P03-D (§8.4, "Se o P03-D atrasar"): a barra é a `EvolveBar` de hoje.

1. **A barra recebe `next` e `note` na `EvolveBar` de hoje** (commit 8). As props têm os nomes do contrato do P03-D (§3.1 dele): o rebase troca o botão "Concluir" pelo `save` dele e mantém o `next` ("Avisar que terminei", `testID="creation-ready"`) e o `note` (`testID="next-step"`). A barra ganhou `flexWrap`: com pouco espaço, os botões descem para a linha de baixo, à direita, sem transbordar. A medida a 360 dp continua com o AVD (pergunta 1).
2. **O `useNextStep` mora num arquivo próprio** (`sheet/creation/useNextStep.ts`), em vez de virar a base do `useFinishCreation`. O caminho de espera da fila é o mesmo, mas o `useFinishCreation`, que o P03-D também mexe, só ganhou o `STALE_COMPLETION` no `onError`. Menos conflito no rebase.
3. **O aviso manda só a `revision`**, não a `sheetVersion`. A corrida que importa é a do pedido de ajuste, que sobe a revisão; a versão da ficha recusaria o aviso por qualquer lote do narrador no meio. A rota aceita as duas.
4. **O `StateBadge` não é um elemento acessível à parte** (sem `accessible` nem `accessibilityRole="text"`). Dentro da linha da lista e do cartão da Mesa, um filho acessível ganharia foco próprio no Android e seria engolido no iOS; o texto já é lido como texto, e o rótulo entra no nome da linha. Com `live`, a região viva fica na `View` (`aria-live` no web, `accessibilityLiveRegion` no Android).
5. **`CreationInfo` (`adjust`, `ready`) e o `sheetStateRow` entraram no commit 5**, não no 6: o `narratorOf` já precisava deles para o estado no menu do narrador.
6. **`CreationContext` ganhou `kind` e `completedWhileEditing`.** O `kind` deixa o selo do NPC de fora; o segundo liga o banner da nota do P04-C (§3.7), que só vale no Editar (criação livre).
7. **Testes da lista, da Mesa, do Histórico e da contagem no `creation.test.ts` da API**, e não no `events.test.ts` e no `chronicles.test.ts`: o template sintético por pontos (`acct-teste`) e os ajudantes já estão lá. O `table.test.ts` só mudou a linha esperada. O `isReturned` virou `creationFlags`, em `apps/api/src/sheets/creation-state.ts`, junto do `creationStateOf` da lista e da Mesa.
8. **O `pendingReview` confere o `ready` pela forma do parse** (`jsonb_typeof(creation -> 'ready' -> 'at') = 'string'`), não só pela chave.
9. **Qualquer 409 do "Pedir ajuste" mostra "A ficha mudou desde que você abriu. Confira e peça de novo."** e rebusca (inclui `CREATION_NOT_CREATING` e `CREATION_ADJUST_UNAVAILABLE`, que o menu já evita).
10. **Um passo do Histórico que o app não conhece** fica só com a data e o autor (pergunta 8), sem `undefined` na linha.
11. **E2E: além do `layout.spec.ts:143` e do `lifecycle.spec.ts:226` e `:297`, o `lifecycle.spec.ts:194` muda.** O `getByText('Aguardando aprovação')` passa a casar o painel e o selo (modo estrito do Playwright); o seletor vira `getByTestId('creation-pending')`, como no Jest. Os quatro ficam para depois do merge do P03-D (§8.4). O `creation-state.spec.ts` já usa os seletores novos e foi só checado com typecheck.
12. **O teste da regra é `components/chronicles/__tests__/characterState.test.tsx`**, não `.test.ts`: o `testMatch` do Jest em `components/` só pega `.test.tsx`, e com a extensão do plano o arquivo passava verde sem rodar (aviso do P11). Conferido com `jest --listTests`.
13. **O `PATCH …/creation` mantém o `ready` só na criação livre** (§3.1 dizia "mantém `adjust` e `ready`"). Se o narrador passa a ficha para pontos depois do aviso, o `ready` sai: concluir volta a ser da dona, e a Mesa, a lista e a contagem não seguem dizendo "avisou que terminou" numa ficha por pontos. O `adjust` continua. Achado da revisão do próprio pacote; há teste no `creation.test.ts`.

## 11. Testes manuais (web, Android com AVD, iOS com idb)

Roteiro para conferir cada item na interface, nas três plataformas, com a API local e o seed do roteiro. Só contas fictícias. Ele detalha o passo 6 da §7. A coluna "Resultado" fica em branco e é preenchida na integração. Nenhum resultado é "ok" sem a evidência; quando uma plataforma não puder ser conferida, o resultado diz "não conferido" e por quê.

### 11.a Preparação

1. **Banco e API:**
   - `npx pnpm db:up`, `npx pnpm db:migrate` e `npx pnpm templates:publish --published`;
   - API em `npx pnpm dev:api` (porta 3001), e o Metro em `cd apps/frontend && npx expo start` (porta 8081).
2. **Seed:** `npx pnpm seed:roteiro`.
   - **Contas:** N (`roteiro_narrador`), J1 (`roteiro_jogador1`), J2 (`roteiro_jogador2`) e N2 (`roteiro_narrador2`), todas `@roteiro.test`. A senha é a constante do `scripts/seed-roteiro.ts` e não é escrita aqui nem nas evidências.
   - **Crônicas, com sufixo de data:** "Vampiro v3/v5" (livre), "Vampiro v4" (por pontos, aprovação desligada), as mesmas de Mago e Lobisomem, e "Vampiro limite 20" (21 fichas).
   - O seed não cria ficha nas crônicas do roteiro.
3. **O que o roteiro cria pela tela** (uma vez; as plataformas usam as mesmas fichas):
   - J1 cria "Ficha Livre R" em "Vampiro v3/v5" e "Ficha Pontos R" em "Vampiro v4", só com o nome.
   - N liga a aprovação em "Mago v4" (Fichas → "Criação de fichas" → Aprovação "Ligada"). J1 cria "Ficha Aprovação R" lá e distribui os pontos até a conta fechar.
4. **Seed estendido (opcional, a `--fichas-criacao` do P03-D, commit 7; [onda-3.md](onda-3.md) §4.9).** A opção (fora do padrão) cria pela API, só com dados fictícios:
   - as três fichas de J1;
   - a aprovação ligada em "Mago v4";
   - a conta da "Ficha Aprovação R" fechada, com os números do `lifecycle.spec.ts:46-80`.

   Ela poupa uns 10 minutos por plataforma e não muda o seed padrão.
5. **Evidências:** no scratchpad da sessão, com o nome `p04d-<plataforma>-<ID>-<passo>.png`. Sem e-mail visível na captura (a tela de conta não entra).

### 11.b Web (Playwright, Chromium; WebKit onde indicado)

- **Script:** `<scratchpad>/p04d/web.mjs` com o `playwright` do `node_modules`, contra `http://localhost:8081` (Metro).
- **Contextos:** dois `browser.newContext()`, um para N e outro para J1, para ver os dois lados sem sair da conta.
- **Viewports:** exatas, `{ width: 390, height: 844 }` e `{ width: 1280, height: 800 }`.
- **WebKit:** os passos R-12a e R-14a rodam também em `webkit.launch()`, para conferir a quebra do selo e a folha a 390.
- **Seletores por papel e rótulo, como no E2E (§4.3):**
  - `getByRole('button', { name: /Sua ficha, Em criação · livre$/ })`;
  - `getByTestId('sheet-state')`;
  - `getByRole('button', { name: 'Mais opções' })`;
  - `getByRole('button', { name: /^Ações do narrador/ })`;
  - `getByTestId('status-adjust')`;
  - `getByLabel('O que precisa ser ajustado')`;
  - `getByRole('button', { name: 'Avisar que terminei', exact: true })`.
- **Um `page.screenshot` por passo.**
- **O Metro do web pode ficar velho depois de editar** (memória `device-testing-setup`). Reiniciar com `--clear` antes da rodada.

### 11.c Android (AVD)

- **AVD:** `Pixel_3a_API_34_extension_level_7_arm64-v8a` (1080 × 2220, 440 dpi = 393 dp), com boot rápido e `-gpu host`.
- **APK:** o `assembleDebug` arm64 da integração (onda-2 §10, ~3 min), com `JAVA_HOME` no JBR do Android Studio.
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Larguras de layout** (selo e barra): `adb shell wm density 480` (360 dp) e `420` (411 dp), e `adb shell wm density reset` no fim.
- **Teclado de software:** `adb shell settings put secure show_ime_with_hard_keyboard 1` para a folha do motivo.
- **Navegação:**
  - `adb shell uiautomator dump /sdcard/ui.xml` e `adb pull`, para achar o alvo pelo `text` ou pelo `content-desc` e tocar no centro do `bounds` com `adb shell input tap X Y`;
  - `adb shell input text` para digitar (espaço como `%s`);
  - `adb shell input keyevent 4` para o voltar do Android.
- **LogBox:** o banner do LogBox embaixo engole toque; dispensar antes.
- **Conta:** J1 no AVD e N no web a 1280, como nas personas; depois, os papéis trocados para o R-14.

### 11.d iOS (simulador, com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, e iPhone 17, iOS 26.5.
- **Build Debug sem assinatura**, como o job `native-ios` (`.github/workflows/ci.yml:333-341`), em `apps/frontend/ios`:

  ```bash
  xcodebuild -workspace TMS.xcworkspace -scheme TMS -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath <scratchpad>/ios-dd CODE_SIGNING_ALLOWED=NO build
  ```

  Leva ~37 min a frio e ~10 min incremental. Depois: `xcrun simctl install <UDID> <scratchpad>/ios-dd/Build/Products/Debug-iphonesimulator/TMS.app` e `xcrun simctl launch <UDID> com.tms.app`.
- **O cliente do idb** (fb-idb):
  - **onde:** num venv **fora do repositório**, com versão fixada: `python3 -m venv ~/.venvs/idb-tms` e `~/.venvs/idb-tms/bin/pip install 'fb-idb==1.1.7' 'pip-audit==<versão fixada>'`, o mesmo venv dos quatro pacotes ([onda-3.md](onda-3.md) §10.a);
  - **antes de usar:** `~/.venvs/idb-tms/bin/pip-audit`. Com vulnerabilidade, parar e registrar;
  - **nunca** no `package.json` nem no lockfile;
  - **risco:** o cliente pode não rodar no Python da máquina (pergunta para a consolidação).
- **O companion:** o `idb_companion` já está em `/opt/homebrew/bin` e fica só local, sem porta exposta na rede. Conferir com `lsof -nP -iTCP -sTCP:LISTEN | grep idb` que ele escuta só em `127.0.0.1`/`::1`, ou usar o socket de domínio do companion. Encerrar no fim.
- **Navegação:**
  - `idb ui describe-all --udid <UDID>` para achar o alvo pelo rótulo de acessibilidade (`AXLabel`) e tocar no centro do `frame` com `idb ui tap X Y`;
  - `idb ui text "…"` para digitar, `idb ui swipe` para rolar e `idb ui key 40` para o Return;
  - `idb screenshot --udid <UDID> <arquivo>` para a evidência.
- **Deep link:** `xcrun simctl openurl <UDID> 'tms://characters/<id>'` pede "Abrir com 'TMS'?". Achar "Abrir" no `describe-all` e tocar.
- **Conta:** J1 no simulador e N no web a 1280. Para o R-14, N no simulador (NA-18).

### 11.e Tabela por item

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| R-12a | Web 390 (Chromium e WebKit) | J1 | Crônica "Vampiro v4" → aba Fichas; depois "Vampiro v3/v5" | Linha "Ficha Pontos R" com o selo "Em criação · por pontos"; "Ficha Livre R" com "Em criação · livre"; o texto quebra, sem corte | `p04d-web390-R-12a-1.png`, `-2.png` | |
| R-12b | Web 390 | J1 | Abrir "Ficha Pontos R" → trocar Criação, Jogo e de volta | O selo sob o nome nos três modos, acima das abas | `p04d-web390-R-12b-1..3.png` | |
| R-12c | Web 1280 | N | "Mago v4" → Mesa, depois que J1 enviou "Ficha Aprovação R" | "Aguardando aprovação" no cartão; na aba Fichas, "de roteiro_jogador1, Aguardando aprovação" e o banner de revisão | `p04d-web1280-R-12c-1.png`, `-2.png` | |
| R-12d | Web 390 | J1 | Concluir "Ficha Pontos R" (conta fechada) → voltar à crônica → "Mais opções" → Histórico | Lista e ficha com "Concluída em dd/mm" (hoje); Histórico com "Criação concluída" | `p04d-web390-R-12d-1..3.png` | |
| R-12e | Android 393, 360 e 411 dp | J1 | R-12a e R-12b no AVD; a 360, "Ficha Livre R" no Editar com 1 alteração não salva | Selo inteiro sob o nome; cabeçalho sem transbordo ("Mais opções" visível); `uiautomator dump` com o texto do selo e a linha da lista com o estado no `content-desc` | `p04d-and393-R-12e-1.png`, `p04d-and360-R-12e-2.png`, `p04d-and411-R-12e-3.png` | |
| R-12f | iOS, SE e iPhone 17 (obrigatório: IA-04, IA-13) | J1 | Fechar o app (`xcrun simctl terminate`) → abrir → crônica → "Ficha Livre R" | Lista com o selo; a ficha abre com o selo; no 17, o conteúdo abaixo da Dynamic Island | `p04d-iosSE-R-12f-1.png`, `p04d-ios17-R-12f-2.png` | |
| R-12g | Web 390 | N | Abrir "Ficha Livre R" de J1 (Leitura) → "Mais opções" | "Em criação · livre" sob o nome; item "Ações do narrador · Em criação · livre" | `p04d-web390-R-12g-1.png`, `-2.png` | |
| R-13a | Web 390 | J1 | "Ficha Livre R" (Editar) → ler a barra → mudar um traço → "Avisar que terminei" | Linha "Quando terminar, avise: o narrador conclui."; o resumo lista a alteração "salva antes"; depois de confirmar, o toast "Pronto: o narrador foi avisado.", o selo "Você avisou que terminou" e a linha nova; o botão sai | `p04d-web390-R-13a-1..4.png` | |
| R-13b | Web 1280 | N | Mesa de "Vampiro v3/v5"; aba Fichas; lista de crônicas | Cartão "Avisou que terminou"; banner "1 jogador avisou que terminou"; "1 ficha aguarda revisão" na lista de crônicas | `p04d-web1280-R-13b-1..3.png` | |
| R-13c | Web 390 | J1 | "Ficha Pontos R" (antes de concluir) e "Ficha Aprovação R" (antes de enviar) | "Você conclui quando a conta fechar." e "Quando a conta fechar, envie ao narrador." | `p04d-web390-R-13c-1.png`, `-2.png` | |
| R-13d | Android 360 e 393 dp | J1 | R-13a no AVD, com 1 alteração | Nada da barra fora da tela; os dois botões alcançáveis; a altura da barra medida no `dump` (para a pergunta 1) | `p04d-and360-R-13d-1.png`, `p04d-and393-R-13d-2.png` | |
| R-13e | iOS SE | J1 | R-13a pelo idb | A folha abre e fecha, o toast aparece e o selo muda | `p04d-iosSE-R-13e-1..3.png` | |
| R-14a | Web 390 (Chromium e WebKit) | N | "Ficha Livre R" → "Mais opções" → "Ações do narrador · …" → "Pedir ajuste" → digitar "Refaça os Antecedentes" → Enter | A folha com o campo e o contador "N/500"; o Enter envia o texto inteiro; o toast "Ajuste pedido…"; o selo "Aguardando ajuste" | `p04d-web390-R-14a-1..4.png` | |
| R-14b | Web 1280 (outro contexto) | J1 e J2 | J1 volta à janela (foco) → ficha em Editar → Jogo; J2 abre "Vampiro v3/v5" | J1: banner "O narrador pediu um ajuste" com o motivo nos dois modos; lista "Aguardando ajuste". J2: a ficha de J1 não aparece | `p04d-web1280-R-14b-1..3.png` | |
| R-14c | Web 1280 | N | "Pedir ajuste" pelo botão largo; Esc com a folha aberta | Diálogo central de até 560 px; o Esc fecha e o foco volta ao gatilho | `p04d-web1280-R-14c-1.png`, `-2.png` | |
| R-14d | Web 390 e 1280 | J1 e N | J1 avisa de novo → N conclui pelo menu → os dois abrem o Histórico | "Avisou que terminou" no cartão; depois, "Concluída em dd/mm"; o Histórico com "Ajuste pedido", "Avisou que terminou" e "Criação concluída", **sem o texto do motivo** | `p04d-web-R-14d-1..4.png` | |
| R-14e | Android 393 | N | "Pedir ajuste" com o teclado de software → voltar do Android com a folha aberta → abrir de novo → "✓" no teclado | Campo e botão acima do teclado; o voltar fecha a folha, não a tela; o "✓" envia o texto inteiro | `p04d-and393-R-14e-1..3.png` | |
| R-14f | iOS SE e iPhone 17 (obrigatório: NA-18; troca de folha pelo `onClosed`, pendente da onda 2) | N | "Mais opções" → "Ações do narrador" → "Pedir ajuste" → digitar → enviar | A segunda folha abre depois da primeira sair; o teclado não cobre o botão; o selo muda | `p04d-iosSE-R-14f-1..3.png`, `p04d-ios17-R-14f-4.png` | |
| R-14g | Web 390 | N | "Mago v4", com a aprovação ligada: ficha de J1 em `creating` e depois em `pending` | "Pedir ajuste" em `creating`; em `pending`, o painel com "Aprovar ficha" e "Devolver para correção", sem "Pedir ajuste" | `p04d-web390-R-14g-1.png`, `-2.png` | |
| P04-C §10 | Web 390 (J1) e 1280 (N) | J1 e N | J1 no Editar de uma ficha livre nova, com 1 alteração; N conclui; J1 volta à janela | Banner "O narrador concluiu a criação"; o Editar e a alteração ficam; o selo "Concluída em dd/mm" | `p04d-web-P04C-1..2.png` | |

### 11.f Acessibilidade mínima

O estado novo e o selo aparecem como texto e com papel na árvore, em cada plataforma:

- **Web (DOM):**
  - `getByTestId('sheet-state')` com texto e `aria-live="polite"`;
  - a linha da lista é um `button` cujo nome termina no estado;
  - o banner do ajuste tem o título e o motivo como texto.
- **Android (`uiautomator dump`):**
  - um `TextView` com o texto do selo;
  - o `content-desc` da linha da lista inclui o estado;
  - o campo do motivo tem o rótulo "O que precisa ser ajustado".
- **iOS (`idb ui describe-all`):**
  - um elemento com `AXLabel` igual ao texto do selo, com o traço de texto estático;
  - a linha da lista com o estado no `AXLabel`;
  - o botão "Pedir ajuste" com papel de botão.

O tom (cor) nunca é a única pista: a captura em escala de cinza mostra o mesmo texto.

### 11.g Limpeza

- Parar a API e o Metro.
- Desligar o AVD (`adb emu kill`) e os simuladores (`xcrun simctl shutdown all`).
- Encerrar o `idb_companion` e sair do venv.
- `adb shell wm density reset` e `adb shell settings put secure show_ime_with_hard_keyboard 0`.
- Manter as capturas no scratchpad até a integração. Nada vai para o repositório.

### 11.h Quando uma plataforma não puder ser conferida

O resultado diz "não conferido" e o motivo, por exemplo:

- "o cliente idb não roda no Python 3.x desta máquina";
- "build do iOS falhou em …".

O passo fica para a integração ou para o roteiro antes do release. Nunca "ok" sem a evidência.
