import { type EsploraTx } from '@/types/models/Esplora'
import { mapEsploraTxToAddressTransaction } from '@/utils/explorerAddressTx'

const ADDRESS = 'bc1qexampleaddress00000000000000000000000'

function baseTx(overrides: Partial<EsploraTx> = {}): EsploraTx {
  return {
    fee: 250,
    locktime: 0,
    size: 200,
    status: {
      block_height: 800_000,
      block_time: 1_700_000_000,
      confirmed: true
    },
    txid: 'aa'.repeat(32),
    version: 2,
    vin: [
      {
        is_coinbase: false,
        prevout: {
          scriptpubkey_address: ADDRESS,
          value: 100_000
        },
        scriptsig: '',
        sequence: 0xffff_ffff,
        txid: 'bb'.repeat(32),
        vout: 0
      }
    ],
    vout: [
      {
        scriptpubkey_address: 'bc1qother000000000000000000000000000000',
        value: 60_000
      },
      {
        scriptpubkey_address: ADDRESS,
        value: 39_750
      }
    ],
    weight: 800,
    ...overrides
  }
}

describe('mapEsploraTxToAddressTransaction', () => {
  it('computes send amounts when the address spends and receives change', () => {
    const tx = mapEsploraTxToAddressTransaction(baseTx(), ADDRESS)

    expect(tx.sent).toBe(100_000)
    expect(tx.received).toBe(39_750)
    expect(tx.type).toBe('send')
    expect(tx.fee).toBe(250)
    expect(tx.blockHeight).toBe(800_000)
    expect(tx.timestamp?.getTime()).toBe(1_700_000_000 * 1000)
  })

  it('marks pure receives as receive', () => {
    const tx = mapEsploraTxToAddressTransaction(
      baseTx({
        vin: [
          {
            is_coinbase: false,
            prevout: {
              scriptpubkey_address: 'bc1qother000000000000000000000000000000',
              value: 50_000
            },
            scriptsig: '',
            sequence: 0xffff_ffff,
            txid: 'cc'.repeat(32),
            vout: 1
          }
        ],
        vout: [
          {
            scriptpubkey_address: ADDRESS,
            value: 49_500
          }
        ]
      }),
      ADDRESS
    )

    expect(tx.sent).toBe(0)
    expect(tx.received).toBe(49_500)
    expect(tx.type).toBe('receive')
  })
})
