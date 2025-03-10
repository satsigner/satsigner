import { type Network } from 'bdk-rn/lib/lib/enums'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { useShallow } from 'zustand/react/shallow'

import { getWallet } from '@/api/bdk'
import { SSIconSuccess } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { PIN_KEY } from '@/config/auth'
import { aesEncrypt } from '@/utils/crypto'

export default function ConfirmScreen() {
  const router = useRouter()
  const [
    loadWallet,
    getAccount,
    getAccountData,
    updateKeyFingerprint,
    setKeyDerivationPath,
    updateKeySecret
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.loadWallet,
      state.getAccount,
      state.getAccountData,
      state.updateKeyFingerprint,
      state.setKeyDerivationPath,
      state.updateKeySecret
    ])
  )
  const [syncWallet, addAccount, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.syncWallet,
      state.addAccount,
      state.updateAccount
    ])
  )
  const addAccountWallet = useWalletsStore((state) => state.addAccountWallet)
  const network = useBlockchainStore((state) => state.network)

  const [rotation, setRotation] = useState<number>(0)
  const [completed, setCompleted] = useState<boolean>(false)

  const [accountId, setAccountId] = useState<string>()

  const createMultisigWallet = useCallback(async () => {
    const account = getAccountData()
    setAccountId(account.id)

    const walletData = await getWallet(account, network as Network)
    if (!walletData) return // TODO: handle error

    addAccountWallet(account.id, walletData.wallet)

    for (const key of account.keys) {
      const stringifiedSecret = JSON.stringify(key.secret)
      const pin = await getItem(PIN_KEY)
      if (!pin) return // TODO: handle error

      const encryptedSecret = await aesEncrypt(
        stringifiedSecret,
        pin,
        account.keys[key.index].iv
      )

      updateKeyFingerprint(key.index, walletData.fingerprint)
      setKeyDerivationPath(key.index, walletData.derivationPath)
      updateKeySecret(key.index, encryptedSecret)
    }

    const accountWithEncryptedSecret = getAccountData()

    addAccount(accountWithEncryptedSecret)

    setCompleted(true)

    // TODO: wrap around try catch and show error notification with sonner
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function rotate() {
    if (completed) return
    setRotation((prev: number) => (prev + 20) % 360)
    setTimeout(() => {
      rotate()
    }, 50)
  }

  function handleGoToWallet() {
    router.dismissAll()
    if (accountId) router.navigate(`/account/${accountId}`)
  }

  useEffect(() => {
    rotate()
    createMultisigWallet()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SSMainLayout style={{ paddingHorizontal: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.multisig.create')}</SSText>
          )
        }}
      />
      <SSVStack
        style={{
          flex: 1,
          paddingTop: 80,
          paddingHorizontal: 24,
          paddingBottom: 30
        }}
        justifyBetween
      >
        <SSVStack>
          <SSText center size="lg">
            {completed
              ? t('account.multisig.created')
              : t('account.multisig.creating')}
          </SSText>
          <SSHStack style={{ alignSelf: 'center', marginTop: 40 }}>
            <View style={{ width: 163, height: 163 }}>
              {completed ? (
                <SSIconSuccess width={159} height={159} />
              ) : (
                <Svg width="163" height="163" viewBox="0 0 163 163" fill="none">
                  <Circle
                    cx="81.5"
                    cy="81.5"
                    r="79.5"
                    stroke="#343434"
                    strokeWidth="3"
                  />
                  <Path
                    d="M161 81.5C161 125.407 125.407 161 81.5 161"
                    stroke="white"
                    strokeWidth="3"
                    transform={`rotate(${rotation} 81.5 81.5)`}
                  />
                </Svg>
              )}
            </View>
          </SSHStack>
        </SSVStack>
        {completed && (
          <SSVStack>
            <SSButton
              label={t('account.multisig.viewAllWallets')}
              variant="outline"
              uppercase
              onPress={() => router.dismissAll()}
            />
            <SSButton
              label={t('account.multisig.gotoWallet')}
              uppercase
              variant="secondary"
              onPress={handleGoToWallet}
            />
          </SSVStack>
        )}
      </SSVStack>
    </SSMainLayout>
  )
}
