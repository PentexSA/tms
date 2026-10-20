# Auditoria de fidelidade: fichas V20, M20 e W20

Diagnóstico de 20/10/2026, feito do ponto de vista de um jogador veterano antes de levar o app para a mesa. Compara os templates publicados (`design/templates/vtm-v20.json`, `mta-m20.json`, `wta-w20.json`), o motor (`packages/sheet-core`) e a ficha renderizada no app com as fichas oficiais da edição de 20º aniversário.

## Status das correções (branch `feat/fichas-wod-completas`, 20/10/2026)

Templates novos: `vtm-v20` 1.3.0, `mta-m20` 1.2.0 e `wta-w20` 1.2.0. Nas tabelas abaixo, as linhas resolvidas têm **"Resolvido:"** no impacto. Fichas já criadas ficam na versão em que nasceram e não ganham os campos nem os valores iniciais novos; só a correção do Renome (código do core) as alcança.

| Item | Como ficou |
|---|---|
| Renome temporário nascendo em 10 | Recurso com `tempUncapped` começa em 0 (regra genérica do core) |
| Valores iniciais (Humanidade, FdV, Fúria, Gnose, Renome, Quintessência) | `default` com fórmula no contrato: acompanha Virtudes, Antecedentes e identidade até o jogador gravar o campo |
| Qualidades e Defeitos, Experiência | Nos três sistemas: duas listas (Tipo e Custo/Bônus) e Experiência total, gasta e disponível |
| Fraqueza do clã (V20) | Texto livre em Vantagens, ao lado da Trilha |
| Ressonância, Maravilhas e Familiar (M20) | Ressonância com três linhas fixas (pontos e descritor); Maravilhas com Nível, Arete e Quintessência; Familiar em texto |
| "Filhos do Éter" (M20) | "Sociedade do Éter" |
| Nome da Matilha, Campo, Cicatrizes e Deformidade (W20) | Cabeçalho na ordem da ficha W20; Deformidade "só para Impuros" em Sobre; Cicatrizes em lista |
| Testes de Fúria e Gnose (W20) | Conferido no livro: frenesi, ativar fetiche e atravessar a Película usam o permanente, que é o que o app já fazia |

Continua aberto: Aparência nascendo em 0, Sabá e Trilhas, Afiliação do Mago, Geração abaixo da 8ª, Esferas como atributo de parada, Forma inicial pela Raça (mantida em Hominídeo por decisão), Dons, Ritos e Fetiches (sem mudança por decisão) e a criação por pontos.

## Resumo

Nenhum problema impede uma mesa "padrão" de jogar: Camarilla no Vampiro, Tradições no Mago, Garou de seita no Lobisomem. A ficha de jogo está fiel ao livro: atributos, habilidades, vitalidade, sangue, roda, formas e rolagem. Os problemas estão em dois lugares:

- **Valores de uma ficha nova:** três erros. O mais grave é o Renome temporário do Lobisomem, que nasce em 10.
- **Partes da ficha de papel que ainda não existem:** Experiência, Qualidades e Defeitos, Trilhas do Sabá, Afiliação do Mago e criação por pontos.

## Como foi validado

- **Código:** os três templates, `derive.ts`, `resolve.ts`, `rules/wod-stacking.ts` e `rollers/pool-success.ts`, além das seções "Fora da v1/v2" dos planos, para separar o que foi adiado de propósito do que é erro.
- **App rodando:** Postgres, API e export web, com uma ficha de cada sistema criada por Playwright. Foram verificados o formulário de criação e a ficha em Editar (abas Ficha, Vantagens e Sobre). O modo Jogo não foi capturado: o que se diz sobre ele vem do template e do motor.
- **Referência:** a busca na web não trouxe as fichas oficiais nem confirmou qual editora publicou as edições de 20 anos no Brasil. A comparação usa as fichas oficiais em inglês (de memória) e a terminologia da Devir (era Revised), que é a que o jogador brasileiro reconhece. Os pontos marcados com **(?)** não estão confirmados.

Legenda: ✅ fiel · ⚠️ divergente · ❌ faltando · ➕ extra

---

## Vampiro: A Máscara (V20)

| Seção | Ficha oficial | No app | Status | Impacto na mesa |
|---|---|---|---|---|
| Cabeçalho | Nome/Jogador/Crônica · Natureza/Comportamento/Conceito · Clã/Geração/Senhor | As mesmas três colunas. Jogador e Crônica vêm da conta e da crônica | ✅ | – |
| Clãs | 13 clãs + Caitiff; linhagens no apêndice | 13 + Caitiff, lista fechada | ⚠️ | Quem joga Samedi, Salubri etc. não tem como marcar |
| Geração | Antecedente, a partir da 13ª | 13 − pontos, até a 8ª | ✅ / ⚠️ | Ancião abaixo da 8ª (ou personagem da 14ª/15ª) não cabe |
| Atributos | 9 na ordem oficial, 1 a 5 | 9 na ordem oficial, 1 a 5 | ✅ | – |
| Aparência | Começa em 1 (0 só para Nosferatu) | Mínimo 0, e a ficha nova **nasce com 0** | ❌ | Um Toreador esquecido rola Carisma + 0 de Aparência |
| Limite de traços por Geração | 8ª: 5 · 7ª: 6 · 6ª: 7… | Sempre 5 | ⚠️ | Só importa abaixo da 8ª |
| Talentos, Perícias e Conhecimentos | As 30 da V20 (sem Esquiva; com Ciência e Tecnologia) | Exatamente as 30 | ✅ | – |
| Disciplinas | 17 do básico, 0 a 5 | As 17, 0 a 5, com notas | ✅ | – |
| Trilhas de Taumaturgia/Necromancia e rituais | Trilha primária, secundárias e rituais | Só a nota da Disciplina | ⚠️ | O Tremere usa itens livres ou notas |
| Antecedentes | Inclui Domínio, Identidade Alternativa, Mão Negra e Rituais | Catálogo de 10, mas aceita nome livre | ⚠️ | Pequeno |
| Virtudes | Consciência/Convicção, Autocontrole/Instinto, Coragem | Só Consciência, Autocontrole e Coragem | ⚠️ | Sabá não tem onde marcar |
| Humanidade/Trilha | Humanidade **ou** uma Trilha (e Comportamento, o *Bearing* (?)) | "Humanidade" fixa, 0 a 10, e a ficha **nasce com 0** | ✅ / ⚠️ | Resolvido: nasce em Consciência + Autocontrole. Sabá continua sem lugar |
| Força de Vontade | Permanente × temporária, 1 a 10 | Igual; nasce igual à Coragem | ✅ | – |
| Pontos de Sangue | Tabela por Geração, gasto por turno | Tabela V20 certa (13ª: 10/1 … 4ª: 50/10), curar 1 nível e Despertar | ✅ | – |
| Vitalidade | 7 níveis (0/−1/−1/−2/−2/−5/Incapacitado) e 3 tipos de dano | Igual; contusivo vira letal com a trilha cheia | ✅ | – |
| Rolagem | Dificuldade 6, o 1 anula, falha crítica sem sucessos, FdV dá +1, especialização faz o 10 contar duas vezes | Igual | ✅ | – |
| Fraqueza do clã | Campo próprio | Não existe | ✅ | Resolvido: texto livre em Vantagens |
| Qualidades e Defeitos, Experiência | Na ficha | Não existem | ✅ | Resolvido: duas listas com custo e a Experiência total, gasta e disponível |

## Mago: A Ascensão (M20)

| Seção | Ficha oficial | No app | Status | Impacto na mesa |
|---|---|---|---|---|
| Cabeçalho | Nome/Jogador/Crônica · Natureza/Comportamento/Essência · Afiliação/Seita/Conceito (?) | Tradição, Essência e **Casa** | ⚠️ | Sem Afiliação: não dá para jogar Tecnocracia nem Desvairados (decisão 7 do plano-v1) |
| Tradições | 9, com os nomes da M20 | 9 + Órfão | ✅ | Resolvido: "Sociedade do Éter" |
| Essência | 4 | 4 | ✅ | – |
| Atributos | 9, 1 a 5 | Igual, mas a Aparência nasce com 0 | ❌ | Como no Vampiro |
| Habilidades | 11/11/11 da M20 (Arte, Artes Marciais, Meditação, Pesquisa, Tecnologia, Cosmologia, Enigmas, Esoterismo) | Exatamente as 33 | ✅ | – |
| Esferas | 9, 0 a 5, nunca acima do Arete | Igual, com o aviso "máx. pelo Arete" | ✅ | – |
| Afinidade | Uma Esfera, com pelo menos 1 ponto | Escolha sem essa regra | ⚠️ | Pequeno |
| Arete | 1 a 10 | 1 a 10 | ✅ | – |
| Antecedentes | ~30 (Arcano, Santuário, Familiar, Maravilha, Culto…) | Catálogo de 14 (entraram Familiar e Maravilha), aceita nome livre | ⚠️ | Pequeno |
| Roda | 20 casas, Quintessência × Paradoxo | Igual, com a regra de consumo | ✅ | – |
| Quintessência inicial | Igual ao Avatar | Acompanha o Avatar até a roda ser gravada | ✅ | Resolvido; a FdV nasce em 5 |
| Foco | Paradigma, Prática e Instrumentos | Os três, em texto | ✅ | – |
| Ressonância | Dinâmica, Entrópica e Estática | Três linhas fixas, com pontos e descritor | ✅ | Resolvido |
| Rotinas | Lista | Lista com notas | ✅ | – |
| Rolagem de magia | Arete; dificuldade = Esfera mais alta + 3 (coincidente) ou + 4 (vulgar); +5 com testemunhas e teto 9 (?) | Atalho de Arete, dificuldade digitada à mão | ⚠️ | Adiado no plano |
| Esferas na parada | Esfera não é atributo de parada | Aparecem como opção de "Atributo" (`mta-m20.json:706`) | ➕ | Deixa montar "Força + Correspondência", que não existe |
| Maravilhas, Familiar, Qualidades e Defeitos, Experiência | Na ficha | Maravilhas (Nível, Arete, Quintessência), Familiar, Qualidades e Defeitos, Experiência | ✅ | Resolvido |

## Lobisomem: O Apocalipse (W20)

| Seção | Ficha oficial | No app | Status | Impacto na mesa |
|---|---|---|---|---|
| Cabeçalho | Nome/Jogador/Crônica · Raça/Augúrio/Campo · Tribo/Nome da Matilha/Totem da Matilha, Conceito (?) | Nome, Nome de feito, Conceito, Seita · Raça, Augúrio, Campo · Tribo, Nome da Matilha, Totem | ✅ / ⚠️ | Resolvido: Nome da Matilha e Campo, na ordem da ficha. Não há Natureza nem Comportamento; não está confirmado se a ficha W20 os traz no cabeçalho, mas muitas mesas usam |
| Raças, Augúrios, Tribos | 3, 5 (com as luas) e 13 | Iguais; "Impuro" é o termo da Devir | ✅ | – |
| Posto | 0 a 5 (Filhote, Cliath, Fostern, Adren, Athro, Ancião) | Igual, com os nomes | ✅ | – |
| Atributos | 9, 1 a 5 | Igual, mas a Aparência nasce com 0 | ❌ | Como no Vampiro |
| Habilidades | 10/10/10 da W20 (Instinto Primitivo, Enigmas, Rituais) | Exatamente as 30 | ✅ | – |
| Formas | Glabro (For +2, Vig +2, Man −2, Apa −1); Crinos (For +4, Des +1, Vig +3, Man −3, Apa 0); Hispo (For +3, Des +2, Vig +3, Man −3); Lupino (Des +2, Vig +2, Man −3) | Todos os modificadores certos; Fúria opcional para mudar na hora | ✅ | – |
| Dificuldades de forma e Delírio | Glabro e Hispo: dificuldade 7; Delírio | Só uma nota | ⚠️ | Adiado no plano |
| Forma inicial | Depende da raça | Sempre Hominídeo | ⚠️ | Adiado no plano |
| Fúria, Gnose e FdV | Permanente × temporária | Igual | ✅ | – |
| Valores iniciais | Fúria pelo augúrio, Gnose pela raça, FdV pela tribo | Saem da identidade e acompanham até serem gravados | ✅ | Resolvido (tabelas conferidas no livro) |
| Renome | Glória, Honra e Sabedoria: permanente × temporário, temporário independente | Temporário nasce em 0; permanente inicial pelo Augúrio | ✅ | Resolvido. O Ragabash nasce com 0 e distribui os 3 pontos à mão |
| Dons, Ritos e Fetiches | Lista | Dons (Posto, Origem), Ritos (nível 0 a 5), Fetiches (Nível, Gnose) | ✅ ➕ | Fetiches com lista própria é melhor que o papel |
| Antecedentes | 10 da W20 | Os 10 exatos | ✅ | – |
| Vitalidade e Regenerar | 7 níveis; regenera contusivo e letal | Igual | ✅ | – |
| Testes de Fúria e Gnose | Permanente (frenesi, ativar fetiche, atravessar a Película) | O **permanente** (`pool-success.ts`, `fieldValue`) | ✅ | Conferido no livro |
| Experiência, Qualidades e Defeitos, Cicatrizes, deformidade do Impuro | Na ficha | Os quatro; a Deformidade é texto com "Só para Impuros" | ✅ | Resolvido |

## Criação de personagem (os três sistemas)

| Regra | Livro | No app |
|---|---|---|
| Atributos 7/5/3, Habilidades 13/9/5 (máx. 3 na criação) | Os três sistemas | ❌ Não há orçamento: tudo é livre em Editar |
| Vantagens | V20: 3 Disciplinas, 5 Antecedentes, 7 Virtudes · M20: 7 Antecedentes, 6 Esferas, Arete 1, FdV 5 · W20: 5 Antecedentes, 3 Dons | ❌ |
| Pontos de bônus (15) e custos de XP | Por sistema | ❌ |

A criação por pontos está adiada de propósito (seção "Fora" de `plano-v0`, `plano-v1` e `plano-v2`). Do lado do jogador, o efeito é que o app não confere nada: o narrador revisa a ficha com o livro aberto.

---

## Divergências por gravidade

### Bloqueia o jogo

Para a mesa padrão, nenhuma. Bloqueia **mesas específicas**:

1. **Sabá e Trilhas de Iluminação (V20).** Não há como marcar a Trilha nem Convicção/Instinto (`vtm-v20.json:386-406`, seção `morality` em `:586`). Correção no template:
   - um `choice` "Trilha" (Humanidade, Trilha de Caim…);
   - rótulos "Consciência/Convicção" e "Autocontrole/Instinto", como a ficha de papel faz.
2. **Tecnocracia e Desvairados (M20).** A Tradição é o único seletor de facção (`mta-m20.json:41-55`). Correção no template:
   - `choice` "Afiliação" (Tradições, Tecnocracia, Desvairados);
   - a Seita como texto ou um `choice` por afiliação.
3. **Anciões (V20).** A Geração só vai da 8ª à 13ª (`packages/sheet-core/src/derive.ts:39`), e não há limite de traço por Geração. Correção:
   - permitir um ajuste de Geração além do antecedente;
   - uma derivação nomeada `vtmTraitMax` usada no `max` dos atributos, no mesmo padrão de `vtmBloodPool`. O modelo de dados não muda.

### Atrapalha

1. ✅ **Renome temporário nasce em 10 (bug).** Está em `wta-w20.json:478-499` (`tempUncapped` + `max: 10`). Em `packages/sheet-core/src/resolve.ts:296`, `current: int(v.current) ?? shownMax ?? 0` enche o recurso porque `shownMax = max`. A regra genérica "ficha nova começa cheia" não vale para recurso sem teto: ele deveria nascer em 0.
2. **Aparência nasce em 0.** Está em `vtm-v20.json:118`, `mta-m20.json:112` e `wta-w20.json:173`. O contrato já tem `default` em `rating` (README §3: "Sem valor na ficha, vale `default` ou `min`"). A correção é só no template: `"default": 1` mantendo `min: 0`.
3. ✅ **Humanidade nasce em 0** (`vtm-v20.json:400`). O certo é Consciência + Autocontrole. Um `default` resolve o susto até a criação por pontos existir.
4. ✅ **Sem Experiência nos três sistemas.** O jogador anota XP toda sessão. Correção no template: um campo de Experiência (total e gasto); não precisa de código.
5. ✅ **Sem Qualidades e Defeitos nos três sistemas.** Correção no template: uma `list` com o custo em `meta`.
6. ✅ **Ressonância do Mago.** Correção no template: uma `list` com o tipo (Dinâmica/Entrópica/Estática) e uma nota.
7. ✅ **Lobisomem sem Nome da Matilha e Campo** (e talvez Natureza/Comportamento). Correção no template: campos de texto em `identity.columns`.
8. **Trilhas e rituais de Taumaturgia/Necromancia.** Correção no template: uma `list` "Trilhas e Rituais" com nível.
9. ✅ **Valores iniciais derivados** (FdV = Coragem; Quintessência = Avatar; Fúria, Gnose e FdV do Lobisomem). Dependem da criação por pontos.

### Cosmético

- ✅ "Filhos do Éter" em vez de Sociedade do Éter (`mta-m20.json:52`).
- Esferas como opção de "Atributo" (`mta-m20.json:706`). Antes de tirar, conferir se o atalho de Arete continua válido, porque o Arete mora na seção `spheres`.
- Fraqueza do clã, linhagens e catálogos de Antecedentes incompletos (V20 e M20).
- Sangue nasce cheio (o livro manda rolar 1d10).
- As habilidades seguem a ordem alfabética do inglês. É a ordem oficial, mas em português parece embaralhada.
- Termos não confirmados contra a tradução brasileira: "Ladroagem" (Larceny) e "Observadores das Estrelas" (Stargazers) **(?)**. O resto (Prontidão, Esportes, Manha, Lábia, Rapidez, Tenebrosidade, Metamorfose, Primórdio, Impuro, Posto, os níveis de Vitalidade) bate com o que o jogador brasileiro conhece.
- Conferir no livro **(?)**: se a regra da especialização (o 10 conta duas vezes) é a mesma na M20 e na W20, e o teto de dificuldade 9 da magia na M20.

## Erro × escolha de design

**Escolhas aceitáveis, sem perder informação:**

- Jogador e Crônica fora da ficha, vindos do contexto.
- Abas Ficha/Vantagens/Sobre e o filtro "Só com pontos".
- Geração derivada do antecedente, que é como o livro faz.
- Dons e Ritos sem catálogo, por licença.
- Dificuldade da magia e das formas digitada à mão.
- Casa, Nome de feito, Citação, Fetiches e Notas do Narrador como extras ➕ úteis.

**Erros de verdade:** Renome em 10, Aparência e Humanidade em 0, "Filhos do Éter" e Esferas como atributo de parada. Corrigidos: Renome, Humanidade e "Sociedade do Éter".

## Eu levaria para a mesa hoje?

- **Vampiro (Camarilla):** sim. A ficha de jogo é melhor que o papel: o sangue sai pela Geração, a Vitalidade aplica a penalidade e a rolagem segue a V20. Aparência e Humanidade precisam de ajuste à mão, e XP e Qualidades ficam nas Notas. Para Sabá ou anciões, não.
- **Mago (Tradições):** sim para jogar, porque a roda, o limite pelo Arete e as 33 habilidades estão certos. Para montar a ficha, ainda depende do livro: sem Ressonância, sem Afiliação e sem Quintessência inicial.
- **Lobisomem:** só depois de zerar o Renome na mão. Fora isso, as formas, as habilidades e os antecedentes são a parte mais fiel dos três.

Resumindo: como **ficha de jogo**, está fiel. Como **ficha de criação e evolução**, ainda não substitui o livro, porque falta XP, criação por pontos e Qualidades e Defeitos.

Todas as correções sugeridas mantêm o modelo de dados agnóstico de sistema: entram nos templates, ou em regras genéricas e derivações nomeadas do `sheet-core`, nunca em colunas fixas de WoD.
