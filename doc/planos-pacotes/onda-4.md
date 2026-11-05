# Onda 4 · Conteúdo do sistema e guia da criação: consolidação dos planos dos pacotes

> Plano · 2026-11-04 · base conferida: `onda/4-conteudo-guia` em `c96f2d4`, a `main` depois do merge da onda 3 (PR #42, em `3cc79bb`) e de mais 10 merges:
>
> - as fases 1 a 3 da observabilidade;
> - o fix do E2E do T-04 (`d844907`);
> - as releases v1.2.0 a v1.2.2;
> - o PR #48, que remove a config temporária do WebKit;
> - o PR #49, que remove do CI os builds nativos e o job de Postgres real.
>
> A pesquisa dos planos foi feita no `3cc07f1`. De lá até o `c96f2d4`, o código do app, do core, dos templates e dos specs não muda.

A onda 4 da [matriz de achados](../testes/2026-11-01/matriz-achados.md) (seção "Onda 4 · Conteúdo do sistema e guia da criação") é planejada aqui em quatro pacotes: três de decisão de produto (P05-D, P07-D e P10-D) e um de correção (P10-C). Ao fim da onda:

- a barra de criação diz o que falta, e cada item leva ao grupo;
- a aba "Orçamento" passa a "Pontos";
- a folha de bônus aparece uma vez por ficha;
- as Vantagens com valor ganham −/+ na linha;
- o W20 ganha o catálogo de Dons, e o V20 e o M20 marcam as Disciplinas do clã e a Esfera da Tradição;
- a Fraqueza do clã já vem com um resumo do time;
- os derivados acompanham o rascunho, e o "−" do valor inicial explica por que não desce;
- as listas ficam na ordem do rótulo, e a lista vazia tem o gênero certo;
- cada campo e cada opção pode ter um "?" com uma frase do time;
- a Casa do Mago passa a "Casa ou subgrupo", opcional.

Cada pacote tem um plano próprio. Este documento junta o que cruza os quatro:

- arquivos em comum;
- acordos de contrato entre pacotes, com uma subseção só para a versão dos templates;
- ordem de merge na onda;
- esforço;
- pontos para o PO e perguntas técnicas;
- o roteiro manual da integração, nas três plataformas.

As regras de execução ("PR local", integração, ondas empilhadas) são as da seção "Como executar" da matriz e não se repetem aqui.

**A base mudou.** O pedido era sair da ponta da onda 3 (`ff9e420`), mas a onda 3 já está na `main` (PR #42; o `refs/pull/42/head` é o `ff9e420`, e a branch remota foi apagada). Por isso, como "Ondas empilhadas" prevê, a `onda/4-conteudo-guia` saiu da `main`: primeiro em `3cc07f1`, depois em `c96f2d4` (fast-forward).

- **O PR #48** tirou a config do WebKit que quebrava o typecheck do `@tms/e2e` e, com ele, o hook de pre-commit.
- **O PR #49** tirou do CI os jobs `native-android`, `native-ios` e `postgres`. O build nativo e os `*.pg.test` da onda rodam à mão, na integração (seção 2), e o `check` do CI continua conferindo as versões nativas. A D-00 ("Android e iOS compilados no CI em todo PR") deixa de valer como está escrita: a matriz não registra a revisão (seção 6, ponto 16).
- Os pré-requisitos da onda (P05-C, P07-C e P03-D) estão nessa base.

**A matriz tem 6 pacotes na onda 4, e este documento planeja 4.** O commit `960138b` (03/11/2026) acrescentou à onda o P14-D (D-15, a Descrição da crônica em leitura, U-09) e o P15-D (D-16, o campo "História / Prelúdio" no template dos três sistemas, U-10). Eles não foram planejados aqui, porque o pedido era de quatro pacotes. O P15-D mexe nos mesmos três JSON e entraria no mesmo aumento de versão (seção 4.7). A inclusão dos dois na onda fica com o usuário (seção 6, ponto 1).

Nenhum plano remove campo, muda regra do jogo ou afrouxa limite, e o servidor continua a autoridade:

- a conta da criação (`checkCreation`, `checkCreationBatch`, `creationFreeze`) não muda, e continua repetida pelo servidor a cada lote e ao concluir;
- o que a tela só avisa, sem bloquear (Dom acima do Posto 1, fora do clã, fora da Tradição), o servidor aceita como hoje. O aviso fica fora de `problems`, então nem o `complete` nem a recusa do servidor mudam por causa dele;
- nenhum campo é escondido: a Casa continua em todas as Tradições (D-12).

Nenhuma decisão de produto foi tomada nesta etapa. O que o código mostrou que não se aplica como está escrito vai na seção 6, para o PO. Os pontos para o PO das ondas 1 a 3 ([onda-1.md](onda-1.md) §6, [onda-2.md](onda-2.md) §6 e [onda-3.md](onda-3.md) §6) continuam abertos. Os que tocam esta onda:

- **onda-1 §6:**
  - ponto 3: "Senhor atualizado" sem o valor (P10-C);
  - ponto 5: o template marcar o que a criação exige (P07-D e P10-D);
- **onda-2 §6:**
  - ponto 1: D-06 e o template (P07-D);
  - ponto 5: o "+" desabilitado (P07-D e P10-C);
  - ponto 6: o extrato, R-17 (P05-D);
  - ponto 7: guardar o texto ao fechar a folha (P07-D);
  - ponto 9: "Em jogo" recolhido (P10-C);
- **onda-3:** o §6 ponto 3 (ficar no Editar depois de salvar) e a pergunta 4 do §8 (P05-D).

A seção 6 diz como cada plano os trata, sem decidir.

## 1. Pacotes e planos

| Pacote | Branch | Plano | Itens | Esforço na matriz | Esforço no plano | Commits | Revisão antes do merge |
|---|---|---|---|---|---|---|---|
| [P05-D](../testes/2026-11-01/matriz-achados.md#p05-d) · Guia "O que falta" e fase de bônus | `pacote/p05-d-guia-o-que-falta` | [P05-D-guia-o-que-falta.md](P05-D-guia-o-que-falta.md) | R-18, U-07 | 1 P, 1 M | **M** (4 a 6 dias) | 9 | `/code-review`. Não muda core, API nem template; o `/security-review` só entra se o PO quiser a marca da folha no servidor (seção 6, ponto 4) |
| [P07-D](../testes/2026-11-01/matriz-achados.md#p07-d) · Vantagens: regras, catálogo e interação | `pacote/p07-d-vantagens-regras` | [P07-D-vantagens-regras-catalogo.md](P07-D-vantagens-regras-catalogo.md) | T-08, T-24, R-25, R-26 | 4 M | **G** (7 a 9 dias), mais o conteúdo do time | 10 | `/code-review` e **`/security-review`** (contrato do template, validador e `resolve` do `@tms/sheet-core`) |
| [P10-C](../testes/2026-11-01/matriz-achados.md#p10-c) · Template: derivados, ordem e textos | `pacote/p10-c-template-derivados` | [P10-C-template-derivados-ordem.md](P10-C-template-derivados-ordem.md) | T-22, T-60, U-05, T-66, T-85 | 5 P | **5 P** (5 a 6 dias) | 11 | `/code-review`; `/security-review` recomendado no commit 2 (duas funções puras novas no core, que o servidor não chama) |
| [P10-D](../testes/2026-11-01/matriz-achados.md#p10-d) · Template: ajuda contextual e campos do Mago | `pacote/p10-d-ajuda-contextual` | [P10-D-ajuda-contextual-mago.md](P10-D-ajuda-contextual-mago.md) | R-19, U-06 | 1 P, 1 M | **M** (5 a 6 dias); G (7 a 8) com a forma de objeto do catálogo (seção 4.3) | 9 | `/code-review` e **`/security-review`** (validação do contrato no core, no `validate.mjs` e na publicação) |

**Total da onda: 1 G, 2 M e 5 P**, em 39 commits, mais o commit de versão da seção 4.7. São de 21 a 27 dias de desenvolvimento somados. A matriz estimava 25.

- O caminho crítico é o P07-D (7 a 9 dias). Com os quatro em paralelo, a onda leva perto de duas semanas.
- Depois vem a integração: E2E, build nativo e o roteiro manual da seção 10, de 2 a 2,5 dias. É meio dia a mais que na onda 3, porque são três sistemas por plataforma.
- **Fora dessa conta fica o conteúdo do time** (seção 4.9):
  - de 1 a 2 dias para compilar a lista de Dons;
  - 1 dia para os 13 resumos da Fraqueza;
  - a conferência da licença;
  - as frases de ajuda, que podem entrar em partes.

**Por que os planos passam da soma da matriz:**

- **P07-D:**
  - quatro chaves novas no contrato do template (`recommend`, `catalogDefaults`, `default` por opção em texto e `creation.advice`), com paridade entre o `schema.json`, o `validateTemplate` e o `validate.mjs`;
  - o `resolve` do core muda (a Fraqueza como padrão mostrado);
  - o −/+ na linha refaz o `ListEditor`, põe o `at` no store e tira o `useItemAdvice` repetido;
  - o `/security-review`.
- **P10-D:**
  - o "?" entra em seis editores e três layouts, não só nas listas;
  - um componente novo no `@tms/ui` (`HelpButton`), com conferência nativa (lição S-01);
  - a sugestão e o catálogo hoje são só texto, e a frase pede um lugar novo (seção 4.3).
- **P05-D:** o "ir ao grupo" é infraestrutura nova (âncoras em toda seção, pedido pendente e foco nas três plataformas), e a troca "Orçamento" → "Pontos" toca 6 specs, o ajudante e 5 arquivos de Jest.
- **P10-C:** bate com a matriz (5 P).

**Se a onda precisar cortar**, cada plano aponta o commit que sai sozinho:

- **P07-D:** o commit 8 (o catálogo de Dons e os resumos da Fraqueza), que espera o conteúdo e a licença. Sem ele, o mecanismo entra, o W20 fica com o texto livre de hoje, e o V20 e o M20 ficam com os selos (nomes e ids que já estão no template).
- **P10-D:**
  - o commit 7 (a frase nas sugestões e no catálogo);
  - o commit 8 (as frases do time). Sem as frases, o "?" aparece só nos 22 campos que já têm `help`.
- **P05-D:** o commit 6 (a fase em texto). O commit 7 é pequeno e fecha o U-07.
- **P10-C:** nada sai sem deixar um bug aberto. O U-05 pode fechar só com o teste, se o roteiro não o reproduzir (P10-C, pergunta 6).

**As branches de pacote** são criadas na ponta da `onda/4-conteudo-guia` depois do commit destes planos, sem commit próprio.

## 2. Ordem de merge na onda

**P05-D → P10-C → P07-D → P10-D → commit de versão dos templates.** Os planos propuseram ordens diferentes para os três pacotes de template:

- P07-D: P10-C → P07-D → P10-D;
- P10-D: P07-D → P10-C → P10-D;
- P10-C: P10-C antes dos outros dois;
- P05-D: P05-D antes do P07-D, sem preferência entre os de template.

A consolidação fica com a ordem acima porque ela atende aos quatro, e os planos do P07-D e do P10-D foram alinhados a ela (seção 5). Os pacotes são desenvolvidos ao mesmo tempo, cada um no seu worktree. A ordem vale só para a integração: merge `--no-ff` com o ID no título, e typecheck, lint e testes depois de cada merge.

1. **P05-D primeiro.** Ele:
   - não toca template, core nem `@tms/ui`;
   - cria o ponto de extensão do "O que falta" (`useCreationNotices` em `sheet/creation/guide.ts`, P05-D §3.9), que o P07-D preenche com o aviso do Dom e o "fora do clã" (seção 4.2);
   - troca "Orçamento" por "Pontos" em todos os specs e no Jest de uma vez (seção 4.11). O P07-D faz o rebase do `advantages.spec.ts` sobre os seletores novos;
   - deixa os rótulos da aba e do saldo onde o commit 5 do P10-D põe o "?".
2. **P10-C em segundo.** Ele:
   - não toca JSON de template, então não disputa a versão;
   - é o menor dos três de template;
   - traz o `Stepper.decrease` (`@tms/ui`) e o `byLabel` (`evolve/text.ts`), que o −/+ da linha e os blocos "Do clã" / "Outras" do P07-D usam (seção 4.5);
   - muda o core (`editResource` e `defaultStored`): o `dist` é reconstruído depois do merge dele.
3. **P07-D em terceiro.** Ele:
   - define as chaves novas do contrato e a forma do catálogo (lista de nomes e mapas ao lado), em que o P10-D pendura a frase (seção 4.3);
   - escreve a `weakness.help`, que o P10-D não reescreve;
   - muda o core (contrato, validador, `resolve` e `recommend.ts`): o `dist` é reconstruído de novo.
4. **P10-D por último.** O "?" de cada opção precisa da lista final de opções e de nomes, inclusive o catálogo de Dons do P07-D, e da ordem do P10-C. Os commits 1 a 6 dele não dependem dos outros. O commit 7 (catálogo e sugestões) é feito no rebase sobre o P07-D.
5. **Commit de versão** (seção 4.7). Os três `templateVersion`, a migration `0023_templates_onda4.ts`, só de dados, e os testes que fixam versão. Ele é o último commit da branch do P10-D, depois do rebase sobre a onda com os outros três, e entra pelo merge `--no-ff` do P10-D. Se o P15-D entrar na onda, o commit de versão passa para o fim do P15-D.

**Se o P07-D atrasar,** o P10-D entra sem o commit 7, e a frase do catálogo fica para o P07-D trazer junto com o catálogo de Dons (P10-D §8.1). O aviso do Dom no "O que falta" não aparece até o P07-D, porque o `useCreationNotices` devolve `[]`.

**Se o P10-C atrasar,** o P07-D entra com as duas peças na própria branch:

- o "−" da linha sem a previsão (o `Stepper` de hoje);
- os blocos "Do clã" / "Outras" na ordem do template.

O P10-C faz o rebase depois (P10-C §8.4, com a ordem trocada).

**Se o P05-D atrasar,** o P07-D põe os avisos no bloco "O que falta" de hoje, sem toque (P07-D §8.4), e o P05-D faz o rebase da aba e dos specs.

**Com os quatro dentro:**

1. `npx pnpm build`: o `dist` do `@tms/sheet-core` com as mudanças do P10-C, do P07-D e do P10-D. O `check-dev-env.mjs` recusa API, seed e `templates:publish` com `dist` velho;
2. testes completos com `test:coverage`, como o CI. A meta do core é de 95% de linhas e funções (`packages/sheet-core/bunfig.toml:5`), e as metas são por arquivo: os arquivos novos (`recommend.ts`, `guide.ts`, `bonusSeen.ts`) entram nela;
3. `*.pg.test` da API, à mão, com o banco `_test` da integração (`PG_TEST_URL=…/tms_pg_test bun test .pg.test`). O CI não os roda mais (PR #49). Nenhum pacote muda a concorrência, então eles servem de guarda;
4. E2E em Chromium e WebKit, com os specs novos `creation-guide` (P05-D) e `help` (P10-D) e os passos novos de `advantages`, `creation-feedback`, `create-character` e `evolve`;
5. build nativo local de Android (`assembleDebug`) e iOS (`xcodebuild` Debug para o simulador). Desde o PR #49, o CI não compila o nativo, e esta é a única prova antes do PR da onda. O `@tms/ui` muda (`Stepper.decrease` e `HelpButton`, seção 4.5), e a lição S-01 pede a conferência no nativo;
6. o roteiro manual da seção 10, nas três plataformas, com a versão nova dos templates publicada.

Depois: push da onda e PR para a `main`, com uma seção por pacote.

**Critério de saída da onda (matriz) × quem entrega.** O roteiro está na seção 10.6.

| Critério | Persona e notas | Pacotes |
|---|---|---|
| Vampiro por pontos, concluída sem ajuda | I-W, web 390 (Tarefa 3; SEQ 2; IW-05, IW-06, IW-09); I-A, iOS (Tarefa 3; SEQ 2; IA-06, IA-07, IA-18, IA-21); E-W, web 390 (Tarefa 2; SEQ 5); E-A, Android (Tarefa 2; SEQ 5) | P05-D (R-18, U-07), P07-D (T-08, R-25, R-26), P10-C (T-22, T-60, T-66, T-85), P10-D (R-19) |
| Mago por pontos, concluída sem ajuda | E-W, web 1280 com passada em 390 (Tarefa 3; SEQ 6). PO-A, iOS (SEQ 3; POA-14, POA-15). O Iniciante não fez o Mago no teste: entra aqui no iOS para cobrir o critério | P10-D (U-06, R-19), P07-D (Esfera da Tradição), P10-C (U-05), P05-D |
| Lobisomem por pontos, concluída sem ajuda | E-A, Android (Tarefa 3; SEQ 3; EA-08, EA-14). PO-W, web 390 (SEQ 4). O Iniciante também não fez: entra aqui no web 390 | P07-D (T-24), P10-C (T-85, T-22), P10-D (R-19), P05-D |
| E2E verdes | Todos, na integração | Os quatro |

## 3. Arquivos tocados por mais de um pacote

| Arquivo | Pacotes | O que cada um muda | Risco |
|---|---|---|---|
| `apps/frontend/sheet/creation/CreationPanel.tsx` | P05-D, P07-D, P10-D | P05-D: a fase (`:200-217`), a lista tocável (`:229-252`) e a folha (`:289-344`). P07-D: só implementa o hook do P05-D, sem reescrever o painel. P10-D: o "?" no rótulo do saldo (commit 5) | Médio. Seção 4.2 |
| `apps/frontend/sheet/creation/guide.ts` (novo) | P05-D, P07-D | P05-D cria; P07-D implementa o `useCreationNotices` | Baixo. Seção 4.2 |
| `apps/frontend/sheet/creation/creation.ts` (app) | P07-D, P10-C, P05-D (leitura) | P07-D: o texto da Qualidade sem Custo, `addAdvice` e `adviceText`. P10-C: `stepAdvice` com direção, `RefusalCause` `'initial'`, `draftRefusal` e o `problemText` do `CREATION_BELOW_INITIAL` | Baixo, em trechos separados. Quem entra depois soma as causas ao `RefusalCause` |
| `apps/frontend/sheet/evolve/ListEditor.tsx` | P07-D, P10-C, P10-D | P07-D: a linha vira `ItemEditorRow` com −/+, a `AddItemSheet` ganha blocos, a prévia e o aviso de nome repetido, e a `ItemSheet` perde o Valor. P10-C: a ordem das opções da `AddItemSheet` (`:207-213`) e o "Nenhuma Qualidade" (`:134-138`). P10-D: o "?" na opção da `AddItemSheet` e a frase no topo da `ItemSheet` | **Alto.** É o arquivo mais disputado da onda. Seção 4.4 |
| `apps/frontend/sheet/evolve/text.ts` | P10-C, P07-D | P10-C: `byLabel` e `noneOf`. P07-D: usa o `byLabel` dentro de cada bloco | Baixo |
| `apps/frontend/sheet/evolve/useRowFeedback.tsx` | P07-D, P10-C | P07-D: o caminho de item na linha da lista. P10-C: o `decrease` | Médio. Seção 4.5 |
| `apps/frontend/sheet/store/sheetStore.ts` | P07-D, P10-C | P07-D: `setDraftValue(path, to, { at })`. P10-C: o contador que volta a zero (`from: null` igual ao padrão, com o `defaultStored`) | Baixo, em funções diferentes |
| `apps/frontend/sheet/evolve/NumberEditorRow.tsx`, `ResourceEditorRow.tsx`, `EditorShell.tsx` | P10-C, P10-D | P10-C: o `editResource` e o `decrease`. P10-D: o `help` pelo `EditorShell` | Baixo |
| `apps/frontend/sheet/evolve/ChoiceEditorRow.tsx`, `TextEditorRow.tsx` | P07-D, P10-D | P07-D: o `recommend` na Esfera de afinidade e a Fraqueza com "Usar o resumo do clã". P10-D: a linha vira `[Pressable][?]` | Médio: os dois mudam a estrutura da linha. O P10-D faz o rebase |
| `apps/frontend/sheet/editors/Suggestions.tsx` | P10-C, P10-D | P10-C: a ordem. P10-D: as linhas com "?" quando há frase | Baixo |
| `apps/frontend/sheet/SectionView.tsx`, `layouts/GroupsLayout.tsx` | P05-D, P10-D | P05-D: a âncora e o foco no título. P10-D: o "?" ao lado do título do grupo | Baixo |
| `apps/frontend/sheet/evolve/ModeBar.tsx` | P05-D | o slot `guide` e o `closed` | Só o P05-D |
| `packages/ui/src/Stepper.tsx` | P10-C (P07-D usa) | `decrease?: StepperIncrease` e o `markSoftDisabled` no "−" | Médio: é API pública do `@tms/ui`. Seção 4.5 |
| `packages/ui/src/Choice.tsx`, `TextField.tsx`, `HelpButton.tsx` (novo) | P10-D (P07-D usa o `meta` do `Choice` como está) | o `help` e o "?" | Médio: API pública do `@tms/ui` |
| `packages/sheet-core/src/contract/fields.ts`, `contract/template.ts`, `validate/template.ts` | P07-D, P10-D | as chaves novas de cada um (seção 4.3) | **Alto:** os mesmos `KEYS` e tipos. O P10-D faz o rebase |
| `packages/sheet-core/src/creation.ts`, `fields/resource.ts`, `resolve.ts` | P10-C (`defaultStored`, `editResource`), P07-D (`resolve` e `recommend.ts`) | funções novas, sem mudar `checkCreation`, `creationFreeze`, `validateSheet` nem `describeEvent` | Baixo |
| `design/templates/schema.json`, `design/scripts/validate.mjs`, `design/templates/README.md` | P07-D, P10-D | as chaves do contrato; o README §2, §3 e §12 | Médio, textual. Seção 4.3 |
| `design/templates/vtm-v20.json`, `wta-w20.json`, `mta-m20.json` | P07-D, P10-D (e o P15-D, fora destes planos) | P07-D: `recommend`, `catalogDefaults`, o catálogo de Dons, `weakness.default` e `weakness.help`. P10-D: as frases, a Casa e a revisão dos 22 `help` | Médio. A versão sobe uma vez (seção 4.7) |
| `apps/api/src/templates/__tests__/publish.test.ts` | P10-D, commit de versão | P10-D: recusa de ajuda com link ou grande. Versão: as linhas que fixam `1.8.0` e `1.9.0` | Baixo |
| `design/design-system/components.md` | P05-D, P10-D | a ModeBar e a aba "Pontos"; o `HelpButton` | Baixo |
| Jest: `ListEditor.test.tsx`, `evolve.test.tsx`, `creation/__tests__/advantages.test.tsx`, `CreationScreen.test.tsx`, `packages/ui/src/components.test.tsx`, `a11y.test.tsx` | os quatro | seção 4.2 de cada plano | Médio: fixtures de texto |
| E2E: `advantages`, `creation-feedback`, `create-character`, `journey`, `journey-werewolf`, `journey-mage`, `evolve`, `a11y-keyboard` e `e2e/support/creation.ts` | os quatro | seção 4.11 | Médio |

## 4. Acordos entre pacotes

### 4.1 A barra de criação (P05-D sobre o contrato do P03-D e do P04-D)

O contrato do `EvolveBar` é o do P03-D §3.4, com o `note` do P04-D. O briefing desta etapa e o onda-3.md §4.1 punham o "Faltam: …" no `note`. **O plano do P05-D propõe outro lugar, e a consolidação aceita:** um slot novo, `guide`, na linha dos botões, à esquerda do "Salvar". Ele ocupa o lugar do "Concluir criação" enquanto a conta está aberta (P05-D §3.3):

| Peça | Quem preenche | O quê |
|---|---|---|
| `save` | P03-D | sem mudança |
| `next` na Criação | P03-D | "Concluir criação" / "Enviar para aprovação", só com a conta fechada |
| `note` | P04-D, com a mudança do P05-D §3.5 | a linha do próximo passo, que passa a dizer "A conta fechou: você conclui." quando a conta fecha (o achado 3 do onda-3.md §11) |
| **`guide`** | **P05-D** | "Faltam: Virtudes 7 · e mais 2", com cada item como botão de 44 (48 no Android), enquanto a conta está aberta |

- **Por que não no `note`:** a linha de `caption` tem 18 de altura, e um item tocável precisa de 44. O "Faltam" como terceira linha levaria a barra a ~160 dp no Android. Num Pixel 3a a 360 × 740, isso deixaria ~332 dp de ficha, o "engolir a ficha" que o T-27 corrigiu.
- **A altura não muda:**
  - **celular:** 108 dp no Android e 104 no iOS e no web, com a conta aberta ou fechada;
  - **fonte a 130%:** ~132 / ~126;
  - **a partir de 600:** 64 / 60.
- **A medida da onda 3 precisa ser lida de novo.**
  - A onda 3 mediu 110 dp no Android, ~89 pt no SE e ~88 px no web a 390.
  - O P05-D mostra que o iOS e o web batem com uma linha de texto só, e o Android, com duas.
  - O roteiro mede a barra com a conta aberta e fechada e anota quantas linhas de texto havia (seção 8, pergunta 1; 10.7, X-barra).
- **A lista longa:** só itens inteiros, depois "e mais N", e nenhum texto cortado. Se nem um item cabe, a linha vira um botão só, "Faltam N itens". Quem decide é o `fitGuide`, pela largura do `onLayout`.
  - **"e mais N" e "Faltam N itens"** levam à aba Pontos, com o foco no título "O que falta".
  - **Exemplos no V20:** a 360, "Faltam: Virtudes 7 · e mais 2"; a 411, "Faltam: Disciplinas 3 · Virtudes 7 · e mais 1".
- **"Concluir criação" escondido × `aria-disabled` e tocável** (a pergunta 4 do onda-3.md §8). A onda 3 aplicou "escondido" (onda-3.md §11, pergunta 4).
  - **O P05-D recomenda manter escondido, com o "Faltam" no lugar.** Ele já explica o que falta, cabe na mesma linha e não muda o `@tms/ui`.
  - **A alternativa custa um commit P:** uma prop `softDisabled` no `Button` do `@tms/ui` e o "Faltam" numa linha própria (+56 dp).
  - É decisão de produto (seção 6, ponto 2).
- **O ponto 3 do onda-3.md §6** (ficar no Editar depois de salvar) segue em aberto. Ele toca a criação livre, que não tem "Faltam": na Criação por pontos, a ficha já fica depois de salvar.
- **Ninguém mais mexe na `ModeBar.tsx` nesta onda.**

### 4.2 O "O que falta" e os avisos que não bloqueiam (P05-D × P07-D)

**Quem gera os itens: o app,** a partir do `check.problems` do `checkCreation` (o mesmo que o servidor repete). O sheet-core não ganha um gerador de texto. Se o P09-D (onda 5) precisar do resumo na Mesa, a parte sem tela sobe ao core lá (P05-D, pergunta 6).

**O formato do item tocável.** Um `GuideItem` com o texto, o `kind` e o alvo:

- **`kind`:** `missing`, `blocking` ou `confirm`;
- **alvo:**
  - a aba e a sub-aba;
  - a âncora da seção (`#anchor-<seção>`);
  - o caminho de item (`values.<lista>#<item>`) para a linha da lista.

O toque leva à aba, rola até a seção e põe o foco no título (P05-D §3.1 e §3.2).

**O aviso que não bloqueia** ("confirme com o narrador"):

- **O nome do contrato é o do P05-D.** O P05-D deixa `useCreationNotices()` em `guide.ts`, devolvendo `[]`. O P07-D o implementa com o `creationAdvice` que ele exporta do core (P07-D §3.2), com o texto do `adviceText`. O plano do P07-D chama esse par de `useCreationAdvice()` / `adviceText()`: na implementação, o hook público é o `useCreationNotices` do P05-D.
- **No core, o aviso fica em função própria** (`creationAdvice`), nunca em `problems`. O `complete`, o `savable` e a recusa do servidor não mudam por causa dele. Um teste do P07-D prova que o servidor aceita e recusa o mesmo que antes.
- **Na tela:**
  - **na barra:** nada. O `confirm` não conta no "Faltam" nem no "e mais N", e não esconde nem libera o "Concluir";
  - **na aba Pontos:** um bloco "Para confirmar com o narrador", depois do "O que falta", com o texto começando por "Confirme com o narrador:" (texto, não só cor);
  - **na confirmação de concluir:** uma linha nas `notes` ("1 item para confirmar com o narrador; veja em Pontos.");
  - **na linha da lista** (P07-D): "fora do clã: confirme com o narrador" ou "Posto 2: confirme com o narrador", só na Criação.
- **A D-07 fala em aviso "no 'O que falta'".** O P05-D o põe na aba e na confirmação, não na barra. É ponto para o PO (seção 6, ponto 5).
- **Sem texto da ficha no aviso:** o nome do Dom vem do catálogo do template. Um Dom digitado fora do catálogo aparece como "um Dom acima do Posto 1".

### 4.3 O contrato do template (P07-D × P10-D)

As chaves novas são todas opcionais. Nenhuma sai e nenhuma muda de sentido:

| Chave | Onde | Pacote | Limite |
|---|---|---|---|
| `recommend` | campo `list` e `choice` | P07-D | nomes do `catalog` ou ids de opção; o texto do selo ("do clã", "fora do clã") é do app |
| `catalogDefaults` | campo `list` | P07-D | o Posto inicial de cada nome do catálogo |
| `default` por opção | campo `text`/`longText` (`{ from, map }`) | P07-D | o resumo da Fraqueza, até 400 caracteres por clã |
| `creation.advice` | regras de criação | P07-D | a regra `item-meta-max` (o Posto acima de 1) |
| `help` | opções de `choice`, `tags` e `state`, itens `fixed` e grupos de seção | P10-D | `$defs/helpShort`: até 200 caracteres, uma linha, `safeText`, sem `://` nem `www.` |
| a mesma regra de "sem link" | o `helpText` de hoje (campos) | P10-D | — |

**A forma do catálogo: o ponto que os planos não fecharam juntos.**

- **O P10-D supunha que o P07-D traria a forma de objeto** (`{ name, help }`) para o `catalog` e as sugestões. O P07-D não a traz: o catálogo continua uma lista de nomes, com o nível e a recomendação em mapas ao lado.
- **Recomendação técnica da consolidação: a frase do catálogo e das sugestões segue o padrão do P07-D,** num mapa por nome, ao lado da lista. Assim:
  - os consumidores do `itemIn` do XP e do `{ list, item }` não mudam;
  - o commit 7 do P10-D fica M;
  - a regra "mesma frase para o mesmo nome no template" (P10-D, pergunta 4) sai de graça.
- **A alternativa** é a forma de objeto, que o P10-D desenha na §3.1 e que leva o pacote a G.
- A escolha é técnica (seção 8, pergunta 2). O plano do P10-D já aponta isto (§8.4).

**Na edição dos mesmos arquivos:**

- **A `weakness.help` é do P07-D.** A frase muda de sentido com o padrão ("começa com um resumo do time…"), e o P10-D não a reescreve.
- **O `schema.json`.** Os dois mexem no `$defs` do `field-choice` e do `field-list`. O P07-D entra primeiro, e o P10-D faz o rebase. O conflito é textual e pequeno.
- **Paridade entre o `schema.json`, o `validateTemplate` e o `validate.mjs`.** Cada pacote prova a sua chave nos três, com teste Bun no core e no `publish.test.ts` em PGLite.
- **O app antigo.** O `validateTemplate` recusa chave desconhecida no campo (`validate/template.ts:275`, `:380`), e o app que não a conhece mostra "Atualize o app" (`UnsupportedTemplate.tsx:43-68`). As chaves do P07-D estão no campo. O `help` do P10-D fica dentro das opções, que o core antigo não confere. Na prática, o V20, o W20 e o M20 da versão nova pedem o app novo (seção 4.7).

### 4.4 A linha da lista e a opção da folha a 360 dp (P07-D × P10-C × P10-D)

Os planos desenhavam a linha do item de dois jeitos:

- **P07-D:** reservava um slot `help` entre o nome e o `Stepper`, com 112 dp para o nome;
- **P10-D:** deixava a linha do item sem "?", com 172 dp para o nome.

**A consolidação fica com o desenho do P10-D,** e o P07-D §3.4 foi corrigido:

```
Linha do item (ItemEditorRow, P07-D), a 360 dp, Android:
| [Potência                     ]  [ − ] 2 [ + ] |   ← nome 172 dp; − e + de 48
| [do clã · Especialização: X   ]                |
| [fora do clã: confirme com o narrador]         |   ← só na Criação
| [aviso da recusa, perto do toque]              |

Opção da folha "Adicionar Disciplina" (AddItemSheet), a 360 dp:
| Do clã                                          |   ← título do bloco (P07-D)
| [Potência                          ]  [?]      |   ← nome 272 dp; "?" de 48 (P10-D)
| [do clã · já na ficha              ]           |
| Outras                                          |
| [Auspícios                          ]  [?]      |   ← ordem pelo rótulo (P10-C)
```

- **O nome acessível:**
  - **da linha:** "Potência, 2 de 5, do clã", com a dica "Abre o item: nome, especialização e notas";
  - **do −/+:** no web, "Diminuir Potência" e "Aumentar Potência". No app, um controle ajustável "Potência", com o valor "2 de 5", como os traços;
  - **da opção:** "Potência, do clã". O selo é texto e entra no nome;
  - **do "?":** "Ajuda: Potência".
- **A frase do item já na ficha** aparece como texto no topo da `ItemSheet`, que a linha abre. O "?" fica na opção da `AddItemSheet` e no cabeçalho da lista (a frase do campo: Disciplinas, Antecedentes e Dons).
- **A ordem:** os blocos "Do clã" / "Outras" (P07-D) primeiro e, dentro de cada um, o `byLabel` do P10-C. O `byLabel` usa um `fold` com ponto de código, que dá a mesma ordem no Hermes, no web e no Jest (P10-C §3.4). As opções de `choice` não são reordenadas.
- **A lista vazia:** o `noneOf` do P10-C ("Nenhuma Qualidade", "Nenhum Defeito", "Nenhuma Cicatriz"), pela regra de gênero na tela, com uma tabela de exceções. O campo `itemGender` no template fica como alternativa (P10-C, pergunta 5): ele exigiria versão nova e só valeria para fichas novas.
- **Os Dons não têm −/+ na linha.** O Dom do W20 não tem `value`: ele conta por item, e o nível é o meta `rank` (Posto). A linha mostra "Posto N", e o Posto muda na folha (seção 6, ponto 7).
- **Cada alvo tem pelo menos 44 × 44 (48 no Android),** pelo `minTarget` do `Pressable` do `@tms/ui`. A linha cresce para baixo quando o nome quebra. Com a fonte a 130%, a medida é no AVD a 360 dp (P07-D §11, R-25d).

### 4.5 O `Stepper` e a recusa perto do toque (P10-C × P07-D)

- **O P10-C dá ao `Stepper` do `@tms/ui` um `decrease?: StepperIncrease`** (o tipo serve às duas direções, e o nome fica para não quebrar quem o importa). O `markSoftDisabled` do P05-C passa a valer também no "−". Sem `decrease`, nada muda.
- **O "−" do valor inicial** (Fúria pelo Augúrio, FdV pela Coragem) fica com cara de indisponível e continua tocável. O toque explica "Na criação, não fica abaixo de N (vem de …)" (rascunho do time, para revisão), e o rascunho não desce. A recusa nova é só do app (`RefusalCause` `'initial'`). O servidor já recusa abaixo do inicial (`CREATION_BELOW_INITIAL`), e o limite não afrouxa.
- **O −/+ da linha do P07-D** usa o mesmo `Stepper` com `increase` e `decrease`, e o `useRowFeedback` com o caminho de item. O aviso volta pelo `useDraftNotice('values.<lista>#<item>')`, com o `at` no `setDraftValue`. A `ItemSheet` deixa o `useItemAdvice` e usa o `useRowFeedback`, e isso tira a lógica repetida que o P07-C deixou.
- **O "+" e o "−" com `aria-disabled` e tocáveis, nunca com `disabled`.** O `react-native-web` transformaria `accessibilityDisabled` em `disabled`, e o botão ficaria morto (lição `e8cfaf8` da onda 2). O E2E confere no DOM. O ponto 5 do onda-2.md §6 (R-20: "+" desabilitado de verdade) continua em aberto. Se o PO o quiser, muda nos traços, na linha da lista e no "−" juntos.
- **O que muda na API pública do `@tms/ui`:**
  - `Stepper.decrease`, do P10-C;
  - `HelpButton` e `HelpText` (novos), mais o `help` no `Choice` e no `TextField`, do P10-D.

  As duas mudanças são aditivas e entram no `components.md`. O build nativo da integração e o roteiro conferem os dois componentes no Android e no iOS (S-01).

### 4.6 Bancos locais, worktrees e o `dist` do `@tms/sheet-core`

- **Cada pacote usa um banco próprio no Postgres local:** `tms_p05d`, `tms_p07d`, `tms_p10c` e `tms_p10d`, com `createdb` e `DATABASE_URL` só no comando, com as credenciais locais do `docker-compose.yml`.
  - **Nunca `db:down`:** o Postgres do Docker é um só para todos os worktrees, e o `db:down` apaga o volume com os bancos dos outros.
  - **Por que um banco novo:** os pacotes de template mudam o JSON sem subir a versão (seção 4.7). Num banco novo, a `0020` grava o conteúdo atual dos arquivos. Num banco que já tem a 1.8.0, o `templates:publish` acusaria "já foi publicado com outro conteúdo".
  - O plano do P10-D usava `db:down` e foi corrigido (seção 5).
- **O `*.pg.test` de cada worktree** usa um banco `_test` próprio ("Como executar").
- **O `dist` do `@tms/sheet-core`.** O servidor, as migrations, o seed e o `templates:publish` leem o `dist`; o Metro e o Jest leem o `src`.
  - **No pacote:** quem implementa roda `npx pnpm -C packages/sheet-core build` depois do commit que muda o core (P10-C commit 2; P07-D commits 2 e 3; P10-D commit 1), antes da API, do seed e dos testes da API.
  - **Na integração:** `npx pnpm build` depois do merge de cada um deles.
  - **O P05-D não muda o core.**
  - **O `dist` não é versionado,** e o `check-dev-env.mjs` para tudo com um `dist` velho.
- **O `.env` não é lido nem mostrado.** O `DATABASE_URL` do banco do pacote vai só no comando.

### 4.7 A versão dos templates (P07-D × P10-D × P10-C, e o P15-D se entrar)

**Um aumento por onda, não por pacote.** Os três planos que respondem chegam à mesma proposta:

| Template | Hoje | Na onda 4 | Quem muda o conteúdo |
|---|---|---|---|
| `vtm-v20` | 1.8.0 | **1.9.0** | P07-D (`recommend` das Disciplinas, `weakness.default` e `weakness.help`); P10-D (frases) |
| `wta-w20` | 1.6.0 | **1.7.0** | P07-D (catálogo de Dons, `catalogDefaults`, `recommend`, `creation.advice`); P10-D (frases) |
| `mta-m20` | 1.6.0 | **1.7.0** | P07-D (`recommend` da Esfera de afinidade); P10-D ("Casa ou subgrupo", "Opcional" e frases) |

O D&D 5e, o CoC 7e e o Fate não sobem: não são publicados (`templates/published.ts:4-7`). O P10-C e o P05-D não mudam template.

- **Por que um aumento só.**
  - A versão publicada é imutável (`apps/api/src/templates/publish.ts:104-114`), e o `templateVersion` não aceita sufixo de pré-versão (`validate/template.ts:368-369`).
  - Dois pacotes subindo a mesma versão com conteúdos diferentes travariam um ao outro no banco de quem testou os dois.
  - Um aumento por pacote daria três versões em produção na mesma onda, cada uma com uma janela de "Atualize o app" e fichas presas a uma versão intermediária.
- **Minor, e não major:** o conteúdo e as chaves são aditivos.
- **Quem e quando:** um commit só, o último da branch do P10-D, depois do rebase dela sobre a onda com o P05-D, o P10-C e o P07-D. Se o P15-D entrar, o commit vai para o fim do P15-D. O commit traz:
  - os três `templateVersion`;
  - a migration `packages/db/src/migrations/0023_templates_onda4.ts`, cópia da `0020` (`storeTemplate` dos `PRODUCT_TEMPLATES`, sem `down`). **É uma migration só de dados, sem mudança de schema.** Ela segue a regra que o comentário da `0020` (l.5-9) e o `regras-wod.md:5` escrevem: "uma versão nova de template ganha a sua migration";
  - os testes que fixam versão (P10-D §4.2):
    - `mage.test.ts:90`, `werewolf.test.ts:98` e `characters.test.ts` (8 linhas);
    - `publish.test.ts:185-347`: o caso "uma versão nova convive" passa a montar a 1.10.0;
    - `compile.test.ts:42-43`.
- **A ordem da publicação** é a de `PRODUCT_TEMPLATES` (`packages/db/src/templates.ts:11`): `vtm-v20`, `mta-m20` e `wta-w20`. Vale pela migration e pelo `npx pnpm templates:publish --published`.
- **Em produção, a versão chega com o deploy da API.** O `deploy/render/start.sh:20` roda as migrations antes de subir a API, e o bundle web sai no mesmo container. Por isso:
  - **web:** o app e o template sobem juntos, e não há "Atualize o app";
  - **app nativo da loja, versão anterior:** as chaves novas do P07-D ficam no campo, e o `validateTemplate` as recusa. Toda ficha **nova** de Vampiro, Mago e Lobisomem criada depois do deploy mostra "Atualize o app" no app antigo, até a loja ter a versão nova. O README §9 (passo 5) e o `arquitetura-motor-de-ficha.md:167` pedem o app antes do template. Isso decide a ordem do release (seção 6, ponto 3; seção 9).
- **O precedente não fecha a dúvida.** O `vtm-v20` 1.8.0 (`733c915`, de 30/10) veio depois da `0020` (`c630b4d`, de 26/10) e não teve migration própria. Como ela chegou a produção (um `templates:publish` manual?) não está no repositório. É pergunta técnica para o time (seção 8, pergunta 3).

**O que acontece com cada ficha e cada app:**

| Caso | O que acontece |
|---|---|
| Ficha criada na versão anterior (1.8.0 / 1.6.0 / 1.6.0) | Continua nela: a ficha guarda o `template_version` (`apps/api/src/sheets/routes.ts:278`), e o modelo é buscado pela versão (`:372`). Abre no app novo, sem "Atualize o app", e ganha tudo o que é código: o −/+ na linha, a ordem, o "Nenhuma", os derivados sobre o rascunho, o "−" do inicial, o "Faltam", a aba "Pontos" e o "?" nos 22 campos que já têm `help`. Fica sem o que é dado do template novo: o catálogo de Dons, os selos, a Fraqueza preenchida, as frases novas e "Casa ou subgrupo". Não há caminho de atualização de versão de ficha, e criar um é decisão nova (seção 6, ponto 9) |
| Ficha nova depois da publicação | Nasce na versão nova, com tudo |
| App novo, template antigo | Abre: as chaves novas são opcionais |
| App nativo antigo, ficha nova | "Atualize o app" (acima) |

**Nenhum campo é removido nem escondido** em nenhuma das três versões. A Casa fica em todas as Tradições, e a Fraqueza continua editável.

### 4.8 Folhas

As folhas tocadas usam a `BottomSheet` do `@tms/ui` sem mudar a API pública:

- **a `AddItemSheet` e a `ItemSheet` (P07-D):**
  - a `AddItemSheet` ganha blocos e a prévia do item novo;
  - a `ItemSheet` perde o Valor e ganha, no topo, a frase do item (P10-D);
- **a folha "Começaram os pontos de bônus" (P05-D):** "Ver Pontos" troca de aba no `onClosed`;
- **o "Escolher da lista" (`SuggestionPicker`):** muda a ordem (P10-C) e ganha linhas com "?" quando há frase (P10-D).

**A ajuda não é folha.** O "?" do P10-D abre o texto na própria linha (padrão *disclosure*, com `aria-expanded`, `aria-controls` e `aria-live="polite"`), sem `Modal`. Dentro de uma folha (a da Força de Vontade, a `ItemSheet`), o Esc continua fechando a folha, e o foco volta ao gatilho dela (P10-D §4.3, passo 3).

**Nenhuma pode regredir:**

- o Esc na captura, inclusive sem campo em autoFocus (`f3f3b8a`);
- o foco de volta ao gatilho. Na folha de bônus, é o "+" que fechou os básicos;
- o diálogo central de 560 a partir de 600 px (T-69), medido no painel (`bottom-sheet-root > [aria-modal="true"]`), depois da entrada (lição `d9fa56f` da onda 3);
- o `onClosed`, que faz a troca de folha no iOS;
- o texto do evento no Enter (`e0a4078`) na `AddItemSheet`. A folha de bônus não tem campo.

O achado 1 do onda-3.md §11 (a folha "busy" esperando as rebuscas) não toca nenhuma destas: as folhas de item fecham na resposta síncrona do rascunho, e a de bônus não envia nada.

### 4.9 Licença e textos que o time escreve

**Regra:** nenhum texto literal do livro, nem como exemplo nos planos.

- **Licença.** O catálogo traz só o nome e o nível (D-07). A D-07 revê a `auditoria-fichas-wod.md` l.162 só para os nomes. A Fraqueza e as frases de ajuda são escritas pelo time, com palavras próprias, sem copiar nem parafrasear frase a frase (C-18 da `avaliacao-ui-ux.md`; README dos templates §12).
- **Rascunhos.** Todo rascunho dos planos está marcado "rascunho do time, para revisão" e é texto do app, não termo de jogo. O P10-D não escreve nenhuma frase. O P07-D não escreve nomes de Dons nem resumos de Fraqueza.

| Sistema | Fraqueza (P07-D) | Catálogo (P07-D) | Frases de ajuda (P10-D) | Quem escreve |
|---|---|---|---|---|
| V20 | **13 resumos** (14 clãs menos o Caitiff), mais 1 opcional (Caitiff) | nenhum nome novo: o `recommend` copia os nomes do `itemIn` do XP, com teste de igualdade | **142**: 53 campos, 6 grupos, 14 clãs, 42 Arquétipos e 27 do catálogo (17 Disciplinas e 10 Antecedentes); mais 7 `help` a rever | Resumos e frases: o time (quem cuida do conteúdo do sistema), revisados por uma segunda pessoa |
| W20 | — | **de 85 a 125 nomes de Dons** de nível 1, nos 21 grupos (3 Raças, 5 Augúrios e 13 Tribos). São nomes, não texto, mas vêm da tradução publicada | **103**: 61 campos, 6 grupos e 21 opções de Raça, Augúrio e Tribo, mais 10 Antecedentes; 5 opcionais (Forma); mais 7 `help` a rever. As frases dos Dons ficam fora (abaixo) | Lista: o time compila, com duas fontes. **A licença dos nomes é conferida por quem cuida da parte jurídica,** antes do merge do commit 8 do P07-D |
| M20 | — | nenhum nome: 9 Tradições com ids de Esfera | **113**: 67 campos, 6 grupos, 23 opções (Tradição, Essência e Esfera de afinidade), 14 Antecedentes e 3 da Ressonância; mais 8 `help` a rever | O time |
| Texto do app | — | — | ~12 frases do P05-D ("Faltam", "e mais N", fase, conta fechada, "Ver Pontos"), 8 selos e 1 `weakness.help` do P07-D, e 3 do P10-C (o aviso do "−" e o `problemText`) | Quem implementa, com revisão do time |

- **44 rótulos se repetem nos três sistemas.** Uma frase escrita uma vez serve aos três, com revisão por sistema. A união dá 107 rótulos de campo distintos.
- **As frases de poderes** (Disciplinas, Dons, Esferas e Ritos) esperam o PO e quem cuida da licença. O README §12 diz que as descrições são protegidas, e a D-07 revê a licença só para os nomes (seção 6, ponto 10). Até lá, essas opções ficam sem "?".
- **A ajuda pode entrar parcial.** Campo sem frase não mostra "?". A prioridade 1 do P10-D §3.8 tem cerca de 20 termos por sistema: os que as personas não entenderam, mais os 6 grupos. Ela cobre o critério de saída do Iniciante. O resto entra por template, sem código, nesta versão ou numa seguinte.
- **O PR que traz texto** diz, no resumo, quem escreveu e quem revisou. É risco legal, não técnico, mas bloqueia o merge.

**Atualização (05/11/2026): o conteúdo entrou.** Decisão do usuário: "não precisa de licença, pois tudo que envolve ficha é free to use". A conferência de licença dos nomes (D-07) e das frases de poderes deixa de bloquear.

- **O que entrou** (`7f817c5`), de uma fonte só, [`onda-4-conteudo.json`](onda-4-conteudo.json) e o [`.md`](onda-4-conteudo.md):
  - o catálogo de Dons do W20: 48 nomes de nível 1, com Posto 1, recomendados por Raça, Augúrio e Tribo, e uma frase por Dom;
  - os 14 resumos da Fraqueza do V20, um por clã, com o Caitiff;
  - as frases das 17 Disciplinas e das 9 Esferas (no campo e na opção da Esfera de afinidade).
- **A regra continua:** nenhum texto do livro. O template traz nomes de traços, regras numéricas e frases curtas do time, escritas com palavras próprias. O `license` dos três templates e o README dos templates (§2, §3 e §12) dizem isso.
- **Continua rascunho do time, para revisão.** O catálogo de Dons foi compilado de memória e traduzido pelo time: os nomes e os grupos precisam ser conferidos contra o livro antes da `main`. O livro tem mais Dons por grupo.
- **Fora desta rodada:** os Ritos (o W20 não tem catálogo de Ritos) e os Dons de Posto 2 a 5.

### 4.10 Segurança e revisão

- **`/security-review` obrigatório:**
  - **P07-D:** contrato do template, validador, `resolve` e as funções novas do core que o servidor carrega;
  - **P10-D:** validação do contrato no core, no `validate.mjs` e na publicação.
- **Recomendado:** P10-C, no commit 2 (duas funções puras novas no core, que o servidor não chama).
- **P05-D:** não precisa, salvo se o PO quiser a marca da folha no servidor (seção 6, ponto 4). Nesse caso, a marca é escrita só pelo dono, validada pelo `writePolicy` com a ficha travada, com linhas novas na matriz de AuthZ dos três sistemas, como os marcadores do P04-D.
- **Os templates são dados.** O texto de ajuda, os nomes do catálogo, os selos e o resumo da Fraqueza saem como texto puro, num `Text` do React Native:
  - sem HTML nem markdown executável;
  - sem link: o `helpShort` recusa `://` e `www.`, e o `helpText` de hoje ganha a mesma regra;
  - sem `dangerouslySetInnerHTML`.
- **O `schema.json` limita o tamanho:** 200 na frase curta, 400 no resumo da Fraqueza e 80 no nome do catálogo, com até 200 nomes.
- **A publicação continua restrita como hoje:** pela migration, ou pelo `templates:publish` de quem tem acesso ao banco. Nenhuma rota nova.
- **A regra continua no servidor.**
  - O `checkCreation`, o `checkCreationBatch`, o `creationFreeze`, o `validateSheet` e o `describeEvent` não mudam.
  - A Qualidade com bônus (D-06) segue a tabela de custos do sheet-core, aplicada no servidor, como desde o P07-C.
  - O P07-D tem testes que provam que o servidor aceita e recusa o mesmo que antes com o template novo.
  - Nenhum limite afrouxa.
- **A marca da folha de bônus no aparelho** (`seen:bonus:<id>` no `UserStorage`):
  - o id passa pelo formato de UUID antes de virar chave;
  - só `"1"` vale como marcado, e o que vem do disco é tratado como input hostil;
  - sai no logout;
  - não tem PII.
- **Telemetria.** Os textos novos não vão ao Sentry fora da lista de campos de `apps/frontend/lib/telemetryFilter.ts` e `apps/api/src/http/on-error.ts`. Nenhum pacote acrescenta campo a ela.

### 4.11 E2E

Os seletores que mudam, por pacote, na ordem de merge (os specs rodam só na integração, com as portas fixas, um por vez):

| Ordem | Pacote | Specs e ajudantes | O que muda |
|---|---|---|---|
| 1 | P05-D | `advantages.spec.ts:28` e `:93`, `layout.spec.ts:188`, `creation-state.spec.ts:157`, `narrator.spec.ts:84`, `lifecycle.spec.ts:130`, `creation-feedback.spec.ts:116` e `:170`, e o `tab` de `e2e/support/creation.ts:126-140` | "Orçamento" → `getByRole('tab', { name: 'Pontos', exact: true })`. O `tab` passa a usar `exact` na aba da zona. Novo: `creation-guide.spec.ts`. Nenhum spec usa "Ver orçamento" nem `creation-phase` |
| 2 | P10-C | `creation-feedback.spec.ts` (teste novo dos derivados e do mínimo), `create-character.spec.ts` (ordem dos chips), `evolve.spec.ts` ("Nenhuma Qualidade"), `journey-storyteller.spec.ts` (ajuste) | `aria-disabled` no "−", sem `disabled` |
| 3 | P07-D | `journey.spec.ts:124-127` (Geração pelo −/+ na linha, sem folha), `journey-werewolf.spec.ts:85-90` (catálogo de Dons; um nome fictício fora do catálogo prova o texto livre), `advantages.spec.ts` (passos novos: R-25, R-26 e T-24), `a11y-keyboard.spec.ts` (o diálogo de 560 medido no painel; Tab nome → "Diminuir" → "Aumentar") | Rebase sobre o 1. Regex ancorada ou `exact` entre "do clã" e "fora do clã" |
| 4 | P10-D | `journey-mage.spec.ts:68-70` e `:73` (`getByLabel('Casa ou subgrupo', { exact: true })`), `journey-werewolf.spec.ts:69`, `:70` e `:75`, `journey.spec.ts:86` e `:88`, `create-character.spec.ts:24` | `getByLabel(…, { exact: true })`: o "Ajuda: <campo>" casaria no modo estrito. Novo: `help.spec.ts` |
| 5 | Commit de versão | nenhum spec: o seed do E2E publica os templates (`templates:publish --published`) | — |

- **O que o Jest não pega no web e o E2E confere no DOM:**
  - o `aria-disabled` sem `disabled`;
  - o `aria-describedby` do "+" apontando o aviso;
  - o `aria-expanded` e o `aria-controls` do "?";
  - o `tabIndex="-1"` e o foco na âncora do grupo;
  - o painel de 560;
  - a altura da `mode-bar`;
  - a ordem do `normalize('NFD')` no WebKit.
- **O Jest em `components/` só pega `.test.tsx`** (`apps/frontend/jest.config.js:24`). Em `sheet/` e `lib/`, o `.test.ts` roda (`:22`, `:25`). Os testes puros novos (`guide.test.ts`, `bonusSeen.test.ts`, `nextStep.test.ts`) ficam em `sheet/creation/__tests__/`, e nenhum pacote põe `.test.ts` em `components/`. Na integração, o `jest --listTests` confere que eles estão na lista (lição da onda 3).

### 4.12 Seed do roteiro

O seed não muda nesta onda. O `scripts/seed-roteiro.ts` já cobre:

- **as contas:** N (`roteiro_narrador`), J1 (`roteiro_jogador1`), J2 (`roteiro_jogador2`) e N2 (`roteiro_narrador2`), em `@roteiro.test`;
- **as crônicas:** "{Sistema} v3/v5" (criação livre) e "{Sistema} v4" (por pontos, aprovação desligada), de Vampiro, Mago e Lobisomem;
- **as fichas** do `--fichas-criacao` da onda 3.

O roteiro cria pela tela, em cada plataforma (J1; nomes fictícios):

- **"Brujah R"** em "Vampiro v4": as Disciplinas do clã, o "fora do clã", a Fraqueza, o "Faltam", a folha de bônus e a FdV;
- **"Lupino R"** em "Lobisomem v4": Raça Lupino, Augúrio Ahroun e qualquer Tribo. Serve ao catálogo de Dons, ao Posto, à Fúria (T-85) e à Gnose;
- **"Verbena R"** em "Mago v4": Tradição Verbena, para a "Casa ou subgrupo" vazia, a Esfera da Tradição e a Quintessência.

**Criar pela tela é parte do teste:** a identidade é onde ficam os selos e o "?". Uma opção `--fichas-onda4`, que criasse as três fichas pela API, pouparia ~10 min por plataforma e esconderia a Nova ficha (seção 8, pergunta 7).

**Um seed por plataforma,** com pelo menos 15 min entre dois (o limite de convites do J1). A saída do seed tem a senha e os e-mails: vai só para um log no scratchpad, lido com `grep -v -i senha`. A senha é a constante do seed e nunca é escrita aqui, num script versionado nem numa captura.

## 5. O que a consolidação corrigiu nos planos

- **A ordem de merge.** O P07-D (§8.4) propunha P10-C → P07-D → P10-D, e o P10-D (§8.4) propunha P07-D → P10-C → P10-D. Os dois receberam a nota da ordem consolidada (seção 2).
- **A forma do catálogo** (P10-D §8.4). O P10-D supunha que o P07-D traria a forma de objeto, e isso não está no plano do P07-D. A linha do P07-D na tabela de conflitos do P10-D foi corrigida e aponta a seção 4.3.
- **O "?" na linha do item** (P07-D §3.4). O slot `help` entre o nome e o `Stepper` saiu, como o P10-D §3.5 desenha. O nome passa de 112 para 172 dp a 360 (seção 4.4).
- **O banco do roteiro do P10-D** (§3.10 e §11.a). O `db:down` virou um banco próprio, `tms_p10d`, porque o Postgres do Docker é compartilhado entre os worktrees (seção 4.6).
- **Não corrigido e registrado:**
  - **o "Faltam" fora do `note`.** O briefing e o onda-3.md §4.1 o punham no `note`, e o P05-D o põe num slot `guide`, pelo alvo de toque de 44. A consolidação aceita o desenho do plano (seção 4.1);
  - **os nomes do hook do aviso.** O P07-D os chama de `useCreationAdvice` / `adviceText`, e o P05-D, de `useCreationNotices`. O contrato é o do P05-D (seção 4.2), e o P07-D o segue na implementação.

## 6. Pontos para o PO (nenhum decidido nos planos)

Recomendações e decisões que o código mostra não caberem como estão escritas, ou que criam comportamento que a decisão não diz:

1. **P14-D e P15-D na onda 4.** A matriz os pôs na onda em 03/11 (`960138b`), e este documento não os planeja. O P15-D mexe nos três JSON e entra no mesmo aumento de versão (seção 4.7). Se ele não entrar nesta onda, o campo "História / Prelúdio" vai numa versão seguinte, com outra janela de "Atualize o app".
2. **"Concluir criação" escondido até a conta fechar** (pergunta 4 do onda-3.md §8; P05-D §3.4). Recomendação técnica: continua escondido, e o "Faltam" ocupa o lugar dele. A alternativa (visível, `aria-disabled` e tocável) custa uma prop no `Button` e +56 dp na barra.
3. **A ordem do release: o app nativo na loja antes da versão nova dos templates.** Com a `0023` rodando no deploy da API, o app antigo mostra "Atualize o app" em toda ficha nova dos três sistemas, até a loja (seção 4.7). As saídas:
   - segurar a migration até a loja;
   - aceitar a janela;
   - publicar pelo `templates:publish` manual, depois da loja.
4. **A marca da folha de bônus no aparelho, não no servidor** (P05-D §3.8). A folha pode aparecer de novo uma vez num aparelho novo ou depois do logout, e só se nenhum bônus foi gasto. A marca no servidor custa uma rota, a AuthZ do dono, uma decisão sobre a revisão da criação e o `/security-review`.
5. **O "confirme com o narrador" fora da barra** (D-07: "no 'O que falta'"). Ele fica na aba Pontos, na linha da lista e na confirmação de concluir (seção 4.2).
6. **D-06: "o template `vtm-v20` é corrigido" não se aplica** (o mesmo ponto 1 do onda-2.md §6). O V20 já cobra a Qualidade pelo meta `cost`, e a compra com bônus, a recusa na folha e o nome mantido entraram no P07-C. O P07-D entrega o texto da Qualidade sem Custo, a prévia do custo e um teste no servidor.
7. **D-08 nos Dons não se aplica como escrita.** O Dom não tem valor, e o −/+ na linha mexeria no Posto, que a D-07 manda avisar acima de 1. Proposta: a linha mostra "Posto N", e o Posto muda na folha. A alternativa é o −/+ do Posto na linha, num commit à parte.
8. **A Fraqueza "já preenchida" é um padrão mostrado, não um valor gravado** (P07-D §3.5). Gravar na escolha do Clã exigiria a API da Nova ficha aceitar a `weakness`, fora da identidade, e criaria uma "alteração não salva" que o jogador não fez. O texto do jogador, quando ele escreve, vence. O Caitiff e o Órfão ficam sem recomendação: falta decidir se o time escreve um resumo para o Caitiff.
9. **As fichas criadas na versão anterior** ficam sem o catálogo, os selos, a Fraqueza preenchida, as frases novas e a "Casa ou subgrupo" (seção 4.7). Não existe caminho de atualização de versão de ficha.
10. **As frases de poderes** (Disciplinas, Dons, Esferas e Ritos): uma frase curta do time sobre um poder é "descrição", que o README §12 diz ser protegida? Até a resposta do PO e de quem cuida da licença, ficam sem "?".
11. **"Prioridade" e "pontos de bônus" com frase do app, não do template** (D-11: "vinda do template"). São nomes que o app dá às regras do motor (P10-D §3.7).
12. **"Opcional" só na Casa.** Só o Nome é exigido; marcar a Casa sugere que os outros campos são. O P10-D usa o `placeholder` "Opcional" e a frase do "?", sem chave nova (liga com o ponto 5 do onda-1.md §6).
13. **Quem escreve e revisa as frases, e se a onda sai com a ajuda parcial** (a prioridade 1). Sem as frases das opções de identidade, o critério do Iniciante fica mais fraco.
14. **O nome repetido numa lista sem catálogo** ("Ambidestro" duas vezes; onda-3.md §11, achado 7). Proposta do P07-D: aceitar, avisando ("Já há “Ambidestro” na ficha"), com o botão "Adicionar outro". O servidor aceita hoje e continua aceitando.
15. **P05-D:**
    - as frases novas da barra e da aba (rascunho do time);
    - "Orçamento" continua nas regras da crônica (`CreationSettings.tsx:189`), e só a aba da ficha muda;
    - a prioridade aparece no "Faltam" como "Atributos (prioridade)".
16. **A D-00 depois do PR #49.** A decisão era "Android e iOS compilados no CI em todo PR". O PR #49 tirou os jobs, e a tabela de decisões da matriz não registra a revisão ("Decisão revista", em "Como executar"). Esta onda compila o nativo à mão, na integração (seção 2).
17. **P10-C:** ficam fora, por não terem linha na matriz:
    - as partes da R-29 que nenhuma linha pede ("Escolher da lista" no Mago, Foco, Posto e forma);
    - a ordem das Habilidades na ficha (`auditoria-fichas-wod.md` l.151);
    - a correção das fichas já concluídas com a FdV 4/7.

**Pontos das ondas 1 a 3 que tocam esta onda (continuam abertos):**

- **[onda-1.md](onda-1.md) §6:**
  - **ponto 3, "Senhor atualizado" sem o valor (P10-C).** Não muda: é regra do README dos templates;
  - **ponto 5, o template marcar o que a criação exige (P07-D, P10-D).** Sem Clã, o P07-D mostra a lista neutra e "Escolha o Clã para ver as Disciplinas do clã". O P10-D não cria `required` nem `optional`.
- **[onda-2.md](onda-2.md) §6:**
  - **ponto 1, D-06 e o template (P07-D):** é o ponto 6 acima;
  - **ponto 5, o "+" desabilitado (R-20; P07-D e P10-C).** O −/+ da linha e o "−" do inicial seguem o `aria-disabled` tocável dos traços;
  - **ponto 6, o extrato (R-17; P05-D).** O "Faltam" e a aba não trazem extrato;
  - **ponto 7, guardar o texto ao fechar a folha (T-62; P07-D).** A "Adicionar Dom" com o catálogo continua descartando o texto ao fechar;
  - **ponto 9, "Em jogo" recolhido na Criação (T-59; P10-C).** O T-22 corrige o valor, e o bloco continua recolhido como está.
- **[onda-3.md](onda-3.md):**
  - **§6, ponto 3, ficar no Editar depois de salvar.** Não muda; toca a criação livre, não o "Faltam";
  - **§8, pergunta 4:** é o ponto 2 acima.

**Os achados da onda 3 sem pacote** ([onda-3.md](onda-3.md) §11) não entram nos planos. Onde caberiam, para o usuário decidir:

| Achado | Onde caberia | Por quê |
|---|---|---|
| 1. A folha "busy" esperando as rebuscas (revelar NPC, dano em grupo) | Uma correção pequena na onda 5, junto do P13 (ficha em uso) ou num PR próprio | As mutações são do P11 e do P09-C, nenhuma folha desta onda envia, e o efeito no iOS e no web não apareceu. A proposta da onda 3 (fechar no sucesso do POST e invalidar sem `await`) é genérica |
| 2. "Salvar" no Editar leva a Jogo | É o ponto 3 do onda-3.md §6 | Decisão de produto |
| 3. A linha do próximo passo não muda quando a conta fecha | **Resolvido no P05-D** (§3.5, commit 4) | Toca a mesma barra |
| 4. A barra de seleção rola na horizontal a 390 | Nenhum: é o desenho do P09-C §3.6 | — |
| 5. O LogBox do dev build sobre a barra de abas | Nenhum: só no dev build | Nota de roteiro |
| 6. Três "voltar" para sair da crônica (AVD, não repetido) | P12 (navegação, onda 5) | Mesmo tipo do T-39 |
| 7. "Nenhum Qualidade" e "Ambidestro" repetido | **P10-C** (T-66) e **P07-D** (§3.7; ponto 14 acima) | Já cobertos |
| Novo (P10-C, pergunta 8): o resumo de salvar mostra "permanente — → 4" e "0 → 8" quando o campo não tinha valor gravado | P13 (onda 5), ou uma linha nova na matriz | O `describeEvent` também monta o Histórico no servidor (`apps/api/src/sheets/events.ts:618`), e mudá-lo muda a saída da API. O `defaultStored` do P10-C daria o valor certo |

## 7. Causas da matriz corrigidas pela leitura do código

Os planos trazem a lista completa (P05-D §3.0 e §3.8; P07-D §3.0; P10-C §3; P10-D §3.0). As principais:

- **U-07:** a folha não reaparece por ser iOS, nem ao "tirar e repor" na mesma tela, porque o `shown` em `useRef` segura isso. Ela reaparece porque a marca vale por montagem: o `BonusNotice` só monta no modo Criação, sai ao trocar de modo, e cada visita à ficha cria outro store. O caso do PO-A (`po-app.md:88`) veio depois de uma devolução, com 13 de 15 bônus gastos. Acontece em toda plataforma.
- **R-18:** o nome da aba está em `SheetView.tsx:221`, não no `CreationPanel.tsx` l.212-215 que a matriz cita.
- **T-22, a causa "suposta", se confirma e fica precisa.** O `stored(r)` grava o `current` resolvido (`fields/resource.ts:22-37`), e o patch do `ResourceEditorRow.tsx:25-28` parte dele. Gravar só o permanente não serve, porque o `validateSheet` exige o `current`.
- **T-85:** a diferença entre V20 e W20 não é regra. A FdV do V20 só tem o "−" bloqueado quando a Coragem é 1 (o mínimo do template). Com a Coragem em 3, ela desce sem aviso, como a Fúria. O "1 alteração" ao voltar vem do `from: null`. O texto está em `creation.ts:257-258`, não na l.191.
- **U-05 não se confirma** na leitura: o `resolve` e o store calculam a roda sobre o rascunho, e o `defaults.test.ts:457` já prova isso. O plano prende o comportamento com teste e confere no roteiro.
- **T-60:** a ordem vem dos arrays do template, porque o `jsonb` mantém a ordem de array. A ordem da raiz do jsonb do P03-C é outra coisa.
- **T-66:** a regra de gênero também erra "Cicatriz" no W20, o que a matriz não registrou.
- **T-08:** o texto está em `apps/frontend/sheet/creation/creation.ts:255` (`problemText`) e `:467` (`refusalNotice`), não na l.188. A causa (item sem `meta`) foi corrigida no P07-C.
- **R-26:** o mapeamento clã → Disciplinas já existe no V20, só como desconto de XP (`vtm-v20.json:1001-1113`, `itemIn`).
- **T-24:**
  - o aviso do Posto não cabe no `checkCreation`, porque bloquearia ou mudaria o `complete`: ele vai numa função pura ao lado;
  - o Posto 2 passava sem aviso porque o Dom conta por item, e o meta `rank` não entra em nenhuma conta.
- **R-19:** o `help` por campo já existe no contrato, mas os editores da criação não o desenham. O que falta é a frase nas opções, nas sugestões e no catálogo. O problema vale para todas as plataformas, não só iOS e web 390.
- **U-06:** nada exige a Casa. Só o Nome é obrigatório, no `CharacterForm` l.130, no `checkCreation` e na API.

## 8. Perguntas técnicas abertas

A lista completa está na seção 9 de cada plano. Estas cruzam pacotes ou mudam o esforço da onda (⚙ = resposta só no simulador, no aparelho ou no E2E):

| # | Pergunta | Plano | Por que importa para a onda |
|---|---|---|---|
| 1 | ⚙ A altura real da barra com o "Faltam": a medida da onda 3 tinha uma ou duas linhas de texto no iOS e no web? | P05-D, perg. 1 | Decide se o "Faltam" na linha dos botões mantém a altura de hoje. A medida é no AVD a 360, 393 e 411, no SE e no web a 390, com a conta aberta e fechada |
| 2 | A frase do catálogo e das sugestões num mapa por nome, como o P07-D, ou na forma de objeto? | P10-D §3.1; seção 4.3 | M × G no P10-D. A forma de objeto mexe nos consumidores do `itemIn` do XP |
| 3 | Como o `vtm-v20` 1.8.0 chegou a produção sem migration própria? A `0023` é o caminho daqui em diante? | P07-D, perg. 1; seção 4.7 | Com a migration, o template sobe no deploy da API, antes da loja. Liga com o ponto 3 da seção 6 |
| 4 | Quem faz o commit de versão: o fim da branch do P10-D (proposto) ou um commit direto na onda? | P10-D, perg. 6 | "Como executar" põe as correções da integração na branch do pacote. Um commit direto na onda fica fora de toda revisão de pacote |
| 5 | ⚙ O `setAccessibilityFocus` depois de ir ao grupo chega depois da rolagem no iOS e no Android? | P05-D, perg. 2 | Sem ele, o leitor de tela não sabe onde o toque levou |
| 6 | O contador que volta a zero (`from: null` igual ao padrão) vale para todo campo ou só para os com fórmula? | P10-C, perg. 2 | Todo campo muda mais testes e E2E que contam alterações. O P07-D (−/+ na linha) herda a regra |
| 7 | O seed ganha `--fichas-onda4` (Brujah, Lupino e Verbena pela API)? | seção 4.12; P07-D §11.a | Poupa ~10 min por plataforma e tira a Nova ficha do roteiro. Proposta: não |
| 8 | Dons de Posto 2 a 5 no catálogo passam de 200 nomes. Subir o limite agora ou só o nível 1 nesta onda? | P07-D, perg. 4 | Muda o `schema.json` e o validador. Proposta: só o nível 1 |
| 9 | O "?" no `Choice`: uma parada de Tab por opção (14 a mais nos clãs) ou dentro do foco itinerante do grupo? | P10-D, perg. 2 | O teclado no web; o padrão de rádio da APG |
| 10 | O `fold` com ponto de código ou o `Intl.Collator('pt-BR')` para ordenar? | P10-C, perg. 4 | A mesma ordem no Hermes, no web e no Jest × a ordem de dicionário |
| 11 | O "?" também em Leitura e Jogo? | P10-D, perg. 8 | Proposta: só na criação, no Editar e na Nova ficha. As folhas de detalhe já mostram o `help` |
| 12 | ⚙ O cliente do idb continua sem vulnerabilidade conhecida? | seção 10.4 | Conferido nesta etapa: Python 3.15.2, `idb_companion` (build de 22/10/2026) e `fb-idb` 1.7.7 no `~/.venvs/idb-tms`. O `pip-audit` roda de novo antes do roteiro |

## 9. Riscos da onda

- **O conteúdo e a licença atrasam o W20.** Sem a lista de Dons conferida, o commit 8 do P07-D não entra, e o W20 sai com o mecanismo e o texto livre de hoje. O critério de saída do Lobisomem ainda fecha, sem o T-24 completo. O roteiro marca os itens do catálogo como "não conferido", com o motivo (P07-D §11.h).
- **As frases não ficam prontas.** O "?" entra só nos 22 campos que já têm `help`, e o Iniciante continua sem as frases de identidade. O critério de saída fica mais fraco (seção 6, ponto 13).
- **"Atualize o app" no nativo.** Se a `0023` for ao ar com a API antes de a loja ter o app novo, toda ficha nova dos três sistemas fica bloqueada no app antigo (seção 4.7).
- **O `ListEditor.tsx`** é tocado por três pacotes, e a linha é refeita pelo P07-D. Os rebases do P07-D sobre o P10-C e do P10-D sobre o P07-D são os mais caros da integração.
- **O core muda em três pacotes** (P10-C, P07-D e P10-D). Um `dist` velho trava a API, o seed e o `templates:publish` no `check-dev-env`. Na integração, o `pnpm build` vai depois de cada um desses merges.
- **O `@tms/ui` muda em dois pacotes** (`Stepper.decrease` e `HelpButton`). A lição S-01 pede o build nativo e a conferência no aparelho; o Jest não basta. **Sem os jobs nativos no CI (PR #49), o build local da integração é a única prova** de que o app nativo compila. Uma regressão como a do T-01 só aparece se ele rodar.
- **O E2E com o "Ajuda: <campo>".** Todo `getByLabel` sem `exact` de um campo com frase passa a casar dois elementos. Os 10 conhecidos estão na seção 4.11. Um spec escrito em outro pacote desta onda pode criar outro: o P10-D confere todos os specs no rebase.
- **Duas versões do mesmo template em bancos locais:** coberto pela seção 4.6 (um banco por pacote, sem `db:down`).
- **O roteiro do iOS é o mais longo e o que mais falhou na onda 3** (o agente bateu no limite de rodadas). A seção 10.5 o divide em blocos, com o resultado gravado num arquivo a cada bloco.
- **O emulador sob carga** dá falso "busy" e tempos que não são evidência. Por isso o AVD é desligado antes do iOS.

## 10. Testes manuais da integração (web, Android com AVD, iOS com idb)

O roteiro com os quatro pacotes juntos, na `onda/4-conteudo-guia` depois do commit de versão, no formato da §11 dos planos. Cada plano tem a tabela completa dos itens dele (§11.e). Esta seção ordena o que roda na integração:

- o critério de saída da onda;
- os itens que dependem de mais de um pacote;
- os itens obrigatórios por plataforma;
- as pendências do iOS da onda 3.

Só contas e dados fictícios. A senha é a constante do seed e nunca é escrita aqui, num script versionado ou numa captura.

### 10.1 Preparação

**Serviços.**

- `npx pnpm bootstrap`, se o `scripts/check-dev-env.mjs` pedir. Com o core mudado por três pacotes, o `dist` precisa estar novo.
- O banco da integração:
  - `npx pnpm db:up` e `npx pnpm db:migrate`. A `0023` grava as versões novas, e os bancos dos pacotes (`tms_p05d`, `tms_p07d`, `tms_p10c` e `tms_p10d`) podem ser apagados com `dropdb`;
  - `npx pnpm templates:publish --published`, que deve dizer "sem mudança";
  - a conferência de que vtm-v20 1.9.0, mta-m20 1.7.0 e wta-w20 1.7.0 estão publicados.
- API em `npx pnpm dev:api` (porta 3001) e Metro em `cd apps/frontend && npx expo start` (porta 8081).

**Seed, um por plataforma:** `npx pnpm seed:roteiro > <scratchpad>/onda4-seed-<plataforma>.log 2>&1`, com pelo menos 15 min entre dois. O seed apaga a rodada anterior. O que ele cobre e o que o roteiro cria pela tela está na seção 4.12.

**Uma ficha da versão anterior,** para a linha X-versão (10.7):

- antes da `0023`, no banco da integração, uma ficha "Antiga R" em "Vampiro v4", criada pela tela com o template 1.8.0;
- ou, se o banco já migrou, a ficha num banco à parte (`tms_onda4_antes`), migrado até a 0022.

**Evidências:** no scratchpad, com o nome `onda4-<plataforma>-<largura>-<ID>-<passo>.png`, sem e-mail visível.

### 10.2 Web

- **O script:** Playwright Chromium no scratchpad, contra o Metro (8081). Os viewports exatos são 390×844 e 1280×800, e o 360×740 vale para a barra.
- **O WebKit** entra nos itens de Safari: o `normalize('NFD')` da ordem, o `aria-disabled` e o diálogo de 560.
- **Os seletores** são por papel e rótulo, com `exact` onde o texto é ambíguo ("Pontos", "do clã" × "fora do clã", o "Ajuda: <campo>"). As abas da ficha a 390 são "Ficha", "Vantagens", "Sobre" e "Pontos".
- **Um screenshot por passo.**
- **A medida da folha a 1280** é no painel (`bottom-sheet-root > [aria-modal="true"]`), depois da entrada, nunca na camada.

### 10.3 Android (AVD)

- O AVD é o `Pixel_3a_API_34_extension_level_7_arm64-v8a`, a 393 dp, com o APK debug da integração. `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Layout a 360 e a 411 dp:** `adb shell wm density`, com `wm density reset` no fim. A barra, a linha do −/+ e a linha com "?" ficam no fim do bloco, para mexer na densidade uma vez só. A linha do −/+ a 360 roda também com `settings put system font_scale 1.3`, e reset depois.
- **A navegação:** `adb shell input` e `uiautomator dump`.
- **O teclado de software:** `settings put secure show_ime_with_hard_keyboard 1`.
- **O voltar do Android** fecha a folha, não a tela: na `AddItemSheet`, na folha de bônus e no "Escolher da lista".
- **O `input text` não digita acento.** Prefira escolher da lista: o Clã, a Raça e a Tradição são rádios.
- **Tempo medido no emulador sob carga não é evidência.** Folha "busy" no AVD vira nota com a carga da máquina, não achado.

### 10.4 iOS com idb

- **Simuladores:** iPhone SE 3ª geração (iOS 18.x) e iPhone 17 (iOS 26.5). O app é `com.tms.app`.
- **O build Debug** do roteiro usa "Sign to Run Locally" (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`). Sem assinatura, o app não loga, porque o keychain responde `-34018`. O CI continua sem assinatura. O build incremental leva ~10 min, a partir do `apps/frontend/ios/build` da onda 3.
- **O cliente fb-idb:**
  - o venv `~/.venvs/idb-tms` já existe, fora do repositório. Conferido nesta etapa: Python 3.15.2 e `fb-idb` 1.7.7, e o `idb_companion` responde (build de 22/10/2026);
  - **antes de usar, o `pip-audit` roda de novo** no venv;
  - não entra no `package.json` nem no lockfile;
  - o `--companion-path` vai antes do subcomando;
  - o companion fica só local, no socket de domínio. No fim, o `lsof` não mostra nada escutando.
- **Navegação:**
  - `idb ui describe-all` acha o alvo pelo rótulo de acessibilidade, e o toque vai no centro do frame;
  - `idb ui text`, `swipe` e `key`;
  - `idb screenshot`.
- **Limites do idb:**
  - **não faz o gesto de borda:** use o "‹";
  - **não digita fora do ASCII:** prefira escolher da lista, e use nomes fictícios sem acento ("Brujah R");
  - **digita como teclado físico,** e o teclado de software some depois do primeiro texto.
- **O deep link (`tms://`)** pede "Abrir com 'TMS'?": toque "Abrir" pelo idb.
- **Dividido em blocos,** com o resultado gravado em `<scratchpad>/onda4-ios-resultados.md` ao fim de cada bloco (seção 10.5). Na onda 3, o agente do iOS bateu no limite de rodadas antes de gravar as pendências.

### 10.5 Ordem de execução e tempo

1. **E2E completo** (Chromium e WebKit), depois do commit de versão. Com o E2E vermelho, o roteiro manual não começa.
2. **Build do iOS incremental** (~10 min), em segundo plano enquanto o web roda.
3. **Web,** de 2,5 a 3 h. Ordem:
   - o critério de saída (10.6): Vampiro a 390 (I-W, E-W), Mago a 1280 com passada em 390 (E-W) e Lobisomem a 390 (I-W);
   - os itens de mais de um pacote (10.7);
   - os obrigatórios do web (10.9).
4. **Android,** de 3 a 4 h. APK (~3 min), seed novo e a mesma ordem, com Vampiro e Lobisomem a 393 (E-A). O layout a 360 e 411 fica no fim. **O AVD é desligado antes do iOS.**
5. **iOS,** de 4 a 5 h, em quatro blocos, cada um gravado no arquivo de resultados:
   - **bloco 1:** venv, `pip-audit`, seed novo e login no SE;
   - **bloco 2:** o critério de saída no SE (Vampiro e Mago pelo I-A);
   - **bloco 3:** os itens de mais de um pacote e os obrigatórios no SE; depois o iPhone 17 (layout, a folha de bônus e os obrigatórios);
   - **bloco 4:** as pendências da onda 3 (10.8).
6. **Dentro de cada plataforma, a ordem dos fluxos:** Nova ficha (o "?" e os selos da identidade) → Criação (o "Faltam", os traços e o "−" do inicial) → Vantagens (o −/+, o catálogo e a Fraqueza) → a folha de bônus → concluir → Jogo, o dock e a Mesa (N).

No total, de 2 a 2,5 dias de uma pessoa. O build nativo local fica fora dessa conta: o Android leva ~3 min, e o iOS, ~10 min incremental.

### 10.6 Critério de saída: a criação por pontos nos três sistemas

Cada linha só fica "ok" com a ficha concluída de ponta a ponta, sem ajuda de fora da tela, na plataforma em que a persona teve dificuldade. O roteiro é de agente, não da persona: ele confere que o que travou a persona não trava mais, e não substitui o teste com usuários.

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| SAIDA-V20-I | Web 390 (I-W, Tarefa 3, SEQ 2; IW-05, IW-06, IW-09) e iOS SE (obrigatório: I-A, Tarefa 3, SEQ 2; IA-06, IA-07, IA-18, IA-21) | J1 | "Vampiro v4" → Nova ficha "Brujah R" (Clã Brujah, pelo rádio) → abrir o "Ajuda: Clã" → Criar → seguir só o "Faltam" da barra até a conta fechar → Vantagens: 3 Disciplinas pelo "Do clã" → Pontos → bônus → "Concluir criação" | O "?" do Clã com a frase do time; o "Faltam" leva a cada grupo com o foco no título; a folha de bônus aparece uma vez; a aba se chama "Pontos" e a fase está em texto; as Disciplinas "do clã" primeiro; a Fraqueza com o resumo do clã; "A conta fechou: você conclui." e o "Concluir" no lugar do "Faltam"; concluída | `onda4-web390-SAIDA-V20-I-01..10.png`, `onda4-ios-se-SAIDA-V20-I-01..10.png` | Web 390: ok. iOS SE: ok. Nos dois, a Fraqueza fica sem resumo (os resumos não entraram) |
| SAIDA-V20-E | Android 393 (E-A, Tarefa 2, SEQ 5) e web 390 (E-W, Tarefa 2, SEQ 5) | J1 | "Vampiro v4" → ficha nova → prioridades → traços → a FdV no "Em jogo" → Vantagens com o −/+ na linha → uma Qualidade com bônus → concluir | A FdV atual acompanha a permanente (T-22); o "−" da FdV abaixo do inicial explica e não desce (T-85); o −/+ da Disciplina na linha, sem folha; a Qualidade com Custo, paga com bônus, e a recusa (se houver) dentro da folha, com o nome mantido (T-08); "Nenhuma Qualidade" antes da primeira (T-66) | `onda4-and393-SAIDA-V20-E-01..08.png`, `onda4-web390-SAIDA-V20-E-01..08.png` | Web 390: ok, com a "Ficha Pontos R" do seed. Android 393: ok, com a "Brujah R" nova |
| SAIDA-M20 | Web 1280 com passada em 390 (obrigatório: E-W, Tarefa 3, SEQ 6); iOS SE (Iniciante, cobertura nova; PO-A, POA-14, POA-15) | J1 | "Mago v4" → Nova ficha "Verbena R" (Tradição Verbena) → "Casa ou subgrupo" vazia → Criar → Esfera de afinidade → Arete → Esferas → Quintessência no "Em jogo" → concluir | "Casa ou subgrupo" com "Opcional" e o "?"; a ficha abre sem a Casa (U-06); a Esfera "da Tradição" primeiro; uma fora mostra "fora da Tradição: confirme com o narrador" e não bloqueia; a Quintessência = Avatar durante a criação (U-05); a Natureza e o Comportamento em ordem de rótulo (T-60); concluída | `onda4-web1280-SAIDA-M20-01..09.png`, `onda4-ios-se-SAIDA-M20-01..09.png` | Web 1280 e 390: ok. iOS SE: ok, enviada e aprovada. O T-60 da Natureza não se aplica: no M20, o campo é texto livre |
| SAIDA-W20 | Android 393 (obrigatório: E-A, Tarefa 3, SEQ 3; EA-08, EA-14) e web 390 (Iniciante, cobertura nova; PO-W, SEQ 4) | J1 | "Lobisomem v4" → Nova ficha "Lupino R" (Lupino, Ahroun e uma Tribo) → Criar → Fúria → Gnose → "Adicionar Dom" → uma recomendada → uma de Posto 2 → Pontos → concluir | Os rádios de Raça, Augúrio e Tribo com título e "?"; a Fúria começa no mínimo do Augúrio, e o "−" abaixo dele explica (T-85); a Gnose acompanha (T-22); "Adicionar Dom" com os blocos "da Raça", "do Augúrio" e "da Tribo"; o Dom de Posto 2 mostra "confirme com o narrador" na linha e em "Para confirmar com o narrador", em Pontos, sem bloquear; o "Concluir" aparece quando a conta fecha; concluída | `onda4-and393-SAIDA-W20-01..09.png`, `onda4-web390-SAIDA-W20-01..09.png` | Web 390 e Android 393: ok. O aviso do Posto (A2) faltava no web e foi corrigido em `1a1bd4c`; no Android já aparece. O catálogo fica não conferido (commit 8 do P07-D em parte) |

### 10.7 Itens que dependem de mais de um pacote

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| X-faltam-dom | Web 390; Android 393; iOS SE | J1 | "Lupino R" com a conta quase fechada e um Dom de Posto 2 → olhar a barra → Pontos → tocar "Concluir criação" | A barra mostra só o que falta da conta, sem o aviso do Dom (P05-D); em Pontos, "O que falta" e depois "Para confirmar com o narrador: …" (P07-D); a confirmação de concluir traz "1 item para confirmar com o narrador"; concluir funciona (o servidor aceita) | `onda4-<plat>-X-faltam-dom-01..04.png` | Web: falha (A2), corrigida em `1a1bd4c`. Android e iOS SE: ok, depois da correção |
| X-opcao | Web 390 e 1280 (Chromium e WebKit); Android 360 e 393; iOS SE | J1 | "Brujah R" → Vantagens → "Adicionar Disciplina" → ler as opções → abrir o "?" de uma → escolher uma "Outra" | Os blocos "Do clã" e "Outras", cada um na ordem do rótulo (P07-D com o `byLabel` do P10-C); o nome acessível "Potência, do clã" e o "?" com o nome "Ajuda: Potência" (P10-D); cada alvo ≥ 44 (48 no Android); a 1280, o diálogo de 560 medido no painel; a linha nova com o −/+ (sem "?") e "fora do clã: confirme com o narrador" | `onda4-<plat>-X-opcao-01..05.png` | ok em web (Chromium e WebKit, 390 e 1280), Android (360 e 393) e iOS SE. O "?" da Disciplina não existe (o template não tem frase por Disciplina); o "?" de opção foi conferido nos Antecedentes |
| X-versao | Web 390; Android 393 | J1 e N | A ficha nova "Brujah R" e a "Antiga R" (10.1) lado a lado → a identidade, a Fraqueza e as Vantagens das duas | A nova: vtm-v20 1.9.0, com os selos, a Fraqueza preenchida e as frases. A antiga: continua na 1.8.0, sem "Atualize o app", com o −/+ na linha, a ordem, o "Nenhuma", o "Faltam" e a aba "Pontos"; sem os selos e sem a Fraqueza preenchida (seção 4.7). As duas abrem para o N | `onda4-<plat>-X-versao-01..04.png` | Web 390 e Android 393: ok. A "Antiga R" foi emulada: criada pela tela e passada para a 1.8.0 no banco local. Sem a Fraqueza da ficha nova |
| X-derivados | Web 390; Android 393 (dock); iOS SE | J1, depois N | "Lupino R": comprar 1 de Fúria e 1 de Gnose com bônus → "Em jogo" → Salvar → Jogo (dock) → N: crônica → Mesa | "Em jogo" com a Fúria atual = permanente e a Gnose atual = permanente; o dock com "Fúria, 6 de 6"; a Mesa (N) com "6/6" no cartão. O mesmo para a FdV do "Brujah R" (V20) e para a Quintessência do "Verbena R" no "Em jogo" (M20; a Gnose do W20 não está no dock nem na Mesa) | `onda4-<plat>-X-derivados-01..06.png` | Web 390 e Mesa a 1280: ok nos três sistemas. Android: ok no V20 e no W20, com dock e Mesa; o M20 fica não conferido. iOS SE: ok |
| X-barra | Android 360, 393 e 411; iOS SE e 17; web 360 e 390 | J1 | "Brujah R" em Criação com a conta aberta → medir a `mode-bar` → fechar a conta → medir de novo | O "Faltam" na linha dos botões, com itens inteiros e "e mais N"; a altura é a mesma com a conta aberta e fechada (108/104 previstos), com o número de linhas de texto anotado (seção 8, pergunta 1); "A conta fechou: você conclui." e o "Concluir" no lugar do "Faltam" | `onda4-<plat>-X-barra-01..04.png` | Web 360 e 390: 106 px. Android 360, 393 e 411: 110 dp (139 com a fonte a 130%). iOS SE e 17: ~108 pt. A altura é a mesma com a conta aberta e fechada; o texto ocupa 2 linhas |
| X-folha-bonus | iOS SE e 17 (obrigatório: U-07); web 390; Android 393 | J1 | Fechar os básicos (folha) → "Entendi" → Jogo → Criação → tirar um básico e repor → sair da ficha e voltar → tirar e repor | A folha aparece uma vez; nas voltas, não aparece de novo; "Ver Pontos" abre a aba depois de a folha sair (`onClosed`); o foco volta ao "+"; no web, o Esc fecha | `onda4-<plat>-X-folha-bonus-01..06.png` | Web 390: ok, depois de `459ea67` (o E2E achou a folha reabrindo ao recarregar). Android 393, iOS SE e 17: ok |

### 10.8 Pendências do iOS da onda 3 ([onda-3.md](onda-3.md) §11)

Rodam no iPhone SE, no bloco 4 do iOS:

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| O3-P05-C | iOS SE | J1 | T-20 (o aviso na altura do toque); T-55 (some ao subir o Arete, no Mago); R-17 (custo e extrato, como o P05-C entregou); R-28 (toast das prioridades); T-21 (rola e foca o Nome) | Como na tabela do P05-C §7. Os textos do P10-C e do P07-D (o "−" do inicial, a Qualidade sem Custo) aparecem no mesmo lugar do aviso | `onda4-ios-se-O3-P05C-01..06.png` | ok (T-20, T-55, R-17, R-28, T-21) |
| O3-T-19 | iOS SE | J1 | Gastar os 15 de bônus → "Adicionar Qualidade" → um nome → Return | A recusa dentro da folha, com o nome mantido (T-19; o T-08 do P07-D) | `onda4-ios-se-O3-T19-01..03.png` | ok |
| O3-T-26 | iOS SE | J1 | Nova ficha → teclado de software → "Próximo" de campo em campo | O "Próximo" passa ao campo seguinte. Com o idb, o teclado de software some depois do primeiro texto, e o item pode seguir "não conferido", com esse motivo | `onda4-ios-se-O3-T26-01..03.png` | não conferido: o `idb ui text` esconde o teclado de software depois do primeiro texto |
| O3-T-80 | iOS SE | J1 e N | Concluir uma ficha → Histórico | Só "Criação concluída", sem os passos de cada ponto | `onda4-ios-se-O3-T80-01..02.png` | ok (J1 e N) |
| O3-T-04-gesto | iOS SE | J1 | "Salvar e sair" pelo gesto de voltar | **Segue "não conferido":** o `idb ui swipe` não dispara o gesto de borda (6 variações na onda 3). O "‹" já foi conferido na onda 3 | — | não conferido: o idb não faz o gesto de borda |

### 10.9 Itens obrigatórios por plataforma

Eles vêm das §11.e dos planos e rodam na integração mesmo que já tenham rodado no "PR local", porque os merges seguintes mexem nos mesmos arquivos:

| Pacote | Web | Android | iOS |
|---|---|---|---|
| P05-D | R-18a a R-18e (390, 360 e 1280), achado 3, U-07a a U-07c, U-07g | **R-18f** (a barra a 360, 393 e 411), R-18g, U-07f | **U-07d** (a folha no SE e no 17), R-18h, U-07e |
| P07-D | T-08a e b, T-24a a c e f, R-25a a c, R-26a a c e g | **T-24d** (393, EA-14; a folha acima do teclado e o voltar), R-25d (360 com fonte a 130%), R-26e e f | T-08c, T-24e, R-25e, R-26d (IA-07, IA-21) |
| P10-C | T-22, T-60 e T-66 (390 e 1280; Chromium e WebKit) | **T-85** (393, e 360/411), T-22, T-60, T-66 | T-22 (SE e 17), T-85 e T-66 (SE), T-60 (17) |
| P10-D | R-19a a e, **U-06a** (1280), U-06b e c | R-19f (393, 360 e 411), R-19g, U-06c | **R-19h** (SE e 17, IA-06), R-19i, U-06d |

### 10.10 Acessibilidade mínima

A árvore é o DOM no web, o `uiautomator dump` no Android e o `describe-all` no iOS.

- **O "?":**
  - tem o nome acessível "Ajuda: <campo>" (ou "Ajuda: <opção>");
  - abre pelo teclado (Enter e Espaço) e pelo toque;
  - no web, tem `aria-expanded`, e o `aria-controls` aponta um elemento que existe;
  - o texto aberto é lido (`aria-live="polite"` no web).
- **O selo "do clã" / "da Tradição" / "da Raça"** é texto e entra no nome acessível da opção ("Potência, do clã"). O "fora do clã: confirme com o narrador" é texto na linha.
- **O "Faltam: …"** é lido como texto, e cada item é um botão com o nome que começa pelo texto visível ("Virtudes 7: faltam 7 pontos básicos"). O "e mais 2" tem o nome "e mais 2: ver tudo o que falta em Pontos".
- **O −/+ da linha** tem o nome do item:
  - **no web:** "Aumentar Potência" e "Diminuir Potência";
  - **no app:** um controle ajustável "Potência", com o valor "2 de 5";
  - **indisponível:** `aria-disabled` (web) ou a dica (app), sem `disabled`.
- **O indicador de fase** é texto ("Fase: pontos básicos"), não só cor, e não tem `role="radio"`.
- **A aba** se chama "Pontos" nas três árvores.

O anúncio pelo VoiceOver e pelo TalkBack fica para ouvir no aparelho, como nas ondas anteriores:

- a conta que fecha ("A conta fechou. Você pode concluir pela barra.");
- o foco depois de ir ao grupo;
- o aviso na linha.

### 10.11 Limpeza

- Parar a API e o Metro.
- **Android:**
  - `adb shell wm density reset` e `settings put system font_scale 1.0`;
  - `settings put secure show_ime_with_hard_keyboard 0`;
  - `adb reverse --remove-all`;
  - desligar o AVD.
- **iOS:**
  - `xcrun simctl shutdown all`;
  - encerrar o `idb_companion` e conferir que nada escuta (`lsof`);
  - "Connect Hardware Keyboard" de volta ao padrão;
  - desativar o venv, que fica em `~/.venvs/idb-tms`.
- **Dados:**
  - `dropdb` dos bancos dos pacotes e do `tms_onda4_antes`;
  - o próximo seed apaga a rodada.
- **O `git status` não mostra nada novo do roteiro:** scripts, logs e capturas ficam no scratchpad.

### 10.12 Quando uma plataforma não puder ser conferida

O resultado diz "não conferido", com o motivo. Exemplos:

- "o catálogo de Dons não entrou (commit 8 do P07-D esperando a licença)";
- "o `pip-audit` apontou <CVE> sem correção";
- "o idb não faz o gesto de borda";
- "o AVD não iniciou".

Nunca "ok" sem a evidência.

**Onde os resultados entram.** Na integração, a coluna "Resultado" das seções 10.6 a 10.8 é preenchida, e uma seção nova, "11. Integração", entra neste documento, como a §11 do [onda-3.md](onda-3.md). Ela traz:

- os merges e as revisões;
- as perguntas técnicas e o que foi aplicado;
- os achados da integração;
- o resultado das suítes;
- a conferência manual por plataforma.

## 11. Integração (04 e 05/11/2026)

Cada pacote foi implementado em paralelo, por um agente no próprio worktree, e entrou na `onda/4-conteudo-guia` em série, na ordem da seção 2. Antes do merge, o P10-C, o P07-D e o P10-D receberam a onda na própria branch e resolveram os conflitos lá:

- **P10-C:** o "O que falta" passou a `GuideList`, e o texto da origem do inicial chega ao "Faltam" (o `guideItems` recebe a ficha resolvida);
- **P07-D:**
  - o "−" da linha usa o `Stepper.decrease`;
  - os blocos "Do clã" / "Outras" usam o `byLabel`;
  - os avisos viraram o corpo do `useCreationNotices`;
- **P10-D:**
  - o `recommend` e o `help` convivem no mesmo campo;
  - a linha do item fica sem "?";
  - o "?" do saldo fica na aba "Pontos";
  - depois vêm o commit 7 (frase no catálogo e nas sugestões) e o commit de versão.

As correções da integração foram feitas na branch do pacote e entraram na onda por um merge `--no-ff` novo.

| Ordem | Pacote | Merge na onda | Revisão |
|---|---|---|---|
| 1 | P05-D | `b5e7e2e`, `459ea67`, `1458f76`, `ffb1253` | `/code-review` (high): 10 achados; 9 corrigidos no pacote, 1 registrado no §10 (a cadeia de âncoras) |
| 2 | P10-C | `1af28fd` | `/code-review` (high): 10 achados; 8 corrigidos, 2 recusados com o motivo no §10 (a marca "até ser marcado" e o custo do `resolve`, medido em ~2% do toque) |
| 3 | P07-D | `1762d0d`, `821805a`, `1a1bd4c`, `35b1a70`, `a41e25f` | `/code-review` (high): 10 achados, todos corrigidos |
| 4 | P10-D, com o commit de versão | `3599998` | `/code-review` (high) em duas rodadas. A primeira, antes do merge da onda, teve 10 achados: 9 tratados e 1 mantido ("a aba Pontos", que depende do P05-D). A segunda, sobre o merge, o commit 7 e a versão, teve 8 achados: 7 corrigidos e 1 em parte (a validação dentro da migration, abaixo) |

**`/security-review` da onda inteira (`c96f2d4..HEAD`):** nenhuma vulnerabilidade com confiança alta. Foram conferidos:

- **o contrato e os validadores.** O texto novo passa pelo `text()`, que recusa `<`, `>`, controle e bidi. A regra "sem link" e "uma linha" fica na publicação, e a leitura das versões antigas continua tolerante;
- **o `resolve`.** O default por opção lê só chave própria, então `__proto__` não alcança o prototype;
- **o que não mudou:** o `recommend` e o `creationAdvice` ficam fora da conta e do servidor. O `checkCreation`, o `creationFreeze`, o `validateSheet`, o `describeEvent`, a AuthZ e as rotas não mudaram;
- **a `0023`:** só dados, sem SQL concatenado;
- **o texto do template no app:** só em `Text`, sem `dangerouslySetInnerHTML` nem link;
- **a marca `seen:bonus`:** UUID, só `"1"` vale, e ela sai no logout.

**Perguntas técnicas (seção 8): o que foi aplicado.** Sem resposta do time, cada pacote seguiu a proposta do próprio plano. Os desvios estão no §10 de cada plano.

1. **A altura da barra com o "Faltam"** é a mesma com a conta aberta e fechada:

   | Onde | Altura | Linhas de texto |
   |---|---|---|
   | Web a 360 e a 390 | 106 px | 2 |
   | AVD a 360, 393 e 411 | 110 dp (139 com a fonte a 130%) | 2 |
   | iOS SE e iPhone 17 | ~108 pt | 2 |

2. **A frase do catálogo e das sugestões** vai num mapa por nome ao lado da lista (`catalogHelp` e `suggestionHelp`), sem a forma de objeto.
3. **A `0023` é o caminho da versão nova.** A dúvida sobre como a 1.8.0 chegou à produção sem migration segue aberta.
   - A `0023` usa o `publishProductTemplates` novo (`packages/db/src/templates.ts`), e a `0020` ficou como estava.
   - **A validação dentro da migration não entrou.** Ela exigiria que o `@tms/db` dependesse do `@tms/sheet-core` e do Ajv, o que muda o `package.json` e o lockfile.
   - Um teste da API prova que cada arquivo gravado pelas migrations passa pelo schema, pelo contrato, pelo `publicationIssues` e pelo `compileTemplate`. **Fica para decisão.**
4. **O commit de versão** é o `9d1dcb2`, no fim da branch do P10-D. As correções da segunda revisão vieram depois dele, sem reescrever o histórico.
5. **O foco depois de "ir ao grupo"** ficou não conferido nos leitores de tela. O `describe-all` não expõe o foco, e o AVD não tem TalkBack. Os saltos para outra aba (B1, abaixo) foram conferidos no AVD e no iOS.
6. **O contador que volta a zero** vale para todo campo inteiro de `values`. Nenhum teste nem E2E mostrou caso indesejado.
7. **O seed não ganhou `--fichas-onda4`.** As fichas foram criadas pela tela, com o `--fichas-criacao` da onda 3.
8. **Só o nível 1 dos Dons:** o catálogo de Dons entrou depois da integração só com o nível 1 (48 nomes, Posto 1; seção 4.9).
9. **Paradas de Tab:** cada "?" é uma parada; no `Choice`, as setas continuam só nos rádios.
10. **A ordem usa o `fold` com ponto de código.**
11. **O "?" só aparece na criação, no Editar e na Nova ficha.**
12. **O `pip-audit` no venv do idb** não achou vulnerabilidade conhecida (`fb-idb` 1.7.7, Python 3.15.2).

**O que entrou e o que ficou de fora:**

- **Entraram:**
  - as Disciplinas por clã (V20), copiadas do `itemIn` do XP;
  - as Esferas por Tradição (M20);
  - o aviso do Dom acima do Posto 1 (W20, `creation.advice`);
  - as frases do `P10-D-frases.json`, como rascunho do time;
  - **depois da integração (05/11, `7f817c5`), com a decisão do usuário (§4.9):** o catálogo de Dons do W20 (48 nomes de nível 1, Posto 1, recomendados por Raça, Augúrio e Tribo), os 14 resumos da Fraqueza do V20 e as frases das Disciplinas, dos Dons e das Esferas, do [`onda-4-conteudo.json`](onda-4-conteudo.json).
- **Ficaram de fora:**
  - os Ritos (o W20 não tem catálogo de Ritos) e os Dons de Posto 2 a 5.
- **Precisam de revisão antes da `main`:**
  - as frases e os resumos da Fraqueza, por quem conhece cada sistema;
  - **o catálogo de Dons, conferido contra o livro:** foi compilado de memória, e os nomes foram traduzidos pelo time;
  - o mapa Tradição → Esferas, montado a partir de uma fonte só (P07-D §10).

**Achados da integração (commits na onda):**

- **`459ea67` (P05-D, achado pelo E2E): a folha de bônus reabria depois de recarregar.**
  - A memória da sessão fica vazia, e a marca só chega pela leitura assíncrona do aparelho. O `BonusNotice` decidia antes dessa leitura e antes de a conta existir.
  - Agora ele espera as duas.
- **`821805a` (P07-D, achado pelo E2E):** o spec clicava sem `force` num "+" com `aria-disabled`. O erro estava no teste.
- **`1a1bd4c` (P07-D, roteiro web, A2): o `wta-w20` não tinha o `creation.advice` do Posto.**
  - O brief da implementação restringiu demais o commit 8 do P07-D.
  - A regra entrou na 1.7.0, que ainda não saiu da máquina.
- **`1458f76` (P05-D, roteiro web):**
  - **A3: a faixa fixa mostrava as sub-abas e a Prioridade da seção errada a 390,** depois de abrir ou fechar o "Em jogo". No RN-web, o `onLayout` só dispara com mudança de tamanho. O código é da onda 3, e a posição agora é lida de novo quando o conteúdo da rolagem muda de tamanho. O E2E ganhou o passo em `layout.spec.ts`;
  - **A1: o narrador, em Leitura, via e acionava "Usar pontos de bônus agora".** A troca agora só aparece na Criação.
- **`35b1a70` (P07-D, roteiro Android, T-24d):** a folha do Dom não mostrava o aviso do Posto. Agora o aviso acompanha o rascunho da folha.
- **`ffb1253` (P05-D, roteiro Android):**
  - **B1: o "ir ao grupo" para outra aba parava no topo da aba no AVD.** O salto espera um quadro sem medida nova e corrige a rolagem se o destino mudar até 1,5 s depois. Conferido no iOS;
  - **B2: "falta 1 ponto básicos."** Agora o singular e o plural estão certos, também no contador falado e na recusa.
- **`a41e25f` (P07-D, roteiro iOS, A4): o "fora da Tradição" ficava dentro do botão, e o VoiceOver não o lia.**
  - A mesma correção vale para o "Resumo de …" da Fraqueza e para o erro do servidor, que viraram texto à parte.
  - Conferido no Jest; não foi reconferido no iOS.

**Resultado na onda com os quatro pacotes (`a41e25f`):**

| Verificação | Resultado |
|---|---|
| build, typecheck e lint | verdes |
| sheet-core | 1119 testes. O `random.test.ts` (distribuição dos d10 com a fonte real) falhou uma vez numa rodada e passou nas três seguintes; a onda não o toca |
| config | 38 testes |
| db | 39 testes |
| api | 1924 testes (65 `*.pg.test` pulados no PGLite) |
| ui | 226 testes |
| frontend | 1593 testes; `test:coverage` dentro das metas. O Jest pelo `pnpm test` não encerra sozinho também na base `78de35c`; na integração, roda com `--forceExit` |
| `*.pg.test` | 45 testes, no banco `tms_pg_test` |
| E2E Chromium e WebKit | 184 testes, com os specs novos `creation-guide` e `help` e os passos novos de `advantages`, `layout` (A3), `creation-feedback`, `create-character`, `evolve` e `a11y-keyboard` |
| Build nativo local (debug) | Android: `assembleDebug` (arm64). iOS: `xcodebuild` Debug para o simulador, com assinatura local. A onda não muda nada nativo, nem o `package.json` ou o lockfile |

**Conferência manual** (API local com o seed do roteiro; contas `@roteiro.test`, só dados fictícios). O resultado de cada item está nas seções 10.6 a 10.8.

| Onde | Seed | Resumo |
|---|---|---|
| Web 390, 360 e 1280 (Chromium; WebKit nos itens de Safari) | 05/11 00:44 | Os quatro SAIDA ok. A2, A3 e A1 achados e corrigidos. O R-19c não tem "?" em Jogo nem na folha da FdV, e isso é o desenho (pergunta 11) |
| Android, AVD Pixel 3a a 393; layout a 360 e 411, e a 360 com a fonte a 130% | 05/11 01:48 | SAIDA-V20-E e SAIDA-W20 ok. B1, B2 e T-24d achados e corrigidos. O AVD ficou lento (carga de 6 a 29, ANR em tecla) e foi reiniciado com `-cores 4 -memory 3072`, só como opção de execução |
| iOS, simulador iPhone SE (18.1) e iPhone 17 (26.5), pelo idb | 05/11 06:48 | SAIDA-V20-I e SAIDA-M20 ok, e todas as correções do web e do Android ok. A4 achado e corrigido. Da 10.8, o O3-P05-C, o O3-T-19 e o O3-T-80 ok |

**Achados do roteiro manual que ficaram sem correção:**

1. **Recursos no "Adicionar Antecedente" (iOS SE):** o texto do "?" da última opção visível abre abaixo da dobra da folha, e é preciso rolar para ler.
2. **"Faltam" a 375 pt (desenho):** com "Disciplinas 3" como primeiro item, a barra mostra "Faltam 3 itens" em vez de "Disciplinas 3 · e mais 2". A estimativa do `fitGuide` passa da capacidade por 0,1 caractere. Segue a regra do plano, que não corta texto.
3. **"Comportamento" a 360 (web):** o rótulo da identidade quebra no meio da palavra.
4. **Traço no limite do template (onda-2.md §6, ponto 5):** no mínimo e no máximo, o botão usa `disabled` e `tabindex=-1`, sem explicação.
5. **Android:** dentro do controle ajustável, o "−" e o "+" aparecem no dump com `content-desc` "−"/"+", sem o nome do item. Fica para ouvir com o TalkBack.
6. **Histórico (anterior à onda):** o N tem "Desfazer" no lote de criação da J1 mesmo com a ficha já aprovada.
7. **Higiene no iOS:** no login do bloco 4, a senha do seed caiu no campo E-mail pelo teclado de software. O `describe-all` do driver mostrou o valor na saída do terminal da sessão.
   - Ela não foi para nenhum arquivo, captura ou relatório.
   - O driver passou a esconder o valor dos campos E-mail e Senha.
   - É a constante fictícia do seed, que pode ser trocada.

**O que ficou não conferido, e por quê:**

- **O catálogo de Dons e a Fraqueza com o resumo** (T-24a, T-24f, R-26c, os blocos do T-24e): o conteúdo entrou depois do roteiro (`7f817c5`). Ficam para a próxima conferência manual; o Jest e o E2E (`journey-werewolf`) cobrem os blocos e o Posto 1.
- **O "?" da Disciplina:** o template não tinha frase por Disciplina no roteiro. O "?" de opção foi conferido nos Antecedentes.
- **Os anúncios do VoiceOver e do TalkBack e o foco no título** (R-18g e a 10.10): o AVD não tem TalkBack, e o `describe-all` não expõe o foco.
- **O3-T-26 e O3-T-04-gesto:** limites do idb.
- **No Android, por tempo, com o AVD lento:**
  - a Quintessência do M20 no "Em jogo";
  - o T-24d a 360;
  - a Humanidade no T-85;
  - "Nenhuma Cicatriz";
  - o "?" pelo teclado.
- **O A4 no iOS depois da correção:** só no Jest.

**Fica para depois da integração local:**

- os pontos para o PO da seção 6 e das ondas 1 a 3, que continuam sem decisão;
- **a validação dentro da `0023`** (pergunta 3, acima);
- **o conteúdo:**
  - a revisão das frases, dos resumos da Fraqueza e do mapa Tradição → Esferas;
  - a conferência do catálogo de Dons contra o livro (a licença não bloqueia mais: §4.9);
- o anúncio pelo VoiceOver e pelo TalkBack, para ouvir no aparelho;
- push da onda e PR para a `main`, com uma seção por pacote.

## 12. Funcionalidades que entraram

O que a onda entrega, do ponto de vista de quem usa. A ponta é a `onda/4-conteudo-guia` em `282fbf8`.

### 12.1 Guia da criação (P05-D)

- **"Faltam" na barra de criação.** Enquanto a conta está aberta, a barra mostra o que falta (por exemplo, "Faltam: Virtudes 7 · e mais 2"), no lugar do "Concluir criação".
  - A linha mostra só itens inteiros, mais "e mais N".
  - Se nenhum item cabe, ela vira "Faltam N itens".
  - A altura da barra não muda.
- **Ir ao grupo.** Cada item do "Faltam" e do "O que falta" é um botão. Ele leva à aba, à sub-aba e ao grupo, e põe o foco no título.
  - "e mais N" leva à aba Pontos.
  - No Android, o salto para outra aba espera a medida final.
- **Aba "Pontos".** A aba "Orçamento" da ficha passa a "Pontos". Ela traz:
  - o "O que falta", tocável;
  - o bloco "Para confirmar com o narrador";
  - "Ver Pontos" na folha de bônus.

  As regras da crônica continuam com o nome "Orçamento".
- **Conta fechada.** A linha do próximo passo diz "A conta fechou: você conclui." (ou "envie ao narrador", com aprovação), e o "Concluir criação" aparece no lugar do "Faltam".
- **Fase em texto.** A aba mostra "Fase: pontos básicos" ou "Fase: pontos de bônus".
  - A troca manual é um botão secundário.
  - Ela só aparece para quem edita a criação, nunca em Leitura.
- **Folha de bônus uma vez por ficha.** A folha "Começaram os pontos de bônus" aparece só na primeira passagem.
  - Ela não volta ao tirar e repor um ponto, ao trocar de modo, ao sair e voltar nem ao recarregar.
  - A marca fica no aparelho e sai no logout.

### 12.2 Vantagens (P07-D)

- **−/+ na própria linha** dos itens com valor (Disciplinas, Antecedentes, Esferas): sem abrir folha, com o aviso de recusa perto do toque.
  - A folha do item fica com o nome, as metas, a especialização e as notas.
  - Os Dons mostram "Posto N", e o Posto muda na folha.
- **O que é do clã ou da Tradição.** No V20, as Disciplinas do clã têm o selo "do clã". No M20, a Esfera da Tradição tem o selo "da Tradição".
  - Na folha "Adicionar", elas vêm primeiro, no bloco "Do clã".
  - A escolha de fora mostra "fora do clã: confirme com o narrador" e não bloqueia.
  - Trocar o Clã ou a Tradição atualiza os selos na hora.
- **Aviso do Posto no W20.** Um Dom acima do Posto 1 mostra "confirme com o narrador" em três lugares, sem bloquear:
  - na linha e na folha do Dom;
  - em "Para confirmar com o narrador", na aba Pontos;
  - na confirmação de concluir.
- **Catálogo de Dons no W20.** A "Adicionar Dom" abre com os Dons de nível 1 da Raça, do Augúrio e da Tribo escolhidos, em três blocos ("Da Raça · Hominídeo", "Do Augúrio · Galliard", "Da Tribo · Fianna"). São 48 nomes, e o resto vem pela busca.
  - O Dom do catálogo nasce com Posto 1, e um Dom de duas fontes mostra os dois selos.
  - O nome livre continua: "Adicionar “…”".
  - Um Dom fora dos três mostra "fora da Raça, do Augúrio e da Tribo: confirme com o narrador" e não bloqueia.
  - O catálogo foi compilado de memória e precisa ser conferido contra o livro antes da `main`.
- **Fraqueza com o resumo do clã.** Com o Clã escolhido e a Fraqueza vazia, o campo mostra o resumo do time para o clã (os 14 clãs, com o Caitiff), com "Usar o resumo do clã". O texto do jogador vence, e nada é gravado sozinho.
- **Folha "Adicionar":**
  - a prévia do custo do item novo;
  - o aviso de nome repetido ("Já há “Ambidestro” na ficha"), com "Adicionar outro";
  - a Qualidade sem Custo, com o texto certo.
- **Leitor de tela.** Os avisos "fora do clã", "fora da Tradição" e "Resumo de …" são texto à parte, lido pelo VoiceOver e pelo TalkBack.

### 12.3 Derivados, ordem e textos (P10-C)

- **O atual acompanha o permanente** na criação: Força de Vontade, Fúria, Gnose e Quintessência.
- **Voltar ao valor de partida tira a alteração** da contagem ("1 alteração" some).
- **O "−" no valor inicial** (a Fúria pelo Augúrio, a Força de Vontade pela Coragem) fica com cara de indisponível e continua tocável.
  - O toque explica: "Na criação, não fica abaixo de N (vem de …)".
  - Segurar o "−" para no valor inicial.
- **Listas de escolha na ordem do rótulo,** a mesma no web, no Android e no iOS.
- **A lista vazia concorda em gênero:** "Nenhuma Qualidade", "Nenhum Defeito", "Nenhuma Cicatriz".
- **Singular e plural certos:** "falta 1 ponto básico", "faltam 3 pontos básicos".

### 12.4 Ajuda contextual e Mago (P10-D)

- **"?" com uma frase curta** em quatro lugares: campos, opções de identidade (Clãs, Raças, Augúrios, Tribos, Tradições e Essências), grupos de seção, e Antecedentes no catálogo e nas sugestões.
  - Ele abre na própria linha, sem janela, e é lido pelo leitor de tela.
  - O nome acessível é "Ajuda: <campo>".
  - Só aparece na Criação, no Editar e na Nova ficha.
- **"?" em "Prioridade" e no saldo dos pontos de bônus,** com frases do app.
- **Item fixo com frase:** a Ressonância do M20 mostra a frase no topo da folha.
- **"Casa ou subgrupo" no Mago,** com o `placeholder` "Opcional", em todas as Tradições. A ficha abre sem a Casa.
- **Frases:** são 141 (2 do app, 43 do V20, 48 do W20 e 48 do M20), vindas do [`P10-D-frases.json`](P10-D-frases.json). São rascunho do time e esperam revisão antes da `main`.
- **Frases de poderes** (do [`onda-4-conteudo.json`](onda-4-conteudo.json), com a decisão do usuário de 05/11, §4.9):
  - as 17 Disciplinas, no "?" da "Adicionar Disciplina" e no topo da folha do item;
  - os 48 Dons do catálogo, no mesmo lugar;
  - as 9 Esferas do Mago, no "?" de cada campo de Esfera e de cada opção da Esfera de afinidade.

  São rascunho do time, para revisão. Os Ritos ficam sem frase.

### 12.5 Para quem mantém templates e componentes

- **Contrato do template.** As chaves novas são opcionais e aditivas:
  - `recommend`;
  - `catalogDefaults`;
  - `default` por opção em texto;
  - `creation.advice` (`item-meta-max`);
  - `help` nas opções, nos grupos e nos itens fixos;
  - `catalogHelp`;
  - `suggestionHelp`.

  A regra é a mesma no `schema.json`, no `validateTemplate`, no `validate.mjs` e no `publicationIssues`: até 200 caracteres, uma linha, sem link, e nome do mapa só da lista. O `compileTemplate` continua aceitando as versões antigas.
- **Core (`@tms/sheet-core`):**
  - `recommendedFor`, `recommendedBySource` e `creationAdvice`, fora de `problems`, que o servidor não chama;
  - `editResource` e `defaultStored`;
  - o `default` por opção no `resolve`;
  - o `help` no `CompiledGroup`.
- **`@tms/ui`:**
  - `Stepper.decrease`, com o tipo `StepperAdvice` (o `StepperIncrease` continua como alias);
  - `HelpButton`, `HelpText` e `WithHelp`;
  - `help` no `Choice` e no `TextField`.

  Tudo isso está documentado no `design/design-system/components.md`.
- **Banco:** `publishProductTemplates(db)` em `packages/db/src/templates.ts`, e a migration `0023_templates_onda4.ts`, só de dados.

### 12.6 Templates publicados

| Template | Versão | O que muda no conteúdo |
|---|---|---|
| `vtm-v20` | 1.8.0 → **1.9.0** | Disciplinas por clã (`recommend`), o resumo da Fraqueza por clã (`weakness.default`), frases de campos, grupos, Clãs, Antecedentes e Disciplinas, e a revisão dos `help` de hoje |
| `wta-w20` | 1.6.0 → **1.7.0** | catálogo de Dons de nível 1 (`catalog`, `catalogDefaults`, `recommend` e `catalogHelp`), aviso do Posto acima de 1 (`creation.advice`), frases de campos, grupos, Raças, Augúrios, Tribos e Antecedentes |
| `mta-m20` | 1.6.0 → **1.7.0** | Esferas por Tradição (`recommend`), "Casa ou subgrupo" opcional, frases de campos, grupos, Tradições, Essências, Antecedentes e Esferas |

- **Fichas criadas antes** continuam na versão em que nasceram e abrem no app novo. Elas ganham tudo o que é código:
  - o −/+ na linha;
  - o "Faltam";
  - a aba "Pontos";
  - a ordem;
  - o "?" nos campos que já tinham `help`.
- **Fichas novas** nascem na versão nova.

### 12.7 O que não entrou

- **O catálogo de Dons, os resumos da Fraqueza e as frases de poderes entraram** depois da integração (`7f817c5`), com a decisão do usuário de 05/11 ("não precisa de licença, pois tudo que envolve ficha é free to use"; §4.9). Continuam rascunho do time, para revisão, e **o catálogo de Dons precisa ser conferido contra o livro antes da `main`**: foi compilado de memória, e os nomes foram traduzidos pelo time.
- **Os Ritos** (sem catálogo nem frase) e **os Dons de Posto 2 a 5.**
- **A validação dentro da migration `0023`,** que fica para decisão (seção 11, pergunta 3).
- **O P14-D e o P15-D,** que a matriz acrescentou à onda em 03/11 (seção 6, ponto 1).
