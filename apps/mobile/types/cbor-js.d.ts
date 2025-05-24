declare module 'cbor-js' {
  export function encode(data: any): Uint8Array
  export function decode(data: Uint8Array): any
}
