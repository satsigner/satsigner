import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

import { useStateMachine } from '@/hooks/useStateMachine'

type Counter = { count: number }
type CounterEvent = { type: 'increment' } | { type: 'noop' }

function transition(state: Counter, event: CounterEvent): Counter {
  return event.type === 'increment' ? { count: state.count + 1 } : state
}

function renderMachine() {
  const result: {
    current?: ReturnType<typeof useStateMachine<Counter, CounterEvent>>
  } = {}
  function Probe() {
    result.current = useStateMachine(transition, { count: 0 })
    return null
  }
  act(() => {
    create(createElement(Probe))
  })
  return result
}

describe('useStateMachine', () => {
  it('applies back-to-back events to the latest state before re-render', () => {
    const machine = renderMachine()

    act(() => {
      machine.current?.send({ type: 'increment' })
      machine.current?.send({ type: 'increment' })
    })

    expect(machine.current?.state).toStrictEqual({ count: 2 })
  })

  it('reports whether an event changed the state', () => {
    const machine = renderMachine()
    const accepted: boolean[] = []

    act(() => {
      accepted.push(machine.current?.send({ type: 'increment' }) ?? false)
      accepted.push(machine.current?.send({ type: 'noop' }) ?? true)
    })

    expect(accepted).toStrictEqual([true, false])
  })
})
