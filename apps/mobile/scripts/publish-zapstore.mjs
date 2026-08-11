#!/usr/bin/env node

/**
 * SatSigner Zapstore publisher.
 *
 * 1. Prompts for nsec or mnemonic (input hidden, never written to disk)
 * 2. EAS local build (development profile) -> APK
 * 3. zsp publish: uploads APK to Blossom + signs/publishes to Zapstore relays
 * 4. Publishes a kind 1 nostr announcement
 *
 * Usage:
 *   node scripts/publish-zapstore.mjs [--blossom <url>] [--notes "release notes"]
 *
 *   --blossom  Blossom server URL (default: https://cdn.zapstore.dev)
 *   --notes    Pre-fill the kind 1 announcement text (skips the interactive prompt)
 *
 * Prerequisites (one-time setup):
 *   npm i -g eas-cli
 *   go install github.com/zapstore/zsp@latest
 *   zapstore.yaml must exist at repo root (copy from zapstore.yaml.example)
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'

import { nip19, getPublicKey, finalizeEvent } from 'nostr-tools'
import * as nip06 from 'nostr-tools/nip06'
import { SimplePool } from 'nostr-tools/pool'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MOBILE_DIR = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(MOBILE_DIR, '../..')
const require = createRequire(import.meta.url)
const { version: APP_VERSION } = require('../package.json')

const args = process.argv.slice(2)
const blossomFlagIdx = args.indexOf('--blossom')
const notesFlagIdx = args.indexOf('--notes')
const ANDROID_DIR = path.join(MOBILE_DIR, 'android')
const APK_OUTPUT = path.join(
  ANDROID_DIR,
  'app/build/outputs/apk/release/app-release.apk'
)

const BLOSSOM_URL =
  blossomFlagIdx !== -1
    ? (args[blossomFlagIdx + 1] ?? 'https://cdn.zapstore.dev')
    : 'https://cdn.zapstore.dev'
const NOTES_ARG = notesFlagIdx !== -1 ? (args[notesFlagIdx + 1] ?? null) : null
const EAS_PROFILE = 'development'
const ZAPSTORE_APP_URL = 'https://zapstore.dev/app/com.satsigner.satsigner.dev'

const ANNOUNCEMENT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.mom'
]

// ── secure prompt (no echo) ───────────────────────────────────────────────────

function promptSecret(question) {
  return new Promise((resolve) => {
    process.stdout.write(question)
    const chars = []
    process.stdin.setRawMode(true)
    process.stdin.setEncoding('utf8')
    process.stdin.resume()

    function onData(char) {
      if (char === '\r' || char === '\n' || char === '\u0004') {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(chars.join(''))
      } else if (char === '\u0003') {
        process.stdout.write('\n')
        process.exit(1)
      } else if (char === '\u007F') {
        chars.pop()
      } else {
        chars.push(char)
      }
    }

    process.stdin.on('data', onData)
  })
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// ── key resolution ────────────────────────────────────────────────────────────

async function resolveSecretKey() {
  const choice = await prompt('Sign with (1) nsec  (2) mnemonic  [1/2]: ')

  if (choice === '2') {
    const mnemonic = await promptSecret('Mnemonic (space-separated words): ')
    const words = mnemonic.trim()
    if (words.split(' ').length < 12) {
      throw new Error('Mnemonic must be at least 12 words')
    }
    const hexKey = nip06.privateKeyFromSeedWords(words)
    return Buffer.from(hexKey, 'hex')
  }

  const raw = await promptSecret('nsec: ')
  const nsec = raw.trim()
  if (!nsec.startsWith('nsec1')) {
    throw new Error('Input does not look like an nsec (must start with nsec1)')
  }
  const decoded = nip19.decode(nsec)
  if (decoded.type !== 'nsec') {
    throw new Error('Failed to decode nsec')
  }
  return Buffer.from(decoded.data)
}

// ── child process runner ──────────────────────────────────────────────────────

function run(cmd, args, { env = {}, cwd = MOBILE_DIR } = {}) {
  return new Promise((resolve, reject) => {
    const lines = []
    const proc = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['inherit', 'pipe', 'pipe']
    })

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      process.stdout.write(text)
      lines.push(...text.split('\n'))
    })

    proc.stderr.on('data', (chunk) => {
      process.stderr.write(chunk)
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`"${cmd} ${args.join(' ')}" exited with code ${code}`))
      } else {
        resolve(lines)
      }
    })
  })
}

// ── nostr announcement ────────────────────────────────────────────────────────

async function publishAnnouncement(secretKey, releaseNotes) {
  const contentLines = [`SatSigner v${APP_VERSION} is out!`]
  if (releaseNotes) {
    contentLines.push('', releaseNotes)
  }
  contentLines.push(
    '',
    ZAPSTORE_APP_URL,
    '',
    '#release #bitcoin #satsigner #nostr'
  )

  const event = finalizeEvent(
    {
      content: contentLines.join('\n'),
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [
        ['t', 'release'],
        ['t', 'bitcoin'],
        ['t', 'satsigner']
      ]
    },
    secretKey
  )

  const pool = new SimplePool()
  console.log('\nPublishing announcement to relays...')

  const results = await Promise.allSettled(
    pool.publish(ANNOUNCEMENT_RELAYS, event)
  )
  for (const [i, result] of results.entries()) {
    const relay = ANNOUNCEMENT_RELAYS[i]
    if (result.status === 'fulfilled') {
      console.log(`  ok  ${relay}`)
    } else {
      console.log(`  err ${relay}: ${result.reason?.message ?? result.reason}`)
    }
  }

  pool.close(ANNOUNCEMENT_RELAYS)
  console.log(`\nEvent id: ${event.id}`)
}

// ── pre-flight checks ─────────────────────────────────────────────────────────

function checkPrerequisites() {
  const zapstoreYaml = path.join(REPO_ROOT, 'zapstore.yaml')
  if (!existsSync(zapstoreYaml)) {
    throw new Error(
      `zapstore.yaml not found at ${zapstoreYaml}\n` +
        'Create it first: cp zapstore.yaml.example zapstore.yaml\n' +
        'Then fill in your npub.'
    )
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4

function step(n, label) {
  console.log(`\n[${n}/${TOTAL_STEPS}] ${label}`)
}

async function main() {
  console.log('=== SatSigner Zapstore Publisher ===')
  console.log(`  App version : v${APP_VERSION}`)
  console.log(`  EAS profile : ${EAS_PROFILE}`)
  console.log(`  Blossom URL : ${BLOSSOM_URL}`)
  console.log(`  Zapstore    : ${ZAPSTORE_APP_URL}`)
  console.log(`  Relays      : ${ANNOUNCEMENT_RELAYS.join(', ')}`)
  console.log('\nWhat will happen:')
  console.log('  1. You enter your nsec or seed words (hidden, never saved)')
  console.log('  2. EAS builds the Android APK locally')
  console.log('  3. zsp uploads APK to Blossom and publishes to Zapstore relay')
  console.log(
    '  4. A kind 1 nostr note is signed and posted as release announcement'
  )
  console.log('')

  checkPrerequisites()

  step(1, 'Sign in — enter your key')
  console.log(
    '  Your key is used to sign the Zapstore event and the announcement.'
  )
  console.log('  It is never written to disk.\n')

  const secretKey = await resolveSecretKey()
  const nsecForZsp = nip19.nsecEncode(secretKey)
  const pubkey = getPublicKey(secretKey)
  console.log(`  Pubkey: ${pubkey}`)

  step(2, 'Build APK')
  console.log('  Running: ./gradlew assembleRelease\n')

  const androidHome =
    process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`

  await run('./gradlew', ['assembleRelease'], {
    cwd: ANDROID_DIR,
    env: { ANDROID_HOME: androidHome }
  })

  if (!existsSync(APK_OUTPUT)) {
    throw new Error(`APK not found at expected path:\n  ${APK_OUTPUT}`)
  }

  const apkPath = APK_OUTPUT
  console.log(`\n  APK: ${apkPath}`)

  step(3, 'Publish to Zapstore')
  console.log(`  Uploading APK to Blossom (${BLOSSOM_URL})`)
  console.log(
    '  Signing and publishing Zapstore event to wss://relay.zapstore.dev\n'
  )

  const zspBin = process.env.ZSP_BIN ?? `${process.env.HOME}/go/bin/zsp`
  try {
    await run(zspBin, ['publish', apkPath], {
      cwd: REPO_ROOT,
      env: {
        BLOSSOM_URL,
        SIGN_WITH: nsecForZsp
      }
    })
  } catch {
    // zsp exits 1 on partial publish failures (e.g. relay whitelisting pending).
    // Continue to the announcement step anyway.
    console.log('\n  zsp exited with errors — continuing to announcement step.')
  }

  step(4, 'Post release announcement')

  const releaseNotes =
    NOTES_ARG !== null
      ? NOTES_ARG
      : await prompt('  Release notes (optional, press Enter to skip): ')

  const noteLines = [`SatSigner v${APP_VERSION} is out!`]
  if (releaseNotes) {
    noteLines.push('', releaseNotes)
  }
  noteLines.push(
    '',
    ZAPSTORE_APP_URL,
    '',
    '#release #bitcoin #satsigner #nostr'
  )

  console.log('\n  Note preview:')
  console.log('  ┌─────────────────────────────────────────────')
  for (const line of noteLines) {
    console.log(`  │ ${line || ''}`)
  }
  console.log('  └─────────────────────────────────────────────')

  const confirm = await prompt('\n  Publish this note? [y/N]: ')
  if (confirm.toLowerCase() !== 'y') {
    console.log('  Skipped.')
  } else {
    await publishAnnouncement(secretKey, releaseNotes || null)
  }

  secretKey.fill(0)

  console.log('\nDone.')
  process.exit(0)
}

try {
  await main()
} catch (error) {
  console.error('\nError:', error.message)
  process.exit(1)
}
