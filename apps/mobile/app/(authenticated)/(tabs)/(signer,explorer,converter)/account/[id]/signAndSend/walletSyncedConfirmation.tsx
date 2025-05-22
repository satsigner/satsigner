import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatDate, formatTime } from '@/utils/format'

export default function WalletSyncedConfirmation() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [isSyncing, setIsSyncing] = useState(false)

  const [account, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === id!),
      state.updateAccount
    ])
  )
  const wallet = useGetAccountWallet(id!)

  const { syncAccountWithWallet } = useSyncAccountWithWallet()

  const goToNextStep = async () => {
    // TODO: add internal change address as an output

    // finally, go to the next page
    router.replace(`/account/${id}/signAndSend/ioPreview`)
  }

  const syncWallet = async () => {
    setIsSyncing(true)

    if (wallet && account) {
      const updatedAccount = await syncAccountWithWallet(account, wallet)
      updateAccount(updatedAccount)
    }

    setIsSyncing(false)

    goToNextStep()
  }

  return (
    <>
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
            <SSVStack gap="none">
              <SSText>
                Wallet last synced at{' '}
                {account?.lastSyncedAt ? (
                  <SSText>
                    {formatDate(account?.lastSyncedAt)}{' '}
                    {formatTime(account?.lastSyncedAt)}
                  </SSText>
                ) : (
                  <SSText>Never</SSText>
                )}
                .
              </SSText>
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
