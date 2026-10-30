// App Store Connect / TestFlight release kit. Edit copy here and commit;
// release/index.html renders it with limits, counters, and copy buttons.
window.RELEASE = {
  app: {
    name: 'satsigner',
    // Self-hosted Stalwart server at mail.satsigner.com. Nostr contact is satsigner@satsigner.com (NIP-05).
    email: 'support@satsigner.com',
    bundleId: 'com.satsigner.satsigner',
    version: '1.0',
    sku: 'satsigner-ios',
    site: 'https://satsigner.com'
  },

  // Where each item is published. `all` items apply to every store.
  stores: [
    { id: 'apple', label: 'App Store', console: 'App Store Connect', url: 'https://appstoreconnect.apple.com' },
    { id: 'testflight', label: 'TestFlight', console: 'App Store Connect → TestFlight', url: 'https://appstoreconnect.apple.com' },
    { id: 'play', label: 'Google Play', console: 'Play Console', url: 'https://play.google.com/console' }
  ],

  // Problems found in the app repo that can get a build rejected.
  // Fix these in ~/Desktop/git/satsigner/apps/mobile before uploading.
  blockers: [
    {
      store: 'apple',
      title: 'Crypto wallets must ship from an Organization account',
      body: 'App Review Guideline 3.1.5(i) only allows wallet apps from developers enrolled as an organization. Check the team type under Membership in developer.apple.com. Internal TestFlight testing works without it, but external TestFlight and App Store review will reject an individual account.',
      where: 'developer.apple.com → Membership'
    },
    {
      store: 'apple',
      title: 'Vague permission purpose strings',
      body: 'Review rejects generic strings like "Allow $(PRODUCT_NAME) to access your camera" (Guideline 5.1.1). Use the strings in the "Info.plist purpose strings" section below.',
      where: 'apps/mobile/app.config.ts: expo-camera plugin, ios.infoPlist'
    },
    {
      store: 'apple',
      title: 'Microphone permission requested but never used',
      body: 'expo-camera adds NSMicrophoneUsageDescription by default. Pass microphonePermission: false (and recordAudioAndroid: false) to the expo-camera plugin, or Review may ask why the app needs the microphone.',
      where: 'apps/mobile/app.config.ts: expo-camera plugin'
    },
    {
      store: 'apple',
      title: 'Dev-client local network string in release builds',
      body: 'Info.plist contains "Expo Dev Launcher uses the local network…" from expo-dev-client. Make sure the production build either drops expo-dev-client or has a real NSLocalNetworkUsageDescription (for example, connecting to a node on your LAN).',
      where: 'apps/mobile/app.config.ts: plugins'
    },
    {
      store: 'apple',
      title: 'iPad support is on (supportsTablet: true)',
      body: 'With iPad support on, App Store Connect requires 13" iPad screenshots, and Review tests on iPad. Either set supportsTablet: false for 1.0, or design and capture iPad screens.',
      where: 'apps/mobile/app.config.ts: ios.supportsTablet'
    },
    {
      store: 'apple',
      title: 'Export compliance key missing',
      body: 'Add ITSAppUsesNonExemptEncryption to Info.plist so each TestFlight build skips the encryption prompt. See "Export compliance" below for the answer.',
      where: 'apps/mobile/app.config.ts: ios.infoPlist'
    },
    {
      store: 'play',
      title: 'New personal accounts need a 14-day closed test',
      body: 'Personal Play developer accounts created after November 2023 must run a closed test with at least 12 opted-in testers for 14 days in a row before they can apply for production. Organization accounts skip this. Start the closed test early.',
      where: 'Play Console → Testing → Closed testing'
    },
    {
      store: 'play',
      title: 'Play needs an Android App Bundle, not an APK',
      body: 'eas.json builds an APK for production, which suits Zapstore and GitHub but Play rejects for new apps. Add a Play build profile with android.buildType "app-bundle" and enroll in Play App Signing.',
      where: 'apps/mobile/eas.json'
    },
    {
      store: 'play',
      title: 'Unused sensitive Android permissions',
      body: 'AndroidManifest.xml requests RECORD_AUDIO and SYSTEM_ALERT_WINDOW. The app records no audio and draws no overlays, and Play review asks about both. Set recordAudioAndroid: false on the expo-camera plugin, and keep SYSTEM_ALERT_WINDOW out of release builds (it comes from the dev client).',
      where: 'apps/mobile/app.config.ts, android/app/src/main/AndroidManifest.xml'
    },
    {
      store: 'play',
      title: 'Same package name as the Zapstore APK',
      body: 'Play and Zapstore both ship com.satsigner.satsigner, signed with different keys. Android refuses to update one install with the other, so users must uninstall (and restore from seed) to switch. Say so in the release notes, or ship Play under its own package name.',
      where: 'apps/mobile/constants/variant.cjs'
    }
  ],

  // App Store Connect → App Information / Version fields.
  fields: [
    { store: 'apple', group: 'App Information', key: 'bundleId', label: 'Bundle ID', value: 'com.satsigner.satsigner', note: 'Explicit, not wildcard. Register it under Certificates, Identifiers & Profiles, then use the same ID when you create the app record. It cannot change later, and it must match the production build.' },
    { store: 'apple', group: 'App Information', key: 'appIdDescription', label: 'App ID description', value: 'satsigner self-custody bitcoin wallet', note: 'Certificates, Identifiers & Profiles → Identifiers → App IDs. No @, &, *, or quotation marks. This label is only for your developer account, not the store listing.' },
    { store: 'apple', group: 'App Information', key: 'teamId', label: 'App ID prefix (Team ID)', value: 'Y7D596R6RG' },
    { store: 'apple', group: 'App Information', key: 'capabilities', label: 'Capabilities to enable', multiline: true, value: 'Near Field Communication Tag Reading', note: 'Leave every other capability off. The app reads NFC tags and hardware signers (NDEF and TAG). Camera and Face ID are Info.plist purpose strings, not App ID capabilities.' },
    { store: 'apple', group: 'App Information', key: 'sku', label: 'SKU', value: 'satsigner-ios', note: 'Unique to your account. Apple does not show it on the store.' },
    { store: 'apple', group: 'App Information', key: 'language', label: 'Primary language', value: 'English (U.S.)' },
    { store: 'apple', group: 'App Information', key: 'price', label: 'Price', value: 'Free', note: 'Pricing and Availability → Price Schedule. Free in every territory you select.' },
    { store: 'apple', group: 'App Information', key: 'name', label: 'Name', limit: 30, value: 'satsigner' },
    { store: 'apple', group: 'App Information', key: 'subtitle', label: 'Subtitle', limit: 30, value: 'Self-custody bitcoin signer' },
    { store: 'apple', group: 'App Information', key: 'category', label: 'Primary / secondary category', value: 'Finance / Utilities' },
    { store: 'apple', group: 'App Information', key: 'contentRights', label: 'Content rights', value: 'Does not contain, show, or access third-party content' },
    { store: 'apple', group: 'App Information', key: 'privacyUrl', label: 'Privacy Policy URL', value: 'https://satsigner.com/privacy-policy/', url: true },
    { store: 'apple', group: 'App Information', key: 'termsUrl', label: 'License Agreement (custom EULA)', value: 'https://satsigner.com/terms/', url: true, note: 'Optional. Paste the Terms page text into App Information → License Agreement, or keep Apple’s standard EULA.' },

    { store: 'apple', group: 'Version 1.0', key: 'promo', label: 'Promotional Text', limit: 170, multiline: true, value: 'See every sat you own. Pick exactly which coins you spend, sign with multisig and air-gapped QR, and connect your own node. No accounts, no tracking.' },
    { store: 'apple', group: 'Version 1.0', key: 'description', label: 'Description', limit: 4000, multiline: true, value: [
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
    { store: 'apple', group: 'Version 1.0', key: 'keywords', label: 'Keywords', limit: 100, value: 'bitcoin,wallet,utxo,multisig,psbt,cold storage,payjoin,nostr,lightning,ecash,cashu,sats,taproot' },
    { store: 'apple', group: 'Version 1.0', key: 'supportUrl', label: 'Support URL', value: 'https://satsigner.com/support/', url: true },
    { store: 'apple', group: 'Version 1.0', key: 'marketingUrl', label: 'Marketing URL', value: 'https://satsigner.com/', url: true },
    { store: 'apple', group: 'Version 1.0', key: 'copyright', label: 'Copyright', value: '2026 satsigner' },
    { store: 'apple', group: 'Version 1.0', key: 'whatsNew', label: 'What’s New', limit: 4000, multiline: true, value: 'First release on the App Store.', note: 'Hidden for a first release, but required on every update.' },

    { store: 'testflight', group: 'TestFlight', key: 'betaDescription', label: 'Beta App Description', limit: 4000, multiline: true, value: 'satsigner is a self-custody bitcoin wallet focused on UTXO control, multisig, and privacy. This beta covers creating and importing wallets, coin selection, sending and receiving, PSBT signing over QR and NFC, and BIP329 labels.' },
    { store: 'testflight', group: 'TestFlight', key: 'whatToTest', label: 'What to Test', limit: 4000, multiline: true, value: [
      'Please use signet or testnet, or small mainnet amounts only.',
      '',
      '1. Create a new wallet and back up the seed phrase.',
      '2. Receive coins, then pull to sync.',
      '3. Send using the bubble chart to pick inputs, and check the preview.',
      '4. Create a 2-of-3 multisig and sign a PSBT with the animated QR.',
      '5. Export and re-import your labels.',
      '',
      'Send feedback with a screenshot from inside the app, or email support@satsigner.com.'
    ].join('\n') },
    { store: 'testflight', group: 'TestFlight', key: 'feedbackEmail', label: 'Feedback email', value: 'support@satsigner.com' },

    { store: 'apple', group: 'App Review', key: 'signIn', label: 'Sign-in required', value: 'No. The app has no accounts.' },
    { store: 'apple', group: 'App Review', key: 'reviewNotes', label: 'Notes for the reviewer', limit: 4000, multiline: true, value: [
      'satsigner is a non-custodial, open-source bitcoin wallet (MIT License, github.com/satsigner/satsigner). It does not need an account or login.',
      '',
      'To test without real funds: on first launch tap Create, choose Signet in Settings → Network, and create a single-sig account. Signet coins have no monetary value.',
      '',
      'The developer never holds user funds or keys. The app does not sell, exchange, or transmit currency on anyone’s behalf, and it has no in-app purchases. Users sign transactions on their own device and broadcast them to the public bitcoin network.',
      '',
      'Permissions: the camera scans QR codes (addresses, PSBTs, backups), NFC talks to hardware signers and tags, and Face ID optionally unlocks the app.'
    ].join('\n') },

    { store: 'play', group: 'Store listing', key: 'packageName', label: 'Package name', value: 'com.satsigner.satsigner', note: 'Set when you create the app. Play and Zapstore both use this name with different signing keys, so an install from one cannot update an install from the other.' },
    { store: 'play', group: 'Store listing', key: 'playLanguage', label: 'Default language', value: 'English (United States) — en-US' },
    { store: 'play', group: 'Store listing', key: 'playType', label: 'App or game', value: 'App' },
    { store: 'play', group: 'Store listing', key: 'playPrice', label: 'Price', value: 'Free' },
    { store: 'play', group: 'Store listing', key: 'playName', label: 'App name', limit: 30, value: 'satsigner' },
    { store: 'play', group: 'Store listing', key: 'playShort', label: 'Short description', limit: 80, value: 'Self-custody bitcoin signer. Full UTXO control, multisig, and privacy.' },
    { store: 'play', group: 'Store listing', key: 'playFull', label: 'Full description', limit: 4000, multiline: true, value: [
      'satsigner is a self-custody bitcoin wallet and signer built around your coins. Every UTXO is visible, labeled, and under your control.',
      '',
      'See every sat',
      '• Bubble charts show each coin in your wallet at a glance',
      '• Pick the exact inputs for every transaction, or exclude coins you never want to spend',
      '• Sankey diagrams show where your sats go before you sign',
      '• Balance history, fee rate, and network charts',
      '',
      'Sign your way',
      '• Single-sig, M-of-N multisig, and watch-only accounts',
      '• Every script type: Legacy, Nested SegWit, Native SegWit, Taproot',
      '• Air-gapped signing with animated QR codes and NFC',
      '• Import and export PSBTs, descriptors, and extended public keys',
      '• Replace-by-fee, timelocks, and manual fee control',
      '',
      'Private by default',
      '• No accounts, no analytics, no tracking',
      '• Connect your own Electrum or Esplora server',
      '• Payjoin (BIP77 and BIP78) to break chain analysis',
      '• PIN encryption, duress PIN, and seed dropping',
      '',
      'Your labels, everywhere',
      '• BIP329 labels for addresses, transactions, and coins',
      '• Import and export JSON, JSONL, and CSV',
      '• Optional encrypted label sync over Nostr',
      '',
      'Beyond on-chain',
      '• Lightning payments through your own LND node',
      '• Cashu eCash and Ark (experimental)',
      '• Block, transaction, and mempool explorer',
      '',
      'Open source',
      'satsigner is free and open source under the MIT License. Read the code at github.com/satsigner/satsigner.',
      '',
      'satsigner never holds your keys. You are responsible for backing up your seed phrase. Lose it, and nobody can recover your funds.'
    ].join('\n'), note: 'Same copy as the App Store, with headings in sentence case. Play’s metadata policy discourages all-caps text.' },
    { store: 'play', group: 'Store listing', key: 'playCategory', label: 'App category', value: 'Finance' },
    { store: 'play', group: 'Store listing', key: 'playEmail', label: 'Contact email', value: 'support@satsigner.com' },
    { store: 'play', group: 'Store listing', key: 'playWebsite', label: 'Website', value: 'https://satsigner.com/', url: true },
    { store: 'play', group: 'Store listing', key: 'playPrivacy', label: 'Privacy policy URL', value: 'https://satsigner.com/privacy-policy/', url: true },
    { store: 'play', group: 'Release', key: 'playNotes', label: 'Release notes', limit: 500, multiline: true, value: '<en-US>\nFirst release on Google Play.\n</en-US>', note: 'Play wraps notes in language tags. Keep them when pasting.' },
    { store: 'play', group: 'Release', key: 'playTesters', label: 'Closed test: how to join (for testers)', limit: 4000, multiline: true, value: [
      'Thanks for testing satsigner.',
      '',
      'Please use signet or testnet, or small mainnet amounts only. Stay opted in for at least 14 days; Play counts every day.',
      '',
      'Try: create a wallet, receive, send with coin selection, sign a multisig PSBT, and export your labels.',
      '',
      'Send feedback to support@satsigner.com.'
    ].join('\n') },
    { store: 'play', group: 'App access', key: 'playAccess', label: 'App access', value: 'All functionality is available without special access' }
  ],

  // Suggested Info.plist purpose strings (Guideline 5.1.1).
  purposeStrings: [
    { key: 'NSCameraUsageDescription', value: 'satsigner uses the camera to scan QR codes for addresses, invoices, signed transactions (PSBTs), and wallet backups.' },
    { key: 'NFCReaderUsageDescription', value: 'satsigner uses NFC to exchange transactions and keys with hardware signers and NFC tags.' },
    { key: 'NSFaceIDUsageDescription', value: 'satsigner can use Face ID to unlock the app instead of your PIN.' },
    { key: 'NSLocalNetworkUsageDescription', value: 'satsigner connects to bitcoin and Lightning nodes you run on your local network.' },
    { key: 'ITSAppUsesNonExemptEncryption', value: 'false', note: 'Confirm the answer under "Export compliance" before committing this.' }
  ],

  // Questionnaire answers for each console.
  answers: [
    {
      store: 'apple',
      title: 'App Privacy',
      answer: 'Data Not Collected',
      notes: [
        'Apple counts data as "collected" when it leaves the device and the developer or its partners can access it longer than needed to serve the request. satsigner has no backend, analytics, or crash reporting. Users choose the servers the app talks to (their own node or public servers), and those requests only serve the user. Most open-source wallets answer the same way.',
        'If you add crash reporting, analytics, push notifications, or a satsigner-run server, update this answer before the next build.'
      ]
    },
    {
      store: 'apple',
      title: 'Export compliance',
      answer: 'Uses encryption: Yes. Qualifies for an exemption: Yes. ITSAppUsesNonExemptEncryption = false.',
      notes: [
        'The app uses standard cryptography only: HTTPS/TLS, AES for local data at rest, and secp256k1 signatures to authenticate bitcoin transactions. Apple’s export compliance guide treats encryption used only for HTTPS, authentication, and digital signatures as exempt. A wallet is a financial app, and cryptography is not its primary function.',
        'This is guidance, not legal advice. If the app adds proprietary encryption or end-to-end messaging beyond authentication, revisit the answer. Nostr NIP-44 encrypted DMs are a gray area worth confirming.'
      ]
    },
    {
      store: 'apple',
      title: 'Age rating',
      answer: '4+ (all questionnaire answers "None" / "No")',
      notes: [
        'No unrestricted web access, no user-generated content feed, no gambling, no contests. If the Nostr features grow into a public social feed, Guideline 1.2 requires reporting and blocking tools, and the rating goes up.'
      ]
    },
    {
      store: 'testflight',
      title: 'Beta App Review contact',
      answer: 'Name, phone, and support@satsigner.com',
      notes: ['Required before the first external build. Apple calls this number if review has questions.']
    },
    {
      store: 'play',
      title: 'Data safety',
      answer: 'No data collected. No data shared.',
      notes: [
        'Play counts data as collected when it leaves the device to the developer or a third party. satsigner sends nothing to its developers. Requests to blockchain servers the user picks are made for the user and not kept by us, which Play treats as not collected.',
        'Encrypted in transit: Yes. Account deletion: not applicable, since the app has no accounts.'
      ]
    },
    {
      store: 'play',
      title: 'Financial features',
      answer: 'Cryptocurrency: non-custodial (software) wallet',
      notes: [
        'Play’s licensing rules for crypto exchanges and custodial wallets do not apply to non-custodial wallets. Say that the developer never holds keys or funds.'
      ]
    },
    {
      store: 'play',
      title: 'Content rating (IARC)',
      answer: 'Category: All other app types. Every content question: No.',
      notes: [
        'Users interacting: No for label sync between your own devices. Answer Yes if the Nostr features let people message each other, which adds a "Users interact" notice but does not raise the rating.'
      ]
    },
    {
      store: 'play',
      title: 'Target audience',
      answer: '18 and over',
      notes: ['A self-custody wallet is not meant for children. This also keeps the app out of the Families policy.']
    },
    {
      store: 'play',
      title: 'Ads and advertising ID',
      answer: 'No ads. Does not use the advertising ID.',
      notes: ['Check the merged manifest has no com.google.android.gms.permission.AD_ID. If a library adds it, remove it with tools:node="remove".']
    },
    {
      store: 'play',
      title: 'Other declarations',
      answer: 'News app: No. Health app: No. Government app: No.',
      notes: []
    }
  ],

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
    { store: 'apple', group: 'Account', items: [
      'Apple Developer Program is active and enrolled as an Organization (3.1.5)',
      'Agreements, Tax, and Banking: Free Apps agreement accepted',
      'App record created with bundle ID com.satsigner.satsigner'
    ] },
    { store: 'apple', group: 'Build', items: [
      'Production build: APP_VARIANT=production, no expo-dev-client',
      'Purpose strings updated and microphone permission removed',
      'ITSAppUsesNonExemptEncryption set in Info.plist',
      'Decide iPad: supportsTablet false, or iPad screenshots ready',
      'Version 1.0 and a build number higher than the last upload',
      'Build uploaded (eas submit or Transporter) and processed',
      '1024 × 1024 app icon with no transparency in the build'
    ] },
    { store: 'all', group: 'Email (mail.satsigner.com)', items: [
      'support@satsigner.com account created, postmaster@ alias enabled',
      'DNS: MX, SPF, DKIM (ed25519 + RSA), DMARC, MTA-STS, TLS-RPT, SRV',
      'Gmail test: message arrives, reply shows SPF, DKIM and DMARC PASS',
      'Mail app connected (IMAP 993, SMTP 465)',
      'Nightly backup of /var/lib/stalwart and /etc/stalwart, copied off the server',
      'After two clean weeks: DMARC p=reject and MTA-STS mode enforce',
      'Use support@satsigner.com for the App Review contact and TestFlight feedback'
    ] },
    { store: 'all', group: 'Web pages (this site)', items: [
      'Privacy Policy live at /privacy-policy/',
      'Terms of Use live at /terms/',
      'Support page live at /support/',
      'Pages deployed to Netlify and load over HTTPS'
    ] },
    { store: 'testflight', group: 'TestFlight', items: [
      'Internal testing group created and build added',
      'Test Information: beta description, feedback email, What to Test',
      'Beta App Review contact: name, phone, email',
      'External group created and build submitted for Beta App Review',
      'Public link or tester emails sent'
    ] },
    { store: 'apple', group: 'App Store listing', items: [
      'Name, subtitle, promotional text, description, keywords',
      'Support, marketing, and privacy URLs',
      'iPhone 6.9" screenshots (3 to 10)',
      'App Privacy: Data Not Collected, published',
      'Age rating questionnaire',
      'Category, copyright, content rights',
      'Pricing: Free, all territories chosen',
      'Review notes and contact info',
      'Add for Review → Submit'
    ] },
    { store: 'play', group: 'Google Play account', items: [
      'Play Console developer account verified (organization, or personal with ID)',
      'App created: name satsigner, app, free, default language English (US)',
      'Package name com.satsigner.satsigner decided (see Zapstore note)'
    ] },
    { store: 'play', group: 'Google Play build', items: [
      'Play build profile produces an .aab',
      'Play App Signing enrolled, upload key stored safely',
      'Targets the API level Play Console currently requires',
      'RECORD_AUDIO and SYSTEM_ALERT_WINDOW removed from the release manifest',
      'No AD_ID permission in the merged manifest'
    ] },
    { store: 'play', group: 'Google Play app content', items: [
      'Privacy policy URL',
      'App access: no special access',
      'Ads: No',
      'Content rating questionnaire',
      'Target audience: 18+',
      'Data safety form',
      'Financial features: non-custodial crypto wallet',
      'News, health, and government app declarations'
    ] },
    { store: 'play', group: 'Google Play listing and testing', items: [
      'Short and full description, category, contact email, website',
      '512 × 512 app icon',
      '1024 × 500 feature graphic',
      '2 to 8 phone screenshots',
      'Internal test track with the team',
      'Closed test: 12+ testers opted in for 14 days (personal accounts)',
      'Apply for production access, then roll out'
    ] }
  ]
};
