/**
 * BIP-137 sign/verify test vectors.
 *
 * Signatures were cross-generated and self-verified with the independent
 * `bip322-js` reference implementation (github.com/ACken2/bip322-js), using
 * deterministic RFC6979 ECDSA signing, so exact-byte comparison is
 * meaningful here.
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
      message: 'Hello World',
      p2pkh:
        'H+VOaJqYujtXtcPDtZ6W6IgkgfFgy+84R5KKWfTyJ5kTEDWMxs8as6x04VcNL8ONsavGfnixvOGYB2aWfZ14eCw=',
      p2shP2wpkh:
        'I+VOaJqYujtXtcPDtZ6W6IgkgfFgy+84R5KKWfTyJ5kTEDWMxs8as6x04VcNL8ONsavGfnixvOGYB2aWfZ14eCw=',
      p2wpkh:
        'J+VOaJqYujtXtcPDtZ6W6IgkgfFgy+84R5KKWfTyJ5kTEDWMxs8as6x04VcNL8ONsavGfnixvOGYB2aWfZ14eCw='
    },
    {
      message: 'satsigner BIP-137 test vector',
      p2pkh:
        'H/N3DLwjTNBTZq4lB6lkqEAFAnDKCyVQssapKdMBuYvDREJKIdgQLuiGkb3wigLw2az8HAQYtm/Ty36UxiV7/QQ=',
      p2shP2wpkh:
        'I/N3DLwjTNBTZq4lB6lkqEAFAnDKCyVQssapKdMBuYvDREJKIdgQLuiGkb3wigLw2az8HAQYtm/Ty36UxiV7/QQ=',
      p2wpkh:
        'J/N3DLwjTNBTZq4lB6lkqEAFAnDKCyVQssapKdMBuYvDREJKIdgQLuiGkb3wigLw2az8HAQYtm/Ty36UxiV7/QQ='
    }
  ],
  privateKeyHex:
    '820b967776cab711e0e05a8d04385e71d4333b2be73f39edfd73d2d3ea9e1312'
}
