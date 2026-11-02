# Relatório de usabilidade: criação de ficha no TMS (app e web)

- **Data do teste:** 01/11/2026 · **Versão:** `main`, v1.1.0 (commit `1db3db9`)
- **Foco:** criação de ficha, do convite até a ficha concluída pelo narrador, no app nativo e no web, em Vampiro (V20), Mago (M20) e Lobisomem (W20). As jornadas v0 a v5 entram com menos profundidade, pelo PO.
- **Fontes:** as notas em `notas/` (PO, Narrador, Jogador experiente e Iniciante, cada um no app e no web, e as do orquestrador). O `qa-web.md` serviu só para cruzar os bugs das recomendações. O `qa-app.md` estava em andamento e ficou de fora. Nenhum achado deste relatório está fora das notas.

> **Avaliação heurística com personas simuladas.** As oito execuções foram feitas por agentes que simulam um PO, um narrador veterano, um jogador experiente e um jogador iniciante. O resultado complementa os relatos dos usuários e não substitui teste com pessoas reais (ver o §10 de `doc/avaliacao-ui-ux.md`). As notas SEQ (1 a 7) e os resultados foram copiados das notas, sem recálculo.

**Siglas das execuções:** PO-W e PO-A (PO no web e no app), N-W e N-A (Narrador), E-W e E-A (Jogador experiente), I-W e I-A (Iniciante). **Visto** é o que a persona viu na tela, na árvore de acessibilidade ou no log. **Suposto** é inferência que a própria nota marca como tal. Os caminhos de imagem são relativos a este arquivo.

---

## 1. Resumo executivo

A queixa se confirma. A conta de pontos está certa nos três sistemas: prioridades, tetos e custos de bônus foram conferidos com `doc/regras-wod.md` pelo PO e pelos dois experientes, e a folha "Começaram os pontos de bônus" foi elogiada por todas as execuções que criaram ficha por pontos. O que torna a criação pouco intuitiva é **como o TMS conduz a pessoa**. São cinco causas, da mais para a menos grave:

| # | Causa | O que as personas viveram | Quem | Evidência |
|---|---|---|---|---|
| C1 | **A ficha não diz em que estado está, quem conclui nem qual é o próximo passo**, para o jogador e para o narrador | A ficha em criação, reaberta, cai em Jogo com tudo em 1 e sem "Em criação" (POW-01, EW-08, IW-04, IA-04). A lista da crônica mostra "Sua ficha" antes e depois de concluir (POA-10, EA-13, IW-13, IA-13). Na criação livre não há "entregar" nem aviso de que o narrador conclui (POW-08, POA-10, EA-13). Na crônica por pontos sem aprovação, o jogador conclui sem saber se o narrador foi avisado (IW-08, IA-13). A devolução só aparece no modo Criação (POW-09, POA-35). O narrador vê só "Em criação" na Mesa e refaz a conta de cabeça (NW-20, NA-19); sem aprovação ligada, não tem como devolver, e a nota que escreve é privada sem que a tela diga (NW-24, NW-25, NA-17, NA-18) | 8 de 8. Os dois narradores **não concluíram** "devolver" (SEQ 2 e 1) | `img/iniciante-app/40-ficha-reaberta-ios.webp`, `img/po-web/42-acoes-da-ficha-jogador-livre-390.webp`, `img/po-app/118-jogador-criacao-devolvida-ios.webp`, `img/narrador-app/80-f2-bento-acoes-sem-devolver-ios.webp` |
| C2 | **O salvamento engana e perde trabalho** | "● Salvo" verde com dezenas de alterações pendentes (EW-05, EA-04, IW-01, IA-02). O rascunho fica só na memória: I-W perdeu os Físicos num F5, I-A perdeu o clã e os atributos ao fechar o app, E-A perdeu ~26 alterações numa queda (o gatilho foi só dev) (IW-01, IA-01, EA-04). A prioridade é gravada na hora e os pontos não (IA-03). Quando os básicos acabam, "Salvar alterações" vira "Concluir criação" e não dá mais para salvar sem concluir (EW-06, EA-06, IW-02, IA-09). O "Concluir" do modo Editar só salva (POW-07) | E-W, E-A, I-W e I-A no salvar; PO-W, PO-A e N-W no "Concluir". I-A **não concluiu** "sair e voltar" (SEQ 2) | `img/iniciante-web/37-fisicos-distribuidos-390.webp`, `img/iniciante-app/40-ficha-reaberta-ios.webp`, `img/experiente-app/73-criacao-apos-reabrir-android.webp`, `img/experiente-web/56-trocar-para-jogo-390.webp` |
| C3 | **A tela não nomeia nem explica o que pede** | Os grupos de escolha não têm título visível: "Desligada/Ligada" (é a aprovação do narrador) e "Por pontos/Livre" na crônica; Sistema, Clã, Raça, Augúrio, Tribo, Tradição e Essência na criação. O nome só existe para o leitor de tela (POW-04, POA-01, NW-01, NA-01, NA-09, EW-22, EA-08, IW-07, IA-05). Nenhum termo do jogo tem explicação, nem nas listas de escolha (IW-06, IA-06). Nada antes da ficha diz que a crônica é por pontos (EW-01, EA-21, NW-19). I-A criou a ficha sem clã sem perceber; N-A escolheu a aprovação "no chute"; os iniciantes escolheram clã, Natureza e Disciplinas "pelo som do nome" | 8 de 8 viram os grupos sem título; I-W e I-A não entenderam os termos | `img/narrador-app/10-cronica-criada-ios.webp`, `img/iniciante-app/21-criar-sem-cla-ios.webp`, `img/experiente-app/60-tribos-android.webp`, `img/iniciante-web/23-natureza-lista-390.webp` |
| C4 | **O feedback da conta dá o motivo errado, chega tarde ou aparece longe do toque** | No teto de 3 das Habilidades, a mensagem diz "os 13 pontos básicos já foram usados" com o contador em 3/13 (POA-14, EW-04, EA-05, IW-03). "A conta fechou: conclua a criação" aparece com 15 de 15 de bônus por gastar (EW-07, EA-07, IW-10). O custo do bônus só aparece depois de gastar (IW-10, IA-12), e não há extrato (EW-17, NW-22). Concluir com bônus sobrando não avisa (POW-10, POA-17, IA-08). Avisos ficam na tela depois de resolvidos (POW-24, POA-12, EA-16, EW-14, IW-09, IA-11) ou saem atrás da folha ou abaixo da dobra, e o toque parece morto (EA-01, EW-15, IA-10). O resumo de salvar mostra "Aparência 0 → 3" quando a tela mostrava 1 (POA-08, EW-23, IA-22). A FdV atual não acompanha a permanente comprada (POA-16, EW-24, EA-19, IA-23, NA-21) | 6 de 6 execuções de jogador; os dois narradores na revisão | `img/experiente-web/46-pericias-mensagem-errada-390.webp`, `img/iniciante-app/62-ver-orcamento-ios.webp`, `img/experiente-app/49-disciplina-apos-fechar-android.webp`, `img/narrador-app/35-f2-v4-mesa-cards-ios.webp` |
| C5 | **O guia existe, mas fica longe, e o celular cobra caro para chegar nele** | O "O que falta" da aba Orçamento foi a melhor orientação do fluxo para I-W, I-A, E-A e PO-A, mas fica na 4ª aba, com um nome que o iniciante leu como "dinheiro", e os itens não levam ao grupo (IW-05, IA-18). No celular, abas e sub-abas não ficam fixas e o cabeçalho fixo ocupa cerca de um terço da tela (POA-15, EA-10, IA-16, IA-17). "Histórico" sai da tela (POW-12, POA-07, EW-12, EA-25, IA-14). Itens de lista sobem por folha, de 3 a 5 toques por ponto (EW-10, EA-12, IW-22, IA-29). No Android, o teclado cobre campo e botão (EA-02, EA-11). I-A gastou ~200 toques e ~45 rolagens numa ficha | I-W, I-A, E-A e PO-A no guia; PO-A, E-A e I-A no celular | `img/iniciante-web/41-orcamento-390.webp`, `img/iniciante-app/50-fim-talentos-ios.webp`, `img/experiente-app/25-fraqueza-teclado-android.webp` |

**Nenhuma das cinco causas depende do WoD.** Estão no fluxo de criação e nos componentes genéricos (estado da ficha, salvamento, rótulo de grupo, mensagens de recusa, layout), não nos dados de Vampiro, Mago ou Lobisomem. O Jogador experiente web chegou à mesma conclusão: um point buy de D&D 5e ou uma distribuição por ocupação de Call of Cthulhu bateriam nas mesmas mensagens de teto × orçamento, no "Salvo" e no salvar escondido.

**O que funciona e deve ficar** (citado por várias personas):
- A folha "Começaram os pontos de bônus", no momento certo e com troca automática de básicos para bônus (`img/po-web/58-vantagens-basicos-completos-1280.webp`, `img/experiente-app/50-virtudes-pontos-android.webp`, `img/iniciante-web/56-virtudes-390.webp`).
- Prioridades 7/5/3 e 13/9/5 na tela, contadores por grupo ("7/7 · +1 bônus"), bloqueios certos (Aparência do Nosferatu, Esfera ≤ Arete, Arete ≤ 3, saldo de bônus) e todos os custos de bônus conferidos com o livro.
- O "O que falta" da aba Orçamento, "Sair sem salvar?" no voltar, "Escolher da lista" para Natureza e Comportamento, o fluxo "Enviar para aprovação" com "Aprovar ficha" e "Devolver para correção", o "‹ Anterior · n de N na Mesa · Próxima ›" do narrador e a faixa de "Ficha travada".
- Na 1280, os três grupos de Atributos lado a lado com os contadores: o melhor layout de criação do teste (`img/iniciante-web/66-criacao-atributos-1280.webp`).

---

## 2. Condições do teste

- **Ambiente:** local, banco do Docker (Postgres 16 por override do compose), só dados fictícios. Contas do seed: N, N2, J1 e J2; os iniciantes criaram conta nova; PO e QA usaram contas próprias. Todas `@roteiro.test`, fictícias.
- **Web:** Chromium headless (Playwright), 390×844 e 1280×800, servido pelo Expo dev server (não o export de produção com CSP). WebKit não foi testado.
- **App: build de teste.** O app nativo do `main` não compila no iOS nem no Android (ORQ-04: o `react-native-gesture-handler` 2.28.0 entra como peer opcional do `expo-router` e não compila com o RN 0.88; achado à parte, para o relatório técnico). Os resultados de app vêm de um build de debug feito num worktree isolado no mesmo commit, com uma única diferença (`react-native.config.js` tirando esse módulo do autolinking) e com o JS servido pelo **mesmo Metro do `main`**. Nenhum agente viu erro ligado ao módulo. As conclusões de UX e de layout do app valem para o `main`.
- **Dispositivos:** iOS 26.5 no simulador (PO-A: iPhone 17 Pro Max, 440 pt; N-A: iPhone 17 Pro, 402 pt; I-A: iPhone 17, 402 pt) e Android 16 num emulador Pixel 6 (E-A).
- **Limitações:** no iOS, o simulador controlado pelo idb age como se houvesse teclado de hardware, então "teclado cobrindo campo" foi avaliado só no Android (N-A viu o teclado de software uma vez, na fase 2, depois de religar o simulador). O idb perde ou troca caracteres em textos longos: erros de digitação nas notas do iOS podem ser da ferramenta. Offline foi testado só no Android e no web.
- **Ambiente não é produto.** Não viram causa nem recomendação: o "Atualize o app" e o "Este sistema usa criação livre" antes de 12:22 (`dist` antigo dos pacotes, ORQ-02); o `usePreventRemove is not a function` antes de 12:55 (`node_modules` antigo, ORQ-03); o "Unable to load script" do Android (atalho "rr" de recarregar do build de debug, digitado pela ferramenta sem campo focado); os erros de digitação do idb no iOS. As notas registram uma observação de clareza nesse estado ("Atualize o app" sem ação no navegador: POW-03, NW-12, EW-02, IW-17); ela fica de fora porque só se reproduz com o ambiente quebrado. Um efeito do ambiente pesa na leitura: **no web, a primeira abertura das fichas de PO-W, E-W (Tibério) e I-W quebrou**, então essas personas só viram a ficha reaberta (ver 4.2).
- **Aprovação do narrador:** a devolução para correção só existe com "Aprovação do narrador" **Ligada**. As crônicas do seed e a do N-W estão com ela **Desligada** (o padrão); a do N-A está Ligada, mas sem jogadores. Só o PO testou a devolução.
- **Cobertura mínima da criação:** Vampiro livre e por pontos nas duas plataformas; Mago por pontos no web (E-W) e no app (PO-A); Lobisomem por pontos no web (PO-W) e no app (E-A).

---

## 3. Relatos dos usuários

O prompt não traz relatos específicos: a seção "Relatos dos usuários" está vazia. A única entrada é a queixa geral.

| Relato | Situação | Evidência |
|---|---|---|
| "A criação de ficha não está intuitiva" | **Confirmado** (nesta avaliação heurística) | Das 27 notas SEQ das tarefas de montar, entregar, acompanhar e fechar a ficha (tabela abaixo), a mediana é **3**; 14 são 3 ou menos, e só uma passa de 5 (E-W, Mago por pontos, 6). Nenhuma das oito execuções passou pela criação sem tropeço. Três tarefas não foram concluídas (N-W e N-A em "devolver uma ficha", I-A em "sair e voltar"), e o PO-A não conseguiu "entregar" a ficha da criação livre. As cinco causas do §1 explicam onde e por quê |

A queixa pesa mais para o iniciante (SEQ 2 nos dois) e para o narrador (acompanhar: 3 e 3; devolver: 2 e 1), e mais na criação livre, que não tem conta nem passo de entrega. O veterano na criação por pontos achou o modo "o melhor do TMS" (E-A) e deu 6 ao Mago (E-W). O caminho até a ficha é fácil: cadastro, convite e Nova crônica ficaram entre 5 e 6, com exceção da configuração do modo de criação (N-W 4, N-A 3).

| Execução | Tarefas de criação (na ordem) | Resultado | SEQ |
|---|---|---|---|
| PO-W | Vampiro livre; Vampiro por pontos; Lobisomem por pontos | com dificuldade nas três | 4, 5, 4 |
| PO-A | Vampiro livre; Vampiro por pontos; Mago por pontos; narrador conclui, devolve e aprova | sem ajuda para criar e **não concluiu "entregar"**; com dificuldade nas outras três | 5, 3, 3, 4 |
| N-W | acompanhar; ajudar quem travou; devolver; concluir as outras | com dificuldade; com dificuldade; **não concluiu**; com dificuldade | 3, 4, 2, 5 |
| N-A | acompanhar; ajudar quem travou; devolver; concluir as outras | com dificuldade; com dificuldade; **não concluiu**; com dificuldade | 3, 2, 1, 4 |
| E-W | Vampiro livre; Vampiro por pontos; Mago por pontos | com dificuldade (ambiente até 12:55); sem ajuda; sem ajuda | 4, 5, 6 |
| E-A | Vampiro livre; Vampiro por pontos; Lobisomem por pontos | sem ajuda; com dificuldade; com dificuldade | 4, 5, 3 |
| I-W | Vampiro por pontos; sair e voltar; depois de entregar | com dificuldade nas três | 2, 3, 3 |
| I-A | Vampiro por pontos; sair e voltar; depois de entregar | com dificuldade; **não concluiu**; com dificuldade | 2, 2, 3 |

---

## 4. Mapa da criação

Fluxo: **Narrador** cria a crônica → configura modo e aprovação → convida · **Jogador** cria a conta → entra com o convite → Nova ficha (identidade) → abre a ficha → distribui atributos e habilidades → vantagens → pontos de bônus → salva → conclui ou envia · **Narrador** acompanha → devolve → conclui ou aprova · **Jogador** depois da ficha concluída.

### 4.1 Pontos de atrito por passo

Contagem sobre as 8 execuções. "Passaram" é quem executou o passo; "travaram" é quem não concluiu; "com dificuldade" é quem a nota registra com hesitação, erro ou resultado "com dificuldade" naquele passo.

| # | Passo | Passaram | Pontos de atrito (IDs) | Travaram | Com dificuldade | Evidência |
|---|---|---|---|---|---|---|
| 1 | Narrador cria a crônica | PO-W, PO-A, N-W, N-A (4) | Sistema sem título; botão desabilitado sem dizer o que falta; o modo de criação não é perguntado aqui (NW-18, NA-02, NA-09); no app, "Criar crônica" fica no fim da lista (NA-04) | 0 | 1 hesitou (N-A, achar o botão) | `img/narrador-app/06-cronicas-botoes-fim-da-lista-ios.webp` |
| 2 | Configura modo e aprovação | PO-W, PO-A, N-W, N-A (4) | "Desligada/Ligada" e "Por pontos/Livre" sem título nem efeito; o padrão "Desligada + Por pontos" parece contraditório (POW-04, POA-01, NW-01, NW-02, NA-01); sair sem salvar descarta sem aviso (NW-03); sem valor do livro nem "restaurar" (NW-04, NA-15); o painel fica acima das abas em toda visita (POW-32, POA-19, NW-10, NA-03) | 0 | 3 (PO-A, N-W, N-A); PO-W registrou o mesmo (POW-04) | `img/narrador-app/10-cronica-criada-ios.webp`, `img/narrador-web/25-modo-pontos-390.webp` |
| 3 | Gera e manda o convite | PO-W, PO-A, N-W, N-A (4) | Código de 26 caracteres sem link e sem instrução de onde colar (NW-09, NA-05); no web, "Código copiado" aparece atrás da folha e "Compartilhar" falha sem Web Share (NW-05, NW-06); "Revogar" sem confirmação (NW-07); convites ativos indistinguíveis (NW-08, NA-06) | 0 | 1 (N-W) | `img/narrador-app/20-compartilhar-ios.webp`, `img/narrador-web/23-convite-copiado-feedback-390.webp` |
| 4 | Jogador cria a conta | I-W, I-A (2) | Regra do nome de usuário genérica e erro que não some ao corrigir (IW-18, IA-25, IA-11); o destaque da lista vazia é "Criar crônica", o caminho do narrador (IW-14, IA-26) | 0 | 0 (tropeço leve nos dois) | `img/iniciante-web/06-pos-cadastro-390.webp`, `img/iniciante-app/11-apos-cadastro-ios.webp` |
| 5 | Entra com o convite | PO-W, PO-A, I-W, I-A (4); J1 e J2 já eram membros | 26 caracteres digitados no celular (PO-A). A dificuldade de um iniciante com o código é **suposta** (NW-09): I-W e I-A entraram sem ajuda (SEQ 6), mas receberam o código pelo roteiro | 0 | 0 | `img/po-app/19-codigo-digitado-ios.webp`, `img/iniciante-web/10-cronica-entrou-390.webp` |
| 6 | Nova ficha (identidade) | PO-W, PO-A, E-W, E-A, I-W, I-A (6) | Clã, Raça, Augúrio, Tribo, Tradição e Essência sem título (6 de 6: POW-04, POA-01, EW-22, EA-08, IW-07, IA-05); "Criar ficha" aceita sem clã (IA-05); nada diz que a crônica é por pontos (EW-01, EA-21, NW-19); termos sem explicação (IW-06, IA-06); "Informe o nome" fora da tela (POA-11, IW-15, IA-10); corretor do iOS no nome (POA-05); no Android, o teclado cobre campos e não tem "Próximo" (EA-11) | 0 (I-A criou sem clã sem perceber) | 3 (I-W, I-A, E-A) | `img/iniciante-app/21-criar-sem-cla-ios.webp`, `img/experiente-app/57-nova-ficha-lobisomem-android.webp` |
| 7 | Abre a ficha e acha onde montar | 6 jogadores | Na primeira abertura, depois de "Criar ficha", a ficha vai para Criação ou Editar (PO-A, E-A, E-W por pontos, I-A). **Reaberta**, cai em Jogo, com tudo em 1 e sem "Em criação" (POW-01, EW-08, IW-04, IA-04). Para o narrador, a Leitura também não diz se a ficha está em criação (NW-28) | 0 | 4 (PO-W, E-W, I-W, I-A) | `img/iniciante-web/30-ficha-aberta-390.webp`, `img/iniciante-app/40-ficha-reaberta-ios.webp`, `img/po-app/40-ficha-pontos-criada-ios.webp` |
| 8a | Distribui atributos e habilidades (por pontos) | PO-W, PO-A, E-W, E-A, I-W, I-A (6) | Mensagem errada no teto de 3 (4: PO-A, E-W, E-A, I-W); aviso vermelho que fica depois de resolvido (6 de 6); prioridade dos outros grupos marcada sozinha, sem aviso (registrada como problema por PO-A, E-A e I-A; E-W e I-W gostaram); "use os pontos de bônus" sem dizer onde (PO-A, E-W, E-A, I-W); aviso abaixo da dobra com o "+" de cara ativa (I-A); "O que falta" na 4ª aba (I-W, I-A, E-A, PO-A); abas não fixas no celular (PO-A, E-A, I-A) | 0 | 4 (PO-A, E-A, I-W, I-A) | `img/experiente-app/45-habilidade-max3-android.webp`, `img/po-app/43-prioridade-fisicos-ios.webp`, `img/iniciante-app/32-fisicos-estouro-ios.webp` |
| 8b | Monta a ficha (criação livre) | PO-W, PO-A, E-W, E-A (4) | Sem contador nem soma por grupo: os experientes conferiram 7/5/3 e 13/9/5 de cabeça (EW-08; E-A no diário). O PO registra que é o que o plano promete | 0 | 1 (E-W, com o atraso do ambiente) | `img/experiente-web/16-ficha-editar-1280.webp` |
| 9 | Vantagens (Disciplinas, Dons, Esferas, Antecedentes, Virtudes, Fraqueza) | 6 jogadores | Lista sem marcar as Disciplinas do clã ou a Esfera da Tradição (6: POW-23, PO-A, EW-18, EA-09, IW-16, IA-07); I-A pegou Dominação num Brujah sem aviso (NA-20); item sobe por folha, 3 a 5 toques (EW-10, EA-12, IW-22, IA-29, PO-A); títulos e contadores repetidos (POW-22, EA-17, EW-29, IW-21, IA-28); Dons em texto livre (POW-21, EA-03); Fraqueza do clã vazia (EW-31, EA-24, IA-21; I-W deixou vazia, NW-33); teclado cobre a folha no Android (EA-02) | 0 | 4 (PO-W, E-A, I-W, I-A) | `img/iniciante-app/54-adicionar-disciplina-ios.webp`, `img/experiente-app/66-adicionar-dom-android.webp` |
| 10 | Pontos de bônus | 6 jogadores (E-W e E-A também de cabeça, na livre) | "A conta fechou" com bônus por gastar (E-W, E-A, I-W, I-A); custo visível só depois de gastar (I-W, I-A); sem extrato do que foi comprado (E-W, E-A); "Bônus: 0 de 15" lido como "gastei 0" (I-W); aviso de saldo atrás da folha (E-W); FdV, Gnose e Fúria atuais não acompanham a permanente (PO-W, PO-A, E-W, E-A, I-A) | 0 | 2 (I-W, I-A); E-A desconfiou da conta pelas mensagens | `img/experiente-web/50-orcamento-bonus-390.webp`, `img/iniciante-web/60-bonus-destreza-390.webp`, `img/po-app/57-fdv-bonus-ios.webp` |
| 11 | Salva o progresso | 6 jogadores | "● Salvo" com alterações pendentes (E-W, E-A, I-W, I-A); trabalho perdido (I-W no F5, I-A ao fechar o app, E-A na queda); "Salvar alterações" vira "Concluir criação" (E-W, E-A, I-W, I-A); prioridade salva sozinha e pontos não (I-A); "Concluir" do Editar só salva (PO-W, PO-A) | 1 (I-A) | 3 (E-W, E-A, I-W); PO-W e PO-A estranharam o "Concluir" | `img/iniciante-web/39-apos-recarregar-390.webp`, `img/experiente-app/55-trocar-para-jogo-android.webp`, `img/po-web/40-concluir-resumo-390.webp` |
| 12 | Entrega ou conclui (jogador) | 6 jogadores | **Livre:** nenhum dos 4 achou como entregar nem aviso de que o narrador conclui (POW-08, POA-10, EA-13, E-W). **Por pontos sem aprovação:** I-W e I-A concluíram sem entender o que acontece com o narrador (IW-08, IA-13); E-W e E-A procuraram "entregar ao narrador" e não acharam (EW-06, EA-13). **Com aprovação:** "Enviar para aprovação" claro (PO-W, PO-A). Bônus sobrando sem aviso (PO-W, PO-A, I-A) | 1 (PO-A, na livre) | 5 (PO-W, E-W, E-A, I-W, I-A) | `img/po-web/42-acoes-da-ficha-jogador-livre-390.webp`, `img/iniciante-app/65-concluir-com-sobra-ios.webp` |
| 13 | Narrador acompanha | PO-W, PO-A, N-W, N-A (4) | A Mesa mostra só "Em criação", sem progresso nem conta (NW-20, NA-19); "Só com alerta" não trata a criação (NA-19); a Mesa não mostra "Aguardando aprovação" (POW-11); o aviso de revisão fica abaixo do painel, a duas rolagens (POA-19); sem Orçamento em `pending` (POA-20); ver a conta exige o modo Criação, que já é edição (NW-21, NA-27); na 390, o estado vira "···" (NW-27); o narrador refaz o bônus de cabeça (NW-22) | 0 | 3 (N-W, N-A, PO-A); PO-W registrou POW-11 | `img/narrador-app/34-f2-v4-mesa-ios.webp`, `img/po-app/78-narrador-criacao-pendente-sem-orcamento-ios.webp`, `img/narrador-web/62-f2-sebastiao-criacao-390.webp` |
| 14 | Narrador devolve para correção | PO-W, PO-A (aprovação ligada); N-W, N-A (desligada) (4) | **Sem aprovação, o caminho não existe** (NW-24, NA-18) e o único canal, Notas do Narrador, é privado sem que a tela diga (NW-25, NA-17). **Com aprovação**, a devolução funciona, mas o jogador só vê o motivo no modo Criação (POW-09, POA-35) | 2 (N-W, N-A) | 2 (PO-W, PO-A) | `img/narrador-web/67-f2-sebastiao-acoes-390.webp`, `img/narrador-app/47-f2-teodoro-notas-narrador-ios.webp`, `img/po-web/66-jogador-ficha-devolvida-1280.webp` |
| 15 | Narrador conclui ou aprova | PO-W, PO-A, N-W, N-A (4) | "Concluir criação" pelo menu aplica na hora, sem confirmação e sem volta; pela barra, pede confirmação (POA-18, NW-26, NA-22); na livre, só existe no menu (NA-23); os toasts dizem "passa pelo narrador" ou "passa por você" (NA-22) | 0 | 3 (PO-A, N-W, N-A) | `img/narrador-app/78-f2-vasco-concluir-confirmacao-ios.webp`, `img/narrador-web/85-f2-tiberio-1s-apos-concluir-sem-confirmacao-1280.webp` |
| 16 | Depois da ficha concluída (jogador) | I-W, I-A (2) | A ficha e a lista ficam iguais; o Histórico não registra a conclusão (IW-08, IA-13); "Peça ao narrador." sem levar ao pedido (IW-25, POA-45); "FdV 4/7" parece dano (IA-23) | 0 | 2 (I-W, I-A) | `img/iniciante-web/73-cronica-pos-conclusao-390.webp`, `img/iniciante-app/77-cronica-depois-ios.webp` |

### 4.2 Notas que parecem se contradizer

| Notas | Contradição | Explicação |
|---|---|---|
| NW-24 e NA-18 ("não dá para devolver") × PO-W e PO-A ("devolução e reenvio") | Uns não acharam a ação; outros a usaram | A devolução só existe com a "Aprovação do narrador" Ligada. Os narradores trabalharam em crônicas com ela Desligada; o PO, em crônicas com ela Ligada. Ligar a aprovação depois não alcança fichas que já existem (NA-18). Fica valendo o achado de orientação: sem aprovação, o narrador não tem como pedir ajuste |
| POW-01, EW-08 e IW-04 ("a ficha abre em Jogo") × PO-A, E-A, E-W por pontos e I-A ("abre em Criação ou Editar") | Mesmo fluxo, abertura diferente | A primeira abertura, logo depois de "Criar ficha", vai para o modo de montagem (o PO-W anota que a chegada com `?mode=` vale só nessa primeira vez). No web, a primeira abertura de PO-W, E-W (Tibério) e I-W quebrou pelo ambiente, e essas personas só viram a ficha **reaberta**. I-A confirma no app que a ficha reaberta cai em Jogo. O defeito é "reabrir em Jogo", nos dois |
| POA-13, EA-15 e IA-19 (prioridade marcada sozinha é problema) × E-W e I-W (é bom) | Avaliação oposta do mesmo comportamento | O comportamento é igual. O que incomoda é a falta de aviso: quem não esperava achou que tinha tocado errado. A recomendação mantém o preenchimento e acrescenta o aviso |
| NA-20 ("se houve aviso durante a criação: não verificado") × I-A | Dúvida do narrador | I-A registra que o app aceitou Dominação sem avisar nada. Resolvido: não há aviso |
| N-A conta 14 de 15 de bônus na ficha de I-A × o Orçamento de I-A mostrava 0 de 15 | Conta diferente | I-A registra que "Coragem +1" custou 1, porque a FdV comprada antes passou a vir da Coragem (IA-12). O narrador não tinha como ver isso sem extrato (NW-22). Reforça C4 |
| N-A, fase 1 ("Ligada" quer dizer o quê? suposto) × fase 2 | Interpretação | Na fase 2 o próprio N-A confirma que é a aprovação do narrador. Resolvido |
| PO-W ("o narrador acha o pedido de XP pela Mesa, 'Pedidos de XP (1)'") × POA-39 ("nem a lista, nem a crônica, nem a linha da Mesa avisam") | Aviso de pedido de XP | **Resolvida em parte no relatório técnico (T-40).** No web 390 a Mesa mostra "Pedidos de XP (1)"; no app, o QA também não viu o pedido na Mesa do Android, e o screenshot do PO-A é da aba Fichas, não da Mesa. É diferença entre plataformas; a causa (Mesa do app que não refaz a consulta, ou botão ausente no nativo) é suposta. Fora do foco da criação (`img/po-web/94-narrador-experiencia-pedido-1280.webp` × `img/po-app/135-narrador-sem-aviso-pedido-ios.webp`) |

---

## 5. App × web

**Só no app**

| Problema | Plataforma | IDs | Evidência |
|---|---|---|---|
| Fechar o app perde o rascunho sem nenhum aviso. No web, o F5 também perde, mas o navegador avisa antes | iOS, Android | IA-01, EA-04 | `img/iniciante-app/40-ficha-reaberta-ios.webp`, `img/experiente-app/73-criacao-apos-reabrir-android.webp` |
| O teclado cobre o campo focado, a busca e o botão das folhas ("Aplicar", "Adicionar"); sem tecla "Próximo" | Android (sem teste no iOS) | EA-02, EA-11 | `img/experiente-app/67-dom-digitado-teclado-android.webp`, `img/experiente-app/11-toque-no-valor-android.webp` |
| Cabeçalho e barra fixos ocupam cerca de um terço da tela; toques em abas e prioridades escondidas sob a barra caem nela; abas e sub-abas não ficam fixas | iOS, Android | POA-15, IA-16, IA-17, EA-10, NA-24 | `img/po-app/49-aba-orcamento-ios.webp`, `img/narrador-app/51-f2-modo-narrador-area-util-ios.webp` |
| Faixa vazia de ~60 a 80 pt acima do cabeçalho | iOS | POA-46, NA-14 | `img/narrador-app/04-cronicas-ios.webp` |
| Corretor automático ligado no campo de nome ("PO" vira "PÔ") | iOS | POA-05 | `img/po-app/22-escolher-natureza-ios.webp`, `img/po-app/39-erro-nome-ios.webp` |
| "Criar crônica" e "Entrar com convite" no fim da lista, abaixo da dobra | iOS | NA-04 | `img/narrador-app/06-cronicas-botoes-fim-da-lista-ios.webp` |
| Ao voltar da ficha, a crônica volta ao topo e à aba Fichas | iOS | NA-25 | `img/narrador-app/59-f2-volta-da-ficha-aba-fichas-ios.webp` |
| Leitor de tela: steppers lidos em porcentagem ("1%" para 7); "Revogar", "Remover" e "Propor" fora da árvore | iOS | POA-03, NA-07, POA-02, NA-08 | `img/narrador-app/14-orcamento-bonus-16-ios.webp` |
| Fora da criação: o painel fixo do NPC deixa ~250 pt para a ficha; a ficha revelada do NPC abre vazia | iOS | POA-24, POA-40 | `img/po-app/89-npc-editar-espaco-ios.webp`, `img/po-app/142-jogador-npc-ficha-ios.webp` |

**Só no web**

| Problema | Configuração | IDs | Evidência |
|---|---|---|---|
| A página ganha rolagem horizontal ("Histórico" fora da tela). No app, o botão só sai cortado | 390 | POW-12, EW-12, IW-11, NW-27 | `img/iniciante-web/30-ficha-aberta-390.webp` |
| O selo "Em criação" do narrador vira "···" | 390 | NW-27 | `img/narrador-web/61-f2-sebastiao-topo-390.webp` |
| "Código copiado" aparece atrás da folha; "Compartilhar" falha sem Web Share API. No app, os dois funcionam | 390 e 1280 | NW-05, NW-06 | `img/narrador-web/23-convite-copiado-feedback-390.webp`, `img/narrador-web/35-compartilhar-390.webp` |
| Valor digitado só vale com Enter; Tab ou clique fora deixa o campo aberto | 1280 | EW-09 | `img/experiente-web/19-digitar-sem-confirmar-1280.webp` |
| Habilidades numa coluna só (a aba Ficha tem ~7 telas); a folha de convite ocupa a largura toda | 1280 | EW-11, NW-14 | `img/experiente-web/20-habilidades-livre-1280.webp`, `img/narrador-web/38-convite-1280.webp` |
| Depois de um F5, o "‹" do cabeçalho não volta | 390 e 1280 | IW-12 | `img/iniciante-web/15-voltar-390.webp` |
| "Ver orçamento" troca a aba sem rolar até ela. No Android, leva direto | 390 | EW-16 | `img/experiente-web/50-orcamento-bonus-390.webp` |
| Positivo: os três grupos de Atributos lado a lado com os contadores | 1280 | (I-W, E-W) | `img/experiente-web/60-criacao-pontos-atributos-1280.webp` |

**Nos dois (problema do fluxo)**

| Problema | Web | App |
|---|---|---|
| Ficha em criação reaberta cai em Jogo, sem estado | POW-01, EW-08, IW-04 | IA-04 |
| Lista sem estado; sem "entregar" na livre; sem saber o que acontece depois de concluir | POW-08, EW-06, IW-08, IW-13 | POA-10, EA-13, IA-13 |
| Devolução só visível no modo Criação | POW-09 | POA-35 |
| Narrador sem "devolver" quando a aprovação está desligada; Notas do Narrador privadas sem aviso | NW-24, NW-25 | NA-17, NA-18 |
| Mesa só com "Em criação", sem progresso; Orçamento só dentro da ficha | NW-20, NW-22, POW-11 | NA-19, POA-19, POA-20 |
| Ver a conta põe o narrador em edição | NW-21 | NA-27 |
| "Concluir criação" pelo menu sem confirmação | NW-26 | NA-22, POA-18 |
| "● Salvo" com alterações pendentes | EW-05, IW-01 | EA-04, IA-02 |
| "Salvar alterações" vira "Concluir criação" | EW-06, IW-02 | EA-06, IA-09 |
| Grupos de escolha sem título | POW-04, NW-01, EW-22, IW-07 | POA-01, NA-01, EA-08, IA-05 |
| Termos do jogo sem explicação | IW-06 | IA-06 |
| Mensagem errada no teto de 3 | EW-04, IW-03 | EA-05, POA-14 |
| "A conta fechou" com bônus por gastar; custo só depois | EW-07, IW-10 | EA-07, IA-12 |
| Avisos que ficam, que saem atrás da folha ou fora da tela | POW-24, EW-14, EW-15, IW-09, IW-15 | POA-11, POA-12, EA-01, EA-16, IA-10, IA-11 |
| "O que falta" escondido na 4ª aba | IW-05 | IA-18 |
| Disciplinas sem marcar as do clã | POW-23, EW-18, IW-16 | EA-09, IA-07 |
| Item de lista sobe por folha | EW-10, IW-22 | EA-12, IA-29 |
| FdV atual não acompanha a permanente | POW-20, EW-24, NW-23 | POA-16, EA-19, IA-23, NA-21 |
| Resumo "0 → 3" e fora de ordem | POW-19, EW-23, IW-23 | POA-08, EA-18, IA-22 |
| Painel "Criação de fichas" acima das abas | POW-32, NW-10 | POA-19, NA-03 |
| "Histórico" cortado no cabeçalho | POW-12, EW-12, IW-11 | POA-07, EA-25, IA-14 |
| Convite sem link nem instrução | NW-09 | NA-05 |
| "Nenhum Qualidade", "Comportamen/to" | POW-25, POW-26, EW-13, EW-25, IW-20, IW-21, NW-32 | POA-09, EA-28, IA-15, IA-28, NA-28 |

---

## 6. Personas

### 6.1 PO

| Tarefa | Web (PO-W; Chromium, 390 e 1280) | App (PO-A; iOS, 440 pt) |
|---|---|---|
| Narrador cria crônicas, regras e convites | Sem ajuda (jornada "Convite e entrada"). Modo e aprovação aparecem só depois, no topo da crônica, sem título | **Sem ajuda**, com dúvida real em "Desligada/Ligada" · ~36 toques (12 por crônica), 6 rolagens, 4 telas · **SEQ 5** |
| Vampiro livre, do convite à conclusão | **Com dificuldade** (390) · ~75 cliques, ~8 rolagens, 9 telas · **SEQ 4** | **Sem ajuda para criar; não concluiu "entregar"** · ~60 toques, ~12 rolagens, 3 telas + 5 folhas · **SEQ 5** |
| Vampiro por pontos, aprovação ligada, devolução e reenvio | **Com dificuldade** (1280) · ~110 cliques, ~15 rolagens, 11 telas · **SEQ 5** | **Com dificuldade** · ~95 toques, ~28 rolagens, 1 ficha + 9 folhas · **SEQ 3** |
| Outro sistema por pontos | Lobisomem, aprovação ligada (390): **com dificuldade** · ~95 cliques, ~12 rolagens, 8 telas · **SEQ 4** | Mago, aprovação desligada: **com dificuldade** · ~90 toques, ~26 rolagens, 1 ficha + 10 folhas · **SEQ 3** |
| Narrador conclui, revisa, devolve e aprova | Dentro das tarefas acima: concluir pelo menu em 1 toque, devolver com motivo, aprovar | **Com dificuldade** · livre: 3 toques e 1 rolagem; devolver: 6 toques e 2 rolagens; aprovar: 3 toques e 2 rolagens · **SEQ 4** |
| Jornadas v0 a v5 | SEQ médio **5** | SEQ de **3** (NPC; sessão, auditoria e transferência) a **6** (login, dados, conta) |

| Ponto de atrito | Web | App |
|---|---|---|
| Estado e próximo passo | "Criei a ficha… e agora? Está em Jogo, com tudo em 1. É para eu editar? Quem decide quando está pronta?" (POW-01) | "Salvei. E agora, o narrador sabe que eu terminei? A ficha não diz que está em criação." (POA-10) |
| "Concluir" que só salva | "Concluir… ah, era só salvar. E como eu aviso o narrador que terminei?" (POW-07) | Anotado sem citação: "Concluir" no Editar parece concluir a criação, mas só fecha a edição |
| Prioridades e mensagens | "Prioridade 7, 5, 3: entendi. 0/5, 5/5: o contador ajuda, mas é pequeno e cinza." O aviso "Escolha as prioridades…" continua depois de escolher (POW-24) | "Eu só marquei Físicos como primária. Quem escolheu Sociais secundária?" (POA-13) · "3 de 9 e ele diz que acabaram os 9? Ah, é o máximo de 3 na criação." (POA-14) |
| Folha de bônus (positivo) | "'Começaram os pontos de bônus': isso sim é claro." | "'Começaram os pontos de bônus': essa folha é ótima, eu não sabia que tinha acabado o básico." |
| Bônus sobrando | "Enviei com 4 pontos sobrando e ninguém me avisou." (POW-10) | Mago concluído com 2 pontos sobrando, sem aviso (POA-17) |
| Devolução | "O narrador devolveu? Onde? Ah, só no modo Criação." (POW-09) | Mesmo efeito: a ficha devolvida abre em Jogo e a lista diz "Sua ficha" (POA-35) |
| Revisão do narrador | "(narrador) Achei 'Concluir criação' no menu da ficha; foi um toque, sem conferir nada." | "Confira a conta... onde? Aqui só tem a ficha." (POA-20) · "Concluí sem querer? Não pediu confirmação." (POA-18) |
| Sistema | "Quais Dons eu posso pegar? O app não diz: preciso do livro." (POW-21) | O "+" da folha de item muda de altura entre itens; errou o toque duas vezes |
| Configuração | "Desligada/Ligada" sem dizer que é a aprovação (POW-04) | "Desligada... desligada o quê? Ah, deve ser a aprovação, porque o outro grupo é 'Por pontos / Livre'." (POA-01) |
| Layout | Na 390, a barra do topo transborda (POW-12) | Abas e prioridades escondidas sob a barra fixa não respondem ao toque (POA-15) |

Evidências: `img/po-web/32-ficha-livre-abre-390.webp` a `img/po-web/79-narrador-lobisomem-aprovada-390.webp`; `img/po-app/05-nova-cronica-ios.webp` a `img/po-app/80-devolvida-narrador-ios.webp`.

### 6.2 Narrador

A fase 1 foi feita numa crônica nova (N2 no web, N no app); a fase 2, com as fichas que os jogadores criaram, como N, em crônicas com a aprovação desligada.

| Tarefa | Web (N2 e N; 390 e 1280) | App (N; iOS, 402 pt) |
|---|---|---|
| Criar a crônica | **Sem ajuda** · 4 cliques, 0 rolagens, 3 telas · **SEQ 6** | **Sem ajuda** (1 rolagem para achar o botão) · 5 toques, 1 rolagem, 3 telas · **SEQ 6** |
| Escolher o modo de criação | **Com dificuldade** · 16 cliques, 6 rolagens, 2 telas · **SEQ 4** | **Com dificuldade** · 10 toques explorando (mínimo 2), 3 rolagens · **SEQ 3** |
| Gerar um convite | **Com dificuldade** · 12 cliques, 2 rolagens, 3 telas · **SEQ 4** | **Sem ajuda** · 8 toques explorando (mínimo 3), 1 rolagem · **SEQ 5** |
| Explorar a Mesa (vazia) | **Com dificuldade** · 14 cliques, 10 rolagens · **SEQ 3** | **Com dificuldade** · 10 toques, ~12 rolagens · **SEQ 3** |
| Fase 2: acompanhar a criação | **Com dificuldade** · ~34 cliques, ~10 rolagens, 10 telas · **SEQ 3** | **Com dificuldade** · ~20 toques, ~25 rolagens · **SEQ 3** |
| Fase 2: ajudar quem travou (ficha do iniciante) | **Com dificuldade** · 9 cliques, 2 rolagens · **SEQ 4** | **Com dificuldade** · ~14 toques, ~16 rolagens · **SEQ 2** |
| Fase 2: devolver uma ficha | **Não concluiu** (o caminho não existe) · 11 cliques, 2 rolagens · **SEQ 2** | **Não concluiu** · 9 toques, 2 rolagens · **SEQ 1** |
| Fase 2: concluir as outras | **Com dificuldade** · 18 cliques, 3 rolagens · **SEQ 5** | **Com dificuldade** · 3 toques pela barra; 4 toques e 3 rolagens pelo menu · **SEQ 4** |

| Ponto de atrito | Web | App |
|---|---|---|
| Configuração sem rótulo | "Desligada... Ligada... o quê? Ah, deve ser aprovação." · "Mexi, saí, voltei: sumiu. Não me avisou." (NW-01, NW-03) | "Como funciona: Desligada. Hã? Desligada e Por pontos marcados juntos? Isso é um interruptor geral ou um detalhe?" (NA-01) |
| Convite | "Copiei? Não apareceu nada." · "Dois convites iguais. Qual eu revogo? ... Foi, sem perguntar." (NW-05, NW-07, NW-08) | "Compartilhar: 'entre na crônica no TMS com o código...' — e o link? Meu jogador novato vai me perguntar 'que TMS?'." (NA-05) |
| Onde acompanhar | "Em jogo, arquivadas... e quem está fazendo ficha agora? Onde fica?" (NW-11) | "Mesa: em jogo ou arquivadas. E a ficha que o novato está montando agora, cai onde?" (NA-11) |
| Progresso e conta | "Em criação. Tá, mas em criação como? Falta o quê?" · "Onde foram os 15? Vou ter que fazer a conta na mão, como na ficha de papel." (NW-20, NW-22) | "Ah, aqui no Orçamento: 'A conta fechou'. Por que isso não está no cartão da Mesa?" · "Cadê o resumo de bônus? Tive que somar tudo de cabeça e ainda fiquei na dúvida se sobrou 1 ponto." (NA-19) |
| Ver a conta = editar | "Cliquei em Criação só para ver... opa, estou editando a ficha dele?" (NW-21) | Entrar no chip "Criação" já põe o narrador em edição (NA-27) |
| Erros do novato que o TMS não aponta | "Senhor vazio, fraqueza vazia, entregador com Recursos 3. Clássico de novato. Onde eu comento?" | "Brujah com Dominação 2? Isso é o primeiro erro que um novato comete, e o sistema que faz a conta por pontos deixou passar." (NA-20) · "Força de Vontade 4 de 7 numa ficha que acabou de nascer." (NA-21) |
| Devolver e dar retorno | "Devolver... não tem. Concluir, arquivar, torpor." · "Notas do Narrador. Ele vai ler isso? Vai saber que tem nota?" (NW-24, NW-25) | "(Depois de ler o código) A nota é só minha. O jogador nunca soube que eu pedi correção." (NA-17, NA-18; privacidade conferida no código) |
| Concluir | "Concluí pelo menu e... já foi? Nem perguntou." (NW-26) | Pela barra pede confirmação; pelo menu, não; os toasts divergem (NA-22, NA-23) |
| Layout | Na 390, o estado da ficha vira "···" e "Histórico" sai da tela (NW-27) | ~240 pt de ficha visível em 874 (NA-24); ao voltar, a crônica cai em Fichas, no topo (NA-25) |

Evidências: `img/narrador-web/25-modo-pontos-390.webp`, `img/narrador-web/59-f2-vampv4-mesa-cards-390.webp`, `img/narrador-web/67-f2-sebastiao-acoes-390.webp`; `img/narrador-app/10-cronica-criada-ios.webp`, `img/narrador-app/34-f2-v4-mesa-ios.webp`, `img/narrador-app/80-f2-bento-acoes-sem-devolver-ios.webp`.

### 6.3 Jogador experiente

Os dois deixaram as fichas por pontos sem concluir, porque o roteiro reservava a conclusão ao narrador; nos dois, salvar sem concluir só foi possível trocando para o modo Jogo.

| Tarefa | Web (J2; 1280 e 390) | App (J1; Android, Pixel 6) |
|---|---|---|
| Vampiro, criação livre | **Com dificuldade** (ambiente até 12:55; depois, sozinho, sem nenhuma conta na tela) · ≈95 cliques, ≈10 rolagens, 4 telas + 6 folhas · **SEQ 4** | **Sem ajuda**, com atritos de celular · ~112 toques, ~30 rolagens, 5 telas + 9 folhas · **SEQ 4** |
| Vampiro, por pontos | **Sem ajuda** (390, passada em 1280) · ≈115 cliques, ≈20 rolagens, 4 telas + 7 folhas · **SEQ 5** | **Com dificuldade** · ~125 toques, ~35 rolagens, 3 telas + ~12 folhas · **SEQ 5** |
| Terceiro sistema, por pontos | Mago (1280, passada em 390): **sem ajuda** · ≈100 cliques, ≈9 rolagens, 4 telas + 6 folhas · **SEQ 6** | Lobisomem: **com dificuldade** · ~120 toques e ~35 rolagens sem os acidentes (~230 e ~60 no total) · **SEQ 3** |

| Ponto de atrito | Web | App |
|---|---|---|
| Abertura e entrega | "Cadê a montagem? A tela de criação disse 'atributos você monta depois, na ficha', mas a ficha abriu como se eu fosse jogar." (EW-08; ficha reaberta, ver 4.2) | "E agora, como entrego para o narrador?" (EA-13) |
| "Salvo" | O cabeçalho diz "● Salvo" e o "Concluir" abre "Salvar 32 alterações?"; perder tudo ao fechar a aba é **suposto** (EW-05) | "O selo diz 'Salvo' mas tenho 33 alterações. Salvo o quê?" (EA-04) |
| Teto de 3 | "Usados? Gastei 3 de 13! Se eu não soubesse a regra do teto, ia achar que o contador está quebrado." (EW-04) | "Os 13 pontos já foram usados? Eu gastei 3!" (EA-05) |
| "A conta fechou" | "A conta fechou? Ainda tenho 15 de bônus. Um iniciante clicaria em Concluir e perderia os pontos." (EW-07) | "A conta fechou" com 15 de 15 restantes (EA-07) |
| Salvar sem concluir | "Quero salvar e mostrar ao narrador antes de travar. O botão de salvar sumiu; só achei trocando para 'Jogo'." (EW-06) | "Quero só salvar e mostrar ao narrador. Onde está o 'Salvar'?" (EA-06) |
| Aviso escondido | Fortitude sem saldo: o aviso sai atrás da folha, que fica aberta (EW-15) | "Aplicar... nada. Aplicar de novo... nada. Fechei: ah, o aviso estava atrás." (EA-01) |
| Itens de lista | "Atributo tem +/− na linha, Disciplina não. Para pôr 2 pontos em Potência foram cinco cliques." (EW-10) | "Disciplinas 3. Opa, eu pus 4 pontos. Ah, é o número de itens." (EA-17) |
| Digitar o valor | "Digitei 3 em Destreza, cliquei em Vigor, e Destreza continua um campo aberto com 3... está valendo ou não?" (EW-09) | "Tocar no número abre teclado... mas o teclado tampou o campo, estou digitando no escuro." (EA-11) |
| Diferenças de sistema | "No Vampiro eu tinha a lista de arquétipos; aqui tive de digitar 'Arquiteto' de memória." (EW-21) · "Paradigma é a primeira coisa que eu penso num mago... Escondido em 'Sobre', quase passei sem preencher." (EW-20) | "Adicionar Dom e... um campo vazio? Tenho que lembrar os Dons de Lupino de cabeça?" (EA-03) · "Dom nível 2 na criação, sem custo? Isso o livro não deixa." (EA-14) |
| Positivo | "Agora sim: a ficha já me diz que estou criando e quanto bônus tenho." | "'Começaram os pontos de bônus': isso sim é o momento certo de avisar." |

Evidências: `img/experiente-web/16-ficha-editar-1280.webp`, `img/experiente-web/46-pericias-mensagem-errada-390.webp`, `img/experiente-web/56-trocar-para-jogo-390.webp`; `img/experiente-app/09-ficha-criada-topo-android.webp`, `img/experiente-app/48-disciplina-estouro-android.webp`, `img/experiente-app/66-adicionar-dom-android.webp`.

### 6.4 Jogador iniciante

| Tarefa | Web (conta nova; 390 com comparação em 1280) | App (conta nova; iOS, 402 pt) |
|---|---|---|
| Cadastro do zero | **Sem ajuda** · 8 cliques, 0 rolagens, 3 telas · **SEQ 5** | **Sem ajuda** · ~11 toques, 0 rolagens, 3 telas · **SEQ 5** |
| Entrar pelo convite | **Sem ajuda** · 3 cliques, 2 telas · **SEQ 6** | **Sem ajuda** · 3 toques, 2 telas · **SEQ 6** |
| Criar a ficha por pontos (Vampiro) | **Com dificuldade** (com dois bloqueios de ambiente no caminho) · ~130 cliques, ~15 rolagens, 3 telas + 10 folhas · **SEQ 2** | **Com dificuldade** (refeita uma vez por perda) · ~200 toques, ~45 rolagens, 2 telas + ~15 folhas · **SEQ 2** |
| Sair e voltar no meio | **Com dificuldade** (perdeu os pontos no F5) · 6 cliques, 2 rolagens, 3 telas · **SEQ 3** | **Não concluiu** (fechar o app perdeu tudo) · ~4 toques para voltar e ~30 para refazer · **SEQ 2** |
| Depois de entregar | **Com dificuldade** · 9 cliques, 2 rolagens, 3 telas + 2 folhas · **SEQ 3** | **Com dificuldade** · ~10 toques, ~5 rolagens, 2 telas + 3 folhas · **SEQ 3** |

| Pergunta do roteiro | Web | App |
|---|---|---|
| Sabe por onde começar? | Na identidade, sim ("Comece pela identidade"). Na ficha, não: abriu em Jogo, com tudo em 1 | Na identidade, sim. Na ficha, não: página longa, sem passo a passo |
| Entende os termos? | Não. Clã, Natureza, Comportamento, Senhor, Disciplina, FdV e bônus sem explicação | Não. Escolheu quase tudo "no chute" |
| Sabe quantos pontos tem e onde gastar? | Por grupo, depois de escolher a prioridade; o custo do bônus só aparece depois de gastar | Igual |
| Sabe o que falta para terminar? | Só depois de achar a aba Orçamento | Só abrindo Orçamento "por curiosidade" |
| As mensagens dizem o que fazer? | Em parte: "13 usados" com 3/13 está errada; "use os pontos de bônus" não diz como | Em parte: erros fora da tela; criar sem clã e concluir com 9 de bônus não geram aviso |

| Ponto de atrito | Web | App |
|---|---|---|
| Grupo sem título e termos | "Essa lista de nomes esquisitos sem título, é pra escolher o quê? Raça? Time?" (IW-06, IW-07) | "Assamitas, Brujah, Tzimisce... são o quê? Raças? Times? Tenho que escolher uma?" (IA-05, IA-06) |
| "Salvo" e perda | "Perdi o que tinha feito. Mas o '7' ficou marcado... uma parte salva sozinha e outra não? E lá em cima dizia 'Salvo'!" (IW-01) | "Cadê meu clã? Cadê os pontos? Estava escrito 'Salvo' lá em cima o tempo todo!" (IA-01, IA-02) |
| Teto de 3 | "Como assim usei os 13? Diz 3 de 13 bem ali. Está errado ou eu não entendi nada?" (IW-03) | (não chegou ao teto nas notas) |
| Guia escondido | "Por que isso fica escondido numa aba chamada 'Orçamento'? Achei que era coisa de dinheiro." (IW-05) | "Isso aqui é o que eu precisava! Uma lista do que falta. Pena que estava escondido na última aba." (IA-18) |
| Bônus | "Gastou 5 de uma vez! Não sabia." (IW-10) | "A conta fechou, mas eu tenho 15 pontos de bônus sobrando. Tenho que gastar? Se concluir agora, perco?" (IA-08, IA-12) |
| Quem conclui | "Então sou eu que concluo? Meu amigo disse que ele ia olhar a ficha." (IW-08) | "Concluí! Mas... o narrador já recebeu? Tenho que mandar?" (IA-13) |
| Depois | "Peça ao narrador como? Mando mensagem no WhatsApp?" (IW-25) | "Por que minha Força de Vontade está 4 de 7 se eu acabei de criar? Fiz algo errado?" (IA-23) |

Evidências: `img/iniciante-web/21-nova-ficha-rolada-390.webp`, `img/iniciante-web/47-talento-acima-3-390.webp`, `img/iniciante-web/64-concluir-dialogo-390.webp`; `img/iniciante-app/21-criar-sem-cla-ios.webp`, `img/iniciante-app/40-ficha-reaberta-ios.webp`, `img/iniciante-app/72-apos-concluir-ios.webp`.

---

## 7. Consistência entre sistemas

O esqueleto é o mesmo nos três sistemas: identidade → ficha no modo Criação (abas Ficha, Vantagens, Sobre e Orçamento) → prioridades e contadores → folha de bônus → concluir. Nas palavras de E-A, "quem aprendeu no Vampiro fez o Lobisomem sem reaprender a parte de pontos". As diferenças abaixo separam o que vem da regra do jogo do que é inconsistência do TMS.

| Aspecto | Vampiro (V20) | Mago (M20) | Lobisomem (W20) | De onde vem | IDs e evidência |
|---|---|---|---|---|---|
| Campos da identidade | Natureza e Comportamento **com** "Escolher da lista", Conceito, Senhor, Clã | Natureza e Comportamento **sem** lista, Conceito, Casa (para qualquer Tradição), Tradição, Essência | Nome de feito, Conceito, Seita, Campo, Matilha, Totem, Raça, Augúrio, Tribo | Os campos vêm da regra. A lista só no Vampiro e a Casa para qualquer Tradição são **TMS** | EW-21, PO-A · `img/experiente-web/63-nova-ficha-mago-1280.webp` |
| Grupos de escolha sem título | Clã | Tradição, Essência | Raça, Augúrio e Tribo seguidos, separados só por espaço | **TMS** (o mesmo componente nos três; pior no W20) | EA-08 · `img/experiente-app/60-tribos-android.webp` |
| Orçamento | 7/5/3, 13/9/5, Disciplinas 3, Antecedentes 5, Virtudes 7, bônus 15 | 7/5/3, 13/9/5, Antecedentes 7, Esferas 6, bônus 15 | 7/5/3, 13/9/5, Dons 3, Antecedentes 5, bônus 15 | **Regra**, conferida com o livro | EW, EA, POA · `img/experiente-web/66-orcamento-mago-1280.webp` |
| Tetos e bloqueios | Habilidade até 3 nos básicos; Aparência 0 do Nosferatu | Esfera ≤ Arete; Arete ≤ 3 | Renome não se compra; Posto 0 → 1 livre | **Regra**. As mensagens são **TMS**: motivo errado no teto de 3 (V20 e W20); "acima do limite da criação" sem dizer o motivo (Mago) | EW-04, EA-05, POA-14 · `img/experiente-web/70-forcas-acima-arete-1280.webp` |
| Poderes | Disciplinas com catálogo e busca | Esferas fixas; a afinidade vem vazia, sem sugerir as da Tradição | Dons em texto livre; o "Posto" do Dom sobe sem custo nem aviso | **TMS**. Dons sem catálogo é decisão registrada na auditoria (licença) | EA-03, EA-14, EW-18, POW-21 · `img/experiente-app/77-dom-posto2-android.webp` |
| Ordem das Vantagens | Disciplinas, Antecedentes, Virtudes, Trilha, Fraqueza | Esferas, Ressonância, Antecedentes… ("não atrapalhou") | Renome, Dons, Ritos, Fetiches e, por último, Antecedentes | **TMS** (template) | EA, EW · `img/experiente-app/65-dons-antecedentes-android.webp` |
| Títulos repetidos | "Disciplinas 0/3" + "Disciplinas 0" | "7/7" duas vezes | "Dons, Dons, Dons" | **TMS** | EA-17, EW-29 · `img/po-web/74-adicionar-dom-390.webp` |
| Derivados | Humanidade e FdV pelas Virtudes; a FdV **atual** não acompanha a comprada | FdV 5; Quintessência = Avatar só depois de salvar (a roda mostra 0 durante a criação) | Fúria, Gnose e FdV pela identidade; as **atuais** não acompanham; a Fúria desce abaixo do Augúrio sem aviso na linha (no V20, o "−" da FdV derivada fica desabilitado) | Valores: **regra**. Atual e mínimo: **TMS** | EA-19, POW-20 · `img/experiente-app/63-furia-abaixo-auguro-android.webp` |
| Traço que define o personagem | Fraqueza do clã vem vazia | Foco (Paradigma, Prática, Instrumentos) na aba "Sobre", depois de tudo | Personagem novo nasce "Posto 0 · Filhote" (Cliath é **suposto**); forma Hominídeo para Lupino | **TMS** (template). A forma é decisão da auditoria | EW-31, EW-20, POW-28, EA-20 · `img/experiente-web/74-sobre-mago-1280.webp` |
| Ordem das listas | Arquétipos e Disciplinas na ordem do inglês | Antecedentes em ordem alfabética | — | **TMS** | EW-19, EA-22 · `img/experiente-web/22-adicionar-disciplina-1280.webp` |

**Conclusão.** A regra muda o conteúdo e o TMS a aplica certo nos três (orçamento, tetos, custos e derivados). As inconsistências estão em dados de template (catálogos, ordem, textos, valores iniciais) e no jeito como o motor trata o valor atual, o mínimo e o nível de um item. A diferença maior não é entre sistemas, é entre modos: a criação livre não tem contador nem barra de "Concluir criação", e a por pontos tem os dois (E-A; NA-23). Para o jogador, "parece outro produto" (E-W).

---

## 8. Aderência (PO)

Junta o PO web e o PO app. Quando o resultado muda entre as plataformas, a coluna "Consolidado" diz. "Sem teste" é jornada que nenhum dos dois cobriu.

**plano-v0 §1: ficha de Vampiro**

| Jornada | Web | App | Consolidado | O que difere do plano | Evidência |
|---|---|---|---|---|---|
| §1.1 Criar conta e entrar | ok (só entrar) | ok (só entrar) | ok | O cadastro foi coberto pelos iniciantes, sem ajuda (IW e IA, tarefa 1) | `img/po-web/01-cronicas-vazia-390.webp`, `img/po-app/03-cronicas-vazia-ios.webp` |
| §1.2 Narrador cria crônica e convite | ok | ok | ok | Modo e aprovação ficam depois, no topo da crônica, sem título (POW-04, POA-01) | `img/po-web/10-convite-gerado-390.webp`, `img/po-app/11-convite-gerado-ios.webp` |
| §1.3 Jogador entra com o código | ok | ok | ok | 26 caracteres digitados no celular, sem link | `img/po-web/12-jogador-entrou-vlivre-390.webp`, `img/po-app/20-entrou-cronica-ios.webp` |
| §1.4 Identidade pelo formulário do template | parcial | parcial | parcial | Sem Geração no formulário (derivada do Antecedente, escolha registrada na auditoria); Clã sem título | `img/po-web/18-jogador-nova-ficha-vlivre-390.webp`, `img/po-app/21-nova-ficha-vampiro-ios.webp` |
| §1.5 Ficha abre em Evoluir; salvar grava um lote | parcial: abre em Jogo (não provado, ambiente); o NPC abre em Editar; lote ok | ok: abre em Editar ou Criação; lote ok | parcial; **muda entre plataformas** pelo ambiente | O modo se chama "Editar" ou "Criação", não "Evoluir"; o botão "Concluir" salva (POW-07); reaberta, cai em Jogo nos dois (IA-04) | `img/po-web/81-npc-criado-1280.webp`, `img/po-app/24-ficha-criada-livre-ios.webp` |
| §1.6 Leitura, Jogo, abas e dock | ok | ok | ok | Topo transborda na 390 (POW-12); "Histórico" cortado no iOS (POA-07) | `img/po-web/32-ficha-livre-abre-390.webp`, `img/po-app/34-jogo-livre-topo-ios.webp` |
| §1.7 Gastar, dano, cura, despertar, desfazer, offline | parcial (offline ok; sem gasto nem cura de Sangue) | parcial (toast "Sangue — → 9": regressão, POA-30; offline sem teste) | parcial; a regressão do "—" foi vista só no app, porque o web não fez gasto de Sangue | O plano v0 dá o "—" como corrigido | `img/po-web/112-offline-gasto-390.webp`, `img/po-app/154-sangue-gasto-ios.webp` |
| §1.8 Mesa, edição assinada, Notas do Narrador | ok | ok | ok | No iPhone em retrato, o narrador só abre o Histórico por uma fresta de 8 a 18 pt (POA-07) | `img/po-web/98-jogador-historico-1280.webp`, `img/po-app/104-historico-narrador-ios.webp` |
| §1.9 Parada: Atributo + Habilidade, dificuldade, FdV | ok | ok | ok | Rótulos "Dados" e "Dificuldade" só no leitor de tela (POA-28) | `img/po-web/111-lobisomem-dados-crinos-390.webp`, `img/po-app/156-rolagem-forca-briga-ios.webp` |

**plano-v1 §1: Mago**

| Jornada | Web | App | Consolidado | O que difere do plano | Evidência |
|---|---|---|---|---|---|
| §1.1 a §1.8 (sistema, ficha, Arete, roda, conjurar) | sem teste (fora do escopo do PO-W) | parcial | parcial (só app) | Criação ok; na criação por pontos, Esfera acima do Arete é **bloqueada** (o plano fala do Editar); Paradoxo e Conjurar não testados. No web, a criação de Mago foi feita pelo E-W, sem ajuda (SEQ 6) | `img/po-app/66-esfera-acima-arete-ios.webp`, `img/experiente-web/73-esferas-final-1280.webp` |

**plano-v2 §1: Lobisomem**

| Jornada | Web | App | Consolidado | O que difere do plano | Evidência |
|---|---|---|---|---|---|
| §1.1 Crônica entre os três sistemas | ok | sem teste | ok | — | `img/po-web/02-nova-cronica-390.webp` |
| §1.2 Identidade W20 | ok, com sobra | sem teste | ok, com sobra | Também pede Campo, Nome da matilha e **Posto** (o plano diz que o Posto não entra); Raça, Augúrio e Tribo sem título | `img/po-web/24-nova-ficha-lobisomem-390.webp` |
| §1.3 Editar W20 (Fúria, Gnose, Renome, Dons) | ok | sem teste | ok | Na v4, virou o modo Criação; Dons só por nome (POW-21) | `img/po-web/71-lobisomem-criacao-390.webp` |
| §1.4 a §1.6 Crinos, grade efetiva, Força + Briga, Teste de Fúria | ok | sem teste | ok | O toast é mais curto que o do plano e cobre o dock; "Força de Vontade" aparece entre os Atributos | `img/po-web/110-lobisomem-crinos-390.webp` |
| §1.7 Regenerar | parcial (só o motivo "Nada a curar") | sem teste | parcial | — | `img/po-web/122-lobisomem-acoes-regenerar-390.webp` |
| §1.8 Narrador vê a forma na Mesa | sem teste | sem teste pelo PO | ok (visto pelo N-A: o cartão mostra Fúria e Forma) | — | `img/narrador-app/68-f2-lobisomem-v4-mesa-ios.webp` |
| §1.9 Offline | parcial (gasto de Fúria) | sem teste | parcial | — | `img/po-web/113-online-sincronizado-390.webp` |

**plano-v3 §1: Mesa do narrador**

| Jornada | Web | App | Consolidado | O que difere do plano | Evidência |
|---|---|---|---|---|---|
| §1.2 Narrador conclui a criação | ok | ok | ok | Pelo menu, sem confirmação e sem volta (POA-18) | `img/po-web/45-concluir-criacao-confirmacao-390.webp`, `img/po-app/75-confirmar-concluir-livre-ios.webp` |
| §1.3 Dano em grupo e desfazer | ok | ok | ok | No app, o "Desfazer" some em ~5 s e a seleção fica longe dos botões (POA-26) | `img/po-web/86-dano-aplicado-snackbar-1280.webp`, `img/po-app/95-dano-aplicado-toast-ios.webp` |
| §1.4 Travar | ok | ok | ok | A caixa "Gastar 1 FdV" continua habilitada (POW-33) | `img/po-web/107-jogador-rola-travada-1280.webp`, `img/po-app/131-travada-rolar-fdv-ios.webp` |
| §1.5 Remover jogador, "Você saiu", Leitura | ok | ok | ok | Prevenção em vez de recusa; no app, o toast diz "saiu" para uma remoção (POA-44) | `img/po-web/115-ex-membro-voce-saiu-390.webp`, `img/po-app/148-remover-jogador-ios.webp` |
| §1.6 Outro jogador não vê a ficha alheia | sem teste | sem teste | sem teste | Só uma conta de jogador por PO | — |

**plano-v4 §1: criação por pontos e XP**

| Jornada | Web | App | Consolidado | O que difere do plano | Evidência |
|---|---|---|---|---|---|
| §1.1 Ligar a aprovação e convidar | ok | ok | ok | Rádio "Desligada/Ligada" sem título | `img/po-web/16-aprovacao-ligada-salva-390.webp`, `img/po-app/09-regras-salvas-ios.webp` |
| §1.2 Criação pela identidade, no modo por pontos | parcial (abre em Jogo) | ok (abre em Criação) | parcial; **muda entre plataformas** (ambiente na primeira abertura do web; reaberta, cai em Jogo nos dois) | — | `img/po-web/46-ficha-pontos-abre-1280.webp`, `img/po-app/40-ficha-pontos-criada-ios.webp` |
| §1.3 Prioridades e contadores por grupo | ok | ok | ok, com atritos | POW-24, POA-12, POA-13, POA-14 | `img/po-web/48-criacao-prioridades-1280.webp`, `img/po-app/41-prioridades-ios.webp` |
| §1.4 Concluir com grupo incompleto é recusado no grupo | diferente | diferente | parcial (diferente do plano) | O botão só aparece com a conta fechada: o TMS previne em vez de recusar; "O que falta" fica na aba Orçamento | `img/po-web/55-aba-orcamento-1280.webp`, `img/po-app/50-orcamento-o-que-falta-ios.webp` |
| §1.5 Pontos restantes e bônus; salvar; sincronizar | ok | ok | ok | Resumo com "de" vazio ou errado (POW-19, POA-08) | `img/po-web/59-bonus-gastos-orcamento-1280.webp`, `img/po-app/58-bonus-esgotado-ios.webp` |
| §1.6 Conclui; `pending`; jogador não altera | ok | ok | ok | Bônus sobrando sem aviso (POW-10, POA-17) | `img/po-web/61-enviada-pendente-1280.webp`, `img/po-app/60-aguardando-aprovacao-ios.webp` |
| §1.7 Narrador aprova; `active` | ok | ok | ok, com atritos | Web: a Mesa não mostra o pendente (POW-11). App: sem Orçamento em `pending` e aviso a duas rolagens (POA-19, POA-20) | `img/po-web/69-aprovar-ficha-1280.webp`, `img/po-app/134-aprovada-ios.webp` |
| §1.8 Conceder XP ao grupo, com motivo | ok | ok | ok | Stepper de +1 sem campo (POW-18, POA-22) | `img/po-web/89-conceder-xp-1280.webp`, `img/po-app/83-conceder-xp-ios.webp` |
| §1.9 Saldo e pedido com custo antes de enviar | parcial | parcial | parcial | A confirmação fica fora da tela, depois de ~60 opções (POW-17, POA-36) | `img/po-web/92-confirmar-pedido-1280.webp`, `img/po-app/123-pedido-fim-lista-ios.webp` |
| §1.10 Aprovar: traço sobe, gasto e extrato | ok | ok | ok | Aviso do pedido ao narrador: ver a contradição em 4.2 (POA-39) | `img/po-web/95-xp-aprovado-1280.webp`, `img/po-app/137-xp-aprovado-ios.webp` |
| §1.11 Pedido sem saldo recusado no envio | ok | ok | ok | O botão fica ativo apesar do aviso (POW-33, POA-37) | `img/po-web/93-pedido-sem-saldo-1280.webp`, `img/po-app/126-pedido-recusado-ios.webp` |
| §1.12 Outro jogador sem dados | sem teste | sem teste | sem teste | — | — |
| Complementos: devolução, livre autorizado, orçamento por ficha | parcial | parcial | parcial | A devolução funciona, mas o jogador só vê o motivo no modo Criação (POW-09, POA-35); orçamento por ficha não testado | `img/po-web/64-devolver-dialogo-1280.webp`, `img/po-app/79-devolver-ios.webp` |

**plano-v5 §1: Bastidores**

| Jornada | Web | App | Consolidado | O que difere do plano | Evidência |
|---|---|---|---|---|---|
| §1.1 NPC nasce oculto e livre; o jogador não vê | ok | ok | ok | Visto na tela e na contagem, não no corpo das respostas | `img/po-web/80-novo-npc-1280.webp`, `img/po-app/86-criar-npc-ios.webp` |
| §1.2 NPC concluído, na seção própria da Mesa, em operações | parcial | parcial | parcial | Entra no dano em grupo e na Nova noite, mas **sem seção própria** nem selo (POW-16, POA-25) | `img/po-web/83-mesa-selecionar-1280.webp`, `img/po-app/92-mesa-com-npc-ios.webp` |
| §1.3 Rolagem oculta pelo NPC e pela ficha do jogador | parcial (só a da ficha do jogador) | ok (as duas) | ok, somando as plataformas | O dono não vê a rolagem | `img/po-web/97-rolagem-oculta-narrador-1280.webp`, `img/po-app/103-resultado-npc-oculta-ios.webp` |
| §1.4 Parada livre oculta por padrão; reenvio idempotente | parcial | parcial | parcial | Idempotência não testável pela tela | `img/po-web/31-parada-livre-resultado-1280.webp`, `img/po-app/100-parada-livre-oculta-ios.webp` |
| §1.5 Revelar só a identidade | ok | ok | ok | Sem confirmação (POA-31); no app, o "‹" volta para Crônicas (POA-38) | `img/po-web/100-jogador-ve-npc-identidade-1280.webp`, `img/po-app/127-jogador-ve-npc-identidade-ios.webp` |
| §1.6 Revelar a ficha: `viewer` em Leitura, sem notas | ok | **falta**: a ficha abre vazia no iOS (POA-40; causa suposta) | parcial; **muda entre plataformas** | — | `img/po-web/102-jogador-npc-ficha-completa-1280.webp`, `img/po-app/142-jogador-npc-ficha-ios.webp` |
| §1.7 Voltar a oculto: perde o acesso | ok | ok | ok | — | `img/po-web/103-jogador-npc-ocultado-1280.webp`, `img/po-app/150-ex-membro-lista-ios.webp` |
| §1.8 Outro jogador e ex-membro não veem o NPC | sem teste | ok (ex-membro) | ok (só app) | — | `img/po-app/151-ex-membro-cronica-ios.webp` |
| P2: sessão com resumo e nota privada | parcial | parcial | parcial | A nota privada não vaza, mas a data sai como "Sat Oct 31 2026 21:00:00 GMT-0300", um dia antes (POW-13, POA-33); no app, editar a sessão falha com 400 (POA-33); "última sessão" não aparece na lista (POW-30) | `img/po-web/104-bastidores-sessao-auditoria-1280.webp`, `img/po-app/111-sessao-registrada-ios.webp` |
| P2: editar nome e descrição | sem teste | sem teste | sem teste | A tela "Apresentação" existe | — |
| P2: auditoria paginada | parcial | parcial | parcial | Lista códigos internos, sem a ficha nem o que mudou (POW-06, POA-32) | `img/po-app/110-bastidores-ios.webp` |
| P2: transferência com aceite | parcial | parcial | parcial | Funciona no servidor; o convite fica escondido no Diário e a tela não atualiza depois de aceitar (POW-14, POW-15, POA-41, POA-42) | `img/po-web/119-jogador-diario-proposta-1280.webp`, `img/po-app/145-narracao-aceita-ios.webp` |
| Painel do narrador §5.1 a §5.11 | parcial | parcial | parcial | Ok em estados, membros, grupo e reversão, rolagens; com ressalvas em criação, XP, NPC, sessões e auditoria (ver linhas acima) | — |

**O que sobra** (está na tela e não está em plano): "Escolher da lista" para Natureza e Comportamento, a folha "Começaram os pontos de bônus" e o "O que falta" da aba Orçamento **ajudam** e deveriam entrar no plano (PO-W). A alternância "Pontos básicos / Pontos de bônus" da aba Orçamento **atrapalha um pouco**, porque a folha automática já faz o papel (PO-W). "Editar como narrador" e o rádio "Editar" convivem e **atrapalham** (PO-W, NA-27). Pesa mais do que o plano previa a **posição** de três blocos no celular: o painel "Criação de fichas" no topo da crônica, o painel fixo do NPC e a folha de bônus que reaparece ao tirar um ponto (PO-A).

---

## 9. Recomendações priorizadas

Só entram recomendações que resolvem causas do §1. Nenhuma remove campo, muda regra ou afrouxa limite (prioridades, pontos por categoria, pontos de bônus): onde há aviso, ele não bloqueia nem libera nada que a regra proíbe. O **esforço** é estimativa do consolidador, sem leitura de código, na escala de `doc/avaliacao-ui-ux.md`: P (até 1 dia), M (alguns dias), G (uma sprint ou mais). Nas linhas do tipo **bug**, a coluna de IDs traz o cruzamento com o QA web quando há achado equivalente.

**Escopo:** **genérica** serve a qualquer sistema, inclusive D&D 5e ou Call of Cthulhu; **de template** depende dos dados do sistema; **de skin** é só visual de um sistema. Nenhuma recomendação é só de skin: os problemas estão no fluxo e nos dados, não no visual do WoD.

### Prioridade 1: impacto alto, esforço P

| # | Recomendação | Causa | Quem sofre | Tipo | Impacto × esforço | Escopo e como generaliza | IDs e evidência |
|---|---|---|---|---|---|---|---|
| R-01 | Título visível em todo grupo de escolha e em todo stepper: mostrar o `label` do `Choice` ("Aprovação do narrador", "Modo de criação", "Sistema", "Clã", "Raça", "Augúrio", "Tribo", "Tradição", "Essência") e do stepper ("Dados", "Dificuldade") | C3 | 8 de 8; I-A criou a ficha sem clã | clareza | alto × P | **Genérica.** O rótulo já vem do template: "Classe" no D&D 5e ou "Ocupação" no Call of Cthulhu aparecem sem código novo | POW-04, POA-01, NW-01, NA-01, NA-09, EW-22, EA-08, IW-07, IA-05, POA-28 · `img/narrador-app/10-cronica-criada-ios.webp`, `img/iniciante-app/21-criar-sem-cla-ios.webp` |
| R-02 | A ficha em criação abre sempre no modo de montagem (Criação ou Editar), não só na primeira abertura, e volta para a aba onde a pessoa parou | C1 | PO-W, E-W, I-W, I-A | orientação | alto × P | **Genérica.** Depende só do estado `creating`, que é do core | POW-01, EW-08, IW-04, IA-04 · `img/iniciante-app/40-ficha-reaberta-ios.webp`, `img/iniciante-web/30-ficha-aberta-390.webp` |
| R-03 | Indicador de salvamento verdadeiro: "N alterações não salvas" no lugar de "● Salvo" enquanto houver rascunho; o mesmo modelo para prioridade e pontos (os dois no rascunho ou os dois gravados na hora) | C2 | E-W, E-A, I-W, I-A; N-W na edição do narrador | feedback | alto × P | **Genérica.** O rascunho é uma lista de alterações por caminho, igual em qualquer sistema | EW-05, EA-04, IW-01, IA-02, IA-03, NW-31 · `img/iniciante-web/37-fisicos-distribuidos-390.webp`, `img/iniciante-app/25-cla-escolhido-ios.webp` |
| R-04 | "Salvar" sempre disponível na criação, ao lado de "Concluir criação" e de "Enviar para aprovação"; "Salvar e sair" no aviso "Sair sem salvar?" | C2 | E-W, E-A, I-W, I-A | simplificação | alto × P | **Genérica.** Vale para qualquer criação em etapas | EW-06, EA-06, IW-02, IA-09 · `img/iniciante-web/58-sair-com-pendencias-390.webp`, `img/experiente-app/55-trocar-para-jogo-android.webp` |
| R-05 | Um verbo por ação: o botão do modo Editar passa a "Salvar alterações" (como já é no modo Criação), e "Concluir" fica só para concluir a criação | C2, C1 | PO-W, PO-A, N-W, I-W, I-A | clareza | alto × P | **Genérica.** É microcopy do esqueleto da ficha | POW-07, NW-31; I-W e I-A no diário da tarefa 5 · `img/po-web/40-concluir-resumo-390.webp`, `img/iniciante-web/71-editar-pos-conclusao-390.webp`, `img/iniciante-app/79-editar-apos-concluir-ios.webp` |
| R-06 | Mensagem certa para cada motivo de recusa: teto por traço ("Na criação, com pontos básicos, cada Habilidade vai até 3; o 4º ponto custa 2 de bônus") separado de orçamento do grupo; e "use os pontos de bônus" com um link para o seletor | C4 | PO-A, E-W, E-A, I-W | **bug** | alto × P | **Genérica** na mensagem; o teto e o custo vêm do **template**. O point buy do D&D 5e também tem teto por atributo e orçamento total | POA-14, EW-04, EA-05, IW-03, EW-16 · `img/experiente-web/46-pericias-mensagem-errada-390.webp`, `img/experiente-app/45-habilidade-max3-android.webp` · QA web: sem achado equivalente |
| R-07 | Enquanto houver saldo, o Orçamento diz "Pontos básicos completos; restam 15 de bônus" no lugar de "A conta fechou"; a barra diz "Bônus: restam N de 15"; a confirmação de concluir ou enviar avisa "Sobram N pontos de bônus", sem bloquear | C4 | E-W, E-A, I-W, I-A; PO-W, PO-A (sobra); N-W, N-A ("0 de 15") | clareza | alto × P | **Genérica.** Qualquer orçamento com fase de bônus ou pontos livres tem saldo a avisar | EW-07, EA-07, IW-10, NW-22, NA-26, POW-10, POA-17, IA-08 · `img/iniciante-app/62-ver-orcamento-ios.webp`, `img/iniciante-app/65-concluir-com-sobra-ios.webp` |
| R-08 | Devolução visível ao jogador: banner "O narrador devolveu a ficha" com o motivo em qualquer modo e selo "Devolvida" na lista da crônica | C1 | PO-W e PO-A, lado do jogador | feedback | alto × P | **Genérica.** A devolução é do ciclo de vida da ficha, não do sistema | POW-09, POA-35 · `img/po-web/66-jogador-ficha-devolvida-1280.webp`, `img/po-app/118-jogador-criacao-devolvida-ios.webp` |
| R-09 | No editor da ficha, rótulo "Notas do Narrador (privadas: o jogador não vê)". *Segurança:* a correção é o rótulo e um canal separado (R-14); as notas continuam fora do aparelho do jogador, como hoje (NA-17 conferiu no código) | C1 | N-W, N-A | clareza | alto × P | **Genérica.** Toda ficha de qualquer sistema tem as mesmas Notas do Narrador | NW-25, NA-17 · `img/narrador-app/47-f2-teodoro-notas-narrador-ios.webp`, `img/narrador-web/75-f2-tiago-notas-narrador-390.webp` |
| R-10 | Uma linha de efeito sob cada opção da "Criação de fichas" (o que o jogador vê em Livre ou Por pontos; o que a aprovação trava e quando o narrador age) e o modo com o resumo do orçamento na crônica e na Nova ficha ("Por pontos · 7/5/3 · 13/9/5 · 15 de bônus · aprovação desligada") | C3, C1 | N-W, N-A, PO-A na configuração; E-W, E-A, I-W, I-A na Nova ficha | clareza | alto × P | **Genérica.** O resumo é montado a partir do orçamento do template; no Call of Cthulhu seria "pontos de ocupação e de interesse pessoal" | NW-02, NA-01, NA-02, NW-19, EW-01, EA-21 · `img/narrador-web/33-nova-ficha-ok-390.webp`, `img/experiente-app/35-nova-ficha-pontos-android.webp` |
| R-11 | A mesma confirmação de "Concluir criação" no menu do narrador e na barra, com o mesmo texto, escrito para quem lê (narrador ou jogador) | C1 | PO-W, PO-A, N-W, N-A | feedback | médio × P | **Genérica** | POA-18, NW-26, NA-22, NA-23 · `img/narrador-app/78-f2-vasco-concluir-confirmacao-ios.webp`, `img/narrador-web/85-f2-tiberio-1s-apos-concluir-sem-confirmacao-1280.webp` |

### Prioridade 2: impacto alto, esforço M

| # | Recomendação | Causa | Quem sofre | Tipo | Impacto × esforço | Escopo e como generaliza | IDs e evidência |
|---|---|---|---|---|---|---|---|
| R-12 | Estado da ficha em todo lugar: selo "Em criação · livre", "Em criação · por pontos", "Aguardando aprovação", "Devolvida" ou "Concluída em dd/mm" sob o nome (em qualquer modo e largura), na lista da crônica (jogador e narrador), na aba Fichas e na Mesa; evento "criação concluída" no Histórico | C1 | 8 de 8 | orientação | alto × M | **Genérica.** O ciclo `creating` → `pending` → `active` é do core; uma ficha de D&D 5e em criação mostraria o mesmo selo | POA-10, EA-13, IW-08, IW-13, IA-04, IA-13, NW-27, NW-28, POW-11 · `img/iniciante-web/73-cronica-pos-conclusao-390.webp`, `img/narrador-web/69-f2-tiberio-leitura-390.webp` |
| R-13 | Próximo passo explícito, por modo da crônica. Livre: "o narrador conclui quando você terminar", com "Avisar que terminei". Por pontos sem aprovação: "você conclui; depois disso, subir um traço passa pelo narrador". Com aprovação: "Enviar para aprovação". O narrador recebe o aviso de "terminei" como já recebe o de revisão | C1 | PO-W, PO-A, E-W, E-A na livre; I-W, I-A sem aprovação | orientação | alto × M | **Genérica.** Os três modos são configuração da crônica, não do sistema | POW-08, POA-10, EA-13, EW-06, IW-08, IA-13 · `img/po-web/42-acoes-da-ficha-jogador-livre-390.webp`, `img/iniciante-app/72-apos-concluir-ios.webp` |
| R-14 | "Pedir ajuste" com motivo em qualquer ficha em criação, mesmo com a aprovação desligada; estado "Aguardando ajuste" na Mesa; o motivo chega ao jogador como na devolução (R-08). Depois, avaliar "Reabrir criação" para ficha concluída. *Segurança:* a ação é só do narrador da crônica, validada no servidor como as demais ações do narrador | C1 | N-W, N-A (não concluíram) | orientação | alto × M | **Genérica** | NW-24, NA-18 · `img/narrador-web/67-f2-sebastiao-acoes-390.webp`, `img/narrador-app/80-f2-bento-acoes-sem-devolver-ios.webp` |
| R-15 | Progresso da criação para o narrador sem abrir a ficha: no cartão da Mesa, "Atributos ✓ · Habilidades: faltam 4 · Bônus: restam 2 de 15" (ou "conta fechada"), filtro "Em criação / Pendentes" e contagem na lista de crônicas; dentro da ficha, o Orçamento em leitura para o narrador (inclusive em `pending`), sem entrar em modo de edição | C1 | N-W, N-A, PO-W, PO-A | orientação | alto × M | **Genérica.** Os rótulos dos grupos vêm do orçamento do template | NW-20, NA-19, POW-11, POA-19, POA-20 · `img/narrador-app/34-f2-v4-mesa-ios.webp`, `img/po-app/78-narrador-criacao-pendente-sem-orcamento-ios.webp` |
| R-16 | Rascunho persistido no aparelho a cada alteração, com "Você tem N alterações não salvas: recuperar?" ao reabrir. *Segurança:* o rascunho guarda só a ficha, sem token nem credencial, e é apagado no logout | C2 | I-A, I-W, E-A (perderam trabalho) | **bug** | alto × M | **Genérica.** A fila de alterações é por caminho e não depende do tipo de campo | IA-01, EA-04, IW-01 · `img/iniciante-app/40-ficha-reaberta-ios.webp`, `img/experiente-app/73-criacao-apos-reabrir-android.webp` · QA web: QAW-21 ("Salvo" com rascunho que só vive no aparelho), QAW-33 (logout offline descarta pendências sem aviso) |
| R-17 | Custo antes de gastar e extrato do bônus: na fase de bônus, o "+" mostra o custo ("+1 = 5 bônus"); o Orçamento lista o que foi comprado e quanto custou, inclusive descontos como Coragem × FdV; o extrato fica na ficha concluída, em leitura | C4 | I-W, I-A (custo); E-W, E-A, N-W, N-A (extrato) | feedback | alto × M | **Genérica.** Os custos vêm do template; o mesmo extrato serve a qualquer compra com pontos | IW-10, IA-12, EW-17, EA-07, NW-22, NW-29 · `img/iniciante-web/60-bonus-destreza-390.webp`, `img/experiente-web/54-orcamento-final-390.webp` |
| R-18 | "O que falta" sempre à vista: resumo na barra de criação ("Faltam: Virtudes 7, Disciplinas 3"), itens tocáveis que levam ao grupo e a aba com um nome que o iniciante entenda (por exemplo, "Pontos") | C5 | I-W, I-A, E-A, PO-A | orientação | alto × M | **Genérica.** A lista é gerada do orçamento do template | IW-05, IA-18, POA-15 · `img/iniciante-web/41-orcamento-390.webp`, `img/iniciante-app/27-orcamento-ios.webp` |
| R-19 | Ajuda contextual: um "?" por campo, traço e opção de lista, com uma frase curta vinda do template (por exemplo, "Senhor: quem transformou seu personagem"), sem copiar texto protegido; na primeira vez, explicar "Prioridade" ("quantos pontos este grupo recebe; cada valor vale para um grupo") e "pontos de bônus" | C3 | I-W, I-A | clareza | alto × M (mecanismo P; textos M por sistema) | **Genérica** no mecanismo; **de template** nos textos. Cada sistema traz o próprio glossário, respeitando a licença | IW-06, IA-06, IW-09 · `img/iniciante-app/19-lista-natureza-ios.webp`, `img/iniciante-web/33-criacao-atributos-390.webp` |

### Prioridade 3: impacto médio

| # | Recomendação | Causa | Quem sofre | Tipo | Impacto × esforço | Escopo e como generaliza | IDs e evidência |
|---|---|---|---|---|---|---|---|
| R-20 | Avisos onde o toque aconteceu e que somem quando a causa some: dentro da folha que recebeu o toque ("Aplicar", escolher item), perto do botão (não abaixo da dobra), "+" desabilitado com o motivo ao lado, recusa recalculada a cada mudança; "Criar ficha" rola e foca o primeiro campo com erro | C4 | E-A, E-W, I-A (aviso escondido); 6 de 6 (aviso velho); PO-A, I-W, I-A (erro do nome) | feedback | médio × M | **Genérica** | EA-01, EW-15, IA-10, POW-24, POA-12, EA-16, EW-14, IW-09, IA-11, POA-11, IW-15 · `img/experiente-app/49-disciplina-apos-fechar-android.webp`, `img/po-app/43-prioridade-fisicos-ios.webp` |
| R-21 | Resumo "Salvar/Concluir N alterações?" na ordem da ficha, agrupado por seção, com o valor de partida efetivo (default e derivados) e o caminho ("Talentos › Consciência") | C4 | PO-W, PO-A, E-W, E-A, I-W, I-A | **bug** | médio × P | **Genérica.** O caminho e a ordem vêm das seções do template | POW-19, POA-08, EW-23, EA-18, IW-23, IA-22 · `img/po-app/32-concluir-edicao-ios.webp`, `img/experiente-web/28-concluir-1280.webp` · QA web: QAW-39 (lista fora de ordem) |
| R-22 | Na criação, o valor atual dos recursos com permanente e atual (FdV, Gnose, Fúria) acompanha o permanente até o jogador mexer nele. Não muda regra: a ficha nova começa cheia, como os narradores esperavam | C4 | PO-W, PO-A, E-W, E-A, I-A; N-W e N-A na revisão | **bug** | médio × P | **Genérica.** Vale para qualquer recurso com máximo e atual, como os PV do D&D 5e | POW-20, POA-16, EW-24, EA-19, IA-23, NW-23, NA-21 · `img/narrador-app/35-f2-v4-mesa-cards-ios.webp`, `img/po-app/57-fdv-bonus-ios.webp` · QA web: sem achado equivalente |
| R-23 | No celular: abas e sub-abas fixas junto da barra de criação, contador do grupo fixo, cabeçalho que recolhe ao rolar, "Adicionar especialização" compacto, "Histórico" e "Experiência" no ⋯ em telas estreitas, bloco "Em jogo" recolhido no modo Criação | C5 | PO-A, E-A, I-A, N-A; PO-W, E-W, I-W, N-W ("Histórico" na 390) | layout | médio × M | **Genérica.** O esqueleto da ficha é o mesmo para qualquer sistema | POA-15, EA-10, IA-16, IA-17, NA-24, POA-07, EA-25, IA-14, POW-12, EW-12, IW-11, NW-27, EW-28, IA-30 · `img/iniciante-app/48-habilidades-ios.webp`, `img/po-web/32-ficha-livre-abre-390.webp` |
| R-24 | Teclado no Android: a folha sobe com o teclado, a tela rola até o campo focado e há "Próximo" entre campos | C5 | E-A | layout | médio × P | **Genérica** | EA-02, EA-11 · `img/experiente-app/25-fraqueza-teclado-android.webp`, `img/experiente-app/58-lobisomem-teclado-android.webp` |
| R-25 | −/+ na própria linha dos itens de lista com valor (Disciplinas, Antecedentes, Dons); a folha fica para nome, especialização e notas; um título e um contador em pontos por seção ("Disciplinas 3/3", não "Disciplinas 0/3 · Disciplinas 0") | C5, C4 | PO-A, E-W, E-A, I-W, I-A; títulos também PO-W e N-A | simplificação | médio × M | **Genérica.** O mesmo componente de lista serve a magias e inventário de outros sistemas | EW-10, EA-12, IW-22, IA-29, POW-22, EA-17, EW-29, IW-21, IA-28 · `img/experiente-app/19-editar-disciplina-android.webp`, `img/experiente-app/65-dons-antecedentes-android.webp` |
| R-26 | Recomendação a partir da identidade, sem bloquear: selo "do clã" nas Disciplinas (e no topo da lista), "da Tradição" na Esfera de afinidade, aviso "fora do clã" que o narrador pode aceitar; Fraqueza do clã preenchida com o texto do template, editável, se a licença permitir | C3 | I-A (Dominação), N-A, E-W, E-A, I-W, PO-W, PO-A; Fraqueza: E-W, E-A, I-W, I-A, N-W, N-A | orientação | médio × M | **De template** (clã → Disciplinas, clã → fraqueza) e **genérica** (selo "recomendado"). É o mesmo mecanismo de "magias da classe" no D&D 5e | POW-23, EW-18, EA-09, IW-16, IA-07, NA-20, EW-31, EA-24, IA-21, NW-33, NA-29 · `img/iniciante-app/54-adicionar-disciplina-ios.webp`, `img/iniciante-app/70-fraqueza-ios.webp` |
| R-27 | Dons (W20): catálogo de nomes com nível, destacando os de Raça, Augúrio e Tribo, mantendo o texto livre; Enter adiciona; na criação, aviso para Dom acima do nível inicial, como já existe para o Renome | C3, C5 | PO-W, E-A | orientação | médio × M | **De template** (catálogo) e **genérica** (Enter, aviso de nível). Revê a decisão da auditoria (Dons sem catálogo por licença) no padrão da C-18: o template traz só os nomes | POW-21, EA-03, EA-14 · `img/experiente-app/66-adicionar-dom-android.webp`, `img/po-web/74-adicionar-dom-390.webp` |
| R-28 | Prioridade marcada automaticamente com aviso ("Sociais ficou Secundária e Mentais Terciária; toque para trocar") | C4 | PO-A, E-A, I-A | clareza | baixo × P | **Genérica.** Vale para qualquer distribuição por prioridade | POA-13, EA-15, IA-19 · `img/experiente-app/43-sociais-prioridade-automatica-android.webp`, `img/iniciante-app/33-sociais-ios.webp` |
| R-29 | Mesma ajuda nos três sistemas: "Escolher da lista" de Natureza e Comportamento também no Mago; listas ordenadas pelo rótulo em português; Foco perto da Tradição; Posto inicial e forma natural conferidos no livro (a forma é decisão registrada na auditoria); texto de vazio com o gênero certo ("Nenhuma Qualidade") | C3 | E-W e PO-A (Mago); E-W, E-A (ordem); PO-W, E-A (Posto); 7 execuções ("Nenhum Qualidade") | clareza | baixo × P | **De template** (lista, ordem, Posto, gênero) e **genérica** (ordenar pelo rótulo exibido) | EW-21, EW-19, EA-22, EW-20, POW-28, EA-20, POW-26, POA-09, EW-25, EA-28, IA-28, NA-28 · `img/experiente-web/63-nova-ficha-mago-1280.webp`, `img/experiente-web/74-sobre-mago-1280.webp` |
| R-30 | Convite que leva até a crônica: "Copiar" e "Compartilhar" com mensagem pronta (abrir o TMS, criar a conta, tocar em "Entrar com convite") e link que abre "Entrar com convite" já preenchido; toast "Código copiado" acima da folha no web; "Compartilhar" com alternativa quando o navegador não tem Web Share; "Revogar" com confirmação; na lista vazia do jogador, "Entrar com convite" em destaque. *Segurança:* o código vai no fragmento `#`, nunca em query string, para não chegar a log de servidor ou proxy; uso limitado e validade continuam | C1 | N-W, N-A, PO-A, I-W, I-A | orientação | médio × M | **Genérica** | NW-05, NW-06, NW-07, NW-08, NW-09, NA-05, NA-06, IW-14, IA-26 · `img/narrador-app/20-compartilhar-ios.webp`, `img/narrador-web/23-convite-copiado-feedback-390.webp` |
| R-31 | Painel "Criação de fichas" recolhido num resumo depois de salvo (ou movido para Bastidores), abas da crônica fixas, aviso ao sair com regras não salvas e "padrão do sistema: 7" com "Restaurar padrão" no orçamento | C5 | PO-W, PO-A, N-W, N-A | layout | médio × P | **Genérica.** Os valores padrão vêm do template | POW-32, POA-19, NW-10, NA-03, NW-03, NW-04, NA-15 · `img/narrador-app/11-orcamento-ios.webp`, `img/po-app/76-narrador-cronica-pendente-ios.webp` |
| R-32 | O modo "Criação" do narrador abre em leitura; a edição fica só no "Editar como narrador", que passa a abrir a edição de fato. *Segurança:* a interface não é controle de acesso; o servidor continua validando e assinando a edição do narrador | C1 | N-W, N-A | feedback | médio × P | **Genérica** | NW-21, NA-27 · `img/narrador-web/62-f2-sebastiao-criacao-390.webp`, `img/narrador-app/46-f2-teodoro-editar-narrador-ios.webp` |

---

## 10. Comparação com `doc/avaliacao-ui-ux.md` e `doc/auditoria-fichas-wod.md`

### Resolvido

| Item anterior | Onde | Como está agora | Evidência neste teste |
|---|---|---|---|
| Criação por pontos inexistente ("Não há orçamento: tudo é livre em Editar") | auditoria, "Criação de personagem" | Existe nos três sistemas, com prioridades, tetos, folha de bônus e "O que falta"; todos os custos de bônus conferem com o livro | E-W, E-A, PO-A · `img/experiente-app/52-orcamento-completo-android.webp` |
| Valores iniciais (Humanidade, FdV, Fúria, Gnose, Renome, Quintessência) | auditoria, "Status das correções" | Certos: Geração 13ª, Sangue 10, Humanidade = Consciência + Autocontrole, FdV = Coragem, FdV 5 no Mago, Fúria, Gnose e FdV pela identidade, Glória 2 e Honra 1 do Ahroun | E-A, E-W, PO-W · `img/experiente-app/62-lobisomem-em-jogo-android.webp` |
| Humanidade e Aparência nascendo em 0 | auditoria, "Atrapalha" 2 e 3 | Na tela, resolvido: Humanidade acompanha as Virtudes e a Aparência aparece em 1 (Nosferatu fica em 0, bloqueado). O resumo de salvar ainda mostra "0 → 3" e "Humanidade 0 → 7" (ver "Continua") | POA-08, EW-23 · `img/po-app/32-concluir-edicao-ios.webp` |
| Fraqueza do clã, Qualidades e Defeitos, Experiência inexistentes | auditoria | Existem nos três sistemas | E-W, I-A · `img/experiente-web/21-vantagens-1280.webp` |
| C-01 Edição acidental, sem modos e sem desfazer | avaliação | Há Leitura, Jogo, Editar e Criação, toast com "Desfazer", Histórico com de/para e "Sair sem salvar?" | N-W, PO-A, E-A · `img/experiente-app/34-voltar-com-alteracao-android.webp` |
| C-02 Alvos de toque de 14 e 22 px | avaliação | Os −/+ têm 115 px (≈44 dp) no Android e ~60×60 pt no iOS | E-A, N-A · `img/narrador-app/14-orcamento-bonus-16-ios.webp` |
| C-04 Recursos longe; barra fixa sem estado | avaliação | Dock "Todos os recursos" com valores e toque longo "Gastar 1 Sangue" | PO-A, I-A · `img/po-app/153-gastar-sangue-ios.webp` |
| C-07 Parada de dados manual | avaliação | Atributo + Habilidade, ferimento automático, "Rolei na mão", Crinos +4 | PO-W, PO-A · `img/po-web/111-lobisomem-dados-crinos-390.webp` |
| C-12 Forma do Lobisomem longe e valor efetivo difícil | avaliação | "Força 8 · 4 + 4 Crinos" e a forma no dock | PO-W · `img/po-web/110-lobisomem-crinos-390.webp` |
| Telas que faltavam (Anexo B): início sem crônicas, catálogo com busca, Experiência com pedido ao narrador | avaliação | Existem ("Criar crônica"/"Entrar com convite"; Disciplinas e Antecedentes com busca; "Solicitar evolução") | I-W, E-A, PO-W · `img/iniciante-web/07-cronicas-vazio-1280.webp` |

### Continua (às vezes de outra forma)

| Item anterior | Onde | Como aparece agora | Evidência neste teste |
|---|---|---|---|
| C-08 Sincronização e estados: "● salvo / ◌ salvando / offline", fila local persistida | avaliação | Offline funciona ("Offline · 1 pendente" → "Salvo"), mas o rascunho de edição e de criação fica só na memória e o "Salvo" não reflete o rascunho (C2) | POW (offline), EW-05, IA-01, EA-04 · `img/iniciante-web/37-fisicos-distribuidos-390.webp` |
| Anexo B: criação com contador, validação e "salvar rascunho" | avaliação | Contador e validação existem; "salvar rascunho" some quando os básicos acabam e não sobrevive a fechar o app | IW-02, EA-06, IA-09 · `img/experiente-web/56-trocar-para-jogo-390.webp` |
| DS-04: barra "Editando · Concluir" com toast "Desfazer" | avaliação, Anexo A | Foi implementada, mas o verbo "Concluir" agora colide com "Concluir criação" na mesma tela (R-05) | POW-07, NW-31 · `img/po-web/40-concluir-resumo-390.webp` |
| C-19 Narrador sem visão da mesa e sem leitura segura | avaliação | Em parte resolvido: Mesa com uma linha por personagem, chips e "Anterior/Próxima". Continua: sem progresso de criação, e ver a conta põe o narrador em edição | NW-20, NW-21, NA-19, NA-27 · `img/narrador-web/59-f2-vampv4-mesa-cards-390.webp` |
| C-09 e C-20 Fonte grande e 360 dp; menu ⋯ indefinido | avaliação | O cabeçalho da ficha transborda e "Histórico" sai da tela (POW-12 cita a C-09; POA-07 cita a C-20) | POW-12, POA-07, EW-12, EA-25, IA-14 · `img/po-app/73-narrador-abre-ficha-livre-ios.webp` |
| C-20 Ao reabrir, abas e rolagem voltam ao padrão | avaliação | A ficha reaberta cai em Jogo, e a crônica volta à aba Fichas, no topo | IA-04, NA-25 · `img/narrador-app/59-f2-volta-da-ficha-aba-fichas-ios.webp` |
| C-03 Leitor de tela sem o valor dos traços | avaliação | No web, os controles têm nome e valor. No app, os steppers são lidos em porcentagem, botões no `trailing` somem da árvore e os grupos de rádio não têm nome | POA-03, NA-07, POA-02, NA-08, NA-09 · `img/narrador-app/14-orcamento-bonus-16-ios.webp` |
| C-10 Web e tablet com colunas desbalanceadas | avaliação | Na 1280, Atributos em 3 colunas (elogiado), mas Habilidades numa coluna só e folha de convite de ponta a ponta | EW-11, NW-14 · `img/experiente-web/20-habilidades-livre-1280.webp` |
| C-18 Poderes não consultáveis (licença: o template traz os nomes, a mesa escreve a descrição) | avaliação | Listas sem nenhuma descrição; Dons sem catálogo nem de nomes | IW-06, IA-06, POW-21, EA-03 · `img/iniciante-app/54-adicionar-disciplina-ios.webp` |
| C-21 Safe areas | avaliação | Mudou de forma: agora sobra uma faixa vazia de ~60 a 80 pt acima do cabeçalho no iOS | POA-46, NA-14 · `img/narrador-app/04-cronicas-ios.webp` |
| C-22 Microcopy | avaliação | "Nenhum Qualidade", "Comportamen/to" | POW-26, POA-09, EA-28, IW-21, NA-28 · `img/iniciante-web/50-vantagens-390.webp` |
| C-23 Teclado sobre campos de texto | avaliação | No Android, as folhas não sobem com o teclado. No iOS, a única folha vista com teclado (Notas do Narrador, N-A) subiu certo | EA-02, EA-11 · `img/experiente-app/25-fraqueza-teclado-android.webp` |
| Habilidades na ordem alfabética do inglês | auditoria, "Cosmético" | Continua e se estende aos arquétipos e às Disciplinas | EW-19, EA-22 · `img/experiente-app/07-natureza-lista-android.webp` |
| Geração derivada do Antecedente (escolha de design) | auditoria | Continua como escolha; o PO a marca como diferença frente ao plano v0 §1.4 | PO-W, PO-A · `img/po-app/21-nova-ficha-vampiro-ios.webp` |
| Dons sem catálogo, por licença; forma inicial sempre Hominídeo | auditoria (decisões) | Mantidos; agora com o custo medido: o veterano digita Dons de memória e estranha "Hominídeo" num Lupino | EA-03, EA-20 · `img/experiente-app/69-editar-dom-android.webp` |
| Afinidade do Mago "escolha sem essa regra" | auditoria | Vem vazia e não sugere as Esferas da Tradição | EW-18 · `img/experiente-web/68-esfera-afinidade-1280.webp` |
| §10 Checklist de validação com usuários reais | avaliação | Ainda não feito; este teste não o substitui | — |

### Novo (não está em nenhum dos dois documentos)

- **Estado e próximo passo (C1):** ficha reaberta em Jogo, sem estado na ficha e na lista, sem "entregar" na criação livre, devolução visível só no modo Criação, devolução inexistente com a aprovação desligada, Notas do Narrador privadas sem aviso, Mesa sem progresso de criação, modo Criação do narrador que já é edição, "Concluir criação" sem confirmação pelo menu (POW-01, POW-08, POW-09, POA-10, POA-35, NW-20, NW-21, NW-24, NA-17, NA-18, NA-22).
- **Salvamento (C2):** "● Salvo" com alterações pendentes, salvar que vira concluir, prioridade gravada na hora e pontos não (EW-05, EW-06, IA-01, IA-03, IW-02).
- **Rótulos (C3):** o `Choice` só usa o `label` como nome acessível, e os grupos ficam sem título (POA-01, NA-09).
- **Feedback da conta (C4):** mensagem errada no teto de 3, "A conta fechou" com saldo, custo só depois, avisos atrás da folha, FdV atual × permanente, prioridade automática sem aviso (EW-04, EW-07, IA-12, EA-01, NA-21, POA-13).
- **Lobisomem:** Posto inicial "Filhote" (Cliath é suposto), Dom de Posto 2 sem custo, Fúria abaixo do Augúrio sem aviso (POW-28, EA-14, EA-19, EA-20).
- **Convite:** sem link nem instrução, "Código copiado" atrás da folha e "Compartilhar" falhando no web, "Revogar" sem confirmação (NW-05 a NW-09, NA-05).
- **iOS:** corretor automático no campo de nome (POA-05).
- O painel "Criação de fichas" acima das abas não está nesses dois documentos, mas já aparece em `doc/validacao-v5.md`, como as próprias notas registram (POW-32, POA-19).
