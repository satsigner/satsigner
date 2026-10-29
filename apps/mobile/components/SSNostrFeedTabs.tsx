import { FlashList } from '@shopify/flash-list'
import { type ReactElement, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import {
  SSNostrKindFilterSheet,
  SSNostrKindFilterTrigger,
  SSNostrReplyFilterChip,
  ssnostrKindFilterRowStyle
} from '@/components/SSNostrKindFilter'
import SSNostrNoteList, {
  type NostrNotePressPayload,
  type OwnAuthorFallback
} from '@/components/SSNostrNoteList'
import SSNostrSourceBanner from '@/components/SSNostrSourceBanner'
import SSNostrZapList from '@/components/SSNostrZapList'
import SSText from '@/components/SSText'
import {
  NOSTR_BOOKMARKS_FILTER_IDS,
  NOSTR_NOTE_FILTER_OPTIONS
} from '@/constants/nostr'
import { useNostrFeedFetch } from '@/hooks/useNostrFeedFetch'
import { useNostrFollowsFetch } from '@/hooks/useNostrFollowsFetch'
import { useNostrNewNotesPoll } from '@/hooks/useNostrNewNotesPoll'
import { useNostrNotesFetch } from '@/hooks/useNostrNotesFetch'
import { useNostrZapsFetch } from '@/hooks/useNostrZapsFetch'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { Colors, Layout } from '@/styles'
import type {
  NostrEngagementSigner,
  NostrIdentity,
  ZapReceiptInfo,
  ZapSortField
} from '@/types/models/Nostr'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { filterFeedReplies } from '@/utils/nostrFeed'
import {
  applyZapSort,
  getNextZapSort,
  type ZapSortState
} from '@/utils/nostrZap'

import SSPressable from './SSPressable'

type FeedTab = 'feed' | 'notes' | 'zaps'

type FeedTabCallbacks = {
  onAuthorPress?: (authorNpub: string) => void
  onNotePress?: (payload: NostrNotePressPayload) => void
  onZapPress?: (receipt: ZapReceiptInfo) => void
}

type SSNostrFeedTabsProps = FeedTabCallbacks & {
  /** Rendered above the tab bar, inside the scrolling list (e.g. hero card). */
  header?: ReactElement
  npub: string
  relayConnected: boolean
  relays: string[]
}

type FeedTabContentProps = FeedTabCallbacks & {
  header: ReactElement
  identity?: NostrIdentity
  npub: string
  privacyMode: boolean
  relays: string[]
}

/** Feed tab excludes bookmark filters — those are personal lists, not following-timeline content. */
const FEED_KIND_FILTER_OPTIONS = NOSTR_NOTE_FILTER_OPTIONS.filter(
  (o) => !NOSTR_BOOKMARKS_FILTER_IDS.has(o.id)
)
const DEFAULT_KIND_FILTER_ID = NOSTR_NOTE_FILTER_OPTIONS[0].id
const SHORT_TEXT_FILTER_ID = 'short_text'
const NO_AUTHORS: string[] = []
const NO_PRIVATE_IDS = new Set<string>()
const DEFAULT_ZAP_SORT: ZapSortState = { asc: false, field: 'date' }

function getKindFilterLabel(id: string): string {
  const option = NOSTR_NOTE_FILTER_OPTIONS.find((o) => o.id === id)
  return option ? t(option.labelKey) : ''
}

function getOwnAuthorFallback(
  identity: NostrIdentity | undefined
): OwnAuthorFallback | undefined {
  const pubkey = identity ? getPubKeyHexFromNpub(identity.npub) : null
  if (!identity || !pubkey) {
    return undefined
  }
  return {
    displayName: identity.displayName,
    nip05: identity.nip05,
    picture: identity.picture,
    pubkey
  }
}

function getEngagementSigner(
  identity: NostrIdentity | undefined
): NostrEngagementSigner {
  return {
    isWatchOnly: Boolean(identity?.isWatchOnly),
    nsec: identity?.nsec,
    ownPubkey: identity ? (getPubKeyHexFromNpub(identity.npub) ?? '') : ''
  }
}

function getZapSortLabel(sort: ZapSortState, field: ZapSortField): string {
  const label = t(`nostrIdentity.zapSort.${field}`)
  if (sort.field !== field) {
    return label
  }
  return `${label}${sort.asc ? ' ↑' : ' ↓'}`
}

type TabButtonProps = {
  active: boolean
  label: string
  onPress: () => void
}

function TabButton({ active, label, onPress }: TabButtonProps) {
  return (
    <SSActionButton style={styles.tabButton} onPress={onPress}>
      <View style={styles.tabButtonWrap}>
        <SSVStack gap="none" itemsCenter style={styles.tabButtonInner}>
          <SSText size="sm" uppercase center color={active ? 'white' : 'muted'}>
            {label}
          </SSText>
        </SSVStack>
        {active ? <View style={styles.tabIndicator} /> : null}
      </View>
    </SSActionButton>
  )
}

type NewNotesPromptProps = {
  count: number
  onPress: () => void
}

function NewNotesPrompt({ count, onPress }: NewNotesPromptProps) {
  if (count === 0) {
    return null
  }
  return (
    <SSButton
      label={t('nostrIdentity.feed.newNotes', { count })}
      onPress={onPress}
      variant="subtle"
    />
  )
}

function NotesTabContent({
  header,
  identity,
  npub,
  onAuthorPress,
  onNotePress,
  privacyMode,
  relays
}: FeedTabContentProps) {
  const [kindFilterId, setKindFilterId] = useState(DEFAULT_KIND_FILTER_ID)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [excludeReplies, setExcludeReplies] = useState(true)
  const isBookmarks = NOSTR_BOOKMARKS_FILTER_IDS.has(kindFilterId)
  const isShortText = kindFilterId === SHORT_TEXT_FILTER_ID

  const notes = useNostrNotesFetch({
    enabled: true,
    kindFilterId,
    npub,
    nsec: identity?.nsec,
    relays,
    resolveQuotes: !privacyMode
  })
  const newCount = useNostrNewNotesPoll({
    authors: NO_AUTHORS,
    enabled: !isBookmarks,
    kindFilterId,
    newestCreatedAt: notes.notes[0]?.created_at ?? 0,
    npub,
    relays,
    tab: 'notes'
  })

  function openSheet() {
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
  }

  function selectKindFilter(id: string) {
    setKindFilterId(id)
    setExcludeReplies(id === SHORT_TEXT_FILTER_ID)
  }

  function toggleExcludeReplies() {
    setExcludeReplies((current) => !current)
  }

  const listHeader = (
    <View>
      {header}
      <SSVStack gap="sm" style={styles.tabHeader}>
        <SSHStack gap="md" style={ssnostrKindFilterRowStyle}>
          <SSNostrKindFilterTrigger
            label={getKindFilterLabel(kindFilterId)}
            onPress={openSheet}
          />
          {isShortText ? (
            <SSNostrReplyFilterChip
              active={!excludeReplies}
              label={t('nostrIdentity.feed.showReplies')}
              onPress={toggleExcludeReplies}
            />
          ) : null}
        </SSHStack>
        <SSNostrSourceBanner
          error={notes.error}
          onRetry={notes.refetch}
          retrying={notes.isRefetching}
          source={notes.source}
        />
        <NewNotesPrompt count={newCount} onPress={notes.showNewest} />
      </SSVStack>
    </View>
  )

  return (
    <View style={styles.fill}>
      <SSNostrNoteList
        engagementSigner={getEngagementSigner(identity)}
        emptyLabel={t('nostrIdentity.feed.noNotes')}
        fetchNextPage={notes.fetchNextPage}
        hasNextPage={notes.hasNextPage}
        header={listHeader}
        isFetchingNextPage={notes.isFetchingNextPage}
        isLoading={notes.isLoading}
        notes={filterFeedReplies(notes.notes, excludeReplies && isShortText)}
        onAuthorPress={onAuthorPress}
        onNotePress={onNotePress}
        ownAuthor={getOwnAuthorFallback(identity)}
        privacyMode={privacyMode}
        privateIds={notes.privateIds}
        relays={relays}
        resolved={notes.resolved}
      />
      <SSNostrKindFilterSheet
        visible={sheetOpen}
        onClose={closeSheet}
        options={NOSTR_NOTE_FILTER_OPTIONS}
        selectedId={kindFilterId}
        onSelect={selectKindFilter}
      />
    </View>
  )
}

function FollowingTabContent({
  header,
  identity,
  npub,
  onAuthorPress,
  onNotePress,
  privacyMode,
  relays
}: FeedTabContentProps) {
  const [kindFilterId, setKindFilterId] = useState(DEFAULT_KIND_FILTER_ID)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [excludeReplies, setExcludeReplies] = useState(true)
  const isShortText = kindFilterId === SHORT_TEXT_FILTER_ID

  const follows = useNostrFollowsFetch({ enabled: true, npub, relays })
  const authors = follows.data?.data.pubkeys ?? NO_AUTHORS
  const feed = useNostrFeedFetch({
    authors,
    enabled: true,
    followsUpdatedAt: follows.dataUpdatedAt,
    kindFilterId,
    npub,
    relays,
    resolveQuotes: !privacyMode
  })
  const newCount = useNostrNewNotesPoll({
    authors,
    enabled: authors.length > 0,
    kindFilterId,
    newestCreatedAt: feed.notes[0]?.created_at ?? 0,
    npub,
    relays,
    tab: 'feed'
  })

  const followsResult = follows.data
  const followingEmpty =
    followsResult?.source === 'relay' && followsResult.data.pubkeys.length === 0
  const followsDegraded = Boolean(
    followsResult && (followsResult.source !== 'relay' || followsResult.error)
  )

  function openSheet() {
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
  }

  function selectKindFilter(id: string) {
    setKindFilterId(id)
    setExcludeReplies(id === SHORT_TEXT_FILTER_ID)
  }

  function toggleExcludeReplies() {
    setExcludeReplies((current) => !current)
  }

  const listHeader = (
    <View>
      {header}
      <SSVStack gap="sm" style={styles.tabHeader}>
        <SSHStack gap="md" style={ssnostrKindFilterRowStyle}>
          <SSNostrKindFilterTrigger
            label={getKindFilterLabel(kindFilterId)}
            onPress={openSheet}
          />
          {isShortText ? (
            <SSNostrReplyFilterChip
              active={!excludeReplies}
              label={t('nostrIdentity.feed.showReplies')}
              onPress={toggleExcludeReplies}
            />
          ) : null}
        </SSHStack>
        {followsDegraded && followsResult ? (
          <SSNostrSourceBanner
            error={followsResult.error}
            onRetry={follows.refetch}
            retrying={follows.isRefetching}
            source={followsResult.source}
          />
        ) : (
          <SSNostrSourceBanner
            error={feed.error}
            onRetry={feed.refetch}
            retrying={feed.isRefetching}
            source={feed.source}
          />
        )}
        <NewNotesPrompt count={newCount} onPress={feed.showNewest} />
      </SSVStack>
    </View>
  )

  return (
    <View style={styles.fill}>
      <SSNostrNoteList
        engagementSigner={getEngagementSigner(identity)}
        emptyLabel={
          followingEmpty
            ? t('nostrIdentity.feed.noFollowing')
            : t('nostrIdentity.feed.noFeed')
        }
        fetchNextPage={feed.fetchNextPage}
        hasNextPage={feed.hasNextPage}
        header={listHeader}
        isFetchingNextPage={feed.isFetchingNextPage}
        isLoading={follows.isLoading || feed.isLoading}
        notes={filterFeedReplies(feed.notes, excludeReplies && isShortText)}
        onAuthorPress={onAuthorPress}
        onNotePress={onNotePress}
        ownAuthor={getOwnAuthorFallback(identity)}
        privacyMode={privacyMode}
        privateIds={NO_PRIVATE_IDS}
        relays={relays}
        resolved={feed.resolved}
      />
      <SSNostrKindFilterSheet
        visible={sheetOpen}
        onClose={closeSheet}
        options={FEED_KIND_FILTER_OPTIONS}
        selectedId={kindFilterId}
        onSelect={selectKindFilter}
      />
    </View>
  )
}

function ZapsTabContent({
  header,
  npub,
  onZapPress,
  privacyMode,
  relays
}: FeedTabContentProps) {
  const [sort, setSort] = useState(DEFAULT_ZAP_SORT)
  const pubkeyHex = getPubKeyHexFromNpub(npub) ?? ''
  const zaps = useNostrZapsFetch({
    enabled: true,
    ownPubkeys: pubkeyHex ? [pubkeyHex] : [],
    pubkeyHex,
    relays
  })

  function sortByDate() {
    setSort((current) => getNextZapSort(current, 'date'))
  }

  function sortByAmount() {
    setSort((current) => getNextZapSort(current, 'amount'))
  }

  const listHeader = (
    <View>
      {header}
      <SSVStack gap="sm" style={styles.tabHeader}>
        <SSNostrSourceBanner
          error={zaps.error}
          onRetry={zaps.refetch}
          retrying={zaps.isRefetching}
          source={zaps.source}
        />
        {zaps.zaps.length > 0 ? (
          <SSHStack gap="sm" style={styles.zapSortBar}>
            <SSPressable onPress={sortByDate} hitSlop={8}>
              <SSText
                size="xxs"
                color={sort.field === 'date' ? 'white' : 'muted'}
              >
                {getZapSortLabel(sort, 'date')}
              </SSText>
            </SSPressable>
            <SSPressable onPress={sortByAmount} hitSlop={8}>
              <SSText
                size="xxs"
                color={sort.field === 'amount' ? 'white' : 'muted'}
              >
                {getZapSortLabel(sort, 'amount')}
              </SSText>
            </SSPressable>
          </SSHStack>
        ) : null}
      </SSVStack>
    </View>
  )

  return (
    <View style={styles.fill}>
      <SSNostrZapList
        fetchNextPage={zaps.fetchNextPage}
        hasNextPage={zaps.hasNextPage}
        header={listHeader}
        isFetchingNextPage={zaps.isFetchingNextPage}
        isLoading={zaps.isLoading}
        onZapPress={onZapPress}
        privacyMode={privacyMode}
        relays={relays}
        zaps={applyZapSort(zaps.zaps, sort)}
      />
    </View>
  )
}

function renderNothing() {
  return null
}

/**
 * Zaps / notes / following feed for one identity. Each tab is its own
 * FlashList with `header` and the tab bar as the list header, so the whole
 * screen scrolls as one virtualized list.
 */
function SSNostrFeedTabs({
  header,
  npub,
  onAuthorPress,
  onNotePress,
  onZapPress,
  relayConnected,
  relays
}: SSNostrFeedTabsProps) {
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const [activeTab, setActiveTab] = useState<FeedTab>('zaps')

  function showZaps() {
    setActiveTab('zaps')
  }

  function showNotes() {
    setActiveTab('notes')
  }

  function showFeed() {
    setActiveTab('feed')
  }

  if (!relayConnected) {
    return (
      <FlashList
        data={[]}
        ListEmptyComponent={
          <SSText size="xs" color="muted" center style={styles.emptyText}>
            {t('nostrIdentity.feed.relayQueriesOff')}
          </SSText>
        }
        ListHeaderComponent={header}
        renderItem={renderNothing}
      />
    )
  }

  const tabsHeader = (
    <View>
      {header}
      <SSHStack gap="none" style={styles.tabBar}>
        <TabButton
          active={activeTab === 'zaps'}
          label={t('nostrIdentity.feed.zaps')}
          onPress={showZaps}
        />
        <TabButton
          active={activeTab === 'notes'}
          label={t('nostrIdentity.feed.notes')}
          onPress={showNotes}
        />
        <TabButton
          active={activeTab === 'feed'}
          label={t('nostrIdentity.feed.feed')}
          onPress={showFeed}
        />
      </SSHStack>
    </View>
  )

  const contentProps: FeedTabContentProps = {
    header: tabsHeader,
    identity,
    npub,
    onAuthorPress,
    onNotePress,
    onZapPress,
    privacyMode,
    relays
  }

  if (activeTab === 'notes') {
    return <NotesTabContent key={npub} {...contentProps} />
  }
  if (activeTab === 'feed') {
    return <FollowingTabContent key={npub} {...contentProps} />
  }
  return <ZapsTabContent key={npub} {...contentProps} />
}

const styles = StyleSheet.create({
  emptyText: {
    paddingVertical: 24
  },
  fill: {
    flex: 1
  },
  tabBar: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    marginHorizontal: Layout.mainContainer.paddingHorizontal,
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
  tabHeader: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
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
  zapSortBar: {
    alignItems: 'center',
    justifyContent: 'flex-end'
  }
})

export default SSNostrFeedTabs
