import { useAccountsStore } from '@/store/accounts'
import { reEncryptPinBoundSecrets } from '@/utils/reEncryptPinSecrets'

export default function useReEncryptAccounts() {
  const accounts = useAccountsStore((state) => state.accounts)

  function reEncryptAccounts(oldPinEncrypted: string, newPinEncrypted: string) {
    return reEncryptPinBoundSecrets(oldPinEncrypted, newPinEncrypted, accounts)
  }

  return reEncryptAccounts
}
