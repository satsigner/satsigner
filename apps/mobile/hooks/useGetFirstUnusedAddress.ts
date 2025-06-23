import { type AddressInfo } from 'bdk-rn/lib/classes/Bindings'
import { type Wallet } from 'bdk-rn/lib/classes/Wallet'
import { useEffect, useState } from 'react'

import { type Account } from '@/types/models/Account'

function useGetFirstUnusedAddress(wallet: Wallet, account: Account) {
  const [firstUnusedAddress, setUnusedFirstAddress] = useState('')
  const [firstUnusedAddressInfo, setUnusedFirstAddressInfo] =
    useState<AddressInfo | null>(null)
  const [addressIndex, setAddressIndex] = useState(0)

  async function updateFirstAddress() {
    const seenAddresses: Record<string, boolean> = {}

    if (!account) return

    for (const tx of account.transactions) {
      for (const output of tx.vout) {
        if (output.address) {
          seenAddresses[output.address] = true
        }
      }
    }

    if (!wallet) return

    let addrInfo: AddressInfo | null = null
    let newAddress = ''
    let index = -1
    do {
      index += 1
      addrInfo = await wallet.getAddress(index)
      newAddress = await addrInfo.address.asString()
    } while (seenAddresses[newAddress] !== undefined)

    setAddressIndex(index)
    setUnusedFirstAddressInfo(addrInfo)
    setUnusedFirstAddress(newAddress)
  }

  useEffect(() => {
    updateFirstAddress()
  }, [account, wallet]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    address: firstUnusedAddress,
    addressInfo: firstUnusedAddressInfo,
    addressIndex
  }
}

export default useGetFirstUnusedAddress
