// App Store Connect / TestFlight release kit. Edit copy here and commit;
// release/index.html renders it with limits, counters, and copy buttons.
window.RELEASE = {
  app: {
    name: 'satsigner',
    // Proton Mail inbox. Nostr contact is satsigner@satsigner.com (NIP-05).
    email: 'satsigner@protonmail.com',
    bundleId: 'com.satsigner.satsigner',
    version: '1.0',
    sku: 'satsigner-ios',
    site: 'https://satsigner.com'
  },

  // Problems found in the app repo that can get a build rejected.
  // Fix these in ~/Desktop/git/satsigner/apps/mobile before uploading.
  blockers: [
    {
      title: 'Crypto wallets must ship from an Organization account',
      body: 'App Review Guideline 3.1.5(i) only allows wallet apps from developers enrolled as an organization. Check the team type under Membership in developer.apple.com. Internal TestFlight testing works without it, but external TestFlight and App Store review will reject an individual account.',
      where: 'developer.apple.com → Membership'
    },
    {
      title: 'Vague permission purpose strings',
      body: 'Review rejects generic strings like "Allow $(PRODUCT_NAME) to access your camera" (Guideline 5.1.1). Use the strings in the "Info.plist purpose strings" section below.',
      where: 'apps/mobile/app.config.ts: expo-camera plugin, ios.infoPlist'
    },
    {
      title: 'Microphone permission requested but never used',
      body: 'expo-camera adds NSMicrophoneUsageDescription by default. Pass microphonePermission: false (and recordAudioAndroid: false) to the expo-camera plugin, or Review may ask why the app needs the microphone.',
      where: 'apps/mobile/app.config.ts: expo-camera plugin'
    },
    {
      title: 'Dev-client local network string in release builds',
      body: 'Info.plist contains "Expo Dev Launcher uses the local network…" from expo-dev-client. Make sure the production build either drops expo-dev-client or has a real NSLocalNetworkUsageDescription (for example, connecting to a node on your LAN).',
      where: 'apps/mobile/app.config.ts: plugins'
    },
    {
      title: 'iPad support is on (supportsTablet: true)',
      body: 'With iPad support on, App Store Connect requires 13" iPad screenshots, and Review tests on iPad. Either set supportsTablet: false for 1.0, or design and capture iPad screens.',
      where: 'apps/mobile/app.config.ts: ios.supportsTablet'
    },
    {
      title: 'Export compliance key missing',
      body: 'Add ITSAppUsesNonExemptEncryption to Info.plist so each TestFlight build skips the encryption prompt. See "Export compliance" below for the answer.',
      where: 'apps/mobile/app.config.ts: ios.infoPlist'
    }
  ],

  // App Store Connect → App Information / Version fields.
  fields: [
    { group: 'App Information', key: 'name', label: 'Name', limit: 30, value: 'satsigner' },
    { group: 'App Information', key: 'subtitle', label: 'Subtitle', limit: 30, value: 'Self-custody bitcoin signer' },
    { group: 'App Information', key: 'category', label: 'Primary / secondary category', value: 'Finance / Utilities' },
    { group: 'App Information', key: 'contentRights', label: 'Content rights', value: 'Does not contain, show, or access third-party content' },
    { group: 'App Information', key: 'privacyUrl', label: 'Privacy Policy URL', value: 'https://satsigner.com/privacy-policy/', url: true },
    { group: 'App Information', key: 'termsUrl', label: 'License Agreement (custom EULA)', value: 'https://satsigner.com/terms/', url: true, note: 'Optional. Paste the Terms page text into App Information → License Agreement, or keep Apple’s standard EULA.' },

    { group: 'Version 1.0', key: 'promo', label: 'Promotional Text', limit: 170, multiline: true, value: 'See every sat you own. Pick exactly which coins you spend, sign with multisig and air-gapped QR, and connect your own node. No accounts, no tracking.' },
    { group: 'Version 1.0', key: 'description', label: 'Description', limit: 4000, multiline: true, value: [
      'satsigner is a self-custody bitcoin wallet and signer built around your coins. Every UTXO is visible, labeled, and under your control.',
      '',
      'SEE EVERY SAT',
      '• Bubble charts show each coin in your wallet at a glance',
      '• Pick the exact inputs for every transaction, or exclude coins you never want to spend',
      '• Sankey diagrams show where your sats go before you sign',
      '• Balance history, fee rate, and network charts',
      '',
      'SIGN YOUR WAY',
      '• Single-sig, M-of-N multisig, and watch-only accounts',
      '• Every script type: Legacy, Nested SegWit, Native SegWit, Taproot',
      '• Air-gapped signing with animated QR codes and NFC',
      '• Import and export PSBTs, descriptors, and extended public keys',
      '• Replace-by-fee, timelocks, and manual fee control',
      '',
      'PRIVATE BY DEFAULT',
      '• No accounts, no analytics, no tracking',
      '• Connect your own Electrum or Esplora server',
      '• Payjoin (BIP77 and BIP78) to break chain analysis',
      '• PIN encryption, duress PIN, and seed dropping',
      '',
      'YOUR LABELS, EVERYWHERE',
      '• BIP329 labels for addresses, transactions, and coins',
      '• Import and export JSON, JSONL, and CSV',
      '• Optional encrypted label sync over Nostr',
      '',
      'BEYOND ON-CHAIN',
      '• Lightning payments through your own LND node',
      '• Cashu eCash and Ark (experimental)',
      '• Block, transaction, and mempool explorer',
      '',
      'OPEN SOURCE',
      'satsigner is free and open source under the MIT License. Read the code at github.com/satsigner/satsigner.',
      '',
      'satsigner never holds your keys. You are responsible for backing up your seed phrase. Lose it, and nobody can recover your funds.'
    ].join('\n') },
    { group: 'Version 1.0', key: 'keywords', label: 'Keywords', limit: 100, value: 'bitcoin,wallet,utxo,multisig,psbt,cold storage,payjoin,nostr,lightning,ecash,cashu,sats,taproot' },
    { group: 'Version 1.0', key: 'supportUrl', label: 'Support URL', value: 'https://satsigner.com/support/', url: true },
    { group: 'Version 1.0', key: 'marketingUrl', label: 'Marketing URL', value: 'https://satsigner.com/', url: true },
    { group: 'Version 1.0', key: 'copyright', label: 'Copyright', value: '2026 satsigner' },
    { group: 'Version 1.0', key: 'whatsNew', label: 'What’s New', limit: 4000, multiline: true, value: 'First release on the App Store.', note: 'Hidden for a first release, but required on every update.' },

    { group: 'TestFlight', key: 'betaDescription', label: 'Beta App Description', limit: 4000, multiline: true, value: 'satsigner is a self-custody bitcoin wallet focused on UTXO control, multisig, and privacy. This beta covers creating and importing wallets, coin selection, sending and receiving, PSBT signing over QR and NFC, and BIP329 labels.' },
    { group: 'TestFlight', key: 'whatToTest', label: 'What to Test', limit: 4000, multiline: true, value: [
      'Please use signet or testnet, or small mainnet amounts only.',
      '',
      '1. Create a new wallet and back up the seed phrase.',
      '2. Receive coins, then pull to sync.',
      '3. Send using the bubble chart to pick inputs, and check the preview.',
      '4. Create a 2-of-3 multisig and sign a PSBT with the animated QR.',
      '5. Export and re-import your labels.',
      '',
      'Send feedback with a screenshot from inside the app, or email satsigner@protonmail.com.'
    ].join('\n') },
    { group: 'TestFlight', key: 'feedbackEmail', label: 'Feedback email', value: 'satsigner@protonmail.com' },

    { group: 'App Review', key: 'signIn', label: 'Sign-in required', value: 'No. The app has no accounts.' },
    { group: 'App Review', key: 'reviewNotes', label: 'Notes for the reviewer', limit: 4000, multiline: true, value: [
      'satsigner is a non-custodial, open-source bitcoin wallet (MIT License, github.com/satsigner/satsigner). It does not need an account or login.',
      '',
      'To test without real funds: on first launch tap Create, choose Signet in Settings → Network, and create a single-sig account. Signet coins have no monetary value.',
      '',
      'The developer never holds user funds or keys. The app does not sell, exchange, or transmit currency on anyone’s behalf, and it has no in-app purchases. Users sign transactions on their own device and broadcast them to the public bitcoin network.',
      '',
      'Permissions: the camera scans QR codes (addresses, PSBTs, backups), NFC talks to hardware signers and tags, and Face ID optionally unlocks the app.'
    ].join('\n') }
  ],

  // Suggested Info.plist purpose strings (Guideline 5.1.1).
  purposeStrings: [
    { key: 'NSCameraUsageDescription', value: 'satsigner uses the camera to scan QR codes for addresses, invoices, signed transactions (PSBTs), and wallet backups.' },
    { key: 'NFCReaderUsageDescription', value: 'satsigner uses NFC to exchange transactions and keys with hardware signers and NFC tags.' },
    { key: 'NSFaceIDUsageDescription', value: 'satsigner can use Face ID to unlock the app instead of your PIN.' },
    { key: 'NSLocalNetworkUsageDescription', value: 'satsigner connects to bitcoin and Lightning nodes you run on your local network.' },
    { key: 'ITSAppUsesNonExemptEncryption', value: 'false', note: 'Confirm the answer under "Export compliance" before committing this.' }
  ],

  // App Store Connect → App Privacy questionnaire.
  privacy: {
    answer: 'Data Not Collected',
    why: 'Apple counts data as "collected" when it leaves the device and the developer or its partners can access it longer than needed to serve the request. satsigner has no backend, analytics, or crash reporting. Users choose the servers the app talks to (their own node or public servers), and those requests only serve the user. Most open-source wallets answer the same way.',
    revisit: 'If you add crash reporting, analytics, push notifications, or a satsigner-run server, update this answer before the next build.'
  },

  exportCompliance: {
    answer: 'Uses encryption: Yes. Qualifies for an exemption: Yes. ITSAppUsesNonExemptEncryption = false.',
    why: 'The app uses standard cryptography only: HTTPS/TLS, AES for local data at rest, and secp256k1 signatures to authenticate bitcoin transactions. Apple’s export compliance guide treats encryption used only for HTTPS, authentication, and digital signatures as exempt. A wallet is a financial app, and cryptography is not its primary function.',
    caveat: 'This is guidance, not legal advice. If the app adds proprietary encryption or end-to-end messaging beyond authentication, revisit the answer. Nostr NIP-44 encrypted DMs are a gray area worth confirming.'
  },

  ageRating: {
    answer: '4+ (all questionnaire answers "None" / "No")',
    notes: 'No unrestricted web access, no user-generated content feed, no gambling, no contests. If the Nostr features grow into a public social feed, Guideline 1.2 requires reporting and blocking tools, and the rating goes up.'
  },

  // Screenshot slides for release/shots.html. `screen` is a studio route id.
  shots: [
    { screen: 'coin-bubbles', title: 'See every sat', sub: 'Each coin in your wallet, at a glance' },
    { screen: 'send', title: 'Spend exactly the coins you choose', sub: 'Full UTXO control on every transaction' },
    { screen: 'multisig-sign', title: 'Multisig without the headache', sub: 'Track every cosigner’s signature' },
    { screen: 'psbt-qr', title: 'Sign air-gapped', sub: 'Animated QR and NFC' },
    { screen: 'account', title: 'Every transaction, labeled', sub: 'Know where each sat came from' },
    { screen: 'payjoin-tx', title: 'Private by default', sub: 'Payjoin breaks chain analysis' },
    { screen: 'account-export-labels', title: 'Your labels go with you', sub: 'BIP329 import and export' },
    { screen: 'settings-network-server', title: 'Connect your own node', sub: 'Electrum or Esplora, your choice' }
  ],

  // Required graphic sizes. `required` matches App Store Connect today.
  formats: [
    { id: 'iphone69', label: 'iPhone 6.9"', w: 1320, h: 2868, required: true, note: 'Apple scales these down for every smaller iPhone.' },
    { id: 'iphone65', label: 'iPhone 6.5"', w: 1284, h: 2778, required: false, note: 'Only if you want hand-tuned 6.5" shots.' },
    { id: 'ipad13', label: 'iPad 13"', w: 2064, h: 2752, required: false, note: 'Required while supportsTablet is true.' },
    { id: 'header', label: 'Product page header', w: 3840, h: 1646, required: false, note: 'New optional header asset. 5244 × 2950 is also accepted.' }
  ],

  // Release checklist. Ticks are saved per browser.
  checklist: [
    { group: 'Account', items: [
      'Apple Developer Program is active and enrolled as an Organization (3.1.5)',
      'Agreements, Tax, and Banking: Free Apps agreement accepted',
      'App record created with bundle ID com.satsigner.satsigner'
    ] },
    { group: 'Build', items: [
      'Production build: APP_VARIANT=production, no expo-dev-client',
      'Purpose strings updated and microphone permission removed',
      'ITSAppUsesNonExemptEncryption set in Info.plist',
      'Decide iPad: supportsTablet false, or iPad screenshots ready',
      'Version 1.0 and a build number higher than the last upload',
      'Build uploaded (eas submit or Transporter) and processed',
      '1024 × 1024 app icon with no transparency in the build'
    ] },
    { group: 'Email (Proton)', items: [
      'Create satsigner@protonmail.com (free plan is enough)',
      'Turn on two-factor authentication and store the recovery phrase with the team',
      'Send a test from Gmail and reply from Proton',
      'Use it for the App Review contact and TestFlight feedback'
    ] },
    { group: 'Web pages (this site)', items: [
      'Privacy Policy live at /privacy-policy/',
      'Terms of Use live at /terms/',
      'Support page live at /support/',
      'Pages deployed to Netlify and load over HTTPS'
    ] },
    { group: 'TestFlight', items: [
      'Internal testing group created and build added',
      'Test Information: beta description, feedback email, What to Test',
      'Beta App Review contact: name, phone, email',
      'External group created and build submitted for Beta App Review',
      'Public link or tester emails sent'
    ] },
    { group: 'App Store listing', items: [
      'Name, subtitle, promotional text, description, keywords',
      'Support, marketing, and privacy URLs',
      'iPhone 6.9" screenshots (3 to 10)',
      'App Privacy: Data Not Collected, published',
      'Age rating questionnaire',
      'Category, copyright, content rights',
      'Pricing: Free, all territories chosen',
      'Review notes and contact info',
      'Add for Review → Submit'
    ] }
  ]
};
