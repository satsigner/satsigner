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

      console.log('[NFC Reader] Raw tag data:', JSON.stringify(tag, null, 2))

      if (!tag?.ndefMessage?.length) {
        console.log('[NFC Reader] No NDEF message found on tag')
        return null
      }

      console.log('[NFC Reader] Total NDEF records:', tag.ndefMessage.length)

      const result: NFCReadResult = {}

      // Process each record
      const records = tag.ndefMessage.map((record, index) => {
        console.log(`[NFC Reader] Record ${index + 1} details:`, {
          tnf: record.tnf,
          type: record.type,
          payload: record.payload,
          id: record.id
        })

        // Convert type to string if it's an array of numbers
        const type =
          typeof record.type === 'string'
            ? record.type
            : String.fromCharCode.apply(null, record.type as number[])

        console.log(`[NFC Reader] Record ${index + 1} type:`, type)

        // Handle different record types
        if (record.tnf === Ndef.TNF_WELL_KNOWN && type === Ndef.RTD_TEXT) {
          const text = Ndef.text.decodePayload(new Uint8Array(record.payload))
          console.log(`[NFC Reader] Record ${index + 1} full text:`, text)

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

      console.log('[NFC Reader] All records:', JSON.stringify(records, null, 2))
      console.log('[NFC Reader] Extracted result:', result)

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
