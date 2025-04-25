import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import * as bitcoin from 'bitcoinjs-lib'
import Slider from '@react-native-community/slider'

import { Colors } from '@/styles'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { toast } from 'sonner-native'

// Configure networks
const networks = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  signet: bitcoin.networks.testnet // Signet uses testnet address format
}

const isValidBitcoinAddress = (address: string): boolean => {
  try {
    // Try to decode the address
    const decoded = bitcoin.address.fromBech32(address)
    if (decoded) {
      // Valid bech32 address (native segwit)
      return true
    }
  } catch {
    try {
      // Try to decode as base58 (legacy or P2SH)
      const decoded = bitcoin.address.fromBase58Check(address)
      if (decoded) {
        // Check if it's a valid version (0 for legacy, 5 for P2SH)
        return decoded.version === 0 || decoded.version === 5
      }
    } catch {
      return false
    }
  }
  return false
}

const getNetworkType = (
  address: string
): 'mainnet' | 'testnet' | 'signet' | null => {
  try {
    // Try to decode the address
    const decoded = bitcoin.address.fromBech32(address)
    if (decoded) {
      // Check the prefix for network type
      if (decoded.prefix === 'tb') return 'testnet'
      if (decoded.prefix === 'sb') return 'signet'
      if (decoded.prefix === 'bc') return 'mainnet'
    }
  } catch {
    try {
      // Try to decode as base58 (legacy or P2SH)
      const decoded = bitcoin.address.fromBase58Check(address)
      if (decoded) {
        // Check version for network type
        if (decoded.version === 0 || decoded.version === 5) return 'mainnet'
        // For testnet/signet, we need to check the network type from the node
        // since they share the same address versions
        return 'testnet' // Default to testnet for now
      }
    } catch {
      return null
    }
  }
  return null
}

export default function Energy() {
  const [blocksFound, _setBlocksFound] = useState(0)
  const [_hashRate, _setHashRate] = useState('0')
  const [energyRate, _setEnergyRate] = useState('0')
  const [totalSats, _setTotalSats] = useState('0')
  const [isMining, setIsMining] = useState(false)
  const [miningIntensity, setMiningIntensity] = useState(500)
  const isMiningRef = useRef(false)
  const miningIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [rpcUrl, setRpcUrl] = useState('')
  const [rpcUser, setRpcUser] = useState('')
  const [rpcPassword, setRpcPassword] = useState('')
  const [_isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [blockchainInfo, setBlockchainInfo] = useState<any>(null)
  const [_isLoadingInfo, setIsLoadingInfo] = useState(false)
  const [blockTemplate, setBlockTemplate] = useState<any>(null)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const [templateData, setTemplateData] = useState<string>('')
  const [miningAddress, setMiningAddress] = useState('')
  const [isValidAddress, setIsValidAddress] = useState(false)
  const [opReturnContent, setOpReturnContent] = useState('')
  const [miningStats, setMiningStats] = useState({
    hashesPerSecond: 0,
    lastHash: '',
    attempts: 0
  })
  const lastHashRef = useRef('')
  const [difficultyProgress, setDifficultyProgress] = useState(0)
  const [networkHashRate, setNetworkHashRate] = useState('0')
  const [isStopping, setIsStopping] = useState(false)
  const [txId, setTxId] = useState('')
  const [isLoadingTx, setIsLoadingTx] = useState(false)
  const [txError, setTxError] = useState('')
  const lastTemplateUpdateRef = useRef<number>(0)
  const templateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const _formatTemplateData = useCallback((data: any) => {
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
    } catch (_error) {
      return 'Error formatting template data'
    }
  }, [])

  const _fetchBlockTemplate = useCallback(async () => {
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
      } catch (_error) {
        // Ignore network type detection errors
      }

      const requestBody = {
        jsonrpc: '1.0',
        id: '1',
        method: 'getblocktemplate',
        params: [
          {
            rules: rules
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
        setTemplateData(_formatTemplateData(data.result))
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
    _formatTemplateData,
    blockTemplate
  ])

  const _fetchBlockchainInfo = useCallback(async () => {
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
      _fetchBlockTemplate()
    } catch (_error) {
      setConnectionError('Failed to fetch blockchain info')
    } finally {
      setIsLoadingInfo(false)
    }
  }, [isConnected, rpcUrl, rpcUser, rpcPassword, _fetchBlockTemplate])

  const _fetchNetworkHashRate = useCallback(async () => {
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
    } catch (_error) {
      setNetworkHashRate('0')
    }
  }, [])

  useEffect(() => {
    let intervalId: NodeJS.Timeout

    if (isConnected) {
      // Initial fetch
      _fetchBlockchainInfo()

      // Set up interval for auto-refresh
      intervalId = setInterval(() => {
        _fetchBlockchainInfo()
      }, 30000) // 30 seconds
    }

    // Cleanup interval on unmount or when disconnected
    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [isConnected, _fetchBlockchainInfo]) // Dependencies for the effect

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
    _fetchNetworkHashRate()
    // Set up interval for auto-refresh
    const intervalId = setInterval(_fetchNetworkHashRate, 60000) // Update every minute
    return () => clearInterval(intervalId)
  }, [_fetchNetworkHashRate])

  // Set up template refresh interval
  useEffect(() => {
    if (isConnected) {
      // Initial fetch
      _fetchBlockTemplate()

      // Set up interval for auto-refresh (every 2 minutes)
      templateUpdateIntervalRef.current = setInterval(() => {
        _fetchBlockTemplate()
      }, 120000)
    }

    return () => {
      if (templateUpdateIntervalRef.current) {
        clearInterval(templateUpdateIntervalRef.current)
        templateUpdateIntervalRef.current = null
      }
    }
  }, [isConnected, _fetchBlockTemplate])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (templateUpdateIntervalRef.current) {
        clearInterval(templateUpdateIntervalRef.current)
        templateUpdateIntervalRef.current = null
      }
    }
  }, [])

  const _connectToNode = async () => {
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
    } catch (_error) {
      if (_error instanceof Error) {
        setConnectionError(_error.message)
      } else {
        setConnectionError(
          'Failed to connect to Bitcoin node. Please check your credentials.'
        )
      }
      setIsConnected(false)
      setBlockchainInfo(null)
    } finally {
      setIsConnecting(false)
    }
  }

  const _createCoinbaseTransaction = useCallback(
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

  const _createMerkleRoot = useCallback((transactions: any[]) => {
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

  const _createBlockHeader = useCallback(
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

  const _checkDifficulty = (hash: string, target: string) => {
    const hashNum = BigInt('0x' + hash)
    const targetNum = BigInt('0x' + target)
    return hashNum <= targetNum
  }

  const _submitBlock = useCallback(
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

        _setBlocksFound((prev) => prev + 1)
        return true
      } catch (_error) {
        return false
      }
    },
    [rpcUrl, rpcUser, rpcPassword]
  )

  const _startMining = useCallback(async () => {
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

      const coinbaseTx = _createCoinbaseTransaction(blockTemplate)
      if (!coinbaseTx) {
        throw new Error('Failed to create coinbase transaction')
      }

      const allTransactions = [
        coinbaseTx,
        ...(blockTemplate.transactions || [])
      ]
      const merkleRoot = _createMerkleRoot(allTransactions)
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
            const header = _createBlockHeader(
              blockTemplate,
              merkleRoot,
              timestamp,
              nonce++
            )

            const hash = bitcoin.crypto.sha256(
              bitcoin.crypto.sha256(header as unknown as Buffer)
            )
            const hashHex = (hash as Buffer).reverse().toString('hex')

            hashes++

            if (hashes % 1000 === 0) {
              lastHashRef.current = hashHex
            }

            if (_checkDifficulty(hashHex, blockTemplate.target)) {
              const success = await _submitBlock(
                header as unknown as Uint8Array,
                coinbaseTx,
                allTransactions
              )
              if (success) {
                _setTotalSats((prev) =>
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
              _setEnergyRate(powerConsumption)
              setMiningStats((prev) => ({
                ...prev,
                hashesPerSecond,
                attempts: hashes,
                lastHash: lastHashRef.current
              }))
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
    _createCoinbaseTransaction,
    _createBlockHeader,
    _createMerkleRoot,
    _submitBlock,
    rpcUrl,
    rpcUser,
    rpcPassword,
    miningIntensity
  ])

  const _stopMining = useCallback(() => {
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
    _setHashRate('0')
    _setEnergyRate('0')
    _setTotalSats('0')
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
    setIsValidAddress(isValidBitcoinAddress(address))
  }

  const _fetchTransaction = useCallback(async () => {
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
        setTemplateData(_formatTemplateData(newTemplate))
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
    _formatTemplateData
  ])

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('converter.energy.title')}</SSText>
          )
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
              {blocksFound} Blocks Found
            </SSText>
            <SSText size="lg" color="muted">
              {isMining ? 'Mining' : 'Not Mining'}
            </SSText>
          </SSVStack>

          <SSHStack gap="xl">
            <SSVStack style={{ alignItems: 'center', width: '20%' }} gap="xxs">
              <SSText size="3xl" style={styles.bigNumber}>
                {totalSats}
              </SSText>
              <SSText size="sm" color="muted">
                sats
              </SSText>
            </SSVStack>

            <SSVStack style={{ alignItems: 'center', width: '20%' }} gap="xxs">
              <SSText size="3xl" style={styles.bigNumber}>
                {miningStats.hashesPerSecond.toLocaleString()}
              </SSText>
              <SSText size="sm" color="muted">
                hash/s
              </SSText>
            </SSVStack>

            <SSVStack style={{ alignItems: 'center', width: '20%' }} gap="xxs">
              <SSText size="3xl" style={styles.bigNumber}>
                ~{energyRate}
              </SSText>
              <SSText size="sm" color="muted">
                mAh/min
              </SSText>
            </SSVStack>
          </SSHStack>

          <View style={styles.graphPlaceholder} />

          <SSVStack gap="md" style={styles.buttonContainer}>
            <SSVStack gap="sm" style={{ width: '100%' }}>
              <SSHStack justifyBetween>
                <SSText size="sm" color="muted">
                  Mining Intensity
                </SSText>
                <SSText size="sm" color="muted">
                  {miningIntensity} hashes/interval
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
              label={
                isMining
                  ? isStopping
                    ? 'STOPPING...'
                    : 'STOP MINING'
                  : 'START MINING'
              }
              onPress={() => (isMining ? _stopMining() : _startMining())}
              variant={isMining ? 'danger' : 'secondary'}
              disabled={
                !isConnected || !miningAddress || !isValidAddress || isStopping
              }
              loading={isStopping}
            />
            <SSButton
              label="JOIN POOL"
              onPress={() => {}}
              variant="outline"
              disabled
            />
          </SSVStack>

          <SSVStack gap="md" style={styles.statsContainer}>
            <SSVStack gap="sm">
              <SSText color="muted">Latest Hashes</SSText>
              <SSText size="xl" type="mono">
                {miningStats.lastHash || '-'}
              </SSText>
            </SSVStack>

            <SSVStack gap="sm">
              <SSText color="muted">Best Block Hash</SSText>
              <SSText size="xl" type="mono">
                {blockchainInfo?.bestblockhash || '-'}
              </SSText>
            </SSVStack>
            <SSVStack gap="xs">
              <SSText color="muted">Difficulty Adjustment Progress</SSText>
              <View style={styles.difficultyBar}>
                <View
                  style={[
                    styles.difficultyProgress,
                    { width: `${difficultyProgress * 100}%` }
                  ]}
                />
              </View>
              <SSText size="xs" color="muted">
                {Math.floor(difficultyProgress * 100)}% of {2016} blocks
              </SSText>
            </SSVStack>
          </SSVStack>

          <SSVStack gap="lg" style={styles.statsGrid}>
            <SSHStack justifyBetween>
              <SSVStack gap="xxs">
                <SSText size="xl">{blockchainInfo?.blocks || '0'}</SSText>
                <SSText size="xs" color="muted">
                  Block Candidate
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'center' }} gap="xxs">
                <SSText size="xl">
                  {blockTemplate?.coinbasevalue
                    ? (blockTemplate.coinbasevalue / 100000000).toFixed(4)
                    : '0.0000'}{' '}
                  BTC
                </SSText>
                <SSText size="xs" color="muted">
                  Reward
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'flex-end' }} gap="xxs">
                <SSText size="xl">
                  {blockTemplate?.transactions?.length || '0'}
                </SSText>
                <SSText size="xs" color="muted">
                  Transactions
                </SSText>
              </SSVStack>
            </SSHStack>

            <SSHStack justifyBetween>
              <SSVStack gap="xxs">
                <SSText size="xl">
                  {blockTemplate?.transactions?.length || '0'}
                </SSText>
                <SSText size="xs" color="muted">
                  Transactions
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'center' }} gap="xxs">
                <SSText size="xl">
                  {blockTemplate?.sizelimit
                    ? (blockTemplate.sizelimit / (1024 * 1024)).toFixed(2)
                    : '0.00'}{' '}
                  MB
                </SSText>
                <SSText size="xs" color="muted">
                  Size
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'flex-end' }} gap="xxs">
                <SSText size="xl">
                  {Math.floor(
                    (Date.now() / 1000 - blockTemplate?.curtime) / 60
                  ) || '0'}
                </SSText>
                <SSText size="xs" color="muted">
                  mins ago
                </SSText>
              </SSVStack>
            </SSHStack>

            <SSHStack justifyBetween>
              <SSVStack gap="xxs">
                <SSText size="xl">n/a</SSText>
                <SSText size="xs" color="muted">
                  Template
                </SSText>
              </SSVStack>

              <SSVStack style={{ alignItems: 'center' }} gap="xxs">
                <SSText size="xl">{networkHashRate} EH/s</SSText>
                <SSText size="xs" color="muted">
                  Hash Rate
                </SSText>
              </SSVStack>

              <SSVStack style={{ alignItems: 'flex-end' }} gap="xxs">
                <SSText size="xl">
                  {blockchainInfo?.total_supply?.toFixed(4) || '0'}
                </SSText>
                <SSText size="xs" color="muted">
                  Total Bitcoin
                </SSText>
              </SSVStack>
            </SSHStack>
          </SSVStack>
        </SSVStack>

        <SSVStack gap="md" style={styles.formContainer}>
          <SSFormLayout>
            <SSText
              size="sm"
              color="muted"
              uppercase
              style={styles.sectionTitle}
            >
              Bitcoin Node Credentials
            </SSText>
            <SSFormLayout.Item>
              <SSFormLayout.Label label="RPC URL" />
              <SSTextInput
                placeholder="http://127.0.0.1:8332"
                value={rpcUrl}
                onChangeText={setRpcUrl}
                variant="outline"
                align="center"
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label="RPC Username" />
              <SSTextInput
                placeholder="Enter RPC username"
                value={rpcUser}
                onChangeText={setRpcUser}
                variant="outline"
                align="center"
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label="RPC Password" />
              <SSTextInput
                placeholder="Enter RPC password"
                value={rpcPassword}
                onChangeText={setRpcPassword}
                variant="outline"
                align="center"
                secureTextEntry
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label="Mining Address" />
              <SSTextInput
                placeholder="Address to receive rewards"
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
                  Invalid Bitcoin address. Please enter a valid legacy, P2SH, or
                  SegWit address.
                </SSText>
              )}
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label="OP_RETURN Content" />
              <SSTextInput
                placeholder="Optional OP_RETURN"
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
              label="TEST CONNECTION"
              onPress={_connectToNode}
              variant="outline"
              disabled={_isConnecting}
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
                Node Information
              </SSText>
              <SSHStack justifyBetween>
                <SSText color="muted">Chain</SSText>
                <SSText>{blockchainInfo.chain}</SSText>
              </SSHStack>
              <SSHStack justifyBetween>
                <SSText color="muted">Blocks</SSText>
                <SSText>{blockchainInfo.blocks}</SSText>
              </SSHStack>
              <SSHStack justifyBetween>
                <SSText color="muted">Headers</SSText>
                <SSText>{blockchainInfo.headers}</SSText>
              </SSHStack>
              <SSVStack justifyBetween gap="xxs">
                <SSText color="muted">Best Block Hash</SSText>
                <SSText size="xs" type="mono">
                  {blockchainInfo.bestblockhash}
                </SSText>
              </SSVStack>
              <SSHStack justifyBetween>
                <SSText color="muted">Difficulty</SSText>
                <SSText>{blockchainInfo.difficulty}</SSText>
              </SSHStack>
              <SSHStack justifyBetween>
                <SSText color="muted">Verification Progress</SSText>
                <SSText>
                  {(blockchainInfo.verificationprogress * 100).toFixed(2)}%
                </SSText>
              </SSHStack>
              <SSButton
                label="REFRESH INFO"
                onPress={_fetchBlockchainInfo}
                variant="outline"
                disabled={_isLoadingInfo}
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
              Block Template
            </SSText>
            {isLoadingTemplate ? (
              <SSVStack style={styles.loadingContainer}>
                <SSText color="muted">Loading block template...</SSText>
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
                label="REFRESH TEMPLATE"
                onPress={_fetchBlockTemplate}
                variant="outline"
                disabled={isLoadingTemplate}
              />
              <SSVStack gap="sm">
                <SSTextInput
                  placeholder="Enter mempool TX ID"
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
                  label="ADD TRANSACTION"
                  onPress={_fetchTransaction}
                  variant="outline"
                  disabled={!txId || isLoadingTx || !isConnected}
                  loading={isLoadingTx}
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
    paddingBottom: 200
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
  }
})
