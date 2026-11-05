# P16-D · Revelar a nota do narrador ao jogador: plano de implementação

> Plano · 2026-11-05 · base conferida: `onda/5-narrador-entrada-uso` em `05c5d7d`

Este plano implementa o pacote [P16-D da matriz de achados](../testes/2026-11-01/matriz-achados.md#p16-d), da onda 5, que aplica a decisão D-17. Ao fim do pacote:

- o narrador da crônica pode revelar as Notas do Narrador de uma ficha de jogador ao dono dela, com uma confirmação que mostra o texto, e pode deixá-las privadas de novo;
- o dono passa a ler as notas reveladas na aba "Sobre", só em leitura, enquanto o narrador não as esconder;
- revelar e esconder ficam no Histórico da ficha (dono e narrador) e no registro dos Bastidores (narrador);
- o texto revelado nunca vai para o disco do aparelho do jogador: quando a nota volta a ser privada, a próxima rebusca o tira da memória, e nada fica no cache persistido.

É um pacote de decisão de produto, e a própria D-17 o adia: "fica para depois da onda 4, quando houver a necessidade". **Se ele entra nesta onda é o ponto 1 para o PO (§9).** O plano é escrito de qualquer jeito, para a decisão ter o custo à vista.

O pacote não remove campo, não muda regra do jogo e não afrouxa limite:

- **as Notas do Narrador continuam privadas por padrão.** Toda ficha nasce e continua com as notas privadas, e nenhuma nota sai sem a ação do narrador daquela crônica;
- o dono nunca escreve nas notas, reveladas ou não; o `canWrite` não muda;
- o NPC não entra: as notas dele continuam fora de toda projeção, e o `viewer` nunca recebe nota;
- **o servidor continua a autoridade.** O estado novo é gravado e conferido na API, com o papel resolvido no banco. O app só mostra o que o servidor mandou.

**Nenhum template muda** no desenho recomendado (§3.9). O pacote não entra no commit de versão do P15-D, salvo se o time escolher a alternativa com chave no template (§3.11 e §9, pergunta 1).

Todas as linhas citadas são do `05c5d7d`. A matriz cita o `1db3db9`; para esta linha ela não dá número de linha, e a §3.0 diz onde a causa provável está incompleta.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md): legenda, "Ondas e pacotes", "Decisões de produto" (D-16, D-17), "Como executar" (com "Decisão revista" e "Ondas empilhadas"), "Onda 5", §P15-D e §P16-D | Item U-11, decisão, pré-requisito (P15-D), "PR local" (o `/security-review` é obrigatório no P16-D, passo 4) |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §2 (linha 14, "Narrador devolve para correção"), §3 (l.149) e §4 (l.223) | O narrador usou as Notas do Narrador como canal para o jogador, sem saber que eram privadas |
| Notas: [narrador-web](../testes/2026-11-01/notas/narrador-web.md) (NW-25, l.183-191, l.250), [narrador-app](../testes/2026-11-01/notas/narrador-app.md) (NA-17, l.172-180, l.224, l.248, l.268), [po-web](../testes/2026-11-01/notas/po-web.md) (l.78, l.214, l.249), [po-app](../testes/2026-11-01/notas/po-app.md) (l.97-98) | O pedido de "Recado para o jogador" (NA-17), resolvido pelo R-09 e pela D-04; a sentinela nas notas do NPC, que não vaza |
| U-10 e U-11 na matriz (feedback do narrador de 03/11/2026, Android, fora dos relatórios) | A origem do pedido: o prelúdio nas Notas do Narrador, que o P15-D leva para um campo próprio |
| [plano-v0.md](../plano-v0.md) §1.8 (l.32), l.556, l.663 e l.784; [plano-v5.md](../plano-v5.md) l.80 e Etapa 3 (l.266-288); [validacao-v5.md](../validacao-v5.md) l.167-169 | "O aparelho do jogador nunca recebe" as notas; a redução de acesso do NPC e o limite do "cache já visto" |
| [design/templates/README.md](../../design/templates/README.md) "Permissões por seção" (l.359-370) e "Notas do narrador" (l.628-631); [arquitetura-motor-de-ficha.md](../arquitetura-motor-de-ficha.md) l.562 | O contrato que este pacote estende sem chave nova |
| [P09-C](P09-C-narrador-mesa.md) §3.1 (R-09) e [P04-D](P04-D-estado-proximo-passo.md) §3.1, §3.9 e §5 | O rótulo "privadas: o jogador não vê", o "Pedir ajuste" como canal de recado e o padrão de ação do narrador validada no servidor |
| [P11](P11-bastidores-npc.md) §3.3, §3.6, §3.9 e §5 | A revelação do NPC: confirmar antes de revelar, descer sem folha, revisão, chave de comando, registro e o toast depois da folha |
| [P03-C](P03-C-rascunho-salvamento.md) e [P02](P02-seguranca-sessao-api.md) (T-13, T-14) | O cache persistido por usuário, o logout que limpa tudo e o `cache-control: no-store` |
| [P10-D](P10-D-ajuda-contextual-mago.md) §3.0 e §3.10; [onda-4.md](onda-4.md) §4.7, §6 (pontos 3 e 9), §8 e §11 | O que o app antigo aceita no template, a versão por onda e as fichas presas à versão em que nasceram |
| [onda-1.md](onda-1.md) a [onda-4.md](onda-4.md) §6 | Os pontos para o PO das ondas anteriores, que seguem em aberto |

## 1. Objetivo e itens

**Objetivo (matriz).** O narrador pode mostrar uma Nota do Narrador ao jogador no momento certo, sem expor as notas por padrão.

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| U-11 | baixa | O narrador não consegue mostrar uma Nota do Narrador ao jogador no momento certo: a nota é sempre privada, e o R-09 só ajustou o rótulo | A nota é **um texto só por ficha**: o campo `storytellerNotes` (`longText`, até 4000) na seção `storyteller` com `permissions: { read: ["storyteller"], write: ["storyteller"] }` (`vtm-v20.json:762-766` e `:934-940`; `wta-w20.json:1008-1012` e `:1213-1220`; `mta-m20.json:770-774` e `:994-1001`). O `canRead` só olha o modelo e os papéis (`packages/sheet-core/src/permissions.ts:42-52`), sem estado por ficha. O servidor tira o campo de toda saída pelo `stripRestricted` (`permissions.ts:74-89`; `sheets/routes.ts:393`, `:519`, `:562`; `sheets/events.ts:251`, `:286`, `:420`, `:603`; `rolls/routes.ts:319`, `:416`; `chronicles/table.ts:148`). Na tela, o narrador só edita (`sheet/storyteller/StorytellerBar.tsx:95-111`, `:127-189`) |

## 2. Decisões aplicadas

**D-17 (U-11): "Fica para depois da onda 4: o narrador revelar uma nota privada ao jogador, ficha a ficha, só entra quando houver a necessidade (o prelúdio já está coberto pelo D-16)."**

**A necessidade apareceu?** Não como pedido novo:

- o único pedido de "mostrar a nota" é o do narrador em 03/11 (U-10), e era o prelúdio. A D-16 o resolve com o campo "História / Prelúdio" do P15-D;
- o "Recado para o jogador" do NA-17 (`narrador-app.md:268`) e do NW-25 foi resolvido por outro caminho: o rótulo "privadas" (R-09, P09-C) e o "Pedir ajuste" com motivo (D-04, P04-D). O `ADJUST_HINT` já aponta para ele (`sheet/storyteller/privacy.ts:17-19`);
- nenhuma nota dos relatórios pede a revelação no meio da campanha.

**Há um caso que o P15-D não cobre e o P16-D cobre.** O prelúdio do U-10 está numa ficha que já existe (o Magnus, no M20). A ficha guarda a versão do template em que nasceu (`sheets/routes.ts:278`, `models.ts`), e não há caminho de atualização de versão de ficha ([onda-4.md](onda-4.md) §6, ponto 9). O campo "História / Prelúdio" só chega às fichas novas. O P16-D não depende de template: a revelação vale para toda ficha de jogador, em qualquer versão (§3.1). Para o narrador do U-10, ele é a saída para a ficha antiga, sem criar a atualização de versão. Mas a nota vai inteira: antes de revelar, o narrador tira dela os segredos à mão (§3.6).

O plano deixa a decisão ao PO (§9, ponto 1), com a recomendação.

**Como o código acomoda a D-17:**

- **Ficha a ficha:** o estado fica na linha da ficha (`characters`), por seção revelada (§3.2).
- **"Revelar ao jogador":** só o dono da ficha passa a ler. O outro jogador, o `viewer`, o ex-membro e o narrador de outra crônica continuam sem nada (§3.4, §5).
- **"Uma nota privada":** hoje a nota é um texto só por ficha (§1). Revelar é revelar o campo inteiro. Uma lista de notas com revelação por item seria um tipo de campo novo no contrato (§9, ponto 3).
- **Privada até a revelação:** o servidor não entrega o texto ao dono antes da revelação nem depois de esconder. Nenhum caminho de hoje muda: a ficha, a Mesa, o lote, a rolagem e o Histórico continuam sem a nota para o dono, mesmo revelada (§3.4).

**Onde a D-17 e a recomendação da matriz não se aplicam como estão escritas (apontado, não decidido):**

- **"Revelar o texto de agora ou o futuro"** (a recomendação deixa ao plano). Proposta: a revelação é viva. O dono lê o texto atual e o que o narrador salvar enquanto ela durar, e o editor do narrador diz isso (§3.6). A alternativa, um retrato do texto no momento da revelação, cria uma segunda cópia de texto privado para guardar e apagar (§3.11). Ponto 2 para o PO.
- **"Ocultar de novo"** entra: o narrador esconde com um toque, como o NPC desce de visibilidade sem folha (P11 §3.3). O texto diz que quem já leu continua sabendo.

**Fica fora:**

- o campo "História / Prelúdio" é do P15-D (D-16). O P16-D não copia nada das Notas para ele, nem o contrário;
- aviso ao jogador de que há nota revelada (selo, push): o Histórico e o bloco na aba "Sobre" bastam nesta onda. O push fica para depois, como na D-03 (§9, ponto 5);
- revelar nota de NPC: o NPC tem a própria visibilidade (P11), e a projeção `full` do `viewer` continua sem notas (`RevealNpcSheet.tsx:47-50`);
- revelar em grupo, pela Mesa: não, ficha a ficha;
- os pontos para o PO das ondas 1 a 4 continuam em aberto e não são tratados aqui.

## 3. Desenho por item

### 3.0 O que o código, o template e as plataformas fazem hoje

- **A nota é um campo de texto numa seção restrita.** O contrato não tem "nota" como lista: `storytellerNotes` é um `longText` de 4000 (§1). As permissões são por seção (`schema.json:1626-1645`), com os papéis da lista fechada `owner`, `storyteller` e `viewer` (`schema.json:366-369`). Nos seis templates do repositório, a seção restrita é sempre uma só, com um campo só: "Narrador" no V20, no W20, no M20 e no Fate, "Mestre" no D&D e "Guardião" no CoC (`coc7e.json:510-513`, `dnd5e-2014.json:656-659`, `fate-core.json:318-321`).
- **O `canRead` não tem estado por ficha** (`permissions.ts:31-52`). Ele recebe o modelo e os papéis e decide por seção, com a seção mais restrita vencendo. O `canWrite` exige `canRead` antes (`:61`).
- **O servidor tira a nota de toda saída.** As saídas que levam `sheet` passam pelo `stripRestricted` com os papéis do banco (§1). O Histórico também esconde o rótulo do campo que o dono não lê (`events.ts:599-605`) e já entra sem conteúdo para texto (`events.ts:104-106`).
- **O papel na ficha vem do banco** (`apps/api/src/authz.ts:72-129`): dono e narrador no PC; `viewer` só em NPC revelado a membro atual. O ex-membro continua dono da própria ficha (`former`, `authz.ts:15-18`), e o `GET /characters/:id` lhe dá a projeção completa com `member: false` (`sheets/routes.ts:527-529`).
- **A revelação do NPC é o padrão a copiar** (`sheets/routes.ts:570-666`): trava da linha (`lockCharacter`, `sheets/policy.ts:55-99`), `storyteller_id` conferido na transação, 404 para quem não tem vínculo e 403 `STORYTELLER_REQUIRED` para o dono, chave de comando em `chronicle_commands`, revisão (`visibility_revision`, `0019_backstage.ts:11-19`) com 409 `REVISION_CONFLICT`, e o registro `character.visibility` (`audit.ts:36`). Os Bastidores mostram o registro por lista branca (`chronicles/auditView.ts:51-93`; `components/chronicles/auditPhrase.ts:94-102`).
- **O cache do aparelho.** O `OfflineProvider` grava no disco só o template de uma versão e a ficha, pela chave `['characters', id]` de dois elementos (`apps/frontend/lib/persist.tsx:63-73`, `:210-214`). No nativo, o disco é o SQLCipher; no web, o IndexedDB `tms-offline`, sem cifra (`sheet/sync/kv.ts:1-4`, `storage.web.ts:7`). O cache vale 7 dias (`persist.tsx:44`), é invalidado sem rebusca ao restaurar (`:270-273`) e sai inteiro no logout (`:285-292`; `lib/session/SessionProvider.tsx:33`). Uma chave de três elementos, como o Histórico (`['characters', id, 'history']`, `lib/queries/history.ts:9-11`), **nunca vai ao disco**. A API manda `cache-control: no-store` em toda resposta (`apps/api/src/http/security.ts:17`), então nem o cache HTTP do navegador, do iOS ou do Android guarda o corpo.
- **A rebusca.** A ficha rebusca ao voltar para ela (`SheetScreen.tsx:128-133`, com o `focusManager` do `app/_layout.tsx:35`), e o padrão de `staleTime` é 30 s (`lib/queryClient.ts:32`). O 404 tira a ficha do cache e o rascunho dela (`SheetScreen.tsx:134-139`). Sem tempo real.
- **O app nativo antigo** desenha as seções pelo `canReadSection` com os papéis (`SectionView.tsx:39`, `SheetView.tsx:123-131`). Ele não conhece revelação nenhuma.

**Causas da matriz corrigidas ou completadas:**

- **"`packages/sheet-core/src` (`canRead` por papel)".** O `canRead` é só por papel e por modelo. A revelação é estado por ficha, então precisa de um parâmetro novo e de uma regra de "seção revelável" (§3.1). Ela não pode virar papel novo: um papel na lista fechada mudaria o contrato do template e o `viewer` (§3.11).
- **"`apps/api/src/sheets/routes.ts`".** Certo para a leitura da ficha, mas o estado novo pede uma migration de schema (colunas na `characters`, §3.2), que a matriz não cita, e duas rotas novas, que este plano põe num módulo próprio (`sheets/reveal.ts`, §3.3 e §3.4).
- **"`StorytellerBar.tsx`".** A barra do narrador é só um dos lugares. A ação vai junto do bloco das notas na aba "Sobre" (§3.6), porque a barra só mostra "Editar como narrador" quando a política deixa escrever, e revelar não é escrita na ficha. Entram também o `TextLayout`, o `SectionView`, o `SheetScreen`, o `HistorySheet`, o `auditPhrase` e o cache (§3.7, §3.8).
- **"Plataforma: —".** O código é o mesmo nas três plataformas. O que muda por plataforma é o disco do cache (§3.8), conferido na §11.

### 3.1 U-11 · A regra no `@tms/sheet-core`: que seção pode ser revelada (o que muda no `canRead`)

**Seção revelável.** Uma função pura nova, `revealableSections(model): readonly string[]`, devolve as seções que o narrador pode revelar ao dono. A regra só lê as permissões do template:

- `permissions.read` existe, inclui `storyteller` e não inclui `owner` nem `viewer`;
- a seção tem ao menos um campo, e todos são `text` ou `longText`;
- nenhum campo dela está também numa seção que não seja revelável nem legível pelo dono.

Nos seis templates, a regra dá a seção do narrador e nenhuma outra. Um teste fixa isso por template (§4.1). O campo restrito não pode estar na `identity` nem no `dock` (`validate/template.ts:955-963` e `:1043-1044`; README l.367), então a revelação nunca chega ao cabeçalho, à Mesa nem ao dock.

**O parâmetro novo, opcional e fail secure:**

```ts
canReadSection(model, sectionId, roles, revealed?: Iterable<string>)
canRead(model, fieldId, roles, revealed?: Iterable<string>)
stripRestricted(model, sheet, roles, revealed?: Iterable<string>)
```

- Sem `revealed`, ou vazio, tudo é como hoje. Os chamadores de hoje, no servidor e no app, não mudam e continuam sem a nota para o dono.
- Com `revealed`, a seção passa a ser legível **só para quem tem `owner`**, e só se estiver na lista **e** em `revealableSections`. Um id desconhecido, uma seção que o template não marca como restrita, o `viewer` e o `storyteller` sem `owner` não ganham nada.
- **O `canWrite` não recebe o parâmetro** e continua chamando o `canRead` sem ele (`permissions.ts:61`). O dono nunca escreve na nota revelada, e o `applyBatch` do servidor continua recusando (`packages/sheet-core/src/events.ts:131`).

**Quem passa `revealed`:** só a rota de leitura nova do servidor (§3.4) e o desenho da aba "Sobre" no app (§3.7). Nenhuma outra saída passa, de propósito (§3.11).

**O que muda na API pública do `@tms/sheet-core`:** `revealableSections` exportada pelo `index.ts`; o quarto parâmetro opcional nas três funções. É aditivo: o app antigo e o servidor de hoje compilam sem mudança.

### 3.2 U-11 · O estado na ficha (migration de schema `0025`)

Migration nova `packages/db/src/migrations/0025_character_reveal.ts`, com `down`:

```ts
// U-11 (P16-D): as seções restritas que o narrador revelou ao dono
alter table characters
  add column revealed_sections text[] not null default '{}',
  add column reveal_revision integer not null default 0,
  add constraint characters_reveal_pc check (kind = 'pc' or cardinality(revealed_sections) = 0),
  add constraint characters_reveal_limit check (cardinality(revealed_sections) <= 8)
```

- **Genérica:** guarda ids de seção do template, não "notas do Vampiro". Um sistema novo não precisa de migration.
- **Privada por padrão:** toda ficha existente e toda ficha nova começam com `'{}'`.
- **NPC nunca:** a constraint recusa a revelação em NPC também no banco (defesa em profundidade, além da rota).
- **O número.** O P15-D usa a `0024` (só dados, templates). O P16-D vem depois dele e fica com a `0025`. Se outro pacote da onda criar migration (o P12, para o rótulo do convite do T-45, por exemplo), o número é acertado na integração, pela ordem de merge (§8.4).
- Registro em `packages/db/src/migrations.ts` (a lista explícita, `:24` e `:54` para a `0023`), depois da `0024` do P15-D. Depois: `npx pnpm db:codegen` (`packages/db/src/types.ts`) e `doc/database.dbml` (as duas colunas). O `lockCharacter` passa a ler as duas colunas (`sheets/policy.ts:78-94`).

### 3.3 U-11 · Revelar e esconder: a rota do narrador

`POST /characters/:id/reveal`, num módulo novo `apps/api/src/sheets/reveal.ts`, registrado no `createApp` ao lado do `sheetRoutes` (`apps/api/src/index.ts:81`):

```ts
body: t.Object({
  clientCommandId: t.String({ format: 'uuid' }),
  section: t.String({ minLength: 1, maxLength: 64, pattern: '^[a-zA-Z][a-zA-Z0-9-]*$' }),
  revealed: t.Boolean(),
  revision: t.Integer({ minimum: 0 }),
})
```

Na transação, na ordem da rota de visibilidade (`sheets/routes.ts:575-653`):

1. `lockCharacter` (trava compartilhada da crônica, depois a da ficha; serializa com a transferência de narração).
2. `chronicles.storyteller_id` lido na transação. Quem não narra:
   - NPC, ou PC de outra pessoa: **404**, igual a "não existe";
   - o dono do PC: **403** `STORYTELLER_REQUIRED` ("Só o narrador pode fazer isso."), como hoje na visibilidade.
3. NPC ou a ficha do próprio narrador: **422** `REVEAL_UNAVAILABLE` ("Esta ficha não tem notas para revelar ao jogador."). O NPC usa a visibilidade; na própria ficha o narrador já lê.
4. `section` fora de `revealableSections` do modelo da **versão da ficha**: **422** `REVEAL_UNAVAILABLE`. O id nunca entra no SQL fora de parâmetro.
5. Chave de comando: a mesma de `chronicle_commands`, tipo `character.reveal`, com o hash do pedido. Reenvio igual devolve o resultado com `duplicate: true`; outro corpo com a mesma chave, 409 `IDEMPOTENCY_CONFLICT`.
6. `reveal_revision` diferente de `revision`: **409** `REVISION_CONFLICT`, com a revisão atual.
7. Pedido que não muda nada (revelar o que já está revelado): 200 com o estado atual, sem subir a revisão e sem registro.
8. Grava `revealed_sections` (com ou sem a seção) e `reveal_revision + 1`. **Não toca** `sheet_data`, `sheet_version` nem `updated_at` da ficha: revelar não é edição da ficha, não gera lote e não entra no 409 de quem edita.
9. Registro na mesma transação: `character.section.reveal` ou `character.section.hide`, com `payload: { section }`. Só o id da seção, nunca texto.

Resposta: `{ section, revealed, sections, revision, duplicate }`.

- **Em qualquer estado da ficha:** em criação, aguardando, ativa, travada, arquivada ou morta. Revelar é leitura do dono, não escrita na ficha, e não passa pelo `writePolicy`.
- **Sem fila offline:** o app só envia com rede, como a visibilidade. O comando nunca entra no outbox dos lotes.
- **Sem limite novo:** só o narrador da crônica chega ao passo 8, e o comando é idempotente.

### 3.4 U-11 · A leitura do dono: rota própria, fora da ficha

**O estado vai com a ficha; o texto, não.** O `GET /characters/:id` passa a mandar, na projeção completa do dono e do narrador (`sheets/routes.ts:530-569`):

```ts
reveal: { sections: string[], revision: number }
```

- Só ids de seção e a revisão, nunca texto. Isso pode ir ao disco do aparelho com a ficha.
- `sections` é a interseção de `revealed_sections` com `revealableSections` do modelo da ficha.
- **Ex-membro** (`member: false`): `sections: []`. Ele continua lendo a própria ficha como hoje, sem a nota (§9, ponto 4).
- O envelope do `viewer` (`:506-524`) e a projeção de identidade (`:494-503`) não ganham a chave.
- O `sheet` continua com `stripRestricted(model, sheet, roles)`, **sem** `revealed`: a ficha do dono nunca carrega a nota.

**O texto vem de uma rota própria:** `GET /characters/:id/revealed`.

- `characterAccess` (`authz.ts:72`): sem acesso, `viewer` ou NPC, **404**.
- Quem não narra precisa ser membro atual (`chronicleAccess === 'member'`); o ex-membro recebe **404**.
- Lê `revealed_sections`, `reveal_revision` e `sheet_data` numa leitura só, e responde:

  ```ts
  { revision: number, sections: { id: string, values: Record<string, string> }[] }
  ```

  com os valores filtrados por `canRead(model, campo, roles, revelados)`, só os campos das seções reveladas e só valores de texto. Sem seção revelada, `sections: []`, com 200.
- O narrador recebe a mesma forma: ele já lê o texto, e isso serve de "ver como o jogador vê".
- `cache-control: no-store` (global, `http/security.ts:17`).

**Por que uma rota própria, e não a nota dentro da ficha** (a alternativa está na §3.11):

- a chave do app fica `['characters', id, 'revealed']`, de três elementos, que o cache persistido **não grava por construção** (`persist.tsx:63-73`);
- o app nativo antigo nunca chama essa rota, então nunca recebe nem grava o texto;
- nenhuma das saídas de hoje (lote, 409, rolagem, Mesa, Histórico) precisa saber da revelação. Esquecer uma delas não vaza nada, e o dono não perde a nota quando um lote responde sem ela.

### 3.5 U-11 · O Histórico e os Bastidores

- **Histórico da ficha** (`GET /characters/:id/history`, `events.ts:439-655`): `character.section.reveal` e `character.section.hide` entram no `LIFECYCLE_EVENTS` (`events.ts:123-130`) como os passos `section.revealed` e `section.hidden`, com `lifecycleRole` = `storyteller` (`:177-193`). Eles aparecem ao dono e ao narrador como os passos do ciclo da criação, intercalados por data, sem "Desfazer" e sem `changes`. O comentário do mapa deixa de dizer "só da criação".
  - No app (`sheet/history/HistorySheet.tsx:35-58`): "Notas privadas reveladas ao jogador" e "Notas voltaram a ser privadas", com "(narrador)" pelo `whoLabel`.
  - **As linhas de edição da nota continuam escondidas do dono**, mesmo com a nota revelada: o Histórico chama `canRead` sem `revealed` (`events.ts:603`). O dono não fica sabendo quando o narrador mexeu na nota antes da revelação. Hoje o texto já entra sem conteúdo (`events.ts:104-106`), então só o rótulo e a data ficariam à mostra (§9, pergunta 4).
- **Bastidores** (`GET /chronicles/:id/history`): as duas ações entram no `AuditAction` (`audit.ts:9-46`), sem detalhe no `auditDetail` (`auditView.ts:51-93`, ramo `{}`), e ganham frase no `auditPhrase.ts`: "Notas privadas de {ficha} reveladas ao jogador" e "Notas de {ficha} voltaram a ser privadas". O tipo `Record<AuditAction, …>` obriga as frases no typecheck.

### 3.6 U-11 · A tela do narrador

**Onde fica a ação.** Junto do bloco das notas, na aba "Sobre" (zona `lore`), em todo modo (Leitura, Jogo, Editar, Criação). Um componente novo, `apps/frontend/sheet/storyteller/RevealControl.tsx`, entra no fim do `TextLayout` quando a seção é revelável e quem vê é o narrador da crônica numa ficha de outra pessoa (os mesmos critérios do `StorytellerBar.tsx:67`). O `TextLayout` ganha só uma linha.

**Textos** (rascunho do time, a revisar no PR; `{jogador}` é o `owner.username` que a ficha já recebe):

| Onde | Privadas (hoje) | Reveladas |
|---|---|---|
| Rótulo do bloco (`TextLayout.tsx:34-38`) | "Notas do Narrador · privadas: o jogador não vê" | "Notas do Narrador · reveladas: {jogador} lê" |
| Nome acessível do bloco | "…. Privadas: o jogador não vê" | "…. Reveladas: {jogador} lê" |
| Botão (`RevealControl`) | "Revelar ao jogador" (nome acessível "Revelar Notas do Narrador a {jogador}") | "Deixar privadas" (nome acessível "Deixar Notas do Narrador privadas de novo") |
| Folha de edição (`StorytellerBar.tsx:163-186`) e nome do botão "Editar …" (`:100-107`) | "Privadas: o jogador não vê estas notas." | "Reveladas: {jogador} lê o que você salvar aqui." |

O rótulo vem do template (`field.def.label`), então o D&D mostra "Notas do Mestre". O `ADJUST_HINT` (`privacy.ts:17-19`) continua na criação, nos dois estados.

**Revelar pede confirmação** (`RevealNotesSheet.tsx`, novo, no padrão do `RevealNpcSheet.tsx`):

- título: "Revelar as Notas do Narrador a {jogador}?";
- corpo: "{jogador} passa a ler estas notas inteiras, só em leitura, e também o que você salvar nelas enquanto estiverem reveladas. Quem já leu continua sabendo, mesmo que você volte a deixá-las privadas.";
- **o texto que vai ser revelado aparece na folha**, rolável, para o narrador conferir se não ficou segredo nele. Sem texto: "As notas estão vazias: {jogador} lê o que você escrever depois.";
- botões: "Cancelar" e "Revelar notas". Cancelar, Esc e o voltar do Android não enviam nada;
- `busy` durante o envio, com a mesma chave no reenvio (o `useCommandKey` de `lib/commandKey.ts`, como o `useSetNpcVisibility`, `lib/queries/chronicles.ts:181`);
- o erro e o 409 da revisão velha (inclusive do cache restaurado) aparecem dentro da folha. Nada é revelado sobre dado velho;
- no sucesso, a folha fecha, e o toast sai no `onClosed`: "Notas reveladas a {jogador}, só leitura.".

**Esconder envia direto**, sem folha, como descer a visibilidade do NPC:

- toast: "As notas voltaram a ser privadas. Quem já leu continua sabendo.";
- o erro aparece abaixo do botão, com `accessibilityRole="alert"`.

**Sem rede:** os dois botões ficam `aria-disabled` e tocáveis, e o toque diz "Sem conexão: revelar e esconder precisam de rede." (o padrão das ondas 2 e 4, com a recusa perto do toque).

**Mutação:** `useSetReveal(characterId)` em `lib/queries/reveal.ts` (novo). No sucesso, invalida `['characters', id]`, o que já leva o Histórico (`['characters', id, 'history']`) junto.

### 3.7 U-11 · A tela do dono

- **Contexto novo** `RevealedProvider` (`sheet/storyteller/revealed.tsx`), montado pelo `SheetScreen` em volta da ficha. Ele expõe:
  - as seções reveladas, pelo `reveal.sections` da ficha, filtrado por `revealableSections` do modelo. O que vem do disco é input hostil: lista de textos, até 8, ou vazia;
  - os valores, pela consulta `useRevealedNotes(id)` (§3.8);
  - o estado: carregado, carregando ou sem rede.
- **`SectionView.tsx:39` e `SheetView.tsx:123-131`** passam as seções reveladas ao `canReadSection`. A seção do narrador aparece na aba "Sobre" do dono só quando está revelada.
- **`TextLayout.tsx` (`TextBlock`):** quando o dono não lê o campo pelos papéis, mas o campo está revelado, o bloco desenha o valor revelado, só leitura:
  - rótulo: "Notas do Narrador · reveladas pelo narrador";
  - texto num `<Text>`, como todo bloco (`TextLayout.tsx:12-14`), sem HTML, link nem `dangerouslySetInnerHTML`;
  - nome acessível: "Notas do Narrador, reveladas pelo narrador: {texto}", ou "…: vazio";
  - sem rede e sem o texto na memória: "Conecte-se para ler as notas reveladas.".
- **O dono nunca tem botão de editar** nas notas: o `storytellerOnlyText` e o `canWrite` não mudam (`StorytellerBar.tsx:35-43`).
- **O app nativo antigo** não mostra nada revelado: não chama a rota e esconde a seção pelo `canReadSection` de hoje. Nenhuma tela quebra, e não há "Atualize o app". O dono vê as notas quando atualizar o app.

### 3.8 U-11 · Cache: o que fica no aparelho e o que acontece quando a nota volta a ser privada

**Revelar é dar acesso a um texto que estava privado. O desenho garante que ele não vá ao disco do jogador, e que saia da memória na primeira rebusca depois de esconder.**

| Camada | O que o desenho faz | Onde |
|---|---|---|
| Disco do app (SQLCipher no nativo, IndexedDB no web) | A consulta é `['characters', id, 'revealed']`, de três elementos: o `persistable` devolve `null`, e o `shouldDehydrateQuery` não a grava. O `persist.tsx` ganha um comentário e um teste que fixam isso (§4.1). Com a ficha vai só `reveal.sections` e a revisão, sem texto | `persist.tsx:63-73`, `:210-214` |
| Cache HTTP (navegador, `NSURLCache`, OkHttp) | `cache-control: no-store` em toda resposta | `http/security.ts:17` |
| Memória (TanStack) | `gcTime: 0` (sai ao fechar a ficha), `staleTime: 0`, rebusca ao focar (o `focusManager` do `_layout.tsx:35`) e a cada 30 s com a tela aberta e em primeiro plano, como o `PENDING_REFETCH_MS` (`sheet/data.ts:54`). Só fica ligada enquanto `reveal.sections` não estiver vazio | `lib/queries/reveal.ts` |
| Nota escondida em outro aparelho | Na próxima rebusca (foco, 30 s, reconexão), a ficha volta com `reveal.sections: []` ou a rota volta com `sections: []`. O app cancela e remove a consulta (`cancelQueries` e `removeQueries`), e o bloco some | `SheetScreen.tsx` |
| Resposta velha em voo | A resposta traz a `revision`. Se ela for menor que a `reveal.revision` da ficha mais recente, o app a descarta (o passo 5 da Etapa 3 do `plano-v5.md`) | `lib/queries/reveal.ts` |
| Perda de acesso (removido, ficha excluída, transferência) | O 404 da rota remove a consulta. O 404 da ficha já remove tudo de `['characters', id]`, inclusive a revelada | `SheetScreen.tsx:134-139` |
| Logout | `queryClient.clear()` e o storage do usuário apagado | `SessionProvider.tsx:33`; `persist.tsx:285-292` |
| Sentry e logs | O erro da consulta leva só a primeira parte da chave (`telemetryFilter.ts:244-276`); a API registra método, caminho e status, sem corpo (`middlewares/loggerMiddleware.ts:82`); o registro guarda só o id da seção | — |
| App nativo antigo | Nunca chama a rota: nada a gravar | — |

**O limite, igual ao do NPC** (`plano-v5.md:80`, `validacao-v5.md:167-169`): o desenho não apaga o que o jogador já leu, capturou ou copiou antes de o narrador esconder, nem a tela que ficou aberta **sem rede**, até a próxima rebusca. Por isso a folha de revelar e o toast de esconder dizem "quem já leu continua sabendo". O aparelho do jogador, reaberto sem rede, nunca mostra o texto: ele não está no disco (§11, U-11h).

### 3.9 O template: o que muda (nada no `schema.json`) e a versão

- **Nenhuma chave nova no `schema.json`, nenhum JSON de template muda.** A regra da seção revelável sai das `permissions` que já existem (§3.1).
- **Muda a semântica escrita do contrato**, no `design/templates/README.md`:
  - "Permissões por seção" (l.365-369): uma seção com `read` restrito ao narrador, só com campos de texto, pode ser revelada ao dono pelo narrador, ficha a ficha, só em leitura; o `viewer` nunca;
  - "Notas do narrador" (l.628-631): "nunca saem do servidor para quem não pode ler, **salvo a revelação explícita do narrador da crônica ao dono da ficha**", e a lista do que a revelação não toca (ficha, Mesa, lote, Histórico, exportação);
  - e a linha da ameaça em `arquitetura-motor-de-ficha.md:562`.
- **Versão:** como nenhum template muda, o P16-D não entra no commit de versão único do P15-D (vtm-v20 1.10.0, wta-w20 1.8.0, mta-m20 1.8.0, com a `0024`). Se o time escolher a alternativa com chave no template (§3.11), a chave vai nesse mesmo commit do P15-D, e as fichas das versões anteriores ficam sem a revelação.
- **App antigo × template:** nada muda. A `0025` é de schema, roda no deploy da API e não toca template. O app antigo continua abrindo toda ficha.

### 3.10 API HTTP e cliente: o que muda

| Onde | Mudança | Compatibilidade |
|---|---|---|
| `POST /characters/:id/reveal` | **Nova.** Só o narrador da crônica; corpo `{ clientCommandId, section, revealed, revision }`; 200, 403, 404, 409, 422 (§3.3) | Rota nova. Linha nova na matriz de AuthZ |
| `GET /characters/:id/revealed` | **Nova.** Dono membro e narrador; `{ revision, sections: [{ id, values }] }` (§3.4) | Rota nova. Linha nova na matriz de AuthZ |
| `GET /characters/:id`, projeção completa (dono e narrador) | `+ reveal: { sections, revision }`; ex-membro com `sections: []` | Aditivo. O app antigo ignora a chave, e o `validCharacter` do cache não a recusa (`persist.tsx:87-103`). O `viewer` e a identidade não mudam |
| `GET /characters/:id/history` | Passos `section.revealed` e `section.hidden` | Aditivo. O app antigo não tem rótulo para eles: o `HistorySheet` de hoje filtra o rótulo ausente (`HistorySheet.tsx:77-80`) e mostra a linha só com autor e data, sem erro (§4.2, §9, pergunta 6) |
| `GET /chronicles/:id/history` (Bastidores) | Ações `character.section.reveal` e `character.section.hide`, sem `detail` | Aditivo. Ação desconhecida no app antigo vira a frase genérica |
| `characters` | `revealed_sections text[]`, `reveal_revision integer` (`0025`) | Schema; `down` remove as colunas |
| `@tms/sheet-core` | `revealableSections`; o quarto parâmetro opcional em `canReadSection`, `canRead` e `stripRestricted` | Aditivo (§3.1) |
| `@tms/ui` | Nada. `BottomSheet`, `Button`, `Text` e o toast são usados como estão | — |

### 3.11 Alternativas descartadas

| Alternativa | Por que não |
|---|---|
| A nota revelada dentro do `sheet` do `GET /characters/:id` e de toda saída | Os doze chamadores do servidor precisariam do estado: os dez da §1, mais `sheets/creation.ts:143` e `sheets/policy.ts:171`. Um esquecido some com a nota da tela do dono depois de um lote, ou a mostra onde não devia. E a ficha inteira vai ao disco (`persist.tsx`): a nota ficaria no IndexedDB do web, sem cifra, até a próxima rebusca, e no disco do app nativo antigo, que não a mostra mas a grava |
| Um papel novo (`revealed`) na lista fechada | Muda o contrato do template (`schema.json:366-369`) e o `REGISTRY.roles`, mistura estado da ficha com papel e abriria espaço para escrita |
| Chave no template (`permissions.reveal: ["owner"]`), a seção só revelável quando o template diz | Mais explícita, mas só vale para as fichas da versão nova: o caso do U-10, uma ficha antiga, ficaria de fora (§2). Ela entraria no commit de versão do P15-D. O app antigo aceita a chave, porque o `validateTemplate` não confere as chaves de dentro de `permissions` (`validate/template.ts:829-835`), mas o Ajv da publicação teria de aceitá-la. Fica como pergunta técnica 1 |
| Retrato do texto no momento da revelação | Cria uma segunda cópia de texto privado (onde guardar, quem apaga, o que o narrador edita), e o campo "História / Prelúdio" do P15-D já é o lugar do texto fixo para o jogador. Ponto 2 para o PO |
| Lista de notas com revelação por item | Tipo de campo novo no contrato, editor novo e migração do texto de hoje: G. Ponto 3 para o PO |
| Revelar a nota copiando-a para o campo "História / Prelúdio" | Proibido pela D-16 e pelo brief: nada passa das Notas para o campo novo sem o narrador copiar à mão |

## 4. Testes

### 4.1 Um teste de regressão por item (falha no `05c5d7d`, passa depois)

| Item | Teste | Onde | Runner |
|---|---|---|---|
| U-11 | `revealableSections` nos seis templates do repositório: só a seção do narrador (`storyteller`) em cada um; uma seção restrita com campo numérico, uma com `read: ["owner","storyteller"]` e uma com `viewer` não são reveláveis | `packages/sheet-core/src/__tests__/permissions.test.ts` | Bun |
| U-11 | `canRead` com `revealed`: o dono lê a seção revelada; o `viewer`, o narrador sem `owner` e o papel desconhecido não ganham nada; id desconhecido e seção não revelável são ignorados; `canWrite` do dono continua `false`; sem `revealed`, igual a hoje. Property test (fast-check) com papéis, seções e listas quaisquer: a revelação nunca dá escrita e nunca dá leitura fora de `revealableSections` | `permissions.test.ts`, `__tests__/permissions.property.test.ts` (novo) | Bun |
| U-11 | Nos três sistemas (`matrix-systems.ts`): o narrador revela; o `GET /characters/:id` do dono continua **sem** a sentinela no corpo e traz `reveal.sections: ["storyteller"]`; o `GET …/revealed` do dono traz a sentinela; o narrador esconde; o `GET …/revealed` volta com `sections: []` e sem a sentinela; o Histórico do dono tem os dois passos, com "(narrador)", e nenhuma linha "Notas do Narrador" de edição | `apps/api/src/__tests__/reveal.test.ts` (novo) | Bun em PGLite |
| U-11 | AuthZ, nos três sistemas: outro jogador e narrador de outra crônica, 404 nas duas rotas; dono no `POST`, 403 `STORYTELLER_REQUIRED`; ex-membro com ficha própria revelada, 404 no `GET …/revealed` e `reveal.sections: []` no `GET /characters/:id`; `viewer` de NPC `full`, 404 nas duas; NPC oculto: 404 para o jogador, igual a id inexistente, e 422 para o narrador; ficha do próprio narrador, 422; seção `about`, 422; narrador antigo depois da transferência, 404 | `reveal.test.ts` | Bun em PGLite |
| U-11 | Comando: mesma chave e mesmo corpo, `duplicate: true` e um registro só; mesma chave e outro corpo, 409 `IDEMPOTENCY_CONFLICT`; revisão velha, 409 `REVISION_CONFLICT`; revelar o que já está revelado não sobe a revisão nem registra; revelar não muda `sheet_version` nem `updated_at` | `reveal.test.ts` | Bun em PGLite |
| U-11 | Nenhuma saída de hoje leva a nota ao dono com ela revelada: lote (200 e 409), rolagem, Mesa, lista da crônica e Histórico. A sentinela é procurada no corpo inteiro (o padrão de `backstage.test.ts:79-125`) | `reveal.test.ts` | Bun em PGLite |
| U-11 | Bastidores: as duas ações com a frase, sem `detail` e sem a sentinela; o `payload` gravado só tem `section` | `apps/api/src/__tests__/auditView.test.ts`, `backstage.test.ts` | Bun em PGLite |
| U-11 | Migration: a `0025` sobe e desce; a constraint recusa `revealed_sections` em NPC e mais de 8 itens; toda ficha existente fica com `'{}'` | `packages/db/src/__tests__/migrations.test.ts` | Bun |
| U-11 | Cache: `persistable(['characters', id, 'revealed'])` é `null`; depois do `dehydrate` de um cliente com a consulta revelada carregada, o texto serializado não contém a sentinela; a ficha restaurada traz `reveal.sections`, mas nenhuma consulta revelada | `apps/frontend/lib/__tests__/persist.test.tsx` | Jest |
| U-11 | Tela do dono: com `reveal.sections` e a resposta da rota, a aba "Sobre" mostra "Notas do Narrador · reveladas pelo narrador" e o texto; a rebusca com `sections: []` tira o bloco e remove a consulta (`getQueryData` indefinido); resposta com revisão menor que a da ficha é descartada; sem rede, "Conecte-se para ler as notas reveladas."; nenhum botão de editar | `apps/frontend/sheet/__tests__/reveal.test.tsx` (novo) | Jest + RNTL |
| U-11 | Tela do narrador: "Revelar ao jogador" com o nome acessível; a folha mostra o texto e "Cancelar" não envia; "Revelar notas" envia com a chave e a revisão; o toast sai no `onClosed`; o rótulo e a folha de edição passam a "reveladas"; "Deixar privadas" envia direto; o 409 aparece na folha; sem rede, `aria-disabled` com o motivo; NPC e ficha própria sem o botão | `apps/frontend/sheet/__tests__/storyteller.test.tsx` | Jest + RNTL |
| U-11 | `HistorySheet` com os dois passos; `auditPhrase` com as duas frases | `sheet/history/__tests__/`, `components/chronicles/__tests__/auditPhrase.test.ts` | Jest |

### 4.2 Testes existentes que mudam junto

- **Matriz de AuthZ** (`apps/api/src/test/authz-matrix.ts`): duas linhas novas, no padrão das linhas de visibilidade (`:393-415`). O teste de cobertura (`authz.test.ts:331`) falha sem elas:

  | Rota | storyteller | owner | player | former | otherStoryteller | stranger | anonymous |
  |---|---|---|---|---|---|---|---|
  | `POST /characters/:id/reveal` (`mutates`, corpo com a seção do caso do sistema e `revision: 0`) | 200 | 403 | 404 | 404 | 404 | 404 | 401 |
  | `GET /characters/:id/revealed` | 200 | 200 | 404 | 404 | 404 | 404 | 401 |

  O `former` da matriz é o ex-membro diante da ficha da dona (sem papel nela). O ex-membro diante da própria ficha, o `viewer` e o NPC oculto não são atores da matriz: ficam no `reveal.test.ts` (§4.1), nos três sistemas, como o `viewer` já fica em `backstage.test.ts`.
- **`matrix-systems.ts`:** o caso de cada sistema passa a dizer o id da seção revelável, para o corpo da linha não escrever "storyteller" à mão (regra do `authz-matrix.ts:1-6`).
- **`characters.test.ts`:** o `GET /characters/:id` do dono e do narrador ganha `reveal`. Nenhum teste confere a lista exata de chaves da projeção completa (conferido com grep; o de `backstage.test.ts:160` é a identidade).
- **Jest:** `storyteller.test.tsx` (`hiddenFromOwner` e os textos de `privacy.ts`), `SheetView.test.tsx:132` (continua: a ficha do dono não tem a nota), as fixtures de `test/fixtures.ts:134` (o `reveal` nas fichas falsas).
- **O `HistorySheet` com `event` desconhecido:** o app de hoje não quebra, porque filtra o rótulo ausente (`HistorySheet.tsx:77-80`), mas mostra uma linha só com autor e data. Um teste do Jest fixa que o app novo tem rótulo para todo `event` que o servidor manda (pergunta técnica 6).
- **E2E de hoje:** nenhum muda. Os que procuram "Notas do Narrador" continuam valendo sem revelação: `journey.spec.ts:229-258`, `narrator.spec.ts:89-122`, `sheet.spec.ts:79` e `:90`, `table.spec.ts:76-78` e `:140-143`, `journey-backstage.spec.ts:119`. O botão novo tem nome "Revelar Notas do Narrador a …", que não casa com `getByRole('button', { name: 'Editar Notas do Narrador' })` nem com `getByText('Notas do Narrador · privadas: o jogador não vê')`. Conferir na rodada do E2E da integração.

### 4.3 E2E novo: `e2e/tests/reveal-notes.spec.ts` (Chromium e WebKit)

Dois contextos (narrador e dona), como o `table.spec.ts`. Uma sentinela fictícia nas notas (`SENTINELA-P16`):

1. **Narrador, web 1280:** escreve a sentinela pelas Notas ("Editar como narrador" → `getByRole('button', { name: 'Editar Notas do Narrador' })` → `getByRole('textbox', { name: 'Notas do Narrador', exact: true })`). A dona, a 390, abre a ficha: o corpo do `GET /characters/:id` não tem a sentinela, e a aba `getByRole('tab', { name: 'Sobre' })` não tem o bloco.
2. **Revelar:** o narrador, na aba "Sobre", `getByRole('button', { name: /^Revelar Notas do Narrador a / })`. A folha mostra a sentinela. Esc fecha sem requisição (contar as requisições a `/reveal`); de novo, "Revelar notas" envia uma. O toast aparece **depois** de a folha sair (`toBeHidden` do painel `bottom-sheet-root > [aria-modal="true"]`, depois o toast). O rótulo vira "Notas do Narrador · reveladas: …".
3. **A dona lê:** recarrega; a aba "Sobre" a 390 mostra "Notas do Narrador · reveladas pelo narrador" e a sentinela, sem botão de editar. **O que o Jest não pega:** `page.evaluate` lê todas as chaves e valores do IndexedDB `tms-offline` e confere que nenhum contém a sentinela (a ficha está lá; a nota, não).
4. **Esconder:** o narrador toca "Deixar privadas". A dona volta o foco à aba (`page.bringToFront` e o evento de foco): o bloco some, e a rota `/revealed` responde `sections: []`. O Histórico da dona tem "Notas privadas reveladas ao jogador" e "Notas voltaram a ser privadas", e nenhuma linha de edição das notas.
5. **Outro jogador:** um terceiro contexto pede `GET /characters/<ficha da dona>/revealed` pelo `page.request`, com a sessão dele: 404.
6. **Offline:** com a nota revelada, a dona fica offline (`context.setOffline(true)`) e recarrega a partir do cache: a ficha abre, o bloco diz "Conecte-se para ler as notas reveladas.", e o DOM não tem a sentinela.

As abas da ficha a 390 entram no passo 3. O WebKit roda os passos 2 a 4 (o Esc e a folha no Safari).

### 4.4 Suítes do "PR local" e cobertura

```bash
npx pnpm -C packages/sheet-core build        # o dist que a API lê
npx pnpm -C packages/db build                # depois da 0025 e do codegen
npx pnpm turbo run typecheck lint --filter=@tms/sheet-core --filter=@tms/db --filter=@tms/api --filter=frontend --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=@tms/sheet-core --filter=@tms/db --filter=@tms/api --filter=frontend
```

- **As metas são por arquivo.** API: 85% de linhas e funções (`apps/api/bunfig.toml`): o `sheets/reveal.ts` nasce com o `reveal.test.ts`. App: 80/80/70/80 em `./sheet/` e 70/70/60/70 no resto (`apps/frontend/jest.config.js:40-42`): o `lib/queries/reveal.ts` e o `persist.tsx` com teste.
- **Jest com `--forceExit`** pelo `pnpm test` ([onda-4.md](onda-4.md) §11).
- **Concorrência em Postgres real, à mão:** revelar e esconder com a mesma revisão ao mesmo tempo dão um 200 e um 409. Um caso em `apps/api/src/__tests__/backstage.pg.test.ts`, com o banco `_test` do worktree (`PG_TEST_URL=…/tms_p16d_test bun test .pg.test`).
- O `db:migrate` pode travar na saída: conferir pela tabela `kysely_migration`.
- O E2E inteiro roda na integração, um por vez (portas fixas).

## 5. Segurança

O pacote cria estado novo com AuthZ do narrador, duas rotas e uma migration de schema, e mexe no que o dono recebe de um texto privado. **Passa por `/security-review` antes do merge** (a matriz exige, "Como executar", passo 4), além do `/code-review`. Foco: `packages/sheet-core/src/permissions.ts`, `apps/api/src/sheets/reveal.ts`, `sheets/routes.ts` (o `reveal` na ficha), `sheets/policy.ts`, `sheets/events.ts` (os passos), `audit.ts`, `auditView.ts`, a `0025`, `apps/frontend/lib/queries/reveal.ts`, `lib/persist.tsx` e `sheet/storyteller/revealed.tsx`.

**Ameaças ("o que pode dar errado?"):**

| O que pode dar errado | Como o desenho evita |
|---|---|
| O jogador revela a própria nota, ou forja o papel | O papel vem do banco: `storyteller_id` lido na transação, com a trava da linha (§3.3). O corpo não tem papel, dono nem usuário. O dono recebe 403; os outros, 404 |
| IDOR: outro jogador lê a nota revelada da ficha alheia | `characterAccess` não dá papel a outro jogador (`authz.ts:111-114`): 404 nas duas rotas, nos três sistemas (§4.1) |
| Ex-membro continua lendo | A rota exige membro atual; o `reveal` da ficha dele vem vazio (§3.4; ponto 4 para o PO) |
| Narrador antigo depois da transferência | `storyteller_id` mudou: 404. O `lockCharacter` pega a trava da crônica antes, e a transferência é serializada com o comando |
| A nota do NPC vaza para o `viewer` | NPC nunca é revelável: 422 para o narrador, 404 para os outros, e a constraint `characters_reveal_pc` no banco. O `viewer` nunca recebe a concessão (§3.1) |
| O NPC oculto vira oráculo de existência | 404 igual ao de id inexistente, como hoje |
| A concessão de leitura vira escrita | O `canWrite` não recebe `revealed` e chama o `canRead` sem ele. O `applyBatch` do servidor recusa a escrita do dono como hoje. Property test (§4.1) |
| A revelação vaza por uma saída de hoje (lote, 409, rolagem, Mesa, Histórico) | Nenhuma delas passa `revealed`, de propósito. O teste procura a sentinela em todas, com a nota revelada (§4.1) |
| Um template faz uma seção pública "revelável" e confunde as regras | A regra só vale para seção restrita ao narrador e só com texto. A publicação de template continua só por script do dono, com o Ajv e o `validateTemplate` |
| Id de seção como injeção | Padrão e tamanho no corpo, conferido contra o modelo da ficha; SQL só com parâmetro (Kysely); até 8 ids pela constraint |
| Revelar duas vezes, reenvio, corrida entre revelar e esconder | Chave de comando com hash do pedido, revisão com 409 e `FOR UPDATE` (§3.3; teste em Postgres real, §4.4) |
| O texto fica no aparelho do jogador depois de esconder | Nunca vai ao disco: chave de três elementos fora do `persistable`, `no-store`, `gcTime: 0`. Sai da memória na próxima rebusca e no logout. Resposta velha é descartada pela revisão (§3.8) |
| O narrador revela um segredo sem querer | A folha mostra o texto inteiro antes de confirmar e diz que quem já leu continua sabendo; o rótulo e o editor dizem o estado o tempo todo (§3.6) |
| A nota no Sentry ou nos logs | Nenhum log novo. O registro guarda só o id da seção. O Sentry do app recebe só a primeira parte da chave da consulta; a API só manda 5xx, remontados (`http/on-error.ts`) |
| XSS pelo texto da nota | Sai num `<Text>` do React Native, sem HTML, markdown executável, link nem `dangerouslySetInnerHTML`. O tamanho continua limitado pelo `validateSheet` (4000) |
| Carga pela rebusca de 30 s | Só com a ficha aberta, em primeiro plano, e só quando há nota revelada; resposta pequena |

**Checklist da organização:**

- **AuthZ no servidor** em todas as rotas novas, com a matriz nos três sistemas, `viewer`, ex-membro, outro jogador e NPC oculto (§4.1, §4.2). Nada de papel ou dono vindo do cliente.
- **Menor privilégio:** a concessão é só de leitura, só ao dono, só da seção revelada, só enquanto durar.
- **Fail secure:** sem `revealed`, privado; id desconhecido, ignorado; erro na rota, nada na tela; estado do disco inválido, vazio.
- **Validação no servidor:** corpo com tipos e limites (TypeBox); seção conferida contra o modelo.
- **Erros sem stack trace:** 403, 404, 409 e 422 com `code` e mensagem curta.
- **Logs sem PII, senha, token ou texto de nota.**
- **Dependências:** nenhuma nova.

## 6. Como generaliza além do WoD

- **Genérica.** A regra sai das `permissions` do template e vale para qualquer sistema com uma seção restrita ao narrador só com texto. Nos seis templates do repositório, ela dá a seção do narrador: "Notas do Narrador" no V20, no W20, no M20 e no Fate, "Notas do Mestre" no D&D e as do Guardião no CoC. O rótulo da tela vem do template.
- **Nenhum código conhece sistema:** nem o core, nem a API, nem o app. A migration guarda ids de seção, e um sistema novo não precisa de outra.
- **Um template futuro com duas seções restritas** (por exemplo, "Segredos" e "Ganchos") ganha um botão por seção, cada uma revelada à parte, sem mudança de código.
- **O que não generaliza sem decisão:** uma seção legível por um papel novo (a "Sombra" da Aparição, README l.370) continua pedindo papel novo na lista fechada. A revelação não serve para isso: ela só abre ao dono.

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado**, com a resposta do PO ao ponto 1 (§9): o pacote entra nesta onda. Arquivos e linhas conferidos no `05c5d7d` (§3). A D-17 aplicada, com o que não se aplica como está escrito apontado na §2.
2. **Typecheck, lint e testes** de `@tms/sheet-core` (com o `dist` reconstruído), `@tms/db`, `@tms/api` e do frontend (§4.4).
3. **Um teste de regressão por item** (§4.1), falhando no `05c5d7d`, e o `test:coverage` verde.
4. **`/code-review` e `/security-review`** no diff do pacote (§5). Os achados vão no resumo.
5. **Os cenários das personas, repetidos sem o defeito**, com a API local e o seed do roteiro (só contas fictícias; §11):

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | U-11 | O narrador do feedback de 03/11 (U-10 e U-11, Android): revelar as Notas do Narrador da ficha de um jogador e conferir no aparelho do jogador | O jogador lê o texto na aba "Sobre", só leitura; depois de "Deixar privadas", o bloco some na rebusca e não volta sem rede |
   | U-11 | N-W, NW-25 (`narrador-web.md:187-191`), web 390: "Ele vai ler isso? Vai saber que tem nota?" | O rótulo responde nos dois estados: "privadas: o jogador não vê" e "reveladas: {jogador} lê"; o editor diz o mesmo |
   | U-11 | N-A, NA-17 (`narrador-app.md:172-180`), iOS: o retorno ao jogador | Para correção, o "Pedir ajuste" continua o canal (o `ADJUST_HINT`); a revelação aparece como ação separada, com confirmação |
   | U-11 | PO-W (`po-web.md:78`, `:214`, `:249`): a sentinela nas notas não chega ao jogador | Sentinela fora do corpo da ficha, da Mesa e do Histórico do jogador antes de revelar e depois de esconder; no NPC `full`, fora sempre |

6. **Conferência no aparelho.** O roteiro completo está na **§11**: revelar e esconder com o jogador logado em outra plataforma, e conferir que o texto não fica no cache.
7. **Resumo para a seção do pacote no PR da onda:**
   - o que mudou e como foi testado;
   - os achados das duas revisões;
   - as rotas novas e a `0025` (§3.10);
   - a regra da seção revelável e o limite do "quem já leu continua sabendo";
   - os pontos para o PO (§9) que seguem abertos.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

Cada commit diz tudo o que entra nele. Nenhum commit muda template.

| # | Commit | O que entra | Esforço |
|---|---|---|---|
| 1 | `feat(core): seção do narrador revelável ao dono` | `packages/sheet-core/src/permissions.ts` (`revealableSections`; o parâmetro `revealed` em `canReadSection`, `canRead` e `stripRestricted`); `index.ts` (export); `__tests__/permissions.test.ts` com os seis templates (vtm-v20, wta-w20, mta-m20, dnd5e-2014, coc7e, fate-core: só `storyteller` revelável em cada) e `__tests__/permissions.property.test.ts` (novo); `design/templates/README.md` (l.365-369 e l.628-631) | P |
| 2 | `feat(db): estado da revelação na ficha` | `packages/db/src/migrations/0025_character_reveal.ts` (as duas colunas e as duas constraints, com `down`); o registro em `packages/db/src/migrations.ts` (depois da `0024` do P15-D); `packages/db/src/types.ts` (codegen); `doc/database.dbml`; `packages/db/src/__tests__/migrations.test.ts` (sobe e desce a `0025`; as listas esperadas ao descer passam a começar por ela) | P |
| 3 | `feat(api): narrador revela e esconde as notas; o dono lê` | `apps/api/src/sheets/reveal.ts` (novo: `POST /characters/:id/reveal` e `GET /characters/:id/revealed`); `apps/api/src/index.ts` (registro); `sheets/routes.ts` (`reveal` no `GET /characters/:id`, `sections: []` para o ex-membro); `sheets/policy.ts` (`lockCharacter` lê as colunas); `audit.ts` (`character.section.reveal`, `character.section.hide`); `chronicles/auditView.ts` (sem detalhe); `sheets/events.ts` (os passos `section.revealed` e `section.hidden`, `lifecycleRole`); `test/authz-matrix.ts` (as duas linhas) e `test/matrix-systems.ts` (a seção por sistema: V20, W20 e M20); `__tests__/reveal.test.ts` (novo, nos três sistemas); `__tests__/auditView.test.ts`; `__tests__/backstage.test.ts`; o caso em `backstage.pg.test.ts` | M |
| 4 | `feat(app): o narrador revela e esconde as notas` | `apps/frontend/lib/queries/reveal.ts` (novo: `useSetReveal`, `useRevealedNotes`); `sheet/storyteller/RevealControl.tsx` e `RevealNotesSheet.tsx` (novos); `sheet/storyteller/privacy.ts` (textos de "reveladas"); `sheet/storyteller/StorytellerBar.tsx` (nome do "Editar …" e aviso da folha de edição pelo estado); `sheet/layouts/TextLayout.tsx` (rótulo pelo estado e o `RevealControl`); `sheet/history/HistorySheet.tsx` (os dois passos); `components/chronicles/auditPhrase.ts` (as duas frases); testes Jest | M |
| 5 | `feat(app): o dono lê as notas reveladas, sem cache em disco` | `sheet/storyteller/revealed.tsx` (novo: `RevealedProvider`); `sheet/SheetScreen.tsx` (provider; cancelar e remover a consulta quando o estado esvazia ou dá 404); `sheet/SectionView.tsx` e `sheet/SheetView.tsx` (seções reveladas no `canReadSection`); `sheet/layouts/TextLayout.tsx` (o bloco revelado, só leitura); `lib/persist.tsx` (comentário: a consulta revelada nunca vai ao disco); `test/fixtures.ts`; `lib/__tests__/persist.test.tsx` e `sheet/__tests__/reveal.test.tsx` (novo) | M |
| 6 | `test(e2e): revelar e esconder as notas do narrador` | `e2e/tests/reveal-notes.spec.ts` (novo, Chromium e WebKit) | P |
| 7 | `docs: a revelação das notas no contrato e na arquitetura` | `doc/arquitetura-motor-de-ficha.md:562` (a linha da ameaça); a frase de `doc/plano-v0.md:32` e `:556` fica para o P01-D, que registra as decisões nos planos (§8.4) | P |

**Por que esta ordem:** o core (1) vem antes da API, que lê o `dist`; a migration (2) antes da rota (3); a API antes do app (4, 5), que usa os tipos do Eden; a tela do narrador (4) antes da do dono (5), para o E2E (6) ter as duas.

### 8.2 Esforço

**M, de 3 a 4 dias de desenvolvimento**, em 7 commits (4 P e 3 M), mais o roteiro manual da §11 (meio dia, com dois aparelhos por bloco). A matriz estima 1 M e bate. O que pesa:

- a migration e duas rotas com a matriz de AuthZ nos três sistemas;
- o cache, que pede o teste do disco e o E2E com IndexedDB;
- o `/security-review`.

### 8.3 Riscos

| Risco | Efeito | Mitigação |
|---|---|---|
| O narrador revela a nota com um segredo junto | O jogador lê o que não devia | A folha mostra o texto antes de confirmar; o rótulo e o editor dizem o estado; "quem já leu continua sabendo" |
| A revelação viva: o narrador escreve um segredo novo numa nota revelada | Idem | O editor diz "Reveladas: {jogador} lê o que você salvar aqui."; ponto 2 para o PO (retrato) |
| Tela do jogador aberta sem rede depois de esconder | O texto fica na tela até a rebusca | Limite conhecido, igual ao do NPC (§3.8); nunca no disco |
| App nativo antigo | O dono não vê a nota revelada até atualizar | Falha segura, sem "Atualize o app"; registrar no resumo do PR |
| `HistorySheet` antigo com `event` desconhecido | Linha só com autor e data, sem rótulo | Não quebra (`HistorySheet.tsx:77-80`); pergunta técnica 6 |
| Número da migration colide com outro pacote da onda | `kysely_migration` fora de ordem | Número acertado na integração, pela ordem de merge (§8.4) |
| O PO deixa o pacote para depois | A onda sobe sem ele | A regra "Decisão revista" da matriz; o plano fica pronto para a onda seguinte |

### 8.4 Conflitos com os pacotes da onda

| Pacote | Onde encosta | Acordo proposto |
|---|---|---|
| **P15-D** (D-16, pré-requisito) | `sheet/storyteller/privacy.ts` (o P15-D põe `readByOwner` e `SHARED_NOTE_SHEET`, P15-D §3.3); o aviso da folha de edição em `StorytellerBar.tsx` (`TextFieldSheet`); `packages/db/src/migrations.ts` e `migrations.test.ts` (a `0024`); os três templates | O P16-D entra depois do P15-D e faz rebase. O aviso da folha passa a ter três casos, nesta ordem: "Reveladas: {jogador} lê o que você salvar aqui." (seção revelada, P16-D), "Privadas: o jogador não vê estas notas." (R-09) e "O jogador lê este texto." (P15-D). O `readByOwner` do P15-D continua sem `revealed`: a nota revelada não vira campo público. O P16-D não muda template e não entra no commit de versão do P15-D. A migration do P16-D é a `0025`, registrada depois da `0024`. Na aba "Sobre", a seção do narrador continua depois da seção da História |
| **P13** (T-84: Citação e Notas editáveis no Editar) | `sheet/layouts/TextLayout.tsx`: o T-84 põe o editor (`TextEditorRow`) no `TextLayout` (P15-D §3.0); talvez `HistorySheet.tsx` (se o candidato do "permanente — → 4" entrar) | O P16-D mexe no `TextBlock` de leitura (rótulo e bloco revelado) e acrescenta o `RevealControl` no fim; o P13 troca o bloco pelo editor no Editar. O bloco revelado do dono fica sempre em leitura, também no Editar, e o editor do T-84 nunca aparece para um campo que o dono só lê por revelação (o `canWrite` decide). Quem entra depois faz o rebase |
| **P09-D** (D-10) | `sheet/SheetView.tsx` (abas e aba "Pontos" em leitura para o narrador) e `SheetScreen.tsx` | O P16-D só passa as seções reveladas ao `readableZones` e monta o provider: uma linha cada. Conferir no rebase |
| **P12** (convite) | `apps/api/src/test/authz-matrix.ts` (linhas de convite); `audit.ts` (se o convite ganhar ação); uma migration, se o T-45 guardar rótulo | Linhas e ações em pontos diferentes dos arquivos; o número da migration segue a ordem de merge |
| **P14-D** (D-15) | Nenhum arquivo em comum conferido. Os dois mexem no que o jogador lê, com AuthZ no servidor | Mesmo `/security-review`, se rodar junto |
| **P01-D** (D-13, entra por último) | `doc/plano-v0.md` (l.32, l.556: "nunca recebe"), o registro da D-17 nos planos | O P16-D muda só o README dos templates e a `arquitetura`; o P01-D escreve nos planos o que entrou (ou que o pacote ficou para depois) |
| E2E | `reveal-notes.spec.ts` é novo; nenhum spec de hoje muda (§4.2) | Roda na integração, depois do P09-D (que mexe nas abas e no `narrator.spec.ts`) |

**Ordem de merge proposta:** P15-D → P16-D. O P16-D não depende do P09-D, do P12, do P13 nem do P14-D. O P01-D vem por último.

### 8.5 Arquivos tocados

| Arquivo | O que muda |
|---|---|
| `packages/sheet-core/src/permissions.ts`, `index.ts` | `revealableSections`; o parâmetro `revealed` |
| `packages/db/src/migrations/0025_character_reveal.ts` (novo), `migrations.ts`, `types.ts`, `__tests__/migrations.test.ts` | As colunas, as constraints e o registro |
| `apps/api/src/sheets/reveal.ts` (novo), `index.ts` | As duas rotas |
| `apps/api/src/sheets/routes.ts`, `sheets/policy.ts`, `sheets/events.ts` | O `reveal` na ficha; a trava lê as colunas; os passos no Histórico |
| `apps/api/src/audit.ts`, `chronicles/auditView.ts` | As duas ações, sem detalhe |
| `apps/api/src/test/authz-matrix.ts`, `test/matrix-systems.ts` | As linhas e a seção por sistema |
| `apps/frontend/lib/queries/reveal.ts` (novo), `lib/persist.tsx` | Consulta e mutação; o comentário do disco |
| `apps/frontend/sheet/storyteller/RevealControl.tsx`, `RevealNotesSheet.tsx`, `revealed.tsx` (novos), `privacy.ts`, `StorytellerBar.tsx` | A ação, a folha, o contexto e os textos |
| `apps/frontend/sheet/layouts/TextLayout.tsx`, `SectionView.tsx`, `SheetView.tsx`, `SheetScreen.tsx` | O rótulo, o bloco revelado e a remoção da consulta |
| `apps/frontend/sheet/history/HistorySheet.tsx`, `components/chronicles/auditPhrase.ts` | Os passos e as frases |
| `design/templates/README.md`, `doc/arquitetura-motor-de-ficha.md`, `doc/database.dbml` | O contrato, a ameaça e o modelo |
| Testes da §4.1 e §4.2; `e2e/tests/reveal-notes.spec.ts` (novo) | — |

## 9. Perguntas abertas

**Pontos para o PO (nenhum decidido neste plano):**

1. **O P16-D entra nesta onda ou fica para depois?** A D-17 diz "quando houver a necessidade". Não apareceu pedido novo (§2). O caso que pode pesar é o do U-10: o prelúdio está numa ficha antiga, e o campo do P15-D só chega às fichas novas ([onda-4.md](onda-4.md) §6, ponto 9). O P16-D vale para fichas de qualquer versão e é a saída para essa ficha sem criar a atualização de versão, mas revela a nota inteira, e o narrador teria de tirar dela os segredos à mão. **Recomendação:** entrar nesta onda só se o PO quiser cobrir a ficha antiga do U-10 por este caminho; senão, fica para a onda seguinte, como a D-17 escreve, e a onda sobe sem ele ("Decisão revista").
2. **Revelação viva ou retrato.** Proposta: viva (o dono lê o texto atual e o que o narrador salvar enquanto ela durar), com o estado sempre à vista do narrador. O retrato guarda uma segunda cópia do texto privado (§3.11).
3. **Uma nota por ficha.** Hoje a nota é um texto só, e revelar é revelar o campo inteiro. Uma lista de notas, com revelação por item, é um tipo de campo novo no contrato (G). Proposta: o campo inteiro nesta onda.
4. **O ex-membro deixa de ler a nota revelada.** Proposta: sim, ao sair ou ser removido; se voltar à crônica e a nota ainda estiver revelada, volta a ler.
5. **Aviso ao jogador.** Proposta: nenhum selo nem push nesta onda; o passo no Histórico e o bloco na aba "Sobre" bastam. O push fica para depois, como na D-03.

**Pontos das ondas anteriores que tocam este pacote (continuam abertos):**

- [onda-4.md](onda-4.md) §6, ponto 9 (fichas na versão anterior): o ponto 1 acima depende dele;
- [onda-4.md](onda-4.md) §6, ponto 3 (ordem do release): o P16-D não abre janela de "Atualize o app", porque não muda template. A `0025` é de schema e roda no deploy da API;
- os demais pontos das ondas 1 a 4 ([onda-1.md](onda-1.md) §6 a [onda-4.md](onda-4.md) §6) não tocam o pacote.

**Perguntas técnicas:**

1. **Regra no código ou chave no template** (§3.11). Proposta: a regra das `permissions` de hoje, que vale para as fichas antigas e não pede versão. Com a chave, a revelação só chega às fichas novas, e a chave entra no commit de versão do P15-D.
2. **Rota própria para o texto ou o texto dentro da ficha** (§3.4, §3.11). Proposta: rota própria, que não vai ao disco por construção e não muda as saídas de hoje.
3. **Colunas na `characters` ou tabela própria** (`character_reveals`, com quem e quando). Proposta: colunas, como a `visibility` do NPC; quem e quando já estão no registro da crônica.
4. **Histórico do dono com a nota revelada.** Proposta: as linhas de edição das notas continuam escondidas dele, mesmo revelada (§3.5). A alternativa mostraria "Notas do Narrador · atualizado" a partir da revelação.
5. **A rebusca de 30 s** da consulta revelada, com a ficha aberta. Proposta: manter, como o `PENDING_REFETCH_MS`; sem ela, esconder só chega no foco.
6. **O app antigo com o passo novo no Histórico.** O `HistorySheet` de hoje não quebra e mostra a linha só com autor e data (`HistorySheet.tsx:77-80`). Proposta: conviver com isso até a loja. A alternativa é o servidor mandar os passos novos só a quem envia a versão nova no `x-tms-client-version` (`lib/http.ts:8-19`), o que põe versão de app na regra de uma resposta.
7. **O número da migration** na integração, se outro pacote da onda também criar uma (§8.4).

**Achados da onda 4 sem correção ([onda-4.md](onda-4.md) §11) que tocam este pacote:**

- **item 6** (o "Desfazer" do narrador no lote de criação de uma ficha aprovada): os passos novos do Histórico nascem sem "Desfazer" (`reversible: false`, como os do ciclo), e o teste confere;
- **item 7** (a senha do seed no campo E-mail no iOS): o login do roteiro (§11.d) usa o driver que esconde o valor dos campos E-mail e Senha;
- **"não conferido"**: os anúncios do VoiceOver e do TalkBack. O toast de revelar e esconder e o rótulo do bloco ficam para ouvir no aparelho (§11.f).
- Os itens 1 a 5 não tocam o pacote.

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; as Notas do Narrador continuam privadas por padrão, e o servidor continua a autoridade.

(Vazio: preenchido na implementação.)

## 11. Testes manuais (web, Android com AVD, iOS com idb)

Roteiro para conferir o item na interface, nas três plataformas, com a API local e o seed do roteiro. Só contas fictícias. Ele detalha o passo 6 da §7. A coluna "Resultado" fica em branco e é preenchida na integração. Nenhum resultado é "ok" sem a evidência; quando uma plataforma não puder ser conferida, o resultado diz "não conferido" e por quê.

**O que este roteiro prova de diferente:** revelar e esconder com o narrador num aparelho e o jogador logado em outro, e que o texto não fica no aparelho do jogador. Por isso cada bloco usa duas plataformas ao mesmo tempo.

### 11.a Preparação

1. **Banco e API.** Banco próprio do pacote no Postgres local (`createdb tms_p16d`, `DATABASE_URL=…/tms_p16d` com as credenciais locais do `docker-compose.yml`) e `npx pnpm db:migrate`, que grava os templates e a `0025`. Conferir pela `kysely_migration` (o processo pode travar na saída). **Sem `db:down`.** Depois, `npx pnpm -C packages/sheet-core build` e `npx pnpm -C packages/db build`, a API em `npx pnpm dev:api` (3001) e o Metro em `cd apps/frontend && npx expo start` (8081).
2. **Seed:** `npx pnpm seed:roteiro --fichas-criacao > <scratchpad>/p16d/seed-<plataforma>.log 2>&1`. A saída tem a senha e os e-mails: ler só com `grep -v -i senha`.
   - **O que ele já cobre:** as contas N (`roteiro_narrador`), J1 (`roteiro_jogador1`), J2 (`roteiro_jogador2`) e N2 (`roteiro_narrador2`), todas `@roteiro.test`; as crônicas "Vampiro v3/v5", "Mago v3/v5" e "Lobisomem v3/v5" (livre) e as "v4" por pontos, com J1 e J2 dentro; com o `--fichas-criacao`, a "Ficha XP R" de J1 (Vampiro v3/v5, concluída) e a "Ficha Aprovação R" de J1 (Mago v4, em criação). A revelação vale em qualquer estado da ficha, então as duas servem.
   - **A senha é a constante do `scripts/seed-roteiro.ts`** e não é escrita aqui nem nas evidências; os scripts de login a leem em tempo de execução.
   - **Convites:** este roteiro não gera convite. Um seed por plataforma, com 15 minutos entre eles (o seed aceita 13 convites).
3. **O que o seed não tem e o roteiro cria pela tela** (só texto fictício, em ASCII, porque o `adb input text` e o `idb ui text` não digitam acento):
   - **Notas do Narrador com texto:** N, em cada ficha usada, "Editar como narrador" → "Editar Notas do Narrador" → `SENTINELA-P16 nota de teste do roteiro` → "Salvar". No Lobisomem, a ficha da J1 é criada pela tela: "Lobisomem v3/v5" → Nova ficha → nome `Nota W R`;
   - **o ex-membro:** J2, em "Vampiro v3/v5", cria `Saida R` (só o nome); N escreve a sentinela e revela; J2 sai da crônica ("Sair da crônica"). Só no bloco web, porque não há convite para voltar;
   - **o NPC:** N, em "Vampiro v3/v5", cria um NPC `NPC R`, escreve a sentinela nas notas dele e põe a visibilidade em "Ficha".
   - O seed não ganha opção nova: tudo cabe na tela, e a escrita das notas faz parte do teste.
4. **Evidências:** no scratchpad, `p16d-<plataforma>-<ID>-<passo>.png`. Sem e-mail visível na captura. A sentinela pode aparecer na captura: é texto fictício.

### 11.b Web (Playwright, Chromium; WebKit onde indicado)

- **Script:** `<scratchpad>/p16d/web.mjs` com o `playwright` do `node_modules`, contra `http://localhost:8081` (Metro), com um contexto por conta (N, J1, J2). Reiniciar o Metro com `--clear` antes da rodada.
- **Viewports exatas:** `{ width: 390, height: 844 }` para J1 e J2 e `{ width: 1280, height: 800 }` para N; o U-11b também com N a 390.
- **WebKit:** U-11b e U-11c também em `webkit.launch()` (a folha, o Esc e o foco no Safari).
- **Seletores por papel e rótulo:**
  - `getByRole('tab', { name: 'Sobre' })`;
  - `getByRole('button', { name: /^Revelar Notas do Narrador a / })` e `getByRole('button', { name: 'Revelar notas', exact: true })`;
  - `getByRole('button', { name: 'Deixar Notas do Narrador privadas de novo' })`;
  - `getByText('Notas do Narrador · reveladas pelo narrador')`;
  - `getByRole('button', { name: 'Editar Notas do Narrador' })`.
- **O que o Jest não pega:** o painel da folha (`bottom-sheet-root > [aria-modal="true"]`) e o foco nele; o IndexedDB `tms-offline` lido por `page.evaluate`, procurando a sentinela em todas as chaves e valores; `context.setOffline(true)` para o recarregar sem rede; o corpo das respostas pelo `page.on('response')`.
- **Um `page.screenshot` por passo.**

### 11.c Android (AVD)

- **AVD:** `Pixel_3a_API_34_extension_level_7_arm64-v8a` (393 dp), com `-cores 4 -memory 3072 -no-snapshot` e `-gpu host`; APK do `assembleDebug` arm64, com `JAVA_HOME` no JBR do Android Studio.
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`. **Sem rede**, para o U-11h: parar a API no Mac (o `adb reverse` passa por fora do modo avião).
- **Larguras:** o rótulo "Notas do Narrador · reveladas: roteiro_jogador1 lê" e os botões são de layout: também `adb shell wm density 480` (360 dp) e `420` (411 dp), com `adb shell wm density reset` no fim.
- **Teclado de software:** `adb shell settings put secure show_ime_with_hard_keyboard 1` para escrever a nota.
- **Navegação:** `adb shell uiautomator dump /sdcard/ui.xml` e `adb pull`; achar o alvo pelo `content-desc` e tocar no centro do `bounds` com `adb shell input tap X Y`; `adb shell input keyevent 4` para o voltar do Android com a folha aberta. Reabrir o app do zero: `adb shell am force-stop com.tms.app` e `adb shell monkey -p com.tms.app 1`.
- **LogBox:** dispensar o banner antes de tocar perto do pé da tela.
- **Tempo** medido no emulador sob carga não é evidência; desligar o AVD antes do iOS. O AVD não tem TalkBack.

### 11.d iOS (simulador, com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, e iPhone 17, iOS 26.5.
- **Build Debug com "Sign to Run Locally"**, em `apps/frontend/ios`: sem assinatura, o app não loga (o keychain responde `-34018`). O app é `com.tms.app`.

  ```bash
  xcodebuild -workspace TMS.xcworkspace -scheme TMS -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath <scratchpad>/ios-dd CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build
  ```

  Depois: `xcrun simctl install <UDID> …/TMS.app` e `xcrun simctl launch <UDID> com.tms.app`. Reabrir do zero: `xcrun simctl terminate <UDID> com.tms.app` e `launch`.
- **Cliente fb-idb:** o venv `~/.venvs/idb-tms` já existe, fora do repositório, com `fb-idb` 1.7.7. Rodar `~/.venvs/idb-tms/bin/pip-audit` antes de usar; com vulnerabilidade, parar e registrar. Nunca no `package.json` nem no lockfile.
- **Companion:** `--companion-path /opt/homebrew/bin/idb_companion` vem antes do subcomando. Ele fica só local, no socket de domínio; no fim, `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` não mostra nada.
- **Navegação:** `idb ui describe-all --udid <UDID>`, com o driver escondendo o valor dos campos E-mail e Senha ([onda-4.md](onda-4.md) §11, item 7); tocar no centro do `frame`; `idb ui text`, `idb ui swipe`, `idb ui key` e `idb screenshot`.
- **Limites do idb:** não faz o gesto de borda (usar o "‹"); não digita fora do ASCII (a sentinela é ASCII); o teclado de software some depois do primeiro texto.

### 11.e Tabela por item

Três blocos, um seed por bloco. Em cada um, as duas contas ficam logadas ao mesmo tempo, em plataformas diferentes.

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| U-11a | Web 1280 (N) e web 390 (J1) | N, J1 | "Ficha XP R" → N escreve a sentinela; J1 abre a ficha → aba "Sobre" | J1 não tem bloco do narrador; o corpo do `GET /characters/:id` não tem a sentinela e traz `reveal.sections: []`; N vê "Notas do Narrador · privadas: o jogador não vê" e o botão "Revelar ao jogador" | `p16d-web-U-11a-1..2.png` | |
| U-11b | Web 1280 e 390 (Chromium e WebKit) | N | "Revelar ao jogador" → a folha → Esc; de novo → "Revelar notas" | A folha mostra a sentinela; o foco entra no painel e volta ao botão no Esc, sem requisição; ao confirmar, a folha sai e só depois aparece o toast; o rótulo passa a "reveladas: roteiro_jogador1 lê"; o editor diz "Reveladas: … lê o que você salvar aqui." | `p16d-web-U-11b-1..4.png` | |
| U-11c | Web 390 (Chromium e WebKit) | J1 | Recarregar a ficha → aba "Sobre" → Histórico | Bloco "Notas do Narrador · reveladas pelo narrador" com a sentinela, sem botão de editar; Histórico com "Notas privadas reveladas ao jogador · roteiro_narrador (narrador)", sem "Desfazer"; o IndexedDB `tms-offline` sem a sentinela | `p16d-web-U-11c-1..3.png` | |
| U-11d | Web 1280 (N) e web 390 (J1) | N, J1 | N "Deixar privadas"; J1 deixa a aba sem foco e volta | Toast "As notas voltaram a ser privadas. …"; em J1, o bloco some na rebusca; `/revealed` com `sections: []`; Histórico com "Notas voltaram a ser privadas" e sem linha de edição das notas | `p16d-web-U-11d-1..3.png` | |
| U-11e | Web 390 | J2 | `page.request` com a sessão de J2: `GET /characters/<Ficha XP R>/revealed` e `POST …/reveal` | 404 nos dois, sem corpo com a sentinela | `p16d-web-U-11e-1.txt` (status e corpo, sem cabeçalho de sessão) | |
| U-11f | Web 1280 (N) e web 390 (J2) | N, J2 | "Saida R": N revela; J2 lê; J2 sai da crônica; J2 abre a própria ficha | Antes de sair, J2 lê a sentinela; depois, a ficha abre em leitura, sem o bloco, e `/revealed` responde 404 | `p16d-web-U-11f-1..3.png` | |
| U-11g | Web 1280 (N) e web 390 (J1) | N, J1 | "NPC R" com visibilidade "Ficha": N procura o botão nas notas do NPC; J1 abre o NPC; N chama `POST …/reveal` no NPC pelo `page.request` | Sem botão de revelar no NPC; J1 (`viewer`) não vê as notas nem a sentinela no corpo; o `POST` do narrador responde 422 | `p16d-web-U-11g-1..2.png` | |
| U-11h | **Web 1280 (N) e Android 393 (J1)** | N, J1 | N revela as notas de "Ficha XP R"; J1 abre no AVD → "Sobre"; parar a API; `force-stop` e reabrir → "Sobre"; subir a API; N esconde; J1 volta ao app (foco) | J1 lê a sentinela com rede; reaberto sem rede, a ficha abre do cache com "Conecte-se para ler as notas reveladas." e sem a sentinela na tela nem no `dump`; depois de esconder, o bloco some na rebusca; reaberto sem rede de novo, nenhum bloco | `p16d-and393-U-11h-1..5.png` | |
| U-11i | Android 393, 360 e 411 dp (N) e web 390 (J1) | N, J1 | N, no AVD, abre "Nota W R" (Lobisomem) → "Sobre" → "Revelar ao jogador" → voltar do Android com a folha aberta; de novo → "Revelar notas"; J1 confere no web | O voltar fecha a folha sem revelar; a folha mostra a sentinela inteira, rolável; o rótulo e os botões cabem a 360 (quebram para baixo, sem corte); J1 lê no web | `p16d-and393-U-11i-1..2.png`, `p16d-and360-U-11i-3.png`, `p16d-and411-U-11i-4.png`, `p16d-web-U-11i-5.png` | |
| U-11j | **Web 1280 (N) e iOS SE (J1)** | N, J1 | "Ficha Aprovação R" (Mago, em criação): N revela no web; J1 no iOS → "Sobre"; terminar o app, parar a API e reabrir; subir a API; N esconde; J1 volta ao app | Como no U-11h: lê com rede; sem a sentinela reaberto sem rede; o bloco some depois de esconder | `p16d-iosSE-U-11j-1..4.png` | |
| U-11k | iOS 17 (N) e web 390 (J1) | N, J1 | N, no iOS, "Ficha XP R" → "Sobre" → "Revelar ao jogador" → "Revelar notas"; depois "Deixar privadas"; J1 confere no web | A folha e o toast no iOS, nada sob a Dynamic Island; o `AXLabel` do botão diz "Revelar Notas do Narrador a roteiro_jogador1"; o rótulo do bloco muda nos dois estados; J1 lê e depois perde o bloco | `p16d-ios17-U-11k-1..4.png`, `p16d-web-U-11k-5.png` | |
| U-11l | Web 390 (J1) e iOS SE (J1, logout) | J1 | Com a nota revelada, J1 faz logout no iOS e entra como J2 no mesmo simulador | J2 não vê a "Ficha XP R" nem o bloco; nada da sessão de J1 sobra | `p16d-iosSE-U-11l-1..2.png` | |

### 11.f Acessibilidade mínima

A árvore é o DOM no web, o `uiautomator dump` no Android e o `describe-all` no iOS.

- **O estado é texto, não só cor:** "privadas: o jogador não vê" e "reveladas: {jogador} lê" no rótulo e no nome acessível do bloco; o dono lê "reveladas pelo narrador".
- **Os botões dizem o que fazem e a quem:** "Revelar Notas do Narrador a {jogador}" e "Deixar Notas do Narrador privadas de novo" (no web, `aria-label`; no Android, `content-desc`; no iOS, `AXLabel`).
- **A folha de revelar recebe o foco** ao abrir e o devolve ao botão ao fechar, pelo Esc, pelo "Cancelar" e pelo voltar do Android (o contrato da `BottomSheet`).
- **O toast é anunciado** (`aria-live` no web). No AVD não há TalkBack, e o `describe-all` não expõe o anúncio: o anúncio do VoiceOver e do TalkBack fica para ouvir no aparelho, como na onda 4.
- **Sem rede, o botão** fica `aria-disabled`, tocável, e diz o motivo perto do toque.

### 11.g Limpeza

- **N deixa as notas privadas** em todas as fichas usadas, e o resultado registra.
- Parar a API e o Metro.
- Desligar o AVD (`adb emu kill`) e os simuladores (`xcrun simctl shutdown all`).
- `adb shell wm density reset` e `adb shell settings put secure show_ime_with_hard_keyboard 0`.
- Encerrar o `idb_companion`, sair do venv e conferir com `lsof` que nada escuta.
- **Convites:** este roteiro não gera nenhum. Os convites que o seed cria para N2 seguem a regra do roteiro da onda (revogados na limpeza da integração).
- Manter as capturas e o log do seed no scratchpad até a integração. Nada vai para o repositório.

### 11.h Quando uma plataforma não puder ser conferida

O resultado diz "não conferido" e o motivo, por exemplo:

- "o build do iOS falhou em …";
- "o emulador ficou ocupado sob carga, e a rebusca não foi observada";
- "o disco do app nativo é cifrado (SQLCipher): a ausência do texto foi conferida pelo comportamento sem rede, não pelo conteúdo do arquivo".

O passo fica para a integração ou para o roteiro antes do release. Nunca "ok" sem a evidência.
