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

  // Safely convert lastSyncedAt to Date object
  const getLastSyncedDate = (): Date | null => {
    if (!account?.lastSyncedAt) return null

    try {
      // If it's already a Date object, return it
      if (account.lastSyncedAt instanceof Date) {
        return account.lastSyncedAt
      }

      // If it's a string or number, try to create a Date
      const date = new Date(account.lastSyncedAt)

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        // Invalid lastSyncedAt value
        return null
      }

      return date
    } catch (_error) {
      // Error parsing lastSyncedAt
      return null
    }
  }

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

  const lastSyncedDate = getLastSyncedDate()

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
                {lastSyncedDate ? (
                  <SSText>
                    {formatDate(lastSyncedDate)} {formatTime(lastSyncedDate)}
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
