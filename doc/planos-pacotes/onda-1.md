# Onda 1 · Fundação: consolidação dos planos dos pacotes

> Plano · 2026-11-01 · base conferida: `onda/1-fundacao` em `3892588` (código igual ao `main` `1db3db9`, v1.1.0)

A onda 1 da [matriz de achados](../testes/2026-11-01/matriz-achados.md) (seção "Onda 1 · Fundação") tem quatro pacotes de correção: o app volta a compilar, a sessão fica segura, nada se perde ao salvar e os componentes compartilhados ficam acessíveis. Cada pacote tem um plano próprio. Este documento junta o que cruza os quatro: arquivos em comum, acordos entre pacotes, ordem de merge na onda, esforço e perguntas abertas. As regras de execução ("PR local", integração, ondas empilhadas) são as da seção "Como executar" da matriz e não se repetem aqui.

Nenhum plano remove campo, muda regra do jogo ou afrouxa limite. Nenhuma decisão de produto foi tomada nesta etapa: o que o código mostrou que não se aplica como está escrito vai na seção 6, para o PO.

## 1. Pacotes e planos

| Pacote | Branch | Plano | Itens | Esforço na matriz | Esforço no plano | Commits | Revisão antes do merge |
|---|---|---|---|---|---|---|---|
| [P01-C](../testes/2026-11-01/matriz-achados.md#p01-c) · Build, setup e resiliência a versão | `pacote/p01-c-build` | [P01-C-build-setup.md](P01-C-build-setup.md) | T-01, S-01, S-02, L-01, L-03, S-03, L-02, S-04 | 8 P | **M** | 9 | `/code-review` |
| [P02](../testes/2026-11-01/matriz-achados.md#p02) · Segurança, sessão e API | `pacote/p02-seguranca` | [P02-seguranca-sessao-api.md](P02-seguranca-sessao-api.md) | T-13, T-14, T-47, T-74, T-86 | 3 P, 2 M | **G** (8 a 10 dias); **M** sem o módulo nativo do T-13 | 9 | `/code-review` e `/security-review` |
| [P03-C](../testes/2026-11-01/matriz-achados.md#p03-c) · Rascunho, salvamento e conflitos | `pacote/p03-c-rascunho` | [P03-C-rascunho-salvamento.md](P03-C-rascunho-salvamento.md) | T-02, T-03, T-12, T-17, T-31, T-54, T-56, T-78 | 6 P, 2 M | **G** (cerca de uma sprint) | 10 | `/code-review` e `/security-review` |
| [P06](../testes/2026-11-01/matriz-achados.md#p06) · Componentes do @tms/ui e acessibilidade | `pacote/p06-componentes` | [P06-componentes-acessibilidade.md](P06-componentes-acessibilidade.md) | T-09, T-25, T-34, T-35, T-38, T-41, T-42, T-61, T-70, T-71, T-72 | 10 P, 1 M | **M** (5 a 7 dias) | 13 | `/code-review` |

**Total da onda:** 2 G e 2 M, em 41 commits. O caminho crítico é o P02 e o P03-C (G cada). Com os quatro em paralelo, a onda leva cerca de uma sprint, mais a integração (build nativo e E2E). Por que os planos passam da soma da matriz:

- **P01-C:** medir e ajustar os jobs nativos do CI no primeiro run.
- **P02:** o módulo nativo que desliga e limpa o cache HTTP no iOS e no Android (T-13), que a matriz não contava.
- **P03-C:** a migration da Nova crônica idempotente, com teste `*.pg.test`; a parte de API do conflito por campo (T-31); e a recuperação do rascunho.
- **P06:** o teclado completo (T-35), as metas de cobertura dos ramos web e o E2E novo.

**As branches de pacote** foram criadas em `3892588`, antes do commit destes planos. Antes de abrir o worktree de cada pacote, avance-a para a ponta da onda (`git branch -f pacote/<id> onda/1-fundacao`, sem commit novo), como pede "Como executar" ("saindo da ponta da branch da onda").

## 2. Ordem de merge na onda

**P01-C → P02 → P03-C → P06.** Os quatro são desenvolvidos ao mesmo tempo, cada um no seu worktree. A ordem vale só para a integração: merge `--no-ff` com o ID no título, e typecheck, lint e testes depois de cada merge (matriz, "Integração da onda").

1. **P01-C primeiro** ("Vem antes de tudo", matriz). Ele:
   - traz o build nativo no CI (D-00). É lá que se provam o módulo nativo do P02 (`apps/frontend/modules/http-cache`) e o `app.json` do P06 (iOS em pt-BR);
   - traz o Metro lendo o `src` dos pacotes (S-01), que evita testar o P03-C (que muda o `@tms/sheet-core`) contra um `dist` velho;
   - fica com os trechos de risco alto do `new-character.tsx` e do `CreationSettings.tsx`. O P03-C se ajusta a eles no rebase.
2. **P02 em segundo.** Ele:
   - fica com o número `0021` da migration (T-47, `0021_timestamptz`);
   - deixa o logout esperando a limpeza local e cria o `LogoutButton` com o aviso de pendências.

   O P03-C entra depois e liga a contagem de rascunhos nesse aviso.
3. **P03-C em terceiro.** Ele:
   - faz rebase sobre o `onSuccess` do `new-character.tsx` e o `CreationSettings.tsx` do P01-C;
   - renomeia a migration para `0022_user_commands`;
   - liga o rascunho ao aviso de "Sair" do P02.
4. **P06 por último.** É o pacote com mais arquivos e o de menor conflito. Ele:
   - faz rebase nos dois arquivos de risco médio (`CharacterForm.tsx`, depois do P03-C; `TableRow.tsx`, depois do P01-C);
   - roda as checagens de acessibilidade com as folhas novas dos outros pacotes já presentes (o `LogoutButton` do P02; a recuperação de rascunho e a folha de conflito do P03-C), que herdam o `BottomSheet` corrigido;
   - deixa o T-70 (48 dp no Android) como último commit da onda, revertível sozinho.

Com os quatro dentro: testes completos, E2E (Chromium e WebKit), build nativo de Android e iOS (uma vez, na integração: ocupa vários GB), os fluxos Maestro que dependem de binário (o `09` do P03-C e o `08` atualizado pelo P06) e a conferência no simulador das perguntas marcadas com ⚙ na seção 7. Depois, push da onda e PR para a `main`, com uma seção por pacote.

**Critério de saída da onda (matriz) × quem entrega:**

| Critério | Pacote |
|---|---|
| Build nativo de Android e iOS no CI (D-00) | P01-C (jobs `native-android` e `native-ios`) |
| Header `cache-control` coberto por teste | P02 (teste da API e `e2e/tests/headers.spec.ts`) |
| E2E verdes | Todos, na integração (as jornadas mudam com o P03-C e o P06: asserções de "Salvo" e seletores do T-42) |
| Cenários do QA para T-02, T-03 e T-13 repetidos sem o defeito | P03-C (QAW-08, QAA-01; QAA-03, IA-01, EA-04, IW-01) e P02 (QAA-02) |

## 3. Arquivos tocados por mais de um pacote

Conferidos nas tabelas "Arquivos tocados" dos quatro planos. As linhas são do commit `1db3db9`.

| Arquivo | Pacotes e trechos | Risco | Como integrar |
|---|---|---|---|
| `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx` | P01-C: L-02 (l.43–56), L-03 (`onSuccess`, l.88–95). P03-C: T-02 (l.34–36, l.78–98: chave, trava por `ref`) e T-56 (guarda de saída) | **Alto** | O P03-C refaz o `onSuccess` sobre o do P01-C. Resultado esperado, nesta ordem: `clientCommandId` (T-02), `created.current = true` (T-56), "Ficha criada." (L-03), `replace` para a ficha |
| `apps/frontend/app/__tests__/new-character.test.tsx` | P01-C (L-02, L-03) e P03-C (T-02, T-56) | Médio | Casos em blocos `describe` separados |
| `apps/frontend/components/chronicles/CreationSettings.tsx` e `__tests__/CreationSettings.test.tsx` | P01-C: L-01 (l.109–115 e o `disabled` da l.193). P03-C: T-56 (import e três linhas na l.89) | **Alto** para o P01-C, médio para o P03-C | O P03-C entra depois, e o T-56 é o último commit dele. **O P06 não edita este arquivo**, mas muda o que ele renderiza: o título visível sai de dentro do `Choice` (T-09), e o `max=1000` do `Stepper` só muda na leitura (T-34). Os testes do L-01 e do T-56 buscam por papel e rótulo, não por um texto que o título passa a repetir |
| `apps/frontend/sheet/CharacterForm.tsx` | P03-C: `onDirtyChange` (l.24, l.102–105). P06: `properName` no `Editor` (l.96–106) | Médio | P03-C antes; o P06 refaz a linha no rebase |
| `apps/frontend/components/chronicles/TableRow.tsx` | P01-C: L-02 (l.45, texto por helper). P06: T-61 (junção do rótulo, l.59–68) | Médio | P01-C antes; a junção do P06 vale para o texto novo do helper |
| `apps/frontend/sheet/SheetScreen.tsx` | P01-C: L-02 (l.99–106). P03-C: T-03 e T-17 (l.163–170, l.259–365). P06: T-42 (`NpcVisibilityBar`, l.409–480) | Baixo | Três pacotes, trechos distantes. Conferir o arquivo inteiro depois do merge do P06 |
| `apps/frontend/sheet/evolve/ModeBar.tsx` e `__tests__/evolve.test.tsx` | P03-C: T-54 e T-78 (`review`, l.110–121; `SummarySheet`, l.315–411). P06: T-35 (`ModeSwitch`, l.220–261) e T-25/T-61 nos testes | Baixo | Trechos e casos diferentes |
| `apps/frontend/sheet/creation/CreationPanel.tsx` | P03-C: T-31 (zera o formulário de devolução no `CreationStatusPanel`, l.306–309 e l.384). P06: T-09 (`showLabel`, l.430) | Baixo | Nenhum dos dois planos listou este cruzamento (achado na consolidação). Trechos distantes |
| `apps/frontend/sheet/sync/SyncProvider.tsx` (e talvez `sync.ts`) | P02: T-14 (`reset` aguardado no logout). P03-C: T-03 (`drafts`, `useLocalChanges`) e T-31 (corpo do 409) | Médio | Acordo da seção 4.2. No rebase, o P03-C mantém o `reset` aguardado do P02 e acrescenta o `drafts.clear()` |
| `packages/db/src/migrations.ts`, `packages/db/src/types.ts`, `packages/db/src/__tests__/migrations.test.ts` | P02: `0021_timestamptz` (T-47). P03-C: `0021_user_commands` (T-02) | Médio | Acordo da seção 4.3 |
| `apps/api/src/chronicles/routes.ts` | P02: T-86 (chamada do `clientIp`, l.528). P03-C: T-02 (`POST /chronicles`, ~l.158) | Baixo | Trechos diferentes |
| `.env.example` | P01-C: S-04 (l.1–7). P02: T-86 (só o comentário do `TRUST_PROXY`) | Baixo | Acordo da seção 4.1 |
| `e2e/support/users.ts`, `e2e/playwright.config.ts` | P02: T-86 (troca a simulação de clientes por `X-Forwarded-For` pelo header de teste) | Indireto | O spec novo do P01-C (`template-unsupported.spec.ts`) usa o `signUp` e herda a troca. Rodar o E2E inteiro depois do P02 |
| `e2e/tests/chronicles.spec.ts` | P02: T-74 (sem 4xx de `/transfer`). P03-C: T-02 (duplo clique) | Baixo | Casos separados |
| `e2e/tests/journey-storyteller.spec.ts`, `journey-backstage.spec.ts` | P03-C: asserções de "Salvo" em Criação/Editar. P06: seletores do T-42 | Baixo | Linhas diferentes |
| `apps/frontend/app/__tests__/chronicles.test.tsx` | P02: T-14 ("Sair" com o `LogoutButton`). P03-C: T-02 | Baixo | Casos separados |
| `packages/ui/src/BottomSheet.tsx` | P06 muda (T-71, T-35). O P02 (`LogoutButton`) e o P03-C (recuperação de rascunho, folha de conflito, `SummarySheet`) só usam | Baixo | A API pública não muda (P06, §3.12): os 22 usos herdam o fundo fora da árvore e o foco de volta ao gatilho |
| `packages/ui/src/Banner.tsx` | Só o P03-C (T-12) | Baixo | O P06 não o edita, mas o `hitTarget()` do T-70 deixa os botões mais altos no Android: o teste do `Banner` em coluna deve medir pela largura, não pela altura |
| `apps/frontend/app/(app)/_layout.tsx` | P06: T-72 (l.10–15). P01-C: pergunta 5 (boundary em todas as telas do `(app)`) | Baixo | Hoje o P01-C põe o boundary só em `app/(app)/characters/[id].tsx`. Se a pergunta 5 levar o boundary para o `_layout`, os trechos ficam vizinhos |
| `apps/frontend/app.json` | P06: T-09 (`ios.infoPlist` em pt-BR). P01-C só lê `expo.name` | Baixo | — |
| `CLAUDE.md`, `doc/testes/prompt-teste-personas.md` | P01-C (setup, stack, CI nativo). O P02 documenta o `TRUST_PROXY` no `checklist-seguranca-v0.md`, não no CLAUDE.md | Baixo | O P01-C atualiza também a versão da stack (o CLAUDE.md ainda diz Expo 57 e RN 0.86; o instalado é Expo 58 e RN 0.88) |

## 4. Acordos entre pacotes

### 4.1 Seed, `TRUST_PROXY` e IP do cliente (P01-C × P02)

- **P01-C** cuida do seed e do `.env.example` (menos o comentário do `TRUST_PROXY`). O seed passa a usar a API em processo, uma instância por conta, com os limites padrão. Assim deixa de depender do `TRUST_PROXY` e do `clientIp`.
- **P02** cuida do `clientIp`, do CORS (sem `X-Forwarded-For`), da validação em `env.ts` e do header de teste `x-tms-test-client-ip` (`TEST_CLIENT_IP`), que substitui o `TRUST_PROXY` no E2E.
- **A trava do header de teste** é `TEST_CLIENT_IP` recusado com `NODE_ENV=production` e recusado junto com `TRUST_PROXY`. Essa trava depende de o deploy definir `NODE_ENV=production`. É o primeiro ponto do `/security-review` do P02: conferir onde o deploy define essa variável e se a API sobe sem ela.

### 4.2 Logout × rascunho (P02 × P03-C)

- O rascunho mora no `UserStorage` (`useUserStorage()`), na chave `draft:<characterId>`: cifrado no app e no IndexedDB no web. Não guarda token nem credencial.
- O logout apaga o rascunho pelo `userStorage.clear()` do `onSignOut` (`apps/frontend/lib/persist.tsx` l.283–291) e pelo `sync.reset()`. O P02 mantém esse `clear` e passa a esperar a limpeza antes de concluir o logout.
- O P03-C expõe `useLocalChanges()` (`{ pending, drafts }`). Como entra depois do P02, ele liga essa contagem ao aviso de "Sair" do `LogoutButton`.
- O logout involuntário (refresh recusado) também apaga o rascunho, como apaga o outbox: é falha segura, e o aviso só cobre o "Sair" voluntário.
- **Em aberto (P02, pergunta 2):** o marcador de sessão do web, que guarda só o estado `signed-out` e nenhum dado, fica no IndexedDB (fora do escopo do usuário) ou no `localStorage`. A resposta muda a expectativa "IndexedDB vazio depois do logout" nos testes dos dois pacotes.

### 4.3 Migrations (P02 × P03-C)

- O P02 entra antes e fica com `0021_timestamptz`. O P03-C renomeia a sua para `0022_user_commands`, acerta o registro em `packages/db/src/migrations.ts` e segue o fluxo do CLAUDE.md: `db:migrate`, `db:codegen` e build do `@tms/db`. O teste "a lista registra todo arquivo" (`migrations.test.ts:16`) pega o esquecimento.
- `user_commands.created_at` já nasce `timestamptz` no plano do P03-C. Não precisa entrar na conversão do P02 nem reintroduz o T-47.
- Os dois pacotes rodam os `*.pg.test` (idempotência no P03-C, fusos no P02). Cada worktree usa o seu banco `_test` (matriz, "Recursos compartilhados").

### 4.4 Componentes do `@tms/ui` (P06 × os outros)

- O P06 muda a API do `Choice` (`showLabel`, `true` por padrão; `disabled`), do `Stepper` (`showLabel`, `false` por padrão), do `Tabs` (`id`, mais o `TabPanel` novo), do `Chip` (`kind`) e do `Button` (`accessibilityLabel`). Nenhuma prop existente sai.
- O `BottomSheet`, o `ListItem` e o `Skeleton` mantêm a API.
- Folhas e telas novas dos outros pacotes não precisam de nada do P06 para compilar. Como o P06 entra por último, ele confere essas telas novas nos testes de acessibilidade dele.

## 5. O que a consolidação corrigiu nos planos

- **P01-C:** a branch citada era `pacote/p01-c-build-setup`; a branch criada é `pacote/p01-c-build`.
- **P01-C e P03-C:** os dois supunham que o P06 edita o `CreationSettings.tsx` (títulos do T-09 e `max=1000` do T-34). O plano do P06 não edita o arquivo. As linhas de conflito foram ajustadas, e a ordem P01-C → P03-C nesse arquivo continua.
- **P03-C × P06:** o `CreationPanel.tsx` está nos dois planos e em nenhuma tabela de conflito. Foi incluído na seção 3.

## 6. Pontos para o PO (nenhum decidido nos planos)

Recomendações da matriz que o código mostra não caberem numa correção como estão escritas:

1. **P03-C, T-03/T-17: "um modelo só de gravação na criação (prioridade e pontos juntos)".**
   - Gravar os dois na hora contradiz a D-01 (P03-D).
   - Pôr os dois no rascunho trava no servidor: o `checkCreationUpdate` recusa a prioridade que piora a ficha gravada, e o `checkCreationBatch` avalia o lote com as prioridades antigas.
   - O caminho é um endpoint atômico (escolhas e eventos sob a mesma trava), que revê a Etapa 5 do plano-v4.
   - No P03-C, a prioridade continua gravada na hora, com o rascunho persistido e a confirmação "Prioridades salvas".
2. **P03-C, T-02: "deixar o jogador arquivar a própria ficha em criação".** É ação nova, e pela legenda da matriz isso é decisão de produto. Com a idempotência, a duplicata acidental que motivava o pedido deixa de existir.
3. **P03-C, T-54: "Senhor atualizado" sem o valor.** É regra do projeto (`packages/sheet-core/src/labels.ts` l.10–12; README dos templates §10: textos livres aparecem só como "atualizado"), não bug.
4. **P03-C, T-56:** a guarda das regras da crônica se sobrepõe à R-31 (P09-D). O P03-C implementa a guarda agora, e o P09-D a reaproveita.
5. **P06, T-09: "o template pode marcar o que a criação exige (o Clã)".** É mudança de contrato do template e de comportamento da Nova ficha. O P06 só mostra o título; o Clã continua opcional.
6. **P06, R-01:** a recomendação chama o grupo de "Modo de criação", mas o código usa "Modo padrão" (`CreationSettings.tsx:118`). O P06 mostra o rótulo atual. Trocar o texto é uma linha, que cabe no P01-C (mesmo trecho do L-01) se o PO quiser.
7. **P01-C, D-00: a decisão se aplica, com três observações técnicas.**
   - O build Debug não embute o JS, então o plano acrescenta `expo export` de iOS e Android no job Linux.
   - O `push` na `main` também roda os jobs nativos, o que é necessário para o cache do Gradle.
   - "Todo PR" inclui PR só de docs e de bot. O filtro de caminho ficou como pergunta técnica (P01-C, pergunta 2).

Os planos também trazem as causas da matriz corrigidas pela leitura do código. As principais:

- **T-01:** quem puxa o gesture-handler é o `react-native-drawer-layout`, dependência direta do `expo-router` com peer obrigatório `>= 2.0.0`, e não um peer opcional. Por isso o plano alinha a versão em vez de remover o módulo.
- **T-25:** o campo de digitar está em `NumberEditorRow.tsx`, não no `Stepper.tsx`.
- **T-31:** o 409 da API já devolve só os caminhos em conflito; quem culpa o lote inteiro é o cliente.
- **T-54:** a ordem errada vem do `jsonb` do `template_data`.
- **T-72:** o `Skeleton` já tem o rótulo; no web falta o papel.
- **T-47:** são 9 colunas sem fuso, em 4 tabelas (o "10" deste resumo estava errado; a tabela do plano do P02 já tinha 9).
- **T-86:** o furo é de configuração, não do `clientIp`.

## 7. Perguntas técnicas abertas

A lista completa está na seção 9 de cada plano. Estas cruzam pacotes ou mudam o esforço da onda (⚙ = resposta só no simulador ou no aparelho, na integração):

| # | Pergunta | Plano | Por que importa para a onda |
|---|---|---|---|
| 1 | O módulo nativo de purga do cache HTTP (T-13) entra nesta onda? | P02, perg. 3 | Muda o P02 de G para M. Sem ele, os aparelhos já instalados continuam com o cache antigo até a versão seguinte. Depende do build nativo do P01-C |
| 2 | Qual runner macOS tem o Xcode do SDK 58, e o iOS usa o React Native pré-compilado? O repositório é privado (custo do macOS; `needs: check` ou filtro de caminho)? | P01-C, perg. 1–2 | Tempo e custo de todo PR (D-00) |
| 3 | Existe banco com dados reais, e em que fuso rodava a API que os gravou? | P02, perg. 5 | Define o `TMS_LEGACY_APP_TZ` da conversão do T-47 |
| 4 | Marcador de sessão do web no IndexedDB ou no `localStorage`? Cifrar o rascunho no web com WebCrypto? | P02, perg. 2; P03-C, perg. 7 | Mesma superfície (armazenamento do web depois do logout) nos dois pacotes |
| 5 | O `changedBy` no 409 (papel relativo, `null` em rolagem oculta) passa no `/security-review`? | P03-C, perg. 5 | Se não passar, a tela diz "em outro lugar" e a API do T-31 não muda |
| 6 | O cabeçalho do Android fica mais apertado com 48 dp até o P08 (onda 2), ou as ações da `AppBar` ficam em 44 até lá? | P06, perg. 7 | A onda 1 vai para a `main` antes do P08 |
| 7 | Boundary de erro em todas as telas do `(app)` agora ou depois? | P01-C, perg. 5 | Encosta no `_layout.tsx` do T-72 (P06) |
| 8 | ⚙ O VoiceOver fala português com `CFBundleLocalizations` pt-BR? Abas no iOS como "aba N de M" ou contêiner `tabbar`? | P06, perg. 1–2 | Conferência na integração, com o build do P01-C |
| 9 | ⚙ O Maestro `09` (rascunho) roda na integração ou no roteiro manual antes do release? | P03-C, perg. 9 | Usa o mesmo dev build da integração |
| 10 | Quantos proxies confiáveis ficam na frente da API em produção? | P02, perg. 4 | Com mais de um, precisa de `TRUST_PROXY_HOPS`. Sem ele, o limite fica mais estrito, nunca mais frouxo |

## 8. Riscos da onda

- **O app nativo só volta a compilar com o P01-C.** Até o merge dele na onda, o nativo do P02 (módulo de cache) e do P06 (pt-BR, abas no iOS, 48 dp) só tem testes Jest. A prova no aparelho fica para a integração.
- **CI mais longo.** O run passa de cerca de 4 minutos para 20 a 40 minutos de relógio em todo PR (D-00). Os PRs remotos são um por onda, mas os runs de `push` na `main` também pagam o tempo.
- **Dois pacotes G no caminho crítico.** Se a onda precisar cortar, cada plano aponta o commit que sai sozinho sem quebrar os outros:
  - P02: commit 8, o módulo nativo do T-13;
  - P03-C: commit 8, o conflito por campo do T-31;
  - P06: commit 13, o T-70.
- **`@tms/sheet-core` muda no P03-C.** Até o S-01 do P01-C entrar, o Metro e a API usam o `dist`, que precisa ser reconstruído antes de testar o app.
- **Recursos locais.** O E2E usa portas fixas e roda uma vez por vez, só na integração. Os `*.pg.test` usam um banco `_test` por worktree. O build nativo roda uma vez por onda.

## 9. Integração (01/11/2026)

Os quatro pacotes foram implementados em paralelo, um agente por plano, cada um no seu worktree, e integrados em série na `onda/1-fundacao`. Cada pacote passou pelo `/code-review`; P02 e P03-C, também pelo `/security-review`. O P03-C e o P06 receberam a onda na própria branch antes do merge, e os conflitos foram resolvidos lá.

| Ordem | Pacote | Merge na onda | Revisão |
|---|---|---|---|
| 1 | P01-C | `f2897c6` | `/code-review`: 6 achados corrigidos, 1 falso |
| 2 | P02 | `29d83da` (e `7c3c649`) | `/security-review`: nenhuma vulnerabilidade; `/code-review`: 10 corrigidos |
| 3 | P03-C | `5c1ab1d` | `/security-review`: nenhuma vulnerabilidade, `changedBy` aceito; `/code-review`: 9 corrigidos, 1 falso |
| 4 | P06 | `67f6f51` (e `3f0b496`, T-71) | `/code-review`: 9 corrigidos, 1 falso |

**Perguntas técnicas da seção 7 e da seção 9 dos planos: o que foi aplicado.** Sem resposta do time, cada pacote seguiu a proposta do próprio plano, com estas escolhas:

- **P01-C:**
  - o runner do iOS é o `macos-26` com Xcode 26.6, que o expo-router 58 exige;
  - sem filtro de caminho;
  - boundary só na ficha;
  - Dependabot e digest ficaram fora.
- **P02:**
  - o módulo nativo do T-13 entrou;
  - o marcador `session:state` fica no IndexedDB;
  - `null` no `/transfer`;
  - um hop de proxy;
  - `TMS_LEGACY_APP_TZ` opcional: a migration roda no mesmo container da API (`deploy/render/start.sh`), em UTC;
  - o refresh token inteiro fica no keychain até a revogação.
- **P02, rate limit no logout:** chegou a entrar e saiu na revisão. Um 429 ali deixava, no web, a sessão sem revogação (falha aberta). O logout só revoga com o token e não serve para força bruta, como na base.
- **P02, `TEST_CLIENT_IP`:** passou de "recusado em produção" para "só com `NODE_ENV=test`".
- **P03-C:**
  - a migration é `0022_user_commands`;
  - a chave continua opcional;
  - o rascunho expira em 7 dias e fica sem cifra no web, igual ao outbox;
  - o `changedBy` passou na revisão.
- **P06:**
  - "aba N de M";
  - `CFBundleLocalizations` pt-BR;
  - ativação manual nos rádios;
  - `toggle` nos filtros;
  - T-70 em todos os alvos, inclusive a `AppBar`, como último commit de código do pacote. A reversão sozinha foi conferida.

**Achados da integração (commits na onda):**

- **E2E escritos nos pacotes e rodados pela primeira vez aqui** (`b7c26f6`, `3441c55`): abas de Atributos a 390 px, o aviso de "Sair" com rascunho e seletores exatos depois do T-61. O T-12 passou a medir o que importa: texto com 200 px ou mais e a ação sem espremê-lo. Depois do T-31 sobra só "Revisar", que cabe ao lado.
- **T-71:** o Esc não fechava a folha durante a animação de entrada do Modal do react-native-web, e o foco não voltava ao gatilho. A correção foi feita no P06 e mesclada de novo (`3f0b496`).
- **Teste da migration 0021:** com a 0022 depois dela, o teste passou a descer até a 0020 (no merge do P03-C).

**Resultado na onda com os quatro pacotes:**

| Verificação | Resultado |
|---|---|
| typecheck | 16/16 |
| lint | verde |
| sheet-core | 973 testes |
| config | 36 testes |
| db | 33 testes |
| api | 1646 testes |
| ui | 153 testes |
| frontend | 854 testes |
| `*.pg.test` | 43 testes |
| E2E Chromium e WebKit | 84 testes |
| Build nativo (local, como nos jobs do CI) | Android: `assembleDebug` em 1min47s; iOS: `xcodebuild` Debug para o simulador em 32 min (primeiro build, Pods do zero). Nos dois, compilou o módulo `http-cache` do P02 |

**Fica para depois da integração local:**

- **Os jobs nativos do CI** no primeiro PR: tempo e runner `macos-26`.
- **As conferências ⚙ da seção 7:**
  - VoiceOver em pt-BR e "aba N de M";
  - TalkBack nos −/+;
  - cabeçalho a 48 dp no Android;
  - QAA-02 no simulador.
- **Os fluxos Maestro `08` e `09`:** o Maestro não está instalado nesta máquina, então vão para o roteiro manual antes do release.
- **Os pontos para o PO da seção 6:** continuam sem decisão.
