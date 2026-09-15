import { extractPayjoinOriginalPsbt } from '@/utils/payjoinOriginalPsbt'

const SAMPLE_BASE64 =
  'cHNidP8BAFUCAAAAAVa19T4xk5x/eCRI8LcdGabvAYudhqLAiPl2xBmfKDulAAAAAAD9////AYAaBgAAAAAAF6kUcNqLdOW2bSHjTJR4v4oQynIhMQWHAAAAAA=='

describe('extractPayjoinOriginalPsbt', () => {
  it('finds a base64 PSBT nested in a session event', () => {
    expect(
      extractPayjoinOriginalPsbt([
        '{"Created":{}}',
        JSON.stringify({ RetrievedOriginalPayload: { psbt: SAMPLE_BASE64 } })
      ])
    ).toBe(SAMPLE_BASE64)
  })

  it('finds a hex PSBT (PDK serde) and returns base64', () => {
    const hex = Buffer.from(SAMPLE_BASE64, 'base64').toString('hex')
    expect(
      extractPayjoinOriginalPsbt([
        JSON.stringify({ RetrievedOriginalPayload: { original: hex } })
      ])
    ).toBe(Buffer.from(hex, 'hex').toString('base64'))
  })

  it('finds a byte-array PSBT', () => {
    const bytes = [...Buffer.from(SAMPLE_BASE64, 'base64')]
    expect(
      extractPayjoinOriginalPsbt([JSON.stringify({ psbt: bytes })])
    ).toBe(SAMPLE_BASE64)
  })

  it('returns undefined when no PSBT is present', () => {
    expect(extractPayjoinOriginalPsbt(['{"Created":{}}'])).toBeUndefined()
    expect(extractPayjoinOriginalPsbt([])).toBeUndefined()
  })
})
