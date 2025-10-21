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

import { type Backend } from '@/types/settings/blockchain'

type CustomNetworkFormData = {
  backend: Backend
  name: string
  protocol: 'tcp' | 'ssl' | 'tls'
  host: string
  port: string
}

export const useCustomNetworkForm = () => {
  const [formData, setFormData] = useState<CustomNetworkFormData>({
    backend: 'electrum',
    name: '',
    protocol: 'ssl',
    host: '',
    port: ''
  })

  const updateField = (field: keyof CustomNetworkFormData, value: string) => {
    // Trim whitespace for host and port fields
    const trimmedValue =
      field === 'host' || field === 'port' ? value.trim() : value
    setFormData((prev) => ({ ...prev, [field]: trimmedValue }))
  }

  const constructUrl = () => {
    if (formData.backend === 'esplora') {
      // For Esplora, port is optional (defaults to 443)
      return formData.port.trim()
        ? `https://${formData.host}:${formData.port}`
        : `https://${formData.host}`
    }
    // For Electrum, port is always required
    return `${formData.protocol}://${formData.host}:${formData.port}`
  }

  const resetForm = () => {
    setFormData({
      backend: 'electrum',
      name: '',
      protocol: 'ssl',
      host: '',
      port: ''
    })
  }

  return {
    formData,
    updateField,
    constructUrl,
    resetForm
  }
}
