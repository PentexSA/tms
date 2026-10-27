# Plano de implementação da v4: criação por pontos e evolução por experiência

> Plano · 2026-10-23 · base conferida: `main` em `8a978b1`, merge do [PR #31](https://github.com/PentexSA/tms/pull/31).

Este plano leva a v3 até uma **ficha criada dentro de um orçamento e evoluída por pedidos de XP aprovados pelo narrador**. A contabilização é determinística, roda no mesmo motor na API e no app e recebe as regras dos templates. O risco principal da v4 é a integridade da conta: pontos básicos, bônus, créditos, saldo de XP e aprovação precisam permanecer consistentes apesar de alterações concorrentes e reenvios.

**Estado deste documento:** em execução na branch `feat/v4-criacao-xp`. Etapas 0, 1 e 2a feitas e validadas localmente (§5.0); demais em andamento. Os resultados da v3 são antecedentes registrados, não evidências de validação da v4.

| Documento | Papel |
|---|---|
| [painel-narrador.md](painel-narrador.md), §§5.1, 5.5, 5.6, 7, 8 e 10 | Escopo, contratos propostos e decisões do produto |
| [plano-v3.md](plano-v3.md) e [validacao-v3.md](validacao-v3.md) | Garantias implementadas e evidências anteriores |
| [arquitetura-motor-de-ficha.md](arquitetura-motor-de-ficha.md) | Fronteiras do motor, pipeline de escrita, armazenamento e modos |
| [README dos templates](../design/templates/README.md) | Contrato atual, validação e publicação de versões |
| [plano-v0.md](plano-v0.md), [plano-v1.md](plano-v1.md) e [plano-v2.md](plano-v2.md) | Padrão das etapas e estratégia de testes |
| Este documento | Ordem de implementação, dependências, lacunas e critérios de conclusão da v4 |

Cada etapa deve produzir uma alteração revisável, com seus testes e documentação. Uma mudança de contrato atualiza conjuntamente schema JSON, referência JavaScript, tipos, registry, validadores TypeScript, testes de paridade e README. A organização dos planos anteriores em PRs não concede autorização para publicar, enviar alterações remotas ou fazer merge.

---

## 1. Onde queremos chegar

A jornada principal será `e2e/tests/journey-creation.spec.ts`, com sessões separadas de narrador e jogadores:

1. O narrador cria a crônica, liga a aprovação de ficha e convida dois jogadores.
2. O jogador cria a ficha pela identidade e entra no modo de criação por pontos.
3. Escolhe as prioridades e distribui pontos básicos, acompanhando os contadores por grupo.
4. Tenta concluir com um grupo incompleto; a operação é recusada e o problema aparece naquele grupo.
5. Distribui os pontos restantes e bônus, salva as escolhas e espera a sincronização.
6. Conclui a criação; a ficha passa a `pending` e o jogador não consegue alterá-la.
7. O narrador aprova; a ficha passa a `active`.
8. O narrador concede XP ao grupo, com motivo. Cada ficha recebe seu crédito e extrato, uma única vez.
9. O jogador consulta o saldo e solicita “Destreza 2 → 3”, vendo o custo calculado antes de enviar.
10. O narrador aprova; o traço sobe, o XP gasto aumenta, o pedido fica aprovado e o extrato aponta para o lote correspondente.
11. Um segundo pedido sem saldo é recusado no envio, sem criar um pendente. Um cenário complementar prova que um pedido aceito pode ficar sem saldo antes da aprovação: a aprovação é recusada sem débito e o pedido continua pendente. Recusa e cancelamento são exercitados em cenários complementares.
12. O outro jogador continua sem receber os dados dessa ficha, inclusive nas listas, contagens e rotas novas.

Também precisam funcionar: aprovação desligada por padrão, ajuste de orçamento por crônica e ficha, criação livre autorizada pelo narrador, devolução da ficha pendente para correção e ajuste/estorno de concessão de XP. As definições acrescentadas nesta revisão estão identificadas no §2.3; não são atribuídas às decisões originais do painel.

A jornada roda em Chromium e WebKit. O fluxo nativo novo cobre criação, aprovação e XP em Android. A execução nativa de iOS tem resultado próprio, conforme a infraestrutura disponível; WebKit não a substitui.

## 2. Ponto de partida

Conferido na base `8a978b1`:

| Área | Implementado | Falta para a v4 |
|---|---|---|
| Integração | A v3 foi integrada à `main` pelo PR #31 | Construir a v4 sobre essa base e preservar suas garantias |
| Templates publicados | `vtm-v20` 1.5.0, `mta-m20` 1.4.0 e `wta-w20` 1.4.0, listados em `apps/api/src/templates/published.ts` | Regras de criação, bônus e XP verificadas nos livros |
| Outros sistemas | D&D, CoC e Fate são fixtures, fora de `PUBLISHED_SYSTEMS` | Provar point-buy de 27 no fixture de D&D sem publicá-lo |
| Core | `compileTemplate`, `validateSheet`, `applyBatch`, defaults derivados, classificação de mudanças e política de escrita | `checkCreation`, `costOf`, regras e tipos de contabilização |
| Contrato | Schema fechado, referência JS e validadores TS com paridade | `creation`, `costs.freebie`, `costs.xp` e respectivos nomes no registry |
| Estados | `creating`, `active`, `archived`, `dead` e `locked_at` | `pending`, submissão, aprovação e devolução para correção |
| Conclusão | `POST /characters/:id/creation/complete`, só do narrador e sem orçamento | Conclusão pelo dono na criação por pontos, validação e aprovação opcional |
| Escrita | Política dentro das transações de eventos e custos de rolagem; dono não evolui em `active`; ex-membro só lê | Proteger XP em todos os estados e impedir evolução disfarçada de edição |
| Experiência | Campos `xpTotal`, `xpSpent` e disponível derivado nos três templates; seção sem `permissions` | Extrato, concessão e pedidos; hoje o dono ainda escreve XP em `creating` |
| Operações | Dano, cura, recuperações e reversão; atomicidade, idempotência e detecção de conflitos | Concessões sem duplicação e proteção dos lotes contábeis contra reversão incompatível |
| Banco | Última migration: `0015_chronicle_operations`; lotes, eventos, `from_absent` e `chronicle_audit` | Configuração da criação, pedidos, extrato e vínculos contábeis |
| Frontend | Identidade no formulário inicial; redirecionamento para `?mode=evolve`; modos `read/play/evolve` | Modo `create`, prioridades, contadores, conclusão e experiência |
| Edição | O botão “Concluir” do editor abre o resumo para salvar um rascunho | Separar esse salvamento da conclusão da criação no servidor |
| Rede | Fila FIFO de eventos por ficha, cache por usuário, IndexedDB no web e SQLCipher no nativo | Persistência das escolhas de criação e reenvio seguro dos comandos novos |
| Testes | Matriz de AuthZ nos três sistemas, PGLite, Postgres real, Playwright e sete fluxos Maestro | Casos de contabilização, pedidos, concorrência e jornada da v4 |

`doc/validacao-v3.md` registra CI e sete fluxos Android aprovados no fechamento anterior. A validação nativa de iOS permaneceu pendente por decisão do usuário. Nenhum desses resultados deve ser apresentado como execução da v4.

### 2.1 Decisões mantidas

| Assunto | Decisão |
|---|---|
| Aprovação de ficha nova | Opcional por crônica; desligada por padrão |
| XP | Narrador concede e aprova cada gasto; jogador vê o saldo e solicita |
| Evolução após criação | Jogador depende de aprovação; não grava o traço diretamente |
| Regras da casa na criação | Narrador ajusta orçamento por crônica ou ficha e pode autorizar criação livre |
| Motor | Genérico, puro e compartilhado entre API e app |
| Templates antigos | Compatibilidade dispensada pelo usuário nesta tarefa; não implementar migração de fichas ou adaptadores históricos |
| Dados de teste | Podem ser recriados em bancos descartáveis; a dispensa de compatibilidade não autoriza apagar outros dados |
| Publicação e merge | Dependem de autorização explícita, separada da implementação |

### 2.2 Lacunas encontradas

| Lacuna | Encaminhamento | Etapa |
|---|---|---|
| A fórmula proposta só cobre básicos lineares com bônus uniforme; D&D tem custo ponderado | Acrescentar regra genérica de tabela cumulativa, sem condição por sistema | 1 |
| Aparência tem `min: 0` e `default: 1`; outros iniciais são derivados | Definir baseline condicional separado de faixa técnica e de modificadores de jogo; conferir o caso Nosferatu, Aparência 0 sem aumento | 1, 2b |
| Defaults acompanham as fontes até serem gravados; recurso é salvo inteiro | Garantir equivalência entre ausente e materializado; congelar iniciais necessários ao concluir | 1, 4 |
| Virtudes, Humanidade e FdV dependem do estágio de aplicação de bônus | Conferir o livro e demonstrar a composição por fixtures; não inferir o inicial da ficha final sem prova | 1, 2b |
| `cap` atual aceita excedente inativo, como Esferas acima de Arete | Distinguir limite de leitura, teto de básicos e restrição de compra/criação | 1, 2b |
| Exemplos atuais incluem fichas incompletas e evoluídas | Criar oráculos próprios de contabilização; não usar os exemplos atuais como criação válida | 1, 2b |
| Disciplinas têm nomes, mas faltam relações de custo por clã; Dons usam origem em texto livre | Forma das identidades em 2a; relações reais verificadas em 2b; texto do jogador não autoriza desconto | 2a, 2b |
| Qualidades e Defeitos já têm custo/bônus nos metadados | Formalizar participação no orçamento, limites de crédito e validação | 1, 2b |
| Alguns traços têm evolução narrativa, sem preço comum de XP | Tornar indisponibilidade e pré-requisitos explícitos; custo ausente nunca significa zero | 1, 2b |
| Especialização, nome de poder e certos metadados textuais são `edit` | Revisar partes que mudam identidade mecânica, elegibilidade ou preço, mantendo notas livres editáveis | 1, 7 |
| O dono escreve XP em `creating` | Restringir seção e todos os caminhos de escrita, incluindo criação inicial e reset de campo | 2a, 6 |
| Reversão genérica aceita lotes numéricos e falta caminho para corrigir concessão | Fechar contadores em `/events` para todos e oferecer ajuste/estorno auditado no extrato | 6, 7 |
| A proposta exige básicos exatos, diz que bônus devem caber e também menciona sobra recusada | Formalizar políticas de fechamento por orçamento (§3.1) | 1 |
| A rota de status só barra diretamente `creating → active` | Impedir também caminhos indiretos por arquivamento/reativação e atalhos de aprovação | 4 |
| Prioridades e orçamento não estão em `sheet_data` | Versionar metadados e detectar conclusão com configuração desatualizada | 3, 4 |
| A Mesa filtra `creating/active` por padrão | Dar visibilidade explícita a `pending` na API e no app | 4, 5 |

Os exemplos não são testes de orçamento: Otto demonstra Esfera acima de Arete, Iara já tem Posto 2 e quatro Dons, e Lia é nível 5 com Inteligência 18. Seus usos atuais de renderização, jogo e limites devem ser preservados ou ajustados com justificativa.

### 2.3 Novas definições de planejamento desta revisão

Estas definições foram acrescentadas na revisão de 23/10/2026 e registradas também em [painel-narrador.md, §10.1](painel-narrador.md#101-definições-de-planejamento-da-v4-23102026). Não constavam das decisões de 21/10 e não representam funcionalidades implementadas. Os números abaixo são os do registro novo no painel.

| # | Definição adotada no roteiro | Motivo |
|---|---|---|
| 11 | Devolver `pending → creating`, só pelo narrador e por comando próprio auditado | Permitir correção pelo dono; exceção restrita, sem reabrir `active` nem liberar retorno pela rota genérica de status |
| 12 | Narrador que conclui também aprova e ativa na mesma transação | Evitar que ele precise aprovar a própria conclusão; ação identificada como “Concluir e aprovar” |
| 13 | Saldo é conferido no envio e na aprovação, sem reserva por pedido | Cumprir a jornada do painel e proteger contra consumo posterior por outro pedido |
| 14 | Contadores de XP fechados em `/events` para todos; narrador corrige por ajuste/estorno no extrato | Preservar autoridade administrativa com reconciliação contábil |
| 15 | Desligar aprovação não ativa fichas já `pending` | Evitar ativação em massa implícita; cada pendente exige decisão explícita |
| 16 | Rascunho salvo pode faltar pontos, mas não exceder bônus/limites de compra | Concretizar “dentro do orçamento”; recálculo ocorre sobre o lote inteiro |
| 17 | Alteração relevante do preço/elegibilidade também torna pedido `stale` | Não cobrar valor diferente do apresentado nem aprovar uma compra que deixou de ser elegível |
| 18 | Arquivamento/remoção suspende decisões de gasto, sem mudar automaticamente `pending` | Preservar ordem de travas e histórico; leitura não executa transições |
| 19 | Cada pedido de XP sobe exatamente um nível, ou compra o primeiro ponto de um traço novo | Custo, unicidade por traço e `stale` ficam por passo; avançar mais exige novo pedido após a aprovação |
| 20 | Ficha travada: o dono não cria pedido; os pendentes continuam, o narrador aprova/recusa e o dono pode cancelar | A trava tira a iniciativa do dono sem bloquear a autoridade do narrador, que escreve em todos os estados |
| 21 | Edições do narrador em `creating`/`pending` passam pela conta; para exceder, ele ajusta o orçamento da ficha (também em `pending`) ou autoriza criação livre; aprovar roda `checkCreation` | Mantém a conta consistente e torna a regra da casa explícita e auditada, sem bypass por papel |
| 22 | Motivos da devolução e da recusa de pedido ficam legíveis ao dono e ao narrador, fora do `chronicle_audit` | O jogador precisa saber o que corrigir; o registro administrativo continua só do narrador |
| 23 | Concessão e ajuste de XP valem para qualquer ficha não excluída (`creating`, `pending`, `active`, `archived`, `dead`, travada ou não); o gasto continua só em `active` | Crédito não muda traço; o narrador pode dar XP inicial na criação ou creditar quem faltou, sem abrir caminho de evolução fora de `active` |

As demais precisões deste plano — códigos de recusa, fórmulas e testes de capacidades ausentes — são contratos técnicos da execução. Fontes e valores de regras de jogo continuam pendentes da Etapa 2b.

## 3. Contratos que precisam fechar antes das telas

### 3.1 Contabilização de criação

Persistir em `characters.creation` as escolhas e os ajustes autorizados: prioridades, modo por pontos/livre, orçamento efetivo e revisão. Totais e distribuição são calculados pelo servidor; o cliente não informa resultados como autoridade. Não criar um livro-razão da origem de cada ponto.

Para cada grupo linear, o contrato deve definir:

1. **Inicial:** valor gratuito aplicável ao componente, considerando `default`, mínimo, escolha ou dependência conforme a regra de criação.
2. **Investimento:** diferença entre valor base/permanente e inicial. Valores abaixo do inicial exigem tratamento explícito; não geram crédito automaticamente.
3. **Elegível:** parcela do investimento que pode ser financiada por básicos, respeitando o teto de básicos.
4. **Básicos usados:** mínimo entre a soma dos elegíveis e o orçamento do grupo.
5. **Bônus:** investimento que não recebeu básicos, multiplicado pelo preço aplicável do grupo, mais custos e créditos expressamente declarados.
6. **Fechamento:** validação dos grupos, saldo de bônus, pré-requisitos e limites obrigatórios.

No contrato linear de §5.5, o preço de bônus precisa ser uniforme dentro do grupo. `compileTemplate` rejeita seletores sobrepostos, cobertura ambígua e grupos cujo cálculo agregado não determine o preço. Uma eventual regra adicional precisa ter semântica própria demonstrada, sem alocação dependente da ordem dos cliques.

**Política de fechamento adotada para a execução:** básicos e point-buy exigem gasto exato; bônus são limite máximo, conforme “cabe no saldo” em §5.5, salvo regra expressa do template. Sobra de básicos recusa a conclusão; sobra permitida de bônus não se converte em XP. Registrar essa interpretação também no contrato e alinhar os trechos ambíguos da proposta ao implementá-la.

**O que significa estourar:** em grupos lineares, pontos além do orçamento básico são financiados por bônus automaticamente, ao preço do grupo. Ultrapassar os básicos, isoladamente, não é erro. A conta estoura quando o custo de bônus supera o saldo ou quando uma restrição obrigatória de compra é violada. No point-buy, o custo cumulativo acima de 27 é excesso direto. Ambos produzem problemas por grupo e impedem o salvamento/conclusão apropriado; falta de básicos só impede a conclusão.

`checkCreation` recebe modelo, ficha e escolhas/configuração efetivas. Sua saída estruturada deve incluir validade para conclusão, grupos, orçamentos, políticas de fechamento, iniciais, elegíveis, básicos usados/faltantes, bônus disponíveis/gastos/restantes e problemas com código, grupo e caminhos. Nada de texto livre da ficha refletido em mensagens de erro.

O contrato também precisa cobrir:

- Prioridades completas e sem repetição, validadas contra as opções do template.
- Permanente de recurso, valor de item e quantidade de itens como alvos diferentes.
- Alterações de dependências, remoção de itens e reembolso por recálculo.
- Teto só para básicos versus restrição que também vale para bônus.
- Qualidades/Defeitos, teto dos créditos e rejeição de metadados inválidos.
- Valores base, sem cobrar modificadores temporários de Forma ou estado.
- Dependências circulares, grupos inválidos, limites numéricos e entradas hostis.
- Equivalência entre campo ausente e valor equivalente materializado.
- Estágio de cálculo de derivados e sua estabilidade depois da conclusão.
- Baseline e proibição de compra condicionais, por comparações declarativas como `when`. Conferir no V20 o caso de Aparência dos Nosferatu: inicial 0 e impossibilidade de aumentar. O mínimo técnico ou o default geral 1 não podem cobrar pontos, gerar reembolso ou permitir compra indevida nesse caso. Até a consulta, provar o mecanismo com condição sintética.

Não assumir que bônus em Virtudes aumentam gratuitamente os iniciais derivados: conferir a regra. Se a dependência precisar das parcelas básicas, definir uma distribuição canônica, independente da ordem, e provar o resultado. Se uma escolha adicional for indispensável, formalizá-la e validá-la; não esconder origem de pontos em estado de interface.

**Validação parcial decidida na Etapa 1:** `checkCreation` oferece avaliação de rascunho e de conclusão pelo mesmo contrato. Em criação por pontos, `/events` e salvamento de prioridades/orçamento aceitam falta de básicos, mas recusam custo de bônus acima do saldo, teto obrigatório ou crédito inválido, avaliando o resultado atômico do lote. Uma redistribuição pode reduzir um campo e aumentar outro no mesmo lote. Falta de prioridade necessária ao cálculo recusa o avanço dependente com `CREATION_PRIORITIES_REQUIRED`; identidade e grupos independentes continuam editáveis. Configurações que deixariam o resultado inválido também não são persistidas isoladamente. O narrador pode ajustar o orçamento ou autorizar criação livre por comando próprio; não há bypass implícito por papel. O rascunho local pode mostrar excesso enquanto é corrigido, mas não pode ser enfileirado/salvo assim. A fila offline usa a avaliação parcial antes de enviar e o servidor a repete com escolhas atuais, sob trava. Fechamento exato só é exigido na conclusão.

### 3.2 Custo de evolução

`costOf` é função pura do mesmo core, com alvo estável: campo escalar, componente permanente ou item canônico de lista. Deve retornar custo, regra aplicada, contexto relevante e motivo de indisponibilidade, quando houver.

As regras propostas são `flat`, `per-current`, `new` e `when`, com parâmetros e condições em listas fechadas. O contrato final deve definir precedência e rejeitar ambiguidade, preço ausente e regra desconhecida. Nunca assumir compra gratuita.

Cada pedido sobe exatamente um nível (`to = from + 1`) ou compra o primeiro ponto de um traço/item novo; para avançar mais, o jogador faz outro pedido depois da aprovação (§2.3, definição 19). O custo usa a base/permanente apropriada, sem modificadores de jogo. O cálculo inclui pré-requisitos e restrições de compra. A API recalcula e nunca confia no preço enviado pelo cliente.

Sem `costs.xp`, `costOf` retorna resultado explícito indisponível, com código estável `XP_COST_UNAVAILABLE`, sem exceção e sem preço zero. A interface mantém os campos existentes, se houver, mas não oferece pedido de evolução por XP. D&D, CoC e Fate atualmente não têm `costs.xp` nem campos/seção de experiência: não inventar saldo ou uma seção para esses fixtures. Testar também um template sintético com campos de experiência e sem custos, preservando a exibição desses campos sem ação de pedido.

### 3.3 Fixture de D&D: point-buy de 27

Representar por uma regra genérica de custo cumulativo declarada no template. A fórmula de pontos lineares não deve ser adaptada com um `if` de D&D.

| Valor antes de bônus raciais | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|
| Custo total | 0 | 1 | 2 | 3 | 4 | 5 | 7 | 9 |

Orçamento exato: **27**. Referência consultada no planejamento: [Basic Rules 2014, “Variant: Customizing Ability Scores”](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters#VariantCustomizingAbilityScores).

Os campos atuais usam `default: 10`, `min: 1` e `max: 30`. A inicialização de criação deve representar 8 e o limite de compra deve ser 15, sem restringir a faixa geral usada por fichas evoluídas. O fixture testa valores anteriores a bônus raciais; implementar toda a criação de D&D está fora do escopo. D&D continua fora de `PUBLISHED_SYSTEMS`.

Casos obrigatórios: 27 exatos, sobra, excesso, 7/16 recusados, redução com reembolso, ordem independente e custo não linear nos últimos valores. Uma distribuição válida é 15/14/13/12/10/8, com custo 27.

### 3.4 Configuração e ciclo da criação

Precedência: **template → padrão da crônica → ajuste da ficha**. Registrar a configuração efetiva ao iniciar a criação. Alterar o padrão de orçamento da crônica afeta novas fichas; ajustar uma ficha existente em `creating` ou `pending` é uma operação explícita e auditada do narrador. A opção de aprovação vigente é lida na submissão, com conflito de revisão quando necessário. Desligá-la não ativa quem já está `pending`: essas fichas continuam pendentes até aprovação ou devolução explícita do narrador. Fichas `active` não são reabertas por mudança de configuração.

| Operação | Autoridade | Resultado |
|---|---|---|
| Escolher prioridades/distribuir pontos | Dono membro, dentro da política; narrador pode administrar | Continua `creating` |
| Alterar orçamento ou autorizar criação livre | Narrador | Configuração revisada e auditada |
| Concluir por pontos como dono | Dono membro que não é narrador | `active` se aprovação desligada; `pending` se ligada |
| Concluir por pontos como narrador | Narrador, inclusive quando também dono | Conclui e aprova atomicamente: `active`, mesmo com aprovação ligada |
| Concluir criação livre | Narrador, conforme §5.5 | Conclui e aprova atomicamente: `active` |
| Aprovar ficha pendente | Narrador, com revalidação | `pending → active` |
| Devolver ficha para correção | Narrador, com motivo limitado | `pending → creating` |
| Editar ficha pendente | Dono não escreve; narrador administra | Nenhuma aprovação implícita por editar |

Definir timestamps distintos ou semântica inequívoca para submissão e aprovação/conclusão. Ao concluir como narrador, registrar quem concluiu/aprovou e o fato de ser uma decisão conjunta no payload de uma única ação auditada, sem criar um `pending` intermediário. A devolução é exceção exclusiva de `pending`, por comando próprio; não permite `active/archived/dead → creating`. Bloquear ativação por rotas de status ou reativação que não tenham passado pelos requisitos.

Edições do narrador em `creating` e `pending` passam pela mesma avaliação parcial do §3.1. Para exceder o orçamento, como numa regra da casa, ele ajusta o orçamento da ficha ou autoriza criação livre; não há exceção por papel. Aprovar `pending` roda `checkCreation` de conclusão e retorna 422 por grupo quando a conta não fecha. O motivo da devolução fica nos metadados de criação da ficha, legível pelo dono e pelo narrador e por mais ninguém; o `chronicle_audit` continua só do narrador (§2.3, definições 21 e 22).

Criação livre dispensa a conta, mas mantém validação estrutural e permissões; a conclusão pelo narrador já satisfaz a aprovação. Ao ativar, o jogador passa a evoluir por pedidos de XP.

### 3.5 Integridade de XP

Adotar uma fonte única de saldo e extrato. A proposta de persistência é um extrato `xp_entries`, vinculado às operações/lotes, com `xpTotal` e `xpSpent` como projeções atualizadas na mesma transação. Outra estrutura só substitui essa proposta com reconciliação e rastreabilidade demonstradas. A ligação entre campos e experiência é declarativa, sem busca por rótulos de tela.

Pedidos pendentes **não reservam XP**. No `POST /xp-requests`, travar a ficha, calcular o custo e conferir saldo; insuficiência retorna 409 `XP_INSUFFICIENT_BALANCE` sem criar pedido nem auditoria de criação. A criação e sua unicidade devem ser atômicas sem introduzir a ordem ficha → trava de pedido existente. Dois pedidos de traços diferentes podem ser aceitos se cada um couber no saldo disponível naquele momento; não há promessa de aprovação dos dois.

O custo é apresentado ao pedir e recalculado ao aprovar. Mudança no alvo, preço ou elegibilidade relevante torna o pedido `stale`; contexto que não altera preço/elegibilidade e gasto temporário irrelevante não o tornam desatualizado apenas por mudar `sheet_version`. Se o saldo tiver sido consumido depois do envio, a aprovação retorna 409 `XP_INSUFFICIENT_BALANCE`, sem débito, e mantém `pending` para nova decisão após uma concessão.

Só há um pedido `pending` por ficha e traço real, incluindo identidade de item de lista. Um índice único parcial garante isso no banco. Usar o campo inteiro de lista ou nome editável como chave não atende ao contrato.

**Ajuste e estorno.** `xpTotal` e `xpSpent` são projeções fechadas em `/events` para todos os papéis. O narrador corrige XP por `POST /characters/:id/xp-adjustments`, com delta inteiro não zero sobre o total concedido, motivo obrigatório, referência à concessão quando for estorno e chave idempotente. O registro original nunca é apagado/reescrito. Aplicar sob trava da ficha e gravar ajuste, projeção, lote e auditoria na mesma transação. Exigir `xpTotal ≥ xpSpent ≥ 0`; estorno de concessão não pode exceder a parcela ainda não estornada. Se o crédito já foi consumido e a correção deixaria saldo negativo, retornar 409 sem efeito e explicar o limite atual. Não desfazer traço aprovado silenciosamente para permitir a correção; reversão completa de evolução é outro contrato. `xpSpent` só muda junto das aprovações. A UI do narrador encaminha a edição contábil ao ajuste explícito, em vez de liberar contador bruto. Isso preserva sua autoridade administrativa por um canal conciliável com o extrato.

**Pedido pendente e ficha indisponível.** Arquivar, marcar `dead` ou remover o dono não decide o pedido: ele permanece `pending` e a interface indica suspensão derivada do estado/vínculo. Aprovar nessas condições retorna 409 `XP_TARGET_UNAVAILABLE`, sem débito ou alteração do pedido. `GET` nunca marca `stale`. O narrador ainda pode recusar; ex-membro só lê e não cancela. O dono que continua membro pode cancelar o pendente sem escrever na ficha. Reativação e recomposição do vínculo por fluxos autorizados não aprovam automaticamente: na próxima decisão, o servidor revalida alvo, preço, elegibilidade e saldo. Não cancelar pedidos automaticamente dentro da transação de remoção/arquivamento.

**Ficha travada.** Com `locked_at`, o dono não cria pedido (403 `SHEET_LOCKED`) e pode cancelar os pendentes. O narrador aprova ou recusa normalmente, porque escreve em todos os estados; a aprovação segue a transação da Etapa 7 (§2.3, definição 20).

**Motivo da recusa.** Recusar grava um motivo limitado no próprio pedido, legível pelo dono e pelo narrador; outros jogadores não recebem o pedido nem o motivo (§2.3, definição 22).

### 3.6 Códigos de recusa e mensagens

Os códigos abaixo são contratos planejados da v4. A implementação deve atualizar as allowlists/tipos do core e do app e manter as recusas da v3. Autenticação/acesso, ex-membro e estado/trava são avaliados antes das regras contábeis específicas; uma tentativa em `pending` informa o estado. Em ficha editável, a proteção dos contadores precede a classificação genérica `advance`, produzindo o código específico de XP.

| Caso | HTTP / código | Frase-base no app |
|---|---|---|
| Dono escreve em `pending` | 403 `SHEET_NOT_EDITABLE`, `reason: pending` | “A ficha aguarda aprovação do narrador.” |
| Dono rola com custo em `pending` | 403 `SHEET_NOT_EDITABLE`, `reason: pending` | “A ficha aguarda aprovação do narrador. A rolagem não foi feita.” |
| Dono rola sem custo em `pending` | 403 `SHEET_NOT_EDITABLE`, `reason: pending` | Mesmo bloqueio de estado da política; a exceção de rolagem livre vale para `active` travada |
| Qualquer papel grava projeção de XP por `/events`, com estado/vínculo editável | 403 `XP_MANAGED_BY_LEDGER` | Dono: “O narrador concede o XP. Para evoluir, envie um pedido.” Narrador: “Use Conceder XP, Ajustar XP ou a aprovação do pedido.” |
| Lote de criação ultrapassa bônus ou limite obrigatório | 422 `CREATION_BUDGET_EXCEEDED`, problemas por grupo | “O gasto excede o orçamento ou um limite de criação. Redistribua os pontos.” |
| Avanço de criação sem prioridade necessária | 422 `CREATION_PRIORITIES_REQUIRED` | “Escolha as prioridades deste grupo antes de distribuir os pontos.” |
| Conclusão com básicos faltantes | 422 `CREATION_INCOMPLETE`, problemas por grupo | “Distribua os pontos básicos restantes antes de concluir.” |
| Dono pede evolução em ficha travada | 403 `SHEET_LOCKED` | “O narrador travou a ficha. O pedido não foi enviado.” |
| Pedido com mais de um nível (`to ≠ from + 1`) | 422, problema no `to` | “Peça um nível por vez.” |
| Enviar pedido ou aprovar sem saldo | 409 `XP_INSUFFICIENT_BALANCE` | “Saldo de XP insuficiente para esta evolução.” |
| Aprovar com ficha/vínculo indisponível | 409 `XP_TARGET_UNAVAILABLE` | “O pedido está suspenso enquanto a ficha ou o vínculo estiver indisponível.” |
| Custo de XP indisponível | Resultado de `costOf`; 422 `XP_COST_UNAVAILABLE` se houver envio direto | “Este traço não oferece evolução por XP neste template.” |
| Traço/preço/elegibilidade desatualizado | 409 `XP_REQUEST_STALE` | “O traço ou o custo mudou. Faça um novo pedido.” |

Recusa de lote remove o otimista e acrescenta “A alteração foi desfeita.”; recusa de rolagem informa que não foi feita. O app usa `reason`/estado para não mostrar “arquivada ou fora de jogo” a quem está `pending`. Os caminhos retornados continuam filtrados por leitura e sem valores privados.

## 4. Mapa das etapas

| # | Etapa | Trilha | Depende de | Tamanho |
|---|---|---|---|---|
| 0 | Registrar o plano e os contratos observáveis | Documentação | Leitura da base | P |
| 1 | Contrato de contabilização, custos e provas no core | Core, contrato, testes | 0 | G |
| 2a | Estrutura dos templates, permissões e identidades | Contrato, templates, fixtures sintéticas | 1; sem livros | M |
| 2b | Valores e relações de regras conferidos nos livros | Regras, templates, fixtures por sistema | 2a; consulta aos livros | G |
| 3 | Persistência e configuração de criação | Banco, tipos, core | 1, 2a | M |
| 4 | API de criação e aprovação | API, AuthZ, concorrência | 3 | G |
| 5 | Interface de criação | App, web, testes | 4 | G |
| 6 | Extrato, concessão e ajuste de XP | Banco, API, templates | 1, 2a, 3 | G |
| 7 | Pedidos e decisões de evolução | Core, API, concorrência | 6 | G |
| 8 | Interface de experiência e comportamento de rede | App, web, sincronização | 5, 7 | G |
| 9 | Jornada, regressões e fechamento | E2E, nativo, documentação | Todas, inclusive 2b | M |

**Marcos:** A = contrato e estrutura genérica (1–2a); B = criação no servidor (3–4); C = criação utilizável com fixtures (5); D = integridade de experiência (6–7); E = experiência utilizável com fixtures (8); R = regras WoD verificadas (2b); F = fechamento validado dos três sistemas (9).

A ordem contrato → motor testado → estrutura de templates → API → interface é obrigatória. As cadeias 3 → 4 → 5 e 6 → 7 → 8 usam fixtures sintéticas e não dependem de 2b. A pesquisa dos livros pode começar cedo; valores e relações WoD só entram como regras verificadas em 2b, que é obrigatória para a jornada real e o fechamento. Não criar uma dependência indireta de livro em 2a: identidades e estruturas podem ser exercitadas sem inventar tabelas ou filiações de poderes.

## 5. Etapas de implementação

### 5.0 Estado da execução

| Etapa | Estado | Evidência |
|---|---|---|
| 0 | Feita | Base conferida em `8a978b1`; `AGENTS.md`/`CLAUDE.md` lidos; branch `feat/v4-criacao-xp` |
| 1 | Feita, validada localmente | Ver abaixo |
| 2a | Feita, validada localmente | Ver abaixo |
| 2b | Feita, validada localmente | Regras e fontes em [regras-wod.md](regras-wod.md); templates `vtm-v20` 1.7.0, `mta-m20` 1.6.0, `wta-w20` 1.6.0 e migration `0020_product_templates` |
| 3–9 | Em andamento | – |

**Etapa 1, entregue.**

- Contrato em [README dos templates, §14](../design/templates/README.md#14-contabilização-criação-por-pontos-e-xp): `creation` (orçamentos `priority-budget`, `fixed-budget`, `item-count` e `point-buy`; tetos `creation-cap`/`hard-cap`; `baselines` condicionais; `untracked`) e `costs` (`freebie`: `flat`, `item-meta`, `credit`; `xp`: `flat`, `per-current`, com `new` e `when`).
- Listas fechadas `budgetRules`, `capRules` e `costRules` no `REGISTRY` (core e `validate.mjs`) e no `schema.json`; tipos em `packages/sheet-core/src/contract/accounting.ts`; validação referencial em `validate/accounting.ts`, com porta idêntica na referência JS.
- Core: `checkCreation`, `checkCreationBatch` (avaliação parcial), `completionRefusal`, `effectiveCreationConfig`, `validateCreationConfig`, `validateCreationChoices`, `creationFreeze`, `costOf`, `xpBalance` e `xpLedgerFields`.
- Fixture de D&D 1.1.0 com point-buy de 27 (`untracked` declara o resto da ficha); continua fora de `PUBLISHED_SYSTEMS`.
- Template sintético `acct-teste` só nos testes, com números de teste.

**Decisões de contrato tomadas na Etapa 1.**

- O preço de bônus é uniforme por grupo (todos com o mesmo `flat`, ou nenhum); o validador recusa o contrário.
- Fora dos orçamentos, `flat` cobra o investimento inteiro; lista sem pontos no item cobra por item.
- Fail secure na criação: mudança `advance` em campo fora das contas, do extrato e de `untracked` é `CREATION_NOT_PURCHASABLE`.
- Abaixo do inicial é `CREATION_BELOW_INITIAL` (só impede concluir); não gera crédito.
- Avaliação parcial: recusa só problema `blocking` novo ou maior que antes do lote; problema antigo que não piorou não trava identidade ou notas.
- Inicial derivado usa as fontes **finais** (a Moral padrão acompanha a Virtude comprada com bônus). `creationFreeze` lista o que gravar ao concluir.
- `baselines` muda só a conta; o `default` do campo precisa acompanhar a mesma condição para ausente e gravado serem equivalentes.
- `itemIn` só vale com nome do `catalog`; custo de XP usa a base, nunca o efetivo; sem `new`, `per-current` a partir de 0 é indisponível.

**Pendências que dependem do livro (Etapa 2b).** Estágio do inicial derivado (fontes finais versus só as parcelas básicas das Virtudes); regra real de Aparência do Nosferatu; se algum sistema tiver preço de bônus condicional (`when` em `costs.freebie`, hoje não aceito) ou custo de Dom por Posto.

**Etapa 2a, entregue.**

- `vtm-v20` 1.6.0, `mta-m20` 1.5.0 e `wta-w20` 1.5.0: seção `experience` com `permissions` (leitura dono/narrador, escrita narrador) e `costs.xp` só com o mapeamento `total`/`spent`, sem preços. `rules` passou a ser opcional no contrato. As versões publicadas anteriores continuam imutáveis.
- `xpTargetKey`: identidade estável do traço (campo, `campo#idDoItem`, `campo@nome` para item novo).
- Fixture sintético `design/templates/testes/acct-teste.json` (números de teste), compartilhado por core, API e app; nunca publicado.
- Capacidades ausentes cobertas: D&D/CoC/Fate sem `costs.xp`; WoD com extrato mapeado e sem preço (`no-rule`).

**Verificações locais (23/10/2026).**

| Comando | Resultado |
|---|---|
| `bun test` em `packages/sheet-core` | 919 pass, 0 fail; cobertura 99,96% linhas |
| `bun test` em `apps/api` (PGLite) | 912 pass, 23 skip (Postgres real sem `PG_TEST_URL`, como antes), 0 fail |
| `npx jest` em `apps/frontend` | 574 pass |
| `npx pnpm typecheck` | 16 tarefas ok |
| `npx biome check` em `packages/sheet-core` | sem erros |
| `node design/scripts/build.mjs` | 6 templates e 13 personagens válidos |
| `node scripts/check-system-names.mjs` | ok |

CI remoto não executado.


### Etapa 0. Registrar o plano e preparar a execução

P · depende de: leitura da base

**Entrega.** Este plano, com jornada, inventário, decisões, dependências e critérios. Na execução, reconferir o checkout e as instruções locais antes de editar; preservar alterações do usuário e trabalhar em branch apropriada.

**Passos.**

1. Ler `AGENTS.md` e `CLAUDE.md`, inclusive instruções em subdiretórios afetados.
2. Comparar a base atual com o inventário do §2 e atualizar divergências reais.
3. Resolver a instalação local do Turbo e ler sua documentação empacotada antes de executar ou mudar comandos/configuração relacionados, conforme `AGENTS.md`.
4. Preparar a lista de verificações por marco, distinguindo execução local e CI remoto.

**Pronto quando.** O agente tem um roteiro executável sem tratar propostas como funcionalidades existentes. Nenhuma publicação ou merge foi inferido a partir do plano.

### Etapa 1. Contrato de contabilização e custos no core

G · depende de: 0 · entrega 5 do §8 da proposta

**Entrega.** Contratos dos §§3.1–3.3, `checkCreation` e `costOf` no `@tms/sheet-core`, com fixtures e testes antes das telas.

**Passos.**

1. Escrever o contrato no README dos templates: entradas, resultados, seletores, regras, limites, prioridades, fechamento, reembolsos e dependências.
2. Definir os tipos de escolhas, configuração efetiva, alvo de custo e problemas estruturados. Fixar as assinaturas públicas das duas funções.
3. Acrescentar as listas fechadas e a validação estrutural/referencial nas fontes do contrato. Atualizar testes de registry, schema e paridade.
4. Implementar o cálculo linear, a rejeição de alocação ambígua e a regra genérica de tabela cumulativa.
5. Resolver defaults, baseline condicional, materialização, permanentes, listas e ordem das dependências com fixtures sintéticas. Registrar pontos que dependam da conferência do livro, sem inventar regras de produção.
6. Implementar custos de novo traço e aumento, condições declarativas e indisponibilidade explícita.
7. Criar fixtures de orçamento válidas e inválidas, com resultados esperados revisáveis, incluindo D&D. Fechar avaliação parcial versus conclusão conforme §3.1 e os resultados de capacidades ausentes conforme §3.2.
8. Executar testes fixos e propriedades do §6.1.

**Pronto quando.** O mesmo conjunto de dados produz o mesmo resultado sem depender da sequência de edição, custo ausente não vira zero e o fixture de D&D prova 27 pontos pelo código genérico. A semântica do contrato está documentada e testada antes de qualquer contador.

### Etapa 2a. Estrutura dos templates e permissões, sem livros

M · depende de: 1 · preparação da entrega 6 e parte da 9 da proposta

**Entrega.** Forma do contrato, permissões de experiência, formato das identidades canônicas e fixtures sintéticas que liberam banco/API/app sem as tabelas WoD.

**Passos.**

1. Consolidar a forma de `creation`, `costs.freebie`, `costs.xp` e do mapeamento dos campos contábeis nas fontes do contrato.
2. Acrescentar `permissions` à seção `experience`: leitura do dono/narrador e escrita do narrador. Essa declaração não autoriza nem mesmo o narrador a gravar projeções por `/events`; os canais contábeis controlados são definidos na Etapa 6.
3. Definir identidade estável de traços/listas e estrutura das referências de origem/condições, usando dados existentes ou sintéticos. Relações reais de clã, tribo e poderes não verificadas ficam para 2b.
4. Criar fixtures sintéticas de criação, custo, concessão e pedidos, com números explicitamente de teste, sem apresentá-los como tabelas de V20/M20/W20.
5. Exercitar capacidades ausentes em D&D/CoC/Fate e um fixture sintético com campos de XP sem `costs.xp`.
6. Preparar novas versões quando necessário, mantendo imutabilidade das publicadas. Não declarar os templates WoD completos antes de 2b.

**Pronto quando.** Schema, motor e fixtures permitem avançar em 3–8 sem livro, com proteção de experiência e identidade canônica definidas. Nenhum dado de teste foi atribuído ao livro.

### Etapa 2b. Conferir os livros e completar as regras WoD

G · depende de: 2a e acesso às fontes · entrega 6 e regras da entrega 9 da proposta

**Entrega.** `creation`, `costs.freebie` e `costs.xp` completos nos três templates, com fontes e páginas registradas em `doc/regras-criacao-xp-v4.md`.

**Passos.**

1. Consultar os livros básicos corretos de V20, M20 e W20 e erratas aplicáveis. Registrar edição/idioma, página impressa, página do PDF quando diferente, tabela, fonte e regra numérica adotada.
2. Conferir prioridades, pontos gratuitos, bônus, limites, primeiro ponto/aumento e exceções. Os números da proposta são exemplos, não comprovação.
3. Conferir Virtudes/Humanidade/FdV; Arete/Esferas/afinidade; Fúria/Gnose/FdV, Dons, Ritos, Posto e Renome; Qualidades/Defeitos; especializações e evolução narrativa. Conferir explicitamente o inicial e a proibição de aumento de Aparência do Nosferatu.
4. Preencher relações reais de custo/elegibilidade com identificadores canônicos. Nome digitado ou `meta.source` livre não concede desconto.
5. Para conteúdo customizado sem dados suficientes, manter indisponibilidade automática ou intervenção explícita e auditada do narrador, sem fingir validação do livro.
6. Completar as fixtures por sistema, confrontar seus resultados com as fontes e validar templates, exemplos e gerados afetados.

**Pronto quando.** Todas as tabelas e relações utilizadas têm fonte e página efetivamente consultadas; os três templates compilam e suas fixtures comprovam a contabilização e os custos. Nenhuma regra de produção depende de memória, fonte não consultada ou outra edição.

**Pendência real do planejamento.** Não foram localizados livros do TMS no workspace durante a análise. As referências de [recuperacoes-v3.md](recuperacoes-v3.md) não comprovam criação ou XP. Se faltar fonte adequada, solicitar somente o material necessário e continuar 3–8 com fixtures. Não declarar 2b ou o fechamento da v4 concluídos sem a consulta.

### Etapa 3. Persistir criação e configurar a crônica

M · depende de: 1, 2a

**Entrega.** Migrations novas após `0015`, escolhas/configuração e revisões, `pending` e tipos atualizados.

**Passos.**

1. Definir nomes finais de colunas e formato JSONB conforme os contratos fechados. Manter dados de sistema no template, sem colunas WoD.
2. Acrescentar `characters.creation`, configuração de aprovação/orçamento da crônica e revisão dos metadados de criação.
3. Atualizar a restrição de estados e `CHARACTER_STATUSES` para `pending`.
4. Acrescentar metadados de submissão e aprovação/conclusão com semântica documentada.
5. Definir defaults: aprovação desligada, modo por pontos no template novo e orçamento efetivo obtido pela precedência do §3.4.
6. Definir protocolo para salvar prioridades/configuração com conflito de revisão, relendo a ficha sob trava.
7. Executar migrations up/down/up, codegen e testes do banco. Atualizar `doc/database.dbml`.

Não reescrever migrations históricas. Dados dos bancos descartáveis podem ser recriados; não incluir migração de fichas entre versões antigas. Novos vínculos de autoria devem respeitar exclusão de conta e anonimização já existentes.

**Pronto quando.** O schema sobe/desce/sobe, os tipos refletem o banco e escolhas/configurações podem ser validadas e versionadas sem aceitar ajustes do narrador enviados pelo jogador.

### Etapa 4. Concluir, aprovar e devolver a criação na API

G · depende de: 3 · entregas 7–8 da proposta, parte servidor

**Entrega.** Configurações restritas ao narrador, escolhas do dono, conclusão contabilizada, aprovação e devolução para correção.

Os caminhos abaixo são a proposta de superfície HTTP; nomes finais podem seguir o padrão atual, com matriz e documentação correspondentes:

| Rota/operação | Papel e finalidade |
|---|---|
| `PATCH /chronicles/:id/creation-settings` | Narrador ajusta padrão de criação e aprovação |
| `PATCH /characters/:id/creation` | Dono membro salva escolhas; campos de orçamento/livre exclusivos do narrador |
| `POST /characters/:id/creation/complete` | Evolução da rota atual; conclusão transacional |
| `POST /characters/:id/creation/approve` | Narrador aprova `pending` |
| `POST /characters/:id/creation/return` | Narrador devolve para `creating`, com motivo |

**Passos.**

1. Implementar leitura da configuração efetiva e salvamento de escolhas com limites e allowlists distintos por papel. Não aceitar mass assignment de orçamento, estado ou autoridade.
2. Na conclusão, travar a ficha, reler vínculo/estado/configuração e conferir revisões e resultado atual de `checkCreation`.
3. Retornar 422 por grupo quando a conta não fecha; aplicar também a avaliação parcial de §3.1 nos eventos e mudanças de escolhas/configuração. Concluir conforme a tabela do §3.4, ativando diretamente quando o narrador conclui e aprova; materializar iniciais derivados que precisem ficar estáveis.
4. Na aprovação, travar e revalidar a ficha atual. Implementar devolução para correção e auditoria das duas decisões.
5. Impedir escrita do dono em `pending`, atalhos pela rota de status e ativação indireta de ficha sem conclusão/aprovação válida.
6. Acrescentar visibilidade de `pending` na Mesa e nos filtros do servidor. Desligar aprovação preserva os pendentes; não ativá-los em lote.
7. Definir comandos com chave idempotente: mesma intenção/chave recupera o resultado; payload diferente dá conflito. Nova tentativa de concluir criação já concluída dá 409.
8. Registrar cada mutação administrativa uma vez, na mesma transação, sem conteúdo privado nos logs.
9. Implementar códigos/frases de §3.6, inclusive escrita e rolagem em `pending`. Executar concorrência e matriz com fixtures enquanto 2b estiver pendente e completar a matriz dos três sistemas reais após 2b.

**Pronto quando.** A API usa o mesmo core do cliente, recusa escrita parcial acima do orçamento e conclusão incompleta, não permite pular etapas e serializa conclusão contra edição, ajuste de orçamento e remoção. Conflito de revisão da configuração não é confundido com pedido de XP `stale`, erro de rede ou permissão. A prova genérica independe dos livros; a validação real dos sistemas exige 2b.

### Etapa 5. Modo create, prioridades e contadores

G · depende de: 4 · entregas 7–8 da proposta, parte app

**Entrega.** Criação utilizável no renderizador existente, com estados e ações acessíveis.

**Passos.**

1. Acrescentar `create` ao modo da ficha, mantendo explícita a diferença entre `SheetMode` (`read/play/evolve`) e `editableIn` (`play/edit`).
2. Atualizar o redirecionamento de `new-character.tsx` para o fluxo de criação apropriado.
3. Integrar escolhas/configuração no store e na persistência; mostrar contadores a partir de `checkCreation`, inclusive no rascunho. Aplicar a avaliação parcial antes de salvar/enfileirar e manter a intenção local para corrigir excessos, conforme §3.1.
4. Exibir prioridades, básicos, bônus e problemas por grupo no `SectionHeader` e nos layouts existentes, sem criar tela por sistema.
5. Separar “Salvar alterações” de “Concluir criação”. Só concluir depois de salvar e confirmar a fila e as revisões atuais.
6. Oferecer ajuste de orçamento/criação livre ao narrador; indicar modo livre e quem pode concluir. Com aprovação ligada, a conclusão do narrador aparece como “Concluir e aprovar” e ativa em uma ação.
7. Exibir “Aguardando aprovação”, devolução para correção e ações de aprovação do narrador. Atualizar os filtros da Mesa para encontrar pendentes.
8. Testar textos acessíveis, fonte grande, teclado, navegação e persistência das escolhas.

**Pronto quando.** O jogador cria por pontos, corrige os problemas e conclui; o narrador configura, aprova e devolve. Contadores não duplicam a lógica do core e a interface não confunde salvamento com submissão.

### Etapa 6. Extrato, concessão e ajuste/estorno de XP

G · depende de: 1, 2a, 3 · entrega 9 da proposta

**Entrega.** Persistência do extrato, concessão atômica/idempotente, correção por ajuste/estorno e bloqueio de projeções em `/events` para todos os papéis.

**Passos.**

1. Criar migrations para extrato e vínculos necessários. Se ampliar `chronicle_operations.kind`, atualizar sua restrição sem reescrever `0015`.
2. Implementar o mapeamento declarativo dos campos de experiência e manter projeções/extrato na mesma transação.
3. Implementar `POST /chronicles/:id/xp`, `POST /characters/:id/xp-adjustments` e leitura paginada do extrato por personagem, com ajustes exclusivos do narrador e leituras conforme o acesso da v3.
4. Aceitar quantidade inteira positiva, motivo limitado e até 20 alvos; recusar duplicados, ficha excluída/inexistente ou de outra crônica. Um alvo inválido recusa tudo. Estado e trava não impedem concessão nem ajuste: qualquer ficha não excluída da crônica recebe crédito, inclusive de dono ex-membro (§2.3, definição 23). Gastar continua exigindo `active`, pela Etapa 7.
5. Tratar o caso individual pelo mesmo contrato de concessão. Travar fichas em ordem de id, aplicar limites e gravar créditos, lotes e auditoria atomicamente.
6. Garantir idempotência por crônica/chave, inclusive envios simultâneos. Reutilização com payload diferente dá conflito; índice único não vira 500.
7. Bloquear `/events` alterando projeções de XP para todos os papéis, inclusive narrador, em `creating/active`, reset/null e lote misto. Atualizar o editor para encaminhar o narrador ao ajuste explícito; não converter edição bruta em correção silenciosa.
8. Implementar ajuste/estorno conforme §3.5: delta não zero, motivo, referência quando estorno, idempotência e total nunca inferior ao gasto. Não apagar o crédito original nem alterar `xpSpent` independentemente de evolução. Demonstrar concessão errada corrigida e estorno recusado por crédito já consumido.
9. Marcar lotes contábeis como não reversíveis pela operação genérica; essa restrição não impede a correção contábil pelo comando próprio. Vale no servidor e histórico, com motivo explícito.
10. Executar reconciliação, atomicidade, permissões, idempotência e concorrência em Postgres real com fixtures; repetir os casos pertinentes nos templates reais após 2b.

**Pronto quando.** Reenviar concessão ou ajuste não duplica crédito, correção ou auditoria. Concessão errada pode ser corrigida por entrada rastreável, respeitando saldo não negativo. Falha de alvo, limite ou autorização não altera saldo. Todos os papéis são impedidos de manipular projeções em `/events`; o narrador conserva o canal administrativo de ajuste. Dano, cura e recuperações continuam reversíveis como na v3.

### Etapa 7. Pedido de evolução e decisão transacional

G · depende de: 6 · entrega 9 da proposta

**Entrega.** Pedidos com custo do core, unicidade por traço, aprovação, recusa, cancelamento e `stale`.

**Passos.**

1. Criar `xp_requests` com estados `pending/approved/rejected/cancelled/stale`, alvo canônico, `from/to` com um único nível, custo apresentado, contexto relevante, autor/decisor, motivo da recusa, timestamps e `batch_id` aprovado.
2. Criar índice único parcial de pendente por ficha/traço. Para novo item de lista, usar identidade mecânica estável, não apenas UUID temporário ou nome digitado.
3. Implementar `POST /characters/:id/xp-requests`, leitura e ações explícitas de aprovar, recusar e cancelar. Calcular custo e conferir saldo sob trava da ficha no envio, conforme §3.5. Sem saldo, retornar 409 sem inserir pedido; preço informado pelo cliente não é autoridade.
4. Implementar a matriz por estado/papel e a suspensão definida em §3.5: arquivamento/remoção não altera o pendente; aprovação indisponível dá 409 sem efeito; narrador pode recusar e dono membro pode cancelar sem editar a ficha. Ex-membro só lê. `GET` não decide pedido nem marca `stale`.
5. Implementar a transação de aprovação abaixo, com atualizações sobre a ficha atual. Para listas, preservar outros itens alterados legitimamente em vez de reaplicar um campo inteiro desatualizado.
6. Recusar/cancelar sob trava do pedido, exigindo `pending`; nenhuma dessas ações debita saldo.
7. Proteger identidade de poderes, origem e dependências de custo contra troca disfarçada de `edit`. Não bloquear notas livres que não mudam a mecânica. Rever especialização conforme a regra conferida.
8. Vincular extrato, lote aprovado, pedido e auditoria. Tornar as mutações recuperáveis por chave sem duplicar efeito.
9. Executar concorrência, inclusive pedidos distintos disputando saldo, concessão e ajuste/estorno. Usar fixtures sintéticas enquanto 2b estiver pendente e completar a matriz real depois.

**Transação de aprovação.**

1. Resolver autorização da crônica/ficha.
2. Travar o pedido com `FOR UPDATE`; depois a ficha, sempre nessa ordem.
3. Exigir pedido `pending`; outra decisão já aplicada dá 409.
4. Reler estado/vínculo; se indisponível, responder 409 `XP_TARGET_UNAVAILABLE` e manter `pending`, sem débito. Se disponível, comparar o alvo atual com `from`.
5. Conferir contexto relevante, pré-requisitos e custo recalculado por `costOf`. Alteração no alvo, no preço apresentado ou na elegibilidade torna o pedido `stale`; alteração irrelevante não o invalida.
6. Conferir saldo. Se insuficiente, responder 409 com saldo/custo autorizados; não debitar e manter `pending`.
7. Construir e aplicar o lote que muda o traço e o XP gasto juntos.
8. Persistir ficha/versão, lote/eventos, débito do extrato, pedido `approved` com `batch_id` e auditoria, na mesma transação.

**Atenção ao stale.** Lançar um erro dentro da transação pode desfazer a marcação e sua auditoria. Persistir o resultado transacional e só depois produzir o 409 correspondente. O teste deve consultar o banco e comprovar `stale` persistido sem débito.

**Ordem de travas.** Preservar vínculo antes de fichas nos fluxos existentes e fichas em ordem de id nas operações em grupo. Quem decide pedido trava pedido antes de ficha; nenhum caminho pode adquirir ficha e depois esperar pelo pedido. Remover/arquivar não deve introduzir cancelamento de pedidos sob uma ordem invertida. Documentar e testar qualquer ampliação do protocolo.

**Pronto quando.** Duas decisões distintas sobre o mesmo pedido aplicam uma vez e a perdedora recebe 409. Dois pedidos de traços diferentes não conseguem gastar o mesmo saldo. Reenvio da mesma decisão com a mesma chave recupera seu resultado, em vez de reaplicar. Ajuste manual do narrador torna o pedido desatualizado sem debitá-lo.

### Etapa 8. Interface de experiência e rede

G · depende de: 5, 7

**Entrega.** Saldo, extrato, solicitação e decisões utilizáveis na ficha/Mesa, com recuperação de respostas perdidas.

**Passos.**

1. Mostrar saldo e extrato por ficha, com paginação e vínculo legível entre gasto e evolução.
2. Oferecer “Solicitar evolução” ao jogador ativo, com alvo, valor atual, destino e custo antes de enviar. O traço não muda antes da aprovação.
3. Mostrar pedido pendente e cancelamento permitido; impedir duplicação por toque/reenvio.
4. Oferecer concessão individual e pela seleção da Mesa, com motivo e resultado por ficha dentro da operação atômica; oferecer ajuste/estorno por ficha ao narrador, mostrando referência e limite aplicável.
5. Oferecer aprovação/recusa ao narrador. Exibir códigos/frases do §3.6 e distinguir pedido suspenso, `stale`, saldo insuficiente no envio/aprovação e decisão já tomada.
6. Atualizar ficha, Mesa, saldo, pedidos e extrato após concessão ou decisão e ao refocar/reconectar. Não exigir tempo real.
7. Implementar o contrato offline abaixo e seus testes de reinício, logout e reenvio. Sem `costs.xp`, não oferecer pedido nem inventar saldo: provar o fallback de D&D/CoC/Fate e de campos contábeis sem custos, conforme §3.2.

**Contrato de rede.**

- Preservar leitura em cache e edição local permitida pela fila FIFO atual. Escolhas necessárias aos contadores sobrevivem ao reinício e são revalidadas ao reidratar.
- Se prioridades forem persistidas fora da fila de eventos, garantir ordem de envio e revisão; a conclusão não confirma escolhas ainda locais.
- Concluir exige rede, rascunho salvo, fila confirmada e configuração atual.
- Concessão, ajuste/estorno de XP, submissão/decisão de pedido, ajuste de orçamento e aprovação exigem rede nesta versão. A interface pode preparar a intenção offline, identificando-a como não enviada.
- Não aplicar evolução nem débito otimista antes da aprovação do servidor.
- Após timeout ou resposta perdida, manter a mesma chave e intenção, consultar/reconciliar e reenviar sem duplicar efeitos. Não gerar nova chave automaticamente para uma operação de resultado desconhecido.
- Comandos persistidos para recuperação, se necessários, ficam separados da fila de eventos, por usuário, e são apagados no logout. Nunca armazenar credenciais.
- Lotes antigos continuam sujeitos ao estado atual: conclusão, `pending`, trava ou remoção podem recusá-los. Manter rollback, aviso e rebusca da v3.
- Preservar SecureStore/SQLCipher e isolamento de cache por usuário.

**Pronto quando.** Os dois papéis completam o fluxo, entendem recusas e recuperam resposta perdida sem duplicação. Reiniciar offline não perde escolhas confirmáveis nem transforma uma intenção local em operação aprovada.

### Etapa 9. Jornada e fechamento da v4

M · depende de: todas, inclusive 2b

**Entrega.** Jornada do §1, regressões, fluxo nativo e documentação com evidências.

**Passos.**

1. Criar `e2e/tests/journey-creation.spec.ts` e cenários complementares de aprovação desligada, pendentes preservados após desligá-la, conclusão direta pelo narrador, devolução, criação livre, orçamento ajustado, recusa, cancelamento e correção de concessão. A jornada real exige regras verificadas em 2b; progresso anterior com fixtures não a substitui.
2. Rodar Chromium e WebKit sobre o export web com CSP de produção e API/Postgres reais, conforme a infraestrutura atual. Portas 3101/8181 são fixas: não executar duas suítes simultaneamente.
3. Manter as jornadas de Vampiro, Mago, Lobisomem e narrador. Ajustar seeds/pré-condições explicitamente quando necessário, sem retirar asserções de privacidade, política, dano, recuperação e reversão. Uma jornada que não testa orçamento pode usar criação livre autorizada pelo narrador; a jornada nova precisa provar a criação por pontos de fato.
4. Acrescentar fluxo Maestro de criação/aprovação/XP e executar os sete fluxos anteriores em Android, em dev build com SQLCipher.
5. Verificar teclado, navegação, contadores, modais/toasts, reconexão e separação de sessões. Não versionar credenciais.
6. Avaliar a infraestrutura iOS e registrar seu resultado separadamente. Se disponível, executar os fluxos aplicáveis; sem Mac/Xcode/simulador/aparelho, registrar não executado e o motivo.
7. Atualizar documentação do §8 e registrar resultados em `doc/validacao-v4.md`.

**Pronto quando.** Os critérios do §9 estão atendidos, com evidências reais. O resultado do CI remoto fica distinguido dos checks locais; pendência de infraestrutura não aparece como teste aprovado.

## 6. Estratégia de testes

Manter ferramentas e metas de cobertura existentes: Bun no core/API/banco, PGLite para integração rápida, Jest/Testing Library no frontend/UI, Postgres real para concorrência, Playwright no web e Maestro no nativo. Testes novos precisam provar comportamento e invariantes, sem apenas repetir a implementação.

### 6.1 Core e contratos

Casos fixos para os três sistemas e fixtures sintéticas independentes dos livros:

- Prioridades ausentes, repetidas e inválidas; orçamento exato, faltante e excedente.
- Habilidade em 4 financiada por básicos até o teto e por bônus acima dele; sem saldo, conclusão recusada. Distinguir um ponto do traço de seu preço em pontos de bônus.
- Defaults ausentes/materializados, alterações das fontes, iniciais derivados e congelamento necessário ao concluir.
- Baseline condicional e proibição de compra sintéticos antes do livro; caso Nosferatu conferido em 2b.
- Arete/Esferas, base versus Forma, permanentes versus temporários.
- Inclusão/remoção de item, limites de quantidade e valor, identidade canônica e metadados adulterados.
- Qualidades/Defeitos, créditos limitados e remoção do crédito após gasto.
- Novo traço, aumento, custo condicional, pré-requisito e compra indisponível.
- Point-buy de D&D conforme §3.3.
- Entrada malformada, nome/regra desconhecida, ciclos e ambiguidade de seletores.
- Paridade de registry/schema/referência JS/TS e rejeição de propriedades desconhecidas.
- Avaliação parcial aceita falta de básicos e excesso financiável por bônus; recusa bônus acima do saldo, prioridade necessária ausente e teto obrigatório, inclusive em lote de redistribuição.
- D&D/CoC/Fate sem `costs.xp`: `costOf` indisponível, sem falha ou custo zero, sem saldo/seção inventados e sem ação de pedido. Fixture com campos de XP mas sem custos preserva esses campos sem compra automática.

Cada módulo genérico novo também deve passar em um fixture de outra família. Para concessão, ajuste e pedidos, estender uma cópia sintética de D&D nos testes com campos/custos fictícios, sem alterar as regras reais ou publicar o fixture. Além desse caso positivo, testar a ausência de capacidade nos três fixtures atuais.

Propriedades com `fast-check`, geradas dentro de domínios válidos:

- Custo válido nunca negativo.
- Subir e descer o mesmo ponto, quando ambos válidos, devolve o saldo.
- Ordem de distribuição e ordem dos itens não mudam a conta.
- Ausência e materialização equivalente de default não mudam a conta.
- Mesma entrada retorna a mesma contabilização usada por cliente e servidor.
- Modificador temporário não gera investimento ou desconto permanente.
- Reembolsos e créditos não permitem saldo ilimitado.

### 6.2 API, permissões e atomicidade

Toda rota nova entra em `apps/api/src/test/authz-matrix.ts`, nos três sistemas. Atores: dono, outro jogador, narrador, narrador de outra crônica, ex-membro, estranho e anônimo.

Testar políticas por estado, inclusive `pending` e trava; códigos/frases de §3.6; configuração exclusiva do narrador; conclusão direta pelo narrador, aprovação e devolução; pendentes preservados ao desligar a opção; atalhos por status; XP protegido em `creating/active` para todos os papéis; reset/null e lote misto; concessão inválida sem alteração parcial; ajuste/estorno rastreável e estorno acima do permitido; idempotência e payload divergente; pedidos recusados por saldo no envio e aceitos mas sem saldo na aprovação; suspensão por estado/vínculo sem mutação em GET; reconciliação do extrato/lote; auditoria única; restrição de reversão genérica contábil.

Privacidade é comprovada no corpo e nas contagens, não só na interface. Listas de pedidos/extrato não podem revelar fichas de outro jogador nem notas privadas. Motivos de devolução e de recusa chegam ao dono e ao narrador e a ninguém mais. Ex-membro mantém apenas as leituras autorizadas pela v3.

### 6.3 Concorrência em Postgres real

Acrescentar testes ao job `postgres` de `.github/workflows/ci.yml`, usando pool com conexões independentes e bancos descartáveis terminados em `_test`, no padrão dos arquivos existentes. PGLite não prova essas travas.

| Cenário | Resultado obrigatório |
|---|---|
| Concluir contra evento de evolução | Evento entra antes da conclusão ou é recusado depois; conclusão valida a ficha efetiva |
| Concluir contra prioridades/orçamento | Uma revisão consistente vence; escolha antiga não é confirmada silenciosamente |
| Submeter/aprovar contra edição, remoção ou arquivamento | Sem escrita autorizada por estado/vínculo antigo e sem ativação indevida |
| Concessão duplicada simultânea | Um crédito por alvo; resultado recuperável; sem auditoria duplicada |
| Grupos sobrepostos em ordens diferentes | Tudo ou nada por operação; sem deadlock |
| Dois pedidos pendentes para o mesmo traço | Um pendente; o outro conflita, sem 500 |
| Duas aprovações do mesmo pedido com intenções distintas | Uma aplica, a outra recebe 409 |
| Aprovar contra recusar/cancelar | Uma decisão terminal; nenhum débito depois da outra decisão |
| Dois traços disputando o mesmo saldo | Nunca gastar mais que o disponível |
| Aprovar contra edição do alvo/contexto | Evolução válida anterior ou pedido `stale`, sem débito indevido |
| Aprovar contra concessão/remoção | Saldo e vínculo lidos sob protocolo consistente; sem aplicação parcial ou deadlock |
| Ajuste/estorno contra aprovação ou outro estorno | Reconciliação e saldo não negativo; sem estornar o mesmo crédito além do permitido |
| Desligar aprovação contra submissão | Submissão usa uma revisão consistente; nenhum pendente anterior é ativado implicitamente |

Teste ignorado por ausência de `PG_TEST_URL` não conta como validação. Nos cenários que persistem `stale`, consultar o banco depois do 409 para provar commit do estado e ausência de débito.

### 6.4 App, web e nativo

No frontend, testar contadores vindos do core, validação parcial antes de enfileirar, salvar versus concluir, conclusão/aprovação conjunta do narrador, pending/devolução, códigos/frases por operação, projeções fechadas inclusive ao narrador com ajuste próprio, estado suspenso dos pedidos, invalidação de consultas, ausência de custos, offline/reinício e reenvio de resultado desconhecido.

Playwright exercita a jornada completa e regressões em Chromium/WebKit. Android executa os sete fluxos existentes e o novo, com dev build e dados descartáveis. iOS é informado separadamente; ausência de infraestrutura não é aprovação.

### 6.5 Checks de fechamento

Executar os scripts apropriados e verificações equivalentes ao CI existente:

- Build, typecheck e Biome.
- `scripts/check-system-names.mjs` e metas de cobertura dos pacotes.
- Auditoria de dependências.
- Templates, exemplos, gerados de design e contraste.
- Migrations up/down/up e tipos Kysely em dia.
- Publicação dos templates somente em banco descartável de validação.
- Suítes novas e anteriores de Postgres real.
- Export web, bundle/CSP e Playwright.
- Android e relatório próprio de iOS.

Usar os comandos atuais dos `package.json` e workflow, após ler as instruções locais. Não alterar metas, desativar hooks ou remover testes para declarar o marco verde. CI remoto só pode ser registrado como executado quando houver execução e evidência; rodadas locais devem ser identificadas como locais.

## 7. Riscos e preservação das garantias da v3

| Risco | Mitigação |
|---|---|
| Contabilizar pela ordem dos cliques ou pelo valor efetivo de jogo | Funções puras, baseline explícito e propriedades de ordem/materialização |
| Regras erradas ou de outra edição | Fontes e páginas por tabela; fixtures conferidas; etapa de templates bloqueada para a regra sem fonte |
| Desconto adulterado por nome/origem livre | Identidade canônica, relações no template e validação no servidor |
| Evolução sem aprovação por troca textual de poder ou afinidade | Classificação das partes mecânicas/dependências e testes de bypass |
| Conclusão sobre escolhas ainda locais | Revisão de metadados, fila confirmada, validação sob trava |
| Ativação por status/reativação | Verificar conclusão e aprovação também nos caminhos indiretos |
| Duplo crédito ou gasto concorrente | Chaves/índices únicos, travas, transação e testes em Postgres real |
| `stale` revertido junto do erro | Commit da decisão antes da resposta 409; consulta ao banco no teste |
| Deadlock com remoção, concessão ou decisão | Protocolo explícito de travas; nenhuma aquisição ficha → pedido |
| Extrato contradito por editor ou Desfazer, ou concessão sem correção possível | Projeções fechadas para todos, ajuste/estorno próprio e lote financeiro não reversível genericamente |
| Regressão em política, privacidade e fila offline | Matriz nos três sistemas, testes de corpos/contagens e jornadas anteriores preservadas |
| Contador ou recurso exigir tela de sistema | Renderizador existente, regras declarativas e fixture D&D |
| Confundir registro histórico ou skip com validação atual | Evidências por comando, ambiente e plataforma; pendência explícita |

O narrador continua administrando fichas e podendo ajustar traços nos estados permitidos pela v3. “Narrador: tudo” preserva a autoridade, mas projeções de XP passam por canais contábeis controlados: `/events` fica fechado para todos, e concessão/ajuste/aprovação preservam o extrato. Essa definição nova consta do §2.3 e do painel. Ajustar traço administrativamente não debita XP silenciosamente e pode tornar pedido desatualizado. As permissões por seção, política no recebimento, leitura restrita, `from_absent` e reversão de dano/cura/recuperação permanecem protegidas.

## 8. Documentação e relatório da execução

Atualizar durante a implementação:

- Este plano, distinguindo feito, validado e pendente.
- `doc/regras-criacao-xp-v4.md`, com fontes e páginas realmente consultadas.
- `doc/painel-narrador.md`, mantendo sincronizadas as definições de planejamento do §10.1 e marcando entregas 5–9 como feitas somente após implementação e validação.
- `doc/arquitetura-motor-de-ficha.md`, README/schema dos templates e referência executável.
- `doc/database.dbml`, `CLAUDE.md`, checklist de segurança e instruções dos testes.
- README do Maestro com parâmetros e jornada nova.
- `doc/validacao-v4.md`, com evidências e limites da rodada.

O relatório final deve apresentar alterações por camada, contratos/decisões adotados, migrations e dados de teste, fontes das regras, comandos efetivamente executados, ambiente/resultados, evidências de concorrência, web/Android/iOS separadamente, CI remoto versus checks locais e pendências com impacto. Não incluir credenciais ou conteúdo privado da ficha.

Se faltar fonte ou validação essencial, informar a falta e não declarar conclusão integral. Prosseguir no trabalho independente autorizado, sem encerrar por escolhas rotineiras ou fabricar evidências.

## 9. Critérios objetivos de conclusão

- [ ] Contrato final documentado e testado antes das telas.
- [ ] `checkCreation` e `costOf` genéricos, compartilhados entre API e app.
- [ ] V20, M20 e W20 com criação/bônus/XP e fontes/páginas conferidas.
- [ ] D&D prova point-buy de 27 pelo contrato genérico e continua fixture.
- [ ] Módulos novos passam em fixture de outra família; D&D/CoC/Fate sem custos não oferecem compra e `costOf` retorna indisponível.
- [ ] Prioridades, contadores, iniciais, tetos, reembolsos e dependências cobertos.
- [ ] Rascunho e conclusão distintos; salvamento parcial não excede bônus/limites e conta incompleta retorna 422 por grupo ao concluir.
- [ ] Orçamento por crônica/ficha e criação livre exclusivos do narrador.
- [ ] Aprovação desligada por padrão; pendentes preservados ao desligá-la; narrador conclui/aprova em uma ação; devolução limitada a pending, sem atalhos.
- [ ] Concessão individual/em grupo atômica e idempotente, aceita em qualquer ficha não excluída; gasto só em active.
- [ ] Saldo, extrato, lotes e pedidos reconciliados.
- [ ] Concessão errada corrigível por ajuste/estorno auditado, sem saldo negativo ou edição bruta para qualquer papel.
- [ ] Um pending por traço, com aprovar/recusar/cancelar/stale implementados.
- [ ] Saldo insuficiente no envio não cria pedido; insuficiência posterior mantém pendente sem débito; aprovações simultâneas aplicam uma vez.
- [ ] Pedidos de fichas arquivadas/removidas ficam suspensos sem transição em leitura; aprovação indisponível retorna 409 sem efeito.
- [ ] Um nível por pedido; ficha travada recusa pedido novo do dono, e o narrador ainda decide os pendentes.
- [ ] Edições do narrador em creating/pending respeitam a conta; aprovar revalida; ajuste de orçamento vale também em pending.
- [ ] Motivos de devolução e recusa legíveis só pelo dono e pelo narrador.
- [ ] Nenhum papel edita projeções de XP por `/events`; jogador continua sem edição direta, inclusive em creating.
- [ ] Mutação administrativa auditada uma vez; reenvio não duplica efeitos.
- [ ] Rede indisponível, reinício e resposta perdida cobertos.
- [ ] Concorrência executada em Postgres real; skips não contam como aprovação.
- [ ] Garantias, matriz e jornadas da v3 preservadas.
- [ ] Checks de build, tipos, cobertura, auditoria, contrato e design aprovados.
- [ ] Jornada nova e regressões aprovadas em Chromium e WebKit.
- [ ] Android validado nos sete fluxos anteriores e no fluxo novo.
- [ ] iOS registrado separadamente como aprovado, falhou ou não executado, com motivo; pendência admitida por infraestrutura deve aparecer expressamente no fechamento.
- [ ] Documentação, evidências e pendências reais registradas.
- [ ] Nenhuma publicação, envio remoto ou merge realizado por inferência.

Uma pendência de iOS por infraestrutura pode ser registrada separadamente, como ocorreu na v3, sem atribuir aprovação nativa à versão. Falta de fonte de regra, contabilização correta, testes essenciais de concorrência, validação web ou Android impede declarar a v4 tecnicamente concluída.

## 10. Fora da v4

NPCs e o papel `viewer`; visibilidade de NPCs; rolagens ocultas e parada livre; transferência de narração; sessões e diário; configurações gerais da crônica fora da criação; auditoria consolidada; tempo real; migração de fichas entre versões de templates; criação completa de D&D; compatibilidade com templates antigos; deploy, publicação em ambiente real e merge sem autorização explícita.

## 11. Prompt para iniciar a implementação

```text
Você é o agente responsável pela implementação da v4 do TMS em
/home/assisneto/tms.

Leia AGENTS.md e CLAUDE.md e execute doc/plano-v4.md como roteiro de
implementação. Leia também os documentos e arquivos de código indicados
nesse plano. Reconfira a base antes de editar; a referência do plano é
main em 8a978b1, merge do PR #31.

Implemente criação por pontos e evolução por XP na ordem das etapas.
Comece fechando e testando o contrato de contabilização/custos no core,
antes de templates e telas. Separe 2a (estrutura, sem livros) de 2b
(valores e relações verificados): avance em banco/API/app com fixtures
sem esperar 2b, mas não declare os sistemas ou a jornada real completos
sem fontes e páginas. Preserve o motor genérico e as garantias da v3.

Mantenha as decisões já tomadas: aprovação de ficha opcional por crônica,
desligada por padrão; narrador concede XP e aprova cada gasto; jogador
consulta saldo e solicita evolução; orçamento ajustável e criação livre
autorizados pelo narrador. Templates antigos podem ser ignorados.

Aplique as novas definições de planejamento do §2.3 e do §10.1 do painel,
sem atribuí-las às decisões originais: devolução restrita de pending,
conclusão/aprovação conjunta do narrador, saldo conferido no envio e na
aprovação, ajuste/estorno contábil, limites no salvamento parcial e
pedidos suspensos sem mutação em GET. Cubra códigos/frases e sistemas
sem costs.xp, que não devem ganhar pedido ou saldo inventado.

Conclua cada marco com evidências verificáveis. Execute os testes
significativos de contabilização, AuthZ e concorrência em Postgres real,
a jornada web em Chromium/WebKit e os fluxos Android. Informe a execução
nativa de iOS separadamente conforme a infraestrutura disponível.

Resolva escolhas rotineiras autonomamente. Pergunte apenas por decisão
essencial sem resposta no repositório/plano ou por material de regra
indispensável que não conseguiu consultar. Continue o trabalho independente
autorizado enquanto houver uma pendência específica.

Não declare teste, consulta a livro ou validação que não executou. Não
trate skip, WebKit ou evidência da v3 como aprovação nativa da v4.
Não publique, envie alterações remotas, faça deploy ou merge por inferência.
Publicação de templates para testar é limitada a banco descartável.

Atualize o plano com o estado real, registre doc/validacao-v4.md e entregue
relatório final com alterações, decisões, comandos/resultados, fontes,
evidências de concorrência, web/Android/iOS, estado do CI e pendências reais.
```
