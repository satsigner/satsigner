/**
 * Custom Network Form Hook
 *
 * TODO: Add URL parsing utility function
 * - Parse full URLs like "ssl://electrum.example.com:50002" into protocol, host, port
 * - Handle both Electrum (ssl://, tls://, tcp://) and Esplora (https://) formats
 * - Validate parsed components and provide helpful error messages
 * - Support clipboard paste and QR code scan integration
 */

import { useCallback, useState } from 'react'

import {
  type Backend,
  type ProxyConfig,
  type Server
} from '@/types/settings/blockchain'
import { trimOnionAddress } from '@/utils/format'

const DEFAULT_PROXY_HOST = 'localhost'
const DEFAULT_PROXY_PORT = 9050

type CustomNetworkFormData = {
  backend: Backend
  name: string
  protocol: 'tcp' | 'ssl'
  host: string
  port: string
  proxy: ProxyConfig
}

export function useCustomNetworkForm() {
  const [formData, setFormData] = useState<CustomNetworkFormData>({
    backend: 'electrum',
    name: '',
    protocol: 'ssl',
    host: '',
    port: '',
    proxy: {
      enabled: false,
      host: DEFAULT_PROXY_HOST,
      port: DEFAULT_PROXY_PORT
    }
  })

  function updateField(field: keyof CustomNetworkFormData, value: string) {
    const trimmedValue =
      field === 'host' || field === 'port' ? value.trim() : value
    setFormData((prev) => ({ ...prev, [field]: trimmedValue }))
  }

  function updateProxyField(proxy: ProxyConfig) {
    setFormData((prev) => ({ ...prev, proxy }))
  }

  function constructUrl() {
    if (formData.backend === 'esplora') {
      return formData.port.trim()
        ? `https://${formData.host}:${formData.port}`
        : `https://${formData.host}`
    }
    const protocol = formData.protocol === 'ssl' ? 'ssl' : 'tcp'
    return `${protocol}://${formData.host}:${formData.port}`
  }

  function constructTrimmedUrl() {
    if (!formData.host) return ''
    if (formData.backend === 'electrum' && !formData.port) return ''
    const fullUrl = constructUrl()
    return trimOnionAddress(fullUrl)
  }

  function resetForm() {
    setFormData({
      backend: 'electrum',
      name: '',
      protocol: 'ssl',
      host: '',
      port: '',
      proxy: {
        enabled: false,
        host: DEFAULT_PROXY_HOST,
        port: DEFAULT_PROXY_PORT
      }
    })
  }

  const loadServer = useCallback((server: Server) => {
    if (server.backend === 'electrum') {
      const match = server.url.match(/^(ssl|tls|tcp):\/\/([^:/]+):(\d+)$/)
      const protocol =
        match && (match[1] === 'ssl' || match[1] === 'tls') ? 'ssl' : 'tcp'
      const host = match ? match[2] : ''
      const port = match ? match[3] : ''
      setFormData({
        backend: 'electrum',
        name: server.name,
        protocol,
        host,
        port,
        proxy: server.proxy ?? {
          enabled: false,
          host: DEFAULT_PROXY_HOST,
          port: DEFAULT_PROXY_PORT
        }
      })
    } else {
      try {
        const u = new URL(server.url)
        const port = u.port && u.port !== '443' ? u.port : ''
        setFormData((prev) => ({
          ...prev,
          backend: 'esplora',
          name: server.name,
          host: u.hostname,
          port,
          proxy: server.proxy ?? prev.proxy
        }))
      } catch {
        setFormData((prev) => ({
          ...prev,
          backend: 'esplora',
          name: server.name,
          host: '',
          port: ''
        }))
      }
    }
  }, [])

  function applyPastedUrl(urlString: string): boolean {
    const raw = urlString.trim()
    if (!raw) return false
    const electrumMatch = raw.match(/^(ssl|tls|tcp):\/\/([^:/]+):(\d+)$/)
    if (electrumMatch) {
      const protocol =
        electrumMatch[1] === 'ssl' || electrumMatch[1] === 'tls' ? 'ssl' : 'tcp'
      setFormData((prev) => ({
        ...prev,
        backend: 'electrum',
        protocol,
        host: electrumMatch[2],
        port: electrumMatch[3]
      }))
      return true
    }
    try {
      const u = new URL(raw)
      if (u.protocol !== 'https:') return false
      const port = u.port && u.port !== '443' ? u.port : ''
      setFormData((prev) => ({
        ...prev,
        backend: 'esplora',
        host: u.hostname,
        port
      }))
      return true
    } catch {
      return false
    }
  }

  return {
    applyPastedUrl,
    formData,
    loadServer,
    resetForm,
    updateField,
    updateProxyField,
    constructUrl,
    constructTrimmedUrl
  }
}
