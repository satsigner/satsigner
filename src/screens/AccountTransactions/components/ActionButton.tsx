import { ReactNode } from "react";
import { StyleProp, StyleSheet, TouchableHighlight, ViewStyle } from "react-native";

import { Colors } from "../../../styles";

interface Props {
  style: StyleProp<ViewStyle>;
  children: ReactNode;
  onPress: () => void;
}

export default function ActionButton({
  style,
  children,
  onPress
}: Props) {

  return (
    <TouchableHighlight
      activeOpacity={0.65}
      underlayColor={Colors.grey38}
      style={[styles.button, style]}
      onPress={onPress}
      >
      {children}
    </TouchableHighlight>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '40%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  }
})
