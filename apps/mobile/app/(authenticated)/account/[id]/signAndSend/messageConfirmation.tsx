import * as Clipboard from 'expo-clipboard'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress } from '@/utils/format'

export default function MessageConfirmation() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [clearTransaction, txBuilderResult] = useTransactionBuilderStore(
    useShallow((state) => [state.clearTransaction, state.txBuilderResult])
  )
  const getCurrentAccount = useAccountsStore((state) => state.getCurrentAccount)

  const account = getCurrentAccount(id!)!

  function handleBackToHome() {
    clearTransaction()
    router.navigate(`/account/${id}`)
  }

  if (!txBuilderResult) return <Redirect href="/" />

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <SSMainLayout style={{ paddingBottom: 32 }}>
        <SSVStack justifyBetween>
          <SSVStack itemsCenter>
            <SSText weight="bold" size="lg">
              {i18n.t('messageConfirmation.messageBroadcasted')}
            </SSText>
            <SSVStack gap="none" itemsCenter>
              <SSText color="muted" uppercase>
                {i18n.t('messageConfirmation.messageId')}
              </SSText>
              <SSText>{formatAddress(txBuilderResult.txDetails.txid)}</SSText>
            </SSVStack>
          </SSVStack>
          <SSVStack>
            <SSButton
              variant="outline"
              label={i18n.t('messageConfirmation.copyTxMessageId')}
              onPress={() =>
                Clipboard.setStringAsync(txBuilderResult.txDetails.txid)
              }
            />
            <SSButton
              variant="outline"
              label={i18n.t('messageConfirmation.trackOnChain')}
              onPress={() =>
                WebBrowser.openBrowserAsync(
                  `https://mempool.space/signet/tx/${txBuilderResult.txDetails.txid}`
                )
              }
            />
            <SSButton
              variant="secondary"
              label={i18n.t('messageConfirmation.backToAccountHome')}
              onPress={() => handleBackToHome()}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
