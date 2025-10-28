import { getScriptVersionType } from '@/utils/address'

const MAINNET_P2PKH = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
const SIGNET_P2PKH_1 = 'mgjgqdtwXciPiQufZef9q4gEM3HYt8pLbn'
const SIGNET_P2PKH_2 = 'n1tykAD25bXrw2jo3bY8J4Erk3V6MfhG47'

const MAINNET_P2SH = '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'
const SIGNET_P2SH = '2N3q7D9sdwUjULRSkFbAJoAm8fgLyEsjB9b'

const MAINNET_P2TR =
  'bc1p5cyxnuxmeuwuvkwfem96l7d9x7f4n7s3f4g0w7k0r4m9y3mx6sxq9v4r5u'
const SIGNET_P2TR =
  'tb1pqtrwjvqh0k759mwfpwcsz47rw6j3tqk5tjf2a9vy5ymv263fndyqe5fkrj'

const MAINNET_P2WPKH = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
const SIGNET_P2WPKH = 'tb1q7sudg83ang34cezufnd4zvm6rr7tjujuteqeqp'

describe('Address Utils', () => {
  describe('getScriptVersionType', () => {
    it('should return P2PKH for P2PKH addresses', () => {
      expect(getScriptVersionType(MAINNET_P2PKH)).toBe('P2PKH')
      expect(getScriptVersionType(SIGNET_P2PKH_1)).toBe('P2PKH')
      expect(getScriptVersionType(SIGNET_P2PKH_2)).toBe('P2PKH')
    })

    it('should return P2SH for P2SH addresses', () => {
      expect(getScriptVersionType(MAINNET_P2SH)).toBe('P2SH')
      expect(getScriptVersionType(SIGNET_P2SH)).toBe('P2SH')
    })

    it('should return P2TR for P2TR addresses', () => {
      expect(getScriptVersionType(MAINNET_P2TR)).toBe('P2TR')
      expect(getScriptVersionType(SIGNET_P2TR)).toBe('P2TR')
    })

    it('should return P2WPKH for P2WPKH addresses', () => {
      expect(getScriptVersionType(MAINNET_P2WPKH)).toBe('P2WPKH')
      expect(getScriptVersionType(SIGNET_P2WPKH)).toBe('P2WPKH')
    })

    it('should return null for invalid addresses', () => {
      expect(getScriptVersionType('bc1invalidbitcoinaddress')).toBeNull()
    })
  })
})
