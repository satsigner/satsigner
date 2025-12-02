export type ProcessedBitcoinContent = {
  type: 'psbt' | 'address' | 'bip21'
  address?: string
  amount?: number
  label?: string
  content: string
}
