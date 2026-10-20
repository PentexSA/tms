import Svg, { Path } from 'react-native-svg'

// Símbolos de criatura (template: identity.emblem), no lugar das iniciais do
// personagem. Um por criatura, o mesmo para qualquer clã, tribo ou tradição:
// o Ankh do Vampiro, a estrela de nove pontas do Mago (as Nove Esferas e as
// Nove Tradições) e as três marcas de garra do Lobisomem, que riscam as capas
// da linha. Traço na cor de quem chama, numa caixa de 24.
// O @tms/ui não conhece template: recebe só o nome, e um nome desconhecido
// não desenha nada (o Avatar volta às iniciais).

const C = 12
const R = 10.5

// {9/4}: nove pontas, ligando cada ponto ao quarto seguinte
const nineStar = (() => {
  const point = (k: number) => {
    const a = ((-90 + k * 40) * Math.PI) / 180
    return `${(C + R * Math.cos(a)).toFixed(2)} ${(C + R * Math.sin(a)).toFixed(2)}`
  }
  const order = Array.from({ length: 9 }, (_, i) => (i * 4) % 9)
  return `M${order.map(point).join(' L')} Z`
})()

const PATHS = {
  ankh: [
    'M12 11.5 C8.6 9.6 8.6 2.5 12 2.5 C15.4 2.5 15.4 9.6 12 11.5 Z',
    'M12 11.5 V21.5',
    'M6.5 12.5 H17.5',
  ],
  'nine-star': [nineStar],
  claws: [
    'M7 3.5 C9.5 9 9.5 15 7.5 20.5',
    'M12 2.5 C14.5 8.5 14.5 15.5 12.5 21.5',
    'M17 3.5 C19.5 9 19.5 15 17.5 20.5',
  ],
} as const satisfies Record<string, readonly string[]>

export type EmblemName = keyof typeof PATHS
export const EMBLEM_NAMES = Object.keys(PATHS) as EmblemName[]

export const isEmblem = (name: unknown): name is EmblemName =>
  typeof name === 'string' && Object.hasOwn(PATHS, name)

export interface EmblemProps {
  readonly name: EmblemName
  readonly size: number
  readonly color: string
  readonly testID?: string
}

/** Decorativo: o nome do personagem está ao lado. */
export function Emblem({ name, size, color, testID }: EmblemProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      testID={testID}
      accessible={false}
      aria-hidden
    >
      {PATHS[name].map(d => (
        <Path
          key={d}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  )
}
