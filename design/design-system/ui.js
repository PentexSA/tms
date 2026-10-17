/*
 * TMS Grimório — construtores de componentes (referência de markup e acessibilidade).
 * Usado pela vitrine do design system e pelo protótipo das telas.
 *
 * Regra de segurança: todo texto entra no DOM por textContent / createTextNode. Nenhum dado
 * (template, ficha, nota) passa por innerHTML. Cores nunca vêm de string livre: o accent é
 * aplicado por data-accent="accent-N", e o CSS resolve o valor.
 */
;(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg'

  function h(tag, props, ...children) {
    const el = document.createElement(tag)
    applyProps(el, props)
    append(el, children)
    return el
  }

  function s(tag, attrs, ...children) {
    const el = document.createElementNS(SVG_NS, tag)
    for (const [k, v] of Object.entries(attrs ?? {}))
      if (v != null) el.setAttribute(k, String(v))
    append(el, children)
    return el
  }

  function applyProps(el, props) {
    if (!props) return
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue
      if (k === 'class')
        el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v
      else if (k === 'text') el.textContent = String(v)
      else if (/^on/i.test(k)) {
        // Handler só como função: string viraria código inline (XSS se um dia vier de dados).
        if (typeof v !== 'function')
          throw new TypeError(`h(): ${k} precisa ser função`)
        el.addEventListener(k.slice(2).toLowerCase(), v)
      } else if (
        k === 'srcdoc' ||
        (k === 'href' && /^\s*javascript:/i.test(String(v)))
      )
        throw new TypeError(`h(): ${k} proibido`)
      else if (k === 'vars')
        for (const [name, val] of Object.entries(v))
          el.style.setProperty(`--${name}`, String(Number(val)))
      else if (v === true) el.setAttribute(k, '')
      else el.setAttribute(k, String(v))
    }
  }

  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue
      el.append(c instanceof Node ? c : document.createTextNode(String(c)))
    }
  }

  // ---------- Ícones (genéricos, sem símbolos de sistema) ----------

  const ICONS = {
    back: ['M15 18l-6-6 6-6'],
    more: ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
    plus: ['M12 5v14', 'M5 12h14'],
    minus: ['M5 12h14'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    undo: ['M9 14L4 9l5-5', 'M4 9h11a5 5 0 010 10h-3'],
    dice: ['M12 2l9 7-9 13-9-13z', 'M3 9h18', 'M12 2v20'],
    search: ['M11 18a7 7 0 100-14 7 7 0 000 14z', 'M20 20l-4-4'],
    chevronDown: ['M6 9l6 6 6-6'],
    chevronUp: ['M18 15l-6-6-6 6'],
    chevronRight: ['M9 18l6-6-6-6'],
    edit: ['M4 20h4L19 9l-4-4L4 16z', 'M14 6l4 4'],
    history: ['M3 12a9 9 0 103-6.7', 'M3 4v5h5', 'M12 7v5l3 3'],
    check: ['M5 12l5 5L20 7'],
    alert: ['M12 3l10 18H2z', 'M12 10v4', 'M12 17h.01'],
    cloudOff: [
      'M3 3l18 18',
      'M7 18h10a4 4 0 001.6-7.7A6 6 0 008.3 7.5',
      'M5.5 9.6A4 4 0 007 18',
    ],
    swap: ['M7 7h13l-4-4', 'M17 17H4l4 4'],
    print: ['M6 9V3h12v6', 'M6 18H4v-7h16v7h-2', 'M6 14h12v7H6z'],
    archive: ['M3 4h18v4H3z', 'M5 8v12h14V8', 'M10 12h4'],
    trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
    theme: ['M12 3a9 9 0 100 18 7 7 0 010-18z'],
    users: [
      'M9 11a4 4 0 100-8 4 4 0 000 8z',
      'M2 21a7 7 0 0114 0',
      'M17 3a4 4 0 010 8',
      'M22 21a7 7 0 00-5-6.7',
    ],
    book: ['M4 4h7a3 3 0 013 3v13a2 2 0 00-2-2H4z', 'M20 4h-6', 'M20 4v14h-6'],
    user: ['M12 12a4 4 0 100-8 4 4 0 000 8z', 'M4 21a8 8 0 0116 0'],
    rest: ['M20 15A8 8 0 019 4a8 8 0 1011 11z'],
  }

  function icon(name, cls) {
    const paths = ICONS[name] ?? ICONS.more
    return s(
      'svg',
      {
        class: cls ?? 'ds-icon',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      paths.map(d => s('path', { d }))
    )
  }

  // ---------- Pips (só visuais) ----------
  // segments: [{ kind: 'on' | 'bonus' | 'lost' | 'off', n }]. O alvo de toque é a linha.

  function pips(segments, { small = false, max } = {}) {
    const wrap = h('span', {
      class: ['ds-pips', small && 'ds-pips--sm'],
      'aria-hidden': 'true',
    })
    let i = 0
    const total = max ?? segments.reduce((n, sg) => n + sg.n, 0)
    for (const sg of segments) {
      for (let k = 0; k < sg.n; k++) {
        if (total === 10 && i === 5)
          wrap.append(h('span', { class: 'ds-pips__gap' }))
        wrap.append(
          h('span', { class: ['ds-pip', sg.kind !== 'off' && `is-${sg.kind}`] })
        )
        i++
      }
    }
    return wrap
  }

  // ---------- Clock (N casas, até 2 preenchimentos opostos) ----------

  function clock({ segments, fills, size = 168, label }) {
    const r = size / 2
    const ring = size * 0.12
    const gapDeg = segments > 12 ? 3 : 4
    const svgEl = s('svg', {
      width: size,
      height: size,
      viewBox: `0 0 ${size} ${size}`,
      'aria-hidden': 'true',
      class: 'ds-clock',
    })
    const owner = []
    for (let i = 0; i < segments; i++) owner.push(null)
    for (const f of fills) {
      for (let k = 0; k < f.n; k++) {
        const idx = f.from === 'end' ? segments - 1 - k : k
        if (idx >= 0 && idx < segments) owner[idx] = f
      }
    }
    for (let i = 0; i < segments; i++) {
      const a0 = (-90 + (360 / segments) * i + gapDeg / 2) * (Math.PI / 180)
      const a1 =
        (-90 + (360 / segments) * (i + 1) - gapDeg / 2) * (Math.PI / 180)
      const ro = r - 2
      const ri = r - 2 - ring
      const p = [
        `M ${r + ro * Math.cos(a0)} ${r + ro * Math.sin(a0)}`,
        `A ${ro} ${ro} 0 0 1 ${r + ro * Math.cos(a1)} ${r + ro * Math.sin(a1)}`,
        `L ${r + ri * Math.cos(a1)} ${r + ri * Math.sin(a1)}`,
        `A ${ri} ${ri} 0 0 0 ${r + ri * Math.cos(a0)} ${r + ri * Math.sin(a0)}`,
        'Z',
      ].join(' ')
      const f = owner[i]
      const fill = !f
        ? 'transparent'
        : f.role === 'accent'
          ? 'var(--accent)'
          : `url(#hatch-${f.role})`
      const stroke = !f
        ? 'var(--border-control)'
        : f.role === 'accent'
          ? 'var(--accent)'
          : `var(--accent-${f.role})`
      svgEl.append(s('path', { d: p, fill, stroke, 'stroke-width': 1.5 }))
    }
    const defs = s('defs', {})
    for (const role of ['alt-cool', 'alt-warm']) {
      defs.append(
        s(
          'pattern',
          {
            id: `hatch-${role}`,
            width: 4,
            height: 4,
            patternUnits: 'userSpaceOnUse',
            patternTransform: 'rotate(45)',
          },
          s('rect', { width: 2, height: 4, fill: `var(--accent-${role})` })
        )
      )
    }
    svgEl.prepend(defs)
    const wrap = h('div', {
      class: 'ds-clock-wrap',
      role: 'img',
      'aria-label': label,
    })
    wrap.append(svgEl)
    return wrap
  }

  // ---------- Glifo de skin WoD: fase da lua (contorno + terminador em elipse) ----------

  function moon(phase, size = 28) {
    const r = size / 2 - 1.5
    const c = size / 2
    const el = s('svg', {
      class: 'ds-glyph-moon',
      width: size,
      height: size,
      viewBox: `0 0 ${size} ${size}`,
      'aria-hidden': 'true',
    })
    if (phase >= 1)
      el.append(
        s('circle', { cx: c, cy: c, r, fill: 'var(--accent-alt-warm)' })
      )
    else if (phase > 0) {
      const rx = Math.abs(1 - 2 * phase) * r
      const sweep = phase > 0.5 ? 1 : 0
      el.append(
        s('path', {
          d: `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} A ${rx} ${r} 0 0 ${sweep} ${c} ${c - r} Z`,
          fill: 'var(--accent-alt-warm)',
        })
      )
    }
    el.append(
      s('circle', {
        cx: c,
        cy: c,
        r,
        fill: 'none',
        stroke: 'var(--border-control)',
        'stroke-width': 1.5,
      })
    )
    return el
  }

  // ---------- Live regions ----------
  // Criadas no carregamento (e não junto com a primeira mensagem, que se perderia: o leitor de
  // tela só observa regiões que já existiam).

  const live = h('div', {
    class: 'sr-only',
    'aria-live': 'polite',
    role: 'status',
  })
  const toastRegion = h('div', { class: 'ds-toast-region' })
  const toastLive = h('div', {
    class: 'sr-only',
    'aria-live': 'polite',
    role: 'status',
  })
  document.body.append(live, toastRegion, toastLive)

  function announce(text) {
    live.textContent = ''
    setTimeout(() => {
      live.textContent = text
    }, 30)
  }

  // ---------- Toast com Desfazer (um por vez; pausa com foco ou ponteiro) ----------

  let toastTimer
  function toast(text, { undo, duration = 8000 } = {}) {
    clearTimeout(toastTimer)
    const opener = toastRegion.contains(document.activeElement)
      ? null
      : document.activeElement
    toastRegion.replaceChildren()
    toastLive.textContent = ''
    setTimeout(() => {
      toastLive.textContent = undo ? `${text}. Desfazer disponível.` : text
    }, 30)
    const node = h(
      'div',
      { class: 'ds-toast' },
      h('span', { class: 'ds-toast__text', text })
    )
    if (undo)
      node.append(
        h(
          'button',
          {
            type: 'button',
            class: 'ds-btn ds-btn--ghost',
            onclick: () => {
              close()
              undo()
            },
          },
          'Desfazer'
        )
      )
    // Tempo pausa enquanto o aviso tem foco ou ponteiro em cima (WCAG 2.2.1).
    const arm = () => {
      clearTimeout(toastTimer)
      toastTimer = setTimeout(close, duration)
    }
    node.addEventListener('focusin', () => clearTimeout(toastTimer))
    node.addEventListener('pointerenter', () => clearTimeout(toastTimer))
    node.addEventListener('focusout', arm)
    node.addEventListener('pointerleave', arm)
    // Se o foco estava no Desfazer, ele não pode cair no body quando o aviso some (por tempo ou
    // por uso): volta para o sheet aberto ou para onde estava antes do aviso.
    const close = () => {
      const hadFocus = toastRegion.contains(document.activeElement)
      clearTimeout(toastTimer)
      toastRegion.replaceChildren()
      toastLive.textContent = ''
      if (!hadFocus) return
      const top = stack[stack.length - 1]?.panel.querySelector(
        '.ds-sheet__title, .ds-dialog__title'
      )
      const target =
        top ?? (opener && document.contains(opener) ? opener : null)
      target?.focus({ preventScroll: true })
    }
    toastRegion.append(node)
    arm()
    return close
  }

  // Com sheet aberto, o resto da página fica inert (fora do Tab e do leitor de tela), exceto o
  // aviso com Desfazer e as live regions.
  function updateInert() {
    const top = stack[stack.length - 1]
    for (const child of document.body.children) {
      const keep =
        !top ||
        child === top.panel ||
        child === top.scrim ||
        child === toastRegion ||
        child === toastLive ||
        child === live ||
        child.tagName === 'SCRIPT'
      child.inert = !keep
    }
  }

  // ---------- Bottom sheet (diálogo modal com foco preso) ----------

  const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  const stack = []

  // O aviso com Desfazer fica fora do sheet, mas entra no ciclo do Tab enquanto estiver visível:
  // sem isso, quem usa teclado não alcança o Desfazer de uma alteração feita no sheet.
  function trapFocus(container, e) {
    if (e.key !== 'Tab') return
    const extra = toastRegion
      ? [...toastRegion.querySelectorAll(FOCUSABLE)]
      : []
    const items = [...container.querySelectorAll(FOCUSABLE), ...extra].filter(
      n => n.offsetParent !== null && n.tabIndex >= 0
    )
    if (!items.length) return
    const idx = items.indexOf(document.activeElement)
    const first = items[0]
    const last = items[items.length - 1]
    if (idx < 0) {
      e.preventDefault()
      ;(e.shiftKey ? last : first).focus()
    } else if (e.shiftKey && idx === 0) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && idx === items.length - 1) {
      e.preventDefault()
      first.focus()
    } else if (
      extra.includes(document.activeElement) ||
      extra.includes(items[idx + (e.shiftKey ? -1 : 1)])
    ) {
      e.preventDefault()
      items[idx + (e.shiftKey ? -1 : 1)].focus()
    }
  }

  function sheet({
    title,
    body,
    footer,
    onClose,
    kind = 'sheet',
    initialFocus,
  }) {
    const opener = document.activeElement
    // A tela pode ser refeita enquanto o sheet está aberto: o foco volta ao controle com a mesma
    // data-key, se o original saiu do DOM.
    const openerKey = opener?.closest?.('[data-key]')?.dataset.key
    const id = `sheet-${Math.random().toString(36).slice(2, 8)}`
    const scrim = h('div', {
      class: ['ds-scrim', kind === 'dialog' && 'ds-scrim--dialog'],
    })
    const panel = h('section', {
      class: kind === 'dialog' ? 'ds-dialog' : 'ds-sheet',
      role: kind === 'dialog' ? 'alertdialog' : 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': `${id}-t`,
    })
    const close = () => {
      scrim.remove()
      panel.remove()
      stack.splice(stack.indexOf(api), 1)
      updateInert()
      document.removeEventListener('keydown', onKey, true)
      onClose?.()
      const back =
        opener && document.contains(opener)
          ? opener
          : openerKey
            ? document.querySelector(`[data-key="${CSS.escape(openerKey)}"]`)
            : null
      back?.focus({ preventScroll: true })
    }
    const onKey = e => {
      if (stack[stack.length - 1] !== api) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
      trapFocus(panel, e)
    }
    if (kind === 'dialog') {
      body.id = body.id || `${id}-d`
      panel.setAttribute('aria-describedby', body.id)
      panel.append(
        h('h2', { class: 'ds-dialog__title', id: `${id}-t`, text: title }),
        body
      )
      if (footer)
        panel.append(h('div', { class: 'ds-dialog__actions' }, footer))
    } else {
      panel.append(
        h('div', { class: 'ds-sheet__grabber', 'aria-hidden': 'true' }),
        h(
          'header',
          { class: 'ds-sheet__head' },
          h('h2', {
            class: 'ds-sheet__title',
            id: `${id}-t`,
            tabindex: '-1',
            text: title,
          }),
          h(
            'button',
            {
              type: 'button',
              class: 'ds-icon-btn ds-pressable',
              'aria-label': 'Fechar',
              onclick: close,
            },
            icon('close')
          )
        ),
        h('div', { class: 'ds-sheet__body' }, body)
      )
      if (footer) panel.append(h('footer', { class: 'ds-sheet__foot' }, footer))
    }
    scrim.addEventListener('click', close)
    document.addEventListener('keydown', onKey, true)
    document.body.append(scrim, panel)
    const api = { close, panel, scrim }
    stack.push(api)
    updateInert()
    // Foco inicial no título: o leitor de tela anuncia o sheet e nenhum controle fica
    // "armado" por engano. Diálogos de confirmação passam initialFocus (Cancelar).
    requestAnimationFrame(() => {
      const target =
        initialFocus?.(panel) ??
        panel.querySelector('.ds-sheet__title') ??
        panel.querySelector(FOCUSABLE)
      target?.focus({ preventScroll: true })
    })
    return api
  }

  function confirmDialog({
    title,
    text,
    confirmLabel,
    danger = false,
    requireText,
    onConfirm,
  }) {
    const input = requireText
      ? h('input', {
          class: 'ds-input',
          type: 'text',
          autocomplete: 'off',
          'aria-label': `Digite ${requireText} para confirmar`,
        })
      : null
    const ok = h(
      'button',
      {
        type: 'button',
        class: ['ds-btn', danger ? 'ds-btn--danger' : 'ds-btn--primary'],
        'aria-disabled': requireText ? 'true' : null,
      },
      confirmLabel
    )
    const cancel = h('button', { type: 'button', class: 'ds-btn' }, 'Cancelar')
    const body = h(
      'div',
      {},
      h('p', { text }),
      input &&
        h(
          'label',
          { class: 'ds-field' },
          h('span', {
            class: 'ds-field__label',
            text: `Digite "${requireText}" para confirmar`,
          }),
          input
        )
    )
    const dlg = sheet({
      title,
      body,
      footer: [cancel, ok],
      kind: 'dialog',
      initialFocus: () => cancel,
    })
    cancel.addEventListener('click', dlg.close)
    input?.addEventListener('input', () =>
      ok.setAttribute(
        'aria-disabled',
        input.value.trim() === requireText ? 'false' : 'true'
      )
    )
    ok.addEventListener('click', () => {
      if (ok.getAttribute('aria-disabled') === 'true') return
      dlg.close()
      onConfirm()
    })
    return dlg
  }

  // ---------- Stepper / ValueEditor ----------
  // Grupo com dois botões reais e um spinbutton no meio (padrão APG). No RN equivale a um
  // controle accessibilityRole="adjustable" com ações increment/decrement.
  // Segurar −/+ repete só no visual e grava UMA alteração ao soltar ("Sangue 10 → 4"), para
  // não gerar um evento por passo nem esgotar o recurso se o botão for refeito durante o gesto.

  function stepper({
    label,
    value,
    min = 0,
    max = 99,
    step = 1,
    valueText,
    onChange,
    inline = false,
    allowInput = false,
    disabled = false,
    key,
  }) {
    // data-key estável permite devolver o foco ao mesmo controle quando a tela é refeita.
    const k = key ?? `st-${label}`
    let current = value
    const text = v => valueText?.(v) ?? `${v} de ${max}`
    const group = h('div', {
      class: ['ds-stepper', inline && 'ds-stepper--inline'],
      role: 'group',
      'aria-label': label,
    })
    const spin = h('div', {
      class: ['ds-stepper__value', allowInput && 'is-editable'],
      role: 'spinbutton',
      tabindex: disabled ? '-1' : '0',
      'data-key': k,
      'aria-label': label,
      'aria-valuemin': min,
      'aria-valuemax': max,
      'aria-valuenow': current,
      'aria-valuetext': text(current),
      'aria-disabled': disabled ? 'true' : null,
      'aria-description': allowInput ? 'Enter para digitar o valor' : null,
      text: String(current),
    })
    // Os botões ficam fora da ordem de Tab (o teclado usa as setas no spinbutton), mas são
    // botões reais: o leitor de tela por toque e o cursor virtual os alcançam pelo rótulo.
    const minus = h(
      'button',
      {
        type: 'button',
        class: 'ds-stepper__btn ds-pressable',
        tabindex: '-1',
        'aria-label': `Diminuir ${label}`,
        'data-key': `${k}-minus`,
      },
      icon('minus')
    )
    const plus = h(
      'button',
      {
        type: 'button',
        class: 'ds-stepper__btn ds-pressable',
        tabindex: '-1',
        'aria-label': `Aumentar ${label}`,
        'data-key': `${k}-plus`,
      },
      icon('plus')
    )
    const clamp = v => Math.max(min, Math.min(max, v))
    const preview = v => {
      current = clamp(v)
      spin.textContent = String(current)
      spin.setAttribute('aria-valuenow', current)
      spin.setAttribute('aria-valuetext', text(current))
      minus.disabled = disabled || current <= min
      plus.disabled = disabled || current >= max
    }
    const set = v => {
      const next = clamp(v)
      if (next === current || disabled) return
      preview(next)
      onChange?.(current)
    }
    preview(current)
    for (const [btn, d] of [
      [minus, -step],
      [plus, step],
    ]) {
      let held = false
      btn.addEventListener('pointerdown', () => {
        if (disabled) return
        const start = current
        held = false
        let repeat
        const timer = setTimeout(() => {
          held = true
          repeat = setInterval(
            () => (group.isConnected ? preview(current + d) : stop()),
            90
          )
        }, 400)
        const stop = () => {
          clearTimeout(timer)
          clearInterval(repeat)
          removeEventListener('pointerup', stop, true)
          removeEventListener('pointercancel', stop, true)
          if (held && current !== start) onChange?.(current)
        }
        addEventListener('pointerup', stop, true)
        addEventListener('pointercancel', stop, true)
      })
      // O clique que segue um "segurar" já foi gravado no pointerup: não soma mais um passo.
      btn.addEventListener('click', () => {
        if (held) {
          held = false
          return
        }
        set(current + d)
      })
    }
    const openInput = () => {
      const input = h('input', {
        class: 'ds-stepper__input',
        type: 'text',
        inputmode: 'numeric',
        pattern: '-?[0-9]*',
        value: String(current),
        'aria-label': label,
        'data-key': `${k}-input`,
      })
      spin.replaceWith(input)
      input.focus()
      input.select()
      let done = false
      const finish = apply => {
        if (done) return
        done = true
        const n = Number.parseInt(input.value, 10)
        input.replaceWith(spin)
        if (apply && Number.isFinite(n)) set(n)
        spin.focus({ preventScroll: true })
      }
      input.addEventListener('blur', () => finish(true))
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      })
    }
    spin.addEventListener('keydown', e => {
      const map = {
        ArrowUp: step,
        ArrowRight: step,
        ArrowDown: -step,
        ArrowLeft: -step,
        PageUp: step * 5,
        PageDown: -step * 5,
      }
      if (e.key in map) {
        e.preventDefault()
        set(current + map[e.key])
      }
      if (e.key === 'Home') {
        e.preventDefault()
        set(min)
      }
      if (e.key === 'End') {
        e.preventDefault()
        set(max)
      }
      if (e.key === 'Enter' && allowInput && !disabled) {
        e.preventDefault()
        openInput()
      }
    })
    // Tocar no valor abre o teclado numérico (inputmode numeric).
    if (allowInput)
      spin.addEventListener('click', () => {
        if (!disabled) openInput()
      })
    group.append(minus, spin, plus)
    group.setValue = v => preview(v)
    return group
  }

  // ---------- Iniciais (segunda pista não cromática da identidade) ----------

  function initials(name) {
    const parts = String(name ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    if (!parts.length) return '?'
    const first = parts[0][0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase()
  }

  window.TMSUI = {
    h,
    s,
    icon,
    pips,
    clock,
    moon,
    announce,
    toast,
    sheet,
    confirmDialog,
    stepper,
    initials,
  }
})()
