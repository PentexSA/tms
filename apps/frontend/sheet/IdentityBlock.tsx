import { identityOf, jsonEqual } from '@tms/sheet-core'
import { Avatar, Text, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useSheet, useSheetSelector } from './context'
import { CompactEditors } from './evolve/compact'
import { FieldSlot } from './FieldSlot'
import { SectionView } from './SectionView'

// Nome, selo e resumo, e as seções da zona `identity` (DS: IdentityBlock).
// Esses campos nunca são de seção restrita: o validador do template garante.
// Assina só a identidade: gastar Sangue não re-renderiza o cabeçalho.
export function IdentityBlock() {
  const { model, mode } = useSheet()
  const { accent } = useTheme()
  const id = useSheetSelector(s => identityOf(s.resolved), jsonEqual)
  const sections = model.zones.find(z => z.id === 'identity')?.sections ?? []
  // Em Evoluir, o nome, o selo e o resumo que não estão em seção nenhuma
  // (Nome, Clã e Geração no Vampiro; Classe e Nível no D&D) ganham editor
  const loose =
    mode === 'evolve'
      ? model.identityFields.filter(
          f => model.fields.get(f)?.sectionIds.length === 0
        )
      : []
  // Com colunas no template, o Editar mostra o cabeçalho como na ficha
  // impressa (Nome | Natureza, Comportamento, Conceito | Clã, Geração,
  // Senhor); tocar numa célula abre o mesmo editor da linha
  const columns =
    mode === 'evolve' ? (model.template.identity.columns ?? null) : null
  const inColumns = new Set(columns?.flat())
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
              <View key={col.join(':')} style={styles.column}>
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
  columns: {
    flexDirection: 'row',
    gap: tokens.space[3],
    paddingHorizontal: tokens.layout.gutter,
  },
  // minWidth 0: o valor longo quebra dentro da coluna
  column: { flex: 1, minWidth: 0, gap: tokens.space[1] },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: tokens.borderWidth.control,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space['0.5'],
  },
})
