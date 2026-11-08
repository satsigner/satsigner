import type { ArkLightningReceive } from '@/types/models/Ark'
import { hasArkLightningReceiveArrived } from '@/utils/arkLightningReceive'

function receive(state: ArkLightningReceive['state']): ArkLightningReceive {
  return { invoice: 'lnbc1', paymentHash: 'hash', settled: false, state }
}

describe('hasArkLightningReceiveArrived', () => {
  it('waits while the invoice is unpaid', () => {
    expect(hasArkLightningReceiveArrived(receive('awaiting-payment'))).toBe(
      false
    )
  })

  it.each(['htlcs-ready', 'preimage-revealed', 'delivering', 'settled'])(
    'counts %s as arrived',
    (state) => {
      expect(hasArkLightningReceiveArrived(receive(state))).toBe(true)
    }
  )
})
