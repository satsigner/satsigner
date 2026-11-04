import { Stack } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  SSIconCamera,
  SSIconConverter,
  SSIconConverterActive,
  SSIconEyeOn,
  SSIconExplorer,
  SSIconExplorerActive,
  SSIconLock,
  SSIconNetwork,
  SSIconPasteClipboard,
  SSIconRefresh,
  SSIconScan,
  SSIconSigner,
  SSIconSignerActive
} from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSButton from '@/components/SSButton'
import SSButtonActionsGroup from '@/components/SSButtonActionsGroup'
import SSCheckbox from '@/components/SSCheckbox'
import SSChecksumStatus from '@/components/SSChecksumStatus'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSCollapsible from '@/components/SSCollapsible'
import SSConnectionStatusIndicator from '@/components/SSConnectionStatusIndicator'
import SSCurrencyInput from '@/components/SSCurrencyInput'
import SSDesignSection from '@/components/SSDesignSection'
import SSDetailsList from '@/components/SSDetailsList'
import SSDustWarningBanner from '@/components/SSDustWarningBanner'
import SSEcashLightningTabs from '@/components/SSEcashLightningTabs'
import SSFingerprint from '@/components/SSFingerprint'
import SSIconButton from '@/components/SSIconButton'
import SSLoader from '@/components/SSLoader'
import SSModal from '@/components/SSModal'
import SSNumberInput from '@/components/SSNumberInput'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSPressable from '@/components/SSPressable'
import SSQRCode from '@/components/SSQRCode'
import SSRadioButton from '@/components/SSRadioButton'
import SSSeparator from '@/components/SSSeparator'
import SSSettingsCard from '@/components/SSSettingsCard'
import SSSlider from '@/components/SSSlider'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSTagChip from '@/components/SSTagChip'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSTransactionIdFormatted from '@/components/SSTransactionIdFormatted'
import {
  DESIGN_SAMPLE_ADDRESS,
  DESIGN_SAMPLE_FINGERPRINT,
  DESIGN_SAMPLE_SEED_WORDS,
  DESIGN_SAMPLE_TAGS,
  DESIGN_SAMPLE_TXID,
  DESIGN_SAMPLE_UTXOS
} from '@/constants/designSystem'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { Colors } from '@/styles'

const tn = _tn('settings.developer.designSystem.components')

const ICON_SIZE = 20
const SETTINGS_CARD_ICON_SIZE = 24
const QR_SIZE = 160
const SLIDER_MIN = 1
const SLIDER_MAX = 10
const SLIDER_INITIAL = 5
const NUMBER_INPUT_MAX = 100
const SATS_INPUT_MAX = 21_000_000
const TABLE_INDEX_COLUMN_WIDTH = 28
const TABLE_AMOUNT_COLUMN_WIDTH = 110

const BOTTOM_NAV_ITEMS = [
  {
    ActiveIcon: SSIconExplorerActive,
    Icon: SSIconExplorer,
    key: 'explorer',
    labelKey: 'navigation.label.explorer'
  },
  {
    ActiveIcon: SSIconSignerActive,
    Icon: SSIconSigner,
    key: 'signer',
    labelKey: 'navigation.label.signer'
  },
  {
    ActiveIcon: SSIconConverterActive,
    Icon: SSIconConverter,
    key: 'converter',
    labelKey: 'navigation.label.converter'
  }
] as const

type BottomNavKey = (typeof BOTTOM_NAV_ITEMS)[number]['key']
type PairedTabKey = 'send' | 'receive' | 'tertiary'
type LayerTabKey = 'ecash' | 'lightning'

function NOOP() {
  // design preview only
}

type BottomNavItem = (typeof BOTTOM_NAV_ITEMS)[number]

type BottomNavPreviewItemProps = {
  item: BottomNavItem
  active: boolean
  onSelect: (key: BottomNavKey) => void
}

function BottomNavPreviewItem({
  item,
  active,
  onSelect
}: BottomNavPreviewItemProps) {
  const TabIcon = active ? item.ActiveIcon : item.Icon

  function handlePress() {
    onSelect(item.key)
  }

  return (
    <SSPressable
      onPress={handlePress}
      style={[styles.bottomNavItem, active && styles.bottomNavActive]}
    >
      <SSVStack gap="xxs" itemsCenter>
        <TabIcon />
        <SSText size="xxs" uppercase color={active ? 'white' : 'muted'}>
          {t(item.labelKey)}
        </SSText>
      </SSVStack>
    </SSPressable>
  )
}

type BottomNavPreviewProps = {
  active: BottomNavKey
  onChange: (key: BottomNavKey) => void
}

function BottomNavPreview({ active, onChange }: BottomNavPreviewProps) {
  return (
    <SSHStack gap="none" style={styles.bottomNav}>
      {BOTTOM_NAV_ITEMS.map((item) => (
        <BottomNavPreviewItem
          key={item.key}
          item={item}
          active={item.key === active}
          onSelect={onChange}
        />
      ))}
    </SSHStack>
  )
}

function UtxoTablePreview() {
  return (
    <SSVStack gap="none">
      <SSHStack gap="sm" style={styles.tableHeader}>
        <SSText size="xxs" color="muted" style={styles.tableIndex}>
          #
        </SSText>
        <SSText size="xxs" color="muted" uppercase style={styles.tableFlex}>
          {t('bitcoin.address')}
        </SSText>
        <SSText size="xxs" color="muted" uppercase style={styles.tableAmount}>
          {t('bitcoin.sats')}
        </SSText>
      </SSHStack>
      {DESIGN_SAMPLE_UTXOS.map((utxo, index) => (
        <SSHStack
          key={`${utxo.txid}:${utxo.vout}`}
          gap="sm"
          style={styles.tableRow}
        >
          <SSText size="xs" color="muted" style={styles.tableIndex}>
            {index}
          </SSText>
          <SSText
            size="xs"
            type="mono"
            numberOfLines={1}
            ellipsizeMode="middle"
            style={styles.tableFlex}
          >
            {utxo.addressTo}
          </SSText>
          <View style={styles.tableAmount}>
            <SSStyledSatText amount={utxo.value} textSize="sm" />
          </View>
        </SSHStack>
      ))}
    </SSVStack>
  )
}

export default function DesignComponents() {
  const [checked, setChecked] = useState(false)
  const [radioSelected, setRadioSelected] = useState<'a' | 'b'>('a')
  const [pairedTab, setPairedTab] = useState<PairedTabKey>('send')
  const [layerTab, setLayerTab] = useState<LayerTabKey>('lightning')
  const [bottomNav, setBottomNav] = useState<BottomNavKey>('signer')
  const [sliderValue, setSliderValue] = useState(SLIDER_INITIAL)
  const [modalVisible, setModalVisible] = useState(false)

  function handleToggleCheckbox() {
    setChecked((value) => !value)
  }

  function handleSelectA() {
    setRadioSelected('a')
  }

  function handleSelectB() {
    setRadioSelected('b')
  }

  function handleOpenModal() {
    setModalVisible(true)
  }

  function handleCloseModal() {
    setModalVisible(false)
  }

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
            <SSDesignSection title={tn('fields')}>
              <SSVStack gap="xs">
                <SSTextInput placeholder='variant="default"' />
                <SSTextInput
                  variant="outline"
                  placeholder='variant="outline"'
                />
                <SSTextInput
                  size="small"
                  align="left"
                  placeholder='size="small"'
                />
                <SSTextInput
                  placeholder="actionRight"
                  actionRight={
                    <SSIconButton onPress={NOOP}>
                      <SSIconScan width={ICON_SIZE} height={ICON_SIZE} />
                    </SSIconButton>
                  }
                />
                <SSTextInput
                  status="valid"
                  value='status="valid"'
                  onChangeText={NOOP}
                />
                <SSTextInput
                  status="invalid"
                  placeholder='status="invalid"'
                  error='error="…"'
                />
                <SSTextInput editable={false} value="editable={false}" />
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('numberFields')}>
              <SSVStack gap="xs">
                <SSNumberInput
                  min={0}
                  max={NUMBER_INPUT_MAX}
                  placeholder={`SSNumberInput 0–${NUMBER_INPUT_MAX}`}
                  showFeedback
                />
                <SSNumberInput
                  min={1}
                  max={SATS_INPUT_MAX}
                  placeholder="allowDecimal"
                  allowDecimal
                  variant="outline"
                />
                <SSCurrencyInput
                  placeholder="SSCurrencyInput"
                  onChangeValue={NOOP}
                />
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('buttons')}>
              <SSVStack gap="xs">
                <SSButton label='variant="default"' onPress={NOOP} />
                <SSButton
                  label='variant="secondary"'
                  variant="secondary"
                  onPress={NOOP}
                />
                <SSButton
                  label='variant="outline"'
                  variant="outline"
                  onPress={NOOP}
                />
                <SSButton
                  label='variant="ghost"'
                  variant="ghost"
                  onPress={NOOP}
                />
                <SSButton
                  label='variant="subtle"'
                  variant="subtle"
                  onPress={NOOP}
                />
                <SSButton
                  label='variant="gradient"'
                  variant="gradient"
                  onPress={NOOP}
                />
                <SSButton
                  label='variant="elevated"'
                  variant="elevated"
                  onPress={NOOP}
                />
                <SSButton
                  label='variant="danger"'
                  variant="danger"
                  onPress={NOOP}
                />
                <SSButton label="loading" loading onPress={NOOP} />
                <SSButton label="disabled" disabled onPress={NOOP} />
                <SSButton label="withSelect" withSelect onPress={NOOP} />
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('iconButtons')}>
              <SSHStack gap="lg">
                <SSIconButton onPress={NOOP}>
                  <SSIconRefresh width={ICON_SIZE} height={ICON_SIZE} />
                </SSIconButton>
                <SSIconButton rounded onPress={NOOP}>
                  <SSIconEyeOn width={ICON_SIZE} height={ICON_SIZE} />
                </SSIconButton>
                <SSIconButton onPress={NOOP}>
                  <SSIconPasteClipboard width={ICON_SIZE} height={ICON_SIZE} />
                </SSIconButton>
                <SSSortDirectionToggle onDirectionChanged={NOOP} />
                <SSSortDirectionToggle
                  label={t('bitcoin.sats')}
                  onDirectionChanged={NOOP}
                />
              </SSHStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('buttonSets')}>
              <SSVStack gap="md">
                <SSButtonActionsGroup
                  context="bitcoin"
                  onSend={NOOP}
                  onPaste={NOOP}
                  onCamera={NOOP}
                  onNFC={NOOP}
                  onReceive={NOOP}
                />
                <SSButtonActionsGroup
                  compact
                  context="bitcoin"
                  onSend={NOOP}
                  onCamera={NOOP}
                  onReceive={NOOP}
                />
                <SSHStack gap="sm">
                  <SSButton
                    label={t('common.cancel')}
                    variant="ghost"
                    style={styles.flex}
                    onPress={NOOP}
                  />
                  <SSButton
                    label={t('common.confirm')}
                    variant="secondary"
                    style={styles.flex}
                    onPress={NOOP}
                  />
                </SSHStack>
                <SSHStack gap="none">
                  <SSActionButton onPress={NOOP} style={styles.flex}>
                    <SSIconCamera width={18} height={13} />
                  </SSActionButton>
                  <SSActionButton onPress={NOOP} style={styles.flex}>
                    <SSIconScan width={ICON_SIZE} height={ICON_SIZE} />
                  </SSActionButton>
                </SSHStack>
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('tabs')}>
              <SSVStack gap="md">
                <SSPairedTabs
                  activeTab={pairedTab}
                  primary={{ key: 'send', label: t('ecash.transaction.send') }}
                  secondary={{
                    key: 'receive',
                    label: t('ecash.transaction.receive')
                  }}
                  onChange={setPairedTab}
                />
                <SSPairedTabs
                  activeTab={pairedTab}
                  primary={{ key: 'send', label: t('ecash.transaction.send') }}
                  secondary={{
                    key: 'receive',
                    label: t('ecash.transaction.receive')
                  }}
                  tertiary={{ key: 'tertiary', label: 'tertiary' }}
                  onChange={setPairedTab}
                />
                <SSEcashLightningTabs
                  activeTab={layerTab}
                  ecashLabel="ecash"
                  lightningLabel="lightning"
                  onChange={setLayerTab}
                />
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('bottomNav')}>
              <BottomNavPreview active={bottomNav} onChange={setBottomNav} />
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('tables')}>
              <SSVStack gap="lg">
                <UtxoTablePreview />
                <SSDetailsList
                  columns={2}
                  items={[
                    ['Block height', '893 412'],
                    ['Confirmations', '6'],
                    ['Fee rate', '12', { unit: 'sat/vB' }],
                    ['Size', '141', { unit: 'vB' }]
                  ]}
                />
                <SSDetailsList
                  columns={3}
                  items={[
                    ['Version', '2'],
                    ['Inputs', '1'],
                    ['Outputs', '2'],
                    ['Locktime', '0'],
                    ['Weight', '561'],
                    ['RBF', 'yes']
                  ]}
                />
                <SSDetailsList
                  columns={1}
                  items={[
                    ['Txid', DESIGN_SAMPLE_TXID, { variant: 'mono' }],
                    [
                      'Address',
                      DESIGN_SAMPLE_ADDRESS,
                      { copyToClipboard: true, variant: 'mono' }
                    ]
                  ]}
                />
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('selection')}>
              <SSVStack gap="sm">
                <SSCheckbox
                  label="selected={false}"
                  selected={false}
                  onPress={NOOP}
                />
                <SSCheckbox label="selected" selected onPress={NOOP} />
                <SSCheckbox
                  label="interactive"
                  selected={checked}
                  onPress={handleToggleCheckbox}
                />
                <SSHStack gap="sm">
                  <SSRadioButton
                    label="A"
                    selected={radioSelected === 'a'}
                    onPress={handleSelectA}
                  />
                  <SSRadioButton
                    label="B"
                    selected={radioSelected === 'b'}
                    onPress={handleSelectB}
                  />
                </SSHStack>
                <SSHStack gap="sm">
                  <SSRadioButton
                    variant="outline"
                    label='variant="outline" A'
                    selected={radioSelected === 'a'}
                    onPress={handleSelectA}
                  />
                  <SSRadioButton
                    variant="outline"
                    label='variant="outline" B'
                    selected={radioSelected === 'b'}
                    onPress={handleSelectB}
                  />
                </SSHStack>
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('slider')}>
              <SSSlider
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                value={sliderValue}
                suffix="blocks"
                onValueChange={setSliderValue}
              />
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('tags')}>
              <SSHStack gap="xs" style={styles.wrap}>
                {DESIGN_SAMPLE_TAGS.map((tag) => (
                  <SSTagChip key={tag} tag={tag} />
                ))}
              </SSHStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('display')}>
              <SSVStack gap="md">
                <SSAddressDisplay address={DESIGN_SAMPLE_ADDRESS} />
                <SSAddressDisplay
                  address={DESIGN_SAMPLE_ADDRESS}
                  variant="outline"
                />
                <SSAddressDisplay
                  address={DESIGN_SAMPLE_ADDRESS}
                  variant="bare"
                />
                <SSTransactionIdFormatted value={DESIGN_SAMPLE_TXID} />
                <SSClipboardCopy text={DESIGN_SAMPLE_ADDRESS}>
                  <SSText size="sm" type="mono" color="muted">
                    SSClipboardCopy
                  </SSText>
                </SSClipboardCopy>
                <SSHStack gap="lg">
                  <SSFingerprint fingerprint={DESIGN_SAMPLE_FINGERPRINT} />
                  <SSFingerprint
                    fingerprint={DESIGN_SAMPLE_FINGERPRINT}
                    withLabel
                    withColor
                  />
                </SSHStack>
                <SSVStack itemsCenter>
                  <SSQRCode value={DESIGN_SAMPLE_ADDRESS} size={QR_SIZE} />
                </SSVStack>
                <SSSettingsCard
                  title={t('settings.network.title')}
                  description={t('settings.network.description')}
                  icon={
                    <SSIconNetwork
                      width={SETTINGS_CARD_ICON_SIZE}
                      height={SETTINGS_CARD_ICON_SIZE}
                    />
                  }
                  onPress={NOOP}
                />
                <SSSettingsCard
                  title={t('settings.security.title')}
                  description={t('settings.security.description')}
                  icon={
                    <SSIconLock
                      width={SETTINGS_CARD_ICON_SIZE}
                      height={SETTINGS_CARD_ICON_SIZE}
                    />
                  }
                  onPress={NOOP}
                />
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('status')}>
              <SSVStack gap="md">
                <SSHStack gap="lg">
                  <SSConnectionStatusIndicator
                    status="checking"
                    isPrivateConnection={false}
                  />
                  <SSConnectionStatusIndicator
                    status="connected"
                    isPrivateConnection={false}
                  />
                  <SSConnectionStatusIndicator
                    status="connected"
                    isPrivateConnection
                  />
                  <SSConnectionStatusIndicator
                    status="failed"
                    isPrivateConnection={false}
                  />
                </SSHStack>
                <SSHStack gap="lg">
                  <SSChecksumStatus valid />
                  <SSChecksumStatus valid={false} />
                  <SSChecksumStatus valid="electrum" />
                </SSHStack>
                <SSDustWarningBanner message="SSDustWarningBanner" />
                <SSHStack gap="lg">
                  <SSLoader size={40} />
                  <SSLoader size={60} />
                  <SSLoader size={40} color={Colors.mainGreen} />
                  <SSLoader size={40} color={Colors.mainRed} />
                </SSHStack>
              </SSVStack>
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('overlays')}>
              <SSButton
                label={tn('openModal')}
                variant="outline"
                onPress={handleOpenModal}
              />
            </SSDesignSection>

            <SSSeparator />

            <SSDesignSection title={tn('layout')}>
              <SSVStack gap="md">
                <SSSeparator color="gradient" />
                <SSSeparator color="grayDark" />
                <SSCollapsible>
                  {DESIGN_SAMPLE_SEED_WORDS.map((word) => (
                    <SSText key={word} size="sm" style={styles.seedWord}>
                      {word}
                    </SSText>
                  ))}
                </SSCollapsible>
              </SSVStack>
            </SSDesignSection>
          </SSVStack>
        </SSScrollView>
      </SSMainLayout>

      <SSModal
        visible={modalVisible}
        title={tn('modalTitle')}
        onConfirm={handleCloseModal}
        onClose={handleCloseModal}
        fullOpacity
      >
        <SSText color="muted" center>
          {tn('modalBody')}
        </SSText>
      </SSModal>
    </>
  )
}

const styles = StyleSheet.create({
  bottomNav: {
    backgroundColor: Colors.gray[925],
    borderTopColor: Colors.gray[800],
    borderTopWidth: 1,
    paddingVertical: 8
  },
  bottomNavActive: {
    backgroundColor: Colors.gray[920]
  },
  bottomNavItem: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 10
  },
  flex: {
    flex: 1
  },
  scroll: {
    paddingBottom: 64
  },
  seedWord: {
    marginRight: 8
  },
  tableAmount: {
    alignItems: 'flex-end',
    width: TABLE_AMOUNT_COLUMN_WIDTH
  },
  tableFlex: {
    flex: 1
  },
  tableHeader: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingBottom: 6
  },
  tableIndex: {
    width: TABLE_INDEX_COLUMN_WIDTH
  },
  tableRow: {
    alignItems: 'center',
    borderBottomColor: Colors.gray[880],
    borderBottomWidth: 1,
    paddingVertical: 8
  },
  wrap: {
    flexWrap: 'wrap'
  }
})
