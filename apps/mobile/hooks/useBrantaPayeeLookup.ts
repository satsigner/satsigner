import { useRef, useState } from 'react'

import { lookupBrantaPayee } from '@/api/branta'
import {
  type BrantaLookupSource,
  type BrantaPayee
} from '@/types/models/Branta'

function useBrantaPayeeLookup() {
  const [payee, setPayee] = useState<BrantaPayee | null>(null)
  const request = useRef(0)
  const pending = useRef<Promise<BrantaPayee | null>>(Promise.resolve(null))

  async function resolveLookup(
    input: string,
    source: BrantaLookupSource,
    id: number
  ) {
    const next = await lookupBrantaPayee(input, source)
    if (request.current !== id) {
      return null
    }
    setPayee(next)
    return next
  }

  function lookup(input: string, source: BrantaLookupSource) {
    const id = request.current + 1
    request.current = id
    setPayee(null)
    const promise = resolveLookup(input, source, id)
    pending.current = promise
    return promise
  }

  function adopt(next: BrantaPayee | null) {
    request.current += 1
    pending.current = Promise.resolve(next)
    setPayee(next)
  }

  function settled() {
    return pending.current
  }

  return { adopt, lookup, payee, settled }
}

export { useBrantaPayeeLookup }
