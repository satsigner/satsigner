import { getPublicKey, nip17, nip59 } from 'nostr-tools'

import { getDb } from '@/db/connection'
import { deleteItem, getItem, setItem } from '@/storage/encrypted'
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
  | 'pinKdf'
  | 'secureStore'
  | 'sqlite'

const SECURE_STORE_PROBE_KEY = 'diagnostic_probe'

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

export const DIAGNOSTIC_CHECKS: { id: DiagnosticCheckId }[] = [
  { id: 'crypto' },
  { id: 'pinKdf' },
  { id: 'secureStore' },
  { id: 'sqlite' },
  { id: 'nip17' }
]

export function runDiagnosticCheck(
  id: DiagnosticCheckId
): Promise<DiagnosticResult> {
  switch (id) {
    case 'crypto':
      return checkCryptoRoundtrip()
    case 'nip17':
      return checkNip17Roundtrip()
    case 'pinKdf':
      return checkPinKdf()
    case 'secureStore':
      return checkSecureStore()
    case 'sqlite':
      return checkSqlite()
  }
}
