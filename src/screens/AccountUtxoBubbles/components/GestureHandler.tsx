import { HierarchyCircularNode, text } from 'd3';
import React from 'react';
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
import { UtxoBubble } from '..';
import { Colors } from '../../../styles';

interface GestureHandlerProps {
  debug?: boolean;
  bubblePack: HierarchyCircularNode<UtxoBubble>[];
  selectedCircle: string[];
  zoomGesture: ComposedGesture;
  setSelectedCircle: (selectedCircle: string[]) => void;
  onLayoutContent: (e: LayoutChangeEvent) => void;
  canvasSize: { width: number; height: number };
  contentContainerAnimatedStyle: DefaultStyle;
}

export const GestureHandler = ({
  debug,
  canvasSize,
  bubblePack,
  setSelectedCircle,
  selectedCircle,
  zoomGesture,
  onLayoutContent,
  contentContainerAnimatedStyle
}: GestureHandlerProps) => {
  let onPressCircle =
    (selectedId: string, r: number, x: number, y: number) =>
    (event: GestureResponderEvent) => {
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
        if (selectedCircle.includes(selectedId)) {
          return setSelectedCircle(
            selectedCircle.filter(id => id !== selectedId)
          );
        }
        setSelectedCircle([...selectedCircle, selectedId]);
      }
    };

  return (
    <GestureDetector gesture={zoomGesture}>
      <View style={styles.fullScreen}>
        <Animated.View
          style={[
            {
              ...canvasSize,
              position: 'absolute'
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
                onPress={onPressCircle(data.id, r, x, y)}>
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
        <Pressable style={styles.button} onPress={() => {}}>
          <Text style={styles.text}>ADD AS INPUTS TO MESSAGE</Text>
        </Pressable>
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
  }
});
