# P11 · Bastidores e NPC: plano de implementação

> Plano · 2026-11-02 · base conferida: `onda/3-estado-narrador` em `617264d`

Este plano corrige o pacote [P11 da matriz de achados](../testes/2026-11-01/matriz-achados.md#p11), da onda 3:

- a ficha revelada do NPC abre inteira no iOS e no Android;
- a data da sessão aparece como data civil em pt-BR, e a edição da sessão salva;
- revelar o NPC pede confirmação, e o toast aparece depois;
- a lista e a Mesa dizem o que é NPC e qual é a visibilidade dele;
- a proposta de narrar aparece para quem a recebeu, no topo da crônica e na lista de crônicas;
- a auditoria vira frase, com a ficha alvo e o que mudou;
- o "‹" do NPC revelado volta para a crônica;
- a lista de crônicas mostra a última sessão.

É um pacote de correção. Ele não remove campo, não muda regra do jogo e não afrouxa limite. O servidor continua a autoridade: visibilidade, transferência, sessões e auditoria são validadas e filtradas por papel na API, como hoje. Revelar continua irreversível para quem já viu, e a confirmação nova diz isso. A proposta de narrar sai da aba Diário e vai para o topo da crônica, com as mesmas ações. **Três respostas da API mudam e a auditoria ganha duas ações: o pacote passa por `/security-review`** (seção 5).

Todas as linhas citadas são do `617264d`. A matriz cita o `1db3db9`, de antes das ondas 1 e 2. Onde a causa provável da matriz está errada ou só suposta, a seção 3 diz.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md): "Como executar", "Decisões de produto" e §P11 | Itens, "PR local" e critério de saída da onda |
| [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) §4 (T-15, T-16, T-46, T-52, T-63, T-81) e §7 (T-15, T-16) | Achados e recomendações |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §5 (POA-40) e §8 (plano v5 §1.2, §1.5, §1.6 e P2: sessão, auditoria, transferência) | Aderência ao plano v5 e U-03, U-04 |
| Notas: [po-app](../testes/2026-11-01/notas/po-app.md) (POA-25, POA-31, POA-32, POA-33, POA-38, POA-40, POA-41), [po-web](../testes/2026-11-01/notas/po-web.md) (POW-06, POW-13, POW-15, POW-16, POW-30), [qa-web](../testes/2026-11-01/notas/qa-web.md) (QAW-30), [qa-app](../testes/2026-11-01/notas/qa-app.md) (QAA-11, QAA-25, QAA-26), [narrador-web](../testes/2026-11-01/notas/narrador-web.md) (NW-15), [narrador-app](../testes/2026-11-01/notas/narrador-app.md) (NA-13) | Cenários do critério de pronto |
| [plano-v5.md](../plano-v5.md) §1 (jornada), §3.1, §3.4, §3.5, §3.6 e Etapa 10; [validacao-v5.md](../validacao-v5.md) l.29 e l.154–156 | NPC, projeções, transferência, sessões, auditoria e o "cache já visto" |
| [onda-1.md](onda-1.md) §9; [onda-2.md](onda-2.md) §4.4, §4.7 e §10; [P02](P02-seguranca-sessao-api.md) §3.5 (T-47) e §10; [P04-C](P04-C-ciclo-vida-ficha.md) §2 e §10; [P08](P08-layout-teclado.md) §3.10, §3.12 e §10 | O que as ondas 1 e 2 entregaram e as lições da integração |

## 1. Objetivo e itens

**Objetivo (matriz).** A ficha revelada do NPC abre no iOS; revelar pede confirmação e o sigilo aparece em selo; as datas de sessão saem certas; a auditoria fica legível; e a proposta de transferência é fácil de achar.

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| T-15 | alta | O jogador abre o NPC com a "Ficha" revelada e, no iOS, vê só o aviso de Leitura, sem nada abaixo | `apps/frontend/sheet/SheetScreen.tsx:161-178` (o caso `viewer` num `View` sem estilo); `apps/frontend/sheet/SheetView.tsx:332`, `:346-359`, `:420`; `packages/ui/src/keyboard.tsx:88` |
| T-16 | alta | A data da sessão sai como "Sat Oct 31 2026 21:00:00 GMT-0300", e a edição volta 400 | `apps/frontend/lib/api.ts:9-11` (Eden com `parseDate` ligado, o padrão); `apps/frontend/components/chronicles/CampaignBackstage.tsx:150` (exibição) e `:198` (edição); a API já está certa (`apps/api/src/chronicles/backstage.ts:134-153`) |
| T-46 | média | "Identidade" e "Ficha" revelam com um toque, sem confirmação nem toast | `apps/frontend/sheet/SheetScreen.tsx:650-680` (`Choice` → `mutate`); `apps/frontend/lib/queries/chronicles.ts:180-205` |
| T-52 | média | O NPC aparece como "Sua ficha", sem visibilidade; na Mesa vem misturado aos PCs | `apps/frontend/components/chronicles/CharacterList.tsx:88-95`, `:111`; `apps/frontend/components/chronicles/tableItems.ts:15-26`, `:58-86`; `apps/frontend/components/chronicles/TableView.tsx:149-162`, `:299-307`; `apps/frontend/components/chronicles/TableRow.tsx:60-67`, `:107-130` |
| U-03 | média | A proposta de narrar só aparece na aba Diário | `apps/frontend/components/chronicles/CampaignBackstage.tsx:110-116`, `:489-520`; `apps/frontend/app/(app)/index.tsx:70-87`; `apps/api/src/chronicles/routes.ts:271-346` |
| T-63 | baixa | A auditoria lista códigos internos, sem a ficha alvo nem o que mudou; a criação da crônica e do convite não aparecem | `apps/frontend/components/chronicles/CampaignBackstage.tsx:582-589`; `apps/api/src/chronicles/backstage.ts:806-968`; `apps/api/src/audit.ts:9-39`; `apps/api/src/chronicles/routes.ts:136-260` (criação da crônica) e `:483-521` (convite) |
| T-81 | baixa | O "‹" do NPC com a identidade revelada volta para Crônicas | `apps/frontend/sheet/SheetScreen.tsx:125-134`; `apps/api/src/sheets/routes.ts:498-505` (a projeção de identidade não traz a crônica) |
| U-04 | baixa | A lista de crônicas não mostra a última sessão | `apps/api/src/chronicles/routes.ts:271-346` (a lista não tem o campo; o detalhe tem, `:402-433`); `apps/frontend/app/(app)/index.tsx:74-84` |

## 2. Decisões aplicadas

**O P11 não tem decisão de produto própria** (coluna "Decisões" vazia na matriz). Nenhuma das D-01 a D-04 é implementada aqui. O que encosta no pacote:

| Decisão | Pacote | Como o P11 a acomoda |
|---|---|---|
| D-02 (estados da ficha, "sob o nome, na lista, na aba Fichas e na Mesa") | P04-D | O selo é um componente só, do P04-D (nome provisório `StateBadge`). O P11 o usa para a visibilidade do NPC, sempre com texto. A regra pura fica em `components/chronicles/characterState.ts`: o P04-D a estende com os estados, e o P11 acrescenta `npcVisibilityText` (seção 3.4) |
| D-03 e D-04 ("Avisar que terminei" e "Pedir ajuste", com evento no Histórico) | P04-D | O P04-D acrescenta ações ao `AuditAction` (`apps/api/src/audit.ts:9-39`). O mapa de frases do P11 é exaustivo sobre esse tipo (seção 3.6): no rebase sobre o P04-D, o typecheck pede as frases das ações novas, e o P11 as escreve, sem o motivo |
| D-10 (progresso na Mesa) | P09-D, onda 5 | Fora daqui. A seção "NPCs" da Mesa é só estrutura (seção 3.4) e não toca no cartão |
| D-14 (convite por link) | P12, onda 5 | O registro `invite.create` nunca guarda o código nem o hash. Serve igual ao link com o código no fragmento |

**Pontos para o PO das ondas 1 e 2** ([onda-1.md](onda-1.md) §6, [onda-2.md](onda-2.md) §6): continuam abertos, e nenhum toca o P11.

**Onde o código mostra a matriz diferente** (sem decidir produto):

- **U-04:** a matriz diz que "a API já devolve `lastSession`", e isso só vale para o detalhe da crônica (`routes.ts:402-433`). A lista (`:271-346`) não tem o campo, então a correção muda a API (seção 3.8).
- **T-63, "registrar a criação da crônica e do convite":** vale só daqui para a frente. As crônicas e os convites que já existem não ganham registro retroativo.
- **T-15, "cobrir com um fluxo nativo (Maestro)":** o Maestro não está instalado nesta máquina (onda-1 §9). A cobertura nativa fica no roteiro da seção 11, com o `idb`, e o Jest confere o estilo do contêiner (seção 4.1).

## 3. Desenho por item

### 3.0 O que o código e as plataformas fazem hoje (explica as causas)

- **O cliente Eden transforma texto em `Date`.** O `treaty` do `@elysiajs/eden` 1.4.9 lê toda resposta JSON com um reviver (`node_modules/@elysiajs/eden/dist/chunk-TTKI5TQ7.mjs`, `case"application/json"`). Cada valor de texto passa pelo `parseStringifiedDate` (`dist/chunk-I5KHAGLL.mjs`), que testa três padrões:
  - ISO com hora;
  - o `toString()` do JavaScript;
  - um padrão ancorado de data, `AAAA-MM-DD` ou `dd/mm/aaaa`, com hora opcional.

  Se o texto casa com um deles e vira uma data válida, ele é trocado por `new Date(texto)`. O app cria o cliente sem opção (`apps/frontend/lib/api.ts:9-11`), e o `parseDate` fica ligado.
  - `"2026-11-01"` vira meia-noite UTC, que em Brasília é 31/10 às 21:00. É o texto do T-16.
  - Qualquer texto livre da resposta com essa forma também vira `Date`: o título de uma sessão "01/11/2026", o nome de uma crônica ou um campo de texto da ficha "12/10/1990". Isso não foi visto no teste, foi lido no código.
  - **O Jest não pega:** o Eden é mockado no `test/setup.ts:48-50`, e as telas usam o `fake-api`. O cache persistido também não: ele volta do disco por `JSON.parse` sem reviver (`apps/frontend/lib/persist.tsx:197-199`), então o app **já recebe texto** nas datas de toda ficha restaurada.
- **Yoga × CSS no `flex: 1`.** No nativo, `flex: 1` é `flexGrow 1, flexShrink 1, flexBasis 0`. Num pai de altura automática (sem `flex`), a altura do pai é a soma das bases dos filhos, e o filho com `flex: 1` fica com 0. No react-native-web, a base vira porcentagem, e o CSS trata uma porcentagem num contêiner de altura indefinida como `content`: o filho fica com a altura do conteúdo. Por isso a mesma tela abre inteira no web (`img/po-web/102-jogador-npc-ficha-completa-1280.webp`) e vazia no iOS.
- **Projeções do NPC** (`apps/api/src/sheets/routes.ts:498-527`):
  - a de identidade manda `projection`, `id`, `kind`, `visibility` e `identity`, **sem a crônica**;
  - a do `viewer` manda a crônica (`:517`).

  O `SheetScreen` só monta o "‹" com a crônica nos casos `ready` e `viewer` (`:125-134`).
- **A lista da crônica já separa os NPCs** numa seção "NPCs" (`CharacterList.tsx:250-273`). O texto "Sua ficha" vem de `row.mine`, porque o `user_id` do NPC é o narrador (`:88-92`). A visibilidade já vem na linha (`FullRow.visibility`, `:46`), mas não aparece.
- **A Mesa já recebe `kind` e `visibility`** (`apps/api/src/chronicles/table.ts:71-72`, `:87-88`). O `TableRowData` não declara esses campos (`tableItems.ts:15-26`), e a Mesa desenha tudo num array só (`TableView.tsx:155-162`, `:299`).
- **Transferência.** O `GET /chronicles/:id/transfer` devolve a última transferência só para o narrador ou o destinatário, com `available` (`backstage.ts:638-686`). O app mostra "Convite para narrar" só dentro do Diário do jogador (`CampaignBackstage.tsx:110-116`). A lista de crônicas não sabe da proposta.
- **Auditoria.** A rota une os lotes de ficha (`source: 'batch'`) e o `chronicle_audit` (`source: 'audit'`) (`backstage.ts:806-968`). O `action` do lote é o `kind` da operação ou `'sheet.change'` (`:919`), e o do registro é a ação (`:936`). Os dois saem como `string`, sem o nome da ficha nem o `payload`. O app mostra o código e `new Date(item.at).toLocaleString()` (`CampaignBackstage.tsx:582-589`).
- **Cache persistido.** Vão para o disco só templates e fichas `['characters', id]` com papel `owner` ou `storyteller` (`persist.tsx:63-77`, `:87-108`):
  - as projeções de `viewer` e de identidade nunca vão para o disco;
  - sessões, transferência, auditoria e listas também não;
  - o NPC do narrador vai, com a `visibility` do momento. Ao restaurar, ele abre com a visibilidade antiga até a rebusca (`:262-270`). É o mesmo padrão que o c7c1423 corrigiu na onda 2 para o modo de abertura (seção 3.3).

### 3.1 T-15 · A ficha revelada do NPC ocupa a tela no nativo

**Causa.** A causa suposta se confirma na leitura, pelo Yoga (seção 3.0). O caso `viewer` monta o aviso de Leitura e a `SheetView` dentro de um `View` sem estilo (`SheetScreen.tsx:162-177`). A raiz da `SheetView` é um `View` com `flex: 1` (`SheetView.tsx:332`, `:420`), com a `KeyboardArea` (`flex: 1`, `keyboard.tsx:88`) e o `ScrollView` dentro. No pai sem `flex`, a ficha fica com altura 0, e sobra só o aviso. O Android usa o mesmo Yoga, então deve falhar igual: ele não foi testado pelas personas. ⚙ Só o simulador e o AVD confirmam.

**O que muda.** O contêiner do caso `viewer` ganha `style={styles.viewer}` (`{ flex: 1 }`) e `testID="viewer-sheet"`. O aviso de Leitura fica fixo em cima, e a ficha rola embaixo. Nada mais muda:

- a projeção é a mesma;
- os modos são os mesmos;
- continua sem "Mais opções", sem "Histórico" e sem "Experiência" (`sheet.layout.test.tsx:343`).

O caso `identity` (`IdentityProjection`, `:581-606`) só tem textos fixos, sem filho com `flex`, e não muda.

**Teste.** O Jest não faz layout: ele confere o estilo (seção 4.1), e isso prova a causa, não a tela. A tela só se prova no aparelho, e a seção 11 deixa o iOS obrigatório.

### 3.2 T-16 · Data civil de ponta a ponta

**Causa.** A causa suposta se confirma na leitura:

- a API devolve `AAAA-MM-DD` desde a validação da v5 (`backstage.ts:134-153`; `validacao-v5.md` l.29);
- o Eden transforma o texto em `Date` (seção 3.0);
- a tela mostra `String(session.date)` (`CampaignBackstage.tsx:150`), que é o "Sat Oct 31 …";
- a edição reenvia `date: String(session.date)` (`:198`), e o padrão `^\d{4}-\d{2}-\d{2}$` da API (`backstage.ts:411`) recusa com 400 `VALIDATION`.

**No web a edição também falha:** o QA-W e o PO-W viram só a exibição. A "correção" da `validacao-v5.md` era só do servidor.

**O que muda, em duas camadas:**

1. **Cliente (a causa).** `treaty<App>(API_URL, { fetcher, parseDate: false })`, em `apps/frontend/lib/api.ts:9-11`. Todo campo da API chega como texto, como já chega do cache persistido.
   - Conferido com grep, o app nunca chama método de `Date` sobre dado da API. Ele usa:
     - `new Date(x)` (`tableItems.ts:103-104`, `CampaignBackstage.tsx:587`);
     - `shortDate` e `whenLabel` (`lib/format.ts`, que aceitam `string | Date`);
     - ou `String(x)` (`sheet/creation/creation.ts:57`).
   - O tipo inferido pelo Eden continua dizendo `Date` nas colunas `timestamptz`. O código já trata `string | Date` (`TableRowData`, `tableItems.ts:23-24`), e o risco está na seção 8.3.
2. **Formatação.** `civilDate(value: string, { year = true } = {})` vai em `apps/frontend/lib/format.ts`:
   - ela aceita só `^\d{4}-\d{2}-\d{2}$` e devolve `dd/mm/aaaa`, ou `dd/mm` com `year: false`;
   - ela corta o texto e não usa `Date`, então nenhum fuso entra;
   - fora do padrão, devolve `null`, e a tela omite a data em vez de inventar uma (fail secure).

   O `SessionEntry` mostra `civilDate(session.date)` (`:150`) e reenvia `session.date` como recebeu (`:198`). O formulário de registro não muda: o campo "Data" continua em `AAAA-MM-DD`, com o dia local de hoje (`:222-226`).

**Contrato 7 da consolidação: duas funções, não uma.**

- `civilDate` é para colunas `date` (a sessão): o dia é o mesmo para todo mundo.
- `shortDate` e `whenLabel` (já existentes, `format.ts:4-20`) são para instantes (`timestamptz`: `creation_completed_at`, `updated_at`): convertem para o fuso de quem vê. É o certo para o "Concluída em dd/mm" do P04-D, que é o dia da conclusão no relógio do leitor, como o T-47 da onda 1 (P02 §3.5: o app já formata no fuso de quem vê).

Um comentário em `format.ts` diz que `shortDate` nunca recebe data civil: meia-noite UTC volta um dia no Brasil.

**Fora da matriz, achado na leitura:** o filtro "Desde/Até (AAAA-MM-DD)" da auditoria monta os limites em UTC (`CampaignBackstage.tsx:527-531`, `…T00:00:00.000Z`). Em Brasília, "Desde 2026-11-01" começa às 21:00 de 31/10. Fica como pergunta 7.

### 3.3 T-46 · Confirmar antes de revelar; toast depois

**Hoje.** O `Choice` "Visibilidade do NPC" chama o `mutate` direto no `onChange` (`SheetScreen.tsx:650-680`), sem toast. O `useSetNpcVisibility` rebusca a ficha, a lista da crônica e a lista de crônicas, mas não a Mesa (`chronicles.ts:192-205`).

**O que muda** (componente novo `apps/frontend/sheet/storyteller/RevealNpcSheet.tsx`, usado pelo `NpcVisibilityBar`):

- **Ordem de sigilo:** `hidden` < `identity` < `full`. Subir (revelar mais) abre a confirmação. Descer (`full → identity`, qualquer → `hidden`) envia direto, como pede a matriz.
- **O rádio não muda antes da resposta.** O `value` continua sendo `character.visibility` (controlado), então cancelar não deixa o rádio no meio do caminho.
- **Textos** (o nome do NPC vem de `character.name`):

  | Para | Título | Corpo | Botão |
  |---|---|---|---|
  | `identity` | "Revelar a identidade para os jogadores?" | "Os jogadores passam a ver o nome, o selo, o subtítulo e o retrato de {NPC}. Quem já viu continua sabendo, mesmo que você volte a Oculto." | "Revelar identidade" |
  | `full` | "Revelar a ficha para os jogadores?" | "Os jogadores passam a abrir uma cópia só de leitura de {NPC}, sem as Notas do Narrador. Quem já viu continua sabendo, mesmo que você volte a Oculto." | "Revelar ficha" |

  O secundário é "Cancelar".
- **Enviar.**
  - O botão fica `busy` durante a mutação, com a mesma chave (`visibilityCommand`, `:622-675`) no reenvio.
  - Erro e 409 (revisão velha, inclusive do cache restaurado) aparecem dentro da folha, com `messageOf`.
  - No sucesso, a folha fecha. O toast sai no `onClosed`, depois da animação de saída, para não ficar atrás do `Modal`. É a lição do QAA-24 no P04-C.
- **Toasts** (`useToast`, duração padrão):
  - "Identidade revelada aos jogadores.";
  - "Ficha revelada aos jogadores, só leitura.";
  - na descida, "Agora os jogadores veem só a identidade. Quem já abriu a ficha continua sabendo." ou "{NPC} voltou a ficar oculto. Quem já viu continua sabendo."
- **Teclado.** O `Choice` mantém a ativação manual (`:647-649`): a seta não revela. Espaço e Enter abrem a confirmação, não a revelação.
- **Mesa.** O `useSetNpcVisibility` passa a invalidar também `chronicleKeys.table(chronicleId)`, para o selo do T-52 na Mesa.

**A `BottomSheet` não muda** (contrato 8). A folha herda:

- o Esc na captura, inclusive sem campo em autoFocus (`f3f3b8a`). Ele fecha como "Cancelar", sem enviar;
- o foco de volta ao rádio que abriu a folha;
- o diálogo central de 560 a partir de 600 px (T-69);
- o `onClosed`, que leva o toast para depois da saída;
- o voltar do Android, que fecha sem revelar.

**Cache persistido (contrato 10).** O NPC do narrador pode abrir do disco com a visibilidade antiga. Até a rebusca, o rádio mostra o valor velho. A troca feita sobre ele leva a `visibilityRevision` velha, e o servidor recusa com 409 (`sheets/routes.ts:575-660`). A folha mostra o erro, e a ficha rebusca. Nada é revelado sobre dado velho.

### 3.4 T-52 · Visibilidade do NPC na lista e seção "NPCs" na Mesa

**Regra (pura).** `npcVisibilityText(visibility)` em `components/chronicles/characterState.ts`. Ela devolve "Oculto", "Identidade revelada" ou "Ficha revelada", e `null` sem valor. O rádio diz "Oculto/Identidade/Ficha" sob o rótulo "Visibilidade do NPC". Sozinho, numa linha, "Identidade" ficaria ambíguo, por isso o selo usa a forma longa. O formato do retorno segue o que o P04-D definir para `characterStateText` (texto e tom). Se o formato dele for outro, o P11 se ajusta no rebase.

**Lista da crônica** (`CharacterList.tsx`):

- para `row.kind === 'npc'` com `narrating`, o dono passa de "Sua ficha" (`:88-92`) para "NPC", e a visibilidade aparece no selo do P04-D (`StateBadge`), ao lado do estado da ficha dele se o P04-D mostrar estado de NPC (seção 8.4);
- o jogador continua com "NPC revelado" (`:89`) e **nunca vê o selo de visibilidade**. A regra só o desenha com `narrating`, e a lista do jogador só recebe a projeção de identidade (`sheets/routes.ts:415-423`);
- **sem o P04-D** (se ele atrasar), o P11 põe o texto no `meta` do `ListItem`, como o P04-C fez com "Devolvida": "Tremere · NPC · Oculto" (`:111`).

**Mesa:**

- `TableRowData` (`tableItems.ts:15-26`) ganha `kind?: 'pc' | 'npc'` e `visibility?: 'hidden' | 'identity' | 'full'`. A API já manda os dois.
- `TableItem` (`:28-37`) ganha `visibility: string | null`, calculado em `buildItem` (`:58-86`).
- `TableView`:
  - separa `shown` (`:155-160`) em PCs e NPCs. Os NPCs vêm depois, sob um `SectionHeader` "NPCs" (cabeçalho com papel `header`), como pede o plano v5 §1.2;
  - a ordem que o `TableNav` lembra (`order.current`, `:162`) passa a ser a da tela, PCs e depois NPCs;
  - a seleção e as operações em grupo atravessam as duas seções, como hoje;
  - sem NPC, a seção não aparece. "Só com alerta" vale para as duas.
- `TableRow`: o selo de visibilidade vai ao lado do `state`, nos `badges` (`:107-130`), e entra no nome acessível da linha (`label`, `:60-67`). A linha é um alvo só (WCAG 2.5.3).

O dono "alterada por" do cartão (`:43`) é do P09-C (T-83). O P11 não toca nessa linha.

### 3.5 U-03 · A proposta de narrar aparece para quem a recebeu

- **Componente novo `components/chronicles/TransferOffer.tsx`.** Ele sai do `AcceptTransfer` (`CampaignBackstage.tsx:489-520`): "Convite para narrar" e o texto "Ao aceitar, você assume NPCs, notas privadas e o histórico administrativo desta crônica.", com "Aceitar narração" e "Recusar". Vai dentro de um `Banner` (`tone="info"`, com `action`). Os hooks são os mesmos (`useAcceptTransfer`, `useRejectTransfer`) e as chaves de comando também.
- **Topo da crônica** (`app/(app)/chronicles/[id]/index.tsx`, logo depois do bloco `info`, `:98-107`). Com `c.role === 'player'` e `useTransfer(c.id).data?.available`, aparece o `TransferOffer`. É a mesma consulta que o Diário já faz (`CampaignBackstage.tsx:81`): mesma chave e nenhuma requisição a mais. **Ele sai do Diário** (`:110-116`), para não aparecer duas vezes na aba Diário. É a mesma ação, na mesma crônica, acima das abas.
- **Lista de crônicas** (`app/(app)/index.tsx`). A API passa a mandar `transferOffer: { id, expiresAt } | null` por crônica, só para o destinatário (seção 3.9).
  - O `ListHeaderComponent` (`:65-69`) mostra um `TransferOffer` por proposta, com o nome da crônica.
  - O `meta` do cartão (`:74-84`) termina em "· Convite para narrar".
- **Depois de recusar:** o `useTransferDecision` (`lib/queries/backstage.ts:129-147`) passa a invalidar também `chronicleKeys.all`, para o aviso sair da lista.
- **Depois de aceitar:** é do P09-C (T-40, item 4). Hoje o `useAcceptTransfer` faz `queryClient.clear()` (`:123-125`), e a tela segue com o convite. O P11 não muda esse hook; o P09-C muda, e a mudança vale para o `TransferOffer` nos dois lugares (seção 8.4).

### 3.6 T-63 · Auditoria em frases, com a ficha alvo e o que mudou

**O par "xp-grant"/"xp.grant" não é duplicata.** Conceder XP grava, na mesma transação (`apps/api/src/xp/ledger.ts:295-335`):

- uma operação `xp-grant`, com um lote por ficha, que entra na rota como `source: 'batch'` e `action: 'xp-grant'`;
- e um registro `xp.grant` com todas as fichas (`source: 'audit'`).

São dois registros do mesmo ato, e as frases os distinguem. O mesmo vale para `xp-spend` (lote) e `xp.request.approve` (registro).

**API** (`apps/api/src/chronicles/backstage.ts:806-968`, `audit.ts`):

- **`action` tipado.** O registro sai como `row.action as AuditAction` e o lote como `(row.operation_kind as OperationKind | null) ?? 'sheet.change'`. `OperationKind` é exportado de `apps/api/src/chronicles/operations.ts` com os sete valores do `chronicle_operations_kind_check` (`packages/db/src/migrations/0017_xp_ledger.ts:19-22`). O Eden infere a união, e o app a usa (abaixo).
- **Ficha alvo:** `character: { id, name } | null`.
  - O lote já tem o `inner join` da ficha (`:817`) e passa a selecionar `ch.name`.
  - O registro ganha `left join characters as tc on tc.id = a.target_character_id and tc.chronicle_id = a.chronicle_id`. A segunda condição impede que um alvo de outra crônica traga nome.
  - O nome é o atual. A ficha excluída aparece com o nome e "(excluída)".
- **Usuário alvo:** `user: { username } | null` (`left join users` em `target_user_id`), só nas ações de membro e de transferência. É o mesmo nome que o narrador vê em "Participantes".
- **Lote:** `byRole` (já selecionado, `:826`) passa a sair.
- **`detail`:** uma lista branca por ação, montada por `auditDetail(action, payload)`, função nova em `apps/api/src/chronicles/auditView.ts`. O `payload` cru continua fora da resposta.

  | Ação | `detail` |
  |---|---|
  | `character.status` | `{ from, to }`, só valores do `characters_status_check` |
  | `character.visibility` | `{ from, to }`: `hidden`, `identity` ou `full` |
  | `character.creation.complete` | `{ approved }` |
  | `chronicle.creation.settings` | `{ approval?, approvalFrom?, defaults }` (booleanos) |
  | `xp.grant` | `{ amount, characters }`: número e contagem, sem os ids |
  | `xp.adjust` | `{ delta }` |
  | `xp.request.approve` | `{ cost }` |
  | `member.remove`, `member.leave` | `{ characters }` (contagem) |
  | `invite.create` | `{ maxUses, expiresInDays }` |
  | as outras | `{}` |

  Os números gravados como texto (`String(body.amount)`, `ledger.ts:329`) são convertidos. Valor fora do esperado sai como ausente, nunca cru.
- **Registros novos** (`AuditAction` ganha duas ações; a coluna `action` é `text` sem `check`, `0014_character_status.ts:42`, então **não há migration**):
  - **`chronicle.create`** nos dois caminhos de `POST /chronicles` (`routes.ts:159-172` sem chave, `:189-221` com chave). O caminho sem chave passa a usar uma transação para gravar a crônica e o registro juntos. O `payload` é `{}`.
  - **`invite.create`** em `POST /chronicles/:id/invites` (`:483-521`). O insert e o registro ficam numa transação. O `payload` é `{ inviteId, maxUses, expiresInDays }`. **Nunca o `code` nem o `code_hash`**: o código só aparece na resposta, como hoje (`:509`).
- **`chronicle.creation.settings`** (`apps/api/src/sheets/creation.ts:405-414`) ganha `approvalFrom` (a `character_approval` lida antes, `:369-376`), para a frase "aprovação Desligada → Ligada" (NW-15, NA-13). Os números do orçamento ficam para a pergunta 6.

**App:**

- **Arquivo novo `components/chronicles/auditPhrase.ts`:** `PHRASES: Record<HistoryAction, (item) => string>`. O `HistoryAction` é o tipo do `action` da resposta, inferido pelo Eden. **Uma ação nova na API sem frase quebra o typecheck** (contrato 5). Um valor desconhecido em tempo de execução (registro antigo de ação que saiu) vira "Ação registrada": nunca o código.
- **Frases** (exemplos; `{ficha}` é `character.name`, `{usuário}` é `user.username`):

  | Código | Frase |
  |---|---|
  | `chronicle.create` | "Crônica criada" |
  | `invite.create` | "Convite gerado: até {maxUses} usos, vale {expiresInDays} dias" |
  | `chronicle.creation.settings` | "Regras da criação: aprovação Desligada → Ligada" ou "Regras da criação: orçamento padrão alterado" |
  | `chronicle.settings` | "Apresentação da crônica alterada" |
  | `character.create-npc` | "NPC {ficha} criado, oculto" |
  | `character.visibility` | "{ficha}: Oculto → Identidade revelada" |
  | `character.status` | "{ficha}: Em jogo → Arquivada" (rótulos genéricos: Em criação, Aguardando aprovação, Em jogo, Arquivada, Fora de jogo) |
  | `character.lock`, `character.unlock`, `character.delete` | "{ficha} travada", "{ficha} destravada", "{ficha} excluída" |
  | `character.creation.submit`, `approve`, `return`, `complete`, `update` | "{ficha} enviada para aprovação", "{ficha} aprovada", "{ficha} devolvida para correção" (sem o motivo; "ajuste" é o pedido novo do P04-D, [onda-3.md](onda-3.md) §4.4), "Criação de {ficha} concluída", "Escolhas da criação de {ficha} alteradas" |
  | `member.remove`, `member.leave` | "{usuário} removido da crônica ({n} fichas arquivadas)", "{usuário} saiu da crônica" |
  | `xp.grant`, `xp.adjust` | "{amount} XP concedidos a {n} fichas", "Ajuste de XP em {ficha}: {delta}" |
  | `xp.request.create`, `approve`, `reject`, `stale` | "Pedido de XP de {ficha}", "Pedido de XP de {ficha} aprovado (custo {cost})", "… recusado", "… venceu" |
  | `chronicle.session.create`, `update` | "Sessão registrada", "Sessão editada" |
  | `chronicle.transfer.request`, `accept`, `reject`, `cancel` | "Narração proposta a {usuário}", "Narração transferida", "Proposta de narração recusada", "Proposta de narração cancelada" |
  | lote `sheet.change` | "{ficha} alterada pelo dono" ou "… pelo narrador" (`byRole`) |
  | lote `damage`, `heal`, `recovery`, `revert` | "Dano em grupo: {ficha}", "Cura em grupo: {ficha}", "Recuperação: {ficha}", "Operação desfeita: {ficha}" |
  | lote `xp-grant`, `xp-adjust`, `xp-spend` | "XP lançado na ficha de {ficha}", "Ajuste de XP na ficha de {ficha}", "XP gasto: {ficha}" |

- **A linha da tela** (`CampaignBackstage.tsx:582-589`): `title` é a frase e `subtitle` é "{autor} · {whenLabel(at)}" ("Conta excluída" sem autor, como hoje). O `toLocaleString()` sem localidade sai.
- **Por que a frase fica no app, e não na API:** todo texto de interface em pt-BR mora no app (o "Criação concluída" do Histórico da ficha, P04-C §3.5; o `completionCopy`). A API continua estruturada (código, alvo e `detail`), e o `Record` exaustivo pelo tipo do Eden dá a mesma garantia de cobertura.

### 3.7 T-81 · O "‹" do NPC revelado volta para a crônica

**Causa.** A projeção de identidade não traz a crônica (`sheets/routes.ts:498-505`). Sem ela, o `SheetScreen` cai em `{ label: 'Crônicas', onPress: () => router.replace('/') }` (`:129-134`). A matriz não indicava a causa.

**O que muda:**

- **API:** a projeção de identidade ganha `chronicle: { id, name }`, igual à do `viewer` (`:517`). Quem a recebe é só membro atual da crônica com o NPC revelado (`apps/api/src/authz.ts:107-109`), e esse membro já vê a crônica (seção 5).
- **App:** `chronicle` (`SheetScreen.tsx:125-128`) passa a valer também no caso `identity`. O "‹" diz "Voltar para {crônica}" e faz o `replace` para a crônica, como nos outros casos.

### 3.8 U-04 · Última sessão na lista de crônicas

- **API** (`GET /chronicles`, `routes.ts:271-346`): uma subconsulta pega a maior `session_date` da crônica com `to_char(…, 'YYYY-MM-DD')`, o mesmo formato do `sessionDate` (`backstage.ts:137`). O índice `chronicle_sessions_recent_idx` (`0019_backstage.ts:147-149`) atende a consulta. Ela sai como `lastSession: 'AAAA-MM-DD' | null`, **só para narrador e membro**: o ex-membro recebe `null` (plano v5 §3.5).
- **App** (`app/(app)/index.tsx:74-84`): o `meta` ganha "· Última sessão: 01/11", com `civilDate(…, { year: false })`, como na matriz. O detalhe da crônica já tem `lastSession` e não muda nesta correção (pergunta 9).

### 3.9 API HTTP e cliente: o que muda

| Onde | Mudança | Compatibilidade |
|---|---|---|
| `GET /characters/:id`, projeção de identidade | `+ chronicle: { id, name }` | Aditivo. O `journey-backstage.spec.ts:252-254` confere a lista exata de chaves e passa a incluir `chronicle` |
| `GET /chronicles` | `+ lastSession: string \| null`; `+ transferOffer: { id, expiresAt } \| null` | Aditivo |
| `GET /chronicles/:id/history` | `action` tipado (mesmos valores); `+ character`, `+ user`, `+ detail`; `+ byRole` nos lotes | Aditivo. Os filtros, o cursor e a ordem não mudam |
| `chronicle_audit` | Ações `chronicle.create` e `invite.create`; `approvalFrom` no `payload` de `chronicle.creation.settings` | Sem migration. Os registros antigos ficam como estão, e a frase deles sai sem o "de → para" |
| Cliente `apps/frontend/lib/api.ts` | `parseDate: false` | Toda data chega como texto, como já chega do cache persistido. Nenhuma rota nova: a matriz de AuthZ (`apps/api/src/test/authz-matrix.ts`) não muda |

O `@tms/ui` não muda. `BottomSheet`, `Banner`, `ListItem`, `SectionHeader` e o toast são usados como estão. O selo é do P04-D.

## 4. Testes

### 4.1 Um teste de regressão por bug (falha antes, passa depois)

| Item | O que o teste prova | Arquivo | Tipo |
|---|---|---|---|
| T-16 | O `treaty` é criado com `parseDate: false` (o mock do `test/setup.ts` guarda a chamada). Com o Eden real (`jest.requireActual`) e um `fetch` falso que responde `{"date":"2026-11-01","title":"01/11/2026"}` em `application/json`, os dois continuam texto. Sem a opção, viram `Date`: o caso documenta a causa | `apps/frontend/lib/__tests__/api.test.ts` | Jest |
| T-16 | `civilDate('2026-11-01')` é "01/11/2026"; com `year: false`, é "01/11"; `'2026-13-01'`, `''` e `'2026-11-01T00:00:00Z'` dão `null`. Não usa `Date` (passa em qualquer fuso) | `apps/frontend/lib/__tests__/format.test.ts` (novo) | Jest |
| T-16 | A sessão `date: '2026-10-20'` aparece como "20/10/2026", e não "2026-10-20". Editar → "Salvar sessão" manda `date: '2026-10-20'` | `components/chronicles/__tests__/CampaignBackstage.test.tsx` (caso de `:130`) | Jest + RNTL |
| T-16 | Contexto com `timezoneId: 'America/Sao_Paulo'`, 390 × 844. O narrador registra a sessão "2026-11-01" pela tela e vê `getByText('01/11/2026')`. Em "Editar" → "Salvar sessão", `page.waitForResponse` do `PATCH …/sessions/…` dá 200, e `getByText('dados inválidos')` tem 0. O jogador, a 1280, vê "01/11/2026" na aba "Diário" (POW-13) | `e2e/tests/npc-backstage.spec.ts` (novo) | Playwright |
| U-04 | A lista traz `lastSession: '2026-11-01'` (texto, sem hora) para o narrador e o membro; `null` sem sessão e para o ex-membro; a maior data vence, com empate estável | `apps/api/src/__tests__/chronicles.test.ts` | API, PGLite |
| U-04 | O cartão diz "Última sessão: 01/11"; sem `lastSession`, nada | `apps/frontend/app/__tests__/chronicles.test.tsx` ("Crônicas (lista)", `:57`) | Jest + RNTL |
| U-03 | `transferOffer` vem só para o destinatário, com a proposta pendente e não vencida. O narrador, outro membro e o ex-membro recebem `null`. Depois de recusar, cancelar ou vencer, `null` | `apps/api/src/__tests__/backstage.test.ts` ("transferência: validade, decisões e autoridade", `:402`) | API, PGLite |
| U-03 | Na lista: o aviso com "Aceitar narração" e "Recusar", e o cartão com "Convite para narrar". No topo da crônica, para o jogador: o mesmo aviso, que não aparece mais no Diário. "Recusar" manda a chave e o aviso some | `app/__tests__/chronicles.test.tsx`; `CampaignBackstage.test.tsx` (`:465`) | Jest + RNTL |
| U-03 | O narrador propõe pela API. O destinatário, a 390, vê `getByRole('button', { name: 'Aceitar narração' })` na lista e na crônica, com uma ocorrência só na crônica. "Recusar" → os dois somem. O outro jogador nunca vê | `npc-backstage.spec.ts` | Playwright |
| T-15 | No caso `viewer`, `StyleSheet.flatten(getByTestId('viewer-sheet').props.style).flex === 1`. Isso prova a causa, não a tela: o Jest não faz layout | `apps/frontend/sheet/__tests__/SheetScreen.test.tsx` (bloco "redução da visibilidade", `:93`) | Jest + RNTL |
| T-15 | A 390, o jogador abre o NPC em "Ficha": `getByTestId('viewer-sheet')` tem `boundingBox().height` maior que 400, e a primeira aba da ficha está visível. Guarda o web, que já funciona | `npc-backstage.spec.ts` | Playwright |
| T-81 | A projeção de identidade traz `chronicle: { id, name }` da crônica do NPC, e a lista exata de chaves é `chronicle`, `id`, `identity`, `kind`, `projection` e `visibility`, sem `owner` nem `values`. Ex-membro e estranho continuam com 404 | `apps/api/src/__tests__/backstage.test.ts` ("NPCs e projeções", `:48`) | API, PGLite |
| T-81 | No caso `identity`, o voltar diz "Voltar para Crônica da Liberdade" e faz `replace('/chronicles/c1')` | `SheetScreen.test.tsx` | Jest + RNTL |
| T-81 | O jogador, a 390: crônica → NPC (identidade) → `getByRole('button', { name: /^Voltar para / })` → `getByRole('tab', { name: 'Fichas' })` visível na crônica de origem | `npc-backstage.spec.ts` | Playwright |
| T-46 | Tocar "Identidade" abre "Revelar a identidade para os jogadores?" sem chamar `visibilityPost`. "Cancelar" mantém "Oculto" marcado. "Revelar identidade" manda `visibility: 'identity'` com a revisão, e depois do `onClosed` aparece o toast "Identidade revelada aos jogadores.". De "Identidade" para "Oculto", envia sem folha e dá o toast da descida. O 409 aparece dentro da folha | `apps/frontend/sheet/storyteller/__tests__/RevealNpcSheet.test.tsx` (novo) e `SheetScreen.test.tsx` | Jest + RNTL |
| T-46 | A 390: `page.on('request')` conta os `POST …/visibility`. `getByRole('radio', { name: /^Identidade/ })` → `getByRole('heading', { name: 'Revelar a identidade para os jogadores?' })`, 0 requisições → Esc (fecha, 0) → de novo → `getByRole('button', { name: 'Revelar identidade' })` → 1 requisição, o rádio "Identidade" marcado e o toast. A 1280, a folha tem `boundingBox().width ≤ 560`, como no `layout.spec.ts` | `npc-backstage.spec.ts` | Playwright |
| T-52 | NPC do narrador: "NPC" e "Oculto", nunca "Sua ficha". Linha de identidade do jogador: "NPC revelado", sem selo de visibilidade | `apps/frontend/app/__tests__/new-character.test.tsx` (bloco "Fichas na crônica", onde a lista é testada desde o P04-C) | Jest + RNTL |
| T-52 | A Mesa com dois PCs e um NPC `hidden`: `getByRole('header', { name: 'NPCs' })`, o NPC depois dele com "Oculto" no nome acessível e os PCs antes. A ordem lembrada pelo `TableNav` é a da tela | `apps/frontend/app/__tests__/table.test.tsx` ("Mesa do narrador", `:103`) | Jest + RNTL |
| T-52 | `npcVisibilityText` nos três valores e em `undefined` | `components/chronicles/__tests__/characterState.test.ts` (novo, ou o arquivo que o P04-D criar) | Jest |
| T-63 | Os itens trazem `action` (código), `character.name` do alvo, `detail` só com as chaves da lista branca e `byRole` nos lotes. Criar a crônica e um convite gera `chronicle.create` e `invite.create`, e a resposta e o `payload` não contêm o código do convite. Uma linha forjada com `target_character_id` de outra crônica sai com `character: null`. Conceder XP a duas fichas gera um registro e dois lotes, com o `detail` `{ amount, characters: 2 }`. O ex-narrador continua com 404 depois da transferência | `apps/api/src/__tests__/backstage.test.ts` ("auditoria consolidada", `:755`); `chronicles.test.ts` (convite) | API, PGLite |
| T-63 | Uma frase para cada valor do `HistoryAction`, inclusive "Ação registrada" para valor desconhecido. Na tela, nenhum código (`queryByText(/^[a-z]+(\.[a-z-]+)+$/)` nulo) e o autor com `whenLabel` | `components/chronicles/__tests__/auditPhrase.test.ts` (novo); `CampaignBackstage.test.tsx` | Jest + RNTL |
| T-63 | A 1280, o narrador em Bastidores vê `getByText('Crônica criada')`, `getByText(/^Convite gerado/)` e `getByText('Regras da criação: aprovação Desligada → Ligada')`. Os códigos `chronicle.creation.settings`, `sheet.change` e `character.create-npc` têm 0 ocorrências, e o código do convite da resposta não está na página | `npc-backstage.spec.ts` | Playwright |

### 4.2 Testes existentes que mudam junto

| Arquivo | O quê | Por quê |
|---|---|---|
| `components/chronicles/__tests__/CampaignBackstage.test.tsx` | `:330-351` usa ações inventadas (`chronicle.update`, `sheet.events`) e espera o código na tela. Passa a usar ações reais e a esperar a frase. `:465` (aceitar) passa a procurar o aviso fora do Diário, no componente `TransferOffer` | T-63, U-03 |
| `e2e/tests/journey-backstage.spec.ts` | `:252-254`: a lista exata de chaves da identidade ganha `chronicle`. `:367`: continua `getByText('Auditoria')`, e passa a conferir uma frase em vez de só o título | T-81, T-63 |
| `apps/frontend/sheet/__tests__/SheetScreen.test.tsx` | O fixture `npcIdentity()` (`:69-76`) ganha `chronicle` | T-81 |
| `apps/frontend/test/fake-api.ts` | Rotas da lista de crônicas com `lastSession` e `transferOffer`, se o fixture pedir | U-03, U-04 |
| `apps/frontend/app/__tests__/chronicles.test.tsx` | O `meta` do cartão (`:58-90`) | U-04 |

Os specs do P11 não usam o modo Editar da ficha. Se precisarem, já usam "Salvar alterações" (D-01, P03-D, contrato 11).

### 4.3 E2E novo: `e2e/tests/npc-backstage.spec.ts` (Chromium e WebKit)

- **Contas:** narrador, dois jogadores e um terceiro membro (destinatário da proposta), por `signUp` (fictícias). A crônica é criada por `apiAs`, com `freeCreation`; o NPC, por `POST /chronicles/:id/characters` com `kind: 'npc'` e chave. Os fixtures pela API seguem o `journey-backstage.spec.ts`.
- **Contextos:**
  - o narrador a 390 × 844 (T-46, T-16) e a 1280 × 800 (T-52 na Mesa, T-63, a folha central do T-46);
  - os jogadores a 390 (T-15, T-81, U-03, U-04) e a 1280 (o Diário do T-16);
  - todos com `locale: 'pt-BR'` e `timezoneId: 'America/Sao_Paulo'`. Sem o fuso fixo, o CI (UTC) não mostra o dia anterior. Com ele, o defeito aparece igual em qualquer máquina.
- **Seletores:** os da seção 4.1, por papel e rótulo, e `getByTestId('table-row-<id>')` (`TableRow.tsx:89`) e `getByTestId('viewer-sheet')`.
- **O que o Jest não pega no web:**
  - o Eden real, que só roda aqui;
  - a altura da ficha do `viewer` (`boundingBox`);
  - a folha como diálogo no DOM (`role="dialog"` ou `aria-modal`, como no `a11y-keyboard.spec.ts:79`), com o Esc e o foco de volta ao rádio (`toBeFocused`);
  - o toast numa região viva.
- **Abas da ficha a 390:** o T-15 confere `getByRole('tablist', { name: 'Partes da ficha' })` dentro do `viewer-sheet`.
- **WebKit:** o T-15 e o T-46 são do iOS. O WebKit é o mais perto no E2E, mas não substitui o simulador (seção 11).

### 4.4 Suítes do "PR local" e cobertura

```bash
npx pnpm turbo run typecheck lint --filter=@tms/api --filter=frontend --filter=@tms/e2e
cd apps/api && bun test                      # inclui authz.test.ts (a matriz não muda)
PG_TEST_URL=postgres://postgres:postgres@localhost:5432/tms_p11_test bun test .pg.test
npx pnpm turbo run test:coverage --filter=@tms/api --filter=frontend
```

- **Metas por arquivo,** como o CI aplica:
  - API: 85% de linhas e funções em cada arquivo (`apps/api/bunfig.toml`). O `auditView.ts` nasce com teste de cada ramo da lista branca; o `routes.ts` e o `backstage.ts` ganham os casos da seção 4.1;
  - app: 70/70/60/70 no global e 80/80/70/80 em `./sheet/` (`apps/frontend/jest.config.js:34-37`). O `RevealNpcSheet.tsx` fica em `./sheet/` e tem teste próprio. `auditPhrase.ts`, `TransferOffer.tsx` e `format.ts` seguem a meta global, cobertos por arquivo.
- **Os `*.pg.test`:** o P11 não cria trava nem corrida nova. O `backstage.pg.test.ts` (transferência concorrente) roda por precaução, num banco `_test` do worktree.
- **`@tms/sheet-core`, `@tms/db` e `@tms/ui` não mudam:** não há `dist` a reconstruir.
- **Na integração** (portas fixas, um por vez): E2E inteiro em Chromium e WebKit, com o `npc-backstage.spec.ts`.

## 5. Segurança

**O P11 muda três respostas da API (lista de crônicas, projeção de identidade e auditoria) e o que a auditoria registra: passa por `/security-review` antes do merge**, além do `/code-review`. Foco:

- `apps/api/src/chronicles/routes.ts` (lista, criação da crônica e convite);
- `apps/api/src/sheets/routes.ts` (identidade);
- `apps/api/src/chronicles/backstage.ts` e `auditView.ts` (auditoria);
- `apps/frontend/lib/api.ts` (`parseDate`).

| O que pode dar errado | Como o desenho evita |
|---|---|
| A ficha do NPC vaza campo oculto para o jogador (T-15) | O T-15 muda só o estilo do contêiner no app. A projeção `full` do `viewer` (`sheets/routes.ts:509-527`, com `stripRestricted`) não muda, e o teste "oculta sentinela, revela identidade e depois ficha filtrada" (`backstage.test.ts:49`) continua |
| A crônica na projeção de identidade (T-81) vira oráculo de existência | Só o membro atual com o NPC revelado recebe essa projeção (`authz.ts:107-109`), e ele já vê a crônica na lista dele. Saem só `id` e `name`, sem dono, narrador, valores ou datas. O teste confere a lista exata de chaves. Ex-membro, outro narrador e estranho continuam com 404 |
| O selo de visibilidade aparece para o jogador (T-52) | A lista do jogador só recebe a projeção de identidade de NPC revelado (`sheets/routes.ts:371-380`, `:415-423`). A regra só desenha o selo com `narrating`, e há teste do jogador sem selo. A Mesa é só do narrador (404 para o jogador, `app/__tests__/table.test.tsx:224`) |
| Revelar sem querer, ou revelar parecendo reversível (T-46) | Subir sempre confirma, e o texto diz que quem já viu continua sabendo. Cancelar, Esc e o voltar do Android não enviam nada (o E2E conta as requisições). O servidor continua com a revisão e a chave do comando (`sheets/routes.ts:575-660`). O cache já visto continua como limitação conhecida (`validacao-v5.md` l.154–156) |
| A proposta aparece para quem não a recebeu, ou IDOR pelo id (U-03) | O `transferOffer` é calculado no servidor só onde `recipient_id = me`, `status = 'pending'` e `expires_at > now`. O `GET /transfer` já filtra narrador-ou-destinatário (`backstage.ts:662-667`). Aceitar e recusar revalidam o ator, a crônica e o pedido na transação (`:688-775`, `:971-1026`). Teste: narrador, outro membro e ex-membro recebem `null` |
| A auditoria mostra dado de outra crônica (T-63) | A rota continua só do narrador da crônica (`backstage.ts:810-811`). O join da ficha alvo exige `tc.chronicle_id = a.chronicle_id`, e há teste com uma linha forjada. Os filtros já recusam ficha de outra crônica (`:843-851`) |
| PII ou segredo na auditoria | O `detail` é lista branca: números, booleanos e códigos de estado. Não entra texto livre (motivo da devolução, notas, título de sessão), e-mail nem código de convite. O `invite.create` guarda só o id, os usos e a validade, e o teste procura o código na resposta e no `payload`. O nome de usuário do alvo é o que o narrador já vê em "Participantes" |
| Nome de NPC oculto na auditoria | Só o narrador da crônica lê a rota. Depois da transferência, o antigo narrador recebe 404 (`journey-backstage.spec.ts`, depois da `:449`) |
| `lastSession` para o ex-membro | Só com papel de narrador ou membro (plano v5 §3.5). Há teste do ex-membro com `null` |
| O `parseDate: false` muda validação | É só no cliente. A API valida as datas como hoje (`t.String({ pattern })`, `format: 'date-time'`). No aparelho, texto livre deixa de virar `Date`, o que também evita a recusa de ficha com um texto parecido com data (seção 3.0) |
| O toast ou o log expõem dado | Nenhum log novo. O toast diz só o nome do NPC, que o narrador vê |

Checklist da organização:

- **Validação no servidor:** visibilidade, transferência, sessões e auditoria continuam validadas e filtradas na API. O cliente só confirma e formata.
- **Logs sem PII:** nenhum log novo. O código do convite nunca é logado nem auditado.
- **Fail secure:**
  - ação desconhecida → "Ação registrada", nunca o código;
  - data civil inválida → sem data;
  - `transferOffer` e `lastSession` ausentes → nada na tela.
- **Erros sem stack trace:** os 409 e 422 continuam com `code` e mensagem curta, e aparecem dentro da folha.

## 6. Como generaliza além do WoD

- **Data civil (T-16, U-04):** é do produto. Qualquer sistema tem sessões com data civil. O `parseDate: false` vale para toda resposta, inclusive campos de texto de qualquer template (uma "Data de nascimento" num CoC).
- **NPC (T-15, T-46, T-52, T-81):** a visibilidade e as projeções são do core da v5 (`viewer`, identidade), sem nada de sistema. Um NPC de D&D 5e revela a identidade (nome, chip e retrato do `identity` do template) e a ficha em Leitura pelo mesmo código. O selo e a seção da Mesa usam o `dock` do template.
- **Auditoria (T-63):** as frases são das ações do produto, não do sistema. Os estados usam rótulos genéricos ("Fora de jogo", não "Morto"). Os nomes de ficha vêm do dado. Um template de D&D com descanso longo como `recovery` cai em "Recuperação: {ficha}".
- **Transferência (U-03):** é da crônica, igual em qualquer sistema.
- **Escopo:** todos os itens são **genéricos**. Nenhum é de template nem de skin.

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado.** Arquivos e linhas conferidos no `617264d` (seções 1 e 3). Não há decisão própria. A seção 2 diz o que é do P04-D, do P09-C e do P12.
2. **Typecheck, lint e testes** de `@tms/api` e do frontend, com os `*.pg.test` (seção 4.4). `@tms/sheet-core`, `@tms/db` e `@tms/ui` não mudam.
3. **Um teste de regressão por bug** (seção 4.1), falhando no `617264d`, com o `test:coverage` verde.
4. **`/code-review` e `/security-review`** no diff do pacote (seção 5). Os achados vão no resumo.
5. **O cenário de cada persona, repetido sem o defeito,** com a API local e o seed do roteiro (`npx pnpm seed:roteiro`, contas fictícias `@roteiro.test`):

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | T-15 | PO-A, POA-40 (`po-app.md`), iOS: o narrador revela "Ficha" → o jogador abre o NPC na crônica | A ficha em Leitura, com abas e traços, rolando abaixo do aviso |
   | T-16 | PO-A, POA-33, iOS: registrar a sessão de hoje → lista → Editar → Salvar sessão | "01/11/2026", e a edição salva, sem "Reenviar edição" nem "dados inválidos" |
   | T-16 | QA-W, QAW-30 (`qa-web.md`), e PO-W, POW-13 (`po-web.md`), web 390 e 1280: o Diário do narrador e o do jogador | A mesma data civil, em pt-BR, no dia certo |
   | T-16 | QA-A, QAA-11 (`qa-app.md`), iOS, jogador e narrador | Idem |
   | T-46 | PO-A, POA-31, iOS: NPC → "Identidade" | "Revelar a identidade para os jogadores?". Cancelar não revela; "Revelar identidade" revela e dá o toast |
   | T-52 | QA-A, QAA-25, Android, e PO-A, POA-25, iOS: criar um NPC → lista e Mesa | Na lista, "NPC" com "Oculto"; na Mesa, a seção "NPCs" com o selo |
   | T-52 | PO-W, POW-16, web 1280: Mesa | O NPC na seção própria, separado dos PCs |
   | U-03 | PO-W, POW-15, web 1280, e PO-A, POA-41, iOS: proposta pendente → o destinatário abre a lista e a crônica | O aviso com "Aceitar narração" e "Recusar" na lista e no topo da crônica; uma vez só na crônica |
   | T-63 | QA-A, QAA-26; PO-W, POW-06; PO-A, POA-32; N-W, NW-15 (`narrador-web.md`); N-A, NA-13 (`narrador-app.md`): salvar as regras da criação, criar NPC, dano em grupo, conceder XP → Bastidores → Auditoria | Frases com a ficha e o que mudou ("Regras da criação: aprovação Desligada → Ligada"); "Crônica criada" e "Convite gerado" nas crônicas novas; nenhum código |
   | T-81 | PO-A, POA-38, iOS: crônica → NPC com a identidade revelada → "‹" | Volta para a crônica de origem |
   | U-04 | PO-W, POW-30, web 390: registrar uma sessão → Crônicas | "Última sessão: 01/11" no cartão |

6. **Conferência no aparelho:** o roteiro completo está na seção 11. O T-15, o T-16 na edição, o T-46 e o T-81 só apareceram no iOS e são obrigatórios lá. O pacote não muda o `@tms/ui`, mas a folha nova, o `Banner` com dois botões e a seção da Mesa passam pelo nativo antes do merge (lição S-01, onda-1 §9).
7. **Resumo para a seção do P11 no PR da onda:**
   - o que mudou;
   - como foi testado;
   - os achados das duas revisões;
   - as respostas novas da API (seção 3.9);
   - o `parseDate: false` como mudança do cliente para os outros pacotes.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

| # | Commit | Itens | Esforço |
|---|---|---|---|
| 1 | `fix(app): o cliente da API entrega datas como texto (parseDate: false)` | T-16 | P |
| 2 | `fix(app): data civil da sessão no Diário e na edição` (`civilDate`) | T-16 | P |
| 3 | `fix(app): a ficha revelada do NPC ocupa a tela no nativo` | T-15 | P |
| 4 | `fix(api): a projeção de identidade do NPC traz a crônica` | T-81 | P |
| 5 | `fix(app): o "‹" do NPC revelado volta para a crônica` | T-81 | P |
| 6 | `fix(app): confirmar antes de revelar o NPC, com toast depois` (`RevealNpcSheet`, a Mesa invalidada) | T-46 | P |
| 7 | `fix(app): visibilidade do NPC na lista e seção "NPCs" na Mesa` | T-52 | P |
| 8 | `fix(api): última sessão e proposta de narrar na lista de crônicas` | U-04, U-03 | P |
| 9 | `fix(app): "Última sessão" e o aviso da proposta na lista e no topo da crônica` (`TransferOffer`) | U-04, U-03 | P |
| 10 | `fix(api): auditoria com ação tipada, ficha alvo e detalhe; criação da crônica e do convite registradas` (`auditView.ts`) | T-63 | M |
| 11 | `fix(app): auditoria em frases` (`auditPhrase.ts`) | T-63 | P |
| 12 | `test(e2e): bastidores e NPC a 390 e 1280, com o fuso de São Paulo` (`npc-backstage.spec.ts` e o `journey-backstage`) | todos | M |
| 13 | `docs: data civil no cliente e auditoria legível` (`doc/validacao-v5.md`, nota na tabela de correções da l.29) | T-16, T-63 | P |

**Por que esta ordem:**

- O cliente (1) vem primeiro: todo teste seguinte já vê texto nas datas, e o T-16 é alta.
- Em cada item, a API vem antes do app que a usa (4 → 5, 8 → 9, 10 → 11). Os commits de API são o foco do `/security-review`.
- O T-15, o T-81 e o T-46 (3 a 6) tocam o `SheetScreen` em trechos diferentes, um por vez.
- O T-52 (7) vem antes do T-63 porque o rebase sobre o P04-D começa pelo selo, que o 7 consome.
- O T-63 (10 e 11) é o maior e o de menor severidade. Fica por último no código e sai sozinho.
- O E2E (12) é escrito aqui e rodado na integração, como nas ondas 1 e 2.

### 8.2 Esforço

**M**, de 6 a 8 dias, em 13 commits (10 P, 2 M e o de docs). A matriz soma 7 P e 1 M. A diferença vem do que o código mostrou:

- o T-16 tem a causa no cliente, e a correção é global (`parseDate: false`), com teste do Eden real;
- o U-03 e o U-04 precisam de campo novo na lista de crônicas: a matriz supunha que a API já devolvia;
- o T-81 precisa da crônica na projeção de identidade;
- o T-63 tem o `detail` em lista branca, dois registros novos e o mapa exaustivo de frases;
- o pacote passa pelo `/security-review`;
- a conferência no iOS é obrigatória, com a preparação do `idb` (seção 11).

**Se a onda precisar cortar:** os commits 10 e 11 (T-63) saem juntos sem quebrar os outros. Sem eles, as ações novas do P04-D aparecem como código, como as de hoje. Os commits 8 e 9 (U-03 e U-04) também saem juntos.

### 8.3 Riscos

- **`parseDate: false` vale para o app inteiro.** O tipo inferido pelo Eden continua dizendo `Date` nas colunas `timestamptz`. Um código novo que chame `.getTime()` direto compila e quebra. Mitigação:
  - o grep da seção 3.2: hoje não há nenhum caso;
  - a mesma forma que o cache persistido já entrega;
  - a nota no resumo do PR, para o P04-D e o P09-C usarem `new Date(x)`, `shortDate` ou `whenLabel`.
- **O T-15 só se prova no aparelho.** O teste de estilo prova a causa. Se o `flex: 1` não bastar no iOS (por exemplo, a `KeyboardArea` medindo errado no `viewer`), o ajuste é no mesmo contêiner. A seção 11 tem o iOS obrigatório.
- **O `idb` pode não rodar no Python da máquina** (seção 11d). Nesse caso, o resultado do iOS é "não conferido", com o motivo, e a integração decide.
- **Registros antigos da auditoria** não têm o "de → para" e saem com a frase genérica da ação.
- **Mudança visível no Diário:** a proposta sai do Diário e vai para o topo da crônica. Quem a procurava no Diário a encontra acima das abas.

### 8.4 Conflitos com os pacotes da onda (P03-D, P04-D, P09-C)

Ordem de merge provisória da consolidação: **P03-D → P04-D → P11 → P09-C.** O código confirma essa ordem:

- o P11 depois do P04-D, porque consome o selo (`StateBadge` e `characterState.ts`) e escreve as frases das ações de auditoria que o P04-D cria;
- o P11 antes do P09-C, porque o P09-C reorganiza o cartão da Mesa (T-48) e a barra de seleção (T-49), e encaixa no layout novo as duas seções que o P11 cria. A correção do T-40, item 4, também cai no `TransferOffer`, que o P11 cria.

| Arquivo | P11 | Outro pacote | Risco e como integrar |
|---|---|---|---|
| `apps/frontend/components/chronicles/CharacterList.tsx` | T-52: dono "NPC" e selo (`:88-95`, `:111`) | P04-D: o estado na mesma linha (`:94-95`, `characterStateText`) | **Alto**, mesmas linhas. O P04-D entra antes. O P11 põe o selo de visibilidade antes do estado do P04-D. Se o P04-D não mostrar estado de NPC, fica só o de visibilidade |
| `apps/frontend/components/chronicles/characterState.ts` | `npcVisibilityText` | P04-D: os estados da D-02 e o formato do retorno | Médio. O P11 segue o formato do P04-D no rebase |
| `apps/frontend/components/chronicles/TableRow.tsx` | T-52: selo nos `badges` (`:107-130`) e no `label` (`:60-67`) | P04-D: estados novos no `state`. P09-C: T-48 (cartão compacto, grade) e T-83 (`meta`, `:43`) | **Alto** para o P09-C, que entra por último e refaz o cartão com o selo do P11 e o estado do P04-D |
| `apps/frontend/components/chronicles/tableItems.ts` | `TableRowData.kind` e `visibility`; `TableItem.visibility` | P04-D: `stateLabel` (`:40-56`). P09-C: o autor da última alteração (T-83) no `TableRowData` | Médio. Campos diferentes da mesma interface |
| `apps/frontend/components/chronicles/TableView.tsx` | T-52: PCs e NPCs em duas seções (`:155-162`, `:299-307`) | P09-C: T-49 (barra fixa da seleção, `:220-280`), T-75 ("1 selecionado (máx. 20)", `:226`), T-48 (grade). P04-D: os avisos "Aguardando aprovação/ajuste" e "terminei" | **Alto** para o P09-C. A grade dele vale dentro de cada seção, e a barra fixa atravessa as duas |
| `apps/frontend/sheet/SheetScreen.tsx` | `:125-134` (crônica e "‹"), `:161-178` (`viewer`), `:608-700` (`NpcVisibilityBar`) | P04-D: `narratorOf` e o efeito de transição (o selo vai no `IdentityBlock`, não no `subtitle` da `AppBar`: P04-D §3.5). P09-C: T-33 (o narrador abre em leitura, no `LiveSheet`, `:382-563`) e T-39 (a volta para a aba da crônica, `:129-134`) | Médio. O `back` é a linha em comum com o P09-C: o P11 só muda de onde vem a `chronicle`, e o P09-C cria o `useSheetBack` que a usa ([onda-3.md](onda-3.md) §4.8) |
| `apps/frontend/components/chronicles/CampaignBackstage.tsx` | T-16 (`:150`, `:198`), U-03 (o `AcceptTransfer` sai, `:110-116`, `:489-520`), T-63 (`History`, `:522-603`) | P09-C: T-40, item 4 (a tela depois de "Aceitar narração") | Médio. Se o P09-C mexer no componente, a mudança vai para o `TransferOffer.tsx` no rebase dele |
| `apps/frontend/lib/queries/backstage.ts` | `useTransferDecision` invalida `chronicleKeys.all` (`:129-147`) | P09-C: `useAcceptTransfer` (`:115-127`, o `queryClient.clear()`) | Baixo. Hooks diferentes |
| `apps/frontend/app/(app)/index.tsx` | U-03 (aviso no cabeçalho, `meta`) e U-04 (`meta`, `:74-84`) | P09-C: T-40, item 2 (rebuscar ao focar e puxar para baixo, no `FlatList`) | Baixo. Trechos diferentes |
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` | U-03: aviso depois do `info` (`:98-107`) | P09-C: T-39 (a aba no estado de navegação, `:46`) | Baixo |
| `apps/frontend/lib/queries/chronicles.ts` | `useSetNpcVisibility` invalida a Mesa (`:192-205`) | P09-C: T-40 (consultas ao focar) | Baixo |
| `apps/frontend/lib/format.ts` | `civilDate` | P04-D: "Concluída em dd/mm" com `shortDate` (instante) | Baixo. Funções diferentes (contrato 7) |
| `apps/frontend/lib/api.ts` | `parseDate: false` | Todos: as datas chegam como texto | Baixo no código, alto no efeito. Fica no resumo do PR (seção 8.3) |
| `apps/api/src/audit.ts` | `chronicle.create`, `invite.create` | P04-D: as ações de pedir ajuste e de avisar que terminei | Baixo. Linhas vizinhas da união. O mapa de frases do P11 cobre as do P04-D no rebase |
| `apps/api/src/sheets/routes.ts` | Identidade (`:498-505`) | P04-D: o estado novo na lista (`:426-441`) e na ficha (`:534-560`) | Baixo. Trechos diferentes |
| `apps/api/src/sheets/creation.ts` | `approvalFrom` no registro das regras (`:405-414`) | P04-D: o estado novo e as transições | Baixo. Trechos diferentes |
| `packages/ui/src/Toast.tsx` | Não muda; o P11 usa a duração padrão | P09-C: T-76 (a janela do "Desfazer") | Nenhum. Se o P09-C mudar o padrão, o toast do P11 herda |
| `packages/ui/src/BottomSheet.tsx` | Não muda (contrato 8) | — | Na integração, a folha "Revelar" é conferida com as do P04-D e do P03-D (seção 11) |
| `e2e/tests/*` | `npc-backstage.spec.ts` (novo); `journey-backstage.spec.ts` (`:252-254`, `:367`) | P03-D: os 9 specs do "Concluir" → "Salvar alterações"; o `journey-backstage` não está entre eles | Baixo |

**Com o P03-D,** não há arquivo em comum conhecido: a `ModeBar`, o `LeaveGuard` e a guarda de saída não são do P11.

**Migration:** o P11 não precisa de nenhuma. A `0024` reservada pela consolidação fica livre, e a `0023` é do P04-D.

**Se o P04-D atrasar:** o P11 entra sem o `StateBadge`, com o texto no `meta` da lista e no `state` da Mesa (seção 3.4). As frases cobrem só as ações que existirem. Quando o P04-D entrar, ele troca o texto pelo selo e escreve as frases das ações dele.

### 8.5 Arquivos tocados

| Arquivo | Itens | Tipo de mudança |
|---|---|---|
| `apps/frontend/lib/api.ts` | T-16 | alterado (`parseDate: false`) |
| `apps/frontend/lib/format.ts` | T-16, U-04 | alterado (`civilDate`, nota no `shortDate`) |
| `apps/frontend/lib/queries/chronicles.ts` | T-46 | alterado (a Mesa invalidada na visibilidade) |
| `apps/frontend/lib/queries/backstage.ts` | U-03 | alterado (recusar e cancelar invalidam a lista de crônicas) |
| `apps/frontend/sheet/SheetScreen.tsx` | T-15, T-81, T-46 | alterado |
| `apps/frontend/sheet/storyteller/RevealNpcSheet.tsx` | T-46 | novo |
| `apps/frontend/components/chronicles/CampaignBackstage.tsx` | T-16, U-03, T-63 | alterado |
| `apps/frontend/components/chronicles/TransferOffer.tsx` | U-03 | novo |
| `apps/frontend/components/chronicles/auditPhrase.ts` | T-63 | novo |
| `apps/frontend/components/chronicles/characterState.ts` | T-52 | alterado (`npcVisibilityText`) |
| `apps/frontend/components/chronicles/CharacterList.tsx` | T-52 | alterado |
| `apps/frontend/components/chronicles/tableItems.ts` | T-52 | alterado |
| `apps/frontend/components/chronicles/TableRow.tsx` | T-52 | alterado |
| `apps/frontend/components/chronicles/TableView.tsx` | T-52 | alterado |
| `apps/frontend/app/(app)/index.tsx` | U-03, U-04 | alterado |
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` | U-03 | alterado |
| `apps/api/src/sheets/routes.ts` | T-81 | alterado (identidade com a crônica) |
| `apps/api/src/chronicles/routes.ts` | U-03, U-04, T-63 | alterado (lista; registros da crônica e do convite) |
| `apps/api/src/chronicles/backstage.ts` | T-63 | alterado (auditoria) |
| `apps/api/src/chronicles/auditView.ts` | T-63 | novo (`auditDetail`) |
| `apps/api/src/chronicles/operations.ts` | T-63 | alterado (`OperationKind` exportado) |
| `apps/api/src/audit.ts` | T-63 | alterado (duas ações) |
| `apps/api/src/sheets/creation.ts` | T-63 | alterado (`approvalFrom`) |
| `apps/api/src/__tests__/backstage.test.ts`, `chronicles.test.ts` | T-81, U-03, U-04, T-63 | testes alterados |
| `apps/frontend/lib/__tests__/api.test.ts` | T-16 | teste alterado |
| `apps/frontend/lib/__tests__/format.test.ts` | T-16 | teste novo |
| `apps/frontend/sheet/__tests__/SheetScreen.test.tsx` | T-15, T-81, T-46 | teste alterado |
| `apps/frontend/sheet/storyteller/__tests__/RevealNpcSheet.test.tsx` | T-46 | teste novo |
| `apps/frontend/components/chronicles/__tests__/CampaignBackstage.test.tsx` | T-16, U-03, T-63 | teste alterado |
| `apps/frontend/components/chronicles/__tests__/auditPhrase.test.ts`, `characterState.test.ts` | T-63, T-52 | testes novos |
| `apps/frontend/app/__tests__/chronicles.test.tsx`, `table.test.tsx`, `new-character.test.tsx` | U-03, U-04, T-52 | testes alterados |
| `apps/frontend/test/fake-api.ts` | U-03, U-04 | alterado (se o fixture pedir) |
| `e2e/tests/npc-backstage.spec.ts` | todos | E2E novo |
| `e2e/tests/journey-backstage.spec.ts` | T-81, T-63 | E2E alterado |
| `doc/validacao-v5.md` | T-16, T-63 | doc |

## 9. Perguntas abertas (técnicas)

⚙ = resposta só no simulador ou no aparelho.

1. **`parseDate: false` global ou só na sessão?** O plano desliga no cliente inteiro, porque a causa vale para todo texto com forma de data, e o cache persistido já entrega texto. A alternativa local é normalizar só `session.date` (por exemplo, `toISOString().slice(0, 10)` quando vier `Date`). Ela corrige o T-16 e deixa o resto: título, nome e campo de texto da ficha.
2. ⚙ **T-15 no Android.** As personas não testaram. Pelo Yoga, o defeito é o mesmo. Conferir no AVD antes e depois (seção 11c).
3. **T-81: crônica na projeção ou volta pela pilha?** O plano põe a crônica na projeção, que funciona também por link (deep link `tms://`). A alternativa só no app é `router.canGoBack() ? router.back() : router.replace('/')`, como o `ErrorBoundary` da rota (`app/(app)/characters/[id].tsx:42-43`). Ela não muda a API, mas por link continua indo para Crônicas.
4. **U-03 na lista de crônicas: aviso com os dois botões ou só o texto "Convite para narrar" levando à crônica?** A matriz pede "Aceitar" e "Recusar" nos dois lugares, e o plano segue a matriz.
5. **T-46: toast também na descida?** O plano dá toast na descida, lembrando que quem já viu continua sabendo. A matriz só fala do toast depois de revelar.
6. **T-63: os números do orçamento nas regras da criação.** "Pontos de bônus 15 → 16" (NW-15) exige gravar no `payload` o antes e o depois de cada orçamento, com os ids do template. O plano grava só o `approvalFrom` e diz "orçamento padrão alterado". Gravar os números agora ou junto com o resumo das regras da D-10 (P09-D, onda 5)?
7. **Filtro de data da auditoria em UTC** (`CampaignBackstage.tsx:527-531`, fora da matriz). Em Brasília, "Desde 2026-11-01" começa às 21:00 de 31/10. Corrigir aqui (limites no dia local) ou registrar para depois?
8. **T-63: registrar também o convite revogado e a entrada por convite** (`invite.revoke`, `member.join`)? A matriz pede só a criação da crônica e do convite.
9. **U-04 no detalhe da crônica.** O detalhe já tem `lastSession` (`routes.ts:425-432`), e mostrar "Última sessão: 01/11/2026 · {título}" no bloco de informações é uma linha. Entra junto ou fica só na lista, como pede a matriz?
10. **O selo do NPC junto com o estado do P04-D** ("Oculto" e "Em criação · livre" na mesma linha). Respondida pelo plano do P04-D (§3.4): o `characterState` devolve `null` para o NPC, e o NPC fica só com o selo de visibilidade ([onda-3.md](onda-3.md) §4.2).
11. ⚙ **O cliente `idb` (fb-idb) roda no Python da máquina?** Ver a seção 11d. Se não rodar, o iOS fica "não conferido", e a integração decide entre o acesso assistivo para o terminal ou outra ferramenta.

**Causas da matriz corrigidas pela leitura do código:**

- **T-15:** a causa suposta se confirma pelo Yoga (seção 3.0). O Android deve ter o mesmo defeito.
- **T-16:** a causa suposta se confirma no Eden 1.4.9. A edição também falha no web, e qualquer texto com forma de data vira `Date`.
- **T-81:** a causa é a projeção de identidade sem a crônica. A matriz não indicava a causa.
- **T-63:** "xp-grant" e "xp.grant" não são duplicatas: são o lote da ficha e o registro da operação.
- **U-04:** a API só devolve `lastSession` no detalhe, não na lista.
- **T-52:** a lista da crônica já tem a seção "NPCs". Faltam o selo e o texto do dono. Na Mesa falta a seção.

Pontos para o PO: nenhum. As perguntas 4, 5 e 9 são de forma e seguem a matriz até haver resposta.

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

Implementado em `8fb653e` (sem o P04-D), nos 13 commits da seção 8.1 e em quatro commits de correção: um teste de API e três achados do `/code-review`.

**Base sem o P04-D (seção 8.4, "se o P04-D atrasar"):**

- **Lista:** a visibilidade vai como texto no `meta`. Exemplo: "Tremere · NPC · Oculto".
- **Mesa:** ela vai como `caption` com borda nos `badges` do `TableRow`, com `testID="visibility-<id>"`.
- **Integração:** ao entrar o P04-D, as duas trocam pelo `StateBadge` (`tone: 'neutral'`). O `PHRASES` ganha as frases de `character.creation.adjust` e `character.creation.ready`, e o typecheck as pede no rebase.

**AuthZ e API:**

- **Matriz de AuthZ.** O plano dizia que ela não mudava, porque não há rota nova. Ela ganha:
  - a linha de `GET /characters/:id` com `target: 'npc'`, o NPC oculto: o narrador recebe 200, e todos os outros, 404;
  - em toda linha, a conferência de que o nome do NPC oculto não sai para quem não narra.
- **`transferOffer` só para o membro atual.** Além de "destinatário, pendente, não vencida", quem pergunta precisa ser membro (`role === 'player'`). O destinatário que saiu continua vendo a crônica ("Você saiu"), mas sem a proposta.
- **A proposta na lista de crônicas** vem de um `LEFT JOIN LATERAL`, uma consulta por crônica. Antes eram duas subconsultas iguais (achado do `/code-review`).
- **`character` da auditoria** é `{ id, name, deleted }`. O `deleted` permite escrever "(excluída)" sem uma segunda consulta.
- **Usuário alvo na auditoria:** só em `member.*`, `chronicle.transfer.request` e `chronicle.transfer.accept`. Recusar e cancelar não gravam o `target_user_id`.
- **`members.test.ts`** passa a esperar a linha `invite.create` ao lado de `member.leave`. O teste lista toda a auditoria da crônica.

**App:**

- **A Mesa não ganhou uma invalidação própria.** O `chronicleKeys.all` (`['chronicles']`) já a rebusca pelo prefixo. O `useSetNpcVisibility` ganhou outra coisa: o 409 rebusca a ficha.
- **`RevealNpcSheet`:**
  - Com o envio em curso, "Cancelar" fica desabilitado, e o Esc e o voltar esperam.
  - Visibilidade desconhecida conta como oculto (`npcVisibilityOf`), e qualquer troca confirma (fail secure).
  - Se a ficha rebuscada depois de um 409 já chegou ao alvo ou passou dele, a folha fecha sem enviar. Revelar nunca baixa a visibilidade (achado do `/code-review`).
- **`TransferOffer`:**
  - mostra o erro da decisão dentro do aviso;
  - se o servidor recusa a decisão, rebusca a proposta e a lista e zera as chaves (achado do `/code-review`);
  - sem resposta da rede, a chave continua para o reenvio.
- **`CampaignBackstage`** só busca a transferência para o painel do narrador (`useTransfer(id, narrating)`). A do jogador fica no topo da crônica.
- **Registrar ou editar sessão** também rebusca a lista de crônicas (`exact`), para a "Última sessão".

**Testes e E2E:**

- **Nomes dos arquivos de teste.** São `components/chronicles/__tests__/npcVisibility.test.tsx` e `auditPhrase.test.tsx`, não `characterState.test.ts` nem `auditPhrase.test.ts`.
  - O `testMatch` do Jest em `components/` só pega `.test.tsx`.
  - O nome diferente também evita o conflito com o `characterState.test.ts` que o P04-D planeja. Pelo mesmo `testMatch`, esse arquivo não rodaria se ficar em `.ts`.
- **E2E a 1280.** Narrador e jogador entram por `POST /auth/login` num contexto próprio. Copiar o cookie do refresh dividiria a família de tokens, e a rotação revogaria uma das sessões.

**Perguntas da seção 9 que seguem abertas:** 4, 6, 7, 8 e 9. A 1 e a 5 seguiram o plano: `parseDate: false` global e toast também na descida.

- **Pergunta 7.** O filtro "Desde/Até" da auditoria continua em UTC. Com as horas da lista agora no fuso de quem lê (`whenLabel`), a diferença fica mais visível.
- **Fora do escopo.** Depois de "Aceitar narração", o `queryClient.clear()` não rebusca as telas montadas. Isso é do P09-C (T-40, item 4) e vale para o `TransferOffer` nos dois lugares.

## 11. Testes manuais (web, Android com AVD, iOS com idb)

O roteiro confere cada item na interface, nas três plataformas, com a API local e o seed do roteiro. Só entram contas e dados fictícios. Detalha o passo 6 da seção 7. Os screenshots ficam no scratchpad da sessão, com o nome da coluna "Evidência", e nenhum mostra senha nem token.

### 11a. Preparação

- **Serviços:**
  - `npx pnpm db:up`, `npx pnpm db:migrate`, `npx pnpm templates:publish --published` (se o banco for novo);
  - `npx pnpm dev:api`, na porta 3001;
  - `npx pnpm dev:web` (Metro na 8081, que também serve o app nativo de Debug).

  Antes, `npx pnpm bootstrap`, se o `scripts/check-dev-env.mjs` pedir.
- **Seed:** `npx pnpm seed:roteiro` (`scripts/seed-roteiro.ts`).
  - **O que ele já cobre:** as contas N (`roteiro_narrador`), J1, J2 e N2 (`@roteiro.test`). Para cada sistema (Vampiro, Mago, Lobisomem), "{Sistema} v3/v5 · {hora}" (criação livre, com J1 e J2 dentro e um convite para N2) e "{Sistema} v4 · {hora}" (por pontos). Mais "Vampiro limite 20", com 21 fichas.
  - O seed imprime as crônicas e o convite de N2. O código do convite fica no terminal e não vai para o relatório.
  - **A senha** é a constante do seed. Ela é digitada a partir de uma variável do terminal, nunca escrita no plano, no relatório ou num screenshot (o campo é `secureTextEntry`).
- **O que o roteiro cria pela tela,** uma crônica por plataforma, para que uma revelação não contamine a outra:
  - web em "Mago v3/v5";
  - Android em "Lobisomem v3/v5";
  - iOS em "Vampiro v3/v5" (o sistema do POA-40). O iPhone SE usa "Vampiro v4" para o T-46 e o T-81, e N2 não entra nela.

  Em cada uma:
  1. N cria o NPC "Figura Velada" (oculto);
  2. N revela a identidade e depois a ficha;
  3. N registra a sessão de "2026-11-01" (digitada no campo "Data");
  4. N salva as regras da criação (aprovação Ligada) para a auditoria;
  5. N2 entra com o convite do seed;
  6. N propõe a narração a N2, N2 recusa, N propõe de novo, e N2 aceita (**sempre o último passo**: troca o narrador da crônica).
- **Estender o seed não é preciso.** Tudo o que o P11 confere nasce pela tela, que é o que se quer conferir. O limite de 10 aceites de convite a cada 15 min por conta não é atingido: N2 entra em três crônicas.
- **Fuso:** a máquina em `America/Sao_Paulo`. O T-16 só aparece com fuso a oeste de UTC.

### 11b. Web

- **Script Playwright Chromium no scratchpad** (`<scratchpad>/p11-web.mjs`), com o `playwright` do `node_modules`, contra o Metro em `http://localhost:8081`. Nada vai para o repositório.
- **Contextos:**
  - `viewport` exato de **390 × 844** e de **1280 × 800**;
  - `locale: 'pt-BR'` e `timezoneId: 'America/Sao_Paulo'`;
  - um contexto por conta (N, J1, N2).
- **WebKit** (`webkit.launch()`) para o T-15, o T-46 e o T-81, que são do Safari no iOS. Não substitui o simulador.
- **Seletores por papel e rótulo:**
  - `getByRole('radio', { name: /^Identidade/ })`;
  - `getByRole('button', { name: 'Revelar identidade' })`;
  - `getByRole('tab', { name: 'Bastidores' })`;
  - `getByRole('button', { name: /^Voltar para / })`;
  - `getByRole('header', { name: 'NPCs' })`;
  - `getByTestId('viewer-sheet')`.
- **Um screenshot por passo:** `page.screenshot({ path: '<scratchpad>/p11-web-<id>-<passo>.png' })`.
- **O DOM:** o script também guarda, por item, o `ariaSnapshot()` do trecho conferido (seção 11f).

### 11c. Android

- **AVD** `Pixel_3a_API_34_extension_level_7_arm64-v8a`, a **393 dp**. Boot rápido, `-gpu host`; o boot a frio travou a System UI na onda 2.
- **O que é de layout também a 360 e a 411 dp:** `adb shell wm density 480` (360 dp) e `420` (411 dp), com `adb shell wm density reset` no fim. Vale para o T-46 (folha), o T-52 (linha da lista e cartão da Mesa), o U-03 (aviso com dois botões) e o U-04 (`meta` do cartão).
- **APK Debug:** o mesmo da integração (`expo prebuild` e `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a`, com o `JAVA_HOME` da JBR do Android Studio). `adb install -r`, e `adb shell monkey -p com.tms.app 1` para abrir.
- `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Navegação:**
  - `adb shell uiautomator dump /sdcard/ui.xml` e `adb pull`, para achar o alvo pelo `text` ou pelo `content-desc` e tocar no centro dos `bounds`;
  - `adb shell input tap X Y`;
  - `adb shell input text` (espaço como `%s`);
  - `adb shell input keyevent 4` (voltar).
- **Teclado de software:** `adb shell settings put secure show_ime_with_hard_keyboard 1`. Fechar o banner do LogBox, que engole toques embaixo.
- **O voltar do Android:**
  - com a folha "Revelar" aberta, fecha sem revelar (T-46);
  - no NPC com a identidade revelada, volta para a crônica (T-81, com o voltar do sistema e com o "‹").
- **Screenshot:** `adb exec-out screencap -p > <scratchpad>/p11-android-<id>-<passo>.png`.

### 11d. iOS com idb

- **Simuladores:** iPhone SE 3ª geração (iOS 18.x) e iPhone 17 (iOS 26.5). Os UDIDs saem de `xcrun simctl list devices available`; depois, `xcrun simctl boot <UDID>` e `open -a Simulator`.
- **Build Debug para o simulador**, como o CI (`.github/workflows/ci.yml:333-341`), em `apps/frontend/ios`:

  ```bash
  xcodebuild -workspace TMS.xcworkspace -scheme TMS -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath <scratchpad>/dd CODE_SIGNING_ALLOWED=NO build
  xcrun simctl install <UDID> <scratchpad>/dd/Build/Products/Debug-iphonesimulator/TMS.app
  xcrun simctl launch <UDID> com.tms.app
  ```

  O build leva ~37 min a frio e ~10 min incremental. O simulador alcança o Metro (8081) e a API (3001) em `localhost`, sem `reverse`.
- **O `idb_companion`** já está em `/opt/homebrew/bin`.
- **O cliente (fb-idb):**
  - vai num venv **fora do repositório**, com versão fixada. Ele não entra no `package.json` nem no lockfile:

    ```bash
    python3 --version                       # anotar; ver o risco abaixo
    python3 -m venv "$HOME/.venvs/idb-tms"
    "$HOME/.venvs/idb-tms/bin/python" -m pip install 'fb-idb==1.1.7' 'pip-audit==<versão fixada>'
    "$HOME/.venvs/idb-tms/bin/pip-audit"    # antes de usar: sem vulnerabilidade conhecida, ou parar
    ```

    O `1.1.7` é a última versão no PyPI que este plano conhece: conferir com `pip index versions fb-idb` antes de instalar e anotar a versão usada.
  - **Risco:** o fb-idb é antigo e pode não rodar no Python da máquina (asyncio e grpclib em versões novas). Se não rodar, o iOS é "não conferido", com o erro (seção 11h).
- **O companion fica só local.** O cliente sobe o companion com `--companion-path /opt/homebrew/bin/idb_companion`. Se for preciso subir à mão, usar o socket de domínio (`--grpc-domain-sock` no scratchpad), nunca uma porta TCP numa interface de rede. Conferir as opções com `--help` e, depois de subir, conferir que nenhuma porta ficou aberta: `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` vazio.
- **Navegação:**
  - `idb ui describe-all --udid <UDID> --json` acha o alvo pelo `AXLabel`, e o toque vai no centro do `frame` (`x + width/2`, `y + height/2`): `idb ui tap --udid <UDID> X Y`;
  - `idb ui text --udid <UDID> "…"` (o e-mail, o nome do NPC e a data);
  - `idb ui swipe --udid <UDID> X1 Y1 X2 Y2` (rolar a ficha do T-15 e a Mesa);
  - `idb ui key --udid <UDID> <código>` (Enter; conferir o código da tecla no `--help`);
  - `idb screenshot --udid <UDID> <scratchpad>/p11-ios-<id>-<passo>.png`.
- **Deep link** (abrir o NPC direto pelo id): `xcrun simctl openurl <UDID> 'tms://characters/<id>'`. O iOS pergunta "Abrir com 'TMS'?": achar "Abrir" no `describe-all` e tocar pelo `idb`.

### 11e. Roteiro por item

A coluna "Resultado" fica em branco e é preenchida na integração.

**T-15 · A ficha revelada abre inteira**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-15 | iOS, iPhone 17 (obrigatório) | N, J1 | N revela "Ficha" do NPC em "Vampiro v3/v5" → J1 abre a crônica → toca o NPC → rola com `swipe` | Aviso "Leitura" em cima; a ficha com as abas ("Partes da ficha") e os traços abaixo, rolando; no `describe-all`, rótulos de traços ("Destreza, …") | `p11-ios-T-15-1.png`, `-2.png` | |
| T-15 | iOS, iPhone SE (obrigatório) | N, J1 | O mesmo em "Vampiro v4" | O mesmo, sem nada cortado a 375 pt | `p11-ios-T-15-se.png` | |
| T-15 | Android, 393 dp | N, J1 | O mesmo em "Lobisomem v3/v5" (pergunta 2) | Ficha visível e rolando; no `uiautomator dump`, nós dos traços abaixo do aviso | `p11-android-T-15-1.png` | |
| T-15 | Web 390 (Chromium e WebKit) | N, J1 | O mesmo em "Mago v3/v5" | `viewer-sheet` com altura maior que 400 px e a primeira aba visível | `p11-web-T-15-390.png` | |

**T-16 · Data civil da sessão**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-16 | iOS, iPhone SE (obrigatório na edição) | N | Bastidores → "Data" = 2026-11-01 → título → "Registrar sessão" → ver a lista → "Editar" → mudar o título → "Salvar sessão" | "01/11/2026" na lista; a edição salva e fecha o formulário, sem "Reenviar edição" nem "dados inválidos" | `p11-ios-T-16-1.png`, `-2.png` | |
| T-16 | iOS, iPhone 17 | J1 | Crônica → aba "Diário" | "01/11/2026" | `p11-ios-T-16-j1.png` | |
| T-16 | Android, 393 dp | N, J1 | Os mesmos passos | Os mesmos resultados | `p11-android-T-16-1.png` | |
| T-16 | Web 390 e 1280 | N (390), J1 (1280) | Os mesmos passos, com `timezoneId` de São Paulo | "01/11/2026" para os dois; o `PATCH` volta 200 | `p11-web-T-16-390.png`, `-1280.png` | |

**T-46 · Confirmar antes de revelar**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-46 | iOS, iPhone 17 (obrigatório) | N | NPC → "Identidade" → "Cancelar" → "Identidade" → "Revelar identidade" → "Ficha" → "Revelar ficha" | A folha "Revelar a identidade para os jogadores?" com "Quem já viu continua sabendo"; cancelar mantém "Oculto"; revelar marca o rádio e mostra o toast depois de a folha sair | `p11-ios-T-46-1.png` … `-4.png` | |
| T-46 | iOS, iPhone SE (obrigatório) | N | O mesmo em "Vampiro v4"; depois, "Oculto" | A folha cabe a 375 pt; "Oculto" envia sem folha, com o toast da descida | `p11-ios-T-46-se.png` | |
| T-46 | Android, 393, 360 e 411 dp | N | O mesmo; com a folha aberta, o voltar do Android | A folha inteira nas três larguras; o voltar fecha sem revelar | `p11-android-T-46-393.png`, `-360.png`, `-411.png` | |
| T-46 | Web 390 e 1280 | N | O mesmo; Esc logo depois de abrir (durante a animação) | A 1280, diálogo central de até 560; o Esc fecha sem requisição e o foco volta ao rádio | `p11-web-T-46-390.png`, `-1280.png` | |

**T-52 · Visibilidade do NPC na lista e na Mesa**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-52 | iOS, iPhone 17 | N, J1 | Criar o NPC → aba Fichas → Mesa; depois, J1 na crônica | N: "NPC" e "Oculto" (depois "Identidade revelada", "Ficha revelada"), nunca "Sua ficha"; Mesa com a seção "NPCs" depois dos PCs. J1: "NPC revelado", sem selo de visibilidade | `p11-ios-T-52-1.png`, `-2.png` | |
| T-52 | Android, 393, 360 e 411 dp | N | Lista e Mesa | O selo e o nome inteiros nas três larguras; no `uiautomator dump`, o `content-desc` da linha da Mesa contém "Oculto" | `p11-android-T-52-*.png` | |
| T-52 | Web 1280 e 390 | N, J1 | Lista (390) e Mesa (1280); "Selecionar personagens" com um PC e o NPC | O cabeçalho "NPCs"; a seleção atravessa as duas seções | `p11-web-T-52-1280.png`, `-390.png` | |

**U-03 · A proposta de narrar aparece para quem a recebeu**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| U-03 | iOS, iPhone 17 | N, N2, J1 | N2 entra com o convite → N, em Bastidores, "Propor" a N2 → N2 abre Crônicas e a crônica → "Recusar" → N propõe de novo → N2 "Aceitar narração" (último passo) | O aviso com os dois botões no topo da lista e da crônica, uma vez só na crônica, nada no Diário; "Recusar" tira os dois avisos; J1 nunca vê o aviso. Depois de aceitar, anotar o que a tela mostra (a atualização é do P09-C, T-40) | `p11-ios-U-03-1.png` … `-4.png` | |
| U-03 | Android, 393 e 360 dp | N, N2 | Os mesmos passos | Os dois botões cabem a 360 | `p11-android-U-03-*.png` | |
| U-03 | Web 1280 e 390 | N, N2, J1 | Os mesmos passos | O mesmo | `p11-web-U-03-*.png` | |

**T-63 · Auditoria em frases**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-63 | iOS, iPhone 17 | N | Bastidores → Auditoria, depois das ações do roteiro (regras, NPC, revelação, sessão, proposta) | "Crônica criada" e "Convite gerado: …" nas crônicas do seed (criadas com o pacote); "Regras da criação: aprovação Desligada → Ligada"; "NPC Figura Velada criado, oculto"; "Figura Velada: Oculto → Identidade revelada"; nenhum código | `p11-ios-T-63-1.png` | |
| T-63 | Android, 393 dp | N | O mesmo; um dano em grupo e "Conceder XP" na Mesa antes | "Dano em grupo: {ficha}"; "{n} XP concedidos a {k} fichas" e "XP lançado na ficha de …" | `p11-android-T-63-1.png` | |
| T-63 | Web 1280 | N | O mesmo; o filtro por ficha | Só as frases da ficha escolhida, com o autor e "às hh:mm" | `p11-web-T-63-1280.png` | |

**T-81 · O "‹" volta para a crônica**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-81 | iOS, iPhone 17 e SE (obrigatório) | N, J1 | N revela só a identidade → J1: crônica → NPC → "‹"; depois, pelo deep link `tms://characters/<id>` → "‹" | Volta à crônica de origem; no `describe-all`, o botão "Voltar para {crônica}". Pelo link também vai para a crônica | `p11-ios-T-81-1.png`, `-link.png` | |
| T-81 | Android, 393 dp | N, J1 | O mesmo, com o "‹" e com o voltar do sistema | Os dois voltam para a crônica | `p11-android-T-81-1.png` | |
| T-81 | Web 390 | N, J1 | O mesmo | `getByRole('tab', { name: 'Fichas' })` da crônica visível | `p11-web-T-81-390.png` | |

**U-04 · Última sessão na lista de crônicas**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| U-04 | iOS, iPhone SE | N, J1 | Depois do T-16 → Crônicas | "Última sessão: 01/11" no cartão, para N e para J1; nada nas crônicas sem sessão | `p11-ios-U-04-1.png` | |
| U-04 | Android, 360, 393 e 411 dp | N | Crônicas | O `meta` quebra sem cortar a data | `p11-android-U-04-*.png` | |
| U-04 | Web 390 e 1280 | N, J1 | Crônicas | O mesmo | `p11-web-U-04-*.png` | |

**Ordem de execução:**

1. web (~30 min);
2. Android (~60 min, mais o APK se não houver um da integração);
3. iOS (~90 min, mais o build e ~15 min para preparar o `idb`).

Em cada plataforma, a ordem é: T-52 (NPC oculto) → T-46 → T-81 → T-15 → T-16 → U-04 → T-63 → U-03, que é o último porque troca o narrador.

### 11f. Acessibilidade mínima

O selo, a folha e o aviso aparecem como texto e com papel na árvore de cada plataforma:

| Onde | O que conferir |
|---|---|
| Web (DOM, `ariaSnapshot`) | A linha da Mesa (`button`) tem "Oculto" no nome. "NPCs" é `heading`. A folha é `dialog`/`aria-modal`, com o título como cabeçalho. O toast fica numa região viva. O aviso da proposta tem os dois `button` com nome |
| Android (`uiautomator dump`) | O `content-desc` ou o `text` da linha contém "Oculto"/"Identidade revelada". O título da folha e os botões são nós próprios, clicáveis, com 48 dp |
| iOS (`describe-all`) | O `AXLabel` da linha contém o selo. O título da folha tem o traço de cabeçalho. "Aceitar narração" e "Recusar" são botões. O "‹" se chama "Voltar para {crônica}" |

### 11g. Limpeza

- Parar a API e o Metro (Ctrl-C nos dois terminais) e conferir que as portas 3001 e 8081 ficaram livres.
- Android:
  - `adb shell wm density reset`;
  - `adb shell settings put secure show_ime_with_hard_keyboard 0`;
  - `adb reverse --remove-all`;
  - `adb emu kill`.
- iOS:
  - `pkill -f idb_companion`, e conferir com o `lsof` que nenhuma porta ficou aberta;
  - `xcrun simctl shutdown all`.
- O venv do `idb` fica fora do repositório, e o `git status` não mostra nada novo do roteiro.
- Os screenshots ficam no scratchpad. São só dados fictícios, sem senha nem código de convite.

### 11h. Plataforma que não puder ser conferida

Se uma plataforma não puder ser conferida (por exemplo, o fb-idb não roda no Python da máquina, o build do iOS falha ou o AVD não sobe), a coluna "Resultado" diz **"não conferido"** e o motivo, com a mensagem de erro. Nunca "ok" sem o screenshot e a árvore de acessibilidade correspondentes. O T-15, o T-16 na edição, o T-46 e o T-81 "não conferidos" no iOS ficam como pendência explícita no resumo do PR da onda.
