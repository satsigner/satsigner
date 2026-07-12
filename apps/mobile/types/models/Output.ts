export type OutputKind = 'fakeMix'

export type Output = {
  localId: string
  to: string
  amount: number
  label: string
  kind?: OutputKind
}
