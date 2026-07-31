import { Stack } from 'expo-router'
import { StyleSheet } from 'react-native'

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
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { tn } from '@/locales'

const tl = tn('settings.features.fiatData')

const DATA_AVAILABLE_KEYS = [
  'currentSpotPrices',
  'crossCurrencyRates',
  'historicalPriceAtTimestamp'
] as const

const monoTextStyle = { fontFamily: 'monospace' as const }

export default function FiatData() {
  const {
    customFiatPriceApiUrl,
    fetchCurrentPrices,
    fetchHistoricalPrices,
    fiatPriceProvider,
    setCustomFiatPriceApiUrl,
    setFetchCurrentPrices,
    setFetchHistoricalPrices,
    setFiatPriceProvider
  } = useFiatData()

  function selectMempool() {
    setFiatPriceProvider('mempool')
  }

  function selectCustom() {
    setFiatPriceProvider('custom')
  }

  function toggleFetchCurrentPrices() {
    setFetchCurrentPrices(!fetchCurrentPrices)
  }

  function toggleFetchHistoricalPrices() {
    setFetchHistoricalPrices(!fetchHistoricalPrices)
  }

  const isMempool = fiatPriceProvider === 'mempool'
  const isCustom = fiatPriceProvider === 'custom'

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
              <SSText>{tl('fetching.title')}</SSText>
              <SSCheckbox
                label={tl('fetchCurrentPrices')}
                selected={fetchCurrentPrices}
                onPress={toggleFetchCurrentPrices}
              />
              <SSCheckbox
                label={tl('fetchHistoricalPrices')}
                selected={fetchHistoricalPrices}
                onPress={toggleFetchHistoricalPrices}
              />
              <SSText color="muted" size="sm">
                {tl('disclaimer')}
              </SSText>
            </SSVStack>
            <SSFormLayout>
              <SSFormLayout.Item>
                <SSFormLayout.Label label={tl('priceProvider')} />
                <SSVStack gap="sm">
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
                            <SSText
                              color="muted"
                              size="xs"
                              style={monoTextStyle}
                            >
                              {CURRENT_PRICES_RESPONSE}
                            </SSText>
                          </SSVStack>
                          <SSVStack gap="xs">
                            <SSText size="sm">
                              {tl('apiFormat.historicalPrices')}
                            </SSText>
                            <SSText
                              color="muted"
                              size="xs"
                              style={monoTextStyle}
                            >
                              {HISTORICAL_PRICE_RESPONSE}
                            </SSText>
                          </SSVStack>
                        </SSVStack>
                      </SSCollapsible>
                    </SSVStack>
                  ) : null}
                </SSVStack>
              </SSFormLayout.Item>
            </SSFormLayout>
            <SSVStack gap="sm">
              <SSText>{tl('dataAvailable.title')}</SSText>
              {DATA_AVAILABLE_KEYS.map((key) => (
                <SSText key={key} color="muted" size="sm">
                  • {tl(`dataAvailable.${key}`)}
                </SSText>
              ))}
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
  providerUrl: {
    paddingLeft: 8
  }
})
