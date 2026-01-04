export const bytes = {
  toKilo: (bytes: number) => bytes / 1_000,
  toMega: (bytes: number) => bytes / 1_000_000,
  fromKilo: (kBytes: number) => kBytes * 1_000,
  fromMega: (MBytes: number) => MBytes * 1_000_000,
  kiloToMega: (kBytes: number) => kBytes / 1_000,
  megaToKilo: (MBytes: number) => MBytes * 1_000
}
