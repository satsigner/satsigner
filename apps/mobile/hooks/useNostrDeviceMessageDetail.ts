import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { toast } from 'sonner-native'

import { getMessageWraps } from '@/db/nostrMessageState'
import { copyChatMessageText } from '@/hooks/useNostrChatMessageActions'
import { getAuthorLabel } from '@/hooks/useNostrMessage'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { deviceChatKey, useNostrChatReplyStore } from '@/store/nostrChatReply'
import { useNostrDeviceChatSendsStore } from '@/store/nostrDeviceChatSends'
import { type Account } from '@/types/models/Account'
import { type NostrDM } from '@/types/models/Nostr'
import {
  type AuthorDisplayInput,
  buildAuthorDisplayMap
} from '@/utils/nostrAuthorDisplay'
import {
  deleteDeviceMessageForEveryone,
  deleteDeviceMessageForMe,
  isOwnDeviceMessage
} from '@/utils/nostrDeviceChat'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'
import {
  buildMessageDetailRows,
  buildMessagePreview,
  canDeleteMessageForEveryone,
  findMessageReplies,
  formatMessageTags,
  getMessageStatus,
  parseMessageRumorInfo,
  toAuthorNpub
} from '@/utils/nostrMessageDetail'
import {
  deviceChatMessageHref,
  deviceGroupChatHref
} from '@/utils/nostrNavigation'

const DEVICE_MESSAGE_WRAPS_QUERY_KEY = 'nostrDeviceMessageWraps'

type DeviceAuthorLabeler = (message: NostrDM) => string

/** Same names as the devices chat, plus "(You)" on this device's messages. */
function createDeviceAuthorLabeler(
  account: Account,
  profiles: AuthorDisplayInput['profiles']
): DeviceAuthorLabeler {
  const authors = buildAuthorDisplayMap({
    dms: account.nostr.dms,
    members: [],
    nostr: account.nostr,
    profiles
  })
  return (message) => {
    const name = getAuthorLabel(authors, message.author)
    if (!isOwnDeviceMessage(account, message)) {
      return name
    }
    return `${name}${t('account.nostrSync.devicesGroupChat.youSuffix')}`
  }
}

function loadDeviceMessageDetail(
  account: Account,
  messageId: string,
  wrapCount: number,
  failed: boolean,
  labelFor: DeviceAuthorLabeler
) {
  function buildDevicePreview(message: NostrDM) {
    return buildMessagePreview(message, labelFor(message))
  }
  const dms = account.nostr?.dms ?? []
  const message = dms.find((dm) => dm.id === messageId)
  if (!message) {
    return null
  }
  const rumor = parseMessageRumorInfo(message.event)
  const parent = message.replyToId
    ? dms.find((dm) => dm.id === message.replyToId)
    : undefined
  return {
    canDeleteForEveryone: canDeleteMessageForEveryone(
      isOwnDeviceMessage(account, message),
      message.id
    ),
    message,
    parent: parent ? buildDevicePreview(parent) : null,
    preview: buildDevicePreview(message),
    replies: findMessageReplies(dms, message.id).map(buildDevicePreview),
    rows: buildMessageDetailRows({
      authorNpub: toAuthorNpub(message.author),
      createdAt: message.created_at,
      id: message.id,
      kind: rumor?.kind,
      status: getMessageStatus(message, failed),
      wrapCount
    }),
    tags: rumor && rumor.tags.length > 0 ? formatMessageTags(rumor.tags) : null
  }
}

async function requestDeleteForEveryone(accountId: string, message: NostrDM) {
  try {
    return await deleteDeviceMessageForEveryone(accountId, message)
  } catch (error) {
    toast.error(t('nostrIdentity.chat.message.deleteFailed'), {
      description: getNostrErrorMessage(error)
    })
    return null
  }
}

function notifyDeletedForEveryone(failedDeviceCount: number) {
  if (failedDeviceCount === 0) {
    toast.success(t('nostrIdentity.chat.message.deleted'))
    return
  }
  toast.warning(
    t('account.nostrSync.devicesGroupChat.partialDeleteWarning', {
      count: failedDeviceCount
    })
  )
}

export function useNostrDeviceMessageDetail(
  accountId: string | undefined,
  messageId: string | undefined
) {
  const router = useRouter()
  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === accountId)
  )
  const setReplyTo = useNostrChatReplyStore((state) => state.setReplyTo)
  const profiles = useNostrStore((state) => state.profiles)
  const [deleting, setDeleting] = useState(false)

  const { data: wrapCount = 0 } = useQuery({
    enabled: Boolean(accountId && messageId),
    queryFn: () => getMessageWraps(accountId ?? '', messageId ?? '').length,
    queryKey: [DEVICE_MESSAGE_WRAPS_QUERY_KEY, accountId, messageId]
  })

  const failed = useNostrDeviceChatSendsStore(
    (state) =>
      (state.failedDevicesByAccount[accountId ?? '']?.[messageId ?? '']
        ?.length ?? 0) > 0
  )

  const detail =
    account && messageId
      ? loadDeviceMessageDetail(
          account,
          messageId,
          wrapCount,
          failed,
          createDeviceAuthorLabeler(account, profiles)
        )
      : null

  function reply() {
    if (!accountId || !detail) {
      return
    }
    setReplyTo(deviceChatKey(accountId), detail.message.id)
    router.dismissTo(deviceGroupChatHref(accountId))
  }

  async function copyText() {
    if (detail) {
      await copyChatMessageText(detail.message.description)
    }
  }

  function openMessage(targetId: string) {
    if (!accountId) {
      return
    }
    router.push(deviceChatMessageHref(accountId, targetId))
  }

  function deleteForMe() {
    if (!accountId || !detail) {
      return
    }
    try {
      deleteDeviceMessageForMe(accountId, detail.message)
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
    if (!accountId || !detail?.canDeleteForEveryone || deleting) {
      return
    }
    setDeleting(true)
    const result = await requestDeleteForEveryone(accountId, detail.message)
    setDeleting(false)
    if (!result) {
      return
    }
    notifyDeletedForEveryone(result.failedDevices.length)
    router.back()
  }

  return {
    account,
    copyText,
    deleteForEveryone,
    deleteForMe,
    deleting,
    detail,
    openMessage,
    reply
  }
}
