import { type DependencyList, useEffect } from 'react'

// oxlint-disable-next-line typescript/no-invalid-void-type
type CleanupOptional = void | (() => void)
type AsyncEffectCallback = () => Promise<CleanupOptional>

export function useAsyncEffect(
  callback: AsyncEffectCallback,
  deps: DependencyList
) {
  useEffect(() => {
    let active = true
    let cleanup: CleanupOptional

    // oxlint-disable-next-line promise/prefer-await-to-callbacks promise/prefer-await-to-then
    callback().then((result) => {
      if (active) {
        cleanup = result
      } else {
        result?.()
      }
    })

    return () => {
      active = false
      cleanup?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
