import { FlashList } from '@shopify/flash-list'
import { Stack } from 'expo-router'
import { StyleSheet } from 'react-native'

import {
  SSIconAbout,
  SSIconAdd,
  SSIconBitcoin,
  SSIconBlock,
  SSIconBubbles,
  SSIconCamera,
  SSIconChain,
  SSIconChainTip,
  SSIconChartSettings,
  SSIconChatBubble,
  SSIconCheckCircle,
  SSIconCheckCircleThin,
  SSIconChevronDown,
  SSIconChevronLeft,
  SSIconChevronRight,
  SSIconChevronUp,
  SSIconCircle,
  SSIconCircleX,
  SSIconCircleXThin,
  SSIconClose,
  SSIconCloseThin,
  SSIconCollapse,
  SSIconConverter,
  SSIconConverterActive,
  SSIconCurrency,
  SSIconDelete,
  SSIconDev,
  SSIconDiceFive,
  SSIconDiceFour,
  SSIconDiceOne,
  SSIconDiceSix,
  SSIconDiceThree,
  SSIconDiceTwo,
  SSIconDifficult,
  SSIconECash,
  SSIconEdit,
  SSIconEditPencil,
  SSIconEllipsis,
  SSIconExpand,
  SSIconExplorer,
  SSIconExplorerActive,
  SSIconEyeOff,
  SSIconEyeOn,
  SSIconFeature,
  SSIconFiat,
  SSIconGreen,
  SSIconGreenIndicator,
  SSIconGreenNoSecret,
  SSIconGreyIndicator,
  SSIconHalving,
  SSIconHamburger,
  SSIconHeart,
  SSIconHideWarning,
  SSIconHistoryChart,
  SSIconIncoming,
  SSIconIncomingLightning,
  SSIconInfo,
  SSIconInformation,
  SSIconKeys,
  SSIconLightning,
  SSIconLiquid,
  SSIconList,
  SSIconLNSettings,
  SSIconLock,
  SSIconMempool,
  SSIconMenu,
  SSIconMultiSignature,
  SSIconMutedRedIndicator,
  SSIconNetwork,
  SSIconNostr,
  SSIconOffboardCircle,
  SSIconOutgoing,
  SSIconOutgoingLightning,
  SSIconPasteClipboard,
  SSIconPencil,
  SSIconPlus,
  SSIconQR,
  SSIconRefresh,
  SSIconRemove,
  SSIconRepost,
  SSIconScan,
  SSIconScanNFC,
  SSIconScriptsP2pkh,
  SSIconSeed,
  SSIconServer,
  SSIconServerOptions,
  SSIconSettings,
  SSIconSigner,
  SSIconSignerActive,
  SSIconSingleSignature,
  SSIconSuccess,
  SSIconTable,
  SSIconTime,
  SSIconTrash,
  SSIconTriangle,
  SSIconWalletEye,
  SSIconWarning,
  SSIconX,
  SSIconYellowIndicator,
  SSIconZero
} from '@/components/icons'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

type IconEntry = {
  name: string
  Component: React.ComponentType<{ width?: number; height?: number }>
}

const ICON_COLUMNS = 5
const ICON_SIZE = 24
const ICON_ESTIMATED_ITEM_SIZE = 54

const ICON_LIST: IconEntry[] = [
  { Component: SSIconAbout, name: 'About' },
  { Component: SSIconAdd, name: 'Add' },
  { Component: SSIconBitcoin, name: 'Bitcoin' },
  { Component: SSIconBlock, name: 'Block' },
  { Component: SSIconBubbles, name: 'Bubbles' },
  { Component: SSIconCamera, name: 'Camera' },
  { Component: SSIconChain, name: 'Chain' },
  { Component: SSIconChainTip, name: 'ChainTip' },
  { Component: SSIconChartSettings, name: 'ChartSettings' },
  { Component: SSIconChatBubble, name: 'ChatBubble' },
  { Component: SSIconCheckCircle, name: 'CheckCircle' },
  { Component: SSIconCheckCircleThin, name: 'CheckCircleThin' },
  { Component: SSIconChevronDown, name: 'ChevronDown' },
  { Component: SSIconChevronLeft, name: 'ChevronLeft' },
  { Component: SSIconChevronRight, name: 'ChevronRight' },
  { Component: SSIconChevronUp, name: 'ChevronUp' },
  { Component: SSIconCircle, name: 'Circle' },
  { Component: SSIconCircleX, name: 'CircleX' },
  { Component: SSIconCircleXThin, name: 'CircleXThin' },
  { Component: SSIconClose, name: 'Close' },
  { Component: SSIconCloseThin, name: 'CloseThin' },
  { Component: SSIconCollapse, name: 'Collapse' },
  { Component: SSIconConverter, name: 'Converter' },
  { Component: SSIconConverterActive, name: 'ConverterActive' },
  { Component: SSIconCurrency, name: 'Currency' },
  { Component: SSIconDelete, name: 'Delete' },
  { Component: SSIconDev, name: 'Dev' },
  { Component: SSIconDiceOne, name: 'Dice1' },
  { Component: SSIconDiceTwo, name: 'Dice2' },
  { Component: SSIconDiceThree, name: 'Dice3' },
  { Component: SSIconDiceFour, name: 'Dice4' },
  { Component: SSIconDiceFive, name: 'Dice5' },
  { Component: SSIconDiceSix, name: 'Dice6' },
  { Component: SSIconDifficult, name: 'Difficult' },
  { Component: SSIconECash, name: 'ECash' },
  { Component: SSIconEdit, name: 'Edit' },
  { Component: SSIconEditPencil, name: 'EditPencil' },
  { Component: SSIconEllipsis, name: 'Ellipsis' },
  { Component: SSIconExpand, name: 'Expand' },
  { Component: SSIconExplorer, name: 'Explorer' },
  { Component: SSIconExplorerActive, name: 'ExplorerActive' },
  { Component: SSIconEyeOff, name: 'EyeOff' },
  { Component: SSIconEyeOn, name: 'EyeOn' },
  { Component: SSIconFeature, name: 'Feature' },
  { Component: SSIconFiat, name: 'Fiat' },
  { Component: SSIconGreen, name: 'Green' },
  { Component: SSIconGreenIndicator, name: 'GreenIndicator' },
  { Component: SSIconGreenNoSecret, name: 'GreenNoSecret' },
  { Component: SSIconGreyIndicator, name: 'GreyIndicator' },
  { Component: SSIconHalving, name: 'Halving' },
  { Component: SSIconHamburger, name: 'Hamburger' },
  { Component: SSIconHeart, name: 'Heart' },
  { Component: SSIconHideWarning, name: 'HideWarning' },
  { Component: SSIconHistoryChart, name: 'HistoryChart' },
  { Component: SSIconIncoming, name: 'Incoming' },
  { Component: SSIconIncomingLightning, name: 'IncomingLightning' },
  { Component: SSIconInfo, name: 'Info' },
  { Component: SSIconInformation, name: 'Information' },
  { Component: SSIconKeys, name: 'Keys' },
  { Component: SSIconLightning, name: 'Lightning' },
  { Component: SSIconLiquid, name: 'Liquid' },
  { Component: SSIconList, name: 'List' },
  { Component: SSIconLNSettings, name: 'LNSettings' },
  { Component: SSIconLock, name: 'Lock' },
  { Component: SSIconMempool, name: 'Mempool' },
  { Component: SSIconMenu, name: 'Menu' },
  { Component: SSIconMultiSignature, name: 'MultiSignature' },
  { Component: SSIconMutedRedIndicator, name: 'MutedRedIndicator' },
  { Component: SSIconNetwork, name: 'Network' },
  { Component: SSIconNostr, name: 'Nostr' },
  { Component: SSIconOffboardCircle, name: 'OffboardCircle' },
  { Component: SSIconOutgoing, name: 'Outgoing' },
  { Component: SSIconOutgoingLightning, name: 'OutgoingLightning' },
  { Component: SSIconPasteClipboard, name: 'PasteClipboard' },
  { Component: SSIconPencil, name: 'Pencil' },
  { Component: SSIconPlus, name: 'Plus' },
  { Component: SSIconQR, name: 'QR' },
  { Component: SSIconRefresh, name: 'Refresh' },
  { Component: SSIconRemove, name: 'Remove' },
  { Component: SSIconRepost, name: 'Repost' },
  { Component: SSIconScan, name: 'Scan' },
  { Component: SSIconScanNFC, name: 'ScanNFC' },
  { Component: SSIconScriptsP2pkh, name: 'ScriptsP2pkh' },
  { Component: SSIconSeed, name: 'Seed' },
  { Component: SSIconServer, name: 'Server' },
  { Component: SSIconServerOptions, name: 'ServerOptions' },
  { Component: SSIconSettings, name: 'Settings' },
  { Component: SSIconSigner, name: 'Signer' },
  { Component: SSIconSignerActive, name: 'SignerActive' },
  { Component: SSIconSingleSignature, name: 'SingleSignature' },
  { Component: SSIconSuccess, name: 'Success' },
  { Component: SSIconTable, name: 'Table' },
  { Component: SSIconTime, name: 'Time' },
  { Component: SSIconTrash, name: 'Trash' },
  { Component: SSIconTriangle, name: 'Triangle' },
  { Component: SSIconWalletEye, name: 'WalletEye' },
  { Component: SSIconWarning, name: 'Warning' },
  { Component: SSIconX, name: 'X' },
  { Component: SSIconYellowIndicator, name: 'YellowIndicator' },
  { Component: SSIconZero, name: 'Zero' }
]

function renderIconItem({ item }: { item: IconEntry }) {
  const Icon = item.Component
  return (
    <SSVStack gap="xxs" itemsCenter style={styles.cell}>
      <Icon width={ICON_SIZE} height={ICON_SIZE} />
      <SSText size="2xxs" color="muted" center>
        {item.name}
      </SSText>
    </SSVStack>
  )
}

function keyExtractor(item: IconEntry) {
  return item.name
}

export default function Icons() {
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.developer.icons')}</SSText>
          )
        }}
      />
      <SSMainLayout>
        <SSText
          size="xs"
          color="muted"
          uppercase
          weight="medium"
          style={styles.header}
        >
          {`Icons (${ICON_LIST.length})`}
        </SSText>
        <FlashList
          data={ICON_LIST}
          renderItem={renderIconItem}
          keyExtractor={keyExtractor}
          numColumns={ICON_COLUMNS}
          estimatedItemSize={ICON_ESTIMATED_ITEM_SIZE}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  cell: {
    paddingVertical: 8
  },
  header: {
    marginBottom: 12
  },
  list: {
    paddingBottom: 64
  }
})
