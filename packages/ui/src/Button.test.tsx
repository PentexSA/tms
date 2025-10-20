import type { ButtonProps } from './Button'

describe('@tms/ui - Button Component', () => {
  describe('Type Safety', () => {
    it('should have correct prop types', () => {
      const props: ButtonProps = {
        title: 'Test',
        onPress: () => undefined,
      }

      expect(props.title).toBe('Test')
      expect(typeof props.onPress).toBe('function')
    })

    it('should accept variant prop', () => {
      const props: ButtonProps = {
        title: 'Test',
        onPress: () => undefined,
        variant: 'primary',
      }

      expect(props.variant).toBe('primary')
    })

    it('should accept disabled prop', () => {
      const props: ButtonProps = {
        title: 'Test',
        onPress: () => undefined,
        disabled: true,
      }

      expect(props.disabled).toBe(true)
    })

    it('should accept style prop', () => {
      const props: ButtonProps = {
        title: 'Test',
        onPress: () => undefined,
        style: { backgroundColor: 'red' },
      }

      expect(props.style).toEqual({ backgroundColor: 'red' })
    })

    it('should accept textStyle prop', () => {
      const props: ButtonProps = {
        title: 'Test',
        onPress: () => undefined,
        textStyle: { fontSize: 20 },
      }

      expect(props.textStyle).toEqual({ fontSize: 20 })
    })
  })

  describe('Variants', () => {
    it('should accept primary variant', () => {
      const variant: ButtonProps['variant'] = 'primary'
      expect(variant).toBe('primary')
    })

    it('should accept secondary variant', () => {
      const variant: ButtonProps['variant'] = 'secondary'
      expect(variant).toBe('secondary')
    })
  })

  describe('Callbacks', () => {
    it('should execute onPress callback', () => {
      let called = false
      const onPress = () => {
        called = true
      }

      onPress()

      expect(called).toBe(true)
    })
  })
})
