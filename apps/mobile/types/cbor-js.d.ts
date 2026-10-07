declare module 'cbor-js' {
  export function encode(data: unknown): ArrayBuffer
  export function decode(data: ArrayBufferLike): unknown
}
