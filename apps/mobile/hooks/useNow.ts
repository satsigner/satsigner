import { useEffect, useState } from 'react'

/** Tick `Date.now()` on an interval for relative countdowns. */
function useNow(intervalMs = 30_000): number {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now())
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return nowMs
}

export { useNow }
