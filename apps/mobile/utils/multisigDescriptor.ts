import { type ScriptVersionType } from '@/types/models/Script'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'
import { getXpubFingerprint, removeChecksum } from '@/utils/descriptor'

type MultisigScriptWrapper = {
  prefix: string
  suffix: string
  scriptVersion: ScriptVersionType
}

// sh(wsh( comes before sh( so a nested descriptor is not read as plain P2SH.
const MULTISIG_SCRIPT_WRAPPERS: MultisigScriptWrapper[] = [
  { prefix: 'sh(wsh(', scriptVersion: 'P2SH-P2WSH', suffix: '))' },
  { prefix: 'wsh(', scriptVersion: 'P2WSH', suffix: ')' },
  { prefix: 'sh(', scriptVersion: 'P2SH', suffix: ')' }
]

const MULTI_SCRIPT_PATTERN = /^(?:multi|sortedmulti)\((\d+),(.+)\)$/
const KEY_WITH_ORIGIN_PATTERN = /^\[([^\]]+)\](.+)$/
const DEFAULT_ADDRESS_PATH = '/<0;1>/*'

function unwrapMultisigScript(descriptor: string) {
  const wrapper = MULTISIG_SCRIPT_WRAPPERS.find(
    ({ prefix, suffix }) =>
      descriptor.startsWith(prefix) && descriptor.endsWith(suffix)
  )
  if (!wrapper) {
    throw new Error('Unsupported multisig script')
  }
  return {
    multiScript: descriptor.slice(
      wrapper.prefix.length,
      descriptor.length - wrapper.suffix.length
    ),
    scriptVersion: wrapper.scriptVersion
  }
}

function parseMultisigKey(key: string, index: number) {
  const originMatch = key.match(KEY_WITH_ORIGIN_PATTERN)
  if (!originMatch) {
    throw new Error(`Invalid key format at index ${index}`)
  }

  const [, origin, keyWithPath] = originMatch
  const [, ...derivationSteps] = origin.split('/')

  const fingerprint = getXpubFingerprint(key)
  if (!fingerprint) {
    throw new Error(`Invalid key format at index ${index}`)
  }

  const extendedPublicKey = getExtendedKeyFromDescriptor(keyWithPath)
  if (!extendedPublicKey) {
    throw new Error(`Invalid extended public key format at index ${index}`)
  }

  return {
    addressPath:
      keyWithPath.slice(extendedPublicKey.length) || DEFAULT_ADDRESS_PATH,
    derivationPath: derivationSteps.join('/'),
    extendedPublicKey,
    fingerprint
  }
}

/** Threshold, keys and script type of a sh(), sh(wsh()) or wsh() multisig descriptor. */
export function parseMultisigDescriptor(descriptor: string) {
  const { multiScript, scriptVersion } = unwrapMultisigScript(
    removeChecksum(descriptor.trim())
  )

  const multiMatch = multiScript.match(MULTI_SCRIPT_PATTERN)
  if (!multiMatch) {
    throw new Error('Invalid multisig descriptor format')
  }

  const [, threshold, keyList] = multiMatch
  const keys = keyList.split(',').map((key) => key.trim())
  const keysRequired = Number.parseInt(threshold, 10)
  if (keysRequired < 1 || keysRequired > keys.length) {
    throw new Error('Invalid multisig threshold')
  }

  return {
    keyCount: keys.length,
    keyData: keys.map(parseMultisigKey),
    keysRequired,
    scriptVersion
  }
}
