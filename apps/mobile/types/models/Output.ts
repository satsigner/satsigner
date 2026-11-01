import { type BrantaPayee } from '@/types/models/Branta'

type OutputKind = 'fakeMix' | 'change'

export type Output = {
  localId: string
  to: string
  amount: number
  label: string
  kind?: OutputKind
  branta?: BrantaPayee
}
