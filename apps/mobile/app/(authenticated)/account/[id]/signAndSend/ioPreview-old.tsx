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

const txLevel = 2

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

            try {
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
            } catch (err) {
              console.error('Error fetching transaction:', txid, err)
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

  return { estimatedSize: totalSize, estimatedVsize: vsize }
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

  const pendingInputNodes = useMemo(() => {
    if (inputs.size === 0) return []
    return Array.from(inputs.entries()).map(([, input], index) => ({
      value: input.value
    }))
  }, [inputs])

  const lastTxNodes = useMemo(() => {
    if (inputs.size > 0) {
      const { estimatedSize, estimatedVsize } = estimateTransactionSize(
        inputs.size,
        outputs.length + 2
      )

      const blockNode = [
        {
          id: String(inputs.size + 1),
          type: 'block',
          depth: txLevel * 2 + 1,
          textInfo: ['', '', `${estimatedSize} B`, `${estimatedVsize} vB`]
        }
      ]

      const miningFee = `${MINING_FEE_VALUE}`
      const priority = '42 sats/vB'
      const outputNodes = [
        {
          id: String(inputs.size + 2),
          type: 'text',
          depth: txLevel * 2 + 2,
          textInfo: [
            'Unspent',
            `${utxosSelectedValue - MINING_FEE_VALUE}`,
            'to'
          ],
          value: utxosSelectedValue - MINING_FEE_VALUE
        },
        {
          id: String(inputs.size + 3),
          type: 'text',
          depth: txLevel * 2 + 2,
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
  // const outputValues = Array.from(transactions.values()).flatMap(
  //   (tx) => tx.vout?.map((output) => output.value) ?? []
  // )

  console.log({ transactions, inputs })

  const nodes = useMemo(() => {
    if (transactions.size > 0 && inputs.size > 0) {
      const nodes: Node[] = []
      const nodeMap = new Map() // To avoid duplicate nodes

      const txArray = Array.from(transactions.values())

      // Depth 0: vin nodes (initial inputs)
      txArray.forEach((tx, txIndex) => {
        tx.vin?.forEach((vin, vinIndex) => {
          const nodeId = `vin-0-${vinIndex}`
          if (!nodeMap.has(nodeId)) {
            nodes.push({
              id: nodeId,
              depthH: 0,
              value: vin.prevout?.value ?? 0,
              type: 'text',
              textInfo: [
                `${vin.prevout.value}`,
                `${formatAddress(vin.prevout.scriptpubkey_address, 6)}`,
                ''
              ]
            })
            nodeMap.set(nodeId, true)
          }
        })
      })

      // Depth 1, 3, 5: block nodes (transactions) and Depth 2, 4: vout nodes (transaction outputs)
      let currentDepth = 1
      let txToProcess = [...txArray]
      const processedTxIds = new Set()

      while (txToProcess.length > 0) {
        const nextTxToProcess: EsploraTx[] = []

        txToProcess.forEach((tx, txIndex) => {
          if (processedTxIds.has(tx.txid)) return // Skip already processed tx

          const blockNodeId = `block-${currentDepth}-${txIndex}`
          const vsize = Math.ceil(tx.weight * 0.25)

          const { estimatedSize, estimatedVsize } = estimateTransactionSize(
            inputs.size,
            outputs.length + 2
          )
          if (!nodeMap.has(blockNodeId)) {
            nodes.push({
              id: blockNodeId,
              depthH: currentDepth,
              type: 'block',
              textInfo: [
                '',
                '',
                `${tx?.size || estimatedSize} B`,
                `${vsize || estimatedVsize} vB`
              ]
            })
            nodeMap.set(blockNodeId, true)
          }

          tx.vout.forEach((vout, voutIndex) => {
            const voutNodeId = `vout-${currentDepth + 1}-${voutIndex}`
            if (!nodeMap.has(voutNodeId)) {
              nodes.push({
                id: voutNodeId,
                depthH: currentDepth + 1,
                type: 'text',
                textInfo: [
                  `${vout.value}`,
                  `${formatAddress(vout.scriptpubkey_address, 6)}`,
                  ''
                ]
              })
              nodeMap.set(voutNodeId, true)
            }
          })
          processedTxIds.add(tx.txid)

          // Find next transactions that use these vouts as vins
          txArray.forEach((nextTx) => {
            nextTx.vin.forEach((vin) => {
              if (tx.txid === vin.txid) {
                // if nextTx vin is current txid, then nextTx depends on current tx
                if (
                  !processedTxIds.has(nextTx.txid) &&
                  !nextTxToProcess.includes(nextTx)
                ) {
                  nextTxToProcess.push(nextTx)
                }
              }
            })
          })
        })
        txToProcess = nextTxToProcess
        currentDepth += 2 // Increment depth by 2 for block -> vout -> block progression
      }

      // Depth 6: unspent and transaction fee (assuming last block is block-5-0 in the image)
      const lastBlockNode = nodes.find((node) => node.id === 'block-5-0') // Find the last block node, adjust 'block-5-0' if needed
      if (lastBlockNode) {
        const unspentNodeId = 'unspent'
        if (!nodeMap.has(unspentNodeId)) {
          nodes.push({
            id: unspentNodeId,
            depthH: 6,
            type: 'text',
            textInfo: [
              'Unspent',
              `${utxosSelectedValue - MINING_FEE_VALUE}`,
              'to'
            ],
            value: utxosSelectedValue - MINING_FEE_VALUE
          })
          nodeMap.set(unspentNodeId, true)
        }

        const feeNodeId = 'estimated-fee'
        const miningFee = `${MINING_FEE_VALUE}`
        const priority = '42 sats/vB'
        if (!nodeMap.has(feeNodeId)) {
          nodes.push({
            id: feeNodeId,
            depthH: 6,
            textInfo: [priority, miningFee, 'mining fee'],
            value: MINING_FEE_VALUE,
            type: 'fee'
          })
          nodeMap.set(feeNodeId, true)
        }
      }

      return nodes
    }
    return []
  }, [inputs.size, outputs.length, transactions, utxosSelectedValue])

  const confirmedSankeyLinks = useMemo(() => {
    if (transactions.size === 0) return []

    const links = []
    const nodeMapById = new Map(nodes.map((node) => [node.id, node]))

    const txArray = Array.from(transactions.values())

    // Links from vin nodes (depth 0) to block nodes (depth 1)
    txArray.forEach((tx, txIndex) => {
      tx.vin.forEach((vin, vinIndex) => {
        const sourceId = `vin-0-${vinIndex}`
        const targetId = `block-1-${txIndex}` // Assuming first level transactions are depth 1 blocks

        const sourceNode = nodeMapById.get(sourceId)
        const targetNode = nodeMapById.get(targetId)

        if (sourceNode && targetNode) {
          links.push({
            source: sourceNode,
            target: targetNode,
            value: vin.prevout.value
          })
        }
      })
    })

    let currentDepth = 1
    let txToProcess = [...txArray]
    const processedTxIds = new Set()

    while (txToProcess.length > 0) {
      const nextTxToProcess: EsploraTx[] = []

      txToProcess.forEach((tx, txIndex) => {
        if (processedTxIds.has(tx.txid)) return

        const sourceBlockId = `block-${currentDepth}-${txIndex}`
        tx.vout.forEach((vout, voutIndex) => {
          const targetVoutId = `vout-${currentDepth + 1}-${voutIndex}`

          const sourceNode = nodeMapById.get(sourceBlockId)
          const targetNode = nodeMapById.get(targetVoutId)

          if (sourceNode && targetNode) {
            links.push({
              source: sourceNode,
              target: targetNode,
              value: vout.value
            })
          }
        })
        processedTxIds.add(tx.txid)

        transactions.forEach((nextTx) => {
          nextTx.vin.forEach((vin) => {
            if (tx.txid === vin.txid) {
              if (
                !processedTxIds.has(nextTx.txid) &&
                !nextTxToProcess.includes(nextTx)
              ) {
                const sourceVoutPrefix = `vout-${currentDepth + 1}` // Vout from previous depth is source
                const targetBlockId = `block-${currentDepth + 2}-${txArray.indexOf(nextTx)}` // Next block is target

                // Find the corresponding vout index based on txid and vout index in vin
                let sourceVoutIndex = -1
                tx.vout.forEach((txVout, index) => {
                  // In real world, you would compare tx output index to vin.vout, but here we just assume order is consistent for simplicity based on the example.
                  sourceVoutIndex = index
                })
                const sourceVoutId = `${sourceVoutPrefix}-${sourceVoutIndex}`

                const sourceVoutNode = nodeMapById.get(sourceVoutId)
                const targetBlockNode = nodeMapById.get(targetBlockId)

                if (sourceVoutNode && targetBlockNode) {
                  links.push({
                    source: sourceVoutNode,
                    target: targetBlockNode,
                    value: vin.prevout.value // or vout.value from previous tx, should be the same
                  })
                }
                nextTxToProcess.push(nextTx)
              }
            }
          })
        })
      })
      txToProcess = nextTxToProcess
      currentDepth += 2
    }

    // Links from last block (block-5-0) to unspent and transaction fee
    const lastBlockNode = nodes.find((node) => node.id === 'block-5-0')
    const unspentNode = nodeMapById.get('unspent')
    const feeNode = nodeMapById.get('estimated-fee')

    if (lastBlockNode && unspentNode && feeNode) {
      // Assuming transaction fee is the sum of fees from all transactions for simplicity in this example.
      // In a real scenario, fee would be attributed to the transaction that created the 'transaction fee' output (if explicitly represented).
      const totalFee = txArray.reduce((sum, tx) => sum + tx.fee, 0)

      // Assuming 'unspent' takes the remaining value from the last block's outputs (this is a simplification)
      let lastBlockOutputValue = 0
      txArray.slice(-1)[0].vout.forEach((vout) => {
        // Taking last tx's vouts as example, adjust logic based on actual 'unspent' definition
        lastBlockOutputValue += vout.value
      })

      links.push({
        source: lastBlockNode,
        target: unspentNode,
        value: lastBlockOutputValue // Placeholder, adjust based on what 'unspent' represents
      })
      links.push({
        source: lastBlockNode,
        target: feeNode,
        value: totalFee // Placeholder, adjust based on how 'transaction fee' is represented
      })
    }

    return links
  }, [transactions, nodes])

  // console.log('TX', Array.from(transactions.values()))
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

  const allNodes = [...nodes]
  const allLinks = confirmedSankeyLinks
  console.log('TX', transactions)
  console.log('nodes', nodes)
  console.log('links', confirmedSankeyLinks)

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
        allNodes.length > 0 &&
        allLinks.length > 0 ? (
          <SSSankeyDiagram
            sankeyNodes={allNodes}
            sankeyLinks={allLinks}
            inputCount={inputs.size}
          />
        ) : null}
      </View>
      {/* <LinearGradient
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
      </LinearGradient> */}
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
