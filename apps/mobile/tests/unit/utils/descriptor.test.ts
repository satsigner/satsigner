import { UNKNOWN_MASTER_FINGERPRINT } from '@/constants/btc'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import {
  deriveChangeDescriptor,
  descriptorHasPrivateKeyMaterial,
  getDescriptorDerivationPath,
  getFingerprint,
  getScriptVersionFromDescriptor,
  getXpubFingerprint,
  parseImportedDescriptorPayload,
  parseXpubInput,
  processCombinedDescriptor
} from '@/utils/descriptor'

const SPARROW_ORIGIN_XPUB =
  "[d34db33f/84'/0'/0']xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG"

const SPARROW_DESCRIPTOR =
  "wpkh([d34db33f/84'/0'/0']xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG/0/*)"

const H_NOTATION_DESCRIPTOR =
  'wpkh([deadbeef/84h/0h/0h]xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG/0/*)'

describe('descriptor origin extraction', () => {
  it("extracts fingerprint from Sparrow [fp/84'/0'/0']xpub", () => {
    expect(getXpubFingerprint(SPARROW_ORIGIN_XPUB)).toBe('d34db33f')
    expect(getFingerprint(SPARROW_DESCRIPTOR)).toBe('d34db33f')
  })

  it('extracts fingerprint from h-notation origin', () => {
    expect(getFingerprint(H_NOTATION_DESCRIPTOR)).toBe('deadbeef')
  })

  it('extracts fingerprint from an origin with no derivation path', () => {
    expect(getFingerprint('wpkh([deadbeef]xpubABC)')).toBe('deadbeef')
    expect(getXpubFingerprint('[deadbeef]xpubABC')).toBe('deadbeef')
  })

  it('requires exactly eight hex chars followed by / or ]', () => {
    expect(getXpubFingerprint('[deadbee/84h]xpub')).toBeNull()
    expect(getXpubFingerprint('[deadbeeff/84h]xpub')).toBeNull()
    expect(getXpubFingerprint('[deadbeeg]xpub')).toBeNull()
    expect(getXpubFingerprint('[deadbeef/84h]xpub')).toBe('deadbeef')
    expect(getFingerprint('[deadbee/84h]xpub')).toBe('')
  })

  it('parses xpub, fingerprint, and derivation from origin', () => {
    const parsed = parseXpubInput(SPARROW_ORIGIN_XPUB)
    expect(parsed.fingerprint).toBe('d34db33f')
    expect(parsed.derivationPath).toBe("m/84'/0'/0'")
    expect(parsed.xpub).toBe(
      'xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG'
    )
  })

  it('does not strip trailing characters from an origin-prefixed xpub', () => {
    const parsed = parseXpubInput(`${SPARROW_ORIGIN_XPUB}junk`)
    expect(parsed.xpub).toBe(`${SPARROW_ORIGIN_XPUB}junk`)
  })

  it('uses 00000000 when fingerprint is omitted', () => {
    const store = useAccountBuilderStore.getState()
    store.clearAccount()
    store.setCreationType('importExtendedPub')
    store.setExtendedPublicKey(
      'xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG'
    )
    const key = store.setKey(0)
    expect(key.fingerprint).toBe(UNKNOWN_MASTER_FINGERPRINT)
    store.clearAccount()
  })
})

describe('getDescriptorDerivationPath', () => {
  it('extracts the path from a mid-descriptor origin bracket', () => {
    expect(getDescriptorDerivationPath(SPARROW_DESCRIPTOR)).toBe("m/84'/0'/0'")
  })

  it('handles h-notation hardened markers', () => {
    expect(getDescriptorDerivationPath(H_NOTATION_DESCRIPTOR)).toBe(
      'm/84h/0h/0h'
    )
  })

  it('returns empty string when there is no origin bracket', () => {
    expect(getDescriptorDerivationPath('wpkh(xpubABC/0/*)')).toBe('')
  })
})

describe('parseImportedDescriptorPayload', () => {
  const internal = SPARROW_DESCRIPTOR.replace('/0/*', '/1/*')

  it('derives internal from a receive /0/* descriptor', () => {
    const parsed = parseImportedDescriptorPayload(SPARROW_DESCRIPTOR)
    expect(parsed?.external).toBe(SPARROW_DESCRIPTOR)
    expect(parsed?.internal).toBe(internal)
    expect(parsed?.derivedInternal).toBe(true)
  })

  it('derives receive from a change /1/* descriptor', () => {
    const parsed = parseImportedDescriptorPayload(internal)
    expect(parsed?.internal).toBe(internal)
    expect(parsed?.external).toBe(SPARROW_DESCRIPTOR)
    expect(parsed?.derivedExternal).toBe(true)
  })

  it('splits a combined <0;1> descriptor', () => {
    const combined = SPARROW_DESCRIPTOR.replace('/0/*', '/<0;1>/*')
    const parsed = parseImportedDescriptorPayload(combined)
    expect(parsed?.combined).toBe(combined)
    expect(parsed?.external).toContain('/0/*')
    expect(parsed?.internal).toContain('/1/*')
  })

  it('replaces every combined-chain marker in a multipath descriptor', () => {
    const combined =
      "wsh(sortedmulti(2,[aa/48'/0'/0'/2']xpubA/<0;1>/*,[bb/48'/0'/0'/2']xpubB/<0;1>/*))"
    const parsed = parseImportedDescriptorPayload(combined)
    expect(parsed?.external).toBe(
      "wsh(sortedmulti(2,[aa/48'/0'/0'/2']xpubA/0/*,[bb/48'/0'/0'/2']xpubB/0/*))"
    )
    expect(parsed?.internal).toBe(
      "wsh(sortedmulti(2,[aa/48'/0'/0'/2']xpubA/1/*,[bb/48'/0'/0'/2']xpubB/1/*))"
    )
  })

  it('reads two newline-separated descriptors', () => {
    const parsed = parseImportedDescriptorPayload(
      `${SPARROW_DESCRIPTOR}\n${internal}`
    )
    expect(parsed?.external).toBe(SPARROW_DESCRIPTOR)
    expect(parsed?.internal).toBe(internal)
    expect(parsed?.derivedExternal).toBe(false)
  })

  it('parses a valid JSON single descriptor and keeps its fields', () => {
    const parsed = parseImportedDescriptorPayload(
      JSON.stringify({ descriptor: SPARROW_DESCRIPTOR })
    )
    expect(parsed?.external).toBe(SPARROW_DESCRIPTOR)
    expect(parsed?.internal).toBe(internal)
    expect(parsed?.derivedExternal).toBe(false)
    expect(parsed?.derivedInternal).toBe(true)
  })

  it('parses a valid JSON combined descriptor and keeps its fields', () => {
    const combined = SPARROW_DESCRIPTOR.replace('/0/*', '/<0;1>/*')
    const parsed = parseImportedDescriptorPayload(
      JSON.stringify({ descriptor: combined })
    )
    expect(parsed?.combined).toBe(combined)
    expect(parsed?.external).toContain('/0/*')
    expect(parsed?.internal).toContain('/1/*')
  })

  it('rejects garbage JSON descriptor even with a chain marker', () => {
    expect(
      parseImportedDescriptorPayload(
        JSON.stringify({ descriptor: 'not a descriptor /0/*' })
      )
    ).toBeNull()
  })

  it('rejects garbage JSON combined descriptor with a chain marker', () => {
    expect(
      parseImportedDescriptorPayload(
        JSON.stringify({ descriptor: 'not a descriptor /<0;1>/*' })
      )
    ).toBeNull()
  })
})

describe('descriptorHasPrivateKeyMaterial', () => {
  it('flags extended private keys in any case', () => {
    expect(descriptorHasPrivateKeyMaterial('wpkh(xprv9s21ZrQH143K/0/*)')).toBe(
      true
    )
    expect(descriptorHasPrivateKeyMaterial('wpkh(TPRV8ZgxMBicQKsP/0/*)')).toBe(
      true
    )
  })

  it('flags private keys after a key origin or inside multisig', () => {
    expect(
      descriptorHasPrivateKeyMaterial(
        'tr([e5eda689/86h/1h/0h]tprv8ZgxMBicQKsP/<0;1>/*)#abcdefgh'
      )
    ).toBe(true)
    expect(
      descriptorHasPrivateKeyMaterial(
        'wsh(sortedmulti(2,[aaaaaaaa/48h/1h/0h/2h]tpubD6NzVbkrYhZ4X/0/*,[bbbbbbbb/48h/1h/0h/2h]tprv8ZgxMBicQKsP/0/*))'
      )
    ).toBe(true)
  })

  it('accepts watch-only descriptors', () => {
    expect(descriptorHasPrivateKeyMaterial(SPARROW_DESCRIPTOR)).toBe(false)
  })

  it('ignores prefix-like characters inside a public key', () => {
    expect(
      descriptorHasPrivateKeyMaterial(
        'wpkh([e5eda689/84h/1h/0h]tpubDCXPRVtprvZz/0/*)'
      )
    ).toBe(false)
  })
})

describe('getScriptVersionFromDescriptor', () => {
  it.each([
    ['pkh([d34db33f/44h/0h/0h]xpub/0/*)', 'P2PKH'],
    ['sh(wpkh([d34db33f/49h/0h/0h]xpub/0/*))', 'P2SH-P2WPKH'],
    ['wpkh([d34db33f/84h/0h/0h]xpub/0/*)', 'P2WPKH'],
    ['tr([d34db33f/86h/0h/0h]xpub/<0;1>/*)', 'P2TR'],
    ['sh(sortedmulti(2,xpubA/0/*,xpubB/0/*))', 'P2SH'],
    ['sh(wsh(sortedmulti(2,xpubA/0/*,xpubB/0/*)))', 'P2SH-P2WSH'],
    ['wsh(sortedmulti(2,xpubA/0/*,xpubB/0/*))', 'P2WSH']
  ])('reads %s as %s', (descriptor, scriptVersion) => {
    expect(getScriptVersionFromDescriptor(descriptor)).toBe(scriptVersion)
  })

  it('returns undefined for an unknown script', () => {
    expect(getScriptVersionFromDescriptor('combo(xpub/0/*)')).toBeUndefined()
  })
})

describe('processCombinedDescriptor', () => {
  const TAPROOT_COMBINED =
    "tr([d34db33f/86'/0'/0']xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG/<0;1>/*)"

  it('accepts a combined taproot descriptor with its own script version', async () => {
    const result = await processCombinedDescriptor(
      TAPROOT_COMBINED,
      getScriptVersionFromDescriptor(TAPROOT_COMBINED) ?? 'P2WPKH'
    )

    expect(result.success).toBe(true)
    expect(result.external).toContain('/0/*')
    expect(result.internal).toContain('/1/*')
  })
})

describe('deriveChangeDescriptor', () => {
  it('switches every receive chain to the change chain', () => {
    expect(
      deriveChangeDescriptor('wsh(sortedmulti(2,xpubA/0/*,xpubB/0/*))#abcdefgh')
    ).toBe('wsh(sortedmulti(2,xpubA/1/*,xpubB/1/*))')
  })

  it('returns undefined without a receive chain', () => {
    expect(deriveChangeDescriptor('wpkh(xpubA/*)')).toBeUndefined()
  })
})
