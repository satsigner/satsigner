import TcpSocket from 'react-native-tcp-socket'

import {
  DEFAULT_TOR_PROXY,
  TOR_PROXY_PROBE_TIMEOUT_MS
} from '@/constants/branta'
import { useBlockchainStore } from '@/store/blockchain'
import { type ProxyConfig } from '@/types/settings/blockchain'

function getConfiguredTorProxy(): ProxyConfig | null {
  const state = useBlockchainStore.getState()
  const selectedProxy = state.configs[state.selectedNetwork]?.server?.proxy
  if (selectedProxy?.enabled) {
    return selectedProxy
  }

  for (const server of state.customServers) {
    if (server.proxy?.enabled) {
      return server.proxy
    }
  }

  for (const config of Object.values(state.configs)) {
    if (config.server.proxy?.enabled) {
      return config.server.proxy
    }
  }

  return null
}

function probeTorProxy(proxy: ProxyConfig): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false

    function finish(result: boolean) {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeoutId)
      try {
        socket.destroy()
      } catch {
        // ignore cleanup errors
      }
      resolve(result)
    }

    const timeoutId = setTimeout(() => {
      finish(false)
    }, TOR_PROXY_PROBE_TIMEOUT_MS)

    const socket = TcpSocket.createConnection(
      {
        host: proxy.host,
        port: proxy.port
      },
      () => {
        finish(true)
      }
    )

    socket.on('error', () => {
      finish(false)
    })
  })
}

async function resolveTorProxyForBranta(): Promise<ProxyConfig | null> {
  const configured = getConfiguredTorProxy()
  if (configured && (await probeTorProxy(configured))) {
    return configured
  }

  if (await probeTorProxy(DEFAULT_TOR_PROXY)) {
    return DEFAULT_TOR_PROXY
  }

  return null
}

export { getConfiguredTorProxy, probeTorProxy, resolveTorProxyForBranta }
