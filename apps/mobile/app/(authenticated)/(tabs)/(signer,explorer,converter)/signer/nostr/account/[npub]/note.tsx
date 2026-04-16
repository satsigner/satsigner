import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import SSButton from '@/components/SSButton'
import {
  SSNostrFeedAuthorRow,
  SSNostrFeedNoteRow,
  type NostrFeedNoteLike
} from '@/components/SSNostrFeedNoteRow'
import SSNoteInlineImages from '@/components/SSNoteInlineImages'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSPaymentMethodPicker, {
  type PaymentMethod
} from '@/components/SSPaymentMethodPicker'
import SSText from '@/components/SSText'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useLightningStore } from '@/store/lightning'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { useZapFlowStore } from '@/store/zapFlow'
import { Colors } from '@/styles'
import { formatNostrCardDate } from '@/utils/format'
import {
  type FetchedNoteData,
  decodeNostrContent,
  extractEnhancedZapTags,
  extractPubpayTags,
  truncateNpub
} from '@/utils/nostrIdentity'
import { extractImageUrlsFromNote } from '@/utils/nostrNoteMedia'
import { noteLooksLikeReply } from '@/utils/nostrNoteThread'
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

const ZAP_PRESETS = [21, 100, 500, 1000]

export default function NostrNotePage() {
  const router = useRouter()
  const { npub, nostrUri } = useLocalSearchParams<NoteParams>()

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
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false)
  const [payAmount, setPayAmount] = useState(0)
  const [customAmount, setCustomAmount] = useState('')
  const [zapLoading, setZapLoading] = useState(false)
  const [zapReceipts, setZapReceipts] = useState<ZapReceiptInfo[]>([])
  const fetchedRef = useRef(false)
  const pendingInvoiceRef = useRef<{ invoice: string; zapRequestJson: string } | null>(null)

  const lightningConfig = useLightningStore((state) => state.config)
  const { mints } = useEcash()

  const pendingZap = useZapFlowStore((state) => state.pendingZap)
  const zapResult = useZapFlowStore((state) => state.zapResult)
  const clearPendingZap = useZapFlowStore((state) => state.clearPendingZap)
  const setZapResult = useZapFlowStore((state) => state.setZapResult)
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const decoded = useMemo(() => {
    if (!nostrUri) return null
    return decodeNostrContent(nostrUri)
  }, [nostrUri])

  const availablePaymentMethods = useMemo(() => {
    const methods: PaymentMethod[] = []
    if (lightningConfig) {
      methods.push({
        id: 'lightning',
        label: 'Lightning',
        type: 'lightning',
        detail: lightningConfig.url
      })
    }
    if (mints.length > 0) {
      for (const mint of mints) {
        methods.push({
          id: `ecash-${mint.url}`,
          label: 'ECash',
          type: 'ecash',
          detail: mint.name || mint.url
        })
      }
    }
    return methods
  }, [lightningConfig, mints])

  const loadZapReceipts = useCallback(
    async (eventIdHex: string) => {
      try {
        const receipts = await fetchZapReceipts(eventIdHex, effectiveRelays)
        setZapReceipts(receipts)
        await enrichZapReceipts(receipts, effectiveRelays)
        setZapReceipts([...receipts])
      } catch {
        // non-critical
      }
    },
    [effectiveRelays]
  )

  const relayHints = useMemo(() => {
    if (!decoded) return undefined
    if (
      decoded.kind === 'nevent' &&
      Array.isArray(decoded.metadata?.relays) &&
      (decoded.metadata.relays as string[]).length > 0
    ) {
      return decoded.metadata.relays as string[]
    }
    return undefined
  }, [decoded])

  const handleEventFound = useCallback(
    (event: {
      content: string
      pubkey: string
      kind: number
      tags: string[][]
      created_at: number
    }) => {
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
      const profileApi = new NostrAPI(effectiveRelays)
      profileApi
        .fetchKind0(authorNpub)
        .then((profile) => {
          if (!profile) {
            setProfileLoading(false)
            return
          }
          setFetched((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              authorName: profile.displayName,
              authorPicture: profile.picture,
              authorLud16: profile.lud16,
              authorNip05: profile.nip05
            }
          })
          setProfileLoading(false)
        })
        .catch(() => {
          setProfileLoading(false)
        })
    },
    [decoded, effectiveRelays, loadZapReceipts]
  )

  useEffect(() => {
    if (!decoded || fetchedRef.current) return
    if (
      decoded.kind !== 'note' &&
      decoded.kind !== 'nevent' &&
      decoded.kind !== 'json_note'
    )
      return

    fetchedRef.current = true

    console.log('[NotePage] decoded:', decoded.kind, 'data:', decoded.data, 'metadata:', decoded.metadata)
    console.log('[NotePage] effectiveRelays:', effectiveRelays)
    console.log('[NotePage] relayHints:', relayHints)

    if (decoded.kind === 'json_note' && decoded.metadata) {
      setFetched({
        content:
          typeof decoded.metadata.content === 'string'
            ? decoded.metadata.content
            : '',
        created_at: 0,
        kind:
          typeof decoded.metadata.kind === 'number'
            ? decoded.metadata.kind
            : 1,
        pubkey: '',
        tags: Array.isArray(decoded.metadata.tags)
          ? (decoded.metadata.tags as string[][])
          : []
      })
      setIsLoading(false)
      setProfileLoading(false)
      return
    }

    const api = new NostrAPI(effectiveRelays)
    console.log('[NotePage] calling fetchEvent with id:', decoded.data)
    api
      .fetchEvent(decoded.data)
      .then((event) => {
        console.log('[NotePage] fetchEvent returned:', event ? 'FOUND' : 'NOT FOUND')
        if (!event) {
          setIsLoading(false)
          setProfileLoading(false)
          setNotFound(true)
          return
        }
        handleEventFound(event)
      })
      .catch((err) => {
        console.log('[NotePage] fetchEvent ERROR:', err)
        setIsLoading(false)
        setProfileLoading(false)
        setNotFound(true)
      })
  }, [decoded, effectiveRelays, handleEventFound])

  async function handleTryHintedRelays() {
    if (!decoded?.data || !relayHints?.length) return
    setIsLoading(true)
    setNotFound(false)
    setTriedHints(true)
    try {
      const event = await NostrAPI.fetchEventFromRelays(
        decoded.data,
        relayHints
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
    if (!decoded?.data) return
    const alreadyTried = new Set([
      ...effectiveRelays,
      ...(relayHints ?? [])
    ])
    const searchRelays = NostrAPI.INDEXING_RELAYS.filter(
      (url) => !alreadyTried.has(url)
    )
    if (searchRelays.length === 0) return

    setIsLoading(true)
    setNotFound(false)
    setTriedBroadSearch(true)
    try {
      const event = await NostrAPI.fetchEventFromRelays(
        decoded.data,
        searchRelays
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

  const pubpayTags = useMemo(
    () => extractPubpayTags(fetched?.tags ?? []),
    [fetched]
  )

  const enhancedZap = useMemo(
    () => extractEnhancedZapTags(fetched?.tags ?? []),
    [fetched]
  )

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

  const totalZapped = useMemo(
    () => zapReceipts.reduce((sum, r) => sum + r.amountSats, 0),
    [zapReceipts]
  )

  const noteImageUrls = useMemo(() => {
    if (!fetched || privacyMode) return []
    return extractImageUrlsFromNote(fetched.content, fetched.tags)
  }, [fetched, privacyMode])

  const noteItemForFeed = useMemo((): NostrFeedNoteLike | null => {
    if (!fetched || !decoded) return null
    if (decoded.kind !== 'note' && decoded.kind !== 'nevent') return null
    if (typeof decoded.data !== 'string' || !decoded.data) return null
    return {
      id: decoded.data,
      content: fetched.content,
      pubkey: fetched.pubkey,
      kind: fetched.kind,
      tags: fetched.tags,
      created_at: fetched.created_at
    }
  }, [fetched, decoded])

  const isOwnNote = useMemo(() => {
    if (!fetched?.pubkey || !npub) return false
    try {
      return nip19.npubEncode(fetched.pubkey) === npub
    } catch {
      return false
    }
  }, [fetched, npub])

  const goalProgress =
    enhancedZap.zapGoal && enhancedZap.zapGoal > 0
      ? Math.min(totalZapped / enhancedZap.zapGoal, 1)
      : undefined

  const usesRemaining =
    enhancedZap.zapUses !== undefined
      ? Math.max(0, enhancedZap.zapUses - zapReceipts.length)
      : undefined

  const isRequestComplete =
    (goalProgress !== undefined && goalProgress >= 1) ||
    (usesRemaining !== undefined && usesRemaining <= 0)

  async function handleZap(amountSats: number) {
    if (!amountSats || amountSats <= 0) return
    if (availablePaymentMethods.length === 0) return

    if (!effectiveLud16) {
      toast.error(t('nostrIdentity.note.zapEndpointNotFound'))
      return
    }

    if (!identity?.nsec) {
      toast.error(t('nostrIdentity.error.missingKeys'))
      return
    }

    if (!fetched) return

    setZapLoading(true)
    try {
      const { invoice, zapRequestJson } = await initiateZap({
        recipientLud16: effectiveLud16,
        recipientPubkeyHex: fetched.pubkey,
        senderNsec: identity.nsec,
        eventIdHex: decoded?.data,
        eventKind: fetched.kind,
        eventTags: fetched.tags,
        amountSats,
        relays: effectiveRelays
      })

      setZapLoading(false)
      pendingInvoiceRef.current = { invoice, zapRequestJson }

      if (availablePaymentMethods.length === 1) {
        navigateToPayment(availablePaymentMethods[0], invoice, zapRequestJson, amountSats)
        return
      }

      setPayAmount(amountSats)
      setPaymentPickerVisible(true)
    } catch (err) {
      setZapLoading(false)
      const message =
        err instanceof Error ? err.message : t('nostrIdentity.note.zapFailed')
      toast.error(message)
    }
  }

  function navigateToPayment(
    method: PaymentMethod,
    invoice?: string,
    zapRequestJson?: string,
    amountSats?: number
  ) {
    setPaymentPickerVisible(false)

    const pending = pendingInvoiceRef.current
    const bolt11 = invoice || pending?.invoice
    const reqJson = zapRequestJson || pending?.zapRequestJson || ''
    const sats = amountSats ?? payAmount
    pendingInvoiceRef.current = null

    if (bolt11 && npub && nostrUri) {
      useZapFlowStore.getState().setPendingZap({
        noteNpub: npub,
        nostrUri,
        invoice: bolt11,
        amountSats: sats,
        zapRequestJson: reqJson,
        paymentMethod: method
      })
    }

    if (method.type === 'lightning') {
      router.navigate({
        pathname: '/signer/lightning/pay',
        params: bolt11 ? { invoice: bolt11 } : undefined
      })
    } else if (method.type === 'ecash') {
      router.navigate({
        pathname: '/signer/ecash/send',
        params: bolt11 ? { invoice: bolt11 } : undefined
      })
    } else if (method.type === 'ark') {
      toast.info(t('nostrIdentity.note.arkComingSoon'))
    }
  }

  function handleAmountSelected(sats: number) {
    setCustomAmount('')
    handleZap(sats)
  }

  function handleCustomAmountSubmit() {
    const sats = parseInt(customAmount, 10)
    if (!sats || sats <= 0) return
    handleZap(sats)
  }

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
          <SSVStack gap="lg" style={styles.content}>
            {!noteItemForFeed && fetched?.pubkey ? (
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
                    <SSText size="md" weight="medium">
                      {fetched.authorName}
                    </SSText>
                  )}
                  {privacyMode && (
                    <SSText size="md" weight="medium">
                      {NOSTR_PRIVACY_MASK}
                    </SSText>
                  )}
                  <SSText size="xs" color="muted" type="mono">
                    {truncateNpub(
                      nip19.npubEncode(fetched.pubkey),
                      12
                    )}
                  </SSText>
                </SSVStack>
              </SSHStack>
            ) : null}

            {fetched ? (
              <SSHStack gap="sm">
                <View style={styles.kindBadge}>
                  <SSText size="xs">Kind {fetched.kind}</SSText>
                </View>
              </SSHStack>
            ) : null}

            {noteItemForFeed &&
            fetched &&
            (fetched.content.length > 0 || noteImageUrls.length > 0) ? (
              <SSNostrFeedNoteRow
                note={noteItemForFeed}
                privacyMode={privacyMode}
                showAuthor={!isOwnNote}
                showNoteNipIds={isOwnNote}
                expandContent
                authorPreview={
                  !isOwnNote && !privacyMode && fetched.pubkey ? (
                    <SSNostrFeedAuthorRow
                      loading={profileLoading}
                      npubBech={nip19.npubEncode(fetched.pubkey)}
                      displayName={fetched.authorName?.trim() ?? ''}
                      nip05={fetched.authorNip05?.trim() ?? ''}
                      pictureUri={fetched.authorPicture?.trim()}
                    />
                  ) : undefined
                }
              />
            ) : null}

            {!noteItemForFeed &&
              fetched &&
              (fetched.content.length > 0 || noteImageUrls.length > 0) ? (
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
                </View>
              ) : null}

            <SSVStack gap="xs">
              <SSText size="xs" color="muted" uppercase>
                {t('nostrIdentity.note.noteId')}
              </SSText>
              <SSClipboardCopy text={nostrUri || decoded.raw}>
                <SSText size="xs" type="mono" color="muted">
                  {truncateNpub(decoded.raw, 16)}
                </SSText>
              </SSClipboardCopy>
            </SSVStack>

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
                      <View style={styles.completeBadge}>
                        <SSText size="sm" weight="bold" center>
                          {t('nostrIdentity.note.requestComplete')}
                        </SSText>
                      </View>
                    )}

                    {enhancedZap.zapGoal !== undefined && (
                      <SSVStack gap="xs">
                        <SSHStack
                          gap="sm"
                          style={styles.goalHeader}
                        >
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
                        <SSText size="xs" weight="medium">
                          {privacyMode
                            ? `${NOSTR_PRIVACY_MASK} / ${NOSTR_PRIVACY_MASK}`
                            : `${zapReceipts.length} / ${enhancedZap.zapUses}`}
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
                        label={`${t('nostrIdentity.note.zap')} ${privacyMode ? NOSTR_PRIVACY_MASK : enhancedZap.zapMin} sats`}
                        variant="gradient"
                        gradientType="special"
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
                                min: NOSTR_PRIVACY_MASK,
                                max: NOSTR_PRIVACY_MASK
                              })
                            : t('nostrIdentity.note.rangeHint', {
                                min: enhancedZap.zapMin!.toLocaleString(),
                                max: enhancedZap.zapMax!.toLocaleString()
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
                                {privacyMode ? NOSTR_PRIVACY_MASK : sats.toLocaleString()}
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
                              ? `${t('nostrIdentity.note.zap')} ${privacyMode ? NOSTR_PRIVACY_MASK : customAmount} sats`
                              : t('nostrIdentity.note.zap')
                          }
                          variant="gradient"
                          gradientType="special"
                          disabled={
                            zapLoading ||
                            !effectiveLud16 ||
                            !customAmount ||
                            parseInt(customAmount, 10) < (enhancedZap.zapMin ?? 1) ||
                            parseInt(customAmount, 10) > (enhancedZap.zapMax ?? Infinity)
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
                              variant="gradient"
                              gradientType="special"
                              disabled={
                                zapLoading || !effectiveLud16
                              }
                              onPress={() =>
                                handleAmountSelected(tag.amount)
                              }
                              style={styles.zapButton}
                            />
                          </SSHStack>
                        ))}
                      </SSVStack>
                    )}

                    {!isRequestComplete && (
                      <SSVStack gap="sm">
                        <SSText size="xs" color="muted" uppercase>
                          {hasEnhancedZapTags && !isRangeAmount
                            ? t('nostrIdentity.note.customZap')
                            : !hasEnhancedZapTags
                              ? t('nostrIdentity.note.zapAmount')
                              : ''}
                        </SSText>

                        {!hasEnhancedZapTags && (
                          <SSHStack gap="sm" style={styles.presetRow}>
                            {ZAP_PRESETS.map((sats) => (
                              <TouchableOpacity
                                key={sats}
                                style={styles.presetButton}
                                disabled={
                                  zapLoading || !effectiveLud16
                                }
                                onPress={() =>
                                  handleAmountSelected(sats)
                                }
                                activeOpacity={0.6}
                              >
                                <SSText size="sm" weight="medium" center>
                                  {privacyMode ? NOSTR_PRIVACY_MASK : sats}
                                </SSText>
                              </TouchableOpacity>
                            ))}
                          </SSHStack>
                        )}

                        {!isRangeAmount && (
                          <>
                            <TextInput
                              style={styles.customInput}
                              placeholderTextColor={Colors.gray[500]}
                              placeholder={t(
                                'nostrIdentity.note.customAmount'
                              )}
                              keyboardType="number-pad"
                              value={customAmount}
                              onChangeText={setCustomAmount}
                              returnKeyType="done"
                              editable={!!effectiveLud16}
                              onSubmitEditing={handleCustomAmountSubmit}
                            />
                            <SSButton
                              label={
                                customAmount &&
                                parseInt(customAmount, 10) > 0
                                  ? `${t('nostrIdentity.note.zap')} ${privacyMode ? NOSTR_PRIVACY_MASK : customAmount} sats`
                                  : t('nostrIdentity.note.zap')
                              }
                              variant="gradient"
                              gradientType="special"
                              disabled={
                                zapLoading ||
                                !effectiveLud16 ||
                                !customAmount ||
                                parseInt(customAmount, 10) <= 0
                              }
                              onPress={handleCustomAmountSubmit}
                            />
                          </>
                        )}

                        {!effectiveLud16 && (
                          <SSText size="xs" color="muted" center>
                            {t('nostrIdentity.note.zapEndpointNotFound')}
                          </SSText>
                        )}
                      </SSVStack>
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
                <SSText size="xs" color="muted" uppercase>
                  {t('nostrIdentity.note.zapReceipts')} ({zapReceipts.length})
                </SSText>
                {zapReceipts.map((receipt) => (
                  <SSHStack key={receipt.id} gap="sm" style={styles.receiptRow}>
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
                    <SSVStack gap="none" style={{ flex: 1 }}>
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
                    <SSVStack gap="none" style={styles.receiptAmountCol}>
                      <SSText size="sm" weight="bold" color="white">
                        {privacyMode
                          ? `${NOSTR_PRIVACY_MASK} sats`
                          : `${receipt.amountSats} sats`}
                      </SSText>
                      {receipt.createdAt > 0 && (
                        <SSText size="xxs" color="muted">
                          {formatNostrCardDate(receipt.createdAt)}
                        </SSText>
                      )}
                    </SSVStack>
                  </SSHStack>
                ))}
              </SSVStack>
            )}

            {zapReceipts.length === 0 && fetched && (
              <SSText size="xs" color="muted" center>
                {t('nostrIdentity.note.noZapsYet')}
              </SSText>
            )}

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
                      <SSText key={url} size="xxs" type="mono" color="muted" center>
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
        visible={paymentPickerVisible}
        onClose={() => setPaymentPickerVisible(false)}
        onSelect={(method) => navigateToPayment(method)}
        methods={availablePaymentMethods}
        amountSats={payAmount}
      />
    </SSMainLayout>
  )
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
  kindBadge: {
    backgroundColor: Colors.gray[800],
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  noteCard: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 5,
    borderWidth: 1,
    padding: 16,
    position: 'relative'
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
  noteImagesBelowText: {
    marginTop: 12
  },
  noteImagesNoText: {
    marginTop: 0
  },
  noteText: {
    color: Colors.white,
    fontSize: 15,
    lineHeight: 22
  },
  noteTextWithReplyTag: {
    paddingRight: 44
  },
  notFoundCard: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 5,
    borderWidth: 1,
    padding: 24
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
  receiptAmountCol: {
    alignItems: 'flex-end'
  },
  retrySection: {
    width: '100%'
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
