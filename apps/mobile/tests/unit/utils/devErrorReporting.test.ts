import { installDevErrorReporting } from '@/utils/devErrorReporting'

describe('installDevErrorReporting', () => {
  it('installs without throwing and is idempotent', () => {
    expect(() => installDevErrorReporting()).not.toThrow()
    expect(() => installDevErrorReporting()).not.toThrow()
  })

  it('reports global errors and still calls the previous handler', () => {
    const g = globalThis as Record<string, unknown>
    delete g.__satsignerDevErrorReporting__
    const originalErrorUtils = g.ErrorUtils
    const previous = jest.fn()
    const setGlobalHandler = jest.fn()
    g.ErrorUtils = { getGlobalHandler: () => previous, setGlobalHandler }
    const consoleError = jest.spyOn(console, 'error').mockReturnValue()
    try {
      installDevErrorReporting()
      const [[handler]] = setGlobalHandler.mock.calls
      const error = new Error('boom')
      handler(error, true)
      expect(previous).toHaveBeenCalledWith(error, true)
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('Fatal error: boom')
      )
    } finally {
      g.ErrorUtils = originalErrorUtils
      consoleError.mockRestore()
    }
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
