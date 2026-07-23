import { __resetPayjoinMock } from 'react-native-payjoin'

import { createReceivePayjoinSession } from '@/api/payjoin'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { resolveReceiverSessionOnStart } from '@/utils/payjoinReceiverStart'

describe('resolveReceiverSessionOnStart', () => {
  beforeEach(() => {
    __resetPayjoinMock()
    usePayjoinSessionsStore.getState().clearAll()
  })

  it('resumes an active receiver session instead of creating fresh', async () => {
    const created = await createReceivePayjoinSession({
      accountId: 'acct-1',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      amountSats: 1000
    })

    const resolved = await resolveReceiverSessionOnStart({
      accountId: 'acct-1',
      amountSats: 2000,
      hydrated: null,
      label: 'tip'
    })

    expect(resolved).toStrictEqual({
      kind: 'session',
      session: expect.objectContaining({
        amountSats: 2000,
        id: created.id,
        label: 'tip'
      })
    })
  })

  it('soft-keeps a session when native resume fails', async () => {
    const created = await createReceivePayjoinSession({
      accountId: 'acct-keep',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
    })
    usePayjoinSessionsStore.getState().upsertSession({
      ...created,
      nativeState: 'broken-native-state'
    })

    const resolved = await resolveReceiverSessionOnStart({
      accountId: 'acct-keep',
      hydrated: null
    })

    expect(resolved).toStrictEqual({
      kind: 'session',
      session: expect.objectContaining({ id: created.id })
    })
  })

  it('asks for a fresh session when none is active', async () => {
    const resolved = await resolveReceiverSessionOnStart({
      accountId: 'acct-empty',
      hydrated: null
    })
    expect(resolved).toStrictEqual({ kind: 'create_fresh' })
  })
})
