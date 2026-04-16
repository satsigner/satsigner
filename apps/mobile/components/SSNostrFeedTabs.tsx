import { nip19 } from 'nostr-tools'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native'

import { NostrAPI } from '@/api/nostr'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import {
  SSNostrFeedAuthorRow,
  SSNostrFeedNoteRow,
  type NostrFeedNoteLike
} from '@/components/SSNostrFeedNoteRow'
import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type TextFontSize, type TextFontWeight } from '@/styles/sizes'
import { type NostrKind0Profile } from '@/types/models/Nostr'
import { formatNostrCardDate } from '@/utils/format'
import { truncateNpub } from '@/utils/nostrIdentity'
import {
  type ZapReceiptInfo,
  enrichZapReceipts,
  fetchZapsByPubkey,
  fetchZapsSentByPubkey,
  mergeZapReceiptsById
} from '@/utils/zap'

type SSNostrFeedTabsProps = {
  npub: string
  relayConnected: boolean
  relays: string[]
  onNotePress?: (payload: { id: string; kind: number; pubkey: string }) => void
  onZapPress?: (receipt: ZapReceiptInfo) => void
}

const PAGE_SIZE = 10

/** Labels align with https://nostr.dev/ai-reference/ (kinds & NIPs). */
type NoteKindFilterOption = {
  id: string
  kinds: number[]
  labelKey: string
}

const NOTE_KIND_FILTER_OPTIONS: NoteKindFilterOption[] = [
  {
    id: 'short_text',
    kinds: [1],
    labelKey: 'nostrIdentity.feed.kindShortTextNote'
  },
  {
    id: 'long_form',
    kinds: [30023],
    labelKey: 'nostrIdentity.feed.kindLongFormContent'
  },
  {
    id: 'draft_long_form',
    kinds: [30024],
    labelKey: 'nostrIdentity.feed.kindDraftLongFormContent'
  },
  {
    id: 'reposts',
    kinds: [6, 16],
    labelKey: 'nostrIdentity.feed.kindReposts'
  },
  {
    id: 'reactions',
    kinds: [7],
    labelKey: 'nostrIdentity.feed.kindReaction'
  },
  {
    id: 'picture',
    kinds: [20],
    labelKey: 'nostrIdentity.feed.kindPicture'
  },
  {
    id: 'video',
    kinds: [21, 22],
    labelKey: 'nostrIdentity.feed.kindVideoEvents'
  },
  {
    id: 'file_metadata',
    kinds: [1063],
    labelKey: 'nostrIdentity.feed.kindFileMetadata'
  },
  {
    id: 'poll_response',
    kinds: [1018],
    labelKey: 'nostrIdentity.feed.kindPollResponse'
  },
  {
    id: 'label',
    kinds: [1985],
    labelKey: 'nostrIdentity.feed.kindLabel'
  },
  {
    id: 'thread',
    kinds: [11],
    labelKey: 'nostrIdentity.feed.kindThread'
  }
]

const DEFAULT_KIND_FILTER_ID = NOTE_KIND_FILTER_OPTIONS[0].id

function kindsForNoteKindFilterId(id: string): number[] {
  const opt = NOTE_KIND_FILTER_OPTIONS.find((o) => o.id === id)
  return opt?.kinds.length ? opt.kinds : [1]
}

const DROPDOWN_LABEL_MAX_CHARS = 36

type FeedTab = 'feed' | 'notes' | 'zaps'

type FeedAuthorKind0State =
  | { status: 'loading' }
  | { status: 'ready'; profile: NostrKind0Profile | null }

function trimDropdownLabel(text: string): string {
  if (text.length <= DROPDOWN_LABEL_MAX_CHARS) {return text}
  return `${text.slice(0, DROPDOWN_LABEL_MAX_CHARS - 1)}…`
}

/** Splits "Title (Kind …)" so the parenthetical can use muted color. */
function splitKindFilterLabel(label: string): { main: string; suffix: string } {
  const open = label.lastIndexOf(' (')
  if (open === -1) {
    return { main: label, suffix: '' }
  }
  return { main: label.slice(0, open), suffix: label.slice(open) }
}

function trimKindFilterParts(
  main: string,
  suffix: string
): { main: string; suffix: string } {
  const full = main + suffix
  if (full.length <= DROPDOWN_LABEL_MAX_CHARS) {
    return { main, suffix }
  }
  const reserve = suffix.length + 1
  const budget = Math.max(8, DROPDOWN_LABEL_MAX_CHARS - reserve)
  return {
    main: `${main.slice(0, budget)}…`,
    suffix
  }
}

type KindFilterLabelTextProps = {
  label: string
  size?: TextFontSize
  weight?: TextFontWeight
}

function KindFilterLabelText({
  label,
  size = 'md',
  weight = 'medium'
}: KindFilterLabelTextProps) {
  const { main, suffix } = splitKindFilterLabel(label)
  const trimmed = trimKindFilterParts(main, suffix)
  const rowStyle = { flex: 1, minWidth: 0 as const }

  if (!trimmed.suffix) {
    return (
      <SSText
        size={size}
        weight={weight}
        numberOfLines={1}
        ellipsizeMode="tail"
        style={rowStyle}
      >
        {trimDropdownLabel(trimmed.main)}
      </SSText>
    )
  }
  return (
    <SSText
      size={size}
      weight={weight}
      numberOfLines={1}
      ellipsizeMode="tail"
      style={rowStyle}
    >
      <SSText size={size} weight={weight}>
        {trimmed.main}
      </SSText>
      <SSText size={size} weight={weight} color="muted">
        {trimmed.suffix}
      </SSText>
    </SSText>
  )
}

function SSNostrFeedTabs({
  npub,
  relayConnected,
  relays,
  onNotePress,
  onZapPress
}: SSNostrFeedTabsProps) {
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const [activeTab, setActiveTab] = useState<FeedTab>('zaps')

  const [notes, setNotes] = useState<NostrFeedNoteLike[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesHasMore, setNotesHasMore] = useState(true)
  const notesFetchedRef = useRef(false)
  const [notesKindFilterId, setNotesKindFilterId] = useState(
    DEFAULT_KIND_FILTER_ID
  )
  const [notesKindSheetOpen, setNotesKindSheetOpen] = useState(false)

  const [feedNotes, setFeedNotes] = useState<NostrFeedNoteLike[]>([])
  const [feedKindFilterId, setFeedKindFilterId] = useState(
    DEFAULT_KIND_FILTER_ID
  )
  const [feedKindSheetOpen, setFeedKindSheetOpen] = useState(false)
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedHasMore, setFeedHasMore] = useState(true)
  const [feedFollowingEmpty, setFeedFollowingEmpty] = useState(false)
  const feedFetchedRef = useRef(false)
  const [feedAuthorKind0, setFeedAuthorKind0] = useState<
    Record<string, FeedAuthorKind0State>
  >({})
  const feedKind0FetchedRef = useRef(new Set<string>())

  const [zaps, setZaps] = useState<ZapReceiptInfo[]>([])
  const [zapsLoading, setZapsLoading] = useState(false)
  const [zapsHasMore, setZapsHasMore] = useState(true)
  const zapsFetchedRef = useRef(false)

  const hexPubkey = getPubKeyHexFromNpub(npub) ?? ''
  const ownPubkeyLower = hexPubkey.toLowerCase()
  const ownPubkeys = hexPubkey ? [hexPubkey] : []

  const apiRef = useRef<NostrAPI | null>(null)
  const relaysKey = JSON.stringify(relays)

  useEffect(() => {
    apiRef.current?.closeAllSubscriptions()
    apiRef.current = relays.length
      ? new NostrAPI(relays, ownPubkeys)
      : null
    return () => {
      apiRef.current?.closeAllSubscriptions()
      apiRef.current = null
    }
  }, [relaysKey, ownPubkeys]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadNotes = useCallback(
    async (loadMore = false) => {
      if (notesLoading || !apiRef.current) {return}

      setNotesLoading(true)
      try {
        const lastNote = notes.at(-1)
        const until =
          loadMore && lastNote ? lastNote.created_at : undefined

        const fetched = await apiRef.current.fetchNotes(
          npub,
          PAGE_SIZE,
          until,
          kindsForNoteKindFilterId(notesKindFilterId)
        )

        if (fetched.length < PAGE_SIZE) {
          setNotesHasMore(false)
        }

        if (loadMore) {
          setNotes((prev) => {
            const existingIds = new Set(prev.map((n) => n.id))
            const newNotes = fetched.filter((n) => !existingIds.has(n.id))
            return [...prev, ...newNotes]
          })
        } else {
          setNotes(fetched)
        }
      } catch {
        // fetch failed — UI already shows empty state
      } finally {
        setNotesLoading(false)
      }
    },
    [npub, notes, notesKindFilterId, notesLoading]
  )

  const loadFeed = useCallback(
    async (loadMore = false) => {
      if (feedLoading || !apiRef.current) {return}

      setFeedLoading(true)
      try {
        if (!loadMore) {
          const following =
            await apiRef.current.fetchKind3FollowingPubkeys(npub)
          const empty = following.length === 0
          setFeedFollowingEmpty(empty)
          if (empty) {
            setFeedNotes([])
            setFeedHasMore(false)
            return
          }
        }

        const lastFeed = feedNotes.at(-1)
        const until =
          loadMore && lastFeed ? lastFeed.created_at : undefined

        const fetched = await apiRef.current.fetchFollowingTimelineNotes(
          npub,
          PAGE_SIZE,
          until,
          kindsForNoteKindFilterId(feedKindFilterId)
        )

        if (fetched.length < PAGE_SIZE) {
          setFeedHasMore(false)
        }

        if (loadMore) {
          setFeedNotes((prev) => {
            const existingIds = new Set(prev.map((n) => n.id))
            const newNotes = fetched.filter((n) => !existingIds.has(n.id))
            return [...prev, ...newNotes]
          })
        } else {
          setFeedNotes(fetched)
        }
      } catch {
        // fetch failed — UI already shows empty state
      } finally {
        setFeedLoading(false)
      }
    },
    [npub, feedNotes, feedKindFilterId, feedLoading]
  )

  const loadZaps = useCallback(
    async (loadMore = false) => {
      if (zapsLoading || !relays.length) {return}

      setZapsLoading(true)
      try {
        const lastZap = zaps.at(-1)
        const until =
          loadMore && lastZap && lastZap.createdAt > 0
            ? lastZap.createdAt - 1
            : undefined

        const [incomingBatch, sentBatch] = await Promise.all([
          fetchZapsByPubkey(hexPubkey, relays, PAGE_SIZE, until, ownPubkeys),
          fetchZapsSentByPubkey(hexPubkey, relays, PAGE_SIZE, until)
        ])

        const fetched = mergeZapReceiptsById([...incomingBatch, ...sentBatch])
        const incomingHasMore = incomingBatch.length >= PAGE_SIZE
        const sentHasMore = sentBatch.length >= PAGE_SIZE

        if (loadMore) {
          const prevLen = zaps.length
          const allZaps = mergeZapReceiptsById([...zaps, ...fetched])
          if (allZaps.length === prevLen) {
            setZapsHasMore(false)
          } else {
            setZapsHasMore(incomingHasMore || sentHasMore)
          }
          setZaps(allZaps)
          await enrichZapReceipts(allZaps, relays)
          setZaps([...allZaps])
        } else {
          setZapsHasMore(incomingHasMore || sentHasMore)
          setZaps(fetched)
          await enrichZapReceipts(fetched, relays)
          setZaps([...fetched])
        }
      } catch {
        // fetch failed — UI already shows empty state
      } finally {
        setZapsLoading(false)
      }
    },
    [hexPubkey, ownPubkeys, relays, zaps, zapsLoading]
  )

  useEffect(() => {
    if (!relayConnected) {
      notesFetchedRef.current = false
      feedFetchedRef.current = false
      zapsFetchedRef.current = false
      setNotes([])
      setFeedNotes([])
      setZaps([])
      setNotesHasMore(true)
      setFeedHasMore(true)
      setZapsHasMore(true)
      setFeedFollowingEmpty(false)
      setNotesLoading(false)
      setFeedLoading(false)
      setZapsLoading(false)
      setFeedAuthorKind0({})
      feedKind0FetchedRef.current.clear()
    }
  }, [relayConnected])

  useEffect(() => {
    notesFetchedRef.current = false
    feedFetchedRef.current = false
    zapsFetchedRef.current = false
    setNotes([])
    setFeedNotes([])
    setZaps([])
    setNotesHasMore(true)
    setFeedHasMore(true)
    setZapsHasMore(true)
    setFeedFollowingEmpty(false)
    setFeedAuthorKind0({})
    feedKind0FetchedRef.current.clear()
  }, [npub])

  useEffect(() => {
    notesFetchedRef.current = false
    setNotes([])
    setNotesHasMore(true)
  }, [notesKindFilterId])

  useEffect(() => {
    feedFetchedRef.current = false
    setFeedNotes([])
    setFeedHasMore(true)
    setFeedAuthorKind0({})
    feedKind0FetchedRef.current.clear()
  }, [feedKindFilterId])

  const notesKindLabel = useMemo(() => {
    const opt = NOTE_KIND_FILTER_OPTIONS.find((o) => o.id === notesKindFilterId)
    return opt ? t(opt.labelKey) : ''
  }, [notesKindFilterId])

  const feedKindLabel = useMemo(() => {
    const opt = NOTE_KIND_FILTER_OPTIONS.find((o) => o.id === feedKindFilterId)
    return opt ? t(opt.labelKey) : ''
  }, [feedKindFilterId])

  useEffect(() => {
    if (!relayConnected || activeTab !== 'notes' || notesFetchedRef.current) {
      return
    }
    notesFetchedRef.current = true
    void loadNotes()
  }, [activeTab, relayConnected, loadNotes, notesKindFilterId])

  useEffect(() => {
    if (!relayConnected || activeTab !== 'feed' || feedFetchedRef.current) {
      return
    }
    feedFetchedRef.current = true
    void loadFeed()
  }, [activeTab, relayConnected, loadFeed, feedKindFilterId])

  useEffect(() => {
    if (!relayConnected || activeTab !== 'zaps' || zapsFetchedRef.current) {
      return
    }
    zapsFetchedRef.current = true
    void loadZaps()
  }, [activeTab, relayConnected, loadZaps])

  useEffect(() => {
    if (!relayConnected || privacyMode || !apiRef.current) {
      return
    }

    const api = apiRef.current
    const pks = [
      ...new Set([
        ...feedNotes.map((n) => n.pubkey.toLowerCase()),
        ...notes.map((n) => n.pubkey.toLowerCase()),
        ...(ownPubkeyLower && /^[0-9a-f]{64}$/.test(ownPubkeyLower)
          ? [ownPubkeyLower]
          : [])
      ])
    ].filter((pk) => /^[0-9a-f]{64}$/.test(pk))

    for (const pk of pks) {
      if (feedKind0FetchedRef.current.has(pk)) {
        continue
      }
      feedKind0FetchedRef.current.add(pk)
      setFeedAuthorKind0((prev) => ({
        ...prev,
        [pk]: { status: 'loading' }
      }))
      void api
        .fetchKind0ByPubkeyHex(pk)
        .then((profile) => {
          setFeedAuthorKind0((prev) => ({
            ...prev,
            [pk]: { profile, status: 'ready' }
          }))
        })
        .catch(() => {
          setFeedAuthorKind0((prev) => ({
            ...prev,
            [pk]: { profile: null, status: 'ready' }
          }))
        })
    }
  }, [feedNotes, notes, ownPubkeyLower, relayConnected, privacyMode])

  function renderFeedAuthorKind0Row(note: NostrFeedNoteLike) {
    const pk = note.pubkey.toLowerCase()
    const npubBech = nip19.npubEncode(note.pubkey)
    const row = feedAuthorKind0[pk]
    const p = row?.status === 'ready' ? row.profile : undefined

    const fromIdentity =
      pk === ownPubkeyLower && identity
        ? {
            displayName: identity.displayName?.trim() ?? '',
            nip05: identity.nip05?.trim() ?? '',
            pictureUri: identity.picture?.trim()
          }
        : null
    const hasIdentityFallback = Boolean(
      fromIdentity &&
        (fromIdentity.displayName.length > 0 ||
          fromIdentity.nip05.length > 0 ||
          (fromIdentity.pictureUri?.length ?? 0) > 0)
    )

    const loading =
      (!row || row.status === 'loading') && !hasIdentityFallback

    const displayName =
      p?.displayName?.trim() || fromIdentity?.displayName || ''
    const nip05 = p?.nip05?.trim() || fromIdentity?.nip05 || ''
    const pictureUri =
      (p?.picture?.trim() || fromIdentity?.pictureUri || '').trim() ||
      undefined

    return (
      <SSNostrFeedAuthorRow
        loading={loading}
        npubBech={npubBech}
        displayName={displayName}
        nip05={nip05}
        pictureUri={pictureUri}
      />
    )
  }

  if (!relayConnected) {
    return (
      <SSVStack gap="none">
        <SSText size="xs" color="muted" center style={styles.emptyText}>
          {t('nostrIdentity.feed.relayQueriesOff')}
        </SSText>
      </SSVStack>
    )
  }

  return (
    <SSVStack gap="none">
      <SSHStack gap="none" style={styles.tabBar}>
        <SSActionButton
          style={styles.tabButton}
          onPress={() => setActiveTab('zaps')}
        >
          <View style={styles.tabButtonWrap}>
            <SSVStack gap="none" itemsCenter style={styles.tabButtonInner}>
              <SSText
                size="sm"
                uppercase
                center
                color={activeTab === 'zaps' ? 'white' : 'muted'}
              >
                {t('nostrIdentity.feed.zaps')}
              </SSText>
            </SSVStack>
            {activeTab === 'zaps' ? <View style={styles.tabIndicator} /> : null}
          </View>
        </SSActionButton>
        <SSActionButton
          style={styles.tabButton}
          onPress={() => setActiveTab('notes')}
        >
          <View style={styles.tabButtonWrap}>
            <SSVStack gap="none" itemsCenter style={styles.tabButtonInner}>
              <SSText
                size="sm"
                uppercase
                center
                color={activeTab === 'notes' ? 'white' : 'muted'}
              >
                {t('nostrIdentity.feed.notes')}
              </SSText>
            </SSVStack>
            {activeTab === 'notes' ? (
              <View style={styles.tabIndicator} />
            ) : null}
          </View>
        </SSActionButton>
        <SSActionButton
          style={styles.tabButton}
          onPress={() => setActiveTab('feed')}
        >
          <View style={styles.tabButtonWrap}>
            <SSVStack gap="none" itemsCenter style={styles.tabButtonInner}>
              <SSText
                size="sm"
                uppercase
                center
                color={activeTab === 'feed' ? 'white' : 'muted'}
              >
                {t('nostrIdentity.feed.feed')}
              </SSText>
            </SSVStack>
            {activeTab === 'feed' ? <View style={styles.tabIndicator} /> : null}
          </View>
        </SSActionButton>
      </SSHStack>

      <SSVStack gap="sm" style={styles.tabContent}>
        {activeTab === 'notes' && (
          <>
            <TouchableOpacity
              style={styles.notesKindTrigger}
              activeOpacity={0.7}
              onPress={() => setNotesKindSheetOpen(true)}
            >
              <SSHStack gap="sm" style={styles.notesKindTriggerInner}>
                <View style={styles.notesKindTriggerLabel}>
                  <KindFilterLabelText label={notesKindLabel} size="xs" />
                </View>
                <SSText size="xs" color="muted">
                  ▾
                </SSText>
              </SSHStack>
            </TouchableOpacity>

            {notes.map((note) => (
              <SSNostrFeedNoteRow
                key={note.id}
                note={note}
                privacyMode={privacyMode}
                showAuthor
                authorPreview={renderFeedAuthorKind0Row(note)}
                onPress={() =>
                  onNotePress?.({
                    id: note.id,
                    kind: note.kind,
                    pubkey: note.pubkey
                  })
                }
              />
            ))}

            {notesLoading && (
              <ActivityIndicator
                color={Colors.white}
                size="small"
                style={styles.loader}
              />
            )}

            {!notesLoading && notes.length === 0 && (
              <SSText size="xs" color="muted" center style={styles.emptyText}>
                {t('nostrIdentity.feed.noNotes')}
              </SSText>
            )}

            {!notesLoading && notesHasMore && notes.length > 0 && (
              <SSButton
                label={t('nostrIdentity.feed.loadMore')}
                variant="ghost"
                onPress={() => loadNotes(true)}
              />
            )}
          </>
        )}

        {activeTab === 'feed' && (
          <>
            <TouchableOpacity
              style={styles.notesKindTrigger}
              activeOpacity={0.7}
              onPress={() => setFeedKindSheetOpen(true)}
            >
              <SSHStack gap="sm" style={styles.notesKindTriggerInner}>
                <View style={styles.notesKindTriggerLabel}>
                  <KindFilterLabelText label={feedKindLabel} size="xs" />
                </View>
                <SSText size="xs" color="muted">
                  ▾
                </SSText>
              </SSHStack>
            </TouchableOpacity>

            {feedNotes.map((note) => (
              <SSNostrFeedNoteRow
                key={note.id}
                note={note}
                privacyMode={privacyMode}
                showAuthor
                authorPreview={renderFeedAuthorKind0Row(note)}
                onPress={() =>
                  onNotePress?.({
                    id: note.id,
                    kind: note.kind,
                    pubkey: note.pubkey
                  })
                }
              />
            ))}

            {feedLoading && (
              <ActivityIndicator
                color={Colors.white}
                size="small"
                style={styles.loader}
              />
            )}

            {!feedLoading && feedFollowingEmpty && (
              <SSText size="xs" color="muted" center style={styles.emptyText}>
                {t('nostrIdentity.feed.noFollowing')}
              </SSText>
            )}

            {!feedLoading && !feedFollowingEmpty && feedNotes.length === 0 && (
              <SSText size="xs" color="muted" center style={styles.emptyText}>
                {t('nostrIdentity.feed.noFeed')}
              </SSText>
            )}

            {!feedLoading &&
              !feedFollowingEmpty &&
              feedHasMore &&
              feedNotes.length > 0 && (
                <SSButton
                  label={t('nostrIdentity.feed.loadMore')}
                  variant="ghost"
                  onPress={() => loadFeed(true)}
                />
              )}
          </>
        )}

        {activeTab === 'zaps' && (
          <>
            {zaps.map((receipt) => {
              const isOutgoing = receipt.direction === 'outgoing'
              const avatarUri = isOutgoing
                ? receipt.recipientPicture
                : receipt.senderPicture
              const displayName = isOutgoing
                ? receipt.recipientPubkey
                  ? receipt.recipientName ||
                    truncateNpub(nip19.npubEncode(receipt.recipientPubkey), 8)
                  : '?'
                : receipt.senderName ||
                  truncateNpub(nip19.npubEncode(receipt.senderPubkey), 8)
              const placeholderLetter = isOutgoing
                ? receipt.recipientName?.[0]?.toUpperCase() ||
                  receipt.recipientPubkey?.slice(2, 3)?.toUpperCase()
                : receipt.senderName?.[0]?.toUpperCase() || '?'

              const row = (
                <SSHStack gap="sm" style={styles.zapRow}>
                  {privacyMode ? (
                    <View
                      style={[styles.zapAvatar, styles.zapAvatarPlaceholder]}
                    />
                  ) : avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.zapAvatar}
                    />
                  ) : (
                    <View
                      style={[styles.zapAvatar, styles.zapAvatarPlaceholder]}
                    >
                      <SSText size="xs" weight="bold">
                        {placeholderLetter || '?'}
                      </SSText>
                    </View>
                  )}
                  <SSVStack gap="xxs" style={styles.zapInfo}>
                    {isOutgoing ? (
                      <SSText size="xxs" color="muted" uppercase>
                        {t('nostrIdentity.feed.outgoingZap')}
                      </SSText>
                    ) : null}
                    <SSText size="sm" weight="medium">
                      {privacyMode ? NOSTR_PRIVACY_MASK : displayName}
                    </SSText>
                    {!privacyMode && receipt.comment ? (
                      <SSText size="xs" color="muted" numberOfLines={2}>
                        {receipt.comment}
                      </SSText>
                    ) : null}
                  </SSVStack>
                  <SSVStack gap="xxs" style={styles.zapAmountCol}>
                    <SSText size="xxs" color="muted">
                      {formatNostrCardDate(receipt.createdAt)}
                    </SSText>
                    <SSText
                      size="sm"
                      weight="bold"
                      style={
                        !isOutgoing && !privacyMode
                          ? styles.zapAmountIncoming
                          : undefined
                      }
                    >
                      {privacyMode
                        ? `${NOSTR_PRIVACY_MASK} sats`
                        : `${receipt.amountSats} sats`}
                    </SSText>
                  </SSVStack>
                </SSHStack>
              )

              return onZapPress ? (
                <TouchableOpacity
                  key={receipt.id}
                  accessibilityRole="button"
                  activeOpacity={0.7}
                  onPress={() => onZapPress(receipt)}
                >
                  {row}
                </TouchableOpacity>
              ) : (
                <Fragment key={receipt.id}>{row}</Fragment>
              )
            })}

            {zapsLoading && (
              <ActivityIndicator
                color={Colors.white}
                size="small"
                style={styles.loader}
              />
            )}

            {!zapsLoading && zaps.length === 0 && (
              <SSText size="xs" color="muted" center style={styles.emptyText}>
                {t('nostrIdentity.feed.noZaps')}
              </SSText>
            )}

            {zapsHasMore && zaps.length > 0 && (
              <SSButton
                disabled={zapsLoading}
                label={t('nostrIdentity.feed.loadMore')}
                variant="ghost"
                onPress={() => loadZaps(true)}
              />
            )}
          </>
        )}
      </SSVStack>

      <Modal
        visible={notesKindSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setNotesKindSheetOpen(false)}
      >
        <View style={styles.kindSheetOverlay}>
          <TouchableOpacity
            style={styles.kindSheetBackdrop}
            activeOpacity={1}
            onPress={() => setNotesKindSheetOpen(false)}
          />
          <View style={styles.kindSheet}>
            <SSVStack gap="md">
              <SSText size="lg" weight="medium" center>
                {t('nostrIdentity.feed.kindFilterSheetTitle')}
              </SSText>
              <ScrollView
                style={styles.kindSheetScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <SSVStack gap="md">
                  {NOTE_KIND_FILTER_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={styles.kindOptionRow}
                      activeOpacity={0.6}
                      onPress={() => {
                        setNotesKindFilterId(opt.id)
                        setNotesKindSheetOpen(false)
                      }}
                    >
                      <KindFilterLabelText label={t(opt.labelKey)} />
                    </TouchableOpacity>
                  ))}
                </SSVStack>
              </ScrollView>
              <SSButton
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => setNotesKindSheetOpen(false)}
              />
            </SSVStack>
          </View>
        </View>
      </Modal>

      <Modal
        visible={feedKindSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFeedKindSheetOpen(false)}
      >
        <View style={styles.kindSheetOverlay}>
          <TouchableOpacity
            style={styles.kindSheetBackdrop}
            activeOpacity={1}
            onPress={() => setFeedKindSheetOpen(false)}
          />
          <View style={styles.kindSheet}>
            <SSVStack gap="md">
              <SSText size="lg" weight="medium" center>
                {t('nostrIdentity.feed.kindFilterSheetTitle')}
              </SSText>
              <ScrollView
                style={styles.kindSheetScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <SSVStack gap="md">
                  {NOTE_KIND_FILTER_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={styles.kindOptionRow}
                      activeOpacity={0.6}
                      onPress={() => {
                        setFeedKindFilterId(opt.id)
                        setFeedKindSheetOpen(false)
                      }}
                    >
                      <KindFilterLabelText label={t(opt.labelKey)} />
                    </TouchableOpacity>
                  ))}
                </SSVStack>
              </ScrollView>
              <SSButton
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => setFeedKindSheetOpen(false)}
              />
            </SSVStack>
          </View>
        </View>
      </Modal>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  emptyText: {
    paddingVertical: 24
  },
  kindOptionRow: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  kindSheet: {
    backgroundColor: Colors.gray[950],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 20
  },
  kindSheetBackdrop: {
    flex: 1
  },
  kindSheetOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flex: 1,
    justifyContent: 'flex-end'
  },
  kindSheetScroll: {
    maxHeight: 380
  },
  loader: {
    paddingVertical: 16
  },
  notesKindTrigger: {
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  notesKindTriggerInner: {
    alignItems: 'center',
    minWidth: 0
  },
  notesKindTriggerLabel: {
    flex: 1,
    minWidth: 0
  },
  tabBar: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingVertical: 0
  },
  tabButton: {
    flex: 1,
    height: 48,
    minWidth: 0
  },
  tabButtonInner: {
    flex: 1,
    justifyContent: 'center',
    width: '100%'
  },
  tabButtonWrap: {
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%'
  },
  tabContent: {
    paddingTop: 12
  },
  tabIndicator: {
    backgroundColor: Colors.white,
    bottom: -1,
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 1
  },
  zapAmountCol: {
    alignItems: 'flex-end'
  },
  zapAmountIncoming: {
    color: Colors.success
  },
  zapAvatar: {
    borderRadius: 16,
    height: 32,
    width: 32
  },
  zapAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  zapInfo: {
    flex: 1
  },
  zapRow: {
    alignItems: 'center',
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingBottom: 16,
    paddingTop: 8
  }
})

export default SSNostrFeedTabs
