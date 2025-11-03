import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import { type Label } from '@/utils/bip329'

import SSCheckbox from './SSCheckbox'
import SSText from './SSText'

type SSLabelConflictProps = {
  conflicts: [Label, Label][] // [current, incoming][]
  onResolve: (labels: Label[]) => void
}

const conflictStrategies = ['current', 'incoming', 'merge', 'manual'] as const

type ConflictStrategy = (typeof conflictStrategies)[number]

function SSLabelConflict({ conflicts }: SSLabelConflictProps) {
  const [conflictStrategy, setConflictStrategy] =
    useState<ConflictStrategy>('incoming')
  const [result, setResult] = useState<Label[]>([])

  useEffect(() => {
    let results: Label[] = []

    if (conflictStrategy === 'current') {
      results = conflicts.map(([current, _incoming]) => {
        return { ...current }
      })
    }

    if (conflictStrategy === 'incoming') {
      results = conflicts.map(([_current, incoming]) => {
        return { ...incoming }
      })
    }

    if (conflictStrategy === 'merge') {
      results = conflicts.map(([current, incoming]) => {
        return {
          ...current,
          ...incoming,
          label: `${current.label}; ${incoming.label}`
        }
      })
    }

    if (conflictStrategy === 'manual') {
      results = []
    }

    setResult(results)
  }, [conflictStrategy, conflicts])

  return (
    <SSVStack>
      <SSText>Select what to do with these conflicts</SSText>
      <SSVStack>
        {conflictStrategies.map((strategy) => {
          return (
            <SSCheckbox
              key={strategy}
              selected={strategy === conflictStrategy}
              label={strategy}
              onPress={() => setConflictStrategy(strategy)}
            />
          )
        })}
      </SSVStack>
      {conflicts.map(([current, incoming], index) => {
        return (
          <SSVStack key={index} gap="xs">
            <SSText uppercase weight="bold" size="md">
              Conflict {index + 1}
            </SSText>
            <SSHStack gap="none">
              <SSText weight="bold">Object type: </SSText>
              <SSText>{current.type}</SSText>
            </SSHStack>
            <SSVStack gap="none">
              <SSText weight="bold">Object ref:</SSText>
              <SSText type="mono">{current.ref}</SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold">Current label:</SSText>
              <SSText
                size="md"
                style={
                  conflictStrategy === 'incoming'
                    ? styles.rejected
                    : conflictStrategy === 'current' ||
                        conflictStrategy === 'merge'
                      ? styles.accepted
                      : styles.none
                }
              >
                {current.label}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold">Incoming label:</SSText>
              <SSText
                size="md"
                style={
                  conflictStrategy === 'current'
                    ? styles.rejected
                    : conflictStrategy === 'incoming' ||
                        conflictStrategy === 'merge'
                      ? styles.accepted
                      : styles.none
                }
              >
                {incoming.label}
              </SSText>
            </SSVStack>
            {result[index] && (
              <SSVStack gap="none">
                <SSText weight="bold">Result:</SSText>
                <SSText size="md" style={styles.info}>
                  {result[index].label}
                </SSText>
              </SSVStack>
            )}
          </SSVStack>
        )
      })}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  accepted: {
    backgroundColor: Colors.success
  },
  rejected: {
    backgroundColor: Colors.error
  },
  none: {},
  info: {
    backgroundColor: Colors.info
  }
})

export default SSLabelConflict
