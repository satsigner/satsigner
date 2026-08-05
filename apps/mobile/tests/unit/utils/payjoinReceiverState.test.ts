import { receiverNativeStateIsDurable } from '@/utils/payjoinReceiverState'

describe('receiverNativeStateIsDurable', () => {
  it('rejects missing and legacy id-only blobs', () => {
    expect(receiverNativeStateIsDurable(undefined)).toBe(false)
    const legacy = Buffer.from(
      JSON.stringify({ id: 'abc', protocol: 'v2', role: 'receiver' })
    ).toString('base64')
    expect(receiverNativeStateIsDurable(legacy)).toBe(false)
  })

  it('accepts blobs that embed a non-empty events log', () => {
    const durable = Buffer.from(
      JSON.stringify({
        events: [{ Created: {} }],
        id: 'abc',
        protocol: 'v2',
        role: 'receiver'
      })
    ).toString('base64')
    expect(receiverNativeStateIsDurable(durable)).toBe(true)
  })
})
