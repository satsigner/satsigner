import { assertNever } from '@/utils/assertNever'

/** `broadcast` is terminal: a transaction on the network is never sent again. */
type BroadcastState =
  | { status: 'idle' }
  | { status: 'broadcasting' }
  | { status: 'broadcast' }

type BroadcastEvent =
  | { type: 'start' }
  | { type: 'succeeded' }
  | { type: 'failed' }

const BROADCAST_IDLE: BroadcastState = { status: 'idle' }

function transitionBroadcast(
  state: BroadcastState,
  event: BroadcastEvent
): BroadcastState {
  switch (event.type) {
    case 'start': {
      return state.status === 'idle' ? { status: 'broadcasting' } : state
    }
    case 'succeeded': {
      return state.status === 'broadcasting' ? { status: 'broadcast' } : state
    }
    case 'failed': {
      return state.status === 'broadcasting' ? BROADCAST_IDLE : state
    }
    default: {
      return assertNever(event)
    }
  }
}

export { BROADCAST_IDLE, type BroadcastState, transitionBroadcast }
