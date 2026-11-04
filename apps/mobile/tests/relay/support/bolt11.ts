import { sha256 } from '@noble/hashes/sha2'
import { utf8ToBytes } from '@noble/hashes/utils'
import { bech32 } from 'bech32'

const BECH32_LIMIT = 1023
const WORD_BITS = 5
const WORD_BASE = 32
const TIMESTAMP_WORDS = 7
const SIGNATURE_WORDS = 104
const PAYMENT_HASH_TAG = 1
const DESCRIPTION_HASH_TAG = 23
const NANO_BTC_PER_SAT = 10

function taggedField(code: number, bytes: Uint8Array): number[] {
  const words = bech32.toWords(bytes)
  return [
    code,
    Math.floor(words.length / WORD_BASE),
    words.length % WORD_BASE,
    ...words
  ]
}

function timestampWords(seconds: number): number[] {
  return Array.from({ length: TIMESTAMP_WORDS }, (_, index) => {
    const shift = WORD_BITS * (TIMESTAMP_WORDS - 1 - index)
    return Math.floor(seconds / 2 ** shift) % WORD_BASE
  })
}

/**
 * A mainnet invoice for `amountSats` committing to `description` through its
 * description hash. The signature is zeros: decoders here don't verify it.
 */
function zapInvoice(
  amountSats: number,
  description: string,
  createdAt: number
): string {
  const words = [
    ...timestampWords(createdAt),
    ...taggedField(PAYMENT_HASH_TAG, sha256(utf8ToBytes(`hash ${createdAt}`))),
    ...taggedField(DESCRIPTION_HASH_TAG, sha256(utf8ToBytes(description))),
    ...Array.from({ length: SIGNATURE_WORDS }, () => 0)
  ]
  return bech32.encode(
    `lnbc${amountSats * NANO_BTC_PER_SAT}n`,
    words,
    BECH32_LIMIT
  )
}

export { zapInvoice }
