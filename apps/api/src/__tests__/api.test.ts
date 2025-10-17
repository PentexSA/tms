import { beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, createTestApp, makeRequest } from '../test/helpers'

/**
 * Testes completos da API TMS
 *
 * Estrutura:
 * - Health Endpoint
 * - Todos Endpoints (Integration Tests)
 * - E2E Flows
 */
describe('TMS API Tests', () => {
  // ============================================================================
  // HEALTH ENDPOINT
  // ============================================================================
  describe('GET /health', () => {
    it('should return ok: true', async () => {
      // Arrange
      const app = createTestApp()

      // Act
      const response = await makeRequest(app, 'GET', '/health')
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true })
    })

    it('should have correct content-type', async () => {
      // Arrange
      const app = createTestApp()

      // Act
      const response = await makeRequest(app, 'GET', '/health')

      // Assert
      expect(response.headers.get('content-type')).toContain('application/json')
    })

    it('should respond quickly (performance check)', async () => {
      // Arrange
      const app = createTestApp()
      const startTime = Date.now()

      // Act
      await makeRequest(app, 'GET', '/health')
      const endTime = Date.now()

      // Assert
      const responseTime = endTime - startTime
      expect(responseTime).toBeLessThan(100) // Deve responder em menos de 100ms
    })
  })

  // ============================================================================
  // TODOS ENDPOINTS - INTEGRATION TESTS
  // ============================================================================
  describe('Todos API - Integration Tests', () => {
    beforeEach(async () => {
      // Limpar DB antes de cada teste
      // await clearDatabase()
    })

    // --------------------------------------------------------------------------
    // GET /todos
    // --------------------------------------------------------------------------
    describe('GET /todos', () => {
      it('should return an array of todos', async () => {
        // Arrange
        const app = createTestApp()

        // Act
        const response = await makeRequest(app, 'GET', '/todos')
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(Array.isArray(data)).toBe(true)
      })

      it('should return todos ordered by created_at desc', async () => {
        // Arrange
        const app = createTestApp()

        // Criar alguns todos para testar ordenação
        await makeRequest(app, 'POST', '/todos', { title: 'First Todo' })
        await makeRequest(app, 'POST', '/todos', { title: 'Second Todo' })
        await makeRequest(app, 'POST', '/todos', { title: 'Third Todo' })

        // Act
        const response = await makeRequest(app, 'GET', '/todos')
        const todos = await response.json()

        // Assert
        expect(todos.length).toBeGreaterThanOrEqual(3)
        // O último criado deve aparecer primeiro (ordem DESC)
        const lastThree = todos.slice(0, 3)
        expect(lastThree[0].title).toBe('Third Todo')
        expect(lastThree[1].title).toBe('Second Todo')
        expect(lastThree[2].title).toBe('First Todo')
      })

      it('should return 200 even when no todos exist', async () => {
        // Arrange
        const app = createTestApp()

        // Act
        const response = await makeRequest(app, 'GET', '/todos')

        // Assert
        expect(response.status).toBe(200)
      })
    })

    // --------------------------------------------------------------------------
    // POST /todos
    // --------------------------------------------------------------------------
    describe('POST /todos', () => {
      it('should create a new todo', async () => {
        // Arrange
        const app = createTestApp()
        const newTodo = { title: 'Test Todo' }

        // Act
        const response = await makeRequest(app, 'POST', '/todos', newTodo)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('title', 'Test Todo')
        expect(data).toHaveProperty('created_at')
        expect(data).toHaveProperty('done')
      })

      it('should return the created todo with all fields', async () => {
        // Arrange
        const app = createTestApp()
        const newTodo = { title: 'Buy groceries' }

        // Act
        const response = await makeRequest(app, 'POST', '/todos', newTodo)
        const data = await response.json()

        // Assert
        expect(data.id).toBeDefined()
        expect(data.title).toBe('Buy groceries')
        expect(data.done).toBe(false) // Default value
        expect(data.created_at).toBeDefined()
      })

      it('should return 400 when title is missing', async () => {
        // Arrange
        const app = createTestApp()

        // Act
        const response = await makeRequest(app, 'POST', '/todos', {})

        // Assert
        expect(response.status).toBe(400)
      })

      it('should return 400 when title is not a string', async () => {
        // Arrange
        const app = createTestApp()

        // Act
        const response = await makeRequest(app, 'POST', '/todos', {
          title: 123,
        })

        // Assert
        expect(response.status).toBe(400)
      })

      it('should accept empty string title (API does not validate this currently)', async () => {
        // Arrange
        const app = createTestApp()

        // Act
        const response = await makeRequest(app, 'POST', '/todos', { title: '' })
        const data = await response.json()

        // Assert
        // NOTE: A API atual aceita strings vazias. Isso poderia ser melhorado
        // adicionando validação no schema do Elysia com minLength
        expect(response.status).toBe(200)
        expect(data.title).toBe('')
      })

      it('should create multiple todos independently', async () => {
        // Arrange
        const app = createTestApp()

        // Act
        const response1 = await makeRequest(app, 'POST', '/todos', {
          title: 'Todo 1',
        })
        const response2 = await makeRequest(app, 'POST', '/todos', {
          title: 'Todo 2',
        })

        const todo1 = await response1.json()
        const todo2 = await response2.json()

        // Assert
        expect(todo1.id).not.toBe(todo2.id)
        expect(todo1.title).toBe('Todo 1')
        expect(todo2.title).toBe('Todo 2')
      })

      it('should handle special characters in title', async () => {
        // Arrange
        const app = createTestApp()
        const specialTitle = 'Todo with special chars: @#$%^&*()'

        // Act
        const response = await makeRequest(app, 'POST', '/todos', {
          title: specialTitle,
        })
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.title).toBe(specialTitle)
      })

      it('should handle unicode characters in title', async () => {
        // Arrange
        const app = createTestApp()
        const unicodeTitle = 'Comprar café ☕ e pão 🥖'

        // Act
        const response = await makeRequest(app, 'POST', '/todos', {
          title: unicodeTitle,
        })
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.title).toBe(unicodeTitle)
      })
    })
  })

  // ============================================================================
  // E2E FLOWS
  // ============================================================================
  describe('E2E Flows', () => {
    beforeEach(async () => {
      // await clearDatabase()
    })

    describe('Todo CRUD', () => {
      it('should complete full CRUD flow for a todo', async () => {
        // Arrange
        const app = createTestApp()

        // Act 1: Create todo
        const createResponse = await makeRequest(app, 'POST', '/todos', {
          title: 'Buy groceries',
        })
        const createdTodo = await createResponse.json()

        // Assert 1: Todo created
        expect(createResponse.status).toBe(200)
        expect(createdTodo).toHaveProperty('id')
        expect(createdTodo.title).toBe('Buy groceries')
        expect(createdTodo.done).toBe(false)

        // Act 2: List todos
        const listResponse = await makeRequest(app, 'GET', '/todos')
        const todos = await listResponse.json()

        // Assert 2: Todo appears in list
        expect(listResponse.status).toBe(200)
        expect(todos).toContainEqual(
          expect.objectContaining({ title: 'Buy groceries' })
        )

        // TODO: Adicionar UPDATE e DELETE quando implementados
      })

      it('should handle multiple todos in sequence', async () => {
        // Arrange
        const app = createTestApp()
        const todoTitles = [
          'Wake up',
          'Brush teeth',
          'Have breakfast',
          'Go to work',
          'Come back home',
        ]

        // Act: Create multiple todos
        const createdTodos = []
        for (const title of todoTitles) {
          const response = await makeRequest(app, 'POST', '/todos', { title })
          const todo = await response.json()
          createdTodos.push(todo)
        }

        // Assert: All todos created
        expect(createdTodos).toHaveLength(5)
        createdTodos.forEach((todo, index) => {
          expect(todo.title).toBe(todoTitles[index])
          expect(todo.id).toBeDefined()
        })

        // Act: List all todos
        const listResponse = await makeRequest(app, 'GET', '/todos')
        const allTodos = await listResponse.json()

        // Assert: All todos appear in list (in reverse order due to DESC)
        expect(allTodos.length).toBeGreaterThanOrEqual(5)
        const lastFive = allTodos.slice(0, 5)
        expect(lastFive[0].title).toBe('Come back home')
        expect(lastFive[4].title).toBe('Wake up')
      })

      it('should maintain data consistency across operations', async () => {
        // Arrange
        const app = createTestApp()

        // Act 1: Get initial count
        const initialResponse = await makeRequest(app, 'GET', '/todos')
        const initialTodos = await initialResponse.json()
        const initialCount = initialTodos.length

        // Act 2: Create 3 new todos
        await makeRequest(app, 'POST', '/todos', { title: 'Todo 1' })
        await makeRequest(app, 'POST', '/todos', { title: 'Todo 2' })
        await makeRequest(app, 'POST', '/todos', { title: 'Todo 3' })

        // Act 3: Get updated count
        const updatedResponse = await makeRequest(app, 'GET', '/todos')
        const updatedTodos = await updatedResponse.json()
        const updatedCount = updatedTodos.length

        // Assert: Count increased by 3
        expect(updatedCount).toBe(initialCount + 3)
      })

      it('should handle concurrent requests', async () => {
        // Arrange
        const app = createTestApp()

        // Act: Create todos concurrently
        const promises = [
          makeRequest(app, 'POST', '/todos', { title: 'Concurrent 1' }),
          makeRequest(app, 'POST', '/todos', { title: 'Concurrent 2' }),
          makeRequest(app, 'POST', '/todos', { title: 'Concurrent 3' }),
          makeRequest(app, 'POST', '/todos', { title: 'Concurrent 4' }),
          makeRequest(app, 'POST', '/todos', { title: 'Concurrent 5' }),
        ]

        const responses = await Promise.all(promises)

        // Assert: All requests successful
        for (const response of responses) {
          expect(response.status).toBe(200)
          const todo = await response.json()
          expect(todo.id).toBeDefined()
          expect(todo.title).toContain('Concurrent')
        }

        // Act: Verify all todos were created
        const listResponse = await makeRequest(app, 'GET', '/todos')
        const todos = await listResponse.json()

        // Assert: All 5 concurrent todos exist
        const concurrentTodos = todos.filter((t: any) =>
          t.title.startsWith('Concurrent')
        )
        expect(concurrentTodos.length).toBeGreaterThanOrEqual(5)
      })
    })

    describe('Business Rules & Validation', () => {
      it('should validate business rules end-to-end', async () => {
        // Arrange
        const app = createTestApp()

        // Act & Assert: Cannot create todo without title
        const noTitleResponse = await makeRequest(app, 'POST', '/todos', {})
        expect(noTitleResponse.status).toBe(400)

        // Act & Assert: Can create todo with empty title (API accepts this currently)
        // NOTE: This could be improved by adding minLength validation
        const emptyTitleResponse = await makeRequest(app, 'POST', '/todos', {
          title: '',
        })
        expect(emptyTitleResponse.status).toBe(200)

        // Act & Assert: Can create todo with valid title
        const validResponse = await makeRequest(app, 'POST', '/todos', {
          title: 'Valid Todo',
        })
        expect(validResponse.status).toBe(200)

        const validTodo = await validResponse.json()
        expect(validTodo.title).toBe('Valid Todo')
      })

      it('should handle edge cases gracefully', async () => {
        // Arrange
        const app = createTestApp()

        // Test 1: Very long title
        const longTitle = 'a'.repeat(500)
        const longTitleResponse = await makeRequest(app, 'POST', '/todos', {
          title: longTitle,
        })
        expect(longTitleResponse.status).toBe(200)

        // Test 2: Title with only whitespace (API accepts this currently)
        // NOTE: Could be improved with trim validation
        const whitespaceResponse = await makeRequest(app, 'POST', '/todos', {
          title: '   ',
        })
        expect(whitespaceResponse.status).toBe(200)

        // Test 3: Title with newlines
        const newlineTitle = 'Line 1\nLine 2\nLine 3'
        const newlineResponse = await makeRequest(app, 'POST', '/todos', {
          title: newlineTitle,
        })
        expect(newlineResponse.status).toBe(200)

        // Test 4: Title with SQL-like content (injection test)
        const sqlTitle = "'; DROP TABLE todos; --"
        const sqlResponse = await makeRequest(app, 'POST', '/todos', {
          title: sqlTitle,
        })
        expect(sqlResponse.status).toBe(200)

        // Verify todos table still exists by listing
        const listResponse = await makeRequest(app, 'GET', '/todos')
        expect(listResponse.status).toBe(200)
      })
    })
  })
})
