# PO do TMS: web
Conta(s): `roteiro_po_web@roteiro.test` (narrador), `roteiro_po_web_jogador@roteiro.test` (jogador), senha padrão do roteiro · Plataforma: web (Expo dev server, Chromium via Playwright, porta 9602), 390×844 e 1280×800 · Início e fim: 12:13 – 13:25 (pausas do ambiente: 12:18–12:20 e 12:31–12:46)

Leitura prévia: §1 de `doc/plano-v0.md` a `doc/plano-v5.md`, `doc/painel-narrador.md` §2 e §5.1 a §5.9.

## Diário (vou acrescentando)

- 12:14: entrei como narrador PO. Crônicas vazia, com "Criar crônica" e "Entrar com convite" (img/po-web/01-cronicas-vazia-390.webp). Claro.
- 12:15: "Nova crônica" pede nome e sistema, e só isso (img/po-web/02-nova-cronica-390.webp). Não há modo de criação nem aprovação aqui: as duas opções aparecem **depois**, no topo da crônica criada, em "Criação de fichas".
- 12:15: criei "Vampiro livre (PO web)". O topo da crônica mostra "Criação de fichas › Como funciona" com um par de rádios "Desligada / Ligada" sem dizer que aquilo é a **aprovação do narrador** (o nome "Aprovação do narrador" só existe no leitor de tela), e a frase "Este sistema usa criação livre; não há orçamento por pontos para configurar." **No Vampiro V20**, que o plano v4 diz ser por pontos (prioridades 7/5/3) (img/po-web/03-cronica-criada-390.webp).
- 12:16: criei "Lobisomem por pontos (PO web)" e "Vampiro por pontos (PO web)". As duas mostram a mesma frase de criação livre (img/po-web/04-cronica-lobisomem-390.webp, img/po-web/07-cronica-vampiro-pontos-1280.webp). Não há como escolher "Por pontos" na tela.
- 12:17: "Nova ficha" (do narrador, só para ver o formulário, sem enviar) abre **"Atualize o app — Este sistema usa uma versão que este app ainda não conhece."** (img/po-web/05-nova-ficha-atualize-o-app-390.webp, img/po-web/06-nova-ficha-atualize-o-app-1280.webp).
  - Investigação (só leitura): o banco tem publicados `vtm-v20` 1.8.0, `wta-w20` 1.6.0 e `mta-m20` 1.6.0, todos com a chave `creation`. O Metro resolve `@tms/sheet-core` pelo `main` (`./dist/index.js`), e `packages/sheet-core/dist/` é de **18/10** (16 arquivos .js; o `src/` tem 26 .ts, e o dist nem exporta `effectiveCreationConfig`). O `compileTemplate` antigo recusa os templates de hoje, o `compileSafe` devolve `null`, e daí saem as duas telas: "criação livre" na configuração e "Atualize o app" na ficha.
  - **É ambiente (build velho do pacote), não defeito do produto**, mas bloqueia a criação de ficha no web. Avisei o orquestrador (12:18). Não reconstruí o pacote: o briefing proíbe mexer no repositório.
  - Mesmo assim, há um achado de produto: a configuração diz com segurança "Este sistema usa criação livre" quando, na verdade, o app **não conseguiu ler** o template. O texto mascara o erro e leva o narrador a decidir errado (ver POW-02).

- **12:19 a 12:22: correção do ambiente.** O orquestrador reconstruiu os pacotes compartilhados e reiniciou a API e o Metro. Tudo o que vem acima com "Atualize o app" ou "usa criação livre" foi **ambiente** (build velho do `@tms/sheet-core`), não defeito do produto. Das observações de antes, só valem as de UX: o texto afirma "criação livre" quando o app não entendeu o template (POW-02), e "Atualize o app" não diz o que fazer no web, onde não há loja (POW-03).
- 12:20: depois do novo bundle, "Criação de fichas" mostra dois pares de rádios sem rótulo visível ("Desligada / Ligada" e "Por pontos / Livre") e o Orçamento com steppers (Atributos 7/5/3, Habilidades 13/9/5, Disciplinas 3, Antecedentes 5, Virtudes 7, bônus 15) (img/po-web/15-criacao-fichas-pontos-390.webp). Corrigi pela tela o modo das três crônicas criadas antes da correção:
  - "Vampiro por pontos (PO web)": Por pontos, com a aprovação Ligada. Salvei e apareceu o toast "Regras da criação salvas." (img/po-web/16-aprovacao-ligada-salva-390.webp).
  - "Vampiro livre (PO web)": Livre, com a aprovação Desligada (img/po-web/17-modo-livre-390.webp).
  - "Lobisomem por pontos (PO web)": Por pontos, com a aprovação Ligada (orçamento com "Dons 3").
  - Na 1280 (img/po-web/07), "Participantes" fica fora do alinhamento do resto (sem a margem de 16 px), e o toast cobre o nome do primeiro participante.
- Convites: "Convidar" abre uma folha com "Gerar convite"; o código aparece uma vez ("só aparece agora: copie antes de fechar"), com "Copiar código", "Compartilhar", usos restantes e validade (img/po-web/09-convite-gerado-1280.webp, img/po-web/10-convite-gerado-390.webp). O jogador entrou nas três crônicas pelo "Entrar com convite"; o código digitado em minúsculas também foi aceito (img/po-web/12-jogador-entrou-vlivre-390.webp, img/po-web/13-jogador-cronicas-390.webp). Sem atrito.

- 12:21: o jogador cria a identidade na "Vampiro livre". O formulário traz Nome, Natureza e Comportamento (com "Escolher da lista"), Conceito, Senhor e Clã (img/po-web/18-jogador-nova-ficha-vlivre-390.webp). Faltam duas coisas que o plano v0 §1.4 lista: **Geração** (o template a tem na identidade, mas o formulário não a pede) e o **rótulo visível "Clã"** (os 14 rádios aparecem sem título; o nome só existe no leitor de tela). "Escolher da lista" abre uma folha com os 42 arquétipos e preenche o campo: bom (img/po-web/19-escolher-da-lista-natureza-390.webp).
- 12:21: em "Criar ficha", a ficha é criada, mas a tela dela quebra: `TypeError: (0, _expoRouter.usePreventRemove) is not a function` em `sheet/evolve/LeaveGuard.tsx`. O app volta para a crônica com o toast vermelho do LogBox (img/po-web/21-ficha-criada-livre-390.webp). **Ambiente**: o `node_modules` é de 18/10 (expo 54, expo-router 6.0.24) e o `package.json` pede o Expo SDK 58 desde o b9df17e (26/10). Avisei o orquestrador às 12:24. O mesmo acontece no Vampiro por pontos (Nosferatu, criado na 1280) e no Lobisomem; no Lobisomem, o app volta para o formulário **vazio**, e parece que a ficha não foi criada, mas foi (GET /characters/76bd… 200).
- O formulário do jogador é igual na crônica livre e na por pontos (img/po-web/23-nova-ficha-vpontos-1280.webp). Nada avisa que haverá prioridades, orçamento ou aprovação do narrador.
- Lobisomem: o formulário pede Nome, Nome de feito, Conceito, Seita, Campo, Nome da matilha, Totem da matilha, Raça, Augúrio (com a fase da lua), Tribo e Posto (img/po-web/24-nova-ficha-lobisomem-390.webp, img/po-web/25-lobisomem-identidade-fim-390.webp). Bate com o plano v2 §1.2 e acrescenta Campo, Nome da matilha e Posto. Raça, Augúrio e Tribo também aparecem **sem título visível**. O Posto começa em 0.
- 12:24: Mesa do narrador (Vampiro por pontos). A linha diz "Rafael Duarte (PO web) · Nosferatu · Em criação · roteiro_po_web_jogador · **alterada às 15:23**", às 12:24 de Brasília (img/po-web/27-mesa-narrador-390.webp). No mesmo instante, o feed diz "Atualizado às 12:24:05". Conferi no banco: `characters.updated_at` é `timestamp without time zone`, gravado em UTC, e o app o mostra como hora local, **3 h adiantada** (POW-05).
- Bastidores (narrador): Diário da crônica (data, título, resumo público e notas privadas, com "Nunca são enviadas aos jogadores"), Apresentação (nome, descrição e imagem HTTPS), Transferir narração ("Propor"), Auditoria com filtro por ficha e por data. Na auditoria aparece o código cru **"chronicle.creation.settings"** em vez de uma frase (POW-06).

- 12:25: parada livre na Mesa (1280). Rótulo "Percepção do guarda", 5 dados, dificuldade 6, "Oculta" já marcada por padrão (como diz o plano v5 §1.4). O resultado entrou no feed como "2 sucessos · 5d10 · dificuldade 6 · Oculta · Parada livre" (img/po-web/30-parada-livre-antes-1280.webp, img/po-web/31-parada-livre-resultado-1280.webp). Os dois steppers aparecem como "− 5 +  − 6 +", **sem os rótulos "Dados" e "Dificuldade" na tela** (só no leitor de tela). "Oculta" e "Especialização" usam `aria-selected` num botão, onde o certo seria `aria-pressed`. Na 1280, a linha da Mesa empilha Vitalidade, Sangue e FdV numa coluna estreita no centro da tela.
- 12:25: Conta mostra só "Você entrou como…" e "Excluir conta" (img/po-web/29-conta-390.webp). O texto manda "exclua a crônica antes" quando há jogadores, e não cita a **transferência da narração** (v5), que é justamente o caminho para sair sem apagar a crônica.

- **12:31 a 12:46: pausa do ambiente.** O orquestrador reinstalou as dependências (`pnpm install --frozen-lockfile`, com expo-router 58.0.26), recompilou e reiniciou a API e o Metro. O `usePreventRemove is not a function` foi **ambiente**. Nesse intervalo, só li os planos e os documentos de pendências.

### Depois da correção do ambiente (12:47 em diante; os horários abaixo são do relógio local)

**Vampiro livre: Helena Vasconcelos (PO web), na 390.**
- 12:47: a ficha abre em **Jogo**, não em Evoluir/Editar (plano v0 §1.5). A chegada com `?mode=` só vale na primeira abertura, que foi a que quebrou no ambiente velho, então isso fica **sem prova** aqui. O mais grave é outro: **nenhum lugar da ficha diz "Em criação", "criação livre", nem o que fazer em seguida** (procurei nas abas Ficha, Vantagens e Sobre e no menu ⋯). Na 390, a barra do topo corta "Histórico" ("H…", fora da tela) (img/po-web/32-ficha-livre-abre-390.webp).
- No modo "Editar", a barra diz "Editando · 0 alterações" e tem um botão **"Concluir"**. Na identidade, "Comportamento" quebra no meio da palavra ("Comportamen/to") (img/po-web/33-ficha-livre-editar-390.webp).
- Distribuí os Atributos, as Habilidades, Auspícios 1, Presença 2, Recursos 1 e as Virtudes. Sem contador, como o plano promete para o modo livre. A Humanidade acompanhou Consciência + Autocontrole (6) e a FdV acompanhou a Coragem (4). O seletor de Disciplina lista as 17 sem destacar as 3 do clã (img/po-web/36-adicionar-disciplina-390.webp). Erros de concordância: "Nenhum Qualidade". A "Fraqueza do clã" fica vazia.
- "Concluir" abre **"Salvar 16 alterações?"** (img/po-web/40-concluir-resumo-390.webp). Ou seja, "Concluir" aqui é **salvar**, e não concluir a criação. A lista vem em ordem embaralhada (Raciocínio, Briga, Coragem, Empatia…), e "Aparência 0 → 4" contradiz a ficha, que mostrava Aparência 1. Salvei: **um** lote (`POST /events`, 200). Bate com o plano v0 §1.5.
- Como jogador, não há "entregar" nem "pedir para concluir". O menu ⋯ só tem "Despertar (nova noite)" (img/po-web/42-acoes-da-ficha-jogador-livre-390.webp). Ninguém avisa que quem conclui é o narrador.
- 12:50: como narrador, a ficha abre em Leitura. O menu "Ações do narrador" tem "Concluir criação", "Arquivar" e "Marcar como Torpor" (img/po-web/44-acoes-do-narrador-livre-390.webp). Um toque, sem confirmação, e o toast diz "Criação concluída. Subir um traço agora passa por você." (img/po-web/45-concluir-criacao-confirmacao-390.webp). Na 390, "Histórico" também fica fora da tela no topo do narrador. Há "Editar como narrador" e também o rádio "Editar": dois caminhos para a mesma coisa.

**Vampiro por pontos: Rafael Duarte (PO web), Nosferatu, na 1280, com a aprovação Ligada.**
- 12:51: a ficha abre em Jogo, com os modos "Jogo / Criação". De novo, **nada indica "Em criação" nem "distribua os pontos"** até clicar em "Criação" (img/po-web/46-ficha-pontos-abre-1280.webp).
- Em "Criação", a barra diz "Criação · 0 alterações · Bônus: 15 de 15" e "Salvar alterações". Há uma aba nova, "Orçamento", e cada grupo tem "Prioridade 7 5 3" (img/po-web/47-modo-criacao-1280.webp, img/po-web/48-criacao-prioridades-1280.webp).
- Subir Força sem prioridade: a mudança é recusada, com a frase "Escolha as prioridades deste grupo antes de distribuir os pontos." no grupo (img/po-web/49-sem-prioridade-forca-1280.webp). Bate com o §3.6 do v4. Depois de escolher a prioridade, a frase vermelha **continua lá** até a próxima mudança (img/po-web/50-prioridades-escolhidas-1280.webp). Os contadores "0/5", "0/3", "0/7" aparecem pequenos e cinza, no lugar do rótulo "Prioridade".
- Nosferatu: subir Aparência dá "Aparência: não sobe na criação." Funciona, mas não diz por quê (o clã) (img/po-web/51-atributos-distribuidos-aparencia-1280.webp).
- Salvei as Habilidades com Perícias em 10/13 (`POST /events` 200). A aba Orçamento lista "O que falta": "Perícias: faltam 3 pontos básicos. Disciplinas: faltam 3… Antecedentes: faltam 5… Virtudes: faltam 7…" (img/po-web/55-aba-orcamento-1280.webp). Ótimo. Mas **não há botão para tentar concluir** com grupo incompleto: o "Enviar para aprovação" só aparece quando a conta fecha. O passo 4 da jornada v4 ("tenta concluir… é recusada e o problema aparece naquele grupo") não se reproduz pela tela: é prevenido, não recusado. Para o usuário, é melhor, mas o plano descreve outra coisa.
- 12:53: com os básicos completos, aparece a folha **"Começaram os pontos de bônus"** ("…cada ponto a mais gasta os pontos de bônus: restam 15", com "Ver orçamento" e "Entendi") e o botão "Enviar para aprovação" na barra (img/po-web/58-vantagens-basicos-completos-1280.webp). Muito claro.
- Gastei 11 de 15 nos bônus: Ofuscação 3 (7), FdV +2 (2) e Furtividade 4 (2). As contas batem com `regras-wod.md`. A FdV **atual** ficou em 4 com a permanente em 6 (img/po-web/59-bonus-gastos-orcamento-1280.webp). A aba Orçamento diz "A conta fechou: conclua a criação pela barra de cima."
- "Enviar para aprovação" com 8 alterações pendentes: a confirmação diz "As alterações abaixo são salvas antes" e as lista. Uma delas aparece como "Força de Vontade permanente **— → 6**": o "de" sai vazio, o mesmo defeito que o plano v0 dá como corrigido para recursos. **Não avisa que sobraram 4 pontos de bônus**, que se perdem (img/po-web/60-enviar-aprovacao-1280.webp). Depois do envio, a barra diz "Aguardando aprovação · …somente para leitura" e os modos somem (img/po-web/61-enviada-pendente-1280.webp). Bate com o v4 §1.6.
- Narrador: a **aba Fichas** mostra o alerta "1 ficha aguarda sua revisão", e a linha diz "Aguarda sua revisão". Ótimo. A **Mesa** não mostra o estado: a linha não tem selo de pendente, e não há filtro de pendentes (img/po-web/62-mesa-pendente-1280.webp), embora o plano v4, Etapa 5.7, peça "Atualizar os filtros da Mesa para encontrar pendentes". A ficha do narrador mostra "Aguardando aprovação · Aprovar ficha · Devolver para correção" (img/po-web/63-narrador-ficha-pendente-1280.webp).
- **Devolver para correção** pede o motivo (até 500 caracteres) (img/po-web/64-devolver-dialogo-1280.webp). Ao voltar, o jogador abre a ficha em Jogo e **não vê que ela foi devolvida**: o banner "O narrador devolveu a ficha" e o motivo só aparecem no modo Criação (img/po-web/66-jogador-ficha-devolvida-1280.webp × img/po-web/67-jogador-devolvida-criacao-1280.webp).
- Corrigi o pedido (Esportes 3, Briga 3, FdV atual 6). Tentar passar do saldo é recusado na hora com "Bônus: 2 acima do saldo." (img/po-web/68-bonus-estourado-1280.webp). Reenviei. O narrador clicou em "Aprovar ficha", e o toast disse "Ficha aprovada e liberada." (img/po-web/69-aprovar-ficha-1280.webp). Ficou `active`.
- **Horário errado na Mesa (confirmado):** a ficha recém-criada aparece "alterada às 15:23" (UTC, 3 h adiantada) e, depois de um lote, "alterada às 12:54" (certo). No banco, `characters.updated_at` é `timestamp without time zone`: o default `now()` grava em UTC, e o lote grava a hora local. "Ordenar pela última alteração" fica errado entre fichas novas e editadas (POW-05).


**Lobisomem por pontos: Tiago Lobo-Cinza (PO web), Hominídeo, Ahroun, Fianna, na 390, com a aprovação Ligada.**
- Abre em Jogo, e de novo só se descobre a criação ao clicar em "Criação" (img/po-web/70-lobisomem-ficha-abre-390.webp, img/po-web/71-lobisomem-criacao-390.webp). Os derivados vieram certos pelo `regras-wod.md`: Fúria 5 (Ahroun), Gnose 1 (Hominídeo), FdV 3 (Fianna), Glória 2 e Honra 1. O resumo diz "Posto 0 · Filhote": no W20, o personagem novo começa como Cliath (Posto 1). O formulário de criação **mostra** o Posto, e o plano v2 (linha 155) diz que ele não mostraria.
- Na 390, os grupos viram abas (Físicos, Sociais, Mentais; Talentos, Perícias, Conhecimentos), e cada aba tem a sua prioridade. Distribuí 7/3/5 e 13/9/5 sem tropeço: o contador muda a cada toque (img/po-web/72-lobisomem-talentos-390.webp).
- **Dons:** "Adicionar Dom" abre só um campo "Nome", sem catálogo, sem nível e sem indicar quais Dons a Raça, o Augúrio e a Tribo dão (img/po-web/74-adicionar-dom-390.webp). Enter **não** adiciona: é preciso tocar em "Adicionar “Nome”". Fechar a folha descarta o que foi digitado. Os títulos se repetem: "Dons 0/3", "Dons 0/3", "Dons 0"; o mesmo vale para Antecedentes, Ritos e Fetiches.
- Com os básicos fechados, aparece de novo a folha "Começaram os pontos de bônus" (img/po-web/75-lobisomem-basicos-completos-390.webp). Gastei os 15: Gnose +2 (4), um quarto Dom (7), FdV +2 (2), Parentes +1 e Totem +1 (1 cada). As contas batem com a tabela. Gnose **atual** e FdV **atual** não acompanham a permanente (ficaram em 1 e 3); subi as duas à mão (img/po-web/76-lobisomem-bonus-fechado-390.webp).
- "Enviar para aprovação" lista 25 alterações, com "Gnose permanente — → 3" e "Força de Vontade permanente — → 5" (o "de" vazio de novo) (img/po-web/77-lobisomem-enviar-390.webp). Ficou "Aguardando aprovação".
- Narrador na 390: a aba Fichas mostra "1 ficha aguarda sua revisão"; abri e cliquei em "Aprovar ficha" (img/po-web/78-narrador-lobisomem-pendente-390.webp, img/po-web/79-narrador-lobisomem-aprovada-390.webp). **Na 390, o topo da ficha do narrador transborda**: "Histórico" fica em x=424 numa tela de 390 (`scrollWidth` 534), e a página ganha rolagem horizontal. Na tela só aparece "Experiência".


**Jornadas v3 a v5 na "Vampiro por pontos" (1280).**
- 13:02: **NPC.** "Criar NPC" abre "Novo NPC · O NPC nasce oculto e em criação livre. Só você o vê até escolher o que revelar." (img/po-web/80-novo-npc-1280.webp). Depois de "Criar ficha", a ficha abre **direto em Editar**: é a chegada que o plano v0 promete e que a ficha do jogador não teve por causa do ambiente (img/po-web/81-npc-criado-1280.webp). Concluí pela "Ações do narrador", que na tela aparece como **"Narrador · Em criação ▾"** (o nome acessível é outro, "Ações do narrador"). O jogador **não vê** o NPC oculto: nem na lista, nem na contagem ("1 personagem").
- 13:04: **Dano em grupo** (Mesa › Selecionar personagens › os dois › Aplicar dano › 2 › Letal › Ver prévia › Confirmar operação). A prévia mostra "Vitalidade: +2 letal" por ficha. Veio o toast "Dano aplicado em 2 personagens." com Desfazer, e "Desfazer" respondeu "Alteração desfeita." (img/po-web/84-aplicar-dano-1280.webp, img/po-web/85-previa-dano-1280.webp, img/po-web/86-dano-aplicado-snackbar-1280.webp, img/po-web/87-dano-desfeito-1280.webp). **O NPC não aparece numa seção própria da Mesa**: fica misturado aos PCs, sem selo de NPC (img/po-web/83-mesa-selecionar-1280.webp), embora o plano v5 §1.2 diga "aparece na seção própria da Mesa". As caixas de seleção ☐ são pequenas (cerca de 10 px).
- 13:04: **Nova noite**: "Desconta 1 ponto de Sangue… A recuperação opcional de FdV é decidida à parte", e a prévia "Sangue: 10 → 9" para cada ficha. Aplicou (img/po-web/88-nova-noite-previa-1280.webp).
- 13:05: **XP.** "Conceder XP" pela seleção da Mesa tem um stepper de +1 em +1: para dar 12 XP foram 11 cliques, sem campo para digitar. O motivo é obrigatório (img/po-web/89-conceder-xp-1280.webp). O jogador abre "Experiência" e vê "Disponível: 12 XP", o extrato e "Solicitar evolução" (img/po-web/90-jogador-experiencia-1280.webp). A lista tem cerca de 60 botões "Traço · de → para · custo", sem agrupar nem buscar (img/po-web/91-solicitar-evolucao-1280.webp). "Consciência" aparece duas vezes: uma é o Talento (0 → 1 · 3 XP), a outra a Virtude (3 → 4 · 6 XP). Os custos batem com `regras-wod.md`: Destreza 3 → 4 = 12, Ofuscação (do clã) 3 → 4 = 15, Disciplina nova 10. Ao tocar em "Destreza · 3 → 4 · 12 XP", a confirmação ("Destreza: 3 → 4. Custo 12 XP (disponível 12)." e "Enviar pedido") vai para o **fim da lista, fora da tela** (img/po-web/92-confirmar-pedido-1280.webp). Enviei, e o pedido ficou "Pendente", com "Cancelar pedido". Um segundo pedido sem saldo (Percepção 16 XP) mostra antes "Saldo insuficiente… o servidor vai recusar", mas o botão continua ativo, e o servidor recusa com "(disponível 12, custo 16)". Não criou pedido (img/po-web/93-pedido-sem-saldo-1280.webp). Bate com o v4 §1.9 e §1.11.
- O narrador acha o pedido pela Mesa ("Pedidos de XP (1)") e pela Experiência da ficha (img/po-web/94-narrador-experiencia-pedido-1280.webp). "Aprovar" deu Destreza 4, "Total 12 · Gasto 12", e o extrato "Destreza 3 → 4 · −12 XP" (img/po-web/95-xp-aprovado-1280.webp). Bate com o v4 §1.10.
- 13:07: **Rolagem oculta** do narrador na ficha do jogador (Dados › "Rolagem oculta" › Percepção + Prontidão = 6 dados › Rolar no app): "3 sucessos · Dados: 6 · 7 · 10 · 8 · 3 · 1". O 1 anulou um sucesso, como manda o V20 (img/po-web/97-rolagem-oculta-narrador-1280.webp). **O jogador não vê a rolagem** no Histórico (img/po-web/98-jogador-historico-1280.webp). No histórico do jogador, a aprovação da ficha deixou a linha "Humanidade: 0 → 6 · Aparência: 0 → 0" assinada pelo narrador: ruído.
- 13:08: **Revelação do NPC.** Escrevi uma nota-sentinela nas Notas do Narrador do NPC. "Identidade": o jogador vê o NPC na lista ("Ventrue · NPC revelado") e, ao abrir, só "O narrador revelou apenas a identidade." (img/po-web/100-jogador-ve-npc-identidade-1280.webp, img/po-web/101-jogador-npc-identidade-aberto-1280.webp). "Ficha": o jogador abre em Leitura ("Esta ficha foi revelada pelo narrador. Notas e ações privadas não fazem parte desta projeção."), sem Dados, Histórico, Experiência ou Notas do Narrador, e **sem a sentinela** (img/po-web/102-jogador-npc-ficha-completa-1280.webp). "Oculto": ao recarregar, aparece "Você não tem acesso a esta ficha", e o NPC some da lista (img/po-web/103-jogador-npc-ocultado-1280.webp). Bate com o v5 §1.5 a §1.7 (conferi na tela, não no corpo das respostas). O seletor Oculto/Identidade/Ficha marca o estado atual **desabilitando** o botão, sem `aria-pressed`, e nenhuma troca dá toast de confirmação.
- 13:10: **Sessão** nos Bastidores, com resumo público e nota privada (sentinela). O jogador vê, na aba Diário, o título e o resumo, sem a nota privada. Mas **a data aparece como "Sat Oct 31 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)"**, para narrador e jogador, numa sessão registrada com a data 2026-11-01: é a string crua do JavaScript, e o dia anterior por causa do fuso (img/po-web/104-bastidores-sessao-auditoria-1280.webp, img/po-web/105-jogador-diario-1280.webp).
- **Auditoria:** lista **códigos internos** ("chronicle.session.create", "character.visibility", "sheet.change", "xp-spend", "xp.request.approve", "damage", "revert", "recovery"…) com autor e hora, mas sem o nome da ficha nem o que mudou. Há pares que parecem duplicados ("xp-grant" e "xp.grant" no mesmo segundo).
- 13:10: **Travar** (Ações do narrador › Travar): toast "Ficha travada.". O narrador vê "Ficha travada · O jogador não altera a ficha nem rola gastando recursos até você destravar." O jogador vê o banner "O narrador travou a ficha · Você ainda rola sem gastar recursos." (img/po-web/106-jogador-ficha-travada-1280.webp). Gastar FdV pelo dock responde "O narrador travou a ficha.". A rolagem sem custo (Destreza + Furtividade, 8 dados) funcionou. Com "Gastar 1 FdV" marcado, veio a recusa "O narrador travou a ficha. A rolagem não foi feita." (img/po-web/107-jogador-rola-travada-1280.webp). Bate com o v3 §1.4. A caixa de gastar FdV continua habilitada mesmo travada. A folha de FdV diz "muda só em Editar" e, logo abaixo, "só muda em Evoluir": dois nomes para o mesmo modo. Destravei depois.

**Lobisomem em Jogo, offline, remoção e transferência.**
- 13:12: **Crinos.** Dock › Forma › liguei "Mudança instantânea: gastar 1 Fúria" › Crinos. Aplica no toque, sem confirmação, com o toast "Forma: Crinos (1 Fúria) · Desfazer" **por cima do dock** (img/po-web/109-lobisomem-forma-390.webp, img/po-web/110-lobisomem-crinos-390.webp). A grade mostra "Força 8 · 4 + 4 Crinos" e "Aparência 0 · Crinos: 0". Bate com o v2 §1.4 e §1.5; o texto do toast é mais curto que o "Forma Hominídeo → Crinos, Fúria 4 → 3" do plano.
- **Dados em Crinos:** os atalhos "Teste de Fúria" e "Teste de Gnose" estão lá. Na lista de **Atributo** aparece também "Força de Vontade · 5", logo abaixo de "Força · 8": peguei o errado na primeira vez. Com Força: "Força + Briga: 11 dados · Força: Crinos +4" (img/po-web/111-lobisomem-dados-crinos-390.webp). Ao trocar a parada, o **resultado da rolagem anterior continua na tela** embaixo da parada nova. "Regenerar 1 nível" fica no ⋯, com o motivo "Nada a curar: sem dano contusivo ou letal" (img/po-web/122-lobisomem-acoes-regenerar-390.webp). Bate com o v2 §1.6 e §1.7.
- 13:13: **Offline** (contexto offline do jogador): aparece "Sem conexão · As alterações ficam guardadas neste aparelho…". Gastei 1 Fúria (5 → 4 → 3) e a barra mostrou "Offline · 1 pendente". Ao reconectar, veio "Salvo", com `POST /events` 200 (img/po-web/112-offline-gasto-390.webp, img/po-web/113-online-sincronizado-390.webp). Bate com o v0 §1.7 e o v2 §1.9.
- 13:14: **Remover jogador** ("Vampiro livre", 390): a confirmação explica que "As fichas… vão para arquivadas: quem sai continua lendo…", com a opção "Revogar os convites ativos / Manter os convites" (img/po-web/114-remover-jogador-confirmacao-390.webp). O ex-membro vê "Você saiu · 1 personagem" na lista, "Suas fichas desta crônica são só leitura. Para voltar, peça um convite ao narrador." na crônica, e a ficha em Leitura com "Você saiu desta crônica · A ficha é só leitura." (img/po-web/115-ex-membro-voce-saiu-390.webp, img/po-web/116-ex-membro-ficha-leitura-390.webp). Editar e Dados **somem**: a tela previne em vez de recusar. Nenhum toast para o narrador depois de remover.
- 13:15: **Transferência** ("Lobisomem", 1280): Bastidores › "Propor" (sem confirmação), e a tela diz "Aguardando roteiro_po_web_jogador aceitar. O pedido vale por sete dias. · Cancelar transferência" (img/po-web/117-propor-transferencia-1280.webp). O jogador **não vê o convite** na lista de crônicas nem na aba Fichas: ele só aparece na aba **Diário** ("Convite para narrar · Aceitar narração · Recusar") (img/po-web/118-jogador-ve-proposta-1280.webp × img/po-web/119-jogador-diario-proposta-1280.webp). "Aceitar narração" funcionou no servidor: o antigo narrador passa a ver "Narrador: roteiro_po_web_jogador" e a si mesmo como "Jogador". Mas a tela de quem aceitou **não muda**: continua mostrando "Convite para narrar · Aceitar narração" até recarregar (img/po-web/120-novo-narrador-1280.webp × img/po-web/121-novo-narrador-recarregado-1280.webp).
- 13:16: a lista de crônicas do narrador **não mostra "última sessão"** (img/po-web/123-cronicas-narrador-final-390.webp), embora a "Vampiro por pontos" tenha uma sessão registrada. O plano v5 (Etapa 5, item 5) e o painel §5.9 pedem esse dado.

---

## Tarefa 1: criação de ficha de ponta a ponta (do convite à ficha concluída pelo narrador)

Antes de 12:47, o ambiente não deixava abrir nenhuma ficha (ver o diário). Os resultados abaixo são da segunda rodada, com o ambiente corrigido. As identidades foram criadas na primeira rodada; a ficha em si foi montada, entregue e concluída na segunda.

### 1a. Vampiro em criação livre: Helena Vasconcelos (PO web), na 390
- Resultado: **com dificuldade**
- Passos: narrador cria a crônica › Criação de fichas › Livre › Salvar › Convidar › Gerar convite · jogador: Entrar com convite › código › Nova ficha › identidade › Criar ficha › (ficha) Editar › atributos, habilidades, Disciplinas, Antecedentes, Virtudes › Concluir › Salvar · narrador: crônica › ficha › Ações do narrador › Concluir criação.
- Cliques/toques: ~75 · Rolagens: ~8 · Telas: 9
- Hesitei, voltei ou errei em:
  - Abrir a ficha: ela abre em **Jogo** e não diz que está em criação. Esperava "Monte sua ficha" ou "Em criação".
  - O botão "**Concluir**" do Editar: esperava concluir a criação, e ele só salva.
  - Depois de salvar, procurei como entregar ao narrador (⋯, abas) e não achei nada.
- Desnecessário, repetido ou longo demais: as 14 Habilidades e os 9 Atributos sobem de 1 em 1 com "+" (normal). "Concluir" seguido de "Salvar" são dois toques para salvar.
- Pensando em voz alta:
  > "Criei a ficha… e agora? Está em Jogo, com tudo em 1. É para eu editar? Quem decide quando está pronta?"
  > "Concluir… ah, era só salvar. E como eu aviso o narrador que terminei?"
  > (narrador) "Achei 'Concluir criação' no menu da ficha; foi um toque, sem conferir nada."
- Diferenças entre configurações: na 390, a barra do topo corta "Histórico", e "Comportamento" quebra no meio. Não repeti a ficha livre na 1280.
- SEQ: **4**, porque o caminho existe, mas o jogador não sabe em que estado a ficha está nem quem faz o quê.
- Evidências: img/po-web/32 a 45 (`…-390.webp`).

### 1b. Vampiro por pontos (aprovação ligada): Rafael Duarte (PO web), Nosferatu, na 1280
- Resultado: **com dificuldade**: concluí, mas a devolução quase passou despercebida.
- Passos: ficha › Criação › prioridades (7/5/3 por grupo) › Atributos › Habilidades (Perícias incompletas) › Salvar alterações › aba Orçamento ("O que falta") › Vantagens (2 Disciplinas, 2 Antecedentes, Virtudes) › folha "Começaram os pontos de bônus" › bônus › Enviar para aprovação · narrador: Fichas ("1 ficha aguarda sua revisão") › ficha › Devolver para correção (motivo) · jogador: ficha › Criação (só aí aparece o motivo) › corrige › Enviar · narrador: Aprovar ficha.
- Cliques/toques: ~110 · Rolagens: ~15 · Telas: 11
- Hesitei, voltei ou errei em:
  - Abrir a ficha (Jogo de novo, sem aviso).
  - Subir Força antes da prioridade (recusado com motivo: bom).
  - Procurar "Concluir criação" com grupos incompletos: o botão não existe até a conta fechar, e só a aba Orçamento explica.
  - Depois da devolução, a ficha em Jogo não dizia nada.
- Desnecessário, repetido ou longo demais:
  - A alternância "Pontos básicos / Pontos de bônus" na aba Orçamento: não precisei dela, porque a folha de bônus apareceu sozinha.
  - FdV atual e permanente subidas separadamente.
- Pensando em voz alta:
  > "Prioridade 7, 5, 3: entendi. 0/5, 5/5: o contador ajuda, mas é pequeno e cinza."
  > "'Começaram os pontos de bônus': isso sim é claro."
  > "Enviei com 4 pontos sobrando e ninguém me avisou."
  > "O narrador devolveu? Onde? Ah, só no modo Criação."
- Diferenças entre configurações: na 1280, a barra de cima cabe inteira. Os grupos aparecem lado a lado; na 390 viram abas (visto no Lobisomem).
- SEQ: **5**, porque a contabilidade guia bem quando você está no modo certo; a entrada e a devolução são o problema.
- Evidências: img/po-web/46 a 69 (`…-1280.webp`).

### 1c. Lobisomem por pontos (aprovação ligada): Tiago Lobo-Cinza (PO web), na 390
- Resultado: **com dificuldade**
- Passos: ficha › Criação › prioridades por aba (Físicos/Sociais/Mentais, Talentos/Perícias/Conhecimentos) › distribuir › Vantagens › 3 Dons por nome › 3 Antecedentes › bônus (Gnose, um quarto Dom, FdV, Antecedentes) › atuais à mão › Enviar para aprovação · narrador (390) › Fichas › ficha › Aprovar ficha.
- Cliques/toques: ~95 · Rolagens: ~12 · Telas: 8
- Hesitei, voltei ou errei em:
  - "Adicionar Dom": esperava uma lista. Enter não adiciona, e fechar perdeu o que digitei.
  - Os títulos repetidos "Dons / Dons / Dons".
  - Gnose e FdV atuais que não acompanham a permanente.
- Desnecessário, repetido ou longo demais: o resumo de envio com 25 linhas fora de ordem.
- Pensando em voz alta:
  > "Quais Dons eu posso pegar? O app não diz: preciso do livro."
  > "Gnose 3, mas a atual ficou 1. Tenho que subir as duas?"
- Diferenças entre configurações: na 390, as abas por grupo funcionam bem. Mas o topo da ficha do narrador transborda (Histórico fora da tela, rolagem horizontal).
- SEQ: **4**, porque os Dons sem catálogo e os atuais desalinhados pedem conhecimento do livro.
- Evidências: img/po-web/70 a 79 (`…-390.webp`).

## Tarefa 2: jornadas dos planos v0 a v5 (menos profundidade)
| Jornada | Resultado | Notas curtas |
|---|---|---|
| Convite e entrada (v0 §1.2 e §1.3) | sem ajuda | código de uso único na tela, aceito em minúsculas; usos restantes e validade |
| Mesa: concluir, travar, dano em grupo, Nova noite, desfazer, remover (v3) | sem ajuda | tudo funcionou; a Mesa não mostra o pendente nem o NPC separado |
| XP: conceder, pedir, aprovar, sem saldo (v4 §1.8 a §1.11) | com dificuldade | a confirmação do pedido fica fora da tela; o stepper de XP é lento |
| Bastidores: NPC oculto, revelação, rolagem oculta, parada livre, sessão, auditoria, transferência (v5) | com dificuldade | sem vazamento visto; data da sessão errada; auditoria em códigos; convite de narração escondido no Diário; a tela não atualiza depois de aceitar |
| Dados (v0 §1.9, v2 §1.6) | sem ajuda | Atributo + Habilidade, Crinos +4, atalhos de Fúria e Gnose, 1 anula sucesso; o resultado antigo fica na tela |
| Conta | sem ajuda | só excluir conta; o texto não cita a transferência |
| Offline (v0 §1.7, v2 §1.9) | sem ajuda | "Offline · 1 pendente" e depois "Salvo" |
- SEQ médio das jornadas: **5**.

## Achados
Nas tabelas, "img/po-web/NN" é o arquivo `img/po-web/NN-….webp` (o nome completo está no diário acima).
| ID | Tipo | Severidade sugerida | Tela | Config. | Sistema | Descrição | Passos para reproduzir | Esperado × obtido | Evidência | Visto/suposto | Atrapalha a criação? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| POW-01 | orientação | alta | Ficha do jogador em `creating` | 390 e 1280 | todos | A ficha em criação abre em Jogo, sem dizer "Em criação" nem o próximo passo; o modo Criação/Editar só se descobre tentando. **Rec.:** um banner fixo enquanto `creating`, com o estado, quem conclui e um botão "Montar a ficha" que leva ao modo certo (**genérica**) | abrir a própria ficha pela lista da crônica | "Em criação: distribua os pontos" × nada | img/po-web/32, 46, 70 | visto | sim |
| POW-02 | clareza | média | Crônica › Criação de fichas | ambas | todos | Quando o app não entende o template, a tela afirma "Este sistema usa criação livre". **Rec.:** separar "não foi possível ler as regras deste sistema; recarregue" de "sistema sem orçamento" (**genérica**) | template que o app não compila (aconteceu com o build velho) | aviso de erro × afirmação falsa | img/po-web/03, 04, 07 | visto (no ambiente velho) | sim |
| POW-03 | clareza | baixa | Nova ficha | ambas | todos | "Atualize o app" no web não diz o que fazer (não há loja). **Rec.:** no web, "Recarregue a página" com um botão (**genérica**) | idem | ação × beco sem saída | img/po-web/05, 06 | visto (ambiente) | sim |
| POW-04 | clareza | alta | Criação de fichas; Nova ficha; Mesa › Rolagens | ambas | todos | Grupos de escolha e steppers **sem título visível**: "Desligada/Ligada" (é a aprovação), "Por pontos/Livre" (o modo), Clã, Raça, Augúrio, Tribo, e "− 5 + − 6 +" (Dados, Dificuldade). O nome só existe no leitor de tela. **Rec.:** mostrar o `label` do Choice e do Stepper como título (**genérica**, DS) | abrir a crônica nova; Nova ficha; Mesa | título visível × só rádios | img/po-web/15, 18, 24, 31 | visto | sim |
| POW-05 | bug funcional | média | Mesa ("alterada às", "Última alteração") | ambas | todos | `characters.updated_at` é `timestamp without time zone`: o `now()` da criação grava UTC, e o lote grava a hora local. A ficha nova aparece 3 h no futuro e a ordem por última alteração erra. **Rec.:** `timestamptz` e uma só fonte de hora (**genérica**) | criar uma ficha e abrir a Mesa | 12:23 × 15:23 | img/po-web/27; banco: Tiago 15:23:35 × Rafael 12:54:49 | visto | não |
| POW-06 | clareza | média | Bastidores › Auditoria | 1280 | todos | Lista códigos internos ("chronicle.session.create", "sheet.change", "xp-spend", "damage"…) sem a ficha nem o que mudou, e com pares duplicados. **Rec.:** uma frase por tipo e o nome do alvo (**genérica**) | Bastidores › Auditoria | "Sessão registrada: Sessão 1" × código | img/po-web/104 | visto | não |
| POW-07 | clareza | alta | Ficha › Editar (criação livre e ficha ativa) | 390 | todos | O botão "**Concluir**" do Editar salva as alterações ("Salvar 16 alterações?"), com a mesma palavra de "Concluir criação". No modo por pontos já se chama "Salvar alterações". **Rec.:** "Salvar alterações" em todo modo de edição (**genérica**) | ficha livre › Editar › mudar › Concluir | salvar × parece concluir a criação | img/po-web/33, 40 | visto | sim |
| POW-08 | orientação | alta | Ficha do jogador, criação livre | 390 | todos | Na criação livre, o jogador não tem como entregar nem aviso de que o narrador conclui. **Rec.:** banner "Criação livre: o narrador conclui quando você terminar" e uma ação "Avisar que terminei" (**genérica**) | ficha livre › ⋯ e abas | próximo passo × nada | img/po-web/42 | visto | sim |
| POW-09 | feedback | alta | Ficha devolvida (jogador) | 1280 | todos | "O narrador devolveu a ficha" e o motivo só aparecem no modo Criação; em Jogo, que é como a ficha abre, nada indica a devolução. **Rec.:** mostrar o banner em qualquer modo (**genérica**) | narrador devolve › jogador abre a ficha | banner com o motivo × nada | img/po-web/66 × 67 | visto | sim |
| POW-10 | feedback | média | Enviar para aprovação | 1280 | todos | A confirmação não avisa os pontos de bônus não gastos (4 de 15), que se perdem. **Rec.:** "Sobram 4 pontos de bônus; eles não viram XP" (**genérica**) | enviar com bônus sobrando | aviso × silêncio | img/po-web/60 | visto | sim |
| POW-11 | orientação | média | Mesa | ambas | todos | A Mesa não mostra "Aguardando aprovação" nem tem filtro de pendentes; só a aba Fichas avisa. **Rec.:** selo de estado na linha e filtro "Pendentes" (**genérica**) | ficha `pending` › Mesa | selo × linha comum | img/po-web/62 | visto | sim (narrador) |
| POW-12 | layout | alta | Topo da ficha | 390 | todos | A barra transborda: "Histórico" em x=424 (`scrollWidth` 534), e a página ganha rolagem horizontal. No narrador, o menu de estado fica espremido. **Rec.:** na 390, Experiência e Histórico como ícones ou no ⋯ (**genérica**) | abrir qualquer ficha na 390 | tudo visível × cortado | img/po-web/32, 45, 71, 78 | visto | sim |
| POW-13 | bug funcional | média | Bastidores › Diário; Diário do jogador | 1280 | todos | A data da sessão sai como "Sat Oct 31 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)": string crua e o **dia anterior** (registrada em 2026-11-01). **Rec.:** formatar a data civil sem passar por `Date` com fuso (**genérica**) | registrar uma sessão hoje | "01/11/2026" × "Sat Oct 31 … 21:00" | img/po-web/104, 105 | visto | não |
| POW-14 | feedback | média | Diário (quem aceita a narração) | 1280 | todos | Depois de "Aceitar narração", a tela continua com o convite e o botão até recarregar, sem toast. **Rec.:** atualizar a crônica e mostrar "Agora você narra esta crônica" (**genérica**) | narrador propõe › jogador aceita | troca de papel × tela parada | img/po-web/120 × 121 | visto | não |
| POW-15 | orientação | média | Lista de crônicas e aba Fichas (jogador) | 1280 | todos | O convite para narrar só aparece na aba Diário. **Rec.:** alerta no topo da crônica e selo na lista (**genérica**) | proposta de transferência pendente | aviso visível × escondido | img/po-web/118 × 119 | visto | não |
| POW-16 | orientação | média | Mesa | 1280 | todos | O NPC não tem seção própria nem selo "NPC" na Mesa: fica entre os PCs. **Rec.:** seção "NPCs" ou selo na linha (**genérica**) | criar um NPC › Mesa | seção própria × misturado | img/po-web/83 | visto | não |
| POW-17 | clareza | média | Experiência › Solicitar evolução | 1280 | V20 (todos) | Cerca de 60 botões sem grupo nem busca. Depois de tocar, o custo e "Enviar pedido" ficam no fim, fora da tela. "Consciência" aparece duas vezes (Talento e Virtude). **Rec.:** agrupar pelas seções do template, com busca e confirmação junto do item (**genérica**); mostrar a seção junto do nome repetido (**template**) | Experiência › Solicitar evolução › tocar num traço | confirmação à vista × fora da tela | img/po-web/91, 92 | visto | não |
| POW-18 | simplificação | baixa | Conceder XP | 1280 | todos | Stepper de +1 sem campo numérico (12 XP = 11 cliques). **Rec.:** campo digitável com stepper (**genérica**) | Mesa › selecionar › Conceder XP | digitar × 11 cliques | img/po-web/89 | visto | não |
| POW-19 | bug visual | baixa | Resumo do lote ("Salvar…?", "Enviar…?") | ambas | V20, W20 | O "de" sai vazio em derivados ("Força de Vontade permanente — → 6", "Gnose permanente — → 3"), "Aparência 0 → 4" contradiz a ficha (que mostrava 1), e a lista vem fora de ordem. **Rec.:** usar o valor efetivo também nos derivados e ordenar como a ficha (**genérica**) | criar › salvar | "1 → 6" × "— → 6" | img/po-web/40, 60, 77 | visto | sim (revisão) |
| POW-20 | clareza | baixa | Criação por pontos | ambas | V20, W20 | FdV atual e Gnose atual ficam no valor antigo quando se compra a permanente: a ficha vai para aprovação com FdV 4/6. **Rec.:** na criação, o atual acompanha o permanente até ser mexido (**template**/**genérica**; não muda a regra) | comprar FdV com bônus | 6/6 × 4/6 | img/po-web/59 | visto | sim |
| POW-21 | orientação | média | Adicionar Dom | 390 | W20 | Dom só por nome livre: sem catálogo, sem nível, sem os Dons de Raça, Augúrio e Tribo. Enter não adiciona, e fechar descarta. **Rec.:** catálogo no template (**template**); Enter adiciona (**genérica**) | Vantagens › Adicionar Dom | lista × campo vazio | img/po-web/74 | visto | sim |
| POW-22 | clareza | baixa | Vantagens (criação) | ambas | todos | Títulos repetidos: "Dons 0/3 · Dons 0/3 · Dons 0", "Disciplinas 3/3 · Disciplinas 2". **Rec.:** um título com o contador (**genérica**) | modo Criação › Vantagens | 1 título × 3 | img/po-web/58, 74 | visto | sim |
| POW-23 | orientação | baixa | Adicionar Disciplina | ambas | V20 | A lista não destaca as 3 Disciplinas do clã, que o template já conhece (`costs.xp`). **Rec.:** marcar "do clã" (**template**) | Adicionar Disciplina | destaque × lista plana | img/po-web/36 | visto | sim |
| POW-24 | feedback | baixa | Criação › prioridade | 1280 | todos | "Escolha as prioridades deste grupo…" continua em vermelho depois de escolher a prioridade. **Rec.:** limpar ao escolher (**genérica**) | subir sem prioridade › escolher | some × fica | img/po-web/50 | visto | sim |
| POW-25 | bug visual | baixa | Identidade no Editar | 390 | V20 | "Comportamento" quebra no meio ("Comportamen/to"). **Rec.:** largura mínima ou hifenização (**genérica**) | Editar na 390 | palavra inteira × quebrada | img/po-web/33 | visto | não |
| POW-26 | clareza | baixa | Listas vazias | ambas | todos | Concordância errada: "Nenhum Qualidade". **Rec.:** texto de vazio declarado no template ou neutro, "Nenhum item" (**template**) | Vantagens | "Nenhuma" × "Nenhum" | img/po-web/35 | visto | não |
| POW-27 | acessibilidade | baixa | Alternâncias e menus | ambas | todos | "Oculta" e "Especialização" usam `aria-selected` num botão. O seletor de visibilidade do NPC marca o atual como `disabled`. "Ações do narrador" tem nome acessível diferente do texto visível ("Narrador · Em criação ▾"). **Rec.:** `aria-pressed` ou radiogroup, e o nome começando pelo texto visível (**genérica**) | leitor de tela | estado anunciado × "desativado" | árvore de acessibilidade | visto | não |
| POW-28 | clareza | baixa | Identidade W20 | ambas | W20 | O personagem novo nasce "Posto 0 · Filhote", e o formulário de criação mostra o Posto (o plano v2, linha 155, diz que não mostraria). **Rec.:** conferir no livro o Posto inicial e o default (**template**) | Nova ficha W20 | — | img/po-web/71 | visto | sim |
| POW-29 | orientação | baixa | Conta › Excluir conta | 390 | todos | "Com outros jogadores, exclua a crônica antes": não cita "Transferir narração". **Rec.:** citar a transferência (**genérica**) | Conta | 2 caminhos × 1 | img/po-web/29 | visto | não |
| POW-30 | orientação | média | Lista de crônicas | 390 | todos | "Última sessão" não aparece, embora haja uma sessão registrada (plano v5, Etapa 5, item 5; painel §5.9). **Rec.:** mostrar a data civil da última sessão (**genérica**) | registrar sessão › Crônicas | "Última sessão 01/11" × nada | img/po-web/123 | visto | não |
| POW-31 | feedback | baixa | Dados | 390 | W20 (todos) | O resultado anterior fica na tela depois de trocar a parada. "Força de Vontade" aparece entre os Atributos, logo abaixo de "Força". **Rec.:** limpar o resultado ao mudar e separar "Em jogo" no seletor (**genérica**) | Dados › rolar › trocar Atributo | limpo × velho | img/po-web/111 | visto | não |
| POW-32 | simplificação | média | Crônica (narrador) | ambas | todos | "Criação de fichas" (configuração) fica **acima das abas** em toda visita: na 390, cerca de 1,5 tela até Fichas e Mesa. **Rec.:** mover para Bastidores ou recolher depois de salvo (**genérica**) | abrir a crônica | abas no topo × configuração no topo | img/po-web/15, 62 | visto | sim (narrador) |
| POW-33 | feedback | baixa | Dados (travada); pedido de XP | 1280 | todos | "Gastar 1 FdV" fica habilitado com a ficha travada (a recusa só vem depois). "Enviar pedido" fica ativo com "o servidor vai recusar". **Rec.:** desabilitar com o motivo ao lado (**genérica**) | travar › Dados; pedido sem saldo | desabilitado × recusa | img/po-web/107, 93 | visto | não |
| POW-34 | clareza | baixa | Histórico | 1280 | V20 | A aprovação deixa "Aparência: 0 → 0" (sem mudança) e "Humanidade: 0 → 6" assinados pelo narrador. **Rec.:** omitir o que não muda e rotular "valores fixados na aprovação" (**genérica**) | aprovar › Histórico | sem ruído × linhas falsas | img/po-web/98 | visto | não |

Já conhecidos: POW-12 é parente do C-09 de `avaliacao-ui-ux.md` ("Fonte aumentada e 360dp quebram o layout"). POW-32 está registrado em `validacao-v5.md` ("desde a v4, a configuração da criação fica acima das abas"). POW-21 e POW-23 aparecem em `regras-wod.md` ("os 3 Dons iniciais deveriam vir da Raça, do Augúrio e da Tribo"; "as 3 Disciplinas iniciais deveriam ser do clã"; ficam com o narrador) e em `auditoria-fichas-wod.md` ("Dons, Ritos e Fetiches (sem mudança por decisão)"). POW-13: `validacao-v5.md` dá como corrigido o deslocamento da data **no servidor**, mas o app ainda desloca. Os demais não estão nos documentos de pendências.

## Aderência
| Jornada | Plano e § | OK, parcial ou falta | O que difere do plano | Evidência | Já é pendência conhecida? (doc e trecho) |
|---|---|---|---|---|---|
| Criar conta e entrar | v0 §1.1 | ok (só entrar) | não criei conta (limite de cadastro por IP) | img/po-web/01 | — |
| Narrador cria a crônica e o convite | v0 §1.2 | ok | modo de criação e aprovação ficam **depois** da criação, no topo da crônica, sem rótulo visível (POW-04, POW-32) | img/po-web/02, 03, 09, 10 | POW-32: `validacao-v5.md` ("a configuração da criação fica acima das abas") |
| Jogador entra com o código | v0 §1.3 | ok | — | img/po-web/12, 13 | — |
| Identidade pelo formulário do template | v0 §1.4 | parcial | não pede **Geração** (o template a trata como Antecedente, 13 − pontos); o título "Clã" não aparece | img/po-web/18 | Geração: `auditoria-fichas-wod.md` ("Antecedente, a partir da 13ª") |
| Ficha abre em Evoluir; salvar grava um lote | v0 §1.5 | parcial | o NPC abre direto em Editar (ok). A ficha do jogador abriu em Jogo porque a 1ª abertura quebrou no ambiente: **não provado**. Salvar grava 1 lote (ok). O botão se chama "Concluir" (POW-07) | img/po-web/81, 40, 41 | — |
| Leitura e Jogo, 3 abas e dock | v0 §1.6 | ok | na 390 o topo transborda (POW-12) | img/po-web/32, 46 | C-09 de `avaliacao-ui-ux.md` |
| Gastar, dano, cura, despertar, desfazer, offline | v0 §1.7 | parcial | vi o despertar no ⋯, a Nova noite, o gasto offline e o desfazer em grupo; não fiz gasto de Sangue, cura com Sangue nem desfazer local do jogador | img/po-web/42, 88, 112, 113 | — |
| Mesa, edição assinada e Notas do Narrador | v0 §1.8 | ok | o histórico assina "(narrador)". Notas do NPC não chegaram ao jogador (vi na tela, não no corpo da resposta) | img/po-web/98, 102 | — |
| Parada: Atributo + Habilidade, dificuldade, FdV | v0 §1.9 | ok | especialização e penalidade não testadas | img/po-web/97, 107, 111 | — |
| Mago: sistema, ficha, Arete, roda, conjurar | v1 §1.1 a §1.8 | **sem teste** | fora do escopo pedido (não criei crônica de Mago) | — | — |
| Lobisomem: crônica entre 3 sistemas | v2 §1.1 | ok | — | img/po-web/02 | — |
| Identidade W20 | v2 §1.2 | ok, com sobra | também pede Campo, Nome da matilha e **Posto** (o plano v2, linha 155, diz que o Posto não entra no formulário); Raça, Augúrio e Tribo sem título visível | img/po-web/24, 25 | — |
| Editar W20 (Fúria, Gnose, Renome, Dons…) | v2 §1.3 | ok | na v4 virou o modo Criação (por pontos). Dons só por nome (POW-21) | img/po-web/71 a 76 | Dons: `auditoria-fichas-wod.md` (sem mudança por decisão); `regras-wod.md` |
| Crinos com mudança instantânea e Desfazer | v2 §1.4 | ok | o toast diz "Forma: Crinos (1 Fúria)", mais curto que o do plano, e cobre o dock | img/po-web/110 | — |
| Grade efetiva em Crinos | v2 §1.5 | ok | — | img/po-web/110 | — |
| Força + Briga com Crinos e Teste de Fúria | v2 §1.6 | ok | "Força de Vontade" na lista de Atributos confunde (POW-31) | img/po-web/111 | v2: atalhos de Fúria e Gnose leem Em jogo (por decisão) |
| Regenerar | v2 §1.7 | parcial | só vi o motivo "Nada a curar"; não curei | img/po-web/122 | — |
| Narrador vê a forma na Mesa | v2 §1.8 | sem teste | — | — | — |
| Offline do passo 4 ao 7 | v2 §1.9 | parcial | testei o gasto de Fúria offline | img/po-web/112, 113 | — |
| Narrador conclui a criação | v3 §1.2 | ok | um toque, sem confirmação | img/po-web/44, 45 | — |
| Dano em grupo e desfazer pelo snackbar | v3 §1.3 | ok | — | img/po-web/85 a 87 | — |
| Travar: sem gasto e sem rolagem com custo; sem custo rola | v3 §1.4 | ok | a caixa de gastar FdV continua habilitada (POW-33) | img/po-web/106, 107 | — |
| Remover jogador; "Você saiu"; Leitura; recusas | v3 §1.5 | ok | com a página recarregada, Editar e Dados somem (prevenção, não recusa); não testei as recusas com a página já aberta | img/po-web/114 a 116 | — |
| Outro jogador não vê a ficha alheia | v3 §1.6 | sem teste | só uma conta de jogador por persona | — | — |
| Ligar a aprovação e convidar | v4 §1.1 | ok | a aprovação é um rádio "Desligada/Ligada" sem título (POW-04) | img/po-web/16 | — |
| Criação pela identidade, no modo por pontos | v4 §1.2 | parcial | a ficha não entra sozinha no modo Criação: abre em Jogo (POW-01; a 1ª abertura foi afetada pelo ambiente) | img/po-web/46, 47 | — |
| Prioridades e contadores por grupo | v4 §1.3 | ok | contador pequeno e cinza; erro velho que fica (POW-24) | img/po-web/48, 50, 51 | — |
| Concluir com grupo incompleto é recusado no grupo | v4 §1.4 | **diferente** | o botão só aparece com a conta fechada (prevenção); "O que falta" fica na aba Orçamento | img/po-web/55 | `validacao-v5.md`: "a jornada de criação da v4 continua sem E2E próprio" |
| Pontos restantes e bônus; salvar; sincronizar | v4 §1.5 | ok | a folha "Começaram os pontos de bônus" é boa; o "de" vazio no resumo (POW-19) | img/po-web/58 a 60 | — |
| Conclui; `pending`; jogador não altera | v4 §1.6 | ok | sobra de bônus sem aviso (POW-10) | img/po-web/61 | — |
| Narrador aprova; `active` | v4 §1.7 | ok | a Mesa não mostra o pendente (POW-11); a aba Fichas mostra | img/po-web/62, 63, 69 | — |
| Conceder XP ao grupo, com motivo | v4 §1.8 | ok | stepper lento (POW-18) | img/po-web/89 | — |
| Saldo e pedido com custo antes de enviar | v4 §1.9 | parcial | o custo aparece, mas fora da tela depois do toque (POW-17) | img/po-web/91, 92 | — |
| Aprovar: traço sobe, gasto e extrato | v4 §1.10 | ok | — | img/po-web/95 | — |
| Pedido sem saldo recusado no envio | v4 §1.11 | ok | botão ativo apesar do aviso (POW-33). Recusa, cancelamento e "stale" não testados | img/po-web/93 | — |
| Outro jogador sem dados | v4 §1.12 | sem teste | — | — | — |
| Complementos: devolução, livre autorizado, orçamento | v4 §1 (final) | parcial | devolução ok, mas o motivo fica escondido (POW-09). Livre ok. Orçamento por ficha ("Regras da casa") não testado | img/po-web/64 a 67 | — |
| NPC nasce oculto e livre; o jogador não vê | v5 §1.1 | ok | só na tela e na contagem | img/po-web/80, 81 | — |
| NPC concluído, na seção própria da Mesa, em operações | v5 §1.2 | parcial | entra no dano em grupo e na Nova noite, mas **sem seção própria** (POW-16) | img/po-web/83 | — |
| Rolagem oculta pelo NPC e pela ficha do jogador | v5 §1.3 | parcial | fiz a da ficha do jogador (o dono não a vê); não fiz a do NPC | img/po-web/97, 98 | — |
| Parada livre oculta por padrão; reenvio idempotente | v5 §1.4 | parcial | oculta por padrão ok; idempotência não testável pela tela | img/po-web/31 | — |
| Revelar só a identidade | v5 §1.5 | ok | sem toast de confirmação | img/po-web/100, 101 | — |
| Revelar a ficha: `viewer` em Leitura, sem notas | v5 §1.6 | ok | sentinela ausente | img/po-web/102 | — |
| Voltar a oculto: perde o acesso | v5 §1.7 | ok | — | img/po-web/103 | `validacao-v5.md`: "não apaga o que um aparelho já exibiu" |
| Outro jogador e ex-membro não veem NPC | v5 §1.8 | sem teste | — | — | — |
| P2: sessão com resumo e nota privada | v5 §1 (P2) | parcial | a nota privada não vaza, mas a **data está errada** (POW-13); "última sessão" não aparece na lista (POW-30); não vinculei XP nem operação à sessão | img/po-web/104, 105, 123 | servidor corrigido em `validacao-v5.md`; o app não |
| P2: editar nome e descrição | v5 §1 (P2) | sem teste | (a tela "Apresentação" existe) | — | — |
| P2: auditoria paginada | v5 §1 (P2) | parcial | lista e filtros ok; os textos são códigos (POW-06) | img/po-web/104 | — |
| P2: transferência com aceite | v5 §1 (P2) | parcial | funciona no servidor; o convite fica escondido (POW-15), a tela não atualiza (POW-14), "Propor" e "Aceitar" sem confirmação | img/po-web/117 a 121 | — |
| 5.1 Estados e política de escrita | painel §5.1 | ok | creating, pending, active, travada e arquivada vistos | vários | — |
| 5.2 Jogadores e convites | painel §5.2 | ok | lista com data de entrada, Remover, Sair, usos e validade | img/po-web/09, 114 | — |
| 5.3 Mesa ao vivo | painel §5.3 | parcial | ordenar, filtrar e "Atualizado agora" ok; não forcei alerta (incapacitado); hora errada (POW-05) | img/po-web/27 | — |
| 5.4 Grupo e reversão | painel §5.4 | ok | — | img/po-web/85 a 88 | — |
| 5.5 Criação por pontos | painel §5.5 | ok | ver v4 | — | — |
| 5.6 Experiência | painel §5.6 | ok | ver v4 | — | — |
| 5.7 NPCs | painel §5.7 | parcial | sem seção própria na Mesa | img/po-web/83 | — |
| 5.8 Rolagens da mesa | painel §5.8 | ok | feed com filtros por oculta e por origem | img/po-web/31 | — |
| 5.9 Sessões e diário | painel §5.9 | parcial | data errada; sem "última sessão" | img/po-web/104, 123 | — |
| 5.10 Configurações (nome, descrição, imagem, regras da casa) | painel §5.10 | sem teste | a tela existe; não salvei | img/po-web/104 | — |
| 5.11 Auditoria | painel §5.11 | parcial | códigos crus | img/po-web/104 | — |

**O que sobra (está na tela e não está em nenhum plano):**
- "Escolher da lista" para Natureza e Comportamento: ajuda.
- A folha "Começaram os pontos de bônus" e o "O que falta" da aba Orçamento: ajudam muito. Deveriam virar o padrão do plano.
- A alternância "Pontos básicos / Pontos de bônus" na aba Orçamento: nenhum plano a descreve, e a folha automática já faz o papel. **Atrapalha um pouco**: é mais um conceito escondido numa aba.
- No narrador, "Editar como narrador" e o rádio "Editar" convivem: dois caminhos para o mesmo modo. **Atrapalha** (dúvida sobre qual usar).
- Campo, Nome da matilha e Posto no formulário do Lobisomem (o Posto contradiz o plano v2, linha 155). Neutro.
- "Rolei na mão" nos Dados. Neutro.

## Cobertura
- **Testado, web, Chromium:**
  - Criação de ponta a ponta nos três modos pedidos: Vampiro livre (390), Vampiro por pontos com aprovação, devolução e reenvio (1280) e Lobisomem por pontos com aprovação (390). O narrador aprovou ou concluiu nas duas larguras.
  - Convites e entrada.
  - Mesa: concluir, travar e destravar, dano em grupo com desfazer, Nova noite, remover.
  - XP: conceder, pedir, pedido sem saldo, aprovar.
  - Bastidores: NPC oculto, identidade, ficha e oculto de novo; rolagem oculta; parada livre; sessão; auditoria; transferência.
  - Crinos e dados; Regenerar (só o motivo); offline (gasto de Fúria); conta (só leitura).
- **Sem teste:**
  - Mago (v1), por estar fora do escopo pedido.
  - Criar conta, pelo limite de 5 cadastros por hora somando todos os agentes.
  - Outro jogador sem acesso (v3 §1.6, v4 §1.12, v5 §1.8), porque só tenho uma conta de jogador.
  - Recusa, cancelamento, `stale` e ajuste ou estorno de XP.
  - Orçamento por ficha (Regras da casa) e editar a apresentação.
  - Rolagem oculta pelo NPC e vínculo de XP ou operação à sessão.
  - Excluir conta, por ser destrutivo.
  - Teclado e leitor de tela além da árvore de acessibilidade.
- **Privacidade:** conferi só na tela e nas contagens, não no corpo das respostas (a ferramenta não guarda os corpos).
- **Ambiente:** o build velho do `@tms/sheet-core` (até 12:20) e o `node_modules` velho (até 12:46) bloquearam a primeira rodada. O orquestrador corrigiu os dois. O que se viu nesse intervalo está marcado como ambiente no diário.
- **Dados que ficaram:**
  - "Vampiro livre (PO web)": jogador removido, ficha arquivada.
  - "Vampiro por pontos (PO web)": Rafael ativo, com XP 12/12, e o NPC oculto.
  - "Lobisomem por pontos (PO web)": narração transferida para `roteiro_po_web_jogador`, Tiago ativo em Crinos.
