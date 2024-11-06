import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import type { AccountSearchParams } from '@/types/navigation/searchParams'

export default function MessageConfirmation() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const getCurrentAccount = useAccountsStore((state) => state.getCurrentAccount)

  const account = getCurrentAccount(id)!

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <SSMainLayout>
        <SSVStack itemsCenter>
          <SSText weight="bold" size="lg">
            {i18n.t('messageConfirmation.messageBroadcasted')}
          </SSText>
          <SSText color="muted" uppercase>
            {i18n.t('messageConfirmation.messageId')}
          </SSText>
        </SSVStack>
        <SSVStack>
          <SSButton
            variant="outline"
            label={i18n.t('messageConfirmation.copyTxMessageId')}
            onPress={() => {}}
          />
          <SSButton
            variant="outline"
            label={i18n.t('messageConfirmation.trackOnChain')}
            onPress={() => {}}
          />
          <SSButton
            variant="secondary"
            label={i18n.t('messageConfirmation.backToAccountHome')}
            onPress={() => {}}
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
