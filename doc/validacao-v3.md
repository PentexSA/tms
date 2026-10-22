# Validação do fechamento da v3

Data: 22/10/2026. PR: [#31](https://github.com/PentexSA/tms/pull/31).

## Código e contratos

| Verificação local | Resultado |
|---|---|
| Build e TypeScript de todos os pacotes | Passou |
| Biome e proibição de nomes de sistemas no código do produto | Passou |
| Templates, personagens de exemplo, arquivos de design gerados e contraste | Passou |
| Core, com cobertura | 772 testes passaram |
| API em PGLite | 912 testes passaram |
| App, com cobertura | 574 testes passaram |
| UI, com cobertura | 91 testes passaram |
| Banco, com cobertura | 21 testes passaram |
| Operações em Postgres real | 5 cenários passaram, incluindo recuperação concorrente |
| Suíte completa Playwright no WebKit | 24 testes passaram |

A suíte exigida pelo hook de envio também passou sem desativar hooks. O
WebKit local rodou em Ubuntu 22.04 pelo Docker, com o mesmo export do app;
o host Ubuntu 20.04 não tem as bibliotecas exigidas pelo navegador.

O CI do PR executa novamente cobertura, auditoria, design, migrations
up/down/up, geração dos tipos Kysely, publicação dos templates em banco
descartável, os cinco arquivos de concorrência em Postgres e os 48 testes
Playwright em Chromium e WebKit. O resultado final fica no próprio PR.

O job web usa o arquivo oficial do Ubuntu para instalar as bibliotecas dos
navegadores. Na primeira rodada, o espelho Azure do runner repetiu downloads
e consumiu mais de 19 minutos antes do cancelamento pela atualização do PR;
a troca de endereço mantém os pacotes e suas assinaturas, inclusive nos arquivos `apt-mirrors*.txt` usados pelo runner.

## Android

Ambiente preparado para o teste nativo: Android Emulator com KVM, imagem
Google APIs Android 15/API 35, SDK de compilação 36, Java 17 e Maestro 2.11.0.
O binário inclui `expo-sqlite` com `useSQLCipher: true`. A API de teste usa
um banco descartável, uma conta de teste, três crônicas e quatro fichas.

A rodada nativa detectou os avisos de Desfazer encobertos pela janela do modal. O `ToastProvider` agora apresenta o aviso no modal superior e o devolve à raiz ao fechar, preservando a ação, o tempo e o anúncio de acessibilidade. Dois testes cobrem a troca de camada e os modais sobrepostos. O fluxo offline também inicia o processo diretamente pelo link da ficha para conferir o reinício sem rede.

Os sete fluxos estão em `apps/frontend/.maestro`. O fluxo 07 inclui dano em
duas fichas, Desfazer, Nova noite com prévia e Desfazer novamente.

## Limite acordado

A execução em iOS fica pendente por decisão do usuário neste fechamento.
Este ambiente é Linux e não tem Xcode, simulador iOS ou Mac conectado.
Os fluxos compartilhados continuam disponíveis para a rodada em iOS; o
fluxo de modo avião permanece específico do Android.
