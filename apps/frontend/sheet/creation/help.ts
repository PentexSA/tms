// R-19 (P10-D §3.7): as frases do "?" nos nomes que o app dá às regras do
// motor (`priority-budget` e `freebies`). Não são termos do template: valem
// para qualquer sistema que use a regra, e moram aqui, junto do rótulo.
// Rascunho do time, para revisão (doc/planos-pacotes/P10-D-frases.json, `app`).

export const CREATION_HELP = {
  priority: {
    subject: 'Prioridade',
    text: 'Ordene os grupos: o primeiro recebe mais pontos para distribuir, o último recebe menos. Atributos e Habilidades têm cada um a sua ordem.',
  },
  freebies: {
    subject: 'pontos de bônus',
    text: 'Pontos extras, gastos depois dos básicos. Cada característica cobra um preço diferente por ponto; a aba Pontos mostra quanto sobra.',
  },
} as const
