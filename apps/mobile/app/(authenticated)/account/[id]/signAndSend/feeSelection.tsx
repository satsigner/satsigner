import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'

import SSButton from '@/components/SSButton'
import SSSlider from '@/components/SSSlider'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'

export default function FeeSelection() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const getCurrentAccount = useAccountsStore((state) => state.getCurrentAccount)

  const account = getCurrentAccount(id)!

  const [feeSelected, setFeeSelected] = useState(1)

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <SSMainLayout>
        <SSVStack justifyBetween>
          <SSHStack gap="lg" style={{ justifyContent: 'center' }}>
            <SSVStack gap="none">
              <SSText>1 sat/vB</SSText>
              <SSText color="muted" size="xs" center>
                Minimum {'\n'}Fee
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText>19/300 MB</SSText>
              <SSText color="muted" size="xs" center>
                Mempool {'\n'}Size
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText>1 sat/vB</SSText>
              <SSText color="muted" size="xs" center>
                TXs in {'\n'}Mempool
              </SSText>
            </SSVStack>
          </SSHStack>
          <SSText color="muted">-- Fee Rate Chart -- </SSText>
          <SSVStack>
            <SSVStack itemsCenter>
              <SSHStack
                style={{
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  width: '100%'
                }}
              >
                <SSVStack gap="none">
                  <SSText size="md" weight="medium">
                    {formatNumber(1503)} sats
                  </SSText>
                  <SSText size="xs" color="muted">
                    0.44 USD
                  </SSText>
                </SSVStack>
                <SSText size="md">~ 4 blocks</SSText>
                <SSText size="md">7.00 sats/vB</SSText>
              </SSHStack>
              <SSSlider
                min={100}
                max={1000}
                value={feeSelected}
                step={100}
                onValueChange={(value) => setFeeSelected(value)}
                style={{ width: '100%' }}
              />
            </SSVStack>
            <SSButton
              variant="secondary"
              label={i18n.t('feeSelection.previewTxMessage')}
              onPress={() =>
                router.navigate(`/account/${id}/signAndSend/previewMessage`)
              }
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
