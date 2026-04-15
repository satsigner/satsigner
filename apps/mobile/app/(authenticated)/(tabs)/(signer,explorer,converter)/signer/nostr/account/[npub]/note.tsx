import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  View
} from 'react-native'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import SSButton from '@/components/SSButton'
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
import { Colors } from '@/styles'
import {
  type FetchedNoteData,
  decodeNostrContent,
  extractPubpayTags,
  truncateNpub
} from '@/utils/nostrIdentity'

type NoteParams = {
  npub: string
  nostrUri: string
}

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
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false)
  const [payAmount, setPayAmount] = useState(0)
  const fetchedRef = useRef(false)

  const lightningConfig = useLightningStore((state) => state.config)
  const { mints } = useEcash()

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

  useEffect(() => {
    if (!decoded || fetchedRef.current) return
    if (
      decoded.kind !== 'note' &&
      decoded.kind !== 'nevent' &&
      decoded.kind !== 'json_note'
    )
      return

    fetchedRef.current = true

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
      return
    }

    const relayHints =
      decoded.kind === 'nevent' && Array.isArray(decoded.metadata?.relays)
        ? (decoded.metadata.relays as string[])
        : undefined
    const allRelays = relayHints?.length
      ? [...new Set([...relayHints, ...effectiveRelays])]
      : effectiveRelays

    const api = new NostrAPI(allRelays)
    api
      .fetchEvent(decoded.data, relayHints)
      .then((event) => {
        if (!event) {
          setIsLoading(false)
          toast.error(t('nostrIdentity.account.eventNotFound'))
          return
        }

        setFetched({
          content: event.content,
          created_at: event.created_at,
          kind: event.kind,
          pubkey: event.pubkey,
          tags: event.tags
        })
        setIsLoading(false)

        const authorNpub = nip19.npubEncode(event.pubkey)
        api
          .fetchKind0(authorNpub)
          .then((profile) => {
            if (!profile) return
            setFetched((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                authorName: profile.displayName,
                authorPicture: profile.picture
              }
            })
          })
          .catch(() => {})
      })
      .catch(() => {
        setIsLoading(false)
        toast.error(t('nostrIdentity.account.eventNotFound'))
      })
  }, [decoded, effectiveRelays])

  const pubpayTags = useMemo(
    () => extractPubpayTags(fetched?.tags ?? []),
    [fetched]
  )

  function handleZap(amountSats: number) {
    if (availablePaymentMethods.length === 0) return
    if (availablePaymentMethods.length === 1) {
      navigateToPayment(availablePaymentMethods[0])
      return
    }
    setPayAmount(amountSats)
    setPaymentPickerVisible(true)
  }

  function navigateToPayment(method: PaymentMethod) {
    setPaymentPickerVisible(false)
    if (method.type === 'lightning') {
      router.navigate('/signer/lightning')
    } else if (method.type === 'ecash') {
      router.navigate('/signer/ecash')
    }
  }

  function formatTimestamp(ts: number): string {
    if (!ts) return ''
    return new Date(ts * 1000).toLocaleString()
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
            {/* Author */}
            {fetched?.pubkey && (
              <SSHStack gap="md" style={styles.authorRow}>
                {fetched.authorPicture ? (
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
                  {fetched.authorName && (
                    <SSText size="md" weight="medium">
                      {fetched.authorName}
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
            )}

            {/* Kind & timestamp */}
            <SSHStack gap="sm">
              {fetched && (
                <View style={styles.kindBadge}>
                  <SSText size="xs">Kind {fetched.kind}</SSText>
                </View>
              )}
              {fetched && fetched.created_at > 0 && (
                <SSText size="xs" color="muted">
                  {formatTimestamp(fetched.created_at)}
                </SSText>
              )}
            </SSHStack>

            {/* Content */}
            {fetched && fetched.content.length > 0 && (
              <View style={styles.noteCard}>
                <SSText style={styles.noteText}>
                  {fetched.content}
                </SSText>
              </View>
            )}

            {/* Note ID */}
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

            {/* Pubpay tags */}
            {pubpayTags.length > 0 && (
              <SSVStack gap="sm">
                <SSText size="xs" color="muted" uppercase>
                  {t('nostrIdentity.note.zapAmounts')}
                </SSText>
                {pubpayTags.map((tag, index) => (
                  <SSHStack key={index} gap="sm" style={styles.zapRow}>
                    <SSVStack gap="none" style={{ flex: 1 }}>
                      <SSText size="lg" weight="medium">
                        {tag.amount} {tag.currency}
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
                      onPress={() => handleZap(tag.amount)}
                      style={styles.zapButton}
                    />
                  </SSHStack>
                ))}
              </SSVStack>
            )}

            {/* Default zap button when no predefined amounts */}
            {pubpayTags.length === 0 &&
              fetched &&
              availablePaymentMethods.length > 0 && (
                <SSButton
                  label={t('nostrIdentity.note.zap')}
                  variant="gradient"
                  gradientType="special"
                  onPress={() => handleZap(21)}
                  style={styles.defaultZapButton}
                />
              )}

            {/* No event found */}
            {!fetched && !isLoading && (
              <SSVStack itemsCenter gap="md" style={styles.notFoundCard}>
                <SSText color="muted">
                  {t('nostrIdentity.account.eventNotFound')}
                </SSText>
                <SSText size="xs" type="mono" color="muted">
                  {truncateNpub(decoded.raw, 16)}
                </SSText>
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
  content: {
    paddingBottom: 40
  },
  defaultZapButton: {
    marginTop: 8
  },
  kindBadge: {
    backgroundColor: Colors.gray[800],
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  noteCard: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 10,
    borderWidth: 1,
    padding: 16
  },
  noteText: {
    color: Colors.white,
    fontSize: 15,
    lineHeight: 22
  },
  notFoundCard: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 10,
    borderWidth: 1,
    padding: 24
  },
  zapButton: {
    minWidth: 90
  },
  zapRow: {
    alignItems: 'center',
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 14
  }
})
