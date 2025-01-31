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
import SSSankeyDiagram, { Node } from '@/components/SSSankeyDiagram'
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

function useInputTransactions(inputs: Map<string, Utxo>, depth: number = 2) {
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
      const queue = Array.from(inputs.values()).map((input) => input.txid)
      const processed = new Set<string>()
      let currentDepth = 0

      while (currentDepth < depth && queue.length > 0) {
        const currentLevelTxids = [...queue]
        queue.length = 0 // Clear the queue for the next level

        await Promise.all(
          currentLevelTxids.map(async (txid) => {
            if (processed.has(txid)) return
            processed.add(txid)

            const tx = (await oracle.getTransaction(txid)) as EsploraTx
            newTransactions.set(txid, tx)

            // Collect parent txids for next level
            if (tx.vin) {
              tx.vin.forEach((vin) => {
                const parentTxid = vin.txid
                if (
                  parentTxid &&
                  !processed.has(parentTxid) &&
                  !queue.includes(parentTxid)
                ) {
                  queue.push(parentTxid)
                }
              })
            }
          })
        )

        currentDepth++
      }

      setTransactions(new Map([...newTransactions.entries()].reverse()))
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch transactions')
      )
    } finally {
      setLoading(false)
    }
  }, [inputs, depth])

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

function getBlockDepth(size: number, currentIndex: number) {
  const group = Math.floor(currentIndex / size)
  return 1 + 2 * group
}
const txLevel = 3

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

  const { transactions, loading, error } = useInputTransactions(inputs, txLevel)

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

  const ingoingNodes = useMemo(() => {
    if (inputs.size > 0) {
      const { size, vsize } = estimateTransactionSize(
        inputs.size,
        outputs.length + 2
      )

      const blockDepth = txLevel * 2 + 1
      const blockNode = [
        {
          id: `block-${blockDepth}-0`,
          type: 'block',
          depthH: blockDepth,
          value: 0,
          textInfo: ['', '', `${size} B`, `${Math.ceil(vsize)} vB`]
        }
      ]

      const miningFee = `${MINING_FEE_VALUE}`
      const priority = '42 sats/vB'
      const outputNodes = [
        {
          id: `vout-${txLevel * 2 + 2}-0`,
          type: 'text',
          depthH: txLevel * 2 + 2,
          textInfo: [
            'Unspent',
            `${utxosSelectedValue - MINING_FEE_VALUE}`,
            'to'
          ],
          value: utxosSelectedValue - MINING_FEE_VALUE
        },
        {
          id: `vout-${txLevel * 2 + 2}-1`,
          type: 'text',
          depthH: txLevel * 2 + 2,
          textInfo: [priority, miningFee, 'mining fee'],
          value: MINING_FEE_VALUE
        }
      ]
      return [...blockNode, ...outputNodes]
    } else {
      return []
    }
  }, [inputs.size, outputs.length, utxosSelectedValue])

  // Get all output values at once using flatMap
  const outputAddresses = Array.from(transactions.values()).flatMap(
    (tx) => tx.vout?.map((output) => output.scriptpubkey_address) ?? []
  )

  const incomingAndOutgoingVinTxId = Array.from(transactions.values()).flatMap(
    (tx) =>
      tx.vin
        .filter((input) => {
          return outputAddresses.includes(input.prevout.scriptpubkey_address)
        })
        .map((input) => ({
          txid: `${tx.txid}`,
          prevValue: input.prevout.value
        }))
  )

  const confirmedNodes: Node[] = useMemo(() => {
    if (transactions.size > 0 && inputs.size > 0) {
      const previousNodes = Array.from(transactions.entries()).flatMap(
        ([, tx], index) => {
          if (!tx.vin || !tx.vout) return []

          // Filter input nodes to exclude those with matching values
          const allInputNodes = tx.vin
            .filter((input) => {
              return !outputAddresses.includes(
                input.prevout.scriptpubkey_address
              )
            })
            .map((input, idx) => {
              const depth = 0
              return {
                id: `vin-${depth}-${index + idx}`,
                type: 'text',
                depthH: depth,
                textInfo: [
                  `${input.prevout.value}`,
                  `${formatAddress(input.prevout.scriptpubkey_address, 6)}`,
                  ''
                ],
                value: input.prevout.value,
                txId: tx.txid
              }
            })

          const vsize = Math.ceil(tx.weight * 0.25)

          const blockDepth = getBlockDepth(inputs.size, index)

          const blockNode = [
            {
              id: `block-${blockDepth}`,
              type: 'block',
              depthH: blockDepth,
              textInfo: ['', '', `${tx.size} B`, `${vsize} vB`], //TODO: check the size value
              txId: tx.txid
            }
          ]

          const outputNodes = tx.vout.map((output) => {
            const outputDepth = getBlockDepth(inputs.size, index) + 1

            return {
              id: `vout-${outputDepth}`,
              type: 'text',
              depthH: outputDepth,
              textInfo: [
                `${output.value}`,
                `${formatAddress(output.scriptpubkey_address, 6)}`,
                ''
              ],
              value: output.value,
              txId: tx.txid,
              nextTx:
                incomingAndOutgoingVinTxId.find(
                  ({ prevValue }) => prevValue === output.value
                )?.txid ?? ''
            }
          })

          return [...allInputNodes, ...blockNode, ...outputNodes].sort(
            (a, b) => a.depthH - b.depthH
          )
        }
      )

      const depthIndices: { [key: number]: number } = {} // Keeps track of current index for each depth
      return previousNodes.map(({ id, depthH, ...rest }) => {
        // Initialize index if this depth hasn't been seen yet
        if (!(depthH in depthIndices)) {
          depthIndices[depthH] = 0
        }

        return {
          id:
            id.startsWith('vout') || id.startsWith('block')
              ? `${id}-${depthIndices[depthH]++}`
              : `${id}`,
          depthH,
          ...rest
        }
      })
    }
    return []
  }, [incomingAndOutgoingVinTxId, inputs.size, outputAddresses, transactions])

  const allNodes = [...confirmedNodes, ...ingoingNodes].sort(
    (a, b) => a.depthH - b.depthH
  )

  const links = useMemo(() => {
    function generateSankeyLinks(nodes: Node[]) {
      const links = []
      const depthMap = new Map()

      // Group nodes by their depth for efficient lookup
      nodes.forEach((node: Node) => {
        const depth = node.depthH
        if (!depthMap.has(depth)) {
          depthMap.set(depth, [])
        }
        depthMap.get(depth).push(node)
      })

      // Process each node to generate links
      nodes.forEach((node: Node) => {
        if (node.type === 'text' && node.depthH === 0) {
          // Handle vin nodes (depth 0) linking to block in next depth
          const nextDepthNodes = depthMap.get(node.depthH + 1) || []
          const targetBlock = nextDepthNodes.find(
            (n: Node) => n.type === 'block' && n.txId === node.txId
          )
          if (targetBlock) {
            links.push({
              source: node.id,
              target: targetBlock.id,
              value: node.value
            })
          }
        } else if (node.type === 'block') {
          // Handle block nodes linking to vouts in next depth with same txId
          const nextDepthNodes = depthMap.get(node.depthH + 1) || []
          const vouts = nextDepthNodes.filter(
            (n: Node) => n.type === 'text' && n.txId === node.txId
          )
          vouts.forEach((vout: Node) => {
            links.push({ source: node.id, target: vout.id, value: vout.value })
          })
        } else if (node.type === 'text' && node.depthH > 0 && node.nextTx) {
          // Handle vout nodes with nextTx linking to block in next depth
          const nextDepthNodes = depthMap.get(node.depthH + 1) || []
          const targetBlock = nextDepthNodes.find(
            (n: Node) => n.type === 'block' && n.txId === node.nextTx
          )
          if (targetBlock) {
            links.push({
              source: node.id,
              target: targetBlock.id,
              value: node.value
            })
          }
        } else if (
          node.type === 'text' &&
          node.depthH === txLevel * 2 &&
          Array.from(inputs.values())
            .map((input) => input.value)
            .includes(node?.value ?? 0)
        ) {
          const targetBlock = ingoingNodes[0].id
          if (targetBlock) {
            links.push({
              source: node.id,
              target: targetBlock,
              value: node.value
            })
          }
        }
      })
      links.push({
        source: ingoingNodes[0].id,
        target: ingoingNodes[1].id,
        value: ingoingNodes[1]?.value ?? 0
      })

      links.push({
        source: ingoingNodes[0].id,
        target: ingoingNodes[2].id,
        value: ingoingNodes[2]?.value ?? 0
      })
      return links
    }
    if (allNodes?.length === 0) return []

    return generateSankeyLinks(confirmedNodes)
  }, [allNodes?.length, confirmedNodes, ingoingNodes, inputs])

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
