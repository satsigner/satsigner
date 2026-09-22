import { type ScriptVersionType } from '@/types/models/Script'
import {
  isCombinedDescriptor,
  validateCombinedDescriptor,
  validateDescriptorFormat
} from '@/utils/validation'

// TODO: refactor this entire file and use @bitcoinerlab/descriptors instead of
// we implement it ourselves.

const KEY_ORIGIN_FINGERPRINT_PATTERN = /\[([0-9a-fA-F]{8})[/\]]/

/** Base58 tail can omit 0/O/I/l but BDK may emit other encodings, so match broadly. */
export const EXTENDED_PUBKEY_PATTERN = '([xyztuv]pub)[A-Za-z0-9]+'

export function createDescriptorFromXpub(
  xpubWithPrefix: string,
  scriptVersion: ScriptVersionType
) {
  switch (scriptVersion) {
    case 'P2WPKH':
      return {
        external: `wpkh(${xpubWithPrefix}/0/*)`,
        internal: `wpkh(${xpubWithPrefix}/1/*)`
      }
    case 'P2SH-P2WPKH':
      return {
        external: `sh(wpkh(${xpubWithPrefix}/0/*))`,
        internal: `sh(wpkh(${xpubWithPrefix}/1/*))`
      }
    case 'P2PKH':
      return {
        external: `pkh(${xpubWithPrefix}/0/*)`,
        internal: `pkh(${xpubWithPrefix}/1/*)`
      }
    default:
      return {
        external: `wpkh(${xpubWithPrefix}/0/*)`,
        internal: `wpkh(${xpubWithPrefix}/1/*)`
      }
  }
}

export function extractCleanXpub(xpubWithPrefix: string): string {
  const xpubMatch = xpubWithPrefix.match(/\]([txyzuv]pub[a-zA-Z0-9]{107})$/)
  return xpubMatch ? xpubMatch[1] : xpubWithPrefix
}

export function extractDerivationFromOrigin(text: string) {
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

/** Same as extractDerivationFromOrigin but the origin bracket need not be at the start (e.g. wpkh([fp/84h/0h/0h]xpub.../0/*)). */
export function extractDerivationPathFromDescriptor(
  descriptor: string
): string {
  const bracketMatch = descriptor.match(
    /\[[0-9a-fA-F]{8}\/((?:[0-9]+[hH']?\/)*[0-9]+[hH']?)\]/
  )
  return bracketMatch ? `m/${bracketMatch[1]}` : ''
}

export function extractFingerprint(descriptor: string): string {
  const fingerprintMatch = descriptor.match(KEY_ORIGIN_FINGERPRINT_PATTERN)
  return fingerprintMatch ? fingerprintMatch[1] : ''
}

export function extractFingerprintFromXpub(xpubWithPrefix: string) {
  const originMatch = xpubWithPrefix.match(KEY_ORIGIN_FINGERPRINT_PATTERN)
  return originMatch ? originMatch[1] : null
}

export function getScriptVersionFromDerivation(
  derivationPath: string
): ScriptVersionType {
  if (derivationPath.includes("84'") || derivationPath.includes('84h')) {
    return 'P2WPKH'
  }
  if (derivationPath.includes("49'") || derivationPath.includes('49h')) {
    return 'P2SH-P2WPKH'
  }
  if (derivationPath.includes("44'") || derivationPath.includes('44h')) {
    return 'P2PKH'
  }
  return 'P2WPKH' // Default fallback
}

export function removeChecksum(descriptor: string): string {
  return descriptor.replace(/#[a-z0-9]+$/, '')
}

export function swapDescriptorChain(
  descriptor: string,
  fromChain: 0 | 1,
  toChain: 0 | 1
) {
  const withoutChecksum = removeChecksum(descriptor)
  return withoutChecksum.replaceAll(`/${fromChain}/*`, `/${toChain}/*`)
}

export function parseJsonDescriptor(text: string) {
  try {
    const jsonData = JSON.parse(text)
    if (!jsonData.descriptor) {
      return null
    }

    const original = jsonData.descriptor
    const withoutChecksum = original.replace(/#[a-z0-9]+$/, '')
    const internal = withoutChecksum.replace(/\/0\/\*/g, '/1/*')

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
  const fingerprint = extractFingerprintFromXpub(trimmed)
  const xpub = extractCleanXpub(trimmed)
  const derivationPath = extractDerivationFromOrigin(trimmed)
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
      const external = withoutChecksum.replace(/<0[,;]1>/g, '0')
      const internal = withoutChecksum.replace(/<0[,;]1>/g, '1')
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
      external: withoutChecksum.replace(/<0[,;]1>/g, '0'),
      internal: withoutChecksum.replace(/<0[,;]1>/g, '1')
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

  const fingerprint = extractFingerprint(validation.externalDescriptor)

  return {
    external: validation.externalDescriptor,
    fingerprint,
    internal: validation.internalDescriptor,
    success: true
  }
}
