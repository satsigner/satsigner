import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress } from '@/utils/format'

export default function MessageConfirmation() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const getCurrentAccount = useAccountsStore((state) => state.getCurrentAccount)

  const account = getCurrentAccount(id!)!

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
              <SSText>
                {formatAddress(
                  'e86acff74b79424c67eb3df54c3a525b60e2b0e3bd8f3e661df2c7ef8ea66174'
                )}
              </SSText>
            </SSVStack>
          </SSVStack>
          <SSVStack>
            <SSButton
              variant="outline"
              label={i18n.t('messageConfirmation.copyTxMessageId')}
              onPress={() =>
                Clipboard.setStringAsync(
                  'e3b71e8056ceb986ad0172205bef03d6b4d091bdc7bfc3cc25fbb1d18608e485'
                )
              }
            />
            <SSButton
              variant="outline"
              label={i18n.t('messageConfirmation.trackOnChain')}
              onPress={() =>
                WebBrowser.openBrowserAsync(
                  'https://mempool.space/signet/tx/e86acff74b79424c67eb3df54c3a525b60e2b0e3bd8f3e661df2c7ef8ea66174'
                )
              }
            />
            <SSButton
              variant="secondary"
              label={i18n.t('messageConfirmation.backToAccountHome')}
              onPress={() => router.navigate(`/account/${id}`)}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
