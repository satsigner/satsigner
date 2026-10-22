import { HttpStatusError } from '@/utils/errors'
import { getLndErrorMessage, isLndPermissionError } from '@/utils/lndHttpError'

describe('lndHttpError', () => {
  describe('isLndPermissionError', () => {
    it('returns true for 403 in message', () => {
      expect(
        isLndPermissionError(new Error('LND API error: 403 forbidden'))
      ).toBe(true)
    })

    it('returns true for 401 in message', () => {
      expect(isLndPermissionError(new Error('LND API error: 401'))).toBe(true)
    })

    it('returns false for other errors', () => {
      expect(isLndPermissionError(new Error('LND API error: 500 oops'))).toBe(
        false
      )
      expect(isLndPermissionError(null)).toBe(false)
    })

    it('uses the status of an HttpStatusError', () => {
      expect(
        isLndPermissionError(new HttpStatusError(403, 'LND API error: 403'))
      ).toBe(true)
      expect(
        isLndPermissionError(
          new HttpStatusError(500, 'LND API error: 500 peer 403 unreachable')
        )
      ).toBe(false)
    })

    it('ignores 401 or 403 that only appear in the error body', () => {
      expect(
        isLndPermissionError('LND API error: 500 peer 403 unreachable')
      ).toBe(false)
    })

    it('accepts a plain message string', () => {
      expect(isLndPermissionError('LND API error: 403')).toBe(true)
    })
  })

  describe('getLndErrorMessage', () => {
    it('returns message for Error', () => {
      expect(getLndErrorMessage(new Error('x'))).toBe('x')
    })

    it('stringifies non-errors', () => {
      expect(getLndErrorMessage(42)).toBe('42')
    })

    it('returns string input unchanged', () => {
      expect(getLndErrorMessage('plain')).toBe('plain')
    })
  })
})
