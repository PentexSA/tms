import { useLocalSearchParams } from 'expo-router'

import { SheetScreen } from '../../../sheet/SheetScreen'

export default function CharacterRoute() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>()
  // O parâmetro vem da URL: só "evolve" é aceito (a criação abre em Evoluir)
  return (
    <SheetScreen
      id={id}
      initialMode={mode === 'evolve' ? 'evolve' : undefined}
    />
  )
}
