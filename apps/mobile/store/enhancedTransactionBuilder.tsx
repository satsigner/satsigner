import { TransactionDetails } from 'bdk-rn/lib/classes/Bindings'
import { create } from 'zustand'

import { useBlockchainStore } from '@/store/blockchain'
import { Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/utxo'

type Transaction = {
  inputs: Map<string, Utxo>
  outputs: Map<string, { type: string; value: number }>
}

type TransactionBuilderState = {
  currentTransaction: Transaction
  previousTransactions: Map<string, Transaction>
}

type TransactionBuilderAction = {
  clearCurrentTransaction: () => void
  clearPreviousTransactions: () => void
  addInputToCurrent: (utxo: Utxo) => void
  removeInputFromCurrent: (utxo: Utxo) => void
  addOutputToCurrent: (type: string, value: number) => void
  removeOutputFromCurrent: (type: string) => void
  getCurrentInputs: () => Utxo[]
  getCurrentOutputs: () => { type: string; value: number }[]
  hasCurrentInput: (utxo: Utxo) => boolean
  getCurrentInputDetails: () => (TransactionDetails | undefined)[]
  getCurrentTransactionFlow: () => Promise<{
    inputs: Utxo[]
    outputs: { type: string; value: number }[]
    totalValue: number
    vSize: number
  }>
  saveCurrentTransaction: () => void
  getPreviousTransactionFlow: (transactionId: string) =>
    | {
        inputs: Utxo[]
        outputs: { type: string; value: number }[]
        totalValue: number
        vSize: number
      }
    | undefined
  getAllTransactionFlows: () => Promise<{
    current: {
      inputs: Utxo[]
      outputs: { type: string; value: number }[]
      totalValue: number
      vSize: number
    }
    previous: {
      [transactionId: string]: {
        inputs: Utxo[]
        outputs: { type: string; value: number }[]
        totalValue: number
        vSize: number
      }
    }
  }>
}

const useEnhancedTransactionBuilderStore = create<
  TransactionBuilderState & TransactionBuilderAction
>()((set, get) => ({
  currentTransaction: {
    inputs: new Map(),
    outputs: new Map()
  },
  previousTransactions: new Map(),

  clearCurrentTransaction: () => {
    set({
      currentTransaction: {
        inputs: new Map(),
        outputs: new Map()
      }
    })
  },

  clearPreviousTransactions: () => {
    set({ previousTransactions: new Map() })
  },

  addInputToCurrent: (utxo: Utxo) => {
    set((state) => {
      const newInputs = new Map(state.currentTransaction.inputs)
      newInputs.set(getUtxoOutpoint(utxo), utxo)
      return {
        currentTransaction: {
          ...state.currentTransaction,
          inputs: newInputs
        }
      }
    })
  },

  removeInputFromCurrent: (utxo: Utxo) => {
    set((state) => {
      const newInputs = new Map(state.currentTransaction.inputs)
      newInputs.delete(getUtxoOutpoint(utxo))
      return {
        currentTransaction: {
          ...state.currentTransaction,
          inputs: newInputs
        }
      }
    })
  },

  addOutputToCurrent: (type: string, value: number) => {
    set((state) => {
      const newOutputs = new Map(state.currentTransaction.outputs)
      newOutputs.set(type, { type, value })
      return {
        currentTransaction: {
          ...state.currentTransaction,
          outputs: newOutputs
        }
      }
    })
  },

  removeOutputFromCurrent: (type: string) => {
    set((state) => {
      const newOutputs = new Map(state.currentTransaction.outputs)
      newOutputs.delete(type)
      return {
        currentTransaction: {
          ...state.currentTransaction,
          outputs: newOutputs
        }
      }
    })
  },

  getCurrentInputs: () => {
    return Array.from(get().currentTransaction.inputs.values())
  },

  getCurrentOutputs: () => {
    return Array.from(get().currentTransaction.outputs.values())
  },

  hasCurrentInput: (utxo: Utxo) => {
    return get().currentTransaction.inputs.has(getUtxoOutpoint(utxo))
  },

  getCurrentInputDetails: () => {
    return Array.from(get().currentTransaction.inputs.values()).map(
      (utxo) => utxo.txDetails
    )
  },

  getCurrentTransactionFlow: async () => {
    const inputs = get().getCurrentInputs()
    const outputs = get().getCurrentOutputs()
    const totalValue = inputs.reduce((sum, utxo) => sum + utxo.value, 0)
    const { getEstimatedFee } = useBlockchainStore.getState()
    const estimatedFee = await getEstimatedFee(6)

    // Add fee output if it doesn't exist
    if (!get().currentTransaction.outputs.has('fee')) {
      get().addOutputToCurrent('fee', estimatedFee)
    }

    // Always include change output
    const feeOutput = get().currentTransaction.outputs.get('fee')
    const feeValue = feeOutput ? feeOutput.value : 0
    const changeValue = totalValue - feeValue

    if (changeValue > 0) {
      get().addOutputToCurrent('change', changeValue)
    } else {
      // If change is 0 or negative, add a minimal dust output
      get().addOutputToCurrent('change', 0)
    }

    // Calculate total input value
    const totalInputValue = inputs.reduce((sum, input) => sum + input.value, 0)

    // Calculate total output value (excluding fee)
    const totalOutputValue = outputs
      .filter((output) => output.type !== 'fee')
      .reduce((sum, output) => sum + output.value, 0)

    // Calculate fee
    const fee = totalInputValue - totalOutputValue

    // Estimate transaction size (simplified estimation)
    const inputSize = inputs.length * 148 // Assuming P2PKH inputs
    const outputSize = outputs.length * 34 // Assuming P2PKH outputs
    const estimatedSize = inputSize + outputSize + 10 // 10 bytes for version, locktime, etc.

    // Calculate vsize (assuming non-segwit transaction for simplicity)
    const vSize = estimatedSize

    // Update fee output
    get().addOutputToCurrent('fee', fee)

    return {
      inputs,
      outputs,
      totalValue,
      vSize
    }
  },

  saveCurrentTransaction: () => {
    set((state) => {
      const newPreviousTransactions = new Map(state.previousTransactions)
      const transactionId = Date.now().toString()
      newPreviousTransactions.set(transactionId, state.currentTransaction)

      // Keep only the last 5 transactions
      if (newPreviousTransactions.size > 5) {
        const oldestKey = Array.from(newPreviousTransactions.keys())[0]
        newPreviousTransactions.delete(oldestKey)
      }

      return {
        previousTransactions: newPreviousTransactions,
        currentTransaction: {
          inputs: new Map(),
          outputs: new Map()
        }
      }
    })
  },

  getPreviousTransactionFlow: (transactionId: string) => {
    const transaction = get().previousTransactions.get(transactionId)
    if (!transaction) return undefined

    const inputs = Array.from(transaction.inputs.values())
    const outputs = Array.from(transaction.outputs.values())
    const totalValue = inputs.reduce((sum, utxo) => sum + utxo.value, 0)

    // Simplified vSize calculation
    const vSize = inputs.length * 148 + outputs.length * 34 + 10
    return {
      inputs,
      outputs,
      totalValue,
      vSize,
      txId: transactionId
    }
  },

  getAllTransactionFlows: async () => {
    const currentFlow = await get().getCurrentTransactionFlow()
    const previousFlows: {
      [transactionId: string]: {
        inputs: Utxo[]
        outputs: { type: string; value: number }[]
        totalValue: number
        vSize: number
      }
    } = {}

    for (const [transactionId, transaction] of get().previousTransactions) {
      const flow = get().getPreviousTransactionFlow(transactionId)
      if (flow) {
        previousFlows[transactionId] = flow
      }
    }

    return {
      current: currentFlow,
      previous: previousFlows
    }
  }
}))

export { useEnhancedTransactionBuilderStore }
