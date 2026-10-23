import { plain } from './fields'
import type { ResolvedSheet } from './resolve'

// O que aparece fora da ficha: header, cartões, lista de personagens e mesa.
// Esses campos nunca são de seção restrita (o validador garante).

export interface IdentityText {
  readonly name: string
  // Selo ao lado do nome ("Tremere", "Mago nv 5").
  readonly chip: string
  // Resumo sob o nome ("Ocultista · 8ª geração"); sem resumo, repete o selo.
  readonly summary: string
  readonly voice: string | null
  readonly subtitle: string | null
  // accent-N da paleta validada, ou accent-neutral.
  readonly accent: string
}

/** DTO de identidade que pode atravessar a fronteira pública de um NPC. */
export interface PublicIdentity {
  readonly name: string
  readonly chip: string
  readonly subtitle: string | null
  readonly portraitUrl: string | null
}

export const UNNAMED = 'Sem nome'

export function identityOf(sheet: ResolvedSheet): IdentityText {
  const { identity, accent } = sheet.model.template
  const text = (id: string | undefined): string => {
    const r = id ? sheet.get(id) : undefined
    return r ? plain(r, sheet) : ''
  }
  const chip = identity.chipFormat
    ? identity.chipFormat.replace(/\{([a-zA-Z0-9]+)\}/g, (_, id: string) =>
        text(id)
      )
    : text(identity.chip)
  const summary = (identity.summary ?? [])
    .filter(id => id !== identity.chip)
    .map(text)
    .filter(Boolean)
    .join(' · ')
  const from = accent.from ? sheet.get(accent.from) : undefined
  const option = from?.type === 'choice' ? from.value : null
  const mapped =
    option && Object.hasOwn(accent.map, option) ? accent.map[option] : null
  return {
    name: text(identity.name) || UNNAMED,
    chip,
    summary: summary || chip,
    voice: text(identity.voice) || null,
    subtitle: text(identity.subtitle) || null,
    accent: mapped || accent.fallback || 'accent-neutral',
  }
}

/**
 * Projeção deliberadamente menor que IdentityText. Não inclui summary, voice
 * ou accent e nunca inclui os valores usados para calculá-la.
 */
export function publicIdentityOf(
  sheet: ResolvedSheet,
  portraitUrl: string | null = null
): PublicIdentity {
  const identity = identityOf(sheet)
  return {
    name: identity.name,
    chip: identity.chip,
    subtitle: identity.subtitle,
    portraitUrl,
  }
}
