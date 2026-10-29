# Próximas features: o que os apps parecidos fazem e o TMS ainda não

> Proposta · 2026-10-23 · base: `main` em `1435c9f` (v5 fechada)

A v0 à v5 entregaram a ficha, a Mesa, a criação por pontos, o XP e os Bastidores. Comparado aos apps parecidos, o que falta agora não é regra de ficha: é **a mesa ao vivo** (o que acontece aparece na hora), **a ficha fora do app** (Discord, PDF, TV da mesa presencial) e **a narrativa entre as sessões** (relações, diário do jogador). A recomendação é fazer nessa ordem, como v6, v7 e v8, e deixar um sistema novo (V5) para a v9 como teste de fogo do motor agnóstico.

O que já está decidido como "Depois do painel" (migração de fichas entre versões de template, recuperar senha e roteiro de deploy, em [`painel-narrador.md`](painel-narrador.md) §9) continua antes de tudo isto: sem ele não existe primeiro grupo de verdade.

## 1. O que os apps parecidos fazem

| App | O que se destaca | Fonte |
|---|---|---|
| Demiplane (VtM V5 Nexus, oficial) | Criação guiada em etapas, aba de Progressão com XP por sessão, "Click-To-Know" (clicar num traço mostra a regra), retrato por upload, link de leitura para o narrador, "Editar por outros", integração com o Roll20 | [Paradox](https://www.paradoxinteractive.com/games/world-of-darkness/news/demiplane-character-tools), [guia do Demiplane](https://resources.demiplane.com/nexus/vampire/tools/character-tools-overview), [revisão Q1 2025](https://www.demiplane.com/blog/demiplane-q1-2025-review) |
| D&D Beyond (Maps e Encounters) | Game Log com as rolagens de todos e rolagens secretas, iniciativa, ocultar monstros até entrarem, modo espectador para TV ou projetor na mesa presencial | [Navegando o Maps](https://www.dndbeyond.com/posts/1816-the-official-d-d-vtt-navigating-maps-on-d-d-beyond) |
| Foundry VTT + sistema WoD5e | Rolagem pública, só para o mestre, cega ou só para si, com "Revelar a todos" depois; Fome e Fúria automáticas no teste; modificadores de situação da cena aplicados às paradas; 10 idiomas | [Dados no Foundry](https://foundryvtt.com/article/dice/), [WoD5e](https://www.foundryvtt-hub.com/package/wod5e/) |
| Inconnu (bot de Discord, VtM V5) | Rolar pelo nome do traço, a ficha conhecida pelo bot, macros com custo, registro de XP, perfil web com retrato, posts de roleplay | [Inconnu](https://docs.inconnu.app/guides/quickstart), [top.gg](https://top.gg/api/bot/882409882119196704) |
| Rollwarden (extensão do D&D Beyond) | Manda as rolagens da ficha para um canal do Discord por webhook | [Firefox Add-ons](https://addons.mozilla.org/fr/firefox/addon/rollwarden/) |
| Progeny (VtM V5, código aberto) | Criação guiada em minutos, jogar pelo app ou exportar em PDF | [groupfinder](https://groupfinder.gg/library/progeny) |
| Pathbuilder 2e | Planejar a evolução até o nível 15 antes de jogar, exportar a ficha em PDF | [App Store](https://apps.apple.com/tm/app/pathbuilder-2e/id6740821064) |
| World Anvil | Diário de sessões, linhas do tempo, árvores genealógicas e artigos ligados | [World Anvil](https://www.worldanvil.com/learn/player/character-manager) |
| Livro do V5 | O Mapa de Relações montado na sessão zero (Touchstones, senhor, rivais) como gerador de ganchos | [Nerdist](https://nerdist.com/article/gm-tips-for-vampire-the-masquerades-5th-edition-relationship-charts/) |

Nenhum deles junta o que o TMS já tem: a política de escrita por estado, o XP por pedido aprovado, o NPC com revelação em dois níveis e o mesmo motor para Vampiro, Mago e Lobisomem. O WoD clássico (V20, M20, W20) quase não tem ferramenta digital boa; o mercado oficial está no V5. Isso é a vantagem a proteger: as sugestões abaixo não podem quebrar os princípios do [`painel-narrador.md`](painel-narrador.md) §4 (agnóstico, o filtro no servidor, atômico e idempotente).

## 2. Sugestões, por prioridade

| # | Feature | Inspiração | Valor para a mesa | Esforço | Depende de |
|---|---|---|---|---|---|
| 1 | Mesa e feed ao vivo | D&D Beyond Game Log | Alto | Médio | — |
| 2 | Revelar rolagem oculta depois | Foundry "Revelar a todos" | Médio | Baixo | — |
| 3 | Jogador rola só para o narrador | Foundry GM Roll e Blind Roll | Médio | Baixo | 2 |
| 4 | Modificador de cena | WoD5e | Médio | Médio | — |
| 5 | Iniciativa e ordem da cena | D&D Beyond Encounters | Médio | Médio | 1 |
| 6 | Rolagens e diário no Discord | Inconnu, Rollwarden | Alto | Baixo | — |
| 7 | Ficha em PDF e link de leitura | Progeny, Pathbuilder, Demiplane | Alto | Médio | — |
| 8 | Notificações push | — | Médio | Médio | — |
| 9 | Modo espectador (TV da mesa) | D&D Beyond | Médio | Baixo | 1 |
| 10 | Mapa de relações | Livro do V5, World Anvil | Alto | Alto | — |
| 11 | Diário e notas do jogador | World Anvil, Demiplane | Médio | Baixo | — |
| 12 | Upload de retrato | Demiplane, Inconnu | Médio | Médio | deploy |
| 13 | Ajuda no traço ("Click-To-Know") | Demiplane | Médio | Médio | — |
| 14 | Planejar a evolução | Pathbuilder | Médio | Baixo | — |
| 15 | Vampiro V5 (dados de Fome) | Demiplane, WoD5e, Inconnu | Alto | Alto | — |
| 16 | App em inglês | WoD5e | Médio | Médio | — |

### 2.1 Mesa ao vivo (v6)

1. **Mesa e feed ao vivo.** Hoje a Mesa puxa ao focar e ao reconectar, e o jogador só vê a recusa de trava quando tenta agir. Com Server-Sent Events (SSE), mais simples que WebSocket e suficiente porque o fluxo é só do servidor para o app, a Mesa, o feed e a ficha aberta se atualizam sozinhos. O evento leva só "o recurso X mudou na versão N"; o app busca de novo pela rota que já filtra por papel. Assim nenhum dado oculto passa pelo canal, e o princípio 4 continua valendo sem uma segunda camada de filtro.
2. **Revelar rolagem oculta.** Ficou fora da v5. O narrador revela uma rolagem do feed para a mesa toda ou para o dono, numa ação auditada; a rolagem continua com o mesmo id e resultado.
3. **Jogador rola só para o narrador.** O jogador manda uma rolagem que só o narrador vê, como Percepção contra uma emboscada. É o `hidden` da v5 aberto ao dono, com o narrador como único leitor. A versão "cega" (nem quem rolou vê o resultado) é a mesma coisa com uma flag a mais.
4. **Modificador de cena.** O narrador marca "escuridão: +2 de dificuldade" para a cena, e toda rolagem da crônica mostra e aplica o modificador até ele sair. O tipo de modificador (dificuldade, dados ou sucessos) vem do executor de dados do template, como a parada livre.
5. **Iniciativa e ordem da cena.** Uma lista ordenada de PCs e NPCs, com a rolagem de iniciativa do template, "próximo" e o NPC oculto até entrar (como no D&D Beyond). A fórmula de iniciativa fica no template, para o mesmo código servir ao D&D.

### 2.2 A ficha fora do app (v7)

6. **Discord por webhook.** O narrador cola o webhook de um canal nos Bastidores e escolhe o que vai: rolagens visíveis, resumo público da sessão, "Dano aplicado em 2 personagens". Os bots de WoD mostram que a mesa online vive no Discord. Só sai o que um membro já poderia ler, e o webhook é tratado como segredo.
7. **PDF e link de leitura.** Exportar a ficha para imprimir (mesa presencial, arquivo do jogador). O link de leitura vale para alguém fora da crônica, como um narrador convidado, com a mesma projeção `viewer` da v5, expiração e revogação.
8. **Notificações push.** Pelo Expo Notifications: "o narrador aprovou sua Destreza 3", "sua ficha foi devolvida", "novo pedido de XP", "transferência proposta". O texto da notificação nunca leva dado oculto.
9. **Modo espectador.** Uma tela para a TV da mesa presencial: o feed visível, a iniciativa e os alertas públicos, sem login de jogador. Usa as mesmas projeções públicas.

### 2.3 Narrativa entre as sessões (v8)

10. **Mapa de relações.** Um grafo de PCs, NPCs e pessoas sem ficha (Touchstones, senhor, rivais), com o tipo e o sentimento de cada ligação. O livro do V5 trata o mapa como o centro da sessão zero. Cada ligação tem visibilidade própria (oculta, só o dono, a mesa), com o mesmo filtro dos NPCs: uma relação oculta não aparece nem na contagem.
11. **Diário e notas do jogador.** Notas privadas por ficha, só do dono, e o relato do jogador por sessão ao lado do resumo público do narrador.
12. **Upload de retrato.** A v5 aceita só uma URL HTTPS. Com o deploy definido, entra o upload com limite de tamanho, tipo conferido e redimensionamento no servidor.
13. **Ajuda no traço.** Tocar num traço mostra a descrição que o template declara. **Atenção aos direitos:** o texto dos livros é da Paradox; o template leva só resumos próprios curtos ou a página do livro, e o narrador pode escrever a sua.
14. **Planejar a evolução.** O jogador monta uma fila de pedidos futuros ("Destreza 3, depois Esquiva 2") e vê o custo somado com o `costOf` da v4, sem reservar XP e sem mudar a regra de um nível por pedido.

### 2.4 Um sistema novo (v9)

15. **Vampiro V5.** É onde está o mercado (o Demiplane, o WoD5e e o Inconnu são todos V5), e é o melhor teste do motor: dados de Fome dentro da parada, crítico confuso, falha bestial e teste de despertar exigem um executor de dados novo (além do `pool-success`) e trilhas novas. Se entrar sem um `if` de sistema fora do core e dos templates, o motor está provado.
16. **App em inglês.** Os textos estão em português direto no código. Extrair para um catálogo abre a comunidade de fora; o rótulo dos traços já vem do template, então o trabalho maior é a interface.

## 3. O que não recomendo

- **Mapa, tokens, névoa e música.** É território de VTT (Roll20, Foundry, Owlbear), está no "Fora da v5" e não combina com o forte do TMS. Melhor integrar: o link de leitura e o webhook do Discord levam a ficha até onde a mesa já joga.
- **Chat próprio.** O Discord resolve; um chat exige moderação, tempo real e guarda de mensagens sem ganho claro.
- **Copiar o texto dos livros na ficha.** Risco de direito autoral (ver o item 13).
- **Matchmaking.** O Demiplane tem, mas pede uma base de usuários que o TMS ainda não tem.

## 4. Perguntas em aberto

- A primeira mesa real joga online (o Discord pesa mais) ou presencial (o PDF e o modo espectador pesam mais)? A resposta reordena a v6 e a v7.
- O V5 entra como sistema novo ao lado do V20 ou há interesse em outro sistema primeiro (Changeling, Hunter)?
- Onde o app vai hospedar arquivos? A resposta decide o upload de retrato e o PDF gerado no servidor.
