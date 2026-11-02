import { identityOf, isDraftMode, jsonEqual } from '@tms/sheet-core'
import { Avatar, Text, tokens, useLayout, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { contentWidthOf } from './contentWidth'
import { useSheet, useSheetSelector } from './context'
import { SheetStateBadge } from './creation/SheetState'
import { CompactEditors } from './evolve/compact'
import { FieldSlot } from './FieldSlot'
import { SectionView } from './SectionView'

// T-65: largura mínima de uma coluna da identidade (metade da coluna de
// grupo do DS), que cresce com a fonte. "Comportamento" no rótulo de campo
// mede ~114 dp: em três colunas de 112 dp (393 dp de tela) quebrava no meio.
const FACT_MIN = tokens.layout.minColWidth / 2
const COLUMN_GAP = tokens.space[3]

/**
 * Quantas colunas da identidade cabem por linha: as do template, se cabem;
 * senão menos, com as colunas quebrando em linhas na ordem do template.
 */
export function identityColumnsPerRow(
  width: number,
  fontScale: number,
  columns: number
): number {
  const available = contentWidthOf(width)
  const fits = Math.floor(
    (available + COLUMN_GAP) / (FACT_MIN * fontScale + COLUMN_GAP)
  )
  return Math.max(1, Math.min(columns, fits))
}

// Nome, selo e resumo, e as seções da zona `identity` (DS: IdentityBlock).
// Esses campos nunca são de seção restrita: o validador do template garante.
// Assina só a identidade: gastar Sangue não re-renderiza o cabeçalho.
export function IdentityBlock() {
  const { model, mode } = useSheet()
  const { accent } = useTheme()
  const id = useSheetSelector(s => identityOf(s.resolved), jsonEqual)
  const { width, fontScale } = useLayout()
  const sections = model.zones.find(z => z.id === 'identity')?.sections ?? []
  // Em Evoluir, o nome, o selo e o resumo que não estão em seção nenhuma
  // (Nome, Clã e Geração no Vampiro; Classe e Nível no D&D) ganham editor
  const loose = isDraftMode(mode)
    ? model.identityFields.filter(
        f => model.fields.get(f)?.sectionIds.length === 0
      )
    : []
  // Com colunas no template, o Editar mostra o cabeçalho como na ficha
  // impressa (Nome | Natureza, Comportamento, Conceito | Clã, Geração,
  // Senhor); tocar numa célula abre o mesmo editor da linha
  const columns = isDraftMode(mode)
    ? (model.template.identity.columns ?? null)
    : null
  const inColumns = new Set(columns?.flat())
  const perRow = columns
    ? identityColumnsPerRow(width, fontScale, columns.length)
    : 1
  const rest = columns
    ? [...loose, ...sections.flatMap(s => s.fieldIds)].filter(
        f => !inColumns.has(f)
      )
    : loose
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        {/* O símbolo da criatura (Ankh, estrela de nove pontas, garras), do
            template; sem ele, as iniciais */}
        <Avatar
          name={id.name}
          size="lg"
          emblem={model.template.identity.emblem}
        />
        <View style={styles.names}>
          {id.subtitle ? (
            <Text variant="caption" color="inkMuted">
              {id.subtitle}
            </Text>
          ) : null}
          {/* O título da tela já é o nome (AppBar): aqui não repete o heading */}
          <Text variant="displayXl" numberOfLines={2}>
            {id.name}
          </Text>
          {/* O estado da ficha (D-02): sob o nome, em qualquer modo, e não no
              título da AppBar, onde a 360 dp ele não cabe (P04-D §3.5) */}
          <SheetStateBadge />
          {id.chip ? (
            <View style={[styles.chip, { borderColor: accent.fill }]}>
              <Text variant="caption" color="accent">
                {id.chip}
              </Text>
            </View>
          ) : null}
          {id.summary && id.summary !== id.chip ? (
            <Text color="inkMuted">{id.summary}</Text>
          ) : null}
        </View>
      </View>
      {columns ? (
        <CompactEditors value>
          <View testID="identity-columns" style={styles.columns}>
            {columns.map(col => (
              <View
                key={col.join(':')}
                style={[styles.column, { width: `${100 / perRow}%` }]}
              >
                {col.map(f => (
                  <FieldSlot key={f} id={f} variant="fact" />
                ))}
              </View>
            ))}
          </View>
        </CompactEditors>
      ) : null}
      {rest.length ? (
        <View testID="identity-editors">
          {rest.map(f => (
            <FieldSlot key={f} id={f} variant="row" />
          ))}
        </View>
      ) : null}
      {columns
        ? null
        : sections.map(s => <SectionView key={s.id} section={s} hideTitle />)}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { paddingTop: tokens.space[4], gap: tokens.space[2] },
  head: {
    flexDirection: 'row',
    gap: tokens.space[4],
    paddingHorizontal: tokens.layout.gutter,
    alignItems: 'center',
  },
  names: { flex: 1, gap: tokens.space[1] },
  // As colunas quebram em linhas quando não cabem (T-65). O espaço entre
  // elas é o padding de cada coluna, para a largura em % somar 100
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: tokens.space[3],
    paddingHorizontal: tokens.layout.gutter - COLUMN_GAP / 2,
  },
  // minWidth 0: o valor longo quebra dentro da coluna
  column: {
    minWidth: 0,
    gap: tokens.space[1],
    paddingHorizontal: COLUMN_GAP / 2,
  },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: tokens.borderWidth.control,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space['0.5'],
  },
})
