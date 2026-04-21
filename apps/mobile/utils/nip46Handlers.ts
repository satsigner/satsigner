import { type NostrEvent, finalizeEvent } from 'nostr-tools'
import {
  decrypt as nip04Decrypt,
  encrypt as nip04Encrypt
} from 'nostr-tools/nip04'
import {
  decrypt as nip44Decrypt,
  encrypt as nip44Encrypt,
  getConversationKey
} from 'nostr-tools/nip44'

export function handlePing(): string {
  return 'pong'
}

export function handleGetPublicKey(signerPubkeyHex: string): string {
  return signerPubkeyHex
}

export function handleConnect(
  params: string[],
  expectedSecret: string | undefined,
  signerPubkeyHex: string
): string {
  if (expectedSecret && params[1] !== expectedSecret) {
    throw new Error('Invalid secret')
  }
  return signerPubkeyHex
}

export function handleSignEvent(
  eventJson: string,
  signerSecretKey: Uint8Array
): string {
  const eventTemplate = JSON.parse(eventJson) as Omit<
    NostrEvent,
    'id' | 'pubkey' | 'sig'
  >
  const signedEvent = finalizeEvent(eventTemplate, signerSecretKey)
  return JSON.stringify(signedEvent)
}

export function handleNip04Encrypt(
  thirdPartyPubkey: string,
  plaintext: string,
  signerSecretKey: Uint8Array
): string {
  return nip04Encrypt(signerSecretKey, thirdPartyPubkey, plaintext)
}

export function handleNip04Decrypt(
  thirdPartyPubkey: string,
  ciphertext: string,
  signerSecretKey: Uint8Array
): string {
  return nip04Decrypt(signerSecretKey, thirdPartyPubkey, ciphertext)
}

export function handleNip44Encrypt(
  thirdPartyPubkey: string,
  plaintext: string,
  signerSecretKey: Uint8Array
): string {
  const conversationKey = getConversationKey(signerSecretKey, thirdPartyPubkey)
  return nip44Encrypt(plaintext, conversationKey)
}

export function handleNip44Decrypt(
  thirdPartyPubkey: string,
  ciphertext: string,
  signerSecretKey: Uint8Array
): string {
  const conversationKey = getConversationKey(signerSecretKey, thirdPartyPubkey)
  return nip44Decrypt(ciphertext, conversationKey)
}
