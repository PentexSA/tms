# Plano de implementação da v5: Bastidores

> Plano · 2026-10-23 · base conferida: `main` em `0f090dc`, merge do PR #32 (criação por pontos e experiência).

Este plano entrega os bastidores da crônica: **NPCs com visibilidade controlada, rolagens ocultas e parada livre**, seguidos das ferramentas de manutenção da campanha. O risco principal é privacidade: nenhuma ficha oculta, rolagem secreta ou nota privada pode chegar ao cliente do jogador por uma resposta secundária, contagem, erro ou recuperação de operação.

**Estado deste documento:** etapas 0–11 implementadas, incluindo o P2, na árvore de trabalho sobre `0f090dc`, sem commit nem CI remoto. Evidências, correções do fechamento e pendências em [validacao-v5.md](validacao-v5.md); os critérios do §9 estão marcados apenas onde há evidência local. O roteiro cobre as entregas 10–12 do [painel do narrador, §8](painel-narrador.md#v5-bastidores-privacidade). A entrega 12 permanece P2 e tem fechamento separado: se for adiada, registrar o corte como backlog, sem declarar a v5 integralmente entregue.

| Documento | Papel |
|---|---|
| [painel-narrador.md](painel-narrador.md), §§4, 5.2, 5.7–5.11, 7, 8 e 10 | Escopo, princípios e decisões já tomadas |
| [plano-v3.md](plano-v3.md) e [validacao-v3.md](validacao-v3.md) | Política de escrita, membros, operações e evidências anteriores |
| [plano-v4.md](plano-v4.md) | Criação, aprovação e integridade de XP a preservar |
| [arquitetura-motor-de-ficha.md](arquitetura-motor-de-ficha.md) | Motor genérico, permissões, modos e sincronização |
| [README dos templates](../design/templates/README.md) | Contrato, validação e versões publicadas |
| [plano-v0.md](plano-v0.md), §4 | Ferramentas e metas de testes |
| Este documento | Contratos, ordem, dependências e critérios de conclusão da v5 |

Cada etapa produz uma alteração revisável, com testes do comportamento e documentação. Mudanças de contrato atualizam schema JSON, referência JavaScript, tipos, registry, validadores, testes de paridade e README juntos. As etapas descrevem trabalho futuro; não autorizam publicação remota, deploy ou merge.

## 1. Onde queremos chegar

A jornada principal será `e2e/tests/journey-backstage.spec.ts`, com contextos separados de narrador, dois jogadores e ex-membro:

1. O narrador abre uma crônica e cria um NPC, que nasce oculto e com criação livre. O jogador continua vendo só seus personagens.
2. O narrador edita o NPC e conclui sua criação. O NPC aparece na seção própria da Mesa e pode participar de dano, cura e recuperação em grupo.
3. O narrador faz uma rolagem oculta pelo NPC e outra pela ficha de um jogador; ambas aparecem no feed exclusivo do narrador. O dono da ficha não recebe a rolagem oculta.
4. O narrador usa uma parada livre, sem ficha, oculta por padrão. Reenviar a mesma intenção recupera o resultado, sem rolar novamente.
5. O narrador revela apenas a identidade do NPC. O jogador recebe nome, chip, subtítulo e retrato disponível; não recebe `dock`, valores brutos, histórico ou rolagens.
6. O narrador revela a ficha completa. O jogador abre em Leitura, com papel `viewer`, sem Notas do Narrador, criação, XP administrativo ou ações de escrita.
7. O narrador volta o NPC para oculto. Após revalidar, o jogador perde o acesso e a contagem diminui. O app remove a projeção anterior do cache; os testes verificam os corpos das respostas.
8. Outro jogador nunca acessa as fichas dos demais. O ex-membro continua lendo apenas as próprias fichas arquivadas e não vê nenhum NPC revelado.

Os passos de ocultação precisam testar o NPC **antes da primeira revelação**, com dados sentinela próprios; uma interface vazia não prova que a API reteve os dados.

**Jornada complementar P2:** registrar uma sessão com resumo público e nota privada; conceder XP e aplicar uma operação vinculadas à sessão; editar nome/descrição; consultar auditoria paginada; solicitar e aceitar a transferência. O antigo narrador vira membro, perde os acessos administrativos e o novo assume NPCs e bastidores. Excluir a conta do antigo narrador não apaga os NPCs transferidos.

## 2. Ponto de partida

O inventário abaixo foi conferido no checkout indicado no cabeçalho. Reconferir antes de implementar.

| Camada | O que existe | O que falta para a v5 |
|---|---|---|
| AuthZ | `apps/api/src/authz.ts`: papéis de crônica `storyteller/member/former`; ficha com `owner/storyteller` | Distinguir PC/NPC, visibilidade e `viewer`, sem conceder acesso de dono ao antigo narrador |
| Permissões | `packages/sheet-core/src/permissions.ts`: leitura/escrita padrão de dono e narrador; `stripRestricted` filtra valores e especializações | Leitura padrão também para `viewer`, escrita sempre negada a ele; dependências de derivados sem vazamento |
| Identidade | `identityOf` resolve nome, chip, resumo, voz, subtítulo e cor; listas ainda devolvem `values` com dependências do `dock` | DTO explícito de identidade; o contrato atual de identidade não oferece retrato |
| Fichas | `sheets/routes.ts`: criação por identidade, limites, listas, ficha e exclusão; Mesa com estados | Criação idempotente de NPC, criação livre, visibilidade, projeções e seção própria |
| Rolagens | `rolls/routes.ts`: servidor monta e rola `pool-success`, guarda resultado e custo transacional; leitura por ficha | Feed, `hidden`, rolagem sem ficha e idempotência por crônica |
| Core de dados | Registry declara cinco modelos de rolagem; o caminho executável atual usa `planPool`/`rollPool` | Capacidade de parada livre explícita; modelo declarado não equivale a executor implementado |
| Criação/XP | Migrations `0016`–`0018`, comandos de criação, extrato e pedidos, telas e `xp.pg.test.ts` | Revisar todas essas rotas para não ampliar acesso ao introduzir `viewer` |
| Operações/auditoria | `chronicle_operations`, lotes, reversão e `chronicle_audit` gravado pelo servidor | Vínculo opcional de sessão e leitura consolidada paginada |
| Crônicas | Criar/excluir, membros/convites e configurações de criação | Metadados gerais, opções declaradas, sessões e transferência com aceite |
| Persistência local | Consultas, store da ficha e fila offline; rolagem local em `useDice.ts` | Tratamento de projeção parcial e redução de acesso; novos comandos administrativos com rede |
| Exclusão de conta | `characters.user_id` usa `ON DELETE CASCADE`; crônica narrada bloqueia exclusão sem resolução explícita | Transferir também a posse dos NPCs para evitar perda por cascata |
| Validação | Playwright, sete fluxos em `apps/frontend/.maestro`, Postgres no CI | Jornada de bastidores, testes de vazamento e concorrência da v5 |

**Pendências da base.** O merge da v4 está no histórico, mas `plano-v4.md` ainda registra execução parcial, não há `doc/validacao-v4.md` nem `e2e/tests/journey-creation.spec.ts` neste checkout. Isso não prova falha do código; impede assumir que todos os critérios da v4 foram validados. A Etapa 0 identifica o que falta e registra a dependência. Contratos e testes isolados da v5 podem avançar; o fechamento precisa demonstrar preservação dos fluxos de criação/XP e informar pendências herdadas.

### 2.1 Decisões mantidas

- Motor e painel agnósticos: nenhuma regra ou nome de sistema fora de core/templates.
- Jogador lê somente suas fichas; NPC revelado é a única exceção, com leitura própria de `viewer`.
- NPC nasce `hidden`; ao revelar, a escolha inicial da interface é `identity`. `full` exige escolha explícita.
- `viewer` não recebe histórico nem rolagens, mesmo em `full`, e nunca escreve.
- Feed e parada livre pertencem ao narrador. O jogador mantém apenas a leitura autorizada das rolagens de suas fichas, excluindo as ocultas.
- Toda escrita de ficha preserva a política única, validação do motor, estado atual e atomicidade das v3/v4.
- Sem tempo real: revalidar ao focar e reconectar; dado privado é filtrado no servidor.
- Transferência exige aceite do destinatário, que deve ser membro da crônica.

### 2.2 Definições novas deste planejamento

Estas escolhas tornam a proposta executável; não são alegações de decisões anteriores ou funcionalidades existentes.

| Assunto | Definição |
|---|---|
| PC versus NPC | `kind` é definido ao criar; sem conversão nesta versão. Fichas existentes recebem `pc`; somente narrador cria NPC |
| Posse do NPC | `user_id` acompanha o narrador atual; autorização de NPC exige narrador atual ou membro com `viewer`, nunca posse isolada |
| Ciclo do NPC | Nasce `creating` com configuração de criação livre, e usa “Concluir e aprovar” da v4; aprovação opcional da crônica não cria pendência para o NPC concluído pelo narrador |
| Visibilidade e estado | São independentes. Arquivar/marcar `dead` não revela nem oculta automaticamente; exclusão remove o NPC de todas as projeções |
| Redução de visibilidade | Impede novas leituras e limpa o cache quando o app detecta a mudança; não promete apagar dados já vistos, capturados ou acessados antes de uma revogação offline |
| Rolagem oculta | Só narrador cria; visibilidade fica fixada na criação, sem endpoint para revelar rolagem nesta versão |
| Custo de rolagem oculta | Passa pela política e é cobrado normalmente; detalhes da rolagem e seu lote vinculado não aparecem no histórico do dono. O valor atual do recurso pode mostrar o gasto: ocultar a rolagem não oculta o estado da ficha |
| Comandos novos | Exigem rede; resposta perdida mantém chave e intenção para reenvio. Não entram na fila genérica de eventos nem viram rolagem local automaticamente |
| Sessões | Sem conceito de “sessão ativa” implícita; vínculo opcional e explícito no comando, da mesma crônica, preservado no histórico |
| Após transferência | Antigo narrador vira membro, novo narrador sai de `chronicle_members`; PCs mantêm seus donos; NPCs passam ao novo narrador, preservando estado/visibilidade |
| Alcance do aceite | Novo narrador assume notas privadas e bastidores da crônica; explicar isso na confirmação dos dois lados |

## 3. Contratos que precisam fechar antes das telas

### 3.1 NPCs, projeções e permissões

Adicionar `kind: pc | npc` e `visibility: hidden | identity | full` a `characters`. Aplicar checks de domínio e tratar visibilidade como capacidade exclusiva de NPC. Não usar visibilidade para liberar uma ficha PC alheia.

| Recurso para membro diante de NPC | `hidden` | `identity` | `full` |
|---|---|---|---|
| Lista de personagens | Ausente | DTO `identity` | DTO `identity` |
| `GET /characters/:id` | 404 | DTO `identity` | DTO `full`, filtrado para `viewer` |
| Histórico, rolagens, extrato, pedidos e metadados de criação | 404 | 404 | 404 |
| Escrita, exclusão, custo de rolagem e ações administrativas | 404 | 404 | 404 |
| Contagem visível | Não conta | Conta uma vez | Conta uma vez |
| Mesa/feed/auditoria administrativos | 404 | 404 | 404 |

Narrador recebe todas as fichas não excluídas conforme os filtros de estado. Ex-membro nunca ganha `viewer`; não recebe NPCs, inclusive se tiver sido seu dono antes da transferência. Anônimo continua 401; para quem não tem acesso ao recurso, 404 sem dados que confirmem sua existência.

**Projeção `identity`.** Usar união discriminada por `projection`, com envelope mínimo (`id`, `kind`, indicação de visibilidade, identidade resolvida). A identidade pública contém nome, chip, subtítulo e retrato opcional. Não incluir `summary`, `voice`, `accent` derivado de campo extra, dono, versões internas, `values`, `specialties`, `sheet`, `dock` ou metadados da criação. Calcular os textos no servidor; dependências necessárias à resolução não são parte do DTO.

Retrato ainda não tem suporte no contrato de identidade. Definir referência opcional de imagem nos metadados genéricos do personagem, com URL HTTPS validada e política de imagem compatível com web/nativo. Ausência rende placeholder; upload/hospedagem de arquivo fica fora. Reusar o contrato para PCs se exposto, sem leitura arbitrária de arquivos ou busca da URL pela API.

**Projeção `full`.** Envelope mínimo para renderização em Leitura (`id`, contexto público, sistema/template, papel `viewer` e ficha filtrada). Não reutilizar a resposta de dono, que inclui criação e outros metadados. Separar leitura padrão (`owner/storyteller/viewer`) de escrita padrão (`owner/storyteller`). Permissão explícita de seção continua prevalecendo; a seção de experiência fechada da v4 não é aberta ao `viewer`.

Testar derivados, defaults, identidade, especializações, conflitos e erros: nenhum campo público pode recuperar ou denunciar um valor restrito por dependência. Ao compilar/renderizar para `viewer`, ocultar campos cuja resolução exija dados negados ou fornecer projeção pública segura definida pelo contrato; nunca enviar o dado privado para resolver no cliente.

**Rotas planejadas.** Ampliar `POST /chronicles/:id/characters` com `kind` opcional (padrão `pc`), `clientCommandId` para criação de NPC e metadados permitidos; adicionar `POST /characters/:id/visibility` com chave, visibilidade e revisão esperada. Metadados de apresentação usam comando próprio, por exemplo `PATCH /characters/:id/presentation`. Campo `kind: npc`, criação livre e visibilidade arbitrados pelo cliente não concedem autoridade. Persistir intenção/hash e auditoria única; intenção divergente retorna 409.

### 3.2 Rolagens, ocultação e idempotência

Migrar `character_rolls` para conter `chronicle_id` obrigatório, `character_id` opcional e `hidden` obrigatório, com padrão `false` para registros existentes. Preencher a crônica a partir da ficha, preservar `batch_id`, autores anônimos e resultados existentes. Validar que a ficha pertence à crônica; rolagem sem ficha exige `by_role = storyteller`, sem custo/lote de ficha.

A chave passa a ser `(chronicle_id, client_roll_id)`. Antes de criar a unicidade, detectar colisões históricas da mesma chave entre fichas da mesma crônica; não apagar nem trocar chaves silenciosamente. O ensaio de migração deve provar o caminho normal e falha explícita com diagnóstico restrito ao operador se houver colisões.

| Rota | Contrato |
|---|---|
| `POST /characters/:id/rolls` | Preservar pedido atual e aceitar `hidden` apenas do narrador; resolver papel atual antes de criar ou recuperar resultado |
| `GET /characters/:id/rolls` | Narrador lê todas; dono lê apenas não ocultas; `viewer` recebe 404 |
| `GET /chronicles/:id/rolls` | Feed exclusivo do narrador, com filtro por ficha/ocultação e paginação estável |
| `POST /chronicles/:id/rolls` | Parada livre: chave, tamanho, dificuldade, especialização e rótulo; `hidden` padrão `true`; sem ficha, boosts ou custo |

Para parada livre, modelo, dado, limites e regra de especialização vêm do template/executor registrado. O cliente não manda modelo, faces ou resultado. O primeiro executor é `pool-success`, já implementado; modelos ainda sem executor retornam 422 `ROLL_UNSUPPORTED`, sem cair em regra de outro modelo. Fixture de outra família prova a capacidade suportada, e D&D prova a recusa coerente sem regra inventada.

O feed inclui origem (ficha ou livre), identidade autorizada, autor, data, rótulo, indicador manual/local quando aplicável, ocultação e resultado. Rolagem local continua local e não passa a integrar o feed por inferência. Rolagem manual mantém marcação explícita; não ampliar a entrada manual na parada livre neste marco.

Reenvio com mesma chave, ator autorizado e intenção retorna o resultado armazenado. Outra ficha, parâmetros, ocultação ou ator com a mesma chave retorna 409 `IDEMPOTENCY_CONFLICT`, sem revelar o registro anterior. Guardar hash canônico da intenção e autoria; validar acesso atual **antes** de devolver duplicata. Não sortear novamente em perda de resposta nem cobrar duas vezes.

Filtrar rolagens ocultas antes de paginação/contagem. Não devolver pedido, rótulo, autor, modificadores ou ponteiro de lote oculto ao jogador. A leitura de histórico de ficha também deve excluir o lote vinculado ao custo oculto. A resposta de recusa/duplicata não pode contornar essa proteção.

### 3.3 Concorrência e mudança de autoridade

O acesso resolvido antes da transação não autoriza uma escrita depois da transferência. A aceitação precisa serializar com todo comando administrativo e de ficha que dependa de quem narra, inclusive os das v3/v4.

Adotar protocolo com trava da crônica primeiro: operações usuais obtêm trava compartilhada compatível com outras operações; troca de narrador e exclusão obtêm trava exclusiva. Reler narrador/vínculo sob a trava antes de agir ou recuperar resultado. Dentro dela, preservar a ordem dos protocolos existentes: pedidos antes das fichas, vínculos quando necessários antes das fichas, fichas em ordem de id. Documentar a ordem completa ao integrar as rotas; não acrescentar aquisição crônica depois de ficha/pedido.

Revisar também aceite/revogação de convite, remoção, criação, configuração, XP, reversão e exclusão de conta: hoje há rotas que começam travando outro recurso. Ajustar esses caminhos juntos para evitar ciclo de travas. Não implementar transferência baseada apenas em um `UPDATE storyteller_id`.

Leitura de NPC precisa resolver visibilidade e projetar a mesma versão autorizada, sem checar `full` numa consulta e retornar valores de uma versão posterior `hidden`. Uma resposta autorizada antes do commit da ocultação pode terminar depois; novas leituras após o commit devem obedecer à ocultação.

### 3.4 Transferência com aceite (P2)

Tabela de pedidos com crônica, solicitante, destinatário, estado (`pending/accepted/rejected/cancelled/expired`), datas, expiração e chaves de intenção. Um pedido pendente por crônica, por índice parcial. Expiração definida pelo relógio do servidor; leituras não atualizam estado.

- `POST /chronicles/:id/transfer`: narrador propõe a membro atual distinto de si; padrão de validade de sete dias, informado na interface.
- `GET /chronicles/:id/transfer`: narrador e destinatário veem o pedido pertinente, sem notas privadas.
- `POST /chronicles/:id/transfer/:transferId/accept`: só destinatário atual, ainda membro, dentro da validade.
- Comandos `/reject` e `/cancel`: destinatário recusa; narrador atual cancela; cada um idempotente.

No aceite, uma transação trava a crônica, revalida narrador de origem/destinatário/pedido, troca `storyteller_id`, remove o vínculo do novo narrador, insere o antigo como membro e transfere `user_id` de todos os NPCs da crônica, inclusive arquivados e logicamente excluídos ainda persistidos. Preserva PCs, XP, autores históricos, notas e visibilidades. Fecha o pedido e registra uma auditoria; replay autorizado da mesma intenção não repete efeitos.

Saída/remoção do destinatário invalida a aceitação; aceitar depois retorna 409 sem troca parcial. Conta excluída não deixa pedido aceitável. Não reativar PCs arquivados nem reescrever autoria. O antigo narrador perde notas, feed e auditoria; mantém seus PCs e vê NPCs apenas conforme a visibilidade pública. O novo pode ver todo o histórico administrativo da crônica.

### 3.5 Sessões e diário (P2)

Criar `chronicle_sessions` com crônica, data da sessão (data civil), título, resumo público, notas privadas, revisão, autoria e datas de alteração. Texto validado e com limites; notas ficam fora de DTOs públicos e de payloads de auditoria.

Rotas `GET/POST /chronicles/:id/sessions` e `GET/PATCH /chronicles/:id/sessions/:sessionId`: narrador cria/edita e recebe campos privados; membro lê somente data, título e resumo público; `former` recebe 404. Sem exclusão de sessão nesta versão, evitando referências históricas órfãs. Edição exige revisão e chave para reenvio seguro.

Adicionar `session_id` opcional a `chronicle_operations` e `character_batches`; XP usa o vínculo da operação contábil, sem duplicar lançamento ou saldo. Comando valida a mesma crônica e grava vínculo na mesma transação. Reenvio com outra sessão é intenção diferente. Reversão mantém referência à operação/sessão original. Sessão não muda regras, custo ou autorização.

“Última sessão” usa maior data civil, com desempate estável, e DTO público mínimo. Ex-membro não recebe esse complemento nem notas em contagens, buscas ou erros.

### 3.6 Configurações restantes e auditoria (P2)

`PATCH /chronicles/:id`: nome, descrição e imagem opcional, com validação de texto/URL, chave de intenção e revisão. Preservar configuração de criação da v4; não permitir troca de sistema, narrador, orçamento ou fórmula por esse payload. Nome alterado passa a valer na confirmação de exclusão.

O `options` citado no painel ainda não existe na raiz do contrato `Template`. Introduzir catálogo opcional com ids, tipos limitados (booleano, enum, inteiro com faixa), defaults e efeito nomeado do registry. Core valida e calcula opções efetivas; API aceita apenas ids/valores declarados; app desenha pelo catálogo. Proibir fórmula/script livre e propriedades desconhecidas. Template sem opções não oferece regras da casa na interface. Demonstrar integração por fixture sintético; opções reais só entram quando seu efeito e sua regra estiverem definidos. Não adicionar preços de XP ou orçamento alternativo por este atalho.

`GET /chronicles/:id/history`: só narrador, união paginada de lotes/eventos de campo e `chronicle_audit`, filtrável por personagem, autor e período. Usar cursor opaco com ordem total `(data, origem, id)` e limite máximo; filtros validados e aplicados em todas as fontes. Texto/especializações continuam com valores omitidos como no histórico atual; auditoria não ganha conteúdo de notas. Entradas indicam origem, ficha, operação e sessão quando houver. Desfazer segue exclusivamente os comandos existentes e sua elegibilidade.

### 3.7 Recusas e mensagens

| Caso | Resposta | Mensagem-base |
|---|---|---|
| NPC oculto ou acesso fora da projeção de `viewer` | 404 | “Não encontrado.”, sem nome, id de lote ou detalhe privado |
| Membro tenta criar NPC ou alterar visibilidade de sua própria ficha PC | 403 `STORYTELLER_REQUIRED` | “Só o narrador pode fazer isso.” |
| Mesma chave com intenção diferente | 409 `IDEMPOTENCY_CONFLICT` | “Esta ação já foi enviada com outros dados. Atualize antes de tentar novamente.” |
| Revisão antiga de visibilidade/configuração/sessão | 409 `REVISION_CONFLICT` | “Os dados mudaram. Atualize para continuar.” |
| Modelo sem executor de parada livre | 422 `ROLL_UNSUPPORTED` | “Este sistema ainda não oferece parada livre.” |
| Pedido de transferência vencido/decidido ou destinatário sem vínculo | 409 `TRANSFER_UNAVAILABLE` | “A transferência não está mais disponível.” |
| Sessão de outra crônica ou não acessível | 404 | “Não encontrado.” |
| Opção/valor de regra da casa inválido | 422 `CHRONICLE_OPTION_INVALID` | “Escolha um valor permitido pelo template.” |

Restrições de recurso/visibilidade precedem erros de payload que poderiam confirmar dados privados. Preservar códigos da v3/v4 para estado, trava, criação e XP; o `viewer` é recusado antes dessas políticas, com 404.

## 4. Mapa das etapas

P/M/G indicam tamanho relativo, sem estimativa de calendário.

| # | Etapa | Entrega do painel | Camadas | Depende de | Tamanho |
|---|---|---|---|---|---|
| 0 | Preparar base, contratos e evidências | Todas | Documentação | Leitura da base | P |
| 1 | Papel `viewer` e projeções seguras | 10 | Contrato, core, testes | 0 | G |
| 2 | Persistência de NPCs e comandos idempotentes | 10 | Banco, API | 1 | G |
| 3 | NPCs no app e redução de acesso | 10 | App, cache, web/nativo | 2 | G |
| 4 | Rolagens por crônica e executor de parada livre | 11 | Banco, core | 1 | M |
| 5 | Feed, ocultação e parada livre na API | 11 | API, AuthZ, concorrência | 2, 4 | G |
| 6 | Interface de rolagens da mesa | 11 | App, rede | 3, 5 | M |
| 7 | Transferência e protocolo de autoridade | 12, P2 | Banco, API, app | 2, 5; revisão das rotas v3/v4 | G |
| 8 | Sessões e contexto das operações/XP | 12, P2 | Banco, API, app | 5 | G |
| 9 | Metadados e opções da crônica | 12, P2 | Contrato, core, API, app | 1, 2 | G |
| 10 | Auditoria consolidada | 12, P2 | API, app | 7–9 | M |
| 11 | Jornadas, regressões e fechamento | Todas | Todas | 1–10 ou corte P2 explícito | G |

**Marcos:** A = NPC privado utilizável (1–3); B = rolagens de bastidores (4–6); C = manutenção da campanha (7–10, P2); D = fechamento com evidências (11). O caminho principal é 0 → 1 → 2 → 3/5 → 6 → 11. A Etapa 4 pode ser preparada após 1; sessões e configurações não bloqueiam o marco B. Essa separação de dependências não exige delegação nem execução simultânea.

## 5. Etapas de implementação

### Etapa 0. Registrar o plano e preparar a execução

P · depende de: leitura da base

**Entrega.** Inventário atualizado, contratos observáveis e lista de verificações por marco.

**Passos.**

1. Ler `AGENTS.md`, `CLAUDE.md` e instruções dos diretórios afetados; conferir branch, commit e alterações locais antes de editar.
2. Resolver o pacote Turbo e ler seus documentos empacotados antes de executar/mudar comandos relacionados, conforme `AGENTS.md`.
3. Confrontar código e pendências da v4 com §2; registrar o que está implementado, validado e sem evidência. Não reabrir tabelas de regras de jogo por inferência.
4. Fechar DTOs, capacidades e recusas do §3 em exemplos de requisição/resposta e testes de contrato.
5. Preparar roteiro de migrations em banco descartável e testes por marco. Criar `doc/validacao-v5.md` durante a execução, inicialmente com pendências, sem resultados presumidos.

**Pronto quando.** A base e o escopo estão identificados e nenhuma proposta ou evidência antiga é apresentada como entrega da v5.

### Etapa 1. Core: `viewer`, identidade e projeção completa

G · depende de: 0

**Entrega.** Papéis e projeções que mantêm dados restritos fora da saída.

**Passos.**

1. Adicionar `viewer` ao registry, schema e tipos; separar defaults de leitura e escrita em `permissions.ts`.
2. Implementar projeção pública de identidade resolvida, com lista explícita de propriedades. Não derivá-la copiando a resposta atual da lista.
3. Definir envelope `identity/full` compartilhado com a API e renderizador; manter `kind`/visibilidade como metadados do app, sem regras de sistema.
4. Auditar `stripRestricted`, derivados, defaults, especializações e campos compartilhados entre seções. Cobrir dependência privada com fixture sintético.
5. Atualizar validação/paridade/documentação. Testar dono, narrador, `viewer`, conjunto vazio e papel desconhecido nos três templates e D&D.

**Pronto quando.** `viewer` lê apenas o contrato permitido, não escreve nenhum campo e a identidade não transporta valores/dependências do `dock`.

### Etapa 2. Banco e API de NPCs

G · depende de: 1

**Entrega.** NPC oculto, editável só pelo narrador e revelável por comando transacional.

**Passos.**

1. Criar migration posterior à última existente, sem reservar número antes de reconferir. Adicionar kind/visibilidade, revisão de apresentação/visibilidade, retrato opcional e persistência de chaves dos comandos de crônica necessários.
2. Backfill como `pc`, com checks e índices apropriados; atualizar tipos Kysely, migration registry, testes e `database.dbml`.
3. Criar NPC com trava da crônica, revalidação do narrador e idempotência. Inicializar criação livre usando o contrato da v4, sem fabricar saldo de XP ou ativação direta por status.
4. Adaptar `characterAccess`: ramo NPC antes da posse, narrador atual ou `viewer` conforme vínculo/visibilidade; PC continua com regras anteriores.
5. Atualizar lista, contagem e ficha com os DTOs do §3.1; Mesa recebe NPCs identificados, sem misturar filtros de estado e visibilidade.
6. Implementar comando de visibilidade e apresentação com revisão, chave, auditoria mínima e resposta filtrada. Preservar estado, criação e XP.
7. Revisar todas as rotas que usam `characterAccess`, incluindo `/events`, exclusão, histórico, rolls, criação, orçamento, XP/extrato/pedidos e reversão. “Acesso não nulo” não basta para admitir `viewer`.
8. Incluir NPCs em ações em grupo pelo mesmo protocolo de validação/prévia/reversão. Aplicar limites também às criações do narrador concorrentes.

**Pronto quando.** Matriz do §3.1 passa; oculto não aparece nos corpos/contagens; replay não duplica NPC ou auditoria; nenhum endpoint lateral concede leitura/escrita a `viewer`.

### Etapa 3. App: NPCs, leitura pública e cache

G · depende de: 2

**Entrega.** Narrador administra NPCs e jogador abre somente a projeção autorizada.

**Passos.**

1. Adicionar “Criar NPC” exclusivo do narrador e seção própria na Mesa, reusando ficha e componentes genéricos. Mostrar criação livre e estados existentes.
2. Criar controle “Oculto / Identidade / Ficha”, com identidade como opção inicial ao revelar e prévia do que será publicado.
3. Atualizar lista e rota da ficha para discriminar DTOs: cartão de identidade não instancia store de ficha completa nem busca histórico/rolls/XP.
4. Em `full`, abrir em Leitura e remover edição, exclusão, rolagens, criação e evolução; permissões continuam aplicadas na API.
5. Revalidar ao focar/reconectar. Ao receber 404, mudança de projeção ou perda de papel, cancelar buscas e limpar stores, consultas e snapshots persistidos incompatíveis; impedir resposta antiga em voo de repovoar dados revogados.
6. Isolar dados por sessão de usuário e acesso. Para NPC revelado, exigir revalidação online ao abrir, sem restaurar ficha completa offline; documentar a janela de uma tela já aberta sem rede.
7. Cobrir rótulos, leitores de tela, teclado, ausência de imagem e reconexão. Testar redução `full → identity → hidden` e troca de usuário.

**Pronto quando.** Ambos os papéis completam o fluxo, `viewer` não dispara consultas proibidas e dados de projeção anterior não ressurgem após revogação detectada.

### Etapa 4. Persistência de rolagens e parada livre no core

M · depende de: 1

**Entrega.** Modelo por crônica e execução de parada livre pela regra declarada.

**Passos.**

1. Ensaiar migration de `character_rolls`: preencher crônica, adicionar ocultação, permitir ficha nula e trocar unicidade, preservando resultados e anonimização.
2. Acrescentar vínculo ficha/crônica consistente, check de rolagem livre do narrador, hash/autoria da intenção e índices para feed/histórico.
3. Documentar `down` quando já existirem rolagens livres: rollback de validação usa banco descartável; não descartar registros incompatíveis silenciosamente em ambiente com dados.
4. Implementar planejamento de parada livre no core, reutilizando executor e CSPRNG existentes; validar limites e especialização sem penalidade, boosts ou custo de ficha.
5. Expor capacidade por modelo suportado, com recusa explícita nos demais. Testar valores-limite, entrada malformada e propriedades de faces/resultado em domínios válidos.

**Pronto quando.** Migrations sobem/descem/sobem no cenário documentado; dados antigos permanecem legíveis e parada livre usa a regra do template sem nomes de sistema.

### Etapa 5. API de rolagens da mesa e privacidade do custo

G · depende de: 2, 4

**Entrega.** Feed, rolagens ocultas e parada livre idempotentes.

**Passos.**

1. Adaptar comando de ficha com `hidden`, autorização atual e intenção canônica; manter custo e resultado na mesma transação, com política antes de sortear.
2. Implementar POST livre, exclusivo do narrador, com padrão oculto, limite de frequência por usuário/crônica e resultado gerado no servidor.
3. Implementar feed e paginação por `(created_at, id)`, limites e filtros de ficha/ocultação; ficha usada como filtro precisa pertencer à crônica.
4. Filtrar leitura de rolls do dono e histórico de custos ocultos no servidor, antes de limite/cursor. Revisar respostas duplicadas, erros e endpoints de operação/lote relacionados.
5. Recuperar mesma intenção sem novo sorteio/custo; responder conflito sem dados da intenção anterior. Tratar disputa da chave no banco, inclusive entre duas fichas ou ficha/parada livre.
6. Estender matriz nos três sistemas e testes de Postgres real para custo, ocultação, duplicatas e criação simultânea.

**Pronto quando.** Jogador não recebe nenhuma informação da rolagem oculta nem seu lote; feed é exclusivo do narrador; reenvio aplica uma vez e custo não burla a política.

### Etapa 6. App: feed, rolagem oculta e parada livre

M · depende de: 3, 5

**Entrega.** Ferramentas de rolagem acessíveis pela Mesa.

**Passos.**

1. Adicionar feed com origem, filtros, paginação, atualização ao focar e indicador de última atualização.
2. No comando do narrador por ficha, oferecer ocultação; explicar o efeito de eventual custo antes de confirmar. O jogador não recebe esse controle.
3. Implementar parada livre com inputs derivados da capacidade/template, rótulo e ocultação ligada por padrão. Modelo sem suporte apresenta ausência de capacidade coerente.
4. Manter chave/intenção durante resultado desconhecido e oferecer reenviar; não gerar UUID novo no retry nem usar fallback de rolagem local para esses comandos.
5. Invalidar feed, rolagens e ficha afetada após confirmação; preservar comportamento offline de rolagem comum já existente.

**Pronto quando.** Narrador rola e recupera resposta perdida sem duplicação; jogador não recebe feed ou resultado secreto por cache, toast ou consulta compartilhada.

### Etapa 7. Transferência da narração (P2)

G · depende de: 2, 5 e protocolo do §3.3

**Entrega.** Transferência com aceite, troca efetiva de autoridade e preservação dos NPCs.

**Passos.**

1. Mapear e ajustar aquisição de travas de todas as rotas afetadas antes do aceite; testar regressões de membros, convites, criação, XP e operações.
2. Criar tabela/índice de pedido e comandos de propor, consultar, aceitar, recusar e cancelar. Expiração usa relógio injetável nos testes.
3. Implementar transação do §3.4, incluindo posse dos NPCs e idempotência ligada ao ator original. Não retornar bastidores no replay ao antigo narrador.
4. Criar fluxo de confirmação do solicitante e aceite do destinatário com alcance dos dados privados descrito; invalidar caches de papel e fichas ao concluir/detectar a troca.
5. Cobrir remoção/saída do destinatário, conta excluída, pedido vencido, duplo aceite e escrita do antigo narrador concorrente.
6. Testar exclusão de conta após transferência: NPCs permanecem; PCs do usuário seguem política de exclusão existente, sem migração de dono por inferência.

**Pronto quando.** Só um narrador permanece, troca e posse são atômicas, a autoridade antiga não passa em operações posteriores e não há perda de NPC por cascata.

### Etapa 8. Sessões e diário (P2)

G · depende de: 5

**Entrega.** Registro de sessão e contexto histórico de operações/XP, com notas privadas separadas.

**Passos.**

1. Criar tabela, revisão e FKs opcionais em operações/lotes. Validar associação à crônica no servidor e, quando aplicável, por constraint composta.
2. Implementar leituras públicas explícitas e comandos do narrador com revisão/idempotência; evitar `selectAll` na resposta pública.
3. Acrescentar `sessionId` opcional às intenções de dano/cura/recuperação, concessão/ajuste e decisão de XP que gera operação; persistir atomicamente e preservar na reversão.
4. Criar lista/detalhe/editor, separando resumo público e nota privada; vinculação é escolha explícita, sem alterar seleção retroativamente.
5. Incluir última sessão nas crônicas para atores autorizados; testar datas civis sem deslocamento de fuso, ausência e empate.
6. Provar ausência de nota em respostas de membro, contagens, erros, auditoria e cache entre sessões de usuário.

**Pronto quando.** Jogador lê só o diário público; narrador edita com conflito controlado e XP/operações mantêm contexto sem mudar saldo ou reversibilidade.

### Etapa 9. Metadados e regras da casa (P2)

G · depende de: 1, 2

**Entrega.** Configuração geral validada, com opções somente quando declaradas pelo template.

**Passos.**

1. Introduzir contrato opcional de `options` e efeitos permitidos no core, schema/referência/tipos/paridade; criar fixture sintético com opção exercitável e caso sem capacidade.
2. Definir valores efetivos e contexto de aplicação explícito. Opção não altera ficha persistida ou orçamento/XP silenciosamente; mudança relevante ao preço/elegibilidade respeita invalidação de pedidos da v4.
3. Persistir descrição/imagem/valores selecionados e revisão, com defaults seguros para crônicas existentes.
4. Implementar PATCH com allowlist, chave e auditoria mínima; manter endpoint/configuração de criação da v4 e negar propriedades protegidas.
5. Construir formulário genérico; testar conflito, resposta perdida, imagem ausente e renomeação seguida de exclusão confirmada pelo nome atual.

**Pronto quando.** Só narrador altera configurações; fórmula/efeito desconhecido é recusado e ausência de catálogo não cria regras ou controles fictícios.

### Etapa 10. Auditoria consolidada (P2)

M · depende de: 7–9

**Entrega.** Consulta administrativa de campo e ações da crônica, com filtros e cursor estáveis.

**Passos.**

1. Definir DTO discriminado para lote de ficha e ação administrativa, preservando autor anônimo e omissão de texto sensível.
2. Implementar união paginada, filtros de ficha/autor/período e índices; impedir filtros de outra crônica e consultas sem limite.
3. Incluir referências a operação/sessão e rótulos legíveis, sem copiar notas ou pedido secreto inteiro para `chronicle_audit`.
4. Criar tela exclusiva do narrador; ações de reversão reutilizam comandos existentes e nunca oferecem reversão genérica de XP/transferência.
5. Testar cursores com datas iguais, inserções entre páginas, fontes diferentes, autor excluído, NPC oculto e acesso após transferência.

**Pronto quando.** Novo narrador consulta a história da crônica sem lacunas/duplicatas de paginação; demais atores não recebem a rota, filtros ou contagens privadas.

### Etapa 11. Jornada e fechamento da v5

G · depende de: etapas incluídas no marco de entrega

**Entrega.** Jornada do §1, regressões e relatório com evidências reais.

**Passos.**

1. Criar `journey-backstage.spec.ts` e cenários complementares com sentinelas, interceptação das respostas e contagens. Exercitar `hidden/identity/full`, ex-membro, ocultação posterior e custo oculto na ficha de jogador.
2. Rodar Chromium e WebKit contra export com CSP de produção, API e Postgres reais. Portas 3101/8181 são fixas: uma suíte por vez.
3. Preservar jornadas de Vampiro, Mago, Lobisomem e narrador; verificar criação/aprovação/XP da v4 e registrar lacunas da base. Ajustes de seed devem manter asserções de privacidade e contabilização.
4. Acrescentar fluxo Maestro de bastidores e executar os sete anteriores, além de qualquer fluxo de criação/XP que exista na base reconferida, em Android com dev build e SQLCipher.
5. Validar iOS quando houver infraestrutura; registrar execução ou ausência de Mac/Xcode/simulador/aparelho separadamente. WebKit não substitui iOS nativo.
6. Para P2 incluído, executar jornada complementar de sessão/configuração/auditoria/transferência. Se adiado, mover a lista exata para backlog e registrar marco A/B validado, com entrega 12 pendente.
7. Completar checks do §6.5, documentação e critérios do §9; distinguir evidências locais de CI remoto.

**Pronto quando.** O escopo efetivamente entregue tem evidências verificáveis, sem confundir corte P2, teste ignorado ou validação antiga com conclusão integral da versão.

## 6. Estratégia de testes

Manter Bun no core/API/banco, PGLite para integração rápida, Jest/Testing Library no app/UI, Postgres real para concorrência, Playwright no web e Maestro no nativo. Preservar metas de cobertura; testes devem provar invariantes e comportamento observável.

### 6.1 Core e contratos

- `viewer` nunca escreve, mesmo em seção sem `permissions`; permissões explícitas prevalecem.
- Identidade nunca contém valor extra ou dependência do `dock`; especializações e derivados não reconstroem dados privados.
- Projeção idempotente: projetar novamente não amplia campos. Alterar campo privado não altera a identidade pública quando ele não é dependência autorizada.
- Parada livre respeita modelo, faixas e regra declarada; resultado não vem do cliente; modelo sem executor é indisponível.
- Opções declaradas usam valores válidos/defaults e efeitos registrados; catálogo ausente e propriedades desconhecidas têm resultados explícitos.
- Três templates do produto e fixture D&D passam sem código por sistema. Capacidade positiva de parada livre também passa em fixture sintético de outra família.
- Paridade de schema, referência JS, tipos, registry e validação TS em cada alteração de contrato.

### 6.2 API, matriz e ausência de vazamento

Toda rota nova e alterada entra em `apps/api/src/test/authz-matrix.ts`, nos três sistemas. Atores: dono de PC, outro membro, narrador, narrador de outra crônica, ex-membro, estranho, anônimo e `viewer`. Para transferência, acrescentar antigo narrador/destinatário antes e depois do aceite.

Cruzar visibilidades com lista, contagem, ficha, Mesa, eventos, exclusão, criação, histórico, rolls, XP/extrato/pedidos, operações e comandos de apresentação. Testar notas privadas de sessão, feed e auditoria. Sentinelas devem estar ausentes do corpo serializado, inclusive nomes/ids privados e dependências; não basta ocultar componente.

Cobrir replay com acesso revogado, chave divergente, alvos de outra crônica, revisão velha, estado/trava, roll oculto manual, custo oculto, anonimização de autor e filtros/cursor antes da paginação. Testar valores e contagens independentes para cada ator.

### 6.3 Concorrência em Postgres real

Usar conexões independentes e bancos descartáveis terminados em `_test`, no padrão dos testes existentes. Incluir novos arquivos no job `postgres` do CI; preservar os testes anteriores. PGLite e skip sem `PG_TEST_URL` não provam as travas.

| Disputa | Resultado obrigatório |
|---|---|
| Criação duplicada de NPC | Um NPC e uma auditoria; reenvio recuperável |
| Criações no limite do narrador | Limite respeitado sem duas inserções excedentes |
| Duas mudanças de visibilidade na mesma revisão | Uma vence; outra conflita sem sobrescrever |
| Ocultar NPC contra leitura/lista/contagem | Resposta consistente com snapshot autorizado; leituras posteriores ao commit não revelam |
| Mesma chave de roll na mesma ou em fichas distintas | Um sorteio/custo; intenção divergente recebe 409 sem dados anteriores |
| Chave disputada entre roll de ficha e livre | Uma operação; sem dois resultados ou 500 por unicidade |
| Roll com custo contra trava, remoção e mudança de estado | Política atual aplicada; sem custo ou resultado parcialmente gravado |
| Transferência contra escrita/XP/reversão do narrador antigo | Operação autorizada antes da troca ou recusada depois; sem autoridade antiga reaproveitada |
| Aceite contra remoção/saída/exclusão do destinatário | Um resultado válido, sem narrador inexistente ou troca parcial |
| Duplo aceite contra cancelar/recusar | Uma decisão terminal e uma troca/auditoria |
| Transferência contra criação/exclusão de NPC e conta de origem | Posse consistente; nenhum NPC perdido por cascata após transferência |
| Edição de sessão/configuração na mesma revisão | Conflito explícito sem perda silenciosa |
| Operação/XP com sessão e resposta perdida | Um efeito, um vínculo e auditoria única |

Testes precisam consultar o banco após conflitos para provar ausência de efeitos parciais. Incluir timeout e cenários com ordem inversa para revelar deadlocks.

### 6.4 App, rede, web e nativo

Testar DTO parcial sem store completo; ausência de controles para `viewer`; cancelamento de busca antiga e limpeza de caches; troca de usuário e papel; revalidação ao focar/reconectar; redução de visibilidade; ausência de capacidade; resultado desconhecido e retry com mesma chave. Comandos novos indisponíveis offline não podem cair na fila de `/events` ou no fallback local de `useDice`.

Playwright verifica a jornada e corpos da rede em Chromium/WebKit, além das regressões de ficha, política e XP. Maestro verifica fluxo real de toque, teclado, leitura, apresentação e reconexão em Android. iOS tem resultado próprio; não inferir aprovação a partir da plataforma web.

### 6.5 Checks de fechamento

Executar scripts atuais dos `package.json` e workflow, após ler instruções locais:

- Build, typecheck, Biome, metas de cobertura e auditoria de dependências.
- `scripts/check-system-names.mjs`, validação de templates/exemplos, gerados de design e contraste.
- Migrations up/down/up, backfills e tipos Kysely em dia; relatório de limitações do rollback.
- Suítes PGLite e Postgres real, novas e de regressão.
- Export web, bundle, CSP, imagens permitidas e Playwright.
- Android e relatório separado de iOS.

Publicar templates para validar apenas em banco descartável. Não reduzir cobertura, desativar hooks, remover asserções de privacidade ou registrar CI remoto sem execução e evidência.

## 7. Riscos e preservação das garantias

| Risco | Mitigação |
|---|---|
| Adicionar `viewer` abre escrita padrão | Defaults distintos e negação explícita em todas as rotas laterais |
| Identidade leva campos do `dock` | DTO resolvido com allowlist, sem reaproveitar `values` da lista atual |
| Derivado/default revela nota ou seção restrita | Dependências auditadas e fixtures de vazamento |
| Dono antigo continua lendo NPC oculto | Ramo NPC exige autoridade atual; posse transferida atomicamente |
| Roll secreto aparece pelo custo/histórico/duplicata | Filtrar lote vinculado e replay, validar autoridade atual, testar sentinelas |
| Nova unicidade destrói ou conflita com dados antigos | Diagnóstico prévio de colisões e backfill ensaiado sem descarte silencioso |
| Retry faz novo sorteio ou duplica NPC | Chave persistida, hash de intenção e constraint no banco |
| Transferência mantém papel obtido antes da transação | Protocolo da crônica antes das demais travas, releitura e Postgres real |
| Exclusão da conta antiga apaga NPCs | Transferência de todos os NPCs persistidos e teste de cascata |
| Nota privada volta por cache ou busca antiga | Cancelamento, descarte de respostas antigas e limpeza por perda de acesso |
| Regras da casa contornam criação/XP | Catálogo/efeitos fechados, sem fórmula livre ou alteração silenciosa de projeções |
| P2 impede fechar o núcleo de bastidores | Marcos separados e backlog explícito, sem afirmar entrega integral |

A v5 preserva atomicidade de grupo, reversão com `from_absent`, política no recebimento, trava, ex-membro em Leitura, criação por pontos, aprovação e extrato de XP protegido. Acrescentar `viewer` não permite gastar XP, ler pedido ou alterar projeções. Rolagens ocultas não afrouxam a política de custo. Auditoria consolidada não torna operações contábeis reversíveis pelo comando genérico.

## 8. Documentação e relatório de execução

Atualizar durante a implementação:

- Este plano, com estado por etapa e evidências, distinguindo implementação e validação.
- `doc/painel-narrador.md`, com contratos sincronizados e entregas 10–12 marcadas apenas quando demonstradas.
- `doc/arquitetura-motor-de-ficha.md`, README/schema dos templates e referência executável.
- `doc/database.dbml`, `CLAUDE.md`, instruções de testes e checklist de segurança existente.
- README do Maestro com fluxo novo, parâmetros e limitações de plataforma.
- `doc/validacao-v5.md`, com commit, ambiente, comandos/resultados, concorrência, web/Android/iOS, CI remoto e pendências herdadas da v4.

Relatório deve separar núcleo de bastidores e P2, enumerar migrations e alterações de contrato, registrar limites de cache/rollback/capacidades e apontar o backlog real. Não incluir credenciais, notas privadas ou alegações de testes não executados.

## 9. Critérios objetivos de conclusão

**Núcleo obrigatório — entregas 10 e 11.**

- [x] Contratos e diferenças da base reconferidos antes das telas.
- [x] PC/NPC definidos no banco; NPC nasce oculto e em criação livre autorizada pelo narrador.
- [x] `viewer` lê projeções autorizadas e nunca escreve nem acessa histórico, rolagens, criação ou XP.
- [x] Identidade sem `dock`, `values`, dependências ou metadados administrativos.
- [x] NPC oculto ausente dos corpos, listas, contagens e erros dos jogadores/ex-membros.
- [x] `full` filtra Notas do Narrador e demais seções/dependências restritas.
- [x] NPC participa de dano/cura/recuperação/reversão pelo fluxo existente.
- [x] Redução de visibilidade detectada remove cache/store incompatível e respostas antigas em voo.
- [x] Feed exclusivo do narrador, paginado, com rolagens de ficha e livres.
- [x] Roll oculto ausente de histórico de rolagens, lote de custo e respostas duplicadas do jogador.
- [x] Parada livre usa executor declarado, é oculta por padrão e recusa capacidade não implementada.
- [x] Idempotência por crônica, intenção divergente tratada e resposta perdida recuperável sem novo sorteio/custo.
- [x] Migrations preservam dados/autores, detectam colisões e têm rollback documentado.
- [x] Matriz nos três sistemas, fixture de outra família e provas de ausência de dados privados aprovadas.
- [x] Concorrência executada em Postgres real, sem contar skips como validação.
- [x] Jornadas e regressões aprovadas em Chromium/WebKit; criação/XP e pendências herdadas explicitadas.
- [x] Android validado e iOS informado separadamente, com motivo se não executado. Android: 7/8 na suíte completa e o `07` corrigido isolado; iOS sem infraestrutura (ver validação).
- [ ] Checks e documentação concluídos com evidências reais. Pendente: `pnpm audit` falha por `zod` herdado e o CI remoto não rodou.

**Complemento P2 — entrega 12.**

- [x] Transferência com aceite, expiração, cancelamento/recusa e concorrência validada.
- [x] Autoridade antiga revogada nos comandos das v3/v4/v5, com cache invalidado ao detectar a troca.
- [x] Posse dos NPCs transferida sem alteração de PCs, visibilidade, autores ou saldo.
- [x] Exclusão da conta antiga preserva NPCs transferidos.
- [x] Sessão com resumo público e notas privadas, edição por revisão e contexto de operações/XP.
- [x] Última sessão e leitura pública não revelam notas ou dados ao ex-membro.
- [x] Metadados gerais editáveis pelo narrador com conflitos e idempotência controlados.
- [x] Opções declaradas exercitadas pelo motor genérico; ausência de capacidade e payload inválido cobertos.
- [x] Auditoria consolidada paginada, filtros estáveis, valores sensíveis omitidos e leitura só do narrador.
- [x] Jornada complementar e regressões executadas, ou entrega 12 explicitamente movida para backlog.

Ausência de privacidade demonstrada, contabilização preservada, concorrência essencial ou validação web/Android impede declarar o núcleo concluído. Ausência de infraestrutura iOS deve constar como pendência de plataforma. Com P2 adiado, o fechamento informa “entregas 10–11 concluídas; entrega 12 pendente”, sem afirmar conclusão integral do painel.

## 10. Fora da v5

Tempo real/WebSocket, chat, mapa/tokens, música, notificações de calendário, migração de fichas entre versões de template, recuperação de senha, roteiro de deploy, upload/hospedagem de imagens, conversão PC/NPC, revelação posterior de rolagem oculta, escrita de `viewer`, executores de todos os modelos de dados, reescrita das regras de criação/XP e publicação/deploy/merge sem instrução explícita.

## 11. Prompt para iniciar a implementação

```text
Você é o agente responsável pela implementação da v5 do TMS em
/home/assisneto/tms.

Leia AGENTS.md e CLAUDE.md e execute doc/plano-v5.md como roteiro.
Leia os documentos e arquivos indicados e reconfira o checkout antes
de editar; a base do planejamento é main em 0f090dc, merge do PR #32.

Implemente primeiro as entregas 10 e 11: NPCs hidden/identity/full,
papel viewer, feed do narrador, rolagem oculta e parada livre. Comece
pelos contratos/projeções e testes de privacidade; depois banco/API
e app. Preserve motor genérico, política de escrita, operações,
criação e extrato de XP das v3/v4.

Reconfira as pendências documentais e de validação da v4 sem assumir
que merge equivale a critérios aprovados. Registre evidências reais.

Garanta que identity não transporta dock ou valores brutos, full
não revela seções/dependências privadas e viewer não acessa rotas
laterais. Filtre rolls ocultos e seus lotes de custo no servidor.
Valide autoridade atual também ao recuperar uma intenção duplicada.
Parada livre usa executor suportado pelo template, sem regra inventada
para modelo ainda indisponível. Novos comandos exigem rede e retry
com a mesma chave; não reutilize o fallback de rolagem local.

Depois implemente a entrega 12 como marco P2: transferência com aceite,
sessões, configurações e auditoria. Antes da transferência, integre
o protocolo de autoridade e travas com todas as escritas existentes.
Transfira também a posse dos NPCs e prove que excluir a conta antiga
não os apaga. Se P2 for adiado, registre o corte exato no backlog e
não declare a v5 ou o painel integralmente concluídos.

Execute testes significativos de core, AuthZ, corpos/contagens e
concorrência em Postgres real, jornadas Chromium/WebKit e Android.
Registre iOS separadamente conforme infraestrutura disponível.
Skip, WebKit e validação antiga não contam como aprovação nativa.

Resolva escolhas rotineiras autonomamente e continue o trabalho
independente autorizado quando houver pendência específica.
Não fabrique evidências, não exponha dados privados em relatórios
e não publique, envie alterações remotas, faça deploy ou merge por
inferência. Templates de teste só em banco descartável.

Atualize o plano e doc/validacao-v5.md com alterações, contratos,
migrations, comandos/resultados, concorrência, web/Android/iOS,
estado do CI, pendências herdadas e escopo P2 efetivamente entregue.
```
