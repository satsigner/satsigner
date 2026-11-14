import { execFile } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'

import WebSocket from 'ws'

import {
  findTrackers,
  isReleaseApkName,
  latestAsset,
  parseBadging,
  parsePermissions,
  parseSigners
} from './apk-review.mjs'
import { findApksigner, findBuildTool } from './apk-signer.mjs'

const execFileAsync = promisify(execFile)

const ZAPSTORE_RELAY = 'wss://relay.zapstore.dev'
const KIND_ASSET = 3063
const RELAY_TIMEOUT_MS = 8000
const LIVE_ASSET_LIMIT = 20
const TOOL_BUFFER_BYTES = 16 * 1024 * 1024
const DEX_BUFFER_BYTES = 1024 * 1024 * 1024

async function toolOutput(command, args, maxBuffer = TOOL_BUFFER_BYTES) {
  const { stdout } = await execFileAsync(command, args, {
    encoding: 'buffer',
    maxBuffer
  })
  return stdout
}

async function readBadging(apkPath) {
  const output = await toolOutput(findBuildTool('aapt2'), [
    'dump',
    'badging',
    apkPath
  ])
  return parseBadging(output.toString('utf8'))
}

async function inspectApk(apkPath) {
  const aapt2 = findBuildTool('aapt2')
  const [badging, permissions, signers, dex, info] = await Promise.all([
    readBadging(apkPath),
    toolOutput(aapt2, ['dump', 'permissions', apkPath]),
    toolOutput(findApksigner(), ['verify', '--print-certs', '-v', apkPath]),
    toolOutput('unzip', ['-p', apkPath, 'classes*.dex'], DEX_BUFFER_BYTES),
    stat(apkPath)
  ])
  return {
    ...badging,
    bytes: info.size,
    permissions: parsePermissions(permissions.toString('utf8')),
    signers: parseSigners(signers.toString('utf8')),
    trackers: findTrackers(dex)
  }
}

async function releaseApkNames(apkDir, namePrefix) {
  try {
    const names = await readdir(apkDir)
    return names.filter(
      (name) => name.startsWith(namePrefix) && isReleaseApkName(name)
    )
  } catch {
    return []
  }
}

async function newestApkFor(apkDir, namePrefix, packageId) {
  const names = await releaseApkNames(apkDir, namePrefix)
  const files = await Promise.all(
    names.map(async (name) => {
      const path = join(apkDir, name)
      const info = await stat(path)
      return { modified: info.mtimeMs, name, path }
    })
  )
  const newestFirst = files.toSorted((a, b) => b.modified - a.modified)
  for (const file of newestFirst) {
    const badging = await readBadging(file.path)
    if (badging.packageId === packageId) {
      return file
    }
  }
  return undefined
}

// A throw inside a ws listener is uncaught and would stop the whole console.
function parseFrame(data) {
  try {
    const frame = JSON.parse(data.toString())
    return Array.isArray(frame) ? frame : []
  } catch {
    return []
  }
}

function relayFinished(socket, packageId, events) {
  return new Promise((resolve, reject) => {
    socket.on('open', () => {
      socket.send(
        JSON.stringify([
          'REQ',
          'preview',
          { '#i': [packageId], kinds: [KIND_ASSET], limit: LIVE_ASSET_LIMIT }
        ])
      )
    })
    socket.on('message', (data) => {
      const frame = parseFrame(data)
      if (frame[0] === 'EVENT' && frame[2]?.kind === KIND_ASSET) {
        events.push(frame[2])
      }
      if (frame[0] === 'EOSE') {
        resolve()
      }
      if (frame[0] === 'CLOSED') {
        reject(new Error(`${ZAPSTORE_RELAY} refused the query: ${frame[2]}`))
      }
    })
    socket.on('error', reject)
  })
}

async function relayTimeout(signal) {
  await delay(RELAY_TIMEOUT_MS, undefined, { signal })
  throw new Error(`${ZAPSTORE_RELAY} did not answer`)
}

async function queryLiveAsset(packageId) {
  const socket = new WebSocket(ZAPSTORE_RELAY)
  const timeout = new AbortController()
  const events = []
  try {
    await Promise.race([
      relayFinished(socket, packageId, events),
      relayTimeout(timeout.signal)
    ])
    return { asset: latestAsset(events) }
  } catch (error) {
    return { error: error.message }
  } finally {
    timeout.abort()
    socket.terminate()
  }
}

export { inspectApk, newestApkFor, queryLiveAsset }
