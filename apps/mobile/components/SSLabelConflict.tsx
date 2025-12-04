import { useCallback, useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'

import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import { type Label } from '@/utils/bip329'

import SSButton from './SSButton'
import SSCheckbox from './SSCheckbox'
import SSText from './SSText'
import SSTextInput from './SSTextInput'

type Conflict = [Label, Label] // [current, incoming]

type ConflictStrategy = (typeof conflictStrategies)[number]

type SSLabelConflictProps = {
  conflicts: Conflict[]
  onResolve: (labels: Label[]) => void
}

type SSLabelConflictItemProps = {
  conflict: Conflict
  conflictStrategy: ConflictStrategy
  conflictStrategyGlobal: ConflictStrategy
  finalLabel: string
  index: number
  onChangeLabel: (text: string) => void
  onSelectStrategy: (strategy: ConflictStrategy) => void
}

const conflictStrategies = ['current', 'incoming', 'merge', 'manual'] as const

const defaultStrategy: ConflictStrategy = 'incoming'

function SSLabelConflictItem({
  conflict: [current, incoming],
  conflictStrategy,
  conflictStrategyGlobal,
  index,
  finalLabel,
  onChangeLabel,
  onSelectStrategy
}: SSLabelConflictItemProps) {
  return (
    <SSVStack gap="md" style={[styles.labelItem]}>
      <SSVStack gap="sm">
        <SSText uppercase weight="bold" size="lg">
          {`Conflict #${index + 1}`}
        </SSText>
        <SSVStack gap="xs">
          <SSText size="md" weight="bold">
            Object
          </SSText>
          <SSText type="mono">{`${current.type} - ${current.ref}`}</SSText>
        </SSVStack>
        <SSVStack gap="xs">
          <SSText weight="bold" size="md">
            Current label
          </SSText>
          <SSText
            size="md"
            style={[
              styles.box,
              conflictStrategyGlobal === 'manual'
                ? bgStyles['current'][conflictStrategy]
                : bgStyles['current'][conflictStrategyGlobal]
            ]}
          >
            {current.label}
          </SSText>
        </SSVStack>
        <SSVStack gap="xs">
          <SSText weight="bold" size="md">
            Incoming label
          </SSText>
          <SSText
            size="md"
            style={[
              styles.box,
              conflictStrategyGlobal === 'manual'
                ? bgStyles['incoming'][conflictStrategy]
                : bgStyles['incoming'][conflictStrategyGlobal]
            ]}
          >
            {incoming.label}
          </SSText>
        </SSVStack>
      </SSVStack>
      {conflictStrategyGlobal === 'manual' && (
        <SSVStack gap="xs">
          <SSText size="md">Select what to do with this conflict</SSText>
          <SSVStack gap="sm">
            {conflictStrategies.map((strategy) => {
              return (
                <SSCheckbox
                  key={strategy}
                  selected={strategy === conflictStrategy}
                  label={strategy}
                  onPress={() => onSelectStrategy(strategy)}
                  unFillColor={Colors.gray[400]}
                  fillColor={Colors.gray[400]}
                />
              )
            })}
          </SSVStack>
        </SSVStack>
      )}
      {conflictStrategyGlobal === 'manual' && conflictStrategy === 'manual' && (
        <SSVStack gap="xs">
          <SSText size="md">Enter the new label manually</SSText>
          <SSTextInput
            size="small"
            value={finalLabel}
            onChangeText={(text) => onChangeLabel(text)}
            placeholder="Enter label manually"
            style={finalLabel === '' ? styles.invalidInput : {}}
          />
        </SSVStack>
      )}
      <SSVStack gap="xs">
        <SSText size="md" weight="bold">
          Final label
        </SSText>
        <SSText
          size="md"
          style={[styles.box, finalLabel ? styles.info : styles.none]}
        >
          {finalLabel || ' '}
        </SSText>
      </SSVStack>
    </SSVStack>
  )
}

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

  function solveConflictByIndex(strategy: ConflictStrategy, index: number) {
    const [current, incoming] = conflicts[index]
    const solved = solveConflict(current, incoming, strategy)

    const newResults = [...results]
    newResults[index] = solved
    setResults(newResults)

    const newLabelStrategies = [...conflictStrategyPerLabel]
    newLabelStrategies[index] = strategy
    setConflictStrategyPerLabel(newLabelStrategies)
  }

  function solveConflictManually(label: string, index: number) {
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
      {stage !== 'select_strategy' && (
        <SSVStack>
          {conflicts.map((conflict, index) => {
            return (
              <SSLabelConflictItem
                conflict={conflict}
                conflictStrategyGlobal={conflictStrategy}
                conflictStrategy={conflictStrategyPerLabel[index]}
                finalLabel={results[index].label}
                index={index}
                onChangeLabel={(text) => solveConflictManually(text, index)}
                onSelectStrategy={(strategy) =>
                  solveConflictByIndex(strategy, index)
                }
              />
            )
          })}
          <SSVStack gap="sm" style={{ width: '100%' }}>
            <SSButton
              label="CANCEL"
              onPress={() => setStage('select_strategy')}
              style={styles.button}
            />
            <SSButton
              label="CONFIRM"
              variant="secondary"
              disabled={results.some((label) => label.label === '')}
              onPress={() => onResolve(results)}
              style={styles.button}
            />
          </SSVStack>
        </SSVStack>
      )}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4
  },
  accepted: {
    backgroundColor: Colors.softBarGreen
  },
  rejected: {
    backgroundColor: Colors.softBarRed
  },
  none: {
    backgroundColor: Colors.gray[400]
  },
  info: {
    backgroundColor: Colors.success
  },
  invalidInput: {
    borderColor: Colors.error,
    borderWidth: 2
  },
  button: {
    width: '100%'
  },
  labelItem: {
    backgroundColor: '#333',
    borderRadius: 4,
    padding: 8
  }
})

const bgStyles = {
  current: {
    current: styles.accepted,
    merge: styles.accepted,
    incoming: styles.rejected,
    manual: styles.none
  },
  incoming: {
    incoming: styles.accepted,
    merge: styles.accepted,
    current: styles.rejected,
    manual: styles.none
  }
}

export default SSLabelConflict
