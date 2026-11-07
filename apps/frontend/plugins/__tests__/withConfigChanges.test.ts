import { addConfigChanges } from '../withConfigChanges'

// O plugin do app.json que evita recriar a Activity ao mudar o tamanho da
// tela ou da fonte do sistema (onda-5.md §11.6)
const manifest = (configChanges?: string) => ({
  manifest: {
    application: [
      {
        $: { 'android:name': '.MainApplication' },
        activity: [
          {
            $: {
              'android:name': '.MainActivity',
              ...(configChanges === undefined
                ? {}
                : { 'android:configChanges': configChanges }),
            },
            'intent-filter': [
              {
                action: [
                  { $: { 'android:name': 'android.intent.action.MAIN' } },
                ],
                category: [
                  { $: { 'android:name': 'android.intent.category.LAUNCHER' } },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
})

const changes = (m: ReturnType<typeof manifest>) =>
  m.manifest.application[0]?.activity[0]?.$['android:configChanges']

describe('withConfigChanges', () => {
  it('acrescenta density e fontScale ao que o Expo já põe', () => {
    const m = addConfigChanges(
      manifest('keyboard|orientation|screenSize|smallestScreenSize|uiMode')
    )
    expect(changes(m)).toBe(
      'keyboard|orientation|screenSize|smallestScreenSize|uiMode|density|fontScale'
    )
  })

  it('não repete o que já está lá (rodar o prebuild duas vezes)', () => {
    const m = addConfigChanges(addConfigChanges(manifest('fontScale|uiMode')))
    expect(changes(m)).toBe('fontScale|uiMode|density')
  })

  it('sem configChanges, cria só os dois', () => {
    expect(changes(addConfigChanges(manifest()))).toBe('density|fontScale')
  })
})
