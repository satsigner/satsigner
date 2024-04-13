import { useState } from "react";
import { StyleProp, TouchableOpacity, ViewStyle } from "react-native";

import UpArrowIcon from '../../../assets/images/up-arrow.svg';
import DownArrowIcon from '../../../assets/images/down-arrow.svg';
import { SortDirection } from "../../../enums/SortDirection";

interface Props {
  onDirectionChanged: (direction: SortDirection) => void;
  style?: StyleProp<ViewStyle>;
}

export default function SortDirectionToggle({
  onDirectionChanged,
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
      style={style}
      activeOpacity={0.7}
      onPress={() => toggle()}
    >
      { direction === SortDirection.Ascending ?
        <UpArrowIcon width={14} height={5} /> :
        <DownArrowIcon width={14} height={5} />
      }
    </TouchableOpacity>
  );
}
