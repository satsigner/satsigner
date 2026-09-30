import { useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { type PsbtLike } from 'react-native-bdk-sdk'
import { useShallow } from 'zustand/react/shallow'

import { UNSET_OUTPUT_AMOUNT_SATS } from '@/constants/btc'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { getKeyFingerprint } from '@/utils/account'
import { type DetectedContent } from '@/utils/contentDetector'
import {
  type BitcoinContentActions,
  type BitcoinContentTarget,
  type BitcoinUriExceedsBalancePromptInfo,
  commitAddressOnly,
  commitBitcoinUriToIoPreview,
  commitDustBitcoinUri,
  extractPayjoinUriFromContent,
  getBitcoinContentHref,
  indexSignedPsbts,
  isDustPaymentAmount,
  mapSignedPsbtsToCosigners,
  parseScannedPaymentUri,
  psbtContentToBase64
} from '@/utils/contentProcessor'
import {
  extractIndividualSignedPsbts,
  extractOriginalPsbt,
  extractTransactionDataFromPSBTEnhanced,
  extractTransactionIdFromPSBT,
  findMatchingAccount
} from '@/utils/psbt'

type UseBitcoinContentHandlerProps = {
  accountId: string
  account: Account
  closePasteModal?: () => void
  onError: (message: string) => void
  onInfo: (message: string) => void
  onSuccess: (message: string) => void
}

async function getKeyFingerprintIndexes(
  account: Account
): Promise<Map<string, number>> {
  const fingerprints = await Promise.all(account.keys.map(getKeyFingerprint))
  const indexes = new Map<string, number>()
  for (const [index, fingerprint] of fingerprints.entries()) {
    if (fingerprint) {
      indexes.set(fingerprint, index)
    }
  }
  return indexes
}

async function loadScannedPsbt(
  psbtBase64: string,
  actions: BitcoinContentActions,
  account: Account
) {
  const accountMatch = await findMatchingAccount(psbtBase64, [account])
  if (!accountMatch) {
    return
  }

  const originalPsbt = extractOriginalPsbt(psbtBase64)
  const extractedData = extractTransactionDataFromPSBTEnhanced(
    originalPsbt,
    account
  )
  if (!extractedData) {
    return
  }

  actions.setRbf?.(true)
  const individualSignedPsbts = extractIndividualSignedPsbts(
    psbtBase64,
    originalPsbt
  )
  const matchedAccount = accountMatch.account
  const signedPsbts =
    matchedAccount.policyType === 'multisig'
      ? mapSignedPsbtsToCosigners(
          individualSignedPsbts,
          psbtBase64,
          await getKeyFingerprintIndexes(matchedAccount)
        )
      : indexSignedPsbts(individualSignedPsbts)
  actions.setSignedPsbts?.(signedPsbts)

  const extractedTxid = extractTransactionIdFromPSBT(originalPsbt)
  if (!extractedTxid) {
    return
  }

  const mockPsbt = {
    extractTxHex: () => '',
    feeAmount: () => extractedData.fee || 0,
    toBase64: () => originalPsbt,
    txid: () => extractedTxid
  } as unknown as PsbtLike
  actions.setPsbt?.(mockPsbt)
}

async function commitScannedBitcoinUri(
  content: DetectedContent,
  actions: BitcoinContentActions,
  target: BitcoinContentTarget
) {
  const payjoinUri = extractPayjoinUriFromContent(content)
  const request = parseScannedPaymentUri(content, payjoinUri)
  if (!request) {
    return
  }

  if (isDustPaymentAmount(request.amountSats)) {
    commitDustBitcoinUri(actions, target, request, payjoinUri)
    return
  }

  const balance = target.account?.summary?.balance
  if (balance === undefined || request.amountSats <= balance) {
    commitBitcoinUriToIoPreview(actions, target, request, payjoinUri)
    return
  }

  if (!actions.promptBitcoinUriExceedsBalance) {
    return
  }
  const choice = await actions.promptBitcoinUriExceedsBalance({
    address: request.address,
    availableBalanceSats: balance,
    label: request.label,
    requestedAmountSats: request.amountSats
  })
  if (choice === 'cancel') {
    return
  }
  commitBitcoinUriToIoPreview(
    actions,
    target,
    { ...request, amountSats: UNSET_OUTPUT_AMOUNT_SATS },
    payjoinUri
  )
}

async function processBitcoinContent(
  content: DetectedContent,
  actions: BitcoinContentActions,
  target: BitcoinContentTarget
) {
  actions.clearTransaction?.()
  actions.setAccountId?.(target.accountId)

  const href = getBitcoinContentHref(content, target.accountId)
  if (href) {
    actions.navigate(href)
  }

  if (content.type === 'psbt' && target.account) {
    await loadScannedPsbt(
      psbtContentToBase64(content.cleaned),
      actions,
      target.account
    )
    return
  }

  if (content.type === 'bitcoin_address') {
    commitAddressOnly(actions, target, content.cleaned)
    return
  }

  if (content.type !== 'bitcoin_uri') {
    return
  }

  // Malformed percent-encoding in a URI label makes decoding throw.
  try {
    await commitScannedBitcoinUri(content, actions, target)
  } catch {
    commitAddressOnly(actions, target, content.cleaned)
  }
}

export function useBitcoinContentHandler({
  accountId,
  account,
  closePasteModal,
  onError,
  onInfo,
  onSuccess
}: UseBitcoinContentHandlerProps) {
  const router = useRouter()
  const nextBlockFee = useBlockchainStore((state) => state.nextBlockFee)

  const [
    clearTransaction,
    addOutput,
    addInput,
    setFeeRate,
    setRbf,
    setSignedPsbts,
    setPsbt,
    setAccountId,
    setPayjoinUri
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.clearTransaction,
      state.addOutput,
      state.addInput,
      state.setFeeRate,
      state.setRbf,
      state.setSignedPsbts,
      state.setPsbt,
      state.setAccountId,
      state.setPayjoinUri
    ])
  )

  const [uriExceedsBalanceModal, setUriExceedsBalanceModal] =
    useState<BitcoinUriExceedsBalancePromptInfo | null>(null)
  const uriBalanceResolverRef = useRef<
    ((choice: 'cancel' | 'without_amount') => void) | null
  >(null)

  const promptBitcoinUriExceedsBalance = useCallback(
    (info: BitcoinUriExceedsBalancePromptInfo) => {
      closePasteModal?.()
      return new Promise<'cancel' | 'without_amount'>((resolve) => {
        uriBalanceResolverRef.current = resolve
        setUriExceedsBalanceModal(info)
      })
    },
    [closePasteModal]
  )

  const resolveUriExceedsBalancePrompt = useCallback(
    (choice: 'cancel' | 'without_amount') => {
      setUriExceedsBalanceModal(null)
      uriBalanceResolverRef.current?.(choice)
      uriBalanceResolverRef.current = null
    },
    []
  )

  const handleContentScanned = useCallback(
    async (content: DetectedContent) => {
      if (!content.isValid) {
        onError(t('camera.invalidContent', { context: 'bitcoin' }))
        return
      }

      if (content.type === 'incompatible') {
        onError(t('paste.error.incompatibleContent'))
        return
      }

      if (
        content.type === 'bitcoin_descriptor' ||
        content.type === 'extended_public_key'
      ) {
        onInfo(t('watchonly.info.creatingWatchOnlyAccount'))
      }

      try {
        await processBitcoinContent(
          content,
          {
            addInput,
            addOutput,
            clearTransaction,
            navigate: (path) => router.navigate(path),
            promptBitcoinUriExceedsBalance,
            setAccountId,
            setFeeRate,
            setPayjoinUri,
            setPsbt,
            setRbf,
            setSignedPsbts
          },
          { account, accountId, nextBlockFee }
        )
        if (
          content.type === 'bitcoin_uri' &&
          extractPayjoinUriFromContent(content)
        ) {
          onSuccess(t('transaction.build.payjoin.uriDetected'))
        }
      } catch {
        onError(t('camera.error.processFailed'))
      }
    },
    [
      account,
      accountId,
      addInput,
      addOutput,
      clearTransaction,
      nextBlockFee,
      onError,
      onInfo,
      onSuccess,
      promptBitcoinUriExceedsBalance,
      router,
      setAccountId,
      setFeeRate,
      setPayjoinUri,
      setPsbt,
      setRbf,
      setSignedPsbts
    ]
  )

  return {
    handleContentScanned,
    resolveUriExceedsBalancePrompt,
    uriExceedsBalanceModal
  }
}
