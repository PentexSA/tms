import { useQuery } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, Text, View } from 'react-native'

import { api, unwrap } from '../lib/api'

// Placeholder até a tela de Crônicas (doc/plano-v0.md, Etapa 11)
export default function HomeScreen() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async ({ signal }) =>
      unwrap(await api.health.get({ fetch: { signal } })),
  })

  return (
    <View className="flex-1 items-center justify-center bg-gray-100 px-6">
      <StatusBar style="auto" />
      <Text accessibilityRole="header" className="text-[32px] font-bold">
        TMS
      </Text>
      <Text className="mt-2 text-base text-gray-600">Fichas de RPG</Text>
      <View className="mt-6 h-6">
        {health.isPending ? (
          <ActivityIndicator accessibilityLabel="Verificando a API" />
        ) : (
          <Text className="text-sm text-gray-500">
            {health.isSuccess ? 'API online' : 'API indisponível'}
          </Text>
        )}
      </View>
    </View>
  )
}
