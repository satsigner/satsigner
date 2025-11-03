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

const defaultStrategu: ConflictStrategy = 'incoming'

function SSLabelConflict({ conflicts }: SSLabelConflictProps) {
  const [conflictStrategy, setConflictStrategy] =
    useState<ConflictStrategy>(defaultStrategu)
  const [conflictStrategyPerLabel, setConflictStrategyPerLabel] = useState<
    ConflictStrategy[]
  >([])
  const [result, setResult] = useState<Label[]>([])

  function solveConflict(
    current: Label,
    incoming: Label,
    strategy: ConflictStrategy
  ): Label {
    switch (strategy) {
      case 'current':
        return { ...incoming, ...current }
      case 'incoming':
        return { ...current, ...incoming }
      case 'merge':
        return {
          ...current,
          ...incoming,
          label: `${current.label}; ${incoming.label}`
        }
      case 'manual':
        return {
          ...current,
          ...incoming,
          label: ''
        }
    }
  }

  function solveConflictByIndex(index: number, strategy: ConflictStrategy) {
    const [current, incoming] = conflicts[index]
    const solved = solveConflict(current, incoming, strategy)

    const newResults = [...result]
    newResults[index] = solved
    setResult(newResults)

    const newLabelStrategies = [...conflictStrategyPerLabel]
    newLabelStrategies[index] = strategy
    setConflictStrategyPerLabel(newLabelStrategies)
  }

  useEffect(() => {
    setResult(
      conflicts.map(([current, incoming]) =>
        solveConflict(current, incoming, conflictStrategy)
      )
    )
    if (conflictStrategy.length !== conflictStrategyPerLabel.length) {
      setConflictStrategyPerLabel(
        Array(conflicts.length).fill(defaultStrategu) as ConflictStrategy[]
      )
    }
  }, [conflicts, conflictStrategy, conflictStrategyPerLabel])

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
            {conflictStrategy === 'manual' && (
              <SSVStack gap="none">
                <SSText>Select what to do with this conflict</SSText>
                <SSVStack gap="sm">
                  {conflictStrategies.map((strategy) => {
                    return (
                      <SSCheckbox
                        key={strategy}
                        selected={strategy === conflictStrategyPerLabel[index]}
                        label={strategy}
                        onPress={() =>
                          solveConflictByIndex(index, strategy)
                        }
                      />
                    )
                  })}
                </SSVStack>
              </SSVStack>
            )}
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
