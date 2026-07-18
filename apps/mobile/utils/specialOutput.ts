import { t } from '@/locales'

/** BIP141 witness commitment header after OP_RETURN push. */
const WITNESS_COMMITMENT_HEADER = [0xaa, 0x21, 0xa9, 0xed] as const
const OP_RETURN = 0x6a
const OP_PUSHBYTES_36 = 0x24

export type SpecialOutputKind = 'empty' | 'op_return' | 'witness_commitment'

export type OutputScript = string | number[] | Uint8Array | undefined

/**
 * Normalize scriptPubKey to bytes. Accepts hex strings (Esplora) or byte arrays
 * (wallet / BDK). ASM strings starting with OP_RETURN are treated as OP_RETURN.
 */
export function scriptToBytes(script: OutputScript): Uint8Array | undefined {
  if (script === undefined) {
    return undefined
  }

  if (typeof script === 'string') {
    const trimmed = script.trim()
    if (!trimmed) {
      return new Uint8Array()
    }

    if (/^OP_RETURN\b/i.test(trimmed)) {
      return new Uint8Array([OP_RETURN])
    }

    const hex = trimmed.toLowerCase().replace(/^0x/, '')
    if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/.test(hex)) {
      return undefined
    }

    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }

  return Uint8Array.from(script)
}

/**
 * Classify provably-special / non-payment outputs from scriptPubKey.
 * Returns undefined for ordinary addressable payment scripts.
 */
export function classifySpecialOutput(
  script: OutputScript
): SpecialOutputKind | undefined {
  const bytes = scriptToBytes(script)
  if (bytes === undefined) {
    return undefined
  }

  if (bytes.length === 0) {
    return 'empty'
  }

  // Core IsUnspendable: script starts with OP_RETURN.
  if (bytes[0] !== OP_RETURN) {
    return undefined
  }

  // BIP141 witness commitment: OP_RETURN <36 bytes: aa21a9ed || hash>
  if (
    bytes.length >= 38 &&
    bytes[1] === OP_PUSHBYTES_36 &&
    bytes[2] === WITNESS_COMMITMENT_HEADER[0] &&
    bytes[3] === WITNESS_COMMITMENT_HEADER[1] &&
    bytes[4] === WITNESS_COMMITMENT_HEADER[2] &&
    bytes[5] === WITNESS_COMMITMENT_HEADER[3]
  ) {
    return 'witness_commitment'
  }

  return 'op_return'
}

/**
 * Sankey layout needs a positive width. Keep a 1-sat visual stub for
 * zero-value special outputs so they stay visible and tagged.
 */
export function specialOutputLayoutValue(
  value: number,
  kind: SpecialOutputKind | undefined
): number {
  if (kind !== undefined && value <= 0) {
    return 1
  }
  return value
}

export function specialOutputTag(
  kind: SpecialOutputKind | undefined
): string | undefined {
  if (kind === 'empty') {
    return t('transaction.output.special.empty')
  }
  if (kind === 'op_return') {
    return t('transaction.output.special.opReturn')
  }
  if (kind === 'witness_commitment') {
    return t('transaction.output.special.witnessCommitment')
  }
  return undefined
}
