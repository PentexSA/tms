# Estudo: navegação da ficha no celular

- **Data:** 2026-10-17
- **Pergunta:** a ficha deve ser uma página única com rolagem ou dividida em abas? Se em abas, quais?
- **Decisão:** **3 abas fixas, uma por zona do template (Ficha · Poderes · Sobre)**, com o rótulo ajustável pelo template. As outras duas variantes ficam no protótipo só para o teste com usuários.

## Critérios

Em ordem de peso:

1. **Simplicidade.** Para quem usa: poucas opções, sempre as mesmas. Para a arquitetura: nada a configurar por sistema. O pedido do produto foi explícito: "quanto mais simples melhor".
2. **Tarefas de mesa,** pesadas pela frequência numa sessão (Anexo C da avaliação).
3. **Descoberta e orientação.** Toda a navegação fica visível, e a pessoa sabe onde está (UX-07: "página de 2.600–3.300 px sem índice, com perda de contexto").
4. **Vários sistemas.** O mesmo esqueleto vale para WoD, D&D, CoC e Fate.
5. **Fonte grande e telas estreitas:** 360 dp com fonte em 130% e 200% (C-09).

## Variantes

```text
A. Rolagem única + chips          B. Abas por seção               C. Abas por zona (escolhida)
┌──────────────────────────┐      ┌──────────────────────────┐    ┌──────────────────────────┐
│ ‹ Helena ● Tremere    ⋮  │      │ ‹ Helena ● Tremere    ⋮  │    │ ‹ Helena ● Tremere    ⋮  │
│ ATRIB HABIL VANTAG SOB›  │      │ Atributos Habilid Vant›  │    │  Ficha │ Vantagens│ Sobre │
│ (HV) identidade        ˅ │      │ (HV) identidade        ˅ │    │ (HV) identidade        ˅ │
│ Atributos ───────────    │      │ ┌ grade 3×3 ┐            │    │ Atributos ───────────    │
│ Habilidades ─────────    │      │ └───────────┘            │    │ Habilidades ─────────    │
│ Vantagens ───────────    │      │   (Atributos cabe        │    │   (atributos e           │
│ Sobre ───────────────    │      │    numa tela)            │    │    habilidades juntos)   │
│  … 3 000–3 600 px …      │      │                          │    │                          │
│ [Vit][Sangue][FdV][Dados]│      │ [Vit][Sangue][FdV][Dados]│    │ [Vit][Sangue][FdV][Dados]│
└──────────────────────────┘      └──────────────────────────┘    └──────────────────────────┘
```

Em todas, o dock (recursos e Dados) e o bloco de identidade ficam fora da navegação e sempre visíveis.

## Método

As medidas foram tiradas do próprio protótipo (`telas/ficha.html`), no Chrome, nos 6 sistemas:

- **Telas:** 390 × 800 px com fonte em 100%, e 360 px com fonte em 130% e 200%.
- **Altura:** a altura da página em cada aba. 800 px significa que o conteúdo cabe numa tela.
- **Tarefas:** rolagem e toques a partir do topo da ficha, sem a ajuda da busca.

Na variante A, os toques contam só a rolagem. Com os chips de atalho, a A empata com a B em toques. A variante B foi medida no seu melhor caso, com o template agrupando seções; sem agrupamento, ela fica com 4 a 7 abas.

## Resultados

### 1. Tamanho das vistas (390 px, fonte 100%, em px)

| Sistema | A. Rolagem única | B. Abas por seção (agrupadas) | C. Abas por zona |
|---|---|---|---|
| Vampiro | 3.013 | 800 · 1.565 · 1.041 · 800 | **1.916** · 1.041 · 800 |
| Mago | 3.304 | 800 · 1.382 · 1.332 · 943 | **1.733** · 1.332 · 943 |
| Lobisomem | 3.073 | 800 · 1.478 · 1.344 · 800 | **1.808** · 1.344 · 800 |
| D&D 5e | 3.627 | 960 · 800 · 800 · 976 · 800 · 1.006 | 1.435 · 1.419 · 1.477 |
| CoC 7e | 2.577 | 800 · 1.270 · 800 · 800 | **1.751** · 800 · 800 |
| Fate | 1.696 | 1.257 · 1.005 · 921 | 1.257 · 1.005 · 921 |

- **A:** cada ficha tem 3,2 a 4,5 telas. Com fonte em 200% a 360 px, chega a 5.900–8.500 px.
- **C:** a maior aba é a "Ficha", com 1,8 a 2,4 telas. Ela junta atributos e habilidades, e o filtro "só com pontos" já reduz as habilidades.
- **B:** as vistas são as menores, mas a aba "Atributos" ocupa uma tela com pouco conteúdo, e são de 4 a 6 vistas por ficha.

### 2. A barra de abas cabe? (abas visíveis sem rolar a faixa para o lado)

| Tela | B. Abas por seção (1 por seção) | C. Abas por zona |
|---|---|---|
| 390 px, 100% | 3 de 4 (WoD), 3 de 6 (Mago, Lobisomem), 3 de 7 (D&D), 3 de 4 (CoC), 3 de 3 (Fate) | **3 de 3 em todos** |
| 360 px, 100% | 2 a 3 visíveis de 4 a 7 | **3 de 3** |
| 360 px, 130% | 2 visíveis de 4 a 7 | **3 de 3** |
| 360 px, 200% | **1 visível** de 4 a 7 (faltam 334–801 px) | **3 de 3** (rótulo em 2 linhas, com hífen) |

Mesmo com o template agrupando seções, a B passa da largura em 5 de 6 sistemas a 390 px. Faltam 51 px no WoD, 117 px no CoC e 207 px no D&D. A 360 px com 200%, faltam de 334 a 571 px. Aba fora da tela não é descoberta. A barra da C nunca rola: as 3 abas dividem a largura e, com fonte muito grande, o rótulo quebra em 2 linhas.

### 3. Tarefas (390 px, a partir do topo da ficha)

| Tarefa | A. Rolagem | B. Seção | C. Zona |
|---|---|---|---|
| Vampiro: ver Destreza | 0 toque · 0 px | 0 · 0 | 0 · 0 |
| Vampiro: ver Ocultismo (habilidade) | 0 · 820 px (1,4 tela) | 1 · 469 px (0,8) | 0 · 820 px (1,4) |
| Vampiro: abrir Taumaturgia (Disciplina) | 0 · 1.202 px (2,0) | 1 · 0 | 1 · 0 |
| Vampiro: ler as notas | 0 · 2.067 px (3,5) | 1 · 0 | 1 · 0 |
| D&D: ver INT | 0 · 0 | 0 · 0 | 0 · 0 |
| D&D: ver Arcanismo (perícia) | 0 · 272 px | 1 · 0 | 0 · 272 px |
| D&D: abrir Bola de Fogo (magia) | 0 · 1.578 px (2,7) | 1 · 53 px | 1 · 495 px (0,8) |
| D&D: achar o Grimório (inventário) | 0 · 1.788 px (3,0) | 1 · 0 | 1 · 0 |
| D&D: ler Ideais | 0 · 2.353 px (4,0) | 1 · 0 | 1 · 202 px |

Estas tarefas custam **o mesmo nas três variantes**, porque não dependem da navegação:

| Tarefa | Onde | Custo |
|---|---|---|
| 2 de dano letal | dock → sheet | 3 toques |
| Gastar 1 Sangue | toque longo no dock | 1 toque, com Desfazer |
| Trocar de forma | dock | 2 toques |
| Montar Destreza + Esportes | Dados | 5 toques, 0 rolagem |

As tarefas mais frequentes numa sessão (dano, gastar recurso, rolar) já não dependem da navegação: o dock e o sheet de Dados resolvem. A navegação pesa nas consultas (poder, nota, inventário) e na leitura.

## Análise

**A. Rolagem única.**
- **A favor:** é boa para ler a ficha inteira em sequência, como o narrador revisando ou alguém evoluindo vários traços.
- **Contra:** perde nas consultas, com 2 a 4 telas até poderes e notas. Também perde orientação: o header recolhe e a pessoa não sabe em que parte está (UX-07). Com fonte em 200%, a ficha passa de 8.000 px.

**B. Abas por seção.**
- **A favor:** tem as menores vistas e o melhor resultado dentro de cada seção.
- **Contra 1, descoberta:** a barra não cabe. Em 5 de 6 sistemas há abas fora da tela, e com fonte grande sobra uma aba visível.
- **Contra 2, simplicidade:** o número de abas varia de 3 a 7 conforme o sistema, e para ficar razoável o template precisa agrupar seções. É configuração a mais em cada sistema novo.
- **Contra 3, leitura conjunta:** separa Atributos de Habilidades, o par mais consultado junto.
- **Contra 4, espaço:** a aba "Atributos" é uma tela quase vazia.

**C. Abas por zona.**
- **A favor 1, consistência:** são sempre 3 abas, na mesma posição, em qualquer sistema. Quem joga Vampiro e D&D no mesmo app encontra a mesma estrutura.
- **A favor 2, sem configuração:** as zonas (`build`, `powers`, `lore`) já são declaradas por todo template. O template só troca o rótulo quando o genérico não serve (`zoneLabels`).
- **A favor 3, descoberta:** a barra cabe sempre, de 360 px com 200% a web.
- **A favor 4, leitura conjunta:** atributos e habilidades (ou atributos, salvaguardas e perícias no D&D) ficam juntos.
- **A favor 5, consultas:** poderes, inventário e notas ficam a 1 toque, com no máximo ~0,8 tela de rolagem.
- **Contra:** a aba "Ficha" é a mais longa, com 1,8 a 2,4 telas. Isso é mitigado pelo filtro "só com pontos", pela busca e pela memória de rolagem por aba.

## Decisão e detalhes de implementação

**C. Abas por zona**, como padrão em todos os tamanhos de tela.

| Sistema | Abas |
|---|---|
| Vampiro, Mago, Lobisomem | Ficha · Vantagens · Sobre |
| D&D 5e | Ficha · Poderes · Itens e notas |
| CoC 7e | Ficha · Equipamento · Histórico |
| Fate | Ficha · Façanhas · Sobre |

- **Rótulo:** padrão "Ficha", "Poderes" e "Sobre". O template troca em `zoneLabels`, com até 14 caracteres para caber a 360 px. A tabela acima mostra o resultado em cada sistema.
- **Fixo fora das abas:** header, identidade, dock e Dados. Aspectos do Fate, quando marcados com `pinTop`, aparecem acima das abas no celular.
- **Acessibilidade:** `tablist`/`tab`/`tabpanel`, setas, Home e End, e ativação automática, porque trocar de aba não tem custo. Painéis inativos ficam `hidden`. Com uma seção só, o título repetiria a aba e fica só para o leitor de tela.
- **Memória:** cada personagem lembra a aba ativa e a rolagem de cada aba (C-20).
- **Impressão e exportação:** todas as abas em sequência.
- **Seção que a pessoa não pode ler:** não aparece. Se a aba ficar vazia, a aba some.

**Fora do escopo, de propósito:** deslizar entre abas. O gesto conflita com o voltar do iOS e com a rolagem horizontal das listas, e acrescenta complexidade. Fica para avaliar no teste com usuários.

## Adendo: sub-abas nas Habilidades × lista compacta

**Pergunta:** dentro da aba "Ficha", colocar as Habilidades em sub-abas (Talentos | Perícias | Conhecimentos) para rolar ainda menos?

**Medida** (390 px, fonte 100%, filtro "só com pontos" ligado):

| | Hoje (linhas agrupadas) | Sub-abas | Lista compacta (chips "Nome N") |
|---|---|---|---|
| Habilidades, Vampiro | 1.133 px | ~481 px | ~514 px |
| Habilidades, Mago | 950 px | ~394 px | ~462 px |
| Habilidades, Lobisomem | 1.046 px | ~481 px | ~514 px |
| Habilidades, Vampiro a 360 px / 200% | 2.573 px | ~1.081 px | ~1.138 px |
| Habilidades visíveis | todas | um grupo (até 8 de 19) | **todas** |
| Toques para ver tudo | 0 | 2 | **0** |

**Decisão: lista compacta.**

- **Corte de rolagem:** praticamente o mesmo das sub-abas, ~55%, com diferença de ~30 px.
- **Visão geral:** mostra todas as habilidades, e não um terço delas.
- **Sem nível novo:** não cria uma segunda barra de abas. As sub-abas também repetiriam o problema TL-13 da tela original.
- **Vários sistemas:** vale para qualquer lista com valor (perícias do D&D e do CoC). Sub-abas só serviriam às Habilidades do WoD, as únicas com grupos.

**Depois de implementar** (altura da aba "Ficha", 390 px):

| Sistema | Antes | Depois | Queda |
|---|---|---|---|
| Vampiro | 1.916 px | 1.381 px | −28% |
| Mago | 1.733 px | 1.329 px | −23% |
| Lobisomem | 1.808 px | 1.360 px | −25% |
| D&D | 1.435 px | 1.245 px | −13% |
| CoC | 1.751 px | 1.441 px | −18% |

Com fonte em 200% a 360 px, o Vampiro foi de 4.430 para 3.195 px.

A lista completa, com pips, continua a um toque ("Mostrar todos") e em Evoluir.

## O que validar com usuários (§10 da avaliação)

O canvas de boards (`telas/index.html`) tem o controle **Navegação** com as três variantes. Roteiro:

1. **Tarefas:** abrir uma Disciplina ou magia, ler uma nota, conferir uma habilidade e montar uma parada. Em cada uma, medir tempo, toques e erros de navegação ("onde está?").
2. **Narrador lendo uma ficha de jogador inteira:** é o único caso em que a A tende a ganhar.
3. **Fonte grande (200%) a 360 px:** todas as abas encontradas sem ajuda?
4. **Mesa com dois sistemas (WoD e D&D):** a pessoa transfere o modelo mental de um para o outro?

**Meta:** ≤ 2 toques e ≤ 1 tela de rolagem para qualquer consulta, e zero "não achei".

**Multi-sistema:** as abas saem das zonas que todo template declara, então um sistema novo ganha a navegação pronta, com no máximo três rótulos no `zoneLabels`. Nenhum código de tela por sistema.
