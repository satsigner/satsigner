import { CameraView, useCameraPermissions } from 'expo-camera/next'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import type { EsploraTx } from '@/api/esplora'
import { SSIconBubbles } from '@/components/icons'
import ScanIcon from '@/components/icons/ScanIcon'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSSankeyDiagram from '@/components/SSSankeyDiagram'
import SSSlider from '@/components/SSSlider'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Layout } from '@/styles'
import type { Utxo } from '@/types/models/Utxo'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress, formatNumber } from '@/utils/format'

function useInputTransactions(inputs: Map<string, Utxo>) {
  const [transactions, setTransactions] = useState<Map<string, EsploraTx>>(
    new Map()
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchInputTransactions = useCallback(async () => {
    if (inputs.size === 0) return

    setLoading(true)
    setError(null)
    const oracle = new MempoolOracle('https://mutinynet.com/api')
    const newTransactions = new Map<string, EsploraTx>()

    try {
      const inputsArray = Array.from(inputs.entries())
      await Promise.all(
        inputsArray.map(async ([, input]) => {
          try {
            const tx = (await oracle.getTransaction(input.txid)) as EsploraTx
            newTransactions.set(input.txid, tx)
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Error fetching transaction:', input.txid, err)
          }
        })
      )
      setTransactions(newTransactions)
      // Log transactions with vin or vout length > 0
      newTransactions.forEach((tx, txid) => {
        if ((tx.vin && tx.vin.length > 0) || (tx.vout && tx.vout.length > 0)) {
          console.log('Transaction with inputs/outputs:', txid, tx)
        }
      })
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch transactions')
      )
    } finally {
      setLoading(false)
    }
  }, [inputs])

  useEffect(() => {
    fetchInputTransactions()
  }, [fetchInputTransactions])

  return { transactions, loading, error }
}

const MINING_FEE_VALUE = 1635

function estimateTransactionSize(inputCount: number, outputCount: number) {
  // Base transaction size (version + locktime)
  const baseSize = 10
  // Each input is roughly 148 bytes (outpoint[36] + script[~108] + sequence[4])
  const inputSize = inputCount * 148
  // Each output is roughly 34 bytes (value[8] + script[~26])
  const outputSize = outputCount * 34

  const totalSize = baseSize + inputSize + outputSize
  // Virtual size is weight/4
  const vsize = Math.ceil(totalSize * 0.25)

  return { size: totalSize, vsize }
}

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

  const { transactions, loading, error } = useInputTransactions(inputs)

  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const account = getCurrentAccount(id!)! // Make use of non-null assertion operator for now

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

  const sankeyNodes = useMemo(() => {
    if (inputs.size > 0) {
      const inputNodes = Array.from(inputs.entries()).map(
        ([, input], index) => ({
          id: String(index + 1),
          // indexC: index + 1,
          type: 'text',
          depthH: 1,
          textInfo: [
            `${input.value}`,
            `${formatAddress(input.txid, 3)}`,
            input.label ?? ''
          ],
          value: input.value
        })
      )

      const { size, vsize } = estimateTransactionSize(
        inputs.size,
        outputs.length + 2
      )

      const blockNode = [
        {
          id: String(inputs.size + 1),
          // indexC: inputs.size + 1,
          type: 'block',
          depthH: 2,
          textInfo: ['', '', `${size} B`, `${Math.ceil(vsize)} vB`]
        }
      ]

      const miningFee = `${MINING_FEE_VALUE}`
      const priority = '42 sats/vB'
      const outputNodes = [
        {
          id: String(inputs.size + 2),
          // indexC: inputs.size + 2,
          type: 'text',
          depthH: 3,
          textInfo: [
            'Unspent',
            `${utxosSelectedValue - MINING_FEE_VALUE}`,
            'to'
          ],
          value: utxosSelectedValue - MINING_FEE_VALUE
        },
        {
          id: String(inputs.size + 3),
          // indexC: inputs.size + 3,
          type: 'text',
          depthH: 3,
          textInfo: [priority, miningFee, 'mining fee'],
          value: MINING_FEE_VALUE
        }
      ]
      return [...inputNodes, ...blockNode, ...outputNodes]
    } else {
      return []
    }
  }, [inputs, outputs.length, utxosSelectedValue])

  const confirmedSankeyNodes = useMemo(() => {
    if (transactions.size > 0) {
      return Array.from(transactions.entries()).flatMap(([txid, tx]) => {
        const inputNodes =
          tx.vin?.map((input, idx) => ({
            id: `vin-${txid}-${idx}`,
            type: 'text',
            depthH: 1,
            textInfo: [
              `${input.prevout.value}`,
              `${formatAddress(input.prevout.scriptpubkey_address, 6)}`,
              ''
            ],
            value: input.prevout.value
          })) ?? []

        const vsize = Math.ceil(tx.weight * 0.25)

        const blockNode = [
          {
            id: `block-${txid}`,
            type: 'block',
            depthH: 2,
            textInfo: ['', '', `${tx.size} B`, `${vsize} vB`]
          }
        ]

        const outputNodes =
          tx.vout?.map((output, idx) => ({
            id: `vout-${txid}-${idx}`,
            type: 'text',
            depthH: 3,
            textInfo: [
              `${output.value}`,
              `${formatAddress(output.scriptpubkey_address, 6)}`,
              ''
            ],
            value: output.value
          })) ?? []

        return [...inputNodes, ...blockNode, ...outputNodes]
      })
    }
    return []
  }, [transactions])

  const confirmedSankeyLinks = useMemo(() => {
    if (transactions.size === 0) return []

    const txLinks = Array.from(transactions.entries()).flatMap(([txid, tx]) => {
      const inputToBlockLinks =
        tx.vin?.map((input, idx) => ({
          source: `vin-${txid}-${idx}`,
          target: `block-${txid}`,
          value: input.prevout.value
        })) ?? []

      const blockToOutputLinks =
        tx.vout?.map((output, idx) => ({
          source: `block-${tx.txid}`,
          target: `vout-${tx.txid}-${idx}`,
          value: output.value
        })) ?? []

      return [...inputToBlockLinks, ...blockToOutputLinks]
    })

    return txLinks
  }, [transactions])

  const sankeyLinks = useMemo(() => {
    if (inputs.size === 0) return []

    const inputToBlockLinks = Array.from(inputs.entries()).map(
      ([, input], index) => ({
        source: String(index + 1),
        target: String(inputs.size + 1),
        value: input.value
      })
    )

    const blockToOutputLinks = [
      {
        source: String(inputs.size + 1),
        target: String(inputs.size + 2),
        value: utxosSelectedValue - MINING_FEE_VALUE
      },
      {
        source: String(inputs.size + 1),
        target: String(inputs.size + 3),
        value: MINING_FEE_VALUE
      }
    ]

    return [...inputToBlockLinks, ...blockToOutputLinks]
  }, [inputs, utxosSelectedValue])

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
  console.log('testing', {
    sankeyLinks,
    sankeyNodes,
    confirmedSankeyLinks,
    confirmedSankeyNodes
  })

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
              {i18n.t('signAndSend.selectSpendableOutputs')}
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
      </LinearGradient>
      <View style={{ position: 'absolute', top: 80 }}>
        <SSSankeyDiagram
          sankeyNodes={
            transactions.size > 0 ? confirmedSankeyNodes : sankeyNodes
          }
          sankeyLinks={
            transactions.size > 0 ? confirmedSankeyLinks : sankeyLinks
          }
          inputCount={inputs.size ?? 0}
        />
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
      </LinearGradient>
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
    </GestureHandlerRootView>
  )
}
