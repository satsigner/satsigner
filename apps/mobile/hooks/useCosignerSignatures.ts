import { useEffect, useEffectEvent, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { WATCH_ONLY_INDEX } from '@/constants/account'
import { usePSBTManagement } from '@/hooks/usePSBTManagement'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account, type Key } from '@/types/models/Account'
import { type Notice } from '@/types/ui/notice'
import { getKeyFingerprint } from '@/utils/account'
import {
  bindImportedSignature,
  buildPubkeyToCosignerIndex,
  combineAndFinalizePsbts,
  combinePsbts,
  extractIndividualSignedPsbts,
  getCollectedSignedPsbts,
  getCollectedSignerPubkeys,
  hasAllRequiredSignatures,
  matchSignedPsbtsToCosigners,
  readPartiallySignedPsbt,
  validateSignedPSBTForCosigner
} from '@/utils/psbt'

type UseCosignerSignaturesParams = {
  account: Account | undefined
  decryptedKeys: Key[]
  /** A PSBT (base64) under review that may already carry signatures. */
  routePsbt: string | undefined
  onNotice: (notice: Notice) => void
}

type SignedPsbts = Map<number, string>

type UseSignatureDetectionParams = {
  account: Account | undefined
  decryptedKeys: Key[]
  routePsbt: string | undefined
  signedPsbts: SignedPsbts
  updateSignedPsbt: (cosignerIndex: number, signedPsbt: string) => void
  onDetected: (cosignerIndex: number) => void
}

type UseSignatureValidationParams = {
  account: Account | undefined
  decryptedKeys: Key[]
  signedPsbts: SignedPsbts
  onValidationError: () => void
}

/**
 * Collects the cosigner signatures of the PSBT under review (multisig and
 * watch-only): signs with local keys or a mnemonic, imports signed data bound
 * to the PSBT, detects signatures already in `routePsbt`, validates each
 * cosigner and finalizes once enough signatures are collected.
 */
export function useCosignerSignatures({
  account,
  decryptedKeys,
  routePsbt,
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

  const validationResults = useSignatureValidation({
    account,
    decryptedKeys,
    onValidationError: () =>
      onNotice({
        key: 'common.error.validatingCosignerSignature',
        type: 'error'
      }),
    signedPsbts
  })

  useSignatureDetection({
    account,
    decryptedKeys,
    onDetected: (cosignerIndex) =>
      onNotice({
        key: 'transaction.build.preview.detectedSignature',
        params: { cosigner: cosignerIndex + 1 },
        type: 'success'
      }),
    routePsbt,
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

  // Binds scanned/pasted data to the transaction under review. Returns null
  // (after reporting an error) when it does not match: broadcasting it would
  // execute a different transaction than the one displayed to the user.
  function bindToPsbt(cosignerIndex: number, data: string) {
    const originalPsbtBase64 = txBuilderResult?.toBase64()
    try {
      const boundData = bindImportedSignature(
        data,
        originalPsbtBase64,
        cosignerIndex === WATCH_ONLY_INDEX,
        convertPsbtToFinalTransaction
      )
      if (boundData === null) {
        onNotice({
          key: originalPsbtBase64
            ? 'common.error.transactionMismatch'
            : 'common.error.noOriginalPSBT',
          type: 'error'
        })
      }
      return boundData
    } catch {
      onNotice({ key: 'common.error.processScannedData', type: 'error' })
      return null
    }
  }

  // Stores scanned/pasted data as a cosigner's signature (or the watch-only
  // import) once it is bound to the PSBT under review. False when rejected.
  function importSignedData(cosignerIndex: number, data: string) {
    const boundData = bindToPsbt(cosignerIndex, data)
    if (boundData === null) {
      return false
    }
    updateSignedPsbt(cosignerIndex, boundData)
    return true
  }

  // The PSBT under review combined with every signature collected so far (to
  // share with other cosigners), or null after reporting why it could not be.
  function combineCollectedSignatures() {
    const originalPsbtBase64 = txBuilderResult?.toBase64()
    if (!originalPsbtBase64) {
      onNotice({
        key: 'account.nostrSync.transactionDataNotAvailable',
        type: 'error'
      })
      return null
    }
    try {
      return combinePsbts([
        originalPsbtBase64,
        ...getCollectedSignedPsbts(signedPsbts).values()
      ])
    } catch {
      onNotice({
        key: 'account.nostrSync.failedToSendTransactionData',
        type: 'error'
      })
      return null
    }
  }

  // Combines every collected signature into the PSBT under review and
  // finalizes it. Returns the transaction hex, or null when it can't yet.
  function finalize() {
    const originalPsbtBase64 = txBuilderResult?.toBase64()
    if (!originalPsbtBase64) {
      onNotice({ key: 'common.error.noOriginalPSBT', type: 'error' })
      return null
    }

    try {
      const result = combineAndFinalizePsbts(
        originalPsbtBase64,
        Array.from(getCollectedSignedPsbts(signedPsbts).values())
      )
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
    } catch {
      onNotice({ key: 'common.error.combinePSBTs', type: 'error' })
      return null
    }
  }

  return {
    combineCollectedSignatures,
    finalize,
    hasAllRequiredSignatures: hasAllRequiredSignatures(
      account,
      validationResults
    ),
    importSignedData,
    signWithLocalKey: handleSignWithLocalKey,
    signWithMnemonic: handleSignWithSeedQR,
    signedPsbt,
    signedPsbts,
    updateSignedPsbt,
    validationResults
  }
}

function useSignatureValidation({
  account,
  decryptedKeys,
  signedPsbts,
  onValidationError
}: UseSignatureValidationParams) {
  const validation = useMemo(() => {
    const results = new Map<number, boolean>()
    const failedCosigners: number[] = []

    if (!account) {
      return { failedCosigners, results }
    }

    for (const [cosignerIndex, signedPsbt] of signedPsbts.entries()) {
      if (!signedPsbt.trim()) {
        continue
      }
      try {
        const isValid = validateSignedPSBTForCosigner(
          signedPsbt,
          account,
          cosignerIndex,
          decryptedKeys[cosignerIndex]
        )
        results.set(cosignerIndex, isValid)
      } catch {
        failedCosigners.push(cosignerIndex)
        results.set(cosignerIndex, false)
      }
    }

    return { failedCosigners, results }
  }, [signedPsbts, account, decryptedKeys])

  // One error per cosigner signature that could not be validated, each time
  // the signatures are validated again.
  const reportValidationErrors = useEffectEvent((failedCosigners: number[]) => {
    for (const _cosignerIndex of failedCosigners) {
      onValidationError()
    }
  })

  useEffect(() => {
    reportValidationErrors(validation.failedCosigners)
  }, [validation])

  return validation.results
}

function useSignatureDetection({
  account,
  decryptedKeys,
  routePsbt,
  signedPsbts,
  updateSignedPsbt,
  onDetected
}: UseSignatureDetectionParams) {
  const reportDetected = useEffectEvent(onDetected)

  // Detects signatures already present in the route PSBT, once both the PSBT
  // and the decrypted keys are ready.
  useEffect(() => {
    if (!routePsbt || !account || decryptedKeys.length === 0 || !account.keys) {
      return
    }

    const currentAccount = account
    const combinedPsbtBase64 = routePsbt
    // Drops a detection that finishes after its inputs changed, so a
    // signature is not stored and reported twice.
    const request = { stale: false }

    async function detectSignatures() {
      const signed = readPartiallySignedPsbt(combinedPsbtBase64)
      if (!signed) {
        return
      }
      const { originalPsbtBase64, psbt: psbtObj } = signed

      const keyFingerprints = await Promise.all(
        currentAccount.keys.map((key) => getKeyFingerprint(key))
      )
      if (request.stale) {
        return
      }
      const pubkeyToCosignerIndex = buildPubkeyToCosignerIndex(
        psbtObj,
        keyFingerprints
      )

      const signerPubkeys = getCollectedSignerPubkeys(combinedPsbtBase64)
      if (signerPubkeys.size === 0) {
        return
      }

      const bySigner = extractIndividualSignedPsbts(
        combinedPsbtBase64,
        originalPsbtBase64
      )
      if (Object.keys(bySigner).length === 0) {
        return
      }

      const matches = matchSignedPsbtsToCosigners(
        bySigner,
        pubkeyToCosignerIndex,
        currentAccount,
        decryptedKeys,
        signedPsbts
      )

      for (const match of matches) {
        updateSignedPsbt(match.cosignerIndex, match.signedPsbtBase64)
        reportDetected(match.cosignerIndex)
      }
    }

    void detectSignatures()
    return () => {
      request.stale = true
    }
  }, [routePsbt, account, decryptedKeys, updateSignedPsbt, signedPsbts])
}
