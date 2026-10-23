import type { MintQuote } from '@/types/models/Ecash'

const NO_ITEMS: never[] = []

/** The active account's list, or one shared empty list so selectors stay equal. */
function activeAccountItems<T>(
  itemsByAccount: Record<string, T[]>,
  accountId: string | null
): T[] {
  if (!accountId) {
    return NO_ITEMS
  }
  return itemsByAccount[accountId] ?? NO_ITEMS
}

/** The active account's pending mint quotes, with the same empty list rule. */
function activeAccountMintQuotes(
  quotesByAccount: Record<string, { mint: MintQuote[] }>,
  accountId: string | null
): MintQuote[] {
  if (!accountId) {
    return NO_ITEMS
  }
  return quotesByAccount[accountId]?.mint ?? NO_ITEMS
}

export { activeAccountItems, activeAccountMintQuotes }
