import { NfcError } from 'react-native-nfc-manager'

import { NfcCancelledError } from '@/utils/nfcError'
import { toNfcSessionError } from '@/utils/nfcSession'

jest.mock<typeof import('react-native-nfc-manager')>(
  'react-native-nfc-manager',
  () => {
    class UserCancelError extends Error {
      name = 'UserCancelError'
    }
    return { NfcError: { UserCancel: UserCancelError } }
  }
)

describe('toNfcSessionError', () => {
  it('maps the library cancel error to NfcCancelledError', () => {
    expect(toNfcSessionError(new NfcError.UserCancel())).toBeInstanceOf(
      NfcCancelledError
    )
  })

  it('passes other errors through unchanged', () => {
    const error = new Error('tag lost')
    expect(toNfcSessionError(error)).toBe(error)
    expect(toNfcSessionError('cancelled')).toBe('cancelled')
  })
})
