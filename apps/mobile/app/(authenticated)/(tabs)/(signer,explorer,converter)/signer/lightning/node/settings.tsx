import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSIconBackArrow from '@/components/icons/SSIconBackArrow'
import SSIconRefresh from '@/components/icons/SSIconRefresh'
import SSIconWarning from '@/components/icons/SSIconWarning'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_ICON_SIZE
} from '@/constants/headerChrome'
import { LND_SETTINGS_PEERS_MAX } from '@/constants/lightning'
import { useLND } from '@/hooks/useLND'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useLightningStore } from '@/store/lightning'
import { Colors, Layout } from '@/styles'
import type { LNDChanBackupSnapshot } from '@/types/models/Lightning'
import { shareFile } from '@/utils/filesystem'
import { lightningOpenChannelHref } from '@/utils/lightningNavigation'
import { formatLndChainsForUi } from '@/utils/lndGetInfoChains'
import { getLndErrorMessage, isLndPermissionError } from '@/utils/lndHttpError'
import {
  formatBestHeaderUtc,
  formatLndVersion,
  getPendingCounts
} from '@/utils/lndNodeSettings'

type SettingsPeerRowProps = {
  address: string
  onOpenChannel: (pubkey: string) => void
  pubkey: string
}

function SettingsPeerRow({
  address,
  onOpenChannel,
  pubkey
}: SettingsPeerRowProps) {
  function handleOpen() {
    if (!pubkey) {
      return
    }
    onOpenChannel(pubkey)
  }

  return (
    <View style={settingsPeerRowStyles.peerRow}>
      <SSText color="muted" size="xxs">
        {t('lightning.nodeSettings.peerAddress')}
      </SSText>
      <SSText size="xs" type="mono" numberOfLines={2}>
        {address || '—'}
      </SSText>
      <SSClipboardCopy text={pubkey}>
        <SSText ellipsizeMode="middle" numberOfLines={1} size="xs" type="mono">
          {pubkey || '—'}
        </SSText>
      </SSClipboardCopy>
      {pubkey ? (
        <SSButton
          label={t('lightning.nodeSettings.openChannel')}
          onPress={handleOpen}
          variant="outline"
        />
      ) : null}
    </View>
  )
}

const settingsPeerRowStyles = StyleSheet.create({
  peerRow: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingVertical: 8
  }
})

export default function NodeSettingsPage() {
  const router = useRouter()
  const params = useLocalSearchParams<{ alias: string }>()
  const [config, clearConfig] = useLightningStore(
    useShallow((s) => [s.config, s.clearConfig])
  )
  const lastSync = useLightningStore((s) => s.status.lastSync)
  const {
    exportAllChannelBackups,
    getInfo,
    getPendingChannels,
    getPeers,
    isConnected,
    isConnecting,
    nodeInfo
  } = useLND()
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [clearConfigVisible, setClearConfigVisible] = useState(false)

  const peersQuery = useQuery({
    enabled: isConnected,
    queryFn: getPeers,
    queryKey: ['lnd', 'peers', config?.url]
  })
  const pendingQuery = useQuery({
    enabled: isConnected,
    queryFn: getPendingChannels,
    queryKey: ['lnd', 'pending-channels', config?.url]
  })

  const peers = peersQuery.data ?? null
  const pending = pendingQuery.data ?? null
  const peersError = peersQuery.error
    ? getLndErrorMessage(peersQuery.error)
    : null
  const pendingError = pendingQuery.error
    ? getLndErrorMessage(pendingQuery.error)
    : null
  const peersLoading = peersQuery.isFetching || pendingQuery.isFetching

  function handleDisconnect() {
    setIsLoading(true)
    clearConfig()
    router.back()
    setIsLoading(false)
  }

  function handleBack() {
    router.back()
  }

  function handleOpenChannelWithPeer(pubkey: string) {
    router.push(lightningOpenChannelHref(pubkey))
  }

  function handleOpenClearConfig() {
    setClearConfigVisible(true)
  }

  function handleCloseClearConfig() {
    setClearConfigVisible(false)
  }

  function handleConfirmClearConfig() {
    setIsDeleting(true)
    setClearConfigVisible(false)
    clearConfig()
    router.navigate('/signer/lightning')
    setIsDeleting(false)
  }

  async function handleRefresh() {
    if (!isConnected) {
      return
    }
    setIsLoading(true)
    await getInfo()
    await Promise.all([peersQuery.refetch(), pendingQuery.refetch()])
    setIsLoading(false)
  }

  async function handleExportChannelBackupConfirm() {
    setBackupLoading(true)
    try {
      const snap: LNDChanBackupSnapshot = await exportAllChannelBackups()
      const multi = snap?.multi_chan_backup?.multi_chan_backup
      const hasSingle =
        snap?.single_chan_backups !== null &&
        snap?.single_chan_backups !== undefined &&
        typeof snap.single_chan_backups === 'object'
      if (!multi && !hasSingle) {
        toast.error(t('lightning.nodeSettings.exportBackupNoData'))
        return
      }
      await shareFile({
        dialogTitle: t('lightning.nodeSettings.channelBackupTitle'),
        fileContent: JSON.stringify(snap, null, 2),
        filename: `lnd-channel-backup-${Date.now()}.json`,
        mimeType: 'application/json'
      })
    } catch {
      toast.error(t('lightning.nodeSettings.exportBackupFailed'))
    } finally {
      setBackupLoading(false)
    }
  }

  function handleOpenNodeBackup() {
    router.push('/signer/lightning/node/backup')
  }

  function handleExportChannelBackup() {
    Alert.alert(
      t('lightning.nodeSettings.channelBackupTitle'),
      t('lightning.nodeSettings.channelBackupBlurb'),
      [
        { style: 'cancel', text: t('common.cancel') },
        {
          onPress: () => {
            void handleExportChannelBackupConfirm()
          },
          text: t('lightning.nodeSettings.exportChannelBackup')
        }
      ]
    )
  }

  const peerRows = peers?.peers ?? []
  const counts = getPendingCounts(pending)

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <SSIconButton
              style={[
                HEADER_CHROME_HIT_BOX,
                { marginLeft: -HEADER_CHROME_EDGE_NUDGE }
              ]}
              onPress={handleBack}
            >
              <SSIconBackArrow
                height={HEADER_CHROME_ICON_SIZE}
                stroke={Colors.gray[200]}
                width={HEADER_CHROME_ICON_SIZE}
              />
            </SSIconButton>
          ),
          headerRight: () => (
            <SSIconButton
              style={
                Platform.OS === 'android'
                  ? [
                      HEADER_CHROME_HIT_BOX,
                      { marginRight: -HEADER_CHROME_EDGE_NUDGE }
                    ]
                  : HEADER_CHROME_HIT_BOX
              }
              onPress={handleRefresh}
              disabled={!isConnected || isConnecting}
            >
              <SSIconRefresh height={16} width={19} />
            </SSIconButton>
          ),
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {t('lightning.nodeSettings.title', { alias: params.alias })}
            </SSText>
          )
        }}
      />
      <SSMainLayout style={styles.mainLayout}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack gap="md" style={styles.scrollInner}>
            <SSText color="muted" size="xs" style={styles.hint}>
              {t('lightning.nodeSettings.macaroonPermissionHint')}
            </SSText>

            <View>
              <SSText color="muted" size="sm" style={styles.sectionTitle}>
                {t('lightning.nodeSettings.nodeInformation')}
              </SSText>
              {nodeInfo && (
                <>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.version')}
                    </SSText>
                    <SSText>{formatLndVersion(nodeInfo.version)}</SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.channels')}
                    </SSText>
                    <SSText>{nodeInfo.num_active_channels}</SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.peers')}
                    </SSText>
                    <SSText>{nodeInfo.num_peers}</SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.chainSync')}
                    </SSText>
                    <SSText
                      color={nodeInfo.synced_to_chain ? 'white' : 'muted'}
                    >
                      {nodeInfo.synced_to_chain
                        ? t('lightning.nodeSettings.synced')
                        : t('lightning.nodeSettings.notSynced')}
                    </SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.blockHeight')}
                    </SSText>
                    <SSText>{nodeInfo.block_height}</SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.blockHash')}
                    </SSText>
                    <SSClipboardCopy text={nodeInfo.block_hash}>
                      <SSText
                        ellipsizeMode="middle"
                        numberOfLines={1}
                        style={styles.hashValue}
                        type="mono"
                      >
                        {nodeInfo.block_hash}
                      </SSText>
                    </SSClipboardCopy>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.identityPubkey')}
                    </SSText>
                    <SSClipboardCopy text={nodeInfo.identity_pubkey}>
                      <SSText
                        ellipsizeMode="middle"
                        numberOfLines={1}
                        style={styles.hashValue}
                        type="mono"
                      >
                        {nodeInfo.identity_pubkey}
                      </SSText>
                    </SSClipboardCopy>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.commitHash')}
                    </SSText>
                    <SSClipboardCopy text={nodeInfo.commit_hash}>
                      <SSText
                        ellipsizeMode="middle"
                        numberOfLines={1}
                        style={styles.hashValue}
                        type="mono"
                      >
                        {nodeInfo.commit_hash}
                      </SSText>
                    </SSClipboardCopy>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.chains')}
                    </SSText>
                    <SSText style={styles.flexShrink} numberOfLines={2}>
                      {formatLndChainsForUi(nodeInfo.chains) || '—'}
                    </SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.bestHeaderAt')}
                    </SSText>
                    <SSText type="mono" size="xs">
                      {formatBestHeaderUtc(nodeInfo.best_header_timestamp)}
                    </SSText>
                  </View>
                  {nodeInfo.uris?.length ? (
                    <View style={styles.uriBlock}>
                      <SSText
                        color="muted"
                        size="sm"
                        style={styles.sectionTitle}
                      >
                        {t('lightning.nodeSettings.uris')}
                      </SSText>
                      {nodeInfo.uris.map((uri) => (
                        <View key={uri} style={styles.uriRow}>
                          <SSClipboardCopy text={uri}>
                            <SSText
                              ellipsizeMode="middle"
                              numberOfLines={2}
                              size="xs"
                              type="mono"
                            >
                              {uri}
                            </SSText>
                          </SSClipboardCopy>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.infoItem}>
              <SSText color="muted">
                {t('lightning.nodeSettings.lastSync')}
              </SSText>
              <SSText color="muted" size="xs">
                {lastSync
                  ? new Date(lastSync).toISOString()
                  : t('lightning.nodeSettings.lastSyncNever')}
              </SSText>
            </View>

            <View>
              <SSText color="muted" size="sm" style={styles.sectionTitle}>
                {t('lightning.nodeSettings.connectionStatus')}
              </SSText>
              <View style={styles.infoItem}>
                <SSText color="muted">
                  {t('lightning.nodeSettings.status')}
                </SSText>
                <SSText color={isConnected ? 'white' : 'muted'}>
                  {isConnected
                    ? t('lightning.nodeSettings.connected')
                    : t('lightning.nodeSettings.disconnected')}
                </SSText>
              </View>
            </View>

            <View>
              <SSText color="muted" size="sm" style={styles.sectionTitle}>
                {t('lightning.nodeSettings.peersTitle')}
              </SSText>
              {peersLoading ? (
                <SSText color="muted" size="xs">
                  …
                </SSText>
              ) : peersError ? (
                <SSText color="muted" size="xs">
                  {isLndPermissionError(peersError)
                    ? t('lightning.nodeSettings.permissionDenied')
                    : `${t('lightning.nodeSettings.loadFailed')}: ${peersError}`}
                </SSText>
              ) : peerRows.length === 0 ? (
                <SSText color="muted" size="xs">
                  {t('lightning.nodeSettings.peersEmpty')}
                </SSText>
              ) : (
                peerRows.slice(0, LND_SETTINGS_PEERS_MAX).map((peer, i) => {
                  const pk = peer.pub_key ?? ''
                  const addr = peer.address ?? ''
                  return (
                    <SettingsPeerRow
                      address={addr}
                      key={`${pk || 'peer'}-${i}`}
                      onOpenChannel={handleOpenChannelWithPeer}
                      pubkey={pk}
                    />
                  )
                })
              )}
            </View>

            <View>
              <SSText color="muted" size="sm" style={styles.sectionTitle}>
                {t('lightning.nodeSettings.pendingChannelsTitle')}
              </SSText>
              {peersLoading ? (
                <SSText color="muted" size="xs">
                  …
                </SSText>
              ) : pendingError ? (
                <SSText color="muted" size="xs">
                  {isLndPermissionError(pendingError)
                    ? t('lightning.nodeSettings.permissionDenied')
                    : `${t('lightning.nodeSettings.loadFailed')}: ${pendingError}`}
                </SSText>
              ) : counts.opening +
                  counts.closing +
                  counts.forceClosing +
                  counts.waitingClose ===
                0 ? (
                <SSText color="muted" size="xs">
                  {t('lightning.nodeSettings.pendingEmpty')}
                </SSText>
              ) : (
                <SSVStack gap="xs">
                  <SSText size="sm">
                    {t('lightning.nodeSettings.pendingOpening')}:{' '}
                    {counts.opening}
                  </SSText>
                  <SSText size="sm">
                    {t('lightning.nodeSettings.pendingClosing')}:{' '}
                    {counts.closing}
                  </SSText>
                  <SSText size="sm">
                    {t('lightning.nodeSettings.pendingForceClosing')}:{' '}
                    {counts.forceClosing}
                  </SSText>
                  <SSText size="sm">
                    {t('lightning.nodeSettings.pendingWaitingClose')}:{' '}
                    {counts.waitingClose}
                  </SSText>
                </SSVStack>
              )}
            </View>

            <View>
              <SSText color="muted" size="sm" style={styles.sectionTitle}>
                {t('lightning.nodeSettings.backupNodeTitle')}
              </SSText>
              <SSText color="muted" size="xs" style={styles.backupBlurb}>
                {t('lightning.nodeSettings.backupNodeBlurb')}
              </SSText>
              <SSButton
                label={t('lightning.nodeSettings.backupNode')}
                onPress={handleOpenNodeBackup}
                variant="outline"
                style={styles.button}
              />
            </View>

            <View>
              <SSText color="muted" size="sm" style={styles.sectionTitle}>
                {t('lightning.nodeSettings.channelBackupTitle')}
              </SSText>
              <SSText color="muted" size="xs" style={styles.backupBlurb}>
                {t('lightning.nodeSettings.channelBackupBlurb')}
              </SSText>
              <SSButton
                label={t('lightning.nodeSettings.exportChannelBackup')}
                loading={backupLoading}
                onPress={handleExportChannelBackup}
                variant="outline"
                style={styles.button}
                disabled={!isConnected || isConnecting}
              />
            </View>

            <View>
              <SSText color="muted" size="sm" style={styles.sectionTitle}>
                {t('lightning.nodeSettings.nodeConfiguration')}
              </SSText>
              {config && (
                <>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.url')}
                    </SSText>
                    <SSText numberOfLines={1} ellipsizeMode="middle">
                      {config.url}
                    </SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.macaroon')}
                    </SSText>
                    <SSText numberOfLines={1} ellipsizeMode="middle">
                      {config.macaroon
                        ? '••••••••'
                        : t('lightning.nodeSettings.notSet')}
                    </SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">
                      {t('lightning.nodeSettings.certificate')}
                    </SSText>
                    <SSText numberOfLines={1} ellipsizeMode="middle">
                      {config.cert
                        ? '••••••••'
                        : t('lightning.nodeSettings.notSet')}
                    </SSText>
                  </View>
                </>
              )}
            </View>

            <SSVStack style={styles.actions} gap="sm">
              <SSButton
                label={t('lightning.nodeSettings.disconnectNode')}
                onPress={handleDisconnect}
                variant="outline"
                style={styles.button}
                loading={isLoading}
                disabled={!isConnected || isConnecting}
              />
              <SSButton
                label={t('lightning.nodeSettings.clearConfig')}
                onPress={handleOpenClearConfig}
                variant="danger"
                style={styles.button}
                loading={isDeleting}
                disabled={isConnecting}
              />
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
      <SSModal
        visible={clearConfigVisible}
        onClose={handleCloseClearConfig}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSVStack gap="lg" style={styles.clearConfigModal}>
          <SSVStack gap="xs" style={styles.clearConfigWarning}>
            <SSIconWarning
              height={20}
              width={20}
              fill="transparent"
              stroke={Colors.gray[400]}
            />
            <SSText center size="lg" uppercase>
              {t('lightning.nodeSettings.clearConfig')}
            </SSText>
            <SSText center color="muted">
              {t('lightning.nodeSettings.clearConfigMessage')}
            </SSText>
          </SSVStack>
          <SSButton
            label={t('lightning.nodeSettings.clearConfigConfirm')}
            onPress={handleConfirmClearConfig}
            variant="danger"
            loading={isDeleting}
          />
        </SSVStack>
      </SSModal>
    </>
  )
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 8
  },
  backupBlurb: {
    marginBottom: 8
  },
  button: {
    minHeight: 40
  },
  clearConfigModal: {
    paddingVertical: 8,
    width: '100%'
  },
  clearConfigWarning: {
    alignItems: 'center'
  },
  flexShrink: {
    flexShrink: 1,
    maxWidth: '70%',
    textAlign: 'right'
  },
  hashValue: {
    flexShrink: 1,
    maxWidth: '70%'
  },
  hint: {
    lineHeight: 18
  },
  infoItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  mainLayout: {
    flex: 1,
    paddingTop: 10
  },
  scrollContent: {
    flexGrow: 1,
    gap: 16,
    paddingBottom: Layout.mainContainer.paddingBottom
  },
  scrollInner: {
    flexGrow: 1
  },
  scrollView: {
    flex: 1
  },
  sectionTitle: {
    marginBottom: 4
  },
  uriBlock: {
    marginTop: 8
  },
  uriRow: {
    marginBottom: 6
  }
})
