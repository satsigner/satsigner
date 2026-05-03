import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip05 as nostrNip05, nip19 } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import SSBottomSheet from '@/components/SSBottomSheet'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSIconCheckCircleThin from '@/components/icons/SSIconCheckCircleThin'
import SSIconChevronDown from '@/components/icons/SSIconChevronDown'
import SSIconChevronUp from '@/components/icons/SSIconChevronUp'
import SSIconCircleXThin from '@/components/icons/SSIconCircleXThin'
import {
  SSNostrFeedAuthorRow,
  SSNostrFeedNoteRow,
  type NostrFeedNoteLike
} from '@/components/SSNostrFeedNoteRow'
import SSNoteInlineImages from '@/components/SSNoteInlineImages'
import SSNoteInlineVideos from '@/components/SSNoteInlineVideos'
import SSPaymentMethodPicker, {
  type PaymentMethod
} from '@/components/SSPaymentMethodPicker'
import SSText from '@/components/SSText'
import {
  DEFAULT_ONE_TAP_AMOUNT,
  DEFAULT_ZAP_PRESETS,
  NOSTR_PRIVACY_MASK
} from '@/constants/nostr'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { useLightningStore } from '@/store/lightning'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useZapFlowStore } from '@/store/zapFlow'
import { Colors } from '@/styles'
import { formatFiatPrice, formatNostrCardDate } from '@/utils/format'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import {
  type DecodedNostrContent,
  type FetchedNoteData,
  decodeNostrContent,
  extractEnhancedZapTags,
  extractPubpayTags,
  truncateNpub
} from '@/utils/nostrIdentity'
import {
  nostrAccountProfileHref,
  nostrContactProfileHref,
  nostrNoteHref
} from '@/utils/nostrNavigation'
import { extractImageUrlsFromNote } from '@/utils/nostrNoteMedia'
import {
  getRelayHintForEventId,
  getReplyParentEventIdHex,
  noteLooksLikeReply
} from '@/utils/nostrNoteThread'
import { extractVideoEmbedsFromNote } from '@/utils/nostrNoteVideoUrls'
import { buildPaymentMethods } from '@/utils/paymentMethods'
import {
  type ZapReceiptInfo,
  enrichZapReceipts,
  fetchZapReceipts,
  initiateZap
} from '@/utils/zap'

type NoteParams = {
  npub: string
  nostrUri: string
}

export default function NostrNotePage() {
  const router = useRouter()
  const { npub, nostrUri } = useLocalSearchParams<NoteParams>()

  function navigateToNostrProfile(authorNpubBech: string) {
    if (!npub) {
      return
    }
    if (authorNpubBech === npub) {
      router.navigate(nostrAccountProfileHref(npub))
    } else {
      router.navigate(nostrContactProfileHref(npub, authorNpubBech))
    }
  }

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const effectiveRelays = identity?.relays ?? globalRelays

  const [fetched, setFetched] = useState<FetchedNoteData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [triedHints, setTriedHints] = useState(false)
  const [triedBroadSearch, setTriedBroadSearch] = useState(false)
  const paymentSheetRef = useRef<BottomSheetMethods>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [customAmount, setCustomAmount] = useState('')
  const [zapLoading, setZapLoading] = useState(false)
  const [zapReceipts, setZapReceipts] = useState<ZapReceiptInfo[]>([])
  const [replyParent, setReplyParent] = useState<FetchedNoteData | null>(null)
  const [replyParentLoading, setReplyParentLoading] = useState(false)
  const [replyParentMissing, setReplyParentMissing] = useState(false)
  const [replyParentKind0Pending, setReplyParentKind0Pending] = useState(false)
  const effectiveRelaysRef = useRef(effectiveRelays)
  effectiveRelaysRef.current = effectiveRelays
  const fetchedRef = useRef(false)
  const pendingInvoiceRef = useRef<{
    invoice: string
    zapRequestJson: string
  } | null>(null)
  const zapSheetRef = useRef<BottomSheetMethods>(null)
  const [sheetCustomAmount, setSheetCustomAmount] = useState('')
  const [sheetZapComment, setSheetZapComment] = useState('')
  const [showJson, setShowJson] = useState(false)
  const [showMeta, setShowMeta] = useState(true)
  const [nip05Valid, setNip05Valid] = useState<boolean | null>(null)
  const [zapSortField, setZapSortField] = useState<'date' | 'amount'>('date')
  const [zapSortAsc, setZapSortAsc] = useState(false)
  const [zapReceiptsLoading, setZapReceiptsLoading] = useState(false)

  const zapPrefs = identity?.zapPreferences
  const zapPresets = zapPrefs?.presetAmounts ?? DEFAULT_ZAP_PRESETS
  const oneTapAmount = zapPrefs?.oneTapAmount ?? DEFAULT_ONE_TAP_AMOUNT

  const lightningConfig = useLightningStore((state) => state.config)
  const lightningNodeAlias = useLightningStore(
    (state) => state.status.nodeInfo?.alias
  )
  const { accounts: ecashAccounts, allMints: ecashAllMints } = useEcash()
  const arkAccounts = useArkStore((state) => state.accounts)
  const btcPrice = usePriceStore((state) => state.btcPrice)
  const fiatCurrency = usePriceStore((state) => state.fiatCurrency)

  const pendingZap = useZapFlowStore((state) => state.pendingZap)
  const zapResult = useZapFlowStore((state) => state.zapResult)
  const clearPendingZap = useZapFlowStore((state) => state.clearPendingZap)
  const setZapResult = useZapFlowStore((state) => state.setZapResult)
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const decoded = nostrUri ? decodeNostrContent(nostrUri) : null

  const availablePaymentMethods = buildPaymentMethods(
    lightningConfig ? { ...lightningConfig, alias: lightningNodeAlias } : null,
    ecashAccounts,
    ecashAllMints,
    arkAccounts
  )

  const ownPubkeyHex = getPubKeyHexFromNpub(npub ?? '') ?? ''
  const [ownPubkeys] = useState(() =>
    ownPubkeyHex ? [ownPubkeyHex] : ([] as string[])
  )
  const ownPubkeysRef = useRef(ownPubkeys)
  ownPubkeysRef.current = ownPubkeys

  async function loadZapReceipts(eventIdHex: string) {
    setZapReceiptsLoading(true)
    try {
      const receipts = await fetchZapReceipts(
        eventIdHex,
        effectiveRelaysRef.current,
        ownPubkeysRef.current
      )
      setZapReceipts(receipts)
      setZapReceiptsLoading(false)
      await enrichZapReceipts(receipts, effectiveRelaysRef.current)
      setZapReceipts([...receipts])
    } catch {
      setZapReceiptsLoading(false)
    }
  }

  const relayHints =
    decoded?.kind === 'nevent' &&
    Array.isArray(decoded.metadata?.relays) &&
    (decoded.metadata.relays as string[]).length > 0
      ? (decoded.metadata.relays as string[])
      : undefined

  async function handleEventFound(event: {
    content: string
    pubkey: string
    kind: number
    tags: string[][]
    created_at: number
  }) {
    setFetched({
      content: event.content,
      created_at: event.created_at,
      kind: event.kind,
      pubkey: event.pubkey,
      tags: event.tags
    })
    setIsLoading(false)
    setNotFound(false)

    if (decoded?.data) {
      loadZapReceipts(decoded.data)
    }

    const authorNpub = nip19.npubEncode(event.pubkey)
    const profileApi = new NostrAPI(
      effectiveRelaysRef.current,
      ownPubkeysRef.current
    )
    try {
      const profile = await profileApi.fetchKind0(authorNpub)
      if (!profile) {
        setProfileLoading(false)
        return
      }
      setFetched((prev) => {
        if (!prev) {
          return prev
        }
        return {
          ...prev,
          authorLud16: profile.lud16,
          authorName: profile.displayName,
          authorNip05: profile.nip05,
          authorPicture: profile.picture
        }
      })
      setProfileLoading(false)
      if (profile.nip05 && nostrNip05.isNip05(profile.nip05)) {
        nostrNip05
          .isValid(event.pubkey, profile.nip05)
          .then(setNip05Valid)
          .catch(() => setNip05Valid(false))
      }
    } catch {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    if (!decoded || fetchedRef.current) {
      return
    }
    if (
      decoded.kind !== 'note' &&
      decoded.kind !== 'nevent' &&
      decoded.kind !== 'json_note'
    ) {
      return
    }

    fetchedRef.current = true

    if (decoded.kind === 'json_note' && decoded.metadata) {
      setFetched({
        content:
          typeof decoded.metadata.content === 'string'
            ? decoded.metadata.content
            : '',
        created_at: 0,
        kind:
          typeof decoded.metadata.kind === 'number' ? decoded.metadata.kind : 1,
        pubkey: '',
        tags: Array.isArray(decoded.metadata.tags)
          ? (decoded.metadata.tags as string[][])
          : []
      })
      setIsLoading(false)
      setProfileLoading(false)
      return
    }

    async function fetchNote() {
      if (!decoded) {
        return
      }
      const api = new NostrAPI(
        effectiveRelaysRef.current,
        ownPubkeysRef.current
      )
      try {
        const event = await api.fetchEvent(decoded.data)
        if (!event) {
          setIsLoading(false)
          setProfileLoading(false)
          setNotFound(true)
          return
        }
        await handleEventFound(event)
      } catch {
        setIsLoading(false)
        setProfileLoading(false)
        setNotFound(true)
      }
    }

    void fetchNote()
  }, [decoded]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTryHintedRelays() {
    if (!decoded?.data || !relayHints?.length) {
      return
    }
    setIsLoading(true)
    setNotFound(false)
    setTriedHints(true)
    try {
      const event = await NostrAPI.fetchEventFromRelays(
        decoded.data,
        relayHints,
        ownPubkeysRef.current
      )
      if (event) {
        handleEventFound(event)
      } else {
        setIsLoading(false)
        setNotFound(true)
      }
    } catch {
      setIsLoading(false)
      setNotFound(true)
    }
  }

  async function handleBroadSearch() {
    if (!decoded?.data) {
      return
    }
    const alreadyTried = new Set([
      ...effectiveRelaysRef.current,
      ...(relayHints ?? [])
    ])
    const searchRelays = NostrAPI.INDEXING_RELAYS.filter(
      (url) => !alreadyTried.has(url)
    )
    if (searchRelays.length === 0) {
      return
    }

    setIsLoading(true)
    setNotFound(false)
    setTriedBroadSearch(true)
    try {
      const event = await NostrAPI.fetchEventFromRelays(
        decoded.data,
        searchRelays,
        ownPubkeysRef.current
      )
      if (event) {
        handleEventFound(event)
      } else {
        setIsLoading(false)
        setNotFound(true)
        toast.error(t('nostrIdentity.account.eventNotFound'))
      }
    } catch {
      setIsLoading(false)
      setNotFound(true)
      toast.error(t('nostrIdentity.account.eventNotFound'))
    }
  }

  useEffect(() => {
    if (zapResult === 'success' && pendingZap) {
      toast.success(
        `${t('nostrIdentity.note.zapSuccess')} (${
          privacyMode ? NOSTR_PRIVACY_MASK : pendingZap.amountSats
        } sats)`
      )
      if (decoded?.data) {
        loadZapReceipts(decoded.data)
      }
      clearPendingZap()
      setZapResult(null)
    } else if (zapResult === 'cancelled') {
      clearPendingZap()
      setZapResult(null)
    }
  }, [zapResult, privacyMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const pubpayTags = extractPubpayTags(fetched?.tags ?? [])

  const enhancedZap = extractEnhancedZapTags(fetched?.tags ?? [])

  const isFixedAmount =
    enhancedZap.zapMin !== undefined &&
    enhancedZap.zapMax !== undefined &&
    enhancedZap.zapMin === enhancedZap.zapMax

  const isRangeAmount =
    enhancedZap.zapMin !== undefined &&
    enhancedZap.zapMax !== undefined &&
    enhancedZap.zapMin < enhancedZap.zapMax

  const hasEnhancedZapTags =
    enhancedZap.zapMin !== undefined || enhancedZap.zapMax !== undefined

  const effectiveLud16 = enhancedZap.zapLnurl || fetched?.authorLud16

  const totalZapped = zapReceipts.reduce((sum, r) => sum + r.amountSats, 0)

  const noteImageUrls =
    !fetched || privacyMode
      ? []
      : extractImageUrlsFromNote(fetched.content, fetched.tags)

  const noteVideoEmbeds =
    !fetched || privacyMode
      ? []
      : extractVideoEmbedsFromNote(fetched.content, fetched.tags)

  const replyParentId = fetched?.tags
    ? getReplyParentEventIdHex(fetched.tags)
    : null

  const replyParentRelayHint =
    !fetched?.tags || !replyParentId
      ? undefined
      : getRelayHintForEventId(fetched.tags, replyParentId)

  useEffect(() => {
    let cancelled = false

    if (!replyParentId) {
      setReplyParent(null)
      setReplyParentKind0Pending(false)
      setReplyParentLoading(false)
      setReplyParentMissing(false)
      return
    }

    setReplyParent(null)
    setReplyParentKind0Pending(false)
    setReplyParentMissing(false)
    setReplyParentLoading(true)

    const api = new NostrAPI(effectiveRelaysRef.current, ownPubkeysRef.current)

    async function fetchReplyParent() {
      if (!replyParentId) {
        return
      }
      try {
        let event = await api.fetchEvent(replyParentId)
        if (!event && replyParentRelayHint) {
          event = await NostrAPI.fetchEventFromRelays(
            replyParentId,
            [replyParentRelayHint],
            ownPubkeysRef.current
          )
        }
        if (cancelled) {
          return
        }
        if (!event) {
          setReplyParentMissing(true)
          setReplyParentLoading(false)
          return
        }

        const base: FetchedNoteData = {
          content: event.content,
          created_at: event.created_at,
          kind: event.kind,
          pubkey: event.pubkey,
          tags: event.tags
        }
        setReplyParent(base)
        setReplyParentLoading(false)

        const authorNpub = nip19.npubEncode(event.pubkey)
        const profileApi = new NostrAPI(
          effectiveRelaysRef.current,
          ownPubkeysRef.current
        )
        setReplyParentKind0Pending(true)
        try {
          const profile = await profileApi.fetchKind0(authorNpub)
          if (!cancelled && profile) {
            setReplyParent((prev) => {
              if (!prev || prev.pubkey !== event.pubkey) {
                return prev
              }
              return {
                ...prev,
                authorLud16: profile.lud16,
                authorName: profile.displayName,
                authorNip05: profile.nip05,
                authorPicture: profile.picture
              }
            })
          }
        } catch {
          // non-critical
        } finally {
          if (!cancelled) {
            setReplyParentKind0Pending(false)
          }
        }
      } catch {
        if (!cancelled) {
          setReplyParentMissing(true)
          setReplyParentLoading(false)
        }
      }
    }

    void fetchReplyParent()

    return () => {
      cancelled = true
    }
  }, [replyParentId, replyParentRelayHint])

  const noteItemForFeed = deriveNoteItemForFeed(fetched, decoded)

  const noteAuthorFeedProps = deriveAuthorFeedProps(
    fetched,
    identity,
    npub,
    privacyMode,
    profileLoading
  )

  const replyParentNoteLike: NostrFeedNoteLike | null =
    !replyParent || !replyParentId
      ? null
      : {
          content: replyParent.content,
          created_at: replyParent.created_at,
          id: replyParentId,
          kind: replyParent.kind,
          pubkey: replyParent.pubkey,
          tags: replyParent.tags
        }

  const replyParentAuthorFeedProps = deriveAuthorFeedProps(
    replyParent,
    identity,
    npub,
    privacyMode,
    replyParentKind0Pending
  )

  const goalProgress =
    enhancedZap.zapGoal && enhancedZap.zapGoal > 0
      ? Math.min(totalZapped / enhancedZap.zapGoal, 1)
      : undefined

  const qualifyingUseCount = zapReceipts.filter((r) => {
    if (enhancedZap.zapMin !== undefined && r.amountSats < enhancedZap.zapMin) {
      return false
    }
    if (enhancedZap.zapMax !== undefined && r.amountSats > enhancedZap.zapMax) {
      return false
    }
    return true
  }).length

  const usesRemaining =
    enhancedZap.zapUses !== undefined
      ? Math.max(0, enhancedZap.zapUses - qualifyingUseCount)
      : undefined

  const isRequestComplete =
    (goalProgress !== undefined && goalProgress >= 1) ||
    (usesRemaining !== undefined && usesRemaining <= 0)

  async function handleZap(amountSats: number, comment?: string) {
    if (!amountSats || amountSats <= 0) {
      return
    }
    if (availablePaymentMethods.length === 0) {
      return
    }

    if (!effectiveLud16) {
      toast.error(t('nostrIdentity.note.zapEndpointNotFound'))
      return
    }

    if (!identity?.nsec) {
      toast.error(t('nostrIdentity.error.missingKeys'))
      return
    }

    if (!fetched) {
      return
    }

    setZapLoading(true)
    try {
      const { invoice, zapRequestJson } = await initiateZap({
        amountSats,
        comment,
        eventIdHex: decoded?.data,
        eventKind: fetched.kind,
        eventTags: fetched.tags,
        recipientLud16: effectiveLud16,
        recipientPubkeyHex: fetched.pubkey,
        relays: effectiveRelays,
        senderNsec: identity.nsec
      })

      setZapLoading(false)
      pendingInvoiceRef.current = { invoice, zapRequestJson }

      if (zapPrefs?.autoApprove && zapPrefs.autoApproveWalletId) {
        const autoWallet = availablePaymentMethods.find(
          (m) => m.id === zapPrefs.autoApproveWalletId
        )
        if (autoWallet) {
          navigateToPayment(autoWallet, invoice, zapRequestJson, amountSats)
          return
        }
      }

      if (availablePaymentMethods.length === 1) {
        navigateToPayment(
          availablePaymentMethods[0],
          invoice,
          zapRequestJson,
          amountSats
        )
        return
      }

      setPayAmount(amountSats)
      paymentSheetRef.current?.snapToIndex(0)
    } catch (error) {
      setZapLoading(false)
      const reason = error instanceof Error ? error.message : 'unknown'
      toast.error(`${t('nostrIdentity.note.zapFailed')}: ${reason}`)
    }
  }

  function navigateToPayment(
    method: PaymentMethod,
    invoice?: string,
    zapRequestJson?: string,
    amountSats?: number
  ) {
    paymentSheetRef.current?.close()

    const pending = pendingInvoiceRef.current
    const bolt11 = invoice || pending?.invoice
    const reqJson = zapRequestJson || pending?.zapRequestJson || ''
    const sats = amountSats ?? payAmount
    pendingInvoiceRef.current = null

    if (bolt11 && npub && nostrUri) {
      useZapFlowStore.getState().setPendingZap({
        amountSats: sats,
        invoice: bolt11,
        nostrUri,
        noteNpub: npub,
        paymentMethod: method,
        zapRequestJson: reqJson
      })
    }

    if (method.type === 'lightning') {
      router.navigate({
        params: bolt11 ? { invoice: bolt11 } : undefined,
        pathname: '/signer/lightning/pay'
      })
    } else if (method.type === 'ecash') {
      router.navigate({
        params: bolt11 ? { invoice: bolt11 } : undefined,
        pathname: '/signer/ecash/send'
      })
    } else if (method.type === 'ark' && method.accountId && bolt11) {
      router.navigate({
        params: {
          amountSats: String(sats),
          id: method.accountId,
          invoice: bolt11
        },
        pathname: '/signer/ark/account/[id]/pay-invoice'
      })
    }
  }

  function handleAmountSelected(sats: number) {
    setCustomAmount('')
    handleZap(sats)
  }

  function handleCustomAmountSubmit() {
    const sats = parseInt(customAmount, 10)
    if (!sats || sats <= 0) {
      return
    }
    handleZap(sats)
  }

  function handleOneTapZap() {
    handleZap(oneTapAmount)
  }

  function handleOpenZapSheet() {
    setSheetCustomAmount('')
    setSheetZapComment('')
    zapSheetRef.current?.snapToIndex(0)
  }

  function handleSheetAmountSelected(sats: number) {
    zapSheetRef.current?.close()
    handleZap(sats, sheetZapComment || undefined)
  }

  function handleSheetCustomSubmit() {
    const sats = parseInt(sheetCustomAmount, 10)
    if (!sats || sats <= 0) {
      return
    }
    zapSheetRef.current?.close()
    handleZap(sats, sheetZapComment || undefined)
  }

  function handleZapSortPress(field: 'date' | 'amount') {
    if (zapSortField === field) {
      setZapSortAsc((v) => !v)
    } else {
      setZapSortField(field)
      setZapSortAsc(false)
    }
  }

  const sortedZapReceipts = [...zapReceipts].sort((a, b) => {
    const multiplier = zapSortAsc ? 1 : -1
    if (zapSortField === 'amount') {
      return (a.amountSats - b.amountSats) * multiplier
    }
    return (a.createdAt - b.createdAt) * multiplier
  })

  const noteHexId = decoded?.data ?? ''
  const noteId = noteHexId ? nip19.noteEncode(noteHexId) : ''
  const noteNeventId = noteHexId ? nip19.neventEncode({ id: noteHexId }) : ''

  const eventJson = fetched
    ? JSON.stringify(
        {
          id: decoded?.data ?? '',
          pubkey: fetched.pubkey,
          kind: fetched.kind,
          created_at: fetched.created_at,
          tags: fetched.tags,
          content: fetched.content
        },
        null,
        2
      )
    : ''

  if (!decoded || decoded.kind === 'unknown') {
    return (
      <SSMainLayout>
        <Stack.Screen
          options={{
            headerTitle: () => (
              <SSText uppercase>{t('nostrIdentity.note.title')}</SSText>
            )
          }}
        />
        <SSVStack itemsCenter gap="lg" style={styles.centered}>
          <SSText color="muted">
            {t('nostrIdentity.note.invalidContent')}
          </SSText>
          <SSButton
            label={t('common.back')}
            variant="ghost"
            onPress={() => router.back()}
          />
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.note.title')}</SSText>
          )
        }}
      />
      {isLoading ? (
        <SSVStack itemsCenter gap="md" style={styles.centered}>
          <ActivityIndicator color={Colors.white} size="large" />
          <SSText color="muted">
            {t('nostrIdentity.account.fetchingNote')}
          </SSText>
        </SSVStack>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <SSVStack gap="md" style={styles.content}>
            {!noteItemForFeed && fetched?.pubkey ? (
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={!npub}
                onPress={() =>
                  navigateToNostrProfile(nip19.npubEncode(fetched.pubkey))
                }
              >
                <SSHStack gap="md" style={styles.authorRow}>
                  {privacyMode ? (
                    <View
                      style={[
                        styles.authorAvatar,
                        styles.authorAvatarPlaceholder
                      ]}
                    />
                  ) : fetched.authorPicture ? (
                    <Image
                      source={{ uri: fetched.authorPicture }}
                      style={styles.authorAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.authorAvatar,
                        styles.authorAvatarPlaceholder
                      ]}
                    >
                      <SSText size="lg" weight="bold">
                        {fetched.authorName?.[0]?.toUpperCase() || '?'}
                      </SSText>
                    </View>
                  )}
                  <SSVStack gap="none" style={{ flex: 1 }}>
                    {fetched.authorName && !privacyMode && (
                      <SSText size="md" weight="medium" style={{ lineHeight: 18 }}>
                        {fetched.authorName}
                      </SSText>
                    )}
                    {privacyMode && (
                      <SSText size="md" weight="medium" style={{ lineHeight: 18 }}>
                        {NOSTR_PRIVACY_MASK}
                      </SSText>
                    )}
                    <SSText size="xs" color="muted" type="mono" style={{ lineHeight: 16 }}>
                      {truncateNpub(nip19.npubEncode(fetched.pubkey), 12)}
                    </SSText>
                    {fetched.authorNip05 && !privacyMode && (
                      <SSHStack gap="xs" style={{ alignItems: 'center' }}>
                        <SSText size="xs" color="muted" style={{ lineHeight: 16 }}>
                          {fetched.authorNip05}
                        </SSText>
                        {nip05Valid === true && (
                          <SSIconCheckCircleThin width={12} height={12} />
                        )}
                        {nip05Valid === false && (
                          <SSIconCircleXThin width={12} height={12} />
                        )}
                      </SSHStack>
                    )}
                  </SSVStack>
                </SSHStack>
              </TouchableOpacity>
            ) : null}

            {noteItemForFeed &&
            fetched &&
            (fetched.content.length > 0 ||
              noteImageUrls.length > 0 ||
              noteVideoEmbeds.length > 0) ? (
              <SSNostrFeedNoteRow
                note={noteItemForFeed}
                privacyMode={privacyMode}
                showAuthor={Boolean(fetched.pubkey)}
                expandContent
                authorPreview={
                  noteAuthorFeedProps ? (
                    <SSNostrFeedAuthorRow
                      contextNpub={npub || undefined}
                      loading={noteAuthorFeedProps.loading}
                      npubBech={noteAuthorFeedProps.authorNpubBech}
                      displayName={noteAuthorFeedProps.displayName}
                      nip05={noteAuthorFeedProps.nip05}
                      nip05Valid={nip05Valid}
                      pictureUri={noteAuthorFeedProps.pictureUri}
                    />
                  ) : undefined
                }
              />
            ) : null}

            {!noteItemForFeed &&
            fetched &&
            (fetched.content.length > 0 ||
              noteImageUrls.length > 0 ||
              noteVideoEmbeds.length > 0) ? (
              <View style={styles.noteCard}>
                {!privacyMode && noteLooksLikeReply(fetched.tags) ? (
                  <View style={styles.noteReplyTag} pointerEvents="none">
                    <SSText
                      size="xxs"
                      color="white"
                      uppercase
                      style={styles.noteReplyTagText}
                    >
                      {t('nostrIdentity.feed.replyTag')}
                    </SSText>
                  </View>
                ) : null}
                {fetched.content.length > 0 ? (
                  <SSText
                    style={[
                      styles.noteText,
                      !privacyMode &&
                        noteLooksLikeReply(fetched.tags) &&
                        styles.noteTextWithReplyTag
                    ]}
                  >
                    {privacyMode
                      ? t('nostrIdentity.feed.hiddenInPrivacyMode')
                      : fetched.content}
                  </SSText>
                ) : null}
                {noteImageUrls.length > 0 ? (
                  <SSNoteInlineImages
                    uris={noteImageUrls}
                    style={
                      fetched.content.length > 0
                        ? styles.noteImagesBelowText
                        : styles.noteImagesNoText
                    }
                  />
                ) : null}
                {noteVideoEmbeds.length > 0 ? (
                  <SSNoteInlineVideos
                    embeds={noteVideoEmbeds}
                    style={
                      fetched.content.length > 0 || noteImageUrls.length > 0
                        ? styles.noteImagesBelowText
                        : styles.noteImagesNoText
                    }
                  />
                ) : null}
              </View>
            ) : null}

            {fetched ? (
              <SSVStack gap="xxs">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowMeta((v) => !v)}
                  style={styles.metaToggle}
                >
                  <SSText size="xs" color="muted" uppercase>
                    {t('nostrIdentity.note.metadata')}
                  </SSText>
                  {showMeta ? (
                    <SSIconChevronUp width={10} height={10} />
                  ) : (
                    <SSIconChevronDown width={10} height={10} />
                  )}
                </TouchableOpacity>
                {showMeta ? (
                  <SSVStack gap="xxs">
                    <SSHStack gap="xs" style={styles.metaRow}>
                      <SSText size="xxs" color="muted" uppercase style={styles.metaLabel}>
                        kind
                      </SSText>
                      <View style={styles.kindBadge}>
                        <SSText size="xxs">{fetched.kind}</SSText>
                      </View>
                    </SSHStack>
                    <SSHStack gap="xs" style={styles.metaRow}>
                      <SSText size="xxs" color="muted" uppercase style={styles.metaLabel}>
                        nevent
                      </SSText>
                      <SSClipboardCopy text={noteNeventId} style={styles.metaValue}>
                        <SSText size="xxs" type="mono" color="muted" numberOfLines={1} ellipsizeMode="middle">
                          {noteNeventId}
                        </SSText>
                      </SSClipboardCopy>
                    </SSHStack>
                    <SSHStack gap="xs" style={styles.metaRow}>
                      <SSText size="xxs" color="muted" uppercase style={styles.metaLabel}>
                        note
                      </SSText>
                      <SSClipboardCopy text={noteId} style={styles.metaValue}>
                        <SSText size="xxs" type="mono" color="muted" numberOfLines={1} ellipsizeMode="middle">
                          {noteId}
                        </SSText>
                      </SSClipboardCopy>
                    </SSHStack>
                    <SSHStack gap="xs" style={styles.metaRow}>
                      <SSText size="xxs" color="muted" uppercase style={styles.metaLabel}>
                        hex
                      </SSText>
                      <SSClipboardCopy text={noteHexId} style={styles.metaValue}>
                        <SSText size="xxs" type="mono" color="muted" numberOfLines={1} ellipsizeMode="middle">
                          {noteHexId}
                        </SSText>
                      </SSClipboardCopy>
                    </SSHStack>
                    {fetched.tags.map((tag, index) => (
                      <SSHStack key={index} gap="xs" style={styles.metaRow}>
                        <View style={styles.tagTypeBadge}>
                          <SSText size="xxs" type="mono">
                            {tag[0]}
                          </SSText>
                        </View>
                        <SSText
                          size="xxs"
                          type="mono"
                          color="muted"
                          numberOfLines={1}
                          ellipsizeMode="middle"
                          style={styles.metaValue}
                        >
                          {tag.slice(1).join(' ')}
                        </SSText>
                      </SSHStack>
                    ))}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setShowJson((v) => !v)}
                      style={styles.metaToggle}
                    >
                      <SSText size="xxs" color="muted" uppercase>
                        {t('nostrIdentity.note.showJson')}
                      </SSText>
                      {showJson ? (
                        <SSIconChevronUp width={10} height={10} />
                      ) : (
                        <SSIconChevronDown width={10} height={10} />
                      )}
                    </TouchableOpacity>
                    {showJson ? (
                      <SSClipboardCopy text={eventJson}>
                        <SSText size="xxs" type="mono" style={styles.jsonText}>
                          {eventJson}
                        </SSText>
                      </SSClipboardCopy>
                    ) : null}
                  </SSVStack>
                ) : null}
              </SSVStack>
            ) : null}

            {fetched && availablePaymentMethods.length > 0 && (
              <SSVStack gap="sm">
                {profileLoading ? (
                  <SSHStack gap="sm" style={styles.zapLoadingRow}>
                    <ActivityIndicator color={Colors.white} size="small" />
                    <SSText size="xs" color="muted">
                      {t('nostrIdentity.note.loadingProfile')}
                    </SSText>
                  </SSHStack>
                ) : (
                  <>
                    {isRequestComplete && (
                      <SSButton
                        label={t('nostrIdentity.note.requestComplete')}
                        variant="default"
                        style={{ opacity: 0.6 }}
                      />
                    )}

                    {enhancedZap.zapGoal !== undefined && (
                      <SSVStack gap="xs">
                        <SSHStack gap="sm" style={styles.goalHeader}>
                          <SSText size="xs" color="muted">
                            {t('nostrIdentity.note.goal')}
                          </SSText>
                          <SSText size="xs" weight="medium">
                            {privacyMode
                              ? `${NOSTR_PRIVACY_MASK} / ${NOSTR_PRIVACY_MASK} sats`
                              : `${totalZapped.toLocaleString()} / ${enhancedZap.zapGoal.toLocaleString()} sats`}
                          </SSText>
                        </SSHStack>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: privacyMode
                                  ? '0%'
                                  : `${(goalProgress ?? 0) * 100}%`
                              }
                            ]}
                          />
                        </View>
                      </SSVStack>
                    )}

                    {enhancedZap.zapUses !== undefined && (
                      <SSHStack gap="sm" style={styles.goalHeader}>
                        <SSText size="xs" color="muted">
                          {t('nostrIdentity.note.uses')}
                        </SSText>
                        <SSText
                          size="xs"
                          weight="medium"
                          style={
                            !privacyMode && usesRemaining === 0
                              ? { color: Colors.success }
                              : undefined
                          }
                        >
                          {privacyMode
                            ? `${NOSTR_PRIVACY_MASK} / ${NOSTR_PRIVACY_MASK}`
                            : `${qualifyingUseCount} / ${enhancedZap.zapUses}`}
                        </SSText>
                      </SSHStack>
                    )}

                    {enhancedZap.zapLnurl && (
                      <SSHStack gap="sm" style={styles.goalHeader}>
                        <SSText size="xs" color="muted">
                          {t('nostrIdentity.note.payTo')}
                        </SSText>
                        <SSText size="xs" type="mono">
                          {privacyMode
                            ? NOSTR_PRIVACY_MASK
                            : enhancedZap.zapLnurl}
                        </SSText>
                      </SSHStack>
                    )}

                    {isFixedAmount && !isRequestComplete && (
                      <SSButton
                        label={`${t('nostrIdentity.note.zap')} ${privacyMode ? NOSTR_PRIVACY_MASK : enhancedZap.zapMin?.toLocaleString()} sats`}
                        variant="secondary"
                        disabled={zapLoading || !effectiveLud16}
                        onPress={() =>
                          handleAmountSelected(enhancedZap.zapMin!)
                        }
                      />
                    )}

                    {isRangeAmount && !isRequestComplete && (
                      <SSVStack gap="sm">
                        <SSText size="xs" color="muted">
                          {privacyMode
                            ? t('nostrIdentity.note.rangeHint', {
                                max: NOSTR_PRIVACY_MASK,
                                min: NOSTR_PRIVACY_MASK
                              })
                            : t('nostrIdentity.note.rangeHint', {
                                max: enhancedZap.zapMax!.toLocaleString(),
                                min: enhancedZap.zapMin!.toLocaleString()
                              })}
                        </SSText>
                        <SSHStack gap="sm" style={styles.presetRow}>
                          {[
                            enhancedZap.zapMin!,
                            Math.round(
                              (enhancedZap.zapMin! + enhancedZap.zapMax!) / 2
                            ),
                            enhancedZap.zapMax!
                          ].map((sats) => (
                            <TouchableOpacity
                              key={sats}
                              style={styles.presetButton}
                              disabled={zapLoading || !effectiveLud16}
                              onPress={() => handleAmountSelected(sats)}
                              activeOpacity={0.6}
                            >
                              <SSText size="sm" weight="medium" center>
                                {privacyMode
                                  ? NOSTR_PRIVACY_MASK
                                  : sats.toLocaleString()}
                              </SSText>
                            </TouchableOpacity>
                          ))}
                        </SSHStack>
                        <TextInput
                          style={styles.customInput}
                          placeholderTextColor={Colors.gray[500]}
                          placeholder={
                            privacyMode
                              ? `${NOSTR_PRIVACY_MASK} – ${NOSTR_PRIVACY_MASK} sats`
                              : `${enhancedZap.zapMin} – ${enhancedZap.zapMax} sats`
                          }
                          keyboardType="number-pad"
                          value={customAmount}
                          onChangeText={setCustomAmount}
                          returnKeyType="done"
                          editable={!!effectiveLud16}
                          onSubmitEditing={handleCustomAmountSubmit}
                        />
                        <SSButton
                          label={
                            customAmount && parseInt(customAmount, 10) > 0
                              ? `${t('nostrIdentity.note.zap')} ${privacyMode ? NOSTR_PRIVACY_MASK : parseInt(customAmount, 10).toLocaleString()} sats`
                              : t('nostrIdentity.note.zap')
                          }
                          variant="secondary"
                          disabled={
                            zapLoading ||
                            !effectiveLud16 ||
                            !customAmount ||
                            parseInt(customAmount, 10) <
                              (enhancedZap.zapMin ?? 1) ||
                            parseInt(customAmount, 10) >
                              (enhancedZap.zapMax ?? Infinity)
                          }
                          onPress={handleCustomAmountSubmit}
                        />
                      </SSVStack>
                    )}

                    {pubpayTags.length > 0 && !hasEnhancedZapTags && (
                      <SSVStack gap="sm">
                        <SSText size="xs" color="muted" uppercase>
                          {t('nostrIdentity.note.zapAmounts')}
                        </SSText>
                        {pubpayTags.map((tag, index) => (
                          <SSHStack key={index} gap="sm" style={styles.zapRow}>
                            <SSVStack gap="none" style={{ flex: 1 }}>
                              <SSText size="lg" weight="medium">
                                {privacyMode
                                  ? `${NOSTR_PRIVACY_MASK} ${tag.currency}`
                                  : `${tag.amount} ${tag.currency}`}
                              </SSText>
                              {tag.relay && (
                                <SSText size="xs" color="muted">
                                  via {tag.relay}
                                </SSText>
                              )}
                            </SSVStack>
                            <SSButton
                              label={t('nostrIdentity.note.zap')}
                              variant="secondary"
                              disabled={zapLoading || !effectiveLud16}
                              onPress={() => handleAmountSelected(tag.amount)}
                              style={styles.zapButton}
                            />
                          </SSHStack>
                        ))}
                      </SSVStack>
                    )}

                    {(hasEnhancedZapTags || pubpayTags.length > 0) && (
                      <View style={{ height: 8 }} />
                    )}

                    {effectiveLud16 && !identity?.isWatchOnly && (
                      <SSHStack gap="sm">
                        <SSButton
                          label={
                            privacyMode
                              ? `${NOSTR_PRIVACY_MASK} sats`
                              : t('nostrIdentity.note.zapOneTap', {
                                  amount: oneTapAmount
                                })
                          }
                          variant="outline"
                          disabled={zapLoading}
                          onPress={handleOneTapZap}
                          onLongPress={handleOpenZapSheet}
                          delayLongPress={400}
                          style={{ flex: 1 }}
                        />
                        <SSButton
                          label={t('nostrIdentity.note.more')}
                          variant="outline"
                          disabled={zapLoading}
                          onPress={handleOpenZapSheet}
                          style={{ flex: 1 }}
                        />
                      </SSHStack>
                    )}

                    {!effectiveLud16 && (
                      <SSText size="xs" color="muted" center>
                        {t('nostrIdentity.note.zapEndpointNotFound')}
                      </SSText>
                    )}
                  </>
                )}

                {zapLoading && (
                  <SSHStack gap="sm" style={styles.zapLoadingRow}>
                    <ActivityIndicator color={Colors.white} size="small" />
                    <SSText size="sm" color="muted">
                      {t('nostrIdentity.note.zapSending')}
                    </SSText>
                  </SSHStack>
                )}
              </SSVStack>
            )}

            {identity?.isWatchOnly && fetched && (
              <SSText size="xs" color="muted" center>
                {t('nostrIdentity.keys.watchOnly')}
              </SSText>
            )}

            {zapReceipts.length > 0 && (
              <SSVStack gap="sm">
                <SSHStack gap="sm" style={styles.zapSortHeader}>
                  <SSText size="xs" color="muted" uppercase style={{ flex: 1 }}>
                    {t('nostrIdentity.note.zapReceipts')} ({zapReceipts.length})
                  </SSText>
                  <TouchableOpacity
                    onPress={() => handleZapSortPress('date')}
                    hitSlop={8}
                  >
                    <SSText
                      size="xxs"
                      color={zapSortField === 'date' ? 'white' : 'muted'}
                    >
                      {t('nostrIdentity.zapSort.date')}
                      {zapSortField === 'date' ? (zapSortAsc ? ' ↑' : ' ↓') : ''}
                    </SSText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleZapSortPress('amount')}
                    hitSlop={8}
                  >
                    <SSText
                      size="xxs"
                      color={zapSortField === 'amount' ? 'white' : 'muted'}
                    >
                      {t('nostrIdentity.zapSort.amount')}
                      {zapSortField === 'amount' ? (zapSortAsc ? ' ↑' : ' ↓') : ''}
                    </SSText>
                  </TouchableOpacity>
                </SSHStack>
                {sortedZapReceipts.map((receipt) => (
                  <SSHStack key={receipt.id} gap="sm" style={styles.receiptRow}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={!npub}
                      onPress={() =>
                        navigateToNostrProfile(
                          nip19.npubEncode(receipt.senderPubkey)
                        )
                      }
                      style={styles.receiptSenderHit}
                    >
                      <SSHStack gap="sm" style={styles.receiptSenderInner}>
                        {privacyMode ? (
                          <View
                            style={[
                              styles.receiptAvatar,
                              styles.receiptAvatarPlaceholder
                            ]}
                          />
                        ) : receipt.senderPicture ? (
                          <Image
                            source={{ uri: receipt.senderPicture }}
                            style={styles.receiptAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              styles.receiptAvatar,
                              styles.receiptAvatarPlaceholder
                            ]}
                          >
                            <SSText size="xs" weight="bold">
                              {receipt.senderName?.[0]?.toUpperCase() || '?'}
                            </SSText>
                          </View>
                        )}
                        <SSVStack gap="none" style={{ flex: 1, minWidth: 0 }}>
                          <SSText size="sm" weight="medium">
                            {privacyMode
                              ? NOSTR_PRIVACY_MASK
                              : receipt.senderName ||
                                truncateNpub(
                                  nip19.npubEncode(receipt.senderPubkey),
                                  8
                                )}
                          </SSText>
                          {!privacyMode && receipt.comment ? (
                            <SSText size="xs" color="muted">
                              {receipt.comment}
                            </SSText>
                          ) : null}
                        </SSVStack>
                      </SSHStack>
                    </TouchableOpacity>
                    <SSVStack gap="xxs" style={styles.receiptAmountCol}>
                      {receipt.createdAt > 0 && (
                        <SSText size="xxs" color="muted">
                          {formatNostrCardDate(receipt.createdAt)}
                        </SSText>
                      )}
                      {privacyMode ? (
                        <SSText size="sm" weight="medium" color="white">
                          {NOSTR_PRIVACY_MASK} sats
                        </SSText>
                      ) : (
                        <SSHStack
                          gap="xs"
                          style={{ alignItems: 'baseline', flexWrap: 'wrap' }}
                        >
                          <SSText size="sm" weight="medium" color="white">
                            {receipt.amountSats.toLocaleString()}
                          </SSText>
                          <SSText size="xxs" color="muted">
                            sats
                          </SSText>
                          {btcPrice > 0 && (
                            <>
                              <SSText size="xxs" color="muted">
                                ·
                              </SSText>
                              <SSText size="xxs" color="muted">
                                {formatFiatPrice(receipt.amountSats, btcPrice)}{' '}
                                {fiatCurrency}
                              </SSText>
                            </>
                          )}
                        </SSHStack>
                      )}
                    </SSVStack>
                  </SSHStack>
                ))}
              </SSVStack>
            )}

            {zapReceiptsLoading && (
              <ActivityIndicator
                color={Colors.white}
                size="small"
                style={styles.zapLoader}
              />
            )}

            {!zapReceiptsLoading && zapReceipts.length === 0 && fetched && (
              <SSText size="xs" color="muted" center>
                {t('nostrIdentity.note.noZapsYet')}
              </SSText>
            )}

            {replyParentId && fetched && noteLooksLikeReply(fetched.tags) ? (
              <SSVStack gap="sm" style={styles.replyParentSection}>
                <SSText size="xs" color="muted" uppercase>
                  {t('nostrIdentity.note.replyingTo')}
                </SSText>
                {replyParentLoading ? (
                  <SSHStack gap="sm" style={styles.zapLoadingRow}>
                    <ActivityIndicator color={Colors.white} size="small" />
                    <SSText size="xs" color="muted">
                      {t('nostrIdentity.account.fetchingNote')}
                    </SSText>
                  </SSHStack>
                ) : replyParentMissing ? (
                  <SSText size="xs" color="muted">
                    {t('nostrIdentity.note.parentNotOnRelays')}
                  </SSText>
                ) : replyParentNoteLike && replyParentAuthorFeedProps ? (
                  <SSNostrFeedNoteRow
                    note={replyParentNoteLike}
                    privacyMode={privacyMode}
                    showAuthor
                    expandContent
                    authorPreview={
                      <SSNostrFeedAuthorRow
                        contextNpub={npub || undefined}
                        loading={replyParentAuthorFeedProps.loading}
                        npubBech={replyParentAuthorFeedProps.authorNpubBech}
                        displayName={replyParentAuthorFeedProps.displayName}
                        nip05={replyParentAuthorFeedProps.nip05}
                        pictureUri={replyParentAuthorFeedProps.pictureUri}
                      />
                    }
                    onPress={() => {
                      if (!npub) {
                        return
                      }
                      const uri = nip19.noteEncode(replyParentId)
                      router.navigate(nostrNoteHref(npub, uri))
                    }}
                  />
                ) : replyParentNoteLike ? (
                  <SSNostrFeedNoteRow
                    note={replyParentNoteLike}
                    privacyMode={privacyMode}
                    showAuthor={false}
                    expandContent
                    onPress={() => {
                      if (!npub) {
                        return
                      }
                      const uri = nip19.noteEncode(replyParentId)
                      router.navigate(nostrNoteHref(npub, uri))
                    }}
                  />
                ) : null}
              </SSVStack>
            ) : null}

            {notFound && !fetched && (
              <SSVStack itemsCenter gap="md" style={styles.notFoundCard}>
                <SSText color="muted">
                  {t('nostrIdentity.note.notFoundOnYourRelays')}
                </SSText>
                <SSText size="xs" type="mono" color="muted">
                  {truncateNpub(decoded.raw, 16)}
                </SSText>

                {relayHints && relayHints.length > 0 && !triedHints && (
                  <SSVStack gap="xs" style={styles.retrySection}>
                    <SSText size="xs" color="muted" center>
                      {t('nostrIdentity.note.hintedRelaysAvailable')}
                    </SSText>
                    {relayHints.map((url) => (
                      <SSText
                        key={url}
                        size="xxs"
                        type="mono"
                        color="muted"
                        center
                      >
                        {url}
                      </SSText>
                    ))}
                    <SSButton
                      label={t('nostrIdentity.note.tryHintedRelays')}
                      variant="outline"
                      onPress={handleTryHintedRelays}
                    />
                  </SSVStack>
                )}

                {!triedBroadSearch && (
                  <SSButton
                    label={t('nostrIdentity.note.searchMoreRelays')}
                    variant="ghost"
                    onPress={handleBroadSearch}
                  />
                )}

                {triedBroadSearch && (
                  <SSText size="xs" color="muted" center>
                    {t('nostrIdentity.note.exhaustedRelays')}
                  </SSText>
                )}
              </SSVStack>
            )}
          </SSVStack>
        </ScrollView>
      )}

      <SSPaymentMethodPicker
        ref={paymentSheetRef}
        onSelect={(method) => navigateToPayment(method)}
        methods={availablePaymentMethods}
        amountSats={payAmount}
      />

      <SSBottomSheet
        ref={zapSheetRef}
        title={t('nostrIdentity.note.zapChooseAmount')}
      >
        <SSVStack gap="sm" style={styles.sheetContent}>
          <SSHStack gap="sm">
            {zapPresets.map((sats) => (
              <SSButton
                key={sats}
                label={privacyMode ? NOSTR_PRIVACY_MASK : sats.toLocaleString()}
                variant="outline"
                onPress={() => handleSheetAmountSelected(sats)}
                style={{ flex: 1 }}
              />
            ))}
          </SSHStack>
          <TextInput
            style={styles.customInput}
            placeholderTextColor={Colors.gray[500]}
            placeholder={t('nostrIdentity.note.customAmount')}
            keyboardType="number-pad"
            value={sheetCustomAmount}
            onChangeText={setSheetCustomAmount}
            returnKeyType="next"
          />
          <TextInput
            style={styles.customInput}
            placeholderTextColor={Colors.gray[500]}
            placeholder={t('nostrIdentity.note.zapCommentPlaceholder')}
            value={sheetZapComment}
            onChangeText={setSheetZapComment}
            returnKeyType="done"
            onSubmitEditing={handleSheetCustomSubmit}
          />
          <SSButton
            label={
              sheetCustomAmount && parseInt(sheetCustomAmount, 10) > 0
                ? `${t('nostrIdentity.note.zap')} ${privacyMode ? NOSTR_PRIVACY_MASK : parseInt(sheetCustomAmount, 10).toLocaleString()} sats`
                : t('nostrIdentity.note.zap')
            }
            variant="gradient"
            gradientType="special"
            disabled={
              !sheetCustomAmount || parseInt(sheetCustomAmount, 10) <= 0
            }
            onPress={handleSheetCustomSubmit}
          />
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => zapSheetRef.current?.close()}
          />
        </SSVStack>
      </SSBottomSheet>

    </SSMainLayout>
  )
}

function deriveNoteItemForFeed(
  fetched: FetchedNoteData | null,
  decoded: DecodedNostrContent | null
): NostrFeedNoteLike | null {
  if (!fetched || !decoded) {
    return null
  }
  if (decoded.kind !== 'note' && decoded.kind !== 'nevent') {
    return null
  }
  if (typeof decoded.data !== 'string' || !decoded.data) {
    return null
  }
  return {
    content: fetched.content,
    created_at: fetched.created_at,
    id: decoded.data,
    kind: fetched.kind,
    pubkey: fetched.pubkey,
    tags: fetched.tags
  }
}

function deriveAuthorFeedProps(
  noteData: FetchedNoteData | null,
  identity:
    | { displayName?: string; picture?: string; nip05?: string }
    | undefined,
  npub: string | undefined,
  privacyMode: boolean,
  loading: boolean
) {
  if (!noteData?.pubkey || privacyMode) {
    return null
  }
  const authorNpubBech = nip19.npubEncode(noteData.pubkey)
  const isSelf = authorNpubBech === npub
  const hasIdentityFallback = Boolean(
    isSelf &&
    identity &&
    (identity.displayName?.trim() ||
      identity.picture?.trim() ||
      identity.nip05?.trim())
  )
  return {
    authorNpubBech,
    displayName:
      noteData.authorName?.trim() ||
      (isSelf ? (identity?.displayName?.trim() ?? '') : ''),
    loading: loading && !hasIdentityFallback,
    nip05:
      noteData.authorNip05?.trim() ||
      (isSelf ? (identity?.nip05?.trim() ?? '') : ''),
    pictureUri:
      noteData.authorPicture?.trim() ||
      (isSelf ? identity?.picture?.trim() : '') ||
      '' ||
      undefined
  }
}

const styles = StyleSheet.create({
  authorAvatar: {
    borderRadius: 24,
    height: 48,
    width: 48
  },
  authorAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  authorRow: {
    alignItems: 'center'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 60
  },
  completeBadge: {
    backgroundColor: Colors.gray[800],
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  content: {
    paddingBottom: 40
  },
  customInput: {
    backgroundColor: '#242424',
    borderRadius: 3,
    color: Colors.white,
    fontSize: 16,
    padding: 12
  },
  goalHeader: {
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  jsonText: {
    color: Colors.gray[300],
    lineHeight: 18
  },
  kindBadge: {
    backgroundColor: Colors.gray[800],
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  metaLabel: {
    flexShrink: 0,
    width: 44
  },
  metaRow: {
    alignItems: 'center'
  },
  metaToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    width: '100%'
  },
  metaValue: {
    flex: 1,
    minWidth: 0
  },
  tagTypeBadge: {
    backgroundColor: Colors.gray[800],
    borderRadius: 3,
    flexShrink: 0,
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  notFoundCard: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 5,
    borderWidth: 1,
    padding: 24
  },
  noteCard: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    padding: 16,
    position: 'relative'
  },
  noteImagesBelowText: {
    marginTop: 12
  },
  noteImagesNoText: {
    marginTop: 0
  },
  noteReplyTag: {
    backgroundColor: Colors.gray[800],
    borderColor: Colors.gray[700],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 1
  },
  noteReplyTagText: {
    letterSpacing: 0.5
  },
  noteText: {
    color: Colors.white,
    fontSize: 15,
    lineHeight: 22
  },
  noteTextWithReplyTag: {
    paddingRight: 44
  },
  oneTapButton: {
    alignItems: 'center',
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[700],
    borderRadius: 3,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  presetButton: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10
  },
  presetRow: {
    justifyContent: 'space-between'
  },
  progressFill: {
    backgroundColor: Colors.white,
    borderRadius: 2,
    height: '100%'
  },
  progressTrack: {
    backgroundColor: Colors.gray[800],
    borderRadius: 2,
    height: 4,
    overflow: 'hidden',
    width: '100%'
  },
  zapLoader: {
    marginVertical: 8
  },
  zapSortHeader: {
    alignItems: 'center'
  },
  receiptAmountCol: {
    alignItems: 'flex-end'
  },
  receiptAvatar: {
    borderRadius: 16,
    height: 32,
    width: 32
  },
  receiptAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  receiptRow: {
    alignItems: 'center',
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    paddingBottom: 16,
    paddingHorizontal: 12,
    paddingTop: 8
  },
  receiptSenderHit: {
    flex: 1,
    minWidth: 0
  },
  receiptSenderInner: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0
  },
  replyParentSection: {
    borderColor: Colors.gray[800],
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 16
  },
  retrySection: {
    width: '100%'
  },
  sheetContent: {
    paddingBottom: 24
  },
  zapButton: {
    minWidth: 90
  },
  zapLoadingRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8
  },
  zapRow: {
    alignItems: 'center',
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    paddingBottom: 16,
    paddingHorizontal: 14,
    paddingTop: 8
  }
})
