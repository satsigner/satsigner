import { type PsbtLike } from 'react-native-bdk-sdk'
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
    setPsbt,
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

    for (const input of inputs) {
      addInput({
        ...input,
        keychain: input.keychain || 'external',
        script: parseHexToBytes(input.script)
      })
    }

    for (const output of outputs) {
      addOutput({
        amount: output.value,
        label: output.label || '',
        to: output.address
      })
    }

    if (fee) {
      setFee(fee)
    }

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
      for (const [index, pubkey] of cosignerPubkeys.entries()) {
        if (pubkey) {
          pubkeyToCosignerIndexMap.set(pubkey, index)
        }
      }

      for (const [key, psbt] of Object.entries(derivedSignedPsbts)) {
        const index = parseInt(key, 10)
        const signerPubkey = signerPubkeys[index]
        if (signerPubkey) {
          const cosignerIndex = pubkeyToCosignerIndexMap.get(signerPubkey)
          if (cosignerIndex !== undefined) {
            remappedPsbts[cosignerIndex] = psbt
          }
        }
      }
      finalSignedPsbts = remappedPsbts
    }

    const signedPsbtsMap = new Map<number, string>()
    for (const [key, value] of Object.entries(finalSignedPsbts)) {
      signedPsbtsMap.set(parseInt(key, 10), value)
    }
    setSignedPsbts(signedPsbtsMap)

    const mockPsbt = {
      extractTxHex: () => '',
      feeAmount: () => fee,
      toBase64: () => originalPsbt,
      txid: () => extractedTxid
    } as unknown as PsbtLike
    setPsbt(mockPsbt)

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
