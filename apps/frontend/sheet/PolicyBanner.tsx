import { Banner } from '@tms/ui'
import { useSheet } from './context'
import { deadLabel, useLifecycle } from './policy'

// O estado da ficha quando ele muda o que se pode fazer (doc/plano-v3.md,
// Etapa 6): travada, arquivada, fora de jogo ou de quem saiu da crônica. Em
// `creating` e em `active` sem trava não há aviso: é a ficha de sempre.

export function PolicyBanner() {
  const { model, roles } = useSheet()
  const { status, locked, member } = useLifecycle()
  const narrator = roles.has('storyteller')
  const readOnly = 'Só leitura: só o narrador muda esta ficha.'
  const reactivate = 'Reative pelo menu ⋯ para o jogador voltar a jogar.'
  let banner: { title: string; message: string } | null = null
  if (!narrator && roles.has('owner') && !member)
    banner = {
      title: 'Você saiu desta crônica',
      message: 'A ficha é só leitura.',
    }
  else if (status === 'active' && locked)
    banner = narrator
      ? {
          title: 'Ficha travada',
          message:
            'O jogador não altera a ficha nem rola gastando recursos até você destravar.',
        }
      : {
          title: 'O narrador travou a ficha',
          message: 'Você ainda rola sem gastar recursos.',
        }
  else if (status === 'archived')
    banner = {
      title: 'Ficha arquivada',
      message: narrator ? reactivate : readOnly,
    }
  else if (status === 'dead')
    banner = {
      title: deadLabel(model),
      message: narrator ? reactivate : readOnly,
    }
  if (!banner) return null
  return (
    <Banner
      tone="warning"
      title={banner.title}
      message={banner.message}
      testID="policy-banner"
    />
  )
}
