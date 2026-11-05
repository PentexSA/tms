# P10-C · Template: derivados, ordem e textos: plano de implementação

> Plano · 2026-11-04 · base conferida: `onda/4-conteudo-guia` em `c96f2d4` (o código citado é o do `3cc07f1`: os PRs #48 e #49, que vieram depois, só mudam o CI, o CLAUDE.md, os `*.pg.test` e uma config temporária do E2E)

Este plano corrige o pacote [P10-C da matriz de achados](../testes/2026-11-01/matriz-achados.md#p10-c), da onda 4. Ao fim do pacote:

- na criação, o valor atual da Força de Vontade, da Gnose e da Fúria acompanha o permanente enquanto está cheio, e a ficha nasce cheia (4/4, não 4/7);
- na criação por pontos, o "−" de um valor que começa por uma escolha ou por uma fórmula (a Fúria pelo Augúrio, a FdV pela Coragem) tem cara de indisponível no valor inicial, e o toque diz por quê;
- voltar ao valor de partida tira a alteração do contador;
- as listas de escolha (Arquétipos, Disciplinas, Antecedentes) aparecem na ordem do rótulo em português;
- a lista vazia concorda em gênero ("Nenhuma Qualidade", "Nenhuma Cicatriz").

É um pacote de correção. Não remove campo, não muda regra do jogo e não afrouxa limite:

- o valor inicial continua o do template, e o servidor continua recusando concluir abaixo dele (`CREATION_BELOW_INITIAL`), como hoje;
- a recusa nova do "−" é só do app, e é mais estrita que o servidor, nunca mais frouxa;
- a validação da ficha (`validateSheet`), a conta (`checkCreation`) e o congelamento ao concluir (`creationFreeze`) não mudam. O servidor continua a autoridade.

O pacote **não muda nenhum template nem o `schema.json`** (seção 3.6) e não muda a API HTTP. Ele acrescenta duas funções puras ao `@tms/sheet-core`, que só o app usa, e uma prop opcional ao `Stepper` do `@tms/ui` (seção 3.7).

Todas as linhas citadas são do `3cc07f1`. A matriz cita o `1db3db9`, de antes das ondas 1 a 3. Onde a causa provável da matriz está errada, ou não se confirma, a seção 3 diz. Os 8 merges da `main` depois da onda 3 (observabilidade, `persist.tsx`, `sync.ts`, `http.ts`, `errors.ts`, o E2E do T-04 e as releases) não tocam nenhum arquivo deste pacote. O único arquivo de `apps/frontend/sheet/` que mudou depois de `ff9e420` é o `sheet/sync/sync.ts`.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md), "Como executar", "Decisões de produto" e §P10-C | Itens, "PR local", ondas empilhadas e critério de saída da onda 4 |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §7, linha "Derivados" (l.299), e a R-22 e a R-29; [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) §7 | A U-05, que só existe no relatório de usabilidade, e as recomendações |
| Notas: [po-app](../testes/2026-11-01/notas/po-app.md) (POA-16, POA-09), [po-web](../testes/2026-11-01/notas/po-web.md) (POW-20, POW-26), [narrador-web](../testes/2026-11-01/notas/narrador-web.md) (NW-23), [narrador-app](../testes/2026-11-01/notas/narrador-app.md) (NA-21, NA-28), [experiente-web](../testes/2026-11-01/notas/experiente-web.md) (EW-19, EW-24, EW-25, diário das 13:01), [experiente-app](../testes/2026-11-01/notas/experiente-app.md) (EA-19, EA-22, EA-28), [iniciante-app](../testes/2026-11-01/notas/iniciante-app.md) (IA-23, IA-28), [qa-web](../testes/2026-11-01/notas/qa-web.md) (QAW-13, QAW-26), [qa-app](../testes/2026-11-01/notas/qa-app.md) (QAA-21) | Cenários do critério de pronto (§7) e do roteiro manual (§11) |
| [auditoria-fichas-wod.md](../auditoria-fichas-wod.md) l.151 (ordem das Habilidades) e l.162 (licença dos Dons); [avaliacao-ui-ux.md](../avaliacao-ui-ux.md) TL-19 (concordância) | O que já era conhecido |
| [regras-wod.md](../regras-wod.md), tabela de custos de bônus | O preço da FdV, da Fúria e da Gnose, que este pacote não muda |
| `design/templates/README.md` §2, §3 (`resource`, "Fórmula de valor inicial", `list`) e §10; `schema.json` | O contrato que o pacote **não** muda, e por quê |
| [onda-1.md](onda-1.md) §6.3; [onda-2.md](onda-2.md) §4.2, §6.5 e §6.9; [onda-3.md](onda-3.md) §8, §11 (achado 7); [P05-C](P05-C-feedback-conta.md) §3.0 e §3.2; [P07-C](P07-C-vantagens-folhas.md) §3; [P03-C](P03-C-rascunho-salvamento.md) T-54 | A recusa perto do toque que o "−" reaproveita, a ordem do `jsonb` e os pontos para o PO em aberto |

## 1. Objetivo e itens

**Objetivo (matriz).** Derivados e mínimos acompanham o rascunho (FdV, Gnose, Fúria, Quintessência), as listas seguem a ordem do rótulo em português e os textos do vazio concordam.

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| T-22 | média | Na criação, subir o permanente (com bônus ou no Editar) deixa o atual no valor antigo: a ficha nasce com FdV 4/5, 4/6, 4/7; no W20, Gnose e Fúria também | `apps/frontend/sheet/evolve/ResourceEditorRow.tsx:25-28` (o patch parte de `stored(r)`) e `:47-53` (só a descida leva o atual); `packages/sheet-core/src/fields/resource.ts:22-37` (`stored` grava o `current` resolvido) |
| T-60 | baixa | Arquétipos e Disciplinas do V20 na ordem do livro em inglês, com o nome traduzido; os Antecedentes do Mago já estão em ordem alfabética | Arrays do template: `design/templates/vtm-v20.json:78-121` e `:127-170` (`suggestions`), `:441-459` e `:470-481` (`catalog`); `wta-w20.json:647-658`. A tela mostra na ordem do array: `apps/frontend/sheet/editors/Suggestions.tsx:31-46`; `apps/frontend/sheet/evolve/ListEditor.tsx:207-213`, `:283-307` |
| U-05 | baixa (estimado) | No Mago, a Quintessência = Avatar só apareceria depois de salvar; durante a criação, a roda mostraria 0 | **Não confirmado no código** (seção 3.2): `packages/sheet-core/src/resolve.ts:433-445` calcula a roda sobre o rascunho, e o store resolve o rascunho (`apps/frontend/sheet/store/sheetStore.ts:398-421`) |
| T-66 | baixa | "Nenhum Qualidade": o gênero sai de uma heurística pela letra final | `apps/frontend/sheet/evolve/text.ts:28-37` (`noneOf`), usada em `ListEditor.tsx:134-138` e em `apps/frontend/sheet/views/ListView.tsx:148`. A mesma heurística erra "Cicatriz" no W20 (seção 3.5) |
| T-85 | baixa | No W20, o "−" da Fúria permanente fica habilitado no valor do Augúrio e desce sem aviso na linha; voltar ao valor deixa "1 alteração" | O "−" usa o mínimo do template: `ResourceEditorRow.tsx:45`; a previsão só existe para o "+": `apps/frontend/sheet/creation/creation.ts:588-636` e `packages/ui/src/Stepper.tsx:156-170`; o texto do Orçamento: `creation.ts:257-258` |

## 2. Decisões aplicadas

**O P10-C não tem decisão própria (D-xx).** É correção. As decisões da onda 4 encostam nele assim:

| Decisão | O que diz | Como o P10-C acomoda |
|---|---|---|
| D-05 (P05-D) | "Faltam: …" na barra, com itens tocáveis; aba "Orçamento" → "Pontos" | O P10-C não mexe na barra nem na aba. Com a recusa do "−" (T-85), o problema `CREATION_BELOW_INITIAL` deixa de nascer de um toque, e sobra só quando uma escolha muda o valor inicial (seção 3.3). O texto desse problema (`problemText`, `creation.ts:257-258`) ganha o número e a origem; o "Faltam" do P05-D o reaproveita |
| D-06 (P07-D) | Qualidade com bônus, pelo custo do item | Nada da compra. O T-66 só corrige o texto da lista vazia de Qualidades |
| D-07 (P07-D) | Catálogo de Dons com nome e nível, os de Raça, Augúrio e Tribo em destaque | A ordem pelo rótulo (T-60) é a base. O P07-D separa os destacados primeiro e ordena dentro de cada parte com o mesmo comparador (seção 3.4) |
| D-08 (P07-D) | −/+ na própria linha dos itens de lista com valor | O `Stepper` ganha `decrease` (seção 3.7). O −/+ da linha usa as duas previsões, para cima e para baixo, com o mesmo mecanismo |
| D-09 (P07-D) | Disciplinas do clã primeiro, com selo | Mesma regra da D-07: o P07-D põe as do clã primeiro, e o resto segue em ordem pelo rótulo |
| D-11 (P10-D) | "?" em cada campo e em cada opção | O P10-C não muda a forma das opções, só a ordem. O "?" do P10-D entra nas mesmas linhas (seção 8.4) |
| D-12 (P10-D) | "Casa ou subgrupo", opcional | Não toca este pacote |

Fica fora, como nos outros planos: o progresso na Mesa e o Orçamento em leitura para o narrador (P09-D, D-10, onda 5); os planos alinhados com a tela (P01-D, D-13, onda 5); o extrato da conta na ficha concluída (R-17, [onda-2.md](onda-2.md) §6.6, ponto do PO).

**O que o código mostra sobre o escopo da matriz** (apontado, não decidido):

1. **T-60 e T-66 estão como "de template" na coluna "Escopo".** A ficha fica para sempre na versão do template em que nasceu: `characters.template_version` (`apps/api/src/sheets/routes.ts:278`), e a API monta o modelo por essa versão (`modelFor`, `routes.ts:372`, `chronicles/table.ts:124`). Não existe atualização de versão de ficha. Uma correção no JSON do template só vale para as fichas criadas depois da publicação: as fichas do teste com personas continuariam com "Nenhum Qualidade" e a ordem do inglês. A correção na tela vale para todas as versões. **Recomendação técnica: na tela, sem mudar o template** (seções 3.4 a 3.6).
2. **A R-29 tem partes que nenhuma linha do P10-C pede no "esperado".** "Escolher da lista" de Natureza e Comportamento também no Mago, Foco perto da Tradição, Posto inicial e forma natural conferidos no livro. São conteúdo e ordem de seção do template, e o "Escolher da lista" do Mago seria uma lista nova de nomes no `mta-m20`. Ficam fora do P10-C, para o PO decidir onde entram.
3. **A ordem das Habilidades na ficha** (`auditoria-fichas-wod.md` l.151, citada como "já conhecido" no T-60) é a ordem das seções do template, não uma lista de escolha. É a ordem oficial do livro. Mudá-la é mudar o layout da ficha, com aumento de versão, e só valeria para fichas novas. Fica fora; é ponto para o PO.
4. **T-22: as fichas já concluídas com FdV 4/7 não são corrigidas.** Seria uma correção de dados em massa. O dono ou o narrador ajusta em Jogo, como hoje.

**Pontos para o PO das ondas 1 a 3 que encostam aqui** (continuam abertos; nenhum é tratado como decidido):

- **[onda-2.md](onda-2.md) §6.9, "Em jogo" recolhido na Criação (T-59).** A FdV, a Fúria, a Gnose e a roda do Mago ficam no "Em jogo", que começa recolhido na Criação (`apps/frontend/sheet/SheetView.tsx:250-253`, `:316-332`). O T-22 corrige o valor, mas ele só aparece depois de abrir o bloco. O P10-C não muda o recolhimento. O roteiro da seção 11 abre o bloco em cada passo.
- **[onda-2.md](onda-2.md) §6.5, o "+" desabilitado de verdade ou com cara de indisponível.** O "−" do T-85 segue o padrão que o P05-C aplicou ao "+": `aria-disabled` e opacidade, mas tocável, e o toque explica. A matriz escreve "com o '−' desabilitado". Se o PO decidir por `disabled` de verdade, o "+" e o "−" mudam juntos.
- **[onda-1.md](onda-1.md) §6.3, "Senhor atualizado" sem o valor.** Não muda. A Natureza escolhida da lista (T-60) continua aparecendo como "atualizado" no resumo de salvar, pela regra do README dos templates (§10).

## 3. Desenho por item

### 3.0 O que o código, o template e as plataformas fazem hoje

- **Derivados.** O `resolve()` calcula o permanente pela fórmula do `default` quando a ficha não tem valor gravado (`packages/sheet-core/src/resolve.ts:288-313`, via `formulaValue`, `defaults.ts:16-35`). O atual é `int(v.current) ?? shownMax` (`resolve.ts:304`): sem nada gravado, a ficha nova começa cheia. A roda do Mago, sem valor gravado, começa com a Quintessência = Avatar (`resolve.ts:433-445`). O store resolve a ficha com o rascunho por cima (`derive` → `shown(values, draft)` → `resolve(model, display)`, `sheetStore.ts:398-421`). O servidor roda o mesmo `resolve` (o `dist` do sheet-core) no `validateSheet`, no `checkCreation` e no `creationFreeze`.
- **A escrita de um recurso.** O `ResourceEditorRow` monta o patch a partir de `stored(r, sheet)` (`ResourceEditorRow.tsx:25-28`). O `stored` do `resource` grava o `current` resolvido (`fields/resource.ts:22-37`). Com o atual ainda não gravado, ele vale o permanente velho e fica gravado junto com o permanente novo. O validador exige `current` e `permanent` em todo recurso gravado (`packages/sheet-core/src/validate/sheet.ts:137-169`: `int(current)` responde "precisa ser inteiro" sem ele). Por isso gravar só o permanente não é uma saída: mudaria o contrato que o servidor aplica.
- **O valor inicial na conta.** O `checkCreation` usa como inicial o valor que o campo teria sem nada gravado (`initialOf` → `defaultOf`, `packages/sheet-core/src/creation.ts:323-344`): a Fúria do Ahroun começa em 5, a FdV do V20 na Coragem e a Humanidade em Consciência + Autocontrole. Abaixo dele, `CREATION_BELOW_INITIAL` com severidade `incomplete` (`creation.ts:398-404`): salvar passa, concluir não. O servidor aplica as duas coisas (`checkCreationUpdate`, `creation.ts:790-810`, recusa só os problemas `blocking`).
- **O "−".** O `Stepper` desabilita o "−" só no mínimo do template (`Stepper.tsx:163`; `ResourceEditorRow.tsx:45`: `min: def.permanent.min`). A previsão do P05-C (`stepAdvice`, `creation.ts:588-636`; `useStepAdvice`, `useStepAdvice.ts:19-26`; `useRowFeedback`, `useRowFeedback.tsx:13-48`) e o `markSoftDisabled` (`Stepper.tsx:70-84`, `:153-160`) só existem para o "+".
- **Voltar ao valor.** O rascunho apaga a alteração quando o valor novo é igual ao `from` (`sheetStore.ts:458-462`). Para um campo sem valor gravado, o `from` é `null` (`setDraftValue`, `:676-681`), e o valor de partida materializado (`{ permanent: 5, current: 5 }`) nunca é igual a `null`.
- **Listas de escolha.** `suggestions` (campo `text`) e `catalog` (campo `list`) são arrays. O `jsonb` reordena as chaves de objeto (a causa do T-54, [P03-C](P03-C-rascunho-salvamento.md)), mas mantém a ordem dos arrays. O motor (`compileTemplate`) passa os arrays como estão, e a tela os mostra nessa ordem. **A ordem vem do template.** As opções de `choice` (Clã, Augúrio, Raça, Tradição) também são arrays, e a ordem delas tem sentido: os Augúrios na ordem das fases da lua, e o Caitiff no fim dos clãs.
- **Ordenação nas plataformas.** O app já usa `Intl.Collator('pt-BR', { sensitivity: 'base' })` na Mesa (`apps/frontend/components/chronicles/tableItems.ts:143`), no Hermes do Android e do iOS e no web. O `fold` da busca (`text.ts:4-6`: `normalize('NFD')` e `\p{M}`) também roda nas três plataformas, na busca do `AddItemSheet`.
- **Versão do template.** Ver o ponto 1 da seção 2. A publicação é a migration `0020_product_templates.ts` (lê os arquivos de `design/templates`) e o `pnpm templates:publish --published` (`apps/api/package.json:15`; `apps/api/src/scripts/publish-template.ts`), com versão publicada imutável (`apps/api/src/templates/publish.ts:107-114`). O `schema.json` rejeita propriedade desconhecida (README §2): um campo novo no template faria o app antigo mostrar "Atualize o app" ou "Recarregue a página" (`apps/frontend/sheet/UnsupportedTemplate.tsx:38-47`) nas fichas da versão nova.

### 3.1 T-22 · O atual acompanha o permanente na criação

**Causa: confirmada, com o mecanismo exato.** A matriz marca a causa como "suposta" e cita `ResourceEditorRow.tsx` l.43–47 (estimado). O arquivo está certo. No `3cc07f1`, o defeito está em duas partes:

- o patch parte de `stored(r, sheet)` (`ResourceEditorRow.tsx:25`), que grava o atual resolvido. Sem valor gravado, ele é o permanente antigo;
- só a descida do permanente leva o atual junto (`:47-53`).

Subir o permanente de 4 para 5 grava `{ permanent: 5, current: 4 }`. Depois disso, o `resolve` lê o `current` gravado, e a ficha mostra 4/5 em todo lugar. Vale para a compra com bônus (Criação por pontos) e para a edição no Editar da criação livre: os dois usam a mesma linha. No W20, vale para a Fúria, a Gnose e a FdV (`wta-w20.json:462-515`). No M20, para a FdV.

O derivado **já é calculado sobre o rascunho**: enquanto o recurso não é gravado, permanente e atual seguem a fonte (a Coragem, o Augúrio, a Raça, a Tribo), no app e no servidor. O que congela o atual é a primeira escrita do editor.

**Desenho.**

1. **`editResource` no `@tms/sheet-core`** (`packages/sheet-core/src/fields/resource.ts`, ao lado do `stored`): uma função pura que diz o valor a gravar quando uma das linhas do recurso muda.

   ```ts
   export function editResource(
     r: ResolvedResource,
     part: 'permanent' | 'max' | 'current',
     n: number,
     options: { readonly follow: boolean }
   ): ResourceValue
   ```

   | Caso | Hoje | Depois |
   |---|---|---|
   | `current` | `{ ...stored, current: n }` | igual |
   | `permanent` ou `max` (com teto), `follow` e o atual cheio (`current >= cap`) | o atual fica | **o atual vai para `n`** |
   | `permanent` ou `max`, o atual abaixo do teto (gasto em Jogo ou baixado à mão) | fica; desce junto se passar de `n` | igual |
   | sem `follow` (ficha concluída, Evoluir com XP) | o atual fica; desce junto se passar de `n` | igual |
   | sem teto (`tempUncapped`, o Renome do W20; `overMax`) | o atual fica | igual |

   O resultado sempre tem `current` e `permanent` (ou `max`), como o validador exige, e nunca tem o atual acima do teto. É a regra da R-22: o atual acompanha o permanente até o jogador mexer nele. O "cheio" é o que distingue o atual que nunca foi mexido do atual gasto.
2. **O `ResourceEditorRow` usa o `editResource`** nas três linhas (`:40-78`), com `follow` verdadeiro quando a ficha ainda está na criação: `useCreation()?.status` em `creating` ou `pending` (`apps/frontend/sheet/creation/CreationContext.tsx:8-20`). Sem provedor (prévias, Mesa, testes antigos), `follow` é falso e o comportamento é o de hoje. A ficha concluída continua como está: subir a FdV com XP não enche o atual.
3. **Onde o valor aparece** (todos leem o `resolve`, nenhum muda):
   - no "Em jogo" da Criação e do Editar, a própria linha "Força de Vontade atual" do `ResourceEditorRow` (`:70-78`);
   - no "Em jogo" do Jogo a partir de 600, a `ResourceRow` (`apps/frontend/sheet/views/resource/ResourceVisual.tsx:17-27`);
   - no dock do Jogo no celular (`apps/frontend/sheet/play/CombatDock.tsx:36-46`), com os recursos do `dock` do template: V20 Vitalidade, Sangue e FdV (`vtm-v20.json:795`); W20 Vitalidade, Fúria e Forma (`wta-w20.json:931`); M20 Vitalidade, roda e FdV (`mta-m20.json:829`). **A Gnose não está no dock nem na Mesa**, só no "Em jogo";
   - na Mesa do narrador (`apps/frontend/components/chronicles/TableRow.tsx:51-67`, `:172-180`), com a ficha **salva** do servidor. O rascunho do jogador fica no aparelho dele, e a Mesa só muda depois do "Salvar". É assim hoje, e continua.
4. **No servidor, nada muda.** O `validateSheet` aceita o valor (atual ≤ permanente). O `creationFreeze` continua gravando cheio o que ficou sem valor ao concluir (`creation.ts:828-848`). O lote novo é o mesmo evento de hoje (`values.willpower`), com outro `to`.
5. **O resumo de salvar** continua dizendo só o permanente ("Força de Vontade · permanente 3 → 4", `packages/sheet-core/src/labels.ts:64-68`). O atual que acompanha não aparece como alteração à parte. Ver a pergunta 8 da seção 9 sobre o "—" do `from` vazio.

### 3.2 U-05 · Quintessência = Avatar durante a criação

**Causa: não confirmada.** A linha inteira está como "(estimado)", sem screenshot próprio; a fonte é a nota EW das 13:01 ("Durante a criação a roda mostrava 0 até salvar") e a linha "Derivados" do relatório de usabilidade. No `3cc07f1`:

- o `resolve` calcula a roda sem valor gravado pelo `default` do preenchimento (`resolve.ts:433-445`), e a Quintessência do `mta-m20` é `sum` do Antecedente "Avatar" (`mta-m20.json:472-479`), lido pelo nome do item (`listItemValue`, `packages/sheet-core/src/validate/util.ts:57-65`);
- o store resolve o rascunho (`sheetStore.ts:398-421`), e a roda não tem editor na Criação: ela não é gravada antes do Jogo;
- o teste `defaults.test.ts:457-472` já prova a roda com Avatar 3 no template do produto;
- o código de `1db3db9` é o mesmo nesse trecho (`resolve.ts`, `case 'clock'`, e `shown`/`derive` do store).

Explicações compatíveis com o que a nota conta, nenhuma confirmada:

- a roda olhada antes de pôr o Avatar (o `65-ficha-mago-aberta-1280.webp` mostra 0, que está certo);
- a roda olhada na Mesa ou numa ficha alheia, que só mostram o que foi salvo;
- uma ação de Jogo antes de salvar gravaria a roda e cortaria o vínculo com o Avatar. Na `1db3db9`, salvar exigia trocar para Jogo.

**Desenho.** O P10-C prende o comportamento com testes (seção 4.1) e confere no roteiro, no web a 1280 (a plataforma da E-W) e no iOS (a do PO-A). Se o roteiro reproduzir, os suspeitos, nesta ordem:

1. o `shown` voltando para a ficha sem o rascunho quando o lote do rascunho não aplica (`sheetStore.ts:398-406`);
2. a roda gravada por uma ação de Jogo durante a criação.

O que for achado vai para a seção 10. Se a roda gravada for a causa, a regra da seção 3.1 ("acompanha enquanto não mexido") não se aplica: a roda é `clock`, e um preenchimento gravado é escolha do jogador.

### 3.3 T-85 · O "−" no valor inicial e o contador que volta a zero

**Causa: confirmada, com uma correção.** A matriz cita a recusa em `creation.ts` l.191 ("abaixo do valor inicial"), que no `3cc07f1` está em `:257-258`, e o "−" no `ResourceEditorRow.tsx` (estimado): ele usa o mínimo do template (`:45`). **A diferença entre o V20 e o W20 não é regra:**

- a FdV do V20 tem mínimo 1 no template e começa na Coragem, que começa em 1. Com a Coragem em 1, a FdV está no mínimo do template, e o "−" fica desabilitado por isso;
- com a Coragem em 3, o "−" da FdV também desce abaixo do inicial sem aviso, como a Fúria (o `26-fdv-derivada-android.webp` mostra o "−" da FdV habilitado em 3);
- a Fúria do Ahroun começa em 5, longe do mínimo 1.

O mesmo vale para a Humanidade do V20 (inicial = Consciência + Autocontrole), a Gnose e a FdV do W20 e a FdV do M20 (inicial fixo 5).

**"Voltar ao valor deixa 1 alteração": confirmado.** O Ahroun sem Fúria gravada desce de 5 para 4 e grava `{ permanent: 4, current: 4 }`. Ao subir de novo, o patch sai do `stored`, que agora é `{ 4, 4 }`, e grava `{ permanent: 5, current: 4 }`: o atual fica para trás (é o T-22). E esse valor nunca é igual ao `from: null` (seção 3.0).

**Desenho.** O mecanismo é o do P05-C para o "+" (`stepAdvice`, `useStepAdvice`, `markSoftDisabled`), agora também para baixo:

1. **A previsão do "−"** (`apps/frontend/sheet/creation/creation.ts`). O `stepAdvice` ganha `direction: 'up' | 'down'` (padrão `'up'`, sem mudar quem já chama). Para baixo:
   - com o componente da conta no valor inicial (`c.value <= c.initial`), sem travar no baseline e com o inicial acima do mínimo do campo: `advice('initial', …)`;
   - em qualquer outro caso: `null`. O "−" continua livre acima do inicial, para desfazer uma compra.

   `RefusalCause` ganha `'initial'` (`creation.ts:334-342`). O `useStepAdvice(path, direction)` repassa a direção.
2. **A origem do valor.** O `startSource` (`creation.ts:772-787`) já diz "Coragem" ou "Consciência + Autocontrole". Ele ganha o `resolved` opcional: na fórmula por escolha (`{ from: 'auspice', map }`), acrescenta a opção escolhida ("Augúrio: Ahroun"). O extrato do P05-C continua chamando sem `resolved` e não muda.
3. **Os textos** (rascunho do time, para revisão; texto de interface, nada do livro):
   - dica do "−" e aviso do toque: "Fúria: na criação, não fica abaixo de 5 (vem de Augúrio: Ahroun).";
   - sem origem (a FdV fixa do M20): "Força de Vontade: na criação, não fica abaixo de 5.";
   - `problemText` do `CREATION_BELOW_INITIAL` (`:257-258`), que o Orçamento e o "Faltam" do P05-D mostram: "Fúria: abaixo de 5, o valor inicial (vem de Augúrio: Ahroun)." no lugar de "Fúria: abaixo do valor inicial.".
4. **O toque recusado no rascunho.** O `draftRefusal` (`creation.ts:505-543`) recebe os caminhos do toque. Ele recusa com a causa `'initial'` quando a conta depois do toque tem um `CREATION_BELOW_INITIAL` novo, ou maior, **num caminho que o toque mudou**. A recusa vale nas duas fases (Básicos e Bônus).
   - Subir a Coragem com a FdV comprada acima não é recusado: o problema nasce noutro caminho (`values.willpower`), e o Orçamento o mostra como hoje.
   - Trocar o Augúrio também não é recusado.

   É só do app, como as recusas de Básicos do P05-C. O servidor continua aceitando salvar abaixo do inicial e recusando concluir (`incomplete`), como hoje.
5. **O `Stepper` com `decrease`** (`packages/ui/src/Stepper.tsx`; seção 3.7).
   - **Web:** o "−" bloqueado pela previsão recebe `aria-disabled="true"` pelo `markSoftDisabled`, sem `disabled` e sem `tabIndex=-1`, com a opacidade do "+" bloqueado (`styles.blocked`). Segurar não repete.
   - **App:** os botões continuam fora do leitor de tela. A dica do controle ajustável junta as duas previsões: "Aumentar: +1 = 1 bônus. Diminuir: na criação, não fica abaixo de 5 (vem de Augúrio: Ahroun)." Sem uma delas, fica só a outra, sem o prefixo.
   - **Toque:** o toque chega ao store, que recusa e mostra o aviso perto da linha (`DraftNoticeText`, `notice-<campo>`), como no "+".
6. **Onde o "−" ganha a previsão.**
   - O `useRowFeedback` (`useRowFeedback.tsx:13-48`) devolve também o `decrease`.
   - O `ResourceEditorRow` passa o `decrease` só na linha do permanente (`:40-56`). A linha do atual é de jogo e não tem inicial.
   - O `NumberEditorRow` (`:233-240`) passa nos `rating` da conta: a Humanidade do V20 ganha o mesmo comportamento, pelo mesmo mecanismo.
7. **O contador volta a zero.** A regra do rascunho (`sheetStore.ts:458-462`) passa a apagar a alteração também quando o `from` é `null` e o valor novo é igual ao que o campo teria sem nada gravado. Esse valor vem do `defaultStored(model, sheet, id)`, função nova do `@tms/sheet-core` (seção 3.7): resolve a ficha sem o campo e devolve o `stored` dele. É o mesmo cálculo do `creationFreeze` (`creation.ts:828-848`), e um teste prova que os dois dão o mesmo valor em todo campo com fórmula. Com a alteração apagada, o campo volta a acompanhar a fonte, como diz a ajuda do template ("Começa igual à Coragem até ser marcado", `vtm-v20.json:523`).

   Com os itens 1 a 7 e o T-22: o Ahroun toca "−" em 5 e a Fúria não desce, com o aviso perto da linha; "+" para 6 e "−" para 5 deixam "0 alterações". No Editar da criação livre, que não tem conta, o "−" desce como hoje até o mínimo do template, e voltar ao valor também zera o contador.

### 3.4 T-60 · Listas de escolha na ordem do rótulo

**Causa: confirmada.** A ordem vem do array do template (seção 3.0), não do motor nem do `jsonb`. É a ordem do livro em inglês, com os nomes traduzidos:

- nos `suggestions` de Natureza e Comportamento (42 Arquétipos, `vtm-v20.json:78-121` e `:127-170`);
- no `catalog` das Disciplinas (17, `:441-459`) e dos Antecedentes (10, `:470-481`) do V20;
- no `catalog` dos Antecedentes do W20 (10, `wta-w20.json:647-658`).

O catálogo do M20 já está em ordem alfabética (`mta-m20.json:428-443`).

**Desenho: na tela, genérico.**

1. **`byLabel`** em `apps/frontend/sheet/evolve/text.ts`, ao lado do `fold`: compara `fold(a)` com `fold(b)` (sem acento, sem caixa, "ç" como "c") por ponto de código e desempata pelo rótulo original. Devolve uma cópia ordenada; aceita uma função de chave, para o catálogo de Dons do P07-D, que pode ter nome e nível.
2. **Onde entra.**
   - `SuggestionChips` (`Suggestions.tsx:20-48`), com `useMemo`. Cobre a Nova ficha (`TextEditor.tsx:69-76`, pelo `SuggestionPicker`) e o Editar ou a Criação (`TextEditorRow.tsx:117-123`).
   - As opções do `AddItemSheet` (`ListEditor.tsx:207-213`). O filtro da busca preserva a ordem.
3. **O que não muda:**
   - a ordem das opções de `choice` (Clã, Augúrio, Raça, Tribo, Tradição), que tem sentido no template;
   - a ordem dos itens que o jogador já pôs na lista (a da inserção);
   - a ordem das seções e dos campos da ficha (ponto 3 da seção 2).
4. **Por que um comparador próprio, e não `localeCompare` ou `Intl.Collator`.**
   - O `Intl.Collator` do app (`tableItems.ts:143`) roda em quatro implementações: o ICU do Android pelo Hermes, o Foundation do iOS, o ICU do navegador e o `full-icu` do Node no Jest.
   - Com `sensitivity: 'base'`, letras com e sem acento empatam, e o desempate, o espaço e a pontuação podem variar entre elas. Para estas listas, que só têm letras, espaço e acento, o `fold` com ponto de código dá a ordem alfabética do português.
   - Dá a mesma ordem nas três plataformas e no Jest, e só usa o que a busca já usa em produção (`normalize('NFD')` e `\p{M}`, `text.ts:4-6`).
   - O resultado para os Arquétipos começa "Arquiteto, Autocrata, Bon Vivant, Caçador de Emoções, Camaleão, …" e termina "…, Trapaceiro, Valentão, Visionário". Nas Disciplinas, "Quietus, Quimerismo, Rapidez" e "Taumaturgia, Tenebrosidade, Vicissitude".
5. **Com o P07-D (D-07, D-09):** "do clã" ou "de Raça, Augúrio e Tribo" primeiro, depois o resto. Cada parte usa o `byLabel`, e a ordem das partes é do P07-D.

### 3.5 T-66 · "Nenhuma Qualidade", com o gênero certo

**Causa: confirmada** (`text.ts:28-37`; a matriz cita l.33–36). A heurística trata como feminino só o que termina em "a", fora uma lista de exceções. **A matriz não registrou que ela também erra "Cicatriz"**: o W20 mostra "Nenhum Cicatriz" (`wta-w20.json:663`, `itemLabel` "Cicatriz"). Nos 25 `itemLabel` dos seis templates, só "Qualidade" (V20, M20, W20) e "Cicatriz" (W20) saem errados.

**Desenho: a regra do português na tela.**

- **A regra** (`noneOf`, `text.ts`): o substantivo principal (a primeira palavra, como hoje) é feminino quando:
  - termina em "a", fora a lista de masculinos (`MASCULINE_A`, `:9-26`);
  - ou termina em "-ade", "-ção", "-são", "-gem", "-ie", "-ise" ou "-triz", fora uma lista curta de masculinos (`coração`, `personagem`).
- **O teste é uma tabela com os 25 `itemLabel` dos seis templates**, e cada template novo entra nela. O mesmo texto aparece no Editar (`ListEditor.tsx:134-138`) e na Leitura e no Jogo (`ListView.tsx:148`).
- **Por que na tela e não num campo do template** (`itemGender` no `schema.json`):
  - o campo só valeria para as fichas das versões novas (ponto 1 da seção 2);
  - obrigaria a subir a versão dos três templates;
  - o app antigo mostraria "Atualize o app" nas fichas novas (seção 3.0).
- **Por que não um texto neutro.** "Sem <rótulo da lista>" dispensaria o gênero, mas lê mal em listas como "Sem Inventário", "Sem Equipamento" e "Sem Outros aspectos" (D&D, CoC e Fate).
- **Como generaliza.** A regra é do idioma do template. Hoje todos são `pt-BR` (README §2, `locale`). Um template noutra língua traz a regra dela, escolhida pelo `locale`. Se um rótulo em português fugir da regra, o caminho é a exceção na tabela. O campo `itemGender` fica como pergunta (seção 9, pergunta 5), para quando a tabela não der conta.

### 3.6 Templates: versão, `schema.json` e publicação

**O P10-C não muda nenhum template e não muda o `schema.json`.** As cinco correções estão no código, valem para as fichas de todas as versões, e nenhuma precisa de dado novo:

| Pergunta do briefing | Resposta do P10-C |
|---|---|
| Versão de cada template | Nenhum aumento: vtm-v20 fica em 1.8.0, wta-w20 em 1.6.0, mta-m20 em 1.6.0 |
| Campos novos no `schema.json` | Nenhum |
| Ordem do `pnpm templates:publish` | O P10-C não publica. Os aumentos da onda são do P07-D, do P10-D e do P15-D. **Recomendação técnica para a consolidação: um aumento por template na onda**, depois do último merge, para abrir uma janela só de "Atualize o app" |
| A ficha criada na versão anterior | Recebe as cinco correções, porque elas estão no app. Nenhuma ficha troca de versão |
| "Atualize o app" | O P10-C não o provoca: nenhuma propriedade nova no template |

Se a consolidação preferir o gênero no template (pergunta 5), o campo entra no aumento único da onda, e o `noneOf` lê o campo antes da regra. As fichas antigas continuam com a regra.

### 3.7 API pública que muda (`@tms/sheet-core`, `@tms/ui` e app)

| Pacote | O que muda | Quem usa |
|---|---|---|
| `@tms/sheet-core` | Novo: `editResource(r, part, n, { follow })` (`fields/resource.ts`), exportado pelo `export * from './fields'` (`index.ts:19`) | `ResourceEditorRow` |
| `@tms/sheet-core` | Novo: `defaultStored(model, sheet, id)`: o valor gravado equivalente a não gravar nada (`creation.ts`, ao lado do `creationFreeze`, que usa o mesmo cálculo) | `sheetStore` (contador que volta a zero) |
| `@tms/sheet-core` | **Não muda:** `resolve`, `validateSheet`, `checkCreation`, `checkCreationBatch`, `creationFreeze`, `describeEvent` e o contrato do template | O servidor |
| `@tms/ui` | `Stepper` ganha `decrease?: StepperIncrease` (o tipo serve às duas direções; o nome fica, para não quebrar quem importa). O `markSoftDisabled` passa a valer no "−". Sem `decrease`, nada muda | `ResourceEditorRow`, `NumberEditorRow`; o −/+ da linha do P07-D |
| App (interno) | `stepAdvice(…, direction)`; `RefusalCause` com `'initial'`; `draftRefusal` com os caminhos do toque; `useRowFeedback` com `decrease`; `startSource` com o `resolved` opcional; `byLabel`; `noneOf` com a regra nova | — |
| API HTTP | Nenhuma rota nem resposta muda | — |

**O `dist` do `@tms/sheet-core`.** O servidor, as migrations, o seed e o `templates:publish` leem o `dist`; o Metro e o Jest leem o `src` (CLAUDE.md). O pacote muda o `src` no commit 2 (seção 8.1):

- **quem implementa** roda `npx pnpm -C packages/sheet-core build` logo depois desse commit, antes de rodar a API, o seed ou os testes da API. O `scripts/check-dev-env.mjs` recusa API, seed e `templates:publish` com o `dist` mais velho que o `src`;
- **na integração da onda**, `npx pnpm build` depois de cada merge que mude o sheet-core (este e o P07-D), antes dos testes, do E2E e do roteiro;
- **o CI** constrói pelo `dependsOn` do Turborepo.

O `dist` não é versionado (`.gitignore:11`). Como o servidor não chama as funções novas, um `dist` velho não muda o comportamento da API, mas o `check-dev-env` para de qualquer jeito.

## 4. Testes

### 4.1 Um teste de regressão por bug (falha no `3cc07f1`, passa depois)

| Item | O que o teste prova | Arquivo | Tipo |
|---|---|---|---|
| T-22 | `editResource`: com `follow` e o atual cheio, `permanent` 3 → 4 dá `{ permanent: 4, current: 4 }`; com o atual gasto (2 de 3), o atual fica em 2; descer abaixo do atual leva o atual; sem `follow`, o de hoje; `tempUncapped` não mexe no atual; `max: stored` (os PV do D&D) acompanha como o permanente. Propriedade (fast-check): numa sequência qualquer de toques no permanente com `follow`, partindo de cheio, o atual é sempre igual ao permanente e o `validateSheet` aceita | `packages/sheet-core/src/__tests__/resource-edit.test.ts` (novo) | Bun |
| T-22 | V20, ficha `creating` (com o `CreationContext`), Criação: "Aumentar" na FdV permanente (Coragem 3) → o controle "Força de Vontade atual" com `now: 4`, e o evento `to: { permanent: 4, current: 4 }`. **Falha hoje** (`current: 3`). W20 Lupino: Gnose 5 → 6 com o atual 6; Ahroun: Fúria 5 → 6. M20: FdV 5 → 6 | `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx` | Jest + RNTL |
| T-22 | Dock no Jogo a 390 (`Dimensions` compact) da ficha salva depois da compra: "Força de Vontade, 4 de 4" | `apps/frontend/sheet/__tests__/sheet.layout.test.tsx` | Jest + RNTL |
| T-85 | `stepAdvice(…, 'down')`: Ahroun em 5 → `blocked: 'initial'` com "Fúria: na criação, não fica abaixo de 5 (vem de Augúrio: Ahroun)."; em 6 → `null`; FdV do V20 na Coragem → "(vem de Coragem)"; FdV do M20 em 5 → sem origem; Nosferatu Aparência 0 (baseline no mínimo) → `null`; criação livre → `null` | `apps/frontend/sheet/creation/__tests__/creation.test.ts` | Jest |
| T-85 | `draftRefusal` com o caminho `values.rage` → causa `'initial'`; subir a Coragem com a FdV comprada acima do novo inicial → `null`; `problemText` do `CREATION_BELOW_INITIAL` com o número e a origem | `creation.test.ts` | Jest |
| T-85 | W20 Ahroun em Criação: o controle "Fúria permanente" tem a dica com "não fica abaixo de 5"; a ação `decrement` mostra `notice-rage` com o texto e deixa o rascunho vazio. **Falha hoje** (a Fúria desce para 4) | `apps/frontend/sheet/creation/__tests__/creationStore.test.ts` e `CreationScreen.test.tsx` | Jest + RNTL |
| T-85 | Contador: campo sem valor gravado, `+1` e `−1` → `draftEvents()` vazio (Fúria do Ahroun 5 → 6 → 5; FdV do V20 3 → 4 → 3; Humanidade). **Falha hoje** (1 evento). `defaultStored` é igual ao que o `creationFreeze` grava, em todo campo com fórmula dos três templates | `apps/frontend/sheet/store/__tests__/sheetStore.test.ts`; `packages/sheet-core/src/__tests__/defaults.test.ts` | Jest; Bun |
| T-85 | Guarda da regra do servidor (passa antes e depois): Ahroun com Fúria 4 → `CREATION_BELOW_INITIAL` `incomplete`, `savable: true`, `complete: false` | `packages/sheet-core/src/__tests__/wod-rules.test.ts` | Bun |
| T-85 | `Stepper` com `decrease.blocked`: o "−" fica tocável, com o estilo de bloqueado e sem `onLongPress`; no web, `markSoftDisabled` no "−"; no app, a dica junta "Aumentar: …" e "Diminuir: …" | `packages/ui/src/components.test.tsx` (bloco "Stepper", l.318) e `packages/ui/src/a11y.test.tsx` | Jest |
| T-60 | `byLabel`: acento, "ç", caixa e empate; os 42 Arquétipos e as 17 Disciplinas do V20 na ordem esperada. A Nova ficha V20 mostra as sugestões da Natureza começando por "Arquiteto, Autocrata, Bon Vivant, Caçador de Emoções", com "Valentão" depois de "Trapaceiro". O `AddItemSheet` das Disciplinas tem "Rapidez" depois de "Quimerismo". **Falha hoje** | `apps/frontend/sheet/evolve/__tests__/text-filters.test.ts`; `apps/frontend/app/__tests__/new-character.test.tsx`; `apps/frontend/sheet/evolve/__tests__/ListEditor.test.tsx` | Jest + RNTL |
| T-66 | `noneOf` nos 25 `itemLabel` dos seis templates: "Nenhuma Qualidade", "Nenhuma Cicatriz", "Nenhum Item", "Nenhuma Consequência"… A lista vazia de Qualidades do V20 no Editar e na Leitura. **Falha hoje** | `text-filters.test.ts` (l.16–23 crescem); `ListEditor.test.tsx` (l.108–117) | Jest + RNTL |
| U-05 | M20 em Criação: Antecedente "Avatar" com valor 3 pelo `AddItemSheet` e pela folha do item, **sem salvar** → a roda com "Quintessência 3" no nome acessível. Passa hoje, se a seção 3.2 estiver certa; prende o comportamento | `apps/frontend/sheet/evolve/__tests__/mage.test.tsx` | Jest + RNTL |

O Jest de `apps/frontend` pega `.test.ts` em `sheet/` e em `app/`, mas em `components/` só pega `.test.tsx` (`apps/frontend/jest.config.js:17-29`). Nenhum teste novo fica em `components/`. Mesmo assim, conferir com `npx jest --listTests | grep -E 'text-filters|resource|creationStore'` antes de dar o pacote por pronto.

### 4.2 Testes existentes que mudam junto

| Arquivo | O quê | Por quê |
|---|---|---|
| `apps/frontend/sheet/evolve/__tests__/evolve.test.tsx` (l.409–434) | Não muda: a ficha `helena` está fora da criação (sem `CreationContext`), e o atual continua sem acompanhar. Ele passa a provar o caso "sem `follow`" | T-22 |
| `apps/frontend/sheet/evolve/__tests__/text-filters.test.ts` (l.16–23) | A tabela do `noneOf` vira a dos 25 rótulos | T-66 |
| `apps/frontend/sheet/evolve/__tests__/ListEditor.test.tsx` (l.108–117) | "Nenhuma Disciplina" e "Nenhum Antecedente" continuam; entra "Nenhuma Qualidade" | T-66 |
| `apps/frontend/sheet/store/__tests__/sheetStore.test.ts` (l.357–371) | O caso do valor gravado continua; entra o do `from: null` | T-85 |
| `packages/ui/src/components.test.tsx` (l.318 em diante) | Os casos do "+" continuam; entram os do "−" | T-85 |
| `e2e/tests/journey-storyteller.spec.ts` (l.30–45) | A ficha é de criação livre, em `creating`: depois do "Aumentar Força de Vontade permanente", o atual já acompanha, e o "Aumentar Força de Vontade atual" fica no máximo (desabilitado), o que travaria o `click`. Os três cliques no atual saem, e o passo confere `getByLabel('Força de Vontade atual, 4', { exact: true })` | T-22 |
| `e2e/tests/journey.spec.ts` (l.111) | Conferir: o "Aumentar Força de Vontade permanente" do passo 5 continua 1 evento em `values.willpower`, e os 7 eventos do lote não mudam | T-22 |

### 4.3 E2E (Chromium e WebKit; roda na integração da onda, portas fixas, um por vez)

Contas por `signUp`, crônicas e fichas por `apiAs` (`e2e/support/users.ts`, `e2e/support/creation.ts`), só dados fictícios. Larguras 390 × 844 e 1280 × 720.

- **`e2e/tests/creation-feedback.spec.ts`, teste novo "derivados e mínimo na criação (T-22, T-85)":**
  - **V20:** `pointsChronicle` e `prepared` (o `ALMOST`, Coragem 3). Na aba Ficha, `getByRole('button', { name: 'Em jogo' })`, `plus(page, 'Força de Vontade permanente')`, depois `expect(page.getByLabel('Força de Vontade atual, 4', { exact: true })).toBeVisible()`;
  - **contador:** `Diminuir Força de Vontade permanente` volta a 3, e a barra diz "0 alterações";
  - **o "−" no inicial:** `toHaveAttribute('aria-disabled', 'true')` e `not.toHaveAttribute('disabled')`; o `click({ force: true })` mostra `getByTestId('notice-willpower')` com "não fica abaixo de 3";
  - **W20:** crônica `wta-w20` por `apiAs`, com a ficha `{ breed: 'lupino', auspice: 'ahroun', tribe: 'fianna' }`. O mesmo para "Fúria permanente" em 5; "Aumentar Gnose permanente" dá "Gnose atual, 6";
  - **salvar e conferir o dock e a Mesa:** "Salvar", rádio "Jogo" e, a 390, o dock com `getByRole('button', { name: /^Fúria, 6 de 6/ })` depois de comprar 1 de Fúria. No contexto do narrador, `/chronicles/<id>?view=table` com `getByTestId('table-dock-<id>')` contendo "6/6".
- **`e2e/tests/create-character.spec.ts`:** a Nova ficha V20, `getByRole('button', { name: 'Escolher da lista: Natureza' })`, e os textos dos chips da folha (`allTextContents()`) nos 5 primeiros da ordem esperada.
- **`e2e/tests/evolve.spec.ts`** (perto da l.44): "Nenhuma Qualidade" visível na aba Vantagens.
- **O que o Jest não pega no web**, conferido no DOM:
  - o `aria-disabled` direto no `<button>` do "−" (o react-native-web transformaria `accessibilityDisabled` em `disabled`, e o botão ficaria morto: é o motivo do `markSoftDisabled`);
  - o "−" bloqueado continua no Tab, e o Enter mostra o aviso;
  - o `normalize('NFD')` do WebKit, que define a ordem dos chips.
- **Folhas que o pacote mostra de outro lugar**, sem regressão: o "Escolher da lista" (`SuggestionPicker`) e o "Adicionar Disciplina" (`AddItemSheet`). A 1280, o diálogo central de 560 medido no painel (`bottom-sheet-root > [aria-modal="true"]`), não na camada; o Esc fecha; o foco volta ao gatilho.

### 4.4 Suítes do "PR local" e cobertura

```bash
npx pnpm -C packages/sheet-core build
npx pnpm turbo run typecheck lint --filter=@tms/sheet-core --filter=@tms/ui --filter=frontend --filter=@tms/api --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=@tms/sheet-core --filter=@tms/ui --filter=frontend
cd apps/api && bun test src/__tests__/creation.test.ts src/__tests__/werewolf.test.ts src/__tests__/mage.test.ts
```

- **Metas que o CI aplica, por arquivo:**
  - `@tms/sheet-core`: 95% de linhas e funções (`packages/sheet-core/bunfig.toml`). `editResource` e `defaultStored` nascem com teste próprio;
  - `@tms/ui`: 80% em tudo (`packages/ui/jest.config.js`). O "−" do `Stepper` ganha os ramos web e app, com `Platform.OS` trocado no teste, como o P06 fez;
  - app: 70/70/60/70 global e 80/80/70/80 em `./sheet/` (`apps/frontend/jest.config.js:35-38`).
- **API:** a suíte da API roda para confirmar que nada mudou no servidor. Nenhum teste da API muda. `*.pg.test`: nenhuma trava nova, não é preciso rodar.
- **`@tms/db`:** não muda. Nenhuma migration.

## 5. Segurança

O pacote não muda a API, a AuthZ, a validação da ficha nem o contrato do template. As ameaças e o que o desenho evita:

- **Um cliente adulterado que ignora a recusa do "−"** e salva a Fúria abaixo do Augúrio: o servidor aceita salvar (`incomplete`) e recusa concluir, como hoje (`checkCreationUpdate`, `completionRefusal`). A recusa nova é só do app e é mais estrita. Nenhum limite afrouxa.
- **Um cliente que grava o atual acima do permanente**: o `validateSheet` continua recusando ("acima do permanente", `validate/sheet.ts:143-149`). O `editResource` nunca produz esse valor, e o servidor não depende dele.
- **Um evento `to: null` para "voltar ao padrão"**: o caminho já existe (`events.ts:152`) e passa pelo mesmo `applyBatch` e `validateSheet` no servidor. A regra nova do contador só apaga a alteração no rascunho do aparelho: nenhum evento novo é enviado.
- **Texto exibido:** a ordem e o gênero usam só rótulos do template, que o `schema.json` limita a texto seguro de uma linha (README §2). Saem como texto puro no `Text` do React Native, sem HTML, sem markdown, sem link e sem `dangerouslySetInnerHTML`. Os avisos novos só juntam rótulos e números da conta, nunca texto da ficha, como os do P05-C (`creation.ts:344-350`).
- **Custo:** ordenar um catálogo de até 200 itens (`schema.json:1312`) a cada abertura da folha é desprezível; o `useMemo` evita refazer a cada tecla.
- **Observabilidade:** nenhum texto novo vai para o Sentry. Os avisos não são erros, e a allowlist de `apps/frontend/lib/telemetryFilter.ts` e `apps/api/src/http/on-error.ts` não muda.
- **Licença:** nenhum texto do livro. As frases novas são de interface, escritas pelo time (seção 3.3), e o pacote não acrescenta nome a catálogo.

**`/security-review`:** a matriz não o exige para o P10-C, e a regra que o servidor aplica não muda. Como o `@tms/sheet-core` muda (o servidor lê o `dist`), **recomendo um `/security-review` no diff do commit 2**, para confirmar que `validateSheet`, `checkCreation`, `creationFreeze` e `describeEvent` ficaram intactos, além do `/code-review` do pacote inteiro.

## 6. Como generaliza além do WoD

| Item | Escopo | Como generaliza |
|---|---|---|
| T-22 | Genérica | O `editResource` não conhece sistema: vale para qualquer `resource` com teto, o permanente do WoD ou o máximo gravado (`max: { stored }`, os PV do D&D 5e e a Sanidade inicial do CoC). O "durante a criação" vem do estado da ficha, não do template |
| T-85 | Genérica | O mínimo é o inicial da conta (`checkCreation`), que vem do template: fórmula (`derive`), mapa por escolha (`from` + `map`), número fixo ou baseline. Qualquer sistema com criação por pontos ganha o "−" com a explicação sem código novo: a Humanidade do V20 já entra junto. O contador que volta a zero vale para todo campo |
| T-60 | Genérica | Ordena qualquer `catalog` e `suggestions` pelo rótulo exibido. O que tem ordem com sentido (`choice`, seções, itens fixos) continua na do template |
| T-66 | De idioma | A regra é do português, o `locale` de todos os templates de hoje. Um template noutra língua traz a regra dela |
| U-05 | Genérica | O preenchimento da roda com fórmula (`clock.fills[].default`) segue o rascunho, em qualquer sistema com `clock` |

Na tela, nada muda de desenho por sistema: o "−" bloqueado é o mesmo componente do "+" bloqueado do P05-C, nas três skins (memória `multi-system-rationale-in-design`).

## 7. Critério de pronto

1. Plano aprovado, com as perguntas da seção 9 respondidas ou com o padrão do plano.
2. `typecheck`, `lint` e testes dos pacotes afetados verdes (seção 4.4), com o `dist` do sheet-core reconstruído.
3. Um teste de regressão por bug (seção 4.1), que falha no `3cc07f1` e passa depois. A U-05 tem o teste que prende o comportamento; se o roteiro reproduzir, entra o de regressão do que for achado.
4. `/code-review` no diff do pacote; `/security-review` no commit do sheet-core (seção 5).
5. Os cenários das personas, repetidos sem o defeito:

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | T-22 | PO-A (POA-16) e I-A (IA-23), iOS: V20 por pontos, FdV permanente 4 → 7 com bônus, concluir | Na criação, "Força de Vontade atual" em 7; concluída, o dock com FdV 7/7 |
   | T-22 | PO-W (POW-20) e E-W (EW-24): V20 e W20, comprar FdV e Gnose com bônus e salvar | 6/6 na ficha e no "Em jogo" |
   | T-22 | N-W (NW-23) e N-A (NA-21): o narrador abre a Mesa de "Vampiro v4" depois de o jogador salvar | Os cartões com a FdV cheia, sem 4/5 |
   | T-22, T-85 | E-A (EA-19), Android: W20 Ahroun Lupino; FdV, Fúria e Gnose com bônus; "−" na Fúria em 5 | Atuais acompanham; o "−" da Fúria com cara de indisponível; o toque diz "não fica abaixo de 5 (vem de Augúrio: Ahroun)"; "+" e "−" voltam a "0 alterações" |
   | T-60 | QA-W (QAW-13), E-W (EW-19), E-A (EA-22): Natureza → Escolher da lista; Adicionar Disciplina | Ordem alfabética do português |
   | T-66 | QA-W (QAW-26), QA-A (QAA-21), E-W (EW-25), E-A (EA-28), PO-A (POA-09): Vantagens sem Qualidades; no W20, Cicatrizes vazias | "Nenhuma Qualidade"; "Nenhuma Cicatriz" |
   | U-05 | E-W (diário 13:01, web 1280) e PO-A (iOS): Mago por pontos, Avatar 3, olhar a roda antes de salvar | "Quintessência 3", "17 livres" |

6. Conferência no aparelho e no navegador: o roteiro da seção 11, com o T-85 obrigatório no Android.
7. Um resumo (o que mudou, como foi testado, achados da revisão), que vira a seção do P10-C no PR da onda 4.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

| # | Commit | Itens | Conteúdo |
|---|---|---|---|
| 1 | `test(sheet-core): prende o derivado sobre o rascunho e o inicial da Fúria` | U-05, T-85 | A guarda do `wod-rules.test.ts` e o caso da roda do M20. Passa antes e depois |
| 2 | `feat(sheet-core): editResource e defaultStored` | T-22, T-85 | As duas funções puras, `resource-edit.test.ts` e o caso do `defaultStored` × `creationFreeze` no `defaults.test.ts`. Depois: `npx pnpm -C packages/sheet-core build` |
| 3 | `fix(app): na criação, o atual acompanha o permanente cheio` | T-22 | `ResourceEditorRow` com `editResource` e `follow`; os testes do `evolve.test.tsx` e do `sheet.layout.test.tsx` |
| 4 | `fix(app): voltar ao valor de partida tira a alteração` | T-85 | A regra do `from: null` no `sheetStore` e o teste |
| 5 | `feat(ui): Stepper com a previsão do "−"` | T-85 | `decrease`, `markSoftDisabled` no "−", a dica que junta as duas; os testes do `@tms/ui` |
| 6 | `fix(app): o "−" no valor inicial explica e não desce na criação` | T-85 | `stepAdvice` com direção, `RefusalCause` `'initial'`, `draftRefusal` com os caminhos, `startSource` com a opção, `problemText`, `useRowFeedback.decrease` no `ResourceEditorRow` e no `NumberEditorRow`; os testes |
| 7 | `fix(app): listas de escolha na ordem do rótulo` | T-60 | `byLabel` no `SuggestionChips` e no `AddItemSheet`; os testes |
| 8 | `fix(app): a lista vazia concorda em gênero` | T-66 | A regra do `noneOf` e a tabela dos 25 rótulos |
| 9 | `test(app): a roda do Mago sobre o rascunho` | U-05 | O teste do `mage.test.tsx` |
| 10 | `test(e2e): derivados, mínimo, ordem e vazio` | todos | O teste novo do `creation-feedback.spec.ts`, o do `create-character.spec.ts`, o do `evolve.spec.ts` e o ajuste do `journey-storyteller.spec.ts` |
| 11 | `docs(planos): P10-C, desvios` | — | A seção 10 |

Os commits 3 a 9 são independentes entre si, menos o 6, que depende do 5.

### 8.2 Esforço

| Item | Esforço | Por quê |
|---|---|---|
| T-22 | P (1 dia) | Uma função pura e uma linha que a usa; o grosso são os testes nos três sistemas |
| T-85 | P (1,5 dia) | O mecanismo existe para o "+": é estendê-lo ao "−" no `Stepper`, na previsão e na recusa, mais a regra do contador |
| T-60 | P (0,5 dia) | Um comparador e dois lugares |
| T-66 | P (0,5 dia) | A regra e a tabela |
| U-05 | P (0,5 dia) | Testes e a conferência; mais, se o roteiro reproduzir |
| E2E e roteiro manual (seção 11) | 1 dia | Três plataformas, dois sistemas a criar pela tela |

**Total: 5 P, de 5 a 6 dias**, o que a matriz estima (5 P). Não há nada M nem G.

### 8.3 Riscos

| Risco | Efeito | Mitigação |
|---|---|---|
| A regra do contador vale para todo campo com `from: null` | Muda o número de alterações em fluxos que hoje deixam "— → 0" no rascunho, e algum teste ou E2E que conta alterações pode mudar | Os testes do store e o E2E inteiro na integração. Se aparecer um caso indesejado, restringir aos campos com fórmula (pergunta 2) |
| O campo que volta ao padrão volta a seguir a fonte | A FdV que o jogador subiu e baixou de volta acompanha a Coragem de novo | É o que a ajuda do template diz ("até ser marcado") e o que acontece hoje com o campo nunca tocado. O jogador não perde valor |
| O "cheio" não distingue o atual que o jogador pôs igual ao permanente | Esse atual também acompanha | Na criação, o atual cheio é o caso comum. O atual abaixo do teto, que é o que o jogador gastou, fica |
| A ordem do `fold` difere de um dicionário em casos com pontuação | Nada nas listas de hoje; possível num template futuro | O teste com os catálogos dos seis templates; o `Intl.Collator` como alternativa (pergunta 4) |
| A regra do gênero erra um rótulo futuro | "Nenhum X" errado num template novo | A tabela do teste cresce com cada template; exceção na tabela; campo no template como saída (pergunta 5) |
| A U-05 reproduz no roteiro | O item não fecha com os testes | A seção 3.2 diz onde olhar; o achado vai para a seção 10 |
| Um `dist` do sheet-core velho na máquina | A API, o seed e o `templates:publish` param no `check-dev-env` | O passo da seção 3.7, nos commits e na integração |
| A dica que junta "Aumentar" e "Diminuir" no app fica longa no leitor de tela | Mais tempo de fala | Só aparece com uma previsão para cada lado; conferir no VoiceOver e no TalkBack depois da integração |

### 8.4 Conflitos com os pacotes da onda

**Ordem de merge proposta.** O P10-C entra **antes do P07-D e do P10-D**, porque:

- não toca os JSON de template;
- é pequeno;
- traz o `byLabel` e o `Stepper.decrease`, que o P07-D consome.

Com o P05-D, a ordem não importa: os dois tocam o `creation.ts` do app em trechos diferentes. A consolidação decide.

| Pacote | Onde encosta | Como resolver |
|---|---|---|
| **P07-D** (D-06 a D-09) | `ListEditor.tsx`: o P10-C muda só as opções do `AddItemSheet` (`:207-213`, uma linha), e o P07-D refaz a linha (−/+, selos, catálogo de Dons, prévia). `packages/ui/src/Stepper.tsx`: o −/+ da linha usa o `decrease`. `apps/frontend/sheet/creation/creation.ts`: o aviso do Dom acima do nível 1 e o "fora do clã" (`stepAdvice`, `problemText`). `packages/sheet-core/src/creation.ts`: o nível do Dom e o clã; os dois mudam o `dist` | O P07-D rebaseia no P10-C: ordena cada parte com o `byLabel`; põe o `decrease` no −/+ da linha; acrescenta as causas dele ao `RefusalCause` ao lado da `'initial'`. O `dist` é reconstruído depois de cada merge |
| **P10-D** (D-11, D-12) | `Suggestions.tsx` e as opções do `AddItemSheet` (o "?" em cada opção); os três JSON (frases de ajuda, "Casa ou subgrupo") e o `schema.json` | Sem conflito de dado: o P10-C não toca JSON. Na tela, o "?" entra na mesma linha que o `byLabel` ordena; quem entrar depois ajusta a linha |
| **P05-D** (D-05) | `apps/frontend/sheet/creation/creation.ts`: o "Faltam" usa o `problemText`, e o P10-C muda o texto do `CREATION_BELOW_INITIAL`. A barra (`ModeBar.tsx`) e a aba (`CreationPanel.tsx`) não são tocadas pelo P10-C. A renomeação "Orçamento" → "Pontos" não encosta em nenhum seletor do P10-C | Quem entrar depois mantém o texto novo do `problemText` |
| **P15-D** (D-16, fora destes planos) | Os três JSON de template e o aumento de versão | Sem conflito: o P10-C não muda template nem versão |
| **P14-D** | — | Sem contato |

### 8.5 Arquivos tocados

**`@tms/sheet-core`**
- `packages/sheet-core/src/fields/resource.ts` (`editResource`)
- `packages/sheet-core/src/creation.ts` (`defaultStored`, ao lado do `creationFreeze`, sem mudar o `creationFreeze`)
- `packages/sheet-core/src/__tests__/resource-edit.test.ts` (novo), `defaults.test.ts`, `wod-rules.test.ts`

**`@tms/ui`**
- `packages/ui/src/Stepper.tsx`
- `packages/ui/src/components.test.tsx`, `packages/ui/src/a11y.test.tsx`

**App**
- `apps/frontend/sheet/evolve/ResourceEditorRow.tsx`, `NumberEditorRow.tsx`, `useRowFeedback.tsx`, `text.ts`, `ListEditor.tsx` (só as opções do `AddItemSheet`)
- `apps/frontend/sheet/editors/Suggestions.tsx`
- `apps/frontend/sheet/creation/creation.ts`, `useStepAdvice.ts`
- `apps/frontend/sheet/store/sheetStore.ts`
- Testes: `sheet/evolve/__tests__/evolve.test.tsx`, `text-filters.test.ts`, `ListEditor.test.tsx`, `mage.test.tsx`; `sheet/creation/__tests__/creation.test.ts`, `creationStore.test.ts`, `CreationScreen.test.tsx`; `sheet/store/__tests__/sheetStore.test.ts`; `sheet/__tests__/sheet.layout.test.tsx`; `app/__tests__/new-character.test.tsx`

**E2E**
- `e2e/tests/creation-feedback.spec.ts`, `create-character.spec.ts`, `evolve.spec.ts`, `journey-storyteller.spec.ts`

**Não toca:** `design/templates/*.json`, `design/templates/schema.json`, `apps/api/`, `packages/db/`, `scripts/seed-roteiro.ts`.

## 9. Perguntas abertas (técnicas)

| # | Pergunta | Padrão do plano | Por que importa |
|---|---|---|---|
| 1 | O "acompanha" do T-22 vale em `creating` e `pending`, ou só em `creating`? | Os dois: a ficha ainda não está concluída | Em `pending`, quem edita é o narrador ("Editar como narrador") ou o dono depois da devolução |
| 2 | A regra do contador (`from: null` igual ao padrão) vale para todo campo ou só para os campos com fórmula? | Todo campo de `values`: é o mesmo "voltou ao valor de antes" | Todo campo é mais simples e corrige também o "— → 0" de um Talento subido e baixado; só os com fórmula muda menos testes |
| 3 | O "−" no inicial: a previsão (cara de indisponível) e também a recusa no rascunho, ou só a previsão? | As duas, como o "+" do P05-C | Só a previsão deixa descer e repete o achado; a recusa é só do app |
| 4 | Comparador do T-60: `fold` com ponto de código ou `Intl.Collator('pt-BR')`, como na Mesa? | `fold`: a mesma ordem no Hermes, no web e no Jest | O `Intl.Collator` segue o dicionário em pontuação e espaço, mas depende da tabela de cada plataforma |
| 5 | Gênero do T-66: regra na tela ou campo `itemGender` no template? | Regra na tela, com a tabela de exceções | O campo exige aumento de versão e só vale para fichas novas (seção 3.6) |
| 6 | U-05: se o roteiro não reproduzir, a linha fecha com o teste que prende o comportamento? | Sim, com "não reproduzido", a evidência na seção 10 e o teste do `mage.test.tsx` | A linha inteira é "(estimado)" |
| 7 | Texto do aviso do "−" (seção 3.3): "não fica abaixo de N" ou "começa em N"? | "Na criação, não fica abaixo de N (vem de …)" | O time revisa o texto; o mecanismo não muda |
| 8 | **Achado perto do pacote, sem linha na matriz:** o resumo de salvar mostra "permanente — → 4" na FdV e "0 → 8" na Humanidade quando o campo não tinha valor gravado. O `describeEvent` usa o mínimo, ou "—", em vez do valor de partida (`labels.ts:55-68`) | Fora do P10-C: o `describeEvent` também monta o Histórico no servidor (`apps/api/src/sheets/events.ts:618`), e mudá-lo muda a saída da API | Para o orquestrador decidir onde cabe. O `defaultStored` deste pacote daria o valor certo |
| 9 | No app, a dica do controle ajustável com as duas previsões: uma frase só ("Aumentar: …. Diminuir: ….") ou só a do lado que trava? | Uma frase só, com o prefixo quando há as duas | O VoiceOver e o TalkBack leem a dica inteira a cada foco |

Os achados da onda 3 sem pacote ([onda-3.md](onda-3.md) §11) não entram aqui. O achado 7 ("Nenhum Qualidade" no iOS) é o T-66, deste pacote. O achado 1 (a folha que espera as rebuscas) não encosta no P10-C: nenhuma folha deste pacote envia.

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

**Implementação (04/11/2026), na `pacote/p10-c-template-derivados`, commits 1 a 10 da seção 8.1.** Sem resposta do time, as perguntas da seção 9 seguiram o padrão do plano:

| Pergunta | O que foi aplicado |
|---|---|
| 1 | O "acompanha" vale em `creating` e `pending` (`useCreation()?.status`). Sem provedor e na ficha concluída, o de antes |
| 2 | O contador volta a zero em **todo campo inteiro de `values`** (`values.<id>`, sem item). A suíte inteira do app passou sem caso indesejado, então a restrição aos campos com fórmula não foi precisa. O E2E da integração é a última conferência: um spec que contasse um "— → 0" subido e baixado agora vê "0 alterações" |
| 3 | A previsão e a recusa no rascunho, como o "+" do P05-C |
| 4 | `fold` com ponto de código |
| 5 | Regra na tela, com a tabela dos 25 `itemLabel` |
| 6 | U-05 fechada com o teste que prende o comportamento (`mage.test.tsx`); o roteiro manual é da integração |
| 7 | "Na criação, não fica abaixo de N (vem de …)." (rascunho do time, para revisão) |
| 8 | Fora do pacote, como o plano propõe |
| 9 | Uma frase só: "Aumentar: …. Diminuir: …." (`joinHints`, sem ponto duplicado) |

**Desvios:**

1. **A dica do "−" sem o rótulo do campo.** A seção 3.3 escrevia a dica como "Fúria: na criação, não fica abaixo de 5 (…)". As previsões do "+" não repetem o rótulo (o controle já tem o nome), então a do "−" também não: "Na criação, não fica abaixo de 5 (vem de Augúrio: Ahroun)." O aviso do toque (`notice-<campo>`) e o `problemText` continuam com o rótulo, como os outros avisos. Na dica junta do app, fica "Aumentar: +1 = 1 bônus. Diminuir: Na criação, …".
2. **O `problemText` ganhou um 4º parâmetro opcional, `resolved`,** para dizer a opção ("vem de Augúrio: Ahroun"). Sem ele, diz só o campo da fonte ("vem de Augúrio"); sem a conta, o texto de antes ("abaixo do valor inicial"). O `CreationPanel` passa o `resolved`. **No rebase do P05-D**, o `guide.ts` pode passar o `s.resolved` do store para ter a opção no "Faltam".
3. **O `draftRefusal` ganhou um 6º parâmetro opcional, `touch: DraftTouch`** (`{ paths, resolved? }`: os caminhos do toque e, se quem chama já tem, a ficha resolvida depois dele; sem `paths`, a recusa nova não vale). O store passa `{ paths: events.map(e => e.path), resolved: next.resolved }`. Um caminho de lista (`values.<lista>`) casa os itens dele (`values.<lista>#<item>`). Era `paths` posicional até a revisão (achado 7).
4. **`components.md`:** a seção do Stepper ganhou o `increase`, o `decrease`, o `StepperAdvice` (com `stop`) e o alias `StepperIncrease`. A seção 8.5 não listava o arquivo; a seção 4.5 do onda-4.md pedia a entrada.
5. **Os testes de tela do T-22 e da U-05 usam o `Live` dos testes com um `CreationContext`** (prop nova `creation` em `apps/frontend/test/live.tsx`), em vez de montar o `SheetScreen`.
6. **O E2E do W20 cria a própria crônica `wta-w20`** pela API (o `pointsChronicle` do ajudante é só V20), e confere o atual que acompanha pela linha do "Em jogo", sem a Mesa nem o dock: a gravação 4/4 é conferida pela API no teste do V20, e o dock a 390, no Jest (`sheet.layout.test.tsx`). O `journey.spec.ts` (l.111) não muda: o "Aumentar" do permanente continua sendo 1 evento em `values.willpower`.
7. **Nenhum `.test.ts` novo em `components/`**: os testes puros ficaram em `sheet/` e `packages/`.

**API pública para o P07-D (assinaturas estáveis):**

```ts
// @tms/ui
interface StepperProps { /* … */ increase?: StepperAdvice; decrease?: StepperAdvice }
interface StepperAdvice { blocked?: boolean; hint?: string | null; hintID?: string | null; stop?: number }
type StepperIncrease = StepperAdvice   // alias, o nome de antes
function joinHints(up?: string | null, down?: string | null): string | null

// apps/frontend/sheet/evolve/text.ts
function byLabel<T>(items: readonly T[], key?: (item: T) => string): T[]  // cópia ordenada

// apps/frontend/sheet/evolve/useRowFeedback.tsx
useRowFeedback(path, field): { notice; note; increase?: StepperAdvice; decrease?: StepperAdvice }  // decrease.stop = o inicial

// apps/frontend/sheet/creation
useStepAdvice(path, direction?: 'up' | 'down')
stepAdvice(model, check, phase, path, resolved?, direction?: StepDirection)
type RefusalCause = … | 'initial'   // e 'locked' também vem do "−" no baseline travado
interface StepAdvice { blocked; text; cost; inline; floor?: number }  // floor: o inicial, com o "−" acima dele
draftRefusal(model, sheets, checks, input, phase, touch?: DraftTouch)  // DraftTouch = { paths, resolved? }
problemText(model, check, problem, resolved?)

// @tms/sheet-core
editResource(r: ResolvedResource, part: 'permanent' | 'max' | 'current', n: number, { follow }): ResourceValue
defaultStored(model, sheet, id): unknown   // undefined fora do modelo
```

O −/+ da linha do P07-D passa `increase` e `decrease` do `useRowFeedback('values.<lista>#<item>', …)`: o `downAdvice` já aceita caminho de item, com o mínimo do `item.value.min` da lista.

**`/code-review` (high) do pacote, 04/11/2026:** 10 achados, conferidos no código. 8 corrigidos, em commits `fix` com teste de regressão; 2 recusados.

| # | Achado | Resultado |
|---|---|---|
| 1 | O derivado do rascunho igual ao valor de partida, depois de a fonte mudar, devia sair do rascunho | **Recusado.** Contradiz a regra "até ser marcado": a ajuda do template ("Começa igual à Coragem até ser marcado") e o teste `evolve.test.tsx` ("O jogador marca a Humanidade: ela deixa de acompanhar as Virtudes"), que falhou com a correção. O caso não gasta bônus: com a Coragem 4 e a FdV 4, o investido é 0. Com a Coragem 5, a FdV marcada fica abaixo do inicial, como antes do P10-C e como o servidor conta. A regra do commit 4 só desfaz a marca quando o próprio jogador volta o campo ao valor de partida. Se o time quiser que a marca caia quando a fonte alcança o valor, é decisão de produto |
| 2 | O `downAdvice` ignorava o baseline travado, e a recusa valia | Corrigido (`575ad6d`): uma regra só. A causa é `'locked'`, e o texto, "Fica em N na criação (Clã: …)." |
| 3 | Segurar o "−" acima do inicial descia até o mínimo, e o lote era recusado | Corrigido (`46b0d0e`, `b354276`): `StepperAdvice.stop`, e o `floor` da previsão. A repetição para no inicial |
| 4 | O "(vem de …)" citava a fórmula com o inicial de um baseline ou de um point-buy | Corrigido (`575ad6d`): o `initialSource` segue o `initialOf` do core. O baseline cita a escolha dele; o point-buy e o baseline sem condição não citam nada |
| 5 | O `isStart` faz um `resolve` por evento com `from: null` | **Recusado, com a medida.** No Bun, o `resolve` do V20 leva ~0,02 ms e o `checkCreation` que o mesmo toque já roda, ~1,2 ms: ~2%. Reaproveitar a conta não serve fora da Criação (o Editar livre não tem conta), e o `initial` da conta é um número, não o valor gravado do recurso |
| 6 | O `hintID` do "−" apontava o aviso do "+" | Corrigido (`b354276`): cada botão aponta o aviso só quando a causa é a dele. Sem aviso, o "−" bloqueado no web tem a própria descrição (`advice-down-<campo>`, fora da tela, `aria-hidden`) |
| 7 | O `belowInitial` resolvia a ficha de novo | Corrigido (`575ad6d`): `DraftTouch.resolved`, que o store passa |
| 8 | O `defaultStored` repetia o cálculo do fail-secure do `checkCreation` | Corrigido (`a704b0e`): uma função interna, `startOf`. O core (995) e a API (1901) passaram, e o `dist` foi reconstruído |
| 9 | "Cão", "Falcão" e "Pisão" saíam no feminino | Corrigido (`4c71e81`): "-ção" e "-são" são conferidos com a cedilha e o acento. "pisão" e "tesão" entram nos masculinos |
| 10 | `StepperIncrease` também no `decrease` | Corrigido (`72aaf92`): `StepperAdvice`, com `StepperIncrease` como alias |

**Achado ao lado, sem correção:** segurar o "−" até o mínimo do controle desabilita o botão no meio da repetição, e no Jest o `pressOut` do botão desabilitado não chega (o valor não é gravado). Isso vem de antes do P10-C. Fica para conferir no aparelho.

**Fica para a integração:** o E2E (Chromium e WebKit), o `/security-review` recomendado no commit 2 (`05c05a5`) e no `a704b0e`, o roteiro manual da seção 11 e a conferência do "−" no VoiceOver e no TalkBack (a dica junta, pergunta 9, e a descrição do "−" no web).

## 11. Testes manuais (web, Android com AVD, iOS com idb)

O roteiro confere cada item na interface, nas três plataformas, com a API local e o seed do roteiro (só contas fictícias `@roteiro.test`). Ele detalha o passo 6 da seção 7. A coluna "Resultado" fica em branco e é preenchida na integração.

### 11.a Preparação

- **Ambiente:**
  - `npx pnpm bootstrap` (o `dist` do sheet-core novo), `npx pnpm db:up`, `npx pnpm db:migrate` e `npx pnpm templates:publish --published`. Este pacote não muda template: o comando só confirma "sem mudança";
  - `npx pnpm dev:api` (porta 3001);
  - `cd apps/frontend && npx expo start` (Metro na 8081, para o web e o nativo).
- **Seed:** `npx pnpm seed:roteiro --fichas-criacao > <scratchpad>/seed-p10c.log 2>&1`, lido com `grep -v -i senha`. A senha é a constante do seed: o operador a lê no arquivo, nunca a copia para o roteiro, os scripts ou as capturas. Entre duas rodadas, 15 min (limite de aceites).
- **O que o seed já cobre** (`scripts/seed-roteiro.ts:16-35`, `:349-434`):
  - as contas N, J1, J2 e N2;
  - por sistema, as crônicas "{Sistema} v3/v5" (criação livre) e "{Sistema} v4" (por pontos), com J1 e J2;
  - "Isadora Web/Android/iOS" em "Vampiro v4": V20 por pontos, Tremere, com as prioridades e quase todos os básicos, Coragem 3 (FdV 3) e Humanidade 7, sem Qualidades;
  - "Ficha Aprovação R" em "Mago v4" (Avatar 3, salva, aprovação ligada).
- **O que o roteiro cria pela tela** (uns 15 min por plataforma, só dados fictícios, nomes em ASCII):
  1. "Lobisomem v4", J1: Nova ficha "Teste Ahroun", Raça Lupino, Augúrio Ahroun, Tribo Fianna, escolhidos nos rádios (o `input text` do Android e o idb não digitam acento). Fúria 5, Gnose 5 e FdV 3;
  2. "Mago v4", J1: Nova ficha "Teste Roda", qualquer Tradição. Na aba Vantagens, Antecedente "Avatar" com valor 3, **sem salvar** (U-05);
  3. a Nova ficha do V20 em "Vampiro v4", só até o "Escolher da lista" da Natureza (T-60), cancelada sem criar.
- **O seed não precisa mudar** para este pacote.

### 11.b Web (Playwright, Chromium e WebKit)

- O script fica no scratchpad da sessão, usa o `playwright` do `node_modules` do repositório e roda contra o Metro (`http://localhost:8081`). Ele não entra no repositório.
- Viewport exato de `390 × 844` e `1280 × 800`, um `browser.newContext({ viewport })` por largura e uma conta por contexto.
- **WebKit** no T-60 (o `normalize` do Safari decide a ordem) e no T-85 (o `aria-disabled` do "−").
- Seletores por papel e rótulo, os da seção 4.3, com `exact` onde o texto se repete. Um screenshot por passo (`page.screenshot`), com o nome da coluna "Evidência".
- O Metro web pode ficar com o bundle velho depois de editar o código: reiniciar com `--clear`.

### 11.c Android (AVD)

- **AVD** `Pixel_3a_API_34_extension_level_7_arm64-v8a` (1080 × 2220, 440 dpi = 393 dp), boot rápido com `-gpu host`.
- **APK Debug:** `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` em `apps/frontend/android`, com o `JAVA_HOME` do JBR do Android Studio, e `adb install -r`.
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Largura de layout:** o aviso do "−" (T-85) também a 360 dp (`adb shell wm density 480`) e a 411 dp (`420`). No fim, `adb shell wm density reset`.
- **Teclado de software** (login): `adb shell settings put secure show_ime_with_hard_keyboard 1`; no fim, `0`.
- **Navegação:**
  - `adb shell uiautomator dump /sdcard/ui.xml` e `adb pull`, para achar o alvo pelo `content-desc` ou pelo texto;
  - `adb shell input tap X Y` no centro do "−" (os botões ficam fora da árvore de acessibilidade no app, mas o toque por coordenada chega);
  - `adb exec-out screencap -p > <evidência>.png`.

  O LogBox do rodapé engole toques: dispensar antes.
- **O voltar do Android** (`adb shell input keyevent KEYCODE_BACK`) com a folha "Escolher da lista" aberta: fecha a folha.
- Tempo medido no emulador sob carga não é evidência ([onda-3.md](onda-3.md) §11, achado 1). Desligar o AVD antes da rodada do iOS.

### 11.d iOS (simulador com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, e iPhone 17, iOS 26.5. Os UDIDs saem de `xcrun simctl list devices`.
- **Build Debug para o simulador, com "Sign to Run Locally":** `xcodebuild -workspace apps/frontend/ios/TMS.xcworkspace -scheme TMS -configuration Debug -sdk iphonesimulator -destination 'id=<UDID>' -derivedDataPath <scratchpad>/ios-build CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build`. Sem assinatura, o app abre mas não loga: o keychain responde `-34018` ([onda-3.md](onda-3.md) §11, item 15). O CI continua sem assinatura. Depois, `xcrun simctl install <UDID> <...>/TMS.app` e `xcrun simctl launch <UDID> com.tms.app`.
- **idb:**
  - o cliente `fb-idb` 1.7.7 no venv `~/.venvs/idb-tms`, fora do repositório; antes de usar, `pip-audit` no venv de novo (com vulnerabilidade sem correção, o iOS fica "não conferido");
  - o cliente não entra no `package.json` nem no lockfile;
  - `--companion-path /opt/homebrew/bin/idb_companion` vem antes do subcomando;
  - o companion fica só local, no socket de domínio: sem `--grpc-port` e sem `idb connect` com host e porta. No fim, `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` não mostra nada.
- **Navegação:**
  - `idb ui describe-all --udid <UDID>` acha o alvo pelo rótulo de acessibilidade (`AXLabel`); tocar no centro do `frame` com `idb ui tap`;
  - `idb ui text`, `idb ui swipe` e `idb ui key`;
  - `idb screenshot --udid <UDID> <evidência>.png`.
- **Limites do idb:**
  - não faz o gesto de borda: usar o "‹";
  - não digita fora do ASCII: escolher da lista;
  - digita como teclado físico, e o teclado de software some depois do primeiro texto;
  - o deep link (`tms://`) pede "Abrir com 'TMS'?": tocar "Abrir" pelo `describe-all`.

### 11.e Roteiro por item

Evidências com o nome `p10c-<plataforma>-<ID>-<passo>.png` (por exemplo, `p10c-and393-T-85-1.png`). Em cada passo da Criação, abrir antes o bloco "Em jogo" (recolhido, [onda-2.md](onda-2.md) §6.9).

**T-22 · O atual acompanha o permanente**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-22 | Web 390 (Chromium) | J1 | "Isadora Web" → Criação → "Em jogo" → "+" na FdV permanente | "Força de Vontade atual" em 4; a barra com 1 alteração | `p10c-web390-T-22-1.png` | |
| T-22 | Web 390 | J1 | "Salvar" → rádio "Jogo" | O dock com "Força de Vontade, 4 de 4" | `p10c-web390-T-22-2.png` | |
| T-22 | Web 1280 | N | "Vampiro v4" → Mesa | O cartão de "Isadora Web" com FdV 4/4 | `p10c-web1280-T-22-3.png` | |
| T-22 | Android 393 | J1 | "Teste Ahroun" → Criação → "Em jogo" → "+" na Fúria, na Gnose e na FdV permanentes → "Salvar" → "Jogo" | Atuais 6, 6 e 4 na Criação; o dock com Fúria 6/6; a Gnose 6/6 no "Em jogo" (a Gnose não está no dock) | `p10c-and393-T-22-1.png`, `-2.png` | |
| T-22 | Android 393 | N | "Lobisomem v4" → Mesa | O cartão de "Teste Ahroun" com Fúria 6/6 | `p10c-and393-T-22-3.png` | |
| T-22 | iOS iPhone SE | J1 | "Isadora iOS" → Criação → FdV permanente 3 → 7 com bônus (o cenário do POA-16) → "Salvar" | "Força de Vontade atual" em 7; o dock com 7/7 | `p10c-iosse-T-22-1.png` | |
| T-22 | iOS iPhone 17 | J1 | "Teste Roda" (Mago) → Criação → "+" na FdV permanente | FdV atual 6 | `p10c-ios17-T-22-1.png` | |
| T-22 | Web 1280 | J1 | "Vampiro v3/v5" → uma ficha livre nova → Editar → "+" na FdV permanente | O atual acompanha também no Editar da criação livre | `p10c-web1280-T-22-4.png` | |

**T-85 · O "−" no valor inicial** (obrigatório no Android)

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-85 | Android 393 | J1 | "Teste Ahroun" → Criação → "Em jogo" → olhar a "Fúria permanente" em 5 | O "−" com a opacidade de bloqueado; o "+" normal | `p10c-and393-T-85-1.png` | |
| T-85 | Android 393 | J1 | Tocar o "−" da Fúria | A Fúria continua 5; o aviso perto da linha: "Fúria: na criação, não fica abaixo de 5 (vem de Augúrio: Ahroun)."; "0 alterações" | `p10c-and393-T-85-2.png` | |
| T-85 | Android 393 | J1 | "+" na Fúria (6) e "−" (5) | "0 alterações"; o atual acompanha nos dois toques | `p10c-and393-T-85-3.png` | |
| T-85 | Android 360 e 411 | J1 | O aviso do segundo passo | O aviso quebra em linhas sem cortar e sem empurrar o "−" para fora da tela | `p10c-and360-T-85-1.png`, `p10c-and411-T-85-1.png` | |
| T-85 | Android 393 | J1 | "Isadora Android" → FdV permanente em 3 (Coragem 3) → "−" | O mesmo, com "(vem de Coragem)"; a Humanidade em 7 também não desce | `p10c-and393-T-85-4.png` | |
| T-85 | Web 390 (Chromium e WebKit) | J1 | "Isadora Web" → "Diminuir Força de Vontade permanente" pelo Tab e Enter | No DOM, `aria-disabled="true"` sem `disabled`; o foco chega ao botão; o Enter mostra o aviso | `p10c-web390-T-85-1.png`, `p10c-wk390-T-85-1.png` | |
| T-85 | iOS iPhone SE | J1 | "Teste Ahroun" (criado no iOS) → o "−" da Fúria em 5 | O aviso; no `describe-all`, a dica do controle "Fúria permanente" com "não fica abaixo de 5" | `p10c-iosse-T-85-1.png` | |
| T-85 | Web 1280 | J1 | "Vampiro v3/v5" → ficha livre → Editar → "−" na FdV permanente | Na criação livre, sem conta, o "−" desce como hoje, até o mínimo do template | `p10c-web1280-T-85-2.png` | |

**T-60 · Ordem das listas**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-60 | Web 390 (Chromium e WebKit) | J1 | "Vampiro v4" → Nova ficha → "Escolher da lista: Natureza" | Arquiteto, Autocrata, Bon Vivant, Caçador de Emoções, Camaleão…; Valentão perto do fim. Esc fecha e o foco volta ao botão | `p10c-web390-T-60-1.png`, `p10c-wk390-T-60-1.png` | |
| T-60 | Web 1280 | J1 | "Isadora Web" → Vantagens → "Adicionar Disciplina" | Animalismo… Quietus, Quimerismo, Rapidez…; o diálogo central de 560, medido no painel | `p10c-web1280-T-60-2.png` | |
| T-60 | Android 393 | J1 | "Isadora Android" → "Adicionar Disciplina"; depois "Adicionar Antecedente" | A mesma ordem do web (Hermes); nos Antecedentes do V20, Geração entre Fama e Influência | `p10c-and393-T-60-1.png`, `-2.png` | |
| T-60 | Android 393 | J1 | "Teste Ahroun" → "Adicionar Antecedente" | Aliados, Ancestrais, Contatos, Fetiche, Mentor, Parentes, Raça Pura, Recursos, Ritos, Totem | `p10c-and393-T-60-3.png` | |
| T-60 | iOS iPhone 17 | J1 | "Isadora iOS" → "Natureza" no Editar → as sugestões | A mesma ordem do web e do Android | `p10c-ios17-T-60-1.png` | |
| T-60 | Web 1280 | J1 | "Teste Ahroun" → Augúrio na identidade | Os Augúrios continuam na ordem do template (as opções de escolha não são ordenadas) | `p10c-web1280-T-60-4.png` | |

**T-66 · Lista vazia**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-66 | iOS iPhone SE | J1 | "Isadora iOS" → Vantagens → Qualidades | "Nenhuma Qualidade" | `p10c-iosse-T-66-1.png` | |
| T-66 | Android 393 | J1 | "Teste Ahroun" → Cicatrizes de batalha e Qualidades | "Nenhuma Cicatriz"; "Nenhuma Qualidade" | `p10c-and393-T-66-1.png` | |
| T-66 | Web 390 | J1 | "Isadora Web" em Jogo (Leitura da lista) | "Nenhuma Qualidade" também fora do Editar | `p10c-web390-T-66-1.png` | |
| T-66 | Web 1280 | J1 | "Teste Roda" → Vantagens | "Nenhuma Qualidade", "Nenhuma Maravilha", "Nenhum Defeito" | `p10c-web1280-T-66-2.png` | |

**U-05 · Quintessência = Avatar no rascunho**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| U-05 | Web 1280 (Chromium) | J1 | "Teste Roda" com Avatar 3 **sem salvar** → "Em jogo" | A roda com "Quintessência 3" e "17 livres" | `p10c-web1280-U-05-1.png` | |
| U-05 | Web 1280 | N | Ao mesmo tempo, a Mesa de "Mago v4" | O cartão de "Teste Roda" com a roda em 0 (o rascunho não foi salvo; é o esperado) | `p10c-web1280-U-05-2.png` | |
| U-05 | Web 1280 | J1, N | J1 "Salvar"; N atualiza a Mesa | Roda 3 · 0 no cartão | `p10c-web1280-U-05-3.png` | |
| U-05 | iOS iPhone 17 | J1 | O mesmo do primeiro passo, numa ficha de Mago criada no iOS | "Quintessência 3" antes de salvar | `p10c-ios17-U-05-1.png` | |

Se a roda mostrar 0 no primeiro passo, registrar a sequência exata de toques (o modo antes de pôr o Avatar, uma ação de Jogo) e seguir a seção 3.2.

**Folhas que este pacote mostra de outro lugar** (sem regressão): o "Escolher da lista" e o "Adicionar Disciplina":

- o Esc no web;
- o foco de volta ao gatilho;
- o diálogo de 560 a 1280, medido no painel;
- o voltar do Android fecha a folha;
- no iOS, a folha abre e fecha pelo "×".

### 11.f Acessibilidade mínima

- **O "−" bloqueado (T-85):**
  - no web, o `<button>` "Diminuir Fúria permanente" com `aria-disabled="true"`, focável, e o aviso como texto depois do Enter;
  - no Android, o controle "Fúria permanente" no `uiautomator dump` e, depois do toque, o aviso como texto;
  - no iOS, a dica do controle ajustável no `describe-all`.
  - Nada só por cor: a opacidade vem com o aviso em texto.
- **As listas (T-60):** os chips e as opções aparecem na árvore na mesma ordem da tela (DOM, `uiautomator dump`, `describe-all`).
- **A lista vazia (T-66):** "Nenhuma Qualidade" é texto estático na árvore, nas três plataformas.
- **O atual (T-22):** o nome acessível do dock ("Força de Vontade, 4 de 4") e o valor do controle ("Força de Vontade atual", `now: 4`) dizem o mesmo número que a tela.

### 11.g Limpeza

- Parar o Metro e a API (Ctrl+C) e, sem outro uso, `npx pnpm db:down`.
- Android: `adb shell wm density reset`, `adb shell settings put secure show_ime_with_hard_keyboard 0`, `adb reverse --remove-all` e `adb emu kill`.
- iOS: `xcrun simctl shutdown all`, encerrar o `idb_companion` e desativar o venv; conferir com o `lsof` que nada escuta. O build fica no scratchpad, e o venv, em `~/.venvs/idb-tms`.
- As capturas ficam com a integração, sem e-mail, token nem a senha. O log do seed fica no scratchpad.

### 11.h Quando não der para conferir

Se uma plataforma não puder ser conferida, a coluna "Resultado" diz **"não conferido"** e o motivo:

- o `fb-idb` não roda ou o `pip-audit` acusa vulnerabilidade sem correção;
- o build não fecha;
- o AVD não sobe.

Nunca "ok" sem a evidência. O T-85 no Android é obrigatório. Sem ele, fica como pendência da onda, como na [onda-2.md](onda-2.md) §10.
