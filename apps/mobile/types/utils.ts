// Extends type T ensuring some (not all) keys are optional
export type PartialSome<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] | undefined
}
