/*
 * Vitrine do design system: tokens com contraste calculado na hora e componentes vivos.
 * Os componentes são os mesmos que o protótipo das telas usa (ui.js + components.css).
 */
;(() => {
  const {
    h,
    icon,
    pips,
    clock,
    moon,
    toast,
    sheet,
    confirmDialog,
    stepper,
    initials,
  } = window.TMSUI
  const { tokens, skins } = window.TMS_TOKENS
  const root = document.documentElement
  const body = document.body

  function readStore(key) {
    try {
      return localStorage.getItem(`tms-ds:${key}`)
    } catch {
      return null
    }
  }
  function writeStore(key, value) {
    try {
      localStorage.setItem(`tms-ds:${key}`, value)
    } catch {
      /* sem storage */
    }
  }

  // ---------- Controles: tema, skin, accent, títulos ----------

  const state = {
    theme: readStore('theme') ?? 'noite',
    skin: readStore('skin') ?? 'wod',
    accent: readStore('accent') ?? 'accent-1',
    plain: readStore('plain') === '1',
  }
  function apply() {
    root.dataset.theme = state.theme
    body.dataset.skin = state.skin
    body.dataset.accent = state.accent
    if (state.plain) root.dataset.plainTitles = 'true'
    else delete root.dataset.plainTitles
    for (const [k, v] of Object.entries(state))
      writeStore(k, v === true ? '1' : v === false ? '0' : v)
    renderContent()
  }
  const select = (label, key, options) => {
    const el = h(
      'select',
      {
        onchange: e => {
          state[key] = e.target.value
          apply()
        },
      },
      options.map(([v, t]) =>
        h('option', { value: v, selected: state[key] === v ? true : null }, t)
      )
    )
    return h('label', {}, label, el)
  }
  document.getElementById('controls').append(
    select('Tema', 'theme', [
      ['noite', 'Noite'],
      ['pergaminho', 'Pergaminho'],
    ]),
    select(
      'Skin',
      'skin',
      skins.map(s => [s.id, `${s.name} (${s.id})`])
    ),
    select('Accent', 'accent', [
      ['accent-neutral', 'Neutro'],
      ...tokens.color.accents.palette.map(a => [
        a.name,
        `${a.name} · ${a.label}`,
      ]),
    ]),
    // O rótulo inteiro é o alvo (44 px), não só a caixa nativa de 13 px.
    h(
      'label',
      { style: 'min-height:var(--hit-size);cursor:pointer' },
      h('input', {
        type: 'checkbox',
        checked: state.plain ? true : null,
        onchange: e => {
          state.plain = e.target.checked
          apply()
        },
      }),
      'Títulos sem fonte decorativa'
    )
  )

  // ---------- Contraste (mesma fórmula do check_tokens.py) ----------

  const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const lum = hex => {
    const n = hex.replace('#', '')
    const [r, g, b] = [0, 2, 4].map(i =>
      lin(Number.parseInt(n.slice(i, i + 2), 16) / 255)
    )
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  const isHex = v => /^#[0-9a-f]{6}$/i.test(v)

  // ---------- Blocos ----------

  const blocks = []
  const block = (id, title, lead, ...children) =>
    blocks.push({
      id,
      title,
      node: () =>
        h(
          'section',
          { class: 'v-block', id, 'aria-labelledby': `${id}-h` },
          h('h2', { id: `${id}-h`, text: title }),
          lead ? h('p', { class: 'v-lead', text: lead }) : null,
          children.map(c => (typeof c === 'function' ? c() : c))
        ),
    })
  const demo = (title, note, ...children) =>
    h(
      'div',
      { class: 'ds-card v-demo' },
      h('h3', { text: title }),
      note ? h('p', { text: note }) : null,
      children
    )

  block('principios', 'Princípios', null, () =>
    h(
      'div',
      { class: 'ds-card ds-card--pad' },
      h(
        'ul',
        {},
        [
          'O valor aparece na notação nativa do sistema, declarada no template. O número está sempre disponível, visível ou para o leitor de tela.',
          'O accent é opcional e vem dos dados (clã, classe, playbook). Sem accent, a ficha usa o neutro. Cor nunca identifica sozinha: o nome e as iniciais acompanham.',
          'A fonte display é da skin. Texto de leitura e números são sempre a sans do core.',
          'Rótulos vêm do template. O design system não contém termos de jogo.',
          'Celular primeiro, mesa de jogo: alvos de 44 px, linha inteira como alvo, recursos de combate na zona do polegar.',
          'Leitura, Jogo e Evoluir: tocar nunca altera traço permanente por acidente; toda alteração tem Desfazer.',
        ].map(t => h('li', { text: t }))
      )
    )
  )

  block(
    'cor',
    'Cor',
    'Contraste calculado agora, no tema selecionado, contra bg, surface e surface-raised. Texto exige 4.5:1; não texto, 3:1. O CI roda scripts/check_tokens.py com as mesmas regras e também ΔE2000 contra action com daltonismo simulado.',
    () => {
      const theme = state.theme
      const all = [...tokens.color.core, ...tokens.color.accentAlt]
      const surfaces = ['bg', 'surface', 'surface-raised'].map(
        n => all.find(t => t.name === n).value[theme]
      )
      const rows = all.map(t => {
        const v = t.value[theme]
        let check = '—'
        if (isHex(v) && (t.role === 'text' || t.role === 'non-text')) {
          const need = t.role === 'text' ? 4.5 : 3
          const worst = Math.min(...surfaces.map(s => ratio(v, s)))
          check = h('span', {
            class: worst >= need ? 'v-pass' : 'v-fail',
            text: `${worst.toFixed(2)}:1 ${worst >= need ? 'passa' : 'falha'}`,
          })
        } else if (t.role === 'on') {
          const r = ratio(v, all.find(x => x.name === t.on).value[theme])
          check = h('span', {
            class: r >= 4.5 ? 'v-pass' : 'v-fail',
            text: `${r.toFixed(2)}:1 sobre ${t.on}`,
          })
        }
        return h(
          'tr',
          {},
          h(
            'td',
            {},
            h('div', {
              class: 'v-swatch',
              style: `background:${isHex(v) || v.startsWith('rgba') ? v : 'transparent'}`,
            })
          ),
          h('td', {}, h('code', { text: t.name })),
          h('td', { class: 'num', text: v }),
          h('td', { text: t.role }),
          h('td', { class: 'num' }, check),
          h('td', { text: t.usage })
        )
      })
      return h(
        'div',
        { class: 'ds-card v-scroll' },
        h(
          'table',
          { class: 'v-table' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              ['', 'Token', 'Valor', 'Papel', 'Pior contraste', 'Uso'].map(x =>
                h('th', { text: x })
              )
            )
          ),
          h('tbody', {}, rows)
        )
      )
    },
    () =>
      h('h3', { class: 'ds-group-title', text: 'Paleta de accent (validada)' }),
    () => h('p', { class: 'v-lead', text: tokens.color.accents.usage }),
    () =>
      h(
        'div',
        { class: 'v-accents' },
        [
          { name: 'accent-neutral', label: 'Neutro' },
          ...tokens.color.accents.palette,
        ].map(a =>
          h(
            'div',
            { class: 'v-accent', 'data-accent': a.name },
            h('div', { class: 'v-accent__fill', text: a.name }),
            h('div', { class: 'v-accent__text', text: `${a.label} · texto` }),
            h(
              'div',
              { class: 'v-row', style: 'margin-top:8px' },
              pips([
                { kind: 'on', n: 3 },
                { kind: 'off', n: 2 },
              ]),
              h('span', { class: 'ds-id-chip', text: a.label })
            )
          )
        )
      )
  )

  block(
    'tipografia',
    'Tipografia',
    `${tokens.type.loading}`,
    () =>
      h(
        'div',
        { class: 'ds-card ds-card--pad v-stack' },
        tokens.type.styles.map(s =>
          h(
            'div',
            {},
            h('div', {
              class: `t-${s.name}`,
              text: s.name.startsWith('number')
                ? '27 / 134 +5'
                : s.name === 'voice'
                  ? 'Todo segredo tem um preço.'
                  : s.name.startsWith('display')
                    ? 'Atributos e Perícias'
                    : 'Inteligência · Especialização',
            }),
            h('div', {
              class: 'ds-row__sub',
              text: `${s.name} · ${s.size}dp / ${s.lineHeight} · ${s.weight}${s.italic ? ' itálico' : ''} · ${s.family} — ${s.usage}`,
            })
          )
        )
      ),
    () =>
      h(
        'div',
        { class: 'ds-card ds-card--pad' },
        h(
          'ul',
          {},
          tokens.type.rules.map(r => h('li', { text: r }))
        )
      )
  )

  const tokenTable = (list, unit = 'px') =>
    h(
      'div',
      { class: 'ds-card v-scroll' },
      h(
        'table',
        { class: 'v-table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            ['Token', 'Valor', 'Uso'].map(x => h('th', { text: x }))
          )
        ),
        h(
          'tbody',
          {},
          list.map(t =>
            h(
              'tr',
              {},
              h('td', {}, h('code', { text: t.name })),
              h('td', {
                class: 'num',
                text: `${t.value}${typeof t.value === 'number' ? unit : ''}`,
              }),
              h('td', { text: t.usage })
            )
          )
        )
      )
    )

  block(
    'medidas',
    'Espaço, raio, tamanho e borda',
    'Alvos de toque separados do visual: o pip tem 16 px, mas o alvo é a linha inteira (48) ou o botão de 44.',
    () =>
      h(
        'div',
        { class: 'v-grid' },
        demo('Espaço', null, tokenTable(tokens.space)),
        demo('Raio', null, tokenTable(tokens.radius)),
        demo('Tamanho', null, tokenTable(tokens.size)),
        demo('Borda', null, tokenTable(tokens.border))
      )
  )

  block(
    'elevacao',
    'Elevação, motion, camadas e breakpoints',
    tokens.motion.reducedMotion,
    () =>
      h(
        'div',
        { class: 'v-grid' },
        demo(
          'Elevação',
          'Superfícies se separam por borda + sombra, não só por cor (bg × surface tem 1.06:1).',
          h(
            'div',
            { class: 'v-stack' },
            tokens.elevation.map(e =>
              h('div', {
                class: 'v-elev',
                style: `background:var(--${e.name === 'elevation-1' ? 'surface' : 'surface-raised'});box-shadow:var(--${e.name});border:1px solid var(--border-subtle)`,
                text: e.name,
              })
            )
          )
        ),
        demo(
          'Motion',
          null,
          tokenTable([...tokens.motion.duration, ...tokens.motion.easing], 'ms')
        ),
        demo('Camadas', null, tokenTable(tokens.layer, '')),
        demo(
          'Breakpoints',
          null,
          h(
            'div',
            { class: 'ds-card v-scroll' },
            h(
              'table',
              { class: 'v-table' },
              h(
                'tbody',
                {},
                tokens.breakpoint.map(b =>
                  h(
                    'tr',
                    {},
                    h('td', {}, h('code', { text: b.name })),
                    h('td', {
                      class: 'num',
                      text: `${b.min}${b.max ? `–${b.max}` : '+'}`,
                    }),
                    h('td', { text: b.usage })
                  )
                )
              )
            )
          )
        ),
        demo('Layout', null, tokenTable(tokens.layout))
      )
  )

  block(
    'acoes',
    'Ações',
    'Uma ação primária por tela, com verbo. Estados: hover, pressionado, desabilitado, carregando, perigo. O foco no botão primário usa anel em ink, distinto do fundo action.',
    () =>
      h(
        'div',
        { class: 'v-grid' },
        demo(
          'Button',
          null,
          h(
            'div',
            { class: 'v-row' },
            h(
              'button',
              { type: 'button', class: 'ds-btn ds-btn--primary ds-pressable' },
              icon('dice'),
              'Rolar dados'
            ),
            h(
              'button',
              { type: 'button', class: 'ds-btn ds-pressable' },
              'Secundário'
            ),
            h(
              'button',
              { type: 'button', class: 'ds-btn ds-btn--ghost ds-pressable' },
              'Desfazer'
            ),
            h(
              'button',
              { type: 'button', class: 'ds-btn ds-btn--danger ds-pressable' },
              icon('trash'),
              'Excluir'
            ),
            h(
              'button',
              { type: 'button', class: 'ds-btn', disabled: true },
              'Desabilitado'
            ),
            h(
              'button',
              {
                type: 'button',
                class: 'ds-btn ds-btn--primary',
                'aria-busy': 'true',
              },
              'Salvando'
            )
          )
        ),
        demo(
          'IconButton',
          'Alvo de 44 × 44 e rótulo acessível obrigatório. Ícones genéricos, sem símbolos de sistema.',
          h(
            'div',
            { class: 'v-row' },
            [
              'back',
              'more',
              'plus',
              'minus',
              'undo',
              'dice',
              'edit',
              'history',
              'search',
              'close',
            ].map(n =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'ds-icon-btn ds-pressable',
                  'aria-label': n,
                },
                icon(n)
              )
            )
          )
        ),
        demo(
          'SegmentedControl',
          'Substitui as abas dentro de uma seção. role radiogroup ou tablist.',
          (() => {
            let sel = 'normal'
            const wrap = h('div', {})
            const fill = () =>
              wrap.replaceChildren(
                h(
                  'div',
                  {
                    class: 'ds-seg',
                    role: 'radiogroup',
                    'aria-label': 'Exemplo',
                  },
                  [
                    ['normal', 'Normal'],
                    ['adv', 'Vantagem'],
                    ['dis', 'Desvantagem'],
                  ].map(([id, t]) =>
                    h(
                      'button',
                      {
                        type: 'button',
                        role: 'radio',
                        'aria-checked': String(sel === id),
                        onclick: () => {
                          sel = id
                          fill()
                        },
                      },
                      t
                    )
                  )
                )
              )
            fill()
            return wrap
          })()
        )
      )
  )

  block(
    'valores',
    'Primitivos de valor',
    'Um tipo por conceito; o template escolhe o tipo e o display. O alvo de toque é sempre a linha ou a célula; os pips são só visuais (aria-hidden).',
    () =>
      h(
        'div',
        { class: 'v-grid' },
        demo(
          'RatingDots · rating',
          'Base, bônus temporário (anel duplo), perdido (traço) e escala de 10.',
          h(
            'div',
            { class: 'v-stack' },
            h(
              'div',
              { class: 'v-row' },
              pips([
                { kind: 'on', n: 3 },
                { kind: 'off', n: 2 },
              ]),
              h('span', { class: 'ds-row__num', text: '3' })
            ),
            h(
              'div',
              { class: 'v-row' },
              pips(
                [
                  { kind: 'on', n: 3 },
                  { kind: 'bonus', n: 4 },
                ],
                { small: true }
              ),
              h('span', { class: 'ds-row__num', text: '7' }),
              h('span', { class: 'ds-row__sub', text: '3 + 4 da forma Crinos' })
            ),
            h(
              'div',
              { class: 'v-row' },
              pips([
                { kind: 'on', n: 0 },
                { kind: 'lost', n: 3 },
                { kind: 'off', n: 2 },
              ]),
              h('span', { class: 'ds-row__num', text: '0' }),
              h('span', { class: 'ds-row__sub', text: '0 na forma Crinos' })
            ),
            h(
              'div',
              { class: 'v-row' },
              pips(
                [
                  { kind: 'on', n: 6 },
                  { kind: 'off', n: 4 },
                ],
                { small: true, max: 10 }
              ),
              h('span', { class: 'ds-row__num', text: '6' })
            )
          )
        ),
        demo(
          'FieldRow',
          'Linha de 48 px, um único alvo. Rótulo, sub-rótulo (especialização, origem do modificador, teto), valor sempre com número.',
          h(
            'ul',
            { class: 'ds-rows ds-card' },
            row(
              'Inteligência',
              ['Memória eidética'],
              [
                pips([
                  { kind: 'on', n: 4 },
                  { kind: 'off', n: 1 },
                ]),
                num('4'),
              ],
              'Inteligência, 4 de 5, especialização Memória eidética'
            ),
            row(
              'Forças',
              [
                h('span', { class: 'ds-badge', text: 'Afinidade' }),
                '1 inativo · máx. pelo Arete (3)',
              ],
              [
                pips([
                  { kind: 'on', n: 3 },
                  { kind: 'off', n: 2 },
                ]),
                num('3'),
              ],
              'Forças, 3 de 5, 1 inativo acima do Arete',
              true
            ),
            row(
              'Arcanismo',
              ['Int'],
              [h('span', { class: 'ds-badge', text: '◆' }), num('+7')],
              'Arcanismo, proficiente, mais 7'
            ),
            row(
              'Esquivar',
              [],
              [
                h(
                  'span',
                  { class: 'ds-row__num' },
                  '45%',
                  h('small', {}, ' ½ 22 · ⅕ 9')
                ),
              ],
              'Esquivar, 45 por cento; difícil 22; extremo 9'
            ),
            row(
              'Atletismo',
              [],
              [
                h(
                  'span',
                  { class: 'ds-row__num' },
                  '+4',
                  h('small', {}, ' Ótimo')
                ),
              ],
              'Atletismo, Ótimo, mais 4'
            )
          )
        ),
        demo(
          'Grade primária',
          'Célula de 64 px como alvo. rating (pips + número) ou number com display score+mod (modificador grande).',
          h(
            'div',
            { class: 'ds-grid', style: '--cols:3' },
            cell(
              'Força',
              '2',
              pips([
                { kind: 'on', n: 2 },
                { kind: 'off', n: 3 },
              ])
            ),
            cell(
              'Carisma',
              '2',
              pips([
                { kind: 'on', n: 2 },
                { kind: 'off', n: 3 },
              ])
            ),
            cell(
              'Percepção',
              '3',
              pips([
                { kind: 'on', n: 3 },
                { kind: 'off', n: 2 },
              ])
            ),
            bigCell('FOR', '−1', '8'),
            bigCell('INT ◆', '+4', '18'),
            bigCell('SAB ◆', '+1', '12')
          )
        ),
        demo(
          'Resource',
          'Caixas se o máximo é até 20; acima disso, número + barra + teclado numérico. O par usa cor quase neutra + hachura.',
          h(
            'div',
            { class: 'v-stack' },
            h(
              'div',
              {},
              h('div', { class: 'p-kv', text: 'Pontos de Sangue · 9/15' }),
              h(
                'div',
                { class: 'ds-boxes' },
                Array.from({ length: 15 }, (_, i) =>
                  h('span', { class: ['ds-box', i < 9 && 'is-filled'] })
                )
              )
            ),
            h(
              'div',
              {},
              h('div', { class: 'p-kv', text: 'Gnose · 4/4 (par da Fúria)' }),
              h(
                'div',
                { class: 'ds-boxes is-alt-warm' },
                Array.from({ length: 4 }, () =>
                  h('span', { class: 'ds-box is-filled is-alt-warm' })
                )
              )
            ),
            h(
              'div',
              {},
              h('div', { class: 'p-kv', text: 'Pontos de Vida · 27/27 +5' }),
              h(
                'div',
                { class: 'ds-meter' },
                h('div', { class: 'ds-meter__fill', vars: { pct: 84 } }),
                h('div', {
                  class: 'ds-meter__fill ds-meter__fill--temp',
                  vars: { 'pct-temp': 16 },
                })
              )
            )
          )
        ),
        demo(
          'Track · LeveledTrack',
          'Níveis com rótulo, penalidade, glifo e tipo por extenso (o glifo nunca é a única pista). Os nomes vêm do template.',
          h(
            'div',
            { class: 'ds-track' },
            [
              ['Escoriado', '', 'Letal', 'X'],
              ['Machucado', '−1', 'Contusivo', '/'],
              ['Ferido', '−1', '', ''],
            ].map(([l, p, t, g]) =>
              h(
                'div',
                { class: 'ds-track__row' },
                h('span', { class: 'ds-track__label', text: l }),
                h('span', { class: 'ds-track__pen', text: p }),
                h('span', { class: 'ds-track__type', text: t }),
                h('span', { class: 'ds-box', text: g })
              )
            )
          )
        ),
        demo(
          'Track · caixas com valor e Slots',
          'Estresse de Fate (valores 1/2/3), testes contra a morte, espaços de magia. Caixa tocável tem alvo de 44.',
          h(
            'div',
            { class: 'v-stack' },
            h(
              'div',
              { class: 'ds-boxes ds-boxes--hit' },
              [1, 2, 3].map((v, i) =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'ds-box ds-pressable',
                    'aria-pressed': String(i === 1),
                    'aria-label': `Físico, caixa de valor ${v}`,
                  },
                  h('span', { text: String(v) })
                )
              )
            ),
            h(
              'div',
              { class: 'ds-track__row' },
              h('span', { class: 'ds-track__label', text: '1º nível' }),
              h(
                'span',
                { class: 'ds-boxes' },
                Array.from({ length: 4 }, (_, i) =>
                  h('span', { class: ['ds-box', i < 3 && 'is-filled'] })
                )
              )
            )
          )
        ),
        demo(
          'Clock',
          'N casas, até 2 preenchimentos opostos (Quintessência/Paradoxo, relógios de PbtA). Números fora do miolo, em sans.',
          h(
            'div',
            { class: 'v-row' },
            clock({
              segments: 20,
              size: 140,
              label: 'Quintessência 6, Paradoxo 2, de 20 casas',
              fills: [
                { n: 6, from: 'start', role: 'accent' },
                { n: 2, from: 'end', role: 'alt-cool' },
              ],
            }),
            clock({
              segments: 6,
              size: 96,
              label: 'Relógio, 4 de 6',
              fills: [{ n: 4, from: 'start', role: 'accent' }],
            })
          )
        ),
        demo(
          'Stepper / ValueEditor',
          'Grupo com botões −/+ reais e um spinbutton (setas, PageUp/PageDown, Home, End; Enter digita). No RN: adjustable com increment/decrement. Botões de 56 px; segurar repete no visual e grava uma alteração ao soltar; tocar no número abre o teclado numérico.',
          (() => {
            const out = h('p', { class: 'ds-row__sub', 'aria-live': 'polite' })
            return h(
              'div',
              { class: 'v-stack' },
              stepper({
                label: 'Pontos de Vida',
                value: 27,
                min: 0,
                max: 134,
                allowInput: true,
                valueText: v => `${v} de 134`,
                onChange: v => {
                  out.textContent = `Valor: ${v}`
                },
              }),
              stepper({
                label: 'Destreza',
                value: 2,
                min: 1,
                max: 5,
                inline: true,
              }),
              out
            )
          })()
        ),
        demo(
          'Escolha com modificadores (state)',
          'Radiogroup; cada opção mostra os valores efetivos. Formas do Garou, Forma Selvagem, Fúria do Bárbaro.',
          (() => {
            let sel = 'crinos'
            const wrap = h('div', {})
            const opts = [
              ['hominideo', 'Hominídeo', 'humana · For 3 · Des 3 · Vig 3'],
              [
                'crinos',
                'Crinos',
                'lobisomem · For 7 · Des 4 · Vig 6 · Man 0 · Apa 0',
              ],
            ]
            const fill = () =>
              wrap.replaceChildren(
                h(
                  'div',
                  {
                    class: 'ds-radios',
                    role: 'radiogroup',
                    'aria-label': 'Forma',
                  },
                  opts.map(([id, l, hint]) =>
                    h(
                      'button',
                      {
                        type: 'button',
                        role: 'radio',
                        class: 'ds-radio ds-pressable',
                        'aria-checked': String(sel === id),
                        onclick: () => {
                          sel = id
                          fill()
                        },
                      },
                      h(
                        'span',
                        { class: 'ds-radio__text' },
                        h('span', { class: 'ds-radio__label', text: l }),
                        h('span', { class: 'ds-radio__hint', text: hint })
                      )
                    )
                  )
                )
              )
            fill()
            return wrap
          })()
        ),
        demo(
          'Tags, chips e identidade',
          'IdentityChip substitui LineageMark: accent + nome (+ iniciais no avatar). Tags para condições.',
          h(
            'div',
            { class: 'v-stack' },
            h(
              'div',
              { class: 'v-row' },
              h('span', {
                class: 'ds-avatar',
                'aria-hidden': 'true',
                text: initials('Helena Varga'),
              }),
              h('span', { class: 'ds-id-chip', text: 'Tremere' }),
              h('span', { class: 'ds-id-chip', text: 'Mago nv 5' })
            ),
            h(
              'div',
              { class: 'v-row' },
              h(
                'button',
                {
                  type: 'button',
                  class: 'ds-tag ds-pressable',
                  'aria-pressed': 'true',
                },
                'Envenenado'
              ),
              h(
                'button',
                {
                  type: 'button',
                  class: 'ds-tag ds-pressable',
                  'aria-pressed': 'false',
                },
                'Caído'
              ),
              h('span', { class: 'ds-tag', text: 'Ferimento grave' })
            ),
            h(
              'div',
              { class: 'v-row' },
              h(
                'button',
                {
                  type: 'button',
                  class: 'ds-chip ds-pressable',
                  'aria-current': 'true',
                },
                'Atributos'
              ),
              h(
                'button',
                { type: 'button', class: 'ds-chip ds-pressable' },
                'Habilidades'
              ),
              h(
                'button',
                {
                  type: 'button',
                  class: 'ds-chip ds-pressable',
                  'aria-pressed': 'true',
                },
                'Só com pontos'
              )
            )
          )
        ),
        demo(
          'Glifo de skin: lua do augúrio',
          'Só na skin WoD, no slot leading de uma linha. Contorno sempre visível (a lua nova não some), terminador em elipse.',
          h(
            'div',
            { class: 'v-row' },
            [0, 0.25, 0.5, 0.75, 1].map(p => moon(p, 36))
          )
        )
      )
  )

  block(
    'feedback',
    'Feedback e sobreposições',
    'Sheet com foco preso, Esc e voltar do Android fecham; aviso com Desfazer de 5 s em live region; confirmação só para o raro e destrutivo.',
    () =>
      h(
        'div',
        { class: 'v-grid' },
        demo(
          'Toast com Desfazer',
          null,
          h(
            'button',
            {
              type: 'button',
              class: 'ds-btn',
              onclick: () =>
                toast('Sangue 10 → 9', {
                  undo: () => toast('Desfeito: Sangue 9 → 10'),
                }),
            },
            'Mostrar aviso'
          )
        ),
        demo(
          'BottomSheet',
          null,
          h(
            'button',
            {
              type: 'button',
              class: 'ds-btn',
              onclick: () =>
                sheet({
                  title: 'Pontos de Sangue',
                  body: h(
                    'div',
                    {},
                    h(
                      'div',
                      { class: 'p-center' },
                      stepper({
                        label: 'Pontos de Sangue',
                        value: 9,
                        min: 0,
                        max: 15,
                      })
                    ),
                    h('p', {
                      class: 'ds-row__sub',
                      text: 'Gasto máximo por turno: 3.',
                    })
                  ),
                  footer: [
                    h(
                      'button',
                      { type: 'button', class: 'ds-btn' },
                      'Gastar 1'
                    ),
                    h(
                      'button',
                      { type: 'button', class: 'ds-btn ds-btn--primary' },
                      'Rolar dados'
                    ),
                  ],
                }),
            },
            'Abrir sheet'
          )
        ),
        demo(
          'ConfirmDialog',
          'Título com verbo e objeto; foco inicial em Cancelar; excluir exige digitar o nome.',
          h(
            'button',
            {
              type: 'button',
              class: 'ds-btn ds-btn--danger',
              onclick: () =>
                confirmDialog({
                  title: 'Excluir Helena Varga?',
                  text: 'A ficha e o histórico serão apagados para todos na crônica.',
                  confirmLabel: 'Excluir',
                  danger: true,
                  requireText: 'Helena Varga',
                  onConfirm: () => toast('Excluída (exemplo)'),
                }),
            },
            'Excluir personagem'
          )
        ),
        demo(
          'Banner',
          null,
          h(
            'div',
            { class: 'v-stack' },
            h(
              'div',
              { class: 'ds-banner', role: 'status' },
              icon('cloudOff'),
              h('div', {
                class: 'ds-banner__text',
                text: 'Sem conexão. 3 alterações serão enviadas quando a conexão voltar.',
              })
            ),
            h(
              'div',
              { class: 'ds-banner ds-banner--danger', role: 'alert' },
              icon('alert'),
              h('div', {
                class: 'ds-banner__text',
                text: 'Não foi possível salvar. Tentar de novo.',
              })
            )
          )
        ),
        demo(
          'SyncIndicator',
          'No header da ficha. Texto + forma do ponto, nunca só cor.',
          h(
            'div',
            { class: 'v-stack' },
            [
              ['saved', 'salvo'],
              ['saving', 'salvando'],
              ['offline', 'offline · 3 pendentes'],
              ['error', 'erro ao salvar'],
            ].map(([st, t]) =>
              h(
                'span',
                { class: 'ds-sync', 'data-state': st },
                h('span', { class: 'ds-sync__dot', 'aria-hidden': 'true' }),
                t
              )
            )
          )
        ),
        demo(
          'EmptyState e Skeleton',
          null,
          h(
            'div',
            { class: 'v-stack' },
            h(
              'div',
              { class: 'ds-empty', style: 'padding:16px' },
              h('p', { class: 'ds-empty__title', text: 'Nenhuma Disciplina' }),
              h('button', { type: 'button', class: 'ds-btn' }, 'Adicionar')
            ),
            h('div', { class: 'ds-skel', style: 'height:14px;width:80%' }),
            h('div', { class: 'ds-skel', style: 'height:14px;width:60%' })
          )
        ),
        demo(
          'TextField',
          'Rótulo visível, ajuda, contador e erro com ícone e texto.',
          h(
            'div',
            {},
            h(
              'label',
              { class: 'ds-field' },
              h('span', { class: 'ds-field__label', text: 'Conceito' }),
              h('input', { class: 'ds-input', value: 'Arquivista da Capela' }),
              h('span', {
                class: 'ds-field__help',
                text: '20 de 80 caracteres',
              })
            ),
            h(
              'label',
              { class: 'ds-field has-error' },
              h('span', { class: 'ds-field__label', text: 'Geração' }),
              h('input', {
                class: 'ds-input',
                value: '3',
                'aria-invalid': 'true',
                'aria-describedby': 'v-err',
              }),
              h(
                'span',
                { class: 'ds-field__error', id: 'v-err' },
                icon('alert', 'ds-icon ds-icon--sm'),
                'Entre 4 e 15.'
              )
            )
          )
        )
      )
  )

  // A demo do dock ocupa a linha inteira com largura de celular (390): num card de 260–340 px os
  // chips ficavam mais estreitos que no aparelho e o rótulo cortava.
  const phoneDemo = node => {
    node.style.gridColumn = '1 / -1'
    return node
  }
  block(
    'composicao',
    'Composição',
    'Peças de tela do esqueleto fixo do app. O que muda por sistema vem do template.',
    () =>
      h(
        'div',
        { class: 'v-grid' },
        phoneDemo(
          demo(
            'CombatDock',
            'Três chips com valor (do template) + Dados (ação). Toque abre o sheet; toque longo faz a ação padrão com Desfazer. Largura de celular (390).',
            h(
              'div',
              { class: 'v-phone', style: 'max-width:390px' },
              h(
                'section',
                { class: 'ds-dock', 'aria-label': 'Exemplo de dock' },
                h(
                  'div',
                  { class: 'ds-dock__handle', 'aria-hidden': 'true' },
                  'Todos os recursos'
                ),
                h(
                  'div',
                  { class: 'ds-dock__row' },
                  chip('Vitalidade', [
                    h(
                      'span',
                      { class: 'ds-minitrack', 'aria-hidden': 'true' },
                      Array.from({ length: 7 }, (_, i) =>
                        h('span', { class: i < 2 ? 'is-filled' : null })
                      )
                    ),
                    '−1',
                  ]),
                  chip('Sangue', '9/15'),
                  chip('FdV', '5/7'),
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'ds-dock-chip ds-dock-chip--action ds-pressable',
                    },
                    h('span', { class: 'ds-dock-chip__label', text: 'Dados' }),
                    h(
                      'span',
                      { class: 'ds-dock-chip__value' },
                      icon('dice', 'ds-icon ds-icon--sm'),
                      'd10'
                    )
                  )
                )
              )
            )
          )
        ),
        demo(
          'ListItem / CharacterCard',
          'Avatar com iniciais (segunda pista não cromática), IdentityChip, meta e valores do dock na visão do narrador.',
          h(
            'ul',
            { class: 'ds-list ds-card' },
            h(
              'li',
              {},
              h(
                'a',
                {
                  class: 'ds-list-item ds-pressable',
                  href: '../telas/ficha.html#c=helena',
                },
                h('span', {
                  class: 'ds-avatar',
                  'aria-hidden': 'true',
                  text: 'HV',
                }),
                h(
                  'span',
                  { class: 'ds-list-item__text' },
                  h('span', {
                    class: 'ds-list-item__title',
                    text: 'Helena Varga',
                  }),
                  h(
                    'span',
                    {},
                    h('span', { class: 'ds-id-chip', text: 'Tremere' })
                  ),
                  h(
                    'span',
                    { class: 'ds-list-item__chips' },
                    h(
                      'span',
                      { class: 'ds-mini' },
                      'Vitalidade ',
                      h('b', {}, 'Machucado −1')
                    ),
                    h(
                      'span',
                      { class: 'ds-mini' },
                      'Sangue ',
                      h('b', {}, '9/15')
                    )
                  )
                ),
                icon('chevronRight')
              )
            )
          )
        ),
        demo(
          'Section header',
          'display-lg da skin + régua em accent. Títulos de grupo em title (17), não em caixa alta de 12.',
          h(
            'div',
            {},
            h('h2', { class: 'ds-section__header', text: 'Atributos' }),
            h('h3', { class: 'ds-group-title', text: 'Físicos' })
          )
        )
      )
  )

  function row(label, subs, value, aria, inactive = false) {
    return h(
      'li',
      {},
      h(
        'button',
        {
          type: 'button',
          class: ['ds-row', 'ds-pressable', inactive && 'is-inactive'],
          'aria-label': aria,
        },
        h(
          'span',
          { class: 'ds-row__text' },
          h('span', { class: 'ds-row__label', text: label }),
          subs.map(s =>
            typeof s === 'string'
              ? h('span', { class: 'ds-row__sub', text: s })
              : s
          )
        ),
        h('span', { class: 'ds-row__value' }, value)
      )
    )
  }
  function num(t) {
    return h('span', { class: 'ds-row__num', text: t })
  }
  function cell(label, n, p) {
    return h(
      'button',
      {
        type: 'button',
        class: 'ds-cell ds-pressable',
        'aria-label': `${label}, ${n} de 5`,
      },
      h(
        'span',
        { class: 'ds-cell__top' },
        h('span', { class: 'ds-cell__label', text: label }),
        h('span', { class: 'ds-cell__num', text: n })
      ),
      p
    )
  }
  function bigCell(label, big, sub) {
    return h(
      'button',
      {
        type: 'button',
        class: 'ds-cell ds-pressable',
        'aria-label': `${label}, ${sub}, modificador ${big}`,
      },
      h(
        'span',
        { class: 'ds-cell__top' },
        h('span', { class: 'ds-cell__label', text: label })
      ),
      h('span', { class: 'ds-cell__big', text: big }),
      h('span', { class: 'ds-cell__sub', text: sub })
    )
  }
  function chip(label, value) {
    return h(
      'button',
      { type: 'button', class: 'ds-dock-chip ds-pressable' },
      h('span', { class: 'ds-dock-chip__label', text: label }),
      h('span', { class: 'ds-dock-chip__value' }, value)
    )
  }

  document
    .getElementById('nav')
    .append(
      ...blocks.map(b =>
        h('a', { class: 'ds-chip', href: `#${b.id}` }, b.title)
      ),
      h('a', { class: 'ds-chip', href: '../telas/index.html' }, 'Telas →')
    )

  function renderContent() {
    document
      .getElementById('content')
      .replaceChildren(...blocks.map(b => b.node()))
  }
  apply()
})()
