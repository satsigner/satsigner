export function validateExtendedKey(key: string) {
  // TODO: check string length
  return key.match(/^[xyz](pub|priv)[a-zO-9]+$/) !== null
}

export function validateDerivationPath(path: string) {
  return path.match(/^([mM]\/)?([0-9]+\'?\/)*([0-9]+\'?)$/) !== null
}

export function validateFingerprint(fingerprint: string) {
  return fingerprint.match(/^[a-f0-9]{6}$/i) !== null
}
