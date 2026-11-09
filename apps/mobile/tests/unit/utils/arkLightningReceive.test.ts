import type { ArkLightningReceive } from '@/types/models/Ark'
import { hasArkLightningReceiveArrived } from '@/utils/arkLightningReceive'

function receive(state: ArkLightningReceive['state']): ArkLightningReceive {
  return { invoice: 'lnbc1', paymentHash: 'hash', settled: false, state }
}

describe('hasArkLightningReceiveArrived', () => {
  it.each(['awaiting-payment', 'htlcs-ready'])(
    'waits while the payment can still be refunded (%s)',
    (state) => {
      expect(hasArkLightningReceiveArrived(receive(state))).toBe(false)
    }
  )

  it.each(['preimage-revealed', 'delivering', 'settled'])(
    'counts %s as arrived',
    (state) => {
      expect(hasArkLightningReceiveArrived(receive(state))).toBe(true)
    }
  )
})
