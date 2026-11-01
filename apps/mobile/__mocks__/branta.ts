const BrantaEnvironment = {
  Localhost: 'Localhost',
  Production: 'Production',
  Staging: 'Staging'
}

const BrantaPaymentExceptionReason = {
  CryptoUnavailable: 'crypto_unavailable'
}

// oxlint-disable-next-line eslint-plugin-unicorn/custom-error-definition -- mirrors the SDK class name
class BrantaPaymentException extends Error {
  reason?: string

  constructor(message: string, reason?: string) {
    super(message)
    this.name = 'BrantaPaymentException'
    this.reason = reason
  }
}

class BrantaService {
  verify() {
    return Promise.resolve({ status: 'unknown', verifyUrl: '' })
  }
}

function createNobleCryptoProvider() {
  return {
    getRandomValues: (values: Uint8Array) => values,
    randomUUID: () => '00000000-0000-4000-8000-000000000000',
    subtle: {}
  }
}

export {
  BrantaEnvironment,
  BrantaPaymentException,
  BrantaPaymentExceptionReason,
  BrantaService,
  createNobleCryptoProvider
}
