import SSChatPaymentRequestCard from '@/components/chat/SSChatPaymentRequestCard'
import type { Network } from '@/types/settings/blockchain'
import type { DisplayPreferences } from '@/types/ui/displayPreferences'
import {
  findChatPaymentRequests,
  getRequestKey,
  isChatPaymentRequestExpired
} from '@/utils/chatPaymentRequests'
import type { ChatPaymentRequest } from '@/utils/chatPaymentRequests'

type ChatPaymentActions = {
  canPayInvoice: boolean
  canPayBitcoin: (request: ChatPaymentRequest) => boolean
  displayPreferences: DisplayPreferences
  /** Network the lightning wallets pay on. */
  lightningNetwork: Network
  nowMs: number
  onCopy: (text: string) => void
  onPay: (request: ChatPaymentRequest) => void
}

type SSChatPaymentRequestsProps = {
  actions: ChatPaymentActions
  text: string
}

function canPayRequest(
  request: ChatPaymentRequest,
  actions: ChatPaymentActions
) {
  return request.kind === 'lightning'
    ? actions.canPayInvoice
    : actions.canPayBitcoin(request)
}

/** Bitcoin requests are checked per account, in canPayBitcoin. */
function isWrongNetwork(
  request: ChatPaymentRequest,
  actions: ChatPaymentActions
) {
  return (
    request.kind === 'lightning' && request.network !== actions.lightningNetwork
  )
}

/** Payment request cards for the invoices and bitcoin: URIs in a message. */
function SSChatPaymentRequests({ actions, text }: SSChatPaymentRequestsProps) {
  const requests = findChatPaymentRequests(text)
  if (requests.length === 0) {
    return null
  }
  return requests.map((request) => (
    <SSChatPaymentRequestCard
      key={getRequestKey(request)}
      request={request}
      displayPreferences={actions.displayPreferences}
      nowMs={actions.nowMs}
      expired={isChatPaymentRequestExpired(request, actions.nowMs)}
      wrongNetwork={isWrongNetwork(request, actions)}
      canPay={canPayRequest(request, actions)}
      onPay={actions.onPay}
      onCopy={actions.onCopy}
    />
  ))
}

export default SSChatPaymentRequests
export type { ChatPaymentActions }
