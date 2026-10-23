import { useRef, useState } from 'react'

import { allowBrantaLookup, lookupBrantaPayee } from '@/api/branta'
import {
  type BrantaLookupSource,
  type BrantaPayee
} from '@/types/models/Branta'

import { useBrantaLookupConsent } from './useBrantaLookupConsent'

function useBrantaPayeeLookup() {
  const { confirmAutomaticBrantaLookup, confirmRequestedBrantaLookup, mode } =
    useBrantaLookupConsent()
  const [payee, setPayee] = useState<BrantaPayee | null>(null)
  const request = useRef(0)
  const pending = useRef<Promise<BrantaPayee | null>>(Promise.resolve(null))
  const latest = useRef<{ input: string; source: BrantaLookupSource } | null>(
    null
  )

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

  function remember(input: string, source: BrantaLookupSource) {
    const trimmed = input.trim()
    latest.current = trimmed ? { input: trimmed, source } : null
  }

  async function lookup(input: string, source: BrantaLookupSource) {
    remember(input, source)
    const id = request.current + 1
    request.current = id
    setPayee(null)
    const allowed = await confirmAutomaticBrantaLookup()
    if (!allowed || request.current !== id) {
      pending.current = Promise.resolve(null)
      return null
    }
    allowBrantaLookup()
    const promise = resolveLookup(input, source, id)
    pending.current = promise
    return promise
  }

  async function verifyLatest(fallback = '') {
    const fallbackLookup: { input: string; source: BrantaLookupSource } = {
      input: fallback.trim(),
      source: 'paste'
    }
    const current = latest.current ?? fallbackLookup
    if (!current.input) {
      return null
    }
    const id = request.current + 1
    request.current = id
    setPayee(null)
    const allowed = await confirmRequestedBrantaLookup()
    if (!allowed || request.current !== id) {
      pending.current = Promise.resolve(null)
      return null
    }
    allowBrantaLookup()
    const promise = resolveLookup(current.input, current.source, id)
    pending.current = promise
    return promise
  }

  function adopt(next: BrantaPayee | null) {
    request.current += 1
    latest.current = null
    pending.current = Promise.resolve(next)
    setPayee(next)
  }

  function settled() {
    return pending.current
  }

  return { adopt, lookup, mode, payee, settled, verifyLatest }
}

export { useBrantaPayeeLookup }
