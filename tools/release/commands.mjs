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

function isApkName(name) {
  return (
    name === pathBasename(name) && name.endsWith('.apk') && !name.includes('/')
  )
}

function pathBasename(name) {
  const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'))
  return slash === -1 ? name : name.slice(slash + 1)
}

export {
  REPO_IDENTIFIER,
  SIGNER_ALIAS,
  buildApkArgs,
  buildInitArgs,
  buildLoginArgs,
  buildPushArgs,
  isApkName,
  isNostrRemote,
  redactSecrets
}
