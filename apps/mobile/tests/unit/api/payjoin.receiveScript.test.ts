import * as bitcoinjs from 'bitcoinjs-lib'
import { __resetPayjoinMock } from 'react-native-payjoin'

import { createReceivePayjoinSession } from '@/api/payjoin'
import { PAYJOIN_MISSING_RECEIVE_SCRIPT_ERROR } from '@/constants/payjoin'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'

const RECEIVE_ADDRESS = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
const MAINNET_ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'

function nativeStateField(state: string, field: string) {
  const decoded: Record<string, unknown> = JSON.parse(
    Buffer.from(state, 'base64').toString('utf8')
  )
  return decoded[field]
}

describe('receiver session receive script', () => {
  beforeEach(() => {
    __resetPayjoinMock()
    usePayjoinSessionsStore.getState().clearAll()
  })

  it('hands the receive address scriptPubKey to the native session', async () => {
    const session = await createReceivePayjoinSession({
      accountId: 'acct-1',
      address: RECEIVE_ADDRESS,
      network: 'signet'
    })

    const expected = bitcoinjs.address
      .toOutputScript(RECEIVE_ADDRESS, bitcoinjs.networks.testnet)
      .toString('hex')

    expect(session.nativeState).toBeTruthy()
    expect(nativeStateField(session.nativeState!, 'receiveScriptHex')).toBe(
      expected
    )
  })

  it('refuses to mint a mailbox for an address of another network', async () => {
    await expect(
      createReceivePayjoinSession({
        accountId: 'acct-1',
        address: MAINNET_ADDRESS,
        network: 'signet'
      })
    ).rejects.toThrow(PAYJOIN_MISSING_RECEIVE_SCRIPT_ERROR)
    expect(
      usePayjoinSessionsStore.getState().getActiveReceiverSession('acct-1')
    ).toBeUndefined()
  })
})
