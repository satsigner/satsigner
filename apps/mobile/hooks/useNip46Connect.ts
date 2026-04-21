import { useState } from 'react'

import { NIP46_DEFAULT_PERMISSIONS } from '@/constants/nip46'
import { useNip46Store } from '@/store/nip46'
import type { Nip46Session } from '@/types/models/Nip46'
import { randomUuid } from '@/utils/crypto'
import { parseNostrConnectUri } from '@/utils/nip46'

import { useNip46SessionManager } from './useNip46SessionManager'

export function useNip46Connect(signerNpub: string, nsec: string) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addSession = useNip46Store((s) => s.addSession)
  const { startSession } = useNip46SessionManager()

  async function initiateConnection(uri: string): Promise<Nip46Session | null> {
    setIsConnecting(true)
    setError(null)

    const parsed = parseNostrConnectUri(uri)
    if (!parsed) {
      setError('Invalid nostrconnect:// URI')
      setIsConnecting(false)
      return null
    }

    const session: Nip46Session = {
      clientName: parsed.name,
      clientPubkey: parsed.clientPubkey,
      createdAt: Date.now(),
      id: randomUuid() as string,
      lastActiveAt: Date.now(),
      permissions: { ...NIP46_DEFAULT_PERMISSIONS },
      relays: parsed.relays,
      secret: parsed.secret,
      signerNpub
    }

    try {
      addSession(session)
      await startSession(session, nsec)
      setIsConnecting(false)
      return session
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Connection failed'
      setError(errorMsg)
      setIsConnecting(false)
      return null
    }
  }

  return { error, initiateConnection, isConnecting }
}
