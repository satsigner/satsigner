import * as bitcoinjs from 'bitcoinjs-lib'
import TcpSocket from 'react-native-tcp-socket'

import ElectrumClient from '@/api/electrum'

jest.mock<typeof import('sonner-native')>('sonner-native', () => ({
  toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() }
}))

// secp256k1 generator point — only used to derive a valid address
const PUBKEY = Buffer.from(
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  'hex'
)

const network = bitcoinjs.networks.bitcoin
const ADDRESS = bitcoinjs.payments.p2wpkh({ network, pubkey: PUBKEY })
  .address as string
const SCRIPT = bitcoinjs.address.toOutputScript(ADDRESS, network)

function buildFundingTx(value: number, outputScript = SCRIPT) {
  const tx = new bitcoinjs.Transaction()
  tx.version = 2
  tx.addInput(Buffer.alloc(32, 0xaa), 0)
  tx.addOutput(outputScript, value)
  return tx
}

function makeClient(protocol: 'ssl' | 'tcp' = 'ssl') {
  return ElectrumClient.fromUrl(
    `${protocol}://electrum.example.com:50002`,
    'bitcoin'
  )
}

type MockedInnerClient = {
  blockchainScripthash_listunspent: jest.Mock
  blockchainTransaction_get: jest.Mock
}

function stubInner(client: ElectrumClient): MockedInnerClient {
  const inner = client.client as unknown as MockedInnerClient
  jest.spyOn(inner, 'blockchainScripthash_listunspent').mockImplementation()
  jest.spyOn(inner, 'blockchainTransaction_get').mockImplementation()
  return inner
}

describe('electrumClient TLS', () => {
  it('enables certificate verification for ssl connections', () => {
    const tlsSocket = TcpSocket.TLSSocket as unknown as {
      lastOptions?: Record<string, unknown>
    }
    tlsSocket.lastOptions = undefined

    makeClient('ssl')

    expect(tlsSocket.lastOptions).toStrictEqual({ rejectUnauthorized: true })
  })
})

describe('electrumClient response verification', () => {
  it('accepts UTXOs consistent with their creating transaction', async () => {
    const client = makeClient()
    const inner = stubInner(client)
    const fundingTx = buildFundingTx(100_000)
    const fundingTxid = fundingTx.getId()

    inner.blockchainScripthash_listunspent.mockResolvedValue([
      { height: 800_000, tx_hash: fundingTxid, tx_pos: 0, value: 100_000 }
    ])
    inner.blockchainTransaction_get.mockResolvedValue(fundingTx.toHex())

    const utxos = await client.getAddressUtxos(ADDRESS)
    expect(utxos).toHaveLength(1)
    expect(utxos[0].value).toBe(100_000)
  })

  it('rejects UTXOs with inflated values (fee-inflation attack)', async () => {
    const client = makeClient()
    const inner = stubInner(client)
    const fundingTx = buildFundingTx(100_000)

    inner.blockchainScripthash_listunspent.mockResolvedValue([
      // server claims the UTXO is worth 10x its real value
      {
        height: 800_000,
        tx_hash: fundingTx.getId(),
        tx_pos: 0,
        value: 1_000_000
      }
    ])
    inner.blockchainTransaction_get.mockResolvedValue(fundingTx.toHex())

    await expect(client.getAddressUtxos(ADDRESS)).rejects.toThrow(
      'inconsistent'
    )
  })

  it('rejects UTXOs whose output does not pay the queried address', async () => {
    const client = makeClient()
    const inner = stubInner(client)
    const otherScript = bitcoinjs.address.toOutputScript(
      bitcoinjs.payments.p2wpkh({
        network,
        pubkey: Buffer.from(
          '03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
          'hex'
        )
      }).address as string,
      network
    )
    const fundingTx = buildFundingTx(100_000, otherScript)

    inner.blockchainScripthash_listunspent.mockResolvedValue([
      { height: 800_000, tx_hash: fundingTx.getId(), tx_pos: 0, value: 100_000 }
    ])
    inner.blockchainTransaction_get.mockResolvedValue(fundingTx.toHex())

    await expect(client.getAddressUtxos(ADDRESS)).rejects.toThrow(
      'inconsistent'
    )
  })

  it('rejects transactions that do not match the requested txid', async () => {
    const client = makeClient()
    const inner = stubInner(client)
    const fundingTx = buildFundingTx(100_000)
    const foreignTx = buildFundingTx(42)

    inner.blockchainTransaction_get.mockResolvedValue(foreignTx.toHex())

    await expect(client.getTransactions([fundingTx.getId()])).rejects.toThrow(
      'does not match'
    )
  })

  it('accepts transactions matching the requested txid', async () => {
    const client = makeClient()
    const inner = stubInner(client)
    const fundingTx = buildFundingTx(100_000)

    inner.blockchainTransaction_get.mockResolvedValue(fundingTx.toHex())

    const raws = await client.getTransactions([fundingTx.getId()])
    expect(raws).toStrictEqual([fundingTx.toHex()])
  })
})
