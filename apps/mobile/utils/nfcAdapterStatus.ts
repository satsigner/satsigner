import NfcManager from "react-native-nfc-manager";

export type NfcAdapterStatus = {
  isEnabled: boolean;
  isSupported: boolean;
};

export async function getNfcAdapterStatus(): Promise<NfcAdapterStatus> {
  try {
    const isSupported = await NfcManager.isSupported();
    if (!isSupported) {
      return { isEnabled: false, isSupported: false };
    }
    const isEnabled = await NfcManager.isEnabled();
    return { isEnabled, isSupported: true };
  } catch {
    return { isEnabled: false, isSupported: false };
  }
}
