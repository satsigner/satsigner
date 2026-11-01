import { useRef, useState } from 'react'

import { allowBrantaLookup, lookupBrantaPayee } from '@/api/branta'
import {
  type BrantaLookupNotice,
  type BrantaPayee
} from '@/types/models/Branta'

import { useBrantaLookupConsent } from './useBrantaLookupConsent'

function useBrantaPayeeLookup() {
  const { confirmAutomaticBrantaLookup, confirmRequestedBrantaLookup, mode } =
    useBrantaLookupConsent()
  const [notice, setNotice] = useState<BrantaLookupNotice | null>(null)
  const [payee, setPayee] = useState<BrantaPayee | null>(null)
  const request = useRef(0)
  const pending = useRef<Promise<BrantaPayee | null>>(Promise.resolve(null))
  const latest = useRef<string | null>(null)

  async function resolveLookup(input: string, id: number) {
    const next = await lookupBrantaPayee(input)
    if (request.current !== id) {
      return null
    }
    setNotice(next.notice)
    setPayee(next.payee)
    return next.payee
  }

  function remember(input: string) {
    const trimmed = input.trim()
    latest.current = trimmed || null
  }

  async function lookup(input: string) {
    remember(input)
    const id = request.current + 1
    request.current = id
    setNotice(null)
    setPayee(null)
    const allowed = await confirmAutomaticBrantaLookup()
    if (!allowed || request.current !== id) {
      pending.current = Promise.resolve(null)
      return null
    }
    allowBrantaLookup()
    const promise = resolveLookup(input, id)
    pending.current = promise
    return promise
  }

  async function verifyLatest(fallback = '') {
    const current = latest.current ?? fallback.trim()
    if (!current) {
      return null
    }
    const id = request.current + 1
    request.current = id
    setNotice(null)
    setPayee(null)
    const allowed = await confirmRequestedBrantaLookup()
    if (!allowed || request.current !== id) {
      pending.current = Promise.resolve(null)
      return null
    }
    allowBrantaLookup()
    const promise = resolveLookup(current, id)
    pending.current = promise
    return promise
  }

  function adopt(next: BrantaPayee | null) {
    request.current += 1
    latest.current = null
    pending.current = Promise.resolve(next)
    setNotice(null)
    setPayee(next)
  }

  function settled() {
    return pending.current
  }

  return { adopt, lookup, mode, notice, payee, settled, verifyLatest }
}

export { useBrantaPayeeLookup }
