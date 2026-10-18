import { useLocalSearchParams } from 'expo-router'

import { SheetScreen } from '../../../sheet/SheetScreen'

export default function CharacterRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <SheetScreen id={id} />
}
