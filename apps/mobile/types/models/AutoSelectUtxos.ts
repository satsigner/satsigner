export type AutoSelectUtxosAlgorithm = 'user' | 'privacy' | 'efficiency'

export type LoadingAutoSelectUtxosAlgorithm =
  | false
  | Exclude<AutoSelectUtxosAlgorithm, 'user'>
