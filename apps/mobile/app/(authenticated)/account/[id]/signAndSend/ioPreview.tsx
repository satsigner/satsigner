import { CameraView, useCameraPermissions } from 'expo-camera/next'
import { Image } from 'expo-image'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import ScanIcon from '@/components/icons/ScanIcon'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSSlider from '@/components/SSSlider'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors } from '@/styles'
import type { Utxo } from '@/types/models/Utxo'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress, formatNumber } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'

export default function IOPreview() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const [permission, requestPermission] = useCameraPermissions()

  const getCurrentAccount = useAccountsStore((state) => state.getCurrentAccount)
  const [inputs, outputs, getInputs, addOutput] = useTransactionBuilderStore(
    useShallow((state) => [
      state.inputs,
      state.outputs,
      state.getInputs,
      state.addOutput
    ])
  )
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const account = getCurrentAccount(id)! // Make use of non-null assertion operator for now

  const [addOutputModalVisible, setAddOutputModalVisible] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [outputAddress, setOutputAddress] = useState('')

  const utxosValue = (utxos: Utxo[]): number =>
    utxos.reduce((acc, utxo) => acc + utxo.value, 0)

  const utxosTotalValue = useMemo(
    () => utxosValue(account.utxos),
    [account.utxos]
  )
  const utxosSelectedValue = utxosValue(getInputs())

  const [outputTo, setOutputTo] = useState('')
  const [outputAmount, setOutputAmount] = useState(1)
  const [outputLabel, setOutputLabel] = useState('')

  function handleQRCodeScanned(address: string | undefined) {
    if (!address) return
    setOutputTo(address)
    setCameraModalVisible(false)
  }

  function handleAddOutputAndClose() {
    addOutput({ to: outputAddress, amount: outputAmount, label: outputLabel })
    setAddOutputModalVisible(false)
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      {/* Keep "Selected spendable outputs" and the other buttons? */}
      <SSMainLayout>
        <SSVStack>
          <SSHStack justifyBetween>
            <SSText color="muted">Group</SSText>
            <SSText size="md">
              {i18n.t('signAndSend.selectSpendableOutputs')}
            </SSText>
            <SSIconButton
              onPress={() =>
                router.navigate(`/account/${id}/signAndSend/selectUtxoBubbles`)
              }
            >
              <Image
                style={{ width: 24, height: 22 }}
                source={require('@/assets/icons/bubbles.svg')}
              />
            </SSIconButton>
          </SSHStack>
          <SSVStack itemsCenter gap="sm">
            <SSVStack itemsCenter gap="xs">
              <SSText>
                {inputs.size} {i18n.t('common.of').toLowerCase()}{' '}
                {account.utxos.length} {i18n.t('common.selected').toLowerCase()}
              </SSText>
              <SSHStack gap="xs">
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {i18n.t('common.total')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(utxosTotalValue)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {i18n.t('bitcoin.sats').toLowerCase()}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(satsToFiat(utxosTotalValue), 2)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
            <SSVStack itemsCenter gap="none">
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText
                  size="7xl"
                  color="white"
                  weight="ultralight"
                  style={{ lineHeight: 62 }}
                >
                  {formatNumber(utxosSelectedValue)}
                </SSText>
                <SSText size="xl" color="muted">
                  {i18n.t('bitcoin.sats').toLowerCase()}
                </SSText>
              </SSHStack>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText size="md" color="muted">
                  {formatNumber(satsToFiat(utxosSelectedValue), 2)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
          </SSVStack>
        </SSVStack>
        <SSHStack>
          <SSVStack>
            <SSText>Inputs:</SSText>
            {[...inputs.values()].map((utxo) => (
              <SSVStack gap="none" key={getUtxoOutpoint(utxo)}>
                <SSText>{formatNumber(utxo.value)} sats</SSText>
                <SSHStack gap="xs">
                  <SSText color="muted" size="xs">
                    from
                  </SSText>
                  <SSText size="xs">
                    {formatAddress(utxo.addressTo || '')}
                  </SSText>
                </SSHStack>
              </SSVStack>
            ))}
          </SSVStack>
          <SSVStack gap="none">
            <SSText color="muted">Bytes:</SSText>
            <SSText>...</SSText>
          </SSVStack>
          <SSVStack>
            <SSText>Outputs:</SSText>
            {[...outputs].map((output) => (
              <SSVStack gap="none" key={output.localId}>
                <SSText>{formatNumber(output.amount)} sats</SSText>
                <SSHStack gap="xs">
                  <SSText color="muted" size="xs">
                    from
                  </SSText>
                  <SSText size="xs">{formatAddress(output.to)}</SSText>
                </SSHStack>
                <SSText color="muted" size="xxs">
                  "{output.label}"
                </SSText>
              </SSVStack>
            ))}
          </SSVStack>
        </SSHStack>
        <SSVStack>
          <SSTextInput
            variant="outline"
            size="small"
            align="left"
            placeholder={i18n.t('ioPreview.typeMemo')}
          />
          <SSHStack>
            <SSButton
              variant="outline"
              label={i18n.t('ioPreview.addInput')}
              style={{ flex: 1 }}
              onPress={() =>
                router.navigate(`/account/${id}/signAndSend/selectUtxoList`)
              }
            />
            <SSButton
              variant={outputs.length > 0 ? 'outline' : 'secondary'}
              label={i18n.t('ioPreview.addOutput')}
              style={{ flex: 1 }}
              onPress={() => setAddOutputModalVisible(true)}
            />
          </SSHStack>
          <SSButton
            variant="secondary"
            label={i18n.t('ioPreview.setMessageFee')}
            onPress={() =>
              router.navigate(`/account/${id}/signAndSend/feeSelection`)
            }
          />
        </SSVStack>
      </SSMainLayout>
      <SSModal
        visible={addOutputModalVisible}
        fullOpacity
        onClose={() => setAddOutputModalVisible(false)}
      >
        <SSText color="muted" uppercase>
          Add Output
        </SSText>
        <SSTextInput
          value={outputTo}
          placeholder="Address"
          align="left"
          actionRight={
            <SSIconButton onPress={() => setCameraModalVisible(true)}>
              <ScanIcon />
            </SSIconButton>
          }
          onChangeText={(text) => setOutputAddress(text)}
        />
        <SSVStack style={{ width: '100%' }}>
          <SSHStack style={{ width: '100%' }}>
            <SSButton label="Paynyms" style={{ flex: 1 }} />
            <SSButton label="Public Keys" style={{ flex: 1 }} />
          </SSHStack>
          <SSHStack style={{ width: '100%' }}>
            <SSButton label="Nostr Nip05" style={{ flex: 1 }} />
            <SSButton label="OP_RETURN" style={{ flex: 1 }} />
          </SSHStack>
        </SSVStack>
        <SSVStack gap="none" itemsCenter style={{ width: '100%' }}>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSText size="2xl" weight="medium">
              {formatNumber(outputAmount)}
            </SSText>
            <SSText color="muted" size="lg">
              sats
            </SSText>
          </SSHStack>
          <SSText style={{ color: Colors.gray[600] }}>
            max {formatNumber(utxosSelectedValue)} sats
          </SSText>
          <SSSlider
            min={1}
            max={utxosSelectedValue}
            value={outputAmount}
            step={100}
            style={{ width: 340 }}
            onValueChange={(value) => setOutputAmount(value)}
          />
          <SSVStack style={{ width: '100%' }}>
            <SSTextInput
              placeholder="Add note"
              align="left"
              onChangeText={(text) => setOutputLabel(text)}
            />
            <SSButton
              label="Continue"
              variant="secondary"
              disabled={!outputTo || !outputAmount || !outputLabel}
              onPress={() => handleAddOutputAndClose()}
            />
          </SSVStack>
        </SSVStack>
        <SSModal
          visible={cameraModalVisible}
          fullOpacity
          onClose={() => setCameraModalVisible(false)}
        >
          <SSText color="muted" uppercase>
            Read QRCode
          </SSText>
          <CameraView
            onBarcodeScanned={(res) => handleQRCodeScanned(res.raw)}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={{ width: 340, height: 340 }}
          />
          {!permission?.granted && (
            <SSButton
              label="Enable Camera Access"
              onPress={requestPermission}
            />
          )}
        </SSModal>
      </SSModal>
    </>
  )
}
