# QA: web
Conta(s): roteiro_qa_web@roteiro.test (narrador), roteiro_qa_web_jogador@roteiro.test (jogador); N só olhando (Vampiro limite 20) · Plataforma: web, Chromium headless (Playwright, porta 9601), 390×844 e 1280×800 · Início e fim: 12:14 – 13:20 (parado das 12:19 às 12:22 e das 12:27 às 12:47 por ambiente)

## Linha do tempo do ambiente
- 12:14–12:19: **bloqueio 1** (QAW-01). O bundle usava o `dist` de 18/10 dos pacotes, e toda ficha mostrava "Atualize o app". O orquestrador refez o build.
- 12:20–12:26: testei convites e a identidade da Nova ficha. Abrir a ficha deu tela vermelha (**bloqueio 2**, QAW-17: `node_modules` de 18/10, Expo 54 no lugar do 58).
- 12:27–12:47: pausa. O orquestrador rodou `pnpm install --frozen-lockfile`, recompilou e reiniciou a API e o Metro com `--clear`. Daí em diante, todas as tarefas.
- Outros pontos de ambiente informados pelo orquestrador (não vi diretamente): o compose usava `postgres:18`; o Node precisou de `NODE_EXTRA_CA_CERTS` por causa de um proxy TLS da rede; e o Expo roda com `--offline`. O achado de horário (QAW-29) pode ser agravado pelo fuso do contêiner do Postgres.

## Tarefa 1: criação de ficha (foco)
- Resultado: **com dificuldade**. As duas fichas foram criadas e concluídas. A por pontos foi feita sobretudo em 390, e a livre, com muitos itens, sobretudo em 1280.
- Passos, por pontos (jogador, `QA Web Vampiro pontos`): entrar com convite → Nova ficha → identidade (nome, Natureza e Comportamento pela lista, conceito, clã) → Criar ficha → abrir a ficha (abre em **Jogo**) → trocar para **Criação** → prioridades e pontos de atributos e habilidades → Vantagens (3 disciplinas, 4 antecedentes, virtudes) → aviso "Começaram os pontos de bônus" → bônus (Dominação, Coragem, Força) → Concluir criação → confirmar.
  - Cliques/toques: ~120. A maior parte é o "+" de cada ponto: 7+5+3 atributos, 13+9+5 habilidades, virtudes, e cada disciplina ou antecedente é adicionar, tocar a linha, "+" e Aplicar. Rolagens: ~25 em 390. Telas: 4, mais 8 folhas ou diálogos.
- Passos, livre (jogador, `QA Web Vampiro livre`, 1280): Nova ficha → Criar ficha → abre em **Editar** → 7 disciplinas, 7 antecedentes, 6 qualidades e 4 defeitos → Concluir → Salvar. O narrador conclui a criação pela Mesa ou pelas "Ações do narrador". · Cliques: ~75 · Rolagens: ~10 · Telas: 3
- Hesitei, voltei ou errei em:
  - "Nova crônica" não pergunta o modo. Ele fica no painel "Criação de fichas" da crônica criada, e lá os grupos de rádio não têm título visível (QAW-09).
  - A ficha recém-criada, aberta pela lista, abre em **Jogo**, com tudo em 1 e sem orçamento. Só ao achar o seletor "Criação" apareceram as prioridades (QAW-37).
  - Esgotei Mentais (7/7) e o "+" de Raciocínio continuou com cara de ativo e não fez nada. O aviso saiu abaixo da dobra (QAW-23).
  - Com 3/3 em Disciplinas, tocar em "Dominação" no diálogo não fez nada e o diálogo ficou aberto (QAW-24).
  - Qualidades: digitei o nome, toquei "Adicionar" e veio "não se compra na criação", atrás do diálogo (QAW-24 e QAW-25).
  - Com a conta fechada, "Salvar alterações" virou "Concluir criação" e eu não tinha como guardar o progresso sem concluir (QAW-22).
  - No topo, "● Salvo" com "7 alterações" pendentes (QAW-21).
  - Em 390, "Histórico" fica fora da tela e a página rola de lado (QAW-18).
- Desnecessário, repetido ou longo demais: cada disciplina ou antecedente leva 4 a 5 toques (adicionar, escolher, tocar a linha, "+", Aplicar). Um "+" direto na linha da lista, como já existe nos atributos, cortaria metade. O pedido de XP é uma lista plana de 61 opções, com o botão de enviar no fim, a ~3.000 px (QAW-32).
- Pensando em voz alta:
  > "Desligada o quê? Ligada o quê?" (painel Criação de fichas)
  > "Cliquei duas vezes em Criar ficha e agora tenho duas Isadoras."
  > "Recarreguei e o botão de voltar morreu."
  > "Abri minha ficha nova e está tudo em 1... cadê os pontos? Ah, é o seletor Jogo/Criação."
  > "O + está aceso, mas não sobe. Por quê?" (o aviso estava fora da tela)
  > "Quero só salvar e continuar amanhã, mas o único botão é Concluir criação."
  > "A ficha mudou em outro lugar: Senhor, Coragem, Força...? Só o narrador mexeu no Senhor." (o banner estava ilegível em 390)
- Diferenças 390 × 1280:
  - Em 390, a app bar da ficha transborda (QAW-18), o banner de conflito fica ilegível (QAW-19), os avisos de orçamento caem fora da tela (QAW-23) e "Comportamento" quebra no meio da palavra (QAW-38).
  - Em 1280 a ficha fica em 3 colunas, sem nenhum desses problemas.
  - Os cartões da Mesa têm 255 px de altura nas duas larguras (QAW-31).
- SEQ: 3 (pontos) e 5 (livre). A distribuição em si é clara, com as prioridades 7/5/3 como fichas e o "3/3" visível. O que derruba a nota é o feedback que some, o salvar que vira concluir, o modo Jogo na abertura e o duplo clique.
- Evidências: `img/qa-web/20-…` a `27-…` (identidade e duplicado), `32-…` a `39-…` (modo, distribuição, avisos), `40-…` a `43-…` (offline), `44-…` a `54-…` (vantagens, bônus, orçamento), `56-…` a `59-…` (LeaveGuard e conflito), `60-…` a `62-…` (1280 e teclado), `63-…` e `64-…` (concluir), `65-…` a `73-…` (ficha livre com muitos itens)

### Checklist da criação
| Item | Resultado |
|---|---|
| Botões visíveis e alcançáveis | Em 390, "Histórico" fica fora da tela, com 91 px de rolagem horizontal (QAW-18). Em 1280, tudo visível. "Enviar pedido" (XP) fica a ~3.000 px dentro da folha (QAW-32). |
| Rolagem travada | Não aconteceu. As folhas inferiores rolam por dentro. |
| Carregando | Skeleton cinza, sem app bar nem rótulo acessível durante a restauração da sessão (QAW-42, `114-…`). |
| Vazio | "Você ainda não tem ficha nesta crônica.", "Nenhuma Disciplina", "Nenhum Qualidade" (QAW-26). |
| Erro | O conflito (409) mostra o banner com "Reaplicar" e "Manter como está" (QAW-19, QAW-20). |
| Sem rede | Bom. A faixa "Sem conexão…", "Offline · 1 pendente" e o envio automático ao voltar (`40-…` a `43-…`). Logout offline perde o pendente (QAW-33). |
| Conflito em duas sessões | O narrador salva Senhor=Etrius. O jogador conclui com Senhor=Meerlinda e mais 6 alterações. Resultado: 409, o lote inteiro recusado, o banner culpa os 7 campos (QAW-20) e fica ilegível em 390 (QAW-19). "Reaplicar" grava tudo e sobrescreve o Senhor do narrador sem mostrar o valor dele. |
| Sucesso | Toasts "Salvo: …" com Desfazer, "Regras da criação salvas.", a revisão "Concluir criação?", que lista o que muda e diz que depois disso subir um traço passa pelo narrador (bom). |
| Campo inválido | Nome vazio → "Informe o nome" com `aria-invalid` e `role=alert`, sem requisição. O foco não vai para o campo (QAW-14). Valor digitado 9, 0, -1, "abc" ou vazio → "Digite um número de 1 a 5". "3.5" vira 3 sem aviso (QAW-43). |
| Valores no limite | O mínimo trava o "−". No máximo de 5, o "+" fica desabilitado. O teto da criação (habilidade 3) segura. Texto: nome 80, notas 2000, Natureza 40, todos com contador. |
| Orçamento estourado | O grupo esgotado bloqueia com aviso (QAW-23). O bônus não passa do saldo: "Bônus: 1 acima do saldo." é ambíguo (QAW-27). |
| Duplo clique em salvar | "Criar ficha" duplica a ficha do jogador (QAW-08). "Criar ficha" de NPC, "Confirmar operação", "Enviar pedido" e Salvar: uma requisição só (bom). |
| Voltar no meio | Na Nova ficha, sai sem perguntar (QAW-11). Na ficha com rascunho, o LeaveGuard pergunta "Sair sem salvar? 7 alterações…" (bom). |
| Recarregar | A Nova ficha perde tudo e, depois do F5, o botão voltar fica morto (QAW-07). Na ficha, o rascunho é guardado pelo LeaveGuard. |
| Sair e voltar | O rascunho de identidade se perde. O rascunho da ficha precisa ser salvo ou descartado. |
| Console e rede | Depois do ambiente corrigido: nenhum `pageerror` nem warning do React. Há ruído de `GET /chronicles/:id/transfer` → 404 em toda visita (QAW-41) e de `POST /auth/refresh` → 401 sem sessão (QAW-06). "GO_BACK was not handled" é aviso só dev (QAW-07). |

## Tarefa 2: segurança e informação oculta
- Resultado: sem ajuda. **Nenhum vazamento de informação oculta encontrado.**
- Montagem (narrador `qa_web`, crônica por pontos):
  - NPC oculto "Zorvath Segredo QA" (Tzimisce, conceito "Traidor Xyzzy", senhor "Mestre Plugh"), com nota do narrador "Frobozz".
  - Nota do narrador na ficha do jogador ("Grue").
  - Sessão com notas privadas ("Bedquilt").
  - Rolagem oculta do NPC pelos Dados (Raciocínio, falha crítica).
  - Na crônica livre, uma parada livre oculta "Emboscada Quux". O padrão da parada livre já é "Oculta", e isso é bom.
- Na sessão do jogador:
  - Tela: nenhum dos termos na Crônica, no Diário, na Ficha nem em Sobre.
  - Respostas que o app recebeu (escutadas com `page.on('response')`): nenhum termo.
  - API lida na própria sessão, via o refresh dela e sem forjar header:
    - `/characters/<npc>` e as subrotas `history`, `rolls` e `events`: **404**, igual a um id inexistente.
    - `/chronicles/:id/rolls`, `/table`, `/history` e `/operations`: 404.
    - `/xp-requests` e `/invites`: 403.
    - `/sessions`: só título e resumo público.
    - `/characters/<minha ficha>` e `/history`: sem as notas do narrador.
- IDOR de escrita, na sessão do jogador:
  - `POST /characters/<npc>/events` com corpo válido: **404**, igual a um id inexistente.
  - `PATCH /visibility` e `DELETE` do NPC: 404.
  - `creation/approve` da própria ficha: 403.
  - `POST /invites`: 403.
  - Com corpo inválido, a validação (400) responde igual para id existente e inexistente, então não serve de oráculo.
- IDOR de leitura, com o jogador fora da crônica: crônica e ficha alheias dão 404, e a tela diz "não encontrada" ou "sem acesso".
- Sessão e tokens:
  - O refresh vai em cookie httpOnly, `SameSite=Strict`, `path=/auth`, com checagem de `Origin`. O access token fica só na memória.
  - Nada em `localStorage`. Nada de token, e-mail ou senha no console, nas URLs ou no `api.log`. O log usa SQL parametrizado, sem parâmetros, e o convite é guardado como `code_hash`.
- O IndexedDB (`tms-offline`) guarda em texto claro o último usuário, a fila de envio e o cache de consultas. No web isso é por projeto (`storage.web.ts`: "a mitigação é apagar tudo no logout"), e o logout online apaga mesmo. O furo está no logout offline (QAW-33).
- Mensagens de erro: login com senha errada → 401 "e-mail ou senha incorretos". Cadastro com e-mail existente → 409 "não foi possível criar a conta com esses dados". As duas são genéricas e não dizem se a conta existe (bom).
- SEQ: não se aplica.

## Tarefa 3: acessibilidade
- Alvos de toque em 390, medidos com `getBoundingClientRect` em todo botão, rádio, aba, checkbox e campo visível: **nenhum abaixo de 44 px**. Telas medidas: ficha em Criação (Ficha), crônica, Mesa, Bastidores, NPC e Conta. Bom.
- Contraste medido:
  - Link dourado `#8A6414` sobre `#F1EDEE`: 4,62:1, em 13 e 16 px.
  - Texto secundário `#5E5156`: 6,49:1.
  - Barra de criação: 18:1.
  - Tudo ≥ 4,5:1. Botões desabilitados (bege) ficam fora da regra.
- Leitor de tela (árvore `aria`):
  - Rótulos bons nos controles: "Aumentar Força", "Físicos, Primária, 7 pontos", "Taumaturgia, 2 de 5", cartões da Mesa com o estado completo.
  - Problemas: grupos `Choice` sem rótulo visível (QAW-09); "Rolagem oculta" e "Oculta" usam `aria-selected` num `button`, sem estado anunciado (QAW-35); dois "Fechar" por diálogo (QAW-16); o skeleton sem rótulo (QAW-42); os valores dos steppers são `aria-live`, então cada "+" é anunciado (ruído, baixa).
- Teclado (1280, fluxo de criação):
  - Tab segue a ordem visual (voltar → Experiência → Histórico → modo → Concluir → identidade → recursos → abas → itens), com anel de foco visível (`62-…`).
  - Enter ativa botões e abas. O diálogo de adicionar põe o foco na busca, prende o Tab e fecha com Esc.
  - Problemas: **Espaço não ativa `tab` nem `radio`** (são `div`); as setas não navegam entre abas e rádios; depois do Esc, o foco vai para o `body` e não volta ao botão que abriu o diálogo (QAW-28).
  - O login envia com Enter (bom).
- SEQ: não se aplica.

## Tarefa 4: carga
- Mesa com 21 fichas (N, `Vampiro limite 20`, só olhando):
  - A crônica abre em ~1,3 s. A aba Mesa mostra os 21 cartões em ~0,4 s (local).
  - 12 giros de roda de 600 px levaram 0,7 s, sem engasgo visível.
  - Layout: cada cartão tem **255 px** de altura, com os chips Vitalidade, Sangue e FdV empilhados no centro, numa coluna só, mesmo em 1280 (QAW-31). Os 21 cartões ocupam ~5.400 px: em 390, ~3 cartões por tela.
  - Em 390, o painel "Criação de fichas" fica acima das abas e o primeiro cartão começa em y=827 (já conhecido: `doc/validacao-v5.md` l. 120–122).
- Ficha com muitos itens (Caio: 7 disciplinas, 7 antecedentes, 10 qualidades e defeitos, uma nota de 2.000 caracteres): abre em ~0,3 s e a troca para Vantagens é instantânea. A lista longa fica legível, mas o custo das qualidades não aparece na lista, só no editor. O nome de 80 caracteres quebra em duas linhas, sem cortar.
- A aba "Pedidos de XP" lista 61 opções sem agrupar nem buscar (QAW-32).
- SEQ: 5

## Tarefa 5: resto do TMS
- Mesa do narrador (crônica livre, 390):
  - Selecionar → "1 de 20 selecionados", com uma ficha só (QAW-40).
  - Aplicar dano: 2 letais, prévia, confirmar com duplo clique → **uma** operação. Desfazer pelo toast → voltou.
  - Nova noite: prévia "Sangue: 10 → 9", confirmar.
  - Concluir criação pelas "Ações do narrador": imediato, sem confirmação (QAW-36).
  - Travar: o jogador vê "O narrador travou a ficha. Você ainda rola sem gastar recursos." (bom).
- Evolução por XP:
  - O narrador concede 10 XP pela Mesa, com motivo.
  - O jogador abre Experiência → Solicitar evolução → Briga 0 → 1 (3 XP) → Enviar pedido. O resumo e o botão ficam no fim de 61 itens (QAW-32).
  - O narrador vê "Pedidos de XP (1)" → Aprovar.
  - O jogador vê "Disponível: 7 XP · Gasto 3", com o extrato, e Briga 1. Funciona.
- Bastidores:
  - Diário: a sessão registrada aparece com a data **"Sat Oct 31 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)"**, quando o registro era de 01/11 (QAW-30). O jogador vê o mesmo no Diário.
  - Também testados: Apresentação, Transferir (só olhei), Auditoria (lista de eventos, com o horário certo).
- Dados: rolagem oculta do NPC; parada livre oculta na Mesa ("3 sucessos · 5d10 · Oculta · Parada livre").
- Conta: só "Excluir conta", que pede a senha. Não há troca de senha nem "sair dos outros aparelhos" (observação, fora do escopo).
- Offline: ver a Tarefa 1 e o QAW-33.
- Horários: a ficha criada aparece na Mesa como "alterada às 15:25" às 13:04, ou seja, 3 h no futuro (QAW-29).
- SEQ: 5

## Tarefa 6: cadastro e login
- Cadastro, só validação no cliente: envio vazio e envio com dados inválidos (e-mail, usuário com maiúscula e espaço, senha curta) mostram três `alert`s, com `aria-invalid` e **nenhuma requisição** (confirmado na rede). A senha é `type=password`, com dica de 15 caracteres.
- Um envio real ao servidor, com e-mail já existente: 409 "não foi possível criar a conta com esses dados". A mensagem é genérica (bom contra enumeração), mas não diz o que corrigir e vem em minúscula (QAW-12).
- Login com senha errada, uma vez com a minha conta: 401 "e-mail ou senha incorretos". A senha fica no campo e a URL não leva credenciais.
- Logout online: `POST /auth/logout` 204, o IndexedDB fica vazio e o voltar do navegador cai no login, sem dado em cache. O cookie `tms_refresh` continua no navegador (revogado; o refresh dá 401), porque o servidor não o apaga (baixa, dentro do QAW-33).
- Logout offline: **perde as alterações pendentes sem avisar e não revoga a sessão.** De volta online, recarregar faz o login de novo, sozinho (QAW-33).
- SEQ: 6 (o fluxo online é simples e claro)

## Achados
| ID | Tipo | Severidade sugerida | Tela | Config. | Sistema | Descrição | Passos para reproduzir | Esperado × obtido | Evidência | Visto/suposto | Atrapalha a criação? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| QAW-01 | **ambiente/setup** | alta (para o roteiro) | Nova ficha, Ficha, Mesa | todas | todos | O Metro resolve `@tms/*` pelo `main` (`./dist`), que o git ignora. O `dist` era de 18/10, 35 commits atrás do `src` do `sheet-core`, e o setup do roteiro não tinha build: toda ficha mostrava "Atualize o app". Resolvido às 12:22. | Atualizar o código sem `pnpm build` → `expo start` | Esperado: o código atual. Obtido: o template "não suportado". | `05-…`, `07-…`, `08-…` | visto (causa verificada no bundle e com script) | sim, impedia. Recomendação: build no setup, ou o `main` (ou `exports` com condição `source`) apontando para o `src` em dev. |
| QAW-17 | **ambiente/setup** | alta (para o roteiro) | Ficha editável | todas | todos | O `node_modules` era de 18/10 (Expo 54.0.37, expo-router 6.0.24), e o lockfile pede Expo 58.0.19 e expo-router 58.0.26 (commit `b9df17e`). `LeaveGuard` importa `usePreventRemove` e dá tela vermelha em `sheet/evolve/LeaveGuard.tsx:20`. O setup não tinha `pnpm install`. Resolvido às 12:47. | Criar ou abrir uma ficha própria | Esperado: a ficha. Obtido: tela vermelha. | `27-…`, `28-…` | visto | sim, impedia. Recomendação: `pnpm install --frozen-lockfile` e build no setup, com uma checagem de versão contra o lockfile. Ver também o `postgres:18` do compose (informado pelo orquestrador). |
| QAW-08 | bug funcional | **alta** | Nova ficha | 390 | todos | Duplo clique em "Criar ficha" = **duas** chamadas `201 POST /chronicles/:id/characters` e duas fichas idênticas. Também gasta o limite de 20 fichas. Para o jogador, `create.mutate(values)` vai sem `clientCommandId`. O NPC manda e foi idempotente no mesmo teste (201 e depois 200). `app/(app)/chronicles/[id]/new-character.tsx` l. 78–90. | Preencher o nome → duplo clique | Esperado: uma ficha. Obtido: duas "Isadora Vex QA Pontos". | `27-…`, rede | visto | sim. **Genérica**: `clientCommandId` sempre e uma trava síncrona por `ref`. |
| QAW-18 | layout | **alta** | Ficha (app bar) | 390 | todos | A app bar ("‹ crônica · Salvo · Experiência · Histórico") passa da largura. "Histórico" fica em x=372–481, fora da tela, e a página inteira rola 91 px de lado, com uma faixa vazia à direita. | Abrir qualquer ficha em 390 | Esperado: tudo cabe, ou as ações vão para um menu. Obtido: ação escondida e rolagem horizontal. | `32-…`, `33-…`, `73-…` | visto (medido: `scrollWidth` 481 e 464) | sim, o Histórico some. **Genérica**. |
| QAW-19 | layout | **alta** | Ficha › banner de conflito | 390 | todos | O `Banner` é uma linha (`flexDirection: row`): os botões "Reaplicar" e "Manter como está" ocupam a largura, e o texto sobra numa coluna de ~25 px, quebrado letra a letra ("A / fic / ha / mu / do…"). `packages/ui/src/Banner.tsx` (estilo `banner`) com `sheet/ConflictBanner.tsx`. | Duas sessões editam o mesmo campo → salvar a segunda | Esperado: o texto legível e as ações embaixo. Obtido: ilegível. | `58-…` | visto | sim: a decisão de conflito fica às cegas. **Genérica**. |
| QAW-33 | segurança / bug funcional | **alta** | Crônicas › Sair | 390 | todos | Com a rede fora, "Sair" leva ao login e apaga o IndexedDB, mas: (1) **descarta sem aviso a alteração pendente** (o Sangue gasto offline voltou de 10 para 11), e (2) o `POST /auth/logout` não chega ao servidor. O cookie de refresh continua válido: de volta online, recarregar **faz o login de novo, sozinho** (ASVS V3.3.1). Detalhe menor: no logout online, o servidor revoga mas não apaga o cookie. | Ficha → ficar offline → gastar 1 Sangue → ‹ → Sair → voltar a rede → F5 | Esperado: avisar das pendências e só concluir o logout com a revogação confirmada (ou guardá-la para quando a rede voltar). Obtido: dado perdido e sessão viva. | `110-…`, `111-…`, `112-…`, rede | visto | não diretamente. **Genérica**. |
| QAW-07 | bug funcional | média | Nova ficha (o mesmo padrão existe em `join.tsx` e `chronicles/new.tsx`) | 390 e 1280 | todos | Depois de F5 ou de link direto, o botão "‹ crônica" não faz nada (console: "GO_BACK was not handled"). `router.back()` é chamado sem `canGoBack()` em `new-character.tsx` l. 37–40. O mesmo código está em `join.tsx` l. 38 e `chronicles/new.tsx` l. 52 (suposto). | Nova ficha → F5 → ‹ | Esperado: voltar à crônica. Obtido: nada. | `26-…`, console | visto | sim. **Genérica**: `canGoBack() ? back() : replace(...)`. |
| QAW-20 | bug funcional / clareza | média | Ficha (conflito) | todas | todos | O conflito num campo só (Senhor) recusa o **lote inteiro** de 7 alterações, e o banner diz que "Senhor, Coragem, Força, Consciência, Antecedentes, Disciplinas, Autocontrole mudou antes…". Só o Senhor tinha mudado. "Reaplicar" grava tudo e sobrescreve o valor do narrador sem mostrá-lo. A ficha volta ao estado do servidor (13ª geração, Bônus 15/15) até reaplicar. | Narrador salva Senhor=Etrius → jogador, com rascunho, muda Senhor e conclui | Esperado: só o Senhor em conflito, mostrando "dele × seu". Obtido: os 7 culpados, e o valor do outro não aparece. | `58-…`, `59-…` | visto | sim. **Genérica**. |
| QAW-21 | clareza | média | Ficha (cabeçalho) | 390 e 1280 | todos | "● Salvo" aparece no topo ao mesmo tempo que "Criação · 23 alterações". O indicador fala da sincronização, mas lê-se como "a ficha está salva". O rascunho, na verdade, só vive no aparelho. | Mexer em pontos sem salvar | Esperado: "23 alterações não salvas" no lugar de "Salvo". Obtido: "Salvo". | `35-…`, `36-…` | visto | sim: o jogador acha que salvou. **Genérica**. |
| QAW-22 | orientação | média | Ficha › barra de criação | todas | todos (por pontos) | Quando a conta fecha (sem problema bloqueante), "Salvar alterações" vira "Concluir criação", que é o único botão. Não dá para guardar o progresso sem concluir. Por projeto: "Um botão só: com a conta fechada, conclui (salvando antes)" (`sheet/evolve/ModeBar.tsx` l. 176–200). "A conta fechou" aparece mesmo com 1 ponto de bônus sobrando. | Distribuir tudo → olhar a barra | Esperado: "Salvar" e "Concluir" separados. Obtido: só "Concluir criação". | `51-…`, `54-…` | visto | sim. **Genérica**. |
| QAW-23 | feedback | média | Ficha › Criação (grupo esgotado) | 390 | todos (por pontos) | Num grupo esgotado (Mentais 7/7), o "+" continua com cara de ativo (sem `disabled` nem opacidade) e não faz nada. O aviso "Mentais: os 7 pontos básicos já foram usados…" aparece abaixo da linha tocada e, em 390, fica fora da tela (y=855 numa altura de 844). O aviso anterior também não some quando surge outro. | Mentais 7/7 → "+" em Raciocínio | Esperado: o "+" visivelmente bloqueado, ou um aviso perto do toque (toast). Obtido: o toque parece morto. | `36-…`, `37-…`, `38-…` | visto | sim. **Genérica**. |
| QAW-24 | feedback | média | Diálogos "Adicionar Disciplina" e "Adicionar Qualidade" | 390 | todos | Escolher um item que o orçamento ou a regra recusa (Dominação com 3/3; uma qualidade na criação) não faz nada **dentro** do diálogo, que continua aberto. O aviso vai para a ficha, atrás do modal. | Disciplinas 3/3 → Adicionar → Dominação | Esperado: o aviso dentro do diálogo, ou a opção marcada como indisponível. Obtido: nada visível. | `49-…`, `52-…` | visto | sim. **Genérica**. |
| QAW-25 | clareza (regra a conferir) | média | Vantagens › Qualidades | 390 | Vampiro (por pontos) | Na criação por pontos, "Adicionar Qualidade" deixa digitar o nome e responde "Qualidades: não se compra na criação." A V20 compra Qualidades e Defeitos com pontos de bônus, então é preciso conferir o template (`CREATION_NOT_PURCHASABLE`). Se for intencional, avisar antes de pedir o nome. | Ficha por pontos → Vantagens → Adicionar Qualidade → nome → Adicionar | Esperado: a regra explícita antes, ou a compra com bônus. Obtido: a recusa depois de digitar. | `51-…`, `52-…` | visto (a regra é suposição) | sim. **De template** (a regra) e **genérica** (avisar antes). |
| QAW-29 | bug funcional | média | Mesa (cartões, "Última alteração") | todas | todos | A ficha recém-criada, nunca editada, aparece "alterada às 15:25" às 13:04: o `updatedAt` volta como `18:25Z`, 3 h no futuro. As fichas editadas pela API saem certas (`16:00Z` = 13:00). Causa provável: `characters.updated_at` é `timestamp` **sem** fuso (`0005_characters.ts` l. 19), com o default `now()` do banco (hora de parede em UTC) e a leitura no fuso local da API. Afeta "Ordenar pela última alteração" e as 21 figurantes ("às 15:06" para um seed das 12:06). | Criar uma ficha → Mesa do narrador | Esperado: a hora local da criação. Obtido: +3 h. | aria da Mesa e resposta `/table` | visto (a causa é suposição; depende do fuso do Postgres e da API) | não. **Genérica**: `timestamptz`. |
| QAW-30 | bug funcional | média | Bastidores › Diário (narrador) e Diário (jogador) | 390 | todos | A data da sessão aparece como `String(Date)`: "Sat Oct 31 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)", em inglês e **um dia antes** (registrei em 2026-11-01). `components/chronicles/CampaignBackstage.tsx` l. 147 (`meta={String(session.date)}`). Em l. 195, "Editar" reenvia `String(session.date)` e pode corromper a data (suposto). | Bastidores → registrar a sessão de hoje | Esperado: "01/11/2026". Obtido: o texto cru do dia 31/10. | `78-…`, `83-…` | visto | não. **Genérica**. |
| QAW-31 | layout / desempenho percebido | média | Mesa | 390 e 1280 | todos | Cada cartão da Mesa tem 255 px de altura, com os chips do dock (Vitalidade, Sangue, FdV) empilhados no centro, numa coluna só, mesmo em 1280. Os 21 cartões ocupam ~5.400 px, ~3 por tela. O painel de criação acima das abas empurra a Mesa para baixo da dobra em 390 (essa parte já é conhecida: `validacao-v5.md` l. 120–122). | N → Vampiro limite 20 → Mesa | Esperado: chips em linha e grade em telas largas. Obtido: uma coluna alta. | `84-…`, `85-…`, `87-…` | visto | não. **Genérica**. |
| QAW-32 | feedback / layout | média | Experiência › Solicitar evolução | 390 | todos | A lista tem 61 opções planas, sem grupos nem busca, e as caras (16 XP com 10 disponíveis) não aparecem desabilitadas. Ao tocar numa, ela não fica marcada, e o resumo "Briga: 0 → 1. Custo 3 XP" com "Enviar pedido" aparece no fim, a ~3.090 px. | Jogador → Experiência → Solicitar evolução → Briga | Esperado: o resumo fixo no rodapé e a opção marcada. Obtido: nada visível acontece. | `98-…`, `99-…` | visto | não (é evolução), mas é o mesmo padrão. **Genérica**. |
| QAW-37 | orientação | média | Ficha (abertura) | 390 | todos (por pontos) | A ficha **em criação**, aberta pela lista da crônica, abre no modo **Jogo**: atributos em 1, sem prioridades nem orçamento. A criação só aparece no seletor "Criação". O redirecionamento logo depois de criar usa `?mode=create`, mas quem volta depois cai em Jogo. | Crônica → tocar a própria ficha em criação | Esperado: abrir em Criação enquanto a ficha está em criação. Obtido: Jogo. | `32-…` | visto | sim. **Genérica**. |
| QAW-09 | clareza / acessibilidade | média | Crônica › Criação de fichas; Nova ficha (Clã) | 390 e 1280 | todos | O `Choice` só usa o `label` como `accessibilityLabel`, sem rótulo visível: aparecem "Desligada / Ligada", "Por pontos / Livre" e os 14 clãs sem título. `packages/ui/src/Choice.tsx` l. 30–45. WCAG 3.3.2. | Narrador → painel; jogador → Nova ficha | Esperado: título visível por grupo. Obtido: as opções soltas. | `11-…`, `18-…`, `21-…`, `84-…` | visto | sim. **Genérica**. |
| QAW-02 | clareza | média | Crônica › Criação de fichas | 390 | todos | Com o template não suportado, o painel diz "Este sistema usa criação livre; não há orçamento por pontos", o que é falso. `components/chronicles/CreationSettings.tsx` l. 110–115. | Template não suportado (bloqueio 1) | Esperado: uma mensagem própria. Obtido: "criação livre". | `04-…` | visto | sim. **Genérica**. |
| QAW-28 | acessibilidade | média | Ficha (abas, modo), diálogos | 1280 | todos | Abas (`div role=tab`) e rádios (`div role=radio`) não respondem a **Espaço**, só a Enter. As setas não navegam no grupo. Depois de fechar um diálogo com Esc, o foco vai para o `body` e não volta ao gatilho. | Tab até "Ficha" → Espaço; abrir "Adicionar Antecedente" → Esc | Esperado: Espaço e Enter ativam, setas no grupo, o foco volta ao gatilho. Obtido: nada, nada e `body`. | teclado (log) | visto | sim, para quem usa teclado. **Genérica** (`Tabs`, `Choice`, `BottomSheet`). |
| QAW-03 | feedback | baixa | Nova ficha e Ficha (template não suportado) | 390 | todos | "Atualize o app" sem ação no web. | Bloqueio 1 | Esperado: botão Recarregar. Obtido: só o texto. | `05-…` | visto | sim, nesse estado. **Genérica**. |
| QAW-04 | acessibilidade | baixa | Mesa (cartão) | 390 | todos | O rótulo junta partes com `'. '`, e o texto de problema já termina em ponto: "…ver esta ficha.. roteiro…". No build novo não aparece no estado normal. O código continua em `TableRow.tsx` l. 44–66. | Ficha com template não suportado ou dados inválidos na Mesa | Esperado: um ponto. Obtido: "..". | `07-…`, `30-…` | visto, confirmado no código | não. **Genérica**. |
| QAW-05 | clareza | baixa | Ficha sem acesso | 390 | todos | "Você não tem acesso a esta ficha" com "Salvo" no cabeçalho. Repete no build novo. | Jogador → URL de ficha alheia | Esperado: sem indicador. Obtido: "Salvo". | `10-…`, `29-…` | visto | não. **Genérica**. |
| QAW-06 | feedback | baixa | Carga sem sessão | todas | — | `POST /auth/refresh` → 401 a cada carga sem sessão, e o console mostra o erro de recurso. | Abrir `/` deslogado | Esperado: sem erro no console. Obtido: um erro de recurso. | console | visto | não |
| QAW-10 | feedback | baixa | Crônica › Criação de fichas | 390 | todos | Mudar o modo e sair sem salvar perde a mudança sem aviso. | Livre → ‹ Crônicas → voltar | Esperado: aviso ou salvamento automático. Obtido: volta "Por pontos". | aria | visto | sim. **Genérica**. |
| QAW-11 | feedback | baixa | Nova ficha | 390 | todos | Voltar ou F5 na identidade perde os campos sem perguntar. | Preencher → ‹ | Esperado: confirmar ou guardar. Obtido: campos vazios. | `25-…` | visto | pouco. **Genérica**. |
| QAW-12 | clareza | baixa | Entrar com convite, Cadastro, Login | 390 | — | Erros mostram o texto cru da API, em minúscula e sem o próximo passo: "convite inválido ou expirado", "não foi possível criar a conta com esses dados" (não diz o que mudar) e "e-mail ou senha incorretos". | Código errado; cadastro com e-mail existente; senha errada | Esperado: frase com maiúscula e ação ("confira o código ou peça outro ao narrador"). Obtido: o texto cru. | `15-…`, `106-…`, `107-…` | visto | não. **Genérica**. |
| QAW-13 | clareza | baixa | Nova ficha › Escolher da lista | 390 | Vampiro | Os arquétipos vêm na ordem do inglês ("…Bon Vivant, Valentão, Capitalista…"). Relacionado ao conhecido `auditoria-fichas-wod.md` l. 151 (habilidades). | Natureza → Escolher da lista | Esperado: ordem do pt-BR ou busca. Obtido: a ordem do inglês. | `23-…` | visto | pouco. **De template** (ou genérica: ordenar pelo rótulo). |
| QAW-14 | acessibilidade | baixa | Nova ficha | 390 | todos | Ao enviar inválido, o foco fica no botão e o erro fica no topo, meio fora da tela. | Criar ficha sem nome | Esperado: foco no 1º campo inválido. Obtido: no botão. | `22-…` | visto | pouco. **Genérica**. |
| QAW-15 | layout | baixa | Crônica | 390 e 1280 | todos | "Participantes" fica 16 px à esquerda dos outros títulos (x=0 contra 16 em 390), fora do contêiner com padding. `app/(app)/chronicles/[id]/index.tsx` l. 240. | Abrir uma crônica | Esperado: alinhado. Obtido: encostado na borda. | `27-…`, `31-…` | visto (medido) | não. **Genérica**. |
| QAW-16 | acessibilidade | baixa | Todos os diálogos (`BottomSheet`) | todas | — | Dois "Fechar" na árvore e no Tab (o fundo e o ×). | Abrir qualquer diálogo → Tab | Esperado: um. Obtido: dois. | aria, teclado | visto | não. **Genérica**. |
| QAW-26 | clareza | baixa | Vantagens (vazio) | todas | Vampiro | "Nenhum Qualidade": o gênero não concorda com o nome (já "Nenhuma Disciplina" sai certo). | Vantagens sem qualidades | Esperado: "Nenhuma Qualidade". Obtido: "Nenhum". | aria `44-…` | visto | não. **De template** (o gênero no rótulo) ou genérica (texto neutro, "Sem qualidades"). |
| QAW-27 | clareza | baixa | Ficha › Criação (bônus) | 390 | todos (por pontos) | Ao tentar algo que custa mais do que o saldo, aparece "Bônus: 1 acima do saldo." com o valor ainda em 0. Lê-se como se o saldo já estivesse estourado. | Saldo 1 → "+" em Briga (custo 2) | Esperado: "Faltaria 1 ponto: custa 2, restam 1". Obtido: o texto ambíguo. | `53-…` | visto | um pouco. **Genérica**. |
| QAW-35 | acessibilidade | baixa | Dados ("Rolagem oculta"), Mesa ("Oculta") | 390 | todos | Os interruptores são `button` com `aria-selected`, sem `aria-pressed`: o leitor de tela não anuncia se a rolagem está oculta. Isso importa porque é o controle de sigilo. Na "Visibilidade do NPC", um `radiogroup` contém `button`s. | NPC → Dados → Rolagem oculta | Esperado: `aria-pressed` ou `switch`. Obtido: o estado mudo. | aria | visto | não. **Genérica**. |
| QAW-36 | feedback | baixa | Ficha › Ações do narrador | 390 | todos | "Concluir criação" do narrador executa na hora, sem confirmação. A do jogador tem revisão. | Narrador → Ações → Concluir criação | Esperado: revisão igual à do jogador. Obtido: imediato. | rede | visto | não. **Genérica**. |
| QAW-38 | bug visual | baixa | Ficha › Criação (identidade) | 390 | Vampiro | O rótulo "Comportamento" quebra no meio da palavra ("Comportamen / to") na grade de 3 colunas. | Ficha em Criação em 390 | Esperado: a palavra inteira. Obtido: "Comportamen-to". | `34-…` | visto | não. **Genérica** (2 colunas em telas estreitas). |
| QAW-39 | clareza | baixa | Diálogo "Salvar N alterações?" | 390 | todos | A lista de mudanças vem fora da ordem da ficha (Raciocínio, Condução, Ocultismo, Empatia…), e "Senhor atualizado" não mostra o valor. | Salvar um rascunho grande | Esperado: agrupado por seção, com os valores. Obtido: ordem aleatória. | `41-…`, `57-…` | visto | um pouco. **Genérica**. |
| QAW-40 | clareza | baixa | Mesa › seleção | 390 | todos | "1 de 20 selecionados" com uma ficha só na Mesa: o 20 é o limite da operação, mas lê-se como o total. | Mesa → Selecionar → 1 ficha | Esperado: "1 selecionado (máx. 20)". Obtido: "1 de 20". | `89-…` | visto | não. **Genérica**. |
| QAW-41 | feedback | baixa | Crônica (jogador e narrador) | todas | — | Toda visita faz `GET /chronicles/:id/transfer` → 404, e o console mostra o erro. O 404 está sendo usado como "nenhuma transferência". | Abrir uma crônica | Esperado: 200 com `null`. Obtido: 404 no console. | rede | visto | não |
| QAW-42 | acessibilidade | baixa | Ficha (carregando) | 390 | todos | Durante a restauração da sessão, só um skeleton cinza, sem app bar e com a árvore de acessibilidade vazia: o leitor de tela não diz "Carregando". | Rede lenta → abrir a ficha | Esperado: um rótulo "Carregando". Obtido: silêncio. | `114-…` | visto | não. **Genérica**. |
| QAW-43 | feedback | baixa | Ficha › Digitar valor | 1280 | todos | Digitar "3.5" vira 3 sem aviso. Os outros inválidos têm mensagem. | Digitar Força → 3.5 | Esperado: a mensagem de inteiro. Obtido: truncado em silêncio. | log | visto | não. **Genérica**. |

### O que está bem feito (reconhecimento)
- O sigilo resiste: NPC oculto, rolagem oculta, parada livre oculta (que já nasce oculta), notas do narrador e notas privadas da sessão não chegam ao jogador, nem na tela nem na API. O 404 é igual para "oculto" e "inexistente", na leitura e na escrita.
- A sessão é bem guardada: cookie httpOnly com `SameSite=Strict`, `path=/auth` e checagem de `Origin`; access token só na memória; erros genéricos de login e cadastro; o convite fica como hash; nada sensível em log ou console.
- O offline funciona: faixa de aviso, contador de pendentes, envio ao reconectar. O LeaveGuard protege o rascunho, e as operações de grupo têm prévia, idempotência e Desfazer.
- Todos os alvos medidos têm pelo menos 44 px. O contraste dos textos está acima de 4,5:1. O foco de teclado é visível e a ordem é lógica.
- A validação de campo é clara (`aria-invalid` mais `role=alert`), os limites de texto e de bolinha seguram, e o cadastro valida sem gastar requisição.

## Cobertura
Matriz `tela × configuração × sistema`. O sistema é Vampiro V20 em todas as linhas: Mago e Lobisomem ficaram fora do escopo pedido e do tempo.

| Tela | 390 | 1280 | Modo | Observação |
|---|---|---|---|---|
| Login (sucesso, erro, Enter) | testado | — | — | QAW-12 |
| Cadastro (validação e 1 envio) | testado | — | — | QAW-12 |
| Lista de crônicas | testado | — | — | |
| Nova crônica | testado | — | — | sem escolha de modo |
| Crônica (narrador): painel Criação de fichas | testado | visto (Mesa N) | pontos e livre | QAW-02, 09, 10 |
| Convidar e Entrar com convite | testado | — | — | QAW-12, 16 |
| Crônica (jogador) | testado | medido | — | QAW-15 |
| Nova ficha (identidade) | testado | testado (livre) | pontos e livre | QAW-07, 08, 11, 13, 14 |
| Ficha em Criação (pontos): Ficha, Vantagens, Orçamento | testado | testado | pontos | QAW-18 a 25, 27, 37, 38 |
| Ficha em Editar (livre, muitos itens) | testado (Vantagens) | testado | livre | QAW-43 |
| Offline (rascunho e Jogo) | testado | — | pontos | QAW-33 |
| Conflito em duas sessões | testado | — | pontos | QAW-19, 20 |
| Teclado (fluxo de criação) | — | testado | pontos | QAW-28 |
| Alvos de toque e contraste | testado (6 telas) | — | — | ok |
| Mesa do narrador (dano, desfazer, Nova noite, seleção) | testado | — | livre | QAW-40 |
| Mesa com 21 fichas (N, só olhando) | testado | testado | livre | QAW-31 |
| Ações do narrador (concluir, travar) | testado | — | livre | QAW-36 |
| XP (conceder, pedir, aprovar) | testado | — | pontos | QAW-32 |
| Bastidores (NPC oculto, rolagem oculta, parada livre, diário, auditoria) | testado | — | pontos e livre | QAW-30, 35 |
| Segurança (oculto, IDOR, sessão, logout) | testado | — | — | QAW-33 |
| Conta | testado | — | — | só a exclusão (não a executei) |
| Transferência de narração, revelar NPC (Identidade/Ficha), aprovação do narrador ligada, Arquivadas | não | não | — | tempo; não fazia parte do foco |
| Mago, Lobisomem | não | não | — | fora do escopo pedido |

Dados criados:
- As crônicas `QA Web Vampiro pontos` e `QA Web Vampiro livre`, com um convite em cada, o jogador membro das duas e uma sessão no Diário da primeira.
- `QA Web Vampiro pontos`: Isadora (concluída, Senhor "Meerlinda", +10 XP, Briga 1 via XP); uma **segunda Isadora duplicada em criação** (evidência do QAW-08); o NPC oculto Zorvath, com uma rolagem oculta.
- `QA Web Vampiro livre`: Caio (concluído pelo narrador, travado, Sangue 9/10 depois da Nova noite) e uma parada livre oculta.
- Na conta N, só abri telas. Nenhuma alteração.
