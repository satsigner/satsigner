// displayIndex assigned to the very first account (per getNextDisplayIndex in
// utils/account.ts) and used as the accountBuilder store's placeholder value
// before a real index is computed for the in-progress account.
const INITIAL_DISPLAY_INDEX = 0

// Cosigner index used for watch-only PSBT imports (no cosigner).
const WATCH_ONLY_INDEX = -1

const MISSING_PUBKEY_PLACEHOLDER = 'N/A'

export { INITIAL_DISPLAY_INDEX, MISSING_PUBKEY_PLACEHOLDER, WATCH_ONLY_INDEX }
