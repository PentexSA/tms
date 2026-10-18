// Texto puro: sem < > (nunca HTML), sem controles C0/C1 (exceto tab e
// quebras), sem DEL, sem controles bidi (U+202A–202E, U+2066–2069) e sem
// separadores U+2028/2029. Controles bidi permitiriam falsificar o texto
// exibido (ex.: um rótulo que aparece invertido).
//
// schema.json é mais estrito para rótulos (uma linha só, sem tab nem quebra);
// este aceita os dois porque textos de ajuda podem ter parágrafos.
export function isSafeText(s: string): boolean {
  if (/[<>]/.test(s)) return false
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) return false
    if (c >= 0x7f && c <= 0x9f) return false
    if (
      (c >= 0x202a && c <= 0x202e) ||
      (c >= 0x2066 && c <= 0x2069) ||
      c === 0x2028 ||
      c === 0x2029
    )
      return false
  }
  return true
}
