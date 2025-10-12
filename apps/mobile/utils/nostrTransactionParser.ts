import { toast } from 'sonner-native'

import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import {
  findMatchingAccount,
  type TransactionData
} from '@/utils/psbtAccountMatcher'
import {
  extractIndividualSignedPsbts,
  extractOriginalPsbt,
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
    if (message.trim().startsWith('cHNidP')) {
      const transactionData: TransactionData = {
        combinedPsbt: message.trim()
      }
      return transactionData
    }
    return null
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
    const originalPsbt = extractOriginalPsbt(transactionData.combinedPsbt)

    const accountMatch = findMatchingAccount(originalPsbt, accounts)

    if (!accountMatch) {
      toast.error(t('transaction.dataNotFound'))
      return false
    }

    const {
      clearTransaction,
      addInput,
      addOutput,
      setFee,
      setRbf,
      setTxBuilderResult
    } = useTransactionBuilderStore.getState()

    clearTransaction()

    let extractedData = null
    if (originalPsbt && accountMatch.account) {
      try {
        extractedData = extractTransactionDataFromPSBTEnhanced(
          originalPsbt,
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

    setRbf(true)

    const extractedTxid = extractTransactionIdFromPSBT(originalPsbt)

    const derivedSignedPsbts = extractIndividualSignedPsbts(
      transactionData.combinedPsbt,
      originalPsbt
    )

    const mockTxBuilderResult = {
      psbt: {
        base64: originalPsbt,
        serialize: () => Promise.resolve(originalPsbt),
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
      params: { signedPsbts: JSON.stringify(derivedSignedPsbts) }
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
