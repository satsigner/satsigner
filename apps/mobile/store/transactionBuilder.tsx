import { TransactionDetails } from 'bdk-rn/lib/classes/Bindings'
import { create } from 'zustand'

import { useBlockchainStore } from '@/store/blockchain'
import { Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/utxo'

type TransactionBuilderState = {
  inputs: Map<string, Utxo>
  outputs: Map<string, { type: string; value: number }>
}

type TransactionBuilderAction = {
  clearTransaction: () => void
  getInputs: () => Utxo[]
  getOutputs: () => { type: string; value: number }[]
  hasInput: (utxo: Utxo) => boolean
  addInput: (utxo: Utxo) => void
  removeInput: (utxo: Utxo) => void
  addOutput: (type: string, value: number) => void
  removeOutput: (type: string) => void
  getInputDetails: () => (TransactionDetails | undefined)[]
  getTransactionFlow: () => Promise<{
    inputs: Utxo[]
    outputs: { type: string; value: number }[]
    totalValue: number
    vSize: number
  }>
}

const useTransactionBuilderStore = create<
  TransactionBuilderState & TransactionBuilderAction
>()((set, get) => ({
  inputs: new Map<string, Utxo>(),
  outputs: new Map<string, { type: string; value: number }>(),
  clearTransaction: () => {
    set({
      inputs: new Map<string, Utxo>(),
      outputs: new Map<string, { type: string; value: number }>()
    })
  },
  getInputs: () => {
    return Array.from(get().inputs.values())
  },
  getOutputs: () => {
    return Array.from(get().outputs.values())
  },
  getInputDetails: () => {
    return Array.from(get().inputs.values()).map((utxo) => utxo.txDetails)
  },
  hasInput: (utxo) => {
    return get().inputs.has(getUtxoOutpoint(utxo))
  },
  addInput: (utxo) => {
    const newInputs = new Map(get().inputs)
    const key = getUtxoOutpoint(utxo)
    newInputs.set(key, utxo)
    set({ inputs: newInputs })
  },
  removeInput: (utxo) => {
    const newInputs = new Map(get().inputs)
    const key = getUtxoOutpoint(utxo)
    newInputs.delete(key)
    set({ inputs: newInputs })
  },
  addOutput: (type, value) => {
    const newOutputs = new Map(get().outputs)
    newOutputs.set(type, { type, value })
    set({ outputs: newOutputs })
  },
  removeOutput: (type) => {
    const newOutputs = new Map(get().outputs)
    newOutputs.delete(type)
    set({ outputs: newOutputs })
  },
  getTransactionFlow: async () => {
    const inputs = Array.from(get().inputs.values())
    const totalValue = inputs.reduce((sum, utxo) => sum + utxo.value, 0)
    const { getEstimatedFee } = useBlockchainStore.getState()
    const estimatedFee = await getEstimatedFee(6)

    // Initialize outputs if it's undefined
    if (!get().outputs) {
      set({ outputs: new Map() })
    }

    // Add fee output if it doesn't exist
    if (!get().outputs.has('fee')) {
      get().addOutput('fee', estimatedFee)
    }

    // Always include change output
    const feeOutput = get().outputs.get('fee')
    const feeValue = feeOutput ? feeOutput.value : 0
    const changeValue = totalValue - feeValue

    if (changeValue > 0) {
      get().addOutput('change', changeValue)
    } else {
      // If change is 0 or negative, add a minimal dust output
      get().addOutput('change', 0) // 546 satoshis is typically considered dust
    }

    // Calculate total input value
    const totalInputValue = inputs.reduce((sum, input) => sum + input.value, 0)

    // Calculate total output value (excluding fee)
    const totalOutputValue = Array.from(get().outputs.values())
      .filter((output) => output.type !== 'fee')
      .reduce((sum, output) => sum + output.value, 0)

    // Calculate fee
    const fee = totalInputValue - totalOutputValue

    // Estimate transaction size (simplified estimation)
    const inputSize = inputs.length * 148 // Assuming P2PKH inputs
    const outputSize = get().outputs.size * 34 // Assuming P2PKH outputs
    const estimatedSize = inputSize + outputSize + 10 // 10 bytes for version, locktime, etc.

    // Calculate vsize (assuming non-segwit transaction for simplicity)
    const vSize = estimatedSize

    // Update fee output
    get().addOutput('fee', fee)

    return {
      inputs,
      outputs: Array.from(get().outputs.values()),
      totalValue,
      vSize
    }
  }
}))

export { useTransactionBuilderStore }
