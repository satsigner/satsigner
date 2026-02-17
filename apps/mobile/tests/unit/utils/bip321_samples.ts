/**
 * Test samples for BIP-321 URI and Lightning invoice testing
 * Contains real/realistic data for comprehensive edge case coverage
 */

// ============================================================================
// BITCOIN ADDRESSES - All formats and networks
// ============================================================================

export const addresses = {
  mainnet: {
    p2pkh: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // Satoshi's genesis address
    p2sh: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
    p2wpkh: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    p2tr: 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0',
    p2wsh: 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3'
  },
  // TESTNET
  testnet: {
    p2pkh: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
    p2sh: '2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc',
    p2wpkh: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    p2tr: 'tb1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq47zagq'
  },
  // REGTEST
  regtest: {
    p2wpkh: 'bcrt1q6rhpng9evdsfnn833a4f4vej0asu6dk5srld6x'
  },
  // INVALID - For error testing
  invalid: {
    tooShort: 'bc1q',
    wrongChecksum: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5', // last char wrong
    mixedCase: 'bc1qW508D6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    wrongPrefix: 'ltc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    notBech32: 'not-an-address-at-all'
  }
}

// ============================================================================
// BIP-321 URIs - Various formats and edge cases
// ============================================================================

export const bip321Uris = {
  // Valid URIs
  valid: {
    // Basic
    addressOnly: 'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    withAmount:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001',
    withLabel:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?label=Donation',
    withBoth:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001&label=Coffee',
    withMessage:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.5&label=Invoice&message=Payment%20for%20services',

    // Amount edge cases
    amountWholeNumber:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=1',
    amountManyDecimals:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.00000001',
    amountLarge:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=21000000',
    amountWithZeros:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.10000000',

    // Label edge cases
    labelWithSpaces:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?label=My%20Payment%20Label',
    labelWithSpecialChars:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?label=%E2%82%BF%20Bitcoin%20%26%20More',
    labelUnicode:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?label=%F0%9F%92%B0%20Tip',

    // Case variations
    uppercaseScheme:
      'BITCOIN:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001',
    mixedCaseScheme:
      'Bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001',

    // Testnet
    testnet: 'bitcoin:tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx?amount=0.001',

    // Regtest
    regtest: 'bitcoin:bcrt1q6rhpng9evdsfnn833a4f4vej0asu6dk5srld6x?amount=0.01',

    // Legacy addresses
    p2pkh: 'bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.001',
    p2sh: 'bitcoin:3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy?amount=0.001'
  },

  // Invalid URIs
  invalid: {
    noScheme: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001',
    wrongScheme:
      'litecoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001',
    negativeAmount:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=-0.001',
    invalidAddress: 'bitcoin:invalidaddress?amount=0.001',
    emptyAddress: 'bitcoin:?amount=0.001'
  }
}

// ============================================================================
// LIGHTNING INVOICES - All networks
// ============================================================================

export const lightningInvoices = {
  // Real BOLT11 invoice format examples
  mainnet: {
    // Simple mainnet invoice
    basic:
      'lnbc10u1pnq9jt3pp5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsdqqcqzzgxqyz5vqrzjqwnvuc0u4txn35cafc7w94gxvq5p3cu9dd95f7hlrh0fvs46wpvhddrwgrqy63w5eyqqqqryqqqqthqqpysp5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqs9qypqsq',
    // With description
    withDescription:
      'lnbc20m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpusp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9qrsgq'
  },
  testnet: {
    basic:
      'lntb10u1pnq9jt3pp5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsdqqcqzzgxqyz5vqrzjqwnvuc0u4txn35cafc7w94gxvq5p3cu9dd95f7hlrh0fvs46wpvhddrwgrqy63w5eyqqqqryqqqqthqqpy'
  },
  regtest: {
    basic:
      'lnbcrt10u1pnq9jt3pp5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsdqqcqzzgxqyz5vqrzjqwnvuc0u4txn35cafc7w94gxvq5p3cu9dd95f7hlrh0fvs46wpvhddrwgrqy63w5eyqqqqryqqqqthqqpy'
  },
  signet: {
    basic:
      'lntbs10u1pnq9jt3pp5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsdqqcqzzgxqyz5vqrzjqwnvuc0u4txn35cafc7w94gxvq5p3cu9dd95f7hlrh0fvs46wpvhddrwgrqy63w5eyqqqqryqqqqthqqpy'
  },
  invalid: {
    wrongPrefix: 'lnxyz10u1pnq9jt3pp5qqqqqqqqqqqqqqqqqq',
    tooShort: 'lnbc1',
    notBech32: 'lightning-invoice-not-bech32',
    expiredFormat: 'lnbc10u1pnq9jt3' // truncated, invalid
  }
}

// ============================================================================
// BOLT12 OFFERS - Future support
// ============================================================================

export const bolt12Offers = {
  valid: {
    // BOLT12 offers start with 'lno1'
    basic:
      'lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrcgqgn3qzs2grp23j3f35hewwzwcqpyfx2'
  },
  invalid: {
    wrongPrefix: 'lni1qgsqvgnwgcg35z6ee2h3yczraddm72',
    tooShort: 'lno1'
  }
}

// ============================================================================
// LNURL - For completeness
// ============================================================================

export const lnurls = {
  valid: {
    pay: 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
    withdraw:
      'lnurl1dp68gurn8ghj7um9wfmxjcm99e5k7telwy7nhs7f4xc6mnwd6x2umbwfjhxamkwpshyctnd9khqcte0pc8y6t0dscqzpuxqcrqvpsxqcrqvpsxqcrqvpsxqcrqvpjx2c'
  },
  invalid: {
    notBech32: 'lnurl-not-valid-bech32',
    wrongHrp: 'lnbc1dp68gurn8ghj7um9wfmxjcm99e3k7mf0'
  }
}

export const cashuTokens = {
  valid: {
    v3: 'cashuAeyJ0b2tlbiI6W3sibWludCI6Imh0dHBzOlwvXC9taW50Lm1pbmliaXRzLmNhc2hcL0JpdGNvaW4iLCJwcm9vZnMiOlt7ImFtb3VudCI6NCwiaWQiOiIwMDUwMDU1MGYwNDk0MTQ2IiwiQyI6IjAzYjhlMTk1NGZmNWMwZDQ0ZTNkY2UzYzFhYTc2NmYxNjQxYmFiODIzY2YyZjNlNTIwM2U2YmFmM2VmYTg1MWQyZCIsInNlY3JldCI6ImYzNjFhMDg0NjA2OWExNGRjYjNmNDIxYjczZjE0ZTM1NGU0MmExYmMxZmExNDMxMDU2ZTVmNTViMjRjZmJkYjcifSx7ImFtb3VudCI6MSwiaWQiOiIwMDUwMDU1MGYwNDk0MTQ2IiwiQyI6IjAzNmM1ZTkyZThmYWE2MzUwM2MxMDhmYjM5ZTUzOWFjZDMxZDcyYmFkNTNmZjliNGI0MzMzNjg5ODZlNjkyMzFhNiIsInNlY3JldCI6ImFiYTM0Y2U1ZjY2NThhMTg4MzcyY2Q5MTdlNzNjZmQwN2EyN2I0ZjZhZjY2YTdiODc5Y2YxZjZmYjk5MWUyOTIifV19XSwidW5pdCI6InNhdCIsIm1lbW8iOiJUaGUifQ==',
    v4: 'cashuBpGFkY1RoZWFteCJodHRwczovL21pbnQubWluaWJpdHMuY2FzaC9CaXRjb2luYXUBomFpSABQBVDwSUFGYXCCpGFhBGFjWCEDuOGVT_XA1E49zjwap2bxZBurgjzy8-UgPmuvPvqFHS1hZKNhZVggEr7rCRUK9k-BAcHL8KDo6xLHUdgRIEdYPHBDG8SLsiBhclgg0GJfUuDnzeJ41FQuJmMbRZpCaVPrX82oq4mX_Lys1oRhc1gg7K43leq-f4__YuuDlQbF8i5hlQ9QzDwbHB4Oa9BmkY5hc3hAZjM2MWEwODQ2MDY5YTE0ZGNiM2Y0MjFiNzNmMTRlMzU0ZTQyYTFiYzFmYTE0MzEwNTZlNWY1NWIyNGNmYmRiN6RhYQFhY1ghA2xekuj6pjUDwQj7OeU5rNMdcrrVP_m0tDM2iYbmkjGmYWSjYWVYIO-ywKw6qVY14IUP7xIx6a0rLDx_cYjl-bmi_0wEClY0YXJYIMMIsiZpO5CClw4NCBsr1Kw8GwRYfOycbB0i4bSrGAh7YXNYIHmUcFhh35lOpEY17udMmGIbkAI-tCSxh0bVOAYzzU5EYXN4QGFiYTM0Y2U1ZjY2NThhMTg4MzcyY2Q5MTdlNzNjZmQwN2EyN2I0ZjZhZjY2YTdiODc5Y2YxZjZmYjk5MWUyOTJhdWNzYXQ='
  },
  invalid: {
    wrongPrefix: 'cashXAeyJ0b2tlbiI...',
    malformed: 'cashuAnot-valid-base64!@#$',
    empty: 'cashuA'
  }
}

// ============================================================================
// AMOUNT CONVERSION TEST CASES
// ============================================================================

export const amountConversions = {
  // BTC -> Sats conversions
  btcToSats: [
    { btc: '0.00000001', sats: 1 },
    { btc: '0.00000546', sats: 546 },
    { btc: '0.001', sats: 100000 },
    { btc: '1', sats: 100000000 },
    { btc: '21000000', sats: 21_000_000 * 100_000_000 },
    { btc: '0.12345678', sats: 12345678 }
  ],
  // Edge cases
  edgeCases: [
    { btc: '0', sats: 0 },
    { btc: '0.0', sats: 0 },
    { btc: '0.00000000', sats: 0 }
  ]
}

export const formattingEdgeCases = {
  // URIs with whitespace
  whitespace: {
    leadingSpace:
      '  bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001',
    trailingSpace:
      'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001  ',
    bothSpaces:
      '  bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001  ',
    newlines:
      '\nbitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001\n',
    tabs: '\tbitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=0.001\t'
  },
  // Lightning with prefix variations
  lightningPrefixes: {
    withLightningScheme:
      'lightning:lnbc10u1pnq9jt3pp5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsdqqcqzzg',
    uppercaseLightning:
      'LIGHTNING:lnbc10u1pnq9jt3pp5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsdqqcqzzg'
  }
}

export const networkDetection = {
  mainnet: {
    addresses: [
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'
    ],
    lightningPrefix: 'lnbc'
  },
  testnet: {
    addresses: [
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      '2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc'
    ],
    lightningPrefix: 'lntb'
  },
  signet: {
    lightningPrefix: 'lntbs'
  },
  regtest: {
    addresses: ['bcrt1q6rhpng9evdsfnn833a4f4vej0asu6dk5srld6x'],
    lightningPrefix: 'lnbcrt'
  }
}
