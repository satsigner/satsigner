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
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import { SSIconChevronLeft } from '@/components/icons'
import SSAmountInput from '@/components/SSAmountInput'
import SSBottomSheet from '@/components/SSBottomSheet'
import SSButton from '@/components/SSButton'
import SSCurrentTransactionChart from '@/components/SSCurrentTransactionChart'
import SSFeeInput from '@/components/SSFeeInput'
import SSFeeRateChart, {
  type SSFeeRateChartProps
} from '@/components/SSFeeRateChart'
import SSModal from '@/components/SSModal'
import SSMultipleSankeyDiagram from '@/components/SSMultipleSankeyDiagram'
import SSRadioButton from '@/components/SSRadioButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { DUST_LIMIT, SATS_PER_BITCOIN } from '@/constants/btc'
import { useClipboardPaste } from '@/hooks/useClipboardPaste'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Layout, Typography } from '@/styles'
import { type MempoolStatistics } from '@/types/models/Blockchain'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { checkWalletNeedsSync } from '@/utils/account'
import { bip21decode, isBip21, isBitcoinAddress } from '@/utils/bitcoin'
import { formatNumber } from '@/utils/format'
import { time } from '@/utils/time'
import { estimateTransactionSize } from '@/utils/transaction'
import { selectEfficientUtxos } from '@/utils/utxo'

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
    addInput,
    removeInput,
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
      state.addInput,
      state.removeInput,
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
        const address = addressObj?.address
          ? await addressObj.address.asString()
          : ''
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

  const [localFeeRate, setLocalFeeRate] = useState(feeRate)
  const [outputsCount, setOutputsCount] = useState(0)
  const [addOutputModalVisible, setAddOutputModalVisible] = useState(false)
  const [loadingOptimizeAlgorithm, setLoadingOptimizeAlgorithm] = useState<
    false | 'privacy' | 'efficiency'
  >(false)

  const optionsBottomSheetRef = useRef<BottomSheet>(null)
  const changeFeeBottomSheetRef = useRef<BottomSheet>(null)

  const utxosValue = (utxos: Utxo[]): number =>
    utxos.reduce((acc, utxo) => acc + utxo.value, 0)

  const utxosTotalValue = useMemo(
    () => utxosValue(account.utxos),
    [account.utxos]
  )
  const utxosSelectedValue = utxosValue(getInputs())

  // First calculate without change output
  const baseTransactionSize = useMemo(() => {
    const { size, vsize } = estimateTransactionSize(inputs.size, outputs.length)
    return { size, vsize }
  }, [inputs.size, outputs.length])

  const baseMinerFee = useMemo(
    () => Math.round(feeRate * baseTransactionSize.vsize),
    [feeRate, baseTransactionSize.vsize]
  )

  // Calculate if we'll have change
  const totalOutputValue = useMemo(
    () => outputs.reduce((sum, output) => sum + output.amount, 0),
    [outputs]
  )
  const hasChange = useMemo(
    () => utxosSelectedValue > totalOutputValue + baseMinerFee,
    [utxosSelectedValue, totalOutputValue, baseMinerFee]
  )

  const [currentOutputLocalId, setCurrentOutputLocalId] = useState<string>()
  const [currentOutputNumber, setCurrentOutputNumber] = useState(1)
  const [outputTo, setOutputTo] = useState('')
  const [outputAmount, setOutputAmount] = useState(DUST_LIMIT)
  const [originalOutputAmount, setOriginalOutputAmount] = useState(0)
  const [outputLabel, setOutputLabel] = useState('')

  const { pasteFromClipboard } = useClipboardPaste({
    onPaste: (content) => {
      setOutputTo(content)
    }
  })

  const remainingSats = useMemo(
    () =>
      utxosSelectedValue -
      outputs.reduce((acc, output) => acc + output.amount, 0),
    [utxosSelectedValue, outputs]
  )

  const transactionSize = useMemo(() => {
    const { size, vsize } = estimateTransactionSize(
      inputs.size,
      outputs.length + (hasChange ? 1 : 0)
    )
    return { size, vsize }
  }, [inputs.size, outputs.length, hasChange])

  const minerFee = useMemo(
    () => Math.round(feeRate * transactionSize.vsize),
    [feeRate, transactionSize.vsize]
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

  const boxPosition = useMemo(
    () => new Animated.Value(localFeeRate),
    [localFeeRate]
  )

  const remainingBalance = useMemo(() => {
    const totalInputValue = utxosSelectedValue
    const totalOutputValue = outputs.reduce(
      (sum, output) => sum + output.amount,
      0
    )
    return totalInputValue - totalOutputValue - minerFee
  }, [minerFee, outputs, utxosSelectedValue])

  // Calculate outputs for chart including remaining balance
  const singleTxOutputs = useMemo(() => {
    const chartOutputs: Output[] = [...outputs]

    // Always include remaining balance if there is any
    if (remainingBalance > 0) {
      chartOutputs.push({
        localId: 'remainingBalance', // WARN: do not change it!
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

  useEffect(() => {
    setLocalFeeRate(feeRate)
  }, [feeRate])

  useEffect(() => {
    Animated.timing(boxPosition, {
      toValue: localFeeRate,
      duration: 100,
      useNativeDriver: true
    }).start()
  }, [localFeeRate, boxPosition])

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

  function resetLocalOutput() {
    setCurrentOutputLocalId(undefined)
    setCurrentOutputNumber(outputs.length + 1)
    setOutputTo('')
    setOutputAmount(DUST_LIMIT)
    setOriginalOutputAmount(0)
    setOutputLabel('')
  }

  function handleOnPressAddOutput() {
    resetLocalOutput()
    setOutputAmount(DUST_LIMIT)
    setAddOutputModalVisible(true)
  }

  function handleAddOutput() {
    const outputIndex = outputs.findIndex(
      (output) => output.localId === currentOutputLocalId
    )

    const output = { to: outputTo, amount: outputAmount, label: outputLabel }

    if (outputIndex === -1) addOutput(output)
    else updateOutput(outputs[outputIndex].localId, output)

    setOutputsCount((prev: number) => prev + 1)
    setAddOutputModalVisible(false)
    resetLocalOutput()
  }

  function handleRemoveOutput() {
    if (!currentOutputLocalId) return
    removeOutput(currentOutputLocalId)
    setAddOutputModalVisible(false)
    resetLocalOutput()
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
      setAddOutputModalVisible(true)
      return
    }

    const outputIndex = outputs.findIndex(
      (output) => output.localId === localId
    )
    if (outputIndex === -1) return

    setOutputTo(outputs[outputIndex].to)
    setOutputAmount(outputs[outputIndex].amount)
    setOriginalOutputAmount(outputs[outputIndex].amount)
    setOutputLabel(outputs[outputIndex].label)
    setCurrentOutputNumber(outputIndex + 1)

    setAddOutputModalVisible(true)
  }

  function handleOnChangeUtxoSelection(type: AutoSelectUtxosAlgorithms) {
    if (type === selectedAutoSelectUtxos) return

    if (outputs.length === 0 && (type === 'privacy' || type === 'efficiency')) {
      toast.error(
        t('transaction.build.errors.noOutputSelected.autoUtxoSelection')
      )
      return
    }

    switch (type) {
      case 'user':
        return router.back()
      case 'privacy': {
        setLoadingOptimizeAlgorithm('privacy')

        break
      }
      case 'efficiency': {
        setLoadingOptimizeAlgorithm('efficiency')

        const optimizationResult = selectEfficientUtxos(
          account.utxos.map((utxo) => ({
            ...utxo,
            effectiveValue: utxo.value
          })),
          totalOutputValue,
          localFeeRate
        )

        if (optimizationResult.error) {
          toast.error(optimizationResult.error)
          break
        }

        for (const utxo of account.utxos) {
          removeInput(utxo)
        }

        for (const utxo of optimizationResult.inputs) {
          addInput(utxo)
        }

        break
      }
    }

    setSelectedAutoSelectUtxos(type)
    setLoadingOptimizeAlgorithm(false)
  }

  function handleGoToPreview() {
    const totalOutputAmount = outputs.reduce(
      (acc, output) => acc + output.amount,
      0
    )

    const totalRequired = totalOutputAmount + minerFee

    if (totalRequired > utxosSelectedValue) {
      toast.error(t('transaction.error.insufficientInputs'))
      return
    }

    // Add change output if there's any remaining amount
    if (remainingBalance > 0) {
      // Validate that changeAddress is available before adding change output
      if (!changeAddress) {
        toast.error(t('transaction.error.ChangeAddressNotAvailable'))
        return
      }

      setShouldRemoveChange(false)
      addOutput({
        to: changeAddress,
        amount: remainingBalance,
        label: 'Change'
      })
    }

    // Check if wallet needs syncing based on time since last sync
    const needsSync = checkWalletNeedsSync(account)

    if (needsSync) {
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

  // Memoized set of own addresses for efficient lookup
  const ownAddressesSet = useMemo<Set<string>>(() => {
    if (!account) return new Set<string>()
    return new Set<string>(account.addresses.map((a) => a.address))
  }, [account])

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
          zIndex: 0,
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
            <SSHStack
              gap="xs"
              style={{ alignItems: 'baseline', marginTop: -5 }}
            >
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
        <View style={{ position: 'absolute', zIndex: -1 }}>
          {loadHistory ? (
            <SSMultipleSankeyDiagram
              onPressOutput={handleOnPressOutput}
              currentOutputLocalId={currentOutputLocalId}
              inputs={inputs}
              outputs={singleTxOutputs}
              feeRate={feeRate}
              ownAddresses={ownAddressesSet}
            />
          ) : (
            <SSCurrentTransactionChart
              inputs={inputs}
              outputs={singleTxOutputs}
              feeRate={localFeeRate}
              onPressOutput={handleOnPressOutput}
              currentOutputLocalId={currentOutputLocalId}
              ownAddresses={ownAddressesSet}
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
            label={
              outputs.length === 0
                ? t('transaction.build.add.output.title')
                : t('sign.transaction')
            }
            onPress={
              outputs.length === 0 ? handleOnPressAddOutput : handleGoToPreview
            }
          />
        </SSVStack>
      </LinearGradient>
      <SSModal
        visible={addOutputModalVisible}
        onClose={() => setAddOutputModalVisible(false)}
        fullOpacity
      >
        <View style={{ width: '100%', maxWidth: 1000, alignSelf: 'center' }}>
          <ScrollView style={{ width: '100%' }}>
            <SSVStack gap="lg" style={{ paddingHorizontal: 16 }}>
              <SSVStack itemsCenter>
                <SSText uppercase>
                  {t('transaction.build.add.output.number', {
                    number: currentOutputNumber
                  })}
                </SSText>
              </SSVStack>
              <SSVStack gap="md">
                <SSVStack gap="none">
                  <SSAmountInput
                    key={`amount-input-${outputsCount}`}
                    min={DUST_LIMIT}
                    max={
                      currentOutputLocalId
                        ? Math.max(
                            remainingSats + originalOutputAmount - minerFee,
                            DUST_LIMIT
                          )
                        : Math.max(remainingSats - minerFee, DUST_LIMIT)
                    }
                    value={currentOutputLocalId ? outputAmount : DUST_LIMIT}
                    remainingSats={
                      currentOutputLocalId
                        ? remainingSats + originalOutputAmount - minerFee
                        : remainingSats - minerFee
                    }
                    onValueChange={(value) => setOutputAmount(value)}
                  />
                </SSVStack>
                <SSVStack>
                  <SSTextInput
                    value={outputTo}
                    placeholder={t('transaction.address')}
                    align="left"
                    multiline
                    numberOfLines={4}
                    style={{
                      fontFamily: Typography.sfProMono,
                      fontSize: 22,
                      letterSpacing: 0.5,
                      height: 110,
                      textAlignVertical: 'top',
                      paddingTop: 12
                    }}
                    onChangeText={(text) => setOutputTo(text)}
                  />
                  <SSHStack gap="md">
                    <SSButton
                      variant="outline"
                      label={t('common.paste')}
                      style={{ flex: 1 }}
                      onPress={pasteFromClipboard}
                    />
                    <SSButton
                      variant="outline"
                      label={t('camera.scanQRCode')}
                      style={{ flex: 1 }}
                      onPress={() => setCameraModalVisible(true)}
                    />
                  </SSHStack>
                </SSVStack>
                <SSTextInput
                  multiline
                  numberOfLines={4}
                  placeholder={t('transaction.build.add.label.title')}
                  align="left"
                  value={outputLabel}
                  onChangeText={(text) => setOutputLabel(text)}
                  style={{
                    fontSize: 22,
                    height: 110,
                    textAlignVertical: 'top',
                    paddingTop: 12
                  }}
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
              </SSVStack>
            </SSVStack>
          </ScrollView>
        </View>
      </SSModal>
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
                loading={loadingOptimizeAlgorithm === 'privacy'}
                selected={selectedAutoSelectUtxos === 'privacy'}
                style={{ width: '33%', flex: 1 }}
                onPress={() => handleOnChangeUtxoSelection('privacy')}
              />
              <SSRadioButton
                variant="outline"
                label={t(
                  'transaction.build.options.autoSelect.utxos.efficiency.title'
                )}
                loading={loadingOptimizeAlgorithm === 'efficiency'}
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
