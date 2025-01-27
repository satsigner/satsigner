// @mockTransactions.ts
export const mockTransactions = [
  {
    txid: 'c0158a2a49abf57ab04a328eb60008e636ec63478b5e3c124109c028278beae5',
    version: 1,
    fee: 156,
    locktime: 0,
    size: 205,
    weight: 616,
    status: {
      confirmed: true,
      block_height: 1138368,
      block_hash:
        '00000042ff1bc3bffafd69ae00d9663e355092debb32152a71ab5170acdf5a68',
      block_time: 1717249560
    },
    vin: [
      {
        txid: '7f869a148dcfa82043a90253558a878b60fad6d86ee5889a5a1e3e4cb0c38a66',
        vout: 1,
        prevout: {
          scriptpubkey_address:
            'tb1pec9pvcz5q3m22vxf4h2v42y60sylkwjdspumxw8rf4804f0hcpmqpdw67r',
          value: 289513403
        }
      }
    ],
    vout: [
      {
        scriptpubkey_address:
          'tb1pls40xdjnftwcg78nxl2tycj66s9nfa2dmt373vjdxx3jqy2qpe9sksqj55',
        value: 279513247
      },
      {
        scriptpubkey_address:
          'tb1pvudcs9eadn3dlgd3t78ulkk4hmlpn0shdcj2rr27tufyc29z645szezhs5',
        value: 10000000
      }
    ]
  },
  {
    txid: '6969890aae6451280b234b3b900073bc9ce4349172b071900ec21043437838d2',
    version: 2,
    fee: 1402,
    locktime: 1129936,
    size: 222,
    weight: 561,
    status: {
      confirmed: true,
      block_height: 1129938,
      block_hash:
        '000002eef73c0c87a95a05027e378ef9ffef1013120efcba3515545bf1a91958',
      block_time: 1716988484
    },
    vin: [
      {
        txid: 'bd2dcdc02f495f8ec6c62b3e8e3ff45e893e8e72d506f88adc1b70aad26861dc',
        vout: 0,
        prevout: {
          scriptpubkey_address: 'tb1qqnv9w6sz83jdyk2jh7x244gn8x3h64fgjha0qj',
          value: 1000000
        }
      }
    ],
    vout: [
      {
        scriptpubkey_address: 'tb1qrmz9ztpdn7gnmt5txpcj8xvjgkx5g5f942p052',
        value: 100500
      },
      {
        scriptpubkey_address: 'tb1qvcke8h92g8kmqlfmm84ahqutxkzklz9nmxqc2s',
        value: 898098
      }
    ]
  },
  {
    txid: '5dad877ee1ebb8a277962242043bffd739e670082d65991ac376af104a28b314',
    version: 1,
    fee: 144,
    locktime: 0,
    size: 193,
    weight: 568,
    status: {
      confirmed: true,
      block_height: 1138522,
      block_hash:
        '0000008ad42ed365cef6afdae89765aa5495689f50cf605bbe54a53ea374a450',
      block_time: 1717254327
    },
    vin: [
      {
        txid: 'c0158a2a49abf57ab04a328eb60008e636ec63478b5e3c124109c028278beae5',
        vout: 0,
        prevout: {
          scriptpubkey_address:
            'tb1pls40xdjnftwcg78nxl2tycj66s9nfa2dmt373vjdxx3jqy2qpe9sksqj55',
          value: 279513247
        }
      }
    ],
    vout: [
      {
        scriptpubkey_address: 'tb1q6tpelgvms20zt72hamhurjrh4r7ahac4njw3kw',
        value: 199000
      },
      {
        scriptpubkey_address:
          'tb1pcsdtdf2pzkf4wan5qgqp93yfmvwv4q9cmqvynqgd7ft976k5ylcqeskkwp',
        value: 279314103
      }
    ]
  },
  {
    txid: '34790e11b8fc654b75595b5f383c15d702a28be6b92e9c8ad3b1532b3d2247a4',
    version: 2,
    fee: 1402,
    locktime: 1129939,
    size: 222,
    weight: 561,
    status: {
      confirmed: true,
      block_height: 1129941,
      block_hash:
        '0000027308fd6c1dda21aa0c6afd7a42bd3ae249e6481c38eb14e5d4d329216d',
      block_time: 1716988577
    },
    vin: [
      {
        txid: '6969890aae6451280b234b3b900073bc9ce4349172b071900ec21043437838d2',
        vout: 1,
        prevout: {
          scriptpubkey_address: 'tb1qvcke8h92g8kmqlfmm84ahqutxkzklz9nmxqc2s',
          value: 898098
        }
      }
    ],
    vout: [
      {
        scriptpubkey_address: 'tb1qpfhenqwvqpwrllxzx2vhhmw5qhvgutkeu6jrvn',
        value: 861696
      },
      {
        scriptpubkey_address: 'tb1qadtcfpv0t9rzyensydapzawhd38ggzq2r0dzj4',
        value: 35000
      }
    ]
  }
]
