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
  SSIconTime
} from '@/components/icons'
import { t } from '@/locales'
import { type NavMenuGroup, PLATFORM } from '@/types/navigation/navMenu'

export const navMenuGroups: NavMenuGroup[] = [
  {
    title: t('navigation.label.signer'),
    items: [
      {
        title: t('navigation.item.bitcoin'),
        icon: SSIconBitcoin,
        url: '/accountList',
        isSoon: false,
        platform: PLATFORM.HYBRID
      },
      {
        title: t('navigation.item.lightning'),
        icon: SSIconLightning,
        url: '/signer/lightning',
        isSoon: false,
        platform: PLATFORM.HYBRID
      },
      {
        title: t('navigation.item.liquid'),
        icon: SSIconLiquid,
        url: '',
        isSoon: true,
        platform: PLATFORM.HYBRID
      },
      {
        title: t('navigation.item.ecash'),
        icon: SSIconECash,
        url: '',
        isSoon: true,
        platform: PLATFORM.ANDROID
      },
      {
        title: t('navigation.item.nostr'),
        icon: SSIconLightning,
        url: '',
        isSoon: true,
        platform: PLATFORM.HYBRID
      }
    ]
  },
  {
    title: t('navigation.label.explorer'),
    items: [
      {
        title: t('navigation.item.chaintip'),
        icon: SSIconChainTip,
        url: '',
        isSoon: true,
        platform: PLATFORM.HYBRID
      },
      {
        title: t('navigation.item.mempool'),
        icon: SSIconMempool,
        url: '',
        isSoon: true,
        platform: PLATFORM.HYBRID
      },
      {
        title: t('navigation.item.difficulty'),
        icon: SSIconDifficult,
        url: '/explorer/difficulty',
        isSoon: false,
        platform: PLATFORM.HYBRID
      },
      {
        title: t('navigation.item.block'),
        icon: SSIconBlock,
        url: '/explorer/block',
        isSoon: false,
        platform: PLATFORM.HYBRID
      },
      {
        title: t('navigation.item.halving'),
        icon: SSIconHalving,
        url: '',
        isSoon: true,
        platform: PLATFORM.HYBRID
      },
      {
        title: t('navigation.item.chain'),
        icon: SSIconChain,
        url: '',
        isSoon: true,
        platform: PLATFORM.HYBRID
      }
    ]
  },
  {
    title: t('navigation.label.converter'),
    items: [
      {
        title: t('navigation.item.currency'),
        icon: SSIconCurrency,
        url: '/converter/currency',
        isSoon: false,
        platform: PLATFORM.HYBRID
      },
      {
        title: t('navigation.item.time'),
        icon: SSIconTime,
        url: '',
        isSoon: true,
        platform: PLATFORM.HYBRID
      },
      {
        title: t('navigation.item.energy'),
        icon: SSIconLightning,
        url: '/converter/energy',
        isSoon: false,
        platform: PLATFORM.ANDROID
      }
    ]
  }
]
