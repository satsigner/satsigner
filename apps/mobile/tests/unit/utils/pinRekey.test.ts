import * as SecureStore from 'expo-secure-store'
import { __store as secureStore } from 'expo-secure-store'

import { PIN_KEY, PIN_REKEY_JOURNAL_KEY } from '@/config/auth'
import {
  getKeySecret,
  getLndConfigSecret,
  getNostrIdentitySecret,
  setItem,
  storeKeySecret,
  storeLndConfigSecret,
  storeNostrIdentitySecret
} from '@/storage/encrypted'
import type { Key } from '@/types/models/Account'
import {
  applyPendingPinRekey,
  clearPinRekeyJournal,
  listPinSecretSlots,
  type PinSecretSlot,
  rekeyPinSecrets
} from '@/utils/pinRekey'

// A ciphertext names its key, so the tests can see which digest opens it.
jest.mock<typeof import('@/utils/crypto')>('@/utils/crypto', () => ({
  ...jest.requireActual<typeof import('@/utils/crypto')>('@/utils/crypto'),
  aesDecrypt: jest.fn((ciphertext: string, key: string) => {
    const [owner, ...rest] = ciphertext.split('|')
    if (owner !== key) {
      return Promise.reject(new Error('bad decrypt'))
    }
    return Promise.resolve(rest.join('|'))
  }),
  aesEncrypt: jest.fn((text: string, key: string) =>
    Promise.resolve(`${key}|${text}`)
  ),
  randomIv: jest.fn(() => 'iv')
}))

const OLD = 'old-digest'
const NEW = 'new-digest'
const KEY_PLAINTEXT = JSON.stringify({ mnemonic: 'abandon' })
const NOSTR_PLAINTEXT = JSON.stringify({ nsec: 'nsec1' })
const LND_PLAINTEXT = JSON.stringify({ macaroon: 'aa' })

const SLOTS: PinSecretSlot[] = [
  { accountId: 'acc', keyIndex: 0, kind: 'accountKey' },
  { kind: 'nostrIdentity', npub: 'npub1' },
  { kind: 'lndConfig' }
]

const defaultSetItem = jest
  .mocked(SecureStore.setItemAsync)
  .getMockImplementation()

async function storeAllUnder(digest: string) {
  await storeKeySecret('acc', 0, `${digest}|${KEY_PLAINTEXT}`, 'iv')
  await storeNostrIdentitySecret('npub1', `${digest}|${NOSTR_PLAINTEXT}`, 'iv')
  await storeLndConfigSecret(`${digest}|${LND_PLAINTEXT}`, 'iv')
}

async function owners() {
  const stored = await Promise.all([
    getKeySecret('acc', 0),
    getNostrIdentitySecret('npub1'),
    getLndConfigSecret()
  ])
  return stored.map((value) => value?.secret.split('|')[0])
}

function getAccountKeys(count: number): Key[] {
  return Array.from({ length: count }, (_, index) => ({
    creationType: 'importMnemonic',
    index,
    iv: 'iv',
    secret: 'encrypted-secret'
  }))
}

function journalIsStored() {
  return `1_${PIN_REKEY_JOURNAL_KEY}` in secureStore
}

describe('pinRekey', () => {
  beforeEach(() => {
    for (const key of Object.keys(secureStore)) {
      delete secureStore[key]
    }
    jest.mocked(SecureStore.setItemAsync).mockImplementation(defaultSetItem)
  })

  it('moves every secret to the new digest and keeps the journal until commit', async () => {
    await storeAllUnder(OLD)

    await rekeyPinSecrets(OLD, NEW, SLOTS)

    await expect(owners()).resolves.toStrictEqual([NEW, NEW, NEW])
    expect(journalIsStored()).toBe(true)
    await clearPinRekeyJournal()
    expect(journalIsStored()).toBe(false)
  })

  it('writes nothing when a secret opens with neither digest', async () => {
    await storeAllUnder(OLD)
    await storeLndConfigSecret(`other|${LND_PLAINTEXT}`, 'iv')

    await expect(rekeyPinSecrets(OLD, NEW, SLOTS)).rejects.toThrow(
      'opens with neither PIN'
    )

    await expect(owners()).resolves.toStrictEqual([OLD, OLD, 'other'])
    expect(journalIsStored()).toBe(false)
  })

  it('rolls every moved secret back when a write fails halfway', async () => {
    await storeAllUnder(OLD)
    const writeError = new Error('keychain full')
    jest
      .mocked(SecureStore.setItemAsync)
      .mockImplementation((key: string, value: string) =>
        key.includes('nostr_identity_secret') && value.includes(NEW)
          ? Promise.reject(writeError)
          : (defaultSetItem?.(key, value) ?? Promise.resolve())
      )

    await expect(rekeyPinSecrets(OLD, NEW, SLOTS)).rejects.toBe(writeError)

    await expect(owners()).resolves.toStrictEqual([OLD, OLD, OLD])
    expect(journalIsStored()).toBe(false)
  })

  it('rolls an interrupted change back when the new digest was never committed', async () => {
    await storeAllUnder(OLD)
    await storeKeySecret('acc', 0, `${NEW}|${KEY_PLAINTEXT}`, 'iv')
    await setItem(PIN_KEY, OLD)
    await setItem(
      PIN_REKEY_JOURNAL_KEY,
      JSON.stringify({ fromDigest: OLD, slots: SLOTS, toDigest: NEW })
    )

    await applyPendingPinRekey()

    await expect(owners()).resolves.toStrictEqual([OLD, OLD, OLD])
    expect(journalIsStored()).toBe(false)
  })

  it('only drops the journal when the new digest was already committed', async () => {
    await storeAllUnder(NEW)
    await setItem(PIN_KEY, NEW)
    await setItem(
      PIN_REKEY_JOURNAL_KEY,
      JSON.stringify({ fromDigest: OLD, slots: SLOTS, toDigest: NEW })
    )

    await applyPendingPinRekey()

    await expect(owners()).resolves.toStrictEqual([NEW, NEW, NEW])
    expect(journalIsStored()).toBe(false)
  })

  it('skips a secret neither digest opens when rolling back', async () => {
    await storeAllUnder(NEW)
    await storeLndConfigSecret(`other|${LND_PLAINTEXT}`, 'iv')
    await setItem(PIN_KEY, OLD)
    await setItem(
      PIN_REKEY_JOURNAL_KEY,
      JSON.stringify({ fromDigest: OLD, slots: SLOTS, toDigest: NEW })
    )

    await applyPendingPinRekey()

    await expect(owners()).resolves.toStrictEqual([OLD, OLD, 'other'])
    expect(journalIsStored()).toBe(false)
  })

  it('lists every PIN-bound secret slot', () => {
    const keys = getAccountKeys(2)

    expect(listPinSecretSlots([{ id: 'acc', keys }], ['npub1'])).toStrictEqual([
      { accountId: 'acc', keyIndex: 0, kind: 'accountKey' },
      { accountId: 'acc', keyIndex: 1, kind: 'accountKey' },
      { kind: 'nostrIdentity', npub: 'npub1' },
      { accountId: 'acc', kind: 'nostrAccount' },
      { kind: 'lndConfig' },
      { kind: 'rpcCredentials', network: 'bitcoin' },
      { kind: 'rpcCredentials', network: 'testnet' },
      { kind: 'rpcCredentials', network: 'signet' }
    ])
  })
})
