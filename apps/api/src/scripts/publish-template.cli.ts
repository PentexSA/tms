import { db } from '@tms/db'
import { main } from './publish-template'

// Entrada do `pnpm templates:publish`; a lógica (testada) fica em main().
const code = await main(process.argv.slice(2), {
  db,
  // pnpm -C muda o diretório; INIT_CWD é de onde o comando foi chamado
  cwd: process.env.INIT_CWD ?? process.cwd(),
  out: line => console.log(line),
  err: line => console.error(line),
})
await db.destroy()
process.exitCode = code
