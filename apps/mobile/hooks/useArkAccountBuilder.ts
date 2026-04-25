import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { createArkWallet } from '@/api/ark'
import { getArkServer } from '@/constants/arkServers'
import { t } from '@/locales'
import { deleteArkDatadir, ensureArkDatadir } from '@/storage/arkDatadir'
import { deleteArkMnemonic, storeArkMnemonic } from '@/storage/encrypted'
import { useArkStore } from '@/store/ark'
import { useArkAccountBuilderStore } from '@/store/arkAccountBuilder'
import type { ArkAccount } from '@/types/models/Ark'
import { decryptKeySecretFromStore, getPin } from '@/utils/account'

import { useCreateSinglesigAccount } from './useCreateSinglesigAccount'

async function resolveMnemonicFromBitcoinAccount(
  accountId: string
): Promise<string> {
  const pin = await getPin()
  const secret = await decryptKeySecretFromStore(accountId, 0, pin)
  if (!secret.mnemonic) {
    throw new Error('Selected Bitcoin account has no mnemonic')
  }
  return secret.mnemonic
}

export function useArkAccountBuilder() {
  const [
    name,
    network,
    serverId,
    bitcoinAccountId,
    createBitcoinAccount,
    setName,
    setNetwork,
    setServerId,
    setBitcoinAccountId,
    setCreateBitcoinAccount,
    getArkAccountData,
    clearBuilder
  ] = useArkAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.network,
      state.serverId,
      state.bitcoinAccountId,
      state.createBitcoinAccount,
      state.setName,
      state.setNetwork,
      state.setServerId,
      state.setBitcoinAccountId,
      state.setCreateBitcoinAccount,
      state.getAccountData,
      state.clearAccount
    ])
  )

  const addArkAccount = useArkStore((state) => state.addAccount)
  const { createSinglesigAccount } = useCreateSinglesigAccount()

  async function resolveMnemonic(
    arkAccountName: string
  ): Promise<{ mnemonic: string; linkedBitcoinAccountId: string | null }> {
    if (createBitcoinAccount) {
      const created = await createSinglesigAccount({
        name: `${arkAccountName} (on-chain)`,
        network,
        scriptVersion: 'P2WPKH'
      })
      return {
        linkedBitcoinAccountId: created.account.id,
        mnemonic: created.mnemonic
      }
    }
    if (!bitcoinAccountId) {
      throw new Error('No Bitcoin on-chain account selected')
    }
    const mnemonic = await resolveMnemonicFromBitcoinAccount(bitcoinAccountId)
    return { linkedBitcoinAccountId: bitcoinAccountId, mnemonic }
  }

  async function createAccount(): Promise<ArkAccount> {
    const server = getArkServer(network, serverId)
    if (!server) {
      throw new Error('Ark server not available for the selected network')
    }

    const account = await getArkAccountData()
    const { mnemonic, linkedBitcoinAccountId } = await resolveMnemonic(
      account.name
    )
    const persistedAccount: ArkAccount = {
      ...account,
      bitcoinAccountId: linkedBitcoinAccountId
    }

    const datadir = await ensureArkDatadir(persistedAccount.id)
    await storeArkMnemonic(persistedAccount.id, mnemonic)
    try {
      const { serverAccessTokens } = useArkStore.getState()
      await createArkWallet({
        accountId: persistedAccount.id,
        datadir,
        mnemonic,
        server,
        serverAccessToken: serverAccessTokens[network]
      })
    } catch (error) {
      await deleteArkMnemonic(persistedAccount.id).catch(() => undefined)
      await deleteArkDatadir(persistedAccount.id).catch(() => undefined)
      throw error
    }

    addArkAccount(persistedAccount)
    clearBuilder()
    toast.success(t('ark.account.createSuccess'))
    return persistedAccount
  }

  return {
    bitcoinAccountId,
    clearBuilder,
    createAccount,
    createBitcoinAccount,
    name,
    network,
    serverId,
    setBitcoinAccountId,
    setCreateBitcoinAccount,
    setName,
    setNetwork,
    setServerId
  }
}
