import { type Account } from '@/types/models/Account'
import { type ProcessedBitcoinContent } from '@/utils/bitcoinContent'
import { selectEfficientUtxos } from '@/utils/utxo'

export type TransactionBuilderActions = {
  clearTransaction: () => void
  addOutput: (output: { amount: number; label: string; to: string }) => void
  addInput: (input: any) => void
  setFeeRate: (rate: number) => void
}

export type NavigationActions = {
  navigate: (options: { pathname: string; params: any }) => void
}

export function autoSelectUtxos(
  account: Account,
  targetAmount: number,
  actions: Pick<TransactionBuilderActions, 'addInput' | 'setFeeRate'>
) {
  if (!account || account.utxos.length === 0) return

  const { addInput, setFeeRate } = actions

  // Set a default fee rate if not set
  if (setFeeRate && typeof setFeeRate === 'function') {
    setFeeRate(1) // Default to 1 sat/vbyte
  }

  // If no target amount, select the highest value UTXO
  if (targetAmount === 0 || targetAmount === 1) {
    const highestUtxo = account.utxos.reduce((max: any, utxo: any) =>
      utxo.value > max.value ? utxo : max
    )
    addInput(highestUtxo)
    return
  }

  // Use efficient UTXO selection for the target amount
  const result = selectEfficientUtxos(
    account.utxos,
    targetAmount,
    1, // Default fee rate of 1 sat/vbyte
    {
      dustThreshold: 546,
      inputSize: 148,
      changeOutputSize: 34
    }
  )

  if (result.error) {
    // Fallback: select the highest value UTXO
    const highestUtxo = account.utxos.reduce((max: any, utxo: any) =>
      utxo.value > max.value ? utxo : max
    )
    addInput(highestUtxo)
  } else {
    // TODO: finish implementation of efficient selection algorithm
    // Add all selected UTXOs as inputs
    result.inputs.forEach((utxo) => addInput(utxo))
  }
}

export function processBitcoinTransaction(
  processedContent: ProcessedBitcoinContent,
  account: Account,
  accountId: string,
  actions: TransactionBuilderActions & NavigationActions
) {
  const { clearTransaction, addOutput, navigate } = actions

  clearTransaction()

  if (processedContent.type === 'psbt') {
    navigate({
      pathname: '/account/[id]/signAndSend/signPSBT',
      params: { id: accountId, psbt: processedContent.content }
    })
    return
  }

  // Handle address or BIP21
  if (processedContent.address) {
    addOutput({
      amount: processedContent.amount || 1,
      label: processedContent.label || 'Please update',
      to: processedContent.address
    })

    // Auto-select UTXOs based on the target amount
    autoSelectUtxos(account, processedContent.amount || 1, actions)

    navigate({
      pathname: '/account/[id]/signAndSend/ioPreview',
      params: { id: accountId }
    })
  }
}
