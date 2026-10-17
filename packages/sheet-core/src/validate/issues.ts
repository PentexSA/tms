// Problema encontrado por um validador. `path` aponta o campo (ex.:
// `values.blood.current`) para o cliente marcar o erro; vazio quando o problema
// é do documento inteiro. Nunca contém o valor recebido.
export interface Issue {
  path: string
  message: string
}

// Formato de linha usado em logs e no build do design (`<prefixo> <path>: <msg>`).
export function formatIssue(prefix: string, issue: Issue): string {
  return issue.path
    ? `${prefix} ${issue.path}: ${issue.message}`
    : `${prefix}: ${issue.message}`
}
