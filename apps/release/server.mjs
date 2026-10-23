import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { WebSocketServer } from 'ws'

import {
  buildApkArgs,
  buildInitArgs,
  buildLoginArgs,
  buildPushArgs,
  isApkName,
  isNostrRemote,
  redactSecrets
} from './commands.mjs'
import { startLocalRelay } from './local-relay.mjs'
import { createBunker, startBridge } from './nip46-bridge.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../..')
const require = createRequire(import.meta.url)
const { getVariantAppName, getVariantPackageId } = require(
  path.join(REPO_ROOT, 'apps/mobile/constants/variant.cjs')
)
const APK_DIR = path.join(REPO_ROOT, 'apps', 'mobile', 'dist', 'apks')
const RELEASE_APK = path.join(
  REPO_ROOT,
  'apps',
  'mobile',
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk'
)
const PAGE = path.join(HERE, 'public', 'index.html')
const LOGO = path.join(REPO_ROOT, 'apps', 'mobile', 'assets', 'icon.png')
const HOST = '127.0.0.1'
const PORT = 4717
const SIGNER_RELAY = startLocalRelay(log)
const MAX_BODY = 8192

const listeners = new Set()
let bunkerUrl = ''
let bridge = null
let pageSocket = null
let child = null
const signWaiters = new Map()

function send(res, status, body, type = 'application/json') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': type
  })
  res.end(payload)
}

function log(line) {
  const text = redactSecrets(line.endsWith('\n') ? line : `${line}\n`)
  process.stdout.write(text)
  for (const listener of listeners) {
    listener.write(`data: ${JSON.stringify(text)}\n\n`)
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('invalid json'))
      }
    })
    req.on('error', reject)
  })
}

function commandEnv(extra) {
  const env = { ...process.env, ...extra }
  for (const key of [
    'ALL_PROXY',
    'all_proxy',
    'HTTP_PROXY',
    'http_proxy',
    'HTTPS_PROXY',
    'https_proxy',
    'SOCKS_PROXY',
    'socks_proxy'
  ]) {
    delete env[key]
  }
  env.NO_PROXY = '127.0.0.1,localhost,::1'
  env.no_proxy = env.NO_PROXY
  return env
}

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    log(`$ ${command} ${args.map(redactSecrets).join(' ')}\n`)
    const proc = spawn(command, args, {
      cwd: REPO_ROOT,
      env: commandEnv(env),
      stdio: ['ignore', 'pipe', 'pipe']
    })
    child = proc
    const finish = (code) => {
      if (child === proc) {
        child = null
      }
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} exited with code ${code}`))
      }
    }
    proc.stdout.on('data', (chunk) => log(chunk.toString()))
    proc.stderr.on('data', (chunk) => log(chunk.toString()))
    proc.on('error', (error) => {
      if (child === proc) {
        child = null
      }
      reject(error)
    })
    proc.on('close', finish)
  })
}

function abortChild() {
  if (!child) {
    return
  }
  child.kill('SIGTERM')
  child = null
  log('aborted\n')
}

function gitLine(args) {
  return new Promise((resolve) => {
    const proc = spawn('git', args, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    let output = ''
    proc.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })
    proc.on('close', (code) => {
      resolve(code === 0 ? output.trim() : '')
    })
    proc.on('error', () => resolve(''))
  })
}

function gitOrigin() {
  return gitLine(['remote', 'get-url', 'origin'])
}

function gitBranch() {
  return gitLine(['rev-parse', '--abbrev-ref', 'HEAD'])
}

async function publishRepo() {
  await run('ngit', buildLoginArgs(bunkerUrl))
  log('logged in with the bunker alias. checking identity...\n')
  await run('ngit', ['account', 'whoami'])
  await run('ngit', buildInitArgs())
  await run('ngit', ['repo'])
}

async function pushBranch() {
  const origin = await gitOrigin()
  if (!isNostrRemote(origin)) {
    throw new Error('origin is not a nostr remote yet')
  }
  await run('ngit', buildLoginArgs(bunkerUrl))
  await run('git', buildPushArgs())
}

function releaseChannel(value) {
  return value === 'primary' ? 'primary' : 'dev'
}

async function publishZapstore(notes, only, channel) {
  const args = [
    'apps/mobile/scripts/publish-zapstore.mjs',
    '--yes',
    '--notes',
    notes,
    '--channel',
    releaseChannel(channel)
  ]
  if (only) {
    args.push('--only', only)
  }
  await run('node', args, { SIGN_WITH: bunkerUrl })
}

async function releaseChannels() {
  const branch = await gitBranch()
  const pkg = JSON.parse(
    await readFile(path.join(REPO_ROOT, 'apps/mobile/package.json'), 'utf8')
  )
  const versionName = typeof pkg.version === 'string' ? pkg.version : ''
  return {
    dev: {
      appName: getVariantAppName(true, branch),
      packageId: getVariantPackageId(true, branch),
      versionName
    },
    primary: {
      appName: getVariantAppName(false, ''),
      packageId: getVariantPackageId(false, ''),
      versionName
    }
  }
}

async function listApks() {
  let names
  try {
    names = await readdir(APK_DIR)
  } catch {
    return []
  }
  const files = []
  for (const name of names) {
    if (!isApkName(name)) {
      continue
    }
    const info = await stat(path.join(APK_DIR, name))
    if (!info.isFile()) {
      continue
    }
    files.push({
      bytes: info.size,
      modifiedAt: info.mtime.toISOString(),
      name
    })
  }
  files.sort((left, right) => (left.modifiedAt < right.modifiedAt ? 1 : -1))
  return files
}

async function releaseApk() {
  try {
    const info = await stat(RELEASE_APK)
    if (!info.isFile()) {
      return null
    }
    return {
      bytes: info.size,
      modifiedAt: info.mtime.toISOString(),
      name: 'app-release.apk'
    }
  } catch {
    return null
  }
}

function buildLocalApk(profile) {
  return run('pnpm', buildApkArgs(profile))
}

const actions = {
  announce: (body) =>
    publishZapstore(
      typeof body.notes === 'string' ? body.notes : '',
      'announce',
      body.channel
    ),
  apk: (body) =>
    buildLocalApk(typeof body.profile === 'string' ? body.profile : 'branch'),
  publish: () => publishRepo(),
  push: () => pushBranch(),
  zapstore: (body) =>
    publishZapstore(
      typeof body.notes === 'string' ? body.notes : '',
      '',
      body.channel
    ),
  zapstoreOnly: (body) =>
    publishZapstore(
      typeof body.notes === 'string' ? body.notes : '',
      'zapstore',
      body.channel
    )
}

function requireLocal(req, res) {
  const address = req.socket.remoteAddress
  const local =
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  if (!local) {
    send(res, 403, { error: 'localhost only' })
    return false
  }
  return true
}

const server = createServer(async (req, res) => {
  if (!requireLocal(req, res)) {
    return
  }
  const url = new URL(req.url ?? '/', `http://${HOST}`)

  if (req.method === 'GET' && url.pathname === '/') {
    const html = await readFile(PAGE, 'utf8')
    send(res, 200, html, 'text/html; charset=utf-8')
    return
  }

  if (req.method === 'GET' && url.pathname === '/logo.png') {
    const logo = await readFile(LOGO)
    res.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'image/png'
    })
    res.end(logo)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/config') {
    send(res, 200, { relays: [SIGNER_RELAY] })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/apks') {
    send(res, 200, { apks: await listApks() })
    return
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/apks/')) {
    const name = decodeURIComponent(url.pathname.slice('/api/apks/'.length))
    if (!isApkName(name)) {
      send(res, 400, { error: 'invalid apk name' })
      return
    }
    const filePath = path.join(APK_DIR, name)
    let info
    try {
      info = await stat(filePath)
    } catch {
      send(res, 404, { error: 'apk not found' })
      return
    }
    if (!info.isFile()) {
      send(res, 404, { error: 'apk not found' })
      return
    }
    res.writeHead(200, {
      'cache-control': 'no-store',
      'content-disposition': `attachment; filename="${name}"`,
      'content-length': info.size,
      'content-type': 'application/vnd.android.package-archive'
    })
    createReadStream(filePath).pipe(res)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    const origin = await gitOrigin()
    const branch = await gitBranch()
    send(res, 200, {
      branch,
      busy: child !== null,
      channels: await releaseChannels(),
      connected: bunkerUrl.startsWith('bunker://'),
      origin: redactSecrets(origin),
      published: isNostrRemote(origin),
      releaseApk: await releaseApk()
    })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/logs') {
    res.writeHead(200, {
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'content-type': 'text/event-stream'
    })
    res.write('\n')
    listeners.add(res)
    req.on('close', () => listeners.delete(res))
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/abort') {
    abortChild()
    bunkerUrl = ''
    send(res, 200, { ok: true })
    return
  }

  if (req.method !== 'POST') {
    send(res, 404, { error: 'not found' })
    return
  }

  let body
  try {
    body = await readBody(req)
  } catch (error) {
    send(res, 400, { error: error.message })
    return
  }

  if (url.pathname !== '/api/run') {
    send(res, 404, { error: 'not found' })
    return
  }

  const action = actions[body.action]
  if (!action) {
    send(res, 400, { error: 'unknown action' })
    return
  }
  if (body.action !== 'apk' && !bunkerUrl.startsWith('bunker://')) {
    send(res, 400, { error: 'connect the extension first' })
    return
  }
  if (child) {
    send(res, 409, { error: 'a command is already running' })
    return
  }

  send(res, 202, { ok: true })
  try {
    await action(body)
    log('done\n')
  } catch (error) {
    log(`error: ${error.message}\n`)
  }
})

function requestSignature(eventJson) {
  return new Promise((resolve, reject) => {
    if (!pageSocket || pageSocket.readyState !== 1) {
      reject(new Error('extension page is not connected'))
      return
    }
    const id = `${Date.now()}`
    signWaiters.set(id, { reject, resolve })
    pageSocket.send(JSON.stringify({ event: eventJson, id, type: 'sign' }))
  })
}

const pageSockets = new WebSocketServer({ path: '/api/signer', server })
pageSockets.on('connection', (socket) => {
  pageSocket = socket
  socket.on('message', async (raw) => {
    const message = JSON.parse(raw.toString())
    if (message.type === 'ready' && typeof message.userPubkey === 'string') {
      bridge?.close()
      const bunker = createBunker(SIGNER_RELAY)
      bunkerUrl = bunker.bunkerUrl
      bridge = startBridge({
        bunker,
        log,
        onSign: requestSignature,
        relayUrl: SIGNER_RELAY,
        userPubkey: message.userPubkey
      })
      await bridge.ready
      log('signer connected\n')
      socket.send(JSON.stringify({ type: 'ok' }))
      return
    }
    if (message.type === 'signed' || message.type === 'rejected') {
      const waiter = signWaiters.get(message.id)
      if (!waiter) {
        return
      }
      signWaiters.delete(message.id)
      if (message.type === 'signed') {
        waiter.resolve(message.event)
      } else {
        waiter.reject(
          new Error(message.error || 'extension rejected the signature')
        )
      }
    }
  })
  socket.on('close', () => {
    if (pageSocket === socket) {
      pageSocket = null
    }
  })
})

server.listen(PORT, HOST, () => {
  log(`release console at http://${HOST}:${PORT}\n`)
  log(`signer relay at ${SIGNER_RELAY}\n`)
})
