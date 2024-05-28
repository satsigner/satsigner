// To get react-native-handle-gesture to work in Skia, need to overlay the Skia Canvas with AnimatedView
// Hence, the Canvas is not nested inside the GestureHandler
// https://shopify.github.io/react-native-skia/docs/animations/gestures#element-tracking

import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useHeaderHeight } from '@react-navigation/elements';
import { NavigationProp } from '@react-navigation/native';
import { Canvas } from '@shopify/react-native-skia';
import { hierarchy, pack } from 'd3';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAccountsContext } from '../../components/accounts/AccountsContext';
import SelectedUtxosHeader from '../../components/accounts/SelectedUtxosHeader';
import { Utxo } from '../../models/Utxo';
import { Layout } from '../../styles';
import navUtils from '../../utils/NavUtils';
import { BubblePacking } from './components/BubblePacking';
import { GestureHandler } from './components/GestureHandler';
import { useGestures } from './hooks/useGestures';
import { useLayout } from './hooks/useLayout';
import { useTransactionBuilderContext } from '../../components/accounts/TransactionBuilderContext';
import { ZOOM_TYPE } from './types';
import { SharedValue } from 'react-native-reanimated';

interface Props {
  navigation: NavigationProp<any>;
}

export const getOutpoint = (u: Utxo) => `${u.txid}:${u.vout}`;

export interface UtxoListBubble extends Partial<Utxo> {
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

  const currentAccount = accountsContext.currentAccount;

  const utxoList = currentAccount?.utxos.map(data => {
    return {
      id: getOutpoint(data),
      children: [],
      value: data.value,
      timestamp: data.timestamp,
      txid: data.txid,
      vout: data.vout,
      label: data.label || '',
      addressTo: data.addressTo || '',
      keychain: data.keychain
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

  const checkFocalPointInsideCircles = useCallback(
    (
      translateX: number,
      translateY: number,
      descriptionVisible: SharedValue<string[]>
    ) => {
      for (const circle of utxoPack) {
        const distance = Math.sqrt(
          (circle.x - translateX) ** 2 + (circle.y - translateY) ** 2
        );
        if (distance <= circle.r) {
          descriptionVisible?.value.push(circle.data.id);
          console.log(
            `Focal point is inside the circle with center (${circle.data.value}`
          );
          return true;
        }
      }
      console.log('Focal point is not inside any circle');
      return false;
    },
    [utxoPack]
  );

  const { width: w, height: h, center, onCanvasLayout } = useLayout();
  const { animatedStyle, gestures, transform } = useGestures({
    width: w,
    height: h,
    center,
    isDoubleTapEnabled: true,
    maxPanPointers: Platform.OS === 'ios' ? 2 : 1,
    minPanPointers: 1,
    maxScale: 1000,
    minScale: 0.1,
    onDoubleTap: (zoomType, translate, descriptionVisible) => {
      if (zoomType === ZOOM_TYPE.ZOOM_IN) {
        checkFocalPointInsideCircles(
          translate?.x ?? 0,
          translate?.y ?? 0,
          descriptionVisible!
        );
      }
    }
  });

  const txnBuilderContext = useTransactionBuilderContext();
  const inputs = txnBuilderContext.getInputs();

  useEffect(() => {
    navUtils.setHeaderTitle(accountsContext.currentAccount.name, navigation);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container]}>
        <LinearGradient
          style={{
            ...Layout.container.topPadded,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            width: '100%'
          }}
          locations={[0.185, 0.5554, 0.7713, 1]}
          colors={['#000000F5', '#000000A6', '#0000004B', '#00000000']}>
          <SelectedUtxosHeader
            toggleScreenAction={'list'}
            navigation={navigation}
          />
        </LinearGradient>
        <Canvas
          style={[
            {
              ...canvasSize
            }
          ]}
          onLayout={onCanvasLayout}>
          <BubblePacking
            transform={transform}
            utxoPack={utxoPack}
            canvasSize={canvasSize}
            inputs={inputs}
          />
        </Canvas>

        <GestureHandler
          contentContainerAnimatedStyle={animatedStyle}
          canvasSize={canvasSize}
          onLayoutContent={onCanvasLayout}
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
