import { useEffect, useState } from 'react'
import NfcManager, { NfcTech } from 'react-native-nfc-manager'

export function useNFCReader() {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isReading, setIsReading] = useState(false)

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

  async function readNFCTag(): Promise<string | null> {
    if (!isAvailable) {
      throw new Error('NFC is not available on this device')
    }

    setIsReading(true)
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef)
      const tag = await NfcManager.getTag()

      if (tag && tag.ndefMessage && tag.ndefMessage.length > 0) {
        const payload = tag.ndefMessage[0].payload
        return String.fromCharCode.apply(null, payload)
      }
      return null
    } catch (error) {
      throw error
    } finally {
      setIsReading(false)
      NfcManager.cancelTechnologyRequest()
    }
  }

  async function cancelNFCScan() {
    if (isReading) {
      setIsReading(false)
      await NfcManager.cancelTechnologyRequest()
    }
  }

  return {
    isAvailable,
    isReading,
    readNFCTag,
    cancelNFCScan
  }
}
