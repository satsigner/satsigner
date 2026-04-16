import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSNostrAccountCard from '@/components/SSNostrAccountCard'
import SSText from '@/components/SSText'
import { useNostrLandingKind0Sync } from '@/hooks/useNostrLandingKind0Sync'
import { useNostrLandingRelayReachability } from '@/hooks/useNostrLandingRelayReachability'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import {
  nostrAccountProfileHref,
  nostrAddIdentityHref
} from '@/utils/nostrNavigation'

export default function NostrLanding() {
  const router = useRouter()
  const identities = useNostrIdentityStore((state) => state.identities)
  const relays = useNostrIdentityStore((state) => state.relays)
  const activeIdentityNpub = useNostrIdentityStore(
    (state) => state.activeIdentityNpub
  )
  const setActiveIdentity = useNostrIdentityStore(
    (state) => state.setActiveIdentity
  )
  const setAllRelayConnected = useNostrIdentityStore(
    (state) => state.setAllRelayConnected
  )
  const updateIdentity = useNostrIdentityStore(
    (state) => state.updateIdentity
  )
  const [listRenderEpoch, setListRenderEpoch] = useState(0)

  const activeConnectionInfo = useNostrLandingRelayReachability({
    activeIdentityNpub,
    identities,
    relays
  })

  const { clearKind0FetchCache } = useNostrLandingKind0Sync({
    identities,
    relays,
    updateIdentity
  })

  useFocusEffect(
    useCallback(() => {
      setListRenderEpoch((n) => n + 1)
    }, [])
  )

  function handleAddIdentity() {
    router.navigate(nostrAddIdentityHref())
  }

  function handleSelectIdentity(npub: string) {
    setActiveIdentity(npub)
    updateIdentity(npub, { relayConnected: true })
    router.navigate(nostrAccountProfileHref(npub))
  }

  const identitiesForList =
    activeIdentityNpub == null
      ? identities
      : [
          ...identities.filter((i) => i.npub === activeIdentityNpub),
          ...identities.filter((i) => i.npub !== activeIdentityNpub)
        ]

  const anyRelayConnected = identities.some(
    (i) => i.relayConnected === true
  )

  function handleRelayConnectToggle() {
    if (anyRelayConnected) {
      setAllRelayConnected(false)
    } else {
      setAllRelayConnected(true)
    }
    clearKind0FetchCache()
  }

  function renderAddIdentityButton() {
    return (
      <SSButton
        label={t('nostrIdentity.addIdentity')}
        onPress={handleAddIdentity}
        variant="gradient"
        gradientType="special"
        style={styles.addIdentityButton}
      />
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.title')}</SSText>
          )
        }}
      />
      {identities.length === 0 ? (
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
          <SSVStack itemsCenter gap="sm">
            <SSText size="lg" weight="medium">
              {t('nostrIdentity.empty.title')}
            </SSText>
            <SSText color="muted" center>
              {t('nostrIdentity.empty.description')}
            </SSText>
          </SSVStack>
          {renderAddIdentityButton()}
        </SSVStack>
      ) : (
        <SSVStack gap="md" style={styles.withIdentitiesColumn}>
          <ScrollView
            removeClippedSubviews={false}
            showsVerticalScrollIndicator={false}
            style={styles.accountScroll}
          >
            <SSVStack gap="sm" style={styles.listContainer}>
              {identitiesForList.map((identity) => (
                <SSNostrAccountCard
                  key={`${identity.npub}-${listRenderEpoch}-${activeIdentityNpub ?? 'none'}`}
                  identity={identity}
                  isActive={identity.npub === activeIdentityNpub}
                  connectionInfo={
                    identity.npub === activeIdentityNpub
                      ? identity.relayConnected === true
                        ? (activeConnectionInfo ?? { status: 'checking' })
                        : { status: 'disconnected', reason: 'user_disabled' }
                      : undefined
                  }
                  onPress={() => handleSelectIdentity(identity.npub)}
                />
              ))}
            </SSVStack>
          </ScrollView>
          <SSVStack gap="sm" style={styles.buttonRow}>
            <SSButton
              label={
                anyRelayConnected
                  ? t('nostrIdentity.landing.disconnectAll')
                  : t('nostrIdentity.landing.connectAll')
              }
              onPress={handleRelayConnectToggle}
              variant="ghost"
              style={styles.relayToggleButton}
            />
            {renderAddIdentityButton()}
          </SSVStack>
        </SSVStack>
      )}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  accountScroll: {
    flex: 1
  },
  addIdentityButton: {
    alignSelf: 'stretch',
    width: '100%'
  },
  buttonRow: {
    paddingBottom: 4,
    width: '100%'
  },
  relayToggleButton: {
    alignSelf: 'stretch',
    width: '100%'
  },
  emptyContainer: {
    paddingVertical: 60
  },
  listContainer: {
    paddingBottom: 16
  },
  withIdentitiesColumn: {
    flex: 1
  }
})
