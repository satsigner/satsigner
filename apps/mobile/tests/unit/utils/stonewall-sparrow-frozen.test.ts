import { buildFrozenSignetPool } from '@/tests/int/utils/signetStonewallFrozenPool'
import {
  SIGNET_STONEWALL_AMOUNT,
  SIGNET_STONEWALL_FEE_RATE,
  SIGNET_STONEWALL_RECIPIENT
} from '@/tests/int/utils/signetStonewallWallet'
import { getUtxoOutpoint, selectStonewallUtxos } from '@/utils/utxo'

function stonewallSelect(
  utxos: ReturnType<typeof buildFrozenSignetPool>['utxos'],
  addresses: ReturnType<typeof buildFrozenSignetPool>['addresses'],
  excluded: typeof utxos = []
) {
  const excludedSet = new Set(excluded.map(getUtxoOutpoint))
  const pool = utxos.filter((utxo) => !excludedSet.has(getUtxoOutpoint(utxo)))

  return selectStonewallUtxos(
    pool,
    SIGNET_STONEWALL_AMOUNT,
    SIGNET_STONEWALL_FEE_RATE,
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
})
