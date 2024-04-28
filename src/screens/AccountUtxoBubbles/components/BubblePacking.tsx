import {
  Circle,
  Group,
  Text as SkiaText,
  useFont
} from '@shopify/react-native-skia';
import { HierarchyCircularNode, text } from 'd3';
import React, { useMemo } from 'react';
import {
  useDerivedValue,
  withTiming,
  type SharedValue
} from 'react-native-reanimated';
import { UtxoListBubble } from '..';
import { Colors } from '../../../styles';

interface BubblePackingProps {
  transform: Readonly<SharedValue<any>>;
  utxoPack: HierarchyCircularNode<UtxoListBubble>[];
  selectedCircle: string[];
  canvasSize: { width: number; height: number };
}

export const BubblePacking = ({
  selectedCircle,
  utxoPack,
  transform,
  canvasSize
}: BubblePackingProps) => {
  const centerX = canvasSize.width / 2;
  const centerY = canvasSize.height / 2;
  return (
    <Group transform={transform} origin={{ x: centerX, y: centerY }}>
      {utxoPack.map(({ x, y, r: radius, data }) => {
        const isSelected = selectedCircle?.includes(data.id);

        const bgColor = useDerivedValue(() => {
          if (isSelected) {
            return withTiming(Colors.white);
          } else {
            return withTiming(Colors.grey107);
          }
        });

        // size of font relative to the radius of the circle
        const fontSize = radius / 6;

        const font = useFont(
          require('../../../assets/fonts/SF-Pro-Display-Light.otf'),
          fontSize
        );

        const selectedFont = useFont(
          require('../../../assets/fonts/SF-Pro-Display-Medium.otf'),
          fontSize
        );

        const text = data.value.toLocaleString() + ' sats';

        // center the text inside the circle horizontally
        const getX = () => {
          const textDimensions = isSelected
            ? selectedFont?.measureText(data?.value ? text : '')
            : font?.measureText(data?.value ? text : '');
          let offset = 1.5;
          return x - (textDimensions?.width || 0) / 2 + offset;
        };

        // center the text inside the circle vertically
        const getY = () => {
          // TODO: find a better way to center the text vertically
          // "/3" is just to make the text align properly in smaller Circle
          return y + (font?.getSize() || 0) / 3;
        };

        if (!font) {
          return null;
        }

        return (
          <Group key={data.id}>
            <Circle
              antiAlias={true}
              cx={x}
              cy={y}
              r={radius}
              color={bgColor}
              style="fill"
            />
            {data.value && font && (
              <SkiaText
                text={text}
                x={getX()}
                y={getY()}
                font={isSelected ? selectedFont : font}
                style={'fill'}
                color={'#000000'}
                strokeWidth={1}
                antiAlias={true}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
};
