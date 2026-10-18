import type { SheetMode } from '@tms/sheet-core'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'

import { SheetScreen } from '../../../sheet/SheetScreen'

export default function CharacterRoute() {
  const router = useRouter()
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>()
  // O parâmetro vem da URL: só "evolve" é aceito (a criação abre em Evoluir).
  // Vale só na chegada: recarregar ou voltar abre no modo padrão do papel
  const [initialMode] = useState<SheetMode | undefined>(
    mode === 'evolve' ? 'evolve' : undefined
  )
  useEffect(() => {
    if (mode) router.setParams?.({ mode: undefined })
  }, [mode, router])
  return <SheetScreen id={id} initialMode={initialMode} />
}
