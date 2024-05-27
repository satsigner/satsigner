import { Group } from '@shopify/react-native-skia';
import { HierarchyCircularNode } from 'd3';
import React from 'react';
import { type SharedValue } from 'react-native-reanimated';
import { UtxoListBubble } from '..';
import { Bubble } from './Bubble';
import { Utxo } from '../../../models/Utxo';
import { getOutpoint } from '..';
interface BubblePackingProps {
  transform: Readonly<SharedValue<any>>;
  utxoPack: HierarchyCircularNode<UtxoListBubble>[];
  canvasSize: { width: number; height: number };
  inputs: Utxo[];
}

export const BubblePacking = ({
  utxoPack,
  transform,
  canvasSize,
  inputs
}: BubblePackingProps) => {
  const centerX = canvasSize.width / 2;
  const centerY = canvasSize.height / 2;

  return (
    <Group transform={transform} origin={{ x: centerX, y: centerY }}>
      {utxoPack.map(({ x, y, r: radius, data }) => {
        const utxoDetails = {
          txid: data.txid!,
          vout: data.vout!,
          keychain: data.keychain!,
          addressTo: data.addressTo,
          label: data.label,
          timestamp: data.timestamp,
          value: data.value
        };

        const isSelected = inputs.some(
          input => getOutpoint(input) === getOutpoint(utxoDetails)
        );

        return (
          <Bubble
            key={data.id}
            data={utxoDetails}
            x={x}
            y={y}
            radius={radius}
            isSelected={isSelected}
          />
        );
      })}
    </Group>
  );
};
