import { toast } from 'sonner-native'

import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import {
  findMatchingAccount,
  type TransactionData
} from '@/utils/psbtAccountMatcher'
import {
  extractTransactionDataFromPSBTEnhanced,
  extractTransactionIdFromPSBT
} from '@/utils/psbtTransactionExtractor'

import { parseHexToBytes } from './parse'

/**
 * Parse Nostr message for transaction data and handle sign flow navigation
 */
export function parseNostrTransactionMessage(
  message: string
): TransactionData | null {
  try {
    if (!message.includes('Transaction Data (PSBT-based):')) {
      return null
    }

    const jsonStartIndex = message.indexOf('{')
    const jsonEndIndex = message.lastIndexOf('}')

    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      return null
    }

    const jsonData = message.substring(jsonStartIndex, jsonEndIndex + 1).trim()
    const transactionData: TransactionData = JSON.parse(jsonData)

    if (!isValidTransactionData(transactionData)) {
      return null
    }

    return transactionData
  } catch {
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

    // Try to extract transaction data from PSBT first for more accurate data
    let extractedData = null
    if (transactionData.originalPsbt && accountMatch.account) {
      try {
        extractedData = extractTransactionDataFromPSBTEnhanced(
          transactionData.originalPsbt,
          accountMatch.account
        )
      } catch {
        extractedData = null
      }
    }

    const inputs = extractedData?.inputs || []
    const outputs = extractedData?.outputs || []
    const fee = extractedData?.fee || 0

    inputs.forEach((input) => {
      addInput({
        ...input,
        script: parseHexToBytes(input.script),
        keychain: input.keychain || 'external'
      })
    })

    outputs.forEach((output) => {
      addOutput({
        to: output.address,
        amount: output.value,
        label: output.label || ''
      })
    })

    if (fee) setFee(fee)

    // Extract transaction ID from PSBT
    const extractedTxid = extractTransactionIdFromPSBT(
      transactionData.originalPsbt
    )

    const mockTxBuilderResult = {
      psbt: {
        base64: transactionData.originalPsbt,
        serialize: () => Promise.resolve(transactionData.originalPsbt),
        txid: () => Promise.resolve(extractedTxid)
      },
      txDetails: {
        txid: extractedTxid,
        fee
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
    typeof data.originalPsbt === 'string' &&
    typeof data.signedPsbts === 'object' &&
    typeof data.keyCount === 'number' &&
    typeof data.keysRequired === 'number'
  )
}

export function hasSignFlowButton(message: string): boolean {
  return (
    message.includes('Go to Sign Flow') ||
    message.includes('Transaction Data (PSBT-based):')
  )
}
