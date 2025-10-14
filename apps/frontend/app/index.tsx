import { treaty } from '@elysiajs/eden'
import { config } from '@tms/config/env'
import type { Todo } from '@tms/db'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import type { App } from '../../api/src/index'

export default function TodosScreen() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const client = treaty<App>(`${config.EXPO_PUBLIC_API_URL}`)

  useEffect(() => {
    fetchTodos()
  }, [])

  const fetchTodos = async () => {
    try {
      setLoading(true)
      const { data } = await client.todos.get()

      setTodos(data ?? [])
    } catch (error) {
      console.error('Error fetching todos:', error)
    } finally {
      setLoading(false)
    }
  }

  const createTodo = async () => {
    if (!newTodoTitle.trim()) return

    try {
      setCreating(true)
      const response = await client.todos.post({
        title: newTodoTitle,
      })
      const newTodo = response.data as Todo | null

      if (newTodo) {
        setTodos([newTodo, ...todos])
      }
      setNewTodoTitle('')
    } catch (error) {
      console.error('Error creating todo:', error)
    } finally {
      setCreating(false)
    }
  }

  const renderTodo = ({ item }: { item: Todo }) => (
    <View style={styles.todoItem}>
      <Text style={styles.todoTitle}>{item.title}</Text>
      <Text style={styles.todoDate}>
        {item.created_at
          ? new Date(item.created_at).toLocaleDateString()
          : 'N/A'}
      </Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Todos</Text>
        <Text style={styles.headerSubtitle}>
          {Platform.OS === 'web' ? 'Web' : 'Mobile'} • {todos.length} items
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="What needs to be done?"
          value={newTodoTitle}
          onChangeText={setNewTodoTitle}
          onSubmitEditing={createTodo}
          editable={!creating}
        />
        <TouchableOpacity
          style={[styles.addButton, creating && styles.addButtonDisabled]}
          onPress={createTodo}
          disabled={creating || !newTodoTitle.trim()}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addButtonText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={todos}
          renderItem={renderTodo}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No todos yet. Create one!</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  addButton: {
    marginLeft: 12,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  todoItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  todoTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  todoDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
})
