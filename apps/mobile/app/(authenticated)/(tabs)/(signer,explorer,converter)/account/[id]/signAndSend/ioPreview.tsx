import type BottomSheet from '@gorhom/bottom-sheet'
import { useIsFocused } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  type LayoutChangeEvent,
  TouchableOpacity,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import { SSIconChevronLeft, SSIconScan } from '@/components/icons'
import SSBottomSheet from '@/components/SSBottomSheet'
import SSButton from '@/components/SSButton'
import SSCurrentTransactionChart from '@/components/SSCurrentTransactionChart'
import SSFeeInput from '@/components/SSFeeInput'
import SSFeeRateChart, {
  type SSFeeRateChartProps
} from '@/components/SSFeeRateChart'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSMultipleSankeyDiagram from '@/components/SSMultipleSankeyDiagram'
import SSNumberGhostInput from '@/components/SSNumberGhostInput'
import SSRadioButton from '@/components/SSRadioButton'
import SSSlider from '@/components/SSSlider'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { DUST_LIMIT, SATS_PER_BITCOIN } from '@/constants/btc'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Layout } from '@/styles'
import { type MempoolStatistics } from '@/types/models/Blockchain'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { bip21decode, isBip21, isBitcoinAddress } from '@/utils/bitcoin'
import { formatNumber } from '@/utils/format'
import { time } from '@/utils/time'
import { estimateTransactionSize } from '@/utils/transaction'

// Maximum number of days without syncing the wallet before we show a warning
const MAX_DAYS_WITHOUT_SYNCING = 3

export default function IOPreview() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const [permission, requestPermission] = useCameraPermissions()
  const isFocused = useIsFocused()

  const account = useAccountsStore(
    (state) => state.accounts.find((account) => account.id === id)!
  )
  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)
  const [
    inputs,
    outputs,
    getInputs,
    feeRate,
    addOutput,
    updateOutput,
    removeOutput,
    setFeeRate,
    setFee
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.inputs,
      state.outputs,
      state.getInputs,
      state.feeRate,
      state.addOutput,
      state.updateOutput,
      state.removeOutput,
      state.setFeeRate,
      state.setFee
    ])
  )

  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool[account?.network || 'bitcoin']
  )
  const mempoolOracle = useMemo(
    () => new MempoolOracle(mempoolUrl),
    [mempoolUrl]
  )

  const wallet = useGetAccountWallet(id!)
  const [changeAddress, setChangeAddress] = useState('')
  const [shouldRemoveChange, setShouldRemoveChange] = useState(true)

  useEffect(() => {
    if (!account || !wallet) return
    ;(async () => {
      const outputAddresses: Record<string, boolean> = {}
      account.transactions.forEach((tx) => {
        tx.vout.forEach((output) => {
          outputAddresses[output.address] = true
        })
      })

      for (let i = 0; true; i += 1) {
        const addressObj = await wallet.getInternalAddress(i)
        const address = await addressObj.address.asString()
        if (outputAddresses[address] === true) continue
        setChangeAddress(address)
        return
      }
    })()
  }, [account, wallet])

  // this removes the change address if the user goes back to the IO preview.
  // we add the change address as an output before moving to the next step.
  useEffect(() => {
    if (!changeAddress || !shouldRemoveChange) return
    for (const output of outputs) {
      if (output.to === changeAddress) {
        removeOutput(output.localId)
        return
      }
    }
  }, [outputs, changeAddress, shouldRemoveChange, removeOutput])

  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  type AutoSelectUtxosAlgorithms = 'user' | 'privacy' | 'efficiency'
  const [selectedAutoSelectUtxos, setSelectedAutoSelectUtxos] =
    useState<AutoSelectUtxosAlgorithms>('user')

  const [loadHistory, setLoadHistory] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [topGradientHeight, setTopGradientHeight] = useState(0)

  const [localFeeRate, setLocalFeeRate] = useState(1)

  const addOutputBottomSheetRef = useRef<BottomSheet>(null)
  const optionsBottomSheetRef = useRef<BottomSheet>(null)
  const changeFeeBottomSheetRef = useRef<BottomSheet>(null)

  const utxosValue = (utxos: Utxo[]): number =>
    utxos.reduce((acc, utxo) => acc + utxo.value, 0)

  const utxosTotalValue = useMemo(
    () => utxosValue(account.utxos),
    [account.utxos]
  )
  const utxosSelectedValue = utxosValue(getInputs())

  // const outputsValue = (outputs: Output[]): number =>
  //   outputs.reduce((acc, output) => acc + output.amount, 0)

  // const outputsTotalAmount = useMemo(() => outputsValue(outputs), [outputs])

  const [currentOutputLocalId, setCurrentOutputLocalId] = useState<string>()
  const [currentOutputNumber, setCurrentOutputNumber] = useState(1)
  const [outputTo, setOutputTo] = useState('')
  const [outputAmount, setOutputAmount] = useState(DUST_LIMIT)
  const [outputLabel, setOutputLabel] = useState('')

  const remainingSats = useMemo(
    () =>
      utxosSelectedValue -
      outputs.reduce((acc, output) => acc + output.amount, 0),
    [utxosSelectedValue, outputs]
  )
  const transactionSize = useMemo(
    () => estimateTransactionSize(inputs.size, outputs.length + 1),
    [inputs.size, outputs.length]
  )

  const [selectedPeriod] = useState<SSFeeRateChartProps['timeRange']>('2hours')

  const { data: mempoolStatistics } = useQuery<MempoolStatistics[]>({
    queryKey: ['statistics', selectedPeriod],
    queryFn: () =>
      mempoolOracle.getMempoolStatistics(
        selectedPeriod === '2hours'
          ? '2h'
          : selectedPeriod === 'day'
            ? '24h'
            : '1w'
      ),
    enabled: isFocused,
    staleTime: time.minutes(5)
  })

  const boxPosition = new Animated.Value(localFeeRate)

  const remainingBalance = useMemo(() => {
    const { vsize } = transactionSize
    const minerFee = Math.round(feeRate * vsize)
    const totalInputValue = utxosSelectedValue
    const totalOutputValue = outputs.reduce(
      (sum, output) => sum + output.amount,
      0
    )
    return totalInputValue - totalOutputValue - minerFee
  }, [feeRate, outputs, transactionSize, utxosSelectedValue])

  // Calculate outputs for chart including remaining balance
  const singleTxOutputs = useMemo(() => {
    const chartOutputs: Output[] = [...outputs]

    if (remainingBalance > DUST_LIMIT) {
      chartOutputs.push({
        localId: 'remainingBalance', // WARN: do not chnage it!
        amount: remainingBalance,
        label: '',
        to: changeAddress
      })
    }

    return chartOutputs
  }, [outputs, remainingBalance, changeAddress])

  useEffect(() => {
    if (remainingSats < 0) {
      toast.error(t('transaction.error.insufficientInputs'))
    }
  }, [remainingSats])

  useEffect(() => {
    if (feeRate === 0) {
      setFeeRate(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setFee(localFeeRate * transactionSize.vsize)
  }, [localFeeRate, transactionSize, setFee])

  function handleQRCodeScanned(address: string | undefined) {
    if (!address) return

    if (isBitcoinAddress(address)) {
      setOutputTo(address)
    } else if (isBip21(address)) {
      const decodedData = bip21decode(address)
      if (!decodedData || typeof decodedData === 'string') {
        toast.error(t('transaction.error.address.invalid'))
        setCameraModalVisible(false)
        return
      }

      setOutputTo(decodedData.address)
      if (decodedData.options.amount) {
        const normalizedAmount = decodedData.options.amount * SATS_PER_BITCOIN
        if (normalizedAmount > remainingSats) {
          toast.warning(t('transaction.error.bip21.insufficientSats'))
        } else {
          setOutputAmount(normalizedAmount)
        }
      }

      if (decodedData.options.label) setOutputLabel(decodedData.options.label)
    } else {
      toast.error(t('transaction.error.address.invalid'))
    }

    setCameraModalVisible(false)
  }

  function handleOnPressAddOutput() {
    resetLocalOutput()
    addOutputBottomSheetRef.current?.expand()
  }

  function handleAddOutput() {
    const outputIndex = outputs.findIndex(
      (output) => output.localId === currentOutputLocalId
    )

    const output = { to: outputTo, amount: outputAmount, label: outputLabel }

    if (outputIndex === -1) addOutput(output)
    else updateOutput(outputs[outputIndex].localId, output)

    addOutputBottomSheetRef.current?.close()
    resetLocalOutput()
  }

  function handleRemoveOutput() {
    if (!currentOutputLocalId) return
    removeOutput(currentOutputLocalId)
    addOutputBottomSheetRef.current?.close()
    resetLocalOutput()
  }

  function resetLocalOutput() {
    setCurrentOutputLocalId(undefined)
    setCurrentOutputNumber(outputs.length + 1)
    setOutputTo('')
    setOutputAmount(DUST_LIMIT)
    setOutputLabel('')
  }

  function handleSetFeeRate() {
    setFeeRate(localFeeRate)
    changeFeeBottomSheetRef.current?.close()
  }

  function handleOnPressOutput(localId?: string) {
    setCurrentOutputLocalId(localId)

    if (localId === 'current-minerFee') {
      changeFeeBottomSheetRef.current?.expand()
      return
    } else if (localId === 'remainingBalance') {
      addOutputBottomSheetRef.current?.expand()
      return
    }

    const outputIndex = outputs.findIndex(
      (output) => output.localId === localId
    )
    if (outputIndex === -1) return

    setOutputTo(outputs[outputIndex].to)
    setOutputAmount(outputs[outputIndex].amount)
    setOutputLabel(outputs[outputIndex].label)
    setCurrentOutputNumber(outputIndex + 1)

    addOutputBottomSheetRef.current?.expand()
  }

  function handleOnChangeUtxoSelection(type: AutoSelectUtxosAlgorithms) {
    if (type === selectedAutoSelectUtxos) return

    if (outputs.length === 0 && (type === 'privacy' || type === 'efficiency')) {
      toast.error(
        t('transaction.build.errors.noOutputSelected.autoUtxoSelection')
      )
      return
    }

    setSelectedAutoSelectUtxos(type)

    switch (type) {
      case 'user':
        return router.back()
      case 'privacy':
        //
        break
      case 'efficiency': {
        // const result = selectEfficientUtxos(
        //   account.utxos.map((utxo) => ({
        //     ...utxo,
        //     effectiveValue: utxo.value
        //   })),
        //   outputsTotalAmount,
        //   localFeeRate
        // )
        break
      }
    }
  }

  function handleGoToPreview() {
    // first, we add the change as an output
    setShouldRemoveChange(false)
    addOutput({
      to: changeAddress,
      amount: remainingBalance,
      label: 'Change'
    })

    // Account not synced. Go to warning page to sync it.
    if (account.syncStatus !== 'synced' || account.lastSyncedAt === undefined) {
      router.navigate(`/account/${id}/signAndSend/walletSyncedConfirmation`)
      return
    }

    const lastSync = new Date(account.lastSyncedAt as Date)
    const now = new Date()

    // Discard the time and time-zone information.
    const currentUtc = Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    )
    const lastSyncedUtc = Date.UTC(
      lastSync.getFullYear(),
      lastSync.getMonth(),
      lastSync.getDate()
    )
    const MILISECONDS_PER_DAY = 1000 * 60 * 60 * 24
    const daysSinceLastSync = Math.floor(
      (currentUtc - lastSyncedUtc) / MILISECONDS_PER_DAY
    )

    // Account updated too long ago.
    if (daysSinceLastSync > MAX_DAYS_WITHOUT_SYNCING) {
      router.navigate(`/account/${id}/signAndSend/walletSyncedConfirmation`)
      return
    }

    // Ok, go to the preview page.
    router.navigate(`/account/${id}/signAndSend/previewMessage`)
  }

  const handleTopLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setTopGradientHeight(height)
  }
  const handleLoadHistory = () => {
    setLoadHistory(!loadHistory)
  }
  // if (!nodes.length || !links.length) return <Redirect href="/" />

  return (
    <View
      style={{
        flex: 1,
        position: 'relative'
      }}
    >
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
          zIndex: 10,
          pointerEvents: 'none'
        }}
        onLayout={handleTopLayout}
        locations={[0.19, 0.566, 0.77, 1]}
        colors={['#131313FF', '#13131385', '#13131368', '#13131300']}
      >
        <SSVStack
          itemsCenter
          gap="sm"
          style={{
            flex: 1
          }}
        >
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
      </LinearGradient>
      <LinearGradient
        style={{
          width: '100%',
          position: 'absolute',
          paddingHorizontal: Layout.mainContainer.paddingHorizontal,
          paddingTop: Layout.mainContainer.paddingTop,
          zIndex: 10,
          pointerEvents: 'none',
          opacity: 0.7,
          height: topGradientHeight
        }}
        locations={[0, 0.56, 0.77, 1]}
        colors={['#131313FF', '#13131385', '#13131368', '#13131300']}
      />
      {inputs.size > 0 ? (
        <View style={{ position: 'absolute' }}>
          {loadHistory ? (
            <SSMultipleSankeyDiagram
              onPressOutput={handleOnPressOutput}
              currentOutputLocalId={currentOutputLocalId}
              inputs={inputs}
              outputs={singleTxOutputs}
              feeRate={feeRate}
            />
          ) : (
            <SSCurrentTransactionChart
              inputs={inputs}
              outputs={singleTxOutputs}
              feeRate={feeRate}
              onPressOutput={handleOnPressOutput}
              currentOutputLocalId={currentOutputLocalId}
            />
          )}
        </View>
      ) : null}

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
        colors={['#13131300', '#1313134B', '#131313A6', '#131313F5']}
      >
        <SSVStack
          style={{
            width: '100%',
            paddingHorizontal: Layout.mainContainer.paddingHorizontal
          }}
        >
          <SSVStack>
            {!loadHistory && (
              <TouchableOpacity
                style={{
                  marginBottom: Layout.vStack.gap.sm
                }}
                onPress={handleLoadHistory}
              >
                <SSHStack gap="xs">
                  <SSHStack gap="xxs">
                    <SSIconChevronLeft
                      height={6}
                      width={3}
                      stroke={Colors.gray[300]}
                    />
                    <SSIconChevronLeft
                      height={6}
                      width={3}
                      stroke={Colors.gray[300]}
                    />
                  </SSHStack>
                  <SSText style={{ color: Colors.gray[300], fontSize: 12 }}>
                    {t('transaction.loadHistory').toUpperCase()}
                  </SSText>
                </SSHStack>
              </TouchableOpacity>
            )}
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
                variant="outline"
                label={t('transaction.build.add.output.title')}
                style={{ flex: 1 }}
                onPress={handleOnPressAddOutput}
              />
            </SSHStack>
            <SSHStack>
              <SSButton
                variant="outline"
                label={t('transaction.build.options.title')}
                style={{ flex: 1 }}
                onPress={() => optionsBottomSheetRef.current?.expand()}
              />
              <SSButton
                variant="outline"
                label={t('transaction.build.update.fee.title')}
                style={{ flex: 1 }}
                onPress={() => changeFeeBottomSheetRef.current?.expand()}
              />
            </SSHStack>
          </SSVStack>
          <SSButton
            variant="secondary"
            label={t('sign.transaction')}
            disabled={outputs.length === 0}
            onPress={handleGoToPreview}
          />
        </SSVStack>
      </LinearGradient>
      <SSBottomSheet
        ref={addOutputBottomSheetRef}
        title={t('transaction.build.add.output.number', {
          number: currentOutputNumber
        })}
      >
        <SSVStack style={{ paddingBottom: 24 }}>
          <SSNumberGhostInput
            min={DUST_LIMIT}
            max={remainingSats}
            suffix={t('bitcoin.sats')}
            value={String(outputAmount)}
            onChangeText={(text) => setOutputAmount(Number(text))}
          />
          <SSVStack gap="none">
            <SSHStack justifyBetween>
              <SSHStack
                gap="xs"
                style={{ alignItems: 'baseline', justifyContent: 'center' }}
              >
                <SSText weight="medium">{DUST_LIMIT}</SSText>
                <SSText color="muted" size="sm">
                  {t('bitcoin.sats')}
                </SSText>
              </SSHStack>
              <SSHStack
                gap="xs"
                style={{ alignItems: 'baseline', justifyContent: 'center' }}
              >
                <SSText weight="medium">{formatNumber(remainingSats)}</SSText>
                <SSText color="muted" size="sm">
                  {t('bitcoin.sats')}
                </SSText>
              </SSHStack>
            </SSHStack>
            <SSSlider
              min={DUST_LIMIT}
              max={Math.max(remainingSats, DUST_LIMIT)}
              value={Math.min(
                outputAmount,
                Math.max(remainingSats, DUST_LIMIT)
              )}
              step={100}
              onValueChange={(value) => setOutputAmount(value)}
            />
          </SSVStack>
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
          <SSTextInput
            placeholder={t('transaction.build.add.label.title')}
            align="left"
            value={outputLabel}
            onChangeText={(text) => setOutputLabel(text)}
          />
          <SSHStack>
            <SSButton
              label={t('transaction.build.remove.output.title')}
              variant="danger"
              style={{ flex: 1 }}
              onPress={handleRemoveOutput}
            />
            <SSButton
              label={t('transaction.build.save.output.title')}
              variant="secondary"
              style={{ flex: 1 }}
              disabled={!outputTo || !outputAmount || !outputLabel}
              onPress={handleAddOutput}
            />
          </SSHStack>
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => addOutputBottomSheetRef.current?.close()}
          />
        </SSVStack>
      </SSBottomSheet>
      <SSBottomSheet
        ref={optionsBottomSheetRef}
        title={t('transaction.build.options.title')}
      >
        <SSVStack>
          <SSVStack gap="xs">
            <SSText color="muted" uppercase>
              {t('transaction.build.options.autoSelect.utxos.label')}
            </SSText>
            <SSHStack justifyBetween>
              <SSRadioButton
                variant="outline"
                label={t(
                  'transaction.build.options.autoSelect.utxos.user.title'
                )}
                selected={selectedAutoSelectUtxos === 'user'}
                style={{ width: '33%', flex: 1 }}
                onPress={() => handleOnChangeUtxoSelection('user')}
              />
              <SSRadioButton
                variant="outline"
                label={t(
                  'transaction.build.options.autoSelect.utxos.privacy.title'
                )}
                selected={selectedAutoSelectUtxos === 'privacy'}
                style={{ width: '33%', flex: 1 }}
                onPress={() => handleOnChangeUtxoSelection('privacy')}
              />
              <SSRadioButton
                variant="outline"
                label={t(
                  'transaction.build.options.autoSelect.utxos.efficiency.title'
                )}
                selected={selectedAutoSelectUtxos === 'efficiency'}
                style={{ width: '33%', flex: 1 }}
                onPress={() => handleOnChangeUtxoSelection('efficiency')}
              />
            </SSHStack>
            <SSText color="muted">
              {t(
                `transaction.build.options.autoSelect.utxos.${selectedAutoSelectUtxos}.description`
              )}
            </SSText>
          </SSVStack>
          <SSVStack>
            <SSHStack>
              <SSButton
                label={t('transaction.build.options.feeControl')}
                variant="outline"
                onPress={() =>
                  router.navigate(`/account/${id}/signAndSend/feeManagement`)
                }
                style={{ width: '45%', flexGrow: 1 }}
              />
              <SSButton
                label={t('transaction.build.options.timelock')}
                variant="outline"
                onPress={() =>
                  router.navigate(`/account/${id}/signAndSend/timeLock`)
                }
                style={{ width: '45%', flexGrow: 1 }}
              />
            </SSHStack>
            <SSButton
              label={t('transaction.build.options.importOutputs.title')}
              variant="outline"
              onPress={() =>
                router.navigate(`/account/${id}/signAndSend/importOutputs`)
              }
            />
          </SSVStack>
        </SSVStack>
      </SSBottomSheet>
      <SSBottomSheet
        ref={changeFeeBottomSheetRef}
        title={t('transaction.build.update.fee.title')}
      >
        <SSVStack style={{ paddingBottom: 24 }}>
          <SSFeeRateChart
            mempoolStatistics={mempoolStatistics}
            timeRange="2hours"
            boxPosition={boxPosition}
          />
          <SSFeeInput
            value={localFeeRate}
            onValueChange={setLocalFeeRate}
            vbytes={transactionSize.vsize}
            max={40}
            estimatedBlock={Math.trunc(40 / localFeeRate)}
          />
          <SSButton
            label={t('transaction.build.set.fee')}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={handleSetFeeRate}
          />
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => changeFeeBottomSheetRef.current?.close()}
          />
        </SSVStack>
      </SSBottomSheet>
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
    </View>
  )
}
