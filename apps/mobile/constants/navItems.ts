import {
  SSIconBitcoin,
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
import { type NavMenuGroup } from '@/types/navigation/navMenu'

export const navMenuGroups: NavMenuGroup[] = [
  {
    title: t('navigation.label.signer'),
    items: [
      {
        title: t('navigation.item.bitcoin'),
        icon: SSIconBitcoin,
        url: '/',
        isSoon: false
      },
      {
        title: t('navigation.item.lightning'),
        icon: SSIconLightning,
        url: '',
        isSoon: true
      },
      {
        title: t('navigation.item.liquid'),
        icon: SSIconLiquid,
        url: '',
        isSoon: true
      },
      {
        title: t('navigation.item.ecash'),
        icon: SSIconECash,
        url: '',
        isSoon: true
      },
      {
        title: t('navigation.item.nostr'),
        icon: SSIconLightning,
        url: '',
        isSoon: true
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
        isSoon: true
      },
      {
        title: t('navigation.item.mempool'),
        icon: SSIconMempool,
        url: '',
        isSoon: true
      },
      {
        title: t('navigation.item.difficult'),
        icon: SSIconDifficult,
        url: '',
        isSoon: true
      },
      {
        title: t('navigation.item.halving'),
        icon: SSIconHalving,
        url: '',
        isSoon: true
      },
      {
        title: t('navigation.item.chain'),
        icon: SSIconChain,
        url: '',
        isSoon: true
      }
    ]
  },
  {
    title: t('navigation.label.converter'),
    items: [
      {
        title: t('navigation.item.currency'),
        icon: SSIconCurrency,
        url: '',
        isSoon: true
      },
      {
        title: t('navigation.item.time'),
        icon: SSIconTime,
        url: '',
        isSoon: true
      },
      {
        title: t('navigation.item.energy'),
        icon: SSIconLightning,
        url: '',
        isSoon: true
      }
    ]
  }
]
