import { useRouter } from 'expo-router'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { parseHexToBytes } from '@/utils/parse'
import {
  extractIndividualSignedPsbts,
  extractOriginalPsbt,
  extractTransactionDataFromPSBTEnhanced,
  extractTransactionIdFromPSBT,
  findMatchingAccount,
  type TransactionData
} from '@/utils/psbt'

export function useNostrSignFlow() {
  const router = useRouter()
  const accounts = useAccountsStore((state) => state.accounts)
  const {
    clearTransaction,
    addInput,
    addOutput,
    setFee,
    setRbf,
    setTxBuilderResult
  } = useTransactionBuilderStore()

  function handleGoToSignFlow(transactionData: TransactionData): boolean {
    try {
      const originalPsbt = extractOriginalPsbt(transactionData.combinedPsbt)

      const accountMatch = findMatchingAccount(originalPsbt, accounts)

      if (!accountMatch) {
        toast.error(t('transaction.dataNotFound'))
        return false
      }

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
      } as any)

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

  return { handleGoToSignFlow }
}
