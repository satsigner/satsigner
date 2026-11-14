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
 *   node scripts/publish-zapstore.mjs [--blossom <url>] [--notes "release notes"] [--yes] [--only zapstore|announce] [--dry-run]
 *
 *   --blossom   Blossom server URL (default: https://cdn.zapstore.dev)
 *   --notes     Pre-fill the kind 1 announcement text (skips the interactive prompt)
 *   --yes       Publish the announcement without a second prompt
 *   --channel   primary (Production), generic or dev. Production asks you to
 *               type the version in a terminal; it never runs unconfirmed,
 *               even with --yes, CI=true or AGENT=true.
 *   --confirm-production <version>
 *               Production confirmation for runs without a terminal. Only the
 *               release console passes it, after its own confirm dialog.
 *   --dry-run   Build the APK but skip zsp publish and announcement (safe testing)
 *
 * Non-interactive / agent / CI env vars:
 *   SIGN_WITH          nsec1..., bunker:// URL, or omit for interactive prompt
 *   SIGN_WITH_MNEMONIC Space-separated BIP39 mnemonic (alternative to SIGN_WITH nsec)
 *   RELEASE_NOTES      Release notes string (preferred over --notes to avoid argv injection)
 *   CI=true            Implies --yes (set automatically by most CI)
 *   AGENT=true         Same as CI=true — set when calling from an agent or script
 *   ZSP_BIN            Path to zsp binary (default: ~/go/bin/zsp, or %USERPROFILE%\go\bin\zsp.exe on Windows)
 *
 * Security note:
 *   Every channel needs the release keystore (~/.satsigner/release.p12). The
 *   public debug.keystore (password "android") must never sign a release.
 *
 * Prerequisites (one-time setup):
 *   npm i -g eas-cli
 *   go install github.com/zapstore/zsp@latest
 *   zapstore.yaml must exist at repo root (copy from zapstore.yaml.example)
 */

import { execFileSync, spawn } from 'child_process'
import { createHash } from 'crypto'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'fs'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import { parseArgs } from 'util'

import {
  nip19,
  getPublicKey,
  finalizeEvent,
  generateSecretKey
} from 'nostr-tools'
import * as nip06 from 'nostr-tools/nip06'
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46'
import { SimplePool } from 'nostr-tools/pool'

import { applyKeyRotation } from '../../../tools/release/apk-signer.mjs'
import {
  hasReleaseKeystore,
  keystoreFiles,
  lineagePath,
  newestSignerDir,
  readKeystorePassword,
  keystorePath as releaseKeystorePath,
  requireReleaseKeystore,
  signingEnv,
  storedCertificate
} from '../../../tools/release/keystore.mjs'
import { assertApkPermissions } from '../../../tools/release/permission-check.mjs'
import { LOCAL_ENV_FILES, buildEnvEntries } from './zapstore-build-env.mjs'
import {
  PRODUCTION_CHANNEL,
  assertChannelCanPublish,
  assertProductionConfirmed,
  assertProductionSource
} from './zapstore-channel.mjs'
import {
  KIND_IDENTITY_PROOF,
  ensureIdentityProof
} from './zapstore-identity.mjs'
import { publishConfig, readListing } from './zapstore-listing.mjs'
import { SOURCE_REPOSITORY, zspPublishArgs } from './zapstore-publish-args.mjs'
import { parseZspEvents, verifyOnZapstore } from './zapstore-verify.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MOBILE_DIR = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(MOBILE_DIR, '../..')
const require = createRequire(import.meta.url)
const { version: APP_VERSION } = require('../package.json')
const {
  ANDROID_ABI_ARM64,
  ANDROID_ABI_LABELS,
  getVariantPackageId,
  sanitizePackageSegment
} = require('../constants/variant.cjs')

// zsp expects an arm64-v8a APK. A universal build carries every CPU type and
// passes 400 MB, which never reached Zapstore's Blossom server.
const ZAPSTORE_ABI = ANDROID_ABI_ARM64
const GIT_MAX_BUFFER = 256 * 1024 * 1024

const { values: flags } = parseArgs({
  args: process.argv.slice(2),
  options: {
    blossom: { type: 'string' },
    channel: { type: 'string' },
    'confirm-production': { type: 'string' },
    'dry-run': { type: 'boolean' },
    notes: { type: 'string' },
    only: { type: 'string' },
    yes: { type: 'boolean' }
  },
  strict: true
})

// Agent / CI mode: CI=true or AGENT=true implies --yes
const isAgent = process.env.CI === 'true' || process.env.AGENT === 'true'
const yes = flags.yes === true || isAgent
const dryRun = flags['dry-run'] === true
const ZSP_BIN =
  process.env.ZSP_BIN ??
  (process.platform === 'win32'
    ? `${process.env.USERPROFILE}\\go\\bin\\zsp.exe`
    : `${process.env.HOME}/go/bin/zsp`)

// Key resolution — env takes precedence, interactive prompt is the fallback
const envSignWith = process.env.SIGN_WITH ?? ''
const envMnemonic = process.env.SIGN_WITH_MNEMONIC ?? ''
const bunkerUrl = envSignWith.startsWith('bunker://') ? envSignWith : ''
const envNsec = envSignWith.startsWith('nsec1') ? envSignWith : ''
const ANDROID_DIR = path.join(MOBILE_DIR, 'android')
const APK_OUTPUT = path.join(
  ANDROID_DIR,
  'app/build/outputs/apk/release/app-release.apk'
)

const BLOSSOM_URL = flags.blossom ?? 'https://cdn.zapstore.dev'
const NOTES_ARG =
  process.env.RELEASE_NOTES !== undefined
    ? process.env.RELEASE_NOTES
    : (flags.notes ?? null)
const ONLY = flags.only ?? ''
const CHANNEL = flags.channel ?? ''
const CONFIG_YAML = path.join(REPO_ROOT, 'zapstore.yaml')
const LISTING_DIR = path.join(MOBILE_DIR, 'zapstore')
const ZAPSTORE_ONLY = ONLY === 'zapstore'
const ANNOUNCE_ONLY = ONLY === 'announce'
const EAS_PROFILE = 'development'
function gitBranch() {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  }).trim()
}

function apkPackageId() {
  if (CHANNEL === 'primary') return getVariantPackageId(false, '')
  if (CHANNEL === 'generic') return getVariantPackageId(true, '')
  if (CHANNEL === 'dev') return getVariantPackageId(true, gitBranch())
  const gradlePath = path.join(ANDROID_DIR, 'app/build.gradle')
  if (!existsSync(gradlePath)) return 'com.satsigner.satsigner.dev'
  const gradle = readFileSync(gradlePath, 'utf8')
  const match = gradle.match(/applicationId '([^']+)'/)
  return match?.[1] ?? 'com.satsigner.satsigner.dev'
}

const ZAPSTORE_APP_URL = `https://zapstore.dev/apps/${apkPackageId()}`

const ANNOUNCEMENT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
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
  // Env-based nsec — no TTY or interactive prompt needed (agent / CI path)
  if (envNsec) {
    const decoded = nip19.decode(envNsec)
    if (decoded.type !== 'nsec') {
      throw new Error('SIGN_WITH does not decode to a valid nsec')
    }
    return Buffer.from(decoded.data)
  }

  // Env-based mnemonic (SIGN_WITH_MNEMONIC)
  if (envMnemonic) {
    const words = envMnemonic.trim()
    if (words.split(' ').length < 12) {
      throw new Error('SIGN_WITH_MNEMONIC must be at least 12 words')
    }
    const hexKey = nip06.privateKeyFromSeedWords(words)
    return Buffer.from(hexKey, 'hex')
  }

  // Interactive fallback (human at a terminal)
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
    const chunks = []
    // On Windows, spawn needs shell:true to find .cmd shims (pnpm.cmd, etc.)
    const isWindows = process.platform === 'win32'
    const proc = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: isWindows
    })

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      process.stdout.write(text)
      chunks.push(text)
    })

    proc.stderr.on('data', (chunk) => {
      process.stderr.write(chunk)
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`"${cmd} ${args.join(' ')}" exited with code ${code}`))
      } else {
        resolve(chunks.join('').split('\n'))
      }
    })
  })
}

// ── nostr announcement ────────────────────────────────────────────────────────

async function withBunker(callback) {
  const parsed = await parseBunkerInput(bunkerUrl)
  if (!parsed?.pubkey || parsed.relays.length === 0) {
    throw new Error('bunker URL is missing a pubkey or relay')
  }
  const signer = BunkerSigner.fromBunker(generateSecretKey(), parsed)
  await signer.connect()
  try {
    return await callback(signer)
  } finally {
    await signer.close()
  }
}

function signWithBunker(unsigned) {
  return withBunker((signer) => signer.signEvent(unsigned))
}

function publisherPubkey(secretKey) {
  return secretKey
    ? Promise.resolve(getPublicKey(secretKey))
    : withBunker((signer) => signer.getPublicKey())
}

async function signIdentityProof(signWith) {
  const output = await run(
    ZSP_BIN,
    [
      'identity',
      '--link-key',
      keystoreFiles(newestSignerDir()).keystore,
      '--offline'
    ],
    {
      cwd: REPO_ROOT,
      env: {
        KEYSTORE_PASSWORD: readKeystorePassword(newestSignerDir()),
        SIGN_WITH: signWith
      }
    }
  )
  const proof = parseZspEvents(output).find(
    (event) => event.kind === KIND_IDENTITY_PROOF
  )
  if (!proof) {
    throw new Error('zsp did not print a signed identity proof')
  }
  return proof
}

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

  const unsigned = {
    content: contentLines.join('\n'),
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [
      ['t', 'release'],
      ['t', 'bitcoin'],
      ['t', 'satsigner']
    ]
  }
  const event = secretKey
    ? finalizeEvent(unsigned, secretKey)
    : await signWithBunker(unsigned)

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
  if (!existsSync(CONFIG_YAML)) {
    throw new Error(
      `${CONFIG_YAML} not found.\n` +
        'Create it first: cp zapstore.yaml.example zapstore.yaml\n' +
        'Then fill in your npub.'
    )
  }
}

function git(args) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    maxBuffer: GIT_MAX_BUFFER
  })
}

function readTextFile(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : null
}

// Covers committed code, uncommitted edits, untracked files and the signing
// key, so a reused APK is always the one a fresh build would produce.
function isCleanTree() {
  return git(['status', '--porcelain']).toString().trim() === ''
}

function isHeadOnRemote() {
  return (
    git(['branch', '--remotes', '--contains', 'HEAD']).toString().trim() !== ''
  )
}

function checkProductionSource() {
  if (CHANNEL !== PRODUCTION_CHANNEL || dryRun || ANNOUNCE_ONLY) {
    return
  }
  assertProductionSource({
    channel: CHANNEL,
    cleanTree: isCleanTree(),
    onRemote: isHeadOnRemote()
  })
}

function sourceFingerprint() {
  const hash = createHash('sha256')
  hash.update(git(['rev-parse', 'HEAD']))
  hash.update(git(['diff', 'HEAD', '--binary']))
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'])
    .toString()
    .split('\0')
    .filter(Boolean)
  for (const file of untracked) {
    hash.update(file)
    hash.update(readFileSync(path.join(REPO_ROOT, file)))
  }
  if (hasReleaseKeystore()) {
    hash.update(readFileSync(releaseKeystorePath))
  }
  const newest = keystoreFiles(newestSignerDir()).keystore
  if (newest !== releaseKeystorePath) {
    hash.update(readFileSync(newest))
    hash.update(readFileSync(lineagePath))
  }
  for (const [name, value] of buildEnvEntries(process.env)) {
    hash.update(`${name}\0${value}\0`)
  }
  for (const file of LOCAL_ENV_FILES) {
    const envPath = path.join(MOBILE_DIR, file)
    if (existsSync(envPath)) {
      hash.update(file)
      hash.update(readFileSync(envPath))
    }
  }
  return hash.digest('hex')
}

// ── zsp ───────────────────────────────────────────────────────────────────────

function writeListingConfig(apkPath) {
  const { description, images, summary } = readListing(LISTING_DIR)
  console.log(
    `  Listing: summary ${summary.length}, description ${description.length} characters, ${images.length} screenshots`
  )
  const dir = mkdtempSync(path.join(tmpdir(), 'satsigner-zapstore-'))
  const file = path.join(dir, 'zapstore.yaml')
  writeFileSync(
    file,
    publishConfig({
      apkPath,
      description,
      images,
      repository: SOURCE_REPOSITORY,
      summary
    })
  )
  return { dir, file }
}

function removeListingConfig(listing) {
  if (listing) {
    rmSync(listing.dir, { force: true, recursive: true })
  }
}

async function runZspPublish(args, signWith, listing) {
  try {
    return await run(ZSP_BIN, args, {
      cwd: REPO_ROOT,
      env: {
        BLOSSOM_URL,
        SIGN_WITH: signWith
      }
    })
  } finally {
    removeListingConfig(listing)
  }
}

// ── production confirmation ───────────────────────────────────────────────────

function readProductionConfirmation() {
  if (flags['confirm-production'] !== undefined) {
    return Promise.resolve(flags['confirm-production'])
  }
  if (!process.stdin.isTTY) {
    return Promise.resolve(undefined)
  }
  console.log(
    '  Production updates everyone who installed Satsigner from Zapstore.'
  )
  return prompt(`  Type ${APP_VERSION} to publish it to Production: `)
}

async function confirmProduction() {
  if (CHANNEL !== PRODUCTION_CHANNEL || dryRun) {
    return
  }
  assertProductionConfirmed({
    channel: CHANNEL,
    confirmedVersion: await readProductionConfirmation(),
    version: APP_VERSION
  })
}

// ── main ──────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5

function step(n, label) {
  console.log(`\n[${n}/${TOTAL_STEPS}] ${label}`)
}

async function buildReleaseApk() {
  requireReleaseKeystore()

  if (CHANNEL !== 'primary' && CHANNEL !== 'dev' && CHANNEL !== 'generic') {
    if (apkPackageId() === getVariantPackageId(false, '')) {
      throw new Error(
        'android/ is prebuilt with the production package id. ' +
          'Publish Production with --channel primary, which builds and signs it with the release keystore.'
      )
    }
    console.log('  Running: ./gradlew assembleRelease\n')
    const androidHome =
      process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`
    await run('./gradlew', ['assembleRelease'], {
      cwd: ANDROID_DIR,
      env: signingEnv({ ...process.env, ANDROID_HOME: androidHome })
    })
    if (!existsSync(APK_OUTPUT)) {
      throw new Error(`APK not found at expected path:\n  ${APK_OUTPUT}`)
    }
    applyKeyRotation(APK_OUTPUT)
    return APK_OUTPUT
  }

  assertChannelCanPublish({ hasKeystore: hasReleaseKeystore() })

  const variantArgs = [
    '--dir',
    'apps/mobile',
    'variant',
    '--',
    '--apk',
    '--release',
    '--abi',
    ZAPSTORE_ABI
  ]
  if (CHANNEL === 'primary') variantArgs.push('--prod', '--plain')
  if (CHANNEL === 'generic') variantArgs.push('--plain')
  console.log(
    CHANNEL === 'primary'
      ? '  Primary release: clean name, production package id\n'
      : CHANNEL === 'generic'
        ? '  Generic dev: shared dev name and package id, no branch suffix\n'
        : '  Branch release: branch name and package id\n'
  )
  const segment =
    CHANNEL === 'dev' ? sanitizePackageSegment(gitBranch()) || 'plain' : 'plain'
  const label = CHANNEL === 'primary' ? 'prod' : 'dev'
  const apkPath = path.join(
    MOBILE_DIR,
    'dist',
    'apks',
    `satsigner-${label}-${segment}-release-${ANDROID_ABI_LABELS.get(ZAPSTORE_ABI)}.apk`
  )
  const sourcePath = `${apkPath}.source`
  const source = sourceFingerprint()
  if (existsSync(apkPath) && readTextFile(sourcePath) === source) {
    console.log('  Reusing the APK already built from this exact source\n')
    return apkPath
  }

  rmSync(sourcePath, { force: true })
  await run('pnpm', variantArgs, { cwd: REPO_ROOT })
  if (!existsSync(apkPath)) {
    throw new Error(`APK not found at expected path:\n  ${apkPath}`)
  }
  writeFileSync(sourcePath, source)
  return apkPath
}

async function main() {
  console.log('=== SatSigner Zapstore Publisher ===')
  console.log(`  App version : v${APP_VERSION}`)
  console.log(`  EAS profile : ${EAS_PROFILE}`)
  console.log(`  Blossom URL : ${BLOSSOM_URL}`)
  console.log(`  Zapstore    : ${ZAPSTORE_APP_URL}`)
  console.log(`  Relays      : ${ANNOUNCEMENT_RELAYS.join(', ')}`)
  if (isAgent) console.log('  Mode        : agent/CI (non-interactive)')
  if (dryRun) console.log('  Dry-run     : build only, no publish')
  console.log('\nWhat will happen:')
  console.log(
    bunkerUrl
      ? '  1. The release page signs with your browser extension'
      : '  1. You enter your nsec or seed words (hidden, never saved)'
  )
  console.log('  2. EAS builds the Android APK locally')
  console.log(
    '  3. The signing key is linked to your npub, once per key (NIP-C1)'
  )
  console.log('  4. zsp uploads APK to Blossom and publishes to Zapstore relay')
  console.log(
    '  5. A kind 1 nostr note is signed and posted as release announcement'
  )
  console.log('')

  if (ONLY && !ZAPSTORE_ONLY && !ANNOUNCE_ONLY) {
    throw new Error('--only must be zapstore or announce')
  }

  checkPrerequisites()
  checkProductionSource()
  await confirmProduction()

  step(1, bunkerUrl ? 'Sign in — browser bunker' : 'Sign in — enter your key')
  console.log(
    '  Your key is used to sign the Zapstore event and the announcement.'
  )
  console.log('  It is never written to disk.\n')

  const secretKey = bunkerUrl ? null : await resolveSecretKey()
  const signWith = bunkerUrl ? bunkerUrl : nip19.nsecEncode(secretKey)
  if (secretKey) {
    console.log(`  Pubkey: ${getPublicKey(secretKey)}`)
  }

  if (!ANNOUNCE_ONLY) {
    // Every publish builds here so the permission check sees the exact APK
    // zsp uploads. A remote source would skip it.
    step(2, 'Build APK')
    const apkPath = await buildReleaseApk()
    assertApkPermissions(apkPath)
    console.log(`\n  APK: ${apkPath}`)

    if (!dryRun) {
      step(3, 'Link signing key to your npub')
      await ensureIdentityProof({
        certificate: storedCertificate(newestSignerDir()),
        pubkey: await publisherPubkey(secretKey),
        signProof: () => signIdentityProof(signWith)
      })
    }

    step(4, 'Publish to Zapstore')
    console.log(`  Uploading APK to Blossom (${BLOSSOM_URL})`)
    console.log(
      '  Signing and publishing Zapstore event to wss://relay.zapstore.dev\n'
    )

    const listing = writeListingConfig(apkPath)
    // --json keeps zsp non-interactive but still reports errors, and prints
    // every event it published. --quiet alone hides a run that publishes nothing.
    // Never --indexer-mode: zsp then swaps this config for the repository's
    // zapstore.yaml and uploads a forge release instead of the checked APK.
    const zspFlags = zspPublishArgs({
      commit: isCleanTree() ? git(['rev-parse', 'HEAD']).toString().trim() : '',
      localBuild: true,
      target: listing.file
    })

    if (dryRun) {
      console.log(
        `  [dry-run] zsp config:\n${readFileSync(listing.file, 'utf8')}`
      )
      removeListingConfig(listing)
      console.log('  [dry-run] Skipping zsp publish.')
    } else {
      try {
        const output = await runZspPublish(zspFlags, signWith, listing)
        const events = parseZspEvents(output)
        if (events.length === 0) {
          throw new Error(
            'zsp published no events. This version may already be on Zapstore.'
          )
        }
        await verifyOnZapstore(events, { keyLinked: true })
      } catch (error) {
        console.log(`\n  ${error.message}`)
        // zsp exits 1 on partial publish failures (e.g. relay whitelisting pending).
        // Interactive combined runs can still continue to the announcement prompt.
        // Zapstore-only and --yes runs must fail instead of reporting success.
        if (ZAPSTORE_ONLY || yes) {
          secretKey?.fill(0)
          throw new Error(
            ZAPSTORE_ONLY
              ? 'Zapstore publish failed'
              : 'Zapstore publish failed; announcement skipped'
          )
        }
        console.log(
          '\n  Zapstore publish failed — continuing to announcement step.'
        )
      }
    }
  }

  if (ZAPSTORE_ONLY) {
    secretKey?.fill(0)
    console.log('\nDone.')
    process.exit(0)
  }

  step(5, 'Post release announcement')

  if (dryRun) {
    console.log('  [dry-run] Skipping announcement.')
    secretKey?.fill(0)
    console.log('\nDone (dry-run).')
    process.exit(0)
  }

  const releaseNotes =
    NOTES_ARG !== null
      ? NOTES_ARG
      : yes
        ? ''
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

  const confirm = yes ? 'y' : await prompt('\n  Publish this note? [y/N]: ')
  if (confirm.toLowerCase() !== 'y') {
    console.log('  Skipped.')
  } else {
    await publishAnnouncement(secretKey, releaseNotes || null)
  }

  secretKey?.fill(0)

  console.log('\nDone.')
  process.exit(0)
}

try {
  await main()
} catch (error) {
  console.error('\nError:', error.message)
  process.exit(1)
}
