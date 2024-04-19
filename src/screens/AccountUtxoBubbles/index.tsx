import { Dimensions, StyleSheet, View } from 'react-native';

import { NavigationProp } from '@react-navigation/native';

import { Canvas } from '@shopify/react-native-skia';
import { hierarchy, pack } from 'd3';
import React, { useMemo, useState } from 'react';
import { useAccountsContext } from '../../components/accounts/AccountsContext';
import { Utxo } from '../../models/Utxo';
import { Layout } from '../../styles';
import { BubblePacking } from './components/BubblePacking';
import { GestureHandler } from './components/GestureHandler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useZoomGesture } from './hooks/useZoomGesture';

interface Props {
  navigation: NavigationProp<any>;
}

const { width, height } = Dimensions.get('window');

export const outpoint = (u: Utxo) => `${u.txid}:${u.vout}`;

export interface UtxoBubble {
  id: string;
  value: number;
  children: UtxoBubble[];
}

const GRAPH_HEIGHT = height - 44;
const GRAPH_WIDTH = width;

let canvasSize = { width: GRAPH_WIDTH, height: GRAPH_HEIGHT };

export default function AccountUtxoListScreen({ navigation }: Props) {
  const accountsContext = useAccountsContext();

  const { utxos } = accountsContext.currentAccount;

  let utxoList = utxos.map(i => {
    return {
      id: outpoint(i),
      children: [],
      value: i.value
    };
  });

  let utxoPack = useMemo(() => {
    const utxoHierarchy = () =>
      hierarchy<UtxoBubble>({
        id: 'root',
        children: utxoList,
        value: utxoList.reduce((acc, cur) => acc + cur.value, 0)
      })
        .sum(d => d?.value ?? 0)
        .sort((a, b) => (b?.value ?? 0) - (a?.value ?? 0));

    const createPack = pack<UtxoBubble>()
      .size([GRAPH_WIDTH, GRAPH_HEIGHT])
      .padding(4);

    const utxoPack = createPack(utxoHierarchy()).leaves();
    return utxoPack;
  }, [utxoList]);

  const {
    zoomGesture,
    onLayout,
    onLayoutContent,
    transform,
    contentContainerAnimatedStyle
  } = useZoomGesture({
    doubleTapConfig: {
      defaultScale: 2
    }
  });

  let [selectedCircle, setSelectedCircle] = useState<string[]>([]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container]} onLayout={onLayout}>
        <Canvas
          style={{
            ...canvasSize,
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1
          }}
          onLayout={onLayoutContent}>
          <BubblePacking
            transform={transform}
            selectedCircle={selectedCircle}
            utxoPack={utxoPack}
            canvasSize={canvasSize}
          />
        </Canvas>
        <GestureHandler
          contentContainerAnimatedStyle={contentContainerAnimatedStyle}
          canvasSize={canvasSize}
          onLayoutContent={onLayoutContent}
          selectedCircle={selectedCircle}
          setSelectedCircle={setSelectedCircle}
          bubblePack={utxoPack}
          zoomGesture={zoomGesture}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...Layout.container.base
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 4,
    elevation: 3,
    backgroundColor: 'white',
    marginHorizontal: 20
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '300',
    paddingTop: 8,
    paddingBottom: 8,
    marginRight: 30,
    marginLeft: 30,
    color: '#131313'
  }
});
