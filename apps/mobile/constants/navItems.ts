import {
  SSIconBitcoin,
  SSIconBlock,
  SSIconChain,
  SSIconChainTip,
  SSIconCurrency,
  SSIconDifficult,
  SSIconECash,
  SSIconHalving,
  SSIconLightning,
  SSIconLiquid,
  SSIconMempool,
  SSIconNetwork,
  SSIconNostr,
  SSIconServer,
  SSIconTransaction,
  SSIconTime,
  SSIconTriangle
} from '@/components/icons'
import { t } from '@/locales'
import { type NavMenuGroup, PLATFORM } from '@/types/navigation/navMenu'

export const navMenuGroups: NavMenuGroup[] = [
  {
    items: [
      {
        icon: SSIconBitcoin,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.bitcoin'),
        url: '/signer/bitcoin/accountList'
      },
      {
        icon: SSIconLightning,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.lightning'),
        url: '/signer/lightning'
      },
      {
        icon: SSIconTriangle,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.ark'),
        url: '/signer/ark'
      },
      {
        icon: SSIconLiquid,
        isSoon: true,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.liquid'),
        url: ''
      },
      {
        icon: SSIconECash,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.ecash'),
        url: '/signer/ecash'
      },
      {
        icon: SSIconNostr,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.nostr'),
        url: '/signer/nostr'
      }
    ],
    title: t('navigation.label.signer')
  },
  {
    items: [
      {
        icon: SSIconChainTip,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.chaintip'),
        url: '/explorer/chaintip'
      },
      {
        icon: SSIconMempool,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.mempool'),
        url: '/explorer/mempool'
      },
      {
        icon: SSIconBlock,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.block'),
        url: '/explorer/block'
      },
      {
        icon: SSIconTransaction,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.transaction'),
        url: '/explorer/transaction'
      },
      {
        icon: SSIconDifficult,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.difficulty'),
        url: '/explorer/difficulty'
      },
      {
        icon: SSIconHalving,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.halving'),
        url: '/explorer/halving'
      },
      {
        icon: SSIconChain,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.chain'),
        url: '/explorer/chain'
      },
      {
        icon: SSIconServer,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.node'),
        url: '/explorer/node'
      },
      {
        icon: SSIconNetwork,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.network'),
        url: '/explorer/network'
      }
    ],
    title: t('navigation.label.explorer')
  },
  {
    items: [
      {
        icon: SSIconCurrency,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.currency'),
        url: '/converter/currency'
      },
      {
        icon: SSIconTime,
        isSoon: true,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.time'),
        url: ''
      },
      {
        icon: SSIconLightning,
        isSoon: false,
        platform: PLATFORM.ANDROID,
        title: t('navigation.item.energy'),
        url: '/converter/energy'
      }
    ],
    title: t('navigation.label.converter')
  }
]
