import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { t } from '@/locales'
import { storeEcashMnemonic } from '@/storage/encrypted'
import { useEcashStore } from '@/store/ecash'
import { useEcashAccountBuilderStore } from '@/store/ecashAccountBuilder'
import type { EcashAccount } from '@/types/models/Ecash'
import { generateMnemonic, validateMnemonic } from '@/utils/bip39'

export function useEcashAccountBuilder() {
  const [
    name,
    mnemonic,
    importMode,
    setName,
    setMnemonic,
    setImportMode,
    getAccountData,
    clearAccount
  ] = useEcashAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.mnemonic,
      state.importMode,
      state.setName,
      state.setMnemonic,
      state.setImportMode,
      state.getAccountData,
      state.clearAccount
    ])
  )

  const [addAccount, setActiveAccountId] = useEcashStore(
    useShallow((state) => [state.addAccount, state.setActiveAccountId])
  )

  function generateNewMnemonic(): string {
    const words = generateMnemonic(12)
    setMnemonic(words)
    return words
  }

  function validateImportedMnemonic(words: string): boolean {
    const trimmed = words.trim()
    const wordCount = trimmed.split(/\s+/).length
    if (wordCount !== 12) {
      return false
    }
    return validateMnemonic(trimmed)
  }

  async function createAccount(): Promise<EcashAccount> {
    const trimmedMnemonic = mnemonic.trim()

    if (!trimmedMnemonic) {
      throw new Error('Mnemonic is required')
    }

    if (!validateMnemonic(trimmedMnemonic)) {
      throw new Error('Invalid mnemonic')
    }

    const account = await getAccountData()

    await storeEcashMnemonic(account.id, trimmedMnemonic)

    addAccount(account)
    setActiveAccountId(account.id)
    clearAccount()

    toast.success(t('ecash.success.accountCreated'))
    return account
  }

  return {
    clearAccount,
    createAccount,
    generateNewMnemonic,
    importMode,
    mnemonic,
    name,
    setImportMode,
    setMnemonic,
    setName,
    validateImportedMnemonic
  }
}
