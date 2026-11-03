import { Stack } from 'expo-router'
import { StyleSheet } from 'react-native'

import SSAmountDisplay from '@/components/SSAmountDisplay'
import SSDesignSection from '@/components/SSDesignSection'
import SSSeparator from '@/components/SSSeparator'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import {
  DESIGN_SAMPLE_ADDRESS,
  DESIGN_SAMPLE_AMOUNT,
  DESIGN_SAMPLE_FINGERPRINT,
  DESIGN_SAMPLE_LARGE_AMOUNT,
  DESIGN_SAMPLE_SEED_WORDS,
  DESIGN_SAMPLE_SMALL_AMOUNT,
  DESIGN_SAMPLE_TXID,
  DESIGN_SAMPLE_XPUB
} from '@/constants/designSystem'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import {
  textSizesAscending,
  textWeightsAscending
} from '@/utils/designTypography'

const tn = _tn('settings.developer.designSystem.typography')

const TEXT_SIZES = textSizesAscending()
const TEXT_WEIGHTS = textWeightsAscending()
const SAMPLE_TEXT = 'Satsigner 21M'
const PADDING_AMOUNTS = [
  0,
  DESIGN_SAMPLE_SMALL_AMOUNT,
  DESIGN_SAMPLE_AMOUNT,
  DESIGN_SAMPLE_LARGE_AMOUNT
]
const AMOUNT_SIZE_MIN_PX = 12
const AMOUNT_SIZES = TEXT_SIZES.filter(({ px }) => px >= AMOUNT_SIZE_MIN_PX)
const SEED_WORD_COLUMNS = 3

type TokenRowProps = {
  token: string
  children: React.ReactNode
}

function TokenRow({ token, children }: TokenRowProps) {
  return (
    <SSVStack gap="xxs">
      <SSText size="xxs" color="muted" type="mono">
        {token}
      </SSText>
      {children}
    </SSVStack>
  )
}

export default function DesignTypography() {
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      <SSMainLayout>
        <SSScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <SSVStack gap="xl">
            <SSDesignSection title={tn('sizes')}>
              <SSVStack gap="md">
                {TEXT_SIZES.map(({ size, px }) => (
                  <TokenRow key={size} token={`size="${size}" · ${px}px`}>
                    <SSText size={size} numberOfLines={1}>
                      {SAMPLE_TEXT}
                    </SSText>
                  </TokenRow>
                ))}
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('weights')}>
              <SSVStack gap="md">
                {TEXT_WEIGHTS.map(({ weight, value }) => (
                  <TokenRow
                    key={weight}
                    token={`weight="${weight}" · ${value}`}
                  >
                    <SSText size="2xl" weight={weight}>
                      {SAMPLE_TEXT}
                    </SSText>
                  </TokenRow>
                ))}
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('mono')}>
              <SSVStack gap="md">
                <TokenRow token={t('bitcoin.address')}>
                  <SSText
                    type="mono"
                    size="sm"
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {DESIGN_SAMPLE_ADDRESS}
                  </SSText>
                </TokenRow>
                <TokenRow token="txid">
                  <SSText
                    type="mono"
                    size="sm"
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {DESIGN_SAMPLE_TXID}
                  </SSText>
                </TokenRow>
                <TokenRow token="xpub">
                  <SSText type="mono" size="xs" color="muted">
                    {DESIGN_SAMPLE_XPUB}
                  </SSText>
                </TokenRow>
                <TokenRow token="fingerprint">
                  <SSText type="mono" size="lg">
                    {DESIGN_SAMPLE_FINGERPRINT}
                  </SSText>
                </TokenRow>
                <TokenRow token="seed words">
                  <SSHStack gap="none" style={styles.seedGrid}>
                    {DESIGN_SAMPLE_SEED_WORDS.map((word, index) => (
                      <SSHStack key={word} gap="xs" style={styles.seedCell}>
                        <SSText type="mono" size="xs" color="muted">
                          {String(index + 1).padStart(2, '0')}
                        </SSText>
                        <SSText type="mono" size="md">
                          {word}
                        </SSText>
                      </SSHStack>
                    ))}
                  </SSHStack>
                </TokenRow>
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('monoWeights')}>
              <SSVStack gap="md">
                {TEXT_WEIGHTS.map(({ weight }) => (
                  <TokenRow
                    key={weight}
                    token={`type="mono" weight="${weight}"`}
                  >
                    <SSText type="mono" size="xl" weight={weight}>
                      {DESIGN_SAMPLE_FINGERPRINT}
                    </SSText>
                  </TokenRow>
                ))}
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('modifiers')}>
              <SSVStack gap="md">
                <TokenRow token='color="white"'>
                  <SSText size="md">{SAMPLE_TEXT}</SSText>
                </TokenRow>
                <TokenRow token='color="muted"'>
                  <SSText size="md" color="muted">
                    {SAMPLE_TEXT}
                  </SSText>
                </TokenRow>
                <TokenRow token="uppercase">
                  <SSText size="md" uppercase>
                    {SAMPLE_TEXT}
                  </SSText>
                </TokenRow>
                <TokenRow token="center">
                  <SSText size="md" center>
                    {SAMPLE_TEXT}
                  </SSText>
                </TokenRow>
                <TokenRow token='numberOfLines={1} ellipsizeMode="middle"'>
                  <SSText size="md" numberOfLines={1} ellipsizeMode="middle">
                    {DESIGN_SAMPLE_XPUB}
                  </SSText>
                </TokenRow>
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('amountSizes')}>
              <SSVStack gap="md">
                {AMOUNT_SIZES.map(({ size }) => (
                  <TokenRow key={size} token={`textSize="${size}"`}>
                    <SSStyledSatText
                      amount={DESIGN_SAMPLE_AMOUNT}
                      textSize={size}
                    />
                  </TokenRow>
                ))}
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('amountPadding')}>
              <SSHStack gap="md" style={styles.paddingHeader}>
                <SSText size="xxs" color="muted" style={styles.paddingColumn}>
                  {tn('paddingOff')}
                </SSText>
                <SSText size="xxs" color="muted" style={styles.paddingColumn}>
                  {tn('paddingOn')}
                </SSText>
              </SSHStack>
              <SSVStack gap="md">
                {PADDING_AMOUNTS.map((amount) => (
                  <SSHStack key={amount} gap="md">
                    <SSVStack style={styles.paddingColumn}>
                      <SSStyledSatText amount={amount} textSize="lg" />
                    </SSVStack>
                    <SSVStack style={styles.paddingColumn}>
                      <SSStyledSatText
                        amount={amount}
                        textSize="lg"
                        useZeroPadding
                      />
                    </SSVStack>
                  </SSHStack>
                ))}
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('amountUnits')}>
              <SSVStack gap="md">
                <TokenRow token='currency="sats"'>
                  <SSHStack gap="xs" style={styles.baseline}>
                    <SSAmountDisplay
                      privacyMode={false}
                      amount={DESIGN_SAMPLE_AMOUNT}
                      currency="sats"
                      textSize="2xl"
                    />
                  </SSHStack>
                </TokenRow>
                <TokenRow token='currency="btc"'>
                  <SSHStack gap="xs" style={styles.baseline}>
                    <SSAmountDisplay
                      privacyMode={false}
                      amount={DESIGN_SAMPLE_AMOUNT}
                      currency="btc"
                      textSize="2xl"
                    />
                  </SSHStack>
                </TokenRow>
                <TokenRow token="decimals={2}">
                  <SSStyledSatText
                    amount={DESIGN_SAMPLE_SMALL_AMOUNT / 100}
                    decimals={2}
                    textSize="2xl"
                  />
                </TokenRow>
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('amountDirection')}>
              <SSVStack gap="md">
                <TokenRow token='type="send" noColor={false}'>
                  <SSStyledSatText
                    amount={DESIGN_SAMPLE_AMOUNT}
                    type="send"
                    noColor={false}
                    textSize="2xl"
                  />
                </TokenRow>
                <TokenRow token='type="send" showSign={false}'>
                  <SSStyledSatText
                    amount={DESIGN_SAMPLE_AMOUNT}
                    type="send"
                    noColor={false}
                    showSign={false}
                    textSize="2xl"
                  />
                </TokenRow>
                <TokenRow token='type="send" useZeroPadding'>
                  <SSStyledSatText
                    amount={DESIGN_SAMPLE_AMOUNT}
                    type="send"
                    noColor={false}
                    useZeroPadding
                    textSize="2xl"
                  />
                </TokenRow>
                <TokenRow token='type="receive" noColor={false}'>
                  <SSStyledSatText
                    amount={DESIGN_SAMPLE_AMOUNT}
                    type="receive"
                    noColor={false}
                    textSize="2xl"
                  />
                </TokenRow>
                <TokenRow token='type="receive" useZeroPadding'>
                  <SSStyledSatText
                    amount={DESIGN_SAMPLE_AMOUNT}
                    type="receive"
                    noColor={false}
                    useZeroPadding
                    textSize="2xl"
                  />
                </TokenRow>
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('amountWeights')}>
              <SSVStack gap="md">
                {TEXT_WEIGHTS.map(({ weight }) => (
                  <TokenRow key={weight} token={`weight="${weight}"`}>
                    <SSStyledSatText
                      amount={DESIGN_SAMPLE_AMOUNT}
                      weight={weight}
                      textSize="3xl"
                    />
                  </TokenRow>
                ))}
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('amountPrivacy')}>
              <SSVStack gap="md">
                <TokenRow token="privacyMode={false}">
                  <SSHStack gap="xs" style={styles.baseline}>
                    <SSAmountDisplay
                      privacyMode={false}
                      amount={DESIGN_SAMPLE_AMOUNT}
                      textSize="4xl"
                      unitSize="xl"
                    />
                  </SSHStack>
                </TokenRow>
                <TokenRow token="privacyMode">
                  <SSHStack gap="xs" style={styles.baseline}>
                    <SSAmountDisplay
                      privacyMode
                      amount={DESIGN_SAMPLE_AMOUNT}
                      textSize="4xl"
                      unitSize="xl"
                    />
                  </SSHStack>
                </TokenRow>
              </SSVStack>
            </SSDesignSection>
          </SSVStack>
        </SSScrollView>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  baseline: {
    alignItems: 'baseline'
  },
  paddingColumn: {
    flex: 1
  },
  paddingHeader: {
    marginBottom: 4
  },
  scroll: {
    paddingBottom: 64
  },
  seedCell: {
    paddingVertical: 4,
    width: `${100 / SEED_WORD_COLUMNS}%`
  },
  seedGrid: {
    flexWrap: 'wrap'
  }
})
