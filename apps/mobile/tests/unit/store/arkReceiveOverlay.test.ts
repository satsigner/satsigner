import { useArkReceiveOverlayStore } from '@/store/arkReceiveOverlay'
import type { ArkReceiveOverlayEvent } from '@/types/models/Ark'

function buildEvent(movementId: number): ArkReceiveOverlayEvent {
  return {
    accountId: 'a1',
    accountName: 'Account a1',
    amountSats: 21_000,
    movementId
  }
}

describe('useArkReceiveOverlayStore', () => {
  beforeEach(() => {
    useArkReceiveOverlayStore.setState({ queue: [] })
  })

  it('enqueueReceive appends events in order', () => {
    useArkReceiveOverlayStore.getState().enqueueReceive(buildEvent(1))
    useArkReceiveOverlayStore.getState().enqueueReceive(buildEvent(2))
    const { queue } = useArkReceiveOverlayStore.getState()
    expect(queue).toHaveLength(2)
    expect(queue[0].movementId).toBe(1)
    expect(queue[1].movementId).toBe(2)
  })

  it('dismissReceive removes only the first event', () => {
    useArkReceiveOverlayStore.getState().enqueueReceive(buildEvent(1))
    useArkReceiveOverlayStore.getState().enqueueReceive(buildEvent(2))
    useArkReceiveOverlayStore.getState().dismissReceive()
    const { queue } = useArkReceiveOverlayStore.getState()
    expect(queue).toHaveLength(1)
    expect(queue[0].movementId).toBe(2)
  })

  it('dismissReceive on an empty queue is a no-op', () => {
    useArkReceiveOverlayStore.getState().dismissReceive()
    expect(useArkReceiveOverlayStore.getState().queue).toHaveLength(0)
  })
})
