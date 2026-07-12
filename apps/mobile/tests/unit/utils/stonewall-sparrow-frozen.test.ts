import {
  matchUtxoToRef,
  SPARROW_STONEWALL_FEE,
  SPARROW_STONEWALL_SELECTION
} from '@/tests/int/utils/signetStonewallFixture'
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
          to: SIGNET_STONEWALL_RECIPIENT
        }
      ],
      recipientScriptType: 'P2WPKH',
      seed: 42
    }
  )
}

describe('stonewall sparrow frozen pool', () => {
  /**
   * Requires correct derivation indices for all 16 catalog UTXOs in
   * signetStonewallFrozenPool.ts. Three entries still use estimated indices.
   * See STONEWALL-SPARROW-PARITY.md.
   */
  it.skip('matches Sparrow after excluding the first auto-selected input', () => {
    const { addresses, utxos } = buildFrozenSignetPool()

    const auto = stonewallSelect(utxos, addresses)
    expect(auto.error).toBeUndefined()

    const [removed] = auto.inputs
    const afterRemoval = stonewallSelect(utxos, addresses, [removed])
    expect(afterRemoval.error).toBeUndefined()

    const expectedOutpoints = SPARROW_STONEWALL_SELECTION.map((ref) => {
      const hit = utxos.find((utxo) => matchUtxoToRef(utxo, ref))
      expect(hit).toBeDefined()
      return getUtxoOutpoint(hit!)
    }).toSorted()

    expect(afterRemoval.fee).toBe(SPARROW_STONEWALL_FEE)
    expect(afterRemoval.inputs.map(getUtxoOutpoint).toSorted()).toStrictEqual(
      expectedOutpoints
    )
  })

  it('produces a valid STONEWALL structure on the frozen catalog', () => {
    const { addresses, utxos } = buildFrozenSignetPool()
    const result = stonewallSelect(utxos, addresses)

    expect(result.error).toBeUndefined()
    expect(result.inputs.length).toBeGreaterThanOrEqual(2)
    expect(result.fee).toBeGreaterThan(0)
  })
})
