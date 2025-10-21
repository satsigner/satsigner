/**
 * Custom Network Validation Hook
 *
 * TODO: Enhanced validation for pasted URLs
 * - Add validation for full URL format (ssl://host:port)
 * - Provide specific error messages for malformed URLs
 * - Validate protocol compatibility with selected backend
 * - Add real-time validation feedback for better UX
 */

import { useCallback } from 'react'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import { type Backend } from '@/types/settings/blockchain'
import { validateElectrumUrl, validateEsploraUrl } from '@/utils/urlValidation'

type ValidationResult = {
  isValid: boolean
  error?: string
}

export const useCustomNetworkValidation = (
  name: string,
  host: string,
  port: string,
  url: string,
  backend: Backend
) => {
  const validateForm = useCallback((): ValidationResult => {
    if (!name.trim()) {
      return { isValid: false, error: 'require.name' }
    }

    if (!host.trim()) {
      return { isValid: false, error: 'require.host' }
    }

    if (backend === 'electrum') {
      if (!port.trim()) {
        return { isValid: false, error: 'require.port' }
      }

      if (!port.match(/^[0-9]+$/)) {
        return { isValid: false, error: 'invalid.port' }
      }
    } else {
      if (port.trim() && !port.match(/^[0-9]+$/)) {
        return { isValid: false, error: 'invalid.port' }
      }
    }

    if (backend === 'electrum') {
      const validation = validateElectrumUrl(url)
      if (!validation.isValid) {
        return { isValid: false, error: validation.error || 'invalid.url' }
      }
    } else if (backend === 'esplora') {
      const validation = validateEsploraUrl(url)
      if (!validation.isValid) {
        return { isValid: false, error: validation.error || 'invalid.url' }
      }
    }

    return { isValid: true }
  }, [name, host, port, url, backend])

  const validateWithToasts = useCallback((): boolean => {
    const validation = validateForm()

    if (!validation.isValid) {
      const errorKey = validation.error || 'invalid.url'
      toast.warning(t(`error.${errorKey}`))
      return false
    }

    return true
  }, [validateForm])

  const isFormValid = validateForm().isValid

  return {
    validateForm,
    validateWithToasts,
    isFormValid
  }
}
