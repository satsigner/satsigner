import { BdkPsbtParams, BdkWallet, Network } from 'react-native-bdk-sdk'

import { buildReplacementPsbt } from '@/api/bdk'

// Same module-graph stubs as bdkRpc.test.ts: @/utils/bip39 and @/api/electrum
// cannot load under Jest, and nothing here exercises them.
jest.mock<typeof import('@/utils/bip39')>('@/utils/bip39', () => ({
  detectElectrumSeed: jest.fn(() => null),
  getPrivateDescriptorFromElectrumMnemonic: jest.fn(),
  getPrivateDescriptorFromMnemonic: jest.fn(),
  mnemonicToSeed: jest.fn(() => new Uint8Array())
}))

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  default: {} as unknown as typeof import('@/api/electrum').default
}))

const ORIGINAL_TXID = 'cc'.repeat(32)
const PAYMENT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
const SELF = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
const EXCLUDED_TXID = 'dd'.repeat(32)

function lastParams() {
  return jest.mocked(BdkPsbtParams).mock.results.at(-1)?.value
}

describe('buildReplacementPsbt', () => {
  const wallet = new BdkWallet('', undefined, Network.Testnet, '')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('replaces the original with the same recipients at the new fee rate', async () => {
    await buildReplacementPsbt(wallet, {
      feeRate: 7,
      originalTxid: ORIGINAL_TXID,
      recipients: [{ address: PAYMENT, amountSats: 50_000 }],
      unspendable: [
        {
          addressTo: SELF,
          keychain: 'external',
          txid: EXCLUDED_TXID,
          value: 600,
          vout: 3
        }
      ]
    })

    const params = lastParams()
    expect(params.feeRate).toHaveBeenCalledWith(7)
    expect(params.addRecipients).toHaveBeenCalledWith([
      { address: PAYMENT, amountSats: 50_000 }
    ])
    expect(params.unspendable).toHaveBeenCalledWith([
      { txid: EXCLUDED_TXID, vout: 3 }
    ])
    expect(params.manuallySelectedOnly).not.toHaveBeenCalled()
    expect(params.changeAddress).not.toHaveBeenCalled()
    expect(wallet.replaceByFee).toHaveBeenCalledWith(params, [ORIGINAL_TXID])
  })

  it('sweeps only the original inputs back to the account when cancelling', async () => {
    await buildReplacementPsbt(wallet, {
      feeRate: 5,
      originalTxid: ORIGINAL_TXID,
      recipients: [],
      sweepTo: SELF,
      unspendable: []
    })

    const params = lastParams()
    expect(params.manuallySelectedOnly).toHaveBeenCalledWith()
    expect(params.coinSelection).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'All' })
    )
    expect(params.changeAddress).toHaveBeenCalledWith(SELF)
    expect(wallet.replaceByFee).toHaveBeenCalledWith(params, [ORIGINAL_TXID])
  })
})
