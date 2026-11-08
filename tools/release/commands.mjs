import { StringDecoder } from 'node:string_decoder'

const REPO_NAME = 'Satsigner'
const REPO_IDENTIFIER = 'satsigner'
const REPO_DESCRIPTION =
  'Privacy-first bitcoin signer with complete UTXO control'
const SIGNER_ALIAS = 'satsigner'

const BUNKER_PATTERN = /bunker:\/\/\S+/gi
const NSEC_PATTERN = /nsec1[0-9a-z]+/gi
const NBUNK_PATTERN = /nbunksec1[0-9a-z]+/gi

function redactSecrets(text) {
  return text
    .replace(BUNKER_PATTERN, 'bunker://redacted')
    .replace(NSEC_PATTERN, 'nsec1redacted')
    .replace(NBUNK_PATTERN, 'nbunksec1redacted')
}

function isNostrRemote(url) {
  return url.trim().startsWith('nostr://')
}

function buildLoginArgs(bunkerUrl) {
  return [
    'account',
    'login',
    '--local',
    '--alias',
    SIGNER_ALIAS,
    '--bunker-url',
    bunkerUrl,
    '--defaults'
  ]
}

function buildInitArgs() {
  return [
    'init',
    '--name',
    REPO_NAME,
    '--identifier',
    REPO_IDENTIFIER,
    '--description',
    REPO_DESCRIPTION,
    '--defaults'
  ]
}

function buildPushArgs() {
  return ['push', 'origin', 'HEAD']
}

const APK_IDENTITIES = {
  branch: [],
  generic: ['--plain'],
  prod: ['--prod', '--plain']
}

const APK_KINDS = {
  all: [],
  pixel: ['--abi', 'arm64-v8a']
}

function buildApkArgs({ identity = 'branch', kind = 'all' } = {}) {
  const identityFlags = APK_IDENTITIES[identity]
  const kindFlags = APK_KINDS[kind]
  if (!identityFlags || !kindFlags) {
    throw new Error(`unknown apk selection: ${identity} ${kind}`)
  }
  return [
    '--dir',
    'apps/mobile',
    'variant',
    '--',
    '--apk',
    '--release',
    ...identityFlags,
    ...kindFlags
  ]
}

const RELEASE_CHANNELS = new Set(['dev', 'generic', 'primary'])

function parseReleaseChannel(value) {
  return RELEASE_CHANNELS.has(value) ? value : undefined
}

function isApkName(name) {
  return (
    name === pathBasename(name) && name.endsWith('.apk') && !name.includes('/')
  )
}

function pathBasename(name) {
  const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'))
  return slash === -1 ? name : name.slice(slash + 1)
}

function parseAdbDevices(text) {
  const serials = []
  for (const line of text.split('\n')) {
    const [serial, state] = line.trim().split(/\s+/)
    if (state === 'device' && serial) {
      serials.push(serial)
    }
  }
  return serials
}

function parsePackageList(text) {
  return text.split('\n').flatMap((line) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('package:')) {
      return []
    }
    return [trimmed.slice('package:'.length)]
  })
}

const LOG_KIND_PATTERNS = [
  [
    'error',
    [
      /^\s*error\b/i,
      /^\s*missing\b/,
      /^\s*FAILURE\b/,
      /\bBUILD FAILED\b/,
      /\bFAILED$/,
      /exited with code [1-9]/,
      /\bhas not saved it\b/,
      /\bpublish failed\b/i,
      /^aborted$/
    ]
  ],
  [
    'success',
    [
      /^\s*ok\b/,
      /\bBUILD SUCCESSFUL\b/,
      /^\s*done\.?$/i,
      /\bis live on Zapstore\b/
    ]
  ],
  [
    'milestone',
    [
      /^\s*\[\d+\/\d+\]/,
      /^\s*=== /,
      /^\$ /,
      /^\s*(APK|Package|Install|Store page|Keystore):/,
      /^\s*(Checking that Zapstore|Reusing the APK|Uploading APK|Signing and publishing)\b/
    ]
  ],
  ['signer', [/^signer (relay|bridge):/]]
]

const PUBLISH_SCRIPT = 'apps/mobile/scripts/publish-zapstore.mjs'

// The script never publishes Production without a confirmation, so the console
// forwards only the version the operator confirmed in the browser, and only
// while it is still the version on disk.
function buildZapstoreArgs({
  channel,
  confirmedVersion,
  currentVersion,
  only
}) {
  const args = [PUBLISH_SCRIPT, '--yes', '--channel', channel]
  if (only) {
    args.push('--only', only)
  }
  if (channel !== 'primary') {
    return args
  }
  if (!currentVersion || confirmedVersion !== currentVersion) {
    throw new Error(
      'Production was not confirmed for the current version. Reload the page and try again.'
    )
  }
  return [...args, '--confirm-production', currentVersion]
}

function classifyLogLine(line) {
  const match = LOG_KIND_PATTERNS.find(([, patterns]) =>
    patterns.some((pattern) => pattern.test(line))
  )
  return match ? match[0] : 'detail'
}

const TRUNCATED_LINE_MARKER = ' [line truncated]'

function splitCompleteLines(state, chunk, maxPending) {
  const parts = `${state.pending}${chunk}`.split('\n')
  const complete = parts.slice(0, -1)
  const tail = parts.at(-1)
  if (state.skipping && complete.length === 0) {
    return { lines: [], pending: '', skipping: true }
  }
  const lines = state.skipping ? complete.slice(1) : complete
  if (tail.length <= maxPending) {
    return { lines, pending: tail, skipping: false }
  }
  return {
    lines: [...lines, `${tail.slice(0, maxPending)}${TRUNCATED_LINE_MARKER}`],
    pending: '',
    skipping: true
  }
}

// Decodes each chunk with a StringDecoder, so a multibyte character split
// across two chunks is not turned into replacement characters.
function createLineSplitter(maxPending) {
  const decoder = new StringDecoder('utf8')
  const state = { pending: '', skipping: false }
  function take(text) {
    const next = splitCompleteLines(state, text, maxPending)
    state.pending = next.pending
    state.skipping = next.skipping
    return next.lines
  }
  return {
    end() {
      const lines = take(decoder.end())
      const rest = state.pending ? [state.pending] : []
      state.pending = ''
      state.skipping = false
      return [...lines, ...rest]
    },
    write(chunk) {
      return take(decoder.write(chunk))
    }
  }
}

function parseRequestBody(raw) {
  if (!raw) {
    return {}
  }
  const body = JSON.parse(raw)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('request body is not a JSON object')
  }
  return body
}

function hasInstalledPackage(text, packageId) {
  return parsePackageList(text).includes(packageId)
}

export {
  REPO_IDENTIFIER,
  SIGNER_ALIAS,
  TRUNCATED_LINE_MARKER,
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
  redactSecrets,
  splitCompleteLines
}
