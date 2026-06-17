import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import {
  SSIconBitcoin,
  SSIconKeys,
  SSIconLightning,
  SSIconLock,
  SSIconNetwork,
  SSIconQR,
  SSIconScan,
  SSIconSeed,
  SSIconSettings,
  SSIconWarning
} from '@/components/icons'
import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSCollapsible from '@/components/SSCollapsible'
import SSConnectionStatusIndicator from '@/components/SSConnectionStatusIndicator'
import SSDetailsList from '@/components/SSDetailsList'
import SSLoader from '@/components/SSLoader'
import SSModal from '@/components/SSModal'
import SSNumberInput from '@/components/SSNumberInput'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSRadioButton from '@/components/SSRadioButton'
import SSSeparator from '@/components/SSSeparator'
import SSSettingsCard from '@/components/SSSettingsCard'
import SSSlider from '@/components/SSSlider'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

const PLACEHOLDER_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
const PLACEHOLDER_AMOUNT = 1_234_567
const PLACEHOLDER_SEED_WORDS = [
  'abandon',
  'ability',
  'able',
  'about',
  'above',
  'absent',
  'absorb',
  'abstract',
  'absurd',
  'abuse',
  'access',
  'accident'
]
const ICON_PREVIEW_SIZE = 24
const NOOP = () => {}

const PREVIEW_ICONS = [
  { Component: SSIconBitcoin, name: 'Bitcoin' },
  { Component: SSIconLightning, name: 'Lightning' },
  { Component: SSIconKeys, name: 'Keys' },
  { Component: SSIconSeed, name: 'Seed' },
  { Component: SSIconQR, name: 'QR' },
  { Component: SSIconScan, name: 'Scan' },
  { Component: SSIconNetwork, name: 'Network' },
  { Component: SSIconLock, name: 'Lock' },
  { Component: SSIconSettings, name: 'Settings' },
  { Component: SSIconWarning, name: 'Warning' }
]

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <SSVStack gap="sm">
      <SSText size="xs" color="muted" uppercase weight="medium">
        {title}
      </SSText>
      {children}
    </SSVStack>
  )
}

export default function Design() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [radioSelected, setRadioSelected] = useState<'a' | 'b'>('a')
  const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send')
  const [sliderValue, setSliderValue] = useState(5)
  const [modalVisible, setModalVisible] = useState(false)

  function handleToggleCheckbox() {
    setChecked((v) => !v)
  }

  function handleSelectA() {
    setRadioSelected('a')
  }

  function handleSelectB() {
    setRadioSelected('b')
  }

  function handleTabChange(tab: 'send' | 'receive') {
    setActiveTab(tab)
  }

  function handleSliderChange(value: number) {
    setSliderValue(value)
  }

  function handleOpenModal() {
    setModalVisible(true)
  }

  function handleCloseModal() {
    setModalVisible(false)
  }

  function handleNavigateToIcons() {
    router.navigate('/settings/icons')
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.developer.design')}</SSText>
          )
        }}
      />
      <SSMainLayout>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <SSVStack gap="xl">
            {/* ── Icons ── */}
            <Section title="Icons">
              <View style={styles.iconGrid}>
                {PREVIEW_ICONS.map(({ name, Component }) => (
                  <SSVStack
                    key={name}
                    gap="xxs"
                    itemsCenter
                    style={styles.iconCell}
                  >
                    <Component
                      width={ICON_PREVIEW_SIZE}
                      height={ICON_PREVIEW_SIZE}
                    />
                    <SSText size="2xxs" color="muted" center>
                      {name}
                    </SSText>
                  </SSVStack>
                ))}
              </View>
              <SSButton
                label={t('settings.developer.icons')}
                variant="outline"
                onPress={handleNavigateToIcons}
              />
            </Section>

            <SSSeparator />

            {/* ── Typography ── */}
            <Section title="Typography">
              <SSVStack gap="xs">
                <SSText size="5xl" weight="ultralight">
                  5xl ultralight
                </SSText>
                <SSText size="3xl" weight="light">
                  3xl light
                </SSText>
                <SSText size="2xl" weight="regular">
                  2xl regular
                </SSText>
                <SSText size="xl" weight="medium">
                  xl medium
                </SSText>
                <SSText size="lg" weight="bold">
                  lg bold
                </SSText>
                <SSText size="md" color="muted">
                  md muted
                </SSText>
                <SSText size="sm" color="muted">
                  sm muted
                </SSText>
                <SSText size="xs" color="muted" uppercase>
                  xs uppercase muted
                </SSText>
                <SSText size="md" type="mono">
                  mono — {PLACEHOLDER_ADDRESS.slice(0, 20)}…
                </SSText>
              </SSVStack>
            </Section>

            <SSSeparator />

            {/* ── Amounts ── */}
            <Section title="Amounts">
              <SSVStack gap="xs" itemsCenter>
                <SSStyledSatText amount={PLACEHOLDER_AMOUNT} />
                <SSStyledSatText
                  amount={PLACEHOLDER_AMOUNT}
                  type="send"
                  noColor={false}
                />
                <SSStyledSatText
                  amount={PLACEHOLDER_AMOUNT}
                  type="receive"
                  noColor={false}
                />
                <SSStyledSatText amount={0} />
                <SSStyledSatText
                  amount={PLACEHOLDER_AMOUNT}
                  currency="btc"
                  textSize="xl"
                />
              </SSVStack>
            </Section>

            <SSSeparator />

            {/* ── Buttons ── */}
            <Section title="Buttons">
              <SSVStack gap="xs">
                <SSButton label="Default" onPress={NOOP} />
                <SSButton
                  label="Secondary"
                  variant="secondary"
                  onPress={NOOP}
                />
                <SSButton label="Outline" variant="outline" onPress={NOOP} />
                <SSButton label="Ghost" variant="ghost" onPress={NOOP} />
                <SSButton label="Subtle" variant="subtle" onPress={NOOP} />
                <SSButton label="Gradient" variant="gradient" onPress={NOOP} />
                <SSButton label="Elevated" variant="elevated" onPress={NOOP} />
                <SSButton label="Danger" variant="danger" onPress={NOOP} />
                <SSButton label="Loading" loading onPress={NOOP} />
                <SSButton label="Disabled" disabled onPress={NOOP} />
                <SSButton label="With select" withSelect onPress={NOOP} />
              </SSVStack>
            </Section>

            <SSSeparator />

            {/* ── Text Input ── */}
            <Section title="Text Input">
              <SSVStack gap="xs">
                <SSTextInput placeholder="Default" />
                <SSTextInput variant="outline" placeholder="Outline" />
                <SSTextInput size="small" placeholder="Small" align="left" />
                <SSTextInput
                  placeholder="Valid"
                  status="valid"
                  value="Valid value"
                  onChangeText={NOOP}
                />
                <SSTextInput
                  placeholder="Invalid"
                  status="invalid"
                  error="This field is required"
                />
              </SSVStack>
            </Section>

            <SSSeparator />

            {/* ── Number Input ── */}
            <Section title="Number Input">
              <SSVStack gap="xs">
                <SSNumberInput
                  min={0}
                  max={100}
                  placeholder="0–100"
                  showFeedback
                />
                <SSNumberInput
                  min={1}
                  max={21000000}
                  placeholder="Sats (decimal)"
                  allowDecimal
                  variant="outline"
                />
              </SSVStack>
            </Section>

            <SSSeparator />

            {/* ── Slider ── */}
            <Section title="Slider">
              <SSSlider
                min={1}
                max={10}
                value={sliderValue}
                suffix="blocks"
                onValueChange={handleSliderChange}
              />
            </Section>

            <SSSeparator />

            {/* ── Checkbox ── */}
            <Section title="Checkbox">
              <SSVStack gap="xs">
                <SSCheckbox label="Unchecked" selected={false} onPress={NOOP} />
                <SSCheckbox label="Checked" selected={true} onPress={NOOP} />
                <SSCheckbox
                  label="Interactive"
                  selected={checked}
                  onPress={handleToggleCheckbox}
                />
              </SSVStack>
            </Section>

            <SSSeparator />

            {/* ── Radio Button ── */}
            <Section title="Radio Button">
              <SSVStack gap="xs">
                <SSHStack gap="sm">
                  <SSRadioButton
                    label="Option A"
                    selected={radioSelected === 'a'}
                    onPress={handleSelectA}
                  />
                  <SSRadioButton
                    label="Option B"
                    selected={radioSelected === 'b'}
                    onPress={handleSelectB}
                  />
                </SSHStack>
                <SSHStack gap="sm">
                  <SSRadioButton
                    variant="outline"
                    label="Outline A"
                    selected={radioSelected === 'a'}
                    onPress={handleSelectA}
                  />
                  <SSRadioButton
                    variant="outline"
                    label="Outline B"
                    selected={radioSelected === 'b'}
                    onPress={handleSelectB}
                  />
                </SSHStack>
              </SSVStack>
            </Section>

            <SSSeparator />

            {/* ── Paired Tabs ── */}
            <Section title="Paired Tabs">
              <SSPairedTabs
                activeTab={activeTab}
                primary={{ key: 'send', label: 'Send' }}
                secondary={{ key: 'receive', label: 'Receive' }}
                onChange={handleTabChange}
              />
              <SSText size="xs" color="muted">
                Active: {activeTab}
              </SSText>
            </Section>

            <SSSeparator />

            {/* ── Modal ── */}
            <Section title="Modal">
              <SSButton
                label="Open modal"
                variant="outline"
                onPress={handleOpenModal}
              />
            </Section>

            <SSSeparator />

            {/* ── Address Display ── */}
            <Section title="Address Display">
              <SSVStack gap="sm">
                <SSAddressDisplay address={PLACEHOLDER_ADDRESS} />
                <SSAddressDisplay
                  address={PLACEHOLDER_ADDRESS}
                  variant="outline"
                />
                <SSAddressDisplay
                  address={PLACEHOLDER_ADDRESS}
                  variant="bare"
                />
              </SSVStack>
            </Section>

            <SSSeparator />

            {/* ── Clipboard Copy ── */}
            <Section title="Clipboard Copy">
              <SSClipboardCopy text={PLACEHOLDER_ADDRESS}>
                <SSText size="sm" type="mono" color="muted">
                  Tap to copy address
                </SSText>
              </SSClipboardCopy>
            </Section>

            <SSSeparator />

            {/* ── Details List ── */}
            <Section title="Details List">
              <SSDetailsList
                columns={2}
                items={[
                  ['Block height', '893 412'],
                  ['Confirmations', '6'],
                  ['Fee rate', '12 sat/vB'],
                  ['Size', '141 vB'],
                  [
                    'Txid',
                    PLACEHOLDER_ADDRESS.slice(0, 16) + '…',
                    { variant: 'mono' }
                  ],
                  ['Network', 'mainnet']
                ]}
              />
            </Section>

            <SSSeparator />

            {/* ── Settings Card ── */}
            <Section title="Settings Card">
              <SSSettingsCard
                title="Network"
                description="Configure Electrum and Esplora servers"
                icon={<SSIconNetwork width={28} height={28} />}
                onPress={NOOP}
              />
              <SSSettingsCard
                title="Security"
                description="PIN, biometrics, and lock settings"
                icon={<SSIconLock width={28} height={28} />}
                onPress={NOOP}
              />
            </Section>

            <SSSeparator />

            {/* ── Connection Status ── */}
            <Section title="Connection Status Indicator">
              <SSHStack gap="lg">
                <SSVStack gap="xxs" itemsCenter>
                  <SSConnectionStatusIndicator
                    status="checking"
                    isPrivateConnection={false}
                  />
                  <SSText size="xs" color="muted">
                    checking
                  </SSText>
                </SSVStack>
                <SSVStack gap="xxs" itemsCenter>
                  <SSConnectionStatusIndicator
                    status="connected"
                    isPrivateConnection={false}
                  />
                  <SSText size="xs" color="muted">
                    public
                  </SSText>
                </SSVStack>
                <SSVStack gap="xxs" itemsCenter>
                  <SSConnectionStatusIndicator
                    status="connected"
                    isPrivateConnection={true}
                  />
                  <SSText size="xs" color="muted">
                    private
                  </SSText>
                </SSVStack>
                <SSVStack gap="xxs" itemsCenter>
                  <SSConnectionStatusIndicator
                    status="failed"
                    isPrivateConnection={false}
                  />
                  <SSText size="xs" color="muted">
                    failed
                  </SSText>
                </SSVStack>
              </SSHStack>
            </Section>

            <SSSeparator />

            {/* ── Collapsible ── */}
            <Section title="Collapsible">
              <SSCollapsible>
                {PLACEHOLDER_SEED_WORDS.map((word) => (
                  <SSText key={word} size="sm" style={styles.seedWord}>
                    {word}
                  </SSText>
                ))}
              </SSCollapsible>
            </Section>

            <SSSeparator />

            {/* ── Separator Variants ── */}
            <Section title="Separator">
              <SSVStack gap="md">
                <SSSeparator color="gradient" />
                <SSSeparator color="grayDark" />
              </SSVStack>
            </Section>

            <SSSeparator />

            {/* ── Loader ── */}
            <Section title="Loader">
              <SSHStack gap="lg">
                <SSLoader size={40} />
                <SSLoader size={60} />
                <SSLoader size={80} />
                <SSLoader size={40} color={Colors.mainGreen} />
                <SSLoader size={40} color={Colors.mainRed} />
              </SSHStack>
            </Section>
          </SSVStack>
        </ScrollView>
      </SSMainLayout>

      <SSModal visible={modalVisible} onClose={handleCloseModal} fullOpacity>
        <SSVStack gap="lg" itemsCenter>
          <SSText size="xl" weight="medium" uppercase>
            Modal title
          </SSText>
          <SSText color="muted" center>
            This is modal body content. Use SSModal for confirmations, warnings,
            and focused interactions.
          </SSText>
          <SSButton
            label="Confirm"
            variant="gradient"
            onPress={handleCloseModal}
          />
        </SSVStack>
      </SSModal>
    </>
  )
}

const styles = StyleSheet.create({
  iconCell: {
    paddingVertical: 8,
    width: '20%'
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12
  },
  scroll: {
    paddingBottom: 64
  },
  seedWord: {
    marginRight: 8
  }
})
