# Jogador iniciante: web
Conta(s): iniciante.web.6761@roteiro.test (criada no teste) · Plataforma: web, Chromium (Playwright, porta 9605), fluxo em 390×844 com comparação em 1280×800 · Início e fim: 12:13 – 13:02 (relógio local; ~25 min parados por problemas de ambiente)

## Diário detalhado (escrito durante o teste; horários do relógio local, o mesmo do histórico da API)
- 12:13 Abri `http://localhost:8081`. Tela de login: "TMS" e "Entre para ver suas crônicas e fichas." (img/iniciante-web/01-inicio-390.webp, 02-inicio-1280.webp)
  > "TMS? Não diz o que é. 'Crônicas'? Achei que era um app de ficha de RPG... Bom, tem 'Criar conta', vou lá."
- 1280: mesma coluna centralizada de ~450 px; nada muda além do espaço vazio. Neutro.
- Cadastro (img/iniciante-web/03-cadastro-390.webp): o contador "0/24" do nome de usuário encosta/sobrepõe o texto de ajuda ("números0/24 e _."). O ícone de raio no canto inferior esquerdo é a ferramenta de dev do Expo (só dev).
- 12:15 Nome de usuário "Lucas Novato" + senha "lucas123": erros aparecem só ao clicar em "Criar conta", validação no cliente (nenhuma chamada à API, não gastou cadastro). img/iniciante-web/05-cadastro-erros-390.webp
  > "'De 3 a 24 caracteres'... eu tenho 12! Ah, deve ser a maiúscula ou o espaço. Não diz qual."
  - A dica boa da senha ("Uma frase funciona bem.") some quando o erro aparece; fica só "Pelo menos 15 caracteres".
  - Ao corrigir os dois campos, os erros vermelhos continuam lá até clicar de novo (o aria ainda mostra [invalid] com valores válidos).
- 12:16 `lucas_novato6761` + senha padrão do roteiro: conta criada (POST /auth/register 201) e já entrou logado. Caiu em "Crônicas" vazio com "Criar crônica" (botão cheio, destaque) e "Entrar com convite" (contorno). img/iniciante-web/06-pos-cadastro-390.webp, 07-cronicas-vazio-1280.webp
  > "Meu amigo falou 'faz tua ficha'. Não tem 'ficha' aqui. Mas tem 'convite que o narrador enviou'... o amigo é o narrador? Acho que sim, ele me mandou um código."
  - O botão em destaque é "Criar crônica", que é o caminho do narrador. Para quem chega com convite, o destaque está no botão errado.
- Tela "Entrar com convite": "Peça o código ao narrador. Pode digitar com ou sem espaços." Claro. img/iniciante-web/08-convite-390.webp
- 12:17 Colei o código e cliquei "Entrar na crônica": POST /invites/accept 200, caiu direto na crônica "Vampiro v4 · 11-01 12:06" (img/iniciante-web/10-cronica-entrou-390.webp, 11-cronica-entrou-1280.webp). Sem mensagem de "você entrou", mas o próprio nome na lista de Participantes confirma.
  > "Entrei! 'Vampiro v4'... a linha de baixo diz 'Edição de 20º Aniversário'. É a 4 ou a 20? Tanto faz. 'Suas fichas: você ainda não tem ficha'. Tá, 'Nova ficha'."
  - O botão mais chamativo da tela é o vermelho "Sair da crônica" (cheio). "Nova ficha", que é o próximo passo, é só contorno.
  - O título "Participantes" fica desalinhado à esquerda em relação a "Suas fichas" (16 px a menos), em 390 e em 1280.
  - Nada diz que esta crônica é "por pontos" nem o que isso significa.
  - 1280: a tela estica até 1200 px; "Nova ficha" vai para a ponta direita, longe do texto "Você ainda não tem ficha". No login a coluna era estreita e centralizada: inconsistente.
- 12:18 **BLOQUEIO NA CRIAÇÃO.** Cliquei "Nova ficha" → tela "Nova ficha" só com "**Atualize o app** — Este sistema usa uma versão que este app ainda não conhece." Nenhum botão, nenhum link, nenhuma ação sugerida. img/iniciante-web/12-nova-ficha-390.webp, 14-atualize-app-1280.webp
  > "Atualizar o app? Eu estou no navegador, não instalei app nenhum. Como atualizo um site?"
  - Evidência de rede: GET /systems/vtm-v20/template 200 (o template chega: `schema: 1`, `templateVersion: "1.8.0"`, `system: vtm-v20`); GET /chronicles/<id> 200. Nenhum erro de console ligado a isso. Ou seja, a API entrega o template e o front decide que não sabe lidar (suposto: verificação de versão do template × versão do front).
  - Recarreguei a página (F5): mesma tela. img/iniciante-web/13-nova-ficha-recarregada-390.webp
  - Depois do F5, o botão do cabeçalho "‹ Vampiro v4 · 11-01 12:06" **não faz nada** (console: "The action 'GO_BACK' was not handled by any navigator", aviso só dev, mas o efeito de não voltar é real). Só saí pelo botão Voltar do navegador. Sem recarregar, o mesmo botão funciona.
  - Voltei à crônica pelo navegador e cliquei "Nova ficha" de novo: mesma tela "Atualize o app".
- 12:20 Fiz o que uma pessoa faria: voltei para "Crônicas", "Sair", entrei de novo (login ok), abri a crônica, "Nova ficha": **mesma tela "Atualize o app"**. Lista de crônicas mostra "Vampiro v4 · 11-01 12:06 … · 0 personagens" (img/iniciante-web/17-cronicas-com-uma-390.webp).
  > "Já saí, entrei, recarreguei. Continua mandando atualizar. Vou ter que mandar mensagem pro meu amigo."
- Aba "Diário": "Nenhuma sessão registrada." (img/iniciante-web/18-diario-390.webp). Nada sobre ficha ou próximos passos.
- 12:21 Procurei em "Conta" algo como "atualizar" ou versão: só "Você entrou como lucas_novato6761" e "Excluir conta". img/iniciante-web/19-conta-390.webp
  > "Nada de atualizar aqui. Só excluir conta. Melhor não mexer."
- 12:22 **Aviso do orquestrador:** até 12:22 o web servia uma versão antiga do código das fichas; "Atualize o app" era **problema de ambiente**, já corrigido (pacotes recompilados, API e Metro reiniciados). Tudo o que vi de "Atualize o app" antes de 12:22 fica marcado como **ambiente**, não defeito do produto. O que fica como achado é só a clareza da mensagem (para quem está no navegador, "atualize o app" não diz o que fazer) e o botão "Voltar" que não volta depois do F5 (este independe da versão).

### Depois da correção do ambiente (12:23 em diante)
- 12:23 `page.goto` na raiz: continuava logado. Crônica → "Nova ficha": agora abre o formulário de identidade. img/iniciante-web/20-nova-ficha-inicio-390.webp, 21-nova-ficha-rolada-390.webp
  - Texto de topo: "Comece pela identidade. Atributos, habilidades e poderes você monta depois, na ficha." Ajuda: eu sei que é o primeiro passo de alguns.
  - Campos: Nome (obrigatório), Natureza, Comportamento, Conceito, Senhor, e uma grade de 14 opções (Assamitas, Brujah, ... Caitiff) **sem título visível**. O leitor de tela chama de "Clã", mas na tela não há rótulo nenhum.
  > "Natureza e Comportamento... de quem? Do personagem? Qual a diferença? 'Senhor'... tipo 'Sr.'? Deixo em branco. E essa lista de nomes esquisitos sem título, é pra escolher o quê? Raça? Time?"
  > (uma pessoa iniciante não saberia que Senhor é o vampiro que te transformou, nem que a lista é o clã, nem o que cada clã muda na ficha.)
  - Cliquei "Criar ficha" com tudo vazio (erro provocado): aparece "Informe o nome" em vermelho embaixo do campo Nome, mas a tela **não rola até o erro** e o foco fica no botão. Em 390, depois de rolar até o botão, o campo Nome fica acima da dobra; só a borda vermelha e o texto aparecem cortados no topo. img/iniciante-web/22-criar-vazio-erro-390.webp
  - Ao digitar o nome, o erro some na hora (aqui sim; no cadastro não sumia).
  - "Escolher da lista" de Natureza abre uma folha com 42 botões (Arquiteto, Autocrata, Bon Vivant, Valentão, Capitalista...) **sem descrição** de nenhum, e fora de ordem alfabética em português. img/iniciante-web/23-natureza-lista-390.webp
  > "'Show de Horrores', 'Masoquista', 'Sádico'... sem saber o que muda, escolhi 'Sobrevivente' porque parece comigo. Comportamento escolhi 'Camaleão' na mesma lista, igualzinha."
  - Escolhi Clã "Toreador" pelo som do nome. Nome "Tiago Sombra (iniciante web)", Conceito "Entregador de aplicativo", Senhor em branco. img/iniciante-web/24-identidade-preenchida-390.webp
  - 1280: o formulário vira coluna de ~600 px centralizada; as 14 opções de clã em 2 colunas; o botão "Criar ficha" fica cortado no rodapé (precisa rolar até em desktop). Mesmos problemas de rótulo. img/iniciante-web/25-identidade-1280.webp
- 12:24 Cliquei "Criar ficha": POST /chronicles/<id>/characters **201** (a ficha foi criada) e navegou para /characters/<id>. Mas a tela virou **tela vermelha de erro** (LogBox de dev): "Uncaught Error: (0, _expoRouter.usePreventRemove) is not a function", em `sheet/evolve/LeaveGuard.tsx (20:19)`, montado por `LiveSheet` (`sheet/SheetScreen.tsx`). img/iniciante-web/26-ficha-criada-390.webp
  > "Opa. Tela preta e vermelha cheia de código. Quebrei alguma coisa?"
- 12:25 Fechei a tela vermelha: o app me jogou para "Crônicas" (URL "/"), com um aviso vermelho minimizado no rodapé. A crônica agora diz "1 personagem" (img/iniciante-web/27-apos-dismiss-390.webp). Na crônica aparece "Tiago Sombra (iniciante web) · Toreador · Sua ficha" (img/iniciante-web/28-cronica-com-ficha-390.webp).
  > "Pelo menos a ficha existe. Vou abrir."
- Abri a ficha pela lista: **mesma tela vermelha** e volta para "/". Reproduz 100% (2 de 2). img/iniciante-web/29-abrir-ficha-390.webp. Console: `TypeError: (0, _expoRouter.usePreventRemove) is not a function at LeaveGuard`.
  - Suposto: ambiente de novo (começou depois do restart de 12:22; parece versão do expo-router servida pelo Metro). Avisei o orquestrador às 12:26. Fica como "ambiente" até ser confirmado.
  > "Criei, mas não consigo abrir. Se eu fosse uma pessoa de verdade, desistia aqui e chamava meu amigo."
  - Na lista "Suas fichas" o item diz só "Toreador · Sua ficha": nenhum estado ("em criação", "falta gastar pontos", "rascunho"). Quem não abre a ficha não sabe que ela está incompleta.
- 12:35 **Pausa do orquestrador:** a tela vermelha `usePreventRemove is not a function` é **ambiente** (dependências de uma versão antiga do Expo). Web suspenso até nova ordem; a ficha criada continua gravada. Retomo depois.
  (o aviso diz 12:35; no meu relógio eram 12:28.)


### Retomada após a 2ª correção do ambiente (orquestrador: "pode continuar"; o relógio dele estava ~7 min à frente do meu e do da API)
- 12:48 Recarreguei: logado, abri a crônica e a ficha. **Abre normal** (sem tela vermelha). A ficha abre no modo **"Jogo"** (marcado) e não em "Criação". img/iniciante-web/30-ficha-aberta-390.webp, 31-ficha-aberta-1280.webp
  > "Jogo ou Criação? Eu ainda nem terminei... está marcado 'Jogo'. Atributos tudo 1, Habilidades 'Mostrando 0 de 30', 'Nada para mostrar em Talentos'. Não tem nada dizendo 'distribua seus pontos'. Vou em 'Criação', que é o que eu estou fazendo."
  > "'13ª geração'? 'Sangue 10/10', 'FdV 1/1'? Não sei o que é FdV." (uma pessoa iniciante não saberia que FdV = Força de Vontade; a sigla aparece sozinha no painel de baixo)
  - 390: o cabeçalho mostra "Salvo" e "Experiência"; o botão "Histórico" fica **fora da tela** (x = 372 a 481 num viewport de 390; `scrollWidth` do documento = 482, ou seja, a página rola de lado). Em 1280 aparece normal.
  - 1280: aparece o bloco "Em jogo" (Vitalidade, Pontos de Sangue 10/10, Força de Vontade 1/1) por extenso, mais legível que o rodapé "Vitalidade/Sangue/FdV" do 390.
- Cliquei "Criação": aparece a barra fixa "Criação · 0 alterações · Bônus: 15 de 15" + "Salvar alterações" (desabilitado) e uma aba nova "Orçamento". img/iniciante-web/32-modo-criacao-390.webp
  > "'Bônus: 15 de 15'. Ganhei 15 de bônus? Bônus de quê? E os pontos 'normais', onde estão?"
  - Rótulo "Comportamento" quebra no meio da palavra ("Comportamen / to") na grade de identidade em 390.
  - No modo Criação, o bloco "Em jogo" vem antes dos Atributos com botões − / + de Pontos de Sangue e Força de Vontade (permanente e atual). Para quem está criando, não está claro se é para mexer nisso agora.
- Atributos: abas Físicos / Sociais / Mentais, linha "Prioridade" com três círculos "7 5 3" sem nada escolhido e sem explicação. Habilidades idem com "13 9 5". img/iniciante-web/33-criacao-atributos-390.webp, 34-criacao-atributos2-390.webp
- Erro natural: cliquei "+" em Força sem escolher prioridade → não sobe e aparece em vermelho, abaixo de Força: "Escolha as prioridades deste grupo antes de distribuir os pontos." img/iniciante-web/35-forca-mais-um-sem-prioridade-390.webp
  > "Tá, tenho que escolher a 'prioridade'. São esses 7, 5, 3? Escolho qual? Se eu pegar 7 aqui, posso pegar 7 nos Sociais também?" (a mensagem diz o que fazer, mas não explica o que é a prioridade nem que cada número só pode ser usado uma vez)
- Escolhi "7" em Físicos: o rótulo "Prioridade" vira o contador "0/7". Mas o erro vermelho "Escolha as prioridades deste grupo..." **continua na tela** mesmo com a prioridade escolhida, até eu clicar "+" de novo. img/iniciante-web/36-fisicos-7-390.webp
- Distribuí Força 3, Destreza 4, Vigor 3 → "7/7", barra "Criação · 3 alterações · Bônus: 15 de 15", "Salvar alterações" ficou ativo. img/iniciante-web/37-fisicos-distribuidos-390.webp
  - **Contradição:** o cabeçalho continua com o ponto verde "Salvo" enquanto a barra diz "3 alterações" não salvas.
  > "Diz 'Salvo' lá em cima, então está salvo, né? Mas tem o botão 'Salvar alterações'..."
- Tentei passar de 7 (Destreza 5): não sobe e aparece "Físicos: os 7 pontos básicos já foram usados. Para passar disso, use os pontos de bônus." img/iniciante-web/38-destreza-alem-390.webp
  > "'Use os pontos de bônus'. Como? Onde? O mesmo '+' não usou."

#### Tarefa 4 (interrupção), 1ª vez: recarregar com alterações não salvas
- 12:49 Com "3 alterações" pendentes (e o cabeçalho dizendo "Salvo"), recarreguei a página (F5), como quem fecha a aba sem querer. O navegador mostrou o aviso genérico de `beforeunload` ("sair do site? alterações podem não ser salvas"); aceitei, como uma pessoa com pressa faria.
- Resultado: a ficha volta no modo **"Jogo"** (não lembra que eu estava em Criação), atributos todos em 1 de novo: **os 7 pontos de Físicos sumiram**. Mas a prioridade "7" de Físicos **ficou gravada**. img/iniciante-web/39-apos-recarregar-390.webp, 40-apos-recarregar-criacao-390.webp
  > "Perdi o que tinha feito. Mas o '7' ficou marcado... então uma parte salva sozinha e outra não? E lá em cima dizia 'Salvo'!"
  - Sei onde parei? Mais ou menos: o "0/7" mostra que a prioridade estava escolhida, mas nada diz "você tinha alterações não salvas" nem me leva de volta para Criação.
- Curioso com "Bônus", abri a 4ª aba "Orçamento": ali está tudo o que eu procurava. Seletor "Pontos básicos | Pontos de bônus" ("Cada grupo trava quando os pontos básicos acabam. Depois, passe para os pontos de bônus.") e a lista **"O que falta"**: Físicos faltam 7, Sociais faltam 5, Mentais faltam 3, Talentos/Perícias/Conhecimentos "escolha a prioridade", Disciplinas faltam 3, Antecedentes faltam 5, Virtudes faltam 7. img/iniciante-web/41-orcamento-390.webp
  > "Ah! Então é aqui. Por que isso fica escondido numa aba chamada 'Orçamento'? Achei que era coisa de dinheiro. E o 'use os pontos de bônus' de antes devia me mandar pra cá."
  - Ao escolher 7 em Físicos, o app já distribuiu 5 para Sociais e 3 para Mentais sozinho (bom), mas na aba Ficha isso não foi avisado.
  - Os itens de "O que falta" são texto puro: não dá para tocar e ir até o grupo.
- 12:50 Refiz Físicos (Força 3, Destreza 4, Vigor 3) e, escaldado, cliquei "Salvar alterações". Abre uma folha "Salvar 3 alterações?" com a lista (Vigor 1→3, Força 1→3, Destreza 1→4) e dois botões cheios lado a lado: **"Descartar" (vermelho, à esquerda)** e "Salvar". img/iniciante-web/44-salvo-390.webp
  > "Legal ver o que mudou. Mas 'Descartar' vermelho grandão do lado de 'Salvar'... quase apertei errado."
  - Salvar: POST /characters/<id>/events 200, toast "Salvo: 3 alterações · Desfazer", barra volta a "0 alterações". img/iniciante-web/45-apos-salvar-390.webp
  - Na aba Sociais o "5" já vem marcado (o app escolheu por mim depois do 7 em Físicos); contador "0/5".
- Sociais (Carisma 3, Manipulação 2, Aparência 3 → 5/5) e Mentais (Percepção 2, Inteligência 2, Raciocínio 2 → 3/3) sem tropeço; o contador "N/5", "N/3" ajuda.
- Habilidades → Talentos: escolhi "13". Quis Prontidão 4: parou em 3 e apareceu **"Talentos: os 13 pontos básicos já foram usados. Para passar disso, use os pontos de bônus."** com o contador mostrando **"3/13"** logo acima. img/iniciante-web/47-talento-acima-3-390.webp
  > "Como assim usei os 13? Diz 3 de 13 bem ali. Está errado ou eu não entendi nada?"
  (suposto: o motivo real é o teto de 3 por Habilidade na criação com pontos básicos; a tela não fala desse teto em lugar nenhum. Uma pessoa iniciante não saberia dessa regra.)
- Talentos 13/13 (Prontidão 3, Esportes 2, Briga 2, Empatia 2, Lábia 2, Manha 2); Perícias (9 já marcado) 9/9; Conhecimentos (5 já marcado) 5/5. Salvei: folha "Salvar 20 alterações?" com a lista inteira, fora de ordem (Raciocínio, Briga, Condução, Empatia...), sem agrupar por Atributos/Habilidades. Mostra "Aparência 0 → 3", mas na tela Aparência começava em 1. img/iniciante-web/48-conhecimentos-390.webp, 49-confirmar-20-390.webp
- 12:52 Vantagens (img/iniciante-web/50-vantagens-390.webp): "Disciplinas 0/3" e logo abaixo outro "Disciplinas 0" (título repetido, com dois números diferentes: o orçamento e a quantidade de itens). Mesmo em Antecedentes ("Antecedentes 0/5" + "Antecedentes 0"). "Nenhum Qualidade" (concordância).
- "Adicionar Disciplina" abre lista de 17 nomes (Animalismo, Auspícios, Rapidez, Demência...) **sem descrição e sem marcar quais são do meu clã**. img/iniciante-web/51-adicionar-disciplina-390.webp
  > "Qual eu pego? Não diz o que nenhuma faz. 'Presença' parece legal." (uma pessoa iniciante não saberia que Toreador tem Auspícios, Rapidez e Presença como disciplinas de clã, nem que comprar fora do clã custa mais depois.)
  - Adicionar entra com 1; para subir é preciso tocar no item, abrir a folha (Nome, Valor −/+, Especialização, Notas do jogador, Remover, Aplicar), subir e "Aplicar". Atributos e Habilidades têm −/+ direto na linha; Disciplinas e Antecedentes não: dois jeitos de fazer a mesma coisa. img/iniciante-web/53-editar-presenca-390.webp
- Presença 2 + Rapidez 1 → 3/3. Antecedentes (lista de 10 sem descrição; "Geração" aparece como antecedente, e lá em cima já dizia "13ª geração"): Contatos 3, Recursos 2 → 5/5. img/iniciante-web/55-adicionar-antecedente-390.webp
- Virtudes: Consciência 3, Autocontrole 4, Coragem 3 → 7/7. Humanidade foi sozinha para 7 e Força de Vontade permanente para 3 (sem aviso na tela de que mudaram). Não vi na tela o texto de ajuda que diferencia a Virtude "Consciência" do Talento "Consciência" (nomes iguais em dois lugares).
  > "Consciência de novo? Já tinha uma Consciência nos Talentos. É a mesma?"
- Ao fechar Virtudes apareceu a folha **"Começaram os pontos de bônus"**: "Os pontos básicos de todos os grupos foram distribuídos. A partir de agora, cada ponto a mais gasta os pontos de bônus: restam 15." [Ver orçamento] [Entendi]. img/iniciante-web/56-virtudes-390.webp
  > "Agora sim alguém me explicou alguma coisa! Mas só no fim."
  - No mesmo momento o botão da barra trocou de "Salvar alterações" para **"Concluir criação"**, com 5 alterações ainda não salvas. Não há mais um "salvar sem concluir".
- "Ver orçamento": "Passar do orçamento de um grupo usa os pontos de bônus, até o saldo acabar. Bônus: 15 de 15 restantes. **A conta fechou: conclua a criação pela barra de cima.**" img/iniciante-web/57-orcamento-bonus-390.webp
  > "'A conta fechou', mas ainda tenho 15 de bônus? Posso concluir sem gastar? E quanto custa cada coisa com bônus? Não diz."

#### Tarefa 4 (interrupção), 2ª vez: voltar pelo app com alterações pendentes
- 12:53 Com 5 alterações pendentes, toquei em "‹ Vampiro v4" no cabeçalho: abriu **"Sair sem salvar? 5 alterações da edição ainda não foram salvas e serão descartadas." [Continuar editando] [Descartar e sair]**. img/iniciante-web/58-sair-com-pendencias-390.webp
  > "Ótimo que avisou. Mas cadê 'Salvar e sair'? Eu queria guardar e ir embora."
  - Não há "Salvar e sair", e nesse ponto a barra já não oferece "Salvar alterações" (só "Concluir criação"). O menu "Ações da ficha" (···) some no modo Criação. Ou seja: **quem completou os pontos básicos não consegue guardar o que fez sem concluir a criação**. Escolhi "Continuar editando".

#### Pontos de bônus e conclusão
- +1 Destreza (4→5): "Bônus: 15 de 15" → "10 de 15" e o contador do grupo vira "7/7 · +1 bônus". **O custo (5) só aparece depois de gastar**; nada antes do "+" diz quanto custa. img/iniciante-web/60-bonus-destreza-390.webp
  > "Gastou 5 de uma vez! Não sabia."
- Rapidez 1→2 pela folha do item: bônus 10 → 3 (custou 7). Recursos 2→3: 3 → 2. Lábia 2→3: 2 → 0. "Bônus: 0 de 15". img/iniciante-web/61-rapidez-bonus-dialogo-390.webp, 62-bonus-zerado-390.webp
  - "0 de 15" e antes "15 de 15": é saldo restante, mas lê-se como "usei 0 de 15". Ambíguo.
- Aba "Sobre": só Citação e Notas. img/iniciante-web/63-sobre-390.webp
- "Fraqueza do clã" ficou vazia ("Escreva a fraqueza com as suas palavras", visto no template): a persona não sabe qual é a fraqueza do Toreador, e nada na criação cobrou isso.
- 12:54 "Concluir criação" abre: **"Concluir criação? Depois de concluir, subir um traço passa pelo narrador. As alterações abaixo são salvas antes."** + lista (Coragem 1→3, Destreza 4→5, Consciência 1→3, Lábia 2→3, Antecedentes 0→2 itens, Disciplinas 0→2 itens, Autocontrole 1→4) + [Voltar] [Concluir criação]. img/iniciante-web/64-concluir-dialogo-390.webp
  > "Então sou eu que concluo? Meu amigo disse que ele ia olhar a ficha. Não tem 'mandar para o narrador'. Se eu concluir, ele ainda vê?"
  - Nada nesta crônica fala em "enviar para aprovação". O briefing esperava que o narrador concluísse. Parei aqui e perguntei ao orquestrador.
- 1280 na criação (img/iniciante-web/65-concluir-dialogo-1280.webp, 66-criacao-atributos-1280.webp, 67-orcamento-1280.webp): **melhor que 390**: Físicos, Sociais e Mentais lado a lado com os três contadores ("7/7 · +1 bônus", "5/5", "3/3") e as prioridades visíveis de uma vez, sem abas. O bloco "Em jogo" (Vitalidade, Sangue, Força de Vontade) continua antes dos Atributos e ocupa a primeira dobra inteira; o "Orçamento" continua escondido na 4ª aba.
- 12:55 Orquestrador: "siga o que o TMS pede, como a persona faria"; o descompasso com o briefing é dado do teste. Vou concluir.
- 12:55 Confirmei "Concluir criação": POST /characters/<id>/events 200 (as 7 alterações) e POST /characters/<id>/creation/complete 200. A ficha volta para o modo **"Jogo"**, o segundo botão do seletor muda de "Criação" para **"Editar"**, e aparece um toast "Criação concluída. Subir um traço agora passa pelo narrador." que **cobre o painel de recursos do rodapé** e some sozinho. img/iniciante-web/68-pos-concluir-toast-390.webp, 69-pos-concluir-390.webp
  > "Concluída! Mas 'subir um traço passa pelo narrador'... eu pedi alguma coisa pra ele? Ele sabe que eu terminei?"
  - Na grade de Atributos do modo Jogo (390), o número de cada traço ("3", "5") fica encostado/por cima da borda direita do cartão.

### Tarefa 5: depois de entregar
- Topo da ficha depois do toast: **nenhum selo de estado** ("concluída", "pronta", "aguardando narrador"). Igual a uma ficha qualquer. img/iniciante-web/70-ficha-concluida-topo-390.webp
- "Editar": barra "Editando · 0 alterações [Concluir]" (de novo a palavra "Concluir", agora com outro sentido: sair da edição). Todo traço tem "Peça ao narrador." com − e + desabilitados. img/iniciante-web/71-editar-pos-conclusao-390.webp
  > "Peça ao narrador como? Mando mensagem no WhatsApp?"
  - O pedido existe, mas em outro lugar: "Experiência" (cabeçalho) abre "Disponível: 0 XP · Total 0 · Gasto 0 · [Solicitar evolução] · Pedidos: Nenhum pedido · Extrato: Nenhum lançamento". O "Peça ao narrador." não leva até lá. img/iniciante-web/72-experiencia-390.webp
  > "'Solicitar evolução' com 0 XP... isso é pra depois, acho."
- Crônica: "Tiago Sombra (iniciante web) · Toreador · Sua ficha", exatamente igual a antes de concluir. Lista de crônicas: "· 1 personagem". Nada diz se o narrador foi avisado nem o que acontece agora. img/iniciante-web/73-cronica-pos-conclusao-390.webp, 74-cronica-pos-conclusao-1280.webp
  > "Pelo app, não sei se estou pronto pra jogar. Vou ter que perguntar pro meu amigo."
- 1280: ficha com cabeçalho completo ("Salvo", "Experiência", "Histórico") e bloco "Em jogo" por extenso (Força de Vontade 3/3). img/iniciante-web/75-ficha-concluida-1280.webp
- "Histórico" (só alcançável em 1280; em 390 o botão está fora da tela): lista as alterações por horário (12:50, 12:51, 12:55, 12:56), mas **não registra "criação concluída"**. Mostra "Humanidade: 0 → 7" e "Força de Vontade: permanente — → 3" como feitos por "lucas_novato6761", embora o app tenha calculado sozinho. Aqui "Aparência: 1 → 3", enquanto a folha de salvar dizia "0 → 3". img/iniciante-web/76-historico-1280.webp
  - O botão "×" e a tecla Esc fecham o histórico; o primeiro "Fechar" da árvore de acessibilidade é o fundo escuro (dois botões "Fechar" por folha, nas folhas todas).
- Rede (fora as 401 de `/auth/refresh` antes do login, esperadas): `GET /chronicles/<id>/transfer` 404 ao abrir a crônica (provavelmente "não há transferência pendente", só ruído) e `POST /auth/logout` sem status (cancelado pela navegação, mas o logout funcionou). Nenhum erro de console depois da correção do ambiente.

## Resumo por tarefa

## Tarefa 1: Cadastro do zero
- Resultado: sem ajuda (com 1 erro natural de nome e senha)
- Passos: "Criar conta" → e-mail, nome "Lucas Novato", senha fraca → erros → `lucas_novato6761` + senha padrão do roteiro → entrou logado · Cliques/toques: 8 · Rolagens: 0 · Telas: 3 (login, cadastro, crônicas)
- Hesitei, voltei ou errei em: nome de usuário, porque esperava poder usar meu nome com maiúscula e espaço; a mensagem fala "3 a 24 caracteres" e eu tinha 12.
- Desnecessário: nada. Um cadastro só (POST /auth/register 201).
- Pensando em voz alta:
  > "TMS? Não diz o que é."
  > "'De 3 a 24 caracteres'... eu tenho 12! Ah, deve ser a maiúscula ou o espaço."
- Diferenças 390 × 1280: nenhuma relevante; mesma coluna estreita centralizada.
- SEQ: 5, porque o erro de nome de usuário não diz qual regra quebrei e os erros não somem quando corrijo.
- Evidências: img/iniciante-web/01 a 07

## Tarefa 2: Entrar na crônica pelo convite
- Resultado: sem ajuda
- Passos: "Entrar com convite" → colar o código → "Entrar na crônica" (convite usado uma vez, POST /invites/accept 200) · Cliques/toques: 3 · Rolagens: 0 · Telas: 2
- Hesitei em: nada sério; só estranhei que o botão em destaque é "Criar crônica".
- Pensando em voz alta:
  > "Tem 'convite que o narrador enviou'... o amigo é o narrador? Acho que sim."
- Diferenças 390 × 1280: em 1280 a crônica estica até 1200 px e "Nova ficha" vai para a ponta direita.
- SEQ: 6, porque "Peça o código ao narrador" casa com a mensagem do amigo; perdi um ponto pelo destaque no botão errado.
- Evidências: img/iniciante-web/08 a 11

## Tarefa 3: Criar a ficha por pontos (Vampiro v4 · 11-01 12:06)
- Resultado: com dificuldade (concluída; a ficha "Tiago Sombra (iniciante web)" está com a criação concluída: básicos todos gastos e bônus 0 de 15). Houve dois bloqueios de **ambiente** no caminho ("Atualize o app" e tela vermelha `usePreventRemove`), ambos corrigidos pelo orquestrador.
- Passos: "Nova ficha" → identidade (nome, Natureza e Comportamento pela lista, Conceito, Clã) → "Criar ficha" → ficha abre em "Jogo" → "Criação" → prioridades e pontos de Atributos e Habilidades → salvar (2 vezes) → Vantagens (Disciplinas, Antecedentes, Virtudes) → aviso de bônus → gastar bônus → "Concluir criação" → confirmar.
- Cliques/toques: ~130 (≈ 75 só em "+"; ~15 deles refeitos por causa da perda no F5) · Rolagens: ~15 · Telas: 3 (Nova ficha, ficha, crônica) + 10 folhas (lista de Natureza, lista de Comportamento, Adicionar Disciplina ×2, editar item ×4, Adicionar Antecedente ×2, salvar ×2, aviso de bônus, sair sem salvar, concluir).
- Sabe por onde começar? Na identidade, sim ("Comece pela identidade..."). Na ficha, **não**: abre em "Jogo", com tudo em 1 e nada dizendo "distribua seus pontos".
- Entende os termos? **Não.** Clã (grade sem título), Natureza, Comportamento, Senhor, Geração, Disciplina, Antecedente, Virtudes, Humanidade, Força de Vontade/FdV, pontos de bônus: nenhum tem explicação na tela. Uma pessoa iniciante não saberia nenhum deles; eu (modelo) sei, a persona não.
- Sabe quantos pontos tem e onde gastar? Por grupo, sim, depois de escolher a prioridade ("0/7", "3/13"). O panorama ("O que falta") existe, mas escondido na 4ª aba "Orçamento". O custo dos bônus só aparece depois de gastar.
- Sabe o que falta para terminar? Só se achar a aba "Orçamento". O aviso "Começaram os pontos de bônus" chega no fim e ajuda.
- Mensagens de erro: "Informe o nome" (certa, mas fora da tela); "Escolha as prioridades deste grupo antes de distribuir os pontos." (diz o que fazer, não diz o que é prioridade, e fica na tela depois de resolvido); "os 7 pontos básicos já foram usados... use os pontos de bônus" (não diz como); "**os 13 pontos básicos já foram usados**" com o contador em **3/13** (errada para o caso).
- Hesitei, voltei ou errei em: lista de clãs sem título; prioridades; "use os pontos de bônus"; mensagem 3/13; "Salvo" × "3 alterações"; perda no F5; "Concluir criação" sem "enviar ao narrador".
- Desnecessário ou longo demais: abrir a ficha em "Jogo" e ter que trocar para "Criação"; folha de confirmação a cada salvar; Disciplinas e Antecedentes exigem abrir uma folha para subir 1 ponto (Atributos têm −/+ na linha); em 390 Atributos e Habilidades ficam atrás de abas (Físicos/Sociais/Mentais e Talentos/Perícias/Conhecimentos), o que multiplica toques.
- Pensando em voz alta:
  > "Essa lista de nomes esquisitos sem título, é pra escolher o quê? Raça? Time?"
  > "Como assim usei os 13? Diz 3 de 13 bem ali."
  > "Por que isso fica escondido numa aba chamada 'Orçamento'? Achei que era coisa de dinheiro."
  > "Então sou eu que concluo? Meu amigo disse que ele ia olhar a ficha."
- Diferenças 390 × 1280: 1280 é melhor na criação (três grupos de Atributos lado a lado com os contadores, cabeçalho inteiro com "Histórico", "Em jogo" por extenso em vez de "FdV"). 390 tem o "Histórico" fora da tela (página rola de lado), "Comportamen/to" quebrado e mais abas. Nos dois, "Orçamento" escondido e o bloco "Em jogo" antes dos Atributos.
- Descompasso com o briefing (dado do teste): nesta crônica por pontos sem aprovação **não existe passo de "enviar ao narrador"**; o jogador conclui sozinho. "Salvar alterações" vira "Concluir criação" assim que os pontos básicos acabam, e a partir daí **não dá para salvar sem concluir**. A persona **não entende** o que "concluir" significa para o narrador: "subir um traço passa pelo narrador" fala do depois, não diz se o narrador foi avisado nem se ainda pode corrigir algo.
- SEQ: 2, porque só achei o caminho por tentativa e erro, perdi trabalho uma vez e não entendi metade dos termos.
- Evidências: img/iniciante-web/20 a 69; requisições POST /chronicles/<id>/characters 201, POST /characters/<id>/events 200 (×3), POST /characters/<id>/creation/complete 200.

## Tarefa 4: Sair e voltar no meio
- Resultado: com dificuldade (1ª vez perdi os pontos; 2ª vez o app avisou, mas não deixou salvar)
- Passos: (a) F5 com 3 alterações pendentes → aviso genérico do navegador → aceitei → perdi os pontos (a prioridade ficou). (b) "‹ Vampiro v4" com 5 alterações pendentes → "Sair sem salvar?" → só "Continuar editando" ou "Descartar e sair". Antes, na fase do bloqueio de ambiente, também testei F5 + voltar + sair/entrar. · Cliques/toques: 6 · Rolagens: 2 · Telas: 3
- Hesitei em: acreditar no "Salvo" verde do cabeçalho; procurar "Salvar e sair".
- Pensando em voz alta:
  > "Perdi o que tinha feito. Mas o '7' ficou marcado... uma parte salva sozinha e outra não? E lá em cima dizia 'Salvo'!"
  > "Cadê 'Salvar e sair'?"
- Sei onde parei ao voltar? Mais ou menos: a ficha volta em "Jogo"; em "Criação", o "0/7" mostra a prioridade escolhida, mas nada diz que eu tinha alterações perdidas nem me leva ao ponto onde parei.
- Diferenças 390 × 1280: nenhuma no comportamento.
- SEQ: 3, porque o indicador "Salvo" mente quando há alterações pendentes e depois dos básicos não existe "salvar sem concluir".
- Evidências: img/iniciante-web/39, 40, 58; diálogo `beforeunload` capturado; console "GO_BACK was not handled" (só dev) quando o "Voltar" do cabeçalho falha depois do F5.

## Tarefa 5: Depois de entregar
- Resultado: com dificuldade (vi tudo, mas não entendi em que pé estou)
- Passos: toast → topo da ficha → "Editar" → "Experiência" → crônica → lista de crônicas → (1280) "Histórico" · Cliques/toques: 9 · Rolagens: 2 · Telas: 3 + 2 folhas
- Pensando em voz alta:
  > "Ele sabe que eu terminei?"
  > "Peça ao narrador como? Mando mensagem no WhatsApp?"
- Diferenças 390 × 1280: só em 1280 dá para abrir o "Histórico" (em 390 o botão fica fora da tela).
- SEQ: 3, porque o único sinal de "concluída" é um toast que some; a ficha e a crônica ficam iguais a antes.
- Evidências: img/iniciante-web/68 a 76

## Achados
Sistema de todos: Vampiro V20 (crônica "Vampiro v4 · 11-01 12:06", por pontos, sem aprovação). Config. "ambas" = 390 e 1280.

| ID | Tipo | Severidade sugerida | Tela | Config. | Sistema | Descrição | Passos para reproduzir | Esperado × obtido | Evidência | Visto/suposto | Atrapalha a criação? | Recomendação (escopo) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| IW-01 | feedback | alta | Ficha, modo Criação | ambas | Vampiro (genérico) | O cabeçalho mostra o ponto verde "Salvo" enquanto a barra diz "N alterações" não salvas. A prioridade grava sozinha, os pontos não. Num F5 a persona perdeu os pontos achando que estavam salvos. | Criação → escolher prioridade → subir 3 traços → ver "Salvo" no topo → F5 → aceitar o aviso do navegador | Esperado: "Não salvo · 3 alterações" (ou salvar sozinho) × obtido: "Salvo" + perda dos pontos, prioridade mantida | img/iniciante-web/37, 39, 40 | visto | sim | O indicador do cabeçalho reflete as alterações pendentes ("3 não salvas"); ou rascunho local que sobrevive ao F5 e é oferecido de volta ao reabrir. **Genérica** |
| IW-02 | simplificação | alta | Ficha, modo Criação | ambas | Vampiro (genérico) | Quando os pontos básicos acabam, "Salvar alterações" vira "Concluir criação". Daí em diante não dá para guardar o que foi feito sem concluir; "Sair sem salvar?" só oferece "Continuar editando" ou "Descartar e sair". | Completar todos os básicos → mexer em algo → tentar salvar ou sair | Esperado: "Salvar" e "Concluir" separados, e "Salvar e sair" no aviso × obtido: só concluir ou descartar | img/iniciante-web/56, 58 | visto | sim | Manter "Salvar" sempre disponível na criação; "Concluir criação" como ação separada; no aviso de saída, "Salvar e sair". **Genérica** |
| IW-03 | bug funcional | alta | Ficha, Criação, Habilidades | ambas | Vampiro | Ao tentar subir uma Habilidade de 3 para 4 com pontos básicos, aparece "Talentos: os 13 pontos básicos já foram usados..." com o contador mostrando 3/13. A regra real (teto de 3 na criação, suposto) não é dita. | Talentos → prioridade 13 → "+" 4 vezes em Prontidão | Esperado: "Na criação, cada Habilidade vai até 3 com pontos básicos; acima disso custa bônus" × obtido: mensagem de orçamento esgotado com 10 pontos sobrando | img/iniciante-web/47 | visto (mensagem); suposto (motivo) | sim | Mensagem distinta para "teto por traço" e "orçamento do grupo", com o número do teto. Mensagem **genérica**; o teto vem do **template** |
| IW-04 | orientação | alta | Ficha recém-criada | ambas | Vampiro (genérico) | A ficha nova abre no modo "Jogo", com tudo em 1 e "Nada para mostrar em Talentos". Nada diz "distribua seus pontos" nem leva à criação. | Criar ficha → abrir | Esperado: abrir em "Criação" (ou um aviso "Criação pendente: distribuir pontos") × obtido: modo Jogo, sem chamada | img/iniciante-web/30 | visto | sim | Ficha com criação pendente abre em "Criação" e mostra um selo "Em criação" na ficha e na lista da crônica. **Genérica** |
| IW-05 | orientação | alta | Ficha, aba "Orçamento" | ambas | Vampiro (genérico) | O resumo "O que falta" (por grupo) e a explicação de pontos básicos × bônus ficam na 4ª aba, chamada "Orçamento". As mensagens de erro ("use os pontos de bônus") não levam até lá; os itens da lista não são tocáveis. | Criação → procurar quanto falta | Esperado: resumo sempre visível (na barra fixa ou no topo) e itens que levam ao grupo × obtido: aba escondida, texto puro | img/iniciante-web/41, 57, 67 | visto | sim | Levar "O que falta" para a barra de criação (ex.: "Faltam: Físicos 7, Virtudes 7..."), com toque que rola até o grupo; renomear para "Pontos". **Genérica** |
| IW-06 | clareza | alta | Nova ficha e ficha | ambas | Vampiro | Nenhum termo do jogo tem explicação: Clã, Natureza, Comportamento, Conceito, Senhor, Geração, Disciplinas, Antecedentes, Virtudes, Humanidade, Força de Vontade ("FdV" sozinho no rodapé), pontos de bônus. Listas de arquétipos (42), disciplinas (17) e antecedentes (10) sem descrição; Virtude "Consciência" e Talento "Consciência" com o mesmo nome e sem a ajuda visível. | Seguir a criação | Esperado: uma linha "o que é isto" por campo × obtido: só o nome | img/iniciante-web/20, 23, 30, 51, 55 | visto | sim | Ícone "?" com a `help` do campo (o template já tem `help` em alguns campos, que não apareceu na tela) e uma frase curta por opção quando a licença permitir (sem copiar texto protegido; ex.: "Senhor: quem transformou seu personagem"). UI **genérica** + textos **de template** |
| IW-07 | clareza | alta | Nova ficha | ambas | Vampiro (genérico) | A grade de 14 clãs não tem título visível ("Clã" só existe para o leitor de tela). | Nova ficha → rolar até a grade | Esperado: título "Clã" acima × obtido: lista solta | img/iniciante-web/21, 25 | visto | sim | Mostrar o rótulo do campo `choice` como título do grupo. **Genérica** |
| IW-08 | orientação | média | Concluir criação e depois | ambas | Vampiro (genérico) | Depois de concluir, o único sinal é um toast que some (e cobre o painel do rodapé). A ficha e a crônica ficam iguais a antes, o "Histórico" não registra a conclusão e nada diz se o narrador foi avisado. Nesta crônica não há passo "enviar ao narrador", e o texto "subir um traço passa pelo narrador" não explica o que muda. | Concluir criação → olhar ficha, crônica e histórico | Esperado: selo "Criação concluída em <data>" na ficha e na lista, evento no histórico, frase "o narrador pode ver sua ficha; para mudar algo agora, peça em Experiência" × obtido: só o toast | img/iniciante-web/64, 68, 70, 73, 76 | visto | não (é depois) | Estado persistente da ficha + evento no histórico + texto do diálogo explicando o depois. **Genérica** |
| IW-09 | clareza | média | Criação, Prioridade | ambas | Vampiro (genérico) | Os círculos "7 5 3" e "13 9 5" não têm explicação; o erro só aparece ao clicar "+" e continua na tela depois de resolvido. | Criação → "+" em Força sem prioridade → escolher 7 | Esperado: dica "escolha qual grupo é o mais forte; cada valor vale para um grupo" e erro que some × obtido: números soltos e erro velho | img/iniciante-web/33, 35, 36 | visto | sim | Rótulo "Prioridade: quantos pontos este grupo recebe" e limpar o erro ao escolher. **Genérica** (valores do **template**) |
| IW-10 | clareza | média | Criação, bônus | ambas | Vampiro (genérico) | O custo em bônus (5 por Atributo, 7 por Disciplina, 1 por Antecedente, 2 por Habilidade) só aparece depois de gastar. "A conta fechou: conclua" aparece com 15 de bônus sobrando. "Bônus: 0 de 15" se lê como "usei 0". | Gastar bônus em vários grupos | Esperado: custo visível antes ("+ = 5 bônus") e "restam 0 de 15" × obtido: custo descoberto ao clicar | img/iniciante-web/57, 60, 62 | visto | sim | Mostrar o custo no "+" quando estiver na fase de bônus; tabela de custos no resumo; "restam N de 15". **Genérica** (custos do **template**) |
| IW-11 | layout | média | Ficha (cabeçalho) | 390 | Vampiro (genérico) | Em 390 o botão "Histórico" fica fora da tela (x 372–481); a página rola na horizontal (scrollWidth 482). | Abrir uma ficha em 390 | Esperado: botão visível ou num menu × obtido: cortado | img/iniciante-web/30 (medida via bounding box) | visto | não | Colapsar ações do cabeçalho num menu em telas estreitas. **Genérica** |
| IW-12 | bug funcional | média | Nova ficha (cabeçalho) | ambas | Vampiro (genérico) | Depois de F5 numa tela interna, o "‹ <crônica>" do cabeçalho não faz nada (console: "GO_BACK was not handled", aviso só dev). Só o Voltar do navegador sai. | Abrir Nova ficha → F5 → tocar "‹ Vampiro v4" | Esperado: ir para a crônica × obtido: nada | img/iniciante-web/15; console | visto | sim (prende a pessoa) | Sem histórico de navegação, o "Voltar" navega para a rota-pai. **Genérica** |
| IW-13 | orientação | média | Crônica | ambas | Vampiro (genérico) | O botão mais forte da crônica é o vermelho cheio "Sair da crônica"; "Nova ficha" (o próximo passo) é contorno. O estado vazio "Você ainda não tem ficha" não convida a criar. Na lista, a ficha não tem estado ("em criação"). | Entrar pela primeira vez | Esperado: "Criar minha ficha" em destaque no estado vazio; "Sair" discreto × obtido: o contrário | img/iniciante-web/10, 11, 28 | visto | sim | Botão primário no estado vazio; ação destrutiva como texto/contorno; selo de estado na lista. **Genérica** |
| IW-14 | orientação | média | Crônicas (vazio) | ambas | Vampiro (genérico) | Para quem chega com convite, o destaque é "Criar crônica"; a palavra "ficha" não aparece; "TMS" não diz o que é. | Primeiro login | Esperado: "Recebeu um código do narrador? Entrar com convite" em destaque × obtido: destaque para narrar | img/iniciante-web/01, 06 | visto | não | Estado vazio com as duas rotas explicadas ("Vou jogar" / "Vou narrar"). **Genérica** |
| IW-15 | feedback | média | Nova ficha | 390 | Vampiro (genérico) | "Criar ficha" vazio mostra "Informe o nome" fora da tela; a página não rola e o foco fica no botão. | Nova ficha → rolar até o fim → "Criar ficha" | Esperado: rolar e focar o campo × obtido: erro acima da dobra | img/iniciante-web/22 | visto | sim | Focar o primeiro campo inválido. **Genérica** |
| IW-16 | clareza | média | Adicionar Disciplina | ambas | Vampiro | A lista não marca as Disciplinas do clã escolhido. | Clã Toreador → Adicionar Disciplina | Esperado: "do seu clã" nas 3 do clã × obtido: 17 nomes iguais | img/iniciante-web/51 | visto | sim | Marcar opções recomendadas a partir do clã. Dados **de template** (clã → disciplinas) + UI **genérica** ("recomendadas") |
| IW-17 | clareza | média | "Atualize o app" | ambas | Vampiro (genérico) | **Causa = ambiente** (front antigo). Ainda assim, a mensagem não serve para o web: sem botão de recarregar e sem "fale com o narrador". | (só reproduz com front desatualizado) | Esperado: "Recarregue a página" + botão × obtido: texto sem ação | img/iniciante-web/12, 14 | visto | sim (no ambiente quebrado) | No web, texto e botão "Recarregar"; no app, link para a loja. **Genérica** |
| IW-18 | clareza | baixa | Cadastro | ambas | — | "De 3 a 24 caracteres: letras minúsculas, números e _" para "Lucas Novato" (12 caracteres): não diz que o problema é a maiúscula ou o espaço. Os erros não somem ao corrigir; a dica "Uma frase funciona bem." some com o erro. | Cadastro com "Lucas Novato" e senha curta | Esperado: "Use só minúsculas, sem espaço (ex.: lucas_novato)" × obtido: regra genérica | img/iniciante-web/05 | visto | não | Mensagem específica + validar ao digitar. **Genérica** |
| IW-19 | bug visual | baixa | Cadastro | 390 | — | O contador "0/24" encosta no texto de ajuda ("números0/24 e _."). | Abrir cadastro em 390 | Texto e contador separados × sobrepostos | img/iniciante-web/03 | visto | não | Contador em linha própria. **Genérica** |
| IW-20 | bug visual | baixa | Ficha | 390 | Vampiro (genérico) | "Comportamen/to" quebra no meio da palavra; números dos traços encostam/passam da borda do cartão no modo Jogo; "Participantes" desalinhado 16 px. | Abrir ficha e crônica em 390 | Alinhado × quebrado | img/iniciante-web/32, 68, 10 | visto | não | Hifenização/elipse no rótulo; padding no cartão. **Genérica** / **skin** |
| IW-21 | clareza | baixa | Vantagens | ambas | Vampiro (genérico) | Títulos duplicados com números diferentes ("Disciplinas 0/3" + "Disciplinas 0"); "Nenhum Qualidade". | Aba Vantagens | Um título com o orçamento × dois títulos | img/iniciante-web/50 | visto | não | Um só título; concordância por gênero do `itemLabel`. **Genérica** |
| IW-22 | simplificação | baixa | Vantagens | ambas | Vampiro (genérico) | Disciplinas e Antecedentes exigem abrir uma folha e "Aplicar" para subir 1 ponto; Atributos e Habilidades têm −/+ na linha. | Adicionar Presença → subir para 2 | Mesmo controle × dois padrões | img/iniciante-web/53 | visto | um pouco | −/+ na linha dos itens de lista também. **Genérica** |
| IW-23 | clareza | baixa | Salvar / Histórico | ambas | Vampiro (genérico) | "Aparência 0 → 3" na folha de salvar e "1 → 3" no histórico; Humanidade e Força de Vontade mudam sozinhas sem aviso e o histórico as atribui ao jogador; a lista de salvar vem fora de ordem. | Salvar Sociais; abrir Histórico | Valores coerentes e agrupados × divergentes | img/iniciante-web/49, 76 | visto | não | Usar o valor exibido no diff; marcar derivados como "calculado"; ordenar por seção. **Genérica** |
| IW-24 | acessibilidade | baixa | Folhas (dialog) | ambas | Vampiro (genérico) | Destrutivo ("Descartar", vermelho cheio) ao lado de "Salvar" com o mesmo peso; cada folha tem dois botões "Fechar" (o fundo e o ×). | Salvar alterações | Destrutivo secundário × mesmo peso | img/iniciante-web/44 | visto | não | "Descartar" como texto; fundo fora da ordem de foco. **Genérica** |
| IW-25 | clareza | baixa | Editar (após concluir) | ambas | Vampiro (genérico) | Cada traço diz "Peça ao narrador." sem link; o pedido fica em "Experiência → Solicitar evolução". | Concluir → Editar | Link "Pedir ao narrador" × texto solto | img/iniciante-web/71, 72 | visto | não | Tornar "Peça ao narrador" um link para o pedido. **Genérica** |
| — | ambiente | — | Ficha | ambas | — | Tela vermelha "(0, _expoRouter.usePreventRemove) is not a function" ao abrir a ficha (LeaveGuard). Causa: dependências antigas do Expo; corrigido pelo orquestrador. | — | — | img/iniciante-web/26, 29 | visto | sim (no ambiente quebrado) | — |
| — | ambiente | — | Nova ficha | ambas | — | "Atualize o app" ao abrir Nova ficha: front servindo código antigo das fichas; corrigido pelo orquestrador. A clareza da mensagem está em IW-17. | — | — | img/iniciante-web/12 a 14 | visto | sim (no ambiente quebrado) | — |

Pontos positivos (para manter): o cadastro valida no cliente sem gastar tentativas; a tela de convite é clara ("Peça o código ao narrador. Pode digitar com ou sem espaços."); escolher 7 em Físicos já distribui 5 e 3 nos outros grupos; os contadores "N/7" por grupo; a folha "Salvar N alterações?" com antes → depois; o aviso "Começaram os pontos de bônus" com "Ver orçamento"; o "Sair sem salvar?" do app; o toast com "Desfazer"; Esc fecha as folhas; em 1280 os três grupos de Atributos lado a lado.

## Cobertura
- Testado (web, Chromium, 390×844 com comparação em 1280×800 em cada passo principal): cadastro (com erro de nome e senha), login/logout, convite, crônica (Fichas, Diário, Participantes), Conta, Nova ficha (identidade, lista de Natureza e Comportamento, erro de nome vazio), ficha em Jogo, Criação (prioridades, Atributos, Habilidades, Vantagens, Virtudes, bônus, Orçamento, Sobre), salvar com confirmação, interrupção por F5 e pelo "Voltar" do app, conclusão, modo Editar, Experiência, Histórico (só em 1280).
- Conta: iniciante.web.6761@roteiro.test (`lucas_novato6761`), 1 cadastro. Convite (código omitido) usado uma vez. Ficha: "Tiago Sombra (iniciante web)", Toreador, criação concluída.
- Sem teste: Qualidades e Defeitos (a persona não viu motivo para mexer), Especializações, "Dados" (rolagem), offline, teclado completo e leitor de tela além da árvore de acessibilidade, WebKit/Safari, app nativo (fora do escopo deste agente).
- Interrupções de ambiente: ~12:18 a 12:22 ("Atualize o app") e ~12:24 a 12:47 (tela vermelha `usePreventRemove`, pausa pedida pelo orquestrador). Nada disso conta como defeito do produto.

## Primeira impressão (na voz da persona)
1. "Ninguém me explicou o que é nada. Clã, Natureza, Comportamento, Senhor, Disciplina, Antecedente, Virtude, FdV... escolhi tudo pelo som do nome. E a lista dos clãs nem tinha título; eu nem sabia que estava escolhendo um clã."
2. "Abri a ficha e estava em 'Jogo', com tudo em 1. Ninguém falou 'agora distribua seus pontos'. Só achei quanto faltava numa aba chamada 'Orçamento', que eu achei que era de dinheiro."
3. "Estava escrito 'Salvo' lá em cima, eu recarreguei e perdi o que tinha feito. Depois, quando quis salvar e sair, só dava para 'concluir' ou 'descartar'."
4. "A mensagem disse que eu tinha usado os 13 pontos, mas o contador mostrava 3 de 13. E 'use os pontos de bônus'... como? O '+' de sempre gastou 5 de uma vez sem avisar."
5. "Meu amigo disse que ia olhar a ficha, mas o botão era 'Concluir criação', sem 'mandar para o narrador'. Concluí, apareceu um aviso que sumiu, e a ficha ficou igualzinha. Não sei se ele sabe que eu terminei nem o que acontece agora."
