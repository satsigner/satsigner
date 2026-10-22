import { useEffect, useEffectEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { WATCH_ONLY_COSIGNER_INDEX } from '@/constants/account'
import { usePSBTManagement } from '@/hooks/usePSBTManagement'
import { findSignedPsbtsPerCosignerInPsbt } from '@/services/cosignerSignatures'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account, type Key } from '@/types/models/Account'
import { type Notice } from '@/types/ui/notice'
import {
  bindImportedSignature,
  combineAndFinalizePsbts,
  combineSignaturesForSharing,
  getCollectedSignedPsbts,
  hasAllRequiredSignatures,
  validateCosignerSignatures
} from '@/utils/psbt'

type SignedPsbts = Map<number, string>

type UseCosignerSignaturesParams = {
  account: Account | undefined
  decryptedKeys: Key[]
  importedPsbtBase64: string | undefined
  onNotice: (notice: Notice) => void
}

type UseImportedPsbtSignatureDetectionParams = {
  account: Account | undefined
  decryptedKeys: Key[]
  importedPsbtBase64: string | undefined
  signedPsbts: SignedPsbts
  updateSignedPsbt: (cosignerIndex: number, signedPsbt: string) => void
  onSignatureDetected: (cosignerIndex: number) => void
}

type UseCosignerSignatureValidationParams = {
  account: Account | undefined
  decryptedKeys: Key[]
  signedPsbts: SignedPsbts
  onCosignerValidationFailed: () => void
}

export function useCosignerSignatures({
  account,
  decryptedKeys,
  importedPsbtBase64,
  onNotice
}: UseCosignerSignaturesParams) {
  const [txBuilderResult, setSignedTx, signedPsbtsFromStore] =
    useTransactionBuilderStore(
      useShallow((state) => [state.psbt, state.setSignedTx, state.signedPsbts])
    )

  const {
    signedPsbt,
    signedPsbts,
    setSignedPsbts,
    updateSignedPsbt,
    convertPsbtToFinalTransaction,
    handleSignWithLocalKey,
    handleSignWithSeedQR
  } = usePSBTManagement({
    account,
    decryptedKeys,
    psbt: txBuilderResult
  })

  const validationResults = useCosignerSignatureValidation({
    account,
    decryptedKeys,
    onCosignerValidationFailed: () =>
      onNotice({
        key: 'common.error.validatingCosignerSignature',
        type: 'error'
      }),
    signedPsbts
  })

  useImportedPsbtSignatureDetection({
    account,
    decryptedKeys,
    importedPsbtBase64,
    onSignatureDetected: (cosignerIndex) =>
      onNotice({
        key: 'transaction.build.preview.detectedSignature',
        params: { cosigner: cosignerIndex + 1 },
        type: 'success'
      }),
    signedPsbts,
    updateSignedPsbt
  })

  useEffect(() => {
    if (signedPsbtsFromStore && signedPsbtsFromStore.size > 0) {
      setSignedPsbts(signedPsbtsFromStore)
    }
  }, [signedPsbtsFromStore, setSignedPsbts])

  useEffect(() => {
    if (signedPsbt) {
      setSignedTx(signedPsbt)
    }
  }, [signedPsbt, setSignedTx])

  function importSignedDataMatchingPsbt(cosignerIndex: number, data: string) {
    const result = bindImportedSignature(
      data,
      txBuilderResult?.toBase64(),
      cosignerIndex === WATCH_ONLY_COSIGNER_INDEX,
      convertPsbtToFinalTransaction
    )
    if ('errorKey' in result) {
      onNotice({ key: result.errorKey, type: 'error' })
      return false
    }
    updateSignedPsbt(cosignerIndex, result.boundData)
    return true
  }

  function combineCollectedSignaturesForSharing() {
    const result = combineSignaturesForSharing(
      txBuilderResult?.toBase64(),
      signedPsbts
    )
    if ('errorKey' in result) {
      onNotice({ key: result.errorKey, type: 'error' })
      return null
    }
    return result.psbtBase64
  }

  function combineAndFinalizeSignatures() {
    const result = combineAndFinalizePsbts(txBuilderResult?.toBase64(), [
      ...getCollectedSignedPsbts(signedPsbts).values()
    ])
    if ('errorKey' in result) {
      onNotice({
        key: result.errorKey,
        params: result.errorParams,
        type: 'error'
      })
      return null
    }
    setSignedTx(result.hex)
    onNotice({ key: 'transaction.finalizedSuccessfully', type: 'success' })
    return result.hex
  }

  return {
    combineAndFinalizeSignatures,
    combineCollectedSignaturesForSharing,
    hasAllRequiredSignatures: hasAllRequiredSignatures(
      account,
      validationResults
    ),
    importSignedDataMatchingPsbt,
    signWithLocalKey: handleSignWithLocalKey,
    signWithMnemonic: handleSignWithSeedQR,
    signedPsbt,
    signedPsbts,
    validationResults
  }
}

function useCosignerSignatureValidation({
  account,
  decryptedKeys,
  signedPsbts,
  onCosignerValidationFailed
}: UseCosignerSignatureValidationParams) {
  const validation = validateCosignerSignatures(
    signedPsbts,
    account,
    decryptedKeys
  )

  const reportEachFailedCosigner = useEffectEvent(() => {
    for (const _cosignerIndex of validation.failedCosigners) {
      onCosignerValidationFailed()
    }
  })

  useEffect(() => {
    reportEachFailedCosigner()
  }, [signedPsbts, account, decryptedKeys])

  return validation.results
}

function useImportedPsbtSignatureDetection({
  account,
  decryptedKeys,
  importedPsbtBase64,
  signedPsbts,
  updateSignedPsbt,
  onSignatureDetected
}: UseImportedPsbtSignatureDetectionParams) {
  const reportSignatureDetected = useEffectEvent(onSignatureDetected)

  useEffect(() => {
    const areKeysReady = !!account?.keys && decryptedKeys.length > 0
    if (!importedPsbtBase64 || !account || !areKeysReady) {
      return
    }

    const detectionRun = { isOutdated: false }

    async function storeDetectedSignatures(
      currentAccount: Account,
      psbtBase64: string
    ) {
      const signedPsbtsPerCosigner = await findSignedPsbtsPerCosignerInPsbt({
        account: currentAccount,
        decryptedKeys,
        existingSignedPsbts: signedPsbts,
        partiallySignedPsbtBase64: psbtBase64
      })
      if (detectionRun.isOutdated) {
        return
      }
      for (const [cosignerIndex, signedPsbtBase64] of signedPsbtsPerCosigner) {
        updateSignedPsbt(cosignerIndex, signedPsbtBase64)
        reportSignatureDetected(cosignerIndex)
      }
    }

    void storeDetectedSignatures(account, importedPsbtBase64)
    return () => {
      detectionRun.isOutdated = true
    }
  }, [
    importedPsbtBase64,
    account,
    decryptedKeys,
    updateSignedPsbt,
    signedPsbts
  ])
}
