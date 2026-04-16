import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

import { NostrAPI, testNostrRelaysReachable } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSNostrAccountCard from '@/components/SSNostrAccountCard'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { type NostrRelayReachability } from '@/types/models/NostrIdentity'

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
  const fetchedRef = useRef(new Set<string>())
  const [activeRelayReachability, setActiveRelayReachability] =
    useState<NostrRelayReachability | null>(null)
  const [listRenderEpoch, setListRenderEpoch] = useState(0)

  useFocusEffect(
    useCallback(() => {
      setListRenderEpoch((n) => n + 1)
    }, [])
  )

  useEffect(() => {
    if (!activeIdentityNpub) {
      setActiveRelayReachability(null)
      return
    }

    const identity = identities.find((i) => i.npub === activeIdentityNpub)
    if (!identity) {
      setActiveRelayReachability(null)
      return
    }

    if (!identity.relayConnected) {
      setActiveRelayReachability('disconnected')
      return
    }

    let cancelled = false
    const urls = identity.relays?.length ? identity.relays : relays

    setActiveRelayReachability('checking')
    if (urls.length === 0) {
      setActiveRelayReachability('disconnected')
      return
    }

    void testNostrRelaysReachable(urls).then((ok) => {
      if (cancelled) return
      setActiveRelayReachability(ok ? 'connected' : 'disconnected')
    })

    return () => {
      cancelled = true
    }
  }, [activeIdentityNpub, identities, relays])

  useEffect(() => {
    if (identities.length === 0) return

    const toFetch = identities.filter(
      (i) =>
        i.relayConnected === true && !fetchedRef.current.has(i.npub)
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
    updateIdentity(npub, { relayConnected: true })
    router.navigate({
      pathname: '/signer/nostr/account/[npub]',
      params: { npub }
    })
  }

  const identitiesForList = useMemo(
    () =>
      activeIdentityNpub == null
        ? identities
        : [
            ...identities.filter((i) => i.npub === activeIdentityNpub),
            ...identities.filter((i) => i.npub !== activeIdentityNpub)
          ],
    [activeIdentityNpub, identities]
  )

  const anyRelayConnected = useMemo(
    () => identities.some((i) => i.relayConnected === true),
    [identities]
  )

  function handleRelayConnectToggle() {
    if (anyRelayConnected) {
      setAllRelayConnected(false)
    } else {
      setAllRelayConnected(true)
    }
    fetchedRef.current.clear()
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
                  relayReachability={
                    identity.npub === activeIdentityNpub
                      ? identity.relayConnected === true
                        ? (activeRelayReachability ?? 'checking')
                        : 'disconnected'
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
