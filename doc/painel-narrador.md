# Painel do narrador

> Proposta · 2026-10-20, decisões de 2026-10-21, revisão de contratos de 2026-10-21 · base: `feat/fichas-wod-completas` em `0ec7546` (v2: Vampiro, Mago e Lobisomem)

Este documento responde: **o que o narrador precisa para administrar uma crônica no TMS**, em que ordem construir e o que cada parte exige do motor, da API e do banco. Ele parte do que já existe e não repete o que os planos v0–v2 já decidiram.

| Documento | Responde |
|---|---|
| [`plano-v0.md`](plano-v0.md) | Etapa 19 (Mesa e histórico), convites, AuthZ, exclusão de conta |
| [`avaliacao-ui-ux.md`](avaliacao-ui-ux.md) | C-19 (narrador sem visão da mesa) e "Telas e estados que faltam" |
| [`arquitetura-motor-de-ficha.md`](arquitetura-motor-de-ficha.md) | Por que o painel não pode conhecer o nome de nenhum sistema; §11, a criação com orçamento de pontos |
| [`plano-v1.md`](plano-v1.md), [`plano-v2.md`](plano-v2.md) | O molde dos planos de versão (etapas, branches, testes, jornada E2E); as regras de teste do §4 do plano-v0 continuam valendo |
| [`design/telas/mesa.html`](../design/telas/mesa.html) | A referência visual da Mesa; as telas novas do painel ainda não têm esboço |
| este documento | **O que** entra no painel, **em que ordem**, e **o que falta** no modelo |

Criação, autorização e reversão não são extensões pequenas: cada uma tem aqui um contrato e critérios de aceite próprios (5.1, 5.4, 5.5 e 5.6).

## 1. A pergunta

> No TMS, um gerenciador de fichas multi-sistema (hoje Vampiro V20, Mago M20 e Lobisomem W20), o que o narrador precisa no painel da crônica para preparar, conduzir e manter o jogo? Parta do que já existe (aba Mesa, convites, Notas do Narrador, histórico, rolagens). Para cada funcionalidade proposta, diga o problema da mesa que ela resolve, a prioridade (P0/P1/P2), se exige mudança de template, API ou migração, e o risco de AuthZ. Respeite as regras do projeto: nada de WoD fora do core e dos templates, o servidor valida toda escrita e dado do narrador nunca chega ao cliente do jogador. Termine com a ordem de construção e as decisões em aberto.

## 2. O que já existe

| Capacidade | Onde |
|---|---|
| Criar crônica (o criador é o narrador) e excluí-la, com o nome digitado quando há fichas de outros | `POST /chronicles`, `DELETE /chronicles/:id` |
| Convites por código (hash, validade, usos), listar e revogar | `/chronicles/:id/invites`, `/invites/accept` |
| Aba **Mesa**, só do narrador: uma linha por personagem com o `dock` do template e a hora da última alteração | `GET /chronicles/:id/table`, `components/chronicles/TableView.tsx` |
| Abrir a ficha de um jogador em Leitura e "Editar como narrador", com a alteração assinada | `POST /characters/:id/events` |
| Lote idempotente **por ficha** (`client_batch_id`), com trava da linha | `sheets/events.ts` |
| Notas do Narrador: seção com `permissions` só para `storyteller`, filtrada no servidor | templates, seção `storyteller` |
| Histórico de alterações com o papel de quem mudou. Texto e especializações ficam sem o valor (`from`/`to` nulos), por privacidade | `GET /characters/:id/history`, `sheets/events.ts` |
| Rolagens feitas no servidor, com `by_role`; o custo (FdV) é um lote do histórico | `/characters/:id/rolls`, `rolls/routes.ts` (`recordCost`) |
| Excluir ficha (lógico) pelo dono ou pelo narrador | `DELETE /characters/:id` |
| Experiência como campos da ficha (`xpTotal`, `xpSpent`, `xpAvailable` derivado) | `design/templates/*.json` |

O que **não** existe: estado da ficha, remover jogador, sair da crônica, editar a crônica, transferir a narração, criação por pontos, aprovar XP, ações em grupo, reverter lote, NPCs ocultos, registro de sessões, registro de ações administrativas e qualquer visão consolidada da crônica.

**Ainda não há jogadores reais.** Toda ficha que existe hoje é de teste. Isso tira do caminho a migração de fichas antigas e a compatibilidade com fichas criadas sem orçamento (decisão 8), e deixa as migrações de banco baratas.

## 3. Antes do painel

Três coisas. A 3.1 e a 3.2 bloqueiam; a 3.3 deixa o painel mais barato.

### 3.1 Fechar a branch atual (bloqueia)

O PR #30 (`feat/fichas-wod-completas`) muda os três templates (`vtm-v20` 1.3.0, `mta-m20` 1.2.0, `wta-w20` 1.2.0). O painel se apoia no `dock` e nos campos de Experiência que entram nele. Fechar inclui provar no CI as três jornadas E2E juntas.

### 3.2 Jogador vê só as próprias fichas (bloqueia)

**Decidido:** o jogador só tem acesso às fichas dele. Quem vê todas as fichas da crônica é o narrador. A única exceção é o NPC revelado (5.7).

Hoje é diferente. O `characterAccess` (`apps/api/src/authz.ts`) dá o papel `player` a qualquer membro da crônica, e a matriz de AuthZ espera 200 para ele em:

- `GET /characters/:id` (a ficha de outro jogador, sem as Notas do Narrador);
- `GET /characters/:id/history` e `GET /characters/:id/rolls`;
- `GET /chronicles/:id/characters`, que devolve identidade e `dock` de todas as fichas.

O que muda:

- na API, outro membro deixa de ter papel na ficha: as três rotas de ficha respondem 404 (não 403, para não confirmar que a ficha existe), e a lista da crônica devolve ao jogador só as fichas dele;
- a seção sem `permissions` passa a valer "dono e narrador leem e escrevem", não mais "todos da crônica leem" (plano-v0, Etapa 4). O papel `player` sai das seções;
- o `characterCount` de `GET /chronicles` passa a contar só o que quem pergunta pode ver (hoje conta todas as fichas da crônica);
- no app, a tela da crônica mostra ao jogador só os personagens dele;
- na matriz, `player` passa a esperar 404 nessas rotas, com o teste de que nenhum valor da ficha alheia está no corpo da resposta.

Vem antes porque os módulos do painel (feed de rolagens, NPCs, auditoria) partem dessa regra. Sem migração.

### 3.3 Matriz de AuthZ nos três sistemas

A matriz de AuthZ (`test/authz-matrix.ts`) roda só com o Vampiro; o Mago e o Lobisomem têm testes à parte (`mage.test.ts`, `werewolf.test.ts`). O painel acrescenta dezenas de casos (§7). Parametrizar a matriz por sistema antes evita escrever cada caso três vezes.

**Pequeno, no caminho:** a Aparência ainda nasce em 0 no Vampiro (❌ aberto na auditoria). Some com a criação por pontos (5.5), que começa todo Atributo em 1.

**O que não precisa vir antes:**

- **Tempo real.** A Mesa já puxa ao focar e ao reconectar, e o painel funciona assim.
- **Migração de fichas entre versões do template.** Sem jogadores reais, as fichas de teste são recriadas pelo seed. Vai para "Depois do painel" (§9).

## 4. Princípios

1. **Agnóstico.** O painel desenha o que o template declara. Dano em grupo, recuperação, orçamento de criação e custo de XP são regras nomeadas do template, nunca `if (system === 'vtm-v20')`. Cada módulo novo precisa passar no fixture de D&D com o mesmo código, como a Mesa já passa.
2. **Jogador vê só as próprias fichas; o narrador vê todas** (§3.2).
3. **Uma política de escrita só** (5.1). Toda rota que muda ficha (`/events`, custo de rolagem, ação em grupo, aprovação de XP, reversão) passa pela mesma função no servidor. Sem regra, nega.
4. **Dado do narrador não sai do servidor.** NPC oculto, rolagem oculta, nota de sessão privada: o filtro é na resposta (e nas contagens), não na tela.
5. **Toda operação do narrador é idempotente e atômica.** Uma chave do cliente por operação inteira, não só por ficha; ou aplica tudo, ou nada.
6. **Ação sobre campo vai para o histórico; ação administrativa vai para o registro da crônica** (5.1).
7. **Desfazer antes de confirmar**, só onde a reversão é garantida (5.4). Confirmação para o que é destrutivo e raro (remover jogador, excluir, transferir).

## 5. Módulos

Prioridade: **P0** resolve dor que já aparece na mesa hoje; **P1** fecha o ciclo de uma campanha; **P2** é conforto. A numeração segue a ordem de construção (§8).

### 5.1 Estados da ficha e política de escrita (P0)

**Problema.** Remover jogador, travar ficha, criação por pontos e XP aprovado dependem de saber quem pode escrever o quê, em que estado. Hoje a regra é "dono e narrador escrevem", e o `characterAccess` dá `owner` mesmo a quem não é mais membro da crônica: apagar o vínculo deixaria a escrita.

#### Estados

`creating` → `pending` → `active` → `archived` | `dead`, mais a trava `locked_at`, que vale só em `active`.

- `pending` só existe com a aprovação de ficha ligada na crônica (decisão 2), e chega na v4, com essa configuração.
- O rótulo de `dead` vem do template ("Torpor", "Morto", "Desaparecido").
- A Mesa mostra `creating` (marcada "Em criação", para o narrador concluir) e `active`. `archived` e `dead` somem dela, com filtro para ver.

#### Classificar cada mudança, não cada campo

O `editableIn` não basta: a Força de Vontade é `editableIn: ["play"]`, mas guarda permanente e temporário no mesmo valor. O core ganha `classifyChange(field, from, to)`, que devolve, para cada parte do valor que mudou:

| Classe | Exemplo |
|---|---|
| `play` | gastar ou recuperar o temporário dentro do permanente; marcar ou curar dano; trocar de forma |
| `advance` | subir ou descer o permanente de um recurso; subir ou descer um `rating`; item novo numa lista de poderes |
| `edit` | texto, identidade, notas, especialização |

Um evento que muda temporário e permanente juntos tem as duas classes, e vale a mais restrita. O tipo de campo diz como classificar (registry do core); o template não precisa dizer nada novo.

#### A política

`canWrite(access, status, locked, classes)` no servidor:

| Estado | Dono | Narrador |
|---|---|---|
| `creating` | `play`, `advance` (dentro do orçamento, 5.5) e `edit` | tudo |
| `pending` | nada | tudo, e aprova |
| `active` | `play` e `edit`; `advance` só por pedido de XP aprovado (5.6) | tudo |
| `active` + travada | nada, nem rolagem com custo | tudo |
| `archived` / `dead` | nada | tudo (inclusive voltar para `active`) |
| ex-membro (dono sem vínculo) | nada, em qualquer estado | – |

- O lote é atômico: um evento recusado recusa o lote inteiro, com 403 e o `path` recusado.
- A rolagem com custo passa pela política antes de rolar: ficha travada não rola gastando FdV. Rolagem sem custo continua livre em `active`, mesmo travada, porque não muda a ficha (decisão 10).
- O `characterAccess` passa a devolver `owner` só para leitura quando o dono não é mais membro.
- **A política vale no momento em que o lote chega**, com o estado e a trava atuais, nunca com os de quando o lote foi criado. Um lote de Evoluir gravado offline em `creating` que chega depois da conclusão, ou um gasto de FdV que chega depois da trava, é recusado.
- **A recusa diz o motivo.** O 403 traz um código (`SHEET_LOCKED`, `SHEET_NOT_EDITABLE`, `NEEDS_XP_APPROVAL`, `NOT_MEMBER`), e o app troca o genérico "Sem permissão" do `rejectionMessage` (`sheet/sync/sync.ts`) por uma frase por código ("O narrador travou a ficha. A alteração foi desfeita."). A fila já tira o lote recusado e desfaz a mudança; isso não muda.

#### Concluir a criação

É uma operação do servidor, não uma troca de modo no app: `POST /characters/:id/creation/complete`.

- Numa transação: trava a ficha (`FOR UPDATE`), exige `creating`, muda o estado, grava `creation_completed_at` e `creation_completed_by` em `characters` e uma linha no `chronicle_audit`.
- A partir do commit, todo lote é avaliado como `active`, inclusive os que já estavam na fila offline do jogador.
- Concluir de novo dá 409 "criação já concluída".
- **Na v3** só o narrador conclui, sem orçamento: `creating` funciona como "criação livre". **Na v4** o dono também conclui, e a operação roda antes o `checkCreation` (5.5) e manda para `pending` quando a aprovação está ligada.

#### Mudar estado e travar

Ações do narrador, cada uma numa transação com a ficha travada e uma linha no `chronicle_audit`:

- `POST /characters/:id/status` com o estado novo (`active`, `archived`, `dead`). Voltar para `creating` não existe;
- `POST /characters/:id/lock` e `DELETE /characters/:id/lock`, só em `active`.

#### Registro administrativo

As ações que não são eventos de campo (mudar estado, travar, remover, revelar, transferir, conceder XP, aprovar ou recusar pedido, ajustar orçamento) vão para `chronicle_audit`: quem, quando, ação, alvo e um `payload` mínimo, sem conteúdo de notas. Só o narrador lê.

Exige: core (`classifyChange`), API (`canWrite` nas rotas de escrita, incluindo `rolls`; concluir a criação), colunas `status`, `locked_at`, `creation_completed_at` e `creation_completed_by` em `characters`, tabela `chronicle_audit`, códigos de recusa no app. Migração.

**Critérios de aceite** (na matriz, nos três sistemas):

- o dono gasta FdV temporária em `active`; não sobe a FdV permanente; um evento que faz as duas coisas é recusado inteiro;
- o dono sobe um `rating` em `creating` e não em `active`;
- o dono não rola com custo numa ficha travada, e rola sem custo;
- o ex-membro lê a ficha arquivada e recebe 403 em `/events` e em `/rolls`;
- um lote de Evoluir criado em `creating` e enviado depois da conclusão é recusado com `SHEET_NOT_EDITABLE`, e a ficha não muda;
- um gasto de FdV enviado depois da trava é recusado com `SHEET_LOCKED`;
- concluir e um lote de Evoluir chegando ao mesmo tempo, no Postgres de verdade: ou o lote entra antes e a conclusão vê o valor novo, ou é recusado; nunca entra depois;
- concluir duas vezes dá 409, e só há uma linha no `chronicle_audit`;
- o narrador escreve em todos os estados;
- cada ação administrativa gera exatamente uma linha em `chronicle_audit`.

### 5.2 Jogadores e convites (P0)

**Problema.** Hoje não há como tirar alguém da mesa nem sair dela.

- Lista de membros com a ficha de cada um e a data de entrada.
- **Remover jogador** (com confirmação): numa transação, as fichas dele vão para `archived`, o vínculo sai e a ação entra no `chronicle_audit`. Ele mantém a leitura das fichas (decisão 1), e a política de 5.1 tira a escrita.
- **Sair da crônica** (do lado do jogador): o mesmo efeito. O narrador não sai; só deixa de narrar transferindo (v5).
- **Onde o ex-membro acha as fichas:** a crônica continua na lista dele, marcada "Você saiu", e mostra só as fichas dele, em Leitura (decisão 9). O `GET /chronicles` passa a listar também as crônicas em que ele tem ficha não excluída, com o papel `former`.
- Convites: já existem; falta mostrar usos restantes e expiração na lista.
- **Transferir a narração** (P2, entrega 12) para um membro, com aceite do outro lado. Destrava a exclusão de conta de quem narra (decisão 8 do plano-v0).

Exige: `DELETE /chronicles/:id/members/:userId`, `DELETE /chronicles/:id/members/me`; depois, `POST /chronicles/:id/transfer` + aceite, com uma tabela de pedidos pendentes. Depende de 5.1.

AuthZ: remover e transferir só o narrador; sair só o próprio membro; o narrador não remove a si mesmo; o `former` só lê as próprias fichas e não vê a Mesa, os convites nem os outros membros.

### 5.3 Mesa ao vivo (P0, evolução da Etapa 19)

**Problema.** No meio da cena, a narradora quer saber quem está mal sem abrir quatro fichas.

- **Alertas na linha:** incapacitado, Força de Vontade zerada, recurso abaixo do limite. O template declara `alerts` (condição sobre campos, com a mesma lista branca das fórmulas); o painel só pinta.
- **Ordenar e filtrar:** por nome, por última alteração, só com alerta, por estado.
- **Navegar entre fichas** em Leitura (deslizar, como em C-19).
- **Indicador de desatualizado:** a Mesa não é em tempo real; mostrar "atualizado há 2 min" e puxar ao focar.

Exige: chave `alerts` no template e no core. Sem migração.

### 5.4 Ações em grupo e reversão (P0)

**Problema.** "A explosão causa 3 níveis letais em todos" vira quatro edições manuais, e um erro do narrador precisa ser desfeito sem caçar campo por campo.

- **Aplicar dano/cura em grupo:** escolher personagens, tipo e quantidade. Usa as operações de trilha que o template já define.
- **Recuperação por período** ("Nova noite", "Novo dia", "Fim da história"): o template declara `recoveries` com o que cada uma faz. Prévia por personagem antes de aplicar.
- **Desfazer:** por 5 s no snackbar e, depois, pelo histórico.

#### Contrato da operação

Uma operação em grupo é uma linha em `chronicle_operations` (`id`, `chronicle_id`, `client_operation_id`, `kind`, `created_by`, `created_at`, `reverts_operation_id`, `reverts_batch_id`) e um lote por ficha, ligado por `operation_id` em `character_batches`.

1. **Prévia.** `POST /chronicles/:id/operations/preview` devolve, por ficha, os eventos e a `sheetVersion` lida. Não grava nada.
2. **Aplicar.** `POST /chronicles/:id/operations` com `clientOperationId`, os alvos e a `sheetVersion` esperada de cada um.
   - **Idempotência:** `client_operation_id` é único por crônica. Reenvio com a mesma chave devolve o resultado original (`duplicate: true`) e não aplica de novo. É a mesma ideia do `client_batch_id`, um nível acima.
   - **Ordem de bloqueio:** as fichas são travadas com `FOR UPDATE` em ordem de `id`, sempre, para duas operações simultâneas não se bloquearem uma à outra.
   - **Mudou entre a prévia e a aplicação:** se alguma `sheetVersion` não bate, nada é aplicado e a resposta é 409 com a prévia nova. O narrador confirma de novo.
   - **Atômica** (decisão 5): uma ficha recusada (pela política de 5.1, por faixa, por conflito) recusa a operação inteira.

#### O que é reversível

Reverter é uma operação nova, com os eventos inversos, e passa pelo mesmo contrato: idempotente, atômica, com bloqueio ordenado. O alvo é uma operação em grupo (`reverts_operation_id`) ou um lote comum de uma ficha (`reverts_batch_id`), nunca os dois. Só o narrador reverte; o jogador continua com o desfazer local que já existe.

- **Reversível:** eventos com `from` e `to` guardados no histórico (números, pontos, recursos, trilhas, forma). Cobre dano, cura e recuperação em grupo, e um lote comum de ficha.
- **Não reversível:** texto e especialização, porque o histórico não guarda o conteúdo (privacidade, `sheets/events.ts`); e as ações administrativas de `chronicle_audit`, que têm o próprio caminho inverso (destravar, reativar). Um lote com evento não reversível não mostra "Desfazer".
- **Conflito:** se o valor atual de algum campo não é mais o `to` da operação original (alguém mexeu depois), a reversão inteira é recusada com a lista de campos. O narrador edita à mão. Nada de reversão parcial.
- O snackbar de 5 s é a mesma reversão, com a mesma regra.

Exige: `recoveries` no template; tabela `chronicle_operations`; `operation_id` em `character_batches`; reversão de lote no core (`invertBatch`). Migração.

**Critérios de aceite:**

- reenviar a mesma operação (resposta perdida) aplica uma vez;
- duas operações simultâneas sobre as mesmas fichas, no Postgres de verdade (como o `events.pg.test.ts`), terminam sem deadlock e com o resultado de uma depois da outra;
- uma ficha alterada entre a prévia e a aplicação dá 409 e nenhuma ficha muda;
- uma ficha de outra crônica no meio da lista dá 404 e nenhuma ficha muda (IDOR);
- reverter depois de o jogador gastar o mesmo recurso é recusado com o campo em conflito;
- property test: aplicar e reverter devolve a ficha original quando não há conflito.

### 5.5 Criação por pontos (P1)

**Problema.** A ficha nasce sem orçamento: o formulário pede só a identidade, a ficha abre em Evoluir e o jogador sobe o que quiser, até 5 em tudo (o servidor só confere a faixa de cada campo).

**Decidido:**

- A criação tem fim: concluída, traço só sobe por pedido de XP aprovado (decisão 6).
- O narrador ajusta o orçamento da crônica ou de uma ficha, e pode marcar uma ficha como "criação livre" (decisão 7).

#### O ciclo

1. **Prioridades.** O jogador escolhe primária, secundária e terciária para cada regra de prioridade. No V20: Atributos 7/5/3, Habilidades 13/9/5.
2. **Distribuir.** O contador mostra o gasto por grupo ("Físicos 7/7") e os pontos de bônus restantes.
3. **Concluir.** A operação de 5.1, que na v4 roda antes o `checkCreation`; se fecha, a ficha vai para `pending` ou `active`.

Com "criação livre", não há contador, e o Evoluir é livre até o narrador concluir por ele.

#### Contabilização: de onde vem cada ponto

É um contrato próprio, e é a primeira etapa da v4: fica fechado e testado antes de qualquer contador, template ou tela. O contrato é a regra abaixo, escrita em `design/templates/README.md`, mais fichas de exemplo por sistema com o resultado esperado (pontos básicos e de bônus por grupo, e os problemas), que viram testes do core.

Uma Habilidade em 4 pode ser legítima (3 básicos e 1 de bônus) ou não. Em vez de gravar a origem de cada ponto, a origem é **calculada por uma regra determinística**, e o que se grava são só as escolhas do jogador:

- **Persistido** (em `characters.creation`, validado pelo core contra o template): as prioridades escolhidas e o ajuste de orçamento do narrador. Nada de livro-razão por ponto.
- **Calculado**, por grupo de orçamento:
  1. `inicial` = o valor de partida do campo (o `min`, ou o `default` derivado: Humanidade = Consciência + Autocontrole, FdV = Coragem);
  2. `acima` = valor − inicial;
  3. `elegível` = a parte de `acima` que fica abaixo do teto de criação (`creation-cap`: Habilidade até 3);
  4. `básicos` = min(soma dos elegíveis do grupo, orçamento do grupo);
  5. `bônus` do grupo = soma de `acima` − básicos, ao preço do grupo na tabela `freebie`;
  6. a ficha fecha se cada grupo gastou exatamente o orçamento e a soma dos bônus cabe no saldo.
- **Reembolso** sai de graça: baixar um ponto recalcula tudo, e o bônus volta.
- **Por que dá para calcular:** a regra acima só é exata se o preço do bônus é o mesmo para todo traço de um grupo (Atributo 5, Habilidade 2, Disciplina 7 no V20). O `compileTemplate` recusa um template em que não seja. Se um sistema futuro tiver preço de bônus variável dentro de um grupo, aí sim será preciso gravar a origem dos pontos, numa versão nova do contrato.

#### O contrato no template

Duas chaves, com regras de lista fechada (`REGISTRY.creationRules` e `REGISTRY.costRules`):

- **`creation`**
  - `priority-budget`: grupos e orçamentos por prioridade (7/5/3);
  - `fixed-budget`: orçamento fixo de uma seção (Disciplinas 3, Antecedentes 5, Virtudes 7);
  - `item-count`: quantos itens de uma lista (os 3 Dons iniciais do Lobisomem);
  - `creation-cap`: teto só para pontos básicos (Habilidade 3); um teto que vale também para os bônus (Arete 3, Esfera ≤ Arete) é `hard-cap`;
  - `freebies`: o saldo de pontos de bônus.
- **`costs`**: tabelas `freebie` e `xp`, por tipo de traço.
  - `flat`: preço fixo por ponto (bônus);
  - `per-current`: valor atual × fator (XP: Atributo atual × 4);
  - `new`: preço do primeiro ponto (XP: Habilidade nova 3);
  - `when`: custo condicional por outro campo (Disciplina do clã, Esfera de afinidade, Dom da raça, augúrio ou tribo). O template guarda o dado; o core só compara.

**Os números são exemplos do V20.** As tabelas dos três sistemas precisam ser conferidas no livro antes de entrar no template.

#### Configurações que chegam junto

Da crônica (5.10 fica só com o resto): **aprovação de ficha nova** (decisão 2) e **orçamento de criação** (decisão 7), com o padrão vindo do template.

Exige: core (`checkCreation`, `costOf`), templates (`creation`, `costs.freebie`), app (modo `create` no store, contador no `SectionHeader`, §11 da arquitetura), API (concluir, ajustar orçamento, marcar "criação livre"), banco (`characters.creation` jsonb, configuração em `chronicles`). Migração.

**Critérios de aceite:**

- property tests: o custo nunca é negativo; subir e descer o mesmo ponto devolve o saldo; a ordem em que os pontos foram distribuídos não muda o resultado; o `checkCreation` do cliente e o do servidor dão o mesmo resultado para a mesma ficha;
- Habilidade em 4 com 1 ponto de bônus passa; com 13 básicos já gastos e sem bônus, não passa;
- concluir com orçamento sobrando ou estourado dá 422 com o problema por grupo;
- o mesmo código passa no fixture de D&D com point-buy de 27 pontos.

### 5.6 Experiência (P1)

**Decidido (decisão 3):** o narrador concede o XP e aprova cada gasto. O jogador vê o saldo e pede para gastar; nunca edita o XP direto.

- **Conceder XP** a um ou vários personagens, com motivo ("Sessão 12"). É uma operação de 5.4: idempotente e atômica.
- **Pedido de gasto:** o jogador pede "Destreza 2 → 3"; o custo vem da tabela `xp` e aparece antes de enviar. Pode cancelar enquanto estiver pendente. Só um pedido pendente por traço.
- **Extrato** por personagem: entradas e gastos, visível ao dono e ao narrador.

#### Aprovação

Numa transação:

1. trava o pedido (`FOR UPDATE`) e depois a ficha, sempre nessa ordem;
2. o pedido precisa estar `pending`; senão, 409 "já decidido". Isso impede a aprovação dupla;
3. o valor atual do traço precisa ser o `from` do pedido; senão, o pedido vira `stale` e a resposta é 409. O jogador pede de novo;
4. recalcula o custo com a ficha atual e confere `xpAvailable ≥ custo`; senão, 409 com o saldo;
5. aplica o traço e soma `xpSpent` num lote só, grava o `batch_id` no pedido, marca `approved` e registra em `chronicle_audit`.

Recusar também trava o pedido e exige `pending`.

Exige: `costs.xp` nos templates; `permissions: { "read": ["owner", "storyteller"], "write": ["storyteller"] }` na seção `experience`, que hoje deixa o dono gravar `xpTotal` e `xpSpent`; tabela `xp_requests` (`pending`, `approved`, `rejected`, `cancelled`, `stale`, com o lote resultante); `POST /chronicles/:id/xp`, `POST /characters/:id/xp-requests`, aprovar, recusar e cancelar. Migração.

**Critérios de aceite:**

- duas aprovações simultâneas do mesmo pedido (Postgres de verdade): uma aplica, a outra dá 409;
- aprovar depois de o narrador ter mudado o traço à mão dá `stale`;
- aprovar sem saldo dá 409 e nada muda;
- o dono gravando `xpTotal` ou `xpSpent` por `/events` dá 403.

### 5.7 NPCs e antagonistas (P1)

**Problema.** O narrador mantém os NPCs no caderno porque não quer que os jogadores vejam.

- Fichas do narrador na crônica, com o mesmo template, marcadas como **NPC**. Nascem com "criação livre".
- Visibilidade: `hidden` (padrão), `identity` ou `full` (decisão 4).
- Aparecem na Mesa numa seção própria e entram em ações em grupo.

#### Contrato de acesso

É a única exceção ao §3.2, então entra na política como um papel próprio: `viewer`, o membro da crônica diante de um NPC revelado.

| O que o `viewer` recebe | `hidden` | `identity` | `full` |
|---|---|---|---|
| na lista da crônica | nada | projeção `identity` | projeção `identity` |
| `GET /characters/:id` | 404 | projeção `identity` | ficha filtrada |
| histórico e rolagens | 404 | 404 | 404 |
| contagem (`characterCount`) | não conta | conta | conta |
| escrita | 404 | 404 | 404 |

- **Projeção `identity`** é nova: nome, chip, subtítulo e retrato, nada do `dock`. A lista atual manda o `dock` também, então não serve.
- **Ficha filtrada** é o `stripRestricted` com o papel `viewer`: lê as seções sem `permissions` e nunca as que citam só `storyteller` (Notas do Narrador).
- O `former` (5.2) não é `viewer`: ex-membro não vê NPC.

Exige: `kind` (`pc`/`npc`) e `visibility` em `characters`; o papel `viewer` em `characterAccess` e no `stripRestricted`; a projeção `identity`. Migração. A criação já aceita o narrador como dono (`POST /chronicles/:id/characters` libera qualquer papel na crônica).

**Critérios de aceite:** um NPC `hidden` não aparece no corpo de nenhuma resposta ao jogador (lista, contagem, ficha, histórico, rolagens, Mesa), e um NPC `identity` não manda nenhum campo do `dock`.

### 5.8 Rolagens da mesa (P1)

**Problema.** As rolagens existem, mas só dentro de cada ficha.

- **Feed da crônica:** últimas rolagens de todos, com rótulo, resultado e se foi manual. Só o narrador; o jogador continua vendo só as rolagens das fichas dele.
- **Rolagem oculta:** o narrador rola por um personagem e o jogador não vê (Percepção para notar uma emboscada).
- **Parada livre**, sem ficha (NPC genérico, dificuldade da cena). Só o narrador, oculta por padrão.

#### Modelo

Hoje `character_rolls.character_id` é obrigatório. A tabela ganha `chronicle_id` (obrigatório, preenchido a partir da ficha), `character_id` passa a aceitar nulo, e uma restrição garante que a rolagem sem ficha é do narrador. A chave de idempotência vira (`chronicle_id`, `client_roll_id`).

O pedido da parada livre: tamanho da parada, dificuldade, especialização e rótulo livre. O modelo de rolagem (`roll.model`, como `pool-success`) vem do template da crônica, e o servidor rola, como já faz. Coluna `hidden`, filtrada na resposta ao jogador.

Exige: `GET /chronicles/:id/rolls`, `POST /chronicles/:id/rolls`; migração de `character_rolls`.

### 5.9 Sessões e diário (P2)

- Registrar sessão: data, título, resumo público e notas privadas do narrador.
- Ligar à sessão o XP concedido e as operações feitas nela, para o histórico ter contexto.
- Lista de crônicas mostra "última sessão" (pedido em `avaliacao-ui-ux.md`).

Exige: tabela `chronicle_sessions`; `session_id` opcional em `chronicle_operations` e nos lotes. Migração.

### 5.10 Configurações da crônica (P2)

O que não chegou com a criação (5.5):

- renomear, descrição, imagem;
- **regras da casa:** só opções que o template expõe (`options`), nunca fórmula livre.

Exige: `PATCH /chronicles/:id`. Migração pequena.

### 5.11 Auditoria da crônica (P2)

Só leitura: a reversão já chegou em 5.4.

- Histórico consolidado: os eventos de campo de todas as fichas e o `chronicle_audit`, filtráveis por personagem, autor e período.
- Eventos das Notas do Narrador e de NPCs ocultos nunca saem para o jogador.

Exige: `GET /chronicles/:id/history` paginado.

## 6. Mudanças no modelo

| Onde | Mudança | Módulo |
|---|---|---|
| API (AuthZ) | membro sem papel nas fichas alheias; `characterCount` pelo que se vê; `canWrite` único; papéis `former` e `viewer` | 3.2, 5.1, 5.2, 5.7 |
| core | `classifyChange`, `invertBatch`, `checkCreation`, `costOf`, projeção `identity` | 5.1, 5.4, 5.5, 5.6, 5.7 |
| template | `alerts`, `recoveries`, `creation`, `costs` (`freebie`, `xp`), rótulos de estado, `options`; `permissions` na seção `experience` | 5.1, 5.3–5.6, 5.10 |
| `characters` | `status`, `locked_at`, `creation` (jsonb), `kind`, `visibility` | 5.1, 5.5, 5.7 |
| `character_batches` | `operation_id` | 5.4 |
| `character_rolls` | `chronicle_id`, `character_id` opcional, `hidden`; idempotência por crônica | 5.8 |
| novas tabelas | `chronicle_audit`, `chronicle_operations`, `xp_requests`, `chronicle_sessions`, pedidos de transferência | 5.1, 5.4, 5.6, 5.9, 5.2 |
| `chronicles` | aprovação de ficha, orçamento de criação; depois descrição e opções | 5.5, 5.10 |

Nada disso cria coluna de WoD. Tudo que é regra de jogo vai para o template; o banco só guarda estado do app.

## 7. AuthZ

Antes de tudo, a matriz troca o 200 do `player` por 404 nas rotas de ficha alheia (§3.2).

Depois, os casos novos, cada um nos três sistemas e com os atores de hoje mais `former` e `viewer`:

- **política de escrita (5.1):** cada estado × cada classe de mudança × dono e narrador; FdV temporária e permanente no mesmo evento; rolagem com custo em ficha travada; ex-membro em `/events` e `/rolls`; lote offline antigo chegando depois da conclusão ou da trava; concluir a criação (quem pode, e duas vezes);
- **membros (5.2):** remover, sair, transferir e aceitar; o `former` na Mesa, nos convites e na lista de membros;
- **operações (5.4):** ficha de outra crônica no lote; reenvio; reversão com conflito;
- **criação (5.5):** concluir, ajustar orçamento, "criação livre"; o dono subindo `rating` fora de `creating`;
- **XP (5.6):** conceder, pedir, aprovar, recusar, cancelar; o dono gravando `xpTotal` ou `xpSpent`;
- **NPCs (5.7):** cada visibilidade × cada rota da tabela do 5.7;
- **rolagens (5.8):** feed, rolagem oculta, parada livre;
- **sessões (5.9):** resumo público e nota privada.

Regra para os testes: para cada dado privado (ficha alheia, NPC oculto, rolagem oculta, nota de sessão), um teste prova que ele não está **no corpo da resposta** ao jogador, **nem nas contagens**, não só que não aparece na tela.

## 8. Ordem de construção

Três versões, no molde da v0, v1 e v2: cada uma fecha numa jornada E2E que prova algo utilizável sozinho, e cada uma tem um risco principal.

### v3: Mesa administrável (autorização e concorrência)

| # | Entrega | Módulos | Estado em 22/10/2026 |
|---|---|---|---|
| 0 | Pré-requisitos | §3.1, §3.2, §3.3 | Implementada |
| 1 | Estados, `classifyChange`, política de escrita, concluir a criação, `chronicle_audit` | 5.1 | Implementada |
| 2 | Arquivar, remover jogador, sair; a crônica "Você saiu" para o ex-membro | 5.2 (sem transferência) | Implementada |
| 3 | Mesa com alertas | 5.3 | Implementada |
| 4 | Ações em grupo com reversão | 5.4 | Dano, cura e reversão implementados; recuperações por período na v3.1 |

Implementação e evidências em `plano-v3.md`. A prévia devolve rótulos das mudanças e versões, sem os eventos crus; o servidor reconstrói os lotes dentro da transação. A recusa `advance` em `active` usa `NEEDS_XP_APPROVAL`; estados sem escrita usam `SHEET_NOT_EDITABLE`. A recuperação por período também foi incluída: `recoveries`, o efeito `resource.restore` e `kind: recovery` usam a mesma prévia e reversão. As regras e versões estão em [recuperacoes-v3.md](recuperacoes-v3.md).

A ordem 1 → 2 importa: o arquivamento e o bloqueio de escrita existem antes de alguém ser removido. A entrega 3 só depende da 0 e pode andar em paralelo.

**Regra de transição até a v4.** A ficha nasce em `creating`, com Evoluir livre e sem orçamento. O narrador conclui a criação (5.1). Em `active`, só o narrador sobe traço, e o jogador pede a ele fora do app. A diferença entre gastar o temporário e subir o permanente já vale aqui. Sem jogadores reais, a transição não custa nada; a v4 acrescenta por cima, sem mudar a política.

**Jornada E2E (`journey-storyteller.spec.ts`):**

1. O narrador cria a crônica e convida dois jogadores. Cada um cria a ficha e distribui os pontos em Evoluir.
2. O narrador conclui a criação de uma ficha. O jogador gasta FdV temporária e não consegue subir um Atributo.
3. O narrador aplica 2 níveis letais nos dois personagens de uma vez e desfaz pelo snackbar.
4. O narrador trava uma ficha. O jogador não consegue gastar FdV nem rolar com custo; uma rolagem sem custo funciona.
5. O narrador remove um jogador. O ex-membro acha a crônica marcada "Você saiu", abre a ficha em Leitura, tenta editar e tenta rolar gastando FdV, e as duas coisas são recusadas com o motivo na tela.
6. O outro jogador, em todo o percurso, não vê a ficha do primeiro.

### v4: Criação e evolução (contabilização)

| # | Entrega | Módulos |
|---|---|---|
| 5 | **Contrato de contabilização**: a regra, as fichas de exemplo com resultado esperado e os property tests, só no core | 5.5 |
| 6 | Tabelas conferidas no livro; `creation` e `costs.freebie` nos três templates | 5.5 |
| 7 | Modo `create`, contadores e concluir com `checkCreation` | 5.5 |
| 8 | Configurações da crônica: orçamento de criação, "criação livre" e aprovação opcional (com o estado `pending`) | 5.5, 5.1 |
| 9 | Experiência: `costs.xp`, concessão, pedidos e aprovação | 5.6 |

A entrega 6 depende de conferir o livro, fora do código; a 5 não, e começa antes.

**Jornada E2E (`journey-creation.spec.ts`):** o jogador escolhe as prioridades, distribui pontos básicos e de bônus com o contador, não consegue concluir com pontos sobrando e conclui quando fecha; com a aprovação ligada, a ficha espera o narrador. O narrador concede XP à mesa; o jogador pede "Destreza 2 → 3", vê o custo, e o narrador aprova; um segundo pedido sem saldo é recusado.

### v5: Bastidores (privacidade)

| # | Entrega | Módulos |
|---|---|---|
| 10 | NPCs e o papel `viewer` | 5.7 |
| 11 | Rolagens da mesa, oculta e parada livre | 5.8 |
| 12 | Transferência, sessões, configurações restantes, auditoria consolidada (P2) | 5.2, 5.9–5.11 |

A entrega 12 é a que se corta primeiro: vira backlog sem quebrar nada.

**Jornada E2E (`journey-backstage.spec.ts`):** o narrador cria um NPC oculto, rola escondido por ele e por uma parada livre, e revela só a identidade; o jogador vê o nome e nada do `dock`, e o teste confere que o NPC oculto não aparece em nenhuma resposta nem contagem.

Cada entrega segue o molde dos planos: template primeiro, core com property tests, API com a matriz de AuthZ, app, e o passo da jornada. As entregas 1, 4, 5 e 9 têm critérios de aceite próprios (5.1, 5.4, 5.5 e 5.6).

## 9. Fora de escopo

Tempo real (WebSocket), chat, mapa e tokens, música, calendário de sessões com notificação. A Mesa continua puxando ao focar e ao reconectar.

**Depois do painel**, antes do primeiro grupo de verdade (decidido: nada disso antes de o painel existir):

- **Migração de fichas entre versões do template.** No core, `migrateSheet(from, to)`: campos novos com o `default`, campos removidos guardados, valor fora da faixa nova recusado com relatório. Na API, subir uma ficha ou a crônica inteira numa operação de 5.4, com prévia.
- **Recuperar senha.** A API só tem `/register`, `/login`, `/refresh`, `/logout` e `/me`, e o projeto ainda não envia e-mail.
- **Roteiro de deploy no repositório.** Não há Dockerfile, EAS nem script de deploy versionado; publicar template ainda pede reiniciar a API à mão.
- **Sessão de teste com um narrador**, para confirmar ou reordenar as prioridades P0/P1/P2.

## 10. Decisões

| # | Pergunta | Decisão (2026-10-21) |
|---|---|---|
| 1 | Ao remover um jogador, o que acontece com a ficha? | Fica arquivada na crônica, e o jogador mantém a leitura dela |
| 2 | Aprovar ficha nova é obrigatório? | Opcional por crônica, desligado por padrão |
| 3 | XP por pedido ou edição direta? | O narrador concede o XP e aprova cada gasto. O jogador só vê e pede para gastar |
| 4 | NPC revelado mostra a ficha inteira ou só identidade? | O narrador escolhe por NPC; o padrão é só identidade |
| 5 | Ação em grupo é atômica ou parcial? | Atômica: tudo ou nada |
| 6 | Depois da criação, o jogador sobe traço direto em Evoluir? | Não. Depois de concluída a criação, só por pedido de XP aprovado |
| 7 | Regras da casa na criação | O narrador ajusta o orçamento da crônica ou da ficha, e pode marcar "criação livre" |
| 8 | Fichas criadas antes do orçamento | Sem impacto: ainda não há jogadores reais |
| 9 | Onde o ex-membro acha as fichas arquivadas? | A crônica continua na lista dele, marcada "Você saiu", só com as fichas dele em Leitura (5.2) |
| 10 | A rolagem sem custo continua livre na ficha travada? | Sim, porque não muda a ficha (5.1) |
| – | Quem vê as fichas da crônica? | O jogador vê só as dele; o narrador vê todas (§3.2) |

Nenhuma decisão em aberto.

Pendente, não é decisão: conferir no livro as tabelas de criação e de custo (`freebie` e `xp`) dos três sistemas antes de escrever os templates.
