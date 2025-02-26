import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { useShallow } from 'zustand/react/shallow'

import { SSIconSuccess } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'

export default function ConfirmScreen() {
  const [rotation, setRotation] = useState<number>(0)
  const [completed, setCompleted] = useState<boolean>(false)
  const accountName = useRef<string>('')
  const router = useRouter()
  const [loadWallet, getAccount] = useAccountBuilderStore(
    useShallow((state) => [state.loadWallet, state.getAccount])
  )
  const [syncWallet, addAccount, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.syncWallet,
      state.addAccount,
      state.updateAccount
    ])
  )

  const createMultisigWallet = useCallback(async () => {
    try {
      setTimeout(() => {
        setCompleted(true)
      }, 100000)
      const wallet = await loadWallet()
      const account = getAccount()
      accountName.current = account.name
      await addAccount(account)
      const syncedAccount = await syncWallet(wallet, account)
      await updateAccount(syncedAccount)
      setTimeout(() => {
        setCompleted(true)
      }, 2000)
    } catch {
      //
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function rotate() {
    if (completed) return
    setRotation((prev: number) => (prev + 20) % 360)
    setTimeout(() => {
      rotate()
    }, 50)
  }

  useEffect(() => {
    rotate()
    createMultisigWallet()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleViewAllWallet() {
    router.dismissAll()
  }

  function handleGoToWallet() {
    router.dismissAll()
    router.navigate(`/account/${accountName.current}`)
  }

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
              label={t('account.multisig.viewAllWallet')}
              variant="outline"
              uppercase
              onPress={handleViewAllWallet}
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
