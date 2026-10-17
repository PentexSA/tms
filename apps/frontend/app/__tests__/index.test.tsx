import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderWithQueryClient } from '../../test/utils'
import TodosScreen from '../index'

/**
 * Testes do TodosScreen (tela principal)
 *
 * O cliente da API (lib/api) é mockado para controlar as respostas do Eden.
 * Os mocks globais (config, expo-router etc.) estão em test/setup.ts
 */

const mockGet = jest.fn()
const mockPost = jest.fn()

jest.mock('../../lib/api', () => ({
  ...jest.requireActual('../../lib/api'),
  api: {
    todos: {
      get: (...args: unknown[]) => mockGet(...args),
      post: (...args: unknown[]) => mockPost(...args),
    },
  },
}))

const buildTodo = (id: number, title: string) => ({
  id,
  title,
  done: false,
  created_at: new Date().toISOString(),
})

describe('TodosScreen', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({
      data: [buildTodo(1, 'Test Todo')],
      error: null,
    })
  })

  it('should render the screen title', () => {
    // Act
    renderWithQueryClient(<TodosScreen />)

    // Assert
    expect(screen.getByText('My Todos')).toBeTruthy()
  })

  it('should render the input placeholder', () => {
    // Act
    renderWithQueryClient(<TodosScreen />)

    // Assert
    expect(screen.getByPlaceholderText('What needs to be done?')).toBeTruthy()
  })

  it('should render the Add button', () => {
    // Act
    renderWithQueryClient(<TodosScreen />)

    // Assert
    expect(screen.getByText('Add')).toBeTruthy()
  })

  it('should render FlatList component', async () => {
    // Act
    renderWithQueryClient(<TodosScreen />)

    // Assert - Verifica que o FlatList está renderizado (via RCTScrollView)
    await waitFor(() => {
      expect(screen.UNSAFE_getByType('RCTScrollView')).toBeTruthy()
    })
  })

  it('should display correct platform label', () => {
    // Act
    renderWithQueryClient(<TodosScreen />)

    // Assert - Verifica se mostra Web ou Mobile
    const platformLabel = screen.queryByText(/Web|Mobile/)
    expect(platformLabel).toBeTruthy()
  })

  it('should render todos returned by the API', async () => {
    // Act
    renderWithQueryClient(<TodosScreen />)

    // Assert
    expect(await screen.findByText('Test Todo')).toBeTruthy()
    expect(screen.getByText(/1 items/)).toBeTruthy()
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('should show an error state and retry when the API fails', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { status: 500, value: 'Internal Server Error' },
    })

    // Act
    renderWithQueryClient(<TodosScreen />)
    fireEvent.press(await screen.findByText('Try again'))

    // Assert
    expect(await screen.findByText('Test Todo')).toBeTruthy()
    expect(screen.queryByText('Could not load todos.')).toBeNull()
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('should create a todo and refresh the list', async () => {
    // Arrange
    mockPost.mockResolvedValue({ data: buildTodo(2, 'New Todo'), error: null })
    renderWithQueryClient(<TodosScreen />)
    await screen.findByText('Test Todo')
    mockGet.mockResolvedValue({
      data: [buildTodo(2, 'New Todo'), buildTodo(1, 'Test Todo')],
      error: null,
    })
    const input = screen.getByPlaceholderText('What needs to be done?')

    // Act
    fireEvent.changeText(input, 'New Todo')
    fireEvent.press(screen.getByText('Add'))

    // Assert
    expect(await screen.findByText('New Todo')).toBeTruthy()
    expect(mockPost).toHaveBeenCalledWith({ title: 'New Todo' })
    expect(screen.getByText(/2 items/)).toBeTruthy()
    expect(input.props.value).toBe('')
  })

  it('should keep the title and show an error when creating fails', async () => {
    // Arrange
    mockPost.mockResolvedValue({
      data: null,
      error: { status: 422, value: 'Invalid body' },
    })
    renderWithQueryClient(<TodosScreen />)
    await screen.findByText('Test Todo')
    const input = screen.getByPlaceholderText('What needs to be done?')

    // Act
    fireEvent.changeText(input, 'New Todo')
    fireEvent.press(screen.getByText('Add'))

    // Assert
    expect(
      await screen.findByText('Could not create todo. Try again.')
    ).toBeTruthy()
    expect(input.props.value).toBe('New Todo')
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('should not create a todo with a blank title', async () => {
    // Arrange
    renderWithQueryClient(<TodosScreen />)
    await screen.findByText('Test Todo')
    const input = screen.getByPlaceholderText('What needs to be done?')

    // Act
    fireEvent.changeText(input, '   ')
    fireEvent(input, 'submitEditing')

    // Assert
    expect(mockPost).not.toHaveBeenCalled()
  })
})
