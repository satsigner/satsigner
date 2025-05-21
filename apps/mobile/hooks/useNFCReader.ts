import { useEffect, useState } from 'react'
import NfcManager, {
  NfcTech,
  Ndef,
  type TagEvent
} from 'react-native-nfc-manager'

interface NFCTagWithNDEF {
  ndefMessage?: Array<{
    tnf: number
    type: Uint8Array
    payload: Uint8Array
  }>
}

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
      const isNFCAvailable = await NfcManager.isEnabled()
      setIsAvailable(isNFCAvailable)
    } catch (_error) {
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
        console.error('No NDEF message found on tag')
        return null
      }

      const result: NFCReadResult = {}

      // Process each record
      const records = tag.ndefMessage.map((record, index) => {
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
          console.log(
            `[NFC Reader] Found transaction data in record ${index + 1}`
          )
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

      console.log('[NFC Reader] No transaction data found')
      return null
    } catch (error) {
      console.log('[NFC Reader] Error reading NFC tag:', error)
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
