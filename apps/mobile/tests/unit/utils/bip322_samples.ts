/**
 * BIP-322 test vectors.
 *
 * `taproot` is the official test vector from the `bitcoin/bips` repository
 * (bip-0322/generated-test-vectors.json, "simple"/p2tr entry), fetched
 * directly (not through a summarizing tool) to avoid transcription error in
 * the byte-sensitive signature. Its `bip322_signatures[0]` value carries the
 * newer draft `smp` text prefix; `signatureNoPrefix` below is that value
 * with the prefix stripped, matching the no-prefix format satsigner
 * produces (see utils/bip322.ts).
 *
 * `txHashes` vectors (message hash / to_spend txid / to_sign txid) are from
 * bip-0322/basic-test-vectors.json and are independent of any key or
 * address type, used to validate the shared transaction-building helpers.
 */

export const bip322Taproot = {
  address: 'bc1pcquvhrqv0q68t4m0hfq6tpn006qrskyc7yrqnp2uyrf2emg3wynsdjyk38',
  message: 'PURVOQ544B6HUATVBJZN5EZJUU',
  privateKeyWif: 'L5XqN6ckPPsDiTbRxcsthwiWpDBfWLo4uquUEydsPt8rSMoTpqpc',
  signatureNoPrefix:
    'AUB6B2Rbupzua8LTQIF06516wzl+cwKy1be8RgoiW0riyXdKwe6GTz/5Hnb37m67pJwIKCh+D5jDueG6KpvYpmu8',
  signatureWithPrefix:
    'smpAUB6B2Rbupzua8LTQIF06516wzl+cwKy1be8RgoiW0riyXdKwe6GTz/5Hnb37m67pJwIKCh+D5jDueG6KpvYpmu8'
}

export const bip322TxHashes = [
  {
    address: 'bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l',
    message: '',
    messageHash:
      'c90c269c4f8fcbe6880f72a721ddfbf1914268a794cbb21cfafee13770ae19f1',
    toSignTxHash:
      '1e9654e951a5ba44c8604c4de6c67fd78a27e81dcadcfe1edf638ba3aaebaed6',
    toSpendTxHash:
      'c5680aa69bb8d860bf82d4e9cd3504b55dde018de765a91bb566283c545a99a7'
  },
  {
    address: 'bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l',
    message: 'Hello World',
    messageHash:
      'f0eb03b1a75ac6d9847f55c624a99169b5dccba2a31f5b23bea77ba270de0a7a',
    toSignTxHash:
      '88737ae86f2077145f93cc4b153ae9a1cb8d56afa511988c149c5c8c9d93bddf',
    toSpendTxHash:
      'b79d196740ad5217771c1098fc4a4b51e0535c32236c71f1ea4d61a2d603352b'
  }
]
