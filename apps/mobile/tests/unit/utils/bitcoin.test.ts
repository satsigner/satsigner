import { bip21decode, isBitcoinAddress } from '@/utils/bitcoin'

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

  describe('bip21decode', () => {
    it('should decode a valid bitcoin address', () => {
      const result = bip21decode('bc1qs5g58y64vzls986hnrz3atj6p2tcdqqgvu5g5c')
      expect(result).toEqual('bc1qs5g58y64vzls986hnrz3atj6p2tcdqqgvu5g5c')
    })

    it('should decode a valid BIP21 URI', () => {
      const uri =
        'bitcoin:bc1qrc9ty0xfv908ja5r6xmzpnnr2ug6sfu0tl8j26?amount=0.02587175'
      const decodedData = {
        address: 'bc1qrc9ty0xfv908ja5r6xmzpnnr2ug6sfu0tl8j26',
        options: { amount: 0.02587175 }
      }
      const result = bip21decode(uri)
      expect(result).toEqual(decodedData)
    })

    it('should return undefined for invalid address', () => {
      expect(bip21decode('bc1qinvalidaddress1234567890')).toBeUndefined()
    })
  })
})
