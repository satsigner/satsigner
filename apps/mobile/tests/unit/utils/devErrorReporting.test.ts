import { installDevErrorReporting } from '@/utils/devErrorReporting'

describe('installDevErrorReporting', () => {
  it('installs without throwing and is idempotent', () => {
    expect(() => installDevErrorReporting()).not.toThrow()
    expect(() => installDevErrorReporting()).not.toThrow()
  })

  it('is a no-op outside __DEV__', () => {
    const g = globalThis as Record<string, unknown>
    delete g.__satsignerDevErrorReporting__
    const originalDev = (global as { __DEV__?: boolean }).__DEV__
    ;(global as { __DEV__: boolean }).__DEV__ = false
    try {
      installDevErrorReporting()
      expect(g.__satsignerDevErrorReporting__).toBeUndefined()
    } finally {
      ;(global as { __DEV__: boolean }).__DEV__ = originalDev ?? true
    }
  })
})
