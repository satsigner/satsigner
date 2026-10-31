import { FlashList } from '@shopify/flash-list'
import { nip19 } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'
import { type ReactElement } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSIconLock from '@/components/icons/SSIconLock'
import {
  SSNostrFeedAuthorRow,
  SSNostrFeedNoteRow
} from '@/components/SSNostrFeedNoteRow'
import SSText from '@/components/SSText'
import { NOSTR_FEED_END_REACHED_THRESHOLD } from '@/constants/nostr'
import { useNostrVideoAutoplay } from '@/hooks/useNostrVideoAutoplay'
import { useNostrVisibleItemsTrack } from '@/hooks/useNostrVisibleItemsTrack'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import {
  type NostrProfilesRecord,
  pickNostrProfiles,
  useNostrProfilesStore
} from '@/store/nostrProfiles'
import { Colors, Layout } from '@/styles'
import type { NostrFeedNoteLike } from '@/types/models/Nostr'
import {
  getNoteProfilePubkeys,
  getResolvedQuotedNote,
  parseNoteContent
} from '@/utils/nostrNoteContent'

type NostrNotePressPayload = { id: string; kind: number; pubkey: string }

type OwnAuthorFallback = {
  displayName?: string
  nip05?: string
  picture?: string
  pubkey: string
}

type NoteRowHandlers = {
  onAuthorPress?: (authorNpub: string) => void
  onNotePress?: (payload: NostrNotePressPayload) => void
}

type NoteListRowProps = NoteRowHandlers & {
  isPrivate: boolean
  note: NostrFeedNoteLike
  ownAuthor?: OwnAuthorFallback
  privacyMode: boolean
  resolvedNote?: NostrFeedNoteLike
}

type SSNostrNoteListProps = NoteRowHandlers & {
  emptyLabel: string
  fetchNextPage: () => void
  hasNextPage: boolean
  header: ReactElement
  isFetchingNextPage: boolean
  isLoading: boolean
  notes: NostrFeedNoteLike[]
  ownAuthor?: OwnAuthorFallback
  privacyMode: boolean
  privateIds: Set<string>
  relays: string[]
  resolved: Map<string, NostrFeedNoteLike>
}

function DecryptedBadge() {
  return (
    <SSHStack gap="xxs" style={styles.decryptedBadge}>
      <SSIconLock width={10} height={10} />
      <SSText size="xxs" color="muted" uppercase>
        {t('nostrIdentity.feed.decrypted')}
      </SSText>
    </SSHStack>
  )
}

function getAuthorDisplay(
  pubkey: string,
  profiles: NostrProfilesRecord,
  ownAuthor?: OwnAuthorFallback
) {
  const pk = pubkey.toLowerCase()
  const profile = profiles[pk]
  const fallback = ownAuthor?.pubkey === pk && !profile ? ownAuthor : undefined
  return {
    displayName: (profile?.displayName ?? fallback?.displayName ?? '').trim(),
    loading: !(pk in profiles) && !fallback,
    nip05: (profile?.nip05 ?? fallback?.nip05 ?? '').trim(),
    pictureUri:
      (profile?.picture ?? fallback?.picture ?? '').trim() || undefined
  }
}

function NoteListRow({
  isPrivate,
  note,
  onAuthorPress,
  onNotePress,
  ownAuthor,
  privacyMode,
  resolvedNote
}: NoteListRowProps) {
  const profiles = useNostrProfilesStore(
    useShallow((state) =>
      pickNostrProfiles(
        state.profiles,
        getNoteProfilePubkeys(note, resolvedNote)
      )
    )
  )
  const authorNpub = nip19.npubEncode(note.pubkey)
  const author = getAuthorDisplay(note.pubkey, profiles, ownAuthor)
  const resolvedProfile = resolvedNote
    ? profiles[resolvedNote.pubkey.toLowerCase()]
    : undefined

  function handleAuthorPress() {
    onAuthorPress?.(authorNpub)
  }

  function handlePress() {
    onNotePress?.({ id: note.id, kind: note.kind, pubkey: note.pubkey })
  }

  function handleQuotePress(id: string) {
    const target = resolvedNote?.id === id ? resolvedNote : null
    onNotePress?.({
      id,
      kind: target?.kind ?? nostrKinds.ShortTextNote,
      pubkey: target?.pubkey ?? ''
    })
  }

  return (
    <View style={styles.row}>
      <SSNostrFeedNoteRow
        note={note}
        privacyMode={privacyMode}
        showAuthor
        authorPreview={
          <SSNostrFeedAuthorRow
            onPress={onAuthorPress ? handleAuthorPress : undefined}
            loading={author.loading}
            npubBech={authorNpub}
            displayName={author.displayName}
            nip05={author.nip05}
            pictureUri={author.pictureUri}
          />
        }
        badge={isPrivate ? <DecryptedBadge /> : undefined}
        resolvedQuotedNote={resolvedNote}
        resolvedQuotedNoteProfile={resolvedProfile}
        mentionProfiles={profiles}
        onPress={handlePress}
        onQuotePress={handleQuotePress}
      />
    </View>
  )
}

function keyExtractor(item: NostrFeedNoteLike) {
  return item.id
}

/**
 * Notes as a FlashList with the screen header on top. Profiles load only
 * for the rows on screen (plus a small window) via the shared batcher, and
 * each row subscribes to just the profiles it shows.
 */
function SSNostrNoteList({
  emptyLabel,
  fetchNextPage,
  hasNextPage,
  header,
  isFetchingNextPage,
  isLoading,
  notes,
  onAuthorPress,
  onNotePress,
  ownAuthor,
  privacyMode,
  privateIds,
  relays,
  resolved
}: SSNostrNoteListProps) {
  function getNotePubkeys(note: NostrFeedNoteLike) {
    return getNoteProfilePubkeys(note, getResolvedQuotedNote(note, resolved))
  }

  const { reportVisibleVideos } = useNostrVideoAutoplay()

  function handleVisibleNotes(visible: NostrFeedNoteLike[]) {
    reportVisibleVideos(
      visible.flatMap((note) =>
        parseNoteContent(note, getResolvedQuotedNote(note, resolved))
          .videoEmbeds.filter((embed) => embed.provider === 'direct')
          .map((embed) => embed.watchUrl)
      )
    )
  }

  const { onViewableItemsChanged } = useNostrVisibleItemsTrack({
    enabled: !privacyMode,
    getPubkeys: getNotePubkeys,
    items: notes,
    onVisibleItems: handleVisibleNotes,
    relays
  })

  function handleEndReached() {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  function renderItem({ item }: { item: NostrFeedNoteLike }) {
    return (
      <NoteListRow
        isPrivate={privateIds.has(item.id)}
        note={item}
        onAuthorPress={onAuthorPress}
        onNotePress={onNotePress}
        ownAuthor={ownAuthor}
        privacyMode={privacyMode}
        resolvedNote={getResolvedQuotedNote(item, resolved)}
      />
    )
  }

  const showSpinner = isLoading || isFetchingNextPage

  return (
    <FlashList
      data={notes}
      keyExtractor={keyExtractor}
      ListEmptyComponent={
        showSpinner ? null : (
          <SSText size="xs" color="muted" center style={styles.emptyText}>
            {emptyLabel}
          </SSText>
        )
      }
      ListFooterComponent={
        showSpinner ? (
          <ActivityIndicator
            color={Colors.white}
            size="small"
            style={styles.loader}
          />
        ) : null
      }
      ListHeaderComponent={header}
      onEndReached={handleEndReached}
      onEndReachedThreshold={NOSTR_FEED_END_REACHED_THRESHOLD}
      onViewableItemsChanged={onViewableItemsChanged}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
    />
  )
}

const styles = StyleSheet.create({
  decryptedBadge: {
    alignItems: 'center',
    opacity: 0.7
  },
  emptyText: {
    paddingVertical: 24
  },
  loader: {
    paddingVertical: 16
  },
  row: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal
  }
})

export default SSNostrNoteList
export type { NostrNotePressPayload, OwnAuthorFallback }
