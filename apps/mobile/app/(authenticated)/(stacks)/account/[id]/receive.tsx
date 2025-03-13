import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import useGetWalletAddress from '@/hooks/useGetWalletAddress'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

export default function Receive() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === id)
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
        setAddressPath(`${account.derivationPath}/0/${result.index}`)
    }

    callGetWalletAddress()
  }, [getWalletAddress, account?.derivationPath]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!account) return <Redirect href="/" />

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack itemsCenter gap="xs">
          <SSVStack gap="none" itemsCenter>
            <SSText color="muted" uppercase>
              {t('receive.address')} #
            </SSText>
            <SSText size="3xl">{addressNumber}</SSText>
          </SSVStack>
          <SSVStack gap="none" itemsCenter>
            <SSHStack gap="sm">
              <SSText color="muted" uppercase>
                {t('receive.path')}
              </SSText>
              <SSText>{addressPath}</SSText>
            </SSHStack>
            <SSText>{t('receive.neverUsed')}</SSText>
          </SSVStack>
          {addressQR && <SSQRCode value={addressQR} />}
          <SSVStack gap="none" itemsCenter>
            <SSText color="muted" uppercase>
              {t('receive.address')}
            </SSText>
            <SSClipboardCopy text={address} withPopup={false}>
              <SSText size="sm">{address}</SSText>
            </SSClipboardCopy>
          </SSVStack>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('receive.customAmount')} />
              <SSTextInput
                keyboardType="numeric"
                placeholder={t('app.notImplemented')}
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('receive.label')} />
              <SSTextInput placeholder={t('app.notImplemented')} />
            </SSFormLayout.Item>
          </SSFormLayout>
          <SSVStack widthFull>
            <SSButton
              label={t('receive.generateAnother')}
              variant="secondary"
              disabled
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => router.back()}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
