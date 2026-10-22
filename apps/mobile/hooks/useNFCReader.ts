import { useCallback, useEffect, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager'

import { NFC_AVAILABILITY_RETRY_MS } from '@/constants/nfc'
import { type NFCReadResult } from '@/types/models/Nfc'
import { getNfcAdapterStatus } from '@/utils/nfcAdapterStatus'
import { NfcDisabledError } from '@/utils/nfcError'
import { toNfcSessionError } from '@/utils/nfcSession'

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
    }, NFC_AVAILABILITY_RETRY_MS)

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

  async function requestNdefTechnologyOrEndReading() {
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef)
    } catch (requestError) {
      setIsReading(false)
      throw toNfcSessionError(requestError)
    }
  }

  async function getTagOrCloseSessionAndEndReading() {
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
    await requestNdefTechnologyOrEndReading()
    const tag = await getTagOrCloseSessionAndEndReading()

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
          ;[, result.textRecordSignedTxHex] = match
          result.text = text
        } else if (!result.text) {
          result.text = text
        }
      } else if (type === 'bitcoin.org:txn') {
        result.txnRecordPayload = new Uint8Array(record.payload)
      }
    }

    if (
      result.txnRecordPayload ||
      result.textRecordSignedTxHex ||
      result.text
    ) {
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
