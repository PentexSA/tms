# P12 · Convite, entrada e navegação: plano de implementação

> Plano · 2026-11-05 · base conferida: `onda/5-narrador-entrada-uso` em `05c5d7d`

Pacote [P12 da matriz de achados](../testes/2026-11-01/matriz-achados.md#p12): onda 5 (Narrador, entrada, uso e documentação), correção, pré-requisito P06 (mergeado na onda 1). Aplica a decisão D-14 (convite por link) às linhas T-43, T-44 e T-45. Ao fim do pacote:

- o narrador gera um convite e manda um **link** (`https://<origem do web>/join#<código>`) com uma mensagem pronta. Quem abre o link cai em "Entrar com convite" já preenchido, com ou sem sessão (sem sessão, passa pelo login ou pelo cadastro e volta ao convite). O app trata o mesmo convite por `tms://join#<código>`;
- o código vai só no fragmento `#`. Depois de lido, sai da URL e do histórico do navegador. Ele não chega ao Sentry, aos logs da API, ao breadcrumb de navegação nem ao `Referer`;
- "Copiar link" responde dentro da folha ("Copiado ✓", anunciado). No web, o aviso do toast passa a aparecer acima da folha, e os toasts sobem acima do dock e do aviso de bônus;
- "Compartilhar" funciona em qualquer navegador: sem Web Share API, o botão vira "Copiar mensagem", sem erro não tratado;
- "Revogar" pede confirmação, com o foco nela e de volta no gatilho. Cada convite ativo mostra o número, o dia e a hora;
- o "‹" de Nova ficha, Entrar com convite e Nova crônica sempre sai, também depois de F5 ou de um link direto; o achado 6 da onda 3 (três "voltar" para sair da crônica) é investigado e corrigido junto;
- "Criar crônica" e "Entrar com convite" ficam no topo da lista;
- cadastro, login e convite dão mensagens com forma (maiúscula, ponto e próximo passo), que continuam genéricas contra enumeração;
- remover um jogador diz "foi removido", a lista diz "Nenhum jogador agora" e a ficha arquivada mostra o selo.

É um pacote de correção. Não remove campo, não muda regra do jogo e não afrouxa limite:

- o uso limitado (padrão 10, de 1 a 50), a validade (padrão 7 dias, de 1 a 30) e o limite de aceites (10 a cada 15 min por conta e por IP) continuam como o P02 deixou (`apps/api/src/options.ts:63-67`; `apps/api/src/chronicles/routes.ts:557-608` e `:700-766`);
- a resposta do aceite continua a mesma para convite inexistente, revogado, expirado ou esgotado (`routes.ts:732-739`), e o código continua guardado só como hash (`apps/api/src/chronicles/invite-code.ts:3-4`, `routes.ts:572`);
- o servidor continua a autoridade: o app só preenche o campo, e quem aceita, recusa e conta os usos é a API.

O pacote **muda a API pública do `@tms/ui`** (o aviso dentro da folha também no web, o deslocamento acima do rodapé da folha e o `ref` do `Button`) e **acrescenta um campo à resposta de `GET /chronicles/:id/invites`** (`number`, seção 3.9). Ele não muda template, `schema.json`, `@tms/sheet-core` nem migration.

Todas as linhas citadas são da ponta da onda 5 (`05c5d7d`). A matriz cita o `1db3db9`, de antes das ondas 1 a 4. A seção 3 diz onde a causa provável dela está errada.

| Documento | Papel |
|---|---|
| [matriz-achados.md](../testes/2026-11-01/matriz-achados.md): legenda, "Ondas e pacotes", "Decisões de produto" (D-14), "Como executar", "Onda 5" e §P12 (T-30, T-43, T-44, T-45, T-51, T-73, T-82) | Itens, decisão, "PR local" e critério de saída |
| [relatorio-usabilidade.md](../testes/2026-11-01/relatorio-usabilidade.md) §1 (C1, C5) e a R-30 (l.442) | A recomendação do convite que leva à crônica |
| [relatorio-tecnico.md](../testes/2026-11-01/relatorio-tecnico.md) §3 (cobertura do convite, l.43) e S-04 (l.154: o limite de aceites do seed) | O que o QA viu e o limite que o roteiro respeita |
| Notas: [narrador-web](../testes/2026-11-01/notas/narrador-web.md) (NW-05 a NW-09), [narrador-app](../testes/2026-11-01/notas/narrador-app.md) (NA-04 a NA-06), [iniciante-web](../testes/2026-11-01/notas/iniciante-web.md) (IW-12, IW-14, IW-18), [iniciante-app](../testes/2026-11-01/notas/iniciante-app.md) (IA-11, IA-25, IA-26), [qa-web](../testes/2026-11-01/notas/qa-web.md) (QAW-07, QAW-12), [qa-app](../testes/2026-11-01/notas/qa-app.md) (QAA-27), [po-app](../testes/2026-11-01/notas/po-app.md) (POA-34, POA-44) e o diário do [po-web](../testes/2026-11-01/notas/po-web.md) (13:14) | Cenários do critério de pronto (§7) e do roteiro (§11) |
| [plano-v0.md](../plano-v0.md) Etapa 10 e [plano-v3.md](../plano-v3.md) Etapa 7 | O convite como foi desenhado: código mostrado uma vez, hash no banco, usos e validade |
| [plano-observabilidade.md](../plano-observabilidade.md) Fases 3 e 4 | O que vai ao Sentry e aos logs, por lista de campos |
| [P02](P02-seguranca-sessao-api.md) §3.4 e §5 | O IP do rate limit, os limites de autenticação e de convite, que não mudam |
| [P06](P06-componentes-acessibilidade.md) e [P08](P08-layout-teclado.md) §3.14 | O `Toast`, a `BottomSheet` e o modelo da subseção "o que muda" |
| [P09-C](P09-C-narrador-mesa.md) (`useSheetBack`, `useToastOffset` na barra de seleção) | O padrão de "voltar" e de toast acima de barra fixa que este pacote estende |
| [onda-3.md](onda-3.md) §8 (pergunta 6) e §11 (achado 6); [onda-4.md](onda-4.md) §6 (tabela, linha do achado 6), §8 e §11 | O "três voltar", o `setParams` no web e as lições do roteiro |

## 1. Objetivo e itens

**Objetivo (matriz).** Convidar e entrar sem atrito: convite por link já preenchido (D-14), retorno visível ao copiar, compartilhar em qualquer navegador, revogar com confirmação, mensagens de cadastro claras, ações principais visíveis e "voltar" que sempre funciona.

| ID | Sev. | Em uma linha | Onde está (conferido na ponta) |
|---|---|---|---|
| T-30 | média | Depois de F5 ou link direto, o "‹" não faz nada (`GO_BACK` sem navegador que o trate) | `router.back()` sem `canGoBack()`: `apps/frontend/app/(app)/chronicles/[id]/new-character.tsx:75-78`, `app/(app)/join.tsx:34`, `app/(app)/chronicles/new.tsx:57`; também `apps/frontend/sheet/UnsupportedTemplate.tsx:74`. O "‹" da crônica usa `router.replace('/')` (`chronicles/[id]/index.tsx:137`), ligado ao achado 6 (seção 3.4) |
| T-43 | média | No web, o toast "Código copiado" fica atrás da folha; no app e no web, toasts cobrem o dock e o rodapé; o convite é só um código, sem link | O aviso dentro de modal é desligado no web: `packages/ui/src/Toast.tsx:182` (`active = visible && Platform.OS !== 'web'`), e o da raiz só aparece sem modal (`:163`). O dock e o aviso de bônus não registram `useToastOffset` (`apps/frontend/sheet/play/CombatDock.tsx:42-60`; `BonusNotice` em `sheet/creation/CreationPanel.tsx`). O convite: `apps/frontend/components/chronicles/InviteSheet.tsx:44-54`, `:70-92` |
| T-44 | média | Sem Web Share API, "Compartilhar" rejeita sem tratamento (`pageerror`) e não faz nada | `InviteSheet.tsx:51-54` chama `Share.share` sem `catch`; o react-native-web 0.21.4 rejeita com "Share is not supported in this browser" quando `navigator.share` não existe (`node_modules/react-native-web/dist/exports/Share/index.js`) |
| T-45 | média | "Revogar" age na hora; dois convites do mesmo dia são idênticos | `InviteSheet.tsx:104-118` (`revoke.mutate` direto no `onPress`, título só com `shortDate`). A API já devolve `createdAt` com a hora (`routes.ts:610-641`); o código só existe como hash |
| T-51 | média | "Criar crônica" e "Entrar com convite" no fim da lista | `apps/frontend/app/(app)/index.tsx:65-77` (os botões) e `:131` (`ListFooterComponent`). A matriz cita l.30–34, que hoje é o `chronicleMeta` |
| T-73 | baixa | Erros de campo não somem ao corrigir; regra do nome de usuário genérica; mensagens da API cruas | `apps/frontend/lib/validation.ts:23-24`; `app/(auth)/register.tsx:43-47` (recalcula só no envio); `app/(auth)/login.tsx:29-44` (sem validar o e-mail; `e.message` cru na l.40); `join.tsx:45-50` (`messageOf` cru). Textos da API: `apps/api/src/chronicles/routes.ts:26`, `apps/api/src/auth/routes.ts:150` e `:190`, `apps/api/src/http/on-error.ts:45` |
| T-82 | baixa | Depois de remover: "saiu da crônica", "Ninguém entrou ainda." e (no iOS de 01/11) sem selo "Arquivada"; no web, sem toast | `apps/frontend/components/chronicles/MemberSheets.tsx:42`; `chronicles/[id]/index.tsx:406-410`. O selo existe desde o P04-D (`components/chronicles/characterState.ts:100-101`) e a remoção já invalida as fichas (`lib/queries/chronicles.ts:116-117`, prefixo `['chronicles', id]`): parte do item provavelmente já está resolvida (seção 3.7) |
| achado 6 da onda 3 | — | No AVD, três "voltar" para sair da crônica depois da seleção da Mesa (não repetido) | Sem linha na matriz; entra pelo mesmo tipo do T-30 ([onda-4.md](onda-4.md) §6, tabela). Hipóteses na seção 3.4 |

## 2. Decisões aplicadas

| Decisão | O que diz | Como o código acomoda |
|---|---|---|
| D-14 (T-43, T-44, T-45; parte da R-30) | O convite vira um link que abre "Entrar com convite" já preenchido, com o código no fragmento `#` (o navegador não o envia ao servidor); uso limitado e validade continuam | Link `https://<web>/join#<código>`, lido **antes** do roteador e tirado da URL com `history.replaceState` (seção 3.1). No app, `tms://join#<código>` por `app/+native-intent.tsx`. O código fica só em memória até o aceite. A API do aceite não muda |

**O que o código mostra sobre a D-14** (apontado, não decidido):

1. **"Não chega a log de servidor nem de proxy" vale para a página, não para o aceite.** O fragmento não vai na requisição da página, mas o app lê o código e o manda no corpo do `POST /invites/accept`. Ele não chega aos logs porque a API não registra corpo (`apps/api/src/middlewares/loggerMiddleware.ts:5-8`, `:67-83`), e o log de query do banco não leva parâmetros (`packages/db/src/logger.ts:9-15`). O plano prende isso com testes (seção 4.1); a garantia não vem só do fragmento.
2. **"Abre já preenchido no app" depende do link que chega ao aparelho.** O app já registra o esquema `tms` (`apps/frontend/app.json`, `"scheme": "tms"`; o `AndroidManifest.xml` e o `Info.plist` gerados pelo prebuild têm o filtro). Os aplicativos de conversa, porém, não costumam transformar `tms://` em link tocável, e o link `https` abre o navegador, não o app: o projeto não tem App Links (Android) nem Universal Links (iOS). Com este plano, quem tem o app recebe o link `https` e entra pelo web, ou digita o código no app (a mensagem traz os dois). Abrir o app a partir do `https` é ponto para o PO (seção 9, pergunta 3), com custo de build nativo e de domínio.
3. **"Já preenchido" não quer dizer "aceito".** O plano não aceita sozinho: a tela abre preenchida, diz com que conta a pessoa vai entrar, e a pessoa toca "Entrar na crônica". Aceitar ao abrir um link faria qualquer link recebido pôr a pessoa numa crônica sem ela ver (seção 5).

**Fica fora, e com quem fica:**

- o progresso na Mesa, o painel de regras recolhido e o toast "Regras da criação salvas." sobre "Excluir crônica", as abas (iOS) e o primeiro participante (web 1280), casos citados no T-43: o P09-D (D-10) troca o painel por um resumo de uma linha depois de salvo, e esse resumo é o retorno do salvar. Se o P09-D mantiver o toast, ele continua sobre o conteúdo que rola (seção 3.1.h e 8.4);
- escolher validade e usos ao gerar (NA-06, parte do NW-09): a API já aceita `expiresInDays` e `maxUses` (`routes.ts:600-606`), mas a tela não os mostra. Nenhuma linha da matriz pede; fica para o PO;
- a revisão dos planos (D-13 registra a D-14 nos planos v0 e v3): é do P01-D, que entra por último.

**Pontos para o PO das ondas 1 a 4 que encostam aqui:** nenhum dos pontos abertos (onda-1.md §6 a onda-4.md §6) é deste pacote. O único item herdado é o achado 6 da onda 3, que a [onda-4.md](onda-4.md) §6 já pôs no P12.

## 3. Desenho por item

### 3.0 O que o código e as plataformas fazem hoje

- **O código do convite.** 128 bits aleatórios em base32 Crockford, 26 caracteres (`invite-code.ts:8-24`). O banco guarda o `sha256` do código normalizado (`:35-36`; `routes.ts:572`). Ele aparece uma vez, na resposta do `POST` (`routes.ts:592-598`). A auditoria registra só o id, os usos e a validade (`routes.ts:580-588`, T-63). O aceite normaliza caixa, espaço, hífen e O/I/L (`invite-code.ts:27-33`).
- **Os limites.** `invites`: 10 a cada 15 min, contados por conta e por IP **antes** de ler o código (`routes.ts:703-716`); toda tentativa conta, inclusive a inválida. Geração: só o narrador (`requireStoryteller`, `routes.ts:44-48`), sem rate limit. Revogação: só o narrador, presa à crônica (IDOR, `routes.ts:642-661`).
- **A folha "Convidar jogadores"** (`InviteSheet.tsx`). "Gerar convite" mostra o código formatado em grupos de 4 (`formatInviteCode`, `lib/queries/chronicles.ts:143-144`), "Copiar código" (`expo-clipboard` + toast) e "Compartilhar" (`Share.share` com o código no texto). A lista dos ativos mostra "Criado em dd/mm" e "N usos restantes · vale até dd/mm". O texto "vale 7 dias e até 10 pessoas" é fixo (`:73-74`), não vem da resposta.
- **O toast e a folha.** O `ToastProvider` desenha o aviso na raiz só quando não há modal registrado (`Toast.tsx:163`). Dentro de um modal, o `ModalToastHost` (`:178-198`, montado no painel da folha em `BottomSheet.tsx:294`) desenha o aviso, **mas só fora do web** (`:182`). No web, o `Modal` do react-native-web é um portal posterior à raiz, e o aviso da raiz fica embaixo dele. É a causa do NW-05 (`elementFromPoint` devolve a lista de convites). A exclusão do web veio do `00a6f29` ("manter Desfazer visível nos modais nativos"), que supôs a camada da raiz acima do modal no web.
- **Barras fixas.** Só a barra de seleção da Mesa ergue o aviso (`TableSelection.tsx:188`). O `CombatDock` (Jogo, celular) e o `BonusNotice` ficam embaixo da rolagem (`sheet/SheetView.tsx:510-513`) e não registram deslocamento, embora o DS diga "toast fixo acima do dock via `--dock-offset`" (`design/design-system/components.md:653`).
- **Sessão e rotas.** Tudo em `(app)` exige sessão: sem ela, `<Redirect href="/login" />` (`app/(app)/_layout.tsx:19`). O login e o cadastro vão para `/` (`login.tsx:38`, `register.tsx:56`), e o `(auth)/_layout.tsx:15` também redireciona para `/` quando a sessão entra. Hoje um código que chegasse pela URL se perderia no redirecionamento.
- **O fragmento no Expo Router 58.0.26.** O roteador põe o fragmento da URL inicial nos parâmetros da rota, na chave `'#'` (`node_modules/expo-router/build/fork/getStateFromPath-forks.js:382-387`). Sem tratamento, o código entraria no estado de navegação. No nativo, o `+native-intent` (`redirectSystemPath`) recebe a URL antes do roteador (`node_modules/expo-router/build/getLinkingConfig.js:65-110`); no web, esse arquivo não é chamado.
- **Telemetria e cabeçalhos.** O `scrubUrl` do app já tira query e fragmento de toda URL que vai ao Sentry (`apps/frontend/lib/telemetryFilter.ts:24-39`), e o breadcrumb só leva navegação e HTTP (`:117-147`). O `telemetry.web.ts` desliga o DOM, o console e o `urlQueryParams` (`:49-70`). O nativo não envia nada (`lib/telemetry.ts`). A API manda ao Sentry só os atributos da lista do `scrubLog` (`apps/api/src/telemetry.ts:109-180`), e o log de acesso leva só o caminho, sem corpo nem query. O web serve `Referrer-Policy: no-referrer` (`scripts/web-headers.mjs:64`), a API também (`apps/api/src/http/security.ts:11`), e o E2E confere (`e2e/tests/headers.spec.ts:25`).
- **Cache no aparelho.** O `persist.tsx` só grava templates e fichas (`persistable`, `lib/persist.tsx:63-75`) e nunca mutações (`shouldDehydrateMutation: () => false`, `:215`). O código do convite não vai para o disco hoje, e o plano mantém assim.

### 3.1 T-43 (D-14) · O convite vira link, "Copiado ✓" e o toast acima da folha

**Causa: confirmada, e diferente da matriz.** A matriz aponta `InviteSheet.tsx` l.49 e o `Toast.tsx` (estimado). A l.49 é só a chamada. A causa é o `Platform.OS !== 'web'` do `ModalToastHost` (`Toast.tsx:182`). Os toasts sobre o dock e o rodapé vêm de nenhuma barra fixa da ficha registrar o `useToastOffset`.

**a. O link.** Módulo novo `apps/frontend/lib/invite/link.ts`, puro e testável:

- `inviteLink(code, base)`: `` `${base}/join#${code}` ``, com o código cru, sem espaços. O `base` é a origem do web;
- `parseInviteFragment(hash)`: aceita só `#` seguido de 1 a 64 caracteres de `[0-9A-Za-z-]`, o mesmo teto do corpo do aceite (`routes.ts:765`). Qualquer outra coisa é ignorada (devolve `null`). Nada do fragmento vira caminho, rota ou parâmetro;
- a origem do web (`lib/env.ts`, ao lado do `API_URL`): no web, `location.origin`; no app, `EXPO_PUBLIC_WEB_URL` (`http`/`https`, como o `apiUrlOf`). Sem a variável, a origem do `EXPO_PUBLIC_API_URL`, que no deploy do Render é a mesma do web (`deploy/render/Caddyfile`: a API fica na raiz da mesma origem). Em desenvolvimento, o web é a 8081 e a API a 3001, então o roteiro exporta a variável (seção 11.a). O `.env.example` ganha a linha comentada, sem valor.

**b. A leitura no web, antes do roteador.** `apps/frontend/index.ts` passa a importar `./lib/invite/capture` **antes** de `expo-router/entry`, com um comentário que proíbe reordenar. O `capture.ts` é vazio no nativo e no Jest. O `capture.web.ts`:

1. se `location.pathname` é `/join` e o `location.hash` passa no `parseInviteFragment`, guarda o código na memória (item d);
2. chama `history.replaceState(history.state, '', '/join')` em toda URL `/join` com fragmento, válido ou não. A entrada do histórico passa a ser `/join`: o "voltar" e o "avançar" não trazem o código de volta;
3. faz isso **antes** do `initTelemetry` (que roda no `app/_layout.tsx:27`) e antes de o roteador ler a URL. Nenhum breadcrumb nasce com o fragmento, e o parâmetro `'#'` não entra no estado de navegação;
4. escuta `hashchange`: quem cola um link novo numa aba que já está no app (navegação no mesmo documento) passa pelo mesmo caminho, e a tela "Entrar com convite" recebe o código novo por assinatura.

Resta um efeito que o app não controla: o histórico global do navegador (a lista de páginas visitadas) pode guardar a URL original com o fragmento. Fica como risco residual na seção 5.

**c. A leitura no app.** `apps/frontend/app/+native-intent.tsx` (novo) exporta `redirectSystemPath({ path })`:

- `tms://join#<código>` (e `tms:///join#…`, e o link `https` da origem do web, se um dia houver App Links) → guarda o código na memória e devolve `/join`;
- qualquer outra URL → devolve o caminho **sem o fragmento**. O deep link nunca abre outra rota com o código, e o roteador nunca recebe o `'#'`;
- é síncrona, sem rede e sem log. Um erro de parse devolve `/`.

**d. O código em memória, sem disco.** `lib/invite/pending.ts` (novo): `setPendingInvite(code)`, `peekPendingInvite()`, `clearPendingInvite()` e uma assinatura (`subscribePendingInvite`):

- só em memória do processo: nada no `SecureStore`, no `SQLite`, no `IndexedDB`, no `sessionStorage` nem no cache do TanStack;
- vale 30 min. Sai no aceite com sucesso, no "‹" da tela de convite e no logout explícito (`session.logout`, não em qualquer `signedOut`: a inicialização sem sessão passa por `signedOut` e apagaria o convite que acabou de chegar);
- a leitura é `peek` (idempotente), por causa do `StrictMode`, que chama o inicializador do `useState` duas vezes em desenvolvimento;
- no web, recarregar a página no meio do login perde o código: a pessoa abre o link de novo. É o custo de não gravar o código em disco (seção 9, pergunta 1).

**e. Sem sessão: login ou cadastro, depois o convite.**

- `(app)/_layout.tsx` continua mandando para `/login`. O código já está na memória, fora da URL;
- `login.tsx` e `register.tsx`, com convite pendente, mostram no topo um `Banner` informativo: "Você recebeu um convite para uma crônica. Entre ou crie sua conta para continuar." Ele não mostra o código nem o nome da crônica, que o app não conhece antes do aceite;
- depois do login ou do cadastro, `router.replace(hasPendingInvite() ? '/join' : '/')`. O `(auth)/_layout.tsx:15` usa o mesmo destino, para o redirecionamento da sessão não correr na frente e cair em `/`;
- "Criar conta" e "Já tenho conta" trocam de tela sem perder o código (a memória não depende da rota).

**f. A tela "Entrar com convite" (`join.tsx`).**

- O campo começa com `peekPendingInvite() ?? ''` e acompanha a assinatura (o `hashchange` do web e um deep link com o app aberto).
- Com o código vindo de link, um `Banner` informativo: "Convite recebido. Você vai entrar como <nome de usuário>." O nome vem da sessão (`useSession().session.user`). Ele evita entrar com a conta errada num aparelho dividido.
- O aceite continua no toque de "Entrar na crônica". Nada é enviado ao abrir a tela.
- O campo não sugere preenchimento (`autoComplete="off"`; no iOS, `textContentType="oneTimeCode"` não, porque o teclado ofereceria o código de SMS). O `maxLength` passa a 64, o mesmo da API: hoje é 40 (`join.tsx:57`), o que já cabe o código formatado (32), mas corta um colado com texto em volta.
- O `join.tsx` **não lê query** (`?code=`): um link montado à mão com o código na query não preenche nada, para não ensinar o formato que vai para log.

**g. A mensagem pronta e "Copiado ✓" (`InviteSheet.tsx`).**

- Depois de "Gerar convite", a folha mostra:
  - "Convite <n>" (o número da seção 3.3);
  - o link, como texto selecionável (`testID="invite-link-value"`);
  - o código formatado, como hoje (`testID="invite-code-value"`, mantido para os E2E);
  - a validade e os usos tirados da resposta (`expiresAt`, `maxUses`), não mais o "7 dias e até 10 pessoas" fixo.
- **Botões:** "Copiar link" (primário), "Compartilhar" ou "Copiar mensagem" (seção 3.2) e "Copiar código" (secundário, para ditar ou digitar no app).
- **A mensagem** (texto do time, revisável): "Você foi convidado para a crônica "<nome>" no TMS. Abra o link para entrar: <link> — No app TMS, toque em "Entrar com convite" e use o código <código formatado>. Vale até <dd/mm> e para até <n> pessoas." O nome da crônica já é texto seguro de uma linha (`chronicleName`, `routes.ts:31-37`).
- **"Copiado ✓":** cada botão de copiar troca o título por "Copiado ✓" por 2 s (nome acessível "Copiado", sem o símbolo). Ao mesmo tempo, uma região viva sempre montada na folha recebe "Link copiado." (ou "Mensagem copiada.", "Código copiado."): `aria-live="polite"` no web e `accessibilityLiveRegion="polite"` no Android, mais `AccessibilityInfo.announceForAccessibility` no iOS. No web, o `announceForAccessibility` do react-native-web é vazio (`node_modules/react-native-web/dist/exports/AccessibilityInfo/index.js:79`); por isso a região viva. O toast "Código copiado" sai.
- **A falha ao copiar:** o `expo-clipboard` do web tenta `navigator.clipboard.writeText` e cai no `execCommand` (`node_modules/expo-clipboard/build/web/ClipboardModule.js:69-82`). Se os dois falharem, a folha diz "Não foi possível copiar. Selecione o link acima e copie." Nada vai ao error tracking com o texto copiado: o `catch` não chama `captureError`.

**h. O toast acima da folha no web, e acima das barras fixas** (`@tms/ui`, seção 3.9).

1. **`ModalToastHost` também no web** (`Toast.tsx:182`, sem o `Platform.OS !== 'web'`). Com a folha aberta, o aviso é desenhado dentro do painel da folha, dentro do `aria-modal`. O foco preso do react-native-web alcança o "Desfazer", e o aviso fica acima do conteúdo da folha nas três plataformas.
2. **O aviso dentro da folha sobe acima do rodapé.** A `BottomSheet` mede o `footer` (`onLayout`) e passa a altura ao `ModalToastHost` (prop nova `offset`, hoje fixo em 0 na l.195). "Cancelar" e "Remover" não ficam cobertos. No web, o `onLayout` só dispara com mudança de tamanho (A3 da onda 4): o rodapé nasce com tamanho, então a primeira medida chega.
3. **O dock e o aviso de bônus erguem o aviso.** O `CombatDock` e o `BonusNotice` medem a própria altura e chamam `useToastOffset(height)`, como a barra de seleção (`TableSelection.tsx:188`). "Salvo: 33 alterações" sobre Sangue e FdV (Android), "Forma: Crinos" sobre o dock (web 390) e o aviso de conclusão sobre o rodapé (web 390) passam a ficar acima.
4. **O que sobra:** um aviso sobre conteúdo que rola ("Regras da criação salvas." sobre "Excluir crônica" e sobre o primeiro participante). O aviso dura 5 s e pausa com toque ou ponteiro (T-76), e o conteúdo rola por baixo dele. O caso citado vem do painel de regras, que o P09-D recolhe (seção 2). Nenhum espaço extra na rolagem neste pacote (seção 9, pergunta 5).

**Generaliza:** o aviso dentro de modal no web vale para as 26 folhas que usam a `BottomSheet` (P08 §3.14) e para qualquer "Desfazer" mostrado com uma folha aberta.

### 3.2 T-44 · "Compartilhar" com alternativa, sem `pageerror`

**Causa: confirmada.** O `Share.share` do react-native-web devolve `Promise.reject(new Error('Share is not supported in this browser'))` quando `navigator.share` não existe, e o `onPress` de `InviteSheet.tsx:51-54` não trata a promessa. A rejeição não tratada vira `pageerror` (e, no build de dev, a sobreposição "Uncaught Error").

**Desenho.**

1. **Detecção antes do toque.** `canShareNatively()` em `lib/invite/share.ts` (novo): `true` no Android e no iOS; no web, `typeof navigator.share === 'function'` e, se existir, `navigator.canShare?.({ text }) !== false`. Sem suporte, o botão já aparece como **"Copiar mensagem"**, e não como "Compartilhar" que falha.
2. **Com suporte, o toque trata as três saídas** (`await` dentro de `try/catch`):
   - sucesso: nada a mais;
   - `AbortError` (a pessoa fechou a folha do sistema): nada, sem aviso;
   - qualquer outro erro (`NotAllowedError`, `TypeError`, a rejeição do react-native-web): copia a mensagem, mostra "Copiado ✓" e a frase "O navegador não abriu o compartilhamento. A mensagem foi copiada."
3. **No web, o conteúdo vai como `{ text: mensagem }`.** O link já está no texto; com `url` também, alguns alvos repetem o link.
4. **No app**, `Share.share({ message })`, como hoje, com a mensagem nova. No iOS a folha do sistema abre (`img/narrador-app/20-compartilhar-ios.webp`); no Android, o seletor.
5. **Nada da mensagem vai ao error tracking.** O erro do compartilhar não é defeito do app: o `catch` não o captura, e o `classifyError` não precisa mudar.

### 3.3 T-45 · Revogar com confirmação e convites distinguíveis

**Causa: confirmada.** `onPress={() => revoke.mutate(i.id)}` (`InviteSheet.tsx:114`) e o título `Criado em ${shortDate(i.createdAt)}` (`:107`).

**a. Confirmação na própria linha, com o foco** (o padrão do DS para o destrutivo raro, `components.md:681-690`: foco inicial em Cancelar).

- "Revogar" (nome acessível "Revogar convite <n>", que começa pelo título, WCAG 2.5.3) troca o conteúdo da linha por:
  - "Revogar o convite <n>? Quem ainda não entrou não vai conseguir usar o link nem o código.";
  - "Cancelar" (o foco vai para ele);
  - "Revogar convite" (`danger`).
- "Cancelar" volta a linha e devolve o foco ao "Revogar" daquela linha.
- "Revogar convite" chama a API (`busy` enquanto espera). No sucesso, a linha sai da lista, e o foco vai para o título "Convites ativos" (focável por programa, `tabIndex={-1}` no web). O gatilho não existe mais.
- O foco por programa usa o `focusView` que o P05-D criou (`apps/frontend/sheet/layouts/anchor.ts:31-41`), levado para `lib/focus.ts` e reexportado de lá, para o `components/` não depender de `sheet/layouts`. O `Button` do `@tms/ui` ganha `ref` (seção 3.9).
- Uma confirmação por vez: abrir a de outra linha fecha a anterior.
- **Por que na linha, e não numa folha nova:** a "Convidar jogadores" já é um `Modal`. Uma segunda folha por cima repetiria o problema do iOS com dois modais em transição (`BottomSheet.tsx:131-135`). A linha mantém o foco preso da folha.
- O Esc no web e o voltar do Android fecham a folha inteira, como hoje (`BottomSheet.tsx:223`, `:231-239`). Nenhum dos dois revoga.

**b. Convites distinguíveis: número, dia e hora.**

- **Título:** "Convite <n> · criado em dd/mm às hh:mm"; **subtítulo:** "N usos restantes · vale até dd/mm às hh:mm". A hora já vem no `createdAt` e no `expiresAt` (`timestamptz`, no fuso de quem lê, T-47), com o `hhmm` de `lib/format.ts:37-38`. Sem mudança na API.
- **O rótulo é o número do convite na crônica** (1 = o primeiro gerado nela). Ele aparece também no topo do convite recém-gerado ("Convite 3"), para o narrador associar o que mandou ao que vê na lista.
- **A API calcula o número** (`row_number() over (order by created_at, id)` sobre os convites da crônica, antes do `limit 50`, `routes.ts:615-628`). O número fica estável: convites não são apagados (só revogados) e saem todos juntos com a crônica, por cascata. Campo novo, aditivo, só na resposta do narrador (seção 3.9). Sem migration.
- **O "final do código" não entra.** O servidor guarda só o hash (`routes.ts:572`) e não consegue mostrar nenhum pedaço do código. Mostrar o final exigiria guardar, em claro, uma parte do segredo numa coluna nova (com migration), visível a quem lê o banco. Com 4 dos 26 caracteres, sobrariam 110 bits, o que ainda impede adivinhar o resto. Mesmo assim, guardar um pedaço do segredo é **decisão de segurança, não de layout**: fica como ponto aberto (seção 9, pergunta 2), sem decisão neste plano.
- **Um rótulo livre** ("para o Lucas"), escrito pelo narrador ao gerar, também é opção. Ele pede coluna nova (migration), campo novo na folha e cuidado com dado pessoal (não iria para a auditoria nem para log). Fica para o PO (seção 9, pergunta 2).

### 3.4 T-30 e o achado 6 · O "voltar" que sempre funciona

**Causa do T-30: confirmada, com linhas diferentes das da matriz.** `router.back()` sem `canGoBack()` em `new-character.tsx:77` (a matriz diz l.37–40), `join.tsx:34` (l.38) e `new.tsx:57` (l.52). O mesmo padrão aparece em `UnsupportedTemplate.tsx:74`. A ficha (`characters/[id].tsx:48`) e o `useSheetBack` (`sheet/navigation.ts:17-28`) já fazem certo.

**Desenho.**

1. **`useBackTo(fallback)`** em `apps/frontend/lib/navigation.ts` (novo): `router.canGoBack() ? router.back() : router.replace(fallback)`. O `useSheetBack` passa a usá-lo, sem mudar o comportamento.
2. **Quem usa e para onde volta:**

   | Tela | Sem tela de baixo, volta para |
   |---|---|
   | Nova ficha | `/chronicles/<id>` |
   | Entrar com convite | `/` (e limpa o convite pendente) |
   | Nova crônica | `/` |
   | `UnsupportedTemplate` sem `onBack` | `/` |

3. **O "‹" da crônica** (`chronicles/[id]/index.tsx:137`) usa `router.replace('/')` hoje. No nativo, vindo da lista por `push`, isso troca a crônica por **outra** lista em cima da primeira (`[lista, lista]`). O voltar do Android cai então na lista de baixo, igual à de cima, e só o próximo voltar sai do app: é um "voltar" a mais. Passa a `useBackTo('/')`.

**Achado 6 (três "voltar" no AVD depois da seleção): investigar com teste antes de corrigir.** O caso não foi repetido na onda 3. As hipóteses, em ordem:

- **(a)** a lista duplicada do item 3: aparece se a pessoa usou o "‹" da crônica em algum momento e depois voltou à crônica;
- **(b)** o `BackHandler` da seleção (`TableSelection.tsx:195-203`) responde `true` uma vez para desligar a seleção, como deve. Ele conta como o primeiro "voltar", e é o desenho;
- **(c)** a crônica aberta por `router.replace` depois de "Entrar com convite" ou "Nova crônica" (`join.tsx:26`, `new.tsx:45`) fica certa (`[lista, crônica]`). Já o `account.tsx:89` abre a crônica por `push` a partir da Conta, e o voltar passa pela Conta;
- **(d)** no web, o `setParams` da aba (`index.tsx:106-109`) empilha entradas no histórico (pergunta 6 da [onda-3.md](onda-3.md) §8, ainda aberta). Assim o voltar do navegador passaria pelas abas antes de sair.

**Os testes do diagnóstico** (seção 4.1):

- um Jest com `renderRouter` do `expo-router/testing-library` (vem com o `expo-router`, sem dependência nova), `Platform.OS = 'android'` e `BackHandler.mockPressBack()`, na sequência lista → crônica → Mesa → seleção → voltar × 2. Ele conta as rotas da pilha;
- um E2E que mede o `history.length` antes e depois de trocar de aba no web.

O que falhar é corrigido. Se (d) se confirmar, a aba passa a substituir a entrada (`history.replaceState`, como a URL do convite) em vez de empilhar. Se nenhuma hipótese reproduzir, o achado fecha como "não reproduzido", com o teste que prende o comportamento, e o roteiro da seção 11 repete o caso no AVD.

### 3.5 T-51 · Ações principais no topo da lista

**Causa: confirmada**, em outra linha: os botões estão no `ListFooterComponent` (`index.tsx:131`). A matriz cita l.30–34.

- Os botões ("Criar crônica", "Entrar com convite") sobem para o `ListHeaderComponent`, acima de "Suas crônicas" e depois das propostas de narrar (`TransferOffer`, `:109-118`). Elas são raras e pedem resposta.
- **Lista vazia** (a R-30 e o IW-14/IA-26: quem chega por convite vê "Criar crônica" em destaque): "Entrar com convite" vem primeiro e como primário, "Criar crônica" como secundário. A mensagem passa a "Recebeu um link ou um código do narrador? Entre com o convite. Para narrar, crie uma crônica." (texto do time, revisável). Os dois botões continuam com o mesmo nome acessível: os E2E e o `chronicles.test.tsx:281` continuam valendo.
- A rolagem não esconde as ações na primeira tela: com 7 crônicas no iPhone SE, elas ficam logo abaixo da `AppBar`.

### 3.6 T-73 · Mensagens claras, genéricas contra enumeração

**Causa: confirmada.** Nenhuma tela de entrada traduz o erro: `login.tsx:40` e `register.tsx:58-60` mostram o `AuthError.message`, que é o texto da API. O `join.tsx:48` usa o `messageOf`. Os erros de campo do cadastro só mudam no envio (`register.tsx:45-46`).

**a. Mensagens pela situação (status HTTP), no app.** `lib/authMessages.ts` (novo) mapeia por tela e por status, sem ler o texto da API:

| Tela | Status | Mensagem (texto do time, revisável) | Genérica porque |
|---|---|---|---|
| Login | 401 | "E-mail ou senha incorretos. Confira e tente de novo." | A mesma para e-mail inexistente e senha errada, como hoje |
| Login | 400 | Validado antes do envio (item b). Se ainda vier: "Confira o e-mail e a senha." | — |
| Login, cadastro e convite | 429 | "Muitas tentativas. Espere alguns minutos e tente de novo." | O contador de falhas é por e-mail, exista a conta ou não (`auth/routes.ts:173-190`) |
| Cadastro | 409 | "Não foi possível criar a conta com esses dados. Se você já tem conta, entre com ela; se não, tente outro nome de usuário." | A mesma para e-mail ou nome já usados (`auth/routes.ts:146-152`): não diz qual existe |
| Convite | 404 | "Este convite não vale mais ou o código está errado. Confira o código ou peça um novo ao narrador." | A mesma para inexistente, revogado, expirado e esgotado (`routes.ts:732-739`) |
| Convite | 400 | "Confira o código: ele tem letras e números." | — |
| Qualquer | sem resposta | O `OFFLINE` de hoje (`lib/errors.ts:4`) | — |
| Qualquer | 5xx | "Algo deu errado do nosso lado. Tente de novo." com o código do erro, como hoje (`withErrorCode`) | — |

**A API não muda de texto.** As mensagens dela continuam como estão (são contrato dos testes da API e das outras telas, que seguem com o `messageOf`). As frases novas não acrescentam nenhuma informação que a API não dê hoje: o mapeamento é por status, e cada status já existe.

**b. Erros de campo que acompanham a digitação** (`lib/validation.ts`, `register.tsx`, `login.tsx`).

- Depois do primeiro envio, ou com o campo já com erro, o erro daquele campo é recalculado a cada mudança: some quando fica certo e muda quando o problema muda. Antes do primeiro envio, nada aparece enquanto se digita.
- **Nome de usuário: o primeiro problema, dito como ele é** (a regra continua `^[a-z0-9_]{3,24}$`, `validation.ts:4`, a mesma da API):
  - com maiúscula: "Use só letras minúsculas.";
  - com espaço: "Sem espaços: use _ no lugar.";
  - com acento ou outro sinal: "Use letras sem acento, números e _.";
  - fora do tamanho: "De 3 a 24 caracteres."

  A dica fixa ("Aparece para a sua mesa. Letras minúsculas, números e _.") continua. O campo não converte para minúscula sozinho: a pessoa vê o que vai ficar.
- **Login:** o e-mail passa pela mesma regra do cadastro antes do envio, com o erro no campo ("Informe um e-mail válido."), em vez do "dados inválidos" no topo (POA-34).

**c. As frases são de interface**, escritas pelo time, sem texto de livro.

### 3.7 T-82 · Remover: o texto, a lista e o selo

- **Toast** (`MemberSheets.tsx:42`): "<nome> foi removido da crônica." O "saiu" continua só para quem sai sozinho (o `LeaveChronicleSheet` e a frase `member.leave` da auditoria, `auditPhrase.ts:134`).
- **Lista vazia** (`chronicles/[id]/index.tsx:406-410`): o narrador vê "Nenhum jogador agora. Convide os jogadores com um link." O "Ninguém entrou ainda." estava errado depois de uma remoção, e a lista não distingue "nunca entrou" de "saiu" sem dado novo. A frase vale para os dois casos. O jogador continua com "Você é o primeiro jogador."
- **Selo "Arquivada":** o `characterState` já devolve "Arquivada" para `status: 'archived'` (`characterState.ts:100-101`), e a remoção invalida a crônica com as fichas (`lib/queries/chronicles.ts:116-117`). A captura do iOS (`img/po-app/149-jogador-removido-ios.webp`) é de antes do P04-D. **Não confirmado na ponta:** o teste de regressão da seção 4.1 prova o selo depois da remoção, e o roteiro confere no iOS.
- **"No web, nenhum toast para o narrador" (PO web, 13:14): não confirmado.** O toast é mostrado com a folha "Remover" ainda aberta. No web, ele nasce na raiz, embaixo do modal (seção 3.0). Ao fechar a folha, deveria aparecer. Com a seção 3.1.h, o aviso nasce dentro da folha e passa para a raiz quando ela fecha (`ModalToastHost`, `:176-177`). O E2E prova que ele fica visível e no topo do `elementFromPoint`.

### 3.8 O caminho do código: Sentry, logs, breadcrumb e `Referer` (conferido)

| Por onde o código poderia sair | Hoje | O que o pacote faz |
|---|---|---|
| URL da página no servidor e no proxy | O fragmento não vai na requisição | Nada a fazer; o link nunca leva o código na query nem no caminho |
| Log de acesso da API | Só método, caminho, rota, status, tempo e versão (`loggerMiddleware.ts:67-83`); nunca corpo | Teste: o `POST /invites/accept` com um código válido não deixa o código nem o hash em nenhuma linha de log |
| Log de query do banco | SQL sem parâmetros (`packages/db/src/logger.ts:9-15`) | Coberto pelo mesmo teste (o hash é parâmetro) |
| Auditoria | Só id, usos e validade (T-63) | Não muda |
| Sentry da API | Só 5xx, com a lista de campos (`telemetry.ts`, `on-error.ts`); `scrubLog` com a lista `LOG_TEXT` (`telemetry.ts:109`) | Nenhum campo novo de log. A `redact` (`apps/api/src/http/safe-error.ts:30`) ganha a regra do item seguinte, para o caso de um erro repetir o corpo |
| Sentry do web: exceção | `redact` + lista de campos (`telemetryFilter.ts:11-20`, `:161-222`) | A `redact` passa a trocar por `[convite]` toda sequência de 26 caracteres do alfabeto do código (com ou sem os espaços do formato) e todo fragmento de URL (`#…`). A cópia da API muda junto (o comentário de `telemetryFilter.ts:9-10` já pede isso) |
| Sentry do web: breadcrumb de navegação | `scrubUrl` tira o fragmento (`:24-39`) | O `replaceState` roda antes do `initTelemetry`. Teste: um breadcrumb `navigation` com `#<código>` sai sem fragmento |
| Sentry do web: `request.url` | Fora da lista de campos | Não muda |
| Estado do roteador | O Expo Router poria o fragmento em `params['#']` | O web tira antes do roteador; o app tira no `+native-intent` |
| `Referer` | `Referrer-Policy: no-referrer` no web e na API; o navegador nunca manda o fragmento no `Referer` | E2E: nenhuma requisição da página leva o código em URL ou no `referer` |
| Console e Metro | Nenhum `console.*` com o código | Regra nos arquivos novos e conferência no roteiro: `grep -c` do código nos logs do Metro, da API e do `logcat` dá 0 |
| Disco do aparelho | Mutações não persistem (`persist.tsx:215`) | O código pendente fica só em memória |

### 3.9 API pública que muda: o que muda

**`@tms/ui`** (o `src` compila no app; o defeito de estilo em função só aparece no nativo, então a integração faz o build nativo, como pede a [onda-4.md](onda-4.md) §4.6):

| Componente | Mudança | Compatibilidade |
|---|---|---|
| `ModalToastHost` | Ativo também no web; prop nova `offset?: number` (a altura do rodapé da folha) | Exportado pelo `index.ts`, mas só a `BottomSheet` usa. Sem `offset`, o 0 de hoje |
| `BottomSheet` | Mede o `footer` e passa o `offset` ao `ModalToastHost` | API igual; as folhas herdam |
| `ToastProvider` / `ToastView` | Nenhuma no contrato. No web, o aviso passa da raiz para a folha aberta, e de volta ao fechar | Os testes do `components.test.tsx` que provam "web: na raiz" mudam (seção 4.2) |
| `useToastOffset` | Nenhuma; ganha dois usuários (`CombatDock`, `BonusNotice`) | — |
| `Button` | Prop nova `ref?: Ref<View>` (React 19: `ref` como prop), para o foco por programa | Aditiva; nenhum uso atual passa `ref` |

O `design/design-system/components.md` atualiza o Toast (l.653: "dentro da folha aberta, também no web; acima do rodapé") e o Button (o `ref`).

**API HTTP:**

| Rota | Mudança | Compatibilidade |
|---|---|---|
| `GET /chronicles/:id/invites` (só o narrador) | Cada item ganha `number: number` (a ordem do convite na crônica, a partir de 1) | Aditiva. O app antigo ignora o campo. O tipo do Eden sai do próprio `createApp` |
| `POST /chronicles/:id/invites`, `DELETE /chronicles/:id/invites/:inviteId`, `POST /invites/accept` | Nenhuma: corpo, status, textos e limites iguais | — |
| `/auth/register`, `/auth/login` | Nenhuma | — |

## 4. Testes

### 4.1 Um teste de regressão por bug (falha no `05c5d7d`, passa depois)

| Item | O que o teste prova | Arquivo | Tipo |
|---|---|---|---|
| T-43 (D-14) | `inviteLink` e `parseInviteFragment`: o código cru vai depois do `#`; fragmento com `/`, `?`, `%`, espaço, mais de 64 caracteres ou vazio → `null`; nada vira caminho. Origem do web: `location.origin` no web; `EXPO_PUBLIC_WEB_URL` no app; sem ela, a origem da API; esquema que não é `http(s)` lança | `apps/frontend/lib/__tests__/inviteLink.test.ts` (novo); `lib/__tests__/env.test.ts` | Jest |
| T-43 (D-14) | `capture.web`: com `location` em `/join#<código fictício>`, guarda o código, chama `replaceState` com `/join` e não deixa o fragmento em `location.href`; `/join#lixo` também sai da URL e não guarda nada; outra rota com fragmento não é tocada; `hashchange` repete. **Falha hoje** (o módulo não existe e o código ficaria em `params['#']`) | `lib/__tests__/inviteCapture.test.ts` (novo, ambiente `jsdom` só neste arquivo) | Jest |
| T-43 (D-14) | `redirectSystemPath`: `tms://join#…` e `tms:///join#…` → `/join` e o código na memória; `tms://chronicles/<uuid>#…` → `/chronicles/<uuid>`, sem fragmento e sem código guardado; URL inválida → `/` | `app/__tests__/native-intent.test.ts` (novo) | Jest |
| T-43 (D-14) | `pending`: some depois de 30 min (relógio falso), no aceite, no "‹" e no `session.logout`; **não** some na inicialização sem sessão; `peek` duas vezes devolve o mesmo | `lib/__tests__/invitePending.test.ts` (novo) | Jest |
| T-43 (D-14) | Sem sessão, com convite pendente: `/login` mostra o banner sem o código; o login leva a `/join` com o campo preenchido. O mesmo pelo cadastro. O `(auth)/_layout` com sessão e convite redireciona a `/join`. **Falha hoje** (vai a `/`) | `app/__tests__/auth-screens.test.tsx`; `app/__tests__/_layout.test.tsx` | Jest + RNTL |
| T-43 (D-14) | `join.tsx` com convite pendente: campo preenchido, banner "Você vai entrar como <usuário>", **nenhuma** chamada ao `acceptPost` até o toque; o toque aceita e limpa o pendente | `app/__tests__/chronicles.test.tsx` (bloco do `JoinScreen`, l.480-520) | Jest + RNTL |
| T-43 | Folha: "Copiar link" copia o link (`Clipboard.setStringAsync` com `…/join#…`); o botão vira "Copiado ✓" e volta em 2 s; a região viva recebe "Link copiado."; "Copiar código" continua copiando o código. A validade e os usos vêm da resposta. **Falha hoje** ("Código copiado" só no toast) | `app/__tests__/chronicles.test.tsx` (bloco da l.680 em diante) | Jest + RNTL |
| T-43 | `@tms/ui`: com `Platform.OS = 'web'` e uma `BottomSheet` aberta, o `toast` é desenhado dentro do painel (`aria-modal`), e não na raiz; ao fechar, volta à raiz com o mesmo texto e o mesmo prazo; com `footer`, o `bottom` do aviso soma a altura do rodapé. **Falha hoje** (no web fica na raiz) | `packages/ui/src/components.test.tsx` (bloco do `ModalToastHost`, do `00a6f29`) | Jest |
| T-43 | `CombatDock` e `BonusNotice` montados com altura medida: o `toast-host` tem `bottom` ≥ a altura do dock. **Falha hoje** | `apps/frontend/sheet/play/__tests__/play.test.tsx` (l.103, "CombatDock"); `sheet/creation/__tests__/CreationScreen.test.tsx` | Jest + RNTL |
| T-43 | Telemetria: a `redact` troca por `[convite]` um código de 26 caracteres (cru e formatado) e um `#…` de URL; um breadcrumb `navigation` com `to: '/join#…'` sai `'/join'`; o evento montado não tem o código em nenhum campo | `lib/__tests__/telemetryFilter.test.ts`; `lib/__tests__/telemetryWeb.test.ts` | Jest |
| T-43 | API: `POST /invites/accept` com um código válido e com um inválido → nenhuma linha de log (o `logger` capturado, como em `logger-output.test.ts`) contém o código nem o `sha256` dele; a `redact` da API troca o código | `apps/api/src/__tests__/logger-output.test.ts`; `apps/api/src/__tests__/safe-error.test.ts` | Bun |
| T-44 | Web sem `navigator.share`: o botão se chama "Copiar mensagem" e copia a mensagem. Com `navigator.share` que rejeita `NotAllowedError`: copia, "Copiado ✓" e a frase. Com `AbortError`: nada. Em nenhum caso há rejeição não tratada (`process.on('unhandledRejection')` espionado). App: `Share.share` com a mensagem nova. **Falha hoje** (rejeição não tratada) | `app/__tests__/chronicles.test.tsx`; `lib/__tests__/inviteShare.test.ts` (novo) | Jest + RNTL |
| T-45 | "Revogar convite 1" abre a confirmação com o foco em "Cancelar" (`focusView` chamado com o botão); "Cancelar" não chama a API e devolve o foco ao "Revogar convite 1"; "Revogar convite" chama `invitesDelete` uma vez, e o foco vai a "Convites ativos". Dois convites do mesmo dia: "Convite 1 · criado em 01/11 às 10:05" e "Convite 2 · … às 10:07". **Falha hoje** (revoga no primeiro toque) | `app/__tests__/chronicles.test.tsx`; `components/chronicles/__tests__/chronicles.a11y.test.tsx` (l.141) | Jest + RNTL |
| T-45 | API: `number` em ordem de criação (1, 2, 3), estável depois de revogar o 2 e com mais de 50 convites (o 51º continua 51 com o `limit`); jogador → 403, ex-membro e quem não tem vínculo → 404 (a matriz de AuthZ, sem campo novo para quem não é narrador) | `apps/api/src/__tests__/chronicles.test.ts` (bloco "convites", l.367); `apps/api/src/__tests__/authz.test.ts` (l.123) | Bun + PGLite |
| T-30 | Nova ficha, Entrar com convite e Nova crônica com `canGoBack` falso: o "‹" chama `replace` para a crônica ou para `/`; com `canGoBack` verdadeiro, `back`. `UnsupportedTemplate` sem `onBack` idem. **Falha hoje** (`back` sem tela) | `app/__tests__/new-character.test.tsx`; `app/__tests__/chronicles.test.tsx`; `sheet/__tests__/` do `UnsupportedTemplate` | Jest + RNTL |
| Achado 6 | `renderRouter`, Android: lista → crônica (push) → aba Mesa → seleção → `mockPressBack()` (desliga a seleção) → `mockPressBack()` → a pilha tem só a lista. E: lista → crônica → "‹" → a pilha tem uma lista só. **A segunda falha hoje**, se a hipótese (a) estiver certa | `app/__tests__/navigation-back.test.tsx` (novo) | Jest + RNTL |
| T-51 | Com 7 crônicas, os botões estão no `ListHeaderComponent`, antes de "Suas crônicas"; na lista vazia, "Entrar com convite" é o primeiro botão e o primário. **Falha hoje** | `app/__tests__/chronicles.test.tsx` (l.270-290) | Jest + RNTL |
| T-73 | Cadastro: enviar vazio, corrigir o e-mail → o erro do e-mail some sem novo envio; "Lucas Novato" → "Use só letras minúsculas." e, depois de tirar a maiúscula, "Sem espaços: use _ no lugar."; 409 → a frase da tabela. Login: "nome@" → erro no campo, sem requisição; 401 → "E-mail ou senha incorretos. Confira e tente de novo." Convite: 404 → a frase genérica. **Falha hoje** | `lib/__tests__/validation.test.ts` (novo ou o existente); `app/__tests__/auth-screens.test.tsx`; `app/__tests__/chronicles.test.tsx` (l.506-520) | Jest + RNTL |
| T-82 | Remover a única jogadora: toast "<nome> foi removido da crônica.", lista "Nenhum jogador agora. Convide os jogadores com um link." e, depois da nova busca, a ficha dela com o selo "Arquivada" na lista. **Falha hoje** nos textos | `app/__tests__/members.test.tsx` (l.167) | Jest + RNTL |

O Jest de `apps/frontend` pega `.test.ts` em `app/`, `lib/` e `sheet/`, mas em `components/` só `.test.tsx` (`apps/frontend/jest.config.js:17-29`). Nenhum teste novo fica em `components/` como `.ts`. Antes de dar o pacote por pronto, conferir com `npx jest --listTests | grep -E 'invite|native-intent|navigation-back'`.

### 4.2 Testes existentes que mudam junto

| Arquivo | O quê | Por quê |
|---|---|---|
| `apps/frontend/app/__tests__/chronicles.test.tsx` (l.700-760) | "Código copiado" sai; o `Share.share` recebe a mensagem nova; "Revogar" passa por "Revogar convite 1" e pela confirmação; "Ninguém entrou ainda…" vira "Nenhum jogador agora…" (l.711) | T-43, T-44, T-45, T-82 |
| `apps/frontend/app/__tests__/chronicles.test.tsx` (l.506-520) | "convite inválido ou expirado" vira a frase genérica nova | T-73 |
| `apps/frontend/components/chronicles/__tests__/chronicles.a11y.test.tsx` (l.169) | `findByRole('button', { name: 'Revogar' })` → `'Revogar convite 1'` | T-45 |
| `apps/frontend/app/__tests__/members.test.tsx` (l.167) | "dona saiu da crônica." → "dona foi removido da crônica." (o texto exato sai do teste) | T-82 |
| `apps/frontend/app/__tests__/auth-screens.test.tsx` | As mensagens cruas da API viram as da tabela 3.6; os erros de campo mudam de texto | T-73 |
| `apps/frontend/lib/__tests__/session.test.ts` | Confere: o `AuthError` continua com o status e o texto da API (o mapeamento é na tela) | T-73 |
| `packages/ui/src/components.test.tsx` (bloco do `00a6f29`) | O caso "web: o aviso fica na raiz com a folha aberta" passa a "web: dentro da folha" | T-43 |
| `apps/api/src/__tests__/chronicles.test.ts` (l.367-530) | Os casos de `GET` conferem o `number` | T-45 |
| `e2e/tests/chronicles.spec.ts` (l.74) | `'convite inválido ou expirado'` → a frase genérica nova | T-73 |
| `e2e/tests/auth.spec.ts` (l.78-80) e `e2e/tests/account.spec.ts` (l.57) | `toContainText('e-mail ou senha …')` diferencia maiúscula: passa a `'E-mail ou senha incorretos'` | T-73 |
| `e2e/tests/journey-storyteller.spec.ts` (l.287) | `` `${playerA.username} saiu da crônica.` `` → `` `… foi removido da crônica.` `` | T-82 |

**Sem mudança** (conferido com grep): `journey.spec.ts:57-77`, `journey-mage.spec.ts:56-64`, `journey-werewolf.spec.ts:57-65` e `journey-storyteller.spec.ts:99-108`. Eles usam "Gerar convite", o `invite-code-value` (mantido) e o código digitado em "Entrar com convite" (mantido). Os specs que geram e aceitam convite pela API (`support/creation.ts:33-37`, `conflict`, `creation-state`, `creation-feedback`, `lifecycle`, `layout:40-43`, `narrator`, `table`, `sheet`, `journey-backstage`, `npc-backstage`) também não mudam: a API do aceite não muda. O `layout.spec.ts:330-362` (a folha "Convidar" a 390 e a 1280, o Esc e o foco de volta) continua e passa a ver o conteúdo novo da folha.

### 4.3 E2E (Chromium e WebKit; roda na integração da onda, portas fixas, um por vez)

Contas por `signUp`, crônicas por `apiAs` (`e2e/support/users.ts`), só dados fictícios. Larguras 390 × 844 e 1280 × 720. O código lido da tela fica numa variável do teste e nunca vai para `console.log`, nome de teste ou anexo; os screenshots de falha do Playwright mascaram `invite-code-value` e `invite-link-value` (`mask` na config do spec).

**`e2e/tests/invite-link.spec.ts` (novo):**

- **"o link abre Entrar com convite preenchido e some da URL" (com sessão):**
  - o narrador gera o convite; o link vem de `getByTestId('invite-link-value')`;
  - o jogador (outro contexto, com sessão) faz `page.goto(link)`;
  - `await expect(page).toHaveURL(/\/join$/)`, e `page.evaluate(() => location.hash)` dá `''`;
  - `getByLabel('Código do convite')` com o valor do código; o banner "Você vai entrar como <usuário>";
  - "Entrar na crônica" → a crônica;
  - `page.goBack()` nunca leva a uma URL com `#`: `expect(page.url()).not.toContain('#')`.
- **"sem sessão: login, depois o convite":**
  - contexto novo, sem cookie: `page.goto(link)` → `/login`, com o banner do convite e sem o código na tela (`getByText(code)` com `toHaveCount(0)`);
  - login pela tela com uma conta criada por `signUp` em outro contexto → `/join` preenchido → aceitar;
  - o mesmo pelo cadastro ("Criar conta").
- **"o código não sai da página":** `page.on('request')` junta URL e o cabeçalho `referer` de toda requisição, e `page.on('console')` junta as mensagens. Nenhuma contém o código, nem cru nem formatado. Só o corpo do `POST /invites/accept` o leva.
- **"T-44: sem Web Share API" (Chromium e WebKit):** `context.addInitScript` apaga `navigator.share` e `navigator.canShare`. O botão é `getByRole('button', { name: 'Copiar mensagem', exact: true })`. Depois do clique, "Copiado ✓" e a região viva com "Mensagem copiada.". `page.on('pageerror')` fica vazio no teste inteiro. A variante com um `navigator.share` falso que rejeita `NotAllowedError` também não tem `pageerror`. No Chromium, com `grantPermissions(['clipboard-read', 'clipboard-write'])`, o texto colado contém o link; no WebKit, sem essa permissão no Playwright, só o "Copiado ✓".
- **"T-43: o retorno de copiar está à vista":** depois de "Copiar link", `elementFromPoint` no centro do botão "Copiado ✓" devolve o próprio botão (ou um filho), a 390 e a 1280.
- **"T-45: revogar pede confirmação, com o foco":**
  - dois convites; a lista com "Convite 1 · criado em … às …" e "Convite 2 · …";
  - `getByRole('button', { name: 'Revogar convite 1' })` pelo teclado (`focus` + Enter, pelo motivo do `layout.spec.ts:338`): o foco vai para "Cancelar" (`toBeFocused()`);
  - Enter em "Cancelar": o foco volta ao "Revogar convite 1", e nenhum `DELETE` sai (`page.on('request')`);
  - de novo, e "Revogar convite": um `DELETE`, a linha some e o foco fica em "Convites ativos".
- **"um convite revogado, pelo link, dá a mensagem genérica":** o link do convite revogado → preenchido → "Entrar na crônica" → `getByRole('alert')` com "Este convite não vale mais ou o código está errado".

**`e2e/tests/navigation.spec.ts` (novo), T-30 e achado 6 (d):**

- `page.goto('/chronicles/<id>/new-character')` direto (o F5 do QAW-07) → `getByRole('button', { name: 'Voltar para <crônica>' })` → a crônica;
- o mesmo em `/join` → a lista, e em `/chronicles/new` → a lista. `page.on('console')` sem "GO_BACK";
- na crônica, trocar de aba três vezes e medir `history.length` antes e depois (a pergunta 6 da onda 3). Um `page.goBack()` sai da crônica, ou volta uma aba: o teste registra qual e prende o comportamento escolhido na seção 3.4.

**Outros:**

- **`e2e/tests/play.spec.ts`:** a 390, numa ficha em Jogo com o dock, uma ação que mostra toast: o `getByTestId('toast')` tem o `bottom` acima do topo do dock (`boundingBox`). Numa folha de recurso aberta, o toast com "Desfazer" fica dentro do painel da folha (`bottom-sheet-root > [aria-modal="true"]`), e o `elementFromPoint` no centro dele devolve o toast. A medida é no painel, não na camada.
- **`e2e/tests/journey-storyteller.spec.ts`:** depois de "Remover" (l.283-287), o toast novo fica visível no web também, e `elementFromPoint` no centro dele devolve o toast.
- **`e2e/tests/chronicles.spec.ts`:** a lista vazia com "Entrar com convite" como primeiro botão; com 3 crônicas a 390, os dois botões dentro da primeira tela (`boundingBox().y + height <= 844`).
- **`e2e/tests/auth.spec.ts`:** o cadastro com "Lucas Novato" mostra "Use só letras minúsculas." antes do envio seguinte, e o erro some ao corrigir; o login com "nome@" não faz requisição e mostra o erro no campo.

**O que o Jest não pega e o E2E confere no web:** a URL e o histórico sem o fragmento depois de ler o convite; o `referer` de verdade; o `pageerror` do WebKit; o aviso no painel da folha no DOM (o portal do react-native-web); o `aria-live` da região do "Copiado ✓" no DOM.

### 4.4 Suítes do "PR local" e cobertura

```bash
npx pnpm turbo run typecheck lint --filter=@tms/ui --filter=frontend --filter=@tms/api --filter=@tms/e2e
npx pnpm turbo run test:coverage --filter=@tms/ui --filter=frontend
cd apps/api && bun test src/__tests__/chronicles.test.ts src/__tests__/authz.test.ts src/__tests__/logger-output.test.ts src/__tests__/safe-error.test.ts src/__tests__/telemetry-logs.test.ts
```

- O Jest do frontend pelo `pnpm` não encerra sozinho ([onda-4.md](onda-4.md) §11): rodar com `--forceExit`.
- **Metas que o CI aplica, por arquivo:**
  - `@tms/ui`: 80% em tudo (`packages/ui/jest.config.js`). O `ModalToastHost` ganha o ramo web, com `Platform.OS` trocado no teste, como o P06 fez;
  - app: 70/70/60/70 global e 80/80/70/80 em `./sheet/` (`apps/frontend/jest.config.js:35-38`). Os módulos novos de `lib/invite/` nascem com teste próprio.
- **API:** a suíte inteira roda (a rota de convites e a `redact` mudam). Os `*.pg.test` não são precisos: nenhuma trava nova.
- **`@tms/db` e `@tms/sheet-core`:** não mudam. Sem migration e sem `dist` novo.

## 5. Segurança

| Ameaça | O que o desenho evita | Resíduo |
|---|---|---|
| O código em log de servidor, de proxy ou de CDN | O código só no fragmento; o app nunca monta link com o código na query ou no caminho; o `join.tsx` não lê `?code=` | — |
| O código no histórico do navegador e na barra de endereço | `history.replaceState` para `/join` antes do roteador; `hashchange` tratado | O histórico global de páginas visitadas pode guardar a URL original (comportamento do navegador). Com 10 usos e 7 dias, quem acessa esse histórico entra na crônica até o narrador revogar. Mitigação: a lista dos ativos mostra os usos, e o narrador revoga |
| O código no Sentry, no breadcrumb ou no log da API | Leitura antes do `initTelemetry`; `scrubUrl` já tira o fragmento; a `redact` do web e da API passa a tirar o código; a API não registra corpo; testes na seção 4.1 | — |
| O código no `Referer` | `Referrer-Policy: no-referrer` no web e na API; o navegador nunca manda o fragmento no `Referer`; E2E confere | — |
| O código no disco do aparelho | Pendente só em memória; mutações não persistem (`persist.tsx:215`) | Na área de transferência, ao copiar (como hoje com o código) |
| Deep link que abre outra rota com o código, ou caminho tirado do fragmento | `redirectSystemPath` só lê o código em `join`; em qualquer outra URL, tira o fragmento; o fragmento passa por um formato fechado e nunca vira rota (sem open redirect) | — |
| Outro app que registra o esquema `tms` (sequestro de esquema no Android) | O plano não manda `tms://` nas mensagens: o link compartilhado é `https` | Quem abre um `tms://` com código num aparelho com app malicioso. App Links e Universal Links (verificados) fecham isso: pergunta 3 |
| Entrar numa crônica sem ver (link malicioso) | Sem aceite automático: a tela abre preenchida, diz a conta e espera o toque | — |
| Enumeração de conta e de convite | Mensagens por status, iguais para os casos que a API já iguala (tabela 3.6); a API não muda de texto nem de status | O 409 do cadastro já diz que "algo existe" (e-mail ou nome), como hoje |
| Força bruta no código | 128 bits; 10 tentativas a cada 15 min por conta e por IP, contadas antes de ler o código; sem mudança | — |
| IDOR no número do convite | O `number` só sai no `GET` do narrador (`requireStoryteller`); a revogação continua pelo id, presa à crônica | — |
| Texto da mensagem pronta | O nome da crônica já é texto seguro de uma linha (`chronicleName`); a mensagem sai como texto puro, no `Text` e no `Share`, sem HTML | — |
| Logs com PII, senha, token ou código | Nenhum `console.*` novo; nenhum campo novo no `scrubLog`; a auditoria não ganha o número nem o código | — |

**`/security-review` obrigatório** neste pacote (matriz, "Conversa com"), no diff inteiro. Ele confere:

- o `capture.web.ts` e o `+native-intent.tsx`;
- as duas `redact`;
- o `GET` com o `number`;
- que nenhuma rota, limite ou texto da API de aceite mudou.

O `/code-review` também roda no pacote inteiro.

## 6. Como generaliza além do WoD

| Item | Escopo | Como generaliza |
|---|---|---|
| T-43, T-44, T-45 (D-14) | Genérica | O convite é da crônica, não do sistema: o link, a mensagem, a confirmação e o número valem para V20, M20, W20 e para um D&D ou Call of Cthulhu futuro, sem nada no template |
| T-43 (toast) | Genérica (`@tms/ui`) | O aviso dentro da folha no web e acima do rodapé vale para toda folha, nas três skins. O dock ergue o aviso com os campos que o template põe no `dock`, sem saber quais são |
| T-30, achado 6 | Genérica | `useBackTo` serve a qualquer tela sem tela de baixo |
| T-51 | Genérica | A lista de crônicas é a mesma para qualquer sistema |
| T-73 | Genérica | Cadastro, login e convite não dependem de sistema; as frases são de interface |
| T-82 | Genérica | Remover e arquivar valem para qualquer sistema; o selo vem do `characterState` |

## 7. Critério de pronto

1. Plano aprovado, com as perguntas da seção 9 respondidas ou com o padrão do plano.
2. `typecheck`, `lint` e testes dos pacotes afetados verdes (seção 4.4).
3. Um teste de regressão por bug (seção 4.1), que falha no `05c5d7d` e passa depois. O achado 6 fecha com o teste do diagnóstico, reproduzido ou não.
4. `/code-review` no diff do pacote e `/security-review` no diff inteiro (seção 5).
5. Os cenários das personas, repetidos sem o defeito:

   | Item | Persona e cenário (notas) | O que se espera ver |
   |---|---|---|
   | T-43 | N-W (NW-05), web 390 e 1280: Convidar → Gerar convite → Copiar link | "Copiado ✓" no botão, à vista, e a região viva com "Link copiado." |
   | T-43 (D-14) | N-W (NW-09) e I-W (IW-14): o narrador manda o link; o iniciante, sem conta, abre o link | Login/cadastro com o aviso do convite; depois "Entrar com convite" preenchido; a URL sem o `#` |
   | T-43 (D-14) | N-A (NA-05), iOS: Compartilhar | A folha do sistema com a mensagem nova (link, o que tocar no app, validade) |
   | T-43 | E-A (diário 14:37), Android: salvar 33 alterações e ir a Jogo; PO-W (12:20), web 390: forma Crinos | O toast acima do dock, sem cobrir Sangue e FdV |
   | T-44 | N-W (NW-06), Chromium 390 e 1280: Compartilhar | "Copiar mensagem" no lugar, a mensagem copiada, sem `pageerror` |
   | T-45 | N-W (NW-07, NW-08), web 390: dois convites → Revogar um | Confirmação com o foco em "Cancelar"; "Convite 1 · … às …" e "Convite 2 · … às …" distinguíveis |
   | T-30 | QA-W (QAW-07) e I-W (IW-12), web 390: Nova ficha → F5 → "‹" | Volta à crônica; sem "GO_BACK" no console |
   | Achado 6 | N-A, Android (o AVD da onda 3): Mesa → seleção → voltar até sair | Um voltar desliga a seleção, o seguinte sai da crônica |
   | T-51 | N-A (NA-04), iOS, 7 crônicas; I-A (IA-26), conta nova | As ações no topo; na lista vazia, "Entrar com convite" primeiro |
   | T-73 | I-W (IW-18), I-A (IA-11, IA-25), QA-A (QAA-27): cadastro com "Lucas Novato" e e-mail corrigido; QA-W (QAW-12): e-mail já usado; PO-A (POA-34): login com e-mail sem domínio | O erro que some ao corrigir e diz o problema; o 409 com o próximo passo; o erro no campo E-mail |
   | T-82 | PO-A (POA-44), iOS; PO-W (13:14), web: remover a única jogadora | "<nome> foi removido da crônica.", "Nenhum jogador agora…", a ficha com "Arquivada"; o toast também no web |

   **Critério de saída da onda** ("a fase 2 do Narrador — acompanhar, ajudar, devolver, concluir — repetida no app e no web"): é do P09-D. O P12 entra antes dela, no "convidar e o jogador entra". O roteiro da integração começa pelo link do P12 para pôr J1 e J2 nas crônicas novas.
6. Conferência no aparelho e no navegador: o roteiro da seção 11, com o T-44 obrigatório no web sem Web Share API (Chromium e WebKit), o T-51 e o T-82 no iOS e o achado 6 no Android.
7. Um resumo (o que mudou, como foi testado, achados da revisão), que vira a seção do P12 no PR da onda 5.

## 8. Ordem dos commits, esforço, riscos e conflitos

### 8.1 Commits

Cada commit diz tudo o que entra nele. Nenhum toca template, `schema.json`, `@tms/sheet-core`, `packages/db` ou o seed.

| # | Commit | Itens | Conteúdo, por arquivo |
|---|---|---|---|
| 1 | `test(api): o aceite do convite não deixa o código no log` | T-43 | `apps/api/src/__tests__/logger-output.test.ts`: o caso do aceite válido e do inválido. Passa antes e depois (guarda) |
| 2 | `fix(telemetry): a redação tira o código do convite e o fragmento` | T-43 | `apps/api/src/http/safe-error.ts` (`redact`) e `apps/frontend/lib/telemetryFilter.ts` (`redact`, a cópia), com a mesma regra; `safe-error.test.ts`, `telemetryFilter.test.ts` e `telemetryWeb.test.ts` |
| 3 | `feat(api): o número do convite na lista do narrador` | T-45 | `apps/api/src/chronicles/routes.ts` (`GET /chronicles/:id/invites`, `row_number`); `chronicles.test.ts` e `authz.test.ts` |
| 4 | `fix(ui): o aviso fica dentro da folha também no web, acima do rodapé` | T-43 | `packages/ui/src/Toast.tsx` (`ModalToastHost` sem a exclusão do web; `offset`); `packages/ui/src/BottomSheet.tsx` (mede o `footer`); `packages/ui/src/Button.tsx` (`ref`); `components.test.tsx`, `a11y.test.tsx`; `design/design-system/components.md` (Toast l.653 e Button) |
| 5 | `fix(app): o dock e o aviso de bônus erguem o toast` | T-43 | `apps/frontend/sheet/play/CombatDock.tsx` e `apps/frontend/sheet/creation/CreationPanel.tsx` (`BonusNotice`): `onLayout` + `useToastOffset`; `play.test.tsx`, `CreationScreen.test.tsx` |
| 6 | `feat(app): link de convite, lido antes do roteador e tirado da URL` | T-43 (D-14) | `apps/frontend/index.ts` (import antes de `expo-router/entry`); `lib/invite/link.ts`, `lib/invite/pending.ts`, `lib/invite/capture.ts`, `lib/invite/capture.web.ts` (novos); `lib/env.ts` (origem do web); `app/+native-intent.tsx` (novo); `lib/session/session.ts` (o `logout` limpa o pendente); `.env.example` (`EXPO_PUBLIC_WEB_URL`, comentada); os testes `inviteLink`, `inviteCapture`, `invitePending`, `native-intent` e `env` |
| 7 | `feat(app): sem sessão, o convite passa pelo login e pelo cadastro` | T-43 (D-14) | `app/(auth)/_layout.tsx`, `app/(auth)/login.tsx`, `app/(auth)/register.tsx` (banner e destino `/join`); `app/(app)/join.tsx` (campo preenchido, banner da conta, `maxLength` 64, sem query); `auth-screens.test.tsx`, `_layout.test.tsx`, `chronicles.test.tsx` (bloco do `JoinScreen`) |
| 8 | `feat(app): a folha do convite com link, mensagem e "Copiado ✓"` | T-43, T-44 | `components/chronicles/InviteSheet.tsx` (link, mensagem, botões, região viva, validade da resposta); `lib/invite/share.ts` (novo: `canShareNatively` e o compartilhar com as três saídas); `lib/queries/chronicles.ts` (o tipo com `number`); `chronicles.test.tsx`, `inviteShare.test.ts` |
| 9 | `fix(app): revogar o convite pede confirmação, com o foco` | T-45 | `InviteSheet.tsx` (confirmação na linha, número, dia e hora); `lib/focus.ts` (novo, o `focusView`) e `sheet/layouts/anchor.ts` (passa a reexportar); `chronicles.test.tsx`, `chronicles.a11y.test.tsx` |
| 10 | `fix(app): o "voltar" sai também sem tela de baixo` | T-30, achado 6 | `lib/navigation.ts` (novo, `useBackTo`); `sheet/navigation.ts` (usa o `useBackTo`); `app/(app)/join.tsx`, `app/(app)/chronicles/new.tsx`, `app/(app)/chronicles/[id]/new-character.tsx`, `app/(app)/chronicles/[id]/index.tsx` (l.137), `sheet/UnsupportedTemplate.tsx`; `navigation-back.test.tsx` (novo), `new-character.test.tsx`, `chronicles.test.tsx`. Se o diagnóstico confirmar a hipótese (d): a troca de aba no web substitui a entrada do histórico, em `chronicles/[id]/index.tsx` (`selectView`) |
| 11 | `fix(app): criar e entrar no topo da lista` | T-51 | `app/(app)/index.tsx` (botões no cabeçalho; lista vazia com "Entrar com convite" primeiro); `chronicles.test.tsx` |
| 12 | `fix(app): mensagens claras no cadastro, no login e no convite` | T-73 | `lib/authMessages.ts` (novo), `lib/validation.ts`; `app/(auth)/login.tsx`, `app/(auth)/register.tsx`, `app/(app)/join.tsx`; `validation.test.ts`, `auth-screens.test.tsx`, `chronicles.test.tsx` |
| 13 | `fix(app): remover diz "removido", e a lista diz "agora"` | T-82 | `components/chronicles/MemberSheets.tsx` (l.42); `app/(app)/chronicles/[id]/index.tsx` (l.406-410); `members.test.tsx`, `chronicles.test.tsx` |
| 14 | `test(e2e): convite por link, voltar, toast e mensagens` | todos | `e2e/tests/invite-link.spec.ts` e `navigation.spec.ts` (novos); `chronicles.spec.ts`, `auth.spec.ts`, `account.spec.ts`, `journey-storyteller.spec.ts`, `play.spec.ts` |
| 15 | `docs(planos): P12, desvios` | — | A seção 10 |

Os commits 1 a 5 são independentes entre si. O 7 depende do 6; o 8, do 4 e do 6; o 9, do 3, do 4 e do 8; o 12 encosta no `join.tsx` do 7 e do 10.

### 8.2 Esforço

| Item | Esforço | Por quê |
|---|---|---|
| T-43 (D-14 e toast) | M (4 dias) | Leitura no web e no app, o fluxo sem sessão, a folha nova, o aviso no `@tms/ui` e as barras fixas, com testes em três camadas |
| T-44 | P (1 dia) | Detecção e três saídas; o E2E no WebKit |
| T-45 | M (2 dias) | Confirmação com foco nas três plataformas, o número na API e a AuthZ |
| T-30 e achado 6 | P (1,5 dia) | O `useBackTo` é pequeno; o diagnóstico do achado 6 com `renderRouter` e o `history.length` |
| T-51 | P (0,5 dia) | Mover os botões e a lista vazia |
| T-73 | P (1,5 dia) | Mapeamento por status, validação ao digitar e os textos |
| T-82 | P (0,5 dia) | Dois textos e a conferência do selo |
| E2E e roteiro manual (seção 11) | 2 dias | Três plataformas, deep link no Android e no iOS, contas novas e os limites |

**Total: 4 P e 2 M nas linhas, uns 13 dias com E2E e roteiro**, perto do que a matriz estima (4 P, 3 M, 13 dias). O T-44 cabe em P.

### 8.3 Riscos

| Risco | Efeito | Mitigação |
|---|---|---|
| O import de `capture` deixa de rodar antes do roteador (alguém reordena o `index.ts`, ou o Biome organiza os imports) | O código entra em `params['#']` e num breadcrumb | Comentário no `index.ts`; o Biome não reordena através de import de efeito colateral, mas um teste confere a primeira linha do `index.ts`; o E2E do fragmento quebra se isso acontecer |
| O Expo Router mudar o tratamento do fragmento ou do `+native-intent` numa versão nova | Código no estado de navegação | Os testes do `native-intent` e do `inviteCapture`, e o `check:native` na subida de SDK |
| O aviso dentro da folha, no web, cobre o conteúdo da folha | Um "Desfazer" sobre a lista da folha | O `offset` do rodapé; o aviso dura 5 s e pausa com ponteiro; o E2E mede no painel |
| `EXPO_PUBLIC_WEB_URL` ausente num build nativo publicado fora do Render | O link do app aponta para a origem da API | A origem da API é a mesma do web no deploy de hoje; a pergunta 4 decide a variável no build da loja |
| O app nativo antigo (sem o `+native-intent`) recebe um `tms://join#…` | Abre a lista, sem preencher; o código vai para o `params['#']` do app antigo, só em memória | O link compartilhado é `https`; o `tms://` só chega por quem o monta |
| A confirmação na linha quebra a largura a 360 | Botões cortados | Medir a 360 no AVD e no web (seção 11); a linha quebra em duas |
| A frase genérica nova do convite muda o E2E de outros pacotes | Spec vermelho na integração | A lista da seção 4.2; o P12 ajusta os specs que tocam esses textos |
| O diagnóstico do achado 6 não reproduz | O item fecha sem correção | O teste prende o comportamento; o roteiro repete no AVD e registra na seção 10 |
| Os limites do roteiro (10 aceites a cada 15 min por IP, 5 cadastros por hora por IP) | O roteiro para com 429 | Contagem da seção 11.a, com uma plataforma por vez |

### 8.4 Conflitos com os pacotes da onda

| Pacote | Onde encosta | Como resolver |
|---|---|---|
| **P09-D** (D-10) | `app/(app)/chronicles/[id]/index.tsx`: o P09-D recolhe o painel e sobe as abas; o P12 muda o "‹" (l.137), a lista vazia de participantes (l.406-410) e, se a hipótese (d) se confirmar, o `selectView`. `app/(app)/index.tsx`: o P09-D põe a contagem no `chronicleMeta` (l.28-54); o P12 move os botões (l.65-77, l.131). `components/chronicles/CreationSettings.tsx:259`: o toast "Regras da criação salvas." é do P09-D (seção 2). `sheet/creation/CreationPanel.tsx`: a aba "Pontos" em leitura do P09-D e o `BonusNotice` do P12. E2E: `journey-storyteller.spec.ts` e `narrator.spec.ts` | **O P12 entra depois do P09-D** e rebaseia as suas linhas, que são poucas e em trechos diferentes. O texto do toast de remoção (`journey-storyteller.spec.ts:287`) é do P12 |
| **P14-D** (D-15) | `chronicles/[id]/index.tsx` (a leitura da Descrição) | Trechos diferentes; quem entrar depois rebaseia |
| **P13** | `@tms/ui`: o P13 pode mexer no `Stepper` e no texto do toast de salvar (T-53, "De efetivo"); o P12 mexe no `Toast.tsx`, na `BottomSheet.tsx` e no `Button.tsx`. `packages/ui/src/components.test.tsx` e `index.ts` nos dois. `sheet/` (o P12 só toca o `CombatDock` e o `BonusNotice`) | Sem conflito de lógica. O texto do toast é do P13; onde ele aparece é do P12. Quem entrar depois rebaseia o `components.test.tsx`. **Um build nativo na integração** cobre os dois |
| **P15-D** (D-16) | Migration `0024` e os templates | Sem conflito: o P12 não tem migration nem toca template |
| **P16-D** (D-17) | — | Sem contato |
| **P01-D** (D-13) | Registra a D-14 nos planos v0 (Etapa 10) e v3 (Etapa 7) | O P01-D entra por último e descreve o convite como o P12 deixou; o P12 não edita `doc/plano-v*.md` |

### 8.5 Arquivos tocados

**API**
- `apps/api/src/chronicles/routes.ts` (só o `GET /chronicles/:id/invites`)
- `apps/api/src/http/safe-error.ts` (`redact`)
- Testes: `apps/api/src/__tests__/chronicles.test.ts`, `authz.test.ts`, `logger-output.test.ts`, `safe-error.test.ts`

**`@tms/ui`**
- `packages/ui/src/Toast.tsx`, `BottomSheet.tsx`, `Button.tsx`
- `packages/ui/src/components.test.tsx`, `a11y.test.tsx`
- `design/design-system/components.md` (Toast, Button)

**App**
- `apps/frontend/index.ts`
- `apps/frontend/app/+native-intent.tsx` (novo)
- `apps/frontend/app/(auth)/_layout.tsx`, `login.tsx`, `register.tsx`
- `apps/frontend/app/(app)/index.tsx`, `join.tsx`, `chronicles/new.tsx`, `chronicles/[id]/index.tsx`, `chronicles/[id]/new-character.tsx`
- `apps/frontend/components/chronicles/InviteSheet.tsx`, `MemberSheets.tsx`
- `apps/frontend/lib/invite/link.ts`, `pending.ts`, `capture.ts`, `capture.web.ts`, `share.ts` (novos)
- `apps/frontend/lib/navigation.ts`, `focus.ts`, `authMessages.ts` (novos)
- `apps/frontend/lib/env.ts`, `validation.ts`, `telemetryFilter.ts`, `queries/chronicles.ts`, `session/session.ts`
- `apps/frontend/sheet/navigation.ts`, `UnsupportedTemplate.tsx`, `layouts/anchor.ts`, `play/CombatDock.tsx`, `creation/CreationPanel.tsx` (só o `BonusNotice`)
- `.env.example` (uma linha comentada)
- Testes: `app/__tests__/chronicles.test.tsx`, `members.test.tsx`, `auth-screens.test.tsx`, `_layout.test.tsx`, `new-character.test.tsx`, `native-intent.test.ts` (novo), `navigation-back.test.tsx` (novo); `lib/__tests__/inviteLink.test.ts`, `inviteCapture.test.ts`, `invitePending.test.ts`, `inviteShare.test.ts` (novos), `env.test.ts`, `validation.test.ts`, `telemetryFilter.test.ts`, `telemetryWeb.test.ts`; `components/chronicles/__tests__/chronicles.a11y.test.tsx`; `sheet/play/__tests__/play.test.tsx`; `sheet/creation/__tests__/CreationScreen.test.tsx`

**E2E**
- `e2e/tests/invite-link.spec.ts`, `navigation.spec.ts` (novos)
- `e2e/tests/chronicles.spec.ts`, `auth.spec.ts`, `account.spec.ts`, `journey-storyteller.spec.ts`, `play.spec.ts`

**Não toca:** `design/templates/*`, `packages/sheet-core/`, `packages/db/`, `apps/api/src/auth/`, `apps/api/src/options.ts`, `scripts/seed-roteiro.ts`, `scripts/web-headers.mjs`, `deploy/`, `app.json`.

## 9. Perguntas abertas (técnicas)

| # | Pergunta | Padrão do plano | Por que importa |
|---|---|---|---|
| 1 | O código pendente fica só em memória, ou também no `sessionStorage` (web) e no `SecureStore` (app)? | Só em memória, por 30 min | Em disco, ele sobrevive a recarregar a página no meio do login, mas fica num lugar a mais. Em memória, quem recarrega abre o link de novo |
| 2 | **Ponto para o PO e para segurança:** o rótulo do convite é o número automático (padrão), um rótulo livre do narrador ou o final do código? | Número automático + dia e hora, sem migration | O rótulo livre pede coluna, campo e cuidado com dado pessoal. O final do código exige guardar parte do segredo em claro: **decisão de segurança, sem decisão neste plano** (seção 3.3.b) |
| 3 | **Ponto para o PO:** abrir o app a partir do link `https` (App Links e Universal Links), ou um botão "Abrir no app" na tela web `/join`? | Fora do P12; o app trata `tms://`, e o link compartilhado é `https` (abre o web) | Os dois pedem build nativo novo. As App Links pedem também `assetlinks.json` e `apple-app-site-association` no domínio. O "Abrir no app" usa `tms://`, que outro app pode sequestrar (seção 5) |
| 4 | Como o build da loja recebe a origem do web (`EXPO_PUBLIC_WEB_URL`)? | A variável no build; sem ela, a origem da API (a mesma no Render) | O link do app tem de apontar para o web certo |
| 5 | Reservar espaço na rolagem enquanto o toast aparece (para não cobrir o último botão da página)? | Não: o P09-D tira o toast das regras, e as barras fixas já erguem o aviso | Um espaço que entra e sai mexe no conteúdo; sem ele, o aviso cobre por 5 s o que estiver embaixo |
| 6 | No web, a troca de aba da crônica deve empilhar no histórico (o voltar passa pelas abas) ou substituir (o voltar sai da crônica)? | Substituir, se o E2E mostrar que empilha (seção 3.4, hipótese d) | É a pergunta 6 da onda 3. Define quantos "voltar" saem da crônica no web |
| 7 | A `redact` do código vale para toda sequência de 26 caracteres do alfabeto, ou só perto de "convite" e de `#`? | Toda sequência de 26 do alfabeto Crockford (com ou sem os espaços do formato) | Um falso positivo só apaga um texto de diagnóstico; um falso negativo manda o código |
| 8 | O número do convite também vai na resposta do `POST` (para o topo do convite novo, sem esperar a lista)? | Não: o app busca a lista depois de gerar e acha o convite pelo id | No `POST`, dois convites gerados ao mesmo tempo poderiam receber o mesmo número; o `row_number` da lista não tem esse problema |
| 9 | O "Copiado ✓" dura 2 s? | 2 s, com a região viva | Curto demais para o leitor de tela não importa: o anúncio é da região viva |
| 10 | O texto da mensagem pronta e das frases do T-73 | Rascunho do time (seções 3.1.g, 3.5 e 3.6), para revisão | O mecanismo não muda |

## 10. Desvios

O que a implementação fez diferente deste plano, e por quê. Nenhum desvio muda regra do jogo, remove campo ou afrouxa limite; o servidor continua a autoridade.

Implementação em 05 e 06/11/2026, na `pacote/p12-convite-entrada` (a partir de `52dbe0f`), em paralelo com os outros pacotes da onda. Os pontos para o PO e as perguntas técnicas seguiram o padrão deste plano (seção 9); nada foi decidido aqui. Rótulo do convite: só o número automático. O rótulo livre, o final do código, App Links/Universal Links e escolher validade e usos ficaram fora.

**Desvios de desenho:**

1. **Commit 1: o teste do log entrou em `chronicles.test.ts`, e não no `logger-output.test.ts`.** O `logger-output` roda o Pino em outro processo, sem a app. O teste espiona o `logger` da API em todos os níveis, como o `observability.test.ts`, e prova que nem o código nem o `sha256` dele aparecem, num aceite válido e num inválido. O log de query do banco não é espionado: ele não exporta o logger, e o `formatEvent` já não leva parâmetros (`packages/db/src/logger.ts`).
2. **Commit 3: a matriz de AuthZ não ganhou linha.** O `GET /chronicles/:id/invites` já está na matriz, com narrador 200, dono e jogador 403 e os outros papéis 404. O `number` só existe na resposta 200. O `chronicles.test.ts` confere que o 403 do jogador não traz o campo.
3. **Commit 5: o `BonusNotice` não chama o `useToastOffset`.** Ele é uma `BottomSheet`, não uma barra fixa. Com ele aberto, o aviso já fica dentro do painel e acima do rodapé (commit 4). A captura do "aviso de conclusão sobre o rodapé" (`iniciante-web/68`) é do dock ("Todos os recursos"), que o commit 5 cobre.
4. **Commit 6: o `+native-intent.tsx` lê o caminho com regex, sem `new URL`.** Assim o resultado é o mesmo no Hermes e no Jest. O `capture.web.ts` também escuta o `popstate`: o roteador do Expo lê `pathname + search + hash` no `popstate` (`browserHistoryAdapter.js`). Como o nosso ouvinte é registrado antes, o código sai da URL antes de o roteador lê-la.
5. **Commit 9: "Convites ativos" virou um `Text` com `ref` e `tabIndex={-1}`**, passados por spread, como no `AnchorHeader`. O `SectionHeader` não expõe o `ref` do título, e o pacote não o mudou.
6. **Commit 10: o achado 6 foi reproduzido, e a hipótese (a) se confirmou** com o roteador de verdade (`renderRouter`, `navigation-back.test.tsx`). O `replace('/')` deixava a pilha com duas listas; com `useBackTo`, fica uma. Para o teste rodar fora do mock, o `jest.config.js` do app passou a transformar o `standard-navigation` (ESM). O teste também restaura o mock da safe area, que o `resetMocks` apaga. A hipótese (d), a troca de aba empilhar entradas no web, não foi corrigida: o `navigation.spec.ts` prende o comportamento atual (`history.length` igual) e falha se ela empilhar.
7. **Commit 12: o 400 do cadastro ganhou frase própria** ("Confira o e-mail, o nome de usuário e a senha."), que a tabela 3.6 não trazia. O login perdeu a faixa "Informe o e-mail e a senha": os dois erros vão para os campos ("Informe um e-mail válido.", "Informe a senha."). As frases do `validateRegister` ganharam ponto final.
8. **Commit 14: os E2E foram escritos e não rodados.** Eles rodam só na integração, por causa das portas fixas. O `headers.spec.ts` também mudou ("E-mail ou senha incorretos", com maiúscula). As medidas novas no `play.spec.ts` (toast acima do dock) e o `elementFromPoint` do toast de remoção no `journey-storyteller.spec.ts` não entraram. O Jest cobre o deslocamento (`play.test.tsx`), e o roteiro (seção 11) confere os dois na tela.

**O `ref` do `Button` e o P13 (rebase):**

9. Este pacote só repassa a prop `ref` ao `Pressable` (`packages/ui/src/Button.tsx`, tipo `Ref<ComponentRef<typeof View>>`). O P13, que entra antes, põe um `ref` interno para o `blocked` (`markSoftDisabled`). No rebase, o `Button` passa a usar um *callback ref* que entrega a mesma vista aos dois:

   ```tsx
   const merged = useCallback((view) => {
     inner.current = view          // o do P13 (blocked)
     if (typeof ref === 'function') ref(view)
     else if (ref) ref.current = view
   }, [ref])
   <Pressable ref={merged} … />
   ```

   O teste do P12 (`components.test.tsx`, "o ref chega à vista do botão") e os do `blocked` do P13 têm de passar juntos depois do rebase.

**Revisões:**

10. **`/security-review` no diff inteiro (`52dbe0f..HEAD`): sem achado com confiança alta.** Foram conferidos:
    - o `capture.web.ts`: o fragmento num formato fechado, que nunca vira rota, e o `replaceState` antes do roteador e do Sentry;
    - o `+native-intent.tsx`: só `join` guarda o código, e qualquer outra URL perde o fragmento;
    - as duas `redact`, que são só regex;
    - o `GET` com `row_number`: sem entrada do usuário no SQL e com o `requireStoryteller` mantido;
    - o aceite sem toque nenhum: o banner diz a conta que vai entrar;
    - o redirecionamento pós-login, para um caminho fixo (`/join`).

    Nenhuma rota, limite, status ou texto da API de aceite e de autenticação mudou.

    Resíduos conhecidos, os da seção 5:
    - o histórico global do navegador guarda a URL original;
    - a área de transferência ao copiar;
    - o `tms://` sem App Links.
11. **`/code-review` (high): 10 achados, todos corrigidos em commits `fix` com teste de regressão:**
    - **o convite pendente saía só no `logout()`** (`50780e2`). Agora sai também em toda saída de uma sessão aberta: o `#clearLocal` cobre conta excluída, refresh recusado e logout em outra aba. Na abertura sem sessão, não sai.
    - **o código sobrevivia a sair de "Entrar com convite"** por outro caminho que não o "‹" (o voltar do Android, o gesto do iOS) (`000dd58`). Agora a tela o apaga ao desmontar, um tique depois, para a remontagem do StrictMode não apagar.
    - **o login recusava o que a API aceita** (`8968486`). Agora confere só que o e-mail não está vazio e tem "@". O cadastro mantém a regra da API. Isto muda o item 7 acima: o "nome@" do POA-34 agora vai à API e volta com o 401 genérico.
    - **o cadastro perdia campo no preenchimento automático** (`8968486`). Voltou ao `setForm` funcional, e o erro do campo vem de `registerFieldError(key, value)`.
    - **o "‹ Crônicas" da crônica aberta pela Conta voltava à Conta** (`1b06892`). Foi escolhida a saída menor: o "Abrir <crônica>" da Conta usa `replace`, e a lista fica por baixo. O rótulo continua fixo.
    - **o `peekPendingInvite` (o getSnapshot) expirava o código na leitura** (`50780e2`). Agora a validade é um `setTimeout` que apaga e avisa.
    - **a regex do fragmento era quadrática e o web redigia antes de cortar** (`567360f`). Agora é um passe linear por token (`redactFragments`), e o `text()` do web corta acima de 2000 caracteres antes de redigir (o `MAX_MESSAGE_SCAN` da API). O teste usa 64 KB de "/" e de base64, com limite de 200 ms.
    - **a frase do 5xx lia o sufixo do texto formatado** (`52421a0`). Agora o `AuthError` guarda o `requestId`, e o `authMessage` chama o `withErrorCode`.
    - **a regex da redação está duplicada entre web e API** (`567360f`). Nenhum pacote que os dois já importam (`@tms/config`, `@tms/sheet-core`) é lugar de telemetria, então a cópia ficou. Em troca, um teste em cada lado prende a classe `INVITE_CHAR` ao `ALPHABET` do `invite-code.ts` (agora exportado). O teste do web também lê a classe do `safe-error.ts` e compara as duas.
    - **o `ErrorBoundary` da ficha tinha o voltar próprio** (`6236a73`). Agora usa o `useBackTo('/')`.

    A confirmação do revogar continua aberta quando a API falha, com o erro na faixa da folha.

**Para o roteiro (seção 11) e a integração:**

12. O build nativo é obrigatório: o `@tms/ui` mudou (`Toast`, `BottomSheet`, `Button`).
13. A conferir na tela:
    - o deep link `tms://join#…` no Android e no iOS;
    - o aviso dentro da folha no web, também no WebKit;
    - a confirmação do revogar a 360 dp;
    - o achado 6 no AVD.

## 11. Testes manuais (web, Android com AVD, iOS com idb)

O roteiro confere cada item na interface, nas três plataformas, com a API local e o seed do roteiro (só contas fictícias `@roteiro.test`). Ele detalha o passo 6 da seção 7. A coluna "Resultado" fica em branco e é preenchida na integração.

**Regra deste roteiro:** o código e o link do convite nunca aparecem em captura, log do roteiro, saída de terminal, nome de arquivo ou relatório.

- Os scripts guardam o link num arquivo do scratchpad com permissão `600` e o leem só por variável.
- As capturas que mostrariam o código são mascaradas (web) ou recortadas (nativo) antes de gravar.
- Os dumps de árvore passam por um filtro que troca o código por `[convite]`.
- No fim, os arquivos de link são apagados.

### 11.a Preparação

- **Ambiente:**
  - `npx pnpm bootstrap`, `npx pnpm db:up` e `npx pnpm db:migrate`. Confira pela tabela `kysely_migration`, porque o comando pode travar na saída ([onda-4.md](onda-4.md) §11). Este pacote não tem migration;
  - `npx pnpm dev:api` (porta 3001), com a saída num log do scratchpad;
  - `cd apps/frontend && EXPO_PUBLIC_WEB_URL=http://localhost:8081 npx expo start`. É o Metro na 8081, para o web e o nativo, com a origem do link apontando para o web de desenvolvimento. A saída vai para um log do scratchpad.
- **Seed:** `npx pnpm seed:roteiro --fichas-criacao > <scratchpad>/seed-p12-<plataforma>.log 2>&1` (permissão `600`), lido só com `grep -v -i -E 'senha|convite N2'`. O seed imprime a senha, os e-mails **e o código do convite do N2** (`scripts/seed-roteiro.ts:602`). A senha é a constante do seed: o operador a lê no arquivo, nunca a copia para o roteiro, os scripts ou as capturas.
- **O que o seed já cobre** (`scripts/seed-roteiro.ts:16-35`):
  - as contas N, J1, J2 e N2;
  - por sistema, as crônicas "{Sistema} v3/v5" (criação livre, com J1 e J2) e "{Sistema} v4" (por pontos), com J1 e J2. N2 não está nelas;
  - com `--fichas-criacao`, as fichas de J1 da onda 3 (Isadora, Otto, Ficha Livre R…);
  - 7 crônicas ou mais para o N, o caso do NA-04 (T-51).
- **O que o roteiro cria pela tela** (só dados fictícios, nomes em ASCII):
  1. por plataforma, uma crônica "Cronica P12 <plataforma>" (V20), criada pelo N, para o T-45 e o T-82 começarem sem jogadores;
  2. por plataforma, uma conta nova `p12_<plataforma>@roteiro.test`, criada pelo link sem sessão (T-43). A senha dela é fictícia, gerada pelo script, guardada no arquivo `600` do scratchpad e nunca escrita no roteiro;
  3. no T-82, a conta nova cria uma ficha só com o nome ("Teste Removida") antes de ser removida.
- **O seed não precisa mudar** para este pacote.
- **Limites, e quanto cada plataforma gasta.** O `dev:api` guarda os limites em memória. Na máquina local, todas as plataformas chegam do mesmo IP (o AVD pelo `adb reverse`, o simulador e o navegador pelo localhost), então os limites por IP são **divididos** entre as contas e as plataformas. O seed em processo usa um limitador próprio por conta e não gasta os do `dev:api` (`scripts/seed-roteiro.ts:36-40`). Mesmo assim, segue a regra da onda: um seed por plataforma, com 15 min entre um e outro.

  | Plataforma | Convites gerados | Tentativas de aceite (todas contam, inclusive a inválida) | Cadastros |
  |---|---|---|---|
  | Web | 3 (dois na "Cronica P12 Web" para o T-45; um em "Vampiro v4" para o T-43) | 3: N2 pelo link com sessão; a conta nova pelo link sem sessão; N2 com o link revogado (T-73) | 2: a conta nova; um 409 com e-mail já usado (T-73) |
  | Android | 2 (um pelo script web, em "Lobisomem v4", para o deep link; um no app, na "Cronica P12 Android") | 2: a conta nova pelo deep link sem sessão; N2 pelo deep link com sessão | 1 |
  | iOS | 2 (um pelo script web, em "Mago v4"; um no app, na "Cronica P12 iOS") | 2 | 1 |

  São no máximo 3 aceites por plataforma. O teto é 10 a cada 15 min por IP e por conta. N2 faz 2 no web, 1 no Android e 1 no iOS. Os cadastros somam 4, e o teto é 5 por hora por IP: **o 409 do T-73 só no web**. Com uma plataforma por vez e 15 min entre os seeds, nada chega ao limite. Se um 429 aparecer, a linha fica "não conferido (429)" e a plataforma espera 15 min. Nenhum limite muda.
- **Os links por arquivo.** O script web (logado como N) gera o convite, lê o `invite-link-value` e grava em `<scratchpad>/p12-link-<plataforma>.txt` (`600`): o link `https` e a forma `tms://join#…` para o nativo. Nada vai para a saída padrão.

### 11.b Web (Playwright, Chromium e WebKit)

- O script fica no scratchpad da sessão, usa o `playwright` do `node_modules` do repositório e roda contra o Metro (`http://localhost:8081`). Ele não entra no repositório.
- Viewport exato de `390 × 844` e `1280 × 800`, um `browser.newContext({ viewport })` por largura e uma conta por contexto.
- **WebKit** no T-44 (navegador sem Web Share API: o script apaga `navigator.share` com `addInitScript`, porque o WebKit do Playwright no macOS pode ter o método), no T-45 (o foco pelo teclado) e no T-43 (o fragmento fora da URL).
- Seletores por papel e rótulo (os da seção 4.3), com `exact` onde o texto se repete. Um screenshot por passo, com `mask: [getByTestId('invite-code-value'), getByTestId('invite-link-value'), getByLabel('Código do convite')]` em toda captura que possa ter o código.
- `page.on('pageerror')`, `page.on('console')` e `page.on('request')` gravam num log do scratchpad, depois de trocar o código por `[convite]`.
- O Metro web pode ficar com o bundle velho depois de editar o código: reiniciar com `--clear`.

### 11.c Android (AVD)

- **AVD** `Pixel_3a_API_34_extension_level_7_arm64-v8a` (1080 × 2220, 440 dpi = 393 dp), com `-cores 4 -memory 3072 -gpu host` ([onda-4.md](onda-4.md) §11). O AVD não tem TalkBack.
- **APK Debug:** `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` em `apps/frontend/android`, com o `JAVA_HOME` do JBR do Android Studio, e `adb install -r`. O `@tms/ui` muda, então o APK é refeito (o JS vem do Metro, mas o build da integração confere o nativo).
- **Rede:** `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3001 tcp:3001`.
- **Largura de layout:** a confirmação do "Revogar" e os botões da folha também a 360 dp (`adb shell wm density 480`) e a 411 dp (`420`). No fim, `adb shell wm density reset`.
- **Teclado de software:** `adb shell settings put secure show_ime_with_hard_keyboard 1`; no fim, `0`. O `input text` não digita acento: os nomes são ASCII.
- **O deep link, sem o código no log:**

  ```bash
  set +x
  LINK="$(sed -n 2p <scratchpad>/p12-link-and.txt)"   # a forma tms://join#…
  adb shell "am start -W -a android.intent.action.VIEW -d '$LINK' com.tms.app" >/dev/null 2>&1
  unset LINK
  ```

  A saída do `am start` vai para `/dev/null`, porque ela repete a URI. Depois, `adb logcat -d | grep -c -F -f <arquivo só com o código>` deve dar `0`; esse `grep` imprime só a contagem.

  O link `https` também é aberto no Chrome do AVD (`adb shell am start -a android.intent.action.VIEW -d '<link https>'`, pelo mesmo caminho), para conferir o web no celular. O Chrome do Android tem Web Share API: lá aparece "Compartilhar".
- **Navegação:**
  - `adb shell uiautomator dump /sdcard/ui.xml` e `adb pull`, para achar o alvo pelo `content-desc` ou pelo texto. O XML passa pelo `sed` que troca o código por `[convite]` antes de ficar no scratchpad;
  - `adb shell input tap X Y` no centro do alvo;
  - `adb exec-out screencap -p > <tmp>.png`. Com o código na tela, a captura é recortada com o `sips --cropOffset` do macOS para a faixa dos botões (pelas `bounds` do dump), e o original é apagado na hora.

  O LogBox do rodapé engole toques: dispensar antes.
- **O voltar do Android** (`adb shell input keyevent KEYCODE_BACK`): com a folha aberta, fecha a folha; com a confirmação aberta, fecha a folha sem revogar; e o achado 6.
- Tempo medido no emulador sob carga não é evidência ([onda-3.md](onda-3.md) §11, achado 1). Desligar o AVD antes da rodada do iOS.

### 11.d iOS (simulador com idb)

- **Simuladores:** iPhone SE (3ª geração), iOS 18.x, e iPhone 17, iOS 26.5. Os UDIDs saem de `xcrun simctl list devices`.
- **Build Debug para o simulador, com "Sign to Run Locally":** `xcodebuild -workspace apps/frontend/ios/TMS.xcworkspace -scheme TMS -configuration Debug -sdk iphonesimulator -destination 'id=<UDID>' -derivedDataPath <scratchpad>/ios-build CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build`. Sem assinatura, o app abre mas não loga: o keychain responde `-34018`. Depois, `xcrun simctl install <UDID> <...>/TMS.app` e `xcrun simctl launch <UDID> com.tms.app`.
- **idb:**
  - o cliente `fb-idb` 1.7.7 no venv `~/.venvs/idb-tms`, fora do repositório; antes de usar, `pip-audit` no venv de novo (com vulnerabilidade sem correção, o iOS fica "não conferido");
  - o cliente não entra no `package.json` nem no lockfile;
  - `--companion-path /opt/homebrew/bin/idb_companion` vem antes do subcomando;
  - o companion fica só local, no socket de domínio: sem `--grpc-port` e sem `idb connect` com host e porta. No fim, `lsof -nP -iTCP -sTCP:LISTEN | grep -i idb` não mostra nada.
- **O driver esconde valores:** o `describe-all` mostra o valor dos campos ([onda-4.md](onda-4.md) §11, achado 7). O driver troca por `***` o valor de "E-mail", "Senha" e "Código do convite", e troca por `[convite]` qualquer texto no formato do código (o rótulo "Código do convite: …" da folha, o link), antes de imprimir ou gravar.
- **Navegação:**
  - `idb ui describe-all --udid <UDID>` acha o alvo pelo `AXLabel`; tocar no centro do `frame` com `idb ui tap`;
  - `idb ui text`, `idb ui swipe` e `idb ui key`;
  - `idb screenshot --udid <UDID> <tmp>.png`. Com o código na tela, a captura é recortada com o `sips` como no Android, e o original é apagado.
- **O deep link:** `idb open --udid <UDID> "$LINK"`, com o `LINK` lido do arquivo como no Android e a saída em `/dev/null`. O sistema pergunta "Abrir em 'TMS'?": achar "Abrir" pelo `describe-all` e tocar. No fim, `xcrun simctl spawn <UDID> log show --last 10m | grep -c -F -f <arquivo do código>` deve dar `0`.
- **Limites do idb:**
  - não faz o gesto de borda: usar o "‹";
  - não digita fora do ASCII;
  - digita como teclado físico, e o teclado de software some depois do primeiro texto.

### 11.e Roteiro por item

Evidências com o nome `p12-<plataforma>-<ID>-<passo>.png` (por exemplo, `p12-and393-T-45-1.png`). Os passos de cada plataforma rodam na ordem das tabelas: primeiro o que o N faz, depois o logout e o link sem sessão, depois o N2.

**T-43 (D-14) · Link, sem sessão e o fragmento**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-43 | Web 390 (Chromium) | N | "Vampiro v4" → Convidar → Gerar convite | "Convite n", o link, o código, a validade e os usos tirados da resposta; os três botões | `p12-web390-T-43-1.png` (mascarada) | |
| T-43 | Web 390 | N | "Copiar link" | "Copiado ✓" no botão; no DOM, a região `aria-live="polite"` com "Link copiado."; `elementFromPoint` no centro do botão é o botão | `p12-web390-T-43-2.png` (mascarada) | |
| T-43 | Web 390 (Chromium e WebKit) | N2 | Abrir o link (do arquivo) num contexto com N2 | URL `/join`, `location.hash` vazio; o campo preenchido; "Você vai entrar como" o usuário do N2; nada enviado até o toque | `p12-web390-T-43-3.png`, `p12-wk390-T-43-3.png` (mascaradas) | |
| T-43 | Web 390 | N2 | "Entrar na crônica" → `page.goBack()` duas vezes | A crônica; nenhuma URL do histórico com `#` | `p12-web390-T-43-4.png` | |
| T-43 | Web 1280 (Chromium) | sem sessão → conta nova | Contexto novo; abrir o link | `/login` com o aviso do convite, sem código na tela | `p12-web1280-T-43-5.png` | |
| T-43 | Web 1280 | conta nova | "Criar conta" → cadastrar `p12_web@roteiro.test` | "Entrar com convite" preenchido → entrar → a crônica | `p12-web1280-T-43-6.png` (mascarada) | |
| T-43 | Web 1280 | — | O log do script: requisições, `referer` e console | Nenhuma ocorrência do código (contagem 0), fora o corpo do aceite | `p12-web1280-T-43-7.txt` (só as contagens) | |
| T-43 | Web 390 | J1 | "Isadora Web" → "Salvar" → Jogo (dock) → uma ação com toast | O toast acima do dock (o `bottom` do toast acima do topo do dock) | `p12-web390-T-43-8.png` | |
| T-43 | Android 393 | N2 | App com N2 → deep link `tms://join#…` (o convite de "Lobisomem v4") | "Entrar com convite" preenchido, com a conta do N2; entrar → a crônica | `p12-and393-T-43-1.png` (recortada) | |
| T-43 | Android 393 | sem sessão → conta nova | Sair → deep link do mesmo convite | Login com o aviso; "Criar conta" → `p12_and` → preenchido → entrar | `p12-and393-T-43-2.png`, `-3.png` | |
| T-43 | Android 393 | — | `adb logcat`, o log do Metro e o da API | Contagem 0 do código | `p12-and393-T-43-4.txt` | |
| T-43 | Android 393 | J1 | "Isadora Android" → "Salvar" com alterações → Jogo | "Salvo: …" acima do dock, sem cobrir Sangue e FdV (o caso do E-A) | `p12-and393-T-43-5.png` | |
| T-43 | Android 393 | — | O link `https` no Chrome do AVD, com N2 logado no web | O web preenchido; "Compartilhar" existe (Chrome tem Web Share) | `p12-and393-T-43-6.png` (recortada) | |
| T-43 | iOS iPhone SE | N2 | `idb open` com o `tms://join#…` de "Mago v4" → "Abrir" | Preenchido, com a conta do N2; entrar | `p12-iosse-T-43-1.png` (recortada) | |
| T-43 | iOS iPhone 17 | sem sessão → conta nova | Sair → `idb open` do mesmo convite → "Abrir" → "Criar conta" | Login com o aviso; depois preenchido; entrar | `p12-ios17-T-43-2.png` | |
| T-43 | iOS iPhone 17 | N | "Cronica P12 iOS" → Convidar → Gerar → "Copiar link" | "Copiado ✓"; no `describe-all`, o botão "Copiado" | `p12-ios17-T-43-3.png` (recortada) | |

**T-44 · Compartilhar sem Web Share API** (obrigatório no web)

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-44 | Web 390 (Chromium, `navigator.share` apagado) | N | Folha com o convite gerado | O botão se chama "Copiar mensagem" | `p12-web390-T-44-1.png` (mascarada) | |
| T-44 | Web 390 (Chromium) | N | "Copiar mensagem" | "Copiado ✓", a região viva; `pageerror` vazio; o texto colado tem o link e o código (lido por variável, comparado, nunca impresso) | `p12-web390-T-44-2.png` (mascarada) | |
| T-44 | Web 1280 (WebKit, `navigator.share` apagado) | N | O mesmo | O mesmo, sem `pageerror` | `p12-wk1280-T-44-3.png` (mascarada) | |
| T-44 | Web 1280 (Chromium, `navigator.share` falso que rejeita) | N | "Compartilhar" | A mensagem copiada e a frase "O navegador não abriu o compartilhamento…"; sem `pageerror` | `p12-web1280-T-44-4.png` (mascarada) | |
| T-44 | Android 393 | N | "Cronica P12 Android" → Compartilhar | O seletor do Android abre (conferido pelo dump, sem captura: a prévia mostra o link) | `p12-and393-T-44-5.xml` (filtrado) | |
| T-44 | iOS iPhone SE | N | "Cronica P12 iOS" → Compartilhar | A folha do sistema abre (pelo `describe-all`, sem captura) | `p12-iosse-T-44-6.txt` (filtrado) | |

**T-45 · Revogar com confirmação e convites distinguíveis**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-45 | Web 390 (Chromium e WebKit) | N | "Cronica P12 Web" → gerar dois convites no mesmo minuto → fechar e abrir a folha | "Convite 1 · criado em … às …" e "Convite 2 · … às …"; os usos e a validade com hora | `p12-web390-T-45-1.png`, `p12-wk390-T-45-1.png` | |
| T-45 | Web 390 | N | Tab até "Revogar convite 2" → Enter | A confirmação na linha; o foco em "Cancelar" (`document.activeElement`) | `p12-web390-T-45-2.png` | |
| T-45 | Web 390 | N | Enter em "Cancelar" | A linha volta; o foco no "Revogar convite 2"; nenhum `DELETE` | `p12-web390-T-45-3.png` | |
| T-45 | Web 390 | N | "Revogar convite 2" → "Revogar convite" | Um `DELETE` 204; a linha some; o foco em "Convites ativos" | `p12-web390-T-45-4.png` | |
| T-45 | Web 1280 | N | O mesmo, no diálogo central de 560 | A confirmação cabe no diálogo, medido no painel (`bottom-sheet-root > [aria-modal="true"]`) | `p12-web1280-T-45-5.png` | |
| T-45 | Android 393, 360 e 411 | N | "Cronica P12 Android" → um convite → "Revogar convite 1" | A confirmação sem corte; o voltar do Android fecha a folha sem revogar (o convite continua na lista ao reabrir) | `p12-and393-T-45-1.png`, `p12-and360-T-45-1.png`, `p12-and411-T-45-1.png` | |
| T-45 | iOS iPhone SE | N | "Cronica P12 iOS" → "Revogar convite 1" → "Cancelar" → "Revogar" → "Revogar convite" | No `describe-all`, "Cancelar" e "Revogar convite" visíveis e alcançáveis (T-41); no fim, a lista sem o convite | `p12-iosse-T-45-1.png` | |

**T-30 e achado 6 · Voltar**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-30 | Web 390 (Chromium) | J1 | "Vampiro v4" → Nova ficha → F5 → "‹" | A crônica; sem "GO_BACK" no console | `p12-web390-T-30-1.png` | |
| T-30 | Web 1280 | J1 | `/join` direto → "‹"; `/chronicles/new` direto → "‹" | A lista nos dois | `p12-web1280-T-30-2.png` | |
| Achado 6 | Web 1280 | N | Crônica → Fichas → Mesa → Bastidores → voltar do navegador | O comportamento da seção 3.4 (d): sai da crônica, ou volta uma aba, como o E2E prendeu | `p12-web1280-A6-1.png` | |
| Achado 6 | Android 393 | N | Lista → "Vampiro v4" → Mesa → tocar e segurar um cartão (seleção) → voltar → voltar | O 1º voltar desliga a seleção; o 2º leva à lista; o 3º sai do app | `p12-and393-A6-1.png`, `-2.png` | |
| Achado 6 | Android 393 | N | Lista → crônica → "‹" → voltar | O voltar sai do app (uma lista só na pilha) | `p12-and393-A6-3.png` | |
| T-30 | iOS iPhone 17 | J1 | Nova ficha → "‹" | A crônica (pelo "‹"; o gesto de borda fica fora do idb) | `p12-ios17-T-30-1.png` | |

**T-51 · Ações no topo** (obrigatório no iOS)

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-51 | iOS iPhone SE | N | Lista de crônicas (7 ou mais), sem rolar | "Criar crônica" e "Entrar com convite" na primeira tela, no `describe-all` com `frame` dentro da tela | `p12-iosse-T-51-1.png` | |
| T-51 | iOS iPhone 17 | conta nova do iOS | Sair da crônica que entrou e ver a lista vazia | "Entrar com convite" primeiro e primário; a frase nova | `p12-ios17-T-51-2.png` | |
| T-51 | Android 393 | N | Lista | As ações no topo | `p12-and393-T-51-1.png` | |
| T-51 | Web 390 | N | Lista | As ações no topo, dentro dos 844 | `p12-web390-T-51-1.png` | |

**T-73 · Mensagens**

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-73 | Web 390 (Chromium) | sem sessão | Cadastro vazio → "Criar conta" → corrigir o e-mail | O erro do e-mail some sem novo envio | `p12-web390-T-73-1.png` | |
| T-73 | Web 390 | sem sessão | Nome "Lucas Novato" | "Use só letras minúsculas."; trocar por "lucas novato" → "Sem espaços: use _ no lugar."; "lucas_novato" → sem erro | `p12-web390-T-73-2.png` | |
| T-73 | Web 390 | sem sessão | Cadastro com o e-mail da J1 (409; o único 409 do roteiro) | A frase genérica com o próximo passo, sem dizer qual dado existe | `p12-web390-T-73-3.png` | |
| T-73 | Web 390 | N2 | O link do convite revogado no T-45 → "Entrar na crônica" | "Este convite não vale mais ou o código está errado. Confira o código ou peça um novo ao narrador." | `p12-web390-T-73-4.png` (mascarada) | |
| T-73 | iOS iPhone SE | sem sessão | Login com "nome@" (o POA-34) | O erro no campo E-mail, sem requisição (o log da API sem o `POST /auth/login`) | `p12-iosse-T-73-5.png` | |
| T-73 | iOS iPhone SE | sem sessão | Cadastro: errar, corrigir e olhar (o IA-11) | O erro some ao corrigir | `p12-iosse-T-73-6.png` | |
| T-73 | Android 393 | sem sessão | Login com uma senha errada para o e-mail do N2 | "E-mail ou senha incorretos. Confira e tente de novo." | `p12-and393-T-73-7.png` | |

**T-82 · Remover** (obrigatório no iOS)

| ID | Plataforma e tamanho | Conta | Passos | Esperado | Evidência | Resultado |
|---|---|---|---|---|---|---|
| T-82 | iOS iPhone SE | conta nova do iOS, depois N | A conta nova entra na "Cronica P12 iOS" (o convite do T-43) e cria "Teste Removida"; N → Participantes → Remover → Remover | O toast "… foi removido da crônica."; "Nenhum jogador agora. Convide os jogadores com um link."; "Teste Removida" com "Arquivada" em Fichas | `p12-iosse-T-82-1.png`, `-2.png` | |
| T-82 | Web 1280 (Chromium) | N | O mesmo na "Cronica P12 Web", com a conta nova do web | O toast visível no web, no topo do `elementFromPoint` | `p12-web1280-T-82-1.png` | |
| T-82 | Android 393 | N | O mesmo na "Cronica P12 Android" | Os mesmos textos e o selo | `p12-and393-T-82-1.png` | |

**Folhas que este pacote muda** (sem regressão), conferidas nos passos acima:

- o Esc no web fecha a folha "Convidar";
- o foco volta ao "Convidar";
- o diálogo de 560 a 1280, medido no painel;
- o voltar do Android fecha a folha;
- no iOS, o "×" fecha;
- o toast de uma folha de recurso em Jogo aparece dentro dela, acima do rodapé.

### 11.f Acessibilidade mínima

- **"Copiado ✓" anunciado (T-43):**
  - no web, a região `aria-live="polite"` com "Link copiado." no DOM, sempre montada;
  - no Android, o `uiautomator dump` mostra o texto; sem TalkBack no AVD, o anúncio fica para ouvir no aparelho;
  - no iOS, o botão "Copiado" no `describe-all`; o `announceForAccessibility` fica para ouvir com o VoiceOver.
  - Nada só por cor ou ícone: o "✓" vem com o texto.
- **A confirmação de "Revogar" (T-45):** no web, o foco em "Cancelar" ao abrir e de volta no "Revogar convite <n>" ao cancelar (`document.activeElement`); no app, o foco do leitor de tela (`sendAccessibilityEvent`) fica para conferir no aparelho, porque o `describe-all` não expõe o foco.
- **Os nomes:** "Revogar convite 1" e "Revogar convite 2" distintos na árvore das três plataformas; "Copiar mensagem" no lugar de "Compartilhar" quando é isso que o botão faz.
- **Os erros de campo (T-73):** associados ao campo (`aria-describedby` no web, a dica no `describe-all`), e não só em vermelho.
- **O banner do convite no login e na tela de convite:** texto na árvore, com papel de status.

A árvore é o DOM no web, o `uiautomator dump` no Android e o `describe-all` no iOS. O AVD não tem TalkBack: o anúncio do "Copiado ✓", o foco da confirmação e o banner ficam para ouvir no aparelho, com o VoiceOver e o TalkBack ([onda-4.md](onda-4.md) §11, "não conferido").

### 11.g Limpeza

- **Convites de teste revogados:** o N revoga, na folha, os ativos das crônicas "Cronica P12 *" e os gerados em "Vampiro v4", "Lobisomem v4" e "Mago v4".
- **Contas de teste:**
  - as contas `p12_<plataforma>@roteiro.test` são excluídas pela tela (Conta → Excluir conta; limite de 5 a cada 15 min);
  - as crônicas "Cronica P12 *" são excluídas pelo N (com o nome digitado, se houver ficha de outro jogador).
- **Os arquivos de link e de código** do scratchpad são apagados. Os logs do seed, do Metro e da API ficam no scratchpad, sem a senha (filtrada na leitura) e com o código trocado por `[convite]` antes de qualquer cópia.
- Parar o Metro e a API (Ctrl+C). O Postgres do Docker é compartilhado: nunca `db:down`.
- **Android:** `adb shell wm density reset`, `adb shell settings put secure show_ime_with_hard_keyboard 0`, `adb reverse --remove-all` e `adb emu kill`.
- **iOS:** `xcrun simctl shutdown all`, encerrar o `idb_companion` e desativar o venv; conferir com o `lsof` que nada escuta. O build fica no scratchpad, e o venv, em `~/.venvs/idb-tms`.
- As capturas ficam com a integração, sem e-mail, token, senha nem código.

### 11.h Quando não der para conferir

Se uma plataforma não puder ser conferida, a coluna "Resultado" diz **"não conferido"** e o motivo:

- o `fb-idb` não roda ou o `pip-audit` acusa vulnerabilidade sem correção;
- o build não fecha;
- o AVD não sobe;
- um 429 do limite de convites ou de cadastro (a plataforma espera 15 min e repete; nenhum limite muda).

Nunca "ok" sem a evidência. São obrigatórios:

- o T-44 no web sem Web Share API (Chromium e WebKit);
- o T-51 e o T-82 no iOS;
- o achado 6 no Android;
- o deep link (T-43) no Android e no iOS.

Sem algum deles, ele fica como pendência da onda, como na [onda-2.md](onda-2.md) §10.
