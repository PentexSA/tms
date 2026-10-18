import type { CompiledSection } from '@tms/sheet-core'
import type { ComponentType } from 'react'

export interface LayoutProps {
  readonly section: CompiledSection
}

export type Layout = ComponentType<LayoutProps>
