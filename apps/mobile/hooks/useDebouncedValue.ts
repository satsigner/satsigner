import { useEffect, useState } from 'react'

const DEFAULT_DEBOUNCE_MS = 400

export function useDebouncedValue<T>(
  value: T,
  delayMs = DEFAULT_DEBOUNCE_MS
): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
