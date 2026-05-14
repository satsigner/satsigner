export type PaymentMethod = {
  accountId?: string
  balanceSats?: number
  detail?: string
  id: string
  label: string
  type: 'lightning' | 'ecash' | 'ark'
}
