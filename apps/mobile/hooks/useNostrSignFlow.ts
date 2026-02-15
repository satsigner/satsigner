import { PartiallySignedTransaction } from 'bdk-rn'
import {
  type TransactionDetails,
  type TxBuilderResult
} from 'bdk-rn/lib/classes/Bindings'
import * as bitcoinjs from 'bitcoinjs-lib'
import { useRouter } from 'expo-router'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { getKeyFingerprint } from '@/utils/account'
import { parseHexToBytes } from '@/utils/parse'
import {
  extractIndividualSignedPsbts,
  extractOriginalPsbt,
  extractTransactionDataFromPSBTEnhanced,
  extractTransactionIdFromPSBT,
  findDerivedPublicKey,
  findMatchingAccount,
  getCollectedSignerPubkeys,
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
    setTxBuilderResult,
    setSignedPsbts
  } = useTransactionBuilderStore()

  async function handleGoToSignFlow(transactionData: TransactionData) {
    const originalPsbt = extractOriginalPsbt(transactionData.combinedPsbt)

    const accountMatch = await findMatchingAccount(originalPsbt, accounts)

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

    const sent = outputs.reduce((acc, output) => acc + output.value, 0)
    const received = inputs.reduce((acc, input) => acc + (input.value || 0), 0)

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
    if (!extractedTxid) {
      toast.error(t('transaction.invalidPsbt'))
      return false
    }

    const derivedSignedPsbts = extractIndividualSignedPsbts(
      transactionData.combinedPsbt,
      originalPsbt
    )

    let finalSignedPsbts = derivedSignedPsbts
    if (accountMatch.account.policyType === 'multisig') {
      const remappedPsbts: Record<number, string> = {}
      const signerPubkeys = Array.from(
        getCollectedSignerPubkeys(transactionData.combinedPsbt)
      )

      const cosignerPubkeys = await Promise.all(
        accountMatch.account.keys.map(async (key) => {
          const secretFingerprint = await getKeyFingerprint(key)
          return findDerivedPublicKey(
            bitcoinjs.Psbt.fromBase64(originalPsbt),
            secretFingerprint
          )
        })
      )

      const pubkeyToCosignerIndexMap = new Map<string, number>()
      cosignerPubkeys.forEach((pubkey, index) => {
        if (pubkey) {
          pubkeyToCosignerIndexMap.set(pubkey, index)
        }
      })

      Object.entries(derivedSignedPsbts).forEach(([key, psbt]) => {
        const index = parseInt(key, 10)
        const signerPubkey = signerPubkeys[index]
        if (signerPubkey) {
          const cosignerIndex = pubkeyToCosignerIndexMap.get(signerPubkey)
          if (cosignerIndex !== undefined) {
            remappedPsbts[cosignerIndex] = psbt
          }
        }
      })
      finalSignedPsbts = remappedPsbts
    }

    const signedPsbtsMap = new Map<number, string>()
    Object.entries(finalSignedPsbts).forEach(([key, value]) => {
      signedPsbtsMap.set(parseInt(key, 10), value)
    })
    setSignedPsbts(signedPsbtsMap)

    const psbt = new PartiallySignedTransaction(originalPsbt)

    const txDetails: TransactionDetails = {
      txid: extractedTxid,
      fee,
      sent,
      received,
      confirmationTime: undefined,
      transaction: undefined
    }

    const txBuilderResult: TxBuilderResult = {
      psbt,
      txDetails
    }
    setTxBuilderResult(txBuilderResult)

    router.replace(
      `/signer/bitcoin/account/${accountMatch.account.id}/signAndSend/previewTransaction`
    )

    toast.success(
      t('transaction.openingInAccount', {
        accountName: accountMatch.account.name
      })
    )
    return true
  }

  return { handleGoToSignFlow }
}
