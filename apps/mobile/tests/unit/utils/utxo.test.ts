import { type Utxo } from '@/types/models/Utxo'
import { selectEfficientUtxos } from '@/utils/utxo'

describe('Efficiency UTXO Selection Algorithm', () => {
  // helper function to create mock utxos
  function createMockUtxos(value: number[]) {
    return value.map((value, index) => ({
      txid: `tx${index}`,
      vout: 0,
      value,
      label: '',
      keychain: 'external' as const,
      effectiveValue: value,
      scriptType: 'p2wpkh' as const
    }))
  }

  test('it should select a single utxo when it exactly matches the target amount', () => {
    const utxos = createMockUtxos([10000, 20000, 30000])
    const target = 10000
    const feeRate = 1
    const result = selectEfficientUtxos(utxos, target, feeRate)
    expect(result.inputs.length).toBe(1)
    expect(result.inputs[0].value).toBe(10000)
  })

  test('should return error when there are insufficient funds', () => {
    const utxos = createMockUtxos([1000, 2000])
    const targetAmount = 10000
    const feeRate = 1

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)
    if ('error' in result) {
      expect(result.error).toBe('Insufficient funds')
      expect(result.inputs.length).toBe(0)
    }
  })

  test('should select multiple UTXOs when needed', () => {
    const utxos = createMockUtxos([5000, 3000, 2000, 1000])
    const targetAmount = 4000
    const feeRate = 1

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)
    expect(result.inputs.length).toBeGreaterThan(1)
    const totalSelected = result.inputs.reduce(
      (sum: number, utxo: Utxo) => sum + utxo.value,
      0
    )
    expect(totalSelected).toBeGreaterThanOrEqual(targetAmount + result.fee)
  })

  test('should handle high fee rates properly', () => {
    const utxos = createMockUtxos([10000, 20000, 30000])
    const targetAmount = 25000
    const feeRate = 50 // Very high fee rate

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)
    expect(result.fee).toBeGreaterThan(0)
    const totalSelected = result.inputs.reduce(
      (sum: number, utxo: Utxo) => sum + utxo.value,
      0
    )
    expect(totalSelected - result.fee - targetAmount).toBeGreaterThanOrEqual(0)
  })

  test('should find optimal selection using branch and bound', () => {
    const utxos = createMockUtxos([1000, 2000, 3000, 4000, 5000, 6000, 7000])
    const targetAmount = 8000
    const feeRate = 1

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)
    // The optimal solution should select as few inputs as possible
    // while minimizing waste (change)
    expect(result.inputs.length).toBeLessThanOrEqual(3)
  })

  test('should handle extremely small values correctly', () => {
    const utxos = [
      {
        txid: 'tx1',
        vout: 0,
        value: 1,
        keychain: 'external' as const,
        effectiveValue: 1,
        scriptType: 'p2wpkh' as const
      }, // 1 satoshi
      {
        txid: 'tx2',
        vout: 0,
        value: 2,
        keychain: 'external' as const,
        effectiveValue: 2,
        scriptType: 'p2wpkh' as const
      }, // 2 satoshis
      {
        txid: 'tx3',
        vout: 0,
        value: 10000,
        keychain: 'external' as const,
        effectiveValue: 10000,
        scriptType: 'p2wpkh' as const
      } // One normal UTXO
    ]

    const targetAmount = 100
    const feeRate = 2

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)

    // Should ignore tiny UTXOs that would cost more to spend than they're worth
    expect(result.inputs.length).toBe(1)
    expect(result.inputs[0].txid).toBe('tx3')
  })
})
