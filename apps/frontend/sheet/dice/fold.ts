// Busca sem acento e sem caixa: "ocultismo" acha "Ocultismo", "taum" acha
// "Taumaturgia", "forca" acha "Força".
export const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim()

export const matches = (label: string, query: string): boolean =>
  fold(label).includes(fold(query))
