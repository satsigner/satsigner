import { toast } from 'sonner-native'

import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import {
  findMatchingAccount,
  type TransactionData
} from '@/utils/psbtAccountMatcher'
import { parseHexToBytes } from './parse'

/**
 * Parse Nostr message for transaction data and handle sign flow navigation
 */
export function parseNostrTransactionMessage(
  message: string
): TransactionData | null {
  try {
    if (
      !message.includes('Transaction Data:') ||
      !message.includes('multisig_transaction')
    ) {
      return null
    }

    const jsonMatch = message.match(
      /Transaction Data:\s*\n([\s\S]*?)(?:\n\n|$)/
    )
    if (!jsonMatch) {
      return null
    }

    const jsonData = jsonMatch[1].trim()
    const transactionData: TransactionData = JSON.parse(jsonData)

    const txidMatch = message.match(/Transaction ID:\s*([a-fA-F0-9]+)/)
    if (txidMatch) {
      transactionData.txid = txidMatch[1]
    }

    if (!isValidTransactionData(transactionData)) {
      toast.error(t('transaction.dataParseFailed'))
      return null
    }

    return transactionData
  } catch {
    toast.error(t('transaction.dataParseFailed'))
    return null
  }
}

/**
 * Handle "Go to Sign Flow" button click
 */
export function handleGoToSignFlow(
  transactionData: TransactionData,
  router: any
): boolean {
  try {
    const accounts = useAccountsStore.getState().accounts

    const accountMatch = findMatchingAccount(
      transactionData.originalPsbt,
      accounts
    )

    if (!accountMatch) {
      toast.error(t('transaction.dataNotFound'))
      return false
    }

    // Store transaction data in Zustand store for previewMessage to access
    const {
      clearTransaction,
      addInput,
      addOutput,
      setFee,
      setTxBuilderResult
    } = useTransactionBuilderStore.getState()

    clearTransaction()

    transactionData.inputs?.forEach((input) => {
      addInput({
        ...input,
        script: parseHexToBytes(input.script),
        keychain: input.keychain || 'external'
      })
    })

    transactionData.outputs?.forEach((output) => {
      addOutput({
        to: output.address,
        amount: output.value,
        label: output.label || ''
      })
    })

    if (transactionData.fee) setFee(transactionData.fee)

    const mockTxBuilderResult = {
      psbt: {
        base64: transactionData.originalPsbt,
        serialize: () => Promise.resolve(transactionData.originalPsbt),
        txid: () => Promise.resolve(transactionData.txid)
      },
      txDetails: {
        txid: transactionData.txid,
        fee: transactionData.fee
      }
    }
    setTxBuilderResult(mockTxBuilderResult as any)

    const navigationPath = `/account/${accountMatch.account.id}/signAndSend/previewMessage`
    router.replace({
      pathname: navigationPath,
      params: { signedPsbts: JSON.stringify(transactionData.signedPsbts) }
    })

    toast.success(
      t('transaction.openingInAccount', {
        accountName: accountMatch.account.name
      })
    )
    return true
  } catch {
    toast.error(t('transaction.openSignFlowFailed'))
    return false
  }
}

/**
 * Validate transaction data structure
 */
function isValidTransactionData(data: any): data is TransactionData {
  return (
    data &&
    typeof data === 'object' &&
    data.type === 'multisig_transaction' &&
    typeof data.txid === 'string' &&
    typeof data.network === 'string' &&
    typeof data.keyCount === 'number' &&
    typeof data.keysRequired === 'number' &&
    typeof data.originalPsbt === 'string' &&
    typeof data.signedPsbts === 'object' &&
    typeof data.timestamp === 'number'
  )
}

export function hasSignFlowButton(message: string): boolean {
  return (
    message.includes('[Go to Sign Flow]') || message.includes('Go to Sign Flow')
  )
}

export function extractTransactionIdFromMessage(
  message: string
): string | null {
  try {
    const txidMatch = message.match(/Transaction ID:\s*([a-fA-F0-9]+)/)
    return txidMatch ? txidMatch[1] : null
  } catch {
    return null
  }
}
