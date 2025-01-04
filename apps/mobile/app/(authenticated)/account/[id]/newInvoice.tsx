import { Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useGetAddress } from '@/hooks/useGetAddress'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

export default function NewInvoice() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const { data, refetch } = useGetAddress(id!)
  const [updateAccount] = useAccountsStore(
    useShallow((state) => [state.updateAccount])
  )
  const generateNewAddress = async (): Promise<void> => {
    if (!data.account) {
      throw new Error('Account data is not available.')
    }
    data!.account.usedIndexes.push(data!.account.currentIndex)
    data!.account.currentIndex += 1
    updateAccount(data!.account)
    refetch().then()
  }
  const generatePrevAddress = (): void => {
    if (!data.account) {
      throw new Error('Account data is not available.')
    }
    if (Number(data!.account.currentIndex) - 1 >= 0) {
      data!.account.currentIndex = data!.account.currentIndex - 1
      updateAccount(data!.account)
    }
    refetch().then()
  }
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
              onPress={() => generateNewAddress()}
              label={i18n.t('newInvoice.newAddress')}
              variant="secondary"
            />
            <SSButton
              onPress={() => generatePrevAddress()}
              label={i18n.t('newInvoice.prevAddress')}
              variant="ghost"
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
