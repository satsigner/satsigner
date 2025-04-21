import { type Network } from 'bdk-rn/lib/lib/enums'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { type Account } from '@/types/models/Account'
import { aesEncrypt } from '@/utils/crypto'
import { parseAddressDescriptorToAddress } from '@/utils/parse'

function useAccountBuilderFinish() {
  const [
    getAccountData,
    updateKeyFingerprint,
    setKeyDerivationPath,
    updateKeySecret
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.getAccountData,
      state.updateKeyFingerprint,
      state.setKeyDerivationPath,
      state.updateKeySecret
    ])
  )
  const addAccount = useAccountsStore((state) => state.addAccount)

  const [addAccountWallet, addAccountAddress] = useWalletsStore(
    useShallow((state) => [state.addAccountWallet, state.addAccountAddress])
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [loading, setLoading] = useState(false)

  async function accountBuilderFinish(account: Account) {
    setLoading(true)

    const isImportAddress = account.keys[0].creationType === 'importAddress'

    const walletData = !isImportAddress
      ? await getWalletData(account, network as Network)
      : undefined
    if (!isImportAddress && !walletData) return // TODO: handle error

    for (const key of account.keys) {
      const stringifiedSecret = JSON.stringify(key.secret)
      const pin = await getItem(PIN_KEY)
      if (!pin) return // TODO: handle error

      const encryptedSecret = await aesEncrypt(
        stringifiedSecret,
        pin,
        account.keys[key.index].iv
      )

      if (walletData) {
        updateKeyFingerprint(key.index, walletData.fingerprint)
        setKeyDerivationPath(key.index, walletData.derivationPath)
      }
      updateKeySecret(key.index, encryptedSecret)
    }

    const accountWithEncryptedSecret = getAccountData()

    addAccount(accountWithEncryptedSecret)
    if (walletData)
      addAccountWallet(accountWithEncryptedSecret.id, walletData.wallet)
    if (isImportAddress && typeof account.keys[0].secret === 'object')
      addAccountAddress(
        accountWithEncryptedSecret.id,
        parseAddressDescriptorToAddress(
          account.keys[0].secret.externalDescriptor!
        )
      )

    setLoading(false)

    return { wallet: walletData?.wallet, accountWithEncryptedSecret }
  }

  return { accountBuilderFinish, loading }
}

export default useAccountBuilderFinish
