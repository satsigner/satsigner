import { useEffect, useState } from 'react'
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager'

function getVerboseError(error: unknown, defaultMessage: string) {
  if (!(error instanceof Error)) {
    return defaultMessage
  }

  const verboseErrors = [
    {
      errorType: 'ioexception',
      errorMessage:
        'Failed to write to NFC tag. Keep the tag steady and close to the device.'
    },

    {
      errorType: 'ndef',
      errorMessage: 'This NFC tag does not support NDEF messages.'
    },
    {
      errorType: 'readonly',
      errorMessage: 'This NFC tag is read-only.'
    },
    {
      errorType: 'insufficient',
      errorMessage: 'NFC tag has insufficient memory for this PSBT.'
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
  const [isAvailable, setIsAvailable] = useState(false)
  const [isEmitting, setIsEmitting] = useState(false)

  useEffect(() => {
    checkNFCAvailability()
    return () => {
      NfcManager.cancelTechnologyRequest()
    }
  }, [])

  async function checkNFCAvailability() {
    try {
      const isNFCAvailable = await NfcManager.isEnabled()
      setIsAvailable(isNFCAvailable)
    } catch (_error) {
      setIsAvailable(false)
    }
  }

  async function emitNFCTag(data: string): Promise<void> {
    if (!isAvailable) {
      throw new Error('NFC is not available on this device')
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
      throw new Error(getVerboseError(writeError, 'Failed to write NFC tag'))
    }
  }

  async function cancelNFCScan() {
    if (isEmitting) {
      setIsEmitting(false)
      await NfcManager.cancelTechnologyRequest()
    }
  }

  return {
    isAvailable,
    isEmitting,
    emitNFCTag,
    cancelNFCScan
  }
}
