import type BottomSheet from '@gorhom/bottom-sheet'
import { useQuery } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useIsFocused } from 'expo-router/react-navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type LayoutChangeEvent,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconChevronLeft } from '@/components/icons'
import SSAmountInput from '@/components/SSAmountInput'
import SSBlockFeePriceRow from '@/components/SSBlockFeePriceRow'
import SSBottomSheet from '@/components/SSBottomSheet'
import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSCurrentTransactionChart from '@/components/SSCurrentTransactionChart'
import SSDustWarningBanner from '@/components/SSDustWarningBanner'
import SSFeeInput from '@/components/SSFeeInput'
import SSFeeRateChart, {
  type SSFeeRateChartProps
} from '@/components/SSFeeRateChart'
import SSModal from '@/components/SSModal'
import SSMultipleSankeyDiagram from '@/components/SSMultipleSankeyDiagram'
import SSOrphanedInputsBanner from '@/components/SSOrphanedInputsBanner'
import SSRadioButton from '@/components/SSRadioButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { DUST_LIMIT, SATS_PER_BITCOIN } from '@/constants/btc'
import {
  IO_PREVIEW_BOTTOM_GRADIENT_COLORS,
  IO_PREVIEW_BOTTOM_GRADIENT_EXTEND_PX,
  IO_PREVIEW_BOTTOM_GRADIENT_LOCATIONS,
  IO_PREVIEW_UNDERFUNDED_WARNING_MARGIN_TOP_PX
} from '@/constants/ioPreviewLayout'
import { useClipboardPaste } from '@/hooks/useClipboardPaste'
import { processContentForOutput } from '@/hooks/useContentProcessor'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useNetworkInfo } from '@/hooks/useNetworkInfo'
import useUnusedInternalAddresses from '@/hooks/useUnusedInternalAddresses'
import { useUriAutoSelectUtxos } from '@/hooks/useUriAutoSelectUtxos'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Layout, Typography } from '@/styles'
import { warning } from '@/styles/colors'
import {
  type AutoSelectUtxosAlgorithm,
  type LoadingAutoSelectUtxosAlgorithm
} from '@/types/models/AutoSelectUtxos'
import { type MempoolStatistics } from '@/types/models/Blockchain'
import { type Utxo } from '@/types/models/Utxo'
import { type IoPreviewSearchParams } from '@/types/navigation/searchParams'
import { checkWalletNeedsSync } from '@/utils/account'
import {
  autoSelectUtxosDescriptionKey,
  autoSelectUtxosTitleKey,
  shouldAutoSelectUtxosFromBitcoinUri,
  shouldAutoSelectUtxosFromParsedAmount
} from '@/utils/autoSelectUtxos'
import { parseBitcoinUri } from '@/utils/bip321'
import {
  detectContentByContext,
  type DetectedContent
} from '@/utils/contentDetector'
import { formatAddress, formatNumber } from '@/utils/format'
import {
  type ParsedUriParams,
  parseUriParameters,
  stripBitcoinPrefix
} from '@/utils/parse'
import {
  buildSingleTxChartOutputs,
  buildStonewallPreviewOutputs,
  CHART_REMAINING_BALANCE_LOCAL_ID,
  getStonewallPaymentContext
} from '@/utils/stonewall'
import { time } from '@/utils/time'
import { estimateTransactionSize } from '@/utils/transaction'
import {
  getCommittedTransactionOutputSats,
  getFundingMinerFeeSats,
  getTransactionRemainingBalance,
  isTransactionUnderfunded,
  shouldDeferUnderfundedWarning
} from '@/utils/transactionFunding'
import {
  filterUtxosByExcludedOutpoints,
  getUtxoOutpoint,
  mapStonewallChangeOutputs,
  mapStonewallFakeMixOutputs,
  selectEfficientUtxos,
  selectStonewallUtxos,
  splitStonewallOutputValues
} from '@/utils/utxo'

export default function IOPreview() {
  const router = useRouter()
  const { id, autoSelectFromUri, dustWarning } =
    useLocalSearchParams<IoPreviewSearchParams>()
  const isFocused = useIsFocused()
  const insets = useSafeAreaInsets()

  const account = useAccountsStore(
    (state) => state.accounts.find((account) => account.id === id)!
  )
  const [currencyUnit, defaultAutoSelectUtxos, useZeroPadding] =
    useSettingsStore(
      useShallow((state) => [
        state.currencyUnit,
        state.defaultAutoSelectUtxos,
        state.useZeroPadding
      ])
    )
  const zeroPadding = useZeroPadding || currencyUnit === 'btc'
  const [
    inputs,
    addInput,
    removeInput,
    removeOrphanedInputs,
    outputs,
    getInputs,
    feeRate,
    addOutput,
    updateOutput,
    removeOutput,
    setFeeRate,
    setFee,
    clearPsbt,
    clearTransaction
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.inputs,
      state.addInput,
      state.removeInput,
      state.removeOrphanedInputs,
      state.outputs,
      state.getInputs,
      state.feeRate,
      state.addOutput,
      state.updateOutput,
      state.removeOutput,
      state.setFeeRate,
      state.setFee,
      state.clearPsbt,
      state.clearTransaction
    ])
  )

  const mempoolOracle = useMempoolOracle(account?.network || 'bitcoin')
  const wallet = useGetAccountWallet(id!)
  const { changeAddress, secondChangeAddress, decoyAddress } =
    useUnusedInternalAddresses(account, wallet)
  const [stonewallChangeValues, setStonewallChangeValues] = useState<number[]>(
    []
  )
  const [stonewallFakeMixValues, setStonewallFakeMixValues] = useState<
    number[]
  >([])
  const [stonewallFee, setStonewallFee] = useState<number | null>(null)
  const [excludedUtxoOutpoints, setExcludedUtxoOutpoints] = useState<
    Set<string>
  >(() => new Set())
  const [removeInputModalVisible, setRemoveInputModalVisible] = useState(false)
  const [inputToRemove, setInputToRemove] = useState<Utxo | null>(null)
  const [shouldRemoveChange, setShouldRemoveChange] = useState(true)
  const shouldRemoveChangeRef = useRef(true)

  useEffect(() => {
    shouldRemoveChangeRef.current = shouldRemoveChange
  }, [shouldRemoveChange])

  // this removes the change addresses if the user goes back to the IO preview.
  // we add the change address(es) as outputs before moving to the next step.
  useEffect(() => {
    if (!changeAddress || !shouldRemoveChangeRef.current) {
      return
    }
    const changeAddresses = new Set(
      [changeAddress, secondChangeAddress, decoyAddress].filter(Boolean)
    )
    for (const output of outputs) {
      if (changeAddresses.has(output.to)) {
        removeOutput(output.localId)
      }
    }
  }, [
    outputs,
    changeAddress,
    secondChangeAddress,
    decoyAddress,
    shouldRemoveChange,
    removeOutput
  ])

  const [fiatCurrency, satsToFiat, btcPrice] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.satsToFiat,
      state.btcPrice
    ])
  )

  const { blockHeight, nextBlockFee, blockHeightSource } = useNetworkInfo()

  const [selectedAutoSelectUtxos, setSelectedAutoSelectUtxos] =
    useState<AutoSelectUtxosAlgorithm>('user')

  useFocusEffect(
    useCallback(() => {
      if (selectedAutoSelectUtxos !== 'privacy') {
        return
      }

      shouldRemoveChangeRef.current = true
      setShouldRemoveChange(true)
    }, [selectedAutoSelectUtxos])
  )

  const markUriAutoSelectPendingRef = useRef<(() => void) | undefined>(
    undefined
  )
  const applyUtxoSelectionRef = useRef<
    (type: AutoSelectUtxosAlgorithm) => boolean
  >(() => false)

  const [loadHistory, setLoadHistory] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [topGradientHeight, setTopGradientHeight] = useState(0)

  const [previousUserSelectedUtxos, setPreviousUserSelectedUtxos] =
    useState<Utxo[]>()
  const [localFeeRate, setLocalFeeRate] = useState(feeRate)
  const [outputsCount, setOutputsCount] = useState(0)
  const [addOutputModalVisible, setAddOutputModalVisible] = useState(false)
  const [loadingOptimizeAlgorithm, setLoadingOptimizeAlgorithm] =
    useState<LoadingAutoSelectUtxosAlgorithm>(false)

  const { markUriAutoSelectPending, uriAutoSelectPending } = useUriAutoSelectUtxos({
    autoSelectFromUri,
    decoyAddress,
    defaultAlgorithm: defaultAutoSelectUtxos,
    onApplyAlgorithm: (type) => applyUtxoSelectionRef.current(type),
    outputsLength: outputs.length
  })
  markUriAutoSelectPendingRef.current = markUriAutoSelectPending

  const optionsBottomSheetRef = useRef<BottomSheet>(null)
  const changeFeeBottomSheetRef = useRef<BottomSheet>(null)

  const utxosValue = (utxos: Utxo[]): number =>
    utxos.reduce((acc, utxo) => acc + utxo.value, 0)

  const utxosTotalValue = useMemo(
    () => utxosValue(account.utxos),
    [account.utxos]
  )
  const utxosSelectedValue = utxosValue(Array.from(inputs.values()))

  // First calculate without change output
  const baseTransactionSize = useMemo(() => {
    const { size, vsize } = estimateTransactionSize(
      Array.from(inputs.values()),
      outputs
      // add hasChange
    )
    return { size, vsize }
  }, [inputs, outputs])

  const baseMinerFee = useMemo(
    () => Math.round(localFeeRate * baseTransactionSize.vsize),
    [localFeeRate, baseTransactionSize.vsize]
  )

  // Calculate if we'll have change
  const totalOutputValue = useMemo(
    () => outputs.reduce((sum, output) => sum + output.amount, 0),
    [outputs]
  )
  const hasChange = utxosSelectedValue > totalOutputValue + baseMinerFee

  const utxoOutpointSet = new Set(account.utxos.map(getUtxoOutpoint))
  const orphanedInputs = Array.from(inputs.values()).filter(
    (utxo) => !utxoOutpointSet.has(getUtxoOutpoint(utxo))
  )
  const hasOrphanedInputs = orphanedInputs.length > 0

  const [currentOutputLocalId, setCurrentOutputLocalId] = useState<string>()
  const [currentOutputNumber, setCurrentOutputNumber] = useState(1)
  const [outputTo, setOutputTo] = useState('')
  const [outputAmount, setOutputAmount] = useState(DUST_LIMIT)
  const [originalOutputAmount, setOriginalOutputAmount] = useState(0)
  const [outputLabel, setOutputLabel] = useState('')
  const [dustErrorOverride, setDustErrorOverride] = useState(
    dustWarning ? t('transaction.error.dustOutputBelowLimit') : ''
  )
  const [dustChangeModalVisible, setDustChangeModalVisible] = useState(false)
  const [pendingDustAmount, setPendingDustAmount] = useState(0)

  const dustErrorMessage = dustErrorOverride

  const remainingSats = useMemo(
    () =>
      utxosSelectedValue -
      outputs.reduce((acc, output) => acc + output.amount, 0),
    [utxosSelectedValue, outputs]
  )

  function applyParsedOutput(parsed: ParsedUriParams) {
    setOutputTo(parsed.address)
    if (parsed.amount !== undefined && parsed.amount > 0) {
      const amountInSats = Math.round(parsed.amount * SATS_PER_BITCOIN)
      if (amountInSats > 0 && amountInSats < DUST_LIMIT) {
        setDustErrorOverride(t('transaction.error.dustOutputBelowLimit'))
        setOutputAmount(amountInSats)
      } else {
        setDustErrorOverride('')
        setOutputAmount(amountInSats)
      }
    }
    if (parsed.label !== undefined) {
      setOutputLabel(parsed.label)
    }

    if (shouldAutoSelectUtxosFromParsedAmount(parsed.amount)) {
      markUriAutoSelectPendingRef.current?.()
    }
  }

  function tryDecodeBip21(content: string): ParsedUriParams | null {
    let uriToDecode = content
    if (!uriToDecode.toLowerCase().startsWith('bitcoin:')) {
      uriToDecode = `bitcoin:${uriToDecode}`
    }

    const parsed = parseBitcoinUri(uriToDecode)
    if (parsed.isValid) {
      return {
        address: parsed.address,
        amount: parsed.amount || 0,
        label: parsed.label || ''
      }
    }
    return null
  }

  function tryParseUriWithValidation(content: string): ParsedUriParams | null {
    const parsed = parseUriParameters(content)
    if (!parsed) {
      return null
    }

    const detectedContent = detectContentByContext(parsed.address, 'bitcoin')
    if (!detectedContent.isValid) {
      return null
    }

    return parsed
  }

  function handlePasteFromClipboard(content: string) {
    const trimmedContent = content.trim()

    // Step 1: Try BIP21 decode
    const bip21Result = tryDecodeBip21(trimmedContent)
    if (bip21Result) {
      applyParsedOutput(bip21Result)
      return
    }

    // Step 2: Try manual URI parsing with validation
    const processedContent = stripBitcoinPrefix(trimmedContent)
    const uriResult = tryParseUriWithValidation(processedContent)
    if (uriResult && uriResult.amount !== undefined) {
      applyParsedOutput(uriResult)
      return
    }

    // Step 3: Try content detection
    const detectedContent = detectContentByContext(processedContent, 'bitcoin')
    if (detectedContent.isValid) {
      const success = processContentForOutput(detectedContent, {
        onError: () => setOutputTo(processedContent),
        onWarning: () => undefined,
        remainingSats,
        setOutputAmount,
        setOutputLabel,
        setOutputTo
      })
      if (
        success &&
        detectedContent.type === 'bitcoin_uri' &&
        shouldAutoSelectUtxosFromBitcoinUri(trimmedContent)
      ) {
        markUriAutoSelectPendingRef.current?.()
      }
      if (success) {
        return
      }
    }

    // Step 4: Fallback - set as plain address
    setOutputTo(processedContent)
  }

  const { pasteFromClipboard } = useClipboardPaste({
    onPaste: (content) => {
      try {
        handlePasteFromClipboard(content)
      } catch {
        setOutputTo(stripBitcoinPrefix(content.trim()))
      }
    }
  })

  const transactionSize = useMemo(() => {
    const { size, vsize } = estimateTransactionSize(
      Array.from(inputs.values()),
      outputs,
      hasChange
    )
    return { size, vsize }
  }, [inputs, outputs, hasChange])

  const minerFee = useMemo(
    () => Math.round(localFeeRate * transactionSize.vsize),
    [localFeeRate, transactionSize.vsize]
  )

  const stonewallPaymentContext = useMemo(
    () =>
      getStonewallPaymentContext({
        accountAddresses: account.addresses,
        accountScriptVersion: account.keys[0]?.scriptVersion,
        decoyAddress,
        localFeeRate,
        nextBlockFee: useBlockchainStore.getState().nextBlockFee,
        outputs
      }),
    [
      account.addresses,
      account.keys,
      decoyAddress,
      localFeeRate,
      outputs
    ]
  )

  const stonewallPreviewOutputs =
    selectedAutoSelectUtxos === 'privacy' &&
    stonewallFee !== null &&
    decoyAddress
      ? buildStonewallPreviewOutputs({
          changeAddress,
          changeValues: stonewallChangeValues,
          decoyAddress,
          fakeMixLabel: stonewallPaymentContext.paymentLabel,
          fakeMixValues: stonewallFakeMixValues,
          fee: stonewallFee,
          secondChangeAddress
        })
      : []

  const stonewallOutputsMaterialized = outputs.some(
    (output) => output.kind === 'fakeMix'
  )
  const chartStonewallPreviewOutputs = stonewallOutputsMaterialized
    ? []
    : stonewallPreviewOutputs

  const committedOutputSats = getCommittedTransactionOutputSats(
    totalOutputValue,
    chartStonewallPreviewOutputs.map((output) => output.amount)
  )

  const fundingOutputsForSize = useMemo(
    () => [...outputs, ...chartStonewallPreviewOutputs],
    [chartStonewallPreviewOutputs, outputs]
  )

  const projectedMinerFee = useMemo(() => {
    if (inputs.size === 0) {
      return 0
    }

    const inputArray = Array.from(inputs.values())
    const { vsize: baseVsize } = estimateTransactionSize(
      inputArray,
      fundingOutputsForSize
    )
    const baseFee = Math.round(localFeeRate * baseVsize)
    const hasFundingChange =
      utxosSelectedValue > committedOutputSats + baseFee
    const { vsize } = estimateTransactionSize(
      inputArray,
      fundingOutputsForSize,
      hasFundingChange
    )

    return Math.round(localFeeRate * vsize)
  }, [
    committedOutputSats,
    fundingOutputsForSize,
    inputs,
    localFeeRate,
    utxosSelectedValue
  ])

  const fundingMinerFee = getFundingMinerFeeSats({
    projectedMinerFeeSats: projectedMinerFee,
    stonewallMinerFeeSats:
      selectedAutoSelectUtxos === 'privacy' ? stonewallFee : null
  })

  const effectiveMinerFee =
    selectedAutoSelectUtxos === 'privacy' && stonewallFee !== null
      ? stonewallFee
      : minerFee

  const deferUnderfundedWarning =
    shouldDeferUnderfundedWarning({
      defaultAutoSelectAlgorithm: defaultAutoSelectUtxos,
      inputsCount: inputs.size,
      isAutoSelectPending: uriAutoSelectPending,
      isSelectingUtxos: loadingOptimizeAlgorithm !== false,
      outputsCount: outputs.length,
      selectedAlgorithm: selectedAutoSelectUtxos
    }) ||
    (selectedAutoSelectUtxos === 'privacy' && stonewallFee === null)

  const [selectedPeriod] = useState<SSFeeRateChartProps['timeRange']>('2hours')

  const { data: mempoolStatistics } = useQuery<MempoolStatistics[]>({
    enabled: isFocused,
    queryFn: () =>
      mempoolOracle.getMempoolStatistics(
        selectedPeriod === '2hours'
          ? '2h'
          : selectedPeriod === 'day'
            ? '24h'
            : '1w'
      ),
    queryKey: ['statistics', selectedPeriod],
    staleTime: time.minutes(5)
  })

  const remainingBalance = getTransactionRemainingBalance(
    utxosSelectedValue,
    committedOutputSats,
    fundingMinerFee
  )

  const isUnderfunded =
    !deferUnderfundedWarning &&
    isTransactionUnderfunded(
      utxosSelectedValue,
      committedOutputSats,
      fundingMinerFee
    )

  const singleTxOutputs = buildSingleTxChartOutputs({
    changeAddress,
    outputs,
    previewOutputs: chartStonewallPreviewOutputs,
    remainingBalance
  })

  useEffect(() => {
    if (deferUnderfundedWarning || !isUnderfunded) {
      return
    }

    toast.error(t('transaction.error.insufficientInputs'))
  }, [deferUnderfundedWarning, isUnderfunded])

  useEffect(() => {
    if (feeRate === 0) {
      setFeeRate(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once: if builder fee is still the default (<=1), match useNetworkInfo nextBlockFee.
  const hasHydratedRecommendedFeeRate = useRef(false)
  useEffect(() => {
    hasHydratedRecommendedFeeRate.current = false
  }, [id])

  useEffect(() => {
    if (hasHydratedRecommendedFeeRate.current) {
      return
    }
    if (nextBlockFee === null || nextBlockFee < 1) {
      return
    }
    if (feeRate > 1) {
      hasHydratedRecommendedFeeRate.current = true
      return
    }
    setFeeRate(nextBlockFee)
    hasHydratedRecommendedFeeRate.current = true
  }, [feeRate, nextBlockFee, setFeeRate])

  useEffect(() => {
    if (selectedAutoSelectUtxos === 'privacy') {
      return
    }
    setFee(Math.round(localFeeRate * transactionSize.vsize))
  }, [localFeeRate, transactionSize, selectedAutoSelectUtxos, setFee])

  useEffect(() => {
    setLocalFeeRate(feeRate)
  }, [feeRate])

  function handleContentScanned(content: DetectedContent) {
    if (!content.isValid) {
      toast.error(t('camera.error.invalidContent'))
      return
    }

    const success = processContentForOutput(content, {
      onError: (message) => {
        if (message === t('transaction.error.dustOutputBelowLimit')) {
          setDustErrorOverride(message)
          setCameraModalVisible(false)
        } else {
          toast.error(t('transaction.error.address.invalid'))
        }
      },
      onWarning: () => {
        toast.warning(t('transaction.error.bip21.insufficientSats'))
      },
      remainingSats,
      setOutputAmount,
      setOutputLabel,
      setOutputTo
    })

    if (
      success &&
      content.type === 'bitcoin_uri' &&
      shouldAutoSelectUtxosFromBitcoinUri(content.cleaned.trim())
    ) {
      markUriAutoSelectPendingRef.current?.()
    }

    if (success) {
      setCameraModalVisible(false)
    }
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
    if (outputAmount > 0 && outputAmount < DUST_LIMIT) {
      toast.error(t('transaction.error.dustOutputBelowLimit'))
      return
    }

    const outputIndex = outputs.findIndex(
      (output) => output.localId === currentOutputLocalId
    )

    const output = {
      amount: outputAmount,
      label: outputLabel,
      to: stripBitcoinPrefix(outputTo)
    }

    if (outputIndex === -1) {
      addOutput(output)
    } else {
      updateOutput(outputs[outputIndex].localId, output)
    }

    setOutputsCount((prev: number) => prev + 1)
    setAddOutputModalVisible(false)
    resetLocalOutput()
  }

  function handleRemoveOutput() {
    if (!currentOutputLocalId) {
      return
    }
    removeOutput(currentOutputLocalId)
    setAddOutputModalVisible(false)
    resetLocalOutput()
  }

  function handleSetFeeRate() {
    setFeeRate(localFeeRate)

    if (
      selectedAutoSelectUtxos === 'privacy' &&
      stonewallFee !== null &&
      !applyStonewallSelection(excludedUtxoOutpoints)
    ) {
      return
    }

    changeFeeBottomSheetRef.current?.close()
  }

  function materializeStonewallOutputs(): boolean {
    if (selectedAutoSelectUtxos !== 'privacy' || stonewallFee === null) {
      return false
    }

    if (stonewallFakeMixValues.length > 0 && !decoyAddress) {
      return false
    }

    const changeAddresses = [changeAddress, secondChangeAddress].filter(Boolean)
    if (stonewallChangeValues.length > changeAddresses.length) {
      return false
    }

    if (
      stonewallChangeValues.length === 0 &&
      stonewallFakeMixValues.length === 0
    ) {
      return false
    }

    const fakeMixOutputs = mapStonewallFakeMixOutputs(
      stonewallFakeMixValues,
      decoyAddress
    )
    const changeOutputs = mapStonewallChangeOutputs(
      stonewallChangeValues,
      changeAddresses
    )

    shouldRemoveChangeRef.current = false
    setShouldRemoveChange(false)
    setFee(stonewallFee)

    for (const output of fakeMixOutputs) {
      addOutput({
        amount: output.amount,
        kind: 'fakeMix',
        label: stonewallPaymentContext.paymentLabel,
        to: output.to
      })
    }

    for (const output of changeOutputs) {
      addOutput({
        amount: output.amount,
        label: t('sign.changeAddressLabelDefault'),
        to: output.to
      })
    }

    return true
  }

  function handleOnPressOutput(localId?: string) {
    if (localId === 'current-minerFee') {
      setCurrentOutputLocalId(localId)
      changeFeeBottomSheetRef.current?.expand()
      return
    }

    if (
      selectedAutoSelectUtxos === 'privacy' ||
      selectedAutoSelectUtxos === 'efficiency'
    ) {
      return
    }

    setCurrentOutputLocalId(localId)

    if (localId === CHART_REMAINING_BALANCE_LOCAL_ID) {
      setAddOutputModalVisible(true)
      return
    }

    const outputIndex = outputs.findIndex(
      (output) => output.localId === localId
    )
    if (outputIndex === -1) {
      return
    }

    setOutputTo(outputs[outputIndex].to)
    setOutputAmount(outputs[outputIndex].amount)
    setOriginalOutputAmount(outputs[outputIndex].amount)
    setOutputLabel(outputs[outputIndex].label)
    setCurrentOutputNumber(outputIndex + 1)

    setAddOutputModalVisible(true)
  }

  function setAccountUtxos(utxos: Utxo[]) {
    for (const utxo of account.utxos) {
      removeInput(utxo)
    }

    for (const utxo of utxos) {
      addInput(utxo)
    }
  }

  function applyStonewallSelection(excluded: Set<string>): boolean {
    if (!decoyAddress) {
      toast.error(t('transaction.error.ChangeAddressNotAvailable'))
      return false
    }

    const {
      changeScriptType,
      effectiveFeeRate,
      paymentOutputs,
      recipientScriptType,
      userPaymentAmount
    } = getStonewallPaymentContext({
      accountAddresses: account.addresses,
      accountScriptVersion: account.keys[0]?.scriptVersion,
      decoyAddress,
      localFeeRate,
      nextBlockFee: useBlockchainStore.getState().nextBlockFee,
      outputs
    })

    const pool = filterUtxosByExcludedOutpoints(account.utxos, excluded)

    const stonewallResult = selectStonewallUtxos(
      pool,
      userPaymentAmount,
      effectiveFeeRate,
      {
        addresses: account.addresses,
        changeScriptType,
        outputs: paymentOutputs,
        recipientScriptType
      }
    )

    if (stonewallResult.error) {
      toast.error(stonewallResult.error)
      return false
    }

    const { changeValues, fakeMixValues } = splitStonewallOutputValues(
      stonewallResult.outputs
    )

    setAccountUtxos(stonewallResult.inputs)
    setStonewallChangeValues(changeValues)
    setStonewallFakeMixValues(fakeMixValues)
    setStonewallFee(stonewallResult.fee)
    setFee(stonewallResult.fee)

    if (effectiveFeeRate !== localFeeRate) {
      setLocalFeeRate(effectiveFeeRate)
      setFeeRate(effectiveFeeRate)
    }

    return true
  }

  function handleOnPressInput(outpoint: string) {
    const utxo = inputs.get(outpoint)
    if (!utxo) {
      return
    }

    setInputToRemove(utxo)
    setRemoveInputModalVisible(true)
  }

  function handleCancelRemoveInput() {
    setRemoveInputModalVisible(false)
    setInputToRemove(null)
  }

  function handleConfirmRemoveInput() {
    if (!inputToRemove) {
      return
    }

    if (selectedAutoSelectUtxos === 'privacy') {
      const outpoint = getUtxoOutpoint(inputToRemove)
      const nextExcluded = new Set(excludedUtxoOutpoints)
      nextExcluded.add(outpoint)

      if (applyStonewallSelection(nextExcluded)) {
        setExcludedUtxoOutpoints(nextExcluded)
        setRemoveInputModalVisible(false)
        setInputToRemove(null)
      }

      return
    }

    removeInput(inputToRemove)
    setRemoveInputModalVisible(false)
    setInputToRemove(null)
  }

  function handleOnChangeUtxoSelection(
    type: AutoSelectUtxosAlgorithm
  ): boolean {
    if (type === selectedAutoSelectUtxos) {
      return true
    }

    if (outputs.length === 0 && (type === 'privacy' || type === 'efficiency')) {
      toast.error(
        t('transaction.build.errors.noOutputSelected.autoUtxoSelection')
      )
      return false
    }

    // Leaving privacy mode: drop the decoy output it added before reselecting.
    if (selectedAutoSelectUtxos === 'privacy' && type !== 'privacy') {
      const decoyOutput = outputs.find((output) => output.to === decoyAddress)
      if (decoyOutput) {
        removeOutput(decoyOutput.localId)
      }
      setStonewallChangeValues([])
      setStonewallFakeMixValues([])
      setStonewallFee(null)
      setExcludedUtxoOutpoints(new Set())
    }

    const { effectiveFeeRate, userPaymentAmount } = getStonewallPaymentContext({
      accountAddresses: account.addresses,
      accountScriptVersion: account.keys[0]?.scriptVersion,
      decoyAddress,
      localFeeRate,
      nextBlockFee: useBlockchainStore.getState().nextBlockFee,
      outputs
    })

    let selectionSucceeded = true

    switch (type) {
      case 'user': {
        if (previousUserSelectedUtxos) {
          setAccountUtxos(previousUserSelectedUtxos)
        } else {
          router.back()
          return false
        }

        break
      }
      case 'privacy': {
        setLoadingOptimizeAlgorithm('privacy')

        if (!decoyAddress) {
          toast.error(t('transaction.error.ChangeAddressNotAvailable'))
          selectionSucceeded = false
          break
        }

        setPreviousUserSelectedUtxos(getInputs())
        setExcludedUtxoOutpoints(new Set())
        selectionSucceeded = applyStonewallSelection(new Set())

        break
      }
      case 'efficiency': {
        setLoadingOptimizeAlgorithm('efficiency')

        setPreviousUserSelectedUtxos(getInputs())

        const feeFn = (inputCount: number, hasChange: boolean) => {
          const mockInputs = account.utxos.slice(0, inputCount)
          const { vsize } = estimateTransactionSize(
            mockInputs,
            outputs,
            hasChange
          )
          return Math.floor(effectiveFeeRate * vsize)
        }

        const optimizationResult = selectEfficientUtxos(
          account.utxos,
          userPaymentAmount,
          effectiveFeeRate,
          { feeFn }
        )

        if (optimizationResult.error) {
          toast.error(optimizationResult.error)
          selectionSucceeded = false
          break
        }

        setAccountUtxos(optimizationResult.inputs)

        if (effectiveFeeRate !== localFeeRate) {
          setLocalFeeRate(effectiveFeeRate)
          setFeeRate(effectiveFeeRate)
        }

        break
      }
      default:
        break
    }

    if (selectionSucceeded) {
      setSelectedAutoSelectUtxos(type)
    }
    setLoadingOptimizeAlgorithm(false)
    return selectionSucceeded
  }

  applyUtxoSelectionRef.current = handleOnChangeUtxoSelection

  function tryAddStonewallOutputs(): boolean {
    return materializeStonewallOutputs()
  }

  function handleGoToPreview() {
    setDustErrorOverride('')
    setFeeRate(localFeeRate)
    const totalRequired = committedOutputSats + fundingMinerFee

    if (totalRequired > utxosSelectedValue) {
      toast.error(t('transaction.error.insufficientInputs'))
      return
    }

    for (const output of outputs) {
      if (output.amount > 0 && output.amount < DUST_LIMIT) {
        setDustErrorOverride(t('transaction.error.dustOutputBelowLimit'))
        return
      }
    }

    if (selectedAutoSelectUtxos === 'privacy') {
      if (!tryAddStonewallOutputs()) {
        toast.error(t('transaction.error.ChangeAddressNotAvailable'))
        return
      }

      proceedToPreview()
      return
    }

    if (remainingBalance > 0 && remainingBalance < DUST_LIMIT) {
      setPendingDustAmount(remainingBalance)
      setDustChangeModalVisible(true)
      return
    }

    // Add change output if there's enough remaining (above dust limit)
    if (remainingBalance >= DUST_LIMIT) {
      // Validate that changeAddress is available before adding change output
      if (!changeAddress) {
        toast.error(t('transaction.error.ChangeAddressNotAvailable'))
        return
      }

      setShouldRemoveChange(false)
      addOutput({
        amount: remainingBalance,
        label: t('sign.changeAddressLabelDefault'),
        to: changeAddress
      })
    }

    proceedToPreview()
  }

  function proceedToPreview() {
    clearPsbt()
    const needsSync = checkWalletNeedsSync(account)
    if (needsSync) {
      router.navigate(
        `/signer/bitcoin/account/${id}/signAndSend/walletSyncedConfirmation`
      )
      return
    }
    router.navigate(
      `/signer/bitcoin/account/${id}/signAndSend/previewTransaction`
    )
  }

  function handleDustToFee() {
    setDustChangeModalVisible(false)
    // Dust absorbed into miner fee — proceed without change output
    proceedToPreview()
  }

  function handleDustToOutputs() {
    setDustChangeModalVisible(false)
    // Distribute dust evenly across existing outputs
    const perOutput = Math.floor(pendingDustAmount / outputs.length)
    const remainder = pendingDustAmount - perOutput * outputs.length

    for (let i = 0; i < outputs.length; i += 1) {
      const extra = perOutput + (i === 0 ? remainder : 0)
      updateOutput(outputs[i].localId, {
        amount: outputs[i].amount + extra,
        label: outputs[i].label,
        to: outputs[i].to
      })
    }
  }

  function handleSelectUserAutoUtxos() {
    handleOnChangeUtxoSelection('user')
  }

  function handleSelectPrivacyAutoUtxos() {
    handleOnChangeUtxoSelection('privacy')
  }

  function handleSelectEfficiencyAutoUtxos() {
    handleOnChangeUtxoSelection('efficiency')
  }

  const handleTopLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setTopGradientHeight(height)
  }
  const handleLoadHistory = () => {
    setLoadHistory(!loadHistory)
  }

  const ownAddressesSet = account
    ? new Set(account.addresses.map((address) => address.address))
    : new Set<string>()

  const chartOnPressInput = handleOnPressInput

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
      {inputs.size > 0 && (
        <View
          style={{
            height: '100%',
            position: 'absolute',
            width: '100%'
          }}
          pointerEvents="box-none"
        >
          {loadHistory ? (
            <SSMultipleSankeyDiagram
              onPressInput={chartOnPressInput}
              onPressOutput={handleOnPressOutput}
              currentOutputLocalId={currentOutputLocalId}
              inputs={inputs}
              outputs={singleTxOutputs}
              feeRate={feeRate}
              ownAddresses={ownAddressesSet}
              overlayHeaderHeight={topGradientHeight}
            />
          ) : (
            <SSCurrentTransactionChart
              inputs={inputs}
              outputs={singleTxOutputs}
              feeRate={localFeeRate}
              effectiveMinerFeeSats={fundingMinerFee}
              suppressUnderfundedWarning={deferUnderfundedWarning}
              onPressInput={chartOnPressInput}
              onPressOutput={handleOnPressOutput}
              currentOutputLocalId={currentOutputLocalId}
              ownAddresses={ownAddressesSet}
              overlayHeaderHeight={topGradientHeight}
            />
          )}
        </View>
      )}
      <View
        style={{
          pointerEvents: 'box-none',
          position: 'absolute',
          width: '100%'
        }}
      >
        <LinearGradient
          style={{
            paddingHorizontal: Layout.mainContainer.paddingHorizontal,
            paddingTop: Layout.vStack.gap.sm,
            pointerEvents: 'none',
            width: '100%'
          }}
          onLayout={handleTopLayout}
          locations={[0.19, 0.566, 0.77, 1]}
          colors={['#0A0A0AFF', '#0A0A0A85', '#0A0A0A68', '#0A0A0A00']}
        >
          <SSVStack gap="xs" itemsCenter style={{ flex: 1 }}>
            <SSBlockFeePriceRow
              blockHeight={blockHeight}
              btcPrice={btcPrice}
              fiatCurrency={fiatCurrency}
              nextBlockFee={nextBlockFee}
              blockHeightSource={blockHeightSource}
            />

            <SSHStack
              gap="sm"
              style={{ alignItems: 'center', flexWrap: 'wrap' }}
            >
              <SSHStack gap="xxs">
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {inputs.size}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {t('common.of').toLowerCase()}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {account.utxos.length}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {t('common.selected').toLowerCase()}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {t('common.separator')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {t(autoSelectUtxosTitleKey(selectedAutoSelectUtxos))}
                </SSText>
              </SSHStack>
              <SSHStack gap="xs">
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {t('common.total')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(utxosTotalValue, 0, zeroPadding)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {currencyUnit === 'btc'
                    ? t('bitcoin.btc')
                    : t('bitcoin.sats')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(satsToFiat(utxosTotalValue), 2)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            </SSHStack>
            {isUnderfunded ? (
              <SSText
                size="xxs"
                style={{
                  color: warning,
                  marginTop: IO_PREVIEW_UNDERFUNDED_WARNING_MARGIN_TOP_PX
                }}
              >
                {t('transaction.error.insufficientInputs')}
              </SSText>
            ) : null}
            <SSVStack gap="xxs" itemsCenter>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText
                  size="5xl"
                  color="white"
                  weight="ultralight"
                  style={{ lineHeight: 44 }}
                >
                  {formatNumber(utxosSelectedValue, 0, zeroPadding)}
                </SSText>
                <SSText size="lg" color="muted">
                  {currencyUnit === 'btc'
                    ? t('bitcoin.btc')
                    : t('bitcoin.sats')}
                </SSText>
              </SSHStack>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText size="sm" color="muted">
                  {formatNumber(satsToFiat(utxosSelectedValue), 2)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
          </SSVStack>
        </LinearGradient>
      </View>
      {/* Overlay gradient rendered LAST so it's on top */}
      <View
        style={{
          height: topGradientHeight,
          opacity: 0.7,
          pointerEvents: 'none',
          position: 'absolute',
          width: '100%'
        }}
      >
        <LinearGradient
          style={{
            height: topGradientHeight,
            paddingHorizontal: Layout.mainContainer.paddingHorizontal,
            paddingTop: Layout.vStack.gap.sm,
            width: '100%'
          }}
          locations={[0, 0.56, 0.77, 1]}
          colors={['#0A0A0AFF', '#0A0A0A85', '#0A0A0A68', '#0A0A0A00']}
        />
      </View>
      <LinearGradient
        locations={[...IO_PREVIEW_BOTTOM_GRADIENT_LOCATIONS]}
        pointerEvents="box-none"
        style={{
          backgroundColor: Colors.transparent,
          bottom: 0,
          flexDirection: 'row',
          justifyContent: 'center',
          paddingBottom: 20 + insets.bottom,
          paddingTop: IO_PREVIEW_BOTTOM_GRADIENT_EXTEND_PX,
          position: 'absolute',
          width: '100%'
        }}
        colors={[...IO_PREVIEW_BOTTOM_GRADIENT_COLORS]}
      >
        <SSVStack
          gap="xs"
          style={{
            marginTop: -IO_PREVIEW_BOTTOM_GRADIENT_EXTEND_PX,
            paddingHorizontal: Layout.mainContainer.paddingHorizontal,
            width: '100%'
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
          </SSVStack>
          {hasOrphanedInputs && (
            <SSOrphanedInputsBanner
              count={orphanedInputs.length}
              onRemove={() => removeOrphanedInputs(account.utxos)}
            />
          )}
          {dustErrorMessage !== '' && (
            <SSDustWarningBanner message={dustErrorMessage} />
          )}
          <SSVStack gap="xs">
            <SSHStack gap="xs">
              <SSButton
                variant="outline"
                label={t('transaction.build.toolbar.input')}
                style={{ flex: 1 }}
                onPress={() =>
                  router.navigate(
                    `/signer/bitcoin/account/${id}/signAndSend/selectUtxoList`
                  )
                }
              />
              <SSButton
                variant="outline"
                label={t('transaction.build.toolbar.options')}
                style={{ flex: 1 }}
                onPress={() => optionsBottomSheetRef.current?.expand()}
              />
              <SSButton
                variant="outline"
                label={t('transaction.build.toolbar.fee')}
                style={{ flex: 1 }}
                onPress={() => changeFeeBottomSheetRef.current?.expand()}
              />
              <SSButton
                variant="outline"
                label={t('transaction.build.toolbar.output')}
                style={{ flex: 1 }}
                onPress={handleOnPressAddOutput}
              />
            </SSHStack>
            <SSHStack gap="xs">
              <SSButton
                variant="outline"
                label={t('transaction.discard')}
                style={{ flex: 1 }}
                onPress={() => {
                  clearTransaction()
                  router.navigate(`/signer/bitcoin/account/${id}`)
                }}
              />
              <SSButton
                variant="secondary"
                label={
                  outputs.length === 0
                    ? t('transaction.build.add.output.title')
                    : t('sign.transaction')
                }
                style={{ flex: 1 }}
                disabled={hasOrphanedInputs}
                onPress={
                  outputs.length === 0
                    ? handleOnPressAddOutput
                    : handleGoToPreview
                }
              />
            </SSHStack>
          </SSVStack>
        </SSVStack>
      </LinearGradient>
      <SSModal
        visible={addOutputModalVisible}
        onClose={() => setAddOutputModalVisible(false)}
        fullOpacity
      >
        <View style={{ alignSelf: 'center', maxWidth: 1000, width: '100%' }}>
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
                      height: 110,
                      letterSpacing: 0.5,
                      paddingTop: 12,
                      textAlignVertical: 'top'
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
                  blurOnSubmit
                  returnKeyType="done"
                  style={{
                    fontSize: 22,
                    height: 110,
                    paddingTop: 12,
                    textAlignVertical: 'top'
                  }}
                />
                <SSHStack>
                  <SSButton
                    label={t('transaction.build.remove.output.title')}
                    variant="danger"
                    style={{ flex: 1 }}
                    disabled={!currentOutputLocalId}
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
      <SSModal
        fullOpacity
        visible={removeInputModalVisible}
        label=""
        onClose={handleCancelRemoveInput}
      >
        <SSVStack justifyBetween style={{ flex: 1, width: '100%' }}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <SSVStack gap="lg" style={{ alignItems: 'center' }}>
              <SSText uppercase weight="bold">
                {t('transaction.build.remove.input.title')}
              </SSText>
              {inputToRemove ? (
                <SSVStack gap="sm" itemsCenter>
                  <SSText color="muted" center>
                    {inputToRemove.label || t('common.noLabel')}
                  </SSText>
                  <SSText center>
                    {formatAddress(inputToRemove.txid, 8)}:{inputToRemove.vout}
                  </SSText>
                  <SSText center>
                    {formatNumber(inputToRemove.value, 0, zeroPadding)} sats
                  </SSText>
                </SSVStack>
              ) : null}
              <SSText color="muted" center>
                {t('transaction.build.remove.input.message')}
              </SSText>
            </SSVStack>
          </View>
          <SSVStack gap="md">
            <SSButton
              variant="danger"
              label={t('transaction.build.remove.input.confirm')}
              onPress={handleConfirmRemoveInput}
            />
            <SSButton
              variant="ghost"
              label={t('common.cancel')}
              onPress={handleCancelRemoveInput}
            />
          </SSVStack>
        </SSVStack>
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
            <SSHStack gap="xs">
              <SSRadioButton
                variant="outline"
                label={t(autoSelectUtxosTitleKey('user'))}
                selected={selectedAutoSelectUtxos === 'user'}
                style={{ flex: 1 }}
                onPress={handleSelectUserAutoUtxos}
              />
              <SSRadioButton
                variant="outline"
                label={t(autoSelectUtxosTitleKey('privacy'))}
                loading={loadingOptimizeAlgorithm === 'privacy'}
                selected={selectedAutoSelectUtxos === 'privacy'}
                style={{ flex: 1 }}
                onPress={handleSelectPrivacyAutoUtxos}
              />
              <SSRadioButton
                variant="outline"
                label={t(autoSelectUtxosTitleKey('efficiency'))}
                loading={loadingOptimizeAlgorithm === 'efficiency'}
                selected={selectedAutoSelectUtxos === 'efficiency'}
                style={{ flex: 1 }}
                onPress={handleSelectEfficiencyAutoUtxos}
              />
            </SSHStack>
            <SSText color="muted">
              {t(autoSelectUtxosDescriptionKey(selectedAutoSelectUtxos))}
            </SSText>
          </SSVStack>
          <SSVStack>
            <SSHStack>
              <SSButton
                label={t('transaction.build.options.feeControl')}
                variant="outline"
                onPress={() =>
                  router.navigate(
                    `/signer/bitcoin/account/${id}/signAndSend/feeManagement`
                  )
                }
                style={{ flexGrow: 1, width: '45%' }}
              />
              <SSButton
                label={t('transaction.build.options.timelock')}
                variant="outline"
                onPress={() =>
                  router.navigate(
                    `/signer/bitcoin/account/${id}/signAndSend/timeLock`
                  )
                }
                style={{ flexGrow: 1, width: '45%' }}
              />
            </SSHStack>
            <SSButton
              label={t('transaction.build.options.importOutputs.title')}
              variant="outline"
              onPress={() =>
                router.navigate(
                  `/signer/bitcoin/account/${id}/signAndSend/importOutputs`
                )
              }
            />
          </SSVStack>
        </SSVStack>
      </SSBottomSheet>
      <SSBottomSheet
        ref={changeFeeBottomSheetRef}
        title={t('transaction.build.update.fee.title')}
        paddingX={false}
      >
        <SSVStack
          style={{
            marginHorizontal: Layout.mainContainer.paddingHorizontal,
            paddingBottom: 24
          }}
        >
          <SSFeeRateChart
            mempoolStatistics={mempoolStatistics}
            timeRange="2hours"
          />
          <SSFeeInput
            value={localFeeRate}
            onValueChange={setLocalFeeRate}
            vbytes={transactionSize.vsize}
            max={40}
            estimatedBlock={Math.trunc(40 / localFeeRate)}
            fiatCurrency={fiatCurrency}
            satsToFiat={satsToFiat}
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
      <SSCameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        onContentScanned={handleContentScanned}
        context="bitcoin"
      />
      <SSModal
        fullOpacity
        visible={dustChangeModalVisible}
        label=""
        onClose={() => setDustChangeModalVisible(false)}
      >
        <SSVStack justifyBetween style={{ flex: 1, width: '100%' }}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <SSVStack gap="lg" style={{ alignItems: 'center' }}>
              <SSText uppercase weight="bold">
                {t('transaction.dustChange.title')}
              </SSText>
              <SSText color="muted" center>
                {t('transaction.dustChange.description', {
                  amount: pendingDustAmount
                })}
              </SSText>
            </SSVStack>
          </View>
          <SSVStack gap="md">
            <SSButton
              variant="secondary"
              label={t('transaction.dustChange.addToFee')}
              onPress={handleDustToFee}
            />
            <SSButton
              variant="outline"
              label={t('transaction.dustChange.addToOutputs')}
              onPress={handleDustToOutputs}
            />
            <SSButton
              variant="ghost"
              label={t('common.cancel')}
              onPress={() => setDustChangeModalVisible(false)}
            />
          </SSVStack>
        </SSVStack>
      </SSModal>
    </View>
  )
}
