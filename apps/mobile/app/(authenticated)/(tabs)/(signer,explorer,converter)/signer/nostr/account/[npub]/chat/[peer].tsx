import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSChatSessionMenu from '@/components/chat/SSChatSessionMenu'
import SSChatThread from '@/components/chat/SSChatThread'
import SSMessageActionsModal from '@/components/chat/SSMessageActionsModal'
import { SSIconEllipsis } from '@/components/icons'
import SSIconButton from '@/components/SSIconButton'
import SSNip46ApprovalModal from '@/components/SSNip46ApprovalModal'
import SSText from '@/components/SSText'
import { HEADER_CHROME_HIT_BOX } from '@/constants/headerChrome'
import {
  NOSTR_CHAT_DEFAULT_SESSION_ID,
  NOSTR_PRIVACY_MASK
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import {
  useNostrChatProfiles,
  useNostrChatSubscription,
  useNostrChatThread
} from '@/hooks/useNostrChat'
import { useNostrChatLendSigner } from '@/hooks/useNostrChatLendSigner'
import { useNostrChatLiveSigner } from '@/hooks/useNostrChatLiveSigner'
import { useNostrChatMessageActions } from '@/hooks/useNostrChatMessageActions'
import { useNostrChatReactions } from '@/hooks/useNostrChatReactions'
import { useNostrChatSession } from '@/hooks/useNostrChatSession'
import { useNostrChatSignRequests } from '@/hooks/useNostrChatSignRequests'
import { getAuthorLabel } from '@/hooks/useNostrMessage'
import { useNow } from '@/hooks/useNow'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrStore } from '@/store/nostr'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import type { NostrChatProtocol } from '@/types/models/Nostr'
import { formatNpub } from '@/utils/format'
import { getPubKeyHexFromNpub, safeNpubEncode } from '@/utils/nostr'
import {
  buildChatThreadAuthors,
  isChatThreadItemDelivered
} from '@/utils/nostrChat'
import { isChatSessionId } from '@/utils/nostrChatTags'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'
import {
  nostrAuthorProfileHref,
  nostrChatMessageHref
} from '@/utils/nostrNavigation'
import { isNonEmptyString } from '@/utils/string'

type ThreadParams = {
  npub: string
  peer: string
  protocol?: string
  session?: string
}

export default function NostrChatThread() {
  const router = useRouter()
  const {
    npub,
    peer,
    protocol: protocolParam,
    session: sessionParam
  } = useLocalSearchParams<ThreadParams>()
  const protocol: NostrChatProtocol =
    protocolParam === 'nip04' ? 'nip04' : 'nip17'
  const sessionId =
    protocol === 'nip17' &&
    isNonEmptyString(sessionParam) &&
    isChatSessionId(sessionParam)
      ? sessionParam
      : NOSTR_CHAT_DEFAULT_SESSION_ID
  const [sessionMenuVisible, setSessionMenuVisible] = useState(false)

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
  const {
    clearReplyTo,
    input,
    items,
    loadOlder,
    loadingOlder,
    replyParent,
    send,
    sending,
    setInput,
    setReplyTo
  } = useNostrChatThread(
    identity,
    protocol,
    peerNpub,
    peerPubkey ?? undefined,
    sessionId
  )
  const session = useNostrChatSession({
    identity,
    peerNpub,
    peerPubkey,
    protocol,
    sessionId
  })
  const signRequests = useNostrChatSignRequests(identity)
  const lendSigner = useNostrChatLendSigner({
    identity,
    peerNpub,
    peerPubkey,
    sessionId
  })
  const liveSigner = useNostrChatLiveSigner(
    identity?.npub ?? '',
    peerPubkey ?? '',
    sessionId
  )
  const nowMs = useNow()
  const canReply = protocol === 'nip17'
  const reactions = useNostrChatReactions(identity, peerNpub)
  const canReact = canReply && reactions.canReact

  function handleOpenMessage(messageId: string) {
    if (!identity) {
      return
    }
    router.push(nostrChatMessageHref(identity.npub, messageId))
  }

  const messageActions = useNostrChatMessageActions({
    messages: items.map((item) => item.dm),
    onDetails: handleOpenMessage,
    onReply: setReplyTo
  })
  const selectedItem = items.find(
    (item) => item.dm.id === messageActions.selectedMessage?.id
  )
  const canReactToSelected =
    canReact &&
    selectedItem !== undefined &&
    isChatThreadItemDelivered(selectedItem)

  if (!identity || peerPubkey === null) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  function handleReact(emoji: string) {
    const message = messageActions.selectedMessage
    messageActions.closeActions()
    if (message) {
      reactions.react(message.id, emoji)
    }
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

  function openSessionMenu() {
    setSessionMenuVisible(true)
  }

  function closeSessionMenu() {
    setSessionMenuVisible(false)
  }

  async function deleteSessionOrReport(everywhere: boolean) {
    if (everywhere && !session.canDeleteEverywhere) {
      toast.error(t('nostrIdentity.chat.sessions.deleteNeedsKey'))
      return
    }
    try {
      await session.deleteSession(everywhere)
    } catch (error) {
      toast.error(getNostrErrorMessage(error))
      return
    }
    setSessionMenuVisible(false)
  }

  function handleDeleteSession(everywhere: boolean) {
    void deleteSessionOrReport(everywhere)
  }

  function handleLendSigner() {
    void lendSigner.lend()
  }

  function handleAuthorPress(authorNpub: string) {
    if (!identity) {
      return
    }
    router.push(nostrAuthorProfileHref(identity.npub, authorNpub))
  }

  const formattedNpubs = buildChatThreadAuthors({
    ownDisplayName: identity.displayName,
    ownNpub: identity.npub,
    peerNpub,
    peerProfile
  })
  const peerTitle =
    peerProfile?.displayName ?? `${peerNpub.slice(0, 12)}…${peerNpub.slice(-4)}`
  const sessionTitle = session.isDefault
    ? session.title
    : (session.title ?? t('nostrIdentity.chat.sessions.untitled'))

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerRight: session.canManage
            ? () => (
                <SSIconButton
                  style={HEADER_CHROME_HIT_BOX}
                  onPress={openSessionMenu}
                  accessibilityLabel={t('nostrIdentity.chat.sessions.menu')}
                >
                  <SSIconEllipsis width={22} height={6} />
                </SSIconButton>
              )
            : undefined,
          headerTitle: () => (
            <SSVStack gap="none" itemsCenter>
              <SSText uppercase>
                {privacyMode ? NOSTR_PRIVACY_MASK : peerTitle}
              </SSText>
              {sessionTitle ? (
                <SSText size="xs" color="muted" numberOfLines={1}>
                  {privacyMode ? NOSTR_PRIVACY_MASK : sessionTitle}
                </SSText>
              ) : null}
            </SSVStack>
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
        onMessageLongPress={messageActions.openActions}
        onOpenMessage={handleOpenMessage}
        replyTo={
          replyParent
            ? {
                authorName: getAuthorLabel(formattedNpubs, replyParent.author),
                text: replyParent.description
              }
            : undefined
        }
        onCancelReply={clearReplyTo}
        peerHex={peerPubkey}
        onRemoveReaction={canReact ? reactions.unreact : undefined}
        signActions={
          protocol === 'nip17'
            ? {
                busyMessageId: signRequests.busyMessageId,
                canSign: signRequests.canSign,
                nowSeconds: Math.floor(nowMs / MS_PER_SECOND),
                onApprove: signRequests.approve,
                onReject: signRequests.reject,
                onResend: signRequests.resend,
                signerLabel: identity.displayName ?? formatNpub(identity.npub)
              }
            : undefined
        }
      />
      <SSMessageActionsModal
        visible={messageActions.selectedMessage !== undefined}
        preview={messageActions.selectedMessage?.description ?? ''}
        canReply={canReply}
        onReply={messageActions.handleReply}
        onCopy={messageActions.handleCopy}
        onDetails={messageActions.handleDetails}
        onClose={messageActions.closeActions}
        onReact={canReactToSelected ? handleReact : undefined}
      />
      <SSChatSessionMenu
        visible={sessionMenuVisible}
        title={session.title}
        isDefault={session.isDefault}
        privacyMode={privacyMode}
        canDeleteEverywhere={session.canDeleteEverywhere}
        deleting={session.deleting}
        archivedSessions={session.archivedSessions}
        onClose={closeSessionMenu}
        onStartNew={session.startNew}
        onRename={session.rename}
        onArchive={session.archive}
        onRestore={session.restore}
        onDelete={handleDeleteSession}
        onLendSigner={
          session.canManage && lendSigner.canLend ? handleLendSigner : undefined
        }
        lending={lendSigner.lending}
      />
      <SSNip46ApprovalModal
        visible={liveSigner.currentRequest !== null}
        request={liveSigner.currentRequest}
        onApprove={liveSigner.handleApprove}
        onReject={liveSigner.handleReject}
        askEveryTime
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  emptyContainer: {
    paddingVertical: 60
  }
})
