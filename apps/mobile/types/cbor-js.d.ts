declare module 'cbor-js' {
  export function encode(data: unknown): Uint8Array
  export function decode(data: Uint8Array): unknown
}
