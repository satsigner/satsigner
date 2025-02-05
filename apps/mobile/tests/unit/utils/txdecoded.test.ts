import { TxDecoded } from '@/utils/txDecoded'

export const sampleTransactions = [
  {
    label: 'The first coinbase transaction',
    hex: '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000',
    expected: {
      version: 1,
      vinCount: 1,
      voutCount: 1,
      voutSats: [5_000_000_000],
      locktime: 0
    }
  },
  {
    label: 'P2PKH - Single Input',
    hex: '01000000014de35d956a3bcfa06c79856713aa1d26907eae5489e4810d9da91fc60a0179ef010000006a47304402206f295ee0414bd88c57ce6a90e8b701f093a96795d21e51d220e2a9d5f773d98c0220322f443b9989d6b10db7bc01853205fa45a3ad745a6452e32c2ad295d0db6a7901210335c1d3651153e5745da6d2365b7a2f2806bc4887e484f95c4a278fec1de28b83ffffffff023b923f00000000001976a9147d1980cd67f0ed29a94793823b866bf47eab965e88ac267d1b00000000001976a91498b2553c30629340fac2a7729cf2f2100cdbb98d88ac00000000',
    expected: {
      version: 1,
      vinCount: 1,
      voutCount: 2,
      voutSats: [4_166_203, 1_801_510],
      locktime: 0
    }
  },
  {
    label: 'P2WPKH - Single Input',
    hex: '0200000000010137131ff2dc9991b6430ba28974b0fc5a3317a6894c00bf0ce2b9f630f7404cca0200000000ffffffff0144e6000000000000160014cc5159408ffdbb39adfd5ed60ac49da7d18a4f4a02483045022100d3727f1e3620114749b9ff8a12a8e55536fa2db45c772dd50d81c46b7a7cf1b60220040f2fb0856f066ddae63f0cef32ed969573e84a17a91b267cafca3f34f5b415012103ef32354a64ce83ff21ed50bea8027e88c13511003ce9a62210956063469373a900000000',
    expected: {
      version: 2,
      marker: 0,
      flag: 1,
      vinCount: 1,
      voutCount: 1,
      voutSats: [58_948],
      witnessCount: [2],
      locktime: 0
    }
  },
  {
    label: 'P2WPKH - Multiple Inputs',
    hex: '010000000001031dd14edf0a087030af65a868761e6f39a1291ecbd2e4f7e443d2d937531d2d460100000000ffffffff77de1503ffd32e6d9aeda10d9eef3f3350d317dd354cab953b9da7eccb31e7150100000000ffffffffb5406cc033456f3baea5e5ce9f39bdc12314c3757ca524da3359baf4558227e10600000000ffffffff02301b0f000000000016001432e6fcf13070a8ae297279cf4502b224454a4817dd5f7e0000000000160014333a09ae2e73532a690b8e9cf40b76c711c0574902483045022100aa90d4f188b1d2d2c47d70c563b36e7161468bbfaff8bde5e13cdb808cd6409e0220205dc388417ec406517756eba2f628ae6b23c94e00c7fe56eb3e434eaca82cce012102f498b1a8c2771cc70d76b5dc8aa0eadef7bbc24fd6cb1371372370e5425a33830247304402202d594a674a69b2f7081490b359d9e734b46c0731649255dd8f241ee1537d559802205442fe851b2da7d1c61a8ccc421640f8c6091867490612424edc39f7680656af0121025278abd7f725378e805887bc70a368598e7a5b5d6950c13d5017df352301ecd90247304402207440c985aa9d6ed8c14d4b374393bae4d89bc9b38f06ea8dbebd3b0f0126d9bd022028080f49e4824991120ed888f04bce5e8d8fd97407b5676e1679862ae3f17511012102e33b6f791e99675365f3fbd24111cdbcb4a59a5fcd1205df39e0ded71b492ddd00000000',
    expected: {
      version: 1,
      marker: 0,
      flag: 1,
      vinCount: 3,
      voutCount: 2,
      voutSats: [990_000, 8_282_077],
      witnessCount: [2, 2, 2],
      locktime: 0
    }
  },
  {
    label: 'P2WSH - 2 of 2 Multisig',
    hex: '0200000000010149c5cc2a4bd71cd0b64e9f3a8488dfb4bd00eaac9e035281c40de9669e1ab4b40200000000a2552c80084a0100000000000022002077283ff439b3cec8c21ee702881ab6be6e38c8fab9e947eafe1f8678fa498c334a01000000000000220020d3dae62afde7f410685c5962f3269045e3f751c1f53ea3a979edd42734886dc9c130000000000000220020bf4d8a14a9a9764292d20708198e84d4d9b527c6b90fd1f85fc605d0a8693b4ab633000000000000220020d63a94059ca7e60e2dc9afd0a48848e3669e957b0d2d084d9b4c12be3e8b2f4b4149000000000000220020fdd3b4a9a3bced6a9f74590fb86650d9f4e193737891a744e623cd2b0ee808258992000000000000220020fdd3b4a9a3bced6a9f74590fb86650d9f4e193737891a744e623cd2b0ee80825f12b010000000000220020fdb752db1448bc9c2e0d9a26525978bec01b50056ba82a31409b4ba79656067645462b00000000002200204abbbfc9c4ab2ca7942bf32e7f344b404e4353063ade6f190b463b22c50e23670400483045022100b53894f6929ab243a689c2056d50a156654cb07761c861c54298b0dea9218049022021c608f379c32203aeabdcb29c1604dcfa6cc7117e1bffbfd4c274ee06693cff014730440220075ec0e4dcbaf000cb90db7767043fcb144a5fd2f7842feb3246d885a9a1aeeb02205da8602723867e4af44865d1eff057f292b7d6ed13fdd8b3728de35dd64ccc3101475221020c49dccecc8b13d6de0f9b1912704b383ec60a3d33c8689aae96428c278acae4210218887226c60d50b60bfb0790bbb0cf4def502599e1ec312a593be4924ec37a2452ae9af22a20',
    expected: {
      version: 2,
      marker: 0,
      flag: 1,
      vinCount: 1,
      voutCount: 8,
      voutSats: [330, 330, 1_2481, 13_238, 18_753, 37_513, 76_785, 2_836_037],
      witnessCount: [4],
      locktime: 539_685_530
    }
  },
  {
    label: 'P2TR - Tapscript Multisig',
    hex: '02000000000101b41b20295ac85fd2ae3e3d02900f1a1e7ddd6139b12e341386189c03d6f5795b0000000000fdffffff0100000000000000003c6a3a546878205361746f7368692120e2889e2f32316d696c20466972737420546170726f6f74206d756c7469736967207370656e64202d426974476f044123b1d4ff27b16af4b0fcb9672df671701a1a7f5a6bb7352b051f461edbc614aa6068b3e5313a174f90f3d95dc4e06f69bebd9cf5a3098fde034b01e69e8e788901400fd4a0d3f36a1f1074cb15838a48f572dc18d412d0f0f0fc1eeda9fa4820c942abb77e4d1a3c2b99ccf4ad29d9189e6e04a017fe611748464449f681bc38cf394420febe583fa77e49089f89b78fa8c116710715d6e40cc5f5a075ef1681550dd3c4ad20d0fa46cb883e940ac3dc5421f05b03859972639f51ed2eccbf3dc5a62e2e1b15ac41c02e44c9e47eaeb4bb313adecd11012dfad435cd72ce71f525329f24d75c5b9432774e148e9209baf3f1656a46986d5f38ddf4e20912c6ac28f48d6bf747469fb100000000',
    expected: {
      version: 2,
      marker: 0,
      flag: 1,
      vinCount: 1,
      voutCount: 1,
      voutSats: [0],
      witnessCount: [4],
      locktime: 0
    }
  }
]

describe('Transaction decoding', () => {
  for (const sampleTx of sampleTransactions) {
    const { label, hex, expected } = sampleTx
    describe(`Decodes ${label}`, () => {
      const decodedTx = TxDecoded.fromHex(hex)

      it('Decodes the version', () => {
        expect(decodedTx.getVersion().value).toBe(expected.version)
      })

      if (expected.flag !== undefined) {
        it('Decodes the flag', () => {
          expect(decodedTx.getFlag().value).toBe(expected.flag)
        })
      }

      if (expected.marker !== undefined) {
        it('Decodes the marker', () => {
          expect(decodedTx.getMarker().value).toBe(expected.marker)
        })
      }

      it('Decodes the input count', () => {
        expect(decodedTx.getInputCount().value).toBe(expected.vinCount)
      })

      it('Decodes the output count', () => {
        expect(decodedTx.getOutputCount().value).toBe(expected.voutCount)
      })

      it('Decodes the output values', () => {
        for (let i = 0; i < expected.voutCount; i += 1) {
          expect(decodedTx.getOutputValue(i).value).toBe(expected.voutSats[i])
        }
      })

      if (expected.witnessCount !== undefined) {
        it('Decodes the witness count', () => {
          for (let i = 0; i < expected.witnessCount.length; i += 1) {
            expect(decodedTx.getWitnessVarInt(i).value).toBe(
              expected.witnessCount[i]
            )
          }
        })
      }

      it('Decodes locktime', () => {
        expect(decodedTx.getLocktime().value).toBe(expected.locktime)
      })
    })
  }
})
