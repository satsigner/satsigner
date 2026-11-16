import { StyleSheet } from 'react-native'

import { SCRIPT_DIAGRAMS } from '@/constants/scriptDiagrams'
import type { ScriptDiagramItem } from '@/constants/scriptDiagrams'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { ScriptVersionType } from '@/types/models/Script'

import SSText from './SSText'

type SSScriptDiagramProps = {
  scriptVersion: ScriptVersionType
}

function SSScriptDiagramChip({ item }: { item: ScriptDiagramItem }) {
  if (item.kind === 'opcode') {
    return (
      <SSHStack gap="none" style={[styles.chip, styles.opcodeChip]}>
        <SSText type="mono" size="xs" color="black">
          {item.value}
        </SSText>
      </SSHStack>
    )
  }

  return (
    <SSHStack gap="none" style={[styles.chip, styles.dataChip]}>
      <SSText type="mono" size="xs">
        {t(`script.diagram.data.${item.value}`)}
      </SSText>
    </SSHStack>
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
          <SSHStack gap="xs" style={styles.chips}>
            {row.items.map((item) => (
              <SSScriptDiagramChip key={item.value} item={item} />
            ))}
          </SSHStack>
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
    flexWrap: 'wrap'
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
