import { type ScriptVersionType } from '@/types/models/Account'
import { validateCombinedDescriptor } from '@/utils/validation'

// TODO: refactor this entire file and use @bitcoinerlab/descriptors instead of
// we implement it ourselves.

export const DescriptorUtils = {
  /**
   * Extract fingerprint from descriptor string
   * Handles both h notation (84h) and ' notation (84') in derivation paths
   */
  extractFingerprint(descriptor: string): string {
    const fingerprintMatch = descriptor.match(/\[([0-9a-fA-F]{8})([0-9'/h]+)\]/)
    return fingerprintMatch ? fingerprintMatch[1] : ''
  },

  /**
   * Extract fingerprint from xpub with prefix [fingerprint/derivation]xpub
   * Tries multiple patterns for compatibility
   */
  extractFingerprintFromXpub(xpubWithPrefix: string): string | null {
    // Pattern 1: [fingerprint/derivation]xpub (with slash separator)
    const fingerprintMatch1 = xpubWithPrefix.match(/^\[([0-9a-fA-F]{8})\//)
    if (fingerprintMatch1) return fingerprintMatch1[1]

    // Pattern 2: [fingerprintderivation]xpub (no slash separator - legacy)
    const fingerprintMatch2 = xpubWithPrefix.match(/^\[([0-9a-fA-F]{8})/)
    if (fingerprintMatch2) return fingerprintMatch2[1]

    // Pattern 3: [fingerprint...]xpub (any length hex - fallback)
    const fingerprintMatch3 = xpubWithPrefix.match(/^\[([0-9a-fA-F]+)/)
    if (fingerprintMatch3) return fingerprintMatch3[1]

    return null
  },

  /**
   * Extract clean xpub from xpub with prefix
   */
  extractCleanXpub(xpubWithPrefix: string): string {
    const xpubMatch = xpubWithPrefix.match(/\]([txyzuv]pub[a-zA-Z0-9]{107})$/)
    return xpubMatch ? xpubMatch[1] : xpubWithPrefix
  },

  /**
   * Determine script version from derivation path
   */
  getScriptVersionFromDerivation(derivationPath: string): ScriptVersionType {
    if (derivationPath.includes("84'")) return 'P2WPKH'
    if (derivationPath.includes("49'")) return 'P2SH-P2WPKH'
    if (derivationPath.includes("44'")) return 'P2PKH'
    return 'P2WPKH' // Default fallback
  },

  /**
   * Create descriptor from xpub and script version
   */
  createDescriptorFromXpub(
    xpubWithPrefix: string,
    scriptVersion: ScriptVersionType
  ): {
    external: string
    internal: string
  } {
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

  /**
   * Parse JSON descriptor and extract external/internal descriptors
   */
  parseJsonDescriptor(text: string): {
    external: string
    internal: string
    original: string
  } | null {
    try {
      const jsonData = JSON.parse(text)
      if (!jsonData.descriptor) return null

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

  /**
   * Parse legacy multi-line descriptor format
   */
  parseLegacyDescriptor(text: string): {
    external: string
    internal: string
  } | null {
    if (!text.includes('\n')) return null

    const lines = text.split('\n')
    return {
      external: lines[0],
      internal: lines[1]
    }
  },

  /**
   * Remove checksum from descriptor for separated validation
   */
  removeChecksum(descriptor: string): string {
    return descriptor.replace(/#[a-z0-9]+$/, '')
  },

  /**
   * Process combined descriptor and return separated parts
   */
  async processCombinedDescriptor(
    descriptor: string,
    scriptVersion: ScriptVersionType
  ): Promise<{
    success: boolean
    external: string
    internal: string
    fingerprint?: string
    error?: string
  }> {
    const validation = await validateCombinedDescriptor(
      descriptor,
      scriptVersion
    )

    if (!validation.isValid) {
      return {
        success: false,
        external: validation.externalDescriptor,
        internal: validation.internalDescriptor,
        error: validation.error
      }
    }

    const fingerprint = DescriptorUtils.extractFingerprint(
      validation.externalDescriptor
    )

    return {
      success: true,
      external: validation.externalDescriptor,
      internal: validation.internalDescriptor,
      fingerprint
    }
  }
}
