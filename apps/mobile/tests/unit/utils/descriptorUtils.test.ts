import { UNKNOWN_MASTER_FINGERPRINT } from '@/constants/btc'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { DescriptorUtils } from '@/utils/descriptorUtils'

const SPARROW_ORIGIN_XPUB =
  "[d34db33f/84'/0'/0']xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG"

const SPARROW_DESCRIPTOR =
  "wpkh([d34db33f/84'/0'/0']xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG/0/*)"

const H_NOTATION_DESCRIPTOR =
  'wpkh([deadbeef/84h/0h/0h]xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG/0/*)'

describe('descriptor origin extraction', () => {
  it("extracts fingerprint from Sparrow [fp/84'/0'/0']xpub", () => {
    expect(
      DescriptorUtils.extractFingerprintFromXpub(SPARROW_ORIGIN_XPUB)
    ).toBe('d34db33f')
    expect(DescriptorUtils.extractFingerprint(SPARROW_DESCRIPTOR)).toBe(
      'd34db33f'
    )
  })

  it('extracts fingerprint from h-notation origin', () => {
    expect(DescriptorUtils.extractFingerprint(H_NOTATION_DESCRIPTOR)).toBe(
      'deadbeef'
    )
  })

  it('parses xpub, fingerprint, and derivation from origin', () => {
    const parsed = DescriptorUtils.parseXpubInput(SPARROW_ORIGIN_XPUB)
    expect(parsed.fingerprint).toBe('d34db33f')
    expect(parsed.derivationPath).toBe("m/84'/0'/0'")
    expect(parsed.xpub.startsWith('xpub')).toBe(true)
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
