import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { Alert, Linking } from 'react-native'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import type { LNDChannel, LNDGetInfoChain } from '@/types/models/LND'
import { shareFile } from '@/utils/filesystem'
import { getLndFundingTxMempoolUrl } from '@/utils/lndGetInfoChains'
import { getLndErrorMessage } from '@/utils/lndHttpError'

const CHANNEL_BACKUP_FILENAME_CHAN_PREFIX_LEN = 12

type ActionBusy = 'close' | 'export' | 'force' | null

type UseLndChannelDetailActionsParams = {
  channel: LNDChannel | undefined
  channelPointStr: string
  chanIdDecoded: string
  chains: readonly (string | LNDGetInfoChain)[] | undefined
  closeChannel: (
    channelPoint: string,
    opts: { force: boolean }
  ) => Promise<Record<string, unknown>>
  exportChannelBackupSingle: (
    channelPoint: string
  ) => Promise<Record<string, unknown>>
  fundingTxid: string
  getChannels: () => Promise<LNDChannel[]>
  onCloseSuccessNavigateBack: () => void
}

function useLndChannelDetailActions({
  channel,
  channelPointStr,
  chanIdDecoded,
  chains,
  closeChannel,
  exportChannelBackupSingle,
  fundingTxid,
  getChannels,
  onCloseSuccessNavigateBack
}: UseLndChannelDetailActionsParams) {
  const [actionBusy, setActionBusy] = useState<ActionBusy>(null)

  async function copyChannelPoint() {
    if (!channelPointStr) {
      return
    }
    await Clipboard.setStringAsync(channelPointStr)
    toast.success(t('lightning.channelDetail.channelPointCopied'))
  }

  async function openFundingExplorerAfterConfirm(url: string) {
    const supported = await Linking.canOpenURL(url)
    if (!supported) {
      toast.error(t('lightning.channelDetail.openFundingTxUnavailable'))
      return
    }
    await Linking.openURL(url)
  }

  function openFundingExplorer() {
    const url = getLndFundingTxMempoolUrl(fundingTxid, chains)
    if (!url) {
      toast.error(t('lightning.channelDetail.openFundingTxUnavailable'))
      return
    }
    Alert.alert(
      t('lightning.channelDetail.openFundingTxExternalTitle'),
      t('lightning.channelDetail.openFundingTxExternalMessage'),
      [
        { style: 'cancel', text: t('common.cancel') },
        {
          onPress: () => {
            void openFundingExplorerAfterConfirm(url)
          },
          style: 'default',
          text: t('common.continue')
        }
      ]
    )
  }

  async function exportChannelBackup() {
    if (!channel || !channelPointStr) {
      return
    }
    setActionBusy('export')
    try {
      const snap = await exportChannelBackupSingle(channelPointStr)
      await shareFile({
        dialogTitle: t('lightning.channelDetail.exportScbButton'),
        fileContent: JSON.stringify(snap, null, 2),
        filename: `lnd-channel-backup-${chanIdDecoded.slice(0, CHANNEL_BACKUP_FILENAME_CHAN_PREFIX_LEN)}-${Date.now()}.json`,
        mimeType: 'application/json'
      })
      toast.success(t('lightning.channelDetail.exportScbOk'))
    } catch (error: unknown) {
      toast.error(
        `${t('lightning.channelDetail.exportScbFailed')}: ${getLndErrorMessage(error)}`
      )
    } finally {
      setActionBusy(null)
    }
  }

  async function runChannelClose(force: boolean) {
    if (!channelPointStr) {
      return
    }
    setActionBusy(force ? 'force' : 'close')
    try {
      await closeChannel(channelPointStr, { force })
      toast.success(
        force
          ? t('lightning.channelDetail.forceCloseRequested')
          : t('lightning.channelDetail.closeRequested')
      )
      await getChannels()
      onCloseSuccessNavigateBack()
    } catch (error: unknown) {
      toast.error(
        `${t('lightning.channelDetail.actionFailed')}: ${getLndErrorMessage(error)}`
      )
    } finally {
      setActionBusy(null)
    }
  }

  function requestCloseCooperative() {
    Alert.alert(
      t('lightning.channelDetail.closeCooperativeTitle'),
      t('lightning.channelDetail.closeCooperativeMessage'),
      [
        { style: 'cancel', text: t('common.cancel') },
        {
          onPress: () => {
            void runChannelClose(false)
          },
          style: 'default',
          text: t('common.confirm')
        }
      ]
    )
  }

  function requestForceClose() {
    Alert.alert(
      t('lightning.channelDetail.forceCloseTitle'),
      t('lightning.channelDetail.forceCloseMessage'),
      [
        { style: 'cancel', text: t('common.cancel') },
        {
          onPress: () => {
            void runChannelClose(true)
          },
          style: 'destructive',
          text: t('common.confirm')
        }
      ]
    )
  }

  return {
    actionBusy,
    copyChannelPoint,
    exportChannelBackup,
    openFundingExplorer,
    requestCloseCooperative,
    requestForceClose
  }
}

export { useLndChannelDetailActions }
