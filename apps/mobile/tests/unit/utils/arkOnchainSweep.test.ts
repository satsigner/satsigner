import { DUST_LIMIT } from '@/constants/btc'
import { type CreationType } from '@/types/models/Account'
import { type Network } from '@/types/settings/blockchain'
import {
  canAccountReceiveArkSweep,
  computeArkOnchainSweep,
  getArkOnchainSweepBlocker,
  getArkSweepDestinations,
  isValidArkOnchainFeeRate
} from '@/utils/arkOnchainSweep'

describe('computeArkOnchainSweep', () => {
  it('rejects an empty wallet', () => {
    expect(
      computeArkOnchainSweep({ feeRateSatPerVb: 1, utxos: [] })
    ).toStrictEqual({ ok: false, reason: 'empty' })
  })

  it('sends everything minus a fee sized for every input', () => {
    const sweep = computeArkOnchainSweep({
      feeRateSatPerVb: 2,
      utxos: [{ amountSats: 10_000 }, { amountSats: 5000 }]
    })
    // (11 + 68 * 2 + 43) vB * 2 sat/vB
    expect(sweep).toStrictEqual({ amountSats: 14_620, feeSats: 380, ok: true })
  })

  it('rounds a fractional fee up', () => {
    const sweep = computeArkOnchainSweep({
      feeRateSatPerVb: 1.5,
      utxos: [{ amountSats: 10_000 }]
    })
    // 122 vB * 1.5 sat/vB = 183
    expect(sweep).toStrictEqual({ amountSats: 9817, feeSats: 183, ok: true })
  })

  it('rejects a sweep that would leave less than dust', () => {
    expect(
      computeArkOnchainSweep({
        feeRateSatPerVb: 1,
        utxos: [{ amountSats: DUST_LIMIT + 100 }]
      })
    ).toStrictEqual({ ok: false, reason: 'belowDust' })
  })

  it('accepts a sweep that leaves exactly dust', () => {
    const sweep = computeArkOnchainSweep({
      feeRateSatPerVb: 1,
      utxos: [{ amountSats: DUST_LIMIT + 122 }]
    })
    expect(sweep).toStrictEqual({
      amountSats: DUST_LIMIT,
      feeSats: 122,
      ok: true
    })
  })
})

function receivingAccount(
  network: Network,
  creationType: CreationType | undefined
) {
  return {
    keys: [{ creationType, index: 0, iv: '', secret: '' }],
    network
  }
}

describe('canAccountReceiveArkSweep', () => {
  it('accepts a descriptor wallet on the same network', () => {
    expect(
      canAccountReceiveArkSweep(
        receivingAccount('signet', 'importDescriptor'),
        'signet'
      )
    ).toBe(true)
  })

  it('rejects another network', () => {
    expect(
      canAccountReceiveArkSweep(
        receivingAccount('bitcoin', 'importDescriptor'),
        'signet'
      )
    ).toBe(false)
  })

  it('rejects a single-address watch-only wallet', () => {
    expect(
      canAccountReceiveArkSweep(
        receivingAccount('signet', 'importAddress'),
        'signet'
      )
    ).toBe(false)
  })

  it('rejects an account without keys', () => {
    expect(
      canAccountReceiveArkSweep({ keys: [], network: 'signet' }, 'signet')
    ).toBe(false)
  })
})

describe('getArkSweepDestinations', () => {
  it('keeps only accounts that can receive on the network', () => {
    const eligible = {
      id: 'a',
      ...receivingAccount('signet', 'importMnemonic')
    }
    const otherNetwork = {
      id: 'b',
      ...receivingAccount('bitcoin', 'importMnemonic')
    }
    const addressOnly = {
      id: 'c',
      ...receivingAccount('signet', 'importAddress')
    }
    expect(
      getArkSweepDestinations([eligible, otherNetwork, addressOnly], 'signet')
    ).toStrictEqual([eligible])
  })
})

describe('getArkOnchainSweepBlocker', () => {
  const ready: Parameters<typeof getArkOnchainSweepBlocker>[0] = {
    hasDestination: true,
    pendingExitSats: 0,
    spendInFlight: false,
    sweep: { amountSats: 9000, feeSats: 122, ok: true }
  }

  it('allows a sweep when everything is ready', () => {
    expect(getArkOnchainSweepBlocker(ready)).toBeUndefined()
  })

  it('waits until the Ark balance is known', () => {
    expect(
      getArkOnchainSweepBlocker({ ...ready, pendingExitSats: undefined })
    ).toBe('loading')
  })

  it('waits until the preview is known', () => {
    expect(getArkOnchainSweepBlocker({ ...ready, sweep: undefined })).toBe(
      'loading'
    )
  })

  it('blocks while an exit is in progress', () => {
    expect(getArkOnchainSweepBlocker({ ...ready, pendingExitSats: 1 })).toBe(
      'exitInProgress'
    )
  })

  it('blocks while another spend is in flight', () => {
    expect(getArkOnchainSweepBlocker({ ...ready, spendInFlight: true })).toBe(
      'busy'
    )
  })

  it('reports why the sweep itself is rejected', () => {
    expect(
      getArkOnchainSweepBlocker({
        ...ready,
        sweep: { ok: false, reason: 'belowDust' }
      })
    ).toBe('belowDust')
  })

  it('blocks without a destination wallet', () => {
    expect(getArkOnchainSweepBlocker({ ...ready, hasDestination: false })).toBe(
      'noDestination'
    )
  })
})

describe('isValidArkOnchainFeeRate', () => {
  it('accepts a rate at or above the minimum', () => {
    expect(isValidArkOnchainFeeRate(1)).toBe(true)
    expect(isValidArkOnchainFeeRate(12.5)).toBe(true)
  })

  it('rejects a rate below the minimum or not finite', () => {
    expect(isValidArkOnchainFeeRate(0)).toBe(false)
    expect(isValidArkOnchainFeeRate(Number.NaN)).toBe(false)
    expect(isValidArkOnchainFeeRate(Number.POSITIVE_INFINITY)).toBe(false)
  })
})
