import { Blockchain } from 'bdk-rn'
import { FeeRate } from 'bdk-rn/lib/classes/Bindings'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'

import SSButton from '@/components/SSButton'
import SSConsoleOutput from '@/components/SSConsoleOutput'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useBlockchainStore } from '@/store/blockchain'

export default function Developer() {
  const deleteAccounts = useAccountsStore((state) => state.deleteAccounts)
  const setFirstTime = useAuthStore((state) => state.setFirstTime)
  const getBlockChain = useBlockchainStore((state) => state.getBlockchain)

  const [deletingAccounts, setDeletingAccounts] = useState(false)
  const [gettingBdkInfo, setGettingBdkInfo] = useState(false)
  const [consoleTxt, setConsoleTxt] = useState([''])

  async function handleDeleteAccount() {
    setDeletingAccounts(true)
    await deleteAccounts()
    setDeletingAccounts(false)
    Alert.alert('Accounts deleted')
  }

  async function handleGetBdkInfo() {
    setGettingBdkInfo(true)
    try {
      const lines: [string] = ['METHODS ON BLOCKCHAIN OBJECT']
      const blockchain: Blockchain = await getBlockChain()
      const height: number = await blockchain.getHeight()
      lines.push('Blockchain.getHeight():' + height.toString())
      const feeFor4Confirmations: FeeRate = await blockchain.estimateFee(4)
      lines.push(
        'Blockchain.estimateFee(4).asSatPerVb(): ' +
          feeFor4Confirmations.asSatPerVb().toFixed(3) +
          ' sats/Vb'
      )
      const hashAtHeight0: string = await blockchain.getBlockHash(0)
      lines.push('Blockchain.getBlockHash(0): ' + hashAtHeight0)
      lines.push('Blockchain.broadcast(Transaction): Not called')
      lines.push('')
      setConsoleTxt(lines)
      setGettingBdkInfo(false)
    } catch (err: any) {
      setConsoleTxt([err.message])
      setGettingBdkInfo(false)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{i18n.t('settings.developer.title')}</SSText>
          ),
          headerBackVisible: true,
          headerLeft: () => <></>,
          headerRight: undefined
        }}
      />
      <SSMainLayout>
        <SSVStack>
          <SSButton
            label="Delete Accounts"
            loading={deletingAccounts}
            onPress={() => handleDeleteAccount()}
          />
          <SSButton
            label="Set PIN First Time"
            onPress={() => setFirstTime(true)}
          />
          <SSButton
            label="BDK info [BlockChain]"
            loading={gettingBdkInfo}
            onPress={() => handleGetBdkInfo()}
          />
          <SSConsoleOutput
            generating={gettingBdkInfo}
            consoleTxt={consoleTxt}
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
