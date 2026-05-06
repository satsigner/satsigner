import { MILLISATS_PER_SAT } from '@/constants/btc'

export function millisatsToSats(
  millisats: number,
  mode: 'ceil' | 'floor'
): number {
  return mode === 'ceil'
    ? Math.ceil(millisats / MILLISATS_PER_SAT)
    : Math.floor(millisats / MILLISATS_PER_SAT)
}
