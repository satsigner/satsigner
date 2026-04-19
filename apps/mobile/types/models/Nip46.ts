export type Nip46Method =
  | 'connect'
  | 'get_public_key'
  | 'nip04_decrypt'
  | 'nip04_encrypt'
  | 'nip44_decrypt'
  | 'nip44_encrypt'
  | 'ping'
  | 'sign_event'

export type Nip46PermissionPolicy = 'always_allow' | 'always_reject' | 'ask'

export type Nip46Session = {
  clientName?: string
  clientPubkey: string
  createdAt: number
  id: string
  lastActiveAt: number
  permissions: Record<Nip46Method, Nip46PermissionPolicy>
  relays: string[]
  secret?: string
  signerNpub: string
}

export type Nip46Request = {
  id: string
  method: Nip46Method
  params: string[]
  receivedAt: number
  sessionId: string
  status: 'approved' | 'pending' | 'rejected'
}

export type Nip46ParsedUri = {
  clientPubkey: string
  name?: string
  perms?: string
  relays: string[]
  secret?: string
}
