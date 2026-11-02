// Onde o narrador estava em cada aba da crônica (P09-C, T-39): a rolagem
// por crônica e aba, para a tela voltar ao mesmo ponto depois de abrir uma
// ficha. No nativo a tela de baixo continua montada e isto não muda nada; no
// web, cobre o caso de o Expo Router desmontar a tela. Só números, só em
// memória: nada vai para o disco, e o logout apaga o mapa com o resto da
// sessão (SessionProvider).

const positions = new Map<string, number>()

const keyOf = (chronicleId: string, view: string) => `${chronicleId}:${view}`

export function rememberScroll(chronicleId: string, view: string, y: number) {
  if (!Number.isFinite(y) || y <= 0) positions.delete(keyOf(chronicleId, view))
  else positions.set(keyOf(chronicleId, view), y)
}

/** A rolagem guardada; 0 quando não há (o topo). */
export function scrollOf(chronicleId: string, view: string): number {
  return positions.get(keyOf(chronicleId, view)) ?? 0
}

export function clearChronicleScroll() {
  positions.clear()
}
