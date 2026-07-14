import { buildFrozenSignetPool } from '@/tests/int/utils/signetStonewallFrozenPool'
import {
  SIGNET_STONEWALL_AMOUNT,
  SIGNET_STONEWALL_FEE_RATE,
  SIGNET_STONEWALL_RECIPIENT
} from '@/tests/int/utils/signetStonewallWallet'
import {
  filterUtxosByExcludedOutpoints,
  getUtxoOutpoint,
  selectStonewallUtxos
} from '@/utils/utxo'

function stonewallSelect(
  utxos: ReturnType<typeof buildFrozenSignetPool>['utxos'],
  addresses: ReturnType<typeof buildFrozenSignetPool>['addresses'],
  options: {
    excluded?: ReturnType<typeof buildFrozenSignetPool>['utxos']
    feeRate?: number
  } = {}
) {
  const pool = filterUtxosByExcludedOutpoints(
    utxos,
    (options.excluded ?? []).map(getUtxoOutpoint)
  )

  return selectStonewallUtxos(
    pool,
    SIGNET_STONEWALL_AMOUNT,
    options.feeRate ?? SIGNET_STONEWALL_FEE_RATE,
    {
      addresses,
      changeScriptType: 'P2WPKH',
      outputs: [
        {
          amount: SIGNET_STONEWALL_AMOUNT,
          label: 'Test utxos selection',
          localId: 'signet-stonewall-recipient',
          to: SIGNET_STONEWALL_RECIPIENT
        }
      ],
      recipientScriptType: 'P2WPKH',
      seed: 42
    }
  )
}

describe('stonewall sparrow frozen pool', () => {
  it('produces a valid STONEWALL structure on the frozen catalog', () => {
    const { addresses, utxos } = buildFrozenSignetPool()
    const result = stonewallSelect(utxos, addresses)

    expect(result.error).toBeUndefined()
    expect(result.inputs.length).toBeGreaterThanOrEqual(2)
    expect(result.fee).toBeGreaterThan(0)
  })

  it('rebuilds without excluded inputs', () => {
    const { addresses, utxos } = buildFrozenSignetPool()
    const full = stonewallSelect(utxos, addresses)

    expect(full.error).toBeUndefined()
    expect(full.inputs.length).toBeGreaterThan(0)

    const [removed] = full.inputs
    const after = stonewallSelect(utxos, addresses, { excluded: [removed] })

    expect(after.error).toBeUndefined()
    expect(after.inputs.map(getUtxoOutpoint)).not.toContain(
      getUtxoOutpoint(removed)
    )
    expect(after.inputs.length).toBeGreaterThan(0)
    expect(after.fee).toBeGreaterThan(0)
  })

  it('reselects when fee rate changes with exclusions preserved', () => {
    const { addresses, utxos } = buildFrozenSignetPool()
    const full = stonewallSelect(utxos, addresses)

    expect(full.error).toBeUndefined()

    const [removed] = full.inputs
    const excluded = [removed]
    const lowFee = stonewallSelect(utxos, addresses, {
      excluded,
      feeRate: SIGNET_STONEWALL_FEE_RATE
    })
    const highFee = stonewallSelect(utxos, addresses, {
      excluded,
      feeRate: SIGNET_STONEWALL_FEE_RATE * 2
    })

    expect(lowFee.error).toBeUndefined()
    expect(highFee.error).toBeUndefined()
    expect(lowFee.inputs.map(getUtxoOutpoint)).not.toContain(
      getUtxoOutpoint(removed)
    )
    expect(highFee.inputs.map(getUtxoOutpoint)).not.toContain(
      getUtxoOutpoint(removed)
    )
    expect(highFee.fee).toBeGreaterThan(lowFee.fee)
  })
})
