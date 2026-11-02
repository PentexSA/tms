// A confirmação de concluir e de aprovar a criação (T-32): uma fonte só de
// texto para a barra de Criação, o menu ⋯ do narrador e o "Aprovar ficha",
// escrita para quem lê. O dono lê "passa pelo narrador"; o narrador, "passa
// por você". A conclusão não tem volta (D-04: "Reabrir criação" fica fora
// deste ciclo): se a reabertura entrar, o texto muda aqui. Os rótulos dos
// botões da barra continuam vindo de `completeLabel` (D-01 é do P03-D).

export type CompletionBy = 'owner' | 'storyteller'
export type CompletionAction = 'complete' | 'approve'

export interface CompletionCopy {
  // A pergunta, título da folha
  readonly title: string
  // O que acontece depois
  readonly body: string
  // O botão que confirma
  readonly confirm: string
  // O aviso depois de feito
  readonly done: string
}

const ENTERS_PLAY = {
  owner:
    'A ficha entra em jogo. Depois disso, subir um traço passa pelo narrador. Não dá para voltar à criação.',
  storyteller:
    'A ficha entra em jogo. Depois disso, subir um traço passa por você. Não dá para voltar à criação.',
} as const

/** Quem conclui: o narrador, se narra a ficha; senão, o dono. */
export const completionBy = (roles: ReadonlySet<string>): CompletionBy =>
  roles.has('storyteller') ? 'storyteller' : 'owner'

export function completionCopy(args: {
  readonly by: CompletionBy
  // A crônica pede aprovação de ficha nova
  readonly approval: boolean
  readonly action: CompletionAction
}): CompletionCopy {
  const { by, approval, action } = args
  if (by === 'storyteller') {
    if (action === 'approve')
      return {
        title: 'Aprovar ficha?',
        body: ENTERS_PLAY.storyteller,
        confirm: 'Aprovar ficha',
        done: 'Ficha aprovada e liberada.',
      }
    // O narrador que conclui também aprova (doc/plano-v4.md §2.3)
    const confirm = approval ? 'Concluir e aprovar' : 'Concluir criação'
    return {
      title: `${confirm}?`,
      body: ENTERS_PLAY.storyteller,
      confirm,
      done: 'Criação concluída. Subir um traço agora passa por você.',
    }
  }
  if (approval)
    return {
      title: 'Enviar para aprovação?',
      body: 'A ficha vai para o narrador aprovar e fica somente para leitura até lá.',
      confirm: 'Enviar para aprovação',
      done: 'Ficha enviada. Ela aguarda a aprovação do narrador.',
    }
  return {
    title: 'Concluir criação?',
    body: ENTERS_PLAY.owner,
    confirm: 'Concluir criação',
    done: 'Criação concluída. Subir um traço agora passa pelo narrador.',
  }
}

/** "Você tem 2 alterações não salvas…": concluir pelo menu não as descarta. */
export const unsavedBeforeCompleting = (count: number): string =>
  `Você tem ${
    count === 1 ? '1 alteração não salva' : `${count} alterações não salvas`
  } nesta ficha. Salve ou descarte antes de concluir.`

/** Lotes salvos ainda na fila: concluir espera o servidor confirmá-los. */
export const QUEUED_BEFORE_COMPLETING =
  'Há alterações salvas ainda sendo enviadas. Espere sincronizar antes de concluir.'

/** O 409 de revisão ou versão: a ficha mudou desde que foi aberta. */
export const STALE_COMPLETION =
  'A ficha mudou desde que você abriu. Confira e conclua de novo.'

export const isStaleCompletion = (body: unknown): boolean => {
  const code = (body as { code?: unknown } | null)?.code
  return (
    code === 'CREATION_REVISION_CONFLICT' || code === 'SHEET_VERSION_CONFLICT'
  )
}
