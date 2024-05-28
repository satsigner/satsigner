import {
  Circle,
  Group,
  Text as SkiaText,
  useFont
} from '@shopify/react-native-skia';
import React from 'react';
import { Platform } from 'react-native';
import { useDerivedValue, withTiming } from 'react-native-reanimated';
import { Utxo } from '../../../models/Utxo';
import { Colors } from '../../../styles';

interface BubbleProps {
  data: Utxo;
  x: number;
  y: number;
  radius: number;
  isSelected: boolean;
}

export const Bubble = ({ data, x, y, radius, isSelected }: BubbleProps) => {
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

    let platformOffset = Platform.OS === 'ios' ? 1.5 : 0.5;

    return x - (textDimensions?.width || 0) / 2 + platformOffset;
  };

  // center the text inside the circle vertically
  const getY = () => {
    // "/3" is just to make the text align properly in smaller Circle
    return y + (font?.getSize() || 0) / 3;
  };

  if (!font) {
    return null;
  }
  return (
    <Group>
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
};
