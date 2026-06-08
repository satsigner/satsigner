import { type Payment } from '@branta-ops/branta/v2'

export type BrantaTriggerMode = 'off' | 'auto' | 'on_request'

export type BrantaVerificationResult = {
  payments: Payment[]
  verifyUrl: string
}

export type BrantaTorStatus = 'checking' | 'available' | 'unavailable'
