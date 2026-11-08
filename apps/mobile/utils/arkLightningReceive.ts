import type { ArkLightningReceive } from '@/types/models/Ark'

/**
 * The payer has paid once the receive leaves `awaiting-payment`; claiming
 * into Ark happens after that and costs a fee, so the balance alone cannot
 * tell whether this invoice arrived.
 */
function hasArkLightningReceiveArrived(receive: ArkLightningReceive): boolean {
  return receive.state !== 'awaiting-payment'
}

export { hasArkLightningReceiveArrived }
