import SSPairedTabs from '@/components/SSPairedTabs'
import { t } from '@/locales'
import { type NostrKeyFormat } from '@/utils/nostr'

type SSNostrKeyFormatTabsProps = {
  format: NostrKeyFormat
  onChange: (format: NostrKeyFormat) => void
}

function SSNostrKeyFormatTabs({ format, onChange }: SSNostrKeyFormatTabsProps) {
  return (
    <SSPairedTabs
      activeTab={format}
      onChange={onChange}
      primary={{ key: 'bech32', label: t('nostrIdentity.keys.format.bech32') }}
      secondary={{ key: 'hex', label: t('nostrIdentity.keys.format.hex') }}
    />
  )
}

export default SSNostrKeyFormatTabs
