/**
 * Custom Network Form Hook
 *
 * TODO: Add URL parsing utility function
 * - Parse full URLs like "ssl://electrum.example.com:50002" into protocol, host, port
 * - Handle both Electrum (ssl://, tls://, tcp://) and Esplora (https://) formats
 * - Validate parsed components and provide helpful error messages
 * - Support clipboard paste and QR code scan integration
 */

import { useState } from 'react'

import { type Backend, type ProxyConfig } from '@/types/settings/blockchain'
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

  return {
    formData,
    updateField,
    updateProxyField,
    constructUrl,
    constructTrimmedUrl,
    resetForm
  }
}
