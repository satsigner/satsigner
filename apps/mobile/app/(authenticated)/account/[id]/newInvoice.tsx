import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import useGetWalletAddress from '@/hooks/useGetWalletAddress'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

export default function NewInvoice() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.name === id)
  )
  const getWalletAddress = useGetWalletAddress(account!)

  const [address, setAddress] = useState('')
  const [addressNumber, setAddressNumber] = useState(0)
  const [addressQR, setAddressQR] = useState('')
  const [addressPath, setAddressPath] = useState('')

  useEffect(() => {
    async function callGetWalletAddress() {
      const result = await getWalletAddress()

      if (!result) return

      const addressResult = await result.address.asString()
      setAddress(addressResult)

      setAddressNumber(result.index)

      const addressQRResult = await result.address.toQrUri()
      setAddressQR(addressQRResult)

      if (account?.derivationPath)
        setAddressPath(`${account.derivationPath}/0/${addressNumber}`)
    }

    callGetWalletAddress()
  }, [getWalletAddress, account?.derivationPath]) // eslint-disable-line react-hooks/exhaustive-deps

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
            <SSText size="3xl">{addressNumber}</SSText>
          </SSVStack>
          <SSVStack gap="none" itemsCenter>
            <SSHStack gap="sm">
              <SSText color="muted" uppercase>
                {i18n.t('newInvoice.path')}
              </SSText>
              <SSText>{addressPath}</SSText>
            </SSHStack>
            <SSText>🟢 Never used</SSText>
          </SSVStack>
          {addressQR && <SSQRCode value={addressQR} />}
          <SSVStack gap="none" itemsCenter>
            <SSText color="muted" uppercase>
              {i18n.t('newInvoice.address')}
            </SSText>
            <SSText size="sm">{address}</SSText>
          </SSVStack>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={i18n.t('newInvoice.customAmount')} />
              <SSTextInput
                keyboardType="numeric"
                placeholder="not yet implemented"
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={i18n.t('newInvoice.memo')} />
              <SSTextInput placeholder="not yet implemented" />
            </SSFormLayout.Item>
          </SSFormLayout>
          <SSVStack widthFull>
            <SSButton
              label={i18n.t('newInvoice.generateAnotherInvoice')}
              variant="secondary"
              disabled
            />
            <SSButton
              label={i18n.t('common.cancel')}
              variant="ghost"
              onPress={() => router.back()}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
