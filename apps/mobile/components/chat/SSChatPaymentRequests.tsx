import SSChatPaymentRequestCard from '@/components/chat/SSChatPaymentRequestCard'
import type { DisplayPreferences } from '@/types/ui/displayPreferences'
import {
  getRequestKey,
  isChatPaymentRequestExpired
} from '@/utils/chatPaymentRequests'
import type { ChatPaymentRequest } from '@/utils/chatPaymentRequests'

type ChatPaymentActions = {
  canPayInvoice: boolean
  canPayBitcoin: (request: ChatPaymentRequest) => boolean
  displayPreferences: DisplayPreferences
  nowMs: number
  onCopy: (text: string) => void
  onPay: (request: ChatPaymentRequest) => void
}

type SSChatPaymentRequestsProps = {
  actions: ChatPaymentActions
  requests: ChatPaymentRequest[]
}

function canPayRequest(
  request: ChatPaymentRequest,
  actions: ChatPaymentActions
) {
  return request.kind === 'lightning'
    ? actions.canPayInvoice
    : actions.canPayBitcoin(request)
}

/** Payment request cards for the invoices and bitcoin: URIs in a message. */
function SSChatPaymentRequests({
  actions,
  requests
}: SSChatPaymentRequestsProps) {
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
      canPay={canPayRequest(request, actions)}
      onPay={actions.onPay}
      onCopy={actions.onCopy}
    />
  ))
}

export default SSChatPaymentRequests
export type { ChatPaymentActions }
