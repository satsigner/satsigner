import { useCallback, useEffect, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager'

import { t } from '@/locales'
import { getNfcAdapterStatus } from '@/utils/nfcAdapterStatus'

function getVerboseError(error: unknown, defaultMessage: string) {
  if (!(error instanceof Error)) {
    return defaultMessage
  }

  const verboseErrors = [
    {
      errorMessage:
        'Failed to write to NFC tag. Keep the tag steady and close to the device.',
      errorType: 'ioexception'
    },

    {
      errorMessage: 'This NFC tag does not support NDEF messages.',
      errorType: 'ndef'
    },
    {
      errorMessage: 'This NFC tag is read-only.',
      errorType: 'readonly'
    },
    {
      errorMessage: 'This NFC tag has insufficient memory for this PSBT.',
      errorType: 'insufficient'
    }
  ]

  for (const { errorType, errorMessage } of verboseErrors) {
    if (error.message.includes(errorType)) {
      return errorMessage
    }
  }
  return error.message
}

export function useNFCEmitter() {
  const [isSupported, setIsSupported] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [isEmitting, setIsEmitting] = useState(false)

  const isHardwareSupported = isSupported
  const isAvailable = isSupported && isEnabled

  const checkNFCAvailability = useCallback(async () => {
    const status = await getNfcAdapterStatus()
    setIsSupported(status.isSupported)
    setIsEnabled(status.isEnabled)
  }, [])

  useEffect(() => {
    checkNFCAvailability()

    const retryTimer = setTimeout(() => {
      checkNFCAvailability()
    }, 400)

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        checkNFCAvailability()
      }
    }
    const appSub = AppState.addEventListener('change', onAppState)

    return () => {
      clearTimeout(retryTimer)
      appSub.remove()
      NfcManager.cancelTechnologyRequest()
    }
  }, [checkNFCAvailability])

  async function emitNFCTag(data: string): Promise<void> {
    const status = await getNfcAdapterStatus()
    if (!status.isSupported) {
      throw new Error('NFC is not available on this device')
    }
    if (!status.isEnabled) {
      throw new Error(t('watchonly.read.nfcTurnOnInSettings'))
    }

    setIsEmitting(true)
    await NfcManager.requestTechnology(NfcTech.Ndef)

    const bytes = Ndef.encodeMessage([
      Ndef.textRecord(data, 'en', { id: 'PSBT' })
    ])
    if (!bytes) {
      setIsEmitting(false)
      NfcManager.cancelTechnologyRequest()
      throw new Error('Failed to encode NDEF message')
    }

    try {
      await NfcManager.ndefHandler.writeNdefMessage(bytes)
    } catch (writeError) {
      setIsEmitting(false)
      NfcManager.cancelTechnologyRequest()
      throw new Error(getVerboseError(writeError, 'Failed to write NFC tag'), {
        cause: writeError
      })
    }

    setIsEmitting(false)
    await NfcManager.cancelTechnologyRequest()
  }

  async function cancelNFCScan() {
    if (isEmitting) {
      setIsEmitting(false)
      await NfcManager.cancelTechnologyRequest()
    }
  }

  return {
    cancelNFCScan,
    emitNFCTag,
    isAvailable,
    isEmitting,
    isEnabled,
    isHardwareSupported
  }
}
