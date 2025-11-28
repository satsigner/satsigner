import { useCallback, useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import { type Label } from '@/utils/bip329'

import SSButton from './SSButton'
import SSCheckbox from './SSCheckbox'
import SSText from './SSText'
import SSTextInput from './SSTextInput'

type SSLabelConflictProps = {
  conflicts: [Label, Label][] // [current, incoming][]
  onResolve: (labels: Label[]) => void
}

const conflictStrategies = ['current', 'incoming', 'merge', 'manual'] as const

type ConflictStrategy = (typeof conflictStrategies)[number]

const defaultStrategy: ConflictStrategy = 'incoming'

function SSLabelConflict({ conflicts, onResolve }: SSLabelConflictProps) {
  const [conflictStrategy, setConflictStrategy] =
    useState<ConflictStrategy>(defaultStrategy)
  const [conflictStrategyPerLabel, setConflictStrategyPerLabel] = useState<
    ConflictStrategy[]
  >([])
  const [results, setResults] = useState<Label[]>([])
  const [stage, setStage] = useState<
    'select_strategy' | 'manual_intervention' | 'result_preview'
  >('select_strategy')

  const confirmStrategy = useCallback(() => {
    if (conflictStrategy === 'manual') setStage('manual_intervention')
    else setStage('result_preview')
  }, [conflictStrategy])

  function solveConflict(
    current: Label,
    incoming: Label,
    strategy: ConflictStrategy
  ): Label {
    let label = ''
    switch (strategy) {
      case 'current':
        label = current.label
        break
      case 'incoming':
        label = incoming.label
        break
      case 'merge':
        label = `${current.label}; ${incoming.label}`
        break
      case 'manual':
        label = ''
        break
    }
    return { ...current, ...incoming, label }
  }

  function solveConflictByIndex(index: number, strategy: ConflictStrategy) {
    const [current, incoming] = conflicts[index]
    const solved = solveConflict(current, incoming, strategy)

    const newResults = [...results]
    newResults[index] = solved
    setResults(newResults)

    const newLabelStrategies = [...conflictStrategyPerLabel]
    newLabelStrategies[index] = strategy
    setConflictStrategyPerLabel(newLabelStrategies)
  }

  function solveConflictManually(index: number, label: string) {
    const newResults = [...results]
    newResults[index] = { ...newResults[index], label }
    setResults(newResults)
  }

  useEffect(() => {
    setResults(
      conflicts.map(([current, incoming]) =>
        solveConflict(current, incoming, conflictStrategy)
      )
    )
    if (
      conflictStrategy.length !== conflictStrategyPerLabel.length &&
      conflictStrategy === 'manual'
    ) {
      setConflictStrategyPerLabel(
        Array(conflicts.length).fill('manual') as ConflictStrategy[]
      )
    }
  }, [conflicts, conflictStrategy]) // eslint-disable-line react-hooks/exhaustive-deps

  function getStyle(type: 'current' | 'incoming', strategy: ConflictStrategy) {
    return [styles.preview, getBackgroundStyle(type, strategy)]
  }

  function getBackgroundStyle(
    type: 'current' | 'incoming',
    strategy: ConflictStrategy
  ) {
    switch (type) {
      case 'current':
        switch (strategy) {
          case 'current':
          case 'merge':
            return styles.accepted
          case 'incoming':
            return styles.rejected
          case 'manual':
            return styles.none
        }
      case 'incoming':
        switch (strategy) {
          case 'incoming':
          case 'merge':
            return styles.accepted
          case 'current':
            return styles.rejected
          case 'manual':
            return styles.none
        }
    }
  }

  return (
    <SSVStack style={{ width: '100%' }}>
      {stage === 'select_strategy' && (
        <SSVStack>
          <SSVStack gap="none">
            <SSText size="md">
              There are {conflicts.length} conflicts between the upcoming labels
              and current local labels.
            </SSText>
            <SSText size="md">Select what to do with the conflicts.</SSText>
          </SSVStack>
          <SSVStack gap="sm">
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
          <SSButton
            label="PROCEED"
            variant="secondary"
            onPress={confirmStrategy}
          />
        </SSVStack>
      )}
      {stage === 'manual_intervention' && (
        <SSVStack gap="lg">
          {conflicts.map(([current, incoming], index) => {
            return (
              <SSVStack key={index} gap="sm">
                <SSVStack gap="sm">
                  <SSText uppercase weight="bold" size="lg">
                    {`Conflict #${index + 1}`}
                  </SSText>
                  <SSVStack gap="xs">
                    <SSText size="md" weight="bold">
                      Object
                    </SSText>
                    <SSText type="mono">
                      {`${current.type} - ${current.ref}`}
                    </SSText>
                  </SSVStack>
                  <SSVStack gap="xs">
                    <SSText weight="bold" size="md">
                      Current label:
                    </SSText>
                    <SSText
                      size="md"
                      style={
                        conflictStrategy !== 'manual'
                          ? getStyle('current', conflictStrategy)
                          : getStyle('current', conflictStrategyPerLabel[index])
                      }
                    >
                      {current.label}
                    </SSText>
                  </SSVStack>
                  <SSVStack gap="xs">
                    <SSText weight="bold" size="md">
                      Incoming label:
                    </SSText>
                    <SSText
                      size="md"
                      style={
                        conflictStrategy !== 'manual'
                          ? getStyle('incoming', conflictStrategy)
                          : getStyle(
                              'incoming',
                              conflictStrategyPerLabel[index]
                            )
                      }
                    >
                      {incoming.label}
                    </SSText>
                  </SSVStack>
                </SSVStack>
                {conflictStrategy === 'manual' && (
                  <SSVStack gap="sm">
                    <SSText size="md">
                      Select what to do with this conflict:
                    </SSText>
                    <SSVStack gap="sm">
                      {conflictStrategies.map((strategy) => {
                        return (
                          <SSCheckbox
                            key={strategy}
                            selected={
                              strategy === conflictStrategyPerLabel[index]
                            }
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
                {conflictStrategy === 'manual' &&
                  conflictStrategyPerLabel[index] === 'manual' && (
                    <SSVStack gap="sm">
                      <SSText size="md">Enter the new label manually:</SSText>
                      <SSTextInput
                        size="small"
                        value={results[index].label}
                        onChangeText={(text) =>
                          solveConflictManually(index, text)
                        }
                        placeholder="Enter label manually"
                        style={
                          results[index].label === '' ? styles.invalidInput : {}
                        }
                      />
                    </SSVStack>
                  )}
                {results[index].label && (
                  <SSVStack gap="sm">
                    <SSText size="md" weight="bold">
                      Final label:
                    </SSText>
                    <SSText size="md" style={[styles.preview, styles.info]}>
                      {results[index].label}
                    </SSText>
                  </SSVStack>
                )}
              </SSVStack>
            )
          })}
          <SSButton
            label="CONFIRM"
            variant="secondary"
            disabled={results.some((label) => label.label === '')}
            onPress={() => onResolve(results)}
            style={styles.btn}
          />
        </SSVStack>
      )}
      {stage === 'result_preview' && (
        <SSVStack style={{ width: '100%' }}>
          <SSButton
            label="CANCEL"
            onPress={() => setStage('select_strategy')}
            style={styles.btn}
          />
          <SSButton
            label="CONFIRM"
            variant="secondary"
            disabled={results.some((label) => label.label === '')}
            onPress={() => onResolve(results)}
            style={styles.btn}
          />
        </SSVStack>
      )}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  preview: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4
  },
  accepted: {
    backgroundColor: Colors.success
  },
  rejected: {
    backgroundColor: Colors.error
  },
  none: {
    backgroundColor: Colors.gray[200]
  },
  info: {
    backgroundColor: Colors.info
  },
  invalidInput: {
    borderColor: Colors.error,
    borderWidth: 2
  },
  btn: {
    width: '100%'
  }
})

export default SSLabelConflict
