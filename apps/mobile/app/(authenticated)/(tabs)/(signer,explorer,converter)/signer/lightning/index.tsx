import { Stack, usePathname, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconEyeOff, SSIconEyeOn } from '@/components/icons'
import SSIconBackArrow from '@/components/icons/SSIconBackArrow'
import SSIconChevronRight from '@/components/icons/SSIconChevronRight'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_EYE_TUCK,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_ICON_SIZE
} from '@/constants/headerChrome'
import { useLND } from '@/hooks/useLND'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useLightningStore } from '@/store/lightning'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { formatNumber } from '@/utils/format'
import {
  liquidityBarSegmentFlexParts,
  readLndChannelSatsField
} from '@/utils/lndChannelDetail'
import { showNavigation } from '@/utils/navigation'

const PRIVACY_MASK = '••••'
const HEADER_ICON_STROKE = '#828282'
const CARD_HORIZONTAL_INSET = 18

export default function LightningPage() {
  const router = useRouter()
  const pathname = usePathname()
  const segments = useSegments()
  const showDrawerNav = showNavigation(pathname, segments.length)
  const { config } = useLightningStore()
  const { channels: lndChannels, getChannels, isConnected, nodeInfo } = useLND()
  const [privacyMode, togglePrivacyMode] = useSettingsStore(
    useShallow((state) => [state.privacyMode, state.togglePrivacyMode])
  )

  useEffect(() => {
    if (!config || !isConnected) {
      return
    }
    void (async () => {
      try {
        await getChannels()
      } catch {
        // ignore
      }
    })()
  }, [config, isConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRCPPress = () => {
    // TODO: Implement RCP functionality
  }

  function goToSignerLanding() {
    router.replace({
      params: { tab: t('navigation.label.signer') },
      pathname: '/(authenticated)/(tabs)/(signer)'
    })
  }

  const handleLNDRestPress = () => {
    router.navigate('/signer/lightning/LNDRest')
  }

  const handleLDKPress = () => {
    // TODO: Implement LDK functionality
  }

  const handleConfigPress = () => {
    if (config) {
      const aliasParam =
        nodeInfo?.alias?.trim() || t('lightning.landing.unknownNode')
      const pubkeyParam =
        nodeInfo?.identity_pubkey?.trim() ||
        t('lightning.landing.notConnectedPubkey')
      router.navigate({
        params: {
          alias: aliasParam,
          pubkey: pubkeyParam
        },
        pathname: '/signer/lightning/node'
      })
    }
  }

  const renderConfigCard = () => {
    if (!config) {
      return null
    }

    const aliasRaw = nodeInfo?.alias?.trim() || ''
    const alias =
      aliasRaw.length > 0 ? aliasRaw : t('lightning.landing.unknownNode')
    const pubkey =
      nodeInfo?.identity_pubkey?.trim() ||
      t('lightning.landing.notConnectedPubkey')
    const activeChannelCount = nodeInfo?.num_active_channels || 0
    const peers = nodeInfo?.num_peers || 0
    const chainStatus = nodeInfo?.synced_to_chain
      ? t('lightning.landing.chainSynced')
      : t('lightning.landing.chainNotSynced')

    const channelList = lndChannels ?? []
    const nodeTotalCapacity = channelList.reduce((sum, channel) => {
      if (!channel || typeof channel !== 'object') {
        return sum
      }
      return sum + readLndChannelSatsField(channel, ['capacity'])
    }, 0)
    const totalLocalSats = channelList.reduce((sum, channel) => {
      if (!channel || typeof channel !== 'object') {
        return sum
      }
      return (
        sum +
        readLndChannelSatsField(channel, ['local_balance', 'localBalance'])
      )
    }, 0)
    const totalRemoteSats = channelList.reduce((sum, channel) => {
      if (!channel || typeof channel !== 'object') {
        return sum
      }
      return (
        sum +
        readLndChannelSatsField(channel, ['remote_balance', 'remoteBalance'])
      )
    }, 0)

    const nodeTotal = Math.max(0, nodeTotalCapacity)
    const loc =
      nodeTotal > 0 ? Math.max(0, Math.min(totalLocalSats, nodeTotal)) : 0
    const rem =
      nodeTotal > 0
        ? Math.max(0, Math.min(totalRemoteSats, nodeTotal - loc))
        : 0
    const {
      black: barFlexBlack,
      local: barFlexLocal,
      remote: barFlexRemote
    } = liquidityBarSegmentFlexParts(nodeTotal, loc, rem)
    const fmtStat = (n: number) =>
      privacyMode ? PRIVACY_MASK : formatNumber(n)

    return (
      <Pressable
        accessibilityRole="button"
        onPress={handleConfigPress}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
          !isConnected && styles.cardDisconnected
        ]}
      >
        <SSVStack style={styles.cardContent}>
          <SSHStack gap="md" justifyBetween style={styles.cardHeader}>
            <SSVStack gap="xs" style={styles.cardTitleCol}>
              <SSText numberOfLines={2} size="xl" weight="light">
                {alias}
              </SSText>
              <SSText
                color="muted"
                ellipsizeMode="middle"
                numberOfLines={1}
                size="xs"
                type="mono"
                weight="light"
              >
                {privacyMode ? PRIVACY_MASK : pubkey}
              </SSText>
            </SSVStack>
            <SSHStack gap="sm" style={styles.cardHeaderRight}>
              <View
                style={[
                  styles.statusPill,
                  isConnected ? styles.statusPillOn : styles.statusPillOff
                ]}
              >
                <SSText
                  color={isConnected ? 'white' : 'muted'}
                  size="xs"
                  weight="medium"
                >
                  {isConnected
                    ? t('lightning.landing.connectionConnected')
                    : t('lightning.landing.connectionDisconnected')}
                </SSText>
              </View>
              <SSIconChevronRight
                height={14}
                stroke={Colors.gray[100]}
                strokeWidth={1}
                width={10}
              />
            </SSHStack>
          </SSHStack>

          {isConnected ? (
            <>
              <SSVStack gap="xs" style={styles.cardLiquidityBlock}>
                <SSHStack
                  gap="md"
                  justifyBetween
                  style={styles.cardCapacityRow}
                >
                  <SSText color="muted" size="xs" weight="medium">
                    {t('lightning.landing.totalCapacity')}
                  </SSText>
                  <SSText color="white" size="sm" weight="medium">
                    {privacyMode
                      ? PRIVACY_MASK
                      : formatNumber(nodeTotalCapacity)}
                  </SSText>
                </SSHStack>

                <View style={styles.cardBalanceBarTrack}>
                  {privacyMode ? (
                    <View style={styles.cardBalanceBarPrivacyFill} />
                  ) : nodeTotal > 0 ? (
                    <View style={styles.cardBalanceBarSegments}>
                      {barFlexLocal > 0 ? (
                        <View
                          style={[
                            styles.cardBalanceSegment,
                            styles.cardBalanceSegmentMin,
                            {
                              backgroundColor: Colors.white,
                              flex: barFlexLocal
                            }
                          ]}
                        />
                      ) : null}
                      {barFlexRemote > 0 ? (
                        <View
                          style={[
                            styles.cardBalanceSegment,
                            styles.cardBalanceSegmentMin,
                            {
                              backgroundColor: Colors.gray[200],
                              flex: barFlexRemote
                            }
                          ]}
                        />
                      ) : null}
                      {barFlexBlack > 0 ? (
                        <View
                          style={[
                            styles.cardBalanceSegment,
                            {
                              backgroundColor: Colors.black,
                              flex: barFlexBlack
                            }
                          ]}
                        />
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.cardBalanceBarEmpty} />
                  )}
                </View>

                <SSHStack gap="md" justifyBetween style={styles.cardLegendRow}>
                  <SSHStack gap="xs" style={styles.cardLegendCluster}>
                    <SSText size="sm" weight="medium">
                      {fmtStat(totalLocalSats)}
                    </SSText>
                    <SSText color="muted" size="xxs" weight="medium">
                      {t('lightning.node.channelLiquidityLocal')}
                    </SSText>
                  </SSHStack>
                  <SSHStack gap="xs" style={styles.cardLegendClusterEnd}>
                    <SSText color="muted" size="xxs" weight="medium">
                      {t('lightning.node.channelLiquidityRemote')}
                    </SSText>
                    <SSText size="sm" weight="medium">
                      {fmtStat(totalRemoteSats)}
                    </SSText>
                  </SSHStack>
                </SSHStack>
              </SSVStack>

              <View style={styles.statsStrip}>
                <SSHStack gap="none" style={styles.statsRow}>
                  <View style={[styles.statCell, styles.statCellBorder]}>
                    <SSText center color="muted" size="xxs" weight="medium">
                      {t('lightning.landing.channels')}
                    </SSText>
                    <SSText
                      center
                      size="lg"
                      weight="light"
                      style={styles.statValue}
                    >
                      {privacyMode ? PRIVACY_MASK : String(activeChannelCount)}
                    </SSText>
                  </View>
                  <View style={[styles.statCell, styles.statCellBorder]}>
                    <SSText center color="muted" size="xxs" weight="medium">
                      {t('lightning.landing.peers')}
                    </SSText>
                    <SSText
                      center
                      size="lg"
                      weight="light"
                      style={styles.statValue}
                    >
                      {privacyMode ? PRIVACY_MASK : String(peers)}
                    </SSText>
                  </View>
                  <View style={styles.statCell}>
                    <SSText center color="muted" size="xxs" weight="medium">
                      {t('lightning.landing.chain')}
                    </SSText>
                    <SSText
                      center
                      color={nodeInfo?.synced_to_chain ? 'white' : 'muted'}
                      numberOfLines={2}
                      size="sm"
                      weight="medium"
                      style={styles.statChainValue}
                    >
                      {chainStatus}
                    </SSText>
                  </View>
                </SSHStack>
              </View>
            </>
          ) : null}
        </SSVStack>
      </Pressable>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          ...(showDrawerNav
            ? {}
            : {
                headerLeft: () => {
                  const iconSize = HEADER_CHROME_ICON_SIZE
                  return (
                    <SSHStack
                      gap="none"
                      style={{
                        alignItems: 'center',
                        marginLeft: -HEADER_CHROME_EDGE_NUDGE
                      }}
                    >
                      <SSIconButton
                        style={HEADER_CHROME_HIT_BOX}
                        onPress={goToSignerLanding}
                      >
                        <SSIconBackArrow
                          height={iconSize}
                          stroke={HEADER_ICON_STROKE}
                          width={iconSize}
                        />
                      </SSIconButton>
                      <SSIconButton
                        style={[
                          HEADER_CHROME_HIT_BOX,
                          { marginLeft: -HEADER_CHROME_EYE_TUCK }
                        ]}
                        onPress={togglePrivacyMode}
                      >
                        {privacyMode ? (
                          <SSIconEyeOff
                            height={iconSize}
                            stroke={HEADER_ICON_STROKE}
                            width={iconSize}
                          />
                        ) : (
                          <SSIconEyeOn
                            height={iconSize}
                            stroke={HEADER_ICON_STROKE}
                            width={iconSize}
                          />
                        )}
                      </SSIconButton>
                    </SSHStack>
                  )
                }
              }),
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              Lightning
            </SSText>
          )
        }}
      />
      <SSMainLayout style={styles.mainLayout}>
        <SSVStack style={styles.content}>
          {renderConfigCard()}

          <SSVStack style={styles.buttonContainer}>
            <SSText center color="muted">
              {t('lightning.landing.connectExistingNode')}
            </SSText>
            <SSButton
              label="LND Rest"
              onPress={handleLNDRestPress}
              variant="gradient"
              gradientType="special"
              style={styles.button}
            />
            <SSButton
              label="LND RPC"
              onPress={handleRCPPress}
              variant="gradient"
              gradientType="special"
              disabled
              style={styles.button}
            />

            <SSText center color="muted">
              {t('lightning.landing.createNewNode')}
            </SSText>
            <SSButton
              label="LDK"
              onPress={handleLDKPress}
              variant="gradient"
              gradientType="special"
              disabled
              style={styles.button}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    width: '100%'
  },
  buttonContainer: {
    gap: 16,
    marginTop: 24,
    width: '100%'
  },
  card: {
    backgroundColor: Colors.gray[875],
    borderColor: Colors.gray[700],
    borderRadius: 3,
    borderWidth: 1,
    elevation: 6,
    marginTop: 24,
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    width: '100%'
  },
  cardBalanceBarEmpty: {
    alignSelf: 'stretch',
    backgroundColor: Colors.gray[800],
    flex: 1,
    minHeight: 12
  },
  cardBalanceBarPrivacyFill: {
    alignSelf: 'stretch',
    backgroundColor: Colors.gray[600],
    flex: 1,
    minHeight: 12
  },
  cardBalanceBarSegments: {
    alignSelf: 'stretch',
    flex: 1,
    flexDirection: 'row',
    minHeight: 12
  },
  cardBalanceBarTrack: {
    alignSelf: 'stretch',
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    height: 12,
    overflow: 'hidden',
    width: '100%'
  },
  cardBalanceSegment: {
    minWidth: 0
  },
  cardBalanceSegmentMin: {
    minWidth: 4
  },
  cardCapacityRow: {
    alignItems: 'baseline'
  },
  cardContent: {
    gap: 14,
    paddingHorizontal: CARD_HORIZONTAL_INSET,
    paddingVertical: 18
  },
  cardDisconnected: {
    borderColor: Colors.gray[600]
  },
  cardHeader: {
    alignItems: 'flex-start'
  },
  cardHeaderRight: {
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2
  },
  cardLegendCluster: {
    alignItems: 'baseline',
    flexShrink: 1,
    minWidth: 0
  },
  cardLegendClusterEnd: {
    alignItems: 'baseline',
    flexShrink: 1,
    minWidth: 0
  },
  cardLegendRow: {
    alignItems: 'baseline'
  },
  cardLiquidityBlock: {
    marginTop: 0
  },
  cardPressed: {
    borderColor: Colors.gray[500],
    opacity: 0.92,
    transform: [{ scale: 0.992 }]
  },
  cardTitleCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8
  },
  content: {
    alignItems: 'center',
    flex: 1
  },
  mainLayout: {
    paddingTop: 32
  },
  statCell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: 6,
    paddingVertical: 10
  },
  statCellBorder: {
    borderRightColor: Colors.gray[600],
    borderRightWidth: StyleSheet.hairlineWidth
  },
  statChainValue: {
    marginTop: 4,
    paddingHorizontal: 2
  },
  statValue: {
    marginTop: 6
  },
  statsRow: {
    alignItems: 'stretch'
  },
  statsStrip: {
    backgroundColor: Colors.gray[800],
    borderColor: Colors.gray[600],
    borderRadius: 3,
    borderWidth: 1,
    overflow: 'visible'
  },
  statusPill: {
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  statusPillOff: {
    backgroundColor: Colors.gray[800]
  },
  statusPillOn: {
    backgroundColor: Colors.gray[700]
  }
})
