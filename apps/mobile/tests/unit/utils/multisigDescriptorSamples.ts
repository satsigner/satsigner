// Testnet cosigners from the BIP-39 test mnemonics "abandon … about",
// "legal winner … yellow" and "letter advice … above". Checksums follow
// BIP-380.

export const COSIGNERS = [
  {
    fingerprint: '73c5da0a',
    p2sh: 'tpubDDZYrRaHamqcmFWzCWbqoiYQDbbYepe5rR9vhvwokcUysunNEGDfA5U2jvoagKGkE3djj1AA3vnzfsTrYPHKSNg3Rh1WjWHztS6f27GKhBp',
    p2shP2wsh:
      'tpubDFH9dgzveyD8yHQb8VrpG8FYAuwcLMHMje2CCcbBo1FpaGzYVtJeYYxcYgRqSTta5utUFts8nPPHs9C2bqoxrey5jia6Dwf9mpwrPq7YvcJ',
    p2wsh:
      'tpubDFH9dgzveyD8zTbPUFuLrGmCydNvxehyNdUXKJAQN8x4aZ4j6UZqGfnqFrD4NqyaTVGKbvEW54tsvPTK2UoSbCC1PJY8iCNiwTL3RWZEheQ'
  },
  {
    fingerprint: 'b8688df1',
    p2sh: 'tpubDD8NbSvnUj9XPQimfzgA8hdCtzkHaQZZkuWxQnjWoFP1KXjWQuDLXa8KkhFXNRghqrM3h19YeBirAGfQQtX5rjXXpd5TZ1dhaaozAMUwuVu',
    p2shP2wsh:
      'tpubDEfobrrtptRTYDAEqBpqZpATkLaJRtZs793V2dSbcj7AF9Rmbq9visWyBNCEkDr5G7WH7kS1K1T8WhbPEpC4KuPfTiXXX2JdpeAi2cmYB5e',
    p2wsh:
      'tpubDEfobrrtptRTbKf4gysDhoabneABDTAcdj3Vbn4XwPsLE2pmqpizSPRG6zHsbAMuiSgWmWPsYCLHTKTPpyrGJ5rAoTpKoQNZcxodiPf2tSJ'
  },
  {
    fingerprint: '28645006',
    p2sh: 'tpubDCeydHVJt6qEWxgPhGfJ1F9u2DkeqRo6fzTVS6wxMVJtGpLd3nkz3cH1SWFr72pDLHrm3gvFywpNaXNYmp8VZD6PChmzdbfjrHbS6RTRBEJ',
    p2shP2wsh:
      'tpubDEwqCvJxKwKWSuVpnbCnKLppo1TGXpY2f8df8BhWLXDstHeh236DDuMezLB8GGPohrZdjfWLyB7hryGtfNiBUbHSSgrcLeMyJqCV4zGtefZ',
    p2wsh:
      'tpubDEwqCvJxKwKWX9xvRe48uofWJn1Y89Jn8UeH1Efrjb1UEVjUDy3URYTiqWaVCW7WdvHrL8XrSihHEhTwv5H3VDJoakjuCHiAnr6xcF2Xm4s'
  }
]

export const P2WSH_MULTISIG_DESCRIPTOR =
  'wsh(sortedmulti(2,[73c5da0a/48h/1h/0h/2h]tpubDFH9dgzveyD8zTbPUFuLrGmCydNvxehyNdUXKJAQN8x4aZ4j6UZqGfnqFrD4NqyaTVGKbvEW54tsvPTK2UoSbCC1PJY8iCNiwTL3RWZEheQ/<0;1>/*,[b8688df1/48h/1h/0h/2h]tpubDEfobrrtptRTbKf4gysDhoabneABDTAcdj3Vbn4XwPsLE2pmqpizSPRG6zHsbAMuiSgWmWPsYCLHTKTPpyrGJ5rAoTpKoQNZcxodiPf2tSJ/<0;1>/*,[28645006/48h/1h/0h/2h]tpubDEwqCvJxKwKWX9xvRe48uofWJn1Y89Jn8UeH1Efrjb1UEVjUDy3URYTiqWaVCW7WdvHrL8XrSihHEhTwv5H3VDJoakjuCHiAnr6xcF2Xm4s/<0;1>/*))#jhurgr69'

export const P2SH_P2WSH_MULTISIG_DESCRIPTOR =
  'sh(wsh(sortedmulti(2,[73c5da0a/48h/1h/0h/1h]tpubDFH9dgzveyD8yHQb8VrpG8FYAuwcLMHMje2CCcbBo1FpaGzYVtJeYYxcYgRqSTta5utUFts8nPPHs9C2bqoxrey5jia6Dwf9mpwrPq7YvcJ/<0;1>/*,[b8688df1/48h/1h/0h/1h]tpubDEfobrrtptRTYDAEqBpqZpATkLaJRtZs793V2dSbcj7AF9Rmbq9visWyBNCEkDr5G7WH7kS1K1T8WhbPEpC4KuPfTiXXX2JdpeAi2cmYB5e/<0;1>/*,[28645006/48h/1h/0h/1h]tpubDEwqCvJxKwKWSuVpnbCnKLppo1TGXpY2f8df8BhWLXDstHeh236DDuMezLB8GGPohrZdjfWLyB7hryGtfNiBUbHSSgrcLeMyJqCV4zGtefZ/<0;1>/*)))#camesfgf'

export const P2SH_MULTISIG_DESCRIPTOR =
  'sh(sortedmulti(2,[73c5da0a/45h/1h/0h]tpubDDZYrRaHamqcmFWzCWbqoiYQDbbYepe5rR9vhvwokcUysunNEGDfA5U2jvoagKGkE3djj1AA3vnzfsTrYPHKSNg3Rh1WjWHztS6f27GKhBp/<0;1>/*,[b8688df1/45h/1h/0h]tpubDD8NbSvnUj9XPQimfzgA8hdCtzkHaQZZkuWxQnjWoFP1KXjWQuDLXa8KkhFXNRghqrM3h19YeBirAGfQQtX5rjXXpd5TZ1dhaaozAMUwuVu/<0;1>/*,[28645006/45h/1h/0h]tpubDCeydHVJt6qEWxgPhGfJ1F9u2DkeqRo6fzTVS6wxMVJtGpLd3nkz3cH1SWFr72pDLHrm3gvFywpNaXNYmp8VZD6PChmzdbfjrHbS6RTRBEJ/<0;1>/*))#en5qrfzn'

export const P2WSH_MULTISIG_APOSTROPHE_DESCRIPTOR =
  "wsh(sortedmulti(2,[73c5da0a/48'/1'/0'/2']tpubDFH9dgzveyD8zTbPUFuLrGmCydNvxehyNdUXKJAQN8x4aZ4j6UZqGfnqFrD4NqyaTVGKbvEW54tsvPTK2UoSbCC1PJY8iCNiwTL3RWZEheQ/<0;1>/*,[b8688df1/48'/1'/0'/2']tpubDEfobrrtptRTbKf4gysDhoabneABDTAcdj3Vbn4XwPsLE2pmqpizSPRG6zHsbAMuiSgWmWPsYCLHTKTPpyrGJ5rAoTpKoQNZcxodiPf2tSJ/<0;1>/*,[28645006/48'/1'/0'/2']tpubDEwqCvJxKwKWX9xvRe48uofWJn1Y89Jn8UeH1Efrjb1UEVjUDy3URYTiqWaVCW7WdvHrL8XrSihHEhTwv5H3VDJoakjuCHiAnr6xcF2Xm4s/<0;1>/*))#uglk83ue"

export const COSIGNER_KEY_DESCRIPTOR =
  'wsh(pk([73c5da0a/48h/1h/0h/2h]tpubDFH9dgzveyD8zTbPUFuLrGmCydNvxehyNdUXKJAQN8x4aZ4j6UZqGfnqFrD4NqyaTVGKbvEW54tsvPTK2UoSbCC1PJY8iCNiwTL3RWZEheQ/0/*))#vd4fy20j'
