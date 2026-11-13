import { useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Psbt } from 'react-native-bdk-sdk'
import { useShallow } from 'zustand/react/shallow'

import { UNSET_OUTPUT_AMOUNT_SATS } from '@/constants/btc'
import { useAccountKeyFingerprintsLoader } from '@/hooks/useAccountKeyFingerprints'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { type DetectedContent } from '@/utils/contentDetector'
import {
  type BitcoinContentActions,
  type BitcoinContentTarget,
  type BitcoinUriExceedsBalancePromptInfo,
  applyScannedPsbt,
  commitAddressOnly,
  commitBitcoinUriToIoPreview,
  commitDustBitcoinUri,
  extractPayjoinUriFromContent,
  getBitcoinContentHref,
  isDustPaymentAmount,
  parseScannedPaymentUri,
  psbtContentToBase64
} from '@/utils/contentProcessor'
import { type KeyFingerprintsByAccount } from '@/utils/psbt'

type UseBitcoinContentHandlerProps = {
  accountId: string
  account: Account
  closePasteModal?: () => void
  onError: (message: string) => void
  onInfo: (message: string) => void
  onSuccess: (message: string) => void
}

// Content that builds a transaction replaces the account's current draft,
// but only once the user goes ahead with it.
const DRAFT_REPLACING_TYPES = new Set<DetectedContent['type']>([
  'bitcoin_address',
  'bitcoin_transaction',
  'psbt'
])

function startNewDraft(
  actions: BitcoinContentActions,
  target: BitcoinContentTarget
) {
  actions.clearTransaction?.()
  actions.setAccountId?.(target.accountId)
}

function committedOutcome(payjoinUri: string | undefined) {
  return payjoinUri ? 'committed_payjoin' : 'committed'
}

async function commitScannedBitcoinUri(
  content: DetectedContent,
  actions: BitcoinContentActions,
  target: BitcoinContentTarget
) {
  const payjoinUri = extractPayjoinUriFromContent(content)
  const request = parseScannedPaymentUri(content, payjoinUri)
  if (!request) {
    return 'unreadable'
  }

  if (isDustPaymentAmount(request.amountSats)) {
    startNewDraft(actions, target)
    commitDustBitcoinUri(actions, target, request, payjoinUri)
    return committedOutcome(payjoinUri)
  }

  const balance = target.account?.summary?.balance
  if (balance === undefined || request.amountSats <= balance) {
    startNewDraft(actions, target)
    commitBitcoinUriToIoPreview(actions, target, request, payjoinUri)
    return committedOutcome(payjoinUri)
  }

  if (!actions.promptBitcoinUriExceedsBalance) {
    return 'skipped'
  }
  const choice = await actions.promptBitcoinUriExceedsBalance({
    address: request.address,
    availableBalanceSats: balance,
    label: request.label,
    requestedAmountSats: request.amountSats
  })
  if (choice === 'cancel') {
    return 'skipped'
  }
  startNewDraft(actions, target)
  commitBitcoinUriToIoPreview(
    actions,
    target,
    { ...request, amountSats: UNSET_OUTPUT_AMOUNT_SATS },
    payjoinUri
  )
  return committedOutcome(payjoinUri)
}

async function processBitcoinContent(
  content: DetectedContent,
  actions: BitcoinContentActions,
  target: BitcoinContentTarget,
  ensureKeyFingerprints: () => Promise<KeyFingerprintsByAccount>
) {
  if (content.type === 'bitcoin_uri') {
    return commitScannedBitcoinUri(content, actions, target)
  }

  if (DRAFT_REPLACING_TYPES.has(content.type)) {
    startNewDraft(actions, target)
  }

  const href = getBitcoinContentHref(content, target.accountId)
  if (href) {
    actions.navigate(href)
  }

  if (content.type === 'psbt' && target.account) {
    const originalPsbt = applyScannedPsbt(
      psbtContentToBase64(content.cleaned),
      actions,
      target.account,
      await ensureKeyFingerprints()
    )
    if (originalPsbt) {
      actions.setPsbt?.(new Psbt(originalPsbt))
    }
    return
  }

  if (content.type === 'bitcoin_address') {
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
  const ensureKeyFingerprints = useAccountKeyFingerprintsLoader([account])
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
        const outcome = await processBitcoinContent(
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
          { account, accountId, nextBlockFee },
          ensureKeyFingerprints
        )
        if (outcome === 'committed_payjoin') {
          onSuccess(t('transaction.build.payjoin.uriDetected'))
        }
        if (outcome === 'unreadable') {
          onError(t('transaction.error.noValidAddressFound'))
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
      ensureKeyFingerprints,
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
