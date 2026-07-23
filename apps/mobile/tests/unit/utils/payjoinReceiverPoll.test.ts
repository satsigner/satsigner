import { type PayjoinSession } from '@/types/payjoin'
import {
  receiverPollEffectKey,
  resolveReceiverPollMode
} from '@/utils/payjoinReceiverPoll'

function session(
  overrides: Partial<PayjoinSession> & Pick<PayjoinSession, 'id' | 'status'>
): PayjoinSession {
  return {
    accountId: 'acc',
    address: 'tb1q',
    createdAt: 1,
    expiresAt: 2,
    pjEndpoint: 'https://payjo.in/mb',
    pjos: 0,
    protocol: 'bip77',
    role: 'receiver',
    updatedAt: 1,
    uri: 'bitcoin:tb1q',
    ...overrides
  }
}

describe('resolveReceiverPollMode', () => {
  it('turns off when payjoin is unavailable or session missing', () => {
    expect(
      resolveReceiverPollMode({ canUsePayjoin: false, session: undefined })
    ).toStrictEqual({ kind: 'off' })
    expect(
      resolveReceiverPollMode({ canUsePayjoin: true, session: undefined })
    ).toStrictEqual({ kind: 'off' })
  })

  it('turns off for completed and expired sessions', () => {
    expect(
      resolveReceiverPollMode({
        canUsePayjoin: true,
        session: session({ id: 'a', status: 'completed' })
      })
    ).toStrictEqual({ kind: 'off' })
    expect(
      resolveReceiverPollMode({
        canUsePayjoin: true,
        session: session({ id: 'a', status: 'expired' })
      })
    ).toStrictEqual({ kind: 'off' })
  })

  it('retries poll for recoverable errors, otherwise restarts', () => {
    expect(
      resolveReceiverPollMode({
        canUsePayjoin: true,
        session: session({
          id: 'a',
          nativeState: 'ns',
          originalPsbtBase64: 'psbt',
          status: 'error'
        })
      })
    ).toStrictEqual({ kind: 'retry_poll', sessionId: 'a' })
    expect(
      resolveReceiverPollMode({
        canUsePayjoin: true,
        session: session({ id: 'a', status: 'error' })
      })
    ).toStrictEqual({ kind: 'restart', sessionId: 'a' })
  })

  it('restarts when native state is missing, otherwise polls', () => {
    expect(
      resolveReceiverPollMode({
        canUsePayjoin: true,
        session: session({ id: 'a', status: 'ready' })
      })
    ).toStrictEqual({ kind: 'restart', sessionId: 'a' })
    expect(
      resolveReceiverPollMode({
        canUsePayjoin: true,
        session: session({ id: 'a', nativeState: 'ns', status: 'ready' })
      })
    ).toStrictEqual({ kind: 'poll', sessionId: 'a' })
  })
})

describe('receiverPollEffectKey', () => {
  it('keeps poll mode stable across non-terminal status churn', () => {
    expect(receiverPollEffectKey({ kind: 'poll', sessionId: 'a' })).toBe(
      'poll:a'
    )
    expect(receiverPollEffectKey({ kind: 'off' })).toBe('off')
    expect(receiverPollEffectKey({ kind: 'restart', sessionId: 'a' })).toBe(
      'restart:a'
    )
  })
})
