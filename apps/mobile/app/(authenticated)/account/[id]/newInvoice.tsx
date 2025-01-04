import { Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useGenerateNewAddress } from '@/hooks/useGenerateNewAddress'
import { useGetAddress } from '@/hooks/useGetAddress'
import { useGetPrevAddress } from '@/hooks/useGetPrevAddress'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { useEffect } from 'react'

export default function NewInvoice() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const { data, refetch } = useGetAddress(id)
  const newAddress = useGenerateNewAddress(id)
  const prevAddress = useGetPrevAddress(id)

  useEffect(() => {
    if (newAddress.isSuccess || prevAddress.isSuccess) {
      refetch()
    }
  }, [newAddress.isSuccess, prevAddress.isSuccess, refetch])

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{id}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack itemsCenter gap="xs">
          <SSVStack gap="none" itemsCenter>
            <SSText color="muted" uppercase>
              {i18n.t('newInvoice.invoice')} #
            </SSText>
            <SSText size="3xl">1</SSText>
          </SSVStack>
          <SSVStack gap="none" itemsCenter>
            <SSHStack gap="sm">
              <SSText color="muted" uppercase>
                {i18n.t('newInvoice.path')}
              </SSText>
              <SSText>{data?.path}</SSText>
            </SSHStack>
            <SSText>{data?.used ? '🔴 Used' : '🟢 Never used'}</SSText>
          </SSVStack>
          <SSQRCode value={data?.address} />
          <SSVStack gap="none" itemsCenter>
            <SSText color="muted" uppercase>
              {i18n.t('newInvoice.address')}
            </SSText>
            <SSText size="md">{data?.address}</SSText>
          </SSVStack>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={i18n.t('newInvoice.customAmount')} />
              <SSTextInput keyboardType="numeric" />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={i18n.t('newInvoice.memo')} />
              <SSTextInput />
            </SSFormLayout.Item>
          </SSFormLayout>
          <SSVStack widthFull>
            <SSButton
              onPress={() => newAddress.mutate()}
              label={i18n.t('newInvoice.newAddress')}
              variant="secondary"
            />
            <SSButton
              onPress={() => prevAddress.mutate()}
              label={i18n.t('newInvoice.prevAddress')}
              variant="ghost"
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
