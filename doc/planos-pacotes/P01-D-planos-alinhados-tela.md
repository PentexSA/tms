# P01-D · Planos alinhados com a tela: plano de implementação

> Plano · 2026-11-05 · base conferida: `onda/5-narrador-entrada-uso` em `05c5d7d`

Este plano implementa o pacote [P01-D da matriz de achados](../testes/2026-11-01/matriz-achados.md#p01-d), da onda 5, que aplica a decisão D-13. Ao fim do pacote:

- os planos v0, v1, v2 e v4 descrevem a tela nas 5 divergências da D-13: o nome do modo, o Posto na identidade do W20, a prevenção ao concluir com grupo incompleto, a Esfera acima do Arete na criação e a Geração derivada do Antecedente;
- os planos registram o que ajuda e não estava escrito ("Escolher da lista", a folha de bônus, o "O que falta") e, numa seção nova em cada plano, as decisões D-00 a D-17 que mudam o que o plano descreve;
- o `doc/proximas-features.md` registra o "Reabrir criação" (D-04);
- o fato do PR #49 (o CI não compila mais o nativo) fica escrito nos documentos que ainda dizem o contrário, sem editar a matriz e sem tratar a revisão da D-00 como decidida;
- o `CLAUDE.md` passa a ter as contagens de testes do fim da onda 5.

É um pacote só de documentação. Ele não muda código, template, API nem `@tms/ui`. Não remove campo, não muda regra do jogo e não afrouxa limite. O servidor continua a autoridade, e o texto novo descreve o que o servidor e a tela já fazem. **O texto não decide nenhum ponto para o PO:** onde a tela segue uma recomendação técnica ainda sem resposta (por exemplo, o "Concluir criação" escondido), o plano descreve o que a tela faz hoje e aponta o ponto em aberto.

O P01-D entra **por último** na onda, porque registra o que os outros seis pacotes da onda 5 mudaram (P09-D, P12, P13, P14-D, P15-D e P16-D). As partes que dependem deles ficam com o marcador **`[a preencher: Pxx]`** neste plano e no texto dos commits até o merge do pacote correspondente (§3.13).

As linhas citadas são do `05c5d7d`. A matriz não cita linha de código para o U-08, só os quatro planos. Onde a matriz e o relatório de usabilidade localizam a divergência de um jeito que não bate com o documento, a §3 diz.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md): legenda, "Ondas e pacotes", "Decisões de produto" (D-00 a D-17, em especial D-13), "Como executar" (com "Decisão revista"), "Onda 5" e §P01-D | Item, decisão, "PR local" e critério de saída |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §8 (tabelas de aderência dos planos v0 a v5 e "O que sobra") | A base do U-08: onde cada jornada difere do plano |
| Notas: [po-web](../testes/2026-11-01/notas/po-web.md) (l.4, l.25, l.28, l.40, l.194, l.210-218, l.269-273) e [po-app](../testes/2026-11-01/notas/po-app.md) (l.4, l.20, l.53-55, l.241-247) | As duas personas que acharam as divergências (PO-W e PO-A) |
| [plano-v0.md](../plano-v0.md) a [plano-v5.md](../plano-v5.md), [regras-wod.md](../regras-wod.md), [proximas-features.md](../proximas-features.md), [plano-observabilidade.md](../plano-observabilidade.md) | Os documentos que o pacote muda |
| [onda-1.md](onda-1.md) §6 e §9, [onda-2.md](onda-2.md) §6 e §10, [onda-3.md](onda-3.md) §6 e §11, [onda-4.md](onda-4.md) §2, §6 (pontos 2 e 16), §11 e §12 | O que cada onda entregou, o que ficou para o PO e o que só a integração viu |
| [P03-D](P03-D-salvar-concluir.md) l.70 e l.73, [P04-D](P04-D-estado-proximo-passo.md) l.54, [P07-D](P07-D-vantagens-regras-catalogo.md) l.64, [P09-C](P09-C-narrador-mesa.md) l.51, [P05-D](P05-D-guia-o-que-falta.md) l.27, l.60 e l.289 | O que os pacotes das ondas 3 e 4 deixaram para o P01-D |
| [P01-C](P01-C-build-setup.md) §3.1 e os jobs nativos; PR #49 (`5854cf6`, merge `c96f2d4`) | A D-00 como foi implementada e como saiu do CI |
| Planos irmãos da onda 5: [P09-D](P09-D-mesa-progresso-criacao.md), [P12](P12-convite-entrada-navegacao.md), [P13](P13-ficha-em-uso-xp-jogo.md), [P14-D](P14-D-cronica-leitura.md), [P15-D](P15-D-historia-personagem.md), [P16-D](P16-D-revelar-nota-narrador.md) | O que cada um muda na tela e que o P01-D registra (§3.13) |
| [CLAUDE.md](../../CLAUDE.md) l.123-129 | As contagens de testes |

## 1. Objetivo e itens

**Objetivo (matriz).** Os planos v0, v1, v2 e v4 descrevem o comportamento atual e as decisões D-00 a D-14 (D-13), e o `proximas-features.md` registra o "Reabrir criação" (D-04), para a próxima validação comparar com o certo.

| ID | Sev. | Em uma linha | Onde está (conferido no `05c5d7d`) |
|---|---|---|---|
| U-08 | baixa | A tela difere dos planos sem que eles registrem: o modo se chama "Editar"/"Criação", não "Evoluir"; o W20 pede o Posto na identidade; concluir com grupo incompleto é prevenido, não recusado; a Esfera acima do Arete é bloqueada na criação; a Geração não está no formulário. E o que ajuda não está em plano: "Escolher da lista", a folha de bônus e o "O que falta" | Os cinco lugares estão na §3.1 a §3.5, com a linha do plano e a do código que mostra a tela de hoje. Os três "o que ajuda" estão na §3.6 |

**Também entram** os pontos que as ondas anteriores deixaram para este pacote:

| De onde | O que | Seção |
|---|---|---|
| [P03-D](P03-D-salvar-concluir.md) l.73 | O "resumo do Concluir" nos planos: v0 l.736, v1 l.244 e v2 l.235 (D-01) | §3.7 |
| [P07-D](P07-D-vantagens-regras-catalogo.md) l.64 | `regras-wod.md` l.72-78 ("O que fica com o narrador"): a conta continua sem cobrar, e a tela agora recomenda e avisa | §3.8 |
| [P04-D](P04-D-estado-proximo-passo.md) l.54, [P03-D](P03-D-salvar-concluir.md) l.70, [P09-C](P09-C-narrador-mesa.md) l.51 | "Reabrir criação" (D-04) no `proximas-features.md` | §3.11 |
| [onda-4.md](onda-4.md) §6, ponto 16 | A D-00 depois do PR #49: onde fica escrito, sem editar a matriz | §3.10 |
| [onda-4.md](onda-4.md) §6, ponto 2 | O "Concluir criação" escondido até a conta fechar: o plano-v4 descreve a tela de hoje e aponta o ponto em aberto | §3.3 |
| Brief da onda 5 | As contagens de testes do `CLAUDE.md` (core 981, api 1936, ui 197, frontend 1387; db 35) | §3.12 |

## 2. Decisões aplicadas

| Decisão | O que diz (matriz) | Como o pacote acomoda |
|---|---|---|
| **D-13** (U-08) | Os planos mudam nas 5 divergências: o nome do modo ("Editar"/"Criação", não "Evoluir", v0 §1.5), o Posto na identidade do W20 (v2 §1.2), prevenir em vez de recusar ao concluir com grupo incompleto (v4 §1.4), a Esfera acima do Arete bloqueada já na criação (v1) e a Geração derivada do Antecedente (v0 §1.4). Entram também "Escolher da lista", a folha de bônus, o "O que falta" e as decisões D-00 a D-14 | Cada divergência é corrigida no item da jornada do §1 do plano, sem renumerar a lista (§3.0). As decisões entram numa seção nova de cada plano, "Depois do teste com personas (ondas 1 a 5)", uma linha por decisão, com a onda, o pacote e o ponto do PO que segue em aberto (§3.9) |
| **D-04** (parte) | "Reabrir criação" de ficha concluída fica fora deste ciclo e é registrado em `proximas-features.md` (P01-D) | Uma entrada nova, que diz o que a feature precisa decidir, sem desenho (§3.11) |

**Fica fora deste pacote:**

- **Mudar a tela.** A D-13 escolheu alinhar os planos à tela, não o contrário ("Descartadas: decidir uma a uma"). O que a tela faz e um ponto do PO ainda discute (o "Concluir" escondido, a marca da folha de bônus no aparelho) continua como está.
- **A matriz** (`matriz-achados.md` e `matriz-achados.csv`). Ela não é editada pelo P01-D (§3.10). A alteração local sem commit da seção "Tamanho das ondas" também não é deste pacote.
- **Os planos de pacote das ondas 1 a 4** (`doc/planos-pacotes/P*.md`) e os `onda-N.md`. São o registro do que foi planejado e feito; o P01-D não os reescreve. O `onda-5.md` é do orquestrador.
- **Os documentos de contrato e de design** que usam "Evoluir" como nome do modo interno (`evolve`): `design/templates/README.md` (8 vezes), `design/design-system/components.md` (16), `doc/painel-narrador.md` (8) e `doc/arquitetura-motor-de-ficha.md` l.616. O id interno continua `evolve` (`ModeBar.tsx:52-57`), e esses documentos falam do contrato, não da tela. O registro de cada plano diz a ponte numa linha (§3.1).
- **O conteúdo que precisa de revisão** (as frases, os resumos da Fraqueza, o catálogo de Dons contra o livro; onda-4 §11 e §12.7). O registro diz que é rascunho do time e não o dá como conferido.

**O que o código mostra que não se aplica como está escrito** (apontado, não decidido; vai para o PO na §9):

1. **"D-00 a D-14".** A D-13 foi escrita em 01/11, antes da D-15 a D-17 (03/11). O brief da onda pede o registro até a D-17. O plano registra as 18, com as três últimas dependendo do P14-D, do P15-D e do P16-D.
2. **"Prevenir em vez de recusar".** É metade do que acontece. A tela previne (o "Concluir criação" só aparece com a conta fechada), e o servidor continua recusando a conclusão com a conta aberta (`apps/api/src/sheets/creation.ts:665` e `:761`, `completionRefusal`). O plano-v4 passa a dizer as duas coisas (§3.3).
3. **"A Esfera acima do Arete bloqueada já na criação".** Vale para a criação **por pontos** (o `hard-cap` do template). No Editar (criação livre ou o narrador), a Esfera acima do Arete continua aceita e inativa, como o plano-v1 diz e o `journey-mage.spec.ts:80-108` prova. O item do plano ganha a distinção, não a troca (§3.4).
4. **"v0 §1.5", "v2 §1.2", "v4 §1.4", "v0 §1.4".** Os planos não têm subseção §1.N: é o item N da lista numerada do §1. A §3 dá a linha de cada um.
5. **A matriz cita os planos v0, v1, v2 e v4.** O mesmo "Evoluir" da divergência 1 está no plano-v3 (§1, item 1, l.28), e a D-10, a D-15 e a D-17 mudam o que o v3 e o v5 descrevem. O plano propõe os dois num commit à parte, que sai sozinho se o PO quiser só os quatro (§8.1, commit 5).

**Pontos para o PO das ondas anteriores que tocam este pacote** (continuam abertos; o texto dos planos os aponta e não os trata como decididos):

- **[onda-4.md](onda-4.md) §6, ponto 2: "Concluir criação" escondido até a conta fechar.** O plano-v4 §1, item 4, descreve a tela de hoje e diz que é ponto em aberto (§3.3).
- **[onda-4.md](onda-4.md) §6, ponto 16: a D-00 depois do PR #49.** O registro diz o fato (os jobs saíram, a integração compila à mão) e que a revisão da decisão está com o PO (§3.10).
- Os pontos que os registros citam, sem mudar: [onda-3.md](onda-3.md) §6, ponto 1 (rótulo "Salvar" no Editar) e ponto 3 (ficar no Editar depois de salvar); [onda-4.md](onda-4.md) §6, pontos 4 (folha de bônus no aparelho), 6 (D-06 e o template), 7 (D-08 nos Dons), 8 (Fraqueza como padrão mostrado), 9 (fichas na versão anterior), 10 (frases de poderes; a decisão do usuário de 05/11 está no §4.9) e 15 ("Orçamento" nas regras da crônica).

## 3. Desenho por item

### 3.0 Como o P01-D escreve nos planos

- **O §1 de cada plano é a jornada que a próxima validação compara com a tela.** É ali que as divergências são corrigidas, no próprio item.
- **Sem renumerar.** Os specs citam os itens pelo número (`journey.spec.ts:4`, `journey-mage.spec.ts:5` e `:80` "3 e 4. Editar", `journey-werewolf.spec.ts:5`). O texto do item muda; o número e a ordem ficam.
- **Cada correção leva a marca "(D-13)"** no fim do item, como o plano-v4 §3.4 já faz com "(onda 3, P04-D)" (`b4aaee0`). Quem lê sabe que o texto foi revisto depois do plano e por quê.
- **O histórico fica.** O "Estado da vN" e as Etapas são o registro de como cada versão foi construída. Onde uma Etapa afirma como contrato algo que a tela não faz mais (o `generation.default: 13`, o "formulário mostra a geração", o Posto que "o formulário não mostra"), entra uma linha "Revisto: …" logo abaixo, com o commit ou a onda que mudou. O texto antigo não é apagado.
- **Uma seção nova em cada plano:** "## Depois do teste com personas (ondas 1 a 5)", logo depois do "Estado da vN" (no v4 e no v5, logo depois do §1). Ela tem:
  - uma frase de abertura: o teste de 01/11/2026, a matriz e a D-13;
  - a tabela "Decisão | O que muda nesta jornada | Onda e pacote | Em aberto", só com as decisões que tocam aquele plano (§3.9);
  - "Correções que mudam o que o §1 descreve": os achados corrigidos que mudam um passo da jornada, uma linha cada, com o ID e a onda;
  - o que ainda não foi conferido na tela (por exemplo, o catálogo de Dons contra o livro).
- **Sem dado de conta.** Nenhum e-mail, senha, código de convite, captura ou dado de produção entra nos planos. O U-10 cita o tamanho de um texto em produção: o registro da D-16 não repete nem esse número.
- **Links relativos**, como os planos já usam, e conferidos por script (§4.1).

### 3.1 Divergência 1 · O nome do modo: "Editar" e "Criação" (v0 §1, item 5)

**Onde o plano diverge:**

- `doc/plano-v0.md:29`, item 5: "A ficha abre em **Evoluir**: …";
- `doc/plano-v3.md:28`, item 1: "… distribui os pontos em Evoluir." (fora da lista da matriz; §2, item 5);
- `doc/plano-v0.md:30`, item 6: "A ficha abre em **Leitura** e **Jogo**" para o dono. Veio no mesmo commit da troca de nome e é a mesma divergência, vista de outro lado.

**O que a tela faz (conferido):**

- os rótulos são `read: 'Leitura'`, `play: 'Jogo'`, `evolve: 'Editar'`, `create: 'Criação'` (`apps/frontend/sheet/evolve/ModeBar.tsx:52-57`). O id interno continua `evolve`;
- o dono tem só Jogo e Editar (ou Jogo e Criação, na criação por pontos): `OWNER_MODES` e `OWNER_CREATE` (`ModeBar.tsx:60-66`). Quem escreve sem ser dono (o narrador) começa em Leitura, sem seletor, e entra pelo "Editar como narrador" (T-33, onda 3);
- a ficha nova abre em `?mode=create` quando o template tem criação por pontos, e em `?mode=evolve` (Editar) quando não (`app/(app)/chronicles/[id]/new-character.tsx:150-152`);
- a ficha em criação da dona abre na montagem por qualquer entrada (T-05, onda 2): Criação com a conta por pontos, Editar na livre (`apps/frontend/sheet/SheetScreen.tsx:363-374`). A ficha ativa da dona abre em Jogo, e a dos outros, em Leitura (`:352-353`).

**De onde veio:** `f514520` (18/10/2026, "ajustes da ficha"), logo depois do fechamento da v0: "o dono vê só Jogo | Editar (Leitura fica para quem não é dono); 'Evoluir' vira 'Editar' nos textos do app. O id interno segue `evolve`". O plano-v0 não foi atualizado. O v1 e o v2, escritos no dia seguinte, já dizem "Editar".

**O que muda:**

- v0 item 5: "A ficha abre em **Editar** (ou em **Criação**, quando a crônica usa a criação por pontos da v4): …. Salvar grava **um** lote. (D-13)";
- v0 item 6: "A ficha abre em **Jogo** para o dono e em **Leitura** para quem não é dono: identidade, 3 abas … e dock …. (D-13)";
- v3 item 1: "… distribui os pontos em Editar (ou em Criação, na criação por pontos). (D-13)";
- no registro do v0, uma linha: "Evoluir é o nome interno do modo (`evolve`), no contrato do template (`editableIn`) e no design system; a tela o chama de Editar desde `f514520`."
- **As Etapas 17 e 18 do v0** (título "Modo Evoluir", `ModeBar` com "Evoluindo · N alterações", l.730-736) ficam como registro, com uma linha "Revisto: a tela chama o modo de Editar e mostra 'Editando · N alterações' (`ModeBar.tsx:455`)".

### 3.2 Divergência 2 · O Posto na identidade do W20 (v2 §1, item 2)

**Onde o plano diverge:**

- `doc/plano-v2.md:26`, item 2: o formulário pede "nome, nome de feito, conceito, raça, augúrio (com a fase da lua), tribo, seita e totem", sem o Posto, o Campo e o Nome da matilha;
- `doc/plano-v2.md:155`, teste da Etapa: "o Posto do resumo (um `rating`, que o formulário de criação não mostra)". **Isto já estava errado quando foi escrito:** o editor de `rating` existe desde a Etapa 14 da v0 (`af08517`).

**O que a tela faz (conferido):**

- o Posto está no `identity.summary` do `wta-w20` (`design/templates/wta-w20.json:16`, `["rank", "auspice"]`), e é um `rating` de 0 a 5 (`:189-200`);
- o `identityFields` junta nome, colunas, chip, subtítulo e resumo, e só tira o `number` com `readOnly` (`packages/sheet-core/src/compile.ts:319-344`). O Posto é `rating`, então entra;
- o formulário mostra cada campo de identidade que o dono escreve e que tem editor (`apps/frontend/sheet/CharacterForm.tsx:74-79`), e o `rating` tem (`sheet/editors/index.ts:16`);
- as colunas do W20 trazem também o Campo e o Nome da matilha (`wta-w20.json:17-20`, `identity.columns`), que o item 2 não lista.

**O que muda:**

- v2 item 2: "… cria a ficha: nome, nome de feito, conceito, seita, raça, augúrio (com a fase da lua), campo, tribo, nome da matilha, totem e Posto. O formulário sai do template: são os campos de identidade, na ordem das colunas. (D-13)" A ordem final é a do formulário na tela, conferida na §11;
- l.155: "Revisto: o Posto aparece no formulário (o `rating` tem editor desde a Etapa 14 da v0); a D-13 alinhou o §1";
- o registro do v2 cita a D-07 (o aviso do Dom acima do Posto 1) e a D-08 (os Dons mostram "Posto N", e o Posto do Dom muda na folha; onda-4 §6, ponto 7, em aberto).

**Observação sem linha na matriz (não entra sem resposta; §9):** o Posto nasce 0 ("Filhote"), porque o campo não tem `default` e o `min` é 0, mas a frase do "?" diz "Começa em 1 e sobe com o Renome" (`wta-w20.json`, campo `rank`, `help`). O PO-W viu o "Posto 0 · Filhote" (POW-28, `po-web.md:194`). É conteúdo de template: se for corrigido, cabe no aumento de versão da onda (P15-D), não no P01-D.

### 3.3 Divergência 3 · Concluir com grupo incompleto: a tela previne, o servidor recusa (v4 §1, item 4)

**Onde o plano diverge:** `doc/plano-v4.md:29`, item 4: "Tenta concluir com um grupo incompleto; a operação é recusada e o problema aparece naquele grupo."

**O que a tela faz (conferido):**

- com a conta aberta, a barra de criação não mostra o "Concluir criação": o `next` só existe com `finishing.ready` (`apps/frontend/sheet/evolve/ModeBar.tsx:308-319`), e o `ready` é a conta fechada (`sheet/creation/CreationPanel.tsx:155`);
- no lugar dele, o "Faltam: …" (D-05, P05-D), com itens que levam ao grupo, e a aba "Pontos" com o "O que falta" inteiro (`CreationPanel.tsx:232-233`, `sheet/creation/GuideRow.tsx`);
- quando a conta fecha, a linha do próximo passo diz "A conta fechou: você conclui." (ou "envie ao narrador", com aprovação), e o botão aparece (onda-4 §12.1);
- o servidor continua recusando a conclusão com a conta aberta (`apps/api/src/sheets/creation.ts:665` e `:761`, `completionRefusal`), com teste em `apps/api/src/__tests__/creation.test.ts` (`CREATION_BASICS_UNSPENT`).

**O que muda:**

- v4 item 4: "Com um grupo incompleto, a barra mostra 'Faltam: …' no lugar de 'Concluir criação'; cada item leva ao grupo, e a aba Pontos lista o que falta. O servidor recusa a conclusão com a conta aberta (`completionRefusal`). (D-13; o botão escondido até a conta fechar é ponto para o PO em aberto: [onda-4.md](planos-pacotes/onda-4.md) §6, ponto 2.)";
- v4 item 5 ganha a folha de bônus e a fase (§3.6).

**Por que o texto diz "em aberto":** a P05-D seguiu a recomendação técnica do próprio plano (§10, primeiro item), sem decisão do PO. Escrever no plano-v4 que "o botão fica escondido" como regra seria decidir o ponto 2. O plano descreve o que a tela faz e aponta a decisão pendente.

**E2E:** a jornada do §1 do v4 (`e2e/tests/journey-creation.spec.ts`) não existe (§3.14). O "Faltam" e o botão só com a conta fechada estão no `creation-guide.spec.ts` (P05-D).

### 3.4 Divergência 4 · A Esfera acima do Arete na criação por pontos (v1 §1, item 4)

**Onde o plano diverge:** `doc/plano-v1.md:27`, item 4: "Uma Esfera acima do Arete é aceita e aparece como **inativa**. Baixar o Arete não apaga ponto nenhum." E a Etapa 5 (`plano-v1.md:232-251`), "Teto não destrutivo e afinidade no Editar".

**O que a tela faz (conferido):**

- **no Editar** (criação livre, ou o narrador), o item continua certo: o stepper passa do teto até o `max`, e a linha avisa "N inativo, máx. pelo Arete M". O `journey-mage.spec.ts:80-108` prova ("1 inativo, máx. pelo Arete 2");
- **na Criação (por pontos)**, o `mta-m20` declara dois `hard-cap`: Arete até 3 e cada Esfera até o Arete (`design/templates/mta-m20.json:1148-1153`). O core recusa acima dele (`CREATION_HARD_CAP`, `packages/sheet-core/src/creation.ts:346-363` e `:387`), e o app mostra a recusa perto do toque: "Forças: na criação, vai até N." (`apps/frontend/sheet/creation/creation.ts:579-588`). O servidor repete a conta a cada lote;
- **no pedido de XP** (ficha ativa), a Esfera acima do Arete também não passa: `XP_PREREQUISITE` com motivo `cap` (`packages/sheet-core/src/costs.ts:156-158`).

**Texto da tela que mudou desde o teste:** o PO-A viu "Forças: acima do limite da criação." (`po-app.md:55`). Esse texto continua como frase da recusa do servidor (`sheet/creation/creation.ts:315-316`); perto do toque, a frase agora é a do teto ("na criação, vai até N"). O plano cita as duas pelo código do problema, não pela frase.

**O que muda:**

- v1 item 4: "No Editar (criação livre, ou o narrador), uma Esfera acima do Arete é aceita e aparece como **inativa**; baixar o Arete não apaga ponto nenhum. Na Criação (por pontos), o `hard-cap` do template não deixa passar (Arete até 3, Esfera até o Arete): a recusa aparece perto do toque, e o servidor recusa o lote. No pedido de XP, a Esfera também não passa do Arete. (D-13)";
- na Etapa 5, uma linha "Revisto: vale para o Editar. A criação por pontos da v4 aplica o `hard-cap` (`mta-m20.json:1148-1153`)".

### 3.5 Divergência 5 · A Geração derivada do Antecedente (v0 §1, item 4)

**Onde o plano diverge:**

- `doc/plano-v0.md:28`, item 4: "O jogador cria a ficha: nome, conceito, clã, geração, senhor, natureza e comportamento.";
- `doc/plano-v0.md:607`, teste da Etapa 14: "o formulário do Vampiro mostra nome, conceito, clã, geração, …";
- `doc/plano-v0.md:90` (tabela do ponto de partida) e `:346` (Etapa 6): "`vtm-v20.json` ganha `generation.default: 13`".

**O que a tela faz (conferido):**

- a Geração é um `number` `readOnly`, derivado do Antecedente "Geração" (`design/templates/vtm-v20.json:127`, `derive: "vtmGeneration"`, `from: { list: "backgrounds", item: "Geração" }`): 13 menos os pontos, até a 8ª;
- o `identityFields` tira o `number` com `readOnly` (`packages/sheet-core/src/compile.ts:340`), então ela não está no formulário;
- ela continua no cabeçalho (`identity.summary` e `columns`, `vtm-v20.json:15` e `:20`) e muda quando o Antecedente muda.

**De onde veio:** o mesmo `f514520` (vtm-v20 1.1.0): "Geração derivada do antecedente … Sai da criação". O PO-W e o PO-A confirmaram que segue o livro e a escolha da `auditoria-fichas-wod.md` (`po-web.md:210`, `po-app.md:241`).

**O que muda:**

- v0 item 4: "O jogador cria a ficha pelos campos de identidade do template: no Vampiro, nome, natureza e comportamento (com 'Escolher da lista'), conceito, senhor e clã. A Geração não é escolhida aqui: ela vem do Antecedente Geração (13 menos os pontos) e aparece no cabeçalho. O formulário sai do template, não de uma tela escrita para o Vampiro. (D-13)";
- l.90, l.346 e l.607: uma linha "Revisto: a Geração passou a derivada do Antecedente em `f514520` (vtm-v20 1.1.0) e saiu do formulário".

### 3.6 O que ajuda e não estava em plano

O relatório (§8, "O que sobra") pede três registros. Os três existem na ponta:

| Item | Onde está na tela (conferido) | Onde entra no plano |
|---|---|---|
| **"Escolher da lista"** para Natureza e Comportamento | `apps/frontend/sheet/editors/Suggestions.tsx:67-90`, com o nome "Escolher da lista: {campo}" (POA-06, onda 1). Só o `vtm-v20` tem `suggestions` (em `nature` e `demeanor`); o M20 e o W20 não têm (a R-29 nessa parte ficou fora: onda-4 §6, ponto 17) | v0 item 4 (§3.5). No registro do v1 e do v2, uma linha: "sem 'Escolher da lista' na identidade; ponto em aberto (onda-4 §6, ponto 17)" |
| **A folha "Começaram os pontos de bônus"** | `sheet/creation/CreationPanel.tsx:491`; uma vez por ficha, com a marca no aparelho (D-05, P05-D; onda-4 §6, ponto 4, em aberto) | v4 item 5: "Ao fechar os pontos básicos, a folha 'Começaram os pontos de bônus' aparece uma vez por ficha, e a aba Pontos mostra a fase em texto ('Fase: pontos básicos' ou 'de bônus'). (D-13, D-05)" |
| **O "O que falta"** | A aba "Pontos" (antes "Orçamento"), `CreationPanel.tsx:232-233`, e o "Faltam: …" da barra (`GuideRow.tsx`, `ModeBar.tsx:125`) | v4 itens 4 e 5 (§3.3) |

O relatório também diz que a alternância "Pontos básicos / Pontos de bônus" atrapalhava. Ela virou indicador com a troca manual secundária (D-05, onda 4): o registro do v4 diz isso.

### 3.7 O "resumo do Concluir" (D-01; deixado pelo P03-D)

**Onde:** `doc/plano-v0.md:736` ("'Concluir' mostra o resumo …"), `doc/plano-v1.md:244` ("no resumo do Concluir") e `doc/plano-v2.md:235` ("O resumo do Concluir não fala de modificador").

**O que a tela faz:** desde a D-01 (P03-D, onda 3), o Editar tem "Salvar" (nome acessível "Salvar alterações"), e o resumo abre no "Salvar". Na Criação, "Salvar" fica sempre, com "Concluir criação" ou "Enviar para aprovação" ao lado quando a conta fecha (`ModeBar.tsx:45-50`, `:299-319`).

**O que muda:** as três linhas trocam "resumo do Concluir" por "resumo do Salvar", com "(D-01)". O registro do v0 diz a regra do rótulo ("Salvar" visível, "Salvar alterações" no nome) e que o rótulo no Editar é ponto do PO em aberto ([onda-3.md](onda-3.md) §6, ponto 1).

### 3.8 `regras-wod.md` "O que fica com o narrador" (D-07, D-09; deixado pelo P07-D)

**Onde:** `doc/regras-wod.md:72-78`. O texto continua certo: a conta não cobra Disciplina do clã, Esfera de afinidade nem Dom da Raça.

**O que muda:** uma frase depois da lista: "A tela recomenda sem cobrar (onda 4, P07-D): no V20, as Disciplinas do clã vêm primeiro, com o selo 'do clã'; no M20, a Esfera da Tradição tem o selo 'da Tradição'; no W20, o catálogo de Dons de nível 1 destaca os da Raça, do Augúrio e da Tribo, e um Dom acima do Posto 1 pede 'confirme com o narrador'. A escolha de fora avisa e não bloqueia (D-07, D-09)." Mais uma linha: o catálogo de Dons foi compilado de memória e precisa ser conferido contra o livro (onda-4 §12.7).

### 3.9 O registro das decisões D-00 a D-17, por plano

A tabela abaixo é o conteúdo das seções novas. Cada linha vira uma linha da tabela do plano indicado. "Em aberto" aponta o ponto do PO sem resolvê-lo.

| Decisão | Planos | O que o registro diz | Onda e pacote | Em aberto |
|---|---|---|---|---|
| D-00 | v0 (Etapa 1, CI) | §3.10 | onda 1, P01-C; PR #49 | onda-4 §6, ponto 16 |
| D-01 | v0, v1, v2, v4 | "Salvar" sempre na barra; "Concluir criação" ou "Enviar para aprovação" ao lado com a conta fechada; "Salvar e sair" no aviso de sair; no Editar, o resumo abre no "Salvar" (§3.7) | onda 3, P03-D | onda-3 §6, pontos 1 a 4 |
| D-02 | v3, v4 | Estados sob o nome da ficha, na lista, na aba Fichas e na Mesa ("Em criação · livre/por pontos", "Aguardando aprovação", "Aguardando ajuste", "Devolvida", "Concluída em dd/mm"); o Histórico registra "Criação concluída" | onda 3, P04-D | onda-3 §6, pontos 6, 7 e 10 |
| D-03 | v3, v4 (o §3.4 já tem a linha) | "Avisar que terminei" na criação livre, com selo na Mesa; push fica para depois (§3.11) | onda 3, P04-D | onda-3 §6, ponto 11 |
| D-04 | v3, v4 (o §3.4 já tem a linha) | "Pedir ajuste" com motivo, só do narrador; "Reabrir criação" fora do ciclo, em `proximas-features.md` | onda 3, P04-D | onda-3 §6, pontos 8 e 9 |
| D-05 | v4 | "Faltam" na barra, aba "Pontos", folha de bônus uma vez por ficha, fase em texto (§3.3, §3.6) | onda 4, P05-D | onda-4 §6, pontos 2, 4 e 15 |
| D-06 | v0, v4 | A Qualidade se compra com bônus, pelo custo do item; a recusa aparece na folha e mantém o nome | ondas 2 e 4, P07-C e P07-D | onda-4 §6, ponto 6 |
| D-07 | v2 | Catálogo de Dons de nível 1 (48 nomes, rascunho a conferir contra o livro); Dom acima do Posto 1 avisa, sem bloquear | onda 4, P07-D | onda-4 §6, ponto 5 |
| D-08 | v0, v1, v2 | −/+ na linha dos itens com valor (Disciplinas, Antecedentes, Esferas); os Dons mostram "Posto N", que muda na folha | onda 4, P07-D | onda-4 §6, ponto 7 |
| D-09 | v0, v1 | "do clã" e "da Tradição" primeiro e com selo; fora avisa; a Fraqueza mostra o resumo do time para o clã, sem gravar sozinha | onda 4, P07-D | onda-4 §6, ponto 8 |
| D-10 | v3, v4 | `[a preencher: P09-D]`: o progresso no cartão da Mesa, o filtro, a contagem na lista, a conta em leitura para o narrador também em `pending`, o painel de uma linha e as abas no topo | onda 5, P09-D | onda-4 §6, ponto 15 |
| D-11 | v0, v1, v2 | "?" com uma frase curta do template, só na Criação, no Editar e na Nova ficha; frases são rascunho do time | onda 4, P10-D | onda-4 §6, pontos 10, 11 e 13 |
| D-12 | v1 | "Casa ou subgrupo", opcional, em todas as Tradições (item 2 do §1: "casa" passa a "casa ou subgrupo, opcional") | onda 4, P10-D | onda-4 §6, ponto 12 |
| D-13 | todos | Este pacote | onda 5, P01-D | — |
| D-14 | v0 | `[a preencher: P12]`: o convite por link com o código no fragmento; o §1, itens 2 e 3, o §7, decisão 2 (`plano-v0.md:918`), e o §8 ("Convite por e-mail ou por link", `:937`) | onda 5, P12 | — |
| D-15 | v5 | `[a preencher: P14-D]`: a Descrição em leitura para o jogador, com "Ler tudo"; a jornada P2 "editar nome/descrição" (`plano-v5.md:36`) | onda 5, P14-D | — |
| D-16 | v0, v1, v2 | `[a preencher: P15-D]`: o campo "História / Prelúdio" nos três templates, lido pelo dono e pelo narrador, separado das Notas do Narrador; versões novas dos templates | onda 5, P15-D | quem escreve o campo (ponto do PO do P15-D) |
| D-17 | v0, v5 | `[a preencher: P16-D]`: se o pacote entrar, o v0 §1, item 8 (`plano-v0.md:32`, "Notas do Narrador, que o aparelho do jogador nunca recebe"), ganha "até o narrador revelar"; se ficar para depois, vira entrada do `proximas-features.md` | onda 5, P16-D | se entra nesta onda (ponto do PO do P16-D) |

**Correções que mudam o que o §1 descreve** (a parte "Correções" de cada registro; uma linha cada):

- **v0:** T-05 (onda 2: a ficha em criação da dona abre na montagem); T-33 (onda 3: o narrador abre em Leitura e entra pelo "Editar como narrador"); T-53 (`[a preencher: P13]`: o "De" efetivo no toast, que o "Estado da v0" dá como corrigido e o PO-A viu voltar, POA-30); T-79 (`[a preencher: P13]`: a FdV fora dos Atributos nos Dados, item 9).
- **v2:** T-79 (`[a preencher: P13]`), que o relatório viu na jornada §1.4 a §1.6 ("Força de Vontade aparece entre os Atributos").
- **v3:** T-32 (onda 2: concluir pelo menu pede confirmação, POA-18); T-80 (onda 2: "Criação concluída" no Histórico).
- **v4:** R-12 e T-36 (o pendente na Mesa, POW-11 e POA-19; `[a preencher: P09-D]` para a parte da D-10); T-50 e U-01 (`[a preencher: P13]`: a lista de evolução agrupada e o "Peça ao narrador" que leva a "Solicitar evolução", item 9).
- **v5:** T-52 (onda 3: a seção "NPCs" na Mesa, item 2); T-15 (onda 3: a ficha revelada do NPC abria vazia no iOS, POA-40, item 6).

### 3.10 A D-00 depois do PR #49: onde fica escrito, sem editar a matriz

**O fato (conferido no git):** a D-00 decidiu "Android e iOS compilados no CI em todo PR". O P01-C a implementou (onda 1, `f2897c6`: jobs `native-android` e `native-ios`). O PR #49 (`5854cf6`, 04/11/2026; merge `c96f2d4`) tirou os jobs `native-android`, `native-ios` e `postgres` e o `workflow_dispatch`. Desde então, o build nativo e os `*.pg.test` rodam à mão, na integração de cada onda (onda-4 §2 e §11), e o job `check` continua conferindo as versões nativas.

**O que já está certo:** o `CLAUDE.md` foi corrigido no próprio PR #49 ("O CI não compila o app nativo", l.143-146; "o CI não roda esses testes: rode à mão", l.154). O `onda-4.md` registra o fato (l.40) e o ponto do PO (§6, ponto 16).

**Onde o P01-D escreve:**

1. **No registro do plano-v0**, linha da D-00 (a Etapa 1 do v0 é onde o CI nasceu): "Decidida em 01/11/2026 como 'Android e iOS compilados no CI em todo PR' (P01-C, onda 1). O PR #49 (04/11/2026) tirou os jobs nativos e o `postgres`; o build nativo e os `*.pg.test` rodam à mão na integração de cada onda. A revisão da decisão está com o PO ([onda-4.md](planos-pacotes/onda-4.md) §6, ponto 16)."
2. **Nas linhas que dizem que o CI ainda faz o que saiu**, uma linha "Revisto: o PR #49 tirou o job …":
   - `doc/plano-v0.md:186` (o job `postgres` na Etapa 1);
   - `doc/plano-v3.md:128` e `:304` (os testes "no job `postgres` do CI");
   - `doc/plano-observabilidade.md:588-589` ("o CI só faz build de debug") e `:596-597` ("Os jobs `native-android` e `native-ios` do CI confirmam o build"). Passa a "o build nativo da integração confirma (o CI não compila o nativo desde o PR #49)".
3. **No `onda-5.md`** (do orquestrador), o ponto 16 do onda-4 §6 continua na lista "Pontos das ondas 1 a 4 que tocam esta onda", em aberto. O P01-D não escreve lá; o resumo do pacote para o PR da onda diz o que foi registrado e onde.
4. **A matriz não é editada.** Quem gera a matriz (md e csv) leva a revisão para a tabela "Decisões de produto" quando o PO decidir, pela regra "Decisão revista" ("a tabela de decisões registra a revisão"). Texto sugerido para a coluna "Decisão", se o PO confirmar a revisão: "Revista em dd/mm: o CI confere as versões nativas (`check:native` e `expo install --check`); o build nativo de Android e iOS roda na integração de cada onda, à mão (PR #49)." O P01-D só deixa o texto no resumo do pacote.

**O que o P01-D não escreve:** que a D-00 foi revista. O PR #49 é um fato do repositório; a revisão da decisão é do PO.

### 3.11 `proximas-features.md`: "Reabrir criação" (D-04) e o que as ondas adiaram

O documento hoje (`doc/proximas-features.md`, base `1435c9f`) lista 16 sugestões e o "Depois do painel" (l.7). Entra uma seção nova, "## 5. Adiadas pelas decisões do teste com personas (01/11/2026)", com:

1. **Reabrir criação (D-04).** Uma linha de cabeçalho e o que a feature precisa decidir, sem desenho:
   - é uma transição que o plano-v4 §3.4 proíbe hoje ("não permite `active/archived/dead → creating`", `plano-v4.md:206`), e a confirmação de concluir diz "Não dá para voltar à criação" (`apps/frontend/sheet/creation/completion.ts:24` e `:26`). As duas mudam juntas;
   - quem pode: só o narrador da crônica, validado no servidor, com registro no Histórico e na auditoria (como "Pedir ajuste");
   - o que acontece com o XP já gasto e concedido, com o `creationFreeze` gravado ao concluir, com a aprovação e com os pedidos de XP pendentes;
   - a alternativa que já existe: o narrador edita a ficha ativa ("Editar como narrador") sem voltar à criação.
2. **Push do "Avisar que terminei" (D-03).** Uma linha no item 8 ("Notificações push"): "o jogador avisou que terminou" entra na lista de avisos.
3. **`[a preencher: P16-D]`:** se o PO deixar o P16-D para depois, "Revelar uma Nota do Narrador ao jogador (D-17)" entra aqui, com o link para o plano do P16-D.

E duas atualizações de itens que já estão lá:

- **item 13, "Ajuda no traço"** (l.41 e l.66): "Em parte na onda 4 (P10-D, D-11): o '?' com uma frase curta do time nos campos, nas opções e nas Disciplinas, Dons e Esferas. Falta tocar no traço em Jogo e Leitura." A ressalva de direitos do item continua;
- **"Depois do painel"** (l.7): a "migração de fichas entre versões de template" ganha o link para o [onda-4.md](planos-pacotes/onda-4.md) §6, ponto 9 (as fichas da versão anterior ficam sem o que é de template), que segue em aberto.

### 3.12 As contagens de testes do `CLAUDE.md`

**Sim, o P01-D as atualiza.** Hoje o `CLAUDE.md` l.125-129 diz core 981, api 1936, db 35, ui 197 e frontend 1387. São de antes da onda 4: a integração da onda 4 mediu core 1119, db 39, api 1924 (65 `*.pg.test` pulados), ui 226 e frontend 1593 (onda-4 §11). O 1936 da api não aparece em nenhuma integração (onda 3: 1766; onda 4: 1924) e não dá para saber como foi contado.

**Como contar, na integração (não agora):**

- os números saem da mesma rodada que preenche a tabela "Resultado na onda" do `onda-5.md` §11, na ponta final da onda;
- por pacote, com os scripts do monorepo: `npx pnpm -C packages/sheet-core test`, `npx pnpm -C packages/db test`, `npx pnpm -C apps/api test` (a linha `N pass`; os `*.pg.test` sem `PG_TEST_URL` saem como `skip` e não entram no número), `npx pnpm -C packages/ui test` e, no frontend, `npx jest --forceExit` (o Jest pelo `pnpm test` não encerra sozinho; onda-4 §11). Do Jest vale a linha `Tests: N passed`;
- o `random.test.ts` do core é instável (onda-4 §11): o número vem de uma rodada verde, e a instabilidade não muda a contagem;
- o `@tms/config` não está no `CLAUDE.md` e continua fora.

**Quando:** é o último commit do pacote e da onda de código (§8.1, commit 10), depois das correções que a integração e o roteiro manual fizerem. O P01-D não acrescenta teste, então a contagem depois do merge dele é a da rodada final. Se uma correção entrar depois, o orquestrador repete a contagem e corrige o commit na branch do pacote antes do merge final.

**O que muda junto:** a frase de cada linha continua; só o número. Se a onda 5 trouxer uma jornada E2E nova (`[a preencher: P09-D, P12]`, se houver), o parágrafo dos E2E (l.141) ganha o nome do spec.

### 3.13 Como o texto final depende dos outros pacotes da onda 5

| Pacote | O que o P01-D escreve depois do merge dele | Onde | Marcador |
|---|---|---|---|
| P09-D (D-10) | O progresso no cartão da Mesa, o filtro "Em criação / Pendentes", a contagem na lista, a aba Pontos em leitura para o narrador (também em `pending`), o painel "Criação de fichas" em uma linha e as abas no topo; se o nome "Orçamento" das regras da crônica mudou (onda-4 §6, ponto 15) | v3 (registro e §1, item 1, se a Mesa da jornada mudar), v4 (§1, item 7, e registro) | `[a preencher: P09-D]` |
| P12 (D-14) | O convite por link, com o código no fragmento, e o que acontece sem sessão; a mensagem do convite; o T-30 (voltar) | v0 §1, itens 2 e 3; §7, decisão 2; §8; v4 §1, item 1 ("convida dois jogadores") | `[a preencher: P12]` |
| P13 | A lista de evolução agrupada e o resumo fixo (T-50), o controle desabilitado com o motivo (T-77), o "Peça ao narrador" como atalho (U-01), o "Digitar" (U-02), a FdV fora dos Atributos nos Dados (T-79), a Citação e as Notas editáveis (T-84) e o "De" efetivo (T-53) | v0 (Estado, itens 7 e 9), v2 (itens 4 a 6), v4 (itens 9 a 11) | `[a preencher: P13]` |
| P14-D (D-15) | A Descrição em leitura para o jogador e o aviso no editor do narrador | v5 (jornada P2, l.36, e registro) | `[a preencher: P14-D]` |
| P15-D (D-16) | O campo "História / Prelúdio", quem lê, quem escreve (o que o PO responder), as versões novas dos templates e o que acontece com as fichas da versão anterior | v0 §1, item 8, e os registros do v0, v1 e v2 | `[a preencher: P15-D]` |
| P16-D (D-17) | Se entrou: "Revelar ao jogador" nas Notas do Narrador, com o Histórico; se ficou para depois: a entrada no `proximas-features.md` | v0 §1, item 8; v5 §1, item 6 (que continua "sem Notas do Narrador" para o `viewer` do NPC); `proximas-features.md` §5 | `[a preencher: P16-D]` |

**Regras:**

- os commits 1 a 8 (§8.1) podem ser escritos antes, com os marcadores; o commit 9 preenche os marcadores depois do último merge de pacote;
- antes do commit 9, `git log --oneline <base da onda>..onda/5-narrador-entrada-uso -- doc/ CLAUDE.md` mostra o que os irmãos já escreveram nos planos (o P04-D, na onda 3, anotou o plano-v4 §3.4 no próprio pacote). O P01-D não repete o que o irmão já escreveu: o registro aponta para a linha dele;
- o texto do registro de cada pacote sai do §12 "Funcionalidades que entraram" do `onda-5.md`, quando o orquestrador o escrever, ou do §10 "Desvios" do plano do pacote. Não sai do plano antes da implementação: o que foi feito pode ter mudado;
- se um pacote sair da onda (pela regra "Decisão revista"), o marcador vira "fica para a onda seguinte" e a linha aponta para o ponto do PO.

**Critério:** `grep -rn "a preencher:" doc/ CLAUDE.md` não retorna nada antes do merge do P01-D na onda.

### 3.14 Outras diferenças vistas na leitura (fora da D-13; não entram sem resposta)

| Onde | O que | Proposta |
|---|---|---|
| `doc/plano-v4.md:7` e §5.0 (l.278-289) | O cabeçalho diz "em execução", com as Etapas 3 a 9 "em andamento"; o §1 cita `e2e/tests/journey-creation.spec.ts`, que não existe; não há `doc/validacao-v4.md`. O `plano-v5.md:57` já registra isso | Uma linha no registro do v4: "A v4 entrou na `main` no PR #32; o spec da jornada e a validação não existem (ver `plano-v5.md:57`)". Não declarar a v4 validada |
| `doc/plano-v3.md:32`, item 5 | "… as duas coisas são recusadas com o motivo na tela": o relatório viu "prevenção em vez de recusa" (§8, v3 §1.5) | A mesma correção da divergência 3, se o PO quiser estender a D-13 ao v3 |
| `design/templates/wta-w20.json`, campo `rank` | Nasce 0 ("Filhote") e a frase diz "Começa em 1" (POW-28) | Conteúdo de template: no P15-D (aumento de versão da onda), se o PO quiser |
| `design/templates/README.md`, `design/design-system/components.md`, `doc/painel-narrador.md`, `doc/arquitetura-motor-de-ficha.md:616` | "Evoluir" como nome do modo | Fica: é o id interno do contrato. A ponte vai no registro do v0 (§3.1) |

### 3.15 O que muda na API pública

Nada. O pacote não toca `@tms/ui`, `schema.json`, `@tms/sheet-core`, rotas HTTP, migrations nem templates.

## 4. Testes

### 4.1 Um teste de regressão por bug

**Não se aplica.** O U-08 é de documentação: não há comportamento de código para um teste falhar antes e passar depois. A prova é a leitura do plano ao lado da tela (a conferência da §11) e três checagens mecânicas, rodadas no PR local por um script no scratchpad (fora do repositório):

1. **Links:** cada link relativo dos arquivos tocados aponta para um arquivo que existe, e cada âncora (`#p01-d`, `#14-contabilização…`) existe no destino;
2. **Marcadores e nomes:** nenhum `a preencher:` sobrando; nenhum "Evoluir" no §1 do v0 e do v3 (fora da linha da ponte); nenhum `generation.default` sem a linha "Revisto";
3. **Higiene:** nenhum `@roteiro.test`, nenhuma senha, nenhum código de convite, nenhum e-mail real e nenhum dado de produção (o texto do U-10) nos arquivos tocados.

### 4.2 Testes existentes que mudam junto

Nenhum. Os specs citam os itens do §1 pelo número nos comentários (`journey.spec.ts:4`, `journey-mage.spec.ts:5` e `:80`, `journey-werewolf.spec.ts:5`); a regra de não renumerar (§3.0) os mantém certos.

### 4.3 E2E novo ou alterado

Nenhum. Os comportamentos que os planos passam a descrever já têm E2E: o "Faltam" e o botão só com a conta fechada (`creation-guide.spec.ts`), a Esfera inativa no Editar (`journey-mage.spec.ts:80-108`), o formulário de identidade (`create-character.spec.ts`).

### 4.4 Suítes do "PR local" e cobertura

- O hook de pre-commit roda o `lint-staged` (que não pega `.md`) e o `typecheck` do monorepo inteiro (`.husky/pre-commit`). Cada commit do pacote espera o typecheck.
- `npx pnpm lint` e `npx pnpm typecheck` verdes; a cobertura não muda.
- **AuthZ:** nenhuma mudança. Os registros da D-10, D-15, D-16 e D-17 descrevem a AuthZ que os pacotes irmãos implementaram e testaram na matriz de AuthZ da API; o P01-D copia o que o §10 deles disser, sem acrescentar regra.

## 5. Segurança

Ameaças de um pacote de documentação, e o que o desenho evita:

- **Dado de conta ou de produção num documento versionado.** Os planos não levam e-mail, senha, código de convite, captura ou texto de ficha. A senha do seed nunca é escrita (é a constante do `scripts/seed-roteiro.ts`), e o log do seed fica no scratchpad. O texto do U-10, que está em produção, não é citado nem resumido. Checagem 3 da §4.1.
- **Descrever uma garantia de segurança que não vale.** Por exemplo: escrever que o jogador lê as Notas do Narrador antes de o P16-D existir; escrever o convite com o código numa query string; dizer que o NPC revelado traz as notas. O texto das garantias (v0 §1, item 8; v5 §1, itens 5 a 8) só muda pelo §10 do pacote que implementou, e o `/code-review` confere cada frase contra o código.
- **Dar como validado o que não foi.** O registro da D-00 não diz que o CI compila; o do catálogo de Dons não diz que foi conferido contra o livro; o do v4 não declara a jornada validada.
- **Texto do livro.** Nenhuma frase de livro entra, nem como exemplo; as frases do time citadas são as do template, pelo nome do campo.
- **`/security-review`:** não é pedido (sem código, sem AuthZ, sem estado novo). O `/code-review` lê o diff como revisão de exatidão.

## 6. Como generaliza além do WoD

**Genérica.** O texto novo descreve o motor, não o sistema: o `hard-cap` e o `creation-cap` do template, o `derive` com `from` de item de lista, o `identityFields` (o que é de identidade e tem editor entra no formulário), as `suggestions` ("Escolher da lista") e a conta do `checkCreation` ("Faltam"). Cada correção cita o mecanismo e, entre parênteses, o exemplo do sistema ("o `hard-cap` do template (Arete até 3, Esfera até o Arete)"). Um sistema novo (o V5 da v9 do `proximas-features.md`) lê o mesmo texto e só troca o exemplo.

## 7. Critério de pronto

Os passos do "PR local" da matriz ("Como executar"):

1. **Plano aprovado.** As 5 divergências conferidas na ponta (§3.1 a §3.5), as decisões aplicadas (§2) e os pontos que não se aplicam como estão escritos apontados (§2 e §9).
2. **Typecheck, lint e testes:** o typecheck do pre-commit e o `npx pnpm lint`; as três checagens da §4.1.
3. **Teste de regressão:** não se aplica (§4.1); a conferência da §11 faz esse papel.
4. **`/code-review`** no diff do pacote, como revisão de exatidão (cada frase nova contra o código citado). Sem `/security-review` (§5).
5. **Os cenários das personas, repetidos sem o defeito:**

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | U-08 (divergência 1) | PO-W e PO-A (`po-web.md:40`, `:211`; `po-app.md:241`): ler o v0 §1, itens 5 e 6, e abrir uma ficha nova | O plano diz "Editar" e "Criação", e "Jogo" para a dona; a tela diz o mesmo |
   | U-08 (divergência 2) | PO-W (`po-web.md:28`, `:218`, `:273`): ler o v2 §1, item 2, e abrir a Nova ficha do Lobisomem | O plano lista o Posto, o Campo e o Nome da matilha; a tela os pede |
   | U-08 (divergência 3) | PO-W e PO-A (`po-app.md:245`; relatório §8, v4 §1.4): ler o v4 §1, item 4, e procurar "Concluir" com grupo incompleto | O plano diz "Faltam" no lugar do botão e a recusa do servidor; a tela mostra o "Faltam" |
   | U-08 (divergência 4) | PO-A (`po-app.md:55`, `:242`): ler o v1 §1, item 4, e passar uma Esfera do Arete na criação por pontos | O plano diz "no Editar, inativa; na Criação, recusada perto do toque"; a tela recusa |
   | U-08 (divergência 5) | PO-W e PO-A (`po-web.md:25`, `:210`; `po-app.md:241`): ler o v0 §1, item 4, e abrir a Nova ficha do Vampiro | O plano diz que a Geração vem do Antecedente; a tela não a pede e a mostra no cabeçalho |
   | U-08 (o que ajuda) | PO-W (`po-web.md:269-273`): "Escolher da lista", a folha de bônus e o "O que falta" | Os três estão no plano (v0 item 4; v4 itens 4 e 5) |

6. **A conferência na tela**, nas três plataformas, com captura: a §11.
7. **O resumo para a seção do pacote no PR da onda:** o que cada plano ganhou, os marcadores preenchidos e com qual pacote, onde a D-00 ficou escrita, as contagens novas e os pontos do PO que os registros apontam.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

Cada commit diz tudo o que entra nele, por arquivo. Nenhum mexe em código.

| # | Commit | Arquivos e o que entra | Itens |
|---|---|---|---|
| 1 | `docs(plano-v0): Editar e Criação, a Geração do Antecedente e as decisões depois do teste (D-13)` | `doc/plano-v0.md`: §1, itens 4, 5 e 6 (l.28-30; §3.1, §3.5); "Revisto" em l.90, l.186, l.346, l.607 e na Etapa 18 (l.730-736, com o "resumo do Salvar", §3.7); seção "Depois do teste com personas" com D-00, D-01, D-06, D-08, D-09, D-11, D-14, D-16 e D-17 (as três últimas com marcador) e as correções T-05, T-33, T-53 e T-79 | U-08 (1, 5), D-01, D-00 |
| 2 | `docs(plano-v1): a Esfera acima do Arete na criação por pontos (D-13)` | `doc/plano-v1.md`: §1, itens 2 (l.25, "casa ou subgrupo, opcional", D-12) e 4 (l.27; §3.4); "Revisto" na Etapa 5 (l.232) e na l.244 (§3.7); seção nova com D-01, D-08, D-09, D-11, D-12 e D-16 (marcador) e a linha "sem 'Escolher da lista'" | U-08 (4), D-01 |
| 3 | `docs(plano-v2): o Posto, o Campo e o Nome da matilha na identidade (D-13)` | `doc/plano-v2.md`: §1, item 2 (l.26; §3.2); "Revisto" em l.155 e l.235 (§3.7); seção nova com D-01, D-07, D-08, D-11 e D-16 (marcador) e a correção T-79 (marcador) | U-08 (2), D-01 |
| 4 | `docs(plano-v4): o "Faltam" no lugar do Concluir, a folha de bônus e a aba Pontos (D-13)` | `doc/plano-v4.md`: §1, itens 4 e 5 (l.29-30; §3.3, §3.6), item 7 (l.32, marcador P09-D), itens 9 a 11 (marcador P13) e item 1 (marcador P12); seção nova depois do §1 com D-01 a D-06 e D-10 (marcador), as correções R-12, T-36, T-50 e U-01 e a linha sobre o estado da v4 (§3.14, se o PO aceitar) | U-08 (3), "o que ajuda" |
| 5 | `docs(plano-v3, plano-v5): Editar na v3 e as decisões da Mesa e dos Bastidores (D-13)` | `doc/plano-v3.md`: §1, item 1 (l.28); "Revisto" em l.128 e l.304 (job `postgres`); seção nova com D-02, D-03, D-04 e D-10 (marcador) e as correções T-32 e T-80. `doc/plano-v5.md`: seção nova depois do §1 com D-15 e D-17 (marcadores) e as correções T-52 e T-15. **Sai sozinho** se o PO quiser só os quatro planos da matriz | U-08 (1), D-00 |
| 6 | `docs(regras-wod): a tela recomenda o que a conta não cobra (D-07, D-09)` | `doc/regras-wod.md`: depois da l.78 (§3.8) | handoff do P07-D |
| 7 | `docs(proximas-features): Reabrir criação e o que as decisões adiaram (D-04)` | `doc/proximas-features.md`: seção 5 nova (Reabrir criação; push do "terminei"; marcador P16-D) e os itens 13 e "Depois do painel" (§3.11) | D-04, D-03 |
| 8 | `docs(observabilidade): o CI não compila o nativo desde o PR #49` | `doc/plano-observabilidade.md`: l.588-589 e l.596-597 (§3.10) | onda-4 §6, ponto 16 (o fato) |
| 9 | `docs(planos): o que os pacotes da onda 5 mudaram na tela` | Os marcadores dos commits 1 a 7, preenchidos com o §12 do `onda-5.md` ou o §10 de cada plano irmão (§3.13), por pacote: P09-D (v3, v4), P12 (v0, v4), P13 (v0, v2, v4), P14-D (v5), P15-D (v0, v1, v2), P16-D (v0, v5, `proximas-features.md`) | D-10, D-14 a D-17 |
| 10 | `docs(claude): contagens de testes da onda 5` | `CLAUDE.md` l.125-129, e l.141 se houver spec de jornada novo (§3.12) | brief |

**Por que esta ordem:**

- os commits 1 a 4 são as divergências da matriz e não dependem de ninguém; podem ser escritos assim que o plano for aprovado, no worktree do pacote;
- o 5 é o "se couber" e sai sozinho;
- o 9 espera o último merge de pacote; o 10 espera a rodada final de testes.

### 8.2 Esforço

**P no texto (cerca de 1 dia), mais meio dia de conferência na integração.** A matriz dá 1 P, e o texto das 5 divergências cabe nisso. O que passa do P:

- os registros de D-00 a D-17 em seis planos e os marcadores dos seis pacotes;
- a conferência da §11 nas três plataformas (aproveitando o seed e os builds da integração);
- a espera pelos outros pacotes, que não é trabalho mas segura o fim.

### 8.3 Riscos

- **O texto do marcador sair do plano do irmão, não do que entrou.** Mitigado pela regra da §3.13 (só do §12 do `onda-5.md` ou do §10 do plano).
- **Decidir um ponto do PO por escrito.** O "Concluir" escondido, a D-00, a marca da folha de bônus. Mitigado pela coluna "Em aberto" e pelo `/code-review`.
- **Renumerar o §1** e deixar os comentários dos specs errados. Mitigado pela regra da §3.0.
- **As contagens mudarem depois do commit 10** por uma correção tardia. O orquestrador repete a contagem (§3.12).
- **Conflito com um irmão que anotou o mesmo plano** (como o P04-D fez no v4 §3.4). Mitigado pelo `git log` da §3.13 e pelo P01-D entrar por último.

### 8.4 Conflitos com os pacotes da onda

A ordem proposta: **o P01-D entra por último**, como a matriz pede ("Conversa com: Por último").

| Arquivo | Pacotes | Onde cada um mexe | Como resolver |
|---|---|---|---|
| `doc/plano-v4.md` | P01-D; talvez P09-D e P13 | O P09-D pode anotar o §3.4 ou o §1, item 7 (D-10), como o P04-D fez; o P13 pode anotar o §3.5 (XP) | Baixo. O P01-D entra depois e não repete |
| `doc/plano-v0.md` | P01-D; talvez P12 | O P12 pode anotar o §7, decisão 2 (convite) | Baixo. Mesma regra |
| `doc/plano-v5.md`, `doc/plano-v3.md` | P01-D; talvez P14-D, P16-D, P09-D | Anotações da Descrição, da revelação e da Mesa | Baixo |
| `doc/proximas-features.md` | P01-D; talvez P16-D | O P16-D, se ficar para depois, pode registrar a si mesmo | Baixo: o marcador do P01-D vira link |
| `CLAUDE.md` | P01-D; talvez P12 e P15-D | O P12 pode documentar o deep link; o P15-D, a versão dos templates | Baixo: o P01-D só troca números nas l.125-129 |
| `design/templates/README.md`, `design/templates/*.json` | P15-D, P16-D, talvez P13 | — | Sem conflito: o P01-D não toca |
| `doc/testes/2026-11-01/matriz-achados.md` | ninguém | A alteração local sem commit ("Tamanho das ondas") | O P01-D não toca nem inclui em commit |

### 8.5 Arquivos tocados

- **Docs:** `doc/plano-v0.md`, `doc/plano-v1.md`, `doc/plano-v2.md`, `doc/plano-v4.md`; `doc/plano-v3.md` e `doc/plano-v5.md` (commit 5); `doc/regras-wod.md`; `doc/proximas-features.md`; `doc/plano-observabilidade.md`; `CLAUDE.md`.
- **Não toca:** código, testes, E2E, templates, `schema.json`, migrations, `@tms/ui`, a matriz (md e csv), os `doc/planos-pacotes/*.md` (fora este plano), `doc/script.txt`.

## 9. Perguntas abertas (técnicas)

1. **Onde a seção nova entra no v4 e no v5**, que não têm "Estado da vN" antes do §2: logo depois do §1 (proposta) ou no fim, antes do "Fora"?
2. **Quem gera a matriz e a partir de quê.** O brief diz que ela é gerada; o repositório não tem o gerador (`scripts/` não a cita). A revisão da D-00, quando o PO decidir, entra por quem a gera (§3.10, item 4).
3. **A contagem da api.** O `CLAUDE.md` diz 1936, e nenhuma integração mediu esse número. Contar só os `pass` no PGLite (proposta) ou somar os `*.pg.test` rodados à mão numa frase à parte?
4. **O script das checagens da §4.1** fica no scratchpad (proposta) ou vira um `scripts/check-doc-links.mjs` no CI? Virar script é código novo e sai do escopo do P01-D.
5. **A linha "Revisto" nas Etapas** (§3.0): uma linha logo abaixo (proposta) ou uma nota de rodapé no fim do plano?

**Pontos para o PO** (não decididos aqui):

1. **D-13 até a D-17.** A D-13 diz "D-00 a D-14"; o plano registra até a D-17, com as três últimas dependendo dos pacotes da onda (§2, item 1).
2. **O v3 e o v5 entram?** A matriz lista v0, v1, v2 e v4. O mesmo "Evoluir" está no v3, e as decisões D-10, D-15 e D-17 mudam o que o v3 e o v5 descrevem. Recomendação: entram, num commit que sai sozinho (commit 5).
3. **O estado da v4** (§3.14): registrar que a jornada do §1 e a `validacao-v4.md` não existem, sem declarar a v4 validada? Recomendação: sim, uma linha, como o `plano-v5.md:57` já faz.
4. **O v3 §1, item 5** (prevenção em vez de recusa ao remover o jogador): estender a D-13? Recomendação: sim, com o mesmo texto da divergência 3.
5. **O Posto 0 e a frase "Começa em 1"** (§3.2): é conteúdo do `wta-w20`; se o PO quiser corrigir, cabe no aumento de versão do P15-D.
6. **Seguem abertos, e os registros os apontam:** [onda-4.md](onda-4.md) §6, pontos 2 ("Concluir" escondido) e 16 (a D-00 depois do PR #49), e os demais da §2.

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

Implementação em 05/11/2026, na `pacote/p01-d-planos-tela` a partir de `52dbe0f`, em paralelo com os outros pacotes da onda (cada um no seu worktree). Nada foi decidido aqui. Os pontos 1 e 2 do PO (§9) seguiram a instrução do orquestrador, que é o texto da D-13 e da matriz, e não a recomendação deste plano. Os demais pontos e as perguntas técnicas seguiram a recomendação.

**O que ficou fora, e por quê:**

1. **O registro vai até a D-14**, como a D-13 diz (ponto 1 do PO). As linhas da D-15, D-16 e D-17 não entraram nos registros do v0, v1, v2 e v5. O v0 §1, item 8 (as Notas do Narrador que o aparelho do jogador nunca recebe), continua como estava. Se o PO estender a D-13, as três linhas entram no commit 9, com o texto do §10 do P14-D, do P15-D e do P16-D.
2. **O commit 5 (plano-v3 e plano-v5) não foi feito** (ponto 2 do PO; ponto 4 também segue aberto). Entraram no plano-v3 só as duas linhas "Revisto" do job `postgres` (l.128 e l.304), que são o fato do PR #49 (§3.10, item 2). Elas foram para o commit da observabilidade, que agora se chama `docs(observabilidade, plano-v3): …`. O "Evoluir" do v3 §1, item 1, e as correções T-32, T-80, T-52 e T-15 ficam para quando o PO responder.
3. **A linha sobre o estado da v4** (§3.14; ponto 3 do PO) não entrou.
4. **O Posto 0 e a frase "Começa em 1"** (ponto 5 do PO) não foram escritos em plano nenhum: são conteúdo de template.
5. **Os commits 9 e 10 são do orquestrador.** O 9 preenche os 14 marcadores `[a preencher: Pxx]`: P09-D no v4 (itens 7, D-10, T-36); P12 no v0 (D-14) e no v4 (item 1); P13 no v0 (T-53, T-79), no v2 (T-79) e no v4 (itens 9 a 11, T-50, U-01); P16-D no `proximas-features.md` §5.3. O 10 traz as contagens do `CLAUDE.md`, que não mudaram neste pacote.

**Desvios de texto:**

6. **"Resumo do Concluir" (§3.7).** O texto antigo não foi trocado: ganhou "resumo do Salvar (D-01; no plano original, 'do Concluir')" no v1 e no v2, e uma linha "Revisto" na Etapa 18 do v0. Assim a regra da §3.0 vale ("o texto antigo não é apagado").
7. **A ordem do formulário do Vampiro (v0, item 4):** "conceito, clã e senhor", como sai do `identityFields` (`packages/sheet-core/src/compile.ts`, colunas do `vtm-v20`). O plano dizia "senhor e clã". A ordem do W20 (v2, item 2) também foi tirada do `identityFields` e do `wta-w20.json`: as colunas na ordem e o Posto do resumo no fim. A D2 da §11 confere na tela.
8. **O "Revisto" da l.90 do v0** ficou dentro da célula da tabela "Problemas encontrados", porque uma linha abaixo quebraria a tabela.
9. **O `proximas-features.md` §5.3** ("Revelar uma Nota do Narrador", D-17) entrou só com o marcador do P16-D. Se o pacote entrar, o orquestrador tira a subseção; se ficar para depois, ele a preenche.
10. **A coluna "Em aberto" da D-08 no v0 e no v1 é "—".** O ponto 7 do onda-4 §6 trata dos Dons, então fica só no v2.

**Conferências do PR local** (§4.1, com um script no scratchpad): os links relativos e as âncoras dos 8 arquivos tocados resolvem; nenhum "Evoluir" no §1 do v0; o `generation.default` tem a linha "Revisto"; nenhum e-mail, senha ou conta do seed. O typecheck do pre-commit passou em cada commit.

**Revisão.** Cada frase nova foi lida contra o código ou o template que ela descreve (§7, passo 4). Foram conferidos:

- `MODE_LABELS`, `OWNER_MODES` e `openingMode`;
- o `identityFields` e as colunas dos três templates;
- a Geração `readOnly` derivada;
- os `hard-cap` do `mta-m20`, o `CREATION_HARD_CAP` e o `XP_PREREQUISITE`/`cap`;
- o `completionRefusal` da API;
- as frases do `nextStep.ts` e da fase;
- a folha de bônus;
- os selos `recommend` do `vtm-v20` e do `mta-m20`, com o `CONFIRM`;
- o catálogo de 48 Dons;
- a "Casa ou subgrupo" com o `placeholder` "Opcional";
- o rótulo e o nome acessível do "Salvar".

**`/code-review` (high) no diff `52dbe0f..HEAD`.** Achou 9 frases que ainda não batiam com a tela. Cada uma foi conferida no código e corrigida em `fcae933`:

1. **O "Salvar" da D-01.** No Editar, o botão diz "Salvar alterações". Só diz "Salvar" quando o "Avisar que terminei" da criação livre fica ao lado (`useNextStep.ts`). A correção vale para o v0, o v1 e o v2.
2. **v0, item 6.** A ficha ainda em criação reabre em Editar para o dono (T-05); só a ativa abre em Jogo.
3. **v1, item 4.** O `hard-cap` vale também para o narrador quando a ficha está em criação ou pendente: o `checkCreationBatch` de `sheets/events.ts` roda para os dois. A Esfera inativa vale no Editar da criação livre e da ficha ativa.
4. **Outras menções ao job `postgres`.** Estão no v0 (Etapa 15), no v3 (l.45, l.47 e l.393), no v4 §6.3 e no v5. Cada uma ganhou uma linha "Revisto" curta que aponta para a D-00 no registro do v0. O v5 recebeu só esse fato.
5. **Duas Etapas do v0 com texto que a tela não tem mais.** São a 14 ("Distribua os pontos da ficha") e a 17 ("muda só em Evoluir"); as duas ganharam "Revisto".
6. **"O nome do modo".** A Criação é um modo próprio (`create`).
7. **v1 e v2, item 3.** Acrescentado "ou em Criação" na criação por pontos.
8. **v4, item 5, e a linha da D-05.** A folha de bônus aparece "uma vez por ficha neste aparelho", com o ponto 4 do onda-4 §6.
9. **A explicação da D-00 repetida em cinco lugares.** As linhas novas apontam para o registro do v0, que fica como fonte única. O `plano-observabilidade.md` mantém a frase própria, porque descreve um passo da Fase 8.

## 11. Conferência das divergências na tela (web, Android com AVD, iOS com idb)

O P01-D só muda documentação: em vez do roteiro de um item de código, a conferência põe cada divergência ao lado da tela, com captura, nas três plataformas, depois de todos os pacotes da onda mergeados. Ela detalha o passo 6 da §7 e confere que o texto novo dos planos descreve a tela da ponta. Só contas fictícias. A coluna "Resultado" fica em branco e é preenchida na integração. Nenhum resultado é "ok" sem a evidência; quando uma plataforma não puder ser conferida, o resultado diz "não conferido" e por quê.

### 11.a Preparação

1. **Banco e API:** `npx pnpm db:up`, `npx pnpm db:migrate` (conferir pela tabela `kysely_migration`, porque o comando trava na saída) e `npx pnpm templates:publish --published`; a API em `npx pnpm dev:api` (3001) e o Metro em `cd apps/frontend && npx expo start` (8081). Nunca `db:down`.
2. **Seed:** o mesmo da integração da plataforma, se a conferência rodar junto do roteiro dos outros pacotes. Sozinha: `npx pnpm seed:roteiro --fichas-criacao > <scratchpad>/p01d/seed-<plataforma>.log 2>&1`.
   - **A saída vai só para o log no scratchpad,** porque o seed imprime os e-mails e a senha. Ler com `grep -v -i senha`. A senha é a constante do seed e não é escrita aqui, nas capturas nem nos scripts.
   - **Contas:** N (`roteiro_narrador`) e J1 (`roteiro_jogador1`), `@roteiro.test`.
   - **O que o seed já cobre:** as crônicas "Vampiro v3/v5", "Mago v3/v5" e "Lobisomem v3/v5" (criação livre) e "Vampiro v4", "Mago v4" e "Lobisomem v4" (por pontos); "Otto <plataforma>" (Vampiro v3/v5, só nome e clã), "Isadora <plataforma>" (Vampiro v4, falta 1 de Vigor) e "Ficha Pontos R" (Vampiro v4, só o nome).
   - **Um seed por plataforma, com 15 min de intervalo** (o limite de aceites por conta). **O P01-D não gera convite** (zero por plataforma): o seed cria e aceita os dele.
3. **O que a conferência cria pela tela** (por plataforma, só com o nome): J1 cria "Conf Mago <plataforma>" em "Mago v4" e "Conf Mago Livre <plataforma>" em "Mago v3/v5". A Nova ficha do Lobisomem e a do Vampiro só são abertas e lidas, e saem por "Sair sem salvar?" → descartar. Nada entra no seed.
4. **O que esta onda precisa e o seed talvez não tenha** (fichas em cada estado, XP, Descrição longa, Notas com texto) é dos outros pacotes. A conferência do P01-D não precisa.
5. **Evidências:** no scratchpad, `p01d-<plataforma>-<ID>-<n>.png`. Sem e-mail visível na captura.

### 11.b Web (Playwright, Chromium; WebKit onde indicado)

- **Script:** `<scratchpad>/p01d/web.mjs`, com o `playwright` do `node_modules`, contra `http://localhost:8081`. Metro com `--clear` antes da rodada.
- **Viewports exatas:** `{ width: 390, height: 844 }` e `{ width: 1280, height: 800 }`.
- **WebKit:** a D1 e a D3 também em `webkit.launch()` (o relatório viu a abertura mudar entre plataformas).
- **Seletores por papel e rótulo:**
  - `getByRole('radiogroup', { name: 'Modo da ficha' })` e, dentro dele, `getByRole('radio', { name: 'Editar', exact: true })`, `'Criação'` e `'Jogo'`;
  - `getByTestId('mode-bar')` (nome "Modo Criação" ou "Modo Editar"), `getByTestId('creation-action')`, `getByTestId('next-step')`;
  - `getByRole('button', { name: 'Escolher da lista: Natureza' })`;
  - `getByRole('tab', { name: 'Pontos', exact: true })`;
  - `getByText('Evoluir')` com contagem 0 em toda a ficha;
  - a folha de bônus pelo painel, `locator('[data-testid="bottom-sheet-root"] > [aria-modal="true"]')`.
- **Um `page.screenshot` por passo.**

### 11.c Android (AVD)

- **AVD:** `Pixel_3a_API_34_extension_level_7_arm64-v8a` a 393 dp, com `-cores 4 -memory 3072` e `-gpu host`; o APK do `assembleDebug` arm64 da integração.
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Larguras:** a conferência é de texto, não de layout: só 393 dp. A 360 e a 411 dp ficam com os pacotes de layout.
- **Navegação:** `adb shell uiautomator dump` e `adb pull`, tocar no centro do `bounds` com `adb shell input tap`; `adb shell input keyevent 4` para o voltar do Android na Nova ficha ("Sair sem salvar?"). O `input text` não digita acento: o Antecedente "Geração" é escolhido da lista, não digitado. Teclado de software com `settings put secure show_ime_with_hard_keyboard 1`, e `0` no fim.
- **LogBox:** dispensar o banner antes de tocar na barra.
- **Tempo:** o emulador sob carga não é evidência de tempo; a conferência não mede tempo.

### 11.d iOS (simulador, com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, obrigatório; iPhone 17, iOS 26.5, se o tempo der.
- **Build Debug com "Sign to Run Locally"** (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`), o mesmo da integração. Sem assinatura, o app não loga (o keychain responde `-34018`). O app é `com.tms.app`.
- **O cliente do idb:** o venv `~/.venvs/idb-tms`, fora do repositório, com `fb-idb` 1.7.7; `~/.venvs/idb-tms/bin/pip-audit` de novo antes de usar (com vulnerabilidade, parar e registrar). Nunca entra no `package.json` nem no lockfile. O `--companion-path /opt/homebrew/bin/idb_companion` vai antes do subcomando.
- **O companion** fica só no socket de domínio; no fim, `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` não mostra nada.
- **Navegação:** `idb ui describe-all` (o driver esconde o valor dos campos E-mail e Senha), tocar no centro do `frame`, `idb ui swipe`, `idb ui key`, `idb screenshot`. **Limites:** sem gesto de borda (usar o "‹"); não digita fora do ASCII; o teclado de software some depois do primeiro texto. A conferência não digita além do login.
- **Deep link:** não é usado.

### 11.e Tabela por divergência

| ID | Plataforma e tamanho | Conta | Passos | Esperado (o que o plano novo diz) | Evidência | Resultado |
|---|---|---|---|---|---|---|
| D1a | Web 390 (Chromium e WebKit), Android 393, iOS SE | J1 | Abrir "Otto <plataforma>" (Vampiro v3/v5) pela lista | Abre em Editar; o seletor tem "Jogo" e "Editar", sem "Leitura" e sem "Evoluir" (v0 §1, itens 5 e 6) | `p01d-<plat>-D1a-1.png` | |
| D1b | Web 390 (Chromium e WebKit), Android 393, iOS SE | J1 | Abrir "Ficha Pontos R" (Vampiro v4) | Abre em Criação; o seletor tem "Jogo" e "Criação" (v0 §1, item 5; v3 §1, item 1) | `p01d-<plat>-D1b-1.png` | |
| D1c | Web 1280 | N | Abrir "Otto Web" de J1 | Abre em Leitura, sem seletor, com "Editar como narrador" (v0 §1, item 6) | `p01d-web1280-D1c-1.png` | |
| D2 | **Web 390 (obrigatório: onde o PO-W viu)**, Android 393, iOS SE | J1 | "Lobisomem v4" → Nova ficha → rolar o formulário inteiro → sair sem salvar | O formulário pede Nome, Nome de feito, Conceito, Seita, Raça, Augúrio, Campo, Tribo, Nome da matilha, Totem e Posto; anotar a ordem exata para o v2 §1, item 2 | `p01d-<plat>-D2-1..2.png` | |
| D3a | Web 390 (Chromium e WebKit), Android 393, iOS SE | J1 | "Ficha Pontos R" em Criação → ler a barra | "Faltam: …" no lugar do "Concluir criação"; sem `creation-action` (v4 §1, item 4) | `p01d-<plat>-D3a-1.png` | |
| D3b | Web 390, Android 393, iOS SE | J1 | "Isadora <plataforma>" → "+" no Vigor → a folha de bônus → "Entendi" → ler a barra. Não concluir | A folha "Começaram os pontos de bônus" (v4 §1, item 5); depois, "A conta fechou: você conclui." e "Concluir criação" (v4 §1, item 4) | `p01d-<plat>-D3b-1..3.png` | |
| D4a | **iOS SE (obrigatório: onde o PO-A viu)**, Web 390, Android 393 | J1 | Criar "Conf Mago <plataforma>" em "Mago v4" → Criação → Esferas → "+" na Forças até passar do Arete | A recusa perto do toque, "Forças: na criação, vai até 1." (ou o Arete da ficha), e o valor não passa (v1 §1, item 4) | `p01d-<plat>-D4a-1..2.png` | |
| D4b | Web 390, iOS SE | J1 | Criar "Conf Mago Livre <plataforma>" em "Mago v3/v5" → Editar → Forças acima do Arete | A linha mostra "1 inativo, máx. pelo Arete 1" (v1 §1, item 4, parte do Editar) | `p01d-<plat>-D4b-1.png` | |
| D5a | Web 390, Android 393, iOS SE | J1 | "Vampiro v3/v5" → Nova ficha → ler o formulário → sair sem salvar | Sem campo de Geração; "Escolher da lista" em Natureza e Comportamento (v0 §1, item 4) | `p01d-<plat>-D5a-1.png` | |
| D5b | Web 390, Android 393, iOS SE | J1 | "Otto <plataforma>" → Editar → Antecedentes → adicionar "Geração" da lista, valor 2 → ler o cabeçalho → Descartar | O cabeçalho mostra a Geração em 11ª, e ela não é editável (v0 §1, item 4) | `p01d-<plat>-D5b-1..2.png` | |
| A3 | Web 1280 | J1 | "Ficha Pontos R" → aba "Pontos" | A aba se chama "Pontos", com o "O que falta" tocável e a fase em texto (v4 §1, itens 4 e 5) | `p01d-web1280-A3-1.png` | |

### 11.f Acessibilidade mínima

O que o plano passa a descrever e a árvore confirma:

- **o nome do modo é texto:** no web, `radio` com nome "Editar" ou "Criação" dentro do `radiogroup` "Modo da ficha"; no Android, o `content-desc` dos dois; no iOS, o `AXLabel`. Nenhum "Evoluir" nas três árvores;
- **a recusa da Esfera é texto perto do toque**, lido sem depender de cor (a captura em escala de cinza mostra o mesmo);
- **o "Faltam" é texto, e os itens são botões** (a P05-D conferiu as alturas; aqui só o nome);
- **"Escolher da lista" diz o campo:** "Escolher da lista: Natureza" e "Escolher da lista: Comportamento".

A árvore é o DOM no web, o `uiautomator dump` no Android e o `describe-all` no iOS. O AVD não tem TalkBack e o `describe-all` não expõe o foco: ouvir no aparelho fica fora do P01-D.

### 11.g Limpeza

- Parar a API e o Metro (se a conferência rodou sozinha).
- Desligar o AVD (`adb emu kill`) e os simuladores (`xcrun simctl shutdown all`).
- `settings put secure show_ime_with_hard_keyboard 0` no AVD; nenhuma densidade foi mudada.
- Encerrar o `idb_companion` e conferir com o `lsof` que nada ficou escutando.
- **Convites:** o P01-D não gerou nenhum. Os do seed são do seed.
- As fichas "Conf Mago …" ficam no banco local do roteiro; as capturas e os logs, só no scratchpad. Nada vai para o repositório.

### 11.h Quando uma plataforma não puder ser conferida

O resultado diz "não conferido" e o motivo, por exemplo:

- "o build do iOS da integração falhou em …";
- "o AVD não respondeu ao `uiautomator dump`";
- "o seed da plataforma não rodou (limite de aceites)".

A divergência continua escrita como o código mostra (§3), e a conferência fica para a próxima rodada manual. A D2 no web e a D4a no iOS são obrigatórias: sem elas, o resumo do pacote diz que a divergência foi corrigida pelo código, não pela tela. Nunca "ok" sem a evidência.
