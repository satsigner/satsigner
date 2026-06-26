import { type Utxo } from '@/types/models/Utxo'
import {
  selectEfficientUtxos,
  selectStonewallUtxos,
  selectUtxos
} from '@/utils/utxo'

// getScriptVersionType only checks the prefix, the first data char and the
// length (42-44 for P2WPKH), not the checksum, so a synthetic bech32-shaped
// string is enough to make a mock UTXO resolve to a P2WPKH input.
function p2wpkhAddress(index: number): string {
  return `bc1q${index.toString().padStart(38, '0')}`
}

function createMockUtxos(values: number[]): Utxo[] {
  return values.map((value, index) => ({
    addressTo: p2wpkhAddress(index),
    keychain: 'external' as const,
    label: '',
    txid: `tx${index}`,
    value,
    vout: 0
  }))
}

function sumInputs(inputs: Utxo[]): number {
  return inputs.reduce((sum, input) => sum + input.value, 0)
}

describe('efficiency UTXO Selection Algorithm', () => {
  it('should select a single changeless UTXO and absorb dust change into the fee', () => {
    const utxos = createMockUtxos([10000, 20000, 30000])
    // Branch and Bound lands the 10000 UTXO (effective value 9933, i.e.
    // 10000 - floor(67.75)) inside the [actualTarget, actualTarget +
    // costOfChange] window, so it is chosen changeless. The 10 sat leftover is
    // below the 546 dust threshold, so it is absorbed into the fee.
    const targetAmount = 9850
    const feeRate = 1

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)

    expect(result.error).toBeUndefined()
    expect(result.inputs.map((i) => i.value)).toStrictEqual([10000])
    expect(result.change).toBe(0)
    expect(result.fee).toBe(150) // 10000 - 9850, the absorbed leftover
  })

  it('should keep a change output when the leftover exceeds the cost of change', () => {
    const utxos = createMockUtxos([10000])
    const targetAmount = 5000
    const feeRate = 1

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)

    // Single input, fee includes one recipient + one change output:
    // floor((10 + 0.5 segwit + 67.75 input + 31 recipient + 31 change)) = 140.
    expect(result.error).toBeUndefined()
    expect(result.inputs.map((i) => i.value)).toStrictEqual([10000])
    expect(result.fee).toBe(140)
    expect(result.change).toBe(4860) // 10000 - 5000 - 140
    expect(sumInputs(result.inputs)).toBe(
      targetAmount + result.fee + result.change
    )
  })

  it('should return error when there are insufficient funds', () => {
    const utxos = createMockUtxos([1000, 2000])
    const targetAmount = 10000
    const feeRate = 1

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)
    expect(result.error).toBe('Insufficient funds')
    expect(result.inputs).toHaveLength(0)
  })

  it('should return error for an empty UTXO set', () => {
    const result = selectEfficientUtxos([], 1000, 1)
    expect(result.error).toBe('Insufficient funds')
    expect(result.inputs).toHaveLength(0)
  })

  it('should select multiple UTXOs when no single one covers the target', () => {
    const utxos = createMockUtxos([5000, 3000, 2000, 1000])
    const targetAmount = 4000
    const feeRate = 1

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)
    expect(result.inputs.length).toBeGreaterThan(1)
    expect(sumInputs(result.inputs)).toBeGreaterThanOrEqual(
      targetAmount + result.fee + result.change
    )
  })

  it('should conserve value at high fee rates', () => {
    const utxos = createMockUtxos([10000, 20000, 30000])
    const targetAmount = 25000
    const feeRate = 50

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)
    expect(result.fee).toBeGreaterThan(0)
    expect(sumInputs(result.inputs)).toBe(
      targetAmount + result.fee + result.change
    )
  })

  it('should fall back to knapsack when no changeless BnB solution exists', () => {
    // For these values at feeRate 1 no subset effective value lands in the
    // [actualTarget, actualTarget + costOfChange] window, so BnB returns null
    // and the knapsack fallback selects a change-bearing set.
    const utxos = createMockUtxos([1000, 2000, 3000, 4000, 5000, 6000, 7000])
    const targetAmount = 8000
    const feeRate = 1

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)
    expect(result.error).toBeUndefined()
    expect(sumInputs(result.inputs)).toBe(
      targetAmount + result.fee + result.change
    )
  })

  it('should still fund the target when negative-value dust UTXOs are present', () => {
    const utxos = createMockUtxos([1, 2, 10000])
    const targetAmount = 100
    const feeRate = 2

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)

    // Sparrow's selectors do not pre-filter dust, so dust may be co-selected;
    // the contract is that the funded amount still covers target plus fee.
    expect(result.error).toBeUndefined()
    expect(sumInputs(result.inputs)).toBe(
      targetAmount + result.fee + result.change
    )
  })

  it('privacy strategy skips BnB and still funds the target via knapsack', () => {
    const utxos = createMockUtxos([10000, 20000, 30000])
    const targetAmount = 9850
    const feeRate = 1

    // The efficiency strategy lands the changeless 10000 UTXO via BnB; the
    // privacy strategy skips BnB and goes straight to the knapsack selector.
    const privacy = selectUtxos(utxos, targetAmount, feeRate, 'privacy')

    expect(privacy.error).toBeUndefined()
    expect(sumInputs(privacy.inputs)).toBe(
      targetAmount + privacy.fee + privacy.change
    )
  })
})

describe('stonewall utxo selection algorithm', () => {
  it('should create a valid STONEWALL transaction with sufficient funds', () => {
    const utxos = createMockUtxos([10000, 20000, 30000, 40000, 50000, 60000])
    const targetAmount = 75000
    const feeRate = 2

    const result = selectStonewallUtxos(utxos, targetAmount, feeRate)

    expect(result.error).toBeUndefined()
    expect(result.inputs).toBeDefined()
    expect(result.outputs).toBeDefined()

    // Two independent input sets, each covering the target.
    expect(result.inputs.length).toBeGreaterThanOrEqual(2)
    // recipient + one change per set.
    expect(result.outputs.length).toBeGreaterThanOrEqual(2)

    const totalOutput = result.outputs.reduce(
      (sum, output) => sum + output.value,
      0
    )
    // Value is conserved: inputs == outputs + fee.
    expect(sumInputs(result.inputs)).toStrictEqual(totalOutput + result.fee)

    // Exactly one recipient output, paid the requested amount.
    const recipients = result.outputs.filter((o) => o.type === 'recipient')
    expect(recipients).toHaveLength(1)
    expect(recipients[0].value).toBe(targetAmount)

    // The fee splits evenly across the two sets (multiple of the set count).
    expect(result.fee % 2).toBe(0)
  })

  it('should return error when there are insufficient funds', () => {
    const utxos = createMockUtxos([1000, 2000])
    const targetAmount = 10000
    const feeRate = 1

    const result = selectStonewallUtxos(utxos, targetAmount, feeRate)

    expect(result.error).toBe('Insufficient funds')
  })

  it('should produce one change output per input set', () => {
    const utxos = createMockUtxos([100000, 200000, 150000, 250000])
    const targetAmount = 50000
    const feeRate = 1

    const result = selectStonewallUtxos(utxos, targetAmount, feeRate)

    expect(result.error).toBeUndefined()

    const changeOutputs = result.outputs.filter((o) => o.type === 'change')
    expect(changeOutputs).toHaveLength(2)
    expect(changeOutputs.every((o) => o.value > 0)).toBe(true)
  })

  it('should absorb dust change into the fee instead of failing', () => {
    // Each set lands a single 10500 UTXO; change (~365) falls below the 546
    // dust floor, so Sparrow keeps the recipient + fake-mix structure and folds
    // the surplus into the fee rather than aborting.
    const utxos = createMockUtxos([10500, 10500, 10500, 10500])
    const targetAmount = 10000
    const feeRate = 1

    const result = selectStonewallUtxos(utxos, targetAmount, feeRate)

    expect(result.error).toBeUndefined()
    // No change outputs: the dust was absorbed into the fee.
    expect(result.outputs.filter((o) => o.type === 'change')).toHaveLength(0)
    // Structure preserved: one recipient + one fake-mix, both the target amount.
    expect(result.outputs.filter((o) => o.type === 'recipient')).toHaveLength(1)
    expect(result.outputs.filter((o) => o.type === 'fakeMix')).toHaveLength(1)
    const totalOutput = result.outputs.reduce((sum, o) => sum + o.value, 0)
    expect(sumInputs(result.inputs)).toStrictEqual(totalOutput + result.fee)
  })

  it('should handle large UTXO sets efficiently', () => {
    const values = Array.from({ length: 100 }, (_, i) => 10000 + i * 1000)
    const utxos = createMockUtxos(values)

    const targetAmount = 500000
    const feeRate = 2

    const result = selectStonewallUtxos(utxos, targetAmount, feeRate)

    expect(result.error).toBeUndefined()
    expect(result.inputs).toBeDefined()
    expect(result.inputs.length).toBeGreaterThan(0)
  })
})
