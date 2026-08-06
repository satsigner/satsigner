import { type TextFontSize } from '@/styles/sizes'

function utxoAmountTextSize(value: number): TextFontSize {
  const digits = String(Math.trunc(Math.abs(value))).length
  if (digits >= 8) {
    return 'xl'
  }
  if (digits >= 6) {
    return '2xl'
  }
  return '3xl'
}

export { utxoAmountTextSize }
