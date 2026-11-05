# P07-D · Vantagens: regras, catálogo e interação: plano de implementação

> Plano · 2026-11-04 · base conferida: `onda/4-conteudo-guia` em `c96f2d4` (o código citado é o do `3cc07f1`: os PRs #48 e #49, que vieram depois, só mudam o CI, o CLAUDE.md, os `*.pg.test` e uma config temporária do E2E)

Pacote [P07-D da matriz](../testes/2026-11-01/matriz-achados.md#p07-d): onda 4 (Conteúdo do sistema e guia da criação), decisão de produto, pré-requisito P07-C (mergeado na onda 2, `591a557`). Aplica as decisões D-06, D-07, D-08 e D-09. Ao fim do pacote:

- na criação por pontos, a Qualidade continua entrando com bônus (o P07-C já fez isso) e a folha diz o custo antes do toque; o texto "não se compra na criação" deixa de aparecer para Qualidade sem Custo;
- o W20 tem um catálogo de Dons só com nome e nível, com os da Raça, do Augúrio e da Tribo destacados; o texto livre continua; Dom acima do Posto 1 na criação avisa na linha e no "O que falta", sem bloquear;
- Disciplinas, Antecedentes (e qualquer lista com valor) sobem e descem com −/+ na própria linha; a folha do item fica com nome, especialização, metas e notas;
- as Disciplinas do clã vêm primeiro e com o selo "do clã"; outra Disciplina mostra "fora do clã: confirme com o narrador", sem bloquear; a Esfera de afinidade do Mago marca as da Tradição pelo mesmo mecanismo; a Fraqueza do clã já vem preenchida com um resumo escrito pelo time, editável.

O pacote não remove campo, não muda regra do jogo e não afrouxa limite:

- a conta da criação continua a do `@tms/sheet-core` e continua conferida no servidor (`apps/api/src/sheets/events.ts:350`, `checkCreationBatch`; `apps/api/src/sheets/creation.ts:665` e `:761`, `completionRefusal`). Nada do que a tela passa a só avisar (Dom acima do Posto 1, Disciplina fora do clã, Esfera fora da Tradição) era recusado antes, e nada passa a ser recusado agora;
- o Valor sai da folha do item, mas continua editável na linha: nenhum campo some;
- o servidor continua a autoridade. O que muda no `@tms/sheet-core` é o contrato do template (chaves novas, todas opcionais, validadas no servidor na publicação), uma função pura de recomendação e o padrão de texto por opção no `resolve`. A matemática da conta (`checkCreation`) não muda.

Todas as linhas citadas são do `3cc07f1`. A matriz cita o `1db3db9`, de antes das ondas 1 a 3; onde a causa provável dela está errada, a seção 3 diz. Dos 8 merges da `main` depois da onda 3 (observabilidade, `persist.tsx`, `sync.ts`, `http.ts`, `errors.ts`, o fix `d844907` do E2E e as releases), nenhum toca `ListEditor.tsx`, o `sheet-core` ou os templates. O `telemetryFilter.ts` e o `on-error.ts` importam para a seção 5 (os textos novos não entram na allowlist).

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md), "Decisões de produto" (D-06 a D-09), "Como executar", "Onda 4" e §P07-D (T-08, T-24, R-25, R-26) | Itens, decisões, "PR local" e critério de saída da onda |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §1 (C3, C4, C5), §4.1 passo 9, §7, §10 e as recomendações R-25, R-26 e R-27 (l.437-439) | Causa e recomendação de cada linha |
| [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) §7 | T-08 e T-24 |
| Notas: [qa-app](../testes/2026-11-01/notas/qa-app.md) (QAA-05), [qa-web](../testes/2026-11-01/notas/qa-web.md) (QAW-25), [experiente-app](../testes/2026-11-01/notas/experiente-app.md) (EA-03, EA-09, EA-12, EA-14, EA-24), [experiente-web](../testes/2026-11-01/notas/experiente-web.md) (EW-10, EW-18, EW-31), [iniciante-app](../testes/2026-11-01/notas/iniciante-app.md) (IA-07, IA-21, IA-29), [iniciante-web](../testes/2026-11-01/notas/iniciante-web.md) (IW-16, IW-22), [po-web](../testes/2026-11-01/notas/po-web.md) (POW-21, POW-23), [narrador-app](../testes/2026-11-01/notas/narrador-app.md) (NA-20, NA-29), [narrador-web](../testes/2026-11-01/notas/narrador-web.md) (NW-33) | Cenários do critério de pronto (§7) e do roteiro manual (§11) |
| [regras-wod.md](../regras-wod.md): tabela de bônus (l.21-35), Disciplinas do clã (l.54-70) e "O que fica com o narrador" (l.72-78) | A regra que a tela passa a recomendar, sem a conta mudar |
| [auditoria-fichas-wod.md](../auditoria-fichas-wod.md) l.149 (Fraqueza do clã incompleta) e l.162 ("Dons e Ritos sem catálogo, por licença") | A decisão de licença que a D-07 revê só para os nomes |
| [avaliacao-ui-ux.md](../avaliacao-ui-ux.md) C-18 (l.523-528) | O padrão: o template traz os nomes, a mesa escreve a descrição |
| [design/templates/README.md](../../design/templates/README.md) §2, §3, §9 (passo 5: o app antes do template), §11 e §12 | Contrato, texto seguro, publicação e licença |
| [plano-v4.md](../plano-v4.md) §3 e Etapa 2b | A criação por pontos e a contabilização |
| [P07-C](P07-C-vantagens-folhas.md) §2, §3.1, §3.2, §9 e §10 (notas para o P07-D) | O que este pacote estende: a recusa na folha, o valor inicial dos metas e as notas deixadas |
| [P05-C](P05-C-feedback-conta.md) §3.0 e §3.8; [P06](P06-componentes-acessibilidade.md) §2 (o título do `Choice` em linha própria) e §3.1; [P08](P08-layout-teclado.md) §3 (folha central de 560, teclado) | A recusa perto do toque (`stepAdvice`, `useStepAdvice`, `markSoftDisabled`), o `Choice` e a `BottomSheet` |
| [onda-1.md](onda-1.md) §6; [onda-2.md](onda-2.md) §4.2, §6 e §10; [onda-3.md](onda-3.md) §4, §6, §8 e §11 | Pontos para o PO em aberto, o contrato da recusa e o que só a integração pegou |

---

## 1. Objetivo e itens

**Objetivo (matriz).** Qualidade e Dom seguem a regra do livro na criação, as Disciplinas do clã aparecem recomendadas, e os itens de lista sobem com −/+ na própria linha.

| ID | Sev. | Em uma linha | Onde está (conferido na ponta) |
|---|---|---|---|
| T-08 | alta | Na criação por pontos, a Qualidade era recusada com "Qualidades: não se compra na criação.", atrás da folha, e o nome sumia | **Já corrigido em parte pelo P07-C** (onda 2): o item nasce com `Custo 1` (`apps/frontend/sheet/evolve/listItem.ts:12-23`, chamado em `ListEditor.tsx:104-107` e `:372-374`), a recusa aparece dentro da folha (`ListEditor.tsx:249`, `:301`, `:312`) e o nome fica (`:217-225`). Sobra: o texto de `problemText` para item sem Custo (`apps/frontend/sheet/creation/creation.ts:255-256`) e de `refusalNotice` (`:467-471`); a prévia do custo na folha "Adicionar Qualidade" (seção 3.3) |
| T-24 | média | No W20, o Posto do Dom sobe para 2 na criação sem custo e sem aviso; o Dom só entra por nome livre | `design/templates/wta-w20.json:577-593` (`gifts`: sem `catalog`, meta `rank` 1 a 5); o Dom conta por item (`:1071-1076`, `item-count`), então o Posto não entra na conta (`packages/sheet-core/src/creation.ts:493-510`); a folha mostra o Posto como meta (`ListEditor.tsx:463-476`) |
| R-25 | média | Item de lista com valor sobe por folha: abrir, "+", Aplicar, de 3 a 5 toques por ponto | `ListEditor.tsx:117-133` (a linha é um botão que só abre a folha) e `:448-461` (o Valor só existe na folha) |
| R-26 | média | A lista de Disciplinas não marca as do clã; a Esfera de afinidade não sugere as da Tradição; a Fraqueza do clã vem vazia | `AddItemSheet`, `ListEditor.tsx:186-318` (opções na ordem do catálogo, sem selo); `ChoiceEditorRow.tsx:66-80` (a Esfera de afinidade é um `choice`, `mta-m20.json:349-362`); `vtm-v20.json:505-510` (`weakness`, `longText` sem padrão, com a ajuda "Escreva a fraqueza com as suas palavras.") |

---

## 2. Decisões aplicadas

### 2.1 Como o código acomoda cada decisão

| Decisão | O que o código faz | Se aplica como escrita? |
|---|---|---|
| **D-06** (T-08): Qualidade com bônus pelo custo do item; recusa dentro da folha, com o nome mantido; "o template `vtm-v20` é corrigido" | A compra com bônus, a recusa na folha e o nome mantido já entraram na onda 2 (P07-C, T-23 e T-19). O P07-D fecha o resto: o texto da Qualidade sem Custo, a prévia do custo na folha "Adicionar Qualidade" e um teste no servidor que prova a compra (seção 3.3) | **Em parte não.** O template não tem o que corrigir: o `vtm-v20` já cobra a Qualidade pelo meta `cost` (`vtm-v20.json:971`) e dá o crédito do Defeito até 7 (`:972`), como o W20 (`wta-w20.json:1106-1107`) e o M20 (`mta-m20.json:1000-1001`). É o ponto 1 da [onda-2.md](onda-2.md) §6, que segue para o PO (seção 2.3, ponto 1) |
| **D-07** (T-24): catálogo de Dons com nome e nível; destaque de Raça, Augúrio e Tribo; texto livre continua; aviso acima do nível 1, na linha e no "O que falta" | O catálogo entra no `catalog` que a lista já tem (só nomes), mais duas chaves novas do contrato: `catalogDefaults` (o Posto inicial de cada nome) e `recommend` (os nomes por Raça, por Augúrio e por Tribo). O aviso vem de uma regra nova e não bloqueante, `creation.advice` (`item-meta-max`). Seções 3.1, 3.2 e 3.6 | Sim |
| **D-08** (R-25): −/+ na linha de Disciplinas, Antecedentes e Dons; a folha fica para nome, especialização e notas | A linha ganha o `Stepper` inline quando o esquema do item tem `value` (`item.value`). O Valor sai da folha; os metas (Tipo, Custo, Bônus, Posto, Origem) ficam nela. Seção 3.4 | **Não para os Dons.** O Dom do W20 não tem `value`: o item conta por unidade (`item-count`), e o "nível" é o meta `rank` (Posto). Um −/+ na linha do Dom mexeria no Posto, que a D-07 manda avisar acima de 1. O plano deixa o Dom sem −/+ na linha, com o "Posto N" escrito nela, e o Posto na folha (seção 2.3, ponto 2) |
| **D-09** (R-26): Disciplinas do clã primeiro, com selo "do clã"; "fora do clã: confirme com o narrador", sem bloquear; o mesmo mecanismo na Esfera da Tradição; Fraqueza do clã preenchida com um resumo do time, editável, sem texto literal | O mesmo `recommend` da D-07 serve à lista (Disciplinas) e ao `choice` (Esfera de afinidade). A Fraqueza ganha um `default` por opção do Clã, como o `default` por opção que os recursos já têm (`ChoiceMapRef`, `packages/sheet-core/src/contract/fields.ts:44-53`), agora para texto: a ficha mostra o resumo enquanto o jogador não escreve o dele. Seções 3.1, 3.2 e 3.5 | Sim. A Fraqueza "preenchida" é um padrão mostrado, não um valor gravado; a alternativa (gravar na escolha do clã) está na pergunta 2 da seção 9 |

### 2.2 O que fica fora

- **O progresso na Mesa e o Orçamento em leitura para o narrador** são do P09-D (D-10, onda 5). Os avisos de recomendação (seção 3.2) ficam no core para o P09-D reusar, mas este pacote não os mostra ao narrador.
- **Os planos alinhados com a tela** são do P01-D (D-13, onda 5). O `regras-wod.md:74-78` ("O que fica com o narrador") continua certo: a conta não passa a cobrar Disciplina do clã nem Dom da Raça. O P01-D acrescenta que a tela agora recomenda.
- **O extrato da conta na ficha concluída** (R-17) segue como ponto do PO ([onda-2.md](onda-2.md) §6, ponto 6).
- **A ordem das listas pelo rótulo exibido (T-60) e o "Nenhuma Qualidade" (T-66)** são do P10-C. O P07-D só põe as recomendadas na frente; o resto segue a ordem que o P10-C definir.
- **O "?" em cada campo e em cada opção** é do P10-D (D-11). O P07-D reserva o lugar dele na linha (seção 3.4) e não escreve frase de ajuda, salvo a do campo `weakness`, que muda de sentido com o padrão (seção 3.5).
- **O selo e os avisos em Jogo e em Leitura.** O selo aparece no Editar e na Criação, onde se escolhe; o "fora do clã" e o Posto acima de 1, só na Criação (ficha em `creating`). No Editar de uma ficha ativa, aprender uma Disciplina fora do clã é evolução normal, paga com XP mais caro.

### 2.3 Pontos para o PO (nada decidido aqui)

Novos, deste pacote:

1. **D-06: "o template `vtm-v20` é corrigido" não se aplica** (o mesmo ponto 1 da [onda-2.md](onda-2.md) §6). O P07-D não mexe na regra da Qualidade no template. Entrega o texto e a prévia.
2. **D-08 nos Dons.** O Dom não tem valor; o −/+ na linha mexeria no Posto. Proposta técnica: sem −/+ na linha do Dom, com "Posto N" escrito, e o Posto na folha. A alternativa é o −/+ do Posto na linha (um commit à parte, seção 8.1), que deixa mais fácil subir o Posto que a D-07 manda avisar.
3. **Caitiff e Órfão.** Não têm Disciplinas de clã nem Esfera de Tradição no mapeamento (nenhum selo, nenhum aviso "fora"). A Fraqueza do Caitiff: o time escreve um resumo ou o campo fica vazio, com a ajuda. Conta como 13 + 1 resumo opcional (seção 3.10).
4. **Fichas criadas na versão anterior do template** continuam nela (a ficha guarda `template_version`, `apps/api/src/sheets/routes.ts:278`): uma ficha em criação aberta hoje no V20 1.8.0 não ganha o selo, a Fraqueza nem o catálogo. O −/+ na linha vale para todas (é código, não template). Não existe caminho de atualização de versão de ficha, e criar um é decisão nova.
5. **Nome repetido em lista sem catálogo** (nota do P07-C, achado 6 da [onda-3.md](onda-3.md) §11: "Ambidestro" duas vezes). Proposta: aceitar, avisando ("Já há “Ambidestro” na ficha") e com o botão "Adicionar outro “Ambidestro”". O servidor aceita nome repetido hoje e continua aceitando (seção 3.7).

Os pontos das ondas 1 a 3 que tocam o pacote seguem em aberto, sem decisão:

- [onda-1.md](onda-1.md) §6, ponto 5 (P06, T-09): o template marcar o que a criação exige (o Clã). Sem Clã escolhido, o P07-D só não recomenda nada (lista neutra) e diz "Escolha o Clã para ver as Disciplinas do clã" na folha. O Clã continua opcional.
- [onda-2.md](onda-2.md) §6, ponto 1 (D-06 e o template): acima.
- [onda-2.md](onda-2.md) §6, ponto 5 (R-20, o "+" desabilitado): o −/+ da linha segue o que já vale nas linhas de traço, "+" tocável com `aria-disabled` (`markSoftDisabled`, `packages/ui/src/Stepper.tsx:63-84`). Se o PO quiser `disabled` de verdade, muda nos dois lugares juntos.
- [onda-2.md](onda-2.md) §6, ponto 7 (T-62, guardar o texto ao fechar a folha): a folha "Adicionar Dom" com o catálogo continua descartando o texto ao fechar.

---

## 3. Desenho por item

### 3.0 O que o código e os templates fazem hoje

1. **A lista.** `ListEditor` (`apps/frontend/sheet/evolve/ListEditor.tsx:81-184`) desenha cada item como um `Pressable` que só abre a folha (`:117-133`). A `AddItemSheet` (`:186-318`) filtra o `catalog` pelo texto (`:207-214`), na ordem do template, e desenha cada nome como botão (`:283-304`). A `ItemSheet` (`:356-511`) tem o Valor (`:448-461`), os metas (`:463-488`), a especialização e as notas. A previsão do "+" do Valor é o `useItemAdvice` (`:327-354`), que repete parte do `useRowFeedback` (`useRowFeedback.tsx:13-48`): é a "lógica repetida" que o P07-C deixou (P07-C §10).
2. **O aviso da recusa.** O store guarda um aviso por ficha, com os caminhos dos eventos recusados (`apps/frontend/sheet/store/sheetStore.ts:590-606`). A lista grava o campo inteiro (`values.disciplines`), então o aviso tem o caminho da lista, não o do item. Por isso a folha guarda "onde foi o toque" num estado local (`at`, `ListEditor.tsx:201`) e o `useDraftNotice` da linha de traço (`hooks.ts:103-107`) não serve a um item. A previsão (`useStepAdvice`, `creation/useStepAdvice.ts:19-26`) já aceita o caminho de item (`values.<lista>#<item>`), porque a conta tem um componente por item (`packages/sheet-core/src/creation.ts:403-414`).
3. **A recomendação que já existe, escondida no XP.** O V20 já tem o mapeamento clã → Disciplinas, mas só como desconto de XP: `costs.xp.rules[discipline].when[].if.itemIn` (`vtm-v20.json:1001-1113`), uma entrada por clã, com os nomes do catálogo. O M20 tem só "a Esfera igual à afinidade" (`mta-m20.json:1028-1036`, `equalsTarget`), sem a lista de Esferas por Tradição. O W20 não tem nada para os Dons (`regras-wod.md:78`: "o pedido de XP de Dom fica indisponível").
4. **O contrato do template.** O `catalog` é uma lista de nomes (`schema.json:1308-1314`, até 200, cada um até 80; `contract/fields.ts:292`). O validador recusa chave desconhecida por tipo de campo (`packages/sheet-core/src/validate/template.ts:100-132`, `KEYS.field`), e o app que não conhece uma chave mostra "Atualize o app" / "Recarregue a página" (`apps/frontend/sheet/UnsupportedTemplate.tsx:38-47`). O `choice` aceita `meta` por opção, texto secundário que o `Choice` já desenha e põe no nome acessível (`packages/ui/src/Choice.tsx:83-85`, `:105-109`).
5. **O Dom no motor.** O W20 conta Dons por item (`wta-w20.json:1071-1076`, `item-count`, 3 básicos, 7 bônus cada). A lista está na conta, então o laço de falha segura (`creation.ts:690-708`) não a vê, e o Posto (meta) não entra em lugar nenhum. É por isso que o Posto 2 passa sem aviso (EA-14). O Renome, ao contrário, está fora da conta e cai no `CREATION_NOT_PURCHASABLE` (a "Glória: não se compra na criação." que a matriz cita). A D-07 escolhe avisar, não bloquear.
6. **A Fraqueza.** `weakness` é `longText` com `maxLength: 600` (`vtm-v20.json:505-510`) e não aceita `default`: o `resolve` devolve o texto gravado ou vazio (`packages/sheet-core/src/resolve.ts:479-486`). O texto não está na identidade, então a "Nova ficha" não o manda: a API só aceita os campos da identidade na criação (`apps/api/src/sheets/routes.ts:159-173`).
7. **A causa provável da matriz.** A R-26 cita "`ListEditor.tsx` e o template `vtm-v20` (clã → Disciplinas)": confere, com a ressalva de que o mapeamento já está no template, no XP. A T-24 cita "limites da criação em `packages/sheet-core/src/creation.ts`": o aviso não entra no `checkCreation` (ele bloquearia ou mudaria o `complete`); entra numa função pura ao lado (seção 3.2). O T-08 cita `apps/frontend/sheet/creation/creation.ts` l.188 (`CREATION_NOT_PURCHASABLE`): na ponta é a l.255 (`problemText`) e a l.467 (`refusalNotice`), e a causa (item sem `meta`) já foi corrigida no P07-C.

### 3.1 O contrato do template: o que muda (`schema.json`, `validateTemplate`, `validate.mjs`, README)

Quatro chaves novas, todas opcionais e aditivas. Um template sem elas continua válido e igual. O padrão é o do commit `733c915`, que trouxe as `suggestions` do campo `text`: core (contrato e validador), `schema.json`, o validador de referência (`design/scripts/validate.mjs`), o README e o teste de paridade (`packages/sheet-core/src/__tests__/parity.test.ts`).

**1. `recommend` em `list` e em `choice`: o que a identidade recomenda.**

```jsonc
// vtm-v20.json, em fields.disciplines (exemplo de forma; os nomes são os do catálogo)
"recommend": {
  "outside": "fora do clã",
  "by": [
    { "from": "clan", "label": "do clã",
      "map": { "brujah": ["<Disciplina>", "<Disciplina>", "<Disciplina>"], "...": [] } }
  ]
}
// wta-w20.json, em fields.gifts: três fontes, um selo por fonte
"recommend": {
  "outside": "fora da Raça, do Augúrio e da Tribo",
  "by": [
    { "from": "breed",   "label": "da Raça",    "map": { "lupino": ["<Dom>", "..."] } },
    { "from": "auspice", "label": "do Augúrio", "map": { "ahroun": ["<Dom>", "..."] } },
    { "from": "tribe",   "label": "da Tribo",   "map": { "fianna": ["<Dom>", "..."] } }
  ]
}
// mta-m20.json, em fields.affinity (um choice): ids de opção, não nomes
"recommend": {
  "outside": "fora da Tradição",
  "by": [ { "from": "tradition", "label": "da Tradição", "map": { "verbena": ["<id de Esfera>", "..."] } } ]
}
```

Regras (schema e validador, as mesmas nos dois):

- `by`: de 1 a 4 fontes. `from` é um campo `choice` que existe; as chaves de `map` são ids de opção desse `choice` (como o `default` por opção, `validate/template.ts:319-335`), no máximo 100;
- cada valor de `map`: até 200 entradas, sem repetição. Numa `list`, cada entrada é um nome do `catalog` do próprio campo (a mesma checagem do `itemIn`, `validate/accounting.ts:127-131`). Num `choice`, cada entrada é um id de opção do próprio campo;
- `label`: texto seguro, até 24 caracteres. `outside`: texto seguro, até 60;
- uma opção sem entrada em `map` (Caitiff, Órfão) não recomenda nada;
- o `walk` do validador já recusa `__proto__`, `constructor` e `prototype` em qualquer profundidade (`validate/template.ts:341-360`), e o acesso ao `map` usa `Object.hasOwn`.

**2. `catalogDefaults` em `list`: o meta inicial de cada nome do catálogo.**

```jsonc
// wta-w20.json, em fields.gifts
"catalogDefaults": [
  { "meta": "rank", "value": 1, "items": ["<Dom>", "<Dom>", "..."] },
  { "meta": "rank", "value": 2, "items": ["<Dom>", "..."] }
]
```

- `meta` é um meta `number` do `item.meta` do campo; `value` cabe no `min`/`max` dele; `items` são nomes do `catalog`, e cada nome aparece no máximo uma vez por `meta`;
- até 10 entradas, cada uma com até 200 nomes;
- o `catalog` continua uma lista de nomes. Nenhum dos quatro lugares que leem o `catalog` (`classify.ts:274`, `accounting.ts:77`, `validate/accounting.ts:130`, `apps/frontend/sheet/xp/candidates.ts:57`) muda. O desconto de XP por `itemIn`, que só vale para nome do catálogo, fica intocado.

Ao adicionar um nome do catálogo, o item nasce com esse meta (o Dom de Posto 2 nasce com `rank: 2`). Sem entrada, vale o `min` do meta, como hoje (`withItemDefaults`).

**3. `default` por opção em `text` e `longText`.**

```jsonc
// vtm-v20.json, em fields.weakness
"default": { "from": "clan", "map": { "brujah": "<resumo de uma linha, escrito pelo time>", "...": "..." } }
```

- a forma é a do `ChoiceMapRef` de hoje, com texto no lugar de número: `TextChoiceDefault { from, map: Record<optionId, string> }`;
- cada texto é seguro (uma linha, sem `<`/`>`), até o `maxLength` do campo e no máximo 400 (o limite do `help`);
- a regra de leitura é a de todo `default` do contrato (README §3): vale enquanto a ficha não grava o campo. A seção 3.5 diz o que isso faz na tela.

**4. `creation.advice`: avisos que não bloqueiam.**

```jsonc
// wta-w20.json, em creation
"advice": [ { "rule": "item-meta-max", "targets": ["gifts"], "meta": "rank", "max": 1 } ]
```

- lista fechada de regras (`REGISTRY.creationAdvice` = `["item-meta-max"]`, com o `enum` igual no `schema.json` e o teste de paridade);
- `targets`: listas do template; `meta`: meta `number` de todas elas; `max`: inteiro na faixa do meta;
- até 20 entradas. O `KEYS.creation` (`validate/accounting.ts:41`) ganha `advice`.

**O que não muda no contrato:** o `catalog` (só nomes, até 200, até 80 caracteres), o `item.meta`, as regras de conta (`budgets`, `caps`, `baselines`, `costs`). A versão do contrato (`schema: 1`) fica: as chaves são aditivas, e o app antigo que as encontra recusa o template (falha segura), como o README §9 manda.

**README.** §3 (o `default` por opção em texto), §3 `list` (`recommend`, `catalogDefaults`), §14 (`creation.advice`, "avisa, não bloqueia; a conta não lê") e §12 (licença: "o `catalog` e o `recommend` trazem só nomes; o resumo do `default` é escrito pelo time, nunca copiado do livro").

### 3.2 O motor (`packages/sheet-core`)

**Arquivo novo `src/recommend.ts`, puro, exportado no `index.ts`:**

```ts
/** Os selos de cada nome (lista) ou id (choice) recomendado pela identidade. */
export function recommendedFor(
  model: SheetModel, sheet: ResolvedSheet, field: FieldId
): ReadonlyMap<string, readonly string[]> // nome → ["do clã"] ou ["da Raça", "da Tribo"]

export interface CreationAdvice {
  readonly code: 'ADVICE_ABOVE_LEVEL' | 'ADVICE_OUTSIDE'
  readonly field: FieldId
  readonly paths: readonly string[]  // `values.<lista>#<item>` ou `values.<choice>`
  readonly amount: number            // quantos itens
}

/** O que a criação só avisa (D-07, D-09). Nunca entra no `checkCreation`. */
export function creationAdvice(model: SheetModel, sheet: ResolvedSheet): readonly CreationAdvice[]
```

- `recommendedFor` lê o `recommend` do campo e o valor de cada `from` na ficha resolvida (o `choiceOf` que o `conditionHolds` usa, `accounting.ts:66-80`). Sem escolha no `from`, nada é recomendado;
- `creationAdvice` junta dois avisos:
  - `ADVICE_ABOVE_LEVEL`: item de lista em `creation.advice` com o meta acima do `max` (o Dom com Posto 2);
  - `ADVICE_OUTSIDE`: item de lista com `recommend` cujo nome não está nas recomendações (só quando alguma fonte recomenda algo: com o Clã vazio ou Caitiff, nada fica "fora"); `choice` com `recommend` cuja opção escolhida não está nas recomendações (a afinidade fora da Tradição);
- não mexe em `checkCreation`, `complete`, `savable`, `checkCreationBatch` nem `completionRefusal`. O servidor não chama a função, e nada que ele confere muda. Ela fica no core porque o mesmo aviso vai servir ao narrador (P09-D) e à revisão, e porque o `index.ts` do core é onde a tela e o servidor buscam regra de template;
- só ids do template, caminhos e contagens: nenhum texto da ficha, como o `CreationProblem` (`creation.ts:82-95`).

**`default` por opção em texto, no `resolve`.** O caso `text`/`longText` (`resolve.ts:479-486`) passa a devolver o texto do `map` pela opção do `from` quando a ficha não grava o campo (`raw(id) === undefined`). O valor gravado, inclusive vazio, vence. O `from` dos eventos continua o valor guardado (`valueAt`, `apps/frontend/sheet/store/sheetStore.ts:362-368`), então o primeiro "Aplicar" sai com `from: null`, como no `default` da Humanidade. O `creationFreeze` (`creation.ts:828-857`) não muda: ele congela fórmula numérica para a evolução não subir de graça, e o texto não tem esse risco (a ficha guarda a versão do template; o resumo não muda depois).

**Quem reconstrói o `dist` e quando.** O Metro e o Jest leem o `src` do `@tms/sheet-core` (`apps/frontend/metro.config.js`, `jest.config.js:48`). A API, as migrations, o `templates:publish` e o `seed:roteiro` leem o `dist` (o `check-dev-env.mjs` recusa subir com o `dist` velho e diz `pnpm bootstrap`). Portanto:

- no pacote, quem implementa roda `npx pnpm -C packages/sheet-core build` depois dos commits 2 e 3 (seção 8.1), antes dos testes da API e do roteiro manual;
- na integração da onda, depois do merge do P07-D, o orquestrador roda `npx pnpm bootstrap` (ou `npx pnpm build`) antes dos testes da API, do E2E e do `templates:publish`;
- o CI já compila os pacotes antes dos testes (P01-C).

**`/security-review` é obrigatório** (seção 5): o validador do template roda no servidor na publicação, e o `resolve` roda no servidor em toda leitura de ficha.

### 3.3 T-08 · Qualidade: o que sobra depois do P07-C

**O que já entrou (onda 2, conferido na ponta):**

- o item nasce com `Custo 1` (`withItemDefaults`, `listItem.ts:12-23`), e a regra `item-meta` cobra o custo (`creation.ts:662-687`);
- a recusa (saldo que não cobre) aparece dentro da folha, perto da opção ou do botão tocado (`ListEditor.tsx:249`, `:301`, `:312`), e o nome digitado fica (`:217-225`);
- o E2E `advantages.spec.ts:82-90` adiciona "Ambidestro" e vê "Custo 1"; o saldo cai (`:92-95`).

**O que o P07-D faz:**

1. **O texto da Qualidade sem Custo.** O `CREATION_NOT_PURCHASABLE` de uma linha `item-meta` (item gravado sem o meta, por um app antigo ou pela API) ainda diz "Qualidades: não se compra na criação." (`creation.ts:255-256` no "O que falta"; `:467-471` na recusa). É o texto enganoso do QAA-05. O `problemText` e o `refusalNotice` passam a separar os dois casos pelos caminhos do problema: caminho de item de um campo com regra `item-meta` → "Qualidades: um item está sem Custo. Abra o item e informe o Custo." (rascunho do time, para revisão). O "não se compra na criação" fica para o que de fato não se compra (Renome, grupo sem preço). Só rótulos do template; o código do problema não muda.
2. **A prévia do custo na folha "Adicionar Qualidade"** (a prévia do item novo, seção 3.7): "Custa o Custo do item em bônus (começa em 1); restam N." Com saldo zero, a mesma linha diz "restam 0", e o toque continua dando a recusa dentro da folha (P07-C).
3. **A previsão do "+" do Custo na folha.** O "+" do Custo (meta `cost`, linha `item-meta`) ganha a mesma previsão do Valor: "+1 = 1 bônus; restam N", e o "+" com `aria-disabled` sem saldo. É genérico: vale para qualquer meta lido por uma regra `item-meta` ou `credit` (no Defeito, "+1 = devolve 1, até 7"). Commit separável (seção 8.1).
4. **A prova no servidor** (passa antes e depois): a Qualidade com Custo 2, na fase de Pontos básicos, entra e o saldo de bônus cai 2 (`apps/api/src/__tests__/creation.test.ts`). Prova que a D-06 vale no servidor, sem o template mudar.

**Fase de Pontos básicos.** A Qualidade (como a FdV e a Humanidade) é uma linha de bônus fora dos grupos, e a trava da fase só vale para os grupos (`draftRefusal`, `creation.ts:505-545`). Comprar uma Qualidade em "Pontos básicos" gasta bônus e entra. É o comportamento de hoje; o P05-D troca a alternância por um indicador de fase e decide se isso muda.

### 3.4 R-25 · −/+ na própria linha dos itens com valor

**Regra genérica.** Toda lista cujo esquema tem `item.value` ganha o `Stepper` inline na linha, no Editar e na Criação: Disciplinas e Antecedentes (V20), Antecedentes (W20, M20) e a Ressonância do Mago (lista fixa com valor, `fixed`). A lista sem `value` (Qualidades, Defeitos, Dons, Ritos, Fetiches, Rotinas, Maravilhas) mantém a linha como hoje. Em Jogo e em Leitura, nada muda (`ListRow`, `views/ListView.tsx`).

**A linha (componente novo `ItemEditorRow`, dentro de `ListEditor.tsx`):**

```
| [nome do item                ]  [?]  [ − ] 2 [ + ] |
| [do clã · Especialização: X  ]                     |
| [fora do clã: confirme com o narrador]             |   ← só na Criação
| [aviso da recusa (DraftNoticeText)]                |   ← perto do toque
```

- **Coluna do nome:** um `Pressable` só com o texto (nunca com o `Stepper` dentro, para não aninhar botões no web), papel `button`, nome acessível `describeItem(...)` mais o selo ("Potência, 2 de 5, do clã") e a dica "Abre o item: nome, especialização e notas". Embaixo, em `caption` e `inkMuted`, uma linha com o selo e os metas e a especialização que o `ItemLine` já escreve (`ListView.tsx:89-131`); os pips (`RatingDots`) saem da linha, porque o `Stepper` mostra o número.
- **O "?" do P10-D não entra na linha do item** (consolidação, [onda-4.md](onda-4.md) §4.4). O P10-D põe a frase do item no topo da `ItemSheet`, que a linha abre, e o "?" na opção da `AddItemSheet` (P10-D §3.5). A linha não ganha o slot `help`, e o nome fica com os 172 dp da tabela abaixo.
- **O `Stepper`:** `label` = o título do item ("Potência"), `value`/`min`/`max` do `item.value`, `valueText` "2 de 5", `increase` da previsão. No web, os botões se chamam "Aumentar Potência" e "Diminuir Potência" (`Stepper.tsx:179-182`); no app, o controle é ajustável com o nome "Potência" e o valor "2 de 5" (`:205-225`), como os traços. Sem "Digitar" (o valor vai de 0 a 5).
- **Política:** como o `NumberEditorRow` (`:61`, `:239-244`), o `useBlockedNote(list.id)` desabilita o `Stepper` e escreve o motivo ("Peça ao narrador") quando a política bloqueia o avanço numa ficha ativa.
- **O "−" até o mínimo do esquema** (0 no V20): o item com 0 fica na lista; tirar é pela folha ("Remover"), como hoje.

**Medida a 360 dp (Android, alvo de 48), sem fonte aumentada:**

| Peça | Largura |
|---|---|
| Área útil (360 − 2 × 16 do `gutter`) | 328 |
| `Stepper` inline: − (48) + 8 + número (32) + 8 + + (48) | 144 |
| Espaço de 12 entre o nome e o `Stepper` | 12 |
| **Sobra para o nome** | **172** (seria 112 com o "?" na linha, que a consolidação tirou) |

No iOS e no web (alvo de 44), o `Stepper` mede 136: a 390 px, sobram 210 px para o nome. Um nome de catálogo de 13 letras cabe em uma linha a 172 dp; nome livre longo (até 80) quebra em duas linhas e corta com reticências na terceira (`numberOfLines={2}` só no visual; o nome acessível é inteiro). A linha cresce para baixo, como o `EditorShell` (`EditorShell.tsx:9-59`). Cada alvo (−, +, "?", nome) tem pelo menos 44 × 44 (48 no Android), pelo `Pressable` do `@tms/ui` (`minTarget`, `Pressable.tsx:39-61`).

**A escrita e o aviso perto do toque.** O "+" da linha grava a lista inteira, como a folha (`set('values.<lista>', …)`). Para o aviso do store cair na linha certa, sem o estado `at` local:

- o `setDraftValue` do store ganha um terceiro argumento opcional, `{ at?: string }` (`sheetStore.ts:259` e `:676-680`), e o aviso recusado passa a ter os caminhos dos eventos **mais** o `at` (`:599-606`). O `useSetDraft` (`hooks.ts:78-90`) repassa;
- a linha chama `set('values.disciplines', next, { at: 'values.disciplines#i2' })`, e o aviso volta pelo `useDraftNotice('values.disciplines#i2')`, que já casa caminho igual (`hooks.ts:93-107`);
- a linha usa o `useRowFeedback(path, field)` do P05-C com o caminho do item e `field = '<lista>-<item>'`: o aviso, a nota do custo e o `increase` do "+", com o `hintID` para o `aria-describedby` no web. É a mesma peça das linhas de traço;
- a folha do item deixa o `useItemAdvice` (`ListEditor.tsx:327-354`) e usa o mesmo `useRowFeedback` no "+" do Custo e do Bônus (seção 3.3, item 3). Isso tira a lógica repetida que o P07-C deixou;
- a `AddItemSheet` continua com o `at` local, porque o item ainda não existe: a recusa da opção tocada segue como no P07-C.

**A folha do item.** O Valor (`ListEditor.tsx:448-462`) sai da `ItemSheet`. Ficam o nome, os metas, a especialização, as notas e o "Remover". O título continua o nome do item. "Aplicar" sem mudança continua como hoje: só grava o mínimo dos metas de um item antigo sem eles (P07-C, §10).

**O "O que falta" e o cabeçalho.** Nada muda no contador do bloco ("Disciplinas · 2/3", T-58): ele é recalculado pelo store a cada toque.

### 3.5 R-26 · "do clã", "da Tradição", "fora do clã" e a Fraqueza

**Na folha "Adicionar Disciplina"** (`AddItemSheet`, `ListEditor.tsx:186-318`):

- com o Clã escolhido, a folha abre com dois blocos: "Do clã" (as recomendadas, com o selo como texto em `caption`) e "Outras". Cada bloco segue a ordem que o P10-C definir (T-60). Com texto na busca, a mesma divisão vale para o que casar;
- o nome acessível da opção é "Potência, do clã" (o selo entra como texto, não só como cor);
- sem Clã escolhido, uma linha "Escolha o Clã na identidade para ver as Disciplinas do clã." (rascunho do time, para revisão) e a lista neutra;
- **escolher uma "Outra" na Criação** adiciona normalmente; a linha nova mostra "fora do clã: confirme com o narrador" e o "O que falta" ganha o item (seção 3.8). Nada bloqueia, e o servidor não confere (`regras-wod.md:76`).

**Na linha da Disciplina** (seção 3.4): o selo "do clã" na linha de baixo; na Criação, "fora do clã: confirme com o narrador" (o `outside` do template mais o sufixo genérico ": confirme com o narrador", que é texto do app). No Editar de ficha ativa, só o selo.

**Na Esfera de afinidade do Mago** (`ChoiceEditorRow.tsx:66-80`): as opções recomendadas pela Tradição vêm primeiro e levam `meta: 'da Tradição'`, que o `Choice` já desenha e lê no nome ("Forças, da Tradição", `Choice.tsx:83-85`). O `@tms/ui` não muda. Na Criação, com uma Esfera fora da Tradição escolhida, a linha do campo mostra "fora da Tradição: confirme com o narrador" sob o valor. O `ChoiceEditorRow` é genérico: qualquer `choice` com `recommend` ganha o mesmo tratamento.

**A Fraqueza do clã já preenchida:**

- o `vtm-v20` ganha `weakness.default = { from: 'clan', map: { … } }` (seção 3.1, chave 3), com um resumo por clã escrito pelo time;
- **quando é preenchida:** a qualquer momento em que a ficha tenha Clã e não tenha a Fraqueza gravada. Escolher o Clã na "Nova ficha" ou trocá-lo no Editar já mostra o resumo do clã novo. Nada é gravado sozinho: a ficha não ganha uma "alteração não salva" que o jogador não fez, e a API da "Nova ficha" continua aceitando só a identidade (`routes.ts:159-173`);
- **se o jogador editou:** o texto dele é gravado e vence. Trocar o Clã depois não o apaga. Na Criação, com o texto gravado diferente do resumo do clã atual, o editor da Fraqueza oferece "Usar o resumo do clã" (um botão `ghost`, que grava o resumo no rascunho, com confirmação "Trocar o seu texto pelo resumo do clã?");
- **se o jogador apagar tudo**, o campo volta a mostrar o resumo do clã (o vazio não é gravado: `cleanItem` e o editor de texto mandam `null`). A ajuda do campo diz isso;
- a ajuda (`help`) do campo muda de "Escreva a fraqueza com as suas palavras." para "Começa com um resumo do time para o clã escolhido. Reescreva como a mesa preferir; apagar tudo volta ao resumo." (rascunho do time, para revisão). É a única frase de ajuda que o P07-D escreve; o P10-D (D-11) é avisado (seção 8.4);
- **onde aparece:** no Editar e na Criação (editor de texto) e em Jogo e Leitura (o valor resolvido), para o dono e para o narrador.

### 3.6 T-24 · Catálogo de Dons, nível e o aviso acima do Posto 1

**O template (`wta-w20.json`, `gifts`, `:577-593`):**

- `catalog`: os nomes dos Dons, só nomes (até 80 caracteres cada, até 200 no total);
- `catalogDefaults`: o Posto de cada nome (seção 3.1, chave 2);
- `recommend`: as três fontes, Raça (3 opções), Augúrio (5) e Tribo (13), com os selos "da Raça", "do Augúrio" e "da Tribo";
- `creation.advice`: `item-meta-max` no meta `rank`, `max: 1`.

**Quantos nomes.** Na criação, o W20 dá 3 Dons de nível 1, um da Raça, um do Augúrio e um da Tribo (`regras-wod.md:15` e `:78`). O catálogo precisa, no mínimo, dos Dons de nível 1 dos **21 grupos** que o `wta-w20.json` tem (3 Raças, `:47-55`; 5 Augúrios, `:56-92`; 13 Tribos, `:93-113`). Estimativa a conferir no livro: de 4 a 6 por grupo, de 85 a 125 nomes, com repetição entre grupos (um Dom pode ser de uma Raça e de uma Tribo; o `recommend` aceita o mesmo nome em várias fontes, e a opção mostra os dois selos). Cabe no limite de 200 do `catalog`. Os Postos 2 a 5 (para a evolução) passariam de 200 e ficam para depois (pergunta 4 da seção 9).

**A folha "Adicionar Dom":**

- o campo passa a "Buscar Dom" (o rótulo que a lista com catálogo já usa, `ListEditor.tsx:265`);
- sem texto na busca, a folha mostra só as recomendadas, em três blocos com o título da fonte e a opção escolhida ("Da Raça · Lupino", "Do Augúrio · Ahroun", "Da Tribo · Fianna"), e "Busque para ver os outros Dons". Isso limita a folha a uns 15 botões, em vez de 100 dentro do `Modal` no Android;
- cada opção diz o Posto: "<Dom>, Posto 1, da Raça" (nome acessível e texto);
- com texto na busca, os nomes que casam, com os selos, e o "Adicionar “…”" para o texto livre, que continua (D-07). Dom do catálogo de Posto 2 entra com `rank: 2`;
- o Enter (T-62) segue a regra do P07-C: nome exato do catálogo adiciona; com sugestões à vista, explica.

**O aviso acima do Posto 1 (só na Criação):**

- **na linha do Dom:** "Posto 2 · na criação, os Dons são de Posto 1: confirme com o narrador." (rascunho do time, para revisão), em `caption` `inkMuted`, logo abaixo do nome;
- **na folha do item:** a mesma frase sob o `Stepper` do Posto, quando ele passa de 1;
- **no "O que falta" do P05-D** (seção 3.8): "Dons: 1 acima do Posto 1 (confirme com o narrador)." Contagem, sem o nome do Dom;
- **nada bloqueia:** o "+" do Posto continua normal (não é previsão de conta), "Concluir" continua disponível, e o servidor aceita como hoje (o Posto está fora da conta).

**O que não muda:** a conta dos Dons (3 itens básicos, 7 de bônus por item), o validador da ficha (Posto de 1 a 5, `validate/sheet.ts:280-292`) e o pedido de XP de Dom (indisponível, `regras-wod.md:78`).

### 3.7 Notas do P07-C: prévia do item novo, nome repetido e a lógica repetida

**Prévia do item novo** (P07-C §3.1 e onda-2 §4.2: "fica para o P07-D"). O `stepAdvice` trata de item que já existe. A folha "Adicionar …" ganha uma linha só, sob o campo de busca, com o que um item novo faria:

- função pura nova `addAdvice(model, check, phase, listId)` em `apps/frontend/sheet/creation/creation.ts`, ao lado do `stepAdvice` (`:588`). Acha o grupo da lista pelo template (`creation.budgets[].targets`) e a linha de bônus pelo `costs.freebie[].targets`, e reusa o `groupAdvice` (`:639`) com um componente virtual no valor inicial;
- textos (rascunho do time, para revisão): "Entra com 1 ponto básico (faltam 2 de 3)."; "+1 = 7 bônus; restam 8."; "Dons: o próximo custa 7 de bônus; restam 8."; "Custa o Custo do item em bônus (começa em 1); restam N."; "Devolve o Bônus do item, até 7 no total.". Bloqueado (grupo cheio em Pontos básicos), a linha diz o motivo (`basicsSpentText`), e as opções continuam tocáveis: o toque decide, com a recusa dentro da folha (P07-C);
- **uma linha por folha, não por opção:** uma prévia por opção rodaria um `checkCreation` cada (P07-C §3.1). O custo de um item novo é o mesmo para todas as opções da lista;
- só na Criação com a conta (`s.check`); fora dela, nada.

**Nome repetido** (seção 2.3, ponto 5). Na lista sem catálogo, com o texto igual (pelo `fold`) a um item da ficha:

- o botão vira "Adicionar outro “Ambidestro”", com a linha "Já há “Ambidestro” na ficha." acima;
- o Enter não adiciona e explica, como já faz com o nome do catálogo (`ListEditor.tsx:241-247`);
- na lista com catálogo, nada muda: o nome do catálogo já na ficha é "já na ficha" e desabilitado (`:284-299`), e o texto livre igual a um nome do catálogo vira o nome do catálogo (`exact`).

**A lógica repetida com o `useRowFeedback`** (P07-C §10): resolvida pelo `at` no store e pelo uso do `useRowFeedback` com caminho de item (seção 3.4). O `useItemAdvice` sai.

### 3.8 O "O que falta" (P05-D) e a barra

- **Quem gera:** o `creationAdvice` do sheet-core (seção 3.2), num seletor novo do store (`useCreationAdvice()`), calculado com a ficha mostrada (`display`) sempre que a ficha está em `creating`, nos dois modos de criação. A tela traduz cada aviso em frase com `adviceText(model, a)`, em `apps/frontend/sheet/creation/creation.ts`, só com rótulos do template e números: "Dons: 1 acima do Posto 1 (confirme com o narrador)."; "Disciplinas: 2 fora do clã (confirme com o narrador)."; "Esfera de afinidade: fora da Tradição (confirme com o narrador).";
- **onde aparece:** no "O que falta" do painel de pontos (`CreationPanel.tsx:229-246` hoje; a aba "Pontos" do P05-D), depois dos problemas da conta, em `caption` `inkMuted`, nunca `danger`. Não entra no "Faltam: …" da barra (D-05): a barra diz o que impede concluir, e o aviso não impede;
- **o item tocável:** o mesmo formato que o P05-D definir para os problemas (botão que leva ao grupo do campo, pelo `findGroup`/`groupFor`, `creation.ts:128-155`). O P07-D entrega `{ key, text, field, path, tone: 'advice' }`; o P05-D desenha. Se o P05-D atrasar, o P07-D põe os avisos como texto no bloco de hoje, sem toque;
- **na criação livre** não há painel de pontos: o aviso fica só na linha;
- **o "Concluir"** não muda: `completionRefusal` não lê os avisos.

### 3.9 `BottomSheet`: nada regride

O P07-D não muda o `BottomSheet` (`packages/ui/src/BottomSheet.tsx`) nem a API dele. As duas folhas mudam só o `children`:

- o Esc na captura da raiz (`:233`), o foco de volta ao gatilho (`restoreFocus`, `:184-205`), um "Fechar" só (T-71);
- o diálogo central de até 560 no desktop (`:320`) e a folha presa embaixo a 390;
- o `onClosed` (`:136`, `:198-205`), que faz a troca de folha no iOS: a linha nova abre a `ItemSheet` pelo nome, e o "+"/"−" da linha não abre folha nenhuma;
- o texto do evento no Enter da "Adicionar …" (`ListEditor.tsx:235-238` e `:281`, `e0a4078`);
- os `testID` `add-sheet-<lista>` e `item-sheet-<lista>`.

A "Adicionar Dom" com blocos rola dentro do `ScrollView` da folha (`:290-292`); a 1280, cabe no diálogo de 560 com `maxHeight` 85%.

### 3.10 Templates: conteúdo, versão, publicação e a ficha da versão anterior

**O que o time escreve ou compila (contado nos templates):**

| Sistema | Conteúdo | Quantos | É texto do livro? | Quem |
|---|---|---|---|---|
| V20 | `disciplines.recommend`: Disciplinas por clã | 13 entradas (14 opções de Clã, `vtm-v20.json:44-62`, menos Caitiff), 3 nomes cada, todos já no `catalog` (17 nomes, `:441-459`) | Não: nomes do catálogo, os mesmos do XP (`:1001-1113`) e de `regras-wod.md:54-70`. Um teste confere que o `recommend` e o `itemIn` do XP batem | Quem implementa, copiando do template |
| V20 | `weakness.default`: resumo da Fraqueza por clã | **13 resumos** (+1 opcional, Caitiff; seção 2.3, ponto 3), uma linha cada, até 400 caracteres | **Não pode ser.** Escrito pelo time com palavras próprias, sem copiar nem parafrasear frase a frase. Formato: "rascunho do time, para revisão: uma frase sobre o que a maldição do clã impõe em jogo e quando o narrador pede teste" | O time (PO ou quem conhece o sistema), revisado por uma segunda pessoa |
| M20 | `affinity.recommend`: Esferas por Tradição | **9 entradas** (10 opções de Tradição, `mta-m20.json:44-55`, menos Órfão), ids das 9 Esferas (`:349-362`) | Não: ids do template | O time compila; duas fontes, como o `regras-wod.md` |
| W20 | `gifts.catalog` + `catalogDefaults` + `recommend` | Dons de nível 1 dos **21 grupos** (estimativa: de 85 a 125 nomes; seção 3.6) | Os nomes, em português, são dado de jogo, mas vêm da tradução publicada | O time compila (duas fontes); **a licença dos nomes é conferida por quem cuida da parte jurídica** (README §12), antes do merge |
| Os três | Textos curtos do `recommend` | 8: "do clã", "fora do clã", "da Tradição", "fora da Tradição", "da Raça", "do Augúrio", "da Tribo", "fora da Raça, do Augúrio e da Tribo" | Não: texto do app | Quem implementa |
| V20 | `weakness.help` (a frase nova) | 1 | Não | Quem implementa; revisão do time |

Sem os dados do time, o pacote entra com o mecanismo e os mapeamentos de nomes (V20) e ids (M20); o catálogo de Dons e os resumos da Fraqueza entram num commit próprio (8), que espera o conteúdo e a licença (seção 8.3).

**Versão.** Proposta: **um aumento por onda e por sistema**, feito uma vez na integração, depois do último PR de template da onda (P07-D, P10-C, P10-D e, se entrar, o P15-D): `vtm-v20` 1.8.0 → 1.9.0, `wta-w20` 1.6.0 → 1.7.0, `mta-m20` 1.6.0 → 1.7.0 (minor: chaves aditivas). Os PRs de pacote não sobem a versão: dois pacotes subindo a mesma versão com conteúdo diferente dariam "já foi publicado com outro conteúdo" (`apps/api/src/templates/publish.ts:105-114`) no banco de quem testou os dois. O `apps/api/src/templates/__tests__/publish.test.ts:185-243` fixa `1.8.0` e usa `1.9.0` como "próxima": muda junto com o aumento.

**Publicação.**

- Em desenvolvimento e no roteiro do pacote, sem subir a versão: um banco local novo (seção 11.a). A migration `0020_product_templates` grava o JSON do repositório no banco novo, e o `templates:publish --published` responde "sem mudança".
- Na integração, com a versão nova: `npx pnpm templates:publish --published` grava as três versões, depois do `npx pnpm bootstrap` (o script recusa o `dist` velho, `apps/api/package.json:15`).
- **Em produção, o app antes do template** (README §9, passo 5; `doc/arquitetura-motor-de-ficha.md:167`): o app antigo que abre uma ficha da versão nova cai no "Atualize o app" / "Recarregue a página", porque não conhece as chaves. O web se resolve com o deploy; o app nativo precisa da versão nova na loja antes da publicação. O `deploy/render/start.sh:20` só roda migrations: a versão nova chega a produção por uma migration nova (como a `0020`, regra do `regras-wod.md:5`) ou por um `templates:publish` manual. O precedente `733c915` (vtm-v20 1.8.0) não teve migration. Pergunta 1 da seção 9.

**A ficha da versão anterior.** A ficha guarda a versão (`characters.template_version`, `routes.ts:278`; o modelo é buscado pela versão, `:372`). A ficha criada no 1.8.0 continua no 1.8.0: abre no app novo, sem o selo, sem a Fraqueza preenchida e sem o catálogo de Dons; o −/+ na linha vale. O app novo lê o template antigo porque as chaves são opcionais. Seção 2.3, ponto 4.

### 3.11 O que muda na API pública

- **API HTTP:** nada. Nenhuma rota nova, nenhum corpo novo.
- **`@tms/ui`:** nada. O selo vai no `meta` do `Choice` e em `Text`; o `Stepper` inline já existe.
- **Contrato do template (`schema.json` e `validateTemplate`):** as quatro chaves da seção 3.1. Nenhuma sai, nenhuma muda de sentido.
- **`@tms/sheet-core`:** exporta `recommendedFor`, `creationAdvice` e o tipo `CreationAdvice`; o `resolve` passa a aplicar o `default` por opção em texto. Nenhuma assinatura existente muda.
- **Store do app:** `setDraftValue(path, to, options?: { at?: string })`, aditivo.

---

## 4. Testes

### 4.1 Um teste de regressão por item (falha antes, passa depois)

| Item | Teste | Onde | O que prova |
|---|---|---|---|
| T-08 | "Qualidade sem Custo: o 'O que falta' diz 'um item está sem Custo', não 'não se compra'" | `apps/frontend/sheet/creation/__tests__/creation.test.ts` (unidade do `problemText` e do `refusalNotice`; conferir com `jest --listTests` que o arquivo roda) | O texto do QAA-05 deixa de aparecer para Qualidade |
| T-08 | "Folha 'Adicionar Qualidade' na Criação mostra o custo e o saldo antes do toque" | `apps/frontend/sheet/creation/__tests__/advantages.test.tsx` | A prévia (`addAdvice`) |
| T-24 | "Dom do catálogo de Posto 2 entra com Posto 2; a linha e o 'O que falta' avisam 'confirme com o narrador'; o 'Concluir' continua" | `advantages.test.tsx`, template W20 | Aviso sem bloqueio |
| T-24 | "Folha 'Adicionar Dom' de um Lupino Ahroun Fianna abre com os três blocos e os selos; a busca acha um Dom de outra Tribo; o texto livre continua" | `apps/frontend/sheet/evolve/__tests__/ListEditor.test.tsx` | Catálogo, destaque e texto livre |
| T-24 | `creationAdvice`: Posto acima do `max`, igual ao `max`, sem meta, lista fora de `creation.advice` | `packages/sheet-core/src/__tests__/recommend.test.ts` (novo) | A regra pura |
| R-25 | "Disciplina na linha: '+' sobe 1 → 2 sem abrir folha; '−' desce; a folha não tem mais o Valor" | `ListEditor.test.tsx` | O −/+ na linha |
| R-25 | "4ª Disciplina em Pontos básicos pela linha: o '+' tem `aria-disabled` e o aviso aparece sob a linha tocada, não sob outra" | `advantages.test.tsx` | O `at` no store e o `useRowFeedback` com caminho de item |
| R-25 | "Ficha ativa, dona: o `Stepper` da linha fica desabilitado com 'Peça ao narrador'" | `ListEditor.test.tsx` | A política, como no `NumberEditorRow` |
| R-25 | "Lista sem valor (Qualidades, Dons): sem `Stepper` na linha" | `ListEditor.test.tsx` | A regra genérica |
| R-26 | "Brujah: 'Adicionar Disciplina' abre com 'Do clã' (3) e 'Outras' (14); 'Dominação' entra e a linha diz 'fora do clã: confirme com o narrador'" | `advantages.test.tsx` | O cenário do IA-07 |
| R-26 | "Sem Clã: lista neutra e a linha 'Escolha o Clã…'"; "Caitiff: nenhum selo, nenhum 'fora'" | `ListEditor.test.tsx` | Os casos de borda |
| R-26 | "Mago Verbena: a Esfera de afinidade lista as da Tradição primeiro, com 'da Tradição' no nome do rádio" | `apps/frontend/sheet/evolve/__tests__/ChoiceEditorRow.test.tsx` (novo, ou no `mage.test.tsx`) | O mesmo mecanismo no `choice` |
| R-26 | "Fraqueza: Brujah mostra o resumo; trocar para Toreador mostra o outro; o texto editado fica ao trocar o Clã; apagar volta ao resumo" | `apps/frontend/sheet/evolve/__tests__/evolve.layout.test.tsx` (onde o editor da Fraqueza já é testado, `:105-120`) | O `default` por opção em texto, na tela |
| R-26 | `resolve`: `default` por opção em `longText`, valor gravado vence, vazio gravado vence, opção sem entrada dá vazio | `packages/sheet-core/src/__tests__/resolve.test.ts` | A regra do core |
| Notas do P07-C | "Nome repetido: 'Ambidestro' de novo mostra 'Já há…' e 'Adicionar outro'; o Enter explica" | `ListEditor.test.tsx` | O achado 6 da onda-3 §11 |

**Contrato do template** (Bun, `packages/sheet-core`):

- `validate-template.test.ts`: cada chave nova passa com a forma certa e é recusada com `from` que não é `choice`, opção que não existe, nome fora do `catalog`, `meta` que não é `number`, `value` fora da faixa, `label` longo, chave `__proto__` no `map`, texto com `<` ou quebra de linha;
- `parity.test.ts`: o `schema.json` e o `validate.mjs` aceitam e recusam os mesmos casos; o `enum` de `creation.advice` é igual ao `REGISTRY`;
- `wod-rules.test.ts`: os três templates do produto validam; o `recommend` do V20 é igual, clã a clã, ao `itemIn` do XP (`vtm-v20.json:1001-1113`);
- `compile.test.ts`: o template com as chaves compila; o app que não as conhece (`validateTemplate` sem elas) recusa, como as `suggestions` em `733c915`.

**O servidor continua aceitando o que a tela só avisa** (passa antes e depois; Bun em PGLite, `apps/api/src/__tests__/creation.test.ts`, `describe('/events: avaliação parcial')`):

- Dom com Posto 2 na criação por pontos → 200;
- Disciplina fora do clã → 200, e a conta é a mesma de uma do clã;
- Qualidade com Custo 2 em Pontos básicos → 200, e o saldo de bônus cai 2 (D-06 no servidor);
- Qualidade com Custo acima do saldo → 422 `CREATION_BUDGET_EXCEEDED` (já existe, P07-C).

A publicação (`apps/api/src/templates/__tests__/publish.test.ts`): os três templates do produto publicam com as chaves novas; um template com `recommend` inválido é recusado na etapa `schema` e, sem o schema, na etapa `contract`.

### 4.2 Testes existentes que mudam junto

| Arquivo | Por quê |
|---|---|
| `apps/frontend/sheet/evolve/__tests__/ListEditor.test.tsx` | O Valor sai da folha: os casos que abriam a folha para mudar o Valor passam a usar o `Stepper` da linha. O nome acessível da linha ganha o selo quando há `recommend` |
| `apps/frontend/sheet/creation/__tests__/advantages.test.tsx` | Os casos do commit 7 do P07-C ("+ + e Aplicar" no Valor da folha, previsão do "+" do Valor) passam para a linha. A busca pela frase continua por `/bônus/i` |
| `apps/frontend/sheet/evolve/__tests__/evolve.layout.test.tsx` (`:105-120`) | A Fraqueza: o fixture sem Clã continua vazio; um caso com Clã entra |
| `apps/frontend/sheet/evolve/__tests__/mage.test.tsx` | A Esfera de afinidade com a ordem nova, quando há Tradição |
| `packages/sheet-core/src/__tests__/validate-template.test.ts`, `parity.test.ts`, `compile.test.ts`, `wod-rules.test.ts` | As chaves novas (4.1) |
| `apps/api/src/templates/__tests__/publish.test.ts:185-243`, `:321`, `:345` | **Só no commit de versão da integração:** `1.8.0` → `1.9.0`, e a "próxima" vira `1.10.0` |

### 4.3 E2E (Chromium e WebKit)

**Specs e helpers que abrem a folha do item para ajustar o valor** (grep em `e2e/` por `Aplicar`, `, valor`, `de 5/`, `Adicionar Dom`, `Adicionar Disciplina`, `Adicionar Antecedente`):

| Arquivo e linha | O que faz hoje | O que muda | Quem e quando |
|---|---|---|---|
| `e2e/tests/journey.spec.ts:124-127` | Abre "Geração, 1 de 5" e clica "Aumentar Geração, valor" 4 vezes, depois "Aplicar" | `stepper(page, 'Aumentar Geração')` 4 vezes na linha, sem folha. O "Editando · 7 alterações" (`:128`) fica: a lista continua um caminho só | P07-D, no commit do −/+ (4) |
| `e2e/tests/journey-werewolf.spec.ts:85-90` | "Adicionar Dom" → textbox "Nome" → "Persuasão" → "Adicionar “Persuasão”" | Com o catálogo, o campo é "Buscar Dom". Se o nome estiver no catálogo, o botão é a opção (`getByRole('button', { name: /^Persuasão, Posto 1/ })`); senão, o "Adicionar “…”" continua. O spec passa a usar um nome fictício fora do catálogo ("Faro do Asfalto") para continuar provando o texto livre, e um passo novo escolhe uma recomendada | P07-D, no commit do catálogo (8) |
| `e2e/tests/advantages.spec.ts:41-50`, `:71-90` | Disciplinas pelo catálogo; Defeito e Qualidade pelo Enter | Sem mudança nos passos; as opções do V20 por pontos sem Clã continuam neutras. Os passos novos ficam no fim do mesmo spec (abaixo) | P07-D |
| `e2e/tests/advantages.spec.ts:92` | `tab 'Orçamento'` | O P05-D troca por "Pontos" | P05-D (antes ou depois, quem entrar por último resolve) |
| `e2e/tests/evolve.spec.ts:45-48`, `:72` | Adiciona Taumaturgia pelo catálogo; confere "Taumaturgia, 1 de 5" em Jogo | Nada: em Jogo a linha não muda | — |
| `e2e/tests/a11y-keyboard.spec.ts:75-85` | Abre "Adicionar Antecedente" pelo teclado; Esc; foco volta | Nada; entra um passo novo (abaixo) | P07-D |
| `e2e/support/creation.ts:144-145` (`plus`) | `Aumentar <traço>`, exato | Serve também à linha do item. Conferir que nenhum item do seed tem o nome de um traço com `Stepper` (hoje não: "Geração" da identidade é derivada, sem `Stepper`) | — |
| `e2e/tests/sheet.spec.ts:67` | "Disciplinas: 0 itens" em Jogo | Nada | — |

**Passos novos em `e2e/tests/advantages.spec.ts`** (390 × 844; Chromium e WebKit; conta e crônica pela API, como o spec já faz):

1. **R-25:** com 3 Disciplinas (do passo de hoje), `plus(page, 'Auspícios')` → o contador `counter-disciplines` continua "3/3" e o aviso aparece **na linha**: `page.getByTestId('notice-disciplines-i1')` visível, sem `getByRole('dialog')`. No DOM, o "+" tem `aria-disabled="true"` e não tem `disabled` (lição `e8cfaf8` da onda 2). `boundingBox()` do "+" e do "−" com pelo menos 44 × 44, e a borda direita do "+" dentro da viewport.
2. **R-26:** uma ficha nova com o rádio `Brujah` na "Nova ficha" → Vantagens → "Adicionar Disciplina": `getByRole('button', { name: /, do clã$/ })` com contagem 3; escolher "Dominação" (`exact`): a linha tem o texto "fora do clã: confirme com o narrador". Vantagens → Fraqueza: o valor do campo não é vazio. A frase exata do resumo não é fixada no spec (o texto é do time e pode mudar).
3. **T-24** (ficha W20 por pontos, pela API, com Raça, Augúrio e Tribo): "Adicionar Dom" mostra os três títulos de bloco; uma opção de Posto 2 (achada pela busca) entra, e a linha diz "confirme com o narrador"; na aba de pontos, o "O que falta" tem "Dons: 1 acima do Posto 1".
4. **A 1280 × 800** (no `a11y-keyboard.spec.ts`): "Adicionar Dom" abre o diálogo central: a medida é no painel, `getByTestId('bottom-sheet-root').locator('[aria-modal="true"]')`, depois da entrada (largura ≤ 560 e centro a ± 2 px), não na camada de 1280 (lição `d9fa56f` da onda 3). Tab da linha: nome → "Diminuir" → "Aumentar".

O que o Jest não pega e o E2E pega: o `aria-disabled` no DOM, o `aria-describedby` do "+" apontando o aviso, o painel de 560 e o modo estrito do Playwright com textos parecidos ("do clã" e "fora do clã": usar regex ancorada ou `exact`).

**Ordem dos ajustes.** Os specs rodam só na integração da onda (portas fixas). O P07-D ajusta os seus três (`journey.spec.ts`, `journey-werewolf.spec.ts`, `advantages.spec.ts`) e o `a11y-keyboard.spec.ts` no pacote, com typecheck. Se o P05-D entrar antes, o P07-D faz rebase sobre os seletores de "Pontos"; se entrar depois, o P05-D troca o `:92` do `advantages.spec.ts`.

### 4.4 Suítes do "PR local" e cobertura

- `npx pnpm typecheck`, `npx pnpm lint`, `node scripts/check-system-names.mjs` (o app não pode citar `brujah`, `clan` como id de sistema etc.: tudo vem do template).
- `npx pnpm -C packages/sheet-core build` antes dos testes da API (seção 3.2).
- `bun test --coverage` no `packages/sheet-core` (95% de linhas e funções, `packages/sheet-core/bunfig.toml`): o `recommend.ts` e os ramos novos do validador com casos próprios.
- `bun test` no `apps/api` (85%): só testes novos.
- `npx pnpm -C apps/frontend test:coverage`: a meta é **por arquivo** em `./sheet/` (80% de linhas e funções, 70% de ramos, `jest.config.js:40-43`). O `ItemEditorRow`, o `addAdvice`, o `adviceText` e os ramos novos do `ChoiceEditorRow` precisam de casos próprios. Teste em `sheet/` pode ser `.test.ts`, mas conferir com `jest --listTests` (lição do P11 e do P04-D: em `components/` só `.test.tsx` roda).
- E2E e build nativo só na integração da onda.

---

## 5. Segurança

O pacote muda o contrato do template (validado no servidor), o `resolve` (que roda no servidor) e a interface. Não muda AuthZ, sessão, rota, banco, rede nem dependência (nada novo para o `npm audit`). **Pede `/security-review` antes do merge** (validador e `resolve` do `@tms/sheet-core`), além do `/code-review`.

| Ameaça | Como o desenho evita |
|---|---|
| Template com texto que vira código na tela (HTML, link, markdown) no resumo da Fraqueza, nos selos ou nos nomes do catálogo | Todos são texto seguro de uma linha (`safeText`, `schema.json:192-197`: sem `<`, `>`, controles, separadores e bidi), com limite de tamanho (selo 24, `outside` 60, resumo 400, nome 80). A tela desenha sempre com `<Text>` (o react-native-web escapa); nada de `dangerouslySetInnerHTML`, link ou markdown. O `walk` do validador limita qualquer string a 1000 e o aninhamento a 12 |
| Prototype pollution pelo `map` (`"__proto__": [...]`) | O `walk` recusa `__proto__`, `constructor` e `prototype` em qualquer profundidade; as chaves do `map` precisam ser ids de opção (`isId`), e o acesso usa `Object.hasOwn` |
| Template enorme (DoS no app ou no servidor) | Limites no schema e no validador: `by` até 4, `map` até 100 chaves, cada lista até 200, `catalogDefaults` até 10 × 200, `advice` até 20. O `recommendedFor` e o `creationAdvice` são lineares no tamanho da ficha e do template |
| A tela "deixa" o que a regra não deixa (Dom de Posto 2, Disciplina fora do clã) | Nada do que a tela avisa era recusado antes; a conta do servidor não muda (`checkCreationBatch`, `completionRefusal`). Os testes da seção 4.1 provam que o servidor aceita e recusa o mesmo que antes. O narrador continua decidindo (`regras-wod.md:72-78`), e com a aprovação ligada ele revê a ficha |
| Desconto de XP por nome forjado | O desconto continua só para nome do `catalog` (`accounting.ts:77`); o `recommend` não dá desconto nem preço, e o `catalogDefaults` só define o meta inicial, que o validador da ficha confere (`validate/sheet.ts:280-292`) |
| Publicação de template | Continua o script, sem rota de escrita (`doc/arquitetura-motor-de-ficha.md:430`), com `schema.json` + `validateTemplate` + `compileTemplate` (`apps/api/src/templates/publish.ts:95-103`). Versão publicada é imutável |
| Dado da ficha em log ou no Sentry | Nenhum log novo. Os avisos e o `CreationAdvice` só levam ids do template, caminhos e contagens. Os textos novos (selos, resumo, avisos) não entram na allowlist de `apps/frontend/lib/telemetryFilter.ts` nem do `apps/api/src/http/on-error.ts`: o evento é reconstruído só dos campos da lista |
| O texto da Fraqueza do jogador sobrescrito | O padrão nunca grava. "Usar o resumo do clã" pede confirmação e vai para o rascunho, desfeito como qualquer alteração antes do "Salvar" |
| **Licença** (risco legal, bloqueia o merge) | Nenhum texto literal do livro: o `catalog` e o `recommend` trazem só nomes e ids; os 13 resumos são escritos pelo time, revisados por uma segunda pessoa, e o README §12 diz a regra. Os nomes dos Dons em português são conferidos por quem cuida da parte jurídica antes do merge (D-07 revê a `auditoria-fichas-wod.md:162` só para os nomes). Este plano não traz nenhum nome de Dom nem resumo de Fraqueza |

---

## 6. Como generaliza além do WoD

- **`recommend` (genérico, conteúdo de template):** "o que a identidade recomenda" vale para qualquer sistema com escolha de origem. D&D 5e: magias da classe (`recommend.by[{ from: 'class', label: 'da classe' }]` numa lista de magias) e perícias do antecedente; CoC: perícias da ocupação; Fate: nenhuma. O selo é texto do template; o aviso "fora" é o `outside` do template mais o sufixo do app.
- **`catalogDefaults` (genérico):** o nível da magia no D&D (`meta: 'level'`), o custo do equipamento, o Posto do Dom. O catálogo continua só com nomes.
- **`creation.advice` (`item-meta-max`, genérico):** "na criação, magias de nível ≤ 1" no D&D; "Dons de Posto 1" no W20. Avisa, nunca bloqueia; o bloqueio continua sendo `caps` ou a falha segura.
- **`default` por opção em texto (genérico):** o texto inicial que depende de uma escolha: a Fraqueza do clã, a característica do antecedente do D&D, a ocupação do CoC. Vale enquanto a ficha não grava, como todo `default`.
- **−/+ na linha (genérico):** qualquer lista com `item.value` (Antecedentes, Ressonância; um template futuro com magias pontuadas). A lista sem valor (inventário, aspectos) fica como está.
- **A prévia do item novo e o nome repetido (genéricos):** leem a regra da conta do template (`budgets`, `costs.freebie`) e o `fold` do nome, sem saber de sistema.

Nada no app cita sistema: o `check-system-names.mjs` roda no "PR local".

---

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado**, com os arquivos conferidos (seção 1), os pontos da seção 2.3 levados ao PO e as perguntas 1 a 3 da seção 9 respondidas na consolidação.
2. **Typecheck, lint e testes** de `@tms/sheet-core`, `@tms/api` e `frontend`, com cobertura (seção 4.4), depois do build do `dist`.
3. **Um teste de regressão por item** (seção 4.1), mais os testes do contrato e os do servidor.
4. **`/code-review`** no diff do pacote e **`/security-review`** (seção 5).
5. **Os cenários das personas, repetidos sem o defeito** (API local, banco novo, `npx pnpm seed:roteiro`; só contas fictícias):

| Item | Persona e cenário (notas) | O que se espera ver |
|---|---|---|
| T-08 | QA app e QA web, QAA-05 e QAW-25: "Vampiro v4" → Vantagens → "Adicionar Qualidade" → nome → Adicionar, em Pontos básicos e em bônus | A folha diz o custo e o saldo antes; a Qualidade entra com "Custo 1"; o saldo cai; sem saldo, a recusa na folha com o nome mantido; nenhum "não se compra na criação" |
| T-24 | Experiente app, EA-14 e EA-03: "Lobisomem v4", Lupino Ahroun → "Adicionar Dom" → um Dom de Posto 2 → Aplicar | Os Dons da Raça, do Augúrio e da Tribo à vista, com selo e Posto; o de Posto 2 entra com o aviso na linha e no "O que falta"; nada bloqueia |
| T-24 | PO web, POW-21: "Adicionar Dom" a 390 | Catálogo com destaque; "Faro do Asfalto" (fictício) entra como texto livre |
| R-25 | Experiente app e web, EA-12 e EW-10; Iniciante, IW-22 e IA-29: Disciplina e Antecedente de 1 para 3 | 2 toques, na linha, sem folha; a folha abre pelo nome e tem nome, especialização e notas |
| R-26 | Iniciante app, IA-07: Brujah → "Adicionar Disciplina" → Dominação | "Do clã" no topo, com o selo; Dominação entra com "fora do clã: confirme com o narrador" |
| R-26 | Iniciante web, IW-16; PO web, POW-23; Experiente app, EA-09: Toreador e Ventrue | As três do clã de cada um marcadas |
| R-26 | Experiente web, EW-31; Iniciante app, IA-21; Narrador app, NA-29: Brujah → Vantagens → Fraqueza | O resumo do clã já aparece, editável; trocar de clã troca o resumo; o texto editado fica |
| R-26 | Experiente web, EW-18 (Mago): Tradição fora da Ordem de Hermes → Esferas → Esfera de afinidade | As da Tradição primeiro, com "da Tradição"; outra escolhida avisa |

6. **Conferência no aparelho:** a seção 11 (o T-24 é obrigatório no Android).
7. **Resumo do pacote** para a seção do PR da onda: o que mudou, como foi testado, os achados da revisão e o conteúdo que ainda depende do time (seção 3.10).

---

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

| # | Commit | Itens | Sai sozinho? |
|---|---|---|---|
| 1 | `test(core,api): o servidor aceita Dom de Posto 2, Disciplina fora do clã e Qualidade com bônus, como antes` | prova (§4.1) | — |
| 2 | `feat(core): contrato do template com recommend, catalogDefaults, default por opção em texto e creation.advice (schema, validador, validate.mjs, README)` | base de T-24 e R-26 | Sim (nenhum template usa ainda) |
| 3 | `feat(core): recomendações e avisos da criação (recommendedFor, creationAdvice); default por opção no resolve` | base de T-24 e R-26 | Depende do 2. **Rebuild do `dist`** |
| 4 | `feat(app): −/+ na linha dos itens com valor; a folha fica com nome, metas, especialização e notas (R-25)` | R-25, nota do `useRowFeedback`; `journey.spec.ts` | Sim |
| 5 | `feat(app): selo da identidade, recomendadas primeiro e "fora do clã: confirme com o narrador" (R-26)` | R-26 (lista e `choice`), "O que falta" | Depende do 3 |
| 6 | `feat(app): a Fraqueza mostra o resumo do clã; "Usar o resumo do clã" (R-26)` | R-26 (Fraqueza) | Depende do 3 |
| 7 | `feat(app): prévia do item novo, nome repetido e o texto da Qualidade sem Custo (T-08, notas do P07-C)` | T-08, notas | Sim |
| 8 | `feat(templates): Disciplinas por clã e Fraqueza (vtm-v20), Esferas por Tradição (mta-m20), catálogo de Dons (wta-w20), sem subir a versão` | conteúdo de T-24 e R-26; `journey-werewolf.spec.ts` | **Espera o conteúdo do time e a licença** (§3.10). Pode sair em partes: V20 e M20 primeiro |
| 9 | `feat(app): previsão do "+" do Custo e do Bônus na folha do item (T-08)` | T-08 | Sim (opcional) |
| 10 | `test(e2e): Vantagens com −/+ na linha, selo do clã, Fraqueza e Dons do catálogo` | E2E | — |
| (alt.) | `feat(app): −/+ do Posto na linha do Dom` | D-08 nos Dons | Só se o PO pedir (§2.3, ponto 2) |
| (integração) | `chore(templates): vtm-v20 1.9.0, wta-w20 1.7.0, mta-m20 1.7.0` (+ migration, se a pergunta 1 decidir) | versão | Orquestrador, depois do último PR de template |

### 8.2 Esforço

| Item | Matriz | Plano | Por quê |
|---|---|---|---|
| T-08 | M | P | O grosso entrou no P07-C; sobram texto, prévia e um teste |
| T-24 | M | M | Contrato (`catalogDefaults`, `advice`), folha com blocos e aviso; o conteúdo é do time |
| R-25 | M | M | Linha nova, `at` no store, `useRowFeedback` com item, testes da folha que mudam e o `journey.spec.ts` |
| R-26 | M | M | `recommend` na lista e no `choice`, `default` em texto no core, Fraqueza com "Usar o resumo" |
| Contrato e motor (commits 2 e 3) | — | M | Schema, validador, `validate.mjs`, paridade, README e `/security-review` |

**Total: G (7 a 9 dias de desenvolvimento), em 10 commits.** Fora disso, o conteúdo do time: de 1 a 2 dias para a lista de Dons (duas fontes) e 1 dia para os 13 resumos e a revisão, mais a conferência da licença.

### 8.3 Riscos

- **Conteúdo e licença atrasam o commit 8.** Sem ele, o mecanismo entra e o W20 fica sem catálogo (o texto livre continua). O V20 (`recommend` copiado do XP) e o M20 (ids) não dependem de licença; a Fraqueza depende só do texto do time.
- **A versão do template na integração.** Três a quatro pacotes mexem nos mesmos três JSON. Sem um aumento só, o `templates:publish` acusa conflito no banco de quem testou. A seção 3.10 propõe um aumento por onda.
- **App antigo e template novo em produção** ("Atualize o app" para as fichas novas). Depende da ordem do release (pergunta 1).
- **A linha a 360 dp com fonte aumentada.** O nome fica com 112 dp; com 130% de fonte, quebra em duas linhas. Conferir no AVD (§11) com `font_scale 1.3`.
- **O `at` no store** mexe no `sheetStore.ts` (P05-C, mergeado). É aditivo, mas o P05-D pode mexer no mesmo arquivo (marcador da fase de bônus): conflito baixo, em funções diferentes.
- **O "−" até 0** deixa um item com 0 na lista. É o que a folha já permitia; "Remover" continua na folha.
- **O anúncio do aviso no app** (achado da onda 2, §10): o `role="alert"` pode não ser falado sozinho pelo VoiceOver e pelo TalkBack. A linha usa o mesmo `DraftNoticeText`; conferir no aparelho (§11.f).
- **Fichas na versão anterior** ficam sem o catálogo e o selo (§2.3, ponto 4).

### 8.4 Conflitos com os pacotes da onda

Ordem de merge proposta: **P10-C → P07-D → P10-D**, com o P05-D em qualquer ponto (arquivos diferentes, salvo o "O que falta"), e o P15-D, se entrar, por último. **Consolidada no [onda-4.md](onda-4.md) §2: P05-D → P10-C → P07-D → P10-D**, com o P05-D primeiro (o P07-D preenche o `useCreationNotices` que o P05-D deixa vazio, P05-D §3.9, e faz o rebase sobre os seletores de "Pontos"). O P10-D vem depois porque o "?" de cada opção precisa da lista final de opções e de nomes, inclusive o catálogo de Dons.

| Pacote | Arquivo ou contrato | Risco | Como integrar |
|---|---|---|---|
| P10-C (T-60, T-66) | `ListEditor.tsx` (ordem das opções na `AddItemSheet`; "Nenhuma Qualidade" em `:134-138`) e `evolve/text.ts` (`noneOf`) | Médio | O P07-D divide as opções em blocos ("Do clã"/"Outras") e aplica, dentro de cada bloco, a ordem que o P10-C expuser (uma função de ordenação no `text.ts`). Se o P10-C ordenar o `catalog` no próprio JSON, conflito textual no `vtm-v20.json`/`wta-w20.json`: o catálogo de Dons já entra na ordem do P10-C |
| P10-C (T-85, Fúria) | `wta-w20.json` (mínimo da Fúria) e `packages/sheet-core` (derivados sobre o rascunho) | Baixo | Trechos diferentes do JSON e do core; o `/security-review` de cada um cobre o seu |
| P10-D (D-11, D-12) | Os três JSON (`help` em cada campo e opção; "Casa ou subgrupo"); `schema.json` (as opções do `choice` têm `additionalProperties: false`, `:1241-1264`) | Médio | O P07-D não toca as opções do `choice` (o `recommend` é chave do campo), mas os dois editam o `$defs` do `field-choice` e do `field-list` no schema: conflito textual pequeno. A `weakness.help` muda no P07-D (§3.5): o P10-D não a reescreve. **Se a D-11 cobrir cada nome de catálogo, o catálogo de Dons soma de 85 a 125 frases ao P10-D.** O "?" da linha usa o slot `help` do `ItemEditorRow` (§3.4) |
| P05-D (D-05) | `CreationPanel.tsx` ("O que falta" e a aba "Pontos"), `creation/creation.ts` (itens tocáveis), `e2e/tests/advantages.spec.ts:92` ("Orçamento") | Médio | O P07-D entrega `useCreationAdvice()` e `adviceText()`, e o P05-D desenha os itens (§3.8). O P07-D não edita o `CreationPanel.tsx` se o P05-D entrar antes; se entrar depois, põe os avisos no bloco de hoje, sem toque. Funções novas em `creation.ts` ficam em trechos separados |
| P05-D | `sheetStore.ts` (se o marcador da fase de bônus for pelo store) | Baixo | O `at` do `setDraftValue` é aditivo, em outra função |
| P15-D (D-16, fora destes planos) | Os três JSON (campo "História / Prelúdio") e a versão | Baixo | Campo e seção novos, em outro trecho. Entra no aumento único de versão da onda (§3.10) |
| P08 (onda 2, mergeado) | `BottomSheet` | Nenhum | O P07-D não muda a folha (§3.9) |

### 8.5 Arquivos tocados

| Arquivo | Trecho | Itens | Cruza com |
|---|---|---|---|
| `packages/sheet-core/src/contract/fields.ts` | `ListField` (`:288-297`: `recommend`, `catalogDefaults`), `ChoiceField` (`:246-249`: `recommend`), `TextField`/`LongTextField` (`:225-237`: `default`), tipo `TextChoiceDefault` perto de `:44-53` | T-24, R-26 | — |
| `packages/sheet-core/src/contract/accounting.ts` | `creation.advice` | T-24 | P10-C (baixo) |
| `packages/sheet-core/src/validate/template.ts` | `KEYS.field` (`:100-132`), lista (`:611-620`), `formula` para texto (`:319-335`) | T-24, R-26 | — |
| `packages/sheet-core/src/validate/accounting.ts` | `KEYS.creation` (`:41`), validação do `advice` | T-24 | — |
| `packages/sheet-core/src/registry.ts` | `creationAdvice: ['item-meta-max']` | T-24 | — |
| `packages/sheet-core/src/recommend.ts` (novo), `index.ts` | `recommendedFor`, `creationAdvice` | T-24, R-26 | — |
| `packages/sheet-core/src/resolve.ts` | `text`/`longText` (`:479-486`) | R-26 | — |
| `packages/sheet-core/src/__tests__/` (`recommend.test.ts` novo, `resolve`, `validate-template`, `parity`, `compile`, `wod-rules`) | — | todos | P10-C (baixo) |
| `design/templates/schema.json` | `field-list` (`:1298-1350`), `field-choice` (`:1232-1268`), `field-text`/`field-longText`, `creation` | T-24, R-26 | P10-D (médio) |
| `design/scripts/validate.mjs` | `KEYS` (`:64`, `:68`) e as checagens | T-24, R-26 | P10-D (baixo) |
| `design/templates/README.md` | §3, §12, §14 | T-24, R-26 | P10-D |
| `design/templates/vtm-v20.json` | `disciplines.recommend` (`:432-460`), `weakness` (`:505-510`) | R-26 | P10-C, P10-D, P15-D |
| `design/templates/wta-w20.json` | `gifts` (`:577-593`), `creation.advice` (perto de `:1085`) | T-24 | P10-C, P10-D, P15-D |
| `design/templates/mta-m20.json` | `affinity.recommend` (`:349-362`) | R-26 | P10-D, P15-D |
| `apps/frontend/sheet/evolve/ListEditor.tsx` | linha (`:117-133` → `ItemEditorRow`), `AddItemSheet` (`:186-318`: blocos, prévia, nome repetido), `ItemSheet` (`:356-511`: sem o Valor, `useItemAdvice` sai `:327-354`) | R-25, R-26, T-24, T-08 | P10-C (médio), P10-D (slot do "?") |
| `apps/frontend/sheet/evolve/ChoiceEditorRow.tsx` | opções com `meta` e ordem (`:66-80`); aviso "fora" na linha | R-26 | P10-D ("?" na opção) |
| `apps/frontend/sheet/evolve/TextEditorRow.tsx` | "Usar o resumo do clã" quando o campo tem `default` por opção | R-26 | — |
| `apps/frontend/sheet/evolve/hooks.ts` (`:78-90`), `useRowFeedback.tsx` | `at` no `useSetDraft`; o hook com caminho de item | R-25 | — |
| `apps/frontend/sheet/store/sheetStore.ts` | `setDraftValue` (`:259`, `:676-680`), aviso com `at` (`:599-606`), seletor `advice` | R-25, T-24, R-26 | P05-D (baixo) |
| `apps/frontend/sheet/creation/creation.ts` | `problemText` (`:255-256`), `refusalNotice` (`:467-471`), `addAdvice` e `adviceText` (novos, perto de `:588`) | T-08, T-24, R-26 | P05-D (médio) |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | "O que falta" (`:229-246`), só se o P05-D atrasar | T-24, R-26 | P05-D |
| `apps/frontend/sheet/views/ListView.tsx` | `describeItem` com o selo (`:40-59`) | R-26 | — |
| Testes do app (`ListEditor.test.tsx`, `advantages.test.tsx`, `evolve.layout.test.tsx`, `mage.test.tsx`, `creation/__tests__/creation.test.ts`) | — | todos | — |
| `apps/api/src/__tests__/creation.test.ts`, `apps/api/src/templates/__tests__/publish.test.ts` | casos novos; versão só na integração | prova | — |
| `e2e/tests/advantages.spec.ts`, `journey.spec.ts:124-127`, `journey-werewolf.spec.ts:85-90`, `a11y-keyboard.spec.ts` | §4.3 | todos | P05-D (`advantages.spec.ts:92`) |

---

## 9. Perguntas abertas (técnicas)

1. **Como a versão nova do template chega a produção:** uma migration nova, igual à `0020` (a regra do `regras-wod.md:5` e do comentário da `0020_product_templates.ts:5-9`), ou o `templates:publish` manual no release (o precedente `733c915`)? E a ordem: o app nativo na loja antes da publicação (README §9, passo 5), ou aceitar o "Atualize o app" nas fichas novas até a loja?
2. **A Fraqueza "preenchida":** padrão mostrado (proposto: nada é gravado até o jogador editar; acompanha o clã) ou gravado no rascunho ao escolher o Clã no Editar (vira uma "alteração não salva" que o jogador não fez, e a "Nova ficha" precisaria aceitar a `weakness` na API, fora da identidade)?
3. **O `at` no `setDraftValue`** (proposto) ou o `useRowFeedback` com um filtro local ("esta linha foi a última tocada"), sem mexer no store?
4. **Dons de Posto 2 a 5 no catálogo:** passam de 200 nomes. Subir o limite do `catalog` (schema e validador) agora, ou só o nível 1 nesta onda?
5. **Opção do catálogo com dois selos** (um Dom da Raça e da Tribo): os dois no texto ("da Raça, da Tribo") ou só o primeiro?
6. **O "Origem" do Dom** (meta `source`, texto): preencher com a fonte do selo ao adicionar uma recomendada ("Raça: Lupino") ou deixar vazio, como hoje? O plano deixa vazio (não grava o que o jogador não escreveu).
7. **"Usar o resumo do clã" com confirmação** (proposto) ou direto, com o "Desfazer" do rascunho?
8. **O `recommend` do V20 duplica o `itemIn` do XP.** Proposto: duplicar, com o teste de igualdade (§4.1). A alternativa é derivar a recomendação do XP, sem dado novo no V20, mas presa ao sentido "desconto de XP", que não serve ao W20 nem ao M20.

Perto do pacote, sem pacote (para o orquestrador): o achado 1 da [onda-3.md](onda-3.md) §11 (a folha que espera as rebuscas antes de fechar) não toca as folhas de item, que fecham na resposta síncrona do rascunho. Nada a fazer aqui.

---

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

Implementação em 04/11/2026, na `pacote/p07-d-vantagens-regras`, em paralelo com o P05-D e o P10-C (cada um no seu worktree). Os pontos para o PO e as perguntas técnicas seguiram a recomendação deste plano; nada foi decidido aqui.

**O que ficou fora, e por quê:**

1. **O commit 8 entrou em parte.** Entraram o `recommend` das Disciplinas por clã (V20) e o da Esfera de afinidade por Tradição (M20). Ficaram fora:
   - **o catálogo de Dons do W20** (`catalog`, `catalogDefaults`, `recommend` e `creation.advice` no `wta-w20.json`): espera a lista do time, com duas fontes, e a conferência da licença dos nomes. O W20 continua com o texto livre;
   - **os 13 resumos da Fraqueza** (`weakness.default`): o time escreve. A `weakness.help` não mudou, porque a frase nova só faz sentido com o resumo.

   O mecanismo dos dois entrou (contrato, motor e tela), testado com dados fictícios (`test/fixtures.ts`, `templateWithIdentity`; nenhum nome de Dom nem resumo do livro).
2. **O mapa Tradição → Esferas do M20 é dado de jogo a conferir.** São só ids do template, mas o plano pedia duas fontes (§3.10). O mapa foi montado numa fonte só e precisa da conferência do time antes do merge na `main`:

   | Tradição | Esferas recomendadas |
   |---|---|
   | Ordem de Hermes | Forças |
   | Coro Celestial | Forças, Primórdio, Espírito |
   | Culto do Êxtase | Vida, Mente, Tempo |
   | Eutanatos | Entropia, Vida, Espírito |
   | Irmandade Akáshica | Vida, Mente |
   | Sonhadores | Forças, Vida, Matéria, Espírito |
   | Verbena | Forças, Vida |
   | Sociedade do Éter | Forças, Matéria, Primórdio |
   | Adeptos da Virtualidade | Correspondência, Forças |
   | Órfão | (nenhuma) |
3. **O passo do catálogo no `journey-werewolf.spec.ts`** não entrou: sem catálogo no produto, o spec continua provando o texto livre como já fazia.
4. **O alternativo do −/+ do Posto na linha do Dom** não entrou (ponto 7 do PO): a linha mostra "Posto N", e o Posto muda na folha.

**Dependências em paralelo (o rebase é do orquestrador):**

5. **P10-C.** O "−" da linha usa o `Stepper` de hoje, sem a previsão. O lugar está marcado no `ItemEditorRow` (comentário "O "−" ganha a previsão com o Stepper.decrease do P10-C"). Os blocos "Do clã" / "Outras" ficam na ordem do template: o `byLabel` entra dentro de cada bloco, em `optionBlocks` (`ListEditor.tsx`).
6. **P05-D.**
   - Os avisos saem do `useCreationAdvice()` (`sheet/creation/useCreationAdvice.ts`), com itens `{ key, kind: 'confirm', text, field, paths }` (`AdviceNotice`, `adviceNotices` e `adviceText` em `creation.ts`). No rebase, eles viram o corpo do `useCreationNotices` do P05-D.
   - Até lá, a aba de pontos os mostra num bloco "Para confirmar com o narrador" (`creation-advice`), depois do "O que falta", só texto. É o nome do bloco do onda-4.md §4.2.
   - A linha nas `notes` da confirmação de concluir ("1 item para confirmar com o narrador; veja em Pontos.") não entrou: ela é da confirmação, que o P05-D desenha.
   - Os specs ainda usam a aba "Orçamento".

**Desvios de desenho:**

7. **"Usar o resumo do clã" tira o texto gravado, em vez de gravar o resumo.** O efeito na tela é o mesmo (o campo mostra o resumo), e a ficha volta a seguir o Clã, como quem nunca escreveu. O rascunho leva o evento "texto → vazio". Os textos dizem o nome da opção, não "do clã", porque o app não cita termo de sistema: "Usar o resumo de Brujah", "Trocar o seu texto pelo resumo de Brujah?" e, na linha, "Resumo de Brujah; edite para trocar.".
8. **As frases genéricas** (rascunho do time, para revisão), sem artigo de gênero, que o template não diz:
   - "Escolha Clã na identidade para ver as recomendações.";
   - "Posto 2: na criação, vai até 1. Confirme com o narrador.";
   - "Dons: 1 com Posto acima de 1.";
   - "Disciplinas: 2 fora do clã." e "Esfera de afinidade: fora da Tradição.";
   - "Busque pelo nome para ver o restante da lista." (catálogo acima de 40 nomes, sem busca).

   O título do bloco é o selo com a primeira letra maiúscula ("Do clã"); com mais de uma fonte, ele leva a opção ("Da Raça · Lupino").
9. **A prévia do item novo** diz "Entra com os pontos básicos (faltam 2 de 3)." no lugar de "Entra com 1 ponto básico (faltam 2 de 3).": a mesma frase serve aos grupos de pontos e de itens.
10. **Ficha ativa:** o −/+ da linha usa a política da classe `advance` (`useClassNote`), não a do campo. A lista em si é `edit` (o nome e as notas seguem livres), e o `useBlockedNote(list.id)` do plano não desabilitaria nada. "Peça ao narrador." aparece uma vez, acima dos itens.
11. **"Fora do clã" e "Posto N" só com a ficha em `creating`** (o `LifecycleContext`), nos dois modos de criação. O selo aparece também no Editar da ficha ativa.
12. **O "+" sem saldo no app.** No app, o controle ajustável continua sem `aria-disabled`, e a dica diz o motivo. O `aria-disabled` é do web, conferido no E2E. É o comportamento do `Stepper` de hoje (`increase.blocked`).

**O que mudou fora da §8.5:**

- `apps/frontend/sheet/evolve/recommend.ts` (novo): os textos e o `useIdentityAdvice`;
- `apps/frontend/sheet/creation/useCreationAdvice.ts` (novo);
- `apps/frontend/test/fixtures.ts`: `templateWithIdentity` e `GIFTS`, fictícios;
- `packages/sheet-core/src/compile.ts`: o `withValueDeps` leva o `choice` do texto por opção;
- `e2e/tests/evolve.spec.ts` e `journey.spec.ts`: "Taumaturgia, do clã";
- o `ResolvedText` ganhou `defaulted`.

**Testes:** ver a seção 4.1. Os do servidor (commit 1) passam antes e depois, e rodam com os templates do repositório, já com o `recommend`. O E2E e o roteiro manual (seção 11) ficam para a integração.

**`/code-review` (high), corrigido em três commits `fix`** (`faea82c` no core, `bcf4d58` e `28a9d4b` no app), com teste de regressão em cada achado. O servidor não muda.

1. **A identidade vinha da prop `sheet` do campo.** O `FieldSlot` reaproveita a entrada de um campo que não mudou. Trocar o Clã ou a Tradição deixava velhos o selo, os blocos, o "fora", a ordem da Esfera e o "Usar o resumo de <Clã>". Agora o `useIdentityAdvice(field)` e o `useTextDefault(field)` leem a ficha mostrada do store.
2. **Várias fontes, uma sem escolha.** Os Dons saíam "fora". Agora nada fica "fora" enquanto alguma fonte está sem escolha, e a folha diz qual falta ("Escolha Augúrio ou Tribo na identidade…").
3. **O nome do item é comparado com `foldName`** (core), como a busca da folha.
4. **Duas regras `item-meta-max` na mesma lista.** O aviso leva `rule`, o índice da regra, e a chave e o texto usam esse índice.
5. **`useCreationAdvice(enabled)`:** não calcula fora da criação e guarda as frases.
6. **O `creationAdvice` era refeito em cada linha.** Agora é uma vez por ficha resolvida (`adviceOf`, um `WeakMap`), compartilhado pelas linhas e pela aba.
7. **A prévia com o meta no `catalogDefaults`.** Ela dizia "começa em <mínimo>"; agora diz "o de cada opção".
8. **A Qualidade sem Custo.** A frase conta os itens e separa "sem Custo" de "com Custo inválido" (o Custo 0). Sem a ficha, diz "sem Custo válido".
9. **`recommendedBySource` no core**, usado pelo `recommendedFor` e pelos blocos da folha.
10. **O `schema` do `ItemEditorRow` é prop obrigatória.** O guard morto saiu.

---

## 11. Testes manuais (web, Android com AVD, iOS com idb)

Roteiro para conferir cada item na interface, nas três plataformas, com a API local e o seed do roteiro. Só contas fictícias. Ele detalha o passo 6 da §7. A coluna "Resultado" fica em branco e é preenchida na integração. Nenhum resultado é "ok" sem a evidência; quando uma plataforma não puder ser conferida, o resultado diz "não conferido" e por quê.

### 11.a Preparação

1. **Banco e API:**
   - `npx pnpm bootstrap` (o `dist` do `@tms/sheet-core` precisa estar novo: o `check-dev-env.mjs` recusa o velho);
   - **no pacote, sem subir a versão do template:** um banco local novo, para a `0020` gravar o JSON do repositório. Por exemplo, `docker exec <container do postgres> createdb -U postgres tms_p07d` e, nos comandos abaixo, `DATABASE_URL=postgres://postgres:postgres@localhost:5432/tms_p07d` (credenciais locais do `docker-compose.yml`, nunca as de outro ambiente). Não ler nem mostrar o `.env`;
   - `npx pnpm db:migrate` e `npx pnpm templates:publish --published` (deve dizer "sem mudança"; se disser conflito, o banco não é novo);
   - **na integração:** o banco da onda, com a versão nova publicada pelo `templates:publish`;
   - API em `npx pnpm dev:api` (3001) e Metro em `cd apps/frontend && npx expo start` (8081).
2. **Seed:** `npx pnpm seed:roteiro > <scratchpad>/p07d-seed.log 2>&1`. A saída tem a senha e os e-mails: fica só nesse log, que não é mostrado nem copiado.
   - **O que o seed já cobre:** as contas N (`roteiro_narrador`), J1 (`roteiro_jogador1`), J2 (`roteiro_jogador2`) e N2 (`roteiro_narrador2`), em `@roteiro.test`; as crônicas "{Sistema} v3/v5" (livre) e "{Sistema} v4" (por pontos, aprovação desligada) de Vampiro, Mago e Lobisomem (`scripts/seed-roteiro.ts:57-60` e `:292-300`). O `--fichas-criacao` (onda 3) cria as fichas da onda 3, que não servem aqui (Tremere e Verbena sem as escolhas deste roteiro).
   - A senha é a constante do `scripts/seed-roteiro.ts` e não é escrita aqui, em script versionado nem em captura.
3. **O que o roteiro cria pela tela** (J1, uma vez por plataforma; nomes fictícios):
   - **"Brujah R"** em "Vampiro v4": Clã Brujah na "Nova ficha". Para as Disciplinas do clã, o "fora do clã" e a Fraqueza;
   - **"Lupino R"** em "Lobisomem v4": Raça Lupino, Augúrio Ahroun, Tribo à escolha. Para o catálogo de Dons e o Posto;
   - **"Verbena R"** em "Mago v4": Tradição Verbena (ou qualquer uma que não seja a Ordem de Hermes). Para a Esfera de afinidade;
   - as prioridades de Atributos e Habilidades pela tela, quando o passo pedir pontos de bônus.
   O seed não precisa mudar. Se a consolidação preferir poupar tempo, uma opção `--fichas-vantagens` cria as três fichas pela API, só com o nome e as escolhas da identidade (pergunta para a consolidação, não para o PO).
4. **Evidências:** no scratchpad, com o nome `p07d-<plataforma>-<largura>-<ID>-<passo>.png`. Sem e-mail visível.

### 11.b Web (Playwright, Chromium; WebKit onde indicado)

- **Script:** `<scratchpad>/p07d/web.mjs`, com o `playwright` do `node_modules` do checkout, contra `http://localhost:8081`. O Metro do web pode ficar velho depois de editar: reiniciar com `--clear` antes da rodada.
- **Viewports exatos:** `{ width: 390, height: 844 }` e `{ width: 1280, height: 800 }`. A 390, as abas da ficha ficam na faixa fixa (`e2e/support/creation.ts:126-142`, `tab`).
- **WebKit:** R-25a e T-24a também em `webkit.launch()` (o `aria-disabled` do "+" e a folha com blocos no Safari).
- **Seletores por papel e rótulo, como no E2E (§4.3):** `getByRole('button', { name: 'Aumentar Potência', exact: true })`; `getByRole('button', { name: /, do clã$/ })`; `getByRole('radio', { name: /, da Tradição$/ })`; `getByLabel('Buscar Dom')`; `getByTestId('add-sheet-gifts')`; o painel da folha por `getByTestId('bottom-sheet-root').locator('[aria-modal="true"]')`. Texto parecido ("do clã" × "fora do clã") com regex ancorada ou `exact`.
- **Um `page.screenshot` por passo.**

### 11.c Android (AVD)

- **AVD:** `Pixel_3a_API_34_extension_level_7_arm64-v8a` (393 dp), com o `assembleDebug` arm64 da integração.
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Larguras de layout** (a linha com −/+): `adb shell wm density 480` (360 dp) e `420` (411 dp), e `adb shell wm density reset` no fim. Fonte aumentada: `adb shell settings put system font_scale 1.3`, e `1.0` no fim.
- **Teclado de software:** `adb shell settings put secure show_ime_with_hard_keyboard 1` (busca na "Adicionar Dom").
- **Navegação:** `adb shell uiautomator dump /sdcard/ui.xml` + `adb pull`, para achar o alvo pelo `text` ou pelo `content-desc` e tocar no centro do `bounds` com `adb shell input tap X Y`; `adb shell input keyevent 4` para o voltar do Android com a folha aberta. O `input text` não digita acento: escolher da lista (os nomes do catálogo e os rádios) em vez de digitar; para a busca, digitar só o começo sem acento ("domi", "pote").
- **O −/+ no `dump`:** no app, os botões do `Stepper` ficam fora da árvore de acessibilidade (o controle é ajustável, `Stepper.tsx:183` e `:205-225`). Para tocar, achar o nó ajustável pelo `content-desc` ("Potência") e tocar na borda direita (+) e esquerda (−) do `bounds`; o valor confere pelo texto do número.
- **Tempo no emulador sob carga não é evidência** (falso "busy", onda-3 §11). O LogBox embaixo engole toque: dispensar antes.

### 11.d iOS (simulador, com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, e iPhone 17, iOS 26.5.
- **Build Debug com "Sign to Run Locally"** (sem assinatura, o app não loga: o keychain responde `-34018`, onda-3 §11): em `apps/frontend/ios`, `xcodebuild -workspace TMS.xcworkspace -scheme TMS -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath <scratchpad>/ios-dd CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build`. O CI continua sem assinatura. Depois: `xcrun simctl install <UDID> …/TMS.app` e `xcrun simctl launch <UDID> com.tms.app`.
- **O cliente fb-idb:** o venv `~/.venvs/idb-tms` já existe, com o fb-idb 1.7.7, fora do repositório. Rodar `~/.venvs/idb-tms/bin/pip-audit` de novo antes de usar; com vulnerabilidade, parar e registrar. Nunca no `package.json` nem no lockfile.
- **O companion:** só local, no socket de domínio; `--companion-path` vai antes do subcomando. No fim, `lsof -nP -iTCP -sTCP:LISTEN | grep idb` não mostra nada.
- **Navegação:** `idb ui describe-all --udid <UDID>` para achar o alvo pelo `AXLabel` e tocar no centro do `frame` (`idb ui tap X Y`); `idb ui text`, `idb ui swipe`, `idb ui key 40` (Return); `idb screenshot`. Limites: sem o gesto de borda (usar o "‹"); não digita fora do ASCII (escolher da lista); digita como teclado físico, e o teclado de software some depois do primeiro texto. O deep link (`tms://`) pede "Abrir com 'TMS'?": tocar "Abrir" pelo idb.
- **O −/+ no iOS:** o controle ajustável aparece no `describe-all` com o `AXLabel` do item e o valor; tocar nas bordas do `frame`, como no Android.

### 11.e Tabela por item

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-08a | Web 390 | J1 | "Brujah R" → Vantagens → "Adicionar Qualidade", em Pontos básicos | A folha diz "Custa o Custo do item em bônus (começa em 1); restam 15."; "Ambidestro" + Enter entra com "Custo 1"; o saldo cai para 14 | `p07d-web-390-T-08a-1..3.png` | |
| T-08b | Web 390 | J1 | Gastar o bônus até 0 (Atributos acima dos básicos) → "Adicionar Qualidade" → "Ambidestro" + Enter | A prévia diz "restam 0"; a recusa aparece dentro da folha, com "Ambidestro" no campo; nenhum "não se compra na criação" | `p07d-web-390-T-08b-1..2.png` | |
| T-08c | iOS SE | J1 | T-08a pelo idb (QAA-05) | Mesmo de T-08a; o texto da folha cabe sem corte | `p07d-iosSE-T-08c-1..2.png` | |
| T-24a | Web 390 (Chromium e WebKit) | J1 | "Lupino R" → Vantagens → "Adicionar Dom" | Três blocos ("Da Raça · Lupino", "Do Augúrio · Ahroun", "Da Tribo · …"), cada opção com "Posto 1" e o selo; "Busque para ver os outros Dons" | `p07d-web-390-T-24a-1.png` | |
| T-24b | Web 390 | J1 | Buscar um Dom de Posto 2 → tocar → Vantagens → aba de pontos | A linha diz "Posto 2 · na criação, os Dons são de Posto 1: confirme com o narrador."; o "O que falta" tem "Dons: 1 acima do Posto 1"; "Concluir" não fica bloqueado por isso | `p07d-web-390-T-24b-1..3.png` | |
| T-24c | Web 390 | J1 | "Adicionar Dom" → "Faro do Asfalto" (fictício) → "Adicionar “Faro do Asfalto”" | Entra como texto livre, com "Posto 1" | `p07d-web-390-T-24c-1.png` | |
| **T-24d** | **Android 393 (obrigatório: EA-14)** e 360 dp | J1 | "Lupino R" no AVD → "Adicionar Dom" com o teclado de software → escolher uma recomendada → abrir o Dom → "+" no Posto → Aplicar | A folha com os blocos acima do teclado; o voltar do Android fecha a folha, não a tela; o aviso na linha e na folha; o `dump` com o selo e o "Posto 1" no `content-desc` da opção | `p07d-and-393-T-24d-1..4.png`, `p07d-and-360-T-24d-5.png` | |
| T-24e | iOS SE e iPhone 17 | J1 | T-24a e T-24b pelo idb | Os blocos rolam dentro da folha; o aviso na linha | `p07d-iosSE-T-24e-1..2.png`, `p07d-ios17-T-24e-3.png` | |
| T-24f | Web 1280 | J1 | "Adicionar Dom" | Diálogo central, painel ≤ 560 px (medido no painel, não na camada); Esc fecha e o foco volta a "Adicionar Dom" | `p07d-web-1280-T-24f-1..2.png` | |
| R-25a | Web 390 (Chromium e WebKit) | J1 | "Brujah R" → Vantagens → adicionar Potência → "Aumentar Potência" 2 vezes | 1 → 3 na linha, sem folha; o contador "Disciplinas · 3/3"; no DOM, os botões "Aumentar Potência" e "Diminuir Potência" com pelo menos 44 × 44 | `p07d-web-390-R-25a-1..2.png` | |
| R-25b | Web 390 | J1 | Com 3/3 em Pontos básicos → "Aumentar Potência" | O "+" com `aria-disabled="true"` (sem `disabled`); o toque mostra o aviso **sob a linha da Potência**; o `aria-describedby` do "+" aponta o aviso | `p07d-web-390-R-25b-1.png` | |
| R-25c | Web 390 | J1 | Tocar no nome "Potência" | A folha abre com nome, especialização e notas, sem Valor; Esc fecha e o foco volta ao nome | `p07d-web-390-R-25c-1.png` | |
| R-25d | Android 360, 393 e 411 dp; 360 com `font_scale 1.3` | J1 | Vantagens de "Brujah R" com 3 Disciplinas e 2 Antecedentes | O nome, o −/+ e (se o P10-D entrou) o "?" na mesma linha, sem transbordo; o nome quebra em duas linhas com a fonte maior, sem cortar o −/+; os `bounds` do controle com pelo menos 48 dp de altura | `p07d-and-360-R-25d-1.png`, `-393-…-2.png`, `-411-…-3.png`, `-360fs-…-4.png` | |
| R-25e | iOS SE | J1 | Subir um Antecedente de 1 para 3 pela linha (IA-29) | 2 toques; o VoiceOver lê "Recursos, ajustável, 3 de 5" (o `describe-all` com o `AXLabel` e o valor) | `p07d-iosSE-R-25e-1..2.png` | |
| R-26a | Web 390 | J1 | "Brujah R" → "Adicionar Disciplina" | "Do clã" no topo com 3 opções, cada uma com "do clã" no texto e no nome; "Outras" depois | `p07d-web-390-R-26a-1.png` | |
| R-26b | Web 390 | J1 | Escolher "Dominação" | A linha diz "fora do clã: confirme com o narrador"; o "O que falta" tem "Disciplinas: 1 fora do clã"; nada bloqueia | `p07d-web-390-R-26b-1..2.png` | |
| R-26c | Web 390 | J1 | Vantagens → Fraqueza; depois trocar o Clã para Toreador na identidade; depois editar a Fraqueza e voltar a Brujah | O resumo do Brujah; o do Toreador; o texto editado fica ao trocar o Clã, e "Usar o resumo do clã" aparece | `p07d-web-390-R-26c-1..3.png` | |
| R-26d | iOS SE e iPhone 17 (IA-07, IA-21) | J1 | R-26a e R-26c pelo idb | Mesmo; o selo no `AXLabel` da opção | `p07d-iosSE-R-26d-1..2.png`, `p07d-ios17-R-26d-3.png` | |
| R-26e | Android 393 | J1 | R-26a e R-26b no AVD | O selo no `content-desc` da opção e o aviso na linha, no `dump` | `p07d-and-393-R-26e-1..2.png` | |
| R-26f | Web 390 e Android 393 | J1 | "Verbena R" → Esferas → "Esfera de afinidade" → "Trocar" | As da Tradição primeiro, com "da Tradição"; escolher outra mostra "fora da Tradição: confirme com o narrador" na linha | `p07d-web-390-R-26f-1..2.png`, `p07d-and-393-R-26f-3.png` | |
| R-26g | Web 1280 | N | Abrir "Brujah R" de J1 (Leitura) | A Fraqueza com o resumo; o selo não aparece em Leitura (fica para o P09-D) | `p07d-web-1280-R-26g-1.png` | |
| P07-C | Web 390 | J1 | "Adicionar Qualidade" → "Ambidestro" de novo | "Já há “Ambidestro” na ficha." e "Adicionar outro “Ambidestro”"; o Enter explica e não adiciona | `p07d-web-390-P07C-1.png` | |
| Versão anterior | Web 390 (só na integração) | J1 | Uma ficha V20 criada antes do `templates:publish` da versão nova | Abre normalmente; o −/+ na linha vale; sem selo e sem a Fraqueza preenchida (§2.3, ponto 4) | `p07d-web-390-versao-1.png` | |

### 11.f Acessibilidade mínima

- **O −/+ da linha tem o nome do item:** no web, `button` "Aumentar Potência" e "Diminuir Potência" (DOM); no Android, o nó ajustável com `content-desc` "Potência" e o valor "2 de 5"; no iOS, `AXLabel` "Potência" com o traço ajustável. O "+" bloqueado é tocável (`aria-disabled` no web, dica do controle no app).
- **O selo é texto e entra no nome acessível:** "Potência, do clã" na opção (DOM: nome do `button`; `content-desc` no Android; `AXLabel` no iOS), "Forças, da Tradição" no rádio, e "Potência, 2 de 5, do clã" no nome da linha.
- **"fora do clã: confirme com o narrador" e o aviso de Posto** são texto na árvore, não só cor.
- **O aviso da recusa** sob a linha tem `role="alert"` (DOM); no app, conferir se o VoiceOver e o TalkBack o falam (achado da onda 2, §10). Se não falarem, registrar: a correção é no `DraftNoticeText`, num lugar só.
- **O "?" do P10-D**, se já integrado, tem o nome "Ajuda: <item>" e abre pelo toque e pelo teclado; o P07-D só confere que ele não tira o alvo de 44 do −/+.
- **A folha:** Esc, foco de volta ao gatilho e um "Fechar" só (T-71), nas duas folhas.

### 11.g Limpeza

- Parar a API e o Metro.
- Desligar o AVD (`adb emu kill`) e os simuladores (`xcrun simctl shutdown all`).
- `adb shell wm density reset`, `adb shell settings put system font_scale 1.0` e `adb shell settings put secure show_ime_with_hard_keyboard 0`.
- Encerrar o `idb_companion` (o `lsof` não mostra nada escutando) e sair do venv.
- O banco `tms_p07d` pode ser apagado (`dropdb`). O log do seed e as capturas ficam no scratchpad até a integração; nada vai para o repositório.

### 11.h Quando uma plataforma não puder ser conferida

O resultado diz "não conferido" e o motivo, por exemplo:

- "o build do iOS com assinatura local falhou em …";
- "o `pip-audit` acusou vulnerabilidade no fb-idb; o roteiro do iOS parou";
- "o catálogo de Dons ainda não entrou (commit 8 esperando a licença)": o T-24a a T-24f ficam "não conferido", e o T-24d continua obrigatório quando o catálogo entrar.

O passo fica para a integração ou para o roteiro antes do release. Nunca "ok" sem a evidência.
