import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { copyChatMessageText } from '@/hooks/useNostrChatMessageActions'
import { t } from '@/locales'
import { useNostrStore } from '@/store/nostr'
import { identityChatKey, useNostrChatReplyStore } from '@/store/nostrChatReply'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { type NostrChatThreadItem } from '@/types/models/Nostr'
import { formatNpub } from '@/utils/format'
import { safeNpubEncode } from '@/utils/nostr'
import {
  type ChatIdentity,
  type ChatMessageDetail,
  deleteChatMessageForEveryone,
  deleteChatMessageForMe,
  getChatPipelineApi,
  loadChatMessageDetail,
  nostrChatQueryKeys
} from '@/utils/nostrChat'
import { getNostrContactsRelays } from '@/utils/nostrContacts'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'
import {
  buildMessageDetailRows,
  buildMessagePreview,
  canDeleteMessageForEveryone,
  getChatProtocolKind,
  getMessageStatus
} from '@/utils/nostrMessageDetail'
import {
  nostrChatMessageHref,
  nostrChatThreadHref
} from '@/utils/nostrNavigation'
import { isNonEmptyString } from '@/utils/string'

type AuthorLabelResolver = (authorNpub: string) => string

function buildChatMessageView(
  detail: ChatMessageDetail,
  labelFor: AuthorLabelResolver,
  canSign: boolean
) {
  const { item, message, parent, replies, wrapCount } = detail
  function toPreview({ dm }: NostrChatThreadItem) {
    return buildMessagePreview(dm, labelFor(dm.author))
  }
  return {
    canDeleteForEveryone: canDeleteMessageForEveryone(
      canSign && message.direction === 'out' && message.status === 'sent',
      message.id
    ),
    canReply: canSign && message.protocol !== 'nip04',
    message,
    parent: parent ? toPreview(parent) : null,
    preview: toPreview(item),
    replies: replies.map(toPreview),
    rows: buildMessageDetailRows({
      authorNpub: item.dm.author,
      createdAt: message.created_at,
      id: message.id,
      kind: getChatProtocolKind(message.protocol),
      protocol: message.protocol,
      status: getMessageStatus(item.dm, item.failed),
      wrapCount
    })
  }
}

async function requestDeleteForEveryone(
  identity: ChatIdentity,
  peerNpub: string,
  messageId: string
): Promise<boolean> {
  const pipelineApi = getChatPipelineApi(identity.npub)
  const api =
    pipelineApi ?? new NostrAPI(getNostrContactsRelays(identity.relays))
  try {
    await deleteChatMessageForEveryone(api, identity, peerNpub, messageId)
    return true
  } catch (error) {
    toast.error(t('nostrIdentity.chat.message.deleteFailed'), {
      description: getNostrErrorMessage(error)
    })
    return false
  } finally {
    if (!pipelineApi) {
      api.closeAllSubscriptions()
    }
  }
}

export function useNostrChatMessageDetail(
  npub: string | undefined,
  messageId: string | undefined
) {
  const router = useRouter()
  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const profiles = useNostrStore((state) => state.profiles)
  const setReplyTo = useNostrChatReplyStore((state) => state.setReplyTo)
  const [deleting, setDeleting] = useState(false)
  const identityNpub = npub ?? ''

  const { data, isLoading } = useQuery({
    enabled: isNonEmptyString(npub) && isNonEmptyString(messageId),
    queryFn: () => loadChatMessageDetail(identityNpub, messageId ?? ''),
    queryKey: nostrChatQueryKeys.message(identityNpub, messageId ?? '')
  })

  function labelFor(authorNpub: string): string {
    if (authorNpub !== identityNpub) {
      return profiles[authorNpub]?.displayName ?? formatNpub(authorNpub)
    }
    const name = identity?.displayName ?? formatNpub(authorNpub)
    return `${name}${t('account.nostrSync.devicesGroupChat.youSuffix')}`
  }

  const nsec = identity?.nsec
  const detail = data
    ? buildChatMessageView(data, labelFor, isNonEmptyString(nsec))
    : null
  const peerNpub = detail ? safeNpubEncode(detail.message.peerPubkey) : ''

  function reply() {
    if (!detail?.canReply) {
      return
    }
    setReplyTo(
      identityChatKey(
        identityNpub,
        detail.message.protocol,
        detail.message.peerPubkey
      ),
      detail.message.id
    )
    router.dismissTo(
      nostrChatThreadHref(identityNpub, peerNpub, detail.message.protocol)
    )
  }

  async function copyText() {
    if (detail) {
      await copyChatMessageText(detail.message.content)
    }
  }

  function openMessage(targetId: string) {
    router.push(nostrChatMessageHref(identityNpub, peerNpub, targetId))
  }

  function deleteForMe() {
    if (!detail) {
      return
    }
    try {
      deleteChatMessageForMe(identityNpub, detail.message.id)
    } catch (error) {
      toast.error(t('nostrIdentity.chat.message.deleteFailed'), {
        description: getNostrErrorMessage(error)
      })
      return
    }
    toast.success(t('nostrIdentity.chat.message.deleted'))
    router.back()
  }

  async function deleteForEveryone() {
    if (!detail?.canDeleteForEveryone || !isNonEmptyString(nsec) || deleting) {
      return
    }
    setDeleting(true)
    const deleted = await requestDeleteForEveryone(
      { npub: identityNpub, nsec, relays: identity?.relays },
      peerNpub,
      detail.message.id
    )
    setDeleting(false)
    if (!deleted) {
      return
    }
    toast.success(t('nostrIdentity.chat.message.deleted'))
    router.back()
  }

  return {
    copyText,
    deleteForEveryone,
    deleteForMe,
    deleting,
    detail,
    identity,
    isLoading,
    openMessage,
    reply
  }
}
