import {
  DESCRIPTOR_CHECKSUM_CHARSET,
  DESCRIPTOR_CHECKSUM_GENERATOR,
  DESCRIPTOR_CHECKSUM_INPUT_CHARSET,
  DESCRIPTOR_CHECKSUM_LENGTH
} from '@/constants/descriptor'

const CHECKSUM_SEPARATOR = '#'

// Port of the BIP-380 reference implementation (descsum_expand/polymod).
function expandDescriptorSymbols(descriptor: string): number[] {
  const symbols: number[] = []
  const groups: number[] = []
  for (const char of descriptor) {
    const position = DESCRIPTOR_CHECKSUM_INPUT_CHARSET.indexOf(char)
    if (position === -1) {
      throw new Error(`Invalid descriptor character: ${char}`)
    }
    symbols.push(position & 31)
    groups.push(position >> 5)
    if (groups.length === 3) {
      symbols.push(groups[0] * 9 + groups[1] * 3 + groups[2])
      groups.length = 0
    }
  }
  if (groups.length === 1) {
    symbols.push(groups[0])
  }
  if (groups.length === 2) {
    symbols.push(groups[0] * 3 + groups[1])
  }
  return symbols
}

function descriptorPolymod(symbols: number[]): bigint {
  return symbols.reduce((checksum, value) => {
    const top = checksum >> 35n
    const shifted = ((checksum & 0x7_ff_ff_ff_ffn) << 5n) ^ BigInt(value)
    return DESCRIPTOR_CHECKSUM_GENERATOR.reduce(
      (result, generator, index) =>
        (top >> BigInt(index)) & 1n ? result ^ generator : result,
      shifted
    )
  }, 1n)
}

/** BIP-380 checksum of a descriptor without its `#checksum` suffix. */
export function getDescriptorChecksum(descriptor: string): string {
  const padding = Array.from<number>({
    length: DESCRIPTOR_CHECKSUM_LENGTH
  }).fill(0)
  const checksum =
    descriptorPolymod([...expandDescriptorSymbols(descriptor), ...padding]) ^ 1n
  return Array.from({ length: DESCRIPTOR_CHECKSUM_LENGTH }, (_, index) => {
    const shift = BigInt(5 * (DESCRIPTOR_CHECKSUM_LENGTH - 1 - index))
    return DESCRIPTOR_CHECKSUM_CHARSET[Number((checksum >> shift) & 31n)]
  }).join('')
}

/**
 * True when the descriptor has no `#checksum`, or when the checksum matches
 * the exact text before it. Like BDK, the text is not normalised: `'` and `h`
 * give different checksums.
 */
export function isDescriptorChecksumValid(descriptor: string) {
  const separatorIndex = descriptor.indexOf(CHECKSUM_SEPARATOR)
  if (separatorIndex === -1) {
    return true
  }
  const body = descriptor.slice(0, separatorIndex)
  const checksum = descriptor.slice(separatorIndex + 1)
  try {
    return getDescriptorChecksum(body) === checksum
  } catch {
    return false
  }
}
