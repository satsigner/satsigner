import { TouchableOpacity } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type Account } from '@/types/models/Account'
import { formatNumber } from '@/utils/format'

import { SSIconChevronRight, SSIconEyeOn } from './icons'
import SSStyledSatText from './SSStyledSatText'
import SSText from './SSText'

type SSAccountCardProps = {
  account: Account
  onPress(): void
}

function SSAccountCard({ account, onPress }: SSAccountCardProps) {
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )
  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)

  return (
    <TouchableOpacity activeOpacity={0.5} onPress={() => onPress()}>
      <SSHStack justifyBetween>
        <SSVStack gap="none">
          <SSText size="xs" style={{ color: Colors.gray[500], lineHeight: 10 }}>
            {account.fingerprint}
          </SSText>
          <SSHStack gap="sm">
            <SSText size="lg" color="muted">
              {account.name}
            </SSText>
            {account.watchOnly && <SSIconEyeOn height={16} width={16} />}
          </SSHStack>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSText size="3xl" color="white" style={{ lineHeight: 24 }}>
              <SSStyledSatText
                amount={account?.summary.balance || 0}
                decimals={0}
                useZeroPadding={useZeroPadding}
                textSize="3xl"
                weight="light"
                letterSpacing={-1}
              />
            </SSText>
            <SSText size="xl" color="muted">
              {t('bitcoin.sats').toLowerCase()}
            </SSText>
          </SSHStack>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSText color="muted">
              {formatNumber(satsToFiat(account.summary.balance), 2)}
            </SSText>
            <SSText size="xs" style={{ color: Colors.gray[500] }}>
              {fiatCurrency}
            </SSText>
          </SSHStack>
          <SSHStack style={{ marginTop: 8 }}>
            <SSVStack gap="none">
              <SSText color="white" size="md">
                {formatNumber(account.summary.numberOfAddresses)}
              </SSText>
              <SSText size="xs" color="muted">
                {t('accounts.childAccounts.0')}
                {'\n'}
                {t('accounts.childAccounts.1')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText color="white" size="md">
                {formatNumber(account.summary.numberOfTransactions)}
              </SSText>
              <SSText size="xs" color="muted">
                {t('accounts.totalTransactions.0')}
                {'\n'}
                {t('accounts.totalTransactions.1')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText color="white" size="md">
                {formatNumber(account.summary.numberOfUtxos)}
              </SSText>
              <SSText size="xs" color="muted">
                {t('accounts.spendableOutputs.0')}
                {'\n'}
                {t('accounts.spendableOutputs.1')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText color="white" size="md">
                {formatNumber(account.summary.satsInMempool)}
              </SSText>
              <SSText size="xs" color="muted">
                {t('accounts.satsInMempool.0')}
                {'\n'}
                {t('accounts.satsInMempool.1')}
              </SSText>
            </SSVStack>
          </SSHStack>
        </SSVStack>
        <SSIconChevronRight height={11.6} width={6} />
      </SSHStack>
    </TouchableOpacity>
  )
}

export default SSAccountCard
