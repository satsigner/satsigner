import { nip19 } from 'nostr-tools'

import { useNostrStore } from '@/store/nostr'

export const TOAST_DURATION = 8000
export const TOAST_CONTENT_MAX = 200

// Module-level variable: set to the account ID whose chat screen is currently
// focused. Toast notifications are suppressed for that account while the user
// can already see the messages arriving in real-time.
let activeChatAccountId: string | null = null

export function setActiveChatAccount(accountId: string | null): void {
  activeChatAccountId = accountId
}

export function isChatActive(accountId: string): boolean {
  return activeChatAccountId === accountId
}

export function getAuthorDisplayName(pubkeyHex: string): string {
  try {
    const npub = nip19.npubEncode(pubkeyHex)
    const truncated = `${npub.slice(0, 12)}...${npub.slice(-4)}`
    const profile = useNostrStore.getState().profiles[npub]
    if (profile?.displayName) return `${profile.displayName} (${truncated})`
    return truncated
  } catch {
    return pubkeyHex.slice(0, 8)
  }
}
