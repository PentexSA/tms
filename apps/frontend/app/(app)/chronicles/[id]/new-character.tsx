import { AppBar, EmptyState, Screen, Skeleton, Text, tokens } from '@tms/ui'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native'

import { messageOf } from '../../../../lib/errors'
import {
  useChronicle,
  useCreateCharacter,
} from '../../../../lib/queries/chronicles'
import {
  CharacterForm,
  type ServerIssue,
} from '../../../../sheet/CharacterForm'
import { useCompiled, useLatestTemplate } from '../../../../sheet/data'

const issuesOf = (error: unknown): ServerIssue[] => {
  const value = (error as { value?: { issues?: unknown } } | null)?.value
  return Array.isArray(value?.issues) ? (value.issues as ServerIssue[]) : []
}

export default function NewCharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const chronicle = useChronicle(id)
  const template = useLatestTemplate(chronicle.data?.system.code)
  const model = useCompiled(template.data)
  const create = useCreateCharacter(id)
  const back = {
    label: chronicle.data?.name ?? 'Crônica',
    onPress: () => router.back(),
  }

  let body: React.JSX.Element
  if (chronicle.isError || template.isError)
    body = (
      <EmptyState
        title="Não foi possível abrir a criação de ficha"
        message={messageOf(chronicle.error ?? template.error)}
      />
    )
  else if (model === null)
    body = (
      <EmptyState
        title="Atualize o app"
        message="Este sistema usa uma versão que este app ainda não conhece."
      />
    )
  else if (!model) body = <Skeleton lines={6} label="Carregando o sistema" />
  else
    body = (
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text color="inkMuted">
          Comece pela identidade. Atributos, habilidades e poderes você monta
          depois, na ficha.
        </Text>
        <CharacterForm
          model={model}
          busy={create.isPending}
          error={
            create.isError && !issuesOf(create.error).length
              ? messageOf(create.error, 'Não foi possível criar a ficha')
              : null
          }
          serverIssues={issuesOf(create.error)}
          onSubmit={values =>
            create.mutate(values, {
              onSuccess: c => router.replace(`/characters/${c.id}`),
            })
          }
        />
      </ScrollView>
    )

  return (
    <Screen>
      <AppBar title="Nova ficha" back={back} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    gap: tokens.space[4],
    padding: tokens.layout.gutter,
    paddingBottom: tokens.space[12],
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
})
