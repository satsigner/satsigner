import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

import { NostrAPI, testNostrRelaysReachable } from '@/api/nostr'
import { SSIconChatBubble, SSIconNostr } from '@/components/icons'
import SSButtonActionsGroup from '@/components/SSButtonActionsGroup'
import SSCameraModal from '@/components/SSCameraModal'
import SSIconButton from '@/components/SSIconButton'
import SSNFCModal from '@/components/SSNFCModal'
import SSNostrFeedTabs from '@/components/SSNostrFeedTabs'
import SSNostrHeroCard from '@/components/SSNostrHeroCard'
import SSPaste from '@/components/SSPaste'
import SSText from '@/components/SSText'
import { useContentHandler } from '@/hooks/useContentHandler'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { type NostrRelayReachability } from '@/types/models/NostrIdentity'
import { Colors } from '@/styles'
import {
  nostrAccountHref,
  nostrNoteHref,
  nostrZapDetailHref
} from '@/utils/nostrNavigation'

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
  const fetchedRef = useRef(false)
  const [relayReachability, setRelayReachability] =
    useState<NostrRelayReachability>('checking')

  const effectiveRelays = useMemo(() => {
    if (!identity) {
      return []
    }
    return identity.relays?.length ? identity.relays : relays
  }, [identity, relays])

  useEffect(() => {
    if (!identity) {
      return
    }
    if (!identity.relayConnected) {
      setRelayReachability('disconnected')
      return
    }
    let cancelled = false
    if (effectiveRelays.length === 0) {
      setRelayReachability('disconnected')
      return
    }
    setRelayReachability('checking')
    void testNostrRelaysReachable(effectiveRelays).then((ok) => {
      if (cancelled) return
      setRelayReachability(ok ? 'connected' : 'disconnected')
    })
    return () => {
      cancelled = true
    }
  }, [identity, effectiveRelays])

  useEffect(() => {
    if (!identity?.relayConnected) {
      fetchedRef.current = false
    }
  }, [identity?.relayConnected, identity?.npub])

  useEffect(() => {
    const effectiveRelays = identity?.relays ?? relays
    if (
      !identity ||
      identity.relayConnected !== true ||
      !npub ||
      fetchedRef.current ||
      effectiveRelays.length === 0
    )
      return
    fetchedRef.current = true

    const api = new NostrAPI(effectiveRelays)
    api
      .fetchKind0(npub)
      .then((profile) => {
        if (!profile) return
        updateIdentity(npub, {
          displayName: profile.displayName || identity.displayName,
          picture: profile.picture || identity.picture,
          nip05: profile.nip05 || identity.nip05,
          lud16: profile.lud16 || identity.lud16
        })
      })
      .catch(() => {
        fetchedRef.current = false
      })
  }, [npub, identity, relays, updateIdentity])

  function handleContentScanned(detected: {
    type: string
    raw: string
    cleaned: string
  }) {
    const nostrUri = detected.cleaned || detected.raw
    router.navigate(nostrNoteHref(npub, nostrUri))
  }

  function handleSend() {
    router.navigate(nostrAccountHref(npub, 'send'))
  }

  function handleNotePress(payload: {
    id: string
    kind: number
    pubkey: string
  }) {
    const nevent = nip19.neventEncode({
      id: payload.id,
      author: payload.pubkey,
      kind: payload.kind
    })
    router.navigate(nostrNoteHref(npub, nevent))
  }

  function handleReceive() {
    router.navigate(nostrAccountHref(npub, 'compose'))
  }

  const contentHandler = useContentHandler({
    context: 'nostr',
    onContentScanned: handleContentScanned,
    onSend: handleSend,
    onReceive: handleReceive
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
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: '',
          headerRight: () => (
            <SSHStack gap="md" style={{ marginRight: 8 }}>
              <SSIconButton
                accessibilityLabel={t('nostrIdentity.chat.title')}
                onPress={() =>
                  router.navigate(nostrAccountHref(npub, 'chat'))
                }
              >
                <SSIconChatBubble
                  color={Colors.gray[200]}
                  height={16}
                  width={16}
                />
              </SSIconButton>
              <SSIconButton
                accessibilityLabel={t('nostrIdentity.settings.title')}
                onPress={() =>
                  router.navigate(nostrAccountHref(npub, 'settings'))
                }
              >
                <SSIconNostr
                  color={Colors.gray[200]}
                  height={16}
                  width={16}
                />
              </SSIconButton>
            </SSHStack>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="sm">
          <SSNostrHeroCard
            identity={identity}
            relayReachability={relayReachability}
            style={styles.heroProfile}
          />

          <SSButtonActionsGroup
            context="nostr"
            nfcAvailable={contentHandler.nfcAvailable}
            onSend={contentHandler.handleSend}
            onPaste={contentHandler.handlePaste}
            onCamera={contentHandler.handleCamera}
            onNFC={contentHandler.handleNFC}
            onReceive={contentHandler.handleReceive}
          />

          <SSNostrFeedTabs
            npub={npub}
            relayConnected={identity.relayConnected === true}
            relays={identity.relays ?? relays}
            onNotePress={handleNotePress}
            onZapPress={(receipt) =>
              router.navigate(nostrZapDetailHref(npub, receipt.id))
            }
          />
        </SSVStack>
      </ScrollView>

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
  emptyContainer: {
    paddingVertical: 60
  },
  heroProfile: {
    paddingBottom: 10,
    paddingTop: 4
  }
})
