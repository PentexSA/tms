# Fase 5 — Plano de implementação de analytics de produto

Revisado em 05/11/2026, sobre o código em `05c5d7d`.
Origem: [Fase 5 do plano de observabilidade](plano-observabilidade.md#fase-5-analytics-de-produto).
A 5a está implementada (`scripts/metrics-funnel.ts`, §2 “Estado”); a 5b
continua só planejada, sem integração ativada.

## 1. Decisão de arquitetura e proporção

Dividir a fase em duas entregas independentes:

| Etapa | Entrega | Quando | Esforço inicial |
|---|---|---|---|
| **5a** | Relatório local sob demanda sobre os dados existentes | Agora, no deploy de teste | 0,5–1 dia, a validar com as consultas |
| **5b** | PostHog na UE, com coleta e envio pela API | Quando houver uma pergunta recorrente que o relatório não responda ou necessidade de painel contínuo | 3–5 dias de engenharia, a reestimar na prova do transporte |

A 5a não depende da 5b e já permite avaliar ativação, uso por família e retorno
semanal. Uma amostra pequena deve ser apresentada com contagens absolutas,
sem transformar percentuais em conclusões fortes sobre comportamento.

A 5b usa a API como caminho principal: quase todos os eventos relevantes já
são decididos ali, na transação que grava a operação, com autor e controle de
repetição. O frontend comunica apenas acontecimentos que só ele conhece.
Não instalar SDK do PostHog no web ou no nativo, não alterar a CSP para esse
provedor e não criar um segundo mecanismo de identidade no navegador.

Essa decisão substitui o desenho anterior com SDK direto, revalidação de
consentimento a cada cinco minutos, canal próprio entre abas, configuração
remota e segunda exclusão obrigatória após 24 h. Mantém filtro de saída,
consentimento para coleta externa e exclusão durável.

## 2. Fase 5a — Relatório sobre dados existentes

### Entrega e execução

Criar `scripts/metrics-funnel.ts`, com consultas fixas e parametrizadas, e o
comando proposto `pnpm metrics:funnel`. Interface inicial:

```text
pnpm metrics:funnel --from 2026-10-01 --to 2026-11-01 --timezone America/Sao_Paulo
```

O período é semiaberto: inclui `from`, exclui `to`. O relatório imprime período,
fuso, data de extração, definição das etapas, contagens e limitações. Saída
inicial em texto e JSON agregado; não precisa de dashboard, cron ou API pública.

Usar `METRICS_DATABASE_URL` própria, de um role com leitura restrita. Não usar
nem assumir a credencial administrativa de `DATABASE_URL`. Documentar a
configuração de permissões por coluna ou views restritas, sem conceder acesso
a senha/hash, e-mail, nome, tokens, código de convite, `sheet_data`, notas ou
`chronicle_audit.payload`. A agregação ocorre no banco; o script não imprime
ids de pessoa, ficha, crônica ou eventos individuais.

Conexão independente da inicialização da API e do Sentry, transação somente de
leitura com snapshot consistente, timeout de consulta e encerramento do pool.
Sem fallback para um usuário mais privilegiado quando faltar permissão.
Rodar sob demanda; não manter o Neon acordado com polling. Antes de mudar
scripts ou configuração do Turbo na implementação, seguir os docs instalados
indicados no `AGENTS.md`.

### Fontes disponíveis e limites

| Medida | Fonte atual | Limite que deve acompanhar o número |
|---|---|---|
| Cadastro | `users.id`, `created_at` | Contas excluídas não aparecem; não representa todo o cadastro histórico. |
| Crônica e convite criados | `chronicle_audit`, ações `chronicle.create` e `invite.create` | Há dados apenas desde a instrumentação dessas ações; cascatas podem remover registros. |
| Entrada de jogador | `chronicle_members.user_id`, `chronicle_id`, `joined_at` | Mede vínculos ainda existentes. Saída/remoção apaga o vínculo; reentrada não preserva a entrada anterior. Não chamar de histórico completo de aceites. |
| Rascunho de PC criado | `characters`, com `kind = pc`, dono e `created_at` | Não mede abertura de formulário, tentativa ou abandono antes de salvar; exclui NPC. |
| Envio para aprovação | Ação `character.creation.submit` | Operação confirmada que levou a `pending`, não tentativa de envio. |
| Aviso de criação livre | Ação `character.creation.ready` | O dono avisou que terminou; não significa ficha ativada. |
| Ficha ativada pela criação | Ações `character.creation.complete` e `character.creation.approve` | Distinguir autor da ação e dono alvo; concluir e aprovar não são o mesmo evento. |
| Rolagem registrada | `character_rolls`, autor, horário, vínculo e `hidden` | Excluir NPC; separar rolagem de PC e livre do narrador. Não inclui rolagens locais sem registro. |
| Pedido de XP | Ação `xp.request.create` | Pedido confirmado, sem motivo, custo ou conteúdo como dimensão. |
| Família | `game_systems.family`, via relações de crônica/ficha | Agrega Vampiro, Lobisomem e Mago como `wod`; não equivale a comparação por sistema. |

Usar somente colunas explicitamente permitidas. `character_batches` pode
contribuir para atividade semanal por autor e horário, sem ler seus eventos
ou conteúdo. Identidades nulas por exclusão não podem ser reconstruídas.
Não inferir papel histórico a partir do narrador atual de uma crônica que
pode ter sido transferida.

### Funis e retenção

1. **Narrador:** cadastro → crônica criada → convite criado, por pessoa e em
   ordem temporal, com janela inicial de sete dias. Relatar também ativação
   sem exigir cadastro no período, para contas existentes.
2. **Jogador:** entrada de vínculo ainda existente → rascunho de PC criado →
   submissão confirmada ou aviso de criação livre → ativação → primeira
   rolagem do jogador. Correlacionar crônica e ficha no banco quando possível,
   sem exportar os identificadores. Distinguir rolagem do narrador em ficha
   alheia de uma rolagem do próprio jogador.
3. **Retenção semanal observada:** coorte da primeira atividade de produto
   disponível; retorno em semana posterior por criação, edição registrada,
   rolagem ou pedido de XP. Definir uma lista fixa de ações. Não usar
   `users.updated_at`, login ou ausência de registro como prova de uso/inatividade.
4. **Uso por família:** pessoas distintas e operações por família, com uma
   categoria explícita para dado não classificável.

Semanas seguem o fuso informado. Não classificar uma coorte como não retida
antes de encerrar a semana de observação. Mostrar denominadores, tamanho das
coortes, exclusões e histórico incompleto. Uma pessoa pode atuar como narrador
e jogador; as análises não são grupos mutuamente exclusivos.

O relatório não consegue medir `character_creation_started` nem tentativas
recusadas. Ações da auditoria são sucessos confirmados; não renomeá-las como
as tentativas do contrato antigo. Sem ler `payload`, não prometer recorte
histórico por modo de criação que só esteja nessa coluna. A configuração
atual da ficha também não prova o modo que valia no passado.

A 5a não envia dados a outro provedor nem introduz rastreamento novo no app.
Isso não é uma conclusão de que uso interno dispensa cuidados de privacidade:
manter acesso restrito e saída agregada; não condicionar esta entrega à tela
de consentimento específica da futura integração com PostHog.

### Testes e pronto quando

Usar banco descartável e fixtures pequenas, com resultados esperados:

- Uma pessoa narrando e outra jogando, operações repetidas, duas crônicas e
  fichas distintas, para detectar joins que multiplicam linhas.
- Submissão `pending`, criação livre com `/ready`, ativação pelo narrador,
  convite reaberto sem nova entrada, NPC e rolagem local ausente do banco.
- Exclusão/anonimização, remoção de membro, reentrada e autoria nula, sem
  afirmar que o passado perdido foi recuperado.
- Datas nos limites do período, virada de semana e coorte ainda imatura.
- Role sem acesso a colunas sensíveis; tentativa de escrita recusada;
  saída sem ids ou conteúdo, inclusive no erro.

**Pronto quando:** o comando gera relatório reproduzível, concilia com a fixture
e pode ser executado com leitura restrita, sem rede externa além do banco.
Documentar o custo observado e reestimar caso as consultas exijam mudanças de
schema ou índices; não criar essas mudanças antecipadamente.

### Estado (05/11/2026)

Implementado em `scripts/metrics-funnel.ts`, com `pnpm metrics:funnel` e os
testes em `apps/api/src/__tests__/metrics-funnel.test.ts` (PGLite, rodam no
`pnpm test:api`). O que ficou definido na implementação:

- **Role:** `scripts/metrics-role.sql` dá `select` só nas colunas de
  `ALLOWED_COLUMNS` e nenhuma escrita. O role é criado por SQL (no Neon, um
  role do Console entra no `neon_superuser`). Antes de consultar, o script
  confere o role pelo catálogo e se recusa a rodar se ele ler qualquer coluna
  fora da lista, se faltar uma dela ou se puder escrever: a credencial da API
  é recusada, sem fallback. O teste aplica o mesmo arquivo e roda o relatório
  com esse role.
- **Transação:** `set transaction isolation level repeatable read, read only`
  explícito e conferido (o driver do PGLite ignora o modo do builder do
  Kysely), `statement_timeout` local (`--timeout-ms`, 30 s), pool de uma
  conexão fechado também no erro. O erro sai só com o código do Postgres.
- **Período e janela:** nada depois de `to`, ou da extração se `to` ainda não
  chegou, entra em conta; o relatório avisa período aberto. Os dois funis usam
  a janela `--window-days` (7) a partir do cadastro ou da entrada, e mostram
  também só quem já fechou a janela.
- **Narrador:** o convite conta quando é da mesma pessoa, numa crônica que ela
  criou, depois de criá-la.
- **Jogador:** unidade é o vínculo existente (pessoa × crônica); PC criado
  depois da entrada; envio/aviso é etapa opcional, e a ativação direta é
  contada à parte; ativação pelo dono ou por outra pessoa; rolagem do próprio
  dono depois da ativação, separada de “só rolagem de outra pessoa”. Vínculo
  criado pela transferência de narração (`chronicle.transfer.accept` no mesmo
  minuto da entrada) é excluído e contado.
- **Retenção:** semanas de segunda a domingo no fuso; atividade é a lista
  fixa `AUDIT_ACTIVITY`, PC criado, edição (`character_batches`) e rolagem
  registrada (inclusive NPC e parada livre). Só semanas encerradas aparecem.
- **Família:** crônicas, convites, PCs, edições de PC, rolagens de PC, paradas
  livres e pedidos de XP, com `(não classificável)` para família nula.

- **Cobertura:** o relatório diz a data do primeiro `chronicle.create` e
  `invite.create` na auditoria. Antes dela, o zero do funil do narrador é
  falta de registro, não medida (no banco do seed, de 18 a 24/10, não há
  nenhum: a instrumentação é de 02/11).

Conferido em Postgres 16 local (driver `pg`, role criado por SQL e
`metrics-role.sql` aplicado): os números batem com consultas diretas; a URL
administrativa é recusada; o role não lê `users.email` nem
`chronicle_audit.payload`; o `delete` cai na transação somente leitura; senha
errada sai só com `28P01`; o JSON não tem UUID. Custo observado com os dados do
seed (11 contas, 38 fichas, 81 lotes): cerca de 0,1 s por execução, já contando
a inicialização do Bun.

Pendente: rodar no Neon do deploy de teste com o role e registrar o custo com
os dados de lá (inclusive o tempo de acordar a compute). Sem índice ou mudança
de schema antes disso.

## 3. Gatilho e prova da Fase 5b

Iniciar a 5b quando houver necessidade concreta de painel contínuo, abandono
antes de salvar, comparação de coortes que o histórico atual não sustenta ou
análise frequente que justifique o serviço. Abrir o app ao público é ocasião
para reavaliar, não obrigação de instalar analytics.

Antes de instrumentar, provar o transporte em uma conta sintética na UE:

- Adaptador HTTP pequeno em `apps/api/src/analytics/posthog.ts`, usando o
  `fetch` do Bun, com dependência injetável. Não é necessário instalar SDK.
- Testar ingestão, perfil com id opaco, exclusão de pessoa/eventos, timeout,
  falha e duplicação. Validar o contrato realmente aceito pelo provedor.
- Capturar o corpo serializado e conferir o filtro com valores canário.
- Medir se o envio é independente da resposta da ação e se a fila em memória
  fica limitada. Confirmar o comportamento no bundle do deploy.

A [API oficial de captura](https://posthog.com/docs/api/capture) aceita eventos
por HTTP usando token do projeto. Validar o endpoint regional e os campos de
identidade/perfil no teste real; não copiar propriedades de um SDK de browser.
Toda dependência nova, se necessária, segue versão exata e idade mínima de
14 dias do `pnpm-workspace.yaml`.

## 4. Consentimento, aviso e identidade na 5b

Proposta: **opt-in por conta**, sem caixa pré-marcada e sem impedir qualquer
funcionalidade. Ausência de escolha ou de versão válida do aviso significa
coleta externa desligada. A base legal continua sendo decisão do responsável
pelo produto, antes de ativar a 5b; esta proposta não a registra como já decidida.

Criar `/privacy` público, com links em login, cadastro e Conta: finalidade,
categorias enviadas, PostHog/região, retenção configurada, como desligar e pedir
exclusão. Distinguir diagnóstico técnico do Sentry e analytics de produto.
Usar contato e condições reais, sem inventar dados do responsável.

Persistir em migration após a última disponível, hoje `0023_templates_onda4.ts`:

| Tabela proposta | Conteúdo |
|---|---|
| `user_analytics_preferences` | `user_id` único com FK em cascata, escolha, versão do aviso, horário e geração da preferência; `analytics_id` UUID aleatório criado na primeira concessão, sem nome/e-mail. |
| `analytics_deletions` | Id da tarefa, `analytics_id`, estado, tentativas e horários. Não cai em cascata com `users`; sem conteúdo de ficha ou corpo de erro externo. |

`GET /me/analytics` e `PATCH /me/analytics` leem/alteram somente a escolha da
própria conta autenticada. O id PostHog fica no servidor e não precisa ir ao
frontend. O servidor escolhe identidade e horários; o cliente não os fornece.

Em Conta, mostrar “Compartilhar dados de uso”, desligado inicialmente, com
estado de salvamento/erro e link ao aviso. Concessão só vale após confirmação
no servidor. Ao desligar, bloquear eventos locais imediatamente e salvar a
revogação; se estiver offline, mostrar que ela ainda não foi confirmada, sem
prometer bloqueio dos eventos de outros aparelhos. Persistir a pendência local
por usuário para sobreviver a reload e reenviar ao recuperar a rede.

Após o commit da revogação, o servidor descarta novos envios e tarefas em memória
com geração antiga, independentemente da aba ou da versão do app. Conferir a
preferência **no despacho**, não só quando o evento foi produzido. Requisições
já admitidas/em voo não podem ser recolhidas; coordená-las com a exclusão (§7).
Não há revalidação periódica nem canal próprio de consentimento entre abas.

Para medir cadastro, permitir escolha opcional no formulário antes do envio;
persisti-la na transação do cadastro e só então produzir `signup_completed`.
Clientes antigos continuam criando conta com coleta desligada. Quem concede
permissão depois não gera eventos retroativos. Atualizar contrato de cadastro,
`Session.register` e testes; nenhuma identidade PostHog entra na sessão do app.

## 5. Coletor, filtro e entrega na 5b

### Eventos de negócio no servidor

Adicionar chamadas explícitas nos serviços/rotas que confirmam as operações.
Capturar o resultado da transação e produzir evento somente depois do commit,
para operação nova. Não exportar `chronicle_audit` inteira nem usá-la como fila:
o payload e o objetivo da auditoria são diferentes dos de analytics.

Uma fachada `apps/api/src/analytics/index.ts` recebe um contrato tipado; o
adaptador remonta o payload por lista fechada e faz o envio. Nenhuma rota chama
o PostHog diretamente. `createApp` recebe uma implementação injetável, sem
rede por padrão em testes; `server.ts` liga a implementação real.

A fila é limitada, apenas em memória, com timeout e concorrência pequena.
Começar sem retry automático de captura e sem outbox de eventos de produto.
Ao lotar, falhar ou reiniciar, descartar o evento; não atrasar a resposta,
falhar a transação de negócio ou reenviar auditoria para compensar a perda.
Isso é entrega de melhor esforço, não contagem exata. Se retries forem
adicionados depois, comprovar a deduplicação do provedor com id técnico estável.

### Acontecimentos exclusivos do cliente

Criar `POST /me/analytics/events`, autenticado, com schema fechado, limite de
corpo e rate limit por usuário. Aceitar apenas `character_creation_started` e,
se houver pergunta de produto que justifique, `screen_viewed`. Proibir nomes
de eventos de negócio, ids de pessoa/ficha/crônica, timestamps arbitrários,
propriedades extras e texto livre.

O servidor verifica existência da conta e consentimento vigente, resolve a
identidade e reconstrói o evento. Entrada inválida é 4xx; entrada válida sem
concessão é descartada sem encaminhamento. A API não confia na versão do app
ou no pedido do cliente para autorizar a coleta.

`lib/analytics.web.ts` faz a chamada à própria API pela infraestrutura HTTP
existente; `lib/analytics.ts` fica sem efeito no nativo até a Fase 8. O app não
manda `identify`, token de ingestão ou ids PostHog. Na troca de usuário/logout,
descartar chamadas locais ainda não iniciadas; não guardar eventos offline.

### Lista de saída permitida

- Evento e propriedades por enum/booleano, conforme §6. `system_family`:
  `wod`, `d20`, `brp`, `fate`, fallback `other`; `mode`: `points`, `free`, `none`.
- Somente identidade opaca autorizada, horário do servidor, versão do contrato,
  release da API e metadados técnicos indispensáveis comprovados na etapa 0.
  `clientVersion`, se necessário, vem do parser já existente; não inventar
  plataforma a partir de header arbitrário.
- Sem corpo da requisição, resultado SQL, `payload` da auditoria, `$set`, URL,
  query/hash, referrer, nome, e-mail, token/cookie, nota ou conteúdo de rolagem.
- Para telas, allowlist de templates obtidos de `useSegments`; retirar grupos
  e parâmetros, sem pathname real ou `useLocalSearchParams`. Uma captura por
  transição, sem repetição por render.
- Não encaminhar IP do usuário, `Forwarded`, `X-Forwarded-For` ou headers do
  pedido. O PostHog recebe a conexão do servidor. Desligar retenção de IP e
  enriquecimento GeoIP do projeto, inclusive para evitar localização do servidor
  como dimensão de produto. Conferir conforme a
  [documentação de privacidade](https://posthog.com/docs/privacy/data-collection#ip-data-capture).

Nenhum SDK, script remoto, replay, autocapture, flag, survey, erro ou log pelo
PostHog. Não são necessárias mudanças de CSP ou de CORS para o provedor.

## 6. Eventos e atribuição corretos na 5b

Os eventos abaixo representam operações **confirmadas**, com exceção da
abertura de criação e da navegação opcionais, declaradas pelo cliente.
A tentativa de envio do contrato anterior foi removida: não confundir com
uma submissão aceita que já está na auditoria.

| Evento | Origem e condição | Propriedades |
|---|---|---|
| `signup_completed` | Cadastro novo com concessão persistida antes do commit, em `auth/routes.ts`. | — |
| `chronicle_created` | Crônica nova, `duplicate: false`, em `chronicles/routes.ts`. | `system_family` |
| `invite_created` | Convite novo confirmado, sem código/link como propriedade. | — |
| `invite_accepted` | Somente inserção nova de `chronicle_members`; membro existente ou narrador não geram evento. Acrescentar `joined: boolean` à resposta para tornar a distinção explícita e testável. | — |
| `character_creation_started` | Formulário de PC utilizável no cliente, modelo e regras carregados; uma vez por abertura. Sem evento para NPC. | `system_family`, `mode` |
| `character_creation_submitted` | `/creation/complete` confirmado com estado `pending`, operação nova; corresponde a `character.creation.submit`. | `system_family`, `mode` |
| `character_creation_ready` | `/creation/ready` confirmado, operação nova; aviso do dono na criação livre. Não é ativação. | `system_family`, `mode` |
| `character_creation_completed` | Ativação confirmada por `/creation/complete` com `active`, ou `/creation/approve`, operação nova. Não incluir resposta `pending`. | `system_family`, `mode` |
| `roll_made` | Nova rolagem persistida em `rolls/routes.ts`, sem replay ou NPC; incluir PC e rolagem livre do narrador. Não emitir para resultado local/offline. | `system_family`, `hidden` |
| `xp_request_created` | Novo pedido em `xp/requests.ts`, não grant/adjust nem replay. | — |
| `screen_viewed` (opcional) | Template permitido declarado pelo cliente. Só implementar se houver pergunta que precise de navegação. | `route` |

Submissão, aviso e ativação ficam sob a identidade **do dono do PC**, verificada
no servidor e com consentimento desse dono; a decisão do narrador não autoriza
coleta sobre outra pessoa. Não exportar id ou nome do narrador. A rolagem, o
convite e o pedido de XP ficam sob a identidade de quem executou a ação.
São escolhas de atribuição de produto, diferentes da autoria preservada na
auditoria. Não atribuir uma rolagem do narrador ao jogador.

Filtrar NPC nos eventos de negócio no servidor. No evento de abertura, o
frontend só emite para PC; sem receber id de ficha, o coletor não consegue
provar que a declaração corresponde a uma criação real de PC. Família e modo
declarados também não são autoritativos. Validar enums e limites, sem prometer
que eventos do cliente têm a mesma confiabilidade da operação persistida.

`hidden: true` indica rolagem oculta e hoje exige narrador; `false` pode ser
jogador **ou narrador**. Rolagem livre nasce oculta por padrão, mas pode ser
pública. Não usar `hidden` como substituto do papel do autor nem exportar
resultado, faces, label, dificuldade, preset, custo ou ficha.

### Refresh: diagnóstico técnico, fora do funil

Remover `session_refresh_failed` do contrato inicial PostHog. Em
`lib/session/session.ts`, 401/403 limpam a sessão; um evento enfileirado antes
da limpeza poderia ser cancelado pelo próprio logout. Na primeira abertura
pode nem haver identidade/preferência confirmada, e falta de rede não garante
um caminho de envio. Não resolver isso com flush antes de deslogar ou guardando
eventos de autenticação em disco.

Investigar com logs da API por template `/auth/refresh`, status, requestId e
versão do cliente, complementados por motivo categórico seguro quando
necessário. Revisar o que já existe antes de adicionar logs. Sem tokens,
cookies, hashes, identificação deduzida de token inválido ou mensagens cruas.
Falhas antes de chegar ao servidor permanecem uma lacuna; métricas locais da
Fase 7 podem complementá-las. O booleano e o single-flight de refresh não mudam.

## 7. Exclusão externa e coordenação com envios

Na transação existente de `DELETE /me`, inserir `analytics_deletions` para
quem recebeu id de analytics, mesmo que depois tenha revogado a coleta;
então apagar a conta. A tarefa sobrevive à cascata. Senha errada, bloqueio por
crônica ou rollback não criam tarefa. Não chamar o provedor na transação.

Após commit, o executor real ligado em `server.ts` tenta a remoção. Falha
externa não desfaz a exclusão nem transforma o 204 em erro. O aviso deve
explicar que a remoção externa é processada separadamente.

A [API de Persons](https://posthog.com/docs/api/persons) oferece remoção por
`distinct_ids`, com `delete_events: true` explícito. A operação é assíncrona;
202 não prova conclusão. Usar host administrativo `https://eu.posthog.com`,
chave com escopos mínimos `person:write`/`person:read`, conferir erros no corpo
e acompanhar `deletion_status`.

Coordenar captura e exclusão por identidade no processo atual:

1. No commit da exclusão, a conta/preferência deixa de autorizar novos eventos.
2. Descartar a fila dessa identidade e esperar o encerramento dos envios já
   admitidos antes de pedir a exclusão externa. Revogação também invalida a
   geração dos itens pendentes. Testar corrida entre despacho e commit.
3. Timeout de HTTP não prova que o provedor deixou de receber o evento.
   Manter a tarefa pendente de conferência se houve envio com resultado incerto;
   verificar ingestão tardia e repetir a remoção se necessário antes de encerrá-la.
4. Validar esse ordenamento com a conta sintética. Não prometer ausência de
   recriação só porque o envio migrou para o servidor. Se surgirem múltiplos
   processos emissores, substituir a coordenação local por mecanismo compartilhado
   antes de escalar; esse cenário não faz parte do deploy atual.

Não há segunda passagem fixa em 24 h: a conferência acompanha a conclusão e
as incertezas reais dos envios. A garantia é retomada e reconciliação da tarefa,
não prazo inventado de remoção do provedor.

Persistir tentativas, próximo horário e estado mínimo; retomar no start, após
exclusão e por comando operacional. Enquanto houver pendência, backoff com
intervalo de consulta ao banco de pelo menos uma hora, respeitando
`Retry-After`; sem pendências, parar. Sem claim distribuído antecipado: um
executor no processo atual, com estado retomável após crash. 401/403 deixam
pendência visível e pedem correção de configuração, sem loop rápido.

Não registrar corpo externo, credencial ou id opaco no Sentry. Após conclusão
verificada, remover o vínculo da tarefa com a identidade e guardar somente
mínimo operacional sem ligação à pessoa. Definir prazo das pendências no aviso.

## 8. Configuração, testes e entrega da 5b

### Configuração

Todas as variáveis da integração são da API, opcionais e vazias por padrão:
`POSTHOG_PROJECT_TOKEN`, `POSTHOG_PROJECT_ID` e `POSTHOG_PERSONAL_API_KEY`.
O token do projeto habilita captura; as outras duas permitem a remoção externa.
Não ativar captura sem mecanismo de exclusão funcional. Remover o token de
captura não deve impedir processar tarefas de exclusão já existentes.

Atualizar `packages/config/src/env.ts`, `.env.example`, testes e `render.yaml`.
Credenciais só no runtime, nunca `EXPO_PUBLIC_*`, `ARG` ou bundle do frontend.
Fixar host de ingestão UE no adaptador e host administrativo no executor.
Não aceitar destino arbitrário nem encaminhar headers do cliente.
Desenvolvimento, testes e E2E não enviam para conta real, mesmo com ambiente
herdado; integração automática usa transporte falso e habilitação explícita.

### Verificação

| Camada | Evidência |
|---|---|
| Operações de negócio | Commit novo gera evento; rollback, erro e `duplicate` não geram. Falha de envio não altera sucesso da operação. |
| Convites | Entrada nova gera `joined: true` e um evento; membro/narrador recebem `joined: false`, sem evento; concorrência não duplica entrada. |
| Atribuição | Ativação pelo narrador usa apenas id opaco e consentimento do dono; rolagem continua com autor; NPC não gera evento de negócio. |
| Consentimento | Ausente/negado/aviso inválido bloqueiam; revogar descarta fila antiga; despacho relê preferência; conta excluída e cliente antigo não burlam o coletor. |
| Coletor de cliente | Autenticação, schema, tamanho, rate limit, tentativa de forjar evento de negócio, troca de conta e nenhuma fila offline. |
| Canário de transporte | Provar primeiro envio permitido; depois inspecionar corpos/URLs serializados com e-mail, JWT, Bearer, cookie, convite, nota, ids de ficha/crônica e dados de rolagem marcados. Nenhum sai. |
| Exclusão | Tarefa sobrevive ao DELETE; falha/reinício são retomados; 202 com erro não conclui; envio concorrente, timeout incerto e ingestão tardia não encerram tarefa prematuramente. |
| Bundle e E2E | Nenhum SDK, token ou domínio PostHog no frontend; CSP preservada; escolha em Conta/cadastro e chamadas somente para API; todo transporte externo é falso no E2E. |

Executar testes focados de API, script e frontend; depois `pnpm typecheck`,
`pnpm lint`, `pnpm test:api`, testes do frontend e `pnpm check:native`, além
do E2E com banco descartável. Testar a migration up/down pelos checks existentes.
Não executar essas suítes só por editar este documento.

### PRs, ativação e rollback

| Entrega | Conteúdo | Estimativa inicial |
|---|---|---|
| 5a | Script, permissões documentadas, fixtures e definições do relatório | 0,5–1 dia |
| 5b.0 | Prova de ingestão, identificação e exclusão na conta sintética | 0,5 dia |
| 5b.1 | Preferência, aviso, cadastro opcional e exclusão persistida | 1–2 dias |
| 5b.2 | Adaptador, contrato, operações do servidor e coletor do cliente | 1–1,5 dia |
| 5b.3 | Corridas, canário, E2E e conferência dos painéis | 0,5–1 dia |

A 5b fica desligada até fechar todos os requisitos. As estimativas não incluem
criação da conta, definição do aviso ou mudança para múltiplos emissores;
reestimar após a prova. O escopo anterior com SDK direto e controlador entre
abas deixa de ser estimado ou implementado.

**Pronto para ativar a 5b quando:** escolha de privacidade definida, aviso
publicado, ingestão e exclusão reais conferidas em conta sintética, canário e
checks passando, revogação/atribuição testadas e credenciais só no servidor.
O PostHog conta a partir da ativação e apenas quem autorizou; não importar
retroativamente a auditoria. Validar cotas e retenção na contratação.

Manter funis separados de narrador e jogador. No PostHog, sem ids de domínio,
o funil é por pessoa e pode combinar fichas/crônicas distintas; a correlação
por entidade fica no relatório restrito da 5a. Coortes novas não substituem
os dados históricos disponíveis e incompletos do banco.

Na primeira semana, conferir volume, perdas de envio e pendências de exclusão.
Rollback: retirar token de captura do runtime, parar/descartar a fila e manter
credencial administrativa e tarefas até concluir remoções. Como nenhum cliente
conhece o token, não há export antigo enviando diretamente ao PostHog.

Na Fase 8, habilitar a fachada nativa para o mesmo coletor autenticado somente
se a 5b estiver ativa. Eventos já produzidos pela API atendem web e nativo;
não instalar um SDK que volte a duplicá-los ou contorne consentimento/exclusão.
