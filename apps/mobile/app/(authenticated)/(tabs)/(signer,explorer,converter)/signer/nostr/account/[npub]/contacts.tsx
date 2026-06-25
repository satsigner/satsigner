import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { ActivityIndicator, StyleSheet } from 'react-native'

import SSNostrContactList from '@/components/SSNostrContactList'
import SSText from '@/components/SSText'
import { useNostrContacts } from '@/hooks/useNostrContacts'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors, Layout } from '@/styles'
import { type NostrContactItem } from '@/types/models/Nostr'
import { getNostrContactsRelays } from '@/utils/nostrContacts'
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

  const contactsRelays = getNostrContactsRelays(identity?.relays)

  const {
    contacts,
    connectedRelayCount,
    isError,
    isLoading,
    kind3Found,
    relaysQueried
  } = useNostrContacts(npub, contactsRelays)

  function handleContactPress(item: NostrContactItem) {
    const contactNpub = nip19.npubEncode(item.pubkey)
    router.navigate(nostrContactProfileHref(npub, contactNpub))
  }

  return (
    <SSMainLayout style={{ paddingHorizontal: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.contacts.title')}</SSText>
          )
        }}
      />
      {isLoading && contacts.length === 0 ? (
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
        <SSNostrContactList
          contacts={contacts}
          fullWidth
          onPress={handleContactPress}
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

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Layout.mainContainer.paddingHorizontal
  }
})
