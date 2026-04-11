// Polyfill for Array.prototype.toSorted (ES2023).
// Hermes does not yet ship this method natively.
// Track: https://github.com/facebook/hermes/pull/1298
// Remove this polyfill once that PR is merged and shipped with React Native.

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
