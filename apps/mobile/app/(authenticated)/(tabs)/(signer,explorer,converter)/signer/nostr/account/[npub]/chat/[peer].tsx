import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSChatThread from '@/components/chat/SSChatThread'
import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import {
  useNostrChatProfiles,
  useNostrChatSubscription,
  useNostrChatThread
} from '@/hooks/useNostrChat'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrStore } from '@/store/nostr'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { type NostrChatProtocol } from '@/types/models/Nostr'
import { getPubKeyHexFromNpub, safeNpubEncode } from '@/utils/nostr'
import { buildChatThreadAuthors } from '@/utils/nostrChat'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'
import { isNonEmptyString } from '@/utils/string'

type ThreadParams = {
  npub: string
  peer: string
  protocol?: string
}

export default function NostrChatThread() {
  const router = useRouter()
  const {
    npub,
    peer,
    protocol: protocolParam
  } = useLocalSearchParams<ThreadParams>()
  const protocol: NostrChatProtocol =
    protocolParam === 'nip04' ? 'nip04' : 'nip17'

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const peerPubkey = isNonEmptyString(peer) ? getPubKeyHexFromNpub(peer) : null
  const peerNpub = peerPubkey !== null ? safeNpubEncode(peerPubkey) : ''
  const peerProfile = useNostrStore((state) => state.profiles[peerNpub])

  useNostrChatSubscription(identity)
  // Fetch the peer's kind 0 so the header shows their name/picture.
  useNostrChatProfiles(
    identity?.relays,
    isNonEmptyString(peerNpub) ? [peerNpub] : []
  )
  const { input, items, loadOlder, loadingOlder, send, sending, setInput } =
    useNostrChatThread(identity, protocol, peerNpub, peerPubkey ?? undefined)

  if (!identity || peerPubkey === null) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  async function sendOrReport(text: string) {
    try {
      await send(text)
    } catch (error) {
      // The draft is restored and the message stays marked failed.
      toast.error(getNostrErrorMessage(error))
    }
  }

  async function loadOlderOrReport() {
    try {
      await loadOlder()
    } catch (error) {
      toast.error(getNostrErrorMessage(error))
    }
  }

  function handleSend(text: string) {
    void sendOrReport(text)
  }

  function handleLoadOlder() {
    void loadOlderOrReport()
  }

  function handleAuthorPress(authorNpub: string) {
    if (!identity) {
      return
    }
    router.push({
      params: { npub: identity.npub, targetNpub: authorNpub },
      pathname: '/signer/nostr/account/[npub]/contact/[targetNpub]'
    })
  }

  const formattedNpubs = buildChatThreadAuthors({
    ownDisplayName: identity.displayName,
    ownNpub: identity.npub,
    peerNpub,
    peerProfile
  })
  const peerTitle =
    peerProfile?.displayName ?? `${peerNpub.slice(0, 12)}…${peerNpub.slice(-4)}`

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {privacyMode ? NOSTR_PRIVACY_MASK : peerTitle}
            </SSText>
          )
        }}
      />
      <SSChatThread
        items={items}
        formattedNpubs={formattedNpubs}
        onSend={handleSend}
        sending={sending}
        inputValue={input}
        onInputChange={setInput}
        ownNpub={identity.npub}
        onAuthorPress={handleAuthorPress}
        onLoadOlder={handleLoadOlder}
        loadingOlder={loadingOlder}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  emptyContainer: {
    paddingVertical: 60
  }
})
