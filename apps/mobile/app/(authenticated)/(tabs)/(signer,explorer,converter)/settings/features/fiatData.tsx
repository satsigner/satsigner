import { Stack } from 'expo-router'
import { StyleSheet } from 'react-native'

import { getLocalPriceCoverage } from '@/api/localPrices'
import SSCheckbox from '@/components/SSCheckbox'
import SSCollapsible from '@/components/SSCollapsible'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import {
  CURRENT_PRICES_RESPONSE,
  DEFAULT_FIAT_PRICE_API_URL,
  HISTORICAL_PRICE_RESPONSE
} from '@/constants/fiatPriceApi'
import { useFiatData } from '@/hooks/useFiatData'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { tn } from '@/locales'
import { usePriceStore } from '@/store/price'
import { normalizeFiatPriceApiUrl } from '@/utils/fiat'
import { formatDate } from '@/utils/format'

const tl = tn('settings.features.fiatData')

export default function FiatData() {
  const {
    customFiatPriceApiUrl,
    fetchCurrentPrices,
    fetchHistoricalPrices,
    fetchHistoricalPricesFromNetwork,
    fiatPriceProvider,
    setCustomFiatPriceApiUrl,
    setFetchCurrentPrices,
    setFetchHistoricalPrices,
    setFetchHistoricalPricesFromNetwork,
    setFiatPriceProvider
  } = useFiatData()
  const fiatCurrency = usePriceStore((state) => state.fiatCurrency)

  function selectMempool() {
    setFiatPriceProvider('mempool')
  }

  function selectCustom() {
    setFiatPriceProvider('custom')
  }

  function normalizeCustomUrl() {
    setCustomFiatPriceApiUrl(normalizeFiatPriceApiUrl(customFiatPriceApiUrl))
  }

  function toggleFetchCurrentPrices() {
    setFetchCurrentPrices(!fetchCurrentPrices)
  }

  function toggleFetchHistoricalPrices() {
    setFetchHistoricalPrices(!fetchHistoricalPrices)
  }

  function toggleFetchHistoricalPricesFromNetwork() {
    setFetchHistoricalPricesFromNetwork(!fetchHistoricalPricesFromNetwork)
  }

  const isMempool = fiatPriceProvider === 'mempool'
  const isCustom = fiatPriceProvider === 'custom'
  const providerName = isMempool
    ? tl('provider.mempool')
    : tl('provider.custom')
  const coverage = getLocalPriceCoverage(fiatCurrency)

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => <SSText uppercase>{tl('title')}</SSText>
        }}
      />
      <SSMainLayout>
        <SSScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SSVStack gap="lg">
            <SSVStack gap="sm">
              <SSText weight="medium">{tl('current.title')}</SSText>
              <SSText color="muted" size="sm">
                {tl('current.description')}
              </SSText>
              <SSCheckbox
                label={tl('current.toggle')}
                selected={fetchCurrentPrices}
                onPress={toggleFetchCurrentPrices}
              />
              <SSText color="muted" size="xs">
                {tl('current.source', { provider: providerName })}
              </SSText>
            </SSVStack>
            <SSVStack gap="sm">
              <SSText weight="medium">{tl('historical.title')}</SSText>
              <SSText color="muted" size="sm">
                {tl('historical.description')}
              </SSText>
              <SSCheckbox
                label={tl('historical.toggle')}
                selected={fetchHistoricalPrices}
                onPress={toggleFetchHistoricalPrices}
              />
              {fetchHistoricalPrices ? (
                <SSVStack gap="sm" style={styles.indented}>
                  <SSVStack gap="xxs">
                    <SSText size="sm">{tl('historical.onDevice.title')}</SSText>
                    <SSText color="muted" size="xs">
                      {coverage
                        ? tl('historical.onDevice.coverage', {
                            first: formatDate(coverage.first),
                            last: formatDate(coverage.last)
                          })
                        : tl('historical.onDevice.private')}
                    </SSText>
                  </SSVStack>
                  <SSCheckbox
                    label={tl('historical.network.toggle', {
                      provider: providerName
                    })}
                    onPress={toggleFetchHistoricalPricesFromNetwork}
                    selected={fetchHistoricalPricesFromNetwork}
                  />
                  <SSText color="muted" size="xs">
                    {tl('historical.network.warning')}
                  </SSText>
                </SSVStack>
              ) : null}
            </SSVStack>
            <SSVStack gap="sm">
              <SSText weight="medium">{tl('provider.title')}</SSText>
              <SSText color="muted" size="sm">
                {tl('provider.description')}
              </SSText>
              <SSCheckbox
                label={tl('provider.mempool')}
                selected={isMempool}
                onPress={selectMempool}
              />
              {isMempool ? (
                <SSText color="muted" size="xs" style={styles.providerUrl}>
                  {DEFAULT_FIAT_PRICE_API_URL}
                </SSText>
              ) : null}
              <SSCheckbox
                label={tl('provider.custom')}
                selected={isCustom}
                onPress={selectCustom}
              />
              {isCustom ? (
                <SSVStack gap="sm" style={styles.customProvider}>
                  <SSTextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    onBlur={normalizeCustomUrl}
                    onChangeText={setCustomFiatPriceApiUrl}
                    placeholder={tl('provider.customPlaceholder')}
                    value={customFiatPriceApiUrl}
                  />
                  <SSText color="muted" size="xs">
                    {tl('apiUrlHint')}
                  </SSText>
                  <SSCollapsible>
                    <SSVStack gap="md" style={styles.apiFormat}>
                      <SSVStack gap="xs">
                        <SSText size="sm">
                          {tl('apiFormat.currentPrices')}
                        </SSText>
                        <SSText color="muted" size="xs" type="mono">
                          {CURRENT_PRICES_RESPONSE}
                        </SSText>
                      </SSVStack>
                      <SSVStack gap="xs">
                        <SSText size="sm">
                          {tl('apiFormat.historicalPrices')}
                        </SSText>
                        <SSText color="muted" size="xs" type="mono">
                          {HISTORICAL_PRICE_RESPONSE}
                        </SSText>
                      </SSVStack>
                    </SSVStack>
                  </SSCollapsible>
                </SSVStack>
              ) : null}
            </SSVStack>
          </SSVStack>
        </SSScrollView>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  apiFormat: {
    paddingTop: 8,
    width: '100%'
  },
  customProvider: {
    paddingLeft: 8,
    width: '100%'
  },
  indented: {
    paddingLeft: 8
  },
  providerUrl: {
    paddingLeft: 8
  }
})
