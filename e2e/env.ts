// Portas e banco do E2E, separados do dev: o teste apaga o banco a cada rodada.
export const API_PORT = 3101
export const WEB_PORT = 8181
export const API_URL = `http://localhost:${API_PORT}`
export const WEB_URL = `http://localhost:${WEB_PORT}`
export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/tms_e2e'
