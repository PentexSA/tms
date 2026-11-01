// Acessibilidade dos componentes compartilhados (P06 da onda 1). Os ramos do
// web e do Android rodam com o Platform.OS trocado, como em components.test.
import {
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react-native'
import { Modal, Platform, Text as RNText } from 'react-native'
import {
  BottomSheet,
  Button,
  Chip,
  Choice,
  ListItem,
  Pressable,
  rovingTarget,
  Skeleton,
  Stepper,
  TabPanel,
  Tabs,
  useRovingFocus,
} from './index'

const realOS = Platform.OS
const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
afterEach(() => setOS(realOS))

const key = (k: string, extra: { repeat?: boolean } = {}) => {
  const preventDefault = jest.fn()
  return {
    event: {
      nativeEvent: { key: k, repeat: extra.repeat ?? false },
      preventDefault,
    },
    preventDefault,
  }
}

describe('Pressable: Espaço nos papéis que não são botão (T-35)', () => {
  it.each(['radio', 'tab', 'switch', 'checkbox'] as const)(
    'no web, %s ativa com Espaço e a página não rola',
    role => {
      setOS('web')
      const onPress = jest.fn()
      render(
        <Pressable
          accessibilityRole={role}
          accessibilityLabel="Item"
          onPress={onPress}
        />
      )
      const { event, preventDefault } = key(' ')
      fireEvent(screen.getByLabelText('Item'), 'keyDown', event)
      expect(onPress).toHaveBeenCalledTimes(1)
      expect(preventDefault).toHaveBeenCalled()
    }
  )

  it('o papel também vem de `role`', () => {
    setOS('web')
    const onPress = jest.fn()
    render(
      <Pressable role="switch" accessibilityLabel="Oculta" onPress={onPress} />
    )
    fireEvent(screen.getByLabelText('Oculta'), 'keyDown', key(' ').event)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('botão fica com o react-native-web (sem disparo duplo)', () => {
    setOS('web')
    const onPress = jest.fn()
    render(
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Salvar"
        onPress={onPress}
      />
    )
    fireEvent(screen.getByLabelText('Salvar'), 'keyDown', key(' ').event)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('tecla repetida, desabilitado e outras teclas não ativam', () => {
    setOS('web')
    const onPress = jest.fn()
    const onKeyDown = jest.fn()
    const { rerender } = render(
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel="Opção"
        onPress={onPress}
        onKeyDown={onKeyDown}
      />
    )
    const el = () => screen.getByLabelText('Opção')
    fireEvent(el(), 'keyDown', key(' ', { repeat: true }).event)
    fireEvent(el(), 'keyDown', key('a').event)
    expect(onKeyDown).toHaveBeenCalledTimes(2)
    rerender(
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel="Opção"
        onPress={onPress}
        disabled
      />
    )
    fireEvent(el(), 'keyDown', key(' ').event)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('no app, nada muda: o Espaço é do sistema', () => {
    setOS('ios')
    const onPress = jest.fn()
    render(
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel="Opção"
        onPress={onPress}
      />
    )
    expect(screen.getByLabelText('Opção').props.onKeyDown).toBeUndefined()
  })
})

describe('useRovingFocus (T-35)', () => {
  it('rovingTarget: setas dão a volta; Home e End vão às pontas', () => {
    expect(rovingTarget('ArrowRight', 2, 3)).toBe(0)
    expect(rovingTarget('ArrowLeft', 0, 3)).toBe(2)
    expect(rovingTarget('ArrowDown', 0, 3)).toBe(1)
    expect(rovingTarget('ArrowUp', 1, 3)).toBe(0)
    expect(rovingTarget('Home', 2, 3)).toBe(0)
    expect(rovingTarget('End', 0, 3)).toBe(2)
    expect(rovingTarget('ArrowDown', 0, 3, 'horizontal')).toBeNull()
    expect(rovingTarget('ArrowRight', 0, 3, 'vertical')).toBeNull()
    expect(rovingTarget('ArrowDown', 0, 3, 'vertical')).toBe(1)
    expect(rovingTarget('Tab', 0, 3)).toBeNull()
    expect(rovingTarget('ArrowRight', 0, 0)).toBeNull()
  })

  it('no web: tabIndex 0 só no ativo; a seta move o foco e, com `focus`, seleciona', () => {
    setOS('web')
    const onActivate = jest.fn()
    const { result } = renderHook(() =>
      useRovingFocus({ count: 3, active: 1, activate: 'focus', onActivate })
    )
    const items = [0, 1, 2].map(i => result.current(i))
    expect(items.map(p => p.tabIndex)).toEqual([-1, 0, -1])
    const nodes = items.map(() => ({ focus: jest.fn() }))
    items.forEach((p, i) => p.ref?.(nodes[i]))
    const { event, preventDefault } = key('ArrowRight')
    items[1]?.onKeyDown?.(event as never)
    expect(nodes[2]?.focus).toHaveBeenCalled()
    expect(preventDefault).toHaveBeenCalled()
    expect(onActivate).toHaveBeenCalledWith(2)
  })

  it('com `manual`, a seta só move o foco; tecla de fora não faz nada', () => {
    setOS('web')
    const onActivate = jest.fn()
    const { result } = renderHook(() =>
      useRovingFocus({ count: 2, active: -1, onActivate })
    )
    const items = [0, 1].map(i => result.current(i))
    expect(items.map(p => p.tabIndex)).toEqual([0, -1])
    const node = { focus: jest.fn() }
    items[1]?.ref?.(node)
    items[0]?.onKeyDown?.(key('End').event as never)
    expect(node.focus).toHaveBeenCalled()
    const other = key('a')
    items[0]?.onKeyDown?.(other.event as never)
    expect(other.preventDefault).not.toHaveBeenCalled()
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('no app, não devolve nada', () => {
    setOS('android')
    const { result } = renderHook(() => useRovingFocus({ count: 2, active: 0 }))
    expect(result.current(0)).toEqual({})
  })
})

const CLANS = [
  { id: 'brujah', label: 'Brujah' },
  { id: 'tremere', label: 'Tremere' },
  { id: 'ventrue', label: 'Ventrue' },
]

describe('Choice: título visível, setas e disabled (T-09, T-35)', () => {
  it('mostra o título acima do grupo; com showLabel={false}, não', () => {
    const { rerender } = render(
      <Choice label="Clã" options={CLANS} value={null} onChange={jest.fn()} />
    )
    expect(screen.getByText('Clã')).toBeTruthy()
    expect(screen.getByLabelText('Clã')).toBeTruthy()
    rerender(
      <Choice
        label="Clã"
        options={CLANS}
        value={null}
        onChange={jest.fn()}
        showLabel={false}
      />
    )
    expect(screen.queryByText('Clã')).toBeNull()
    expect(screen.getByLabelText('Clã')).toBeTruthy()
  })

  it('no web, o grupo é nomeado pelo título (aria-labelledby)', () => {
    setOS('web')
    render(
      <Choice label="Clã" options={CLANS} value={null} onChange={jest.fn()} />
    )
    const title = screen.getByText('Clã')
    const group = screen.getByLabelText('Clã')
    expect(title.props.nativeID).toBeTruthy()
    expect(group.props['aria-labelledby']).toBe(title.props.nativeID)
  })

  it('no Android, o título fica fora da árvore (o TalkBack já lê o grupo)', () => {
    setOS('android')
    render(
      <Choice label="Clã" options={CLANS} value={null} onChange={jest.fn()} />
    )
    const title = screen.getByText('Clã', { includeHiddenElements: true })
    expect(title.props['aria-hidden']).toBe(true)
    expect(
      screen.getByLabelText('Clã').props['aria-labelledby']
    ).toBeUndefined()
  })

  it('no web: tabindex itinerante; a seta não escolhe, o Espaço escolhe', () => {
    setOS('web')
    const onChange = jest.fn()
    render(
      <Choice label="Clã" options={CLANS} value="tremere" onChange={onChange} />
    )
    const radios = screen.getAllByRole('radio')
    expect(radios.map(r => r.props.tabIndex)).toEqual([-1, 0, -1])
    fireEvent(
      screen.getByRole('radio', { name: 'Tremere' }),
      'keyDown',
      key('ArrowDown').event
    )
    expect(onChange).not.toHaveBeenCalled()
    fireEvent(
      screen.getByRole('radio', { name: 'Ventrue' }),
      'keyDown',
      key(' ').event
    )
    expect(onChange).toHaveBeenCalledWith('ventrue')
  })

  it('sem nada marcado, o primeiro fica no Tab', () => {
    setOS('web')
    render(
      <Choice label="Clã" options={CLANS} value={null} onChange={jest.fn()} />
    )
    expect(screen.getAllByRole('radio').map(r => r.props.tabIndex)).toEqual([
      0, -1, -1,
    ])
  })

  it('disabled: as opções ficam sem toque', () => {
    const onChange = jest.fn()
    render(
      <Choice
        label="Clã"
        options={CLANS}
        value="brujah"
        onChange={onChange}
        disabled
      />
    )
    const radio = screen.getByRole('radio', { name: 'Tremere' })
    expect(radio).toBeDisabled()
    fireEvent.press(radio)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Stepper: o número falado e o rótulo visível (T-34, T-09)', () => {
  it('sem valueText, o texto é o número (o iOS não calcula porcentagem)', () => {
    render(
      <Stepper
        label="Primária"
        value={7}
        min={0}
        max={1000}
        onChange={jest.fn()}
      />
    )
    expect(
      screen.getByRole('adjustable', { name: 'Primária' })
    ).toHaveAccessibilityValue({ text: '7', min: 0, max: 1000, now: 7 })
  })

  it('com valueText, o texto dele', () => {
    render(
      <Stepper
        label="Sangue"
        value={9}
        min={0}
        max={13}
        onChange={jest.fn()}
        valueText={n => `${n} de 13`}
      />
    )
    expect(
      screen.getByRole('adjustable', { name: 'Sangue' })
    ).toHaveAccessibilityValue({ text: '9 de 13' })
  })

  it('showLabel: rótulo visível acima, fora da árvore; o padrão não mostra', () => {
    const { rerender } = render(
      <Stepper label="Dados" value={3} min={1} max={50} onChange={jest.fn()} />
    )
    expect(
      screen.queryByText('Dados', { includeHiddenElements: true })
    ).toBeNull()
    rerender(
      <Stepper
        label="Dados"
        value={3}
        min={1}
        max={50}
        onChange={jest.fn()}
        showLabel
      />
    )
    const title = screen.getByText('Dados', { includeHiddenElements: true })
    expect(title.props['aria-hidden']).toBe(true)
    expect(screen.queryByText('Dados')).toBeNull()
    expect(screen.getByRole('adjustable', { name: 'Dados' })).toBeTruthy()
  })
})

const ZONES = [
  { id: 'sheet', label: 'Ficha' },
  { id: 'powers', label: 'Poderes' },
  { id: 'notes', label: 'Notas' },
]

describe('Tabs e TabPanel: teclado, painel e posição no iOS (T-35)', () => {
  const renderTabs = (onSelect = jest.fn(), id?: string) =>
    render(
      <>
        <Tabs
          id={id}
          accessibilityLabel="Partes da ficha"
          items={ZONES}
          selected="powers"
          onSelect={onSelect}
        />
        {id ? (
          <TabPanel tabsId={id} tab="powers" testID="panel">
            {null}
          </TabPanel>
        ) : null}
      </>
    )

  it('no web: só a aba ativa no Tab; a seta seleciona (ativação automática)', () => {
    setOS('web')
    const onSelect = jest.fn()
    renderTabs(onSelect)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(t => t.props.tabIndex)).toEqual([-1, 0, -1])
    fireEvent(
      screen.getByRole('tab', { name: 'Poderes' }),
      'keyDown',
      key('ArrowRight').event
    )
    expect(onSelect).toHaveBeenLastCalledWith('notes')
    fireEvent(
      screen.getByRole('tab', { name: 'Poderes' }),
      'keyDown',
      key('Home').event
    )
    expect(onSelect).toHaveBeenLastCalledWith('sheet')
    // ↓ não é das abas horizontais
    onSelect.mockClear()
    fireEvent(
      screen.getByRole('tab', { name: 'Poderes' }),
      'keyDown',
      key('ArrowDown').event
    )
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('no web: o Espaço ativa a aba', () => {
    setOS('web')
    const onSelect = jest.fn()
    renderTabs(onSelect)
    fireEvent(
      screen.getByRole('tab', { name: 'Notas' }),
      'keyDown',
      key(' ').event
    )
    expect(onSelect).toHaveBeenCalledWith('notes')
  })

  it('no web, com id: a aba ativa controla o painel, que é nomeado por ela', () => {
    setOS('web')
    renderTabs(jest.fn(), 'parts')
    const active = screen.getByRole('tab', { name: 'Poderes' })
    expect(active.props.nativeID).toBe('parts-tab-powers')
    expect(active.props['aria-controls']).toBe('parts-panel')
    expect(
      screen.getByRole('tab', { name: 'Ficha' }).props['aria-controls']
    ).toBeUndefined()
    const panel = screen.getByTestId('panel')
    expect(panel.props.role).toBe('tabpanel')
    expect(panel.props.nativeID).toBe('parts-panel')
    expect(panel.props['aria-labelledby']).toBe('parts-tab-powers')
  })

  it('sem id, nada de aria-controls; no app, o painel não ganha papel', () => {
    renderTabs(jest.fn(), 'parts')
    expect(screen.getByTestId('panel').props.role).toBeUndefined()
    expect(
      screen.getByRole('tab', { name: 'Poderes' }).props['aria-controls']
    ).toBeUndefined()
  })

  it('no iOS, cada aba diz a posição ("aba 2 de 3")', () => {
    setOS('ios')
    renderTabs()
    expect(
      screen.getByRole('tab', { name: 'Poderes' })
    ).toHaveAccessibilityValue({ text: 'aba 2 de 3' })
    expect(screen.getByRole('tab', { name: 'Ficha' })).toHaveAccessibilityValue(
      { text: 'aba 1 de 3' }
    )
  })

  it('no Android, sem a posição (o papel tab já é lido)', () => {
    setOS('android')
    renderTabs()
    expect(
      screen.getByRole('tab', { name: 'Poderes' }).props.accessibilityValue
        ?.text
    ).toBeUndefined()
  })
})

describe('BottomSheet: um Fechar só, escape no iOS e foco de volta (T-71, T-35)', () => {
  const sheet = (visible: boolean, onClose = jest.fn()) => (
    <BottomSheet
      visible={visible}
      title="Antecedentes"
      onClose={onClose}
      testID="sheet"
    >
      <RNText>conteúdo</RNText>
    </BottomSheet>
  )

  it('o fundo fecha no toque, mas fica fora da árvore e do Tab', () => {
    setOS('web')
    const onClose = jest.fn()
    render(sheet(true, onClose))
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(1)
    const scrim = screen.getByTestId('bottom-sheet-scrim', {
      includeHiddenElements: true,
    })
    expect(scrim.props['aria-hidden']).toBe(true)
    expect(scrim.props.tabIndex).toBe(-1)
    expect(scrim.props.accessibilityRole).toBeUndefined()
    fireEvent.press(scrim)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('iOS: o gesto de escape do VoiceOver fecha', () => {
    const onClose = jest.fn()
    render(sheet(true, onClose))
    fireEvent(screen.getByTestId('sheet'), 'accessibilityEscape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('no web, o foco volta a quem abriu', () => {
    const doc = globalThis as { document?: unknown }
    let trigger: { focus: jest.Mock; isConnected: boolean }
    let fake: { activeElement: unknown; body: object }
    beforeEach(() => {
      jest.useFakeTimers()
      setOS('web')
      trigger = { focus: jest.fn(), isConnected: true }
      fake = { activeElement: trigger, body: {} }
      doc.document = fake
    })
    afterEach(() => {
      jest.useRealTimers()
      delete doc.document
    })

    it('ao fechar (onDismiss do modal), mesmo com o foco perdido no body', () => {
      const { rerender } = render(sheet(true))
      fake.activeElement = fake.body
      rerender(sheet(false))
      fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss')
      jest.runAllTimers()
      expect(trigger.focus).toHaveBeenCalledTimes(1)
    })

    it('ao desmontar aberta (quem chama some com a folha)', () => {
      const { unmount } = render(sheet(true))
      fake.activeElement = null
      unmount()
      jest.runAllTimers()
      expect(trigger.focus).toHaveBeenCalledTimes(1)
    })

    it('não rouba o foco de outro elemento nem foca quem saiu da tela', () => {
      const first = render(sheet(true))
      fake.activeElement = { isConnected: true }
      first.unmount()
      jest.runAllTimers()
      expect(trigger.focus).not.toHaveBeenCalled()

      fake.activeElement = trigger
      const second = render(sheet(true))
      trigger.isConnected = false
      second.unmount()
      jest.runAllTimers()
      expect(trigger.focus).not.toHaveBeenCalled()
    })
  })

  it('no app, não mexe no foco', () => {
    const { rerender } = render(sheet(true))
    rerender(sheet(false))
    fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss')
    expect(screen.queryByText('conteúdo')).toBeNull()
  })
})

/** Algum ancestral do elemento é um elemento acessível (engole os filhos no app)? */
const insideAccessible = (el: { parent: unknown }): boolean => {
  let node = el.parent as {
    props?: { accessible?: boolean }
    parent: unknown
  } | null
  while (node) {
    // Só os elementos de host (View) contam: é o que vira nó nativo
    if (
      typeof (node as { type?: unknown }).type === 'string' &&
      node.props?.accessible === true
    )
      return true
    node = node.parent as typeof node
  }
  return false
}

describe('ListItem sem ação não engole o trailing (T-41)', () => {
  it('o texto é um elemento; o botão fica fora dele', () => {
    const onPress = jest.fn()
    render(
      <ListItem
        title="Criado em 18/10"
        subtitle="8 usos restantes"
        trailing={<Button title="Revogar" variant="ghost" onPress={onPress} />}
      />
    )
    const revoke = screen.getByRole('button', { name: 'Revogar' })
    expect(insideAccessible(revoke)).toBe(false)
    expect(
      screen.getByLabelText('Criado em 18/10, 8 usos restantes')
    ).toBeTruthy()
    fireEvent.press(revoke)
    expect(onPress).toHaveBeenCalled()
  })

  it('sem trailing, continua um elemento só', () => {
    render(<ListItem title="Helena" subtitle="Tremere" testID="row" />)
    const row = screen.getByTestId('row')
    expect(row.props.accessible).toBe(true)
    expect(row.props.accessibilityLabel).toBe('Helena, Tremere')
  })
})

describe('Chip: alternância e interruptor anunciados (T-42)', () => {
  it('toggle no web: aria-pressed, sem aria-selected (inválido em botão)', () => {
    setOS('web')
    render(<Chip label="Ocultas" selected onPress={jest.fn()} />)
    const chip = screen.getByRole('button', { name: 'Ocultas' })
    expect(chip.props['aria-pressed']).toBe(true)
    expect(chip.props['aria-selected']).toBeUndefined()
  })

  it('toggle no app: continua "selecionado"', () => {
    render(<Chip label="Ocultas" selected onPress={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Ocultas' })).toBeSelected()
  })

  it.each(['ios', 'android', 'web'])(
    'switch (%s): papel switch, ligado ou desligado',
    os => {
      setOS(os)
      const onPress = jest.fn()
      const { rerender } = render(
        <Chip kind="switch" label="Rolagem oculta" selected onPress={onPress} />
      )
      expect(
        screen.getByRole('switch', { name: 'Rolagem oculta' })
      ).toBeChecked()
      rerender(
        <Chip
          kind="switch"
          label="Rolagem oculta"
          selected={false}
          onPress={onPress}
        />
      )
      const off = screen.getByRole('switch', { name: 'Rolagem oculta' })
      expect(off).not.toBeChecked()
      fireEvent.press(off)
      expect(onPress).toHaveBeenCalled()
    }
  )
})

describe('Button: nome acessível próprio (T-61)', () => {
  it('padrão: o título; com accessibilityLabel, ele', () => {
    const { rerender } = render(
      <Button title="Escolher da lista" onPress={jest.fn()} />
    )
    expect(screen.getByRole('button').props.accessibilityLabel).toBe(
      'Escolher da lista'
    )
    rerender(
      <Button
        title="Escolher da lista"
        accessibilityLabel="Escolher da lista: Natureza"
        onPress={jest.fn()}
      />
    )
    expect(screen.getByRole('button').props.accessibilityLabel).toBe(
      'Escolher da lista: Natureza'
    )
  })
})

describe('Skeleton: carregamento anunciado no web (T-72)', () => {
  it('no web: role="status" anunciável (sem aria-busy), "Carregando" em texto; linhas fora da árvore', () => {
    setOS('web')
    render(<Skeleton testID="s" lines={2} />)
    const s = screen.getByTestId('s')
    expect(s.props.role).toBe('status')
    // Uma região viva ocupada não é anunciada
    expect(s.props['aria-busy']).toBeUndefined()
    expect(s).not.toBeBusy()
    expect(screen.getByText('Carregando')).toBeTruthy()
    const hidden = screen
      .getAllByTestId('skeleton-line', { includeHiddenElements: true })
      .filter(line => line.props['aria-hidden'] === true)
    expect(hidden).toHaveLength(2)
  })

  it('no app, continua um elemento só com o rótulo', () => {
    render(<Skeleton testID="s" label="Carregando a mesa" />)
    const s = screen.getByTestId('s')
    expect(s.props.accessible).toBe(true)
    expect(s.props.accessibilityLabel).toBe('Carregando a mesa')
    expect(screen.queryByText('Carregando a mesa')).toBeNull()
  })
})
