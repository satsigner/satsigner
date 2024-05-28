import { HierarchyCircularNode } from 'd3';
import React, { useCallback } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { ComposedGesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { DefaultStyle } from 'react-native-reanimated/lib/typescript/reanimated2/hook/commonTypes';
import { UtxoListBubble } from '..';
import { Colors } from '../../../styles';
import notImplementedAlert from '../../../components/shared/NotImplementedAlert';
import { useTransactionBuilderContext } from '../../../components/accounts/TransactionBuilderContext';
import Button from '../../../components/shared/Button';
import { Utxo } from '../../../models/Utxo';

interface GestureHandlerProps {
  debug?: boolean;
  bubblePack: HierarchyCircularNode<UtxoListBubble>[];
  zoomGesture: ComposedGesture;
  onLayoutContent: (e: LayoutChangeEvent) => void;
  canvasSize: { width: number; height: number };
  contentContainerAnimatedStyle: DefaultStyle;
}

export const GestureHandler = ({
  debug,
  canvasSize,
  bubblePack,
  zoomGesture,
  onLayoutContent,
  contentContainerAnimatedStyle
}: GestureHandlerProps) => {
  const txnBuilderContext = useTransactionBuilderContext();

  const hasSelectedUtxos = txnBuilderContext.getInputs().length > 0;

  const toggleSelected = useCallback(
    (utxo: Utxo): void => {
      const txnHasInput = txnBuilderContext.hasInput(utxo);

      txnHasInput
        ? txnBuilderContext.removeInput(utxo)
        : txnBuilderContext.addInput(utxo);
    },
    [txnBuilderContext]
  );

  const onPressCircle =
    (r: number, utxo: Utxo) => (event: GestureResponderEvent) => {
      const circleCenterX = r;
      const circleCenterY = r;
      const touchPointX = event.nativeEvent.locationX;
      const touchPointY = event.nativeEvent.locationY;
      const distance = Math.sqrt(
        Math.pow(touchPointX - circleCenterX, 2) +
          Math.pow(touchPointY - circleCenterY, 2)
      );
      // register a tap only when the tap is inside the circle
      if (distance <= r) {
        toggleSelected(utxo);
      }
    };

  return (
    <GestureDetector gesture={zoomGesture}>
      <View style={styles.fullScreen}>
        <Animated.View
          style={[
            {
              ...canvasSize
            },
            contentContainerAnimatedStyle
          ]}
          onLayout={onLayoutContent}>
          {bubblePack.map(({ x, y, r, data }) => {
            return (
              <Pressable
                key={data.id}
                hitSlop={0}
                pressRetentionOffset={0}
                style={{
                  width: r * 2,
                  height: r * 2,
                  backgroundColor: debug
                    ? 'rgba(100, 200, 300, 0.4)'
                    : 'transparent',
                  position: 'absolute',
                  left: x - r,
                  top: y - r,
                  borderRadius: r,
                  overflow: 'hidden'
                }}
                onPress={onPressCircle(r, {
                  txid: data.txid!,
                  vout: data.vout!,
                  keychain: data.keychain!,
                  addressTo: data.addressTo,
                  label: data.label,
                  timestamp: data.timestamp,
                  value: data.value
                })}>
                <Animated.View />
              </Pressable>
            );
          })}
        </Animated.View>
        <View style={styles.bottomSection}>
          <Pressable style={{}} onPress={() => {}}>
            <Text style={styles.secondaryText}>CUSTOM AMOUNT</Text>
          </Pressable>
          <Pressable style={{}} onPress={() => {}}>
            <Text style={styles.secondaryText}>SELECT ALL</Text>
          </Pressable>
        </View>
        <View style={styles.submitContainer}>
          <Button
            title="Add As Inputs To Message"
            style={
              hasSelectedUtxos ? styles.submitEnabled : styles.submitDisabled
            }
            disabled={!hasSelectedUtxos}
            onPress={notImplementedAlert}></Button>
        </View>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  bottomSection: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    position: 'absolute',
    bottom: 100,
    width: '100%',
    paddingHorizontal: 16
  },
  fullScreen: {
    flex: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 4,
    elevation: 3,
    backgroundColor: Colors.white,
    position: 'absolute',
    bottom: 0,
    right: 16,
    left: 16
  },
  secondaryText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    opacity: 0.6,
    color: '#FFFFFF'
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    paddingTop: 8,
    paddingBottom: 8,
    marginRight: 30,
    marginLeft: 30,
    color: Colors.grey19
  },
  submitEnabled: {
    width: '92%',
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText
  },
  submitDisabled: {
    width: '92%',
    backgroundColor: Colors.disabledActionBackground,
    color: Colors.disabledActionText
  },
  submitContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 20,
    width: '100%'
  }
});
