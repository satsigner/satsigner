import { StyleSheet, View } from "react-native";

import AddIcon from '../../../assets/images/plus.svg';
import RemoveIcon from '../../../assets/images/x.svg';
import { Colors } from "../../../styles";

interface Props {
  selected: boolean;
}

export default function SelectionIndicator({ selected }: Props) {
  return (
    <View style={[
      styles.selectButton,
      selected ? styles.selectButtonSelected : {}
    ]}>
      { ! selected && <AddIcon></AddIcon> }
      { selected && <RemoveIcon></RemoveIcon> }
    </View>
  );
}

const styles = StyleSheet.create({
  selectButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.grey79,
    height: 20,
    width: 20,
    borderRadius: 10
  },
  selectButtonSelected: {
    backgroundColor: Colors.red3
  }
})