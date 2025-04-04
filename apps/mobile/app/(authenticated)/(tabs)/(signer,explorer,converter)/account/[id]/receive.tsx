import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { toast } from 'sonner-native'

import { getLastUnusedAddressFromWallet } from '@/api/bdk'
import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSButton from '@/components/SSButton'
import SSNumberInput from '@/components/SSNumberInput'
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
  const wallet = useWalletsStore((state) => state.wallets[id!])

  const [localAddress, setLocalAddress] = useState<string>()
  const [localAddressNumber, setLocalAddressNumber] = useState<number>()
  const [localAddressQR, setLocalAddressQR] = useState<string>()
  const [localFinalAddressQR, setLocalFinalAddressQR] = useState<string>()
  const [localAddressPath, setLocalAddressPath] = useState<string>()
  const [localCustomAmount, setLocalCustomAmount] = useState<string>()
  const [localLabel, setLocalLabel] = useState<string>()

  useEffect(() => {
    if (!localAddressQR) return

    const queryParts: string[] = []

    if (
      localCustomAmount &&
      Number(localCustomAmount) > 0 &&
      Number(localCustomAmount) <= 21_000_000
    )
      queryParts.push(`amount=${encodeURIComponent(localCustomAmount)}`)
    if (localLabel) queryParts.push(`label=${encodeURIComponent(localLabel)}`)

    const finalUri =
      queryParts.length > 0
        ? `${localAddressQR}?${queryParts.join('&')}`
        : localAddressQR

    setLocalFinalAddressQR(finalUri)
  }, [localCustomAmount, localLabel]) // eslint-disable-line react-hooks/exhaustive-deps

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
      setLocalFinalAddressQR(qrUri)
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
          headerTitle: () => <SSText uppercase>{account.name}</SSText>,
          headerRight: undefined
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
          {localFinalAddressQR && <SSQRCode value={localFinalAddressQR} />}
          <SSVStack gap="xs" itemsCenter style={{ marginVertical: 10 }}>
            <SSText color="muted" uppercase weight="bold">
              {t('receive.address')}
            </SSText>
            {localAddress && (
              <SSAddressDisplay address={localAddress} copyToClipboard/>
            )}
          </SSVStack>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('receive.customAmount')} />
              <SSNumberInput
                min={0.00000001}
                max={21_000_000}
                placeholder="BTC"
                align="center"
                keyboardType="numeric"
                onChangeText={(text) => setLocalCustomAmount(text)}
                allowDecimal
                allowValidEmpty
                alwaysTriggerOnChange
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('receive.label')} />
              <SSTextInput onChangeText={(text) => setLocalLabel(text)} />
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
