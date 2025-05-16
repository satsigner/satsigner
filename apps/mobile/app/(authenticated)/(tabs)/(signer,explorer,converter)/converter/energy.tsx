import Slider from '@react-native-community/slider'
import * as bitcoin from 'bitcoinjs-lib'
import { Stack } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View, Platform } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { Colors } from '@/styles'
import {
  type BlockchainInfo,
  type BlockTemplate,
  type BlockTemplateTransaction
} from '@/types/models/Rpc'
import { validateAddress } from '@/utils/validation'

const tn = _tn('converter.energy')

const BTC_UNIT = 'BTC'
const BLOCK_SIZE_UNIT = 'MB'

type Scalar = number | string | boolean
type RpcRequestBody = {
  [key: string]: Scalar | Scalar[] | RpcRequestBody | RpcRequestBody[]
}

// Configure networks
const networks = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  signet: bitcoin.networks.testnet, // Signet uses testnet address format
  regtest: {
    ...bitcoin.networks.testnet,
    bech32: 'bcrt',
    pubKeyHash: 0x6f, // Same as testnet
    scriptHash: 0xc4, // Same as testnet
    wif: 0xef, // Same as testnet
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    }
  } as bitcoin.Network
}

// Add this helper function at the top level
const getAdjustedRpcUrl = (url: string) => {
  if (Platform.OS === 'android') {
    try {
      const parsedUrl = new URL(url)
      if (
        parsedUrl.hostname.startsWith('172.') ||
        parsedUrl.hostname === 'localhost' ||
        parsedUrl.hostname === '127.0.0.1'
      ) {
        const newUrl = new URL(url)
        newUrl.hostname = '10.0.2.2'
        return newUrl.toString()
      }
    } catch (e) {
      // Silent fail - return original URL
    }
  }
  return url
}

// Add this helper function at the top level
const getNetworkFromAddress = (address: string) => {
  if (address.startsWith('bcrt1') || address.startsWith('bcrt')) {
    return networks.regtest
  } else if (address.startsWith('bc1') || address.startsWith('bc')) {
    return networks.mainnet
  } else if (address.startsWith('tb1') || address.startsWith('tb')) {
    return networks.testnet
  } else if (address.startsWith('sb1') || address.startsWith('sb')) {
    return networks.signet
  }
  return networks.mainnet
}

export default function Energy() {
  const [blockchainInfo, setBlockchainInfo] = useState<BlockchainInfo | null>(
    null
  )
  const [blockHeader, setBlockHeader] = useState('')
  const [blocksFound, setBlocksFound] = useState(0)
  const [blockTemplate, setBlockTemplate] = useState<BlockTemplate | null>(null)
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

  const fetchRpc = useCallback(
    (requestBody: RpcRequestBody) => {
      const adjustedUrl = getAdjustedRpcUrl(rpcUrl)
      const credentials = `${rpcUser}:${rpcPassword}`
      const credentialsBase64 = Buffer.from(credentials).toString('base64')
      const authorization = `Basic ${credentialsBase64}`

      const headers = {
        'Content-Type': 'application/json',
        Authorization: authorization
      }

      const method = 'POST'
      const body = JSON.stringify(requestBody)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      return fetch(adjustedUrl, {
        method,
        headers,
        body,
        signal: controller.signal
      })
        .then((response) => {
          clearTimeout(timeoutId)
          return response
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          if (error.name === 'AbortError') {
            const platformSpecificAdvice =
              Platform.OS === 'android'
                ? '\n\nFor Android Emulator:\n' +
                  '1. Make sure your Bitcoin node is running on the host machine\n' +
                  '2. Use 10.0.2.2 instead of localhost or Docker IP\n' +
                  '3. Check if the port is exposed in your Docker configuration\n' +
                  '4. Verify Bitcoin node is configured to accept external connections'
                : ''

            throw new Error(
              `Request timed out after 10 seconds.${platformSpecificAdvice}`
            )
          } else if (error.message === 'Network request failed') {
            const platformSpecificAdvice =
              Platform.OS === 'android'
                ? '\n\nFor Android Emulator:\n' +
                  '1. Use 10.0.2.2 instead of localhost or Docker IP\n' +
                  '2. Make sure port is exposed in Docker: "ports: [\'18443:18443\']"\n' +
                  '3. Check Bitcoin node is configured to accept external connections'
                : ''

            throw new Error(`Network request failed. Please check if:
1. The Bitcoin node is running
2. The RPC port is correct (${new URL(adjustedUrl).port})
3. The node is accessible from your device
4. There are no firewall rules blocking the connection${platformSpecificAdvice}`)
          }
          throw error
        })
    },
    [rpcUser, rpcPassword, rpcUrl]
  )

  const formatTemplateData = useCallback((data: BlockTemplate) => {
    try {
      // Only show essential fields to reduce data size
      const essentialData = {
        ...data,
        transactions: data.transactions?.length || 0,
        transactionSample:
          data.transactions
            ?.slice(0, 20)
            .map((tx: BlockTemplateTransaction) => ({
              txid: tx.txid,
              fee: tx.fee,
              weight: tx.weight
            })) || []
      }
      return JSON.stringify(essentialData, null, 2)
    } catch {
      return 'Error formatting template data'
    }
  }, [])

  const fetchBlockTemplate = useCallback(async () => {
    if (!isConnected) return

    const now = Date.now()
    if (now - lastTemplateUpdateRef.current < 30000) {
      return
    }

    setIsLoadingTemplate(true)
    try {
      const rules = ['segwit']

      try {
        const networkResponse = await fetchRpc({
          jsonrpc: '1.0',
          id: '1',
          method: 'getblockchaininfo',
          params: []
        })

        if (networkResponse.ok) {
          const networkData = (await networkResponse.json()) as {
            result?: BlockchainInfo
          }

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

      const response = await fetchRpc({
        jsonrpc: '1.0',
        id: '1',
        method: 'getblocktemplate',
        params: [{ rules }]
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error ${response.status}: ${errorText}`)
      }

      const data = (await response.json()) as {
        result?: BlockTemplate
        error?: {
          message: string
          code: number
        }
      }

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
  }, [isConnected, formatTemplateData, fetchRpc, blockTemplate])

  const fetchBlockchainInfo = useCallback(async () => {
    if (!isConnected) return

    setIsLoadingInfo(true)
    try {
      const response = await fetchRpc({
        jsonrpc: '1.0',
        id: '1',
        method: 'getblockchaininfo',
        params: []
      })

      if (!response.ok) {
        throw new Error('Failed to fetch blockchain info')
      }

      const data = (await response.json()) as {
        result?: BlockchainInfo
        error?: {
          message: string
          code: number
        }
      }

      if (data.error || !data.result) {
        throw new Error(data.error?.message || 'RPC error')
      }

      setBlockchainInfo(data.result)
      // Fetch block template after successful blockchain info
      fetchBlockTemplate()
    } catch {
      setConnectionError('Failed to fetch blockchain info')
    } finally {
      setIsLoadingInfo(false)
    }
  }, [isConnected, fetchBlockTemplate, fetchRpc])

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
      const response = await fetchRpc({
        jsonrpc: '1.0',
        id: '1',
        method: 'getblockchaininfo',
        params: []
      })

      if (!response.ok) {
        const errorText = await response.text()

        if (response.status === 401) {
          throw new Error('Invalid credentials')
        } else if (response.status === 403) {
          throw new Error('Access denied')
        } else {
          throw new Error(
            `Failed to connect to Bitcoin node: ${response.status} ${errorText}`
          )
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

  const validateBlockTemplate = (template: BlockTemplate) => {
    console.log('🔍 Validating block template:', {
      version: template.version,
      previousblockhash: template.previousblockhash,
      bits: template.bits,
      height: template.height,
      curtime: template.curtime,
      mintime: template.mintime,
      maxtime: template.maxtime,
      transactions: template.transactions?.length || 0,
      coinbasevalue: template.coinbasevalue,
      isRegtest: template.bits === '207fffff',
      // Verify template fields are present and valid
      hasValidVersion: typeof template.version === 'number',
      hasValidPrevBlock:
        typeof template.previousblockhash === 'string' &&
        template.previousblockhash.length === 64,
      hasValidBits:
        typeof template.bits === 'string' && template.bits.length === 8,
      hasValidHeight:
        typeof template.height === 'number' && template.height > 0,
      hasValidTime:
        typeof template.curtime === 'number' &&
        typeof template.mintime === 'number' &&
        typeof template.maxtime === 'number' &&
        template.curtime >= template.mintime &&
        template.curtime <= template.maxtime,
      hasValidCoinbase:
        typeof template.coinbasevalue === 'number' && template.coinbasevalue > 0
    })

    // Validate required fields
    if (
      !template.version ||
      !template.previousblockhash ||
      !template.bits ||
      !template.height
    ) {
      throw new Error('Block template missing required fields')
    }

    // Validate time constraints
    const now = Math.floor(Date.now() / 1000)
    if (
      template.curtime < template.mintime ||
      template.curtime > template.maxtime
    ) {
      throw new Error(
        `Invalid block time: ${template.curtime} (must be between ${template.mintime} and ${template.maxtime})`
      )
    }

    // Validate regtest-specific fields
    if (template.bits === '207fffff') {
      // Regtest difficulty
      console.log('✅ Valid regtest template detected')
    }

    return true
  }

  const createCoinbaseTransaction = useCallback(
    (template: BlockTemplate): BlockTemplateTransaction | null => {
      if (!template || !miningAddress) {
        return null
      }

      try {
        // Validate template first
        validateBlockTemplate(template)

        // Use the helper function to determine the correct network
        const network = getNetworkFromAddress(miningAddress)

        console.log('🔍 Creating coinbase transaction:', {
          address: miningAddress,
          network: network.bech32 || 'unknown',
          isRegtest: network === networks.regtest,
          networkType:
            network === networks.regtest
              ? 'regtest'
              : network === networks.mainnet
                ? 'mainnet'
                : network === networks.testnet
                  ? 'testnet'
                  : 'signet',
          coinbaseValue: template.coinbasevalue,
          height: template.height,
          // Verify coinbase requirements
          hasValidHeight:
            typeof template.height === 'number' && template.height > 0,
          hasValidReward:
            typeof template.coinbasevalue === 'number' &&
            template.coinbasevalue > 0,
          hasValidAddress:
            miningAddress.startsWith('bcrt1') ||
            miningAddress.startsWith('bcrt')
        })

        const tx = new bitcoin.Transaction()
        tx.version = 1
        tx.locktime = 0

        // Create coinbase input with proper height encoding
        const height = template.height
        const heightBytes = Buffer.alloc(4)
        heightBytes.writeUInt32LE(height, 0)

        // Create coinbase script with height and arbitrary data
        const coinbaseScript = bitcoin.script.compile([
          heightBytes,
          Buffer.from(`Satsigner ${Date.now()}`)
        ])

        // Verify coinbase script
        console.log('🔍 Coinbase script:', {
          height: height,
          heightHex: heightBytes.toString('hex'),
          scriptHex: coinbaseScript.toString('hex'),
          scriptLength: coinbaseScript.length,
          // Verify script requirements
          hasHeight: coinbaseScript.length >= 4,
          hasValidHeight: heightBytes.readUInt32LE(0) === height
        })

        tx.addInput(
          Buffer.alloc(32), // Previous txid (32 bytes of zeros for coinbase)
          0xffffffff, // Previous vout (0xffffffff for coinbase)
          0xffffffff, // Sequence (0xffffffff for coinbase)
          coinbaseScript
        )

        try {
          const outputScript = bitcoin.address.toOutputScript(
            miningAddress,
            network
          )
          tx.addOutput(outputScript, template.coinbasevalue)

          // Verify output
          console.log('🔍 Coinbase output:', {
            address: miningAddress,
            value: template.coinbasevalue,
            scriptHex: outputScript.toString('hex'),
            // Verify output requirements
            hasValidValue: template.coinbasevalue > 0,
            hasValidScript: outputScript.length > 0
          })
        } catch (error) {
          console.error('❌ Error creating output script:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            address: miningAddress,
            network: network.bech32 || 'unknown',
            isRegtest: network === networks.regtest
          })
          throw error
        }

        if (opReturnContent) {
          const data = Buffer.from(opReturnContent)
          const script = bitcoin.script.compile([
            bitcoin.opcodes.OP_RETURN,
            data
          ])
          tx.addOutput(script, 0)
        }

        // Verify transaction is valid
        if (!tx.isCoinbase()) {
          throw new Error('Generated transaction is not a valid coinbase')
        }

        // Verify final transaction
        console.log('🔍 Final coinbase transaction:', {
          txid: tx.getId(),
          hex: tx.toHex(),
          isCoinbase: tx.isCoinbase(),
          inputCount: tx.ins.length,
          outputCount: tx.outs.length,
          // Verify transaction requirements
          hasValidInput:
            tx.ins.length === 1 && tx.ins[0].sequence === 0xffffffff,
          hasValidOutput:
            tx.outs.length > 0 && tx.outs[0].value === template.coinbasevalue,
          hasValidTxid: tx.getId().length === 64
        })

        return {
          data: tx.toHex(),
          hash: tx.getHash().toString('hex'),
          txid: tx.getId(),
          depends: []
        }
      } catch (error) {
        console.error('❌ Coinbase transaction creation error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          address: miningAddress,
          network: getNetworkFromAddress(miningAddress).bech32 || 'unknown'
        })
        throw error
      }
    },
    [miningAddress, opReturnContent]
  )

  const createMerkleRoot = useCallback(
    (transactions: BlockTemplateTransaction[]) => {
      if (!transactions || transactions.length === 0) {
        return ''
      }

      try {
        // Convert txids to little-endian for merkle root calculation
        let hashes = transactions.map((tx) => {
          if (!tx) {
            throw new Error('Invalid transaction')
          }
          if (tx.txid) {
            // Convert txid to little-endian for merkle root
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
            // Concatenate hashes and double SHA256
            const concat = Buffer.concat([left, right])
            const hash = bitcoin.crypto.sha256(bitcoin.crypto.sha256(concat))
            newHashes.push(hash)
          }
          hashes = newHashes
        }

        if (!hashes[0]) {
          throw new Error('Failed to create merkle root: no hash generated')
        }

        // Return merkle root in little-endian (as required by block header)
        return hashes[0].toString('hex')
      } catch (error) {
        throw new Error(
          'Failed to create merkle root: ' +
            (error instanceof Error ? error.message : 'Unknown error')
        )
      }
    },
    []
  )

  const createBlockHeader = useCallback(
    (
      template: BlockTemplate,
      merkleRoot: string,
      timestamp: number,
      nonce: number
    ) => {
      // Validate template first
      validateBlockTemplate(template)

      console.log('🔨 Creating block header:', {
        version: template.version,
        prevBlock: template.previousblockhash,
        merkleRoot,
        timestamp,
        bits: template.bits,
        nonce,
        isRegtest: template.bits === '207fffff',
        // Verify header requirements
        hasValidVersion: typeof template.version === 'number',
        hasValidPrevBlock: template.previousblockhash.length === 64,
        hasValidMerkle: merkleRoot.length === 64,
        hasValidTime:
          timestamp >= template.mintime && timestamp <= template.maxtime,
        hasValidBits: template.bits.length === 8,
        hasValidNonce:
          typeof nonce === 'number' && nonce >= 0 && nonce <= 0xffffffff
      })

      // Create header buffer (80 bytes)
      const header = Buffer.alloc(80)

      // Version (4 bytes) - little endian
      header.writeUInt32LE(template.version, 0)

      // Previous block hash (32 bytes) - little endian
      const prevHash = Buffer.from(template.previousblockhash, 'hex')
      prevHash.copy(header, 4)

      // Merkle root (32 bytes) - little endian
      const merkle = Buffer.from(merkleRoot, 'hex')
      merkle.copy(header, 36)

      // Timestamp (4 bytes) - little endian
      header.writeUInt32LE(timestamp, 68)

      // Bits (4 bytes) - little endian
      const bits = Buffer.from(template.bits, 'hex')
      bits.copy(header, 72)

      // Nonce (4 bytes) - little endian
      header.writeUInt32LE(nonce, 76)

      // Verify header bytes
      console.log('🔨 Block header bytes:', {
        version: header.slice(0, 4).toString('hex'),
        prevBlock: header.slice(4, 36).toString('hex'),
        merkleRoot: header.slice(36, 68).toString('hex'),
        timestamp: header.slice(68, 72).toString('hex'),
        bits: header.slice(72, 76).toString('hex'),
        nonce: header.slice(76, 80).toString('hex'),
        fullHeader: header.toString('hex'),
        // Verify header requirements
        hasValidLength: header.length === 80,
        hasValidVersion: header.readUInt32LE(0) === template.version,
        hasValidPrevBlock:
          header.slice(4, 36).toString('hex') === template.previousblockhash,
        hasValidMerkle: header.slice(36, 68).toString('hex') === merkleRoot,
        hasValidTime: header.readUInt32LE(68) === timestamp,
        hasValidBits: header.slice(72, 76).toString('hex') === template.bits,
        hasValidNonce: header.readUInt32LE(76) === nonce
      })

      return header
    },
    []
  )

  const checkDifficulty = (hash: string, bits: string) => {
    const bitsNum = parseInt(bits, 16)
    const nSize = bitsNum >> 24
    const nWord = bitsNum & 0x007fffff

    // Calculate target from bits
    let targetNum: bigint
    if (nSize <= 3) {
      targetNum = BigInt(nWord >> (8 * (3 - nSize)))
    } else {
      targetNum = BigInt(nWord) << BigInt(8 * (nSize - 3))
    }

    // The hash from sha256 is in big-endian, so we need to reverse it for comparison
    const hashBytes = Buffer.from(hash, 'hex')
    const hashReversed = Buffer.from(hashBytes).reverse()
    const hashNum = BigInt('0x' + hashReversed.toString('hex'))

    // In Bitcoin, a valid block hash must be LESS than or EQUAL to the target
    const isValid = hashNum <= targetNum

    console.log('🔍 Difficulty check details:', {
      bits,
      nSize,
      nWord: nWord.toString(16),
      targetHex: targetNum.toString(16),
      originalHash: hash,
      hashReversed: hashReversed.toString('hex'),
      hashNum: hashNum.toString(16),
      targetNum: targetNum.toString(16),
      isValid,
      comparison: `${hashNum.toString(16)} <= ${targetNum.toString(16)}`,
      decimalComparison: `${hashNum} <= ${targetNum}`
    })

    if (targetNum === BigInt(0)) {
      throw new Error('Invalid target calculation - target is zero')
    }

    return isValid
  }

  const submitBlock = useCallback(
    async (
      blockHeader: Buffer,
      coinbaseTx: BlockTemplateTransaction,
      transactions: BlockTemplateTransaction[]
    ) => {
      try {
        // Calculate block hash in big-endian (as returned by sha256)
        const hash = bitcoin.crypto.sha256(bitcoin.crypto.sha256(blockHeader))
        // Convert to little-endian for submission (node expects little-endian)
        const hashReversed = Buffer.from(hash).reverse()
        const blockHash = hashReversed.toString('hex')

        // Get all transaction data in hex format
        const rawTransactions = [coinbaseTx, ...transactions].map((tx) => {
          if (!tx.data) {
            throw new Error('Transaction data missing')
          }
          return tx.data
        })

        // Create varint for transaction count
        const txCount = Buffer.alloc(1)
        txCount.writeUInt8(rawTransactions.length, 0)

        // Create block data with header and all transactions
        const blockData = Buffer.concat([
          blockHeader,
          txCount,
          ...rawTransactions.map((tx) => Buffer.from(tx, 'hex'))
        ])

        // Log full block details before submission
        console.log('📦 Full block details before submission:', {
          blockHash,
          blockSize: blockData.length,
          header: {
            version: blockHeader.readUInt32LE(0),
            prevBlock: blockHeader.slice(4, 36).toString('hex'),
            merkleRoot: blockHeader.slice(36, 68).toString('hex'),
            timestamp: blockHeader.readUInt32LE(68),
            bits: blockHeader.slice(72, 76).toString('hex'),
            nonce: blockHeader.readUInt32LE(76),
            raw: blockHeader.toString('hex')
          },
          transactions: {
            count: rawTransactions.length,
            coinbase: {
              txid: coinbaseTx.txid,
              hash: coinbaseTx.hash,
              data: coinbaseTx.data,
              size: Buffer.from(coinbaseTx.data, 'hex').length
            },
            mempool: transactions.map((tx) => ({
              txid: tx.txid,
              hash: tx.hash,
              size: tx.data ? Buffer.from(tx.data, 'hex').length : 0
            }))
          },
          rawBlock: {
            header: blockHeader.toString('hex'),
            txCount: txCount.toString('hex'),
            transactions: rawTransactions,
            fullBlock: blockData.toString('hex')
          },
          template: {
            age:
              Math.floor((Date.now() - lastTemplateUpdateRef.current) / 1000) +
              ' seconds',
            height: blockTemplate?.height,
            bits: blockTemplate?.bits,
            version: blockTemplate?.version,
            curtime: blockTemplate?.curtime,
            mintime: blockTemplate?.mintime
          }
        })

        console.log('📤 Submitting block to node:', {
          blockHash,
          blockSize: blockData.length,
          firstBytes: blockData.slice(0, 32).toString('hex') + '...',
          headerHex: blockHeader.toString('hex'),
          templateAge:
            Math.floor((Date.now() - lastTemplateUpdateRef.current) / 1000) +
            ' seconds'
        })

        const response = await fetchRpc({
          jsonrpc: '1.0',
          id: '1',
          method: 'submitblock',
          params: [blockData.toString('hex')]
        })

        console.log('📥 Node response status:', {
          status: response.status,
          statusText: response.statusText
        })

        const data = await response.json()
        console.log('📥 Node response data:', data)

        if (data.error) {
          throw new Error(`Block submission rejected: ${data.error}`)
        }

        if (data.result !== null) {
          throw new Error(`Block submission rejected: ${data.result}`)
        }

        console.log('✅ Block accepted by node:', {
          blockHash,
          blockSize: blockData.length,
          templateAge:
            Math.floor((Date.now() - lastTemplateUpdateRef.current) / 1000) +
            ' seconds'
        })

        setBlocksFound((prev) => prev + 1)
        return true
      } catch (error) {
        console.error('❌ Block submission error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
        return false
      }
    },
    [fetchRpc, fetchBlockTemplate]
  )

  const handleMiningAddressChange = (address: string) => {
    const isValid =
      address.startsWith('bcrt1') ||
      address.startsWith('bcrt') ||
      address.startsWith('bc1') ||
      address.startsWith('bc') ||
      address.startsWith('tb1') ||
      address.startsWith('tb')

    setMiningAddress(address)
    setIsValidAddress(isValid)
  }

  const startMining = useCallback(async () => {
    if (!blockTemplate || !miningAddress) {
      toast.error('Missing block template or mining address')
      return
    }

    if (!isValidAddress) {
      toast.error('Invalid mining address')
      return
    }

    try {
      // Validate network and address first
      const networkResponse = await fetchRpc({
        jsonrpc: '1.0',
        id: '1',
        method: 'getblockchaininfo',
        params: []
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

      // Validate address for network
      if (nodeNetwork === 'regtest') {
        const isValidRegtest =
          miningAddress.startsWith('bcrt1') || miningAddress.startsWith('bcrt')
        if (!isValidRegtest) {
          toast.error(
            `Address ${miningAddress} has the wrong prefix for regtest network. Use an address starting with bcrt1 or bcrt`
          )
          return
        }
      } else if (nodeNetwork === 'main') {
        if (
          !miningAddress.startsWith('bc1') &&
          !miningAddress.startsWith('bc')
        ) {
          toast.error(
            `Address ${miningAddress} has the wrong prefix for mainnet network. Use an address starting with bc1 or bc`
          )
          return
        }
      } else if (nodeNetwork === 'test' || nodeNetwork === 'signet') {
        if (
          !miningAddress.startsWith('tb1') &&
          !miningAddress.startsWith('tb')
        ) {
          toast.error(
            `Address ${miningAddress} has the wrong prefix for ${nodeNetwork} network. Use an address starting with tb1 or tb`
          )
          return
        }
      }

      // Get fresh template before starting mining
      console.log('🔄 Getting fresh template before starting mining...')
      await fetchBlockTemplate()

      if (!blockTemplate) {
        throw new Error('Failed to get block template')
      }

      setIsMining(true)
      isMiningRef.current = true

      try {
        let nonce = 0
        const startTime = Date.now()
        let hashes = 0
        let lastLogTime = startTime
        let lastTemplateCheck = startTime

        const miningInterval = setInterval(async () => {
          if (!isMiningRef.current) {
            clearInterval(miningInterval)
            return
          }

          try {
            // Check template freshness every 2 seconds
            const now = Date.now()
            if (now - lastTemplateCheck > 2000) {
              lastTemplateCheck = now
              if (now - lastTemplateUpdateRef.current > 5000) {
                console.log('🔄 Template is stale, refreshing...')
                await fetchBlockTemplate()
                // After refreshing template, we need to start a new mining cycle
                // since the previous block hash has changed
                clearInterval(miningInterval)
                isMiningRef.current = false
                setIsMining(false)
                startMining() // Restart mining with new template
                return
              }
            }

            for (let i = 0; i < miningIntensity; i++) {
              if (!isMiningRef.current) {
                clearInterval(miningInterval)
                return
              }

              // Create new coinbase transaction for each attempt
              const coinbaseTx = createCoinbaseTransaction(blockTemplate)
              if (!coinbaseTx) {
                throw new Error('Failed to create coinbase transaction')
              }

              // Recalculate merkle root with new coinbase
              const allTransactions: BlockTemplateTransaction[] = [
                coinbaseTx,
                ...(blockTemplate.transactions || [])
              ]
              const merkleRoot = createMerkleRoot(allTransactions)
              if (!merkleRoot) {
                throw new Error('Failed to create merkle root')
              }

              const timestamp = Math.floor(Date.now() / 1000)
              const header = createBlockHeader(
                blockTemplate,
                merkleRoot,
                timestamp,
                nonce++
              )
              currentHeaderRef.current = header

              // Double SHA256 of header (result is in big-endian)
              const hash = bitcoin.crypto.sha256(bitcoin.crypto.sha256(header))
              const hashHex = Buffer.from(hash).toString('hex')

              hashes++

              if (hashes % 1000 === 0) {
                // For logging, show both big-endian and little-endian versions
                const hashReversed = Buffer.from(hashHex, 'hex').reverse()
                console.log('⛏️ Mining attempt:', {
                  nonce,
                  timestamp,
                  hashBigEndian: hashHex,
                  hashLittleEndian: hashReversed.toString('hex'),
                  headerHex: Buffer.from(header).toString('hex'),
                  bits: blockTemplate.bits,
                  isRegtest: blockTemplate.bits === '207fffff',
                  merkleRoot,
                  templateAge:
                    Math.floor((now - lastTemplateUpdateRef.current) / 1000) +
                    ' seconds'
                })
                lastHashRef.current = hashHex
              }

              if (checkDifficulty(hashHex, blockTemplate.bits)) {
                console.log('🎯 Found valid block:', {
                  nonce,
                  timestamp,
                  hashBigEndian: hashHex,
                  hashLittleEndian: Buffer.from(hashHex, 'hex')
                    .reverse()
                    .toString('hex'),
                  headerHex: Buffer.from(header).toString('hex'),
                  bits: blockTemplate.bits,
                  isRegtest: blockTemplate.bits === '207fffff',
                  merkleRoot,
                  templateAge:
                    Math.floor((now - lastTemplateUpdateRef.current) / 1000) +
                    ' seconds'
                })

                const success = await submitBlock(
                  header,
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
        throw error
      }
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
    fetchRpc,
    submitBlock,
    miningIntensity,
    blockchainInfo?.chain
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

  const fetchTransaction = useCallback(async () => {
    if (!txId || !isConnected) return

    setIsLoadingTx(true)
    setTxError('')

    try {
      const response = await fetchRpc({
        jsonrpc: '1.0',
        id: '1',
        method: 'getrawtransaction',
        params: [txId, true]
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
  }, [txId, isConnected, blockTemplate, formatTemplateData, fetchRpc])

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
                  {blockTemplate?.curtime
                    ? Math.floor(
                        (Date.now() / 1000 - blockTemplate.curtime) / 60
                      )
                    : '0'}
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
