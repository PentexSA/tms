# P10-D · Frases de ajuda: rascunho para revisão

> Rascunho do time, para revisão · 2026-11-04 · base: `onda/4-conteudo-guia`. Fonte única: [P10-D-frases.json](P10-D-frases.json).

As frases que o "?" mostra na criação (D-11, R-19). Esta lista é o conteúdo do commit 8 do [P10-D](P10-D-ajuda-contextual-mago.md) (§3.8 e §8.1). Ela não entra nos templates antes da aprovação dos planos, e cada frase passa pela revisão de uma segunda pessoa que conheça o sistema.

**Regras de cada frase:**

- Palavras próprias, sem trecho de livro (C-18; README dos templates §12). Quem escreve e quem revisa vão no resumo do PR.
- Texto puro, uma linha, até 200 caracteres, sem link nem marcação ($defs/helpShort do P10-D).
- Fora desta lista: frases de poderes (Disciplinas, Dons, Esferas e Ritos, item a item), que esperam o PO e a licença; os 13 resumos da Fraqueza (P07-D); as opções da Esfera de afinidade.
- Entram no commit 8 do P10-D. Opções, grupos e catálogo dependem do contrato dos commits 1 e 7. O aumento de versão é o da onda (onda-4.md §4.7).

**A coluna "Ação"** vale para os campos que já têm `help` no template:

- **novo:** o campo não tinha frase;
- **junta:** a frase nova soma o que a de hoje já explica sobre o app;
- **substitui:** a frase de hoje é nota de desenho ou instrução;
- **mantém:** a frase de hoje já serve e fica como está.

| Onde | Frases |
|---|---|
| App (texto do app, não do template) | 2 |
| Vampiro (V20) | 43 |
| Lobisomem (W20) | 48 |
| Mago (M20) | 48 |
| **Total** | **141** |

Uma frase igual em dois sistemas conta nos dois: Natureza, Comportamento, Conceito, os 6 grupos e parte dos Antecedentes. A tabela "O que falta escrever" no fim diz o que esta lista não cobre.

## App

| Termo | Frase | Car. |
|---|---|---|
| Prioridade | Ordene os grupos: o primeiro recebe mais pontos para distribuir, o último recebe menos. Cada conjunto de grupos tem a sua própria ordem. | 136 |
| Pontos de bônus | Pontos extras, gastos depois dos básicos. Cada característica cobra um preço diferente por ponto; a aba Pontos mostra quanto sobra. | 131 |

## Vampiro (V20) · `vtm-v20` 1.9.0 (escrita sobre a 1.8.0)

### Campos (`fields.<id>.help`)

| Campo | Ação | Frase | Car. |
|---|---|---|---|
| Conceito `concept` | novo | Uma frase sobre quem o personagem era antes da história: profissão, papel ou jeito de viver. | 92 |
| Natureza `nature` | novo | Quem o personagem é por dentro. Agir de acordo com ela, na mesa, pode devolver Força de Vontade. | 96 |
| Comportamento `demeanor` | novo | A máscara que o personagem mostra aos outros. Pode ser diferente da Natureza. | 77 |
| Antecedentes `backgrounds` | novo | Recursos fora da ficha: contatos, dinheiro, aliados, influência. O nível diz quanto o personagem tem. | 101 |
| Clã `clan` | novo | A linhagem do vampiro. Define três Disciplinas mais fáceis de aprender e uma fraqueza própria. | 94 |
| Senhor `sire` | novo | O vampiro que criou o personagem. Pode ficar em branco se ninguém sabe quem foi. | 80 |
| Geração `generation` | novo | Distância até os primeiros vampiros. Número menor: mais sangue no corpo e mais gasto por turno. Muda com o Antecedente Geração. | 127 |
| Disciplinas `disciplines` | novo | Poderes do sangue. As três do clã aparecem primeiro; na criação, as outras pedem a confirmação do narrador. | 107 |
| Pontos de Sangue `blood` | novo | A reserva de sangue no corpo. Paga Disciplinas, cura e esforço físico. A Geração define o máximo. | 97 |
| Humanidade `humanity` | junta | O quanto o vampiro ainda age como gente. Começa em Consciência + Autocontrole e acompanha as Virtudes até você marcar outro valor.<br>Hoje: Começa em Consciência + Autocontrole e acompanha as Virtudes até você marcar outro valor. | 130 |
| Força de Vontade `willpower` | junta | Determinação: gastar um ponto garante um sucesso ou ajuda a resistir a um impulso. Começa igual à Coragem; o permanente limita o temporário.<br>Hoje: Permanente limita o temporário e só muda em Evoluir. Começa igual à Coragem até ser marcado. | 140 |
| Fraqueza do clã `weakness` | substitui (P07-D) | Começa com um resumo do time para o clã escolhido. Reescreva como a mesa preferir; apagar tudo volta ao resumo.<br>Hoje: Escreva a fraqueza com as suas palavras. | 111 |

### Grupos (`sections.<seção>.groups.<grupo>.help`)

| Grupo | Frase | Car. |
|---|---|---|
| Físicos `attributes.groups.physical` | Força, Destreza e Vigor: o que o corpo do personagem consegue fazer. | 68 |
| Sociais `attributes.groups.social` | Carisma, Manipulação e Aparência: como o personagem lida com outras pessoas. | 76 |
| Mentais `attributes.groups.mental` | Percepção, Inteligência e Raciocínio: atenção, conhecimento e rapidez de pensamento. | 84 |
| Talentos `abilities.groups.talents` | Habilidades que vêm do jeito e da prática, sem estudo formal. | 61 |
| Perícias `abilities.groups.skills` | Habilidades aprendidas com treino ou com um ofício. | 51 |
| Conhecimentos `abilities.groups.knowledges` | Habilidades que pedem estudo: campos de saber, ciência e técnica. | 65 |
| Virtudes `advantages.groups.virtues` | Consciência, Autocontrole e Coragem. Elas definem a Humanidade e a Força de Vontade com que o vampiro começa. | 109 |

### Opções de Clã (`fields.clan.options[].help`)

| Opção | Frase | Car. |
|---|---|---|
| Assamitas `assamitas` | Clã de assassinos e estudiosos, com uma tradição de disciplina e de honra própria. | 82 |
| Brujah `brujah` | Clã de rebeldes e idealistas, de temperamento quente e rápido para a briga. | 75 |
| Gangrel `gangrel` | Clã de andarilhos próximos dos animais, que vivem longe das cidades com facilidade. | 83 |
| Giovanni `giovanni` | Clã de família e de negócios, ligado aos mortos e fechado aos de fora. | 70 |
| Lasombra `lasombra` | Clã de líderes ambiciosos, ligados às sombras. A maioria está no Sabá. | 70 |
| Malkavianos `malkavianos` | Clã marcado por algum tipo de loucura, que às vezes vê o que os outros não veem. | 80 |
| Nosferatu `nosferatu` | Clã de aparência monstruosa, que vive escondido e negocia segredos. | 67 |
| Ravnos `ravnos` | Clã de viajantes e trapaceiros, mestres da ilusão. | 50 |
| Seguidores de Set `seguidores-de-set` | Clã de cultistas de um deus antigo, que corrompem pela tentação. | 64 |
| Toreador `toreador` | Clã de artistas e amantes da beleza, influentes na alta sociedade. | 66 |
| Tremere `tremere` | Clã de feiticeiros do sangue, organizado numa hierarquia rígida. | 64 |
| Tzimisce `tzimisce` | Clã de senhores antigos que moldam carne e osso. A maioria está no Sabá. | 72 |
| Ventrue `ventrue` | Clã de aristocratas e líderes, exigentes até com a presa. | 57 |
| Caitiff `caitiff` | Vampiro sem clã conhecido. Não tem Disciplinas de clã nem fraqueza de clã. | 74 |

### Catálogo de Antecedentes (frase por nome, `fields.backgrounds`)

O formato no template é o da onda-4.md §4.3 (mapa por nome, recomendado, ou forma de objeto): a pergunta técnica 2 decide.

| Nome | Frase | Car. |
|---|---|---|
| Aliados | Pessoas que ajudam o personagem quando ele pede. Mais pontos: mais gente ou gente mais capaz. | 93 |
| Contatos | Pessoas que passam informação. Não lutam pelo personagem, mas sabem das coisas. | 79 |
| Fama | O quanto o personagem é conhecido no mundo comum. Abre portas e também atrai olhares. | 85 |
| Geração | Cada ponto deixa o vampiro uma geração mais perto dos primeiros. Muda a Geração da identidade e o máximo de sangue. | 115 |
| Rebanho | Pessoas de quem o vampiro se alimenta com segurança. Mais pontos: mais gente e menos tempo caçando. | 99 |
| Influência | Peso nas instituições humanas: política, polícia, imprensa, negócios. | 69 |
| Mentor | Alguém mais experiente que orienta o personagem, quando quer. | 61 |
| Recursos | Dinheiro e bens. Mais pontos: uma vida mais confortável e mais coisas à mão. | 76 |
| Lacaios | Servos leais ao vampiro. Mais pontos: mais servos ou servos mais capazes. | 73 |
| Status | A posição do vampiro na sociedade dos vampiros da cidade. | 57 |

## Lobisomem (W20) · `wta-w20` 1.7.0 (escrita sobre a 1.6.0)

### Campos (`fields.<id>.help`)

| Campo | Ação | Frase | Car. |
|---|---|---|---|
| Conceito `concept` | novo | Uma frase sobre quem o personagem era antes da história: profissão, papel ou jeito de viver. | 92 |
| Antecedentes `backgrounds` | novo | Recursos fora da ficha: contatos, dinheiro, aliados, influência. O nível diz quanto o personagem tem. | 101 |
| Força de Vontade `willpower` | novo | Determinação. Gastar um ponto garante um sucesso numa rolagem ou ajuda a resistir a um impulso. Começa pela Tribo. | 114 |
| Raça `breed` | novo | A forma em que o personagem nasceu: humana, lobo ou mestiça. Muda a Gnose inicial e os Dons à mão. | 98 |
| Augúrio `auspice` | novo | A fase da lua no nascimento, que define o papel no grupo. Muda a Fúria inicial e os Dons à mão. | 95 |
| Tribo `tribe` | novo | A sociedade a que o personagem pertence. Muda a Força de Vontade inicial e os Dons à mão. | 89 |
| Posto `rank` | novo | A posição na sociedade. Começa em 1 e sobe com o Renome. Dom acima do Posto pede a confirmação do narrador. | 107 |
| Fúria `rage` | novo | A raiva do lobo. Dá ações extras e ajuda a mudar de forma. Começa no valor do Augúrio e, na criação, não fica abaixo dele. | 122 |
| Gnose `gnosis` | substitui | A ligação com o mundo espiritual. Usada em Dons, em fetiches e para atravessar ao outro lado. Começa pela Raça.<br>Hoje: Recurso par da Fúria: cor quase neutra e preenchimento hachurado, para nunca depender só da cor. | 111 |
| Dons `gifts` | novo | Poderes ensinados pelos espíritos. Os da Raça, do Augúrio e da Tribo aparecem primeiro; o Posto mostra o nível. | 111 |

### Grupos (`sections.<seção>.groups.<grupo>.help`)

| Grupo | Frase | Car. |
|---|---|---|
| Físicos `attributes.groups.physical` | Força, Destreza e Vigor: o que o corpo do personagem consegue fazer. | 68 |
| Sociais `attributes.groups.social` | Carisma, Manipulação e Aparência: como o personagem lida com outras pessoas. | 76 |
| Mentais `attributes.groups.mental` | Percepção, Inteligência e Raciocínio: atenção, conhecimento e rapidez de pensamento. | 84 |
| Talentos `abilities.groups.talents` | Habilidades que vêm do jeito e da prática, sem estudo formal. | 61 |
| Perícias `abilities.groups.skills` | Habilidades aprendidas com treino ou com um ofício. | 51 |
| Conhecimentos `abilities.groups.knowledges` | Habilidades que pedem estudo: campos de saber, ciência e técnica. | 65 |
| Renome `renown.groups.renown` | Glória, Honra e Sabedoria: a fama que o personagem ganha. O permanente começa pelo Augúrio. | 91 |

### Opções de Raça (`fields.breed.options[].help`)

| Opção | Frase | Car. |
|---|---|---|
| Hominídeo `hominideo` | Nasceu humano e cresceu entre pessoas. Entende a cidade melhor que o mato. | 74 |
| Impuro `impuro` | Filho de dois pais da mesma espécie. Carrega uma deformidade desde o nascimento. | 80 |
| Lupino `lupino` | Nasceu lobo e aprendeu a forma humana depois. Entende o mato melhor que a cidade. | 81 |

### Opções de Augúrio (`fields.auspice.options[].help`)

| Opção | Frase | Car. |
|---|---|---|
| Ragabash `ragabash` | Nasceu na lua nova: o questionador e trapaceiro, que testa as regras do grupo. | 78 |
| Theurge `theurge` | Nasceu na lua crescente: o místico, que lida com os espíritos. | 62 |
| Philodox `philodox` | Nasceu na meia-lua: o juiz, que busca o equilíbrio e guarda a tradição. | 71 |
| Galliard `galliard` | Nasceu na lua gibosa: o contador de histórias, que guarda a memória do grupo. | 77 |
| Ahroun `ahroun` | Nasceu na lua cheia: o guerreiro, que vai à frente na luta. | 59 |

### Opções de Tribo (`fields.tribe.options[].help`)

| Opção | Frase | Car. |
|---|---|---|
| Fúrias Negras `furias-negras` | Tribo quase só de mulheres, protetoras dos lugares selvagens. | 61 |
| Roedores de Ossos `roedores-de-ossos` | Tribo dos que vivem à margem, entre os pobres e esquecidos das cidades. | 71 |
| Filhos de Gaia `filhos-de-gaia` | Tribo de curandeiros e pacificadores, que busca a união entre as tribos. | 72 |
| Fianna `fianna` | Tribo de bardos e guerreiros de origem celta, amantes de festas e histórias. | 76 |
| Crias de Fenris `crias-de-fenris` | Tribo de guerreiros de origem nórdica, que valoriza a força e a batalha. | 72 |
| Andarilhos do Asfalto `andarilhos-do-asfalto` | Tribo adaptada à cidade e à tecnologia. | 39 |
| Garras Vermelhas `garras-vermelhas` | Tribo de lupinos que rejeita a humanidade e defende a natureza. | 63 |
| Senhores das Sombras `senhores-das-sombras` | Tribo ambiciosa e disciplinada, que busca o poder e a liderança. | 64 |
| Peregrinos Silenciosos `peregrinos-silenciosos` | Tribo de viajantes e mensageiros, sem um lar fixo. | 50 |
| Presas de Prata `presas-de-prata` | Tribo nobre, de linhagens antigas, que por tradição lidera as outras. | 69 |
| Observadores das Estrelas `observadores-das-estrelas` | Tribo de místicos e filósofos, voltada à meditação e ao equilíbrio. | 67 |
| Uktena `uktena` | Tribo de místicos, ligada a segredos e a espíritos antigos. | 59 |
| Wendigo `wendigo` | Tribo de guerreiros ligada aos povos originários da América do Norte. | 69 |

### Catálogo de Antecedentes (frase por nome, `fields.backgrounds`)

O formato no template é o da onda-4.md §4.3 (mapa por nome, recomendado, ou forma de objeto): a pergunta técnica 2 decide.

| Nome | Frase | Car. |
|---|---|---|
| Aliados | Pessoas que ajudam o personagem quando ele pede. Mais pontos: mais gente ou gente mais capaz. | 93 |
| Ancestrais | A memória dos antepassados, que o personagem pode chamar para pedir conselho ou habilidade. | 91 |
| Contatos | Pessoas que passam informação. Não lutam pelo personagem, mas sabem das coisas. | 79 |
| Fetiche | Um objeto com um espírito dentro, que o personagem já tem no começo. O nível é o do fetiche. | 92 |
| Parentes | Humanos e lobos da família que sabem do segredo e ajudam o personagem. | 70 |
| Mentor | Alguém mais experiente que orienta o personagem, quando quer. | 61 |
| Recursos | Dinheiro e bens. Mais pontos: uma vida mais confortável e mais coisas à mão. | 76 |
| Ritos | Ritos que o personagem já conhece no começo. Cada ponto vale um nível de rito. | 78 |
| Totem | O espírito protetor da matilha. Os pontos dos membros se somam para o totem. | 76 |
| Raça Pura | Sangue de linhagem antiga e reconhecida. Os outros da espécie reagem com mais respeito. | 87 |

## Mago (M20) · `mta-m20` 1.7.0 (escrita sobre a 1.6.0)

**Rótulo (D-12, U-06):** o campo `house` passa de "Casa" a "Casa ou subgrupo", com o `placeholder` "Opcional". Nenhum campo é escondido.

### Campos (`fields.<id>.help`)

| Campo | Ação | Frase | Car. |
|---|---|---|---|
| Conceito `concept` | novo | Uma frase sobre quem o personagem era antes da história: profissão, papel ou jeito de viver. | 92 |
| Natureza `nature` | novo | Quem o personagem é por dentro. Agir de acordo com ela, na mesa, pode devolver Força de Vontade. | 96 |
| Comportamento `demeanor` | novo | A máscara que o personagem mostra aos outros. Pode ser diferente da Natureza. | 77 |
| Antecedentes `backgrounds` | novo | Recursos fora da ficha: contatos, dinheiro, aliados, influência. O nível diz quanto o personagem tem. | 101 |
| Tradição `tradition` | novo | O grupo de magos e a sua maneira de entender a magia. Sugere a Esfera de afinidade. | 83 |
| Essência `essence` | novo | A natureza do Avatar, a parte mágica do personagem. Diz o que move a busca dele. | 80 |
| Casa `house` | novo | Uma facção dentro da Tradição. É opcional: deixe em branco se a Tradição não tiver uma ou se o personagem não fizer parte. | 122 |
| Esfera de afinidade `affinity` | novo | A Esfera mais natural para o personagem, em geral ligada à Tradição. | 68 |
| Paradigma `paradigm` | novo | No que o mago acredita sobre como o mundo funciona. Escreva com as suas palavras. | 81 |
| Prática `practice` | novo | O jeito como o mago faz magia: ritual, ciência, oração, arte. | 61 |
| Instrumentos `instruments` | novo | Os objetos e gestos que o mago usa para fazer magia, de acordo com a Prática. | 77 |
| Arete `arete` | junta | O domínio geral da magia: nenhuma Esfera passa do Arete, que vai até 3 na criação. Baixar o Arete deixa as Esferas acima inativas, sem apagar.<br>Hoje: Limita todas as Esferas. Baixar o Arete não apaga as Esferas: as que ficarem acima ficam inativas e voltam quando o Arete sobe. | 142 |
| Força de Vontade `willpower` | junta | Determinação: gastar um ponto garante um sucesso ou ajuda a resistir a um impulso. O permanente limita o temporário e só muda em Evoluir.<br>Hoje: Permanente limita o temporário. O permanente só muda em Evoluir. | 137 |
| Quintessência e Paradoxo `wheel` | mantém | (a de hoje: Quintessência e Paradoxo dividem as 20 casas da roda. Ganhar Paradoxo com a roda cheia consome 1 Quintessência. A Quintessência começa igual ao Avatar.) | — |

### Grupos (`sections.<seção>.groups.<grupo>.help`)

| Grupo | Frase | Car. |
|---|---|---|
| Físicos `attributes.groups.physical` | Força, Destreza e Vigor: o que o corpo do personagem consegue fazer. | 68 |
| Sociais `attributes.groups.social` | Carisma, Manipulação e Aparência: como o personagem lida com outras pessoas. | 76 |
| Mentais `attributes.groups.mental` | Percepção, Inteligência e Raciocínio: atenção, conhecimento e rapidez de pensamento. | 84 |
| Talentos `abilities.groups.talents` | Habilidades que vêm do jeito e da prática, sem estudo formal. | 61 |
| Perícias `abilities.groups.skills` | Habilidades aprendidas com treino ou com um ofício. | 51 |
| Conhecimentos `abilities.groups.knowledges` | Habilidades que pedem estudo: campos de saber, ciência e técnica. | 65 |
| Esferas `spheres.groups.spheres` | Os campos da realidade que o mago sabe mudar. Cada Esfera vai de 0 a 5 e não passa do Arete. | 92 |

### Opções de Tradição (`fields.tradition.options[].help`)

| Opção | Frase | Car. |
|---|---|---|
| Ordem de Hermes `ordem-de-hermes` | Magos de fórmulas, rituais e hierarquia, organizados em Casas. | 62 |
| Coro Celestial `coro-celestial` | Magos da fé, que veem a magia como expressão do divino. | 55 |
| Culto do Êxtase `culto-do-extase` | Magos da experiência e dos sentidos, que buscam a magia no êxtase. | 66 |
| Eutanatos `eutanatos` | Magos da vida e da morte, ligados ao ciclo e ao destino. | 56 |
| Irmandade Akáshica `irmandade-akashica` | Magos da disciplina do corpo e da mente, das artes marciais e da meditação. | 75 |
| Sonhadores (Kha'vadi) `sonhadores` | Magos dos espíritos e dos sonhos, ligados a tradições xamânicas. | 64 |
| Verbena `verbena` | Magos da natureza, do sangue e da vida, herdeiros da bruxaria antiga. | 69 |
| Sociedade do Éter `filhos-do-eter` | Magos da ciência estranha, de invenções e teorias que a ciência comum rejeita. | 78 |
| Adeptos da Virtualidade `virtualidade` | Magos da informação e da tecnologia digital. | 44 |
| Órfão `orfao` | Mago sem Tradição. Não tem Esfera da Tradição sugerida. | 55 |

### Opções de Essência (`fields.essence.options[].help`)

| Opção | Frase | Car. |
|---|---|---|
| Essência Dinâmica `dinamica` | Avatar que busca mudança, movimento e novidade. | 47 |
| Essência Padrão `padrao` | Avatar que busca ordem, estabilidade e permanência. | 51 |
| Essência Primordial `primordial` | Avatar ligado às origens, aos ciclos e ao que é antigo. | 55 |
| Essência Questionadora `questionadora` | Avatar inquieto, que busca algo que nem sempre sabe nomear. | 59 |

### Catálogo de Antecedentes (frase por nome, `fields.backgrounds`)

O formato no template é o da onda-4.md §4.3 (mapa por nome, recomendado, ou forma de objeto): a pergunta técnica 2 decide.

| Nome | Frase | Car. |
|---|---|---|
| Aliados | Pessoas que ajudam o personagem quando ele pede. Mais pontos: mais gente ou gente mais capaz. | 93 |
| Avatar | A força do Avatar, a parte mágica do personagem. Define a Quintessência inicial. | 80 |
| Biblioteca | Livros, arquivos e fontes de estudo à mão do mago. | 50 |
| Capela | Um refúgio dividido com outros magos, com recursos e proteção. | 62 |
| Contatos | Pessoas que passam informação. Não lutam pelo personagem, mas sabem das coisas. | 79 |
| Destino | Um grande propósito ligado ao personagem, que às vezes o ajuda no último momento. | 81 |
| Fama | O quanto o personagem é conhecido no mundo comum. Abre portas e também atrai olhares. | 85 |
| Familiar | Um espírito num corpo de animal, ligado ao mago. | 48 |
| Influência | Peso nas instituições humanas: política, polícia, imprensa, negócios. | 69 |
| Maravilha | Um objeto mágico que o mago já tem no começo. | 45 |
| Mentor | Alguém mais experiente que orienta o personagem, quando quer. | 61 |
| Nodo | Um lugar de poder que gera Quintessência para o mago. | 53 |
| Recursos | Dinheiro e bens. Mais pontos: uma vida mais confortável e mais coisas à mão. | 76 |
| Sonho | Acesso a saberes que o mago nunca estudou, vindos do Avatar. | 60 |

## O que falta escrever

| O quê | Quantos | Quem | Por que não está aqui |
|---|---|---|---|
| Atributos e Habilidades, campo a campo | de 39 a 42 por sistema | o time | prioridade 4 do P10-D §3.8 |
| Arquétipos (sugestões de Natureza e Comportamento, V20) | 42 | o time | prioridade 3; a forma da frase na sugestão depende da pergunta técnica 2 |
| Opções da Esfera de afinidade (M20) | 9 | o time | descrevem Esferas, que são poderes: esperam o PO e a licença (onda-4.md §6, ponto 10) |
| Disciplinas, Dons, Esferas e Ritos, item a item | — | o time | mesma razão |
| Resumo da Fraqueza por clã (V20) | 13 (+1 Caitiff, opcional) | o time | P07-D §3.10: texto do time, revisado por uma segunda pessoa |
| Os outros campos sem frase (Qualidades, Defeitos, Experiência e afins) | o resto dos 53, 61 e 67 do P10-D §3.8 | o time | fora da prioridade 1 |
