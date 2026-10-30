import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { StyleSheet, View } from 'react-native'

import { NostrAPI, testNostrRelaysReachable } from '@/api/nostr'
import { SSIconChatBubble, SSIconNostr } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSButtonActionsGroup from '@/components/SSButtonActionsGroup'
import SSCameraModal from '@/components/SSCameraModal'
import SSIconButton from '@/components/SSIconButton'
import SSNFCModal from '@/components/SSNFCModal'
import SSNostrFeedTabs from '@/components/SSNostrFeedTabs'
import SSNostrHeroCard from '@/components/SSNostrHeroCard'
import SSPaste from '@/components/SSPaste'
import SSText from '@/components/SSText'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX
} from '@/constants/headerChrome'
import {
  NOSTR_PROFILE_QUERY_STALE_TIME_MS,
  NOSTR_RELAY_REACHABILITY_STALE_TIME_MS
} from '@/constants/nostr'
import { useContentHandler } from '@/hooks/useContentHandler'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors, Layout } from '@/styles'
import {
  type NostrRelayConnectionInfo,
  type ZapReceiptInfo
} from '@/types/models/Nostr'
import { getPubKeyHexFromNpub, validateNip05 } from '@/utils/nostr'
import {
  getNostrContactsRelaysKey,
  getNostrIdentityRelays
} from '@/utils/nostrContacts'
import { hasNostrRelaysSelected } from '@/utils/nostrIdentity'
import {
  nostrAccountHref,
  nostrAuthorProfileHref,
  nostrBunkerConnectHref,
  nostrNoteHref,
  nostrZapDetailHref
} from '@/utils/nostrNavigation'
import { getIdentityProfileUpdate } from '@/utils/nostrProfile'

type AccountParams = {
  npub: string
}

export default function NostrAccountLanding() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<AccountParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const relays = useNostrIdentityStore((state) => state.relays)
  const updateIdentity = useNostrIdentityStore((state) => state.updateIdentity)

  const effectiveRelays = identity
    ? getNostrIdentityRelays(identity.relays, relays)
    : []

  const relaysSelected = hasNostrRelaysSelected(identity?.relays, relays)
  const relayConnected = identity?.relayConnected === true
  const relaysAvailable = effectiveRelays.length > 0

  const connectionQuery = useQuery({
    enabled: !!identity && relayConnected && relaysAvailable,
    queryFn: () => testNostrRelaysReachable(effectiveRelays),
    queryKey: [
      'nostr',
      'relay-connection',
      npub,
      getNostrContactsRelaysKey(effectiveRelays)
    ],
    refetchOnWindowFocus: false,
    retry: 0,
    staleTime: NOSTR_RELAY_REACHABILITY_STALE_TIME_MS
  })

  const connectionInfo: NostrRelayConnectionInfo = !identity
    ? { status: 'checking' }
    : !relayConnected
      ? { reason: 'user_disabled', status: 'disconnected' }
      : !relaysAvailable
        ? { reason: 'no_relays', status: 'disconnected' }
        : (connectionQuery.data ?? { status: 'checking' })

  useQuery({
    enabled: !!identity && relayConnected && !!npub && relaysAvailable,
    queryFn: async () => {
      const api = new NostrAPI(effectiveRelays)
      try {
        const profile = await api.fetchKind0(npub)
        if (profile) {
          updateIdentity(npub, getIdentityProfileUpdate(profile))
        }
        return profile
      } finally {
        api.disconnect()
      }
    },
    queryKey: ['nostr', 'profile', npub],
    staleTime: NOSTR_PROFILE_QUERY_STALE_TIME_MS
  })

  const pubkeyHex = npub ? getPubKeyHexFromNpub(npub) : null
  const nip05 = identity?.nip05?.trim()

  const { data: nip05Valid } = useQuery({
    enabled: !!pubkeyHex && !!nip05,
    queryFn: () => validateNip05(pubkeyHex!, nip05!),
    queryKey: ['nostr', 'nip05-valid', npub, nip05],
    staleTime: NOSTR_RELAY_REACHABILITY_STALE_TIME_MS
  })

  function handleContentScanned(detected: {
    type: string
    raw: string
    cleaned: string
  }) {
    if (detected.type === 'nostr_connect') {
      const connectUri = detected.cleaned || detected.raw
      router.navigate(nostrBunkerConnectHref(npub, connectUri))
      return
    }
    const nostrUri = detected.cleaned || detected.raw
    router.navigate(nostrNoteHref(npub, nostrUri))
  }

  function handleNotePress(payload: {
    id: string
    kind: number
    pubkey: string
  }) {
    const nevent = nip19.neventEncode({
      author: payload.pubkey,
      id: payload.id,
      kind: payload.kind
    })
    router.navigate(nostrNoteHref(npub, nevent))
  }

  function handleAddRelays() {
    router.navigate(nostrAccountHref(npub, 'relays'))
  }

  function handleZapPress(receipt: ZapReceiptInfo) {
    router.navigate(nostrZapDetailHref(npub, receipt.id))
  }

  function handleAuthorPress(authorNpub: string) {
    router.navigate(nostrAuthorProfileHref(npub, authorNpub))
  }

  const contentHandler = useContentHandler({
    context: 'nostr',
    onContentScanned: handleContentScanned,
    receiveHref: nostrAccountHref(npub, 'compose'),
    sendHref: nostrAccountHref(npub, 'send')
  })

  if (!identity) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout style={{ paddingHorizontal: 0 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <SSHStack
              gap="none"
              style={{ marginRight: -HEADER_CHROME_EDGE_NUDGE }}
            >
              <SSIconButton
                accessibilityLabel={t('nostrIdentity.chat.title')}
                style={HEADER_CHROME_HIT_BOX}
                onPress={() => router.navigate(nostrAccountHref(npub, 'chat'))}
              >
                <SSIconChatBubble
                  color={Colors.gray[200]}
                  height={16}
                  width={16}
                />
              </SSIconButton>
              <SSIconButton
                accessibilityLabel={t('nostrIdentity.settings.title')}
                style={HEADER_CHROME_HIT_BOX}
                onPress={() =>
                  router.navigate(nostrAccountHref(npub, 'settings'))
                }
              >
                <SSIconNostr color={Colors.gray[200]} height={16} width={16} />
              </SSIconButton>
            </SSHStack>
          ),
          headerTitle: ''
        }}
      />
      <SSNostrFeedTabs
        header={
          <View>
            <SSNostrHeroCard
              identity={identity}
              connectionInfo={connectionInfo}
              nip05Valid={nip05Valid ?? null}
              style={styles.heroProfile}
            />
            {relaysSelected ? null : (
              <View style={styles.actions}>
                <SSButton
                  label={t('nostrIdentity.account.addRelays')}
                  variant="outline"
                  onPress={handleAddRelays}
                  style={styles.addRelaysButton}
                />
              </View>
            )}
            <View style={styles.actions}>
              <SSButtonActionsGroup
                context="nostr"
                nfcAvailable={contentHandler.nfcAvailable}
                onSend={contentHandler.handleSend}
                onPaste={contentHandler.handlePaste}
                onCamera={contentHandler.handleCamera}
                onNFC={contentHandler.handleNFC}
                onReceive={contentHandler.handleReceive}
              />
            </View>
          </View>
        }
        npub={npub}
        relayConnected={identity.relayConnected === true}
        relays={effectiveRelays}
        onNotePress={handleNotePress}
        onZapPress={handleZapPress}
        onAuthorPress={handleAuthorPress}
      />

      <SSCameraModal
        visible={contentHandler.cameraModalVisible}
        onClose={contentHandler.closeCameraModal}
        onContentScanned={contentHandler.handleContentScanned}
        context="nostr"
        title={t('nostrIdentity.account.scanTitle')}
      />
      <SSNFCModal
        visible={contentHandler.nfcModalVisible}
        onClose={contentHandler.closeNFCModal}
        onContentRead={contentHandler.handleNFCContentRead}
        mode="read"
      />
      <SSPaste
        visible={contentHandler.pasteModalVisible}
        onClose={contentHandler.closePasteModal}
        onContentPasted={contentHandler.handleContentPasted}
        context="nostr"
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actions: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal
  },
  addRelaysButton: {
    marginBottom: 10
  },
  emptyContainer: {
    paddingVertical: 60
  },
  heroProfile: {
    paddingBottom: 10,
    paddingTop: 4
  }
})
