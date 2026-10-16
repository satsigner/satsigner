class BrantaService {
  getPayments() {
    return Promise.resolve({ payments: [], verifyUrl: '' })
  }

  getPaymentsByQrCode() {
    return Promise.resolve({ payments: [], verifyUrl: '' })
  }
}

export { BrantaService }
