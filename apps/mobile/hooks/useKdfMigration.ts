import { useAccountsStore } from '@/store/accounts'
import { migratePinKdfIfNeeded } from '@/utils/pinKdf'
import { reEncryptPinBoundSecrets } from '@/utils/reEncryptPinSecrets'

export default function useKdfMigration() {
  const accounts = useAccountsStore((state) => state.accounts)

  function migrateIfNeeded(
    pin: string,
    salt: string,
    storedDigest: string
  ): Promise<string | null> {
    return migratePinKdfIfNeeded(
      pin,
      salt,
      storedDigest,
      (oldDigest, newDigest) =>
        reEncryptPinBoundSecrets(oldDigest, newDigest, accounts)
    )
  }

  return migrateIfNeeded
}
