import { useState } from 'react'

/**
 * Value chosen in a select modal. The options only change the draft, so
 * Cancel keeps the value and Select commits the draft.
 */
export function useSelectModalDraft<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue)
  const [draft, setDraft] = useState(initialValue)
  const [visible, setVisible] = useState(false)

  function open() {
    setDraft(value)
    setVisible(true)
  }

  function select() {
    setValue(draft)
    setVisible(false)
  }

  function cancel() {
    setVisible(false)
  }

  return { cancel, draft, open, select, setDraft, value, visible }
}
