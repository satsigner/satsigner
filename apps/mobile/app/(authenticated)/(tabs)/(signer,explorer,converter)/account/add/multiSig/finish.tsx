import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { toast } from 'sonner-native'

import { SSIconSuccess } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'

export default function ConfirmScreen() {
  const router = useRouter()
  const getAccountData = useAccountBuilderStore((state) => state.getAccountData)
  const updateAccount = useAccountsStore((state) => state.updateAccount)
  const connectionMode = useBlockchainStore(
    (state) => state.configs[state.selectedNetwork].config.connectionMode
  )
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
  const { accountBuilderFinish } = useAccountBuilderFinish()

  const [rotation, setRotation] = useState(0)
  const [completed, setCompleted] = useState(false)

  const [accountId, setAccountId] = useState<string>()

  const createMultisigWallet = useCallback(async () => {
    const account = getAccountData()
    setAccountId(account.id)

    const data = await accountBuilderFinish(account)
    if (!data) return
    setCompleted(true)

    try {
      if (connectionMode === 'auto') {
        const updatedAccount = await syncAccountWithWallet(
          data.accountWithEncryptedSecret,
          data.wallet!
        )
        updateAccount(updatedAccount)
      }
    } catch (error) {
      toast.error((error as Error).message)
    }
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
