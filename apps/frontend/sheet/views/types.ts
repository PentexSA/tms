import type { ResolvedField, ResolvedSheet } from '@tms/sheet-core'
import type { ComponentType } from 'react'

// Layout e tipo são eixos independentes (doc/arquitetura §6.3): o layout pede
// uma variante e o tipo diz como se desenhar nela.
export type Variant = 'row' | 'cell' | 'chip' | 'fact' | 'editor'

export interface FieldViewProps {
  readonly resolved: ResolvedField
  readonly sheet: ResolvedSheet
}

export type FieldViewComponent = ComponentType<FieldViewProps>

export type FieldView = Partial<Record<Variant, FieldViewComponent>>
