import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
// import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { useWalletsStore } from '@/store/wallets'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

export default function WalletSyncedConfirmation() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [isSyncing, setIsSyncing] = useState(false)

  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === id!)
  )
  const wallet = useWalletsStore((state) => state.wallets[id])

  const goToNextStep = async () => {
    // TODO: add internal change address as an output

    // finally, go to the next page
    router.replace(`/account/${id}/signAndSend/ioPreview`)
  }

  const syncWallet = async () => {
    setIsSyncing(true)
    // TODO: sync wallet
    if (wallet) {
      //
    }
    setIsSyncing(false)
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account!.name}</SSText>
        }}
      />
      <SSMainLayout>
        <SSVStack justifyBetween style={{ flexGrow: 1 }}>
          <SSVStack>
            <SSText size="3xl" uppercase center weight="bold">
              Ensure wallet data is updated
            </SSText>
            <SSVStack gap="none">
              <SSText size="lg" weight="bold">
                Incorret information can lead to invalid transaction
              </SSText>
              <SSText>
                Funds which you spent elsewhere but are still flagged as UTXOs
                by this wallet could lead to a transaction with invalid inputs.
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText size="lg" weight="bold">
                Missing information can result in privacy leaks
              </SSText>
              <SSText>
                Missing transactions may lead to reuse of internal change
                address, which links two distinct transactions sending to the
                same address.
              </SSText>
            </SSVStack>
            <SSVStack>
              <SSText>Update your wallet to avoid these issues.</SSText>
            </SSVStack>
          </SSVStack>
          <SSVStack gap="sm">
            <SSButton
              label="SYNC NOW"
              variant="secondary"
              onPress={syncWallet}
              loading={isSyncing}
            />
            <SSButton label="IGNORE" variant="danger" onPress={goToNextStep} />
            <SSButton label="PROCEED" onPress={goToNextStep} />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
