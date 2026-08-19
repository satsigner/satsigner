/**
 * BIP-137 sign/verify test vectors.
 *
 * Signatures are cross-generated and self-verified with the independent
 * `ecpair` reference implementation (github.com/bitcoinjs/ecpair), signing
 * with `lowR: true` - the same low-R grinding technique satsigner uses
 * (see utils/ecdsaLowR.ts), matching Bitcoin Core / LND / bitcoinjs-lib.
 * Since ECDSA here is RFC6979-deterministic and low-R is fully specified,
 * exact-byte comparison is meaningful.
 */

export const bip137Vectors = {
  addresses: {
    p2pkh: '11gECtvDapMj5ZuwpvnP6Wv9MTRGxnFRs',
    p2shP2wpkh: '3NH6r7Rutbno963tVmtXk2zZZqnXuw2H3L',
    p2wpkh: 'bc1qqqstacyqel0tgvx0wg7e2twg3d4mwsjpxms4ta'
  },
  cases: [
    {
      message: '',
      p2pkh:
        'IGswcd3b9uL6/EeP3Yy4U3nR2Otlgitg4WPjYstDWG2oYL156b2rIEO6PYNaWss5S41F9UnJE7PEu5/XpIR6wmI=',
      p2shP2wpkh:
        'JGswcd3b9uL6/EeP3Yy4U3nR2Otlgitg4WPjYstDWG2oYL156b2rIEO6PYNaWss5S41F9UnJE7PEu5/XpIR6wmI=',
      p2wpkh:
        'KGswcd3b9uL6/EeP3Yy4U3nR2Otlgitg4WPjYstDWG2oYL156b2rIEO6PYNaWss5S41F9UnJE7PEu5/XpIR6wmI='
    },
    {
      // The unground RFC6979 signature for this message is high-R, so the
      // grinding loop retries once to find this low-R signature - unlike
      // the '' case above, which happens to be low-R on the first attempt.
      message: 'Hello World',
      p2pkh:
        'Hzr8fTaRrKgOciIS3SoZ6RUr0z/dSDniOidVz/fZSzxdWddmU6/JteqouK21nOl6JBLkXaJfL53AgBgbjOquxMQ=',
      p2shP2wpkh:
        'Izr8fTaRrKgOciIS3SoZ6RUr0z/dSDniOidVz/fZSzxdWddmU6/JteqouK21nOl6JBLkXaJfL53AgBgbjOquxMQ=',
      p2wpkh:
        'Jzr8fTaRrKgOciIS3SoZ6RUr0z/dSDniOidVz/fZSzxdWddmU6/JteqouK21nOl6JBLkXaJfL53AgBgbjOquxMQ='
    },
    {
      // Also high-R unground; see the 'Hello World' comment above.
      message: 'satsigner BIP-137 test vector',
      p2pkh:
        'Hz/u9+a9xZ7jamvSbeVubiuAFoC1x/M0HGByDAYwIVV5fPav6xXXYC3Y7jogIsfAGc7jA9fDcjx76GU5opeWgWc=',
      p2shP2wpkh:
        'Iz/u9+a9xZ7jamvSbeVubiuAFoC1x/M0HGByDAYwIVV5fPav6xXXYC3Y7jogIsfAGc7jA9fDcjx76GU5opeWgWc=',
      p2wpkh:
        'Jz/u9+a9xZ7jamvSbeVubiuAFoC1x/M0HGByDAYwIVV5fPav6xXXYC3Y7jogIsfAGc7jA9fDcjx76GU5opeWgWc='
    }
  ],
  privateKeyHex:
    '820b967776cab711e0e05a8d04385e71d4333b2be73f39edfd73d2d3ea9e1312'
}
