import { AppBar, EmptyState, Screen, Skeleton, Text, tokens } from '@tms/ui'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native'

import { UnsavedChangesGuard } from '../../../../components/UnsavedChangesGuard'
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
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>()
  const router = useRouter()
  const chronicle = useChronicle(id)
  const template = useLatestTemplate(chronicle.data?.system.code)
  const model = useCompiled(template.data)
  const create = useCreateCharacter(id)
  // Trava síncrona (T-02): dois toques no mesmo quadro chamam onSubmit duas
  // vezes antes de o `busy` chegar. Só destrava no erro; no sucesso a tela
  // navega para a ficha nova
  const submitting = useRef(false)
  // Guarda de saída (T-56): o formulário preenchido segura voltar, o F5 e o
  // Voltar do Android. Depois de criar, a ida para a ficha passa direto
  const [dirty, setDirty] = useState(false)
  const created = useRef(false)
  const npc = kind === 'npc' && chronicle.data?.role === 'storyteller'
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
          {npc
            ? 'O NPC nasce oculto e em criação livre. Só você o vê até escolher o que revelar.'
            : 'Comece pela identidade. Atributos, habilidades e poderes você monta depois, na ficha.'}
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
          onDirtyChange={setDirty}
          onSubmit={values => {
            if (submitting.current) return
            submitting.current = true
            create.mutate(npc ? { values, kind: 'npc' } : { values }, {
              // A ficha nova abre no rascunho: na Criação, quando o sistema
              // tem criação por pontos; senão, em Evoluir
              onSuccess: c => {
                created.current = true
                router.replace(
                  `/characters/${c.id}?mode=${model.template.creation ? 'create' : 'evolve'}`
                )
              },
              onError: () => {
                submitting.current = false
              },
            })
          }}
        />
      </ScrollView>
    )

  return (
    <Screen>
      <AppBar title={npc ? 'Novo NPC' : 'Nova ficha'} back={back} />
      <UnsavedChangesGuard
        when={dirty}
        allowLeave={created}
        message={`O que você preencheu ${npc ? 'no NPC novo' : 'na ficha nova'} ainda não foi criado e será descartado.`}
      />
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
