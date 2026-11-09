import {
  BROADCAST_IDLE,
  type BroadcastState,
  transitionBroadcast
} from '@/utils/broadcastMachine'

const BROADCASTING: BroadcastState = { status: 'broadcasting' }

describe('transitionBroadcast', () => {
  it('starts only from idle', () => {
    expect(
      transitionBroadcast(BROADCAST_IDLE, { type: 'start' })
    ).toStrictEqual(BROADCASTING)
    expect(transitionBroadcast(BROADCASTING, { type: 'start' })).toBe(
      BROADCASTING
    )
  })

  it('never broadcasts again once the transaction is out', () => {
    const done = transitionBroadcast(BROADCASTING, { type: 'succeeded' })

    expect(done).toStrictEqual({ status: 'broadcast' })
    expect(transitionBroadcast(done, { type: 'start' })).toBe(done)
  })

  it('lets the user retry after a failed broadcast', () => {
    expect(transitionBroadcast(BROADCASTING, { type: 'failed' })).toBe(
      BROADCAST_IDLE
    )
  })
})
