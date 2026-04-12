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
  SSIconNostr,
  SSIconTime
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
        isSoon: true,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.nostr'),
        url: ''
      }
    ],
    title: t('navigation.label.signer')
  },
  {
    items: [
      {
        icon: SSIconChainTip,
        isSoon: true,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.chaintip'),
        url: ''
      },
      {
        icon: SSIconMempool,
        isSoon: true,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.mempool'),
        url: ''
      },
      {
        icon: SSIconDifficult,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.difficulty'),
        url: '/explorer/difficulty'
      },
      {
        icon: SSIconBlock,
        isSoon: false,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.block'),
        url: '/explorer/block'
      },
      {
        icon: SSIconHalving,
        isSoon: true,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.halving'),
        url: ''
      },
      {
        icon: SSIconChain,
        isSoon: true,
        platform: PLATFORM.HYBRID,
        title: t('navigation.item.chain'),
        url: ''
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
