import { summarizeBackupPayload } from '@/utils/backupSummary'

describe('summarizeBackupPayload', () => {
  it('counts accounts and nested backup details', () => {
    const payload = JSON.stringify({
      accounts: [
        {
          id: 'btc-1',
          keys: [{ seedWords: 'abandon ability' }],
          labels: { tx1: { label: 'rent' } }
        },
        {
          id: 'btc-2',
          keys: [{ seedWords: '' }, { fingerprint: 'abcd' }],
          labels: { tx2: { label: 'coffee' }, tx3: { label: 'food' } }
        }
      ],
      ark: {
        accounts: [{ id: 'ark-1' }],
        labels: { 'ark-1': { vout1: { label: 'board' } } },
        mnemonics: { 'ark-1': 'zoo zoo zoo' }
      },
      ecash: {
        accounts: [{ id: 'ecash-1' }],
        mints: { 'ecash-1': [{ url: 'https://mint.example' }] },
        mnemonics: { 'ecash-1': 'legal winner' },
        proofs: { 'ecash-1': [{ C: 'a' }, { C: 'b' }] },
        transactions: { 'ecash-1': [{ id: 'tx-1' }] }
      },
      lightning: {
        channels: [{ channelPoint: 'a:0' }],
        config: { host: '127.0.0.1' }
      },
      nostrIdentities: {
        identities: [{ mnemonic: 'word word', npub: 'npub1', nsec: 'nsec1' }],
        relays: ['wss://relay.example']
      }
    })

    expect(summarizeBackupPayload(payload)).toStrictEqual({
      ark: { accounts: 1, datadirs: 0, labels: 1, secrets: 1 },
      bitcoin: { accounts: 2, labels: 3, secrets: 1 },
      bytes: new TextEncoder().encode(payload).length,
      ecash: {
        accounts: 1,
        mints: 1,
        proofs: 2,
        secrets: 1,
        transactions: 1
      },
      lightning: { channels: 1, hasConfig: true },
      nostr: { accounts: 1, relays: 1, secrets: 1 },
      parseable: true
    })
  })

  it('counts legacy ark datadirs without requiring them', () => {
    const payload = JSON.stringify({
      accounts: [],
      ark: {
        accounts: [{ id: 'ark-1' }],
        datadirs: { 'ark-1': { files: [] } }
      }
    })

    expect(summarizeBackupPayload(payload).ark.datadirs).toBe(1)
  })

  it('marks invalid JSON as unparseable and still reports size', () => {
    const payload = '{not-json'
    expect(summarizeBackupPayload(payload)).toStrictEqual({
      ark: { accounts: 0, datadirs: 0, labels: 0, secrets: 0 },
      bitcoin: { accounts: 0, labels: 0, secrets: 0 },
      bytes: new TextEncoder().encode(payload).length,
      ecash: {
        accounts: 0,
        mints: 0,
        proofs: 0,
        secrets: 0,
        transactions: 0
      },
      lightning: { channels: 0, hasConfig: false },
      nostr: { accounts: 0, relays: 0, secrets: 0 },
      parseable: false
    })
  })
})
