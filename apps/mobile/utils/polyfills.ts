// Polyfills for Array methods from the "change array by copy" proposal (ES2023).
// Required because the Hermes build bundled with this React Native version does
// not yet ship these methods.

if (!Array.prototype.toSorted) {
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Array.prototype, 'toSorted', {
    configurable: true,
    value<T>(this: T[], compareFn?: (a: T, b: T) => number): T[] {
      return [...this].sort(compareFn)
    },
    writable: true
  })
}

if (!Array.prototype.toReversed) {
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Array.prototype, 'toReversed', {
    configurable: true,
    value<T>(this: T[]): T[] {
      return [...this].reverse()
    },
    writable: true
  })
}

if (!Array.prototype.toSpliced) {
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Array.prototype, 'toSpliced', {
    configurable: true,
    value<T>(
      this: T[],
      start: number,
      deleteCount?: number,
      ...items: T[]
    ): T[] {
      const copy = [...this]
      if (deleteCount === undefined) {
        copy.splice(start)
      } else {
        copy.splice(start, deleteCount, ...items)
      }
      return copy
    },
    writable: true
  })
}

if (!Array.prototype.with) {
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Array.prototype, 'with', {
    configurable: true,
    value<T>(this: T[], index: number, value: T): T[] {
      const copy = [...this]
      copy[index < 0 ? copy.length + index : index] = value
      return copy
    },
    writable: true
  })
}
