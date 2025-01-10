import { isBitcoinAddress } from '@/utils/bitcoin'

describe('bitcoin utils', () => {
  describe('isBitcoinAddress', () => {
    it('should return a valid bitcoin address', () => {
      expect(
        isBitcoinAddress('myqtdq5wcy9vcm6z2muxla0y0eg94h06jgkcqnhhy4f')
      ).toBeFalsy()
      expect(
        isBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
      ).toBeTruthy() // P2PKH address
      expect(
        isBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')
      ).toBeTruthy() // P2SH address
      expect(
        isBitcoinAddress('bc1q8d968eg8ua3dk8mkql9d0vj35nzplsd4zmulus')
      ).toBeTruthy() // Bech32 address
      expect(
        isBitcoinAddress('tb1qlj64u6fqutr0xue85kl55fx0gt4m4urun25p7q')
      ).toBeTruthy() // Testnet Bech32 address
    })
  })
})
