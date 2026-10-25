import {
  isValidBackupPassphrase,
  MIN_BACKUP_PASSPHRASE_LENGTH
} from '@/utils/backupPassphrase'

describe('isValidBackupPassphrase', () => {
  it('rejects a passphrase shorter than the minimum length', () => {
    expect(isValidBackupPassphrase('a')).toBe(false)
    expect(
      isValidBackupPassphrase('a'.repeat(MIN_BACKUP_PASSPHRASE_LENGTH - 1))
    ).toBe(false)
  })

  it('accepts a long printable ASCII passphrase', () => {
    expect(isValidBackupPassphrase('correct horse battery')).toBe(true)
  })

  it('rejects characters outside printable ASCII', () => {
    expect(isValidBackupPassphrase('correct horse battery é')).toBe(false)
  })
})
