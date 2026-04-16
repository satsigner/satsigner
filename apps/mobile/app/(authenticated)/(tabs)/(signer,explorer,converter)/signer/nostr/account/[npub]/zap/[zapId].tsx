import { NostrAPI } from '@/api/nostr'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  View
} from 'react-native'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSNoteInlineImages from '@/components/SSNoteInlineImages'
import SSNoteInlineVideos from '@/components/SSNoteInlineVideos'
import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { formatNostrCardDate } from '@/utils/format'
import { truncateNpub } from '@/utils/nostrIdentity'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { extractImageUrlsFromNote } from '@/utils/nostrNoteMedia'
import { extractVideoEmbedsFromNote } from '@/utils/nostrNoteVideoUrls'
import { nostrNoteHref } from '@/utils/nostrNavigation'
import {
  enrichZapReceipts,
  fetchZapReceiptById,
  type ZapReceiptInfo
} from '@/utils/zap'

type ZapParams = {
  npub: string
  zapId: string
}

type LoadState = 'idle' | 'loading' | 'error' | 'ready'

type ReferencedNotePreview = {
  content: string
  tags: string[][]
}

export default function NostrZapDetail() {
  const router = useRouter()
  const { npub, zapId } = useLocalSearchParams<ZapParams>()
  const relays = useNostrIdentityStore((state) => state.relays)
  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [receipt, setReceipt] = useState<ZapReceiptInfo | null>(null)
  const [referencedNote, setReferencedNote] =
    useState<ReferencedNotePreview | null>(null)

  useEffect(() => {
    if (!npub || !zapId || !identity) {
      setLoadState('error')
      return
    }

    const effectiveRelays = identity.relays?.length ? identity.relays : relays
    const profileHex = getPubKeyHexFromNpub(npub)
    if (!profileHex || effectiveRelays.length === 0) {
      setLoadState('error')
      return
    }

    const alive = { current: true }
    setLoadState('loading')

    fetchZapReceiptById(zapId, profileHex, effectiveRelays)
      .then(async (r) => {
        if (!alive.current) return
        if (!r) {
          setReceipt(null)
          setLoadState('error')
          return
        }
        await enrichZapReceipts([r], effectiveRelays)
        if (!alive.current) return
        setReceipt(r)
        setLoadState('ready')
      })
      .catch(() => {
        if (!alive.current) return
        setReceipt(null)
        setLoadState('error')
      })

    return () => {
      alive.current = false
    }
  }, [npub, zapId, identity, relays])

  useEffect(() => {
    if (!receipt?.zappedEventId || !identity) {
      setReferencedNote(null)
      return
    }

    const effectiveRelays = identity.relays?.length ? identity.relays : relays
    if (effectiveRelays.length === 0) {
      setReferencedNote(null)
      return
    }

    const alive = { current: true }
    setReferencedNote(null)

    NostrAPI.fetchEventFromRelays(receipt.zappedEventId, effectiveRelays)
      .then((ev) => {
        if (!alive.current || !ev) return
        const content = ev.content ?? ''
        const tags = ev.tags ?? []
        const imageCount = extractImageUrlsFromNote(content, tags).length
        const videoCount = extractVideoEmbedsFromNote(content, tags).length
        if (!content.trim() && imageCount === 0 && videoCount === 0) return
        setReferencedNote({ content, tags })
      })
      .catch(() => {
        if (!alive.current) return
        setReferencedNote(null)
      })

    return () => {
      alive.current = false
    }
  }, [receipt?.zappedEventId, identity, relays])

  async function handleOpenReferencedNote() {
    if (!receipt?.zappedEventId || !npub || !identity) return
    const effectiveRelays = identity.relays?.length ? identity.relays : relays
    if (effectiveRelays.length === 0) return

    const note = await NostrAPI.fetchEventFromRelays(
      receipt.zappedEventId,
      effectiveRelays
    )
    if (!note) return

    const nevent = nip19.neventEncode({
      id: receipt.zappedEventId,
      author: note.pubkey,
      kind: note.kind
    })
    router.navigate(nostrNoteHref(npub, nevent))
  }

  const allPreviewImageUrls =
    referencedNote == null
      ? []
      : extractImageUrlsFromNote(
          referencedNote.content,
          referencedNote.tags
        )

  const previewImageUrls = privacyMode
    ? []
    : allPreviewImageUrls.slice(0, 6)

  const allPreviewVideoEmbeds = useMemo(() => {
    if (referencedNote == null) return []
    return extractVideoEmbedsFromNote(
      referencedNote.content,
      referencedNote.tags
    )
  }, [referencedNote])

  const previewVideoEmbeds = privacyMode
    ? []
    : allPreviewVideoEmbeds.slice(0, 4)

  const counterpartyProfile = useMemo(() => {
    if (!receipt) {
      return null
    }
    if (receipt.direction === 'incoming') {
      return {
        lud16: receipt.senderLud16,
        name: receipt.senderName,
        nip05: receipt.senderNip05,
        picture: receipt.senderPicture,
        pubkeyHex: receipt.senderPubkey
      }
    }
    if (!receipt.recipientPubkey) {
      return null
    }
    return {
      lud16: receipt.recipientLud16,
      name: receipt.recipientName,
      nip05: receipt.recipientNip05,
      picture: receipt.recipientPicture,
      pubkeyHex: receipt.recipientPubkey
    }
  }, [receipt])

  const counterpartyNpub = useMemo(() => {
    if (!counterpartyProfile?.pubkeyHex) {
      return ''
    }
    try {
      return nip19.npubEncode(counterpartyProfile.pubkeyHex)
    } catch {
      return ''
    }
  }, [counterpartyProfile?.pubkeyHex])

  if (!identity) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.empty}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.zapDetail.title')}</SSText>
          )
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loadState === 'loading' ? (
          <ActivityIndicator color={Colors.white} style={styles.loader} />
        ) : null}
        {loadState === 'error' || (loadState === 'ready' && !receipt) ? (
          <SSText color="muted">{t('nostrIdentity.zapDetail.loadError')}</SSText>
        ) : null}
        {loadState === 'ready' && receipt ? (
          <SSVStack gap="md">
            {counterpartyProfile && counterpartyNpub ? (
              <SSVStack gap="sm" style={styles.profileCard}>
                <SSText size="xxs" color="muted" uppercase>
                  {receipt.direction === 'incoming'
                    ? t('nostrIdentity.zapDetail.profileIncoming')
                    : t('nostrIdentity.zapDetail.profileOutgoing')}
                </SSText>
                <SSHStack gap="md" style={styles.profileRow}>
                  {privacyMode ? (
                    <View
                      style={[
                        styles.profileAvatar,
                        styles.profileAvatarPlaceholder
                      ]}
                    />
                  ) : counterpartyProfile.picture ? (
                    <Image
                      source={{ uri: counterpartyProfile.picture }}
                      style={styles.profileAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.profileAvatar,
                        styles.profileAvatarPlaceholder
                      ]}
                    >
                      <SSText size="lg" weight="bold">
                        {(counterpartyProfile.name?.[0] ||
                          counterpartyNpub[5] ||
                          '?').toUpperCase()}
                      </SSText>
                    </View>
                  )}
                  <SSVStack gap="xs" style={styles.profileMeta}>
                    <SSText size="md" weight="medium">
                      {privacyMode
                        ? NOSTR_PRIVACY_MASK
                        : counterpartyProfile.name?.trim() || '—'}
                    </SSText>
                    <SSVStack gap="xxs">
                      <SSText size="xxs" color="muted" uppercase>
                        {t('nostrIdentity.keys.npub')}
                      </SSText>
                      {privacyMode ? (
                        <SSText size="xs" type="mono" color="muted">
                          {NOSTR_PRIVACY_MASK}
                        </SSText>
                      ) : (
                        <SSClipboardCopy text={counterpartyNpub}>
                          <SSText size="xs" type="mono" color="muted">
                            {truncateNpub(counterpartyNpub, 14)}
                          </SSText>
                        </SSClipboardCopy>
                      )}
                    </SSVStack>
                    <SSVStack gap="xxs">
                      <SSText size="xxs" color="muted" uppercase>
                        {t('nostrIdentity.profile.nip05')}
                      </SSText>
                      {privacyMode ? (
                        <SSText size="sm" color="muted">
                          {NOSTR_PRIVACY_MASK}
                        </SSText>
                      ) : counterpartyProfile.nip05?.trim() ? (
                        <SSClipboardCopy text={counterpartyProfile.nip05.trim()}>
                          <SSText size="sm" color="muted">
                            {counterpartyProfile.nip05.trim()}
                          </SSText>
                        </SSClipboardCopy>
                      ) : (
                        <SSText size="sm" color="muted">
                          {t('nostrIdentity.account.nip05NotSet')}
                        </SSText>
                      )}
                    </SSVStack>
                    <SSVStack gap="xxs">
                      <SSText size="xxs" color="muted" uppercase>
                        {t('nostrIdentity.profile.lud16')}
                      </SSText>
                      {privacyMode ? (
                        <SSText size="sm" color="muted">
                          {NOSTR_PRIVACY_MASK}
                        </SSText>
                      ) : counterpartyProfile.lud16?.trim() ? (
                        <SSClipboardCopy text={counterpartyProfile.lud16.trim()}>
                          <SSText size="sm" color="white">
                            {counterpartyProfile.lud16.trim()}
                          </SSText>
                        </SSClipboardCopy>
                      ) : (
                        <SSText size="sm" color="muted">
                          {t('nostrIdentity.account.lud16NotSet')}
                        </SSText>
                      )}
                    </SSVStack>
                  </SSVStack>
                </SSHStack>
              </SSVStack>
            ) : null}

            <SSVStack gap="xs">
              <SSText size="xxs" color="muted" uppercase>
                {t('nostrIdentity.zapDetail.amount')}
              </SSText>
              <SSText
                size="lg"
                weight="bold"
                style={
                  receipt.direction === 'incoming'
                    ? styles.amountIncoming
                    : undefined
                }
              >
                {receipt.amountSats} sats
              </SSText>
            </SSVStack>

            <SSVStack gap="xs">
              <SSText size="xxs" color="muted" uppercase>
                {t('nostrIdentity.zapDetail.directionLabel')}
              </SSText>
              <SSText size="sm" weight="medium">
                {receipt.direction === 'incoming'
                  ? t('nostrIdentity.zapDetail.direction.incoming')
                  : t('nostrIdentity.zapDetail.direction.outgoing')}
              </SSText>
            </SSVStack>

            <SSVStack gap="xs">
              <SSText size="xxs" color="muted" uppercase>
                {t('nostrIdentity.zapDetail.eventId')}
              </SSText>
              <SSText type="mono" size="xs" color="muted">
                {receipt.id}
              </SSText>
            </SSVStack>

            <SSVStack gap="xs">
              <SSText size="xxs" color="muted" uppercase>
                {t('nostrIdentity.zapDetail.time')}
              </SSText>
              <SSText size="sm">
                {formatNostrCardDate(receipt.createdAt)}
              </SSText>
            </SSVStack>

            {receipt.comment ? (
              <SSVStack gap="xs">
                <SSText size="xxs" color="muted" uppercase>
                  {t('nostrIdentity.zapDetail.comment')}
                </SSText>
                <SSText size="sm">{receipt.comment}</SSText>
              </SSVStack>
            ) : null}

            {receipt.zappedEventId ? (
              <SSVStack gap="sm">
                <SSText size="xxs" color="muted" uppercase>
                  {t('nostrIdentity.zapDetail.referenceNote')}
                </SSText>
                <SSText type="mono" size="xs" color="muted">
                  {receipt.zappedEventId}
                </SSText>
                {referencedNote ? (
                  <SSVStack gap="xs">
                    <SSText size="xxs" color="muted" uppercase>
                      {t('nostrIdentity.zapDetail.notePreview')}
                    </SSText>
                    {referencedNote.content.trim().length > 0 ? (
                      <SSText size="sm" numberOfLines={14}>
                        {privacyMode
                          ? NOSTR_PRIVACY_MASK
                          : referencedNote.content}
                      </SSText>
                    ) : privacyMode &&
                      (allPreviewImageUrls.length > 0 ||
                        allPreviewVideoEmbeds.length > 0) ? (
                      <SSText size="sm" color="muted">
                        {t('nostrIdentity.feed.hiddenInPrivacyMode')}
                      </SSText>
                    ) : null}
                    {previewImageUrls.length > 0 ? (
                      <SSNoteInlineImages
                        uris={previewImageUrls}
                        style={
                          referencedNote.content.trim().length > 0
                            ? styles.noteImagesBelowText
                            : styles.noteImagesNoText
                        }
                      />
                    ) : null}
                    {previewVideoEmbeds.length > 0 ? (
                      <SSNoteInlineVideos
                        embeds={previewVideoEmbeds}
                        style={
                          referencedNote.content.trim().length > 0 ||
                          previewImageUrls.length > 0
                            ? styles.noteImagesBelowText
                            : styles.noteImagesNoText
                        }
                      />
                    ) : null}
                  </SSVStack>
                ) : null}
                <SSButton
                  label={t('nostrIdentity.zapDetail.viewNote')}
                  onPress={() => {
                    void handleOpenReferencedNote()
                  }}
                  variant="gradient"
                  gradientType="special"
                />
              </SSVStack>
            ) : null}

            {receipt.rawEventJson ? (
              <SSVStack gap="xs">
                <SSText size="xxs" color="muted" uppercase>
                  {t('nostrIdentity.zapDetail.receiptJson')}
                </SSText>
                <SSText type="mono" size="xxs" color="muted">
                  {receipt.rawEventJson}
                </SSText>
              </SSVStack>
            ) : null}
          </SSVStack>
        ) : null}
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  amountIncoming: {
    color: Colors.success
  },
  profileAvatar: {
    borderRadius: 24,
    height: 48,
    width: 48
  },
  profileAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  profileCard: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 5,
    borderWidth: 1,
    padding: 16
  },
  profileMeta: {
    flex: 1,
    minWidth: 0
  },
  profileRow: {
    alignItems: 'flex-start'
  },
  empty: {
    paddingVertical: 60
  },
  loader: {
    marginVertical: 24
  },
  scrollContent: {
    paddingBottom: 24,
    paddingTop: 16
  },
  noteImagesBelowText: {
    marginTop: 12
  },
  noteImagesNoText: {
    marginTop: 0
  }
})
