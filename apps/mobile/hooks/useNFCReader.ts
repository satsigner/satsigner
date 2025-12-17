import { useEffect, useState } from 'react'
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager'

interface NFCReadResult {
  txId?: string
  txData?: Uint8Array
  text?: string
}

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
    const supported = await NfcManager.isSupported()
    if (!supported) {
      setIsAvailable(false)
      return
    }
    const isNFCAvailable = await NfcManager.isEnabled()
    setIsAvailable(isNFCAvailable)
  }

  async function readNFCTag(): Promise<NFCReadResult | null> {
    if (!isAvailable) {
      throw new Error('NFC is not available on this device')
    }

    setIsReading(true)
    await NfcManager.requestTechnology(NfcTech.Ndef)
    const tag = await NfcManager.getTag()

    if (!tag?.ndefMessage?.length) {
      setIsReading(false)
      NfcManager.cancelTechnologyRequest()
      return null
    }

    const result: NFCReadResult = {}

    // Process each record
    tag.ndefMessage.forEach((record) => {
      // Convert type to string if it's an array of numbers
      const type =
        typeof record.type === 'string'
          ? record.type
          : String.fromCharCode.apply(null, record.type as number[])

      // Handle different record types
      if (record.tnf === Ndef.TNF_WELL_KNOWN && type === Ndef.RTD_TEXT) {
        const text = Ndef.text.decodePayload(new Uint8Array(record.payload))

        // Extract transaction ID from text record
        const match = text.match(/Signed Transaction: ([a-f0-9]+)/i)
        if (match && match[1]) {
          result.txId = match[1]
          result.text = text
        } else {
          // For watch-only use cases, store any text content
          if (!result.text) {
            result.text = text
          }
        }
      } else if (type === 'bitcoin.org:txn') {
        // Store the raw transaction data
        result.txData = new Uint8Array(record.payload)
      }
    })

    if (result.txData || result.txId || result.text) {
      setIsReading(false)
      NfcManager.cancelTechnologyRequest()
      return result
    }

    return null
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
