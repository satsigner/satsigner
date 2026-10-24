import { BDK_PRIVATE_EXTENDED_KEY_PREFIXES } from '@/constants/bdk'
import {
  DESCRIPTOR_CHECKSUM_CHARSET,
  DESCRIPTOR_CHECKSUM_GENERATOR,
  DESCRIPTOR_CHECKSUM_INPUT_CHARSET,
  DESCRIPTOR_CHECKSUM_LENGTH,
  KEY_ORIGIN_FINGERPRINT_PATTERN
} from '@/constants/descriptor'
import { type ScriptVersionType } from '@/types/models/Script'
import { AppError } from '@/utils/errors'
import {
  isCombinedDescriptor,
  validateCombinedDescriptor,
  validateDescriptorFormat
} from '@/utils/validation'

// TODO: refactor this entire file and use @bitcoinerlab/descriptors instead of
// we implement it ourselves.

// Keys start the descriptor or follow `(`, `,` or a `[origin]`. Matching only
// there keeps base58 noise inside an xpub from looking like a prefix.
const PRIVATE_EXTENDED_KEY_PATTERN = new RegExp(
  String.raw`(?:^|[(,\]])\s*(?:${BDK_PRIVATE_EXTENDED_KEY_PREFIXES.join('|')})`,
  'i'
)
const MULTIPATH_CHAINS_PATTERN = /<0[,;]1>/g
const RECEIVE_CHAIN = '0'
const CHANGE_CHAIN = '1'

/** True when a descriptor holds an extended private key (xprv, tprv, ...). */
export function descriptorHasPrivateKeyMaterial(descriptor: string): boolean {
  return PRIVATE_EXTENDED_KEY_PATTERN.test(descriptor)
}

// Thrown when a descriptor contains private key material that must not be
// silently dropped. Callers rethrow it so a catch-all never turns it into a
// plain derivation failure.
export class PrivateKeyDescriptorError extends AppError {
  override name = 'PrivateKeyDescriptorError'
}

export function getCleanXpub(xpubWithPrefix: string): string {
  const xpubMatch = xpubWithPrefix.match(/\]([txyzuv]pub[a-zA-Z0-9]{107})$/)
  return xpubMatch ? xpubMatch[1] : xpubWithPrefix
}

export function getOriginDerivation(text: string) {
  const originMatch = text.match(/^\[([0-9a-fA-F]{8})\/([^\]]+)\]/)
  if (!originMatch) {
    return null
  }
  const derivation = originMatch.at(2)
  if (!derivation) {
    return null
  }
  return derivation.startsWith('m/') ? derivation : `m/${derivation}`
}

/** Same as getOriginDerivation but the origin bracket need not be at the start (e.g. wpkh([fp/84h/0h/0h]xpub.../0/*)). */
export function getDescriptorDerivationPath(descriptor: string): string {
  const bracketMatch = descriptor.match(
    /\[[0-9a-fA-F]{8}\/((?:[0-9]+[hH']?\/)*[0-9]+[hH']?)\]/
  )
  return bracketMatch ? `m/${bracketMatch[1]}` : ''
}

export function getFingerprint(descriptor: string): string {
  const fingerprintMatch = descriptor.match(KEY_ORIGIN_FINGERPRINT_PATTERN)
  return fingerprintMatch ? fingerprintMatch[1] : ''
}

export function getXpubFingerprint(xpubWithPrefix: string) {
  const originMatch = xpubWithPrefix.match(KEY_ORIGIN_FINGERPRINT_PATTERN)
  return originMatch ? originMatch[1] : null
}

export function removeChecksum(descriptor: string): string {
  return descriptor.replace(/#[a-z0-9]+$/, '')
}

const BARE_SCRIPT_KEY_PATTERN = /^(sh\(wsh\(|wsh\(|sh\()([^()]+)(\)+)$/

/**
 * Older builds saved multisig keys as `wsh(KEY)`, `sh(wsh(KEY))` or `sh(KEY)`,
 * which are not valid descriptors. Wraps the key in `pk()`.
 */
export function wrapBareScriptKey(descriptor: string) {
  const body = removeChecksum(descriptor)
  if (!BARE_SCRIPT_KEY_PATTERN.test(body)) {
    return descriptor
  }
  return body.replace(BARE_SCRIPT_KEY_PATTERN, '$1pk($2)$3')
}

// Port of the BIP-380 reference implementation (descsum_expand/polymod).
function expandDescriptorSymbols(descriptor: string): number[] {
  const symbols: number[] = []
  const groups: number[] = []
  for (const char of descriptor) {
    const position = DESCRIPTOR_CHECKSUM_INPUT_CHARSET.indexOf(char)
    if (position === -1) {
      throw new Error(`Invalid descriptor character: ${char}`)
    }
    symbols.push(position & 31)
    groups.push(position >> 5)
    if (groups.length === 3) {
      symbols.push(groups[0] * 9 + groups[1] * 3 + groups[2])
      groups.length = 0
    }
  }
  if (groups.length === 1) {
    symbols.push(groups[0])
  }
  if (groups.length === 2) {
    symbols.push(groups[0] * 3 + groups[1])
  }
  return symbols
}

function descriptorPolymod(symbols: number[]): bigint {
  return symbols.reduce((checksum, value) => {
    const top = checksum >> 35n
    const shifted = ((checksum & 0x7_ff_ff_ff_ffn) << 5n) ^ BigInt(value)
    return DESCRIPTOR_CHECKSUM_GENERATOR.reduce(
      (result, generator, index) =>
        (top >> BigInt(index)) & 1n ? result ^ generator : result,
      shifted
    )
  }, 1n)
}

/** BIP-380 checksum of a descriptor without its `#checksum` suffix. */
export function getDescriptorChecksum(descriptor: string): string {
  const padding = Array.from<number>({
    length: DESCRIPTOR_CHECKSUM_LENGTH
  }).fill(0)
  const checksum =
    descriptorPolymod([...expandDescriptorSymbols(descriptor), ...padding]) ^ 1n
  return Array.from({ length: DESCRIPTOR_CHECKSUM_LENGTH }, (_, index) => {
    const shift = BigInt(5 * (DESCRIPTOR_CHECKSUM_LENGTH - 1 - index))
    return DESCRIPTOR_CHECKSUM_CHARSET[Number((checksum >> shift) & 31n)]
  }).join('')
}

/** Replaces any existing `#checksum` suffix with the BIP-380 checksum. */
export function addDescriptorChecksum(descriptor: string): string {
  const [body] = descriptor.split('#')
  return `${body}#${getDescriptorChecksum(body)}`
}

/**
 * Receive (`/0/*`) and change (`/1/*`) descriptors of a `<0;1>` multipath
 * descriptor, each with its own checksum. Other descriptors are returned as is.
 */
export function splitMultipathDescriptor(descriptor: string): string[] {
  const [body] = descriptor.split('#')
  if (!isCombinedDescriptor(body)) {
    return [descriptor]
  }
  return [RECEIVE_CHAIN, CHANGE_CHAIN].map((chain) =>
    addDescriptorChecksum(body.replaceAll(MULTIPATH_CHAINS_PATTERN, chain))
  )
}

export function swapDescriptorChain(
  descriptor: string,
  fromChain: 0 | 1,
  toChain: 0 | 1
) {
  const withoutChecksum = removeChecksum(descriptor)
  return withoutChecksum.replaceAll(`/${fromChain}/*`, `/${toChain}/*`)
}

// BDK refuses a wallet whose change descriptor equals the receive one.
export function deriveChangeDescriptor(external: string) {
  if (!external.includes('/0/*')) {
    return
  }
  return swapDescriptorChain(external, 0, 1)
}

export function parseJsonDescriptor(text: string) {
  try {
    const jsonData = JSON.parse(text)
    if (!jsonData.descriptor) {
      return null
    }

    const original = jsonData.descriptor
    const withoutChecksum = original.replace(/#[a-z0-9]+$/, '')
    const internal = withoutChecksum.replaceAll('/0/*', '/1/*')

    return {
      external: original,
      internal,
      original
    }
  } catch {
    return null
  }
}

export function parseLegacyDescriptor(text: string) {
  if (!text.includes('\n')) {
    return null
  }

  const lines = text.split('\n')
  return {
    external: lines[0],
    internal: lines[1]
  }
}

export function parseXpubInput(text: string) {
  const trimmed = text.trim()
  const fingerprint = getXpubFingerprint(trimmed)
  const xpub = getCleanXpub(trimmed)
  const derivationPath = getOriginDerivation(trimmed)
  return {
    derivationPath,
    fingerprint,
    xpub
  }
}

export function parseImportedDescriptorPayload(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }

  const jsonResult = parseJsonDescriptor(trimmed)
  if (jsonResult) {
    if (isCombinedDescriptor(jsonResult.original)) {
      const withoutChecksum = removeChecksum(jsonResult.original)
      const external = withoutChecksum.replaceAll(/<0[,;]1>/g, '0')
      const internal = withoutChecksum.replaceAll(/<0[,;]1>/g, '1')
      if (
        !validateDescriptorFormat(external.trim()) ||
        !validateDescriptorFormat(internal.trim())
      ) {
        return null
      }
      return {
        combined: jsonResult.original,
        derivedExternal: true,
        derivedInternal: true,
        external,
        internal
      }
    }
    if (
      !validateDescriptorFormat(jsonResult.external.trim()) ||
      !validateDescriptorFormat(jsonResult.internal.trim())
    ) {
      return null
    }
    return {
      derivedExternal: false,
      derivedInternal: jsonResult.internal !== jsonResult.external,
      external: jsonResult.external,
      internal: jsonResult.internal
    }
  }

  if (isCombinedDescriptor(trimmed)) {
    const withoutChecksum = removeChecksum(trimmed)
    return {
      combined: trimmed,
      derivedExternal: true,
      derivedInternal: true,
      external: withoutChecksum.replaceAll(/<0[,;]1>/g, '0'),
      internal: withoutChecksum.replaceAll(/<0[,;]1>/g, '1')
    }
  }

  const legacyResult = parseLegacyDescriptor(trimmed)
  if (
    legacyResult?.external &&
    legacyResult.internal &&
    validateDescriptorFormat(legacyResult.external.trim()) &&
    validateDescriptorFormat(legacyResult.internal.trim())
  ) {
    return {
      derivedExternal: false,
      derivedInternal: false,
      external: legacyResult.external.trim(),
      internal: legacyResult.internal.trim()
    }
  }

  if (!validateDescriptorFormat(trimmed)) {
    return null
  }

  const hasExternalChain = trimmed.includes('/0/*')
  const hasInternalChain = trimmed.includes('/1/*')
  if (hasInternalChain && !hasExternalChain) {
    return {
      derivedExternal: true,
      derivedInternal: false,
      external: swapDescriptorChain(trimmed, 1, 0),
      internal: trimmed
    }
  }
  if (hasExternalChain && !hasInternalChain) {
    return {
      derivedExternal: false,
      derivedInternal: true,
      external: trimmed,
      internal: swapDescriptorChain(trimmed, 0, 1)
    }
  }

  return {
    derivedExternal: false,
    derivedInternal: false,
    external: trimmed,
    internal: ''
  }
}

const DESCRIPTOR_SCRIPT_VERSIONS: [string, ScriptVersionType][] = [
  ['sh(wpkh(', 'P2SH-P2WPKH'],
  ['sh(wsh(', 'P2SH-P2WSH'],
  ['sh(', 'P2SH'],
  ['pkh(', 'P2PKH'],
  ['wpkh(', 'P2WPKH'],
  ['wsh(', 'P2WSH'],
  ['tr(', 'P2TR']
]

export function getScriptVersionFromDescriptor(descriptor: string) {
  const trimmed = descriptor.trim()
  return DESCRIPTOR_SCRIPT_VERSIONS.find(([prefix]) =>
    trimmed.startsWith(prefix)
  )?.[1]
}

export async function processCombinedDescriptor(
  descriptor: string,
  scriptVersion: ScriptVersionType
) {
  const validation = await validateCombinedDescriptor(descriptor, scriptVersion)

  if (!validation.isValid) {
    return {
      error: validation.error,
      external: validation.externalDescriptor,
      internal: validation.internalDescriptor,
      success: false
    }
  }

  const fingerprint = getFingerprint(validation.externalDescriptor)

  return {
    external: validation.externalDescriptor,
    fingerprint,
    internal: validation.internalDescriptor,
    success: true
  }
}
