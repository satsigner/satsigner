import { Stack, useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

import { NostrAPI } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSNostrAccountCard from '@/components/SSNostrAccountCard'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'

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
  const updateIdentity = useNostrIdentityStore(
    (state) => state.updateIdentity
  )
  const fetchedRef = useRef(new Set<string>())

  useEffect(() => {
    if (identities.length === 0) return

    const toFetch = identities.filter(
      (i) => !fetchedRef.current.has(i.npub)
    )
    if (toFetch.length === 0) return

    toFetch.forEach((i) => fetchedRef.current.add(i.npub))

    for (const identity of toFetch) {
      const effectiveRelays = identity.relays ?? relays
      if (effectiveRelays.length === 0) continue

      const api = new NostrAPI(effectiveRelays)
      api
        .fetchKind0(identity.npub)
        .then((profile) => {
          if (!profile) return
          updateIdentity(identity.npub, {
            displayName: profile.displayName || identity.displayName,
            picture: profile.picture || identity.picture,
            nip05: profile.nip05 || identity.nip05,
            lud16: profile.lud16 || identity.lud16
          })
        })
        .catch(() => {
          fetchedRef.current.delete(identity.npub)
        })
    }
  }, [identities, relays, updateIdentity])

  function handleAddIdentity() {
    router.navigate('/signer/nostr/add')
  }

  function handleSelectIdentity(npub: string) {
    setActiveIdentity(npub)
    router.navigate({
      pathname: '/signer/nostr/account/[npub]',
      params: { npub }
    })
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
          <SSButton
            label={t('nostrIdentity.addIdentity')}
            onPress={handleAddIdentity}
            variant="gradient"
            gradientType="special"
            style={styles.actionButton}
          />
        </SSVStack>
      ) : (
        <SSVStack gap="md" style={styles.withIdentitiesColumn}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.accountScroll}
          >
            <SSVStack gap="sm" style={styles.listContainer}>
              {identities.map((identity) => (
                <SSNostrAccountCard
                  key={identity.npub}
                  identity={identity}
                  isActive={identity.npub === activeIdentityNpub}
                  onPress={() => handleSelectIdentity(identity.npub)}
                />
              ))}
            </SSVStack>
          </ScrollView>
          <SSVStack gap="sm" style={styles.buttonRow}>
            <SSButton
              label={t('nostrIdentity.addIdentity')}
              onPress={handleAddIdentity}
              variant="gradient"
              gradientType="special"
            />
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
  actionButton: {
    maxWidth: 280,
    width: '100%'
  },
  buttonRow: {
    paddingBottom: 4
  },
  emptyContainer: {
    paddingHorizontal: 20,
    paddingVertical: 60
  },
  listContainer: {
    paddingBottom: 16
  },
  withIdentitiesColumn: {
    flex: 1
  }
})
