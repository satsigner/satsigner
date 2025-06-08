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
    try {
      const supported = await NfcManager.isSupported()
      if (!supported) {
        setIsAvailable(false)
        return
      }
      const isNFCAvailable = await NfcManager.isEnabled()
      setIsAvailable(isNFCAvailable)
    } catch (_error) {
      // NFC not supported or not available
      setIsAvailable(false)
    }
  }

  async function readNFCTag(): Promise<NFCReadResult | null> {
    if (!isAvailable) {
      throw new Error('NFC is not available on this device')
    }

    setIsReading(true)
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef)
      const tag = await NfcManager.getTag()

      if (!tag?.ndefMessage?.length) {
        return null
      }

      const result: NFCReadResult = {}

      // Process each record
      const _records = tag.ndefMessage.map((record, index) => {
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
          }
        } else if (type === 'bitcoin.org:txn') {
          // Store the raw transaction data
          result.txData = new Uint8Array(record.payload)
        }

        return {
          index: index + 1,
          type,
          raw: record
        }
      })

      if (result.txData || result.txId) {
        return result
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
