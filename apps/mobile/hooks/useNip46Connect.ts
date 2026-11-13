import { useState } from 'react'

import { NOSTR_NIP46_DEFAULT_PERMISSIONS } from '@/constants/nostr'
import { t } from '@/locales'
import { useNip46Store } from '@/store/nip46'
import type { Nip46Session } from '@/types/models/Nostr'
import { randomUuid } from '@/utils/crypto'
import { parseNostrConnectUri } from '@/utils/nip46'
import { deriveNpubFromNsec } from '@/utils/nostr'

import { useNip46SessionManager } from './useNip46SessionManager'

export function useNip46Connect(signerNpub: string, nsec: string) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addSession = useNip46Store((s) => s.addSession)
  const { startSession } = useNip46SessionManager()

  async function initiateConnection(uri: string): Promise<Nip46Session | null> {
    setIsConnecting(true)
    setError(null)

    // Checked before the session is stored, so a pairing that can never
    // sign leaves no app card behind.
    if (deriveNpubFromNsec(nsec) !== signerNpub) {
      setError(t('nip46.watchOnly'))
      setIsConnecting(false)
      return null
    }

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
      id: randomUuid(),
      lastActiveAt: Date.now(),
      permissions: { ...NOSTR_NIP46_DEFAULT_PERMISSIONS },
      relays: parsed.relays,
      secret: parsed.secret,
      signerNpub
    }

    try {
      const storedSession = addSession(session)
      await startSession(storedSession, nsec)
      setIsConnecting(false)
      return storedSession
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
