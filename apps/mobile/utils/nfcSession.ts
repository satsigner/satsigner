import { NfcError } from 'react-native-nfc-manager'

import { NfcCancelledError } from '@/utils/nfcError'

// Maps react-native-nfc-manager's cancel error to NfcCancelledError, so
// callers can tell a cancelled NFC session from a failed one.
export function toNfcSessionError(error: unknown) {
  return error instanceof NfcError.UserCancel ? new NfcCancelledError() : error
}
