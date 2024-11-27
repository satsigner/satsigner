import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import SSVStack from '@/layouts/SSVStack'

export default function PreviewMessage() {
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
        <SSVStack justifyBetween>
          <SSVStack>
            <SSVStack gap="xxs">
              <SSText color="muted" size="sm" uppercase>
                Message Id
              </SSText>
              <SSText size="lg">
                e3b71e8056ceb986ad0172205bef03d6b4d091bdc7bfc3cc25fbb1d18608e485
              </SSText>
            </SSVStack>
            <SSVStack gap="xxs">
              <SSText color="muted" size="sm" uppercase>
                Contents
              </SSText>
            </SSVStack>
            <SSVStack gap="xxs">
              <SSText color="muted" size="sm" uppercase>
                Full Message
              </SSText>
            </SSVStack>
          </SSVStack>
          <SSButton
            variant="secondary"
            label={i18n.t('previewMessage.signTxMessage')}
            onPress={() =>
              router.navigate(`/account/${id}/signAndSend/signMessage`)
            }
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
