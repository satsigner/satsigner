import { useState } from 'react'

import { SSTextInputProps } from '@/components/SSTextInput'
import { useAccountsStore } from '@/store/accounts'
import { Account } from '@/types/models/Account'

type AccountNameValidationParams = {
  name?: Account['name']
  network?: Account['network']
}

function useAccountNameValidation({
  name = '',
  network = 'bitcoin'
}: AccountNameValidationParams) {
  const accounts = useAccountsStore((state) => state.accounts)
  const currentNetworkAccounts = accounts.filter(
    (account) => account.network === network
  )

  const [localAccountName, setLocalAccountName] = useState(name)
  const [isValidName, setIsValidName] = useState<SSTextInputProps['status']>()
  const [isPseudoDuplicatedName, setIsPseudoDuplicatedName] = useState(false) // pseudo-duplicate name = wallet of other network has same name

  function validateName(name: string) {
    if (name === '') {
      setIsValidName(undefined)
      return
    }
    const duplicated = currentNetworkAccounts.some(
      (account: Account) => account.name === name
    )
    setIsValidName(duplicated ? 'invalid' : 'valid')
    const pseudoDuplicated = accounts.some(
      (otherAccount: Account) =>
        otherAccount.network !== network && otherAccount.name === name
    )
    setIsPseudoDuplicatedName(pseudoDuplicated)
  }

  function handleSetAccountName(text: string) {
    setLocalAccountName(text)
    validateName(text)
  }

  return {
    handleSetAccountName,
    isPseudoDuplicatedName,
    isValidName,
    localAccountName
  }
}

export default useAccountNameValidation
