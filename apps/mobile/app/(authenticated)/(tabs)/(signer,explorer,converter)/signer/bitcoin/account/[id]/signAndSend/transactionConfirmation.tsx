import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSSuccessCheckAnimation from '@/components/SSSuccessCheckAnimation'
import SSText from '@/components/SSText'
import { TXID_HEX_PATTERN } from '@/constants/btc'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type TransactionConfirmationSearchParams } from '@/types/navigation/searchParams'
import { formatAddress } from '@/utils/format'

const TITLE_DELAY_MS = 350
const DETAILS_DELAY_MS = 550
const BUTTON_DELAY_MS = 700

export default function TransactionConfirmation() {
  const router = useRouter()
  const { arkAccountId, id, txid } =
    useLocalSearchParams<TransactionConfirmationSearchParams>()
  const [externalWarningModalVisible, setExternalWarningModalVisible] =
    useState(false)

  const account = useAccountsStore((state) =>
    state.accounts.find((entry) => entry.id === id)
  )
  const mempoolConfig = useBlockchainStore((state) => state.configsMempool)

  const isArkBoardFunding = Boolean(arkAccountId)
  const isValidTxid = TXID_HEX_PATTERN.test(txid)
  const mempoolServerUrl = account ? mempoolConfig[account.network] : ''
  const mempoolTxUrl =
    mempoolServerUrl && isValidTxid
      ? `${mempoolServerUrl.replace(/\/api\/?$/, '')}/tx/${txid}`
      : ''

  function handleViewOnMempool() {
    setExternalWarningModalVisible(true)
  }

  function handleOpenExternalWebsite() {
    if (mempoolTxUrl) {
      WebBrowser.openBrowserAsync(mempoolTxUrl)
    }
    setExternalWarningModalVisible(false)
  }

  function handleBackToHome() {
    router.dismissAll()
    router.navigate(`/signer/bitcoin/account/${id}`)
  }

  function handleOpenArkAccount() {
    if (!arkAccountId) {
      return
    }
    router.dismissAll()
    router.navigate(`/signer/ark/account/${arkAccountId}`)
  }

  if (!account || !isValidTxid) {
    return <Redirect href="/" />
  }

  return (
    <>
      <SSMainLayout style={{ paddingBottom: 32 }}>
        <SSVStack justifyBetween>
          <SSVStack gap="lg" itemsCenter>
            <SSSuccessCheckAnimation />
            <Animated.View
              entering={FadeInDown.delay(TITLE_DELAY_MS).duration(450)}
            >
              <SSText size="md" uppercase weight="light">
                {t('sent.broadcasted')}
              </SSText>
            </Animated.View>
            <Animated.View
              entering={FadeIn.delay(DETAILS_DELAY_MS).duration(400)}
            >
              <SSVStack gap="none" itemsCenter>
                <SSText color="muted" uppercase>
                  {t('transaction.id')}
                </SSText>
                <SSText>{formatAddress(txid)}</SSText>
              </SSVStack>
            </Animated.View>
            {isArkBoardFunding && (
              <Animated.View
                entering={FadeIn.delay(DETAILS_DELAY_MS).duration(400)}
              >
                <SSText color="muted" center>
                  {t('ark.board.fundingBroadcastedHint')}
                </SSText>
              </Animated.View>
            )}
          </SSVStack>
          <Animated.View entering={FadeIn.delay(BUTTON_DELAY_MS).duration(300)}>
            <SSVStack>
              <SSClipboardCopy text={txid}>
                <SSButton
                  variant="outline"
                  label={t('sent.copyTransactionId')}
                />
              </SSClipboardCopy>
              <SSButton
                variant="outline"
                label={t('sent.viewOnMempool')}
                onPress={handleViewOnMempool}
              />
              {isArkBoardFunding && (
                <SSButton
                  variant="secondary"
                  label={t('ark.board.openArkAccount')}
                  onPress={handleOpenArkAccount}
                />
              )}
              <SSButton
                variant={isArkBoardFunding ? 'outline' : 'secondary'}
                label={t('common.backToAccountHome')}
                onPress={handleBackToHome}
              />
            </SSVStack>
          </Animated.View>
        </SSVStack>
      </SSMainLayout>
      <SSModal
        fullOpacity
        visible={externalWarningModalVisible}
        label=""
        onClose={() => setExternalWarningModalVisible(false)}
      >
        <SSVStack justifyBetween style={{ flex: 1, width: '100%' }}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <SSVStack gap="lg" style={{ alignItems: 'center' }}>
              <SSText uppercase weight="bold">
                {t('common.warning')}
              </SSText>
              <SSText color="muted" center>
                {t('sent.externalWebsiteWarning')}
              </SSText>
            </SSVStack>
          </View>
          <SSVStack gap="md">
            <SSButton
              variant="danger"
              label={t('common.open')}
              onPress={handleOpenExternalWebsite}
            />
            <SSButton
              variant="ghost"
              label={t('common.cancel')}
              onPress={() => setExternalWarningModalVisible(false)}
            />
          </SSVStack>
        </SSVStack>
      </SSModal>
    </>
  )
}
