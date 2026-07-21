import { PAYJOIN_OHTTP_RELAY_URLS } from '@/constants/payjoin'

/**
 * Return a shuffled copy of OHTTP relay URLs so the first relay is not
 * always the same host (network-layer fingerprinting mitigation).
 */
function getShuffledOhttpRelays(
  relays: readonly string[] = PAYJOIN_OHTTP_RELAY_URLS
): string[] {
  const list = [...relays]
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(secureRandom() * (i + 1))
    const tmp = list[i]!
    list[i] = list[j]!
    list[j] = tmp
  }
  return list
}

function secureRandom(): number {
  if (
    globalThis.crypto !== undefined &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    const buf = new Uint32Array(1)
    globalThis.crypto.getRandomValues(buf)
    return buf[0]! / 0x1_0000_0000
  }
  return Math.random()
}

export { getShuffledOhttpRelays }
