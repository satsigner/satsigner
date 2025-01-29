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

  return { size: totalSize, vsize }
}

function getBlockDepth(size: number, currentIndex: number) {
  const group = Math.floor(currentIndex / size)
  return 1 + 2 * group
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
  const txlevel = 2
  const { transactions, loading, error } = useInputTransactions(inputs, txlevel)

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

  const sankeyNodes = useMemo(() => {
    if (inputs.size > 0) {
      const { size, vsize } = estimateTransactionSize(
        inputs.size,
        outputs.length + 2
      )

      const blockDepth = txlevel * 2 + 1
      const blockNode = [
        {
          id: `block-${blockDepth}-0`,
          type: 'block',
          depth: blockDepth,
          textInfo: ['', '', `${size} B`, `${Math.ceil(vsize)} vB`]
        }
      ]

      const miningFee = `${MINING_FEE_VALUE}`
      const priority = '42 sats/vB'
      const outputNodes = [
        {
          id: String(inputs.size + 2),
          type: 'text',
          depth: blockDepth + 1,
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
          depth: txlevel * 2 + 2,
          textInfo: [priority, miningFee, 'mining fee'],
          value: MINING_FEE_VALUE
        }
      ]
      return [...blockNode, ...outputNodes]
    } else {
      return []
    }
  }, [inputs.size, outputs.length, utxosSelectedValue])

  const outputsArray = Array.from(transactions.values()).flatMap(
    (tx) => tx.vout ?? []
  )
  // Get all output values at once using flatMap
  const outputAddresses = Array.from(transactions.values()).flatMap(
    (tx) => tx.vout?.map((output) => output.scriptpubkey_address) ?? []
  )

  const confirmedSankeyNodes: Node[] = useMemo(() => {
    // const totalLengthVins = Array.from(transactions.values()).reduce(
    //   (sum, tx) => sum + (tx.vin?.length ?? 0),
    //   0
    // )
    // const totalLengthVouts = Array.from(transactions.values()).reduce(
    //   (sum, tx) => sum + (tx.vout?.length ?? 0),
    //   0
    // )
    if (transactions.size > 0 && inputs.size > 0) {
      console.log('__start')
      return Array.from(transactions.entries()).flatMap(([, tx], index) => {
        if (!tx.vin || !tx.vout) return []
        const inputDepth =
          index < inputs.size
            ? 0
            : Math.floor(index / inputs.size) * inputs.size
        // const inputIndexInDepth = index % inputs.size
        // Filter input nodes to exclude those with matching values
        const allInputNodes = tx.vin
          .filter((input) => {
            return !outputAddresses.includes(input.prevout.scriptpubkey_address)
          })
          .map((input, idx) => {
            const depth = 0
            return {
              id: `vin-${depth}-${index + idx}`,
              type: 'text',
              depth,
              textInfo: [
                `${input.prevout.value}`,
                `${formatAddress(input.prevout.scriptpubkey_address, 6)}`,
                ''
              ],
              value: input.prevout.value
            }
          })
        // console.log('allInputNodes', allInputNodes)

        // only keep input nodes that do not have outgoing and incoming links
        // const trimmedInputNodes = allInputNodes.filter(
        //   (input) => !outputAddresses.includes(input.address)
        // )

        const vsize = Math.ceil(tx.weight * 0.25)

        // const totalVins = allInputNodes.length

        const blockDepth = getBlockDepth(inputs.size, index)
        // const blockIndex =
        const blockNode = [
          {
            id: `block-${blockDepth}`,
            type: 'block',
            depth: blockDepth,
            textInfo: ['', '', `${tx.size} B`, `${vsize} vB`] //TODO: check the size value
          }
        ]

        // console.log('blockNode', blockNode)
        // const outputIndexInDepth = index % totalLengthVouts
        const outputNodes = tx.vout.map((output, idx) => {
          const outputDepth = getBlockDepth(inputs.size, index) + 1

          return {
            id: `vout-${outputDepth}`,
            type: 'text',
            depth: outputDepth,
            textInfo: [
              `${output.value}`,
              `${formatAddress(output.scriptpubkey_address, 6)}`,
              ''
            ],
            value: output.value
          }
        })

        // console.log('outputNodes', outputNodes)

        return [...allInputNodes, ...blockNode, ...outputNodes].sort(
          (a, b) => a.depth - b.depth
        )
      })
    }
    return []
  }, [inputs.size, outputAddresses, transactions])
  console.log('confirmedSankeyNodes->>', confirmedSankeyNodes)

  const realNodes: Node[] = useMemo(() => {
    if (confirmedSankeyNodes.length === 0) return []
    const depthIndices: { [key: number]: number } = {} // Keeps track of current index for each depth
    return confirmedSankeyNodes.map(({ id, depth, ...rest }) => {
      // Initialize index if this depth hasn't been seen yet
      if (!(depth in depthIndices)) {
        depthIndices[depth] = 0
      }

      return {
        id:
          id.startsWith('vout') || id.startsWith('block')
            ? `${id}-${depthIndices[depth]++}`
            : `${id}`,
        depth,
        ...rest
      }
    })
  }, [confirmedSankeyNodes])

  const allNodes = [...sankeyNodes, ...realNodes].sort(
    (a, b) => a.depth - b.depth
  )

  // const getCircularReplacer = () => {
  //   const seen = new WeakSet()
  //   return (key, value) => {
  //     if (typeof value === 'object' && value !== null) {
  //       if (seen.has(value)) return '[Circular]'
  //       seen.add(value)
  //     }
  //     return value
  //   }
  // }

  // console.log(JSON.stringify(allNodes, getCircularReplacer(), 2)) // Pretty-printed

  const links = useMemo(() => {
    return []
    const nodes = allNodes

    const links = []
    const depthGroups = {}

    // Group nodes by their depth and sort them by ID
    nodes.forEach((node) => {
      if (!depthGroups[node.depth]) depthGroups[node.depth] = []
      depthGroups[node.depth].push(node)
    })

    // Sort each depth group by node ID
    Object.values(depthGroups).forEach((group) => {
      group.sort((a, b) => a.id.localeCompare(b.id))
    })

    // Create connections between depths
    for (let depth = 0; depth <= 5; depth++) {
      const currentNodes = depthGroups[depth] || []
      const nextDepthNodes = depthGroups[depth + 1] || []

      if (depth % 2 === 0) {
        // Even depth (text nodes)
        currentNodes.forEach((node, i) => {
          if (nextDepthNodes[i]) {
            links.push({
              source: node.id,
              target: nextDepthNodes[i].id,
              value: node.value
            })
          }
        })
      } else {
        // Odd depth (block nodes)
        currentNodes.forEach((node, i) => {
          const targets = nextDepthNodes.slice(i * 2, i * 2 + 2)
          targets.forEach((target) => {
            links.push({
              source: node.id,
              target: target.id,
              value: node.value
            })
          })
        })
      }
    }

    return links
  }, [allNodes])

  const confirmedSankeyLinks = useMemo(() => {
    // if (transactions.size === 0) return []
    if (true) return []

    const txLinks = Array.from(transactions.entries()).flatMap(
      ([, tx], index) => {
        if (!tx.vin || !tx.vout) return []

        // Get all output values at once using flatMap

        const inputToBlockLinks = tx.vin
          .filter(
            (input) =>
              !outputAddresses.includes(input.prevout.scriptpubkey_address)
          )
          .map((input, idx) => ({
            source: `vin-${index}-${idx}`,
            target: `block-${index}`,
            value: input.prevout.value
          }))
        console.log('inputToBlockLinks', inputToBlockLinks)

        const blockToOutputLinks = tx.vout.map((output, idx) => ({
          source: `block-${index}`,
          target: `vout-${index}-${idx}`,
          value: output.value
        }))

        const sameIndexForConfirmed = tx.vout.findIndex((output) => {
          // console.log(
          //   'array of value',
          //   Array.from(transactions.values()).find((tx) =>
          //     tx.vin.some((vin) => vin.prevout.value === output.value)
          //   )
          // )
          const found =
            output.value ===
            Array.from(transactions.values())
              .find((tx) =>
                tx.vin.some((vin) => vin.prevout.value === output.value)
              )
              ?.vin.find((vin) => vin.prevout.value === output.value)?.prevout
              .value
          console.log('found with same index', found, output.value)
          return found
        })

        // const blockToOutputLinksConfirmed = tx.vout.map((output, idx) => ({
        //   source: `block-${index}`,
        //   target: `vout-${index}-${sameIndexForConfirmed}`,
        //   value: output.value
        // }))

        const outputToBlockLinks =
          sameIndexForConfirmed !== -1
            ? [
                {
                  source: `vout-${index}-${sameIndexForConfirmed}`,
                  target: `block-${index + 1}`,
                  value: tx.vout[sameIndexForConfirmed].value
                }
              ]
            : []

        console.log('sameIndexForConfirmed', {
          sameIndexForConfirmed,
          index,
          outputToBlockLinks
        })

        const sameIndex = tx.vout.findIndex(
          (o) =>
            o.value ===
            pendingInputNodes.find((node) => node.value === o.value)?.value
        )

        const confirmedToPendingLinks =
          sameIndex !== -1
            ? [
                {
                  source: `vout-${index}-${sameIndex}`,
                  target: `${inputs.size + 1}`,
                  value: tx.vout[sameIndex].value
                }
              ]
            : []

        return [
          ...inputToBlockLinks,
          ...blockToOutputLinks,
          ...confirmedToPendingLinks,
          ...outputToBlockLinks
          // ...completedInputToCompletedLink
        ]
      }
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

    return [...txLinks, ...blockToOutputLinks]
  }, [
    transactions,
    inputs.size,
    utxosSelectedValue,
    outputAddresses,
    pendingInputNodes
  ])
  console.log('TX', Array.from(transactions.values()))
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

  console.log('nodes', allNodes)
  console.log('links', links)

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
        links.length > 0 ? (
          <SSSankeyDiagram
            sankeyNodes={allNodes}
            sankeyLinks={[]}
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
