import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'

import { Button, Screen } from '@tms/ui'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'

interface Todo {
  id: number
  title: string
  done: boolean
  created_at: string
}

export default function HomeScreen() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [loading, setLoading] = useState(true)
  const [healthStatus, setHealthStatus] = useState<boolean | null>(null)

  useEffect(() => {
    checkHealth()
    fetchTodos()
  }, [])

  const checkHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/health`)
      const data = await response.json()
      setHealthStatus(data.ok)
    } catch (error) {
      console.error('Health check failed:', error)
      setHealthStatus(false)
    }
  }

  const fetchTodos = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/todos`)
      const data = await response.json()
      setTodos(data)
    } catch (error) {
      console.error('Failed to fetch todos:', error)
    } finally {
      setLoading(false)
    }
  }

  const createTodo = async () => {
    if (!newTodo.trim()) return

    try {
      const response = await fetch(`${API_URL}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo }),
      })
      const todo = await response.json()
      setTodos([todo, ...todos])
      setNewTodo('')
    } catch (error) {
      console.error('Failed to create todo:', error)
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Todo List</Text>
          <View style={styles.healthBadge}>
            <View
              style={[
                styles.healthDot,
                healthStatus ? styles.healthDotOk : styles.healthDotError,
              ]}
            />
            <Text style={styles.healthText}>
              API: {healthStatus ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add a new todo..."
            value={newTodo}
            onChangeText={setNewTodo}
            onSubmitEditing={createTodo}
          />
          <Button
            title="Add"
            onPress={createTodo}
            disabled={!newTodo.trim()}
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" />
        ) : (
          <FlatList
            data={todos}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.todoItem}>
                <View style={styles.todoContent}>
                  <Text style={styles.todoTitle}>{item.title}</Text>
                  <Text style={styles.todoDate}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.todoBadge,
                    item.done ? styles.todoDone : styles.todoPending,
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {item.done ? 'Done' : 'Pending'}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No todos yet. Add one above!</Text>
            }
          />
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  healthDotOk: {
    backgroundColor: '#34C759',
  },
  healthDotError: {
    backgroundColor: '#FF3B30',
  },
  healthText: {
    fontSize: 12,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  todoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  todoContent: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  todoDate: {
    fontSize: 12,
    color: '#666',
  },
  todoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todoDone: {
    backgroundColor: '#34C759',
  },
  todoPending: {
    backgroundColor: '#FF9500',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 32,
    fontSize: 16,
  },
})
