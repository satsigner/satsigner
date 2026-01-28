/**
 * Test samples for Nostr-related tests
 * Contains real/realistic data for comprehensive testing
 */

// Real npub/nsec pairs (test vectors - DO NOT use in production)
// These are derived from known test mnemonics
export const nostrKeys = {
  // From mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
  alice: {
    nsec: 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5',
    npub: 'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg',
    privateKeyHex:
      '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa'
  },
  // From mnemonic: "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong"
  bob: {
    nsec: 'nsec1u5tsnlpuvuljupfvhwyjmr8psjgv6ayku5xgqpuhwq0sqnn0gcss9z89sr',
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    privateKeyHex:
      'e517093fc9c3b2edc249b17c0f65a7d55064e8a8c5a3c0a29e5c0a029cde8c42'
  },
  // Invalid/malformed for error testing
  invalid: {
    nsec: 'nsec1invalid',
    npub: 'npub1invalid',
    notBech32: 'not-a-valid-key'
  }
}

// Real wallet descriptors
export const descriptors = {
  // Testnet P2WPKH singlesig
  singlesig: {
    external:
      "wpkh([73c5da0a/84'/1'/0']tpubDC8msFGeGuwnKG9Upg7DM2b4DaRqg3CUZa5g8v2SRQ6K4NSkxUgd7HsL2XVWbVm39yBA4LAxysQAm397zwQSQoQgewGiYZqrA9DsP4zbQ1M/0/*)#2ag6nxcd",
    internal:
      "wpkh([73c5da0a/84'/1'/0']tpubDC8msFGeGuwnKG9Upg7DM2b4DaRqg3CUZa5g8v2SRQ6K4NSkxUgd7HsL2XVWbVm39yBA4LAxysQAm397zwQSQoQgewGiYZqrA9DsP4zbQ1M/1/*)#rcxsyf5h"
  },
  // Testnet 2-of-3 multisig
  multisig: {
    external:
      "wsh(sortedmulti(2,[73c5da0a/48'/1'/0'/2']tpubDFH9dgzveyD8zTbPUFuLrGmCydNvxehyNdUXKJAQN8x4aZ4j6UZqGfnqFrD4NqyaTVGKbvEW54tsvPTK2UoSbCC1PJY8iCNiwTL3RWZEheQ/0/*,[f57a6b99/48'/1'/0'/2']tpubDE8wPPUAhLGBvb4M3RjkhcPpGqQDcsnpQto4Wv5J8PUnLwiYijav8fqPCvumR4YPLF8QYWN4cJhPGa5emobn3bgLZ2LnQ3LBhDJKBhibTv6/0/*,[88f45d39/48'/1'/0'/2']tpubDEXPmjWQgLvkD6kLnQzumDB8yxvygNzAFkuA99nbPU2xcGZHnJBqDdCdbCpLCxfMSmTnYCjkkxWNKfuhTTbVsL2p8C4EumzSuADWPSSBWqD/0/*))#cflzs9pc",
    internal:
      "wsh(sortedmulti(2,[73c5da0a/48'/1'/0'/2']tpubDFH9dgzveyD8zTbPUFuLrGmCydNvxehyNdUXKJAQN8x4aZ4j6UZqGfnqFrD4NqyaTVGKbvEW54tsvPTK2UoSbCC1PJY8iCNiwTL3RWZEheQ/1/*,[f57a6b99/48'/1'/0'/2']tpubDE8wPPUAhLGBvb4M3RjkhcPpGqQDcsnpQto4Wv5J8PUnLwiYijav8fqPCvumR4YPLF8QYWN4cJhPGa5emobn3bgLZ2LnQ3LBhDJKBhibTv6/1/*,[88f45d39/48'/1'/0'/2']tpubDEXPmjWQgLvkD6kLnQzumDB8yxvygNzAFkuA99nbPU2xcGZHnJBqDdCdbCpLCxfMSmTnYCjkkxWNKfuhTTbVsL2p8C4EumzSuADWPSSBWqD/1/*))#qryq2wwf"
  },
  // Mainnet P2WPKH for production-like testing
  mainnet: {
    external:
      "wpkh([d34db33f/84'/0'/0']xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG/0/*)#jfve3kwe"
  }
}

// Complete valid PSBTs for testing
export const psbts = {
  // Simple 1-input 2-output testnet PSBT (unsigned)
  simple:
    'cHNidP8BAHECAAAAAUZHyK9PT4FYVp8T6+FO3kmlPLVvRQ9Pt0GfK7K5nYsGAAAAAAD9////AhAnAAAAAAAAFgAU8Lz+DzygRWsgJlFqON6G1jPzpuOIEwAAAAAAABYAFNDFmQPFusKGh2DpD9UhpGZap2UgAAAAAAABAR8gTgAAAAAAABYAFLXOBJOxjkBLjbCcJfIo0aJGTq/4IgYD7VHsZ2kRnfyIB9mJsJD6pN2c8m6Z/7QjIuOyF/OGhcMYc8XaCFQAAIABAACAAAAAgAAAAAAAAAAAAAAiAgKvGGpJVWFbfpwWf+v8k98wMmHgMEdOSqgmOSBXs3e1zBhzxdoIVAAAgAEAAIAAAACAAQAAAAAAAAAA',

  // 2-of-3 multisig PSBT (partially signed)
  multisig:
    'cHNidP8BAFUCAAAAAVa19T4xk5x/eCRI8LcdGabvAYudhqLAiPl2xBmfKDulAAAAAAD9////AYAaBgAAAAAAF6kUcNqLdOW2bSHjTJR4v4oQynIhMQWHAAAAAAABASughgEAAAAAABepFAqjGJl1E1x3VrLcM02kZlVMY4WhhydSIQMn37CRyRWIKMw3IcPvYwW5AHhqECdH5Kx2bB32shgVQyEC4r5ymtgXjhX3DJXcHTGVvZNPBKrkT2Y76xTLEpUdqA1SriIGAuffsFHJFYgozDchw+9jBbkAeGoQJ0fkrHZsHfayGBUDGHPF2ghUAACAAQAAgAAAAIACAACAAAAAAAAiAgLivnKa2BeOFfcMldwdMZW9k08EquRPZjvrFMsSlR2oDRiPRdM5VAAAgAEAAIAAAACAAgAAgAAAAAAA',

  // Invalid PSBT (malformed)
  invalid: 'cHNidP8BAHUCAAAAnotvalid',

  // PSBT prefix variations for parsing tests
  withWhitespace:
    '  cHNidP8BAHECAAAAAUZHyK9PT4FYVp8T6+FO3kmlPLVvRQ9Pt0GfK7K5nYsGAAAAAAD9////  ',
  withNewlines:
    '\ncHNidP8BAHECAAAAAUZHyK9PT4FYVp8T6+FO3kmlPLVvRQ9Pt0GfK7K5nYsGAAAAAAD9////\n'
}

// Realistic Nostr message payloads
export const nostrMessages = {
  // BIP329 label sync message
  labelSync: {
    created_at: 1704067200,
    label: 1,
    description: 'Here come some labels',
    data: {
      data_type: 'LabelsBip329',
      data: '{"type":"tx","ref":"0a1b2c3d4e5f","label":"Coffee payment"}\n{"type":"addr","ref":"bc1qtest","label":"Savings"}'
    }
  },

  // PSBT sharing message
  psbtShare: {
    created_at: 1704067200,
    label: 1,
    description: 'Please sign this transaction',
    data: {
      data_type: 'PSBT',
      data: 'cHNidP8BAHECAAAAAUZHyK9PT4FYVp8T6+FO3kmlPLVvRQ9Pt0GfK7K5nYsGAAAAAAD9////AhAnAAAAAAAAFgAU8Lz+DzygRWsgJlFqON6G1jPzpuOIEwAAAAAAABYAFNDFmQPFusKGh2DpD9UhpGZap2UgAAAAAAABAR8gTgAAAAAAABYAFLXOBJOxjkBLjbCcJfIo0aJGTq/4'
    }
  },

  // Device announcement message
  deviceAnnouncement: {
    created_at: 1704067200,
    public_key_bech32:
      'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6'
  },

  // Simple DM/chat message
  directMessage: {
    created_at: 1704067200,
    description: 'Transaction confirmed! Hash: abc123def456'
  },

  // Transaction notification
  txNotification: {
    created_at: 1704067200,
    data: {
      data_type: 'Tx',
      data: '0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b'
    }
  }
}

// Relay URLs for testing
export const relays = {
  default: [
    'wss://relay.damus.io',
    'wss://nostr.bitcoiner.social',
    'wss://relay.nostr.band',
    'wss://nostr.mom'
  ],
  custom: ['wss://relay.custom1.com', 'wss://relay.custom2.com'],
  invalid: ['not-a-url', 'http://not-websocket.com']
}

// Account IDs for store testing
export const accountIds = {
  primary: 'acc_01H8XXXXXXXXXXXXXXXXXX',
  secondary: 'acc_01H9YYYYYYYYYYYYYYYYYY',
  nonexistent: 'acc_nonexistent_12345'
}

// Timestamps for EOSE testing (Unix timestamps)
export const timestamps = {
  genesis: 1231006505, // Bitcoin genesis block
  recent: 1704067200, // Jan 1, 2024
  future: 1893456000 // Jan 1, 2030
}
