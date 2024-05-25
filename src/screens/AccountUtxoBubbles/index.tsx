// To get react-native-handle-gesture to work in Skia, need to overlay the Skia Canvas with AnimatedView
// Hence, the Canvas is not nested inside the GestureHandler
// https://shopify.github.io/react-native-skia/docs/animations/gestures#element-tracking

import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { NavigationProp } from '@react-navigation/native';

import { Canvas } from '@shopify/react-native-skia';
import { hierarchy, pack } from 'd3';
import React, { useEffect, useMemo, useState } from 'react';
import { useAccountsContext } from '../../components/accounts/AccountsContext';
import { Utxo } from '../../models/Utxo';
import { Layout } from '../../styles';
import { BubblePacking } from './components/BubblePacking';
import { GestureHandler } from './components/GestureHandler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import navUtils from '../../utils/NavUtils';
import { useHeaderHeight } from '@react-navigation/elements';
import { useGestures } from './hooks/useGestures';
import { useLayout } from './hooks/useLayout';
interface Props {
  navigation: NavigationProp<any>;
}

export const outpoint = (u: Utxo) => `${u.txid}:${u.vout}`;

export interface UtxoListBubble {
  id: string;
  value: number;
  children: UtxoListBubble[];
}

export default function AccountUtxoListScreen({ navigation }: Props) {
  const accountsContext = useAccountsContext();
  const topHeaderHeight = useHeaderHeight();

  const { width, height } = useWindowDimensions();

  const GRAPH_HEIGHT = height - topHeaderHeight;
  const GRAPH_WIDTH = width;

  const canvasSize = { width: GRAPH_WIDTH, height: GRAPH_HEIGHT };

  const { utxos } = accountsContext.currentAccount;

  const utxoList = utxos.map(data => {
    return {
      id: outpoint(data),
      children: [],
      value: data.value
    };
  });

  const utxoPack = useMemo(() => {
    const utxoHierarchy = () =>
      hierarchy<UtxoListBubble>({
        id: 'root',
        children: utxoList,
        value: utxoList.reduce((acc, cur) => acc + cur.value, 0)
      })
        .sum(d => d?.value ?? 0)
        .sort((a, b) => (b?.value ?? 0) - (a?.value ?? 0));

    const createPack = pack<UtxoListBubble>()
      .size([GRAPH_WIDTH, GRAPH_HEIGHT])
      .padding(4);

    return createPack(utxoHierarchy()).leaves();
  }, [utxoList]);

  const { width: w, height: h, center, onCanvasLayout } = useLayout();
  const { animatedStyle, gestures, transform } = useGestures({
    width: w,
    height: h,
    center,
    isDoubleTapEnabled: true,
    maxPanPointers: Platform.OS === 'ios' ? 2 : 1,
    minPanPointers: 1,
    maxScale: 1000,
    minScale: 0.1
  });

  const [selectedCircle, setSelectedCircle] = useState<string[]>([]);

  useEffect(() => {
    navUtils.setHeaderTitle(accountsContext.currentAccount.name, navigation);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container]}>
        <Canvas
          style={[
            {
              ...canvasSize,
              borderWidth: 1,
              borderColor: 'red'
            }
          ]}
          onLayout={onCanvasLayout}>
          <BubblePacking
            transform={transform}
            selectedCircle={selectedCircle}
            utxoPack={utxoPack}
            canvasSize={canvasSize}
          />
        </Canvas>
        <GestureHandler
          contentContainerAnimatedStyle={animatedStyle}
          canvasSize={canvasSize}
          onLayoutContent={onCanvasLayout}
          selectedCircle={selectedCircle}
          setSelectedCircle={setSelectedCircle}
          bubblePack={utxoPack}
          zoomGesture={gestures}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...Layout.container.base
  }
});
