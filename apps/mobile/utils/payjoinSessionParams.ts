import { type PayjoinSession } from '@/types/payjoin'
import { appendParamsToPayjoinUri } from '@/utils/payjoinUri'

/**
 * Keep receiver session.amountSats / label / uri in sync with the receive form.
 * Does not recreate the mailbox — only rewrites BIP21 extras on the same pj=.
 *
 * Needed because sessions often start before the user types an amount; the QR
 * display rewrites params locally, but the account card reads the store.
 */
function withReceiverSessionBip21Params(
  session: PayjoinSession,
  extras: {
    amountSats?: number
    label?: string
  }
): PayjoinSession {
  const nextAmount = extras.amountSats
  const nextLabel = extras.label
  const amountMatches =
    (session.amountSats ?? undefined) === (nextAmount ?? undefined)
  const labelMatches = (session.label ?? undefined) === (nextLabel ?? undefined)

  let { uri } = session
  try {
    uri = appendParamsToPayjoinUri(session.uri, {
      amountSats: nextAmount,
      label: nextLabel,
      pjos: session.pjos
    })
  } catch {
    // Keep prior URI if rewrite fails (e.g. malformed placeholder).
  }

  if (amountMatches && labelMatches && uri === session.uri) {
    return session
  }

  return {
    ...session,
    amountSats: nextAmount,
    label: nextLabel,
    updatedAt: Date.now(),
    uri
  }
}

export { withReceiverSessionBip21Params }
