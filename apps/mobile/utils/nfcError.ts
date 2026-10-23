import { NFC_DISABLED_MESSAGE_KEY } from '@/constants/nfc'
import { t } from '@/locales'

// Thrown by the NFC hooks when the user (or the app) cancels the NFC session.
export class NfcCancelledError extends Error {
  name = 'NfcCancelledError'
}

// Thrown by the NFC hooks when the device has NFC but it is switched off.
export class NfcDisabledError extends Error {
  name = 'NfcDisabledError'

  constructor() {
    super(t(NFC_DISABLED_MESSAGE_KEY))
  }
}

// i18n key to show for a failed NFC read or write, or null when the user
// cancelled it.
export function getNfcErrorKey(error: unknown, fallbackKey: string) {
  if (error instanceof NfcCancelledError) {
    return null
  }
  if (error instanceof NfcDisabledError) {
    return NFC_DISABLED_MESSAGE_KEY
  }
  return fallbackKey
}
