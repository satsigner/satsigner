/**
 * Network Diagnostics Utility
 *
 * Comprehensive tests to diagnose network connectivity issues in React Native
 */

import NetInfo from '@react-native-community/netinfo'
import TcpSocket from 'react-native-tcp-socket'

import ElectrumClient from '@/api/electrum'

export interface DiagnosticResult {
  test: string
  success: boolean
  timing?: number
  error?: string
  details?: string
}

export interface NetworkDiagnosticsReport {
  timestamp: string
  results: DiagnosticResult[]
  summary: {
    total: number
    passed: number
    failed: number
  }
}

const LOG_PREFIX = '[NetworkDiag]'

function log(message: string, ...args: unknown[]) {
  if (__DEV__) {
    console.warn(LOG_PREFIX, message, ...args)
  }
}

/**
 * Test 1: Check NetInfo state
 */
async function testNetInfo(): Promise<DiagnosticResult> {
  log('Testing NetInfo...')
  try {
    const state = await NetInfo.fetch()
    const details = `type=${state.type}, isConnected=${state.isConnected}, isInternetReachable=${state.isInternetReachable}`
    log('NetInfo result:', details)

    return {
      test: 'NetInfo State',
      success: state.isConnected === true,
      details
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log('NetInfo failed:', errorMsg)
    return {
      test: 'NetInfo State',
      success: false,
      error: errorMsg
    }
  }
}

/**
 * Test 2: Basic HTTP fetch to multiple endpoints
 */
async function testHttpFetch(
  url: string,
  label: string
): Promise<DiagnosticResult> {
  log(`Testing HTTP fetch: ${label} (${url})...`)
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    const timing = Date.now() - startTime

    log(`HTTP fetch ${label}: status=${response.status} in ${timing}ms`)

    return {
      test: `HTTP: ${label}`,
      success: response.ok,
      timing,
      details: `status=${response.status}`
    }
  } catch (error) {
    const timing = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`HTTP fetch ${label} failed after ${timing}ms:`, errorMsg)

    return {
      test: `HTTP: ${label}`,
      success: false,
      timing,
      error: errorMsg
    }
  }
}

/**
 * Test 3: WebSocket connectivity
 */
async function testWebSocket(
  url: string,
  label: string
): Promise<DiagnosticResult> {
  log(`Testing WebSocket: ${label} (${url})...`)
  const startTime = Date.now()

  return new Promise((resolve) => {
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        log(`WebSocket ${label}: TIMEOUT after 10000ms`)
        resolve({
          test: `WebSocket: ${label}`,
          success: false,
          timing: 10000,
          error: 'Connection timeout (10s)'
        })
      }
    }, 10000)

    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          const timing = Date.now() - startTime
          log(`WebSocket ${label}: CONNECTED in ${timing}ms`)
          ws.close()
          resolve({
            test: `WebSocket: ${label}`,
            success: true,
            timing
          })
        }
      }

      ws.onerror = (event) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          const timing = Date.now() - startTime
          const errorMsg =
            (event as unknown as { message?: string })?.message ||
            'WebSocket error'
          log(`WebSocket ${label}: ERROR after ${timing}ms -`, errorMsg)
          resolve({
            test: `WebSocket: ${label}`,
            success: false,
            timing,
            error: errorMsg
          })
        }
      }

      ws.onclose = (event) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          const timing = Date.now() - startTime
          log(
            `WebSocket ${label}: CLOSED after ${timing}ms - code=${event.code}`
          )
          resolve({
            test: `WebSocket: ${label}`,
            success: false,
            timing,
            error: `Closed unexpectedly: code=${event.code}`
          })
        }
      }
    } catch (error) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        const timing = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : String(error)
        log(`WebSocket ${label}: EXCEPTION after ${timing}ms -`, errorMsg)
        resolve({
          test: `WebSocket: ${label}`,
          success: false,
          timing,
          error: errorMsg
        })
      }
    }
  })
}

/**
 * Test 4: DNS-like resolution test via fetch to IP vs hostname
 */
async function testDnsResolution(): Promise<DiagnosticResult> {
  log('Testing DNS resolution (comparing IP vs hostname)...')

  // Test 1: Direct IP (should work if network is available)
  const ipUrl = 'https://1.1.1.1/' // Cloudflare's IP
  const hostnameUrl = 'https://one.one.one.one/' // Same service, hostname

  try {
    const controller1 = new AbortController()
    const timeout1 = setTimeout(() => controller1.abort(), 5000)

    const ipStart = Date.now()
    const ipResponse = await fetch(ipUrl, {
      method: 'HEAD',
      signal: controller1.signal
    })
    clearTimeout(timeout1)
    const ipTiming = Date.now() - ipStart
    const ipWorks = ipResponse.ok || ipResponse.status > 0

    log(`DNS test - IP fetch: ${ipWorks ? 'OK' : 'FAILED'} in ${ipTiming}ms`)

    if (!ipWorks) {
      return {
        test: 'DNS Resolution',
        success: false,
        error: 'Cannot reach IP address - no network connectivity',
        details: `IP fetch failed`
      }
    }

    // Test 2: Hostname
    const controller2 = new AbortController()
    const timeout2 = setTimeout(() => controller2.abort(), 5000)

    const hostStart = Date.now()
    try {
      const hostResponse = await fetch(hostnameUrl, {
        method: 'HEAD',
        signal: controller2.signal
      })
      clearTimeout(timeout2)
      const hostTiming = Date.now() - hostStart
      const hostWorks = hostResponse.ok || hostResponse.status > 0

      log(
        `DNS test - Hostname fetch: ${hostWorks ? 'OK' : 'FAILED'} in ${hostTiming}ms`
      )

      return {
        test: 'DNS Resolution',
        success: hostWorks,
        timing: hostTiming,
        details: `IP=${ipTiming}ms, Hostname=${hostTiming}ms`
      }
    } catch (hostError) {
      clearTimeout(timeout2)
      const hostErrorMsg =
        hostError instanceof Error ? hostError.message : String(hostError)
      log('DNS test - Hostname fetch failed:', hostErrorMsg)

      return {
        test: 'DNS Resolution',
        success: false,
        error: `IP works but hostname fails - DNS issue: ${hostErrorMsg}`,
        details: `IP=${ipTiming}ms, Hostname=FAILED`
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log('DNS test failed:', errorMsg)
    return {
      test: 'DNS Resolution',
      success: false,
      error: errorMsg
    }
  }
}

/**
 * Test 5: TCP Socket connectivity (used by Electrum)
 */
async function testTcpSocket(
  host: string,
  port: number,
  label: string
): Promise<DiagnosticResult> {
  log(`Testing TCP Socket: ${label} (${host}:${port})...`)
  const startTime = Date.now()

  return new Promise((resolve) => {
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        log(`TCP ${label}: TIMEOUT after 10000ms`)
        resolve({
          test: `TCP: ${label}`,
          success: false,
          timing: 10000,
          error: 'Connection timeout (10s)'
        })
      }
    }, 10000)

    try {
      const socket = TcpSocket.createConnection({ host, port }, () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          const timing = Date.now() - startTime
          log(`TCP ${label}: CONNECTED in ${timing}ms`)
          socket.destroy()
          resolve({
            test: `TCP: ${label}`,
            success: true,
            timing
          })
        }
      })

      socket.on('error', (error: Error) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          const timing = Date.now() - startTime
          log(`TCP ${label}: ERROR after ${timing}ms -`, error.message)
          socket.destroy()
          resolve({
            test: `TCP: ${label}`,
            success: false,
            timing,
            error: error.message
          })
        }
      })

      socket.on('close', () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          const timing = Date.now() - startTime
          log(`TCP ${label}: CLOSED unexpectedly after ${timing}ms`)
          resolve({
            test: `TCP: ${label}`,
            success: false,
            timing,
            error: 'Connection closed unexpectedly'
          })
        }
      })
    } catch (error) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        const timing = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : String(error)
        log(`TCP ${label}: EXCEPTION after ${timing}ms -`, errorMsg)
        resolve({
          test: `TCP: ${label}`,
          success: false,
          timing,
          error: errorMsg
        })
      }
    }
  })
}

/**
 * Test Electrum protocol - sends server.version request and waits for response
 */
async function testElectrumProtocol(
  host: string,
  port: number,
  label: string,
  useTls = true
): Promise<DiagnosticResult> {
  log(`Testing Electrum Protocol: ${label} (${host}:${port})...`)
  const startTime = Date.now()

  return new Promise((resolve) => {
    let resolved = false
    let dataBuffer = ''

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        log(`Electrum ${label}: TIMEOUT after 15000ms`)
        resolve({
          test: `Electrum: ${label}`,
          success: false,
          timing: 15000,
          error: 'Protocol timeout (15s)'
        })
      }
    }, 15000)

    try {
      const options: { host: string; port: number; tls?: boolean } = {
        host,
        port
      }
      if (useTls) {
        options.tls = true
      }

      const socket = TcpSocket.createConnection(options, () => {
        log(`Electrum ${label}: Connected, sending server.version...`)
        // Send Electrum JSON-RPC server.version request
        const request = JSON.stringify({
          id: 1,
          method: 'server.version',
          params: ['SatSigner', '1.4']
        })
        socket.write(request + '\n')
      })

      socket.on('data', (data: Buffer | string) => {
        if (resolved) return

        dataBuffer += data.toString()

        // Check if we have a complete JSON response
        if (dataBuffer.includes('\n')) {
          try {
            const response = JSON.parse(dataBuffer.split('\n')[0])
            if (response.result) {
              resolved = true
              clearTimeout(timeout)
              const timing = Date.now() - startTime
              const serverVersion = Array.isArray(response.result)
                ? response.result.join(' ')
                : response.result
              log(`Electrum ${label}: OK in ${timing}ms - ${serverVersion}`)
              socket.destroy()
              resolve({
                test: `Electrum: ${label}`,
                success: true,
                timing,
                details: serverVersion
              })
            }
          } catch {
            // Not valid JSON yet, wait for more data
          }
        }
      })

      socket.on('error', (error: Error) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          const timing = Date.now() - startTime
          log(`Electrum ${label}: ERROR - ${error.message}`)
          socket.destroy()
          resolve({
            test: `Electrum: ${label}`,
            success: false,
            timing,
            error: error.message
          })
        }
      })

      socket.on('close', () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          const timing = Date.now() - startTime
          log(`Electrum ${label}: CLOSED unexpectedly`)
          resolve({
            test: `Electrum: ${label}`,
            success: false,
            timing,
            error: 'Connection closed before response'
          })
        }
      })
    } catch (error) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        const errorMsg = error instanceof Error ? error.message : String(error)
        log(`Electrum ${label}: EXCEPTION - ${errorMsg}`)
        resolve({
          test: `Electrum: ${label}`,
          success: false,
          error: errorMsg
        })
      }
    }
  })
}

/**
 * Test using the app's actual ElectrumClient - this matches how the app connects
 */
async function testAppElectrumClient(
  url: string,
  network: 'bitcoin' | 'signet' | 'testnet',
  label: string
): Promise<DiagnosticResult> {
  log(`Testing App ElectrumClient: ${label} (${url})...`)
  const startTime = Date.now()

  try {
    // Use 15 second timeout to match app behavior
    const result = await ElectrumClient.test(url, network, 15000)
    const timing = Date.now() - startTime

    if (result) {
      log(`App Electrum ${label}: OK in ${timing}ms`)
      return {
        test: `App Electrum: ${label}`,
        success: true,
        timing
      }
    } else {
      log(`App Electrum ${label}: FAILED in ${timing}ms`)
      return {
        test: `App Electrum: ${label}`,
        success: false,
        timing,
        error: 'Connection failed'
      }
    }
  } catch (error) {
    const timing = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`App Electrum ${label}: ERROR - ${errorMsg}`)
    return {
      test: `App Electrum: ${label}`,
      success: false,
      timing,
      error: errorMsg
    }
  }
}

/**
 * Test fetching actual wallet data - checks if we can get balance for a sample segwit address
 */
async function testSegwitWalletData(
  url: string,
  network: 'bitcoin' | 'signet' | 'testnet',
  label: string
): Promise<DiagnosticResult> {
  log(`Testing Segwit Wallet Data: ${label}...`)
  const startTime = Date.now()

  // Sample segwit addresses for each network with known activity
  const sampleAddresses: Record<string, string> = {
    // Mempool.space donation address (mainnet native segwit)
    bitcoin: 'bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97',
    // Signet faucet address
    signet: 'tb1pn202yeugfa25nssxk2hv902kmxrnp7g9xt487u256n20jgahuwasdcjfdw',
    // Testnet faucet address
    testnet: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
  }

  const address = sampleAddresses[network]
  if (!address) {
    return {
      test: `Wallet Data: ${label}`,
      success: false,
      error: `No sample address for network: ${network}`
    }
  }

  try {
    const client = ElectrumClient.fromUrl(url, network)
    await client.init()

    const balance = await client.getAddressBalance(address)
    const timing = Date.now() - startTime

    client.close()

    log(
      `Wallet Data ${label}: OK in ${timing}ms - confirmed=${balance.confirmed}, unconfirmed=${balance.unconfirmed}`
    )

    return {
      test: `Wallet Data: ${label}`,
      success: true,
      timing,
      details: `confirmed=${balance.confirmed}, unconfirmed=${balance.unconfirmed}`
    }
  } catch (error) {
    const timing = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`Wallet Data ${label}: ERROR - ${errorMsg}`)
    return {
      test: `Wallet Data: ${label}`,
      success: false,
      timing,
      error: errorMsg
    }
  }
}

/**
 * Test 6: XMLHttpRequest (alternative to fetch)
 */
async function testXHR(url: string): Promise<DiagnosticResult> {
  log(`Testing XMLHttpRequest: ${url}...`)
  const startTime = Date.now()

  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest()
      xhr.timeout = 10000

      xhr.onload = () => {
        const timing = Date.now() - startTime
        log(`XHR: status=${xhr.status} in ${timing}ms`)
        resolve({
          test: 'XMLHttpRequest',
          success: xhr.status >= 200 && xhr.status < 400,
          timing,
          details: `status=${xhr.status}`
        })
      }

      xhr.onerror = () => {
        const timing = Date.now() - startTime
        log(`XHR: ERROR after ${timing}ms`)
        resolve({
          test: 'XMLHttpRequest',
          success: false,
          timing,
          error: 'XHR request failed'
        })
      }

      xhr.ontimeout = () => {
        log('XHR: TIMEOUT')
        resolve({
          test: 'XMLHttpRequest',
          success: false,
          timing: 10000,
          error: 'XHR timeout (10s)'
        })
      }

      xhr.open('GET', url)
      xhr.send()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      log('XHR exception:', errorMsg)
      resolve({
        test: 'XMLHttpRequest',
        success: false,
        error: errorMsg
      })
    }
  })
}

/**
 * Run all network diagnostics
 */
export async function runNetworkDiagnostics(): Promise<NetworkDiagnosticsReport> {
  log('========================================')
  log('    NETWORK DIAGNOSTICS STARTING')
  log('========================================')

  const results: DiagnosticResult[] = []

  // Test 1: NetInfo
  results.push(await testNetInfo())

  // Test 2: DNS Resolution
  results.push(await testDnsResolution())

  // Test 3: HTTP fetch tests
  const httpTests = [
    { url: 'https://httpbin.org/get', label: 'httpbin.org' },
    { url: 'https://api.github.com', label: 'GitHub API' },
    {
      url: 'https://mempool.space/api/blocks/tip/height',
      label: 'mempool.space'
    }
  ]

  for (const test of httpTests) {
    results.push(await testHttpFetch(test.url, test.label))
  }

  // Test 4: XMLHttpRequest
  results.push(await testXHR('https://httpbin.org/get'))

  // Test 5: TCP Socket tests
  const tcpTests = [{ host: '1.1.1.1', port: 443, label: 'Cloudflare IP' }]

  for (const test of tcpTests) {
    results.push(await testTcpSocket(test.host, test.port, test.label))
  }

  // Test 6: Electrum Protocol tests (mainnet, testnet, signet)
  // These test actual Electrum JSON-RPC communication, not just TCP
  const electrumTests = [
    {
      host: 'electrum.blockstream.info',
      port: 50002,
      label: 'Mainnet (Blockstream)',
      tls: true
    },
    {
      host: 'mempool.space',
      port: 50002,
      label: 'Mainnet (Mempool)',
      tls: true
    },
    {
      host: 'electrum.blockstream.info',
      port: 60002,
      label: 'Testnet (Blockstream)',
      tls: true
    },
    {
      host: 'mempool.space',
      port: 60602,
      label: 'Signet (Mempool)',
      tls: true
    }
  ]

  for (const test of electrumTests) {
    results.push(
      await testElectrumProtocol(test.host, test.port, test.label, test.tls)
    )
  }

  // Test 7: App Electrum Client tests (uses the actual BlueWalletElectrumClient)
  // This tests the same connection method the app uses for wallet syncing
  const appElectrumTests: {
    url: string
    network: 'bitcoin' | 'signet' | 'testnet'
    label: string
  }[] = [
    {
      url: 'ssl://mempool.space:60602',
      network: 'signet',
      label: 'Signet (Mempool)'
    },
    {
      url: 'ssl://electrum.blockstream.info:50002',
      network: 'bitcoin',
      label: 'Mainnet (Blockstream)'
    }
  ]

  for (const test of appElectrumTests) {
    results.push(
      await testAppElectrumClient(test.url, test.network, test.label)
    )
  }

  // Test 8: Segwit Wallet Data fetch (tests actual wallet data retrieval)
  const walletDataTests: {
    url: string
    network: 'bitcoin' | 'signet' | 'testnet'
    label: string
  }[] = [
    {
      url: 'ssl://mempool.space:60602',
      network: 'signet',
      label: 'Signet Balance'
    }
  ]

  for (const test of walletDataTests) {
    results.push(await testSegwitWalletData(test.url, test.network, test.label))
  }

  // Test 9: WebSocket tests
  const wsTests = [
    { url: 'wss://relay.damus.io', label: 'relay.damus.io' },
    { url: 'wss://relay.primal.net', label: 'relay.primal.net' },
    { url: 'wss://echo.websocket.org', label: 'echo.websocket.org' }
  ]

  for (const test of wsTests) {
    results.push(await testWebSocket(test.url, test.label))
  }

  const passed = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  log('========================================')
  log('    NETWORK DIAGNOSTICS COMPLETE')
  log(`    Passed: ${passed}/${results.length}`)
  log(`    Failed: ${failed}/${results.length}`)
  log('========================================')

  // Log each result
  for (const result of results) {
    const status = result.success ? 'PASS' : 'FAIL'
    const timing = result.timing ? ` (${result.timing}ms)` : ''
    const error = result.error ? ` - ${result.error}` : ''
    const details = result.details ? ` [${result.details}]` : ''
    log(`  ${status}: ${result.test}${timing}${error}${details}`)
  }

  return {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed,
      failed
    }
  }
}

/**
 * Quick network check - returns true if basic connectivity works
 */
export async function quickNetworkCheck(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch()
    if (!state.isConnected) {
      log('Quick check: NetInfo says not connected')
      return false
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch('https://1.1.1.1/', {
      method: 'HEAD',
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    log(`Quick check: ${response.ok ? 'OK' : 'FAILED'}`)
    return response.ok || response.status > 0
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log('Quick check failed:', errorMsg)
    return false
  }
}
