import { SATS_PER_BITCOIN } from '@/constants/btc'
import { type Account } from '@/types/models/Account'
import {
  processBitcoinContent,
  type ProcessedBitcoinContent
} from '@/utils/bitcoinContent'
import { processBitcoinTransaction } from '@/utils/transactionProcessor'

export function processBitcoinContentDirect(
  text: string,
  account: Account,
  accountId: string,
  actions: {
    clearTransaction: () => void
    addOutput: (output: { amount: number; label: string; to: string }) => void
    addInput: (input: any) => void
    setFeeRate: (rate: number) => void
    navigate: (options: { pathname: string; params: any }) => void
  }
) {
  const processedContent = processBitcoinContent(text)
  if (!processedContent) return false

  processBitcoinTransaction(processedContent, account, accountId, actions)
  return true
}

export function processBitcoinContentForOutput(
  text: string,
  actions: {
    setOutputTo: (address: string) => void
    setOutputAmount: (amount: number) => void
    setOutputLabel: (label: string) => void
    onError: (message: string) => void
    onWarning: (message: string) => void
    remainingSats?: number
  }
): boolean {
  const processedContent = processBitcoinContent(text)
  if (!processedContent) {
    actions.onError('Invalid Bitcoin content')
    return false
  }

  if (processedContent.type === 'psbt') {
    actions.onError('PSBTs cannot be used for individual outputs')
    return false
  }

  if (processedContent.address) {
    actions.setOutputTo(processedContent.address)

    if (processedContent.amount && processedContent.amount > 1) {
      if (
        actions.remainingSats &&
        processedContent.amount > actions.remainingSats
      ) {
        actions.onWarning('Insufficient funds for the specified amount')
      } else {
        actions.setOutputAmount(processedContent.amount)
      }
    }

    if (processedContent.label) {
      actions.setOutputLabel(processedContent.label)
    }

    return true
  }

  actions.onError('No valid address found in content')
  return false
}
