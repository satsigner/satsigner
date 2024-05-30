import {
  Circle,
  Group,
  Text as SkiaText,
  useFont
} from '@shopify/react-native-skia';
import React from 'react';
import { Platform } from 'react-native';
import {
  SharedValue,
  useDerivedValue,
  withTiming
} from 'react-native-reanimated';
import { Utxo } from '../../../models/Utxo';
import { Colors } from '../../../styles';
import formatAddress from '../../../utils/formatAddress';

interface BubbleProps {
  data: Utxo;
  x: number;
  y: number;
  radius: number;
  isSelected: boolean;
  descriptionOpacity: Readonly<SharedValue<0 | 1>>;
}

export const Bubble = ({
  data,
  x,
  y,
  radius,
  isSelected,
  descriptionOpacity
}: BubbleProps) => {
  const bgColor = useDerivedValue(() => {
    if (isSelected) {
      return withTiming(Colors.white);
    } else {
      return withTiming(Colors.grey107);
    }
  });

  // size of font relative to the radius of the circle
  const fontSize = radius / 5;

  const font = useFont(
    require('../../../assets/fonts/SF-Pro-Display-Light.otf'),
    fontSize
  );

  const selectedFont = useFont(
    require('../../../assets/fonts/SF-Pro-Display-Medium.otf'),
    fontSize
  );

  const descriptionLightFont = useFont(
    require('../../../assets/fonts/SF-Pro-Display-Light.otf'),
    fontSize / 2.85
  );

  const text = data.value.toLocaleString() + ' sats';
  const dateText = new Date(data?.timestamp || '').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const memoText = `memo ${data.label || '-'}`;
  const fromText = `from ${formatAddress(data.addressTo || '')}`;

  let platformOffset = Platform.OS === 'ios' ? 1.5 : 0.5;
  // center the text inside the circle horizontally
  const getX = () => {
    const textDimensions = isSelected
      ? selectedFont?.measureText(data?.value ? text : '')
      : font?.measureText(data?.value ? text : '');

    return x - (textDimensions?.width || 0) / 2 + platformOffset;
  };

  const dateDimensions = descriptionLightFont?.measureText(dateText);
  const memoDimensions = descriptionLightFont?.measureText(memoText);
  const fromDimensions = descriptionLightFont?.measureText(fromText);

  const getXDate = () => {
    return x - (dateDimensions?.width || 0) / 2 + platformOffset;
  };

  const getXMemo = () => {
    return x - (memoDimensions?.width || 0) / 2 + platformOffset;
  };

  const getXFrom = () => {
    return x - (fromDimensions?.width || 0) / 2 + platformOffset;
  };

  // center the text inside the circle vertically
  const getY = () => {
    // "/3" is just to make the text align properly in smaller Circle
    return y + (font?.getSize() || 0) / 3;
  };

  const spacingY = (descriptionLightFont?.getSize() || 0) * 4;

  const getYDate = () => {
    return getY() - spacingY;
  };

  const getYMemo = () => {
    return getY() + spacingY / 1.5;
  };

  const getYFrom = () => {
    return getY() + spacingY * 1.2;
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
        <Group>
          <SkiaText
            text={dateText}
            x={getXDate()}
            y={getYDate()}
            font={descriptionLightFont}
            style={'fill'}
            color={Colors.grey51}
            strokeWidth={1}
            opacity={descriptionOpacity}
            antiAlias={true}
          />
          <SkiaText
            text={text}
            x={getX()}
            y={getY()}
            font={isSelected ? selectedFont : font}
            style={'fill'}
            color={Colors.black}
            strokeWidth={1}
            antiAlias={true}
          />
          <SkiaText
            text={memoText}
            x={getXMemo()}
            y={getYMemo()}
            font={descriptionLightFont}
            style={'fill'}
            color={Colors.grey51}
            opacity={descriptionOpacity}
            strokeWidth={1}
            antiAlias={true}
          />
          <SkiaText
            text={fromText}
            x={getXFrom()}
            y={getYFrom()}
            font={descriptionLightFont}
            style={'fill'}
            color={Colors.grey51}
            opacity={descriptionOpacity}
            strokeWidth={1}
            antiAlias={true}
          />
        </Group>
      )}
    </Group>
  );
};
