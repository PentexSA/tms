# P10-D · Template: ajuda contextual e campos do Mago: plano de implementação

> Plano · 2026-11-04 · base conferida: `onda/4-conteudo-guia` em `c96f2d4` (o código citado é o do `3cc07f1`: os PRs #48 e #49, que vieram depois, só mudam o CI, o CLAUDE.md, os `*.pg.test` e uma config temporária do E2E)

Este plano implementa o pacote [P10-D da matriz de achados](../testes/2026-11-01/matriz-achados.md#p10-d), da onda 4, que aplica as decisões D-11 e D-12. Ao fim do pacote:

- todo campo, grupo e opção de lista que tem frase no template mostra um "?" com nome acessível "Ajuda: <nome>", que abre pelo toque, pelo teclado e pelo leitor de tela;
- os campos que já têm `help` no template (7 no V20, 7 no W20, 8 no M20) passam a mostrar a frase também na criação e no Editar, onde hoje ela não aparece;
- o template ganha `help` nas opções de `choice`, `tags` e `state`, nos itens `fixed`, nos grupos de seção, nas sugestões de texto e nos itens de catálogo, com limite de tamanho e de formato no `schema.json` e no validador;
- a Casa do Mago passa a "Casa ou subgrupo", com a indicação de que é opcional, em todas as Tradições.

É um pacote de decisão de produto. O mecanismo é genérico; as frases são conteúdo de cada sistema, escritas pelo time, sem texto literal de livro. Este plano **não escreve frase de termo de jogo**: ele conta quantas faltam, por sistema, e diz quem escreve e em que ordem. O pacote não remove campo, não esconde campo, não muda regra do jogo e não afrouxa limite:

- a Casa continua em todas as Tradições, com o mesmo limite de 60 caracteres;
- a frase de ajuda é texto de apresentação: não entra em `sheet_data`, na conta da criação nem na política de escrita;
- a publicação de template continua só por script do dono, com o `schema.json` (Ajv) e o `validateTemplate` no servidor, que segue como autoridade.

Todas as linhas citadas são do `3cc07f1` (a `main` depois da onda 3, PR #42, e das fases 1 a 3 da observabilidade). A matriz cita o `1db3db9`, de antes das ondas 1 a 3. Onde a causa provável da matriz não vale, a seção 3.0 diz.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md), "Decisões de produto" (D-11, D-12), "Como executar" (com "Ondas empilhadas"), "Onda 4" e §P10-D | Itens, decisões, "PR local" e critério de saída da onda |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §1 (C3), §4.1 (passo 6), §7 ("Campos da identidade") e a recomendação R-19 | Causa e recomendação |
| Notas: [iniciante-web](../testes/2026-11-01/notas/iniciante-web.md) (IW-06, IW-09), [iniciante-app](../testes/2026-11-01/notas/iniciante-app.md) (IA-06), [experiente-web](../testes/2026-11-01/notas/experiente-web.md) (EW-21) | Cenários do critério de pronto (§7) e do roteiro manual (§11) |
| Screenshots: `img/iniciante-app/19-lista-natureza-ios.webp`, `img/iniciante-web/33-criacao-atributos-390.webp`, `img/experiente-web/63-nova-ficha-mago-1280.webp` | A lista de Natureza só com nomes (chips); a Nova ficha do Mago com "Casa" ao lado de "Conceito" |
| [avaliacao-ui-ux.md](../avaliacao-ui-ux.md) C-18 (l.523-528) e TL-19 (l.1961-1979) | Licença (o template traz os nomes, a mesa escreve a descrição) e o "glossário único no template" |
| [auditoria-fichas-wod.md](../auditoria-fichas-wod.md) l.151, l.162 e l.164 | Catálogos incompletos; Dons e Ritos sem catálogo por licença; a Casa como extra útil |
| [design/templates/README.md](../../design/templates/README.md) §2 (l.68: limites de texto), §3 (l.82, l.218-266), §11 e §12 (licenças) | Contrato que este pacote estende |
| [arquitetura-motor-de-ficha.md](../arquitetura-motor-de-ficha.md) §5.3 e §6 | O template novo só é publicado depois do app que o entende; a árvore de renderização |
| [onda-1.md](onda-1.md) §6 (ponto 5); [onda-2.md](onda-2.md) §6; [onda-3.md](onda-3.md) §4.6, §6, §8 e §11 | Pontos para o PO em aberto (o template marcar o que a criação exige), as regras das folhas e as receitas do roteiro manual |
| [P06](P06-componentes-acessibilidade.md) §2 (linha D-11), §3.1 e §3.14; [P08](P08-layout-teclado.md) §3.14; [P05-C](P05-C-feedback-conta.md) §2 e §3 | O título do `Choice` em linha própria, o modelo de "o que muda" e a recusa perto do toque, que o "?" não pode atrapalhar |

## 1. Objetivo e itens

**Objetivo (matriz).** Cada campo e opção tem uma frase de ajuda vinda do template, respeitando a licença; a Casa do Mago aparece onde a regra pede (pela D-12: em todas as Tradições, como "Casa ou subgrupo", opcional).

| ID | Sev. | Em uma linha | Onde está (conferido) |
|---|---|---|---|
| R-19 | média | Nenhum termo do jogo tem explicação nas telas da criação, nem nas listas de escolha; os iniciantes escolheram Clã, Natureza e Disciplinas "pelo som do nome" | O contrato já tem `help` por campo (`schema.json:479`, `$defs/helpText` em `:208-212`, até 400; `validate/template.ts:386`), mas os editores da criação não o desenham: `evolve/NumberEditorRow.tsx:157-191` (o `EditorShell` não recebe ajuda), `evolve/ChoiceEditorRow.tsx:26-80`, `editors/ChoiceEditor.tsx:9-18`, `evolve/ListEditor.tsx:115-160` e `evolve/ResourceEditorRow.tsx:82`. Só `editors/TextEditor.tsx:50`, `evolve/TextEditorRow.tsx:108` (como `hint`), `views/FieldDetail.tsx:20` e `views/resource/ResourceSheet.tsx:160` (folhas do modo Jogo) mostram a frase. As opções não têm onde guardar frase: `choice` (`schema.json:1241-1263`, `additionalProperties: false`), `tags` (`:1275-1291`), `suggestions` (`:1202-1208`, só textos) e `catalog` (`:1308-1314`, só textos) |
| U-06 | baixa | A Nova ficha do Mago mostra "Casa" para qualquer Tradição, como se fosse da regra | `design/templates/mta-m20.json:67` (`"house": { "type": "text", "label": "Casa", "maxLength": 60 }`), na coluna da identidade `:20` e na seção `about-facts` `:609`. Nada exige o campo: a Nova ficha só exige o nome (`sheet/CharacterForm.tsx:130`), o `checkCreation` não olha os textos da identidade (`packages/sheet-core/src/creation.ts:310-360`) e a API só confere o nome (`apps/api/src/sheets/routes.ts:170`) |

## 2. Decisões aplicadas

**D-11 (R-19): "?" em cada campo e em cada opção de lista, com frase curta do template, escrita pelo time.** O código acomoda assim:

- **Contrato.** O `help` por campo já existe. O pacote acrescenta `help` nos nós que ainda não têm: opções de `choice`, `tags` e `state`, itens `fixed` de `list`, grupos de seção, sugestões de `text` e itens de `catalog` (§3.1). Limite próprio para a frase curta: até 200 caracteres, texto seguro de uma linha, sem link (§3.1).
- **Tela.** Um componente genérico do `@tms/ui`, o "?" com o texto que se expande na própria linha (padrão *disclosure*), usado pelos editores da criação e do Editar, pelo `Choice`, pelas folhas de lista e pelos títulos de grupo (§3.2 a §3.6). Sem folha nova: nada da `BottomSheet` muda.
- **Entrega parcial.** Campo, grupo ou opção sem frase não mostra "?". O mecanismo pode entrar com poucas frases, e as outras entram por template, sem código (§3.8).
- **Licença.** A mesma regra da Fraqueza (D-09): frase escrita pelo time, com palavras próprias, sem trecho de livro. As frases de poderes (Disciplinas, Esferas, Dons e Ritos) esbarram no README §12 ("descrições ... são protegidas") e ficam como ponto para o PO (§9, ponto 2).

**Onde a D-11 não se aplica como está escrita (apontado, não decidido):**

- **"Prioridade" e "pontos de bônus" não são termos do template.** São nomes que o app dá às regras `priority-budget` e `freebies` do motor (`sheet/creation/CreationCounter.tsx:62`, `:115`; `sheet/creation/CreationPanel.tsx:213-214`, `:322`). A frase deles descreve a mecânica do app, não o livro, e mora no texto do app, junto do rótulo. O plano propõe assim (§3.7) e leva ao PO (§9, ponto 1).

**D-12 (U-06): "Casa ou subgrupo", opcional, em todas as Tradições; nenhum campo escondido.** O campo continua o mesmo (`house`, `text`, 60). Mudam o rótulo, um `placeholder` "Opcional" (chave que o contrato já tem e que a Nova ficha e o Editar já desenham) e a frase de ajuda (§3.9). A recomendação da matriz (campo condicionado à Tradição) foi descartada pela D-12.

**Fica fora:**

- o template marcar o que a criação exige (o Clã, [onda-1.md](onda-1.md) §6, ponto 5) segue como ponto para o PO. Este pacote não cria `required` nem `optional` no contrato (§9, ponto 3);
- o progresso na Mesa e o Orçamento em leitura para o narrador são do P09-D (D-10, onda 5);
- os planos alinhados com a tela são do P01-D (D-13, onda 5);
- o extrato da conta na ficha concluída (R-17) segue como ponto do PO ([onda-2.md](onda-2.md) §6);
- o catálogo de Dons, as Disciplinas do clã e a Fraqueza preenchida são do P07-D (D-07, D-09); a ordem das listas e o texto da lista vazia, do P10-C (T-60, T-66). Os conflitos estão na §8.4;
- os pontos para o PO das ondas 1 a 3 continuam em aberto e não são tratados aqui.

## 3. Desenho por item

### 3.0 O que o código, o template e as plataformas fazem hoje

- **O `help` já existe, mas só em parte da tela.** O IW-06 percebeu isso ("o template já tem `help` em alguns campos, que não apareceu na tela"). Quem desenha hoje:
  - campos de texto, como `hint` do `TextField`, sempre visível (`editors/TextEditor.tsx:50`, `evolve/TextEditorRow.tsx:108`);
  - as folhas do modo Jogo (`views/FieldDetail.tsx:20`, `views/resource/ResourceSheet.tsx:160`);
  - atalhos de rolagem, ações e recuperações (`dice/DiceSheet.tsx:151-153`, `play/ActionsMenu.tsx:79-81`, `chronicles/OperationSheet.tsx:201`), e as opções da crônica (`CampaignBackstage.tsx:346-347`).

  Quem não desenha: a linha de número, traço e recurso do Editar e da criação (`NumberEditorRow`, `ResourceEditorRow`, ambos pelo `EditorShell`), a escolha (`ChoiceEditor`, `ChoiceEditorRow`) e a lista (`ListEditor`). Por isso o Talento Consciência e a Virtude Consciência, que já têm frase (`vtm-v20.json:265`, `:488`), aparecem iguais na criação.
- **Os `help` de hoje misturam quatro tipos de texto.** Dos 22 campos com `help` nos três templates:
  - glossário (Talento × Virtude Consciência; Arete, `mta-m20.json:347`);
  - instrução de preenchimento (Fraqueza, `vtm-v20.json:509`; Qualidades e Defeitos);
  - nota de regra (Força de Vontade, Renome);
  - nota de desenho, que hoje já aparece ao jogador na folha da Gnose: "Recurso par da Fúria: cor quase neutra e preenchimento hachurado…" (`wta-w20.json:491`).

  Com o "?" nos editores, esses textos ficam mais à vista. O pacote revê os 22 junto das frases novas (§3.8).
- **As listas de escolha.** Os 14 clãs (`Choice`, 2 colunas a partir de 8 opções, `packages/ui/src/Choice.tsx:35`, `:55`); os 42 Arquétipos de Natureza e de Comportamento, em chips (`editors/Suggestions.tsx:20-48`, folha "Escolher da lista" em `:51-92`); as Disciplinas e os Antecedentes do catálogo, em linhas da `AddItemSheet` (`evolve/ListEditor.tsx:186-316`).
- **O `validateTemplate` do core não confere as chaves dentro das opções.** Ele confere as chaves do campo (`validate/template.ts:73-130`, `keys` em `:276-281`), mas as opções passam por `objs` sem lista de chaves (`:595-610`). O Ajv da publicação confere tudo (`apps/api/src/templates/publish.ts:52-82`). Consequência para o app antigo, usada na §3.10: uma chave nova **dentro de uma opção** não derruba o app antigo; uma chave nova **no campo**, ou uma sugestão que deixa de ser texto, derruba ("Atualize o app").
- **A ficha guarda a versão do template em que nasceu** (`packages/db/src/migrations/0011_character_sync.ts:3-9`), e a API serve essa versão (`sheets/routes.ts:372`, `:432`). Ficha nova usa a mais recente (`:99`, `:151`, `:278`). O app compila e guarda por `system@version` (`sheet/data.ts:103-159`; `compile.ts:115-131`).
- **Os templates do produto vão ao banco por migration** (`0020_product_templates.ts:5-9`: "Uma versão nova de template ganha a sua migration, igual a esta") e pelo `pnpm templates:publish --published`, na ordem `vtm-v20`, `mta-m20`, `wta-w20` (`packages/db/src/templates.ts:11`). Versão publicada é imutável: o mesmo `system@version` com outro conteúdo é recusado (`publish.ts:104-114`).
- **A Casa.** Nada a exige (§1). O E2E do Mago já cria um personagem da Sociedade do Éter com Casa preenchida (`e2e/tests/journey-mage.spec.ts:71-73`), e a auditoria a lista como extra útil (`auditoria-fichas-wod.md:164`).

**Causas da matriz corrigidas:**

- **R-19, "Arquivo provável".** Não falta o campo `help` no template: ele existe desde a v0. Faltam o desenho nos editores da criação e o lugar da frase nas opções, nas sugestões e no catálogo.
- **R-19, "Plataforma: iOS, web 390".** O código é o mesmo nas três plataformas e em todas as larguras.
- **U-06, "a Nova ficha pede Casa".** O campo só aparece; nenhuma camada o exige. O que confunde é o rótulo, que sugere a Casa Hermética.

### 3.1 R-19 · O contrato: onde a frase pode aparecer (o que muda no `schema.json`)

Uma definição nova, a frase curta, e a mesma regra de "sem link" no `helpText` que já existe:

```json
"helpShort": {
  "description": "Frase curta de ajuda (texto puro de uma linha, até 200 caracteres, sem link). Escrita pelo time, nunca trecho de livro (README §12). Sempre desenhada como texto.",
  "$ref": "#/$defs/safeText",
  "maxLength": 200,
  "not": { "pattern": "(://|www\\.)" }
}
```

| Nó | Hoje | Depois | App antigo (§3.10) |
|---|---|---|---|
| Campo (`fieldBase.help`, `:479`) | `helpText`, 400 | o mesmo, com o `not` de link no `helpText` (`:208-212`). Nenhum template tem link hoje (conferido com grep) | abre |
| Opção de `choice` (`:1243-1260`) | `id`, `label`, `meta`, `glyphParam` | + `help: helpShort` | abre (o core não confere chave de opção) |
| Opção de `tags` (`:1277-1288`) | `id`, `label`, `roll` | + `help` | abre |
| Opção de `state` (`:1107-1125`) | `id`, `label`, `hint`, `note`, `modifiers` | + `help` | abre |
| Item `fixed` de `list` (`:1315-1331`) | `id`, `label`, `meta` | + `help` | abre |
| Grupo de seção (`section.groups`, `:1473-1486`) | `id`, `title`, `fields` | + `help` | abre |
| Sugestão de `text` (`:1202-1208`) | texto | texto **ou** `{ "label", "help"? }` | "Atualize o app" no template que usar a forma de objeto |
| Item de `catalog` (`:1308-1314`) | texto até 80 | texto **ou** objeto `{ "name", "help"?, … }`, com a forma que o P07-D definir para o nível do Dom (§8.4) | "Atualize o app" no template que usar a forma de objeto |

**O que não entra:**

- HTML, markdown ou link. O `safeText` já proíbe `<`, `>`, controles e bidi (`:192-197`). O `not` proíbe `://` e `www.`. Markdown não é interpretado: a frase sai num `<Text>` do RN, como os rótulos;
- quebra de linha: a frase é de uma linha, como todo texto do template (README §2, l.68);
- ajuda em `creation.budgets` (os grupos 7/5/3): "Prioridade" é do app (§3.7).

**No core (`packages/sheet-core`), o que muda junto:**

- `contract/fields.ts`: `help?` em `ChoiceOption` (`:239`), `TagOption` (`:251`), `StateOption` (`:200`) e `ListFixedItem` (`:282`); `TextField.suggestions` (`:231`) e `ListField.catalog` (`:292`) passam a `readonly (string | Suggestion)[]` e `readonly (string | CatalogEntry)[]`; `contract/template.ts:22-26`: `help?` em `SectionGroup`.
- Dois ajudantes puros, exportados: `entryName(e)` (o nome de uma sugestão ou de um item de catálogo, nas duas formas) e `entryHelp(e)`. Quem hoje compara texto passa a comparar o nome:
  - `validate/template.ts:313-314` (o item de lista citado por `from`);
  - `validate/template.ts:404-412` (sugestões: texto, tamanho, repetição);
  - `validate/template.ts:611-613` (catálogo);
  - `accounting.ts:74-75` (`itemIn`, só nome do catálogo conta);
  - no app, `evolve/ListEditor.tsx:210-211` e `editors/Suggestions.tsx:33-34`.
- `validate/template.ts`: `text(path, help, 200)` e a regra de link em cada nó novo; o mesmo nome não pode aparecer duas vezes numa lista; **o mesmo nome em duas listas do mesmo template tem a mesma frase** (Natureza e Comportamento usam os mesmos 42 Arquétipos: sem isso, as duas cópias divergiriam com o tempo).
- `validate.mjs` (`design/scripts/validate.mjs`): o mesmo, para o CI do design.

**A validação na publicação passa a checar o campo novo.** As duas camadas que o `publishTemplate` já roda (`publish.ts:94-104`: Ajv com o `schema.json`, depois `validateTemplate` e `compileTemplate`) recusam frase grande, com `<`, com controle, com link, ou nome repetido com frases diferentes. A recusa diz o caminho e o motivo, nunca o texto (`publish-template.ts:40-48`). Isso pede teste Bun em PGLite no `publish.test.ts` (§4.1).

**Se o P07-D já tiver trocado o `catalog` pela forma de objeto** (nome e nível do Dom, D-07), este pacote só acrescenta `help` à forma dele. Se não, as sugestões e o catálogo ficam para o fim do pacote, num commit próprio (§8.1, commit 7), e o resto da ajuda entra sem eles.

### 3.2 R-19 · O "?" no `@tms/ui` (o que muda na API pública)

Dois componentes novos, sem template e sem sheet-core, como pede o `@tms/ui` (`packages/ui/src/index.ts:1-3`):

| Componente | Props | O que faz |
|---|---|---|
| `HelpButton` | `subject: string`, `expanded: boolean`, `onToggle: () => void`, `controls?: string`, `testID?` | `Pressable` com papel `button`, alvo mínimo do `Pressable` (44 no iOS e no web, 48 no Android: `Pressable.tsx:58`, `metrics.ts:9-13`), nome `Ajuda: ${subject}`, `aria-expanded` (web) e `accessibilityState.expanded` (app), `aria-controls` no web. O glifo "?" num círculo de 22, com `aria-hidden`, como o `IconButton` (`IconButton.tsx:31-33`) |
| `HelpText` | `id: string`, `text: string`, `testID?` | `Text` `caption`/`inkMuted` com `nativeID`. Ao abrir, a frase é anunciada: `aria-live="polite"` no web, `accessibilityLiveRegion="polite"` no Android e `AccessibilityInfo.announceForAccessibility` no iOS, onde não há região viva |

Um hook `useHelp()` devolve `{ expanded, toggle, buttonProps, textId }` para quem monta os dois em lugares diferentes da linha.

**Por que expandir na linha, e não tooltip nem folha:**

- **Tooltip** depende de *hover*, não existe no toque e é mal lido pelo leitor de tela.
- **Folha** (`BottomSheet`): as listas de escolha já estão dentro de uma folha (`ChoiceEditorRow.tsx:56-81`, `Suggestions.tsx:78`, `ListEditor.tsx:251`). Uma folha sobre outra pede a troca pelo `onClosed` no iOS ([onda-3.md](onda-3.md) §11, item 3) e fecharia a lista, perdendo o contexto da escolha. No desktop seriam dois diálogos de 560 empilhados.
- **Na linha**, o texto fica ao lado do que explica, cabe dentro de uma folha aberta e não muda nada da `BottomSheet`: o Esc na captura (`BottomSheet.tsx:105-120`, `:234`), o foco de volta ao gatilho (`:184-205`), o diálogo central de 560 (`:150`, `:320`), o `onClosed` (`:136`, `:198-203`) e o texto do evento no Enter (`e0a4078`) ficam como estão. O Esc com a folha aberta continua fechando a folha, mesmo com uma ajuda expandida.

**O que muda nos componentes que já existem (aditivo; os usos atuais compilam):**

| Componente | Prop nova | Padrão | Efeito |
|---|---|---|---|
| `Choice` | `help?: string` (do grupo) | — | "?" na linha do título (§3.3) |
| `ChoiceOption` | `help?: string` | — | "?" na linha da opção (§3.3) |
| `TextField` / `TextArea` | `help?: { subject, text }` | — | "?" na linha do rótulo (`TextField.tsx:46-48`), com o texto abaixo do rótulo |
| `Chip` | nenhuma | — | as sugestões com frase viram linhas (§3.5), sem mudar o `Chip` |

O `design/design-system/components.md` ganha a entrada do `HelpButton` (disclosure, alvo, nomes) no mesmo commit.

### 3.3 R-19 · O "?" no `Choice`: título em linha própria (P06) e opções

- **Título.** O P06 deixou o título numa linha própria (`Choice.tsx:117-128`; P06 §2, linha D-11: "onde o P10-D pode pôr o '?' depois"). Com `help`, essa linha vira `[título][?]`. O nome do grupo continua o título: o `aria-labelledby` aponta só o `Text` do título (`:73`, `:121`), não o botão. No Android, o título segue `aria-hidden` (`:122`), e o "?" continua na árvore, lido antes do grupo. No iOS, o título e o "?" são lidos antes das opções. O texto expandido fica entre o título e as opções.
- **Opção.** Com `help` na opção, a linha vira `[rádio (flex 1)][?]`. O "?" é **irmão** do rádio, nunca filho: botão dentro de rádio não é aceito pelo ARIA e no app viraria um alvo dentro de outro. O nome do rádio não muda (`:83-85`), então os seletores `getByRole('radio', { name: 'Brujah' })` do E2E continuam valendo. O texto expandido fica sob a opção, dentro da célula.
- **Colunas.** A grade de 2 colunas (`:55`, `:134-136`) dá células de ~164 dp a 360. Com o "?" de 44/48, sobra pouco para "Sonhadores (Kha'vadi)". Proposta: com frase em alguma opção, 2 colunas só quando a largura medida do grupo (`onLayout`) for ≥ 480 (célula ≥ 240); abaixo, 1 coluna. Sem frase, a grade de hoje.
- **Teclado.** As setas continuam movendo o foco entre os rádios, com ativação manual (`:63-67`). Cada "?" é uma parada de Tab: 14 a mais nos clãs (pergunta 2 da §9).
- **Quem passa a ajuda:** `editors/ChoiceEditor.tsx:13-17` e `evolve/ChoiceEditorRow.tsx:70-74` mapeiam `o.help`. Na folha do `ChoiceEditorRow`, onde o título da folha já é o campo (`showLabel={false}`, `:68`), a frase do campo aparece como texto no topo da folha, sem "?": quem abriu a folha já pediu aquele campo.

### 3.4 R-19 · O "?" nas linhas do Editar e da criação

- **`EditorShell`** (`evolve/EditorShell.tsx:9-59`) ganha `help?: { subject, text }`. O "?" vai logo depois do rótulo, na coluna do rótulo (`:35-53`); o texto expandido vai no topo do `below` (`:56`), na largura da linha. Usam o `EditorShell`: `NumberEditorRow` (rating, number, percent; `:157-191`) e `ResourceEditorRow` (`:82`). Cada um passa `{ subject: def.label, text: def.help }`.
- **`TextEditorRow` e `ChoiceEditorRow`.** A linha inteira é um `Pressable` (`TextEditorRow.tsx:56-84`, `ChoiceEditorRow.tsx:26-55`). O "?" não pode ficar dentro dele: a linha vira `View` com `[Pressable (flex 1)][?]`, e o texto expandido fica abaixo. O nome e a dica da linha não mudam ("Abre o editor de texto", "Abre as opções").
- **Nova ficha** (`CharacterForm.tsx`): o `TextEditor` deixa de mandar `def.help` como `hint` (`TextEditor.tsx:50`) e manda como `help` do `TextField` (§3.2). O `hint` continua para os avisos que não são glossário (o "Privadas…" do R-09, `:58-65`).
- **Largura a 360 dp, a linha mais cheia (traço com Stepper, no Android):**

  | Pedaço | dp |
  |---|---|
  | Margens (`tokens.layout.gutter` × 2) | 32 |
  | Stepper: − 48, valor 32, + 48, dois vãos de 8 (`Stepper.tsx:279-291`) | 144 |
  | Vão entre a coluna do rótulo e o controle (`EditorShell.tsx:70`) | 12 |
  | "?" (48) e o vão de 4 | 52 |
  | **Sobra para o rótulo** | **120** |

  No iOS e no web, 128. "Empatia com Animais" e "Conhecimento" quebram em duas linhas; a linha cresce para baixo, como já cresce com a recusa (`EditorShell.tsx:5-8`). A nota da linha (o custo do próximo ponto, P05-C) e a recusa continuam sob o rótulo, no mesmo lugar.

### 3.5 R-19 · Listas com nome: sugestões e catálogo

- **Sugestões (Natureza, Comportamento).** Hoje são chips (`Suggestions.tsx:37-46`). Um "?" por chip não cabe. Com frase em alguma sugestão, a folha "Escolher da lista" (`:78-89`) e as sugestões da folha do `TextEditorRow` (`TextEditorRow.tsx:122-131`) mostram **linhas**: `[nome (botão, escolhe)][?]`, com o mesmo filtro por texto (`:31-34`) e a escolha atual marcada. Sem frase, os chips de hoje. O botão do nome tem o mesmo nome acessível do chip, e os testes que tocam a sugestão pelo nome continuam valendo.
- **`AddItemSheet`** (`ListEditor.tsx:282-302`). Já é uma linha por opção. Ela vira `[opção (flex 1)][?]`. A 360 dp: 328 de conteúdo, menos o "?" (48) e o vão (8), dá 272 para o nome e, na segunda linha, o selo "do clã" e o nível do P07-D. O "já na ficha" (`:291-295`) fica na mesma coluna do nome.
- **Item já na ficha** (`ListEditor.tsx:117-131`). A linha **não** ganha "?": a 360 dp ela vai ter o nome, o selo "do clã" e o −/+ do P07-D (D-08), e o "?" tiraria 52 dp do nome. A frase do item (pelo nome, no catálogo) aparece como texto no topo da `ItemSheet` (`ListEditor.tsx:356-509`), que a linha abre. A linha mais cheia a 360, no Android: 32 de margem, 144 do −/+, 12 de vão, e sobram 172 para o nome e o selo, em duas linhas.
- **Cabeçalho da lista** (`views/ListView.tsx:61`, `ListHeader`, e o cabeçalho do bloco do T-58): "?" com a frase do campo (Disciplinas, Antecedentes, Dons).

### 3.6 R-19 · Grupos de seção

O título de grupo ("Físicos", "Talentos", "Conhecimentos") ganha "?" quando o grupo tem `help`: `sheet/layouts/GroupsLayout.tsx:137-139` e `sheet/layouts/GridLayout.tsx:39`. Com as abas por grupo no celular (`groupTabs`), o "?" fica no topo do conteúdo da aba, não no rótulo da aba: a aba é um alvo só.

### 3.7 R-19 · "Prioridade" e "pontos de bônus" (texto do app)

- "Prioridade" (`CreationCounter.tsx:60-64`) ganha o "?" ao lado do chip, com uma frase genérica da regra `priority-budget`: cada grupo recebe um dos valores, e cada valor vale para um grupo só. É a explicação que o IW-09 pediu, sem número fixo: os valores vêm do template (`budgets`).
- "pontos de bônus": a frase já existe na aba (`CreationPanel.tsx:213-214`). O "?" vai no rótulo do saldo de bônus da aba, com o mesmo texto, e a folha "Começaram os pontos de bônus" (`:322-340`) não muda.
- Os dois textos ficam num módulo do app (`sheet/creation/help.ts`), não no template. Se o PO preferir que venham do template (§9, ponto 1), a mudança é uma chave `help` em `creation`, aditiva, num pacote seguinte.
- **Conflito:** o P05-D renomeia "Orçamento" para "Pontos" e mexe nessa aba e na barra (§8.4). O "?" entra depois dele, nos rótulos que ele deixar.

### 3.8 R-19 · Os textos: quantos faltam, por sistema, e em que ordem

**Contagem feita nos três templates** (script de leitura no scratchpad; nenhum arquivo do repositório mudou). Fora da conta: Nome, Citação, Notas e Notas do Narrador, que não pedem explicação.

| | V20 (`vtm-v20` 1.8.0) | W20 (`wta-w20` 1.6.0) | M20 (`mta-m20` 1.6.0) |
|---|---|---|---|
| Campos no template | 64 | 72 | 79 |
| Campos candidatos | 60 | 68 | 75 |
| … já com `help` (a rever, §3.0) | 7 | 7 | 8 |
| … sem frase | **53** | **61** | **67** |
| Grupos que levariam frase (Físicos, Sociais, Mentais, Talentos, Perícias, Conhecimentos) | **6** | **6** | **6** |
| Opções de `choice` | **14** (Clã) | **21** (Raça 3, Augúrio 5, Tribo 13) | **23** (Tradição 10, Essência 4, Esfera de afinidade 9) |
| Opções de `state` | — | 5 (Forma; já têm `hint` curto, frase opcional) | — |
| Sugestões de `text` | **42** Arquétipos (84 entradas: os mesmos em Natureza e Comportamento) | — | — (+42 se o P10-C trouxer a lista ao Mago, T-60) |
| Catálogo | **27** (Disciplinas 17, Antecedentes 10) | **10** (Antecedentes) + os Dons do P07-D | **14** (Antecedentes) |
| Itens `fixed` | — | — | **3** (Ressonância) |
| **Frases novas** | **142** | **103** (+5 opcionais e os Dons) | **113** (+42 se o P10-C) |

- **Repetição entre sistemas.** 44 rótulos aparecem nos três templates (os 9 Atributos, a maior parte das Habilidades, Força de Vontade, Vitalidade, Experiência, Antecedentes, Qualidades, Defeitos). Uma frase escrita uma vez serve aos três, com revisão por sistema. A união dá 107 rótulos de campo distintos.
- **Quem escreve:** o time (quem cuida do conteúdo de cada sistema), com revisão de uma segunda pessoa que conheça o sistema. Cada frase com palavras próprias, sem copiar nem parafrasear de perto um trecho do livro. O PR que traz frases diz, no resumo, quem escreveu e quem revisou.
- **Rascunho nesta etapa:** nenhum. Este plano não escreve frase de termo de jogo.

**Prioridade proposta** (pelas notas IW-06, IA-06, IW-09 e EW-21; a ajuda entra parcial, e campo sem frase não mostra "?"):

1. **Termos que as personas não entenderam:** Prioridade e pontos de bônus (app, §3.7); Natureza, Comportamento, Conceito, Clã, Senhor, Geração, Disciplinas, Antecedentes, Virtudes, Humanidade, Força de Vontade, Pontos de Sangue (V20); Raça, Augúrio, Tribo, Posto, Fúria, Gnose, Renome, Dons (W20); Tradição, Essência, Casa ou subgrupo, Arete, Esferas, Esfera de afinidade, Quintessência e Paradoxo, Paradigma, Prática, Instrumentos (M20); os 6 grupos. Cerca de 20 por sistema.
2. **Opções de identidade:** Clã, Raça, Augúrio, Tribo, Tradição e Essência (14, 21 e 14).
3. **Arquétipos** (42, uma vez para os dois campos) e Antecedentes do catálogo.
4. **Atributos e Habilidades** (o grosso das linhas: 39 a 42 por sistema).
5. **Poderes:** opções de Disciplinas, Dons, Esferas e Ritos. Só depois da resposta do PO e de quem cuida da licença (§9, ponto 2). Até lá, sem frase.
6. **Revisão dos 22 `help` de hoje:** o glossário fica; a instrução de texto vira `placeholder` (a da Fraqueza depende do P07-D, que preenche o campo); a nota de desenho da Gnose é reescrita.

O código entra com o mecanismo e com a prioridade 1 e a revisão 6, se as frases estiverem prontas no PR. O resto entra por template, sem código, na versão de template da onda ou de uma onda seguinte.

### 3.9 U-06 · "Casa ou subgrupo", opcional

No `mta-m20.json:67`:

```json
"house": {
  "type": "text",
  "label": "Casa ou subgrupo",
  "maxLength": 60,
  "placeholder": "Opcional",
  "help": "<frase do time: o que o campo guarda e que fica em branco quando a Tradição do personagem não tem subgrupo>"
}
```

- **Rótulo.** Vale na Nova ficha, no Editar, na identidade em colunas (`:20`) e na seção `about-facts` (`:609`).
- **Opcional.** O `placeholder` já faz parte do contrato do campo de texto (`schema.json:1198-1201`) e já é desenhado na Nova ficha (`TextEditor.tsx:51-55`) e na folha do Editar (`TextEditorRow.tsx:109`). Não é chave nova: o app antigo abre o template. O `placeholder` sozinho não basta para o leitor de tela (some ao digitar); a frase do "?" também diz que é opcional.
- **Por que não "(opcional)" no rótulo, nem `optional` no contrato:**
  - na Nova ficha, só o Nome diz "(obrigatório)" (`TextEditor.tsx:45`); todos os outros campos já são opcionais. Marcar só a Casa sugere que os outros são exigidos;
  - uma chave `optional` ou `required` no campo é o ponto 5 do [onda-1.md](onda-1.md) §6, ainda sem decisão, e derrubaria o app antigo (chave nova no campo, §3.0).
- **A criação não muda.** Continua sem exigir a Casa em nenhuma camada (§1). Nenhum campo escondido, nenhuma condição por Tradição.
- **A descrição da matriz ("Casa só onde a regra pede") não se aplica:** a D-12 escolheu a Casa em todas as Tradições.

### 3.10 Versões dos templates, publicação e a ficha da versão anterior

**Proposta: um aumento de versão por onda, não por pacote.**

- **Por quê.** A versão publicada é imutável (`publish.ts:104-114`). Se o P07-D, o P10-C, o P10-D e o P15-D subissem a mesma versão cada um no seu branch, com conteúdos diferentes, o primeiro que chegasse a um banco (o de desenvolvimento, o do roteiro) travaria os outros com "já foi publicado com outro conteúdo". O `templateVersion` não aceita sufixo de pré-versão (`validate/template.ts:368-369`: só `\d+\.\d+\.\d+`).
- **Versões da onda 4 (minor: conteúdo aditivo e chaves novas opcionais):** `vtm-v20` 1.8.0 → **1.9.0**; `wta-w20` 1.6.0 → **1.7.0**; `mta-m20` 1.6.0 → **1.7.0**. O D&D, o CoC e o Fate não sobem (não são publicados: `templates/published.ts:4-7`).
- **Quem sobe:** a integração da onda, num commit só, depois do último pacote de template (P07-D, P10-C, P10-D e, se entrar, P15-D), com:
  - os três `templateVersion`;
  - a migration `0023_templates_onda4.ts`, cópia da `0020` (`storeTemplate` dos `PRODUCT_TEMPLATES`, sem `down`);
  - os testes que fixam versão (§4.2).
- **Ordem da publicação:** a de `PRODUCT_TEMPLATES` (`vtm-v20`, `mta-m20`, `wta-w20`), pela migration e pelo `pnpm templates:publish --published`. O app vai ao ar antes ou junto (`arquitetura-motor-de-ficha.md` §5.3): no web, o bundle e a API saem no mesmo deploy.
- **No branch do pacote**, sem aumento: o roteiro manual usa um banco próprio do pacote (`tms_p10d`, sem `db:down`; §11.a), em que a `0020` grava o conteúdo atual dos arquivos (§11.a).

**O que acontece com cada ficha e cada app:**

| Caso | O que acontece |
|---|---|
| Ficha criada na versão anterior (1.8.0 / 1.6.0) | Continua nela (`0011:3-9`). Sem as frases novas e com "Casa" no Mago. Os campos que já tinham `help` ganham o "?" no Editar, porque o desenho é do app novo. Não há "Atualize o app" |
| Ficha nova depois da publicação | Nasce na versão nova, com as frases e "Casa ou subgrupo" |
| App novo, template antigo | Abre: as chaves novas são opcionais |
| App antigo, template novo só com `help` em opções, grupos e `fixed` | Abre e ignora a frase: o core antigo não confere chave dentro das opções (§3.0) |
| App antigo, template novo com sugestão ou catálogo em forma de objeto | "Atualize o app" (`compileSafe`, `sheet/data.ts:142-157`; L-02, P01-C) em fichas novas daquele sistema. No web, não acontece (deploy junto). No nativo, é o motivo de publicar o template só com o app no ar |

A pergunta de levar as frases às fichas antigas está na §9 (pergunta 7).

## 4. Testes

### 4.1 Um teste de regressão por item (falha no `3cc07f1`, passa depois)

| Item | Teste | Onde | Runner |
|---|---|---|---|
| R-19 | Com o `vtm-v20` real, na criação por pontos: a linha do Talento Consciência e a da Virtude Consciência têm um botão "Ajuda: Consciência" cada; tocar expande a frase de cada uma, diferentes (o caso do IW-06, que hoje não tem botão) | `sheet/evolve/__tests__/evolve.a11y.test.tsx` | Jest + RNTL |
| R-19 | `HelpButton`: nome "Ajuda: X", papel `button`, `aria-expanded` falso→verdadeiro, alvo ≥ 44 (48 no Android, pelo `Platform` do teste); `HelpText` com `aria-live` no web | `packages/ui/src/a11y.test.tsx`, `components.test.tsx` | Jest |
| R-19 | `Choice` com `help` no grupo e nas opções: "?" fora do rádio (o rádio não tem filho focável), nome do rádio igual ao de hoje, `aria-labelledby` só com o título; 1 coluna abaixo de 480 com frase, 2 sem frase | `packages/ui/src/a11y.test.tsx` | Jest |
| R-19 | Contrato: opção, grupo, `fixed`, sugestão e catálogo com `help` aceitos; frase com `<`, com controle, com mais de 200, com `://` ou `www.` recusada; o mesmo nome em Natureza e Comportamento com frases diferentes recusado; `entryName` nas duas formas; `itemIn` e `{ list, item }` continuam casando pelo nome | `packages/sheet-core/src/__tests__/validate-template.test.ts`, `accounting-template.test.ts` | Bun |
| R-19 | Publicação: o Ajv e o contrato recusam a frase com link e a grande, nada é gravado, e a mensagem não ecoa a frase; o template com frases é publicado | `apps/api/src/templates/__tests__/publish.test.ts` | Bun em PGLite |
| R-19 | Nova ficha: `TextField` de Natureza com "Ajuda: Natureza" quando há frase; a folha "Escolher da lista" em linhas com "?" quando as sugestões têm frase, em chips quando não | `apps/frontend/app/__tests__/new-character.test.tsx`, `sheet/__tests__/sheet.a11y.test.tsx` | Jest + RNTL |
| R-19 | `AddItemSheet` com frase no catálogo: "?" por opção, fora do botão da opção; a `ItemSheet` mostra a frase do item pelo nome; a linha do item não ganha "?" | `sheet/evolve/__tests__/ListEditor.test.tsx` | Jest + RNTL |
| R-19 | "Prioridade" com "Ajuda: Prioridade" e a frase genérica | `sheet/creation/__tests__/` (arquivo do `CreationCounter`, `.test.tsx`) | Jest + RNTL |
| U-06 | O `mta-m20` tem "Casa ou subgrupo", com `placeholder` "Opcional" e `help` | `packages/sheet-core/src/__tests__/compile.test.ts` | Bun |
| U-06 | A Nova ficha do Mago mostra "Casa ou subgrupo" com "Opcional", e uma Verbena sem Casa é criada (201) | `new-character.test.tsx`; `apps/api/src/__tests__/mage.test.ts` | Jest; Bun em PGLite |

O teste do U-06 falha antes pelo rótulo, não pela criação: criar sem Casa já funciona (§1).

### 4.2 Testes existentes que mudam junto

- **E2E, por causa do nome "Ajuda: <campo>".** O `getByLabel` do Playwright casa por trecho e também pelo `aria-label` de qualquer elemento. Com o "?", `getByLabel('Natureza')` casa o campo e o botão "Ajuda: Natureza" (modo estrito, erro). Passam a `{ exact: true }`, nos campos que ganharem frase:
  - `e2e/tests/journey-mage.spec.ts:68-70` (Natureza, Comportamento, Conceito) e `:73` (`getByLabel('Casa')` → `getByLabel('Casa ou subgrupo', { exact: true })`);
  - `e2e/tests/journey-werewolf.spec.ts:69`, `:70` e `:75`;
  - `e2e/tests/journey.spec.ts:86` e `:88`;
  - `e2e/tests/create-character.spec.ts:24`.

  Quem ajusta: este pacote, no commit do E2E (§8.1). Os `exact` já existentes (`Natureza`, `Comportamento`, `Seita`) não mudam.
- **Versão do template (só no commit da integração, §3.10):** `apps/api/src/__tests__/mage.test.ts:90`, `werewolf.test.ts:98`, `characters.test.ts:88`, `:99`, `:110`, `:322`, `:456`, `:466`, `:474-475`; `templates/__tests__/publish.test.ts:185`, `:197`, `:228`, `:243` (o caso "uma versão nova convive" monta a 1.9.0 a partir do arquivo: com o arquivo em 1.9.0, ele passa a montar a 1.10.0), `:321`, `:345-347`; `packages/sheet-core/src/__tests__/compile.test.ts:42-43`.
- **Jest:** `packages/ui/src/components.test.tsx` e `a11y.test.tsx` (o `Choice`); `sheet.a11y.test.tsx` e `new-character.test.tsx` (as sugestões); `ListEditor.test.tsx`, `evolve.test.tsx` e `creation/__tests__/advantages.test.tsx` (a `AddItemSheet`); `evolve.a11y.test.tsx` (as linhas com "?").

### 4.3 E2E novo: `e2e/tests/help.spec.ts` (Chromium e WebKit)

Contra o export web com a CSP de produção e os templates publicados (seed do E2E). Usa só frases que já estão no template (os 22 `help` de hoje, revistos), para não depender do ritmo da escrita:

1. **Web 390, Vampiro por pontos, criação:** na linha do Talento, `getByRole('button', { name: 'Ajuda: Consciência' })` existe duas vezes (Talento e Virtude, em abas diferentes); `Enter` e depois `Space` alternam o `aria-expanded`; o texto aparece logo abaixo da linha e é diferente nas duas. A caixa do botão mede ≥ 44 × 44 (`boundingBox`).
2. **Web 390, a linha do traço com Stepper e "?":** o rótulo, o "?" e o "+" ficam dentro da viewport (sem rolagem lateral), e o "+" continua com o nome de hoje.
3. **Folha com ajuda expandida:** abrir a folha da Força de Vontade, expandir a ajuda, apertar Esc: a folha fecha e o foco volta ao gatilho (o mesmo do `a11y-keyboard.spec.ts`).
4. **Web 1280, Mago (U-06, obrigatório):** Nova ficha → "Verbena" → `getByLabel('Casa ou subgrupo', { exact: true })` vazio, com `placeholder` "Opcional"; "Ajuda: Casa ou subgrupo" expande a frase; "Criar ficha" sem a Casa abre a ficha.
5. **Atributos no DOM** (o que o Jest não pega no web): `aria-expanded`, `aria-controls` apontando um elemento que existe, e o `aria-live="polite"` no texto.

As frases de opção (Clã, Tribo, Tradição) entram no spec quando a prioridade 2 estiver no template.

### 4.4 Suítes do "PR local" e cobertura

```bash
npx pnpm -C packages/sheet-core build        # o dist que a API e os scripts leem
npx pnpm turbo run typecheck lint --filter=@tms/sheet-core --filter=@tms/api --filter=@tms/ui --filter=frontend --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=@tms/sheet-core --filter=@tms/api --filter=@tms/ui --filter=frontend
node design/scripts/validate.mjs             # o validador do design contra os seis templates
```

- **As metas são por arquivo.** `@tms/ui`: 80% em tudo (`packages/ui/jest.config.js`): o `HelpButton` e o `HelpText` nascem com teste. App: 80/80/70/80 em `./sheet/` (`apps/frontend/jest.config.js`). Sheet-core e API: `bunfig.toml` de cada um.
- **`.test.tsx` em `components/`.** O `testMatch` do Jest só pega `.test.tsx` ali (`apps/frontend/jest.config.js:24`). Em `sheet/` valem os dois. Conferir com `jest --listTests` que os arquivos novos rodam.
- O E2E inteiro (Chromium e WebKit) roda na integração, um por vez (portas fixas).

## 5. Segurança

O pacote muda o validador do contrato de template no `@tms/sheet-core` (que o servidor aplica na publicação) e o `schema.json`. **Passa por `/security-review` antes do merge**, além do `/code-review`. Foco: `validate/template.ts`, `schema.json`, `publish.ts` e os componentes que desenham a frase.

| O que pode dar errado | Como o desenho evita |
|---|---|
| Frase de template vira HTML, script ou link | O `safeText` proíbe `<`, `>`, controles e bidi; o `not` proíbe `://` e `www.`; o validador do core repete as regras (`isSafeText`, `validate/safe-text.ts:8-20`). A frase sai num `<Text>` do RN: sem `dangerouslySetInnerHTML`, sem `Linking`, sem `dataDetectorType`. Markdown não é interpretado |
| Template enorme ou com milhares de frases (custo no cliente) | 200 por frase, 400 por campo, 1000 por string e aninhamento de 12 (README §2, l.68); no máximo 100 opções, 100 sugestões e 200 itens de catálogo (`schema.json:1206`, `:1262`, `:1312`) |
| Alguém publica um template com texto malicioso | A publicação continua só por script do dono, sem rota de escrita de template (`publish.ts:14-16`). As duas camadas (Ajv e `validateTemplate`) rodam antes de gravar; recusado, nada é gravado. O log diz sistema, versão e hash, nunca o conteúdo (`publish-template.ts:11-12`, `:40-42`) |
| Prototype pollution pelos nomes do catálogo | Os nomes viram texto, não chave de objeto. A comparação é por `entryName`, sem `obj[nome]`. As chaves proibidas (`__proto__`, `constructor`, `prototype`) continuam barradas em qualquer profundidade (`validate/template.ts:205-209`) |
| A frase vaza para a telemetria | A frase não entra em evento nem em erro. O filtro do web remonta o evento por lista de campos: dos *breadcrumbs*, só navegação e fetch/xhr, com URL sem query (`apps/frontend/lib/telemetryFilter.ts:118-150`); o clique, que carregaria o texto do botão, não sai. A API só manda 5xx, remontados (`apps/api/src/http/on-error.ts`). Nenhum log novo |
| A ajuda muda uma regra ("o texto diz que pode") | A frase é só apresentação: não entra em `sheet_data`, no `checkCreation` nem no `writePolicy`. O servidor continua conferindo cada escrita. A Casa continua opcional em todas as camadas, como hoje |
| Mudança de forma do catálogo quebra uma regra de bônus | O `itemIn` e o `{ list, item }` passam a comparar pelo `entryName`, com teste nas duas formas (§4.1). Texto digitado fora do catálogo continua sem desconto (README l.852) |
| App antigo derrubado por template novo | Só a forma de objeto em sugestões e catálogo derruba, e ela só é publicada com o app novo no ar (§3.10). Falha segura: "Atualize o app", nunca a ficha montada pela metade |
| Licença | Nenhum texto literal de livro. Frase escrita e revisada pelo time, com o nome dos dois no resumo do PR. As frases de poderes esperam a resposta do PO e de quem cuida da licença (§9, ponto 2). É risco legal, não técnico, mas bloqueia o merge |

**Checklist da organização:**

- **Validação no servidor:** o contrato do template é conferido na publicação; nenhuma escrita de ficha muda.
- **Fail secure:** chave desconhecida no template continua recusada pelo Ajv; frase inválida recusa a publicação inteira.
- **Logs sem PII, senha ou token:** nada novo; as contas do roteiro são fictícias.
- **Erros sem stack trace:** a recusa da publicação é uma lista de caminho e motivo, no terminal do dono.
- **Dependências:** nenhuma nova.

## 6. Como generaliza além do WoD

- **O "?" é genérico.** O `HelpButton`, o `help` nos nós e o desenho nas linhas valem para qualquer template. Um campo sem frase não muda nada, então os templates que não têm frase seguem iguais.
- **Os outros templates do repositório**, conferidos com o mesmo script:

  | Template | Campos | Já com `help` | Onde a frase caberia sem mudar o contrato de novo |
  |---|---|---|---|
  | D&D 5e (`dnd5e-2014.json` 1.1.0) | 58 | 2 | Raça (9) e Classe (12), Condições (13, `tags`), os estados de proficiência (`mark`) |
  | Call of Cthulhu 7e (`coc7e.json` 1.0.0) | 64 | 1 | as 47 perícias (`percent`) e as 5 condições (`tags`) |
  | Fate Core (`fate-core.json` 1.0.0) | 29 | 1 | a escada (`ladder`), as consequências (3, `fixed`) e os aspectos |

  O mecanismo cabe nos três sem frase nenhuma: o template continua válido como está.
- **Licença por sistema.** O que a frase pode dizer depende da licença do sistema (README §12): o SRD 5.1 do D&D é CC BY 4.0 e permite mais; o WoD e o CoC, só palavras do time. O contrato limita forma e tamanho; o conteúdo é de cada template.
- **"Prioridade" e "pontos de bônus".** São da regra do motor (`priority-budget`, `freebies`), não do WoD: a mesma frase vale para qualquer sistema que use a regra. O point-buy do D&D (`point-buy`) ganharia a sua frase do mesmo jeito (§3.7).
- **A Casa.** É conteúdo do template do Mago. O padrão "campo opcional com `placeholder` e frase" vale para qualquer subgrupo de qualquer sistema (o Campo do Garou, a Seita), sem mecanismo novo.

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado.** Arquivos e linhas conferidos no `3cc07f1` (seção 3). As decisões D-11 e D-12 aplicadas, com o que não se aplica como está escrito apontado na §2 e na §9.
2. **Typecheck, lint e testes** de `@tms/sheet-core` (com o `dist` reconstruído), `@tms/api`, `@tms/ui` e do frontend, e o `validate.mjs` (§4.4).
3. **Um teste de regressão por item** (§4.1), falhando no `3cc07f1`, e o `test:coverage` verde.
4. **`/code-review` e `/security-review`** no diff do pacote. Os achados vão no resumo.
5. **Os cenários das personas, repetidos sem o defeito.** Com a API local e o seed do roteiro (só contas fictícias; §11):

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | R-19 | I-W, IW-06 (`iniciante-web.md`), web 390: Vampiro por pontos → Habilidades → Talentos → Consciência; Vantagens → Virtudes → Consciência | Um "?" em cada; frases diferentes; o leitor do DOM lê "Ajuda: Consciência, botão, recolhido" |
   | R-19 | I-W, IW-09, web 390: Criação → "Prioridade" | "?" ao lado do chip, com a frase genérica; o erro antigo do IW-09 é do P05-C, não muda aqui |
   | R-19 | I-A, IA-06 (`iniciante-app.md`), iOS: Nova ficha → Natureza → "Escolher da lista" | Com frase nas sugestões: linhas com "?"; sem frase: os chips de hoje |
   | R-19 | I-A, IA-06, iOS: Nova ficha (Vampiro) → Clã | "Ajuda: Clã" ao lado do título; "?" nas opções que têm frase |
   | U-06 | E-W, EW-21 (`experiente-web.md`), web 1280: Mago → Nova ficha → uma Tradição que não seja a Ordem de Hermes | "Casa ou subgrupo" com "Opcional"; a ficha é criada sem Casa |

6. **Conferência no aparelho.** O roteiro completo está na **§11**. O pacote muda o `@tms/ui` (`HelpButton`, `Choice`, `TextField`), e a lição S-01 obriga a conferir no nativo antes do merge.
7. **Resumo para a seção do pacote no PR da onda:**
   - o que mudou e como foi testado;
   - os achados das duas revisões;
   - o contrato novo (§3.1) e a API nova do `@tms/ui` (§3.2);
   - quantas frases entraram por sistema, quem escreveu e quem revisou;
   - os pontos para o PO (§9) que seguem abertos.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

| # | Commit | Itens | Esforço |
|---|---|---|---|
| 1 | `feat(core): help nas opções, nos grupos e nos itens fixos do template` (`schema.json`, `contract/fields.ts`, `contract/template.ts`, `validate/template.ts`, `validate.mjs`, README §3 e §12, testes Bun) | R-19 | P |
| 2 | `test(api): publicação recusa ajuda com link ou grande` (`publish.test.ts`) | R-19 | P |
| 3 | `feat(ui): HelpButton e HelpText; help no Choice e no TextField` (com `components.md` e testes) | R-19 | M |
| 4 | `feat(app): "?" nas linhas da criação e do Editar` (`EditorShell`, `NumberEditorRow`, `ResourceEditorRow`, `TextEditorRow`, `ChoiceEditorRow`, `ChoiceEditor`, `TextEditor`, `GroupsLayout`, `GridLayout`, `ListHeader`) | R-19 | M |
| 5 | `feat(app): "?" em "Prioridade" e "pontos de bônus"` (`sheet/creation/help.ts`, `CreationCounter`, aba de pontos) | R-19 | P |
| 6 | `feat(templates): Casa ou subgrupo, opcional, no Mago` (`mta-m20.json`) | U-06 | P |
| 7 | `feat(core,app): sugestões e catálogo com nome e ajuda` (`entryName`, `entryHelp`, `accounting.ts`, as linhas da folha de sugestões, a `AddItemSheet`, a `ItemSheet`) — sobre a forma do catálogo do P07-D, se ele já tiver entrado | R-19 | M |
| 8 | `content(templates): frases do time, prioridade 1, e revisão dos help atuais` (os três JSON; só se as frases estiverem prontas e revisadas) | R-19 | P (código) |
| 9 | `test(e2e): ajuda contextual e Casa do Mago` (`help.spec.ts`; os `exact` da §4.2) | R-19, U-06 | P |

**Por que esta ordem:**

- O core (1) vem antes da API (2), que lê o `dist`, e antes do app.
- O `@tms/ui` (3) vem antes dos usos (4, 5, 7).
- O U-06 (6) é independente e pode sair sozinho.
- O 7 depende da forma do catálogo e da ordem das listas (P07-D, P10-C, §8.4): fica no fim, e o pacote pode ser mergeado sem ele.
- O 8 é conteúdo: pode sair depois, por template, sem código.
- O aumento de versão e a migration `0023` não estão aqui: são da integração da onda (§3.10).

### 8.2 Esforço

**M, de 5 a 6 dias de desenvolvimento**, em 9 commits (5 P, 3 M e o de conteúdo). Passa a **G (7 a 8 dias)** se a forma de objeto do catálogo ficar com este pacote, porque o P07-D não a trouxe (commit 7 com os consumidores do `itemIn` e do `{ list, item }`).

A matriz soma 1 P e 1 M. A diferença vem do que o código mostrou:

- o "?" entra em seis editores e três layouts, não só nas listas;
- a sugestão e o catálogo são texto, e a frase pede outra forma (§3.1).

**Fora da conta:** a escrita das frases. São 142 (V20), 103 (W20) e 113 (M20), mais os 22 `help` a rever (§3.8). Com uma frase curta, escrita e revisada, a conta é de dias de trabalho de conteúdo do time, que pode entrar em partes.

### 8.3 Riscos

| Risco | Efeito | Mitigação |
|---|---|---|
| As frases não ficam prontas na onda | O mecanismo entra quase sem uso | A entrega parcial é o desenho (§3.8): os 22 `help` de hoje já ganham o "?"; o resto entra por template |
| Frase que repete o livro | Risco legal | Escrita e revisão por duas pessoas; poderes só com resposta do PO (§9, ponto 2); o resumo do PR diz quem escreveu |
| Linha apertada a 360 dp | Rótulo em três linhas, "+" fora da tela | Medida na §3.4 e conferida no AVD a 360 (§11, R-19d); a linha cresce para baixo |
| Muitas paradas de Tab no `Choice` | Teclado lento nos 14 clãs | Pergunta 2 da §9; o leitor de tela não muda |
| Seletores do E2E ambíguos | E2E vermelho no modo estrito | Os `exact` da §4.2, no mesmo PR |
| Duas versões do mesmo template em bancos locais | "Já foi publicado com outro conteúdo" | Um aumento por onda, na integração (§3.10); banco novo no roteiro do pacote |
| App nativo antigo com catálogo em forma de objeto | "Atualize o app" | Publicar com o app no ar (§3.10) |

### 8.4 Conflitos com os pacotes da onda

| Pacote | Onde encosta | Acordo proposto |
|---|---|---|
| **P07-D** (D-07, D-08, D-09) | A forma do `catalog` (o nível do Dom), a `AddItemSheet` (selo e prévia), a `ItemSheet`, a linha do item (−/+ e selo), o `help` e o campo da Fraqueza no V20, os três JSON | **Corrigido na consolidação ([onda-4.md](onda-4.md) §4.3):** o P07-D **não** traz a forma de objeto. O `catalog` continua uma lista de nomes, e o nível e a recomendação vão em mapas ao lado (`catalogDefaults` e `recommend`, P07-D §3.1). A recomendação é que a frase do catálogo e das sugestões siga o mesmo padrão, num mapa por nome, sem a forma de objeto, e o commit 7 fica M. Se o time preferir a forma de objeto, o commit 7 a cria e o pacote vai a G (§8.2). A linha do item fica sem "?" (§3.5), sem disputar largura com o −/+. Na `AddItemSheet`, o "?" vai à direita do selo. O P07-D entra antes do commit 7; os commits 1 a 6 não dependem dele |
| **P10-C** (T-60, T-66, T-85, T-22, U-05) | A ordem das listas (se ordenar no template, reordena os arrays de sugestões e de catálogo que o commit 7 muda de forma), a lista de Natureza no Mago, o `ResourceEditorRow` (o mínimo da Fúria) e o `text.ts` | Ordenar no código pelo rótulo exibido evita o conflito; se for no template, o P10-C entra antes do commit 7, e a ordenação usa o `entryName`. O `ResourceEditorRow` recebe o `help` pelo `EditorShell`, numa linha só: o rebase é pequeno. Se o P10-C trouxer os 42 Arquétipos ao Mago, as frases deles entram depois, por template |
| **P05-D** (D-05) | A aba "Orçamento" → "Pontos", a barra, o `CreationPanel` e o `CreationCounter` | O commit 5 entra depois do P05-D e põe o "?" nos rótulos que ele deixar |
| **P15-D** (D-16, fora destes planos) | Campo "História / Prelúdio" nos três JSON | Entra no mesmo aumento de versão da onda (§3.10). O campo novo pode nascer com frase. A inclusão dele na onda é do usuário |
| P14-D | — | Sem arquivo em comum |

**Ordem de merge proposta para os pacotes de template:** P07-D → P10-C → P10-D (→ P15-D, se entrar) → commit de integração com as versões e a `0023`. O P05-D pode entrar a qualquer momento antes do commit 5 deste pacote. **Consolidada no [onda-4.md](onda-4.md) §2: P05-D → P10-C → P07-D → P10-D.** O P10-C vem antes do P07-D porque traz o `byLabel` e o `Stepper.decrease` que o P07-D usa. O P10-D continua depois dos dois.

### 8.5 Arquivos tocados

| Arquivo | Itens | O que muda |
|---|---|---|
| `design/templates/schema.json` | R-19 | `helpShort`; `help` em opções, grupos, `fixed`, sugestões e catálogo; regra de link no `helpText` |
| `design/templates/README.md` | R-19 | §2 (limites), §3 (onde cabe o `help`), §12 (quem escreve a frase) |
| `design/scripts/validate.mjs` | R-19 | As mesmas regras do core |
| `design/templates/mta-m20.json` | U-06, R-19 | A Casa; frases (commit 8) |
| `design/templates/vtm-v20.json`, `wta-w20.json` | R-19 | Frases e revisão dos `help` (commit 8) |
| `packages/sheet-core/src/contract/fields.ts`, `contract/template.ts` | R-19 | `help?` nos tipos; sugestão e catálogo nas duas formas |
| `packages/sheet-core/src/validate/template.ts`, `accounting.ts`, `index.ts` | R-19 | Validação; `entryName` e `entryHelp` |
| `packages/ui/src/HelpButton.tsx` (novo), `Choice.tsx`, `TextField.tsx`, `index.ts` | R-19 | Componentes e props novas |
| `design/design-system/components.md` | R-19 | Entrada do `HelpButton` |
| `apps/frontend/sheet/evolve/EditorShell.tsx`, `NumberEditorRow.tsx`, `ResourceEditorRow.tsx`, `TextEditorRow.tsx`, `ChoiceEditorRow.tsx`, `ListEditor.tsx` | R-19 | "?" nas linhas, nas folhas e na `AddItemSheet` |
| `apps/frontend/sheet/editors/ChoiceEditor.tsx`, `TextEditor.tsx`, `Suggestions.tsx` | R-19 | Nova ficha; sugestões em linhas |
| `apps/frontend/sheet/layouts/GroupsLayout.tsx`, `GridLayout.tsx`, `views/ListView.tsx` | R-19 | Grupos e cabeçalho da lista |
| `apps/frontend/sheet/creation/help.ts` (novo), `CreationCounter.tsx`, `CreationPanel.tsx` | R-19 | "Prioridade" e "pontos de bônus" |
| Testes da §4.1 e §4.2; `e2e/tests/help.spec.ts` (novo) | R-19, U-06 | — |

## 9. Perguntas abertas

**Pontos para o PO (nenhum decidido neste plano):**

1. **"Prioridade" e "pontos de bônus" com texto do app, não do template** (§2, §3.7). A D-11 diz "vinda do template". O plano propõe o app, porque o rótulo também é do app e a regra é do motor.
2. **Frases de poderes** (Disciplinas, Dons, Esferas, Ritos). O README §12 e a auditoria (l.162) dizem que as descrições são protegidas, e a D-07 revê a licença "só para os nomes". Uma frase curta do time sobre um poder é descrição? Até a resposta de quem cuida da licença, essas opções ficam sem frase.
3. **"Opcional" só na Casa.** Como só o Nome é exigido, marcar a Casa sugere que os outros são. O plano usa `placeholder` e frase, sem chave nova. O template marcar o que a criação exige segue em aberto ([onda-1.md](onda-1.md) §6, ponto 5).
4. **Quem escreve e revisa as frases**, e se a onda pode sair com a ajuda parcial (só a prioridade 1). O critério de saída da onda 4 ("a criação repetida pelo Iniciante") fica mais fraco sem as frases das opções de identidade.
5. **As fichas antigas** continuam sem as frases novas (§3.10). Para a R-19 basta a ficha nova; levar as frases às antigas é a pergunta técnica 7.

Os pontos para o PO das ondas 1 a 3 ([onda-1.md](onda-1.md) §6, [onda-2.md](onda-2.md) §6, [onda-3.md](onda-3.md) §6) continuam sem decisão.

**Perguntas técnicas:**

1. **Expandir na linha** em vez de folha (§3.2). A folha só valeria para frase longa, e a frase curta tem até 200 caracteres. Confirmar na revisão de UX.
2. **Paradas de Tab no `Choice`.** Cada "?" é uma parada (14 a mais nos clãs). A alternativa é pôr os "?" no foco itinerante do grupo (a seta passa por eles), o que foge do padrão de rádio da APG. Proposta: manter as paradas.
3. **Conferir as chaves das opções no `validateTemplate` do core.** Seria mais estrito, mas tiraria a folga que deixa o app antigo abrir um template com chave nova nas opções (§3.0). O Ajv do servidor já recusa chave desconhecida. Proposta: não conferir.
4. **Glossário único no template** (TL-19: `glossary` por nome) em vez de `help` em cada nó. Ele evita a repetição dos Arquétipos e casa pelo nome do item digitado, mas é chave nova no topo (derruba o app antigo em qualquer template que a use) e é ambíguo quando o mesmo nome tem dois sentidos ("Consciência"). Proposta: `help` em cada nó, com a regra de mesma frase para o mesmo nome no template.
5. **Sugestões em linhas** (§3.5): 42 linhas de 48 dp numa folha. Vale pôr um campo de busca no topo, como na `AddItemSheet`?
6. **Quem escreve o commit de integração** com as versões, a `0023` e os testes de versão: o orquestrador ou o último pacote de template a entrar (§3.10).
7. **Ajuda nas fichas antigas.** O app poderia buscar a frase na versão mais recente do template, pelo id do campo e da opção. Isso mistura duas versões numa tela. Proposta: não.
8. **"?" no modo Leitura e Jogo.** As folhas de detalhe já mostram o `help` (`FieldDetail.tsx:20`, `ResourceSheet.tsx:160`). Proposta: "?" só na criação, no Editar e na Nova ficha.

**Achados da onda 3 sem pacote ([onda-3.md](onda-3.md) §11):** nenhum encosta neste pacote. A observação 7 ("Nenhum Qualidade") é do P10-C (T-66).

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

Implementação em 04/11/2026, na `pacote/p10-d-ajuda-contextual`, a partir da ponta da onda (`78de35c`), em paralelo com os outros três pacotes. Os commits:

| # | Commit | Estado |
|---|---|---|
| 1 | `c31217d` feat(core): help nas opções, nos grupos e nos itens fixos do template | feito, sem as sugestões e o catálogo (desvio 1) |
| 2 | `260c503` test(api): publicação recusa ajuda com link ou grande | feito |
| 3 | `7660168` feat(ui): HelpButton e HelpText; help no Choice e no TextField | feito |
| 4 | `7a3026c` feat(app): "?" nas linhas da criação e do Editar | feito |
| 5 | `34fab93` feat(app): "?" em "Prioridade" e "pontos de bônus" | feito, no saldo (desvio 5) |
| 6 | `0b0dae1` feat(templates): Casa ou subgrupo, opcional, no Mago | feito |
| 7 | sugestões e catálogo com nome e ajuda | **adiado para o rebase** sobre o P07-D (desvio 1) |
| 8 | `13d013a` content(templates): frases do time | feito, sem o catálogo (desvio 7) |
| 9 | `4d67d86` test(e2e): ajuda contextual e Casa do Mago | escrito; roda na integração |

**Perguntas técnicas: o que foi aplicado** (proposta do plano, sem resposta do time):

- pergunta 1: a frase expande na linha (disclosure), sem folha nem tooltip;
- pergunta 2: cada "?" é uma parada de Tab. No `Choice`, as setas continuam só nos rádios, e o "?" fica fora do foco itinerante;
- pergunta 3: o `validateTemplate` do core continua sem conferir as chaves das opções. O Ajv da publicação confere;
- pergunta 4: `help` em cada nó, sem glossário;
- pergunta 8: o "?" só aparece na criação, no Editar e na Nova ficha. Em Jogo e Leitura, nada muda.

**Pontos para o PO (§9):** nenhum decidido. O ponto 1 segue a proposta: as duas frases do app ficam em `sheet/creation/help.ts`. O ponto 3 também: "Opcional" vai como `placeholder` e frase, sem chave nova.

**Desvios:**

1. **O commit 7 não entrou.** Ele depende da forma do catálogo do P07-D, em desenvolvimento noutro worktree ao mesmo tempo. Por isso:
   - o commit 1 não traz as sugestões nem o catálogo nas duas formas;
   - `entryName` e `entryHelp` não existem ainda.

   No rebase sobre o P07-D, o commit 7 segue a recomendação da consolidação (onda-4.md §4.3): a frase vai num mapa por nome, ao lado da lista. Ele traz as 34 frases do catálogo (Antecedentes: 10, 10 e 14).
2. **O link é recusado sem diferença de caixa,** inclusive "WWW." (depois da revisão, só na publicação: ver abaixo). O `not` do schema passou a `(://|[wW]{3}\.)`. O core e o `validate.mjs` também recusam tab e quebra de linha na ajuda ("ajuda em uma linha só"). O `isSafeText` aceita os dois, e o schema já os proibia.
3. **A regra "sem link" vale para todo `$defs/helpText`,** não só o `help` do campo. Isso inclui o `note` das opções de `state` e o `help` das ações e das recuperações. Nenhum template tem link (conferido pelo `build.mjs`).
4. **O "?" do cabeçalho de lista fica no `ListEditor`,** num `EditorListHeader`, não no `ListHeader` da `views/`. O `ListHeader` é do modo Jogo e Leitura, que ficam sem "?" (pergunta 8).
   - **No bloco que o título nomeia** (T-58), o "?" da lista vai no título do grupo.
   - **Quando o título é o da seção,** a frase vem logo abaixo dele (W20 "Dons", M20 "Antecedentes").
5. **O "?" dos pontos de bônus fica no saldo da aba da conta,** não no rótulo da aba. O rótulo é o "Orçamento", que o P05-D troca por "Pontos" ao mesmo tempo. Assim, o rebase sobre o P05-D é só textual.
6. **Os grupos de seção liam a frase do `section.def.groups`,** sem mudar o `CompiledGroup`. A revisão (item 10) desfez isso: a frase vai no `CompiledGroup`.
7. **Commit 8: as frases do `P10-D-frases.json`, menos o catálogo.** Elas entraram por um script de edição textual, que deixa o resto do arquivo como estava. Cada objeto que ganhou `help` passou para várias linhas.

   | Template | Campos | Grupos | Opções |
   |---|---|---|---|
   | V20 | 11 | 7 | 14 |
   | W20 | 10 | 7 | 21 |
   | M20 | 12, mais a Casa do commit 6 | 7 | 14 |

   - **Ações nos `help` de hoje:**
     - "junta" usa a frase da lista, que já inclui o que a de hoje explicava;
     - "substitui" troca a frase (Gnose);
     - "mantém" não muda nada (roda);
     - a Fraqueza ficou com o P07-D.
   - **Os outros 15 `help` de hoje** ficaram como estão: Consciência (Talento e Virtude), Qualidades e Defeitos (nos três), Deformidade, Glória, Ritos, Fetiches, Rotinas, Ressonância e Maravilhas. A revisão 6 da §3.8 só passou pelos 7 que a lista cobre. O corpo do commit 8 cita "Prontidão" por engano: o Talento de que se trata é a Consciência.
   - **Um teste Bun** (`help-phrases.test.ts`) confere a lista contra os templates.
8. **Fora da §8.5:** `design/telas/validate.js` e `design/telas/dados.js`, que o `build.mjs` gera, e `sheet/views/__tests__/matrix.test.tsx`.
   - No `matrix.test.tsx`, o teste de "rótulo começa pelo texto visível" pula o "?". O "?" é botão de ícone, com o nome "Ajuda: <campo>", como o `IconButton`.
   - Arquivos novos: `evolve/HelpRow.tsx`, `layouts/groupHelp.tsx` e `creation/InlineHelp.tsx`.
9. **O E2E** ganhou o `exact` em Conceito, Natureza, Comportamento e Senhor, e a Casa ganhou o `exact` no commit 6. Um script conferiu os outros seletores de botão e de rótulo, e nenhum fica ambíguo. O `help.spec.ts` usa a folha do Clã no Editar, em vez da folha da Força de Vontade, para provar o Esc dentro da folha. A Força de Vontade é uma linha com Stepper, sem folha.

**Correções do `/code-review` (high) da integração:**

| Item | Commit | O que mudou |
|---|---|---|
| 2 e 8 | `7357ec4` | O "sem link" e a linha única saem do `validateTemplate` e vão para o `publicationIssues` (core e `validate.mjs`), que o `publishTemplate` e o `build.mjs` rodam. A regra vale nos 11 nós de `$defs/helpText` e `helpShort` do schema, com as mesmas mensagens nas duas camadas que não são o Ajv. Um teste confere a lista de nós contra o `schema.json`. O `compileTemplate` do app fica tolerante com versões antigas, e a escrita (publicação) fica estrita. O `git log -p` dos templates não mostra `://` nem `www.` em nenhum `help` ou `note` publicado |
| 3 | `7357ec4`, `e7dc167` | A opção de `tags` deixa de aceitar `help`, porque o app não a desenha (schema, tipo e validadores). O `help` do item `fixed` é desenhado como texto no topo da `ItemSheet` (a Ressonância do M20) |
| 10 | `3e4b91d` | O `help` do grupo vai no `CompiledGroup` (o `dist` foi refeito). Os layouts leem `g.help`, e o `groupHelpOf` sai |
| 1 | `d72b00e` | O `HelpText` é uma região viva sempre montada. Fechada, ela fica vazia e fora do fluxo, e só o conteúdo muda. O web e o Android anunciam a frase, e o `aria-controls` sempre aponta um elemento que existe |
| 7 | `d72b00e` | No `Choice` com frase em 2 colunas, a célula tem `flexBasis` 240 e cresce. Não há mais medida com `onLayout` nem o salto de 1 para 2 colunas |
| 9 | `d72b00e` | O `WithHelp` do `@tms/ui` é a composição única de [conteúdo][?] com a frase embaixo. Usam: `Choice`, `TextField`, `HelpRow`, o cabeçalho da lista, o título e a linha do grupo, a Prioridade e o saldo. O `InlineHelp` sai, e o `TextEditor` usa o `fieldHelp(def)`. O `EditorShell` continua com `useHelp`, porque a frase vai na largura da linha |
| 6 | `d72b00e` | No bloco que o título nomeia, um "?" mostra a frase do grupo e a da lista juntas: a do grupo primeiro, e a repetida sai (`blockHelp`). No ramo echo, a frase do grupo não se perde. Os itens 1, 7, 9 e 6 ficaram num commit só porque mudam a mesma API (`HelpText`) e os mesmos arquivos |
| 5 | `908c9b6` | A frase da Prioridade não cita mais "Atributos e Habilidades" e termina com "Cada conjunto de grupos tem a sua própria ordem.". O `P10-D-frases.json` e o `.md` têm a mesma frase. Um teste confere que as frases do app não citam nome de nenhum dos seis templates |
| 4 | — | Fica como está. A frase dos pontos de bônus diz "a aba Pontos", e esse texto depende do P05-D, que entra antes no merge e renomeia a aba. Sem o P05-D, a aba ainda se chama "Orçamento" |

O "Jest did not exit" não vem dos testes novos. Com `--detectOpenHandles`, eles não deixam nada aberto: `help.test.tsx` do app e do `@tms/ui`, `creation/__tests__/help.test.ts` e `new-character.test.tsx`. A origem não foi conferida na base.

**Merge da onda, commit 7 e commit de versão** (05/11/2026, depois das correções da revisão):

1. **Merge da `onda/4-conteudo-guia`** (P05-D, P10-C e P07-D, `1762d0d`): `18646f4`. Os conflitos foram resolvidos no próprio merge:
   - **templates:** o `recommend` do P07-D convive com o `help` do P10-D no mesmo campo, e a `weakness.help` ficou a do P07-D;
   - **README §12:** as duas regras de licença;
   - **`ChoiceEditorRow` e `TextEditorRow`:** a linha [botão][?], com o "fora da Tradição" e o "Resumo de …" dentro do botão;
   - **`ListEditor`:** a linha do item com −/+ do P07-D, sem "?" (§4.4), e o "?" no cabeçalho da lista;
   - **`GroupsLayout`:** a âncora e o `AnchorHeader` do P05-D, com o "?" do bloco no título;
   - **`CreationPanel`:** o "?" do saldo fica na aba "Pontos".
2. **Commit 7** (`04ce3cf`), na forma da consolidação: um mapa por nome ao lado da lista, sem a forma de objeto.
   - **Chaves:** `catalogHelp` (lista, até 200 nomes) e `suggestionHelp` (texto, até 100).
   - **Paridade nos quatro:** o schema, o `validateTemplate`, o `validate.mjs` e o `publicationIssues`. Nome fora da lista é recusado, e cada frase tem até 200 caracteres, uma linha e nenhum link.
   - **Onde o "?" aparece:** na opção da `AddItemSheet`, à direita do selo, e nas sugestões com frase, que viram linhas [chip][?]. Para o item já na ficha, a frase vai no topo da `ItemSheet`.
   - **Conteúdo:** as 34 frases de Antecedentes, conferidas pelo `help-phrases.test.ts`.
   - **Desvio:** a regra "mesma frase para o mesmo nome em duas listas do template" (§3.1) não entrou. Ela não tem uso hoje, porque nenhuma sugestão tem frase. Fica para quando os Arquétipos ganharem frase.
3. **Commit de versão** (`chore(templates): vtm-v20 1.9.0, wta-w20 1.7.0, mta-m20 1.7.0`), o último da branch. Ele traz:
   - os três `templateVersion` e a `0023_templates_onda4.ts`, só de dados, cópia da `0020`, com `down` vazio como o dela;
   - os testes do `@tms/db` para ela;
   - os testes que fixam versão. No `publish.test.ts`, o banco "sem os templates do produto" passa a tirar também a `0023`, e o caso "uma versão nova convive" monta a 1.10.0.

   A `0023` roda no deploy da API. O app nativo da versão anterior mostra "Atualize o app" nas fichas novas até a loja ter o app novo (§6, ponto 3, da onda; sem decisão).

**Verificação, na ponta da branch:** `npx pnpm build`, typecheck, lint, `build.mjs` e `validate.mjs` dos 6 templates, todos verdes.

| Pacote | Testes |
|---|---|
| core | 1117 |
| db | 39 |
| config | 38 |
| api | 1921 (65 pulados) |
| ui | 226 |
| frontend | 1577, com `--forceExit` |

**Para a integração:**

- ~~o merge da onda, o commit 7 e o commit de versão~~: feitos (acima);
- o E2E inteiro (com o `help.spec.ts`);
- o roteiro manual da §11;
- o `/code-review` e o `/security-review`.

As frases são rascunho do time, para revisão. O merge na `main` espera a revisão de quem conhece cada sistema.

## 11. Testes manuais (web, Android com AVD, iOS com idb)

Roteiro para conferir cada item na interface, nas três plataformas, com a API local e o seed do roteiro. Só contas fictícias. Ele detalha o passo 6 da §7. A coluna "Resultado" fica em branco e é preenchida na integração. Nenhum resultado é "ok" sem a evidência; quando uma plataforma não puder ser conferida, o resultado diz "não conferido" e por quê.

### 11.a Preparação

1. **Banco e API.** No branch do pacote, os templates mudam sem subir a versão (§3.10). Por isso:
   - um banco próprio do pacote no mesmo Postgres local, como o `tms_p07d` do P07-D: `createdb tms_p10d` e `DATABASE_URL=…/tms_p10d` (credenciais locais do `docker-compose.yml`) com `npx pnpm db:migrate`. O banco novo grava o conteúdo atual dos três templates pela `0020`. **Sem `db:down`** (consolidação, [onda-4.md](onda-4.md) §4.6): o Postgres do Docker é um só para todos os worktrees, e o `db:down` apagaria o banco dos outros pacotes;
   - na integração, com a versão nova e a `0023`, basta `npx pnpm db:migrate`;
   - `npx pnpm -C packages/sheet-core build` antes da API, que lê o `dist`;
   - API em `npx pnpm dev:api` (porta 3001) e o Metro em `cd apps/frontend && npx expo start` (porta 8081).
2. **Seed:** `npx pnpm seed:roteiro > <scratchpad>/p10d/seed.log 2>&1`. A saída tem a senha e os e-mails: ler só com `grep -v -i senha`.
   - **Contas:** N (`roteiro_narrador`), J1 (`roteiro_jogador1`), J2 (`roteiro_jogador2`) e N2 (`roteiro_narrador2`), todas `@roteiro.test`. A senha é a constante do `scripts/seed-roteiro.ts` e não é escrita aqui nem nas evidências; os scripts de login a leem em tempo de execução.
   - **Crônicas, com sufixo de data:** "Vampiro v3/v5", "Mago v3/v5" e "Lobisomem v3/v5" (livre) e "Vampiro v4", "Mago v4" e "Lobisomem v4" (por pontos, aprovação desligada), com J1 e J2 dentro; "Vampiro limite 20".
   - Entre dois seeds, 15 minutos (limite de aceites de convite). Um seed por plataforma.
   - O `--fichas-criacao` não é preciso: este roteiro cria as fichas pela tela, porque a Nova ficha faz parte do teste.
3. **O que o roteiro cria pela tela:**
   - J1, em "Mago v4": **"Verbena R"**, Tradição Verbena (não a Ordem de Hermes), **sem** Casa; e **"Éter R"**, Sociedade do Éter, com "Casa ou subgrupo" preenchida (fictício: "Grupo de teste");
   - J1, em "Vampiro v4": **"Brujah R"**, para o Clã, as Habilidades e as Virtudes na criação;
   - J1, em "Lobisomem v4": **"Ahroun R"**, para Raça, Augúrio e Tribo.
4. **Frases no template.** O roteiro confere o mecanismo nos campos que já têm `help` (Consciência, Força de Vontade, Arete, Gnose, Glória) e, se o commit 8 entrou, nos termos da prioridade 1. Opção sem frase no template fica "não conferido: sem frase no template", não "ok".
5. **Evidências:** no scratchpad, `p10d-<plataforma>-<ID>-<passo>.png`. Sem e-mail visível na captura.

### 11.b Web (Playwright, Chromium; WebKit onde indicado)

- **Script:** `<scratchpad>/p10d/web.mjs` com o `playwright` do `node_modules`, contra `http://localhost:8081` (Metro). Reiniciar o Metro com `--clear` antes da rodada.
- **Viewports exatas:** `{ width: 390, height: 844 }` e `{ width: 1280, height: 800 }`.
- **WebKit:** R-19a e R-19c também em `webkit.launch()` (o `aria-expanded` e o Espaço no Safari).
- **Seletores por papel e rótulo, com `exact`:**
  - `getByRole('button', { name: 'Ajuda: Consciência', exact: true })`;
  - `getByRole('button', { name: 'Ajuda: Clã', exact: true })`;
  - `getByRole('radio', { name: 'Brujah', exact: true })`;
  - `getByLabel('Casa ou subgrupo', { exact: true })`;
  - `getByRole('button', { name: 'Criar ficha' })`.
- **Medidas no DOM:** a caixa do "?" (`boundingBox` ≥ 44); numa folha, o painel `bottom-sheet-root > [aria-modal="true"]`, não a camada.
- **Um `page.screenshot` por passo.**

### 11.c Android (AVD)

- **AVD:** `Pixel_3a_API_34_extension_level_7_arm64-v8a` (393 dp), boot rápido com `-gpu host`; APK do `assembleDebug` arm64, com `JAVA_HOME` no JBR do Android Studio.
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Larguras:** a linha com "?" e Stepper é de layout: também `adb shell wm density 480` (360 dp) e `420` (411 dp), com `adb shell wm density reset` no fim.
- **Teclado de software:** `adb shell settings put secure show_ime_with_hard_keyboard 1` para a Nova ficha.
- **Navegação:** `adb shell uiautomator dump /sdcard/ui.xml` e `adb pull`; achar o alvo pelo `content-desc` ("Ajuda: Consciência") e tocar no centro do `bounds` com `adb shell input tap X Y`; `adb shell input keyevent 4` para o voltar do Android com a folha aberta. O `input text` não digita acento: escolher da lista sempre que der (a Tradição e o Clã são rádios).
- **LogBox:** dispensar o banner antes de tocar perto do pé da tela.
- **Tempo** medido no emulador sob carga não é evidência; desligar o AVD antes do iOS.

### 11.d iOS (simulador, com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, e iPhone 17, iOS 26.5.
- **Build Debug com "Sign to Run Locally"**, em `apps/frontend/ios` ([onda-3.md](onda-3.md) §11, item 15): sem assinatura, o app não loga (o keychain responde `-34018`). O CI continua sem assinatura.

  ```bash
  xcodebuild -workspace TMS.xcworkspace -scheme TMS -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath <scratchpad>/ios-dd CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build
  ```

  Depois: `xcrun simctl install <UDID> <scratchpad>/ios-dd/Build/Products/Debug-iphonesimulator/TMS.app` e `xcrun simctl launch <UDID> com.tms.app`.
- **Cliente fb-idb:** o venv `~/.venvs/idb-tms` já existe, fora do repositório, com `fb-idb` 1.7.7. Rodar `~/.venvs/idb-tms/bin/pip-audit` antes de usar; com vulnerabilidade, parar e registrar. Nunca no `package.json` nem no lockfile.
- **Companion:** `--companion-path /opt/homebrew/bin/idb_companion` vem antes do subcomando. Ele fica só local, no socket de domínio; no fim, `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` não mostra nada.
- **Navegação:** `idb ui describe-all --udid <UDID>` para achar o alvo pelo `AXLabel` ("Ajuda: Clã") e tocar no centro do `frame`; `idb ui text`, `idb ui swipe` e `idb ui key`; `idb screenshot` para a evidência.
- **Limites do idb:** não faz o gesto de borda (usar o "‹"); não digita fora do ASCII (escolher da lista; o nome da ficha sem acento); digita como teclado físico, e o teclado de software some depois do primeiro texto. O deep link `tms://` pede "Abrir com 'TMS'?": tocar "Abrir" pelo idb.

### 11.e Tabela por item

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| R-19a | Web 390 (Chromium e WebKit) | J1 | "Brujah R" → Criação → Habilidades → Talentos → "Ajuda: Consciência" pelo toque; depois Tab até ele, Enter, Espaço | O texto aparece sob a linha e some; `aria-expanded` alterna; o "+" e o rótulo dentro da tela | `p10d-web390-R-19a-1..3.png` | |
| R-19b | Web 390 | J1 | Vantagens → Virtudes → Consciência → "?" | Frase diferente da do Talento | `p10d-web390-R-19b-1.png` | |
| R-19c | Web 390 (Chromium e WebKit) | J1 | Em Jogo → Força de Vontade (folha) → "?" expandido → Esc | A folha fecha com o Esc e o foco volta ao gatilho; a ajuda não segura a folha | `p10d-web390-R-19c-1..2.png` | |
| R-19d | Web 390 | J1 | Nova ficha (Vampiro) → "Ajuda: Clã"; opção com frase → "?"; "Escolher da lista" de Natureza | Título e "?" na mesma linha; grade em 1 coluna se houver frase nas opções; sugestões em linhas com "?" se houver frase, chips se não | `p10d-web390-R-19d-1..3.png` | |
| R-19e | Web 390 | J1 | Criação → "Prioridade" de Atributos → "?" | Frase genérica da prioridade, sem número fixo | `p10d-web390-R-19e-1.png` | |
| R-19f | Android 393, 360 e 411 dp | J1 | R-19a e R-19d no AVD; a 360, a linha de "Empatia com Animais" | O "?" com 48 dp no `bounds`; o rótulo quebra em duas linhas, o "+" visível; o voltar do Android com a folha de "Escolher da lista" aberta fecha a folha, não a tela | `p10d-and393-R-19f-1.png`, `p10d-and360-R-19f-2.png`, `p10d-and411-R-19f-3.png` | |
| R-19g | Android 393 | J1 | "Ahroun R" → Nova ficha (Lobisomem) → Raça, Augúrio e Tribo | "Ajuda: Raça", "Ajuda: Augúrio", "Ajuda: Tribo" no `dump`; opções com frase com "?" ao lado, fora do rádio | `p10d-and393-R-19g-1..2.png` | |
| R-19h | iOS SE e iPhone 17 (obrigatório: IA-06) | J1 | Nova ficha (Vampiro) → "Ajuda: Clã" pelo idb; "Escolher da lista" de Natureza; uma sugestão com "?" | O texto aparece e é anunciado; a folha de sugestões abre e fecha; no 17, nada sob a Dynamic Island | `p10d-iosSE-R-19h-1..3.png`, `p10d-ios17-R-19h-4.png` | |
| R-19i | iOS SE | J1 | "Brujah R" → Vantagens → "Adicionar Disciplina" → "?" numa opção com frase | O "?" ao lado da opção, fora do botão; tocar o nome adiciona, tocar o "?" só expande | `p10d-iosSE-R-19i-1..2.png` | |
| U-06a | **Web 1280 (obrigatório)** | J1 | "Mago v4" → Nova ficha → nome "Verbena R" → Tradição Verbena → Essência qualquer → deixar "Casa ou subgrupo" vazio → "Ajuda: Casa ou subgrupo" → "Criar ficha" | Rótulo "Casa ou subgrupo" com o `placeholder` "Opcional"; a frase diz que é opcional; a ficha é criada e a identidade mostra "Casa ou subgrupo" vazio | `p10d-web1280-U-06a-1..3.png` | |
| U-06b | Web 1280 | J1 | Nova ficha → "Éter R" → Sociedade do Éter → "Casa ou subgrupo" preenchida → criar → Editar → trocar a Tradição para Ordem de Hermes | A Casa continua visível e com o valor em todas as Tradições; nenhum campo some | `p10d-web1280-U-06b-1..2.png` | |
| U-06c | Web 390 e Android 393 | J1 | U-06a | "Casa ou subgrupo" inteiro na coluna (ao lado de "Conceito"), sem corte; "Opcional" visível | `p10d-web390-U-06c-1.png`, `p10d-and393-U-06c-2.png` | |
| U-06d | iOS SE | J1 | U-06a pelo idb | `AXLabel` "Casa ou subgrupo"; o "?" com "Ajuda: Casa ou subgrupo"; ficha criada sem Casa | `p10d-iosSE-U-06d-1..2.png` | |

### 11.f Acessibilidade mínima

O "?" tem nome acessível "Ajuda: <campo>" (ou "Ajuda: <opção>") e abre pelo toque e pelo teclado, conferido na árvore das três plataformas:

- **Web (DOM):** um `button` com `aria-label="Ajuda: Consciência"`, `aria-expanded` que alterna e `aria-controls` apontando um elemento que existe, com `aria-live="polite"`. Enter e Espaço abrem. O rádio da opção mantém o nome de hoje, e o grupo continua nomeado só pelo título (`aria-labelledby`).
- **Android (`uiautomator dump`):** o `content-desc` "Ajuda: …" num nó clicável, separado do nó do rádio ou da linha; o texto expandido aparece como `TextView` logo depois.
- **iOS (`idb ui describe-all`):** um elemento com `AXLabel` "Ajuda: …" e traço de botão; depois do toque, o texto da ajuda na árvore, como texto estático.
- **Selos e −/+ do P07-D** na mesma linha: o selo entra no nome da opção e o −/+ tem o nome do item ("Aumentar Potência"). Conferir junto, se o P07-D já estiver na onda.
- O "?" nunca depende só do glifo: o nome diz "Ajuda", e a captura em escala de cinza mostra o mesmo.

### 11.g Limpeza

- Parar a API e o Metro.
- Desligar o AVD (`adb emu kill`) e os simuladores (`xcrun simctl shutdown all`).
- `adb shell wm density reset` e `adb shell settings put secure show_ime_with_hard_keyboard 0`.
- Encerrar o `idb_companion`, sair do venv e conferir com `lsof` que nada escuta.
- Manter as capturas e o log do seed no scratchpad até a integração. Nada vai para o repositório.

### 11.h Quando uma plataforma não puder ser conferida

O resultado diz "não conferido" e o motivo, por exemplo:

- "sem frase no template para as opções de Clã";
- "o build do iOS falhou em …";
- "o emulador ficou ocupado sob carga".

O passo fica para a integração ou para o roteiro antes do release. Nunca "ok" sem a evidência.
