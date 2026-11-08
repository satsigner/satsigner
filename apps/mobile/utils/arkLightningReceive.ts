import type { ArkLightningReceive } from '@/types/models/Ark'

// From here the payment can no longer be refunded to the payer. HTLCs that
// are only ready still can be, if the claim never happens.
const ARRIVED_RECEIVE_STATES = new Set<ArkLightningReceive['state']>([
  'preimage-revealed',
  'delivering',
  'settled'
])

/**
 * Whether this invoice's payment has arrived. The balance alone cannot tell:
 * claiming into Ark costs a fee and unrelated funds move it too.
 */
function hasArkLightningReceiveArrived(receive: ArkLightningReceive): boolean {
  return ARRIVED_RECEIVE_STATES.has(receive.state)
}

export { hasArkLightningReceiveArrived }
