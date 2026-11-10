import { useState } from 'react'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import { type NostrDM } from '@/types/models/Nostr'
import { setClipboard } from '@/utils/clipboard'

type UseNostrChatMessageActionsParams = {
  messages: readonly NostrDM[]
  onDetails: (messageId: string) => void
  onReply: (messageId: string) => void
}

async function copyChatMessageText(text: string): Promise<void> {
  if (!(await setClipboard(text))) {
    toast.error(t('nostrIdentity.chat.message.copyFailed'))
    return
  }
  toast.success(t('common.copiedToClipboard'))
}

/** State and handlers behind the long-press menu of a chat message. */
function useNostrChatMessageActions({
  messages,
  onDetails,
  onReply
}: UseNostrChatMessageActionsParams) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedMessage =
    selectedId === null
      ? undefined
      : messages.find((message) => message.id === selectedId)

  function openActions(messageId: string) {
    setSelectedId(messageId)
  }

  function closeActions() {
    setSelectedId(null)
  }

  function handleReply() {
    if (selectedMessage) {
      onReply(selectedMessage.id)
    }
    closeActions()
  }

  async function handleCopy() {
    if (selectedMessage) {
      await copyChatMessageText(selectedMessage.description)
    }
    closeActions()
  }

  function handleDetails() {
    if (selectedMessage) {
      onDetails(selectedMessage.id)
    }
    closeActions()
  }

  return {
    closeActions,
    handleCopy,
    handleDetails,
    handleReply,
    openActions,
    selectedMessage
  }
}

export { copyChatMessageText, useNostrChatMessageActions }
