import { type Wallet } from 'bdk-rn/lib/classes/Wallet'
import { useEffect, useState } from 'react'

import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'

function useGetNumberOfUsedAddresses(wallet: Wallet, account: Account) {
  const [addressCount, setAddressCount] = useState(0)
  const [lastUsedAddressIndex, setLastUsedAddressIndex] = useState(0)

  const stopGap = useBlockchainStore(
    (state) => state.configs[account.network].config.stopGap
  )

  async function updateAddressCount() {
    const seenAddresses: Record<string, boolean> = {}

    if (!account) return

    for (const tx of account.transactions) {
      for (const output of tx.vout) {
        if (output.address) {
          seenAddresses[output.address] = true
        }
      }
    }

    let index = 0
    let lastIndexWithFunds = -1
    let localAddressCount = 0

    if (!wallet) return

    while (index < lastIndexWithFunds + stopGap) {
      const addrInfo = await wallet.getAddress(index)
      const addr = await addrInfo.address.asString()
      if (seenAddresses[addr] !== undefined) {
        lastIndexWithFunds = index
        localAddressCount += 1
      }
      index += 1
    }

    setLastUsedAddressIndex(lastIndexWithFunds)
    setAddressCount(localAddressCount)
  }

  useEffect(() => {
    updateAddressCount()
  }, [account, wallet]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    addressCount,
    lastUsedAddressIndex
  }
}

export default useGetNumberOfUsedAddresses
