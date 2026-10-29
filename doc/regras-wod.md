# Regras de criação e XP de V20, M20 e W20

Os templates `vtm-v20` 1.7.0, `mta-m20` 1.6.0 e `wta-w20` 1.6.0 trazem a criação por pontos (`creation`), o preço dos pontos de bônus (`costs.freebie`) e o preço de XP (`costs.xp.rules`) das edições de 20º aniversário. Esta é a Etapa 2b do [plano da v4](plano-v4.md). O contrato está no [README dos templates](../design/templates/README.md), §14, e os oráculos, em `packages/sheet-core/src/__tests__/wod-rules.test.ts`.

A migration `0020_product_templates` grava as três versões em todo banco migrado. Uma versão nova de template ganha a sua própria migration.

Consulta feita em outubro de 2026, sem os livros no workspace. Os números vêm de resumos de criação e tabelas de XP publicados por mesas e wikis que seguem as edições de 20º aniversário (fontes no fim). Cada número foi conferido em pelo menos duas fontes, ou numa fonte que cita a página do livro. A página do livro aparece quando a fonte a cita.

## Criação

| | V20 | M20 | W20 |
|---|---|---|---|
| Atributos (prioridades) | 7/5/3, todos começam em 1 | 7/5/3 | 7/5/3 |
| Habilidades (prioridades) | 13/9/5, máx. 3 com os básicos | 13/9/5, máx. 3 | 13/9/5, máx. 3 |
| Fixos | Disciplinas 3, Antecedentes 5, Virtudes 7 (cada uma começa em 1) | Antecedentes 7, Esferas 6 (5 + 1 da Tradição), Arete 1 | Antecedentes 5, 3 Dons de nível 1 |
| Derivados | Humanidade = Consciência + Autocontrole; FdV = Coragem | FdV 5 | Fúria pelo Augúrio, Gnose pela Raça, FdV pela Tribo, Renome pelo Augúrio |
| Tetos | — | Arete até 3; Esfera até o Arete (M20 p. 64) | — |
| Exceção | Nosferatu: Aparência 0, sem compra | — | — |
| Pontos de bônus | 15 | 15 | 15 |

## Pontos de bônus

| Traço | V20 | M20 | W20 |
|---|---|---|---|
| Atributo | 5 | 5 | 5 |
| Habilidade | 2 | 2 | 2 |
| Antecedente | 1 | 1 | 1 |
| Disciplina / Esfera / Dom | 7 | 7 (Esfera) | 7 (Dom de nível 1) |
| Virtude | 2 | — | — |
| Humanidade | 2 | — | — |
| Arete | — | 4 | — |
| Fúria / Gnose | — | — | 1 / 2 |
| Força de Vontade | 1 | 1 | 1 |
| Qualidade | o custo do item | o custo do item | o custo do item |
| Defeito | devolve o bônus do item, até 7 | até 7 | até 7 |

## XP

Os preços valem para subir um ponto a partir do valor atual.

| Traço | V20 | M20 | W20 |
|---|---|---|---|
| Atributo | atual × 4 | atual × 4 | atual × 4 |
| Habilidade nova / Habilidade | 3 / atual × 2 | 3 / atual × 2 | 3 / atual × 2 |
| Disciplina nova | 10 | — | — |
| Disciplina do clã / outra / Caitiff | atual × 5 / × 7 / × 6 | — | — |
| Esfera nova / de afinidade / outra | — | 10 / atual × 7 / atual × 8 (M20 p. 253) | — |
| Arete | — | atual × 8 | — |
| Antecedente novo / Antecedente | sem preço | 3 / atual × 3 (opcional, M20 p. 336) | sem preço |
| Virtude / Humanidade | atual × 2 / atual × 2 | — | — |
| Fúria / Gnose | — | — | atual × 1 / atual × 2 |
| Força de Vontade | atual × 1 | atual × 1 | atual × 1 |

A Disciplina do clã é a que está na lista do clã escolhido, pelo nome do catálogo:

| Clã | Disciplinas do clã |
|---|---|
| Assamitas | Rapidez, Ofuscação, Quietus |
| Brujah | Rapidez, Potência, Presença |
| Gangrel | Animalismo, Fortitude, Metamorfose |
| Giovanni | Dominação, Necromancia, Potência |
| Lasombra | Dominação, Tenebrosidade, Potência |
| Malkavianos | Auspícios, Demência, Ofuscação |
| Nosferatu | Animalismo, Ofuscação, Potência |
| Ravnos | Animalismo, Quimerismo, Fortitude |
| Seguidores de Set | Ofuscação, Presença, Serpentis |
| Toreador | Auspícios, Rapidez, Presença |
| Tremere | Auspícios, Dominação, Taumaturgia |
| Tzimisce | Animalismo, Auspícios, Vicissitude |
| Ventrue | Dominação, Fortitude, Presença |

## O que fica com o narrador

O contrato não expressa estas regras, então elas não entram na conta. O narrador decide e ajusta na ficha.

- **V20:** as 3 Disciplinas iniciais deveriam ser do clã. Trilhas de Taumaturgia e Necromancia não têm preço próprio. Antecedentes não têm preço em XP, como no livro.
- **M20:** a Esfera de afinidade deveria ter pelo menos 1 ponto. A Quintessência (1 ponto de bônus a cada 4) fica na roda, fora da conta. Rotinas, Ressonância e Maravilhas ficam fora da conta (`untracked`).
- **W20:** os 3 Dons iniciais deveriam vir da Raça, do Augúrio e da Tribo. O XP do Dom depende do nível (nível × 3, ou × 5 fora do grupo), e o item da lista não tem nível numérico: o pedido de XP de Dom fica indisponível. Renome não se compra na criação. Posto, Ritos, Fetiches e Cicatrizes ficam fora da conta.

## Fontes

- V20, criação e bônus: [Magic City MUX, Chargen](http://v20.wikidot.com/chargen) e [LA in Anarchy, New Player Guide](http://lainanarchy.wikidot.com/new-player-guide)
- V20, XP: [LA in Anarchy, XP Tables](http://lainanarchy.wikidot.com/xp-tables) e [Liberation MUSH, Experience Costs](https://liberationmush.site/resources/xp-costs/)
- M20, criação e bônus: [Mage the Ascension, Creation Process](https://wolfwwrpresource.weebly.com/creation.html), que cita M20 p. 64
- M20, XP: [Ascension Sojourns, Xp Chart](https://ascensionsojourns.com/wiki/index.php/Xp_Chart), que cita M20 p. 253, e [Liberation MUSH, Experience Costs](https://liberationmush.site/resources/xp-costs/)
- W20, criação e bônus: [Valley of Rage, Character Creation](http://valleyofrage.weebly.com/character-creation.html) e [Liberation MUSH, Chargen](https://liberationmush.site/s/werewolf/character-creation/), esta só para as alocações, porque o quadro de bônus dela é regra da casa
- W20, XP: [Sheridon WtA, Experience](https://sheridonrpwta.wikidot.com/xp) e [Liberation MUSH, Experience Costs](https://liberationmush.site/resources/xp-costs/)
