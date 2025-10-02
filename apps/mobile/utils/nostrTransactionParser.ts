import { toast } from 'sonner-native'

import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import {
  findMatchingAccount,
  type TransactionData
} from '@/utils/psbtAccountMatcher'

/**
 * Parse Nostr message for transaction data and handle sign flow navigation
 */
export function parseNostrTransactionMessage(message: string): boolean {
  try {
    // Check if message contains transaction data
    if (
      !message.includes('Transaction Data:') ||
      !message.includes('multisig_transaction')
    ) {
      return false
    }

    // Extract JSON data from message
    const jsonMatch = message.match(
      /Transaction Data:\s*\n([\s\S]*?)(?:\n\n|$)/
    )
    if (!jsonMatch) {
      return false
    }

    const jsonData = jsonMatch[1].trim()
    const transactionData: TransactionData = JSON.parse(jsonData)

    // Extract the actual transaction ID from the message header
    const txidMatch = message.match(/Transaction ID:\s*([a-fA-F0-9]+)/)
    if (txidMatch) {
      transactionData.txid = txidMatch[1]
    }

    // Validate transaction data structure
    if (!isValidTransactionData(transactionData)) {
      toast.error(t('transaction.dataParseFailed'))
      return false
    }

    // Store transaction data in Zustand store
    useTransactionBuilderStore
      .getState()
      .setNostrTransactionData(transactionData)

    // Show success message
    toast.success(t('transaction.received'))

    return true
  } catch {
    toast.error(t('transaction.dataParseFailed'))
    return false
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

    // Find matching account using PSBT fingerprints
    const accountMatch = findMatchingAccount(
      transactionData.originalPsbt,
      accounts
    )

    if (!accountMatch) {
      toast.error(t('transaction.dataNotFound'))
      return false
    }

    // Store transaction data in Zustand store for previewMessage to access
    useTransactionBuilderStore
      .getState()
      .setNostrTransactionData(transactionData)

    // Navigate to the preview page using replace to avoid stacking the same screen
    const navigationPath = `/account/${accountMatch.account.id}/signAndSend/previewMessage`
    router.replace(navigationPath)

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
  // For Nostr messages, we only need basic validation
  // Full validation happens when we extract the complete transaction data
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

/**
 * Check if a message contains a "Go to Sign Flow" button
 */
export function hasSignFlowButton(message: string): boolean {
  return (
    message.includes('[Go to Sign Flow]') || message.includes('Go to Sign Flow')
  )
}

/**
 * Extract transaction ID from Nostr message
 */
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
