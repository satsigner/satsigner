import { useEffect, useState } from 'react'
import {
  type AddressInfo,
  KeychainKind,
  type BdkWallet
} from 'react-native-bdk-sdk'

import { type Account } from '@/types/models/Account'

function useGetFirstUnusedAddress(wallet: BdkWallet, account: Account) {
  const [firstUnusedAddress, setUnusedFirstAddress] = useState('')
  const [firstUnusedAddressInfo, setUnusedFirstAddressInfo] =
    useState<AddressInfo | null>(null)
  const [addressIndex, setAddressIndex] = useState(0)

  async function updateFirstAddress() {
    const seenAddresses: Record<string, boolean> = {}

    if (!account) {
      return
    }

    for (const tx of account.transactions) {
      for (const output of tx.vout) {
        if (output.address) {
          seenAddresses[output.address] = true
        }
      }
    }

    if (!wallet) {
      return
    }

    let addrInfo: AddressInfo | null = null
    let newAddress = ''
    let index = -1
    do {
      index += 1

      try {
        addrInfo = wallet.peekAddress(KeychainKind.External, index)
        newAddress = addrInfo.address

        if (seenAddresses[newAddress] !== undefined) {
          // Address already used, continue searching
        }
      } catch {
        break
      }
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
    addressIndex,
    addressInfo: firstUnusedAddressInfo
  }
}

export default useGetFirstUnusedAddress
