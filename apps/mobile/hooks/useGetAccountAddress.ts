import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import { type Account, type Secret } from '@/types/models/Account'
import { parseAddressDescriptorToAddress } from '@/utils/parse'

const useGetAccountAddress = (id: Account['id']) => {
  const [address, addAccountAddress] = useWalletsStore(
    useShallow((state) => [state.addresses[id], state.addAccountAddress])
  )

  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === id)
  )

  async function addAddress() {
    if (!account || !account.keys[0]) return

    const secret = account.keys[0].secret as Secret
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
