# P03-C · Rascunho, salvamento e conflitos: plano de implementação

> Plano · 2026-11-01 · base conferida: `onda/1-fundacao` em `3892588` (código igual ao `main` `1db3db9`)

Este plano corrige o pacote [P03-C da matriz de achados](../testes/2026-11-01/matriz-achados.md#p03-c): nada do que a pessoa faz na criação se perde nem se duplica. O rascunho de Criação/Editar passa a viver no armazenamento do aparelho que já existe (cifrado no app, IndexedDB no web) e é oferecido de volta ao reabrir. O indicador do cabeçalho diz a verdade. "Criar ficha" e "Criar crônica" ficam idempotentes no servidor. O conflito (409) aponta só o campo em conflito, com os dois valores e quem mudou. É um pacote de correção: não muda regra do jogo, não remove campo e não afrouxa limite (prioridades, pontos por grupo, bônus, limite de 20 fichas).

Todas as linhas citadas foram conferidas no checkout do cabeçalho. Onde a matriz marca "(estimado)" ou a causa provável está errada, a seção 3 diz.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md), "Como executar" e §P03-C | Itens, decisões, critério de saída da onda e "PR local" |
| [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) §7 e [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §4 e §9 (R-03, R-16, R-21) | Recomendações e mapa da criação |
| [arquitetura-motor-de-ficha.md](../arquitetura-motor-de-ficha.md) §6.5, §6.6, §7 e §8.2 | Store, rascunho, outbox, storage cifrado e pipeline do lote |
| [plano-v4.md](../plano-v4.md) §3.1 e Etapa 5 | Prioridades como comando, avaliação parcial da criação |
| [README dos templates](../../design/templates/README.md) §10 e §11 | Eventos, conflito, histórico sem conteúdo e segurança |

## 1. Objetivo e itens

| ID | Sev. | O que este pacote corrige |
|---|---|---|
| T-02 | alta | Dois toques em "Criar ficha" ou "Criar crônica" criam duas fichas ou duas crônicas; a ficha do jogador vai sem `clientCommandId`. |
| T-03 | alta | O rascunho de Criação/Editar só vive na memória: fechar o app, uma queda ou F5 apagam tudo, sem aviso nem recuperação. |
| T-12 | alta | O `Banner` com botões espreme o texto numa coluna de ~25 px e o aviso de conflito fica ilegível. |
| T-17 | média | "● Salvo" verde enquanto há "N alterações" que só vivem no aparelho (e até na tela "sem acesso"). |
| T-31 | média | Um conflito num campo recusa o lote e o aviso culpa os 7 campos; "Reaplicar" sobrescreve o valor do outro sem mostrá-lo. |
| T-54 | baixa | O resumo "Salvar/Concluir N alterações?" vem fora da ordem da ficha, sem caminho, com "de" errado ("Aparência 0 → 3"). |
| T-56 | baixa | Voltar, F5 ou o Voltar do Android na Nova ficha e nas regras da crônica descartam o que foi preenchido sem perguntar. |
| T-78 | baixa | "Descartar" (vermelho e cheio) colado ao "Salvar", com o mesmo peso. |

## 2. Decisões aplicadas

**O P03-C não tem decisão própria (D-xx).** É correção: nenhuma linha cria estado, ação ou fluxo novo no sentido da legenda da matriz. As decisões D-00 a D-14 são de outros pacotes; esta seção diz como o desenho as respeita.

**D-01 (P03-D, onda 3: "Salvar" sempre na barra, "Concluir" ao lado, "Salvar e sair" no aviso, "Salvar alterações" no Editar).** O P03-C deixa o caminho livre e mais curto:

- **Não mexe na barra.** `EvolveBar` e a escolha do rótulo (`apps/frontend/sheet/evolve/ModeBar.tsx` l.172–201 e l.264–313) ficam intactos. O P03-C só toca no `review` (l.110–121, valor efetivo) e no `SummarySheet` (l.315–411, ordem, caminho e "Descartar" secundário).
- **Um caminho de salvar só.** `saveDraft` (`apps/frontend/sheet/store/sheetStore.ts` l.569) continua sendo a única ação que grava o rascunho. O registro persistido some quando o lote já está no outbox. "Salvar e sair" da D-01 vira `saveDraft` + liberar a navegação, sem lógica nova de persistência.
- **A guarda de saída vira componente genérico** (`UnsavedChangesGuard`, T-56) com espaço para uma ação extra. O `LeaveGuard` da ficha passa a usá-lo, e a D-01 só precisa preencher "Salvar e sair" nesse espaço.
- **O vocabulário converge.** O indicador diz "N alterações não salvas", o mesmo verbo do "Salvar alterações" da D-01.
- **A gravação da prioridade não muda** (ver "um modelo só", abaixo): a D-01 não precisa orquestrar um comando de criação junto do lote.

**Outras decisões que encostam no pacote.** D-10 (P09-D, onda 5) vai recolher o painel "Criação de fichas" num resumo de uma linha: a guarda das regras (T-56) fica num componente à parte e sobrevive à mudança. D-04 e D-02 (P04-D) não tocam no rascunho. D-00 (P01-C) traz o build nativo no CI, onde o fluxo Maestro do rascunho (§4) passa a ter binário para rodar.

**O que a matriz recomenda e o código mostra que não se aplica como está escrito** (apontado, não decidido):

1. **"Um modelo só de gravação na criação (prioridade e pontos juntos)" (T-03, T-17, R-03).** Avaliação das duas opções no código:
   - *Os dois gravados na hora:* cada toque em Criação viraria um lote no outbox, como o Jogo. Isso tira o sentido do "Salvar" e contradiz a D-01 ("Salvar" sempre na barra, "Salvar e sair"). Além disso, enche o Histórico de lotes de um ponto e esbarra no rate limit de `/events`. **Descartada:** invade a D-01.
   - *Os dois no rascunho:* é o único modelo compatível com a D-01, e é o **recomendado como destino**. Mas o código impede fazer isso com segurança neste pacote. A prioridade é `characters.creation.choices`, gravada por `PATCH /characters/:id/creation` com `revision` (`apps/frontend/sheet/creation/usePriorityChoice.ts` l.47–73 → `apps/frontend/lib/queries/creation.ts` l.55–70). O servidor recusa escolhas que piorem a conta **da ficha gravada** (`checkCreationUpdate` em `apps/api/src/sheets/creation.ts` l.510–516, "não são gravados sozinhos", plano-v4 §3.1). Já o lote de pontos é avaliado com as prioridades **do servidor** (`checkCreationBatch` em `apps/api/src/sheets/events.ts` l.183–198). Trocar prioridades com pontos já distribuídos trava nas duas ordens: o `PATCH` primeiro é recusado pela ficha antiga, e o lote primeiro é recusado pelas prioridades antigas. Fazer certo exige um contrato novo de API, com escolhas e eventos avaliados juntos sob a mesma trava. Isso muda o desenho da Etapa 5 do plano-v4 (prioridade como comando fora da fila, l.539) e não cabe numa correção.
   - **Neste pacote:** a prioridade continua gravada na hora. A perda e a ilusão de "salvo" saem pelo rascunho persistido (T-03), pelo indicador (T-17) e por uma confirmação explícita "Prioridades salvas" ao escolher. Assim, depois de matar o app, os dois sobrevivem: a prioridade no servidor e os pontos no rascunho recuperável. O endpoint atômico fica como pergunta aberta (§9).
2. **"Deixar o jogador arquivar a própria ficha em criação" (T-02).** É ação nova: pela legenda da matriz (l.6), isso é decisão de produto, e nenhuma D-xx a cobre. Fica **fora do escopo** e vai para o PO. Com a idempotência, a duplicata acidental deixa de existir, que era o motivo do pedido.
3. **"Senhor atualizado vem sem o valor" (T-54).** É regra do projeto, não bug: `packages/sheet-core/src/labels.ts` l.10–12 e o README dos templates §10 ("Notas e textos livres aparecem só como 'atualizado', sem conteúdo") valem para aviso, resumo e histórico. O resumo continua com "atualizado". Mostrar o texto ali seria decisão.
4. **A parte "regras da crônica" do T-56 se sobrepõe à R-31** (aviso ao sair com regras não salvas), que está no P09-D (T-36, D-10). O P03-C implementa a guarda agora, e o P09-D só a reaproveita.

## 3. Desenho por item

### 3.1 T-02 · Criação idempotente de ficha e de crônica

**Causa confirmada.**

- **Ficha do jogador.** `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx` l.78–98 só manda a chave no NPC (l.80–86); a ficha do jogador vai como `values`. No servidor, `POST /chronicles/:id/characters` (`apps/api/src/sheets/routes.ts` l.127–320) já tem tudo para a idempotência: trava a crônica `FOR UPDATE` (l.214–218), consulta `chronicle_commands` (l.225–242) e grava o comando (l.279–300). Mas tudo isso só roda com `kind === 'npc'`. **A chave única já existe** (PK `chronicle_commands (chronicle_id, client_command_id)`, `packages/db/src/migrations/0019_backstage.ts` l.40–58): falta a rota usá-la para a ficha do jogador.
- **Nova crônica.** `apps/frontend/app/(app)/chronicles/new.tsx` manda o pedido em l.42–45; a l.92 que a matriz estima é o `Button` (l.91–96), cujo `busy` chega depois do segundo toque. `POST /chronicles` (`apps/api/src/chronicles/routes.ts` l.135–178) não tem chave, transação nem tabela de comandos. Como a crônica ainda não existe, não há linha-pai para travar, e é preciso uma tabela por usuário.
- **Botão.** `CharacterForm` passa `busy={create.isPending}` ao `Button` (`apps/frontend/sheet/CharacterForm.tsx` l.112). Dois toques no mesmo quadro chamam `submit` duas vezes antes do re-render.

**Servidor: ficha do jogador** (`apps/api/src/sheets/routes.ts`):

- Em l.225 e l.279, trocar `kind === 'npc' && body.clientCommandId` por `body.clientCommandId`. O `kind` do comando passa a ser `'character.create'` para a ficha do jogador e continua `'character.create-npc'` para o NPC. O `request_hash` (l.205–209 com `commandHash`) já cobre `kind`, `values` e `portraitUrl`. A auditoria continua só no NPC.
- **Escopo da chave:** por crônica (PK) e amarrada ao autor. A repetição só devolve o resultado com o mesmo `created_by` e o mesmo hash. Chave igual com outros dados, ou de outra pessoa, recebe 409 `IDEMPOTENCY_CONFLICT`, sem devolver o id (como o NPC hoje, l.231–240).
- **Resposta:** 201 `{ id, duplicate: false }` na primeira vez e 200 `{ id, duplicate: true }` na repetição (l.303), igual ao NPC.
- **Corrida:** a trava da crônica (l.214–218) serializa pedidos simultâneos. O segundo espera, lê o comando gravado pelo primeiro e devolve 200. A PK é o segundo nível de proteção.
- **Limite de 20:** a repetição é conferida **antes** da contagem (l.255–262). Repetir não cria nem conta; chave nova conta com a crônica e o vínculo travados. O limite não muda e não pode ser burlado.
- **Compatibilidade:** `clientCommandId` continua opcional para a ficha do jogador (l.310), para o app antigo nas lojas não quebrar. O NPC continua exigindo a chave (l.139–140). Ver §9.

**Servidor: Nova crônica** (`apps/api/src/chronicles/routes.ts` l.135–178):

- Corpo com `clientCommandId: t.Optional(uuid)` (`uuid` já vem de `../http/params`).
- Com chave, tudo numa transação. Primeiro trava a linha do usuário (`selectFrom('users').where('id','=',me).forNoKeyUpdate()`), no mesmo protocolo de "travar o pai" de `once()` (`apps/api/src/sheets/creation.ts` l.84–125). `FOR NO KEY UPDATE` serializa duas criações do mesmo usuário e a exclusão de conta (que trava `users` `FOR UPDATE`, `apps/api/src/account/routes.ts` l.68–73), sem bloquear as checagens de FK de outras escritas. Depois:
  - consulta `user_commands (user_id, client_command_id)`;
  - na repetição, lê a crônica, o sistema e o papel (`chronicleAccess`) e devolve 200 com o mesmo formato e `duplicate: true` (404 se a crônica já foi excluída);
  - na primeira vez, insere a crônica e o comando (`kind 'chronicle.create'`, hash de `{ name, systemCode }`, `result { id }`) e devolve 201.
- Sem chave, segue como hoje (compatibilidade).
- **Escopo da chave:** por usuário. A mesma chave em outra conta é outra intenção e não colide.

**Migration** (fluxo do CLAUDE.md, sem rodar nada agora):

1. Criar `packages/db/src/migrations/0021_user_commands.ts`:
   - `up`: `createTable('user_commands')` com `user_id uuid not null references users(id) on delete cascade`, `client_command_id uuid not null`, `kind text not null`, `request_hash text not null`, `result jsonb not null`, `created_at timestamptz not null default now()` e PK `user_commands_pkey (user_id, client_command_id)`. O `cascade` combina com a exclusão de conta, que apaga a linha de `users` (`apps/api/src/account/routes.ts` l.120).
   - `down`: `dropTable('user_commands')`.
2. Registrar em `packages/db/src/migrations.ts` (l.21 e l.48: `'0021_user_commands': m0021`). O teste de `migrations.test.ts` confere que todo arquivo está na lista.
3. `npx pnpm db:migrate` → `npx pnpm db:codegen` (atualiza `packages/db/src/types.ts`) → `cd packages/db && npx pnpm build`.
4. O número 0021 pode colidir com uma migration do P02 (T-47): ver §8.4.

**App:**

- Mover `useCommandKey` (`apps/frontend/lib/queries/creation.ts` l.17–29) para `apps/frontend/lib/commandKey.ts` e importá-lo de volta em `creation.ts`. A semântica é a que já vale nos comandos da criação: a chave fica enquanto o resultado é desconhecido (erro de rede) e troca quando há resposta.
- `useCreateChronicle` e `useCreateCharacter` (`apps/frontend/lib/queries/chronicles.ts` l.39–47 e l.146–176) geram a chave dentro do hook, para ficha do jogador e NPC: `clientCommandId: key.current()` no corpo e `key.settle(error)` no `onSettled`. A tela deixa de cuidar da chave: sai o `commandId` de `new-character.tsx` l.35 e l.84.
- **Trava síncrona por `ref`** em `new-character.tsx` (`onSubmit`, l.78) e em `new.tsx` (`submit`, l.35): `if (submitting.current) return; submitting.current = true` antes do `mutate`. Ela só volta a `false` no `onError`; no sucesso, a tela navega e o `ref` fica travado até desmontar. A trava fica na tela, não no `Button` do `@tms/ui`: mudar a semântica de todo botão é componente compartilhado (P06) e não é preciso.

### 3.2 T-03 · Rascunho persistido e "Recuperar N alterações"

**Causa confirmada.** O rascunho é `draft: Draft | null` no store da ficha (`apps/frontend/sheet/store/sheetStore.ts` l.104, `startDraft` l.558, `editDraft`). Ele só vira lote no `saveDraft` (l.569) e não passa pelo outbox persistido (`apps/frontend/sheet/sync/persistedOutbox.ts` guarda só lotes). O `LeaveGuard` (`apps/frontend/sheet/evolve/LeaveGuard.tsx` l.13–61) segura a navegação e o `beforeunload`, mas não um kill nem uma queda. A prioridade é gravada à parte: a matriz diz "suposto", mas está confirmado (`usePriorityChoice.ts` l.47–73 → `PATCH /characters/:id/creation`).

**Onde o rascunho fica (o armazenamento que já existe).** Fica no mesmo `KeyValueStorage` do outbox e do cache, pelo `UserStorage` que o `OfflineProvider` entrega (`apps/frontend/lib/persist.tsx` l.240–245; `scopeStorage` em `apps/frontend/sheet/sync/kv.ts` l.52–83):

- **iOS e Android:** a tabela `storage` do banco **SQLCipher** `tms-offline.db` (`apps/frontend/sheet/sync/encryptedStorage.ts`).
  - **Chave:** 32 bytes aleatórios (`expo-crypto`), guardados só no `expo-secure-store` como `tms.offlineDbKey` com `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (`storage.native.ts` l.11–22). Entra como raw key no `PRAGMA key` e nunca vai para log.
  - O app tem `allowBackup: false`.
  - **Fail secure:** sem SQLCipher no release ou com falha do SecureStore, o storage fica em memória. O rascunho então não persiste, como o outbox, mas nunca vai em claro. Só o Expo Go de desenvolvimento abre sem cifra (`allowPlaintext`, l.25).
- **Web:** o IndexedDB `tms-offline` (`storage.web.ts`). Não tem cifra em repouso, por projeto (arquitetura §7.2); a mitigação é o escopo por usuário e a limpeza no logout.
- **Nunca AsyncStorage nem localStorage.** O app não tem AsyncStorage como dependência, e o `tokenStore` já proíbe os dois.
- **Chave:** `draft:<characterId>` dentro do escopo, ou seja, `u:<userId>:draft:<characterId>`. Outro usuário no mesmo aparelho abre outro escopo e não lê o registro.

**O registro guarda só a ficha.** Lista fechada de campos; nada de token, credencial, rótulo ou texto da tela:

```ts
// apps/frontend/sheet/sync/draftStore.ts
interface DraftRecord {
  readonly v: 1
  readonly characterId: string // UUID
  readonly templateVersion: string // versão do template da ficha
  readonly baseVersion: number // sheetVersion quando o rascunho foi gravado
  readonly mode: 'create' | 'evolve'
  readonly savedAt: number // ms; no futuro ou com mais de 7 dias: descartado
  readonly edits: readonly { path: string; from: unknown; to: unknown }[]
}
```

**Módulo novo `apps/frontend/sheet/sync/draftStore.ts`:**

- `createPersistedDraftStore(storage)` e `createMemoryDraftStore()`, com `read`, `write`, `remove`, `characters`, `clear` e `sweep(now)`, serializados como o `persistedOutbox` (l.48–55).
- **O que vem do disco é input hostil:** `parseDraftRecord` descarta e apaga o registro quando:
  - o JSON está quebrado, `v` é outro, o id não é UUID ou `baseVersion` não é inteiro ≥ 0;
  - algum caminho não passa em `parsePath` ou se repete;
  - há mais de `MAX_EVENTS_PER_BATCH` (50) alterações ou mais de `MAX_BATCH_BYTES` (64 KiB);
  - `savedAt` está no futuro ou passou de 7 dias, o mesmo prazo do cache (`CACHE_MAX_AGE_MS`).
- O log, quando houver, leva só o tipo do problema, como o `encryptedStorage`, nunca o conteúdo.

**Ligação:**

- O `SyncProvider` (`apps/frontend/sheet/sync/SyncProvider.tsx` l.43–56) cria o `drafts` junto do outbox, com o mesmo `userStorage` (sem ele, em memória), e o expõe em `Sync` (`sync.drafts`).
- `sync.reset()` (`sync.ts` l.244–250, chamado no `onSignOut`) também chama `drafts.clear()`.
- `sync.start()` chama `drafts.sweep(Date.now())`.
- `Sync.enqueue` (l.215–226) passa a devolver a Promise que já existe, e o tipo `SheetSync.enqueue` aceita `void | Promise<void>`.
- Um hook `useLocalChanges()` no `SyncProvider` devolve `{ pending, drafts }` para o aviso de logout do P02 (§8.4).

**Persistência na ficha aberta** (`LiveSheet`, `apps/frontend/sheet/SheetScreen.tsx` l.259–365), com o hook `useDraftPersistence(store, sync.drafts, …)`:

1. **Ao montar**, lê o registro da ficha. Enquanto a leitura não volta, nada é gravado nem apagado.
   - Sem registro, o persistidor fica ativo.
   - Com registro e o rascunho em memória vazio, abre a oferta (abaixo) e fica **pausado** até a decisão, para não apagar o registro com o rascunho vazio que o modo Criação inicia (`SheetScreen.tsx` l.313).
   - Se já houver edição feita nesta abertura (corrida de milissegundos), vale a da memória e o registro é sobrescrito.
2. **A cada mudança de `draft`**, grava o registro inteiro, coalescendo as gravações (uma em voo e a última pendente, sem timer). A gravação pendente sai na hora quando o `AppState` muda, o que cobre ir para o fundo no nativo e `visibilitychange`/`pagehide` no web via react-native-web.
3. **Depois de "Descartar"** (resumo, "Descartar e sair", troca de modo descartando), apaga o registro na hora.
4. **Depois de "Salvar"**, só apaga quando o lote está no outbox. `commit` guarda a Promise do `enqueue`, e o store expõe como o rascunho saiu (`draftExit: { kind: 'saved', queued } | { kind: 'discarded' }`). Se a gravação no outbox falhar, o registro fica e a próxima abertura oferece recuperar. Se o app morrer entre as duas gravações, a recuperação descarta sozinha o que já está aplicado (valor atual igual ao `to`).
5. **Num 404 da ficha**, o efeito que já remove a consulta (`SheetScreen.tsx` l.73–76) também apaga o registro.

**Recuperar ao reabrir** (componente novo `apps/frontend/sheet/DraftRecovery.tsx`, no `LiveSheet`):

- `BottomSheet` "Alterações não salvas": "Você tem N alterações não salvas nesta ficha, de dd/mm às hh:mm. Recuperar?". Ações: "Recuperar" (principal) e "Descartar" (secundária, com o mesmo padrão do T-78). Fechar (× ou Esc) é "decidir depois": o registro fica, o persistidor segue pausado e a ficha fica no modo padrão. Entrar em Criação/Editar oferece de novo, para não existirem dois rascunhos.
- Só sobra "Descartar", com o motivo, quando:
  - a política força um modo (`policyMode`, `SheetScreen.tsx` l.254–262: travada, arquivada, de quem saiu);
  - a versão do template mudou;
  - nenhuma alteração passa na revalidação.
- **"Recuperar"** chama a ação nova do store `restoreDraft(record)`. Para cada alteração:
  - o caminho existe, o papel escreve (`canWrite`), não é derivado nem do extrato de XP: senão sai, com aviso de quantas;
  - valor atual igual ao `from`: entra no rascunho como estava;
  - valor atual igual ao `to` (já salvo noutro aparelho ou antes da queda): sai em silêncio;
  - valor atual diferente dos dois: entra no rascunho **marcado como conflito** (§3.4, origem `recovery`).
  - O conjunto passa por `applyBatch` com o `from` atual, que confere forma, permissão e `validateSheet`. A conta da criação pode mostrar excesso enquanto é corrigida (plano-v4 §3.1); o `saveDraft` continua recusando o que estoura.
- O modo volta a ser `create` se a criação por pontos ainda vale (`creationActive`), senão `evolve`.
- **Conflito por campo:** como `baseVersion` é guardada, rascunho e servidor na mesma versão pulam a comparação. Com versões diferentes, a comparação é por caminho, a mesma do 409 (T-31).

**Correção que vem junto.** `parseQueuedBatch` (`persistedOutbox.ts` l.44) descarta o `draft: true` do lote. Como o sender lê o lote do outbox, `rejectionMessage(..., batch.draft)` (`sync.ts` l.192–197) recebe `false` mesmo com a fila em memória, e o lote perde a origem depois de reiniciar o app. Passa a guardar `draft` (booleano, só `true` ou ausente). O T-31 depende disso para devolver ao rascunho o lote recusado.

### 3.3 T-17 · Indicador que diz a verdade

**Causa confirmada.** `describeSync` (`apps/frontend/sheet/sync/SyncIndicator.tsx` l.14–29) só olha a fila (`pending`, `failure`) e cai em "Salvo" (l.28). O rascunho não entra na conta. O indicador aparece em qualquer estado da tela (`SheetScreen.tsx` l.170), inclusive "Você não tem acesso a esta ficha" (QAW-05).

**Mudança:**

- `describeSync(status, online, unsaved = 0)`:
  - com `unsaved > 0`, devolve o estado novo `unsaved` com "N alterações não salvas" ("1 alteração não salva"), acrescido de " · offline" sem rede. Esse estado vence offline, erro, salvando e salvo;
  - ponto na cor `action`;
  - rótulo acessível "Sincronização: N alterações não salvas" (o prefixo fica, porque os fluxos do Maestro conferem "Sincronização: …").
- `SheetScreen` guarda a contagem que o `LiveSheet` informa (`store.subscribe` em `draft?.size`) e só mostra o `SyncIndicator` com `state.status === 'ready'`. Fora disso, sai o "Salvo" das telas de erro e sem acesso.
- **Prioridade:** `usePriorityChoice.ts` l.47–73 ganha `onSuccess` com o toast "Prioridades salvas" e anúncio ao leitor de tela. Assim a pessoa vê que a prioridade foi gravada e os pontos não (IA-03), sem mudar o modelo (§2, item 1).
- Vale também para a edição do narrador (NW-31): o componente é o mesmo.

### 3.4 T-31 · Conflito por campo: seu valor × valor atual, e quem mudou

**Causa provável da matriz: errada em parte.** O 409 de `POST /characters/:id/events` (`apps/api/src/sheets/events.ts` l.133–152) **já** lista só os caminhos em conflito (`issues`, de `applyBatch`, `packages/sheet-core/src/events.ts` l.134–141). Também já traz o valor atual desses caminhos filtrado por papel (`current`, depois de `stripRestricted`) e a `sheetVersion`. Recusar o lote inteiro é de projeto: o lote é atômico, "tudo ou nada" (README dos templates §10). O "culpa os 7" é do **cliente**:

- `sync.ts` l.176–180 ignora o corpo do 409;
- `conflicted` (`sheetStore.ts` l.518–534) marca todos os caminhos do lote;
- `reapply` (l.536–549) regrava todos;
- o `ConflictBanner` (`apps/frontend/sheet/ConflictBanner.tsx` l.8–49) oferece "Reaplicar" sem mostrar valor nenhum.

**O que muda na API (pequeno e aditivo).** Só falta "quem mudou". O 409 ganha `changedBy: Record<path, 'self' | 'owner' | 'storyteller' | null>`, calculado dentro da mesma transação, com a ficha travada:

- Para cada caminho em conflito, o lote mais recente que o tocou (`character_events` ⨝ `character_batches`, `distinctOn('e.path')`, ordem `created_at desc, id desc`).
- `'self'` quando `created_by` é quem pediu (outro aparelho). Senão, o `by_role` do lote: `'owner'` (o jogador) ou `'storyteller'` (o narrador).
- **`null` quando o lote é de uma rolagem oculta e quem pediu não é narrador**, a mesma regra do Histórico (`events.ts` l.323–337). Sem isso, o aviso revelaria ao jogador que houve uma rolagem oculta. Não se escolhe o lote anterior: isso atribuiria a mudança a outra pessoa.
- **Nunca** vai id nem nome de usuário: o papel relativo basta.
- Os caminhos já passaram por `canWrite` antes do conflito (no `applyBatch`, o `forbidden` vem antes do `conflicts`: `packages/sheet-core/src/events.ts` l.130–141), então ninguém recebe 409 de campo que não escreve. As Notas do Narrador nunca chegam ao jogador: ele recebe 403 antes. O `stripRestricted` do `current` continua como segunda camada. O `viewer` recebe 404 antes de tudo (`events.ts` l.66).

**App:**

- `sync.ts` (`conflicted`, l.176–180) passa o 409 já validado ao store com `parseConflictBody(body, batch)`. A validação trata o corpo como hostil:
  - só caminhos que estão no lote, até 50, com `parsePath` válido;
  - `changedBy` só com os quatro valores conhecidos;
  - `current` é ignorado: o valor atual vem do store depois do refetch que já acontece (l.179).
- `SheetConflict` (`sheetStore.ts` l.56–59) passa a `{ batches, paths, origin: 'draft' | 'play' | 'recovery', changedBy }`, com `paths` só dos campos em conflito.
- **Lote do rascunho** (`batch.draft` e nenhum rascunho aberto), como o 422 já faz (l.491–516):
  - as **7 alterações voltam ao rascunho**, e o modo volta para `create`/`evolve`;
  - as 6 sem conflito ficam prontas para salvar;
  - o Senhor fica marcado, com o `from` antigo, e "Salvar" continua recusado com a mensagem que o `ModeBar` já mostra para `conflict` (l.134–136) até a pessoa escolher.
  - O fluxo de "Concluir" não segue (`useFinishCreation` desiste com `dirty`, `apps/frontend/sheet/creation/CreationPanel.tsx` l.90–100). A aprovação com dado velho continua não acontecendo.
- **Lote do Jogo:** não é reaplicado em parte. Uma ação do Jogo pode mexer em campos ligados (curar com Sangue: Vitalidade e Sangue), e reaplicar só um quebraria a ação. A folha mostra os campos em conflito com os dois valores e oferece "Reaplicar tudo" e "Manter como está".
- **Ações novas no store:**
  - `resolveConflict(path, 'mine' | 'theirs')` para as origens `draft` e `recovery`. `mine` refaz a entrada com `from` = valor atual e `to` = o seu; `theirs` tira a entrada do rascunho.
  - `reapply()` continua para a origem `play`.
- **Tela:**
  - O `ConflictBanner` passa a nomear só os campos em conflito ("Senhor foi alterado pelo narrador antes de a sua alteração chegar. As outras 6 continuam no rascunho."), com a ação "Revisar". **Não há mais "Reaplicar" na faixa.**
  - A folha nova `apps/frontend/sheet/ConflictSheet.tsx` (`BottomSheet` "Campos em conflito") mostra uma linha por campo:
    - o caminho ("Identidade › Senhor", de `fieldPlace`, T-54);
    - "Seu valor: …" e "Valor atual: … · alterado pelo narrador | pelo jogador | por você, em outro aparelho | em outro lugar";
    - "Ficar com o atual" e "Usar o meu" **na mesma linha dos dois valores**: a pessoa só reaplica depois de ver o valor da outra pessoa.
  - O valor sai de `describeValue(model, path, value)`, novo em `labels.ts`, com os formatos de `change()` (l.47–114). Em `text`/`longText` mostra o próprio texto, até 80 caracteres, porque a escolha exige vê-lo. O comentário restringe o uso à tela de conflito: aviso, histórico e log continuam sem conteúdo (README §10/§11).
- **Android: o formulário de devolução reaparecia preenchido** (nota do QA app às 15:51). Causa: `CreationStatusPanel` (`CreationPanel.tsx` l.306–307) guarda `returning` e `reason` e continua montado quando o estado sai de `pending` (l.309 só devolve `null`). Ao voltar a `pending`, o formulário antigo reaparece. Correção: zerar os dois no `onSuccess` da devolução (l.384) e quando o estado deixa `pending`.

### 3.5 T-12 · `Banner` em coluna quando falta largura

**Causa confirmada.** O estilo `banner` (`packages/ui/src/Banner.tsx` l.62–70) é `flexDirection: 'row'` sem quebra. O texto (`text: { flex: 1 }`, l.71) tem base 0 e encolhe até ~25 px quando os botões ocupam a largura (`ConflictBanner.tsx` l.56).

**Mudança** (só estilo, sem prop nova; vale para todos os usos, inclusive `account.tsx` l.82):

- `banner` com `flexWrap: 'wrap'`, `rowGap` e `columnGap`.
- `text` com `flexGrow: 1`, `flexShrink: 1`, `flexBasis: MIN_TEXT_WIDTH` (200, constante no arquivo) e `minWidth: 0`.
- A ação num `View` que, sem espaço ao lado de 200 px de texto, desce para a linha de baixo, alinhada ao início. Em 390 px de largura, o texto fica em cima e os botões embaixo; em 1280, tudo continua numa linha.
- A acessibilidade (`accessible={!action}`, l.40) não muda.

### 3.6 T-54 · Resumo na ordem da ficha, com caminho e valor efetivo

**Causa: a matriz não identificou a da ordem.** O template chega do banco por `trait_templates.template_data`, que é **`jsonb`** (`packages/db/src/migrations/0006_trait_templates.ts` l.12). O `jsonb` não guarda a ordem das chaves de objeto: ordena por tamanho da chave e depois por bytes. `compileTemplate` monta `model.fields` com `Object.entries(template.fields)` (`packages/sheet-core/src/compile.ts` l.169–186), e `draftToEvents` ordena por esse mapa (`sheetStore.ts` l.248–255). As listas dos testes batem exatamente com essa ordem:

- "Senhor, Coragem, Força, Consciência, Antecedentes, Disciplinas, Autocontrole" = `sire`(4), `courage`(7), `strength`(8), `conscience`(10), `backgrounds`/`disciplines`/`selfControl`(11) (`img/qa-web/57-concluir-revisao-390.webp`);
- "Raciocínio, Briga, Condução, Ocultismo, Empatia" = `wits`(4), `brawl`/`drive`/`occult`(5), `empathy`(7) (QAW-39).

As **seções** são arrays e o `jsonb` mantém a ordem deles.

**Causa do "de" errado (confirmada, como o POA-08 sugere).** O `SummarySheet` (`ModeBar.tsx` l.375–388) usa `describeEvent` com o `from` cru do rascunho. Sem valor guardado, `change()` cai em `def.min ?? 0` (`labels.ts` l.55–62): o padrão da Aparência vem do clã (`{ from: 'clan', map }`) e a Humanidade é derivada (`{ derive: 'sum' }`), daí "0 → 3" e "0 → 7". O Histórico acerta porque o servidor usa `withEffectiveFrom` (`events.ts` l.236).

**Mudança:**

- **Core:** arquivo novo `packages/sheet-core/src/order.ts`, exportado em `index.ts`, com memo por modelo:
  - `fieldOrder(model)` dá a ordem da ficha: seções do template na ordem do array, grupos e campos; depois os campos fora de seção, na ordem do modelo.
  - `fieldPlace(model, id)` dá onde o campo aparece: `{ section: 'Habilidades', group: 'Talentos' }`, pela primeira seção que o mostra.
- **Store:** `draftToEvents` (`sheetStore.ts` l.248–255) passa a ordenar por `fieldOrder`. O lote sai na ordem da ficha. A ordem dos eventos não muda o resultado: os caminhos são distintos e `applyBatch` confere `from` por caminho.
- **Resumo:**
  - `review` (`ModeBar.tsx` l.110–121) guarda, só para mostrar, `withEffectiveFrom(model, s.values, events)`. O lote continua com o `from` cru, que é o que o conflito compara.
  - O `SummarySheet` agrupa por `fieldPlace` com um subtítulo por grupo ("Atributos › Sociais") e rótulo acessível com o caminho ("Habilidades, Talentos, Consciência, 1 → 3"). Isso separa a Consciência Talento da Consciência Virtude (EW-26).
  - O "de" efetivo vale também para os recursos: "Força de Vontade permanente 5 → 7", não "— → 7".
- **O que não muda:** "Disciplinas 0 → 3 itens" (contagem de lista) e "Senhor atualizado" (regra do projeto, §2 item 3). O "de" da Humanidade é o efetivo **da ficha salva** (2 → 7, como o Histórico), não um valor intermediário do rascunho.

### 3.7 T-78 · "Descartar" como ação secundária

**Causa confirmada.** `ModeBar.tsx` l.354–357: `<Button title="Descartar" variant="danger" />` ao lado de "Salvar", no rodapé do `BottomSheet`, que é `flex-end` com `gap` (`packages/ui/src/BottomSheet.tsx` l.112–117).

**Mudança só no `SummarySheet`, sem tocar no `BottomSheet` (P06):**

- "Descartar" vira `variant="ghost"`, dentro de um `View` com `flex: 1, alignItems: 'flex-start'`, que o leva para a borda esquerda, longe do "Salvar".
- "Salvar" fica como ação principal à direita.
- A ordem de foco não muda (Descartar, Salvar), e o `accessibilityHint` "Descarta as N alterações".
- A folha "Concluir criação?" (l.344–352) já tem "Voltar" em ghost e não muda.

### 3.8 T-56 · Guarda de saída na Nova ficha e nas regras da crônica

**Causa confirmada.** A guarda só existe na ficha (`LeaveGuard.tsx`, `usePreventRemove` em l.20). `new-character.tsx` não tem guarda. `CreationSettings` (`apps/frontend/components/chronicles/CreationSettings.tsx`) já calcula `changed` (l.68–70), mas não o usa para segurar a saída.

**Mudança:**

- **Componente novo `apps/frontend/components/UnsavedChangesGuard.tsx`:**
  - props `{ when, message, onDiscard?, allowLeave?: RefObject<boolean>, extraAction?: ReactNode }`;
  - `usePreventRemove(when, …)`: se `allowLeave.current`, libera na hora (`repeat()`); senão, abre o `BottomSheet` "Sair sem salvar?" com "Continuar editando" e "Descartar e sair";
  - o `usePreventRemove` também segura o Voltar do Android e o `beforeunload` do web, como já faz na ficha.
  - `extraAction` é o espaço do "Salvar e sair" da D-01.
- **`LeaveGuard.tsx`** vira um invólucro dele (contagem do store, mensagem com `changesLabel`, `onDiscard` = `discardDraft`), com o mesmo texto. O `LeaveGuard.test.tsx` continua valendo.
- **Nova ficha:**
  - `CharacterForm` ganha a prop opcional `onDirtyChange(dirty)` (algum campo com valor depois do `trim`), chamada em `onChange` (`CharacterForm.tsx` l.102–105);
  - `new-character.tsx` usa `<UnsavedChangesGuard when={dirty} allowLeave={created} … />`;
  - no `onSuccess`, `created.current = true` **antes** do `router.replace` (l.92). Sem isso, a própria guarda seguraria a ida para a ficha recém-criada.
- **Regras da crônica:** `<UnsavedChangesGuard when={changed} message="As regras da criação mudaram e não foram salvas." onDiscard={reset} />` dentro do painel (l.89). São três linhas e um import em `CreationSettings.tsx`, para conflitar o mínimo com o P01-C (§8.4).
- O formulário da Nova ficha não é persistido: a matriz pede "confirmar ou guardar", e há pouco a perder. A guarda basta.

## 4. Testes

Um teste de regressão para cada bug, que falha no `1db3db9` e passa com a correção.

| Item | Regressão | Tipo |
|---|---|---|
| T-02 | `apps/api/src/__tests__/characters.test.ts`:<br>• ficha do jogador com a mesma chave: 201 e depois 200 com o mesmo id, uma linha só;<br>• mesma chave com outros dados: 409 `IDEMPOTENCY_CONFLICT`, sem id no corpo;<br>• mesma chave de outro membro: 409;<br>• repetição com 20 fichas: 200 com a mesma ficha; chave nova com 20: 422;<br>• sem chave: continua criando | API, PGLite (`useTestDb()`) |
| T-02 | `apps/api/src/__tests__/chronicles.test.ts`:<br>• `POST /chronicles` com a mesma chave: 201 e depois 200 com o mesmo corpo e `duplicate: true`;<br>• mesma chave com outro nome: 409;<br>• mesma chave em outra conta: duas crônicas independentes;<br>• repetição de crônica excluída: 404 | API, PGLite |
| T-02 | `apps/api/src/__tests__/idempotency.pg.test.ts` (novo, no molde de `backstage.pg.test.ts` l.90–125):<br>• 4 `POST` simultâneos de ficha do jogador com a mesma chave dão `[200, 200, 200, 201]` e 1 ficha;<br>• 4 `POST /chronicles` simultâneos dão o mesmo, com 1 crônica;<br>• com 19 fichas, 4 simultâneos com a mesma chave dão 1×201 e 3×200, total 20;<br>• duas chaves diferentes com 19 fichas: uma 201 e uma 422 | Postgres real (`PG_TEST_URL`) |
| T-02 | `packages/db/src/__tests__/migrations.test.ts`: `0021` sobe e desce; a PK recusa a mesma `(user_id, client_command_id)`; excluir o usuário apaga as linhas dele | `@tms/db` (Bun) |
| T-02 | `apps/frontend/app/__tests__/new-character.test.tsx` e `chronicles.test.tsx` ("Nova crônica"):<br>• dois `press` seguidos antes da resposta mandam **um** POST;<br>• a chave vai no corpo da ficha do jogador;<br>• depois de erro de rede, a nova tentativa usa a mesma chave; depois de 422, outra | Jest + RNTL |
| T-02 | `e2e/tests/create-character.spec.ts` e `chronicles.spec.ts`: `dblclick` em "Criar ficha" e em "Criar crônica"; contador de `POST` em `page.on('request')` igual a 1, e uma ficha ou crônica na lista (cenário QAW-08) | Playwright |
| T-03 | `apps/frontend/sheet/sync/__tests__/draftStore.test.ts` (novo):<br>• grava e lê;<br>• input hostil descartado e apagado: JSON quebrado, `v` errado, id não UUID, caminho inválido ou repetido, mais de 50, mais de 64 KiB, `savedAt` no futuro ou vencido;<br>• o JSON gravado só tem as chaves da lista fechada (nenhum token);<br>• o usuário B não lê o rascunho de A (`scopeStorage`);<br>• `clear` apaga;<br>• gravação atrasada depois de `close()` não grava;<br>• nenhum `console.*` com valores | Jest |
| T-03 | `sheetStore.test.ts`: `restoreDraft` separa o que entra, o que já está aplicado, o que conflita e o que o papel não escreve; `draftExit` depois de salvar e de descartar | Jest |
| T-03 | `apps/frontend/sheet/__tests__/LiveSheet.test.tsx`:<br>• 3 alterações em Criação gravam o registro;<br>• desmontar e montar um store novo (o "kill") oferece "3 alterações não salvas";<br>• "Recuperar" volta à Criação com 3;<br>• "Descartar" apaga;<br>• fechar a oferta mantém o registro e pausa a gravação;<br>• salvar apaga só depois do `enqueue`;<br>• ficha travada só oferece "Descartar" | Jest + RNTL |
| T-03 | `sync.test.ts`: `reset()` apaga os rascunhos; `persistedOutbox.test.ts`: o `draft: true` sobrevive ao disco | Jest |
| T-03 | `e2e/tests/draft.spec.ts` (novo):<br>• Criação, prioridade e +1 em 3 traços;<br>• `page.reload()` aceitando o `beforeunload`;<br>• oferta "3 alterações", "Recuperar", resumo com 3, "Salvar";<br>• logout zera as chaves `:draft:` do IndexedDB `tms-offline` (molde de `offline.spec.ts` l.96–140) (cenário IW-01) | Playwright |
| T-03 | `apps/frontend/.maestro/09-draft-recovery.yaml` (novo), Android e iOS:<br>• abrir a ficha em Criação, +1 em 3 traços;<br>• `stopApp`, `openLink`;<br>• "Recuperar" e "Sincronização: 3 alterações não salvas" (cenários QAA-03, IA-01, EA-04) | Maestro, dev build |
| T-17 | `SyncIndicator.test.tsx`: `describeSync` com rascunho dá "3 alterações não salvas" (e singular, e offline); `SheetScreen.test.tsx`: sem indicador na tela "sem acesso" (QAW-05) e o cabeçalho acompanha o rascunho | Jest + RNTL |
| T-31 | `apps/api/src/__tests__/events.test.ts`:<br>• o 409 traz `changedBy` `'storyteller'` para o dono, `'owner'` para o narrador e `'self'` para o mesmo usuário;<br>• `null` quando o último lote é rolagem oculta e quem pede é o dono;<br>• nenhum id ou `username` no corpo;<br>• o caminho das Notas do Narrador dá 403 ao dono, não 409, e sem valor | API, PGLite |
| T-31 | `sync.test.ts` (corpo do 409 hostil: caminho fora do lote ignorado, mais de 50 cortados, `changedBy` desconhecido vira `null`) e `sheetStore.test.ts`:<br>• lote do rascunho com 7 caminhos e 1 em conflito volta com 7 entradas e `paths = ['values.sire']`;<br>• "atual" tira a entrada; "meu" refaz o `from` | Jest |
| T-31 | `apps/frontend/sheet/__tests__/ConflictSheet.test.tsx` (novo): a faixa nomeia só o Senhor e não tem "Reaplicar"; a linha mostra os dois valores e "pelo narrador" ao lado de "Usar o meu"; `CreationScreen.test.tsx`: depois de devolver, o formulário fecha e o motivo zera | Jest + RNTL |
| T-31 | `e2e/tests/conflict.spec.ts` (novo, dois contextos):<br>• narrador salva Senhor=Etrius;<br>• jogador com rascunho de 7 conclui;<br>• a faixa culpa só o Senhor; "Revisar" mostra "Etrius" e "Meerlinda" e "pelo narrador";<br>• escolhida uma das duas, as outras 6 se salvam;<br>• a conclusão não acontece com dado velho (cenário QAW-20) | Playwright |
| T-12 | `packages/ui/src/Banner.test.tsx` (arquivo novo, fora do `components.test.tsx` que o P06 edita): com `action`, `flexWrap: 'wrap'` e base mínima do texto; sem `action`, um elemento acessível só. No `conflict.spec.ts` a 390 px, o texto tem pelo menos 200 px de largura e os botões ficam abaixo dele (`boundingBox`) (QAW-19) | Jest + Playwright |
| T-54 | `packages/sheet-core/src/__tests__/order.test.ts` (novo): com `template.fields` em ordem de `jsonb` (por tamanho da chave), `fieldOrder` segue as seções; `fieldPlace` separa "Habilidades › Talentos" de "Vantagens › Virtudes" | Bun |
| T-54 | `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx`:<br>• o resumo mostra "Aparência 1 → 3" (de efetivo pelo clã) e "Força de Vontade permanente 5 → 7";<br>• grupos na ordem da ficha;<br>• rótulo com caminho;<br>• o lote enviado continua com o `from` cru | Jest + RNTL |
| T-78 | `evolve.test.tsx`: "Descartar" em `ghost`, separado à esquerda; "Salvar" é a ação principal | Jest + RNTL |
| T-56 | `new-character.test.tsx`: formulário preenchido segura a saída ("Sair sem salvar?"); depois de criar, a navegação para a ficha passa. `CreationSettings.test.tsx`: mudar o modo e sair abre a guarda, e "Descartar e sair" volta ao salvo. `LeaveGuard.test.tsx` continua verde. `create-character.spec.ts`: preencher, clicar em ‹ e ver "Sair sem salvar?" (QAW-11) | Jest + RNTL, Playwright |

**Suítes que precisam rodar** (comandos do CLAUDE.md):

- `@tms/sheet-core` e `@tms/db` (Bun): `npx pnpm test:packages`.
- `@tms/api` (Bun, PGLite). Inclui a matriz de AuthZ, porque `sheets/routes.ts` e `events.ts` mudam.
- Os `*.pg.test` (`cd apps/api && PG_TEST_URL=postgres://postgres:postgres@localhost:5432/tms_p03c_test bun test .pg.test`), com um banco `_test` próprio do worktree. Rodam o novo `idempotency.pg.test.ts` e os existentes: `members.pg.test.ts` ("duas criações da mesma pessoa no limite"), `backstage.pg.test.ts` (NPC) e `events.pg.test.ts`.
- `@tms/ui` e frontend (Jest): `npx pnpm test:ui`.
- Na integração da onda: E2E inteiro em Chromium e WebKit (os `journey-*.spec.ts` conferem "Salvo", o resumo e o conflito) e build nativo com o Maestro `02`, `04` e `09`.

## 5. Segurança

O P03-C passa por `/security-review` antes do merge. Foco: `draftStore.ts`, `SyncProvider.tsx`, `SheetScreen.tsx` (persistência), `sheets/routes.ts`, `chronicles/routes.ts`, `0021_user_commands.ts` e o 409 de `events.ts`.

| O que pode dar errado | Como o desenho evita |
|---|---|
| Rascunho em claro no aparelho | No app, o banco SQLCipher com a chave no Keychain/Keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, fora do backup). Com falha, fica em memória, nunca em claro no release. No web, o IndexedDB, sem cifra em repouso por projeto (§7.2), como o outbox e o cache, com escopo por usuário e apagado no logout. Nunca AsyncStorage nem localStorage. |
| Token ou credencial no rascunho | Lista fechada de campos (§3.2). O teste confere as chaves do JSON gravado. Tokens continuam no SecureStore e no cookie `httpOnly`. |
| Outro usuário do aparelho lê o rascunho | A chave é `u:<userId>:draft:<characterId>` (`scopeStorage`). O logout apaga o escopo (`OfflineProvider`, `lib/persist.tsx` l.283–291) e fecha o storage, o que impede gravação atrasada. O `sync.reset()` também limpa. |
| Disco adulterado vira escrita | O registro é input hostil (`parseDraftRecord`). Na recuperação, `applyBatch` confere caminho, permissão e `validateSheet` com os papéis de agora. O servidor revalida tudo no `/events` (AuthZ, política, conta da criação). |
| Rascunho sobrevive à perda de acesso | Prazo de 7 dias. Num 404 da ficha, o registro é apagado. Na recuperação, os caminhos que o papel não escreve saem. Ficha travada, arquivada ou de quem saiu só oferece "Descartar" (fail secure). |
| Conteúdo da ficha em log | O `draftStore` não loga valores (só o tipo do problema, como o `encryptedStorage`). O `describeValue` com texto é restrito à tela de conflito. O teste espiona o `console`. |
| Duplicar para burlar o limite de 20 | A repetição devolve a ficha existente antes da contagem. A chave nova conta sob a trava da crônica e do vínculo. A corrida é provada no `*.pg.test`. |
| Repetição alheia ou com outros dados | O resultado só sai com o mesmo autor e o mesmo hash. Fora disso, 409 sem id. A chave da crônica é por usuário, a da ficha por crônica e amarrada ao autor. |
| O 409 vaza dado oculto | Só caminhos que quem pediu escreve (o `forbidden` vem antes). O `current` passa por `stripRestricted`. `changedBy` só tem o papel relativo, sem id nem nome, e vira `null` quando o lote é de rolagem oculta para quem não narra (a regra do Histórico). O `viewer` recebe 404. |
| Corpo do 409 manipulado | O cliente aceita só caminhos do próprio lote e valores do enum. O valor atual vem da ficha rebuscada, não do corpo. |
| Logout involuntário (refresh 401/403) apaga o rascunho | É fail secure e intencional: `signOut` apaga tudo do usuário (`session.ts` l.157–164), como o outbox hoje. Registrado em §8.3. |
| Comando sem limpeza acumula dados | `user_commands` guarda só ids, hash e `{ id }`, sem o nome da crônica, e cai em cascata com a conta. A retenção fica como pergunta (§9). |

Checklist da organização:

- **Dado sensível só em armazenamento seguro:** SQLCipher e Keychain/Keystore no app; no web, IndexedDB com escopo e limpeza.
- **O logout limpa tokens e cache sensível:** o escopo inteiro, com o rascunho incluído.
- **Nada sensível em log ou console.**
- **Validação no servidor:** idempotência, limite, AuthZ e o 409 filtrado.
- **Fail secure:** sem chave ou sem SQLCipher, memória; recuperação revalidada; o 409 sem autor quando há dúvida.

## 6. Como generaliza além do WoD

- **Rascunho e recuperação.** São uma lista de `{ path, from, to }` por campo, o mesmo formato do evento (README §10). Não conhecem tipo nem sistema. No D&D 5e (`design/templates/dnd5e-2014.json`), o point-buy de 27 em rascunho se recupera igual. No Call of Cthulhu, as perícias em `percent` também.
- **Ordem e caminho do resumo.** Vêm das `sections` e `groups` do template (`fieldOrder`/`fieldPlace`), nunca de nome de campo: "Atributos › Força" no D&D, "Perícias › Esquivar" no CoC. O "de" efetivo vem de `withEffectiveFrom`, que resolve qualquer `default` com fórmula: no CoC, Esquivar começa em DES/2.
- **Conflito.** É por caminho, com `describeValue` por tipo. Nos aspectos de texto do Fate, a escolha mostra o texto dos dois lados.
- **Idempotência, guarda de saída e `Banner`.** São genéricos: valem para qualquer criação de ficha ou crônica e qualquer formulário. Nenhum arquivo do pacote cita Vampiro, Mago ou Lobisomem.

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar", l.67–73):

1. **Plano aprovado.** Arquivos e linhas conferidos (este documento). As decisões não se aplicam diretamente, e o §2 diz como o desenho preserva a D-01.
2. **Typecheck, lint e testes** dos pacotes afetados: `@tms/sheet-core`, `@tms/db`, `@tms/api` (com os `*.pg.test`), `@tms/ui` e frontend (§4). A migration segue o fluxo do CLAUDE.md, e o `@tms/sheet-core` e o `@tms/db` são reconstruídos antes do typecheck do app e da API (S-01).
3. **Um teste de regressão por bug** (§4), falhando no `1db3db9`.
4. **`/code-review` e `/security-review`** no diff do pacote. Os achados vão no resumo.
5. **O cenário de cada persona repetido sem o defeito:**

| Item | Nota | Cenário | Plataforma | Esperado agora |
|---|---|---|---|---|
| T-02 | QAW-08 | Preencher o nome e dar dois cliques rápidos em "Criar ficha" | web 390 | Um `POST`, uma "Isadora Vex QA Pontos" |
| T-02 | QAA-01 | Toque duplo (~80 ms) em "Criar crônica" e em "Criar ficha" | iOS | Uma crônica e uma ficha; o `api.log` sem dois 201 no mesmo segundo |
| T-03 | QAA-03 | Criação por pontos, mudar 8 pontos, matar o app, abrir | iOS | Oferta "8 alterações não salvas", "Recuperar" devolve as 8 |
| T-03 | IA-01 | Clã e atributos sem "Salvar", `simctl terminate`, reabrir a ficha | iOS | Clã e atributos recuperados, em Criação |
| T-03 | IA-03 | Escolher prioridade e pontos, fechar, reabrir | iOS | Prioridade salva (com "Prioridades salvas") e pontos recuperáveis |
| T-03 | EA-04 | ~26 alterações (atributos, habilidades, Dons, Antecedentes), forçar o fim do processo | Android | As ~26 recuperadas |
| T-03 | IW-01 | Prioridade, 3 traços, F5 aceitando o aviso do navegador | web 390 | Oferta "3 alterações"; o cabeçalho dizia "3 alterações não salvas" antes do F5 |
| T-12 | QAW-19, QAA-12 | Duas sessões editam o mesmo campo; a segunda salva | web 390, Android | Texto legível em cima, botões embaixo |
| T-17 | QAW-21, EW-05, IA-02, NW-31 | Mexer em traços em Criação/Editar (o narrador: "+" na FdV atual) | web 390 e 1280, iOS | "N alterações não salvas" no lugar de "Salvo" |
| T-17 | QAW-05 | Jogador abre a URL de ficha alheia | web 390 | Sem indicador |
| T-31 | QAW-20 | Narrador salva Senhor=Etrius; jogador com rascunho de 7 muda o Senhor e conclui | web 390 | Só o Senhor em conflito, "Etrius × Meerlinda, pelo narrador"; as outras 6 salvas; nada concluído com dado velho |
| T-31 | QAA-12 e nota das 15:51 | iOS e Android editam o Conceito; o narrador devolve e depois aprova | Android | "Seu valor × valor atual"; o formulário de devolução não reaparece |
| T-54 | QAA-30, POA-08, POW-19, IA-22, EA-18 | Aparência +1, FdV e Humanidade e "Salvar"/"Enviar para aprovação" | iOS, Android, web | "Aparência 1 → 2", "Força de Vontade permanente 5 → 7", grupos na ordem da ficha |
| T-54 | QAW-39, EW-23, EW-26, IW-23 | Salvar um rascunho grande com as duas "Consciência" | web 390 e 1280 | Agrupado por seção, com "Talentos › Consciência" e "Virtudes › Consciência" |
| T-56 | QAW-11, QAA-23 | Nova ficha preenchida, depois ‹, F5 ou Voltar do Android | web 390, Android | "Sair sem salvar?" (no F5, o aviso do navegador) |
| T-56 | QAW-10, NW-03 | Regras: Livre, ou Primária 7→4 e bônus 15→17, depois ‹ Crônicas | web 390 | "Sair sem salvar?" |
| T-78 | IA-27, IW-24 | Abrir "Salvar N alterações?" | iOS, web | "Descartar" como texto à esquerda, "Salvar" como principal à direita |

   O critério de saída da onda pede os cenários do QA para T-02 e T-03: QAW-08, QAA-01 e QAA-03, com o IW-01 cobrindo o web. Os cenários nativos dependem do build nativo da integração (D-00).
6. **Resumo para a seção do pacote no PR da onda:** o que mudou, como foi testado e os achados da revisão.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

| # | Commit | Itens | Esforço |
|---|---|---|---|
| 1 | `fix(api): ficha do jogador idempotente pela chave do comando` | T-02 | P |
| 2 | `feat(db,api): Nova crônica idempotente por usuário (user_commands)` | T-02 | M |
| 3 | `fix(app): chave por intenção e trava síncrona em Criar ficha e Criar crônica` | T-02 | P |
| 4 | `fix(ui): Banner passa as ações para baixo quando falta largura` | T-12 | P |
| 5 | `fix(core,app): resumo na ordem da ficha, com caminho e "de" efetivo; Descartar secundário` | T-54, T-78 | P |
| 6 | `feat(app): rascunho de Criação/Editar persistido por usuário e ficha, com Recuperar` | T-03 | M |
| 7 | `fix(app): indicador "N alterações não salvas" e confirmação da prioridade` | T-17 | P |
| 8 | `fix(api,app): conflito por campo, seu valor × atual e quem mudou` | T-31 | M |
| 9 | `fix(app): guarda de saída na Nova ficha e nas regras da crônica` | T-56 | P |
| 10 | `docs: rascunho persistido, idempotência e conflito por campo` (arquitetura §6.6, §7.1–§7.3; Maestro README) | — | P |

**Por que esta ordem:**

- A API do T-02 vem antes do app que a usa.
- O `Banner` (4) e a ordem do resumo (5) vêm antes do rascunho e do conflito, que os reaproveitam (a oferta e a faixa usam o `Banner`; a folha de conflito usa `fieldPlace`).
- O rascunho (6) vem antes do indicador (7) e do conflito (8), que usa `restoreDraft` e a origem `recovery`.
- O T-56 (9) fica por último porque mexe nos arquivos que o P01-C e o P06 também tocam, e faz o rebase menor.

### 8.2 Esforço

**G**: cerca de uma sprint, 10 commits (6 P, 3 M e o de docs). A matriz soma 6 P e 2 M. A diferença vem do que o código mostrou:

- a Nova crônica precisa de migration e de teste em Postgres real;
- o T-31 tem uma parte de API (`changedBy`) e a folha por campo;
- o T-03 tem a oferta, a revalidação e o fluxo nativo.

Se a onda precisar cortar, o commit 8 é o único que pode ir sozinho para um PR seguinte sem quebrar os outros. Sem ele, o conflito continua como hoje (o lote inteiro culpado, "Reaplicar" às cegas), só que legível pelo commit 4.

### 8.3 Riscos

- **Header estreito.** "N alterações não salvas" é mais longo que "Salvo", e o cabeçalho em 390 px já transborda (QAW-18, T-11 no P08, onda 2). Até o P08, o texto pode quebrar. Conferir no E2E a 390 px; se for preciso, encurtar só o texto visível e manter o rótulo acessível completo.
- **Duas abas no web** com a mesma ficha em edição: a última gravação do registro vence. O rascunho em memória de cada aba continua íntegro. Raro; fica registrado.
- **Logout involuntário** (refresh recusado) apaga o rascunho, como apaga o outbox: é a regra de fail secure. O aviso de pendências do P02 só cobre o "Sair" voluntário.
- **App antigo nas lojas.** Sem a chave, a ficha do jogador continua não idempotente até o app atualizar (a compatibilidade é proposital).
- **Asserções de E2E e Maestro com "Salvo"** em Criação/Editar com rascunho passam a ver "N alterações não salvas". Revisar os `journey-*.spec.ts`; o Maestro `02` e o `04` usam o Jogo, sem rascunho, e não mudam.
- **`@tms/sheet-core` muda** (`order.ts`, `describeValue`): o Metro e a API usam o `dist`. Reconstruir antes de testar o app (S-01 do P01-C).
- **A ordem do lote muda** (ordem da ficha em vez da ordem do `jsonb`): o `sheetStore.test.ts` "na ordem do template" (l.319) muda junto. O servidor não depende da ordem.

### 8.4 Conflitos com os pacotes da onda

| Arquivo | Pacotes | Onde cada um mexe | Como resolver |
|---|---|---|---|
| `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx` | P01-C, P03-C | P01-C: L-02 (l.50–56, "Atualize o app") e L-03 (l.88–95, depois de criar). P03-C: l.34–36, l.78–98 (chave, trava, `created`) e a guarda | **Alto.** P01-C entra antes, e o P03-C faz rebase. O `created.current = true` do T-56 e o tratamento de erro do L-03 ficam no mesmo `onSuccess`: combinar no rebase |
| `apps/frontend/app/__tests__/new-character.test.tsx` | P01-C, P03-C | Casos novos dos dois | Casos em blocos `describe` separados |
| `apps/frontend/components/chronicles/CreationSettings.tsx` e `__tests__/CreationSettings.test.tsx` | P01-C, P03-C | P01-C: l.110–115 (L-01). P03-C: import e três linhas em l.89. O P06 não edita o arquivo (consolidação, [onda-1.md](onda-1.md)): o título vem de dentro do `Choice` | **Médio.** Ordem: P01-C, depois P03-C. O commit 9 é o último do P03-C |
| `apps/frontend/sheet/CharacterForm.tsx` | P06 (T-38, provável), P03-C | P06: corretor no nome (pode cair no editor de texto). P03-C: prop `onDirtyChange` (l.24, l.102–105) | Baixo |
| `apps/frontend/sheet/SheetScreen.tsx` | P06 (T-42), P03-C | P06: `NpcVisibilityBar` (~l.420–470). P03-C: cabeçalho (l.163–170) e `LiveSheet` (l.259–365) | Baixo: regiões diferentes |
| `packages/db/src/migrations.ts`, `packages/db/src/types.ts`, `packages/db/src/__tests__/migrations.test.ts` | P02 (T-47, se virar migration), P03-C | As duas querem `0021_…` | Quem entra primeiro fica com `0021`; o outro renomeia para `0022` e roda de novo `db:codegen` e o build do `@tms/db` |
| Logout: `lib/session/session.ts`, `sheet/sync/storage.web.ts`, tela "Sair" | P02 (T-14) | P03-C não muda esses arquivos | **Ponto de extensão:** o rascunho mora no `UserStorage` e sai com o `userStorage.clear()` do `onSignOut` (`lib/persist.tsx` l.283–291) e com o `sync.reset()`. O P02 precisa manter esse `clear` (ou apagar o banco inteiro). O aviso "alterações pendentes" do T-14 deve somar os rascunhos com `useLocalChanges()` (`{ pending, drafts }`), e quem entrar por último liga os dois |
| `apps/frontend/sheet/sync/sync.ts`, `SyncProvider.tsx` | P02 (possível, para o aviso de logout), P03-C | P03-C: `drafts`, `reset`, `enqueue` com Promise, 409 | Baixo. Se o P02 tocar no `reset()`, o rebase mantém o `drafts.clear()` |
| `packages/ui` | P06, P03-C | P06: `Choice`, `Stepper`, `Tabs`, `ListItem`, `BottomSheet`, tokens e `components.test.tsx`. P03-C: só `Banner.tsx` e o novo `Banner.test.tsx` | Nenhum arquivo em comum. As mudanças do `BottomSheet` (T-35 foco, T-71 fundo fora da árvore) alcançam as folhas novas do P03-C: os testes buscam pelo título e pelo "×", não pelo fundo |
| `e2e/tests/offline.spec.ts` | P02 (T-14) | — | O P03-C põe o teste de logout do rascunho no `draft.spec.ts` novo, não no `offline.spec.ts` |
| `e2e/tests/chronicles.spec.ts`, `app/__tests__/chronicles.test.tsx` | P06 (o título "Sistema" pode mudar seletores), P03-C | Casos novos de duplo clique | Baixo |

Depois da onda: o P03-D (D-01) e o P04-D mexem no `ModeBar` e no `LeaveGuard`, por cima do que o P03-C deixa. O P04-C (T-05, abrir em Criação por qualquer entrada) passa pela oferta de recuperação. O P08 (T-11) mexe no cabeçalho do `SheetScreen`.

### 8.5 Arquivos tocados

| Arquivo | Itens | Tipo de mudança |
|---|---|---|
| `apps/api/src/sheets/routes.ts` | T-02 | alterado (chave também na ficha do jogador) |
| `apps/api/src/chronicles/routes.ts` | T-02 | alterado (chave, trava do usuário, `user_commands`) |
| `apps/api/src/sheets/events.ts` | T-31 | alterado (`changedBy` no 409) |
| `packages/db/src/migrations/0021_user_commands.ts` | T-02 | novo |
| `packages/db/src/migrations.ts` | T-02 | alterado (registro da 0021) |
| `packages/db/src/types.ts` | T-02 | gerado (`db:codegen`) |
| `packages/sheet-core/src/order.ts` | T-54, T-31 | novo (`fieldOrder`, `fieldPlace`) |
| `packages/sheet-core/src/labels.ts` | T-31 | alterado (`describeValue`) |
| `packages/sheet-core/src/index.ts` | T-54, T-31 | alterado (exports) |
| `packages/ui/src/Banner.tsx` | T-12 | alterado (quebra para coluna) |
| `apps/frontend/lib/commandKey.ts` | T-02 | novo (`useCommandKey` movido) |
| `apps/frontend/lib/queries/creation.ts` | T-02 | alterado (importa `useCommandKey`) |
| `apps/frontend/lib/queries/chronicles.ts` | T-02 | alterado (chave nos dois hooks de criação) |
| `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx` | T-02, T-56 | alterado |
| `apps/frontend/app/(app)/chronicles/new.tsx` | T-02 | alterado (trava por `ref`) |
| `apps/frontend/sheet/CharacterForm.tsx` | T-56 | alterado (`onDirtyChange`) |
| `apps/frontend/sheet/sync/draftStore.ts` | T-03 | novo |
| `apps/frontend/sheet/sync/SyncProvider.tsx` | T-03 | alterado (`drafts`, `useLocalChanges`) |
| `apps/frontend/sheet/sync/sync.ts` | T-03, T-31 | alterado (`reset`, `enqueue` com Promise, corpo do 409) |
| `apps/frontend/sheet/sync/persistedOutbox.ts` | T-03, T-31 | alterado (guarda `draft`) |
| `apps/frontend/sheet/sync/SyncIndicator.tsx` | T-17 | alterado (estado `unsaved`) |
| `apps/frontend/sheet/store/sheetStore.ts` | T-03, T-31, T-54 | alterado (`restoreDraft`, `draftExit`, conflito por campo, ordem) |
| `apps/frontend/sheet/SheetScreen.tsx` | T-03, T-17 | alterado (persistência no `LiveSheet`, indicador) |
| `apps/frontend/sheet/DraftRecovery.tsx` | T-03 | novo |
| `apps/frontend/sheet/ConflictBanner.tsx` | T-31 | alterado |
| `apps/frontend/sheet/ConflictSheet.tsx` | T-31 | novo |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | T-31 | alterado (zera o formulário de devolução) |
| `apps/frontend/sheet/creation/usePriorityChoice.ts` | T-17 | alterado ("Prioridades salvas") |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | T-54, T-78 | alterado (`review` e `SummarySheet`) |
| `apps/frontend/sheet/evolve/LeaveGuard.tsx` | T-56 | alterado (usa o componente genérico) |
| `apps/frontend/components/UnsavedChangesGuard.tsx` | T-56 | novo |
| `apps/frontend/components/chronicles/CreationSettings.tsx` | T-56 | alterado (guarda) |
| `apps/api/src/__tests__/characters.test.ts` | T-02 | teste alterado |
| `apps/api/src/__tests__/chronicles.test.ts` | T-02 | teste alterado |
| `apps/api/src/__tests__/events.test.ts` | T-31 | teste alterado |
| `apps/api/src/__tests__/idempotency.pg.test.ts` | T-02 | teste novo |
| `packages/db/src/__tests__/migrations.test.ts` | T-02 | teste alterado |
| `packages/sheet-core/src/__tests__/order.test.ts` | T-54 | teste novo |
| `packages/ui/src/Banner.test.tsx` | T-12 | teste novo |
| `apps/frontend/app/__tests__/new-character.test.tsx` | T-02, T-56 | teste alterado |
| `apps/frontend/app/__tests__/chronicles.test.tsx` | T-02 | teste alterado |
| `apps/frontend/components/chronicles/__tests__/CreationSettings.test.tsx` | T-56 | teste alterado |
| `apps/frontend/sheet/sync/__tests__/draftStore.test.ts` | T-03 | teste novo |
| `apps/frontend/sheet/sync/__tests__/sync.test.ts` | T-03, T-31 | teste alterado |
| `apps/frontend/sheet/sync/__tests__/persistedOutbox.test.ts` | T-03 | teste alterado |
| `apps/frontend/sheet/sync/__tests__/SyncIndicator.test.tsx` | T-17 | teste alterado |
| `apps/frontend/sheet/store/__tests__/sheetStore.test.ts` | T-03, T-31, T-54 | teste alterado |
| `apps/frontend/sheet/__tests__/LiveSheet.test.tsx` | T-03 | teste alterado |
| `apps/frontend/sheet/__tests__/SheetScreen.test.tsx` | T-17 | teste alterado |
| `apps/frontend/sheet/__tests__/ConflictSheet.test.tsx` | T-31 | teste novo |
| `apps/frontend/sheet/creation/__tests__/CreationScreen.test.tsx` | T-31 | teste alterado |
| `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx` | T-54, T-78 | teste alterado |
| `apps/frontend/sheet/evolve/__tests__/LeaveGuard.test.tsx` | T-56 | teste alterado (se preciso) |
| `e2e/tests/create-character.spec.ts` | T-02, T-56 | E2E alterado |
| `e2e/tests/chronicles.spec.ts` | T-02 | E2E alterado |
| `e2e/tests/draft.spec.ts` | T-03, T-17, T-54, T-78 | E2E novo |
| `e2e/tests/conflict.spec.ts` | T-31, T-12 | E2E novo |
| `apps/frontend/.maestro/09-draft-recovery.yaml` | T-03 | fluxo nativo novo |
| `apps/frontend/.maestro/README.md` | T-03 | doc (linha do fluxo 09) |
| `doc/arquitetura-motor-de-ficha.md` | T-02, T-03, T-31 | doc (§6.6 conflito por campo; §7.1–§7.3 rascunho persistido) |

## 9. Perguntas abertas (técnicas)

1. **Ordem do `jsonb` na raiz.** O P03-C ordena por `fieldOrder` só no rascunho e no resumo. `diffToBatch` (`packages/sheet-core/src/events.ts` l.181), `inactiveChanges` (`labels.ts` l.200) e outros laços sobre `model.fields` continuam na ordem do `jsonb`. Corrigir no `compileTemplate` (o `model.fields` na ordem das seções) ou guardar o template como `json`? Afeta core, API e testes; candidato ao P10-C ("Template: ordem").
2. **Endpoint atômico para "um modelo só".** Escolhas da criação e eventos avaliados juntos, sob a mesma trava (por exemplo, `creationChoices` + `creationRevision` opcionais no `/events`). É o que permite a prioridade entrar no rascunho sem travar nas duas ordens (§2, item 1). Cabe num pacote próprio, com revisão do plano-v4.
3. **Chave obrigatória na ficha do jogador.** Exigir a chave em `POST /chronicles/:id/characters` e `POST /chronicles` quando o app antigo sair das lojas? Hoje é opcional por compatibilidade.
4. **Retenção das tabelas de comando.** `chronicle_commands`, `character_commands` e agora `user_commands` crescem sem limpeza. Vale um job com prazo (por exemplo, 30 dias)?
5. **`changedBy` no 409.** O papel relativo, com `null` em rolagem oculta, passa no `/security-review`? Se não passar, a tela mostra "em outro lugar" e a API não muda (o resto do T-31 é só do cliente).
6. **Prazo do rascunho.** 7 dias, igual ao cache e ao último usuário: está bom para quem monta a ficha ao longo de semanas?
7. **Cifra no web.** Manter a paridade com o outbox e o cache (IndexedDB sem cifra, apagado no logout) ou cifrar com WebCrypto? A chave ficaria na mesma origem, e o ganho contra XSS é pequeno.
8. **Valor de texto na folha de conflito.** O `describeValue` mostra o texto só ali. Confirmar na revisão que isso respeita o README §10/§11, que proíbe conteúdo em aviso, histórico e log, não na tela de decisão.
9. **Rodar o Maestro `09`.** Precisa de dev build e conta de homologação (README do Maestro). Ele roda na integração da onda, junto do build nativo da D-00, ou fica no roteiro manual antes do release?
