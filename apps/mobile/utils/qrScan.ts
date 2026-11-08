type ScannedCode = {
  data?: string | null
  raw?: string | null
}

/**
 * The decoded text of a scanned QR code. expo-camera's `raw` is often empty
 * for plain QR codes, so `data` comes first; `raw` is only a fallback.
 */
export function scannedPayload(
  code: ScannedCode | null | undefined
): string | null {
  return code?.data || code?.raw || null
}
