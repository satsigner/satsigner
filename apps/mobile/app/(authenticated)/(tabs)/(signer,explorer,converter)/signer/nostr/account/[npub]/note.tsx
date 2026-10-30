import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'
import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import SSIconBookmark from '@/components/icons/SSIconBookmark'
import SSIconCheckCircleThin from '@/components/icons/SSIconCheckCircleThin'
import SSIconChevronDown from '@/components/icons/SSIconChevronDown'
import SSIconChevronUp from '@/components/icons/SSIconChevronUp'
import SSIconCircleXThin from '@/components/icons/SSIconCircleXThin'
import SSIconQR from '@/components/icons/SSIconQR'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSIconButton from '@/components/SSIconButton'
import SSMarkdown from '@/components/SSMarkdown'
import SSModal from '@/components/SSModal'
import {
  SSNostrFeedAuthorRow,
  SSNostrFeedNoteRow
} from '@/components/SSNostrFeedNoteRow'
import SSNostrNoteActions from '@/components/SSNostrNoteActions'
import SSNostrPollOptions from '@/components/SSNostrPollOptions'
import SSNostrSourceBanner from '@/components/SSNostrSourceBanner'
import SSNostrZapSheets from '@/components/SSNostrZapSheets'
import SSNoteInlineImages from '@/components/SSNoteInlineImages'
import SSNoteInlineVideos from '@/components/SSNoteInlineVideos'
import SSPressable from '@/components/SSPressable'
import SSShareableQR from '@/components/SSShareableQR'
import SSText from '@/components/SSText'
import SSZapAmountDisplay from '@/components/SSZapAmountDisplay'
import {
  NOSTR_PRIVACY_MASK,
  NOSTR_PROFILE_QUERY_STALE_TIME_MS,
  NOSTR_RELAYS
} from '@/constants/nostr'
import { useNostrContactProfile } from '@/hooks/useNostrContactProfile'
import { useNostrNoteEngagement } from '@/hooks/useNostrNoteEngagement'
import {
  useNostrNoteFetch,
  useNostrNoteLookupFetch
} from '@/hooks/useNostrNoteFetch'
import { useNostrNoteZapsFetch } from '@/hooks/useNostrNoteZapsFetch'
import { useNostrPollVote } from '@/hooks/useNostrPollVote'
import { useNostrProfilesFetch } from '@/hooks/useNostrProfilesFetch'
import { useNostrZapFlow } from '@/hooks/useNostrZapFlow'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useNostrProfilesStore } from '@/store/nostrProfiles'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import type {
  NostrDecodedContent,
  NostrFetchedNoteData,
  NostrFeedNoteLike,
  ZapReceiptInfo,
  ZapSortField
} from '@/types/models/Nostr'
import { formatNostrCardDate, formatNpub } from '@/utils/format'
import { getPubKeyHexFromNpub, validateNip05 } from '@/utils/nostr'
import { getDecodedContentRelays } from '@/utils/nostrDecodedContent'
import {
  getNostrErrorCode,
  getNostrErrorMessage
} from '@/utils/nostrErrorMessage'
import {
  decodeNostrContent,
  extractEnhancedZapTags,
  extractPubpayTags
} from '@/utils/nostrIdentity'
import { isLongFormNostrKind } from '@/utils/nostrLongForm'
import { nostrAuthorProfileHref, nostrNoteHref } from '@/utils/nostrNavigation'
import {
  getJsonNoteData,
  type NostrNoteEvent,
  withAuthorProfile
} from '@/utils/nostrNoteDetail'
import { extractImageUrlsFromNote } from '@/utils/nostrNoteMedia'
import { extractMentionPubkeys } from '@/utils/nostrNoteMentions'
import { getResolvedEventId } from '@/utils/nostrNoteQuotes'
import {
  getRelayHintForEventId,
  getReplyParentEventIdHex,
  noteLooksLikeReply
} from '@/utils/nostrNoteThread'
import { extractVideoEmbedsFromNote } from '@/utils/nostrNoteVideoUrls'
import { extractPollInfo, isPollExpired } from '@/utils/nostrPoll'
import {
  applyZapProfiles,
  countQualifyingZaps,
  sortZapReceipts
} from '@/utils/nostrZap'

const NO_ZAP_RECEIPTS: ZapReceiptInfo[] = []
const NO_PUBKEYS: string[] = []

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
    router.navigate(nostrAuthorProfileHref(npub, authorNpubBech))
  }

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const effectiveRelays = identity?.relays ?? globalRelays

  const [manualEvent, setManualEvent] = useState<NostrNoteEvent | null>(null)
  const [manualSearching, setManualSearching] = useState(false)
  const [triedHints, setTriedHints] = useState(false)
  const [triedBroadSearch, setTriedBroadSearch] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [showJson, setShowJson] = useState(false)
  const [showMeta, setShowMeta] = useState(true)
  const [formatMarkdownByNoteId, setFormatMarkdownByNoteId] = useState<
    Record<string, boolean>
  >({})
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [zapSortField, setZapSortField] = useState<ZapSortField>('date')
  const [zapSortAsc, setZapSortAsc] = useState(false)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [bookmarkModalVisible, setBookmarkModalVisible] = useState(false)
  const [deletionModalVisible, setDeletionModalVisible] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const btcPrice = usePriceStore((state) => state.btcPrice)
  const fiatCurrency = usePriceStore((state) => state.fiatCurrency)

  const decoded = nostrUri ? decodeNostrContent(nostrUri) : null

  const ownPubkeyHex = getPubKeyHexFromNpub(npub ?? '') ?? ''
  const [ownPubkeys] = useState<string[]>(() =>
    ownPubkeyHex ? [ownPubkeyHex] : []
  )

  const relayHints =
    decoded?.kind === 'nevent' ? getDecodedContentRelays(decoded) : undefined

  const noteEventId =
    decoded?.kind === 'note' || decoded?.kind === 'nevent' ? decoded.data : ''
  const noteQuery = useNostrNoteFetch({
    eventId: noteEventId,
    ownPubkeys,
    relays: effectiveRelays
  })
  const noteEvent = manualEvent ?? noteQuery.data ?? null
  const authorNpub = noteEvent?.pubkey
    ? nip19.npubEncode(noteEvent.pubkey)
    : undefined
  const authorProfileQuery = useNostrContactProfile(
    authorNpub,
    effectiveRelays,
    Boolean(noteEvent)
  )
  const fetched =
    getJsonNoteData(decoded) ??
    withAuthorProfile(noteEvent, authorProfileQuery.data)
  const isLoading = noteQuery.isLoading || manualSearching
  const profileLoading = Boolean(noteEvent) && authorProfileQuery.isLoading
  const noteRelayError = noteQuery.isError
    ? getNostrErrorCode(noteQuery.error)
    : undefined
  const notFound =
    !fetched && !isLoading && (noteQuery.isSuccess || noteQuery.isError)

  const authorNip05 = fetched?.authorNip05
  const { data: nip05ValidResult } = useQuery({
    enabled: Boolean(noteEvent?.pubkey && authorNip05),
    queryFn: () => validateNip05(noteEvent?.pubkey ?? '', authorNip05 ?? ''),
    queryKey: ['nostr', 'nip05-valid', authorNpub, authorNip05],
    staleTime: NOSTR_PROFILE_QUERY_STALE_TIME_MS
  })
  const nip05Valid = nip05ValidResult ?? null

  const zapsQuery = useNostrNoteZapsFetch({
    enabled: Boolean(noteEvent),
    eventId: noteEventId,
    ownPubkeys,
    relays: effectiveRelays
  })
  const storeProfiles = useNostrProfilesStore((state) => state.profiles)
  const zapReceipts = (zapsQuery.data?.data ?? NO_ZAP_RECEIPTS).map((receipt) =>
    applyZapProfiles(receipt, (pk) => storeProfiles[pk.toLowerCase()])
  )
  const zapReceiptsLoading = zapsQuery.isLoading
  const zapFlow = useNostrZapFlow({
    identity,
    npub: npub ?? '',
    onZapSuccess: () => {
      void zapsQuery.refetch()
    },
    relays: effectiveRelays
  })

  const quotedEventId = noteEvent
    ? (getResolvedEventId({ ...noteEvent, id: noteEventId }) ?? '')
    : ''
  const quotedQuery = useNostrNoteLookupFetch({
    eventId: quotedEventId,
    fallbackRelaySets: [NostrAPI.INDEXING_RELAYS],
    ownPubkeys,
    relays: effectiveRelays
  })
  const quotedNote: NostrFeedNoteLike | null = quotedQuery.data
    ? { ...quotedQuery.data, id: quotedEventId }
    : null
  const { data: quotedNoteProfile } = useNostrContactProfile(
    quotedNote ? nip19.npubEncode(quotedNote.pubkey) : undefined,
    effectiveRelays,
    Boolean(quotedNote)
  )

  const mentionProfiles = useNostrProfilesFetch(
    noteEvent ? extractMentionPubkeys(noteEvent.content) : NO_PUBKEYS,
    effectiveRelays
  )

  async function searchRelaysForNote(searchRelays: string[]) {
    if (!noteEventId) {
      return null
    }
    setManualSearching(true)
    try {
      const event = await NostrAPI.fetchEventFromRelays(
        noteEventId,
        searchRelays,
        ownPubkeys
      ).catch(() => null)
      if (event) {
        setManualEvent(event)
      }
      return event
    } finally {
      setManualSearching(false)
    }
  }

  async function handleTryHintedRelays() {
    if (!relayHints?.length) {
      return
    }
    setTriedHints(true)
    await searchRelaysForNote(relayHints)
  }

  async function handleBroadSearch() {
    const alreadyTried = new Set([...effectiveRelays, ...(relayHints ?? [])])
    const searchRelays = NostrAPI.INDEXING_RELAYS.filter(
      (url) => !alreadyTried.has(url)
    )
    if (searchRelays.length === 0) {
      return
    }
    setTriedBroadSearch(true)
    const event = await searchRelaysForNote(searchRelays)
    if (!event) {
      toast.error(t('nostrIdentity.account.eventNotFound'))
    }
  }

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

  const replyParentQuery = useNostrNoteLookupFetch({
    eventId: replyParentId ?? '',
    fallbackRelaySets: replyParentRelayHint
      ? [[replyParentRelayHint], NostrAPI.INDEXING_RELAYS]
      : [NostrAPI.INDEXING_RELAYS],
    ownPubkeys,
    relays: effectiveRelays
  })
  const replyParentEvent = replyParentId ? replyParentQuery.data : null
  const replyParentProfileQuery = useNostrContactProfile(
    replyParentEvent ? nip19.npubEncode(replyParentEvent.pubkey) : undefined,
    effectiveRelays,
    Boolean(replyParentEvent)
  )
  const replyParent = withAuthorProfile(
    replyParentEvent,
    replyParentProfileQuery.data
  )
  const replyParentLoading =
    Boolean(replyParentId) && replyParentQuery.isLoading
  const replyParentMissing =
    Boolean(replyParentId) && !replyParentQuery.isLoading && !replyParentEvent
  const replyParentKind0Pending =
    Boolean(replyParentEvent) && replyParentProfileQuery.isLoading

  const pollInfo =
    fetched?.kind === nostrKinds.Poll ? extractPollInfo(fetched.tags) : null
  const pollExpired = pollInfo ? isPollExpired(pollInfo.endsAt) : false
  const {
    handlePollOptionPress,
    handlePollSubmitMultiple,
    pollMultipleSelection,
    pollResponsesLoading,
    pollVoteCounts,
    pollVoting,
    userPollVoteIds
  } = useNostrPollVote({
    enabled: Boolean(pollInfo && !privacyMode),
    eventId: decoded?.data,
    isExpired: pollExpired,
    isWatchOnly: Boolean(identity?.isWatchOnly),
    nsec: identity?.nsec,
    ownPubkeys,
    pollInfo,
    relays: effectiveRelays
  })

  const engagement = useNostrNoteEngagement({
    enabled: !privacyMode,
    isWatchOnly: Boolean(identity?.isWatchOnly),
    note:
      noteEvent && noteEventId
        ? { id: noteEventId, kind: noteEvent.kind, pubkey: noteEvent.pubkey }
        : null,
    nsec: identity?.nsec,
    ownPubkey: ownPubkeyHex,
    relays: effectiveRelays
  })

  const noteItemForFeed = deriveNoteItemForFeed(fetched, decoded)
  const isLongFormNote = fetched ? isLongFormNostrKind(fetched.kind) : false
  const showMarkdownToggle =
    isLongFormNote && !privacyMode && Boolean(fetched?.content.length)

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

  const qualifyingUseCount = countQualifyingZaps(
    zapReceipts,
    enhancedZap.zapMin,
    enhancedZap.zapMax
  )

  const usesRemaining =
    enhancedZap.zapUses !== undefined
      ? Math.max(0, enhancedZap.zapUses - qualifyingUseCount)
      : undefined

  const isRequestComplete =
    (goalProgress !== undefined && goalProgress >= 1) ||
    (usesRemaining !== undefined && usesRemaining <= 0)

  async function handleBookmarkAction(
    action: { type: 'add'; source: 'public' | 'private' } | { type: 'remove' }
  ) {
    const eventId = decoded?.data
    if (!eventId || !npub || !identity?.nsec) {
      return
    }
    setBookmarkLoading(true)
    const api = new NostrAPI(effectiveRelays)
    try {
      await api.publishBookmarkUpdate(npub, identity.nsec, {
        eventId,
        ...action
      })
      toast.success(
        action.type === 'remove'
          ? t('nostrIdentity.note.bookmarkRemoved')
          : t('nostrIdentity.note.bookmarkAdded')
      )
    } catch (error) {
      toast.error(
        `${t('nostrIdentity.note.bookmarkFailed')}: ${getNostrErrorMessage(error)}`
      )
    } finally {
      api.disconnect()
      setBookmarkLoading(false)
    }
  }

  function handleBookmarkPress() {
    setBookmarkModalVisible(true)
  }

  const zapTarget =
    fetched && decoded?.data
      ? {
          id: decoded.data,
          kind: fetched.kind,
          lud16: effectiveLud16,
          pubkey: fetched.pubkey,
          tags: fetched.tags
        }
      : null

  function handleAmountSelected(sats: number) {
    setCustomAmount('')
    if (zapTarget) {
      void zapFlow.zap(zapTarget, sats)
    }
  }

  function handleCustomAmountSubmit() {
    const sats = Number.parseInt(customAmount, 10)
    if (!sats || sats <= 0 || !zapTarget) {
      return
    }
    void zapFlow.zap(zapTarget, sats)
  }

  function handleOneTapZap() {
    if (zapTarget) {
      zapFlow.zapOneTap(zapTarget)
    }
  }

  function handleOpenZapSheet() {
    if (zapTarget) {
      zapFlow.openZapOptions(zapTarget)
    }
  }

  function handleZapSortPress(field: 'date' | 'amount') {
    if (zapSortField === field) {
      setZapSortAsc((v) => !v)
    } else {
      setZapSortField(field)
      setZapSortAsc(false)
    }
  }

  const sortedZapReceipts = sortZapReceipts(
    zapReceipts,
    zapSortField,
    zapSortAsc
  )

  const noteHexId = decoded?.data ?? ''
  const noteId = noteHexId ? nip19.noteEncode(noteHexId) : ''
  const noteNeventId = noteHexId ? nip19.neventEncode({ id: noteHexId }) : ''
  const formatMarkdown = noteHexId
    ? formatMarkdownByNoteId[noteHexId] === true
    : false

  const listedRelayUrls = NOSTR_RELAYS.map((relay) => relay.url)
  const canRequestDeletion =
    fetched?.pubkey === ownPubkeyHex &&
    ownPubkeyHex.length > 0 &&
    Boolean(identity?.nsec) &&
    !identity?.isWatchOnly

  function openDeletionModal() {
    setDeletionModalVisible(true)
  }

  function closeDeletionModal() {
    setDeletionModalVisible(false)
  }

  async function requestNoteDeletion(relays: string[]) {
    if (!identity?.nsec || !noteHexId || relays.length === 0) {
      return
    }

    setDeletionModalVisible(false)
    setDeleting(true)
    const api = new NostrAPI(relays)
    try {
      await api.requestDeletion([noteHexId], identity.nsec)
      toast.success(t('nostrIdentity.note.requestDeletionSuccess'))
      router.back()
    } catch (error) {
      toast.error(
        `${t('nostrIdentity.note.requestDeletionFailed')}: ${getNostrErrorMessage(error)}`
      )
    } finally {
      api.disconnect()
      setDeleting(false)
    }
  }

  function handleDeleteFromSelectedRelays() {
    void requestNoteDeletion(effectiveRelays)
  }

  function handleDeleteFromListedRelays() {
    void requestNoteDeletion(listedRelayUrls)
  }

  function handlePlainTextViewPress() {
    if (!noteHexId) {
      return
    }
    setFormatMarkdownByNoteId((prev) => ({
      ...prev,
      [noteHexId]: false
    }))
  }

  function handleFormattedViewPress() {
    if (!noteHexId) {
      return
    }
    setFormatMarkdownByNoteId((prev) => ({
      ...prev,
      [noteHexId]: true
    }))
  }

  const eventJson = fetched
    ? JSON.stringify(
        {
          content: fetched.content,
          created_at: fetched.created_at,
          id: decoded?.data ?? '',
          kind: fetched.kind,
          pubkey: fetched.pubkey,
          tags: fetched.tags
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
              <SSPressable
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
                      <SSText
                        size="md"
                        weight="medium"
                        style={{ lineHeight: 18 }}
                      >
                        {fetched.authorName}
                      </SSText>
                    )}
                    {privacyMode && (
                      <SSText
                        size="md"
                        weight="medium"
                        style={{ lineHeight: 18 }}
                      >
                        {NOSTR_PRIVACY_MASK}
                      </SSText>
                    )}
                    <SSText
                      size="xs"
                      color="muted"
                      type="mono"
                      style={{ lineHeight: 16 }}
                    >
                      {formatNpub(nip19.npubEncode(fetched.pubkey), 'md')}
                    </SSText>
                    {fetched.authorNip05 && !privacyMode && (
                      <SSHStack gap="xs" style={{ alignItems: 'center' }}>
                        <SSText
                          size="xs"
                          color="muted"
                          style={{ lineHeight: 16 }}
                        >
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
              </SSPressable>
            ) : null}

            {showMarkdownToggle ? (
              <SSHStack gap="sm" style={styles.markdownToggleRow}>
                <Pressable
                  onPress={handlePlainTextViewPress}
                  style={[
                    styles.markdownToggleTab,
                    !formatMarkdown
                      ? styles.markdownToggleTabActive
                      : styles.markdownToggleTabInactive
                  ]}
                >
                  <SSText
                    center
                    uppercase
                    weight="medium"
                    style={{
                      color: !formatMarkdown ? Colors.white : Colors.gray[50]
                    }}
                  >
                    {t('nostrIdentity.note.plainText')}
                  </SSText>
                </Pressable>
                <Pressable
                  onPress={handleFormattedViewPress}
                  style={[
                    styles.markdownToggleTab,
                    formatMarkdown
                      ? styles.markdownToggleTabActive
                      : styles.markdownToggleTabInactive
                  ]}
                >
                  <SSText
                    center
                    uppercase
                    weight="medium"
                    style={{
                      color: formatMarkdown ? Colors.white : Colors.gray[50]
                    }}
                  >
                    {t('nostrIdentity.note.formattedMarkdown')}
                  </SSText>
                </Pressable>
              </SSHStack>
            ) : null}

            {noteItemForFeed && fetched ? (
              <SSNostrFeedNoteRow
                note={noteItemForFeed}
                privacyMode={privacyMode}
                showAuthor={Boolean(fetched.pubkey)}
                expandContent
                formatMarkdown={formatMarkdown && showMarkdownToggle}
                authorPreview={
                  noteAuthorFeedProps ? (
                    <SSNostrFeedAuthorRow
                      onPress={
                        npub
                          ? () =>
                              navigateToNostrProfile(
                                noteAuthorFeedProps.authorNpubBech
                              )
                          : undefined
                      }
                      loading={noteAuthorFeedProps.loading}
                      npubBech={noteAuthorFeedProps.authorNpubBech}
                      displayName={noteAuthorFeedProps.displayName}
                      nip05={noteAuthorFeedProps.nip05}
                      nip05Valid={nip05Valid}
                      pictureUri={noteAuthorFeedProps.pictureUri}
                    />
                  ) : undefined
                }
                resolvedQuotedNote={quotedNote ?? undefined}
                resolvedQuotedNoteProfile={quotedNoteProfile}
                mentionProfiles={mentionProfiles}
                onQuotePress={(id) => {
                  if (!npub) {
                    return
                  }
                  const uri = nip19.neventEncode({ id })
                  router.push(nostrNoteHref(npub, uri))
                }}
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
                  formatMarkdown && showMarkdownToggle ? (
                    <SSMarkdown content={fetched.content} />
                  ) : (
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
                  )
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

            {pollInfo && !privacyMode ? (
              <SSNostrPollOptions
                canVote={Boolean(identity?.nsec) && !identity?.isWatchOnly}
                isExpired={pollExpired}
                onOptionPress={handlePollOptionPress}
                onSubmitMultiple={handlePollSubmitMultiple}
                pollInfo={pollInfo}
                pollMultipleSelection={pollMultipleSelection}
                pollResponsesLoading={pollResponsesLoading}
                pollVoteCounts={pollVoteCounts}
                pollVoting={pollVoting}
                userPollVoteIds={userPollVoteIds}
              />
            ) : null}

            {fetched ? (
              <SSNostrNoteActions
                canEngage={engagement.canEngage}
                likeCount={engagement.likeCount}
                likedByMe={engagement.likedByMe}
                onLikePress={engagement.handleLikePress}
                onRepostPress={engagement.handleRepostPress}
                repostCount={engagement.repostCount}
                repostedByMe={engagement.repostedByMe}
                showCounts={!privacyMode}
                style={styles.actionRow}
                toggling={engagement.toggling}
                zap={{
                  canZap: zapFlow.canZap && Boolean(effectiveLud16),
                  onLongPress: handleOpenZapSheet,
                  onPress: handleOneTapZap,
                  zapping: zapFlow.zapping
                }}
              >
                <SSHStack gap="none" style={styles.actionRowEnd}>
                  <SSIconButton
                    accessibilityLabel={t('nostrIdentity.note.qrTitle')}
                    style={styles.actionButton}
                    disabled={!noteNeventId}
                    onPress={() => setQrModalVisible(true)}
                  >
                    <SSIconQR width={18} height={18} />
                  </SSIconButton>
                  <SSIconButton
                    accessibilityLabel={t('nostrIdentity.note.bookmarkTitle')}
                    style={styles.actionButton}
                    disabled={
                      bookmarkLoading || !decoded?.data || !identity?.nsec
                    }
                    onPress={handleBookmarkPress}
                  >
                    <SSIconBookmark
                      width={20}
                      height={20}
                      color={Colors.gray[300]}
                    />
                  </SSIconButton>
                </SSHStack>
              </SSNostrNoteActions>
            ) : null}

            {canRequestDeletion ? (
              <SSButton
                label={t('nostrIdentity.note.requestDeletion')}
                variant="danger"
                disabled={deleting}
                loading={deleting}
                onPress={openDeletionModal}
              />
            ) : null}

            {fetched ? (
              <SSVStack gap="xxs">
                <SSPressable
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
                </SSPressable>
                {showMeta ? (
                  <SSVStack gap="xxs">
                    <SSHStack gap="xs" style={styles.metaRow}>
                      <SSText
                        size="xxs"
                        color="muted"
                        uppercase
                        style={styles.metaLabel}
                      >
                        {t('nostrIdentity.note.metaKind')}
                      </SSText>
                      <View style={styles.kindBadge}>
                        <SSText size="xxs">{fetched.kind}</SSText>
                      </View>
                    </SSHStack>
                    <SSHStack gap="xs" style={styles.metaRow}>
                      <SSText
                        size="xxs"
                        color="muted"
                        uppercase
                        style={styles.metaLabel}
                      >
                        {t('nostrIdentity.note.metaNevent')}
                      </SSText>
                      <SSClipboardCopy
                        text={noteNeventId}
                        style={styles.metaValue}
                      >
                        <SSText
                          size="xxs"
                          type="mono"
                          color="muted"
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {noteNeventId}
                        </SSText>
                      </SSClipboardCopy>
                    </SSHStack>
                    <SSHStack gap="xs" style={styles.metaRow}>
                      <SSText
                        size="xxs"
                        color="muted"
                        uppercase
                        style={styles.metaLabel}
                      >
                        {t('nostrIdentity.note.metaNote')}
                      </SSText>
                      <SSClipboardCopy text={noteId} style={styles.metaValue}>
                        <SSText
                          size="xxs"
                          type="mono"
                          color="muted"
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {noteId}
                        </SSText>
                      </SSClipboardCopy>
                    </SSHStack>
                    <SSHStack gap="xs" style={styles.metaRow}>
                      <SSText
                        size="xxs"
                        color="muted"
                        uppercase
                        style={styles.metaLabel}
                      >
                        {t('nostrIdentity.note.metaHex')}
                      </SSText>
                      <SSClipboardCopy
                        text={noteHexId}
                        style={styles.metaValue}
                      >
                        <SSText
                          size="xxs"
                          type="mono"
                          color="muted"
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
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
                    <SSPressable
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
                    </SSPressable>
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

            {fetched && zapFlow.sheets.paymentMethods.length > 0 && (
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
                        disabled={zapFlow.zapping || !effectiveLud16}
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
                            <SSPressable
                              key={sats}
                              style={styles.presetButton}
                              disabled={zapFlow.zapping || !effectiveLud16}
                              onPress={() => handleAmountSelected(sats)}
                              activeOpacity={0.6}
                            >
                              <SSText size="sm" weight="medium" center>
                                {privacyMode
                                  ? NOSTR_PRIVACY_MASK
                                  : sats.toLocaleString()}
                              </SSText>
                            </SSPressable>
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
                            customAmount &&
                            Number.parseInt(customAmount, 10) > 0
                              ? `${t('nostrIdentity.note.zap')} ${privacyMode ? NOSTR_PRIVACY_MASK : Number.parseInt(customAmount, 10).toLocaleString()} sats`
                              : t('nostrIdentity.note.zap')
                          }
                          variant="secondary"
                          disabled={
                            zapFlow.zapping ||
                            !effectiveLud16 ||
                            !customAmount ||
                            Number.parseInt(customAmount, 10) <
                              (enhancedZap.zapMin ?? 1) ||
                            Number.parseInt(customAmount, 10) >
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
                              disabled={zapFlow.zapping || !effectiveLud16}
                              onPress={() => handleAmountSelected(tag.amount)}
                              style={styles.zapButton}
                            />
                          </SSHStack>
                        ))}
                      </SSVStack>
                    )}

                    {(hasEnhancedZapTags || pubpayTags.length > 0) && (
                      <View style={styles.zapSectionSpacer} />
                    )}

                    {effectiveLud16 && !identity?.isWatchOnly && (
                      <SSHStack gap="sm">
                        <SSButton
                          label={
                            privacyMode
                              ? `${NOSTR_PRIVACY_MASK} sats`
                              : t('nostrIdentity.note.zapOneTap', {
                                  amount: zapFlow.oneTapAmount
                                })
                          }
                          variant="outline"
                          disabled={zapFlow.zapping}
                          onPress={handleOneTapZap}
                          onLongPress={handleOpenZapSheet}
                          delayLongPress={400}
                          style={{ flex: 1 }}
                        />
                        <SSButton
                          label={t('nostrIdentity.note.more')}
                          variant="outline"
                          disabled={zapFlow.zapping}
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

                {zapFlow.zapping && (
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

            {zapsQuery.data ? (
              <SSNostrSourceBanner
                error={zapsQuery.data.error}
                onRetry={zapsQuery.refetch}
                retrying={zapsQuery.isRefetching}
                source={zapsQuery.data.source}
              />
            ) : null}

            {zapReceipts.length > 0 && (
              <SSVStack gap="sm">
                <SSHStack gap="sm" style={styles.zapSortHeader}>
                  <SSText size="xs" color="muted" uppercase style={{ flex: 1 }}>
                    {t('nostrIdentity.note.zapReceipts')} ({zapReceipts.length})
                  </SSText>
                  <SSPressable
                    onPress={() => handleZapSortPress('date')}
                    hitSlop={8}
                  >
                    <SSText
                      size="xxs"
                      color={zapSortField === 'date' ? 'white' : 'muted'}
                    >
                      {t('nostrIdentity.zapSort.date')}
                      {zapSortField === 'date'
                        ? zapSortAsc
                          ? ' ↑'
                          : ' ↓'
                        : ''}
                    </SSText>
                  </SSPressable>
                  <SSPressable
                    onPress={() => handleZapSortPress('amount')}
                    hitSlop={8}
                  >
                    <SSText
                      size="xxs"
                      color={zapSortField === 'amount' ? 'white' : 'muted'}
                    >
                      {t('nostrIdentity.zapSort.amount')}
                      {zapSortField === 'amount'
                        ? zapSortAsc
                          ? ' ↑'
                          : ' ↓'
                        : ''}
                    </SSText>
                  </SSPressable>
                </SSHStack>
                {sortedZapReceipts.map((receipt) => (
                  <SSHStack key={receipt.id} gap="sm" style={styles.receiptRow}>
                    <SSPressable
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
                                formatNpub(
                                  nip19.npubEncode(receipt.senderPubkey),
                                  'xs'
                                )}
                          </SSText>
                          {!privacyMode && receipt.comment ? (
                            <SSText size="xs" color="muted">
                              {receipt.comment}
                            </SSText>
                          ) : null}
                        </SSVStack>
                      </SSHStack>
                    </SSPressable>
                    <SSVStack gap="xxs" style={styles.receiptAmountCol}>
                      {receipt.createdAt > 0 && (
                        <SSText size="xxs" color="muted">
                          {formatNostrCardDate(receipt.createdAt)}
                        </SSText>
                      )}
                      <SSZapAmountDisplay amountSats={receipt.amountSats} />
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

            {notFound && !fetched && (
              <SSVStack itemsCenter gap="md" style={styles.notFoundCard}>
                {noteRelayError ? (
                  <SSNostrSourceBanner
                    error={noteRelayError}
                    onRetry={noteQuery.refetch}
                    retrying={noteQuery.isRefetching}
                    source="cache"
                  />
                ) : (
                  <SSText color="muted">
                    {t('nostrIdentity.note.notFoundOnYourRelays')}
                  </SSText>
                )}
                <SSText size="xs" type="mono" color="muted">
                  {formatNpub(decoded.raw, 'xl')}
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

            {replyParentId && fetched && noteLooksLikeReply(fetched.tags) ? (
              <SSVStack gap="sm" style={styles.replyParentSection}>
                <SSPressable
                  activeOpacity={0.6}
                  disabled={!npub}
                  onPress={() => {
                    if (!npub || !replyParentId) {
                      return
                    }
                    router.push(
                      nostrNoteHref(npub, nip19.noteEncode(replyParentId))
                    )
                  }}
                >
                  <SSText size="xs" color="muted" uppercase>
                    {t('nostrIdentity.note.replyingTo')}
                  </SSText>
                </SSPressable>
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
                ) : replyParentNoteLike ? (
                  <SSPressable
                    activeOpacity={0.6}
                    disabled={!npub}
                    style={styles.replyParentNoteRow}
                    onPress={() => {
                      if (!npub || !replyParentId) {
                        return
                      }
                      router.push(
                        nostrNoteHref(npub, nip19.noteEncode(replyParentId))
                      )
                    }}
                  >
                    <View pointerEvents="none">
                      <SSNostrFeedNoteRow
                        note={replyParentNoteLike}
                        privacyMode={privacyMode}
                        showAuthor={!!replyParentAuthorFeedProps}
                        expandContent
                        authorPreview={
                          replyParentAuthorFeedProps ? (
                            <SSNostrFeedAuthorRow
                              loading={replyParentAuthorFeedProps.loading}
                              npubBech={
                                replyParentAuthorFeedProps.authorNpubBech
                              }
                              displayName={
                                replyParentAuthorFeedProps.displayName
                              }
                              nip05={replyParentAuthorFeedProps.nip05}
                              pictureUri={replyParentAuthorFeedProps.pictureUri}
                            />
                          ) : undefined
                        }
                      />
                    </View>
                  </SSPressable>
                ) : null}
              </SSVStack>
            ) : null}
          </SSVStack>
        </ScrollView>
      )}

      <SSNostrZapSheets
        {...zapFlow.sheets}
        btcPrice={btcPrice}
        fiatCurrency={fiatCurrency}
        privacyMode={privacyMode}
      />

      <SSModal
        visible={deletionModalVisible}
        onClose={closeDeletionModal}
        label={t('common.cancel')}
      >
        <SSVStack gap="sm" style={styles.deletionModal}>
          <SSText center uppercase>
            {t('nostrIdentity.note.requestDeletionConfirm')}
          </SSText>
          <SSText center color="muted" size="sm">
            {t('nostrIdentity.note.requestDeletion')}
          </SSText>
          <SSButton
            label={t('nostrIdentity.note.requestDeletionSelected', {
              count: effectiveRelays.length
            })}
            variant="danger"
            disabled={effectiveRelays.length === 0 || deleting}
            onPress={handleDeleteFromSelectedRelays}
          />
          <SSButton
            label={t('nostrIdentity.note.requestDeletionAll', {
              count: listedRelayUrls.length
            })}
            variant="danger"
            disabled={listedRelayUrls.length === 0 || deleting}
            onPress={handleDeleteFromListedRelays}
          />
        </SSVStack>
      </SSModal>
      <SSModal
        visible={bookmarkModalVisible}
        onClose={() => setBookmarkModalVisible(false)}
        label={t('common.cancel')}
      >
        <SSVStack gap="sm" style={{ width: '100%' }}>
          <SSText center uppercase>
            {t('nostrIdentity.note.bookmarkTitle')}
          </SSText>
          <SSButton
            label={t('nostrIdentity.note.bookmarkPublic')}
            variant="secondary"
            onPress={() => {
              setBookmarkModalVisible(false)
              void handleBookmarkAction({ source: 'public', type: 'add' })
            }}
          />
          <SSButton
            label={t('nostrIdentity.note.bookmarkPrivate')}
            variant="secondary"
            onPress={() => {
              setBookmarkModalVisible(false)
              void handleBookmarkAction({ source: 'private', type: 'add' })
            }}
          />
          <SSButton
            label={t('nostrIdentity.note.bookmarkRemove')}
            variant="ghost"
            onPress={() => {
              setBookmarkModalVisible(false)
              void handleBookmarkAction({ type: 'remove' })
            }}
          />
        </SSVStack>
      </SSModal>
      <SSModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        closeButtonVariant="ghost"
        label={t('common.close')}
      >
        <SSVStack gap="lg" style={styles.qrModalContent}>
          <SSText center uppercase>
            {t('nostrIdentity.note.qrTitle')}
          </SSText>
          <SSShareableQR
            value={noteNeventId}
            size={260}
            color={Colors.black}
            backgroundColor={Colors.white}
            containerStyle={styles.qrContainer}
          >
            <SSClipboardCopy text={noteNeventId}>
              <SSText
                center
                size="xxs"
                type="mono"
                color="muted"
                numberOfLines={2}
                ellipsizeMode="middle"
              >
                {noteNeventId}
              </SSText>
            </SSClipboardCopy>
          </SSShareableQR>
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

function deriveNoteItemForFeed(
  fetched: NostrFetchedNoteData | null,
  decoded: NostrDecodedContent | null
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
  noteData: NostrFetchedNoteData | null,
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
  actionButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  actionRow: {
    borderBottomWidth: 1,
    borderColor: Colors.gray[800],
    paddingBottom: 4
  },
  actionRowEnd: {
    marginLeft: 'auto'
  },
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
  deletionModal: {
    width: '100%'
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
  markdownToggleRow: {
    marginBottom: 4
  },
  markdownToggleTab: {
    borderRadius: 3,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  markdownToggleTabActive: {
    backgroundColor: Colors.gray[800]
  },
  markdownToggleTabInactive: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderWidth: 1
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
  qrContainer: {
    alignSelf: 'center',
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 12
  },
  qrModalContent: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingHorizontal: 20
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
  replyParentNoteRow: {
    width: '100%'
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
  tagTypeBadge: {
    backgroundColor: Colors.gray[800],
    borderRadius: 3,
    flexShrink: 0,
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  zapButton: {
    minWidth: 90
  },
  zapLoader: {
    marginVertical: 8
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
  },
  zapSectionSpacer: {
    height: 8
  },
  zapSortHeader: {
    alignItems: 'center'
  }
})
