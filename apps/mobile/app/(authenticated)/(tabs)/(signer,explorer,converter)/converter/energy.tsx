import { Stack } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

export default function Energy() {
  const [blocksFound, _setBlocksFound] = useState(0)
  const [hashRate, _setHashRate] = useState('##,###')
  const [energyRate, _setEnergyRate] = useState('##.##')
  const [totalSats, _setTotalSats] = useState('0')
  const [isMining, setIsMining] = useState(false)
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
  const [templateError, setTemplateError] = useState('')
  const [templateData, setTemplateData] = useState<string>('')

  const _formatTemplateData = (data: any) => {
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
  }

  const _fetchBlockTemplate = useCallback(async () => {
    if (!isConnected) return

    setIsLoadingTemplate(true)
    setTemplateError('')
    setTemplateData('')
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
          method: 'getblocktemplate',
          params: [
            {
              rules: ['segwit']
            }
          ]
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch block template')
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message || 'RPC error')
      }

      setBlockTemplate(data.result)
      // Format and set the template data
      setTemplateData(_formatTemplateData(data.result))
    } catch (_error) {
      setTemplateError('Failed to fetch block template')
    } finally {
      setIsLoadingTemplate(false)
    }
  }, [isConnected, rpcUrl, rpcUser, rpcPassword])

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

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={styles.headerTitle}>
              {t('converter.energy.title')}
            </SSText>
          )
        }}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <SSVStack
          gap="xl"
          style={[styles.mainContent, { alignItems: 'center' }]}
        >
          <SSVStack gap="sm" style={{ alignItems: 'center' }}>
            <SSText size="sm" color="muted">
              {blocksFound} Blocks Found
            </SSText>
            <SSText size="lg" color="muted">
              Not Mining
            </SSText>
          </SSVStack>

          <SSHStack gap="xl" style={{ alignItems: 'center' }}>
            <SSVStack style={{ alignItems: 'center' }}>
              <SSText size="2xl" style={styles.bigNumber}>
                {hashRate}
              </SSText>
              <SSText size="sm" color="muted">
                hash/s
              </SSText>
            </SSVStack>

            <SSVStack style={{ alignItems: 'center' }}>
              <SSText size="2xl" style={styles.bigNumber}>
                {energyRate}
              </SSText>
              <SSText size="sm" color="muted">
                mAh/min
              </SSText>
            </SSVStack>
          </SSHStack>

          <View style={styles.graphPlaceholder} />

          <SSVStack style={{ alignItems: 'center' }} gap="sm">
            <SSText size="3xl" style={styles.bigNumber}>
              {totalSats}
            </SSText>
            <SSText size="lg" color="muted">
              sats
            </SSText>
          </SSVStack>

          <SSVStack gap="md" style={styles.statsContainer}>
            <SSVStack gap="sm">
              <SSText color="muted">Current Block Hash</SSText>
              <SSText size="xs" type="mono" color="muted">
                411fdcad41fdcde7b28f645ef86ca3c9dba92283ad41fdcfe7b931d6b77c2
              </SSText>
            </SSVStack>

            <SSVStack gap="sm">
              <SSText color="muted">Best Block Hash</SSText>
              <SSText size="xs" type="mono" color="muted">
                000000ad41fdcde7b28f645ef86ca3c9dba92283ad41fdcfe7b931d6b77c2
              </SSText>
            </SSVStack>

            <SSVStack gap="sm">
              <SSText color="muted">Difficulty Target</SSText>
              <SSText size="xs" type="mono" color="muted">
                00000000000000000000########################################
              </SSText>
            </SSVStack>

            <View style={styles.difficultyBar}>
              <View style={styles.difficultyProgress} />
            </View>
            <SSText size="xs" color="muted" style={styles.centered}>
              Difficulty Adjustment
            </SSText>
          </SSVStack>

          <SSVStack gap="lg" style={styles.statsGrid}>
            <SSHStack justifyBetween>
              <SSVStack style={{ alignItems: 'center' }}>
                <SSText size="xl">{blockchainInfo?.blocks || '0'}</SSText>
                <SSText size="xs" color="muted">
                  Block Candidate
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'center' }}>
                <SSText size="xl">
                  {(blockTemplate?.coinbasevalue / 100000000).toFixed(4) || '0'}{' '}
                  BTC
                </SSText>
                <SSText size="xs" color="muted">
                  Reward
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'center' }}>
                <SSText size="xl">
                  {blockTemplate?.transactions?.length || '0'}
                </SSText>
                <SSText size="xs" color="muted">
                  Transactions
                </SSText>
              </SSVStack>
            </SSHStack>

            <SSHStack justifyBetween>
              <SSVStack style={{ alignItems: 'center' }}>
                <SSText size="xl">
                  {blockTemplate?.transactions?.length || '0'}
                </SSText>
                <SSText size="xs" color="muted">
                  Transactions
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'center' }}>
                <SSText size="xl">{blockTemplate?.sizelimit || '0'}</SSText>
                <SSText size="xs" color="muted">
                  Size
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'center' }}>
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
              <SSVStack style={{ alignItems: 'center' }}>
                <SSText size="xl">n/a</SSText>
                <SSText size="xs" color="muted">
                  Template
                </SSText>
              </SSVStack>
              <SSVStack style={{ alignItems: 'center' }}>
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
                align="left"
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label="RPC Username" />
              <SSTextInput
                placeholder="Enter RPC username"
                value={rpcUser}
                onChangeText={setRpcUser}
                variant="outline"
                align="left"
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label="RPC Password" />
              <SSTextInput
                placeholder="Enter RPC password"
                value={rpcPassword}
                onChangeText={setRpcPassword}
                variant="outline"
                align="left"
                secureTextEntry
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
        </SSVStack>

        {isConnected && blockchainInfo && (
          <SSVStack gap="md" style={styles.infoContainer}>
            <SSText
              size="sm"
              color="muted"
              uppercase
              style={styles.sectionTitle}
            >
              Node Information
            </SSText>
            <SSVStack gap="sm" style={styles.infoGrid}>
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
              <SSHStack justifyBetween>
                <SSText color="muted">Best Block Hash</SSText>
                <SSText size="xs" type="mono">
                  {blockchainInfo.bestblockhash}
                </SSText>
              </SSHStack>
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
            </SSVStack>
            <SSButton
              label="REFRESH INFO"
              onPress={_fetchBlockchainInfo}
              variant="outline"
              disabled={_isLoadingInfo}
            />
          </SSVStack>
        )}

        <SSVStack gap="md" style={styles.buttonContainer}>
          <SSButton
            label={isMining ? 'STOP MINING' : 'START MINING'}
            onPress={() => setIsMining(!isMining)}
            variant={isMining ? 'danger' : 'default'}
            disabled={!isConnected}
          />
          <SSButton
            label="JOIN POOL"
            onPress={() => {}}
            variant="outline"
            disabled
          />
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
            ) : templateError ? (
              <SSVStack style={styles.errorContainer}>
                <SSText color="muted" style={styles.errorText}>
                  {templateError}
                </SSText>
              </SSVStack>
            ) : templateData ? (
              <ScrollView style={styles.templateScroll}>
                <SSText size="xs" type="mono" style={styles.templateText}>
                  {templateData}
                </SSText>
              </ScrollView>
            ) : null}
            <SSButton
              label="REFRESH TEMPLATE"
              onPress={_fetchBlockTemplate}
              variant="outline"
              disabled={isLoadingTemplate}
            />
          </SSVStack>
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  headerTitle: {
    letterSpacing: 1
  },
  container: {
    flexGrow: 1,
    backgroundColor: Colors.black
  },
  mainContent: {
    flex: 1,
    padding: 20
  },
  bigNumber: {
    fontWeight: '200'
  },
  graphPlaceholder: {
    width: '100%',
    height: 100,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[800]
  },
  statsContainer: {
    width: '100%',
    paddingVertical: 20
  },
  difficultyBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.gray[900],
    borderRadius: 2,
    marginVertical: 10
  },
  difficultyProgress: {
    width: '30%',
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 2
  },
  centered: {
    textAlign: 'center'
  },
  statsGrid: {
    width: '100%'
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: 40
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 20
  },
  sectionTitle: {
    marginBottom: 16
  },
  errorText: {
    marginTop: 8,
    textAlign: 'center'
  },
  infoContainer: {
    padding: 20,
    paddingTop: 0
  },
  infoGrid: {
    backgroundColor: Colors.gray[900],
    padding: 16,
    borderRadius: 8
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
    fontSize: 10 // Smaller font size for better performance
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
  }
})
