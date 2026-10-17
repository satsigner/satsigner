import { useCallback, useEffect, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager'

import { getNfcAdapterStatus } from '@/utils/nfcAdapterStatus'
import { NfcDisabledError } from '@/utils/nfcError'
import { toNfcSessionError } from '@/utils/nfcSession'

export type NFCReadResult = {
  /** Hex after "Signed Transaction: " in a text record. */
  signedTxHex?: string
  /** Payload of a `bitcoin.org:txn` record. */
  txData?: Uint8Array
  text?: string
}

export function useNFCReader() {
  const [isSupported, setIsSupported] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [isReading, setIsReading] = useState(false)

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

  // Waits for an NDEF tag. Ends the reading state when the session fails or
  // is cancelled, so the next read can start. A failed request (including a
  // cancel) already ended the session; a failed tag read closes it here.
  async function requestNdefTag() {
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef)
    } catch (requestError) {
      setIsReading(false)
      throw toNfcSessionError(requestError)
    }

    try {
      return await NfcManager.getTag()
    } catch (tagError) {
      NfcManager.cancelTechnologyRequest()
      setIsReading(false)
      throw toNfcSessionError(tagError)
    }
  }

  async function readNFCTag(): Promise<NFCReadResult | null> {
    const status = await getNfcAdapterStatus()
    if (!status.isSupported) {
      throw new Error('NFC is not available on this device')
    }
    if (!status.isEnabled) {
      throw new NfcDisabledError()
    }

    setIsReading(true)
    const tag = await requestNdefTag()

    if (!tag?.ndefMessage?.length) {
      setIsReading(false)
      NfcManager.cancelTechnologyRequest()
      return null
    }

    const result: NFCReadResult = {}

    for (const record of tag.ndefMessage) {
      const type =
        typeof record.type === 'string'
          ? record.type
          : String.fromCharCode.apply(null, record.type)

      if (record.tnf === Ndef.TNF_WELL_KNOWN && type === Ndef.RTD_TEXT) {
        const text = Ndef.text.decodePayload(new Uint8Array(record.payload))

        const match = text.match(/Signed Transaction: ([a-f0-9]+)/i)
        if (match && match[1]) {
          ;[, result.signedTxHex] = match
          result.text = text
        } else if (!result.text) {
          result.text = text
        }
      } else if (type === 'bitcoin.org:txn') {
        result.txData = new Uint8Array(record.payload)
      }
    }

    if (result.txData || result.signedTxHex || result.text) {
      setIsReading(false)
      NfcManager.cancelTechnologyRequest()
      return result
    }

    setIsReading(false)
    NfcManager.cancelTechnologyRequest()
    return null
  }

  async function cancelNFCScan() {
    if (isReading) {
      setIsReading(false)
      await NfcManager.cancelTechnologyRequest()
    }
  }

  return {
    cancelNFCScan,
    isAvailable,
    isEnabled,
    isHardwareSupported,
    isReading,
    readNFCTag
  }
}
