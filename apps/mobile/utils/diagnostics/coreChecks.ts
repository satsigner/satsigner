import NetInfo from '@react-native-community/netinfo'
import { type Event, getPublicKey, nip17, nip19, nip59 } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'

import { NostrAPI } from '@/api/nostr'
import {
  NOSTR_LIVE_CHECK_FALLBACK_RELAYS,
  NOSTR_SECRET_KEY_BYTE_LENGTH,
  NOSTR_SECURITY_REPORT_NPUB
} from '@/constants/nostr'
import { getDb } from '@/db/connection'
import { deleteItem, getItem, setItem } from '@/storage/encrypted'
import {
  aesDecrypt,
  aesEncrypt,
  pbkdf2Encrypt,
  randomIv,
  randomKey,
  randomUuid
} from '@/utils/crypto'
import {
  derivePinDigest,
  LEGACY_KDF_CONFIG,
  safeEqualHex
} from '@/utils/pinKdf'
import { sleep } from '@/utils/time'

export type LegacyDiagnosticResult = {
  ok: boolean
  lines: string[]
}

const SECURE_STORE_PROBE_KEY = 'diagnostic_probe'
const LIVE_RETRIEVE_INITIAL_WAIT_MS = 3000
const LIVE_RETRIEVE_ATTEMPTS = 4
const LIVE_RETRIEVE_DELAY_MS = 2500

// Sized to run in ~1s on-device while still catching weak-RNG classes:
// any collision among 50k UUIDs (122 random bits each) or 20k IVs (128 bits)
// indicates a broken CSPRNG — expected collisions are ~2^-98 and ~2^-103.
const ENTROPY_UUID_SAMPLES = 50_000
const ENTROPY_IV_SAMPLES = 20_000
const ENTROPY_SANITY_KEY_BYTES = 32
const ENTROPY_SANITY_KEY_PATTERN = new RegExp(
  `^[0-9a-f]{${ENTROPY_SANITY_KEY_BYTES * 2}}$`
)

async function runGuarded(
  lines: string[],
  fn: () => void | Promise<void>
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
export async function checkCryptoRoundtrip(): Promise<LegacyDiagnosticResult> {
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
export async function checkPinKdf(): Promise<LegacyDiagnosticResult> {
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
export async function checkSecureStore(): Promise<LegacyDiagnosticResult> {
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
export async function checkSqlite(): Promise<LegacyDiagnosticResult> {
  const lines: string[] = []
  const ok = await runGuarded(lines, () => {
    const db = getDb()
    lines.push('database connection open')

    const first = db
      .execute<{ integrity_check: string }>('PRAGMA integrity_check')
      .rows.item(0)
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
export async function checkNip17Roundtrip(): Promise<LegacyDiagnosticResult> {
  const lines: string[] = []
  const ok = await runGuarded(lines, async () => {
    // Same generation path as NostrAPI.generateNostrKeys (randomKey), since
    // nostr-tools' react-native build does not export generateSecretKey.
    const secretKey = new Uint8Array(
      Buffer.from(await randomKey(NOSTR_SECRET_KEY_BYTE_LENGTH), 'hex')
    )
    const publicKey = getPublicKey(secretKey)
    lines.push(`ephemeral keypair ${publicKey.slice(0, 12)}…`)

    const content = 'satsigner diagnostic 🔐'
    const wrap = nip17.wrapEvent(secretKey, { publicKey }, content)
    if (wrap.kind !== nostrKinds.GiftWrap) {
      throw new Error(
        `expected gift wrap kind ${nostrKinds.GiftWrap}, got ${wrap.kind}`
      )
    }
    lines.push(`gift wrap created (kind ${nostrKinds.GiftWrap})`)

    const unwrapped = nip59.unwrapEvent(wrap, secretKey)
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
 * Collision test on the device's live CSPRNG output (randomUuid + randomIv).
 * The CI entropy audit (tests/entropy-audit) validates sources against node
 * crypto; this check validates the real native RNG on the running device —
 * a duplicated output here means the RNG is broken (Trust-Wallet-2023 class).
 */
export async function checkEntropyCollisions(): Promise<LegacyDiagnosticResult> {
  const lines: string[] = []
  const ok = await runGuarded(lines, async () => {
    let started = Date.now()
    const uuids = new Set<string>()
    for (let i = 0; i < ENTROPY_UUID_SAMPLES; i += 1) {
      uuids.add(randomUuid())
    }
    const uuidMs = Date.now() - started
    if (uuids.size !== ENTROPY_UUID_SAMPLES) {
      throw new Error(
        `${ENTROPY_UUID_SAMPLES - uuids.size} uuid collisions in ${ENTROPY_UUID_SAMPLES} samples`
      )
    }
    lines.push(
      `uuid: ${ENTROPY_UUID_SAMPLES.toLocaleString()} unique, 0 collisions (${uuidMs}ms)`
    )

    started = Date.now()
    const ivs = new Set<string>()
    for (let i = 0; i < ENTROPY_IV_SAMPLES; i += 1) {
      ivs.add(randomIv())
    }
    const ivMs = Date.now() - started
    if (ivs.size !== ENTROPY_IV_SAMPLES) {
      throw new Error(
        `${ENTROPY_IV_SAMPLES - ivs.size} iv collisions in ${ENTROPY_IV_SAMPLES} samples`
      )
    }
    lines.push(
      `iv: ${ENTROPY_IV_SAMPLES.toLocaleString()} unique, 0 collisions (${ivMs}ms)`
    )

    // Format sanity: a constant or truncated RNG often still "looks random".
    const sample = randomIv()
    if (!/^[0-9a-f]{32}$/.test(sample)) {
      throw new Error('randomIv output malformed')
    }
    const key = await randomKey(ENTROPY_SANITY_KEY_BYTES)
    if (!ENTROPY_SANITY_KEY_PATTERN.test(key)) {
      throw new Error('randomKey output malformed')
    }
    lines.push('output format sanity ok')
  })
  return { lines, ok }
}

/**
 * Connection watchdog: connects, then holds for 30s, logging the connected
 * count every 10s and probing liveness (a subscription that any live relay
 * answers with EOSE) before and after. Catches sockets that rot silently
 * after the initial handshake — the failure mode behind "connected but no
 * messages arrive".
 */
export async function checkRelayPersistence(
  relayUrls: string[] = []
): Promise<LegacyDiagnosticResult> {
  const lines: string[] = []

  const ok = await runGuarded(lines, async () => {
    const netState = await NetInfo.fetch()
    if (netState.isConnected === false) {
      throw new Error('device is offline')
    }

    const relays = resolveLiveRoundtripRelays(relayUrls)
    const api = new NostrAPI(relays)
    try {
      await api.connect()
      const initial = api.getConnectedRelayUrls()
      if (initial.length === 0) {
        throw new Error(`no relay connections (0/${relays.length})`)
      }
      lines.push(`connected ${initial.length}/${relays.length}`)
      for (const url of initial) {
        lines.push(`  ${url}`)
      }

      const probe0 = await api.probeLiveness()
      lines.push(`liveness probe: ${probe0 ? 'ok' : 'NO ANSWER'}`)
      if (!probe0) {
        throw new Error('connected but no relay answers subscriptions')
      }

      for (const elapsed of [10, 20, 30]) {
        await new Promise((resolve) => {
          setTimeout(resolve, 10_000)
        })
        const now = api.getConnectedRelayUrls()
        const dropped = initial.filter((url) => !now.includes(url))
        lines.push(
          `t+${elapsed}s: ${now.length}/${relays.length} connected${dropped.length ? ` (lost: ${dropped.join(', ')})` : ''}`
        )
      }

      const probe1 = await api.probeLiveness()
      lines.push(`liveness after 30s: ${probe1 ? 'ok' : 'NO ANSWER'}`)
      if (!probe1) {
        throw new Error('relays stopped answering during the hold')
      }
      if (api.getConnectedRelayUrls().length === 0) {
        throw new Error('all relay connections dropped during the hold')
      }
      lines.push('connections stable and answering')
    } finally {
      api.closeAllSubscriptions()
    }
  })
  return { lines, ok }
}

// Relays need a moment to index a fresh event, and a timeout on one attempt
// is not a verdict, so retrieval retries before failing.
async function fetchRawEventWithRetries(
  api: NostrAPI,
  eventId: string,
  attemptsLeft = LIVE_RETRIEVE_ATTEMPTS
): Promise<Event | null> {
  try {
    const event = await api.fetchRawEventById(eventId)
    if (event || attemptsLeft <= 1) {
      return event
    }
  } catch (error) {
    if (attemptsLeft <= 1) {
      throw error
    }
  }
  await sleep(LIVE_RETRIEVE_DELAY_MS)
  return fetchRawEventWithRetries(api, eventId, attemptsLeft - 1)
}

/** Configured relays when present, otherwise well-known DM-capable ones. */
export function resolveLiveRoundtripRelays(configured: string[]): string[] {
  return configured.length > 0 ? configured : NOSTR_LIVE_CHECK_FALLBACK_RELAYS
}

/**
 * Live NIP-17 roundtrip over real relays, using the app's own NostrAPI
 * stack. From a throwaway keypair: publishes a gift wrap to the project's
 * security-report npub (the SECURITY.md channel) plus a self-addressed copy,
 * then verifies both are retrievable by id and that the retrieved self copy
 * NIP-59-unwraps to the exact payload. Falls back to well-known relays when
 * the user has not configured any.
 */
export async function checkNip17LiveRoundtrip(
  relayUrls: string[] = []
): Promise<LegacyDiagnosticResult> {
  const lines: string[] = []

  const ok = await runGuarded(lines, async () => {
    const netState = await NetInfo.fetch()
    if (netState.isConnected === false) {
      throw new Error('device is offline')
    }

    const relays = resolveLiveRoundtripRelays(relayUrls)
    lines.push(
      relayUrls.length > 0
        ? `using ${relayUrls.length} configured relay(s)`
        : 'no relays configured — using well-known defaults'
    )

    const secretKey = new Uint8Array(
      Buffer.from(await randomKey(NOSTR_SECRET_KEY_BYTE_LENGTH), 'hex')
    )
    const publicKey = getPublicKey(secretKey)
    const nsec = nip19.nsecEncode(secretKey)
    const npub = nip19.npubEncode(publicKey)
    const probe = `satsigner diagnostic ${Date.now()}`
    lines.push(`ephemeral sender ${publicKey.slice(0, 12)}…`)

    const api = new NostrAPI(relays)

    // The wrap to the project npub proves the security-report delivery path;
    // the self wrap is retrievable AND decryptable by us, proving retrieval
    // and NIP-59 decryption of relay-served bytes.
    const reportWrap = api.createKind1059(
      nsec,
      NOSTR_SECURITY_REPORT_NPUB,
      probe
    )
    const selfWrap = api.createKind1059(nsec, npub, probe)

    // nip17.wrapEvent signs internally, so publishEvent needs no signer.
    await api.publishEvent(reportWrap)
    const connected = api.getConnectedRelayUrls()
    lines.push(
      `published gift wrap to ${NOSTR_SECURITY_REPORT_NPUB.slice(0, 16)}… ` +
        `(${connected.length}/${relays.length} relays connected)`
    )
    await api.publishEvent(selfWrap)
    lines.push('published self-addressed gift wrap')

    // Relays need a moment to index before id-based retrieval.
    await new Promise((resolve) => {
      setTimeout(resolve, LIVE_RETRIEVE_INITIAL_WAIT_MS)
    })

    const fetchedSelf = await fetchRawEventWithRetries(api, selfWrap.id)
    if (!fetchedSelf) {
      throw new Error('self wrap not retrievable after publish ACK')
    }
    lines.push('retrieved self wrap from relay')

    const rumor = nip59.unwrapEvent(fetchedSelf, secretKey)
    if (rumor.content !== probe || rumor.pubkey !== publicKey) {
      throw new Error('retrieved wrap did not unwrap to the probe payload')
    }
    lines.push('retrieved wrap decrypts to exact payload')

    const fetchedReport = await fetchRawEventWithRetries(api, reportWrap.id)
    if (!fetchedReport) {
      throw new Error('security-report wrap not retrievable after publish ACK')
    }
    lines.push('security-report wrap is retrievable on the relays')
  })
  return { lines, ok }
}
