/** LND REST `ListPeers` (subset). */
export type LndListPeersResponse = {
  peers?: LndRestPeer[]
}

export type LndRestPeer = {
  address?: string
  pub_key?: string
}

/** LND REST `PendingChannels` (subset; arrays only for counts / light UI). */
export type LndPendingChannelsResponse = {
  pending_closing_channels?: unknown[]
  pending_force_closing_channels?: unknown[]
  pending_open_channels?: unknown[]
  waiting_close_channels?: unknown[]
}

/** LND REST `ExportAllChannelBackups` JSON (subset). */
export type LndChanBackupSnapshot = {
  multi_chan_backup?: { multi_chan_backup?: string }
  single_chan_backups?: unknown
}
