const BrantaServerBaseUrl = {
  Localhost: 'Localhost',
  Production: 'Production',
  Staging: 'Staging'
}

const PrivacyMode = {
  Loose: 'loose',
  Strict: 'strict'
}

function createNobleCryptoProvider() {
  return {
    getRandomValues: (values: Uint8Array) => values,
    randomUUID: () => '00000000-0000-4000-8000-000000000000',
    subtle: {}
  }
}

export { BrantaServerBaseUrl, PrivacyMode, createNobleCryptoProvider }
