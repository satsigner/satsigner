import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import { type Account, type Secret } from '@/types/models/Account'
import { aesDecrypt } from '@/utils/crypto'
import { parseAddressDescriptorToAddress } from '@/utils/parse'

const useGetAccountAddress = (id: Account['id']) => {
  const [address, addAccountAddress] = useWalletsStore(
    useShallow((state) => [state.addresses[id], state.addAccountAddress])
  )

  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === id)
  )

  async function addAddress() {
    if (!account || account.keys.length === 0) return

    const key = account.keys[0]
    let secret = key.secret

    if (typeof secret === 'string') {
      const pin = await getItem(PIN_KEY)
      if (!pin) return
      const iv = key.iv
      const accountSecretString = await aesDecrypt(secret, pin, iv)
      secret = JSON.parse(accountSecretString) as Secret
    }

    const descriptor = secret.externalDescriptor
    if (!descriptor) return

    const address = parseAddressDescriptorToAddress(descriptor)
    addAccountAddress(account.id, address)
  }

  useEffect(() => {
    if (!address) addAddress()
  }, [address, id, account]) // eslint-disable-line react-hooks/exhaustive-deps

  return address
}

export default useGetAccountAddress
