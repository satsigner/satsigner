import { descriptorHasPrivateKeyMaterial } from '@/utils/descriptor'
import {
  decodeWif,
  isScriptVersionAllowedForWif,
  publicDescriptorFromPrivateKey,
  wifImportSecret,
  wifScriptLimits
} from '@/utils/wif'

const PRIVATE_KEY_HEX =
  '0c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d'
const COMPRESSED_WIF = 'KwdMAjGmerYanjeui5SHS7JkmpZvVipYvB2LJGU1ZxJwYvP98617'
const UNCOMPRESSED_WIF = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ'

describe('decodeWif', () => {
  it('keeps the 32-byte key and drops the WIF string', () => {
    const decoded = decodeWif(COMPRESSED_WIF, 'bitcoin')
    expect(decoded).toStrictEqual({
      compressed: true,
      ok: true,
      privateKeyHex: PRIVATE_KEY_HEX
    })
    if (!decoded.ok) {
      return
    }
    expect(JSON.stringify(decoded).includes(COMPRESSED_WIF)).toBe(false)
  })

  it('rejects a checksum that does not match', () => {
    const broken = `${COMPRESSED_WIF.slice(0, -1)}X`
    expect(decodeWif(broken, 'bitcoin')).toStrictEqual({
      ok: false,
      reason: 'invalid'
    })
  })

  it('refuses a network byte that does not match the account', () => {
    expect(decodeWif(COMPRESSED_WIF, 'testnet')).toStrictEqual({
      ok: false,
      reason: 'network'
    })
    expect(decodeWif(COMPRESSED_WIF, 'signet')).toStrictEqual({
      ok: false,
      reason: 'network'
    })
  })

  it('accepts the testnet version byte on testnet and signet', () => {
    const decoded = decodeWif(
      'cNfTcM9zUuCLjePzfHFokPzhvnbdwbsUgfGRS9QS1Yf7pUCgcyRD',
      'signet'
    )
    expect(decoded.ok).toBe(true)
  })
})

describe('wif script limits', () => {
  it('allows only legacy pkh for an uncompressed key', () => {
    expect(isScriptVersionAllowedForWif('P2PKH', false)).toBe(true)
    expect(isScriptVersionAllowedForWif('P2WPKH', false)).toBe(false)
    expect(isScriptVersionAllowedForWif('P2TR', false)).toBe(false)
    expect(isScriptVersionAllowedForWif('P2SH-P2WPKH', false)).toBe(false)
    expect(wifScriptLimits(false).map((limit) => limit.script)).toStrictEqual([
      'P2SH-P2WPKH',
      'P2WPKH',
      'P2TR'
    ])
    expect(
      wifScriptLimits(false).every((limit) => limit.reason === 'uncompressed')
    ).toBe(true)
  })

  it('allows pkh, wpkh, and tr for a compressed key', () => {
    expect(isScriptVersionAllowedForWif('P2PKH', true)).toBe(true)
    expect(isScriptVersionAllowedForWif('P2WPKH', true)).toBe(true)
    expect(isScriptVersionAllowedForWif('P2TR', true)).toBe(true)
    expect(wifScriptLimits(true)).toStrictEqual([
      { reason: 'unsupported', script: 'P2SH-P2WPKH' }
    ])
  })
})

describe('wifImportSecret', () => {
  it('stores a public descriptor with no private key and no derivation', () => {
    const decoded = decodeWif(UNCOMPRESSED_WIF, 'bitcoin')
    if (!decoded.ok) {
      throw new Error('expected a valid WIF')
    }
    const secret = wifImportSecret(decoded, 'P2PKH')
    expect(secret?.externalDescriptor?.includes('/*')).toBe(false)
    expect(secret?.externalDescriptor?.startsWith('pkh(04')).toBe(true)
    expect(secret?.privateKey).toBe(PRIVATE_KEY_HEX)
    expect(secret?.privateKeyCompressed).toBe(false)
    expect(JSON.stringify(secret).includes(UNCOMPRESSED_WIF)).toBe(false)
    expect(
      descriptorHasPrivateKeyMaterial(secret?.externalDescriptor ?? '')
    ).toBe(false)
    expect(secret?.externalDescriptor?.includes(PRIVATE_KEY_HEX)).toBe(false)
  })

  it('builds wpkh and tr descriptors from the compressed public key', () => {
    const wpkh = publicDescriptorFromPrivateKey(PRIVATE_KEY_HEX, true, 'P2WPKH')
    const tr = publicDescriptorFromPrivateKey(PRIVATE_KEY_HEX, true, 'P2TR')
    expect(wpkh?.startsWith('wpkh(02')).toBe(true)
    expect(tr?.startsWith('tr(')).toBe(true)
    expect(tr?.includes('/*')).toBe(false)
    expect(
      publicDescriptorFromPrivateKey(PRIVATE_KEY_HEX, false, 'P2WPKH')
    ).toBe(undefined)
  })
})
