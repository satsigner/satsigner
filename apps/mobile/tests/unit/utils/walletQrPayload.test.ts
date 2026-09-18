import { BBQRFileTypes, createBBQRChunks } from '@/utils/bbqr'
import { detectContentByContext } from '@/utils/contentDetector'
import { decodeURGeneric, getURBytesFragments } from '@/utils/ur'
import {
  decodeBBQRWalletPayload,
  interpretAssembledBitcoinPayload,
  interpretBinaryWalletPayload,
  looksLikeWalletText
} from '@/utils/walletQrPayload'

const DESCRIPTOR =
  "wpkh([d34db33f/84'/0'/0']xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG/0/*)"

describe('wallet QR payload', () => {
  it('treats trimmed bitcoin addresses as wallet text', () => {
    expect(
      looksLikeWalletText('  bc1q8d968eg8ua3dk8mkql9d0vj35nzplsd4zmulus  ')
    ).toBe(true)
  })

  it('treats descriptor strings as wallet text, not hex', () => {
    expect(looksLikeWalletText(DESCRIPTOR)).toBe(true)
    const utf8 = interpretBinaryWalletPayload(Buffer.from(DESCRIPTOR, 'utf8'))
    expect(utf8).toBe(DESCRIPTOR)
    expect(utf8.startsWith('wpkh(')).toBe(true)
  })

  it('keeps PSBT magic as hex', () => {
    const psbtBytes = Buffer.from('70736274ff', 'hex')
    expect(interpretBinaryWalletPayload(psbtBytes)).toBe('70736274ff')
  })

  it('does not wrap descriptor text in a data object', () => {
    const payload = interpretAssembledBitcoinPayload(DESCRIPTOR)
    expect(payload).toBe(DESCRIPTOR)
    expect(typeof payload).toBe('string')
  })

  it('decodes UR bytes fragments to a descriptor string', () => {
    const fragments = getURBytesFragments(DESCRIPTOR, 512)
    expect(fragments[0].toLowerCase().startsWith('ur:bytes/')).toBe(true)
    const decoded = decodeURGeneric(fragments[0])
    expect(decoded).toBe(DESCRIPTOR)
    const detected = detectContentByContext(decoded, 'bitcoin')
    expect(detected.type).toBe('bitcoin_descriptor')
    expect(detected.isValid).toBe(true)
  })

  it('decodes BBQR unicode chunks to a descriptor string', () => {
    const chunks = createBBQRChunks(
      Buffer.from(DESCRIPTOR, 'utf8'),
      BBQRFileTypes.UNICODE,
      800
    )
    expect(chunks.length).toBeGreaterThan(0)
    const decoded = decodeBBQRWalletPayload(chunks)
    expect(decoded).toBe(DESCRIPTOR)
    expect(decoded?.includes('70736274')).toBe(false)
  })
})
