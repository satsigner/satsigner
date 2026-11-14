import { StyleSheet, View } from 'react-native'

import {
  SCRIPT_DIAGRAMS,
  type ScriptDiagramItem
} from '@/constants/scriptDiagrams'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type ScriptVersionType } from '@/types/models/Script'

import SSText from './SSText'

type SSScriptDiagramProps = {
  scriptVersion: ScriptVersionType
}

function SSScriptDiagramChip({ item }: { item: ScriptDiagramItem }) {
  if (item.kind === 'opcode') {
    return (
      <View style={[styles.chip, styles.opcodeChip]}>
        <SSText type="mono" size="xs" color="black">
          {item.value}
        </SSText>
      </View>
    )
  }

  return (
    <View style={[styles.chip, styles.dataChip]}>
      <SSText type="mono" size="xs">
        {t(`script.diagram.data.${item.value}`)}
      </SSText>
    </View>
  )
}

function SSScriptDiagram({ scriptVersion }: SSScriptDiagramProps) {
  return (
    <SSVStack gap="sm" style={styles.container}>
      {SCRIPT_DIAGRAMS[scriptVersion].map((row) => (
        <SSVStack key={row.label} gap="xs">
          <SSText color="muted" size="xs" uppercase>
            {t(`script.diagram.${row.label}`)}
          </SSText>
          <View style={styles.chips}>
            {row.items.map((item) => (
              <SSScriptDiagramChip key={item.value} item={item} />
            ))}
          </View>
        </SSVStack>
      ))}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 2,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  container: {
    backgroundColor: Colors.gray[880],
    padding: 12
  },
  dataChip: {
    borderColor: Colors.gray[500]
  },
  opcodeChip: {
    backgroundColor: Colors.white,
    borderColor: Colors.white
  }
})

export default SSScriptDiagram
