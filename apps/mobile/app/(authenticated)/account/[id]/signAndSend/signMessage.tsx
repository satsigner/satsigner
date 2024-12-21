import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress } from '@/utils/format'

export default function SignMessage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const getCurrentAccount = useAccountsStore((state) => state.getCurrentAccount)

  const account = getCurrentAccount(id)!

  // const [signed, setSigned] = useState(true)
  const signed = useState(true)[0]

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <SSMainLayout>
        <SSVStack itemsCenter justifyBetween>
          <SSVStack itemsCenter>
            <SSText size="lg" weight="bold">
              Signing Message
            </SSText>
            <SSText color="muted" size="sm" weight="bold" uppercase>
              Message Id
            </SSText>
            <SSText size="lg">
              {formatAddress('tb1qx8eht2j024frfzhmuc4cfu3849uegu8a87t97t')}
            </SSText>
          </SSVStack>
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
                Message
              </SSText>
            </SSVStack>
          </SSVStack>
          <SSButton
            variant="secondary"
            label={i18n.t('signMessage.broadcastTxMessage')}
            disabled={!signed}
            onPress={() =>
              router.navigate(`/account/${id}/signAndSend/messageConfirmation`)
            }
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
