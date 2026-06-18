import { FlashList } from '@shopify/flash-list'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native'

import { NostrAPI } from '@/api/nostr'
import SSText from '@/components/SSText'
import { useNostrContacts, type ContactItem } from '@/hooks/useNostrContacts'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors, Layout } from '@/styles'
import { nostrContactProfileHref } from '@/utils/nostrNavigation'

type ContactsParams = {
  npub: string
}

export default function NostrContacts() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<ContactsParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const effectiveRelays = identity?.relays?.length
    ? identity.relays
    : globalRelays

  const relayConnected = identity?.relayConnected === true
  const relaysAvailable = effectiveRelays.length > 0

  // Use identity-specific relays if set; otherwise fall back to well-known indexing relays
  // to avoid spawning connections that compete with the feed's active NDK.
  const contactsRelays = identity?.relays?.length
    ? identity.relays
    : NostrAPI.INDEXING_RELAYS

  const {
    contacts,
    connectedRelayCount,
    isError,
    isLoading,
    kind3Found,
    relaysQueried
  } = useNostrContacts(npub, contactsRelays, relayConnected)

  function handleContactPress(item: ContactItem) {
    const contactNpub = nip19.npubEncode(item.pubkey)
    router.navigate(nostrContactProfileHref(npub, contactNpub))
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.contacts.title')}</SSText>
          )
        }}
      />
      {!relayConnected ? (
        <SSVStack itemsCenter style={styles.center}>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.account.relayDisconnected')}
          </SSText>
        </SSVStack>
      ) : !relaysAvailable ? (
        <SSVStack itemsCenter style={styles.center}>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.account.relayNoRelays')}
          </SSText>
        </SSVStack>
      ) : isLoading && contacts.length === 0 ? (
        <SSVStack itemsCenter style={styles.center}>
          <ActivityIndicator color={Colors.gray[400]} />
        </SSVStack>
      ) : isError ? (
        <SSVStack itemsCenter gap="sm" style={styles.center}>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.account.relayAllFailed')}
          </SSText>
          <RelayList relays={contactsRelays} />
        </SSVStack>
      ) : !kind3Found ? (
        <SSVStack itemsCenter gap="sm" style={styles.center}>
          <SSText color="muted" size="sm">
            {connectedRelayCount === 0
              ? t('nostrIdentity.contacts.kind3NotFoundNoConn')
              : t('nostrIdentity.contacts.kind3NotFound', {
                  connected: connectedRelayCount,
                  total: relaysQueried.length
                })}
          </SSText>
          <RelayList
            relays={relaysQueried.length > 0 ? relaysQueried : contactsRelays}
          />
        </SSVStack>
      ) : contacts.length === 0 ? (
        <SSVStack itemsCenter style={styles.center}>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.contacts.empty')}
          </SSText>
        </SSVStack>
      ) : (
        <FlashList
          data={contacts}
          estimatedItemSize={60}
          keyExtractor={(item) => item.pubkey}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ContactRow item={item} onPress={handleContactPress} />
          )}
        />
      )}
    </SSMainLayout>
  )
}

type RelayListProps = {
  relays: string[]
}

function RelayList({ relays }: RelayListProps) {
  return (
    <SSVStack gap="none" itemsCenter>
      {relays.map((url) => (
        <SSText key={url} size="xs" color="muted">
          {url}
        </SSText>
      ))}
    </SSVStack>
  )
}

type ContactRowProps = {
  item: ContactItem
  onPress: (item: ContactItem) => void
}

function ContactRow({ item, onPress }: ContactRowProps) {
  function handlePress() {
    onPress(item)
  }

  const displayName = item.profile?.displayName ?? `${item.pubkey.slice(0, 8)}…`

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <SSText size="sm" color="muted">
          {displayName.slice(0, 1).toUpperCase()}
        </SSText>
      </View>
      <SSVStack gap="none" style={styles.rowText}>
        <SSText size="sm">{displayName}</SSText>
        {item.profile?.nip05 ? (
          <SSText size="xs" color="muted">
            {item.profile.nip05}
          </SSText>
        ) : null}
      </SSVStack>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  center: {
    flex: 1,
    justifyContent: 'center'
  },
  list: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingVertical: 8
  },
  row: {
    alignItems: 'center',
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12
  },
  rowText: {
    flex: 1
  }
})
