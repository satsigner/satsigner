import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { toast } from 'sonner-native'

import { getLastUnusedAddressFromWallet } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

export default function Receive() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const router = useRouter()

  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === id)
  )
  const wallet = useWalletsStore((state) => state.wallets[id])

  const [localAddress, setLocalAddress] = useState<string>()
  const [localAddressNumber, setLocalAddressNumber] = useState<number>()
  const [localAddressQR, setLocalAddressQR] = useState<string>()
  const [localAddressPath, setLocalAddressPath] = useState<string>()

  useEffect(() => {
    async function loadAddress() {
      if (!wallet) {
        toast(t('error.notFound.wallet'))
        return
      }
      const addressInfo = await getLastUnusedAddressFromWallet(wallet)

      const [address, qrUri] = await Promise.all([
        addressInfo.address.asString(),
        addressInfo.address.toQrUri()
      ])
      setLocalAddress(address)
      setLocalAddressNumber(addressInfo.index)
      setLocalAddressQR(qrUri)
      setLocalAddressPath(
        `${account?.keys[0].derivationPath}/0/${addressInfo.index}`
      )
    }

    loadAddress()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
            <SSText size="3xl">{localAddressNumber}</SSText>
          </SSVStack>
          <SSVStack gap="none" itemsCenter>
            <SSHStack gap="sm">
              <SSText color="muted" uppercase>
                {t('receive.path')}
              </SSText>
              <SSText>{localAddressPath}</SSText>
            </SSHStack>
            <SSText>{t('receive.neverUsed')}</SSText>
          </SSVStack>
          {localAddressQR && <SSQRCode value={localAddressQR} />}
          <SSVStack gap="none" itemsCenter>
            <SSText color="muted" uppercase>
              {t('receive.address')}
            </SSText>
            {localAddress && (
              <SSClipboardCopy text={localAddress} withPopup={false}>
                <SSText size="sm">{localAddress}</SSText>
              </SSClipboardCopy>
            )}
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
