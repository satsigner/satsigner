// Extends type T ensuring some (not all) keys are optional
export type PartialSome<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] | undefined
}

// Extends type T ensuring all keys are not null
export type NonPartial<T> = {
  [K in keyof T]-?: NonNullable<T[K]>
}

// Extends type T ensuring some (not all) keys are not null
export type NonPartialSome<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>
}
