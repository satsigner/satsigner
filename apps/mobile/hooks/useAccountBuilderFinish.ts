import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { storeKeySecret } from '@/storage/encrypted'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { type Account } from '@/types/models/Account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { aesEncrypt } from '@/utils/crypto'
import { parseAddressDescriptorToAddress } from '@/utils/parse'
import { getPin } from '@/utils/pin'

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

    async function persistAccount() {
      const walletData = !isImportAddress
        ? await getWalletData(account, appNetworkToBdkNetwork(network))
        : undefined

      if (!isImportAddress && !walletData) {
        return
      }

      const pin = await getPin()

      for (const key of account.keys) {
        const { iv } = account.keys[key.index]
        // A retry after a failed finish finds the secret already encrypted
        // by the first attempt; encrypting it again would store ciphertext of
        // ciphertext that can never be read back as a key.
        const encryptedSecret =
          typeof key.secret === 'string'
            ? key.secret
            : await aesEncrypt(JSON.stringify(key.secret), pin, iv)
        await storeKeySecret(account.id, key.index, encryptedSecret, iv)

        if (walletData) {
          if (account.policyType === 'multisig' && walletData.keyFingerprints) {
            for (const [
              index,
              fingerprint
            ] of walletData.keyFingerprints.entries()) {
              updateKeyFingerprint(index, fingerprint)
            }
          } else {
            const userFingerprint =
              typeof key.secret === 'object'
                ? key.secret.fingerprint
                : undefined
            const derivedFingerprint = walletData.fingerprint
            const isZero = (fp?: string) => !fp || /^0+$/.test(fp)
            const finalFingerprint = !isZero(derivedFingerprint)
              ? derivedFingerprint
              : userFingerprint
            if (finalFingerprint) {
              updateKeyFingerprint(key.index, finalFingerprint)
            }
          }
          setKeyDerivationPath(key.index, walletData.derivationPath)
        }

        updateKeySecret(key.index, encryptedSecret)
      }

      const data = getAccountData()
      const accountWithEncryptedSecret = {
        ...data,
        id: account.id,
        keys: data.keys.map((key, i) =>
          i === 0 ? { ...key, creationType } : key
        ),
        policyType
      }

      const isAlreadyAdded = useAccountsStore
        .getState()
        .accounts.some((stored) => stored.id === account.id)
      if (!isAlreadyAdded) {
        addAccount(accountWithEncryptedSecret)
      }
      if (walletData) {
        addAccountWallet(
          accountWithEncryptedSecret.id,
          walletData.wallet,
          walletData.dbPath
        )
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
    }

    return await persistAccount().finally(() => setLoading(false))
  }

  return { accountBuilderFinish, loading }
}

export default useAccountBuilderFinish
