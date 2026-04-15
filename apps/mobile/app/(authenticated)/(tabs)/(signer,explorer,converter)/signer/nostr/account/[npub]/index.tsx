import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

import { NostrAPI } from '@/api/nostr'
import { SSIconNostr } from '@/components/icons'
import SSButtonActionsGroup from '@/components/SSButtonActionsGroup'
import SSCameraModal from '@/components/SSCameraModal'
import SSIconButton from '@/components/SSIconButton'
import SSNFCModal from '@/components/SSNFCModal'
import SSNostrHeroCard from '@/components/SSNostrHeroCard'
import SSPaste from '@/components/SSPaste'
import SSText from '@/components/SSText'
import { useContentHandler } from '@/hooks/useContentHandler'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'

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
  const updateIdentity = useNostrIdentityStore(
    (state) => state.updateIdentity
  )
  const fetchedRef = useRef(false)

  useEffect(() => {
    const effectiveRelays = identity?.relays ?? relays
    if (
      !identity ||
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

  const handleContentScanned = useCallback(
    (detected: { type: string; raw: string; cleaned: string }) => {
      const nostrUri = detected.cleaned || detected.raw
      router.navigate({
        pathname: '/signer/nostr/account/[npub]/note',
        params: { npub, nostrUri }
      })
    },
    [npub, router]
  )

  const contentHandler = useContentHandler({
    context: 'nostr',
    onContentScanned: handleContentScanned,
    onSend: () => {},
    onReceive: () => {}
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
          headerRight: () => (
            <SSIconButton
              onPress={() =>
                router.navigate({
                  pathname: '/signer/nostr/account/[npub]/settings',
                  params: { npub }
                })
              }
              style={{ marginRight: 8 }}
            >
              <SSIconNostr height={16} width={16} />
            </SSIconButton>
          ),
          headerTitle: () => (
            <SSText uppercase>
              {identity.displayName || t('nostrIdentity.title')}
            </SSText>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="md">
          <SSNostrHeroCard identity={identity} />

          <SSButtonActionsGroup
            context="nostr"
            nfcAvailable={contentHandler.nfcAvailable}
            onSend={contentHandler.handleSend}
            onPaste={contentHandler.handlePaste}
            onCamera={contentHandler.handleCamera}
            onNFC={contentHandler.handleNFC}
            onReceive={contentHandler.handleReceive}
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
  }
})
