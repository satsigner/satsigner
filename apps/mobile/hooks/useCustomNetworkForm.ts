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

/** ssl://host:port, tcp://..., optional :s or :t mode suffix */
const ELECTRUM_FULL_URL_WITH_MODE_REGEX =
  /^(ssl|tls|tcp|electrum):\/\/([^:/\s]+):(\d+)(?::([st]))?$/i

/** host:port with optional :s / :t (Electrum shorthand, no scheme) */
const ELECTRUM_HOST_PORT_WITH_MODE_REGEX = /^([^:/\s]+):(\d+)(?::([st]))?$/i

/** v2 or v3 onion service hostname only */
const ELECTRUM_ONION_HOST_ONLY_REGEX = /^[a-z2-7]{16,56}\.onion$/i

/** Persisted electrum server URL from settings (scheme, host, port) */
const STORED_ELECTRUM_SERVER_URL_REGEX = /^(ssl|tls|tcp):\/\/([^:/]+):(\d+)$/

const TRIM_SURROUNDING_QUOTES_REGEX = /^['"]+|['"]+$/g

type CustomNetworkFormData = {
  backend: Backend
  name: string
  protocol: 'tcp' | 'ssl'
  host: string
  port: string
  proxy: ProxyConfig
}

type ParsedElectrumUrl = {
  host: string
  port: string
  protocol: 'ssl' | 'tcp'
}

function parseElectrumUrl(normalized: string): ParsedElectrumUrl | null {
  const protocolUrlMatch = normalized.match(ELECTRUM_FULL_URL_WITH_MODE_REGEX)

  if (protocolUrlMatch) {
    const [, scheme, host, port, mode] = protocolUrlMatch
    const protocol =
      mode === 't' || scheme.toLowerCase() === 'tcp' ? 'tcp' : 'ssl'

    return {
      host,
      port,
      protocol
    }
  }

  const hostPortModeMatch = normalized.match(ELECTRUM_HOST_PORT_WITH_MODE_REGEX)

  if (hostPortModeMatch) {
    const [, host, port, mode] = hostPortModeMatch

    return {
      host,
      port,
      protocol: mode === 't' ? 'tcp' : 'ssl'
    }
  }

  const onionHostOnlyMatch = normalized.match(ELECTRUM_ONION_HOST_ONLY_REGEX)
  if (onionHostOnlyMatch) {
    return {
      host: onionHostOnlyMatch[0],
      port: '50002',
      protocol: 'ssl'
    }
  }

  return null
}

export function useCustomNetworkForm() {
  const [formData, setFormData] = useState<CustomNetworkFormData>({
    backend: 'electrum',
    host: '',
    name: '',
    port: '',
    protocol: 'ssl',
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
    if (!formData.host) {
      return ''
    }
    if (formData.backend === 'electrum' && !formData.port) {
      return ''
    }
    const fullUrl = constructUrl()
    return trimOnionAddress(fullUrl)
  }

  function resetForm() {
    setFormData({
      backend: 'electrum',
      host: '',
      name: '',
      port: '',
      protocol: 'ssl',
      proxy: {
        enabled: false,
        host: DEFAULT_PROXY_HOST,
        port: DEFAULT_PROXY_PORT
      }
    })
  }

  const loadServer = useCallback((server: Server) => {
    if (server.backend === 'electrum') {
      const match = server.url.match(STORED_ELECTRUM_SERVER_URL_REGEX)
      const protocol =
        match && (match[1] === 'ssl' || match[1] === 'tls') ? 'ssl' : 'tcp'
      const host = match ? match[2] : ''
      const port = match ? match[3] : ''
      setFormData({
        backend: 'electrum',
        host,
        name: server.name,
        port,
        protocol,
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
          host: u.hostname,
          name: server.name,
          port,
          proxy: server.proxy ?? prev.proxy
        }))
      } catch {
        setFormData((prev) => ({
          ...prev,
          backend: 'esplora',
          host: '',
          name: server.name,
          port: ''
        }))
      }
    }
  }, [])

  function applyPastedUrl(urlString: string): boolean {
    const raw = urlString.trim()
    if (!raw) {
      return false
    }
    const candidate = raw.replace(TRIM_SURROUNDING_QUOTES_REGEX, '').trim()
    if (!candidate) {
      return false
    }

    const electrumUrl = parseElectrumUrl(candidate)

    if (electrumUrl) {
      setFormData((prev) => ({
        ...prev,
        backend: 'electrum',
        host: electrumUrl.host,
        port: electrumUrl.port,
        protocol: electrumUrl.protocol
      }))
      return true
    }
    try {
      const u = new URL(candidate)
      if (u.protocol !== 'https:') {
        return false
      }
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
    constructTrimmedUrl,
    constructUrl,
    formData,
    loadServer,
    resetForm,
    updateField,
    updateProxyField
  }
}
