# Onda 5 · Narrador, entrada, uso e documentação: consolidação dos planos dos pacotes

> Plano · 2026-11-05 · base conferida: `onda/5-narrador-entrada-uso` em `05c5d7d`, a `main` depois do merge da onda 4 (PR #51). A `main` e a `origin/main` estão no mesmo commit (conferido com `git fetch`). A pesquisa dos sete planos foi feita nessa ponta.

A onda 5 da [matriz de achados](../testes/2026-11-01/matriz-achados.md) (seção "Onda 5 · Narrador, entrada, uso e documentação") é planejada aqui em sete pacotes:

- os cinco da matriz: P09-D, P12, P13, P01-D e P16-D;
- dois que vieram da onda 4: o P14-D (D-15, a Descrição da crônica em leitura) e o P15-D (D-16, o campo "História / Prelúdio"). O commit `960138b` (03/11) os pôs na onda 4, e o [onda-4.md](onda-4.md) não os planejou (§6, ponto 1, e §12.7). O usuário os trouxe para esta onda. A matriz ainda os lista na onda 4.

Ao fim da onda:

- o narrador acompanha a criação pela Mesa: o progresso no cartão, o filtro "Em criação / Pendentes" e a contagem na lista de crônicas;
- o painel "Criação de fichas" vira um resumo de uma linha, e as abas da crônica sobem;
- o convite vira um link que abre "Entrar com convite" já preenchido, no web e no app;
- a Experiência, a evolução e os Dados ficam sem os atritos da matriz, e a Citação e as Notas ficam editáveis no Editar;
- o jogador lê a Descrição inteira da crônica, com "Ler tudo";
- as fichas novas dos três sistemas ganham "História / Prelúdio", lida pelo narrador e pelo dono;
- se o PO confirmar o P16-D, o narrador pode revelar a Nota do Narrador de uma ficha ao jogador, e esconder de novo;
- os planos v0 a v5 dizem o que a tela faz.

Cada pacote tem um plano próprio. Este documento junta o que cruza os sete:

- a ordem de merge;
- os arquivos em comum;
- os acordos entre pacotes, com uma subseção para a versão dos templates e outra para a AuthZ;
- os pontos para o PO e as perguntas técnicas;
- o roteiro manual da integração, nas três plataformas.

As regras de execução ("PR local", integração, ondas empilhadas) são as da seção "Como executar" da matriz e não se repetem aqui. **Não há onda para empilhar:** a onda 4 já está na `main`, e a `onda/5-narrador-entrada-uso` saiu dela.

Nenhum plano remove campo, muda regra do jogo ou afrouxa limite, e o servidor continua a autoridade:

- a conta da criação (`checkCreation`, `checkCreationBatch`, `creationFreeze`) não muda. O progresso da Mesa só mostra o que essa conta já diz;
- o convite mantém o uso limitado, a validade, o limite de tentativas e o código guardado só como hash (`apps/api/src/chronicles/invite-code.ts:36`);
- as Notas do Narrador continuam privadas por padrão, e nada sai delas sem uma ação do narrador;
- quem lê o quê é decidido no servidor. O app só esconde o que o servidor já não manda.

Nenhuma decisão de produto foi tomada nesta etapa. O que o código mostrou que não se aplica como está escrito vai na seção 6, para o PO. A D-16 (quem escreve a História) e a D-17 (quando o P16-D entra) estão nesse caso.

**Os pontos para o PO das ondas 1 a 4 continuam abertos** ([onda-1.md](onda-1.md) §6 a [onda-4.md](onda-4.md) §6). O ponto 1 do onda-4 §6 (o P14-D e o P15-D) foi respondido pelo usuário nesta tarefa: os dois entram na onda 5. Os que tocam esta onda:

- **[onda-4.md](onda-4.md) §6:**
  - ponto 2, "Concluir criação" escondido (P01-D registra o que a tela faz);
  - ponto 3, a ordem do release (P15-D);
  - ponto 9, as fichas na versão anterior (P15-D);
  - ponto 15, "Orçamento" nas regras da crônica (P09-D);
  - ponto 16, a D-00 depois do PR #49 (P01-D);
- **[onda-3.md](onda-3.md) §6, ponto 3:** ficar no Editar depois de salvar (P13);
- **[onda-2.md](onda-2.md) §6:**
  - ponto 5, o "+" desabilitado (R-20; P13);
  - ponto 6, o extrato (R-17; P09-D).

A seção 6 diz como cada plano os trata, sem decidir.

## 1. Pacotes e planos

| Pacote | Plano | Itens da matriz | Decisão | Esforço | Muda | `/security-review` |
|---|---|---|---|---|---|---|
| P09-D | [P09-D-mesa-progresso-criacao.md](P09-D-mesa-progresso-criacao.md) | T-36, R-15 | D-10 | M, 4 a 6 dias, 10 commits | API: `creationInput` no `GET /chronicles/:id/table` e `creatingCount` no `GET /chronicles`, só para o narrador. Sem template, `@tms/ui` nem migration | Sim, nos 2 commits da API |
| P12 | [P12-convite-entrada-navegacao.md](P12-convite-entrada-navegacao.md) | T-30, T-43, T-44, T-45, T-51, T-73, T-82 e o achado 6 do [onda-3.md](onda-3.md) §11 | D-14 | 4 P e 2 M; ~11 dias, mais 2 de E2E e roteiro; 15 commits | `@tms/ui` (`Toast`, `BottomSheet`, `Button`); API: `number` aditivo no `GET /chronicles/:id/invites`; o `redact` do web e da API. Sem template nem migration | Sim, no diff inteiro |
| P13 | [P13-ficha-em-uso-xp-jogo.md](P13-ficha-em-uso-xp-jogo.md) | T-50, T-53, T-77, T-79, T-84, U-01, U-02 | — (correção) | 7 a 9 dias, 11 commits | `@tms/ui` (`Button.blocked`, `ChoiceOption.blocked`); `@tms/sheet-core` (`withEffectiveTo`, um caso no `invertBatch`); o texto das linhas novas do Histórico. Sem rota, template nem migration | No commit 3 (o `invertBatch`) |
| P14-D | [P14-D-cronica-leitura.md](P14-D-cronica-leitura.md) | U-09 | D-15 | P, 2 a 3 dias, 6 commits (M se a Imagem entrar) | A rota nova `chronicles/[id]/about.tsx`; o seed ganha `--apresentacao`. API: só se o PO aceitar tirar a Descrição do ex-membro | Sim |
| P15-D | [P15-D-historia-personagem.md](P15-D-historia-personagem.md) | U-10 | D-16 | M, 5 commits; o plano não dá dias, e a consolidação estima 3 a 4 | Os três templates (seção `backstory`, campo `longText` de 8000), a `0024` só de dados e o commit de versão da onda. Sem chave nova no contrato, sem API nem `@tms/ui` | Sim |
| P16-D | [P16-D-revelar-nota-narrador.md](P16-D-revelar-nota-narrador.md) | U-11 | D-17 | M, 3 a 4 dias e meio dia de roteiro, 7 commits | A `0025` de schema (`revealed_sections`, `reveal_revision`); `POST /characters/:id/reveal`, `GET /characters/:id/revealed` e `reveal` no `GET /characters/:id`; o `@tms/sheet-core` (`revealableSections`, o parâmetro `revealed`). Sem template | Sim (a matriz pede) |
| P01-D | [P01-D-planos-alinhados-tela.md](P01-D-planos-alinhados-tela.md) | U-08 | D-13 | P, ~1 dia de texto e meio dia de conferência, 10 commits | Só documentação: os planos v0, v1, v2 e v4 (e o v3 e o v5, se o PO quiser), `regras-wod.md`, `proximas-features.md`, `plano-observabilidade.md` e as contagens do `CLAUDE.md` | Não; só `/code-review` |

**Esforço total:** de 34 a 41 dias de pacote, com os sete pacotes, mais 2 a 3 dias do roteiro da integração (seção 10). Em paralelo, como nas ondas anteriores, o caminho crítico é o P12 (~13 dias). Sem o P16-D, saem 4 dias.

## 2. Ordem de merge na onda

Cada pacote é implementado em paralelo, num worktree próprio, e entra na onda em série, com um merge `--no-ff`. A ordem:

| # | Pacote | Por quê |
|---|---|---|
| 1 | **P09-D** | Define o topo da crônica: o painel recolhido e a altura acima das abas, que o `table-creation.spec.ts` mede. O P14-D e o P12 se apoiam nesse topo. Não depende de nenhum outro pacote da onda |
| 2 | **P14-D** | Põe o bloco "Apresentação" no espaço que o P09-D deixou (seção 4.1) e mede as abas de novo. É pequeno e libera o `chronicles/[id]/index.tsx` para o P12 |
| 3 | **P13** | O T-84 põe o editor no `TextLayout`. A opção "os dois escrevem" da D-16 depende dele, então o P15-D vem depois (P13 §8.4, P15-D §8.4) |
| 4 | **P15-D** | O commit de versão dos templates e a `0024` ficam no fim da branch dele (seção 4.5) |
| 5 | **P16-D**, se o PO confirmar | Depende do P15-D (`privacy.ts`, o aviso da folha, a `0025` depois da `0024`). Se ficar para depois, o P12 vem logo depois do P15-D |
| 6 | **P12** | É o maior pacote e o mais espalhado: `@tms/ui`, login, cadastro, navegação, telemetria e cinco specs. Entrando depois, ele rebaseia sobre o topo da crônica (P09-D e P14-D), sobre o `Button.tsx` do P13 e sobre o `play.spec.ts` e o `journey-storyteller.spec.ts`, em vez de segurar a cadeia P13 → P15-D → P16-D. Ele mesmo pede para entrar depois do P09-D (P12 §8.4). Se o rótulo livre do convite for escolhido (seção 6, ponto 7), a migration dele vira a `0026`, sem renumerar ninguém |
| 7 | **P01-D** | Registra nos planos o que as ondas 1 a 4 e os seis pacotes desta onda mudaram (`[a preencher: Pxx]`, 19 marcadores hoje). O critério: `grep "a preencher:"` não acha nada antes do merge. As contagens do `CLAUDE.md` são o último commit da onda, com os números da rodada final |

**A ordem do plano não é a ordem do trabalho.** Os sete pacotes começam juntos. Quem ficar pronto antes da sua vez espera o merge anterior, rebaseia e roda o "PR local" de novo.

**O `/code-review` e o `/security-review` de cada pacote** rodam na branch dele, antes do merge. Depois do último merge, o `/security-review` da onda inteira (`05c5d7d..HEAD`) roda uma vez, como na onda 4.

**O E2E roda só na integração, em série,** pelo orquestrador: as portas são fixas (API 3101, web 8181) e o banco `tms_e2e` é um só. Os agentes dos pacotes rodam o Jest e o Bun no worktree, cada um com o próprio banco (`tms_p09d`, `tms_p12`, `tms_p13`, `tms_p14d`, `tms_p15d` e `tms_p16d`), e nunca `db:down`.

## 3. Arquivos tocados por mais de um pacote

Conferidos nas §8.5 dos planos e com `grep` na ponta.

| Arquivo | Pacotes | O que cada um faz | Risco |
|---|---|---|---|
| `apps/frontend/app/(app)/chronicles/[id]/index.tsx` | P14-D, P12 (P09-D só na alternativa B) | P14-D: o bloco "Apresentação" depois de sistema e narrador (`:217-226`) e o tipo `ChronicleData`. P12: o "‹ Crônicas" (`:137`, hoje `router.replace('/')`), a lista vazia de participantes (`:406-411`, T-82) e o `InviteSheet` (`:315-320`). P09-D (A): não toca; o painel recolhido fica no `CreationSettings.tsx` | Baixo na A; médio na B |
| `apps/frontend/app/(app)/index.tsx` | P09-D, P12 | P09-D: a contagem no `chronicleMeta` (`:26-55`). P12: "Criar crônica" e "Entrar com convite" no topo (T-51; hoje em `:64-77` e no `ListFooterComponent`, `:131`) | Baixo |
| `apps/api/src/chronicles/routes.ts` | P09-D, P12, P14-D | P09-D: o `GET /chronicles` (`:289-421`). P12: o `GET /chronicles/:id/invites`. P14-D: o `GET /chronicles/:id` (`:423-509`), se o ex-membro perder a Descrição | Baixo: handlers distintos |
| `apps/api/src/test/authz-matrix.ts`, `test/matrix-systems.ts`, `__tests__/authz.test.ts` | P09-D, P12, P14-D, P15-D, P16-D | Cada um acrescenta casos de conteúdo (sentinela) ou linhas, no próprio bloco | Médio, trivial: quem entra depois rebaseia, e a matriz inteira roda depois de cada merge |
| `packages/ui/src/Button.tsx` | P12, P13 | P12: a prop `ref`, para foco por programa (a confirmação de "Revogar"). P13: um `ref` interno para o `blocked` (`markSoftDisabled`) | **Médio:** o P12, que entra depois, junta os dois num `ref` combinado |
| `packages/ui/src/Toast.tsx`, `BottomSheet.tsx`, `Choice.tsx`, `components.test.tsx`, `a11y.test.tsx`, `index.ts` | P12, P13 | P12: o `ModalToastHost` também no web, acima do `footer`. P13: `ChoiceOption.blocked` | Baixo, textual nos testes. **Pede o build nativo na integração** (seção 4.8) |
| `design/design-system/components.md` | P09-D, P12, P13 | Seções diferentes | Baixo |
| `apps/frontend/sheet/layouts/TextLayout.tsx` | P13, P16-D | P13: o `TextBlock` (`:25-60`) desenha o editor no Editar, pela regra `barEdits`. P16-D: o rótulo pelo estado, o bloco revelado do dono e o `RevealControl` no fim. O P15-D não toca | Médio: o P16-D rebaseia sobre o P13 |
| `apps/frontend/sheet/storyteller/privacy.ts` | P13, P15-D, P16-D | P13: `barEdits`. P15-D: `readByOwner` e o aviso "O jogador lê este texto.". P16-D: o aviso de nota revelada | Médio: três rebases em sequência, na ordem de merge |
| `apps/frontend/sheet/storyteller/StorytellerBar.tsx` (`TextFieldSheet`), `sheet/evolve/TextEditorRow.tsx` | P15-D, P16-D (P13 talvez no `TextEditorRow`) | O aviso do editor passa a ter três casos (seção 4.4) | Baixo |
| `apps/frontend/sheet/SheetView.tsx`, `SheetScreen.tsx` | P09-D, P13, P16-D | P09-D: a aba "Pontos" em `pending` para o narrador. P13: o estado `xp` e o provedor do atalho (U-01). P16-D: as seções reveladas no `readableZones` e o provider | Baixo: uma linha cada |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | P09-D, P12 | P09-D: a aba "Pontos". P12: só o `BonusNotice` (o `useToastOffset`) | Baixo |
| `apps/api/src/sheets/events.ts` | P13, P16-D | P13: as gravações com o "para" efetivo (`:393-413`). P16-D: os passos de revelar e esconder no Histórico | Baixo |
| `packages/db/src/migrations.ts`, `__tests__/migrations.test.ts` | P15-D, P16-D | A `0024` (dados) e a `0025` (schema), nessa ordem | Baixo, pela ordem de merge (seção 4.6) |
| `design/templates/README.md` | P15-D, P16-D | P15-D: a seção `backstory` (§4). P16-D: o contrato da revelação, sem chave nova | Baixo |
| `scripts/seed-roteiro.ts`, `apps/api/src/__tests__/seed-roteiro.test.ts` | P14-D | O `--apresentacao`, num bloco próprio. Nenhum outro pacote muda o seed | Nenhum |
| `e2e/tests/play.spec.ts` | P12, P13 | P12: o toast acima da barra fixa. P13: o "Gastar 1" e o T-77 | Baixo: o P12 rebaseia |
| `e2e/tests/journey-storyteller.spec.ts` | P12, P13 (risco) | P12: o texto do toast (`:287`). P13: o passo 4, se a trava passar a ser lida pelo foco | Baixo |
| `doc/plano-v*.md`, `doc/proximas-features.md`, `CLAUDE.md` | P01-D | Os outros pacotes não editam os planos v0 a v5; o P01-D escreve o que eles entregaram | Nenhum |

Nenhum pacote toca a matriz (`matriz-achados.md` e `.csv`) nem o `doc/script.txt`.

## 4. Acordos entre pacotes

### 4.1 O topo da crônica (P09-D × P14-D × P12)

A ordem do topo da crônica, de cima para baixo:

1. o título, o "‹ Crônicas" (P12) e as linhas de sistema e narrador (`styles.info`, `index.tsx:217-226`);
2. o bloco "Apresentação" (P14-D): um trecho de 140 caracteres, cortado no código, e o botão "Ler tudo", com o nome acessível "Ler tudo: apresentação da crônica". Ocupa até 104 px no web a 390 e até 112 dp no AVD a 393. Sem Descrição, o bloco não aparece;
3. o resumo de uma linha do painel "Criação de fichas" (P09-D, alternativa A), com "Alterar";
4. as abas.

**A medida:** o P09-D põe as abas a ~270 px a 390, com o painel recolhido e sem a Apresentação. Com ela, ficam a ~374 px. O `table-creation.spec.ts` do P09-D fixa o limite, e o P14-D mede de novo no rebase dele. Se as abas passarem do limite, a saída do P14-D é encurtar o trecho, e não mover o bloco (P14-D §9; seção 8, pergunta 1).

**O "‹" da crônica e o "Ler tudo".** A rota `about.tsx` do P14-D usa o `useSheetBack` (`sheet/navigation.ts:17-30`). O P12 cria o `lib/navigation.ts` (`useBackTo`) e troca o `replace('/')` da crônica. No rebase, o P12 leva o `about.tsx` junto, e o "X-volta" do P12 inclui crônica → "Ler tudo" → "‹".

**O toast "Regras da criação salvas."** (`CreationSettings.tsx:259`): o texto é do P09-D, que recolhe o painel ao salvar; onde ele aparece (o `ModalToastHost`, acima do `footer`) é do P12.

**Uma prévia do convite**, se o P12 a criar (o nome da crônica antes de entrar), não leva a Descrição: o convidado que ainda não entrou não a lê (seção 4.7).

### 4.2 O progresso da Mesa e o guia da criação (P09-D sobre o P05-D)

- **Quem calcula: o app.** O `buildItem` da Mesa passa a entrada da conta (`creationInput`, com as escolhas e as regras da crônica) ao store que o cartão já cria. O texto sai de um `progress.ts` novo, ao lado do `guideItems`, com as mesmas peças que o jogador lê (`freebiesBalance`, "(prioridade)", "acima"). O narrador e o jogador leem a mesma coisa.
- **O custo com 10 fichas:** ~10 cálculos de um toque, um por linha que muda. No servidor seriam ~45 `resolve` por ficha a cada `GET /table`, uma rota de leitura sem limite de taxa e rebuscada no foco. Se 10 fichas passarem de ~100 ms no iPhone SE, o cálculo vai para depois do primeiro desenho (P09-D §9, pergunta 1).
- **O que a API passa a mandar:** o `creationInput` só no PC em `creating` ou `pending`, por pontos, e nunca com o motivo do "Pedir ajuste". A Mesa inteira continua só do narrador (404 para os outros), e o `creatingCount` da lista também.
- **O NPC fica fora:** ele nasce em `creating` e fica lá. Não entra na contagem, no filtro nem no progresso, oculto ou revelado.
- **A aba "Pontos" em Leitura para o narrador, também em `pending`:** é a mesma aba do P05-D, em leitura. Para o dono em `pending`, é ponto para o PO (seção 6, ponto 8).
- **"Orçamento" nas regras da crônica** (onda-4 §6, ponto 15, em aberto): o P09-D não renomeia. A troca é um commit P, em três frases.

### 4.3 O convite por link até a Mesa (P12 × P09-D)

O fluxo que nenhum pacote cobre sozinho:

1. o N gera o convite e copia o link (P12: "Copiado ✓" anunciado, o número e a hora para distinguir dois do mesmo dia);
2. o jogador abre o link `https://…/join#<código>` no web ou `tms://join#<código>` no app. **O código vai sempre no fragmento**, nunca na query nem no caminho;
3. a tela lê o fragmento antes do roteador e do Sentry (import em `apps/frontend/index.ts`; no nativo, pelo `+native-intent`) e o tira da URL e do histórico (`history.replaceState`). Sem esse tratamento, o Expo Router põe o fragmento em `params['#']` (P12 §3);
4. **sem sessão:** o login ou o cadastro, e depois "Entrar com convite" já preenchido. O código pendente fica só em memória, por 30 min, e nunca no disco (P12 §9, pergunta 1). A tela não aceita sozinha: o jogador toca "Entrar";
5. o jogador cria a ficha, e o cartão aparece na Mesa em criação, com o progresso (P09-D), e a lista de crônicas do N conta "1 ficha em criação".

O uso limitado, a validade, o limite de tentativas e as mensagens genéricas do aceite continuam como hoje (P02). O T-73 deixa as mensagens claras sem dizer se a conta ou o convite existe.

### 4.4 O Sobre: Citação, Notas, História e Notas do Narrador (P13 × P15-D × P16-D × P14-D)

- **P13 (T-84):** o `TextBlock` desenha o editor que já existe (`TextEditorRow`) no Editar, para quem escreve o campo e quando ele não é da barra do narrador (`barEdits`). Vale para a Citação e as Notas do jogador nos três sistemas. **Hoje nenhum texto do Sobre é editável no app**, em nenhum sistema nem plataforma (a matriz diz "Android"; P15-D §3.0).
- **P15-D (D-16):** a "História / Prelúdio" é uma seção própria, `backstory`, com `read: ["owner", "storyteller"]`. Ela tem de ser seção própria: as permissões são por seção, e na seção `about` o `viewer` de um NPC revelado leria o campo. Quem escreve é ponto para o PO (seção 6, ponto 1):
  - **A, os dois:** depende do editor do T-84, por isso o P13 entra antes;
  - **B, só o narrador:** pela barra do narrador, como as Notas do Narrador, e funciona sozinha.
- **P16-D (D-17):** revelar é estado da ficha na API, não chave do template. A seção `storyteller` continua com `read: ["storyteller"]` nos templates, e o `canRead` ganha o parâmetro `revealed`.
- **Nada passa das Notas do Narrador para a História** de forma automática. Se o narrador quiser mover o prelúdio, ele copia à mão.
- **O aviso do editor do narrador** (`TextFieldSheet`), na ordem:
  1. com a nota revelada: "Reveladas: {jogador} lê o que você salvar aqui." (P16-D);
  2. nas Notas do Narrador, privadas: "Privadas: o jogador não vê estas notas." (R-09; P16-D §3);
  3. na História: "O jogador lê este texto." (P15-D).
- **A Descrição da crônica** (P14-D) usa a mesma forma de frase no editor dos Bastidores: "Os jogadores da crônica leem este texto." Os textos dos avisos são revistos juntos na integração.

### 4.5 A versão dos templates (P15-D, e só ele)

**Um aumento por onda** ([onda-4.md](onda-4.md) §4.7). Só o P15-D muda conteúdo de template nesta onda:

| Template | Hoje (`05c5d7d`) | Na onda 5 | Quem muda o conteúdo |
|---|---|---|---|
| `vtm-v20` | 1.9.0 | **1.10.0** | P15-D (seção e campo `backstory`) |
| `wta-w20` | 1.7.0 | **1.8.0** | P15-D |
| `mta-m20` | 1.7.0 | **1.8.0** | P15-D |

- **Os outros pacotes não mudam template:**
  - **P13, T-79:** a "Força de Vontade" entre os Atributos dos Dados vem do próprio W20 (`wta-w20.json:1234-1239`, `"from": ["attributes", "play"]`). O V20 não tem o caso, e o M20 junta as Esferas no mesmo slot. A correção é de tela: o resultado sai do topo quando a parada muda, e o slot mostra um título por grupo (`PoolOption.group`, `DiceSheet.tsx:314`);
  - **P16-D:** a revelação é estado da API. Se o time escolher a alternativa com chave no template (P16-D §9), o commit de versão vai para o fim da branch do P16-D, e o app da onda 4 passa a mostrar "Atualize o app" nas fichas novas.
- **Sem chave nova no contrato.** O `schema.json`, o `validateTemplate`, o `validate.mjs` e o `publicationIssues` não mudam. O core da onda 4 compila a 1.10.0. Provar isso é a pergunta 6 da seção 8.
- **Minor:** o conteúdo é aditivo.
- **Quem e quando:** um commit só, o último da branch do P15-D, depois do rebase sobre a onda com o P09-D, o P14-D e o P13. O commit traz, por arquivo (lição A2 da onda 4), o que o P15-D §3.7 lista:
  - os três `templateVersion`;
  - `packages/db/src/migrations/0024_templates_onda5.ts`, cópia da `0023` (só `publishProductTemplates(db)`, `down` vazio), e o registro em `migrations.ts`;
  - os testes que fixam versão: `migrations.test.ts` (o `describe` da `0024` e a descida até a `0022`), `publish.test.ts` (o caso "uma versão nova convive" monta a 1.11.0), `characters.test.ts`, `mage.test.ts:90`, `werewolf.test.ts:98` e `compile.test.ts:42-43` e `:238-240`;
  - `design/telas/dados.js`, regenerado pelo `node design/scripts/build.mjs`.
- **A ordem da publicação** é a de `PRODUCT_TEMPLATES` (`packages/db/src/templates.ts:11`): `vtm-v20`, `mta-m20` e `wta-w20`.

**O que cada app vê:**

| Caso | O que acontece |
|---|---|
| Web | O bundle e a API saem no mesmo deploy (`deploy/render/start.sh:20` roda as migrations antes de subir): sem "Atualize o app" |
| App nativo da onda 4 e ficha nova da 1.10.0 | Abre, com a História. Na saída A da D-16, o dono só lê a História nesse app: o editor vem com o P13, no app novo |
| App nativo anterior à onda 4 e ficha nova | "Atualize o app", por causa das chaves da onda 4 (`recommend`, `catalogDefaults`, `creation.advice`), não do P15-D |
| Ficha criada na versão anterior | Continua nela, sem a História (seção 6, ponto 3) |
| App novo e template antigo | Abre, sem a seção |

**A ordem do release** (onda-4 §6, ponto 3, em aberto) e **a validação dentro da migration** (onda-4 §11, pergunta 3) seguem para decisão. Não são resolvidas aqui (seção 6, ponto 4; seção 8, pergunta 7).

### 4.6 As migrations

**Ordem final, depois da integração** (a tabela do plano, abaixo, ficou como registro):

| Número | Pacote | Tipo | O que faz |
|---|---|---|---|
| `0024_character_events_to_absent` | P13 | **Schema** | `to_absent boolean not null default false` em `character_events`: marca que o "para" cru do evento era vazio. As linhas antigas ficam `false` e comparam o cru, como antes. É a alternativa que o plano do P13 já trazia (§3.3, pergunta 1): gravar o "para" efetivo no Histórico, sem saber se o cru era vazio, deixava de recusar dois desfazeres do desfazer (gravar o mesmo valor de novo; esvaziar um caminho que já mostrava o padrão), e isso afrouxava o conflito. Com a coluna, o `invertBatch` só aceita "sem mudança" no caso do plano: `to_absent`, o cru de agora vazio e o efetivo igual ao "para" gravado |
| `0025_templates_onda5` | P15-D | Só dados | Publica vtm-v20 1.10.0, wta-w20 1.8.0 e mta-m20 1.8.0 |
| `0026_character_reveal` | P16-D | **Schema** | `revealed_sections text[]` e `reveal_revision` em `characters`, com as constraints "só PC" e "até 8" |

- **A numeração seguiu a ordem de merge** (P13 → P15-D → P16-D). O `Migrator` roda sem `allowUnorderedMigrations`: um banco que já tivesse aplicado um número maior recusaria um menor que chegasse depois ("corrupted migrations"). O `/code-review` do P13 e o do P16-D apontaram isso, e os pacotes renumeraram antes do merge. O teste das migrations desce pela lista de arquivos, e não por nomes fixos.
- **Onde este documento diz "a `0024`" dos templates** (seções 1 a 4.5, 8 e 10), leia `0025_templates_onda5`; onde diz "a `0025`" da revelação, leia `0026_character_reveal`. As seções 4.12, 9 e 10.1 já foram corrigidas.
- **O P12 não tem migration:** o rótulo do convite ficou só com o número automático (seção 6, ponto 7).
- **O `db:migrate` pode travar na saída** ([onda-4.md](onda-4.md) §11): confira pela tabela `kysely_migration`.
- **Bancos dos pacotes:** `tms_p13`, `tms_p16d` e `tms_p16d_test` ficaram criados e podem ser apagados com `dropdb` na integração. O `tms_p15d` não chegou a existir. Nunca `db:down`: o Postgres do Docker é compartilhado.

**O plano, antes da integração (registro):**

| Número | Pacote | Tipo | O que faz |
|---|---|---|---|
| `0024_templates_onda5` | P15-D | Só dados | Publica as três versões novas |
| `0025_character_reveal` | P16-D, se entrar | **Schema** | `revealed_sections text[]` e `reveal_revision` em `characters`, com constraints "só PC" e "até 8". Pede `db:codegen`, o `types.ts` e o `doc/database.dbml` |
| `0026_…` | P12, só se o PO escolher o rótulo livre do convite | Schema | A coluna do rótulo. O padrão do plano (o número automático, por `row_number`) não tem migration |

### 4.7 AuthZ: quem lê o quê

Tudo é decidido no servidor. Os casos entram na matriz de AuthZ da API, nos três sistemas (`vtm-v20`, `wta-w20` e `mta-m20`), no padrão do `SECRET` e do `HIDDEN_NPC`: um valor-sentinela que não pode aparecer na resposta de quem não lê.

Os papéis:

- **narrador:** o narrador da crônica;
- **dono:** o jogador membro, na própria ficha;
- **outro jogador:** um membro, na ficha de outro;
- **`viewer`:** não é papel na crônica. É o papel de um membro na ficha de um NPC revelado (`authz.ts:103-110`, P14-D §3). Na crônica, ele é membro;
- **ex-membro:** o jogador removido ou que saiu;
- **convidado:** quem tem um convite e ainda não entrou;
- **estranho:** sem vínculo. O anônimo recebe 401 em tudo.

| Dado (pacote) | Narrador | Dono | Outro jogador | `viewer` | Ex-membro | Convidado / estranho |
|---|---|---|---|---|---|---|
| Mesa e progresso no cartão (P09-D) | lê | 404 na Mesa; vê o próprio guia na ficha (P05-D) | 404 | 404 | 404 | 404 |
| "N fichas em criação" na lista (P09-D) | lê | 0 | 0 | 0 | — | — |
| NPC na contagem e no filtro (P09-D) | não entra | — | — | — | — | — |
| Descrição da crônica (P14-D) | lê e escreve | lê | lê | lê (é membro) | **lê hoje** (`routes.ts:457-466`); ponto 5 da seção 6 | 404 |
| História / Prelúdio (P15-D) | lê; escreve conforme a D-16 | lê; escreve conforme a D-16 | 404 (a ficha) | a ficha vem sem o campo | lê a própria ficha, sem escrever (`NOT_MEMBER`) | 404 |
| Nota do Narrador não revelada (hoje) | lê e escreve | não recebe | 404 | não recebe | não recebe | 404 |
| Nota do Narrador revelada (P16-D) | lê e escreve | lê, enquanto for membro | 404 | 404 | 404 | 404 |
| Revelar e esconder (P16-D) | só ele; 422 em NPC e na própria ficha | 403 | 404 | 404 | 404 | 404 |
| Número e hora do convite (P12) | lê | 403 | 403 | 403 | 404 | 404 |

- **O NPC oculto (P11)** continua só do narrador em todas as linhas: fora da Mesa para os outros, da contagem e do filtro; a História do NPC não chega a ninguém; a revelação de nota não vale para NPC.
- **Nenhuma saída de hoje leva a nota revelada ao dono** além da rota própria (P16-D §3): a ficha, o lote, o 409, a Mesa, a rolagem e o Histórico continuam sem ela.
- **O narrador antigo, depois da transferência,** perde tudo o que é de narrador (404), como hoje.
- **O ex-membro não tem uma regra só** entre os pacotes: lê a Descrição, lê a própria ficha com a História e não lê a nota revelada. É o ponto 5 da seção 6.

### 4.8 O `@tms/ui` e o build nativo

- **P12:** o `ModalToastHost` passa a valer também no web, com o `offset` do rodapé da folha; o `CombatDock` e o `BonusNotice` passam a usar o `useToastOffset`; o `Button` ganha `ref`.
- **P13:** `Button.blocked` e `ChoiceOption.blocked`, aditivos: o controle fica tocável, com o motivo, e o servidor continua recusando.
- **Os dois mexem no `Button.tsx`.** O P12 entra depois e junta o `ref` de fora com o `ref` interno do P13.
- **O CI não compila o nativo desde o PR #49.** Por isso, o build nativo local (Android `assembleDebug` arm64, iOS `xcodebuild` Debug com "Sign to Run Locally") roda na integração, depois do merge do P12, e o `npx pnpm check:native` também. Nenhum pacote muda o `package.json` nem o lockfile.

### 4.9 Telemetria e logs

- **O código de convite não chega:**
  - ao Sentry nem ao breadcrumb de navegação: o fragmento é lido e tirado antes do Sentry iniciar, e o `redact` do `telemetry.web.ts` e do `telemetryFilter.ts` passa a tirar o código e o fragmento;
  - aos logs da API: o `redact` do `apps/api/src/http/safe-error.ts` também. O `scrubLog` (`apps/api/src/telemetry.ts`) continua só com a lista de campos permitidos, e nenhum pacote acrescenta campo a ela;
  - ao Referer: o código está no fragmento, que o navegador não manda, e o `Referrer-Policy: no-referrer` já existe (`scripts/web-headers.mjs:64`).
- **Mensagens de log novas são texto fixo**, sem PII, senha, token, código de convite, Descrição, História ou nota.
- **Os passos de revelar e esconder** (P16-D) vão ao Histórico e aos Bastidores sem o texto da nota.

### 4.10 O cache do aparelho

- **A nota revelada (P16-D)** vem numa consulta própria, `['characters', id, 'revealed']`, que o `apps/frontend/lib/persist.tsx` nunca grava, com `no-store`, `gcTime: 0`, rebusca no foco e a cada 30 s e descarte de resposta com revisão velha. Escondida, a nota sai da memória na próxima rebusca e nunca fica no disco. O limite é o mesmo do NPC: quem já leu continua sabendo.
- **A História (P15-D)** é campo da ficha e vai no cache como os outros campos que o dono lê. Ela não muda de privada para pública, então não tem o problema da nota.
- **O código de convite pendente (P12)** fica só em memória.
- **O logout** limpa o cache como hoje (P02).

### 4.11 E2E

| Spec | Quem ajusta | Ordem | O que muda |
|---|---|---|---|
| `table-creation.spec.ts` (novo) | P09-D | 1 | O progresso, o filtro, a contagem, o painel recolhido e a medida do cartão e das abas a 390 |
| `chronicle-about.spec.ts` (novo) | P14-D | 2 | "Ler tudo", a tela de leitura, o texto puro e as abas medidas de novo |
| `xp.spec.ts` (novo); `dice.spec.ts`, `play.spec.ts`, `sheet.spec.ts`; `journey-storyteller.spec.ts` se o passo 4 mudar | P13 | 3 | A lista agrupada, o "Enviar pedido" no rodapé, o motivo do bloqueado, o "Gastar 1" efetivo, o T-79 e o T-84 |
| `backstory.spec.ts` (novo) | P15-D | 4 | A História nos três sistemas, o dono e o narrador; o outro jogador não a lê |
| `reveal-notes.spec.ts` (novo) | P16-D | 5 | Revelar, esconder, o IndexedDB sem a nota (`page.evaluate`) |
| `invite-link.spec.ts`, `navigation.spec.ts` (novos); `chronicles.spec.ts` (`:74`), `auth.spec.ts` (`:78`), `account.spec.ts` (`:57`), `journey-storyteller.spec.ts` (`:287`), `play.spec.ts` | P12 | 6 | O link com fragmento, a URL sem o fragmento depois de lido, o fluxo sem sessão, o "Compartilhar" no WebKit sem Web Share API, sem `pageerror`, os três "voltar" |

- **Os journeys que geram e digitam o código não mudam:** o `invite-code-value` continua, e o link é um caminho a mais.
- **O `narrator.spec.ts`, o `table.spec.ts` e o `layout.spec.ts`** não mudam de seletor com o painel recolhido (P09-D §4.3). O P09-D os roda no commit do painel.
- **O Playwright não clica em `aria-disabled` sem `force`** ([onda-4.md](onda-4.md) §11): os specs do P13 que tocam o controle bloqueado usam `force` e conferem o motivo.
- **O RN-web só dispara `onLayout` com mudança de tamanho** (A3): o `fitProgress` do P09-D usa a largura da janela e da coluna, não o `onLayout`.

### 4.12 Seed do roteiro

- **O seed já cobre** (`scripts/seed-roteiro.ts:16-35`): as contas N, J1, J2 e N2; por sistema, as crônicas "{Sistema} v3/v5" (livre) e "{Sistema} v4" (por pontos), com J1 e J2; com `--fichas-criacao`, as fichas da onda 3, entre elas a "Ficha XP R" (10 XP e um pedido de Força pendente) e o "Otto".
- **Só o P14-D muda o seed:** `--apresentacao` grava três Descrições fictícias (uma curta, uma de 3.600 caracteres no "Mago v4" e uma de 4000), sem texto de livro, sem convite e sem conta nova.
- **O roteiro cria pela tela,** só com dados fictícios e nomes em ASCII:
  - as fichas em cada estado para a Mesa (em criação, aguardando aprovação, aguardando ajuste, devolvida e concluída, com e sem "terminei") e um NPC oculto (P09-D);
  - o "Lobo R" (W20) para o T-79 e o saldo insuficiente para o T-77 (P13);
  - Notas do Narrador com texto (P15-D, P16-D);
  - a ficha na versão anterior, criada antes da `0025_templates_onda5` (P15-D; seção 10.1);
  - por plataforma, a "Cronica P12 <plataforma>" e uma conta nova `p12_<plataforma>@roteiro.test` pelo link sem sessão (P12).
- **A saída do seed tem a senha, os e-mails e o código do convite do N2** (`seed-roteiro.ts:602`). Vai só para um log no scratchpad, com permissão `600`, lido com `grep -v -i -E 'senha|convite N2'`. A senha é a constante do seed e nunca é escrita num plano, num script versionado ou numa captura.

### 4.13 Segurança e revisão

| Pacote | Ameaça principal | O que o desenho evita | `/security-review` |
|---|---|---|---|
| P12 | O código de convite vazar pela URL, pelo histórico, pelo Referer, pelo Sentry ou pelos logs; o deep link abrir outra rota com o código; enumeração de conta ou convite | O fragmento, lido antes do roteador e do Sentry e tirado do histórico; o `redact`; o `+native-intent` só leva o código ao `join`; os limites do P02 como estão; as mensagens genéricas | Diff inteiro |
| P09-D | O progresso, que é derivado da ficha, chegar a outro jogador; o NPC oculto contado | A Mesa e o `creatingCount` só para o narrador; o `creationInput` sem o motivo; o NPC fora | Os 2 commits da API |
| P14-D | A Descrição chegar a quem não é membro; texto executável | Os 404 de hoje; `Text` puro, sem markdown, link ou `dangerouslySetInnerHTML`; os limites de hoje (80/4000/2048, só HTTPS, `safeText`) | Sim |
| P15-D | A História chegar a outro jogador ou ao `viewer`; o prelúdio sair das Notas sem o narrador | Seção própria com `read: ["owner","storyteller"]`; nenhuma cópia automática; o `text()` do template recusa `<`, `>`, controle e bidi | Sim |
| P16-D | Dado privado virar público sem ação do narrador; a nota ficar no aparelho depois de escondida; o dono revelar a própria nota | Só o narrador revela, no servidor, com registro no Histórico; a consulta fora do `persist.tsx`; a revisão descarta resposta velha | Sim |
| P13 | O desfazer do narrador burlar a revisão da criação | O caso novo do `invertBatch` não muda quem desfaz; o candidato (c) da seção 6 trata o que já existe | O commit 3 |

## 5. O que a consolidação corrigiu nos planos

Os planos não foram editados na consolidação. O que muda em relação a eles:

1. **A ordem de merge põe o P12 em sexto** (seção 2). O P12 pedia só "depois do P09-D" (§8.4), e a consolidação o leva para depois da cadeia P13 → P15-D → P16-D. Nada no desenho dele muda; o rebase dele fica maior.
2. **O P14-D, o P15-D e o P16-D chamam a §9 de "Perguntas abertas", sem "(técnicas)"**, porque juntam ali os pontos para o PO. Os pontos estão todos na seção 6 deste documento, e as perguntas técnicas na seção 8.
3. **A medida das abas com a Apresentação** (~374 px a 390) não está em nenhum plano sozinho: o P09-D mede sem a Apresentação, e o P14-D sem o painel recolhido. A seção 4.1 junta as duas.
4. **O T-51 e o T-82 são do P12** (matriz l.556 e l.558). O pedido desta etapa os citou como exemplos de item só do iOS; a §11 do P12 os tem como obrigatórios no iOS.

## 6. Pontos para o PO (nenhum decidido nos planos)

**Respostas do usuário em 05/11/2026, no início da implementação** (os outros pontos desta seção seguem abertos; os pacotes aplicam a recomendação do plano e registram no §10):

- **D-16 (ponto 1): A, os dois escrevem.** O dono escreve pelo Sobre no Editar (o T-84 do P13), e o narrador pela barra. O P15-D entra depois do P13.
- **D-17 (ponto 2): o P16-D entra nesta onda, com a revelação viva.** O dono lê a nota inteira enquanto for membro, inclusive o que o narrador salvar depois; o narrador pode esconder de novo; sem selo nem notificação. A nota continua um texto só (`storytellerNotes`), sem lista.
- **A ordem do release (ponto 4): não há app nativo na loja.** A `0024` vai no mesmo deploy da API, sem janela de "Atualize o app".

**Bloqueiam o início da implementação:**

1. **Quem escreve a História (D-16).** A D-16 diz que o narrador e o jogador leem, e não diz quem escreve.
   - **A, os dois** (recomendação do P15-D): o dono escreve pelo Sobre no Editar, e o narrador pela barra. Depende do T-84 do P13.
   - **B, só o narrador:** atende o U-10 ao pé da letra e funciona sem o P13.
   - Sem a resposta, o P15-D não fecha as `permissions` da seção `backstory`.
2. **Se o P16-D entra nesta onda (D-17: "quando houver a necessidade").** A necessidade não apareceu como pedido novo: o U-10 pedia o prelúdio, que o P15-D resolve com campo próprio. Mas o P15-D só chega às fichas novas, e **o P16-D é a única saída para a ficha que motivou o U-10** (ponto 3). Recomendação do P16-D: entrar só se o PO quiser cobrir essa ficha; senão, fica para depois. Se entrar, o PO decide também:
   - revelação viva (o jogador lê o que o narrador salvar depois) ou um retrato do texto no momento da revelação;
   - a nota inteira ou uma lista de notas (hoje é um texto só por ficha, `storytellerNotes`, `longText` de 4000);
   - sem selo nem notificação para o jogador.

**Os outros, que não seguram o início:**

3. **As fichas que já existem não ganham a História** (P15-D §3.6; onda-4 §6, ponto 9, em aberto). A ficha do U-10 continua sem o campo, e o prelúdio continua privado nas Notas do Narrador. As saídas, com o custo de cada uma:

   | # | Saída | Custo |
   |---|---|---|
   | 1 | Aceitar: a História só nas fichas novas | Zero; o pedido do U-10 fica sem resposta para a ficha dele |
   | 2 | O narrador copia o prelúdio para as "Notas" do jogador | Zero neste pacote; depende do T-84 (P13); o jogador pode apagar, e as Notas ficam misturadas |
   | 3 | Revelar a Nota do Narrador (P16-D) | M e `/security-review`; vale para a ficha antiga |
   | 4 | Atualizar a versão de uma ficha | G: migração por par de versões nos três sistemas, repetir a conta onde a regra mudou, AuthZ, Histórico e rota nova |
   | 5 | Refazer a ficha pela tela | Alto para a mesa: perde o Histórico e o extrato de XP |
   | 6 | Trocar a versão direto no banco de produção | Não recomendada nem planejada |

   Recomendação do P15-D: a 1, com a 2 oferecida ao narrador quando o P13 estiver em produção, e a 4 registrada como item futuro no `proximas-features.md` (pelo P01-D).
4. **A ordem do release** (onda-4 §6, ponto 3, em aberto). **É pergunta para o usuário:** como a onda 4 foi à produção (a loja antes ou depois da `0023`, e se há app nativo na loja) não está no repositório. O P15-D não põe chave nova, então o app da onda 4 abre a 1.10.0, e a janela de "Atualize o app" desta onda é só a de quem ainda tem um app anterior à onda 4. Se a alternativa com chave do P16-D for escolhida, a janela volta a valer para todos os apps nativos.
5. **Uma regra só para o ex-membro.** Hoje ele recebe a Descrição e a Imagem no `GET /chronicles/:id` (`routes.ts:457-466`). No desenho dos planos, ele lê a própria ficha com a História (P15-D) e não lê a nota revelada (P16-D). Recomendação dos planos: o ex-membro deixa de receber a Descrição e a Imagem (P14-D, commit 1) e a nota revelada (P16-D), e continua lendo a própria ficha, que é dele.

   **Na integração:** a D-15 da matriz já dizia que a Descrição "só chega a quem é membro da crônica (AuthZ no servidor)", e o `/code-review` do P14-D apontou o vazamento (o app só escondia o bloco, e a matriz de AuthZ exigia que o ex-membro a recebesse). O P14-D aplicou a D-15 (`38fee1d`): o ex-membro não recebe a Descrição nem a Imagem no `GET /chronicles/:id`, e a matriz recusa nos três sistemas. O resto vale como desenhado: o ex-membro lê a própria ficha com a História e não lê a nota revelada. O P16-D também zera a revelação na saída, na remoção e na transferência da narração, na mesma transação: quem volta à crônica não lê o que o narrador escreveu nesse meio tempo, e o novo narrador revela de novo.
6. **P14-D, a Imagem da crônica.** A CSP do web (`img-src 'self'`) a bloqueia, e no nativo o aparelho do jogador buscaria uma URL de terceiro, que vira rastreador. Recomendação: deixar para um upload hospedado e não afrouxar a CSP. Também: o `viewer` lê a Descrição, porque é membro.
7. **P12, o rótulo do convite (T-45):**
   - o número automático ("Convite 2 · 14:05"), o padrão do plano, sem migration;
   - um rótulo livre, que pede migration e cuidado com dado pessoal no texto;
   - o final do código: **o servidor guarda só o hash** (sha256, `invite-code.ts:36`), então mostrar o final exige guardar parte do segredo em claro. É decisão de segurança, não de layout, e fica aberta.

   Também: App Links e Universal Links, ou um "Abrir no app" no web; e escolher validade e usos ao gerar o convite, que fica fora do P12.
8. **P09-D:**
   - as frases novas (rascunho do time);
   - "Habilidades: faltam 4" por orçamento (o formato da D-10, recomendado) ou os itens por grupo do guia;
   - o painel recolhido acima das abas (A, recomendado, P) ou dentro da aba Fichas (B, ~2 dias a mais, e conflita com o P12);
   - a aba "Pontos" também para o dono em `pending` (recomendação: sim, num commit P);
   - dois filtros ("Em criação" e "Pendentes", com "terminei" em "Pendentes"; recomendado) ou um;
   - o "resumo de uma linha" a 390, que com os rótulos vira 3 linhas (recomendação: com os rótulos);
   - "Padrão do sistema" e "Restaurar padrão" (NW-04, NA-15), fora da D-10: entram numa linha nova da matriz?
   - seguem abertos: o onda-4 §6, ponto 15 (o nome "Orçamento", que o P09-D não troca), e o onda-2 §6, ponto 6 (o extrato, R-17).
9. **P13:**
   - a opção acima do saldo fica tocável, com o motivo (proposta);
   - o atalho do U-01 numa lista abre a busca com o traço;
   - as linhas antigas do Histórico mantêm o "—"; só as novas mostram "9 → 10";
   - seguem abertos o onda-2 §6, ponto 5 (o "+" desabilitado, R-20) e o onda-3 §6, ponto 3 (ficar no Editar depois de salvar).
10. **Os candidatos do P13 sem linha na matriz.** Não entram no plano sem a resposta do usuário (P13 §2.4):

    | Candidato | Origem | O que o código mostra | Recomendação |
    |---|---|---|---|
    | (a) A folha "busy" que espera as rebuscas | [onda-3.md](onda-3.md) §11, achado 1 | O mesmo padrão está no XP deste pacote (`lib/queries/xp.ts:184-190`) | Corrigir só o XP no P13 (fechar no sucesso do POST e invalidar sem `await`) |
    | (b) "permanente — → 4" e "0 → 8" no resumo de salvar | [onda-4.md](onda-4.md) §6, último item da tabela | O `describeEvent` também monta o Histórico no servidor (`sheets/events.ts:618`), e mudá-lo muda a saída da API | Junto do T-53, depois de um teste que reproduza a causa |
    | (c) O "Desfazer" do narrador no lote de criação | [onda-4.md](onda-4.md) §11, achado 6 | **Depois da aprovação**, não é bug de regra: o narrador escreve em qualquer estado, e desfazer equivale a reabrir a criação, que a D-04 deixou fora. **Antes da aprovação, é bug de regra:** a rota de eventos repete o `checkCreationBatch` para o dono e para o narrador em `creating` e `pending` (`sheets/events.ts:346-360`), e o desfazer da crônica não repete (`chronicles/operations.ts:578-626`, conferido nesta consolidação). Um desfazer pode deixar a conta acima do saldo ou do teto sem recusa | Uma linha nova na matriz e o `/security-review`; o texto do "Desfazer" depois da aprovação é decisão de produto |
    | (d) O traço no limite com `disabled` e `tabindex=-1` | [onda-4.md](onda-4.md) §11, achado 4; [onda-2.md](onda-2.md) §6, ponto 5 | O "+" no limite do template continua `disabled` | Depende do ponto 5 do onda-2 §6 |
11. **A D-00 depois do PR #49** (onda-4 §6, ponto 16, em aberto). O CI não compila mais o nativo, e a tabela de decisões da matriz não registra a revisão. O P01-D escreve o fato no registro do plano-v0 (uma linha "Revisto" na l.186), no plano-v3 (l.128 e l.304) e no `plano-observabilidade.md` (l.588-589 e l.596-597, que ainda dizem que o CI compila o nativo), sem editar a matriz. A revisão da decisão continua com o PO, e o P01-D deixa no resumo do pacote um texto sugerido para quem gera a matriz.
12. **P01-D:**
    - registrar até a D-17 (a D-13 diz "D-00 a D-14");
    - incluir o plano-v3 e o plano-v5;
    - estender a D-13 ao v3 §1, item 5 (o mesmo "Evoluir");
    - registrar que a v4 não tem a validação nem o `journey-creation.spec.ts` (o `plano-v5.md:57` já diz);
    - o Posto do W20 nasce 0, e a frase do "?" diz "Começa em 1": é conteúdo de template, que caberia no commit de versão do P15-D se o PO quiser;
    - segue aberto o onda-4 §6, ponto 2 ("Concluir criação" escondido).
13. **A matriz.** As linhas D-15, D-16 e D-17 estão dentro da tabela "Ondas e pacotes" (l.35-40), e não na de "Decisões de produto". O P14-D e o P15-D continuam listados na onda 4, e a onda 5 diz "5 PRs". Quem gera a matriz corrige; nenhum pacote a edita.

## 7. Causas da matriz corrigidas pela leitura do código

A matriz cita o `1db3db9`, de antes das ondas 1 a 4. Os planos conferiram cada linha na ponta (`05c5d7d`):

| Item | A matriz diz | O código mostra (plano) |
|---|---|---|
| T-43 | O toast atrás da folha vem da l.49 do `InviteSheet` | O `ModalToastHost` está desligado no web (`Toast.tsx:182`, commit `00a6f29`), e o `CombatDock` e o `BonusNotice` não usam o `useToastOffset` (P12) |
| T-30 | As linhas citadas | Os pontos certos são o `new-character` l.77, o `join` l.34 e o `new` l.57. O "‹" da crônica faz `replace('/')` (l.137), o que duplica a lista no nativo e é uma hipótese do achado 6 do onda-3 §11 (P12). O [onda-4.md](onda-4.md) §6 dizia que o achado 6 é "do mesmo tipo do T-39"; o T-39 (voltar à Mesa no mesmo ponto) entrou no P09-C, e o caso de agora é o do T-30 |
| T-51 | Os botões nas l.30-34 | Estão no `ListFooterComponent` (l.131) e em `:64-77` (P12) |
| T-82 | Falta o selo "Arquivada" | O selo existe desde o P04-D; faltam os dois textos da lista vazia (P12) |
| T-50 | A opção não fica marcada | Fica marcada; o problema é o resumo a ~3.000 px, depois de todos os chips (P13) |
| T-53 | O `withEffectiveFrom` resolve | Não basta para o inverso: o "Gastar 1" da `ResourceSheet` e da `TrackSheet` não passa por ele, e o desfazer grava o "para" nulo. Pede um `withEffectiveTo` e um caso no `invertBatch` (P13) |
| T-79 | A FdV entre os Atributos é erro do app | Vem do próprio W20 (`"from": ["attributes", "play"]`), por decisão; o V20 não tem o caso, e o M20 junta as Esferas (P13) |
| T-84 | Só no Android | Vale para os três sistemas e todas as plataformas: nenhum texto do Sobre é editável no app (P13, P15-D) |
| R-15 | O cartão não mostra "Aguardando aprovação" | Resolvido no P04-D. Faltam o progresso, porque a API não manda as escolhas nem a camada da criação, e a aba "Pontos" em `pending`, que some pelo `useCreating` e por uma decisão do P09-C (P09-D) |
| U-09 | A Descrição não chega ao jogador | A API já manda (`routes.ts:454-466`); o defeito é só de tela. E o ex-membro também recebe (P14-D) |
| U-10 | "wod-w20", "sem migration", "jogador", "TextLayout" | É o `wta-w20`; a versão nova tem migration (a `0024`); quem lê é o dono, não qualquer jogador; o `TextLayout` não muda no P15-D (é do P13) |
| U-08 | "§1.N" e "prevenir em vez de recusar" | "§1.N" é o item N da lista do §1, não uma subseção. A tela previne, e o servidor também recusa (`completionRefusal`, `creation.ts:665` e `:761`). O bloqueio da Esfera acima do Arete vale só na criação por pontos; no Editar, continua inativo (P01-D) |
| `CLAUDE.md` | api 1936 testes | O número não aparece em nenhuma integração; a onda 4 mediu core 1119, api 1924, ui 226 e frontend 1593 (P01-D) |

## 8. Perguntas técnicas abertas

Cada plano tem as suas na §9. As que cruzam pacotes:

1. **A altura do topo da crônica** com a Apresentação e o painel recolhido (seção 4.1): o limite do `table-creation.spec.ts`, e se o trecho do P14-D encolhe para caber (P09-D §9, pergunta 3; P14-D §9).
2. **O custo do progresso com 10 fichas no iPhone SE** (P09-D §9, pergunta 1): medir antes de decidir se o cálculo vai para depois do primeiro desenho.
3. **O código pendente do convite** em memória ou em `sessionStorage`/`SecureStore` (P12 §9). A proposta é memória, por 30 min: sobrevive ao login, não ao fechamento do app.
4. **O `EXPO_PUBLIC_WEB_URL` no build da loja** (P12 §9): o link `https` precisa da origem do web de produção.
5. **O `ref` combinado do `Button`** (P12 × P13): a forma do merge no `@tms/ui`.
6. **Como provar que o app da onda 4 abre a 1.10.0** (P15-D §9): a proposta é um teste que compila os três JSON novos com o core da `05c5d7d`.
7. **A validação dentro da migration** ([onda-4.md](onda-4.md) §11, pergunta 3): a `0024` repete a `0023`, e o teste da API que passa cada arquivo gravado pelo schema, pelo contrato, pela publicação e pelo `compileTemplate` cobre os novos. Segue para decisão.
8. **Revelar por regra tirada das `permissions` ou por chave no template; rota própria ou a nota dentro da ficha; colunas ou tabela** (P16-D §9). A proposta é a regra das `permissions`, rota própria e colunas, sem chave nova.
9. **A troca de aba no histórico do web** (P12 §9; a pergunta 6 do onda-3 §8): se a aba da crônica empilha no histórico, os três "voltar" mudam de natureza.
10. **O tamanho da História:** 8000 ou 4000, como as Notas (P15-D §9).
11. **O que conta como teste da api no `CLAUDE.md`** (P01-D §9): o `pass` do Bun, com ou sem os `*.pg.test` pulados no PGLite.
12. **Quem gera a matriz** (P01-D §9): não há gerador no repositório, e o P01-D deixa o texto sugerido para a D-00, a D-15 a D-17 e a onda dos pacotes P14-D e P15-D.

## 9. Riscos da onda

- **O P12 é o caminho crítico** (~13 dias) e entra em sexto. O rebase dele passa pelo topo da crônica, pelo `Button.tsx` e por dois specs. Mitigação: o P12 rebaseia a cada merge da onda, não só no fim.
- **O limite de convite e de cadastro é por IP** na máquina local: as três plataformas saem do mesmo IP (o AVD pelo `adb reverse`, o simulador e o navegador pelo localhost). O roteiro do P12 conta no máximo 3 aceites e 1 a 2 cadastros por plataforma, com o 409 do T-73 só no web, uma plataforma por vez e 15 min entre os seeds (seção 10.1).
- **A `0024` (P13) e a `0026` (P16-D) são as primeiras mudanças de schema desde a `0022`.** Elas rodam no deploy da API, antes de subir. O `/security-review` da onda e o teste das constraints vêm antes do PR.
- **O texto longo** (a Descrição de 4000, a História de 8000) num nó acessível só: o leitor de tela lê tudo de uma vez. O P14-D corta o trecho no código; a tela "Ler tudo" e a História dividem em parágrafos (`paragraphs`).
- **A ficha antiga do U-10 continua sem a História.** Se o PO não escolher uma saída (seção 6, ponto 3), o narrador que pediu não vê a mudança na ficha dele.
- **O `@tms/ui` muda em dois pacotes, e o CI não compila o nativo.** O build local da integração é o único que prova o app.
- **O catálogo de Dons, as frases e os resumos da Fraqueza** ainda pedem revisão antes de chegar ao jogador ([onda-4.md](onda-4.md) §11). Esta onda não os muda, mas o roteiro passa por eles (seção 10.8).

## 10. Testes manuais da integração (web, Android com AVD, iOS com idb)

O roteiro com os sete pacotes juntos, na `onda/5-narrador-entrada-uso` depois do merge do P01-D, no formato da §11 dos planos. Cada plano tem a tabela completa dos itens dele (§11.e). Esta seção ordena o que roda na integração:

- o critério de saída da onda;
- os itens que dependem de mais de um pacote;
- os itens obrigatórios por plataforma;
- o que ficou não conferido na onda 4.

Só contas e dados fictícios. A senha é a constante do seed, e o código de convite é lido de arquivo: nenhum dos dois é escrito aqui, num script versionado, numa captura ou num relatório.

### 10.1 Preparação

**Serviços.**

- `npx pnpm bootstrap`, se o `scripts/check-dev-env.mjs` pedir. Com o core mudado pelo P13 e pelo P16-D, o `dist` precisa estar novo.
- **O banco da integração:**
  - `npx pnpm db:up` e `npx pnpm db:migrate`, conferido pela tabela `kysely_migration` (o comando pode travar na saída);
  - **antes da `0025_templates_onda5`:** a ficha na versão anterior, "Antiga R" em "Mago v4", criada pela tela com o `mta-m20` 1.7.0. Se o banco já migrou, ela vai num banco à parte (`tms_onda5_antes`), migrado até a `0023`;
  - `npx pnpm templates:publish --published`, que deve dizer "sem mudança", e a conferência de que vtm-v20 1.10.0, mta-m20 1.8.0 e wta-w20 1.8.0 estão publicados;
  - os bancos dos pacotes (`tms_p09d`, `tms_p12`, `tms_p13`, `tms_p14d`, `tms_p15d` e `tms_p16d`) podem ser apagados com `dropdb`. Nunca `db:down`.
- API em `npx pnpm dev:api` (porta 3001) e Metro em `cd apps/frontend && EXPO_PUBLIC_WEB_URL=http://localhost:8081 npx expo start` (porta 8081), com as saídas em logs do scratchpad.

**Seed, um por plataforma:** `npx pnpm seed:roteiro --fichas-criacao --apresentacao > <scratchpad>/onda5-seed-<plataforma>.log 2>&1`, com permissão `600`, lido com `grep -v -i -E 'senha|convite N2'`, e pelo menos 15 min entre dois. O seed apaga a rodada anterior. O que ele cobre e o que o roteiro cria pela tela está na seção 4.12.

**Os convites:**

| Plataforma | Gerados | Aceites (todas as tentativas contam) | Cadastros |
|---|---|---|---|
| Web | 3 | 3 | 2 (um é o 409 do T-73) |
| Android | 2 (um pelo script web, um no app) | 2 | 1 |
| iOS | 2 (um pelo script web, um no app) | 2 | 1 |

O teto é de 10 aceites a cada 15 min por IP e por conta, e de 5 cadastros por hora por IP, e não muda. O item X-convite (10.7) usa a conta nova do P12 de cada plataforma, sem convite a mais. Um 429 deixa a linha "não conferido (429)", e a plataforma espera 15 min. O link fica em `<scratchpad>/onda5-link-<plataforma>.txt` (`600`), e nada vai para a saída padrão.

**Evidências:** no scratchpad, com o nome `onda5-<plataforma>-<largura>-<ID>-<passo>.png`, sem e-mail visível e com o campo do código mascarado (Playwright) ou recortado (`sips`, no nativo).

### 10.2 Web

- **O script:** Playwright Chromium no scratchpad, contra o Metro (8081). Os viewports exatos são 390×844 e 1280×800; o 360×740 vale para o cartão da Mesa.
- **O WebKit** entra nos itens de Safari: o T-44 (sem Web Share API, sem `pageerror`), o `aria-disabled` do P13 e a URL sem o fragmento depois de ler o convite.
- **Os seletores** são por papel e rótulo, com `exact` onde o texto se repete ("Pontos", "Em criação", "Ler tudo", "Notas"). As abas da crônica a 390 são "Fichas", "Mesa" e as dos Bastidores; as da ficha são "Ficha", "Vantagens", "Sobre" e "Pontos".
- **Um screenshot por passo.** A medida da folha a 1280 é no painel (`bottom-sheet-root > [aria-modal="true"]`), não na camada.
- **O que o Jest não pega:** a URL e o `history.length` depois de ler o convite, os atributos `aria-disabled` e `aria-pressed` no DOM, e o IndexedDB sem a nota escondida (`page.evaluate`).

### 10.3 Android (AVD)

- O AVD é o `Pixel_3a_API_34_extension_level_7_arm64-v8a`, a 393 dp, iniciado com `-cores 4 -memory 3072 -no-snapshot` (só opção de execução), com o APK debug da integração. `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Layout a 360 e a 411 dp:** `adb shell wm density`, com `wm density reset` no fim. O cartão da Mesa, o topo da crônica e a lista de evolução ficam no fim do bloco, para mexer na densidade uma vez só.
- **A navegação:** `adb shell input` e `uiautomator dump`, com o dump filtrado (sem o campo do código).
- **O deep link:** `adb shell am start -a android.intent.action.VIEW -d "$(cat <arquivo do link>)"`, com a saída em `/dev/null`. Os logs (logcat, Metro, API) são conferidos com `grep -c` pelo código, que só dá a contagem.
- **O teclado de software:** `settings put secure show_ime_with_hard_keyboard 1`.
- **O voltar do Android** fecha a folha, não a tela: na Experiência, no "Ler tudo" (que é rota: volta à crônica) e na folha do convite. Os três "voltar" do achado 6 são contados aqui.
- **O `input text` não digita acento:** nomes e textos fictícios em ASCII; prefira escolher da lista.
- **Tempo medido no emulador sob carga não é evidência.** Folha "busy" no AVD vira nota com a carga da máquina, não achado.
- **O AVD não tem TalkBack:** os anúncios ficam para ouvir no aparelho.

### 10.4 iOS com idb

- **Simuladores:** iPhone SE 3ª geração (iOS 18.x) e iPhone 17 (iOS 26.5). O app é `com.tms.app`.
- **O build Debug** usa "Sign to Run Locally" (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`). Sem assinatura, o app não loga, porque o keychain responde `-34018`. O build incremental leva ~10 min, a partir do `apps/frontend/ios/build` das ondas 3 e 4.
- **O cliente fb-idb:**
  - o venv `~/.venvs/idb-tms` já existe, fora do repositório. Conferido nesta etapa: Python 3.15.2 e `fb-idb` 1.7.7; o `idb_companion` responde (build de 22/10/2026);
  - **antes de usar, o `pip-audit` roda de novo** no venv;
  - não entra no `package.json` nem no lockfile;
  - o `--companion-path` vai antes do subcomando;
  - o companion fica só local, no socket de domínio. No fim, o `lsof` não mostra nada escutando.
- **Navegação:**
  - `idb ui describe-all`, **com os campos E-mail, Senha e Código do convite escondidos pelo driver** ([onda-4.md](onda-4.md) §11, achado 7), e o toque no centro do frame;
  - `idb ui text`, `swipe` e `key`;
  - `idb screenshot`.
- **Limites do idb:**
  - não faz o gesto de borda: use o "‹";
  - não digita fora do ASCII;
  - digita como teclado físico, e o teclado de software some depois do primeiro texto;
  - copiar e colar pode não funcionar: o contorno 2 do P15-D vira "não conferido" se não colar.
- **O deep link (`tms://`)** pede "Abrir com 'TMS'?": toque "Abrir" pelo idb. O link é lido do arquivo pelo `idb open`, com a saída em `/dev/null`.
- **Dividido em blocos,** com o resultado gravado em `<scratchpad>/onda5-ios-resultados.md` ao fim de cada bloco (seção 10.5).

### 10.5 Ordem de execução e tempo

1. **E2E completo** (Chromium e WebKit), em série, depois do merge do P01-D. Com o E2E vermelho, o roteiro manual não começa.
2. **Builds nativos:** o Android (~3 min) e o iOS incremental (~10 min, em segundo plano enquanto o web roda). O `@tms/ui` mudou, então os dois são obrigatórios.
3. **Web, de 3 a 3,5 h.** Ordem:
   - o critério de saída (10.6), como N-W, a 390 e a 1280;
   - os itens de mais de um pacote (10.7);
   - os obrigatórios do web (10.9);
   - por último, o ex-membro (o J2 sai de "Lobisomem v3/v5"), porque não há convite para voltar.
4. **Android, de 3 a 4 h.** APK, seed novo e a mesma ordem, a 393. O layout a 360 e 411 fica no fim. **O AVD é desligado antes do iOS.**
5. **iOS, de 4 a 5 h, em quatro blocos,** cada um gravado no arquivo de resultados:
   - **bloco 1:** venv, `pip-audit`, seed novo, login no SE e o deep link (X-convite);
   - **bloco 2:** o critério de saída no SE, como N-A;
   - **bloco 3:** os itens de mais de um pacote e os obrigatórios no SE; depois o iPhone 17 (o topo da crônica, o cartão e a Experiência);
   - **bloco 4:** o que ficou não conferido na onda 4 (10.8).
6. **Dentro de cada plataforma, a ordem dos fluxos:** convite (N gera, J entra) → ficha nova → Mesa (N) → ajudar, devolver e concluir → Sobre (História, notas) → Jogo, XP e Dados → crônica (Apresentação, "Ler tudo").

No total, de 2,5 a 3 dias de uma pessoa, fora os builds.

### 10.6 Critério de saída: a fase 2 do Narrador no app e no web

"A fase 2 do Narrador (acompanhar, ajudar, devolver, concluir) repetida no app e no web; E2E verdes." As personas são:

- **N-W:** o narrador veterano no web ([narrador-web.md](../testes/2026-11-01/notas/narrador-web.md)), com a fase 1 pela conta N2 e a fase 2 pela N, Tarefas F2-1 a F2-4, a 390 e a 1280;
- **N-A:** o narrador veterano no app ([narrador-app.md](../testes/2026-11-01/notas/narrador-app.md)), no simulador iOS, conta N, Tarefas 1 a 4 da fase 2;
- o Android entra como cobertura, porque o U-09 e o U-10 vieram do narrador no Android (feedback de 03/11).

As fichas que o narrador acompanha são as do roteiro, em cada estado (seção 4.12), feitas pelo J1 e pelo J2 nos papéis do Iniciante (I-W, I-A) e do Experiente. Cada linha só fica "ok" com a tarefa feita de ponta a ponta, sem ajuda de fora da tela. O roteiro é de agente, não da persona: ele confere que o que travou a persona não trava mais, e não substitui o teste com usuários.

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| SAIDA-acompanhar | Web 390 e 1280 (N-W, F2-1; NW-11); iOS SE (N-A, Tarefa 1 da fase 2); Android 393 | N | Lista de crônicas → "Vampiro v4" → Mesa → filtro "Em criação" → "Pendentes" → ler os cartões sem abrir nenhuma ficha | A lista diz "N fichas em criação" (P09-D); o painel "Criação de fichas" é uma linha, e as abas estão no topo (T-36); cada cartão diz o progresso em texto ("Atributos ✓ · Habilidades: faltam 4 · Bônus: restam 2 de 15"), o mesmo do "Faltam" do jogador; o filtro diz qual está ativo; o NPC oculto não aparece no filtro nem na contagem | `onda5-<plat>-<w>-SAIDA-acompanhar-01..05.png` | |
| SAIDA-ajudar | Web 390 (N-W, F2-2); iOS SE (N-A, Tarefa 2); Android 393 (U-10) | N, depois J1 | Abrir a ficha do Iniciante pela Mesa → aba "Pontos" em Leitura → Sobre → História (conforme a D-16) ou Notas do Narrador → salvar → (se o P16-D entrar) revelar a nota → J1 abre a ficha | O narrador lê a mesma conta do jogador sem entrar no Editar; o editor diz quem lê ("O jogador lê este texto." na História, o aviso de privado nas Notas); o J1 lê a História e, se revelada, a nota; o Histórico registra a revelação | `onda5-<plat>-<w>-SAIDA-ajudar-01..06.png` | |
| SAIDA-devolver | Web 390 (N-W, F2-3); iOS SE (N-A, Tarefa 3) | N, depois J2 | Ficha em `pending` → "Pedir ajuste" com o motivo → Mesa → "Pendentes" → J2 corrige e avisa → Mesa | O cartão passa a "Aguardando ajuste" com o progresso, e a aba "Pontos" segue em leitura para o N em `pending`; depois do "terminei", o cartão vai a "Pendentes" | `onda5-<plat>-<w>-SAIDA-devolver-01..05.png` | |
| SAIDA-concluir | Web 1280 (N-W, F2-4); iOS SE (N-A, Tarefa 4); Android 393 | N, depois J1 | Aprovar ou concluir as fichas prontas → lista de crônicas → a ficha concluída → Conceder XP com "Digitar" → J1: "Solicitar evolução" pela lista agrupada | O cartão sai de "Em criação", e a contagem cai; o "Conceder XP" aceita o valor digitado (U-02); a lista de evolução agrupada mostra a opção marcada e o resumo fixo no rodapé (T-50), e o bloqueado diz o motivo (T-77) | `onda5-<plat>-<w>-SAIDA-concluir-01..06.png` | |

### 10.7 Itens que dependem de mais de um pacote

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| X-cronica | Web 390 e 1280; Android 360, 393 e 411; iOS SE e 17 | N, depois J1 | "Mago v4" (Descrição de 3.600) → medir o topo → "Ler tudo" → "‹" → "Alterar" no resumo do painel → salvar | O bloco "Apresentação" acima do resumo de uma linha, e as abas no limite do `table-creation.spec.ts` (seção 4.1); "Ler tudo" abre a tela de leitura, com texto puro, e o "‹" volta à crônica; salvar as regras recolhe o painel e mostra "Regras da criação salvas." acima do rodapé (P09-D com o toast do P12); o J1 lê a mesma Descrição, sem o "Alterar" | `onda5-<plat>-<w>-X-cronica-01..06.png` | |
| X-convite | Web 390 (link `https`, sem sessão); Android 393 (`tms://` pelo `am start`); iOS SE (`tms://` pelo `idb open`) | N, depois a conta nova `p12_<plataforma>` | N gera o convite e copia o link → abrir o link sem sessão → cadastro → "Entrar com convite" preenchido → Entrar → ficha nova no "Lobisomem v4" → N: lista de crônicas e Mesa | "Copiado ✓" anunciado; o convite com número e hora; a URL e o histórico sem o fragmento depois de lido (web); a tela abre preenchida e não aceita sozinha; a ficha nova aparece na Mesa em criação, com o progresso, e a lista conta 1 a mais; nenhum log, nenhuma captura e nenhum breadcrumb com o código (`grep -c` dá 0) | `onda5-<plat>-<w>-X-convite-01..08.png` | |
| X-historia | Web 390; Android 393 (obrigatório: U-10); iOS SE | J1, depois N | A ficha nova (1.10.0) e a "Antiga R" (1.7.0) lado a lado → Sobre → (se o P16-D entrar) N revela a nota da "Antiga R" → J1 relê → N esconde → J1 reabre o app sem rede (a API parada) | A nova tem "História / Prelúdio"; a antiga abre sem "Atualize o app" e sem o campo (seção 4.5); com o P16-D, o J1 lê a nota revelada e, depois de escondida, não a lê de novo nem sem rede | `onda5-<plat>-<w>-X-historia-01..07.png` | |
| X-sobre | Android 393 (obrigatório: T-84); web 390; iOS SE | J1, depois N | Ficha concluída → Editar → Sobre → mudar a Citação e as Notas → (D-16 A) a História → Salvar → N abre a mesma ficha | O editor aparece no Editar para o que o J1 escreve (T-84); as Notas do Narrador não aparecem para o J1; o N vê o que o J1 salvou e edita a História pela barra, com o aviso certo (seção 4.4) | `onda5-<plat>-<w>-X-sobre-01..05.png` | |
| X-authz | Web 390 | J2 (outro jogador), N2 (convidado que não entrou), J2 depois de sair (ex-membro) | Abrir pela URL a ficha do J1, a Mesa, a crônica e a tela "Ler tudo" de uma crônica de que não é membro | 404 onde a seção 4.7 diz 404; o ex-membro conforme o ponto 5 da seção 6; nenhuma tela mostra dado de outro e depois some | `onda5-web-390-X-authz-01..06.png` | |

### 10.8 O que ficou não conferido na onda 4 ([onda-4.md](onda-4.md) §11)

Roda de graça no roteiro, quando o J1 cria as fichas novas:

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| O4-catalogo | Web 390; Android 393; iOS SE | J1 | A ficha nova do X-convite (W20) → "Adicionar Dom" → os blocos → uma recomendada; uma ficha V20 → a Fraqueza com o resumo | T-24a, T-24f, R-26c e os blocos do T-24e como no P07-D §11.e | `onda5-<plat>-<w>-O4-catalogo-01..04.png` | |
| O4-A4 | iOS SE | J1 | "Verbena R" → uma Esfera fora da Tradição → `describe-all` | "fora da Tradição: confirme com o narrador" é um elemento de texto à parte do botão. O que o VoiceOver diz segue para ouvir no aparelho | `onda5-ios-se-O4-A4-01..02.png` | |
| O4-android | Android 393 e 360 | J1 | A Quintessência do M20 no "Em jogo"; o T-24d a 360; a Humanidade no T-85; "Nenhuma Cicatriz"; o "?" pelo teclado | Como no P10-C e no P07-D §11.e | `onda5-android-<w>-O4-android-01..05.png` | |

**Segue "não conferido",** pelos limites das ferramentas: os anúncios do VoiceOver e do TalkBack, o foco depois de "ir ao grupo", o O3-T-26 (o teclado de software some no idb) e o O3-T-04-gesto (o idb não faz o gesto de borda).

### 10.9 Itens obrigatórios por plataforma

Eles vêm das §11.e dos planos e rodam na integração mesmo que já tenham rodado no "PR local", porque os merges seguintes mexem nos mesmos arquivos:

| Pacote | Web | Android | iOS |
|---|---|---|---|
| P09-D | R-15 (390, 360 e 1280: o cartão com todos os selos e o progresso, até 210 px), T-36 | **O cartão a 360, 393 e 411** | **A aba "Pontos" em `pending`** (SE) |
| P12 | **T-44** (WebKit, sem Web Share API), T-30 (F5 e link direto), T-73, a URL sem o fragmento | **O deep link `tms://`**, os três "voltar" (achado 6) | **T-51 e T-82**, o deep link com "Abrir com 'TMS'?", T-43 (o toast acima da folha) |
| P13 | **T-79 a 390** | **T-84** | **T-53, T-50, T-77, U-01 e U-02** |
| P14-D | U-09 a 390 e 1280 | **U-09** (o narrador o viu no M20) | U-09 no SE |
| P15-D | U-10a a c | **U-10d e U-10e** | U-10 no SE |
| P16-D | O IndexedDB sem a nota; o ex-membro | Revelar com o J1 no web | Esconder com o J1 no iOS e o app reaberto sem rede |
| P01-D | **D2** | — | **D4a** |

### 10.10 Acessibilidade mínima

A árvore é o DOM no web, o `uiautomator dump` no Android e o `describe-all` no iOS.

- **O progresso da Mesa** é texto, não só cor nem ícone, e entra no nome acessível do cartão. O "✓" tem o nome "completos".
- **O filtro "Em criação / Pendentes"** diz qual está ativo (`aria-pressed` no web, o estado "selecionado" no app).
- **O "Copiado ✓" do convite** é anunciado: o botão passa a "Copiado ✓" (nome acessível "Copiado") e uma região viva diz "Link copiado." (`aria-live="polite"` no web, `accessibilityLiveRegion="polite"` no Android, `announceForAccessibility` no iOS; P12 §3).
- **A confirmação de "Revogar"** recebe o foco e o devolve ao gatilho ao fechar.
- **"Ler tudo"** tem o nome "Ler tudo: apresentação da crônica".
- **O controle bloqueado** (P13) diz o motivo: `aria-disabled` e a dica no web, a dica no app, sem `disabled`.
- **"Revelar ao jogador"** e "Esconder" dizem o nome da ficha, e o nome acessível das Notas diz o estado ("Privadas: o jogador não vê" ou "Reveladas: {jogador} lê"; P16-D §3).

O anúncio pelo VoiceOver e pelo TalkBack fica para ouvir no aparelho, como nas ondas anteriores: o progresso do cartão, o filtro ativo, o "Copiado ✓", o foco da confirmação e o motivo do bloqueado.

### 10.11 Limpeza

- Parar a API e o Metro.
- **Android:**
  - `adb shell wm density reset`;
  - `settings put secure show_ime_with_hard_keyboard 0`;
  - `adb reverse --remove-all`;
  - desligar o AVD.
- **iOS:**
  - `xcrun simctl shutdown all`;
  - encerrar o `idb_companion` e conferir que nada escuta (`lsof -nP -iTCP -sTCP:LISTEN | grep -i idb`);
  - "Connect Hardware Keyboard" de volta ao padrão;
  - desativar o venv, que fica em `~/.venvs/idb-tms`.
- **Dados:**
  - os convites de teste revogados pelo N, um por um;
  - `dropdb` dos bancos dos pacotes e do `tms_onda5_antes`;
  - os arquivos de link e os logs do seed apagados do scratchpad;
  - o próximo seed apaga a rodada.
- **O `git status` não mostra nada novo do roteiro:** scripts, logs e capturas ficam no scratchpad.

### 10.12 Quando uma plataforma não puder ser conferida

O resultado diz "não conferido", com o motivo. Exemplos:

- "o P16-D ficou para depois (D-17)";
- "429 no aceite: limite por IP; a plataforma esperou 15 min e não repetiu";
- "o `pip-audit` apontou <CVE> sem correção";
- "o idb não cola texto";
- "o AVD não iniciou".

Nunca "ok" sem a evidência.

**Onde os resultados entram.** Na integração, a coluna "Resultado" das seções 10.6 a 10.8 é preenchida, e uma seção nova, "11. Integração", entra neste documento, como a §11 do [onda-4.md](onda-4.md). Ela traz:

- os merges e as revisões;
- as perguntas técnicas e o que foi aplicado;
- os achados da integração;
- o resultado das suítes;
- a conferência manual por plataforma.

## 11. Integração

Integração em 06/11/2026, na `onda/5-narrador-entrada-uso`, a partir de `5da45b2` (as respostas da D-16, da D-17 e da ordem do release, seção 6). Os sete pacotes foram implementados em paralelo, cada um no seu worktree, e entraram em série, com merge `--no-ff`. O E2E rodou só aqui, em série, no Chromium e no WebKit. Sem push.

### 11.1 Merges, na ordem real

| # | Merge | Pacote | Conflitos e como foram resolvidos |
|---|---|---|---|
| 1 | `15f1498` | P09-D | Nenhum |
| 2 | `9f614ea` | P14-D | Nenhum |
| 3 | `9faaff1` | P13 | Nenhum |
| 4 | `0a2de26` | P15-D | Cinco, todos de dois lados acrescentando, com os dois mantidos: `migrations.ts` (a `0024` do P13 e a `0025`); `migrations.test.ts` (a descida pela lista de arquivos, do P15-D); `privacy.ts` e `StorytellerBar.tsx` (o `barEdits` do P13 e o `editorNotice` do P15-D); `authz.test.ts` (a Descrição do P14-D e a História) |
| 5 | `2f2df33` | P16-D | Seis: `migrations.ts` e `migrations.test.ts` (0024, 0025 e 0026 em ordem; o teste da descida da 0025 passa a esperar também a 0026); `matrix-systems.ts` (o `sharedTextField` do P15-D e o `revealSection`); `TextLayout.tsx` (o `mode` do T-84 e o `useRevealed`); `StorytellerBar.tsx` (o aviso do editor com três casos: revelada, privada e "O jogador lê este texto."); `design/templates/README.md` (as duas regras) |
| 6 | `2104934` | P12 | Um: `packages/ui/src/Button.tsx`, com um *callback ref* que entrega a vista ao `ref` interno do `blocked` (P13) e à prop `ref` (P12), como o §10, item 9, do P12 previa |
| 7 | `289faed` | P01-D | Nenhum. Os marcadores `[a preencher: Pxx]` foram preenchidos depois, em `e529272` |

Depois de cada merge: `pnpm build`, `typecheck`, `lint` e `pnpm test` completos, e o E2E dos specs que o pacote tocou.

### 11.2 Correções da integração

Todas nos specs; nenhuma asserção de regra ou de segurança foi afrouxada, e nenhum código de produto mudou nelas.

| Commit | Spec | Causa |
|---|---|---|
| `ec63397` | `dice`, `sheet`, `xp` e `play` (13 falhas na primeira rodada dos specs do P13, que nunca tinham rodado) | Seletores que batiam também na ficha por baixo da folha (agora dentro de `bottom-sheet-root`); o "Salvar alterações" com a confirmação (D-01); o `isVisible()` que não espera o "Mais opções" a 390; o `force` no rádio com `aria-disabled`; "Força" que casava com "Força de Vontade". No `play.spec`, o aviso de "Desfazer" ficava por baixo da folha aberta no web, porque o `ModalToastHost` ainda era só do nativo: o spec passou a fechar a folha antes de desfazer. O `journey-storyteller` no WebKit falhou só sob carga (load até 330) e passou isolado |
| `21d69f5` | `backstory` | O `waitForResponse` de `GET /characters/:id` pegava o HTML da página do web, que tem o mesmo caminho; agora exige `resourceType` `fetch` |
| `ed5b27e` | `reveal-notes` | Passo sem rede: a rota abortada não muda o `navigator.onLine`, e o app mostra "Não foi possível carregar as notas reveladas." em vez de "Conecte-se…". No WebKit, a ficha do cache pode ser de antes da revelação (o IndexedDB grava com atraso), e o bloco nem aparece. A asserção de segurança fica: o texto revelado nunca aparece sem rede |
| `2a5133b` | `navigation` (intermitente no Chromium) | O `setParams` troca a URL depois do toque, e o spec voltava antes: a troca atrasada caía na entrada da lista. Agora espera a URL da última aba; 20 de 20 com `--repeat-each=5` |

### 11.3 Revisões

O `/code-review` (high) dos pacotes cujo agente não pôde chamar a skill rodou pelo orquestrador, na branch do pacote, antes do merge. Todos os achados foram corrigidos em commits `fix` com teste de regressão na branch do pacote, salvo os registrados no §10 de cada plano.

| Pacote | Achados | Os principais |
|---|---|---|
| P14-D | 7 | **AuthZ:** o ex-membro recebia a Descrição e a Imagem da API (`38fee1d`; seção 6, ponto 5). O trecho da Apresentação (quebras, palavra perdida, tela diferente do leitor de tela), o "‹" enquanto carrega e os parágrafos com espaço Unicode. O 7.º (o estado comum de carregamento) ficou registrado no §10 |
| P12 | 10 | **Segurança:** o convite pendente sobrevivia à saída da conta e a sair de "Entrar com convite" pelo voltar do sistema (`50780e2`, `000dd58`); a redação do fragmento era quadrática e redigia antes de cortar (`567360f`). Também: o login recusava o que a API aceita, o cadastro perdia campo no preenchimento automático, o "‹ Crônicas" vindo da Conta |
| P13 | 10 | **Regra:** o "para" efetivo no Histórico afrouxava o conflito do desfazer do desfazer; a saída foi a coluna `to_absent` (seção 4.6). A numeração da migration (`5b354dd`). No app: o boost na ficha travada, o "-" do Android no Ajustar XP, o resultado atrasado dos Dados, o custo velho no pedido, o atalho do U-01 |
| P16-D | 10 | **Segurança:** a revelação sobrevivia à saída, à remoção e à transferência (`739361f`); o parâmetro `revealed` do `stripRestricted`, sem uso, abria caminho para a nota ir na ficha persistida (`5641de7`). Também: o laço de GET no 404, o modelo lido fora da transação, ids não reveláveis gravados, a chave de idempotência e a numeração da migration |
| P09-D, P15-D, P01-D | 9, 9 e 9 | Rodados pelos próprios agentes; ver o §10 de cada plano |

**O `/security-review` da onda inteira (`05c5d7d..HEAD`, 06/11) não achou vulnerabilidade de alta confiança.** Cobriu a revelação das notas (só o narrador revela; o dono lê enquanto membro; zera na saída, na remoção e na transferência; a nota nunca vai na ficha), a Mesa e o progresso (só o narrador, sem o motivo do ajuste), a Descrição (o ex-membro não recebe), a História (o `viewer` não lê), o convite (fragmento, redação, memória e aceite por toque) e o desfazer com o `to_absent` (`6d82f18`, `dcc44dd`, `2a53ee4`, que o P13 pedia). Uma observação abaixo do limite: o narrador pode revelar a nota na ficha arquivada de quem saiu, e se essa pessoa voltar à crônica ela lê; é ação explícita do narrador.

### 11.4 Suítes

Na ponta da onda, depois do merge do P12 (06/11), `pnpm test` passou inteiro: `@tms/sheet-core` 1165, `@tms/config` 38, `@tms/db` 46, `@tms/api` 2089, `@tms/ui` 235 e frontend 1849, sem falha. Os commits seguintes são só de spec e de documentação.

O E2E completo passou **246 de 246** no Chromium e no WebKit (16,4 min), depois de um último `fix` de spec:

- **`d16f44f`, a jornada da v0** (falhava nos dois navegadores, determinística). Com o aviso acima do dock (`26ed892`, T-43), o toque longo no Sangue saía antes de a folha "Salvar 7 alterações?" terminar de sair; com o Modal montado, o toque longo virava toque e abria a folha do recurso. No WebKit, o aviso do dano, agora dentro da folha (`ccc1788`), ficava sobre "Curar" com o ponteiro parado em cima, e o prazo pausava (T-76). O spec espera a folha sair e tira o ponteiro; nenhuma asserção mudou.

### 11.5 O que fica para o roteiro manual (seção 10)

- **O topo da crônica do narrador com a Apresentação e o painel juntos.** O `table-creation.spec.ts` (abas abaixo de 340 a 390) roda numa crônica sem Descrição, e o `chronicle-about.spec.ts` mede só a tela do jogador, sem o painel. Nenhum spec mede os dois juntos (a estimativa da seção 4.1 era ~374 px). Conferir no X-cronica, no web a 390 e no AVD a 393; se passar do limite, a saída é encurtar o trecho (seção 4.1).
- **Dois efeitos do aviso do P12 a conferir na tela** (do `d16f44f`; nenhum é bug de regra): um toque longo que começa enquanto uma folha ainda sai vira toque; no web, o aviso dentro de uma folha sem rodapé cobre a última ação dela (por exemplo, "Curar") até sumir, e o ponteiro em cima segura o prazo. É o desenho do T-43 (`offset` 0 sem rodapé); se incomodar no roteiro, vira um achado para o PO.
- **O `play.spec.ts` fecha a folha antes de desfazer** (`ec63397`). Com o P12, o `ModalToastHost` também vale no web: dá para voltar a desfazer pelo aviso com a folha aberta, e o roteiro confere isso na tela.
- **O build nativo** de Android e iOS: o `@tms/ui` mudou (`Button.blocked` e o `ref`, `ChoiceOption.blocked`, o `Toast` e a `BottomSheet`), e o CI não compila o nativo.
- **As plataformas:** a seção 10 inteira, com os itens obrigatórios da 10.9 e a acessibilidade da 10.10. A migration dos templates agora é a `0025_templates_onda5`: a ficha da versão anterior é criada antes dela (seção 10.1).
