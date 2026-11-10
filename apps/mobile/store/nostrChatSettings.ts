import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  NOSTR_CHAT_POW_DEFAULT_MIN_INBOUND,
  NOSTR_POW_DEFAULT_DIFFICULTY
} from '@/constants/nostr'
import mmkvStorage from '@/storage/mmkv'

type NostrChatFilter = 'following' | 'others'

type NostrChatSettingsState = {
  /** Last inbox tab per identity npub. */
  chatFilterByNpub: Record<string, NostrChatFilter>
  /** NIP-13 bits required from senders you don't follow; 0 turns it off. */
  minInboundPowBits: number
  /** NIP-13 bits mined into every outgoing NIP-17 gift wrap and NIP-04 DM. */
  sendPowBits: number
}

type NostrChatSettingsAction = {
  clearAll: () => void
  removeChatFilter: (npub: string) => void
  setChatFilter: (npub: string, filter: NostrChatFilter) => void
  setMinInboundPowBits: (bits: number) => void
  setSendPowBits: (bits: number) => void
}

const INITIAL_STATE: NostrChatSettingsState = {
  chatFilterByNpub: {},
  minInboundPowBits: NOSTR_CHAT_POW_DEFAULT_MIN_INBOUND,
  sendPowBits: NOSTR_POW_DEFAULT_DIFFICULTY
}

const useNostrChatSettingsStore = create<
  NostrChatSettingsState & NostrChatSettingsAction
>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      clearAll: () => {
        set(INITIAL_STATE)
      },
      removeChatFilter: (npub) => {
        set((state) => ({
          chatFilterByNpub: Object.fromEntries(
            Object.entries(state.chatFilterByNpub).filter(
              ([filterNpub]) => filterNpub !== npub
            )
          )
        }))
      },
      setChatFilter: (npub, filter) => {
        set((state) => ({
          chatFilterByNpub: { ...state.chatFilterByNpub, [npub]: filter }
        }))
      },
      setMinInboundPowBits: (minInboundPowBits) => {
        set({ minInboundPowBits })
      },
      setSendPowBits: (sendPowBits) => {
        set({ sendPowBits })
      }
    }),
    {
      name: 'satsigner-nostr-chat-settings',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useNostrChatSettingsStore }
export type { NostrChatFilter }
