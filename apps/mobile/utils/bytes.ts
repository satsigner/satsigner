export const bytes = {
  fromKilo: (kBytes: number) => kBytes * 1000,
  fromMega: (MBytes: number) => MBytes * 1_000_000,
  kiloToMega: (kBytes: number) => kBytes / 1000,
  megaToKilo: (MBytes: number) => MBytes * 1000,
  toKilo: (bytes: number) => bytes / 1000,
  toMega: (bytes: number) => bytes / 1_000_000
}
