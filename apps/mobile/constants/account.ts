// displayIndex assigned to the very first account (per getNextDisplayIndex in
// utils/account.ts) and used as the accountBuilder store's placeholder value
// before a real index is computed for the in-progress account.
const INITIAL_DISPLAY_INDEX = 0

const MISSING_PUBKEY_PLACEHOLDER = 'N/A'
const ACCOUNT_PUBLIC_KEYS_DROP_ON_UNMOUNT_GC_TIME_MS = 0
const ACCOUNT_PUBLIC_KEYS_DECRYPT_ONCE_STALE_TIME_MS = Infinity

export {
  ACCOUNT_PUBLIC_KEYS_DECRYPT_ONCE_STALE_TIME_MS,
  ACCOUNT_PUBLIC_KEYS_DROP_ON_UNMOUNT_GC_TIME_MS,
  INITIAL_DISPLAY_INDEX,
  MISSING_PUBKEY_PLACEHOLDER
}
