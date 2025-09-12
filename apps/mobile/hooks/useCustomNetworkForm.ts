import { useState } from 'react'

import { type Backend, type Network } from '@/types/settings/blockchain'

type CustomNetworkFormData = {
  backend: Backend
  name: string
  protocol: 'tcp' | 'ssl' | 'tls'
  host: string
  port: string
}

export const useCustomNetworkForm = (_network: Network) => {
  const [formData, setFormData] = useState<CustomNetworkFormData>({
    backend: 'electrum',
    name: '',
    protocol: 'ssl',
    host: '',
    port: ''
  })

  const updateField = (field: keyof CustomNetworkFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const constructUrl = () => {
    return formData.backend === 'esplora'
      ? `https://${formData.host}${formData.port ? `:${formData.port}` : ''}/api`
      : `${formData.protocol}://${formData.host}:${formData.port}`
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
