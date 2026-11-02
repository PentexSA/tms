import type { CompiledSection } from '@tms/sheet-core'
import type { ComponentType } from 'react'

export interface LayoutProps {
  readonly section: CompiledSection
  // O título da seção está à vista: o grupo de mesmo nome não o repete
  readonly titled?: boolean
}

export type Layout = ComponentType<LayoutProps>
