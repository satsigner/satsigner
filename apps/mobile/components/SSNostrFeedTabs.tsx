import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native'

import { NostrAPI } from '@/api/nostr'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { truncateNpub } from '@/utils/nostrIdentity'
import {
  type ZapReceiptInfo,
  enrichZapReceipts,
  fetchZapsByPubkey
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
  relays: string[]
  onNotePress?: (noteId: string) => void
}

const PAGE_SIZE = 10

function SSNostrFeedTabs({
  npub,
  relays,
  onNotePress
}: SSNostrFeedTabsProps) {
  const [activeTab, setActiveTab] = useState<'posts' | 'zaps'>('posts')

  const [notes, setNotes] = useState<NoteItem[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesHasMore, setNotesHasMore] = useState(true)
  const notesFetchedRef = useRef(false)

  const [zaps, setZaps] = useState<ZapReceiptInfo[]>([])
  const [zapsLoading, setZapsLoading] = useState(false)
  const [zapsHasMore, setZapsHasMore] = useState(true)
  const zapsFetchedRef = useRef(false)

  const loadNotes = useCallback(
    async (loadMore = false) => {
      if (notesLoading || !relays.length) return

      setNotesLoading(true)
      try {
        const until = loadMore && notes.length > 0
          ? notes[notes.length - 1].created_at
          : undefined

        const api = new NostrAPI(relays)
        const fetched = await api.fetchNotes(npub, PAGE_SIZE, until)

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
        // non-critical
      } finally {
        setNotesLoading(false)
      }
    },
    [npub, relays, notes, notesLoading]
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

        const fetched = await fetchZapsByPubkey(
          hexPubkey,
          relays,
          PAGE_SIZE,
          until
        )

        if (fetched.length < PAGE_SIZE) {
          setZapsHasMore(false)
        }

        const allZaps = loadMore
          ? [...zaps, ...fetched]
          : fetched

        setZaps(allZaps)
        await enrichZapReceipts(allZaps, relays)
        setZaps([...allZaps])
      } catch {
        // non-critical
      } finally {
        setZapsLoading(false)
      }
    },
    [npub, relays, zaps, zapsLoading]
  )

  useEffect(() => {
    if (activeTab === 'posts' && !notesFetchedRef.current) {
      notesFetchedRef.current = true
      loadNotes()
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'zaps' && !zapsFetchedRef.current) {
      zapsFetchedRef.current = true
      loadZaps()
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <SSVStack gap="none">
      <SSHStack gap="none" style={styles.tabBar}>
        <SSActionButton
          style={styles.tab}
          onPress={() => setActiveTab('posts')}
        >
          <SSVStack gap="none" itemsCenter>
            <SSText
              size="sm"
              uppercase
              color={activeTab === 'posts' ? 'white' : 'muted'}
            >
              {t('nostrIdentity.feed.posts')}
            </SSText>
            {activeTab === 'posts' && <View style={styles.tabIndicator} />}
          </SSVStack>
        </SSActionButton>
        <SSActionButton
          style={styles.tab}
          onPress={() => setActiveTab('zaps')}
        >
          <SSVStack gap="none" itemsCenter>
            <SSText
              size="sm"
              uppercase
              color={activeTab === 'zaps' ? 'white' : 'muted'}
            >
              {t('nostrIdentity.feed.zaps')}
            </SSText>
            {activeTab === 'zaps' && <View style={styles.tabIndicator} />}
          </SSVStack>
        </SSActionButton>
      </SSHStack>

      <SSVStack gap="sm" style={styles.tabContent}>
        {activeTab === 'posts' && (
          <>
            {notes.map((note) => (
              <TouchableOpacity
                key={note.id}
                style={styles.noteRow}
                activeOpacity={0.6}
                onPress={() => onNotePress?.(note.id)}
              >
                <SSVStack gap="xs">
                  <SSText size="sm" style={styles.noteContent} numberOfLines={4}>
                    {note.content}
                  </SSText>
                  <SSText size="xxs" color="muted">
                    {formatTimestamp(note.created_at)}
                  </SSText>
                </SSVStack>
              </TouchableOpacity>
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
                {t('nostrIdentity.feed.noPosts')}
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

        {activeTab === 'zaps' && (
          <>
            {zaps.map((receipt, idx) => (
              <SSHStack key={idx} gap="sm" style={styles.zapRow}>
                {receipt.senderPicture ? (
                  <Image
                    source={{ uri: receipt.senderPicture }}
                    style={styles.zapAvatar}
                  />
                ) : (
                  <View style={[styles.zapAvatar, styles.zapAvatarPlaceholder]}>
                    <SSText size="xs" weight="bold">
                      {receipt.senderName?.[0]?.toUpperCase() || '?'}
                    </SSText>
                  </View>
                )}
                <SSVStack gap="none" style={styles.zapInfo}>
                  <SSText size="sm" weight="medium">
                    {receipt.senderName ||
                      truncateNpub(
                        nip19.npubEncode(receipt.senderPubkey),
                        8
                      )}
                  </SSText>
                  {receipt.comment ? (
                    <SSText size="xs" color="muted" numberOfLines={2}>
                      {receipt.comment}
                    </SSText>
                  ) : null}
                </SSVStack>
                <SSVStack gap="none" style={styles.zapAmountCol}>
                  <SSText size="sm" weight="bold">
                    {receipt.amountSats} sats
                  </SSText>
                  <SSText size="xxs" color="muted">
                    {formatTimestamp(receipt.createdAt)}
                  </SSText>
                </SSVStack>
              </SSHStack>
            ))}

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
  noteRow: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    padding: 12
  },
  tab: {
    width: '50%'
  },
  tabBar: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingVertical: 4
  },
  tabContent: {
    paddingTop: 12
  },
  tabIndicator: {
    alignSelf: 'center',
    backgroundColor: Colors.white,
    height: 2,
    marginTop: 4,
    width: '60%'
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
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  }
})

export default SSNostrFeedTabs
