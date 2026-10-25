/** Printable ASCII (space through tilde): letters, digits, space, symbols */
const BACKUP_PASSPHRASE_ALLOWED_REGEX = /^[ -~]+$/

// The backup holds every seed and leaves the device, so a short passphrase
// would fall to an offline guessing attack.
const MIN_BACKUP_PASSPHRASE_LENGTH = 12

function isValidBackupPassphrase(passphrase: string) {
  return (
    passphrase.length >= MIN_BACKUP_PASSPHRASE_LENGTH &&
    BACKUP_PASSPHRASE_ALLOWED_REGEX.test(passphrase)
  )
}

export { isValidBackupPassphrase, MIN_BACKUP_PASSPHRASE_LENGTH }
