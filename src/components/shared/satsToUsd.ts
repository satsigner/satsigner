// TEMP hardcode
export default function satsToUsd(sats: number) {
  return sats / 100_000_000 * 52_000;
}
