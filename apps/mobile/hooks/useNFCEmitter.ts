import { useEffect, useState } from 'react'
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager'

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
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef)

      // Create NDEF message
      const bytes = Ndef.encodeMessage([
        Ndef.textRecord(data, 'en', { id: 'PSBT' })
      ])

      if (!bytes) {
        throw new Error('Failed to encode NDEF message')
      }

      try {
        // Write to NFC tag
        await NfcManager.ndefHandler.writeNdefMessage(bytes)
      } catch (writeError) {
        // Check for specific error conditions
        if (writeError instanceof Error) {
          const errorMessage = writeError.message.toLowerCase()
          if (errorMessage.includes('ioexception')) {
            throw new Error(
              'Failed to write to NFC tag. Please keep the tag steady and close to the device.'
            )
          } else if (errorMessage.includes('ndef')) {
            throw new Error('This NFC tag does not support NDEF messages.')
          } else if (errorMessage.includes('readonly')) {
            throw new Error('This NFC tag is read-only.')
          } else if (errorMessage.includes('insufficient')) {
            throw new Error('NFC tag has insufficient memory for this PSBT.')
          }
        }
        throw new Error(
          'Failed to write to NFC tag. Please try again with a different tag.'
        )
      }
    } catch (error) {
      throw error
    } finally {
      setIsEmitting(false)
      NfcManager.cancelTechnologyRequest()
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
