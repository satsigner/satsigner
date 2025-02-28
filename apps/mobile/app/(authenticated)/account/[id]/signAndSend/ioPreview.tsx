import { CameraView, useCameraPermissions } from 'expo-camera/next'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import { SSIconBubbles, SSIconScan } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSSankeyDiagram from '@/components/SSSankeyDiagram'
import SSSlider from '@/components/SSSlider'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useNodesAndLinks } from '@/hooks/useNodesAndLinks'
import { usePreviousTransactions } from '@/hooks/usePreviousTransactions'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Layout } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress, formatNumber } from '@/utils/format'

const DEEP_LEVEL = 3

export default function IOPreview() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const [permission, requestPermission] = useCameraPermissions()

  const account = useAccountsStore(
    (state) => state.accounts.find((account) => account.name === id)!
  )
  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)
  const [inputs, outputs, getInputs, addOutput] = useTransactionBuilderStore(
    useShallow((state) => [
      state.inputs,
      state.outputs,
      state.getInputs,
      state.addOutput
    ])
  )

  const { transactions, loading, error } = usePreviousTransactions(
    inputs,
    DEEP_LEVEL
  )

  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const [addOutputModalVisible, setAddOutputModalVisible] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)

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
    addOutput({ to: outputTo, amount: outputAmount, label: outputLabel })
    setAddOutputModalVisible(false)
  }

  const { allNodes, links } = useNodesAndLinks({
    transactions,
    inputs,
    outputs,
    utxosSelectedValue,
    deepLevel: DEEP_LEVEL
  })

  // Show loading state
  if (loading && inputs.size > 0) {
    return (
      <SSVStack itemsCenter>
        <SSText>Loading transaction details...</SSText>
      </SSVStack>
    )
  }

  // Show error state
  if (error) {
    return (
      <SSVStack itemsCenter>
        <SSText color="muted">
          Error loading transaction details: {error.message}
        </SSText>
      </SSVStack>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />

      <LinearGradient
        style={{
          width: '100%',
          position: 'absolute',
          paddingHorizontal: Layout.mainContainer.paddingHorizontal,
          paddingTop: Layout.mainContainer.paddingTop,
          zIndex: 20
        }}
        locations={[0.185, 0.5554, 0.7713, 1]}
        colors={['#000000F5', '#000000A6', '#0000004B', '#00000000']}
      >
        <SSVStack style={{ flex: 1 }}>
          <SSHStack justifyBetween>
            <SSText color="muted">Group</SSText>
            <SSText size="md">
              {t('transaction.build.select.spendableOutputs')}
            </SSText>
            <SSIconButton
              onPress={() =>
                router.navigate(`/account/${id}/signAndSend/selectUtxoBubbles`)
              }
            >
              <SSIconBubbles height={22} width={24} />
            </SSIconButton>
          </SSHStack>
          <SSVStack itemsCenter gap="sm">
            <SSVStack itemsCenter gap="xs">
              <SSText>
                {inputs.size} {t('common.of').toLowerCase()}{' '}
                {account.utxos.length} {t('common.selected').toLowerCase()}
              </SSText>
              <SSHStack gap="xs">
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {t('common.total')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(utxosTotalValue, 0, useZeroPadding)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {t('bitcoin.sats').toLowerCase()}
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
                  {formatNumber(utxosSelectedValue, 0, useZeroPadding)}
                </SSText>
                <SSText size="xl" color="muted">
                  {t('bitcoin.sats').toLowerCase()}
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
      </LinearGradient>
      <View style={{ position: 'absolute', top: 80 }}>
        {transactions.size > 0 &&
        inputs.size > 0 &&
        allNodes?.length > 0 &&
        links?.length > 0 ? (
          <SSSankeyDiagram
            sankeyNodes={allNodes}
            sankeyLinks={links}
            inputCount={inputs.size}
          />
        ) : null}
      </View>
      <LinearGradient
        locations={[0, 0.1255, 0.2678, 1]}
        style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'center',
          backgroundColor: Colors.transparent,
          paddingBottom: 20
        }}
        colors={['#00000000', '#0000004B', '#000000A6', '#000000F5']}
      >
        <SSVStack
          style={{
            width: '92%'
          }}
        >
          <SSTextInput
            variant="outline"
            size="small"
            align="left"
            placeholder={t('transaction.build.type.label')}
          />
          <SSHStack>
            <SSButton
              variant="outline"
              label={t('transaction.build.add.input.title')}
              style={{ flex: 1 }}
              onPress={() =>
                router.navigate(`/account/${id}/signAndSend/selectUtxoList`)
              }
            />
            <SSButton
              variant={outputs.length > 0 ? 'outline' : 'secondary'}
              label={t('transaction.build.add.output.title')}
              style={{ flex: 1 }}
              onPress={() => setAddOutputModalVisible(true)}
            />
          </SSHStack>
          <SSButton
            variant="secondary"
            label={t('transaction.build.set.fee')}
            onPress={() =>
              router.navigate(`/account/${id}/signAndSend/feeSelection`)
            }
          />
        </SSVStack>
      </LinearGradient>
      <SSModal
        visible={addOutputModalVisible}
        fullOpacity
        onClose={() => setAddOutputModalVisible(false)}
      >
        <SSText color="muted" uppercase>
          {t('transaction.build.add.output.title')}
        </SSText>
        <SSTextInput
          value={outputTo}
          placeholder={t('transaction.address')}
          align="left"
          actionRight={
            <SSIconButton onPress={() => setCameraModalVisible(true)}>
              <SSIconScan />
            </SSIconButton>
          }
          onChangeText={(text) => setOutputTo(text)}
        />
        <SSVStack gap="none" itemsCenter style={{ width: '100%' }}>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSText size="2xl" weight="medium">
              {formatNumber(outputAmount)}
            </SSText>
            <SSText color="muted" size="lg">
              {t('bitcoin.sats')}
            </SSText>
          </SSHStack>
          <SSText style={{ color: Colors.gray[600] }}>
            {t('common.max')} {formatNumber(utxosSelectedValue)}{' '}
            {t('bitcoin.sats')}
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
              placeholder={t('transaction.build.add.label.title')}
              align="left"
              onChangeText={(text) => setOutputLabel(text)}
            />
            <SSButton
              label={t('common.continue')}
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
            {t('camera.scanQRCode')}
          </SSText>
          <CameraView
            onBarcodeScanned={(res) => handleQRCodeScanned(res.raw)}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={{ width: 340, height: 340 }}
          />
          {!permission?.granted && (
            <SSButton
              label={t('camera.enableCameraAccess')}
              onPress={requestPermission}
            />
          )}
        </SSModal>
      </SSModal>
    </GestureHandlerRootView>
  )
}
