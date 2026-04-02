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
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
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
    const [firstKey] = account.keys
    const isImportAddress = firstKey.creationType === 'importAddress'
    const { policyType } = account
    const { creationType } = firstKey

    try {
      const walletData = !isImportAddress
        ? await getWalletData(account, appNetworkToBdkNetwork(network))
        : undefined

      if (!isImportAddress && !walletData) {
        return
      }

      const pin = await getItem(PIN_KEY)
      if (!pin) {
        return
      }

      for (const key of account.keys) {
        const stringifiedSecret = JSON.stringify(key.secret)
        const encryptedSecret = await aesEncrypt(
          stringifiedSecret,
          pin,
          account.keys[key.index].iv
        )

        if (walletData) {
          if (account.policyType === 'multisig' && walletData.keyFingerprints) {
            for (const [
              index,
              fingerprint
            ] of walletData.keyFingerprints.entries()) {
              updateKeyFingerprint(index, fingerprint as string)
            }
          } else {
            updateKeyFingerprint(key.index, walletData.fingerprint)
          }
          setKeyDerivationPath(key.index, walletData.derivationPath)
        }

        updateKeySecret(key.index, encryptedSecret)
      }

      const accountWithEncryptedSecret = getAccountData()
      accountWithEncryptedSecret.policyType = policyType
      accountWithEncryptedSecret.keys[0].creationType = creationType

      addAccount(accountWithEncryptedSecret)
      if (walletData) {
        addAccountWallet(accountWithEncryptedSecret.id, walletData.wallet)
      }

      if (isImportAddress && typeof account.keys[0].secret === 'object') {
        addAccountAddress(
          accountWithEncryptedSecret.id,
          parseAddressDescriptorToAddress(
            account.keys[0].secret.externalDescriptor!
          )
        )
      }

      return {
        accountWithEncryptedSecret,
        wallet: walletData?.wallet
      }
    } finally {
      setLoading(false)
    }
  }

  return { accountBuilderFinish, loading }
}

export default useAccountBuilderFinish
