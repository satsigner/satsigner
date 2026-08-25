const sampleJsonl = `{"label":"Contractor Job 1431 #Work #Payment","type":"tx","ref":"659a13373d6fad4adcfc74aa6fd331fe16d783ebb77f89e57edda61a58a85022","spendable":true}
{"label":"Parking #Expenses #Work","type":"tx","ref":"836fea37c4f18413a6c899665e41a3f07ca7b27ba2005812acb794c2ff0f3c3d","spendable":true}
{"label":"Short Flight to SatLandia #Transportation #Flight","type":"tx","ref":"7b01cbe040782b04821eede9f9038a72263464def5d0a801b4c65eda72619ce7","spendable":true}
{"label":"2024 Tax Refund #Taxes","type":"tx","ref":"ae3d3ec185eb197fcc8bf4f533a45099875ffbe4d2b9abaceb059c3439d2dff7","spendable":true}
{"label":"Electronics Store SA #Work #Supplies","type":"tx","ref":"0c0678750d011ae27382de9f278547bcb1e04d3effc59ac2dbf2daf0ddd909ff","spendable":true}
{"label":"Town square hotdog stand #food","type":"tx","ref":"23926eadace17518ea2c297fb4b0782e028153a1d0ef99bec12cbc144c2453ff","spendable":true}
`

const sampleJsonlExpected = [
  {
    label: 'Contractor Job 1431 #Work #Payment',
    ref: '659a13373d6fad4adcfc74aa6fd331fe16d783ebb77f89e57edda61a58a85022',
    spendable: true,
    type: 'tx'
  },
  {
    label: 'Parking #Expenses #Work',
    ref: '836fea37c4f18413a6c899665e41a3f07ca7b27ba2005812acb794c2ff0f3c3d',
    spendable: true,
    type: 'tx'
  },
  {
    label: 'Short Flight to SatLandia #Transportation #Flight',
    ref: '7b01cbe040782b04821eede9f9038a72263464def5d0a801b4c65eda72619ce7',
    spendable: true,
    type: 'tx'
  },
  {
    label: '2024 Tax Refund #Taxes',
    ref: 'ae3d3ec185eb197fcc8bf4f533a45099875ffbe4d2b9abaceb059c3439d2dff7',
    spendable: true,
    type: 'tx'
  },
  {
    label: 'Electronics Store SA #Work #Supplies',
    ref: '0c0678750d011ae27382de9f278547bcb1e04d3effc59ac2dbf2daf0ddd909ff',
    spendable: true,
    type: 'tx'
  },
  {
    label: 'Town square hotdog stand #food',
    ref: '23926eadace17518ea2c297fb4b0782e028153a1d0ef99bec12cbc144c2453ff',
    spendable: true,
    type: 'tx'
  }
]

const sampleCsvSparrowTx = [
  `Date (UTC),Label,Value,Balance,Fee,Value (USD),Txid
2024-12-31 12:33:02,Hunicus send,200000,200000,,186.60,d948cbe2d084d1abcf7d34fa4b31a6f264b3f055388be43002f23c4e370a6791
2024-12-31 14:46:58,back from carlo A,7030,207030,,6.56,23926eadace17518ea2c297fb4b0782e028153a1d0ef99bec12cbc144c2453ff
2024-12-31 14:46:58,"Testing to PSYCARLO 2, Testing to PSYCARLO 1",-15612,191418,231,-14.57,7718a523c3ff3ef344e5860e9cb0b7e463631f21a55d583c0ffac211bcffec90
2024-12-31 14:59:59,"Large to Carlo D, Large to Carlo A, Large to Carlo B, Large to Carlo C",-72337,119081,238,-67.49,659a13373d6fad4adcfc74aa6fd331fe16d783ebb77f89e57edda61a58a85022
2024-12-31 17:06:32,Hunicus send,149872,268953,,139.83,bb1749d04d08010aed39a72af83313657e2c09175175777075800d313f2bfc3d
2025-01-02 15:12:54,Hunicus send,6764,275717,,6.55,74d45e932fa71a5e5a6d9138dd5da245393d69daa12b897c140adace4f05aadf
2025-01-04 01:13:09,,-3141,272576,141,-3.09,0d239e8f60568bb7d8b1c6973ecd5dad9234f49bd589995d3c322eca9a8f23aa
2025-01-04 01:13:09,,-9000,263576,141,-8.85,681477bfd5ee6cb07bc64fb0451f268bd59f4c207067e78059100d5447935e92
2025-01-09 14:50:30,to carlos,-52516,211060,2516,-48.55,269b53e16d96425eb7d2183841e29552eab6a553cac098c76d0c75062ef48856
2025-01-09 14:56:08,Hunicus send,5000,216060,,4.62,4686cb1251dcf23e42faceb994d2176d4030e07731500d45d2a150f95044d8cd
2025-01-09 14:56:08,"calros 1, carlos 2, carlos reuse",-49718,166342,1476,-45.96,ae3d3ec185eb197fcc8bf4f533a45099875ffbe4d2b9abaceb059c3439d2dff7
2025-01-21 01:38:06,,-40516,125826,5052,-42.95,a55f8be6f928f2fc023241e9b265ce1e6df70e19980d8bd6f8571c5a34169654
2025-01-29 10:32:13,,-25186,100640,2966,-26.07,d8bf446e1db334c436ca65e2cd545f298b42229207c43285cbe5a4eb67aa7f6f
2025-01-31 16:06:38,more hunicus,83501,184141,,85.36,7b01cbe040782b04821eede9f9038a72263464def5d0a801b4c65eda72619ce7
2025-01-31 18:53:38,,15501,199642,,15.85,51ea0a6ffff52665d5211fe3e2de99e2d19abccb1f1a7fa1e6bc22caae47abce
2025-02-04 16:34:59,,9101,208743,,8.89,a7289ed0cffab33d48436313e8ab226ed056640672c5b59fd70ec4de044a65bf
2025-02-04 22:31:00,,-15501,193242,519,-15.14,8179a57b9a600d4b7c7dba30ec8d38810a360f13ad9c68a0c466ad7900173529
2025-02-05 01:15:24,,-56214,137028,413,-54.21,a7f48862afb292ccfea2f0e6781949f7754683b466285c201559599714197c45
2025-02-13 01:10:22,,9791,146819,,9.44,ccb69fdf971f40a04fd5f7c91666549cb62177967d8e3105296e38b1925b63de
2025-02-13 01:10:22,,-10153,136666,153,-9.78,7fcf752578020878413c3d3dcf248746e2ad6d5e13eeaf143cf2cc66128b240a
2025-03-02 02:19:12,Multi,-454,136212,454,-0.43,ad64250ef6f24a7a8832e55cd2926758ee16da9d6e159049e7b432664a303629
2025-03-02 02:19:12,multi sig,-34193,102019,454,-32.14,dd31e2071659d1bc385426843ea60b4c4c0d5ab61030582b146fcb745ca28161
2025-03-02 22:48:42,to multi,-12711,89308,380,-11.95,b48a73173fed37c1c268b4a079caf777424917c8223c5556c0cc0435213030c5

# Historical USD values are taken from daily rates and should only be considered as approximate.`,
  `Date (UTC),Label,Value,Balance,Fee,Value (USD),Txid
2024-12-31 12:33:02,Hunicus send,200000,200000,,186.60,d948cbe2d084d1abcf7d34fa4b31a6f264b3f055388be43002f23c4e370a6791
2024-12-31 14:46:58,back from carlo A,7030,207030,,6.56,23926eadace17518ea2c297fb4b0782e028153a1d0ef99bec12cbc144c2453ff
2024-12-31 14:46:58,"Testing to PSYCARLO 2, Testing to PSYCARLO 1",-15612,191418,231,-14.57,7718a523c3ff3ef344e5860e9cb0b7e463631f21a55d583c0ffac211bcffec90
2024-12-31 14:59:59,"Large to Carlo D, Large to Carlo A, Large to Carlo B, Large to Carlo C",-72337,119081,238,-67.49,659a13373d6fad4adcfc74aa6fd331fe16d783ebb77f89e57edda61a58a85022
2024-12-31 17:06:32,Hunicus send,149872,268953,,139.83,bb1749d04d08010aed39a72af83313657e2c09175175777075800d313f2bfc3d
2025-01-02 15:12:54,Hunicus send,6764,275717,,6.55,74d45e932fa71a5e5a6d9138dd5da245393d69daa12b897c140adace4f05aadf
2025-01-04 01:13:09,,-3141,272576,141,-3.09,0d239e8f60568bb7d8b1c6973ecd5dad9234f49bd589995d3c322eca9a8f23aa
2025-01-04 01:13:09,,-9000,263576,141,-8.85,681477bfd5ee6cb07bc64fb0451f268bd59f4c207067e78059100d5447935e92
2025-01-09 14:50:30,to carlos,-52516,211060,2516,-48.55,269b53e16d96425eb7d2183841e29552eab6a553cac098c76d0c75062ef48856
2025-01-09 14:56:08,Hunicus send,5000,216060,,4.62,4686cb1251dcf23e42faceb994d2176d4030e07731500d45d2a150f95044d8cd
2025-01-09 14:56:08,"calros 1, carlos 2, carlos reuse",-49718,166342,1476,-45.96,ae3d3ec185eb197fcc8bf4f533a45099875ffbe4d2b9abaceb059c3439d2dff7
2025-01-21 01:38:06,,-40516,125826,5052,-42.95,a55f8be6f928f2fc023241e9b265ce1e6df70e19980d8bd6f8571c5a34169654
2025-01-29 10:32:13,,-25186,100640,2966,-26.07,d8bf446e1db334c436ca65e2cd545f298b42229207c43285cbe5a4eb67aa7f6f
2025-01-31 16:06:38,more hunicus,83501,184141,,85.36,7b01cbe040782b04821eede9f9038a72263464def5d0a801b4c65eda72619ce7
2025-01-31 18:53:38,,15501,199642,,15.85,51ea0a6ffff52665d5211fe3e2de99e2d19abccb1f1a7fa1e6bc22caae47abce
2025-02-04 16:34:59,,9101,208743,,8.89,a7289ed0cffab33d48436313e8ab226ed056640672c5b59fd70ec4de044a65bf
2025-02-04 22:31:00,,-15501,193242,519,-15.14,8179a57b9a600d4b7c7dba30ec8d38810a360f13ad9c68a0c466ad7900173529
2025-02-05 01:15:24,,-56214,137028,413,-54.21,a7f48862afb292ccfea2f0e6781949f7754683b466285c201559599714197c45
2025-02-13 01:10:22,,9791,146819,,9.44,ccb69fdf971f40a04fd5f7c91666549cb62177967d8e3105296e38b1925b63de
2025-02-13 01:10:22,,-10153,136666,153,-9.78,7fcf752578020878413c3d3dcf248746e2ad6d5e13eeaf143cf2cc66128b240a
2025-03-02 02:19:12,Multi,-454,136212,454,-0.43,ad64250ef6f24a7a8832e55cd2926758ee16da9d6e159049e7b432664a303629
2025-03-02 02:19:12,multi sig,-34193,102019,454,-32.14,dd31e2071659d1bc385426843ea60b4c4c0d5ab61030582b146fcb745ca28161
2025-03-02 22:48:42,to multi,-12711,89308,380,-11.95,b48a73173fed37c1c268b4a079caf777424917c8223c5556c0cc0435213030c5

# Historical USD values are taken from daily rates and should only be considered as approximate.
`
]

const sampleCsvSparrowTxExpected = [
  [
    {
      fee: '',
      label: 'Hunicus send',
      rate: '186.60',
      ref: 'd948cbe2d084d1abcf7d34fa4b31a6f264b3f055388be43002f23c4e370a6791',
      time: '2024-12-31 12:33:02',
      type: 'tx',
      value: '200000'
    },
    {
      fee: '',
      label: 'back from carlo A',
      rate: '6.56',
      ref: '23926eadace17518ea2c297fb4b0782e028153a1d0ef99bec12cbc144c2453ff',
      time: '2024-12-31 14:46:58',
      type: 'tx',
      value: '7030'
    },
    {
      fee: '191418',
      label: 'Testing to PSYCARLO 2',
      rate: '231',
      ref: '-14.57',
      time: '2024-12-31 14:46:58',
      type: 'tx',
      value: ' Testing to PSYCARLO 1'
    },
    {
      fee: ' Large to Carlo C',
      label: 'Large to Carlo D',
      rate: '-72337',
      ref: '119081',
      time: '2024-12-31 14:59:59',
      type: 'tx',
      value: ' Large to Carlo A'
    },
    {
      fee: '',
      label: 'Hunicus send',
      rate: '139.83',
      ref: 'bb1749d04d08010aed39a72af83313657e2c09175175777075800d313f2bfc3d',
      time: '2024-12-31 17:06:32',
      type: 'tx',
      value: '149872'
    },
    {
      fee: '',
      label: 'Hunicus send',
      rate: '6.55',
      ref: '74d45e932fa71a5e5a6d9138dd5da245393d69daa12b897c140adace4f05aadf',
      time: '2025-01-02 15:12:54',
      type: 'tx',
      value: '6764'
    },
    {
      fee: '141',
      label: '',
      rate: '-3.09',
      ref: '0d239e8f60568bb7d8b1c6973ecd5dad9234f49bd589995d3c322eca9a8f23aa',
      time: '2025-01-04 01:13:09',
      type: 'tx',
      value: '-3141'
    },
    {
      fee: '141',
      label: '',
      rate: '-8.85',
      ref: '681477bfd5ee6cb07bc64fb0451f268bd59f4c207067e78059100d5447935e92',
      time: '2025-01-04 01:13:09',
      type: 'tx',
      value: '-9000'
    },
    {
      fee: '2516',
      label: 'to carlos',
      rate: '-48.55',
      ref: '269b53e16d96425eb7d2183841e29552eab6a553cac098c76d0c75062ef48856',
      time: '2025-01-09 14:50:30',
      type: 'tx',
      value: '-52516'
    },
    {
      fee: '',
      label: 'Hunicus send',
      rate: '4.62',
      ref: '4686cb1251dcf23e42faceb994d2176d4030e07731500d45d2a150f95044d8cd',
      time: '2025-01-09 14:56:08',
      type: 'tx',
      value: '5000'
    },
    {
      fee: '-49718',
      label: 'calros 1',
      rate: '166342',
      ref: '1476',
      time: '2025-01-09 14:56:08',
      type: 'tx',
      value: ' carlos 2'
    },
    {
      fee: '5052',
      label: '',
      rate: '-42.95',
      ref: 'a55f8be6f928f2fc023241e9b265ce1e6df70e19980d8bd6f8571c5a34169654',
      time: '2025-01-21 01:38:06',
      type: 'tx',
      value: '-40516'
    },
    {
      fee: '2966',
      label: '',
      rate: '-26.07',
      ref: 'd8bf446e1db334c436ca65e2cd545f298b42229207c43285cbe5a4eb67aa7f6f',
      time: '2025-01-29 10:32:13',
      type: 'tx',
      value: '-25186'
    },
    {
      fee: '',
      label: 'more hunicus',
      rate: '85.36',
      ref: '7b01cbe040782b04821eede9f9038a72263464def5d0a801b4c65eda72619ce7',
      time: '2025-01-31 16:06:38',
      type: 'tx',
      value: '83501'
    },
    {
      fee: '',
      label: '',
      rate: '15.85',
      ref: '51ea0a6ffff52665d5211fe3e2de99e2d19abccb1f1a7fa1e6bc22caae47abce',
      time: '2025-01-31 18:53:38',
      type: 'tx',
      value: '15501'
    },
    {
      fee: '',
      label: '',
      rate: '8.89',
      ref: 'a7289ed0cffab33d48436313e8ab226ed056640672c5b59fd70ec4de044a65bf',
      time: '2025-02-04 16:34:59',
      type: 'tx',
      value: '9101'
    },
    {
      fee: '519',
      label: '',
      rate: '-15.14',
      ref: '8179a57b9a600d4b7c7dba30ec8d38810a360f13ad9c68a0c466ad7900173529',
      time: '2025-02-04 22:31:00',
      type: 'tx',
      value: '-15501'
    },
    {
      fee: '413',
      label: '',
      rate: '-54.21',
      ref: 'a7f48862afb292ccfea2f0e6781949f7754683b466285c201559599714197c45',
      time: '2025-02-05 01:15:24',
      type: 'tx',
      value: '-56214'
    },
    {
      fee: '',
      label: '',
      rate: '9.44',
      ref: 'ccb69fdf971f40a04fd5f7c91666549cb62177967d8e3105296e38b1925b63de',
      time: '2025-02-13 01:10:22',
      type: 'tx',
      value: '9791'
    },
    {
      fee: '153',
      label: '',
      rate: '-9.78',
      ref: '7fcf752578020878413c3d3dcf248746e2ad6d5e13eeaf143cf2cc66128b240a',
      time: '2025-02-13 01:10:22',
      type: 'tx',
      value: '-10153'
    },
    {
      fee: '454',
      label: 'Multi',
      rate: '-0.43',
      ref: 'ad64250ef6f24a7a8832e55cd2926758ee16da9d6e159049e7b432664a303629',
      time: '2025-03-02 02:19:12',
      type: 'tx',
      value: '-454'
    },
    {
      fee: '454',
      label: 'multi sig',
      rate: '-32.14',
      ref: 'dd31e2071659d1bc385426843ea60b4c4c0d5ab61030582b146fcb745ca28161',
      time: '2025-03-02 02:19:12',
      type: 'tx',
      value: '-34193'
    },
    {
      fee: '380',
      label: 'to multi',
      rate: '-11.95',
      ref: 'b48a73173fed37c1c268b4a079caf777424917c8223c5556c0cc0435213030c5',
      time: '2025-03-02 22:48:42',
      type: 'tx',
      value: '-12711'
    }
  ],
  [
    {
      fee: '',
      label: 'Hunicus send',
      rate: '186.60',
      ref: 'd948cbe2d084d1abcf7d34fa4b31a6f264b3f055388be43002f23c4e370a6791',
      time: '2024-12-31 12:33:02',
      type: 'tx',
      value: '200000'
    },
    {
      fee: '',
      label: 'back from carlo A',
      rate: '6.56',
      ref: '23926eadace17518ea2c297fb4b0782e028153a1d0ef99bec12cbc144c2453ff',
      time: '2024-12-31 14:46:58',
      type: 'tx',
      value: '7030'
    },
    {
      fee: '191418',
      label: 'Testing to PSYCARLO 2',
      rate: '231',
      ref: '-14.57',
      time: '2024-12-31 14:46:58',
      type: 'tx',
      value: ' Testing to PSYCARLO 1'
    },
    {
      fee: ' Large to Carlo C',
      label: 'Large to Carlo D',
      rate: '-72337',
      ref: '119081',
      time: '2024-12-31 14:59:59',
      type: 'tx',
      value: ' Large to Carlo A'
    },
    {
      fee: '',
      label: 'Hunicus send',
      rate: '139.83',
      ref: 'bb1749d04d08010aed39a72af83313657e2c09175175777075800d313f2bfc3d',
      time: '2024-12-31 17:06:32',
      type: 'tx',
      value: '149872'
    },
    {
      fee: '',
      label: 'Hunicus send',
      rate: '6.55',
      ref: '74d45e932fa71a5e5a6d9138dd5da245393d69daa12b897c140adace4f05aadf',
      time: '2025-01-02 15:12:54',
      type: 'tx',
      value: '6764'
    },
    {
      fee: '141',
      label: '',
      rate: '-3.09',
      ref: '0d239e8f60568bb7d8b1c6973ecd5dad9234f49bd589995d3c322eca9a8f23aa',
      time: '2025-01-04 01:13:09',
      type: 'tx',
      value: '-3141'
    },
    {
      fee: '141',
      label: '',
      rate: '-8.85',
      ref: '681477bfd5ee6cb07bc64fb0451f268bd59f4c207067e78059100d5447935e92',
      time: '2025-01-04 01:13:09',
      type: 'tx',
      value: '-9000'
    },
    {
      fee: '2516',
      label: 'to carlos',
      rate: '-48.55',
      ref: '269b53e16d96425eb7d2183841e29552eab6a553cac098c76d0c75062ef48856',
      time: '2025-01-09 14:50:30',
      type: 'tx',
      value: '-52516'
    },
    {
      fee: '',
      label: 'Hunicus send',
      rate: '4.62',
      ref: '4686cb1251dcf23e42faceb994d2176d4030e07731500d45d2a150f95044d8cd',
      time: '2025-01-09 14:56:08',
      type: 'tx',
      value: '5000'
    },
    {
      fee: '-49718',
      label: 'calros 1',
      rate: '166342',
      ref: '1476',
      time: '2025-01-09 14:56:08',
      type: 'tx',
      value: ' carlos 2'
    },
    {
      fee: '5052',
      label: '',
      rate: '-42.95',
      ref: 'a55f8be6f928f2fc023241e9b265ce1e6df70e19980d8bd6f8571c5a34169654',
      time: '2025-01-21 01:38:06',
      type: 'tx',
      value: '-40516'
    },
    {
      fee: '2966',
      label: '',
      rate: '-26.07',
      ref: 'd8bf446e1db334c436ca65e2cd545f298b42229207c43285cbe5a4eb67aa7f6f',
      time: '2025-01-29 10:32:13',
      type: 'tx',
      value: '-25186'
    },
    {
      fee: '',
      label: 'more hunicus',
      rate: '85.36',
      ref: '7b01cbe040782b04821eede9f9038a72263464def5d0a801b4c65eda72619ce7',
      time: '2025-01-31 16:06:38',
      type: 'tx',
      value: '83501'
    },
    {
      fee: '',
      label: '',
      rate: '15.85',
      ref: '51ea0a6ffff52665d5211fe3e2de99e2d19abccb1f1a7fa1e6bc22caae47abce',
      time: '2025-01-31 18:53:38',
      type: 'tx',
      value: '15501'
    },
    {
      fee: '',
      label: '',
      rate: '8.89',
      ref: 'a7289ed0cffab33d48436313e8ab226ed056640672c5b59fd70ec4de044a65bf',
      time: '2025-02-04 16:34:59',
      type: 'tx',
      value: '9101'
    },
    {
      fee: '519',
      label: '',
      rate: '-15.14',
      ref: '8179a57b9a600d4b7c7dba30ec8d38810a360f13ad9c68a0c466ad7900173529',
      time: '2025-02-04 22:31:00',
      type: 'tx',
      value: '-15501'
    },
    {
      fee: '413',
      label: '',
      rate: '-54.21',
      ref: 'a7f48862afb292ccfea2f0e6781949f7754683b466285c201559599714197c45',
      time: '2025-02-05 01:15:24',
      type: 'tx',
      value: '-56214'
    },
    {
      fee: '',
      label: '',
      rate: '9.44',
      ref: 'ccb69fdf971f40a04fd5f7c91666549cb62177967d8e3105296e38b1925b63de',
      time: '2025-02-13 01:10:22',
      type: 'tx',
      value: '9791'
    },
    {
      fee: '153',
      label: '',
      rate: '-9.78',
      ref: '7fcf752578020878413c3d3dcf248746e2ad6d5e13eeaf143cf2cc66128b240a',
      time: '2025-02-13 01:10:22',
      type: 'tx',
      value: '-10153'
    },
    {
      fee: '454',
      label: 'Multi',
      rate: '-0.43',
      ref: 'ad64250ef6f24a7a8832e55cd2926758ee16da9d6e159049e7b432664a303629',
      time: '2025-03-02 02:19:12',
      type: 'tx',
      value: '-454'
    },
    {
      fee: '454',
      label: 'multi sig',
      rate: '-32.14',
      ref: 'dd31e2071659d1bc385426843ea60b4c4c0d5ab61030582b146fcb745ca28161',
      time: '2025-03-02 02:19:12',
      type: 'tx',
      value: '-34193'
    },
    {
      fee: '380',
      label: 'to multi',
      rate: '-11.95',
      ref: 'b48a73173fed37c1c268b4a079caf777424917c8223c5556c0cc0435213030c5',
      time: '2025-03-02 22:48:42',
      type: 'tx',
      value: '-12711'
    }
  ]
]

const sampleCsvSparrowAddr = [
  `Index,Payment Address,Derivation,Label
0,tb1qzfrh7avv5d9v2yzx75d7wlqy39mz0quxgfqddy,m/84'/1'/0'/0/0,Hunicus send
1,tb1qksxdnyn84e3mt69dv987vqhwhvx2v4c2epmsxy,m/84'/1'/0'/0/1,back from carlo C
2,tb1qu88gwtmtgp4plm809zzp7v6sdg0829hqfhex8l,m/84'/1'/0'/0/2,back from carlo B
3,tb1qaurrgazm3az2r7v5nlgzxvua5v69y9f6k3axgq,m/84'/1'/0'/0/3,back from carlo A
4,tb1q5xlt0szku06dudd8nwt4ruhulakg5zyhtslvws,m/84'/1'/0'/0/4,more hunicus
5,tb1qcf9anayaz4rt5m7kwf3xtt2u6csft3xsh2ttfm,m/84'/1'/0'/0/5,
6,tb1qpplr04wwzru29nx9pcqlc5x4rp0cm08csyhlvq,m/84'/1'/0'/0/6,
7,tb1qsjuw5jn3j8hgutjf73880qnpkqls4zm3scwu6h,m/84'/1'/0'/0/7,
8,tb1qemrk7veyy4tls399acl7jxa3k8d65a8zsy3trf,m/84'/1'/0'/0/8,Multi
9,tb1qj39dhvsjyvpxz4qqx9hyle0dy2u7v5n89t5auu,m/84'/1'/0'/0/9,
10,tb1q65sp5guzhrtw6fy2juy80ztv6zrfcqzu9um4rh,m/84'/1'/0'/0/10,`,
  `Index,Payment Address,Derivation,Label
0,tb1q57xg0vm530r54xezz47y6jpe67zclv47yxrd2d,m/84'/1'/0'/1/0,"Testing to PSYCARLO 2, Testing to PSYCARLO 1"
1,tb1qnthw6a03rqw5ryx98nk35hz7udnwxvtycaadyn,m/84'/1'/0'/1/1,"Large to Carlo D, Large to Carlo A, Large to Carlo B, Large to Carlo C"
2,tb1qwed3dd8z3ags6jtu2vyj7swtqpe2rsxnkmu5qu,m/84'/1'/0'/1/2,
3,tb1qt5uc0er3rrqh0yuwp9ld0sdznrwdm5n56jshg9,m/84'/1'/0'/1/3,
4,tb1qrvfdzcf2p28nc26ht46ly7l5558ndug2d6nhmt,m/84'/1'/0'/1/4,to carlos
5,tb1q5nex94veyljfw9mdzrkugq5yfp0upay75tpca7,m/84'/1'/0'/1/5,to carlos
6,tb1q20m0xyfunjwlla2rl6tcg562cgx9a5rdxtxenv,m/84'/1'/0'/1/6,to carlos
7,tb1qdn95tphamcudzd6yqe9057dsn99z7mzkpklfmx,m/84'/1'/0'/1/7,"calros 1, carlos 2, carlos reuse"
8,tb1q3cykhy944c099zrhld409had39jcvpdmlkv03w,m/84'/1'/0'/1/8,
9,tb1qf6nft8hxu2ycdhxk778a2h582eeldjwgyzwug3,m/84'/1'/0'/1/9,
10,tb1q844ldzdplfmeqjemr6c0gx4nankp368a0djw2h,m/84'/1'/0'/1/10,
11,tb1qljmuktl8c96whwh5f0wrd0hcru33u0zvctxczh,m/84'/1'/0'/1/11,
12,tb1qq2ca93pg5pmzy383tav69wscvunutqerxg59mn,m/84'/1'/0'/1/12,
13,tb1qtn62uggathhfp0dgzxwr87nkesnr4q9z3w7l30,m/84'/1'/0'/1/13,
14,tb1qdmjxw7asrw7zr4xh8g65qq7lgu42fetdvkrklc,m/84'/1'/0'/1/14,
15,tb1quvs7tmquj6r2ewtfcrcvz6aa5qyuc79m09grk3,m/84'/1'/0'/1/15,
16,tb1qy6rpzdfdekzk42255qc7e42ex20vlh8jatdmxm,m/84'/1'/0'/1/16,multi sig
17,tb1q96p9wfdt5esw7vgdzyrvwh6u0ta6qzspsajes3,m/84'/1'/0'/1/17,
18,tb1qgydwrwraqez83qc234s3pxcses53gxluxfw50h,m/84'/1'/0'/1/18,
19,tb1q25p2n7qz9pn0fc97kdzqjum9ufmjqfyvlp9z86,m/84'/1'/0'/1/19,
20,tb1q85mk3deprzh4yfjlsux2shxrpm2xfj5up2gdq0,m/84'/1'/0'/1/20,
`
]

const sampleCsvSparrowAddrExpected = [
  [
    {
      keypath: '0',
      label: 'Hunicus send',
      origin: "m/84'/1'/0'/0/0",
      ref: 'tb1qzfrh7avv5d9v2yzx75d7wlqy39mz0quxgfqddy'
    },
    {
      keypath: '1',
      label: 'back from carlo C',
      origin: "m/84'/1'/0'/0/1",
      ref: 'tb1qksxdnyn84e3mt69dv987vqhwhvx2v4c2epmsxy'
    },
    {
      keypath: '2',
      label: 'back from carlo B',
      origin: "m/84'/1'/0'/0/2",
      ref: 'tb1qu88gwtmtgp4plm809zzp7v6sdg0829hqfhex8l'
    },
    {
      keypath: '3',
      label: 'back from carlo A',
      origin: "m/84'/1'/0'/0/3",
      ref: 'tb1qaurrgazm3az2r7v5nlgzxvua5v69y9f6k3axgq'
    },
    {
      keypath: '4',
      label: 'more hunicus',
      origin: "m/84'/1'/0'/0/4",
      ref: 'tb1q5xlt0szku06dudd8nwt4ruhulakg5zyhtslvws'
    },
    {
      keypath: '5',
      label: '',
      origin: "m/84'/1'/0'/0/5",
      ref: 'tb1qcf9anayaz4rt5m7kwf3xtt2u6csft3xsh2ttfm'
    },
    {
      keypath: '6',
      label: '',
      origin: "m/84'/1'/0'/0/6",
      ref: 'tb1qpplr04wwzru29nx9pcqlc5x4rp0cm08csyhlvq'
    },
    {
      keypath: '7',
      label: '',
      origin: "m/84'/1'/0'/0/7",
      ref: 'tb1qsjuw5jn3j8hgutjf73880qnpkqls4zm3scwu6h'
    },
    {
      keypath: '8',
      label: 'Multi',
      origin: "m/84'/1'/0'/0/8",
      ref: 'tb1qemrk7veyy4tls399acl7jxa3k8d65a8zsy3trf'
    },
    {
      keypath: '9',
      label: '',
      origin: "m/84'/1'/0'/0/9",
      ref: 'tb1qj39dhvsjyvpxz4qqx9hyle0dy2u7v5n89t5auu'
    },
    {
      keypath: '10',
      label: '',
      origin: "m/84'/1'/0'/0/10",
      ref: 'tb1q65sp5guzhrtw6fy2juy80ztv6zrfcqzu9um4rh'
    }
  ],
  [
    {
      keypath: '0',
      label: 'Testing to PSYCARLO 2',
      origin: "m/84'/1'/0'/1/0",
      ref: 'tb1q57xg0vm530r54xezz47y6jpe67zclv47yxrd2d'
    },
    {
      keypath: '1',
      label: 'Large to Carlo D',
      origin: "m/84'/1'/0'/1/1",
      ref: 'tb1qnthw6a03rqw5ryx98nk35hz7udnwxvtycaadyn'
    },
    {
      keypath: '2',
      label: '',
      origin: "m/84'/1'/0'/1/2",
      ref: 'tb1qwed3dd8z3ags6jtu2vyj7swtqpe2rsxnkmu5qu'
    },
    {
      keypath: '3',
      label: '',
      origin: "m/84'/1'/0'/1/3",
      ref: 'tb1qt5uc0er3rrqh0yuwp9ld0sdznrwdm5n56jshg9'
    },
    {
      keypath: '4',
      label: 'to carlos',
      origin: "m/84'/1'/0'/1/4",
      ref: 'tb1qrvfdzcf2p28nc26ht46ly7l5558ndug2d6nhmt'
    },
    {
      keypath: '5',
      label: 'to carlos',
      origin: "m/84'/1'/0'/1/5",
      ref: 'tb1q5nex94veyljfw9mdzrkugq5yfp0upay75tpca7'
    },
    {
      keypath: '6',
      label: 'to carlos',
      origin: "m/84'/1'/0'/1/6",
      ref: 'tb1q20m0xyfunjwlla2rl6tcg562cgx9a5rdxtxenv'
    },
    {
      keypath: '7',
      label: 'calros 1',
      origin: "m/84'/1'/0'/1/7",
      ref: 'tb1qdn95tphamcudzd6yqe9057dsn99z7mzkpklfmx'
    },
    {
      keypath: '8',
      label: '',
      origin: "m/84'/1'/0'/1/8",
      ref: 'tb1q3cykhy944c099zrhld409had39jcvpdmlkv03w'
    },
    {
      keypath: '9',
      label: '',
      origin: "m/84'/1'/0'/1/9",
      ref: 'tb1qf6nft8hxu2ycdhxk778a2h582eeldjwgyzwug3'
    },
    {
      keypath: '10',
      label: '',
      origin: "m/84'/1'/0'/1/10",
      ref: 'tb1q844ldzdplfmeqjemr6c0gx4nankp368a0djw2h'
    },
    {
      keypath: '11',
      label: '',
      origin: "m/84'/1'/0'/1/11",
      ref: 'tb1qljmuktl8c96whwh5f0wrd0hcru33u0zvctxczh'
    },
    {
      keypath: '12',
      label: '',
      origin: "m/84'/1'/0'/1/12",
      ref: 'tb1qq2ca93pg5pmzy383tav69wscvunutqerxg59mn'
    },
    {
      keypath: '13',
      label: '',
      origin: "m/84'/1'/0'/1/13",
      ref: 'tb1qtn62uggathhfp0dgzxwr87nkesnr4q9z3w7l30'
    },
    {
      keypath: '14',
      label: '',
      origin: "m/84'/1'/0'/1/14",
      ref: 'tb1qdmjxw7asrw7zr4xh8g65qq7lgu42fetdvkrklc'
    },
    {
      keypath: '15',
      label: '',
      origin: "m/84'/1'/0'/1/15",
      ref: 'tb1quvs7tmquj6r2ewtfcrcvz6aa5qyuc79m09grk3'
    },
    {
      keypath: '16',
      label: 'multi sig',
      origin: "m/84'/1'/0'/1/16",
      ref: 'tb1qy6rpzdfdekzk42255qc7e42ex20vlh8jatdmxm'
    },
    {
      keypath: '17',
      label: '',
      origin: "m/84'/1'/0'/1/17",
      ref: 'tb1q96p9wfdt5esw7vgdzyrvwh6u0ta6qzspsajes3'
    },
    {
      keypath: '18',
      label: '',
      origin: "m/84'/1'/0'/1/18",
      ref: 'tb1qgydwrwraqez83qc234s3pxcses53gxluxfw50h'
    },
    {
      keypath: '19',
      label: '',
      origin: "m/84'/1'/0'/1/19",
      ref: 'tb1q25p2n7qz9pn0fc97kdzqjum9ufmjqfyvlp9z86'
    },
    {
      keypath: '20',
      label: '',
      origin: "m/84'/1'/0'/1/20",
      ref: 'tb1q85mk3deprzh4yfjlsux2shxrpm2xfj5up2gdq0'
    }
  ]
]

const sampleCsvSparrowUtxo = `Date (UTC),Output,Address,Label,Value
2025-01-09 14:56:08,4686cb1251dcf23e42faceb994d2176d4030e07731500d45d2a150f95044d8cd:0,tb1qzfrh7avv5d9v2yzx75d7wlqy39mz0quxgfqddy,Hunicus send (received),5000
2025-01-21 01:38:06,a55f8be6f928f2fc023241e9b265ce1e6df70e19980d8bd6f8571c5a34169654:3,tb1qf6nft8hxu2ycdhxk778a2h582eeldjwgyzwug3,,19451
2025-01-29 10:32:13,d8bf446e1db334c436ca65e2cd545f298b42229207c43285cbe5a4eb67aa7f6f:1,tb1qq2ca93pg5pmzy383tav69wscvunutqerxg59mn,,26297
2025-02-05 01:15:24,a7f48862afb292ccfea2f0e6781949f7754683b466285c201559599714197c45:1,tb1qdmjxw7asrw7zr4xh8g65qq7lgu42fetdvkrklc,,27287
2025-02-13 01:10:22,ccb69fdf971f40a04fd5f7c91666549cb62177967d8e3105296e38b1925b63de:0,tb1qsjuw5jn3j8hgutjf73880qnpkqls4zm3scwu6h,,9791
2025-03-02 02:19:12,ad64250ef6f24a7a8832e55cd2926758ee16da9d6e159049e7b432664a303629:0,tb1qemrk7veyy4tls399acl7jxa3k8d65a8zsy3trf,Multi (received),1482
`

const sampleCsvSparrowUtxoExpected = [
  {
    label: 'Hunicus send (received)',
    ref: '4686cb1251dcf23e42faceb994d2176d4030e07731500d45d2a150f95044d8cd:0',
    time: '2025-01-09 14:56:08',
    type: 'output',
    value: '5000'
  },
  {
    label: '',
    ref: 'a55f8be6f928f2fc023241e9b265ce1e6df70e19980d8bd6f8571c5a34169654:3',
    time: '2025-01-21 01:38:06',
    type: 'output',
    value: '19451'
  },
  {
    label: '',
    ref: 'd8bf446e1db334c436ca65e2cd545f298b42229207c43285cbe5a4eb67aa7f6f:1',
    time: '2025-01-29 10:32:13',
    type: 'output',
    value: '26297'
  },
  {
    label: '',
    ref: 'a7f48862afb292ccfea2f0e6781949f7754683b466285c201559599714197c45:1',
    time: '2025-02-05 01:15:24',
    type: 'output',
    value: '27287'
  },
  {
    label: '',
    ref: 'ccb69fdf971f40a04fd5f7c91666549cb62177967d8e3105296e38b1925b63de:0',
    time: '2025-02-13 01:10:22',
    type: 'output',
    value: '9791'
  },
  {
    label: 'Multi (received)',
    ref: 'ad64250ef6f24a7a8832e55cd2926758ee16da9d6e159049e7b432664a303629:0',
    time: '2025-03-02 02:19:12',
    type: 'output',
    value: '1482'
  }
]

const sampleCsvNonchukTx = `txid,fee,amount,height,memo
7718a523c3ff3ef344e5860e9cb0b7e463631f21a55d583c0ffac211bcffec90,231,-15381,228763,"Multiple addresses"
659a13373d6fad4adcfc74aa6fd331fe16d783ebb77f89e57edda61a58a85022,238,-72099,228764,""
d948cbe2d084d1abcf7d34fa4b31a6f264b3f055388be43002f23c4e370a6791,0,200000,228753,""
bb1749d04d08010aed39a72af83313657e2c09175175777075800d313f2bfc3d,0,149872,228778,""
74d45e932fa71a5e5a6d9138dd5da245393d69daa12b897c140adace4f05aadf,0,6764,229065,""
0d239e8f60568bb7d8b1c6973ecd5dad9234f49bd589995d3c322eca9a8f23aa,141,-3000,229282,""
269b53e16d96425eb7d2183841e29552eab6a553cac098c76d0c75062ef48856,2516,-50000,230084,""
4686cb1251dcf23e42faceb994d2176d4030e07731500d45d2a150f95044d8cd,0,5000,230085,""
681477bfd5ee6cb07bc64fb0451f268bd59f4c207067e78059100d5447935e92,141,-8859,229282,""
23926eadace17518ea2c297fb4b0782e028153a1d0ef99bec12cbc144c2453ff,0,7030,228763,""
a55f8be6f928f2fc023241e9b265ce1e6df70e19980d8bd6f8571c5a34169654,5052,-35464,231855,""
d8bf446e1db334c436ca65e2cd545f298b42229207c43285cbe5a4eb67aa7f6f,2966,-22220,233116,""
7b01cbe040782b04821eede9f9038a72263464def5d0a801b4c65eda72619ce7,0,83501,233409,""
a7f48862afb292ccfea2f0e6781949f7754683b466285c201559599714197c45,413,-55801,234029,""
51ea0a6ffff52665d5211fe3e2de99e2d19abccb1f1a7fa1e6bc22caae47abce,0,15501,233425,""
8179a57b9a600d4b7c7dba30ec8d38810a360f13ad9c68a0c466ad7900173529,519,-14982,234018,""
ae3d3ec185eb197fcc8bf4f533a45099875ffbe4d2b9abaceb059c3439d2dff7,1476,-48242,230085,""
a7289ed0cffab33d48436313e8ab226ed056640672c5b59fd70ec4de044a65bf,0,9101,233988,""
ccb69fdf971f40a04fd5f7c91666549cb62177967d8e3105296e38b1925b63de,209,9791,235125,"Recieved money"
7fcf752578020878413c3d3dcf248746e2ad6d5e13eeaf143cf2cc66128b240a,153,-10000,235125,""
dd31e2071659d1bc385426843ea60b4c4c0d5ab61030582b146fcb745ca28161,454,-33739,237505,""
ad64250ef6f24a7a8832e55cd2926758ee16da9d6e159049e7b432664a303629,454,0,237505,""
b48a73173fed37c1c268b4a079caf777424917c8223c5556c0cc0435213030c5,380,-12331,237616,""
bbede7bf7c52a098e21f97dd5116c19f544323b2cfe6accb1fc0a67144c30d57,480,-21701,237880,""
98dbad2760355b45aa046c3689108394ef9f741baf63840724802f4280e27a91,209,-5801,237735,"four dollars going out #red"`

const sampleCsvNonchukTxExpected = [
  {
    fee: '231',
    height: '228763',
    label: 'Multiple addresses',
    ref: '7718a523c3ff3ef344e5860e9cb0b7e463631f21a55d583c0ffac211bcffec90',
    type: 'tx',
    value: '-15381'
  },
  {
    fee: '238',
    height: '228764',
    label: '',
    ref: '659a13373d6fad4adcfc74aa6fd331fe16d783ebb77f89e57edda61a58a85022',
    type: 'tx',
    value: '-72099'
  },
  {
    fee: '0',
    height: '228753',
    label: '',
    ref: 'd948cbe2d084d1abcf7d34fa4b31a6f264b3f055388be43002f23c4e370a6791',
    type: 'tx',
    value: '200000'
  },
  {
    fee: '0',
    height: '228778',
    label: '',
    ref: 'bb1749d04d08010aed39a72af83313657e2c09175175777075800d313f2bfc3d',
    type: 'tx',
    value: '149872'
  },
  {
    fee: '0',
    height: '229065',
    label: '',
    ref: '74d45e932fa71a5e5a6d9138dd5da245393d69daa12b897c140adace4f05aadf',
    type: 'tx',
    value: '6764'
  },
  {
    fee: '141',
    height: '229282',
    label: '',
    ref: '0d239e8f60568bb7d8b1c6973ecd5dad9234f49bd589995d3c322eca9a8f23aa',
    type: 'tx',
    value: '-3000'
  },
  {
    fee: '2516',
    height: '230084',
    label: '',
    ref: '269b53e16d96425eb7d2183841e29552eab6a553cac098c76d0c75062ef48856',
    type: 'tx',
    value: '-50000'
  },
  {
    fee: '0',
    height: '230085',
    label: '',
    ref: '4686cb1251dcf23e42faceb994d2176d4030e07731500d45d2a150f95044d8cd',
    type: 'tx',
    value: '5000'
  },
  {
    fee: '141',
    height: '229282',
    label: '',
    ref: '681477bfd5ee6cb07bc64fb0451f268bd59f4c207067e78059100d5447935e92',
    type: 'tx',
    value: '-8859'
  },
  {
    fee: '0',
    height: '228763',
    label: '',
    ref: '23926eadace17518ea2c297fb4b0782e028153a1d0ef99bec12cbc144c2453ff',
    type: 'tx',
    value: '7030'
  },
  {
    fee: '5052',
    height: '231855',
    label: '',
    ref: 'a55f8be6f928f2fc023241e9b265ce1e6df70e19980d8bd6f8571c5a34169654',
    type: 'tx',
    value: '-35464'
  },
  {
    fee: '2966',
    height: '233116',
    label: '',
    ref: 'd8bf446e1db334c436ca65e2cd545f298b42229207c43285cbe5a4eb67aa7f6f',
    type: 'tx',
    value: '-22220'
  },
  {
    fee: '0',
    height: '233409',
    label: '',
    ref: '7b01cbe040782b04821eede9f9038a72263464def5d0a801b4c65eda72619ce7',
    type: 'tx',
    value: '83501'
  },
  {
    fee: '413',
    height: '234029',
    label: '',
    ref: 'a7f48862afb292ccfea2f0e6781949f7754683b466285c201559599714197c45',
    type: 'tx',
    value: '-55801'
  },
  {
    fee: '0',
    height: '233425',
    label: '',
    ref: '51ea0a6ffff52665d5211fe3e2de99e2d19abccb1f1a7fa1e6bc22caae47abce',
    type: 'tx',
    value: '15501'
  },
  {
    fee: '519',
    height: '234018',
    label: '',
    ref: '8179a57b9a600d4b7c7dba30ec8d38810a360f13ad9c68a0c466ad7900173529',
    type: 'tx',
    value: '-14982'
  },
  {
    fee: '1476',
    height: '230085',
    label: '',
    ref: 'ae3d3ec185eb197fcc8bf4f533a45099875ffbe4d2b9abaceb059c3439d2dff7',
    type: 'tx',
    value: '-48242'
  },
  {
    fee: '0',
    height: '233988',
    label: '',
    ref: 'a7289ed0cffab33d48436313e8ab226ed056640672c5b59fd70ec4de044a65bf',
    type: 'tx',
    value: '9101'
  },
  {
    fee: '209',
    height: '235125',
    label: 'Recieved money',
    ref: 'ccb69fdf971f40a04fd5f7c91666549cb62177967d8e3105296e38b1925b63de',
    type: 'tx',
    value: '9791'
  },
  {
    fee: '153',
    height: '235125',
    label: '',
    ref: '7fcf752578020878413c3d3dcf248746e2ad6d5e13eeaf143cf2cc66128b240a',
    type: 'tx',
    value: '-10000'
  },
  {
    fee: '454',
    height: '237505',
    label: '',
    ref: 'dd31e2071659d1bc385426843ea60b4c4c0d5ab61030582b146fcb745ca28161',
    type: 'tx',
    value: '-33739'
  },
  {
    fee: '454',
    height: '237505',
    label: '',
    ref: 'ad64250ef6f24a7a8832e55cd2926758ee16da9d6e159049e7b432664a303629',
    type: 'tx',
    value: '0'
  },
  {
    fee: '380',
    height: '237616',
    label: '',
    ref: 'b48a73173fed37c1c268b4a079caf777424917c8223c5556c0cc0435213030c5',
    type: 'tx',
    value: '-12331'
  },
  {
    fee: '480',
    height: '237880',
    label: '',
    ref: 'bbede7bf7c52a098e21f97dd5116c19f544323b2cfe6accb1fc0a67144c30d57',
    type: 'tx',
    value: '-21701'
  },
  {
    fee: '209',
    height: '237735',
    label: 'four dollars going out #red',
    ref: '98dbad2760355b45aa046c3689108394ef9f741baf63840724802f4280e27a91',
    type: 'tx',
    value: '-5801'
  }
]

const sampleCsvNonchukUtxo = `txid,vout,amount,height,memo
4686cb1251dcf23e42faceb994d2176d4030e07731500d45d2a150f95044d8cd,0,5000,230085,""
a55f8be6f928f2fc023241e9b265ce1e6df70e19980d8bd6f8571c5a34169654,3,19451,231855,""
bbede7bf7c52a098e21f97dd5116c19f544323b2cfe6accb1fc0a67144c30d57,1,36666,237880,""`

const sampleCsvNonchukUtxoExpected = [
  {
    height: '230085',
    label: '',
    ref: '4686cb1251dcf23e42faceb994d2176d4030e07731500d45d2a150f95044d8cd:0',
    type: 'addr',
    value: '5000'
  },
  {
    height: '231855',
    label: '',
    ref: 'a55f8be6f928f2fc023241e9b265ce1e6df70e19980d8bd6f8571c5a34169654:3',
    type: 'addr',
    value: '19451'
  },
  {
    height: '237880',
    label: '',
    ref: 'bbede7bf7c52a098e21f97dd5116c19f544323b2cfe6accb1fc0a67144c30d57:1',
    type: 'addr',
    value: '36666'
  }
]

module.exports = {
  sampleCsvNonchukTx,
  sampleCsvNonchukTxExpected,
  sampleCsvNonchukUtxo,
  sampleCsvNonchukUtxoExpected,
  sampleCsvSparrowAddr,
  sampleCsvSparrowAddrExpected,
  sampleCsvSparrowTx,
  sampleCsvSparrowTxExpected,
  sampleCsvSparrowUtxo,
  sampleCsvSparrowUtxoExpected,
  sampleJsonl,
  sampleJsonlExpected
}
