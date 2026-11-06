import { parseOutpoint } from '@/utils/outpoint'

const TXID = 'ab'.repeat(32)

describe('parseOutpoint', () => {
  it('splits an outpoint into its txid and output index', () => {
    expect(parseOutpoint(`${TXID}:3`)).toStrictEqual({ txid: TXID, vout: 3 })
  })

  it.each(['', TXID, `${TXID}:`, `${TXID}:-1`, `${TXID}:1.5`, `${TXID}:1:2`])(
    'rejects %p',
    (outpoint) => {
      expect(parseOutpoint(outpoint)).toBeNull()
    }
  )
})
