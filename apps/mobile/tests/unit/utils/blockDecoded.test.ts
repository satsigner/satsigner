import {
  BlockField,
  decodeBlockFromHex,
  looksLikeBlockHex
} from '@/utils/blockDecoded'
import { TxField } from '@/utils/txDecoded'

/** Genesis block (header + coinbase). */
const GENESIS_BLOCK_HEX =
  '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c0101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0de8a7a3e3e2e1d0e6e7e4d41dac00000000'

describe('decodeBlockFromHex', () => {
  it('decodes genesis header fields', () => {
    const { fields, truncated, txDecoded, txTotal } =
      decodeBlockFromHex(GENESIS_BLOCK_HEX)

    expect({ truncated, txDecoded, txTotal }).toStrictEqual({
      truncated: false,
      txDecoded: 1,
      txTotal: 1
    })
    expect(fields.slice(0, 7).map((field) => field.field)).toStrictEqual([
      BlockField.Version,
      BlockField.PrevHash,
      BlockField.MerkleRoot,
      BlockField.Timestamp,
      BlockField.Bits,
      BlockField.Nonce,
      BlockField.TxCount
    ])
    expect(fields[0]?.value).toBe(1)
    expect(fields[1]?.value).toBe(
      '0000000000000000000000000000000000000000000000000000000000000000'
    )
    expect(fields[3]?.value).toBe(1_231_006_505)
    expect(fields[6]?.value).toBe(1)
  })

  it('includes colored transaction fields after the header', () => {
    const { fields } = decodeBlockFromHex(GENESIS_BLOCK_HEX)
    const txVersion = fields.find(
      (field) => field.field === TxField.Version && field.placeholders?.tx === 0
    )
    expect(txVersion).toMatchObject({ value: 1 })
  })

  it('truncates when maxHexChars is small', () => {
    const { truncated, txDecoded, fields } = decodeBlockFromHex(
      GENESIS_BLOCK_HEX,
      200
    )
    expect({ truncated, txDecoded }).toStrictEqual({
      truncated: true,
      txDecoded: 0
    })
    expect(fields.some((field) => field.field === BlockField.TxCount)).toBe(
      true
    )
  })

  it('throws on hex shorter than a block header', () => {
    expect(() => decodeBlockFromHex('01000000')).toThrow(/too short/)
  })

  it('detects block hex vs transaction hex', () => {
    expect(looksLikeBlockHex(GENESIS_BLOCK_HEX)).toBe(true)
    // coinbase tx alone (no block header)
    const coinbaseTx = GENESIS_BLOCK_HEX.slice(160 + 2)
    expect(looksLikeBlockHex(coinbaseTx)).toBe(false)
  })

  it('decodes a prefix of oversized hex without requiring the full payload', () => {
    const oversized = `${GENESIS_BLOCK_HEX}${'00'.repeat(2_000_000)}`
    const { fields, truncated, txDecoded, txTotal } =
      decodeBlockFromHex(oversized)
    expect({ truncated, txDecoded, txTotal }).toStrictEqual({
      truncated: true,
      txDecoded: 1,
      txTotal: 1
    })
    expect(fields[0]?.field).toBe(BlockField.Version)
    expect(
      fields.some(
        (field) =>
          field.field === TxField.Version && field.placeholders?.tx === 0
      )
    ).toBe(true)
  })
})
