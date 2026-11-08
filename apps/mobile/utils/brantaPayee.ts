import {
  BRANTA_PAYEE_DESCRIPTION_MAX_LENGTH,
  BRANTA_PAYEE_NAME_MAX_LENGTH
} from '@/constants/branta'
import { type BrantaPayee } from '@/types/models/Branta'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { brantaHttpsUrl } from '@/utils/brantaUrl'

type BrantaPaymentLike = {
  description?: string
  parentPlatform?: {
    logoUrl?: string
  }
  platform?: string
  platformLogoUrl?: string
}

type BrantaPaymentsLike = {
  payments: BrantaPaymentLike[]
  verifyUrl: string
}

type LabeledOutput = {
  branta?: BrantaPayee
  kind?: Output['kind']
  label: string
}

const WHITESPACE_RUN = /\s+/g
const INVISIBLE_CHARACTERS =
  // oxlint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000E-\u001F\u007F-\u009F\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g
const LABEL_SYNTAX_CHARACTERS = /[#,]/g

function truncated(value: string, maxLength: number): string {
  return [...value].slice(0, maxLength).join('').trim()
}

/** Branta text is third-party; drop characters that can spoof the display. */
function displayText(value: string | undefined, maxLength: number): string {
  const text = (value ?? '')
    .normalize('NFC')
    .replaceAll(INVISIBLE_CHARACTERS, '')
    .replaceAll(WHITESPACE_RUN, ' ')
    .trim()
  return truncated(text, maxLength)
}

/**
 * The name is written into labels, where `,` splits a label and `#` starts
 * a tag, so it can't carry either.
 */
function payeeName(value: string | undefined): string {
  const name = value?.replaceAll(LABEL_SYNTAX_CHARACTERS, ' ')
  return displayText(name, BRANTA_PAYEE_NAME_MAX_LENGTH)
}

/**
 * Maps a strict-mode lookup into the payee shown before send.
 * An empty result is not a payee — the destination was never posted.
 * Satsigner is dark-themed, so the dark logo is the one rendered.
 */
function toBrantaPayee(result: BrantaPaymentsLike): BrantaPayee | null {
  const [payment] = result.payments
  if (!payment) {
    return null
  }

  const name = payeeName(payment.platform)
  const verifyUrl = brantaHttpsUrl(result.verifyUrl)
  if (!name || !verifyUrl) {
    return null
  }

  const parentLogoUrl = brantaHttpsUrl(payment.parentPlatform?.logoUrl)
  const logoUrl = brantaHttpsUrl(payment.platformLogoUrl) ?? ''

  return {
    description: displayText(
      payment.description,
      BRANTA_PAYEE_DESCRIPTION_MAX_LENGTH
    ),
    logoUrl,
    name,
    ...(parentLogoUrl ? { parentLogoUrl } : {}),
    verifyUrl
  }
}

function labelWithPayeeName(label: string, payeeName: string): string {
  const trimmedLabel = label.trim()
  const trimmedName = payeeName.trim()
  if (!trimmedName) {
    return trimmedLabel
  }
  if (!trimmedLabel) {
    return trimmedName
  }
  if (
    trimmedLabel.localeCompare(trimmedName, undefined, {
      sensitivity: 'accent'
    }) === 0
  ) {
    return trimmedLabel
  }
  return `${trimmedLabel},${trimmedName}`
}

function isRecipientOutput(output: LabeledOutput): boolean {
  return output.kind !== 'change' && output.kind !== 'fakeMix'
}

function payeesFromOutputs(outputs: LabeledOutput[]): BrantaPayee[] {
  return outputs.flatMap((output) => {
    if (!isRecipientOutput(output) || !output.branta) {
      return []
    }
    return [output.branta]
  })
}

function selectTransactionPayee(
  outputs: LabeledOutput[]
): BrantaPayee | undefined {
  return payeesFromOutputs(outputs)[0]
}

/**
 * History indexes the transaction label. The payee name is added only when
 * the label setting is on, so Nostr label sync and the encrypted backup
 * carry it through the labels that already leave the device.
 */
function paymentHistoryLabel(
  outputs: LabeledOutput[],
  changeLabel: string,
  includePayeeName = false
): string {
  const labels = outputs
    .filter((output) => output.label !== changeLabel)
    .map((output) => output.label.trim())
    .filter(Boolean)

  if (!includePayeeName) {
    return labels.join(',')
  }

  for (const payee of payeesFromOutputs(outputs)) {
    const alreadyPresent = labels.some(
      (label) =>
        label.localeCompare(payee.name, undefined, {
          sensitivity: 'accent'
        }) === 0
    )
    if (!alreadyPresent) {
      labels.push(payee.name)
    }
  }

  return labels.join(',')
}

function attachBrantaPayees(
  transactions: Transaction[],
  payees: Map<string, BrantaPayee>
): Transaction[] {
  return transactions.map((transaction) => {
    const branta = payees.get(transaction.id)
    if (!branta) {
      return transaction
    }
    return { ...transaction, branta }
  })
}

export {
  attachBrantaPayees,
  labelWithPayeeName,
  paymentHistoryLabel,
  payeesFromOutputs,
  selectTransactionPayee,
  toBrantaPayee
}
