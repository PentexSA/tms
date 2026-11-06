import { useQueryClient } from '@tanstack/react-query'
import {
  AppBar,
  Button,
  EmptyState,
  Screen,
  Skeleton,
  Text,
  tokens,
} from '@tms/ui'
import { useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { messageOf, statusOf } from '../../../../lib/errors'
import { paragraphs } from '../../../../lib/format'
import { chronicleKeys, useChronicle } from '../../../../lib/queries/chronicles'
import { useRefetchOnFocus } from '../../../../lib/queries/focus'
import { useSheetBack } from '../../../../sheet/navigation'

// A Apresentação da crônica para leitura (P14-D, U-09, D-15): a Descrição
// inteira, para o narrador e para os jogadores, a mesma tela para os dois. É
// uma rota, e não uma folha: o texto chega a 4000 caracteres, e o voltar do
// Android, o gesto do iOS, o voltar do navegador e o F5 funcionam sem código
// novo. Texto puro, em `Text`: nenhum parser, link nem HTML. Quem lê é
// decidido no servidor (`chronicleAccess`); a tela só mostra o que a API
// manda. Sem "Editar": o narrador escreve em Bastidores › Apresentação.

export default function ChronicleAboutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  const chronicle = useChronicle(id)
  useRefetchOnFocus(() =>
    queryClient.invalidateQueries(
      { queryKey: chronicleKeys.one(id) },
      { cancelRefetch: false }
    )
  )
  // Sem tela de baixo (link direto, F5), o "‹" abre a crônica da rota, também
  // enquanto ela carrega. Só a crônica que não existe (ou de que a pessoa não
  // participa) volta à lista: abrir ela de novo daria o mesmo 404
  const missing = chronicle.isError && statusOf(chronicle.error) === 404
  const back = useSheetBack(
    missing ? null : { id, name: chronicle.data?.name ?? 'Crônica' }
  )

  if (chronicle.isPending)
    return (
      <Screen>
        <AppBar title="Apresentação" back={back} />
        <Skeleton lines={5} />
      </Screen>
    )
  if (chronicle.isError)
    return (
      <Screen>
        <AppBar title="Apresentação" back={back} />
        {statusOf(chronicle.error) === 404 ? (
          <EmptyState
            title="Crônica não encontrada"
            message="Ela não existe ou você não participa dela."
          />
        ) : (
          <EmptyState
            title="Não foi possível carregar a crônica"
            message={messageOf(chronicle.error)}
            actions={
              <Button
                title="Tentar de novo"
                onPress={() => chronicle.refetch()}
              />
            }
          />
        )}
      </Screen>
    )

  const c = chronicle.data
  const subtitle = (
    <Text variant="caption" color="inkMuted">
      {c.name}
    </Text>
  )
  // O ex-membro não lê a apresentação no app, mesmo que a resposta a traga
  // (defesa em profundidade; a autoridade é o servidor)
  if (c.role === 'former')
    return (
      <Screen>
        <AppBar title="Apresentação" back={back} subtitle={subtitle} />
        <EmptyState
          title="Você saiu desta crônica"
          message="A apresentação é só para quem participa."
        />
      </Screen>
    )
  const parts = paragraphs(c.description ?? '')
  return (
    <Screen>
      <AppBar title="Apresentação" back={back} subtitle={subtitle} />
      {parts.length === 0 ? (
        <EmptyState
          title="Sem apresentação"
          message={
            c.role === 'storyteller'
              ? 'Escreva a apresentação em Bastidores › Apresentação.'
              : 'O narrador ainda não escreveu a apresentação desta crônica.'
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          testID="chronicle-about-scroll"
        >
          <View style={styles.column} testID="chronicle-about-text">
            {parts.map((part, index) => (
              // Os parágrafos não mudam de ordem nem têm id: o índice basta
              <Text key={index} selectable>
                {part}
              </Text>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: tokens.layout.gutter,
    paddingBottom: tokens.space[12],
  },
  // Até 640 a 1280: a linha não passa de uns 90 caracteres
  column: {
    gap: tokens.space[3],
    width: '100%',
    maxWidth: tokens.layout.contentMaxMedium,
  },
})
