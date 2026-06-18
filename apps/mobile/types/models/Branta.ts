import { type Payment } from '@branta-ops/branta/v2'

type BrantaTriggerMode = 'off' | 'auto' | 'on_request'

type BrantaTorStatus = 'unavailable' | 'checking' | 'available'

type BrantaVerificationResult = {
  payments: Payment[]
  verifyUrl: string
}

export type { BrantaTorStatus, BrantaTriggerMode, BrantaVerificationResult }
