/** Safe hex encoding — RN Uint8Array.toString('hex') is not hex. */
export function bytesToHex(bytes: Uint8Array | number[]): string {
  return Buffer.from(bytes).toString('hex')
}

export function hexToBytes(hex: string): number[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes: number[] = []
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(Number.parseInt(clean.slice(i, i + 2), 16))
  }
  return bytes
}
