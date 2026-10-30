import { useState } from 'react'

import { CONNECTION_TEST_COOLDOWN_MS } from '@/constants/connectionTest'
import {
  probeConnection,
  toConnectionTestFailure
} from '@/services/connectionTest'
import { type ConnectionTestResult } from '@/types/models/ConnectionTest'
import {
  type Backend,
  type Network,
  type ProxyConfig,
  type RpcCredentials
} from '@/types/settings/blockchain'

export function useConnectionTest() {
  const [testing, setTesting] = useState(false)
  const [lastTestTime, setLastTestTime] = useState(0)

  async function testConnection(
    url: string,
    backend: Backend,
    network: Network,
    proxy?: ProxyConfig,
    rpcCredentials?: RpcCredentials
  ): Promise<ConnectionTestResult> {
    const now = Date.now()
    if (now - lastTestTime < CONNECTION_TEST_COOLDOWN_MS) {
      return {
        error: 'Please wait before testing another connection',
        success: false
      }
    }

    setLastTestTime(now)
    setTesting(true)

    return await probeConnection({ backend, network, rpcCredentials, url })
      .catch((error: unknown) => toConnectionTestFailure(error, proxy))
      .finally(() => setTesting(false))
  }

  return {
    testConnection,
    testing
  }
}
