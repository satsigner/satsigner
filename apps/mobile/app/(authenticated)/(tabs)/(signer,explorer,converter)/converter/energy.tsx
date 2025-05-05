import Slider from '@react-native-community/slider'
import * as bitcoin from 'bitcoinjs-lib'
import { Stack } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { Colors } from '@/styles'
import { validateAddress } from '@/utils/validation'

const tn = _tn('converter.energy')

const BTC_UNIT = 'BTC'
const BLOCK_SIZE_UNIT = 'MB'

// Configure networks
const networks = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  signet: bitcoin.networks.testnet // Signet uses testnet address format
}

export default function Energy() {
  const [blockchainInfo, setBlockchainInfo] = useState<any>(null)
  const [blockHeader, setBlockHeader] = useState('')
  const [blocksFound, setBlocksFound] = useState(0)
  const [blockTemplate, setBlockTemplate] = useState<any>(null)
  const [connectionError, setConnectionError] = useState('')
  const [difficultyProgress, setDifficultyProgress] = useState(0)
  const [energyRate, setEnergyRate] = useState('0')

  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isLoadingInfo, setIsLoadingInfo] = useState(false)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const [isLoadingTx, setIsLoadingTx] = useState(false)
  const [isMining, setIsMining] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isValidAddress, setIsValidAddress] = useState(false)

  const [miningAddress, setMiningAddress] = useState('')
  const [miningIntensity, setMiningIntensity] = useState(500)
  const [miningStats, setMiningStats] = useState({
    hashesPerSecond: 0,
    lastHash: '',
    attempts: 0
  })

  const [networkHashRate, setNetworkHashRate] = useState('0')
  const [opReturnContent, setOpReturnContent] = useState('')
  const [rpcPassword, setRpcPassword] = useState('')
  const [rpcUrl, setRpcUrl] = useState('')
  const [rpcUser, setRpcUser] = useState('')
  const [templateData, setTemplateData] = useState('')
  const [totalSats, setTotalSats] = useState('0')
  const [txError, setTxError] = useState('')
  const [txId, setTxId] = useState('')

  const lastHashRef = useRef('')
  const currentHeaderRef = useRef<Uint8Array | null>(null)
  const isMiningRef = useRef(false)
  const lastTemplateUpdateRef = useRef<number>(0)
  const miningIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const templateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const formatTemplateData = useCallback((data: any) => {
    try {
      // Only show essential fields to reduce data size
      const essentialData = {
        version: data.version,
        previousblockhash: data.previousblockhash,
        transactions: data.transactions?.length || 0,
        coinbasevalue: data.coinbasevalue,
        bits: data.bits,
        height: data.height,
        target: data.target,
        mintime: data.mintime,
        mutable: data.mutable,
        noncerange: data.noncerange,
        sigoplimit: data.sigoplimit,
        sizelimit: data.sizelimit,
        weightlimit: data.weightlimit,
        curtime: data.curtime,
        mediantime: data.mediantime,
        longpollid: data.longpollid,
        default_witness_commitment: data.default_witness_commitment,
        rules: data.rules,
        transactionSample:
          data.transactions?.slice(0, 20).map((tx: any) => ({
            txid: tx.txid,
            fee: tx.fee,
            weight: tx.weight,
            size: tx.size
          })) || []
      }
      return JSON.stringify(essentialData, null, 2)
    } catch {
      return 'Error formatting template data'
    }
  }, [])

  const fetchBlockTemplate = useCallback(async () => {
    if (!isConnected) return

    // Prevent too frequent updates (minimum 30 seconds between updates)
    const now = Date.now()
    if (now - lastTemplateUpdateRef.current < 30000) {
      return
    }

    setIsLoadingTemplate(true)
    try {
      const rules = ['segwit']

      // First try to get the network type from the node
      try {
        const credentials = `${rpcUser}:${rpcPassword}`
        const authorization = Buffer.from(credentials).toString('base64')
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Basic ${authorization}`
        }
        const body = JSON.stringify({
          jsonrpc: '1.0',
          id: '1',
          method: 'getblockchaininfo',
          params: []
        })
        const method = 'POST'
        const networkResponse = await fetch(rpcUrl, { method, headers, body })

        if (networkResponse.ok) {
          const networkData = await networkResponse.json()
          if (networkData.result && networkData.result.chain) {
            if (networkData.result.chain === 'signet') {
              rules.push('signet')
            } else if (networkData.result.chain === 'test') {
              rules.push('testnet')
            }
          }
        }
      } catch {
        // Ignore network type detection errors
      }

      const requestBody = {
        jsonrpc: '1.0',
        id: '1',
        method: 'getblocktemplate',
        params: [
          {
            rules
          }
        ]
      }

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${rpcUser}:${rpcPassword}`).toString('base64')}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      if (data.error) {
        let errorMessage = data.error.message || 'RPC error'
        if (data.error.code === -32601) {
          errorMessage =
            'getblocktemplate RPC method not found. Make sure your node supports mining.'
        } else if (data.error.code === -32603) {
          errorMessage =
            'Node is not ready for mining. Check if your node is fully synced.'
        } else if (data.error.code === -32602) {
          errorMessage =
            'Invalid parameters. Check if your node supports the requested rules.'
        }
        throw new Error(errorMessage)
      }

      if (!data.result) {
        throw new Error('No block template data received from node')
      }

      // Update template only if it's different
      if (JSON.stringify(data.result) !== JSON.stringify(blockTemplate)) {
        setBlockTemplate(data.result)
        setTemplateData(formatTemplateData(data.result))
        lastTemplateUpdateRef.current = now
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Failed to fetch block template: ${errorMessage}`)
    } finally {
      setIsLoadingTemplate(false)
    }
  }, [
    isConnected,
    rpcUrl,
    rpcUser,
    rpcPassword,
    formatTemplateData,
    blockTemplate
  ])

  const fetchBlockchainInfo = useCallback(async () => {
    if (!isConnected) return

    setIsLoadingInfo(true)
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${rpcUser}:${rpcPassword}`).toString('base64')}`
        },
        body: JSON.stringify({
          jsonrpc: '1.0',
          id: '1',
          method: 'getblockchaininfo',
          params: []
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch blockchain info')
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message || 'RPC error')
      }

      setBlockchainInfo(data.result)
      // Fetch block template after successful blockchain info
      fetchBlockTemplate()
    } catch {
      setConnectionError('Failed to fetch blockchain info')
    } finally {
      setIsLoadingInfo(false)
    }
  }, [isConnected, rpcUrl, rpcUser, rpcPassword, fetchBlockTemplate])

  const fetchNetworkHashRate = useCallback(async () => {
    try {
      const response = await fetch(
        'https://mempool.space/api/v1/mining/hashrate/1m'
      )
      if (!response.ok) {
        throw new Error('Failed to fetch network hash rate')
      }
      const data = await response.json()
      // Get the latest hash rate from the hashrates array
      const latestHashRate =
        data.hashrates[data.hashrates.length - 1].avgHashrate
      // Convert to exahashes per second (1 EH/s = 10^18 hashes per second)
      const hashRateInEH = (latestHashRate / 1e18).toFixed(2)
      setNetworkHashRate(hashRateInEH)
    } catch {
      setNetworkHashRate('0')
    }
  }, [])

  useEffect(() => {
    let intervalId: NodeJS.Timeout

    if (isConnected) {
      // Initial fetch
      fetchBlockchainInfo()

      // Set up interval for auto-refresh
      intervalId = setInterval(() => {
        fetchBlockchainInfo()
      }, 30000) // 30 seconds
    }

    // Cleanup interval on unmount or when disconnected
    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [isConnected, fetchBlockchainInfo]) // Dependencies for the effect

  useEffect(() => {
    if (blockchainInfo) {
      // Calculate progress of current difficulty adjustment period
      const blocksInPeriod = 2016 // Bitcoin's difficulty adjustment period
      const currentBlock = blockchainInfo.blocks
      const progress = (currentBlock % blocksInPeriod) / blocksInPeriod
      setDifficultyProgress(progress)
    }
  }, [blockchainInfo])

  useEffect(() => {
    // Initial fetch
    fetchNetworkHashRate()
    // Set up interval for auto-refresh
    const intervalId = setInterval(fetchNetworkHashRate, 60000) // Update every minute
    return () => clearInterval(intervalId)
  }, [fetchNetworkHashRate])

  // Set up template refresh interval
  useEffect(() => {
    if (isConnected) {
      // Initial fetch
      fetchBlockTemplate()

      // Set up interval for auto-refresh (every 2 minutes)
      templateUpdateIntervalRef.current = setInterval(() => {
        fetchBlockTemplate()
      }, 120000)
    }

    return () => {
      if (templateUpdateIntervalRef.current) {
        clearInterval(templateUpdateIntervalRef.current)
        templateUpdateIntervalRef.current = null
      }
    }
  }, [isConnected, fetchBlockTemplate])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (templateUpdateIntervalRef.current) {
        clearInterval(templateUpdateIntervalRef.current)
        templateUpdateIntervalRef.current = null
      }
    }
  }, [])

  const connectToNode = async () => {
    if (!rpcUrl || !rpcUser || !rpcPassword) {
      setConnectionError('Please fill in all RPC credentials')
      return
    }

    setIsConnecting(true)
    setConnectionError('')

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${rpcUser}:${rpcPassword}`).toString('base64')}`
        },
        body: JSON.stringify({
          jsonrpc: '1.0',
          id: '1',
          method: 'getblockchaininfo',
          params: []
        })
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid credentials')
        } else if (response.status === 403) {
          throw new Error('Access denied')
        } else {
          throw new Error('Failed to connect to Bitcoin node')
        }
      }

      const data = await response.json()
      if (data.error) {
        if (data.error.code === -28) {
          throw new Error('Bitcoin node is still starting up')
        } else if (data.error.code === -32601) {
          throw new Error('RPC method not found')
        } else {
          throw new Error(data.error.message || 'RPC error')
        }
      }

      // If we get here, connection was successful
      setConnectionError('')
      setIsConnected(true)
      setBlockchainInfo(data.result)
    } catch (error) {
      if (error instanceof Error) {
        setConnectionError(error.message)
      } else {
        setConnectionError(
          'Failed to connect to Bitcoin node. Please check your params.'
        )
      }
      setIsConnected(false)
      setBlockchainInfo(null)
    } finally {
      setIsConnecting(false)
    }
  }

  const createCoinbaseTransaction = useCallback(
    (template: any) => {
      if (!template || !miningAddress) {
        return null
      }

      try {
        const tx = new bitcoin.Transaction()
        tx.version = 1
        tx.locktime = 0
        tx.addInput(
          Buffer.alloc(32),
          0xffffffff,
          0xffffffff,
          Buffer.from(`Satsigner ${Date.now()}`)
        )

        // Determine the correct network based on the address prefix
        let network = networks.mainnet
        if (miningAddress.startsWith('tb')) {
          network = networks.testnet
        } else if (miningAddress.startsWith('sb')) {
          network = networks.testnet // Signet uses testnet address format
        }

        const outputScript = bitcoin.address.toOutputScript(
          miningAddress,
          network
        )

        tx.addOutput(outputScript, template.coinbasevalue)
        if (opReturnContent) {
          const data = Buffer.from(opReturnContent)
          const script = bitcoin.script.compile([
            bitcoin.opcodes.OP_RETURN,
            data
          ])
          tx.addOutput(script, 0)
        }

        return tx
      } catch (error) {
        throw error
      }
    },
    [miningAddress, opReturnContent]
  )

  const createMerkleRoot = useCallback((transactions: any[]) => {
    if (!transactions || transactions.length === 0) {
      return ''
    }

    try {
      let hashes = transactions.map((tx) => {
        if (!tx) {
          throw new Error('Invalid transaction')
        }
        if (tx.getHash) {
          return tx.getHash()
        } else if (tx.txid) {
          return Buffer.from(tx.txid, 'hex').reverse()
        } else {
          throw new Error('Invalid transaction format')
        }
      })

      while (hashes.length > 1) {
        const newHashes = []
        for (let i = 0; i < hashes.length; i += 2) {
          const left = hashes[i]
          const right = i + 1 < hashes.length ? hashes[i + 1] : left
          const concat = Buffer.concat([left, right])
          const hash = bitcoin.crypto.sha256(bitcoin.crypto.sha256(concat))
          newHashes.push(hash)
        }
        hashes = newHashes
      }

      if (!hashes[0]) {
        throw new Error('Failed to create merkle root: no hash generated')
      }

      return hashes[0].reverse().toString('hex')
    } catch (error) {
      throw new Error(
        'Failed to create merkle root: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      )
    }
  }, [])

  const createBlockHeader = useCallback(
    (template: any, merkleRoot: string, timestamp: number, nonce: number) => {
      const header = Buffer.alloc(80) as unknown as Uint8Array

      // Version (4 bytes)
      const versionView = new DataView(header.buffer)
      versionView.setUint32(0, template.version, true)

      // Previous block hash (32 bytes)
      const prevHash = Buffer.from(
        template.previousblockhash,
        'hex'
      ).reverse() as unknown as Uint8Array
      header.set(prevHash, 4)

      // Merkle root (32 bytes)
      const merkle = Buffer.from(
        merkleRoot,
        'hex'
      ).reverse() as unknown as Uint8Array
      header.set(merkle, 36)

      // Timestamp (4 bytes)
      versionView.setUint32(68, timestamp, true)

      // Bits (4 bytes)
      const bits = Buffer.from(template.bits, 'hex') as unknown as Uint8Array
      header.set(bits, 72)

      // Nonce (4 bytes)
      versionView.setUint32(76, nonce, true)
      return header
    },
    []
  )

  const checkDifficulty = (hash: string, target: string) => {
    const hashNum = BigInt('0x' + hash)
    const targetNum = BigInt('0x' + target)
    return hashNum <= targetNum
  }

  const submitBlock = useCallback(
    async (blockHeader: Uint8Array, coinbaseTx: any, transactions: any[]) => {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`${rpcUser}:${rpcPassword}`).toString('base64')}`
          },
          body: JSON.stringify({
            jsonrpc: '1.0',
            id: '1',
            method: 'submitblock',
            params: [
              Buffer.concat([
                new Uint8Array(blockHeader),
                new Uint8Array(
                  Buffer.from(JSON.stringify([coinbaseTx, ...transactions]))
                )
              ]).toString('hex')
            ]
          })
        })

        if (!response.ok) {
          throw new Error('Failed to submit block')
        }

        const data = await response.json()
        if (data.error) {
          throw new Error(data.error.message || 'RPC error')
        }

        setBlocksFound((prev) => prev + 1)
        return true
      } catch {
        return false
      }
    },
    [rpcUrl, rpcUser, rpcPassword]
  )

  const startMining = useCallback(async () => {
    if (!blockTemplate || !miningAddress) {
      toast.error('Missing block template or mining address')
      return
    }

    try {
      // First check if the address matches the node's network
      const networkResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${rpcUser}:${rpcPassword}`).toString('base64')}`
        },
        body: JSON.stringify({
          jsonrpc: '1.0',
          id: '1',
          method: 'getblockchaininfo',
          params: []
        })
      })

      if (!networkResponse.ok) {
        throw new Error('Failed to get node network information')
      }

      const networkData = await networkResponse.json()
      if (networkData.error) {
        throw new Error(
          networkData.error.message || 'Failed to get node network information'
        )
      }

      const nodeNetwork = networkData.result?.chain
      if (!nodeNetwork) {
        throw new Error('Could not determine node network type')
      }

      // Check address prefix against node network
      const addressPrefix = miningAddress.substring(0, 2)

      // For mainnet, we need to handle both 'bc' and 'bc1' prefixes
      if (nodeNetwork === 'main') {
        if (addressPrefix !== 'bc' && !miningAddress.startsWith('bc1')) {
          toast.error(
            `Address ${miningAddress} has the wrong prefix for mainnet network. Use an address starting with 'bc' or 'bc1'`
          )
          return
        }
      } else if (nodeNetwork === 'test' || nodeNetwork === 'signet') {
        // Both testnet and signet use the same address format
        if (addressPrefix !== 'tb' && !miningAddress.startsWith('tb1')) {
          toast.error(
            `Address ${miningAddress} has the wrong prefix for ${nodeNetwork} network. Use an address starting with 'tb' or 'tb1'`
          )
          return
        }
      }

      setIsMining(true)
      isMiningRef.current = true

      const coinbaseTx = createCoinbaseTransaction(blockTemplate)
      if (!coinbaseTx) {
        throw new Error('Failed to create coinbase transaction')
      }

      const allTransactions = [
        coinbaseTx,
        ...(blockTemplate.transactions || [])
      ]
      const merkleRoot = createMerkleRoot(allTransactions)
      if (!merkleRoot) {
        throw new Error('Failed to create merkle root')
      }

      let nonce = 0
      const startTime = Date.now()
      let hashes = 0

      const miningInterval = setInterval(async () => {
        if (!isMiningRef.current) {
          clearInterval(miningInterval)
          return
        }

        try {
          for (let i = 0; i < miningIntensity; i++) {
            if (!isMiningRef.current) {
              clearInterval(miningInterval)
              return
            }

            const timestamp = Math.floor(Date.now() / 1000)
            const header = createBlockHeader(
              blockTemplate,
              merkleRoot,
              timestamp,
              nonce++
            )
            currentHeaderRef.current = header

            const hash = bitcoin.crypto.sha256(
              bitcoin.crypto.sha256(header as unknown as Buffer)
            )
            const hashHex = (hash as Buffer).reverse().toString('hex')

            hashes++

            if (hashes % 1000 === 0) {
              lastHashRef.current = hashHex
            }

            if (checkDifficulty(hashHex, blockTemplate.target)) {
              const success = await submitBlock(
                header as unknown as Uint8Array,
                coinbaseTx,
                allTransactions
              )
              if (success) {
                setTotalSats((prev) =>
                  (Number(prev) + blockTemplate.coinbasevalue).toString()
                )
                toast.success('Block found and submitted successfully!')
              }
              clearInterval(miningInterval)
              isMiningRef.current = false
              setIsMining(false)
              return
            }
          }

          if (hashes % 2000 === 0) {
            const now = Date.now()
            const elapsed = (now - startTime) / 1000
            const hashesPerSecond = Math.floor(hashes / elapsed)
            const powerConsumption = isNaN(hashesPerSecond)
              ? '0'
              : (hashesPerSecond * 0.0001).toFixed(2)

            requestAnimationFrame(() => {
              setEnergyRate(powerConsumption)
              setMiningStats((prev) => ({
                ...prev,
                hashesPerSecond,
                attempts: hashes,
                lastHash: lastHashRef.current
              }))
              if (currentHeaderRef.current) {
                setBlockHeader(
                  Buffer.from(currentHeaderRef.current).toString('hex')
                )
              }
            })
          }
        } catch (error) {
          clearInterval(miningInterval)
          isMiningRef.current = false
          setIsMining(false)
          toast.error(
            'Error during mining: ' +
              (error instanceof Error ? error.message : 'Unknown error')
          )
        }
      }, 200)
      miningIntervalRef.current = miningInterval
    } catch (error) {
      isMiningRef.current = false
      setIsMining(false)
      toast.error(
        'Error starting mining: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      )
    }
  }, [
    blockTemplate,
    miningAddress,
    createCoinbaseTransaction,
    createBlockHeader,
    createMerkleRoot,
    submitBlock,
    rpcUrl,
    rpcUser,
    rpcPassword,
    miningIntensity
  ])

  const stopMining = useCallback(() => {
    // Set loading state immediately
    setIsStopping(true)
    setIsMining(false)

    // Immediately set ref to false to stop mining loop
    isMiningRef.current = false

    // Clear interval immediately
    if (miningIntervalRef.current) {
      clearInterval(miningIntervalRef.current)
      miningIntervalRef.current = null
    }

    // Reset mining values immediately
    setEnergyRate('0')
    setTotalSats('0')
    setMiningStats({
      hashesPerSecond: 0,
      lastHash: '',
      attempts: 0
    })

    // Show toast and clear loading state in next frame
    requestAnimationFrame(() => {
      toast.info('Mining stopped')
      setIsStopping(false)
    })
  }, [])

  const handleMiningAddressChange = (address: string) => {
    setMiningAddress(address)
    setIsValidAddress(validateAddress(address))
  }

  const fetchTransaction = useCallback(async () => {
    if (!txId || !isConnected) return

    setIsLoadingTx(true)
    setTxError('')

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${rpcUser}:${rpcPassword}`).toString('base64')}`
        },
        body: JSON.stringify({
          jsonrpc: '1.0',
          id: '1',
          method: 'getrawtransaction',
          params: [txId, true]
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch transaction')
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message || 'RPC error')
      }

      if (!data.result) {
        throw new Error('No transaction data received')
      }

      // Add transaction to template
      if (blockTemplate) {
        const newTemplate = {
          ...blockTemplate,
          transactions: [...(blockTemplate.transactions || []), data.result]
        }
        setBlockTemplate(newTemplate)
        setTemplateData(formatTemplateData(newTemplate))
        toast.success('Transaction added to template')
      }
    } catch (error) {
      setTxError(
        error instanceof Error ? error.message : 'Failed to fetch transaction'
      )
      toast.error('Failed to fetch transaction')
    } finally {
      setIsLoadingTx(false)
    }
  }, [
    txId,
    isConnected,
    rpcUrl,
    rpcUser,
    rpcPassword,
    blockTemplate,
    formatTemplateData
  ])

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <SSVStack
          gap="sm"
          style={[styles.mainContent, { alignItems: 'center' }]}
        >
          <SSVStack gap="sm" style={{ alignItems: 'center' }}>
            <SSText size="sm" color="muted">
              {tn('blocksFound', { blocks: blocksFound })}
            </SSText>
            <SSText size="lg" color="muted">
              {tn(isMining ? 'mining' : 'notMining')}
            </SSText>
          </SSVStack>
          <SSHStack gap="xl">
            <SSVStack style={{ alignItems: 'center', width: '20%' }} gap="xxs">
              <SSText size="3xl" style={styles.bigNumber}>
                {totalSats}
              </SSText>
              <SSText size="sm" color="muted">
                {t('bitcoin.sats')}
              </SSText>
            </SSVStack>
            <SSVStack style={{ alignItems: 'center', width: '20%' }} gap="xxs">
              <SSText size="3xl" style={styles.bigNumber}>
                {miningStats.hashesPerSecond.toLocaleString()}
              </SSText>
              <SSText size="sm" color="muted">
                {tn('hashesPerSecond')}
              </SSText>
            </SSVStack>
            <SSVStack style={{ alignItems: 'center', width: '20%' }} gap="xxs">
              <SSText size="3xl" style={styles.bigNumber}>
                ~{energyRate}
              </SSText>
              <SSText size="sm" color="muted">
                {tn('energyRate')}
              </SSText>
            </SSVStack>
          </SSHStack>
          <View style={styles.graphPlaceholder} />
          <SSVStack gap="md" style={styles.buttonContainer}>
            <SSVStack gap="sm" style={{ width: '100%' }}>
              <SSHStack justifyBetween>
                <SSText size="sm" color="muted">
                  {tn('miningIntensity')}
                </SSText>
                <SSText size="sm" color="muted">
                  {tn('miningIntensityRate', { intensity: miningIntensity })}
                </SSText>
              </SSHStack>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={2000}
                step={miningIntensity > 200 ? 100 : 10}
                value={miningIntensity}
                onValueChange={setMiningIntensity}
                disabled={isMining}
                minimumTrackTintColor={
                  miningIntensity > 500
                    ? Colors.error
                    : miningIntensity > 300
                      ? Colors.warning
                      : miningIntensity > 200
                        ? Colors.success
                        : Colors.white
                }
                maximumTrackTintColor={Colors.gray[500]}
                thumbTintColor={
                  miningIntensity > 500
                    ? Colors.error
                    : miningIntensity > 300
                      ? Colors.warning
                      : miningIntensity > 200
                        ? Colors.success
                        : Colors.white
                }
              />
            </SSVStack>
            <SSButton
              label={tn(
                isMining
                  ? isStopping
                    ? 'stoppingMining'
                    : 'stopMining'
                  : 'startMining'
              ).toUpperCase()}
              onPress={() => (isMining ? stopMining() : startMining())}
              variant={isMining ? 'danger' : 'secondary'}
              disabled={
                !isConnected || !miningAddress || !isValidAddress || isStopping
              }
              loading={isStopping}
            />
            <SSButton
              label={tn('joinPool').toUpperCase()}
              onPress={() => {}}
              variant="outline"
              disabled
            />
          </SSVStack>
          <SSVStack gap="md" style={styles.statsContainer}>
            <SSVStack gap="sm">
              <SSText color="muted">{tn('blockHeaderCandidate')}</SSText>
              <ScrollView style={styles.headerScroll}>
                <SSText size="xs" type="mono">
                  {blockHeader || '-'}
                </SSText>
              </ScrollView>
            </SSVStack>
            <SSVStack gap="sm">
              <SSText color="muted">{tn('latestHash')}</SSText>
              <SSText size="xl" type="mono">
                {miningStats.lastHash || '-'}
              </SSText>
            </SSVStack>
            <SSVStack gap="sm">
              <SSText color="muted">{tn('bestHash')}</SSText>
              <SSText size="xl" type="mono">
                {blockchainInfo?.bestblockhash || '-'}
              </SSText>
            </SSVStack>
            <SSVStack gap="xs">
              <SSText color="muted">{tn('adjustmentProgress')}</SSText>
              <View style={styles.difficultyBar}>
                <View
                  style={[
                    styles.difficultyProgress,
                    { width: `${difficultyProgress * 100}%` }
                  ]}
                />
              </View>
              <SSText size="xs" color="muted">
                {tn('adjustmentProgressPercentage', {
                  percentage: Math.floor(difficultyProgress * 100),
                  blocks: 2016
                })}
              </SSText>
            </SSVStack>
          </SSVStack>
          <SSVStack gap="lg" style={styles.statsGrid}>
            <SSHStack justifyBetween>
              <SSVStack gap="xxs">
                <SSText size="xl">{blockchainInfo?.blocks || '0'}</SSText>
                <SSText size="xs" color="muted">
                  {tn('blockCandidate')}
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'center' }} gap="xxs">
                <SSText size="xl">
                  {blockTemplate?.coinbasevalue
                    ? (blockTemplate.coinbasevalue / 100000000).toFixed(4)
                    : '0.0000'}{' '}
                  {BTC_UNIT}
                </SSText>
                <SSText size="xs" color="muted">
                  {tn('reward')}
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'flex-end' }} gap="xxs">
                <SSText size="xl">
                  {blockTemplate?.transactions?.length || '0'}
                </SSText>
                <SSText size="xs" color="muted">
                  {tn('template.transactions')}
                </SSText>
              </SSVStack>
            </SSHStack>
            <SSHStack justifyBetween>
              <SSVStack gap="xxs">
                <SSText size="xl">
                  {blockTemplate?.transactions?.length || '0'}
                </SSText>
                <SSText size="xs" color="muted">
                  {tn('template.transactions')}
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'center' }} gap="xxs">
                <SSText size="xl">
                  {blockTemplate?.sizelimit
                    ? (blockTemplate.sizelimit / (1024 * 1024)).toFixed(2)
                    : '0.00'}{' '}
                  {BLOCK_SIZE_UNIT}
                </SSText>
                <SSText size="xs" color="muted">
                  {tn('blockSize')}
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'flex-end' }} gap="xxs">
                <SSText size="xl">
                  {Math.floor(
                    (Date.now() / 1000 - blockTemplate?.curtime) / 60
                  ) || '0'}
                </SSText>
                <SSText size="xs" color="muted">
                  {tn('blockMinedMinutesAgo')}
                </SSText>
              </SSVStack>
            </SSHStack>
            <SSHStack justifyBetween>
              <SSVStack gap="xxs">
                <SSText size="xl">n/a</SSText>
                <SSText size="xs" color="muted">
                  {tn('template.template')}
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'center' }} gap="xxs">
                <SSText size="xl">
                  {tn('networkHashRate', { rate: networkHashRate })}
                </SSText>
                <SSText size="xs" color="muted">
                  {tn('hashRate')}
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'flex-end' }} gap="xxs">
                <SSText size="xl">
                  {blockchainInfo?.total_supply?.toFixed(4) || '0'}
                </SSText>
                <SSText size="xs" color="muted">
                  {tn('totalBitcoin')}
                </SSText>
              </SSVStack>
            </SSHStack>
          </SSVStack>
        </SSVStack>
        <SSVStack gap="md" style={styles.formContainer}>
          <SSFormLayout>
            <SSText
              style={styles.sectionTitle}
              size="sm"
              color="muted"
              uppercase
            >
              {tn('params.title')}
            </SSText>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={tn('params.rpcUrl')} />
              <SSTextInput
                placeholder="http://127.0.0.1:8332"
                value={rpcUrl}
                onChangeText={setRpcUrl}
                variant="outline"
                align="center"
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={tn('params.rpcUser')} />
              <SSTextInput
                placeholder={tn('params.rpcUserPlaceholder')}
                value={rpcUser}
                onChangeText={setRpcUser}
                variant="outline"
                align="center"
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={tn('params.rpcPassword')} />
              <SSTextInput
                placeholder={tn('params.rpcPasswordPlaceholder')}
                value={rpcPassword}
                onChangeText={setRpcPassword}
                variant="outline"
                align="center"
                secureTextEntry
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={tn('params.address')} />
              <SSTextInput
                placeholder={tn('params.addressPlaceholder')}
                value={miningAddress}
                onChangeText={handleMiningAddressChange}
                variant="outline"
                align="center"
                style={
                  miningAddress
                    ? {
                        borderColor: isValidAddress
                          ? Colors.success
                          : Colors.error
                      }
                    : undefined
                }
              />
              {miningAddress && !isValidAddress && (
                <SSText size="sm" color="muted" style={styles.errorText}>
                  {tn('params.addressInvalid')}
                </SSText>
              )}
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={tn('params.opReturn')} />
              <SSTextInput
                placeholder={tn('params.opReturnPlaceholder')}
                value={opReturnContent}
                onChangeText={setOpReturnContent}
                variant="outline"
                align="center"
              />
            </SSFormLayout.Item>
            {connectionError ? (
              <SSText size="sm" color="muted" style={styles.errorText}>
                {connectionError}
              </SSText>
            ) : null}
            <SSButton
              label={tn('params.test')}
              onPress={connectToNode}
              variant="outline"
              disabled={isConnecting}
            />
          </SSFormLayout>

          {isConnected && blockchainInfo && (
            <SSVStack gap="sm">
              <SSText
                size="sm"
                color="muted"
                uppercase
                style={styles.sectionTitle}
              >
                {tn('node.title')}
              </SSText>
              <SSHStack justifyBetween>
                <SSText color="muted">{tn('node.chain')}</SSText>
                <SSText>{blockchainInfo.chain}</SSText>
              </SSHStack>
              <SSHStack justifyBetween>
                <SSText color="muted">{tn('node.blocks')}</SSText>
                <SSText>{blockchainInfo.blocks}</SSText>
              </SSHStack>
              <SSHStack justifyBetween>
                <SSText color="muted">{tn('node.headers')}</SSText>
                <SSText>{blockchainInfo.headers}</SSText>
              </SSHStack>
              <SSVStack justifyBetween gap="xxs">
                <SSText color="muted">{tn('bestHash')}</SSText>
                <SSText size="xs" type="mono">
                  {blockchainInfo.bestblockhash}
                </SSText>
              </SSVStack>
              <SSHStack justifyBetween>
                <SSText color="muted">{tn('node.difficulty')}</SSText>
                <SSText>{blockchainInfo.difficulty}</SSText>
              </SSHStack>
              <SSHStack justifyBetween>
                <SSText color="muted">{tn('node.progress')}</SSText>
                <SSText>
                  {(blockchainInfo.verificationprogress * 100).toFixed(2)}%
                </SSText>
              </SSHStack>
              <SSButton
                label={tn('node.refresh').toUpperCase()}
                onPress={fetchBlockchainInfo}
                variant="outline"
                disabled={isLoadingInfo}
              />
            </SSVStack>
          )}
        </SSVStack>
        {isConnected && (
          <SSVStack gap="md" style={styles.templateContainer}>
            <SSText
              size="sm"
              color="muted"
              uppercase
              style={styles.sectionTitle}
            >
              {tn('template.title')}
            </SSText>
            {isLoadingTemplate ? (
              <SSVStack style={styles.loadingContainer}>
                <SSText color="muted">{tn('template.loading')}</SSText>
              </SSVStack>
            ) : templateData ? (
              <ScrollView style={styles.templateScroll}>
                <SSText size="xs" type="mono" style={styles.templateText}>
                  {templateData}
                </SSText>
              </ScrollView>
            ) : null}
            <SSVStack gap="sm">
              <SSButton
                label={tn('template.refresh').toUpperCase()}
                onPress={fetchBlockTemplate}
                variant="outline"
                disabled={isLoadingTemplate}
              />
              <SSVStack gap="sm">
                <SSText
                  size="sm"
                  color="muted"
                  uppercase
                  style={[styles.sectionTitle, { marginTop: 40 }]}
                >
                  {tn('template.addTransaction')}
                </SSText>
                <SSTextInput
                  placeholder={tn('template.addTransactionPlaceholder')}
                  value={txId}
                  onChangeText={setTxId}
                  variant="outline"
                  align="center"
                />
                {txError && (
                  <SSText size="sm" color="muted" style={styles.errorText}>
                    {txError}
                  </SSText>
                )}
                <SSButton
                  label={tn('template.addTransactionBtn')}
                  onPress={fetchTransaction}
                  variant="outline"
                  disabled={!txId || isLoadingTx || !isConnected}
                  loading={isLoadingTx}
                />
              </SSVStack>
              <SSVStack gap="sm">
                <SSText
                  size="sm"
                  color="muted"
                  uppercase
                  style={[styles.sectionTitle, { marginTop: 40 }]}
                >
                  {tn('template.select')}
                </SSText>
                <SSButton
                  label={tn('template.selectA')}
                  onPress={() => {}}
                  variant="outline"
                  disabled
                />
                <SSButton
                  label={tn('template.selectB')}
                  onPress={() => {}}
                  variant="outline"
                  disabled
                />
                <SSButton
                  label={tn('template.selectC')}
                  onPress={() => {}}
                  variant="outline"
                  disabled
                />
              </SSVStack>
            </SSVStack>
          </SSVStack>
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingBottom: 20
  },
  mainContent: {
    flex: 1,
    padding: 20
  },
  bigNumber: {
    fontWeight: '100',
    marginBottom: -10
  },
  graphPlaceholder: {
    width: '100%',
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[900]
  },
  buttonContainer: {
    width: '100%',
    paddingVertical: 20
  },
  statsContainer: {
    width: '100%',
    paddingVertical: 20
  },
  difficultyBar: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.gray[900],
    borderRadius: 4,
    marginVertical: 10
  },
  difficultyProgress: {
    width: '0%',
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 4
  },
  statsGrid: {
    width: '100%'
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 20
  },
  sectionTitle: {
    marginBottom: 16,
    textAlign: 'center'
  },
  errorText: {
    marginTop: 8,
    textAlign: 'center'
  },
  templateContainer: {
    padding: 20,
    paddingTop: 0
  },
  templateScroll: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    maxHeight: 1500,
    padding: 16
  },
  templateText: {
    fontFamily: 'monospace',
    fontSize: 8
  },
  loadingContainer: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100
  },
  errorContainer: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100
  },
  slider: {
    width: '100%',
    height: 60,
    marginHorizontal: 0,
    backgroundColor: Colors.gray[850]
  },
  headerScroll: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    padding: 16,
    maxHeight: 100
  }
})
