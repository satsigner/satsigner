import { TouchableOpacity } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { type Account } from '@/types/models/Account'
import { formatNumber } from '@/utils/format'

import { SSIconChevronRight } from './icons'
import SSText from './SSText'
import { useAccountsStore } from '@/store/accounts'
import SSStyledSatText from './SSStyledSatText'

type SSAccountCardProps = {
  account: Account
  onPress(): void
}

export default function SSAccountCard({
  account,
  onPress
}: SSAccountCardProps) {
  const priceStore = usePriceStore()
  const padding = useAccountsStore((state) => state.padding)

  return (
    <TouchableOpacity activeOpacity={0.5} onPress={() => onPress()}>
      <SSHStack justifyBetween>
        <SSVStack gap="none">
          <SSText size="xs" style={{ color: Colors.gray[500], lineHeight: 10 }}>
            {account.fingerprint}
          </SSText>
          <SSText size="lg" color="muted">
            {account.name}
          </SSText>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSText size="3xl" color="white" style={{ lineHeight: 24 }}>
              <SSStyledSatText
                amount={account?.summary.balance || 0}
                decimals={0}
                padding={padding}
                textSize="3xl"
              />
            </SSText>
            <SSText size="xl" color="muted">
              {i18n.t('bitcoin.sats').toLowerCase()}
            </SSText>
          </SSHStack>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSText color="muted">
              {formatNumber(priceStore.satsToFiat(account.summary.balance), 2)}
            </SSText>
            <SSText size="xs" style={{ color: Colors.gray[500] }}>
              {priceStore.fiatCurrency}
            </SSText>
          </SSHStack>
          <SSHStack style={{ marginTop: 8 }}>
            <SSVStack gap="none">
              <SSText color="white" size="md">
                {formatNumber(account.summary.numberOfAddresses)}
              </SSText>
              <SSText size="xs" color="muted">
                {i18n.t('accountList.childAccounts.0')}
                {'\n'}
                {i18n.t('accountList.childAccounts.1')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText color="white" size="md">
                {formatNumber(account.summary.numberOfTransactions)}
              </SSText>
              <SSText size="xs" color="muted">
                {i18n.t('accountList.totalTransactions.0')}
                {'\n'}
                {i18n.t('accountList.totalTransactions.1')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText color="white" size="md">
                {formatNumber(account.summary.numberOfUtxos)}
              </SSText>
              <SSText size="xs" color="muted">
                {i18n.t('accountList.spendableOutputs.0')}
                {'\n'}
                {i18n.t('accountList.spendableOutputs.1')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText color="white" size="md">
                {formatNumber(account.summary.satsInMempool)}
              </SSText>
              <SSText size="xs" color="muted">
                {i18n.t('accountList.satsInMempool.0')}
                {'\n'}
                {i18n.t('accountList.satsInMempool.1')}
              </SSText>
            </SSVStack>
          </SSHStack>
        </SSVStack>
        <SSIconChevronRight height={11.6} width={6} />
      </SSHStack>
    </TouchableOpacity>
  )
}
