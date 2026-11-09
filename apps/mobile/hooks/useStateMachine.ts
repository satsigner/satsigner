import { useRef, useState } from 'react'

/**
 * Holds a state machine driven by a pure transition. `send` applies the event
 * to the latest state synchronously, so two taps in the same frame cannot both
 * start the same step, and returns whether the event changed the state.
 */
export function useStateMachine<State, Event>(
  transition: (state: State, event: Event) => State,
  initialState: State
) {
  const [state, setState] = useState(initialState)
  const latest = useRef(initialState)

  function send(event: Event): boolean {
    const previous = latest.current
    const next = transition(previous, event)
    if (next === previous) {
      return false
    }
    latest.current = next
    setState(next)
    return true
  }

  return { send, state }
}
