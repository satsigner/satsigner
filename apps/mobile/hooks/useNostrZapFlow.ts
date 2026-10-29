import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner-native'

import {
  NOSTR_PRIVACY_MASK,
  NOSTR_ZAP_DEFAULT_ONE_TAP_AMOUNT,
  NOSTR_ZAP_DEFAULT_PRESETS
} from '@/constants/nostr'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { useEcashStore } from '@/store/ecash'
import { useLightningStore } from '@/store/lightning'
import { useSettingsStore } from '@/store/settings'
import { useZapFlowStore } from '@/store/zapFlow'
import { type NostrIdentity } from '@/types/models/Nostr'
import { type PaymentMethod } from '@/types/models/PaymentMethod'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'
import { initiateZap } from '@/utils/nostrZap'
import {
  buildPaymentMethods,
  getAutoPaymentMethod,
  getInvoicePayRoute
} from '@/utils/paymentMethods'

type NostrZapTarget = {
  id: string
  kind: number
  lud16?: string
  pubkey: string
  tags: string[][]
}

type PendingInvoice = {
  amountSats: number
  invoice: string
  nostrUri: string
  zapRequestJson: string
}

type UseNostrZapFlowParams = {
  identity?: NostrIdentity
  npub: string
  onZapSuccess?: (amountSats: number) => void
  relays: string[]
}

/**
 * Zapping a note: builds the zap request, picks a wallet (auto-approve, the
 * only one, or the picker sheet) and hands the invoice to that wallet's pay
 * screen. The pay screen reports back through the zap flow store, and only
 * the screen that started the zap reacts to it.
 */
function useNostrZapFlow({
  identity,
  npub,
  onZapSuccess,
  relays
}: UseNostrZapFlowParams) {
  const router = useRouter()
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const lightningConfig = useLightningStore((state) => state.config)
  const lightningNodeAlias = useLightningStore(
    (state) => state.status.nodeInfo?.alias
  )
  const ecashAccounts = useEcashStore((state) => state.accounts)
  const ecashAllMints = useEcashStore((state) => state.mints)
  const setEcashActiveAccountId = useEcashStore(
    (state) => state.setActiveAccountId
  )
  const arkAccounts = useArkStore((state) => state.accounts)
  const pendingZap = useZapFlowStore((state) => state.pendingZap)
  const zapResult = useZapFlowStore((state) => state.zapResult)

  const zapSheetRef = useRef<BottomSheetMethods>(null)
  const paymentSheetRef = useRef<BottomSheetMethods>(null)
  const optionsTargetRef = useRef<NostrZapTarget | null>(null)
  const pendingInvoiceRef = useRef<PendingInvoice | null>(null)
  const startedInvoiceRef = useRef<string | null>(null)
  const [zapping, setZapping] = useState(false)
  const [payAmount, setPayAmount] = useState(0)

  const zapPrefs = identity?.zapPreferences
  const presets = zapPrefs?.presetAmounts ?? NOSTR_ZAP_DEFAULT_PRESETS
  const oneTapAmount =
    zapPrefs?.oneTapAmount ?? NOSTR_ZAP_DEFAULT_ONE_TAP_AMOUNT
  const paymentMethods = buildPaymentMethods(
    lightningConfig ? { ...lightningConfig, alias: lightningNodeAlias } : null,
    ecashAccounts,
    ecashAllMints,
    arkAccounts
  )
  const canZap =
    Boolean(identity?.nsec) &&
    !identity?.isWatchOnly &&
    paymentMethods.length > 0

  useEffect(() => {
    const ownsPendingZap =
      pendingZap !== null && pendingZap.invoice === startedInvoiceRef.current
    if (!zapResult || !ownsPendingZap) {
      return
    }
    const { clearPendingZap, setZapResult } = useZapFlowStore.getState()
    if (zapResult === 'success') {
      toast.success(
        `${t('nostrIdentity.note.zapSuccess')} (${
          privacyMode ? NOSTR_PRIVACY_MASK : pendingZap.amountSats
        } sats)`
      )
      onZapSuccess?.(pendingZap.amountSats)
    }
    startedInvoiceRef.current = null
    clearPendingZap()
    setZapResult(null)
  }, [zapResult]) // eslint-disable-line react-hooks/exhaustive-deps

  function navigateToPayment(method: PaymentMethod) {
    paymentSheetRef.current?.close()
    const pending = pendingInvoiceRef.current
    pendingInvoiceRef.current = null
    const route = pending
      ? getInvoicePayRoute(method, pending.invoice, pending.amountSats)
      : null
    if (!route) {
      return
    }
    if (method.type === 'ecash' && method.accountId) {
      setEcashActiveAccountId(method.accountId)
    }
    router.navigate(route)
  }

  function handlePaymentMethodSelect(method: PaymentMethod) {
    const pending = pendingInvoiceRef.current
    if (pending) {
      useZapFlowStore.getState().setPendingZap({
        amountSats: pending.amountSats,
        invoice: pending.invoice,
        nostrUri: pending.nostrUri,
        noteNpub: npub,
        paymentMethod: method,
        zapRequestJson: pending.zapRequestJson
      })
    }
    navigateToPayment(method)
  }

  function pickPaymentMethod() {
    const chosen = getAutoPaymentMethod(paymentMethods, zapPrefs)
    if (chosen) {
      handlePaymentMethodSelect(chosen)
      return
    }
    setPayAmount(pendingInvoiceRef.current?.amountSats ?? 0)
    paymentSheetRef.current?.snapToIndex(0)
  }

  async function zap(
    target: NostrZapTarget,
    amountSats: number,
    comment?: string
  ) {
    if (amountSats <= 0 || !canZap || zapping) {
      return
    }
    if (!target.lud16) {
      toast.error(t('nostrIdentity.note.zapEndpointNotFound'))
      return
    }
    if (!identity?.nsec) {
      toast.error(t('nostrIdentity.error.missingKeys'))
      return
    }

    setZapping(true)
    try {
      const { invoice, zapRequestJson } = await initiateZap({
        amountSats,
        comment,
        eventIdHex: target.id,
        eventKind: target.kind,
        eventTags: target.tags,
        recipientLud16: target.lud16,
        recipientPubkeyHex: target.pubkey,
        relays,
        senderNsec: identity.nsec
      })
      pendingInvoiceRef.current = {
        amountSats,
        invoice,
        nostrUri: nip19.neventEncode({ id: target.id }),
        zapRequestJson
      }
      startedInvoiceRef.current = invoice
      pickPaymentMethod()
    } catch (error) {
      toast.error(
        `${t('nostrIdentity.note.zapFailed')}: ${getNostrErrorMessage(error)}`
      )
    } finally {
      setZapping(false)
    }
  }

  function zapOneTap(target: NostrZapTarget) {
    void zap(target, oneTapAmount)
  }

  function openZapOptions(target: NostrZapTarget) {
    if (!canZap) {
      return
    }
    optionsTargetRef.current = target
    zapSheetRef.current?.snapToIndex(0)
  }

  function handleZapOptionsSubmit(amountSats: number, comment?: string) {
    zapSheetRef.current?.close()
    const target = optionsTargetRef.current
    if (target) {
      void zap(target, amountSats, comment)
    }
  }

  return {
    canZap,
    oneTapAmount,
    openZapOptions,
    sheets: {
      onPaymentMethodSelect: handlePaymentMethodSelect,
      onZapOptionsSubmit: handleZapOptionsSubmit,
      payAmount,
      paymentMethods,
      paymentSheetRef,
      presets,
      zapSheetRef
    },
    zap,
    zapOneTap,
    zapping
  }
}

type NostrZapFlowSheets = ReturnType<typeof useNostrZapFlow>['sheets']

export { useNostrZapFlow }
export type { NostrZapFlowSheets, NostrZapTarget }
