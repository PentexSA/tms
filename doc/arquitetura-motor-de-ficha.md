# Arquitetura do motor de ficha

> Proposta · 2026-10-17 · ainda não implementada

Este documento descreve **como o app e a API executam o contrato de template**: como o JSON guardado no banco vira tela, e como cada toque na tela volta ao banco como um evento validado.

| Documento | Responde |
|---|---|
| [`design/templates/README.md`](../design/templates/README.md) | **O que** um template pode dizer: tipos, seções, regras e a segurança do contrato |
| [`design/design-system/components.md`](../design/design-system/components.md) | **Como** cada componente se parece e se comporta |
| este documento | **Como o código** transforma template + ficha em tela, guarda offline e sincroniza |

O protótipo [`design/telas/prototipo.js`](../design/telas/prototipo.js) já prova a ideia para 6 sistemas. Este documento é o plano para levá-la ao Expo e ao Elysia com tipos, testes e camadas separadas.

---

## 1. Em uma frase

> **O motor é um interpretador: recebe dois JSON (template e ficha) e devolve tela; recebe gestos e devolve eventos.**

O código conhece tipos genéricos (`rating`, `resource`, `list`...). O template conhece o sistema (Vampiro, D&D, CoC, Fate). Um sistema novo é **dado**, não código.

O padrão se chama **schema-driven UI** (ou metadata-driven UI). Ele é parente do *server-driven UI*, com uma diferença importante:

| | Server-driven UI (ex.: Airbnb Ghost Platform) | Schema-driven (TMS) |
|---|---|---|
| O servidor manda | a tela pronta, a cada request | a semântica da ficha (campos, tipos, seções, regras por nome), uma vez por versão |
| O cliente decide | quase nada | como desenhar cada tipo, em cada tamanho de tela |
| Offline | difícil: a tela depende do request | natural: o template fica em cache por versão |
| Acessibilidade | depende de cada tela | vem do tipo: todo `rating` anuncia "Destreza, 2 de 5" |
| Segurança | o servidor controla a UI | o template nunca vira código, só cita nomes de listas fechadas |

---

## 2. Decisões que guiam o desenho

Tomadas em 2026-10-17. Quando uma delas mudar, revise a seção indicada.

| Tema | Decisão | Consequência no desenho | Seção |
|---|---|---|---|
| Quem cria templates | Só o dono do app | Sem homebrew. As regras continuam em listas fechadas, sem fórmula no banco. A publicação é um script, sem rota de escrita. | §5.3, §8.1 |
| Escopo da v0 | Só Vampiro: A Máscara (V20) | Só o `vtm-v20` é publicado. O D&D 5e entra apenas como fixture de teste, para o código não se acoplar a WoD. | §10.1 |
| Tamanho do primeiro passo | Começar simples | O MVP usa um subconjunto do contrato. Todo tipo tem uma view genérica de fallback, então qualquer template aparece na tela desde o primeiro dia. | §6.2, §10 |
| Criação com orçamento de pontos | Futuro | Fica reservado um ponto de extensão (`creation`), sem código agora. | §11 |
| Offline | Sim | Cache persistido + outbox de eventos. O WatermelonDB foi avaliado e não é recomendado para a ficha. | §7 |
| Versão do template e migração de fichas | Fora por enquanto | Só guardamos com qual versão a ficha nasceu. Custa quase nada e evita dor depois. | §8.3, §11 |
| Tempo real na mesa | Não | Sem WebSocket. A ficha é rebuscada ao focar a tela e ao reconectar; o conflito é detectado pelo `from` do evento. | §6.6 |
| Skin pode trocar componente | Sim | Registry com overrides por skin, além de tokens e glifos. | §6.4 |
| Plataforma | App primeiro, web sempre | Só React Native + react-native-web; lib nativa só com par web; adapters `.native.ts` / `.web.ts`. | §6.7 |

---

## 3. Visão geral

```text
                         ┌─────────────── API (Elysia / Bun) ───────────────┐
  pnpm templates:publish │  schema.json + validateTemplate                  │
  (só o dono) ──────────►│      └► trait_templates (system, version)        │
                         │                                                  │
                         │  GET  ficha   → AuthZ → remove seções restritas  │
                         │  POST eventos → AuthZ → idempotência →           │
                         │                 applyBatch → validateSheet →     │
                         │                 grava ficha + histórico          │
                         └───────────▲──────────────────────┬───────────────┘
                                     │ lotes de eventos     │ template + ficha
                         ┌───────────┴──────────────────────▼───────────────┐
                         │  App (Expo: iOS, Android, web)                   │
                         │                                                  │
                         │  outbox ◄── SheetStore ◄── TanStack Query        │
                         │  (fila)     snapshot +     (cache persistido)    │
                         │             pendentes                            │
                         │                 │ assinatura por campo           │
                         │                 ▼                                │
                         │  compileTemplate → SheetModel                    │
                         │      → <SheetRenderer> → registry → @tms/ui      │
                         └──────────────────────────────────────────────────┘

           @tms/sheet-core: o mesmo código valida e calcula nos dois lados
```

Três ideias sustentam tudo:

1. **Um núcleo sem tela (`@tms/sheet-core`)**, em TypeScript puro, usado pela API e pelo app. Cada regra de jogo existe uma vez só. No cliente ela valida por conveniência; no servidor, por autoridade.
2. **Um registry de componentes por tipo** no app. O renderizador não tem `switch` por tipo: ele pergunta ao registry "quem desenha um `resource` como chip?".
3. **Toda alteração é um evento** (`{ path, from, to }`) dentro de um lote atômico. O lote é o que vai para a fila offline, para o servidor, para o histórico e para o Desfazer.

---

## 4. Pacotes e fronteiras

| Onde | O que tem | Depende de | Não pode depender de |
|---|---|---|---|
| `packages/sheet-core` (`@tms/sheet-core`, novo) | tipos do contrato, listas fechadas, `compileTemplate`, validadores, derivações, regras, rolagens, efeitos, eventos, permissões | nada (TS puro) | React, React Native, `@tms/db`, APIs de plataforma |
| `apps/frontend/sheet/` (novo) | renderizador, registry de views, layouts, skins, store, outbox | `@tms/sheet-core`, `@tms/ui` | `@tms/db` (exceto `import type`) |
| `packages/ui` (`@tms/ui`) | primitivos (`RatingDots`, `Stepper`, `BoxTrack`, `BottomSheet`...) e `tokens.ts` gerado de `design/design-system/tokens.json` | React Native | template, `@tms/sheet-core` |
| `apps/api` | rotas de template, ficha e eventos | `@tms/sheet-core`, `@tms/db` | – |

- **O renderizador começa dentro do app**, não num pacote, porque hoje só o app o usa. Quando aparecer um segundo consumidor (ex.: um preview de template para o dono), ele vira `packages/sheet-react`.
- **`@tms/ui` não conhece template.** O mesmo `Stepper` serve ao Sangue do Vampiro e aos PV do D&D. Quem traduz "campo do template" em "props do primitivo" é a view do tipo (§6.2).
- **O app só importa tipos de `@tms/db`.** Um import de valor levaria o client do Postgres para o bundle.

**Multi-sistema:** nenhum pacote tem nome de sistema. O que é de um sistema mora no template (dados) ou na skin (família visual).

---

## 5. `@tms/sheet-core`: o núcleo sem tela

### 5.1 Estrutura

```text
packages/sheet-core/src/
├── contract/        tipos TS do template e da ficha (espelham schema.json)
├── registry.ts      listas fechadas (porta do REGISTRY de validate.mjs)
├── validate/        validateTemplate e validateSheet (porta de validate.mjs)
├── compile.ts       template → SheetModel (§5.2)
├── resolve.ts       valores efetivos: modificadores, tetos e derivados
├── fields/          um FieldType por tipo (§6.2): rating.ts, resource.ts...
├── derive.ts        abilityModifier, vtmBloodPool, half...
├── rules.ts         wod-stacking, boxes, tempFirst, mage-quint-paradox
├── rollers.ts       pool-success, sum-vs-target, roll-under-percent, fudge, pbta-2d6
├── effects.ts       health.heal, resource.spend, rest.long...
├── events.ts        applyEvent, applyBatch, invert
├── permissions.ts   canRead, canWrite, stripRestricted
└── random.ts        RNG injetado: crypto.randomInt (servidor), getRandomValues com rejeição (cliente)
```

Critério da porta: os 6 templates e `design/templates/exemplos/personagens.json` passam igual a hoje, e um teste compara os `enum` de `schema.json` com `registry.ts` (contrato §9).

### 5.2 Do JSON ao modelo: `compileTemplate`

O template chega do servidor como JSON. Antes de desenhar qualquer coisa, `compileTemplate` o transforma num `SheetModel` imutável:

1. **Recusa o que não conhece.** `schema` diferente de `1`, ou qualquer nome fora das listas fechadas (`type`, `layout`, `derive`, `rule`, `roll.model`, `skin`), gera o erro `UnsupportedTemplate`, e a tela mostra "Atualize o app". Cliente antigo nunca adivinha (fail secure).
2. **Indexa os campos** num `Map` e resolve as referências (`cap.field`, `max.field`, `from`, `roll.slots[].from`).
3. **Ordena zonas e seções.** A ordem das zonas é do app (`identity`, `play`, `build`, `powers`, `lore`); a ordem das seções, do template.
4. **Monta o grafo de derivados** e o ordena topologicamente. É a mesma ideia do `prepareDerivedData` do Foundry VTT: derivado nunca é gravado, é calculado. Ciclo é erro.
5. **Pré-calcula por campo** a seção, a zona, as permissões, o `editableIn` efetivo e o valor padrão.
6. **Congela** (`Object.freeze`) e memoiza por `system@templateVersion`.

```ts
export interface SheetModel {
  system: string
  version: string
  skin: SkinName
  fields: ReadonlyMap<string, CompiledField> // definição + seção, zona, permissões
  zones: readonly CompiledZone[] // em ordem fixa, cada uma com suas seções
  derivedOrder: readonly string[] // ordem topológica dos campos readOnly
  dock: readonly string[]
  roll: CompiledRoll
}
```

A cada mudança de valor, `resolve(model, values)` calcula o **valor efetivo** de cada campo:

- o valor base;
- os modificadores de `state`, com a origem ("3 + 4 da forma Crinos = 7");
- o teto não destrutivo (`cap`);
- os derivados.

A view nunca calcula regra: ela recebe o valor pronto.

### 5.3 Regras do core

- **Funções puras.** Sem I/O, sem relógio e sem `Math.random`: o que varia (hora, RNG) é injetado.
- **Lookup por nome** com `Object.hasOwn` e allowlist. Nomes de `Object.prototype` são proibidos como id.
- **Nunca** `eval`, `new Function`, `vm` nem biblioteca de expressão. O `expr-eval`, por exemplo, tem RCE conhecida (CVE-2025-12735, CVSS 9.8). Como só o dono cria templates, as derivações continuam como funções nomeadas.
- **Derivações com nome de sistema** (`vtmBloodPool`, `cocHitPoints`, `dnd5eCheckBonus`) são código de um jogo dentro do core. Isso é aceitável enquanto só o dono publica templates. O custo é que um sistema novo com uma conta nova pede um release do app. Se o projeto adotar EAS Update, a mudança de JS sai sem passar pela loja. Em qualquer caso, o template novo só é publicado **depois** que a versão do app que conhece o nome estiver no ar (contrato §9, passo 5).

**Multi-sistema:** o core é onde "um nome novo serve todos os sistemas". `half` e `fifth` nasceram para o CoC e valem para qualquer sistema percentual; `boxes` serve os testes contra a morte do D&D, o Estresse do Fate e o PbtA.

---

## 6. Renderização no app

### 6.1 A árvore

A árvore de componentes segue a do template (padrão Composite):

```text
SheetScreen
├─ CharacterHeader        zona identity: nome, selo, resumo, voz
├─ Tabs                   build · powers · lore, com rótulo de zoneLabels
│  └─ ZoneView
│     └─ SectionView      título, filtro, busca, permissão de leitura
│        └─ LayoutView    registry de layouts (§6.3)
│           └─ FieldSlot  registry de tipos (§6.2) → view → primitivos de @tms/ui
└─ Dock                   campos de template.dock na variante chip, + botão Dados
```

### 6.2 Registry de tipos

Cada tipo do contrato tem **duas metades**, uma em cada camada:

```ts
// packages/sheet-core/src/fields/types.ts: sem React, roda no Bun e no Expo
export interface FieldType<F extends FieldDef, V> {
  defaultValue(field: F): V
  validate(field: F, value: unknown, ctx: SheetCtx): Issue[] // autoridade no servidor
  short(field: F, value: V, ctx: SheetCtx): string // "5/7", "+3 Bom", "2 letal"
  describe(field: F, value: V, ctx: SheetCtx): string // "Destreza, 2 de 5"
  rollOptions?(field: F, value: V, ctx: SheetCtx): RollOption[]
}

// apps/frontend/sheet/views/types.ts
export type Variant = 'row' | 'cell' | 'chip' | 'fact' | 'editor'

export interface FieldView<F extends FieldDef, V> {
  row?: ComponentType<FieldProps<F, V>> // layouts list e groups
  cell?: ComponentType<FieldProps<F, V>> // layout grid
  chip?: ComponentType<FieldProps<F, V>> // dock, lista compacta, mesa
  fact?: ComponentType<FieldProps<F, V>> // identidade (termo e valor)
  editor?: ComponentType<FieldProps<F, V>> // sheet de edição
}
```

O registry é um objeto indexado pela lista fechada de tipos. Com o `satisfies`, o **build falha** se um tipo do contrato ficar sem entrada. Isso substitui os 10 `switch (f.type)` e os 43 `f.type === '...'` do protótipo:

```ts
// apps/frontend/sheet/views/index.ts
export const baseViews = {
  rating: ratingView,
  number: numberView,
  resource: resourceView,
  text: {}, // ainda sem view própria: cai no GenericRow
  // ...os 14 tipos de REGISTRY.fieldTypes
} satisfies Record<FieldTypeName, FieldView<any, any>>
```

**A view genérica é o que deixa o MVP simples.** `GenericRow` mostra o rótulo e o `short()`, e usa o `describe()` como rótulo acessível. Ela serve para **qualquer** tipo. No primeiro dia, a ficha de Vampiro aparece inteira em modo Leitura, e qualquer outro template também (é o que o fixture de D&D testa, §10.1). Depois, cada tipo ganha seu componente rico sem mexer no resto.

```tsx
// apps/frontend/sheet/FieldSlot.tsx
export function FieldSlot({ id, variant }: { id: string; variant: Variant }) {
  const field = useField(id) // definição compilada (estável)
  const value = useResolvedValue(id) // assina só este campo
  const skin = useSkin()
  const View = resolveView(skin, field.type, variant)
  return <View field={field} value={value} />
}
```

### 6.3 Layouts

Layout e tipo são **dois eixos independentes**. O layout decide a disposição e pede a cada campo uma *variante*. O tipo decide como se desenhar nessa variante. Assim, 7 layouts × 14 tipos não viram 98 componentes.

| `layout` | Variante pedida | Na Fase 1 |
|---|---|---|
| `facts` | `fact` | sim |
| `list` | `row` | sim |
| `text` | `row` (texto em bloco) | sim |
| `fields` (zona `play`) | `row` na coluna, `chip` no dock | sim |
| `groups` | `row`, com título por grupo | cai em `list` com títulos |
| `grid` | `cell` | cai em `list` |
| `pyramid` | `chip` agrupado por degrau | cai em `list` |

O registry de layouts tem a mesma forma do registry de tipos, com `list` como fallback. Um layout que ainda não existe **degrada**, nunca quebra.

### 6.4 Skins

Uma skin (`wod`, `dnd`, `coc`, `fate`) tem três partes, todas **no código do app**. O template só escolhe o nome, de uma lista fechada:

| Parte | Exemplo |
|---|---|
| Tokens | fonte display e de voz, forma do pip (`design/design-system/skins/*.json`) |
| Glifos | lua do augúrio (WoD), glifos de dano |
| Overrides de componente | a skin WoD troca a `cell` de `rating` por pips grandes; a skin D&D troca a `cell` de `number score+mod` pelo bloco de atributo com o modificador em destaque |

A resolução segue uma ordem fixa. Por isso não precisamos do mecanismo de *tester + rank* do JSON Forms, que só compensa quando terceiros registram renderers:

```ts
// apps/frontend/sheet/views/resolve.ts
export function resolveView(skin: Skin, type: FieldTypeName, variant: Variant) {
  const override = Object.hasOwn(skin.views, type)
    ? skin.views[type]?.[variant]
    : undefined
  const base = Object.hasOwn(baseViews, type) ? baseViews[type] : undefined
  return override ?? base?.[variant] ?? base?.row ?? GenericRow
}
```

Regras dos overrides:

- Recebem **as mesmas props** da view base.
- Não mudam a validação, o `short()` nem o `describe()`, que vêm do core. Trocar o visual não muda o que o leitor de tela ouve nem o que o servidor aceita.
- Passam no **mesmo teste de acessibilidade** da view base. O teste roda para cada combinação skin × tipo × variante registrada.

### 6.5 Estado e re-render

Cada ficha aberta tem um `SheetStore` (Zustand, com seletores por campo):

```text
values = applyAll(snapshot, pendentes)
          │          └─ lotes ainda no outbox (otimista)
          └─ última versão confirmada pelo servidor (cache do TanStack Query)
```

- **Assinatura por campo.** `useResolvedValue('blood')` assina **só** o Sangue. Gastar 1 Sangue re-renderiza o chip do dock e a linha do Sangue, não as dezenas de atributos e habilidades.
- **Modos.** `read`, `play` e `evolve`. O modo é UX, não controle de acesso. Em `evolve`, as alterações formam um **rascunho** ("N alterações") que vira **um** lote ao salvar.
- **Desfazer.** Uma pilha de lotes invertidos (`invert(batch)` do core). Desfazer é só mais um lote.

Zustand foi escolhido por ser pequeno, funcionar igual no nativo e no web e permitir seletor por campo sem Provider aninhado.

### 6.6 O caminho de um toque

Exemplo: o jogador toca **−1** no Sangue, no dock.

1. A view chama `commit([{ path: 'values.blood', from: { current: 10 }, to: { current: 9 } }])`.
2. O store roda o `applyBatch` do core **no aparelho**. Se o lote for inválido (ex.: abaixo de 0), ele nem sai do aparelho.
3. O lote ganha um `clientBatchId` (UUID) e entra no **outbox persistido**. A tela mostra o aviso com Desfazer.
4. Só o Sangue re-renderiza.
5. Com rede, o outbox envia `POST /characters/:id/events` com o lote e o `clientBatchId`.
6. O servidor roda AuthZ → idempotência → `applyBatch` → `validateSheet`, grava a ficha e o histórico com `by` e `at` **dele** e responde com a nova versão da ficha.
7. O app remove o lote do outbox e atualiza o snapshot no cache.

Quando algo dá errado:

| Resposta | O que o app faz |
|---|---|
| sem rede, 5xx, 408, 429 | mantém o lote no outbox e tenta de novo com backoff |
| 409 (o `from` não bate: alguém mudou antes) | descarta o lote, rebusca a ficha e mostra o aviso de conflito ("a narradora alterou a Vitalidade enquanto você estava offline"), com a opção de reaplicar, que gera um lote novo com o `from` atualizado |
| 400, 403, 422 (inválido ou sem permissão) | descarta o lote e reverte o otimista, sem tentar de novo |
| 401 | renova a sessão e tenta de novo; sem sessão, pausa a fila e pede login |

**Sem tempo real** (decisão do §2): a ficha é rebuscada ao **focar a tela**, ao **reconectar** e depois de cada lote confirmado. A mesa do narrador faz o mesmo, sem WebSocket.

### 6.7 App primeiro, web sempre

- **Só React Native + react-native-web.** Nada de DOM direto, nada de `dangerouslySetInnerHTML`.
- **Lib nativa só com par web.** Quando a implementação difere por plataforma, o Metro resolve `storage.native.ts` e `storage.web.ts` pelo sufixo, e o resto do código importa só `./storage`.
- **Breakpoints vêm dos tokens** (`compact`, `medium`, `expanded`, via `useWindowDimensions`). O layout lê o breakpoint; o template não sabe nada de tamanho de tela.
- **Fonte grande e 360 dp** reorganizam a ficha pela mesma regra do protótipo: com `fontScale ≥ 1,3` ou largura < 360, a grade vira lista.
- **Listas longas** começam com `FlatList` / `SectionList`, que funcionam nas três plataformas. A troca por FlashList v2 só acontece se a medição pedir. Ela exige a New Architecture, que o app já usa (`newArchEnabled: true`); confira o suporte web antes de trocar.
- **A mesma acessibilidade nas duas plataformas.** O `describe()` do core alimenta `accessibilityLabel` e `accessibilityValue` no nativo e os atributos `aria-*` no web (via react-native-web).

**Multi-sistema:** registry, layouts, store e fluxo de eventos não conhecem sistema. A skin é por família (WoD, d20, BRP, Fate), não por jogo, e é o único lugar em que um componente pode ser "do sistema".

---

## 7. Offline

### 7.1 As peças

| Peça | O que guarda | Implementação |
|---|---|---|
| Cache de leitura | templates (por `system@version`, longa duração) e fichas | TanStack Query (já no projeto) com `@tanstack/react-query-persist-client` |
| Outbox | lotes de eventos ainda não confirmados | módulo próprio e pequeno (§7.3) |
| Storage | onde as duas peças gravam | `storage.native.ts` → `expo-sqlite/kv-store` (confira na versão do SDK em uso); `storage.web.ts` → IndexedDB |
| Rede | online e offline | `onlineManager` do TanStack Query ligado ao `@react-native-community/netinfo` |

### 7.2 Regras de segurança do que fica no aparelho

- **Tokens nunca vão para o cache nem para o outbox.** No nativo, ficam no `expo-secure-store`. No web, em cookie `httpOnly` + `Secure` + `SameSite`, fora do `localStorage`.
- **Seções restritas nunca chegam** ao aparelho de quem não pode lê-las, porque o servidor as remove antes de responder (contrato §11).
- **Tudo é separado por usuário.** A chave do storage leva o id do usuário, e o logout apaga o cache e o outbox.
- **O que vem do disco é input hostil.** Ao reidratar, o template passa por `compileTemplate` e a ficha por `validateSheet`. Se falhar, o dado é descartado e rebuscado.
- **Criptografia em repouso no nativo** (Etapa 22, `apps/frontend/sheet/sync/encryptedStorage.ts`):
  - **Banco:** o storage é uma tabela num banco SQLCipher próprio (`tms-offline.db`, plugin `expo-sqlite` com `useSQLCipher` no `app.json`). A interface `KeyValueStorage` não mudou. Exige dev build.
  - **Chave:** 32 bytes aleatórios do `expo-crypto`, gerados no primeiro uso. Ficam só no `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, como o refresh token) e entram como raw key no `PRAGMA key`, a primeira instrução de cada conexão. Nunca aparecem em log, no banco nem em outro storage.
  - **Fail secure:**
    - sem chave (reinstalação, backup restaurado, o banco sem cifra da Etapa 20), o banco é apagado e recomeça vazio. O servidor é a fonte da verdade;
    - chave que não abre o banco: apaga e recomeça;
    - SecureStore com falha: nada é aberto sem chave; o storage fica em memória naquela sessão e o banco fica intacto;
    - binário sem SQLCipher (Expo Go): em produção, memória; só em desenvolvimento abre sem cifra.
  - **Log:** leva só o tipo do problema (`secure-store`, `wrong-key`, `no-sqlcipher`, `sqlite`).
  - **Web:** não há equivalente; a mitigação é apagar tudo no logout.
- **Android** com `allowBackup: false`, sem `usesCleartextTraffic` no manifest de release (cleartext só nos de debug, para o Metro), e o ATS do iOS ligado. `sheet/sync/__tests__/nativeConfig.test.ts` quebra se alguém mudar isso.
- **Como verificar no aparelho:** o roteiro manual em modo avião e a conferência do arquivo cifrado ficam em `apps/frontend/.maestro/README.md`.

### 7.3 O outbox

```ts
// apps/frontend/sheet/sync/outbox.ts
export interface Outbox {
  enqueue(characterId: string, batch: EventBatch): Promise<void>
  pending(characterId: string): Promise<EventBatch[]>
  ack(clientBatchId: string): Promise<void> // confirmado pelo servidor
  drop(clientBatchId: string): Promise<void> // rejeitado: não tenta de novo
  clear(): Promise<void> // logout
}
```

- **FIFO por ficha.** Um lote só sai depois que o anterior foi confirmado, porque o `from` de um lote depende do anterior.
- **Idempotência.** O servidor guarda `(character_id, client_batch_id)`. Reenviar o mesmo lote não o aplica duas vezes.
- **Limites** de lotes por ficha e de tamanho por lote, iguais aos do servidor.

### 7.4 Por que não WatermelonDB (para a ficha)

O WatermelonDB é ótimo para muitos registros relacionais com consulta local. A ficha do TMS é outra coisa: poucas fichas por usuário, cada uma um documento JSON (`sheet_data`), sincronizado por eventos validados um a um.

| Critério | WatermelonDB | O que o TMS precisa |
|---|---|---|
| Unidade de sync | registro inteiro, com conflito resolvido **por coluna** (o cliente vence nas colunas alteradas localmente) | **evento por campo**, com `from`, validado e autorizado no servidor |
| `sheet_data` numa coluna `jsonb` | editar qualquer campo offline sobrescreve a coluna inteira e apaga a mudança do narrador em outro campo | dois campos diferentes nunca conflitam |
| Para encaixar | quebrar `sheet_data` em uma linha por campo e repetir o schema no cliente | manter o modelo agnóstico em `jsonb` (`CLAUDE.md`) |
| Histórico "quem, de → para" | o push manda o estado, não a intenção | o evento já é o histórico |
| Servidor | implementar o protocolo pull/push dele no Elysia | um endpoint de lotes |
| Plataforma | módulo nativo (dev build); no web, outro motor (LokiJS) | o mesmo comportamento no app e no web |

**Quando reconsiderar:** num **compêndio** offline grande (milhares de magias e itens com busca local). Aí um banco local de verdade (WatermelonDB ou SQLite direto) faz sentido, mas para o compêndio, não para a ficha.

**Caminho de evolução:** o TanStack DB com `@tanstack/offline-transactions` tem o mesmo modelo deste outbox: fila durável, `idempotencyKey` e erro não retentável que reverte o otimista. Ele é da mesma família do TanStack Query, que o app já usa. Hoje está antes da 1.0, e a persistência é *alpha* (versão 0.6, de março de 2026). Como o outbox fica atrás da interface do §7.3, a troca não toca o motor.

**Multi-sistema:** o formato do evento vem do tipo, não do sistema. A mesma fila serve qualquer template.

---

## 8. API

### 8.1 Rotas

| Rota | Faz | Proteções |
|---|---|---|
| `GET /systems/:code/template` | template publicado mais recente (ou `?version=`) | autenticada; resposta cacheável por versão (`ETag`) |
| `GET /characters/:id` | ficha | AuthZ por crônica; remove seções com `read` restrito |
| `POST /characters/:id/events` | aplica um lote | AuthZ; escrita por seção; idempotência; rate limit; limite de corpo e de eventos por lote |
| `GET /chronicles/:id/characters` | mesa: lista com os campos do `dock` | AuthZ; só narrador e membros; mesmas remoções |

**Sem rota de escrita de template no MVP.** Como só o dono publica (§2), a publicação é um script (`pnpm templates:publish <arquivo>`). Ele roda `schema.json` + `validateTemplate` e grava em `game_systems` e `trait_templates`. Rota que não existe não pode ser atacada. Se um dia houver painel de admin, a rota nasce com RBAC no servidor e passa pelo mesmo pipeline.

### 8.2 O pipeline de um lote no servidor

1. **Sessão:** JWT com algoritmo fixado e `exp`, `aud` e `iss` validados.
2. **Papel:** o servidor resolve ficha → crônica → papel (`owner`, `storyteller`, `player`) no banco. Ele nunca aceita papel, `ownerId` ou `by` vindos do cliente. Sem regra que permita, nega.
3. **Limites:** rate limit por usuário e por ficha, tamanho do corpo e número de eventos por lote.
4. **Idempotência:** se `(character_id, client_batch_id)` já foi aplicado, responde 200 com a versão atual, sem reaplicar.
5. **Concorrência:** carrega a ficha com trava de linha (`SELECT ... FOR UPDATE`) e confere os `from`. Se algum divergir, responde 409 com o valor atual.
6. **Regra:** roda o `applyBatch` do core (permissão de escrita da seção, tipo, faixas, rejeição de `readOnly`) e o `validateSheet` sobre a ficha resultante.
7. **Grava** a ficha, a versão e o histórico na mesma transação, com `by` e `at` do servidor.
8. **Erros** voltam com o caminho do campo e uma mensagem genérica, sem stack trace. Exceção do validador vira 400.

### 8.3 Mudanças mínimas no banco

```dbml
Table trait_templates {
  // + colunas
  version text [not null]                   // = templateVersion
  published_at timestamp
  indexes { (system_id, version) [unique] }
}

Table characters {
  // + colunas
  template_version text [not null]          // versão com que a ficha nasceu
  sheet_version int [not null, default: 0]  // sobe a cada lote (concorrência otimista)
}

Table character_batches {
  id uuid [pk]
  character_id uuid [not null, ref: > characters.id]
  client_batch_id uuid [not null]
  created_by uuid [not null, ref: > users.id]
  created_at timestamp [not null]
  indexes { (character_id, client_batch_id) [unique] }
}

Table character_events {
  id uuid [pk]
  batch_id uuid [not null, ref: > character_batches.id]
  path text [not null]                      // values.<campo> ou specialties.<campo>
  from_value jsonb                          // null para text e longText
  to_value jsonb                            // null para text e longText
}
```

- `template_version` só registra a versão. Migrar fichas entre versões fica para depois (§11).
- `text` e `longText` entram no histórico **sem conteúdo** ("Notas atualizadas"). O valor fica só na ficha (contrato §10).
- **Exclusão de conta** (migration `0013_account_deletion`, plano §7 decisão 8): `characters.user_id` é `on delete cascade` (as fichas do usuário saem com ele); `character_batches.created_by` e `character_rolls.created_by` passam a aceitar null, com `on delete set null` (o que ele fez em fichas de outras pessoas fica, anônimo: "Conta excluída"). `chronicles.storyteller_id` continua sem cascata: a API apaga a crônica explicitamente ou recusa a exclusão (409), e o banco recusa se algo escapar.

### 8.4 O que corrigir na API atual antes de produção

Em `apps/api/src/index.ts`, `cors()` sem opções aceita qualquer origem, e o `/swagger` fica sempre ligado. Correção:

```ts
// packages/config/src/env.ts: no configSchema
CORS_ORIGINS: z.string().default('http://localhost:8081'),

// apps/api/src/index.ts
.use(cors({ origin: config.CORS_ORIGINS.split(','), credentials: true }))
.use(
  config.NODE_ENV === 'production'
    ? new Elysia()
    : swagger({ documentation: { info: { title: 'TMS API', version: '1.0.0' } } })
)
```

Também entram os cabeçalhos de segurança (CSP, HSTS, `nosniff`, `Referrer-Policy`) num hook `onAfterHandle`. O Elysia não usa o helmet.js, que é do Express.

**Multi-sistema:** as rotas recebem qualquer template e nenhuma tem nome de sistema. AuthZ e remoção de seções vêm do contrato, não do jogo.

---

## 9. Segurança: o que o motor garante

Resumo. Os detalhes do contrato estão em [`design/templates/README.md`](../design/templates/README.md) §11.

| Ameaça | Defesa |
|---|---|
| Template malicioso vira código (RCE no servidor, XSS no web) | Template é dado: listas fechadas, sem `eval` e sem lib de expressão. Publicação só pelo script do dono, com `schema.json` + `validateTemplate`. |
| Texto do template ou da ficha injeta HTML | Todo texto em `<Text>`, nunca `dangerouslySetInnerHTML`; texto seguro validado (sem `<>`, controles nem bidi). |
| Estilo injetado | Cor só por `accent-N`; números que viram estilo têm faixa. |
| Prototype pollution | `Object.hasOwn`, allowlist de chaves, ids proibidos. |
| Jogador edita a ficha de outro (IDOR) | AuthZ por crônica em toda rota, com papel resolvido no servidor; testes de IDOR. |
| Jogador lê as notas do narrador | O servidor remove seções restritas em toda saída: ficha, mesa, histórico e cache. |
| Cliente adulterado manda valor fora da regra | O servidor revalida cada lote com o mesmo core. O modo da UI não é controle de acesso. |
| Reenvio duplicado da fila offline | Idempotência por `(ficha, lote)`. |
| Abuso do endpoint de eventos | Rate limit por usuário e por ficha; limite de corpo e de eventos por lote. |
| Dado adulterado no aparelho | A reidratação passa por `compileTemplate` e `validateSheet`. |
| Vazamento por log | Log com ids e números, nunca conteúdo de texto, tokens ou dados pessoais. |
| Titular quer os dados apagados (LGPD art. 18, VI) | `DELETE /me` com a senha de novo (reautenticação, rate limit por usuário e IP): apaga a conta e o que é só dela numa transação, anonimiza o que ela fez em fichas alheias e recusa (409) se apagaria dado de outra pessoa sem confirmação. O app apaga cache, fila e último usuário do aparelho. |
| Dependência vulnerável | `pnpm audit` no CI. |

---

## 10. Roadmap

### 10.1 Escopo da v0: só Vampiro (V20)

O produto da v0 tem um sistema só, o `vtm-v20`. Isso corta boa parte do contrato:

| | Na v0 (o que o `vtm-v20` usa) | Depois da v0 |
|---|---|---|
| Tipos | `text`, `longText`, `choice`, `number`, `rating`, `resource`, `track` (`wod-stacking`), `list` (com valor, especialização e notas) | `percent`, `mark`, `tags`, `state`, `slots`, `clock`; `track` com `boxes` |
| Layouts | `facts`, `fields`, `grid` (com grupos), `groups` (com filtro `invested` e busca), `text` | `list`, `pyramid` |
| Rolagem | `pool-success`: dificuldade, penalidade da Vitalidade, especialização (`tenCountsDouble`) e FdV como sucesso automático | `sum-vs-target`, `roll-under-percent`, `fudge`, `pbta-2d6` |
| Derivações e regras | `vtmBloodPool`, `vtmBloodPerTurn`, `wod-stacking` | as demais |
| Ações | `health.heal` (curar com Sangue), `resource.spend` | `resource.gain`, `rest.long`, `rest.short` |
| Skin | `wod` | `dnd`, `coc`, `fate` |
| Permissões | seção "Narrador" com leitura restrita, que já exige AuthZ e remoção no servidor | – |

São 8 dos 14 tipos, 5 dos 7 layouts e 1 dos 5 modelos de rolagem. As 4 fichas de Vampiro de `exemplos/personagens.json` são os dados de teste.

**O D&D 5e entra como fixture, não como produto.** Com um sistema só, o risco é o código "aprender" o Vampiro: tudo vira bolinha, 5 vira teto implícito, Vitalidade vira o único jeito de marcar dano. Para pegar isso cedo, o CI roda também o `dnd5e-2014`, que já existe:

- validação, `compileTemplate` e `resolve` no `sheet-core`;
- um teste de tela que abre a ficha de exemplo de D&D em modo Leitura, com `GenericRow`, sem erro.

O D&D não é publicado e não ganha skin, componente rico nem rolagem. Ninguém faz QA da experiência dele. O custo é quase zero, porque o template e a ficha já existem.

O que é portado para o `sheet-core` na v0:

- **O validador inteiro** (os 14 tipos), porque ele é a autoridade do servidor e já existe pronto em `validate.mjs`.
- **Todas as derivações**, que são funções de uma linha.
- **Rolagens, regras e efeitos**, só os do Vampiro.

Na v0, um nome da lista fechada que ainda não tem implementação deixa o recurso indisponível na tela: o botão de rolar ou a ação some. Um nome fora da lista continua recusando o template.

**Multi-sistema:** a v0 tem um sistema no produto e dois nos testes. É o fixture de D&D que mantém valendo a regra "o código conhece tipos, o template conhece o sistema".

### 10.2 Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| **Paralela: autenticação** | Login; JWT com algoritmo fixado, `exp`, `aud` e `iss`; refresh token com rotação; `expo-secure-store`; rate limit no login. Hoje a API só tem `/health` e `/todos`. | Pronta antes da Fase 1, que depende dela para a AuthZ por crônica. |
| **0. Core** | `@tms/sheet-core`: validador completo, `compileTemplate`, `resolve`, `short` e `describe`, derivações; `pool-success` e `wod-stacking` | Testes Bun passam com o `vtm-v20`, o fixture `dnd5e-2014` e as fichas de exemplo dos dois; os `enum` de `schema.json` batem com `registry.ts`. |
| **1. Leitura** | `GET` de template e ficha (AuthZ + remoção de seções); script de publicação do `vtm-v20`; `SheetRenderer` com as 3 abas, layouts `facts`, `fields` e `text`, fallback para os demais e `GenericRow` para todos os tipos | As 4 fichas de Vampiro abrem no app e no web em modo Leitura; o jogador não recebe a seção do narrador; a ficha de D&D abre no teste. |
| **2. Jogo + offline** | Views ricas de `rating`, `number`, `resource` e `track` (`wod-stacking`); dock (Vitalidade, Sangue, FdV); store; outbox; `POST` de eventos; Desfazer | Gastar Sangue e marcar dano letal offline, reconectar e ver os lotes confirmados; testes de IDOR passam. |
| **3. Evoluir** | Modo Evoluir com rascunho; layouts `grid` e `groups`; filtro "só com pontos" e busca; especializações; editor de `list` (Disciplinas, Antecedentes); overrides da skin `wod` | A ficha de Vampiro é editável em Evoluir; o leitor de tela anuncia o valor em todos os tipos usados. |
| **4. Rolagem e ações** | Parada `pool-success` com dificuldade, penalidade, especialização e FdV; rolagem da mesa no servidor; ações do template com prévia | A parada sai com a penalidade da Vitalidade; um 10 com especialização conta dois sucessos; o resultado da mesa fica registrado no servidor. |
| **5. Antes do lançamento** | SQLCipher no nativo; CORS, swagger e cabeçalhos da API (§8.4) | Checklist do §9 verificado. |

### 10.3 Depois da v0

- **A mesma família primeiro.** Mago (M20) e Lobisomem (W20) reaproveitam a skin `wod` e pedem só `clock` (Quintessência e Paradoxo), `state` (Formas) e `cap` (Esferas ≤ Arete).
- **Outras famílias depois.** O D&D 5e passa de fixture a produto com `mark`, `tags`, `slots`, `track` com `boxes`, layout `list`, `sum-vs-target`, descansos e a skin `dnd`. CoC e Fate vêm em seguida, com `percent`, `pyramid`, os seus modelos de rolagem e as suas skins.

---

## 11. Pontos de extensão (futuro)

### Criação com orçamento de pontos

Cabe sem mexer no renderizador:

- **Template:** uma chave opcional nova, `creation`, com regras de uma lista fechada nova (`REGISTRY.creationRules`). Exemplo: `{ "rule": "priority-budget", "groups": ["physical", "social", "mental"], "budgets": [7, 5, 3] }`.
- **Core:** `checkCreation(model, values)`, uma função pura que devolve, por seção, os pontos gastos, o orçamento e os problemas. Ela roda no cliente (contador ao vivo) e no servidor (ao concluir a criação).
- **App:** um modo novo `create` no store. O `SectionHeader` ganha um espaço para o contador ("Físicos 7/7"). Layouts e views não mudam.

**Multi-sistema:** prioridade 7/5/3 (WoD), point-buy de 27 pontos (D&D 5e) e distribuição de valores fixos (CoC) são três nomes da mesma lista.

### Migração de fichas entre versões do template

- `characters.template_version` já fica guardado (§8.3).
- Depois: funções puras `migrate[de → para](sheet)` no core, como o `migrateData` do Foundry VTT, rodando no servidor.

### Tempo real

O endpoint de eventos já produz o que seria difundido. Um canal (WebSocket ou SSE no Elysia) reaproveitaria o `stripRestricted` por destinatário.

### Web expandido

Layout de 2 colunas a partir do breakpoint `expanded`, como uma ficha impressa. Muda os layouts, não os tipos.

### Compêndio offline

Ver §7.4.

---

## 12. Em aberto

- **Visibilidade padrão das notas do jogador.** O design recomenda dono + narrador (menor privilégio); o protótipo mostra as notas a todos da crônica.
- **Política de conflito.** O contrato (§10) diz "o último a escrever vence, com aviso". O `design/README.md` fala em 409 com tela de conflito. Este documento segue o 409 com opção de reaplicar. É preciso alinhar o contrato.

---

## 13. Glossário

| Termo | Significado |
|---|---|
| Template | JSON em `trait_templates.template_data` que descreve a ficha de um sistema |
| Ficha | `characters.sheet_data`: `{ values, specialties }` |
| Tipo | `type` de um campo (`rating`, `resource`...); define valor, validação e componente |
| Layout | disposição de uma seção (`grid`, `list`...) |
| Variante | forma em que um tipo se desenha dentro de um layout (`row`, `cell`, `chip`, `fact`, `editor`) |
| Skin | visual de uma família de sistemas: tokens, glifos e overrides |
| Lote | conjunto atômico de eventos `{ path, from, to }` |
| Outbox | fila local de lotes ainda não confirmados |
| Snapshot | última versão da ficha confirmada pelo servidor |

---

## Referências

- [InfoQ: Airbnb e o Ghost Platform (server-driven UI)](https://www.infoq.com/news/2021/07/airbnb-server-driven-ui/)
- [JSON Forms: renderers, testers e rank](https://mintlify.com/eclipsesource/jsonforms/concepts/renderers)
- [Foundry VTT: System Data Models](https://foundryvtt.com/article/system-data-models/)
- [WatermelonDB: detalhes do sync](https://watermelondb.dev/docs/Implementation/SyncImpl)
- [TanStack DB: offline transactions](https://tanstack.com/db/latest/docs/guides/offline-transactions)
- [TanStack DB 0.6: persistência](https://tanstack.com/blog/tanstack-db-0.6-app-ready-with-persistence-and-includes)
- [Expo SQLite (SQLCipher e kv-store)](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [CVE-2025-12735 (expr-eval)](https://cvefeed.io/vuln/detail/CVE-2025-12735)
- [Shopify: FlashList v2](https://shopify.engineering/flashlist-v2)
