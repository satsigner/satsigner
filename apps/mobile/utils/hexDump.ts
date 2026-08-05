const HEX_BYTE_REGEX = /^[0-9a-f]{2}$/

function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase().replace(/^0x/, '').replace(/\s+/g, '')
}

function byteAscii(byte: number): string {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'
}

/**
 * Classic hex dump (Anatomy of Bitcoin / xxd style):
 * `00000000  01 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|`
 * Incomplete trailing nibbles are ignored.
 */
export function formatHexDump(hex: string, bytesPerLine = 16): string {
  const clean = normalizeHex(hex)
  const totalBytes = Math.floor(clean.length / 2)
  if (totalBytes === 0) {
    return ''
  }

  const lines: string[] = []
  for (let offset = 0; offset < totalBytes; offset += bytesPerLine) {
    let hexPart = ''
    let asciiPart = ''

    for (let j = 0; j < bytesPerLine; j += 1) {
      if (offset + j < totalBytes) {
        const byteHex = clean.slice((offset + j) * 2, (offset + j) * 2 + 2)
        if (!HEX_BYTE_REGEX.test(byteHex)) {
          hexPart += '?? '
          asciiPart += '?'
        } else {
          hexPart += `${byteHex} `
          asciiPart += byteAscii(Number.parseInt(byteHex, 16))
        }
      } else {
        hexPart += '   '
        asciiPart += ' '
      }
      // Extra gap between the two groups of 8 (when line has at least 16 slots)
      if (j === 7 && bytesPerLine > 8) {
        hexPart += ' '
      }
    }

    const offsetLabel = offset.toString(16).padStart(8, '0')
    // Anatomy of Bitcoin classic dump spacing before the ASCII gutter
    lines.push(`${offsetLabel}  ${hexPart} |${asciiPart}|`)
  }

  return lines.join('\n')
}
