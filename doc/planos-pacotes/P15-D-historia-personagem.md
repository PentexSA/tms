# P15-D · História do personagem na ficha: plano de implementação

> Plano · 2026-11-05 · base conferida: `onda/5-narrador-entrada-uso` em `05c5d7d`

Este plano implementa o pacote [P15-D da matriz de achados](../testes/2026-11-01/matriz-achados.md#p15-d), que aplica a decisão D-16. Ele foi posto na onda 4 em 03/11 (`960138b`), ficou fora dela ([onda-4.md](onda-4.md) §6, ponto 1, e §12.7) e entra na onda 5. O P16-D depende dele. Ao fim do pacote:

- a ficha do Vampiro, do Mago e do Lobisomem tem o campo **"História / Prelúdio"**, numa seção própria da aba Sobre, que o narrador da crônica e o dono da ficha leem;
- as Notas do Narrador continuam como estão: outra seção, privadas, e o servidor continua a não mandá-las ao dono;
- quando o narrador edita um texto que o jogador lê, o editor diz "O jogador lê este texto.", e o editor das Notas continua dizendo que elas são privadas;
- os três templates sobem uma versão (`vtm-v20` 1.10.0, `wta-w20` 1.8.0 e `mta-m20` 1.8.0), publicada pela migration `0024`, só de dados. Este pacote faz o aumento único de versão da onda 5.

É um pacote de decisão de produto, quase todo de template. O pacote não remove campo, não muda regra do jogo e não afrouxa limite, e o servidor continua a autoridade:

- nenhum texto passa das Notas do Narrador para o campo novo: nem pela migration, nem por botão. O narrador que quiser mover o prelúdio copia à mão;
- quem lê e quem escreve vem das `permissions` da seção, aplicadas pelo `stripRestricted` e pelo `canWrite` no servidor. O app só esconde o que o servidor já não manda;
- outro jogador da crônica, ex-membro, `viewer` de NPC revelado, narrador de outra crônica e quem não tem vínculo não leem a História;
- a ficha criada na versão anterior do template continua nela e não ganha o campo. Não há caminho de atualização de versão de ficha, e criar um é decisão nova (§3.6).

O ponto que a D-16 não fecha, quem escreve (o narrador, o dono ou os dois), vai ao PO com a recomendação (§2 e §9). O plano é escrito para as duas respostas principais, e a diferença entre elas é uma linha por template e alguns testes.

Todas as linhas citadas são do `05c5d7d` (a `main` depois do merge da onda 4, PR #51). A matriz cita o `1db3db9`. Onde a causa provável da matriz não vale, a §3.0 diz.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md): "Decisões de produto" (D-16, D-17), "Como executar" (com "Decisão revista" e "Ondas empilhadas"), §P15-D (na "Onda 4"), "Onda 5", §P16-D, a linha R-09 (§P09-C) e as linhas T-79 e T-84 (§P13) | Item, decisão, "PR local", critério de saída da onda e os pacotes vizinhos |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §1 (C1) e §4.1 (passo 14); [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) §5 ("Observações": Notas do Narrador) | O contexto do R-09. O U-10 não está nos relatórios: veio do feedback do narrador de 03/11/2026, no Android |
| Notas: [narrador-app](../testes/2026-11-01/notas/narrador-app.md) (NA-17) e [narrador-web](../testes/2026-11-01/notas/narrador-web.md) (NW-25) | Os narradores que escreveram nas Notas achando que o jogador leria (R-09): o mesmo mal-entendido que o U-10 resolve com um campo próprio |
| [plano-v0.md](../plano-v0.md) §4 (matriz de AuthZ); [plano-v3.md](../plano-v3.md) Etapas 2, 3 e 7; [plano-v5.md](../plano-v5.md) (NPC oculto, revelação e `viewer`) | Quem tem papel na ficha: o outro membro não tem; o ex-membro só lê a própria; o `viewer` lê só as seções públicas do NPC revelado |
| [arquitetura-motor-de-ficha.md](../arquitetura-motor-de-ficha.md) §5.3, §8.3 e §11 ("Migração de fichas entre versões do template") | O app antes do template; a ficha guarda a versão em que nasceu; a migração de ficha é ponto de extensão futuro |
| [design/templates/README.md](../../design/templates/README.md) §3 (l.109, `longText`), §4 (l.338, l.361-366: permissões) e §11 (l.630) | O contrato que o campo novo usa sem mudar |
| [onda-4.md](onda-4.md) §4.3, §4.7, §6 (pontos 1, 3 e 9), §8 (perguntas 3 e 4), §11 e §12.7; [P10-D](P10-D-ajuda-contextual-mago.md) §3.10 e o commit `9d1dcb2` | A versão dos templates (um aumento por onda, migration só de dados, imutabilidade, "Atualize o app"), o modelo do commit de versão e o que a integração da onda 4 ensinou |
| [P09-C](P09-C-narrador-mesa.md) §3.1 (R-09) e [P11](P11-bastidores-npc.md) | O rótulo das Notas privadas; o NPC oculto, a revelação e o `viewer` |
| [onda-1.md](onda-1.md) a [onda-3.md](onda-3.md) §6 | Pontos para o PO das ondas anteriores, todos em aberto |

## 1. Objetivo e itens

**Objetivo (matriz).** A ficha tem um lugar para a história do personagem (prelúdio) que narrador e jogador leem, separado das Notas do Narrador privadas.

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| U-10 | média | O narrador escreveu o prelúdio de uma ficha de Mago (cerca de 3.700 caracteres) nas Notas do Narrador, que o jogador não recebe, porque a ficha não tem outro lugar para a história do personagem | As Notas são a seção `storyteller` de cada template, com `read` e `write` só do narrador: `vtm-v20.json:933-940`, `mta-m20.json:994-1001` e `wta-w20.json:1213-1220`. O campo `storytellerNotes` é `longText` de até 4000 (`vtm-v20.json:762-766`, `mta-m20.json:770-774`, `wta-w20.json:1008-1012`). O único outro texto longo da aba Sobre são as "Notas" do jogador (`notes`, na seção `about`: `vtm-v20.json:926-932`, `mta-m20.json:987-993`, `wta-w20.json:1197-1203`). O servidor tira as Notas do Narrador de toda resposta ao dono (`stripRestricted`, `packages/sheet-core/src/permissions.ts:76-91`) |

## 2. Decisões aplicadas

| Decisão | O que diz | Como o código a acomoda |
|---|---|---|
| D-16 (U-10) | Campo "História / Prelúdio" no template dos três sistemas, lido por narrador e jogador e separado das Notas do Narrador, que continuam privadas | Um campo `longText` novo (`backstory`) numa seção nova (`backstory`, zona `lore`, layout `text`), com `permissions.read: ["owner", "storyteller"]`, em cada template (§3.1). A leitura e a escrita vêm do `canRead`/`canWrite` que já existem, e o `stripRestricted` aplica no servidor (§3.2). Nenhuma chave nova no contrato |
| D-17 (U-11) | Revelar uma nota privada fica para depois, quando houver a necessidade | Fica com o P16-D. Este plano só registra um dado para a decisão do PO: a ficha do U-10 já existe e não ganha o campo novo (§3.6), e a revelação de nota resolveria esse caso, porque é estado da API e não do template |

**O que a D-16 não diz, ou diz de um jeito que o código não aplica como está escrito:**

1. **Quem escreve.** A D-16 diz quem lê, não quem escreve. A matriz deixa a pergunta para o plano ("o jogador edita ou só lê: fechar no plano do pacote"). **Vai ao PO** (ponto 1 da §9.1), com a recomendação "os dois escrevem". As três saídas estão na §3.2.
2. **"Narrador e jogador".** No código, "jogador" é o **dono** da ficha (`owner`). Outro jogador da crônica não tem papel na ficha alheia e recebe 404 (`apps/api/src/authz.ts:9-12`, `:100-118`; plano-v3, Etapa 2). O `viewer`, o membro diante de um NPC revelado por inteiro, também fica fora: a seção nova restringe a leitura a dono e narrador. Se o PO quiser que os jogadores leiam a História de um NPC revelado, é acrescentar `viewer` ao `read` (ponto 4 da §9.1). A recomendação é não acrescentar.
3. **"Sem migration" (matriz, "Conversa com" e recomendação do U-10).** Não vale desde a onda 4. Uma versão nova de template do produto ganha a sua migration só de dados (`packages/db/src/migrations/0020_product_templates.ts:5-9`, [onda-4.md](onda-4.md) §4.7). Este pacote traz a `0024`, sem mudança de schema (§3.7).
4. **"`wod-w20`".** O template do Lobisomem é o `wta-w20` (`design/templates/wta-w20.json:3`). A matriz escreve "wod-w20" por engano.

**Fica fora deste pacote, e com quem fica:**

- **Atualizar uma ficha para a versão nova do template** (onda-4 §6, ponto 9; arquitetura §11): decisão nova do PO, com as saídas e os custos na §3.6.
- **Copiar as Notas do Narrador para a História** por migration, botão ou sugestão: não entra em nenhuma forma, porque seria expor ao jogador o que era privado. O narrador copia à mão (§3.5).
- **Revelar a Nota do Narrador ao jogador** (U-11, D-17): P16-D.
- **Os textos do Sobre editáveis no modo Editar** (T-84): P13. A edição da História pelo dono depende dele (§3.4).
- **A Descrição da crônica em leitura** (U-09, D-15): P14-D. Os dois pacotes falam de texto que o jogador lê, e o aviso do editor usa a mesma forma (§8.4).

**Pontos das ondas anteriores que tocam este pacote** (continuam abertos, nenhum é decidido aqui):

- [onda-4.md](onda-4.md) §6, **ponto 3** (a ordem do release: o app na loja antes da versão nova dos templates): §3.7. Como a onda 4 foi à produção não está no repositório, e vai como pergunta ao usuário (§9.3);
- [onda-4.md](onda-4.md) §6, **ponto 9** (fichas na versão anterior, sem caminho de atualização): §3.6;
- [onda-4.md](onda-4.md) §8, **pergunta 3** (a validação dentro da migration; §11, "Fica para decisão"): a `0024` repete o padrão da `0023`, sem validar dentro dela, e a pergunta segue para decisão (§9.2, pergunta 3);
- [onda-4.md](onda-4.md) §8, **pergunta 4** (quem faz o commit de versão): §3.7.

## 3. Desenho por item

### 3.0 O que o código, o template e as plataformas fazem hoje

- **As permissões são por seção, não por campo.** O `schema.json` as define em `sections[].permissions` (`design/templates/schema.json:1626-1645`). Sem `permissions`, dono, narrador e `viewer` leem, e dono e narrador escrevem (`packages/sheet-core/src/permissions.ts:17-18`). Um campo citado por várias seções obedece à mais restrita (`:42-52`). Por isso a História precisa de uma seção própria: na seção `about`, que não tem `permissions`, o `viewer` de um NPC revelado a leria.
- **Já existe uma seção com `read` de dono e narrador:** a `experience` (`vtm-v20.json:913-925`, com `permissions` em `:917`; `mta-m20.json:971`; `wta-w20.json:1188`), com `write` só do narrador. A seção nova segue o mesmo padrão, sem regra nova.
- **Quem tem papel na ficha** (`apps/api/src/authz.ts:73-131`):
  - ficha de jogador: `owner` para o dono e `storyteller` para o narrador da crônica; mais ninguém;
  - NPC: `storyteller` para o narrador; `viewer` para o membro, se o NPC não estiver oculto;
  - sem papel: 404.
- **O ex-membro** continua `owner` da própria ficha e a lê, mas a política o trata como fora da crônica e recusa a escrita (`NOT_MEMBER`: `apps/api/src/sheets/policy.ts:118-147`; `packages/sheet-core/src/policy.ts:66-89`).
- **Toda saída de ficha passa pelo `stripRestricted`** com os papéis resolvidos no banco:
  - `apps/api/src/sheets/routes.ts:393` (lista), `:519` (`viewer`) e `:562` (ficha);
  - `apps/api/src/sheets/events.ts:251`, `:286` (conflito) e `:420` (lote);
  - `apps/api/src/rolls/routes.ts:319` e `:416`;
  - `apps/api/src/chronicles/table.ts:148` (Mesa, só o narrador).

  O Histórico tira os caminhos que o papel não lê (`events.ts:603`), e `text`/`longText` entram nele sem conteúdo (`events.ts:104-106`; migration `0011`).
- **A aba Sobre é a zona `lore`** (`packages/sheet-core/src/compile.ts:97`), e as seções de layout `text` são desenhadas pelo `TextLayout` (`apps/frontend/sheet/layouts/TextLayout.tsx:15-58`). Ele mostra o rótulo e o texto em `<Text>`, sem HTML, e põe "privadas: o jogador não vê" quando o narrador olha um campo que o dono não lê (`:33-37`; `sheet/storyteller/privacy.ts:9-20`).
- **O `TextLayout` só lê, em todo modo.** Ele não usa o `FieldSlot`, então nunca desenha o editor (`TextEditorRow`) que os outros layouts usam no Editar e na Criação (`apps/frontend/sheet/FieldSlot.tsx:19-55`; `sheet/views/index.ts:47-48`). Por isso **nenhum texto do Sobre é editável no app hoje**, nem pelo dono nem pelo narrador. É a causa do T-84 (P13), em todos os sistemas e plataformas, e não só no V20 e no Android, como a matriz registra.
- **As Notas do Narrador só se escrevem pela barra do narrador.** O `storytellerOnlyText` lista os textos que o narrador escreve e o dono não (`sheet/storyteller/StorytellerBar.tsx:34-41`). A barra mostra um botão "Editar <rótulo>" por campo (`:92-115`), que abre a `TextFieldSheet` com o aviso de privado (`:131-195`).
- **O `longText` no servidor:**
  - o `validateSheet` confere só o tipo e o tamanho, pelo `maxLength` do template (`packages/sheet-core/src/validate/sheet.ts:66-69`, `:112-114`);
  - o lote tem teto de 64 KB (`events.ts:40`, `:210-215`);
  - o `schema.json` aceita `maxLength` até 20000 (`:1282-1298`).
- **"Atualize o app" só aparece quando o core do app não compila o template:**
  - o `compileTemplate` lança `UnsupportedTemplateError` para template inválido ou com nome que o core não conhece (`packages/sheet-core/src/compile.ts:111-131`);
  - o app o troca por `null` (`apps/frontend/sheet/data.ts:142-156`) e mostra a tela de `UnsupportedTemplate.tsx:43-67`;
  - as chaves que o core aceita por nó estão em `packages/sheet-core/src/validate/template.ts`, e as da seção em `:144-160`.

  A versão do template, sozinha, não dispara o aviso.
- **A publicação:**
  - o `publishProductTemplates` grava os arquivos de `design/templates` na ordem de `PRODUCT_TEMPLATES` (`vtm-v20`, `mta-m20`, `wta-w20`) e recusa a versão já gravada com outro conteúdo (`packages/db/src/templates.ts:11`, `:101-115`);
  - a `0023_templates_onda4.ts` é só a chamada dele, sem `down`, registrada em `packages/db/src/migrations.ts:24` e `:54`;
  - a última migration é a `0023`, então **a próxima é a `0024`**;
  - num banco novo, a `0020` grava os arquivos de hoje (`0020_product_templates.ts:10-21`), e as seguintes só confirmam. **Um banco novo não tem a versão anterior de nenhum template**, o que importa para o roteiro (§11.a).

**Onde a causa provável da matriz não vale:**

| Matriz | Na ponta |
|---|---|
| "Arquivo provável: `TextLayout.tsx`" | O campo novo aparece no `TextLayout` sem mudança nele: o layout já desenha qualquer seção `text`. O código que muda é o aviso nos editores (§3.3). O `TextLayout` só muda pelo T-84, no P13 |
| "Sem migration: a estrutura vem de `trait_templates`" | A estrutura vem de `trait_templates`, mas a versão nova chega pela migration só de dados (§2, item 3) |
| "lido por narrador e jogador" | Pelo dono (§2, item 2) |
| "`wod-w20`" | `wta-w20` |
| T-84 (P13): "só no V20, Android" | Vale para todo texto do Sobre, nos três sistemas e nas três plataformas (acima). Fica registrado para o P13 |

### 3.1 U-10 · O campo e a seção no template (o que muda no contrato: nada)

O mesmo campo e a mesma seção nos três templates. Os textos são rascunho do time e não citam livro.

```json
"backstory": {
  "type": "longText",
  "label": "História / Prelúdio",
  "maxLength": 8000,
  "help": "A história do personagem antes da crônica. O jogador e o narrador leem."
}
```

```json
{
  "id": "backstory",
  "zone": "lore",
  "title": "História",
  "layout": "text",
  "fields": ["backstory"],
  "permissions": { "read": ["owner", "storyteller"] }
}
```

- **Se o PO decidir "só o narrador escreve"**, a seção ganha `"write": ["storyteller"]`, e o `help` passa a "A história do personagem, escrita pelo narrador. O jogador lê." (§3.2).
- **Onde entra:**

  | Template | Campo (em `fields`) | Seção (em `sections`) | Ordem na aba Sobre |
  |---|---|---|---|
  | `vtm-v20` | depois de `notes` (`:761`) | depois de `about` (`:926-932`) | Sobre · **História** · Narrador |
  | `mta-m20` | depois de `notes` (`:769`) | depois de `about` (`:987-993`) | Foco · Sobre · **História** · Narrador |
  | `wta-w20` | depois de `notes` (`:1007`) | depois de `about` (`:1197-1203`), antes de `battle-scars` | Sobre · **História** · Cicatrizes de batalha · Narrador |

- **O id é `backstory`, não `history`.** No D&D e no CoC, `history` é uma perícia (`dnd5e-2014.json:262`, `coc7e.json:236`). Um id que não colide deixa a mesma seção servir aos outros sistemas (§6).
- **O tamanho, 8000** (as Notas do Narrador têm 4000):
  - cabe o prelúdio do U-10 (cerca de 3.700) e tudo o que estiver nas Notas, se o narrador o copiar;
  - deixa espaço para a história crescer na crônica;
  - um lote com `from` e `to` de 8000 caracteres cada fica abaixo do teto de 64 KB do lote, mesmo com acentos (2 bytes cada em UTF-8);
  - a alternativa, 4000 como as Notas, está na §9.2 (pergunta 1).
- **O título da seção e o rótulo do campo.** "História" no título e "História / Prelúdio" no rótulo, como "Narrador" e "Notas do Narrador" na seção vizinha. O nome acessível do bloco começa pelo rótulo ("História / Prelúdio, …"; `TextLayout.tsx:39-46`).
- **O `help` e o E2E.** O `help` não usa as palavras "Notas do Narrador". Três specs conferem que o jogador não vê esse texto em lugar nenhum da ficha (`sheet.spec.ts:79`, `journey.spec.ts:258`, `table.spec.ts:143`), e uma frase de ajuda com elas os quebraria. O "?" só aparece na Criação, no Editar e na Nova ficha (onda-4 §11, pergunta 11), e o campo não está na Nova ficha, porque não é da identidade.

**O que muda no contrato do template (`schema.json`, `validateTemplate`, `validate.mjs`, `publicationIssues`): nada.**

- O campo usa um tipo que já existe (`longText`, `schema.json:1282-1298`) e chaves que já existem (`label`, `maxLength`, `help`).
- A seção usa as chaves de hoje (`validate/template.ts:144-160`) e papéis da lista fechada (`schema.json:366-369`).
- O `help` passa pela regra da publicação da onda 4: até 400, uma linha, sem link, `safeText`.
- A paridade dos quatro validadores não muda. Os testes provam que os três arquivos novos passam por todos eles, sem tocar no código de validação:
  - `apps/api/src/templates/__tests__/publish.test.ts:557-558` ("o arquivo que a migration grava passa no schema, no contrato e na publicação");
  - o `node design/scripts/build.mjs`, que o CI roda e confere com `git diff --exit-code` (`.github/workflows/ci.yml:117-120`).
- **Consequência para o app nativo:** o core da onda 4 compila a versão nova. É a diferença para a onda 4, cujas chaves novas o app antigo recusava (§3.7).

### 3.2 U-10 · Quem lê e quem escreve (AuthZ)

A leitura é a mesma nas duas respostas do PO. A escrita depende da resposta.

| Ator | Lê a História | Escreve: A, "os dois" (recomendada) | Escreve: B, "só o narrador" |
|---|---|---|---|
| Narrador da crônica | sim (ficha, Mesa, Histórico sem conteúdo) | sim, em todo estado (`writePolicy`: o narrador escreve sempre) | sim |
| Dono, membro | sim | em `creating`, e em `active` sem trava (texto é classe `edit`, `classify.ts:186`). Em `pending`, 403 "aguarda aprovação". Com a trava, 403 `SHEET_LOCKED` | não: 403, como as Notas hoje (`authz.test.ts:266-281`) |
| Dono que saiu da crônica (ex-membro) | sim, a própria ficha (plano-v3, Etapa 7) | não: 403 `NOT_MEMBER` | não |
| Outro jogador da crônica | não: 404 na ficha | não: 404 | não: 404 |
| Ex-membro, ficha de outra pessoa | não: 404 | não | não |
| `viewer` (NPC revelado por inteiro) | não: o `stripRestricted` tira o campo | não: o `viewer` nunca escreve (404 em `events.ts:217`) | não |
| NPC oculto | só o narrador; os jogadores recebem 404 | só o narrador | só o narrador |
| Narrador de outra crônica, sem vínculo, anônimo | não: 404 (401 sem sessão) | não | não |
| Narrador anterior, depois da transferência da narração | não: perde o papel na ficha de jogador | não | não |

**As três saídas para "quem escreve" (ponto 1 da §9.1):**

| Saída | O que muda | Custo | A favor | Contra |
|---|---|---|---|---|
| **A. Os dois (recomendada)** | Nada além da §3.1: o `write` padrão é dono e narrador | P. Mas **a edição pela tela depende do T-84** (P13), porque o `TextLayout` não desenha editor (§3.0). Sem o P13, ninguém edita a História pela tela | A história é do personagem, e o prelúdio se faz em conjunto. É o mesmo padrão das Notas do jogador e da Citação, sem regra nova. O Histórico assina quem mudou, e o narrador pode desfazer | O jogador pode apagar o texto do narrador. O Histórico mostra o lote, e o "Desfazer" do narrador o reverte |
| **B. Só o narrador** | `"write": ["storyteller"]` na seção, e o `help` da §3.1 | P, sem depender do P13: a barra do narrador já lista o campo pelo `storytellerOnlyText` e mostra "Editar História / Prelúdio" | É o pedido do U-10, ao pé da letra: o narrador escreve, o jogador lê. O texto do narrador fica como ele escreveu | O jogador não escreve a história do próprio personagem. A barra do narrador ganha um segundo botão (medir a 360 e a 390, §11) |
| C. Só o dono | `"write": ["owner"]` | P, com o T-84 | — | O narrador do U-10 não poderia escrever o prelúdio: não atende ao pedido. Não recomendada |

**Por que A:**

- é o padrão do template (nenhum `write`);
- generaliza sem regra: em qualquer sistema, a história do personagem é do jogador, e o narrador colabora;
- a escrita do narrador continua assinada no Histórico (`by_role`, `events.ts:386`).

**A dependência do T-84 decide a ordem de merge** (§8.4). Com a A, o P15-D entra depois do P13. Se o P13 não entrar nesta onda, a A deixa o campo só em leitura para os dois, e a B passa a ser a única que funciona sozinha.

### 3.3 U-10 · O editor diz quando o jogador lê o texto

O R-09 fez o editor das Notas dizer que elas são privadas. Com um texto privado e um público na mesma aba, o editor do texto público precisa dizer o contrário. A matriz pede isto no P14-D: "o aviso de privado × público precisa ficar claro nos dois editores".

- **A regra é genérica, sem nome de campo:** quando quem edita é o narrador, e não o dono, e o dono lê o campo, o editor de `text`/`longText` diz **"O jogador lê este texto."**
  - O leitor de tela o ouve com o campo, como o aviso das Notas: `accessibilityHint` no app e `aria-describedby` no web, apontando o texto visível.
  - O nome do campo continua o rótulo.
- **Onde:**
  - `apps/frontend/sheet/storyteller/privacy.ts`: `readByOwner(model, id)` (`canRead(model, id, ['owner'])`) e a frase `SHARED_NOTE_SHEET`, ao lado de `hiddenFromOwner` e `PRIVATE_NOTE_SHEET`;
  - `sheet/storyteller/StorytellerBar.tsx` (`TextFieldSheet`, `:131-195`): o aviso entra quando o campo não é privado. Isso acontece na saída B (§3.2);
  - `sheet/evolve/TextEditorRow.tsx`: o mesmo aviso na folha do editor, quando o papel é só `storyteller`. Isso acontece na saída A, com o T-84, e também na Citação e nas Notas do jogador quando o narrador as edita, o que é verdade e ajuda.
- **O dono não recebe aviso:** o narrador lê toda a ficha, e repetir isso em todo texto seria ruído.
- **A Leitura não muda:** a legenda "privadas: o jogador não vê" das Notas continua, e a História não ganha marca na legenda (pergunta 5 da §9.2).

### 3.4 U-10 · Editar a História pela tela

| Saída | Quem edita e onde | Depende de |
|---|---|---|
| A | O dono no Editar (e na Criação, em `creating`), na aba Sobre, pelo `TextEditorRow` que o T-84 põe no `TextLayout`. O narrador, pelo "Editar como narrador" → Editar → Sobre | T-84 (P13) |
| B | Só o narrador, pelo botão "Editar História / Prelúdio" da barra do narrador (o mesmo caminho das Notas). O dono lê | Nada. O `storytellerOnlyText` acha o campo pelas permissões |

- O texto é salvo por um lote comum (`POST /characters/:id/events`).
- A escrita dos dois ao mesmo tempo cai no conflito de versão da ficha (P03-C), que já trata `longText`. A resposta do conflito passa pelo `stripRestricted` (`events.ts:286`), e os dois leem o campo.
- O `TextArea` respeita o `maxLength` do template, o mesmo que o servidor aplica.

### 3.5 U-10 · Nada passa das Notas do Narrador para a História

- **A `0024` não toca em ficha.** Ela só chama o `publishProductTemplates`, que grava em `game_systems` e `trait_templates` (`templates.ts:51-99`). Um teste prova que nenhum `characters.sheet_data` nem `template_version` muda (§4.1).
- **Sem atalho.** Nenhum botão "Copiar das Notas", nenhuma sugestão e nenhum texto inicial vindo das Notas. O campo nasce vazio em toda ficha nova.
- **O narrador copia à mão,** pelo editor das Notas: selecionar, copiar e colar no editor da História. O `<Text>` da Leitura não é selecionável no app nativo, mas o `TextArea` do editor é.
  - Na saída A, esse caminho só existe com o T-84.
  - Na B, ele existe pela barra do narrador.
  - O roteiro confere o copiar e colar no Android (§11).
- **O texto do U-10, em produção, não é lido, copiado nem movido** por este pacote. A ficha dele continua na versão anterior (§3.6).

### 3.6 U-10 · A ficha que já existe e as saídas

**O que acontece.** A ficha do U-10 (Mago) nasceu antes de 03/11, numa versão anterior do `mta-m20`. A ficha guarda a versão em que nasceu (`apps/api/src/sheets/routes.ts:278`), e o modelo é buscado por ela (`:372`). Por isso, com o P15-D em produção:

- **as fichas novas** dos três sistemas nascem com a História;
- **a ficha do U-10 e todas as fichas criadas antes** continuam sem ela. Abrem no app novo, sem "Atualize o app", e ganham o que é código (o aviso no editor, o T-84 do P13), mas não o campo, que é dado do template;
- **para o narrador que pediu:** a mudança não aparece na ficha que motivou o pedido. O prelúdio continua nas Notas do Narrador, privado, e o jogador continua sem lê-lo pelo app.

**As saídas e o custo de cada uma** (ponto 2 da §9.1; nenhuma é decidida aqui):

| # | Saída | Custo de desenvolvimento | Custo para o narrador e o jogador | Riscos |
|---|---|---|---|---|
| 1 | **Aceitar: a História só nas fichas novas** | Zero | O narrador da ficha antiga continua sem o campo. Pode passar o texto ao jogador fora do app | Nenhum técnico. O pedido do U-10 fica sem resposta para a ficha dele |
| 2 | **Contorno: o narrador copia o prelúdio para as "Notas" do jogador** (seção `about`, que o dono e o narrador leem e escrevem) | Zero neste pacote. Depende do T-84 (P13), porque hoje o Sobre não é editável pela tela | Copiar à mão. As "Notas" são do jogador e ficam misturadas (limite 4000; o prelúdio do U-10 cabe, com pouca folga) | O jogador pode apagar o texto. O Histórico registra. É um contorno, não o campo da D-16 |
| 3 | **Revelar a Nota do Narrador** (P16-D, D-17) | M, mais o `/security-review` (P16-D) | O narrador tira os segredos da nota antes de revelá-la, ou revela tudo | É estado da API, não de template, então vale para a ficha antiga. Dá ao PO um caso concreto de "necessidade" para a D-17 |
| 4 | **Atualizar a versão de uma ficha** (uma ação nova, por ficha ou em lote; arquitetura §11: `migrate[de → para](sheet)` no core, rodando no servidor) | G: função pura por par de versões nos três sistemas; validar a ficha contra o template novo; repetir o `checkCreation`/`creationFreeze` onde a regra mudou (a onda 4 mudou regras da criação do W20); quem pode atualizar (o narrador? o dono?); Histórico; rota nova com AuthZ; testes; `/security-review` | Um toque, e a ficha ganha tudo o que a versão nova traz | O maior, porque mexe em todas as fichas de produção. Um recorte menor é atualizar só quando a versão nova só acrescenta campos e seções, sem mudar regra (a 1.10.0 seria um desses casos). Ainda é M a G, e decidir o que é "só acrescenta" é regra nova |
| 5 | **Refazer a ficha** na versão nova, pela tela | Zero | Alto: refazer a ficha inteira, perdendo o Histórico e o extrato de XP | Perda de dado da mesa. Não recomendada |
| 6 | Trocar a versão da ficha direto no banco de produção | — | — | **Não recomendada nem planejada:** passa por fora da validação, da AuthZ e do Histórico, e é alteração de dado de produção |

**Recomendação:** a saída 1, com o contorno 2 oferecido ao narrador quando o P13 estiver em produção, e a saída 4 registrada como item futuro (por exemplo, no `proximas-features.md`, pelo P01-D), sem entrar nesta onda. A saída 3 é a decisão da D-17 e fica com o P16-D.

### 3.7 Versão dos templates, publicação e o commit único da onda

**As versões, conferidas na ponta:**

| Template | Hoje (`05c5d7d`) | Na onda 5 | Quem muda o conteúdo |
|---|---|---|---|
| `vtm-v20` | 1.9.0 (`vtm-v20.json:7`) | **1.10.0** | P15-D (campo e seção); P13 e P16-D, se mudarem template (abaixo) |
| `wta-w20` | 1.7.0 (`wta-w20.json:7`) | **1.8.0** | idem |
| `mta-m20` | 1.7.0 (`mta-m20.json:7`) | **1.8.0** | idem |

- **Minor:** o conteúdo é aditivo, e o contrato não muda.
- **A migration:** `packages/db/src/migrations/0024_templates_onda5.ts`, cópia da `0023` (só `publishProductTemplates(db)`, `down` vazio), registrada em `packages/db/src/migrations.ts`. É só de dados, sem mudança de schema, sem `codegen`.
- O D&D, o CoC e o Fate não sobem: não são publicados (`apps/api/src/templates/published.ts`).

**Outros pacotes da onda 5 que podem mexer em template** (conferido no código; a decisão é de cada plano):

- **P13, T-79** ("Força de Vontade" na lista de Atributos dos Dados). No W20, o slot `attribute` junta as seções `attributes` e `play` (`wta-w20.json:1234-1239`: `"from": ["attributes", "play"]`), e a FdV está na `play`. O V20 só tem `attributes` (`vtm-v20.json`, `roll.slots`), e o M20 junta `attributes` e `spheres` (`mta-m20.json:1014-1019`).
  - Separar pode ser só de UI: o `PoolOption` já traz o `group` (`apps/frontend/sheet/dice/DiceSheet.tsx:314`), e a lista pode ganhar um título por seção. Nesse caso, sem template.
  - Se o P13 preferir mudar o template (outro slot ou outro `from`), é conteúdo sem chave nova, e entra no mesmo aumento.
- **P16-D (U-11).** "Revelar ao jogador" pode ser estado da API (por ficha) ou mudar as `permissions` das Notas. Se mudar só o valor das `permissions`, é conteúdo e entra no mesmo aumento. **Se criar uma chave nova no contrato** (por exemplo, uma marca de "revelável" na seção), o core da onda 4 a recusa, e a versão nova passa a dar "Atualize o app" no app nativo antigo (abaixo). Recomendação para o P16-D: revelar como estado da API, sem chave nova.
- P09-D, P12, P14-D e P01-D não mudam template.

**Quem faz o commit de versão** (onda-4 §8, pergunta 4, aplicada na onda 4 como "o fim da branch do pacote"):

- **Proposta:** o último commit da branch do P15-D, depois do rebase dela sobre a onda com o P13. Se o P16-D também mudar template, o commit vai para o fim da branch do P16-D, que entra depois do P15-D. É a regra da onda 4: o commit fica no fim da branch do último pacote que muda template, na ordem de merge.
- **O que o commit traz** (a lição A2: tudo o que entra, por arquivo):
  - `design/templates/vtm-v20.json`, `mta-m20.json` e `wta-w20.json`: o `templateVersion` de cada um;
  - `packages/db/src/migrations/0024_templates_onda5.ts` e o registro em `packages/db/src/migrations.ts`;
  - `packages/db/src/__tests__/migrations.test.ts`:
    - um `describe('0024: as versões da onda 5')`, cópia do da `0023` (`:676-779`), com as versões derivadas dos arquivos e o caso "a 0024 não toca nenhuma ficha" (§4.1);
    - o caso "descer a 0023" (`:761-779`) passa a esperar `['0024_templates_onda5', '0023_templates_onda4']` ao descer até a `0022`;
  - `apps/api/src/templates/__tests__/publish.test.ts`:
    - o `beforeProductTemplates` (`:23-31`) deixa a `0024` de fora também;
    - `:186`, `:198` e `:229` passam a 1.10.0;
    - o caso "uma versão nova convive" (`:234-246`) monta a versão seguinte derivada da atual (1.11.0), e o comentário da ordem de texto muda, porque `'1.10.0'` e `'1.11.0'` já saem em ordem;
    - `:508-517` e `:537-543` passam às versões novas;
  - `apps/api/src/__tests__/characters.test.ts` (`:88`, `:99`, `:110`, `:322`, `:456`, `:466`, `:474-475`), `mage.test.ts:90` e `werewolf.test.ts:98`;
  - `packages/sheet-core/src/__tests__/compile.test.ts:42-43` e `:238-240`;
  - `design/telas/dados.js`, regenerado pelo `node design/scripts/build.mjs` (o CI confere com `git diff`).

**O que acontece com cada ficha e cada app:**

| Caso | O que acontece |
|---|---|
| Web | O bundle e a API saem no mesmo deploy (`deploy/render/start.sh:20` roda as migrations antes de subir): sem "Atualize o app" |
| App nativo da onda 4 (core que conhece o contrato da 1.9.0) e ficha nova da 1.10.0 | **Abre.** O campo e a seção usam só tipos e chaves que esse core conhece (§3.1). A História aparece em leitura. Na saída B, o narrador a edita pela barra, sem o aviso da §3.3 |
| App nativo anterior à onda 4 e ficha nova | "Atualize o app", mas por causa das chaves da onda 4 (`recommend`, `catalogDefaults`, `creation.advice`), não do P15-D |
| App nativo da onda 4, se o P13 ou o P16-D puserem chave nova no contrato | "Atualize o app" em toda ficha nova dos três sistemas, até a loja ter o app novo (onda-4 §6, ponto 3) |
| Ficha criada na versão anterior | Continua nela, sem a História (§3.6) |
| App novo e template antigo | Abre, sem a seção |

**A ordem do release** (onda-4 §6, ponto 3, em aberto).

- A `0024` roda no deploy da API. Se o P13 e o P16-D não puserem chave nova, a janela de "Atualize o app" desta onda é só a de quem ainda tiver um app anterior à onda 4.
- **Como a onda 4 foi à produção** (a loja antes ou depois da `0023`, ou se o app nativo está na loja) **não está no repositório**. Vai como pergunta ao usuário (§9.3), e a resposta decide se a `0024` pode ir no deploy da API ou espera a loja.
- As saídas da onda 4 continuam: segurar a migration até a loja; aceitar a janela; publicar pelo `templates:publish` manual depois da loja.

**A validação dentro da migration** (onda-4 §11, pergunta 3): segue para decisão. A `0024` repete a `0023` sem validar, e o teste da API que passa cada arquivo pelo schema, pelo contrato, pela publicação e pelo `compileTemplate` (`publish.test.ts:557-558`) cobre os arquivos novos. Não é resolvida aqui.

## 4. Testes

### 4.1 Um teste de regressão por item (falha no `05c5d7d`, passa depois)

| Item | Teste | Onde | Ferramenta |
|---|---|---|---|
| U-10a | Nos três templates do produto, `backstory` existe, é `longText` de até 8000 e está numa seção da zona `lore`. `canRead` é verdadeiro para `owner` e `storyteller` e falso para `viewer`. `canWrite` segue a saída do PO: A, dono e narrador; B, só o narrador. O `storytellerNotes` continua com `hiddenFromOwner` | `packages/sheet-core/src/__tests__/permissions.test.ts` | Bun |
| U-10b | O `stripRestricted` com `['viewer']` tira `backstory` e mantém os campos de `about`. Com `['owner']`, mantém `backstory` e tira `storytellerNotes` | `packages/sheet-core/src/__tests__/permissions.test.ts` | Bun |
| U-10c | **Matriz de AuthZ, nos três sistemas** (`MATRIX_SYSTEMS`): o cenário grava uma marca única na História (`SHARED`) e a de hoje nas Notas (`SECRET`). Para cada ator, `GET /characters/:id`: <br>• o narrador recebe as duas; <br>• o dono, só `SHARED`; <br>• o outro jogador, o ex-membro, o outro narrador e o desconhecido, 404 sem nenhuma das duas; <br>• o `check` de hoje (`authz.test.ts:210-232`) ganha o `SHARED` para quem não é narrador nem dono | `apps/api/src/__tests__/authz.test.ts`; `apps/api/src/test/matrix-systems.ts` ganha `sharedTextField` (o `longText` de uma seção cujo `read` tem dono e narrador e não tem `viewer`), sem citar nome de campo | Bun + PGLite |
| U-10d | NPC: o narrador grava a História de um NPC. Revelado por inteiro, o membro (`viewer`) recebe a ficha sem `backstory`. Oculto, recebe 404. Nos três sistemas | `apps/api/src/__tests__/authz.test.ts` (ou `backstage.test.ts`, onde a revelação já é montada) | Bun + PGLite |
| U-10e | A escrita do dono: A, 200 em `creating` e em `active`; 403 com `reason: 'pending'` em `pending`; 403 `SHEET_LOCKED` com a trava; 403 `NOT_MEMBER` para o ex-membro na própria ficha. B, 403 em todo estado, e nada muda (como `authz.test.ts:266-281`). O narrador grava em todo estado | `apps/api/src/__tests__/events.test.ts` | Bun + PGLite |
| U-10f | O Histórico: o dono vê a entrada do lote do narrador na História, assinada "narrador", sem o texto (`from`/`to` nulos). O lote das Notas continua fora do Histórico do dono | `apps/api/src/__tests__/events.test.ts` | Bun + PGLite |
| U-10g | **Nada passa das Notas:** um banco na `0023`, com uma ficha na versão anterior com as Notas preenchidas. Depois da `0024`, `sheet_data` e `template_version` da ficha são os mesmos, byte a byte, e ela não tem `backstory`. Uma ficha nova nasce na versão nova, com a História vazia | `packages/db/src/__tests__/migrations.test.ts` (no `describe` da `0024`) | Bun + PGLite |
| U-10h | Na Leitura, o dono vê "História / Prelúdio" e o texto na aba Sobre, e não vê as Notas do Narrador. O narrador vê as duas, e só as Notas com "privadas: o jogador não vê" | `apps/frontend/sheet/__tests__/storyteller.test.tsx` | Jest + RNTL |
| U-10i | O editor do narrador: na folha da História, "O jogador lê este texto." visível e na dica do campo. Na das Notas, "Privadas: o jogador não vê estas notas." e não o aviso novo. Na do dono, nenhum dos dois. Saída A: no `TextEditorRow`, com o T-84. Saída B: na `TextFieldSheet` | `apps/frontend/sheet/__tests__/storyteller.test.tsx` e um teste do `TextEditorRow` | Jest + RNTL |

### 4.2 Testes existentes que mudam junto

- **`packages/sheet-core/src/__tests__/compile.test.ts`:**
  - `:57`: a zona `lore` do V20 passa a `['about', 'backstory', 'storyteller']`;
  - `:116-117`: acrescentar `backstory` como `restricted`;
  - `:259-263`: a ordem do W20 ganha `backstory` depois de `about`;
  - `:42-43` e `:238-240`: as versões, no commit de versão.
- **`apps/frontend/sheet/__tests__/storyteller.test.tsx:231-253`:**
  - na saída B, o `storytellerOnlyText` do V20 passa a `['backstory', 'storytellerNotes']`, na ordem dos campos do template; na A, não muda;
  - `hiddenFromOwner(model, 'backstory')` é falso nos três sistemas.
- **`apps/frontend/sheet/__tests__/SheetView.test.tsx:40-80`.** O `expectEveryField` pula seções `restricted` para quem não é narrador. A seção nova é `restricted`, e o dono a lê: a condição passa a ser `!canReadSection(model, s.id, roles)`, para o teste conferir que o dono vê a História.
- **Os testes que fixam versão** (§3.7), no commit de versão.
- **Os E2E** que conferem que o jogador não vê "Notas do Narrador" (`sheet.spec.ts:79`, `journey.spec.ts:258`, `table.spec.ts:143`) não mudam, se o `help` e o aviso não usarem essas palavras (§3.1).
- **`sheet.spec.ts:70-74`** (as abas "Ficha", "Vantagens", "Sobre") não muda: a seção nova fica dentro da aba Sobre.

### 4.3 E2E novo: `e2e/tests/backstory.spec.ts` (Chromium e WebKit)

Spec próprio, para não disputar o `narrator.spec.ts` com o P09-D (§8.4). O seed do E2E publica os templates do produto (`global-setup.ts:42`, `--published`), então as fichas nascem na versão nova. Viewport de 390×844.

1. **A narradora escreve, a jogadora lê:**
   - a narradora abre a ficha da jogadora e entra em "Editar como narrador";
   - saída B: `getByRole('button', { name: 'Editar História / Prelúdio', exact: true })`. Saída A: `getByRole('radio', { name: 'Editar', exact: true })`, depois `getByRole('tab', { name: 'Sobre' })` e `getByTestId('editor-backstory')`;
   - confere `getByRole('textbox', { name: 'História / Prelúdio', exact: true })` com `toHaveAccessibleDescription('O jogador lê este texto.')`;
   - escreve uma marca fictícia (`HIST-E2E-…`) e salva;
   - nas Notas, grava a marca secreta de hoje.
2. **A jogadora abre a ficha:**
   - a resposta de `GET /characters/:id` contém a marca da História e não contém a das Notas;
   - na aba Sobre, `getByText(marca)` aparece, e `getByText(/Notas do Narrador/)` tem contagem 0.
3. **Outra jogadora** da mesma crônica abre a URL da ficha e vê "Você não tem acesso a esta ficha", e a resposta não contém nenhuma das duas marcas.
4. **Saída A:** a jogadora edita a História no Editar (com o T-84) e salva. No Histórico, a narradora vê a entrada "(jogador)" sem o texto.
5. **A 390,** a aba Sobre rola até o fim do texto longo (uma marca no fim do texto de 8000 caracteres fica visível depois de `scrollIntoViewIfNeeded`), e nada passa da largura (`document.documentElement.scrollWidth <= 390`).

O que só o E2E pega: o `aria-describedby` real no DOM e a resposta da rede sem a marca das Notas. "História" e "Histórico" são textos diferentes, e os seletores usam `exact: true` para não casar um com o outro.

### 4.4 Suítes do "PR local" e cobertura

- `npx pnpm -C packages/sheet-core build` antes da API, que lê o `dist`.
- `npx pnpm typecheck` e `npx pnpm lint`.
- `bun test packages/sheet-core/src`, `bun test packages/db/src` e `bun test apps/api/src` (a matriz de AuthZ nos três sistemas).
- Jest: `npx pnpm test:ui`, com `--forceExit` no frontend (onda-4 §11).
- `test:coverage` (as metas são por arquivo: `privacy.ts`, `TextEditorRow.tsx` e `StorytellerBar.tsx`).
- `node design/scripts/build.mjs` e `git diff --exit-code`, como o CI.
- O E2E (Chromium e WebKit) roda na integração da onda, um por vez (portas fixas). O `random.test.ts` instável não é deste pacote.

## 5. Segurança

| Ameaça | O que o desenho evita |
|---|---|
| **As Notas do Narrador chegam ao jogador** pela mudança (migration, cópia, sugestão) | A `0024` não lê nem escreve ficha (teste U-10g). Nenhum botão nem texto inicial copia as Notas. A seção `storyteller` não muda. A marca `SECRET` da matriz continua em toda resposta a quem não é narrador (U-10c) |
| **A História chega a quem não deve** (outro jogador, ex-membro, `viewer`, outro narrador, NPC oculto) | `read: ["owner", "storyteller"]` na seção. O `stripRestricted` corre em toda saída (§3.0), com os papéis resolvidos no banco, nunca vindos do cliente. A matriz de AuthZ prova nos três sistemas (U-10c, U-10d). O app só esconde o que o servidor já não manda |
| **Escrita indevida** (o jogador no `pending`, com a trava, fora da crônica; o `viewer`) | `canWrite` e `writePolicy` no servidor, como hoje (U-10e). Na saída B, o `write` só do narrador. O `viewer` nunca escreve. Fail secure: papel desconhecido não lê nem escreve (`permissions.ts:5-8`) |
| **Injeção** (HTML, script, link) pelo texto | O valor sai sempre em `<Text>`, nunca como HTML, sem markdown, sem `dangerouslySetInnerHTML` e sem detecção de link (`TextLayout.tsx:12-14`). O rótulo, o título e o `help` são `safeText` (sem `<`, `>`, controle nem bidi), e o `help` passa pela regra "sem link, uma linha" da publicação |
| **Tamanho** | O `maxLength` de 8000 é aplicado pelo `validateSheet` no servidor. O lote tem teto de 64 KB, e o limite de lotes por usuário e por ficha não muda. A Mesa leva a ficha inteira ao narrador (`table.ts:18-23`): no pior caso, 20 fichas com 8000 caracteres cada (cerca de 160 mil caracteres a mais). O P09-D, que mexe na Mesa, sabe disso (§8.4) |
| **Logs, Sentry e Histórico** | `longText` entra no Histórico sem conteúdo (`events.ts:104-106`). O `scrubLog` e o Sentry reconstroem o evento por allowlist e não têm campo de ficha. A mensagem de recusa do validador traz o caminho e o limite, não o valor |
| **Cache no aparelho** | A ficha do dono já fica no cache de leitura por usuário, apagado no logout (`apps/frontend/lib/persist.tsx:38-41`). A História é da mesma classe das "Notas" do jogador, que já estão lá. O cache não é cifrado, e cifrá-lo seria pacote à parte. O rascunho continua no armazenamento cifrado (P03-C). O aparelho do jogador nunca recebe as Notas do Narrador |
| **Dado de produção** | O texto do U-10 em produção não é lido, copiado nem migrado. Nenhuma saída da §3.6 recomendada mexe direto no banco de produção. A `0024` só insere templates, sem SQL concatenado |

**`/security-review` antes do merge**, como a §5 do brief pede para o P15-D: a AuthZ nova de leitura (o `read` da seção) e o dado que o jogador passa a receber.

## 6. Como generaliza além do WoD

- **De template:** o campo e a seção são dados de cada sistema. O D&D, o CoC e o Fate (não publicados) ganham a mesma seção acrescentando o mesmo bloco. O id `backstory` não colide com a perícia `history` deles, e o rótulo é de cada sistema ("Antecedentes", "Histórico pessoal").
- **Genérica:**
  - a leitura e a escrita vêm das `permissions`, sem nome de sistema nem de campo no código;
  - o aviso "O jogador lê este texto." vale para qualquer texto que o narrador edita e o dono lê;
  - a matriz de AuthZ acha o campo pelo template (`sharedTextField`).
- **De skin:** nada.
- **O que não generaliza sozinho:** a ficha que já existe. A migração de fichas entre versões é ponto de extensão do motor (arquitetura §11), e vale para qualquer sistema quando entrar (§3.6).

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado.** Arquivos e linhas conferidos no `05c5d7d` (§3). A D-16 aplicada. O PO respondeu quem escreve (§9.1, ponto 1), e o usuário respondeu a ordem do release (§9.3).
2. **Typecheck, lint e testes** de `@tms/sheet-core` (com o `dist` reconstruído), `@tms/db`, `@tms/api` e do frontend, o `build.mjs` e o `test:coverage` (§4.4).
3. **Um teste de regressão por item** (§4.1), falhando no `05c5d7d`.
4. **`/code-review` e `/security-review`** no diff do pacote, com o commit de versão. Os achados vão no resumo.
5. **Os cenários, repetidos sem o defeito.** Com a API local e o seed do roteiro (só contas fictícias; §11):

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | U-10 | O narrador do feedback de 03/11 (Android), com a conta N: ficha de Mago de J1, na versão nova → "Editar como narrador" → escrever o prelúdio na História | O editor diz "O jogador lê este texto."; ao salvar, o Histórico assina "(narrador)" |
   | U-10 | J1 no Android: abrir a mesma ficha → Sobre | A História inteira, rolável; nenhuma Nota do Narrador na tela nem no `dump` |
   | U-10 | N, ficha antiga de Mago (versão anterior) ao lado da nova | A antiga sem a seção História e sem "Atualize o app"; a nova com ela |
   | R-09 (não regride) | N-A, NA-17 (`narrador-app.md`), iOS; N-W, NW-25 (`narrador-web.md`), web 390: "Editar Notas do Narrador" | O aviso de privado de hoje; J1 continua sem receber as Notas |
   | U-10 (AuthZ) | J2, outro jogador da crônica, no web: a URL da ficha de J1 | "Você não tem acesso a esta ficha" |

6. **Conferência no aparelho.** O roteiro está na **§11**. O pacote não muda o `@tms/ui` nem nada nativo, mas o campo novo e o aviso precisam ser vistos no Android, onde o U-10 apareceu, e no iOS.
7. **Resumo para a seção do pacote no PR da onda:**
   - o que mudou e como foi testado;
   - a resposta do PO (quem escreve);
   - as versões publicadas e a `0024`;
   - o que acontece com a ficha antiga (§3.6) e a saída escolhida;
   - os achados das duas revisões.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

Cada commit diz tudo o que entra nele, por sistema e por arquivo (a lição A2 da onda 4).

| # | Commit | O que entra | Itens | Esforço |
|---|---|---|---|---|
| 1 | `feat(templates): História / Prelúdio nos três sistemas` | **V20:** o campo `backstory` em `vtm-v20.json` depois de `notes` (`:761`) e a seção `backstory` depois de `about` (`:926-932`). **M20:** o mesmo em `mta-m20.json` (`:769`; depois de `:987-993`). **W20:** o mesmo em `wta-w20.json` (`:1007`; depois de `:1197-1203`, antes de `battle-scars`). Em cada um: `type`, `label`, `maxLength`, `help` e, na saída B, `"write": ["storyteller"]`. Sem mudar o `templateVersion`. O `design/templates/README.md` §4 ganha o exemplo de uma seção que o dono e o narrador leem e o `viewer` não. O `design/telas/dados.js` é regenerado pelo `build.mjs`. Os testes U-10a e U-10b e os de `compile.test.ts` (`:57`, `:116-117`, `:259-263`) | U-10 | P |
| 2 | `test(api): a História do personagem na matriz de AuthZ` | `apps/api/src/test/matrix-systems.ts` (`sharedTextField`), `authz.test.ts` (a marca `SHARED`, o `check`, o NPC revelado e o oculto), `events.test.ts` (a escrita por estado e o Histórico), nos três sistemas. Testes U-10c a U-10f | U-10 | M |
| 3 | `feat(app): o editor diz quando o jogador lê o texto` | `sheet/storyteller/privacy.ts` (`readByOwner`, `SHARED_NOTE_SHEET`), `StorytellerBar.tsx` (`TextFieldSheet`), `evolve/TextEditorRow.tsx` (o aviso para o narrador), `storyteller.test.tsx`, o teste do `TextEditorRow` e o `SheetView.test.tsx` (§4.2). Testes U-10h e U-10i | U-10 | P |
| 4 | `test(e2e): a História do personagem` | `e2e/tests/backstory.spec.ts` (§4.3) | U-10 | P |
| 5 | `chore(templates): vtm-v20 1.10.0, wta-w20 1.8.0, mta-m20 1.8.0` | O commit de versão único da onda, com tudo o que a §3.7 lista, e o teste U-10g. Vai para o fim da branch, depois do rebase sobre a onda com o P13, e só se nenhum pacote que muda template entrar depois (o P16-D; §3.7) | U-10 | P |

**Por que esta ordem:**

- O template (1) vem antes da API (2) e do app (3), que leem o campo.
- O aviso (3) não depende do template, mas o teste usa o campo.
- A versão (5) fica no fim, para nenhum banco local gravar a 1.10.0 com um conteúdo que ainda vai mudar (a versão publicada é imutável).
- Entre o 1 e o 5, o roteiro manual não roda: ele roda depois do 5 (§11.a).

### 8.2 Esforço

**M no total.** A matriz estima P, e o conteúdo é P. O que leva o pacote a M:

- a matriz de AuthZ nos três sistemas (commit 2);
- o commit de versão da onda, com a migration e os testes que fixam versão (commit 5);
- o roteiro manual nas três plataformas, com uma ficha na versão anterior preparada antes da `0024` (§11.a).

### 8.3 Riscos

- **A saída A sem o P13.** Se o T-84 não entrar, ninguém edita a História pela tela. Com a A, o P15-D entra depois do P13. Se o P13 atrasar, a B funciona sozinha.
- **"Atualize o app" no nativo.** O P15-D sozinho não cria janela nova para o app da onda 4 (§3.7). Uma chave nova do P13 ou do P16-D no mesmo aumento cria. Cada plano diz se põe chave nova.
- **O narrador do U-10 não vê a mudança na ficha dele** (§3.6). É o risco de produto mais visível do pacote, e a resposta é do PO.
- **Bancos locais com a versão nova e outro conteúdo.** Um banco que publicar a 1.10.0 antes do commit 5 trava o seguinte com "já está no banco com outro conteúdo". Por isso o roteiro usa um banco próprio do pacote (§11.a), e o `templates:publish` não roda na branch antes do commit 5.
- **Um banco novo não tem a versão anterior** (§3.0). A ficha antiga do roteiro é criada antes da `0024` (§11.a).
- **E2E com texto repetido.** "Notas do Narrador" no `help` quebraria três specs. "História" e "Histórico" são diferentes, e os seletores usam `exact`.
- **Leitor de tela e texto longo.** O bloco do `TextLayout` é um elemento acessível só, com o texto inteiro no nome (`TextLayout.tsx:39-46`). Com 3.700 caracteres, o VoiceOver e o TalkBack leem tudo de uma vez, sem parar por parágrafo. Isso já vale para as Notas. É pergunta técnica para o P13, que mexe no `TextLayout` (§9.2, pergunta 4).

### 8.4 Conflitos com os pacotes da onda

| Pacote | Onde se cruzam | Como fica |
|---|---|---|
| **P13** (T-84, T-79) | O T-84 põe o editor no `TextLayout`, de que a saída A depende. Ele pode tocar o `TextEditorRow`, que o commit 3 também toca. O T-79 pode mudar template | **O P15-D entra depois do P13** e faz o rebase. O conflito no `TextEditorRow` é pequeno (o aviso fica num `note`, à parte do resto). Se o T-79 mudar template, o conteúdo entra antes do commit de versão do P15-D |
| **P16-D** (U-11) | `privacy.ts` (o aviso de privado e o novo), `StorytellerBar.tsx`, `matrix-systems.ts` e `authz.test.ts`, e talvez as `permissions` das Notas nos três templates | O P16-D depende do P15-D e entra depois. Se mudar template, leva o commit de versão para o fim da branch dele (§3.7). O aviso "O jogador lê este texto." é estático, pelas permissões: com uma nota revelada, o P16-D decide o que o editor diz |
| **P14-D** (U-09) | Nenhum arquivo em comum. A matriz pede o aviso de público × privado claro nos dois editores | A mesma forma de frase no editor da Descrição ("Os jogadores leem este texto.", se o P14-D a adotar) |
| **P09-D** (Mesa) | A Mesa leva a ficha inteira, e a História a deixa maior (§5) | Nenhum arquivo em comum. Se o P09-D mudar o payload da Mesa, ele sabe do tamanho |
| **P01-D** | Registra a D-16 e a versão nos planos, e talvez a saída 4 da §3.6 no `proximas-features.md` | Entra por último, depois deste |
| P12 | — | Nenhum |

**E2E da onda:** o `backstory.spec.ts` é novo e só deste pacote. O `narrator.spec.ts`, o `journey.spec.ts`, o `table.spec.ts` e o `sheet.spec.ts` não mudam (§4.2), e os ajustes do P09-D e do P12 neles não conflitam com este.

### 8.5 Arquivos tocados

- **Templates:** `design/templates/vtm-v20.json`, `design/templates/mta-m20.json`, `design/templates/wta-w20.json`, `design/templates/README.md` (§4), `design/telas/dados.js` (gerado).
- **Banco:** `packages/db/src/migrations/0024_templates_onda5.ts` (novo), `packages/db/src/migrations.ts`, `packages/db/src/__tests__/migrations.test.ts`.
- **Core (só testes):** `packages/sheet-core/src/__tests__/permissions.test.ts`, `packages/sheet-core/src/__tests__/compile.test.ts`.
- **API (só testes):** `apps/api/src/test/matrix-systems.ts`, `apps/api/src/__tests__/authz.test.ts`, `apps/api/src/__tests__/events.test.ts`, `apps/api/src/__tests__/characters.test.ts`, `apps/api/src/__tests__/mage.test.ts`, `apps/api/src/__tests__/werewolf.test.ts`, `apps/api/src/templates/__tests__/publish.test.ts` (e `backstage.test.ts`, se o caso do NPC ficar lá).
- **App:** `apps/frontend/sheet/storyteller/privacy.ts`, `apps/frontend/sheet/storyteller/StorytellerBar.tsx`, `apps/frontend/sheet/evolve/TextEditorRow.tsx`, `apps/frontend/sheet/__tests__/storyteller.test.tsx`, `apps/frontend/sheet/__tests__/SheetView.test.tsx`, um teste do `TextEditorRow` em `apps/frontend/sheet/__tests__/`.
- **E2E:** `e2e/tests/backstory.spec.ts` (novo).
- **Não mudam:** `schema.json`, `validate/template.ts`, `validate.mjs`, `publication.ts`, `permissions.ts`, as rotas da API, o `@tms/ui`, o `TextLayout.tsx` (é do P13) e nada nativo.

## 9. Perguntas abertas

### 9.1 Para o PO

1. **Quem escreve a História** (a D-16 não diz): A, os dois (recomendada, depende do T-84 do P13); B, só o narrador (o pedido do U-10 ao pé da letra, sem dependência); C, só o dono (não atende ao U-10). §3.2.
2. **A ficha que já existe** (a do U-10 e todas as anteriores; onda-4 §6, ponto 9): as saídas e o custo de cada uma estão na §3.6. Recomendação: aceitar, oferecer o contorno das "Notas" do jogador quando o P13 estiver em produção e registrar a atualização de versão de ficha como item futuro. A saída 3 (revelar a nota) é a D-17.
3. **O nome:** "História" no título da seção, "História / Prelúdio" no rótulo, e as frases do `help` e do aviso ("O jogador lê este texto."). São rascunho do time.
4. **O NPC revelado:** a História de um NPC fica só com o narrador, mesmo revelado por inteiro (recomendado). A alternativa é acrescentar `viewer` ao `read`.

### 9.2 Técnicas

⚙ = resposta só no simulador, no aparelho ou no E2E.

1. **O tamanho: 8000 ou 4000?** 8000 dá folga ao prelúdio e cabe no lote. 4000 é o limite das Notas e deixa a Mesa menor. Proposta: 8000.
2. **O commit de versão** fica no fim da branch do P15-D (proposto) ou no do P16-D, se ele mudar template (§3.7)? Depende do plano do P16-D.
3. **A validação dentro da migration** (onda-4 §11, pergunta 3) segue para decisão. A `0024` repete a `0023`. Não é resolvida aqui.
4. ⚙ **O texto longo no leitor de tela:** o bloco do `TextLayout` como um elemento só, com o texto inteiro no nome, ou o rótulo como elemento e o texto à parte, para o VoiceOver e o TalkBack lerem por linha? O `TextLayout` é do P13 nesta onda.
5. **Uma marca na legenda da Leitura** ("História / Prelúdio · o jogador lê"), além do aviso no editor? Proposta: não, para não marcar todo texto que o dono lê.
6. **Provar que o app da onda 4 abre a 1.10.0:** um teste automático pediria o core do `05c5d7d` no repositório. Proposta: a conferência manual com o bundle web do `05c5d7d` (§11, U-10i), opcional, e o argumento da §3.1 (nenhuma chave nova).

### 9.3 Para o usuário

1. **Como a onda 4 foi à produção:** o app nativo foi à loja antes ou depois do deploy da API com a `0023`? Há app nativo na loja? A resposta não está no repositório e decide se a `0024` vai no deploy da API ou espera a loja (onda-4 §6, ponto 3).

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

## 11. Testes manuais (web, Android com AVD, iOS com idb)

Roteiro para conferir o U-10 na interface, nas três plataformas, com a API local e o seed do roteiro. Só contas e textos fictícios. Ele detalha o passo 6 da §7. A coluna "Resultado" fica em branco e é preenchida na integração. Nenhum resultado é "ok" sem a evidência; quando uma plataforma não puder ser conferida, o resultado diz "não conferido" e por quê.

### 11.a Preparação

1. **Banco do pacote, com uma ficha na versão anterior.** Um banco novo só tem a versão de hoje dos arquivos (§3.0). Por isso a ficha antiga nasce antes da `0024`:
   - `createdb tms_p15d` no Postgres local (credenciais do `docker-compose.yml`). **Sem `db:down`:** o Postgres do Docker é um só para todos os worktrees;
   - **num worktree na ponta da onda, sem o P15-D** (antes do merge dele): `DATABASE_URL=…/tms_p15d npx pnpm db:migrate`, até a `0023`. Conferir pela tabela `kysely_migration`, porque o `db:migrate` pode travar na saída. O banco fica com `vtm-v20` 1.9.0, `mta-m20` 1.7.0 e `wta-w20` 1.7.0;
   - ainda nesse worktree e nesse banco: `npx pnpm seed:roteiro --fichas-criacao > <scratchpad>/p15d/seed.log 2>&1`. Ler só com `grep -v -i senha`;
   - pela tela (web, script Playwright), J1 cria, em cada crônica "v3/v5" (criação livre), uma ficha só com o nome e a conclui: **"Antiga Mago R"**, **"Antiga Vampiro R"** e **"Antiga Lobisomem R"**. N escreve nas Notas do Narrador da "Antiga Mago R" um texto fictício em ASCII com a marca `SEGREDO-P15D-ANTIGA`. São as fichas da versão anterior, como a do U-10;
   - **no worktree do P15-D** (depois do commit 5): `npx pnpm build`, `DATABASE_URL=…/tms_p15d npx pnpm db:migrate`, e conferir na `kysely_migration` a `0024_templates_onda5`. Em `trait_templates`, as duas versões de cada sistema;
   - **na integração**, o mesmo, no banco da onda: a ficha antiga é criada antes do merge do P15-D, e o `db:migrate` roda depois.
2. **API e Metro:** `npx pnpm dev:api` (3001) e `cd apps/frontend && npx expo start` (8081), com `--clear`.
3. **O seed:**
   - **contas:** N (`roteiro_narrador`), J1 (`roteiro_jogador1`), J2 (`roteiro_jogador2`) e N2, todas `@roteiro.test`. A senha é a constante do `scripts/seed-roteiro.ts` e não é escrita aqui nem nas evidências; os scripts de login a leem em tempo de execução;
   - **um seed só,** antes da `0024`, para as três plataformas. Rodar o seed de novo depois da `0024` apagaria as fichas antigas (sem `--keep`). Este roteiro **não gera convite**, então o limite de aceites não pesa;
   - **o que o seed já cobre:** as crônicas "Vampiro/Mago/Lobisomem v3/v5" e "v4", com J1 e J2 dentro; com o `--fichas-criacao`, as fichas de J1 da onda 3 (na versão anterior, também úteis lado a lado);
   - **o que o seed não tem, e o roteiro cria pela tela:** as fichas antigas (acima); as fichas novas de cada plataforma (abaixo); as Notas do Narrador com texto; a História com texto longo. **O seed não muda** neste pacote.
4. **Fichas novas** (versão nova, depois da `0024`), criadas por J1 em "Mago v3/v5" e concluídas: **"Historia Web R"**, **"Historia Android R"** e **"Historia iOS R"**, sem acento por causa do `adb input text` e do idb. No web, também **"Historia Vampiro R"** e **"Historia Lobisomem R"** nas crônicas desses sistemas.
5. **O texto longo:** cerca de 3.700 caracteres fictícios, montados no script repetindo uma frase neutra do time ("Texto de teste do roteiro, sem conteúdo de jogo.") e terminados por uma marca `FIM-P15D`. É escrito pelo N no web (`fill()` do Playwright) na "Historia Android R" e na "Historia iOS R". O U-10 é o narrador escrevendo e o jogador lendo: a leitura é o que precisa do Android.
6. **Evidências:** no scratchpad, `p15d-<plataforma>-<ID>-<passo>.png`. Sem e-mail na captura. Nenhum código de convite em lugar nenhum.

### 11.b Web (Playwright, Chromium; WebKit onde indicado)

- **Script:** `<scratchpad>/p15d/web.mjs`, com o `playwright` do `node_modules`, contra `http://localhost:8081` (Metro).
- **Viewports exatas:** `{ width: 390, height: 844 }` e `{ width: 1280, height: 800 }`.
- **WebKit:** U-10a e U-10b também em `webkit.launch()` (o `aria-describedby` no Safari).
- **Seletores por papel e rótulo, com `exact`:**
  - `getByRole('tab', { name: 'Sobre', exact: true })`;
  - `getByRole('button', { name: 'Editar como narrador' })`;
  - saída B: `getByRole('button', { name: 'Editar História / Prelúdio', exact: true })`;
  - saída A: `getByRole('radio', { name: 'Editar', exact: true })` e `getByTestId('editor-backstory')`;
  - `getByRole('textbox', { name: 'História / Prelúdio', exact: true })`;
  - `getByRole('button', { name: 'Histórico', exact: true })` (a 390, dentro de "Mais opções").
- **A rede:** o script grava o corpo de `GET /characters/:id` de cada conta e procura as marcas. O arquivo fica no scratchpad, não vai a relatório.
- **Medidas:** numa folha, o painel `bottom-sheet-root > [aria-modal="true"]`, não a camada. Na página, `scrollWidth <= 390`.
- **Um `page.screenshot` por passo.**

### 11.c Android (AVD)

- **AVD:** `Pixel_3a_API_34_extension_level_7_arm64-v8a` (393 dp), iniciado com `-cores 4 -memory 3072 -no-snapshot -gpu host` (só opções de execução). APK do `assembleDebug` arm64, com `JAVA_HOME` no JBR do Android Studio.
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Larguras:** a aba Sobre com o texto longo e a barra do narrador (com dois botões, na saída B) são de layout. Conferir também a 360 dp (`adb shell wm density 480`) e a 411 dp (`420`), com `adb shell wm density reset` no fim.
- **Teclado de software:** `adb shell settings put secure show_ime_with_hard_keyboard 1`.
- **Navegação:**
  - `adb shell uiautomator dump /sdcard/ui.xml` e `adb pull`; achar o alvo pelo `content-desc` e tocar no centro do `bounds` com `adb shell input tap X Y`;
  - `adb shell input keyevent 4` para o voltar do Android com a folha aberta;
  - o `input text` não digita acento: os textos digitados no Android são ASCII;
  - copiar e colar (U-10e): toque longo no campo (`adb shell input swipe X Y X Y 800`), "Selecionar tudo", "Copiar"; no outro campo, toque longo e "Colar".
- **LogBox:** dispensar o banner antes de tocar perto do pé da tela.
- **Tempo** medido no emulador sob carga não é evidência. Desligar o AVD antes do iOS.
- **Sem TalkBack no AVD:** o anúncio do aviso fica para ouvir no aparelho. O `dump` mostra o `content-desc` e o texto.

### 11.d iOS (simulador, com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, e iPhone 17, iOS 26.5.
- **Build Debug com "Sign to Run Locally"**, em `apps/frontend/ios`. Sem assinatura, o app não loga (o keychain responde `-34018`):

  ```bash
  xcodebuild -workspace TMS.xcworkspace -scheme TMS -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath <scratchpad>/ios-dd CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build
  ```

  Depois: `xcrun simctl install <UDID> <scratchpad>/ios-dd/Build/Products/Debug-iphonesimulator/TMS.app` e `xcrun simctl launch <UDID> com.tms.app`.
- **Cliente fb-idb:** o venv `~/.venvs/idb-tms` já existe, fora do repositório, com `fb-idb` 1.7.7. Rodar `~/.venvs/idb-tms/bin/pip-audit` antes de usar; com vulnerabilidade, parar e registrar. Nunca no `package.json` nem no lockfile.
- **Companion:** `--companion-path /opt/homebrew/bin/idb_companion` vem antes do subcomando. Fica só local, no socket de domínio; no fim, `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` não mostra nada.
- **Navegação:**
  - `idb ui describe-all --udid <UDID>`, com o driver escondendo o valor dos campos E-mail e Senha (onda-4 §11, achado 7);
  - tocar no centro do `frame`; `idb ui text`, `idb ui swipe`, `idb ui key`; `idb screenshot` para a evidência.
- **Limites do idb:**
  - não faz o gesto de borda (usar o "‹");
  - não digita fora do ASCII;
  - o teclado de software some depois do primeiro texto;
  - o toque longo para copiar e colar pode não sair: o U-10e é obrigatório só no Android e no web.

### 11.e Tabela por item

As linhas marcadas "A" ou "B" valem só para a saída que o PO escolher (§3.2).

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| U-10a | Web 390 (Chromium e WebKit) | N | "Historia Web R" → "Editar como narrador" → abrir o editor da História (A: Editar → Sobre → `editor-backstory`; B: "Editar História / Prelúdio") → escrever um texto curto → salvar. Depois, "Editar Notas do Narrador" → marca `SEGREDO-P15D-NOVA` → salvar | Na folha da História, "O jogador lê este texto." visível e no `aria-describedby` do campo. Na das Notas, o aviso de privado de hoje. O Histórico assina "(narrador)" duas vezes, sem os textos | `p15d-web390-U-10a-1..4.png` | |
| U-10b | Web 390 (Chromium e WebKit) | J1, J2 | J1 abre "Historia Web R" → Sobre. J2 abre a URL da mesma ficha | J1 vê a seção "História" com o texto e não vê "Notas do Narrador". A resposta de J1 tem o texto da História e não tem `SEGREDO-P15D-NOVA`. J2 vê "Você não tem acesso a esta ficha", e a resposta não tem nenhuma das duas | `p15d-web390-U-10b-1..2.png` | |
| U-10c | Web 1280 | N | Lado a lado, em duas abas: "Antiga Mago R" e "Historia Web R" → Sobre. Depois, "Historia Vampiro R" e "Historia Lobisomem R" | A antiga sem a seção História e sem "Atualize o app"/"Recarregue a página"; o `templateVersion` da resposta é o anterior. As novas dos três sistemas com a seção, na ordem da §3.1 | `p15d-web1280-U-10c-1..3.png` | |
| U-10d | **Android 393 (obrigatório)**; 360 e 411 | J1 | "Historia Android R" (com o texto longo do N) → Sobre → rolar até o fim | O texto inteiro, quebrado em linhas, até `FIM-P15D`. Nenhuma "Notas do Narrador" no `dump`. A 360 e a 411, sem corte lateral | `p15d-and393-U-10d-1..2.png`, `p15d-and360-U-10d-3.png`, `p15d-and411-U-10d-4.png` | |
| U-10e | **Android 393 (obrigatório)**; web 390 | N | Na "Historia Android R", "Editar Notas do Narrador" → um texto ASCII curto → salvar. Conferir que a História não mudou. Depois, copiar à mão: abrir as Notas → selecionar tudo → copiar → cancelar → abrir o editor da História → colar no fim → salvar | Antes da cópia, a História igual à de antes: nada passou sozinho. Depois, J1 lê o texto colado. Copiar e colar com o teclado de software | `p15d-and393-U-10e-1..4.png`, `p15d-web390-U-10e-5.png` | |
| U-10f | Android 393 | N | "Antiga Mago R" (versão anterior) → Sobre | Sem a seção História e sem "Atualize o app". As Notas com `SEGREDO-P15D-ANTIGA`, com o aviso de privado | `p15d-and393-U-10f-1.png` | |
| U-10g (A) | Android 393 | J1 | "Historia Android R" → Editar → Sobre → História → acrescentar um texto ASCII → Aplicar → Salvar. Depois, N abre o Histórico | J1 edita com o teclado de software e salva. O Histórico do N mostra o lote "(jogador)", sem o texto | `p15d-and393-U-10g-1..3.png` | |
| U-10g (B) | Android 393 | J1 | "Historia Android R" → Editar → Sobre | A História em leitura, sem editor. Nenhuma recusa: o app não oferece o que o servidor recusaria | `p15d-and393-U-10g-4.png` | |
| U-10h | iOS SE e iPhone 17 | J1, N | J1: "Historia iOS R" → Sobre → rolar até o fim. N: a mesma ficha → abrir o editor da História | J1: o texto inteiro, sem "Notas do Narrador" no `describe-all`. N: o campo "História / Prelúdio" com a dica "O jogador lê este texto."; no 17, nada sob a Dynamic Island | `p15d-iosSE-U-10h-1..2.png`, `p15d-ios17-U-10h-3.png` | |
| U-10i | Web 390 | N, J1 | Bastidores de "Mago v3/v5": N cria um NPC, escreve a História dele e o revela por inteiro. J1 o abre. N o oculta de novo; J1 tenta a URL | Revelado: J1 vê a ficha do NPC sem a seção História, e a resposta não tem o texto. Oculto: J1 não o acessa | `p15d-web390-U-10i-1..3.png` | |
| U-10j (opcional) | Web 390, bundle do `05c5d7d` | J1 | Um worktree no `05c5d7d` com o Metro em outra porta, contra a API do P15-D → "Historia Web R" | Abre sem "Atualize o app"/"Recarregue a página", com a História em leitura. Simula o app nativo da onda 4, que roda o mesmo core | `p15d-web390-U-10j-1.png` | |
| R-09 | iOS SE (N-A, NA-17); web 390 (N-W, NW-25) | N | "Historia iOS R" / "Historia Web R" → "Editar como narrador" → "Editar Notas do Narrador" | O aviso de privado de hoje, no nome do botão e na folha. Nada mudou | `p15d-iosSE-R-09-1.png`, `p15d-web390-R-09-2.png` | |

### 11.f Acessibilidade mínima

A árvore é o DOM no web, o `uiautomator dump` no Android e o `describe-all` no iOS.

- **O bloco da História na Leitura:**
  - web: um elemento com nome que começa por "História / Prelúdio";
  - Android: o `content-desc` com o rótulo;
  - iOS: o `AXLabel` com o rótulo.
- **O aviso no editor do narrador:**
  - web: o `textbox` "História / Prelúdio" com `aria-describedby` apontando o texto visível "O jogador lê este texto.";
  - Android e iOS: a dica do campo (`accessibilityHint`);
  - na saída B, o nome do botão da barra continua "Editar História / Prelúdio", sem o aviso de privado.
- **As Notas do Narrador:** o nome do botão "Editar Notas do Narrador. Privadas: o jogador não vê" e a descrição do campo, como hoje.
- **O "?" no Editar:** "Ajuda: História / Prelúdio", com a frase do `help`.
- **O aviso não depende de cor nem de ícone:** é texto.
- **Fica para ouvir no aparelho** (o AVD não tem TalkBack, e o `describe-all` não expõe o anúncio):
  - o aviso lido com o campo;
  - o texto longo lido de uma vez (§9.2, pergunta 4).

### 11.g Limpeza

- Parar a API e os Metros (o do `05c5d7d`, se o U-10j rodou).
- Desligar o AVD (`adb emu kill`) e os simuladores (`xcrun simctl shutdown all`).
- `adb shell wm density reset` e `adb shell settings put secure show_ime_with_hard_keyboard 0`.
- Encerrar o `idb_companion`, sair do venv e conferir com `lsof` que nada escuta.
- O banco `tms_p15d` fica até a integração. Depois, só ele sai, com `dropdb tms_p15d`, nunca `db:down`.
- Nenhum convite foi gerado, então não há o que revogar.
- Remover o worktree do `05c5d7d`, se foi criado.
- Manter as capturas, o log do seed e os corpos de resposta no scratchpad até a integração. Nada vai para o repositório.

### 11.h Quando uma plataforma não puder ser conferida

O resultado diz "não conferido" e o motivo, por exemplo:

- "o toque longo do idb não abriu o menu de copiar";
- "o build do iOS falhou em …";
- "o emulador ficou ocupado sob carga".

O passo fica para a integração ou para o roteiro antes do release. Nunca "ok" sem a evidência. O U-10d e o U-10e no Android são obrigatórios: sem eles, o pacote não sai da integração.
