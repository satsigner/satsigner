import { useEffect, useState } from 'react'
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager'

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
      console.log('[NFC Emitter] NFC not available')
      throw new Error('NFC is not available on this device')
    }

    console.log(
      '[NFC Emitter] Starting NFC emission with data length:',
      data.length
    )
    console.log('[NFC Emitter] Data preview:', data.slice(0, 100) + '...')

    setIsEmitting(true)
    try {
      console.log('[NFC Emitter] Requesting NFC technology...')
      await NfcManager.requestTechnology(NfcTech.Ndef)
      console.log('[NFC Emitter] NFC technology granted')

      // Create NDEF message
      console.log('[NFC Emitter] Creating NDEF message...')
      const bytes = Ndef.encodeMessage([
        Ndef.textRecord(data, 'en', { id: 'PSBT' })
      ])

      if (!bytes) {
        console.log('[NFC Emitter] Failed to encode NDEF message')
        throw new Error('Failed to encode NDEF message')
      }

      console.log(
        '[NFC Emitter] NDEF message created, bytes length:',
        bytes.length
      )
      console.log('[NFC Emitter] Writing to NFC tag...')

      try {
        // Write to NFC tag
        await NfcManager.ndefHandler.writeNdefMessage(bytes)
        console.log('[NFC Emitter] Successfully wrote to NFC tag')
      } catch (writeError) {
        console.log('[NFC Emitter] Write error details:', writeError)
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
      console.log('[NFC Emitter] Error during NFC emission:', error)
      throw error
    } finally {
      console.log('[NFC Emitter] Cleaning up NFC session')
      setIsEmitting(false)
      NfcManager.cancelTechnologyRequest()
    }
  }

  async function cancelNFCScan() {
    if (isEmitting) {
      console.log('[NFC Emitter] Cancelling NFC scan')
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
