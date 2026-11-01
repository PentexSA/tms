# Teste manual da criação de ficha com 5 personas

## Contexto
Os usuários estão dizendo que **a criação de ficha não está intuitiva**.
Este teste existe para descobrir **por quê**: em que ponto as pessoas se perdem, o que elas não
entendem e o que o TMS não deixa claro. O objetivo é tornar a criação de ficha intuitiva.
Simplificar o fluxo é uma parte disso, junto com clareza, orientação, feedback, layout no
celular e correção de bugs. A ficha continua completa: o que muda é como o TMS conduz a pessoa.

**App nativo e web têm o mesmo foco em tudo:** cada persona, tarefa e item do checklist roda
nas duas plataformas, com a mesma profundidade. Nenhuma das duas é só comparação.

Entregue dois relatórios:
1. **Relatório técnico (QA):** bugs visuais e funcionais que atrapalham a criação e o resto do TMS.
2. **Relatório de usabilidade (PO + 3 jogadores):** onde e por que a criação de ficha não é
   intuitiva, com evidência e recomendações priorizadas.

Não corrija código nesta tarefa. Só teste, registre e recomende.

## Relatos dos usuários
<!-- Cole aqui o que os usuários disseram (sem nome, e-mail ou outro dado pessoal).
     Cada relato vira uma hipótese a confirmar ou descartar no teste. -->
- …

## O que testar
Branch `main` (v1.1.0). O TMS cobre as versões v0 a v5:
- fichas de Vampiro (V20), Mago (M20) e Lobisomem (W20);
- criação livre e criação por pontos (com orçamento e contador);
- Mesa do narrador: concluir criação, travar, dano em grupo, Nova noite, desfazer;
- evolução por XP com aprovação do narrador;
- Bastidores: NPC oculto, rolagem oculta, parada livre;
- dados, conta e modo offline.

**Foco: criação de ficha, no app e no web**, do convite até a ficha concluída pelo narrador.
Código: `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx`,
`apps/frontend/sheet/CharacterForm.tsx` e `apps/frontend/sheet/creation/`.

Cobertura mínima da criação, igual nas duas plataformas:
- Vampiro nos dois modos (livre e por pontos), no app e no web (390 e 1280);
- Mago e Lobisomem com pelo menos uma criação por pontos cada, no app e no web, para ver se o
  problema se repete entre sistemas ou é de um sistema só.

O resto do TMS (Mesa, XP, Bastidores, dados, conta) entra no teste do QA e do PO, com menos
profundidade que a criação, mas a mesma no app e no web.

Os E2E de Playwright já cobrem as jornadas funcionais no web. O valor deste teste está no que
eles não pegam: layout, sobreposição e clareza para quem usa, no web e no app nativo.

Leia antes, para saber o que é esperado e não reportar como novo o que já é conhecido:
- jornadas esperadas: `doc/plano-v0.md` a `doc/plano-v5.md` (§1 de cada) e `doc/painel-narrador.md`;
- problemas e pendências já conhecidos: `doc/avaliacao-ui-ux.md`, `doc/auditoria-fichas-wod.md`,
  `doc/validacao-v5.md` e `doc/proximas-features.md`;
- regras do jogo: `doc/regras-wod.md`.

## Ambiente
- Local, com o banco do Docker e só dados fictícios. Nada de dados de produção nem de
  pessoas reais.
- Setup: `cp .env.example .env` (os comentários do arquivo dizem o que preencher),
  `npx pnpm bootstrap` (instala pelo lockfile e compila os pacotes da API), `npx pnpm db:up`,
  `npx pnpm db:migrate`, `npx pnpm templates:publish --published`, API com `npx pnpm dev:api`,
  web com `npx pnpm dev:web`. Com o banco migrado, rode `npx pnpm seed:roteiro` (a API do
  seed roda dentro dele; não precisa da API no ar nem de `TRUST_PROXY`): ele cria as contas
  N, J1, J2 e N2 (`@roteiro.test`, a senha sai no terminal), uma crônica de criação livre e
  uma por pontos para cada sistema, e uma crônica de Vampiro com 21 fichas.
  Depois de atualizar o código, rode `npx pnpm bootstrap` de novo: a API e o web se recusam a
  subir com dependências ou build desatualizados e dizem o comando.
  Se algo do setup falhar, pare e me avise em vez de contornar.
- **App:** simulador iOS e emulador Android (`npx pnpm -C apps/frontend ios` /
  `npx pnpm -C apps/frontend android`).
  O scheme é `tms`, então dá para abrir telas por deep link (`xcrun simctl openurl <UDID> tms://...`).
- **Web:** navegador em 390×844 (celular) e 1280 (desktop).
- O que só acontece numa plataforma é problema dela; o que acontece nas duas é problema do
  fluxo. Registre a diferença sempre que o resultado mudar entre app e web.
- Se você não conseguir interagir com o app nativo, não invente o resultado nem use o web no
  lugar dele: tire screenshots do nativo onde der, marque no relatório as tarefas que ficaram
  sem teste no app e me avise.

## Personas
Cada persona testa no app e no web, com um agente para cada plataforma (as contas estão na
tabela da fase 1). Cada agente avalia sozinho, sem ler as notas dos outros. Para cada tarefa,
anote:
- se concluiu sem ajuda, com dificuldade ou não concluiu;
- os passos, os toques ou cliques e as rolagens;
- onde hesitou, voltou ou errou, e o que esperava encontrar ali;
- o que pareceu desnecessário, repetido ou longo demais e poderia ser feito em menos passos;
- o que pensou, em formato de "pensando em voz alta";
- uma nota de facilidade de 1 a 7 (Single Ease Question) ao fim da tarefa.

1. **PO:** avalia a aderência. A criação de ficha e as jornadas dos planos
   v0 a v5 funcionam de ponta a ponta como o plano promete? O que falta, o que está diferente do
   plano, o que sobra. Marca o que já aparece como pendência conhecida nos documentos.
2. **QA:** avalia a qualidade técnica, tela por tela, começando pela criação de ficha, nas 3
   configurações (app, web 390, web 1280). Pode entrar como N ou J1 para ver telas que pedem
   esses papéis, sem alterar o que as outras personas estão usando:
   - botões e ações: todos visíveis e alcançáveis, nada escondido, cortado, sobreposto ou fora da tela;
   - teclado cobrindo campo, safe area (notch e barra inferior), rolagem travada;
   - estados: carregando, vazio, erro, sem rede (offline), conflito de edição e sucesso;
   - validação: campo inválido, valores no limite, orçamento estourado, duplo clique em salvar,
     voltar no meio do fluxo, recarregar a página, sair e voltar no meio da criação;
   - carga: a Mesa com 21 fichas e fichas com muitos itens (disciplinas, esferas, dons);
   - console e rede: erros de JS, requisições que falham, warnings;
   - nada sensível exposto: token na URL, dados pessoais ou token no console, NPC oculto ou
     rolagem oculta aparecendo para o jogador;
   - acessibilidade básica: alvo de toque de pelo menos 44pt, contraste, rótulos para leitor de
     tela, navegação por teclado no web.
3. **Narrador:** veterano de World of Darkness. Cria uma crônica nova, gera um convite e
   escolhe o modo de criação. Depois que os jogadores criam as fichas, acompanha a criação,
   devolve uma ficha para correção e conclui as outras. Avalia se entende em que pé está a
   ficha de cada jogador e se consegue ajudar quem travou.
4. **Jogador experiente:** já fez dezenas de fichas de Vampiro no papel. Cria a ficha
   de Vampiro nos dois modos e uma de Mago ou Lobisomem. Avalia se o fluxo segue a ordem do livro
   (conceito, atributos, habilidades, vantagens, pontos de bônus), se encontra cada coisa onde
   espera, se a conta de pontos está certa e se a experiência é a mesma entre os sistemas.
5. **Jogador iniciante:** nunca criou uma ficha nem jogou RPG. Faz o cadastro do zero, entra
   na crônica pelo convite e cria a ficha por pontos.
   Avalia se sabe por onde começar, se entende os termos (clã, disciplina, Força de Vontade,
   pontos de bônus), se sabe quantos pontos tem e onde gastar, se sabe o que falta para
   terminar e se as mensagens de erro dizem o que fazer.

## Execução com vários agentes
Rode as personas em paralelo, um agente por frente (subagentes ou um workflow). Isso ganha tempo
e mantém as avaliações independentes. Você é o orquestrador: prepara o ambiente, dispara os
agentes, acompanha e consolida.

**Fase 0: preparação (orquestrador, sozinho)**
- Sobe o ambiente e roda `npx pnpm seed:roteiro`, uma vez só.
- Como N, cria dois convites na crônica de Vampiro por pontos, um para o Iniciante app e outro
  para o Iniciante web. As contas dos iniciantes não são criadas aqui: eles fazem o cadastro
  do zero.
- Cria `doc/testes/AAAA-MM-DD/notas/` e `doc/testes/AAAA-MM-DD/img/`.

**Fase 1: em paralelo (10 agentes)**

Cada persona tem um agente no app e outro no web. Assim as duas plataformas recebem a mesma
profundidade, e a primeira impressão, que se perde depois que a pessoa aprende o fluxo, fica
registrada nas duas.

| Agente | Conta | Plataforma |
|---|---|---|
| QA app | própria | app nativo, iOS e Android |
| QA web | própria | web 390 e 1280 |
| PO app | própria | app nativo |
| PO web | própria | web 390 e 1280 |
| Narrador app | N | app nativo |
| Narrador web | N2 | web 390 e 1280 |
| Jogador experiente app | J1 | app nativo |
| Jogador experiente web | J2 | web 390 e 1280 |
| Iniciante app | nova, com o convite A | app nativo |
| Iniciante web | nova, com o convite B | web 390 e 1280 |

Na fase 1, os Narradores criam a própria crônica, o convite e o modo de criação.

**Fase 2: Narradores com as fichas da fase 1 (2 agentes, em paralelo)**
As crônicas do seed são de N, então os dois Narradores entram como N nesta fase. O Narrador app
cuida das fichas de J1 e do Iniciante app, e o Narrador web, das de J2 e do Iniciante web: cada
um acompanha a criação, devolve uma ficha para correção e conclui as outras, sem mexer nas
fichas da outra plataforma. Use os mesmos agentes da fase 1, se der; senão, agentes novos que
recebem as próprias notas da fase 1.

**Fase 3: consolidação (orquestrador ou um agente)**
Lê todas as notas, junta os achados repetidos, cruza com os relatos dos usuários e escreve os
dois relatórios. Não acrescenta achado que não esteja nas notas.

**Para os agentes não se atrapalharem**
- **Navegador:** cada agente usa um navegador isolado, com sessão própria (Playwright, já
  instalado em `e2e/`, com um browser context por agente). Os agentes não dividem o mesmo perfil
  do Chrome: as abas compartilham cookies, e o login de uma conta derruba a sessão da outra.
- **Simulador:** cada agente de app usa o próprio simulador ou emulador, pelo UDID
  (`xcrun simctl create` ou `clone`), nunca `booted`. Divida iOS e Android entre os agentes de
  app para cobrir os dois. Se a máquina não aguentar vários, os agentes de app entram em fila,
  um por vez. Nenhum agente de app troca o app pelo web.
- **Banco, API e Metro:** compartilhados. Nenhum agente roda `seed:roteiro`, `db:down` ou
  migration, nem reinicia servidor. Se um serviço cair, o agente avisa o orquestrador.
- **Rate limit:** a API limita cadastro e login por IP. Se um agente esbarrar nele, anota e
  avisa o orquestrador em vez de contornar.
- **Arquivos:** cada agente escreve só nos próprios arquivos, `notas/<persona>-<app|web>.md` e
  `img/<persona>-<app|web>/`.
- **Prompt de cada agente:** a persona, a plataforma, a conta, as tarefas e o formato das
  notas (o da seção Personas). Os agentes de app e de web da mesma persona recebem as mesmas
  tarefas. Nenhum agente recebe as notas de outro, exceto os Narradores na fase 2, que recebem
  as próprias.

## Regra para as recomendações
As recomendações servem para tornar a criação intuitiva. Classifique cada uma por tipo:
- **simplificação:** juntar ou eliminar passos que não precisam existir, menos toques e
  rolagens, valores padrão e sugeridos;
- **clareza:** termos explicados no contexto, rótulos, textos e mensagens de erro que dizem o
  que fazer;
- **orientação:** onde a pessoa está, o que falta e qual o próximo passo;
- **feedback:** contador de pontos, validação na hora, confirmação do que foi salvo;
- **layout:** hierarquia, alvos de toque, teclado e rolagem no celular;
- **bug:** algo que não funciona como deveria.

A ficha continua sendo a ficha do jogo: nenhuma recomendação pode remover campo, mudar regra ou
afrouxar limite (prioridades, pontos por categoria, pontos de bônus).

Para cada recomendação, diga se ela é **genérica** (serve para qualquer sistema, inclusive D&D
ou Call of Cthulhu), **de skin** (só o visual de um sistema) ou **de template** (dados do
sistema). O TMS não é só WoD.

## Formato dos relatórios
Salvar em `doc/testes/AAAA-MM-DD/`, com os screenshots em `doc/testes/AAAA-MM-DD/img/`.

**`relatorio-tecnico.md` (QA)**
- Resumo: total de achados por severidade e por plataforma, e a cobertura (matriz de
  tela × plataforma × sistema com o que foi testado e o que não foi).
- Tabela de achados com: ID, severidade (crítica, alta, média ou baixa), plataforma, sistema,
  tela, descrição, passos para reproduzir, esperado × obtido, evidência (screenshot ou erro do
  console) e o arquivo provável no código, se você encontrar.
- Marque os achados que atrapalham a criação de ficha: eles podem ser parte da queixa.
- Vazamento de informação oculta (NPC, rolagem, nota privada) é sempre severidade crítica.

**`relatorio-usabilidade.md` (PO + 3 personas)**
- Resumo executivo: por que a criação de ficha não é intuitiva, em até 5 causas, da mais para
  a menos grave, cada uma com a evidência.
- Relatos dos usuários: cada um marcado como confirmado, parcial ou não reproduzido.
- Mapa da criação: os passos do convite até a ficha concluída, com os pontos de atrito
  marcados e quantas personas travaram em cada um.
- App × web: o que só acontece no app, o que só acontece no web e o que acontece nos dois.
- Uma seção por persona, com app e web lado a lado: tarefas, resultado (sem ajuda, com
  dificuldade, não concluiu), passos e toques, pontos de atrito com citações do "pensando em
  voz alta" e as notas de 1 a 7.
- Consistência entre sistemas: o que muda na criação entre Vampiro, Mago e Lobisomem e se
  essa mudança vem da regra do jogo ou é inconsistência do TMS.
- Aderência (PO): cada jornada dos planos v0 a v5 marcada como ok, parcial ou falta.
- Tabela de recomendações priorizadas: causa que resolve, quem sofre, recomendação, tipo
  (simplificação, clareza, orientação, feedback, layout ou bug), impacto × esforço e se é
  genérica, de skin ou de template.
- Comparação com `doc/avaliacao-ui-ux.md` e `doc/auditoria-fichas-wod.md`: o que foi
  resolvido, o que continua e o que é novo.

## Regras
- Todo achado precisa de evidência. Separe o que você viu do que supõe.
- As personas são simuladas. Deixe claro no relatório que é uma avaliação heurística, que
  complementa os relatos e não substitui teste com usuários reais.
- Se o mesmo problema afeta várias personas, registre uma vez e liste quem ele afeta.
- No fim, me mande no chat um resumo de até 10 linhas com o caminho dos dois arquivos.
