# P14-D · Apresentação da crônica para leitura: plano de implementação

> Plano · 2026-11-05 · base conferida: `onda/5-narrador-entrada-uso` em `05c5d7d`

Este plano implementa o pacote [P14-D da matriz de achados](../testes/2026-11-01/matriz-achados.md#p14-d), que aplica a decisão D-15. A matriz ainda o lista na onda 4 (seção "Ondas e pacotes" e §P14-D). Ele ficou fora dela ([onda-4.md](onda-4.md) §6, ponto 1, e §12.7) e entra na onda 5. Este plano não edita a matriz: a mudança de onda fica registrada no onda-5.md e no P01-D. Ao fim do pacote:

- a crônica mostra, para o narrador e para os jogadores, um bloco "Apresentação" com o começo da Descrição e o botão "Ler tudo";
- "Ler tudo" abre uma tela de leitura própria (rota nova `/chronicles/<id>/about`), com a Descrição inteira em texto puro;
- o editor do narrador (Bastidores › Apresentação) avisa, no campo "Descrição", que os jogadores da crônica leem o texto;
- se o PO confirmar (§9, ponto 1), o ex-membro deixa de receber a Descrição e a Imagem na resposta da API, como a D-15 escreve ("só chega a quem é membro").

É um pacote de decisão de produto, pequeno e genérico: a Descrição é de `chronicles`, sem dado de sistema. O pacote **não remove campo, não muda regra do jogo e não afrouxa limite**:

- os limites continuam os de hoje: Nome até 80, Descrição até 4000, Imagem até 2048 e só HTTPS, texto validado pelo `safeText` no servidor;
- nenhuma rota nova na API. A única mudança HTTP proposta **tira** dados de uma resposta (a do ex-membro, §3.6);
- quem lê o quê continua decidido no servidor (`chronicleAccess`). O app só mostra o que a API já manda;
- as Notas do Narrador e as notas privadas da sessão continuam privadas. Nada passa delas para a Descrição.

Todas as linhas citadas são da ponta `05c5d7d`. A matriz cita o `1db3db9`; onde a causa provável dela não vale, a seção 3.0 diz.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md): legenda, "Ondas e pacotes", "Decisões de produto" (D-15), "Como executar" (com "Decisão revista" e "Ondas empilhadas"), §P14-D (l.479-495) e "Onda 5" (l.511-520) | Item, decisão, "PR local" e critério de saída |
| Linha U-09 da matriz (l.492): feedback do narrador da mesa real em 03/11/2026, Android, M20, captura no WhatsApp **não anexada** | Causa, plataforma e o caso (956 caracteres de Descrição salvos e sem leitor) |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) l.384 ("P2: editar nome e descrição", sem teste) | O fluxo nunca foi testado pelas personas |
| Notas: [narrador-app](../testes/2026-11-01/notas/narrador-app.md) (l.81, l.142: "Salvar apresentação" não acionado), [narrador-web](../testes/2026-11-01/notas/narrador-web.md) (l.10, l.78), [po-web](../testes/2026-11-01/notas/po-web.md) (l.30, l.253, l.265) | As personas viram a Apresentação no editor e não a usaram. O U-09 não tem ID de nota |
| Screenshots: `img/narrador-app/24-bastidores-ios.webp` e `img/po-web/104*` | O editor "Apresentação" nos Bastidores, hoje |
| [plano-v5.md](../plano-v5.md) l.32, l.103, l.163, l.167, l.171, l.433 | O ex-membro lê "apenas as próprias fichas arquivadas"; o `PATCH /chronicles/:id`; os atores da matriz de AuthZ (inclui `viewer`) |
| [proximas-features.md](../proximas-features.md) item 12 (l.65) | Upload de imagem hospedada, que resolve a Imagem (§9, ponto 2) |
| [P11](P11-bastidores-npc.md) (Bastidores, NPC oculto, revelação, T-81), [P09-C](P09-C-narrador-mesa.md) (`useSheetBack`, R-09), [P08](P08-layout-teclado.md) §3.14 (modelo do "o que muda") | O código em que o pacote encosta |
| [onda-1.md](onda-1.md) a [onda-4.md](onda-4.md): §6 (pontos para o PO, em aberto), §11 (integração e roteiro manual) | Receitas do roteiro, lições da onda 4 e pontos em aberto |

## 1. Objetivo e itens

**Objetivo (matriz).** A Descrição e a Imagem da crônica podem ser lidas inteiras, por narrador e jogadores, e não só editadas. Pela D-15, o pacote entrega a Descrição. A Imagem não está na D-15 e é o ponto 2 da §9.

| ID | Sev. | Em uma linha | Onde está (conferido em `05c5d7d`) |
|---|---|---|---|
| U-09 | média | A Descrição (até 4000 caracteres) só existe dentro do formulário "Apresentação", nos Bastidores, e só para o narrador. Nenhuma tela a mostra para leitura, e o jogador não a vê em lugar nenhum | O formulário: `components/chronicles/CampaignBackstage.tsx:282-408` (`SettingsForm`), com o `TextArea` "Descrição" em `:319-327`, renderizado só com `narrating` (`:105-115`). A crônica: `app/(app)/chronicles/[id]/index.tsx:217-226` (só sistema e narrador), `:277` (os Bastidores). A API **já manda** a Descrição ao jogador e ao ex-membro: `apps/api/src/chronicles/routes.ts:423-505` (`description` e `imageUrl` no `head`, `:454-463`, também no retorno do `former`, `:464-466`) |

## 2. Decisões aplicadas

| Decisão | O que diz | Como o código acomoda |
|---|---|---|
| D-15 (U-09) | O jogador lê a Descrição inteira, como o narrador, numa tela de leitura com "Ler tudo", sem resumo. O editor avisa que os jogadores leem. A Descrição só chega a quem é membro (AuthZ no servidor) | Bloco "Apresentação" no topo da crônica, com um trecho e "Ler tudo" (§3.2); rota de leitura `about.tsx` com o texto inteiro (§3.1); `hint` no campo "Descrição" (§3.3). A AuthZ já é de membro para narrador e jogadores (`chronicleAccess`, `authz.ts:21-53`); o ex-membro é a exceção (§3.6) |

**Onde a D-15 não se aplica como está escrita (sem decidir; §9):**

1. **O ex-membro já recebe a Descrição.** O `GET /chronicles/:id` devolve o `head` inteiro (com `description` e `imageUrl`) também ao `former` (`routes.ts:464-466`). A D-15 diz "só chega a quem é membro", e o plano-v5 l.32 diz que o ex-membro lê "apenas as próprias fichas arquivadas". O app não mostra a Descrição ao ex-membro (ele não tem abas: `index.tsx:174-176`, `:265-271`), mas o corpo da resposta a carrega. O plano propõe tirá-la (commit 1), como ponto 1 para o PO.
2. **`viewer` não é papel na crônica.** O brief pede que um `viewer` não leia a Descrição. No código, `viewer` é o papel **na ficha de um NPC revelado** (`authz.ts:103-110`), e só existe para quem é membro atual (`row.member_id && row.visibility !== 'hidden'`). Na crônica, ele é `member` e lê a Descrição como qualquer jogador. Tirar a Descrição do `viewer` seria tirá-la de todo membro. O plano mantém, e o ponto 3 da §9 registra a leitura.
3. **A Imagem.** A matriz fala de "Descrição e Imagem"; a D-15, só da Descrição. Mostrar a Imagem esbarra na CSP do web e faz o aparelho do jogador buscar uma URL de terceiro (§5). O plano não a mostra, e o ponto 2 da §9 traz as saídas.

**O que fica fora, e com quem:**

- **"O editor só atrás de 'Editar'"** (recomendação da matriz): o formulário dos Bastidores fica como está. O bloco novo não tem "Editar", para não abrir uma segunda crônica na pilha (§3.1). Fica para depois, sem pacote.
- **"Campo de edição maior no celular"** (recomendação da matriz): é a pergunta técnica 4 (§9). Não entra sem a medida no AVD.
- **O "Orçamento" e o painel "Criação de fichas"** acima das abas: P09-D (D-10, T-36). Este pacote só ocupa o espaço combinado na §8.4.
- **O voltar da crônica** (T-30, achado 6 do onda-3.md §11): P12. A rota nova usa o `useSheetBack` de hoje.
- **A História do personagem** (U-10, D-16): P15-D. O aviso do campo novo segue a mesma família de textos (§3.3).
- **Registrar a D-15 no plano-v5** (o contrato do `GET` muda para o ex-membro): P01-D, que entra por último.

## 3. Desenho por item

### 3.0 O que o código e a API fazem hoje

**Quem recebe o quê no `GET /chronicles/:id`** (`routes.ts:423-505`; AuthZ em `authz.ts:21-53`):

| Quem | Resposta hoje | O que a tela mostra hoje | Depois do pacote |
|---|---|---|---|
| Narrador da crônica | 200, com `description` e `imageUrl` | Só o `TextArea` nos Bastidores (`CampaignBackstage.tsx:319-327`, `minHeight` 120 em `packages/ui/src/TextField.tsx:125`) | Bloco + tela de leitura + editor com o aviso |
| Jogador (membro), inclusive "outro jogador" e o `viewer` de um NPC revelado | 200, com `description` e `imageUrl` (o app recebe e descarta) | Nada | Bloco + tela de leitura |
| Ex-membro (`former`: saiu e tem ficha) | 200, **com** `description` e `imageUrl`, sem `members` nem `creation` (`:464-466`) | Nada (sem abas) | **Sem** `description` e `imageUrl` (os campos saem da resposta; `38fee1d`, pela D-15) |
| Convidado que ainda não entrou | 404: o convite não cria vínculo, e o `chronicleAccess` devolve `null` (`authz.ts:49-52`). O aceite devolve só `chronicleId` e `role` (`routes.ts:700-764`); não há prévia do convite | — | Igual |
| Narrador de outra crônica, estranho | 404 | — | Igual |
| Anônimo | 401 | — | Igual |

- **NPC oculto:** a Descrição é da crônica, não de ficha. A projeção do NPC revelado leva só o id e o nome da crônica (`__tests__/backstage.test.ts:138-190`, T-81), e o NPC oculto não aparece para quem não narra. O que o narrador escrever na Descrição é público para os membros, por escolha dele; o aviso do editor diz isso (§3.3).
- **A lista `GET /chronicles`** não traz a Descrição (`routes.ts:289-421`) e continua sem ela.
- **O cache persistido** (`apps/frontend/lib/persist.tsx:63-75`) só grava templates e fichas. A crônica (`['chronicles', id]`) fica só na memória e some no logout. A tela de leitura usa a mesma chave e não a acrescenta ao disco.
- **A API responde com `cache-control: no-store`** (`apps/api/src/http/security.ts:17`): o navegador não guarda a resposta.

**Os limites (não mudam):**

| Onde | Nome | Descrição | Imagem |
|---|---|---|---|
| App (`CampaignBackstage.tsx`) | `maxLength` 80 (`:317`) | `maxLength` 4000 (`:326`) | sem `maxLength` |
| Schema da rota (`chronicles/backstage.ts:541-546`) | 1 a 80 | até 4000 | até 2048 ou `null` |
| Servidor (`backstage.ts:46-77`, `:478-489`) | `safeText(…, 80, true, true)` | `safeText(…, 4000)` | `httpsUrl`: só `https:` (`:439-441`) |
| Banco (`0019_backstage.ts:167-168`) | — | `text not null default ''` | `text` |

O `safeText` aplica o `isSafeText` do core (`packages/sheet-core/src/validate/safe-text.ts:8-23`): recusa `<` e `>`, controles C0/C1, DEL, controles bidi e os separadores U+2028/U+2029. O `maxLength` do app e o `length` do servidor contam unidades UTF-16, então os dois concordam.

**Onde a causa da matriz está errada ou incompleta:**

- **`SettingsForm` em l.286-396:** na ponta, `:282-408`. O "dentro de `narrating ? …`" está certo (`:105-115`).
- **`index.tsx` l.277 (`narrating`):** o `narrating` é definido em `:171`. A `:277` é onde os Bastidores são renderizados com ele.
- **`backstage.ts` l.80 ("a API entregar a descrição ao jogador não foi conferida"):** a `:80` é o tipo do corpo do `PATCH` em `useUpdateChronicle` (`:73-90`). **Conferido:** a API já entrega a Descrição ao jogador. O defeito é só de tela, e o ex-membro também a recebe (§2, ponto 1).

### 3.1 U-09 · A tela de leitura: rota nova, não folha

**Arquivo novo:** `apps/frontend/app/(app)/chronicles/[id]/about.tsx` (URL `/chronicles/<id>/about`, como o `new-character.tsx` ao lado). Rota, e não `BottomSheet`, porque:

- o texto chega a 4000 caracteres (umas 650 palavras). Numa folha, a rolagem fica dentro da folha, com a altura máxima dela, e no iPhone SE sobra pouca tela;
- o voltar do Android, o gesto do iOS, o voltar do navegador e o F5 no web funcionam sem código novo;
- o link da crônica continua sendo a pilha de sempre: a crônica fica montada embaixo (no nativo) e volta na mesma aba e rolagem.

**O que a tela tem:**

- `AppBar` com o título "Apresentação" (cabeçalho de nível 1, `AppBar.tsx:69-76`), o nome da crônica no `subtitle` e o voltar do `useSheetBack({ id, name })` (`apps/frontend/sheet/navigation.ts:17-30`). O nome acessível do voltar é "Voltar para {crônica}". Sem tela embaixo (link direto, recarga no web), ele abre a crônica.
- Os dados vêm de `useChronicle(id)` (`lib/queries/chronicles.ts:34-39`), a mesma chave da crônica. Vindo do "Ler tudo", não há requisição nova. O foco rebusca, como na crônica (`useRefetchOnFocus`).
- **O texto:** a Descrição em `Text` do `@tms/ui` (`body`), com `selectable` para copiar. Os parágrafos saem de `split(/\r?\n[ \t]*\r?\n/)`: cada um vira um `Text`, com `gap` de `tokens.space[3]`. A quebra simples (`\n`) fica dentro do parágrafo. Nenhum parser: `*`, `#`, `[]()` e URLs aparecem como foram escritos. Sem `Linking`, sem `dataDetectorType` e sem `dangerouslySetInnerHTML`.
- **Largura de leitura:** a coluna segue o `Screen`. A 1280, o texto fica limitado a `tokens.layout.contentMaxMedium` (640) para a linha não passar de uns 90 caracteres.
- **Estados:**
  - carregando: `Skeleton`, como a crônica;
  - 404: "Crônica não encontrada" / "Ela não existe ou você não participa dela." (o mesmo texto de `index.tsx:150-154`). É o que vê o convidado que não entrou, o estranho e o narrador de outra crônica;
  - erro: "Não foi possível carregar a crônica", com "Tentar de novo";
  - `role: 'former'`: `EmptyState` "Você saiu desta crônica", com "A apresentação é só para quem participa.";
  - Descrição vazia: `EmptyState` "Sem apresentação". O jogador lê "O narrador ainda não escreveu a apresentação desta crônica."; o narrador lê "Escreva a apresentação em Bastidores › Apresentação."
- **Sem botão "Editar".** Ir da leitura ao editor pediria `router.replace` para `?view=backstage`, o que deixa duas crônicas na pilha: o mesmo tipo do "três voltar" do P12. O narrador volta pelo "‹" e toca em Bastidores.

O narrador vê exatamente a tela do jogador. É o que a D-15 pede ("como o narrador") e é o que faltou ao narrador do U-09: conferir o que os jogadores leem.

### 3.2 U-09 · O bloco "Apresentação" com "Ler tudo" na crônica

**Componente novo:** `apps/frontend/components/chronicles/ChronicleAbout.tsx`, usado em `index.tsx` dentro do bloco de informação (`:217-226`, depois da linha "Narrador: …" / "Você narra esta crônica."). O lugar exato depende do P09-D (§8.4).

- **Quando aparece:** com `c.role !== 'former'` e `description.trim()` não vazio, para o narrador e para o jogador. Sem Descrição, nada (o bloco não ocupa espaço). O teste de `role` é só defesa em profundidade: com o commit 1, o servidor nem manda a Descrição ao ex-membro.
- **O que tem:**
  - uma linha com a legenda "Apresentação" (`Text` `caption`, `inkMuted`) e, à direita, o botão "Ler tudo" (`Button` `variant="ghost"`);
  - abaixo, o trecho: os primeiros 140 pontos de código da Descrição, cortados no último espaço e com "…" quando o texto é maior, num `Text` com `numberOfLines={2}`.
- **Por que o trecho é cortado no código e não só pelo `numberOfLines`:** o `numberOfLines` só corta o desenho. No web (`-webkit-line-clamp`) e no VoiceOver, o leitor de tela leria os 4000 caracteres a cada visita à crônica. Cortado no código, ele lê no máximo 140 e o "…". O corte usa `Array.from` para não partir um par substituto (emoji, acento composto). A função é `excerpt(text, max)` em `apps/frontend/lib/format.ts`.
- **O trecho não é o "resumo" que a D-15 descarta.** Ele é o começo do texto, e o texto inteiro está a um toque. O "Ler tudo" aparece sempre que há Descrição, mesmo curta: o bloco tem sempre a mesma forma, e a tela de leitura é o lugar de ler (pergunta técnica 3).
- **"Ler tudo":** `router.push('/chronicles/<id>/about')`. O nome acessível é **"Ler tudo: apresentação da crônica"** (`accessibilityLabel`). O nome começa pelo texto visível (WCAG 2.5.3), e diz o que abre. O `accessibilityHint` não serve aqui: o RN-web não o leva ao DOM.
- **Altura:** a linha da legenda tem a altura do botão (44 no web e no iOS, 48 no Android), mais 4 de `gap` e duas linhas de `body` (15/22: 44). Orçamento: **até 104 px no web a 390 e até 112 dp no AVD a 393**, com a fonte a 100%. Com a fonte a 130%, o trecho continua em duas linhas e o bloco cresce só pela altura da linha. Medido no E2E (§4.3) e no AVD (§11).
- **Margem:** o `styles.info` já tem o `padding` de `tokens.layout.gutter` (`index.tsx:454`), o mesmo do T-67.
- **Depois de salvar:** o `useUpdateChronicle` invalida `chronicleKeys.one(id)` (`backstage.ts:84-88`). O bloco e a tela de leitura mostram o texto novo assim que a crônica volta, sem código novo.

### 3.3 U-09 · O aviso no editor do narrador

Em `CampaignBackstage.tsx:319-327`, o `TextArea` "Descrição" ganha `hint="Os jogadores da crônica leem este texto. Segredos ficam nas notas privadas."`.

- O `TextField` desenha a dica abaixo do campo, ao lado do contador "956/4000" (`TextField.tsx:80-108`), e a leva ao `accessibilityHint` no nativo (`:59`). No web, ela é texto visível.
- O texto é da mesma família do R-09 (`sheet/storyteller/privacy.ts:14-15`, "privadas: o jogador não vê") e do "Nunca são enviadas aos jogadores." das notas da sessão (`CampaignBackstage.tsx:254`). O P15-D escreve o do campo "História / Prelúdio" ("o dono da ficha e o narrador leem"). Os três ficam lado a lado na revisão de texto da onda.
- O "Nome" já é lido por todos, inclusive pelo ex-membro e na lista de crônicas, e não precisa de aviso. A "Imagem HTTPS" não aparece para ninguém hoje (§9, ponto 2): sem aviso.

### 3.4 U-09 · O título "Apresentação" e o T-67

O `SectionHeader` "Apresentação" dos Bastidores (`CampaignBackstage.tsx:306-308`) continua com a margem da página (`testID="backstage-header-presentation"`, conferido em `components/chronicles/__tests__/chronicles.layout.test.tsx:41-60`). O bloco novo da crônica usa a mesma palavra como legenda, não como cabeçalho: a crônica não ganha um cabeçalho a mais entre o nome e as abas.

### 3.5 Os tipos no app

- `ChronicleData` em `index.tsx:340-351` ganha `readonly description?: string`.
- Com o commit 1, a resposta do Eden vira uma união: o ramo `former` não tem `description`. O acesso usa `'description' in c`, como o `'creation' in chronicle.data` de `new-character.tsx:71-74`.
- `ChronicleInfo` de `CampaignBackstage.tsx:30-42` já tem `description?` e `imageUrl?` opcionais: não muda.

### 3.6 A API HTTP: o que muda

Só o `GET /chronicles/:id`, e só para o ex-membro. **Condicionado ao ponto 1 da §9.** Sem a confirmação do PO, o commit 1 sai do pacote e a matriz de AuthZ registra o `former` como quem lê (§4.1).

| Rota | Quem | Hoje | Depois | Compatibilidade |
|---|---|---|---|---|
| `GET /chronicles/:id` | `former` | `{ id, name, system, storyteller, description, imageUrl, options, settingsRevision, role: 'former', members: [] }` | Sem `description` e `imageUrl`. O resto igual | O app da loja não lê a Descrição do ex-membro em lugar nenhum (sem abas): nada quebra. O tipo do Eden muda (§3.5) |
| `GET /chronicles/:id` | narrador, membro | igual | igual | — |
| `PATCH /chronicles/:id` | narrador | igual | igual, com os mesmos limites | — |
| `GET /chronicles` | todos | sem Descrição | igual | — |

**Como:** em `routes.ts:454-466`, o `head` se divide em `base` (id, nome, sistema, narrador, opções e revisão) e `presentation` (`description`, `imageUrl`). O `former` recebe só `base`; o narrador e o membro, os dois. É o mesmo padrão do `lastSession` da lista, que o ex-membro já não recebe (`routes.ts:412-414`, "o ex-membro não acompanha a crônica", plano-v5 §3.5). O Swagger se atualiza sozinho.

**O que não muda e fica registrado:** o ex-membro continua recebendo `options` e `settingsRevision` (as regras da casa). Não é da D-15 e não entra aqui; vai como observação ao PO no ponto 1.

### 3.7 O que não muda

- Nenhuma prop do `@tms/ui` muda. O pacote usa `Text`, `Button`, `AppBar`, `EmptyState`, `Skeleton` e `Screen` como estão. Não há build nativo novo por causa do pacote.
- Nenhum template, nenhum `schema.json`, nenhuma migration, nenhuma versão de template.
- Nenhum log novo. A Descrição não entra em log nem em Sentry (§5).

## 4. Testes

### 4.1 Um teste de regressão por item (falha em `05c5d7d`, passa depois)

| Item | O que o teste prova | Arquivo | Runner |
|---|---|---|---|
| U-09 (AuthZ, três sistemas) | Na matriz: a crônica do cenário ganha uma Descrição-sentinela (`marca-descricao-da-cronica-…`, gravada no banco). O `GET /chronicles/:id` do narrador, da dona e do outro jogador traz a sentinela; **nenhuma** resposta de nenhuma rota ao `former`, ao `otherStoryteller`, ao `stranger` e ao `anonymous` a traz (no `check`, ao lado do `SECRET` e do `HIDDEN_NPC`, `authz.test.ts:210-240`). Roda em `vtm-v20`, `mta-m20` e `wta-w20` (`MATRIX_SYSTEMS`). **Falha hoje no `former`** (200 com a Descrição) | `apps/api/src/__tests__/authz.test.ts`, `apps/api/src/test/authz-matrix.ts` (comentário da linha `:57-68`) | Bun em PGLite |
| U-09 (`viewer` e NPC oculto, três sistemas) | Com um NPC revelado (`identity` e depois `full`), o jogador que é `viewer` dele lê a Descrição no `GET /chronicles/:id`; o `GET /characters/:npcId` do `viewer` não traz a Descrição; com o NPC `hidden`, o nome do NPC não aparece em nenhuma resposta ao jogador, mesmo com a Descrição lida | `apps/api/src/__tests__/backstage.test.ts` (laço em `MATRIX_SYSTEMS`) | Bun em PGLite |
| U-09 (convidado que não entrou) | Convite gerado e não aceito: o convidado recebe 404 no `GET /chronicles/:id`, igual ao de uma crônica inexistente, e o corpo não traz a sentinela; depois do aceite, 200 com ela | `apps/api/src/__tests__/chronicles.test.ts` (perto de `:325-366`) | Bun em PGLite |
| U-09 (ex-membro) | O detalhe do `former` não tem `description` nem `imageUrl` (`not.toHaveProperty`); quem volta pelo convite lê de novo | `apps/api/src/__tests__/members.test.ts:247-250` | Bun em PGLite |
| U-09 (limites) | O `PATCH` com 4000 caracteres passa; com 4001, 422 sem gravar; com `<`, 422 "texto inválido" sem ecoar o texto. Já coberto em parte (`backstage.test.ts:816`): o teste novo fixa os 4000 | `backstage.test.ts` | Bun em PGLite |
| U-09 (bloco) | Narrador e jogador com Descrição de 600 caracteres: legenda "Apresentação", trecho de até 140 com "…", botão "Ler tudo: apresentação da crônica"; o toque chama `router.push('/chronicles/<id>/about')`. Sem Descrição, ou só espaços, nada. Com `role: 'former'` e Descrição no mock, nada. **Falha hoje** (não há bloco) | `apps/frontend/app/__tests__/chronicles.test.tsx` ("Crônica (detalhe)", `:521`) | Jest + RNTL |
| U-09 (leitura) | A tela mostra o título "Apresentação" (cabeçalho), o nome da crônica, os três parágrafos de uma Descrição com `\n\n` em três `Text`, o `*` e o `[x](https://exemplo.test)` literais e nenhum elemento com papel `link`; 404 com "Crônica não encontrada"; `former` com "Você saiu desta crônica"; vazia com o texto do narrador e o do jogador; o voltar com "Voltar para {crônica}" | `apps/frontend/app/__tests__/chronicle-about.test.tsx` (novo) | Jest + RNTL |
| U-09 (trecho) | `excerpt`: texto curto volta igual; corta no último espaço antes de 140; não parte um emoji nem um par substituto; sem espaço, corta em 140; acrescenta "…" só quando corta | `apps/frontend/lib/__tests__/format.test.ts` | Jest |
| U-09 (aviso) | O campo "Descrição" do narrador tem a dica "Os jogadores da crônica leem este texto. …" visível e no `accessibilityHint`. **Falha hoje** (sem dica) | `apps/frontend/components/chronicles/__tests__/CampaignBackstage.test.tsx` (perto de `:255`) | Jest + RNTL |
| U-09 (seed) | `--apresentacao` grava as Descrições da §11.a com os tamanhos certos, todas aceitas pelo `isSafeText`, só nas crônicas do roteiro; sem a opção, nada muda | `apps/api/src/__tests__/seed-roteiro.test.ts` | Bun em PGLite |

### 4.2 Testes existentes que mudam junto

- **`authz-matrix.ts:57-68`:** o comentário "O ex-membro lê o nome, o sistema e o narrador, sem os membros" passa a dizer "e sem a Descrição e a Imagem". O status do `former` continua 200.
- **`members.test.ts:250`:** o `toMatchObject` continua passando; ganha o `not.toHaveProperty('description')`.
- **`chronicles.test.ts:326-350`:** o `toEqual` do jogador não muda (`description: ''`, `imageUrl: null`).
- **`CampaignBackstage.test.tsx:615`** (o jogador não vê "Apresentação" nos Bastidores): continua valendo. O bloco novo fica no `index.tsx`, não no `CampaignBackstage`.
- **`app/__tests__/chronicles.test.tsx`:** o mock de "Crônica (detalhe)" (`:522-533`) não tem Descrição, então os testes de hoje não veem o bloco. Os casos novos passam a Descrição no mock.
- **E2E:** `journey-backstage.spec.ts:343-355` grava "Uma campanha sobre segredos." e depois abre a crônica como narrador (`:364`). O bloco passa a aparecer ali. Os seletores dele (`getByRole('tab', …)`, `getByText('A noite do oráculo')`, `getByText('Apresentação da crônica alterada')`) não casam com o bloco: a legenda "Apresentação" não contém "Apresentação da crônica alterada", e o `getByText` não lê o `aria-label` do botão. Conferir na integração; nenhum ajuste previsto.
- **E2E que medem o topo da crônica** (`narrator.spec.ts`, `table.spec.ts`, `layout.spec.ts`, os `journey-*` que abrem a crônica como narrador): as crônicas deles não têm Descrição, então nada muda. Quem os ajusta pelo painel recolhido e pelas abas no topo é o P09-D.

### 4.3 E2E novo: `e2e/tests/chronicle-about.spec.ts` (Chromium e WebKit)

Contra o export web com a CSP de produção (`dist/_headers`) e a API real, com contextos separados (como o `journey-backstage.spec.ts:14-30`): narrador, jogador, ex-membro e convidado.

1. **Preparação pela API:** o narrador cria a crônica e grava pelo `PATCH` uma Descrição fictícia de três parágrafos, com uma linha `*isto não é negrito* [nem link](https://exemplo.test)`. O jogador entra pelo convite. O ex-membro entra, cria uma ficha e sai. O convidado recebe um convite e não o aceita. O código do convite não vai para o log do teste.
2. **Jogador a 390:** na crônica, `getByRole('button', { name: 'Ler tudo: apresentação da crônica', exact: true })`; o trecho visível termina em "…". O bloco mede até 104 px (`boundingBox`), e a `tablist` "Visão da crônica" começa logo abaixo. O clique leva a `/chronicles/<id>/about`; `getByRole('heading', { name: 'Apresentação', level: 1 })`; o último parágrafo fica visível depois de rolar. Dentro do conteúdo, `locator('a')` conta 0 e o `*` aparece literal. F5 mantém a tela; o voltar do navegador e o "Voltar para {crônica}" levam à crônica, na aba de antes.
3. **Narrador a 1280:** Bastidores › "Descrição": a dica "Os jogadores da crônica leem este texto." visível sob o campo. Acrescenta uma frase, "Salvar apresentação", e a tela de leitura mostra a frase. A coluna de texto mede até 640 px de largura.
4. **Ex-membro a 390:** a resposta do `GET /chronicles/<id>` (pelo `page.waitForResponse`) não contém a sentinela da Descrição (o teste só procura a frase, não a imprime). Sem "Ler tudo" na crônica. A URL `/about` direta mostra "Você saiu desta crônica".
5. **Convidado que não entrou, a 390:** a URL `/chronicles/<id>/about` mostra "Crônica não encontrada", e a resposta é 404.
6. **Atributos no DOM** (o que o Jest não pega no web): o botão tem `aria-label="Ler tudo: apresentação da crônica"`; o trecho no DOM tem no máximo 141 caracteres (o leitor de tela não recebe os 4000); o texto de leitura não tem `innerHTML` com tag (o `<` nem chega ao banco: o `PATCH` com `<b>` volta 422).

Seletores com `exact` onde o texto se repete ("Apresentação" é a legenda da crônica, o título da tela de leitura e o cabeçalho dos Bastidores).

### 4.4 Suítes do "PR local" e cobertura

```bash
npx pnpm turbo run typecheck lint --filter=@tms/api --filter=frontend --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=@tms/api --filter=frontend
npx pnpm -C apps/frontend exec jest --forceExit app/__tests__/chronicle-about.test.tsx app/__tests__/chronicles.test.tsx
```

- **As metas são por arquivo.** App: 70/70/60/70 no global e 80/80/70/80 em `./sheet/` (`apps/frontend/jest.config.js:40-43`); a rota e o componente novos nascem com teste. API: `bunfig.toml`.
- **`.test.tsx` em `components/`.** O `testMatch` só pega `.test.tsx` ali (`jest.config.js:24`). O `excerpt` fica em `lib/` e o teste em `lib/__tests__/format.test.ts`, que o `testMatch` pega (`:22`).
- **Jest pelo `pnpm test`** não encerra sozinho (onda-4.md §11): na integração, `--forceExit`.
- **O `random.test.ts`** do sheet-core é instável e não é desta onda.
- O E2E inteiro (Chromium e WebKit) roda na integração, um por vez (portas fixas 3101 e 8181).

## 5. Segurança

O pacote muda a resposta de uma rota com AuthZ e abre um texto livre do narrador a todos os membros. **Passa por `/security-review` antes do merge**, além do `/code-review`. Foco: `routes.ts` (o `GET /chronicles/:id`), a matriz de AuthZ, `about.tsx` e `ChronicleAbout.tsx`.

| O que pode dar errado | Como o desenho evita |
|---|---|
| A Descrição chega a quem não é membro (estranho, narrador de outra crônica, convidado que não entrou) | O `chronicleAccess` decide no banco, a partir do usuário da sessão (`authz.ts:21-53`); sem vínculo, 404 sem dado. A matriz prova nos três sistemas que nenhuma resposta de nenhuma rota a esses atores traz a sentinela (§4.1) |
| O ex-membro continua recebendo o texto da crônica de que saiu | Commit 1: o `former` recebe só a base (§3.6), com a sentinela na matriz. O app também não mostra o bloco a ele (defesa em profundidade, não a autoridade) |
| A Descrição vira HTML, script, markdown ou link clicável (XSS, phishing) | O servidor recusa `<`, `>`, controles e bidi (`safeText`, `isSafeText`). O app desenha em `Text` do RN: o React escapa o texto no web, sem `dangerouslySetInnerHTML`, sem parser de markdown, sem `Linking` e sem `dataDetectorType`. Uma URL escrita na Descrição é texto, não link. A CSP do web (`script-src 'self'`, `scripts/web-headers.mjs:47-58`) fica como está |
| Texto bidi falsifica o que se lê | Os controles bidi (U+202A-202E, U+2066-2069) são recusados no servidor |
| Texto enorme trava a tela ou o leitor de tela | 4000 no app, no schema da rota e no servidor (§3.0). O trecho do bloco é cortado no código em 140 (§3.2) |
| O narrador expõe um segredo sem querer (o nome de um NPC oculto, o prelúdio) | O aviso no editor (§3.3). Nada passa das Notas do Narrador nem das notas da sessão para a Descrição: só o que o narrador digita no campo |
| O texto fica no aparelho depois de sair da crônica ou do logout | A crônica não entra no cache persistido (`persist.tsx:63-75`), e o plano não muda o `persistable`. A API responde `no-store`. O jogador removido com a tela aberta vê o texto até a próxima busca (foco ou puxar), que volta `former` ou 404 |
| A Descrição vaza para a telemetria | Nenhum log novo. O `scrubLog` da API remonta a linha por lista de campos, sem corpo (`apps/api/src/telemetry.ts:167-180`); a API só manda 5xx ao Sentry. No web, o filtro remonta o evento e o breadcrumb de navegação leva só o caminho, sem query (`apps/frontend/lib/telemetryFilter.ts`): a rota `/chronicles/<uuid>/about` não tem texto do usuário. A recusa "texto inválido" não ecoa o texto |
| A Imagem do narrador vira rastreador (o aparelho do jogador busca uma URL de terceiro e entrega IP, horário e agente) | O pacote **não desenha a Imagem** (§9, ponto 2). A CSP do web (`img-src 'self' data:`) continua como está, sem afrouxar |
| IDOR pela URL nova (`/chronicles/<id>/about` com o id de outra crônica) | A rota do app só lê o `GET /chronicles/:id`, que aplica a AuthZ. Id malformado é recusado antes do banco (`idParams`, matriz `authz.test.ts:347`) |

**Checklist da organização:**

- **AuthZ no servidor em toda rota:** nenhuma rota nova; a resposta do `GET` fica mais restrita, não mais aberta.
- **Validação no servidor:** os limites e o `safeText` de hoje, sem mudança.
- **Fail secure:** papel desconhecido no app cai no estado sem bloco; 404 e erro mostram a mensagem genérica.
- **Logs sem PII, senha, token ou código de convite:** nada novo. O E2E e o roteiro não imprimem o código do convite.
- **Erros sem stack trace:** as mensagens de sempre ("Crônica não encontrada", "texto inválido").
- **Dependências:** nenhuma nova.
- **LGPD:** a Descrição é texto livre que o narrador escreve para a mesa. O aviso diz quem lê. O seed e os testes usam só texto fictício, sem texto de livro.

## 6. Como generaliza além do WoD

- **Genérica.** A Descrição é uma coluna de `chronicles` (`0019_backstage.ts:167`), sem dado de sistema. A tela de leitura, o bloco e o aviso valem para qualquer sistema: D&D, Call of Cthulhu ou Fate leem a apresentação da campanha do mesmo jeito.
- **Sem template.** Nada vem do `trait_templates`. Um sistema novo não pede nada deste pacote.
- **O vocabulário.** "Crônica" é a palavra do produto para campanha (CLAUDE.md, Storyteller System). A tela diz "Apresentação" e "Ler tudo", que não são termos do WoD.
- **A matriz de AuthZ** roda nos três sistemas do produto (`MATRIX_SYSTEMS`), e a sentinela não depende de campo de sistema.

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado**, com as respostas do PO aos pontos 1 a 4 da §9. Arquivos e linhas conferidos em `05c5d7d` (seção 3).
2. **Typecheck, lint e testes** de `@tms/api`, do frontend e do E2E (§4.4).
3. **Um teste de regressão por item** (§4.1), falhando em `05c5d7d`, e o `test:coverage` verde.
4. **`/code-review` e `/security-review`** no diff do pacote. Os achados vão no resumo.
5. **Os cenários das personas, repetidos sem o defeito.** O U-09 veio do narrador da mesa real (Android, M20, 03/11). As personas N-A (`narrador-app.md`, iOS) e N-W (`narrador-web.md`) viram a Apresentação nos Bastidores e não a salvaram (narrador-app l.142). O cenário é repetido com as contas do seed (§11):

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | U-09 | Narrador da mesa real (feedback de 03/11), repetido pelo N no AVD a 393: "Mago v4" com a Descrição longa → crônica → "Ler tudo" | O bloco com o trecho e "Ler tudo"; a tela "Apresentação" com o texto inteiro, até o último parágrafo; o voltar do Android volta à crônica, na mesma aba |
   | U-09 | O mesmo narrador: Bastidores › Apresentação → escrever e salvar → conferir | A dica "Os jogadores da crônica leem este texto." sob o campo; o texto novo na tela de leitura |
   | U-09 | Jogador da mesma crônica (o "jogador não lê" do U-09), repetido por J1 no web 390 e no iOS SE | J1 vê o mesmo bloco e a mesma tela de leitura que o N |
   | U-09 | N-W, fase 2 do Narrador (`narrador-web.md` l.74-78), web 1280 | O bloco não empurra o aviso de revisão nem as abas além do orçamento da §3.2 |
   | U-09 (AuthZ) | Ex-membro e convidado que não entrou (sem nota; plano-v5 l.32 e D-15), web 390 | O ex-membro não recebe nem vê a Descrição; o convidado vê "Crônica não encontrada" |

   **O critério de saída da onda** ("a fase 2 do Narrador repetida no app e no web") toca este pacote só no topo da crônica: o N-A e o N-W acompanham a Mesa com o bloco presente, na crônica com Descrição.
6. **Conferência no aparelho.** O roteiro completo está na **§11**. O U-09 foi visto no Android: lá é obrigatório.
7. **Resumo para a seção do pacote no PR da onda:**
   - o que mudou e como foi testado;
   - a mudança da API para o ex-membro (§3.6), ou a ausência dela, conforme o PO;
   - os achados das duas revisões;
   - a medida do bloco a 390 e a 393 com o P09-D;
   - os pontos para o PO que seguem abertos.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

Cada commit diz tudo o que entra nele. Nenhum commit mexe em template, então "por sistema" vale só para os testes e o seed, que estão escritos abaixo.

| # | Commit | O que entra (por arquivo e por sistema) | Itens | Esforço |
|---|---|---|---|---|
| 1 | `fix(api): o ex-membro não recebe a Descrição nem a Imagem da crônica` | `apps/api/src/chronicles/routes.ts` (o `head` em `base` e `presentation`, `:454-466`); `apps/api/src/__tests__/authz.test.ts` (a sentinela na crônica do cenário e no `check`, nos três sistemas: `vtm-v20`, `mta-m20`, `wta-w20`); `apps/api/src/test/authz-matrix.ts` (comentário da linha do `GET`); `members.test.ts` (ex-membro sem os dois campos, e de volta pelo convite); `chronicles.test.ts` (convidado que não entrou); `backstage.test.ts` (o `viewer` nos três sistemas e os 4000). **Se o PO recusar o ponto 1:** sai o `routes.ts`, e a sentinela do `former` fica como "lê" na matriz, com o motivo no §10 | U-09 | P |
| 2 | `feat(app): aviso "os jogadores leem" no editor da Descrição` | `apps/frontend/components/chronicles/CampaignBackstage.tsx` (o `hint`, `:319-327`); `CampaignBackstage.test.tsx` | U-09 | P |
| 3 | `feat(app): tela de leitura da apresentação da crônica` | `apps/frontend/app/(app)/chronicles/[id]/about.tsx` (novo); `apps/frontend/lib/format.ts` (`excerpt` e `paragraphs`); `app/__tests__/chronicle-about.test.tsx` (novo); `lib/__tests__/format.test.ts` | U-09 | P |
| 4 | `feat(app): bloco "Apresentação" com "Ler tudo" no topo da crônica` | `apps/frontend/components/chronicles/ChronicleAbout.tsx` (novo); `app/(app)/chronicles/[id]/index.tsx` (o bloco no lugar da §8.4 e o tipo `ChronicleData`, `:340-351`); `app/__tests__/chronicles.test.tsx` | U-09 | P |
| 5 | `chore(seed): --apresentacao com Descrições fictícias` | `scripts/seed-roteiro.ts` (a opção, o comentário do topo e o `PATCH` nas crônicas da §11.a: "Vampiro v3/v5" curta, "Mago v4" longa, "Lobisomem v4" com 4000; as outras três vazias); `apps/api/src/__tests__/seed-roteiro.test.ts` | U-09 | P |
| 6 | `test(e2e): leitura da apresentação da crônica` | `e2e/tests/chronicle-about.spec.ts` (novo) | U-09 | P |

**Por que esta ordem:**

- A API (1) vem antes do app, que estreita o tipo da união (3, 4).
- O aviso (2) é independente e pode sair sozinho.
- A tela de leitura (3) vem antes do bloco (4), que a abre.
- O bloco (4) é o único commit que toca o `index.tsx`: ele entra depois do P09-D (§8.4), que reorganiza o topo da crônica.
- O seed (5) e o E2E (6) fecham o pacote.

### 8.2 Esforço

**P, de 2 a 3 dias de desenvolvimento**, em 6 commits pequenos. A matriz diz 1 P, e o código confirma: a API já manda a Descrição ao jogador, e o pacote é de tela, mais um ajuste de AuthZ e os testes nos três sistemas.

Passa a **M (4 a 5 dias)** se o PO pedir a Imagem nesta onda (§9, ponto 2): a Imagem pede o desenho no nativo, a decisão sobre o web (a CSP) e um teste de privacidade.

### 8.3 Riscos

| Risco | Efeito | Mitigação |
|---|---|---|
| O bloco empurra as abas de novo para baixo, contra o T-36 do P09-D | A Mesa e o aviso de revisão saem da dobra a 390 | Orçamento de altura (§3.2), medido no E2E e no AVD; o lugar combinado com o P09-D (§8.4) |
| O leitor de tela lê a Descrição inteira no topo da crônica | Cada visita custa minutos de fala | O trecho cortado no código (§3.2), com teste do DOM (§4.3, passo 6) |
| O PO recusa o ponto 1 | O ex-membro continua recebendo a Descrição | O commit 1 cai sem afetar os outros; a matriz registra o `former` como "lê" e o resumo diz por quê |
| O texto do narrador tem um segredo | O jogador lê o que não devia | O aviso no editor; nada é copiado de campo privado |
| O `split` dos parágrafos trata mal o `\r\n` do Android ou do web | Parágrafo colado ou linha em branco a mais | O teste do `paragraphs` com `\n\n`, `\r\n\r\n` e linha só com espaços |
| Conflito no `seed-roteiro.ts` com outros pacotes da onda | Merge manual | Cada opção num bloco próprio, com o seu teste (§8.4) |

### 8.4 Conflitos com os pacotes da onda

| Pacote | Onde encosta | Acordo proposto |
|---|---|---|
| **P09-D** (D-10, T-36) | `app/(app)/chronicles/[id]/index.tsx`: o topo da crônica (`:217-261`), o painel "Criação de fichas" (`:234-240`) recolhido num resumo de uma linha e as abas no topo | **Onde fica a Descrição:** o bloco vai **logo depois das linhas de sistema e narrador** (`styles.info`, `:217-226`) e antes do que o P09-D deixar acima das abas (o resumo de uma linha do painel). Se o P09-D subir as abas para cima do bloco de informação, o bloco vai para o **topo do painel "Fichas"** (a aba padrão do narrador e do jogador), nunca dentro da Mesa. O orçamento de altura é o da §3.2 (até 104 px a 390, até 112 dp a 393). **Ordem:** o P09-D entra antes; o commit 4 deste pacote faz o rebase no topo novo. As medidas das abas a 390 que o P09-D fizer na onda passam a ser feitas também na crônica com Descrição (seed `--apresentacao`, "Mago v4") |
| **P12** (T-30, D-14) | O voltar da crônica (`index.tsx:137`) e o achado 6 do onda-3.md §11 (três "voltar"); o convite (`join.tsx`, `InviteSheet.tsx`) | A rota nova usa o `useSheetBack` (`sheet/navigation.ts:17-30`) e não usa `setParams`. Se o P12 mudar o `useSheetBack` ou movê-lo para `lib/`, a rota `about.tsx` vai junto, e o "X-volta" do P12 inclui crônica → "Ler tudo" → "‹". **Se o P12 criar uma prévia do convite** (o nome da crônica antes de entrar), ela não leva a Descrição nem a Imagem: o convidado não é membro (D-15) |
| **P15-D** (D-16, U-10) | O texto do aviso do campo "História / Prelúdio" | Sem arquivo em comum. Os avisos de público × privado (§3.3) são revistos juntos na integração |
| **P16-D** (D-17) | Revelar uma nota privada | Sem arquivo em comum. A Descrição continua sendo um texto público à parte; nada das Notas passa para ela |
| **P13** | — | Sem arquivo em comum |
| **P01-D** (D-13) | `doc/plano-v5.md` (o contrato do `GET /chronicles/:id` para o ex-membro) e o registro da D-15 | O P01-D registra a D-15 e a mudança do commit 1 (ou a recusa) a partir do resumo deste pacote. O P14-D não edita os planos v0 a v5 |
| **Seed** (P09-D, P13 e outros que acrescentarem opção) | `scripts/seed-roteiro.ts` e `seed-roteiro.test.ts` | Cada opção num bloco próprio do `main` e com o seu teste; o `--apresentacao` não gera convite nem conta nova |

**Specs do E2E:** este pacote cria o `chronicle-about.spec.ts` e não muda spec existente (§4.2). Os specs que mudam pelo painel recolhido e pelas abas no topo (`narrator.spec.ts`, `journey-storyteller.spec.ts`, `table.spec.ts`, `layout.spec.ts`, os `journey-*`) são do P09-D. Se o P09-D entrar antes, o passo 2 do spec novo (a `tablist` logo abaixo do bloco) já usa o topo dele.

### 8.5 Arquivos tocados

| Arquivo | Commit | O que muda |
|---|---|---|
| `apps/api/src/chronicles/routes.ts` | 1 | O ex-membro sem `description` e `imageUrl` no `GET /chronicles/:id` |
| `apps/api/src/__tests__/authz.test.ts`, `apps/api/src/test/authz-matrix.ts` | 1 | Sentinela da Descrição nos três sistemas |
| `apps/api/src/__tests__/members.test.ts`, `chronicles.test.ts`, `backstage.test.ts` | 1 | Ex-membro, convidado, `viewer`, limites |
| `apps/frontend/components/chronicles/CampaignBackstage.tsx` (+ teste) | 2 | O aviso no campo "Descrição" |
| `apps/frontend/app/(app)/chronicles/[id]/about.tsx` (novo) | 3 | A tela de leitura |
| `apps/frontend/lib/format.ts` (+ `lib/__tests__/format.test.ts`) | 3 | `excerpt` e `paragraphs` |
| `apps/frontend/app/__tests__/chronicle-about.test.tsx` (novo) | 3 | Testes da tela |
| `apps/frontend/components/chronicles/ChronicleAbout.tsx` (novo) | 4 | O bloco com "Ler tudo" |
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` (+ `app/__tests__/chronicles.test.tsx`) | 4 | O bloco no topo; o tipo `ChronicleData` |
| `scripts/seed-roteiro.ts` (+ `apps/api/src/__tests__/seed-roteiro.test.ts`) | 5 | `--apresentacao` |
| `e2e/tests/chronicle-about.spec.ts` (novo) | 6 | E2E |

Nenhum arquivo do `@tms/ui`, do `@tms/sheet-core`, do `@tms/db`, dos templates ou do `design/`.

## 9. Perguntas abertas

**Pontos para o PO (nenhum decidido neste plano):**

1. **O ex-membro recebe hoje a Descrição e a Imagem** (§2, ponto 1; §3.6). A D-15 diz que a Descrição só chega a quem é membro, e o plano-v5 l.32 diz que o ex-membro lê só as próprias fichas. **Recomendação técnica:** tirar (commit 1). O app não usa o dado, a resposta fica mais restrita e o padrão já existe no `lastSession`. **Observação:** o ex-membro também recebe as regras da casa (`options`, `settingsRevision`), que não são da D-15 e ficam como estão.
2. **A Imagem da crônica.** A matriz pede "Descrição e Imagem"; a D-15 fala só da Descrição. Hoje a Imagem não aparece para ninguém (só o campo de texto do editor). As saídas:
   - **(a, recomendada)** fica fora desta onda e entra com o upload hospedado ([proximas-features.md](../proximas-features.md), item 12), que serve o arquivo do próprio domínio e cabe na CSP;
   - (b) desenhar no nativo com `Image`, como o retrato do `Avatar` (`packages/ui/src/Avatar.tsx:38-43`), e não no web: a CSP `img-src 'self' data:` bloqueia, e as plataformas ficam diferentes;
   - (c) afrouxar o `img-src` do web para `https:`. **Não recomendado:** é afrouxar um limite de segurança.

   Em (b) e (c), o aparelho de cada jogador busca a URL que o narrador escolheu, e o dono do servidor recebe o IP, o horário e o agente de quem leu (rastreador). O plano não desenha a Imagem até a resposta.
3. **O `viewer` lê a Descrição** (§2, ponto 2). O `viewer` é o papel de um membro na ficha de um NPC revelado, nunca um papel na crônica. Pela D-15, ele lê como qualquer membro. O plano mantém isso, com o teste da §4.1. Se a intenção era outra (por exemplo, um papel de "espectador" da crônica), é recurso novo, fora deste pacote.
4. **O lugar do bloco no topo da crônica**, com o P09-D (§8.4): logo depois de sistema e narrador (recomendado), ou no topo do painel "Fichas". As duas formas mostram o bloco ao jogador na aba padrão. Só a primeira o mostra também nos Bastidores e na Mesa.

Os pontos para o PO das ondas 1 a 4 ([onda-1.md](onda-1.md) §6 a [onda-4.md](onda-4.md) §6) seguem em aberto. Nenhum deles toca este pacote. O ponto 1 do onda-4.md §6 (o P14-D fora da onda 4) se resolve com a entrada dele na onda 5.

**Perguntas técnicas:**

1. **Rota em vez de folha** (§3.1): a folha manteria a crônica visível atrás, mas o texto de 4000 caracteres rola mal numa folha no iPhone SE, e a rota dá o voltar das três plataformas sem código. Proposta: rota.
2. **O tamanho do trecho** (140 pontos de código, §3.2): a 390, duas linhas cabem uns 100 caracteres, então o `numberOfLines` corta antes; a 1280, as duas linhas mostram o trecho inteiro. Proposta: 140, conferido no E2E.
3. **"Ler tudo" sempre, ou só quando o trecho corta.** Sempre deixa o bloco previsível e a tela de leitura como o lugar de ler; só quando corta poupa um toque em textos curtos. Proposta: sempre.
4. **O campo de edição maior no celular** (recomendação da matriz). O `TextField` repassa o `numberOfLines` ao `TextInput` (`TextField.tsx:42-43`, `...rest`): no Android ele fixa o mínimo de linhas e no web vira `rows`; no iOS, o campo já cresce com o texto. Proposta: medir no AVD a caixa com o texto de 956 caracteres; se ela rolar por dentro, `numberOfLines={8}` só na "Descrição", no commit 2. Sem mudança no `@tms/ui`.
5. **O `useSheetBack` fora da ficha.** Ele mora em `sheet/navigation.ts` e é genérico. Proposta: importar de lá, sem mover; se o P12 o mover para `lib/`, a rota vai junto.
6. **A tela de leitura offline.** A crônica não é persistida (§3.0), então sem rede e depois de reabrir o app a tela mostra o erro de sempre. Proposta: manter. Persistir a Descrição seria guardar no aparelho um texto que a AuthZ pode tirar depois (o jogador removido).

**Achados da onda 4 sem correção ([onda-4.md](onda-4.md) §11, itens 1 a 7):** nenhum toca este pacote. Do que ficou não conferido, toca o anúncio do VoiceOver e do TalkBack: o nome de "Ler tudo" fica conferido na árvore (§11.f), e ouvir a fala fica para o aparelho. A lição do A3 (o RN-web só dispara `onLayout` com mudança de tamanho) não pega aqui: o bloco chega com a mesma consulta da crônica e não muda a altura depois. A higiene do idb (o `describe-all` mostra o valor dos campos) vale para o login do roteiro (§11.d).

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

Implementação em 05/11/2026, na `pacote/p14-d-cronica-leitura` (base `52dbe0f`), em paralelo com os outros pacotes da onda. Os pontos para o PO e as perguntas técnicas seguiram a recomendação deste plano; nada foi decidido aqui, salvo o ponto 1 da §9, aplicado pelo orquestrador a partir da D-15 (item 1 abaixo).

**O ex-membro e a D-15:**

1. **O commit 1 entrou em duas partes.** Primeiro só os testes (`3b9f407`), com o ex-membro registrado como quem lê o detalhe, porque o ponto 1 da §9 (o ponto 5 do [onda-5.md](onda-5.md) §6) estava em aberto. Depois, pela revisão de código do orquestrador, a mudança do §3.6 (`38fee1d`): a D-15 da matriz diz que "a Descrição só chega a quem é membro da crônica (AuthZ no servidor)", e o plano-v5 l.32 diz que o ex-membro lê só as próprias fichas arquivadas. No `GET /chronicles/:id`, o `former` recebe o `head` sem `description` e `imageUrl` (os campos saem da resposta, como os `members` e o `lastSession`); o narrador e o membro recebem o `head` mais a Apresentação. A matriz de AuthZ, nos três sistemas, proíbe a sentinela da Descrição ao ex-membro em todas as rotas; o `members.test.ts` confere os dois campos ausentes e a leitura de volta depois do convite; o E2E confere a resposta do ex-membro. O ex-membro continua recebendo `options` e `settingsRevision` (fora da D-15, §3.6). O app filtra pelo `role` também (defesa em profundidade).

**O que ficou fora, e por quê:**

2. **A Imagem** (ponto 2): fora, como recomendado. A CSP não mudou.
3. **O campo maior no celular** (pergunta técnica 4): fica para a medida no AVD (U-09h); o `numberOfLines` da "Descrição" não mudou.
4. **O estado comum de carregamento e erro** de `about.tsx` e `index.tsx` (item 7 da revisão, opcional) não foi extraído: o `index.tsx` é tocado pelo P09-D e pelo P12 nesta onda, e mexer no topo dele agora aumentaria o conflito no rebase. As duas telas repetem o mesmo `Skeleton` e os mesmos dois `EmptyState` ("Crônica não encontrada" e "Não foi possível carregar a crônica"); um componente comum cabe depois do P12.

**Desvios de desenho:**

5. **O trecho tem 80 pontos de código, não 140, e sem `numberOfLines`** (`fddd68e`). Com 140 e duas linhas, a tela cortava de novo (a 390 cabem uns 100 caracteres) e o leitor de tela anunciava o que a tela não mostrava. Com 80, o trecho cabe em duas linhas de `body` de 360 a 411 com a fonte a 100%, e o que a tela mostra é o que o leitor lê. O bloco continua em até 104 px a 390 (44 + 4 + 2 × 22 = 92). Com a fonte a 130%, o trecho pode ir a três linhas: anotar no U-09i.
6. **O `excerpt` colapsa quebras e espaços** antes de cortar (`6c974b6`) e **não perde a última palavra** quando o limite cai num espaço (`0b35b7c`). O **`paragraphs`** aceita linha em branco com espaço Unicode, como o NBSP, sem atravessar linhas (`a351834`).
7. **O "‹" da leitura** abre a crônica da rota também enquanto ela carrega, com o rótulo "Crônica" até o nome chegar; só o 404 volta à lista (`3567332`).
8. **A Descrição com 4001 caracteres volta 400, não 422.** O schema da rota (`maxLength: 4000`) recusa antes do `safeText`. O teste fixa o 400 e confere que a resposta não ecoa o texto; o texto com `<` continua 422.
9. **Os tamanhos do seed** (`--apresentacao`): "Vampiro v3/v5" com 119 caracteres, "Mago v4" com 3625 em seis parágrafos (a marcação abre o quarto) e "Lobisomem v4" com 4000 em oito parágrafos. O texto é gerado no script ("Parágrafo de teste do roteiro, número N, frase M."), e o `main` lista crônica e tamanho, sem o texto.
10. **O spec E2E** (`chronicle-about.spec.ts`) foi escrito e passou no typecheck e no lint, mas **não rodou**: o E2E é da integração (portas fixas). A medida do bloco (até 104 px), o `y` da `tablist` e a falta do `-webkit-line-clamp` ficam para lá, já com o topo do P09-D.

**Revisões:**

11. **`/security-review`** no diff do pacote antes da mudança do ex-membro: nenhum achado (o texto em `Text`, sem `dangerouslySetInnerHTML`, parser, link nem `Linking`; o `id` da URL só vai ao `GET /chronicles/:id`, que aplica o `chronicleAccess`; nenhum log novo; o seed só lista crônica e tamanho). **No `38fee1d`**, revisto no próprio agente: a resposta do `former` só perde campos, o `chronicleAccess` e os status não mudam, e o narrador e o membro recebem o mesmo de antes; nenhum achado.
12. **Revisão de código:** a do agente achou um ponto, corrigido em `35aae8f` (o narrador saía da tela antes de o `PATCH` responder). O `/code-review` (high) do orquestrador achou sete. Seis foram corrigidos, cada um num `fix` com teste: o ex-membro (item 1 acima), o trecho na tela e no leitor (item 5), o colapso dos espaços e o corte no limite (item 6), o voltar enquanto carrega (item 7) e os parágrafos com espaço Unicode (item 6). O sétimo, opcional, ficou registrado no item 4.

**Para o rebase (onda-5.md §3 e §4.1):**

13. O bloco está dentro do `styles.info` de `chronicles/[id]/index.tsx`, logo depois de "Você narra esta crônica." / "Narrador: …", e antes do `TransferOffer`, do `CreationSettings` e das abas. O P09-D, que entra antes, mexe no `CreationSettings`; este pacote não o toca. O P12 leva o `about.tsx` junto se mover o `useSheetBack`. O `routes.ts` muda no `GET /chronicles/:id` (o `head` e a `presentation`); o P09-D e o P12 mexem em outros handlers do mesmo arquivo.
14. Um teste do `CampaignBackstage.test.tsx` ("sem catálogo não desenha regras da casa…") falhou uma vez na rodada completa do Jest com cobertura, com a máquina em carga 27, e passou nas três rodadas isoladas e na rodada completa seguinte. Não é do pacote, mas fica anotado.

## 11. Testes manuais (web, Android com AVD, iOS com idb)

Roteiro para conferir o item na interface, nas três plataformas, com a API local e o seed do roteiro. Só contas fictícias e só texto fictício. Ele detalha o passo 6 da §7. A coluna "Resultado" fica em branco e é preenchida na integração. Nenhum resultado é "ok" sem a evidência; quando uma plataforma não puder ser conferida, o resultado diz "não conferido" e por quê.

### 11.a Preparação

1. **Banco e API.** O pacote não tem migration nem template novo: o banco da onda serve. **Sem `db:down`**: o Postgres do Docker é compartilhado. Se a branch tiver migration de outro pacote, conferir pela tabela `kysely_migration` (o `db:migrate` pode travar na saída, onda-4.md §11). API em `npx pnpm dev:api` (3001) e Metro em `cd apps/frontend && npx expo start` (8081).
2. **Seed:** `npx pnpm seed:roteiro --apresentacao > <scratchpad>/p14d/seed-<plataforma>.log 2>&1`, **um por plataforma, com 15 minutos de intervalo** (limite de aceites de convite). A saída tem a senha, os e-mails e os códigos de convite do N2: ler só com `grep -v -i -e senha -e convite`, e nunca copiar nada disso para o plano, a captura ou o relatório.
   - **O que o seed já cobre:** as contas N (`roteiro_narrador`), J1, J2 e N2, todas `@roteiro.test`. A senha é a constante do `scripts/seed-roteiro.ts` e não é escrita aqui; os scripts de login a leem em tempo de execução. As crônicas "{Sistema} v3/v5" (livre) e "{Sistema} v4" (por pontos) nos três sistemas, com J1 e J2 dentro; o N2 tem um convite para as "v3/v5" e **não entrou**.
   - **O que o seed não tem e o `--apresentacao` (commit 5) grava, pela API e só com texto fictício escrito para o roteiro** (frases do tipo "Parágrafo de teste do roteiro, número 3."; nenhum texto de livro):
     - "Vampiro v3/v5": Descrição curta (uns 120 caracteres, uma linha);
     - "Mago v4": Descrição longa (uns 3.600 caracteres, seis parágrafos), com a linha `*isto não é negrito* [nem link](https://exemplo.test)`. É o sistema em que o narrador viu o U-09;
     - "Lobisomem v4": Descrição com 4000 caracteres, o limite;
     - "Mago v3/v5", "Lobisomem v3/v5" e "Vampiro v4": vazias.
   - **O que o roteiro cria pela tela:**
     - N acrescenta uma frase curta em ASCII à Descrição do "Mago v4" (o `input text` do Android e o `idb ui text` não digitam acento);
     - no web: J2 cria a ficha "Saida R" em "Lobisomem v3/v5" e toca "Sair da crônica", para virar ex-membro. É o último passo do bloco web, porque tira o J2 dessa crônica;
     - nenhum convite novo: **o P14-D gera 0 convites em cada plataforma.** O convidado que não entrou é o N2, que **não usa** o convite dele antes do passo U-09e. Na integração da onda, esse passo vem antes de qualquer passo que use o convite do N2.
3. **Evidências:** no scratchpad, `p14d-<plataforma>-U-09<letra>-<passo>.png`. Sem e-mail visível na captura. O texto da captura é o fictício do seed.

### 11.b Web (Playwright, Chromium; WebKit onde indicado)

- **Script:** `<scratchpad>/p14d/web.mjs` com o `playwright` do `node_modules`, contra `http://localhost:8081` (Metro). Reiniciar o Metro com `--clear` antes da rodada.
- **Viewports exatas:** `{ width: 390, height: 844 }` e `{ width: 1280, height: 800 }`.
- **WebKit:** U-09b também em `webkit.launch()` (a seleção do texto e o voltar do Safari). O item não é de Safari, então o resto fica no Chromium.
- **Seletores por papel e rótulo, com `exact`:**
  - `getByRole('button', { name: 'Ler tudo: apresentação da crônica', exact: true })`;
  - `getByRole('heading', { name: 'Apresentação', level: 1 })`;
  - `getByRole('button', { name: /^Voltar para / })`;
  - `getByRole('tab', { name: 'Bastidores', exact: true })` e `getByRole('textbox', { name: 'Descrição', exact: true })`;
  - `getByRole('tablist', { name: 'Visão da crônica' })` para a medida das abas.
- **Medidas no DOM:** a caixa do bloco (`boundingBox` até 104 a 390) e o `y` da `tablist` com e sem Descrição; a largura da coluna de leitura a 1280 (até 640).
- **Um `page.screenshot` por passo.**

### 11.c Android (AVD)

- **AVD:** `Pixel_3a_API_34_extension_level_7_arm64-v8a` (393 dp), com `-cores 4 -memory 3072` e `-gpu host`; APK do `assembleDebug` arm64, com `JAVA_HOME` no JBR do Android Studio. O pacote não muda nada nativo: o APK da onda serve.
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Larguras:** o bloco é de layout: também `adb shell wm density 480` (360 dp) e `420` (411 dp), e a 393 com a fonte a 130% (`adb shell settings put system font_scale 1.3`). No fim, `wm density reset` e `font_scale 1.0`.
- **Teclado de software:** `adb shell settings put secure show_ime_with_hard_keyboard 1` para o editor.
- **Navegação:** `adb shell uiautomator dump /sdcard/ui.xml` e `adb pull`; achar "Ler tudo: apresentação da crônica" pelo `content-desc` e tocar no centro do `bounds` (`adb shell input tap X Y`); `adb shell input swipe` para rolar o texto; `adb shell input keyevent 4` para o voltar do Android na tela de leitura. O `input text` não digita acento: a frase do N é em ASCII.
- **LogBox:** dispensar o banner antes de tocar perto do pé da tela.
- **Tempo** medido no emulador sob carga não é evidência. Desligar o AVD antes do iOS.

### 11.d iOS (simulador, com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, e iPhone 17, iOS 26.5.
- **Build Debug com "Sign to Run Locally"** em `apps/frontend/ios` (sem assinatura, o app não loga: o keychain responde `-34018`). O app é `com.tms.app`.

  ```bash
  xcodebuild -workspace TMS.xcworkspace -scheme TMS -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath <scratchpad>/ios-dd CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build
  ```

- **Cliente fb-idb:** o venv `~/.venvs/idb-tms` já existe, fora do repositório, com `fb-idb` 1.7.7. Rodar `~/.venvs/idb-tms/bin/pip-audit` antes de usar; com vulnerabilidade, parar e registrar. Nunca no `package.json` nem no lockfile.
- **Companion:** `--companion-path /opt/homebrew/bin/idb_companion` vem antes do subcomando. Ele fica só local, no socket de domínio; no fim, `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` não mostra nada.
- **Navegação:** `idb ui describe-all --udid <UDID>`, com o driver escondendo o valor dos campos E-mail e Senha (onda-4.md §11, item 7); tocar no centro do `frame` do `AXLabel` "Ler tudo: apresentação da crônica"; `idb ui swipe` para rolar o texto; `idb ui text`, `idb ui key` e `idb screenshot`.
- **Limites do idb:** não faz o gesto de borda (usar o "‹"); não digita fora do ASCII; o teclado de software some depois do primeiro texto. O pacote não usa deep link.

### 11.e Tabela por item

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| U-09a | Web 1280 | N | "Mago v4" → crônica → bloco → "Ler tudo" → rolar até o fim → "‹" | Bloco com "Apresentação", o trecho com "…" e "Ler tudo"; a tela "Apresentação" com o nome da crônica e os seis parágrafos separados; a coluna até 640 px; o "‹" volta à crônica, na aba de antes | `p14d-web1280-U-09a-1..4.png` | |
| U-09b | Web 390 (Chromium e WebKit) | J1 | "Mago v4" → bloco → "Ler tudo" → F5 → voltar do navegador | O mesmo bloco e a mesma tela do N; a linha com `*` e `[nem link](…)` literal, sem link; F5 mantém a tela; o voltar leva à crônica; o bloco mede até 104 px | `p14d-web390-U-09b-1..4.png`, `p14d-webkit390-U-09b-5.png` | |
| U-09c | Web 390 | N, depois J1 | N: Bastidores → "Descrição" → acrescentar "Frase nova do roteiro." → "Salvar apresentação" → "Ler tudo". J1: voltar à aba da crônica (foco) → "Ler tudo" | A dica "Os jogadores da crônica leem este texto. …" sob o campo, com o contador; o texto novo na leitura do N e, depois do foco, na do J1 | `p14d-web390-U-09c-1..4.png` | |
| U-09d | Web 390 | J2 | "Lobisomem v3/v5" → nova ficha "Saida R" → "Sair da crônica" → abrir a crônica de novo → `/about` direto | Sem bloco nem "Ler tudo"; o banner "Você saiu"; a URL `/about` mostra "Você saiu desta crônica". No script, a resposta do `GET` não contém a frase da Descrição (se o PO aceitou o ponto 1) | `p14d-web390-U-09d-1..3.png` | |
| U-09e | Web 1280 | N2 | Sem usar o convite: abrir `/chronicles/<id do "Vampiro v3/v5">/about` (o id vem da URL do N) | "Crônica não encontrada"; nenhuma parte da Descrição na tela nem na resposta | `p14d-web1280-U-09e-1.png` | |
| U-09f | Web 390 | J1 | "Mago v3/v5" (vazia) e "Vampiro v3/v5" (curta) | Na vazia, nenhum bloco, e a `tablist` no mesmo `y` de hoje; na curta, o trecho inteiro sem "…", com "Ler tudo" | `p14d-web390-U-09f-1..2.png` | |
| U-09g | **Android 393 (obrigatório: o U-09 foi visto no Android)** | N | "Mago v4" → bloco → "Ler tudo" pelo `content-desc` → rolar até o fim → voltar do Android | O `content-desc` "Ler tudo: apresentação da crônica" no `dump`; o texto inteiro, até o sexto parágrafo; o voltar do Android volta à crônica na mesma aba e rolagem | `p14d-and393-U-09g-1..4.png` | |
| U-09h | **Android 393 (obrigatório)** | N | Bastidores → "Descrição" com o teclado de software → acrescentar "Editado no Android." → "Salvar apresentação" → "Ler tudo" | A dica visível sob o campo com o teclado aberto; a caixa mostra o texto (anotar se rola por dentro: pergunta técnica 4); a frase nova na leitura | `p14d-and393-U-09h-1..3.png` | |
| U-09i | Android 360 e 411 dp; 393 com fonte a 130% | J1 | "Mago v4" → crônica | O trecho em duas linhas e o "Ler tudo" inteiro na linha da legenda, sem corte; a altura do bloco até 112 dp a 100%; a 130%, anotar a altura | `p14d-and360-U-09i-1.png`, `p14d-and411-U-09i-2.png`, `p14d-and393fs130-U-09i-3.png` | |
| U-09j | iOS SE e iPhone 17 | J1 | "Lobisomem v4" (4000 caracteres) → "Ler tudo" pelo idb → `swipe` até o fim → "‹" | O `AXLabel` "Ler tudo: apresentação da crônica"; o título "Apresentação" com traço de cabeçalho; o texto até o fim, sem corte; no 17, nada sob a Dynamic Island; o "‹" ("Voltar para {crônica}") volta à crônica | `p14d-iosSE-U-09j-1..3.png`, `p14d-ios17-U-09j-4.png` | |
| U-09k | iOS SE | N | "Mago v4" → Bastidores → "Descrição" | A dica sob o campo e no `describe-all`; o campo e a dica acima do teclado | `p14d-iosSE-U-09k-1.png` | |

O `viewer` e o NPC oculto ficam na matriz de AuthZ da API (§4.1), sem passo manual: na tela, o `viewer` é um jogador como o J1.

### 11.f Acessibilidade mínima

- **"Ler tudo" diz o que abre:** o nome é "Ler tudo: apresentação da crônica", começando pelo texto visível.
  - Web: `button` com esse `aria-label`.
  - Android: o `content-desc` no `dump`.
  - iOS: o `AXLabel` no `describe-all`, com traço de botão.
- **O trecho não é a Descrição inteira para o leitor de tela:** no DOM, no `dump` e no `describe-all`, o texto do trecho tem no máximo 141 caracteres.
- **A tela de leitura tem um cabeçalho:** "Apresentação", de nível 1 no web, com traço de cabeçalho no iOS. O voltar se chama "Voltar para {crônica}".
- **O aviso do editor é lido:** no web, texto visível abaixo do campo; no nativo, também como `accessibilityHint` do campo.
- **Ouvir no aparelho:** o AVD não tem TalkBack, e o `describe-all` não expõe o foco. A fala de "Ler tudo", a leitura do texto longo pelo VoiceOver e pelo TalkBack e o foco depois de abrir a tela ficam para o aparelho, registrados como "não conferido" com esse motivo.

### 11.g Limpeza

- Parar a API e o Metro.
- Desligar o AVD (`adb emu kill`) e os simuladores (`xcrun simctl shutdown all`).
- `adb shell wm density reset`, `adb shell settings put system font_scale 1.0` e `adb shell settings put secure show_ime_with_hard_keyboard 0`.
- Encerrar o `idb_companion`, sair do venv e conferir com `lsof` que nada escuta.
- Nenhum convite de teste a revogar: o pacote não gera convite. O convite do N2 fica como o seed deixou.
- Manter as capturas e os logs do seed no scratchpad até a integração. Nada vai para o repositório.

### 11.h Quando uma plataforma não puder ser conferida

O resultado diz "não conferido" e o motivo, por exemplo:

- "o build do iOS falhou em …";
- "o emulador ficou ocupado sob carga";
- "o PO recusou o ponto 1: o ex-membro recebe a Descrição".

O passo fica para a integração ou para o roteiro antes do release. Nunca "ok" sem a evidência.
