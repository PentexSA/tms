import { fireEvent, render, screen } from '@testing-library/react-native'
import { Button } from './Button'

describe('@tms/ui - Button', () => {
  it('renders the title and calls onPress', () => {
    const onPress = jest.fn()
    render(<Button title="Salvar" onPress={onPress} />)

    fireEvent.press(screen.getByText('Salvar'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn()
    render(<Button title="Salvar" onPress={onPress} disabled />)

    fireEvent.press(screen.getByText('Salvar'))

    expect(onPress).not.toHaveBeenCalled()
  })

  it('applies the secondary variant and custom styles', () => {
    render(
      <Button
        title="Descartar"
        onPress={() => undefined}
        variant="secondary"
        textStyle={{ letterSpacing: 1 }}
      />
    )

    expect(screen.getByText('Descartar')).toHaveStyle({
      color: '#000000',
      letterSpacing: 1,
    })
  })
})
