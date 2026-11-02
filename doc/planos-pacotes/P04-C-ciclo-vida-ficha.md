# P04-C · Ciclo de vida da ficha: abertura, devolução e conclusão: plano de implementação

> Plano · 2026-11-02 · base conferida: `onda/2-correcoes-criacao` em `9f75426` (main depois da onda 1)

Este plano corrige o pacote [P04-C da matriz de achados](../testes/2026-11-01/matriz-achados.md#p04-c): a ficha em criação abre no modo de montagem por qualquer entrada; a devolução aparece em qualquer modo, na lista e na ficha aberta; a Nova ficha diz o modo e o orçamento; concluir e aprovar sempre confirmam, com o texto de quem lê; e o Histórico registra a conclusão sem linhas falsas. É um pacote de correção: não muda regra do jogo, não remove campo e não afrouxa limite. A conta da criação, a política de escrita e as permissões continuam no servidor, como hoje.

Todas as linhas citadas são do `9f75426`. A matriz cita o `1db3db9` e foi escrita antes da onda 1; o que mudou desde então, e onde a causa provável da matriz está errada, a seção 3 diz.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md), "Como executar", "Decisões de produto" e §P04-C | Itens, decisões, "PR local" e critério de saída da onda |
| [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) §7 e [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §4 (R-02, R-08, R-10, R-11) | Recomendações |
| Notas: [qa-web](../testes/2026-11-01/notas/qa-web.md) (QAW-36, QAW-37), [qa-app](../testes/2026-11-01/notas/qa-app.md) (QAA-13, QAA-14, QAA-24), [po-web](../testes/2026-11-01/notas/po-web.md) (POW-01, POW-09, POW-34), [po-app](../testes/2026-11-01/notas/po-app.md) (POA-18, POA-35), [narrador-web](../testes/2026-11-01/notas/narrador-web.md) (NW-02, NW-19, NW-26), [narrador-app](../testes/2026-11-01/notas/narrador-app.md) (NA-01, NA-22, NA-23), [experiente-web](../testes/2026-11-01/notas/experiente-web.md) (EW-01, EW-08), [experiente-app](../testes/2026-11-01/notas/experiente-app.md) (EA-21), [iniciante-web](../testes/2026-11-01/notas/iniciante-web.md) (IW-04, IW-08, IW-23), [iniciante-app](../testes/2026-11-01/notas/iniciante-app.md) (IA-04, IA-13) | Cenários do critério de pronto |
| [plano-v4.md](../plano-v4.md) §3.4 e Etapas 4–5 | Conclusão, aprovação, devolução e "freeze" dos derivados |
| [onda-1.md](onda-1.md) §6 e §9; [P03-C](P03-C-rascunho-salvamento.md) §10; [P06](P06-componentes-acessibilidade.md) §3.12 e §10 | O que a onda 1 entregou e as lições da integração |

## 1. Objetivo e itens

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| T-05 | alta | Reaberta pela lista, por link ou depois de recarregar, a ficha `creating` do dono abre em Jogo; só a ida logo depois de "Criar ficha" abre na montagem | `apps/frontend/sheet/SheetScreen.tsx:254-255` (`defaultMode`), `:304-328` (modo inicial do store), `:365-378` (troca de estado); `apps/frontend/app/(app)/characters/[id].tsx:15-25` (o `?mode=` vale só na chegada) |
| T-06 | alta | A ficha devolvida volta à lista sem selo, abre sem aviso e o motivo só aparece em Criação; a ficha aberta não se atualiza quando o narrador devolve | `apps/frontend/sheet/SheetView.tsx:179`; `apps/frontend/sheet/creation/CreationPanel.tsx:134-161`; `apps/api/src/sheets/routes.ts:326-429`; `apps/frontend/components/chronicles/CharacterList.tsx:82-85`; `apps/frontend/sheet/SheetScreen.tsx:73-79`; `apps/frontend/lib/queryClient.ts:17` |
| T-29 | média | A Nova ficha é igual na crônica livre e na por pontos: não diz o modo nem o orçamento combinado | `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx:87-91`; `apps/frontend/components/chronicles/CreationSettings.tsx:116-124`, `:146-160` |
| T-32 | média | "Concluir criação" pelo menu do narrador e "Aprovar ficha" executam sem confirmar; os textos divergem ("passa por você" × "passa pelo narrador") | `apps/frontend/sheet/storyteller/StatusMenu.tsx:73-82`, `:100-116`; `apps/frontend/sheet/creation/CreationPanel.tsx:347-361`, `:104-110`; `apps/frontend/sheet/evolve/ModeBar.tsx:390-397` |
| T-80 | baixa | A conclusão deixa "Aparência: 0 → 0" e "Humanidade: 0 → 6" no Histórico, assinados por quem concluiu, e não registra "criação concluída" | `apps/api/src/sheets/creation.ts:191-241` (`freeze`, `from_value` nulo em `:234`), `:657-663`, `:722-728`, `:313-321`; `apps/api/src/sheets/events.ts:346-491` |

## 2. Decisões aplicadas

**O P04-C não tem decisão própria (D-xx).** É correção. As decisões que encostam nele são do P04-D (onda 3), do P03-D (onda 3), do P09-D (onda 5) e do P01-D (onda 5). Esta seção diz o que entra agora e o que fica para elas, sem decidir produto.

**D-02 (P04-D: estados da ficha e onde aparecem).** O selo "Devolvida" do T-06 segue o desenho de estados da D-02. Entra agora:

- **A fonte do estado na lista:** a API passa a mandar `returned: true` nas linhas da ficha devolvida (sem o motivo), ao lado do `status` que já manda (§3.2).
- **O texto "Devolvida" no lugar que já existe para "Aguarda aprovação"**: a linha da lista (`meta` do `ListItem`, `CharacterList.tsx:82-85`). A regra fica numa função pura, `characterStateText(row, narrating)`, num arquivo novo (`components/chronicles/characterState.ts`). O P04-D a estende com os outros estados ("Em criação · livre/por pontos", "Aguardando ajuste", "Concluída em dd/mm") e decide o componente do selo e o lugar sob o nome.
- **O banner com o motivo** num componente próprio, `NarratorReasonBanner`, que recebe título e motivo. A D-04 diz que no "Aguardando ajuste" o jogador vê o motivo "como na devolução": o P04-D reaproveita o mesmo componente.

Fica para o P04-D: o selo como componente visual, o estado sob o nome da ficha, na aba Fichas e na Mesa, o selo do narrador no cabeçalho (`stateLabel`, `components/chronicles/tableItems.ts`) e os eventos de estado no Histórico além da conclusão ("Enviada para aprovação", "Devolvida", "Aguardando ajuste").

**D-02, o evento "criação concluída" no Histórico (parte da R-12).** Entra agora, porque é o "esperado" do T-80 na matriz: o Histórico mostra "Criação concluída" quando a ficha passa a `active` pela criação (concluir ou aprovar). Os outros eventos de estado ficam para o P04-D, acima.

**D-01 (P03-D: Salvar × Concluir na barra) e D-13 (P01-D: planos × tela).** O T-29 pede "um nome para a etapa". O código e as decisões mostram que isso não se aplica como a recomendação está escrita:

- a D-13 manteve os dois nomes de modo, "Criação" (por pontos) e "Editar" (livre e evolução), e manda os planos se alinharem a eles;
- a D-01 troca o "Concluir" do Editar por "Salvar alterações", que é o que confunde (POW-07).

**O P04-C não renomeia modo nem botão.** A Nova ficha passa a dizer em que modo a ficha vai abrir ("no modo Criação" ou "no modo Editar"), o que liga os dois nomes ao tipo de crônica. Se a intenção do PO era um nome só, isso volta para ele (seção 9).

**D-03 (P04-D: próximo passo e "Avisar que terminei").** A frase da barra com o próximo passo e quem conclui é do P04-D. O P04-C só diz quem conclui na Nova ficha (texto da crônica, §3.3) e nas confirmações (§3.4), com o mesmo helper que o P04-D pode reaproveitar.

**D-04 (P04-D: pedir ajuste; "Reabrir criação" fora deste ciclo).** O T-32 cita "não há Reabrir criação": continua fora. A confirmação diz que a conclusão não tem volta, que é o comportamento de hoje (`apps/api/src/sheets/status.ts:15-24`). O texto fica num helper só (§3.4), para mudar junto se a reabertura entrar.

**D-10 (P09-D: painel "Criação de fichas" em uma linha).** O resumo do orçamento do T-29 (`creationSummary`, §3.3) é a mesma linha que a D-10 pede para o painel do narrador ("Por pontos · 7/5/3 · 15 de bônus · aprovação desligada"). O P09-D a reaproveita. As linhas de efeito sob cada opção (R-10) usam o `meta` do `Choice` e sobrevivem ao resumo da D-10, que só recolhe o painel depois de salvo.

**O que a matriz recomenda e o código mostra que não cabe numa correção** (apontado, não decidido):

1. **R-02, "volta para a aba onde a pessoa parou" (T-05).** A aba é estado local da tela (`SheetView.tsx:126`). Lembrar a aba por ficha cria estado persistido novo, e a recomendação técnica do §7 não o pede. O P04-C abre a ficha no modo certo e na primeira aba. A aba lembrada fica para o PO.
2. **"Atribuir os derivados ao autor da mudança que os gerou" (T-80).** O código mostra que as linhas "Humanidade 0 → 6" não são mudança de ninguém. São o `freeze` da conclusão: os valores calculados que já valiam passam a ser gravados (`creationFreeze`, `packages/sheet-core/src/creation.ts:813-838`). O P04-C não as reatribui: deixa de mostrá-las, porque o valor não mudou, e o item "Criação concluída" diz quem concluiu. É o que a nota POW-34 pede ("omitir o que não muda").
3. **NA-23 (na criação livre, o narrador só conclui pelo ⋯).** Pôr a conclusão na barra é ação nova (D-01, D-03). Fica no P03-D e no P04-D. O P04-C só garante a mesma confirmação nos dois caminhos.

## 3. Desenho por item

### 3.1 T-05 · A ficha em criação abre na montagem por qualquer entrada

**Causa confirmada, com o lugar da correção diferente do que a matriz sugere.** A matriz diz que "a abertura pela lista não passa o modo". É verdade (`CharacterList.tsx:112` faz `router.push('/characters/<id>')`), mas passar o `?mode=` na lista não resolveria o deep link, a recarga nem a reabertura do app. O modo inicial é decidido em três lugares:

- `apps/frontend/app/(app)/characters/[id].tsx:19-24`: o `?mode=` vale só na chegada e sai da URL logo depois. Recarregar ou voltar abre "no modo padrão do papel";
- `apps/frontend/sheet/SheetScreen.tsx:304-314`: sem `initialMode`, o store nasce em `defaultMode(roles)` (`:254-255`), que é Jogo para o dono, mesmo com a ficha em `creating`;
- `SheetScreen.tsx:365-378`: quando o estado muda (o narrador devolve: `pending` → `creating`), o efeito leva o dono para `defaultMode`, isto é, Jogo.

**Correção (só no app; a política continua no servidor):**

- **Função pura nova, ao lado de `defaultMode` e `policyMode`:**

  ```ts
  /** O modo em que a ficha abre sem pedido na URL. É UX: o servidor valida cada escrita. */
  export function openingMode(args: {
    roles: readonly RoleName[]; status: string; active: boolean; writer: boolean
  }): SheetMode
  ```

  Ela devolve o modo de montagem (`create` se a conta por pontos vale, `evolve` se não, como `draftMode` em `:308`) quando a pessoa é **dona**, a ficha está em `creating` e ela escreve algum campo (`writer`). Nos demais casos, devolve `defaultMode(roles)`.
- **O `policyMode` continua vindo antes** (`forced`, `:289` e `:321`):
  - ex-membro e ficha arquivada abrem em Leitura;
  - `pending` abre em Leitura com "Aguardando aprovação" (`CreationStatusPanel`), porque o dono não escreve (`writePolicy`, `packages/sheet-core/src/policy.ts:82-83`).
- **Store inicial** (`:309-314`): com `initialMode` de rascunho, nada muda. Sem ele, `openingMode(...)` no lugar de `defaultMode(...)`. O `startDraft()` de `:326` já cobre o modo de rascunho.
- **Troca de estado** (`:365-378`):
  - onde hoje vai para `defaultMode`, passa a ir para `openingMode`;
  - entrar num modo de rascunho chama `startDraft()` antes do `setMode`, como o `switchTo` do `ModeBar` (`ModeBar.tsx:93-101`);
  - **entre modos de rascunho o rascunho continua.** Hoje, `evolve → create` já é assim (`:371-374`). O caminho inverso, `create → evolve`, acontece quando o narrador libera a criação livre: hoje ele descarta o rascunho e vai a Jogo (`:369`, `:376`). Passa a manter o rascunho e ir a Editar, sem perder o que a pessoa não salvou.
- **O narrador não muda.** Ele continua abrindo em Leitura (`defaultMode`). A D-10 (P09-D) é que trata do narrador dentro da ficha em criação. O NPC em criação, que é do narrador, também não muda (seção 9, pergunta 4).
- **O `viewer` e a projeção de identidade não passam pelo `LiveSheet`** (`SheetScreen.tsx:120-141`) e não mudam.
- **A rota `[id].tsx` não muda.** O `?mode=` continua valendo na chegada, e o comentário de `:16-18` passa a dizer "no modo de abertura da ficha (montagem, se em criação)".

**Recuperação de rascunho (P03-C).** A ficha que abre em Criação nasce com um rascunho vazio, e o `useDraftPersistence` já oferece o registro guardado nesse caso (`DraftRecovery.tsx:118-131`, `found && !s.draft?.size`). "Decidir depois" leva ao `idleMode` (`SheetScreen.tsx:351`), que continua `defaultMode`: sair do rascunho vazio para Jogo é o que impede dois rascunhos (P03-C, §3.2). Não muda.

**"Volta para a aba onde parou":** fora (seção 2, item 1).

### 3.2 T-06 · A devolução aparece em qualquer modo, na lista e na ficha aberta

**Causa confirmada, em três partes:**

1. **O banner só existe em Criação e só na criação por pontos.**
   - `SheetView.tsx:179` só monta `CreationAlerts` com `mode === 'create'`.
   - `CreationAlerts` sai se `!creation.active` (`CreationPanel.tsx:138`), e `active` só vale na criação por pontos (`creation.ts:61-70`).
   - A devolução só nasce de `pending`, que hoje só existe na criação por pontos (`apps/api/src/sheets/creation.ts:612-620`, `:778-779`). Mas o narrador pode liberar a criação livre depois de devolver, e aí o motivo continua gravado (`:508`) e some da tela.
2. **A lista não sabe da devolução.** A API manda `status` e nada mais (`routes.ts:408-424`), e a linha só trata `pending` (`CharacterList.tsx:82-85`). Além disso, a lista não rebusca ao voltar para a crônica: o `useChronicleCharacters` (`lib/queries/chronicles.ts:145-152`) não tem `useRefetchOnFocus`, e o `staleTime` padrão é de 30 s (`lib/queryClient.ts:17`).
3. **A ficha aberta não se atualiza.** Ela rebusca no foco da tela (`SheetScreen.tsx:73-79`, `useFocusEffect`) e no foco da janela ou do app (TanStack: `visibilitychange` no web, `AppState` no nativo, `app/_layout.tsx:22-34`), só depois de 30 s. Quem está olhando a ficha em `pending` enquanto o narrador devolve não tem nenhum desses eventos: duas janelas lado a lado no desktop (POW-09) ou o app em primeiro plano (POA-35, QAA-13).

**Correção na API** (`apps/api/src/sheets/routes.ts`, `GET /chronicles/:id/characters`):

- Selecionar `ch.creation` (`:335-348`).
- Na linha `full` (`:408-424`), `returned: r.status === 'creating' && parseCharacterCreation(model, r.creation).returned !== undefined`. **Só o booleano: o motivo nunca vai para a lista**, como hoje (o teste `creation.test.ts:483-489` já confere que a lista do outro jogador não tem o motivo).
- A linha só chega a quem já recebe a ficha na lista: o narrador recebe todas; o membro e o ex-membro, só os próprios PCs (`:351-364`). O NPC revelado continua na projeção de identidade (`:398-406`), sem `returned`.

**Correção no app:**

- **Banner em qualquer modo.**
  - `CreationAlerts` (`CreationPanel.tsx:134-161`) se divide em dois. O banner da devolução vira `ReturnedBanner`, montado em `SheetView.tsx:178-179` com `editable` e **sem** a condição de modo nem de `active`: vale `status === 'creating' && info.returned`. O que fica em `CreationAlerts` é só a recusa da conta (`creation-refused`), que o P05-C retrabalha (§8.4).
  - O texto é para quem lê: o dono vê "O narrador devolveu a ficha"; o narrador, "Você devolveu esta ficha". O motivo vai como `message`, e o `testID` `creation-returned` fica.
  - O `Banner` de `tone="warning"` já é região viva educada (`packages/ui/src/Banner.tsx:51-52`): quando a ficha aberta se atualiza, o leitor de tela anuncia.
- **A ficha aberta se atualiza enquanto espera o narrador.**
  - `useCharacter` (`sheet/data.ts:48-61`) ganha `refetchInterval` por função. São 30 s quando a resposta diz `status === 'pending'` e os papéis têm `owner` sem `storyteller`; nos demais casos, `false`.
  - O TanStack não roda o intervalo com a janela ou o app em segundo plano (`refetchIntervalInBackground` fica `false`). É uma consulta já autorizada, sem limite de taxa na rota (só as de auth têm).
  - Quando o narrador devolve ou aprova, a próxima consulta traz o estado novo. O efeito de troca de estado (§3.1) leva a ficha a Criação, com o banner; ou a Jogo, se foi aprovada.
- **Web: o foco da janela também rebusca.** `useRefetchOnFocus` (`lib/queries/focus.ts:10-18`) passa a ouvir também o `focus` da `window` no web: duas janelas lado a lado não disparam `visibilitychange`. O mesmo `refetch` com `cancelRefetch: false` serve a ficha e a Mesa (`TableView.tsx:145`), que já usam o hook.
- **A lista mostra "Devolvida" e se atualiza.**
  - `CharacterList.tsx`:
    - `FullRow` ganha `returned?: boolean` (`:27-40`);
    - o texto de estado sai de `characterStateText` (seção 2): `Sua ficha · Devolvida`, ou `de <jogador> · Devolvida` para o narrador, ao lado de `· Aguarda aprovação` e de `· Aguarda sua revisão`, que continuam;
    - a lista chama `useRefetchOnFocus` para `chronicleKeys.characters(chronicleId)`.
  - `lib/queries/creation.ts:12-27` (`useRefresh`) também invalida `chronicleKeys.characters(chronicleId)`. Assim, a lista do próprio narrador muda depois de devolver, aprovar ou concluir.

### 3.3 T-29 · Modo e orçamento na Nova ficha e na crônica

**Causa confirmada.** O texto de topo da Nova ficha é fixo (`new-character.tsx:87-91`). Os dados já chegam ao app:

- o `GET /chronicles/:id` manda `creation: { approval, defaults, revision }` ao narrador e ao membro (`apps/api/src/chronicles/routes.ts:410-417`). O ex-membro não recebe, e não cria ficha;
- a tela já carrega o template mais novo (`new-character.tsx:42-43`);
- a configuração efetiva é a do core (`effectiveCreationConfig`, `packages/sheet-core/src/creation.ts:183-206`): template, depois o padrão da crônica, que é a camada com que a ficha nasce (`:847-855`).

**Sem mudança de API nem do core.**

- **Helper novo:** `apps/frontend/sheet/creation/summary.ts`, com `creationSummary(model, config, approval)`. Ele devolve `{ mode, parts }`, e `parts` é a lista de trechos, sempre lidos do template:
  - `priority-budget`: `"<rótulo> 7/5/3"`, com a lista do `config.budgets[id]` ou do template;
  - `fixed-budget`, `item-count` e `point-buy`: `"<rótulo> N"`;
  - `freebies`: `"N de bônus"`;
  - a aprovação: `"aprovação ligada"` ou `"aprovação desligada"`.

  Sem `creation` no template, ou com o modo `free`, devolve só o modo. Nenhum nome de sistema no código.
- **Nova ficha** (`new-character.tsx:87-91`, só para PC; o texto do NPC fica):
  - **por pontos:** "Esta crônica usa criação por pontos: Atributos 7/5/3 · Habilidades 13/9/5 · … · 15 de bônus. Comece pela identidade; os pontos você distribui depois, na ficha, no modo Criação." Com a aprovação ligada, acrescenta "O narrador aprova a ficha antes de ela entrar em jogo.";
  - **livre:** "Esta crônica usa criação livre, sem conta de pontos. Comece pela identidade; o resto você monta depois, na ficha, no modo Editar. O narrador conclui a criação." A conclusão livre é do narrador (`apps/api/src/sheets/creation.ts:611-620`);
  - **sem `chronicle.data.creation`, ou com o template ainda carregando,** fica o texto de hoje. Lição do L-01 (onda 1): "não carregou" nunca vira "criação livre".
- **Crônica, lado do jogador.** O `CharacterList` recebe `creation` de `chronicles/[id]/index.tsx:249-253` (`c.creation`). Para quem não narra e pode criar, mostra a mesma linha do `creationSummary` sob o título "Suas fichas" (EW-01: "na crônica e na Nova ficha"). O narrador já vê o painel inteiro.
- **Efeito de cada opção nas regras da crônica (R-10, NW-02, NA-01)**, em `CreationSettings.tsx:116-124` e `:146-160`, pelo `meta` do `ChoiceOption` (`packages/ui/src/Choice.tsx:9-15`, que já existe e entra no nome acessível, `:84`). Sem mudança no `@tms/ui`:
  - Aprovação **Desligada**: "Na criação por pontos, a ficha entra em jogo quando o jogador conclui."
  - Aprovação **Ligada**: "Na criação por pontos, o jogador envia a ficha e ela fica só para leitura até você aprovar ou devolver."
  - **Por pontos**: "A ficha conta os pontos do orçamento e avisa o que falta; o jogador conclui."
  - **Livre**: "Sem conta de pontos: o jogador monta no modo Editar e você conclui."

  Os textos descrevem o comportamento de hoje (`creation.ts:47-56` da API); nenhum é regra nova.

**O nome único da etapa:** fora (seção 2, D-01 e D-13).

### 3.4 T-32 · A mesma confirmação ao concluir e ao aprovar, escrita para quem lê

**Causa confirmada.**

- **Menu do narrador.** A ação `complete` não tem `confirm` (`StatusMenu.tsx:73-82`) e aplica no toque (`:269-271`). Ela chama a API sem chave, sem `revision` e sem `sheetVersion` (`:103-104`). Concluir assim, com um rascunho do narrador aberto, descarta o rascunho em silêncio: o efeito de `SheetScreen.tsx:369` e `:376` sai da Criação quando a criação acaba.
- **"Aprovar ficha"** aprova no toque (`CreationPanel.tsx:347-361`).
- **Textos.** O menu diz "passa por você" (`StatusMenu.tsx:78`). A barra diz "passa pelo narrador" também para o narrador (`ModeBar.tsx:392-394`), e o toast também (`CreationPanel.tsx:104-110`).

**Correção:**

- **Helper novo:** `apps/frontend/sheet/creation/completion.ts`, com `completionCopy({ by: 'owner' | 'storyteller', approval, action: 'complete' | 'approve' })`. Ele devolve `{ title, body, confirm, done }`, e todos os caminhos usam essa mesma fonte de texto:
  - **dono, aprovação ligada:** "Enviar para aprovação?" / "A ficha vai para o narrador aprovar e fica somente para leitura até lá." / feito: "Ficha enviada. Ela aguarda a aprovação do narrador.";
  - **dono, sem aprovação:** "Concluir criação?" / "A ficha entra em jogo. Depois disso, subir um traço passa pelo narrador. Não dá para voltar à criação." / "Criação concluída. Subir um traço agora passa pelo narrador.";
  - **narrador, concluir:** "Concluir criação?", ou "Concluir e aprovar?" com a aprovação ligada (`completeLabel`, `creation.ts:196-204`) / "A ficha entra em jogo. Depois disso, subir um traço passa por você. Não dá para voltar à criação." / "Criação concluída. Subir um traço agora passa por você.";
  - **narrador, aprovar:** "Aprovar ficha?" / o mesmo corpo / "Ficha aprovada e liberada."
- **Menu do narrador** (`StatusMenu.tsx`):
  - `complete` ganha `confirm` com o texto do helper. A folha de confirmação (`:234-257`) mostra o `title` e o `body`, e o botão principal usa o `confirm`;
  - a chamada passa ao `useCompleteCreation` (`lib/queries/creation.ts:59-75`): chave por intenção, `revision` e `sheetVersion` da ficha em cache, e a invalidação de `useRefresh`;
  - o `StatusMenuButton` recebe `revision`, `sheetVersion` e `unsaved` de `SheetScreen.tsx:180-188`. O `unsaved` é o mesmo número que alimenta o cabeçalho (`:71-72`);
  - com `unsaved > 0`, a confirmação diz "Você tem N alterações não salvas nesta ficha. Salve ou descarte antes de concluir." e o botão fica desabilitado. Assim o rascunho não se perde em silêncio. "Salvar e concluir" seria ação nova (D-01);
  - um 409 (`CREATION_REVISION_CONFLICT` ou `SHEET_VERSION_CONFLICT`, `apps/api/src/sheets/creation.ts:255-272`) vira "A ficha mudou desde que você abriu. Confira e conclua de novo.", e a ficha é rebuscada. O servidor continua decidindo; o cliente só não conclui sobre dado velho.
- **Barra** (`ModeBar.tsx:390-397`): o `SummarySheet` de conclusão usa o `body` do helper com `by` vindo dos papéis. O título e o botão já vêm de `finishing.label` e não mudam (D-01 é do P03-D). O toast de `useFinishCreation` (`CreationPanel.tsx:104-110`) usa o `done`.
- **"Aprovar ficha"** (`CreationPanel.tsx:347-361`): o toque abre uma `BottomSheet` "Aprovar ficha?" com o `body`, "Voltar" e "Aprovar ficha" (`testID="creation-approve-confirm"`). O `testID` `creation-approve` continua no botão que abre a folha.
- **Espaço para o P05-C.** A confirmação da barra e a do "Aprovar ficha" aceitam linhas extras (`notes?: readonly string[]`), onde o T-18 põe "Sobram N pontos de bônus". A do menu fica fora do `SheetProvider` (está no `AppBar`). Se o P05-C quiser o saldo também ali, ele sobe junto com o `unsaved` pelo mesmo caminho (`onUnsaved` vira `onDraftState`, §8.4).

**Toast no Android (QAA-24).** O `ModalToastHost` já leva o aviso para a janela do modal (`packages/ui/src/Toast.tsx:109-120`). A conferência no AVD (§7) confirma que o toast aparece depois de a folha fechar. Se não aparecer, o `show` passa para depois do `onClose`.

### 3.5 T-80 · Histórico sem linhas falsas e com "Criação concluída"

**Causa (a matriz estimou `creation.ts` l.702–740; o lugar é outro).**

- **As linhas sem mudança são o `freeze`.** Ao concluir por pontos (dono sem aprovação, `apps/api/src/sheets/creation.ts:657-663`) ou ao aprovar (`:722-728`), o servidor grava os iniciais com fórmula ainda ausentes (`creationFreeze`), num lote em nome de quem concluiu (`:215-226`). Esse lote leva `from_value: null` (`:234`).
  - O Histórico mostra o `from` nulo como 0: "Humanidade 0 → 6" e "Aparência 0 → 0", assinados pelo narrador (POW-34) ou pelo próprio jogador (IW-23).
  - O valor efetivo não mudou: é o mesmo que a ficha já mostrava.
  - O `/events` já grava o "de" efetivo (`events.ts:303-319`, teste "Sangue ainda no padrão", `events.test.ts:511-531`). O `freeze` não segue essa regra.
- **"Criação concluída" não aparece porque a conclusão só vai para o `chronicle_audit`** (`settle`, `creation.ts:313-321`). Esse é o registro da crônica, que só o narrador lê em Bastidores. O Histórico da ficha só lê `character_batches` (`events.ts:357-434`).

**Correção na API, sem migration:**

- **`freeze` grava `from_value` igual ao `to_value`** (`creation.ts:229-237`). Por construção, o valor congelado é o efetivo de antes (`stored(resolved)`, `packages/sheet-core/src/creation.ts:831-835`). O `from_absent: true` continua: desfazer volta ao campo vazio, como hoje.
- **O Histórico tira os eventos sem mudança** (`events.ts:436-474`): `jsonEqual(from_value, to_value)` sai da lista de `changes`, **exceto os eventos sem conteúdo**. Texto e especialização são gravados como `null → null` (`:306-316`) e aparecem como "atualizado"; o filtro usa o mesmo predicado `hide` (`contentFree` ou `scope === 'specialties'`) para não apagá-los. Um lote que fica sem mudança já sai pelo filtro existente (`:474`). O `reversible` continua calculado com todos os eventos (`:463-470`).
- **"Criação concluída" vem do `chronicle_audit`:**
  - **Consulta:** só da crônica da ficha (`chronicle_id`, coberto pelo índice `chronicle_audit_recent_idx`, `packages/db/src/migrations/0014_character_status.ts:57-59`), `target_character_id = id` e `action in ('character.creation.complete', 'character.creation.approve')`. São no máximo duas linhas por ficha (concluir de novo só existe depois de arquivar antes de ativar, `status.ts:22-23`). Sem o `payload`.
  - **Cada linha vira um item** `{ id, at, by, byRole, event: 'creation.completed', reversible: false, changes: [] }`:
    - `by` vem do `users` do `actor_id` (null vira "Conta excluída", como nos lotes);
    - `byRole` é `'owner'` quando o `actor_id` é o dono da ficha e `'storyteller'` nos outros casos. É a mesma regra do `by_role` do `/events` (`:293`), calculada no servidor, nunca vinda do cliente.
  - **Paginação.** O cursor continua o dos lotes (`created_at_id`). A página com lotes no intervalo `[último lote da página, before)` inclui as conclusões desse intervalo; a última página (`next === null`) inclui as anteriores. O "freeze" e a conclusão têm o mesmo `now` (`:584`, `:696`), então caem juntos. A ordem é decrescente por `(at, id)`.
  - **Acesso.** O Histórico continua só para dono e narrador: o `viewer` recebe 404 (`:351`), e o outro jogador e o estranho também (`authz-matrix.ts:241-245`). O filtro de rolagem oculta (`:394-407`) não toca nesses itens.

**No app** (`sheet/history/HistorySheet.tsx`):

- `HistoryItem` ganha `event?: 'creation.completed'` (`:24-36`);
- o `HistoryRow` (`:46-77`) mostra "Criação concluída" quando `event` vem e `changes` está vazio, com a mesma linha de quem e quando (`whoLabel`);
- sem "Desfazer";
- o app antigo das lojas recebe o item com `changes: []` e mostra só a data e o autor: não quebra.

**Fica como está:** os lotes de `freeze` já gravados com `from` nulo continuam aparecendo. Reescrevê-los é uma migration de dados (seção 9, pergunta 1).

## 4. Testes

Um teste de regressão para cada bug, que falha no `9f75426` e passa com a correção.

| Item | Regressão | Tipo |
|---|---|---|
| T-05 | `apps/frontend/sheet/__tests__/SheetScreen.test.tsx`:<br>• `openingMode`: dono em `creating` vai a `create` (por pontos) ou `evolve` (livre); `active` vai a `play`; narrador, a `read`; sem `writer`, ao padrão;<br>• a ficha do dono em `creating`, sem `?mode=`, abre com o rádio "Criação" (por pontos) ou "Editar" (livre) marcado;<br>• `pending` abre em Leitura com "Aguardando aprovação"; ex-membro, em Leitura;<br>• a resposta passa de `pending` a `creating` com `returned` e o modo vai a Criação, com o banner;<br>• liberar a criação livre com 2 alterações em Criação vai a Editar com as 2 | Jest + RNTL |
| T-05 | `apps/frontend/sheet/__tests__/LiveSheet.test.tsx`: reabrir a ficha em criação com rascunho guardado já em Criação oferece "Recuperar" (cenários QAA-03 e IA-04 juntos) | Jest + RNTL |
| T-05 | `e2e/tests/lifecycle.spec.ts` (novo, 390 × 844): criar na crônica por pontos → voltar à crônica → tocar a ficha na lista → `getByRole('radio', { name: 'Criação', exact: true })` marcado e `getByRole('tab', { name: 'Orçamento' })` visível; `page.reload()` → Criação de novo; na crônica livre, `getByRole('radio', { name: 'Editar', exact: true })` marcado e `getByText('Editando · 0 alterações')` (QAW-37, IW-04, EW-08) | Playwright |
| T-06 | `apps/api/src/__tests__/creation.test.ts`, no caso "devolver" (`:448-506`):<br>• a lista do dono e a do narrador trazem `returned: true` na ficha devolvida e não trazem o motivo;<br>• a lista do outro jogador não tem a linha;<br>• depois de enviar de novo, `returned` some;<br>• a ficha ativa nunca tem `returned` | API, PGLite (`useTestDb()`) |
| T-06 | `SheetScreen.test.tsx` com `jest.useFakeTimers()`:<br>• a dona com a ficha em `pending` rebusca em 30 s; o narrador e a ficha `active` não rebuscam;<br>• quando a resposta volta `creating` com motivo, o `creation-returned` aparece;<br>• o banner aparece em Jogo, em Criação e em Leitura (ex-membro), com o texto do narrador para o narrador | Jest + RNTL |
| T-06 | `apps/frontend/lib/__tests__/focus.test.tsx` (novo): no web, o `focus` da `window` chama o `refetch`; ao desmontar, o ouvinte sai; no nativo, nada além do `useFocusEffect` | Jest |
| T-06 | `apps/frontend/app/__tests__/chronicles.test.tsx`:<br>• a linha da ficha devolvida tem o nome acessível terminando em "Sua ficha · Devolvida";<br>• para o narrador, "de <jogador> · Devolvida";<br>• "Aguarda aprovação" continua;<br>• voltar à crônica rebusca a lista | Jest + RNTL |
| T-06 | `lifecycle.spec.ts`, dois contextos (dona e narrador), 390 × 844, numa crônica por pontos com aprovação ligada:<br>• a dona envia e fica com a ficha aberta;<br>• o narrador devolve com o motivo "Troque 1 ponto de Ofícios por Esquiva";<br>• na ficha aberta da dona, depois de `page.evaluate(() => window.dispatchEvent(new Event('focus')))`, `getByTestId('creation-returned')` contém o motivo;<br>• `getByRole('radio', { name: 'Jogo', exact: true })` → o banner continua;<br>• na crônica, `getByRole('button', { name: /Sua ficha · Devolvida$/ })` (POW-09, POA-35, QAA-13) | Playwright |
| T-29 | `apps/frontend/sheet/creation/__tests__/summary.test.ts` (novo):<br>• V20 por pontos dá "Atributos 7/5/3", "Habilidades 13/9/5", os fixos, "15 de bônus" e a aprovação;<br>• a camada da crônica muda os números;<br>• o fixture de D&D (`point-buy`) dá "<rótulo> 27";<br>• sem `creation` ou com `free`, só o modo | Jest |
| T-29 | `apps/frontend/app/__tests__/new-character.test.tsx`: a crônica por pontos mostra o resumo e "no modo Criação"; a livre, "no modo Editar" e "O narrador conclui"; sem `creation` (ou o template carregando), o texto de hoje; o NPC não muda | Jest + RNTL |
| T-29 | `apps/frontend/components/chronicles/__tests__/CreationSettings.test.tsx`: cada opção tem o `meta` e entra no nome acessível ("Ligada, Na criação por pontos, o jogador envia…"); `chronicles.test.tsx`: o jogador vê a linha do resumo sob "Suas fichas", e o narrador não | Jest + RNTL |
| T-32 | `apps/frontend/sheet/creation/__tests__/completion.test.ts` (novo): as quatro combinações de `completionCopy`; o narrador nunca lê "passa pelo narrador", e o dono nunca lê "passa por você" | Jest |
| T-32 | `apps/frontend/sheet/__tests__/policy.test.tsx` (`:189`, `:283`):<br>• "Concluir criação" no ⋯ abre "Concluir criação?" e **não** chama a API;<br>• "Voltar" volta à lista; confirmar chama `POST /creation/complete` com `clientCommandId`, `revision` e `sheetVersion`;<br>• com `unsaved = 2`, o botão fica desabilitado e o aviso aparece;<br>• um 409 mostra "A ficha mudou…" | Jest + RNTL |
| T-32 | `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx`: "Aprovar ficha" abre "Aprovar ficha?" sem chamar a API; confirmar aprova; o toast é o `done`; `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx`: o resumo de conclusão do narrador diz "passa por você" | Jest + RNTL |
| T-32 | `lifecycle.spec.ts`: o narrador, a 390, toca `getByRole('button', { name: 'Ações do narrador' })` → `getByRole('button', { name: 'Concluir criação', exact: true })` → vê `getByText('Concluir criação?')`, sem `POST` (contador em `page.on('request')`) → "Voltar"; depois confirma, e o toast diz "passa por você" (QAW-36, NW-26) | Playwright |
| T-80 | `apps/api/src/__tests__/creation.test.ts`, no caso "aprovação ligada" (`:338-428`): depois de aprovar, o `GET /characters/:id/history` do dono e o do narrador não têm linha com `from` igual a `to` (nem "Humanidade", nem "Aparência" do freeze) e têm um item `event: 'creation.completed'`, `byRole: 'storyteller'`, com o `username` do narrador e sem `payload`; o lote do freeze guarda `from_value` igual a `to_value` e `from_absent: true` | API, PGLite |
| T-80 | O mesmo arquivo, no caso "aprovação desligada" (`:299`): a dona conclui → o item vem com `byRole: 'owner'` e o nome dela; no caso "criação livre" (`:541`), o narrador conclui → item do narrador, sem lote de freeze | API, PGLite |
| T-80 | `apps/api/src/__tests__/events.test.ts` (`:416` em diante):<br>• um texto alterado continua como "atualizado" (o filtro não apaga `null → null` sem conteúdo);<br>• paginação com `limit=2` sobre 5 lotes e uma conclusão no meio: o item aparece uma vez, na página certa, e as páginas não se repetem;<br>• o `viewer` do NPC concluído continua com 404 | API, PGLite |
| T-80 | `apps/frontend/sheet/__tests__/storyteller.test.tsx` (mock `historyGet`, `:189` em diante): o item com `event` mostra "Criação concluída · <data> · <nome> (narrador)" e não tem "Desfazer" | Jest + RNTL |
| T-80 | `lifecycle.spec.ts`: depois da aprovação, a dona abre "Histórico" e vê `getByText('Criação concluída')` e nenhuma linha `getByText(/^Humanidade: /)` (POW-34) | Playwright |

**Testes existentes que mudam junto** (o T-05 muda o modo de abertura de toda ficha `creating` da dona):

- **Jest:**
  - `SheetScreen.test.tsx`: o fixture `character()` (`:41-55`) está em `creating` com papel `owner`. Os casos que esperam Jogo passam a usar `status: 'active'`, ou a esperar Editar quando o caso é de criação;
  - `LiveSheet.test.tsx`, `evolve/__tests__/screen.test.tsx` e `app/__tests__/table-alerts.test.tsx`: conferir o mesmo;
  - `app/__tests__/character-route.test.tsx`: só o comentário de `:7-8`;
  - `policy.test.tsx:189`: "o resto aplica no toque" deixa de valer para "Concluir criação".
- **E2E que abrem uma ficha `creating` da própria pessoa** (`freeCreation` e criação pela API, sem conclusão):
  - `play.spec.ts`, `sheet.spec.ts`, `dice.spec.ts`, `offline.spec.ts`, `table.spec.ts` e `a11y-keyboard.spec.ts`: passam a concluir a criação pela API antes de abrir, com um helper novo `completeCreation(context, user, characterId)` em `e2e/support/users.ts`, ou tocam "Jogo" quando o teste é sobre a criação. **Jogo é para ficha em uso.**
  - `evolve.spec.ts:61-63`: "Recarregar: a dona abre em Jogo" passa a "abre em Editar" (é a correção do EW-08).
  - `conflict.spec.ts` e `draft.spec.ts` já entram em Editar e devem passar sem mudança; conferir.
  - `journey-storyteller.spec.ts:130-137`: o "Concluir criação" do menu ganha o segundo clique, na confirmação.
- **Maestro:** o `02-open-sheet.yaml` espera Jogo e o dock. O `CHARACTER_ID` do `README.md` (`apps/frontend/.maestro/README.md:48` e `:65`) passa a dizer "ficha concluída (`active`)". O `09` já abre com `?mode=create` e não muda.

**Suítes a rodar** (comandos do CLAUDE.md):

- `@tms/api` (Bun, PGLite): `cd apps/api && bun test`, incluindo a matriz de AuthZ (`authz.test.ts`). Nenhuma rota nova, mas três respostas mudam.
- `*.pg.test` da API (`creation.pg.test.ts` cobre conclusão e aprovação concorrentes), com um banco `_test` do worktree: `PG_TEST_URL=postgres://postgres:postgres@localhost:5432/tms_p04c_test bun test .pg.test`.
- Frontend (Jest): `npx pnpm test:ui`.
- **`npx pnpm test:coverage`, como o CI** (`.github/workflows/ci.yml:105`). As metas são por arquivo:
  - na API, 85% de linhas e funções em cada arquivo (`apps/api/bunfig.toml`). `events.ts`, `creation.ts` e `routes.ts` ganham ramos novos, cobertos pelos casos acima;
  - no app, `./sheet/` tem 80/80/70 (`apps/frontend/jest.config.js:37`). `summary.ts`, `completion.ts` e `ReturnedBanner` nascem com teste próprio, e `lib/` e `components/` seguem a meta global.
- `@tms/sheet-core` **não muda**: sem rebuild de `dist` para a API. Os imports do core que o pacote usa (`jsonEqual`, `parseCharacterCreation`, `effectiveCreationConfig`) já existem.
- Na integração da onda: E2E inteiro em Chromium e WebKit, com o `lifecycle.spec.ts` novo e os ajustes acima.

## 5. Segurança

O P04-C muda três respostas da API (lista da crônica, Histórico e o lote do freeze) e o que o dono vê do registro de conclusão. **Passa por `/security-review` antes do merge**, além do `/code-review`. Foco: `apps/api/src/sheets/routes.ts` (lista), `events.ts` (Histórico), `creation.ts` (freeze) e o polling do app.

| O que pode dar errado | Como o desenho evita |
|---|---|
| O motivo da devolução vaza para quem não é dono nem narrador | A lista leva só `returned: true`; o motivo continua só no `GET /characters/:id`, que só dono e narrador alcançam (`authz.ts:111-115`; o `viewer` não recebe `creation`, `routes.ts:487-507`). Teste: a lista e o Histórico não contêm o texto do motivo, nem para a dona; o outro jogador não tem a linha |
| O motivo vai para log, Histórico, toast ou registro | O motivo continua fora do `chronicle_audit` (`creation.ts:790-799`, payload vazio) e não entra no item "Criação concluída" (sem `payload`). O banner é o único lugar que o mostra |
| O Histórico passa a expor o registro da crônica ao jogador | Só duas ações (`complete` e `approve`), só da ficha pedida e só da crônica dela. Sem `payload` e sem `target_user_id`. O autor sai pelo `username`, como já sai nos lotes. O acesso é o do Histórico (dono e narrador); o `viewer`, o outro jogador, o ex-membro alheio e o estranho recebem 404, como na matriz (`authz-matrix.ts:241-245`) |
| Autoria forjada ou trocada no Histórico | `by` vem do `actor_id` gravado pelo servidor com o usuário autenticado (`creation.ts:313-321`), e `byRole` é calculado no servidor contra o dono da ficha. Nada vem do corpo |
| O filtro "sem mudança" esconde uma mudança real | Só sai o evento com `from` e `to` iguais. Texto e especialização (gravados `null → null`) ficam, pelo mesmo predicado `hide`. O lote continua no banco e o `reversible` usa todos os eventos |
| O freeze passa a permitir desfazer para outro valor | O `from_absent: true` continua: a reversão devolve o campo vazio, como hoje. O `from_value` igual ao `to_value` só muda a exibição |
| O polling vira carga ou abre consulta nova | Só a dona, só em `pending`, de 30 em 30 s, com a tela em primeiro plano. A rota e a AuthZ são as mesmas do abrir a ficha |
| O modo de abertura vira controle de acesso | É UX. A política (`writePolicy`) vale no servidor em cada lote. Ex-membro, ficha arquivada e `pending` são forçados a Leitura antes do `openingMode` (fail secure) |
| A conclusão pelo menu confirma dado velho ou repete | O menu passa a mandar `revision`, `sheetVersion` e `clientCommandId`. O servidor recusa com 409 o que mudou (`creation.ts:255-272`) e devolve o resultado gravado na repetição (`once`, `:84-127`). Com alterações não salvas, o botão nem chama a API |
| NPC oculto aparece pela lista ou pelo Histórico | A projeção de identidade da lista não ganha campo (`routes.ts:398-406`). O NPC só tem Histórico para o narrador; o `viewer` recebe 404, e o `journey-backstage.spec.ts:302-310` continua conferindo |

Checklist da organização:

- **Validação no servidor:** conta, política, AuthZ e conflito continuam no servidor. O cliente só desabilita e confirma.
- **Logs sem PII:** nenhum log novo. O motivo nunca é logado.
- **Fail secure:** sem `creation` na resposta, nenhum resumo e nenhum selo inventado. Sem `returned`, a linha fica como hoje.
- **Erros sem stack trace:** os 409 e 422 continuam com `code` e mensagem curta.

## 6. Como generaliza além do WoD

- **Abertura (T-05).** Depende só do estado `creating`, do papel `owner` e de a conta por pontos valer: tudo do core e da API, nada de sistema. No D&D 5e com point-buy, abre em Criação; no Call of Cthulhu sem `creation`, em Editar.
- **Devolução (T-06).** É do ciclo de vida da ficha (`characters.creation.returned`), igual em qualquer template. O banner reaproveitável serve ao "Aguardando ajuste" da D-04.
- **Resumo do orçamento (T-29).** É montado das `budgets` do template, com os rótulos dele. No D&D sai "Atributos 27"; no CoC, os orçamentos fixos de ocupação e de interesse pessoal com o rótulo do template. Nenhum nome de sistema no código.
- **Confirmação (T-32).** O texto depende de quem lê e da aprovação, não do sistema. O rótulo do botão continua vindo de `completeLabel`.
- **Histórico (T-80).** O freeze vale para qualquer padrão com fórmula (`rating`, `resource` e `clock`, `packages/sheet-core/src/creation.ts:826-830`). No CoC, a Esquiva (DES/2) congelada na conclusão também some do Histórico, e "Criação concluída" é o mesmo item.

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado.** Arquivos e linhas conferidos neste documento. Nenhuma decisão própria; o §2 diz o que fica para o P04-D, o P03-D, o P09-D e o P01-D.
2. **Typecheck, lint e testes** de `@tms/api` (com os `*.pg.test`) e do frontend. `@tms/sheet-core`, `@tms/db` e `@tms/ui` não mudam.
3. **Um teste de regressão por bug** (§4), falhando no `9f75426`, e o `test:coverage` verde.
4. **`/code-review` e `/security-review`** no diff do pacote. A API e a AuthZ do narrador mudam (§5). Os achados vão no resumo.
5. **O cenário de cada persona, repetido sem o defeito.** Com a API local e o seed do roteiro (`npx pnpm seed:roteiro`: contas `roteiro_*`, crônicas "Vampiro v3/v5" livre e "Vampiro v4" por pontos; só dados fictícios).

| Item | Nota | Cenário | Plataforma | Esperado agora |
|---|---|---|---|---|
| T-05 | QAW-37, POW-01 | Crônica → tocar a própria ficha em criação por pontos | web 390 e 1280 | Abre em Criação, com prioridades e a aba Orçamento |
| T-05 | IA-04 | Fechar o app → reabrir → crônica → ficha não concluída | iOS (simulador) | Abre em Criação; com rascunho guardado, oferece "Recuperar" |
| T-05 | IW-04, EW-08 | Criar ficha (por pontos e livre) → voltar → abrir pela lista; F5 | web 390 e 1280 | Criação na por pontos; Editar na livre |
| T-06 | POW-09 | Narrador devolve com motivo → a jogadora abre a ficha e troca para Jogo | web 1280 | Banner com o motivo em Criação e em Jogo |
| T-06 | POA-35, QAA-13 | Jogadora com a ficha `pending` aberta; o narrador devolve no outro aparelho; ela volta à crônica | iOS e Android | Em até 30 s a ficha mostra o banner; a lista diz "Sua ficha · Devolvida" |
| T-29 | EW-01, NW-19 | Nova ficha em "Vampiro v4" e em "Vampiro v3/v5" | web 390 | "criação por pontos: Atributos 7/5/3 · …" × "criação livre … o narrador conclui" |
| T-29 | EA-21, QAA-14 | Nova ficha em "Vampiro v4" | Android (AVD 393 dp), iOS | O resumo aparece acima do formulário, sem cortar |
| T-29 | NW-02, NA-01 | Crônica → "Criação de fichas" → alternar Ligada/Desligada e Por pontos/Livre | web 390, iOS | A linha de efeito sob cada opção |
| T-32 | QAW-36, NW-26 | Narrador → ⋯ Ações do narrador → Concluir criação | web 390 e 1280 | "Concluir criação?" com "passa por você"; nada é enviado antes de confirmar |
| T-32 | NA-22, POA-18 | O mesmo, e pela barra de Criação | iOS | Mesmo texto nos dois caminhos |
| T-32 | QAA-24 | Concluir pelo ⋯ e "Aprovar ficha" | Android (AVD 393 dp) | Confirmação nos dois e o toast visível depois de fechar a folha |
| T-80 | POW-34 | Aprovar → Histórico | web 1280 | "Criação concluída · <narrador> (narrador)", sem "Aparência 0 → 0" nem "Humanidade 0 → 6" |
| T-80 | IW-08, IW-23, IA-13 | Concluir (aprovação desligada) → Histórico | web 390, iOS | "Criação concluída" assinado pela jogadora, sem Humanidade nem FdV |

   O P04-C é mais de comportamento que de layout. A conferência no aparelho cobre só o que muda na tela: o banner, a lista, o resumo da Nova ficha, as folhas de confirmação e o toast. É feita no AVD Android a 393 dp (e a 360 dp para o resumo da Nova ficha), no simulador iOS e no web a 390 e a 1280. O cabeçalho da ficha, que transborda a 360 dp, é do P08 (T-11).
6. **Resumo para a seção do pacote no PR da onda:** o que mudou, como foi testado e os achados das duas revisões.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

| # | Commit | Itens | Esforço |
|---|---|---|---|
| 1 | `fix(api): Histórico sem linhas sem mudança e com "Criação concluída"` (freeze com o "de" efetivo, filtro, itens do registro, testes) | T-80 | M |
| 2 | `fix(api): ficha devolvida marcada na lista da crônica, sem o motivo` | T-06 | P |
| 3 | `fix(app): a ficha em criação abre em Criação ou Editar por qualquer entrada` (com os fixtures do Jest) | T-05 | P |
| 4 | `fix(app): devolução em qualquer modo, na lista e na ficha aberta` (banner, polling em `pending`, foco da janela, lista) | T-06 | M |
| 5 | `fix(app): a mesma confirmação ao concluir e ao aprovar, para quem lê` | T-32 | P |
| 6 | `fix(app): "Criação concluída" no Histórico` | T-80 | P |
| 7 | `fix(app): modo e orçamento na Nova ficha, na crônica e nas regras da criação` | T-29 | P |
| 8 | `test(e2e): ciclo de vida da ficha a 390 px e specs que abrem ficha em criação` (`lifecycle.spec.ts`, `completeCreation`, ajustes da §4) | T-05, T-06, T-32, T-80 | M |
| 9 | `docs: modo de abertura da ficha e Histórico da conclusão` (`.maestro/README.md`, `doc/plano-v4.md` §3.4 com a nota do freeze e da conclusão no Histórico) | — | P |

**Por que esta ordem:**

- A API (1 e 2) vem antes do app que a usa e é o foco do `/security-review`.
- O T-05 (3) vem antes do T-06 (4), que usa o `openingMode` na troca `pending → creating`.
- A confirmação (5) vem antes do Histórico no app (6), porque o E2E da conclusão confere os dois.
- O T-29 (7) fica por último no código porque toca no `new-character.tsx` e no `CreationSettings.tsx`, os arquivos de maior conflito da onda 1. Assim o rebase fica menor.
- O E2E (8) roda na integração. Os specs são escritos aqui e conferidos lá, como na onda 1.

### 8.2 Esforço

**M**, de 4 a 6 dias, em 9 commits (5 P, 3 M e o de docs). A matriz soma 5 P. A diferença vem do que o código mostrou:

- o T-80 tem a parte de API (freeze, filtro e o registro da conclusão entrando na paginação do Histórico);
- o T-06 tem a ficha aberta, que não se atualiza sem o polling, e a lista, que não sabe da devolução sem a API;
- o T-05 muda o modo de abertura de toda ficha da dona em criação, e isso muda fixtures do Jest e sete specs do E2E;
- o pacote passa pelo `/security-review`.

Se a onda precisar cortar, o commit 7 (T-29) sai sozinho sem quebrar os outros.

### 8.3 Riscos

- **O T-05 muda um padrão antigo.** "A dona abre em Jogo" vale hoje para toda ficha, e os testes, o Maestro `02` e a pessoa que joga com a ficha ainda em criação livre se apoiam nisso. Quem joga com a ficha em criação livre passa a abrir em Editar, com "Editando · 0 alterações", e troca para Jogo com um toque. É o que a matriz pede ("enquanto a ficha está em criação"). Na crônica livre, a ficha fica em criação até o narrador concluir.
- **Lotes de freeze antigos.** Os já gravados continuam com o `from` nulo e aparecem como hoje (pergunta 1).
- **Paginação do Histórico com duas fontes.** O item da conclusão entra pelo intervalo da página. Os testes de `limit=2` (§4) cobrem a borda. Se o `created_at` do lote e o do registro divergirem (não divergem: é o mesmo `now`), o item só muda de página, sem duplicar.
- **Conclusão pelo menu mais estrita.** Com a ficha em cache velha, o narrador recebe 409 e conclui de novo depois da rebusca. É o mesmo cuidado que a barra já tem.
- **Toast no Android** (QAA-24): só a conferência no AVD diz se aparece depois da folha (§3.4).

### 8.4 Conflitos com os pacotes da onda

| Arquivo | Pacotes | Onde cada um mexe | Como resolver |
|---|---|---|---|
| `apps/frontend/sheet/SheetScreen.tsx` | P04-C, P08 | P04-C: `openingMode` ao lado de `defaultMode` (`:250-270`), store inicial (`:304-328`), troca de estado (`:362-378`) e as props novas do `StatusMenuButton` (`:180-188`). P08: o cabeçalho (`AppBar`, `:169-208`: T-11, "Experiência" e "Histórico" no ⋯ em tela estreita, lugar reservado para o selo do P04-D), as abas fixas (T-27) e o contador do retrato (T-64) | **Médio**, no trecho `:180-188`. P04-C entra antes, e o P08 refaz o cabeçalho já com `revision`, `sheetVersion` e `unsaved` no `StatusMenuButton`. O cabeçalho do P08 precisa caber o "N alterações não salvas" do T-17 e os alvos de 48 dp do T-70 (onda 1) |
| `apps/frontend/sheet/storyteller/StatusMenu.tsx` | P04-C, P08 (provável) | P04-C: `confirm` na ação `complete` (`:73-82`), a chamada pelo hook (`:100-116`, `:211-232`) e o aviso de alterações não salvas na folha (`:234-257`). P08: se o T-11 levar "Experiência" e "Histórico" para o menu ⋯ do narrador | **Médio**. P04-C antes. Se o P08 juntar as ações do cabeçalho num menu só, ele mantém a confirmação do `complete` |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | P04-C, P05-C, P08 | P04-C: o corpo da confirmação de conclusão no `SummarySheet` (`:390-397`) e o espaço `notes`. P05-C: T-18, "Sobram N pontos de bônus" na mesma confirmação, e a linha da barra. P08: T-27 (barra e abas fixas) | **Médio** com o P05-C, no mesmo trecho; baixo com o P08. P04-C antes; o P05-C preenche `notes` em vez de editar o texto |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | P04-C, P05-C | P04-C: separa o banner da devolução de `CreationAlerts` (`:134-161`), o toast de `useFinishCreation` (`:104-110`) e a confirmação do "Aprovar ficha" (`:347-361`). P05-C: a recusa que fica em `CreationAlerts` (T-20, T-55), "A conta fechou" (`:226-230`, T-18) e o extrato no Orçamento (R-17) | **Médio**. P04-C antes. Depois dele, `CreationAlerts` só tem a recusa, que é do P05-C. Nenhum dos dois mexe no formulário de devolução do P03-C (`:306-317`, `:375-409`) |
| `apps/frontend/sheet/SheetView.tsx` | P04-C, P08 | P04-C: `:178-179` (onde o banner é montado). P08: T-59 ("Em jogo" recolhido em Criação, `:191-200`) e T-27/T-28 (abas fixas, colunas) | Baixo: trechos vizinhos, não os mesmos |
| `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx` | P04-C, P05-C, P08 | P04-C: o texto de topo (`:87-91`) e a leitura de `chronicle.data.creation`. P05-C: T-21 ("Criar ficha" rola e foca o erro; pode pôr um `ref` no `ScrollView` de `:83-86`). P08: T-26 (teclado; o `KeyboardAvoidingView` de `:135-138` só age no iOS) | **Médio** com o P05-C, porque são linhas vizinhas. P04-C antes, e o P05-C faz rebase. A ordem da onda 1 no `onSuccess` (`:108-117`) não muda |
| `apps/frontend/sheet/CharacterForm.tsx` | P05-C | O P04-C **não edita** | — |
| `apps/frontend/components/chronicles/CharacterList.tsx` | P04-C (depois o P04-D) | P04-C: `returned`, `characterStateText`, o `useRefetchOnFocus` e a linha do resumo | Nenhum conflito na onda 2. O P04-D estende `characterState.ts` |
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` | P04-C, P08 | P04-C: a prop `creation` no `CharacterList` (`:249-253`). P08: T-67, margens dos títulos da crônica (perto de `:255` em diante) | Baixo |
| `apps/frontend/components/chronicles/CreationSettings.tsx` | P04-C (depois o P09-D) | P04-C: o `meta` das quatro opções (`:120-123`, `:156-159`) | Nenhum na onda 2. O P09-D (D-10) recolhe o painel por cima, na onda 5 |
| `apps/frontend/lib/queries/focus.ts` | P04-C | O foco da janela no web | O P08 não toca. Vale também para a Mesa (`TableView.tsx:145`) |
| `apps/api/src/sheets/*` | P04-C | Só o P04-C muda a API na onda 2 | — |
| `e2e/tests/*` (`play`, `sheet`, `dice`, `offline`, `table`, `a11y-keyboard`, `evolve`, `journey-storyteller`) e `e2e/support/users.ts` | P04-C, P08 (seletores do cabeçalho) | P04-C: `completeCreation` e o modo de abertura. P08: seletores de "Histórico" e "Experiência" se forem para o ⋯ (`journey.spec.ts:223`, `:236`; `table.spec.ts:104`, `:116`; `journey-backstage.spec.ts:297`) | Baixo. Na integração, o E2E roda inteiro depois do P08 |

**Acordos para os outros pacotes da onda:**

- **P05-C:** usa `completionCopy` e o espaço `notes` para o T-18. Se quiser o saldo de bônus na confirmação do menu do narrador, sobe o número pelo mesmo caminho do `unsaved`: `onUnsaved` do `LiveSheet` (`SheetScreen.tsx:336-344`) vira `onDraftState({ unsaved, freebiesLeft })`.
- **P08:** o cabeçalho reserva o lugar do selo do P04-D. O P04-C não põe selo no cabeçalho; só ajusta as props do `StatusMenuButton`. Abaixo de 900, o P08 leva "Ações do narrador" e "Histórico" para o "Mais opções". Por isso ele ajusta, no rebase, os seletores do `lifecycle.spec.ts` a 390 ([onda-2.md](onda-2.md) §4.5).
- **P07-C:** nenhum arquivo em comum.

**Depois da onda:**

- O P04-D estende `characterState.ts`, o `NarratorReasonBanner` e o Histórico (outros eventos de estado).
- O P09-C (onda 3) depende do P04-C e encontra a confirmação do "Aprovar ficha" e a lista com `returned`.
- O P09-D reaproveita o `creationSummary`.
- O P03-D (D-01) mexe nos rótulos da barra por cima do `completionCopy`.

### 8.5 Arquivos tocados

| Arquivo | Itens | Tipo de mudança |
|---|---|---|
| `apps/api/src/sheets/creation.ts` | T-80 | alterado (`freeze` com `from_value` igual ao `to_value`, `:229-237`) |
| `apps/api/src/sheets/events.ts` | T-80 | alterado (Histórico: filtro sem mudança e itens de conclusão, `:346-491`) |
| `apps/api/src/sheets/routes.ts` | T-06 | alterado (lista: `ch.creation` e `returned`, `:333-348`, `:408-424`) |
| `apps/frontend/sheet/SheetScreen.tsx` | T-05, T-32 | alterado (`openingMode`, store inicial, troca de estado, props do menu) |
| `apps/frontend/app/(app)/characters/[id].tsx` | T-05 | alterado (só comentário) |
| `apps/frontend/sheet/SheetView.tsx` | T-06 | alterado (`ReturnedBanner` em qualquer modo) |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | T-06, T-32 | alterado (banner separado, toast e confirmação do "Aprovar ficha") |
| `apps/frontend/sheet/creation/ReturnedBanner.tsx` | T-06 | novo (`ReturnedBanner` e `NarratorReasonBanner`) |
| `apps/frontend/sheet/creation/completion.ts` | T-32 | novo (`completionCopy`) |
| `apps/frontend/sheet/creation/summary.ts` | T-29 | novo (`creationSummary`) |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | T-32 | alterado (corpo da confirmação e `notes`) |
| `apps/frontend/sheet/storyteller/StatusMenu.tsx` | T-32 | alterado (confirmação, hook, alterações não salvas, 409) |
| `apps/frontend/sheet/data.ts` | T-06 | alterado (`refetchInterval` em `pending`) |
| `apps/frontend/sheet/history/HistorySheet.tsx` | T-80 | alterado (item "Criação concluída") |
| `apps/frontend/lib/queries/focus.ts` | T-06 | alterado (foco da janela no web) |
| `apps/frontend/lib/queries/creation.ts` | T-06 | alterado (`useRefresh` invalida a lista) |
| `apps/frontend/components/chronicles/CharacterList.tsx` | T-06, T-29 | alterado |
| `apps/frontend/components/chronicles/characterState.ts` | T-06 | novo (`characterStateText`) |
| `apps/frontend/components/chronicles/CreationSettings.tsx` | T-29 | alterado (`meta` das opções) |
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` | T-29 | alterado (prop `creation`) |
| `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx` | T-29 | alterado (texto de topo) |
| `apps/api/src/__tests__/creation.test.ts` | T-06, T-80 | teste alterado |
| `apps/api/src/__tests__/events.test.ts` | T-80 | teste alterado |
| `apps/frontend/sheet/__tests__/SheetScreen.test.tsx` | T-05, T-06 | teste alterado (fixture e casos novos) |
| `apps/frontend/sheet/__tests__/LiveSheet.test.tsx` | T-05 | teste alterado |
| `apps/frontend/sheet/__tests__/policy.test.tsx` | T-32 | teste alterado |
| `apps/frontend/sheet/__tests__/storyteller.test.tsx` | T-80 | teste alterado |
| `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | T-06, T-32 | teste alterado |
| `apps/frontend/sheet/creation/__tests__/completion.test.ts` | T-32 | teste novo |
| `apps/frontend/sheet/creation/__tests__/summary.test.ts` | T-29 | teste novo |
| `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx` | T-32 | teste alterado |
| `apps/frontend/sheet/evolve/__tests__/screen.test.tsx` | T-05 | teste alterado (se preciso) |
| `apps/frontend/lib/__tests__/focus.test.tsx` | T-06 | teste novo |
| `apps/frontend/app/__tests__/new-character.test.tsx` | T-29 | teste alterado |
| `apps/frontend/app/__tests__/chronicles.test.tsx` | T-06, T-29 | teste alterado |
| `apps/frontend/app/__tests__/character-route.test.tsx` | T-05 | teste alterado (comentário) |
| `apps/frontend/app/__tests__/table-alerts.test.tsx` | T-05 | teste alterado (se preciso) |
| `apps/frontend/components/chronicles/__tests__/CreationSettings.test.tsx` | T-29 | teste alterado |
| `e2e/tests/lifecycle.spec.ts` | T-05, T-06, T-32, T-80 | E2E novo |
| `e2e/support/users.ts` | T-05 | alterado (`completeCreation`) |
| `e2e/tests/play.spec.ts`, `sheet.spec.ts`, `dice.spec.ts`, `offline.spec.ts`, `table.spec.ts`, `a11y-keyboard.spec.ts`, `evolve.spec.ts`, `journey-storyteller.spec.ts` | T-05, T-32 | E2E alterados |
| `apps/frontend/.maestro/README.md` | T-05 | doc (`CHARACTER_ID` concluída) |
| `doc/plano-v4.md` | T-80 | doc (§3.4: o freeze guarda o "de" efetivo; o Histórico mostra a conclusão) |

## 9. Perguntas abertas (técnicas)

1. **Lotes de freeze já gravados.** Uma migration de dados reescreveria `from_value = to_value` nos lotes com o mesmo `created_at` de uma conclusão no `chronicle_audit` e com todos os eventos `from_absent` e `from` nulo. Isso limparia o Histórico antigo. Vale fazê-la? Depende de existir banco com fichas reais (onda-1 §7, pergunta 3). Sem ela, só as conclusões novas ficam limpas.
2. **Intervalo do polling em `pending`.** 30 s com a tela em primeiro plano está bom? A alternativa é só rebuscar no foco (janela e app), que não cobre a jogadora olhando a ficha enquanto o narrador decide (POA-35).
3. **Foco da janela no web.** Ouvir o `focus` da `window` só no `useRefetchOnFocus` (ficha e Mesa, como no plano) ou no `focusManager` global do TanStack? O global faz toda query velha rebuscar ao clicar na janela; o escopo do plano é menor.
4. **NPC em criação.** O narrador continua abrindo o próprio NPC `creating` em Leitura. O NPC nasce em criação livre e pode ficar assim em jogo; abrir sempre em Editar atrapalharia a mesa. Manter?
5. **Índice no `chronicle_audit`.** A consulta da conclusão filtra por `chronicle_id` (índice existente) e depois por ficha e ação. Com crônicas de registro longo, vale um índice parcial em `(target_character_id) where action in (…)`? Seria a única migration do pacote; por isso o plano não a inclui.
6. **Alterações não salvas e conclusão pelo menu.** O plano desabilita "Concluir criação" e pede para salvar antes. "Salvar e concluir" no menu seria ação nova (D-01). Confirmar que desabilitar basta até o P03-D.
7. **Resumo da crônica para o jogador.** A linha do `creationSummary` sob "Suas fichas" cabe a 360 dp sem quebrar mal com os orçamentos do Mago e do Lobisomem? Conferir no AVD. Se não couber, a linha encurta (por exemplo, só "Por pontos · 15 de bônus · ver na Nova ficha"), sem mudar o que a Nova ficha mostra.

Pontos para o PO (não decididos aqui): a aba lembrada da R-02 e o nome único da etapa do T-29 (§2).
