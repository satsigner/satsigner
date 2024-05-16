import { useState } from "react";
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { SortDirection } from "../../enums/SortDirection";

import UpArrowIcon from '../../assets/images/up-arrow.svg';
import DownArrowIcon from '../../assets/images/down-arrow.svg';
import { AppText } from "./AppText";
import { Colors } from "../../styles";

interface Props {
  onDirectionChanged: (direction: SortDirection) => void;
  label?: string;
  showArrow?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function SortDirectionToggle({
  onDirectionChanged,
  label,
  showArrow = true,
  style
}: Props) {
  const [direction, setDirection] = useState(SortDirection.Descending);

  function toggle() {
    const newDirection = direction === SortDirection.Ascending ?
      SortDirection.Descending :
      SortDirection.Ascending;
    
    setDirection(newDirection);
    onDirectionChanged(newDirection);
  }

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      activeOpacity={0.7}
      onPress={() => toggle()}
    >
      { label && <AppText style={styles.label}>{ label }</AppText> }

      <View style={styles.arrowContainer}>
        { !! showArrow && (direction === SortDirection.Ascending ?
          <UpArrowIcon width={14} height={5} /> :
          <DownArrowIcon width={14} height={5} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 14,
    borderColor: 'yellow',
    borderWidth: 0
  },
  label: {
    fontSize: 11,
    color: Colors.grey130,
    marginRight: 4
  }
});
