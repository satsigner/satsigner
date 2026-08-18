import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { StyleSheet } from 'react-native'

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
import { getPubKeyHexFromNpub } from '@/utils/nostr'

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
  const peerProfile = useNostrStore((state) =>
    peer ? state.profiles[peer] : undefined
  )

  const peerPubkey = peer ? getPubKeyHexFromNpub(peer) : null
  useNostrChatSubscription(identity)
  // Fetch the peer's kind 0 so the header shows their name/picture.
  useNostrChatProfiles(identity?.relays, peer ? [peer] : [])
  const { input, messages, send, sending, setInput } = useNostrChatThread(
    identity,
    protocol,
    peer,
    peerPubkey ?? undefined
  )

  if (!identity || !peer || !peerPubkey) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  const peerNpub = nip19.npubEncode(peerPubkey)
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
        messages={messages}
        onSend={(text) => {
          send(text).catch(() => undefined)
        }}
        sending={sending}
        inputValue={input}
        onInputChange={setInput}
        ownNpub={identity.npub}
        ownDisplayName={identity.displayName}
        onAuthorPress={(authorNpub) =>
          router.push({
            params: { npub: identity.npub, targetNpub: authorNpub },
            pathname: '/signer/nostr/account/[npub]/contact/[targetNpub]'
          })
        }
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  emptyContainer: {
    paddingVertical: 60
  }
})
