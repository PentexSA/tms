#!/usr/bin/env node
// Sobe os source maps do export web ao Sentry (doc/plano-observabilidade.md,
// Fase 3), entre o `expo export` e o `find -delete` do Dockerfile: os maps
// existem só nesse trecho e nunca entram na imagem final.
//
// O deploy não pode depender do Sentry: sem token, ou com qualquer falha, o
// script registra o motivo e sai com 0. O token nunca é impresso.
//
// Uso: node scripts/sentry-sourcemaps.mjs <pasta do export>
// Ambiente:
//   SENTRY_AUTH_TOKEN_FILE  arquivo com o token (padrão: o secret do build,
//                           /run/secrets/sentry_auth_token); ou SENTRY_AUTH_TOKEN
//   SENTRY_ORG, SENTRY_PROJECT   obrigatórios para subir
//   SENTRY_URL              só se a conta não for a padrão (região)
//   TMS_SENTRY_CLI          outro executável no lugar do sentry-cli (testes)
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const log = message => console.log(`sentry-sourcemaps: ${message}`)

const dist = process.argv[2]
if (!dist) {
  console.error('uso: sentry-sourcemaps.mjs <pasta do export>')
  process.exit(2)
}

function readToken() {
  const file =
    process.env.SENTRY_AUTH_TOKEN_FILE ?? '/run/secrets/sentry_auth_token'
  try {
    if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  } catch {
    // arquivo ilegível: cai para a variável
  }
  return process.env.SENTRY_AUTH_TOKEN?.trim() ?? ''
}

function cliPath() {
  if (process.env.TMS_SENTRY_CLI) return process.env.TMS_SENTRY_CLI
  return createRequire(import.meta.url).resolve('@sentry/cli/bin/sentry-cli')
}

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

// O Metro do Expo já grava um debugId; o inject calcula o seu a partir do
// conteúdo final. Dois ids no mesmo arquivo confundem o casamento, então os do
// Metro saem antes.
function stripDebugIds(files) {
  let stripped = 0
  for (const file of files) {
    if (file.endsWith('.js.map') || file.endsWith('.map')) {
      const map = JSON.parse(readFileSync(file, 'utf8'))
      if ('debugId' in map || 'debug_id' in map) {
        delete map.debugId
        delete map.debug_id
        writeFileSync(file, JSON.stringify(map))
        stripped++
      }
    } else if (file.endsWith('.js')) {
      const source = readFileSync(file, 'utf8')
      const clean = source.replace(/^\/\/# debugId=.*$/gm, '')
      if (clean !== source) {
        writeFileSync(file, clean)
        stripped++
      }
    }
  }
  return stripped
}

function sentryCli(args, token) {
  const result = spawnSync(cliPath(), args, {
    encoding: 'utf8',
    env: { ...process.env, SENTRY_AUTH_TOKEN: token },
  })
  // A saída do CLI pode trazer URLs e nomes, nunca o token (vai por ambiente),
  // mas por garantia ele sai de qualquer linha
  const text = `${result.stdout ?? ''}${result.stderr ?? ''}`
    .split(token)
    .join('[token]')
  return { ok: result.status === 0, text: text.trim() }
}

function main() {
  const token = readToken()
  if (!token) {
    log('sem token (secret sentry_auth_token): source maps não enviados')
    return
  }
  if (!process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT) {
    log('SENTRY_ORG ou SENTRY_PROJECT ausente: source maps não enviados')
    return
  }
  const files = walk(dist)
  if (!files.some(f => f.endsWith('.map'))) {
    log(`nenhum source map em ${dist}: nada a enviar`)
    return
  }
  log(`${stripDebugIds(files)} arquivo(s) com debugId do Metro limpos`)

  // Sem --release: o casamento é pelo debug id, então um nome de release
  // diferente do que o app informa não quebra o upload
  const inject = sentryCli(['sourcemaps', 'inject', dist], token)
  if (!inject.ok) {
    log(`inject falhou, source maps não enviados:\n${inject.text}`)
    return
  }
  const upload = sentryCli(['sourcemaps', 'upload', dist], token)
  if (!upload.ok) {
    log(`upload falhou, o deploy segue sem source maps:\n${upload.text}`)
    return
  }
  log('source maps enviados')
}

try {
  main()
} catch (error) {
  log(
    `falha inesperada, o deploy segue sem source maps: ${error?.name ?? 'Error'}`
  )
}
process.exit(0)
