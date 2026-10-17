import type { Todo } from '@tms/db'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { useCreateTodo, useTodos } from '../hooks/useTodos'

export default function TodosScreen() {
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const { data: todos = [], isPending, isError, refetch } = useTodos()
  const createTodo = useCreateTodo()
  const creating = createTodo.isPending

  const handleCreateTodo = () => {
    if (!newTodoTitle.trim() || creating) return

    createTodo.mutate(newTodoTitle, {
      onSuccess: () => setNewTodoTitle(''),
    })
  }

  const renderTodo = ({ item }: { item: Todo }) => (
    <View className="bg-white p-4 rounded-lg mb-3 border border-gray-200">
      <Text className="text-base text-gray-800 font-medium">{item.title}</Text>
      <Text className="text-xs text-gray-400 mt-1">
        {item.created_at
          ? new Date(item.created_at).toLocaleDateString()
          : 'N/A'}
      </Text>
    </View>
  )

  return (
    <View
      className={`flex-1 bg-gray-100 ${Platform.OS === 'ios' ? 'pt-[50px]' : 'pt-[30px]'}`}
    >
      <StatusBar style="auto" />

      <View className="px-5 py-5 bg-white border-b border-gray-200">
        <Text className="text-[32px] font-bold text-gray-800">My Todos</Text>
        <Text className="text-sm text-gray-600 mt-1">
          {Platform.OS === 'web' ? 'Web' : 'Mobile'} • {todos.length} items
        </Text>
      </View>

      <View className="flex-row p-4 bg-white border-b border-gray-200">
        <TextInput
          className="flex-1 h-11 border border-gray-300 rounded-lg px-3 text-base bg-white"
          placeholder="What needs to be done?"
          value={newTodoTitle}
          onChangeText={setNewTodoTitle}
          onSubmitEditing={handleCreateTodo}
          editable={!creating}
        />
        <TouchableOpacity
          className={`ml-3 bg-blue-500 px-5 rounded-lg justify-center items-center min-w-[70px] ${creating ? 'opacity-50' : ''}`}
          onPress={handleCreateTodo}
          disabled={creating || !newTodoTitle.trim()}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">Add</Text>
          )}
        </TouchableOpacity>
      </View>

      {createTodo.isError && (
        <Text className="px-4 pt-3 text-sm text-red-500">
          Could not create todo. Try again.
        </Text>
      )}

      {isPending ? (
        <View className="flex-1 justify-center items-center py-10">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : isError ? (
        <View className="flex-1 justify-center items-center py-10">
          <Text className="text-base text-gray-500">Could not load todos.</Text>
          <TouchableOpacity
            className="mt-3 bg-blue-500 px-5 py-2 rounded-lg"
            onPress={() => refetch()}
          >
            <Text className="text-white text-base font-semibold">
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={todos}
          renderItem={renderTodo}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center py-10">
              <Text className="text-base text-gray-400">
                No todos yet. Create one!
              </Text>
            </View>
          }
        />
      )}
    </View>
  )
}
