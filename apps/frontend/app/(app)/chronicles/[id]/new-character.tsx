import {
  AppBar,
  Button,
  EmptyState,
  KeyboardArea,
  Screen,
  Skeleton,
  Text,
  tokens,
  useToast,
} from '@tms/ui'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import {
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native'

import { UnsavedChangesGuard } from '../../../../components/UnsavedChangesGuard'
import { messageOf } from '../../../../lib/errors'
import { useBackTo } from '../../../../lib/navigation'
import {
  useChronicle,
  useCreateCharacter,
} from '../../../../lib/queries/chronicles'
import {
  CharacterForm,
  type ServerIssue,
} from '../../../../sheet/CharacterForm'
import {
  chronicleCreationSummary,
  newCharacterIntro,
} from '../../../../sheet/creation/summary'
import { useCompiled, useLatestTemplate } from '../../../../sheet/data'
import { UnsupportedTemplate } from '../../../../sheet/UnsupportedTemplate'

const issuesOf = (error: unknown): ServerIssue[] => {
  const value = (error as { value?: { issues?: unknown } } | null)?.value
  return Array.isArray(value?.issues) ? (value.issues as ServerIssue[]) : []
}

export default function NewCharacterScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>()
  const router = useRouter()
  const backToChronicle = useBackTo(`/chronicles/${id}`)
  const chronicle = useChronicle(id)
  const template = useLatestTemplate(chronicle.data?.system.code)
  const model = useCompiled(template.data)
  const create = useCreateCharacter(id)
  const toast = useToast()
  // Trava síncrona (T-02): dois toques no mesmo quadro chamam onSubmit duas
  // vezes antes de o `busy` chegar. Só destrava no erro; no sucesso a tela
  // navega para a ficha nova. A chave do comando (clientCommandId) fica no
  // useCreateCharacter, que a troca quando a resposta chega
  const submitting = useRef(false)
  // Guarda de saída (T-56): o formulário preenchido segura voltar, o F5 e o
  // Voltar do Android. Depois de criar, a ida para a ficha passa direto
  const [dirty, setDirty] = useState(false)
  const created = useRef(false)
  const npc = kind === 'npc' && chronicle.data?.role === 'storyteller'
  // T-21: "Criar ficha" com erro rola até o primeiro campo inválido; o `y`
  // da linha vem do formulário, e o do formulário, daqui
  const scroll = useRef<ScrollViewInstance>(null)
  const formY = useRef(0)
  // Uma lista por resposta do servidor: a mesma recusa repetida também leva
  // ao campo (o formulário reage a cada resposta)
  const serverIssues = useMemo(() => issuesOf(create.error), [create.error])
  // As regras de criação da crônica (T-29): o texto de topo diz em que modo
  // a ficha vai abrir e o orçamento combinado
  // (o ex-membro não recebe as regras, e não cria ficha)
  const creation =
    chronicle.data && 'creation' in chronicle.data
      ? chronicle.data.creation
      : undefined
  const back = {
    label: chronicle.data?.name ?? 'Crônica',
    // Sem tela de baixo (F5, link direto): a crônica (T-30)
    onPress: backToChronicle,
  }

  let body: React.JSX.Element
  if (chronicle.isError || template.isError)
    body = (
      <EmptyState
        title="Não foi possível abrir a criação de ficha"
        message={messageOf(chronicle.error ?? template.error)}
        actions={
          <Button
            title="Tentar de novo"
            onPress={() => {
              if (chronicle.isError) chronicle.refetch()
              if (template.isError) template.refetch()
            }}
          />
        }
      />
    )
  // L-02: template mais novo que o app; a tela dá a saída
  else if (model === null) body = <UnsupportedTemplate onBack={back.onPress} />
  else if (!model) body = <Skeleton lines={6} label="Carregando o sistema" />
  else
    body = (
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text color="inkMuted" testID="new-character-intro">
          {npc
            ? 'O NPC nasce oculto e em criação livre. Só você o vê até escolher o que revelar.'
            : creation
              ? newCharacterIntro(chronicleCreationSummary(model, creation))
              : // L-01: sem as regras da crônica, nada de "criação livre"
                'Comece pela identidade. Atributos, habilidades e poderes você monta depois, na ficha.'}
        </Text>
        <View
          testID="new-character-form"
          onLayout={e => {
            formY.current = e.nativeEvent.layout.y
          }}
        >
          <CharacterForm
            model={model}
            onInvalid={y =>
              scroll.current?.scrollTo({
                y: Math.max(0, formY.current + y - tokens.space[4]),
                animated: true,
              })
            }
            busy={create.isPending}
            error={
              create.isError && !serverIssues.length
                ? messageOf(create.error, 'Não foi possível criar a ficha')
                : null
            }
            serverIssues={serverIssues}
            onDirtyChange={setDirty}
            onSubmit={values => {
              if (submitting.current) return
              submitting.current = true
              create.mutate(npc ? { values, kind: 'npc' } : { values }, {
                // A ficha nova abre no rascunho: na Criação, quando o sistema
                // tem criação por pontos; senão, em Evoluir
                onSuccess: c => {
                  // T-56: a ida para a ficha nova passa pela guarda sem perguntar
                  created.current = true
                  // L-03: a confirmação vem antes de abrir a ficha; mesmo que
                  // ela não abra, a pessoa sabe que a ficha existe
                  toast.show({ message: 'Ficha criada.' })
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
        </View>
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
      {/* Encolhe acima do teclado também no Android (T-26) */}
      <KeyboardArea>{body}</KeyboardArea>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    gap: tokens.space[4],
    padding: tokens.layout.gutter,
    paddingBottom: tokens.space[12],
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
})
