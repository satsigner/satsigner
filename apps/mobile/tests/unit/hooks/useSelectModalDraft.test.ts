import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

import { useSelectModalDraft } from '@/hooks/useSelectModalDraft'

type Picker = ReturnType<typeof useSelectModalDraft<number>>

function renderPicker(initialValue: number) {
  const result: { current: Picker | null } = { current: null }
  function Harness() {
    result.current = useSelectModalDraft(initialValue)
    return null
  }
  act(() => {
    create(createElement(Harness))
  })
  return result
}

function run(action: () => void) {
  act(() => {
    action()
  })
}

describe('useSelectModalDraft', () => {
  it('keeps the value when the modal is cancelled', () => {
    const picker = renderPicker(24)

    run(() => picker.current?.open())
    run(() => picker.current?.setDraft(12))
    run(() => picker.current?.cancel())

    expect(picker.current?.value).toBe(24)
    expect(picker.current?.visible).toBe(false)
  })

  it('commits the draft when the modal is confirmed', () => {
    const picker = renderPicker(24)

    run(() => picker.current?.open())
    run(() => picker.current?.setDraft(12))
    run(() => picker.current?.select())

    expect(picker.current?.value).toBe(12)
    expect(picker.current?.visible).toBe(false)
  })

  it('starts each opening from the current value', () => {
    const picker = renderPicker(24)

    run(() => picker.current?.open())
    run(() => picker.current?.setDraft(12))
    run(() => picker.current?.cancel())
    run(() => picker.current?.open())

    expect(picker.current?.visible).toBe(true)
    expect(picker.current?.draft).toBe(24)
  })
})
