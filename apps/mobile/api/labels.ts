import { type Account } from '@/types/models/Account'
import {
  bip329export,
  formatAddressLabels,
  formatTransactionLabels,
  formatUtxoLabels,
  type Label
} from '@/utils/bip329'

export interface LabelsAPI {
  formatLabels(account: Account): Label[]
  exportLabels(labels: Label[]): string
  parseLabels(content: string): Label[]
}

export class LabelsAPI implements LabelsAPI {
  formatLabels(account: Account): Label[] {
    return [
      ...formatTransactionLabels(account.transactions),
      ...formatUtxoLabels(account.utxos),
      ...formatAddressLabels(account.addresses)
    ]
  }

  exportLabels(labels: Label[]): string {
    return labels.length > 0 ? bip329export.JSONL(labels) : ''
  }

  parseLabels(content: string): Label[] {
    // Clean the content by removing control characters
    const cleanContent = content
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .trim()

    // Split concatenated JSON objects
    const jsonStrings = cleanContent.match(/\{[^}]+\}/g) || []

    // Parse each JSON object and collect valid labels
    const labels = jsonStrings
      .map((jsonString) => {
        try {
          return JSON.parse(jsonString)
        } catch {
          return null
        }
      })
      .filter((label): label is Label => label !== null)

    if (labels.length === 0) {
      throw new Error('No valid labels found in the message')
    }

    return labels
  }
}
