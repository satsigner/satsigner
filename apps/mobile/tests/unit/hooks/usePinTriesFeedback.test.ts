import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

import { usePinTriesFeedback } from '@/hooks/usePinTriesFeedback'
import { t } from '@/locales'
import { useAuthStore } from '@/store/auth'

type TriesFeedback = ReturnType<typeof usePinTriesFeedback>

const MAX_TRIES = 5

const mounted: ReturnType<typeof create>[] = []

function renderTriesFeedback() {
  const result: { current: TriesFeedback | null } = { current: null }
  function Harness() {
    result.current = usePinTriesFeedback()
    return null
  }
  act(() => {
    mounted.push(create(createElement(Harness)))
  })
  return result
}

function failTries(count: number) {
  act(() => {
    for (const _ of Array.from({ length: count })) {
      useAuthStore.getState().incrementPinTries()
    }
  })
}

describe('usePinTriesFeedback', () => {
  beforeEach(() => {
    useAuthStore.setState({ pinMaxTries: MAX_TRIES, pinTries: 0 })
  })

  afterEach(() => {
    act(() => {
      for (const renderer of mounted.splice(0)) {
        renderer.unmount()
      }
    })
  })

  it('says nothing before a wrong try', () => {
    const result = renderTriesFeedback()

    expect(result.current?.feedbackText).toBe('')
  })

  it('counts down the shared tries left after a wrong try', () => {
    const result = renderTriesFeedback()
    failTries(1)

    expect(result.current?.feedbackText).toBe(
      t('auth.triesLeft', { count: MAX_TRIES - 1 })
    )
    expect(result.current?.feedbackBold).toBe(false)
  })

  it('warns that the keys will be erased before the last tries', () => {
    const result = renderTriesFeedback()
    failTries(MAX_TRIES - 1)

    expect(result.current?.feedbackText).toBe(
      `${t('auth.triesLeft', { count: 1 })}\n${t('auth.warningKeysErase')}`
    )
    expect(result.current?.feedbackBold).toBe(true)
  })
})
