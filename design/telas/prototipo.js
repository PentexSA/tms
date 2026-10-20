/*
 * TMS — protótipo navegável das telas (design, não implementação).
 *
 * Um único renderizador monta a ficha de qualquer sistema a partir do template
 * (design/templates/*.json). Não existe código de tela por sistema: Vampiro, Mago, Lobisomem,
 * D&D 5e, Call of Cthulhu e Fate usam as mesmas funções. É o teste de aceitação da arquitetura
 * core + skin + dados (§3 da avaliação).
 *
 * Regras que o protótipo segue e a implementação deve manter:
 * - derivações, regras e modelos de rolagem por nome, de lista fechada (DERIVE, RULES, ROLLERS);
 *   nada é avaliado como código;
 * - texto do template e da ficha entra no DOM só como texto;
 * - rolagem com crypto.getRandomValues, nunca Math.random (na mesa, a rolagem é do servidor);
 * - o modo (Leitura, Jogo, Evoluir) é UX, não controle de acesso: o servidor valida cada escrita.
 */
;(() => {
  const {
    h,
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
  } = window.TMSUI
  const DATA = window.TMS_DATA
  const page = document.body.dataset.page
  const root = document.documentElement

  // ---------- Parâmetros, preferências e refluxo ----------

  const params = Object.fromEntries(new URLSearchParams(location.hash.slice(1)))

  function readStore(key) {
    try {
      return localStorage.getItem(`tms-proto:${key}`)
    } catch {
      return null
    }
  }
  function writeStore(key, value) {
    try {
      if (value == null) localStorage.removeItem(`tms-proto:${key}`)
      else localStorage.setItem(`tms-proto:${key}`, value)
    } catch {
      // Sem storage (aba privada, prévia): o protótipo funciona, só não lembra.
    }
  }
  function readJson(key) {
    try {
      return JSON.parse(readStore(key) ?? 'null')
    } catch {
      return null
    }
  }

  // Parâmetros de protótipo (a hash simula sessão e preferências). Tudo por allowlist.
  const THEMES = ['noite', 'pergaminho', 'sistema']
  // Navegação da ficha (estudo em design/estudos/navegacao-da-ficha.md):
  // "zones" (padrão): 3 abas fixas, uma por zona do template (Ficha | Poderes | Sobre);
  // "sections" e "scroll": variantes do estudo, mantidas só para teste com usuários.
  const layoutMode = ['scroll', 'sections'].includes(params.layout)
    ? params.layout
    : 'zones'
  const fontScale = Math.min(2, Math.max(1, Number(params.fs) || 1))
  const themeParam = [params.theme, readStore('theme')].find(t =>
    THEMES.includes(t)
  )
  root.dataset.theme = themeParam ?? 'noite'
  if ((params.plain ?? readStore('plain')) === '1')
    root.dataset.plainTitles = 'true'
  // Em %, não em px: respeita a fonte padrão que a pessoa configurou no navegador.
  root.style.fontSize = `${100 * fontScale}%`
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)')
  let reducedMotion = motionQuery.matches
  motionQuery.addEventListener?.('change', e => {
    reducedMotion = e.matches
  })
  // Mesma regra do app: refluxo por fontScale e largura medida, nunca pelo nome do sistema.
  const applyReflow = () =>
    root.classList.toggle('is-stacked', fontScale >= 1.3 || innerWidth < 360)
  applyReflow()
  addEventListener('resize', applyReflow)
  addEventListener('hashchange', () => location.reload())

  // ---------- Utilidades ----------

  const clone = v =>
    v === undefined ? undefined : JSON.parse(JSON.stringify(v))
  const MINUS = '−'
  const fmtSigned = n => (n > 0 ? `+${n}` : n < 0 ? `${MINUS}${-n}` : '+0')
  const saySigned = n => (n > 0 ? `mais ${n}` : n < 0 ? `menos ${-n}` : 'zero')
  const fmtPenalty = p =>
    p == null ? 'incapacitado' : p === 0 ? 'sem penalidade' : `${MINUS}${-p}`
  const fold = s =>
    String(s ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  const hhmm = iso =>
    new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  const ddmm = iso =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    })
  const userName = id => DATA.users.find(u => u.id === id)?.name ?? 'Alguém'
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
  const haptic = (pattern = 10) => navigator.vibrate?.(pattern)

  function uid() {
    const b = new Uint32Array(2)
    crypto.getRandomValues(b)
    return b[0].toString(36) + b[1].toString(36)
  }

  // Dado justo de N faces, sem viés de módulo. Sem crypto, bloqueia (fail secure).
  function die(sides) {
    if (!globalThis.crypto?.getRandomValues)
      throw new Error('crypto.getRandomValues indisponível: rolagem bloqueada')
    // Faces fora da faixa travariam o laço (limite 0) ou dariam NaN.
    if (!Number.isInteger(sides) || sides < 2 || sides > 1000)
      throw new RangeError(`dado de ${sides} faces fora da faixa`)
    const buf = new Uint32Array(1)
    const limit = Math.floor(0x100000000 / sides) * sides
    do crypto.getRandomValues(buf)
    while (buf[0] >= limit)
    return (buf[0] % sides) + 1
  }

  // ---------- Lista fechada de derivações (o template só referencia nomes) ----------

  const BLOOD = {
    4: [50, 10],
    5: [40, 8],
    6: [30, 6],
    7: [20, 4],
    8: [15, 3],
    9: [14, 2],
    10: [13, 1],
    11: [12, 1],
    12: [11, 1],
    13: [10, 1],
    14: [10, 1],
    15: [10, 1],
  }
  const DERIVE = {
    abilityModifier: score => Math.floor((score - 10) / 2),
    proficiencyBonus: level => 2 + Math.floor((Math.max(1, level) - 1) / 4),
    dnd5eCheckBonus: (score, prof, multiplier) =>
      Math.floor((score - 10) / 2) + prof * multiplier,
    vtmBloodPool: gen => (BLOOD[gen] ?? BLOOD[13])[0],
    vtmBloodPerTurn: gen => (BLOOD[gen] ?? BLOOD[13])[1],
    cocHitPoints: (con, siz) => Math.floor((con + siz) / 10),
    cocMagicPoints: pow => Math.floor(pow / 5),
    cocSanityMax: mythos => 99 - mythos,
    half: v => Math.floor(v / 2),
    fifth: v => Math.floor(v / 5),
    difference: (a, b = 0) => a - b,
  }
  function derive(name, ...args) {
    if (!Object.hasOwn(DERIVE, name))
      throw new Error(`derivação fora da lista fechada: ${name}`)
    return DERIVE[name](...args)
  }

  // ---------- Modelo da ficha (genérico, guiado pelo template) ----------

  function makeModel(character, role) {
    return {
      t: DATA.templates[character.system],
      character,
      role,
      chronicle: DATA.chronicles.find(c => c.id === character.chronicleId),
      state: {
        values: clone(character.sheet.values),
        specialties: clone(character.sheet.specialties ?? {}),
      },
      draft: null,
    }
  }

  const F = (m, id) => m.t.fields[id]
  const vals = m => m.draft?.values ?? m.state.values
  const specs = m => m.draft?.specialties ?? m.state.specialties
  const raw = (m, id) => vals(m)[id]
  const editableIn = f =>
    f.editableIn ??
    (['text', 'longText'].includes(f.type) ? ['play', 'edit'] : ['edit'])

  function stateOption(m, id) {
    const f = F(m, id)
    return f.options.find(o => o.id === raw(m, id)) ?? f.options[0]
  }

  function ratingInfo(m, id) {
    const f = F(m, id)
    const base = raw(m, id) ?? f.default ?? f.min ?? 0
    let modded = base
    let mod = null
    for (const [sid, sf] of Object.entries(m.t.fields)) {
      if (sf.type !== 'state') continue
      const opt = stateOption(m, sid)
      for (const x of opt.modifiers ?? []) {
        if (x.field !== id) continue
        modded = x.op === 'set' ? x.value : Math.max(0, modded + x.value)
        mod = { source: opt.label, op: x.op, value: x.value }
      }
    }
    const cap = f.cap ? numOf(m, f.cap.field) : null
    const eff = cap != null ? Math.min(modded, cap) : modded
    return {
      base,
      modded,
      eff,
      mod,
      cap,
      inactive: cap != null && modded > cap ? modded - cap : 0,
      max: f.max ?? 5,
    }
  }

  function numberValue(m, id) {
    const f = F(m, id)
    if (f.readOnly && f.derive)
      return derive(
        f.derive,
        ...[f.from]
          .flat()
          .filter(Boolean)
          .map(x => numOf(m, x))
      )
    return raw(m, id) ?? f.default ?? f.min ?? 0
  }

  function percentBase(m, id) {
    const b = F(m, id).base
    if (b == null) return 0
    if (typeof b === 'number') return b
    if (b.field) return numOf(m, b.field)
    return derive(b.derive, numOf(m, b.from))
  }
  const percentValue = (m, id) => raw(m, id) ?? percentBase(m, id)

  function resourceInfo(m, id) {
    const f = F(m, id)
    const v = raw(m, id) ?? {}
    let max = null
    if (typeof f.max === 'number') max = f.max
    else if (f.max?.derive)
      max = derive(f.max.derive, ...[f.max.from].flat().map(x => numOf(m, x)))
    else if (f.max?.field) max = numOf(m, f.max.field)
    else if (f.max?.stored) max = v.max ?? f.max.min
    const permanent = f.permanent ? (v.permanent ?? f.permanent.min) : null
    const capped = permanent != null && !f.tempUncapped
    const cap = capped ? permanent : f.overMax ? null : max
    const shownMax = capped ? permanent : max
    return {
      current: v.current ?? (f.tempUncapped ? 0 : (shownMax ?? 0)),
      max,
      permanent,
      cap,
      shownMax,
      temp: f.temp ? (v.temp ?? 0) : null,
      perTurn: f.perTurn
        ? derive(f.perTurn.derive, numOf(m, f.perTurn.from))
        : null,
    }
  }

  function numOf(m, id) {
    const f = F(m, id)
    switch (f.type) {
      case 'rating':
        return ratingInfo(m, id).eff
      case 'number':
        return numberValue(m, id)
      case 'percent':
        return percentValue(m, id)
      case 'resource': {
        const r = resourceInfo(m, id)
        return r.permanent ?? r.current
      }
      default:
        return 0
    }
  }

  function profBonus(m) {
    const id = Object.keys(m.t.fields).find(
      k => m.t.fields[k].derive === 'proficiencyBonus'
    )
    return id ? numberValue(m, id) : 0
  }

  function markInfo(m, id) {
    const f = F(m, id)
    const states = m.t.markStates[f.states]
    const state = states.find(x => x.id === raw(m, id)) ?? states[0]
    const bonus = f.bonus
      ? derive(
          f.bonus.derive,
          numOf(m, f.bonus.ability),
          profBonus(m),
          state.multiplier ?? 0
        )
      : null
    return { state, states, bonus }
  }

  // Trilha com empilhamento (wod-stacking): guarda contagens por tipo; o desenho ordena por gravidade.
  function healthInfo(m, id) {
    const f = F(m, id)
    const v = raw(m, id) ?? {}
    const counts = Object.fromEntries(f.types.map(ty => [ty.id, v[ty.id] ?? 0]))
    const boxes = f.types.flatMap(ty => Array(counts[ty.id]).fill(ty))
    const filled = Math.min(boxes.length, f.levels.length)
    const level = filled ? f.levels[filled - 1] : null
    return {
      f,
      counts,
      boxes: boxes.slice(0, f.levels.length),
      filled,
      level,
      penalty: level ? level.penalty : 0,
      status: level ? level.label : 'Sem ferimentos',
    }
  }

  const RULES = {
    // Dano novo ocupa a próxima caixa. Com a trilha cheia, o dano novo substitui a caixa menos
    // grave do que ele, e o tipo mais leve que transborda conta como o seguinte (contusivo vira
    // letal). Nunca cria dano mais grave que o recebido: contusivo numa trilha cheia de letal não
    // vira agravado. Curar remove do tipo escolhido. types vêm em ordem de gravidade.
    'wod-stacking': (f, counts, type, n, heal) => {
      const c = { ...counts }
      const order = f.types.map(t => t.id)
      const sev = Math.max(0, Math.min(order.indexOf(type), order.length - 2))
      for (let i = 0; i < n; i++) {
        if (heal) {
          c[type] = Math.max(0, c[type] - 1)
          continue
        }
        const total = order.reduce((s, k) => s + c[k], 0)
        if (total < f.levels.length) {
          c[type]++
          continue
        }
        let k = order.length - 1
        while (k > sev && c[order[k]] === 0) k--
        if (k > sev) {
          c[order[k]]--
          c[order[sev]]++
        }
      }
      return c
    },
    // Recursos acoplados num clock: com a roda cheia, o preenchimento do fim consome o do início.
    // Avança casa a casa: PageUp, End e o "segurar" do stepper pedem vários passos, e cada um respeita a roda.
    'mage-quint-paradox': (f, value, fillId, to) => {
      const next = { ...value }
      const start = f.fills.find(x => x.from === 'start')
      const end = f.fills.find(x => x.from === 'end')
      const cur = next[fillId] ?? 0
      if (to <= cur) {
        next[fillId] = Math.max(0, to)
        return { next, note: null }
      }
      let consumed = 0
      for (let n = cur; n < Math.min(f.segments, to); n++) {
        const used = f.fills.reduce((s, x) => s + (next[x.id] ?? 0), 0)
        if (used >= f.segments) {
          if (fillId !== end.id || (next[start.id] ?? 0) === 0) break
          next[start.id]--
          consumed++
        }
        next[fillId] = n + 1
      }
      if ((next[fillId] ?? 0) === cur)
        return {
          blocked: `A roda está cheia: as ${f.segments} casas estão ocupadas.`,
        }
      const gained = next[fillId] - cur
      return {
        next,
        note: consumed
          ? `${end.label} +${gained} consumiu ${consumed} de ${start.label}`
          : null,
      }
    },
    // D&D: dano consome primeiro os PV temporários.
    tempFirst: (r, amount) => {
      const temp = r.temp ?? 0
      const fromTemp = Math.min(temp, amount)
      return {
        temp: temp - fromTemp,
        current: Math.max(0, r.current - (amount - fromTemp)),
      }
    },
  }

  function boxesInfo(m, id) {
    const f = F(m, id)
    const v = raw(m, id) ?? {}
    const rows = f.rows.map(r => ({
      ...r,
      marks: v[r.id] ?? Array(r.boxes).fill(false),
    }))
    return {
      f,
      rows,
      marked: rows.reduce((s, r) => s + r.marks.filter(Boolean).length, 0),
      total: rows.reduce((s, r) => s + r.boxes, 0),
    }
  }

  function clockInfo(m, id) {
    const f = F(m, id)
    const v = raw(m, id) ?? {}
    const fills = f.fills.map(x => ({ ...x, n: v[x.id] ?? 0 }))
    const used = fills.reduce((s, x) => s + x.n, 0)
    return { f, fills, used, free: f.segments - used }
  }

  function slotsInfo(m, id) {
    const f = F(m, id)
    const v = raw(m, id) ?? {}
    const levels = []
    for (let n = 1; n <= f.levels; n++) {
      const s = v[n]
      if (s?.max)
        levels.push({
          n,
          label: f.levelLabel.replace('{n}', n),
          max: s.max,
          used: s.used ?? 0,
        })
    }
    return { f, levels }
  }

  function listItems(m, id) {
    const f = F(m, id)
    const v = raw(m, id) ?? []
    if (f.fixed)
      return f.fixed.map(fx => {
        const it = v.find(x => x.id === fx.id) ?? {}
        return { ...it, ...fx, text: it.text ?? '' }
      })
    return v
  }

  function accentOf(m) {
    const a = m.t.accent ?? {}
    const v = a.from ? raw(m, a.from) : null
    return (v && a.map?.[v]) || a.fallback || 'accent-neutral'
  }

  function plainText(m, id) {
    const f = F(m, id)
    switch (f.type) {
      case 'choice':
        return f.options.find(o => o.id === raw(m, id))?.label ?? ''
      case 'number':
        return `${numberValue(m, id)}${f.suffix ?? ''}`
      case 'rating': {
        const i = ratingInfo(m, id)
        const vl = f.valueLabels?.[i.eff]
        return `${f.label} ${i.eff}${vl ? ` · ${vl}` : ''}`
      }
      case 'state':
        return stateOption(m, id).label
      default:
        return String(raw(m, id) ?? '')
    }
  }

  function chipText(m) {
    const idn = m.t.identity
    if (idn.chipFormat)
      return idn.chipFormat.replace(/\{([a-zA-Z0-9]+)\}/g, (_, k) =>
        plainText(m, k)
      )
    return plainText(m, idn.chip)
  }

  function summaryText(m) {
    const idn = m.t.identity
    const text = (idn.summary ?? [])
      .filter(k => k !== idn.chip)
      .map(k => plainText(m, k))
      .filter(Boolean)
      .join(' · ')
    return text || chipText(m)
  }

  const nameOf = m => raw(m, m.t.identity.name) || 'Sem nome'

  function ratingSegments(i) {
    if (i.inactive)
      return [
        { kind: 'on', n: i.eff },
        { kind: 'off', n: Math.max(0, i.max - i.eff) },
      ]
    if (i.mod && i.eff > i.base)
      return [
        { kind: 'on', n: i.base },
        { kind: 'bonus', n: i.eff - i.base },
        { kind: 'off', n: Math.max(0, i.max - i.eff) },
      ]
    if (i.eff < i.base)
      return [
        { kind: 'on', n: i.eff },
        { kind: 'lost', n: i.base - i.eff },
        { kind: 'off', n: Math.max(0, i.max - i.base) },
      ]
    return [
      { kind: 'on', n: i.eff },
      { kind: 'off', n: Math.max(0, i.max - i.eff) },
    ]
  }

  function modText(i) {
    if (!i.mod) return null
    if (i.mod.op === 'set')
      return `${i.mod.value} na forma ${i.mod.source} (base ${i.base})`
    // Mostra o modificador declarado (ex.: −3), mesmo quando o resultado é limitado em 0.
    const d = i.mod.value
    if (!d) return null
    return `${i.base} ${d > 0 ? '+' : MINUS} ${Math.abs(d)} da forma ${i.mod.source} = ${i.modded}`
  }

  function capText(m, id, i) {
    if (!i.inactive) return null
    const f = F(m, id)
    return `${i.inactive} inativo · ${f.cap.label ?? 'acima do teto'} (${i.cap})`
  }

  // Gramática de anúncio por tipo (C-03): os nomes vêm do template, o app só monta a frase.
  function describe(m, id) {
    const f = F(m, id)
    const spec = specs(m)[id]
    switch (f.type) {
      case 'rating': {
        const i = ratingInfo(m, id)
        // Acima do máximo (forma Crinos: Força 7 numa escala de 5) não se diz "7 de 5".
        const parts = [
          i.eff > i.max
            ? `${f.label}, ${i.eff}`
            : `${f.label}, ${i.eff} de ${i.max}`,
        ]
        if (f.valueLabels?.[i.eff]) parts.push(f.valueLabels[i.eff])
        if (i.mod && i.modded !== i.base)
          parts.push(
            i.mod.op === 'set'
              ? `${i.mod.value} na forma ${i.mod.source}, base ${i.base}`
              : `base ${i.base} ${i.modded > i.base ? 'mais' : 'menos'} ${Math.abs(i.modded - i.base)} da forma ${i.mod.source}`
          )
        if (i.inactive)
          parts.push(
            `${i.inactive} inativo, ${f.cap.label ?? 'acima do teto'} ${i.cap}`
          )
        if (spec) parts.push(`especialização ${spec}`)
        return parts.join(', ')
      }
      case 'number': {
        const v = numberValue(m, id)
        if (f.display === 'score+mod')
          return `${f.label}, ${v}, modificador ${saySigned(derive(f.derive, v))}`
        if (f.display === 'signed') return `${f.label}, ${saySigned(v)}`
        if (f.display === 'ladder')
          return `${f.label}, ${m.t.ladders[f.ladder][v] ?? ''}, ${saySigned(v)}`
        return `${f.label}, ${v}${f.suffix ?? ''}`
      }
      case 'percent': {
        const v = percentValue(m, id)
        return `${f.label}, ${v} por cento; difícil ${derive('half', v)}; extremo ${derive('fifth', v)}`
      }
      case 'mark': {
        const k = markInfo(m, id)
        return `${f.label}, ${k.state.label.toLowerCase()}${k.bonus != null ? `, ${saySigned(k.bonus)}` : ''}`
      }
      case 'resource': {
        const r = resourceInfo(m, id)
        if (f.tempUncapped)
          return `${f.label}: permanente ${r.permanent}, temporário ${r.current}`
        let s = `${f.label}, ${r.current}${r.shownMax != null ? ` de ${r.shownMax}` : ''}`
        if (r.temp) s += `, mais ${r.temp} temporários`
        if (r.permanent != null) s += `, permanente ${r.permanent}`
        return s
      }
      case 'track': {
        if (f.rule === 'wod-stacking') {
          const hi = healthInfo(m, id)
          const dmg = hi.f.types
            .filter(ty => hi.counts[ty.id])
            .map(ty => `${hi.counts[ty.id]} ${ty.label.toLowerCase()}`)
          return `${f.label}: ${hi.status}${hi.level ? `, penalidade ${hi.penalty == null ? 'incapacitado' : saySigned(hi.penalty)}` : ''}; ${dmg.length ? dmg.join(', ') : 'sem dano'}`
        }
        const b = boxesInfo(m, id)
        return `${f.label}: ${b.rows.map(r => `${r.label} ${r.marks.filter(Boolean).length} de ${r.boxes} marcadas`).join('; ')}`
      }
      case 'clock': {
        const c = clockInfo(m, id)
        return `${c.fills.map(x => `${x.label} ${x.n}`).join(', ')}, de ${c.f.segments} casas`
      }
      case 'state':
        return `${f.label}: ${stateOption(m, id).label}`
      case 'slots': {
        const s = slotsInfo(m, id)
        return `${f.label}: ${s.levels.map(l => `${l.label} nível, ${l.max - l.used} de ${l.max} disponíveis`).join('; ') || 'nenhum'}`
      }
      case 'tags': {
        const sel = (raw(m, id) ?? [])
          .map(x => f.options.find(o => o.id === x)?.label)
          .filter(Boolean)
        return `${f.label}: ${sel.length ? sel.join(', ') : 'nenhuma'}`
      }
      case 'list': {
        const items = listItems(m, id)
        if (f.fixed)
          return `${f.label}: ${items.filter(x => x.text).length} de ${items.length} preenchidas`
        return `${f.label}: ${plural(items.length, 'item', 'itens')}`
      }
      case 'text':
        return f.aspect
          ? `Aspecto, ${f.label}: ${raw(m, id) || 'vazio'}`
          : `${f.label}: ${raw(m, id) || 'vazio'}`
      default:
        return `${f.label}: ${plainText(m, id) || 'vazio'}`
    }
  }

  // Nome acessível começa pelo texto visível (WCAG 2.5.3): quem usa controle por voz diz "FdV"
  // ou "FOR", que é o que está na tela, e o leitor de tela ainda ouve o nome completo.
  function withVisibleLabel(visible, full, description) {
    return visible && visible !== full
      ? `${visible}, ${description}`
      : description
  }

  function resourceText(m, id) {
    const f = F(m, id)
    const r = resourceInfo(m, id)
    if (f.tempUncapped)
      return `Permanente ${r.permanent} · Temporário ${r.current}`
    const main =
      r.shownMax != null ? `${r.current}/${r.shownMax}` : String(r.current)
    return r.temp ? `${main} +${r.temp}` : main
  }

  // Texto curto do valor, usado no dock, no painel da mesa e na lista "Todos os recursos".
  function shortValue(m, id) {
    const f = F(m, id)
    switch (f.type) {
      case 'track': {
        if (f.rule === 'wod-stacking') {
          const hi = healthInfo(m, id)
          return hi.level
            ? `${hi.status} ${fmtPenalty(hi.penalty)}`
            : 'Sem ferimentos'
        }
        const b = boxesInfo(m, id)
        return `${b.marked}/${b.total}`
      }
      case 'resource':
        return resourceText(m, id)
      case 'clock':
        return clockInfo(m, id)
          .fills.map(x => `${x.label} ${x.n}`)
          .join(' · ')
      case 'state':
        return stateOption(m, id).label
      case 'number':
        return plainText(m, id)
      case 'rating':
        return String(ratingInfo(m, id).eff)
      case 'slots': {
        const lv =
          slotsInfo(m, id).levels.find(l => l.used < l.max) ??
          slotsInfo(m, id).levels[0]
        return lv ? `${lv.label} ${lv.max - lv.used}/${lv.max}` : '—'
      }
      case 'list': {
        const items = listItems(m, id)
        return f.fixed
          ? `${items.filter(x => x.text).length}/${items.length}`
          : String(items.length)
      }
      case 'tags': {
        const n = (raw(m, id) ?? []).length
        return n ? String(n) : 'nenhuma'
      }
      default:
        return plainText(m, id)
    }
  }

  function miniTrack(m, id) {
    const hi = healthInfo(m, id)
    return h(
      'span',
      { class: 'ds-minitrack', 'aria-hidden': 'true' },
      hi.f.levels.map((_, i) =>
        h('span', {
          class: hi.boxes[i]
            ? hi.boxes[i].id === hi.f.types[0].id
              ? 'is-agg'
              : 'is-filled'
            : null,
        })
      )
    )
  }

  // Valor visual do dock: mantém a forma do recurso (trilha, caixas, roda), não só o número.
  function dockValue(m, id) {
    const f = F(m, id)
    if (f.type === 'track' && f.rule === 'wod-stacking') {
      // Forma curta (o chip tem ~70 px): "0", "−2", "Incap."; a frase completa está no aria-label.
      const hi = healthInfo(m, id)
      const pen =
        !hi.level || hi.penalty === 0
          ? '0'
          : hi.penalty == null
            ? 'Incap.'
            : fmtPenalty(hi.penalty)
      return [miniTrack(m, id), h('span', {}, pen)]
    }
    if (f.type === 'clock') {
      // Cada preenchimento com amostra própria (cheia ou hachurada): forma + cor, nunca só cor.
      const c = clockInfo(m, id)
      return c.fills.flatMap(x => [
        h('span', {
          class: ['p-swatch', x.colorRole !== 'accent' && `is-${x.colorRole}`],
          'aria-hidden': 'true',
        }),
        String(x.n),
      ])
    }
    return shortValue(m, id)
  }

  // ---------- Permissões (UX; o servidor é a autoridade, com fail secure) ----------

  function sectionOf(m, id) {
    return m.t.sections.find(
      s =>
        (s.fields ?? []).includes(id) ||
        (s.groups ?? []).some(g => g.fields.includes(id))
    )
  }
  function canReadSection(m, sec) {
    return !sec.permissions?.read || sec.permissions.read.includes(m.role)
  }
  function canWriteField(m, id) {
    if (!['owner', 'storyteller'].includes(m.role)) return false
    const sec = sectionOf(m, id)
    return !sec?.permissions?.write || sec.permissions.write.includes(m.role)
  }

  // =====================================================================
  // Página: ficha
  // =====================================================================

  const S = { refreshers: new Set() }

  function canEdit(id) {
    if (S.archived || S.mode === 'read') return false
    if (!canWriteField(S.m, id)) return false
    return S.mode === 'evolve' || editableIn(F(S.m, id)).includes('play')
  }

  // Campos de seções que quem está vendo não pode ler (ex.: notas do narrador) não vão para o
  // armazenamento do aparelho. Na implementação, nem chegam ao cliente.
  function readableValues(m, values) {
    return Object.fromEntries(
      Object.entries(values).filter(([id]) => {
        const sec = sectionOf(m, id)
        return !sec || canReadSection(m, sec)
      })
    )
  }

  function persist() {
    if (S.demoState) return
    writeStore(
      `sheet:${S.m.character.id}`,
      JSON.stringify({
        values: readableValues(S.m, S.m.state.values),
        specialties: S.m.state.specialties,
        history: S.history.slice(0, 50),
      })
    )
  }

  // O que volta do localStorage é dado não confiável: passa pelo mesmo validador do servidor
  // (telas/validate.js) e é descartado inteiro se tiver qualquer erro (fail secure).
  function restoreSaved(m, saved) {
    if (
      !saved ||
      typeof saved !== 'object' ||
      !saved.values ||
      typeof saved.values !== 'object'
    )
      return false
    const merged = {
      values: { ...m.state.values, ...saved.values },
      specialties: saved.specialties ?? {},
    }
    const errors = window.TMSValidate
      ? window.TMSValidate.validateSheet(m.t, merged, 'local')
      : ['validador ausente']
    if (errors.length) {
      writeStore(`sheet:${m.character.id}`, null)
      return false
    }
    m.state.values = merged.values
    m.state.specialties = merged.specialties
    return true
  }
  function saveUi() {
    writeStore(`ui:${S.m.character.id}`, JSON.stringify(S.ui))
  }

  function changeLabel(id, from, to) {
    const m = S.m
    const f = F(m, id)
    const name = f.shortLabel ?? f.label
    switch (f.type) {
      case 'resource': {
        if (
          from?.permanent != null &&
          to?.permanent != null &&
          from.permanent !== to.permanent
        )
          return `${f.label} permanente ${from.permanent} → ${to.permanent}`
        if (
          (from?.temp ?? 0) !== (to?.temp ?? 0) &&
          from?.current === to?.current
        )
          return `${name} temporários ${from?.temp ?? 0} → ${to?.temp ?? 0}`
        if (from?.max != null && to?.max != null && from.max !== to.max)
          return `${name} máximo ${from.max} → ${to.max}`
        return `${name} ${from?.current ?? '—'} → ${to?.current ?? '—'}`
      }
      case 'track':
        return `${f.label}: ${shortValue(m, id)}`
      case 'clock':
        return `${f.label}: ${shortValue(m, id)}`
      case 'state':
        return `${f.label}: ${stateOption(m, id).label}`
      case 'slots':
        return `${f.label}: ${shortValue(m, id)}`
      case 'tags':
        return `${f.label}: ${(raw(m, id) ?? []).map(x => f.options.find(o => o.id === x)?.label).join(', ') || 'nenhuma'}`
      case 'list':
        return `${f.label} atualizados`
      case 'text':
      case 'longText':
        return `${f.label} atualizado`
      case 'mark':
        return `${f.label}: ${markInfo(m, id).state.label}`
      default:
        return `${f.label} ${typeof from === 'object' ? '' : (from ?? '—')} → ${typeof to === 'object' ? '' : to}`
    }
  }

  // Toda alteração vira evento { campo, de, para, quando, quem } (local-first, fila de sincronização).
  function commit(changes, { label, undoable = true, quiet = false } = {}) {
    const m = S.m
    const ev = {
      id: uid(),
      at: new Date().toISOString(),
      by: S.viewerId,
      byRole: m.role,
      changes: changes.map(c => ({
        id: c.id,
        from: clone(m.state.values[c.id]),
        to: clone(c.to),
      })),
    }
    for (const c of ev.changes) m.state.values[c.id] = clone(c.to)
    ev.label =
      label ?? changeLabel(changes[0].id, ev.changes[0].from, ev.changes[0].to)
    S.history.unshift(ev)
    persist()
    syncTick()
    render()
    if (!quiet) {
      if (undoable) {
        S.lastUndoable = ev
        toast(ev.label, { undo: () => undoEvent(ev) })
      } else announce(ev.label)
    }
    haptic()
    return ev
  }

  // Ctrl/Cmd+Z desfaz a última alteração em jogo, de qualquer lugar (inclusive com o aviso já
  // fechado): o Desfazer não depende de alcançar o toast. Campos de texto mantêm o desfazer nativo.
  addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z')
      return
    if (e.target.closest?.('input, textarea, [contenteditable]')) return
    if (!S.lastUndoable) return
    e.preventDefault()
    const ev = S.lastUndoable
    S.lastUndoable = null
    undoEvent(ev)
  })

  function undoEvent(ev) {
    if (S.lastUndoable === ev) S.lastUndoable = null
    commit(
      ev.changes.map(c => ({ id: c.id, to: c.from })),
      { label: `Desfeito: ${ev.label}`, undoable: false }
    )
  }

  function syncTick() {
    if (S.offline) {
      S.pending++
      S.sync = 'offline'
      return
    }
    S.sync = 'saving'
    clearTimeout(S.syncTimer)
    S.syncTimer = setTimeout(() => {
      S.sync = 'saved'
      renderSync()
    }, 700)
  }

  function renderSync() {
    const el = document.querySelector('.ds-sync')
    if (!el) return
    const hadFocus = el === document.activeElement
    const next = syncButton()
    el.replaceWith(next)
    if (hadFocus) next.focus({ preventScroll: true })
  }

  function syncButton() {
    // ds-sync__label: palavras que o celular estreito recolhe (fica o ponto e, offline, o número);
    // "erro ao salvar" nunca recolhe. O texto completo está sempre no aria-label.
    const label = text => h('span', { class: 'ds-sync__label', text })
    const map = {
      saved: [label('salvo'), 'Todas as alterações foram salvas.'],
      saving: [label('salvando'), 'Salvando alterações.'],
      offline: [
        [
          label('offline · '),
          String(S.pending),
          label(` ${S.pending === 1 ? 'pendente' : 'pendentes'}`),
        ],
        `Sem conexão. ${plural(S.pending, 'alteração será enviada', 'alterações serão enviadas')} quando a conexão voltar.`,
      ],
      error: [
        'erro ao salvar',
        'Não foi possível salvar. Toque para tentar de novo.',
      ],
    }
    const [text, long] = map[S.sync]
    return h(
      'button',
      {
        type: 'button',
        class: 'ds-sync ds-pressable',
        'data-state': S.sync,
        'data-key': 'sync',
        'aria-label': long,
        onclick: openSyncSheet,
      },
      h('span', { class: 'ds-sync__dot', 'aria-hidden': 'true' }),
      h('span', {}, text)
    )
  }

  // ---------- Inicialização ----------

  function initFicha() {
    const character =
      DATA.characters.find(c => c.id === params.c) ?? DATA.characters[0]
    const role = ['owner', 'player', 'storyteller'].includes(params.as)
      ? params.as
      : 'owner'
    S.m = makeModel(character, role)
    const chronicle = S.m.chronicle
    S.viewerId =
      role === 'owner'
        ? character.ownerId
        : role === 'storyteller'
          ? chronicle.storytellerId
          : DATA.users.find(
              u =>
                u.id !== character.ownerId && u.id !== chronicle.storytellerId
            )?.id
    S.history = []
    S.rolls = []
    S.demoState = params.state ?? null
    S.ui = {
      filters: {},
      search: {},
      identityOpen: false,
      lastRoll: null,
      scrollY: 0,
      ...(readJson(`ui:${character.id}`) ?? {}),
    }

    const saved = !S.demoState && readJson(`sheet:${character.id}`)
    if (restoreSaved(S.m, saved)) {
      // Histórico: só entradas com o formato esperado (texto vira textContent na tela).
      S.history = (Array.isArray(saved.history) ? saved.history : [])
        .filter(
          ev =>
            ev &&
            typeof ev.label === 'string' &&
            typeof ev.at === 'string' &&
            Array.isArray(ev.changes)
        )
        .slice(0, 50)
    }

    S.archived =
      S.demoState === 'archived' ||
      readStore(`archived:${character.id}`) === '1'
    S.offline = S.demoState === 'offline'
    S.pending = S.offline ? 3 : 0
    S.sync = S.offline ? 'offline' : 'saved'
    S.mode = role === 'owner' && !S.archived ? 'play' : 'read'
    if (
      params.mode === 'evolve' &&
      canWriteField(S.m, S.m.t.identity.name) &&
      !S.archived
    )
      enterEvolve(null, true)

    if (S.demoState === 'empty') {
      const keep = new Set(
        [S.m.t.identity.name, S.m.t.identity.chip, S.m.t.accent?.from].filter(
          Boolean
        )
      )
      S.m.state.values = Object.fromEntries(
        Object.entries(S.m.state.values).filter(([k]) => keep.has(k))
      )
      S.m.state.specialties = {}
    }
    if (S.demoState === 'conflict') {
      const track = Object.keys(S.m.t.fields).find(
        k => S.m.t.fields[k].type === 'track'
      )
      if (track)
        S.history.unshift({
          id: uid(),
          at: new Date().toISOString(),
          by: chronicle.storytellerId,
          byRole: 'storyteller',
          label: `${F(S.m, track).label} alterada pelo narrador`,
          changes: [],
        })
    }

    document.body.dataset.skin = S.m.t.skin
    document.body.dataset.accent = accentOf(S.m)
    document.title = `${nameOf(S.m)} · ficha · TMS (protótipo)`
    render()
    setupScroll()
    addEventListener('resize', () => {
      syncChipEcho()
      syncSizes()
    })
    document.fonts?.ready.then(() => {
      syncChipEcho()
      syncSizes()
    })
    if (!S.demoState && S.ui.scrollY)
      requestAnimationFrame(() => scrollTo(0, S.ui.scrollY))
  }

  // ---------- Renderização ----------

  function render() {
    const app = document.getElementById('app')
    const active = document.activeElement
    const hadFocus = app.contains(active)
    const focusKey = hadFocus ? active.closest('[data-key]')?.dataset.key : null
    const y = scrollY
    // O header refeito mantém o estado recolhido (senão a página pula 44 px a cada alteração).
    const collapsed = document
      .querySelector('.ds-header')
      ?.classList.contains('is-collapsed')
    document.body.dataset.accent = accentOf(S.m)
    app.replaceChildren(...buildFicha().filter(Boolean))
    if (collapsed)
      document.querySelector('.ds-header')?.classList.add('is-collapsed')
    if (focusKey)
      app
        .querySelector(`[data-key="${CSS.escape(focusKey)}"]`)
        ?.focus({ preventScroll: true })
    // O controle focado sumiu (Concluir, Restaurar...): o foco vai para o início da ficha, não para o body.
    if (hadFocus && !app.contains(document.activeElement))
      document.getElementById('main')?.focus({ preventScroll: true })
    scrollTo(0, y)
    for (const fn of S.refreshers) fn()
    observeSections()
    syncChipEcho()
    syncSizes()
  }

  // Alturas reais (crescem com a fonte): o fim da ficha e o aviso com Desfazer ficam acima do
  // dock; o painel "Em jogo" e o destino dos chips de seção ficam abaixo do header inteiro
  // (somado pelos filhos, para valer também com os chips recolhidos).
  // As variáveis vão no <html>, que é o elemento com scroll: o scroll-padding usa as mesmas medidas
  // para que o controle focado por Tab nunca fique escondido sob o header ou o dock (WCAG 2.4.11).
  function syncSizes() {
    const dock = document.querySelector('.ds-dock')
    if (dock)
      root.style.setProperty('--dock-measured', `${dock.offsetHeight}px`)
    const header = document.querySelector('.ds-header')
    if (header)
      root.style.setProperty(
        '--header-measured',
        `${[...header.children].reduce((s, c) => s + c.offsetHeight, 0)}px`
      )
  }

  // O texto do chip (clã, tradição, classe) não pode sumir: se o header o esconde (fonte grande)
  // ou corta (tela estreita), ele aparece no resumo da identidade. Regra por medida, não por sistema.
  function syncChipEcho() {
    const chip = document.querySelector('.ds-header .ds-id-chip')
    const echo = document.querySelector('.p-chip-echo')
    if (!chip || !echo) return
    echo.hidden = !(
      chip.offsetParent === null || chip.scrollWidth > chip.clientWidth + 1
    )
  }

  function buildFicha() {
    const st = S.demoState
    if (st === 'loading') return [skeletonPage()]
    if (st === 'error')
      return [
        stateHeader(),
        h(
          'main',
          { id: 'main', class: 'p-state' },
          h(
            'div',
            { class: 'ds-banner ds-banner--danger', role: 'alert' },
            icon('alert'),
            h(
              'div',
              { class: 'ds-banner__text' },
              h('strong', {}, 'Não foi possível carregar a ficha. '),
              'Verifique a conexão e tente de novo. As alterações feitas offline continuam guardadas no aparelho.'
            )
          ),
          h(
            'div',
            { class: 'p-page-actions' },
            h(
              'button',
              {
                type: 'button',
                class: 'ds-btn ds-btn--primary',
                onclick: () => {
                  S.demoState = null
                  render()
                },
              },
              'Tentar de novo'
            )
          )
        ),
      ]
    if (st === 'forbidden' || S.deleted) {
      return [
        stateHeader(),
        h(
          'main',
          { id: 'main', class: 'ds-empty' },
          icon('user'),
          h('h1', {
            class: 'ds-empty__title',
            text: S.deleted
              ? 'Ficha excluída'
              : 'Você não tem acesso a esta ficha',
          }),
          h('p', {
            text: S.deleted
              ? 'A ficha foi removida da crônica.'
              : 'Peça ao narrador da crônica para compartilhar a ficha com você.',
          }),
          h(
            'a',
            { class: 'ds-btn', href: backHref() },
            `Voltar para ${S.m.chronicle.name}`
          )
        ),
      ]
    }
    return [
      h('a', { class: 'sr-only p-skip', href: '#main' }, 'Pular para a ficha'),
      buildHeader(),
      buildModebar(),
      buildDock(),
      h(
        'main',
        { id: 'main', class: 'p-main', tabindex: '-1' },
        buildPlayPanel(),
        h(
          'div',
          { class: 'p-content' },
          buildBanners(),
          buildIdentity(),
          buildPinned(),
          buildSections()
        )
      ),
    ]
  }

  function backHref() {
    const role = S.m.role === 'storyteller' ? 'storyteller' : 'player'
    return `mesa.html#${hashOf({ ch: S.m.chronicle.id, as: role })}`
  }

  function stateHeader() {
    return h(
      'header',
      { class: 'ds-appbar' },
      h(
        'a',
        { class: 'ds-back ds-pressable', href: backHref() },
        icon('back'),
        S.m.chronicle.name
      )
    )
  }

  function skeletonPage() {
    // Skeleton com a forma da ficha: header, identidade, grade e linhas.
    return h(
      'div',
      { 'aria-busy': 'true' },
      h(
        'div',
        { class: 'ds-appbar' },
        h('div', { class: 'ds-skel p-skel-title', 'aria-hidden': 'true' }),
        h('span', { class: 'sr-only', role: 'status' }, 'Carregando a ficha')
      ),
      h(
        'div',
        { class: 'p-state', 'aria-hidden': 'true' },
        h('div', { class: 'ds-skel p-skel-block' }),
        h('div', { class: 'ds-skel p-skel-grid' }),
        ...Array.from({ length: 12 }, (_, i) =>
          h('div', { class: 'ds-skel p-skel-line', 'data-w': String(i % 3) })
        )
      )
    )
  }

  function buildHeader() {
    const m = S.m
    const chips = visibleSections().map(sec =>
      h(
        'button',
        {
          type: 'button',
          class: 'ds-chip ds-pressable',
          'data-chip': sec.id,
          'aria-current': S.ui.section === sec.id ? 'true' : null,
          onclick: () => goToSection(sec.id),
        },
        sec.title
      )
    )
    const nav =
      layoutMode === 'scroll'
        ? h(
            'nav',
            { class: 'ds-chips', 'aria-label': 'Seções da ficha' },
            chips
          )
        : sectionTabs()
    return h(
      'header',
      { class: 'ds-header', id: 'top' },
      h(
        'div',
        { class: 'ds-header__bar' },
        h(
          'a',
          {
            class: 'ds-icon-btn ds-pressable',
            href: backHref(),
            'aria-label': `Voltar para ${m.chronicle.name}`,
          },
          icon('back')
        ),
        h(
          'div',
          { class: 'ds-header__title' },
          h('h1', { class: 'ds-header__name', text: nameOf(m) }),
          h('span', { class: 'ds-id-chip', text: chipText(m) })
        ),
        syncButton(),
        h(
          'button',
          {
            type: 'button',
            class: 'ds-icon-btn ds-pressable',
            'aria-label': 'Mais opções',
            'aria-haspopup': 'dialog',
            'data-key': 'menu',
            onclick: openMenu,
          },
          icon('more')
        )
      ),
      // Breadcrumb dentro de nav; separadores são decoração dentro do item, não itens da lista.
      h(
        'nav',
        { class: 'p-crumbs', 'aria-label': 'Você está em' },
        h(
          'ol',
          { class: 'ds-breadcrumb' },
          h(
            'li',
            {},
            h('a', { href: 'cronicas.html' }, 'Crônicas'),
            h('span', { 'aria-hidden': 'true' }, ' ›')
          ),
          h(
            'li',
            {},
            h('a', { href: backHref() }, m.chronicle.name),
            h('span', { 'aria-hidden': 'true' }, ' ›')
          ),
          h('li', {}, h('span', { 'aria-current': 'page', text: nameOf(m) }))
        )
      ),
      nav
    )
  }

  // ---------- Abas por zona ----------
  // Três abas fixas, as zonas que todo template já declara: build (Ficha), powers (Poderes) e lore
  // (Sobre). Nada a configurar; o template só troca o rótulo quando o genérico não serve
  // (zoneLabels: WoD "Vantagens", CoC "Equipamento"). Seções que a pessoa não pode ler somem, e
  // aba vazia some junto. Dock, Dados e identidade ficam fora das abas, sempre visíveis.

  const ZONE_TABS = { build: 'Ficha', powers: 'Poderes', lore: 'Sobre' }

  function tabsOf(m) {
    const visible = visibleSections()
    if (layoutMode === 'sections')
      return visible.map(s => ({ id: s.id, title: s.title, sections: [s.id] }))
    return Object.keys(ZONE_TABS)
      .map(z => ({
        id: z,
        title: m.t.zoneLabels?.[z] ?? ZONE_TABS[z],
        sections: visible.filter(s => s.zone === z).map(s => s.id),
      }))
      .filter(t => t.sections.length)
  }

  function activeTab() {
    const tabs = tabsOf(S.m)
    return tabs.find(t => t.id === S.ui.tab) ?? tabs[0]
  }

  function sectionTabs() {
    const tabs = tabsOf(S.m)
    const cur = activeTab()
    const buttons = tabs.map(t =>
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          id: `tab-${t.id}`,
          class: 'ds-chip ds-pressable',
          'data-key': `tab-${t.id}`,
          'data-chip': t.id,
          'aria-selected': String(t.id === cur?.id),
          'aria-controls': `tabpanel-${t.id}`,
          tabindex: t.id === cur?.id ? '0' : '-1',
          onclick: () => selectTab(t.id),
        },
        t.title
      )
    )
    const list = h(
      'div',
      {
        class: 'ds-chips',
        role: 'tablist',
        'aria-label': 'Seções da ficha',
        'data-fixed': layoutMode === 'zones' ? 'true' : null,
      },
      buttons
    )
    // Setas trocam de aba e levam o foco junto (ativação automática: trocar de aba não tem custo).
    list.addEventListener('keydown', e => {
      const idx = buttons.indexOf(document.activeElement)
      if (idx < 0) return
      const next = {
        ArrowRight: idx + 1,
        ArrowLeft: idx - 1,
        Home: 0,
        End: buttons.length - 1,
      }[e.key]
      if (next == null) return
      e.preventDefault()
      selectTab(tabs[(next + buttons.length) % buttons.length].id, true)
    })
    return list
  }

  function selectTab(id, focusTab = false) {
    const cur = activeTab()
    if (cur?.id === id) return
    // Cada aba lembra a própria rolagem (C-20).
    S.ui.tabScroll = { ...(S.ui.tabScroll ?? {}), [cur.id]: scrollY }
    S.ui.tab = id
    saveUi()
    render()
    document.querySelector('.ds-header')?.classList.remove('is-collapsed')
    scrollTo(0, S.ui.tabScroll?.[id] ?? 0)
    centerChip(id)
    if (focusTab)
      document
        .querySelector(`[data-key="tab-${CSS.escape(id)}"]`)
        ?.focus({ preventScroll: true })
  }

  // Centraliza o chip ativo rolando só a faixa (scrollIntoView rolaria também a página e, no
  // canvas de boards, a fileira de iframes).
  function centerChip(id) {
    const chip = document.querySelector(`[data-chip="${CSS.escape(id)}"]`)
    const nav = chip?.parentElement
    if (!chip || !nav?.scrollTo) return
    const c = chip.getBoundingClientRect()
    const n = nav.getBoundingClientRect()
    nav.scrollTo({
      left: nav.scrollLeft + c.left - n.left - (n.width - c.width) / 2,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  function buildModebar() {
    const m = S.m
    if (S.mode === 'evolve') {
      const n = draftChanges().length
      return h(
        'div',
        { class: 'ds-modebar', role: 'region', 'aria-label': 'Modo Evoluir' },
        h(
          'div',
          {},
          h('strong', {}, 'Evoluindo'),
          h(
            'div',
            {},
            n
              ? plural(n, 'alteração não salva', 'alterações não salvas')
              : 'Use − e + em cada linha.'
          )
        ),
        h(
          'div',
          { class: 'ds-modebar__actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'ds-btn ds-btn--primary',
              'data-key': 'evolve-done',
              onclick: finishEvolve,
            },
            'Concluir'
          )
        )
      )
    }
    if (S.archived) {
      return h(
        'div',
        {
          class: 'ds-modebar',
          role: 'region',
          'aria-label': 'Ficha arquivada',
        },
        h(
          'div',
          {},
          h('strong', {}, 'Arquivada'),
          h('div', {}, 'Somente leitura.')
        ),
        m.role === 'owner' &&
          h(
            'div',
            { class: 'ds-modebar__actions' },
            h(
              'button',
              {
                type: 'button',
                class: 'ds-btn',
                onclick: () => {
                  S.archived = false
                  writeStore(`archived:${m.character.id}`, null)
                  S.mode = 'play'
                  render()
                  toast('Ficha restaurada')
                },
              },
              'Restaurar'
            )
          )
      )
    }
    if (S.mode === 'read') {
      const owner = userName(m.character.ownerId)
      return h(
        'div',
        { class: 'ds-modebar', role: 'region', 'aria-label': 'Modo Leitura' },
        h(
          'div',
          {},
          h('strong', {}, 'Leitura'),
          h('div', {}, `Ficha de ${owner}.`)
        ),
        m.role === 'storyteller' &&
          h(
            'div',
            { class: 'ds-modebar__actions' },
            h(
              'button',
              {
                type: 'button',
                class: 'ds-btn',
                'data-key': 'mode-toggle',
                onclick: () => {
                  S.mode = 'play'
                  render()
                  announce(
                    'Editando como narrador. As alterações ficam assinadas no histórico.'
                  )
                },
              },
              'Editar como narrador'
            )
          )
      )
    }
    if (m.role === 'storyteller') {
      return h(
        'div',
        {
          class: 'ds-modebar',
          role: 'region',
          'aria-label': 'Editando como narrador',
        },
        h(
          'div',
          {},
          h('strong', {}, 'Narrador'),
          h('div', {}, 'As alterações ficam assinadas no histórico.')
        ),
        // Mesma data-key de "Editar como narrador": o foco passa de um botão para o outro.
        h(
          'div',
          { class: 'ds-modebar__actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'ds-btn',
              'data-key': 'mode-toggle',
              onclick: () => {
                S.mode = 'read'
                render()
              },
            },
            'Voltar à leitura'
          )
        )
      )
    }
    return null
  }

  function buildBanners() {
    const out = []
    if (S.offline)
      out.push(
        h(
          'div',
          { class: 'ds-banner', role: 'status' },
          icon('cloudOff'),
          h(
            'div',
            { class: 'ds-banner__text' },
            `Sem conexão. ${plural(S.pending, 'alteração será enviada', 'alterações serão enviadas')} quando a conexão voltar. Você pode continuar jogando.`
          )
        )
      )
    if (S.demoState === 'conflict') {
      out.push(
        h(
          'div',
          { class: 'ds-banner', role: 'status' },
          icon('alert'),
          h(
            'div',
            { class: 'ds-banner__text' },
            `${userName(S.m.chronicle.storytellerId)}, a narradora, alterou a Vitalidade enquanto você estava offline. Prevaleceu a alteração mais recente.`
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'ds-btn ds-btn--ghost',
              onclick: openHistory,
            },
            'Ver'
          )
        )
      )
    }
    return out.length ? h('div', { class: 'p-banners' }, out) : null
  }

  function buildIdentity() {
    const m = S.m
    const idn = m.t.identity
    const open = S.ui.identityOpen || innerWidth >= 900
    const facts = m.t.sections.filter(
      s => s.zone === 'identity' && canReadSection(m, s)
    )
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'ds-identity ds-pressable',
        'aria-expanded': String(open),
        'aria-controls': 'identity-more',
        onclick: () => {
          S.ui.identityOpen = !open
          saveUi()
          render()
        },
      },
      h('span', {
        class: 'ds-avatar ds-avatar--lg',
        'aria-hidden': 'true',
        text: initials(nameOf(m)),
      }),
      h(
        'span',
        { class: 'ds-identity__text' },
        idn.subtitle && raw(m, idn.subtitle)
          ? h('span', { class: 't-voice', style: null }, raw(m, idn.subtitle))
          : null,
        h(
          'span',
          { class: 'ds-identity__summary', style: null },
          // Eco do chip do header: aparece só quando o chip está oculto ou cortado (syncChipEcho).
          summaryText(m) !== chipText(m)
            ? h('span', {
                class: 'p-chip-echo',
                hidden: true,
                text: `${chipText(m)} · `,
              })
            : null,
          summaryText(m) || 'Identidade'
        ),
        h(
          'span',
          { class: 'sr-only' },
          open ? '. Recolher identidade' : '. Mostrar identidade'
        )
      ),
      icon(open ? 'chevronUp' : 'chevronDown')
    )
    return h(
      'section',
      { class: 'ds-card', 'aria-label': 'Identidade', style: null },
      btn,
      open &&
        h(
          'div',
          { class: 'ds-identity__more', id: 'identity-more' },
          // Nome completo (o header corta em 1 linha): display da skin, no máximo 2 linhas.
          h('p', { class: 't-display-xl p-identity-name', text: nameOf(m) }),
          idn.voice && raw(m, idn.voice) && !F(m, idn.voice).aspect
            ? h('p', { class: 'ds-voice', text: `“${raw(m, idn.voice)}”` })
            : null,
          facts.map(sec => factsList(sec.fields))
        )
    )
  }

  function factsList(ids, wide = false) {
    const m = S.m
    return h(
      'dl',
      { class: ['ds-facts', wide && 'ds-facts--wide'] },
      ids.map(id => {
        const f = F(m, id)
        const glyph =
          f.glyph === 'augur-moon'
            ? moon(f.options.find(o => o.id === raw(m, id))?.glyphParam ?? 0)
            : null
        const opt =
          f.type === 'choice' ? f.options.find(o => o.id === raw(m, id)) : null
        return h(
          'div',
          {},
          h('dt', { text: f.label }),
          h(
            'dd',
            { style: null },
            glyph ? h('span', { class: 'p-inline-glyph' }, glyph) : null,
            plainText(m, id) || '—',
            opt?.meta ? ` · ${opt.meta}` : ''
          )
        )
      })
    )
  }

  function visibleSections(zones = ['build', 'powers', 'lore']) {
    return S.m.t.sections.filter(
      s => zones.includes(s.zone) && canReadSection(S.m, s)
    )
  }

  function buildPinned() {
    return visibleSections(['play'])
      .filter(s => s.pinTop)
      .map(sec =>
        h(
          'section',
          { class: 'p-pin', 'aria-labelledby': `pin-${sec.id}` },
          h('h2', {
            class: 'ds-section__header',
            id: `pin-${sec.id}`,
            text: sec.title,
          }),
          h(
            'div',
            { class: 'ds-card' },
            sec.fields.map(id => aspectBlock(id))
          )
        )
      )
  }

  function aspectBlock(id) {
    const m = S.m
    const f = F(m, id)
    if (f.type === 'list') {
      return listItems(m, id).map(it =>
        h(
          'div',
          { class: 'p-aspect' },
          h('div', { class: 'p-aspect__kind', text: f.itemLabel }),
          h('div', { class: 'p-aspect__text', text: it.text || '—' })
        )
      )
    }
    return h(
      'button',
      {
        type: 'button',
        class: 'p-aspect ds-pressable',
        style: null,
        'aria-label': describe(m, id),
        'data-key': `aspect-${id}`,
        onclick: () => openFieldSheet(id),
        'aria-haspopup': 'dialog',
      },
      h('div', { class: 'p-aspect__kind', text: f.label }),
      h('div', { class: 'p-aspect__text', text: raw(m, id) || '—' })
    )
  }

  function sectionNode(sec, hideTitle = false) {
    return h(
      'section',
      {
        class: 'ds-section',
        id: `sec-${sec.id}`,
        'data-section': sec.id,
        'aria-labelledby': `h-${sec.id}`,
      },
      h('h2', {
        class: ['ds-section__header', hideTitle && 'sr-only'],
        id: `h-${sec.id}`,
        tabindex: '-1',
        text: sec.title,
      }),
      filterBar(sec),
      h(
        'div',
        { class: 'p-section-body', 'data-section-body': sec.id },
        sectionBody(sec)
      )
    )
  }

  function buildSections() {
    if (layoutMode === 'scroll')
      return visibleSections().map(sec => sectionNode(sec))
    // Abas: todos os painéis existem, os inativos com hidden (fora da tela e do leitor de tela);
    // na impressão, todos aparecem. Com uma seção só, o título repetiria a aba: fica só para o
    // leitor de tela (a estrutura de headings continua).
    const cur = activeTab()
    if (!cur) return null
    return tabsOf(S.m).map(t => {
      const secs = t.sections.map(id => S.m.t.sections.find(s => s.id === id))
      return h(
        'div',
        {
          class: 'p-tabpanel',
          id: `tabpanel-${t.id}`,
          role: 'tabpanel',
          'aria-labelledby': `tab-${t.id}`,
          tabindex: '-1',
          hidden: t.id !== cur.id,
        },
        secs.map(sec => sectionNode(sec, secs.length === 1))
      )
    })
  }

  // A busca refaz só o corpo da própria seção (o campo não é recriado: não quebra a composição
  // de acentos nem o teclado do Android) e anuncia o resultado com atraso, uma vez.
  let searchTimer
  function onSearch(sec, e) {
    if (e.isComposing) return
    S.ui.search[sec.id] = e.target.value
    saveUi()
    const body = document.querySelector(
      `[data-section-body="${CSS.escape(sec.id)}"]`
    )
    body?.replaceChildren(sectionBody(sec))
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      const ids = [
        ...(sec.fields ?? []),
        ...(sec.groups ?? []).flatMap(g => g.fields),
      ]
      const shown = ids.filter(id => passes(sec, id)).length
      announce(
        shown
          ? `${plural(shown, 'resultado', 'resultados')} em ${sec.title}`
          : `Nenhum resultado em ${sec.title}`
      )
    }, 500)
  }

  // ---------- Filtro e busca ----------

  function filterOn(sec) {
    // Em Evoluir o filtro "só investidos" não se aplica: é ali que se compra o primeiro ponto.
    if (!sec.filter || S.mode === 'evolve') return false
    return S.ui.filters[sec.id] ?? sec.filter.default ?? false
  }

  function passes(sec, id) {
    const m = S.m
    const f = F(m, id)
    const q = S.ui.search[sec.id]
    if (q && !fold(f.label).includes(fold(q))) return false
    if (!filterOn(sec)) return true
    switch (sec.filter.rule) {
      case 'invested':
        if (f.type === 'rating') return ratingInfo(m, id).base > 0
        if (f.type === 'number') return numberValue(m, id) > 0
        return true
      case 'proficient':
        return f.type !== 'mark' || markInfo(m, id).state.id !== 'none'
      case 'aboveBase':
        return f.type !== 'percent' || percentValue(m, id) > percentBase(m, id)
      default:
        return true
    }
  }

  function filterBar(sec) {
    if (!sec.filter && !sec.searchable) return null
    const on = filterOn(sec)
    const search = sec.searchable
      ? h('input', {
          class: 'ds-search',
          type: 'search',
          placeholder: 'Buscar',
          'aria-label': `Buscar em ${sec.title}`,
          value: S.ui.search[sec.id] ?? '',
          'data-key': `search-${sec.id}`,
          oninput: e => onSearch(sec, e),
          oncompositionend: e => onSearch(sec, e),
        })
      : null
    return h(
      'div',
      { class: 'ds-filterbar' },
      sec.filter &&
        S.mode !== 'evolve' &&
        h(
          'button',
          {
            type: 'button',
            class: 'ds-chip ds-pressable',
            'aria-pressed': String(on),
            'data-key': `filter-${sec.id}`,
            onclick: () => {
              S.ui.filters[sec.id] = !on
              saveUi()
              render()
            },
          },
          sec.filter.label
        ),
      search
    )
  }

  function hiddenNote(sec, total, shown) {
    if (shown === total) return null
    return h(
      'div',
      { class: 'p-hidden-note' },
      `Mostrando ${shown} de ${total}. `,
      h(
        'button',
        {
          type: 'button',
          class: 'ds-btn ds-btn--ghost',
          onclick: () => {
            S.ui.filters[sec.id] = false
            S.ui.search[sec.id] = ''
            saveUi()
            render()
          },
        },
        'Mostrar todos'
      )
    )
  }

  // ---------- Corpo das seções por layout ----------

  function sectionBody(sec) {
    switch (sec.layout) {
      case 'grid':
        return gridLayout(sec)
      case 'pyramid':
        return pyramidLayout(sec)
      case 'facts':
        return h(
          'div',
          { class: 'ds-card ds-card--pad' },
          factsList(sec.fields, true)
        )
      case 'text':
        return textLayout(sec)
      case 'list':
        return rowsCard(sec, sec.fields)
      default:
        return groupsLayout(sec)
    }
  }

  function groupsLayout(sec) {
    const groups = sec.groups ?? [
      { id: sec.id, title: null, fields: sec.fields },
    ]
    const minCol = sec.minColWidth
    return h(
      'div',
      {
        class: ['p-groups', groups.length > 1 && 'p-groups--wide'],
        vars: minCol ? { 'min-col': minCol } : null,
      },
      groups.map(g => {
        const shown = g.fields.filter(id => passes(sec, id))
        if (!shown.length && filterOn(sec))
          return h(
            'div',
            {},
            g.title && h('h3', { class: 'ds-group-title', text: g.title }),
            h(
              'p',
              { class: 'p-hidden-note' },
              `Nenhum com pontos em ${g.title}.`
            )
          )
        return h(
          'div',
          {},
          g.title && h('h3', { class: 'ds-group-title', text: g.title }),
          rowsCard(sec, g.fields)
        )
      }),
      sec.filter &&
        hiddenNote(
          sec,
          groups.flatMap(g => g.fields).length,
          groups.flatMap(g => g.fields).filter(id => passes(sec, id)).length
        )
    )
  }

  function rowsCard(sec, ids) {
    const shown = ids.filter(id => passes(sec, id))
    const note =
      sec.layout === 'list' && sec.filter
        ? hiddenNote(sec, ids.length, shown.length)
        : null
    // Lista compacta: com o filtro "só investidos" ligado, os traços viram chips "Nome N" em fluxo
    // (todos visíveis, ~55% menos rolagem que linhas). Filtro desligado ou Evoluir: linhas com pips.
    if (filterOn(sec) && shown.every(id => F(S.m, id).type !== 'list')) {
      return h(
        'div',
        {},
        h(
          'ul',
          { class: 'ds-chipflow' },
          shown.map(id => h('li', {}, valueChip(id, sec)))
        ),
        note
      )
    }
    const rows = shown.flatMap(id =>
      F(S.m, id).type === 'list' ? listRows(id) : [fieldRow(id, sec)]
    )
    return h('div', {}, h('ul', { class: 'ds-rows ds-card' }, rows), note)
  }

  // Chip de valor da lista compacta: nome + valor na notação do sistema; toque abre o detalhe.
  // O nome acessível é o mesmo da linha completa (describe), com especialização e modificadores.
  function valueChip(id, sec) {
    const m = S.m
    const f = F(m, id)
    let value
    switch (f.type) {
      case 'rating':
        value = String(ratingInfo(m, id).eff)
        break
      case 'percent':
        value = `${percentValue(m, id)}%`
        break
      case 'mark': {
        const k = markInfo(m, id)
        value = k.bonus != null ? fmtSigned(k.bonus) : k.state.glyph
        break
      }
      case 'number':
        value =
          f.display === 'score+mod'
            ? fmtSigned(derive(f.derive, numberValue(m, id)))
            : f.display === 'signed' || f.display === 'ladder'
              ? fmtSigned(numberValue(m, id))
              : String(numberValue(m, id))
        break
      default:
        value = shortValue(m, id)
    }
    const spec = specs(m)[id]
    const badge = sec?.badge && raw(m, sec.badge.field) === id
    return h(
      'button',
      {
        type: 'button',
        class: 'ds-chip ds-chip--value ds-pressable',
        'data-key': `chip-${id}`,
        'aria-label':
          describe(m, id) + (badge ? `, ${sec.badge.label.toLowerCase()}` : ''),
        'aria-haspopup': 'dialog',
        onclick: () => openFieldSheet(id),
      },
      h('span', { text: f.label }),
      h('b', { class: 'ds-num', text: value }),
      spec || badge
        ? h('span', {
            class: 'ds-chip__mark',
            'aria-hidden': 'true',
            text: '•',
          })
        : null
    )
  }

  function rowSubs(id, sec) {
    const m = S.m
    const f = F(m, id)
    const out = []
    const spec = specs(m)[id]
    if (f.sublabel)
      out.push(h('span', { class: 'ds-row__sub', text: f.sublabel }))
    if (f.type === 'rating') {
      const i = ratingInfo(m, id)
      const vl = f.valueLabels?.[i.eff]
      if (vl) out.push(h('span', { class: 'ds-row__sub', text: vl }))
      const mt = modText(i)
      if (mt) out.push(h('span', { class: 'ds-row__sub', text: mt }))
      const ct = capText(m, id, i)
      if (ct) out.push(h('span', { class: 'ds-row__sub', text: ct }))
    }
    if (f.type === 'resource' && f.tempUncapped)
      out.push(h('span', { class: 'ds-row__sub', text: resourceText(m, id) }))
    if (spec)
      out.push(
        h('span', { class: 'ds-row__sub ds-row__sub--spec', text: spec })
      )
    if (sec?.badge && raw(m, sec.badge.field) === id)
      out.push(h('span', { class: 'ds-badge', text: sec.badge.label }))
    return out
  }

  function rowValue(id) {
    const m = S.m
    const f = F(m, id)
    switch (f.type) {
      case 'rating': {
        const i = ratingInfo(m, id)
        return [
          pips(ratingSegments(i), {
            small: i.max > 5,
            max: Math.max(i.max, i.eff),
          }),
          h('span', { class: 'ds-row__num', text: String(i.eff) }),
        ]
      }
      case 'number': {
        const v = numberValue(m, id)
        if (f.display === 'score+mod')
          return h(
            'span',
            { class: 'ds-row__num' },
            fmtSigned(derive(f.derive, v)),
            h('small', {}, ` ${v}`)
          )
        if (f.display === 'signed')
          return h('span', { class: 'ds-row__num', text: fmtSigned(v) })
        if (f.display === 'ladder')
          return h(
            'span',
            { class: 'ds-row__num' },
            fmtSigned(v),
            h('small', {}, ` ${m.t.ladders[f.ladder][v] ?? ''}`)
          )
        return h('span', {
          class: 'ds-row__num',
          text: `${v}${f.suffix ?? ''}`,
        })
      }
      case 'percent': {
        const v = percentValue(m, id)
        return h(
          'span',
          { class: 'ds-row__num' },
          `${v}%`,
          h('small', {}, ` ½ ${derive('half', v)} · ⅕ ${derive('fifth', v)}`)
        )
      }
      case 'mark': {
        const k = markInfo(m, id)
        return [
          k.state.glyph
            ? h('span', {
                class: 'ds-badge',
                'aria-hidden': 'true',
                text: k.state.glyph,
              })
            : null,
          k.bonus != null
            ? h('span', { class: 'ds-row__num', text: fmtSigned(k.bonus) })
            : null,
        ]
      }
      case 'resource':
        return f.tempUncapped
          ? h('span', {
              class: 'ds-row__num',
              text: String(resourceInfo(m, id).current),
            })
          : h('span', { class: 'ds-row__num', text: resourceText(m, id) })
      case 'text':
      case 'longText':
        return h('span', { class: 'ds-row__num', text: raw(m, id) || '—' })
      default:
        return h('span', { class: 'ds-row__num', text: shortValue(m, id) })
    }
  }

  function fieldRow(id, sec) {
    const m = S.m
    const f = F(m, id)
    const text = h(
      'span',
      { class: 'ds-row__text' },
      h('span', { class: 'ds-row__label', text: f.label }),
      rowSubs(id, sec)
    )
    const inline =
      S.mode === 'evolve' &&
      canWriteField(m, id) &&
      ['rating', 'number', 'percent'].includes(f.type) &&
      !f.readOnly
    if (inline) {
      return h('li', {}, h('div', { class: 'ds-row' }, text, inlineStepper(id)))
    }
    const info = f.type === 'rating' ? ratingInfo(m, id) : null
    return h(
      'li',
      {},
      h(
        'button',
        {
          type: 'button',
          class: ['ds-row', 'ds-pressable', info?.inactive && 'is-inactive'],
          'data-key': `row-${id}`,
          'aria-label': describe(m, id),
          'aria-haspopup': 'dialog',
          onclick: () => openFieldSheet(id),
        },
        text,
        h('span', { class: 'ds-row__value' }, rowValue(id))
      )
    )
  }

  function inlineStepper(id) {
    const m = S.m
    const f = F(m, id)
    const value =
      f.type === 'rating'
        ? ratingInfo(m, id).base
        : f.type === 'percent'
          ? percentValue(m, id)
          : numberValue(m, id)
    const max = f.type === 'percent' ? (f.max ?? 99) : (f.max ?? 5)
    return stepper({
      label: f.label,
      value,
      min: f.min ?? 0,
      max,
      inline: true,
      allowInput: f.type !== 'rating',
      key: `step-${id}`,
      valueText: v =>
        f.type === 'percent' ? `${v} por cento` : `${v} de ${max}`,
      onChange: v => setDraft(id, v),
    })
  }

  function gridLayout(sec) {
    const m = S.m
    const groups = sec.groups
    if (groups) {
      const rows = Math.max(...groups.map(g => g.fields.length))
      const cells = []
      // O título do grupo (Físicos, Sociais…) é visual na grade: entra no nome acessível da célula.
      for (let r = 0; r < rows; r++)
        for (const g of groups)
          cells.push(
            g.fields[r]
              ? gridCell(g.fields[r], g.title)
              : h('div', { class: 'ds-cell' })
          )
      return h(
        'div',
        { class: 'ds-grid', vars: { cols: groups.length } },
        groups.map(g =>
          h('div', {
            class: 'ds-grid__head',
            'aria-hidden': 'true',
            text: g.title,
          })
        ),
        cells
      )
    }
    return h(
      'div',
      { class: 'ds-grid', vars: { cols: sec.columns ?? 3 } },
      sec.fields.map(id => gridCell(id))
    )
    function gridCell(id, group) {
      const f = F(m, id)
      let top
      let mid
      let sub = null
      if (f.type === 'rating') {
        // Rótulo sozinho na primeira linha (cabe "Manipulação" em 360 dp sem abreviar); pips e número embaixo.
        const i = ratingInfo(m, id)
        top = [h('span', { class: 'ds-cell__label', text: f.label })]
        mid = h(
          'span',
          { class: 'ds-cell__top' },
          pips(ratingSegments(i), {
            small: Math.max(i.max, i.eff) > 5,
            max: Math.max(i.max, i.eff),
          }),
          h('span', { class: 'ds-cell__num', text: String(i.eff) })
        )
        sub = modText(i) ?? specs(m)[id] ?? null
      } else if (f.type === 'number') {
        const v = numberValue(m, id)
        const badge =
          f.badge && raw(m, f.badge.field) && raw(m, f.badge.field) !== 'none'
            ? f.badge.glyph
            : ''
        top = [
          h('span', { class: 'ds-cell__label', text: f.shortLabel ?? f.label }),
          badge
            ? h('span', {
                class: 'ds-badge',
                'aria-hidden': 'true',
                text: badge,
              })
            : null,
        ]
        mid = h('span', {
          class: 'ds-cell__big',
          text:
            f.display === 'score+mod'
              ? fmtSigned(derive(f.derive, v))
              : String(v),
        })
        sub = f.display === 'score+mod' ? String(v) : null
      } else if (f.type === 'percent') {
        const v = percentValue(m, id)
        top = [
          h('span', { class: 'ds-cell__label', text: f.shortLabel ?? f.label }),
        ]
        mid = h('span', { class: 'ds-cell__big', text: String(v) })
        sub = `½ ${derive('half', v)} · ⅕ ${derive('fifth', v)}`
      }
      const badgeText =
        f.badge && raw(m, f.badge.field) && raw(m, f.badge.field) !== 'none'
          ? `, ${f.badge.label.toLowerCase()}`
          : ''
      const shown = f.type === 'rating' ? f.label : (f.shortLabel ?? f.label)
      return h(
        'button',
        {
          type: 'button',
          class: 'ds-cell ds-pressable',
          'data-key': `cell-${id}`,
          'aria-label': withVisibleLabel(
            shown,
            f.label,
            describe(m, id) + badgeText + (group ? `, ${group}` : '')
          ),
          'aria-haspopup': 'dialog',
          onclick: () => openFieldSheet(id),
        },
        h('span', { class: 'ds-cell__top' }, top),
        mid,
        sub && h('span', { class: 'ds-cell__sub', text: sub })
      )
    }
  }

  function pyramidLayout(sec) {
    const m = S.m
    const ladder = m.t.ladders[F(m, sec.fields[0]).ladder]
    const byValue = new Map()
    for (const id of sec.fields) {
      if (!passes(sec, id)) continue
      const v = numberValue(m, id)
      if (!byValue.has(v)) byValue.set(v, [])
      byValue.get(v).push(id)
    }
    const tiers = [...byValue.keys()].sort((a, b) => b - a)
    return h(
      'div',
      {},
      h(
        'div',
        { class: 'ds-pyramid' },
        tiers.map(v =>
          h(
            'div',
            { class: 'ds-pyramid__tier' },
            h('div', {
              class: 'ds-pyramid__rung',
              text: `${fmtSigned(v)} ${ladder[v] ?? ''}`,
            }),
            h(
              'div',
              { class: 'ds-pyramid__skills' },
              byValue
                .get(v)
                .map(id =>
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'ds-chip ds-pressable',
                      'data-key': `pyr-${id}`,
                      'aria-label': describe(m, id),
                      'aria-haspopup': 'dialog',
                      onclick: () => openFieldSheet(id),
                    },
                    F(m, id).label
                  )
                )
            )
          )
        )
      ),
      hiddenNote(
        sec,
        sec.fields.length,
        sec.fields.filter(id => passes(sec, id)).length
      )
    )
  }

  function textLayout(sec) {
    const m = S.m
    return h(
      'div',
      { class: 'ds-card ds-card--pad' },
      sec.fields.map(id => {
        const f = F(m, id)
        const v = raw(m, id)
        const isVoice = id === m.t.identity.voice
        const edit = canEdit(id)
          ? h(
              'button',
              {
                type: 'button',
                class: 'ds-icon-btn ds-pressable',
                'aria-label': `Editar ${f.label}`,
                'data-key': `edit-${id}`,
                onclick: () => openTextEditor(id),
              },
              icon('edit')
            )
          : null
        return h(
          'div',
          { class: 'p-text-block' },
          h('div', { class: 'ds-cell__top' }, h('h3', { text: f.label }), edit),
          isVoice && v
            ? h('p', { class: 'ds-voice', text: `“${v}”` })
            : h('p', { text: v || '—' })
        )
      })
    )
  }

  function listRows(id) {
    const m = S.m
    const f = F(m, id)
    const items = listItems(m, id)
    const rows = items.map(it => {
      const metaText = (f.item?.meta ?? [])
        .map(mm => {
          const v = it.meta?.[mm.id]
          if (v == null || v === '') return null
          return mm.display === 'signed'
            ? `${mm.label} ${fmtSigned(v)}`
            : mm.type === 'number'
              ? `${mm.label} ${v}`
              : String(v)
        })
        .filter(Boolean)
        .join(' · ')
      const valueNode =
        typeof it.value === 'number'
          ? [
              pips([
                { kind: 'on', n: it.value },
                {
                  kind: 'off',
                  n: Math.max(0, (f.item.value.max ?? 5) - it.value),
                },
              ]),
              h('span', { class: 'ds-row__num', text: String(it.value) }),
            ]
          : null
      const label = f.fixed
        ? `${it.label}: ${it.text || 'vazia'}`
        : `${it.name}${typeof it.value === 'number' ? `, ${it.value} de ${f.item.value.max ?? 5}` : ''}${metaText ? `, ${metaText}` : ''}${it.specialty ? `, especialização ${it.specialty}` : ''}`
      return h(
        'li',
        {},
        h(
          'button',
          {
            type: 'button',
            class: 'ds-row ds-pressable',
            'data-key': `item-${id}-${it.id}`,
            'aria-label': label,
            'aria-haspopup': 'dialog',
            onclick: () =>
              f.fixed || f.item?.aspect
                ? openListEditor(id)
                : openListItem(id, it.id),
          },
          h(
            'span',
            { class: 'ds-row__text' },
            h('span', {
              class: 'ds-row__label',
              text: f.fixed ? it.label : it.name || it.text,
            }),
            f.fixed
              ? h('span', { class: 'ds-row__sub', text: it.text || 'vazia' })
              : null,
            metaText
              ? h('span', { class: 'ds-row__sub', text: metaText })
              : null,
            it.specialty
              ? h('span', {
                  class: 'ds-row__sub ds-row__sub--spec',
                  text: it.specialty,
                })
              : null
          ),
          h('span', { class: 'ds-row__value' }, valueNode)
        )
      )
    })
    if (!items.length) {
      rows.push(
        h(
          'li',
          {},
          h(
            'div',
            { class: 'ds-row' },
            h(
              'span',
              { class: 'ds-row__text' },
              h('span', {
                class: 'ds-row__label ds-muted',
                text: `Nenhum(a) ${f.itemLabel.toLowerCase()}`,
              })
            ),
            canEdit(id) || (S.mode === 'play' && canWriteField(S.m, id))
              ? h(
                  'button',
                  {
                    type: 'button',
                    class: 'ds-btn ds-btn--ghost',
                    onclick: () => openAddItem(id),
                  },
                  'Adicionar'
                )
              : null
          )
        )
      )
    } else if (S.mode === 'evolve' && canWriteField(S.m, id) && !f.fixed) {
      rows.push(
        h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: 'ds-row ds-pressable',
              onclick: () => openAddItem(id),
            },
            h(
              'span',
              { class: 'ds-row__label' },
              `Adicionar ${f.itemLabel.toLowerCase()}`
            ),
            icon('plus')
          )
        )
      )
    }
    return rows
  }

  // ---------- Painel "Em jogo" (≥ 600) e itens de jogo ----------

  function playFieldIds() {
    return visibleSections(['play'])
      .filter(s => !s.pinTop)
      .flatMap(s => s.fields)
  }

  function buildPlayPanel() {
    const pinned = visibleSections(['play']).filter(s => s.pinTop)
    return h(
      'aside',
      { class: 'p-play-panel', 'aria-labelledby': 'play-h' },
      h('h2', { class: 'ds-section__header', id: 'play-h', text: 'Em jogo' }),
      pinned.map(sec =>
        h(
          'div',
          { class: 'ds-card', style: null },
          sec.fields.map(id => aspectBlock(id))
        )
      ),
      h(
        'div',
        { class: 'p-play-panel__grid' },
        playFieldIds().map(id => playItem(id))
      ),
      h(
        'div',
        { class: 'p-actions', style: null },
        diceButton('ds-btn ds-btn--primary ds-btn--lg')
      )
    )
  }

  function playVisual(id) {
    const m = S.m
    const f = F(m, id)
    switch (f.type) {
      case 'resource': {
        const r = resourceInfo(m, id)
        if (f.tempUncapped) return null
        const role =
          f.colorRole && f.colorRole !== 'accent' ? `is-${f.colorRole}` : null
        if (r.shownMax != null && r.shownMax <= 20) {
          return h(
            'div',
            { class: 'ds-boxes', 'aria-hidden': 'true' },
            Array.from({ length: r.shownMax }, (_, i) =>
              h('span', {
                class: [
                  'ds-box',
                  i < r.current && 'is-filled',
                  i < r.current && role,
                ],
              })
            )
          )
        }
        // Medidor para máximos grandes (PV de D&D, Sanidade). Temporários entram hachurados depois
        // do valor atual. Largura por variável numérica (sem style montado em string: CSP estrita).
        const scale = (r.shownMax ?? r.current) + (r.temp ?? 0)
        const pct = scale ? Math.min(100, (r.current / scale) * 100) : 0
        const pctTemp =
          scale && r.temp ? Math.min(100 - pct, (r.temp / scale) * 100) : 0
        return h(
          'div',
          { class: 'ds-meter', 'aria-hidden': 'true' },
          h('div', { class: 'ds-meter__fill', vars: { pct: pct.toFixed(1) } }),
          pctTemp
            ? h('div', {
                class: 'ds-meter__fill ds-meter__fill--temp',
                vars: { 'pct-temp': pctTemp.toFixed(1) },
              })
            : null
        )
      }
      case 'track': {
        if (f.rule === 'wod-stacking') return healthTrack(id)
        const b = boxesInfo(m, id)
        return h(
          'div',
          {},
          b.rows.map(r =>
            h(
              'div',
              { class: 'ds-track__row' },
              h('span', { class: 'ds-track__label', text: r.label }),
              h(
                'span',
                { class: 'ds-boxes', 'aria-hidden': 'true' },
                r.marks.map((x, i) =>
                  h('span', {
                    class: ['ds-box', x && 'is-filled'],
                    text: r.boxValues ? String(r.boxValues[i]) : '',
                  })
                )
              )
            )
          )
        )
      }
      case 'clock': {
        const c = clockInfo(m, id)
        return h(
          'div',
          { class: 'p-center' },
          clock({
            segments: f.segments,
            size: 132,
            label: describe(m, id),
            fills: c.fills.map(x => ({
              n: x.n,
              from: x.from,
              role: x.colorRole,
            })),
          })
        )
      }
      case 'slots': {
        const s = slotsInfo(m, id)
        return h(
          'div',
          {},
          s.levels.map(l =>
            h(
              'div',
              { class: 'ds-track__row' },
              h('span', { class: 'ds-track__label', text: `${l.label} nível` }),
              h(
                'span',
                { class: 'ds-boxes', 'aria-hidden': 'true' },
                Array.from({ length: l.max }, (_, i) =>
                  h('span', {
                    class: ['ds-box', i < l.max - l.used && 'is-filled'],
                  })
                )
              )
            )
          )
        )
      }
      case 'state': {
        const o = stateOption(m, id)
        return o.hint
          ? h('div', { class: 'p-play-item__note', text: o.hint })
          : null
      }
      case 'tags': {
        const sel = (raw(m, id) ?? [])
          .map(x => f.options.find(o => o.id === x))
          .filter(Boolean)
        return sel.length
          ? h(
              'div',
              { class: 'ds-list-item__chips' },
              sel.map(o => h('span', { class: 'ds-tag', text: o.label }))
            )
          : null
      }
      case 'list': {
        const items = listItems(m, id)
        return h(
          'div',
          {},
          items.map(it =>
            h(
              'div',
              { class: 'ds-track__row' },
              h('span', {
                class: 'ds-track__label',
                text: it.label ?? it.name,
              }),
              h('span', { class: 'ds-track__type', text: it.text || '—' })
            )
          )
        )
      }
      default:
        return null
    }
  }

  function healthTrack(id) {
    const hi = healthInfo(S.m, id)
    return h(
      'div',
      { class: 'ds-track', 'aria-hidden': 'true' },
      hi.f.levels.map((lv, i) => {
        const ty = hi.boxes[i]
        return h(
          'div',
          { class: 'ds-track__row' },
          h('span', { class: 'ds-track__label', text: lv.label }),
          h('span', {
            class: 'ds-track__pen',
            text:
              lv.penalty == null
                ? ''
                : lv.penalty === 0
                  ? ''
                  : `${MINUS}${-lv.penalty}`,
          }),
          h('span', { class: 'ds-track__type', text: ty ? ty.label : '' }),
          h('span', { class: 'ds-box', text: ty ? ty.glyph : '' })
        )
      })
    )
  }

  function playItem(id) {
    const m = S.m
    const f = F(m, id)
    const note =
      f.type === 'track' && f.rule === 'wod-stacking'
        ? `Penalidade: ${fmtPenalty(healthInfo(m, id).penalty)}`
        : f.type === 'resource' && resourceInfo(m, id).perTurn
          ? `Gasto máximo por turno: ${resourceInfo(m, id).perTurn}`
          : null
    return h(
      'button',
      {
        type: 'button',
        class: 'p-play-item ds-pressable',
        'data-key': `play-${id}`,
        'aria-label': describe(m, id),
        'aria-haspopup': 'dialog',
        onclick: () => openFieldSheet(id),
      },
      h(
        'span',
        { class: 'p-play-item__head' },
        h('span', { class: 'p-play-item__title', text: f.label }),
        h('span', {
          class: 'p-play-item__value',
          text:
            f.type === 'track' && f.rule === 'wod-stacking'
              ? healthInfo(m, id).status
              : shortValue(m, id),
        })
      ),
      playVisual(id),
      note && h('span', { class: 'p-play-item__note', text: note })
    )
  }

  // ---------- Dock de jogo (celular) ----------

  const DEFAULT_ACTION_LABEL = {
    spend1: 'gastar 1',
    gain1: 'recuperar 1',
    damage1: 'aplicar 1 de dano',
    use1: 'usar 1',
  }

  function buildDock() {
    const m = S.m
    const dice = diceButton(
      'ds-dock-chip ds-dock-chip--action ds-pressable',
      true
    )
    return h(
      'section',
      { class: 'ds-dock', 'aria-label': 'Em jogo' },
      h(
        'button',
        {
          type: 'button',
          class: 'ds-dock__handle',
          'aria-haspopup': 'dialog',
          onclick: openAllResources,
        },
        'Todos os recursos'
      ),
      h(
        'div',
        { class: 'ds-dock__row' },
        m.t.dock.map(id => dockChip(id)),
        dice
      )
    )
  }

  function dockChip(id) {
    const m = S.m
    const f = F(m, id)
    const action = f.defaultAction && canEdit(id) ? f.defaultAction : null
    const verb =
      ['spend1', 'damage1'].includes(action) && f.spendLabel
        ? f.spendLabel.toLowerCase()
        : DEFAULT_ACTION_LABEL[action]
    const hint = action ? `. Toque longo: ${verb}.` : ''
    const value = dockValue(m, id)
    // Valor só com palavras (forma, "nenhuma"): corpo menor para caber no chip de 360 dp.
    const isText = typeof value === 'string' && !/\d/.test(value)
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'ds-dock-chip ds-pressable',
        'data-key': `dock-${id}`,
        'aria-label': withVisibleLabel(
          f.shortLabel ?? f.label,
          f.label,
          `${describe(m, id)}${hint}`
        ),
        'aria-haspopup': 'dialog',
      },
      h('span', {
        class: 'ds-dock-chip__label',
        text: f.shortLabel ?? f.label,
      }),
      h(
        'span',
        {
          class: ['ds-dock-chip__value', isText && 'ds-dock-chip__value--text'],
        },
        value
      )
    )
    let timer
    const cancel = () => clearTimeout(timer)
    btn.addEventListener('pointerdown', () => {
      S.suppressClick = false
      if (!action) return
      timer = setTimeout(() => {
        // O render troca o chip enquanto o dedo ainda está na tela: o clique que vem ao soltar
        // pode cair no chip novo. A supressão fica no estado (não no elemento) até soltar.
        S.suppressClick = true
        const release = () =>
          setTimeout(() => {
            S.suppressClick = false
          }, 0)
        document.addEventListener('pointerup', release, {
          once: true,
          capture: true,
        })
        document.addEventListener('pointercancel', release, {
          once: true,
          capture: true,
        })
        runDefaultAction(id)
      }, 500)
    })
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel'])
      btn.addEventListener(ev, cancel)
    btn.addEventListener('contextmenu', e => e.preventDefault())
    btn.addEventListener('click', () => {
      if (!S.suppressClick) openFieldSheet(id)
    })
    return btn
  }

  function runDefaultAction(id) {
    const m = S.m
    const f = F(m, id)
    const v = clone(raw(m, id)) ?? {}
    if (f.type === 'resource') {
      const r = resourceInfo(m, id)
      if (f.defaultAction === 'damage1' && f.rule === 'tempFirst')
        return commit([{ id, to: { ...v, ...RULES.tempFirst(r, 1) } }])
      const delta = f.defaultAction === 'gain1' ? 1 : -1
      const next = Math.max(0, Math.min(r.cap ?? 999, r.current + delta))
      if (next === r.current)
        return announce(
          `${f.label}: nada a ${delta < 0 ? 'gastar' : 'recuperar'}`
        )
      return commit([{ id, to: { ...v, current: next } }])
    }
    if (f.type === 'slots') {
      const s = slotsInfo(m, id)
      const lv = s.levels.find(l => l.used < l.max)
      if (!lv) return announce('Sem espaços disponíveis')
      return commit(
        [{ id, to: { ...v, [lv.n]: { ...v[lv.n], used: lv.used + 1 } } }],
        {
          label: `Espaço de ${lv.label} nível usado (${lv.max - lv.used - 1}/${lv.max})`,
        }
      )
    }
  }

  function diceButton(cls, compact = false) {
    const r = S.m.t.roll
    const sub = {
      'pool-success': `d${r.die ?? 10}`,
      'sum-vs-target': (r.dice ?? '1d20').replace(/^1d/, 'd'),
      'roll-under-percent': 'd100',
      fudge: r.dice ?? '4dF',
      'pbta-2d6': '2d6',
    }[r.model]
    return h(
      'button',
      {
        type: 'button',
        class: cls,
        'aria-haspopup': 'dialog',
        'data-key': compact ? 'dock-dice' : 'panel-dice',
        onclick: () => openDice(),
      },
      compact
        ? [
            h('span', { class: 'ds-dock-chip__label', text: r.label }),
            h(
              'span',
              { class: 'ds-dock-chip__value' },
              icon('dice', 'ds-icon ds-icon--sm'),
              sub
            ),
          ]
        : [icon('dice'), `${r.label}: montar parada`]
    )
  }

  // ---------- Navegação: chips com scroll spy, header que recolhe, posição lembrada ----------

  let observer
  function observeSections() {
    observer?.disconnect()
    if (layoutMode !== 'scroll') return
    observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const id = e.target.dataset.section
          if (S.ui.section === id) continue
          S.ui.section = id
          for (const c of document.querySelectorAll('[data-chip]'))
            c.setAttribute(
              'aria-current',
              c.dataset.chip === id ? 'true' : 'false'
            )
          // Centraliza o chip rolando só a faixa de chips (scrollIntoView rolaria também a página
          // e, no canvas de boards, a fileira de iframes).
          const chip = document.querySelector(`[data-chip="${CSS.escape(id)}"]`)
          const nav = chip?.parentElement
          if (chip && nav?.scrollTo) {
            const c = chip.getBoundingClientRect()
            const n = nav.getBoundingClientRect()
            nav.scrollTo({
              left: nav.scrollLeft + c.left - n.left - (n.width - c.width) / 2,
              behavior: reducedMotion ? 'auto' : 'smooth',
            })
          }
        }
      },
      { rootMargin: '-140px 0px -55% 0px' }
    )
    for (const sec of document.querySelectorAll('.ds-section[data-section]'))
      observer.observe(sec)
  }

  function goToSection(id) {
    const sec = document.getElementById(`sec-${id}`)
    sec?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
    document.getElementById(`h-${id}`)?.focus({ preventScroll: true })
  }

  function setupScroll() {
    let last = scrollY
    let saveTimer
    let settleUntil = 0
    addEventListener(
      'scroll',
      () => {
        const y = scrollY
        const header = document.querySelector('.ds-header')
        // Recolher ou abrir o header muda a altura da página, e o navegador compensa o scroll
        // (scroll anchoring, ou o limite no fim da página). Essa compensação não é gesto do
        // usuário: lida como tal, o header abria e fechava sem parar.
        if (header && performance.now() > settleUntil) {
          const collapsed = header.classList.contains('is-collapsed')
          if (!collapsed && y > last + 8 && y > 160) {
            header.classList.add('is-collapsed')
            settleUntil = performance.now() + 400
          } else if (collapsed && y < last - 8) {
            header.classList.remove('is-collapsed')
            settleUntil = performance.now() + 400
          }
        }
        last = y
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
          S.ui.scrollY = y
          if (layoutMode !== 'scroll') {
            const t = activeTab()
            if (t) S.ui.tabScroll = { ...(S.ui.tabScroll ?? {}), [t.id]: y }
          }
          saveUi()
        }, 300)
      },
      { passive: true }
    )
  }

  // =====================================================================
  // Sheets
  // =====================================================================

  // Abre um sheet cujo corpo é recalculado depois de cada alteração (a ficha muda por baixo).
  function liveSheet(title, build, opts = {}) {
    const body = h('div', {})
    // Depois de cada alteração o corpo é refeito; o foco volta ao mesmo controle pela data-key
    // (botões sem chave ganham uma derivada do texto). Se o controle sumiu ou ficou desabilitado,
    // o foco vai para o título do sheet, nunca para "o vizinho": o próximo Enter não pode executar
    // outra ação (ex.: "Recuperar 1" no lugar de "Gastar 1").
    const keyButtons = () => {
      for (const b of body.querySelectorAll('button:not([data-key])'))
        b.dataset.key = `auto-${b.textContent.trim()}`
    }
    const refresh = () => {
      const active = document.activeElement
      const inside = body.contains(active)
      const key = inside ? active.closest('[data-key]')?.dataset.key : null
      body.replaceChildren(...[build()].flat().filter(Boolean))
      keyButtons()
      if (!inside) return
      const same = key && body.querySelector(`[data-key="${CSS.escape(key)}"]`)
      const target =
        same && !same.disabled && same.getAttribute('aria-disabled') !== 'true'
          ? same
          : body.closest('[role="dialog"]')?.querySelector('.ds-sheet__title')
      target?.focus({ preventScroll: true })
    }
    refresh()
    S.refreshers.add(refresh)
    const s = sheet({
      title,
      body,
      footer: opts.footer,
      onClose: () => {
        S.refreshers.delete(refresh)
        opts.onClose?.()
      },
    })
    return { ...s, refresh }
  }

  function openFieldSheet(id) {
    const f = F(S.m, id)
    if (
      S.mode === 'evolve' &&
      ['rating', 'number', 'percent', 'mark', 'choice'].includes(f.type) &&
      canWriteField(S.m, id)
    )
      return openEditor(id)
    switch (f.type) {
      case 'resource':
        return openResource(id)
      case 'track':
        return f.rule === 'wod-stacking' ? openHealth(id) : openBoxes(id)
      case 'clock':
        return openClock(id)
      case 'state':
        return openState(id)
      case 'slots':
        return openSlots(id)
      case 'tags':
        return openTags(id)
      case 'list':
        return f.fixed || f.item?.aspect ? openListEditor(id) : null
      case 'text':
      case 'longText':
        return canEdit(id) ? openTextEditor(id) : openDetail(id)
      default:
        return openDetail(id)
    }
  }

  function bigValue(value, of) {
    return h(
      'div',
      { class: 'p-sheet-value', 'aria-hidden': 'true' },
      h('span', { class: 'p-sheet-value__big', text: String(value) }),
      of != null
        ? h('span', { class: 'p-sheet-value__of', text: `/ ${of}` })
        : null
    )
  }

  function sheetSection(title, ...children) {
    return h(
      'section',
      { class: 'p-sheet-section' },
      h('h3', { text: title }),
      children
    )
  }

  function rollSlotFor(id) {
    const sec = sectionOf(S.m, id)
    return S.m.t.roll.slots.find(sl => sl.from.includes(sec?.id))
  }

  // Detalhe de um traço permanente (Jogo/Leitura): tocar não altera nada.
  function openDetail(id) {
    liveSheet(F(S.m, id).label, () => {
      const m = S.m
      const f = F(m, id)
      const out = [h('p', { class: 'sr-only', text: describe(m, id) })]
      if (f.type === 'rating') {
        const i = ratingInfo(m, id)
        out.push(
          bigValue(i.eff, i.max),
          h(
            'div',
            { class: 'p-center' },
            pips(ratingSegments(i), {
              small: i.max > 5,
              max: Math.max(i.max, i.eff),
            })
          )
        )
        const lines = [
          f.valueLabels?.[i.eff],
          modText(i),
          capText(m, id, i) &&
            `${capText(m, id, i)}. Os pontos voltam a valer quando o teto subir.`,
          specs(m)[id] && `Especialização: ${specs(m)[id]}`,
        ].filter(Boolean)
        for (const l of lines) out.push(h('p', { class: 'p-note', text: l }))
      } else if (f.type === 'number') {
        const v = numberValue(m, id)
        if (f.display === 'score+mod')
          out.push(
            bigValue(fmtSigned(derive(f.derive, v))),
            h('p', { class: 'p-note p-center', text: `Valor ${v}` })
          )
        else if (f.display === 'ladder')
          out.push(
            bigValue(fmtSigned(v)),
            h('p', {
              class: 'p-note p-center',
              text: m.t.ladders[f.ladder][v] ?? '',
            })
          )
        else
          out.push(
            bigValue(
              f.display === 'signed' ? fmtSigned(v) : `${v}${f.suffix ?? ''}`
            )
          )
        if (
          f.badge &&
          raw(m, f.badge.field) &&
          raw(m, f.badge.field) !== 'none'
        )
          out.push(h('p', { class: 'p-note p-center', text: f.badge.label }))
      } else if (f.type === 'percent') {
        const v = percentValue(m, id)
        out.push(
          bigValue(`${v}%`),
          sheetSection(
            'Para a rolagem',
            h(
              'div',
              { class: 'p-kv' },
              h('span', {}, 'Regular'),
              h('b', {}, `${v}`)
            ),
            h(
              'div',
              { class: 'p-kv' },
              h('span', {}, 'Difícil (½)'),
              h('b', {}, `${derive('half', v)}`)
            ),
            h(
              'div',
              { class: 'p-kv' },
              h('span', {}, 'Extremo (⅕)'),
              h('b', {}, `${derive('fifth', v)}`)
            )
          )
        )
        if (f.base != null)
          out.push(
            h('p', { class: 'p-note', text: `Base: ${percentBase(m, id)}%` })
          )
      } else if (f.type === 'mark') {
        const k = markInfo(m, id)
        out.push(
          bigValue(k.bonus != null ? fmtSigned(k.bonus) : k.state.label),
          h('p', { class: 'p-note p-center', text: k.state.label })
        )
      } else {
        out.push(
          h('p', { class: 'p-text-block', text: plainText(m, id) || '—' })
        )
      }
      if (f.help) out.push(h('p', { class: 'p-note', text: f.help }))
      const actions = []
      const slot = rollSlotFor(id)
      if (slot && f.type !== 'text')
        actions.push(
          h(
            'button',
            {
              type: 'button',
              class: 'ds-btn ds-btn--primary',
              onclick: () => openDice({ [slot.id]: id }),
            },
            icon('dice'),
            'Montar parada'
          )
        )
      if (
        S.mode === 'play' &&
        canWriteField(m, id) &&
        !f.readOnly &&
        !S.archived
      )
        actions.push(
          h(
            'button',
            {
              type: 'button',
              class: 'ds-btn',
              onclick: () => {
                enterEvolve(id)
              },
            },
            icon('edit'),
            'Alterar valor'
          )
        )
      if (actions.length)
        out.push(h('div', { class: 'p-actions p-sheet-section' }, actions))
      if (S.mode === 'play' && !f.readOnly && !editableIn(f).includes('play'))
        out.push(
          h('p', {
            class: 'p-note',
            text: 'Traço permanente: muda só em Evoluir, para evitar alteração acidental durante o jogo.',
          })
        )
      return out
    })
  }

  // Editor (modo Evoluir): stepper de 56 px, nunca salta; restrições não destrutivas.
  function openEditor(id) {
    liveSheet(`Evoluir · ${F(S.m, id).label}`, () => {
      const m = S.m
      const f = F(m, id)
      const out = []
      if (['rating', 'number', 'percent'].includes(f.type)) {
        const value =
          f.type === 'rating'
            ? ratingInfo(m, id).base
            : f.type === 'percent'
              ? percentValue(m, id)
              : numberValue(m, id)
        const max = f.type === 'percent' ? (f.max ?? 99) : (f.max ?? 5)
        out.push(
          h(
            'div',
            { class: 'p-center', style: null },
            stepper({
              label: f.label,
              value,
              min: f.min ?? 0,
              max,
              allowInput: f.type !== 'rating',
              valueText: v =>
                f.type === 'percent' ? `${v} por cento` : `${v} de ${max}`,
              onChange: v => setDraft(id, v),
            })
          )
        )
        if (f.type === 'rating') {
          const i = ratingInfo(m, id)
          out.push(
            h(
              'div',
              { class: 'p-center p-sheet-section' },
              pips(ratingSegments(i), {
                small: i.max > 5,
                max: Math.max(i.max, i.eff),
              })
            )
          )
          const ct = capText(m, id, i)
          if (ct)
            out.push(
              h('p', {
                class: 'p-note',
                text: `${ct}. O valor fica guardado e volta a valer quando o teto subir.`,
              })
            )
        }
        if (f.specialty) {
          const input = h('input', {
            class: 'ds-input',
            type: 'text',
            maxlength: '80',
            value: specs(m)[id] ?? '',
            'aria-describedby': `spec-help-${id}`,
          })
          input.addEventListener('change', () =>
            setDraftSpecialty(id, input.value.trim())
          )
          out.push(
            h(
              'label',
              { class: 'ds-field p-sheet-section' },
              h('span', { class: 'ds-field__label' }, 'Especialização'),
              input,
              h('span', {
                class: 'ds-field__help',
                id: `spec-help-${id}`,
                text: 'Opcional. Aparece abaixo do nome do traço.',
              })
            )
          )
        }
      } else if (f.type === 'mark') {
        const k = markInfo(m, id)
        out.push(
          radioGroup(
            f.label,
            k.states.map(s => ({ id: s.id, label: s.label, hint: s.glyph })),
            k.state.id,
            v => setDraft(id, v)
          )
        )
      } else if (f.type === 'choice') {
        out.push(
          radioGroup(
            f.label,
            f.options.map(o => ({ id: o.id, label: o.label, hint: o.meta })),
            raw(m, id),
            v => setDraft(id, v)
          )
        )
      }
      if (f.help) out.push(h('p', { class: 'p-note', text: f.help }))
      return out
    })
  }

  function radioGroup(label, options, selected, onSelect) {
    const group = h('div', {
      class: 'ds-radios',
      role: 'radiogroup',
      'aria-label': label,
    })
    const buttons = options.map((o, i) =>
      h(
        'button',
        {
          type: 'button',
          role: 'radio',
          class: 'ds-radio ds-pressable',
          'aria-checked': String(o.id === selected),
          tabindex: o.id === selected || (!selected && i === 0) ? '0' : '-1',
          onclick: () => onSelect(o.id),
        },
        h(
          'span',
          { class: 'ds-radio__text' },
          h('span', { class: 'ds-radio__label', text: o.label }),
          o.hint ? h('span', { class: 'ds-radio__hint', text: o.hint }) : null
        )
      )
    )
    group.addEventListener('keydown', e => {
      const idx = buttons.indexOf(document.activeElement)
      if (idx < 0) return
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[
        e.key
      ]
      if (!d) return
      e.preventDefault()
      const next = buttons[(idx + d + buttons.length) % buttons.length]
      next.focus()
    })
    group.append(...buttons)
    return group
  }

  function openResource(id) {
    let amount = 1
    liveSheet(F(S.m, id).label, () => {
      const m = S.m
      const f = F(m, id)
      const r = resourceInfo(m, id)
      const v = raw(m, id) ?? {}
      const editable = canEdit(id)
      const out = [h('p', { class: 'sr-only', text: describe(m, id) })]
      if (f.tempUncapped) {
        out.push(
          h(
            'div',
            { class: 'p-kv' },
            h('span', {}, 'Permanente'),
            h('b', {}, String(r.permanent))
          ),
          h(
            'div',
            { class: 'p-kv' },
            h('span', {}, 'Temporário'),
            h('b', {}, String(r.current))
          )
        )
        if (S.mode === 'evolve' && canWriteField(m, id)) {
          out.push(
            sheetSection(
              'Permanente',
              stepper({
                label: `${f.label} permanente`,
                value: r.permanent,
                min: f.permanent.min,
                max: f.permanent.max,
                onChange: x => setDraft(id, { ...v, permanent: x }),
              })
            )
          )
          out.push(
            sheetSection(
              'Temporário',
              stepper({
                label: `${f.label} temporário`,
                value: r.current,
                min: 0,
                max: r.max ?? 10,
                onChange: x => setDraft(id, { ...v, current: x }),
              })
            )
          )
        } else
          out.push(
            h('p', {
              class: 'p-note',
              text: 'O Renome muda em Evoluir, entre sessões.',
            })
          )
        if (f.help) out.push(h('p', { class: 'p-note', text: f.help }))
        return out
      }
      out.push(
        bigValue(r.current, r.shownMax),
        r.temp
          ? h('p', { class: 'p-note p-center', text: `+${r.temp} temporários` })
          : null
      )
      const vis = playVisual(id)
      if (vis) out.push(h('div', { class: 'p-center' }, vis))
      if (editable) {
        if (f.rule === 'tempFirst') {
          const amt = stepper({
            label: 'Quantidade',
            value: amount,
            min: 1,
            max: 999,
            allowInput: true,
            valueText: x => String(x),
            onChange: x => {
              amount = x
            },
          })
          out.push(
            sheetSection(
              'Aplicar',
              amt,
              h(
                'div',
                { class: 'p-actions', style: null },
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'ds-btn ds-btn--lg',
                    onclick: () => applyHp(id, -amount),
                  },
                  'Dano'
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'ds-btn ds-btn--lg',
                    onclick: () => applyHp(id, amount),
                  },
                  'Cura'
                )
              )
            )
          )
          out.push(
            sheetSection(
              'PV temporários',
              stepper({
                label: 'PV temporários',
                value: r.temp ?? 0,
                min: 0,
                max: 999,
                allowInput: true,
                valueText: x => String(x),
                onChange: x => commit([{ id, to: { ...v, temp: x } }]),
              })
            )
          )
          if (r.current === 0 && f.atZero)
            out.push(
              h(
                'div',
                { class: 'ds-banner', role: 'status' },
                icon('alert'),
                h(
                  'span',
                  { class: 'ds-banner__text' },
                  '0 PV: faça testes contra a morte.'
                )
              )
            )
        } else {
          out.push(
            sheetSection(
              'Atual',
              stepper({
                label: f.label,
                value: r.current,
                min: 0,
                max: r.cap ?? 999,
                allowInput: f.allowInput || (r.cap ?? 0) > 20,
                valueText: x =>
                  r.shownMax != null ? `${x} de ${r.shownMax}` : String(x),
                onChange: x => commit([{ id, to: { ...v, current: x } }]),
              })
            )
          )
          const quick = []
          // O verbo vem do template quando o sistema tem o seu ("Perder 1" na Sanidade do CoC).
          if (r.current > 0)
            quick.push(
              h(
                'button',
                {
                  type: 'button',
                  class: 'ds-btn',
                  onclick: () =>
                    commit([{ id, to: { ...v, current: r.current - 1 } }]),
                },
                f.spendLabel ?? 'Gastar 1'
              )
            )
          if (r.cap == null || r.current < r.cap)
            quick.push(
              h(
                'button',
                {
                  type: 'button',
                  class: 'ds-btn',
                  onclick: () =>
                    commit([{ id, to: { ...v, current: r.current + 1 } }]),
                },
                f.gainLabel ?? 'Recuperar 1'
              )
            )
          for (const a of f.actions ?? [])
            quick.push(
              h(
                'button',
                {
                  type: 'button',
                  class: 'ds-btn',
                  disabled: r.current < (a.cost ?? 0) ? true : null,
                  onclick: () => resourceAction(id, a),
                },
                `${a.label}${a.cost ? ` (${a.cost} ${f.shortLabel ?? f.label})` : ''}`
              )
            )
          out.push(h('div', { class: 'p-actions p-sheet-section' }, quick))
        }
      } else if (!S.archived && S.mode !== 'read')
        out.push(
          h('p', { class: 'p-note', text: 'Este recurso muda em Evoluir.' })
        )
      if (r.perTurn)
        out.push(
          h('p', {
            class: 'p-note',
            text: `Gasto máximo por turno: ${r.perTurn}.`,
          })
        )
      if (r.permanent != null && !f.tempUncapped) {
        out.push(
          sheetSection(
            'Permanente',
            S.mode === 'evolve' && canWriteField(m, id)
              ? stepper({
                  label: `${f.label} permanente`,
                  value: r.permanent,
                  min: f.permanent.min,
                  max: f.permanent.max,
                  onChange: x =>
                    setDraft(id, {
                      ...v,
                      permanent: x,
                      current: Math.min(v.current ?? x, x),
                    }),
                })
              : h('p', {
                  class: 'p-note',
                  text: `Permanente ${r.permanent}. Limita o valor atual e só muda em Evoluir.`,
                })
          )
        )
      }
      if (f.max?.stored && S.mode === 'evolve' && canWriteField(m, id))
        out.push(
          sheetSection(
            'Máximo',
            stepper({
              label: `${f.label} máximo`,
              value: r.max,
              min: f.max.min,
              max: f.max.max,
              allowInput: true,
              valueText: x => String(x),
              onChange: x => setDraft(id, { ...v, max: x }),
            })
          )
        )
      if (f.help) out.push(h('p', { class: 'p-note', text: f.help }))
      return out
    })
  }

  function applyHp(id, delta) {
    const m = S.m
    const v = clone(raw(m, id)) ?? {}
    const r = resourceInfo(m, id)
    if (delta < 0) {
      const next = RULES.tempFirst(r, -delta)
      commit([{ id, to: { ...v, ...next } }], {
        label: `${F(m, id).shortLabel} ${r.current}${r.temp ? `+${r.temp}` : ''} → ${next.current}${next.temp ? `+${next.temp}` : ''} (${-delta} de dano)`,
      })
    } else {
      const next = Math.min(r.max ?? 999, r.current + delta)
      commit([{ id, to: { ...v, current: next } }], {
        label: `${F(m, id).shortLabel} ${r.current} → ${next} (cura ${delta})`,
      })
    }
  }

  function resourceAction(id, a) {
    const m = S.m
    const v = clone(raw(m, id))
    const r = resourceInfo(m, id)
    if (a.effect === 'health.heal') {
      const track = a.params.field
      const hi = healthInfo(m, track)
      const type = [...a.params.types].reverse().find(ty => hi.counts[ty] > 0)
      if (!type)
        return announce(
          'Nada a curar com Sangue: só há dano agravado ou nenhum dano.'
        )
      const counts = RULES['wod-stacking'](hi.f, hi.counts, type, 1, true)
      commit(
        [
          { id, to: { ...v, current: r.current - (a.cost ?? 0) } },
          { id: track, to: counts },
        ],
        {
          label: `Curou 1 nível ${hi.f.types.find(t => t.id === type).label.toLowerCase()} (${a.cost} ${F(m, id).shortLabel})`,
        }
      )
    }
  }

  // Vitalidade: uma linha por tipo de dano, no formato do dado guardado (contagem por tipo).
  // + aplica 1 nível e − cura 1 nível daquele tipo; a regra do template (wod-stacking) ordena a
  // trilha e resolve a trilha cheia. Sem stepper de quantidade nem bloco "Curar" separado.
  function openHealth(id) {
    liveSheet(F(S.m, id).label, () => {
      const m = S.m
      const hi = healthInfo(m, id)
      const editable = canEdit(id)
      const statusOf = counts =>
        healthInfo(
          {
            ...m,
            draft: {
              values: { ...vals(m), [id]: counts },
              specialties: specs(m),
            },
          },
          id
        )
      const sayStatus = x =>
        !x.level
          ? 'sem ferimentos'
          : x.penalty == null
            ? x.status
            : `${x.status} ${fmtPenalty(x.penalty)}`
      const change = (ty, to) => {
        const delta = to - hi.counts[ty.id]
        if (!delta) return
        const heal = delta < 0
        const counts = RULES['wod-stacking'](
          hi.f,
          hi.counts,
          ty.id,
          Math.abs(delta),
          heal
        )
        // Trilha cheia com dano igual ou mais grave: nada muda; avisa em vez de gravar evento vazio.
        if (hi.f.types.every(t => counts[t.id] === hi.counts[t.id])) {
          toast(
            `${hi.f.label} cheia: ${ty.label.toLowerCase()} não muda a trilha.`
          )
          S.refreshers.forEach(fn => fn())
          return
        }
        const after = statusOf(counts)
        // Com a trilha cheia o dano novo agrava uma caixa menos grave: o aviso diz o que aconteceu.
        const converted = !heal && counts[ty.id] - hi.counts[ty.id] < delta
        const grown = hi.f.types.find(
          t => t.id !== ty.id && counts[t.id] > hi.counts[t.id]
        )
        const what = heal
          ? `Curou ${plural(-delta, 'nível', 'níveis')} ${ty.label.toLowerCase()}`
          : converted && grown
            ? `Trilha cheia: ${ty.label.toLowerCase()} a mais virou ${grown.label.toLowerCase()}`
            : `+${plural(delta, 'nível', 'níveis')} ${ty.label.toLowerCase()}`
        if (!heal) haptic(ty.id === hi.f.types[0].id ? [20, 40, 20] : 10)
        commit([{ id, to: counts }], { label: `${what} · ${sayStatus(after)}` })
      }
      const rows = [...hi.f.types].reverse().map(ty =>
        h(
          'div',
          { class: 'p-dmg-row' },
          h('span', { class: 'ds-box', 'aria-hidden': 'true', text: ty.glyph }),
          h('span', { class: 'p-dmg-row__label', text: ty.label }),
          editable
            ? stepper({
                label: ty.label,
                value: hi.counts[ty.id],
                min: 0,
                max: hi.f.levels.length,
                inline: true,
                key: `dmg-${ty.id}`,
                valueText: x =>
                  `${plural(x, 'nível', 'níveis')} de dano ${ty.label.toLowerCase()}`,
                onChange: x => change(ty, x),
              })
            : h('span', {
                class: 'ds-row__num',
                text: String(hi.counts[ty.id]),
              })
        )
      )
      return [
        h('p', { class: 'sr-only', text: describe(m, id) }),
        // Número grande só com número (0, −1, −5); "Incapacitado" e o nível vão no texto ao lado.
        h(
          'div',
          { class: 'p-sheet-value', 'aria-hidden': 'true' },
          h('span', {
            class: 'p-sheet-value__big',
            text:
              hi.level && hi.penalty
                ? fmtPenalty(hi.penalty)
                : hi.level && hi.penalty == null
                  ? '—'
                  : '0',
          }),
          h('span', { class: 'p-sheet-value__of', text: hi.status })
        ),
        h('p', {
          class: 'p-note p-center',
          text: 'Penalidade nas paradas de dados',
        }),
        healthTrack(id),
        h(
          'div',
          { class: 'p-dmg', role: 'group', 'aria-label': 'Dano por tipo' },
          rows
        ),
        editable
          ? h('p', {
              class: 'p-note',
              text: '+ aplica 1 nível e − cura 1 nível daquele tipo. O dano mais grave ocupa as primeiras caixas; com a trilha cheia, o dano novo agrava uma caixa menos grave (contusivo a mais vira letal).',
            })
          : null,
      ]
    })
  }

  function openBoxes(id) {
    liveSheet(F(S.m, id).label, () => {
      const m = S.m
      const b = boxesInfo(m, id)
      const editable = canEdit(id)
      return [
        h('p', { class: 'sr-only', text: describe(m, id) }),
        ...b.rows.map(r =>
          sheetSection(
            r.label,
            h(
              'div',
              { class: 'ds-boxes ds-boxes--hit' },
              r.marks.map((x, i) =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'ds-box ds-pressable',
                    'aria-pressed': String(x),
                    disabled: editable ? null : true,
                    'aria-label': `${r.label}, caixa ${i + 1}${r.boxValues ? ` (vale ${r.boxValues[i]})` : ''}`,
                    onclick: () => {
                      const next = clone(
                        raw(m, id) ??
                          Object.fromEntries(
                            b.rows.map(rr => [rr.id, rr.marks])
                          )
                      )
                      next[r.id] = [...r.marks]
                      next[r.id][i] = !x
                      commit([{ id, to: next }], {
                        label: `${F(m, id).label} · ${r.label}: caixa ${i + 1} ${x ? 'desmarcada' : 'marcada'}`,
                      })
                    },
                  },
                  h('span', { text: r.boxValues ? String(r.boxValues[i]) : '' })
                )
              )
            )
          )
        ),
      ]
    })
  }

  function openClock(id) {
    liveSheet(F(S.m, id).label, () => {
      const m = S.m
      const f = F(m, id)
      const c = clockInfo(m, id)
      const editable = canEdit(id)
      const out = [
        h(
          'div',
          { class: 'p-center' },
          clock({
            segments: f.segments,
            size: 200,
            label: describe(m, id),
            fills: c.fills.map(x => ({
              n: x.n,
              from: x.from,
              role: x.colorRole,
            })),
          })
        ),
        h('p', {
          class: 'p-note p-center',
          text: `${c.fills.map(x => `${x.label} ${x.n}`).join(' · ')} · ${c.free} livres`,
        }),
      ]
      for (const x of c.fills) {
        out.push(
          sheetSection(
            x.label,
            editable
              ? stepper({
                  label: x.label,
                  value: x.n,
                  min: 0,
                  max: f.segments,
                  valueText: n => `${n} de ${f.segments} casas`,
                  onChange: n => {
                    const res = RULES[f.rule](f, raw(m, id) ?? {}, x.id, n)
                    if (res.blocked) {
                      toast(res.blocked)
                      S.refreshers.forEach(fn => fn())
                      return
                    }
                    commit([{ id, to: res.next }], {
                      label:
                        res.note ??
                        `${x.label} ${x.n} → ${res.next[x.id] ?? 0}`,
                    })
                  },
                })
              : h('p', { class: 'p-note', text: String(x.n) })
          )
        )
      }
      if (f.help) out.push(h('p', { class: 'p-note', text: f.help }))
      return out
    })
  }

  function stateEffects(id, opt) {
    const m = S.m
    const f = F(m, id)
    const preview = {
      ...m,
      draft: { values: { ...vals(m), [id]: opt.id }, specialties: specs(m) },
    }
    const touchedSet = new Set(
      f.options.flatMap(o => (o.modifiers ?? []).map(x => x.field))
    )
    const touched = Object.keys(m.t.fields).filter(k => touchedSet.has(k))
    return touched
      .map(
        fid =>
          `${F(m, fid).shortLabel ?? F(m, fid).label} ${ratingInfo(preview, fid).eff}`
      )
      .join(' · ')
  }

  function openState(id) {
    let payCost = false
    liveSheet(F(S.m, id).label, () => {
      const m = S.m
      const f = F(m, id)
      const cur = stateOption(m, id)
      const editable = canEdit(id)
      const out = [
        radioGroup(
          f.label,
          f.options.map(o => ({
            id: o.id,
            label: o.label,
            hint: [o.hint, stateEffects(id, o)].filter(Boolean).join(' · '),
          })),
          cur.id,
          optId => {
            if (!editable || optId === cur.id) return
            const changes = [{ id, to: optId }]
            if (payCost && f.cost) {
              const r = resourceInfo(m, f.cost.resource)
              if (r.current < f.cost.amount)
                return announce(`Sem ${F(m, f.cost.resource).label} suficiente`)
              changes.push({
                id: f.cost.resource,
                to: {
                  ...raw(m, f.cost.resource),
                  current: r.current - f.cost.amount,
                },
              })
            }
            const next = f.options.find(o => o.id === optId)
            commit(changes, {
              label: `${f.label}: ${next.label}${payCost ? ` (gastou ${f.cost.amount} ${F(m, f.cost.resource).label})` : ''}`,
            })
          }
        ),
      ]
      if (f.cost && editable) {
        out.push(
          h(
            'button',
            {
              type: 'button',
              role: 'checkbox',
              class: 'p-toggle',
              'aria-checked': String(payCost),
              onclick: () => {
                payCost = !payCost
                S.refreshers.forEach(fn => fn())
              },
            },
            f.cost.label
          )
        )
      }
      if (cur.note) out.push(h('p', { class: 'p-note', text: cur.note }))
      out.push(
        h('p', {
          class: 'p-note',
          text: 'Os valores efetivos já aparecem na grade de atributos e na parada de dados, com a origem do modificador.',
        })
      )
      if (!editable)
        out.push(h('p', { class: 'p-note', text: 'Somente leitura.' }))
      return out
    })
  }

  function openSlots(id) {
    liveSheet(F(S.m, id).label, () => {
      const m = S.m
      const s = slotsInfo(m, id)
      const v = clone(raw(m, id)) ?? {}
      const editable = canEdit(id)
      return [
        h('p', { class: 'sr-only', text: describe(m, id) }),
        ...s.levels.map(l =>
          sheetSection(
            `${l.label} nível · ${l.max - l.used} de ${l.max}`,
            h(
              'div',
              { class: 'ds-boxes ds-boxes--hit' },
              Array.from({ length: l.max }, (_, i) => {
                const available = i < l.max - l.used
                return h(
                  'button',
                  {
                    type: 'button',
                    class: 'ds-box ds-pressable',
                    'aria-pressed': String(available),
                    disabled: editable ? null : true,
                    'aria-label': `${l.label} nível, espaço ${i + 1}, ${available ? 'disponível' : 'usado'}`,
                    onclick: () => {
                      const used = available ? l.used + 1 : l.used - 1
                      commit(
                        [{ id, to: { ...v, [l.n]: { ...v[l.n], used } } }],
                        {
                          label: `Espaço de ${l.label} nível ${available ? 'usado' : 'recuperado'} (${l.max - used}/${l.max})`,
                        }
                      )
                    },
                  },
                  h('span')
                )
              })
            )
          )
        ),
        editable &&
          h(
            'div',
            { class: 'p-actions p-sheet-section' },
            h(
              'button',
              {
                type: 'button',
                class: 'ds-btn',
                onclick: () =>
                  commit(
                    [
                      {
                        id,
                        to: Object.fromEntries(
                          Object.entries(v).map(([k, x]) => [
                            k,
                            { ...x, used: 0 },
                          ])
                        ),
                      },
                    ],
                    { label: 'Espaços de magia recuperados' }
                  ),
              },
              'Recuperar todos'
            )
          ),
      ]
    })
  }

  function openTags(id) {
    liveSheet(F(S.m, id).label, () => {
      const m = S.m
      const f = F(m, id)
      const sel = raw(m, id) ?? []
      const editable = canEdit(id)
      return [
        h(
          'div',
          { class: 'ds-list-item__chips' },
          f.options.map(o =>
            h(
              'button',
              {
                type: 'button',
                class: 'ds-tag ds-pressable',
                'aria-pressed': String(sel.includes(o.id)),
                disabled: editable ? null : true,
                onclick: () =>
                  commit([
                    {
                      id,
                      to: sel.includes(o.id)
                        ? sel.filter(x => x !== o.id)
                        : [...sel, o.id],
                    },
                  ]),
              },
              o.label,
              o.roll
                ? h(
                    'span',
                    { class: 'sr-only' },
                    `, ${o.roll === 'advantage' ? 'vantagem' : 'desvantagem'} nas rolagens`
                  )
                : null
            )
          )
        ),
        f.options.some(o => o.roll)
          ? h('p', {
              class: 'p-note',
              text: 'Condições com efeito na rolagem aparecem como modificador na parada, com a origem.',
            })
          : null,
      ]
    })
  }

  function openListEditor(id) {
    const m = S.m
    const f = F(m, id)
    const items = listItems(m, id)
    const editable = canEdit(id)
    const caption = it =>
      [it.label ?? f.itemLabel, it.meta].filter(Boolean).join(' · ')
    // Em leitura, texto (não input desabilitado): o leitor de tela lê o conteúdo, sem "indisponível".
    if (!editable) {
      sheet({
        title: f.label,
        body: h(
          'dl',
          { class: 'ds-facts ds-facts--wide' },
          items.map(it =>
            h(
              'div',
              {},
              h('dt', { text: caption(it) }),
              h('dd', { text: it.text || '—' })
            )
          )
        ),
      })
      return
    }
    const inputs = items.map(it =>
      h('input', {
        class: 'ds-input',
        type: 'text',
        maxlength: '200',
        value: it.text ?? '',
      })
    )
    const body = h(
      'div',
      {},
      items.map((it, i) =>
        h(
          'label',
          { class: 'ds-field' },
          h('span', { class: 'ds-field__label', text: caption(it) }),
          inputs[i]
        )
      )
    )
    const save = h(
      'button',
      { type: 'button', class: 'ds-btn ds-btn--primary' },
      'Salvar'
    )
    const s = sheet({ title: f.label, body, footer: [save] })
    save.addEventListener('click', () => {
      s.close()
      commit([
        {
          id,
          to: items.map((it, i) => ({
            id: it.id,
            text: inputs[i].value.trim(),
          })),
        },
      ])
    })
  }

  function openListItem(id, itemId) {
    liveSheet(F(S.m, id).itemLabel, () => {
      const m = S.m
      const f = F(m, id)
      const items = listItems(m, id)
      const it = items.find(x => x.id === itemId)
      if (!it) return [h('p', { text: 'Item removido.' })]
      const out = [h('h3', { class: 't-title', text: it.name })]
      if (typeof it.value === 'number') {
        const max = f.item.value.max ?? 5
        out.push(
          bigValue(it.value, max),
          h(
            'div',
            { class: 'p-center' },
            pips([
              { kind: 'on', n: it.value },
              { kind: 'off', n: max - it.value },
            ])
          )
        )
        if (S.mode === 'evolve' && canWriteField(m, id)) {
          out.push(
            sheetSection(
              'Valor',
              stepper({
                label: it.name,
                value: it.value,
                min: f.item.value.min ?? 0,
                max,
                onChange: x =>
                  setDraft(
                    id,
                    items.map(y => (y.id === itemId ? { ...y, value: x } : y))
                  ),
              })
            )
          )
        }
      }
      for (const mm of f.item?.meta ?? [])
        if (it.meta?.[mm.id] != null)
          out.push(
            h(
              'div',
              { class: 'p-kv' },
              h('span', { text: mm.label }),
              h('b', {
                text:
                  mm.display === 'signed'
                    ? fmtSigned(it.meta[mm.id])
                    : String(it.meta[mm.id]),
              })
            )
          )
      if (it.specialty)
        out.push(
          h('p', { class: 'p-note', text: `Especialização: ${it.specialty}` })
        )
      out.push(
        sheetSection(
          'Notas do jogador',
          h('p', {
            text:
              it.notes ||
              'Sem notas. A descrição do poder é escrita pela mesa: o app não embute textos protegidos.',
          })
        )
      )
      const actions = []
      const slot = rollSlotFor(id)
      if (
        slot &&
        (typeof it.value === 'number' || typeof it.meta?.bonus === 'number')
      )
        actions.push(
          h(
            'button',
            {
              type: 'button',
              class: 'ds-btn ds-btn--primary',
              onclick: () => openDice({ [slot.id]: `${id}:${itemId}` }),
            },
            icon('dice'),
            'Montar parada'
          )
        )
      if (S.mode === 'evolve' && canWriteField(m, id)) {
        actions.push(
          h(
            'button',
            {
              type: 'button',
              class: 'ds-btn',
              onclick: () => {
                setDraft(
                  id,
                  items.filter(y => y.id !== itemId)
                )
                toast(`${it.name} removido`, {
                  undo: () => setDraft(id, items),
                })
              },
            },
            icon('trash'),
            'Remover'
          )
        )
      } else if (S.mode === 'play' && canWriteField(m, id) && !S.archived) {
        actions.push(
          h(
            'button',
            {
              type: 'button',
              class: 'ds-btn',
              onclick: () => enterEvolve(null),
            },
            icon('edit'),
            'Alterar em Evoluir'
          )
        )
      }
      if (actions.length)
        out.push(h('div', { class: 'p-actions p-sheet-section' }, actions))
      return out
    })
  }

  function openAddItem(id) {
    const m = S.m
    const f = F(m, id)
    const existing = new Set(listItems(m, id).map(x => fold(x.name)))
    const search = h('input', {
      class: 'ds-search',
      type: 'search',
      placeholder: `Buscar ou digitar ${f.itemLabel.toLowerCase()}`,
      'aria-label': `Nome do(a) ${f.itemLabel.toLowerCase()}`,
    })
    const list = h('ul', { class: 'ds-rows' })
    const add = name => {
      const item = {
        id: uid(),
        name,
        ...(f.item?.value ? { value: f.item.value.min ?? 0 } : {}),
      }
      s.close()
      if (S.mode !== 'evolve') enterEvolve(null, true)
      setDraft(id, [...listItems(S.m, id), item])
      toast(`${name} adicionado`)
    }
    const fill = () => {
      const q = fold(search.value)
      const opts = (f.catalog ?? []).filter(
        c => !existing.has(fold(c)) && fold(c).includes(q)
      )
      list.replaceChildren(
        ...opts.map(c =>
          h(
            'li',
            {},
            h(
              'button',
              {
                type: 'button',
                class: 'ds-row ds-pressable',
                onclick: () => add(c),
              },
              h('span', { class: 'ds-row__label', text: c })
            )
          )
        ),
        search.value.trim()
          ? h(
              'li',
              {},
              h(
                'button',
                {
                  type: 'button',
                  class: 'ds-row ds-pressable',
                  onclick: () => add(search.value.trim().slice(0, 80)),
                },
                h(
                  'span',
                  { class: 'ds-row__label' },
                  `Adicionar "${search.value.trim().slice(0, 80)}"`
                )
              )
            )
          : null
      )
    }
    search.addEventListener('input', fill)
    fill()
    const s = sheet({
      title: `Adicionar ${f.itemLabel.toLowerCase()}`,
      body: h('div', {}, search, list),
      initialFocus: () => search,
    })
  }

  function openTextEditor(id) {
    const m = S.m
    const f = F(m, id)
    const multi = f.type === 'longText'
    const input = h(multi ? 'textarea' : 'input', {
      class: multi ? 'ds-textarea' : 'ds-input',
      id: `txt-${id}`,
      maxlength: String(f.maxLength ?? 200),
      'aria-describedby': `count-${id}`,
    })
    input.value = raw(m, id) ?? ''
    // Contador fora do <label> (não entra no nome do campo) e sem live region a cada tecla: ele é
    // lido junto com o campo (aria-describedby) e só é anunciado perto do limite.
    const max = f.maxLength ?? 200
    const count = h('span', { class: 'ds-field__help', id: `count-${id}` })
    let warned = false
    const updateCount = () => {
      count.textContent = `${input.value.length} de ${max} caracteres`
      const near = input.value.length >= max * 0.9
      if (near && !warned)
        announce(`Faltam ${max - input.value.length} caracteres`)
      warned = near
    }
    input.addEventListener('input', updateCount)
    updateCount()
    const save = h(
      'button',
      { type: 'button', class: 'ds-btn ds-btn--primary' },
      'Salvar'
    )
    const cancel = h('button', { type: 'button', class: 'ds-btn' }, 'Cancelar')
    const s = sheet({
      title: f.label,
      body: h(
        'div',
        { class: 'ds-field' },
        h('label', {
          class: 'ds-field__label',
          for: `txt-${id}`,
          text: f.label,
        }),
        input,
        count
      ),
      footer: [cancel, save],
      initialFocus: () => input,
    })
    cancel.addEventListener('click', s.close)
    save.addEventListener('click', () => {
      s.close()
      const v = input.value.slice(0, f.maxLength ?? 200)
      if (v === (raw(m, id) ?? '')) return
      if (S.mode === 'evolve') setDraft(id, v)
      else commit([{ id, to: v }])
    })
  }

  function openAllResources() {
    liveSheet('Todos os recursos', () => {
      const m = S.m
      return h(
        'ul',
        { class: 'ds-rows' },
        playFieldIds().map(id =>
          h(
            'li',
            {},
            h(
              'button',
              {
                type: 'button',
                class: 'ds-row ds-pressable',
                'aria-label': describe(m, id),
                'aria-haspopup': 'dialog',
                onclick: () => openFieldSheet(id),
              },
              h('span', { class: 'ds-row__label', text: F(m, id).label }),
              h('span', { class: 'ds-row__num', text: shortValue(m, id) })
            )
          )
        )
      )
    })
  }

  // ---------- Modo Evoluir: rascunho com resumo "N alterações" ----------

  function enterEvolve(focusId, silent = false) {
    if (!canWriteField(S.m, S.m.t.identity.name)) return
    S.m.draft = {
      values: clone(S.m.state.values),
      specialties: clone(S.m.state.specialties),
    }
    S.mode = 'evolve'
    if (!silent) {
      render()
      announce(
        'Modo Evoluir. Use − e + em cada linha. Concluir mostra o resumo antes de salvar.'
      )
      if (focusId) openEditor(focusId)
    }
  }

  function setDraft(id, value) {
    if (!S.m.draft) enterEvolve(null, true)
    S.m.draft.values[id] = clone(value)
    render()
  }

  function setDraftSpecialty(id, value) {
    if (value) S.m.draft.specialties[id] = value
    else delete S.m.draft.specialties[id]
    render()
  }

  function draftChanges() {
    const m = S.m
    if (!m.draft) return []
    const out = []
    const ids = new Set([
      ...Object.keys(m.draft.values),
      ...Object.keys(m.state.values),
    ])
    for (const id of ids)
      if (
        JSON.stringify(m.draft.values[id]) !==
        JSON.stringify(m.state.values[id])
      )
        out.push({ id, from: m.state.values[id], to: m.draft.values[id] })
    for (const id of new Set([
      ...Object.keys(m.draft.specialties),
      ...Object.keys(m.state.specialties),
    ]))
      if (m.draft.specialties[id] !== m.state.specialties[id])
        out.push({
          id,
          spec: true,
          from: m.state.specialties[id],
          to: m.draft.specialties[id],
        })
    return out
  }

  function describeChange(c) {
    const f = F(S.m, c.id)
    if (c.spec)
      return [
        `${f.label} · especialização`,
        `${c.from || '—'} → ${c.to || '—'}`,
      ]
    if (['rating', 'number', 'percent'].includes(f.type))
      return [f.label, `${c.from ?? f.default ?? f.min ?? 0} → ${c.to}`]
    if (f.type === 'resource')
      return [
        f.label,
        `${c.from?.permanent ?? c.from?.current ?? '—'} → ${c.to?.permanent ?? c.to?.current ?? '—'}`,
      ]
    if (f.type === 'list')
      return [
        f.label,
        `${(c.from ?? []).length} → ${(c.to ?? []).length} itens`,
      ]
    if (f.type === 'mark' || f.type === 'choice') return [f.label, 'alterado']
    return [f.label, 'alterado']
  }

  function finishEvolve() {
    const changes = draftChanges()
    if (!changes.length) {
      S.m.draft = null
      S.mode = 'play'
      render()
      announce('Modo Jogo')
      return
    }
    const save = h(
      'button',
      { type: 'button', class: 'ds-btn ds-btn--primary' },
      'Salvar'
    )
    const discard = h(
      'button',
      { type: 'button', class: 'ds-btn' },
      'Descartar'
    )
    const s = sheet({
      title: plural(changes.length, 'alteração', 'alterações'),
      body: h(
        'ul',
        { class: 'p-changes' },
        changes.map(c => {
          const [a, b] = describeChange(c)
          return h('li', {}, h('span', { text: a }), h('b', { text: b }))
        })
      ),
      footer: [discard, save],
    })
    discard.addEventListener('click', () => {
      s.close()
      S.m.draft = null
      S.mode = 'play'
      render()
      toast('Alterações descartadas')
    })
    save.addEventListener('click', () => {
      s.close()
      const draft = S.m.draft
      S.m.draft = null
      S.mode = 'play'
      S.m.state.specialties = draft.specialties
      const valueChanges = changes
        .filter(c => !c.spec)
        .map(c => ({ id: c.id, to: draft.values[c.id] }))
      if (valueChanges.length)
        commit(valueChanges, {
          label: `Evolução salva: ${plural(changes.length, 'alteração', 'alterações')}`,
        })
      else {
        persist()
        render()
        toast('Especializações salvas')
      }
    })
  }

  // ---------- Parada de dados: casca única, mecânica pelo roll.model ----------

  function rollValue(m, id) {
    const f = F(m, id)
    switch (f.type) {
      case 'rating':
        return ratingInfo(m, id).eff
      case 'number':
        return f.display === 'score+mod'
          ? derive(f.derive, numberValue(m, id))
          : f.display === 'plain' || !f.display
            ? null
            : numberValue(m, id)
      case 'percent':
        return percentValue(m, id)
      case 'mark':
        return markInfo(m, id).bonus
      case 'resource': {
        const r = resourceInfo(m, id)
        return r.permanent ?? r.current
      }
      default:
        return null
    }
  }

  function rollOptions(slot) {
    const m = S.m
    const out = []
    for (const secId of slot.from) {
      const sec = m.t.sections.find(s => s.id === secId)
      if (!sec || !canReadSection(m, sec)) continue
      const ids = [
        ...(sec.fields ?? []),
        ...(sec.groups ?? []).flatMap(g => g.fields),
      ]
      for (const id of ids) {
        const f = F(m, id)
        if (f.type === 'list') {
          for (const it of listItems(m, id)) {
            const value =
              typeof it.value === 'number'
                ? it.value
                : typeof it.meta?.bonus === 'number'
                  ? it.meta.bonus
                  : null
            if (value != null)
              out.push({
                key: `${id}:${it.id}`,
                label: it.name,
                value,
                spec: it.specialty,
                group: f.label,
              })
          }
        } else {
          const value = rollValue(m, id)
          if (value != null)
            out.push({
              key: id,
              label: f.label,
              value,
              spec: specs(m)[id],
              group: sec.title,
              mod: f.type === 'rating' ? modText(ratingInfo(m, id)) : null,
            })
        }
      }
    }
    return out
  }

  function optionByKey(key) {
    if (typeof key !== 'string' || !key) return null
    const m = S.m
    // A chave pode vir do localStorage (última parada): só campos existentes e de seção legível.
    const fieldId = key.split(':')[0]
    if (!Object.hasOwn(m.t.fields, fieldId)) return null
    const sec = sectionOf(m, fieldId)
    if (sec && !canReadSection(m, sec)) return null
    if (key.includes(':')) {
      const [fid, iid] = key.split(':')
      if (F(m, fid).type !== 'list') return null
      const it = listItems(m, fid).find(x => x.id === iid)
      return it
        ? {
            key,
            label: it.name,
            value:
              typeof it.value === 'number' ? it.value : (it.meta?.bonus ?? 0),
            spec: it.specialty,
          }
        : null
    }
    if (!m.t.fields[key]) return null
    return {
      key,
      label: F(m, key).label,
      value: rollValue(m, key) ?? 0,
      spec: specs(m)[key],
      mod: F(m, key).type === 'rating' ? modText(ratingInfo(m, key)) : null,
    }
  }

  const ROLLERS = {
    'pool-success': (R, ctx) => {
      const faces = Array.from({ length: ctx.dice }, () =>
        die(ctx.roll.die ?? 10)
      )
      const hits =
        faces.filter(x => x >= R.diff).length +
        (R.spec ? faces.filter(x => x === 10).length : 0)
      const ones = faces.filter(x => x === 1).length
      const total = Math.max(0, hits - ones) + ctx.auto
      const outcome =
        total > 0
          ? plural(total, 'sucesso', 'sucessos')
          : hits === 0 && ones > 0 && ctx.auto === 0
            ? 'Falha crítica'
            : 'Falha'
      return {
        faces: faces.map(x => ({
          text: String(x),
          cls: x === 1 ? 'is-one' : x >= R.diff ? 'is-success' : '',
        })),
        outcome,
        total,
      }
    },
    'sum-vs-target': (R, ctx) => {
      const rolls = ctx.adv === 'normal' ? [die(20)] : [die(20), die(20)]
      const kept =
        ctx.adv === 'advantage'
          ? Math.max(...rolls)
          : ctx.adv === 'disadvantage'
            ? Math.min(...rolls)
            : rolls[0]
      let dropped = false
      const total = kept + ctx.mod
      const nat =
        kept === 20 ? ' · 20 natural' : kept === 1 ? ' · 1 natural' : ''
      return {
        faces: rolls.map(x => {
          const isKept = x === kept && !dropped
          if (isKept) dropped = true
          return {
            text: String(x),
            cls: isKept
              ? x === 20
                ? 'is-success'
                : x === 1
                  ? 'is-one'
                  : ''
              : 'is-dropped',
          }
        }),
        outcome: `${total} (${kept} ${ctx.mod >= 0 ? '+' : MINUS} ${Math.abs(ctx.mod)}) · ${total >= R.target ? 'sucesso' : 'falha'} contra ${ctx.roll.target.label} ${R.target}${nat}`,
        total,
      }
    },
    'roll-under-percent': (R, ctx) => {
      const units = die(10) - 1
      const tens = Array.from(
        { length: 1 + Math.abs(R.bonus) },
        () => (die(10) - 1) * 10
      )
      const totals = tens.map(t => (t + units === 0 ? 100 : t + units))
      const result =
        R.bonus > 0
          ? Math.min(...totals)
          : R.bonus < 0
            ? Math.max(...totals)
            : totals[0]
      return {
        faces: [
          ...tens.map(t => ({ text: String(t).padStart(2, '0'), cls: '' })),
          { text: String(units), cls: '' },
        ],
        outcome: `${result} · ${percentLevel(result, ctx.value)}`,
        total: result,
      }
    },
    fudge: (R, ctx) => {
      const faces = Array.from({ length: 4 }, () => die(3) - 2)
      const sum = faces.reduce((a, b) => a + b, 0)
      const total = ctx.value + sum + ctx.boost
      const ladder = S.m.t.ladders[ctx.roll.ladder]
      const shifts = total - R.target
      return {
        faces: faces.map(x => ({
          text: x > 0 ? '+' : x < 0 ? MINUS : '0',
          cls: x > 0 ? 'is-success' : x < 0 ? 'is-one' : '',
        })),
        // 3 ou mais tensões é "sucesso com estilo" no Fate Básico.
        outcome: `${fmtSigned(total)} ${ladder[total] ?? ''} · ${shifts >= 3 ? `sucesso com estilo (${plural(shifts, 'tensão', 'tensões')})` : shifts > 0 ? `sucesso com ${plural(shifts, 'tensão', 'tensões')}` : shifts === 0 ? 'empate' : 'falha'}`,
        total,
      }
    },
    'pbta-2d6': (R, ctx) => {
      const faces = [die(6), die(6)]
      const total = faces[0] + faces[1] + ctx.mod
      return {
        faces: faces.map(x => ({ text: String(x), cls: '' })),
        outcome: `${total} · ${total >= 10 ? 'sucesso pleno' : total >= 7 ? 'sucesso com custo' : 'falha'}`,
        total,
      }
    },
  }

  function percentLevel(r, v) {
    if (r === 1) return 'crítico'
    if (r === 100 || (v < 50 && r >= 96)) return 'desastre'
    if (r <= derive('fifth', v)) return 'sucesso extremo'
    if (r <= derive('half', v)) return 'sucesso difícil'
    if (r <= v) return 'sucesso regular'
    return 'fracasso'
  }

  function openDice(prefill = {}) {
    const m = S.m
    const roll = m.t.roll
    const last = S.ui.lastRoll
    const R = {
      sel: Object.keys(prefill).length
        ? { ...prefill }
        : { ...(last?.sel ?? {}) },
      diff: roll.difficulty?.default ?? 6,
      spec: false,
      boosts: {},
      adv: 'auto',
      bonus: 0,
      target: roll.target?.default ?? 0,
      result: null,
      manual: false,
      manualValue: null,
      openSlot: null,
    }
    for (const sl of roll.slots)
      if (R.sel[sl.id] && !optionByKey(R.sel[sl.id])) delete R.sel[sl.id]

    const ctxOf = () => {
      const chosen = roll.slots.map(sl => ({
        slot: sl,
        opt: optionByKey(R.sel[sl.id]),
      }))
      const mods = []
      for (const c of chosen)
        if (c.opt?.mod) mods.push([c.opt.label, c.opt.mod])
      let penalty = 0
      let incapacitated = false
      if (roll.penalty?.field) {
        const hi = healthInfo(m, roll.penalty.field)
        if (hi.level?.penalty == null && hi.level) incapacitated = true
        else if (hi.penalty) {
          penalty = hi.penalty
          mods.push([
            `Ferimento (${hi.status})`,
            `${fmtSigned(penalty)} ${Math.abs(penalty) === 1 ? 'dado' : 'dados'}`,
          ])
        }
      }
      const conds = roll.conditions
        ? (raw(m, roll.conditions.field) ?? [])
            .map(x => F(m, roll.conditions.field).options.find(o => o.id === x))
            .filter(o => o?.roll)
        : []
      for (const c of conds)
        mods.push([
          c.label,
          c.roll === 'advantage' ? 'vantagem' : 'desvantagem',
        ])
      const autoAdv = conds.some(c => c.roll === 'advantage')
      const autoDis = conds.some(c => c.roll === 'disadvantage')
      const adv =
        R.adv !== 'auto'
          ? R.adv
          : autoAdv && !autoDis
            ? 'advantage'
            : autoDis && !autoAdv
              ? 'disadvantage'
              : 'normal'
      const base = chosen.reduce((s, c) => s + (c.opt?.value ?? 0), 0)
      const boostOn = (roll.boosts ?? []).filter(b => R.boosts[b.id])
      return {
        roll,
        chosen,
        mods,
        penalty,
        incapacitated,
        adv,
        dice: Math.max(0, base + penalty),
        mod: base,
        value: base,
        auto: boostOn.filter(b => b.effect === 'autoSuccess').length,
        boost: boostOn.filter(b => b.effect === 'plus2').length * 2,
        ready:
          chosen.every(c => c.opt || c.slot.optional) &&
          chosen.some(c => c.opt),
        hasSpec: chosen.some(c => c.opt?.spec),
      }
    }

    const picker = sl => {
      const opts = rollOptions(sl)
      const search = h('input', {
        class: 'ds-search',
        type: 'search',
        placeholder: `Buscar ${sl.label.toLowerCase()}`,
        'aria-label': `Buscar ${sl.label.toLowerCase()}`,
      })
      const list = h('ul', { class: 'ds-rows' })
      const fill = () => {
        const q = fold(search.value)
        list.replaceChildren(
          ...opts
            .filter(o => fold(o.label).includes(q))
            .map(o =>
              h(
                'li',
                {},
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'ds-row ds-pressable',
                    'aria-label': `${o.label}, ${o.value}${o.spec ? `, especialização ${o.spec}` : ''}`,
                    onclick: () => {
                      R.sel[sl.id] = o.key
                      R.openSlot = null
                      R.result = null
                      refreshBody(`pick-${sl.id}`)
                    },
                  },
                  h(
                    'span',
                    { class: 'ds-row__text' },
                    h('span', { class: 'ds-row__label', text: o.label }),
                    h('span', { class: 'ds-row__sub', text: o.group })
                  ),
                  h('span', {
                    class: 'ds-row__num',
                    text:
                      m.t.roll.model === 'sum-vs-target'
                        ? fmtSigned(o.value)
                        : String(o.value),
                  })
                )
              )
            )
        )
      }
      search.addEventListener('input', fill)
      fill()
      requestAnimationFrame(() => search.focus())
      return h('div', { class: 'p-picker' }, search, list)
    }

    const bodyWrap = h('div', {})
    const FOCUSABLE = 'button, input, textarea, [tabindex]'
    // O corpo é refeito a cada escolha; o foco volta ao mesmo controle (data-key ou posição),
    // ou ao controle indicado (ex.: o seletor do slot depois de escolher a opção).
    const refreshBody = focusKey => {
      const active = document.activeElement
      const inside = bodyWrap.contains(active)
      const key =
        typeof focusKey === 'string'
          ? focusKey
          : inside
            ? active.closest('[data-key]')?.dataset.key
            : null
      const index = inside
        ? [...bodyWrap.querySelectorAll(FOCUSABLE)].indexOf(active)
        : -1
      buildBody()
      if (!inside && typeof focusKey !== 'string') return
      const target =
        (key && bodyWrap.querySelector(`[data-key="${CSS.escape(key)}"]`)) ||
        bodyWrap.querySelectorAll(FOCUSABLE)[index]
      target?.focus({ preventScroll: true })
    }
    const buildBody = () => {
      const ctx = ctxOf()
      const out = []
      const quick = []
      ;(roll.presets ?? []).forEach((p, i) =>
        quick.push(
          h(
            'button',
            {
              type: 'button',
              class: 'ds-chip ds-pressable',
              'data-key': `preset-${i}`,
              onclick: () => {
                R.sel = { ...p.slots }
                R.result = null
                refreshBody()
              },
            },
            p.label
          )
        )
      )
      if (last?.label && !Object.keys(prefill).length)
        quick.push(
          h(
            'button',
            {
              type: 'button',
              class: 'ds-chip ds-pressable',
              'data-key': 'preset-last',
              onclick: () => {
                R.sel = { ...last.sel }
                R.result = null
                refreshBody()
              },
            },
            `Última: ${last.label}`
          )
        )
      if (quick.length)
        out.push(h('div', { class: 'ds-list-item__chips' }, quick))
      const preset = (roll.presets ?? []).find(p =>
        Object.entries(p.slots).every(([k, v]) => R.sel[k] === v)
      )
      if (preset?.help) out.push(h('p', { class: 'p-note', text: preset.help }))

      for (const c of ctx.chosen) {
        const sl = c.slot
        out.push(
          h(
            'button',
            {
              type: 'button',
              class: 'p-pick ds-pressable',
              'data-key': `pick-${sl.id}`,
              'aria-expanded': String(R.openSlot === sl.id),
              onclick: () => {
                R.openSlot = R.openSlot === sl.id ? null : sl.id
                refreshBody()
              },
            },
            h(
              'span',
              {},
              h('span', {
                class: 'p-pick__label',
                text: `${sl.label}${sl.optional ? ' (opcional)' : ''}`,
              }),
              h('br'),
              h('span', {
                class: 'p-pick__value',
                text: c.opt
                  ? `${c.opt.label} ${roll.model === 'sum-vs-target' ? fmtSigned(c.opt.value) : c.opt.value}`
                  : 'Escolher',
              })
            ),
            icon(R.openSlot === sl.id ? 'chevronUp' : 'chevronDown')
          )
        )
        if (R.openSlot === sl.id) out.push(picker(sl))
      }

      if (roll.model === 'pool-success') {
        out.push(
          sheetSection(
            'Dificuldade',
            stepper({
              label: 'Dificuldade',
              value: R.diff,
              min: roll.difficulty.min,
              max: roll.difficulty.max,
              valueText: v => `dificuldade ${v}`,
              onChange: v => {
                R.diff = v
                R.result = null
                refreshTotals()
              },
            })
          )
        )
        if (ctx.hasSpec && roll.specialty)
          out.push(
            toggle(
              'Usar especialização: cada 10 vale dois sucessos',
              R.spec,
              v => {
                R.spec = v
                R.result = null
              }
            )
          )
      }
      if (roll.model === 'sum-vs-target') {
        const seg = segRadio(
          'Vantagem',
          [
            ['auto', 'Automático'],
            ['normal', 'Normal'],
            ['advantage', 'Vantagem'],
            ['disadvantage', 'Desvantagem'],
          ],
          R.adv,
          id => {
            R.adv = id
            R.result = null
            refreshBody()
          },
          'adv'
        )
        out.push(sheetSection('Rolagem', seg))
        out.push(
          sheetSection(
            roll.target.label,
            stepper({
              label: roll.target.label,
              value: R.target,
              min: roll.target.min,
              max: roll.target.max,
              valueText: v => `${roll.target.label} ${v}`,
              onChange: v => {
                R.target = v
                R.result = null
                refreshTotals()
              },
            })
          )
        )
      }
      if (roll.model === 'roll-under-percent') {
        out.push(
          sheetSection(
            'Dados de bônus e penalidade',
            stepper({
              label: 'Dados de bônus (positivo) ou penalidade (negativo)',
              value: R.bonus,
              min: roll.bonusDice.min,
              max: roll.bonusDice.max,
              valueText: v =>
                v > 0
                  ? `${v} de bônus`
                  : v < 0
                    ? `${-v} de penalidade`
                    : 'nenhum',
              onChange: v => {
                R.bonus = v
                R.result = null
                refreshTotals()
              },
            })
          )
        )
      }
      if (roll.model === 'fudge') {
        out.push(
          sheetSection(
            roll.target.label,
            stepper({
              label: roll.target.label,
              value: R.target,
              min: roll.target.min,
              max: roll.target.max,
              valueText: v =>
                `${fmtSigned(v)} ${m.t.ladders[roll.ladder][v] ?? ''}`,
              onChange: v => {
                R.target = v
                R.result = null
                refreshTotals()
              },
            })
          )
        )
      }
      for (const b of roll.boosts ?? []) {
        const r = resourceInfo(m, b.resource)
        out.push(
          toggle(
            `${b.label} (${plural(r.current, 'disponível', 'disponíveis')})`,
            !!R.boosts[b.id],
            v => {
              R.boosts[b.id] = v
              R.result = null
            },
            r.current < b.cost || !canEdit(b.resource)
          )
        )
      }
      out.push((totalsNode = totals(ctx)))
      if (R.manual) out.push(manualEntry(ctx))
      if (R.result) out.push(resultNode(R.result))
      out.push(
        h('p', {
          class: 'p-note',
          text: 'No app, rolagens que valem para a mesa são feitas no servidor. Rolagens locais usam crypto.getRandomValues. Dados físicos são primeira classe: use "Rolei na mão".',
        })
      )
      bodyWrap.replaceChildren(...out.filter(Boolean))
      rollBtn.disabled = !ctx.ready || ctx.incapacitated
      manualBtn.disabled = !ctx.ready
    }
    let totalsNode
    const refreshTotals = () => {
      const n = totals(ctxOf())
      totalsNode.replaceWith(n)
      totalsNode = n
    }

    const toggle = (label, on, set, disabled = false) =>
      h(
        'button',
        {
          type: 'button',
          role: 'checkbox',
          class: 'p-toggle',
          'data-key': `toggle-${label}`,
          'aria-checked': String(on),
          disabled: disabled ? true : null,
          onclick: () => {
            set(!on)
            refreshBody()
          },
        },
        label
      )

    const totals = ctx => {
      const mods = h(
        'ul',
        { class: 'p-mods' },
        ctx.mods.map(([a, b]) =>
          h('li', {}, h('span', { text: a }), h('b', { text: b }))
        )
      )
      let line
      if (roll.model === 'pool-success')
        line = ctx.incapacitated
          ? 'Incapacitado: não rola'
          : `${plural(ctx.dice, 'dado', 'dados')} · dificuldade ${R.diff}${ctx.auto ? ` · +${ctx.auto} automático` : ''}`
      else if (roll.model === 'sum-vs-target')
        line = `${roll.dice} ${fmtSigned(ctx.mod)}${ctx.adv !== 'normal' ? ` · ${ctx.adv === 'advantage' ? 'vantagem' : 'desvantagem'}` : ''}`
      else if (roll.model === 'roll-under-percent')
        line = `d100 ≤ ${ctx.value} · difícil ${derive('half', ctx.value)} · extremo ${derive('fifth', ctx.value)}`
      else if (roll.model === 'fudge')
        line = `${roll.dice} ${fmtSigned(ctx.value + ctx.boost)} contra ${fmtSigned(R.target)}`
      else line = `2d6 ${fmtSigned(ctx.mod)}`
      return h(
        'div',
        {},
        ctx.mods.length
          ? sheetSection('Modificadores (com origem)', mods)
          : null,
        h(
          'div',
          { class: 'p-total' },
          h('span', {}, 'Parada'),
          h('strong', { text: line })
        )
      )
    }

    const manualEntry = ctx => {
      const spec = {
        'pool-success': [
          'Sucessos obtidos',
          0,
          Math.max(ctx.dice * 2, 1) + ctx.auto,
        ],
        'sum-vs-target': ['Resultado do d20', 1, 20],
        'roll-under-percent': ['Resultado do d100', 1, 100],
        fudge: ['Soma dos dados Fate', -4, 4],
        'pbta-2d6': ['Soma dos 2d6', 2, 12],
      }[roll.model]
      if (R.manualValue == null) R.manualValue = spec[1]
      return sheetSection(
        'Rolei na mão',
        stepper({
          label: spec[0],
          value: R.manualValue,
          min: spec[1],
          max: spec[2],
          allowInput: true,
          valueText: v => String(v),
          onChange: v => {
            R.manualValue = v
          },
        }),
        h(
          'div',
          { class: 'p-actions', style: null },
          h(
            'button',
            {
              type: 'button',
              class: 'ds-btn ds-btn--primary',
              onclick: () => recordManual(ctx),
            },
            'Registrar resultado'
          )
        )
      )
    }

    const recordManual = ctx => {
      const v = R.manualValue
      let outcome
      if (roll.model === 'pool-success')
        outcome = v > 0 ? plural(v, 'sucesso', 'sucessos') : 'Falha'
      else if (roll.model === 'sum-vs-target')
        outcome = `${v + ctx.mod} · ${v + ctx.mod >= R.target ? 'sucesso' : 'falha'} contra ${roll.target.label} ${R.target}`
      else if (roll.model === 'roll-under-percent')
        outcome = `${v} · ${percentLevel(v, ctx.value)}`
      else if (roll.model === 'fudge')
        outcome = `${fmtSigned(ctx.value + v + ctx.boost)} ${m.t.ladders[roll.ladder][ctx.value + v + ctx.boost] ?? ''}`
      else outcome = String(v + ctx.mod)
      finish({ faces: [], outcome: `${outcome} (na mão)` }, ctx)
      // O botão Registrar sai da tela com o resultado: o foco vai para "Rolei na mão".
      manualBtn.focus({ preventScroll: true })
    }

    // Sem role=status aqui: o resultado é anunciado uma vez, por announce() em finish().
    const resultNode = res =>
      h(
        'div',
        { class: 'ds-result p-sheet-section' },
        res.faces.length
          ? h(
              'div',
              { class: 'ds-dice', 'aria-hidden': 'true' },
              res.faces.map(x =>
                h('span', { class: ['ds-die', x.cls], text: x.text })
              )
            )
          : null,
        h('div', { class: 'ds-result__big', text: res.outcome })
      )

    const finish = (res, ctx) => {
      R.result = res
      R.manual = false
      const label = ctx.chosen
        .filter(c => c.opt)
        .map(c => c.opt.label)
        .join(' + ')
      S.ui.lastRoll = { sel: { ...R.sel }, label }
      saveUi()
      S.rolls.unshift({
        at: new Date().toISOString(),
        label,
        outcome: res.outcome,
      })
      for (const b of (roll.boosts ?? []).filter(b => R.boosts[b.id])) {
        const r = resourceInfo(m, b.resource)
        commit(
          [
            {
              id: b.resource,
              to: { ...raw(m, b.resource), current: r.current - b.cost },
            },
          ],
          {
            label: `${F(m, b.resource).label} ${r.current} → ${r.current - b.cost} (${b.label.split(':')[0]})`,
          }
        )
        R.boosts[b.id] = false
      }
      refreshBody()
      announce(`${label}: ${res.outcome}`)
    }

    const rollBtn = h(
      'button',
      { type: 'button', class: 'ds-btn ds-btn--primary' },
      icon('dice'),
      'Rolar no app'
    )
    const manualBtn = h(
      'button',
      { type: 'button', class: 'ds-btn' },
      'Rolei na mão'
    )
    rollBtn.addEventListener('click', () => {
      const ctx = ctxOf()
      if (!ctx.ready) return
      haptic(15)
      finish(ROLLERS[roll.model](R, ctx), ctx)
    })
    manualBtn.addEventListener('click', () => {
      R.manual = !R.manual
      R.manualValue = null
      refreshBody()
    })
    refreshBody()
    S.refreshers.add(refreshBody)
    sheet({
      title: roll.label === 'Dados' ? 'Parada de dados' : roll.label,
      body: bodyWrap,
      footer: [manualBtn, rollBtn],
      onClose: () => S.refreshers.delete(refreshBody),
    })
  }

  // ---------- Menu ⋯, histórico, sincronização, troca de personagem ----------

  function menuRow(iconName, label, onclick, opts = {}) {
    return h(
      'li',
      {},
      h(
        'button',
        {
          type: 'button',
          class: 'ds-row ds-pressable',
          onclick,
          disabled: opts.disabled ? true : null,
        },
        h('span', { class: 'ds-row__leading' }, icon(iconName)),
        h(
          'span',
          { class: 'ds-row__text' },
          h('span', { class: 'ds-row__label', text: label }),
          opts.sub ? h('span', { class: 'ds-row__sub', text: opts.sub }) : null
        )
      )
    )
  }

  function openMenu() {
    const m = S.m
    const owner = m.role === 'owner'
    let s
    const close = fn => () => {
      s.close()
      fn()
    }
    const items = []
    if (
      S.mode !== 'evolve' &&
      canWriteField(m, m.t.identity.name) &&
      !S.archived &&
      S.mode !== 'read'
    )
      items.push(
        menuRow(
          'edit',
          'Evoluir personagem',
          close(() => enterEvolve(null)),
          { sub: 'Alterar traços permanentes e gastar experiência' }
        )
      )
    for (const a of m.t.actions ?? [])
      if (S.mode === 'play' && canWriteField(m, m.t.identity.name))
        items.push(
          menuRow(
            'rest',
            a.label,
            close(() => previewAction(a)),
            { sub: a.help }
          )
        )
    items.push(
      menuRow('history', 'Histórico de alterações', close(openHistory))
    )
    if (S.rolls.length)
      items.push(menuRow('dice', 'Rolagens da sessão', close(openRolls)))
    items.push(menuRow('swap', 'Trocar de personagem', close(openSwitcher)))
    items.push(menuRow('theme', 'Tema e leitura', close(openThemeSheet)))
    items.push(
      menuRow(
        'print',
        'Exportar ou imprimir',
        close(() => print())
      )
    )
    if (owner && !S.archived)
      items.push(
        menuRow(
          'archive',
          'Arquivar',
          close(() =>
            confirmDialog({
              title: `Arquivar ${nameOf(m)}?`,
              text: 'A ficha fica somente leitura. Dá para restaurar depois.',
              confirmLabel: 'Arquivar',
              onConfirm: () => {
                S.archived = true
                S.mode = 'read'
                writeStore(`archived:${m.character.id}`, '1')
                render()
                toast('Ficha arquivada')
              },
            })
          )
        )
      )
    if (owner)
      items.push(
        menuRow(
          'trash',
          'Excluir',
          close(() =>
            confirmDialog({
              title: `Excluir ${nameOf(m)}?`,
              text: 'A ficha e o histórico serão apagados para todos na crônica. Isso não pode ser desfeito.',
              confirmLabel: 'Excluir',
              danger: true,
              requireText: nameOf(m),
              onConfirm: () => {
                S.deleted = true
                render()
              },
            })
          )
        )
      )
    items.push(
      menuRow(
        'cloudOff',
        S.offline
          ? 'Protótipo: voltar a ficar online'
          : 'Protótipo: simular offline',
        close(() => {
          S.offline = !S.offline
          if (!S.offline && S.pending) {
            S.sync = 'saving'
            renderSync()
            setTimeout(() => {
              S.pending = 0
              S.sync = 'saved'
              render()
              toast('Alterações sincronizadas')
            }, 900)
          } else {
            S.sync = S.offline ? 'offline' : 'saved'
            render()
          }
        })
      )
    )
    items.push(
      menuRow(
        'undo',
        'Protótipo: restaurar dados de exemplo',
        close(() => {
          writeStore(`sheet:${m.character.id}`, null)
          writeStore(`ui:${m.character.id}`, null)
          writeStore(`archived:${m.character.id}`, null)
          location.reload()
        })
      )
    )
    s = sheet({
      title: 'Mais opções',
      body: h('ul', { class: 'ds-rows' }, items),
    })
  }

  function previewAction(a) {
    const m = S.m
    const changes = []
    const lines = []
    if (a.effect === 'resource.spend') {
      const r = resourceInfo(m, a.params.field)
      const to = Math.max(0, r.current - a.params.amount)
      changes.push({
        id: a.params.field,
        to: { ...raw(m, a.params.field), current: to },
      })
      lines.push([F(m, a.params.field).label, `${r.current} → ${to}`])
    } else if (a.effect === 'rest.long') {
      for (const [id, f] of Object.entries(m.t.fields)) {
        if (f.type === 'resource' && f.rule === 'tempFirst') {
          const r = resourceInfo(m, id)
          changes.push({ id, to: { ...raw(m, id), current: r.max, temp: 0 } })
          lines.push([f.label, `${r.current} → ${r.max}`])
        }
        if (f.type === 'resource' && f.max?.field) {
          const r = resourceInfo(m, id)
          const to = Math.min(
            r.max,
            r.current + Math.max(1, Math.floor(r.max / 2))
          )
          changes.push({ id, to: { ...raw(m, id), current: to } })
          lines.push([f.label, `${r.current} → ${to}`])
        }
        if (f.type === 'slots') {
          const v = raw(m, id) ?? {}
          changes.push({
            id,
            to: Object.fromEntries(
              Object.entries(v).map(([k, x]) => [k, { ...x, used: 0 }])
            ),
          })
          lines.push([f.label, 'todos recuperados'])
        }
        if (f.type === 'track' && f.rule === 'boxes') {
          changes.push({
            id,
            to: Object.fromEntries(
              f.rows.map(r => [r.id, Array(r.boxes).fill(false)])
            ),
          })
          lines.push([f.label, 'zerados'])
        }
      }
    } else {
      toast(a.help ?? a.label)
      return
    }
    const apply = h(
      'button',
      { type: 'button', class: 'ds-btn ds-btn--primary' },
      'Aplicar'
    )
    const cancel = h('button', { type: 'button', class: 'ds-btn' }, 'Cancelar')
    const s = sheet({
      title: a.label,
      body: h(
        'div',
        {},
        h('p', { class: 'p-note', text: 'Prévia antes de aplicar:' }),
        h(
          'ul',
          { class: 'p-changes' },
          lines.map(([x, y]) =>
            h('li', {}, h('span', { text: x }), h('b', { text: y }))
          )
        )
      ),
      footer: [cancel, apply],
    })
    cancel.addEventListener('click', s.close)
    apply.addEventListener('click', () => {
      s.close()
      commit(changes, { label: a.label })
    })
  }

  function openHistory() {
    liveSheet('Histórico de alterações', () => {
      if (!S.history.length)
        return h(
          'div',
          { class: 'ds-empty' },
          h('p', { class: 'ds-empty__title', text: 'Nenhuma alteração ainda' }),
          h('p', {
            text: 'Cada alteração aparece aqui com quem fez, quando, e o valor anterior.',
          })
        )
      return h(
        'ul',
        { class: 'p-history' },
        S.history.map(ev =>
          h(
            'li',
            {},
            h('div', { text: ev.label }),
            h('div', {
              class: 'p-history__meta',
              text: `${hhmm(ev.at)} · ${userName(ev.by)}${ev.byRole === 'storyteller' ? ' (narrador)' : ''}`,
            })
          )
        )
      )
    })
  }

  function openRolls() {
    liveSheet('Rolagens da sessão', () =>
      h(
        'ul',
        { class: 'p-history' },
        S.rolls.map(r =>
          h(
            'li',
            {},
            h('div', { text: `${r.label}: ${r.outcome}` }),
            h('div', { class: 'p-history__meta', text: hhmm(r.at) })
          )
        )
      )
    )
  }

  function openSyncSheet() {
    const states = {
      saved: 'Todas as alterações estão salvas no servidor.',
      saving: 'Enviando alterações.',
      offline: `Sem conexão. ${plural(S.pending, 'alteração está guardada', 'alterações estão guardadas')} no aparelho e ${S.pending === 1 ? 'será enviada' : 'serão enviadas'} quando a conexão voltar. Em caso de conflito, prevalece a última alteração, e você recebe um aviso.`,
      error: 'Não foi possível salvar.',
    }
    sheet({
      title: 'Sincronização',
      body: h(
        'div',
        {},
        h('p', { text: states[S.sync] }),
        h('p', {
          class: 'p-note',
          text: 'Credenciais nunca ficam na fila offline: só eventos de alteração (campo, valor anterior, valor novo).',
        })
      ),
    })
  }

  function openSwitcher() {
    const m = S.m
    const mine = DATA.characters.filter(
      c =>
        c.ownerId === S.viewerId ||
        (m.role === 'storyteller' && c.chronicleId === m.chronicle.id)
    )
    sheet({
      title: 'Trocar de personagem',
      body: h(
        'ul',
        { class: 'ds-list' },
        mine.map(c =>
          characterCard(
            c,
            `ficha.html#${hashOf({ c: c.id, as: c.ownerId === S.viewerId ? 'owner' : m.role })}`
          )
        )
      ),
    })
  }

  // Escolha única compacta (radiogroup) com tabindex itinerante e setas que selecionam: uma parada
  // de Tab por grupo. Só para escolhas sem custo (tema, vantagem); trocar forma, que pode gastar
  // Fúria, usa a lista de rádios com confirmação por toque.
  function segRadio(label, options, selected, onSelect, keyPrefix) {
    const buttons = options.map(([id, text]) =>
      h(
        'button',
        {
          type: 'button',
          role: 'radio',
          'data-key': `${keyPrefix}-${id}`,
          'aria-checked': String(selected === id),
          tabindex: selected === id ? '0' : '-1',
          onclick: () => onSelect(id),
        },
        text
      )
    )
    if (!buttons.some(b => b.tabIndex === 0)) buttons[0].tabIndex = 0
    const group = h(
      'div',
      { class: 'ds-seg', role: 'radiogroup', 'aria-label': label },
      buttons
    )
    group.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
        e.key
      ]
      const idx = buttons.indexOf(document.activeElement)
      if (!d || idx < 0) return
      e.preventDefault()
      const next = (idx + d + buttons.length) % buttons.length
      onSelect(options[next][0])
      // A tela é refeita por onSelect: o foco volta ao botão novo pela data-key.
      requestAnimationFrame(() =>
        document
          .querySelector(
            `[data-key="${CSS.escape(`${keyPrefix}-${options[next][0]}`)}"]`
          )
          ?.focus({ preventScroll: true })
      )
    })
    return group
  }

  // Monta a hash com os valores codificados (ids vindos de dados nunca injetam parâmetros).
  const hashOf = obj =>
    new URLSearchParams(
      Object.entries(obj).filter(([, v]) => v != null)
    ).toString()

  function openThemeSheet() {
    const body = h('div', {})
    const fill = () => {
      // Refeito a cada escolha: o foco fica no controle tocado (data-key).
      const key = body.contains(document.activeElement)
        ? document.activeElement.dataset.key
        : null
      body.replaceChildren(
        sheetSection(
          'Tema',
          segRadio(
            'Tema',
            [
              ['sistema', 'Sistema'],
              ['noite', 'Noite'],
              ['pergaminho', 'Pergaminho'],
            ],
            root.dataset.theme,
            id => {
              root.dataset.theme = id
              writeStore('theme', id)
              fill()
            },
            'theme'
          )
        ),
        sheetSection(
          'Leitura',
          h(
            'button',
            {
              type: 'button',
              role: 'checkbox',
              class: 'p-toggle',
              'data-key': 'plain',
              'aria-checked': String(root.dataset.plainTitles === 'true'),
              onclick: () => {
                const on = root.dataset.plainTitles !== 'true'
                if (on) root.dataset.plainTitles = 'true'
                else delete root.dataset.plainTitles
                writeStore('plain', on ? '1' : null)
                fill()
              },
            },
            'Títulos sem fonte decorativa'
          )
        ),
        h('p', {
          class: 'p-note',
          text: 'Tamanho da fonte e "reduzir movimento" seguem as configurações do sistema.',
        })
      )
      if (key)
        body
          .querySelector(`[data-key="${CSS.escape(key)}"]`)
          ?.focus({ preventScroll: true })
    }
    fill()
    sheet({ title: 'Tema e leitura', body })
  }

  // =====================================================================
  // Páginas de lista: crônicas e mesa do narrador
  // =====================================================================

  function characterCard(c, href, opts = {}) {
    const m = makeModel(c, 'player')
    const chips = opts.dock
      ? m.t.dock.map(id =>
          h(
            'span',
            { class: 'ds-mini' },
            h('span', {
              class: 'ds-muted',
              text: F(m, id).shortLabel ?? F(m, id).label,
            }),
            ' ',
            h('b', { text: shortValue(m, id) })
          )
        )
      : null
    const label = `${nameOf(m)}, ${chipText(m)}${opts.dock ? `. ${m.t.dock.map(id => describe(m, id)).join('. ')}` : ''}`
    return h(
      'li',
      { 'data-accent': accentOf(m), 'data-skin': m.t.skin },
      h(
        'a',
        { class: 'ds-list-item ds-pressable', href, 'aria-label': label },
        h('span', {
          class: 'ds-avatar',
          'aria-hidden': 'true',
          text: initials(nameOf(m)),
        }),
        h(
          'span',
          { class: 'ds-list-item__text' },
          h('span', { class: 'ds-list-item__title', text: nameOf(m) }),
          h('span', {}, h('span', { class: 'ds-id-chip', text: chipText(m) })),
          h('span', {
            class: 'ds-list-item__meta',
            text:
              opts.meta ??
              `${m.chronicle.name} · atualizada às ${hhmm(c.updatedAt)}`,
          }),
          chips && h('span', { class: 'ds-list-item__chips' }, chips)
        ),
        icon('chevronRight')
      )
    )
  }

  function tabbar(current) {
    const tabs = [
      ['cronicas.html', 'book', 'Crônicas'],
      ['cronicas.html#tab=personagens', 'user', 'Personagens'],
      ['#', 'dice', 'Dados'],
      ['#', 'users', 'Perfil'],
    ]
    return h(
      'nav',
      { class: 'ds-tabbar', 'aria-label': 'Navegação principal' },
      tabs.map(([href, ic, label]) =>
        h(
          'a',
          { href, 'aria-current': label === current ? 'page' : null },
          icon(ic),
          label
        )
      )
    )
  }

  function initCronicas() {
    const viewer = params.u ?? 'u-ana'
    const app = document.getElementById('app')
    const empty = params.vazio === '1'
    const mine = DATA.characters.filter(c => c.ownerId === viewer)
    const chronicles = DATA.chronicles.filter(
      ch =>
        ch.storytellerId === viewer || mine.some(c => c.chronicleId === ch.id)
    )
    const systemFilter = params.sistema ?? null
    const appbar = h(
      'header',
      { class: 'ds-appbar' },
      h('h1', { class: 'ds-appbar__title', text: 'Crônicas' })
    )
    if (empty) {
      app.replaceChildren(
        appbar,
        h(
          'main',
          { id: 'main', class: 'p-list-page' },
          h(
            'div',
            { class: 'ds-empty' },
            icon('book'),
            h('h2', {
              class: 'ds-empty__title',
              text: 'Você ainda não participa de nenhuma crônica',
            }),
            h('p', {
              text: 'Crie uma crônica para narrar ou entre com o convite que o narrador enviou.',
            }),
            h(
              'div',
              { class: 'p-page-actions' },
              h(
                'button',
                { type: 'button', class: 'ds-btn ds-btn--primary' },
                'Criar crônica'
              ),
              h(
                'button',
                { type: 'button', class: 'ds-btn' },
                'Entrar com convite'
              )
            )
          )
        ),
        tabbar('Crônicas')
      )
      return
    }
    const systems = [...new Set(mine.map(c => c.system))]
    app.replaceChildren(
      appbar,
      h(
        'main',
        { id: 'main', class: 'p-list-page' },
        h('h2', { class: 'p-list-section', text: 'Suas crônicas' }),
        h(
          'ul',
          { class: 'ds-list' },
          chronicles.map(ch => {
            const t = DATA.templates[ch.system]
            const count = DATA.characters.filter(
              c => c.chronicleId === ch.id
            ).length
            const isST = ch.storytellerId === viewer
            return h(
              'li',
              {},
              h(
                'a',
                {
                  class: 'ds-list-item ds-pressable',
                  href: `mesa.html#${hashOf({ ch: ch.id, as: isST ? 'storyteller' : 'player' })}`,
                },
                h('span', {
                  class: 'ds-avatar',
                  'aria-hidden': 'true',
                  text: initials(ch.name),
                }),
                h(
                  'span',
                  { class: 'ds-list-item__text' },
                  h('span', { class: 'ds-list-item__title', text: ch.name }),
                  h('span', { class: 'ds-list-item__meta', text: `${t.name}` }),
                  h('span', {
                    class: 'ds-list-item__meta',
                    text: `${isST ? 'Você narra' : `Narrador: ${userName(ch.storytellerId)}`} · ${plural(count, 'personagem', 'personagens')} · última sessão ${ddmm(ch.lastSession)}`,
                  })
                ),
                icon('chevronRight')
              )
            )
          })
        ),
        h('h2', { class: 'p-list-section', text: 'Seus personagens' }),
        h(
          'div',
          {
            class: 'ds-filterbar p-page-actions',
            role: 'group',
            'aria-label': 'Filtrar por sistema',
          },
          h(
            'a',
            {
              class: 'ds-chip',
              href: 'cronicas.html',
              'aria-current': systemFilter ? null : 'true',
            },
            'Todos'
          ),
          systems.map(sys =>
            h(
              'a',
              {
                class: 'ds-chip',
                href: `cronicas.html#${hashOf({ sistema: sys })}`,
                'aria-current': systemFilter === sys ? 'true' : null,
              },
              DATA.templates[sys].edition
            )
          )
        ),
        h(
          'ul',
          { class: 'ds-list' },
          mine
            .filter(c => !systemFilter || c.system === systemFilter)
            .map(c =>
              characterCard(c, `ficha.html#${hashOf({ c: c.id, as: 'owner' })}`)
            )
        )
      ),
      tabbar('Crônicas')
    )
  }

  function initMesa() {
    const ch =
      DATA.chronicles.find(c => c.id === params.ch) ?? DATA.chronicles[0]
    const isST = params.as === 'storyteller'
    // A visão "Mesa" é do narrador; para jogador o pedido cai em "Personagens" (fail secure).
    const view =
      isST && (params.view ?? 'mesa') === 'mesa' ? 'mesa' : 'personagens'
    const t = DATA.templates[ch.system]
    document.body.dataset.skin = t.skin
    const chars = DATA.characters.filter(c => c.chronicleId === ch.id)
    const viewer = isST ? ch.storytellerId : 'u-ana'
    const app = document.getElementById('app')
    // Cada visão é uma página (a hash muda e recarrega): navegação com links e aria-current, não
    // tablist, que prometeria troca de painel no lugar. Jogador não vê o link da Mesa.
    const views = isST
      ? [
          ['personagens', 'Personagens'],
          ['mesa', 'Mesa'],
        ]
      : [['personagens', 'Personagens']]
    const seg = h(
      'nav',
      { class: 'ds-seg', 'aria-label': 'Visão da crônica' },
      views.map(([id, label]) =>
        h(
          'a',
          {
            class: 'p-seg-link',
            href: `mesa.html#${hashOf({ ch: ch.id, as: isST ? 'storyteller' : 'player', view: id })}`,
            'aria-current': view === id ? 'page' : null,
          },
          label
        )
      )
    )
    const list =
      view === 'mesa'
        ? chars.map(c =>
            characterCard(
              c,
              `ficha.html#${hashOf({ c: c.id, as: 'storyteller' })}`,
              {
                dock: true,
                meta: `${userName(c.ownerId)} · sincronizada às ${hhmm(c.updatedAt)}`,
              }
            )
          )
        : chars.map(c =>
            characterCard(
              c,
              `ficha.html#${hashOf({ c: c.id, as: c.ownerId === viewer ? 'owner' : isST ? 'storyteller' : 'player' })}`,
              {
                meta: `${userName(c.ownerId)} · atualizada às ${hhmm(c.updatedAt)}`,
              }
            )
          )
    app.replaceChildren(
      h(
        'header',
        { class: 'ds-appbar' },
        h(
          'a',
          { class: 'ds-back ds-pressable', href: 'cronicas.html' },
          icon('back'),
          'Crônicas'
        ),
        h('h1', { class: 'ds-appbar__title', text: ch.name })
      ),
      h(
        'main',
        { id: 'main', class: 'p-list-page' },
        h(
          'div',
          { class: 'p-page-actions' },
          h('p', {
            class: 'ds-muted',
            style: null,
            text: `${t.name} · ${isST ? 'Você narra' : `Narrador: ${userName(ch.storytellerId)}`}`,
          })
        ),
        h('div', { class: 'p-page-actions' }, seg),
        view === 'mesa'
          ? h('p', {
              class: 'p-hidden-note',
              text: 'Cada linha mostra os mesmos recursos do dock do template. Toque para abrir a ficha em leitura; editar como narrador é explícito e fica assinado no histórico.',
            })
          : null,
        h('ul', { class: 'ds-list' }, list)
      ),
      tabbar('Crônicas')
    )
  }

  // ---------- Roteamento ----------

  if (page === 'ficha') initFicha()
  else if (page === 'cronicas') initCronicas()
  else if (page === 'mesa') initMesa()

  window.TMSProto = { DERIVE, RULES, ROLLERS, makeModel, describe, shortValue }
})()
