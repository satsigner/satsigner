export type NostrMessage = {
  id: string
  content: string | Record<string, unknown>
  created_at: number
  decryptedContent?: string
  isSender?: boolean
  pubkey?: string
}
