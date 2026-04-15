import { useCallback, useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import NfcManager, { Ndef, NfcTech } from "react-native-nfc-manager";

import { t } from "@/locales";
import { getNfcAdapterStatus } from "@/utils/nfcAdapterStatus";

interface NFCReadResult {
  txId?: string;
  txData?: Uint8Array;
  text?: string;
}

export function useNFCReader() {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isReading, setIsReading] = useState(false);

  const isHardwareSupported = isSupported;
  const isAvailable = isSupported && isEnabled;

  const checkNFCAvailability = useCallback(async () => {
    const status = await getNfcAdapterStatus();
    setIsSupported(status.isSupported);
    setIsEnabled(status.isEnabled);
  }, []);

  useEffect(() => {
    void checkNFCAvailability();

    const retryTimer = setTimeout(() => {
      void checkNFCAvailability();
    }, 400);

    const onAppState = (next: AppStateStatus) => {
      if (next === "active") {
        void checkNFCAvailability();
      }
    };
    const appSub = AppState.addEventListener("change", onAppState);

    return () => {
      clearTimeout(retryTimer);
      appSub.remove();
      NfcManager.cancelTechnologyRequest();
    };
  }, [checkNFCAvailability]);

  async function readNFCTag(): Promise<NFCReadResult | null> {
    const status = await getNfcAdapterStatus();
    if (!status.isSupported) {
      throw new Error("NFC is not available on this device");
    }
    if (!status.isEnabled) {
      throw new Error(t("watchonly.read.nfcTurnOnInSettings"));
    }

    setIsReading(true);
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();

    if (!tag?.ndefMessage?.length) {
      setIsReading(false);
      NfcManager.cancelTechnologyRequest();
      return null;
    }

    const result: NFCReadResult = {};

    for (const record of tag.ndefMessage) {
      const type =
        typeof record.type === "string"
          ? record.type
          : String.fromCharCode.apply(null, record.type as number[]);

      if (record.tnf === Ndef.TNF_WELL_KNOWN && type === Ndef.RTD_TEXT) {
        const text = Ndef.text.decodePayload(new Uint8Array(record.payload));

        const match = text.match(/Signed Transaction: ([a-f0-9]+)/i);
        if (match && match[1]) {
          [, result.txId] = match;
          result.text = text;
        } else if (!result.text) {
          result.text = text;
        }
      } else if (type === "bitcoin.org:txn") {
        result.txData = new Uint8Array(record.payload);
      }
    }

    if (result.txData || result.txId || result.text) {
      setIsReading(false);
      NfcManager.cancelTechnologyRequest();
      return result;
    }

    setIsReading(false);
    NfcManager.cancelTechnologyRequest();
    return null;
  }

  async function cancelNFCScan() {
    if (isReading) {
      setIsReading(false);
      await NfcManager.cancelTechnologyRequest();
    }
  }

  return {
    cancelNFCScan,
    isAvailable,
    isEnabled,
    isHardwareSupported,
    isReading,
    readNFCTag,
  };
}
