import { type Wallet } from 'bdk-rn/lib/classes/Wallet'
import { useEffect, useState } from 'react'

import { type Account } from '@/types/models/Account'

function useGetFirstUnusedAddress(wallet: Wallet, account: Account) {
  const [firstUnusedAddress, setUnusedFirstAddress] = useState('')
  const [addressIndex, setAddressIndex] = useState(0)

  async function updateFirstAddress() {
    const seenAddresses: Record<string, boolean> = {}

    for (const tx of account.transactions) {
      for (const output of tx.vout) {
        if (output.address) {
          seenAddresses[output.address] = true
        }
      }
    }

    let newAddress = ''
    let index = -1
    do {
      index += 1
      const addrInfo = await wallet.getAddress(index)
      newAddress = await addrInfo.address.asString()
    } while (seenAddresses[newAddress] !== undefined)

    setAddressIndex(index)
    setUnusedFirstAddress(newAddress)
  }

  useEffect(() => {
    updateFirstAddress()
  }, [account, wallet]) // eslint-disable-line react-hooks/exhaustive-deps

  return [firstUnusedAddress, addressIndex]
}

export default useGetFirstUnusedAddress
