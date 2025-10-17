import { describe, expect, it } from 'vitest'
import type { ScreenProps } from './Screen'

describe('@tms/ui - Screen Component', () => {
  describe('Type Safety', () => {
    it('should have correct prop types', () => {
      const props: ScreenProps = {
        children: null,
      }

      expect(props.children).toBe(null)
    })

    it('should accept style prop', () => {
      const props: ScreenProps = {
        children: null,
        style: { backgroundColor: 'blue' },
      }

      expect(props.style).toEqual({ backgroundColor: 'blue' })
    })

    it('should accept safe prop', () => {
      const props: ScreenProps = {
        children: null,
        safe: true,
      }

      expect(props.safe).toBe(true)
    })

    it('should have safe prop default behavior', () => {
      const props: ScreenProps = {
        children: null,
      }

      expect(props.safe).toBeUndefined()
    })
  })

  describe('Safe Prop', () => {
    it('should accept safe as true', () => {
      const safe: ScreenProps['safe'] = true
      expect(safe).toBe(true)
    })

    it('should accept safe as false', () => {
      const safe: ScreenProps['safe'] = false
      expect(safe).toBe(false)
    })

    it('should accept safe as undefined', () => {
      const safe: ScreenProps['safe'] = undefined
      expect(safe).toBeUndefined()
    })
  })

  describe('Children', () => {
    it('should accept ReactNode as children', () => {
      const props: ScreenProps = {
        children: 'Text content',
      }

      expect(props.children).toBe('Text content')
    })

    it('should accept null as children', () => {
      const props: ScreenProps = {
        children: null,
      }

      expect(props.children).toBe(null)
    })

    it('should accept undefined as children', () => {
      const props: ScreenProps = {
        children: undefined,
      }

      expect(props.children).toBeUndefined()
    })
  })

  describe('Style', () => {
    it('should accept ViewStyle object', () => {
      const props: ScreenProps = {
        children: null,
        style: {
          flex: 1,
          backgroundColor: 'white',
          padding: 16,
        },
      }

      expect(props.style).toEqual({
        flex: 1,
        backgroundColor: 'white',
        padding: 16,
      })
    })

    it('should accept empty style object', () => {
      const props: ScreenProps = {
        children: null,
        style: {},
      }

      expect(props.style).toEqual({})
    })
  })
})
