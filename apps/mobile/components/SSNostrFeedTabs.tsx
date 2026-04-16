import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { type NostrKind0Profile } from '@/types/models/Nostr'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSNoteInlineImages from '@/components/SSNoteInlineImages'
import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type TextFontSize, type TextFontWeight } from '@/styles/sizes'
import { truncateNpub } from '@/utils/nostrIdentity'
import { extractImageUrlsFromNote } from '@/utils/nostrNoteMedia'
import { noteLooksLikeReply } from '@/utils/nostrNoteThread'
import {
  type ZapReceiptInfo,
  enrichZapReceipts,
  fetchZapsByPubkey,
  fetchZapsSentByPubkey,
  mergeZapReceiptsById
} from '@/utils/zap'

type NoteItem = {
  id: string
  content: string
  pubkey: string
  kind: number
  tags: string[][]
  created_at: number
}

type SSNostrFeedTabsProps = {
  npub: string
  relayConnected: boolean
  relays: string[]
  onNotePress?: (payload: {
    id: string
    kind: number
    pubkey: string
  }) => void
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

function getDTagFromTags(tags: string[][]): string | undefined {
  const row = tags.find((tag) => tag[0] === 'd')
  return typeof row?.[1] === 'string' ? row[1] : undefined
}

function encodeNotePrimaryNip19(note: NoteItem): string {
  try {
    const d = getDTagFromTags(note.tags)
    if (
      d &&
      note.pubkey &&
      (note.kind === 1063 ||
        (note.kind >= 30000 && note.kind < 40000))
    ) {
      return nip19.naddrEncode({
        identifier: d,
        kind: note.kind,
        pubkey: note.pubkey
      })
    }
    if (note.kind !== 1 && note.pubkey) {
      return nip19.neventEncode({
        id: note.id,
        author: note.pubkey,
        kind: note.kind
      })
    }
    return nip19.noteEncode(note.id)
  } catch {
    return note.id
  }
}

function trimDropdownLabel(text: string): string {
  if (text.length <= DROPDOWN_LABEL_MAX_CHARS) return text
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
  onNotePress
}: SSNostrFeedTabsProps) {
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const [activeTab, setActiveTab] = useState<FeedTab>('zaps')

  const [notes, setNotes] = useState<NoteItem[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesHasMore, setNotesHasMore] = useState(true)
  const notesFetchedRef = useRef(false)
  const [notesKindFilterId, setNotesKindFilterId] = useState(
    DEFAULT_KIND_FILTER_ID
  )
  const [notesKindSheetOpen, setNotesKindSheetOpen] = useState(false)

  const [feedNotes, setFeedNotes] = useState<NoteItem[]>([])
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

  const apiRef = useRef<NostrAPI | null>(null)
  const relaysKey = JSON.stringify(relays)

  useEffect(() => {
    apiRef.current?.closeAllSubscriptions()
    apiRef.current = relays.length ? new NostrAPI(relays) : null
    return () => {
      apiRef.current?.closeAllSubscriptions()
      apiRef.current = null
    }
  }, [relaysKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadNotes = useCallback(
    async (loadMore = false) => {
      if (notesLoading || !apiRef.current) return

      setNotesLoading(true)
      try {
        const until = loadMore && notes.length > 0
          ? notes[notes.length - 1].created_at
          : undefined

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
      if (feedLoading || !apiRef.current) return

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

        const until =
          loadMore && feedNotes.length > 0
            ? feedNotes[feedNotes.length - 1].created_at
            : undefined

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
      if (zapsLoading || !relays.length) return

      setZapsLoading(true)
      try {
        const hexPubkey = nip19.decode(npub).data as string
        const until = loadMore && zaps.length > 0
          ? zaps[zaps.length - 1].createdAt
          : undefined

        const [incomingBatch, sentBatch] = await Promise.all([
          fetchZapsByPubkey(hexPubkey, relays, PAGE_SIZE, until),
          fetchZapsSentByPubkey(hexPubkey, relays, PAGE_SIZE, until)
        ])

        const fetched = mergeZapReceiptsById([...incomingBatch, ...sentBatch])
        const incomingHasMore = incomingBatch.length >= PAGE_SIZE
        const sentHasMore = sentBatch.length >= PAGE_SIZE
        setZapsHasMore(incomingHasMore || sentHasMore)

        const allZaps = loadMore
          ? mergeZapReceiptsById([...zaps, ...fetched])
          : fetched

        setZaps(allZaps)
        await enrichZapReceipts(allZaps, relays)
        setZaps([...allZaps])
      } catch {
        // fetch failed — UI already shows empty state
      } finally {
        setZapsLoading(false)
      }
    },
    [npub, relays, zaps, zapsLoading]
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
      ...new Set(feedNotes.map((n) => n.pubkey.toLowerCase()))
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
            [pk]: { status: 'ready', profile }
          }))
        })
        .catch(() => {
          setFeedAuthorKind0((prev) => ({
            ...prev,
            [pk]: { status: 'ready', profile: null }
          }))
        })
    }
  }, [feedNotes, relayConnected, privacyMode])

  function formatTimestamp(ts: number): string {
    if (!ts) return ''
    const now = Date.now() / 1000
    const diff = now - ts
    if (diff < 60) return 'now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`
    return new Date(ts * 1000).toLocaleDateString()
  }

  function renderFeedAuthorKind0Row(note: NoteItem) {
    const pk = note.pubkey.toLowerCase()
    const npubBech = nip19.npubEncode(note.pubkey)
    const row = feedAuthorKind0[pk]

    if (!row || row.status === 'loading') {
      return (
        <SSHStack gap="md" style={styles.feedAuthorRow}>
          <View
            style={[styles.feedAuthorAvatar, styles.feedAuthorAvatarSkeleton]}
          />
          <SSVStack gap="xxs" style={styles.feedAuthorTextCol}>
            <View style={styles.skeletonLineLg} />
            <SSText
              size="xxs"
              color="muted"
              type="mono"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {truncateNpub(npubBech, 14)}
            </SSText>
            <View style={styles.skeletonLineMd} />
          </SSVStack>
        </SSHStack>
      )
    }

    const p = row.profile
    const name = p?.displayName?.trim() ?? ''
    const nip05 = p?.nip05?.trim() ?? ''
    const pictureUri = p?.picture?.trim()

    return (
      <SSHStack gap="md" style={styles.feedAuthorRow}>
        {pictureUri ? (
          <Image
            source={{ uri: pictureUri }}
            style={styles.feedAuthorAvatar}
          />
        ) : (
          <View
            style={[
              styles.feedAuthorAvatar,
              styles.feedAuthorAvatarPlaceholder
            ]}
          >
            <SSText size="sm" weight="bold">
              {name
                ? name[0]?.toUpperCase()
                : npubBech.slice(5, 6)?.toUpperCase() || '?'}
            </SSText>
          </View>
        )}
        <SSVStack gap="xxs" style={styles.feedAuthorTextCol}>
          <SSText
            size="sm"
            weight="medium"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {name || '—'}
          </SSText>
          <SSText
            size="xxs"
            color="muted"
            type="mono"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {truncateNpub(npubBech, 14)}
          </SSText>
          <SSText
            size="xxs"
            color="muted"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {nip05 || '—'}
          </SSText>
        </SSVStack>
      </SSHStack>
    )
  }

  function renderNoteRow(
    note: NoteItem,
    showAuthor: boolean,
    showNoteNipIds = false
  ) {
    const imageUrls = privacyMode
      ? []
      : extractImageUrlsFromNote(note.content, note.tags).slice(0, 6)

    const eventNip19 = !privacyMode ? encodeNotePrimaryNip19(note) : ''
    const authorNpub = !privacyMode ? nip19.npubEncode(note.pubkey) : ''
    const showReplyTag = !privacyMode && noteLooksLikeReply(note.tags)
    const hasMetaAbove = !privacyMode && (showAuthor || showNoteNipIds)

    return (
      <TouchableOpacity
        key={note.id}
        style={styles.noteRow}
        activeOpacity={0.6}
        onPress={() =>
          onNotePress?.({
            id: note.id,
            kind: note.kind,
            pubkey: note.pubkey
          })
        }
      >
        {showReplyTag ? (
          <View style={styles.noteReplyTag} pointerEvents="none">
            <SSText size="xxs" color="white" uppercase style={styles.noteReplyTagText}>
              {t('nostrIdentity.feed.replyTag')}
            </SSText>
          </View>
        ) : null}
        <SSVStack
          gap="xs"
          style={showReplyTag ? styles.noteRowBodyWithReply : undefined}
        >
          {showNoteNipIds && !privacyMode ? (
            <SSVStack gap="xxs" style={styles.noteMetaAboveContent}>
              <SSText
                size="xxs"
                color="muted"
                type="mono"
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {truncateNpub(eventNip19, 16)}
              </SSText>
              <SSText
                size="xxs"
                color="muted"
                type="mono"
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {truncateNpub(authorNpub, 14)}
              </SSText>
            </SSVStack>
          ) : null}
          {showAuthor && !privacyMode ? renderFeedAuthorKind0Row(note) : null}
          <SSText
            size="sm"
            style={[
              styles.noteContent,
              hasMetaAbove && styles.noteContentAfterMeta
            ]}
            numberOfLines={4}
          >
            {privacyMode
              ? t('nostrIdentity.feed.hiddenInPrivacyMode')
              : note.content}
          </SSText>
          {imageUrls.length > 0 ? (
            <SSNoteInlineImages
              uris={imageUrls}
              style={styles.noteInlineImages}
            />
          ) : null}
          <SSText size="xxs" color="muted">
            {formatTimestamp(note.created_at)}
          </SSText>
        </SSVStack>
      </TouchableOpacity>
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
            {activeTab === 'zaps' ? (
              <View style={styles.tabIndicator} />
            ) : null}
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
            {activeTab === 'feed' ? (
              <View style={styles.tabIndicator} />
            ) : null}
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

            {notes.map((note) => renderNoteRow(note, false, true))}

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

            {feedNotes.map((note) => renderNoteRow(note, true))}

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

            {!feedLoading &&
              !feedFollowingEmpty &&
              feedNotes.length === 0 && (
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
                    truncateNpub(
                      nip19.npubEncode(receipt.recipientPubkey),
                      8
                    )
                  : '?'
                : receipt.senderName ||
                  truncateNpub(
                    nip19.npubEncode(receipt.senderPubkey),
                    8
                  )
              const placeholderLetter = isOutgoing
                ? receipt.recipientName?.[0]?.toUpperCase() ||
                  receipt.recipientPubkey?.slice(2, 3)?.toUpperCase()
                : receipt.senderName?.[0]?.toUpperCase() || '?'

              return (
              <SSHStack key={receipt.id} gap="sm" style={styles.zapRow}>
                {privacyMode ? (
                  <View style={[styles.zapAvatar, styles.zapAvatarPlaceholder]} />
                ) : avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.zapAvatar}
                  />
                ) : (
                  <View style={[styles.zapAvatar, styles.zapAvatarPlaceholder]}>
                    <SSText size="xs" weight="bold">
                      {placeholderLetter || '?'}
                    </SSText>
                  </View>
                )}
                <SSVStack gap="xxs" style={styles.zapInfo}>
                  <SSText size="xxs" color="muted" uppercase>
                    {isOutgoing
                      ? t('nostrIdentity.feed.outgoingZap')
                      : t('nostrIdentity.feed.incomingZap')}
                  </SSText>
                  <SSText size="sm" weight="medium">
                    {privacyMode ? NOSTR_PRIVACY_MASK : displayName}
                  </SSText>
                  {!privacyMode && receipt.comment ? (
                    <SSText size="xs" color="muted" numberOfLines={2}>
                      {receipt.comment}
                    </SSText>
                  ) : null}
                </SSVStack>
                <SSVStack gap="none" style={styles.zapAmountCol}>
                  <SSText size="sm" weight="bold">
                    {privacyMode
                      ? `${NOSTR_PRIVACY_MASK} sats`
                      : `${receipt.amountSats} sats`}
                  </SSText>
                  <SSText size="xxs" color="muted">
                    {formatTimestamp(receipt.createdAt)}
                  </SSText>
                </SSVStack>
              </SSHStack>
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

            {!zapsLoading && zapsHasMore && zaps.length > 0 && (
              <SSButton
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
  loader: {
    paddingVertical: 16
  },
  noteContent: {
    color: Colors.white,
    fontSize: 14,
    lineHeight: 20
  },
  noteContentAfterMeta: {
    marginTop: 16
  },
  noteInlineImages: {
    marginTop: 4
  },
  noteRow: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingVertical: 12,
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
    right: 0,
    top: 0,
    zIndex: 1
  },
  noteReplyTagText: {
    letterSpacing: 0.5
  },
  noteRowBodyWithReply: {
    paddingRight: 52
  },
  feedAuthorRow: {
    alignItems: 'center'
  },
  feedAuthorAvatar: {
    borderRadius: 20,
    height: 40,
    width: 40
  },
  feedAuthorAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  feedAuthorAvatarSkeleton: {
    backgroundColor: 'rgba(255,255,255,0.05)'
  },
  feedAuthorTextCol: {
    flex: 1,
    minWidth: 0
  },
  noteMetaAboveContent: {
    marginBottom: 4
  },
  skeletonLineLg: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderRadius: 2,
    height: 9,
    width: '58%'
  },
  skeletonLineMd: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: 2,
    height: 8,
    width: '38%'
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
  kindSheetOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flex: 1,
    justifyContent: 'flex-end'
  },
  kindSheetBackdrop: {
    flex: 1
  },
  kindSheet: {
    backgroundColor: Colors.gray[950],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 20
  },
  kindOptionRow: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  kindSheetScroll: {
    maxHeight: 380
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
  tabButtonWrap: {
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%'
  },
  tabButtonInner: {
    flex: 1,
    justifyContent: 'center',
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
    paddingVertical: 12
  }
})

export default SSNostrFeedTabs
