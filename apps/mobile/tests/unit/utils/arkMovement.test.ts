import type { ArkMovement, ArkMovementStatus } from '@/types/models/Ark'
import {
  getArkMovementAmountSats,
  getArkMovementCounterparty,
  getArkMovementKind,
  isLightningMovement,
  isMutedArkMovement,
  isStaleArkExitMovement,
  parseArkCounterparty,
  truncateArkCounterparty
} from '@/utils/arkMovement'

function buildMovement(overrides: Partial<ArkMovement> = {}): ArkMovement {
  return {
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    effectiveBalanceSats: 0,
    exitedVtxoIds: [],
    id: 1,
    inputVtxoIds: [],
    intendedBalanceSats: 0,
    metadataJson: '',
    offchainFeeSats: 0,
    outputVtxoIds: [],
    receivedOnAddresses: [],
    sentToAddresses: [],
    status: 'successful' satisfies ArkMovementStatus,
    subsystemKind: 'arkoor',
    subsystemName: 'bark.send',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('arkMovement utils', () => {
  describe('getArkMovementKind', () => {
    it('returns refresh when subsystem name contains "refresh"', () => {
      const movement = buildMovement({
        effectiveBalanceSats: -500,
        subsystemName: 'bark.refresh'
      })
      expect(getArkMovementKind(movement)).toBe('refresh')
    })

    it('returns receive for positive effective balance', () => {
      const movement = buildMovement({ effectiveBalanceSats: 1000 })
      expect(getArkMovementKind(movement)).toBe('receive')
    })

    it('returns send for negative effective balance', () => {
      const movement = buildMovement({ effectiveBalanceSats: -1000 })
      expect(getArkMovementKind(movement)).toBe('send')
    })

    it('returns refresh when only a fee was paid (balance + fee == 0)', () => {
      const movement = buildMovement({
        effectiveBalanceSats: -100,
        offchainFeeSats: 100
      })
      expect(getArkMovementKind(movement)).toBe('refresh')
    })

    it('falls back to send when failed lightning_send rolled back balance', () => {
      const movement = buildMovement({
        effectiveBalanceSats: 0,
        intendedBalanceSats: -1000,
        status: 'failed',
        subsystemKind: 'invoice',
        subsystemName: 'bark.lightning_send'
      })
      expect(getArkMovementKind(movement)).toBe('send')
    })

    it('falls back to receive when failed receive has zero effective balance', () => {
      const movement = buildMovement({
        effectiveBalanceSats: 0,
        intendedBalanceSats: 1000,
        status: 'failed'
      })
      expect(getArkMovementKind(movement)).toBe('receive')
    })

    it('returns refresh when both balances are zero', () => {
      const movement = buildMovement()
      expect(getArkMovementKind(movement)).toBe('refresh')
    })
  })

  describe('isMutedArkMovement', () => {
    it('mutes failed movements', () => {
      const movement = buildMovement({ status: 'failed' })
      expect(isMutedArkMovement(movement)).toBe(true)
    })

    it('mutes canceled movements', () => {
      const movement = buildMovement({ status: 'canceled' })
      expect(isMutedArkMovement(movement)).toBe(true)
    })

    it('mutes stale exit start movements', () => {
      const movement = buildMovement({
        subsystemKind: 'start',
        subsystemName: 'bark.exit'
      })
      expect(isMutedArkMovement(movement)).toBe(true)
    })

    it('does not mute successful movements', () => {
      const movement = buildMovement({ status: 'successful' })
      expect(isMutedArkMovement(movement)).toBe(false)
    })

    it('does not mute pending movements', () => {
      const movement = buildMovement({ status: 'pending' })
      expect(isMutedArkMovement(movement)).toBe(false)
    })
  })

  describe('isStaleArkExitMovement', () => {
    it('flags exit start with no outputs and no exited vtxos', () => {
      const movement = buildMovement({
        subsystemKind: 'start',
        subsystemName: 'bark.exit'
      })
      expect(isStaleArkExitMovement(movement)).toBe(true)
    })

    it('does not flag exit start with output vtxos', () => {
      const movement = buildMovement({
        outputVtxoIds: ['vtxo1'],
        subsystemKind: 'start',
        subsystemName: 'bark.exit'
      })
      expect(isStaleArkExitMovement(movement)).toBe(false)
    })
  })

  describe('isLightningMovement', () => {
    it.each(['invoice', 'offer', 'lightning_address'])(
      'returns true for subsystemKind %s',
      (kind) => {
        const movement = buildMovement({ subsystemKind: kind })
        expect(isLightningMovement(movement)).toBe(true)
      }
    )

    it('returns false for non-lightning subsystem kinds', () => {
      const movement = buildMovement({ subsystemKind: 'arkoor' })
      expect(isLightningMovement(movement)).toBe(false)
    })
  })

  describe('getArkMovementAmountSats', () => {
    it('returns absolute effective balance when non-zero', () => {
      const movement = buildMovement({
        effectiveBalanceSats: -1234,
        intendedBalanceSats: -9999
      })
      expect(getArkMovementAmountSats(movement)).toBe(1234)
    })

    it('falls back to absolute intended balance when effective is zero', () => {
      const movement = buildMovement({
        effectiveBalanceSats: 0,
        intendedBalanceSats: -2500,
        status: 'failed'
      })
      expect(getArkMovementAmountSats(movement)).toBe(2500)
    })

    it('returns zero when both balances are zero', () => {
      const movement = buildMovement()
      expect(getArkMovementAmountSats(movement)).toBe(0)
    })
  })

  describe('parseArkCounterparty', () => {
    it('extracts value from JSON-wrapped counterparty', () => {
      expect(parseArkCounterparty('{"value":"alice@ln.example"}')).toBe(
        'alice@ln.example'
      )
    })

    it('returns the raw string when JSON has no value field', () => {
      expect(parseArkCounterparty('{"other":"x"}')).toBe('{"other":"x"}')
    })

    it('returns the raw string when not JSON', () => {
      expect(parseArkCounterparty('bc1qxyz')).toBe('bc1qxyz')
    })
  })

  describe('truncateArkCounterparty', () => {
    it('returns short values unchanged', () => {
      expect(truncateArkCounterparty('alice@ln')).toBe('alice@ln')
    })

    it('truncates long values with ellipsis', () => {
      const long = 'bc1qabcdefghijklmnopqrstuvwxyz1234567890'
      expect(truncateArkCounterparty(long, 4)).toBe('bc1q...7890')
    })
  })

  describe('getArkMovementCounterparty', () => {
    it('returns null for refresh movements', () => {
      const movement = buildMovement({
        sentToAddresses: ['addr'],
        subsystemName: 'bark.refresh'
      })
      expect(getArkMovementCounterparty(movement)).toBeNull()
    })

    it('returns first sent address for send movements', () => {
      const movement = buildMovement({
        effectiveBalanceSats: -1000,
        sentToAddresses: ['{"value":"alice@ln.example"}']
      })
      expect(getArkMovementCounterparty(movement)).toBe('alice@ln.example')
    })

    it('returns first received address for receive movements', () => {
      const movement = buildMovement({
        effectiveBalanceSats: 1000,
        receivedOnAddresses: ['bob@ln.example']
      })
      expect(getArkMovementCounterparty(movement)).toBe('bob@ln.example')
    })

    it('returns counterparty for failed sends via intended balance fallback', () => {
      const movement = buildMovement({
        intendedBalanceSats: -500,
        sentToAddresses: ['lnbc500...'],
        status: 'failed',
        subsystemKind: 'invoice',
        subsystemName: 'bark.lightning_send'
      })
      expect(getArkMovementCounterparty(movement)).toBe('lnbc500...')
    })
  })
})
