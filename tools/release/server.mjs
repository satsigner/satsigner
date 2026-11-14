import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { WebSocketServer } from 'ws'

import { readListing } from '../../apps/mobile/scripts/zapstore-listing.mjs'
import { inspectApk, newestApkFor, queryLiveAsset } from './apk-inspect.mjs'
import { libraryChecks, securityChecks, zapstoreChecks } from './apk-review.mjs'
import { findApksigner } from './apk-signer.mjs'
import {
  buildApkArgs,
  buildInitArgs,
  buildLoginArgs,
  buildPushArgs,
  buildZapstoreArgs,
  classifyLogLine,
  createLineSplitter,
  hasInstalledPackage,
  isApkName,
  isNostrRemote,
  parseAdbDevices,
  parsePackageList,
  parseReleaseChannel,
  parseRequestBody,
  redactSecrets
} from './commands.mjs'
import { RELEASE_CERT_SHA256, releaseKeyStatus } from './keystore.mjs'
import { startLocalRelay } from './local-relay.mjs'
import { createBunker, startBridge } from './nip46-bridge.mjs'
import {
  libraryPermissions,
  withPermissionStatus
} from './permission-check.mjs'
import { signalProcessGroup, stopProcessGroup } from './process-group.mjs'
import { versionStatus } from './version.mjs'

const execFileAsync = promisify(execFile)

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../..')
const require = createRequire(import.meta.url)
const {
  ADAPTIVE_ICON_BACKGROUND,
  getVariantAppName,
  getVariantIcons,
  getVariantPackageId
} = require(path.join(REPO_ROOT, 'apps/mobile/constants/variant.cjs'))
const MOBILE_DIR = path.join(REPO_ROOT, 'apps', 'mobile')
const APK_DIR = path.join(REPO_ROOT, 'apps', 'mobile', 'dist', 'apks')
const LISTING_DIR = path.join(REPO_ROOT, 'apps', 'mobile', 'zapstore')
const IMAGE_TYPES = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}
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
const { version: TOOL_VERSION } = require('./package.json')
const LOGO = path.join(REPO_ROOT, 'apps', 'mobile', 'assets', 'logo.png')
const HOST = '127.0.0.1'
const PORT = 4717
const SIGNER_RELAY = startLocalRelay(log)
const MAX_BODY = 8192
const MAX_PENDING_LOG_LINE = 64 * 1024
const ADB_TIMEOUT_MS = 5000

const listeners = new Set()
let bunkerUrl = ''
let bridge = null
let bridgePubkey = ''
let pageSocket = null
let child = null
let job = null
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
  for (const entry of text.slice(0, -1).split('\n')) {
    const message = JSON.stringify({
      kind: classifyLogLine(entry),
      text: entry
    })
    for (const listener of listeners) {
      listener.write(`data: ${message}\n\n`)
    }
  }
}

function lineLogger() {
  const splitter = createLineSplitter(MAX_PENDING_LOG_LINE)
  return {
    flush() {
      for (const line of splitter.end()) {
        log(line)
      }
    },
    write(chunk) {
      for (const line of splitter.write(chunk)) {
        log(line)
      }
    }
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
      try {
        resolve(parseRequestBody(Buffer.concat(chunks).toString('utf8')))
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
    if (job?.cancelled) {
      reject(new Error('cancelled'))
      return
    }
    const commandLine = `${command} ${args.map(redactSecrets).join(' ')}`
    log(`$ ${commandLine}\n`)
    const proc = spawn(command, args, {
      cwd: REPO_ROOT,
      detached: true,
      env: commandEnv(env),
      stdio: ['ignore', 'pipe', 'pipe']
    })
    child = proc
    if (job) {
      job.command = commandLine
    }
    const stdout = lineLogger()
    const stderr = lineLogger()
    const finish = (code) => {
      stdout.flush()
      stderr.flush()
      if (child === proc) {
        child = null
      }
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} exited with code ${code}`))
      }
    }
    proc.stdout.on('data', (chunk) => stdout.write(chunk))
    proc.stderr.on('data', (chunk) => stderr.write(chunk))
    proc.on('error', (error) => {
      if (child === proc) {
        child = null
      }
      reject(error)
    })
    proc.on('close', finish)
  })
}

function cancelJob() {
  if (!job || job.cancelled) {
    return false
  }
  job.cancelled = true
  if (child) {
    stopProcessGroup(child)
  }
  log('cancelling\n')
  return true
}

async function runJob(name, action) {
  job = { action: name, cancelled: false, command: '', startedAt: Date.now() }
  try {
    await action()
    log('done\n')
  } catch (error) {
    log(job.cancelled ? 'cancelled\n' : `error: ${error.message}\n`)
  } finally {
    job = null
  }
}

function jobStatus() {
  if (!job) {
    return null
  }
  return {
    action: job.action,
    cancelling: job.cancelled,
    command: job.command,
    startedAt: new Date(job.startedAt).toISOString()
  }
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
  return parseReleaseChannel(value) ?? 'dev'
}

async function appVersion() {
  const pkg = JSON.parse(
    await readFile(path.join(REPO_ROOT, 'apps/mobile/package.json'), 'utf8')
  )
  return typeof pkg.version === 'string' ? pkg.version : ''
}

async function publishZapstore(body, only) {
  const args = buildZapstoreArgs({
    channel: releaseChannel(body.channel),
    confirmedVersion: body.confirmedVersion,
    currentVersion: await appVersion(),
    only
  })
  await run('node', args, {
    RELEASE_NOTES: typeof body.notes === 'string' ? body.notes : '',
    SIGN_WITH: bunkerUrl
  })
}

async function releaseChannels() {
  const branch = await gitBranch()
  const versionName = await appVersion()
  return {
    dev: {
      appName: getVariantAppName(true, branch),
      packageId: getVariantPackageId(true, branch),
      versionName
    },
    generic: {
      appName: getVariantAppName(true, ''),
      packageId: getVariantPackageId(true, ''),
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

async function adbOutput(args) {
  try {
    const { stdout } = await execFileAsync('adb', args, {
      killSignal: 'SIGKILL',
      timeout: ADB_TIMEOUT_MS
    })
    return { ok: true, output: stdout }
  } catch {
    return { ok: false, output: '' }
  }
}

async function adbText(args) {
  const { ok, output } = await adbOutput(args)
  return ok ? output : ''
}

async function serialHasPackage(serial, packageId) {
  const { ok, output } = await adbOutput([
    '-s',
    serial,
    'shell',
    'pm',
    'list',
    'packages',
    packageId
  ])
  if (!ok) {
    throw new Error(`could not check installed packages on ${serial}`)
  }
  return hasInstalledPackage(output, packageId)
}

async function installedPackages() {
  const serials = parseAdbDevices(await adbText(['devices']))
  const names = new Set()
  for (const serial of serials) {
    const listed = parsePackageList(
      await adbText([
        '-s',
        serial,
        'shell',
        'pm',
        'list',
        'packages',
        'com.satsigner'
      ])
    )
    for (const name of listed) {
      names.add(name)
    }
  }
  return [...names]
}

async function uninstallPackage(channel) {
  const known = parseReleaseChannel(channel)
  if (!known) {
    throw new Error('unknown release channel')
  }
  const channels = await releaseChannels()
  const selected = channels[known]
  const serials = parseAdbDevices(await adbText(['devices']))
  if (serials.length === 0) {
    throw new Error('no Android device is connected')
  }
  const failed = []
  for (const serial of serials) {
    if (!(await serialHasPackage(serial, selected.packageId))) {
      log(`${selected.packageId} is not installed on ${serial}, skipping\n`)
      continue
    }
    try {
      await run('adb', ['-s', serial, 'uninstall', selected.packageId])
    } catch {
      failed.push(serial)
    }
  }
  if (failed.length > 0) {
    throw new Error(`could not uninstall from ${failed.join(', ')}`)
  }
}

function buildLocalApk(body) {
  return run(
    'pnpm',
    buildApkArgs({
      identity: typeof body.identity === 'string' ? body.identity : 'branch',
      kind: typeof body.kind === 'string' ? body.kind : 'all'
    })
  )
}

const actions = {
  announce: (body) => publishZapstore(body, 'announce'),
  apk: (body) => buildLocalApk(body),
  publish: () => publishRepo(),
  push: () => pushBranch(),
  uninstall: (body) => uninstallPackage(body.channel),
  zapstore: (body) => publishZapstore(body, ''),
  zapstoreOnly: (body) => publishZapstore(body, 'zapstore')
}

const ALLOWED_HOSTS = new Set([
  `${HOST}:${PORT}`,
  `localhost:${PORT}`,
  `[::1]:${PORT}`
])

function isTrustedLocalRequest(req) {
  const address = req.socket.remoteAddress
  const local =
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  if (!local) {
    return false
  }
  const host = req.headers.host ?? ''
  if (!ALLOWED_HOSTS.has(host)) {
    return false
  }
  const { origin } = req.headers
  if (typeof origin !== 'string' || origin.length === 0) {
    return true
  }
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function requireLocal(req, res) {
  if (!isTrustedLocalRequest(req)) {
    send(res, 403, { error: 'localhost only' })
    return false
  }
  return true
}

// An unhandled stream error would stop the console, and a branch checkout can
// remove an image while it runs.
function sendImage(res, file) {
  const stream = createReadStream(file)
  stream.on('open', () => {
    res.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': IMAGE_TYPES[path.extname(file).toLowerCase()]
    })
    stream.pipe(res)
  })
  stream.on('error', () => {
    if (res.headersSent) {
      res.destroy()
      return
    }
    send(res, 404, { error: 'image not found' })
  })
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

  if (req.method === 'GET' && url.pathname === '/api/keys') {
    send(res, 200, { ...releaseKeyStatus(), apksigner: apksignerStatus() })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/preview') {
    try {
      send(res, 200, await releasePreview(url.searchParams.get('channel')))
    } catch (error) {
      send(res, 500, { error: error.message })
    }
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/listing/icon-background') {
    sendImage(res, path.resolve(MOBILE_DIR, ADAPTIVE_ICON_BACKGROUND))
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/listing/icon') {
    const file = await launcherIconFile(
      releaseChannel(url.searchParams.get('channel'))
    )
    sendImage(res, file)
    return
  }

  if (
    req.method === 'GET' &&
    url.pathname.startsWith('/api/listing/screenshots/')
  ) {
    const screenshot = listingScreenshot(
      apkNameFromPath(url.pathname, '/api/listing/screenshots/')
    )
    if (!screenshot) {
      send(res, 404, { error: 'screenshot not found' })
      return
    }
    sendImage(res, screenshot)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/apks') {
    send(res, 200, { apks: await listApks() })
    return
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/apks/')) {
    const name = apkNameFromPath(url.pathname)
    if (!name || !isApkName(name)) {
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
      busy: job !== null,
      channels: await releaseChannels(),
      connected: bunkerUrl.startsWith('bunker://'),
      installedPackages: await installedPackages(),
      job: jobStatus(),
      origin: redactSecrets(origin),
      published: isNostrRemote(origin),
      releaseApk: await releaseApk(),
      toolVersion: TOOL_VERSION
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

  if (req.method === 'GET' && url.pathname === '/api/version') {
    try {
      send(res, 200, await versionStatus())
    } catch (error) {
      send(res, 500, { error: error.message })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/cancel') {
    send(res, 200, { cancelled: cancelJob() })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/abort') {
    cancelJob()
    bunkerUrl = ''
    bridge?.close()
    bridge = null
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

  const action = Object.hasOwn(actions, body.action)
    ? actions[body.action]
    : undefined
  if (!action) {
    send(res, 400, { error: 'unknown action' })
    return
  }
  if (
    body.action !== 'apk' &&
    body.action !== 'uninstall' &&
    !bunkerUrl.startsWith('bunker://')
  ) {
    send(res, 400, { error: 'connect the extension first' })
    return
  }
  if (job) {
    send(res, 409, { error: 'a command is already running' })
    return
  }

  send(res, 202, { ok: true })
  await runJob(body.action, () => action(body))
})

function apksignerStatus() {
  try {
    return { path: findApksigner() }
  } catch (error) {
    return { error: error.message }
  }
}

function listingScreenshot(name) {
  return readListing(LISTING_DIR).images.find(
    (image) => path.basename(image) === name
  )
}

function listingPreview() {
  const listing = readListing(LISTING_DIR)
  return {
    ...listing,
    screenshots: listing.images.map((image) => path.basename(image))
  }
}

async function launcherIconFile(channel) {
  const branch = channel === 'dev' ? await gitBranch() : ''
  const { adaptiveForeground } = getVariantIcons(channel !== 'primary', branch)
  return path.resolve(MOBILE_DIR, adaptiveForeground)
}

async function releasePreview(value) {
  const channel = releaseChannel(value)
  const channels = await releaseChannels()
  const { appName, packageId, versionName } = channels[channel]
  const listing = listingPreview()
  const namePrefix =
    channel === 'primary' ? 'satsigner-prod-' : 'satsigner-dev-'
  const [file, live] = await Promise.all([
    newestApkFor(APK_DIR, namePrefix, packageId),
    queryLiveAsset(packageId)
  ])
  const base = {
    appName,
    beforeBuild: libraryChecks(libraryPermissions()),
    channel,
    listing: {
      description: listing.description,
      screenshots: listing.screenshots,
      summary: listing.summary
    },
    live,
    packageId,
    versionName
  }
  if (!file) {
    return base
  }
  const inspected = await inspectApk(file.path)
  const apk = {
    ...inspected,
    permissions: withPermissionStatus(inspected.permissions)
  }
  return {
    ...base,
    apk: { ...apk, name: file.name },
    checks: {
      security: securityChecks(apk),
      zapstore: zapstoreChecks({
        apk,
        expectedPackageId: packageId,
        listing,
        live: live.asset,
        liveError: live.error,
        releaseFingerprint: RELEASE_CERT_SHA256
      })
    }
  }
}

function apkNameFromPath(pathname, prefix = '/api/apks/') {
  try {
    return decodeURIComponent(pathname.slice(prefix.length))
  } catch {
    return ''
  }
}

function requestSignature(eventJson) {
  return new Promise((resolve, reject) => {
    if (!pageSocket || pageSocket.readyState !== 1) {
      reject(new Error('extension page is not connected'))
      return
    }
    const id = randomUUID()
    signWaiters.set(id, { reject, resolve })
    pageSocket.send(JSON.stringify({ event: eventJson, id, type: 'sign' }))
  })
}

// A running job signs through the bunker it started with. A reload or a second
// tab takes over the signature requests through pageSocket, so it keeps that
// bunker instead of closing it under the job.
async function connectSigner(userPubkey) {
  if (job !== null && bridge) {
    if (userPubkey !== bridgePubkey) {
      throw new Error(
        'a command is signing with another account; sign in again after it finishes'
      )
    }
    log('signer reattached to the running command\n')
    return
  }
  bridge?.close()
  const bunker = createBunker(SIGNER_RELAY)
  bunkerUrl = bunker.bunkerUrl
  bridgePubkey = userPubkey
  bridge = startBridge({
    bunker,
    log,
    onSign: requestSignature,
    relayUrl: SIGNER_RELAY,
    userPubkey
  })
  await bridge.ready
  log('signer connected\n')
}

const pageSockets = new WebSocketServer({
  path: '/api/signer',
  server,
  verifyClient: ({ req }) => isTrustedLocalRequest(req)
})
pageSockets.on('connection', (socket) => {
  socket.on('message', async (raw) => {
    let message
    try {
      message = JSON.parse(raw.toString())
    } catch (error) {
      log(`signer: bad message ${error.message}\n`)
      return
    }
    try {
      if (message.type === 'ready' && typeof message.userPubkey === 'string') {
        await connectSigner(message.userPubkey)
        // Only a page whose account the bunker accepted gets signature requests.
        pageSocket = socket
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
    } catch (error) {
      log(`signer: ${error.message}\n`)
      socket.send(JSON.stringify({ error: error.message, type: 'error' }))
    }
  })
  socket.on('close', () => {
    if (pageSocket === socket) {
      pageSocket = null
      for (const waiter of signWaiters.values()) {
        waiter.reject(new Error('extension page disconnected'))
      }
      signWaiters.clear()
    }
  })
})

// Jobs run in their own process group, so Ctrl+C on the console no longer
// reaches them; stop the running one before exiting.
function stopRunningJobAndExit() {
  if (child) {
    signalProcessGroup(child.pid, 'SIGTERM')
  }
  process.exit(0)
}

process.once('SIGINT', stopRunningJobAndExit)
process.once('SIGTERM', stopRunningJobAndExit)

server.listen(PORT, HOST, () => {
  log(`release console at http://${HOST}:${PORT}\n`)
  log(`signer relay at ${SIGNER_RELAY}\n`)
})
