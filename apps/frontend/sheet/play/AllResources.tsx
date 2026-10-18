import { View } from 'react-native'
import { useSheet } from '../context'
import { SectionView } from '../SectionView'

// "Todos os recursos" do dock: as seções da zona `play` inteiras, em linhas.
// Tocar numa linha troca o sheet pelo detalhe do campo.
export function AllResources() {
  const { model } = useSheet()
  const sections = model.zones.find(z => z.id === 'play')?.sections ?? []
  return (
    <View>
      {sections.map(s => (
        <SectionView key={s.id} section={s} hideTitle={sections.length === 1} />
      ))}
    </View>
  )
}
