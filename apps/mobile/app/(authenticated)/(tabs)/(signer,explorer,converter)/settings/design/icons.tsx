import { FlashList } from '@shopify/flash-list'
import { Stack } from 'expo-router'
import { StyleSheet } from 'react-native'

import SSText from '@/components/SSText'
import {
  DESIGN_ICON_COUNT,
  DESIGN_ICON_GROUPS,
  type DesignIconEntry
} from '@/constants/designIconCatalog'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { type DesignIconRow, toDesignIconRows } from '@/utils/designIcons'

const tn = _tn('settings.developer.designSystem')

const ICON_COLUMNS = 5
const ICON_SIZE = 24
const ICON_ROWS = toDesignIconRows(DESIGN_ICON_GROUPS, ICON_COLUMNS)

function renderRow({ item }: { item: DesignIconRow<DesignIconEntry> }) {
  if (item.type === 'header') {
    return (
      <SSHStack justifyBetween style={styles.header}>
        <SSText size="xs" color="muted" uppercase weight="medium">
          {tn(`icons.group.${item.groupKey}`)}
        </SSText>
        <SSText size="xxs" color="muted">
          {item.count}
        </SSText>
      </SSHStack>
    )
  }

  return (
    <SSHStack gap="none">
      {item.icons.map(({ name, Component }) => (
        <SSVStack key={name} gap="xxs" itemsCenter style={styles.cell}>
          <Component width={ICON_SIZE} height={ICON_SIZE} />
          <SSText size="2xxs" color="muted" center numberOfLines={1}>
            {name}
          </SSText>
        </SSVStack>
      ))}
    </SSHStack>
  )
}

function keyExtractor(item: DesignIconRow<DesignIconEntry>) {
  return item.key
}

function getItemType(item: DesignIconRow<DesignIconEntry>) {
  return item.type
}

export default function DesignIcons() {
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
        <SSText size="xs" color="muted" style={styles.total}>
          {tn('count', { count: DESIGN_ICON_COUNT })}
        </SSText>
        <FlashList
          data={ICON_ROWS}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  cell: {
    paddingVertical: 8,
    width: `${100 / ICON_COLUMNS}%`
  },
  header: {
    paddingBottom: 4,
    paddingTop: 24
  },
  list: {
    paddingBottom: 64
  },
  total: {
    marginBottom: 4
  }
})
