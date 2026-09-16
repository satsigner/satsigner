import { ScriptVersionType } from '@/types/models/Script'
import { validateCombinedDescriptor } from '@/utils/validation'

// TODO: refactor this entire file and use @bitcoinerlab/descriptors instead of
// we implement it ourselves.

export const DescriptorUtils = {
  createDescriptorFromXpub(
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
  },

  extractCleanXpub(xpubWithPrefix: string): string {
    const xpubMatch = xpubWithPrefix.match(/\]([txyzuv]pub[a-zA-Z0-9]{107})/)
    return xpubMatch ? xpubMatch[1] : xpubWithPrefix
  },

  extractDerivationFromOrigin(text: string) {
    const originMatch = text.match(/^\[([0-9a-fA-F]{8})\/([^\]]+)\]/)
    if (!originMatch) {
      return null
    }
    const derivation = originMatch.at(2)
    if (!derivation) {
      return null
    }
    return derivation.startsWith('m/') ? derivation : `m/${derivation}`
  },

  extractFingerprint(descriptor: string): string {
    const fingerprintMatch = descriptor.match(
      /\[([0-9a-fA-F]{8})(?:\/|[0-9'/h])/
    )
    return fingerprintMatch ? fingerprintMatch[1] : ''
  },

  extractFingerprintFromXpub(xpubWithPrefix: string) {
    const originMatch = xpubWithPrefix.match(
      /\[([0-9a-fA-F]{8})(?:\/|[0-9'/h])/
    )
    if (originMatch) {
      return originMatch[1]
    }

    const fallbackMatch = xpubWithPrefix.match(/^\[([0-9a-fA-F]+)/)
    return fallbackMatch ? fallbackMatch[1] : null
  },

  getScriptVersionFromDerivation(derivationPath: string): ScriptVersionType {
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
  },

  parseJsonDescriptor(text: string) {
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
  },

  parseLegacyDescriptor(text: string) {
    if (!text.includes('\n')) {
      return null
    }

    const lines = text.split('\n')
    return {
      external: lines[0],
      internal: lines[1]
    }
  },

  parseXpubInput(text: string) {
    const trimmed = text.trim()
    const fingerprint = DescriptorUtils.extractFingerprintFromXpub(trimmed)
    const xpub = DescriptorUtils.extractCleanXpub(trimmed)
    const derivationPath = DescriptorUtils.extractDerivationFromOrigin(trimmed)
    return {
      derivationPath,
      fingerprint,
      xpub
    }
  },

  async processCombinedDescriptor(
    descriptor: string,
    scriptVersion: ScriptVersionType
  ) {
    const validation = await validateCombinedDescriptor(
      descriptor,
      scriptVersion
    )

    if (!validation.isValid) {
      return {
        error: validation.error,
        external: validation.externalDescriptor,
        internal: validation.internalDescriptor,
        success: false
      }
    }

    const fingerprint = DescriptorUtils.extractFingerprint(
      validation.externalDescriptor
    )

    return {
      external: validation.externalDescriptor,
      fingerprint,
      internal: validation.internalDescriptor,
      success: true
    }
  },

  removeChecksum(descriptor: string): string {
    return descriptor.replace(/#[a-z0-9]+$/, '')
  }
}
