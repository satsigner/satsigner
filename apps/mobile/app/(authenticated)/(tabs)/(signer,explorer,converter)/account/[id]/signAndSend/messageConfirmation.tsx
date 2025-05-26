import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { SSIconSuccess } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress } from '@/utils/format'

export default function MessageConfirmation() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [clearTransaction, txBuilderResult] = useTransactionBuilderStore(
    useShallow((state) => [state.clearTransaction, state.txBuilderResult])
  )
  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === id)
  )
  const mempoolConfig = useBlockchainStore((state) => state.configsMempool)

  const webExplorerUrl = useMemo(() => {
    if (!account) return ''
    const { network } = account
    const mempoolServerUrl = mempoolConfig[network]
    return mempoolServerUrl
  }, [account, mempoolConfig])

  function handleBackToHome() {
    clearTransaction()
    router.dismissAll()
    router.navigate(`/account/${id}`)
  }

  if (!account || !txBuilderResult) return <Redirect href="/" />

  return (
    <>
      <SSMainLayout style={{ paddingBottom: 32 }}>
        <SSVStack justifyBetween>
          <SSVStack itemsCenter>
            <SSText weight="bold" size="lg">
              {t('sent.broadcasted')}
            </SSText>
            <SSVStack gap="none" itemsCenter>
              <SSText color="muted" uppercase>
                {t('transaction.id')}
              </SSText>
              <SSText>{formatAddress(txBuilderResult.txDetails.txid)}</SSText>
            </SSVStack>
            <SSIconSuccess width={159} height={159} />
          </SSVStack>
          <SSVStack>
            <SSClipboardCopy text={txBuilderResult.txDetails.txid}>
              <SSButton variant="outline" label={t('sent.copyTransactionId')} />
            </SSClipboardCopy>
            <SSButton
              variant="outline"
              label={t('sent.trackOnChain')}
              onPress={() =>
                WebBrowser.openBrowserAsync(
                  `${webExplorerUrl}/tx/${txBuilderResult.txDetails.txid}`
                )
              }
            />
            <SSButton
              variant="secondary"
              label={t('common.backToAccountHome')}
              onPress={() => handleBackToHome()}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
