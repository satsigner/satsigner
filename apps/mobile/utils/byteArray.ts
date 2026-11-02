// The app's Buffer polyfill (`buffer` package) throws when `Buffer#equals`
// gets a plain Uint8Array, which is what bitcoinjs-lib 7 returns.
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index])
}
