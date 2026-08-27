import { summarizeBackupPayload } from '@/utils/backupSummary'

describe('summarizeBackupPayload', () => {
  it('counts accounts and payload size', () => {
    const payload = JSON.stringify({
      accounts: [{ id: 'btc-1' }, { id: 'btc-2' }],
      ark: { accounts: [{ id: 'ark-1' }] },
      ecash: { accounts: [{ id: 'ecash-1' }] }
    })

    expect(summarizeBackupPayload(payload)).toStrictEqual({
      arkAccounts: 1,
      arkDatadirAccounts: 0,
      bitcoinAccounts: 2,
      bytes: new TextEncoder().encode(payload).length,
      ecashAccounts: 1,
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

    expect(summarizeBackupPayload(payload).arkDatadirAccounts).toBe(1)
  })

  it('marks invalid JSON as unparseable and still reports size', () => {
    const payload = '{not-json'
    expect(summarizeBackupPayload(payload)).toStrictEqual({
      arkAccounts: 0,
      arkDatadirAccounts: 0,
      bitcoinAccounts: 0,
      bytes: new TextEncoder().encode(payload).length,
      ecashAccounts: 0,
      parseable: false
    })
  })
})
