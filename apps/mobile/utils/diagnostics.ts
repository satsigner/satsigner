import NetInfo from '@react-native-community/netinfo'
import { getPublicKey, nip17, nip19, nip59 } from 'nostr-tools'

import { NostrAPI } from '@/api/nostr'
import { getDb } from '@/db/connection'
import { deleteItem, getItem, setItem } from '@/storage/encrypted'
import type { NostrUnwrappedKind1059Event } from '@/types/models/Nostr'
import {
  aesDecrypt,
  aesEncrypt,
  pbkdf2Encrypt,
  randomIv,
  randomKey
} from '@/utils/crypto'
import {
  derivePinDigest,
  LEGACY_KDF_CONFIG,
  safeEqualHex
} from '@/utils/pinKdf'

export type DiagnosticResult = {
  ok: boolean
  lines: string[]
}

export type DiagnosticCheckId =
  | 'crypto'
  | 'nip17'
  | 'nip17Live'
  | 'pinKdf'
  | 'secureStore'
  | 'sqlite'

const SECURE_STORE_PROBE_KEY = 'diagnostic_probe'
const LIVE_PROBE_TIMEOUT_MS = 30_000

async function runGuarded(
  lines: string[],
  fn: () => Promise<void>
): Promise<boolean> {
  try {
    await fn()
    return true
  } catch (error) {
    lines.push(`error: ${error instanceof Error ? error.message : error}`)
    return false
  }
}

/** AES-256 encrypt/decrypt roundtrip + PBKDF2 determinism + IV uniqueness. */
export async function checkCryptoRoundtrip(): Promise<DiagnosticResult> {
  const lines: string[] = []
  const ok = await runGuarded(lines, async () => {
    const key = await pbkdf2Encrypt('diagnostic-pin', 'diagnostic-salt')
    const keyAgain = await pbkdf2Encrypt('diagnostic-pin', 'diagnostic-salt')
    if (key !== keyAgain) {
      throw new Error('pbkdf2 is not deterministic')
    }
    lines.push(`pbkdf2 deterministic (${key.slice(0, 12)}…)`)

    const iv = randomIv()
    const plaintext = 'satsigner diagnostic 🔐'
    const ciphertext = await aesEncrypt(plaintext, key, iv)
    const decrypted = await aesDecrypt(ciphertext, key, iv)
    if (decrypted !== plaintext) {
      throw new Error('aes roundtrip mismatch')
    }
    lines.push('aes-256 roundtrip ok')

    if (randomIv() === iv) {
      throw new Error('randomIv produced duplicate IVs')
    }
    lines.push('randomIv uniqueness ok')
  })
  return { lines, ok }
}

/** PIN KDF: derive under the legacy config, verify determinism + safeEqualHex. */
export async function checkPinKdf(): Promise<DiagnosticResult> {
  const lines: string[] = []
  const ok = await runGuarded(lines, async () => {
    const digest = await derivePinDigest(
      '1234',
      'diagnostic-salt',
      LEGACY_KDF_CONFIG
    )
    const digestAgain = await derivePinDigest(
      '1234',
      'diagnostic-salt',
      LEGACY_KDF_CONFIG
    )
    if (!safeEqualHex(digest, digestAgain)) {
      throw new Error('derivePinDigest is not deterministic')
    }
    lines.push('legacy pbkdf2 derivation deterministic')

    const other = await derivePinDigest(
      '9999',
      'diagnostic-salt',
      LEGACY_KDF_CONFIG
    )
    if (safeEqualHex(digest, other)) {
      throw new Error('distinct PINs produced equal digests')
    }
    if (safeEqualHex(digest, digest) !== true) {
      throw new Error('safeEqualHex reflexivity broken')
    }
    if (safeEqualHex(digest, '') !== false) {
      throw new Error('safeEqualHex accepts empty input')
    }
    lines.push('safeEqualHex semantics ok')
  })
  return { lines, ok }
}

/** SecureStore (Keychain/Keystore) write → read → delete roundtrip. */
export async function checkSecureStore(): Promise<DiagnosticResult> {
  const lines: string[] = []
  const ok = await runGuarded(lines, async () => {
    const value = `probe-${Date.now()}`
    await setItem(SECURE_STORE_PROBE_KEY, value)
    const read = await getItem(SECURE_STORE_PROBE_KEY)
    if (read !== value) {
      throw new Error('read-back mismatch')
    }
    lines.push('write/read ok')

    await deleteItem(SECURE_STORE_PROBE_KEY)
    const gone = await getItem(SECURE_STORE_PROBE_KEY)
    if (gone !== null) {
      throw new Error('delete did not remove the probe')
    }
    lines.push('delete ok')
  })
  return { lines, ok }
}

/** SQLite: connection opens and PRAGMA integrity_check passes. */
export async function checkSqlite(): Promise<DiagnosticResult> {
  const lines: string[] = []
  const ok = await runGuarded(lines, async () => {
    const db = getDb()
    lines.push('database connection open')

    const { results } = db.execute('PRAGMA integrity_check')
    const first = results?.[0] as { integrity_check?: string } | undefined
    // The jest mock returns no rows; on device a healthy db says 'ok'.
    if (first?.integrity_check && first.integrity_check !== 'ok') {
      throw new Error(`integrity_check: ${first.integrity_check}`)
    }
    lines.push(`integrity_check: ${first?.integrity_check ?? 'no rows (mock)'}`)
  })
  return { lines, ok }
}

/**
 * NIP-17/NIP-59 gift-wrap roundtrip to self with a throwaway keypair.
 * Pure crypto — no relay involved. Validates the security-report path.
 */
export async function checkNip17Roundtrip(): Promise<DiagnosticResult> {
  const lines: string[] = []
  const ok = await runGuarded(lines, async () => {
    // Same generation path as NostrAPI.generateNostrKeys (randomKey), since
    // nostr-tools' react-native build does not export generateSecretKey.
    const secretKey = new Uint8Array(
      Buffer.from(await randomKey(32), 'hex')
    )
    const publicKey = getPublicKey(secretKey)
    lines.push(`ephemeral keypair ${publicKey.slice(0, 12)}…`)

    const content = 'satsigner diagnostic 🔐'
    const wrap = nip17.wrapEvent(secretKey, { publicKey }, content)
    if (wrap.kind !== 1059) {
      throw new Error(`expected gift wrap kind 1059, got ${wrap.kind}`)
    }
    lines.push('gift wrap created (kind 1059)')

    const unwrapped = nip59.unwrapEvent(wrap, secretKey) as {
      content?: string
      pubkey?: string
      kind?: number
    }
    if (unwrapped.content !== content) {
      throw new Error('unwrap content mismatch')
    }
    if (unwrapped.pubkey !== publicKey) {
      throw new Error('unwrap sender mismatch')
    }
    lines.push(`unwrap ok (rumor kind ${unwrapped.kind})`)
  })
  return { lines, ok }
}

/**
 * Live NIP-17 roundtrip over real relays, using the app's own NostrAPI
 * stack: subscribe for gift wraps to a throwaway key, publish a wrap to self,
 * then wait for the echo and verify it unwraps to the exact payload. Proves
 * the full security-report path: relay connectivity, publish ACK, retrieval,
 * and NIP-59 decryption.
 */
export async function checkNip17LiveRoundtrip(
  relayUrls: string[]
): Promise<DiagnosticResult> {
  const lines: string[] = []
  if (relayUrls.length === 0) {
    return {
      lines: ['no relays configured — pick relays in nostr settings first'],
      ok: false
    }
  }

  const ok = await runGuarded(lines, async () => {
    const netState = await NetInfo.fetch()
    if (netState.isConnected === false) {
      throw new Error('device is offline')
    }

    const secretKey = new Uint8Array(Buffer.from(await randomKey(32), 'hex'))
    const publicKey = getPublicKey(secretKey)
    const nsec = nip19.nsecEncode(secretKey)
    const npub = nip19.npubEncode(publicKey)
    const probe = `satsigner diagnostic ${Date.now()}`
    lines.push(`ephemeral keypair ${publicKey.slice(0, 12)}…`)

    const api = new NostrAPI(relayUrls)
    try {
      let resolveEcho: (event: NostrUnwrappedKind1059Event) => void = () => {}
      let rejectEcho: (error: Error) => void = () => {}
      const echoPromise = new Promise<NostrUnwrappedKind1059Event>(
        (resolve, reject) => {
          resolveEcho = resolve
          rejectEcho = reject
        }
      )
      const timeout = setTimeout(() => {
        rejectEcho(
          new Error(`no echo within ${LIVE_PROBE_TIMEOUT_MS / 1000}s`)
        )
      }, LIVE_PROBE_TIMEOUT_MS)

      // Subscribe before publishing so we cannot race our own echo.
      await api.subscribeToKind1059(nsec, npub, (messages) => {
        for (const message of messages) {
          const rumor = message.content as NostrUnwrappedKind1059Event
          if (rumor?.content === probe && rumor?.pubkey === publicKey) {
            resolveEcho(rumor)
          }
        }
      })
      lines.push(`subscribed for gift wraps on ${relayUrls.length} relay(s)`)

      // nip17.wrapEvent signs internally, so publishEvent needs no signer.
      const wrapEvent = api.createKind1059(nsec, npub, probe)
      await api.publishEvent(wrapEvent)
      lines.push('published gift wrap (kind 1059)')

      const echo = await echoPromise
      clearTimeout(timeout)
      lines.push('echo received and unwrapped')
      lines.push(`content and sender verified (${echo.id.slice(0, 12)}…)`)
    } finally {
      api.closeAllSubscriptions()
    }
  })
  return { lines, ok }
}

export const DIAGNOSTIC_CHECKS: {
  id: DiagnosticCheckId
  requiresNetwork?: boolean
}[] = [
  { id: 'crypto' },
  { id: 'pinKdf' },
  { id: 'secureStore' },
  { id: 'sqlite' },
  { id: 'nip17' },
  { id: 'nip17Live', requiresNetwork: true }
]

export function runDiagnosticCheck(
  id: DiagnosticCheckId,
  ctx: { relayUrls?: string[] } = {}
): Promise<DiagnosticResult> {
  switch (id) {
    case 'crypto':
      return checkCryptoRoundtrip()
    case 'nip17':
      return checkNip17Roundtrip()
    case 'nip17Live':
      return checkNip17LiveRoundtrip(ctx.relayUrls ?? [])
    case 'pinKdf':
      return checkPinKdf()
    case 'secureStore':
      return checkSecureStore()
    case 'sqlite':
      return checkSqlite()
  }
}
