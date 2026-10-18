import type { FieldTypeName } from '@tms/sheet-core'
import { RatingCell } from '../RatingViews'
import type { FieldView, FieldViewProps } from '../types'

// Skin "wod" (doc/arquitetura §6.4): mesmas props e a mesma acessibilidade da
// view base; só o visual muda. Na grade de Atributos, os pips são grandes.

function WodRatingCell(props: FieldViewProps) {
  return <RatingCell {...props} pip="md" />
}

export const wodViews: Partial<Record<FieldTypeName, FieldView>> = {
  rating: { cell: WodRatingCell },
}
