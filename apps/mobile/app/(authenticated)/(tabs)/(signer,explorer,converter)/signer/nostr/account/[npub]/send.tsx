import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, StyleSheet } from 'react-native'

import SSNostrContactList from '@/components/SSNostrContactList'
import SSText from '@/components/SSText'
import { NOSTR_EMPTY_STATE_PADDING_VERTICAL } from '@/constants/nostr'
import { useNostrContacts } from '@/hooks/useNostrContacts'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { type NostrContactItem } from '@/types/models/Nostr'
import {
  contactToIdentity,
  getNostrContactsRelays
} from '@/utils/nostrContacts'

type SendParams = {
  npub: string
}

export default function NostrFollowingSend() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<SendParams>()
  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )

  const contactsRelays = getNostrContactsRelays(identity?.relays)

  const { contacts, isError, isLoading } = useNostrContacts(
    npub,
    contactsRelays
  )

  function handlePressRow(item: NostrContactItem) {
    router.navigate({
      params: { npub, targetNpub: contactToIdentity(item).npub },
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

      {isLoading && contacts.length === 0 ? (
        <SSVStack itemsCenter gap="md" style={styles.centered}>
          <ActivityIndicator color={Colors.white} size="large" />
          <SSText color="muted">
            {t('nostrIdentity.account.followingLoading')}
          </SSText>
        </SSVStack>
      ) : isError ? (
        <SSVStack itemsCenter gap="md" style={styles.centered}>
          <SSText color="muted" center>
            {t('nostrIdentity.account.eventNotFound')}
          </SSText>
        </SSVStack>
      ) : contacts.length === 0 ? (
        <SSVStack itemsCenter gap="md" style={styles.centered}>
          <SSText color="muted" center>
            {t('nostrIdentity.account.followingEmpty')}
          </SSText>
        </SSVStack>
      ) : (
        <SSNostrContactList contacts={contacts} onPress={handlePressRow} />
      )}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: NOSTR_EMPTY_STATE_PADDING_VERTICAL
  }
})
