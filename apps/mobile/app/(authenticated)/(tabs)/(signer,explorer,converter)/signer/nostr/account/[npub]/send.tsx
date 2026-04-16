import { FlashList } from '@shopify/flash-list'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { NostrAPI } from '@/api/nostr'
import SSNostrAccountCard from '@/components/SSNostrAccountCard'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { type NostrIdentity } from '@/types/models/NostrIdentity'

type SendParams = {
  npub: string
}

const PROFILE_CHUNK = 6

function identityFromHex(
  hex: string,
  profile: {
    displayName?: string
    picture?: string
    nip05?: string
    lud16?: string
  } | null
): NostrIdentity {
  const npubStr = nip19.npubEncode(hex)
  return {
    createdAt: Date.now(),
    displayName: profile?.displayName,
    isWatchOnly: false,
    lud16: profile?.lud16,
    nip05: profile?.nip05,
    npub: npubStr,
    picture: profile?.picture
  }
}

export default function NostrFollowingSend() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<SendParams>()
  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const effectiveRelays = identity?.relays ?? globalRelays

  const [rows, setRows] = useState<NostrIdentity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadFollowing = useCallback(async () => {
    if (!npub || effectiveRelays.length === 0) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const api = new NostrAPI(effectiveRelays)
      const hexKeys = await api.fetchKind3FollowingPubkeys(npub)
      if (hexKeys.length === 0) {
        setRows([])
        setLoading(false)
        return
      }

      const built: NostrIdentity[] = []
      for (let i = 0; i < hexKeys.length; i += PROFILE_CHUNK) {
        const slice = hexKeys.slice(i, i + PROFILE_CHUNK)
        const chunk = await Promise.all(
          slice.map(async (hex) => {
            const npubStr = nip19.npubEncode(hex)
            const profile = await api.fetchKind0(npubStr).catch(() => null)
            return identityFromHex(hex, profile)
          })
        )
        built.push(...chunk)
        setRows([...built])
      }
    } catch {
      setError(t('nostrIdentity.account.eventNotFound'))
    } finally {
      setLoading(false)
    }
  }, [effectiveRelays, npub])

  useEffect(() => {
    void loadFollowing()
  }, [loadFollowing])

  function handlePressRow(target: NostrIdentity) {
    router.navigate({
      params: { npub, targetNpub: target.npub },
      pathname: '/signer/nostr/account/[npub]/contact/[targetNpub]'
    })
  }

  if (!identity) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.centered}>
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
            <SSText uppercase>
              {t('nostrIdentity.account.followingTitle')}
            </SSText>
          )
        }}
      />

      {loading ? (
        <SSVStack itemsCenter gap="md" style={styles.centered}>
          <ActivityIndicator color={Colors.white} size="large" />
          <SSText color="muted">
            {t('nostrIdentity.account.followingLoading')}
          </SSText>
        </SSVStack>
      ) : error ? (
        <SSVStack itemsCenter gap="md" style={styles.centered}>
          <SSText color="muted" center>
            {error}
          </SSText>
        </SSVStack>
      ) : rows.length === 0 ? (
        <SSVStack itemsCenter gap="md" style={styles.centered}>
          <SSText color="muted" center>
            {t('nostrIdentity.account.followingEmpty')}
          </SSText>
        </SSVStack>
      ) : (
        <View style={styles.list}>
          <FlashList
            data={rows}
            keyExtractor={(item) => item.npub}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <SSNostrAccountCard
                identity={item}
                onPress={() => handlePressRow(item)}
              />
            )}
          />
        </View>
      )}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 48
  },
  list: {
    flex: 1
  },
  separator: {
    height: 8
  }
})
