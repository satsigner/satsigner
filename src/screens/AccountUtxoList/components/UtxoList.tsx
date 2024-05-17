import { useCallback } from "react";

import { useTransactionBuilderContext } from '../../../components/accounts/TransactionBuilderContext';
import { SortDirection } from "../../../enums/SortDirection";
import { compareTimestampedAsc, compareTimestampedDesc } from '../../../utils/compareTimestamped'

import { SortField } from "../enums/SortField";
import UtxoItem from './UtxoItem';

interface Props {
  utxos: Utxo[];
  sortDirection: SortDirection;
  sortField: SortField;
}

export default function UtxoList({
  utxos,
  sortDirection,
  sortField
}: Props) {
  const txnBuilderContext = useTransactionBuilderContext();
  const getUtxoKey = txnBuilderContext.getOutpoint;

  const largestValue = Math.max(...utxos.map(utxo => utxo.value));

  const toggleSelected = useCallback((utxo: Utxo): void => {
    const txnHasInput = txnBuilderContext.hasInput(utxo);

    txnHasInput ?
      txnBuilderContext.removeInput(utxo) :
      txnBuilderContext.addInput(utxo);
  }, [txnBuilderContext]);

  function sortUtxos(utxos: Utxo[]): Utxo[] {
    return utxos?.sort(
      sortDirection === SortDirection.Ascending ?
        (sortField === SortField.Date ? compareTimestampedAsc : compareAmountAsc) :
        (sortField === SortField.Date ? compareTimestampedDesc : compareAmountDesc)      
    );
  }

  function compareAmountAsc(u1: Utxo, u2: Utxo): number {
    return (u1?.value || 0) - (u2?.value || 0);
  }

  function compareAmountDesc(u1: Utxo, u2: Utxo): number {
    return compareAmountAsc(u2, u1);
  }

  return (
    <>
      { sortUtxos(utxos).map(utxo =>
        <UtxoItem
          key={getUtxoKey(utxo)}
          utxo={utxo}
          utxoSelected={txnBuilderContext.hasInput(utxo)}
          onToggleSelected={toggleSelected}
          largestValue={largestValue}
        />
      )}
    </>
  );
}