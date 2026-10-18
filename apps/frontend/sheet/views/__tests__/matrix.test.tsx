import { render, screen } from '@testing-library/react-native'
import {
  type FieldTypeName,
  resolve,
  type SheetData,
  type SheetModel,
  type SkinName,
  short,
} from '@tms/sheet-core'
import { ThemeProvider, ToastProvider } from '@tms/ui'
import { example, exampleIds, modelOf } from '../../../test/fixtures'
import { SheetProvider } from '../../context'
import { createSheetStore } from '../../store/sheetStore'
import { baseViews, type FieldView, skinViews, type Variant } from '..'

// Etapa 18 (doc/arquitetura §6.4): para cada view registrada (skin × tipo ×
// variante), o rótulo acessível de cada alvo começa pelo texto visível (o
// "label in name" do WCAG 2.5.3) e, quando o campo tem valor, algum alvo
// expõe accessibilityValue. Vale para as views que outras etapas registrarem.

interface Sample {
  readonly model: SheetModel
  readonly sheet: SheetData
  readonly id: string
}

/** Um campo de cada tipo, entre todas as fichas de exemplo, com valor. */
function sampleOf(type: FieldTypeName): Sample | undefined {
  let fallback: Sample | undefined
  for (const c of exampleIds().map(example)) {
    const model = modelOf(c.system)
    const resolved = resolve(model, c.sheet)
    for (const r of resolved.fields) {
      if (r.type !== type || r.field.readOnly) continue
      const sample = { model, sheet: c.sheet, id: r.id }
      if (short(r, resolved)) return sample
      fallback ??= sample
    }
  }
  return fallback
}

const entries: [string, FieldTypeName, Variant][] = []
const register = (
  skin: string,
  views: Partial<Record<FieldTypeName, FieldView>>
) => {
  for (const [type, variants] of Object.entries(views))
    for (const variant of Object.keys(variants ?? {}))
      entries.push([skin, type as FieldTypeName, variant as Variant])
}
register('base', baseViews)
for (const [skin, views] of Object.entries(skinViews)) register(skin, views)

type Instance = typeof screen.root

const texts = (root: Instance): string[] =>
  root
    .findAll((n: Instance) => n.type === 'Text')
    .flatMap((n: Instance) => {
      const c = n.props.children
      const parts: unknown[] = Array.isArray(c) ? c : [c]
      return parts.filter((p): p is string => typeof p === 'string')
    })
    .map((t: string) => t.trim())
    .filter(Boolean)

const labelled = (root: Instance) =>
  root.findAll(
    (n: Instance) =>
      typeof n.type === 'string' &&
      typeof (n.props.accessibilityLabel ?? n.props['aria-label']) === 'string'
  )

// 0 é valor (Força 0, Sangue 0): confere presença, não verdade
const hasValue = (n: Instance) =>
  (n.props.accessibilityValue?.text ??
    n.props.accessibilityValue?.now ??
    n.props['aria-valuenow'] ??
    n.props['aria-valuetext']) != null

it('há views registradas para conferir', () => {
  expect(entries.length).toBeGreaterThan(10)
})

describe.each(entries)('%s · %s · %s', (skin, type, variant) => {
  const sample = sampleOf(type)
  const views = skin === 'base' ? baseViews : skinViews[skin as SkinName]
  const View = (views[type] as FieldView | undefined)?.[variant]

  it('rótulo começa pelo texto visível; com valor, tem accessibilityValue', () => {
    if (!sample || !View) throw new Error(`sem exemplo para ${type}`)
    const editor = variant === 'editor'
    const store = createSheetStore({
      characterId: 'c1',
      model: sample.model,
      sheet: sample.sheet,
      sheetVersion: 1,
      roles: ['owner'],
      mode: editor ? 'evolve' : 'read',
      sync: { enqueue: jest.fn() },
    })
    if (editor) store.getState().startDraft()
    const entry = store.getState().entries.get(sample.id)
    if (!entry) throw new Error('campo sem entrada')
    render(
      <ThemeProvider skin={skin === 'base' ? 'wod' : (skin as SkinName)}>
        <ToastProvider>
          <SheetProvider store={store}>
            <View resolved={entry.resolved} sheet={entry.sheet} />
          </SheetProvider>
        </ToastProvider>
      </ThemeProvider>
    )
    const root = screen.root
    const visible = texts(root)
    const targets = labelled(root)
    expect(targets.length).toBeGreaterThan(0)
    for (const t of targets) {
      const label = String(t.props.accessibilityLabel ?? t.props['aria-label'])
      expect({
        label,
        ok: visible.some(v => label.startsWith(v)),
      }).toEqual({ label, ok: true })
    }
    if (short(entry.resolved, entry.sheet))
      expect(targets.some(hasValue)).toBe(true)
  })
})
