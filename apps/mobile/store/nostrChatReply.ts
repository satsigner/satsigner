import { create } from 'zustand'

import type { NostrChatThreadRef } from '@/types/models/Nostr'

type NostrChatReplyState = {
  /** Message being replied to, per chat (see deviceChatKey / identityChatKey). */
  replyToByChat: Record<string, string>
}

type NostrChatReplyAction = {
  clearReplyTo: (chatKey: string) => void
  setReplyTo: (chatKey: string, messageId: string) => void
}

function deviceChatKey(accountId: string): string {
  return `device:${accountId}`
}

function identityChatKey({
  identityNpub,
  peerPubkey,
  protocol,
  sessionId
}: NostrChatThreadRef): string {
  return `identity:${identityNpub}:${protocol}:${peerPubkey}:${sessionId}`
}

const useNostrChatReplyStore = create<
  NostrChatReplyState & NostrChatReplyAction
>()((set) => ({
  clearReplyTo: (chatKey) => {
    set((state) => {
      const { [chatKey]: _cleared, ...rest } = state.replyToByChat
      return { replyToByChat: rest }
    })
  },
  replyToByChat: {},
  setReplyTo: (chatKey, messageId) => {
    set((state) => ({
      replyToByChat: { ...state.replyToByChat, [chatKey]: messageId }
    }))
  }
}))

export { deviceChatKey, identityChatKey, useNostrChatReplyStore }
