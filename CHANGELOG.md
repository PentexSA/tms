# Changelog

Principais mudanças do TMS, em ordem da versão mais recente para a mais antiga.
O histórico inicial foi consolidado a partir dos commits e das tags do repositório.
As datas seguem o formato `AAAA-MM-DD`.

Ao implementar uma mudança relevante, registre-a em **Não lançado**, nas categorias
Adicionado, Alterado, Corrigido ou Segurança. Ao publicar uma versão, mova essas
entradas para uma seção com a versão e a data do lançamento.

## Não lançado

### Alterado

- Documentação de observabilidade com a ordem das próximas entregas e o planejamento das medidas de tempo e toques na criação de ficha.

### Corrigido

- Limpeza dos timers de validade do convite e de coleta de lixo do QueryClient nos testes, permitindo que o Jest encerre após a execução.

## [1.4.0] - 2026-11-06

### Adicionado

- Convites por link, com continuidade pelo login ou cadastro, compartilhamento e confirmação antes de revogar.
- Progresso da criação nos cartões da Mesa, filtros de fichas em criação e pendentes e contagem na lista de crônicas.
- Apresentação da crônica com tela de leitura completa e campo História / Prelúdio nos três sistemas.
- Revelação e ocultação de notas do narrador para o dono da ficha, com controle de acesso na API.
- Lista de evolução agrupada pelo modelo da ficha, com busca, indicação de custo e atalho a partir do traço.
- Entrada numérica direta para conceder e ajustar XP.

### Alterado

- Painel de criação de fichas e cabeçalho do narrador recolhidos para facilitar o acesso às abas.
- Mensagens de login, cadastro, convite e ações bloqueadas com motivos mais claros.
- Templates de Vampiro V20, Lobisomem W20 e Mago M20 atualizados para `1.10.0`, `1.8.0` e `1.8.0`, respectivamente.

### Corrigido

- Custo e estado dos pedidos de evolução, valores efetivos no Histórico e reversão de operações desfeitas.
- Navegação de volta, restauração da rolagem e avisos dentro das folhas e acima dos controles de jogo.
- Ocultação de notas já abertas após mudança de visibilidade e atualização da ficha em cache após revelar.
- Recriação da Activity no Android ao alterar o tamanho da tela ou da fonte.

### Segurança

- Telemetria remove códigos de convite e fragmentos de URL.
- Ex-membros deixam de receber a descrição e a imagem da crônica; a revelação de notas termina com o vínculo ou a narração.
- Tolerância de 30 segundos para o refresh token anterior durante a renovação da sessão.

## [1.3.0] - 2026-11-05

### Adicionado

- Guia “O que falta” e aba Pontos, com navegação até o grupo que precisa de ajuste na criação.
- Ajuda contextual em campos, grupos e itens, com recomendações por clã e Tradição.
- Catálogo de Dons, resumo da Fraqueza do clã e campo opcional de Casa ou subgrupo para Mago.
- Relatório local de funis e retenção sobre dados existentes, pelo comando `pnpm metrics:funnel`.
- Envio dos logs da API ao Sentry com seleção explícita dos campos permitidos.

### Alterado

- Controles de valor diretamente nas linhas dos itens, com previsão do efeito de aumentar ou diminuir.
- Orientações da criação e apresentação dos pontos de bônus, incluindo aviso na primeira passagem para essa etapa.
- Templates de Vampiro V20, Lobisomem W20 e Mago M20 atualizados para `1.9.0`, `1.7.0` e `1.7.0`, respectivamente.
- Pipeline de CI deixa de executar builds nativos e o job de PostgreSQL real.

### Corrigido

- Valores iniciais e derivados sobre o rascunho, remoção de alterações ao retornar ao valor de partida e limites dos controles de criação.
- Foco, rolagem entre abas e anúncios de acessibilidade do guia de criação.

## [1.2.2] - 2026-11-04

### Adicionado

- Captura de erros da API e da versão web no Sentry, com filtragem de dados e testes de privacidade.
- Publicação de source maps no build do Render para investigar erros da versão web.
- Identificador `x-request-id` nas respostas da API e código do erro apresentado no app em falhas 5xx.

### Alterado

- Logs com horário ISO, versão e serviço; consultas lentas registradas no nível de aviso.
- Registro de erros 500 com stack filtrado e envio da versão do app nas requisições à API.

### Corrigido

- Preservação dos debug IDs nos eventos web para permitir a resolução dos stacks pelos source maps.

## [1.2.1] - 2026-11-03

### Corrigido

- Roteamento de `/health` no deploy para que a requisição seja sempre encaminhada à API.

## [1.2.0] - 2026-11-02

### Adicionado

- Rascunhos persistidos por usuário e ficha, com recuperação, aviso de alterações pendentes e resolução de conflitos por campo.
- Ações separadas de salvar e concluir a criação, além de “Salvar e sair”.
- Pedido de ajuste com motivo pelo narrador e aviso de “terminei” na criação livre.
- Estado e próximo passo da ficha na lista, na crônica, na Mesa e no Histórico.
- Extrato de pontos de bônus e prévia dos custos e motivos de recusa durante a criação.

### Alterado

- Mesa em grade nas telas largas, seleção com barra fixa e identificação de quem alterou a ficha.
- Histórico e auditoria com frases legíveis e registro das etapas da criação.
- Layout de fichas, folhas e navegação adaptado a telas estreitas e ao teclado.
- Acessibilidade de abas, controles e diálogos, com navegação por teclado, restauração de foco e alvos mínimos de toque no Android.
- Datas do banco convertidas para `timestamptz` e tratamento de datas civis de sessões sem deslocamento de fuso.

### Corrigido

- Duplicação de criação de fichas e crônicas em tentativas repetidas, com idempotência na API.
- Atualização das listas ao voltar à tela e ao puxar para atualizar, preservando aba e posição de rolagem da crônica.
- Confirmação de revelação de NPCs, indicação de notas privadas e navegação de fichas reveladas.

### Segurança

- Respostas da API e cache HTTP nativo com proteção contra persistência indevida de dados.
- Encerramento de sessão, revogação pendente sem rede e isolamento de dados entre usuários reforçados.
- Tratamento do IP do cliente sem confiar em cabeçalhos enviados diretamente por ele.

## [1.1.0] - 2026-10-31

### Adicionado

- Aba Orçamento na criação, seleção de prioridade por grupo e bloqueio dos limites de distribuição.
- Comando `pnpm backend` para iniciar PostgreSQL, migrations, API e túnel.

### Alterado

- Layout das regras de criação da crônica, revisão pelo narrador e visibilidade do menu em telas largas.
- Pipeline de testes com jobs em paralelo, testes E2E por navegador e execução local limitada aos pacotes afetados no pre-push.

### Corrigido

- Confirmação ao sair da ficha com alterações no rascunho.
- Compatibilidade dos ícones SVG com as propriedades de acessibilidade.

### Segurança

- Atualização de dependências para corrigir vulnerabilidades críticas e altas apontadas pelo `pnpm audit`.

## [1.0.0] - 2026-10-30

### Adicionado

- Base do gerenciador com autenticação, crônicas, convites e fichas de personagem.
- Motor de fichas orientado por templates e suporte a Vampiro V20, Mago M20 e Lobisomem W20.
- Criação livre e por pontos, aprovação pelo narrador, experiência e pedidos de evolução.
- Mesa do narrador com estados de ficha, alertas, operações em grupo e recuperações por período.
- NPCs, Bastidores, rolagens e controles de visibilidade por papel.
- Interface para web e dispositivos móveis com Expo, componentes compartilhados e testes automatizados.
- Deploy de teste no Render com PostgreSQL no Neon e fluxo de publicação por versões.

[1.4.0]: https://github.com/PentexSA/tms/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/PentexSA/tms/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/PentexSA/tms/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/PentexSA/tms/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/PentexSA/tms/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/PentexSA/tms/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/PentexSA/tms/releases/tag/v1.0.0
