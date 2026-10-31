import type { EcashMint, MintQuote } from '@/types/models/Ecash'

const NO_ITEMS: never[] = []
const URL_SCHEME = /^https?:\/\//

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

/** The mint's name, or the host of its URL when the mint is unknown or unnamed. */
function getEcashMintLabel(
  mints: Pick<EcashMint, 'name' | 'url'>[],
  mintUrl: string
) {
  return (
    mints.find((mint) => mint.url === mintUrl)?.name ??
    mintUrl.replace(URL_SCHEME, '').split('/')[0]
  )
}

export { activeAccountItems, activeAccountMintQuotes, getEcashMintLabel }
