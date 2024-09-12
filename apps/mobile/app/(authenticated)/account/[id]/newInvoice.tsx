import { Stack } from 'expo-router'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'

export default function NewInvoice() {
  const currentAccountName = useAccountStore(
    (state) => state.currentAccount.name
  )

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{currentAccountName}</SSText>
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
              <SSText>m/84'/0'/0'/0/1</SSText>
            </SSHStack>
            <SSText>🟢 Never used</SSText>
          </SSVStack>
          <SSQRCode value="https://satsigner.com" />
          <SSVStack gap="none" itemsCenter>
            <SSText color="muted" uppercase>
              {i18n.t('newInvoice.address')}
            </SSText>
            <SSText size="lg">https://satsigner.com</SSText>
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
              label={i18n.t('newInvoice.generateAnotherInvoice')}
              variant="secondary"
            />
            <SSButton label={i18n.t('common.cancel')} variant="ghost" />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
