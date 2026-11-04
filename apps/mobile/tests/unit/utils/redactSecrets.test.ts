import { REDACTED, redactSecrets } from '@/utils/redactSecrets'

const XPRV =
  'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi'
const TPRV =
  'tprv8ZgxMBicQKsPd9TeAdPADNnSyH9SSUUbTVeFszDE23Ki6TBB5nCefAdHkK8Fm3qMQR6sHwA56zqRmKmxnHk37JkiFzvncDqoKmPWubu7hDF'
const XPUB =
  'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8'
const NSEC = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5'
const WIF_UNCOMPRESSED = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ'
const WIF_COMPRESSED = 'KwdMAjGmerYanjeui5SHS7JkmpZvVipYvB2LJGU1ZxJwYvP98617'
const WIF_TESTNET = 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA'
const HEX_64 =
  '0c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d'
const PSBT_BASE64 =
  'cHNidP8BAHUCAAAAASaBcTce3/KF6Tet7qSze3gADAVmy7OtZGQXE8pCFxv2AAAAAAD+////AtPf9QUAAAAAGXapFNDFmQPFusKGh2DpD9UhpGZap2UgiKwA'
const PSBT_HEX = '70736274ff01007502000000012681713'

describe('redactSecrets', () => {
  it.each([
    ['an xprv', XPRV],
    ['a tprv', TPRV],
    ['an nsec', NSEC],
    ['an uncompressed WIF', WIF_UNCOMPRESSED],
    ['a compressed WIF', WIF_COMPRESSED],
    ['a testnet WIF', WIF_TESTNET],
    ['a base64 PSBT', PSBT_BASE64],
    ['a hex PSBT', PSBT_HEX]
  ])('masks %s', (_name, secret) => {
    expect(redactSecrets(`import failed for ${secret} (bad network)`)).toBe(
      `import failed for ${REDACTED} (bad network)`
    )
  })

  it.each([
    ['privateKey: ', HEX_64],
    ['secret=', HEX_64],
    ['"seed":"', `${HEX_64}"`],
    ['priv key 0x', HEX_64]
  ])('masks hex after a %p label', (label, value) => {
    expect(redactSecrets(`${label}${value}`)).not.toContain(HEX_64)
    expect(redactSecrets(`${label}${value}`)).toContain(REDACTED)
  })

  it.each([
    ['a txid', `broadcast ${HEX_64}`],
    ['an xpub', `watching ${XPUB}`],
    ['a legacy address', 'sent to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'],
    ['a segwit address', 'sent to bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'],
    [
      'an npub',
      'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6'
    ],
    ['plain text', 'Electrum server unreachable after 3 tries']
  ])('leaves %s alone', (_name, text) => {
    expect(redactSecrets(text)).toBe(text)
  })
})
