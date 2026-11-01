// Campo de nome próprio (o nome do personagem, na Nova ficha, no Novo NPC e
// no Editar): o corretor do iOS trocava "PO" por "PÔ" e marcava o texto
// (T-38). Sem corretor, sem verificação ortográfica e sem sugestão de
// preenchimento. A capitalização fica explícita em "sentences": "words"
// maiusculizaria "da", "de" e o "app" de "(PO app)".
export const properNameInput = {
  autoCorrect: false,
  spellCheck: false,
  autoComplete: 'off',
  autoCapitalize: 'sentences',
} as const
