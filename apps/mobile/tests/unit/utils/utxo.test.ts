import { type Utxo } from '@/types/models/Utxo'
import {
  calculateStonewallEntropy,
  distributeChangeWithPrivacy,
  selectEfficientUtxos,
  selectStonewallUtxos
} from '@/utils/utxo'

describe('efficiency UTXO Selection Algorithm', () => {
  // helper function to create mock utxos
  function createMockUtxos(value: number[]) {
    return value.map((value, index) => ({
      effectiveValue: value,
      keychain: 'external' as const,
      label: '',
      scriptType: 'p2wpkh' as const,
      txid: `tx${index}`,
      value,
      vout: 0
    }))
  }

  it('should select a single utxo when it exactly matches the target amount', () => {
    const utxos = createMockUtxos([10000, 20000, 30000])
    const target = 10000
    const feeRate = 1
    const result = selectEfficientUtxos(utxos, target, feeRate)
    expect(result.inputs).toHaveLength(1)
    expect(result.inputs[0].value).toBe(10000)
  })

  it('should return error when there are insufficient funds', () => {
    const utxos = createMockUtxos([1000, 2000])
    const targetAmount = 10000
    const feeRate = 1

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)
    expect(result.error).toBe('Insufficient funds')
    expect(result.inputs).toHaveLength(0)
  })

  it('should select multiple UTXOs when needed', () => {
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

  it('should handle high fee rates properly', () => {
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

  it('should find optimal selection using branch and bound', () => {
    const utxos = createMockUtxos([1000, 2000, 3000, 4000, 5000, 6000, 7000])
    const targetAmount = 8000
    const feeRate = 1

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)
    // The optimal solution should select as few inputs as possible
    // while minimizing waste (change)
    expect(result.inputs.length).toBeLessThanOrEqual(3)
  })

  it('should handle extremely small values correctly', () => {
    const utxos = [
      {
        effectiveValue: 1,
        keychain: 'external' as const,
        scriptType: 'p2wpkh' as const,
        txid: 'tx1',
        value: 1,
        vout: 0
      }, // 1 satoshi
      {
        effectiveValue: 2,
        keychain: 'external' as const,
        scriptType: 'p2wpkh' as const,
        txid: 'tx2',
        value: 2,
        vout: 0
      }, // 2 satoshis
      {
        effectiveValue: 10000,
        keychain: 'external' as const,
        scriptType: 'p2wpkh' as const,
        txid: 'tx3',
        value: 10000,
        vout: 0
      } // One normal UTXO
    ]

    const targetAmount = 100
    const feeRate = 2

    const result = selectEfficientUtxos(utxos, targetAmount, feeRate)

    // Should ignore tiny UTXOs that would cost more to spend than they're worth
    expect(result.inputs).toHaveLength(1)
    expect(result.inputs[0].txid).toBe('tx3')
  })
})

describe('stonewall utxo selection algorithm', () => {
  // Helper functions for creating test UTXOs
  function createMockUtxos(
    values: number[],
    options?: { scriptTypes?: ('p2pkh' | 'p2wpkh' | 'p2sh-p2wpkh')[] }
  ) {
    return values.map((value, index) => ({
      confirmations: 6,
      effectiveValue: value,
      keychain: 'external' as const,
      scriptPubKey: 'mock-script',
      scriptType: options?.scriptTypes?.[0] || 'p2wpkh',
      txid: `tx${index}`,
      value,
      vout: 0
    }))
  }

  it('should create a valid STONEWALL transaction with sufficient funds', () => {
    const utxos = createMockUtxos([10000, 20000, 30000, 40000, 50000, 60000], {
      scriptTypes: ['p2pkh', 'p2wpkh']
    })
    const targetAmount = 75000
    const feeRate = 2

    const result = selectStonewallUtxos(utxos, targetAmount, feeRate)

    expect(result.error).toBeUndefined()
    expect(result.inputs).toBeDefined()
    expect(result.outputs).toBeDefined()

    if (!result.inputs || !result.outputs || !result.fee) {
      throw new Error('Expected inputs, outputs and fee to be defined')
    }

    expect(result.inputs.length).toBeGreaterThanOrEqual(4) // STONEWALL requires multiple inputs
    expect(result.outputs.length).toBeGreaterThanOrEqual(2) // At least recipient + change

    // Verify total inputs cover outputs + fee
    const totalInput = result.inputs.reduce(
      (sum, input) => sum + input.value,
      0
    )
    const totalOutput = result.outputs.reduce(
      (sum, output) => sum + output.value,
      0
    )
    expect(totalInput).toStrictEqual(totalOutput + result.fee)

    // Verify privacy score is calculated
    expect(result.privacyScore).toBeGreaterThan(0)
  })

  // Test with insufficient funds
  it('should return error when there are insufficient funds', () => {
    const utxos = createMockUtxos([1000, 2000])
    const targetAmount = 10000
    const feeRate = 1

    const result = selectStonewallUtxos(utxos, targetAmount, feeRate)

    expect(result.error).toBe('Insufficient funds')
  })

  // Test change output distribution
  it('should create well-distributed change outputs', () => {
    const utxos = createMockUtxos([100000, 200000])
    const targetAmount = 50000
    const feeRate = 1

    const result = selectStonewallUtxos(utxos, targetAmount, feeRate, {
      minOutputs: 3 // Force at least 2 change outputs
    })

    expect(result.error).toBeUndefined()
    expect(result.outputs).toBeDefined()

    if (!result.outputs) {
      throw new Error('Expected outputs to be defined')
    }

    expect(result.outputs.length).toBeGreaterThanOrEqual(3) // Recipient + at least 2 change

    // Extract change outputs (non-recipient outputs)
    const changeOutputs = result.outputs.filter(
      (output) => !(output as { recipient?: boolean }).recipient
    )
    expect(changeOutputs.length).toBeGreaterThanOrEqual(2)

    // Verify change outputs are not identical (privacy feature)
    const changeValues = changeOutputs.map((output) => output.value)
    const uniqueValues = new Set(changeValues)
    expect(uniqueValues.size).toBe(changeValues.length) // All change values should be unique
  })

  // Test entropy calculation
  it('should calculate entropy correctly', () => {
    const mockSolution = {
      inputs: [
        {
          effectiveValue: 10000,
          keychain: 'external' as const,
          scriptType: 'p2wpkh' as const,
          txid: 'tx1',
          value: 10000,
          vout: 0
        },
        {
          effectiveValue: 20000,
          keychain: 'external' as const,
          scriptType: 'p2wpkh' as const,
          txid: 'tx2',
          value: 20000,
          vout: 0
        },
        {
          effectiveValue: 30000,
          keychain: 'external' as const,
          scriptType: 'p2wpkh' as const,
          txid: 'tx3',
          value: 30000,
          vout: 0
        },
        {
          effectiveValue: 40000,
          keychain: 'external' as const,
          scriptType: 'p2wpkh' as const,
          txid: 'tx4',
          value: 40000,
          vout: 0
        }
      ],
      outputs: [
        { recipient: true, size: 31, type: 'p2wpkh', value: 50000 },
        { size: 31, type: 'p2wpkh', value: 25000 },
        { size: 31, type: 'p2wpkh', value: 20000 }
      ]
    }

    const entropy = calculateStonewallEntropy(mockSolution)

    // Entropy should be a number between 0 and 100
    expect(entropy).toBeGreaterThan(0)
    expect(entropy).toBeLessThanOrEqual(100)
  })

  // Test change distribution function
  it('should distribute change with privacy in mind', () => {
    const totalChange = 100000
    const numOutputs = 3
    const dustThreshold = 546

    const changeValues = distributeChangeWithPrivacy(
      totalChange,
      numOutputs,
      dustThreshold
    )

    // Should create the requested number of outputs
    expect(changeValues).toHaveLength(numOutputs)

    // Total should match the input amount
    const sum = changeValues.reduce((acc, val) => acc + val, 0)
    expect(sum).toBe(totalChange)

    // All values should be above dust threshold
    expect(changeValues.every((val) => val >= dustThreshold)).toBe(true)

    // Values should be different (privacy feature)
    const uniqueValues = new Set(changeValues)
    expect(uniqueValues.size).toBe(changeValues.length)
  })

  // Test performance with large UTXO set
  it('should handle large UTXO sets efficiently', () => {
    // Create 100 UTXOs
    const values = Array.from({ length: 100 }, (_, i) => 10000 + i * 1000)
    const utxos = createMockUtxos(values, {
      scriptTypes: ['p2pkh', 'p2wpkh', 'p2sh-p2wpkh']
    })

    const targetAmount = 500000
    const feeRate = 2

    const startTime = Date.now()
    const result = selectStonewallUtxos(utxos, targetAmount, feeRate)
    const endTime = Date.now()

    // Should complete in a reasonable time (less than 2 seconds)
    expect(endTime - startTime).toBeLessThan(2000)
    expect(result.error).toBeUndefined()
    expect(result.inputs).toBeDefined()

    if (!result.inputs) {
      throw new Error('Expected inputs to be defined')
    }

    expect(result.inputs.length).toBeGreaterThan(0)
  })
})
