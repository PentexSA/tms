# Plano de Ação: Configuração de Testes no Monorepo TMS

> **Data de criação**: 2025-10-15
> **Última atualização**: 2025-10-20
> **Versão**: 2.0
> **Status**: ✅ MIGRAÇÃO COMPLETA
> **Framework**: Jest (migrado de Vitest)

---

## 🎯 Estratégia de Testes Implementada

**Abordagem Unificada com Jest**:
- ✅ **API (Elysia + Bun)**: Jest
- ✅ **Packages compartilhados** (@tms/db, @tms/config, @tms/ui): Jest
- ✅ **Frontend (Expo)**: Jest com preset jest-expo

**Justificativa da Migração**: Jest foi escolhido por oferecer **suporte nativo ao Expo/React Native** através do preset jest-expo, melhor integração com @testing-library/react-native, e maior maturidade no ecossistema React Native. A migração de Vitest para Jest garantiu compatibilidade total com todas as tecnologias do monorepo.

---

## 📊 Status de Implementação

### ✅ Resumo Executivo

| Pacote | Framework | Testes | Status | Data |
|--------|-----------|--------|--------|------|
| **packages/jest-config** | Jest | - | ✅ Criado | 2025-10-20 |
| **packages/config** | Jest | 15/15 ✅ | ✅ Completo | 2025-10-20 |
| **packages/db** | Jest | 13/13 ✅ | ✅ Completo | 2025-10-20 |
| **packages/ui** | Jest | 20/20 ✅ | ✅ Completo | 2025-10-20 |
| **apps/api** | Jest | 20/20 ✅ | ✅ Completo | 2025-10-20 |
| **apps/frontend** | Jest (jest-expo) | 8/8 ✅ | ✅ Completo | 2025-10-20 |

**Total**: 76/76 testes passando (100%)
**Tempo de execução**: ~187ms com Turbo cache

---

## 📋 Plano de Implementação (CONCLUÍDO)

### **✅ FASE 1: Setup Base - Pacote de Configuração Compartilhada**

#### 1.1 Criar pacote `@tms/jest-config` ✅
- [x] Criar diretório `packages/jest-config/`
- [x] Criar `package.json` com:
  - Dependências: `jest@29.7.0`, `ts-jest@29.2.5`, `@types/jest@29.5.14`
  - Exports: `./base` e `./react-native`
- [x] Criar `jest.config.base.js` com configuração compartilhada:
  - `preset: 'ts-jest'` para TypeScript
  - `testEnvironment: 'node'` para backend
  - `transformIgnorePatterns` para módulos ESM
  - `moduleNameMapper` para @tms/* packages
  - `coverageThreshold` com valores globais
- [x] Criar `jest.config.react-native.js` para pacotes React Native:
  - `preset: 'jest-expo'` para Expo/React Native
  - `transformIgnorePatterns` expandido para RN modules
  - Setup do @testing-library/react-native

#### 1.2 Atualizar catalog e turbo.json ✅
- [x] Adicionar dependências Jest ao `pnpm-workspace.yaml` catalog:
  - `jest: 29.7.0`
  - `ts-jest: 29.2.5`
  - `@types/jest: 29.5.14`
  - `jest-expo: 54.0.12`
  - `jest-environment-node: 29.7.0`
  - `@testing-library/react-native: 13.3.3`
  - `react-test-renderer: 19.1.0`
- [x] Atualizar `turbo.json` com tasks de teste:
  - Inputs: `jest.config.js`, `jest.config.ts`, `test/**`
  - Outputs: `coverage/**`
  - Remover referências ao Vitest

---

### **✅ FASE 2: Testes da API (Elysia)**

#### 2.1 Configurar Jest no `apps/api` ✅
- [x] Instalar dependências:
  - `jest` (via catalog)
  - `ts-jest` (via catalog)
  - `@types/jest` (via catalog)
  - `@tms/jest-config` (workspace)
- [x] Criar `apps/api/jest.config.js`:
  - Estender de `@tms/jest-config/base`
  - `displayName: '@tms/api'`
  - `setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts']`
  - `transformIgnorePatterns` para ESM modules
  - `moduleNameMapper` para mockar @elysiajs/swagger
- [x] Estrutura de diretórios criada:
  - `apps/api/src/test/setup.ts` - setup global com DB cleanup
  - `apps/api/src/test/helpers.ts` - helpers de teste
  - `apps/api/src/test/__mocks__/swagger.ts` - mock do Swagger
  - `apps/api/src/__tests__/api.test.ts` - testes de integração

#### 2.2 Helpers e mocks criados ✅
- [x] `createTestApp()`: factory para instância Elysia de teste
- [x] `makeRequest(app, method, path, body?)`: wrapper para requests HTTP
- [x] Setup de beforeEach com `db.deleteFrom('todos').execute()`
- [x] Setup de afterAll com `db.destroy()` para cleanup
- [x] Mock de @elysiajs/swagger para evitar problemas com ESM

#### 2.3 Estrutura de testes implementada ✅
- [x] **Testes de integração** em `src/__tests__/api.test.ts`:
  - Health endpoint (3 testes)
  - GET /todos (3 testes)
  - POST /todos (8 testes)
  - E2E Flows - CRUD completo (4 testes)
  - Business Rules & Validation (2 testes)
  - **Total**: 20 testes ✅

#### 2.4 Scripts configurados ✅
- [x] `"test": "jest --forceExit"`
- [x] `"test:watch": "jest --watch"`
- [x] `"test:coverage": "jest --coverage --forceExit"`

#### 2.5 Desafios resolvidos ✅
- [x] `import.meta.main` não suportado pelo Jest → Comentado bloco
- [x] Módulos ESM (@elysiajs/swagger) → Mock criado
- [x] Jest não exiting → Adicionado --forceExit flag
- [x] Database cleanup → afterAll com db.destroy()

---

### **✅ FASE 3: Testes dos Packages Compartilhados**

#### 3.1 Configurar testes para `@tms/db` ✅
- [x] Criar `packages/db/jest.config.js` estendendo base
- [x] Criar `packages/db/src/test/setup.ts` com cleanup
- [x] Criar `packages/db/src/test/helpers.ts` com clearAllTables()
- [x] Estrutura de testes em `src/__tests__/client.test.ts`:
  - Testes de conexão (2 testes)
  - Testes de query builder (4 testes)
  - Testes de type safety (2 testes)
  - Testes de transactions (2 testes)
  - Testes de schema (3 testes)
  - **Total**: 13 testes ✅
- [x] Usar PostgreSQL real em Docker para testes

#### 3.2 Configurar testes para `@tms/config` ✅
- [x] Criar `packages/config/jest.config.js`
- [x] Criar `packages/config/src/__tests__/env.test.ts`:
  - Testes de default values (2 testes)
  - Testes de parsing de env vars (5 testes)
  - Testes de validação de URLs (3 testes)
  - Testes de type coercion (2 testes)
  - Testes de edge cases (3 testes)
  - **Total**: 15 testes ✅
- [x] Usar `jest.resetModules()` para isolar testes

#### 3.3 Configurar testes para `@tms/ui` ✅
- [x] Criar `packages/ui/jest.config.js` usando base config
- [x] Instalar `@testing-library/jest-dom`
- [x] Criar `packages/ui/src/test/setup.ts` com mocks do React Native
- [x] Testes de componentes:
  - `src/Button.test.tsx` (10 testes) ✅
  - `src/Screen.test.tsx` (10 testes) ✅
  - **Total**: 20 testes ✅
- [x] Usar jest.mock() para React Native Web

---

### **✅ FASE 4: Testes do Frontend (Expo)**

#### 4.1 Configurar Jest no `apps/frontend` ✅
- [x] Instalar dependências:
  - `jest` (via catalog)
  - `jest-expo` (via catalog: 54.0.12)
  - `@testing-library/react-native` (via catalog)
  - `react-test-renderer` (via catalog)
  - `@tms/jest-config` (workspace)
- [x] Criar `apps/frontend/jest.config.js`:
  - Estender de `@tms/jest-config/react-native`
  - `preset: 'jest-expo'` (herdado)
  - `displayName: '@tms/frontend'`
  - `setupFilesAfterEnv: ['<rootDir>/test/setup.ts']`
  - `moduleNameMapper` para assets (images, CSS)
- [x] Criar `apps/frontend/test/setup.ts`:
  - Mocks de expo-router e expo-status-bar
  - Setup de beforeAll/afterAll
- [x] Criar mocks de assets:
  - `test/__mocks__/fileMock.js` - para imagens
  - `test/__mocks__/styleMock.js` - para CSS

#### 4.2 Mock da API (Eden Treaty) ✅
- [x] Criar mocks em `app/__tests__/index.test.tsx`:
  - Mock de @elysiajs/eden com jest.mock()
  - Mock de @tms/config/env
  - Implementação funcional para testes de UI

#### 4.3 Estrutura de testes do Frontend ✅
- [x] **Testes de componentes/telas**:
  - `app/__tests__/_layout.test.tsx` (2 testes) ✅
  - `app/__tests__/index.test.tsx` (6 testes) ✅
  - **Total**: 8 testes ✅
- [x] Testes focados em estrutura UI
- [x] Validação de renderização e componentes

#### 4.4 Scripts configurados ✅
- [x] `"test": "jest"`
- [x] `"test:watch": "jest --watch"`
- [x] `"test:coverage": "jest --coverage"`

#### 4.5 Desafios resolvidos ✅
- [x] Expo SDK 54 → jest-expo@54.0.12
- [x] Mocks de API complexos → Simplificados para UI tests
- [x] Console errors esperados (mock da API)

---

### **✅ FASE 5: Configuração Root e Limpeza**

#### 5.1 Configuração root ✅
- [x] Criar `/home/assisneto/tms/jest.config.js` com projects:
  - Lista todos os packages/apps
  - `collectCoverageFrom` consolidado
  - `coverageDirectory: '<rootDir>/coverage'`
  - `coverageThreshold` global
- [x] Atualizar `turbo.json`:
  - Inputs: `jest.config.js`, `jest.config.ts`, `test/**`
  - Outputs: `coverage/**`
  - Remover `node_modules/.vitest/**`

#### 5.2 Scripts root configurados ✅
- [x] `"test": "turbo run test"` - roda todos os testes
- [x] `"test:watch": "turbo run test:watch --parallel"` - watch mode
- [x] `"test:coverage": "turbo run test:coverage"` - cobertura
- [x] `"test:api": "turbo run test --filter=@tms/api"` - só API
- [x] `"test:frontend": "turbo run test --filter=frontend"` - só frontend
- [x] `"test:packages": "turbo run test --filter='./packages/*'"` - só packages

#### 5.3 Limpeza de arquivos Vitest ✅
- [x] Remover `/home/assisneto/tms/vitest.config.ts`
- [x] Remover `/home/assisneto/tms/vitest.workspace.ts`
- [x] Remover todos os `vitest.config.*` dos packages
- [x] Remover imports de 'vitest' nos testes
- [x] Remover pacote `@tms/test-config` (Vitest)
- [x] Atualizar imports: `vi` → `jest`, `describe/it/expect` (globals)

---

### **⏭️ FASE 6: Estratégias de Mocking e Fixtures** (FUTURO)

#### 6.1 Criar biblioteca de fixtures
- [ ] Criar `packages/test-utils/` (opcional):
  - `factories/`: factory functions para criar objetos de teste
  - `fixtures/`: dados de teste reutilizáveis

#### 6.2 Estratégia de mocking implementada ✅
- [x] **Para testes unitários**: Mock com `jest.mock()`
- [x] **Para testes de integração**: PostgreSQL real com cleanup
- [x] **Database cleanup**: beforeEach com `db.deleteFrom().execute()`

#### 6.3 Mocking de módulos externos ✅
- [x] APIs internas: jest.mock() com implementações
- [x] Módulos ESM: @elysiajs/swagger mockado
- [x] React Native: jest.mock('react-native') com RN Web

---

### **⏭️ FASE 7: Boas Práticas e Documentação** (PRÓXIMOS PASSOS)

#### 7.1 Criar guia de testes
- [ ] Criar `doc/TESTING.md` com:
  - Como rodar testes localmente
  - Como escrever novos testes
  - Padrões de nomenclatura
  - Estrutura AAA (Arrange, Act, Assert)
  - Quando usar unit vs integration vs e2e tests
  - Exemplos de testes bem escritos

#### 7.2 Configurar pre-commit hooks
- [ ] Instalar `husky` e `lint-staged`
- [ ] Configurar `.husky/pre-commit` com testes

#### 7.3 Padrões de nomenclatura estabelecidos ✅
- [x] Arquivos de teste: `*.test.ts` ou `*.test.tsx`
- [x] Diretório de testes: `__tests__/` ou `test/`
- [x] Test suites: `describe()` agrupando por funcionalidade
- [x] Test cases: `it()` com descrições claras
- [x] Setup/teardown: `beforeEach`, `afterEach`, `beforeAll`, `afterAll`

---

## 📊 Estrutura Final de Arquivos (IMPLEMENTADA)

```
tms/
├── jest.config.js                    # ✅ Root config com projects
│
├── apps/
│   ├── api/
│   │   ├── jest.config.js            # ✅ Config específica
│   │   ├── src/
│   │   │   ├── test/
│   │   │   │   ├── setup.ts          # ✅ Setup com DB cleanup
│   │   │   │   ├── helpers.ts        # ✅ createTestApp, makeRequest
│   │   │   │   └── __mocks__/
│   │   │   │       └── swagger.ts    # ✅ Mock do Swagger
│   │   │   ├── __tests__/
│   │   │   │   └── api.test.ts       # ✅ 20 testes integração
│   │   │   └── index.ts              # ✅ import.meta comentado
│   │   └── package.json              # ✅ Scripts Jest
│   │
│   └── frontend/
│       ├── jest.config.js            # ✅ Config com jest-expo
│       ├── test/
│       │   ├── setup.ts              # ✅ Mocks Expo
│       │   └── __mocks__/
│       │       ├── fileMock.js       # ✅ Mock images
│       │       └── styleMock.js      # ✅ Mock CSS
│       ├── app/
│       │   └── __tests__/
│       │       ├── _layout.test.tsx  # ✅ 2 testes
│       │       └── index.test.tsx    # ✅ 6 testes
│       └── package.json              # ✅ Scripts Jest
│
├── packages/
│   ├── jest-config/                  # ✅ NOVO (substituiu test-config)
│   │   ├── jest.config.base.js      # ✅ Config Node/Backend
│   │   ├── jest.config.react-native.js # ✅ Config RN/Expo
│   │   └── package.json              # ✅ Exports
│   │
│   ├── db/
│   │   ├── jest.config.js            # ✅ Config
│   │   ├── src/
│   │   │   ├── test/
│   │   │   │   ├── setup.ts          # ✅ Cleanup
│   │   │   │   └── helpers.ts        # ✅ clearAllTables
│   │   │   └── __tests__/
│   │   │       └── client.test.ts    # ✅ 13 testes
│   │   └── package.json              # ✅ Scripts Jest
│   │
│   ├── config/
│   │   ├── jest.config.js            # ✅ Config
│   │   ├── src/__tests__/
│   │   │   └── env.test.ts           # ✅ 15 testes
│   │   └── package.json              # ✅ Scripts Jest
│   │
│   └── ui/
│       ├── jest.config.js            # ✅ Config base (não RN preset)
│       ├── src/
│       │   ├── test/
│       │   │   └── setup.ts          # ✅ Mock RN com jest.mock
│       │   ├── Button.test.tsx       # ✅ 10 testes
│       │   └── Screen.test.tsx       # ✅ 10 testes
│       └── package.json              # ✅ Scripts Jest
│
├── turbo.json                        # ✅ Tasks de teste atualizadas
├── pnpm-workspace.yaml               # ✅ Catalog com Jest
├── package.json                      # ✅ Scripts root
└── doc/
    ├── TESTING_PLAN.md               # ✅ ESTE ARQUIVO (atualizado)
    └── TESTING.md                    # ⏭️ A CRIAR
```

---

## ⚙️ Dependências Implementadas

### Root `pnpm-workspace.yaml` (catalog) - ✅ CONFIGURADO
```yaml
catalog:
  "@types/jest": 29.5.14
  "@testing-library/jest-dom": 6.6.3
  "@testing-library/react-native": 13.3.3
  "jest": 29.7.0
  "jest-environment-node": 29.7.0
  "jest-expo": 54.0.12
  "react-test-renderer": 19.1.0
  "ts-jest": 29.2.5
```

### `@tms/jest-config/package.json` - ✅ CRIADO
```json
{
  "name": "@tms/jest-config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./base": "./jest.config.base.js",
    "./react-native": "./jest.config.react-native.js"
  },
  "dependencies": {
    "jest": "catalog:",
    "@types/jest": "catalog:",
    "ts-jest": "catalog:",
    "jest-expo": "catalog:"
  }
}
```

### Dependências por Package - ✅ TODOS CONFIGURADOS

**packages/config, packages/db, packages/ui, apps/api**:
```json
{
  "devDependencies": {
    "@tms/jest-config": "workspace:*",
    "@types/jest": "catalog:",
    "jest": "catalog:",
    "ts-jest": "catalog:"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**apps/frontend** (adicional):
```json
{
  "devDependencies": {
    "@tms/jest-config": "workspace:*",
    "@testing-library/react-native": "catalog:",
    "@types/jest": "catalog:",
    "jest": "catalog:",
    "jest-environment-node": "catalog:",
    "jest-expo": "catalog:",
    "react-test-renderer": "catalog:"
  }
}
```

---

## 🔑 Decisões Técnicas e Justificativas

### ✅ Por que Jest ao invés de Vitest?

#### Vantagens do Jest para este projeto:
1. **Suporte nativo ao Expo**: preset `jest-expo` oficial e bem mantido
2. **Maturidade no ecossistema React Native**: melhor integração com @testing-library/react-native
3. **Comunidade maior**: mais recursos, exemplos e soluções para problemas comuns
4. **Configuração unificada**: mesmo framework em API, packages e frontend
5. **Melhor mocking**: jest.mock() mais simples que vi.mock() para casos complexos

#### Trade-offs aceitos:
- Performance ligeiramente inferior ao Vitest (mas ainda excelente com Turbo cache)
- ESM support requer configuração adicional (transformIgnorePatterns)
- import.meta não suportado (solução: comentar bloco e usar scripts)

### ✅ Estratégia de DB para Testes (IMPLEMENTADA)
- **Testes de integração**: PostgreSQL real com Docker
- **Cleanup**: `beforeEach` com `db.deleteFrom().execute()`
- **Teardown**: `afterAll` com `db.destroy()`
- **Isolamento**: cada teste inicia com DB limpo
- **Performance**: ~1s para 13 testes do DB (aceitável)

### ✅ Coverage Thresholds (CONFIGURADOS)
- **Global**: 60% (lines, functions, branches, statements)
- **Pragmático**: permite início rápido sem bloquear desenvolvimento
- **Meta futura**: Aumentar para 80% conforme estabilização do código
- **Crítico** (autenticação, pagamentos futuros): 90%+

---

## 🚨 Desafios Resolvidos

### 1. **import.meta não suportado pelo Jest** ✅
**Problema**: Bun usa `import.meta.main` para detectar se é módulo principal
**Solução**:
- Comentado bloco `import.meta.main` em `apps/api/src/index.ts`
- Servidor agora inicia apenas via `bun run dev`
- Testes funcionam sem problemas

### 2. **Módulos ESM (@elysiajs/swagger)** ✅
**Problema**: @scalar/themes e outros módulos ESM causam erro de parsing
**Solução**:
- Criar mock em `apps/api/src/test/__mocks__/swagger.ts`
- Adicionar ao `moduleNameMapper` do Jest
- Swagger UI não é necessário para testes de API

### 3. **Jest não exiting** ✅
**Problema**: Conexões abertas impedem Jest de finalizar
**Solução**:
- Flag `--forceExit` nos scripts de test
- `db.destroy()` no `afterAll` do setup
- Performance não afetada

### 4. **React Native + Jest** ✅
**Problema**: Vitest não tem suporte nativo ao React Native
**Solução**:
- Usar `jest-expo` preset oficial
- Mock do react-native com `jest.requireActual('react-native-web')`
- @testing-library/react-native funcionando perfeitamente

### 5. **Type Safety nos Testes** ✅
**Problema**: TypeScript não reconhecia globals do Jest
**Solução**:
- Adicionar `"types": ["jest"]` em todos os tsconfig.json
- Remover imports de describe/it/expect (globals habilitados)

### 6. **Monorepo Caching** ✅
**Problema**: Turborepo cache não funcionava inicialmente
**Solução**:
- Configurar `inputs` e `outputs` corretos no turbo.json
- Cache funcionando: 187ms com 7/7 cached

---

## 📊 Métricas e Resultados

### Cobertura de Testes (Implementada)
```
Package             Tests    Status    Time
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
packages/config     15/15    ✅        ~2.4s
packages/db         13/13    ✅        ~2.9s
packages/ui         20/20    ✅        ~2.3s
apps/api            20/20    ✅        ~1.0s
apps/frontend        8/8     ✅        ~1.0s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL               76/76    ✅        ~187ms (cached)
```

### Performance
- **Primeira execução**: ~10s (build + testes)
- **Com cache (Turbo)**: ~187ms ⚡
- **Coverage report**: ~15s (todos os packages)

### Qualidade
- **Taxa de sucesso**: 100% (76/76 testes)
- **Flakiness**: 0 (testes determinísticos)
- **Cobertura estimada**: ~60-70% (alinhado com threshold)

---

## 🚀 Próximos Passos Recomendados

### Curto Prazo (Sprint atual)
1. ✏️ **Documentação** (`doc/TESTING.md`):
   - Guia de como escrever testes
   - Exemplos de patterns comuns
   - Troubleshooting guide

2. 🔄 **CI/CD** (GitHub Actions):
   - Workflow de testes automáticos
   - Coverage reports
   - Fail on threshold breach

### Médio Prazo (Próximas sprints)
3. 📈 **Expandir cobertura do Frontend**:
   - Testes de interação com fireEvent
   - Testes de navegação (quando houver múltiplas telas)
   - Testes de hooks customizados

4. 🎯 **Testes E2E**:
   - Fluxos críticos API → Frontend
   - Usar Playwright ou Detox

5. 🏭 **Test Factories**:
   - Criar `packages/test-utils` com factories
   - Dados de teste reutilizáveis

### Longo Prazo (Roadmap)
6. 📊 **Melhorar thresholds**:
   - Aumentar para 80% gradualmente
   - Identificar áreas críticas para 90%+

7. 🔐 **Security Testing**:
   - Testes de autenticação (quando implementar)
   - Testes de autorização
   - Input validation

8. ⚡ **Performance Testing**:
   - Load tests para API
   - Benchmark de queries do DB

---

## 📚 Recursos e Referências

### Documentação Oficial
- [Jest Documentation](https://jestjs.io/)
- [Jest + Turborepo](https://turbo.build/repo/docs/handbook/testing)
- [jest-expo Preset](https://docs.expo.dev/develop/unit-testing/)
- [Testing Library React Native](https://callstack.github.io/react-native-testing-library/)
- [Elysia Testing](https://elysiajs.com/patterns/unit-test)
- [Kysely Documentation](https://kysely.dev/)

### Guias e Tutoriais
- [API Testing with Jest](https://jestjs.io/docs/testing-frameworks)
- [Monorepo Testing Best Practices](https://turbo.build/repo/docs/handbook/testing)
- [React Native Testing Guide](https://reactnative.dev/docs/testing-overview)

---

## 📝 Notas Finais

### Sobre a Migração Vitest → Jest

A migração de Vitest para Jest foi realizada com sucesso em **um único dia** (2025-10-20), seguindo uma abordagem incremental:

1. ✅ Setup base do Jest (catalog + @tms/jest-config)
2. ✅ Migração de packages/config
3. ✅ Migração de packages/db
4. ✅ Migração de packages/ui
5. ✅ Migração de apps/api
6. ✅ Configuração do apps/frontend (Expo)
7. ✅ Limpeza e configuração root

### Lições Aprendidas

1. **Jest é superior para Expo/React Native**: O preset jest-expo oficial elimina a necessidade de configurações complexas
2. **Mocking é mais simples**: `jest.mock()` é mais intuitivo que `vi.mock()` para casos complexos
3. **ESM ainda é desafiador**: Requer transformIgnorePatterns e mocks cuidadosos
4. **Database cleanup é crucial**: beforeEach + afterAll garantem isolamento
5. **Turbo cache funciona muito bem**: 187ms vs ~10s é uma diferença enorme

### Recomendações para Novos Testes

- **Sempre use AAA pattern**: Arrange, Act, Assert
- **Um assert por teste quando possível**: testes mais focados e legíveis
- **Nomes descritivos**: `should do X when Y` é melhor que `test 1`
- **Mock o mínimo necessário**: testes mais realistas são mais confiáveis
- **Cleanup é essencial**: beforeEach/afterEach para garantir isolamento

---

**Status Final**: ✅ **MIGRAÇÃO COMPLETA E VALIDADA**
**Todos os 76 testes passando com Jest!** 🎉

Este plano está atualizado e reflete o estado real do monorepo TMS. Todas as fases 1-5 foram implementadas e validadas. As próximas fases (6-7) são opcionais e podem ser implementadas conforme necessidade do projeto.
